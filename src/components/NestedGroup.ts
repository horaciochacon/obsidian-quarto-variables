import { ProjectInfo, PluginSettings } from '@/types';
import { YamlNode } from '../modules/YamlStructureParser';
import { VariableCache } from '../modules/VariableCache';
import QuartoVariablesPlugin from '../main';

export class NestedGroup {
  private node: YamlNode;
  private plugin: QuartoVariablesPlugin;
  private variableCache: VariableCache;
  private settings: PluginSettings;
  private projectInfo: ProjectInfo | null;
  private element: HTMLElement | null = null;
  private isCollapsed: boolean = false;
  private childrenContainer: HTMLElement | null = null;
  private childrenRenderCallbacks: Array<(container: HTMLElement) => void> = [];
  private childNestedGroups: Set<NestedGroup> = new Set();

  constructor(
    node: YamlNode,
    plugin: QuartoVariablesPlugin,
    variableCache: VariableCache,
    settings: PluginSettings,
    projectInfo: ProjectInfo | null
  ) {
    this.node = node;
    this.plugin = plugin;
    this.variableCache = variableCache;
    this.settings = settings;
    this.projectInfo = projectInfo;
  }

  async render(): Promise<HTMLElement> {
    this.element = document.createElement('div');
    this.element.addClass('nested-group');
    this.element.setAttribute('data-key', this.node.key);
    this.element.setAttribute('data-type', this.node.type);

    // Add indentation based on level
    if (this.node.level > 0) {
      const levelClass = `variables-level-${Math.min(this.node.level, 10)}`;
      this.element.classList.add(levelClass);
    }

    // Create header
    const headerElement = document.createElement('div');
    headerElement.addClass('nested-group-header');

    // Add collapse/expand toggle
    const toggleButton = document.createElement('button');
    toggleButton.addClass('nested-group-toggle');
    toggleButton.setAttribute('aria-label', 'Toggle group');
    toggleButton.setText(this.getToggleIcon());
    toggleButton.addEventListener('click', () => this.toggle());
    headerElement.appendChild(toggleButton);

    // Add key name
    const keyElement = document.createElement('span');
    keyElement.addClass('nested-group-key');
    keyElement.textContent = this.node.key;
    headerElement.appendChild(keyElement);

    // Add type indicator and summary
    const typeElement = document.createElement('span');
    typeElement.addClass('nested-group-type');
    typeElement.textContent = this.getTypeSummary();
    headerElement.appendChild(typeElement);

    // Add comment if present
    if (this.node.comment) {
      const commentElement = document.createElement('span');
      commentElement.addClass('nested-group-comment');
      commentElement.textContent = `# ${this.node.comment}`;
      headerElement.appendChild(commentElement);
    }

    this.element.appendChild(headerElement);

    // Create children container
    this.childrenContainer = document.createElement('div');
    this.childrenContainer.addClass('nested-group-children');
    this.element.appendChild(this.childrenContainer);

    // Trigger children rendering
    this.childrenRenderCallbacks.forEach(callback => {
      if (this.childrenContainer) {
        callback(this.childrenContainer);
      }
    });

    // Add keyboard support
    headerElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });

    headerElement.setAttribute('tabindex', '0');
    headerElement.setAttribute('role', 'button');
    headerElement.setAttribute('aria-expanded', String(!this.isCollapsed));

    // Add hover effects
    headerElement.addEventListener('mouseenter', () => {
      headerElement.addClass('nested-group-header-hover');
    });

    headerElement.addEventListener('mouseleave', () => {
      headerElement.removeClass('nested-group-header-hover');
    });

    // Initialize in expanded state for better UX
    this.setCollapsed(false);

    return this.element;
  }

  private getToggleIcon(): string {
    return this.isCollapsed ? '▶' : '▼';
  }

  private getTypeSummary(): string {
    if (this.node.type === 'object') {
      const childCount = this.node.children?.length || 0;
      return `{${childCount} ${childCount === 1 ? 'property' : 'properties'}}`;
    } else if (this.node.type === 'array') {
      const length = Array.isArray(this.node.value) ? this.node.value.length : 0;
      return `[${length} ${length === 1 ? 'item' : 'items'}]`;
    }
    return `{${this.node.type}}`;
  }

  private toggle(): void {
    this.setCollapsed(!this.isCollapsed);
  }

  // Methods to manage child nested groups
  public addChildNestedGroup(childGroup: NestedGroup): void {
    this.childNestedGroups.add(childGroup);
  }

  public removeChildNestedGroup(childGroup: NestedGroup): void {
    this.childNestedGroups.delete(childGroup);
  }

  public setCollapsed(collapsed: boolean): void {
    if (this.isCollapsed === collapsed) return;
    
    this.isCollapsed = collapsed;
    
    if (this.element) {
      const toggleButton = this.element.querySelector('.nested-group-toggle');
      const headerElement = this.element.querySelector('.nested-group-header');
      
      if (toggleButton) {
        toggleButton.setText(this.getToggleIcon());
      }
      
      if (headerElement) {
        headerElement.setAttribute('aria-expanded', String(!this.isCollapsed));
      }
      
      if (this.childrenContainer) {
        this.childrenContainer.toggleClass('variables-collapsed', collapsed);
      }
      
      this.element.setAttribute('data-collapsed', String(this.isCollapsed));
    }

    // Recursively collapse/expand child nested groups
    if (collapsed) {
      // When collapsing, hide all child nested groups
      for (const childGroup of this.childNestedGroups) {
        childGroup.setVisible(false);
      }
    } else {
      // When expanding, show child nested groups but respect their own collapse state
      for (const childGroup of this.childNestedGroups) {
        childGroup.setVisible(true);
      }
    }
  }

  public isCurrentlyCollapsed(): boolean {
    return this.isCollapsed;
  }

  public setVisible(visible: boolean): void {
    if (this.element) {
      this.element.toggleClass('variables-hidden', !visible);
    }
  }

  public onChildrenRender(callback: (container: HTMLElement) => void): void {
    this.childrenRenderCallbacks.push(callback);
    
    // If container already exists, call immediately
    if (this.childrenContainer) {
      callback(this.childrenContainer);
    }
  }

  public getKey(): string {
    return this.node.key;
  }

  public getNode(): YamlNode {
    return this.node;
  }

  public getChildrenContainer(): HTMLElement | null {
    return this.childrenContainer;
  }

  // Helper method to add child elements directly
  public addChildElement(childElement: HTMLElement): void {
    if (this.childrenContainer) {
      this.childrenContainer.appendChild(childElement);
    }
  }

  // Helper method to clear children
  public clearChildren(): void {
    if (this.childrenContainer) {
      this.childrenContainer.empty();
    }
  }

  // Helper method to update the summary when children change
  public updateSummary(): void {
    if (this.element) {
      const typeElement = this.element.querySelector('.nested-group-type');
      if (typeElement) {
        typeElement.textContent = this.getTypeSummary();
      }
    }
  }

  // Check if this group matches a search filter
  public matchesFilter(filter: string): boolean {
    if (!filter) return true;
    
    const lowerFilter = filter.toLowerCase();
    
    // Check key name
    if (this.node.key.toLowerCase().includes(lowerFilter)) return true;
    
    // Check comment
    if (this.node.comment && this.node.comment.toLowerCase().includes(lowerFilter)) return true;
    
    // Check if any children match (this would need to be called by parent)
    return false;
  }

  // Check if any nested children match the filter
  public hasMatchingChildren(filter: string): boolean {
    if (!this.node.children || !filter) return false;
    
    const lowerFilter = filter.toLowerCase();
    
    const checkNode = (node: YamlNode): boolean => {
      // Check current node
      if (node.key.toLowerCase().includes(lowerFilter)) return true;
      if (node.comment && node.comment.toLowerCase().includes(lowerFilter)) return true;
      if (node.value && String(node.value).toLowerCase().includes(lowerFilter)) return true;
      
      // Check children recursively
      if (node.children) {
        return node.children.some(child => checkNode(child));
      }
      
      return false;
    };
    
    return this.node.children.some(child => checkNode(child));
  }

  public destroy(): void {
    this.childrenRenderCallbacks = [];
    this.childNestedGroups.clear();
    
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    this.childrenContainer = null;
  }
}