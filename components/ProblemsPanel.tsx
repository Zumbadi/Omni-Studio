
import React, { useState, useEffect } from 'react';
import { AlertTriangle, XCircle, Info, Sparkles, Filter, CheckCircle } from 'lucide-react';
import { FileNode, Problem } from '../types';
import { getAllFiles } from '../utils/fileHelpers';

interface ProblemsPanelProps {
  files: FileNode[];
  onOpenFile: (id: string, line: number) => void;
  onAiFix: (problem: Problem) => void;
}

export const ProblemsPanel: React.FC<ProblemsPanelProps> = ({ files, onOpenFile, onAiFix }) => {
  const [problems, setProblems] = useState<Problem[]>([]);

  // Simple static analysis simulation
  useEffect(() => {
      const allFiles = getAllFiles(files);
      const newProblems: Problem[] = [];
      
      allFiles.forEach(({ node }) => {
          if (!node.content) return;
          const lines = node.content.split('\n');
          lines.forEach((line, idx) => {
              // Mock Linter Rules
              if (line.includes('console.log')) {
                  newProblems.push({ id: `${node.id}-${idx}`, file: node.name, line: idx + 1, col: line.indexOf('console.log'), severity: 'info', message: 'Unexpected console statement.', source: 'eslint' });
              }
              if (line.includes('any')) {
                  newProblems.push({ id: `${node.id}-${idx}`, file: node.name, line: idx + 1, col: line.indexOf('any'), severity: 'warning', message: 'Unexpected any. Specify a different type.', source: 'ts' });
              }
              if (line.includes('TODO') || line.includes('FIXME')) {
                  newProblems.push({ id: `${node.id}-${idx}`, file: node.name, line: idx + 1, col: line.indexOf('TODO'), severity: 'info', message: 'Pending task found.', source: 'ai' });
              }
              if (line.match(/const\s+[a-z0-9]+\s*=\s*$/)) { // Trailing equals
                  newProblems.push({ id: `${node.id}-${idx}`, file: node.name, line: idx + 1, col: line.length, severity: 'error', message: 'Expression expected.', source: 'ts' });
              }
          });
      });
      setProblems(newProblems);
  }, [files]);

  const getIcon = (severity: Problem['severity']) => {
      if (severity === 'error') return <XCircle size={14} className="text-red-500"/>;
      if (severity === 'warning') return <AlertTriangle size={14} className="text-yellow-500"/>;
      return <Info size={14} className="text-blue-500"/>;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 font-sans text-xs">
        <div className="flex items-center justify-between p-2 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center gap-4">
                <div className="font-bold text-gray-400 uppercase tracking-wider">Problems</div>
                <div className="flex gap-2 text-gray-500">
                    <span className="flex items-center gap-1"><XCircle size={12}/> {problems.filter(p => p.severity === 'error').length}</span>
                    <span className="flex items-center gap-1"><AlertTriangle size={12}/> {problems.filter(p => p.severity === 'warning').length}</span>
                    <span className="flex items-center gap-1"><Info size={12}/> {problems.filter(p => p.severity === 'info').length}</span>
                </div>
            </div>
            <button className="text-gray-500 hover:text-white"><Filter size={14}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
            {problems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 opacity-60">
                    <CheckCircle size={32} className="mb-2 text-green-500"/>
                    <p>No problems found.</p>
                </div>
            ) : (
                <div>
                    {problems.map(problem => (
                        <div key={problem.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer group border-b border-gray-800/50" onClick={() => onOpenFile(problem.id.split('-')[0], problem.line)}>
                            <div className="shrink-0 pt-0.5">{getIcon(problem.severity)}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-gray-300 truncate">{problem.message}</span>
                                    <span className="text-gray-600 font-mono">{problem.source}</span>
                                </div>
                                <div className="text-gray-500 flex items-center gap-2 mt-0.5">
                                    <span>{problem.file}</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                                    <span>{problem.line}:{problem.col}</span>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onAiFix(problem); }}
                                className="opacity-0 group-hover:opacity-100 bg-blue-900/30 hover:bg-blue-900/60 text-blue-300 border border-blue-800 px-2 py-1 rounded flex items-center gap-1 transition-opacity"
                            >
                                <Sparkles size={10}/> Fix
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};
