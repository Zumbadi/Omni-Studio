
import React, { useRef, useEffect } from 'react';
import { Minimize2, X, MessageSquare, ArrowRight, Image as ImageIcon } from 'lucide-react';
import { Button } from './Button';
import { ChatMessage } from '../types';
import { MessageRenderer } from './MessageRenderer';

interface ChatWidgetProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  history: ChatMessage[];
  setHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: (val: string) => void;
  isGenerating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onApplyCode: (code: string) => void;
  onCompareCode: (code: string) => void;
  onApplyAll: (codes: string[]) => void;
  onAutoFix: (issues: string[]) => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  isOpen, setIsOpen, history, setHistory, input, setInput, isGenerating,
  onSubmit, onApplyCode, onCompareCode, onApplyAll, onAutoFix
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isOpen]);

  if (!isOpen) {
    return (
      <div className="absolute bottom-6 right-6 z-50 pointer-events-auto">
        <button 
          onClick={() => setIsOpen(true)} 
          className="bg-primary-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all hover:bg-primary-500 group"
          title="Open AI Assistant"
        >
          <MessageSquare size={24} className="group-hover:animate-pulse"/>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 right-6 w-[90vw] md:w-96 z-50 flex flex-col gap-4 pointer-events-none max-h-[70vh]">
        <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden h-full animate-in slide-in-from-bottom-4 fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-850 border-b border-gray-700 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
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
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-700 bg-gray-850 shrink-0">
                <form onSubmit={onSubmit} className="flex gap-2">
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-3 pr-8 py-2.5 text-white text-sm focus:border-primary-500 focus:outline-none transition-all shadow-inner" 
                            placeholder="Ask to generate code..." 
                            value={input} 
                            onChange={e => setInput(e.target.value)} 
                        />
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                            <ImageIcon size={14}/>
                        </button>
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
