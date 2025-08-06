import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { ProjectInfo } from '@/types';

export class ProjectResolver {
  private cache: Map<string, ProjectInfo | null> = new Map();
  public app: App;
  
  constructor(app: App) {
    this.app = app;
  }

  async getProjectRoot(file: TFile): Promise<ProjectInfo | null> {
    const cached = this.cache.get(file.path);
    if (cached !== undefined) {
      return cached;
    }

    const projectInfo = await this.findProjectRoot(file);
    this.cache.set(file.path, projectInfo);
    return projectInfo;
  }

  private async findProjectRoot(file: TFile): Promise<ProjectInfo | null> {
    let currentPath = file.parent?.path || '';
    
    while (currentPath !== '' && currentPath !== '/') {
      const quartoConfigPath = normalizePath(`${currentPath}/_quarto.yml`);
      const quartoConfigFile = this.app.vault.getAbstractFileByPath(quartoConfigPath);
      
      if (quartoConfigFile && quartoConfigFile instanceof TFile) {
        const variablesPath = normalizePath(`${currentPath}/_variables.yml`);
        const variablesFile = this.app.vault.getAbstractFileByPath(variablesPath);
        
        if (variablesFile && variablesFile instanceof TFile) {
          return {
            root: currentPath,
            variablesPath,
            quartoConfigPath
          };
        }
        
        return {
          root: currentPath,
          variablesPath,
          quartoConfigPath
        };
      }
      
      const parentFolder = this.app.vault.getAbstractFileByPath(currentPath);
      if (parentFolder instanceof TFolder && parentFolder.parent) {
        currentPath = parentFolder.parent.path;
      } else {
        break;
      }
    }
    
    const rootQuartoPath = '_quarto.yml';
    const rootQuartoFile = this.app.vault.getAbstractFileByPath(rootQuartoPath);
    
    if (rootQuartoFile && rootQuartoFile instanceof TFile) {
      return {
        root: '',
        variablesPath: '_variables.yml',
        quartoConfigPath: rootQuartoPath
      };
    }
    
    return null;
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearCacheForFile(file: TFile): void {
    this.cache.delete(file.path);
  }
}