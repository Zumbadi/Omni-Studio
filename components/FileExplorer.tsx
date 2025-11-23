
import React, { useState, useRef } from 'react';
import { Folder, File as FileIcon, ChevronRight, ChevronDown, MoreVertical, Link, FolderInput, FileInput, FilePlus, FolderPlus, Package, Plus, Play, UploadCloud, Trash2, FileCode, FileJson, Image as ImageIcon, FileType } from 'lucide-react';
import { FileNode, Project } from '../types';

interface FileExplorerProps {
  files: FileNode[];
  activeFileId: string;
  project: Project;
  remoteDirName: string | null;
  deletedFiles?: FileNode[];
  onFileClick: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, isTrash?: boolean) => void;
  onConnectRemote: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddFile: () => void;
  onAddFolder: () => void;
  onInstallPackage: () => void;
  onRunScript?: (script: string, cmd: string) => void;
  onEmptyTrash?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files, activeFileId, project, remoteDirName, deletedFiles = [],
  onFileClick, onContextMenu, onConnectRemote,
  onUploadFile, onUploadFolder, onAddFile, onAddFolder, onInstallPackage, onRunScript, onEmptyTrash
}) => {
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [scriptsOpen, setScriptsOpen] = useState(true);
  const [depsOpen, setDepsOpen] = useState(true);
  const [trashOpen, setTrashOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const findPackageJson = (nodes: FileNode[]): string | undefined => {
      for (const node of nodes) {
          if (node.name === 'package.json' && node.type === 'file') return node.content;
          if (node.children) {
              const found = findPackageJson(node.children);
              if (found) return found;
          }
      }
      return undefined;
  };
  
  const packageJsonContent = findPackageJson(files);
  let scripts = {};
  let dependencies = {};
  
  try {
      if (packageJsonContent) {
          const json = JSON.parse(packageJsonContent);
          scripts = json.scripts || {};
          dependencies = json.dependencies || {};
      }
  } catch (e) {}

  const getFileIcon = (name: string) => {
      if (name.endsWith('.tsx') || name.endsWith('.jsx')) return <FileCode size={14} className="text-blue-400"/>;
      if (name.endsWith('.ts') || name.endsWith('.js')) return <FileCode size={14} className="text-yellow-400"/>;
      if (name.endsWith('.css') || name.endsWith('.scss')) return <FileType size={14} className="text-cyan-400"/>;
      if (name.endsWith('.json')) return <FileJson size={14} className="text-orange-400"/>;
      if (name.endsWith('.html')) return <FileType size={14} className="text-red-400"/>;
      if (name.match(/\.(png|jpg|jpeg|svg|gif)$/)) return <ImageIcon size={14} className="text-purple-400"/>;
      if (name.endsWith('.md')) return <FileIcon size={14} className="text-gray-300"/>;
      return <FileIcon size={14} className="text-gray-500"/>;
  };

  const renderFileTree = (nodes: FileNode[], depth = 0, isTrash = false) => {
    return nodes.map(node => (
      <div key={node.id}>
        <div 
          className={`flex items-center justify-between px-4 py-1 cursor-pointer text-sm hover:bg-gray-800 transition-colors border-l-2 group relative
            ${node.id === activeFileId ? 'bg-gray-800 text-white border-primary-500' : 'text-gray-400 border-transparent'}
            ${isTrash ? 'opacity-75' : ''}
          `}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
          onClick={() => !isTrash && node.type === 'file' && onFileClick(node.id)}
          onContextMenu={(e) => onContextMenu(e, node.id, isTrash)}
          onMouseEnter={() => setHoveredFileId(node.id)}
          onMouseLeave={() => setHoveredFileId(null)}
        >
          <div className="flex items-center overflow-hidden">
              <span className="mr-2 opacity-70 flex-shrink-0 relative">
                {node.type === 'directory' ? 
                    (node.isOpen ? <ChevronDown size={14} className="text-gray-300"/> : <ChevronRight size={14} className="text-gray-500"/>) 
                    : getFileIcon(node.name)
                }
                {!isTrash && node.gitStatus === 'modified' && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>}
                {!isTrash && node.gitStatus === 'added' && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full"></div>}
              </span>
              <span className={`truncate ${!isTrash && node.gitStatus === 'modified' ? 'text-yellow-400' : !isTrash && node.gitStatus === 'added' ? 'text-green-400' : isTrash ? 'line-through text-gray-500' : ''}`}>{node.name}</span>
          </div>
          {(hoveredFileId === node.id && node.id !== 'root' && node.id !== '1') && (
             <button onClick={(e) => { e.stopPropagation(); onContextMenu(e, node.id, isTrash); }} className="text-gray-600 hover:text-white p-1"><MoreVertical size={12} /></button>
          )}
        </div>
        {node.children && node.isOpen && renderFileTree(node.children, depth + 1, isTrash)}
      </div>
    ));
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
  };

  const handleDragLeave = () => {
      setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
          if (fileInputRef.current) {
              fileInputRef.current.files = files;
              const event = new Event('change', { bubbles: true });
              fileInputRef.current.dispatchEvent(event);
          }
      }
  };

  return (
    <div 
        className="flex flex-col h-full relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
        <input type="file" ref={fileInputRef} className="hidden" onChange={onUploadFile} multiple />
        <input type="file" ref={folderInputRef} className="hidden" onChange={onUploadFolder} {...{ webkitdirectory: "" } as any} />

        {isDragOver && (
            <div className="absolute inset-0 bg-primary-900/80 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm pointer-events-none">
                <UploadCloud size={48} className="mb-2 animate-bounce"/>
                <span className="font-bold">Drop files to upload</span>
            </div>
        )}

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
        <div className="flex-1 overflow-y-auto py-2 font-mono text-sm">{renderFileTree(files)}</div>
        
        {/* Trash Bin */}
        {deletedFiles.length > 0 && (
            <div className="border-t border-gray-800 bg-gray-900">
                <div className="px-4 py-2 text-xs font-bold text-red-500/70 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-red-400" onClick={() => setTrashOpen(!trashOpen)}>
                    <span className="flex items-center gap-2"><Trash2 size={12}/> Trash ({deletedFiles.length})</span> 
                    {trashOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                </div>
                {trashOpen && (
                    <div className="pb-2">
                        <div className="px-4 mb-2">
                            <button onClick={onEmptyTrash} className="text-[10px] text-red-400 hover:text-red-300 hover:underline w-full text-left">Empty Trash</button>
                        </div>
                        {renderFileTree(deletedFiles, 0, true)}
                    </div>
                )}
            </div>
        )}

        {/* NPM Scripts */}
        <div className="border-t border-gray-800 bg-gray-900">
            <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-white" onClick={() => setScriptsOpen(!scriptsOpen)}>
                <span>NPM Scripts</span> {scriptsOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </div>
            {scriptsOpen && (
                <div className="p-2 space-y-1">
                    {Object.entries(scripts).length === 0 && <div className="px-2 text-xs text-gray-600 italic">No scripts found</div>}
                    {Object.entries(scripts).map(([name, cmd]) => (
                        <div key={name} className="flex items-center justify-between px-2 py-1 hover:bg-gray-800 rounded group cursor-pointer" onClick={() => onRunScript?.(name, cmd as string)}>
                            <div className="flex items-center gap-2 text-xs text-gray-300">
                                <Play size={10} className="text-green-500"/> <span className="font-semibold">{name}</span>
                            </div>
                            <div className="text-[10px] text-gray-600 font-mono truncate max-w-[100px]" title={cmd as string}>{cmd as string}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Dependencies */}
        <div className="border-t border-gray-800 bg-gray-900">
            <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-white" onClick={() => setDepsOpen(!depsOpen)}>
                <span>Dependencies</span> {depsOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </div>
            {depsOpen && (
                <div className="p-2 space-y-1">
                    {Object.entries(dependencies).length === 0 && <div className="px-2 text-xs text-gray-600 italic">No dependencies</div>}
                    {Object.entries(dependencies).map(([name, version]) => (
                        <div key={name} className="flex justify-between items-center px-2 py-1 hover:bg-gray-800 rounded text-xs text-gray-300"><div className="flex items-center gap-2"><Package size={12} className="text-primary-400"/><span>{name}</span></div><span className="text-gray-600 font-mono">{version as string}</span></div>
                    ))}
                    <button onClick={onInstallPackage} className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-primary-400 hover:text-white hover:bg-gray-800 py-1 rounded border border-transparent hover:border-gray-700 border-dashed"><Plus size={12} /> Add Package</button>
                </div>
            )}
        </div>
    </div>
  );
};
