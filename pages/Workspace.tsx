
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, PanelBottom, Columns, MessageSquare, ArrowRight, X, Minimize2, SplitSquareHorizontal, GitBranch, Mic } from 'lucide-react';
import { MOCK_COMMITS, MOCK_EXTENSIONS, DEFAULT_AGENTS } from '../constants';
import { Project, ProjectType, SocialPost, AudioTrack, Extension, GitCommit as GitCommitType, ProjectPhase, AgentTask, AIAgent } from '../types';
import { CodeEditor, CodeEditorHandle } from '../components/CodeEditor';
import { Terminal } from '../components/Terminal';
import { runAgentFileTask, generateGhostText, generateProjectPlan } from '../services/geminiService';
import { Button } from '../components/Button';
import JSZip from 'jszip';
import { generatePreviewHtml } from '../utils/runtime';
import { MessageRenderer } from '../components/MessageRenderer';
import { PreviewPanel } from '../components/PreviewPanel';
import { DiffEditor } from '../components/DiffEditor';
import { useFileSystem } from '../hooks/useFileSystem';
import { useResizable } from '../hooks/useResizable';
import { useOmniAssistant } from '../hooks/useOmniAssistant';
import { useTerminal } from '../hooks/useTerminal';
import { WorkspaceSidebar } from '../components/WorkspaceSidebar';
import { VoiceCommander } from '../components/VoiceCommander';
import { CommandPalette } from '../components/CommandPalette';

interface WorkspaceProps {
  project: Project | null;
}

// ... (SearchResult, ContextMenuState interfaces unchanged)

export const Workspace: React.FC<WorkspaceProps> = ({ project }) => {
  // ... (Initial hooks and state unchanged)
  const isNative = project?.type === ProjectType.REACT_NATIVE || project?.type === ProjectType.IOS_APP || project?.type === ProjectType.ANDROID_APP;
  const isBackend = project?.type === ProjectType.NODE_API;
  
  const { 
      files, setFiles, activeFileId, setActiveFileId, openFiles, setOpenFiles, 
      remoteDirName, setRemoteDirName, updateFileContent, addFile, findFileById, getAllFiles,
      handleFileClick: onFileClick, handleCloseTab: onCloseTab
  } = useFileSystem(project);
  
  const { 
      sidebarWidth, setSidebarWidth, 
      rightPanelWidth, setRightPanelWidth, 
      bottomPanelHeight, setBottomPanelHeight, 
      splitRatio, setSplitRatio, 
      startResizing 
  } = useResizable();

  const [isResizing, setIsResizing] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);
  const [secondaryFileId, setSecondaryFileId] = useState<string | null>(null);
  const activeFile = findFileById(files, activeFileId);
  const secondaryFile = secondaryFileId ? findFileById(files, secondaryFileId) : null;
  
  const [diffFileId, setDiffFileId] = useState<string | null>(null);
  const diffFile = diffFileId ? findFileById(files, diffFileId) : null;

  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture'>('preview');
  const [bottomPanelTab, setBottomPanelTab] = useState<'terminal' | 'problems'>('terminal');
  
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('omni_active_model') || 'Gemini 2.5 Flash (Fastest)');
  
  const [roadmap, setRoadmap] = useState<ProjectPhase[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  const [commits, setCommits] = useState<GitCommitType[]>(MOCK_COMMITS);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  const [editorConfig, setEditorConfig] = useState<any>({});
  const editorRef = useRef<CodeEditorHandle>(null);
  const [editorSelection, setEditorSelection] = useState('');
  
  const {
      chatInput, setChatInput,
      chatHistory, setChatHistory,
      isGenerating,
      isChatOpen, setIsChatOpen,
      enableCritic, setEnableCritic,
      attachedImage, setAttachedImage,
      triggerGeneration,
      handleChatSubmit,
      handleCodeAction
  } = useOmniAssistant({
      projectType: project?.type || ProjectType.REACT_WEB,
      files,
      activeFile,
      activeModel,
      editorSelection,
      setEditorSelection
  });

  const { handleCommand, handleAiFix } = useTerminal({
      files, setFiles, activeFileId, projectType: project?.type || ProjectType.REACT_WEB, addFile, onLog: (msg) => setTerminalLogs(prev => [...prev, msg])
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [debugVariables, setDebugVariables] = useState<{name: string, value: string}[]>([]);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);

  // Agents State - Modified to include current agent info
  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask | null>(null);
  const [activeAgent, setActiveAgent] = useState<AIAgent | null>(null);

  const [activeActivity, setActiveActivity] = useState<'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS'>('EXPLORER');
  const [layout, setLayout] = useState({ showSidebar: window.innerWidth >= 768, showBottom: true, showRight: window.innerWidth >= 1024 });

  const [assets, setAssets] = useState<{type: 'image' | 'video' | 'audio', url: string, name: string}[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showVoiceCommander, setShowVoiceCommander] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>({ visible: false, x: 0, y: 0, fileId: null });

  // Sync Settings
  useEffect(() => {
      const handleSettingsChange = () => {
          const savedModel = localStorage.getItem('omni_active_model');
          if (savedModel) setActiveModel(savedModel);
          const savedConfig = localStorage.getItem('omni_editor_config');
          if (savedConfig) setEditorConfig(JSON.parse(savedConfig));
      };
      window.addEventListener('omniSettingsChanged', handleSettingsChange);
      handleSettingsChange();
      return () => window.removeEventListener('omniSettingsChanged', handleSettingsChange);
  }, []);

  const handleResizeStart = (dir: any, e: any) => {
      setIsResizing(true);
      startResizing(dir, e);
      const onMouseUp = () => {
          setIsResizing(false);
          window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mouseup', onMouseUp);
  };

  // --- Agent Runner Logic (Updated for Productivity Tracking) ---
  useEffect(() => {
      if (!activeAgentTask || activeAgentTask.status === 'completed' || !activeAgent) return;

      const run = async () => {
          const allFiles = getAllFiles(files);
          const relevantFiles = allFiles.filter(f => f.node.name.endsWith('.tsx') || f.node.name.endsWith('.ts') || f.node.name.endsWith('.js'));
          
          setActiveAgentTask(prev => prev ? { ...prev, totalFiles: relevantFiles.length } : null);

          let processedCount = 0;

          for (let i = 0; i < relevantFiles.length; i++) {
              const file = relevantFiles[i];
              setActiveAgentTask(prev => prev ? { ...prev, currentFile: file.node.name, logs: [...prev.logs, `[${activeAgent.name}] Analyzing ${file.node.name}...`] } : null);
              
              // Pass the full agent object to the service
              const result = await runAgentFileTask(activeAgent, file.node.name, file.node.content || '');
              
              if (result) {
                  const filenameMatch = result.match(/^\/\/ filename: (.*)/);
                  const targetName = filenameMatch ? filenameMatch[1].trim() : `processed_${file.node.name}`;
                  addFile(targetName, result);
                  setActiveAgentTask(prev => prev ? { ...prev, logs: [...prev.logs, `> Generated ${targetName}`] } : null);
              }

              processedCount++;
              setActiveAgentTask(prev => prev ? { ...prev, processedFiles: processedCount } : null);
              await new Promise(r => setTimeout(r, 500));
          }

          // Record Productivity Stats
          const statsKey = 'omni_team_stats';
          const currentStats = JSON.parse(localStorage.getItem(statsKey) || '[]');
          const newStat = {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              velocity: processedCount * 10, // Arbitrary score based on files processed
              agent: activeAgent.name
          };
          // Keep last 20 points
          const updatedStats = [...currentStats, newStat].slice(-20);
          localStorage.setItem(statsKey, JSON.stringify(updatedStats));
          window.dispatchEvent(new Event('omniStatsUpdated'));

          setActiveAgentTask(prev => prev ? { ...prev, status: 'completed', logs: [...prev.logs, `Task Completed by ${activeAgent.name}. Velocity recorded.`] } : null);
          setActiveAgent(null);
      };

      run();
  }, [activeAgentTask?.status, activeAgent]);

  const handleStartAgentTask = (agent: AIAgent, type: AgentTask['type']) => {
      setActiveAgent(agent);
      setActiveAgentTask({
          id: `task-${Date.now()}`,
          type,
          name: `${type === 'tests' ? 'QA' : type === 'docs' ? 'Docs' : 'Refactor'} run by ${agent.name}`,
          status: 'running',
          totalFiles: 0,
          processedFiles: 0,
          logs: [`Starting Agent: ${agent.name}`, `Model: ${agent.model}`, `Role: ${agent.role}`]
      });
  };

  useEffect(() => {
      const handleResize = () => {
          const isMobile = window.innerWidth < 768;
          setLayout(prev => ({ ...prev, showSidebar: !isMobile && prev.showSidebar, showRight: window.innerWidth >= 1024 && prev.showRight }));
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper for wrapper functions
  const onFileClickWrapper = useCallback((id: string) => onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId), [isSplitView, secondaryFileId, onFileClick]);
  const onResultClickWrapper = useCallback((id: string, line: number) => { onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId); if (editorRef.current) editorRef.current.scrollToLine(line); }, [isSplitView, secondaryFileId, onFileClick]);

  // Mock handlers for simplicity
  const handleSearch = (q: string) => { setSearchQuery(q); };
  const toggleLayout = (p: any) => { setLayout(prev => ({...prev, [p === 'sidebar' ? 'showSidebar' : p === 'bottom' ? 'showBottom' : 'showRight']: !prev[p === 'sidebar' ? 'showSidebar' : p === 'bottom' ? 'showBottom' : 'showRight']}))};
  const handleCommit = (m: string) => setCommits(prev => [...prev, { id: Date.now().toString(), message: m, author: 'You', date: 'Now', hash: 'abc' }]);
  const handleFileUpload = (e: any) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                  const content = ev.target?.result as string;
                  addFile(files[i].name, content);
              };
              reader.readAsText(files[i]);
          }
      }
  }; 
  const handleFolderUpload = (e: any) => {
      const files = e.target.files;
      if (files) {
          for (let i=0; i<files.length; i++) {
              const file = files[i];
              const path = file.webkitRelativePath || file.name;
              const reader = new FileReader();
              reader.onload = (ev) => {
                  addFile(path, ev.target?.result as string);
              }
              reader.readAsText(file);
          }
      }
  };
  const handleSystemCommand = (c: string) => {
      if (c === 'toggle_sidebar') toggleLayout('sidebar');
      if (c === 'toggle_terminal') toggleLayout('bottom');
      if (c === 'git_commit') setBottomPanelTab('terminal');
  };
  const handleFileOps = { onConnectRemote: () => {}, onAddFile: () => addFile(`new_file_${Date.now()}.tsx`, ''), onAddFolder: () => {}, onUploadFile: handleFileUpload, onUploadFolder: handleFolderUpload, onInstallPackage: () => {}, onRunScript: (name: string, cmd: string) => setTerminalLogs(prev => [...prev, `> npm run ${name}`, `> ${cmd}`]) };

  const handleApplyCode = useCallback((code: string) => {
    const filenameMatch = code.match(/^\/\/ filename: (.*)/);
    if (filenameMatch) {
      addFile(filenameMatch[1].trim(), code);
    } else {
      updateFileContent(activeFileId, code);
    }
  }, [activeFileId, addFile, updateFileContent]);

  const handleGeneratePlan = async () => {
      setIsGeneratingPlan(true);
      const plan = await generateProjectPlan(project?.description || "Project", project?.type || ProjectType.REACT_WEB);
      setRoadmap(plan);
      setIsGeneratingPlan(false);
  };
  
  const handleExecutePhase = (phase: ProjectPhase) => {
      setChatInput(`Execute Phase: ${phase.title}. Goals: ${phase.goals.join(', ')}`);
      setIsChatOpen(true);
  };
  
  const handleToggleRoadmapTask = (phaseId: string, taskId: string) => {
      setRoadmap(prev => prev.map(p => p.id === phaseId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : p));
  };
  
  const handleRefreshPreview = () => {
      setPreviewSrc('');
      setTimeout(() => {
          // Trigger re-render in LivePreview via src change logic
      }, 100);
  };
  
  const handleExport = async () => {
      const zip = new JSZip();
      const addToZip = (nodes: any[], path = '') => {
          nodes.forEach(n => {
              if (n.type === 'file') zip.file(path + n.name, n.content);
              if (n.children) addToZip(n.children, path + n.name + '/');
          });
      };
      addToZip(files);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${project?.name || 'project'}.zip`; a.click();
  };

  const handleApplyAll = (codes: string[]) => {
    codes.forEach(code => handleApplyCode(code));
  };

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a project to begin</div>;

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full relative">
      {/* ... (CommandPalette, VoiceCommander) ... */}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} files={files} onOpenFile={onFileClickWrapper} onRunCommand={handleSystemCommand} />
      {showVoiceCommander && <VoiceCommander onClose={() => setShowVoiceCommander(false)} />}

      <div className="flex-1 flex overflow-hidden relative">
        {isResizing && <div className="absolute inset-0 z-[100] cursor-col-resize" />}

        <WorkspaceSidebar 
            layout={layout}
            sidebarWidth={sidebarWidth}
            activeActivity={activeActivity}
            setActiveActivity={setActiveActivity}
            onToggleSidebar={() => toggleLayout('sidebar')}
            files={files}
            activeFileId={activeFileId}
            project={project}
            remoteDirName={remoteDirName}
            onFileClick={onFileClickWrapper}
            onContextMenu={(e, id) => setContextMenu({ visible: true, x: e.clientX, y: e.clientY, fileId: id })}
            onFileOps={handleFileOps}
            commits={commits}
            currentBranch={currentBranch}
            onCommit={handleCommit}
            onSwitchBranch={() => setShowBranchMenu(true)}
            searchQuery={searchQuery}
            onSearch={handleSearch}
            searchResults={searchResults}
            onResultClick={onResultClickWrapper}
            debugVariables={debugVariables}
            breakpoints={breakpoints}
            onRemoveBreakpoint={(line) => setBreakpoints(p => p.filter(b => b !== line))}
            extensions={extensions}
            onToggleExtension={(id) => setExtensions(p => p.map(e => e.id === id ? { ...e, installed: !e.installed } : e))}
            assets={assets}
            activeAgentTask={activeAgentTask}
            onStartAgentTask={handleStartAgentTask}
        />

        {/* ... (Sidebar Resize Handle) ... */}
        {layout.showSidebar && <div className="w-2 bg-gray-900 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => handleResizeStart('sidebar', e)} />}

        {/* Main Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900 h-full" id="editor-container">
          {/* ... (Editor Tabs & Content - keeping same structure) ... */}
          <div className="flex bg-gray-900 border-b border-gray-800 overflow-x-auto scrollbar-none shrink-0">
             {openFiles.map(fileId => {
                 const file = findFileById(files, fileId);
                 if (!file) return null;
                 return (
                     <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-r border-gray-800 cursor-pointer min-w-[120px] max-w-[200px] group ${activeFileId === file.id ? 'bg-gray-800 text-primary-400 border-t-2 border-t-primary-500' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200 border-t-2 border-t-transparent'}`}><span className={`truncate ${file.gitStatus === 'modified' ? 'text-yellow-500' : ''}`}>{file.name}</span><button onClick={(e) => onCloseTab(file.id, secondaryFileId, setSecondaryFileId)} className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 text-gray-400 hover:text-white"><X size={12} /></button></div>
                 );
             })}
             <button onClick={() => setIsSplitView(p => !p)} className={`ml-auto px-3 flex items-center text-gray-500 hover:text-white border-l border-gray-800 ${isSplitView ? 'text-primary-500' : ''}`}><SplitSquareHorizontal size={14} /></button>
          </div>

          <div className="flex-1 relative min-h-0 flex">
            {/* ... (DiffEditor or CodeEditor split logic - keeping same) ... */}
            {diffFile ? <div className="absolute inset-0 z-10"><DiffEditor original={diffFile.content || ''} modified={diffFile.content + '\n// diff'} fileName={diffFile.name} onClose={() => setDiffFileId(null)} /></div> : (
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
                            />
                        ) : <div className="flex flex-col items-center justify-center h-full text-gray-500">No file open</div>}
                    </div>
                    {isSplitView && <div className="w-2 bg-gray-900 hover:bg-primary-600 cursor-col-resize z-20 hidden md:block" onMouseDown={(e) => handleResizeStart('split', e)} />}
                    {isSplitView && <div className="relative flex flex-col bg-gray-950" style={{ width: `${100 - splitRatio}%` }}>{secondaryFile && <CodeEditor code={secondaryFile.content || ''} onChange={() => {}} fileName={secondaryFile.name} />}</div>}
                </>
            )}
          </div>

          {layout.showBottom && (
            <>
                <div className="h-2 bg-gray-900 border-t border-gray-800 hover:bg-primary-600 cursor-ns-resize z-20 hidden md:block" onMouseDown={(e) => handleResizeStart('bottomPanel', e)} />
                <div className="bg-black border-t border-gray-800 flex flex-col flex-shrink-0 transition-all" style={{ height: bottomPanelHeight }}>
                    <div className="flex border-b border-gray-800"><button className="px-4 py-1 text-xs uppercase font-bold text-white border-b-2 border-primary-500">Terminal</button><div className="ml-auto px-2"><button onClick={() => toggleLayout('bottom')}><X size={14}/></button></div></div>
                    <Terminal logs={terminalLogs} onCommand={handleCommand} onAiFix={handleAiFix} />
                </div>
            </>
          )}
        </div>

        {layout.showRight && <div className="w-2 bg-gray-900 border-l border-gray-800 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => handleResizeStart('rightPanel', e)} />}

        {layout.showRight && (
            <div className="flex-shrink-0 relative bg-gray-900 border-l border-gray-800 absolute md:static inset-0 md:inset-auto z-40 md:z-0 w-full md:w-auto pointer-events-auto" style={{ width: window.innerWidth < 768 ? '100%' : rightPanelWidth, pointerEvents: isResizing ? 'none' : 'auto' }}>
                <PreviewPanel 
                    project={project!} previewSrc={previewSrc} activeTab={activeTab} setActiveTab={setActiveTab} onToggleLayout={() => toggleLayout('right')}
                    onExport={handleExport} onRefreshPreview={handleRefreshPreview} roadmap={roadmap} isGeneratingPlan={isGeneratingPlan} onGeneratePlan={handleGeneratePlan}
                    onExecutePhase={handleExecutePhase} onToggleTask={handleToggleRoadmapTask} onLog={(l) => setTerminalLogs(p => [...p, l])} files={files} onSaveFile={addFile}
                />
            </div>
        )}
      </div>

      {/* Status Bar & Chat (keeping same) */}
      <div className="h-6 bg-gray-900 border-t border-gray-800 text-gray-400 text-[10px] flex items-center px-3 justify-between select-none z-50 flex-shrink-0">
        <div className="flex items-center gap-4"><GitBranch size={10} /><span>{currentBranch}</span></div>
        <div className="flex items-center gap-4">
           <button onClick={() => setShowVoiceCommander(true)}><Mic size={10}/></button>
           <button onClick={() => toggleLayout('bottom')}><PanelBottom size={10}/></button>
           <button onClick={() => toggleLayout('right')}><Columns size={10}/></button>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="absolute bottom-12 right-6 w-[90%] md:w-96 z-50 flex flex-col gap-4 pointer-events-none max-h-[60vh]">
        {isChatOpen ? (
            <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[60vh]">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-850 border-b border-gray-700">
                    <span className="text-xs font-bold text-gray-200">Omni Assistant</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsChatOpen(false)}><Minimize2 size={14}/></button>
                        <button onClick={() => { setIsChatOpen(false); setChatHistory([]); }}><X size={14}/></button>
                    </div>
                </div>
                <div className="flex-1 flex flex-col-reverse gap-2 overflow-y-auto p-3 min-h-[150px]">
                    {chatHistory.slice().reverse().map((msg) => <MessageRenderer key={msg.id} message={msg} onApplyCode={handleApplyCode} onApplyAll={handleApplyAll} />)}
                </div>
                <div className="p-3 border-t border-gray-700 bg-gray-900/50">
                    <form onSubmit={handleChatSubmit} className="flex gap-2">
                        <input type="text" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm" placeholder="Ask Omni..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
                        <Button type="submit" disabled={isGenerating || !chatInput.trim()}><ArrowRight size={16}/></Button>
                    </form>
                </div>
            </div>
        ) : (
            <div className="flex justify-end pointer-events-auto">
                <button onClick={() => setIsChatOpen(true)} className="bg-primary-600 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all"><MessageSquare size={24} /></button>
            </div>
        )}
      </div>
    </div>
  );
};
