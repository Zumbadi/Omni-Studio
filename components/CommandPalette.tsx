
import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, File, ChevronRight, Settings, Github, Moon, Sun, Monitor, Terminal, Download, FilePlus, FolderPlus, BrainCircuit, Book } from 'lucide-react';
import { FileNode, KnowledgeDoc } from '../types';
import { getAllFiles } from '../utils/fileHelpers';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileNode[];
  knowledgeDocs?: KnowledgeDoc[];
  onOpenFile: (id: string) => void;
  onRunCommand: (cmd: string) => void;
  onOpenDoc?: (id: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, files, knowledgeDocs = [], onOpenFile, onRunCommand, onOpenDoc }) => {
  const [input, setInput] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const allFiles = getAllFiles(files);
  
  const commands = [
      { id: 'cmd-1', label: 'Toggle Sidebar', icon: <Monitor size={14}/>, action: () => onRunCommand('toggle_sidebar') },
      { id: 'cmd-2', label: 'Toggle Terminal', icon: <Terminal size={14}/>, action: () => onRunCommand('toggle_terminal') },
      { id: 'cmd-3', label: 'Git Commit', icon: <Github size={14}/>, action: () => onRunCommand('git_commit') },
      { id: 'cmd-4', label: 'Settings', icon: <Settings size={14}/>, action: () => onRunCommand('open_settings') },
      { id: 'cmd-5', label: 'Download Project', icon: <Download size={14}/>, action: () => onRunCommand('export_project') },
      { id: 'cmd-6', label: 'Toggle Theme', icon: <Sun size={14}/>, action: () => onRunCommand('toggle_theme') },
      { id: 'cmd-7', label: 'New File', icon: <FilePlus size={14}/>, action: () => onRunCommand('create_file') },
      { id: 'cmd-8', label: 'New Folder', icon: <FolderPlus size={14}/>, action: () => onRunCommand('create_folder') },
  ];

  const filteredFiles = allFiles.filter(f => f.node.name.toLowerCase().includes(input.toLowerCase())).slice(0, 5);
  const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(input.toLowerCase()));
  const filteredDocs = knowledgeDocs.filter(d => d.title.toLowerCase().includes(input.toLowerCase())).slice(0, 3);
  
  const combinedResults = [
      ...filteredFiles.map(f => ({ type: 'file', ...f })),
      ...filteredDocs.map(d => ({ type: 'doc', ...d })),
      ...filteredCommands.map(c => ({ type: 'command', ...c }))
  ];

  useEffect(() => {
      if (isOpen) {
          setTimeout(() => inputRef.current?.focus(), 50);
          setInput('');
          setActiveIndex(0);
      }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex(prev => (prev + 1) % combinedResults.length);
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex(prev => (prev - 1 + combinedResults.length) % combinedResults.length);
      } else if (e.key === 'Enter') {
          e.preventDefault();
          const selected = combinedResults[activeIndex];
          if (selected) {
              if (selected.type === 'file') onOpenFile((selected as any).node.id);
              else if (selected.type === 'doc') onOpenDoc?.((selected as any).id);
              else (selected as any).action();
              onClose();
          }
      } else if (e.key === 'Escape') {
          onClose();
      }
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex items-center px-4 py-3 border-b border-gray-800 gap-3">
                  <Search size={18} className="text-gray-500" />
                  <input 
                    ref={inputRef}
                    type="text" 
                    className="flex-1 bg-transparent text-lg text-white placeholder-gray-600 focus:outline-none" 
                    placeholder="Search files, docs, or commands..." 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-500 border border-gray-700">ESC</div>
              </div>
              
              <div className="max-h-[400px] overflow-y-auto py-2">
                  {combinedResults.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm">No results found.</div>
                  )}
                  
                  {combinedResults.map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                            if (item.type === 'file') onOpenFile((item as any).node.id);
                            else if (item.type === 'doc') onOpenDoc?.((item as any).id);
                            else (item as any).action();
                            onClose();
                        }}
                        className={`px-4 py-2 flex items-center justify-between cursor-pointer ${idx === activeIndex ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                      >
                          <div className="flex items-center gap-3">
                              {item.type === 'file' && <File size={16} className={idx === activeIndex ? 'text-white' : 'text-gray-500'} />}
                              {item.type === 'doc' && <BrainCircuit size={16} className={idx === activeIndex ? 'text-white' : 'text-orange-500'} />}
                              {item.type === 'command' && (item as any).icon}
                              
                              <div>
                                  <div className="text-sm font-medium">{(item as any).node?.name || (item as any).title || (item as any).label}</div>
                                  {item.type === 'file' && <div className={`text-[10px] ${idx === activeIndex ? 'text-blue-200' : 'text-gray-600'}`}>{(item as any).path}</div>}
                                  {item.type === 'doc' && <div className={`text-[10px] ${idx === activeIndex ? 'text-orange-200' : 'text-gray-600'}`}>Knowledge Base</div>}
                              </div>
                          </div>
                          {idx === activeIndex && <ChevronRight size={16} />}
                      </div>
                  ))}
              </div>
              
              <div className="bg-gray-850 px-4 py-2 border-t border-gray-800 flex justify-between items-center text-[10px] text-gray-500">
                  <div className="flex gap-2">
                      <span><Command size={10} className="inline"/> Omni-Command</span>
                  </div>
                  <div className="flex gap-3">
                      <span>Select ↵</span>
                      <span>Navigate ↑↓</span>
                  </div>
              </div>
          </div>
      </div>
  );
};
