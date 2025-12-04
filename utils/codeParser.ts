
import { FileNode } from '../types';
import { getAllFiles } from './fileHelpers';

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'interface' | 'variable' | 'component';
  fileId: string;
  fileName: string;
  line: number;
  content: string;
}

export const extractSymbols = (files: FileNode[]): CodeSymbol[] => {
  const symbols: CodeSymbol[] = [];
  const allFiles = getAllFiles(files);

  allFiles.forEach(({ node }) => {
    if (!node.content || node.type !== 'file') return;
    
    // Split lines for line number tracking
    const lines = node.content.split('\n');
    
    // Regex patterns for different symbols
    const patterns = [
      { regex: /export\s+(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/g, type: 'function' },
      { regex: /export\s+(?:default\s+)?class\s+([a-zA-Z0-9_]+)/g, type: 'class' },
      { regex: /export\s+interface\s+([a-zA-Z0-9_]+)/g, type: 'interface' },
      { regex: /export\s+type\s+([a-zA-Z0-9_]+)/g, type: 'interface' }, // Treat types as interfaces for simplicity
      { regex: /export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*(?:\([^)]*\)|async\s*\([^)]*\))\s*=>/g, type: 'function' }, // Arrow functions
      { regex: /export\s+const\s+([a-zA-Z0-9_]+)\s*=/g, type: 'variable' },
    ];

    // Simple heuristic for React Components: PascalCase function/const that returns JSX (not perfect but good enough for MVP)
    const isComponent = (name: string) => /^[A-Z]/.test(name);

    patterns.forEach(({ regex, type }) => {
      let match;
      // Reset regex state
      regex.lastIndex = 0;
      
      // Iterate over matches in the full content string
      while ((match = regex.exec(node.content!)) !== null) {
        const name = match[1];
        
        // Find line number by counting newlines up to the match index
        const line = node.content!.substring(0, match.index).split('\n').length;
        
        // Extract a snippet (naive block extraction)
        let snippet = '';
        const startLineIdx = line - 1;
        let braceCount = 0;
        let started = false;
        
        // Try to capture the block
        for (let i = startLineIdx; i < lines.length; i++) {
            const l = lines[i];
            snippet += l + '\n';
            braceCount += (l.match(/{/g) || []).length;
            braceCount -= (l.match(/}/g) || []).length;
            
            if (l.includes('{')) started = true;
            
            // Break if braces balanced (and we actually started)
            // Limit snippet length to avoid huge tokens
            if (started && braceCount === 0) break;
            if (snippet.length > 1000) {
                snippet += '\n...';
                break;
            }
        }

        symbols.push({
          name,
          type: (type === 'function' || type === 'variable') && isComponent(name) ? 'component' : type as any,
          fileId: node.id,
          fileName: node.name,
          line,
          content: snippet
        });
      }
    });
  });

  return symbols;
};
