import { EditorView } from '@codemirror/view';
import { VariableMatch } from '@/types';

export class PlaceholderScanner {
  private static readonly VAR_REGEX = /\{\{\s*<\s*var\s+([a-zA-Z0-9_.]+)\s*>\s*\}\}/g;
  private compiledRegex: RegExp;
  private lastScanResults: Map<string, VariableMatch[]> = new Map();
  private lastScanHash: Map<string, string> = new Map();

  constructor() {
    this.compiledRegex = new RegExp(PlaceholderScanner.VAR_REGEX.source, 'g');
  }

  findAllInRange(view: EditorView, from: number, to: number): VariableMatch[] {
    const text = view.state.doc.sliceString(from, to);
    const cacheKey = `${from}-${to}`;
    const textHash = this.simpleHash(text);
    
    const cachedHash = this.lastScanHash.get(cacheKey);
    if (cachedHash === textHash) {
      const cached = this.lastScanResults.get(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const matches: VariableMatch[] = [];
    
    this.compiledRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = this.compiledRegex.exec(text)) !== null) {
      matches.push({
        from: from + match.index,
        to: from + match.index + match[0].length,
        key: match[1]
      });
    }
    
    this.lastScanResults.set(cacheKey, matches);
    this.lastScanHash.set(cacheKey, textHash);
    
    this.cleanupCache();
    
    return matches;
  }

  private simpleHash(text: string): string {
    let hash = 0;
    if (text.length === 0) return hash.toString();
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private cleanupCache(): void {
    if (this.lastScanResults.size > 10) {
      const keysToDelete = Array.from(this.lastScanResults.keys()).slice(0, 5);
      keysToDelete.forEach(key => {
        this.lastScanResults.delete(key);
        this.lastScanHash.delete(key);
      });
    }
  }

  findAll(text: string, offset: number = 0): VariableMatch[] {
    const matches: VariableMatch[] = [];
    
    this.compiledRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = this.compiledRegex.exec(text)) !== null) {
      matches.push({
        from: offset + match.index,
        to: offset + match.index + match[0].length,
        key: match[1]
      });
    }
    
    return matches;
  }

  matchAt(text: string, position: number): VariableMatch | null {
    const matches = this.findAll(text);
    
    for (const match of matches) {
      if (position >= match.from && position <= match.to) {
        return match;
      }
    }
    
    return null;
  }

  static isValidKey(key: string): boolean {
    return key.length > 0 && /^[a-zA-Z0-9_.]+$/.test(key) && !key.startsWith('.') && !key.endsWith('.') && !key.includes('..');
  }

  clearCache(): void {
    this.lastScanResults.clear();
    this.lastScanHash.clear();
  }
}