
import React, { useRef, useEffect } from 'react';
import { Minimize2, X, MessageSquare, ArrowRight, Image as ImageIcon, Bot, Loader2, Activity, Mic } from 'lucide-react';
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
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  isOpen, setIsOpen, history, setHistory, input, setInput, isGenerating, isAgentWorking, activeTask,
  onSubmit, onApplyCode, onCompareCode, onApplyAll, onAutoFix, onRevert, onToggleVoice
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isOpen, isAgentWorking]);

  if (!isOpen) {
    return (
      <div className="absolute bottom-6 right-6 z-50 pointer-events-auto">
        <button 
          onClick={() => setIsOpen(true)} 
          className="bg-primary-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all hover:bg-primary-500 group relative"
          title="Open AI Assistant"
        >
          <MessageSquare size={24} className="group-hover:animate-pulse"/>
          {isAgentWorking && (
              <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse"></span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 right-6 w-[90vw] md:w-96 z-50 flex flex-col gap-4 pointer-events-none max-h-[75vh]">
        <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden h-full animate-in slide-in-from-bottom-4 fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-850 border-b border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isAgentWorking ? 'bg-purple-500 animate-pulse' : 'bg-green-500'}`}></div>
                    <span className="text-xs font-bold text-gray-200">Omni Assistant</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1" title="Minimize">
                        <Minimize2 size={14}/>
                    </button>
                    <button 
                        onClick={() => { setIsOpen(false); setHistory([]); }} 
                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                        title="Close & Clear"
                    >
                        <X size={14}/>
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 flex flex-col gap-3 overflow-y-auto p-4 bg-black/20 scrollbar-thin scrollbar-thumb-gray-700">
                {history.length === 0 && (
                    <div className="text-center text-gray-500 text-xs my-auto">
                        Start a conversation...
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
                    <div className="flex items-center gap-2 text-xs text-gray-500 p-2">
                        <div className="flex gap-1">
                            <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        Omni is thinking...
                    </div>
                )}
                
                {/* Agent Activity Log - Integrated Thought Process */}
                {isAgentWorking && activeTask && (
                    <div className="mx-1 my-2 bg-gray-800/50 rounded-lg border border-purple-500/30 overflow-hidden text-xs shadow-lg animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-purple-900/20 p-2 flex justify-between items-center border-b border-purple-500/20">
                            <span className="font-bold text-purple-300 flex items-center gap-2"><Activity size={12} className="animate-spin"/> Agent Activity: {activeTask.name}</span>
                            <span className="text-purple-200 bg-purple-900/50 px-1.5 py-0.5 rounded text-[9px]">{activeTask.processedFiles}/{activeTask.totalFiles}</span>
                        </div>
                        <div className="p-2 font-mono text-gray-400 max-h-32 overflow-y-auto bg-black/40 scrollbar-thin scrollbar-thumb-gray-600">
                            {activeTask.logs.slice(-5).map((l, i) => (
                                <div key={i} className="mb-1 break-words text-[10px]">
                                    {l.startsWith('[System]') ? <span className="text-gray-500">{l}</span> : 
                                     l.includes('Error') ? <span className="text-red-400">{l}</span> : 
                                     l.includes('Approved') ? <span className="text-green-400">{l}</span> : 
                                     <span className="text-blue-300">{l}</span>}
                                </div>
                            ))}
                            <div className="animate-pulse text-purple-500">_</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-700 bg-gray-850 shrink-0">
                <form onSubmit={onSubmit} className="flex gap-2">
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-3 pr-16 py-2.5 text-white text-sm focus:border-primary-500 focus:outline-none transition-all shadow-inner" 
                            placeholder={isAgentWorking ? "Add instructions to queue..." : "Ask to generate code..."}
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                             {onToggleVoice && (
                                <button type="button" onClick={onToggleVoice} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800" title="Voice Input">
                                    <Mic size={14}/>
                                </button>
                             )}
                            <button type="button" className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800">
                                <ImageIcon size={14}/>
                            </button>
                        </div>
                    </div>
                    <Button type="submit" disabled={isGenerating || !input.trim()} className="px-3">
                        <ArrowRight size={16}/>
                    </Button>
                </form>
            </div>
        </div>
    </div>
  );
};
