import { WidgetType } from '@codemirror/view';
import { PluginSettings } from '@/types';

export class VariableWidget extends WidgetType {
  constructor(
    private value: string,
    private settings: PluginSettings,
    private isResolved: boolean = true
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = this.settings.placeholderClass;
    
    if (!this.isResolved && this.settings.highlightUnresolvedVariables) {
      span.classList.add('quarto-variable-unresolved');
    } else if (this.isResolved) {
      span.classList.add('quarto-variable-resolved');
      if (this.settings.placeholderColor) {
        span.style.setProperty('--placeholder-color', this.settings.placeholderColor);
      }
    }
    
    span.innerText = this.value;
    
    return span;
  }

  eq(other: VariableWidget): boolean {
    return other.value === this.value && 
           other.isResolved === this.isResolved;
  }

  ignoreEvent(): boolean {
    return false;
  }
}