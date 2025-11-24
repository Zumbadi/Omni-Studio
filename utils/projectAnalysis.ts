
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
                // 1. Check for keyword match
                const nameMatch = keywords.some(k => node.name.toLowerCase().includes(k));
                
                // 2. Check for Pinned Status
                const isPinned = node.isPinned;

                if (nameMatch || isPinned) {
                    const label = isPinned ? `[File: ${node.name} (PINNED)]` : `[File: ${node.name}]`;
                    context += `\n\n${label}\n\`\`\`tsx\n${node.content}\n\`\`\``;
                }
            }
            if (node.children) traverse(node.children);
        });
    };
    traverse(files);
    
    // Always include package.json if found (Config Awareness)
    // This ensures agents know dependencies even if not explicitly asked
    if (!context.includes('package.json')) {
        const traversePkg = (n: FileNode[]) => {
            for (const node of n) {
                if (node.name === 'package.json' && node.content) {
                    context += `\n\n[Config: package.json]\n\`\`\`json\n${node.content}\n\`\`\``;
                    return;
                }
                if (node.children) traversePkg(node.children);
            }
        };
        traversePkg(files);
    }
    
    return context;
};

export const findDependents = (targetFileName: string, allFiles: {node: FileNode, path: string}[]): {node: FileNode, path: string}[] => {
    const targetNameNoExt = targetFileName.split('.')[0];
    
    return allFiles.filter(f => {
        if (!f.node.content) return false;
        if (f.node.name === targetFileName) return false;
        
        const regex = new RegExp(`from\\s+['"].*${targetNameNoExt}['"]`, 'i');
        return regex.test(f.node.content);
    });
};

export const getRelatedFileContent = (targetFileContent: string, allFiles: {node: FileNode, path: string}[]): string => {
    let context = "";
    const seenFiles = new Set<string>();
    
    // Parse imports: import ... from './path/to/File';
    const regex = /from\s+['"](.+?)['"]/g;
    let match;
    
    while ((match = regex.exec(targetFileContent)) !== null) {
        const importPath = match[1];
        
        // Skip node_modules
        if (!importPath.startsWith('.')) continue;

        // Extract filename from path
        const importName = importPath.split('/').pop()?.replace(/\.(tsx|ts|js|jsx)/, '') || '';
        
        // Find matching file in project (Loose match by name)
        const relatedFile = allFiles.find(f => {
            const fname = f.node.name.split('.')[0];
            return fname === importName && f.node.content;
        });

        if (relatedFile && relatedFile.node.content && !seenFiles.has(relatedFile.node.name)) {
            seenFiles.add(relatedFile.node.name);
            // Truncate very large files to save context window
            const content = relatedFile.node.content.length > 2000 
                ? relatedFile.node.content.substring(0, 2000) + "\n... (truncated)" 
                : relatedFile.node.content;
                
            context += `\n\n[Context from ${relatedFile.node.name}]:\n\`\`\`typescript\n${content}\n\`\`\``;
        }
    }
    return context;
};
