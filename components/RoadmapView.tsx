
import React from 'react';
import { Map, BrainCircuit, Loader2, Flag, Check, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { ProjectPhase } from '../types';

interface RoadmapViewProps {
  roadmap: ProjectPhase[];
  isGenerating: boolean;
  onGenerate: () => void;
  onExecutePhase: (phase: ProjectPhase) => void;
  onToggleTask: (phaseId: string, taskId: string) => void;
}

export const RoadmapView: React.FC<RoadmapViewProps> = ({ roadmap, isGenerating, onGenerate, onExecutePhase, onToggleTask }) => {
  return (
    <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><Map size={18} className="text-primary-500"/> Project Roadmap</h2>
            <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 size={14} className="animate-spin mr-2"/> : <BrainCircuit size={14} className="mr-2"/>} 
                {isGenerating ? 'Thinking...' : 'Generate Plan'}
            </Button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto">
            {roadmap.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                    <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-2">
                        <Map size={40} className="text-gray-600"/>
                    </div>
                    <p className="text-sm font-medium">No active roadmap.</p>
                    <p className="text-xs opacity-60 max-w-xs text-center">Click generate to have Omni-Studio create a phased execution plan for your project.</p>
                </div>
            ) : (
                <div className="space-y-6 max-w-3xl mx-auto">
                    {roadmap.map((phase, i) => (
                        <div key={phase.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5 shadow-lg hover:border-gray-600 transition-colors relative overflow-hidden group">
                            {/* Progress Bar Background */}
                            <div className="absolute top-0 left-0 h-1 bg-gray-700 w-full">
                                <div 
                                    className={`h-full transition-all duration-500 ${phase.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`} 
                                    style={{ width: `${(phase.tasks.filter(t => t.done).length / phase.tasks.length) * 100}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-200 text-base">{phase.title}</h3>
                                    <span className="text-[10px] text-gray-500">Phase {i + 1}</span>
                                </div>
                                <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase font-bold border ${phase.status === 'completed' ? 'bg-green-900/30 text-green-400 border-green-800' : phase.status === 'active' ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-gray-700/30 text-gray-400 border-gray-600'}`}>
                                    {phase.status}
                                </span>
                            </div>

                            <div className="space-y-2 mb-5">
                                {phase.goals.map((g, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                                        <Flag size={12} className="text-yellow-500 shrink-0"/> {g}
                                    </div>
                                ))}
                            </div>

                            <div className="bg-black/20 rounded-lg p-1 mb-4 border border-gray-700/50">
                                {phase.tasks.map(task => (
                                    <div 
                                        key={task.id} 
                                        className="flex items-center gap-3 p-2 rounded hover:bg-gray-700/50 cursor-pointer transition-colors group/task" 
                                        onClick={() => onToggleTask(phase.id, task.id)}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-600 bg-gray-800 group-hover/task:border-gray-500'}`}>
                                            {task.done && <Check size={10} className="text-black font-bold"/>}
                                        </div>
                                        <span className={`text-xs ${task.done ? 'text-gray-500 line-through decoration-gray-600' : 'text-gray-300'}`}>{task.text}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end">
                                <Button size="sm" variant="secondary" onClick={() => onExecutePhase(phase)} className="text-xs group-hover:border-primary-500/50 group-hover:text-white transition-all">
                                    Execute with AI <ArrowRight size={12} className="ml-2 group-hover:translate-x-1 transition-transform"/>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};
