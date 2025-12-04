
import React, { useEffect, useState } from 'react';
import { Bot, Shield, Zap, AlertCircle, Terminal, Activity, FileCode, CheckCircle2 } from 'lucide-react';
import { AgentTask, AIAgent } from '../types';

interface AgentHUDProps {
  task: AgentTask | null;
  agent: AIAgent | null;
}

export const AgentHUD: React.FC<AgentHUDProps> = ({ task, agent }) => {
  const [visible, setVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState('');
  const [bars, setBars] = useState<number[]>(Array(12).fill(10));

  useEffect(() => {
    if (task && task.status === 'running') {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [task]);

  useEffect(() => {
    if (task && task.logs.length > 0) {
      setCurrentLog(task.logs[task.logs.length - 1]);
    }
  }, [task?.logs]);

  // Neural Activity Animation
  useEffect(() => {
    if (!visible || task?.status !== 'running') return;
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 24 + 4));
    }, 100);
    return () => clearInterval(interval);
  }, [visible, task?.status]);

  if (!visible || !agent || !task) return null;

  const getAgentColor = (role: string) => {
    if (role.includes('Manager')) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    if (role.includes('QA') || role.includes('Critic')) return 'text-red-400 bg-red-500/10 border-red-500/30';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
  };

  const colorClass = getAgentColor(agent.role);
  const isFinished = task.status === 'completed';

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none animate-in slide-in-from-top-4 fade-in duration-300">
      <div className={`
        backdrop-blur-xl bg-gray-900/90 border rounded-2xl shadow-2xl p-4 min-w-[400px] max-w-[600px]
        flex flex-col gap-3 transition-all duration-300 relative overflow-hidden
        ${isFinished ? 'border-green-500/50' : colorClass.split(' ')[2]}
      `}>
        {/* Progress Line */}
        <div className="absolute top-0 left-0 h-0.5 bg-gray-800 w-full">
            <div 
                className={`h-full transition-all duration-500 ${isFinished ? 'bg-green-500' : 'bg-primary-500'}`} 
                style={{ width: `${(task.processedFiles / (task.totalFiles || 1)) * 100}%` }}
            ></div>
        </div>

        <div className="flex items-center gap-4">
          {/* Avatar / Status Icon */}
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center shrink-0 relative
            ${isFinished ? 'bg-green-900/20 text-green-400' : colorClass}
          `}>
            {isFinished ? <CheckCircle2 size={24}/> : (
                <>
                    {agent.isManager ? <Shield size={24}/> : agent.role.includes('QA') ? <AlertCircle size={24}/> : <Bot size={24}/>}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                        <div className={`w-2.5 h-2.5 rounded-full ${isFinished ? 'bg-green-500' : 'bg-green-500 animate-pulse'}`}></div>
                    </div>
                </>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    {agent.name} 
                    <span className="text-[10px] font-normal text-gray-400 uppercase tracking-wider bg-black/30 px-2 py-0.5 rounded">{agent.role}</span>
                </h3>
                <span className="text-[10px] font-mono text-gray-500">{task.processedFiles}/{task.totalFiles}</span>
            </div>
            
            <div className="flex items-center gap-2">
                {task.status === 'running' && (
                    <div className="flex gap-0.5 h-3 items-end">
                        {bars.map((h, i) => (
                            <div key={i} className="w-1 bg-current opacity-60 rounded-t-sm transition-all duration-100" style={{ height: `${h}px`, color: isFinished ? '#22c55e' : 'currentColor' }}></div>
                        ))}
                    </div>
                )}
                <div className="text-xs text-gray-300 font-mono truncate w-full">
                    {isFinished ? 'Task completed successfully.' : currentLog || 'Initializing...'}
                </div>
            </div>
          </div>
        </div>

        {/* Current File Context */}
        {task.currentFile && !isFinished && (
            <div className="bg-black/40 rounded-lg p-2 flex items-center gap-2 text-[10px] text-gray-400 border border-white/5 font-mono">
                <FileCode size={12} className="text-blue-400"/>
                <span>Current Context:</span>
                <span className="text-blue-300">{task.currentFile}</span>
            </div>
        )}
      </div>
    </div>
  );
};
