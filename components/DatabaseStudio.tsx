import React, { useState } from 'react';
import { Database, Table, BrainCircuit, Search, Plus, Filter, RefreshCw, Key } from 'lucide-react';
import { FileNode, ProjectType } from '../types';
import { Button } from './Button';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DatabaseStudioProps {
  projectType: ProjectType;
  files: FileNode[];
}

export const DatabaseStudio: React.FC<DatabaseStudioProps> = ({ projectType, files }) => {
  const [dbView, setDbView] = useState<'schema' | 'data' | 'vectors'>('schema');
  
  // Mock Vector Data
  const vectorData = Array.from({length: 30}, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 500,
      cluster: Math.floor(Math.random() * 3)
  }));

  // Mock Schema derived from files (simulation)
  const schema = [
      { name: 'users', columns: ['id', 'email', 'password_hash', 'created_at'] },
      { name: 'posts', columns: ['id', 'user_id', 'title', 'content', 'published'] },
      { name: 'comments', columns: ['id', 'post_id', 'user_id', 'body'] }
  ];

  return (
    <div className="flex flex-col h-full bg-gray-950">
        <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Database size={16} className="text-purple-500"/> Database Studio</h2>
                <div className="flex bg-gray-800 rounded p-0.5">
                    <button onClick={() => setDbView('schema')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${dbView === 'schema' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Schema</button>
                    <button onClick={() => setDbView('data')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${dbView === 'data' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Data Explorer</button>
                    <button onClick={() => setDbView('vectors')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${dbView === 'vectors' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>Vector Store</button>
                </div>
            </div>
            <div className="flex gap-2">
                <Button size="sm" variant="ghost" title="Refresh"><RefreshCw size={14}/></Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-500"><Plus size={14} className="mr-1"/> New Table</Button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            {dbView === 'schema' && (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {schema.map((table) => (
                        <div key={table.name} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
                            <div className="bg-gray-900/50 p-3 border-b border-gray-700 flex justify-between items-center">
                                <span className="font-bold text-white text-sm flex items-center gap-2"><Table size={14} className="text-gray-400"/> {table.name}</span>
                                <span className="text-xs text-gray-500">{table.columns.length} cols</span>
                            </div>
                            <div className="p-3 space-y-2">
                                {table.columns.map(col => (
                                    <div key={col} className="flex items-center justify-between text-xs text-gray-300">
                                        <span className="flex items-center gap-2">
                                            {col === 'id' ? <Key size={10} className="text-yellow-500"/> : <span className="w-2.5 h-2.5 rounded-full bg-gray-600"></span>}
                                            {col}
                                        </span>
                                        <span className="text-gray-600 font-mono">
                                            {col.includes('id') ? 'UUID' : col.includes('at') ? 'TIMESTAMP' : 'VARCHAR'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {dbView === 'data' && (
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-gray-800 flex gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                            <input type="text" placeholder="SQL Query or Search..." className="w-full bg-black/30 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:border-purple-500 outline-none font-mono"/>
                        </div>
                        <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-white px-3 py-2 bg-gray-800 rounded"><Filter size={14}/> Filter</button>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                        Select a table to view data.
                    </div>
                </div>
            )}

            {dbView === 'vectors' && (
                <div className="flex-1 flex flex-col p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2"><BrainCircuit size={20} className="text-purple-500"/> Vector Embeddings</h2>
                        <div className="flex gap-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> Cluster A</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Cluster B</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Cluster C</span>
                        </div>
                    </div>
                    <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl relative overflow-hidden min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" dataKey="x" name="Dimension 1" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis type="number" dataKey="y" name="Dimension 2" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                                <ZAxis type="number" dataKey="z" range={[50, 400]} />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} />
                                <Scatter name="Embeddings" data={vectorData} fill="#8884d8">
                                    {vectorData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.cluster === 0 ? '#3b82f6' : entry.cluster === 1 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 p-4 bg-gray-800 border border-gray-700 rounded-xl text-xs text-gray-400">
                        <p><strong>RAG Context:</strong> Visualizing 30 document chunks embedded via `text-embedding-004`. Clusters represent semantic similarity.</p>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
