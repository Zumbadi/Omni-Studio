
import { FileNode } from '../types';

export const findFileById = (nodes: FileNode[], id: string): FileNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileById(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

export const getAllFiles = (nodes: FileNode[], parentPath = ''): {node: FileNode, path: string}[] => {
  let results: {node: FileNode, path: string}[] = [];
  nodes.forEach(node => {
    const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    if (node.type === 'file') results.push({ node, path: currentPath });
    if (node.children) results = results.concat(getAllFiles(node.children, currentPath));
  });
  return results;
};

export const upsertFileByPath = (nodes: FileNode[], pathParts: string[], newContent: string | null, isDirectory = false): FileNode[] => {
  const [currentPart, ...restParts] = pathParts;
  
  // Base case: We are at the target
  if (restParts.length === 0) {
     const existingNode = nodes.find(n => n.name === currentPart);
     
     if (existingNode) {
         // Update existing file content
         if (existingNode.type === 'file' && !isDirectory) {
             return nodes.map(n => n.id === existingNode.id ? { ...n, content: newContent || '', gitStatus: 'modified' } : n);
         }
         return nodes; // Directory or file exists, do nothing
     } else {
        // Create new node
        const newNode: FileNode = { 
            id: Date.now().toString() + Math.random(), 
            name: currentPart, 
            type: isDirectory ? 'directory' : 'file', 
            content: isDirectory ? undefined : (newContent || ''), 
            gitStatus: 'added',
            children: isDirectory ? [] : undefined,
            isOpen: isDirectory
        };
        return [...nodes, newNode];
     }
  }

  // Recursive step: Go deeper
  const existingDir = nodes.find(n => n.name === currentPart && n.type === 'directory');
  if (existingDir) {
     return nodes.map(n => n.id === existingDir.id ? { ...n, isOpen: true, children: upsertFileByPath(n.children || [], restParts, newContent, isDirectory) } : n);
  } else {
     // Create intermediate directory
     const newDir: FileNode = { id: Date.now().toString() + Math.random(), name: currentPart, type: 'directory', children: [], isOpen: true };
     newDir.children = upsertFileByPath([], restParts, newContent, isDirectory);
     return [...nodes, newDir];
  }
};
