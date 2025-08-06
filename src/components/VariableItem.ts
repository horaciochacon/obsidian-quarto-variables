import { ProjectInfo, PluginSettings } from '@/types';
import { YamlNode } from '../modules/YamlStructureParser';
import { VariableCache } from '../modules/VariableCache';
import { VariableEditor } from './VariableEditor';
import QuartoVariablesPlugin from '../main';

export class VariableItem {
  private node: YamlNode;
  private plugin: QuartoVariablesPlugin;
  private variableCache: VariableCache;
  private settings: PluginSettings;
  private projectInfo: ProjectInfo | null;
  private element: HTMLElement | null = null;
  private editor: VariableEditor | null = null;
  private isEditing: boolean = false;

  constructor(
    node: YamlNode,
    plugin: QuartoVariablesPlugin,
    variableCache: VariableCache,
    settings: PluginSettings,
    projectInfo: ProjectInfo | null
  ) {
    this.node = node;
    this.plugin = plugin;
    this.variableCache = variableCache;
    this.settings = settings;
    this.projectInfo = projectInfo;
  }

  async render(): Promise<HTMLElement> {
    this.element = document.createElement('div');
    this.element.addClass('variable-item');
    this.element.setAttribute('data-key', this.node.key);
    this.element.setAttribute('data-type', this.node.type);

    // Add indentation based on level
    if (this.node.level > 0) {
      this.element.style.paddingLeft = `${this.node.level * 6}px`;
    }

    // Create key section
    const keySection = document.createElement('div');
    keySection.addClass('variable-item-key');
    
    const keyElement = document.createElement('span');
    keyElement.addClass('variable-key');
    keyElement.textContent = this.node.key;
    keySection.appendChild(keyElement);

    // Add type indicator
    const typeIndicator = document.createElement('span');
    typeIndicator.addClass('variable-type-indicator');
    typeIndicator.textContent = this.getTypeIcon();
    typeIndicator.setAttribute('data-type', this.node.type);
    keySection.appendChild(typeIndicator);

    this.element.appendChild(keySection);

    // Create value section
    const valueSection = document.createElement('div');
    valueSection.addClass('variable-item-value');
    
    const valueElement = document.createElement('span');
    valueElement.addClass('variable-value');
    valueElement.textContent = this.formatValue();
    
    // Only make editable if not a structural parent
    if (!this.node.isStructuralParent || !this.node.children || this.node.children.length === 0) {
      valueElement.addEventListener('click', () => this.startEditing());
      valueElement.addClass('variable-value-editable');
    } else {
      valueElement.addClass('variable-value-structural');
    }
    
    valueSection.appendChild(valueElement);

    // Add comment if present
    if (this.node.comment) {
      const commentElement = document.createElement('span');
      commentElement.addClass('variable-comment');
      commentElement.textContent = `# ${this.node.comment}`;
      valueSection.appendChild(commentElement);
    }

    this.element.appendChild(valueSection);

    // Add hover effects
    this.element.addEventListener('mouseenter', () => {
      this.element?.addClass('variable-item-hover');
    });

    this.element.addEventListener('mouseleave', () => {
      this.element?.removeClass('variable-item-hover');
    });

    return this.element;
  }

  private getTypeIcon(): string {
    switch (this.node.type) {
      case 'string': return '𝓣';
      case 'number': return '#';
      case 'boolean': return '?';
      case 'array': return '[]';
      case 'object': return '{}';
      case 'null': return '∅';
      default: return '•';
    }
  }

  private formatValue(): string {
    // For structural parents, show that they have children
    if (this.node.isStructuralParent && this.node.children && this.node.children.length > 0) {
      return `{${this.node.children.length} ${this.node.children.length === 1 ? 'property' : 'properties'}}`;
    }

    if (this.node.value === null || this.node.value === undefined) {
      return 'null';
    }

    switch (this.node.type) {
      case 'string':
        return `"${this.node.value}"`;
      case 'array':
        const array = this.node.value as any[];
        if (array.length === 0) return '[]';
        if (array.length <= 3) {
          return `[${array.map(v => typeof v === 'string' ? `"${v}"` : String(v)).join(', ')}]`;
        }
        return `[${array.length} items]`;
      case 'object':
        const obj = this.node.value as Record<string, any>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        return `{${keys.length} properties}`;
      case 'boolean':
        return this.node.value ? 'true' : 'false';
      case 'number':
        return String(this.node.value);
      default:
        return String(this.node.value);
    }
  }

  private async startEditing(): Promise<void> {
    if (this.isEditing || !this.element) return;

    // Don't allow editing of structural parent nodes
    if (this.node.isStructuralParent && this.node.children && this.node.children.length > 0) {
      console.log('Cannot edit structural parent node:', this.node.key);
      return;
    }

    this.isEditing = true;
    const valueElement = this.element.querySelector('.variable-value');
    
    if (!valueElement) return;

    // Create editor
    this.editor = new VariableEditor(
      this.node,
      this.plugin,
      this.settings
    );

    // Replace value display with editor
    const editorElement = await this.editor.render();
    valueElement.replaceWith(editorElement);

    // Set up editor event handlers
    this.editor.onSave(async (newValue) => {
      await this.saveValue(newValue);
      await this.stopEditing();
    });

    this.editor.onCancel(() => {
      this.stopEditing();
    });

    // Focus the editor
    this.editor.focus();
  }

  private async stopEditing(): Promise<void> {
    if (!this.isEditing || !this.element || !this.editor) return;

    this.isEditing = false;
    
    // Replace editor with value display
    const editorElement = this.element.querySelector('.variable-editor-container');
    if (editorElement) {
      const valueElement = document.createElement('span');
      valueElement.addClass('variable-value');
      valueElement.textContent = this.formatValue();
      valueElement.addEventListener('click', () => this.startEditing());
      editorElement.replaceWith(valueElement);
    }

    this.editor = null;
  }

  private async saveValue(newValue: any): Promise<void> {
    try {
      if (!this.projectInfo) {
        console.error('No project info available for saving');
        return;
      }

      // Get the variable path (handle nested variables)
      const variablePath = this.getVariablePath();
      
      // Update through the variable cache which handles the file writing
      const result = await this.variableCache.updateVariable(this.projectInfo, variablePath, newValue);
      
      if (result.success) {
        // Update the local node
        this.node.value = newValue;
        this.node.type = this.getTypeFromValue(newValue);
      } else {
        console.error('Failed to save variable:', result.error);
        // TODO: Show error notification to user
      }
      
    } catch (error) {
      console.error('Failed to save variable:', error);
      // TODO: Show error notification
    }
  }

  private getVariablePath(): string {
    // Build the full path using parentPath from the parser
    if (this.node.parentPath) {
      return `${this.node.parentPath}.${this.node.key}`;
    }
    return this.node.key;
  }

  private getTypeFromValue(value: any): YamlNode['type'] {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  public async updateValue(newValue: any): Promise<void> {
    this.node.value = newValue;
    
    if (this.element && !this.isEditing) {
      const valueElement = this.element.querySelector('.variable-value');
      if (valueElement) {
        valueElement.textContent = this.formatValue();
      }
    }
  }

  public setVisible(visible: boolean): void {
    if (this.element) {
      this.element.style.display = visible ? 'flex' : 'none';
    }
  }

  public getKey(): string {
    return this.node.key;
  }

  public getValue(): any {
    return this.node.value;
  }

  public getType(): string {
    return this.node.type;
  }

  public getNode(): YamlNode {
    return this.node;
  }

  public destroy(): void {
    if (this.editor) {
      this.editor.destroy();
    }
    
    if (this.element) {
      this.element.remove();
    }
  }
}