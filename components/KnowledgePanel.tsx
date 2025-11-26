
import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, Edit2, Check, X, BrainCircuit, Globe } from 'lucide-react';
import { KnowledgeDoc } from '../types';
import { Button } from './Button';

interface KnowledgePanelProps {
  docs: KnowledgeDoc[];
  onAddDoc: (doc: KnowledgeDoc) => void;
  onUpdateDoc: (doc: KnowledgeDoc) => void;
  onDeleteDoc: (id: string) => void;
}

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({ docs, onAddDoc, onUpdateDoc, onDeleteDoc }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<KnowledgeDoc['category']>('framework');

  const handleSubmit = () => {
      if (!title || !content) return;
      
      const newDoc: KnowledgeDoc = {
          id: editId || `know-${Date.now()}`,
          title,
          content,
          category,
          isActive: true
      };

      if (editId) onUpdateDoc(newDoc);
      else onAddDoc(newDoc);
      
      resetForm();
  };

  const startEdit = (doc: KnowledgeDoc) => {
      setEditId(doc.id);
      setTitle(doc.title);
      setContent(doc.content);
      setCategory(doc.category);
      setIsCreating(true);
  };

  const resetForm = () => {
      setIsCreating(false);
      setEditId(null);
      setTitle('');
      setContent('');
      setCategory('framework');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
        <div className="p-4 border-b border-gray-800 sticky top-0 z-10 bg-gray-900">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <BrainCircuit size={14} className="text-orange-500"/> Knowledge Base (MCP)
                </h2>
                {!isCreating && (
                    <button onClick={() => setIsCreating(true)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Add Context">
                        <Plus size={14}/>
                    </button>
                )}
            </div>
            
            <p className="text-[10px] text-gray-500 mb-2">
                Add custom documentation or rules here. Agents will use this context during builds.
            </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {isCreating ? (
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 animate-in fade-in slide-in-from-top-2">
                    <input 
                        type="text" 
                        placeholder="Doc Title (e.g. API Specs)" 
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white mb-2 focus:border-primary-500 outline-none"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                    />
                    <select 
                        className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 mb-2 focus:border-primary-500 outline-none"
                        value={category}
                        onChange={e => setCategory(e.target.value as any)}
                    >
                        <option value="framework">Framework/Tech</option>
                        <option value="business">Business Rules</option>
                        <option value="style">Coding Style</option>
                        <option value="other">Other</option>
                    </select>
                    <textarea 
                        placeholder="Paste documentation, interfaces, or rules here..."
                        className="w-full h-32 bg-gray-900 border border-gray-700 rounded p-2 text-xs text-white mb-3 focus:border-primary-500 outline-none font-mono"
                        value={content}
                        onChange={e => setContent(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="secondary" onClick={resetForm}>Cancel</Button>
                        <Button size="sm" onClick={handleSubmit} disabled={!title || !content}>{editId ? 'Update' : 'Add'}</Button>
                    </div>
                </div>
            ) : (
                <>
                    {docs.length === 0 && <div className="text-center text-xs text-gray-600 py-4">No active knowledge.</div>}
                    {docs.map(doc => (
                        <div key={doc.id} className={`bg-gray-800 rounded-lg border p-3 group transition-all ${doc.isActive ? 'border-orange-500/30' : 'border-gray-700 opacity-60'}`}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        checked={doc.isActive} 
                                        onChange={() => onUpdateDoc({...doc, isActive: !doc.isActive})}
                                        className="rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-0 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-gray-200 truncate max-w-[120px]" title={doc.title}>{doc.title}</span>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEdit(doc)} className="p-1 hover:text-white text-gray-500"><Edit2 size={12}/></button>
                                    <button onClick={() => onDeleteDoc(doc.id)} className="p-1 hover:text-red-400 text-gray-500"><Trash2 size={12}/></button>
                                </div>
                            </div>
                            <div className="text-[10px] text-gray-400 line-clamp-3 font-mono bg-black/20 p-1.5 rounded">
                                {doc.content}
                            </div>
                            <div className="mt-2 flex justify-between items-center">
                                <span className="text-[9px] uppercase font-bold text-gray-600 bg-gray-900 px-1.5 rounded">{doc.category}</span>
                                <span className="text-[9px] text-gray-600">{doc.content.length} chars</span>
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    </div>
  );
};
