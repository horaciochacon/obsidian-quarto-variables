import { PluginSettings } from '@/types';
import { YamlNode } from '../modules/YamlStructureParser';
import QuartoVariablesPlugin from '../main';

export class VariableEditor {
  private node: YamlNode;
  private plugin: QuartoVariablesPlugin;
  private settings: PluginSettings;
  private element: HTMLElement | null = null;
  private inputElement: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
  private saveCallbacks: Array<(value: any) => void> = [];
  private cancelCallbacks: Array<() => void> = [];

  constructor(
    node: YamlNode,
    plugin: QuartoVariablesPlugin,
    settings: PluginSettings
  ) {
    this.node = node;
    this.plugin = plugin;
    this.settings = settings;
  }

  async render(): Promise<HTMLElement> {
    this.element = document.createElement('div');
    this.element.addClass('variable-editor-container');

    // Create the appropriate input based on the variable type
    switch (this.node.type) {
      case 'boolean':
        this.createBooleanEditor();
        break;
      case 'number':
        this.createNumberEditor();
        break;
      case 'array':
        this.createArrayEditor();
        break;
      case 'string':
      default:
        this.createStringEditor();
        break;
    }

    // Create action buttons
    const actionsContainer = document.createElement('div');
    actionsContainer.addClass('variable-editor-actions');

    const saveButton = document.createElement('button');
    saveButton.addClass('variable-editor-save');
    saveButton.textContent = '✓';
    saveButton.setAttribute('aria-label', 'Save');
    saveButton.addEventListener('click', () => this.save());

    const cancelButton = document.createElement('button');
    cancelButton.addClass('variable-editor-cancel');
    cancelButton.textContent = '✕';
    cancelButton.setAttribute('aria-label', 'Cancel');
    cancelButton.addEventListener('click', () => this.cancel());

    actionsContainer.appendChild(saveButton);
    actionsContainer.appendChild(cancelButton);
    this.element.appendChild(actionsContainer);

    // Add keyboard event handlers
    if (this.inputElement) {
      this.inputElement.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
          if (this.node.type !== 'array' || !keyEvent.ctrlKey) {
            e.preventDefault();
            this.save();
          }
        } else if (keyEvent.key === 'Escape') {
          e.preventDefault();
          this.cancel();
        }
      });

      // Auto-save on blur (unless clicking cancel button)
      this.inputElement.addEventListener('blur', (e) => {
        // Small delay to allow click events to fire first
        setTimeout(() => {
          if (this.element && document.contains(this.element)) {
            // Check if focus moved to a cancel button or outside entirely
            const activeElement = document.activeElement;
            const isCancelButton = activeElement?.classList.contains('variable-editor-cancel');
            
            if (!isCancelButton) {
              this.save();
            }
          }
        }, 100);
      });
    }

    return this.element;
  }

  private createStringEditor(): void {
    const stringValue = String(this.node.value || '');
    
    // Use textarea for multiline strings, input for single line
    if (stringValue.includes('\n') || stringValue.length > 50) {
      this.inputElement = document.createElement('textarea');
      (this.inputElement as HTMLTextAreaElement).rows = Math.min(Math.max(2, stringValue.split('\n').length), 6);
    } else {
      this.inputElement = document.createElement('input');
      this.inputElement.type = 'text';
    }

    this.inputElement.addClass('variable-editor-input');
    this.inputElement.value = stringValue;
    this.element!.appendChild(this.inputElement);
  }

  private createNumberEditor(): void {
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'number';
    this.inputElement.addClass('variable-editor-input');
    this.inputElement.value = String(this.node.value || 0);
    
    // Handle decimal numbers
    if (typeof this.node.value === 'number' && !Number.isInteger(this.node.value)) {
      (this.inputElement as HTMLInputElement).step = 'any';
    }

    this.element!.appendChild(this.inputElement);
  }

  private createBooleanEditor(): void {
    this.inputElement = document.createElement('select');
    this.inputElement.addClass('variable-editor-input');

    const trueOption = document.createElement('option');
    trueOption.value = 'true';
    trueOption.textContent = 'true';

    const falseOption = document.createElement('option');
    falseOption.value = 'false';
    falseOption.textContent = 'false';

    this.inputElement.appendChild(trueOption);
    this.inputElement.appendChild(falseOption);
    this.inputElement.value = String(this.node.value);

    this.element!.appendChild(this.inputElement);
  }

  private createArrayEditor(): void {
    this.inputElement = document.createElement('textarea');
    (this.inputElement as HTMLTextAreaElement).rows = Math.min(Math.max(3, (this.node.value as any[])?.length || 1), 10);
    this.inputElement.addClass('variable-editor-input');
    this.inputElement.placeholder = 'Enter one item per line';
    
    // Convert array to line-separated string
    if (Array.isArray(this.node.value)) {
      this.inputElement.value = this.node.value.map(item => String(item)).join('\n');
    } else {
      this.inputElement.value = '';
    }

    this.element!.appendChild(this.inputElement);

    // Add helper text
    const helperText = document.createElement('div');
    helperText.addClass('variable-editor-helper');
    helperText.textContent = 'One item per line';
    this.element!.appendChild(helperText);
  }

  private save(): void {
    if (!this.inputElement) return;

    try {
      const newValue = this.parseValue();
      this.saveCallbacks.forEach(callback => callback(newValue));
    } catch (error) {
      console.error('Failed to parse value:', error);
      // TODO: Show error feedback to user
      this.showValidationError('Invalid value format');
    }
  }

  private cancel(): void {
    this.cancelCallbacks.forEach(callback => callback());
  }

  private parseValue(): any {
    if (!this.inputElement) return this.node.value;

    const rawValue = this.inputElement.value;

    switch (this.node.type) {
      case 'string':
        return rawValue;
      
      case 'number':
        const numValue = Number(rawValue);
        if (isNaN(numValue)) {
          throw new Error('Invalid number');
        }
        return numValue;
      
      case 'boolean':
        return rawValue === 'true';
      
      case 'array':
        if (rawValue.trim() === '') return [];
        return rawValue.split('\n').map(line => {
          const trimmed = line.trim();
          if (trimmed === '') return trimmed;
          
          // Try to parse as number first
          const asNumber = Number(trimmed);
          if (!isNaN(asNumber) && trimmed === String(asNumber)) {
            return asNumber;
          }
          
          // Try to parse as boolean
          if (trimmed === 'true' || trimmed === 'false') {
            return trimmed === 'true';
          }
          
          // Return as string
          return trimmed;
        }).filter(item => item !== '');
      
      default:
        return rawValue;
    }
  }

  private showValidationError(message: string): void {
    // Remove existing error
    const existingError = this.element?.querySelector('.variable-editor-error');
    existingError?.remove();

    // Add error message
    const errorElement = document.createElement('div');
    errorElement.addClass('variable-editor-error');
    errorElement.textContent = message;
    this.element?.appendChild(errorElement);

    // Remove error after 3 seconds
    setTimeout(() => {
      errorElement.remove();
    }, 3000);
  }

  public focus(): void {
    if (this.inputElement) {
      this.inputElement.focus();
      
      // Select all text for easy replacement
      if (this.inputElement instanceof HTMLInputElement) {
        this.inputElement.select();
      } else if (this.inputElement instanceof HTMLTextAreaElement) {
        this.inputElement.select();
      }
    }
  }

  public onSave(callback: (value: any) => void): void {
    this.saveCallbacks.push(callback);
  }

  public onCancel(callback: () => void): void {
    this.cancelCallbacks.push(callback);
  }

  public destroy(): void {
    this.saveCallbacks = [];
    this.cancelCallbacks = [];
    
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    this.inputElement = null;
  }
}