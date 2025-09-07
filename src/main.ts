import { Plugin, TFile, MarkdownView, WorkspaceLeaf } from 'obsidian';
import { ProjectResolver } from './modules/ProjectResolver';
import { VariableCache } from './modules/VariableCache';
import { createPlaceholderRendererPlugin } from './modules/PlaceholderRenderer';
import { ReadingPostProcessor } from './modules/ReadingPostProcessor';
import { QuartoVariablesSettingTab } from './settings/SettingsTab';
import { VariablesView, VARIABLES_VIEW_TYPE } from './views/VariablesView';
import { PluginSettings, DEFAULT_SETTINGS, ProjectInfo } from './types';

export default class QuartoVariablesPlugin extends Plugin {
  settings!: PluginSettings;
  private projectResolver!: ProjectResolver;
  private variableCache!: VariableCache;
  private readingPostProcessor!: ReadingPostProcessor;

  async onload() {
    await this.loadSettings();
    
    if (this.settings.debugMode) {
      console.log('Loading Quarto Variables plugin');
    }
    
    this.projectResolver = new ProjectResolver(this.app);
    this.variableCache = new VariableCache(this.app);
    await this.variableCache.initialize();
    
    this.readingPostProcessor = new ReadingPostProcessor(
      this.variableCache,
      this.projectResolver,
      this.settings
    );
    
    this.registerEditorExtension(
      createPlaceholderRendererPlugin(
        this.variableCache,
        this.projectResolver,
        this.settings,
        this.app
      )
    );
    
    this.registerMarkdownPostProcessor((el, ctx) => {
      this.readingPostProcessor.process(el, ctx);
    });
    
    this.registerEvent(
      this.app.workspace.on('file-open', async (file: TFile | null) => {
        if (file && file.extension === 'qmd') {
          await this.handleFileOpen(file);
        }
      })
    );
    
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile) {
          if (file.name === '_variables.yml' || file.name === '_quarto.yml') {
            this.projectResolver.clearCache();
            this.variableCache.clearCache();
          }
        }
      })
    );
    
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile) {
          if (file.name === '_variables.yml' || file.name === '_quarto.yml') {
            this.projectResolver.clearCache();
            this.variableCache.clearCache();
          }
        }
      })
    );
    
    this.addSettingTab(new QuartoVariablesSettingTab(this.app, this));
    
    // Register the Variables View
    this.registerView(
      VARIABLES_VIEW_TYPE,
      (leaf) => new VariablesView(leaf, this, this.projectResolver, this.variableCache, this.settings)
    );
    
    // Add command to open Variables pane
    this.addCommand({
      id: 'open-variables-pane',
      name: 'Open Variables Pane',
      callback: () => {
        if (this.settings.enableVariablesPane) {
          this.activateVariablesView();
        }
      }
    });
    
    this.addCommand({
      id: 'refresh-variables',
      name: 'Refresh Variables',
      callback: () => {
        this.projectResolver.clearCache();
        this.variableCache.clearCache();
        this.refreshEditors();
      }
    });
    
    this.addCommand({
      id: 'toggle-highlight-unresolved',
      name: 'Toggle Highlight Unresolved Variables',
      callback: async () => {
        this.settings.highlightUnresolvedVariables = !this.settings.highlightUnresolvedVariables;
        await this.saveSettings();
        this.refreshEditors();
      }
    });
    
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile && activeFile.extension === 'qmd') {
      await this.handleFileOpen(activeFile);
    }
  }

  async handleFileOpen(file: TFile) {
    if (this.settings.debugMode) {
      console.log('Opening QMD file:', file.path);
    }
    
    const projectInfo = await this.projectResolver.getProjectRoot(file);
    if (projectInfo) {
      this.preloadVariablesInBackground(projectInfo);
      
      // Auto-open variables pane if enabled
      if (this.settings.enableVariablesPane && this.settings.autoOpenVariablesPane) {
        await this.activateVariablesView();
      }
      
      if (this.settings.debugMode) {
        console.log('Project root:', projectInfo.root);
        console.log('Variables path:', projectInfo.variablesPath);
      }
    } else if (this.settings.debugMode) {
      console.log('No Quarto project found for file:', file.path);
    }
  }

  private async preloadVariablesInBackground(projectInfo: ProjectInfo): Promise<void> {
    try {
      await this.variableCache.loadVariables(projectInfo);
      
      if (this.settings.debugMode) {
        console.log('Variables preloaded for project:', projectInfo.root);
      }
    } catch (error) {
      if (this.settings.debugMode) {
        console.error('Failed to preload variables:', error);
      }
    }
  }

  refreshEditors() {
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const file = leaf.view.file;
        if (file && file.extension === 'qmd') {
          leaf.view.editor.refresh();
        }
      }
    });
  }

  async activateVariablesView(): Promise<void> {
    if (!this.settings.enableVariablesPane) {
      return;
    }

    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VARIABLES_VIEW_TYPE);

    if (leaves.length > 0) {
      // Variables pane already exists, just reveal it
      leaf = leaves[0];
    } else {
      // Create new Variables pane in the right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: VARIABLES_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  onunload() {
    if (this.settings?.debugMode) {
      console.log('Unloading Quarto Variables plugin');
    }
    
    this.variableCache.destroy();
    this.projectResolver.clearCache();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}