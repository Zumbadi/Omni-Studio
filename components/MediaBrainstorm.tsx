
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Sparkles, Trash2, ArrowRight, MousePointer2, ZoomIn, ZoomOut, Zap, LayoutGrid, Target, ImageIcon, Download, BoxSelect, Link, Eye, EyeOff } from 'lucide-react';
import { Button } from './Button';
import { expandMindMap } from '../services/geminiService';

interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId?: string;
  type: 'root' | 'idea' | 'media';
  color?: string;
  mediaUrl?: string; // For image/video nodes
}

interface MediaBrainstormProps {
  onConvertToCampaign: (context: string) => void;
  nodes: Node[];
  onNodesChange: React.Dispatch<React.SetStateAction<Node[]>>;
}

const COLORS = {
    root: 'border-primary-500 bg-gray-900',
    idea: 'border-blue-500 bg-gray-800',
    media: 'border-purple-500 bg-gray-800',
    strategy: 'border-yellow-500 bg-gray-800'
};

export const MediaBrainstorm: React.FC<MediaBrainstormProps> = ({ onConvertToCampaign, nodes, onNodesChange }) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 100 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  
  // New States
  const [showLines, setShowLines] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  
  const [isExpanding, setIsExpanding] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Canvas Navigation ---
  const handleWheel = useCallback((e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const zoomFactor = 0.1;
          const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
          const newScale = Math.max(0.1, Math.min(3, scale + delta));
          setScale(newScale);
      } else {
          setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
  }, [scale]);

  useEffect(() => {
      const el = containerRef.current;
      if (el) {
          el.addEventListener('wheel', handleWheel, { passive: false });
          return () => el.removeEventListener('wheel', handleWheel);
      }
  }, [handleWheel]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (isConnecting) {
          // Cancel connection if clicked on canvas
          setIsConnecting(false);
          setConnectingSourceId(null);
          return;
      }
      
      if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left
          setIsDraggingCanvas(true);
          setDragStart({ x: e.clientX, y: e.clientY });
      }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (isDraggingCanvas) {
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          setPan(p => ({ x: p.x + dx, y: p.y + dy }));
          setDragStart({ x: e.clientX, y: e.clientY });
      } else if (draggedNodeId) {
          // Adjust node pos based on zoom
          const dx = e.movementX / scale;
          const dy = e.movementY / scale;
          onNodesChange(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n));
      }
  };

  const handleCanvasMouseUp = () => {
      setIsDraggingCanvas(false);
      setDraggedNodeId(null);
  };

  // --- Node Logic ---
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (e.button === 0 && !isConnecting) setDraggedNodeId(id);
  };

  const handleNodeClick = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (isConnecting) {
          if (connectingSourceId === null) {
              setConnectingSourceId(id);
          } else if (connectingSourceId !== id) {
              // Create Connection
              onNodesChange(prev => prev.map(n => n.id === id ? { ...n, parentId: connectingSourceId } : n));
              setConnectingSourceId(null);
              setIsConnecting(false); // Optional: keep connecting mode on for multiple?
          }
      }
  };

  const handleDoubleClickCanvas = (e: React.MouseEvent) => {
      if (e.target !== containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Calculate relative pos
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;
      
      const newNode: Node = {
          id: `n-${Date.now()}`,
          text: 'New Idea',
          x, y,
          type: 'idea'
      };
      onNodesChange(prev => [...prev, newNode]);
  };

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  };

  const deleteNode = (id: string) => {
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
      onNodesChange(prev => prev.filter(n => !toDelete.has(n.id)));
      setContextMenu(null);
  };

  const handleAiExpand = async (nodeId: string, intent: 'diverge' | 'refine' | 'visuals') => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      
      setIsExpanding(true);
      setContextMenu(null);
      
      const context = nodes.map(n => n.text).join(', ');
      const newIdeas = await expandMindMap(node.text, context, intent);
      
      const newNodes: Node[] = newIdeas.map((idea, i) => {
          const angle = (i / newIdeas.length) * Math.PI * 2 + (Math.random() * 0.5);
          const radius = 250;
          return {
              id: `ai-${Date.now()}-${i}`,
              text: idea,
              x: node.x + Math.cos(angle) * radius,
              y: node.y + Math.sin(angle) * radius,
              parentId: nodeId,
              type: intent === 'visuals' ? 'media' : 'idea'
          };
      });
      
      onNodesChange(prev => [...prev, ...newNodes]);
      setIsExpanding(false);
  };

  const updateNodeText = (id: string, text: string) => {
      onNodesChange(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  };

  const handleUseInCampaign = () => {
      let context = "Mind Map Brainstorming Session:\n";
      const root = nodes.find(n => n.type === 'root');
      if(root) {
          context += `Core Theme: ${root.text}\n`;
          const children = nodes.filter(n => n.parentId === root.id);
          children.forEach(child => {
              context += `- Strategy: ${child.text}\n`;
              const subChildren = nodes.filter(n => n.parentId === child.id);
              subChildren.forEach(sub => context += `  * Tactic/Visual: ${sub.text}\n`);
          });
      }
      onConvertToCampaign(context);
  };

  // Asset Drop Handler
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const assetData = e.dataTransfer.getData('application/omni-asset');
      if (assetData) {
          const asset = JSON.parse(assetData);
          const rect = containerRef.current?.getBoundingClientRect();
          if(!rect) return;
          
          const x = (e.clientX - rect.left - pan.x) / scale;
          const y = (e.clientY - rect.top - pan.y) / scale;

          const newNode: Node = {
              id: `media-${Date.now()}`,
              text: asset.name || asset.description || 'Visual Ref',
              x, y,
              type: 'media',
              mediaUrl: asset.url
          };
          onNodesChange(prev => [...prev, newNode]);
      }
  };

  const handleAutoLayout = () => {
      // Reingold-Tilford tree layout simplification
      const root = nodes.find(n => n.type === 'root') || nodes[0];
      if (!root) return;

      const levels: Record<string, Node[]> = {};
      const layoutNodes = [...nodes];
      
      const assignLevels = (nodeId: string, level: number) => {
          if (!levels[level]) levels[level] = [];
          const node = layoutNodes.find(n => n.id === nodeId);
          if (node) {
              // Only assign if not already processed (avoid cycles)
              if (!levels[level].some(n => n.id === nodeId)) {
                  levels[level].push(node);
                  const children = layoutNodes.filter(n => n.parentId === nodeId);
                  children.forEach(child => assignLevels(child.id, level + 1));
              }
          }
      };

      assignLevels(root.id, 0);

      // Simple grid positioning
      const X_GAP = 300;
      const Y_GAP = 150;
      const startY = 100;

      Object.keys(levels).forEach(levelStr => {
          const lvl = parseInt(levelStr);
          const levelNodes = levels[lvl];
          const startX = 100 + (lvl * X_GAP);
          
          levelNodes.forEach((node, idx) => {
              // Center vertically relative to parent or previous level
              const y = startY + (idx * Y_GAP);
              node.x = startX;
              node.y = y;
          });
      });

      // Handle orphans (nodes with no parent and not root)
      const positionedIds = new Set(Object.values(levels).flat().map(n => n.id));
      const orphans = layoutNodes.filter(n => !positionedIds.has(n.id));
      orphans.forEach((node, i) => {
          node.x = 100;
          node.y = startY + (Object.keys(levels).length * 100) + (i * Y_GAP);
      });

      onNodesChange([...layoutNodes]);
      setPan({ x: 50, y: 50 }); // Reset pan to see start
  };

  const handleExportImage = () => {
      alert("Exporting Mind Map as PNG... (Simulated)");
  };

  const drawConnector = (p1: Node, p2: Node) => {
      const x1 = p1.x + 100;
      const y1 = p1.y + 50;
      const x2 = p2.x + 100;
      const y2 = p2.y + 50;
      
      const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const curvature = Math.min(dist * 0.5, 150);
      
      const path = `M ${x1} ${y1} C ${x1 + curvature} ${y1}, ${x2 - curvature} ${y2}, ${x2} ${y2}`;
      
      return (
          <path 
              d={path} 
              stroke="#4b5563" 
              strokeWidth="2" 
              fill="none" 
              className="opacity-50"
          />
      );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 relative overflow-hidden" onClick={() => setContextMenu(null)}>
        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-20 flex flex-col md:flex-row gap-2">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-1 flex gap-1 shadow-xl">
                <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Zoom In"><ZoomIn size={16}/></button>
                <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Zoom Out"><ZoomOut size={16}/></button>
                <button onClick={() => { setScale(1); setPan({x: window.innerWidth/2 - 100, y: window.innerHeight/2 - 100}); }} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Reset View"><MousePointer2 size={16}/></button>
            </div>
            
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-1 flex gap-1 shadow-xl">
                <button onClick={() => setShowLines(!showLines)} className={`p-2 rounded text-gray-400 hover:text-white ${!showLines ? 'bg-gray-800 text-red-400' : 'hover:bg-gray-800'}`} title="Toggle Connections">
                    {showLines ? <Eye size={16}/> : <EyeOff size={16}/>}
                </button>
                <button 
                    onClick={() => { setIsConnecting(!isConnecting); setConnectingSourceId(null); }} 
                    className={`p-2 rounded text-gray-400 hover:text-white ${isConnecting ? 'bg-primary-600 text-white animate-pulse' : 'hover:bg-gray-800'}`} 
                    title="Manual Connection Mode"
                >
                    <Link size={16}/>
                </button>
                <button onClick={handleAutoLayout} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Auto Layout"><BoxSelect size={16}/></button>
                <button onClick={handleExportImage} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Export Image"><Download size={16}/></button>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-gray-400 shadow-xl hidden lg:flex">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary-500"></div> Brand</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Idea</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Visual</span>
            </div>
        </div>

        <div className="absolute top-4 right-4 z-20">
            <Button onClick={handleUseInCampaign} className="bg-green-600 hover:bg-green-500 shadow-xl">
                Use in Campaign <ArrowRight size={16} className="ml-2"/>
            </Button>
        </div>

        {/* Info Banner for Connection Mode */}
        {isConnecting && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-primary-900/80 text-primary-200 px-4 py-2 rounded-full border border-primary-500/50 backdrop-blur shadow-lg animate-in slide-in-from-top-4">
                <span className="text-xs font-bold flex items-center gap-2">
                    <Link size={14}/> {connectingSourceId ? "Click target node to connect" : "Click start node"}
                </span>
            </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
            <div 
                className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden min-w-[160px] animate-in fade-in zoom-in-95"
                style={{ top: contextMenu.y, left: contextMenu.x }}
            >
                <div className="p-1 border-b border-gray-700">
                    <button onClick={() => handleAiExpand(contextMenu.nodeId, 'diverge')} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded flex items-center gap-2">
                        <LayoutGrid size={14} className="text-blue-400"/> Diverge Ideas
                    </button>
                    <button onClick={() => handleAiExpand(contextMenu.nodeId, 'refine')} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded flex items-center gap-2">
                        <Target size={14} className="text-yellow-400"/> Refine / Tactics
                    </button>
                    <button onClick={() => handleAiExpand(contextMenu.nodeId, 'visuals')} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded flex items-center gap-2">
                        <ImageIcon size={14} className="text-purple-400"/> Visual Concepts
                    </button>
                </div>
                <div className="p-1">
                    <button onClick={() => deleteNode(contextMenu.nodeId)} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 rounded flex items-center gap-2">
                        <Trash2 size={14}/> Delete Node
                    </button>
                </div>
            </div>
        )}

        {/* Canvas */}
        <div 
            ref={containerRef}
            className={`flex-1 overflow-hidden bg-[#0d1117] ${isConnecting ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onDoubleClick={handleDoubleClickCanvas}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
        >
            <div 
                style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, 
                    transformOrigin: '0 0',
                    width: '100%', height: '100%',
                    position: 'absolute', top: 0, left: 0
                }}
            >
                {/* Grid Pattern */}
                <div className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] bg-[radial-gradient(#333_1px,transparent_1px)] bg-[size:40px_40px] opacity-20 pointer-events-none"></div>

                {showLines && (
                    <svg className="absolute -top-[5000px] -left-[5000px] w-[10000px] h-[10000px] overflow-visible pointer-events-none">
                        {nodes.map(node => {
                            if (!node.parentId) return null;
                            const parent = nodes.find(n => n.id === node.parentId);
                            if (!parent) return null;
                            return <React.Fragment key={`link-${node.id}`}>{drawConnector(parent, node)}</React.Fragment>;
                        })}
                    </svg>
                )}

                {nodes.map(node => (
                    <div
                        key={node.id}
                        className={`absolute w-52 p-3 rounded-xl border-2 shadow-xl flex flex-col gap-2 group transition-all hover:shadow-2xl hover:border-white/50 ${COLORS[node.type] || COLORS.idea} animate-in zoom-in duration-300 ${connectingSourceId === node.id ? 'ring-4 ring-primary-500 ring-offset-2 ring-offset-black' : ''}`}
                        style={{ left: node.x, top: node.y }}
                        onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                        onClick={(e) => handleNodeClick(e, node.id)}
                        onContextMenu={(e) => handleContextMenu(e, node.id)}
                    >
                        {node.mediaUrl && (
                            <div className="w-full h-24 mb-1 rounded-lg overflow-hidden bg-black relative">
                                <img src={node.mediaUrl} className="w-full h-full object-cover opacity-80" alt="ref"/>
                            </div>
                        )}
                        <div className="flex justify-between items-start">
                            <textarea 
                                value={node.text}
                                onChange={(e) => updateNodeText(node.id, e.target.value)}
                                className="bg-transparent border-none text-white font-medium text-sm focus:outline-none w-full resize-none overflow-hidden"
                                rows={Math.max(2, Math.ceil(node.text.length / 20))}
                                placeholder="Idea..."
                                onMouseDown={e => e.stopPropagation()} // Allow editing without dragging
                            />
                        </div>
                        
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id }); }}
                                className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                            >
                                <Sparkles size={12}/>
                            </button>
                        </div>
                        
                        {/* Status Dot */}
                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-900 ${node.type === 'root' ? 'bg-primary-500' : node.type === 'media' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                    </div>
                ))}
            </div>
        </div>
        
        <div className="absolute bottom-6 left-6 text-gray-500 text-xs select-none pointer-events-none bg-black/50 p-2 rounded backdrop-blur-sm">
            Double-click to add • Drag Assets • Right-click for AI • Scroll to Zoom
        </div>
    </div>
  );
};
