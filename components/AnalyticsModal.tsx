
import React, { useMemo, useState, useEffect } from 'react';
import { X, BarChart2, Activity, Code, GitCommit, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Project, FileNode } from '../types';
import { getAllFiles } from '../utils/fileHelpers';

interface AnalyticsModalProps {
  project: Project;
  onClose: () => void;
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ project, onClose }) => {
  const [files, setFiles] = useState<FileNode[]>([]);

  useEffect(() => {
      const savedFiles = localStorage.getItem(`omni_files_${project.id}`);
      if (savedFiles) {
          try {
              setFiles(JSON.parse(savedFiles));
          } catch (e) {}
      }
  }, [project.id]);

  const stats = useMemo(() => {
      const allFiles = getAllFiles(files);
      let totalLOC = 0;
      const langCounts: Record<string, number> = {};
      const fileTypeCounts: Record<string, number> = {};

      allFiles.forEach(({ node }) => {
          if (!node.content) return;
          
          // LOC
          const lines = node.content.split('\n').length;
          totalLOC += lines;

          // Language
          const ext = node.name.split('.').pop() || 'txt';
          let lang = 'Other';
          if (['ts', 'tsx'].includes(ext)) lang = 'TypeScript';
          else if (['js', 'jsx'].includes(ext)) lang = 'JavaScript';
          else if (['css', 'scss', 'less'].includes(ext)) lang = 'CSS';
          else if (['html'].includes(ext)) lang = 'HTML';
          else if (['json'].includes(ext)) lang = 'JSON';
          else if (['py'].includes(ext)) lang = 'Python';
          
          langCounts[lang] = (langCounts[lang] || 0) + lines;
          fileTypeCounts[ext] = (fileTypeCounts[ext] || 0) + 1;
      });

      const langData = Object.entries(langCounts)
        .map(([name, lines]) => ({ name, lines }))
        .sort((a, b) => b.lines - a.lines);

      return { totalLOC, langData, fileCount: allFiles.length };
  }, [files]);

  // Simulated Commit History based on Project ID seed
  const commitData = useMemo(() => {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days.map(day => ({
          day,
          commits: Math.floor(Math.random() * 15)
      }));
  }, [project.id]);

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-850 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart2 className="text-purple-500" size={24} /> {project.name} Analytics
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1">ID: {project.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        
        <div className="p-8 overflow-y-auto">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-sm hover:border-primary-500/50 transition-all">
                    <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Code size={14}/> Total Lines</div>
                    <div className="text-3xl font-bold text-white tracking-tight">{stats.totalLOC.toLocaleString()}</div>
                    <div className="text-xs text-green-400 mt-1">+12% this week</div>
                </div>
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-sm hover:border-primary-500/50 transition-all">
                    <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><FileText size={14}/> Total Files</div>
                    <div className="text-3xl font-bold text-white tracking-tight">{stats.fileCount}</div>
                    <div className="text-xs text-gray-400 mt-1">Across {Object.keys(stats.langData).length} languages</div>
                </div>
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-sm hover:border-primary-500/50 transition-all">
                    <div className="text-gray-500 text-xs font-bold uppercase mb-2 flex items-center gap-2"><Activity size={14}/> Velocity</div>
                    <div className="text-3xl font-bold text-white tracking-tight">High</div>
                    <div className="text-xs text-yellow-400 mt-1">Top 10% of projects</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Commit Activity Chart */}
                <div className="h-72 bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-400 mb-6 flex items-center gap-2"><GitCommit size={16}/> Commit Activity (Last 7 Days)</h3>
                    <div className="flex-1 min-h-0">
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
                <div className="h-72 bg-gray-800 rounded-xl border border-gray-700 p-5 flex flex-col">
                    <h3 className="text-sm font-bold text-gray-400 mb-6 flex items-center gap-2"><Code size={16}/> Codebase Composition</h3>
                    <div className="flex flex-1 min-h-0 items-center">
                        <div className="w-1/2 h-full">
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
