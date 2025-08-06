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
  private app: App;

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
    const shouldRebuild = 
      update.docChanged || 
      update.viewportChanged || 
      update.selectionSet ||
      this.cacheVersion !== this.variableCache.getCurrentVersion();
    
    if (shouldRebuild) {
      this.scheduleRebuild();
    }
  }

  private scheduleRebuild(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    
    this.debounceTimer = window.setTimeout(() => {
      this.rebuildDecorations();
      this.debounceTimer = null;
    }, 16);
  }

  private async rebuildDecorations(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'qmd') {
      this.decorations = Decoration.none;
      return;
    }
    
    if (!this.currentProject) {
      this.currentProject = await this.projectResolver.getProjectRoot(file);
      if (this.currentProject) {
        await this.variableCache.loadVariables(this.currentProject);
      }
    }
    
    this.cacheVersion = this.variableCache.getCurrentVersion();
    this.decorations = this.buildDecorations();
  }

  async setFile(file: TFile): Promise<void> {
    if (file.extension === 'qmd') {
      this.currentProject = await this.projectResolver.getProjectRoot(file);
      if (this.currentProject) {
        await this.variableCache.loadVariables(this.currentProject);
      }
      this.scheduleRebuild();
    }
  }

  getDecorations(): DecorationSet {
    return this.decorations;
  }

  destroy(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
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