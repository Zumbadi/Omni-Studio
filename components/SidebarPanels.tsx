
import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Search, Bug, Play, Pause, Trash2, Package, Puzzle, Download, Cloud, Check, AlertCircle, RefreshCw, Terminal, Shield, Bot, FileText, ChevronRight, ChevronDown, Plus, X } from 'lucide-react';
import { FileNode, GitCommit as GitCommitType, Extension, AuditIssue, AgentTask, SocialPost, AudioTrack, AIAgent } from '../types';
import { Button } from './Button';
import { DEFAULT_AGENTS } from '../constants';

// ... (GitPanel, SearchPanel, DebugPanel, ExtensionsPanel, AssetsPanel remain unchanged)

// --- GIT PANEL ---
interface GitPanelProps {
  files: FileNode[];
  commits: GitCommitType[];
  currentBranch: string;
  onCommit: (msg: string) => void;
  onSwitchBranch: () => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({ files, commits, currentBranch, onCommit, onSwitchBranch }) => {
  const [message, setMessage] = useState('');
  
  const getChangedFiles = (nodes: FileNode[], path = ''): {name: string, status: string, path: string}[] => {
      let changed: {name: string, status: string, path: string}[] = [];
      nodes.forEach(node => {
          const currentPath = path ? `${path}/${node.name}` : node.name;
          if (node.type === 'file' && node.gitStatus && node.gitStatus !== 'unmodified') {
              changed.push({ name: node.name, status: node.gitStatus, path: currentPath });
          }
          if (node.children) {
              changed = changed.concat(getChangedFiles(node.children, currentPath));
          }
      });
      return changed;
  };

  const changes = getChangedFiles(files);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
         <div className="flex justify-between items-center mb-4">
             <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Source Control</h2>
             <button onClick={onSwitchBranch} className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300">
                 <GitBranch size={12}/> {currentBranch}
             </button>
         </div>
         <div className="space-y-2">
             <textarea 
                className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-gray-300 focus:border-primary-500 focus:outline-none resize-none h-16" 
                placeholder="Commit message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
             />
             <Button size="sm" className="w-full" onClick={() => { onCommit(message); setMessage(''); }} disabled={!message || changes.length === 0}>
                 <Check size={14} className="mr-2"/> Commit
             </Button>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
          {changes.length > 0 && (
              <div className="mb-6">
                  <div className="px-2 text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between">
                      <span>Changes</span>
                      <span className="bg-gray-800 px-1.5 rounded text-gray-400">{changes.length}</span>
                  </div>
                  {changes.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-800 rounded cursor-pointer group">
                          <span className={`text-[10px] font-bold w-4 ${file.status === 'added' ? 'text-green-500' : file.status === 'modified' ? 'text-yellow-500' : 'text-red-500'}`}>
                              {file.status === 'added' ? 'A' : file.status === 'modified' ? 'M' : 'D'}
                          </span>
                          <span className="text-xs text-gray-300 truncate flex-1">{file.name}</span>
                          <span className="text-[10px] text-gray-600 truncate max-w-[80px]">{file.path}</span>
                      </div>
                  ))}
              </div>
          )}

          <div className="px-2 text-xs font-bold text-gray-500 uppercase mb-2">History</div>
          <div className="relative border-l border-gray-800 ml-3 space-y-4 pb-4">
              {commits.map((commit, i) => (
                  <div key={commit.id} className="ml-4 relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-gray-700 border-2 border-gray-900"></div>
                      <div className="text-xs font-medium text-gray-300">{commit.message}</div>
                      <div className="text-[10px] text-gray-500 flex gap-2 mt-0.5">
                          <span>{commit.hash}</span>
                          <span>•</span>
                          <span>{commit.date}</span>
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

// --- SEARCH PANEL ---
interface SearchPanelProps {
  query: string;
  onSearch: (q: string) => void;
  results: {fileId: string, fileName: string, line: number, preview: string}[];
  onResultClick: (fileId: string, line: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ query, onSearch, results, onResultClick }) => {
  return (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-800">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Search</h2>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={14} />
                <input 
                    type="text" 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none" 
                    placeholder="Search in files..." 
                    value={query} 
                    onChange={e => onSearch(e.target.value)} 
                    autoFocus
                />
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
            {results.length === 0 && query && <div className="text-center text-xs text-gray-500 mt-10">No results found.</div>}
            {results.map(res => (
                <div key={`${res.fileId}-${res.line}`} onClick={() => onResultClick(res.fileId, res.line)} className="p-2 hover:bg-gray-800 cursor-pointer rounded mb-1 group">
                    <div className="flex items-center gap-2 mb-1">
                        <FileText size={12} className="text-gray-500"/>
                        <span className="text-xs text-gray-300 font-medium">{res.fileName}</span>
                        <span className="text-[10px] text-gray-600 bg-gray-800 px-1 rounded">{res.line}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-mono truncate pl-5 border-l-2 border-gray-700 group-hover:border-primary-500/50">
                        {res.preview}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

// --- DEBUG PANEL ---
interface DebugPanelProps {
  variables: {name: string, value: string}[];
  breakpoints: number[];
  onRemoveBreakpoint: (line: number) => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ variables, breakpoints, onRemoveBreakpoint }) => {
  return (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Run & Debug</h2>
            <div className="flex gap-1">
               <button className="p-1 hover:bg-green-900/30 text-green-500 rounded"><Play size={14}/></button>
               <button className="p-1 hover:bg-gray-800 text-gray-400 rounded"><Pause size={14}/></button>
               <button className="p-1 hover:bg-red-900/30 text-red-500 rounded"><Trash2 size={14}/></button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            <div className="border-b border-gray-800">
                <div className="px-4 py-2 bg-gray-900/50 text-xs font-bold text-gray-400 flex items-center gap-2"><ChevronDown size={12}/> Variables</div>
                {variables.length === 0 && <div className="px-4 py-2 text-xs text-gray-600 italic">No active variables</div>}
                {variables.map((v, i) => (
                    <div key={i} className="flex justify-between px-4 py-1 text-xs font-mono hover:bg-gray-800">
                        <span className="text-blue-400">{v.name}</span>
                        <span className="text-orange-300 truncate max-w-[120px]">{v.value}</span>
                    </div>
                ))}
            </div>

            <div className="border-b border-gray-800">
                <div className="px-4 py-2 bg-gray-900/50 text-xs font-bold text-gray-400 flex items-center gap-2"><ChevronDown size={12}/> Breakpoints</div>
                {breakpoints.length === 0 && <div className="px-4 py-2 text-xs text-gray-600 italic">No breakpoints set</div>}
                {breakpoints.map((bp, i) => (
                    <div key={i} className="flex justify-between items-center px-4 py-1 text-xs hover:bg-gray-800 group">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-gray-300">Line {bp}</span>
                        </div>
                        <button onClick={() => onRemoveBreakpoint(bp)} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white"><X size={12}/></button>
                    </div>
                ))}
            </div>
            
            <div className="border-b border-gray-800">
                <div className="px-4 py-2 bg-gray-900/50 text-xs font-bold text-gray-400 flex items-center gap-2"><ChevronRight size={12}/> Call Stack</div>
            </div>
        </div>
    </div>
  );
};

// --- EXTENSIONS PANEL ---
interface ExtensionsPanelProps {
  extensions: Extension[];
  onToggle: (id: string) => void;
}

export const ExtensionsPanel: React.FC<ExtensionsPanelProps> = ({ extensions, onToggle }) => {
  const [query, setQuery] = useState('');
  const filtered = extensions.filter(e => e.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-800">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Extensions</h2>
            <input 
                type="text" 
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-primary-500 focus:outline-none" 
                placeholder="Search Marketplace..." 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
            />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filtered.map(ext => (
                <div key={ext.id} className="bg-gray-800/50 border border-gray-800 p-3 rounded-lg flex gap-3 hover:bg-gray-800 transition-colors">
                    <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center text-lg font-bold text-gray-400 flex-shrink-0">{ext.icon}</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <h3 className="text-sm font-bold text-gray-200 truncate">{ext.name}</h3>
                            {ext.installed && <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded border border-blue-900/50">Installed</span>}
                        </div>
                        <p className="text-[10px] text-gray-500 line-clamp-2 my-1">{ext.description}</p>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] text-gray-600">{ext.publisher} • <Download size={10} className="inline"/> {ext.downloads}</span>
                            <button 
                                onClick={() => onToggle(ext.id)}
                                className={`text-[10px] px-2 py-1 rounded border transition-colors ${ext.installed ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800' : 'bg-primary-600 text-white border-primary-500 hover:bg-primary-500'}`}
                            >
                                {ext.installed ? 'Disable' : 'Install'}
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

// --- ASSETS PANEL ---
interface AssetsPanelProps {
  assets: {type: 'image' | 'video' | 'audio', url: string, name: string}[];
}

export const AssetsPanel: React.FC<AssetsPanelProps> = ({ assets }) => {
  return (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-800">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Project Assets</h2>
            <p className="text-[10px] text-gray-600">Drag and drop to import into code</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 content-start">
            {assets.length === 0 && <div className="col-span-2 text-center text-gray-500 text-xs py-10">No assets found.</div>}
            {assets.map((asset, i) => (
                <div 
                    key={i} 
                    className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden group cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => {
                        const codeSnippet = asset.type === 'image' ? `<img src="${asset.url}" alt="${asset.name}" />` : 
                                          asset.type === 'video' ? `<video src="${asset.url}" controls />` : 
                                          `<audio src="${asset.url}" controls />`;
                        e.dataTransfer.setData('text/plain', codeSnippet);
                    }}
                >
                    <div className="aspect-square bg-black relative flex items-center justify-center">
                        {asset.type === 'image' && <img src={asset.url} className="w-full h-full object-cover" />}
                        {asset.type === 'video' && <video src={asset.url} className="w-full h-full object-cover" />}
                        {asset.type === 'audio' && <div className="w-full h-full flex items-center justify-center bg-purple-900/20"><div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center"><Terminal size={14} /></div></div>}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Cloud size={20} className="text-white"/>
                        </div>
                    </div>
                    <div className="p-2">
                        <div className="text-[10px] font-medium text-gray-300 truncate" title={asset.name}>{asset.name}</div>
                        <div className="text-[9px] text-gray-600 uppercase">{asset.type}</div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

// --- AGENTS PANEL ---
interface AgentsPanelProps {
  activeTask: AgentTask | null;
  onStartTask: (type: AgentTask['type']) => void;
}

export const AgentsPanel: React.FC<AgentsPanelProps> = ({ activeTask, onStartTask }) => {
  const [team, setTeam] = useState<AIAgent[]>([]);

  const loadAgents = () => {
      const saved = localStorage.getItem('omni_agents');
      setTeam(saved ? JSON.parse(saved) : DEFAULT_AGENTS);
  };

  useEffect(() => {
      loadAgents();
      window.addEventListener('omniAgentsUpdated', loadAgents);
      return () => window.removeEventListener('omniAgentsUpdated', loadAgents);
  }, []);

  return (
    <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-800">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">AI Agents</h2>
            <div className="flex items-center gap-2 bg-blue-900/20 p-2 rounded border border-blue-800">
                <Bot size={16} className="text-blue-400" />
                <div className="flex-1">
                    <div className="text-xs font-bold text-blue-200">Omni Team</div>
                    <div className="text-[10px] text-blue-400">{team.length} Agents Ready</div>
                </div>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {activeTask ? (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 animate-in fade-in">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-white">{activeTask.name}</h3>
                        {activeTask.status === 'completed' ? <Check size={16} className="text-green-500"/> : <RefreshCw size={14} className="text-blue-500 animate-spin"/>}
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${(activeTask.processedFiles / activeTask.totalFiles) * 100}%` }}></div>
                    </div>
                    <div className="text-xs text-gray-400 flex justify-between mb-4">
                        <span>{activeTask.status === 'completed' ? 'Done' : 'Processing...'}</span>
                        <span>{activeTask.processedFiles}/{activeTask.totalFiles} files</span>
                    </div>
                    
                    <div className="bg-black rounded p-2 font-mono text-[10px] h-32 overflow-y-auto text-gray-400 border border-gray-800">
                        {activeTask.logs.map((log, i) => <div key={i}>{log}</div>)}
                        {activeTask.status === 'running' && <div className="animate-pulse">_</div>}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="text-xs font-bold text-gray-500 uppercase">Assign Task</div>
                    
                    {team.filter(a => !a.isManager).map(agent => (
                        <button 
                            key={agent.id}
                            onClick={() => onStartTask(agent.role.toLowerCase().includes('qa') ? 'tests' : agent.role.toLowerCase().includes('refactor') ? 'refactor' : 'docs')} 
                            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-xl p-3 text-left transition-all group"
                        >
                            <div className="flex items-center gap-3 mb-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${agent.role.includes('QA') ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                                    {agent.avatar}
                                </div>
                                <div className="font-bold text-sm text-gray-200 group-hover:text-white">{agent.name}</div>
                            </div>
                            <p className="text-[10px] text-gray-500 pl-11 line-clamp-2">{agent.description}</p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};
