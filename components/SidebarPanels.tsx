
import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Search, Bug, Play, Pause, Trash2, Package, Puzzle, Download, Cloud, Check, AlertCircle, RefreshCw, Terminal, Shield, Bot, FileText, ChevronRight, ChevronDown, Plus, X, TrendingUp, User, Zap } from 'lucide-react';
import { FileNode, GitCommit as GitCommitType, Extension, AuditIssue, AgentTask, SocialPost, AudioTrack, AIAgent } from '../types';
import { Button } from './Button';
import { DEFAULT_AGENTS } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- GIT PANEL ---
interface GitPanelProps { files: FileNode[]; commits: GitCommitType[]; currentBranch: string; onCommit: (msg: string) => void; onSwitchBranch: () => void; }
export const GitPanel: React.FC<GitPanelProps> = ({ files, commits, currentBranch, onCommit, onSwitchBranch }) => {
  const [message, setMessage] = useState('');
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
         <div className="flex justify-between items-center mb-4">
             <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Source Control</h2>
             <button onClick={onSwitchBranch} className="flex items-center gap-1 text-xs text-primary-400"><GitBranch size={12}/> {currentBranch}</button>
         </div>
         <textarea className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-gray-300 mb-2 h-16" placeholder="Commit message..." value={message} onChange={e => setMessage(e.target.value)} />
         <Button size="sm" className="w-full" onClick={() => { onCommit(message); setMessage(''); }}>Commit</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {commits.map(c => <div key={c.id} className="text-xs text-gray-400 p-2 border-l border-gray-700 pl-3">{c.message}</div>)}
      </div>
    </div>
  );
};

// --- SEARCH PANEL ---
interface SearchPanelProps { query: string; onSearch: (q: string) => void; results: any[]; onResultClick: (id: string, line: number) => void; }
export const SearchPanel: React.FC<SearchPanelProps> = ({ query, onSearch, results, onResultClick }) => (
    <div className="flex flex-col h-full"><div className="p-4 border-b border-gray-800"><input type="text" className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-white" placeholder="Search..." value={query} onChange={e => onSearch(e.target.value)} /></div><div className="flex-1 overflow-y-auto p-2">{results.map((res, i) => <div key={i} onClick={() => onResultClick(res.fileId, res.line)} className="p-2 cursor-pointer hover:bg-gray-800 text-xs text-gray-300">{res.fileName} ({res.line})</div>)}</div></div>
);

// --- DEBUG PANEL ---
interface DebugPanelProps { variables: any[]; breakpoints: number[]; onRemoveBreakpoint: (l: number) => void; }
export const DebugPanel: React.FC<DebugPanelProps> = ({ variables, breakpoints, onRemoveBreakpoint }) => (
    <div className="flex flex-col h-full"><div className="p-4 border-b border-gray-800"><h2 className="text-xs font-bold text-gray-500 uppercase">Debug</h2></div><div className="p-4 text-xs text-gray-400">{breakpoints.length} breakpoints active</div></div>
);

// --- EXTENSIONS PANEL ---
interface ExtensionsPanelProps { extensions: Extension[]; onToggle: (id: string) => void; }
export const ExtensionsPanel: React.FC<ExtensionsPanelProps> = ({ extensions, onToggle }) => (
    <div className="flex flex-col h-full"><div className="p-4 border-b border-gray-800"><h2 className="text-xs font-bold text-gray-500 uppercase">Extensions</h2></div><div className="p-2">{extensions.map(e => <div key={e.id} className="p-2 hover:bg-gray-800 text-xs text-gray-300 flex justify-between"><span>{e.name}</span><button onClick={() => onToggle(e.id)}>{e.installed ? 'On' : 'Off'}</button></div>)}</div></div>
);

// --- ASSETS PANEL ---
interface AssetsPanelProps { assets: any[]; }
export const AssetsPanel: React.FC<AssetsPanelProps> = ({ assets }) => (
    <div className="flex flex-col h-full"><div className="p-4 border-b border-gray-800"><h2 className="text-xs font-bold text-gray-500 uppercase">Assets</h2></div><div className="p-2 grid grid-cols-2 gap-2">{assets.map((a, i) => <div key={i} className="bg-gray-800 h-20 rounded flex items-center justify-center text-xs text-gray-500">{a.name}</div>)}</div></div>
);

// --- AGENTS PANEL ---
interface AgentsPanelProps {
  activeTask: AgentTask | null;
  onStartTask: (agent: AIAgent, type: AgentTask['type']) => void;
}

export const AgentsPanel: React.FC<AgentsPanelProps> = ({ activeTask, onStartTask }) => {
  const [team, setTeam] = useState<AIAgent[]>([]);
  const [stats, setStats] = useState<{time: string, velocity: number}[]>([]);

  const loadAgentsAndStats = () => {
      const savedAgents = localStorage.getItem('omni_agents');
      setTeam(savedAgents ? JSON.parse(savedAgents) : DEFAULT_AGENTS);
      
      const savedStats = localStorage.getItem('omni_team_stats');
      const history = savedStats ? JSON.parse(savedStats) : [];
      
      // Format history for chart or use placeholder if empty
      if (history.length > 0) {
          setStats(history);
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

  return (
    <div className="flex flex-col h-full">
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

            <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-gray-800 rounded p-2 border border-gray-700">
                    <div className="text-[10px] text-gray-500">Active Agents</div>
                    <div className="text-lg font-bold text-white">{team.length}</div>
                </div>
                <div className="bg-gray-800 rounded p-2 border border-gray-700">
                    <div className="text-[10px] text-gray-500">Recent Velocity</div>
                    <div className="text-lg font-bold text-white">{stats.length > 0 ? stats[stats.length-1].velocity : 0}</div>
                </div>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {activeTask ? (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 animate-in fade-in shadow-lg shadow-blue-900/10">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-white truncate max-w-[150px]">{activeTask.name}</h3>
                        {activeTask.status === 'completed' ? <Check size={16} className="text-green-500"/> : <RefreshCw size={14} className="text-blue-500 animate-spin"/>}
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${(activeTask.processedFiles / (activeTask.totalFiles || 1)) * 100}%` }}></div>
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between mb-4">
                        <span>{activeTask.status === 'completed' ? 'Done' : 'Processing...'}</span>
                        <span>{activeTask.processedFiles}/{activeTask.totalFiles} files</span>
                    </div>
                    
                    <div className="bg-black rounded p-2 font-mono text-[10px] h-32 overflow-y-auto text-gray-400 border border-gray-800">
                        {activeTask.logs.map((log, i) => <div key={i} className="break-words">{log}</div>)}
                        {activeTask.status === 'running' && <div className="animate-pulse">_</div>}
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
        </div>
    </div>
  );
};
