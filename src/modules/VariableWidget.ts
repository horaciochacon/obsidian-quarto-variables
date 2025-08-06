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
      span.style.textDecoration = 'underline';
      span.style.textDecorationStyle = 'wavy';
      span.style.textDecorationColor = '#ef4444';
    }
    
    if (this.settings.placeholderColor && this.isResolved) {
      span.style.color = this.settings.placeholderColor;
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