import { Plugin, TFile, MarkdownView } from 'obsidian';
import { ProjectResolver } from './modules/ProjectResolver';
import { VariableCache } from './modules/VariableCache';
import { createPlaceholderRendererPlugin } from './modules/PlaceholderRenderer';
import { ReadingPostProcessor } from './modules/ReadingPostProcessor';
import { QuartoVariablesSettingTab } from './settings/SettingsTab';
import { PluginSettings, DEFAULT_SETTINGS, ProjectInfo } from './types';

export default class QuartoVariablesPlugin extends Plugin {
  settings!: PluginSettings;
  private projectResolver!: ProjectResolver;
  private variableCache!: VariableCache;
  private readingPostProcessor!: ReadingPostProcessor;

  async onload() {
    console.log('Loading Quarto Variables plugin');
    
    await this.loadSettings();
    
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
    
    this.addCommand({
      id: 'refresh-variables',
      name: 'Refresh Quarto Variables',
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

  onunload() {
    console.log('Unloading Quarto Variables plugin');
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