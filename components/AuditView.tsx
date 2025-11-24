
import React, { useState, useEffect } from 'react';
import { Gauge, Loader2, Zap, Check, Share2, Shield, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { PerformanceReport, FileNode, AuditIssue } from '../types';
import { generatePerformanceReport, runSecurityAudit } from '../services/geminiService';
import { analyzeDependencies, DepNode } from '../utils/projectAnalysis';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface AuditViewProps {
  files: FileNode[];
}

export const AuditView: React.FC<AuditViewProps> = ({ files }) => {
  const [activeTab, setActiveTab] = useState<'performance' | 'security'>('performance');
  const [perfReport, setPerfReport] = useState<PerformanceReport | null>(null);
  const [securityIssues, setSecurityIssues] = useState<AuditIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [depGraph, setDepGraph] = useState<DepNode[]>([]);

  useEffect(() => {
      setDepGraph(analyzeDependencies(files));
  }, [files]);

  const handleRunAudit = async () => {
      setIsAuditing(true);
      const getStruct = (nodes: FileNode[], depth=0) => nodes.map(n => '  '.repeat(depth) + n.name).join('\n');
      const struct = getStruct(files);
      
      // Mock package.json retrieval
      const pkgJson = files.find(f => f.name === 'package.json')?.content || '{}';

      if (activeTab === 'performance') {
          const report = await generatePerformanceReport(struct);
          setPerfReport(report);
      } else {
          const issues = await runSecurityAudit(struct, pkgJson);
          setSecurityIssues(issues);
      }
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

  const SecurityList = () => (
      <div className="space-y-4">
          <div className="flex gap-4 mb-4">
              <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 flex-1 text-center">
                  <div className="text-2xl font-bold text-red-500">{securityIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length}</div>
                  <div className="text-xs text-red-400 uppercase tracking-wider">Critical</div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 flex-1 text-center">
                  <div className="text-2xl font-bold text-yellow-500">{securityIssues.filter(i => i.severity === 'medium').length}</div>
                  <div className="text-xs text-yellow-400 uppercase tracking-wider">Medium</div>
              </div>
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 flex-1 text-center">
                  <div className="text-2xl font-bold text-blue-500">{securityIssues.filter(i => i.severity === 'low').length}</div>
                  <div className="text-xs text-blue-400 uppercase tracking-wider">Low</div>
              </div>
          </div>

          <div className="space-y-2">
              {securityIssues.map((issue, i) => (
                  <div key={i} className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex gap-3 items-start group hover:border-gray-600 transition-colors">
                      <div className={`mt-1 p-1.5 rounded bg-gray-900 ${issue.severity === 'critical' ? 'text-red-500' : issue.severity === 'high' ? 'text-orange-500' : issue.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'}`}>
                          <Shield size={16} />
                      </div>
                      <div className="flex-1">
                          <div className="flex justify-between mb-1">
                              <span className="font-semibold text-sm text-gray-200">{issue.title}</span>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${issue.severity === 'critical' ? 'bg-red-900/30 text-red-400' : 'bg-gray-700 text-gray-400'}`}>{issue.severity}</span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">{issue.description}</p>
                          {issue.file && <div className="mt-2 text-[10px] font-mono text-gray-500 bg-black/30 px-2 py-1 rounded w-fit">Location: {issue.file}{issue.line ? `:${issue.line}` : ''}</div>}
                      </div>
                  </div>
              ))}
              {securityIssues.length === 0 && !isAuditing && <div className="text-center text-gray-500 py-8 text-sm">No vulnerabilities detected.</div>}
          </div>
      </div>
  );

  const DependencyGraph = () => {
      // Better visual layout for dependency graph
      // Distribute nodes in concentric circles based on level
      const centerX = 300;
      const centerY = 160;
      
      const renderedNodes = depGraph.map((node, i, arr) => {
          const countInLevel = arr.filter(n => n.level === node.level).length;
          const indexInLevel = arr.filter(n => n.level === node.level && arr.indexOf(n) < i).length;
          const radius = node.level * 80;
          const angle = (indexInLevel / (countInLevel || 1)) * 2 * Math.PI - (Math.PI / 2);
          
          // Offset center for root
          const x = node.level === 0 ? centerX : centerX + Math.cos(angle) * radius;
          const y = node.level === 0 ? centerY : centerY + Math.sin(angle) * radius;
          
          return { ...node, x, y, color: node.level === 0 ? '#4f46e5' : node.level === 1 ? '#2563eb' : '#9333ea' };
      });

      return (
          <div className="bg-black/30 rounded-xl border border-gray-800 h-80 relative overflow-hidden flex items-center justify-center p-4">
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs>
                      <marker id="dep-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#374151" />
                      </marker>
                  </defs>
                  
                  {/* Links */}
                  {renderedNodes.map((src) => {
                      // Draw lines to hypothetical dependencies for visual flair (or real ones if we parsed deeper)
                      // For now, draw line to root if level > 0
                      if (src.level > 0) {
                          const root = renderedNodes.find(n => n.level === 0);
                          if (root) {
                              return <line key={`link-${src.id}`} x1={root.x} y1={root.y} x2={src.x} y2={src.y} stroke="#374151" opacity="0.3" strokeWidth="1" />;
                          }
                      }
                      return null;
                  })}

                  {/* Level Circles */}
                  <circle cx={centerX} cy={centerY} r="80" stroke="#374151" strokeWidth="1" fill="none" strokeDasharray="4" opacity="0.3"/>
                  <circle cx={centerX} cy={centerY} r="160" stroke="#374151" strokeWidth="1" fill="none" strokeDasharray="4" opacity="0.3"/>
              </svg>

              {renderedNodes.map(node => (
                  <div 
                    key={node.id} 
                    className="absolute flex flex-col items-center justify-center z-20 transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                    style={{ left: node.x, top: node.y }}
                  >
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-4 border-gray-900 shadow-xl transition-transform group-hover:scale-110 z-20"
                        style={{ backgroundColor: node.color }}
                        title={node.name}
                      >
                          {node.name.substring(0, 4)}..
                      </div>
                      <div className="mt-1 text-[9px] text-gray-400 bg-gray-900/80 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                          {node.name}
                      </div>
                  </div>
              ))}
              
              {depGraph.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">No dependencies found.</div>}
          </div>
      );
  };

  return (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
              <div className="flex gap-2">
                  <button onClick={() => setActiveTab('performance')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'performance' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                      <Gauge size={14} className="inline mr-1"/> Performance
                  </button>
                  <button onClick={() => setActiveTab('security')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === 'security' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                      <Shield size={14} className="inline mr-1"/> Security
                  </button>
              </div>
              <Button size="sm" onClick={handleRunAudit} disabled={isAuditing}>
                  {isAuditing ? <Loader2 size={14} className="animate-spin mr-2"/> : <Zap size={14} className="mr-2"/>} 
                  Run {activeTab === 'performance' ? 'Performance' : 'Security'} Scan
              </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
              {isAuditing ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <Loader2 size={32} className="animate-spin mb-4 text-primary-500"/>
                      <p className="text-sm">Analyzing project structure & code...</p>
                  </div>
              ) : activeTab === 'performance' ? (
                  !perfReport ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <Gauge size={48} className="opacity-20 mb-4"/>
                          <p className="text-sm">Run a performance audit to see scores.</p>
                      </div>
                  ) : (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                          <div className="flex justify-around bg-gray-800/50 p-6 rounded-xl border border-gray-800">
                              <ScoreRing label="Performance" score={perfReport.scores.performance} color={perfReport.scores.performance >= 90 ? '#10b981' : '#f59e0b'} />
                              <ScoreRing label="Accessibility" score={perfReport.scores.accessibility} color={perfReport.scores.accessibility >= 90 ? '#10b981' : '#f59e0b'} />
                              <ScoreRing label="Best Practices" score={perfReport.scores.bestPractices} color={perfReport.scores.bestPractices >= 90 ? '#10b981' : '#f59e0b'} />
                              <ScoreRing label="SEO" score={perfReport.scores.seo} color={perfReport.scores.seo >= 90 ? '#10b981' : '#f59e0b'} />
                          </div>

                          <div>
                              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4">Opportunities</h3>
                              <div className="space-y-3">
                                  {perfReport.opportunities.map((opp, i) => (
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
                                  {perfReport.opportunities.length === 0 && <div className="text-sm text-green-500 flex items-center gap-2"><Check size={14}/> No issues found. Great job!</div>}
                              </div>
                          </div>
                          
                          <div className="mt-8 border-t border-gray-800 pt-8">
                              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2"><Share2 size={14}/> Dependency Graph</h3>
                              <DependencyGraph />
                          </div>
                      </div>
                  )
              ) : (
                  <SecurityList />
              )}
          </div>
      </div>
  );
};
