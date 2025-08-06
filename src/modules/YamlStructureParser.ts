import * as yaml from 'js-yaml';

export interface YamlNode {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  level: number;
  lineStart: number;
  lineEnd: number;
  comment?: string;
  children?: YamlNode[];
  sectionHeader?: string;
  isStructuralParent?: boolean;
  parentPath?: string;
}

export interface YamlSection {
  header: string;
  comment: string;
  lineNumber: number;
  nodes: YamlNode[];
}

export interface ParsedYamlStructure {
  sections: YamlSection[];
  flatNodes: YamlNode[];
  originalLines: string[];
  parsedData: Record<string, any>;
}

export class YamlStructureParser {
  private lines: string[] = [];
  private currentLineIndex = 0;
  private debugMode = false;
  private processedKeys = new Set<string>(); // Track processed keys to detect duplicates

  parse(yamlContent: string): ParsedYamlStructure {
    this.lines = yamlContent.split('\n');
    this.currentLineIndex = 0;
    this.processedKeys.clear(); // Reset for each parse

    let parsedData: Record<string, any>;
    try {
      parsedData = yaml.load(yamlContent, {
        schema: yaml.FAILSAFE_SCHEMA,
        json: true
      }) as Record<string, any> || {};
    } catch (error) {
      console.error('YAML parsing failed:', error);
      parsedData = {};
    }

    const sections = this.extractSections();
    const flatNodes = this.flattenNodes(sections);

    // Validate for duplicates
    this.validateNoDuplicates(sections);

    return {
      sections,
      flatNodes,
      originalLines: [...this.lines],
      parsedData
    };
  }

  private extractSections(): YamlSection[] {
    const sections: YamlSection[] = [];
    let currentSection: YamlSection | null = null;
    let pendingNodes: YamlNode[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const trimmedLine = line.trim();

      // Check if this is a comment that could be a section header
      if (trimmedLine.startsWith('#') && !this.isInlineComment(line)) {
        // If we have pending nodes, add them to current section or create default section
        if (pendingNodes.length > 0) {
          if (currentSection) {
            currentSection.nodes.push(...pendingNodes);
          } else {
            // Create default section for nodes without header
            sections.push({
              header: 'Variables',
              comment: '',
              lineNumber: 0,
              nodes: [...pendingNodes]
            });
          }
          pendingNodes = [];
        }

        // Create new section from comment
        const comment = trimmedLine.substring(1).trim();
        const header = this.commentToHeader(comment);
        
        currentSection = {
          header,
          comment,
          lineNumber: i,
          nodes: []
        };
        sections.push(currentSection);
      } 
      // Check if this is a YAML key-value pair
      else if (this.isYamlKeyLine(trimmedLine)) {
        const node = this.parseNodeFromLine(line, i);
        if (node) {
          // Handle nested structures
          if (node.type === 'object' && node.isStructuralParent) {
            const nestedResult = this.parseNestedStructure(i, node.key);
            if (nestedResult.nodes.length > 0) {
              node.children = nestedResult.nodes;
              // Skip to the correct line position
              i = nestedResult.lastProcessedLine;
            }
          }
          
          pendingNodes.push(node);
        }
      }
    }

    // Add any remaining pending nodes
    if (pendingNodes.length > 0) {
      if (currentSection) {
        currentSection.nodes.push(...pendingNodes);
      } else {
        sections.push({
          header: 'Variables',
          comment: '',
          lineNumber: 0,
          nodes: pendingNodes
        });
      }
    }

    return sections;
  }

  private isInlineComment(line: string): boolean {
    const trimmedLine = line.trim();
    // Check if the comment appears after a key-value pair
    const beforeComment = line.substring(0, line.indexOf('#'));
    return beforeComment.includes(':') && beforeComment.trim().length > 0;
  }

  private commentToHeader(comment: string): string {
    return comment.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isYamlKeyLine(line: string): boolean {
    if (line.length === 0 || line.startsWith('#')) return false;
    
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return false;
    
    const key = line.substring(0, colonIndex).trim();
    return key.length > 0 && !key.includes(' ');
  }

  private parseNodeFromLine(line: string, lineNumber: number): YamlNode | null {
    const trimmedLine = line.trim();
    const colonIndex = trimmedLine.indexOf(':');
    
    if (colonIndex === -1) return null;
    
    const key = trimmedLine.substring(0, colonIndex).trim();
    const valueStr = trimmedLine.substring(colonIndex + 1).trim();
    const level = this.getIndentationLevel(line);
    
    // Extract inline comment if present
    let comment: string | undefined;
    let cleanValue = valueStr;
    const hashIndex = valueStr.indexOf('#');
    if (hashIndex !== -1 && hashIndex > 0) {
      comment = valueStr.substring(hashIndex + 1).trim();
      cleanValue = valueStr.substring(0, hashIndex).trim();
    }

    // Determine value and type
    let value: any;
    let type: YamlNode['type'];
    let isStructuralParent = false;

    if (cleanValue === '' || cleanValue === '|' || cleanValue === '>') {
      // This is likely the start of a nested structure - keep value as null
      value = null;
      type = 'object';
      isStructuralParent = true;
    } else {
      // Parse the actual value
      try {
        value = yaml.load(cleanValue);
        type = this.getValueType(value);
      } catch {
        value = cleanValue;
        type = 'string';
      }
    }

    return {
      key,
      value,
      type,
      level,
      lineStart: lineNumber,
      lineEnd: lineNumber,
      comment,
      children: [],
      isStructuralParent
    };
  }

  private parseNestedStructure(startLine: number, parentPath: string = ''): { nodes: YamlNode[]; lastProcessedLine: number } {
    const nodes: YamlNode[] = [];
    const baseIndentation = this.getIndentationLevel(this.lines[startLine]);
    let lastProcessedLine = startLine;
    
    for (let i = startLine + 1; i < this.lines.length; i++) {
      const line = this.lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue;
      }
      
      const indentation = this.getIndentationLevel(line);
      
      // Enhanced boundary detection for nested structures
      // If indentation is not greater than base, we've exited the nested structure
      if (indentation <= baseIndentation) {
        // Double-check this isn't just inconsistent indentation
        if (this.isYamlKeyLine(trimmedLine)) {
          break;
        }
      }
      
      // Only process lines that are YAML key-value pairs and properly indented
      if (this.isYamlKeyLine(trimmedLine) && indentation > baseIndentation) {
        const node = this.parseNodeFromLine(line, i);
        if (node) {
          // Set parent path for this node
          node.parentPath = parentPath;
          
          // Recursively parse nested children with updated parent path
          if (node.type === 'object' && node.isStructuralParent) {
            const childParentPath = parentPath ? `${parentPath}.${node.key}` : node.key;
            const nestedResult = this.parseNestedStructure(i, childParentPath);
            if (nestedResult.nodes.length > 0) {
              node.children = nestedResult.nodes;
              // Skip to the correct line position
              i = nestedResult.lastProcessedLine;
            }
          }
          
          nodes.push(node);
          lastProcessedLine = i;
        }
      }
    }
    
    return { nodes, lastProcessedLine };
  }

  private getIndentationLevel(line: string): number {
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') {
        count++;
      } else if (line[i] === '\t') {
        count += 2; // Count tab as 2 spaces
      } else {
        break;
      }
    }
    return count;
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

  private flattenNodes(sections: YamlSection[]): YamlNode[] {
    const flatNodes: YamlNode[] = [];
    
    const flatten = (nodes: YamlNode[]) => {
      for (const node of nodes) {
        flatNodes.push(node);
        if (node.children && node.children.length > 0) {
          flatten(node.children);
        }
      }
    };
    
    for (const section of sections) {
      flatten(section.nodes);
    }
    
    return flatNodes;
  }

  getNodePath(node: YamlNode, sections: YamlSection[]): string {
    // Find the full path to this node for nested access
    const path: string[] = [];
    
    const findPath = (nodes: YamlNode[], targetNode: YamlNode, currentPath: string[]): boolean => {
      for (const n of nodes) {
        const newPath = [...currentPath, n.key];
        if (n === targetNode) {
          path.push(...newPath);
          return true;
        }
        if (n.children && findPath(n.children, targetNode, newPath)) {
          return true;
        }
      }
      return false;
    };
    
    for (const section of sections) {
      if (findPath(section.nodes, node, [])) {
        break;
      }
    }
    
    return path.join('.');
  }

  private validateNoDuplicates(sections: YamlSection[]): void {
    const keyPaths = new Set<string>();
    const duplicates: string[] = [];

    const checkNode = (node: YamlNode, currentPath: string = '') => {
      const fullPath = currentPath ? `${currentPath}.${node.key}` : node.key;
      const keyAtLevel = `${node.level}:${fullPath}`;

      if (keyPaths.has(keyAtLevel)) {
        duplicates.push(`Duplicate key found: ${fullPath} at level ${node.level} (line ${node.lineStart})`);
      } else {
        keyPaths.add(keyAtLevel);
      }

      // Check children recursively
      if (node.children) {
        for (const child of node.children) {
          checkNode(child, fullPath);
        }
      }
    };

    for (const section of sections) {
      for (const node of section.nodes) {
        checkNode(node);
      }
    }

    if (duplicates.length > 0) {
      console.warn('YAML Parser: Duplicate nodes detected:', duplicates);
    }
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  private debugLog(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[YamlParser] ${message}`, data || '');
    }
  }
}