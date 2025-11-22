
import { useState, useEffect, useCallback } from 'react';
import { FileNode, Project, ProjectType } from '../types';
import { WEB_FILE_TREE, NATIVE_FILE_TREE, NODE_FILE_TREE } from '../constants';

export const useFileSystem = (project: Project | null) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [openFiles, setOpenFiles] = useState<string[]>(['1']);
  const [remoteDirName, setRemoteDirName] = useState<string | null>(null);

  // Initialize File System
  useEffect(() => {
    if (!project) return;
    
    const storageKey = `omni_files_${project.id}`;
    const savedFiles = localStorage.getItem(storageKey);
    
    const tabsKey = `omni_open_tabs_${project.id}`;
    const savedTabs = localStorage.getItem(tabsKey);
    
    if (savedTabs) {
       try {
           const parsed = JSON.parse(savedTabs);
           setOpenFiles(parsed.openFiles || ['1']);
           setActiveFileId(parsed.activeFileId || '1');
       } catch (e) { console.error("Failed to load tabs", e); }
    }
    
    if (savedFiles) {
       try {
           setFiles(JSON.parse(savedFiles));
       } catch (e) { console.error("Failed to load files", e); }
    } else {
       const isNative = project.type === ProjectType.REACT_NATIVE || project.type === ProjectType.IOS_APP || project.type === ProjectType.ANDROID_APP;
       const isBackend = project.type === ProjectType.NODE_API;
       
       if (isNative) setFiles(NATIVE_FILE_TREE);
       else if (isBackend) setFiles(NODE_FILE_TREE);
       else setFiles(WEB_FILE_TREE);
    }
  }, [project?.id, project?.type]);

  // Persistence
  useEffect(() => {
    if (!project) return;
    const storageKey = `omni_files_${project.id}`;
    const tabsKey = `omni_open_tabs_${project.id}`;
    
    localStorage.setItem(storageKey, JSON.stringify(files));
    localStorage.setItem(tabsKey, JSON.stringify({ openFiles, activeFileId }));
  }, [files, openFiles, activeFileId, project?.id]);

  const updateFileContent = useCallback((id: string, content: string) => {
      setFiles(prev => {
          const update = (nodes: FileNode[]): FileNode[] => nodes.map(node => {
              if (node.id === id) return { ...node, content, gitStatus: 'modified' };
              if (node.children) return { ...node, children: update(node.children) };
              return node;
          });
          return update(prev);
      });
  }, []);

  const findFileById = useCallback((nodes: FileNode[], id: string): FileNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findFileById(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }, []);

  // Recursive file finding for search/analysis
  const getAllFiles = useCallback((nodes: FileNode[], parentPath = ''): {node: FileNode, path: string}[] => {
    let results: {node: FileNode, path: string}[] = [];
    nodes.forEach(node => {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (node.type === 'file') results.push({ node, path: currentPath });
      if (node.children) results = results.concat(getAllFiles(node.children, currentPath));
    });
    return results;
  }, []);

  const handleFileClick = useCallback((id: string, isSplit: boolean, secondaryId: string | null, setSecondary: (id: string | null) => void) => {
      if (isSplit && secondaryId === null) {
          setSecondary(id);
      } else {
          setActiveFileId(id);
      }
      if (!openFiles.includes(id)) setOpenFiles(prev => [...prev, id]);
  }, [openFiles]);

  const handleCloseTab = useCallback((id: string, secondaryId: string | null, setSecondary: (id: string | null) => void) => {
      setOpenFiles(prev => {
          const newOpen = prev.filter(fid => fid !== id);
          if (activeFileId === id) setActiveFileId(newOpen[newOpen.length - 1] || '');
          return newOpen;
      });
      if (secondaryId === id) setSecondary(null);
  }, [activeFileId]);

  return {
      files,
      setFiles,
      activeFileId,
      setActiveFileId,
      openFiles,
      setOpenFiles,
      remoteDirName,
      setRemoteDirName,
      updateFileContent,
      findFileById,
      getAllFiles,
      handleFileClick,
      handleCloseTab
  };
};
