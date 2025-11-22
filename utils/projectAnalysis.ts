
import { FileNode } from '../types';

export interface DepNode {
  id: string;
  name: string;
  path: string;
  imports: string[];
  level: number;
}

export const analyzeDependencies = (files: FileNode[]): DepNode[] => {
  const nodes: DepNode[] = [];
  
  // 1. Flatten and parse imports
  const traverse = (n: FileNode[], path: string) => {
    n.forEach(node => {
      if (node.type === 'file' && (node.name.endsWith('.tsx') || node.name.endsWith('.ts') || node.name.endsWith('.js') || node.name.endsWith('.jsx'))) {
        const content = node.content || '';
        const imports: string[] = [];
        
        // Regex to match static imports
        const regex = /from\s+['"](.+?)['"]/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
           // Normalize import path to match file names roughly
           const importPath = match[1];
           const importName = importPath.split('/').pop() || '';
           if (importName && !importName.startsWith('.')) continue; // Skip libraries like 'react'
           
           // Remove extension if present, or we'll match loosely later
           imports.push(importName.replace(/\.(tsx|ts|js|jsx)/, ''));
        }
        nodes.push({ id: node.id, name: node.name, path, imports, level: 1 });
      }
      if (node.children) traverse(node.children, path + node.name + '/');
    });
  };
  traverse(files, '');

  // 2. Assign Levels for Visualization
  // Level 0: App root
  // Level 1: Components / Pages
  // Level 2: Utils / Hooks / Services
  nodes.forEach(node => {
     if (node.name === 'App.tsx' || node.name === 'index.tsx' || node.name === 'index.js') {
         node.level = 0;
     } else if (node.name.includes('Service') || node.name.includes('utils') || node.name.includes('constants') || node.name.includes('types')) {
         node.level = 2;
     } else {
         node.level = 1;
     }
  });

  return nodes;
};

export const findRelevantContext = (files: FileNode[], prompt: string): string => {
    const keywords = prompt.toLowerCase().split(/[^a-zA-Z0-9]/).filter(k => k.length > 3);
    let context = "";
    
    const traverse = (n: FileNode[]) => {
        n.forEach(node => {
            if (node.type === 'file' && node.content) {
                // Check if file name matches
                const nameMatch = keywords.some(k => node.name.toLowerCase().includes(k));
                // Check if content defines something relevant (e.g. matching function name)
                // Simple heuristic: if prompt contains "Button", grab Button.tsx content
                if (nameMatch) {
                    context += `\n\n[File: ${node.name}]\n\`\`\`tsx\n${node.content}\n\`\`\``;
                }
            }
            if (node.children) traverse(node.children);
        });
    };
    traverse(files);
    
    return context;
};
