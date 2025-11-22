
import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Download, X, Smartphone, Globe, QrCode, Network, Database, Play, Map, Loader2, BrainCircuit, Rocket, Package, Zap, UploadCloud, Check, ExternalLink, History, Flag, ArrowRight, Activity, Terminal, Table, GitGraph, Cpu, HardDrive, Book, FileText, ScatterChart as ScatterIcon, Search, Wand2, Gauge, Share2, Layers, Plus } from 'lucide-react';
import { Button } from './Button';
import { Project, ProjectType, ProjectPhase, FileNode, PerformanceReport, ArchNode, ArchLink } from '../types';
import { MOCK_DEPLOYMENTS } from '../constants';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter, ZAxis, PieChart, Pie, Cell } from 'recharts';
import { generateProjectDocs, generateSQL, generatePerformanceReport, generateArchitecture } from '../services/geminiService';
import { analyzeDependencies, DepNode } from '../utils/projectAnalysis';

interface PreviewPanelProps {
  project: Project;
  previewSrc: string;
  activeTab: 'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture';
  setActiveTab: (tab: 'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture') => void;
  onToggleLayout: () => void;
  onExport: () => void;
  onRefreshPreview: () => void;
  roadmap: ProjectPhase[];
  isGeneratingPlan: boolean;
  onGeneratePlan: () => void;
  onExecutePhase: (phase: ProjectPhase) => void;
  onToggleTask: (phaseId: string, taskId: string) => void;
  onLog: (msg: string) => void;
  files: FileNode[];
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  project, previewSrc, activeTab, setActiveTab, onToggleLayout, onExport, onRefreshPreview,
  roadmap, isGeneratingPlan, onGeneratePlan, onExecutePhase, onToggleTask, onLog, files
}) => {
  const isNative = project.type === ProjectType.REACT_NATIVE;
  const isBackend = project.type === ProjectType.NODE_API;

  // Preview State
  const [previewMode, setPreviewMode] = useState<'web' | 'mobile'>(isNative ? 'mobile' : 'web');
  const [showQrCode, setShowQrCode] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState<'iphone14' | 'pixel7' | 'ipad'>('iphone14');

  // API Console State
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiPath, setApiPath] = useState('/users');
  const [apiResponse, setApiResponse] = useState<string>('// Click Send to test endpoint');
  const [apiStatus, setApiStatus] = useState<number | null>(null);

  // Database Studio State
  const [dbView, setDbView] = useState<'data' | 'schema' | 'query' | 'vectors'>('data');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [dbResults, setDbResults] = useState<any[]>([
     { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', created_at: '2023-10-12' },
     { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user', created_at: '2023-10-14' },
     { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user', created_at: '2023-10-15' }
  ]);
  const [nlQuery, setNlQuery] = useState('');
  const [isGeneratingSQL, setIsGeneratingSQL] = useState(false);
  
  // Vector DB State
  const [vectorSearch, setVectorSearch] = useState('');
  const [vectorData, setVectorData] = useState<{x: number, y: number, z: number, text: string, id: number}[]>(() => {
      return Array.from({length: 30}, (_, i) => ({
          x: Math.random() * 100,
          y: Math.random() * 100,
          z: Math.random() * 50 + 10,
          text: `Chunk ${i}: Semantic embedding for knowledge base...`,
          id: i
      }));
  });

  // Deployment State
  const [deploymentState, setDeploymentState] = useState<'idle' | 'building' | 'optimizing' | 'uploading' | 'deployed'>('idle');
  const [deployUrl, setDeployUrl] = useState('');
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [metricsData, setMetricsData] = useState<{time: string, reqs: number, latency: number}[]>([]);

  // Docs State
  const [docContent, setDocContent] = useState<string>('');
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);

  // Audit / Performance State
  const [auditReport, setAuditReport] = useState<PerformanceReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [depGraph, setDepGraph] = useState<DepNode[]>([]);

  // Architecture State
  const [archNodes, setArchNodes] = useState<ArchNode[]>([]);
  const [archLinks, setArchLinks] = useState<ArchLink[]>([]);
  const [isGeneratingArch, setIsGeneratingArch] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);

  // Metric Simulation
  useEffect(() => {
      if (deploymentState === 'deployed') {
          const interval = setInterval(() => {
              setMetricsData(prev => {
                  const now = new Date();
                  const newPoint = {
                      time: `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`,
                      reqs: Math.floor(Math.random() * 100) + 50,
                      latency: Math.floor(Math.random() * 50) + 20
                  };
                  // Keep max 50 points
                  const newData = [...prev, newPoint];
                  return newData.length > 50 ? newData.slice(newData.length - 50) : newData;
              });
              
              if (Math.random() > 0.7) {
                  const methods = ['GET', 'POST', 'PUT'];
                  const paths = ['/api/users', '/api/auth', '/api/products', '/dashboard'];
                  const status = [200, 200, 200, 201, 404, 500];
                  const log = `[${new Date().toISOString()}] ${methods[Math.floor(Math.random()*3)]} ${paths[Math.floor(Math.random()*4)]} - ${status[Math.floor(Math.random()*6)]} - ${Math.floor(Math.random()*100)}ms`;
                  setServerLogs(prev => {
                      const newLogs = [...prev, log];
                      return newLogs.length > 50 ? newLogs.slice(newLogs.length - 50) : newLogs;
                  });
              }
          }, 1000);
          return () => clearInterval(interval);
      }
  }, [deploymentState]);

  useEffect(() => {
      if (activeTab === 'audit') {
          setDepGraph(analyzeDependencies(files));
      }
  }, [activeTab, files]);

  const handleApiSend = () => {
      setApiResponse('Sending request...');
      setApiStatus(null);
      setTimeout(() => {
          // Mock Response based on path
          if (apiPath === '/users' && apiMethod === 'GET') { setApiStatus(200); setApiResponse(JSON.stringify({ count: 2, data: dbResults }, null, 2)); }
          else if (apiPath === '/' && apiMethod === 'GET') { setApiStatus(200); setApiResponse(JSON.stringify({ message: 'Welcome to Omni API v1' }, null, 2)); }
          else if (apiMethod === 'POST') { setApiStatus(201); setApiResponse(JSON.stringify({ id: 3, status: 'created', timestamp: new Date().toISOString() }, null, 2)); }
          else { setApiStatus(404); setApiResponse(JSON.stringify({ error: 'Route not found in index.js' }, null, 2)); }
      }, 600);
  };

  const handleRunQuery = () => {
      if (sqlQuery.toLowerCase().includes('users')) setDbResults(prev => [...prev]);
  };

  const handleGenerateSQL = async () => {
      if(!nlQuery.trim()) return;
      setIsGeneratingSQL(true);
      const schemaContext = `
        Table users: id (uuid), email (varchar), name (varchar), role (text)
        Table posts: id (uuid), user_id (uuid), title (varchar), content (text)
      `;
      const sql = await generateSQL(nlQuery, schemaContext);
      // Clean up possible markdown fences
      const cleanSQL = sql.replace(/```sql/g, '').replace(/```/g, '').trim();
      setSqlQuery(cleanSQL);
      setIsGeneratingSQL(false);
  };

  const handleDeploy = () => {
    setDeploymentState('building');
    const sequence = [
      { state: 'building', log: '> Building production bundle...', delay: 2000 },
      { state: 'optimizing', log: '> Optimizing assets & images...', delay: 1500 },
      { state: 'uploading', log: '> Uploading to Edge Network...', delay: 1500 },
      { state: 'deployed', log: '> Deployed successfully!', delay: 500 }
    ];
    let currentDelay = 0;
    sequence.forEach(({ state, log, delay }) => {
      currentDelay += delay;
      setTimeout(() => {
        setDeploymentState(state as any);
        onLog(log);
        if (state === 'deployed') setDeployUrl(`https://${project?.name.toLowerCase().replace(/\s+/g, '-')}.vercel.app`);
      }, currentDelay);
    });
  };

  const handleGenerateDocs = async () => {
      setIsGeneratingDocs(true);
      setDocContent('');
      // Mock file structure for prompt
      const fileStructure = `- src/\n  - App.tsx\n  - components/\n- package.json`;
      await generateProjectDocs(fileStructure, project.type, (chunk) => {
          setDocContent(prev => prev + chunk);
      });
      setIsGeneratingDocs(false);
  };

  const handleRunAudit = async () => {
      setIsAuditing(true);
      // Generate simple file structure string
      const getStruct = (nodes: FileNode[], depth=0) => nodes.map(n => '  '.repeat(depth) + n.name).join('\n');
      const struct = getStruct(files);
      
      const report = await generatePerformanceReport(struct);
      setAuditReport(report);
      setIsAuditing(false);
  };

  const handleGenerateArch = async () => {
      setIsGeneratingArch(true);
      const data = await generateArchitecture(project.description);
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

  const SchemaView = () => (
      <div className="flex-1 bg-gray-900 p-6 relative overflow-auto">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_1px_1px,#333_1px,transparent_0)] bg-[size:20px_20px] opacity-50 pointer-events-none"></div>
          <div className="flex flex-wrap gap-12 relative z-10">
              {/* Table: Users */}
              <div className="w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
                  <div className="px-3 py-2 bg-gray-700 border-b border-gray-600 font-bold text-xs text-white flex items-center gap-2"><Table size={12} /> users</div>
                  <div className="p-2 space-y-1">
                      <div className="text-xs text-yellow-400 font-mono flex justify-between">id <span>PK uuid</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">email <span>varchar</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">name <span>varchar</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">role <span>text</span></div>
                  </div>
              </div>

              {/* Table: Posts */}
              <div className="w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg mt-12">
                  <div className="px-3 py-2 bg-gray-700 border-b border-gray-600 font-bold text-xs text-white flex items-center gap-2"><Table size={12} /> posts</div>
                  <div className="p-2 space-y-1">
                      <div className="text-xs text-yellow-400 font-mono flex justify-between">id <span>PK uuid</span></div>
                      <div className="text-xs text-blue-400 font-mono flex justify-between">user_id <span>FK uuid</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">title <span>varchar</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">content <span>text</span></div>
                  </div>
              </div>

              {/* SVG Connector (Simple visual hack) */}
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
                  <path d="M 192 60 C 220 60, 220 180, 248 180" fill="none" stroke="#4b5563" strokeWidth="2" strokeDasharray="4" />
              </svg>
          </div>
      </div>
  );

  const VectorView = () => (
      <div className="flex-1 flex flex-col bg-gray-900">
          <div className="p-4 border-b border-gray-800 flex gap-2 items-center">
              <Search size={16} className="text-gray-500"/>
              <input 
                type="text" 
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500 flex-1"
                placeholder="Semantic search query..."
                value={vectorSearch}
                onChange={(e) => setVectorSearch(e.target.value)}
              />
              <Button size="sm" variant="secondary">Search</Button>
          </div>
          <div className="flex-1 p-4 relative">
              <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <XAxis type="number" dataKey="x" name="dim1" hide />
                      <YAxis type="number" dataKey="y" name="dim2" hide />
                      <ZAxis type="number" dataKey="z" range={[60, 400]} name="score" />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                          if (payload && payload.length) {
                              return (
                                  <div className="bg-gray-800 border border-gray-700 p-2 rounded shadow-lg text-xs max-w-[200px]">
                                      <p className="text-white font-semibold mb-1">Vector #{payload[0].payload.id}</p>
                                      <p className="text-gray-400">{payload[0].payload.text}</p>
                                  </div>
                              );
                          }
                          return null;
                      }} />
                      <Scatter name="Vectors" data={vectorData} fill="#6366f1" shape="circle" />
                  </ScatterChart>
              </ResponsiveContainer>
              <div className="absolute bottom-4 right-4 bg-gray-800/80 backdrop-blur p-2 rounded border border-gray-700 text-[10px] text-gray-400">
                  <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary-500"></div> Knowledge Chunk</div>
              </div>
          </div>
      </div>
  );

  const ArchitectureView = () => (
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

  const ScoreRing = ({ label, score, color }: { label: string, score: number, color: string }) => {
      const data = [{ value: score }, { value: 100 - score }];
      return (
          <div className="flex flex-col items-center">
              <div className="w-20 h-20 relative mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={data} cx="50%" cy="50%" innerRadius={25} outerRadius={35} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                              <Cell fill={color} />
                              <Cell fill="#374151" />
                          </Pie>
                      </PieChart>
                  </ResponsiveContainer>
                  <div className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${score >= 90 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {score}
                  </div>
              </div>
              <span className="text-xs font-medium text-gray-400">{label}</span>
          </div>
      );
  };

  const DependencyGraph = () => {
      // Calculate positions based on level
      const level0 = depGraph.filter(n => n.level === 0);
      const level1 = depGraph.filter(n => n.level === 1);
      const level2 = depGraph.filter(n => n.level === 2);
      
      return (
          <div className="bg-black/30 rounded-xl border border-gray-800 h-80 relative overflow-hidden flex items-center justify-center p-4">
              {/* Render Links */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {/* Static background web to look cool */}
                  <circle cx="50%" cy="50%" r="100" stroke="#374151" strokeWidth="1" fill="none" strokeDasharray="4"/>
                  <line x1="50%" y1="20%" x2="20%" y2="50%" stroke="#374151" opacity="0.5"/>
                  <line x1="50%" y1="20%" x2="80%" y2="50%" stroke="#374151" opacity="0.5"/>
                  <line x1="20%" y1="50%" x2="50%" y2="80%" stroke="#374151" opacity="0.5"/>
                  <line x1="80%" y1="50%" x2="50%" y2="80%" stroke="#374151" opacity="0.5"/>
              </svg>

              <div className="relative z-10 flex flex-col h-full w-full justify-between py-8">
                  <div className="flex justify-center gap-4">
                      {level0.map(n => (
                          <div key={n.id} className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-4 border-gray-900 shadow-xl z-20" title={n.name}>
                              {n.name.replace(/\..*/, '')}
                          </div>
                      ))}
                  </div>
                  
                  <div className="flex justify-around w-full px-12">
                      {level1.slice(0, 4).map(n => (
                          <div key={n.id} className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-[9px] font-medium text-white border-4 border-gray-900 shadow-lg z-20" title={n.name}>
                              {n.name.replace(/\..*/, '')}
                          </div>
                      ))}
                  </div>

                  <div className="flex justify-center gap-8">
                      {level2.slice(0, 3).map(n => (
                          <div key={n.id} className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-[8px] text-white border-2 border-gray-900 shadow-lg z-20" title={n.name}>
                              {n.name.replace(/\..*/, '')}
                          </div>
                      ))}
                  </div>
              </div>
              
              {depGraph.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">No dependencies found.</div>}
          </div>
      );
  };

  const AuditView = () => (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Gauge size={16} className="text-purple-400"/> Lighthouse Performance</h2>
              <Button size="sm" onClick={handleRunAudit} disabled={isAuditing}>
                  {isAuditing ? <Loader2 size={14} className="animate-spin mr-2"/> : <Zap size={14} className="mr-2"/>} Run Audit
              </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
              {!auditReport ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <Gauge size={48} className="opacity-20 mb-4"/>
                      <p className="text-sm">Run an audit to analyze performance.</p>
                  </div>
              ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                      <div className="flex justify-around bg-gray-800/50 p-6 rounded-xl border border-gray-800">
                          <ScoreRing label="Performance" score={auditReport.scores.performance} color={auditReport.scores.performance >= 90 ? '#10b981' : '#f59e0b'} />
                          <ScoreRing label="Accessibility" score={auditReport.scores.accessibility} color={auditReport.scores.accessibility >= 90 ? '#10b981' : '#f59e0b'} />
                          <ScoreRing label="Best Practices" score={auditReport.scores.bestPractices} color={auditReport.scores.bestPractices >= 90 ? '#10b981' : '#f59e0b'} />
                          <ScoreRing label="SEO" score={auditReport.scores.seo} color={auditReport.scores.seo >= 90 ? '#10b981' : '#f59e0b'} />
                      </div>

                      <div>
                          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Opportunities</h3>
                          <div className="space-y-3">
                              {auditReport.opportunities.map((opp, i) => (
                                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-start gap-3">
                                      <div className="mt-1 w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                                      <div className="flex-1">
                                          <div className="flex justify-between mb-1">
                                              <h4 className="text-sm font-bold text-gray-200">{opp.title}</h4>
                                              {opp.savings && <span className="text-xs text-gray-500">{opp.savings}</span>}
                                          </div>
                                          <p className="text-xs text-gray-400 leading-relaxed">{opp.description}</p>
                                      </div>
                                  </div>
                              ))}
                              {auditReport.opportunities.length === 0 && <div className="text-sm text-green-500 flex items-center gap-2"><Check size={14}/> No issues found. Great job!</div>}
                          </div>
                      </div>
                      
                      {/* Dependency Visualizer */}
                      <div className="mt-8 border-t border-gray-800 pt-8">
                          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2"><Share2 size={14}/> Dependency Graph</h3>
                          <DependencyGraph />
                      </div>
                  </div>
              )}
          </div>
      </div>
  );

  return (
    <div className={`border-l border-gray-800 bg-gray-900 flex flex-col transition-all duration-300 absolute md:static inset-0 md:inset-auto z-40 md:z-auto ${activeTab === 'deploy' ? 'md:w-[500px]' : 'md:w-[45%]'} w-full`}>
      <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-2 justify-between shrink-0">
         <div className="flex gap-1 bg-gray-800 p-0.5 rounded-lg overflow-x-auto scrollbar-none">
           <button onClick={() => setActiveTab('preview')} className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'preview' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Preview</button>
           {isBackend && <button onClick={() => setActiveTab('database')} className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'database' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>DB Studio</button>}
           <button onClick={() => setActiveTab('roadmap')} className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'roadmap' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Roadmap</button>
           <button onClick={() => setActiveTab('architecture')} className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'architecture' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Architect</button>
           <button onClick={() => setActiveTab('audit')} className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'audit' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Audit</button>
           <button onClick={() => setActiveTab('docs')} className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'docs' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Docs</button>
           <button onClick={() => setActiveTab('deploy')} className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'deploy' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Deploy</button>
         </div>
         <div className="flex gap-2">
             <Button size="sm" variant="ghost" onClick={onExport} title="Download Zip"><Download size={14}/></Button>
             {activeTab === 'preview' && <Button size="sm" variant="ghost" onClick={onRefreshPreview} title="Refresh"><RefreshCw size={14}/></Button>}
             <button onClick={onToggleLayout} className="text-gray-500 hover:text-white"><X size={14}/></button>
         </div>
      </div>
      
      {activeTab === 'preview' && (
        <div className="flex-1 bg-gray-950 flex flex-col relative overflow-hidden">
           {!isBackend && (<div className="h-8 bg-gray-800 flex items-center px-2 gap-2 border-b border-gray-700 shrink-0"><div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div><div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div></div><div className="flex-1 bg-gray-900 rounded text-[10px] text-gray-500 px-2 py-0.5 text-center font-mono truncate">localhost:3000</div>{isNative && (<div className="flex gap-1"><button onClick={() => setPreviewMode('mobile')} className={`p-1 rounded ${previewMode === 'mobile' ? 'text-white bg-gray-700' : 'text-gray-500'}`}><Smartphone size={12}/></button><button onClick={() => setPreviewMode('web')} className={`p-1 rounded ${previewMode === 'web' ? 'text-white bg-gray-700' : 'text-gray-500'}`}><Globe size={12}/></button><button onClick={() => setShowQrCode(!showQrCode)} className={`p-1 rounded ${showQrCode ? 'text-green-400 bg-gray-700' : 'text-gray-500'}`} title="Scan Expo QR"><QrCode size={12}/></button></div>)}</div>)}
           <div className="flex-1 flex items-center justify-center p-4 bg-gray-900/50 overflow-hidden relative">
              {isBackend ? (
                  <div className="w-full max-w-md bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden max-h-full">
                      <div className="p-3 border-b border-gray-700 bg-gray-900 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Network size={14} className="text-green-500"/> API Console (Postman)</div>
                      <div className="p-4 space-y-4 overflow-y-auto">
                          <div className="flex gap-2"><select value={apiMethod} onChange={e => setApiMethod(e.target.value)} className="bg-gray-900 border border-gray-700 rounded px-2 text-xs font-bold text-blue-400 focus:outline-none"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select><input type="text" value={apiPath} onChange={e => setApiPath(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 text-sm font-mono text-white focus:border-primary-500 focus:outline-none" /><Button size="sm" onClick={handleApiSend}>Send</Button></div>
                          <div className="bg-black rounded-lg border border-gray-700 p-3 h-64 font-mono text-xs overflow-auto">{apiStatus && (<div className={`mb-2 text-[10px] font-bold ${apiStatus >= 200 && apiStatus < 300 ? 'text-green-500' : 'text-red-500'}`}>Status: {apiStatus}</div>)}<pre className="text-green-400 whitespace-pre-wrap">{apiResponse}</pre></div>
                      </div>
                  </div>
              ) : (isNative && previewMode === 'mobile' ? (
                  <div className="relative transition-all duration-500">
                      <div className={`border-8 border-gray-800 rounded-[3rem] overflow-hidden bg-white relative shadow-2xl ${deviceFrame === 'ipad' ? 'w-[500px] h-[700px]' : 'w-[320px] h-[650px]'}`}>
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                          <iframe id="preview-iframe" title="preview" srcDoc={previewSrc} className="w-full h-full border-none bg-white" sandbox="allow-scripts" />
                          {showQrCode && (<div className="absolute inset-0 bg-black/90 z-30 flex flex-col items-center justify-center text-center p-6 animate-in fade-in"><div className="bg-white p-2 rounded-lg mb-4"><QrCode size={150} className="text-black" /></div><h3 className="text-white font-bold mb-1">Scan with Expo Go</h3><p className="text-gray-400 text-xs">Open the camera on your iOS/Android device.</p><button onClick={() => setShowQrCode(false)} className="mt-6 text-gray-500 text-xs underline">Close</button></div>)}
                      </div>
                      <div className="absolute -right-16 top-0 flex flex-col gap-2 bg-gray-800 p-1 rounded-lg border border-gray-700">
                          <button onClick={() => setDeviceFrame('iphone14')} className={`p-2 rounded ${deviceFrame === 'iphone14' ? 'bg-primary-600 text-white' : 'text-gray-500'}`} title="iPhone 14"><Smartphone size={16}/></button>
                          <button onClick={() => setDeviceFrame('pixel7')} className={`p-2 rounded ${deviceFrame === 'pixel7' ? 'bg-primary-600 text-white' : 'text-gray-500'}`} title="Pixel 7"><Smartphone size={16} className="rotate-90"/></button>
                          <button onClick={() => setDeviceFrame('ipad')} className={`p-2 rounded ${deviceFrame === 'ipad' ? 'bg-primary-600 text-white' : 'text-gray-500'}`} title="iPad Air"><Smartphone size={16} className="scale-125"/></button>
                      </div>
                  </div>
              ) : (
                  <div className="w-full h-full bg-white shadow-lg"><iframe id="preview-iframe" title="preview" srcDoc={previewSrc} className="w-full h-full border-none" sandbox="allow-scripts" /></div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'database' && (
          <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-200"><Database size={16} className="text-yellow-500" /> Postgres Explorer</div>
                  <div className="flex bg-gray-800 rounded p-0.5">
                      <button onClick={() => setDbView('data')} className={`px-3 py-1 text-xs rounded ${dbView === 'data' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Data</button>
                      <button onClick={() => setDbView('schema')} className={`px-3 py-1 text-xs rounded ${dbView === 'schema' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Schema</button>
                      <button onClick={() => setDbView('query')} className={`px-3 py-1 text-xs rounded ${dbView === 'query' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>SQL</button>
                      <button onClick={() => setDbView('vectors')} className={`px-3 py-1 text-xs rounded ${dbView === 'vectors' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Vectors</button>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => alert("Connected to Neon DB")}>Connect</Button>
              </div>
              
              {dbView === 'schema' ? <SchemaView /> : dbView === 'vectors' ? <VectorView /> : (
                  <div className="flex-1 p-4 flex flex-col overflow-hidden">
                      <div className="flex gap-2 mb-4 h-full">
                          <div className="w-48 bg-gray-800 border border-gray-700 rounded-lg p-2 flex flex-col"><div className="text-xs font-bold text-gray-500 uppercase mb-2 px-2">Tables</div><div className="space-y-1 overflow-y-auto"><div className="px-2 py-1 bg-primary-900/30 text-primary-300 rounded text-sm cursor-pointer">public.users</div><div className="px-2 py-1 hover:bg-gray-700 text-gray-400 rounded text-sm cursor-pointer">public.posts</div><div className="px-2 py-1 hover:bg-gray-700 text-gray-400 rounded text-sm cursor-pointer">auth.sessions</div></div></div>
                          <div className="flex-1 flex flex-col min-w-0">
                              {dbView === 'query' && (
                                  <div className="mb-2 flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
                                      <div className="flex-1 flex items-center gap-2 px-2">
                                          <Wand2 size={14} className="text-purple-400" />
                                          <input 
                                            type="text" 
                                            className="bg-transparent text-xs text-white w-full focus:outline-none py-1" 
                                            placeholder="Ask AI to write SQL (e.g., 'Select all users created yesterday')" 
                                            value={nlQuery}
                                            onChange={(e) => setNlQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleGenerateSQL()}
                                          />
                                      </div>
                                      <button onClick={handleGenerateSQL} disabled={isGeneratingSQL} className="bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-[10px] px-2 py-1 rounded border border-purple-800/50">
                                          {isGeneratingSQL ? <Loader2 size={10} className="animate-spin"/> : 'Generate'}
                                      </button>
                                  </div>
                              )}
                              <div className="bg-black border border-gray-700 rounded-t-lg p-2 flex gap-2 shrink-0"><textarea className="w-full bg-transparent text-green-400 font-mono text-sm focus:outline-none resize-none h-20" value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} /><button onClick={handleRunQuery} className="self-start bg-primary-600 hover:bg-primary-500 text-white p-2 rounded"><Play size={14}/></button></div>
                              <div className="flex-1 bg-gray-800 border-x border-b border-gray-700 rounded-b-lg overflow-auto"><table className="w-full text-left text-xs text-gray-300"><thead className="bg-gray-900 font-bold text-gray-500 sticky top-0"><tr>{Object.keys(dbResults[0] || {}).map(k => <th key={k} className="px-4 py-2 border-b border-gray-700">{k}</th>)}</tr></thead><tbody className="divide-y divide-gray-700 font-mono">{dbResults.map((row, i) => (<tr key={i} className="hover:bg-gray-750">{Object.values(row).map((val: any, j) => <td key={j} className="px-4 py-2">{val}</td>)}</tr>))}</tbody></table></div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}

      {activeTab === 'roadmap' && (
          <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><Map size={18} className="text-primary-500"/> Project Roadmap</h2>
                  <Button size="sm" onClick={onGeneratePlan} disabled={isGeneratingPlan}>{isGeneratingPlan ? <Loader2 size={14} className="animate-spin"/> : <BrainCircuit size={14} className="mr-2"/>} Generate Plan</Button>
              </div>
              
              {roadmap.length === 0 ? (
                  <div className="text-center text-gray-500 mt-10">
                      <p className="text-sm">No active plan. Generate one to get started.</p>
                  </div>
              ) : (
                  <div className="space-y-6">
                      {roadmap.map((phase, i) => (
                          <div key={phase.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                              <div className="flex justify-between items-center mb-3">
                                  <h3 className="font-bold text-gray-200 text-sm">{phase.title}</h3>
                                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${phase.status === 'completed' ? 'bg-green-900 text-green-400' : phase.status === 'active' ? 'bg-blue-900 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>{phase.status}</span>
                              </div>
                              <div className="space-y-2 mb-4">
                                  {phase.goals.map((g, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-400"><Flag size={10} className="text-yellow-500"/> {g}</div>
                                  ))}
                              </div>
                              <div className="space-y-1 bg-black/30 p-3 rounded-lg mb-3">
                                  <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Tasks</div>
                                  {phase.tasks.map(task => (
                                      <div key={task.id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white group" onClick={() => onToggleTask(phase.id, task.id)}>
                                          <div className={`w-3 h-3 rounded-sm border border-gray-600 flex items-center justify-center ${task.done ? 'bg-green-500 border-green-500' : ''}`}>
                                              {task.done && <Check size={8} className="text-black"/>}
                                          </div>
                                          <span className={task.done ? 'line-through opacity-50' : ''}>{task.text}</span>
                                      </div>
                                  ))}
                              </div>
                              <Button size="sm" variant="secondary" className="w-full text-xs h-7" onClick={() => onExecutePhase(phase)}>
                                  <ArrowRight size={12} className="mr-1"/> Execute Phase with AI
                              </Button>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {activeTab === 'architecture' && <ArchitectureView />}
      {activeTab === 'audit' && <AuditView />}

      {activeTab === 'docs' && (
          <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
                  <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Book size={16} className="text-blue-400"/> Documentation</h2>
                  <Button size="sm" onClick={handleGenerateDocs} disabled={isGeneratingDocs}>
                      {isGeneratingDocs ? <Loader2 size={14} className="animate-spin mr-2"/> : <FileText size={14} className="mr-2"/>} Generate
                  </Button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                  {docContent ? (
                      <article className="prose prose-invert prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap font-sans">{docContent}</pre>
                      </article>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <Book size={48} className="opacity-20 mb-4"/>
                          <p className="text-sm">No documentation generated yet.</p>
                          <p className="text-xs opacity-60">Click Generate to create a README.md</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {activeTab === 'deploy' && (
          <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
              {deploymentState === 'deployed' ? (
                  <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
                      <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 flex items-center justify-between animate-in slide-in-from-top-4">
                          <div>
                              <div className="text-xs font-bold text-green-500 uppercase mb-1 flex items-center gap-2"><Check size={12}/> Production Active</div>
                              <a href="#" className="text-white hover:underline font-mono text-sm flex items-center gap-2">{deployUrl} <ExternalLink size={12}/></a>
                          </div>
                          <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white border-none">Visit</Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl">
                              <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Activity size={12}/> Latency</div>
                              <div className="text-2xl text-white font-mono">45ms <span className="text-xs text-green-500">-12%</span></div>
                          </div>
                          <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl">
                              <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Globe size={12}/> Requests/m</div>
                              <div className="text-2xl text-white font-mono">1.2k <span className="text-xs text-blue-500">+5%</span></div>
                          </div>
                      </div>

                      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 h-48 flex flex-col">
                          <div className="text-gray-500 text-xs font-bold uppercase mb-4">Traffic Overview</div>
                          <div className="flex-1 min-w-0">
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={metricsData}>
                                      <defs>
                                          <linearGradient id="colorReqs" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                          </linearGradient>
                                      </defs>
                                      <XAxis dataKey="time" hide />
                                      <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151' }} itemStyle={{ color: '#fff' }} />
                                      <Area type="monotone" dataKey="reqs" stroke="#6366f1" fillOpacity={1} fill="url(#colorReqs)" />
                                  </AreaChart>
                              </ResponsiveContainer>
                          </div>
                      </div>

                      <div className="flex-1 bg-black border border-gray-800 rounded-xl p-4 flex flex-col min-h-[200px]">
                          <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Terminal size={12}/> Server Logs (Live)</div>
                          <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 text-gray-300">
                              {serverLogs.map((log, i) => <div key={i}>{log}</div>)}
                              <div className="animate-pulse text-primary-500">_</div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-full max-w-md space-y-8">
                          <div className="relative">
                              <div className="w-20 h-20 mx-auto bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-700 mb-4 z-10 relative">
                                  {deploymentState === 'idle' && <Rocket size={32} className="text-gray-500" />}
                                  {deploymentState === 'building' && <Package size={32} className="text-blue-500 animate-bounce" />}
                                  {deploymentState === 'optimizing' && <Zap size={32} className="text-yellow-500 animate-pulse" />}
                                  {deploymentState === 'uploading' && <UploadCloud size={32} className="text-purple-500 animate-pulse" />}
                              </div>
                              {deploymentState !== 'idle' && (<div className="absolute inset-0 bg-primary-500/20 rounded-full blur-xl animate-pulse"></div>)}
                          </div>
                          <div>
                              <h2 className="text-2xl font-bold text-white mb-2">{deploymentState === 'idle' ? 'Ready to Deploy' : 'Deploying to Production...'}</h2>
                              <p className="text-gray-400">{deploymentState === 'idle' ? `Deploy ${project?.name} to our global edge network.` : 'Optimizing assets and configuring SSL...'}</p>
                          </div>
                          {deploymentState === 'idle' && (<Button size="lg" className="w-full" onClick={handleDeploy}><Rocket size={18} className="mr-2" /> Deploy Now</Button>)}
                          <div className="border-t border-gray-800 pt-6 mt-8 text-left">
                              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><History size={12}/> Past Deployments</h3>
                              <div className="bg-gray-800 rounded-lg overflow-hidden">
                                  {MOCK_DEPLOYMENTS.map((dep) => (<div key={dep.id} className="flex items-center justify-between p-3 border-b border-gray-700 last:border-0 hover:bg-gray-750"><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${dep.status === 'Success' ? 'bg-green-500' : 'bg-red-500'}`}></div><div><div className="text-xs font-medium text-gray-300">{dep.hash} <span className="text-gray-500">• {dep.env}</span></div><div className="text-[10px] text-gray-500">{dep.date}</div></div></div><div className="text-xs text-gray-400">{dep.status}</div></div>))}
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};
