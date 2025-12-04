
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Minimize2, Maximize2, X, MessageSquare, ArrowRight, Image as ImageIcon, Bot, Loader2, Activity, Mic, Sparkles, Zap, Command, Code, Bug, Eraser, Volume2, Wand2, Play, Globe, Rocket, Book, Layers, Terminal, Container, Workflow, Paperclip, MapPin, Trash2, FileText, File, Move, Box, Clapperboard } from 'lucide-react';
import { Button } from './Button';
import { ChatMessage, AgentTask, FileNode } from '../types';
import { MessageRenderer } from './MessageRenderer';
import { getAllFiles } from '../utils/fileHelpers';
import { extractSymbols, CodeSymbol } from '../utils/codeParser';

interface ChatWidgetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  history: ChatMessage[];
  setHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: (val: string) => void;
  isGenerating: boolean;
  isAgentWorking?: boolean;
  activeTask?: AgentTask | null;
  onSubmit: (e: React.FormEvent) => void;
  onApplyCode: (code: string) => void;
  onCompareCode: (code: string) => void;
  onApplyAll: (codes: string[]) => void;
  onAutoFix: (issues: string[]) => void;
  onRevert?: () => void;
  onToggleVoice?: () => void;
  isAutoPilot?: boolean;
  onToggleAutoPilot?: () => void;
  attachedImage?: string;
  onAttachImage?: (image: string | undefined) => void;
  files: FileNode[];
}

const SLASH_COMMANDS = [
    { cmd: '/search', desc: 'Google Search for real-time info', Icon: Globe, color: 'text-blue-400' },
    { cmd: '/map', desc: 'Find places with Google Maps', Icon: MapPin, color: 'text-green-400' },
    { cmd: '/agent', desc: 'Delegate task to AI Agents', Icon: Bot, color: 'text-purple-400' },
    { cmd: '/campaign', desc: 'Generate full media campaign', Icon: Clapperboard, color: 'text-red-400' },
    { cmd: '/image', desc: 'Generate visual assets', Icon: ImageIcon, color: 'text-pink-400' },
    { cmd: '/pipeline', desc: 'Trigger CI/CD Pipeline', Icon: Workflow, color: 'text-orange-400' },
    { cmd: '/docker', desc: 'Generate Docker configs', Icon: Container, color: 'text-cyan-400' },
    { cmd: '/test', desc: 'Run project test suite', Icon: Play, color: 'text-green-400' },
    { cmd: '/deploy', desc: 'Deploy to production', Icon: Rocket, color: 'text-red-400' },
    { cmd: '/terminal', desc: 'Run shell command', Icon: Terminal, color: 'text-gray-400' },
    { cmd: '/architect', desc: 'Generate system architecture', Icon: Layers, color: 'text-indigo-400' },
    { cmd: '/tts', desc: 'Generate speech/audio', Icon: Volume2, color: 'text-yellow-400' },
    { cmd: '/refactor', desc: 'Refactor current code', Icon: Code, color: 'text-blue-400' },
    { cmd: '/fix', desc: 'Analyze and fix bugs', Icon: Bug, color: 'text-red-400' },
    { cmd: '/explain', desc: 'Explain functionality', Icon: MessageSquare, color: 'text-green-400' },
    { cmd: '/docs', desc: 'Generate documentation', Icon: Book, color: 'text-teal-400' },
    { cmd: '/edit', desc: 'Edit attached image', Icon: Wand2, color: 'text-cyan-400' },
    { cmd: '/clear', desc: 'Clear chat history', Icon: Eraser, color: 'text-gray-500' },
];

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  isOpen, setIsOpen, history, setHistory, input, setInput, isGenerating, isAgentWorking, activeTask,
  onSubmit, onApplyCode, onCompareCode, onApplyAll, onAutoFix, onRevert, onToggleVoice,
  isAutoPilot, onToggleAutoPilot, attachedImage, onAttachImage, files
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Dragging State
  const widgetRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{x: number, y: number} | null>(null);
  const dragRef = useRef<{startX: number, startY: number, startLeft: number, startTop: number} | null>(null);

  // Autocomplete State
  const [showCommands, setShowCommands] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [filteredCommands, setFilteredCommands] = useState(SLASH_COMMANDS);
  
  // Memoize symbols to avoid expensive re-parsing on every render
  const projectSymbols = useMemo(() => extractSymbols(files), [files]);
  
  const [filteredMentions, setFilteredMentions] = useState<{name: string, type: string, detail: string, id: string, context?: string}[]>([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isOpen, isAgentWorking, isExpanded, attachedImage]);

  // --- Robust Dragging Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('input, button, textarea, a')) return;
      
      const widget = widgetRef.current;
      if (!widget) return;
      
      const rect = widget.getBoundingClientRect();
      dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startLeft: rect.left,
          startTop: rect.top
      };
      
      if (!position) {
          setPosition({ x: rect.left, y: rect.top });
      }
      
      e.preventDefault();
  };

  useEffect(() => {
      const onMouseMove = (e: MouseEvent) => {
          if (!dragRef.current) return;
          
          const deltaX = e.clientX - dragRef.current.startX;
          const deltaY = e.clientY - dragRef.current.startY;
          
          let newX = dragRef.current.startLeft + deltaX;
          let newY = dragRef.current.startTop + deltaY;

          const maxX = window.innerWidth - 50;
          const maxY = window.innerHeight - 50;
          newX = Math.max(0, Math.min(newX, maxX));
          newY = Math.max(0, Math.min(newY, maxY));
          
          setPosition({ x: newX, y: newY });
      };
      
      const onMouseUp = () => {
          dragRef.current = null;
      };
      
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
      };
  }, []);

  useEffect(() => {
      // 1. Slash Commands Detection
      const slashMatch = input.match(/^\/(\w*)$/);
      if (slashMatch) {
          const query = slashMatch[1].toLowerCase();
          const filtered = SLASH_COMMANDS.filter(c => c.cmd.toLowerCase().startsWith('/' + query));
          setFilteredCommands(filtered);
          setShowCommands(filtered.length > 0);
          setShowMentions(false);
          setActiveIndex(0);
          return;
      } 
      
      // 2. Mention Detection (@...)
      const mentionMatch = input.match(/@([\w\-\/\.]*)$/);
      if (mentionMatch) {
          const query = mentionMatch[1].toLowerCase();
          
          // Combine files and symbols
          const allFiles = getAllFiles(files).filter(f => f.node.type === 'file');
          
          const fileResults = allFiles
              .filter(f => f.node.name.toLowerCase().includes(query))
              .map(f => ({ name: f.node.name, type: 'file', detail: f.path, id: f.node.id }));
              
          const symbolResults = projectSymbols
              .filter(s => s.name.toLowerCase().includes(query))
              .map(s => ({ name: s.name, type: s.type, detail: s.fileName, id: `${s.fileId}:${s.name}`, context: s.content }));

          const combined = [...fileResults, ...symbolResults].slice(0, 15); // Limit results
          
          setFilteredMentions(combined);
          setShowMentions(combined.length > 0);
          setShowCommands(false);
          setActiveIndex(0);
          return;
      }

      setShowCommands(false);
      setShowMentions(false);
  }, [input, files, projectSymbols]);

  useEffect(() => {
      if ((showCommands || showMentions) && menuRef.current) {
          const activeEl = menuRef.current.children[activeIndex + 1] as HTMLElement;
          if (activeEl) {
              activeEl.scrollIntoView({ block: 'nearest' });
          }
      }
  }, [activeIndex, showCommands, showMentions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (showCommands || showMentions) {
          const listLength = showCommands ? filteredCommands.length : filteredMentions.length;
          
          if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex(prev => (prev - 1 + listLength) % listLength);
              return;
          }
          if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex(prev => (prev + 1) % listLength);
              return;
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              if (showCommands && filteredCommands[activeIndex]) {
                  selectCommand(filteredCommands[activeIndex].cmd);
              } else if (showMentions && filteredMentions[activeIndex]) {
                  selectMention(filteredMentions[activeIndex]);
              }
              return;
          }
          if (e.key === 'Escape') {
              e.preventDefault();
              setShowCommands(false);
              setShowMentions(false);
              return;
          }
      }
  };

  const selectCommand = (cmd: string) => {
      setInput(cmd + ' ');
      setShowCommands(false);
      inputRef.current?.focus();
  };

  const selectMention = (item: {name: string, type: string, detail: string, id: string}) => {
      let replacement = '';
      if (item.type === 'file') {
          replacement = `@[${item.detail}] `;
      } else {
          // Store symbol reference as @[File:SymbolName]
          replacement = `@[${item.detail}:${item.name}] `;
      }
      
      const newInput = input.replace(/@([\w\-\/\.]*)$/, replacement);
      setInput(newInput);
      setShowMentions(false);
      inputRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && onAttachImage) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  onAttachImage(ev.target.result as string);
              }
          };
          reader.readAsDataURL(file);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearHistory = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to clear the chat history?')) {
          setHistory([]);
      }
  };

  const getIconForType = (type: string) => {
      switch(type) {
          case 'file': return <FileText size={14} className="text-blue-400"/>;
          case 'function': return <Box size={14} className="text-purple-400"/>;
          case 'class': return <Container size={14} className="text-yellow-400"/>;
          case 'component': return <Layers size={14} className="text-green-400"/>;
          case 'variable': return <Code size={14} className="text-gray-400"/>;
          default: return <File size={14} className="text-gray-500"/>;
      }
  };

  if (!isOpen) {
    return (
      <div 
        ref={widgetRef}
        className="fixed z-50 pointer-events-auto cursor-move select-none"
        style={position ? { left: position.x, top: position.y } : { bottom: '24px', right: '24px' }}
        onMouseDown={handleMouseDown}
      >
        <button 
          onClick={() => setIsOpen(true)} 
          className="bg-primary-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform hover:bg-primary-500 group relative flex items-center justify-center border-4 border-gray-900"
          title="Open AI Assistant (Drag to move)"
        >
          <MessageSquare size={24} className="group-hover:animate-pulse"/>
          {isAgentWorking && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900 animate-ping"></span>
          )}
          <div className="absolute inset-0 rounded-full border-2 border-white/20 pointer-events-none"></div>
        </button>
      </div>
    );
  }

  return (
    <div 
        ref={widgetRef}
        className={`fixed z-[100] flex flex-col gap-4 transition-all duration-300 ease-in-out shadow-2xl rounded-2xl
            ${isExpanded ? 'h-[85vh]' : 'max-h-[75vh] h-[600px]'}
        `}
        style={position ? { 
            left: position.x, 
            top: position.y, 
            width: isExpanded ? '450px' : '400px', 
        } : { 
            bottom: '24px', 
            right: '24px',
            width: isExpanded ? '95vw' : 'calc(100vw - 48px)',
            maxWidth: '450px'
        }}
    >
        <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl pointer-events-auto flex flex-col overflow-hidden h-full animate-in slide-in-from-bottom-4 fade-in duration-300">
            {/* Header */}
            <div 
                className="flex items-center justify-between px-4 py-3 bg-gray-850 border-b border-gray-700 shrink-0 select-none cursor-move group" 
                onMouseDown={handleMouseDown}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${isAgentWorking ? 'bg-purple-600 animate-pulse' : 'bg-primary-600'}`}>
                        {isAgentWorking ? <Bot size={16} className="text-white"/> : <Sparkles size={16} className="text-white"/>}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                            Omni Assistant
                            {isAutoPilot && <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center gap-1 animate-pulse"><Zap size={8} fill="currentColor"/> AUTO</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1">
                            {isAgentWorking ? 'Orchestrating Agents...' : 'Ready to help'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <div className="mr-2 text-gray-600 hidden group-hover:block animate-in fade-in">
                        <Move size={14}/>
                    </div>

                    {onToggleAutoPilot && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onToggleAutoPilot(); }} 
                            className={`p-1.5 rounded transition-colors mr-2 ${isAutoPilot ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-purple-400 hover:bg-gray-800'}`}
                            title={isAutoPilot ? "Disable Auto-Pilot" : "Enable Auto-Pilot Loop"}
                        >
                            <Activity size={16} className={isAutoPilot ? "animate-pulse" : ""} />
                        </button>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} 
                        className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded" 
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                    </button>
                    <button 
                        onClick={handleClearHistory}
                        className="text-gray-400 hover:text-red-400 transition-colors p-1.5 hover:bg-gray-800 rounded"
                        title="Clear Chat History"
                    >
                        <Trash2 size={16}/>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded" title="Close">
                        <X size={16}/>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 flex flex-col gap-3 overflow-y-auto p-4 bg-black/20 scrollbar-thin scrollbar-thumb-gray-700 scroll-smooth">
                {history.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-2 opacity-60">
                        <MessageSquare size={32} />
                        <p>Start a conversation or run a command.</p>
                        <div className="flex gap-2 mt-2">
                             <button onClick={() => setInput('/campaign Launch Video ')} className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700 hover:border-red-500 transition-colors">/campaign</button>
                             <button onClick={() => setInput('/search react hooks ')} className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700 hover:border-primary-500 transition-colors">/search react hooks</button>
                        </div>
                    </div>
                )}
                
                {history.map((msg) => (
                    <MessageRenderer 
                        key={msg.id} 
                        message={msg} 
                        onApplyCode={onApplyCode} 
                        onCompareCode={onCompareCode} 
                        onApplyAll={onApplyAll} 
                        onAutoFix={onAutoFix} 
                        onRevert={onRevert}
                    />
                ))}
                
                {isGenerating && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 p-2 animate-pulse">
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        Thinking...
                    </div>
                )}
                
                {/* Agent Activity Log */}
                {isAgentWorking && activeTask && (
                    <div className="mx-1 my-2 bg-gray-800/80 backdrop-blur rounded-xl border border-purple-500/30 overflow-hidden text-xs shadow-lg animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-purple-900/30 p-2.5 flex justify-between items-center border-b border-purple-500/20">
                            <span className="font-bold text-purple-300 flex items-center gap-2">
                                <Activity size={12} className="animate-spin"/> Agent: {activeTask.name}
                            </span>
                            <span className="text-purple-200 bg-purple-900/50 px-2 py-0.5 rounded text-[10px] font-mono border border-purple-500/30">
                                {activeTask.processedFiles}/{activeTask.totalFiles}
                            </span>
                        </div>
                        <div className="p-3 font-mono text-gray-400 max-h-32 overflow-y-auto bg-black/40 scrollbar-thin scrollbar-thumb-gray-600">
                            {activeTask.logs.slice(-5).map((l, i) => (
                                <div key={i} className="mb-1.5 last:mb-0 break-words text-[11px] flex gap-2">
                                    <span className="text-gray-600 shrink-0">{'>'}</span>
                                    {l.startsWith('[System]') ? <span className="text-gray-500">{l.replace('[System]', '')}</span> : 
                                     l.includes('Error') ? <span className="text-red-400 font-bold">{l}</span> : 
                                     l.includes('Approved') ? <span className="text-green-400 font-bold">{l}</span> : 
                                     <span className="text-blue-300">{l}</span>}
                                </div>
                            ))}
                            <div className="animate-pulse text-purple-500 mt-1">_</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-700 bg-gray-850 shrink-0 relative">
                {attachedImage && (
                    <div className="absolute bottom-full left-4 mb-2 animate-in slide-in-from-bottom-2">
                        <div className="relative group/img">
                            <img src={attachedImage} alt="Attachment" className="h-20 w-auto rounded-lg border border-gray-600 shadow-xl object-cover bg-black/50" />
                            <button 
                                onClick={() => onAttachImage && onAttachImage(undefined)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover/img:opacity-100 transition-opacity transform hover:scale-110"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Slash Command Menu */}
                {showCommands && filteredCommands.length > 0 && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-gray-800/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 zoom-in-95 z-50 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600" ref={menuRef}>
                        <div className="px-3 py-2 bg-gray-900/80 border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 sticky top-0 backdrop-blur-md z-10">
                            <Command size={10} /> Available Commands
                        </div>
                        <div>
                            {filteredCommands.map((cmd, idx) => {
                                const isActive = idx === activeIndex;
                                return (
                                    <div 
                                        key={cmd.cmd}
                                        onClick={() => selectCommand(cmd.cmd)}
                                        className={`px-4 py-2.5 flex items-center gap-3 cursor-pointer text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'}`}
                                    >
                                        <div className={`p-1.5 rounded-md ${isActive ? 'bg-primary-500 text-white' : `bg-gray-800 ${cmd.color}`}`}>
                                            <cmd.Icon size={14} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold font-mono">{cmd.cmd}</span>
                                            <span className={`text-[10px] ${isActive ? 'text-primary-200' : 'text-gray-500'}`}>{cmd.desc}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Mention Menu */}
                {showMentions && filteredMentions.length > 0 && (
                    <div className="absolute bottom-full left-4 right-4 mb-2 bg-gray-800/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 zoom-in-95 z-50 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600" ref={menuRef}>
                        <div className="px-3 py-2 bg-gray-900/80 border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 sticky top-0 backdrop-blur-md z-10">
                            <FileText size={10} /> Context References
                        </div>
                        <div>
                            {filteredMentions.map((item, idx) => {
                                const isActive = idx === activeIndex;
                                return (
                                    <div 
                                        key={item.id}
                                        onClick={() => selectMention(item)}
                                        className={`px-4 py-2 flex items-center justify-between cursor-pointer text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-700/50'}`}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {getIconForType(item.type)}
                                            <div className="flex flex-col min-w-0">
                                                <span className="truncate font-medium">{item.name}</span>
                                                <span className={`text-[10px] ${isActive ? 'text-primary-200' : 'text-gray-500'}`}>{item.detail}</span>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] uppercase tracking-wider ${isActive ? 'text-white/70' : 'text-gray-600'}`}>{item.type}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <form onSubmit={onSubmit} className="flex gap-3 items-end">
                    <div className="flex-1 relative group bg-gray-900 border border-gray-700 rounded-xl flex items-center shadow-inner transition-all focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500/30">
                        {onAttachImage && (
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                className={`p-2 ml-1 rounded-lg transition-colors ${attachedImage ? 'text-primary-400 bg-primary-900/20' : 'text-gray-500 hover:text-white hover:bg-gray-800'}`}
                                title="Attach Image"
                            >
                                <Paperclip size={18} />
                            </button>
                        )}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileSelect} 
                        />
                        
                        <input 
                            ref={inputRef}
                            type="text" 
                            className="flex-1 bg-transparent border-none py-3 px-2 text-white text-sm focus:outline-none placeholder-gray-600" 
                            placeholder={isAgentWorking ? "Add instructions to queue..." : "Type / for commands, @ for symbols..."}
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                        
                        <div className="flex items-center gap-1 pr-2">
                             {onToggleVoice && (
                                <button type="button" onClick={onToggleVoice} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors" title="Voice Input">
                                    <Mic size={16}/>
                                </button>
                             )}
                        </div>
                    </div>
                    <Button type="submit" disabled={isGenerating || !input.trim()} className="px-4 py-3 h-full rounded-xl shadow-lg shadow-primary-900/20">
                        <ArrowRight size={18}/>
                    </Button>
                </form>
            </div>
        </div>
    </div>
  );
};
