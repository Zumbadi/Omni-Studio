
import React, { useEffect, useRef, useState, memo } from 'react';
import { Terminal as TerminalIcon, ChevronRight, Zap, Sparkles, Plus, X, Trash2, Cpu, AlertCircle } from 'lucide-react';

interface TerminalProps {
  logs: string[];
  onCommand?: (command: string) => void;
  onAiFix?: (errorMessage: string) => void;
}

const COMMON_COMMANDS = ['ls', 'cd', 'cat', 'mkdir', 'touch', 'rm', 'npm install', 'npm start', 'npm test', 'git status', 'git commit', 'clear', 'help'];

export const Terminal: React.FC<TerminalProps> = memo(({ logs, onCommand, onAiFix }) => {
  const [tabs, setTabs] = useState<{id: string, name: string, logs: string[]}[]>([
      { id: 't1', name: 'Local', logs: logs }
  ]);
  const [activeTabId, setActiveTabId] = useState('t1');
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const isAiCommand = input.trim().startsWith('?');

  // Sync incoming logs prop with the active tab, limiting to last 200 items for performance
  useEffect(() => {
      setTabs(prev => prev.map(t => t.id === 't1' ? { ...t, logs: logs.slice(-200) } : t));
  }, [logs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tabs, activeTabId, logs.length]);

  const handleAddTab = () => {
      const id = `t${Date.now()}`;
      setTabs([...tabs, { id, name: 'New Terminal', logs: ['> Terminal initialized.'] }]);
      setActiveTabId(id);
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (tabs.length === 1) return;
      const newTabs = tabs.filter(t => t.id !== id);
      setTabs(newTabs);
      if (activeTabId === id) setActiveTabId(newTabs[0].id);
  };

  const handleClearLogs = () => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, logs: [] } : t));
  };

  const activeLogs = tabs.find(t => t.id === activeTabId)?.logs || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (onCommand) {
      // Only send command if on the main tab, else simulate
      if (activeTabId === 't1') {
          onCommand(input);
      } else {
          // Handle commands in extra tabs (simulation only)
          let output = [];
          const cmd = input.trim();
          output.push(`> ${cmd}`);
          if (cmd === 'ls') output.push('src  package.json  node_modules');
          else if (cmd === 'pwd') output.push('/app');
          else if (cmd.startsWith('git commit')) output.push('[main] Commit successful.');
          else if (cmd.startsWith('npm')) output.push('Done in 0.5s.');
          else output.push(`Executed: ${cmd}`);
          
          setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, logs: [...t.logs, ...output] } : t));
      }
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
    } else if (e.key === 'Tab') {
        e.preventDefault();
        const match = COMMON_COMMANDS.find(cmd => cmd.startsWith(input));
        if (match) {
            setInput(match);
        }
    }
  };

  const isErrorLog = (log: string) => {
      const lower = log.toLowerCase();
      return lower.includes('error') || lower.includes('failed') || lower.includes('exception');
  };

  return (
    <div 
      className="h-full flex flex-col bg-black font-mono text-xs border-t border-gray-700"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center bg-gray-900 border-b border-gray-700 select-none overflow-x-auto scrollbar-none shrink-0">
        {tabs.map(tab => (
            <div 
                key={tab.id} 
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer border-r border-gray-800 hover:bg-gray-800 ${activeTabId === tab.id ? 'bg-gray-800 text-white' : 'text-gray-500'}`}
            >
                <TerminalIcon size={10} />
                <span>{tab.name}</span>
                <button onClick={(e) => handleCloseTab(e, tab.id)} className="hover:text-red-400 opacity-0 hover:opacity-100 group-hover:opacity-100"><X size={10}/></button>
            </div>
        ))}
        <button onClick={handleAddTab} className="px-3 text-gray-500 hover:text-white"><Plus size={12}/></button>
        <div className="ml-auto px-2 flex gap-2 items-center">
          <button onClick={handleClearLogs} className="text-gray-500 hover:text-white p-1" title="Clear Logs"><Trash2 size={12}/></button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1 cursor-text scrollbar-thin scrollbar-thumb-gray-700">
        {activeLogs.map((log, idx) => {
          const isError = isErrorLog(log);
          return (
            <div key={idx} className={`break-all whitespace-pre-wrap flex items-start group ${isError ? 'bg-red-900/10 p-1 rounded -mx-1 border-l-2 border-red-500' : ''}`}>
                {!log.startsWith('>') && !log.startsWith('  ') && <span className="text-blue-400 mr-2 shrink-0">➜</span>}
                <span className={`flex-1 ${log.startsWith('>') ? 'text-gray-400' : isError ? 'text-red-300 font-medium' : log.startsWith('AI:') ? 'text-purple-400 italic' : log.startsWith('[') ? 'text-yellow-300' : 'text-green-400'}`}>
                {log}
                </span>
                {isError && onAiFix && activeTabId === 't1' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onAiFix(log); }}
                        className="bg-red-600 hover:bg-red-500 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1 transition-all shadow-lg shrink-0 ml-2 hover:scale-105"
                    >
                        <Zap size={10} fill="currentColor" /> Auto-Fix
                    </button>
                )}
            </div>
          );
        })}
        
        <form onSubmit={handleSubmit} className="flex items-center text-gray-100">
           <span className={`${isAiCommand ? 'text-purple-500' : 'text-pink-500'} mr-2`}>
                {isAiCommand ? <Sparkles size={12}/> : '➜'}
           </span>
           <span className="text-cyan-400 mr-2">~</span>
           <input 
             ref={inputRef}
             type="text" 
             className={`flex-1 bg-transparent outline-none border-none p-0 text-gray-100 placeholder-gray-700 ${isAiCommand ? 'text-purple-300' : ''}`}
             value={input}
             onChange={(e) => setInput(e.target.value)}
             onKeyDown={handleKeyDown}
             autoComplete="off"
             autoFocus
             placeholder="Type '?' for AI commands..."
           />
        </form>
        <div ref={bottomRef} />
      </div>
      
      {/* Status Bar */}
      <div className="bg-gray-900 border-t border-gray-800 px-3 py-1 flex justify-between items-center text-[10px] text-gray-500 select-none">
          <div className="flex gap-3">
              <span className="flex items-center gap-1"><TerminalIcon size={10}/> bash</span>
              <span className="flex items-center gap-1"><Cpu size={10}/> node v18.17.0</span>
          </div>
          <div className="flex gap-2">
              <span className="text-green-500">● Online</span>
              <span>UTF-8</span>
          </div>
      </div>
    </div>
  );
});
Terminal.displayName = 'Terminal';
