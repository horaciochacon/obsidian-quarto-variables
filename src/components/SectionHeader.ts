import { PluginSettings } from '@/types';
import { YamlSection } from '../modules/YamlStructureParser';

export class SectionHeader {
  private section: YamlSection;
  private settings: PluginSettings;
  private element: HTMLElement | null = null;
  private isCollapsed: boolean = false;
  private toggleCallbacks: Array<(collapsed: boolean) => void> = [];

  constructor(section: YamlSection, settings: PluginSettings) {
    this.section = section;
    this.settings = settings;
  }

  async render(): Promise<HTMLElement> {
    this.element = document.createElement('div');
    this.element.addClass('section-header');

    // Create the main header container
    const headerContainer = document.createElement('div');
    headerContainer.addClass('section-header-container');
    
    // Add collapse/expand toggle
    const toggleButton = document.createElement('button');
    toggleButton.addClass('section-toggle');
    toggleButton.setAttribute('aria-label', 'Toggle section');
    toggleButton.setText(this.getToggleIcon());
    toggleButton.addEventListener('click', () => this.toggle());
    headerContainer.appendChild(toggleButton);

    // Add section title
    const titleElement = document.createElement('h4');
    titleElement.addClass('section-title');
    titleElement.textContent = this.section.header;
    headerContainer.appendChild(titleElement);

    // Add variable count badge
    const countBadge = document.createElement('span');
    countBadge.addClass('section-count');
    countBadge.textContent = `${this.section.nodes.length}`;
    headerContainer.appendChild(countBadge);

    this.element.appendChild(headerContainer);

    // Add section comment if present and different from header
    if (this.section.comment && this.section.comment !== this.section.header.toLowerCase()) {
      const commentElement = document.createElement('div');
      commentElement.addClass('section-comment');
      commentElement.textContent = this.section.comment;
      this.element.appendChild(commentElement);
    }

    // Add keyboard support
    headerContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });

    headerContainer.setAttribute('tabindex', '0');
    headerContainer.setAttribute('role', 'button');
    headerContainer.setAttribute('aria-expanded', String(!this.isCollapsed));

    return this.element;
  }

  private getToggleIcon(): string {
    return this.isCollapsed ? '▶' : '▼';
  }

  private toggle(): void {
    this.isCollapsed = !this.isCollapsed;
    
    if (this.element) {
      const toggleButton = this.element.querySelector('.section-toggle');
      const headerContainer = this.element.querySelector('.section-header-container');
      
      if (toggleButton) {
        toggleButton.setText(this.getToggleIcon());
      }
      
      if (headerContainer) {
        headerContainer.setAttribute('aria-expanded', String(!this.isCollapsed));
      }
      
      this.element.setAttribute('data-collapsed', String(this.isCollapsed));
    }

    // Notify listeners
    this.toggleCallbacks.forEach(callback => callback(this.isCollapsed));
  }

  public onToggle(callback: (collapsed: boolean) => void): void {
    this.toggleCallbacks.push(callback);
  }

  public setCollapsed(collapsed: boolean): void {
    if (this.isCollapsed === collapsed) return;
    
    this.isCollapsed = collapsed;
    
    if (this.element) {
      const toggleButton = this.element.querySelector('.section-toggle');
      const headerContainer = this.element.querySelector('.section-header-container');
      
      if (toggleButton) {
        toggleButton.setText(this.getToggleIcon());
      }
      
      if (headerContainer) {
        headerContainer.setAttribute('aria-expanded', String(!this.isCollapsed));
      }
      
      this.element.setAttribute('data-collapsed', String(this.isCollapsed));
    }

    // Notify listeners without triggering the toggle
    this.toggleCallbacks.forEach(callback => callback(this.isCollapsed));
  }

  public isCurrentlyCollapsed(): boolean {
    return this.isCollapsed;
  }

  public setVisible(visible: boolean): void {
    if (this.element) {
      this.element.toggleClass('variables-hidden', !visible);
    }
  }

  public updateCount(count: number): void {
    if (this.element) {
      const countBadge = this.element.querySelector('.section-count');
      if (countBadge) {
        countBadge.textContent = String(count);
      }
    }
  }

  public getSection(): YamlSection {
    return this.section;
  }

  public getElement(): HTMLElement | null {
    return this.element;
  }

  public destroy(): void {
    this.toggleCallbacks = [];
    
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}