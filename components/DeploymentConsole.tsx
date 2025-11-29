
import React, { useState, useEffect } from 'react';
import { Rocket, Package, Zap, UploadCloud, Check, ExternalLink, History, Activity, Globe, Terminal, RotateCcw, AlertTriangle, Loader2, Container, Server } from 'lucide-react';
import { Button } from './Button';
import { Project, ProjectType } from '../types';
import { MOCK_DEPLOYMENTS } from '../constants';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { logActivity } from '../utils/activityLogger';

interface DeploymentConsoleProps {
  project: Project;
  onLog: (msg: string) => void;
  onDeploymentComplete?: (url: string) => void;
}

export const DeploymentConsole: React.FC<DeploymentConsoleProps> = ({ project, onLog, onDeploymentComplete }) => {
  const [deploymentState, setDeploymentState] = useState<'idle' | 'building' | 'containerizing' | 'pushing' | 'deploying' | 'deployed' | 'rolling_back'>('idle');
  const [deployUrl, setDeployUrl] = useState(project.deploymentUrl || '');
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [metricsData, setMetricsData] = useState<{time: string, reqs: number, latency: number}[]>([]);

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

  const handleDeploy = () => {
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
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center animate-in fade-in">
          <div className="w-full max-w-md space-y-8">
              <div className="relative">
                  <div className="w-20 h-20 mx-auto bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-700 mb-4 z-10 relative">
                      {deploymentState === 'idle' && <Rocket size={32} className="text-gray-500" />}
                      {deploymentState === 'building' && <Package size={32} className="text-blue-500 animate-bounce" />}
                      {deploymentState === 'containerizing' && <Container size={32} className="text-orange-500 animate-pulse" />}
                      {deploymentState === 'pushing' && <UploadCloud size={32} className="text-purple-500 animate-pulse" />}
                      {deploymentState === 'deploying' && <Server size={32} className="text-green-500 animate-pulse" />}
                      {deploymentState === 'rolling_back' && <RotateCcw size={32} className="text-red-500 animate-spin" />}
                  </div>
                  {deploymentState !== 'idle' && (<div className="absolute inset-0 bg-primary-500/20 rounded-full blur-xl animate-pulse"></div>)}
              </div>
              <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                      {deploymentState === 'idle' ? 'Ready to Deploy' : 
                       deploymentState === 'rolling_back' ? 'Rolling Back Version...' : 
                       deploymentState === 'containerizing' ? 'Building Docker Image...' :
                       deploymentState === 'pushing' ? 'Pushing to Registry...' :
                       deploymentState === 'deploying' ? 'Deploying to Cluster...' : 
                       'Deploying...'}
                  </h2>
                  <p className="text-gray-400">
                      {deploymentState === 'idle' ? `Pipeline: Source -> Docker -> Registry -> Cluster.` : 
                       deploymentState === 'rolling_back' ? 'Restoring previous stable state.' : 
                       'Optimizing container assets and configuring K8s pods...'}
                  </p>
              </div>
              
              {deploymentState === 'idle' && (<Button size="lg" className="w-full" onClick={handleDeploy}><Rocket size={18} className="mr-2" /> Start Pipeline</Button>)}
              
              <div className="border-t border-gray-800 pt-6 mt-8 text-left">
                  <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><History size={12}/> Past Deployments</h3>
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
                                  {dep.status === 'Success' && (
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
          </div>
      </div>
  );
};
