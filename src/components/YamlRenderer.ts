import { ProjectInfo, PluginSettings } from '@/types';
import { ParsedYamlStructure, YamlSection, YamlNode } from '../modules/YamlStructureParser';
import { VariableCache } from '../modules/VariableCache';
import { SectionHeader } from './SectionHeader';
import { VariableItem } from './VariableItem';
import { NestedGroup } from './NestedGroup';
import QuartoVariablesPlugin from '../main';

export class YamlRenderer {
  private container: HTMLElement;
  private plugin: QuartoVariablesPlugin;
  private variableCache: VariableCache;
  private settings: PluginSettings;
  private currentStructure: ParsedYamlStructure | null = null;
  private currentProjectInfo: ProjectInfo | null = null;
  private filterQuery: string = '';
  
  private sectionHeaders: Map<string, SectionHeader> = new Map();
  private variableItems: Map<string, VariableItem> = new Map();
  private nestedGroups: Map<string, NestedGroup> = new Map();

  constructor(
    container: HTMLElement,
    plugin: QuartoVariablesPlugin,
    variableCache: VariableCache,
    settings: PluginSettings
  ) {
    this.container = container;
    this.plugin = plugin;
    this.variableCache = variableCache;
    this.settings = settings;
  }

  async render(structure: ParsedYamlStructure, projectInfo: ProjectInfo | null): Promise<void> {
    this.currentStructure = structure;
    this.currentProjectInfo = projectInfo;
    
    // Clear existing content
    this.container.empty();
    this.clearComponents();
    
    if (structure.sections.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Render each section
    for (const section of structure.sections) {
      await this.renderSection(section);
    }
  }

  private async renderSection(section: YamlSection): Promise<void> {
    // Create section header
    const sectionHeader = new SectionHeader(section, this.settings);
    const headerElement = await sectionHeader.render();
    this.container.appendChild(headerElement);
    this.sectionHeaders.set(section.header, sectionHeader);

    // Create section content container
    const sectionContent = document.createElement('div');
    sectionContent.addClass('variables-section-content');
    this.container.appendChild(sectionContent);

    // Set up collapse functionality
    let isCollapsed = false;
    sectionHeader.onToggle((collapsed) => {
      isCollapsed = collapsed;
      sectionContent.toggleClass('variables-collapsed', collapsed);
    });

    // Render section nodes
    for (const node of section.nodes) {
      const nodeElement = await this.renderNode(node, sectionContent);
      if (nodeElement) {
        sectionContent.appendChild(nodeElement);
      }
    }
  }

  private async renderNode(node: YamlNode, container: HTMLElement, parentNestedGroup?: NestedGroup): Promise<HTMLElement | null> {
    const nodeId = this.getNodeId(node);
    
    // Handle nested objects/arrays
    if (node.type === 'object' && node.children && node.children.length > 0) {
      const nestedGroup = new NestedGroup(
        node,
        this.plugin,
        this.variableCache,
        this.settings,
        this.currentProjectInfo
      );
      const groupElement = await nestedGroup.render();
      this.nestedGroups.set(nodeId, nestedGroup);
      
      // Establish parent-child relationship
      if (parentNestedGroup) {
        parentNestedGroup.addChildNestedGroup(nestedGroup);
      }
      
      // Set up child node rendering
      nestedGroup.onChildrenRender(async (childContainer) => {
        for (const child of node.children || []) {
          const childElement = await this.renderNode(child, childContainer, nestedGroup);
          if (childElement) {
            childContainer.appendChild(childElement);
          }
        }
      });
      
      return groupElement;
    } else if (node.type === 'array') {
      // For arrays, we'll show them as a special variable item
      const variableItem = new VariableItem(
        node,
        this.plugin,
        this.variableCache,
        this.settings,
        this.currentProjectInfo
      );
      const itemElement = await variableItem.render();
      this.variableItems.set(nodeId, variableItem);
      return itemElement;
    } else {
      // Regular variable
      const variableItem = new VariableItem(
        node,
        this.plugin,
        this.variableCache,
        this.settings,
        this.currentProjectInfo
      );
      const itemElement = await variableItem.render();
      this.variableItems.set(nodeId, variableItem);
      return itemElement;
    }
  }

  public filter(query: string): void {
    this.filterQuery = query.toLowerCase();
    
    if (!this.currentStructure) return;
    
    // Show/hide sections and items based on filter
    for (const [sectionName, sectionHeader] of this.sectionHeaders) {
      let sectionMatches = false;
      let visibleItemsInSection = 0;
      
      // Check if section header matches
      if (sectionName.toLowerCase().includes(this.filterQuery)) {
        sectionMatches = true;
      }
      
      // Check items in section
      const section = this.currentStructure.sections.find(s => s.header === sectionName);
      if (section) {
        for (const node of section.nodes) {
          const nodeId = this.getNodeId(node);
          const matches = this.nodeMatchesFilter(node, this.filterQuery);
          
          // Show/hide variable items
          const variableItem = this.variableItems.get(nodeId);
          if (variableItem) {
            variableItem.setVisible(matches || sectionMatches);
            if (matches || sectionMatches) {
              visibleItemsInSection++;
            }
          }
          
          // Show/hide nested groups
          const nestedGroup = this.nestedGroups.get(nodeId);
          if (nestedGroup) {
            const childMatches = this.checkChildrenMatch(node, this.filterQuery);
            nestedGroup.setVisible((matches || sectionMatches) && childMatches > 0);
            if ((matches || sectionMatches) && childMatches > 0) {
              visibleItemsInSection++;
            }
          }
        }
      }
      
      // Show/hide section based on whether it or its items match
      sectionHeader.setVisible(sectionMatches || visibleItemsInSection > 0);
    }
    
    // If no filter, show everything
    if (!this.filterQuery) {
      this.showAll();
    }
  }

  private nodeMatchesFilter(node: YamlNode, filter: string): boolean {
    if (!filter) return true;
    
    // Check key name
    if (node.key.toLowerCase().includes(filter)) return true;
    
    // Check value
    if (node.value && String(node.value).toLowerCase().includes(filter)) return true;
    
    // Check comment
    if (node.comment && node.comment.toLowerCase().includes(filter)) return true;
    
    return false;
  }

  private checkChildrenMatch(node: YamlNode, filter: string): number {
    if (!node.children) return 0;
    
    let matchCount = 0;
    for (const child of node.children) {
      if (this.nodeMatchesFilter(child, filter)) {
        matchCount++;
      }
      matchCount += this.checkChildrenMatch(child, filter);
    }
    
    return matchCount;
  }

  private showAll(): void {
    // Show all sections
    for (const sectionHeader of this.sectionHeaders.values()) {
      sectionHeader.setVisible(true);
    }
    
    // Show all items
    for (const variableItem of this.variableItems.values()) {
      variableItem.setVisible(true);
    }
    
    // Show all nested groups
    for (const nestedGroup of this.nestedGroups.values()) {
      nestedGroup.setVisible(true);
    }
  }

  private renderEmptyState(): void {
    const emptyDiv = document.createElement('div');
    emptyDiv.addClass('variables-pane-message');
    
    const icon = emptyDiv.createDiv('variables-pane-icon');
    icon.setText('📝');
    
    const textDiv = emptyDiv.createDiv('variables-pane-text');
    const strong = textDiv.createEl('strong');
    strong.setText('Empty Variables File');
    const p = textDiv.createEl('p');
    p.setText('Add some variables to your _variables.yml file to see them here.');
    
    this.container.appendChild(emptyDiv);
  }

  private clearComponents(): void {
    this.sectionHeaders.clear();
    this.variableItems.clear();
    this.nestedGroups.clear();
  }

  private getNodeId(node: YamlNode): string {
    return `${node.key}-${node.lineStart}-${node.level}`;
  }

  public async updateNodeValue(nodeId: string, newValue: any): Promise<boolean> {
    // This will be implemented when we create the VariableWriter
    if (this.settings.debugMode) {
      console.log(`Updating node ${nodeId} to:`, newValue);
    }
    
    // For now, just update the UI
    const variableItem = this.variableItems.get(nodeId);
    if (variableItem) {
      await variableItem.updateValue(newValue);
      return true;
    }
    
    return false;
  }

  public destroy(): void {
    this.clearComponents();
    this.container.empty();
  }
}