
import React, { useState, useEffect } from 'react';
import { Rocket, Package, Zap, UploadCloud, Check, ExternalLink, History, Activity, Globe, Terminal, Loader2 } from 'lucide-react';
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
  const [deploymentState, setDeploymentState] = useState<'idle' | 'building' | 'optimizing' | 'uploading' | 'deployed'>('idle');
  const [deployUrl, setDeployUrl] = useState('');
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
        if (state === 'deployed') {
            const url = `https://${project?.name.toLowerCase().replace(/\s+/g, '-')}.vercel.app`;
            setDeployUrl(url);
            logActivity('deploy', 'Deployment Success', `Deployed ${project.name} to production`, project.id);
            if (onDeploymentComplete) onDeploymentComplete(url);
        }
      }, currentDelay);
    });
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
  );
};
