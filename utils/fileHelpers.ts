
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

export const upsertFileByPath = (nodes: FileNode[], pathParts: string[], newContent: string): FileNode[] => {
  const [currentPart, ...restParts] = pathParts;
  if (restParts.length === 0) {
     const existingFile = nodes.find(n => n.name === currentPart && n.type === 'file');
     if (existingFile) return nodes.map(n => n.id === existingFile.id ? { ...n, content: newContent, gitStatus: 'modified' } : n);
     else {
        const newFile: FileNode = { id: Date.now().toString() + Math.random(), name: currentPart, type: 'file', content: newContent, gitStatus: 'added' };
        return [...nodes, newFile];
     }
  }
  const existingDir = nodes.find(n => n.name === currentPart && n.type === 'directory');
  if (existingDir) {
     return nodes.map(n => n.id === existingDir.id ? { ...n, isOpen: true, children: upsertFileByPath(n.children || [], restParts, newContent) } : n);
  } else {
     const newDir: FileNode = { id: Date.now().toString() + Math.random(), name: currentPart, type: 'directory', children: [], isOpen: true };
     newDir.children = upsertFileByPath([], restParts, newContent);
     return [...nodes, newDir];
  }
};
