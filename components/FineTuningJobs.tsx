import React from 'react';
import { Activity, Play, Eye, Upload, Server } from 'lucide-react';
import { FineTuningJob, Dataset } from '../types';
import { Button } from './Button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FineTuningJobsProps {
  jobs: FineTuningJob[];
  activeJob: FineTuningJob | undefined;
  datasets: Dataset[];
  onNewJob: () => void;
  onDeploy: (job: FineTuningJob) => void;
  onTest: (modelName: string) => void;
  onViewDataset: (dataset: Dataset) => void;
  onSwitchToDataLab: () => void;
}

export const FineTuningJobs: React.FC<FineTuningJobsProps> = ({
  jobs, activeJob, datasets, onNewJob, onDeploy, onTest, onViewDataset, onSwitchToDataLab
}) => {
  
  // Mock Chart Data for Active Job
  const CHART_DATA = activeJob ? Array.from({length: 20}, (_, i) => ({
      step: i * 50,
      loss: Math.max(0.1, activeJob.loss + (Math.random() * 0.5 - 0.25) * (1 - i/20)),
      accuracy: Math.min(0.99, activeJob.accuracy - (Math.random() * 0.1 - 0.05) * (1 - i/20))
  })) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Panel: Active Job & History */}
        <div className="lg:col-span-2 space-y-8">
            {/* Active Training Visualization */}
            {activeJob ? (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg animate-in fade-in">
                  <div className="flex items-center gap-3 mb-4 text-blue-400">
                    <Activity size={20} className="animate-pulse" />
                    <h3 className="font-semibold text-white">Active Training: {activeJob.modelName}</h3>
                    <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-0.5 rounded border border-blue-800">Step 850/1000</span>
                  </div>
                  <div className="h-64 min-h-[192px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={CHART_DATA}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="step" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', fontSize: '12px' }} 
                          />
                          <Line type="monotone" dataKey="loss" stroke="#f87171" strokeWidth={2} dot={false} activeDot={{r:4}} />
                          <Line type="monotone" dataKey="accuracy" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{r:4}} />
                        </LineChart>
                     </ResponsiveContainer>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-4 px-2">
                     <div className="flex gap-4">
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> Loss: {activeJob.loss}</span>
                         <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400"></div> Accuracy: {((activeJob.accuracy || 0) * 100).toFixed(1)}%</span>
                     </div>
                     <span className="font-mono">Time Remaining: ~12m</span>
                  </div>
                </div>
            ) : (
                <div className="bg-gray-800/50 rounded-xl p-8 border border-gray-700 border-dashed flex flex-col items-center justify-center text-gray-500 h-64">
                    <Activity size={48} className="mb-4 opacity-20"/>
                    <p className="text-sm font-medium">No active training jobs.</p>
                    <Button size="sm" className="mt-4" onClick={onNewJob}>Start New Job</Button>
                </div>
            )}

            {/* Job History Table */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                    <h3 className="font-bold text-gray-300 text-sm">Training History</h3>
                </div>
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-gray-800/50 text-xs uppercase font-medium text-gray-500">
                        <tr>
                            <th className="px-6 py-3">Model Name</th>
                            <th className="px-6 py-3">Base</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {jobs.map(job => (
                            <tr key={job.id} className="hover:bg-gray-800/30 transition-colors group">
                                <td className="px-6 py-4 font-medium text-white">{job.modelName}</td>
                                <td className="px-6 py-4">{job.baseModel}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        job.status === 'completed' ? 'bg-green-900/30 text-green-400' : 
                                        job.status === 'failed' ? 'bg-red-900/30 text-red-400' : 
                                        'bg-blue-900/30 text-blue-400'
                                    }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            job.status === 'completed' ? 'bg-green-400' : 
                                            job.status === 'failed' ? 'bg-red-400' : 
                                            'bg-blue-400 animate-pulse'
                                        }`}></span>
                                        {job.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {job.status === 'completed' && (
                                            <>
                                                <button onClick={() => onTest(job.modelName)} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Test in Playground"><Play size={14}/></button>
                                                <button onClick={() => onDeploy(job)} className="p-1.5 hover:bg-gray-700 rounded text-gray-300" title="Deploy API"><Server size={14}/></button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Sidebar: Datasets & Quick Actions */}
        <div className="space-y-6">
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h3 className="font-bold text-white text-sm mb-4">Dataset Library</h3>
                <div className="space-y-3">
                    {datasets.map(ds => (
                        <div key={ds.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-600 transition-colors group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 bg-gray-800 rounded text-purple-400"><Upload size={16}/></div>
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-gray-200 truncate">{ds.name}</div>
                                    <div className="text-[10px] text-gray-500">{ds.size} • {ds.format}</div>
                                </div>
                            </div>
                            <button onClick={() => onViewDataset(ds)} className="p-1.5 hover:bg-gray-800 rounded text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye size={14}/>
                            </button>
                        </div>
                    ))}
                </div>
                <Button variant="secondary" className="w-full mt-4 text-xs" onClick={onSwitchToDataLab}>
                    Open Data Lab
                </Button>
            </div>

            <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-5">
                <h3 className="font-bold text-blue-100 text-sm mb-2">Unsloth Optimization</h3>
                <p className="text-xs text-blue-300/80 leading-relaxed mb-4">
                    Training is accelerated using Unsloth quantization. Models export to GGUF automatically.
                </p>
                <div className="flex gap-2 text-[10px] text-blue-400 font-mono">
                    <span className="bg-blue-900/40 px-2 py-1 rounded">Flash Attention 2</span>
                    <span className="bg-blue-900/40 px-2 py-1 rounded">4-bit</span>
                </div>
            </div>
        </div>
    </div>
  );
};
