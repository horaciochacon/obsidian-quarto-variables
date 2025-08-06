import { App, TFile, EventRef, Notice } from 'obsidian';
import * as yaml from 'js-yaml';
import { CacheEntry, ProjectInfo } from '@/types';

export class VariableCache {
  private cache: Map<string, CacheEntry> = new Map();
  private version: number = 0;
  private fileWatcher: EventRef | null = null;
  private lastErrorNotified: Map<string, number> = new Map();
  private readonly ERROR_NOTIFICATION_COOLDOWN = 60000; // 1 minute

  constructor(private app: App) {}

  async initialize(): Promise<void> {
    this.fileWatcher = this.app.vault.on('modify', async (file) => {
      if (file instanceof TFile && file.name === '_variables.yml') {
        await this.reloadForFile(file);
      }
    });
  }

  async loadVariables(projectInfo: ProjectInfo): Promise<CacheEntry | null> {
    const cached = this.cache.get(projectInfo.root);
    if (cached) {
      return cached;
    }

    try {
      const file = this.app.vault.getAbstractFileByPath(projectInfo.variablesPath);
      if (!(file instanceof TFile)) {
        this.notifyError(projectInfo.root, `Variables file not found: ${projectInfo.variablesPath}`);
        return null;
      }

      const content = await this.app.vault.read(file);
      const data = yaml.load(content, { 
        schema: yaml.FAILSAFE_SCHEMA,
        json: true
      }) as Record<string, any>;

      const entry: CacheEntry = {
        data: data || {},
        version: ++this.version,
        lastModified: file.stat.mtime
      };

      this.cache.set(projectInfo.root, entry);
      return entry;
    } catch (error) {
      console.error('Failed to load variables:', error);
      this.notifyError(projectInfo.root, `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  get(projectInfo: ProjectInfo, key: string): string | undefined {
    const entry = this.cache.get(projectInfo.root);
    if (!entry) {
      return undefined;
    }

    return this.getNestedValue(entry.data, key);
  }

  getCachedEntry(projectInfo: ProjectInfo): CacheEntry | null {
    return this.cache.get(projectInfo.root) || null;
  }

  private getNestedValue(obj: any, path: string): string | undefined {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }

    if (current === null || current === undefined) {
      return undefined;
    }

    return String(current);
  }

  private async reloadForFile(file: TFile): Promise<void> {
    for (const [root, entry] of this.cache.entries()) {
      const projectVariablesPath = root ? `${root}/_variables.yml` : '_variables.yml';
      if (file.path === projectVariablesPath) {
        try {
          const content = await this.app.vault.read(file);
          const data = yaml.load(content, { 
            schema: yaml.FAILSAFE_SCHEMA,
            json: true
          }) as Record<string, any>;

          this.cache.set(root, {
            data: data || {},
            version: ++this.version,
            lastModified: file.stat.mtime
          });

          // Trigger custom event for cache updates
          // this.app.workspace.trigger('quarto-variables:cache-updated', root);
        } catch (error) {
          console.error('Failed to reload variables:', error);
          this.notifyError(root, `Failed to reload variables: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  private notifyError(projectRoot: string, message: string): void {
    const lastNotified = this.lastErrorNotified.get(projectRoot) || 0;
    const now = Date.now();
    
    if (now - lastNotified > this.ERROR_NOTIFICATION_COOLDOWN) {
      new Notice(message, 5000);
      this.lastErrorNotified.set(projectRoot, now);
    }
  }

  getCurrentVersion(): number {
    return this.version;
  }

  clearCache(): void {
    this.cache.clear();
    this.version++;
  }

  destroy(): void {
    if (this.fileWatcher) {
      this.app.vault.offref(this.fileWatcher);
      this.fileWatcher = null;
    }
    this.cache.clear();
  }
}