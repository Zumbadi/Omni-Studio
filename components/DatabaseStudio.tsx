
import React, { useState, useEffect, useRef } from 'react';
import { Database, Play, Wand2, Loader2, Table as TableIcon, Search, FileJson, Plus, Trash2, Key, Link as LinkIcon, Save, RefreshCw, X, ArrowRight, LayoutTemplate, MoreHorizontal, Code, Layers, BrainCircuit } from 'lucide-react';
import { Button } from './Button';
import { generateSQL, generateSyntheticData } from '../services/geminiService';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { FileNode } from '../types';
import { getAllFiles } from '../utils/fileHelpers';

interface DatabaseStudioProps {
  projectType: string;
  files?: FileNode[];
}

interface Column {
  id: string;
  name: string;
  type: string;
  isPk?: boolean;
  isFk?: boolean;
  fkTable?: string;
  nullable?: boolean;
}

interface TableDef {
  id: string;
  name: string;
  columns: Column[];
  x: number;
  y: number;
  rows: any[];
}

const DATA_TYPES = ['uuid', 'varchar', 'text', 'int', 'float', 'boolean', 'timestamp', 'jsonb'];

export const DatabaseStudio: React.FC<DatabaseStudioProps> = ({ projectType, files = [] }) => {
  const [dbView, setDbView] = useState<'data' | 'schema' | 'query' | 'vectors'>('schema');
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 5;');
  const [nlQuery, setNlQuery] = useState('');
  const [isGeneratingSQL, setIsGeneratingSQL] = useState(false);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [queryResult, setQueryResult] = useState<{ columns: string[], rows: any[] } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  
  // Initial Schema State
  const [tables, setTables] = useState<TableDef[]>([
      {
          id: 't1', name: 'users', x: 80, y: 80,
          columns: [
              { id: 'c1', name: 'id', type: 'uuid', isPk: true },
              { id: 'c2', name: 'email', type: 'varchar' },
              { id: 'c3', name: 'full_name', type: 'varchar' },
              { id: 'c4', name: 'role', type: 'text' },
              { id: 'c5', name: 'created_at', type: 'timestamp' }
          ],
          rows: [
              { id: '550e8400-e29b', email: 'alice@dev.co', full_name: 'Alice Dev', role: 'admin', created_at: '2023-10-01' },
              { id: '6ba7b810-9dad', email: 'bob@client.io', full_name: 'Bob Client', role: 'user', created_at: '2023-10-05' }
          ]
      },
      {
          id: 't2', name: 'posts', x: 420, y: 80,
          columns: [
              { id: 'c1', name: 'id', type: 'uuid', isPk: true },
              { id: 'c2', name: 'user_id', type: 'uuid', isFk: true, fkTable: 'users' },
              { id: 'c3', name: 'title', type: 'varchar' },
              { id: 'c4', name: 'content', type: 'text' },
              { id: 'c5', name: 'published', type: 'boolean' }
          ],
          rows: [
              { id: 'a1b2c3d4', user_id: '550e8400-e29b', title: 'Hello World', content: 'First post!', published: true },
              { id: 'e5f6g7h8', user_id: '6ba7b810-9dad', title: 'Help needed', content: 'How do I center a div?', published: true }
          ]
      }
  ]);

  const [activeTableId, setActiveTableId] = useState<string>(tables[0].id);
  const activeTable = tables.find(t => t.id === activeTableId) || tables[0];

  const [draggedTable, setDraggedTable] = useState<{id: string, offsetX: number, offsetY: number} | null>(null);
  
  // Vector Mock Data
  const [vectorData] = useState(() => Array.from({length: 30}, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: Math.random() * 1000,
      cluster: Math.floor(Math.random() * 3),
      text: `Chunk ${i}: Semantic embedding for knowledge base...`,
      id: i
  })));

  // Try to reverse engineer schema from files
  useEffect(() => {
      const allFiles = getAllFiles(files);
      const schemaFile = allFiles.find(f => f.node.name === 'schema.prisma' || f.node.name.endsWith('.sql'));
      
      if (schemaFile && schemaFile.node.content) {
          // Simple heuristic parser for demo purposes
          const content = schemaFile.node.content;
          if (content.includes('model')) {
              // Prisma-like
              const newTables: TableDef[] = [];
              const modelRegex = /model\s+(\w+)\s+{([^}]+)}/g;
              let match;
              let x = 80;
              while ((match = modelRegex.exec(content)) !== null) {
                  const tableName = match[1];
                  const body = match[2];
                  const columns: Column[] = [];
                  body.trim().split('\n').forEach((line, i) => {
                      const parts = line.trim().split(/\s+/);
                      if (parts.length >= 2) {
                          columns.push({
                              id: `c-${Date.now()}-${i}`,
                              name: parts[0],
                              type: parts[1],
                              isPk: line.includes('@id')
                          });
                      }
                  });
                  newTables.push({
                      id: `t-${Date.now()}`,
                      name: tableName.toLowerCase(),
                      columns,
                      x,
                      y: 80,
                      rows: []
                  });
                  x += 350;
              }
              if (newTables.length > 0) setTables(newTables);
          }
      }
  }, [files]);

  // --- SQL ENGINE SIMULATION ---
  const handleRunQuery = () => {
      setQueryError(null);
      setQueryResult(null);
      const query = sqlQuery.trim().replace(/;$/, ''); // remove trailing semicolon
      if(!query) return;
      
      setQueryHistory(prev => [query, ...prev].slice(0, 10));
      
      const lowerQuery = query.toLowerCase();

      try {
          // --- SELECT ---
          if (lowerQuery.startsWith('select')) {
              const fromMatch = lowerQuery.match(/from\s+(\w+)/);
              if (!fromMatch) throw new Error("Syntax Error: Missing FROM clause");
              
              const tableName = fromMatch[1];
              const table = tables.find(t => t.name.toLowerCase() === tableName);
              if (!table) throw new Error(`Relation '${tableName}' does not exist`);

              let results = [...table.rows];

              // WHERE
              if (lowerQuery.includes('where')) {
                  const wherePart = query.split(/where/i)[1].split(/limit|order/i)[0].trim();
                  // Simple parser for: col = val
                  const ops = ['!=', '>=', '<=', '=', '>', '<', 'like'];
                  const op = ops.find(o => wherePart.includes(o)) || '=';
                  const [col, val] = wherePart.split(op).map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                  
                  results = results.filter(r => {
                      const rowVal = String(r[col]).toLowerCase();
                      const checkVal = val.toLowerCase();
                      if (op === '=') return rowVal == checkVal;
                      if (op === '!=') return rowVal != checkVal;
                      if (op === '>') return parseFloat(rowVal) > parseFloat(checkVal);
                      if (op === '<') return parseFloat(rowVal) < parseFloat(checkVal);
                      if (op === 'like') return rowVal.includes(checkVal.replace(/%/g, ''));
                      return false;
                  });
              }

              // LIMIT
              if (lowerQuery.includes('limit')) {
                  const limitMatch = lowerQuery.match(/limit\s+(\d+)/);
                  if (limitMatch) {
                      results = results.slice(0, parseInt(limitMatch[1]));
                  }
              }

              setQueryResult({
                  columns: table.columns.map(c => c.name),
                  rows: results
              });
          } 
          // --- INSERT ---
          else if (lowerQuery.startsWith('insert into')) {
              const tableMatch = lowerQuery.match(/insert into\s+(\w+)/);
              if (!tableMatch) throw new Error("Syntax Error: Missing table name");
              
              const tableName = tableMatch[1];
              const tableIdx = tables.findIndex(t => t.name.toLowerCase() === tableName);
              if (tableIdx === -1) throw new Error(`Relation '${tableName}' does not exist`);

              const newRow: any = { id: crypto.randomUUID().split('-')[0] };
              
              // Extract columns if present
              let colNames: string[] = [];
              const colsMatch = query.match(/\(([\w,\s]+)\)\s*values/i);
              if (colsMatch) {
                  colNames = colsMatch[1].split(',').map(s => s.trim());
              } else {
                  // If no columns specified, assume all except implicit PK if auto-inc (simplified here to all)
                  colNames = tables[tableIdx].columns.map(c => c.name);
              }

              const valsMatch = query.match(/values\s*\((.+)\)/i);
              if (valsMatch) {
                  // Split by comma but respect quotes (simplified regex)
                  const values = valsMatch[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                  
                  if (colNames.length !== values.length) {
                      throw new Error(`INSERT has more expressions than target columns`);
                  }

                  colNames.forEach((col, i) => {
                      newRow[col] = values[i];
                  });

                  // Update Table State
                  const updatedTables = [...tables];
                  updatedTables[tableIdx] = {
                      ...updatedTables[tableIdx],
                      rows: [...updatedTables[tableIdx].rows, newRow]
                  };
                  setTables(updatedTables);
                  setQueryResult({ columns: ['result'], rows: [{ result: 'INSERT 0 1' }] });
              } else {
                  throw new Error("Syntax Error: Missing VALUES clause");
              }
          }
          // --- UPDATE ---
          else if (lowerQuery.startsWith('update')) {
              const tableMatch = lowerQuery.match(/update\s+(\w+)/);
              if (!tableMatch) throw new Error("Syntax Error: Missing table name");
              const tableName = tableMatch[1];
              
              const setMatch = query.match(/set\s+(.+?)(\s+where|$)/i);
              if (!setMatch) throw new Error("Syntax Error: Missing SET clause");
              
              const tableIdx = tables.findIndex(t => t.name.toLowerCase() === tableName);
              if (tableIdx === -1) throw new Error(`Relation '${tableName}' does not exist`);

              const setParts = setMatch[1].split(',').map(s => s.trim());
              const updates: Record<string, string> = {};
              setParts.forEach(part => {
                  const [col, val] = part.split('=').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                  updates[col] = val;
              });

              let updateCount = 0;
              const updatedRows = tables[tableIdx].rows.map(row => {
                  let match = true;
                  if (lowerQuery.includes('where')) {
                      const wherePart = query.split(/where/i)[1].trim();
                      const [col, val] = wherePart.split('=').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                      if (String(row[col]) !== val) match = false;
                  }
                  
                  if (match) {
                      updateCount++;
                      return { ...row, ...updates };
                  }
                  return row;
              });

              const updatedTables = [...tables];
              updatedTables[tableIdx] = { ...updatedTables[tableIdx], rows: updatedRows };
              setTables(updatedTables);
              setQueryResult({ columns: ['result'], rows: [{ result: `UPDATE ${updateCount}` }] });
          }
          // --- DELETE ---
          else if (lowerQuery.startsWith('delete')) {
              const fromMatch = lowerQuery.match(/from\s+(\w+)/);
              if (!fromMatch) throw new Error("Syntax Error");
              const tableName = fromMatch[1];
              
              const tableIdx = tables.findIndex(t => t.name.toLowerCase() === tableName);
              if (tableIdx === -1) throw new Error(`Relation '${tableName}' does not exist`);

              let deleteCount = 0;
              const remainingRows = tables[tableIdx].rows.filter(row => {
                  let match = true;
                  if (lowerQuery.includes('where')) {
                      const wherePart = query.split(/where/i)[1].trim();
                      const [col, val] = wherePart.split('=').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
                      if (String(row[col]) !== val) match = false;
                  } else {
                      // Delete all
                      match = true;
                  }
                  
                  if (match) deleteCount++;
                  return !match;
              });

              const updatedTables = [...tables];
              updatedTables[tableIdx] = { ...updatedTables[tableIdx], rows: remainingRows };
              setTables(updatedTables);
              setQueryResult({ columns: ['result'], rows: [{ result: `DELETE ${deleteCount}` }] });
          }
          else {
              throw new Error("Command not supported in simulation.");
          }
      } catch (e: any) {
          setQueryError(e.message);
      }
  };

  const handleGenerateSQL = async () => {
      if(!nlQuery) return;
      setIsGeneratingSQL(true);
      const schemaContext = tables.map(t => `${t.name}(${t.columns.map(c => c.name).join(', ')})`).join('\n');
      const generated = await generateSQL(nlQuery, schemaContext);
      setSqlQuery(generated.replace('```sql', '').replace('```', '').trim());
      setIsGeneratingSQL(false);
  };

  const handleGenerateSynthetic = async () => {
      if(!activeTableId) return;
      setIsGeneratingData(true);
      const table = tables.find(t => t.id === activeTableId);
      if(table) {
          await generateSyntheticData(`Rows for SQL table ${table.name}`, 5, () => {});
          // Simulate data arrival
          const newRows = Array.from({length: 5}, () => {
              const row: any = {};
              table.columns.forEach(c => {
                  if (c.name === 'id') row[c.name] = crypto.randomUUID().split('-')[0];
                  else if (c.type === 'int') row[c.name] = Math.floor(Math.random() * 100);
                  else if (c.type === 'boolean') row[c.name] = Math.random() > 0.5;
                  else if (c.name === 'email') row[c.name] = `user${Math.floor(Math.random()*1000)}@example.com`;
                  else row[c.name] = "Synthetic Data";
              });
              return row;
          });
          const updatedTables = tables.map(t => t.id === activeTableId ? { ...t, rows: [...t.rows, ...newRows] } : t);
          setTables(updatedTables);
      }
      setIsGeneratingData(false);
  };

  const handleDragStart = (e: React.MouseEvent, id: string) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setDraggedTable({
          id,
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top
      });
  };

  const handleDrag = (e: React.MouseEvent) => {
      if (draggedTable) {
          const container = e.currentTarget.getBoundingClientRect();
          const newX = e.clientX - container.left - draggedTable.offsetX;
          const newY = e.clientY - container.top - draggedTable.offsetY;
          
          setTables(prev => prev.map(t => t.id === draggedTable.id ? { ...t, x: newX, y: newY } : t));
      }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-950 h-full overflow-hidden">
        {/* Header */}
        <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-gray-200 flex items-center gap-2"><Database size={16} className="text-yellow-500"/> Database Studio</span>
                <div className="h-4 w-px bg-gray-700"></div>
                <div className="flex bg-gray-800 rounded p-0.5">
                    <button onClick={() => setDbView('schema')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${dbView === 'schema' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Schema</button>
                    <button onClick={() => setDbView('data')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${dbView === 'data' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Data</button>
                    <button onClick={() => setDbView('query')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${dbView === 'query' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>SQL Editor</button>
                    <button onClick={() => setDbView('vectors')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${dbView === 'vectors' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Vectors</button>
                </div>
            </div>
            <div className="text-xs text-gray-500">PostgreSQL (v15) • {tables.reduce((acc, t) => acc + t.rows.length, 0)} Rows</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5">
            {dbView === 'schema' && (
                <div className="w-full h-full relative cursor-grab active:cursor-grabbing overflow-auto" onMouseMove={handleDrag} onMouseUp={() => setDraggedTable(null)} onMouseLeave={() => setDraggedTable(null)}>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        {/* Render Relations Lines */}
                        {tables.map(t => (
                            t.columns.filter(c => c.isFk && c.fkTable).map((col, i) => {
                                const targetTable = tables.find(tbl => tbl.name === col.fkTable);
                                if (!targetTable) return null;
                                return (
                                    <line 
                                        key={`${t.id}-${col.id}`}
                                        x1={t.x + 200} y1={t.y + 40 + (i * 24)}
                                        x2={targetTable.x} y2={targetTable.y + 40}
                                        stroke="#4b5563" strokeWidth="2" strokeDasharray="4"
                                    />
                                );
                            })
                        ))}
                    </svg>
                    {tables.map(table => (
                        <div 
                            key={table.id}
                            onMouseDown={(e) => handleDragStart(e, table.id)}
                            className="absolute w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-10"
                            style={{ left: table.x, top: table.y }}
                        >
                            <div className="bg-gray-700 px-3 py-2 border-b border-gray-600 flex justify-between items-center cursor-move">
                                <span className="font-bold text-xs text-white">{table.name}</span>
                                <MoreHorizontal size={14} className="text-gray-400"/>
                            </div>
                            <div className="p-2 space-y-1">
                                {table.columns.map(col => (
                                    <div key={col.id} className="flex justify-between text-[10px] text-gray-300 px-1 py-0.5 hover:bg-gray-700/50 rounded">
                                        <div className="flex items-center gap-1">
                                            {col.isPk && <Key size={10} className="text-yellow-500"/>}
                                            {col.isFk && <LinkIcon size={10} className="text-blue-400"/>}
                                            <span className={col.isPk ? 'font-bold' : ''}>{col.name}</span>
                                        </div>
                                        <span className="text-gray-500 font-mono">{col.type}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {dbView === 'data' && (
                <div className="flex h-full">
                    <div className="w-48 bg-gray-900 border-r border-gray-800 p-3 space-y-2">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2 px-2">Tables</div>
                        {tables.map(t => (
                            <button 
                                key={t.id}
                                onClick={() => setActiveTableId(t.id)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${activeTableId === t.id ? 'bg-primary-900/30 text-primary-400 border border-primary-500/30' : 'text-gray-400 hover:bg-gray-800'}`}
                            >
                                <TableIcon size={14}/> {t.name} <span className="ml-auto opacity-50">{t.rows.length}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-850">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2"><TableIcon size={14}/> {activeTable.name}</h3>
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={handleGenerateSynthetic} disabled={isGeneratingData}>
                                    {isGeneratingData ? <Loader2 size={12} className="animate-spin mr-2"/> : <Wand2 size={12} className="mr-2"/>} Generate Data
                                </Button>
                                <Button size="sm"><Plus size={12} className="mr-2"/> Add Row</Button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-900 text-xs uppercase text-gray-500 sticky top-0 z-10">
                                    <tr>
                                        {activeTable.columns.map(c => (
                                            <th key={c.id} className="px-4 py-3 border-b border-gray-800 font-medium whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    {c.name}
                                                    {c.isPk && <Key size={10} className="text-yellow-500"/>}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="text-xs text-gray-300 divide-y divide-gray-800">
                                    {activeTable.rows.map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-800/50">
                                            {activeTable.columns.map(c => (
                                                <td key={c.id} className="px-4 py-2 whitespace-nowrap font-mono text-gray-400">{String(row[c.name])}</td>
                                            ))}
                                        </tr>
                                    ))}
                                    {activeTable.rows.length === 0 && (
                                        <tr><td colSpan={activeTable.columns.length} className="px-4 py-8 text-center text-gray-600">Table is empty</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {dbView === 'query' && (
                <div className="flex h-full flex-col p-4 gap-4">
                    <div className="flex gap-4 h-1/2">
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
                                    placeholder="Ask AI to write SQL..."
                                    value={nlQuery}
                                    onChange={(e) => setNlQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGenerateSQL()}
                                />
                                <Button size="sm" variant="secondary" onClick={handleGenerateSQL} disabled={isGeneratingSQL}>
                                    {isGeneratingSQL ? <Loader2 size={14} className="animate-spin"/> : <Wand2 size={14}/>} AI
                                </Button>
                            </div>
                            <div className="flex-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden relative">
                                <textarea 
                                    className="w-full h-full bg-transparent p-4 text-sm font-mono text-blue-300 focus:outline-none resize-none"
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    spellCheck={false}
                                />
                                <button 
                                    onClick={handleRunQuery}
                                    className="absolute bottom-4 right-4 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-bold text-xs transition-colors"
                                >
                                    <Play size={14}/> Run
                                </button>
                            </div>
                        </div>
                        <div className="w-64 bg-gray-900 border border-gray-700 rounded-xl p-3 flex flex-col">
                            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Query History</h3>
                            <div className="flex-1 overflow-y-auto space-y-2">
                                {queryHistory.map((q, i) => (
                                    <div key={i} onClick={() => setSqlQuery(q)} className="text-[10px] p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 truncate font-mono text-gray-400">
                                        {q}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 bg-black border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                        <div className="px-4 py-2 bg-gray-900 border-b border-gray-800 text-xs font-bold text-gray-400 uppercase">Results</div>
                        <div className="flex-1 overflow-auto p-4">
                            {queryError ? (
                                <div className="text-red-400 font-mono text-sm">{queryError}</div>
                            ) : queryResult ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="text-xs uppercase text-gray-500 border-b border-gray-800">
                                        <tr>{queryResult.columns.map(c => <th key={c} className="px-4 py-2">{c}</th>)}</tr>
                                    </thead>
                                    <tbody className="text-xs text-gray-300 divide-y divide-gray-800">
                                        {queryResult.rows.map((row, i) => (
                                            <tr key={i}>
                                                {queryResult.columns.map(c => <td key={c} className="px-4 py-2 font-mono">{String(row[c])}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-gray-600 text-sm flex flex-col items-center justify-center h-full">
                                    <Code size={32} className="mb-2 opacity-50"/>
                                    Run a query to see results
                                </div>
                            )}
                        </div>
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
                    <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl relative overflow-hidden">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis type="number" dataKey="x" name="Dimension 1" stroke="#9ca3af" fontSize={10} />
                                <YAxis type="number" dataKey="y" name="Dimension 2" stroke="#9ca3af" fontSize={10} />
                                <ZAxis type="number" dataKey="z" range={[50, 400]} />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }} />
                                <Scatter name="Embeddings" data={vectorData} fill="#8884d8">
                                    {vectorData.map((entry, index) => (
                                        <cell key={`cell-${index}`} fill={entry.cluster === 0 ? '#3b82f6' : entry.cluster === 1 ? '#10b981' : '#ef4444'} />
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