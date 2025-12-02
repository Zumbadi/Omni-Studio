
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrainCircuit, Globe, Cpu, Database, HardDrive, Loader2, Wand2, Share2, Layers, FileText, Zap, ZoomIn, ZoomOut, MousePointer2 } from 'lucide-react';
import { Button } from './Button';
import { generateArchitecture, optimizeArchitecture } from '../services/geminiService';
import { ArchNode, ArchLink, FileNode } from '../types';
import { analyzeDependencies } from '../utils/projectAnalysis';

interface ArchitectureDesignerProps {
  projectDescription: string;
  files?: FileNode[];
  onOpenFile?: (id: string) => void;
}

// Extended Node type for physics simulation
interface SimNode extends ArchNode {
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  radius?: number;
}

export const ArchitectureDesigner: React.FC<ArchitectureDesignerProps> = ({ projectDescription, files = [], onOpenFile }) => {
  const [archNodes, setArchNodes] = useState<SimNode[]>([]);
  const [archLinks, setArchLinks] = useState<ArchLink[]>([]);
  const [isGeneratingArch, setIsGeneratingArch] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [mode, setMode] = useState<'design' | 'codebase'>('design');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  
  // Physics Parameters
  const REPULSION = 800;
  const SPRING_LENGTH = 120;
  const SPRING_STRENGTH = 0.05;
  const DAMPING = 0.9;
  const CENTER_GRAVITY = 0.01;

  const handleGenerateArch = async () => {
      setIsGeneratingArch(true);
      const data = await generateArchitecture(projectDescription);
      setArchNodes(data.nodes);
      setArchLinks(data.links);
      setMode('design');
      setIsGeneratingArch(false);
  };

  const handleOptimizeArch = async () => {
      setIsGeneratingArch(true);
      const data = await optimizeArchitecture(archNodes, archLinks);
      setArchNodes(data.nodes);
      setArchLinks(data.links);
      setIsGeneratingArch(false);
  };

  const handleVisualizeCodebase = () => {
      setMode('codebase');
      const depNodes = analyzeDependencies(files);
      const containerW = containerRef.current?.clientWidth || 800;
      const containerH = containerRef.current?.clientHeight || 600;
      
      const nodes: SimNode[] = depNodes.map((dn) => {
          let type: ArchNode['type'] = 'function';
          if (dn.name.endsWith('tsx')) type = 'frontend';
          else if (dn.name.includes('Service') || dn.name.includes('api')) type = 'backend';
          else if (dn.name.includes('db') || dn.name.includes('store')) type = 'database';
          else if (dn.name.includes('json')) type = 'storage';

          return {
              id: dn.id,
              type,
              label: dn.name,
              // Random initial position near center
              x: containerW / 2 + (Math.random() - 0.5) * 200,
              y: containerH / 2 + (Math.random() - 0.5) * 200,
              vx: 0,
              vy: 0,
              details: dn.path,
              radius: 20 + (dn.level * 2) // Size based on importance/level
          };
      });

      const links: ArchLink[] = [];
      // Create links based on imports
      depNodes.forEach(source => {
          source.imports.forEach(imp => {
              // Fuzzy match import name to file name
              const target = depNodes.find(n => n.name.toLowerCase().includes(imp.toLowerCase()) && n.id !== source.id);
              if (target) {
                  links.push({ id: `${source.id}-${target.id}`, source: source.id, target: target.id });
              }
          });
      });

      setArchNodes(nodes);
      setArchLinks(links);
      setZoom(0.8);
      setPan({ x: 0, y: 0 });
  };

  const handleAddArchNode = (type: ArchNode['type']) => {
      const containerW = containerRef.current?.clientWidth || 800;
      const containerH = containerRef.current?.clientHeight || 600;
      
      const newNode: SimNode = {
          id: `n-${Date.now()}`,
          type,
          label: 'New Node',
          x: containerW / 2 + (Math.random() - 0.5) * 50,
          y: containerH / 2 + (Math.random() - 0.5) * 50,
          vx: 0,
          vy: 0,
          details: 'Configure me'
      };
      setArchNodes(prev => [...prev, newNode]);
  };

  // --- PHYSICS ENGINE ---
  const updateSimulation = useCallback(() => {
      if (mode !== 'codebase') return;

      setArchNodes(prevNodes => {
          const nodes = [...prevNodes];
          const width = containerRef.current?.clientWidth || 800;
          const height = containerRef.current?.clientHeight || 600;
          const centerX = width / 2;
          const centerY = height / 2;

          // 1. Initialize forces
          const forces = nodes.map(() => ({ fx: 0, fy: 0 }));

          // 2. Repulsion (Coulomb's Law) - O(N^2) simplified
          for (let i = 0; i < nodes.length; i++) {
              for (let j = i + 1; j < nodes.length; j++) {
                  const dx = nodes[i].x - nodes[j].x;
                  const dy = nodes[i].y - nodes[j].y;
                  let distSq = dx * dx + dy * dy;
                  if (distSq === 0) distSq = 0.1; // Prevent div by zero
                  const dist = Math.sqrt(distSq);
                  
                  const force = REPULSION / distSq;
                  const fx = (dx / dist) * force;
                  const fy = (dy / dist) * force;

                  forces[i].fx += fx;
                  forces[i].fy += fy;
                  forces[j].fx -= fx;
                  forces[j].fy -= fy;
              }
          }

          // 3. Attraction (Springs)
          archLinks.forEach(link => {
              const sourceIdx = nodes.findIndex(n => n.id === link.source);
              const targetIdx = nodes.findIndex(n => n.id === link.target);
              if (sourceIdx === -1 || targetIdx === -1) return;

              const source = nodes[sourceIdx];
              const target = nodes[targetIdx];

              const dx = target.x - source.x;
              const dy = target.y - source.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist === 0) return;

              const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              forces[sourceIdx].fx += fx;
              forces[sourceIdx].fy += fy;
              forces[targetIdx].fx -= fx;
              forces[targetIdx].fy -= fy;
          });

          // 4. Center Gravity & Apply Velocities
          return nodes.map((node, i) => {
              if (node.id === draggedNode) return node; // Don't move dragged node

              // Gravity towards center
              const dx = centerX - node.x;
              const dy = centerY - node.y;
              forces[i].fx += dx * CENTER_GRAVITY;
              forces[i].fy += dy * CENTER_GRAVITY;

              let vx = (node.vx || 0) + forces[i].fx;
              let vy = (node.vy || 0) + forces[i].fy;

              vx *= DAMPING;
              vy *= DAMPING;

              return { ...node, x: node.x + vx, y: node.y + vy, vx, vy };
          });
      });

      requestRef.current = requestAnimationFrame(updateSimulation);
  }, [mode, archLinks, draggedNode]);

  useEffect(() => {
      if (mode === 'codebase') {
          requestRef.current = requestAnimationFrame(updateSimulation);
      }
      return () => {
          if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
  }, [mode, updateSimulation]);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setDraggedNode(id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (draggedNode) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          // Calculate pos relative to zoom/pan
          const x = (e.clientX - rect.left - pan.x) / zoom;
          const y = (e.clientY - rect.top - pan.y) / zoom;
          
          setArchNodes(prev => prev.map(n => n.id === draggedNode ? { ...n, x, y, vx: 0, vy: 0 } : n));
      } else if (e.buttons === 2 || (e.buttons === 1 && e.shiftKey)) {
          // Pan
          setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
      }
  };

  const handleMouseUp = () => {
      setDraggedNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
      const scaleBy = 1.1;
      const newZoom = e.deltaY < 0 ? zoom * scaleBy : zoom / scaleBy;
      setZoom(Math.max(0.2, Math.min(3, newZoom)));
  };

  const handleNodeClick = (id: string) => {
      if (mode === 'codebase' && onOpenFile) {
          // If we clicked a node and dragged it very little, treat as click
          onOpenFile(id);
      }
  };

  const getNodeColor = (type: string) => {
      switch(type) {
          case 'frontend': return 'border-blue-500 bg-blue-900/50 text-blue-100';
          case 'backend': return 'border-purple-500 bg-purple-900/50 text-purple-100';
          case 'database': return 'border-yellow-500 bg-yellow-900/50 text-yellow-100';
          case 'storage': return 'border-green-500 bg-green-900/50 text-green-100';
          default: return 'border-gray-500 bg-gray-800 text-gray-200';
      }
  };

  return (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden select-none">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0 z-20 relative">
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
              <div className="flex gap-2">
                  <div className="flex items-center gap-1 bg-gray-800 rounded p-0.5 mr-2">
                      <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-1 hover:bg-gray-700 rounded text-gray-400"><ZoomIn size={14}/></button>
                      <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1 hover:bg-gray-700 rounded text-gray-400"><ZoomOut size={14}/></button>
                  </div>
                  <Button size="sm" variant="secondary" onClick={handleOptimizeArch} disabled={isGeneratingArch || mode === 'codebase' || archNodes.length === 0}>
                      {isGeneratingArch ? <Loader2 size={14} className="animate-spin mr-2"/> : <Zap size={14} className="mr-2"/>} Optimize
                  </Button>
                  <Button size="sm" onClick={handleGenerateArch} disabled={isGeneratingArch || mode === 'codebase'}>
                      {isGeneratingArch ? <Loader2 size={14} className="animate-spin mr-2"/> : <Wand2 size={14} className="mr-2"/>} Generate
                  </Button>
              </div>
          </div>
          
          <div 
            ref={containerRef}
            className="flex-1 bg-gray-950 relative overflow-hidden cursor-move"
            onMouseDown={(e) => { if(e.target === containerRef.current) setPan(p => ({...p, startX: e.clientX, startY: e.clientY})) }} 
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onDragOver={(e) => e.preventDefault()}
          >
              <div 
                  className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#333_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
              ></div>
              
              <div 
                  className="w-full h-full absolute top-0 left-0 transition-transform duration-75 ease-out"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}
              >
                  <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                      <defs>
                          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="28" refY="3.5" orient="auto">
                              <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
                          </marker>
                      </defs>
                      {archLinks.map(link => {
                          const src = archNodes.find(n => n.id === link.source);
                          const tgt = archNodes.find(n => n.id === link.target);
                          if (!src || !tgt) return null;
                          return <line key={link.id} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke={mode === 'codebase' ? '#6366f1' : '#4b5563'} strokeWidth={2 / zoom} markerEnd="url(#arrowhead)" opacity={0.4} />
                      })}
                  </svg>

                  {archNodes.map(node => (
                      <div 
                        key={node.id} 
                        className={`absolute flex flex-col items-center justify-center rounded-full border-2 shadow-lg cursor-pointer hover:scale-110 transition-all ${getNodeColor(node.type)}`}
                        style={{ 
                            left: node.x, 
                            top: node.y, 
                            width: mode === 'codebase' ? 12 : 120, 
                            height: mode === 'codebase' ? 12 : 80,
                            transform: 'translate(-50%, -50%)',
                            borderRadius: mode === 'codebase' ? '50%' : '8px',
                            zIndex: hoveredNode === node.id ? 20 : 10
                        }}
                        onMouseDown={(e) => handleMouseDown(e, node.id)}
                        onClick={() => handleNodeClick(node.id)}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                      >
                          {mode === 'design' && (
                              <div className="flex flex-col items-center pointer-events-none">
                                  <div className="mb-1 opacity-70">
                                      {node.type === 'frontend' && <FileText size={16}/>}
                                      {node.type === 'backend' && <Cpu size={16}/>}
                                      {node.type === 'database' && <Database size={16}/>}
                                      {node.type === 'storage' && <HardDrive size={16}/>}
                                  </div>
                                  <div className="text-[10px] font-bold text-center truncate w-full px-1">{node.label}</div>
                                  <div className="text-[8px] opacity-60 text-center leading-tight mt-1 px-1 line-clamp-2">{node.details}</div>
                              </div>
                          )}
                          
                          {/* Tooltip for Codebase Mode */}
                          {mode === 'codebase' && hoveredNode === node.id && (
                              <div 
                                  className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none border border-gray-700 z-50 animate-in fade-in zoom-in-95"
                                  style={{ transform: `translateX(-50%) scale(${1/zoom})` }}
                              >
                                  {node.label}
                                  {onOpenFile && <div className="text-[8px] text-gray-400 mt-0.5 flex items-center justify-center gap-1"><MousePointer2 size={8}/> Click to open</div>}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
              
              {archNodes.length === 0 && !isGeneratingArch && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm pointer-events-none flex-col gap-2">
                      <Layers size={32} className="opacity-20"/>
                      {mode === 'design' ? 'Click "Generate" or use the toolbar to design.' : 'Click "Codebase" to visualize file dependencies.'}
                  </div>
              )}
          </div>
          
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full border border-gray-700 text-[10px] text-gray-400 pointer-events-none">
              {mode === 'codebase' ? `${archNodes.length} Files • ${archLinks.length} Dependencies` : 'Architecture Design Mode'}
          </div>
      </div>
  );
};
