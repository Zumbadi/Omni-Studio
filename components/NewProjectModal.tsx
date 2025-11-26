
import React, { useState } from 'react';
import { Rocket, X, Globe, Smartphone, Server, ShoppingBag, Activity, Tablet, Wand2, Code, Loader2, Github, FolderDown } from 'lucide-react';
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
  const [mode, setMode] = useState<'blank' | 'templates' | 'git'>('blank');
  
  // Git Import
  const [repoUrl, setRepoUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleCreate = async () => {
    if (mode === 'git') {
        await handleGitImport();
        return;
    }

    if (description) setIsGenerating(true);
    
    let initialFiles: FileNode[] = [];
    
    let baseTemplate = WEB_FILE_TREE;
    if (type === ProjectType.REACT_NATIVE) baseTemplate = NATIVE_FILE_TREE;
    else if (type === ProjectType.NODE_API) baseTemplate = NODE_FILE_TREE;
    else if (type === ProjectType.IOS_APP) baseTemplate = IOS_FILE_TREE;
    else if (type === ProjectType.ANDROID_APP) baseTemplate = ANDROID_FILE_TREE;

    if (description.trim()) {
      const generatedNodes = await generateProjectScaffold(description, type);
      if (generatedNodes && generatedNodes.length > 0) {
        const addIds = (nodes: any[]): FileNode[] => {
           return nodes.map(n => ({
              ...n,
              id: Math.random().toString(36).substr(2, 9),
              gitStatus: 'added' as const,
              children: n.children ? addIds(n.children) : undefined,
              isOpen: n.type === 'directory'
           }));
        };
        initialFiles = addIds(generatedNodes);
      } else {
         initialFiles = baseTemplate;
      }
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
          // In production, this would hit a real backend proxy to avoid CORS and fetch trees
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
