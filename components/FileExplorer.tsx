import React, { useState, useRef } from 'react';
import { 
  Folder, File, ChevronRight, ChevronDown, Plus, MoreHorizontal, 
  Link, FolderInput, FileInput, FilePlus, FolderPlus, X, Globe, Smartphone, Server, ShoppingBag, Activity, FolderOpen 
} from 'lucide-react';
import { FileNode, Project } from '../types';

interface FileExplorerProps {
  files: FileNode[];
  activeFileId: string;
  openFiles: string[];
  project: Project;
  remoteDirName: string | null;
  deletedFiles?: FileNode[];
  onFileClick: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, isTrash?: boolean) => void;
  onConnectRemote: () => void;
  onAddFile: () => void;
  onAddFolder: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onInstallPackage: () => void;
  onRunScript: (script: string, cmd: string) => void;
  onEmptyTrash?: () => void;
  onMoveNode?: (nodeId: string, targetId: string) => void;
  onToggleDirectory?: (id: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files, activeFileId, openFiles, project, remoteDirName, deletedFiles = [],
  onFileClick, onContextMenu, onConnectRemote, onAddFile, onAddFolder,
  onUploadFile, onUploadFolder, onInstallPackage, onRunScript, onEmptyTrash,
  onMoveNode, onToggleDirectory
}) => {
  const [openEditorsOpen, setOpenEditorsOpen] = useState(true);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleNodeDragStart = (e: React.DragEvent, id: string) => {
      e.dataTransfer.setData('application/omni-node', id);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeDragOver = (e: React.DragEvent, id: string, type: 'file' | 'directory') => {
      e.preventDefault();
      if (type === 'directory') {
          setDragTargetId(id);
      }
  };

  const handleNodeDrop = (e: React.DragEvent, targetId: string, type: 'file' | 'directory') => {
      e.preventDefault();
      setDragTargetId(null);
      const nodeId = e.dataTransfer.getData('application/omni-node');
      if (nodeId && nodeId !== targetId && onMoveNode) {
          onMoveNode(nodeId, targetId);
      }
  };

  const findFileById = (nodes: FileNode[], id: string): FileNode | undefined => {
      for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
              const found = findFileById(node.children, id);
              if (found) return found;
          }
      }
      return undefined;
  };

  const getFileIcon = (name: string) => {
      if (name.endsWith('.tsx') || name.endsWith('.ts')) return <span className="text-blue-400 font-bold text-[10px]">TS</span>;
      if (name.endsWith('.css')) return <span className="text-cyan-400 font-bold text-[10px]">#</span>;
      if (name.endsWith('.json')) return <span className="text-yellow-400 font-bold text-[10px]">{'{ }'}</span>;
      if (name.endsWith('.html')) return <span className="text-orange-400 font-bold text-[10px]">&lt;&gt;</span>;
      return <File size={14} className="text-gray-500"/>;
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
      return nodes.map(node => (
          <div key={node.id}>
              <div 
                  className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-gray-800 border-l-2 ${activeFileId === node.id ? 'bg-gray-800 border-primary-500 text-white' : 'border-transparent text-gray-400'} ${dragTargetId === node.id ? 'bg-primary-900/30' : ''}`}
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                  onClick={() => node.type === 'directory' ? onToggleDirectory?.(node.id) : onFileClick(node.id)}
                  onContextMenu={(e) => onContextMenu(e, node.id)}
                  draggable
                  onDragStart={(e) => handleNodeDragStart(e, node.id)}
                  onDragOver={(e) => handleNodeDragOver(e, node.id, node.type)}
                  onDrop={(e) => handleNodeDrop(e, node.id, node.type)}
              >
                  <span className="shrink-0 flex items-center justify-center w-4">
                      {node.type === 'directory' && (
                          node.isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                      )}
                  </span>
                  
                  <span className="shrink-0 flex items-center gap-2">
                      {node.type === 'directory' ? 
                          (node.isOpen ? <FolderOpen size={14} className="text-yellow-400"/> : <Folder size={14} className="text-yellow-400"/>) 
                          : getFileIcon(node.name)
                      }
                  </span>
                  
                  <span className={`truncate text-sm ml-1 ${node.gitStatus === 'modified' ? 'text-yellow-200' : node.gitStatus === 'added' ? 'text-green-300' : ''}`}>
                      {node.name}
                  </span>
                  
                  {node.gitStatus && node.gitStatus !== 'unmodified' && (
                      <span className={`ml-auto text-[8px] font-bold px-1 rounded ${node.gitStatus === 'modified' ? 'text-yellow-500' : 'text-green-500'}`}>
                          {node.gitStatus === 'modified' ? 'M' : 'U'}
                      </span>
                  )}
              </div>
              {node.type === 'directory' && node.isOpen && node.children && (
                  renderFileTree(node.children, depth + 1)
              )}
          </div>
      ));
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 select-none">
        <input type="file" ref={fileInputRef} className="hidden" onChange={onUploadFile} multiple />
        <input type="file" ref={folderInputRef} className="hidden" onChange={onUploadFolder} {...({ webkitdirectory: "", directory: "" } as any)} />

        <div className="p-4 border-b border-gray-800 flex flex-col gap-3 bg-gray-900 sticky top-0 z-10">
            <div className="flex justify-between items-center font-semibold text-gray-200 text-sm">
                <span className="uppercase tracking-wider text-xs text-gray-500">Explorer</span>
                <div className="flex gap-1">
                    <button onClick={onConnectRemote} className={`text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700 ${remoteDirName ? 'text-green-500' : ''}`} title={remoteDirName ? `Connected: ${remoteDirName}` : "Connect Remote Folder"}><Link size={14} /></button>
                    <button onClick={() => folderInputRef.current?.click()} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700" title="Upload Folder"><FolderInput size={14} /></button>
                    <button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700" title="Upload File"><FileInput size={14} /></button>
                    <button onClick={onAddFile} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700" title="New File"><FilePlus size={14} /></button>
                    <button onClick={onAddFolder} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700" title="New Folder"><FolderPlus size={14} /></button>
                </div>
            </div>
            <div className="text-xs text-gray-600 font-mono truncate flex items-center justify-between">
                <span>{project.name}</span>
                {remoteDirName && <span className="text-[10px] text-green-500 flex items-center gap-1"><Link size={10} /> {remoteDirName}</span>}
            </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 font-mono text-sm">
            {/* Open Editors Section */}
            {openFiles.length > 0 && (
                <div className="mb-2">
                    <div className="px-4 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-white" onClick={() => setOpenEditorsOpen(!openEditorsOpen)}>
                        <span>Open Editors</span> {openEditorsOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    </div>
                    {openEditorsOpen && openFiles.map(fid => {
                        const file = findFileById(files, fid);
                        if (!file) return null;
                        return (
                            <div 
                                key={fid} 
                                className={`flex items-center justify-between px-4 py-1 cursor-pointer group hover:bg-gray-800 ${activeFileId === fid ? 'bg-gray-800 text-white border-l-2 border-primary-500 pl-[14px]' : 'text-gray-400 pl-4 border-l-2 border-transparent'}`}
                                onClick={() => onFileClick(fid)}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="shrink-0">{getFileIcon(file.name)}</span>
                                    <span className={`truncate ${file.gitStatus === 'modified' ? 'text-yellow-500' : ''}`}>{file.name}</span>
                                </div>
                                <span className="text-[10px] text-gray-600 group-hover:hidden">M</span>
                                <button className="hidden group-hover:block text-gray-500 hover:text-white p-0.5 rounded hover:bg-gray-700"><X size={12}/></button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Root Drop Target */}
            <div 
                onDragOver={(e) => handleNodeDragOver(e, 'root', 'directory')} 
                onDrop={(e) => handleNodeDrop(e, 'root', 'directory')}
                className={`min-h-[20px] ${dragTargetId === 'root' ? 'bg-primary-900/20' : ''}`}
            >
                {renderFileTree(files)}
            </div>
        </div>
    </div>
  );
};
