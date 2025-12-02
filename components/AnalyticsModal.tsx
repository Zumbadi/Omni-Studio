import React from 'react';
import { X, GitCommit, Code, BarChart2 } from 'lucide-react';
import { Project } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsModalProps {
  project: Project;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ project, onClose }) => {
  
  // Mock Data
  const commitData = Array.from({length: 7}, (_, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      commits: Math.floor(Math.random() * 15) + 2
  }));

  const stats = {
      langData: [
          { name: 'TypeScript', lines: 4500 },
          { name: 'CSS', lines: 1200 },
          { name: 'JSON', lines: 800 },
          { name: 'Markdown', lines: 300 }
      ]
  };

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-850">
            <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <BarChart2 size={24} className="text-purple-500"/> Project Analytics
                </h3>
                <p className="text-sm text-gray-400 mt-1">{project.name} • {project.type}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white p-2 rounded hover:bg-gray-800 transition-colors"><X size={24}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Commit Activity Chart */}
                <div className="h-72 bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col min-w-0 min-h-[288px]">
                    <h3 className="text-sm font-bold text-gray-400 mb-6 flex items-center gap-2"><GitCommit size={16}/> Commit Activity (Last 7 Days)</h3>
                    <div className="flex-1 min-h-0 min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={commitData}>
                                <XAxis dataKey="day" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#111827', border: '1px solid #374151', color: '#fff', borderRadius: '8px'}} 
                                    itemStyle={{ color: '#8b5cf6' }}
                                />
                                <Line type="monotone" dataKey="commits" stroke="#8b5cf6" strokeWidth={3} dot={{fill:'#8b5cf6', r: 4}} activeDot={{r: 6}} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Language Breakdown Chart */}
                <div className="h-72 bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col min-w-0 min-h-[288px]">
                    <h3 className="text-sm font-bold text-gray-400 mb-6 flex items-center gap-2"><Code size={16}/> Codebase Composition</h3>
                    <div className="flex flex-1 min-h-0 items-center">
                        <div className="w-1/2 h-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={stats.langData} 
                                        innerRadius={40} 
                                        outerRadius={70} 
                                        paddingAngle={5} 
                                        dataKey="lines"
                                        stroke="none"
                                    >
                                        {stats.langData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{backgroundColor: '#111827', border: '1px solid #374151', color: '#fff', borderRadius: '8px'}} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-1/2 space-y-3 overflow-y-auto max-h-full pr-2">
                            {stats.langData.map((lang, i) => (
                                <div key={lang.name} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                        <span className="text-gray-300">{lang.name}</span>
                                    </div>
                                    <span className="font-mono text-gray-500">{lang.lines.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
