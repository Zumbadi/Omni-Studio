import React, { useState, useEffect } from 'react';
import { Gauge, Loader2, Zap, Check, Share2 } from 'lucide-react';
import { Button } from './Button';
import { PerformanceReport, FileNode } from '../types';
import { generatePerformanceReport } from '../services/geminiService';
import { analyzeDependencies, DepNode } from '../utils/projectAnalysis';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface AuditViewProps {
  files: FileNode[];
}

export const AuditView: React.FC<AuditViewProps> = ({ files }) => {
  const [auditReport, setAuditReport] = useState<PerformanceReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [depGraph, setDepGraph] = useState<DepNode[]>([]);

  useEffect(() => {
      setDepGraph(analyzeDependencies(files));
  }, [files]);

  const handleRunAudit = async () => {
      setIsAuditing(true);
      // Generate simple file structure string
      const getStruct = (nodes: FileNode[], depth=0) => nodes.map(n => '  '.repeat(depth) + n.name).join('\n');
      const struct = getStruct(files);
      
      const report = await generatePerformanceReport(struct);
      setAuditReport(report);
      setIsAuditing(false);
  };

  const ScoreRing = ({ label, score, color }: { label: string, score: number, color: string }) => {
      const data = [{ value: score }, { value: 100 - score }];
      return (
          <div className="flex flex-col items-center">
              <div className="w-20 h-20 relative mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie data={data} cx="50%" cy="50%" innerRadius={25} outerRadius={35} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                              <Cell fill={color} />
                              <Cell fill="#374151" />
                          </Pie>
                      </PieChart>
                  </ResponsiveContainer>
                  <div className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${score >= 90 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {score}
                  </div>
              </div>
              <span className="text-xs font-medium text-gray-400">{label}</span>
          </div>
      );
  };

  const DependencyGraph = () => {
      const level0 = depGraph.filter(n => n.level === 0);
      const level1 = depGraph.filter(n => n.level === 1);
      const level2 = depGraph.filter(n => n.level === 2);
      
      return (
          <div className="bg-black/30 rounded-xl border border-gray-800 h-80 relative overflow-hidden flex items-center justify-center p-4">
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <circle cx="50%" cy="50%" r="100" stroke="#374151" strokeWidth="1" fill="none" strokeDasharray="4"/>
                  <line x1="50%" y1="20%" x2="20%" y2="50%" stroke="#374151" opacity="0.5"/>
                  <line x1="50%" y1="20%" x2="80%" y2="50%" stroke="#374151" opacity="0.5"/>
                  <line x1="20%" y1="50%" x2="50%" y2="80%" stroke="#374151" opacity="0.5"/>
                  <line x1="80%" y1="50%" x2="50%" y2="80%" stroke="#374151" opacity="0.5"/>
              </svg>

              <div className="relative z-10 flex flex-col h-full w-full justify-between py-8">
                  <div className="flex justify-center gap-4">
                      {level0.map(n => (
                          <div key={n.id} className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-4 border-gray-900 shadow-xl z-20" title={n.name}>
                              {n.name.replace(/\..*/, '')}
                          </div>
                      ))}
                  </div>
                  <div className="flex justify-around w-full px-12">
                      {level1.slice(0, 4).map(n => (
                          <div key={n.id} className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-[9px] font-medium text-white border-4 border-gray-900 shadow-lg z-20" title={n.name}>
                              {n.name.replace(/\..*/, '')}
                          </div>
                      ))}
                  </div>
                  <div className="flex justify-center gap-8">
                      {level2.slice(0, 3).map(n => (
                          <div key={n.id} className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-[8px] text-white border-2 border-gray-900 shadow-lg z-20" title={n.name}>
                              {n.name.replace(/\..*/, '')}
                          </div>
                      ))}
                  </div>
              </div>
              {depGraph.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">No dependencies found.</div>}
          </div>
      );
  };

  return (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Gauge size={16} className="text-purple-400"/> Lighthouse Performance</h2>
              <Button size="sm" onClick={handleRunAudit} disabled={isAuditing}>
                  {isAuditing ? <Loader2 size={14} className="animate-spin mr-2"/> : <Zap size={14} className="mr-2"/>} Run Audit
              </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
              {!auditReport ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <Gauge size={48} className="opacity-20 mb-4"/>
                      <p className="text-sm">Run an audit to analyze performance.</p>
                  </div>
              ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                      <div className="flex justify-around bg-gray-800/50 p-6 rounded-xl border border-gray-800">
                          <ScoreRing label="Performance" score={auditReport.scores.performance} color={auditReport.scores.performance >= 90 ? '#10b981' : '#f59e0b'} />
                          <ScoreRing label="Accessibility" score={auditReport.scores.accessibility} color={auditReport.scores.accessibility >= 90 ? '#10b981' : '#f59e0b'} />
                          <ScoreRing label="Best Practices" score={auditReport.scores.bestPractices} color={auditReport.scores.bestPractices >= 90 ? '#10b981' : '#f59e0b'} />
                          <ScoreRing label="SEO" score={auditReport.scores.seo} color={auditReport.scores.seo >= 90 ? '#10b981' : '#f59e0b'} />
                      </div>

                      <div>
                          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Opportunities</h3>
                          <div className="space-y-3">
                              {auditReport.opportunities.map((opp, i) => (
                                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-start gap-3">
                                      <div className="mt-1 w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                                      <div className="flex-1">
                                          <div className="flex justify-between mb-1">
                                              <h4 className="text-sm font-bold text-gray-200">{opp.title}</h4>
                                              {opp.savings && <span className="text-xs text-gray-500">{opp.savings}</span>}
                                          </div>
                                          <p className="text-xs text-gray-400 leading-relaxed">{opp.description}</p>
                                      </div>
                                  </div>
                              ))}
                              {auditReport.opportunities.length === 0 && <div className="text-sm text-green-500 flex items-center gap-2"><Check size={14}/> No issues found. Great job!</div>}
                          </div>
                      </div>
                      
                      <div className="mt-8 border-t border-gray-800 pt-8">
                          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2"><Share2 size={14}/> Dependency Graph</h3>
                          <DependencyGraph />
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
};