import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, ChevronRight } from 'lucide-react';

interface TerminalProps {
  logs: string[];
  onCommand?: (command: string) => void;
}

export const Terminal: React.FC<TerminalProps> = ({ logs, onCommand }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (onCommand) {
      onCommand(input);
      setHistory(prev => [...prev, input]);
      setHistoryIndex(-1);
    }
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = Math.min(history.length - 1, historyIndex + 1);
        if (newIndex === history.length - 1 && historyIndex === history.length - 1) {
           setHistoryIndex(-1);
           setInput('');
        } else {
           setHistoryIndex(newIndex);
           setInput(history[newIndex]);
        }
      }
    }
  };

  return (
    <div 
      className="h-full flex flex-col bg-black font-mono text-xs border-t border-gray-700"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between px-4 py-1 bg-gray-800 border-b border-gray-700 select-none">
        <div className="flex items-center gap-2 text-gray-400">
          <TerminalIcon size={12} />
          <span>Terminal (zsh)</span>
        </div>
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] text-gray-500">Node v18.16.0</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1 cursor-text">
        {logs.map((log, idx) => (
          <div key={idx} className="break-all whitespace-pre-wrap">
            {!log.startsWith('>') && !log.startsWith('  ') && <span className="text-blue-400 mr-2">➜</span>}
            <span className={log.startsWith('>') ? 'text-gray-400' : log.startsWith('Error') ? 'text-red-400' : 'text-green-400'}>
              {log}
            </span>
          </div>
        ))}
        
        <form onSubmit={handleSubmit} className="flex items-center text-gray-100">
           <span className="text-pink-500 mr-2">➜</span>
           <span className="text-cyan-400 mr-2">~</span>
           <input 
             ref={inputRef}
             type="text" 
             className="flex-1 bg-transparent outline-none border-none p-0 text-gray-100 placeholder-gray-700"
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={handleKeyDown}
             autoComplete="off"
             autoFocus
           />
        </form>
        <div ref={bottomRef} />
      </div>
    </div>
  );
};