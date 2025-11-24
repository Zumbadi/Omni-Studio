
import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, RefreshCw, Check, Filter, AlertCircle } from 'lucide-react';
import { TestResult, FileNode } from '../types';
import { Button } from './Button';

interface TestRunnerPanelProps {
  files: FileNode[];
  onOpenFile: (id: string) => void;
  results: TestResult[];
  isRunning: boolean;
  onRunTests: () => void;
}

export const TestRunnerPanel: React.FC<TestRunnerPanelProps> = ({ files, onOpenFile, results, isRunning, onRunTests }) => {
  const [filter, setFilter] = useState<'all' | 'failed'>('all');

  const filteredResults = filter === 'all' ? results : results.filter(r => r.status === 'fail');
  const totalPassed = results.reduce((acc, r) => acc + r.passed, 0);
  const totalFailed = results.reduce((acc, r) => acc + r.failed, 0);

  return (
    <div className="flex flex-col h-full bg-gray-950 font-sans">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b border-gray-800 bg-gray-900/50">
            <div className="flex items-center gap-2">
                <Button size="sm" onClick={onRunTests} disabled={isRunning} className={isRunning ? 'opacity-70' : ''}>
                    {isRunning ? <RefreshCw size={12} className="animate-spin mr-2"/> : <Play size={12} className="mr-2"/>}
                    Run All Tests
                </Button>
                <div className="h-4 w-px bg-gray-700 mx-2"></div>
                <div className="flex gap-1 bg-gray-800 rounded p-0.5">
                    <button onClick={() => setFilter('all')} className={`px-2 py-0.5 text-[10px] rounded ${filter === 'all' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>All</button>
                    <button onClick={() => setFilter('failed')} className={`px-2 py-0.5 text-[10px] rounded ${filter === 'failed' ? 'bg-red-900/50 text-red-300' : 'text-gray-400 hover:text-gray-200'}`}>Failed</button>
                </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
                <span className="text-green-400 flex items-center gap-1"><CheckCircle size={12}/> {totalPassed} Passed</span>
                <span className="text-red-400 flex items-center gap-1"><XCircle size={12}/> {totalFailed} Failed</span>
            </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {results.length === 0 && !isRunning && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50">
                    <Play size={32} className="mb-2"/>
                    <p className="text-xs">No tests run yet.</p>
                </div>
            )}

            {filteredResults.map(result => (
                <div key={result.id} className="border border-gray-800 rounded-lg bg-gray-900 overflow-hidden">
                    {/* File Header */}
                    <div className="flex items-center justify-between p-2 bg-gray-850 border-b border-gray-800 cursor-pointer hover:bg-gray-800" onClick={() => onOpenFile(result.id)}>
                        <div className="flex items-center gap-2">
                            {result.status === 'running' && <RefreshCw size={14} className="animate-spin text-blue-400"/>}
                            {result.status === 'pass' && <CheckCircle size={14} className="text-green-500"/>}
                            {result.status === 'fail' && <XCircle size={14} className="text-red-500"/>}
                            {result.status === 'pending' && <Clock size={14} className="text-gray-500"/>}
                            <span className={`text-xs font-medium ${result.status === 'fail' ? 'text-red-200' : 'text-gray-300'}`}>{result.file}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">{result.duration}ms</span>
                    </div>
                    
                    {/* Suites */}
                    {(result.status === 'pass' || result.status === 'fail') && (
                        <div className="p-2 space-y-2">
                            {result.suites.map((suite, idx) => (
                                <div key={idx} className="text-xs">
                                    <div className="flex items-center gap-2 mb-1 text-gray-400 font-bold">
                                        {suite.status === 'pass' ? <Check size={10} className="text-green-500"/> : <XCircle size={10} className="text-red-500"/>}
                                        {suite.name}
                                    </div>
                                    <div className="pl-5 space-y-1">
                                        {suite.assertions.map((assertion, aIdx) => (
                                            <div key={aIdx} className="group">
                                                <div className="flex items-center gap-2 text-gray-300">
                                                    {assertion.status === 'pass' ? <Check size={10} className="text-green-600 opacity-50"/> : <XCircle size={10} className="text-red-500"/>}
                                                    <span className={assertion.status === 'fail' ? 'text-red-300' : ''}>{assertion.name}</span>
                                                </div>
                                                {assertion.error && (
                                                    <div className="ml-4 mt-1 p-2 bg-red-900/20 border border-red-900/30 rounded text-[10px] font-mono text-red-200 whitespace-pre-wrap">
                                                        {assertion.error}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};
