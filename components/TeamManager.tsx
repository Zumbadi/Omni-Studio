
import React, { useState, useEffect } from 'react';
import { Users, User, X, Plus, Trash2, Bot, Save, Edit2, ShieldCheck, Brain } from 'lucide-react';
import { Button } from './Button';
import { AIAgent } from '../types';
import { DEFAULT_AGENTS } from '../constants';

interface TeamManagerProps {
  onClose: () => void;
}

export const TeamManager: React.FC<TeamManagerProps> = ({ onClose }) => {
  const [agents, setAgents] = useState<AIAgent[]>(() => {
    const saved = localStorage.getItem('omni_agents');
    return saved ? JSON.parse(saved) : DEFAULT_AGENTS;
  });

  const [editingAgent, setEditingAgent] = useState<AIAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [desc, setDesc] = useState('');
  const [model, setModel] = useState<'gemini-3-pro-preview' | 'gemini-2.5-flash'>('gemini-2.5-flash');
  const [prompt, setPrompt] = useState('');
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    localStorage.setItem('omni_agents', JSON.stringify(agents));
  }, [agents]);

  const handleSave = () => {
    if (!name || !role) return;

    if (editingAgent) {
        // Update existing
        const updated = agents.map(a => a.id === editingAgent.id ? { ...a, name, role, description: desc, model, systemPrompt: prompt, isManager } : a);
        setAgents(updated);
    } else {
        // Create new
        const newAgent: AIAgent = {
            id: `ag-${Date.now()}`,
            name,
            role,
            description: desc,
            model,
            systemPrompt: prompt,
            isManager,
            avatar: name[0].toUpperCase()
        };
        setAgents([...agents, newAgent]);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
      if (confirm('Are you sure you want to delete this agent?')) {
          setAgents(agents.filter(a => a.id !== id));
      }
  };

  const startEdit = (agent: AIAgent) => {
      setEditingAgent(agent);
      setName(agent.name);
      setRole(agent.role);
      setDesc(agent.description);
      setModel(agent.model);
      setPrompt(agent.systemPrompt);
      setIsManager(agent.isManager || false);
      setIsCreating(true);
  };

  const resetForm = () => {
      setEditingAgent(null);
      setIsCreating(false);
      setName('');
      setRole('');
      setDesc('');
      setModel('gemini-2.5-flash');
      setPrompt('');
      setIsManager(false);
  };

  // If user promotes agent to manager, enforce stronger model
  useEffect(() => {
      if (isManager) setModel('gemini-3-pro-preview');
  }, [isManager]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="text-primary-500" size={24} /> AI Team Manager
            </h2>
            <p className="text-sm text-gray-400">Define roles, personas, and capabilities for your AI workforce.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer z-50">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar List */}
          <div className="w-1/3 border-r border-gray-800 bg-gray-900/50 p-4 flex flex-col gap-4 overflow-y-auto">
             <Button onClick={() => { resetForm(); setIsCreating(true); }} className="w-full"><Plus size={16} className="mr-2"/> Create New Agent</Button>
             <div className="space-y-2">
                 {agents.map(agent => (
                     <div 
                        key={agent.id} 
                        onClick={() => startEdit(agent)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all hover:border-primary-500/50 group ${editingAgent?.id === agent.id ? 'bg-primary-900/20 border-primary-500' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'}`}
                     >
                         <div className="flex items-center gap-3 mb-1">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${agent.isManager ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                                 {agent.avatar}
                             </div>
                             <div className="flex-1 min-w-0">
                                 <div className="font-semibold text-sm text-gray-200 truncate">{agent.name}</div>
                                 <div className="text-xs text-gray-500 truncate">{agent.role}</div>
                             </div>
                             {agent.isManager && <ShieldCheck size={14} className="text-purple-400"/>}
                         </div>
                     </div>
                 ))}
             </div>
          </div>

          {/* Edit Area */}
          <div className="flex-1 p-8 overflow-y-auto bg-black/20">
             {isCreating ? (
                 <div className="max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
                     <div className="flex justify-between items-center">
                         <h3 className="text-lg font-bold text-white">{editingAgent ? 'Edit Agent' : 'Create Agent'}</h3>
                         {editingAgent && !editingAgent.isManager && (
                             <button onClick={() => handleDelete(editingAgent.id)} className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"><Trash2 size={12}/> Delete</button>
                         )}
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                             <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none" placeholder="e.g. Codey" />
                         </div>
                         <div>
                             <label className="block text-xs font-medium text-gray-400 mb-1">Role</label>
                             <input type="text" value={role} onChange={e => setRole(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none" placeholder="e.g. QA Engineer" />
                         </div>
                     </div>

                     <div>
                         <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                         <input type="text" value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none" placeholder="Short description of responsibilities" />
                     </div>

                     <div className="flex items-center gap-3 p-3 bg-purple-900/20 border border-purple-800 rounded-lg">
                         <input 
                            type="checkbox" 
                            checked={isManager} 
                            onChange={e => setIsManager(e.target.checked)} 
                            className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-gray-700 cursor-pointer"
                         />
                         <div>
                             <span className="block text-sm font-medium text-white">Promote to Manager</span>
                             <span className="text-xs text-gray-400">Managers use Gemini 3 Pro for complex reasoning and task delegation.</span>
                         </div>
                     </div>

                     <div>
                         <label className="block text-xs font-medium text-gray-400 mb-1">Underlying Model</label>
                         <select value={model} onChange={(e) => setModel(e.target.value as any)} disabled={isManager} className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none ${isManager ? 'opacity-50 cursor-not-allowed' : ''}`}>
                             <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                             <option value="gemini-3-pro-preview">Gemini 3 Pro (Reasoning)</option>
                         </select>
                         {isManager && <p className="text-[10px] text-purple-400 mt-1">Manager agents are locked to Gemini 3 Pro.</p>}
                     </div>

                     <div>
                         <label className="block text-xs font-medium text-gray-400 mb-1">System Prompt / Persona</label>
                         <textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none font-mono text-xs leading-relaxed" placeholder="Define how this agent behaves..." />
                     </div>

                     <div className="flex gap-3 pt-4">
                         <Button variant="secondary" onClick={resetForm}>Cancel</Button>
                         <Button onClick={handleSave} disabled={!name || !role}><Save size={16} className="mr-2"/> Save Agent</Button>
                     </div>
                 </div>
             ) : (
                 <div className="h-full flex flex-col items-center justify-center text-gray-500">
                     <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                         <Bot size={40} className="text-gray-600"/>
                     </div>
                     <h3 className="text-lg font-medium text-gray-300 mb-2">Select an Agent to Edit</h3>
                     <p className="text-sm max-w-xs text-center opacity-60">Or create a new specialized agent to add to your development team.</p>
                 </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
