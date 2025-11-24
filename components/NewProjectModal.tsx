import React, { useState } from 'react';
import { Rocket, X, Globe, Smartphone, Server, ShoppingBag, Activity, Tablet, Wand2, Code, Loader2 } from 'lucide-react';
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
  const [mode, setMode] = useState<'blank' | 'templates'>('blank');

  const handleCreate = async () => {
    if (description) setIsGenerating(true);
    
    let initialFiles: FileNode[] = [];
    
    // Determine base template based on type
    let baseTemplate = WEB_FILE_TREE;
    if (type === ProjectType.REACT_NATIVE) baseTemplate = NATIVE_FILE_TREE;
    else if (type === ProjectType.NODE_API) baseTemplate = NODE_FILE_TREE;
    else if (type === ProjectType.IOS_APP) baseTemplate = IOS_FILE_TREE;
    else if (type === ProjectType.ANDROID_APP) baseTemplate = ANDROID_FILE_TREE;

    if (description.trim()) {
      // AI Generation
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
          <div className="flex gap-4 mb-6">
              <button onClick={() => setMode('blank')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'blank' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Start from Scratch</button>
              <button onClick={() => setMode('templates')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'templates' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Browse Templates</button>
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
          ) : (
              <div className="space-y-6">
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
                      <button 
                      onClick={() => setType(ProjectType.REACT_WEB)}
                      className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                          type === ProjectType.REACT_WEB ? 'bg-primary-900/20 border-primary-500 ring-1 ring-primary-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                      >
                      <Globe size={24} className={type === ProjectType.REACT_WEB ? 'text-primary-500 mb-2' : 'text-gray-500 mb-2'} />
                      <div className="text-xs font-medium text-white text-center">React Web</div>
                      </button>

                      <button 
                      onClick={() => setType(ProjectType.REACT_NATIVE)}
                      className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                          type === ProjectType.REACT_NATIVE ? 'bg-purple-900/20 border-purple-500 ring-1 ring-purple-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                      >
                      <Tablet size={24} className={type === ProjectType.REACT_NATIVE ? 'text-purple-500 mb-2' : 'text-gray-500 mb-2'} />
                      <div className="text-xs font-medium text-white text-center">React Native</div>
                      </button>

                      <button 
                      onClick={() => setType(ProjectType.IOS_APP)}
                      className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                          type === ProjectType.IOS_APP ? 'bg-blue-900/20 border-blue-500 ring-1 ring-blue-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                      >
                      <div className="w-6 h-6 mb-2 flex items-center justify-center">
                          <img src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg" className="w-5 h-5 invert opacity-70" alt="iOS" />
                      </div>
                      <div className="text-xs font-medium text-white text-center">iOS (Swift)</div>
                      </button>

                      <button 
                      onClick={() => setType(ProjectType.ANDROID_APP)}
                      className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                          type === ProjectType.ANDROID_APP ? 'bg-green-900/20 border-green-500 ring-1 ring-green-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                      >
                      <Smartphone size={24} className={type === ProjectType.ANDROID_APP ? 'text-green-500 mb-2' : 'text-gray-500 mb-2'} />
                      <div className="text-xs font-medium text-white text-center">Android (APK)</div>
                      </button>
                      
                      <button 
                      onClick={() => setType(ProjectType.NODE_API)}
                      className={`flex flex-col items-center p-4 rounded-lg border transition-all ${
                          type === ProjectType.NODE_API ? 'bg-green-900/20 border-green-500 ring-1 ring-green-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                      >
                      <Server size={24} className={type === ProjectType.NODE_API ? 'text-green-500 mb-2' : 'text-gray-500 mb-2'} />
                      <div className="text-xs font-medium text-white text-center">Node.js API</div>
                      </button>
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
            <Button onClick={handleCreate} disabled={isGenerating || !name}>
              {isGenerating ? <Loader2 size={16} className="animate-spin mr-2" /> : <Rocket size={16} className="mr-2" />}
              {isGenerating ? 'Architecting...' : 'Initialize Project'}
            </Button>
        </div>
      </div>
    </div>
  );
};