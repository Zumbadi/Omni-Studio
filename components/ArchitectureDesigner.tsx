
import React, { useState } from 'react';
import { BrainCircuit, Globe, Cpu, Database, HardDrive, Loader2, Wand2 } from 'lucide-react';
import { Button } from './Button';
import { generateArchitecture } from '../services/geminiService';
import { ArchNode, ArchLink } from '../types';

interface ArchitectureDesignerProps {
  projectDescription: string;
}

export const ArchitectureDesigner: React.FC<ArchitectureDesignerProps> = ({ projectDescription }) => {
  const [archNodes, setArchNodes] = useState<ArchNode[]>([]);
  const [archLinks, setArchLinks] = useState<ArchLink[]>([]);
  const [isGeneratingArch, setIsGeneratingArch] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  const handleGenerateArch = async () => {
      setIsGeneratingArch(true);
      const data = await generateArchitecture(projectDescription);
      setArchNodes(data.nodes);
      setArchLinks(data.links);
      setIsGeneratingArch(false);
  };

  const handleAddArchNode = (type: ArchNode['type']) => {
      const newNode: ArchNode = {
          id: `n-${Date.now()}`,
          type,
          label: 'New Node',
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200,
          details: 'Configure me'
      };
      setArchNodes(prev => [...prev, newNode]);
  };

  const handleNodeDragStart = (id: string) => {
      setDraggedNode(id);
  };

  const handleNodeDrop = (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedNode) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setArchNodes(prev => prev.map(n => n.id === draggedNode ? { ...n, x, y } : n));
      setDraggedNode(null);
  };

  return (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2"><BrainCircuit size={16} className="text-pink-400"/> Architecture</h2>
                  <div className="flex gap-1 ml-4">
                      <button onClick={() => handleAddArchNode('frontend')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Add Frontend"><Globe size={14}/></button>
                      <button onClick={() => handleAddArchNode('backend')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Add Backend"><Cpu size={14}/></button>
                      <button onClick={() => handleAddArchNode('database')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Add DB"><Database size={14}/></button>
                  </div>
              </div>
              <Button size="sm" onClick={handleGenerateArch} disabled={isGeneratingArch}>
                  {isGeneratingArch ? <Loader2 size={14} className="animate-spin mr-2"/> : <Wand2 size={14} className="mr-2"/>} Generate
              </Button>
          </div>
          <div 
            className="flex-1 bg-gray-900 relative overflow-hidden cursor-crosshair"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleNodeDrop}
          >
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#333_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none"></div>
              
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {archLinks.map(link => {
                      const src = archNodes.find(n => n.id === link.source);
                      const tgt = archNodes.find(n => n.id === link.target);
                      if (!src || !tgt) return null;
                      return <line key={link.id} x1={src.x + 64} y1={src.y + 32} x2={tgt.x + 64} y2={tgt.y + 32} stroke="#4b5563" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  })}
                  <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
                      </marker>
                  </defs>
              </svg>

              {archNodes.map(node => (
                  <div 
                    key={node.id} 
                    className="absolute w-32 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-3 cursor-move hover:border-primary-500 transition-colors z-10"
                    style={{ left: node.x, top: node.y }}
                    draggable
                    onDragStart={() => handleNodeDragStart(node.id)}
                  >
                      <div className="flex items-center justify-center mb-2 text-gray-400">
                          {node.type === 'frontend' && <Globe size={20} />}
                          {node.type === 'backend' && <Cpu size={20} />}
                          {node.type === 'database' && <Database size={20} />}
                          {node.type === 'storage' && <HardDrive size={20} />}
                      </div>
                      <div className="text-xs font-bold text-white text-center mb-1">{node.label}</div>
                      <div className="text-[10px] text-gray-500 text-center leading-tight">{node.details}</div>
                  </div>
              ))}
              
              {archNodes.length === 0 && !isGeneratingArch && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm pointer-events-none">
                      Click "Generate" or use the toolbar to design.
                  </div>
              )}
          </div>
      </div>
  );
};
