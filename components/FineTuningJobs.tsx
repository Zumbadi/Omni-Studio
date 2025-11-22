
import React from 'react';
import { Activity, Server, Database, Play, Rocket, FlaskConical, Eye } from 'lucide-react';
import { Button } from './Button';
import { FineTuningJob, Dataset } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CHART_DATA = [
  { step: 0, loss: 2.5, accuracy: 0.2 },
  { step: 10, loss: 2.1, accuracy: 0.35 },
  { step: 20, loss: 1.8, accuracy: 0.45 },
  { step: 30, loss: 1.2, accuracy: 0.65 },
  { step: 40, loss: 0.8, accuracy: 0.80 },
  { step: 50, loss: 0.6, accuracy: 0.88 },
  { step: 60, loss: 0.4, accuracy: 0.92 },
];

interface FineTuningJobsProps {
  jobs: FineTuningJob[];
  activeJob: FineTuningJob;
  datasets: Dataset[];
  onNewJob: () => void;
  onDeploy: (job: FineTuningJob) => void;
  onTest: (modelName: string) => void;
  onViewDataset: (ds: Dataset) => void;
  onSwitchToDataLab: () => void;
}

export const FineTuningJobs: React.FC<FineTuningJobsProps> = ({
  jobs, activeJob, datasets, onNewJob, onDeploy, onTest, onViewDataset, onSwitchToDataLab
}) => {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
          <div className="flex items-center gap-3 mb-4 text-blue-400">
            <Activity size={20} />
            <h3 className="font-semibold text-white">Active Training: {activeJob?.modelName || 'None'}</h3>
          </div>
          <div className="h-48">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={CHART_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="step" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} 
                  />
                  <Line type="monotone" dataKey="loss" stroke="#f87171" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="accuracy" stroke="#34d399" strokeWidth={2} dot={false} />
                </LineChart>
             </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
             <span className="text-red-300">Loss: {activeJob?.loss || 0}</span>
             <span className="text-green-300">Accuracy: {((activeJob?.accuracy || 0) * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
           <div className="flex items-center gap-3 mb-4 text-purple-400">
            <Server size={20} />
            <h3 className="font-semibold text-white">GPU Status</h3>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-750 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Worker 1 (A100-80G)</span>
                <span className="text-green-400">Active</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <div className="text-xs text-right mt-1 text-gray-500">68GB / 80GB VRAM</div>
            </div>
            <div className="bg-gray-750 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Worker 2 (T4)</span>
                <span className="text-gray-500">Idle</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-gray-600 h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="text-xs text-right mt-1 text-gray-500">0GB / 16GB VRAM</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg flex flex-col">
           <div className="flex items-center gap-3 mb-4 text-yellow-400">
            <Database size={20} />
            <h3 className="font-semibold text-white">Datasets</h3>
          </div>
          <ul className="space-y-3 flex-1 overflow-y-auto max-h-[160px]">
             {datasets.map((ds) => (
               <li key={ds.id} className="flex items-center justify-between text-sm p-2 hover:bg-gray-700 rounded cursor-pointer transition group">
                  <span className="text-gray-300 truncate max-w-[150px]" title={ds.name}>{ds.name}</span>
                  <button 
                    onClick={() => onViewDataset(ds)}
                    className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Preview Dataset"
                  >
                    <Eye size={14} />
                  </button>
               </li>
             ))}
          </ul>
          <Button variant="ghost" size="sm" onClick={onSwitchToDataLab} className="w-full mt-4 border border-dashed border-gray-600">
            <FlaskConical size={14} className="mr-2"/> Generate Synthetic Data
          </Button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850 flex justify-between items-center">
          <h3 className="font-semibold text-white">Recent Jobs</h3>
          <Button size="sm" onClick={onNewJob}>
            <Play size={14} className="mr-2" /> New Job
          </Button>
        </div>
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-900 text-xs uppercase font-medium text-gray-500">
            <tr>
              <th className="px-6 py-3">Job ID</th>
              <th className="px-6 py-3">Model Name</th>
              <th className="px-6 py-3">Base Model</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Progress</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-gray-500">{job.id}</td>
                <td className="px-6 py-4 font-medium text-white">{job.modelName}</td>
                <td className="px-6 py-4">{job.baseModel}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${job.status === 'completed' ? 'bg-green-900 text-green-300' : 
                      job.status === 'training' ? 'bg-blue-900 text-blue-300' : 
                      'bg-gray-700 text-gray-300'}`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="w-24 bg-gray-700 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`} 
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  {job.status === 'completed' && (
                    <button 
                      onClick={() => onDeploy(job)}
                      className="text-green-400 hover:text-white transition-colors p-1 bg-green-900/20 rounded border border-green-900/50 hover:bg-green-600 hover:border-green-500"
                      title="Deploy Model"
                    >
                      <Rocket size={14} />
                    </button>
                  )}
                  <button 
                    onClick={() => onTest(job.modelName)}
                    className="text-primary-400 hover:text-white transition-colors p-1 bg-primary-900/20 rounded border border-primary-900/50 hover:bg-primary-600 hover:border-primary-500"
                    title="Test in Playground"
                  >
                    <Play size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
