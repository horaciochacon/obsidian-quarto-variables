import { TFile } from 'obsidian';

export interface PluginSettings {
  enableInReadingView: boolean;
  highlightUnresolvedVariables: boolean;
  placeholderClass: string;
  placeholderColor: string;
  cacheTTL: number;
  debugMode: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  enableInReadingView: true,
  highlightUnresolvedVariables: true,
  placeholderClass: 'quarto-variable',
  placeholderColor: '#7c3aed',
  cacheTTL: 3600000, // 1 hour in ms
  debugMode: false
};

export interface VariableMatch {
  from: number;
  to: number;
  key: string;
}

export interface ProjectInfo {
  root: string;
  variablesPath: string;
  quartoConfigPath: string;
}

export interface CacheEntry {
  data: Record<string, any>;
  version: number;
  lastModified: number;
}