
import React, { useRef, useEffect, useState } from 'react';
import { Minimize2, Maximize2, X, MessageSquare, ArrowRight, Image as ImageIcon, Bot, Loader2, Activity, Mic, Sparkles, ChevronDown, Zap, ChevronUp } from 'lucide-react';
import { Button } from './Button';
import { ChatMessage, AgentTask } from '../types';
import { MessageRenderer } from './MessageRenderer';

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
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  isOpen, setIsOpen, history, setHistory, input, setInput, isGenerating, isAgentWorking, activeTask,
  onSubmit, onApplyCode, onCompareCode, onApplyAll, onAutoFix, onRevert, onToggleVoice,
  isAutoPilot, onToggleAutoPilot
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isOpen, isAgentWorking, isExpanded]);

  if (!isOpen) {
    return (
      <div className="absolute bottom-6 right-6 z-50 pointer-events-auto">
        <button 
          onClick={() => setIsOpen(true)} 
          className="bg-primary-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all hover:bg-primary-500 group relative flex items-center justify-center"
          title="Open AI Assistant"
        >
          <MessageSquare size={24} className="group-hover:animate-pulse"/>
          {isAgentWorking && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900 animate-ping"></span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div 
        className={`absolute bottom-6 right-6 w-[95vw] md:w-[450px] z-50 flex flex-col gap-4 pointer-events-none transition-all duration-300 ease-in-out
            ${isExpanded ? 'h-[85vh]' : 'max-h-[75vh] h-[600px]'}
        `}
    >
        <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden h-full animate-in slide-in-from-bottom-4 fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-850 border-b border-gray-700 shrink-0 select-none cursor-pointer" onClick={() => !isExpanded && setIsExpanded(true)}>
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
                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded" title="Minimize">
                        <ChevronDown size={16}/>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); setHistory([]); }} 
                        className="text-gray-400 hover:text-red-400 transition-colors p-1.5 hover:bg-gray-800 rounded"
                        title="Close & Clear"
                    >
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
                             <span className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">/agent build login</span>
                             <span className="px-2 py-1 bg-gray-800 rounded text-xs border border-gray-700">/image logo</span>
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
                
                {/* Agent Activity Log - Integrated Thought Process */}
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
            <div className="p-4 border-t border-gray-700 bg-gray-850 shrink-0">
                <form onSubmit={onSubmit} className="flex gap-3 items-end">
                    <div className="flex-1 relative group">
                        <input 
                            type="text" 
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-4 pr-10 py-3 text-white text-sm focus:border-primary-500 focus:outline-none transition-all shadow-inner placeholder-gray-600" 
                            placeholder={isAgentWorking ? "Add instructions to queue..." : "Ask Omni to generate code..."}
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                            autoFocus
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
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
