import { ItemView, WorkspaceLeaf, TFile, EventRef } from 'obsidian';
import { ProjectResolver } from '../modules/ProjectResolver';
import { VariableCache } from '../modules/VariableCache';
import { YamlStructureParser, ParsedYamlStructure } from '../modules/YamlStructureParser';
import { YamlRenderer } from '../components/YamlRenderer';
import { PluginSettings, ProjectInfo } from '@/types';
import QuartoVariablesPlugin from '../main';

export const VARIABLES_VIEW_TYPE = 'variables-pane';

export class VariablesView extends ItemView {
  private plugin: QuartoVariablesPlugin;
  private projectResolver: ProjectResolver;
  private variableCache: VariableCache;
  private yamlParser: YamlStructureParser;
  private yamlRenderer: YamlRenderer | null = null;
  private settings: PluginSettings;
  
  private currentProjectInfo: ProjectInfo | null = null;
  private currentYamlStructure: ParsedYamlStructure | null = null;
  private fileWatcher: EventRef | null = null;
  
  constructor(
    leaf: WorkspaceLeaf,
    plugin: QuartoVariablesPlugin,
    projectResolver: ProjectResolver,
    variableCache: VariableCache,
    settings: PluginSettings
  ) {
    super(leaf);
    this.plugin = plugin;
    this.projectResolver = projectResolver;
    this.variableCache = variableCache;
    this.settings = settings;
    this.yamlParser = new YamlStructureParser();
  }

  getViewType(): string {
    return VARIABLES_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Quarto Variables';
  }

  getIcon(): string {
    return 'settings';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('variables-pane-container');

    // Create header
    const header = container.createDiv('variables-pane-header');
    const title = header.createEl('h3', { text: 'Variables' });
    title.addClass('variables-pane-title');
    
    const refreshButton = header.createEl('button', { text: '↻' });
    refreshButton.addClass('variables-pane-refresh');
    refreshButton.setAttribute('aria-label', 'Refresh variables');
    refreshButton.addEventListener('click', () => this.refreshVariables());

    // Create search/filter input
    const searchContainer = container.createDiv('variables-pane-search');
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Search variables...',
    });
    searchInput.addClass('variables-pane-search-input');
    searchInput.addEventListener('input', (e) => this.handleSearch((e.target as HTMLInputElement).value));

    // Create content area
    const content = container.createDiv('variables-pane-content');
    
    // Initialize renderer
    this.yamlRenderer = new YamlRenderer(
      content,
      this.plugin,
      this.variableCache,
      this.settings
    );

    // Set up event listeners
    this.setupEventListeners();
    
    // Set up keyboard navigation
    this.setupKeyboardNavigation();
    
    // Load current file if applicable
    await this.loadCurrentFile();
  }

  async onClose(): Promise<void> {
    this.cleanupEventListeners();
  }

  private setupEventListeners(): void {
    // Watch for active file changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', async () => {
        await this.loadCurrentFile();
      })
    );

    // Watch for file opens
    this.registerEvent(
      this.app.workspace.on('file-open', async (file: TFile | null) => {
        if (file && file.extension === 'qmd') {
          await this.loadCurrentFile();
        }
      })
    );

    // Watch for _variables.yml changes
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile && file.name === '_variables.yml' && this.currentProjectInfo) {
          if (file.path === this.currentProjectInfo.variablesPath) {
            await this.reloadVariables();
          }
        }
      })
    );

    // Watch for _variables.yml file creation/deletion
    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (file instanceof TFile && file.name === '_variables.yml') {
          await this.loadCurrentFile();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        if (file instanceof TFile && file.name === '_variables.yml') {
          await this.loadCurrentFile();
        }
      })
    );
  }

  private setupKeyboardNavigation(): void {
    const container = this.containerEl.children[1];
    
    // Make the container focusable for keyboard navigation
    container.setAttribute('tabindex', '0');
    
    container.addEventListener('keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.ctrlKey || keyEvent.metaKey) {
        switch (keyEvent.key) {
          case 'f':
            // Focus search input
            e.preventDefault();
            const searchInput = container.querySelector('.variables-pane-search-input') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
            break;
            
          case 'r':
            // Refresh variables
            e.preventDefault();
            this.refreshVariables();
            break;
            
          case 'n':
            // Create new variable (placeholder for future enhancement)
            e.preventDefault();
            console.log('Create new variable shortcut pressed');
            break;
        }
      } else {
        switch (keyEvent.key) {
          case '/':
            // Quick search
            e.preventDefault();
            const searchInput = container.querySelector('.variables-pane-search-input') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
            break;
            
          case 'Escape':
            // Clear search or close editors
            e.preventDefault();
            const searchField = container.querySelector('.variables-pane-search-input') as HTMLInputElement;
            if (searchField && searchField.value) {
              searchField.value = '';
              this.handleSearch('');
            }
            break;
            
          case 'ArrowUp':
          case 'ArrowDown':
            // Navigate between variable items
            this.navigateVariableItems(keyEvent.key === 'ArrowDown');
            e.preventDefault();
            break;
        }
      }
    });

    // Add focus styles
    container.addEventListener('focus', () => {
      container.addClass('variables-pane-focused');
    });
    
    container.addEventListener('blur', () => {
      container.removeClass('variables-pane-focused');
    });
  }

  private navigateVariableItems(down: boolean): void {
    const container = this.containerEl.children[1];
    const items = container.querySelectorAll('.variable-item, .nested-group-header');
    const currentFocused = container.querySelector('.variable-item-focused, .nested-group-focused') as HTMLElement;
    
    if (items.length === 0) return;
    
    let currentIndex = currentFocused ? Array.from(items).indexOf(currentFocused) : -1;
    let nextIndex;
    
    if (down) {
      nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    }
    
    // Remove focus from current item
    if (currentFocused) {
      currentFocused.removeClass('variable-item-focused');
      currentFocused.removeClass('nested-group-focused');
    }
    
    // Add focus to next item
    const nextItem = items[nextIndex] as HTMLElement;
    if (nextItem) {
      if (nextItem.classList.contains('variable-item')) {
        nextItem.addClass('variable-item-focused');
      } else if (nextItem.classList.contains('nested-group-header')) {
        nextItem.addClass('nested-group-focused');
      }
      
      // Scroll item into view
      nextItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Allow Enter to edit focused variable
      const onEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          const valueElement = nextItem.querySelector('.variable-value') as HTMLElement;
          if (valueElement) {
            valueElement.click();
          }
          nextItem.removeEventListener('keydown', onEnter);
        }
      };
      
      nextItem.addEventListener('keydown', onEnter);
    }
  }

  private cleanupEventListeners(): void {
    if (this.fileWatcher) {
      this.app.vault.offref(this.fileWatcher);
      this.fileWatcher = null;
    }
  }

  private async loadCurrentFile(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    
    if (!activeFile || activeFile.extension !== 'qmd') {
      await this.showNoQmdFile();
      return;
    }

    try {
      const projectInfo = await this.projectResolver.getProjectRoot(activeFile);
      
      if (!projectInfo) {
        await this.showNoProject();
        return;
      }

      if (this.currentProjectInfo?.root !== projectInfo.root) {
        this.currentProjectInfo = projectInfo;
        await this.loadVariables();
      }
      
    } catch (error) {
      console.error('Error loading current file:', error);
      await this.showError('Failed to load project information');
    }
  }

  private async loadVariables(): Promise<void> {
    if (!this.currentProjectInfo) return;

    try {
      // Check if _variables.yml exists
      const variablesFile = this.app.vault.getAbstractFileByPath(this.currentProjectInfo.variablesPath);
      
      if (!(variablesFile instanceof TFile)) {
        await this.showNoVariablesFile();
        return;
      }

      // Load variables through cache (which now includes structure parsing)
      await this.variableCache.loadVariables(this.currentProjectInfo);
      
      // Get the parsed structure from cache
      this.currentYamlStructure = this.variableCache.getStructure(this.currentProjectInfo);
      
      if (!this.currentYamlStructure) {
        await this.showError('Failed to parse YAML structure');
        return;
      }
      
      // Render the structure
      await this.renderVariables();
      
    } catch (error) {
      console.error('Error loading variables:', error);
      await this.showError(`Failed to load variables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async reloadVariables(): Promise<void> {
    if (this.currentProjectInfo) {
      // Clear cache to force reload
      this.variableCache.clearCache();
      await this.loadVariables();
    }
  }

  private async refreshVariables(): Promise<void> {
    await this.reloadVariables();
  }

  private async renderVariables(): Promise<void> {
    if (!this.currentYamlStructure || !this.yamlRenderer) return;

    try {
      await this.yamlRenderer.render(this.currentYamlStructure, this.currentProjectInfo);
    } catch (error) {
      console.error('Error rendering variables:', error);
      await this.showError('Failed to render variables');
    }
  }

  private handleSearch(query: string): void {
    if (!this.yamlRenderer) return;
    
    this.yamlRenderer.filter(query);
  }

  private async showNoQmdFile(): Promise<void> {
    this.currentProjectInfo = null;
    this.currentYamlStructure = null;
    
    const content = this.containerEl.querySelector('.variables-pane-content');
    if (content) {
      content.empty();
      const message = content.createDiv('variables-pane-message');
      message.innerHTML = `
        <div class="variables-pane-icon">📄</div>
        <div class="variables-pane-text">
          <strong>No Quarto Document</strong>
          <p>Open a .qmd file to view its variables</p>
        </div>
      `;
    }
  }

  private async showNoProject(): Promise<void> {
    this.currentProjectInfo = null;
    this.currentYamlStructure = null;
    
    const content = this.containerEl.querySelector('.variables-pane-content');
    if (content) {
      content.empty();
      const message = content.createDiv('variables-pane-message');
      message.innerHTML = `
        <div class="variables-pane-icon">📁</div>
        <div class="variables-pane-text">
          <strong>No Quarto Project</strong>
          <p>This file is not part of a Quarto project. Create a <code>_quarto.yml</code> file to define a project.</p>
        </div>
      `;
    }
  }

  private async showNoVariablesFile(): Promise<void> {
    this.currentYamlStructure = null;
    
    const content = this.containerEl.querySelector('.variables-pane-content');
    if (content) {
      content.empty();
      const message = content.createDiv('variables-pane-message');
      message.innerHTML = `
        <div class="variables-pane-icon">📝</div>
        <div class="variables-pane-text">
          <strong>No Variables File</strong>
          <p>Create a <code>_variables.yml</code> file in your project to define variables.</p>
          <button class="variables-pane-create-btn">Create _variables.yml</button>
        </div>
      `;
      
      const createBtn = content.querySelector('.variables-pane-create-btn') as HTMLButtonElement;
      createBtn?.addEventListener('click', () => this.createVariablesFile());
    }
  }

  private async showError(message: string): Promise<void> {
    const content = this.containerEl.querySelector('.variables-pane-content');
    if (content) {
      content.empty();
      const errorDiv = content.createDiv('variables-pane-message variables-pane-error');
      errorDiv.innerHTML = `
        <div class="variables-pane-icon">⚠️</div>
        <div class="variables-pane-text">
          <strong>Error</strong>
          <p>${message}</p>
        </div>
      `;
    }
  }

  private async createVariablesFile(): Promise<void> {
    if (!this.currentProjectInfo) return;
    
    try {
      const templateContent = `# Project Configuration
author: "Your Name"
title: "Project Title"
date: "2024"

# Project Settings
project:
  name: "My Project"
  version: "1.0.0"

# Custom Variables
# Add your custom variables below
`;
      
      await this.app.vault.create(this.currentProjectInfo.variablesPath, templateContent);
      await this.loadVariables();
      
    } catch (error) {
      console.error('Error creating variables file:', error);
      await this.showError('Failed to create _variables.yml file');
    }
  }

  // Public methods for external access
  public getCurrentProjectInfo(): ProjectInfo | null {
    return this.currentProjectInfo;
  }

  public getCurrentStructure(): ParsedYamlStructure | null {
    return this.currentYamlStructure;
  }

  public async updateVariable(path: string, newValue: any): Promise<boolean> {
    if (!this.currentProjectInfo) return false;
    
    try {
      const result = await this.variableCache.updateVariable(this.currentProjectInfo, path, newValue);
      
      if (result.success) {
        // Refresh the view with the updated data
        this.currentYamlStructure = this.variableCache.getStructure(this.currentProjectInfo);
        if (this.currentYamlStructure && this.yamlRenderer) {
          await this.yamlRenderer.render(this.currentYamlStructure, this.currentProjectInfo);
        }
        return true;
      } else {
        console.error('Failed to update variable:', result.error);
        await this.showError(`Failed to update variable: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('Error updating variable:', error);
      await this.showError(`Error updating variable: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}