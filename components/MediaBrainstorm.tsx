
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Sparkles, Move, Trash2, Check, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { expandMindMap } from '../services/geminiService';

interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId?: string;
  type: 'root' | 'idea' | 'media';
}

interface MediaBrainstormProps {
  onConvertToCampaign: (context: string) => void;
}

export const MediaBrainstorm: React.FC<MediaBrainstormProps> = ({ onConvertToCampaign }) => {
  const [nodes, setNodes] = useState<Node[]>([
    { id: 'root', text: 'Central Idea', x: 400, y: 300, type: 'root' }
  ]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDraggingId(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setNodes(prev => prev.map(n => n.id === draggingId ? { ...n, x, y } : n));
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const handleAddNode = (parentId: string) => {
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;
    
    // Add some random offset
    const angle = Math.random() * Math.PI * 2;
    const radius = 150;
    const x = parent.x + Math.cos(angle) * radius;
    const y = parent.y + Math.sin(angle) * radius;

    const newNode: Node = {
      id: `n-${Date.now()}`,
      text: 'New Idea',
      x,
      y,
      parentId,
      type: 'idea'
    };
    setNodes(prev => [...prev, newNode]);
  };

  const handleAiExpand = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setIsExpanding(true);
    // Gather simple context from tree
    const context = nodes.map(n => n.text).join(', ');
    const newIdeas = await expandMindMap(node.text, context);
    
    const newNodes: Node[] = newIdeas.map((idea, i) => {
        // Distribute around parent
        const angle = (i / newIdeas.length) * Math.PI * 2;
        const radius = 200;
        return {
            id: `ai-${Date.now()}-${i}`,
            text: idea,
            x: node.x + Math.cos(angle) * radius,
            y: node.y + Math.sin(angle) * radius,
            parentId: nodeId,
            type: 'idea'
        };
    });
    
    setNodes(prev => [...prev, ...newNodes]);
    setIsExpanding(false);
  };

  const deleteNode = (id: string) => {
      // Cascade delete children
      const toDelete = new Set([id]);
      let changed = true;
      while (changed) {
          changed = false;
          nodes.forEach(n => {
              if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
                  toDelete.add(n.id);
                  changed = true;
              }
          });
      }
      setNodes(prev => prev.filter(n => !toDelete.has(n.id)));
  };

  const handleUpdateText = (id: string, text: string) => {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  };

  const handleUseInCampaign = () => {
      // Serialize map to text context
      let context = "Mind Map Brainstorming Session:\n";
      // Find root
      const root = nodes.find(n => !n.parentId);
      if(root) {
          context += `Core Theme: ${root.text}\n`;
          const children = nodes.filter(n => n.parentId === root.id);
          children.forEach(child => {
              context += `- Key Angle: ${child.text}\n`;
              const subChildren = nodes.filter(n => n.parentId === child.id);
              subChildren.forEach(sub => context += `  * Detail: ${sub.text}\n`);
          });
      }
      onConvertToCampaign(context);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 relative overflow-hidden">
        <div className="p-4 border-b border-gray-800 bg-gray-900 z-10 flex justify-between items-center">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Sparkles className="text-yellow-400"/> Brainstorming Mode</h2>
            <div className="flex gap-2">
                <Button onClick={handleUseInCampaign} className="bg-green-600 hover:bg-green-500">
                    Use in Campaign <ArrowRight size={16} className="ml-2"/>
                </Button>
            </div>
        </div>

        <div 
            ref={containerRef}
            className="flex-1 relative cursor-grab active:cursor-grabbing bg-[radial-gradient(#333_1px,transparent_1px)] bg-[size:20px_20px]"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                {nodes.map(node => {
                    if (!node.parentId) return null;
                    const parent = nodes.find(n => n.id === node.parentId);
                    if (!parent) return null;
                    return (
                        <line 
                            key={`link-${node.id}`}
                            x1={parent.x + 100} y1={parent.y + 40} // Center of parent card approx
                            x2={node.x + 100} y2={node.y + 40}
                            stroke="#4b5563"
                            strokeWidth="2"
                            opacity="0.5"
                        />
                    );
                })}
            </svg>

            {nodes.map(node => (
                <div
                    key={node.id}
                    className={`absolute w-52 bg-gray-800 border-2 rounded-xl p-3 shadow-xl transition-shadow hover:shadow-2xl flex flex-col gap-2 group ${node.type === 'root' ? 'border-primary-500 ring-4 ring-primary-500/20' : 'border-gray-700'}`}
                    style={{ left: node.x, top: node.y }}
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                >
                    <div className="flex justify-between items-start">
                        <input 
                            value={node.text}
                            onChange={(e) => handleUpdateText(node.id, e.target.value)}
                            className="bg-transparent border-none text-white font-medium text-sm focus:outline-none w-full"
                            placeholder="Enter idea..."
                        />
                        {node.type !== 'root' && (
                            <button onClick={() => deleteNode(node.id)} className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14}/>
                            </button>
                        )}
                    </div>
                    
                    <div className="flex justify-between mt-2 pt-2 border-t border-gray-700">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleAddNode(node.id); }}
                            className="text-[10px] flex items-center gap-1 text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 px-2 py-1 rounded"
                        >
                            <Plus size={10}/> Child
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleAiExpand(node.id); }}
                            className="text-[10px] flex items-center gap-1 text-purple-400 hover:text-purple-300 bg-purple-900/20 hover:bg-purple-900/40 px-2 py-1 rounded border border-purple-500/30"
                            disabled={isExpanding}
                        >
                            <Sparkles size={10}/> {isExpanding ? '...' : 'Expand'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
        
        <div className="absolute bottom-6 right-6 bg-black/80 text-gray-400 text-xs px-4 py-2 rounded-full border border-gray-700 pointer-events-none">
            Drag to move • Double-click text to edit • AI Auto-Expand available
        </div>
    </div>
  );
};
