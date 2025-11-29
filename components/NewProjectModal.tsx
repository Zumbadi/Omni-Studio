
import React, { useState, useEffect } from 'react';
import { Rocket, X, Globe, Smartphone, Server, ShoppingBag, Activity, Tablet, Wand2, Code, Loader2, Github, FolderDown, CheckCircle, FileText, Cpu, Layers, Terminal } from 'lucide-react';
import { Button } from './Button';
import { PROJECT_TEMPLATES, WEB_FILE_TREE, NATIVE_FILE_TREE, NODE_FILE_TREE, IOS_FILE_TREE, ANDROID_FILE_TREE } from '../constants';
import { ProjectType, FileNode } from '../types';
import { generateProjectScaffold } from '../services/geminiService';

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, type: ProjectType, description: string, initialFiles: FileNode[]) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>(ProjectType.REACT_WEB);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [mode, setMode] = useState<'blank' | 'templates' | 'git'>('blank');
  
  // Git Import
  const [repoUrl, setRepoUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const addLog = (msg: string) => setGenerationLogs(prev => [...prev, msg].slice(-8));

  const handleCreate = async () => {
    if (mode === 'git') {
        await handleGitImport();
        return;
    }

    if (description) {
        setIsGenerating(true);
        setGenerationStep('Analyzing Blueprint...');
        addLog('> Initializing neural engine...');
        addLog('> Parsing project requirements...');
    }
    
    let initialFiles: FileNode[] = [];
    
    let baseTemplate = WEB_FILE_TREE;
    if (type === ProjectType.REACT_NATIVE) baseTemplate = NATIVE_FILE_TREE;
    else if (type === ProjectType.NODE_API) baseTemplate = NODE_FILE_TREE;
    else if (type === ProjectType.IOS_APP) baseTemplate = IOS_FILE_TREE;
    else if (type === ProjectType.ANDROID_APP) baseTemplate = ANDROID_FILE_TREE;

    if (description.trim()) {
      await new Promise(r => setTimeout(r, 1200));
      setGenerationStep('Structuring Architecture...');
      addLog('> Designing component hierarchy...');
      addLog(`> Selected framework: ${type}`);
      await new Promise(r => setTimeout(r, 2500)); // Longer visual pause for architecture
      
      const generatedNodes = await generateProjectScaffold(description, type);
      
      setGenerationStep('Generating Boilerplate...');
      addLog('> Writing configuration files...');
      
      if (generatedNodes && generatedNodes.length > 0) {
        const addIds = (nodes: any[]): FileNode[] => {
           return nodes.map(n => {
              if (Math.random() > 0.6) addLog(`> Created ${n.name}`);
              return {
                  ...n,
                  id: Math.random().toString(36).substr(2, 9),
                  gitStatus: 'added' as const,
                  children: n.children ? addIds(n.children) : undefined,
                  isOpen: n.type === 'directory'
              };
           });
        };
        initialFiles = addIds(generatedNodes);
      } else {
         initialFiles = baseTemplate;
      }
      
      setGenerationStep('Finalizing Project...');
      addLog('> Installing dependencies...');
      addLog('> Linking modules...');
      await new Promise(r => setTimeout(r, 800));
      addLog('> System Ready.');
    } else {
      initialFiles = baseTemplate;
    }

    onCreate(name, type, description, initialFiles);
    setIsGenerating(false);
  };

  const handleGitImport = async () => {
      if (!repoUrl) return;
      setIsImporting(true);
      
      try {
          const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (!match) throw new Error("Invalid GitHub URL. Use format: https://github.com/owner/repo");
          const [_, owner, repo] = match;
          
          // Simulate fetch
          await new Promise(r => setTimeout(r, 1500));
          
          const importedFiles: FileNode[] = [
              { id: 'root', name: 'src', type: 'directory', isOpen: true, children: [], gitStatus: 'added' },
              { id: 'pkg', name: 'package.json', type: 'file', content: '{\n  "name": "' + repo + '",\n  "version": "1.0.0"\n}', gitStatus: 'added' },
              { id: 'read', name: 'README.md', type: 'file', content: `# ${repo}\n\nImported from GitHub: ${repoUrl}`, gitStatus: 'added' }
          ];

          onCreate(repo, ProjectType.REACT_WEB, `Imported from ${repoUrl}`, importedFiles);
          onClose();
      } catch (e: any) {
          alert(e.message);
      }
      setIsImporting(false);
  };

  const handleTemplateSelect = (t: any) => {
      setName(t.name);
      setType(t.type);
      setDescription(t.prompt);
      setMode('blank');
  };

  const getTemplateIcon = (icon: string) => {
      if (icon === 'Globe') return <Globe size={18} />;
      if (icon === 'Smartphone') return <Smartphone size={18} />;
      if (icon === 'Server') return <Server size={18} />;
      if (icon === 'ShoppingBag') return <ShoppingBag size={18} />;
      if (icon === 'Activity') return <Activity size={18} />;
      return <Code size={18} />;
  };

  // Cinematic "Architecting" State
  if (isGenerating) {
      const isArchitecting = generationStep === 'Structuring Architecture...';

      return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[200] p-4 font-mono overflow-hidden">
            {/* Background Grid Animation */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] pointer-events-none"></div>
            
            <div className="relative z-10 w-full max-w-3xl flex flex-col items-center">
                {/* Central Visual: Neural Core vs Blueprint */}
                <div className="relative mb-12 h-40 w-full flex items-center justify-center transition-all duration-700">
                    {isArchitecting ? (
                        <div className="relative w-64 h-48 animate-in zoom-in duration-700">
                            {/* Blueprint Schematic */}
                            <div className="absolute inset-0 border border-blue-500/30 bg-blue-900/10 backdrop-blur-sm rounded-lg flex flex-col p-4 gap-4 shadow-[0_0_60px_rgba(59,130,246,0.2)] animate-pulse">
                                {/* Header Bar */}
                                <div className="h-4 w-1/3 bg-blue-400/20 rounded animate-[pulse_2s_infinite]"></div>
                                
                                {/* Blocks */}
                                <div className="flex-1 flex gap-4">
                                    <div className="w-1/3 bg-blue-500/10 rounded border border-blue-400/20 flex items-center justify-center relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent animate-[scan_3s_linear_infinite]"></div>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="h-1/2 bg-blue-500/10 rounded border border-blue-400/20 w-full relative overflow-hidden">
                                             <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-400/50 animate-[scan_2s_linear_infinite]"></div>
                                        </div>
                                        <div className="h-1/2 flex gap-2">
                                            <div className="flex-1 bg-blue-500/10 rounded border border-blue-400/20"></div>
                                            <div className="flex-1 bg-blue-500/10 rounded border border-blue-400/20"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Floating Icon */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900/80 p-3 rounded-full border border-blue-500/50 shadow-2xl z-20">
                                <Layers size={32} className="text-blue-400 drop-shadow-lg" />
                            </div>
                            
                            {/* Orbiting Connection Nodes */}
                            <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full border border-blue-400/30 bg-gray-950 flex items-center justify-center animate-bounce shadow-lg shadow-blue-900/40 z-30">
                                <Globe size={18} className="text-blue-400"/>
                            </div>
                            <div className="absolute -bottom-3 -left-5 w-10 h-10 rounded-full border border-purple-400/30 bg-gray-950 flex items-center justify-center animate-bounce delay-700 shadow-lg shadow-purple-900/40 z-30">
                                <Server size={16} className="text-purple-400"/>
                            </div>
                            
                            {/* Connecting Lines (Simulated) */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
                                <line x1="0" y1="0" x2="-20" y2="-20" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" className="opacity-50" />
                                <line x1="100%" y1="100%" x2="110%" y2="110%" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" className="opacity-50" />
                            </svg>
                        </div>
                    ) : (
                        <div className="w-32 h-32 rounded-full border border-primary-500/30 flex items-center justify-center relative bg-gray-900/50 backdrop-blur-sm shadow-[0_0_50px_rgba(79,70,229,0.3)] animate-in fade-in duration-500">
                            <div className="absolute inset-0 rounded-full border border-primary-500/20 animate-[spin_10s_linear_infinite]"></div>
                            <div className="absolute inset-2 rounded-full border border-purple-500/20 animate-[spin_15s_linear_infinite_reverse]"></div>
                            <Cpu size={48} className="text-primary-400 animate-pulse" />
                        </div>
                    )}
                    
                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-gray-900/80 px-4 py-1.5 rounded-full border border-gray-700 text-[10px] text-gray-400 uppercase tracking-widest shadow-lg whitespace-nowrap backdrop-blur-md">
                        {isArchitecting ? "Blueprint Mode Active" : "Neural Engine Active"}
                    </div>
                </div>
                
                {/* Status Text */}
                <h2 className={`text-3xl font-bold mb-2 tracking-tight animate-pulse transition-colors duration-500 text-center ${isArchitecting ? 'text-blue-400' : 'text-white'}`}>
                    {generationStep}
                </h2>
                <p className="text-sm text-gray-500 mb-8 max-w-md text-center h-10">
                    {isArchitecting 
                        ? "Defining system boundaries, routing tables, and component hierarchy..."
                        : "Constructing project scaffold, analyzing dependency graph, and generating source code."}
                </p>
                
                {/* Steps Visualizer */}
                <div className="flex justify-between w-full max-w-lg mb-10 px-4 relative">
                    {/* Connecting Line */}
                    <div className="absolute top-1.5 left-8 right-8 h-0.5 bg-gray-800 -z-10"></div>
                    
                    {['Blueprint', 'Structure', 'Code', 'Finalize'].map((step, i) => {
                        const allSteps = ['Analyzing Blueprint...', 'Structuring Architecture...', 'Generating Boilerplate...', 'Finalizing Project...'];
                        const activeIndex = allSteps.indexOf(generationStep);
                        const isActive = i === activeIndex;
                        const isDone = i < activeIndex;
                        
                        return (
                            <div key={step} className="flex flex-col items-center gap-2 bg-black px-2">
                                <div className={`w-3 h-3 rounded-full transition-all duration-500 border-2 ${isActive ? 'bg-primary-500 border-primary-500 scale-125 shadow-[0_0_10px_#6366f1]' : isDone ? 'bg-green-500 border-green-500' : 'bg-black border-gray-700'}`}></div>
                                <span className={`text-[10px] uppercase tracking-wider transition-colors duration-300 ${isActive ? 'text-white font-bold' : isDone ? 'text-gray-400' : 'text-gray-700'}`}>{step}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Terminal Log */}
                <div className="w-full bg-black/80 rounded-xl border border-gray-800 p-4 font-mono text-xs shadow-2xl relative overflow-hidden h-48 flex flex-col">
                    <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-2 text-gray-500">
                        <Terminal size={12} />
                        <span className="uppercase tracking-wider text-[10px]">System Log</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-end space-y-1.5 overflow-hidden">
                        {generationLogs.map((log, i) => (
                            <div key={i} className="text-gray-400 animate-in slide-in-from-bottom-2 fade-in duration-300 truncate font-mono">
                                <span className="text-primary-500/50 mr-2">➜</span>
                                {log}
                            </div>
                        ))}
                    </div>
                    {/* Scanning Line */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-500/5 to-transparent h-8 w-full animate-[scan_2s_linear_infinite] pointer-events-none"></div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-800 shrink-0">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Rocket className="text-primary-500" size={24}/> Create New Project
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="flex gap-4 mb-6 border-b border-gray-800 pb-1">
              <button onClick={() => setMode('blank')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mode === 'blank' ? 'border-primary-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>From Scratch</button>
              <button onClick={() => setMode('templates')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mode === 'templates' ? 'border-primary-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Templates</button>
              <button onClick={() => setMode('git')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mode === 'git' ? 'border-primary-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>Git Import</button>
          </div>

          {mode === 'templates' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROJECT_TEMPLATES.map(t => (
                      <div key={t.id} onClick={() => handleTemplateSelect(t)} className="bg-gray-800 border border-gray-700 rounded-xl p-4 cursor-pointer hover:border-primary-500 hover:shadow-lg hover:shadow-primary-900/20 transition-all group">
                          <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-gray-700 rounded-lg text-primary-400 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                                  {getTemplateIcon(t.icon)}
                              </div>
                              <div>
                                  <h3 className="font-bold text-white">{t.name}</h3>
                                  <span className="text-[10px] text-gray-500 bg-gray-900 px-2 py-0.5 rounded border border-gray-700 truncate max-w-[120px] block">{t.type}</span>
                              </div>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2">{t.description}</p>
                      </div>
                  ))}
              </div>
          ) : mode === 'git' ? (
               <div className="space-y-6">
                   <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 text-center">
                       <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-700">
                           <Github size={32} className="text-white"/>
                       </div>
                       <h3 className="text-lg font-medium text-white mb-2">Import from GitHub</h3>
                       <p className="text-sm text-gray-400 mb-6">Paste a repository URL to clone it into Omni-Studio.</p>
                       
                       <div className="relative max-w-md mx-auto">
                           <Github size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                           <input 
                               type="text" 
                               placeholder="https://github.com/username/repo" 
                               value={repoUrl}
                               onChange={e => setRepoUrl(e.target.value)}
                               className="w-full bg-gray-900 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                           />
                       </div>
                   </div>
               </div>
          ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                  <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Project Name</label>
                  <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Super App" 
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:outline-none" 
                      autoFocus
                  />
                  </div>

                  <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Framework</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      {[
                          { t: ProjectType.REACT_WEB, l: 'React Web', i: Globe, c: 'text-primary-500', b: 'border-primary-500', bg: 'bg-primary-900/20' },
                          { t: ProjectType.REACT_NATIVE, l: 'React Native', i: Tablet, c: 'text-purple-500', b: 'border-purple-500', bg: 'bg-purple-900/20' },
                          { t: ProjectType.IOS_APP, l: 'iOS (Swift)', i: Smartphone, c: 'text-blue-500', b: 'border-blue-500', bg: 'bg-blue-900/20' },
                          { t: ProjectType.ANDROID_APP, l: 'Android', i: Smartphone, c: 'text-green-500', b: 'border-green-500', bg: 'bg-green-900/20' },
                          { t: ProjectType.NODE_API, l: 'Node API', i: Server, c: 'text-emerald-500', b: 'border-emerald-500', bg: 'bg-emerald-900/20' },
                      ].map(opt => (
                          <button 
                            key={opt.t}
                            onClick={() => setType(opt.t)}
                            className={`flex flex-col items-center p-4 rounded-lg border transition-all ${type === opt.t ? `${opt.bg} ${opt.b} ring-1` : 'bg-gray-800 border-gray-700 hover:bg-gray-750'}`}
                          >
                            <opt.i size={24} className={type === opt.t ? opt.c : 'text-gray-500 mb-2'} />
                            <div className="text-xs font-medium text-white text-center">{opt.l}</div>
                          </button>
                      ))}
                  </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center gap-2">
                          <Wand2 size={14} className="text-primary-400" /> 
                          AI Blueprint (Optional)
                      </label>
                      <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe your app (e.g., 'A minimalist Todo app with dark mode and local storage'). We will generate the initial file structure."
                      className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-primary-500 focus:outline-none resize-none"
                      />
                  </div>
              </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-850 flex gap-3 justify-end shrink-0">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            {mode === 'git' ? (
                <Button onClick={handleCreate} disabled={isImporting || !repoUrl}>
                    {isImporting ? <Loader2 size={16} className="animate-spin mr-2"/> : <FolderDown size={16} className="mr-2"/>}
                    {isImporting ? 'Cloning...' : 'Clone & Import'}
                </Button>
            ) : (
                <Button onClick={handleCreate} disabled={isGenerating || (!name && mode === 'blank')}>
                    {isGenerating ? <Loader2 size={16} className="animate-spin mr-2" /> : <Rocket size={16} className="mr-2" />}
                    {isGenerating ? 'Architecting...' : 'Initialize Project'}
                </Button>
            )}
        </div>
      </div>
    </div>
  );
};
