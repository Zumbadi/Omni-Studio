
import { useState, useEffect, useCallback, useRef } from 'react';
import { FileNode, Project, ProjectType } from '../types';
import { WEB_FILE_TREE, NATIVE_FILE_TREE, NODE_FILE_TREE, IOS_FILE_TREE, ANDROID_FILE_TREE } from '../constants';
import { findFileById, getAllFiles, upsertFileByPath } from '../utils/fileHelpers';
import { useDebounce } from './useDebounce';

export const useFileSystem = (project: Project | null) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const filesRef = useRef<FileNode[]>([]);
  
  const [deletedFiles, setDeletedFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [openFiles, setOpenFiles] = useState<string[]>(['1']);
  const [remoteDirName, setRemoteDirName] = useState<string | null>(null);

  useEffect(() => {
      filesRef.current = files;
  }, [files]);

  // Initialize
  useEffect(() => {
    if (!project) return;
    const storageKey = `omni_files_${project.id}`;
    const savedFiles = localStorage.getItem(storageKey);
    const trashKey = `omni_trash_${project.id}`;
    const savedTrash = localStorage.getItem(trashKey);
    const tabsKey = `omni_open_tabs_${project.id}`;
    const savedTabs = localStorage.getItem(tabsKey);
    
    if (savedTabs) {
       try {
           const parsed = JSON.parse(savedTabs);
           setOpenFiles(parsed.openFiles || ['1']);
           setActiveFileId(parsed.activeFileId || '1');
       } catch (e) {}
    }
    
    if (savedFiles) {
       try {
           setFiles(JSON.parse(savedFiles));
       } catch (e) {}
    } else {
       // Select template based on project type
       let template = WEB_FILE_TREE;
       if (project.type === ProjectType.REACT_NATIVE) template = NATIVE_FILE_TREE;
       else if (project.type === ProjectType.NODE_API) template = NODE_FILE_TREE;
       else if (project.type === ProjectType.IOS_APP) template = IOS_FILE_TREE;
       else if (project.type === ProjectType.ANDROID_APP) template = ANDROID_FILE_TREE;
       
       setFiles(template);
    }

    if (savedTrash) {
        try { setDeletedFiles(JSON.parse(savedTrash)); } catch (e) {}
    }
  }, [project?.id, project?.type]);

  // Debounced Persistence to prevent main thread blocking on every keystroke
  const debouncedFiles = useDebounce(files, 2000);
  const debouncedTrash = useDebounce(deletedFiles, 2000);
  const debouncedTabs = useDebounce({ openFiles, activeFileId }, 2000);

  useEffect(() => {
    if (!project) return;
    localStorage.setItem(`omni_files_${project.id}`, JSON.stringify(debouncedFiles));
  }, [debouncedFiles, project?.id]);

  useEffect(() => {
    if (!project) return;
    localStorage.setItem(`omni_trash_${project.id}`, JSON.stringify(debouncedTrash));
  }, [debouncedTrash, project?.id]);

  useEffect(() => {
    if (!project) return;
    localStorage.setItem(`omni_open_tabs_${project.id}`, JSON.stringify(debouncedTabs));
  }, [debouncedTabs, project?.id]);

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

  const replaceTextInProject = useCallback((search: string, replace: string) => {
      if (!search) return 0;
      let count = 0;
      setFiles(prev => {
          const update = (nodes: FileNode[]): FileNode[] => nodes.map(node => {
              if (node.type === 'file' && node.content && node.content.includes(search)) {
                  const newContent = node.content.split(search).join(replace);
                  if (newContent !== node.content) {
                      count++;
                      return { ...node, content: newContent, gitStatus: 'modified' };
                  }
              }
              if (node.children) return { ...node, children: update(node.children) };
              return node;
          });
          return update(prev);
      });
      return count;
  }, []);

  const addFile = useCallback((path: string, content: string) => {
      const normalizedPath = path.replace(/^\//, '');
      const pathParts = normalizedPath.split('/');
      setFiles(prev => upsertFileByPath(prev, pathParts, content, false));
  }, []);

  const addDirectory = useCallback((path: string) => {
      const normalizedPath = path.replace(/^\//, '');
      const pathParts = normalizedPath.split('/');
      setFiles(prev => upsertFileByPath(prev, pathParts, null, true));
  }, []);

  const deleteFile = useCallback((id: string) => {
      const nodeToDelete = findFileById(filesRef.current, id);
      if (nodeToDelete) {
          setDeletedFiles(prev => [nodeToDelete, ...prev]);
          setFiles(prev => {
              const removeClean = (nodes: FileNode[]): FileNode[] => {
                  return nodes.filter(n => n.id !== id).map(n => n.children ? { ...n, children: removeClean(n.children) } : n);
              };
              return removeClean(prev);
          });
          setOpenFiles(prev => {
              const newOpen = prev.filter(fid => fid !== id);
              if (activeFileId === id) setActiveFileId(newOpen[newOpen.length - 1] || '');
              return newOpen;
          });
      }
  }, [activeFileId]);

  const restoreFile = useCallback((id: string) => {
      const fileToRestore = deletedFiles.find(f => f.id === id);
      if (fileToRestore) {
          setFiles(prev => [...prev, { ...fileToRestore, gitStatus: 'unmodified' }]); 
          setDeletedFiles(prev => prev.filter(f => f.id !== id));
      }
  }, [deletedFiles]);

  const permanentlyDeleteFile = useCallback((id: string) => {
      setDeletedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const emptyTrash = useCallback(() => {
      setDeletedFiles([]);
  }, []);

  const renameFile = useCallback((id: string, newName: string) => {
      setFiles(prev => {
          const rename = (nodes: FileNode[]): FileNode[] => nodes.map(node => {
              if (node.id === id) return { ...node, name: newName, gitStatus: 'modified' };
              if (node.children) return { ...node, children: rename(node.children) };
              return node;
          });
          return rename(prev);
      });
  }, []);

  const duplicateFile = useCallback((id: string) => {
      setFiles(prev => {
          const duplicate = (nodes: FileNode[]): FileNode[] => {
              let newNodes = [...nodes];
              for (const node of nodes) {
                  if (node.id === id) {
                      const copy: FileNode = { ...node, id: Date.now() + Math.random().toString(), name: `${node.name}_copy`, gitStatus: 'added' };
                      newNodes.push(copy);
                  }
                  if (node.children) {
                      const newChildren = duplicate(node.children);
                      if (newChildren !== node.children) {
                          const index = newNodes.findIndex(n => n.id === node.id);
                          newNodes[index] = { ...node, children: newChildren };
                      }
                  }
              }
              return newNodes;
          };
          return duplicate(prev);
      });
  }, []);

  const moveNode = useCallback((nodeId: string, targetDirId: string) => {
      if (nodeId === targetDirId) return;

      setFiles(prev => {
          let nodeToMove: FileNode | null = null;

          // Check circular
          const isCircular = (parentId: string, nodes: FileNode[]): boolean => {
             for(const node of nodes) {
                 if(node.id === targetDirId) return true;
                 if(node.children) {
                     if(isCircular(parentId, node.children)) return true;
                 }
             }
             return false;
          };

          // 1. Find and remove
          const removeFromTree = (nodes: FileNode[]): FileNode[] => {
              const filtered: FileNode[] = [];
              for (const node of nodes) {
                  if (node.id === nodeId) {
                      nodeToMove = node;
                      if(node.children && isCircular(node.id, node.children)) {
                          console.warn("Cannot move folder into its own child");
                          return nodes;
                      }
                      continue;
                  }
                  if (node.children) {
                      const newChildren = removeFromTree(node.children);
                      filtered.push({ ...node, children: newChildren });
                  } else {
                      filtered.push(node);
                  }
              }
              return filtered;
          };
          
          const treeWithoutNode = removeFromTree(prev);
          if (!nodeToMove || treeWithoutNode === prev) return prev; 

          // 2. Add to new location
          const addToTree = (nodes: FileNode[]): FileNode[] => {
              if (targetDirId === 'root') {
                 return [...nodes, nodeToMove!];
              }
              
              return nodes.map(node => {
                  if (node.id === targetDirId && node.type === 'directory') {
                      return { ...node, children: [...(node.children || []), nodeToMove!], isOpen: true, gitStatus: 'modified' };
                  }
                  if (node.children) {
                      return { ...node, children: addToTree(node.children) };
                  }
                  return node;
              });
          };

          return addToTree(treeWithoutNode);
      });
  }, []);

  const toggleFilePin = useCallback((id: string) => {
      setFiles(prev => {
          const toggle = (nodes: FileNode[]): FileNode[] => nodes.map(node => {
              if (node.id === id) return { ...node, isPinned: !node.isPinned };
              if (node.children) return { ...node, children: toggle(node.children) };
              return node;
          });
          return toggle(prev);
      });
  }, []);
  
  const toggleDirectory = useCallback((id: string) => {
      setFiles(prev => {
          const toggle = (nodes: FileNode[]): FileNode[] => nodes.map(node => {
              if (node.id === id && node.type === 'directory') {
                  return { ...node, isOpen: !node.isOpen };
              }
              if (node.children) return { ...node, children: toggle(node.children) };
              return node;
          });
          return toggle(prev);
      });
  }, []);

  const addPackage = useCallback((name: string, isDev: boolean) => {
      setFiles(prev => {
          const updatePkg = (nodes: FileNode[]): FileNode[] => nodes.map(node => {
              if (node.name === 'package.json' && node.type === 'file') {
                  try {
                      const json = JSON.parse(node.content || '{}');
                      const key = isDev ? 'devDependencies' : 'dependencies';
                      json[key] = { ...json[key], [name]: 'latest' };
                      return { ...node, content: JSON.stringify(json, null, 2), gitStatus: 'modified' };
                  } catch (e) { return node; }
              }
              if (node.children) return { ...node, children: updatePkg(node.children) };
              return node;
          });
          return updatePkg(prev);
      });
  }, []);

  // Tab Management
  const reorderOpenFiles = useCallback((newOrder: string[]) => {
      setOpenFiles(newOrder);
  }, []);

  const closeOtherTabs = useCallback((keepId: string) => {
      setOpenFiles([keepId]);
      setActiveFileId(keepId);
  }, []);

  const findFileByIdWrapper = useCallback((nodes: FileNode[], id: string) => findFileById(nodes, id), []);
  const getAllFilesWrapper = useCallback((nodes: FileNode[]) => getAllFiles(nodes), []);

  const handleFileClick = useCallback((id: string, isSplit: boolean, secondaryId: string | null, setSecondary: (id: string | null) => void) => {
      if (isSplit && secondaryId === null) setSecondary(id);
      else setActiveFileId(id);
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
      filesRef,
      setFiles,
      deletedFiles,
      activeFileId,
      setActiveFileId,
      openFiles,
      setOpenFiles,
      remoteDirName,
      setRemoteDirName,
      updateFileContent,
      replaceTextInProject,
      addFile,
      addDirectory,
      addPackage,
      deleteFile,
      restoreFile,
      permanentlyDeleteFile,
      emptyTrash,
      renameFile,
      duplicateFile,
      moveNode,
      toggleFilePin,
      toggleDirectory,
      reorderOpenFiles,
      closeOtherTabs,
      findFileById: findFileByIdWrapper,
      getAllFiles: getAllFilesWrapper,
      handleFileClick,
      handleCloseTab
  };
};
