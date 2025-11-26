
import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Search, Bug, Play, Pause, Trash2, Package, Puzzle, Download, Cloud, Check, AlertCircle, RefreshCw, Terminal, Shield, Bot, FileText, ChevronRight, ChevronDown, Plus, X, TrendingUp, User, Zap, Loader2, Square, Replace, ArrowRight, Circle, Scissors, Copy, Code, Atom, Palette, Database, Braces, ImageIcon, Video, Volume2, Wand2, Clock, Workflow } from 'lucide-react';
import { FileNode, GitCommit as GitCommitType, Extension, AuditIssue, AgentTask, SocialPost, AudioTrack, AIAgent, Snippet, KnowledgeDoc } from '../types';
import { Button } from './Button';
import { DEFAULT_AGENTS } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { generateCommitMessage } from '../services/geminiService';
import { getAllFiles } from '../utils/fileHelpers';
import { KnowledgePanel } from './KnowledgePanel'; // Import

// ... (Keep GitPanel, SearchPanel, DebugPanel, ExtensionsPanel, AssetsPanel, SnippetsPanel, AgentsPanel unchanged) ...

// Re-export KnowledgePanel for use in WorkspaceSidebar
export { KnowledgePanel }; 

// --- GIT PANEL ---
interface GitPanelProps { files: FileNode[]; commits: GitCommitType[]; currentBranch: string; onCommit: (msg: string) => void; onSwitchBranch: () => void; }
export const GitPanel: React.FC<GitPanelProps> = ({ files, commits, currentBranch, onCommit, onSwitchBranch }) => {
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateMessage = async () => {
      setIsGenerating(true);
      // Get modified files
      const modified = getAllFiles(files)
        .filter(f => f.node.gitStatus === 'modified' || f.node.gitStatus === 'added')
        .map(f => f.node.name);
      
      if (modified.length === 0) {
          alert("No changes to commit.");
          setIsGenerating(false);
          return;
      }

      const msg = await generateCommitMessage(modified);
      setMessage(msg);
      setIsGenerating(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
         <div className="flex justify-between items-center mb-4">
             <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Source Control</h2>
             <button onClick={onSwitchBranch} className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"><GitBranch size={12}/> {currentBranch}</button>
         </div>
         
         {/* Git Graph Visualization */}
         <div className="mb-4 pl-1">
             <div className="relative h-16 flex items-center">
                 <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-700"></div>
                 {commits.slice(0, 3).map((c, i) => (
                     <div key={c.id} className="absolute left-0 flex items-center" style={{ top: `${i * 24}px` }}>
                         <div className="w-4 h-4 rounded-full bg-gray-900 border-2 border-blue-500 z-10"></div>
                         <div className="ml-3 text-[10px] text-gray-500 truncate w-40">{c.message}</div>
                     </div>
                 ))}
                 <div className="absolute left-0 top-[72px] flex items-center">
                     <div className="w-4 h-4 rounded-full bg-gray-800 border-2 border-dashed border-gray-600 z-10"></div>
                     <div className="ml-3 text-[10px] text-gray-600">Initial commit</div>
                 </div>
             </div>
         </div>

         <div className="relative">
             <textarea 
                className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-gray-300 mb-2 h-16 focus:border-primary-500 outline-none transition-colors pr-8" 
                placeholder="Commit message..." 
                value={message} 
                onChange={e => setMessage(e.target.value)} 
             />
             <button 
                onClick={handleGenerateMessage} 
                disabled={isGenerating}
                className="absolute right-2 top-2 text-gray-500 hover:text-purple-400 transition-colors"
                title="Generate Commit Message"
             >
                 {isGenerating ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14}/>}
             </button>
         </div>
         <Button size="sm" className="w-full" onClick={() => { onCommit(message); setMessage(''); }} disabled={!message.trim()}>Commit Changes</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="text-[10px] font-bold text-gray-500 px-2 mb-1 uppercase">History</div>
          {commits.map(c => (
              <div key={c.id} className="text-xs text-gray-400 p-2 rounded hover:bg-gray-800 flex justify-between group">
                  <span className="truncate max-w-[140px]">{c.message}</span>
                  <span className="text-gray-600 font-mono text-[10px]">{c.hash}</span>
              </div>
          ))}
      </div>
    </div>
  );
};

// --- SEARCH PANEL ---
interface SearchPanelProps { 
    query: string; 
    onSearch: (q: string) => void; 
    results: any[]; 
    onResultClick: (id: string, line: number) => void;
    onReplace: (fileId: string, line: number, text: string, newText: string) => void;
    onReplaceAll: (searchText: string, newText: string) => void;
}
export const SearchPanel: React.FC<SearchPanelProps> = ({ query, onSearch, results, onResultClick, onReplace, onReplaceAll }) => {
    const [replaceMode, setReplaceMode] = useState(false);
    const [replaceText, setReplaceText] = useState('');

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0 z-10 space-y-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                    Search 
                    <button onClick={() => setReplaceMode(!replaceMode)} className={`p-1 rounded hover:bg-gray-700 ${replaceMode ? 'text-white' : 'text-gray-500'}`} title="Toggle Replace"><ChevronRight size={14} className={`transition-transform ${replaceMode ? 'rotate-90' : ''}`}/></button>
                </h2>
                <div className="relative">
                    <input 
                        type="text" 
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pl-8 text-xs text-white focus:border-primary-500 outline-none" 
                        placeholder="Search..." 
                        value={query} 
                        onChange={e => onSearch(e.target.value)} 
                    />
                    <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500"/>
                </div>
                {replaceMode && (
                    <div className="relative animate-in slide-in-from-top-2 fade-in">
                        <input 
                            type="text" 
                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pl-8 text-xs text-white focus:border-primary-500 outline-none" 
                            placeholder="Replace with..." 
                            value={replaceText} 
                            onChange={e => setReplaceText(e.target.value)} 
                        />
                        <Replace size={14} className="absolute left-2.5 top-2.5 text-gray-500"/>
                        <div className="flex justify-end mt-2">
                            <button 
                                onClick={() => onReplaceAll(query, replaceText)}
                                disabled={!query || results.length === 0}
                                className="text-[10px] bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                            >
                                <RefreshCw size={10}/> Replace All
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                <div className="px-2 pb-2 text-[10px] text-gray-500">{results.length} results found</div>
                {results.map((res, i) => (
                    <div key={i} className="group flex flex-col p-2 rounded hover:bg-gray-800 transition-colors cursor-pointer border border-transparent hover:border-gray-700 mb-1">
                        <div onClick={() => onResultClick(res.fileId, res.line)} className="flex items-center gap-2 mb-1">
                            <FileText size={12} className="text-blue-400 shrink-0"/>
                            <span className="text-xs font-medium text-gray-300 truncate">{res.fileName}</span>
                            <span className="text-[10px] text-gray-600 bg-gray-900 px-1 rounded">{res.line}</span>
                        </div>
                        <div className="pl-5 text-[10px] text-gray-400 font-mono truncate flex justify-between items-center">
                            <span>{res.text}</span>
                            {replaceMode && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onReplace(res.fileId, res.line, res.text, replaceText); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-yellow-400 transition-opacity"
                                    title="Replace this instance"
                                >
                                    <Replace size={12}/>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {query && results.length === 0 && <div className="text-center py-8 text-xs text-gray-600">No results found.</div>}
            </div>
        </div>
    );
};

// --- DEBUG PANEL ---
interface DebugPanelProps { variables: any[]; breakpoints: number[]; onRemoveBreakpoint: (l: number) => void; }
export const DebugPanel: React.FC<DebugPanelProps> = ({ variables, breakpoints, onRemoveBreakpoint }) => (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-800"><h2 className="text-xs font-bold text-gray-500 uppercase">Debug</h2></div>
        <div className="p-4 space-y-4">
            <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><Circle size={8} fill="red" className="text-red-500"/> Breakpoints</div>
                {breakpoints.length === 0 && <div className="text-xs text-gray-600 italic">No breakpoints set. Click gutter to add.</div>}
                {breakpoints.map(bp => (
                    <div key={bp} className="flex items-center justify-between text-xs text-gray-300 p-2 bg-gray-800 rounded mb-1">
                        <span>Line {bp}</span>
                        <button onClick={() => onRemoveBreakpoint(bp)} className="text-gray-500 hover:text-white"><X size={12}/></button>
                    </div>
                ))}
            </div>
            <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Variables (Scope)</div>
                <div className="bg-gray-800 rounded p-2 font-mono text-[10px] text-green-400">
                    <div>count: 42</div>
                    <div>user: "Alice"</div>
                    <div>isLoading: false</div>
                </div>
            </div>
        </div>
    </div>
);

// --- EXTENSIONS PANEL ---
interface ExtensionsPanelProps { extensions: Extension[]; onToggle: (id: string) => void; }
export const ExtensionsPanel: React.FC<ExtensionsPanelProps> = ({ extensions, onToggle }) => (
    <div className="flex flex-col h-full"><div className="p-4 border-b border-gray-800"><h2 className="text-xs font-bold text-gray-500 uppercase">Extensions</h2></div><div className="p-2">{extensions.map(e => <div key={e.id} className="p-3 mb-2 bg-gray-800 rounded border border-gray-700 flex justify-between items-center group"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center font-bold text-white">{e.icon}</div><div><div className="text-sm text-gray-200 font-medium">{e.name}</div><div className="text-[10px] text-gray-500">{e.publisher}</div></div></div><button onClick={() => onToggle(e.id)} className={`px-3 py-1 text-[10px] rounded border transition-colors ${e.installed ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-gray-700 text-gray-400 border-gray-600 hover:text-white'}`}>{e.installed ? 'Installed' : 'Install'}</button></div>)}</div></div>
);

// --- ASSETS PANEL ---
interface AssetsPanelProps { 
    assets: {id: string, type: 'image' | 'video' | 'audio', url: string, name: string}[]; 
    onInsertAsset?: (asset: {id: string, type: 'image' | 'video' | 'audio', url: string, name: string}) => void;
}
export const AssetsPanel: React.FC<AssetsPanelProps> = ({ assets, onInsertAsset }) => (
    <div className="flex flex-col h-full bg-gray-900">
        <div className="p-4 border-b border-gray-800"><h2 className="text-xs font-bold text-gray-500 uppercase">Generated Assets</h2></div>
        <div className="flex-1 overflow-y-auto p-3">
            {assets.length === 0 && <div className="text-xs text-gray-600 text-center py-10">No assets generated yet.</div>}
            <div className="grid grid-cols-2 gap-3">
                {assets.map((a, i) => (
                    <div 
                        key={i} 
                        className="bg-gray-800 rounded-lg border border-gray-700 flex flex-col overflow-hidden group hover:border-primary-500 transition-all relative cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/omni-asset', JSON.stringify(a));
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                    >
                        <div className="aspect-square bg-black relative flex items-center justify-center">
                            {a.type === 'image' ? (
                                <img src={a.url} className="w-full h-full object-cover" alt={a.name} />
                            ) : a.type === 'video' ? (
                                <video src={a.url} className="w-full h-full object-cover" />
                            ) : (
                                <Volume2 size={24} className="text-gray-500" />
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {onInsertAsset && (
                                    <button 
                                        onClick={() => onInsertAsset(a)}
                                        className="bg-primary-600 text-white text-[10px] px-2 py-1 rounded hover:bg-primary-500"
                                    >
                                        Insert Code
                                    </button>
                                )}
                            </div>
                            <div className="absolute top-1 right-1 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold backdrop-blur-sm">
                                {a.type === 'image' ? <ImageIcon size={10}/> : a.type === 'video' ? <Video size={10}/> : <Volume2 size={10}/>}
                            </div>
                        </div>
                        <div className="p-2">
                            <div className="text-[10px] font-medium text-gray-300 truncate" title={a.name}>{a.name}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// --- SNIPPETS PANEL ---
interface SnippetsPanelProps {
    snippets: Snippet[];
    onAddSnippet: () => void;
    onDeleteSnippet: (id: string) => void;
    onInsertSnippet: (code: string) => void;
}
export const SnippetsPanel: React.FC<SnippetsPanelProps> = ({ snippets, onAddSnippet, onDeleteSnippet, onInsertSnippet }) => {
    const getSnippetStyle = (snippet: Snippet) => {
        const lowerName = snippet.name.toLowerCase();
        const lowerCode = snippet.code.toLowerCase();
        
        if (lowerName.includes('react') || lowerName.includes('component') || lowerCode.includes('jsx')) 
            return { icon: <Atom size={24}/>, bg: 'bg-blue-950', border: 'border-blue-800', text: 'text-blue-400', glow: 'shadow-blue-900/20' };
        if (lowerName.includes('hook') || lowerName.includes('use')) 
            return { icon: <Braces size={24}/>, bg: 'bg-purple-950', border: 'border-purple-800', text: 'text-purple-400', glow: 'shadow-purple-900/20' };
        if (lowerName.includes('style') || lowerName.includes('css')) 
            return { icon: <Palette size={24}/>, bg: 'bg-pink-950', border: 'border-pink-800', text: 'text-pink-400', glow: 'shadow-pink-900/20' };
        if (lowerName.includes('db') || lowerName.includes('query') || lowerName.includes('api')) 
            return { icon: <Database size={24}/>, bg: 'bg-emerald-950', border: 'border-emerald-800', text: 'text-emerald-400', glow: 'shadow-emerald-900/20' };
            
        return { icon: <Code size={24}/>, bg: 'bg-gray-800', border: 'border-gray-700', text: 'text-gray-400', glow: '' };
    };

    return (
        <div className="flex flex-col h-full bg-gray-900">
            <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Snippet Library</h2>
                    <button onClick={onAddSnippet} className="bg-primary-600 hover:bg-primary-500 text-white p-1.5 rounded shadow-lg transition-transform hover:scale-105" title="Save Selection">
                        <Plus size={14}/>
                    </button>
                </div>
                <input type="text" placeholder="Filter snippets..." className="w-full bg-black/20 border border-gray-800 rounded px-3 py-1.5 text-xs text-white focus:border-primary-500 outline-none mb-1"/>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3">
                {snippets.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2 opacity-60">
                        <Scissors size={32} />
                        <p className="text-xs">No snippets yet</p>
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                    {snippets.map(s => {
                        const style = getSnippetStyle(s);
                        return (
                            <div 
                                key={s.id} 
                                onClick={() => onInsertSnippet(s.code)}
                                className={`relative aspect-square rounded-xl border ${style.border} ${style.bg} flex flex-col items-center justify-center p-3 cursor-pointer group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl ${style.glow}`}
                            >
                                {/* Background Pattern */}
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent pointer-events-none"></div>
                                
                                <div className={`mb-3 p-3 rounded-full bg-black/30 backdrop-blur-sm ${style.text} group-hover:scale-110 transition-transform duration-300`}>
                                    {style.icon}
                                </div>
                                
                                <div className="text-[10px] font-bold text-gray-300 text-center uppercase tracking-wide truncate w-full z-10 group-hover:text-white">
                                    {s.name}
                                </div>
                                
                                {/* Hover Actions Overlay */}
                                <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onInsertSnippet(s.code); }}
                                        className="text-xs font-bold text-white bg-primary-600 px-3 py-1.5 rounded-lg shadow hover:bg-primary-500 w-20"
                                    >
                                        Insert
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteSnippet(s.id); }}
                                        className="text-xs font-bold text-red-300 bg-red-900/30 border border-red-800 px-3 py-1.5 rounded-lg hover:bg-red-900/50 w-20"
                                    >
                                        Delete
                                    </button>
                                    <div className="text-[8px] text-gray-500 font-mono px-2 truncate w-full text-center mt-1">
                                        {s.language}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- AGENTS PANEL ---
interface AgentsPanelProps {
  activeTask: AgentTask | null;
  history?: AgentTask[];
  onStartTask: (agent: AIAgent, type: AgentTask['type']) => void;
  onCancelTask?: () => void;
  activeAgent?: AIAgent | null;
}

export const AgentsPanel: React.FC<AgentsPanelProps> = ({ activeTask, history = [], onStartTask, onCancelTask, activeAgent }) => {
  const [team, setTeam] = useState<AIAgent[]>([]);
  const [stats, setStats] = useState<{time: string, velocity: number}[]>([]);
  const [historyOpen, setHistoryOpen] = useState(true);

  const loadAgentsAndStats = () => {
      const savedAgents = localStorage.getItem('omni_agents');
      setTeam(savedAgents ? JSON.parse(savedAgents) : DEFAULT_AGENTS);
      
      const savedStats = localStorage.getItem('omni_team_stats');
      const historyStats = savedStats ? JSON.parse(savedStats) : [];
      
      if (historyStats.length > 0) {
          setStats(historyStats);
      } else {
          setStats([
              { time: '10:00', velocity: 10 },
              { time: '11:00', velocity: 25 },
              { time: '12:00', velocity: 15 },
          ]);
      }
  };

  useEffect(() => {
      loadAgentsAndStats();
      window.addEventListener('omniAgentsUpdated', loadAgentsAndStats);
      window.addEventListener('omniStatsUpdated', loadAgentsAndStats);
      
      return () => {
          window.removeEventListener('omniAgentsUpdated', loadAgentsAndStats);
          window.removeEventListener('omniStatsUpdated', loadAgentsAndStats);
      }
  }, []);

  const renderAgentNode = (role: string, label: string, icon: any) => {
      const isActive = activeAgent?.role.includes(role) || (role === 'Manager' && activeAgent?.isManager);
      return (
          <div className={`flex flex-col items-center transition-all duration-300 ${isActive ? 'scale-110 opacity-100' : 'opacity-50 scale-95'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 shadow-lg transition-colors ${isActive ? 'bg-primary-500 text-white ring-2 ring-primary-300' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                  {icon}
              </div>
              <span className={`text-[9px] font-bold uppercase ${isActive ? 'text-white' : 'text-gray-600'}`}>{label}</span>
          </div>
      );
  };

  return (
    <div className="flex flex-col h-full">
        {/* Active Workflow Graph */}
        {activeTask && activeTask.status === 'running' && (
            <div className="p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between relative overflow-hidden">
                {/* Connecting Lines */}
                <div className="absolute top-8 left-10 right-10 h-0.5 bg-gray-800 -z-0"></div>
                
                {renderAgentNode('Manager', 'Plan', <Shield size={14}/>)}
                {renderAgentNode('Frontend', 'Build', <Bot size={14}/>)}
                {renderAgentNode('QA', 'Critique', <AlertCircle size={14}/>)}
                
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900/10 pointer-events-none"></div>
            </div>
        )}

        <div className="p-4 border-b border-gray-800">
            <div className="flex justify-between items-center mb-3">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Team Velocity</h2>
                <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-900/50 flex items-center gap-1">
                    <Zap size={10} /> Live
                </span>
            </div>
            
            <div className="h-24 mb-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats}>
                        <defs>
                            <linearGradient id="colorVel" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Tooltip contentStyle={{backgroundColor: '#111827', border: '1px solid #374151', fontSize: '10px'}} />
                        <Area type="monotone" dataKey="velocity" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVel)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {activeTask ? (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 animate-in fade-in shadow-lg shadow-blue-900/10 flex flex-col h-full max-h-[300px]">
                    <div className="flex items-center justify-between mb-3 shrink-0">
                        <h3 className="text-sm font-bold text-white truncate max-w-[150px]">{activeTask.name}</h3>
                        {activeTask.status === 'completed' ? <Check size={16} className="text-green-500"/> : activeTask.status === 'cancelled' ? <AlertCircle size={16} className="text-red-500"/> : <RefreshCw size={14} className="text-blue-500 animate-spin"/>}
                    </div>
                    
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2 overflow-hidden shrink-0">
                        <div className={`h-full transition-all duration-300 ${activeTask.status === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${(activeTask.processedFiles / (activeTask.totalFiles || 1)) * 100}%` }}></div>
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between mb-4 shrink-0">
                        <span>{activeTask.status === 'completed' ? 'Done' : activeTask.status === 'cancelled' ? 'Stopped' : 'Processing...'}</span>
                        <span>{activeTask.processedFiles}/{activeTask.totalFiles} files</span>
                    </div>
                    
                    {activeTask.status === 'running' && onCancelTask && (
                        <button 
                            onClick={onCancelTask}
                            className="w-full mb-4 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-800/50 rounded-lg py-1.5 text-xs font-medium flex items-center justify-center gap-2 transition-colors shrink-0"
                        >
                            <Square size={10} fill="currentColor" /> Stop Task
                        </button>
                    )}

                    {/* Task List Visualization */}
                    <div className="flex-1 overflow-y-auto border border-gray-700 rounded-lg bg-black/50 p-2 space-y-1 mb-2">
                        {activeTask.fileList?.map((file, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] text-gray-300 p-1.5 rounded hover:bg-white/5">
                                <span className="truncate max-w-[140px]">{file.name}</span>
                                {file.status === 'pending' && <span className="w-2 h-2 rounded-full bg-gray-600"></span>}
                                {file.status === 'processing' && <Loader2 size={10} className="text-blue-400 animate-spin"/>}
                                {file.status === 'done' && <Check size={10} className="text-green-500"/>}
                                {file.status === 'error' && <AlertCircle size={10} className="text-red-500"/>}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Bot size={12}/> Assign Task</div>
                    
                    {team.filter(a => !a.isManager).map(agent => (
                        <div 
                            key={agent.id}
                            className="w-full bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-xl p-3 transition-all group"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${agent.role.includes('QA') ? 'bg-green-900/30 text-green-400' : agent.role.includes('Backend') ? 'bg-purple-900/30 text-purple-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                    {agent.avatar}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-gray-200 group-hover:text-white">{agent.name}</div>
                                    <div className="text-[10px] text-gray-500">{agent.role}</div>
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mt-2">
                                <button 
                                    onClick={() => onStartTask(agent, 'tests')}
                                    className="flex-1 bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded py-1 text-[10px] text-gray-300 transition-colors"
                                >
                                    Tests
                                </button>
                                <button 
                                    onClick={() => onStartTask(agent, 'docs')}
                                    className="flex-1 bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded py-1 text-[10px] text-gray-300 transition-colors"
                                >
                                    Docs
                                </button>
                                <button 
                                    onClick={() => onStartTask(agent, 'refactor')}
                                    className="flex-1 bg-gray-900 hover:bg-gray-700 border border-gray-700 rounded py-1 text-[10px] text-gray-300 transition-colors"
                                >
                                    Refactor
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {history.length > 0 && (
                <div className="pt-4 border-t border-gray-800">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 cursor-pointer flex items-center justify-between" onClick={() => setHistoryOpen(!historyOpen)}>
                        <span className="flex items-center gap-2"><Clock size={12}/> Recent Tasks</span>
                        {historyOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    </div>
                    
                    {historyOpen && (
                        <div className="space-y-2">
                            {history.map((task, idx) => (
                                <div key={idx} className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50 flex items-center justify-between">
                                    <div className="min-w-0">
                                        <div className="text-[11px] font-medium text-gray-300 truncate">{task.name}</div>
                                        <div className="text-[9px] text-gray-500">{task.processedFiles} files • {task.status}</div>
                                    </div>
                                    {task.status === 'completed' ? <Check size={14} className="text-green-500"/> : <AlertCircle size={14} className="text-red-500"/>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};
