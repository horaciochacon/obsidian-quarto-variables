export class TFile {
  path: string;
  name: string;
  extension: string;
  parent: TFolder | null;
  stat: { mtime: number };

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = this.name.split('.').pop() || '';
    this.parent = null;
    this.stat = { mtime: Date.now() };
  }
}

export class TFolder {
  path: string;
  name: string;
  parent: TFolder | null;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.parent = null;
  }
}

export class Notice {
  constructor(message: string, timeout?: number) {}
}

export class App {
  vault = {
    getAbstractFileByPath: jest.fn(),
    read: jest.fn(),
    on: jest.fn(),
    offref: jest.fn()
  };
  workspace = {
    getActiveFile: jest.fn(),
    on: jest.fn(),
    trigger: jest.fn(),
    iterateAllLeaves: jest.fn()
  };
}

export class Plugin {
  app: App;
  manifest: any;
  
  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  
  loadData = jest.fn();
  saveData = jest.fn();
  registerEditorExtension = jest.fn();
  registerMarkdownPostProcessor = jest.fn();
  registerEvent = jest.fn();
  addCommand = jest.fn();
  addSettingTab = jest.fn();
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
  hide(): void {}
}

export class Setting {
  constructor(containerEl: HTMLElement) {}
  setName(name: string): this { return this; }
  setDesc(desc: string): this { return this; }
  addToggle(cb: any): this { return this; }
  addText(cb: any): this { return this; }
}

export class MarkdownView {
  file: TFile | null;
  editor: { refresh: jest.fn };
  
  constructor() {
    this.file = null;
    this.editor = { refresh: jest.fn() };
  }
}

export interface EventRef {}

export interface MarkdownPostProcessorContext {
  sourcePath: string;
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}