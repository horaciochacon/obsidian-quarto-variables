import { App, TFile } from 'obsidian';
import { YamlNode, YamlSection, ParsedYamlStructure } from './YamlStructureParser';
import { ProjectInfo } from '@/types';
import * as yaml from 'js-yaml';

export interface WriteResult {
  success: boolean;
  error?: string;
  updatedContent?: string;
}

export class VariableWriter {
  private app: App;
  
  constructor(app: App) {
    this.app = app;
  }

  async updateVariable(
    projectInfo: ProjectInfo,
    yamlStructure: ParsedYamlStructure,
    variablePath: string,
    newValue: any
  ): Promise<WriteResult> {
    try {
      // Get the variables file
      const file = this.app.vault.getAbstractFileByPath(projectInfo.variablesPath);
      if (!(file instanceof TFile)) {
        return {
          success: false,
          error: 'Variables file not found'
        };
      }

      // Update the structure
      const updatedStructure = this.updateStructureValue(yamlStructure, variablePath, newValue);
      if (!updatedStructure) {
        return {
          success: false,
          error: 'Variable path not found in structure'
        };
      }

      // Generate new YAML content preserving structure
      const newContent = this.generateYamlContent(updatedStructure, yamlStructure.originalLines);
      
      // Write back to file
      await this.app.vault.modify(file, newContent);

      return {
        success: true,
        updatedContent: newContent
      };

    } catch (error) {
      console.error('VariableWriter error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private updateStructureValue(
    structure: ParsedYamlStructure,
    variablePath: string,
    newValue: any
  ): ParsedYamlStructure | null {
    const pathParts = variablePath.split('.');
    let found = false;

    // Deep clone the structure to avoid mutation
    const clonedStructure: ParsedYamlStructure = {
      sections: structure.sections.map(section => ({
        ...section,
        nodes: this.cloneNodes(section.nodes)
      })),
      flatNodes: this.cloneNodes(structure.flatNodes),
      originalLines: [...structure.originalLines],
      parsedData: { ...structure.parsedData }
    };

    // Update in sections
    for (const section of clonedStructure.sections) {
      if (this.updateNodesValue(section.nodes, pathParts, newValue)) {
        found = true;
        break;
      }
    }

    // Update flat nodes as well
    if (!found) {
      this.updateNodesValue(clonedStructure.flatNodes, pathParts, newValue);
    }

    // Update parsed data
    this.updateParsedData(clonedStructure.parsedData, pathParts, newValue);

    return clonedStructure;
  }

  private cloneNodes(nodes: YamlNode[]): YamlNode[] {
    return nodes.map(node => ({
      ...node,
      children: node.children ? this.cloneNodes(node.children) : undefined,
      isStructuralParent: node.isStructuralParent,
      parentPath: node.parentPath
    }));
  }

  private updateNodesValue(nodes: YamlNode[], pathParts: string[], newValue: any): boolean {
    if (pathParts.length === 0) return false;

    for (const node of nodes) {
      if (node.key === pathParts[0]) {
        if (pathParts.length === 1) {
          // Found the target node
          node.value = newValue;
          node.type = this.getValueType(newValue);
          return true;
        } else if (node.children) {
          // Continue searching in children
          return this.updateNodesValue(node.children, pathParts.slice(1), newValue);
        }
      }
    }
    return false;
  }

  private updateParsedData(data: Record<string, any>, pathParts: string[], newValue: any): void {
    let current = data;
    for (let i = 0; i < pathParts.length - 1; i++) {
      const key = pathParts[i];
      if (current[key] === undefined || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const finalKey = pathParts[pathParts.length - 1];
    current[finalKey] = newValue;
  }

  private getValueType(value: any): YamlNode['type'] {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  private generateYamlContent(structure: ParsedYamlStructure, originalLines: string[]): string {
    const lines = [...originalLines];
    
    // Process each section to update values while preserving structure
    for (const section of structure.sections) {
      this.updateLinesForNodes(lines, section.nodes);
    }

    return lines.join('\n');
  }

  private updateLinesForNodes(lines: string[], nodes: YamlNode[]): void {
    for (const node of nodes) {
      // Update the line for this node
      if (node.lineStart >= 0 && node.lineStart < lines.length) {
        const originalLine = lines[node.lineStart];
        const updatedLine = this.updateLineValue(originalLine, node);
        if (updatedLine !== originalLine) {
          lines[node.lineStart] = updatedLine;
        }
      }

      // Recursively update children
      if (node.children && node.children.length > 0) {
        this.updateLinesForNodes(lines, node.children);
      }
    }
  }

  private updateLineValue(originalLine: string, node: YamlNode): string {
    // Don't update lines for structural parent nodes with children
    if (node.isStructuralParent && node.children && node.children.length > 0) {
      return originalLine; // Preserve the original line structure
    }
    
    const colonIndex = originalLine.indexOf(':');
    if (colonIndex === -1) return originalLine;

    const beforeColon = originalLine.substring(0, colonIndex + 1);
    const afterColon = originalLine.substring(colonIndex + 1);
    
    // Extract comment if present
    let comment = '';
    let valueOnlyPart = afterColon;
    const hashIndex = afterColon.indexOf('#');
    if (hashIndex !== -1) {
      comment = afterColon.substring(hashIndex);
      valueOnlyPart = afterColon.substring(0, hashIndex);
    }

    // Format the new value
    const newValueFormatted = this.formatValueForYaml(node.value, node.type, node.isStructuralParent);
    
    // Preserve original spacing before value
    const leadingSpaces = valueOnlyPart.match(/^\s*/)?.[0] || ' ';
    
    return `${beforeColon}${leadingSpaces}${newValueFormatted}${comment}`;
  }

  private formatValueForYaml(value: any, type: YamlNode['type'], isStructuralParent: boolean = false): string {
    // For structural parent nodes (like "model:" that have children), preserve empty value
    if (isStructuralParent) {
      return '';
    }
    
    switch (type) {
      case 'string':
        // Quote strings that contain special characters or start with numbers
        const str = String(value);
        if (str.match(/[:#@&*!|>%{}\[\],`]/) || str.match(/^\d/) || str.trim() !== str) {
          return `"${str.replace(/"/g, '\\"')}"`;
        }
        return str;
      
      case 'number':
        return String(value);
      
      case 'boolean':
        return String(value);
      
      case 'array':
        if (!Array.isArray(value)) return '[]';
        if (value.length === 0) return '[]';
        
        // For simple arrays, use inline format
        if (value.every(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')) {
          const formattedItems = value.map(item => 
            typeof item === 'string' ? `"${item}"` : String(item)
          );
          return `[${formattedItems.join(', ')}]`;
        }
        return '[complex array]'; // For complex arrays, we'd need multi-line handling
      
      case 'object':
        // Only return {} for actual data objects, not structural parents
        return value && Object.keys(value).length > 0 ? JSON.stringify(value) : '{}';
      
      case 'null':
        return 'null';
      
      default:
        return String(value);
    }
  }

  // Helper method to create a new variables file
  async createVariablesFile(projectInfo: ProjectInfo, initialContent?: Record<string, any>): Promise<WriteResult> {
    try {
      const defaultContent = initialContent || {
        author: "Your Name",
        title: "Project Title", 
        date: new Date().getFullYear()
      };

      // Generate YAML content
      const yamlContent = yaml.dump(defaultContent, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false
      });

      // Add header comment
      const contentWithHeader = `# Project Variables\n# Define your project variables below\n\n${yamlContent}`;

      await this.app.vault.create(projectInfo.variablesPath, contentWithHeader);

      return {
        success: true,
        updatedContent: contentWithHeader
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Helper method to add a new variable
  async addVariable(
    projectInfo: ProjectInfo,
    yamlStructure: ParsedYamlStructure,
    sectionName: string,
    key: string,
    value: any
  ): Promise<WriteResult> {
    try {
      const file = this.app.vault.getAbstractFileByPath(projectInfo.variablesPath);
      if (!(file instanceof TFile)) {
        return {
          success: false,
          error: 'Variables file not found'
        };
      }

      const lines = [...yamlStructure.originalLines];
      
      // Find the section or create it
      const section = yamlStructure.sections.find(s => s.header.toLowerCase() === sectionName.toLowerCase());
      
      if (section) {
        // Add to existing section
        const lastNode = section.nodes[section.nodes.length - 1];
        const insertIndex = lastNode ? lastNode.lineEnd + 1 : section.lineNumber + 1;
        const indentation = this.getIndentationForSection(section);
        const newLine = `${indentation}${key}: ${this.formatValueForYaml(value, this.getValueType(value))}`;
        
        lines.splice(insertIndex, 0, newLine);
      } else {
        // Create new section
        lines.push('');
        lines.push(`# ${sectionName}`);
        lines.push(`${key}: ${this.formatValueForYaml(value, this.getValueType(value))}`);
      }

      const newContent = lines.join('\n');
      await this.app.vault.modify(file, newContent);

      return {
        success: true,
        updatedContent: newContent
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private getIndentationForSection(section: YamlSection): string {
    if (section.nodes.length === 0) return '';
    
    const firstNode = section.nodes[0];
    const line = firstNode.lineStart >= 0 ? firstNode.lineStart : 0;
    // This would need to be calculated from the actual line content
    return ''; // Simplified - would need proper indentation detection
  }
}