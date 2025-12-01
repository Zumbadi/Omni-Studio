
import React, { useState, useEffect } from 'react';
import { Rocket, Package, Zap, UploadCloud, Check, ExternalLink, History, Activity, Globe, Terminal, RotateCcw, AlertTriangle, Loader2, Container, Server, GitBranch, RefreshCw, GitMerge, Layers, ShieldCheck, Box, HardDrive, Play, Square, Pause, X } from 'lucide-react';
import { Button } from './Button';
import { Project, ProjectType } from '../types';
import { MOCK_DEPLOYMENTS } from '../constants';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { logActivity } from '../utils/activityLogger';

interface DeploymentConsoleProps {
  project: Project;
  onLog: (msg: string) => void;
  onDeploymentComplete?: (url: string) => void;
  currentBranch?: string;
  onMerge?: () => void;
}

export const DeploymentConsole: React.FC<DeploymentConsoleProps> = ({ project, onLog, onDeploymentComplete, currentBranch = 'main', onMerge }) => {
  const [deploymentState, setDeploymentState] = useState<'idle' | 'building' | 'containerizing' | 'pushing' | 'deploying' | 'deployed' | 'rolling_back' | 'linting' | 'testing' | 'ready'>('idle');
  const [deployUrl, setDeployUrl] = useState(project.deploymentUrl || '');
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [metricsData, setMetricsData] = useState<{time: string, reqs: number, latency: number}[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [containerLogs, setContainerLogs] = useState<Record<string, string[]>>({});
  
  // Docker Service Stats
  const [services, setServices] = useState([
      { name: 'app-container', status: 'running', cpu: '0%', mem: '0MB', port: '3000', restarts: 0 },
      { name: 'db-postgres', status: 'running', cpu: '0%', mem: '0MB', port: '5432', restarts: 0 },
      { name: 'cache-redis', status: 'running', cpu: '0%', mem: '0MB', port: '6379', restarts: 0 }
  ]);

  const isDev = currentBranch !== 'main';

  // Reset state on branch switch
  useEffect(() => {
      setDeploymentState('idle');
      setSelectedContainer(null);
  }, [currentBranch]);

  // Metric Simulation
  useEffect(() => {
      if (deploymentState === 'deployed' || (isDev && deploymentState === 'ready')) {
          const interval = setInterval(() => {
              // Traffic Metrics
              setMetricsData(prev => {
                  const now = new Date();
                  const newPoint = {
                      time: `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`,
                      reqs: Math.floor(Math.random() * 100) + 50,
                      latency: Math.floor(Math.random() * 50) + 20
                  };
                  const newData = [...prev, newPoint];
                  return newData.length > 50 ? newData.slice(newData.length - 50) : newData;
              });
              
              // Container Stats
              if (isDev) {
                  setServices(prev => prev.map(s => ({
                      ...s,
                      cpu: s.status === 'running' ? `${Math.floor(Math.random() * 20)}%` : '0%',
                      mem: s.status === 'running' ? `${Math.floor(Math.random() * 100 + 50)}MB` : '0MB'
                  })));
                  
                  // Generate logs for active containers
                  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                  services.forEach(s => {
                      if (s.status === 'running') {
                          const msgs = [
                              `[${s.name}] INFO: Heartbeat check passed`,
                              `[${s.name}] DEBUG: Processing queue item ${Math.floor(Math.random() * 1000)}`,
                              `[${s.name}] INFO: Connection pool active: ${Math.floor(Math.random() * 10)}/20`
                          ];
                          if (Math.random() > 0.7) {
                              const msg = `${timestamp} ${msgs[Math.floor(Math.random() * msgs.length)]}`;
                              setContainerLogs(prev => ({
                                  ...prev,
                                  [s.name]: [...(prev[s.name] || []), msg].slice(-50)
                              }));
                          }
                      }
                  });
              }
              
              if (Math.random() > 0.7 && deploymentState === 'deployed') {
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
  }, [deploymentState, isDev, services]);

  const handleDeploy = () => {
    if (isDev) {
        handleDevPipeline();
        return;
    }

    setDeploymentState('building');
    
    const sequence = [
      { state: 'building', log: '> Compiling source code...', delay: 2000 },
      { state: 'containerizing', log: '> Building Docker image (omni/app:latest)...', delay: 2500 },
      { state: 'pushing', log: '> Pushing image to Container Registry...', delay: 2000 },
      { state: 'deploying', log: '> Deploying Containers to Kubernetes Cluster...', delay: 2000 },
      { state: 'deployed', log: '> Deployment Successful! Pods are healthy.', delay: 1000 }
    ];

    let currentDelay = 0;
    sequence.forEach(({ state, log, delay }) => {
      currentDelay += delay;
      setTimeout(() => {
        setDeploymentState(state as any);
        onLog(log);
        if (state === 'deployed') {
            const url = `https://${project?.name.toLowerCase().replace(/\s+/g, '-')}.omni.app`;
            setDeployUrl(url);
            logActivity('deploy', 'Deployment Success', `Deployed ${project.name} to production`, project.id);
            if (onDeploymentComplete) onDeploymentComplete(url);
        }
      }, currentDelay);
    });
  };

  const handleDevPipeline = () => {
      setDeploymentState('linting');
      
      const sequence = [
        { state: 'linting', log: '> Running ESLint & Prettier check...', delay: 1500 },
        { state: 'containerizing', log: '> docker build -t omni/app:dev .', delay: 1000 },
        { state: 'containerizing', log: '> [1/5] FROM node:18-alpine', delay: 1500 },
        { state: 'containerizing', log: '> [2/5] WORKDIR /app', delay: 1800 },
        { state: 'containerizing', log: '> [3/5] COPY package*.json ./', delay: 2100 },
        { state: 'containerizing', log: '> [4/5] RUN npm install', delay: 3000 },
        { state: 'testing', log: '> Running Integration Tests inside Container...', delay: 4000 },
        { state: 'ready', log: '> CI Pipeline Passed. Image pushed to dev registry.', delay: 1000 }
      ];

      let currentDelay = 0;
      sequence.forEach(({ state, log, delay }) => {
        currentDelay += delay;
        setTimeout(() => {
          if (state !== 'containerizing' || deploymentState !== 'containerizing') {
             setDeploymentState(state as any);
          }
          onLog(log);
          if (state === 'ready') {
              logActivity('deploy', 'CI Success', `Dev branch ${currentBranch} passed CI`, project.id);
          }
        }, currentDelay);
      });
  };

  const handleRollback = (hash: string) => {
      if (confirm(`Are you sure you want to rollback to version ${hash}? This will revert the live site immediately.`)) {
          onLog(`> Initiating rollback to ${hash}...`);
          setDeploymentState('rolling_back');
          
          setTimeout(() => {
              onLog(`> Version ${hash} image pulled from registry.`);
              setDeploymentState('deploying');
              setTimeout(() => {
                  setDeploymentState('deployed');
                  onLog(`> Rollback complete. Live version is now ${hash}.`);
                  logActivity('deploy', 'Rollback Success', `Rolled back to ${hash}`, project.id);
              }, 1500);
          }, 1000);
      }
  };

  const handleContainerAction = (name: string, action: 'start' | 'stop' | 'restart') => {
      setServices(prev => prev.map(s => {
          if (s.name === name) {
              if (action === 'stop') return { ...s, status: 'stopped', cpu: '0%', mem: '0MB' };
              if (action === 'start') return { ...s, status: 'running' };
              if (action === 'restart') return { ...s, status: 'running', restarts: s.restarts + 1 };
          }
          return s;
      }));
      
      const logMsg = `> docker ${action} ${name}`;
      setContainerLogs(prev => ({
          ...prev,
          [name]: [...(prev[name] || []), `${new Date().toISOString().split('T')[1].split('.')[0]} [System] Container ${action}ed`]
      }));
  };

  const triggerMerge = () => {
      if (onMerge) onMerge();
  };

  // Pipeline Step Component
  const PipelineStep = ({ label, status, icon: Icon }: any) => {
      let color = 'text-gray-500 border-gray-700 bg-gray-900';
      if (status === 'active') color = 'text-blue-400 border-blue-500 bg-blue-900/20 animate-pulse';
      if (status === 'done') color = 'text-green-400 border-green-500 bg-green-900/20';
      
      return (
          <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border ${color} transition-all duration-300 min-w-[80px]`}>
              <Icon size={20} />
              <span className="text-[10px] font-bold uppercase">{label}</span>
          </div>
      );
  };

  const getStepStatus = (step: string) => {
      const states = isDev 
        ? ['idle', 'linting', 'containerizing', 'testing', 'ready']
        : ['idle', 'building', 'containerizing', 'pushing', 'deploying', 'deployed'];
      
      const currentIdx = states.indexOf(deploymentState);
      const stepIdx = states.indexOf(step);
      
      // Handle potential mismatched states (e.g. rolling_back is not in the linear flow)
      if (currentIdx === -1) return 'pending';

      if (currentIdx === stepIdx) return 'active';
      if (currentIdx > stepIdx) return 'done';
      return 'pending';
  };

  if (deploymentState === 'deployed') {
      return (
          <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto animate-in fade-in duration-300">
              <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                      <div className="text-xs font-bold text-green-500 uppercase mb-1 flex items-center gap-2"><Check size={12}/> Production Active</div>
                      <a href="#" className="text-white hover:underline font-mono text-sm flex items-center gap-2">{deployUrl} <ExternalLink size={12}/></a>
                  </div>
                  <Button size="sm" className="bg-green-600 hover:bg-green-500 text-white border-none">Visit</Button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl min-w-0">
                      <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Activity size={12}/> Latency</div>
                      <div className="text-2xl text-white font-mono">45ms <span className="text-xs text-green-500">-12%</span></div>
                  </div>
                  <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl min-w-0">
                      <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Globe size={12}/> Requests/m</div>
                      <div className="text-2xl text-white font-mono">1.2k <span className="text-xs text-blue-500">+5%</span></div>
                  </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 h-48 flex flex-col min-h-[200px]">
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
                  <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 text-gray-300 scrollbar-thin scrollbar-thumb-gray-700">
                      {serverLogs.map((log, i) => <div key={i}>{log}</div>)}
                      <div className="animate-pulse text-primary-500">_</div>
                  </div>
              </div>
          </div>
      );
  }

  return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center animate-in fade-in overflow-y-auto w-full">
          <div className="w-full max-w-4xl space-y-8">
              {/* Branch Indicator */}
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${isDev ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' : 'bg-green-900/30 text-green-400 border-green-500/30'}`}>
                  <GitBranch size={12}/> {currentBranch} {isDev ? '(Development)' : '(Production)'}
              </div>

              {/* Pipeline Visualizer (Dev Mode) */}
              {isDev && deploymentState !== 'idle' && (
                  <div className="w-full">
                      <div className="flex justify-between items-center relative mb-8">
                          {/* Connection Line */}
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-800 -z-10"></div>
                          
                          <PipelineStep label="Lint" status={getStepStatus('linting')} icon={Check} />
                          <PipelineStep label="Docker" status={getStepStatus('containerizing')} icon={Container} />
                          <PipelineStep label="Test" status={getStepStatus('testing')} icon={Zap} />
                          <PipelineStep label="Ready" status={getStepStatus('ready')} icon={GitMerge} />
                      </div>
                  </div>
              )}

              {/* Production Pipeline Visualizer */}
              {!isDev && deploymentState !== 'idle' && (
                  <div className="w-full">
                      <div className="flex justify-between items-center relative mb-8">
                          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-800 -z-10"></div>
                          <PipelineStep label="Build" status={getStepStatus('building')} icon={Package} />
                          <PipelineStep label="Image" status={getStepStatus('containerizing')} icon={Container} />
                          <PipelineStep label="Registry" status={getStepStatus('pushing')} icon={UploadCloud} />
                          <PipelineStep label="Deploy" status={getStepStatus('deploying')} icon={Rocket} />
                      </div>
                  </div>
              )}

              {/* Initial State Visual */}
              {deploymentState === 'idle' && (
                  <div className="relative">
                      <div className="w-24 h-24 mx-auto bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-700 mb-4 z-10 relative">
                          {isDev ? <Container size={36} className="text-purple-500"/> : <Rocket size={36} className="text-gray-500" />}
                      </div>
                      <div className={`absolute inset-0 rounded-full blur-xl animate-pulse ${isDev ? 'bg-purple-500/20' : 'bg-primary-500/20'}`}></div>
                  </div>
              )}

              {/* Status Text */}
              <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                      {deploymentState === 'idle' ? (isDev ? 'Run CI Pipeline' : 'Ready to Deploy') : 
                       deploymentState === 'rolling_back' ? 'Rolling Back Version...' : 
                       deploymentState === 'containerizing' ? 'Building Docker Image...' :
                       deploymentState === 'pushing' ? 'Pushing to Registry...' :
                       deploymentState === 'deploying' ? 'Deploying to Cluster...' : 
                       deploymentState === 'linting' ? 'Linting Codebase...' :
                       deploymentState === 'testing' ? 'Running Integration Tests...' :
                       deploymentState === 'ready' ? 'Pipeline Success' :
                       'Deploying...'}
                  </h2>
                  <p className="text-gray-400">
                      {deploymentState === 'idle' ? 
                          (isDev ? `Pipeline: Lint -> Docker Build -> Test -> Registry.` : `Pipeline: Source -> Docker -> Registry -> Cluster.`) : 
                       deploymentState === 'rolling_back' ? 'Restoring previous stable state.' : 
                       deploymentState === 'ready' ? 'Image pushed. Branch ready to merge.' :
                       'Optimizing assets and verifying configuration...'}
                  </p>
              </div>
              
              {/* Container Registry & Artifacts (Success State) */}
              {deploymentState === 'ready' && (
                  <div className="grid grid-cols-2 gap-4 text-left animate-in slide-in-from-bottom-4">
                      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                          <div className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><HardDrive size={12}/> Container Registry</div>
                          <div className="text-sm text-white font-mono mb-1 flex justify-between items-center">
                              <span>omni/app:dev-latest</span>
                              <span className="text-[10px] bg-green-900/30 text-green-400 px-1.5 py-0.5 rounded">PUSHED</span>
                          </div>
                          <div className="text-xs text-gray-400">Tag: {Math.random().toString(36).substr(2, 7)} • 142MB</div>
                      </div>
                      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                          <div className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-2"><ShieldCheck size={12}/> Security Scan</div>
                          <div className="text-sm text-green-400 font-bold mb-1">Passed</div>
                          <div className="text-xs text-gray-400">0 Critical, 0 High Vulnerabilities</div>
                      </div>
                  </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                  {deploymentState === 'idle' && (
                      <Button size="lg" className={`w-full ${isDev ? 'bg-purple-600 hover:bg-purple-500' : ''}`} onClick={handleDeploy}>
                          {isDev ? <Container size={18} className="mr-2"/> : <Rocket size={18} className="mr-2" />} 
                          {isDev ? 'Start CI Pipeline' : 'Deploy to Production'}
                      </Button>
                  )}

                  {deploymentState === 'ready' && onMerge && (
                      <Button size="lg" className="w-full bg-green-600 hover:bg-green-500 animate-in fade-in zoom-in" onClick={triggerMerge}>
                          <GitMerge size={18} className="mr-2" /> Merge to Main
                      </Button>
                  )}
              </div>

              {/* Dev Service Monitor */}
              {isDev && deploymentState === 'ready' && (
                  <div className="border-t border-gray-800 pt-6 text-left w-full flex gap-4">
                      {/* Service List */}
                      <div className={`transition-all duration-300 ${selectedContainer ? 'w-1/3' : 'w-full'}`}>
                          <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><Box size={12}/> Docker Services</h3>
                          <div className="grid grid-cols-1 gap-2">
                              {services.map(s => (
                                  <div 
                                    key={s.name} 
                                    onClick={() => setSelectedContainer(s.name)}
                                    className={`bg-gray-800/50 border rounded-lg p-3 flex justify-between items-center hover:bg-gray-800 transition-colors cursor-pointer ${selectedContainer === s.name ? 'border-primary-500 ring-1 ring-primary-500/50' : 'border-gray-700'}`}
                                  >
                                      <div className="flex items-center gap-3">
                                          <div className={`w-2 h-2 rounded-full ${s.status === 'running' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                                          <div>
                                              <div className="text-sm font-medium text-gray-200">{s.name}</div>
                                              <div className="text-[10px] text-gray-500 font-mono">0.0.0.0:{s.port}</div>
                                          </div>
                                      </div>
                                      <div className="text-right text-[10px] text-gray-400 font-mono">
                                          <div>CPU: {s.cpu}</div>
                                          <div>MEM: {s.mem}</div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Container Inspector */}
                      {selectedContainer && (
                          <div className="w-2/3 bg-black rounded-xl border border-gray-800 flex flex-col overflow-hidden animate-in slide-in-from-right-4">
                              {(() => {
                                  const s = services.find(srv => srv.name === selectedContainer);
                                  if (!s) return null;
                                  return (
                                      <>
                                          <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900">
                                              <div className="flex items-center gap-2">
                                                  <Container size={14} className="text-blue-400"/>
                                                  <span className="text-sm font-bold text-white">{s.name}</span>
                                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${s.status === 'running' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{s.status}</span>
                                              </div>
                                              <div className="flex gap-1">
                                                  <button 
                                                    onClick={() => handleContainerAction(s.name, s.status === 'running' ? 'stop' : 'start')}
                                                    className={`p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white`}
                                                    title={s.status === 'running' ? "Stop" : "Start"}
                                                  >
                                                      {s.status === 'running' ? <Square size={12} fill="currentColor"/> : <Play size={12}/>}
                                                  </button>
                                                  <button 
                                                    onClick={() => handleContainerAction(s.name, 'restart')}
                                                    className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
                                                    title="Restart"
                                                  >
                                                      <RotateCcw size={12}/>
                                                  </button>
                                                  <button 
                                                    onClick={() => setSelectedContainer(null)} 
                                                    className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
                                                  >
                                                      <X size={14}/>
                                                  </button>
                                              </div>
                                          </div>
                                          <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] text-gray-300 space-y-1 bg-black/50">
                                              {containerLogs[s.name]?.map((line, i) => (
                                                  <div key={i} className="break-all">{line}</div>
                                              ))}
                                              {(!containerLogs[s.name] || containerLogs[s.name].length === 0) && (
                                                  <div className="text-gray-600 italic">Listening for logs...</div>
                                              )}
                                              {s.status === 'running' && <div className="animate-pulse text-primary-500">_</div>}
                                          </div>
                                      </>
                                  );
                              })()}
                          </div>
                      )}
                  </div>
              )}
              
              {/* History */}
              {!selectedContainer && (
                  <div className="border-t border-gray-800 pt-6 mt-8 text-left w-full">
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><History size={12}/> Deployment History</h3>
                      <div className="bg-gray-800 rounded-lg overflow-hidden">
                          {MOCK_DEPLOYMENTS.map((dep) => (
                              <div key={dep.id} className="flex items-center justify-between p-3 border-b border-gray-700 last:border-0 hover:bg-gray-750 group">
                                  <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${dep.status === 'Success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                      <div>
                                          <div className="text-xs font-medium text-gray-300">{dep.hash} <span className="text-gray-500">• {dep.env}</span></div>
                                          <div className="text-[10px] text-gray-500">{dep.date}</div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-400 mr-2">{dep.status}</span>
                                      {dep.status === 'Success' && !isDev && (
                                          <button 
                                              onClick={() => handleRollback(dep.hash)}
                                              className="p-1.5 bg-gray-700 hover:bg-red-900/30 text-gray-400 hover:text-red-300 rounded transition-all opacity-0 group-hover:opacity-100"
                                              title="Rollback to this version"
                                          >
                                              <RotateCcw size={12}/>
                                          </button>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
};
