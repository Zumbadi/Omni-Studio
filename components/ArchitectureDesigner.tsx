
import React, { useState, useEffect } from 'react';
import { BrainCircuit, Globe, Cpu, Database, HardDrive, Loader2, Wand2, Share2, Layers, FileText } from 'lucide-react';
import { Button } from './Button';
import { generateArchitecture } from '../services/geminiService';
import { ArchNode, ArchLink, FileNode } from '../types';
import { analyzeDependencies } from '../utils/projectAnalysis';

interface ArchitectureDesignerProps {
  projectDescription: string;
  files?: FileNode[];
}

export const ArchitectureDesigner: React.FC<ArchitectureDesignerProps> = ({ projectDescription, files = [] }) => {
  const [archNodes, setArchNodes] = useState<ArchNode[]>([]);
  const [archLinks, setArchLinks] = useState<ArchLink[]>([]);
  const [isGeneratingArch, setIsGeneratingArch] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [mode, setMode] = useState<'design' | 'codebase'>('design');

  const handleGenerateArch = async () => {
      setIsGeneratingArch(true);
      const data = await generateArchitecture(projectDescription);
      setArchNodes(data.nodes);
      setArchLinks(data.links);
      setMode('design');
      setIsGeneratingArch(false);
  };

  const handleVisualizeCodebase = () => {
      setMode('codebase');
      const depNodes = analyzeDependencies(files);
      const width = 800;
      const height = 600;
      
      const nodes: ArchNode[] = depNodes.map((dn, i) => {
          // Simple layer-based layout
          const layerCount = depNodes.filter(n => n.level === dn.level).length;
          const indexInLayer = depNodes.filter(n => n.level === dn.level && depNodes.indexOf(n) < i).length;
          
          return {
              id: dn.id,
              type: dn.level === 0 ? 'frontend' : dn.level === 1 ? 'backend' : 'storage', // Mapping for icon colors
              label: dn.name,
              x: 100 + (dn.level * 200) + (Math.random() * 20),
              y: 100 + (indexInLayer * 80) + (Math.random() * 20),
              details: dn.path
          };
      });

      const links: ArchLink[] = [];
      // Create links based on imports (simplified matching by name)
      depNodes.forEach(source => {
          source.imports.forEach(imp => {
              const target = depNodes.find(n => n.name.includes(imp) && n.id !== source.id);
              if (target) {
                  links.push({ id: `${source.id}-${target.id}`, source: source.id, target: target.id });
              }
          });
      });

      setArchNodes(nodes);
      setArchLinks(links);
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
                  
                  <div className="flex bg-gray-800 rounded p-0.5 ml-4">
                      <button onClick={() => setMode('design')} className={`px-2 py-1 text-xs rounded transition-colors ${mode === 'design' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Design</button>
                      <button onClick={handleVisualizeCodebase} className={`px-2 py-1 text-xs rounded transition-colors ${mode === 'codebase' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Codebase</button>
                  </div>

                  {mode === 'design' && (
                      <div className="flex gap-1 ml-2 border-l border-gray-700 pl-2">
                          <button onClick={() => handleAddArchNode('frontend')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Add Frontend"><Globe size={14}/></button>
                          <button onClick={() => handleAddArchNode('backend')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Add Backend"><Cpu size={14}/></button>
                          <button onClick={() => handleAddArchNode('database')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Add DB"><Database size={14}/></button>
                      </div>
                  )}
              </div>
              <Button size="sm" onClick={handleGenerateArch} disabled={isGeneratingArch || mode === 'codebase'}>
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
                  <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
                      </marker>
                  </defs>
                  {archLinks.map(link => {
                      const src = archNodes.find(n => n.id === link.source);
                      const tgt = archNodes.find(n => n.id === link.target);
                      if (!src || !tgt) return null;
                      return <line key={link.id} x1={src.x + 64} y1={src.y + 24} x2={tgt.x + 64} y2={tgt.y + 24} stroke={mode === 'codebase' ? '#6366f1' : '#4b5563'} strokeWidth="1" markerEnd="url(#arrowhead)" opacity={0.6} />
                  })}
              </svg>

              {archNodes.map(node => (
                  <div 
                    key={node.id} 
                    className={`absolute w-32 bg-gray-800 border ${mode === 'codebase' ? 'border-primary-500/30 bg-primary-900/10' : 'border-gray-600'} rounded-lg shadow-lg p-2 cursor-move hover:border-primary-500 transition-colors z-10 flex flex-col items-center`}
                    style={{ left: node.x, top: node.y }}
                    draggable
                    onDragStart={() => handleNodeDragStart(node.id)}
                  >
                      <div className="mb-1 text-gray-400">
                          {node.type === 'frontend' && <FileText size={16} className="text-blue-400"/>}
                          {node.type === 'backend' && <Cpu size={16} className="text-purple-400"/>}
                          {node.type === 'database' && <Database size={16} className="text-yellow-400"/>}
                          {node.type === 'storage' && <HardDrive size={16} />}
                      </div>
                      <div className="text-[10px] font-bold text-white text-center truncate w-full">{node.label}</div>
                      {mode === 'design' && <div className="text-[8px] text-gray-500 text-center leading-tight mt-1">{node.details}</div>}
                  </div>
              ))}
              
              {archNodes.length === 0 && !isGeneratingArch && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm pointer-events-none flex-col gap-2">
                      <Layers size={32} className="opacity-20"/>
                      {mode === 'design' ? 'Click "Generate" or use the toolbar to design.' : 'Click "Codebase" to visualize file dependencies.'}
                  </div>
              )}
          </div>
      </div>
  );
};
