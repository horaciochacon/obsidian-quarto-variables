import {
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  Decoration,
  EditorView,
  WidgetType
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { PlaceholderScanner } from './PlaceholderScanner';
import { VariableWidget } from './VariableWidget';
import { VariableCache } from './VariableCache';
import { ProjectResolver } from './ProjectResolver';
import { PluginSettings, ProjectInfo } from '@/types';
import { App, TFile } from 'obsidian';

export class PlaceholderRenderer {
  private scanner: PlaceholderScanner;
  private decorations: DecorationSet;
  private cacheVersion: number = 0;
  private currentProject: ProjectInfo | null = null;
  private debounceTimer: number | null = null;
  private scrollDebounceTimer: number | null = null;
  private app: App;
  private lastUpdate: {
    docChanged: boolean;
    viewportChanged: boolean;
    selectionSet: boolean;
  } = { docChanged: false, viewportChanged: false, selectionSet: false };

  constructor(
    private view: EditorView,
    private variableCache: VariableCache,
    private projectResolver: ProjectResolver,
    private settings: PluginSettings,
    app: App
  ) {
    this.app = app;
    this.scanner = new PlaceholderScanner();
    this.decorations = this.buildDecorations();
    
    // Listen for cache updates - Note: This is a custom event, may need adjustment in production
    // this.app.workspace.on('quarto-variables:cache-updated', () => {
    //   this.scheduleRebuild();
    // });
  }

  private buildDecorations(): DecorationSet {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'qmd') {
      return Decoration.none;
    }

    const builder = new RangeSetBuilder<Decoration>();
    const viewport = this.view.viewport;
    const matches = this.scanner.findAllInRange(this.view, viewport.from, viewport.to);
    
    const cursorPos = this.view.state.selection.main.head;
    
    for (const match of matches) {
      if (cursorPos >= match.from && cursorPos <= match.to) {
        continue;
      }
      
      if (!this.currentProject) {
        const widget = new VariableWidget(`{{<var ${match.key}>}}`, this.settings, false);
        builder.add(match.from, match.to, Decoration.replace({ widget }));
        continue;
      }
      
      const value = this.variableCache.get(this.currentProject, match.key);
      
      if (value !== undefined) {
        const widget = new VariableWidget(value, this.settings, true);
        builder.add(match.from, match.to, Decoration.replace({ widget }));
      } else if (this.settings.highlightUnresolvedVariables) {
        const widget = new VariableWidget(`{{<var ${match.key}>}}`, this.settings, false);
        builder.add(match.from, match.to, Decoration.replace({ widget }));
      }
    }
    
    return builder.finish();
  }

  async update(update: ViewUpdate): Promise<void> {
    const cacheChanged = this.cacheVersion !== this.variableCache.getCurrentVersion();
    
    this.lastUpdate.docChanged = this.lastUpdate.docChanged || update.docChanged;
    this.lastUpdate.viewportChanged = this.lastUpdate.viewportChanged || update.viewportChanged;
    this.lastUpdate.selectionSet = this.lastUpdate.selectionSet || update.selectionSet;
    
    if (update.docChanged || update.selectionSet || cacheChanged) {
      this.scheduleRebuild('immediate');
    } else if (update.viewportChanged) {
      if (this.currentProject && this.variableCache.getCachedEntry(this.currentProject)) {
        this.scheduleRebuild('immediate');
      } else {
        this.scheduleRebuild('scroll');
      }
    }
  }

  private scheduleRebuild(type: 'immediate' | 'scroll' = 'immediate'): void {
    if (type === 'scroll') {
      if (this.scrollDebounceTimer !== null) {
        window.clearTimeout(this.scrollDebounceTimer);
      }
      
      this.scrollDebounceTimer = window.setTimeout(() => {
        this.executeRebuild();
        this.scrollDebounceTimer = null;
      }, 100);
    } else {
      if (this.debounceTimer !== null) {
        window.clearTimeout(this.debounceTimer);
      }
      if (this.scrollDebounceTimer !== null) {
        window.clearTimeout(this.scrollDebounceTimer);
        this.scrollDebounceTimer = null;
      }
      
      if (this.currentProject && this.variableCache.getCachedEntry(this.currentProject)) {
        this.executeRebuild();
      } else {
        this.debounceTimer = window.setTimeout(() => {
          this.executeRebuild();
          this.debounceTimer = null;
        }, 16);
      }
    }
  }

  private executeRebuild(): void {
    if (this.lastUpdate.viewportChanged && !this.lastUpdate.docChanged) {
      this.scanner.clearCache();
    }
    
    this.rebuildDecorations();
    
    this.lastUpdate.docChanged = false;
    this.lastUpdate.viewportChanged = false;
    this.lastUpdate.selectionSet = false;
  }

  private async rebuildDecorations(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'qmd') {
      this.decorations = Decoration.none;
      return;
    }
    
    if (!this.currentProject) {
      this.currentProject = await this.projectResolver.getProjectRoot(file);
    }
    
    if (this.currentProject) {
      const cachedEntry = this.variableCache.getCachedEntry(this.currentProject);
      if (!cachedEntry) {
        this.loadVariablesInBackground(this.currentProject);
      }
    }
    
    this.cacheVersion = this.variableCache.getCurrentVersion();
    this.decorations = this.buildDecorations();
  }

  private async loadVariablesInBackground(projectInfo: ProjectInfo): Promise<void> {
    try {
      await this.variableCache.loadVariables(projectInfo);
      
      this.scheduleRebuild();
    } catch (error) {
      if (this.settings.debugMode) {
        console.error('Failed to load variables in background:', error);
      }
    }
  }

  async setFile(file: TFile): Promise<void> {
    if (file.extension === 'qmd') {
      this.scanner.clearCache();
      this.currentProject = await this.projectResolver.getProjectRoot(file);
      if (this.currentProject) {
        this.loadVariablesInBackground(this.currentProject);
      }
      this.scheduleRebuild('immediate');
    }
  }

  getDecorations(): DecorationSet {
    return this.decorations;
  }

  destroy(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    if (this.scrollDebounceTimer !== null) {
      window.clearTimeout(this.scrollDebounceTimer);
    }
  }
}

export function createPlaceholderRendererPlugin(
  variableCache: VariableCache,
  projectResolver: ProjectResolver,
  settings: PluginSettings,
  app: App
) {
  return ViewPlugin.fromClass(
    class {
      renderer: PlaceholderRenderer;
      
      constructor(view: EditorView) {
        this.renderer = new PlaceholderRenderer(
          view,
          variableCache,
          projectResolver,
          settings,
          app
        );
      }
      
      update(update: ViewUpdate) {
        this.renderer.update(update);
      }
      
      destroy() {
        this.renderer.destroy();
      }
    },
    {
      decorations: (instance) => instance.renderer.getDecorations()
    }
  );
}