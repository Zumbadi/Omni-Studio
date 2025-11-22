
import React, { useState } from 'react';
import { Database, Play, Wand2, Loader2, Table, Search } from 'lucide-react';
import { Button } from './Button';
import { generateSQL } from '../services/geminiService';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DatabaseStudioProps {
  projectType: string;
}

export const DatabaseStudio: React.FC<DatabaseStudioProps> = ({ projectType }) => {
  const [dbView, setDbView] = useState<'data' | 'schema' | 'query' | 'vectors'>('data');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [nlQuery, setNlQuery] = useState('');
  const [isGeneratingSQL, setIsGeneratingSQL] = useState(false);
  const [dbResults, setDbResults] = useState<any[]>([
     { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', created_at: '2023-10-12' },
     { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user', created_at: '2023-10-14' },
     { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user', created_at: '2023-10-15' }
  ]);
  
  const [vectorData] = useState(() => Array.from({length: 30}, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 50 + 10,
      text: `Chunk ${i}: Semantic embedding for knowledge base...`,
      id: i
  })));

  const handleRunQuery = () => {
      if (sqlQuery.toLowerCase().includes('users')) setDbResults(prev => [...prev]);
  };

  const handleGenerateSQL = async () => {
      if(!nlQuery.trim()) return;
      setIsGeneratingSQL(true);
      const schemaContext = `
        Table users: id (uuid), email (varchar), name (varchar), role (text)
        Table posts: id (uuid), user_id (uuid), title (varchar), content (text)
      `;
      const sql = await generateSQL(nlQuery, schemaContext);
      const cleanSQL = sql.replace(/```sql/g, '').replace(/```/g, '').trim();
      setSqlQuery(cleanSQL);
      setIsGeneratingSQL(false);
  };

  const SchemaView = () => (
      <div className="flex-1 bg-gray-900 p-6 relative overflow-auto">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_1px_1px,#333_1px,transparent_0)] bg-[size:20px_20px] opacity-50 pointer-events-none"></div>
          <div className="flex flex-wrap gap-12 relative z-10">
              <div className="w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg">
                  <div className="px-3 py-2 bg-gray-700 border-b border-gray-600 font-bold text-xs text-white flex items-center gap-2"><Table size={12} /> users</div>
                  <div className="p-2 space-y-1">
                      <div className="text-xs text-yellow-400 font-mono flex justify-between">id <span>PK uuid</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">email <span>varchar</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">name <span>varchar</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">role <span>text</span></div>
                  </div>
              </div>
              <div className="w-48 bg-gray-800 border border-gray-600 rounded-lg shadow-lg mt-12">
                  <div className="px-3 py-2 bg-gray-700 border-b border-gray-600 font-bold text-xs text-white flex items-center gap-2"><Table size={12} /> posts</div>
                  <div className="p-2 space-y-1">
                      <div className="text-xs text-yellow-400 font-mono flex justify-between">id <span>PK uuid</span></div>
                      <div className="text-xs text-blue-400 font-mono flex justify-between">user_id <span>FK uuid</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">title <span>varchar</span></div>
                      <div className="text-xs text-gray-300 font-mono flex justify-between">content <span>text</span></div>
                  </div>
              </div>
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
                  <path d="M 192 60 C 220 60, 220 180, 248 180" fill="none" stroke="#4b5563" strokeWidth="2" strokeDasharray="4" />
              </svg>
          </div>
      </div>
  );

  const VectorView = () => (
      <div className="flex-1 flex flex-col bg-gray-900">
          <div className="p-4 border-b border-gray-800 flex gap-2 items-center">
              <Search size={16} className="text-gray-500"/>
              <input 
                type="text" 
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary-500 flex-1"
                placeholder="Semantic search query..."
              />
              <Button size="sm" variant="secondary">Search</Button>
          </div>
          <div className="flex-1 p-4 relative min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <XAxis type="number" dataKey="x" name="dim1" hide />
                      <YAxis type="number" dataKey="y" name="dim2" hide />
                      <ZAxis type="number" dataKey="z" range={[60, 400]} name="score" />
                      <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                          if (payload && payload.length) {
                              return (
                                  <div className="bg-gray-800 border border-gray-700 p-2 rounded shadow-lg text-xs max-w-[200px]">
                                      <p className="text-white font-semibold mb-1">Vector #{payload[0].payload.id}</p>
                                      <p className="text-gray-400">{payload[0].payload.text}</p>
                                  </div>
                              );
                          }
                          return null;
                      }} />
                      <Scatter name="Vectors" data={vectorData} fill="#6366f1" shape="circle" />
                  </ScatterChart>
              </ResponsiveContainer>
          </div>
      </div>
  );

  return (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-200"><Database size={16} className="text-yellow-500" /> Postgres Explorer</div>
              <div className="flex bg-gray-800 rounded p-0.5 overflow-x-auto w-full md:w-auto">
                  <button onClick={() => setDbView('data')} className={`px-3 py-1 text-xs rounded whitespace-nowrap ${dbView === 'data' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Data</button>
                  <button onClick={() => setDbView('schema')} className={`px-3 py-1 text-xs rounded whitespace-nowrap ${dbView === 'schema' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Schema</button>
                  <button onClick={() => setDbView('query')} className={`px-3 py-1 text-xs rounded whitespace-nowrap ${dbView === 'query' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>SQL</button>
                  <button onClick={() => setDbView('vectors')} className={`px-3 py-1 text-xs rounded whitespace-nowrap ${dbView === 'vectors' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}>Vectors</button>
              </div>
              <Button size="sm" variant="secondary" onClick={() => alert("Connected to Neon DB")}>Connect</Button>
          </div>
          
          {dbView === 'schema' ? <SchemaView /> : dbView === 'vectors' ? <VectorView /> : (
              <div className="flex-1 p-4 flex flex-col md:flex-row gap-4 overflow-hidden">
                  <div className="w-full md:w-48 bg-gray-800 border border-gray-700 rounded-lg p-2 flex flex-col shrink-0 h-48 md:h-full"><div className="text-xs font-bold text-gray-500 uppercase mb-2 px-2">Tables</div><div className="space-y-1 overflow-y-auto"><div className="px-2 py-1 bg-primary-900/30 text-primary-300 rounded text-sm cursor-pointer">public.users</div><div className="px-2 py-1 hover:bg-gray-700 text-gray-400 rounded text-sm cursor-pointer">public.posts</div><div className="px-2 py-1 hover:bg-gray-700 text-gray-400 rounded text-sm cursor-pointer">auth.sessions</div></div></div>
                  <div className="flex-1 flex flex-col min-w-0">
                      {dbView === 'query' && (
                          <div className="mb-2 flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
                              <div className="flex-1 flex items-center gap-2 px-2">
                                  <Wand2 size={14} className="text-purple-400" />
                                  <input 
                                    type="text" 
                                    className="bg-transparent text-xs text-white w-full focus:outline-none py-1" 
                                    placeholder="Ask AI to write SQL (e.g., 'Select all users created yesterday')" 
                                    value={nlQuery}
                                    onChange={(e) => setNlQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateSQL()}
                                  />
                              </div>
                              <button onClick={handleGenerateSQL} disabled={isGeneratingSQL} className="bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-[10px] px-2 py-1 rounded border border-purple-800/50">
                                  {isGeneratingSQL ? <Loader2 size={10} className="animate-spin"/> : 'Generate'}
                              </button>
                          </div>
                      )}
                      <div className="bg-black border border-gray-700 rounded-t-lg p-2 flex gap-2 shrink-0"><textarea className="w-full bg-transparent text-green-400 font-mono text-sm focus:outline-none resize-none h-20" value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} /><button onClick={handleRunQuery} className="self-start bg-primary-600 hover:bg-primary-500 text-white p-2 rounded"><Play size={14}/></button></div>
                      <div className="flex-1 bg-gray-800 border-x border-b border-gray-700 rounded-b-lg overflow-auto"><table className="w-full text-left text-xs text-gray-300 whitespace-nowrap"><thead className="bg-gray-900 font-bold text-gray-500 sticky top-0"><tr>{Object.keys(dbResults[0] || {}).map(k => <th key={k} className="px-4 py-2 border-b border-gray-700">{k}</th>)}</tr></thead><tbody className="divide-y divide-gray-700 font-mono">{dbResults.map((row, i) => (<tr key={i} className="hover:bg-gray-750">{Object.values(row).map((val: any, j) => <td key={j} className="px-4 py-2">{val}</td>)}</tr>))}</tbody></table></div>
                  </div>
              </div>
          )}
      </div>
  );
};
