
import React from 'react';
import { X, SplitSquareHorizontal, PanelBottom, Plus } from 'lucide-react';
import { CodeEditor, CodeEditorHandle } from './CodeEditor';
import { DiffEditor } from './DiffEditor';
import { Terminal } from './Terminal';
import { FileNode } from '../types';
import { generateGhostText } from '../services/geminiService';

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
}

export const EditorArea: React.FC<EditorAreaProps> = ({
  files, activeFileId, setActiveFileId, openFiles, onCloseTab,
  isSplitView, setIsSplitView, splitRatio, secondaryFileId, setSecondaryFileId,
  diffFileId, setDiffFileId, previewDiff, setPreviewDiff,
  activeFile, secondaryFile, diffFile,
  editorRef, updateFileContent, editorConfig, handleCodeAction, setEditorSelection, breakpoints, setBreakpoints, setCursorPos, addToast,
  layout, toggleLayout, bottomPanelHeight, handleResizeStart,
  terminalLogs, onCommand, onAiFix
}) => {

  // Helper function to find file in tree
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
            <button 
                onClick={() => setIsSplitView(p => !p)} 
                className={`ml-auto px-3 flex items-center text-gray-500 hover:text-white border-l border-gray-800 ${isSplitView ? 'text-primary-500 bg-gray-800' : ''}`}
                title="Toggle Split View"
            >
                <SplitSquareHorizontal size={14} />
            </button>
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
                            <div className="flex flex-col items-center justify-center h-full text-gray-600 bg-gray-900/50">
                                <div className="mb-2 opacity-20"><Plus size={48}/></div>
                                <p className="text-sm">Select a file to edit</p>
                                <p className="text-xs">or Ctrl+P to search</p>
                            </div>
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
                                    onChange={() => {}} // Read only secondary for now or separate handler
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

        {/* Terminal Panel */}
        {layout.showBottom && (
            <>
                <div 
                    className="h-2 bg-gray-900 border-t border-gray-800 hover:bg-primary-600 cursor-ns-resize z-20 flex-shrink-0 transition-colors hidden md:block" 
                    onMouseDown={(e) => handleResizeStart('bottomPanel', e)} 
                />
                <div className="bg-black border-t border-gray-800 flex flex-col flex-shrink-0 transition-all" style={{ height: bottomPanelHeight }}>
                    <div className="flex border-b border-gray-800 bg-gray-900">
                        <button className="px-4 py-1 text-xs uppercase font-bold text-white border-b-2 border-primary-500 flex items-center gap-2">
                            <PanelBottom size={12}/> Terminal
                        </button>
                        <div className="ml-auto px-2 flex items-center">
                            <button onClick={() => toggleLayout('bottom')} className="text-gray-500 hover:text-white p-1"><X size={14}/></button>
                        </div>
                    </div>
                    <Terminal logs={terminalLogs} onCommand={onCommand} onAiFix={onAiFix} />
                </div>
            </>
        )}
    </div>
  );
};
