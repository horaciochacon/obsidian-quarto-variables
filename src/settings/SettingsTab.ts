import { App, PluginSettingTab, Setting } from 'obsidian';
import QuartoVariablesPlugin from '../main';
import { DEFAULT_SETTINGS } from '@/types';

export class QuartoVariablesSettingTab extends PluginSettingTab {
  plugin: QuartoVariablesPlugin;

  constructor(app: App, plugin: QuartoVariablesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Quarto Variables Settings' });

    new Setting(containerEl)
      .setName('Enable in Reading View')
      .setDesc('Show variable replacements in Reading view mode')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableInReadingView)
        .onChange(async (value) => {
          this.plugin.settings.enableInReadingView = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Highlight Unresolved Variables')
      .setDesc('Show a red wavy underline for variables that cannot be resolved')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.highlightUnresolvedVariables)
        .onChange(async (value) => {
          this.plugin.settings.highlightUnresolvedVariables = value;
          await this.plugin.saveSettings();
          this.plugin.refreshEditors();
        }));

    new Setting(containerEl)
      .setName('Placeholder CSS Class')
      .setDesc('CSS class name to apply to variable replacements')
      .addText(text => text
        .setPlaceholder(DEFAULT_SETTINGS.placeholderClass)
        .setValue(this.plugin.settings.placeholderClass)
        .onChange(async (value) => {
          this.plugin.settings.placeholderClass = value || DEFAULT_SETTINGS.placeholderClass;
          await this.plugin.saveSettings();
          this.plugin.refreshEditors();
        }));

    new Setting(containerEl)
      .setName('Placeholder Color')
      .setDesc('Color for resolved variable values (CSS color format)')
      .addText(text => text
        .setPlaceholder(DEFAULT_SETTINGS.placeholderColor)
        .setValue(this.plugin.settings.placeholderColor)
        .onChange(async (value) => {
          this.plugin.settings.placeholderColor = value || DEFAULT_SETTINGS.placeholderColor;
          await this.plugin.saveSettings();
          this.plugin.refreshEditors();
        }));

    new Setting(containerEl)
      .setName('Cache TTL')
      .setDesc('Time to live for cached variables in milliseconds')
      .addText(text => text
        .setPlaceholder(String(DEFAULT_SETTINGS.cacheTTL))
        .setValue(String(this.plugin.settings.cacheTTL))
        .onChange(async (value) => {
          const numValue = parseInt(value);
          if (!isNaN(numValue) && numValue > 0) {
            this.plugin.settings.cacheTTL = numValue;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Debug Mode')
      .setDesc('Enable debug logging to the console')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debugMode)
        .onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', { text: 'Variables Pane' });

    new Setting(containerEl)
      .setName('Enable Variables Pane')
      .setDesc('Show the Variables side pane for editing YAML variables')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableVariablesPane)
        .onChange(async (value) => {
          this.plugin.settings.enableVariablesPane = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Auto-open Variables Pane')
      .setDesc('Automatically open the Variables pane when opening a QMD file')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoOpenVariablesPane)
        .onChange(async (value) => {
          this.plugin.settings.autoOpenVariablesPane = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', { text: 'About' });
    containerEl.createEl('p', { 
      text: 'This plugin replaces Quarto variable placeholders with their values from _variables.yml files.' 
    });
    containerEl.createEl('p', { 
      text: 'Variables are resolved relative to the nearest _quarto.yml file in the directory hierarchy.' 
    });
  }
}