import { App, TFile, EventRef, Notice } from 'obsidian';
import * as yaml from 'js-yaml';
import { CacheEntry, ProjectInfo } from '@/types';
import { VariableWriter, WriteResult } from './VariableWriter';
import { YamlStructureParser, ParsedYamlStructure } from './YamlStructureParser';

export class VariableCache {
  private cache: Map<string, CacheEntry> = new Map();
  private structureCache: Map<string, ParsedYamlStructure> = new Map();
  private version: number = 0;
  private fileWatcher: EventRef | null = null;
  private lastErrorNotified: Map<string, number> = new Map();
  private readonly ERROR_NOTIFICATION_COOLDOWN = 60000; // 1 minute
  private writer: VariableWriter;
  private parser: YamlStructureParser;

  constructor(private app: App) {
    this.writer = new VariableWriter(app);
    this.parser = new YamlStructureParser();
  }

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
      
      // Parse with structure preservation
      const structure = this.parser.parse(content);
      this.structureCache.set(projectInfo.root, structure);
      
      // Also do regular YAML parsing for backwards compatibility
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
          
          // Parse with structure preservation
          const structure = this.parser.parse(content);
          this.structureCache.set(root, structure);
          
          // Regular YAML parsing for backwards compatibility
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
    this.structureCache.clear();
    this.version++;
  }

  // New methods for bidirectional updates

  getStructure(projectInfo: ProjectInfo): ParsedYamlStructure | null {
    return this.structureCache.get(projectInfo.root) || null;
  }

  async updateVariable(projectInfo: ProjectInfo, variablePath: string, newValue: any): Promise<WriteResult> {
    const structure = this.structureCache.get(projectInfo.root);
    if (!structure) {
      return {
        success: false,
        error: 'No structure cached for project'
      };
    }

    const result = await this.writer.updateVariable(projectInfo, structure, variablePath, newValue);
    
    if (result.success) {
      // Clear cache to force reload on next access
      this.cache.delete(projectInfo.root);
      this.structureCache.delete(projectInfo.root);
      
      // Reload to get fresh data
      await this.loadVariables(projectInfo);
    }

    return result;
  }

  async addVariable(projectInfo: ProjectInfo, sectionName: string, key: string, value: any): Promise<WriteResult> {
    const structure = this.structureCache.get(projectInfo.root);
    if (!structure) {
      return {
        success: false,
        error: 'No structure cached for project'
      };
    }

    const result = await this.writer.addVariable(projectInfo, structure, sectionName, key, value);
    
    if (result.success) {
      // Clear cache to force reload
      this.cache.delete(projectInfo.root);
      this.structureCache.delete(projectInfo.root);
      
      // Reload fresh data
      await this.loadVariables(projectInfo);
    }

    return result;
  }

  async createVariablesFile(projectInfo: ProjectInfo, initialContent?: Record<string, any>): Promise<WriteResult> {
    const result = await this.writer.createVariablesFile(projectInfo, initialContent);
    
    if (result.success) {
      // Load the new file
      await this.loadVariables(projectInfo);
    }

    return result;
  }

  // Helper method to get variable path for a node
  getVariablePath(projectInfo: ProjectInfo, nodeKey: string, parentPath?: string): string {
    if (parentPath) {
      return `${parentPath}.${nodeKey}`;
    }
    return nodeKey;
  }

  // Method to check if a variable exists
  hasVariable(projectInfo: ProjectInfo, variablePath: string): boolean {
    const entry = this.cache.get(projectInfo.root);
    if (!entry) return false;

    const pathParts = variablePath.split('.');
    let current = entry.data;

    for (const part of pathParts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return false;
      }
      current = current[part];
    }

    return current !== undefined;
  }

  destroy(): void {
    if (this.fileWatcher) {
      this.app.vault.offref(this.fileWatcher);
      this.fileWatcher = null;
    }
    this.cache.clear();
    this.structureCache.clear();
  }
}