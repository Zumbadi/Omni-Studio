
import { useState, useEffect, useCallback } from 'react';
import { FileNode, Project, ProjectType } from '../types';
import { WEB_FILE_TREE, NATIVE_FILE_TREE, NODE_FILE_TREE } from '../constants';
import { findFileById, getAllFiles, upsertFileByPath } from '../utils/fileHelpers';

export const useFileSystem = (project: Project | null) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [deletedFiles, setDeletedFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [openFiles, setOpenFiles] = useState<string[]>(['1']);
  const [remoteDirName, setRemoteDirName] = useState<string | null>(null);

  // Initialize File System
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

    if (savedTrash) {
        try {
            setDeletedFiles(JSON.parse(savedTrash));
        } catch (e) { console.error("Failed to load trash", e); }
    }
  }, [project?.id, project?.type]);

  // Persistence
  useEffect(() => {
    if (!project) return;
    const storageKey = `omni_files_${project.id}`;
    const trashKey = `omni_trash_${project.id}`;
    const tabsKey = `omni_open_tabs_${project.id}`;
    
    localStorage.setItem(storageKey, JSON.stringify(files));
    localStorage.setItem(trashKey, JSON.stringify(deletedFiles));
    localStorage.setItem(tabsKey, JSON.stringify({ openFiles, activeFileId }));
  }, [files, deletedFiles, openFiles, activeFileId, project?.id]);

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

  const addFile = useCallback((path: string, content: string) => {
      const normalizedPath = path.replace(/^\//, ''); // Remove leading slash
      const pathParts = normalizedPath.split('/');
      setFiles(prev => upsertFileByPath(prev, pathParts, content, false));
  }, []);

  const addDirectory = useCallback((path: string) => {
      const normalizedPath = path.replace(/^\//, '');
      const pathParts = normalizedPath.split('/');
      setFiles(prev => upsertFileByPath(prev, pathParts, null, true));
  }, []);

  const deleteFile = useCallback((id: string) => {
      // Find node synchronously first
      const nodeToDelete = findFileById(files, id);
      
      if (nodeToDelete) {
          // Move to trash
          setDeletedFiles(prev => [nodeToDelete, ...prev]);
          
          // Remove from tree
          setFiles(prev => {
              const removeClean = (nodes: FileNode[]): FileNode[] => {
                  return nodes
                    .filter(n => n.id !== id)
                    .map(n => {
                        if (n.children) {
                            return { ...n, children: removeClean(n.children) };
                        }
                        return n;
                    });
              };
              return removeClean(prev);
          });

          // Close tab logic
          setOpenFiles(prev => {
              const newOpen = prev.filter(fid => fid !== id);
              // If active file was deleted, switch to another
              if (activeFileId === id && newOpen.length > 0) {
                  setActiveFileId(newOpen[newOpen.length - 1]);
              } else if (activeFileId === id) {
                  setActiveFileId('');
              }
              return newOpen;
          });
      }
  }, [files, activeFileId]);

  const restoreFile = useCallback((id: string) => {
      const fileToRestore = deletedFiles.find(f => f.id === id);
      if (fileToRestore) {
          setFiles(prev => [...prev, { ...fileToRestore, gitStatus: 'unmodified' }]); // Restore to root for simplicity
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
                      const copy: FileNode = {
                          ...node,
                          id: Date.now().toString() + Math.random(),
                          name: `${node.name}_copy`,
                          gitStatus: 'added'
                      };
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

  const addPackage = useCallback((name: string, isDev: boolean) => {
      setFiles(prev => {
          const updatePkg = (nodes: FileNode[]): FileNode[] => {
              return nodes.map(node => {
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
          };
          return updatePkg(prev);
      });
  }, []);

  const findFileByIdWrapper = useCallback((nodes: FileNode[], id: string) => findFileById(nodes, id), []);
  
  const getAllFilesWrapper = useCallback((nodes: FileNode[]) => getAllFiles(nodes), []);

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
      deletedFiles,
      activeFileId,
      setActiveFileId,
      openFiles,
      setOpenFiles,
      remoteDirName,
      setRemoteDirName,
      updateFileContent,
      addFile,
      addDirectory,
      addPackage,
      deleteFile,
      restoreFile,
      permanentlyDeleteFile,
      emptyTrash,
      renameFile,
      duplicateFile,
      findFileById: findFileByIdWrapper,
      getAllFiles: getAllFilesWrapper,
      handleFileClick,
      handleCloseTab
  };
};
