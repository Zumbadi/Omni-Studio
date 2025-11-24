
import React, { useState } from 'react';
import { X, SplitSquareHorizontal, PanelBottom, Plus, AlertCircle, Terminal as TerminalIcon, Play, RotateCcw, Code, FileText, Keyboard, Sparkles, Command, Clock, Zap } from 'lucide-react';
import { CodeEditor, CodeEditorHandle } from './CodeEditor';
import { DiffEditor } from './DiffEditor';
import { Terminal } from './Terminal';
import { TestRunnerPanel } from './TestRunnerPanel';
import { ProblemsPanel } from './ProblemsPanel';
import { FileNode, TestResult } from '../types';
import { generateGhostText } from '../services/geminiService';
import { getAllFiles } from '../utils/fileHelpers';

interface EditorAreaProps {
  files: FileNode[];
  activeFileId: string;
  setActiveFileId: (id: string) => void;
  openFiles: string[];
  onCloseTab: (id: string, secId: string | null, setSec: (id: string | null) => void) => void;
  
  isSplitView: boolean;
  setIsSplitView: React.Dispatch<React.SetStateAction<boolean>>;
  splitRatio: number;
  secondaryFileId: string | null;
  setSecondaryFileId: (id: string | null) => void;
  
  diffFileId: string | null;
  setDiffFileId: (id: string | null) => void;
  previewDiff: { original: string, modified: string, fileName: string } | null;
  setPreviewDiff: (diff: any) => void;
  
  activeFile: FileNode | undefined;
  secondaryFile: FileNode | undefined;
  diffFile: FileNode | undefined;
  
  editorRef: React.RefObject<CodeEditorHandle>;
  updateFileContent: (id: string, content: string) => void;
  editorConfig: any;
  handleCodeAction: (action: string, code: string) => void;
  setEditorSelection: (sel: string) => void;
  breakpoints: number[];
  setBreakpoints: React.Dispatch<React.SetStateAction<number[]>>;
  setCursorPos: (pos: {line: number, col: number}) => void;
  addToast: (type: any, msg: string) => void;
  
  layout: { showBottom: boolean };
  toggleLayout: (panel: string) => void;
  bottomPanelHeight: number;
  handleResizeStart: (dir: any, e: any) => void;
  
  terminalLogs: string[];
  onCommand: (cmd: string) => void;
  onAiFix: (err: string) => void;

  // Testing Props
  testResults: TestResult[];
  isRunningTests: boolean;
  onRunTests: () => void;
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  files, activeFileId, setActiveFileId, openFiles, onCloseTab,
  isSplitView, setIsSplitView, splitRatio, secondaryFileId, setSecondaryFileId,
  diffFileId, setDiffFileId, previewDiff, setPreviewDiff,
  activeFile, secondaryFile, diffFile,
  editorRef, updateFileContent, editorConfig, handleCodeAction, setEditorSelection, breakpoints, setBreakpoints, setCursorPos, addToast,
  layout, toggleLayout, bottomPanelHeight, handleResizeStart,
  terminalLogs, onCommand, onAiFix,
  testResults, isRunningTests, onRunTests
}) => {
  
  const [activeBottomTab, setActiveBottomTab] = useState<'terminal' | 'problems' | 'tests'>('terminal');

  const getFile = (id: string, nodes: FileNode[]): FileNode | undefined => {
      for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
              const found = getFile(id, node.children);
              if (found) return found;
          }
      }
      return undefined;
  };

  const handleOpenFile = (id: string, line?: number) => {
      setActiveFileId(id);
      if (!openFiles.includes(id)) {
          // Note: Adding to openFiles is handled by workspace callback usually, but here we are just setting active
          // Ideally workspace should expose a robust 'openFile' method
      }
      if(line && editorRef.current) {
          setTimeout(() => editorRef.current?.scrollToLine(line), 100);
      }
  };

  const handleReloadFile = () => {
      if (!activeFile) return;
      addToast('info', 'Reloaded file from memory');
  };

  // Start Screen Component
  const StartScreen = () => {
      const allFiles = getAllFiles(files);
      // Simulate "Recent" by taking first 5 non-config files
      const recentFiles = allFiles
        .filter(f => !f.node.name.startsWith('.') && f.node.type === 'file')
        .slice(0, 5);

      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-900 text-gray-400 p-8 animate-in fade-in">
            <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-gray-700/50">
                <Command size={32} className="text-primary-500"/>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Omni-Studio</h1>
            <p className="text-sm text-gray-500 mb-8">AI-Native Development Environment</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-gray-600 flex items-center gap-2">
                        <Zap size={12}/> Quick Actions
                    </h3>
                    <button className="w-full bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-primary-500/50 hover:bg-gray-800/80 text-left transition-all group" onClick={() => onCommand('toggle_sidebar')}>
                        <div className="flex items-center gap-2 text-primary-400 mb-1 group-hover:text-primary-300"><FileText size={16}/> Explore Files</div>
                        <p className="text-xs text-gray-500">Browse project structure</p>
                    </button>
                    <button className="w-full bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-primary-500/50 hover:bg-gray-800/80 text-left transition-all group" onClick={() => onCommand('export_project')}>
                        <div className="flex items-center gap-2 text-blue-400 mb-1 group-hover:text-blue-300"><Code size={16}/> Export Project</div>
                        <p className="text-xs text-gray-500">Download as ZIP</p>
                    </button>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3 text-gray-600 flex items-center gap-2">
                        <Clock size={12}/> Recent Files
                    </h3>
                    <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
                        {recentFiles.map((f, i) => (
                            <div 
                                key={f.node.id}
                                onClick={() => handleOpenFile(f.node.id)}
                                className="flex items-center gap-3 p-3 border-b border-gray-700/50 last:border-0 hover:bg-gray-700/50 cursor-pointer transition-colors group"
                            >
                                <FileText size={14} className="text-gray-500 group-hover:text-white"/>
                                <div>
                                    <div className="text-sm text-gray-300 group-hover:text-white font-medium">{f.node.name}</div>
                                    <div className="text-[10px] text-gray-600">{f.path}</div>
                                </div>
                            </div>
                        ))}
                        {recentFiles.length === 0 && <div className="p-4 text-xs text-gray-500 text-center">No files available</div>}
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-gray-800">
                    <div className="flex justify-between items-center text-xs text-gray-500">
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1.5 rounded border border-gray-700">Ctrl</kbd> + <kbd className="bg-gray-800 px-1.5 rounded border border-gray-700">P</kbd> Files</span>
                            <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1.5 rounded border border-gray-700">Ctrl</kbd> + <kbd className="bg-gray-800 px-1.5 rounded border border-gray-700">B</kbd> Sidebar</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span>Omni-Studio v1.0</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-900 h-full" id="editor-container">
        {/* Tab Bar */}
        <div className="flex bg-gray-900 border-b border-gray-800 overflow-x-auto scrollbar-none shrink-0">
            {openFiles.map(fileId => {
                const file = getFile(fileId, files);
                if (!file) return null;
                return (
                    <div 
                        key={file.id} 
                        onClick={() => setActiveFileId(file.id)} 
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-r border-gray-800 cursor-pointer min-w-[120px] max-w-[200px] group select-none ${activeFileId === file.id ? 'bg-gray-800 text-primary-400 border-t-2 border-t-primary-500' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200 border-t-2 border-t-transparent'}`}
                    >
                        <span className={`truncate ${file.gitStatus === 'modified' ? 'text-yellow-500' : ''}`}>{file.name}</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onCloseTab(file.id, secondaryFileId, setSecondaryFileId); }} 
                            className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 text-gray-400 hover:text-white transition-opacity"
                        >
                            <X size={12} />
                        </button>
                    </div>
                );
            })}
            {openFiles.length === 0 && <div className="px-4 py-2.5 text-xs text-gray-600 italic">No open files</div>}
            
            <div className="ml-auto flex items-center">
                <button
                    onClick={handleReloadFile}
                    className="px-3 flex items-center text-gray-500 hover:text-white border-l border-gray-800 h-full"
                    title="Reload File (Discard Unsaved)"
                >
                    <RotateCcw size={14} />
                </button>
                <button 
                    onClick={() => setIsSplitView(p => !p)} 
                    className={`px-3 flex items-center text-gray-500 hover:text-white border-l border-gray-800 h-full ${isSplitView ? 'text-primary-500 bg-gray-800' : ''}`}
                    title="Toggle Split View"
                >
                    <SplitSquareHorizontal size={14} />
                </button>
            </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 relative min-h-0 flex">
            {/* AI Diff Overlay */}
            {previewDiff && (
                <div className="absolute inset-0 z-50 bg-gray-950 animate-in fade-in flex flex-col">
                    <div className="flex-1 min-h-0">
                        <DiffEditor 
                            original={previewDiff.original} 
                            modified={previewDiff.modified} 
                            fileName={`Comparing: ${previewDiff.fileName}`} 
                            onClose={() => setPreviewDiff(null)} 
                        />
                    </div>
                    <div className="bg-gray-900 border-t border-gray-800 p-4 flex justify-end gap-3 shrink-0">
                        <button onClick={() => setPreviewDiff(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs font-medium transition-colors">Discard Changes</button>
                        <button 
                            onClick={() => { updateFileContent(activeFileId, previewDiff.modified); setPreviewDiff(null); addToast('success', 'Changes Applied'); }}
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded text-xs font-medium transition-colors"
                        >
                            Apply Changes
                        </button>
                    </div>
                </div>
            )}

            {diffFileId && diffFile ? (
                <div className="absolute inset-0 z-10">
                    <DiffEditor 
                        original={diffFile.content || ''} 
                        modified={diffFile.content + '\n// Working Tree'} 
                        fileName={diffFile.name} 
                        onClose={() => setDiffFileId(null)} 
                    />
                </div>
            ) : (
                <>
                    <div className={`relative flex flex-col ${isSplitView ? '' : 'w-full'}`} style={isSplitView ? { width: `${splitRatio}%` } : {}}>
                        {activeFile ? (
                            <CodeEditor 
                                ref={editorRef} 
                                code={activeFile.content || ''} 
                                onChange={(val) => updateFileContent(activeFile.id, val)} 
                                fileName={activeFile.name} 
                                config={editorConfig} 
                                onCodeAction={handleCodeAction} 
                                onSelectionChange={setEditorSelection} 
                                breakpoints={breakpoints}
                                onToggleBreakpoint={(line) => setBreakpoints(p => p.includes(line) ? p.filter(b => b !== line) : [...p, line])}
                                onGhostTextRequest={async (p, s) => await generateGhostText(p, s)}
                                onSave={() => addToast('success', 'File Saved')}
                                onCursorChange={(line, col) => setCursorPos({ line, col })}
                            />
                        ) : (
                            <StartScreen />
                        )}
                    </div>
                    
                    {isSplitView && (
                        <div 
                            className="w-2 bg-gray-900 hover:bg-primary-600 cursor-col-resize z-20 flex-shrink-0 transition-colors hidden md:block" 
                            onMouseDown={(e) => handleResizeStart('split', e)} 
                        />
                    )}
                    
                    {isSplitView && (
                        <div className="relative flex flex-col bg-gray-950" style={{ width: `${100 - splitRatio}%` }}>
                            {secondaryFile ? (
                                <CodeEditor 
                                    code={secondaryFile.content || ''} 
                                    onChange={() => {}} 
                                    fileName={secondaryFile.name} 
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-600 text-xs">
                                    Click a file to open in split
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>

        {/* Bottom Panel with Tabs */}
        {layout.showBottom && (
            <>
                <div 
                    className="h-2 bg-gray-900 border-t border-gray-800 hover:bg-primary-600 cursor-ns-resize z-20 flex-shrink-0 transition-colors hidden md:block" 
                    onMouseDown={(e) => handleResizeStart('bottomPanel', e)} 
                />
                <div className="bg-black border-t border-gray-800 flex flex-col flex-shrink-0 transition-all" style={{ height: bottomPanelHeight }}>
                    <div className="flex border-b border-gray-800 bg-gray-900">
                        <button 
                            onClick={() => setActiveBottomTab('terminal')}
                            className={`px-4 py-1 text-xs uppercase font-bold flex items-center gap-2 border-b-2 transition-colors ${activeBottomTab === 'terminal' ? 'text-white border-primary-500 bg-gray-800' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                        >
                            <TerminalIcon size={12}/> Terminal
                        </button>
                        <button 
                            onClick={() => setActiveBottomTab('problems')}
                            className={`px-4 py-1 text-xs uppercase font-bold flex items-center gap-2 border-b-2 transition-colors ${activeBottomTab === 'problems' ? 'text-white border-primary-500 bg-gray-800' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                        >
                            <AlertCircle size={12}/> Problems
                        </button>
                        <button 
                            onClick={() => setActiveBottomTab('tests')}
                            className={`px-4 py-1 text-xs uppercase font-bold flex items-center gap-2 border-b-2 transition-colors ${activeBottomTab === 'tests' ? 'text-white border-primary-500 bg-gray-800' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                        >
                            <Play size={12}/> Test Runner
                        </button>
                        <div className="ml-auto px-2 flex items-center">
                            <button onClick={() => toggleLayout('bottom')} className="text-gray-500 hover:text-white p-1"><X size={14}/></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-hidden relative">
                        {activeBottomTab === 'terminal' && (
                            <Terminal logs={terminalLogs} onCommand={onCommand} onAiFix={onAiFix} />
                        )}
                        {activeBottomTab === 'problems' && (
                            <ProblemsPanel files={files} onOpenFile={handleOpenFile} onAiFix={(p) => onAiFix(`Fix ${p.message} in ${p.file} at line ${p.line}`)} />
                        )}
                        {activeBottomTab === 'tests' && (
                            <TestRunnerPanel 
                                files={files} 
                                onOpenFile={handleOpenFile} 
                                results={testResults}
                                isRunning={isRunningTests}
                                onRunTests={onRunTests}
                            />
                        )}
                    </div>
                </div>
            </>
        )}
    </div>
  );
};
