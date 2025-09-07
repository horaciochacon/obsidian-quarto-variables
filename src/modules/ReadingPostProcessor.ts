import { MarkdownPostProcessorContext, TFile } from 'obsidian';
import { PlaceholderScanner } from './PlaceholderScanner';
import { VariableCache } from './VariableCache';
import { ProjectResolver } from './ProjectResolver';
import { PluginSettings } from '@/types';

export class ReadingPostProcessor {
  private scanner: PlaceholderScanner;

  constructor(
    private variableCache: VariableCache,
    private projectResolver: ProjectResolver,
    private settings: PluginSettings
  ) {
    this.scanner = new PlaceholderScanner();
  }

  async process(el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
    if (!this.settings.enableInReadingView) {
      return;
    }

    const file = ctx.sourcePath ? this.projectResolver.app.vault.getAbstractFileByPath(ctx.sourcePath) : null;
    if (!file || !(file instanceof TFile) || file.extension !== 'qmd') {
      return;
    }

    const projectInfo = await this.projectResolver.getProjectRoot(file);
    if (!projectInfo) {
      return;
    }

    await this.variableCache.loadVariables(projectInfo);
    
    this.processElement(el, projectInfo);
  }

  private processElement(el: HTMLElement, projectInfo: any): void {
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node: Node | null;
    
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent) {
        textNodes.push(node as Text);
      }
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const matches = this.scanner.findAll(text);
      
      if (matches.length === 0) {
        continue;
      }

      const parent = textNode.parentNode;
      if (!parent) {
        continue;
      }

      let lastIndex = 0;
      const fragments: (Text | HTMLSpanElement)[] = [];

      for (const match of matches) {
        if (match.from > lastIndex) {
          fragments.push(document.createTextNode(text.substring(lastIndex, match.from)));
        }

        const value = this.variableCache.get(projectInfo, match.key);
        
        if (value !== undefined) {
          const span = document.createElement('span');
          span.className = `${this.settings.placeholderClass} quarto-variable-resolved`;
          if (this.settings.placeholderColor) {
            span.style.setProperty('--placeholder-color', this.settings.placeholderColor);
          }
          span.textContent = value;
          fragments.push(span);
        } else if (this.settings.highlightUnresolvedVariables) {
          const span = document.createElement('span');
          span.className = `${this.settings.placeholderClass} quarto-variable-unresolved`;
          span.textContent = text.substring(match.from, match.to);
          fragments.push(span);
        } else {
          fragments.push(document.createTextNode(text.substring(match.from, match.to)));
        }

        lastIndex = match.to;
      }

      if (lastIndex < text.length) {
        fragments.push(document.createTextNode(text.substring(lastIndex)));
      }

      for (const fragment of fragments) {
        parent.insertBefore(fragment, textNode);
      }
      parent.removeChild(textNode);
    }
  }
}