
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PanelBottom, Columns, Mic, GitBranch, HelpCircle } from 'lucide-react';
import { MOCK_COMMITS, MOCK_EXTENSIONS, DEFAULT_AGENTS, MOCK_SNIPPETS } from '../constants';
import { Project, ProjectType, Extension, GitCommit as GitCommitType, ProjectPhase, AgentTask, AIAgent, Snippet } from '../types';
import { CodeEditorHandle } from '../components/CodeEditor';
import { runAgentFileTask, generateProjectPlan, delegateTasks } from '../services/geminiService';
import { Button } from '../components/Button';
import JSZip from 'jszip';
import { generatePreviewHtml } from '../utils/runtime';
import { PreviewPanel } from '../components/PreviewPanel';
import { useFileSystem } from '../hooks/useFileSystem';
import { useResizable } from '../hooks/useResizable';
import { useOmniAssistant } from '../hooks/useOmniAssistant';
import { useTerminal } from '../hooks/useTerminal';
import { WorkspaceSidebar } from '../components/WorkspaceSidebar';
import { VoiceCommander } from '../components/VoiceCommander';
import { CommandPalette } from '../components/CommandPalette';
import { ContextMenu } from '../components/ContextMenu';
import { ToastContainer, ToastMessage } from '../components/Toast';
import { ConnectModal } from '../components/ConnectModal';
import { NewItemModal } from '../components/NewItemModal';
import { RenameModal } from '../components/RenameModal';
import { InstallPackageModal } from '../components/InstallPackageModal';
import { ShortcutsModal } from '../components/ShortcutsModal';
import { logActivity } from '../utils/activityLogger';
import { ChatWidget } from '../components/ChatWidget';
import { EditorArea } from '../components/EditorArea';

interface WorkspaceProps {
  project: Project | null;
  onDeleteProject?: (e: React.MouseEvent, id: string) => void;
  onUpdateProject?: (p: Project) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ project, onDeleteProject, onUpdateProject }) => {
  const { 
      files, setFiles, deletedFiles, activeFileId, setActiveFileId, openFiles, setOpenFiles, 
      remoteDirName, setRemoteDirName, updateFileContent, addFile, addDirectory, addPackage, findFileById, getAllFiles,
      handleFileClick: onFileClick, handleCloseTab: onCloseTab,
      deleteFile, renameFile, duplicateFile, restoreFile, permanentlyDeleteFile, emptyTrash
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
  
  const [previewDiff, setPreviewDiff] = useState<{ original: string, modified: string, fileName: string } | null>(null);

  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture' | 'settings'>(() => (localStorage.getItem('omni_active_preview_tab') as any) || 'preview');
  
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
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  
  const {
      chatInput, setChatInput,
      chatHistory, setChatHistory,
      isGenerating,
      isChatOpen, setIsChatOpen,
      triggerGeneration,
      handleChatSubmit,
      handleCodeAction,
      handleAutoFix
  } = useOmniAssistant({
      projectType: project?.type || ProjectType.REACT_WEB,
      files,
      activeFile,
      activeModel,
      editorSelection,
      setEditorSelection
  });

  const { handleCommand: baseHandleCommand, handleAiFix } = useTerminal({
      files, setFiles, activeFileId, projectType: project?.type || ProjectType.REACT_WEB, addFile, onLog: (msg) => setTerminalLogs(prev => [...prev, msg])
  });

  const handleCommand = async (input: string) => {
      if (input.startsWith('git commit')) {
          const match = input.match(/-m\s+["'](.+)["']/);
          const message = match ? match[1] : 'Update files';
          setCommits(prev => [...prev, { id: Date.now().toString(), message, author: 'You', date: 'Now', hash: Math.random().toString(36).substr(2, 7) }]);
          setTerminalLogs(prev => [...prev, `> ${input}`, `[${currentBranch} ${Math.random().toString(36).substr(2, 7)}] ${message}`]);
          addToast('success', 'Changes committed.');
          if(project) logActivity('commit', `Commit: ${message}`, `You committed changes to ${currentBranch}`, project.id);
      } else {
          await baseHandleCommand(input);
      }
  };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [debugVariables, setDebugVariables] = useState<{name: string, value: string}[]>([]);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);

  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask | null>(null);
  const [activeAgent, setActiveAgent] = useState<AIAgent | null>(null);
  const abortAgentRef = useRef(false);

  const [activeActivity, setActiveActivity] = useState<'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS' | 'SNIPPETS'>('EXPLORER');
  const [layout, setLayout] = useState({ showSidebar: window.innerWidth >= 768, showBottom: true, showRight: window.innerWidth >= 1024 });
  const [isRightPanelMaximized, setIsRightPanelMaximized] = useState(false);

  const [assets, setAssets] = useState<{type: 'image' | 'video' | 'audio', url: string, name: string}[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showVoiceCommander, setShowVoiceCommander] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>({ visible: false, x: 0, y: 0, fileId: null, isTrash: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newItemModal, setNewItemModal] = useState<{isOpen: boolean, type: 'file' | 'folder'}>({ isOpen: false, type: 'file' });
  const [renameModal, setRenameModal] = useState<{isOpen: boolean, currentName: string, fileId: string | null}>({ isOpen: false, currentName: '', fileId: null });
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
      const saved = localStorage.getItem('omni_snippets');
      return saved ? JSON.parse(saved) : MOCK_SNIPPETS;
  });

  useEffect(() => {
      localStorage.setItem('omni_snippets', JSON.stringify(snippets));
  }, [snippets]);

  // Snippet Handlers
  const handleAddSnippet = () => {
      if (!editorSelection) { addToast('error', 'Select code first'); return; }
      const name = prompt("Snippet Name:");
      if (name) setSnippets(prev => [...prev, { id: `snip-${Date.now()}`, name, language: activeFile?.name.split('.').pop() || 'txt', code: editorSelection }]);
  };
  const handleDeleteSnippet = (id: string) => { if(confirm('Delete?')) setSnippets(prev => prev.filter(s => s.id !== id)); };
  const handleInsertSnippet = (code: string) => { if(activeFileId) { updateFileContent(activeFileId, (activeFile?.content || '') + '\n' + code); addToast('success', 'Inserted'); } };

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
      setToasts(prev => [...prev, { id: Date.now().toString(), type, message }]);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

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

  // Real-time Search
  useEffect(() => {
      if (!searchQuery) { setSearchResults([]); return; }
      const results: any[] = [];
      const all = getAllFiles(files);
      const lowerQuery = searchQuery.toLowerCase();
      for (const file of all) {
          if (file.node.content) {
              const lines = file.node.content.split('\n');
              lines.forEach((line, idx) => {
                  if (line.toLowerCase().includes(lowerQuery)) {
                      results.push({ fileId: file.node.id, fileName: file.node.name, line: idx + 1, text: line.trim() });
                  }
              });
          }
      }
      setSearchResults(results);
  }, [searchQuery, files]);

  const handleReplace = (fileId: string, line: number, oldText: string, newText: string) => {
      const file = findFileById(files, fileId);
      if (file && file.content) {
          const lines = file.content.split('\n');
          if (lines[line - 1]) {
              lines[line - 1] = lines[line - 1].replace(oldText, newText);
              updateFileContent(fileId, lines.join('\n'));
              addToast('success', 'Replaced text');
          }
      }
  };

  const toggleLayout = useCallback((p: any) => { 
      setLayout(prev => ({...prev, [p === 'sidebar' ? 'showSidebar' : p === 'bottom' ? 'showBottom' : 'showRight']: !prev[p === 'sidebar' ? 'showSidebar' : p === 'bottom' ? 'showBottom' : 'showRight']}));
  }, []);

  const toggleMaximizeRight = useCallback(() => { setIsRightPanelMaximized(prev => !prev); }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          if (e.defaultPrevented) return;
          if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); addToast('success', 'File saved.'); }
          if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'k')) { e.preventDefault(); setShowCommandPalette(prev => !prev); }
          if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); toggleLayout('sidebar'); }
          if ((e.ctrlKey || e.metaKey) && e.key === 'j') { e.preventDefault(); toggleLayout('bottom'); }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleLayout]);

  const handleResizeStart = (dir: any, e: any) => {
      setIsResizing(true);
      startResizing(dir, e);
      const onMouseUp = () => { setIsResizing(false); window.removeEventListener('mouseup', onMouseUp); };
      window.addEventListener('mouseup', onMouseUp);
  };

  // --- Agent Runner ---
  useEffect(() => {
      if (!activeAgentTask || activeAgentTask.status !== 'running' || !activeAgent) return;
      const run = async () => {
          const allFiles = getAllFiles(files);
          const relevantFiles = allFiles.filter(f => f.node.name.match(/\.(tsx|ts|js|jsx)$/));
          
          if (!activeAgentTask.fileList || activeAgentTask.fileList.length === 0) {
              setActiveAgentTask(prev => prev ? { ...prev, totalFiles: relevantFiles.length, fileList: relevantFiles.map(f => ({ name: f.node.name, status: 'pending' })) } : null);
          }
          abortAgentRef.current = false;
          let processedCount = 0;
          for (let i = 0; i < relevantFiles.length; i++) {
              if (abortAgentRef.current) { setActiveAgentTask(prev => prev ? { ...prev, status: 'cancelled' } : null); return; }
              const file = relevantFiles[i];
              setActiveAgentTask(prev => { if (!prev) return null; const newList = prev.fileList?.map(f => f.name === file.node.name ? { ...f, status: 'processing' as const } : f) || []; return { ...prev, currentFile: file.node.name, fileList: newList }; });
              await runAgentFileTask(activeAgent, file.node.name, file.node.content || '');
              processedCount++;
              setActiveAgentTask(prev => { if (!prev) return null; const newList = prev.fileList?.map(f => f.name === file.node.name ? { ...f, status: 'done' as const } : f) || []; return { ...prev, processedFiles: processedCount, fileList: newList }; });
              await new Promise(r => setTimeout(r, 500));
          }
          setActiveAgentTask(prev => prev ? { ...prev, status: 'completed' } : null);
          setActiveAgent(null);
          addToast('success', 'Agent task completed!');
      };
      run();
  }, [activeAgentTask?.id]);

  const handleStartAgentTask = (agent: AIAgent, type: AgentTask['type']) => {
      setActiveAgent(agent);
      setActiveAgentTask({ id: `task-${Date.now()}`, type, name: `${type} run by ${agent.name}`, status: 'running', totalFiles: 0, processedFiles: 0, logs: [], fileList: [] });
      addToast('info', `Started ${type}`);
  };

  useEffect(() => {
      const handleResize = () => {
          const isMobile = window.innerWidth < 768;
          setLayout(prev => ({ ...prev, showSidebar: !isMobile && prev.showSidebar, showRight: window.innerWidth >= 1024 && prev.showRight }));
          if (isMobile) setIsChatOpen(false);
      };
      window.addEventListener('resize', handleResize);
      handleResize();
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      if (project) {
          const code = findFileById(files, activeFileId)?.content || '';
          setPreviewSrc(generatePreviewHtml(code, project.type === ProjectType.REACT_NATIVE));
      }
  }, [activeFileId, files, project]);

  const onFileClickWrapper = useCallback((id: string) => onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId), [isSplitView, secondaryFileId, onFileClick]);
  const onResultClickWrapper = useCallback((id: string, line: number) => { onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId); if (editorRef.current) editorRef.current.scrollToLine(line); }, [isSplitView, secondaryFileId, onFileClick]);

  const handleApplyCode = useCallback((code: string) => {
    const filenameMatch = code.match(/^\/\/ filename: (.*)/i) || code.match(/^\/\/ filename:(.*)/i);
    if (filenameMatch) {
      addFile(filenameMatch[1].trim(), code);
      addToast('success', `Applied to ${filenameMatch[1].trim()}`);
    } else {
      updateFileContent(activeFileId, code);
      addToast('success', 'Applied to active file');
    }
  }, [activeFileId, addFile, updateFileContent]);

  const handleCompareCode = (generatedCode: string) => {
      if (!activeFile) { addToast('error', 'No active file'); return; }
      setPreviewDiff({ original: activeFile.content || '', modified: generatedCode, fileName: activeFile.name });
  };

  const handleGeneratePlan = async () => {
      setIsGeneratingPlan(true);
      const plan = await generateProjectPlan(project?.description || "Project", project?.type || ProjectType.REACT_WEB);
      setRoadmap(plan);
      setIsGeneratingPlan(false);
      addToast('success', 'Roadmap Generated');
  };
  
  const handleExecutePhase = async (phase: ProjectPhase) => {
      const savedAgents = localStorage.getItem('omni_agents');
      const agents: AIAgent[] = savedAgents ? JSON.parse(savedAgents) : DEFAULT_AGENTS;
      const manager = agents.find(a => a.isManager);
      if (manager) {
          setIsChatOpen(true);
          setChatInput(`[Manager] Planning phase "${phase.title}"...`);
          const { assignments } = await delegateTasks(phase, agents);
          if (assignments.length > 0) {
              const taskList = assignments.map(a => `- **${a.agentName}**: ${a.taskDescription}`).join('\n');
              setChatHistory(prev => [...prev, { id: `plan-${Date.now()}`, role: 'model', text: `Team Plan:\n\n${taskList}`, timestamp: Date.now() }]);
          } else {
              setChatInput(`Execute Phase: ${phase.title}`);
              triggerGeneration(`Execute Phase: ${phase.title}`);
          }
      } else {
          setChatInput(`Execute Phase: ${phase.title}`);
          setIsChatOpen(true);
          triggerGeneration(`Execute Phase: ${phase.title}`);
      }
  };
  
  const handleExport = async () => {
      const zip = new JSZip();
      const addToZip = (nodes: any[], path = '') => { nodes.forEach(n => { if (n.type === 'file') zip.file(path + n.name, n.content); if (n.children) addToZip(n.children, path + n.name + '/'); }); };
      addToZip(files);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${project?.name || 'project'}.zip`; a.click();
      addToast('success', 'Exported successfully');
  };

  const handleRenameSubmit = (newName: string) => { if (renameModal.fileId) { renameFile(renameModal.fileId, newName); addToast('success', 'Renamed'); } };
  const handleCreateItem = (name: string) => { if (newItemModal.type === 'file') addFile(name, '// New file'); else addDirectory(name); addToast('success', `Created ${name}`); };

  const handleRunCommand = (cmd: string) => {
      if (cmd === 'toggle_sidebar') toggleLayout('sidebar');
      if (cmd === 'toggle_terminal') toggleLayout('bottom');
      if (cmd === 'export_project') handleExport();
      if (cmd === 'git_commit') { /* Trigger commit UI logic or modal if needed */ addToast('info', 'Use Source Control panel to commit.'); }
      if (cmd === 'open_settings') setActiveTab('settings');
  };

  const handleDeleteWrapper = (id: string) => {
      if (onDeleteProject) {
          // Mock event for interface compatibility
          onDeleteProject({} as React.MouseEvent, id);
      }
  };

  const handleDeploymentComplete = (url: string) => {
      if (project && onUpdateProject) {
          const updated = { ...project, deploymentStatus: 'live' as const, deploymentUrl: url };
          onUpdateProject(updated);
          addToast('success', 'Project status updated to Live');
      }
  };

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a project to begin</div>;

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} onConnectLocal={() => {/* impl */}} onConnectGitHub={async (url) => {/* impl */}} />}
      <NewItemModal isOpen={newItemModal.isOpen} type={newItemModal.type} onClose={() => setNewItemModal({ ...newItemModal, isOpen: false })} onCreate={handleCreateItem} />
      <RenameModal isOpen={renameModal.isOpen} currentName={renameModal.currentName} onClose={() => setRenameModal({ ...renameModal, isOpen: false })} onRename={handleRenameSubmit} />
      <InstallPackageModal isOpen={pkgModalOpen} onClose={() => setPkgModalOpen(false)} onInstall={(name, isDev) => addPackage(name, isDev)} />
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} files={files} onOpenFile={onFileClickWrapper} onRunCommand={handleRunCommand} />
      {showVoiceCommander && <VoiceCommander onClose={() => setShowVoiceCommander(false)} />}
      
      {contextMenu.visible && (
          <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu({ ...contextMenu, visible: false })} onRename={() => { if(contextMenu.fileId) { const f = findFileById(files, contextMenu.fileId); if(f) setRenameModal({isOpen:true, currentName: f.name, fileId: f.id}); setContextMenu({...contextMenu, visible:false}); } }} onDelete={() => { deleteFile(contextMenu.fileId); setContextMenu({...contextMenu, visible:false}); }} onDuplicate={() => { duplicateFile(contextMenu.fileId); setContextMenu({...contextMenu, visible:false}); }} onExplain={() => {/* impl */}} isTrash={contextMenu.isTrash} onRestore={() => restoreFile(contextMenu.fileId)} onPermanentDelete={() => permanentlyDeleteFile(contextMenu.fileId)} />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {isResizing && <div className="absolute inset-0 z-[100] cursor-col-resize" />}

        {!isRightPanelMaximized && (
            <WorkspaceSidebar 
                layout={layout} sidebarWidth={sidebarWidth} activeActivity={activeActivity} setActiveActivity={setActiveActivity} onToggleSidebar={() => toggleLayout('sidebar')}
                files={files} activeFileId={activeFileId} project={project} remoteDirName={remoteDirName} deletedFiles={deletedFiles}
                onFileClick={onFileClickWrapper} onContextMenu={(e, id, isTrash) => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, fileId: id, isTrash }); }}
                onFileOps={{ onConnectRemote: () => setShowConnectModal(true), onAddFile: () => setNewItemModal({ isOpen: true, type: 'file' }), onAddFolder: () => setNewItemModal({ isOpen: true, type: 'folder' }), onUploadFile: (e) => {/* impl */}, onUploadFolder: (e) => {/* impl */}, onInstallPackage: () => setPkgModalOpen(true), onRunScript: (n, c) => {/* impl */}, onEmptyTrash: emptyTrash }}
                commits={commits} currentBranch={currentBranch} onCommit={(m) => {/* impl */}} onSwitchBranch={() => setShowBranchMenu(true)}
                searchQuery={searchQuery} onSearch={setSearchQuery} searchResults={searchResults} onResultClick={onResultClickWrapper}
                debugVariables={debugVariables} breakpoints={breakpoints} onRemoveBreakpoint={(l) => setBreakpoints(p => p.filter(b => b !== l))}
                extensions={extensions} onToggleExtension={(id) => setExtensions(p => p.map(e => e.id === id ? { ...e, installed: !e.installed } : e))}
                assets={assets} activeAgentTask={activeAgentTask} onStartAgentTask={handleStartAgentTask} onCancelAgentTask={() => { abortAgentRef.current = true; }}
                snippets={snippets} onAddSnippet={handleAddSnippet} onDeleteSnippet={handleDeleteSnippet} onInsertSnippet={handleInsertSnippet}
            />
        )}

        {!isRightPanelMaximized && layout.showSidebar && <div className="w-2 bg-gray-900 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => handleResizeStart('sidebar', e)} />}

        {!isRightPanelMaximized && (
            <EditorArea 
                files={files} activeFileId={activeFileId} setActiveFileId={setActiveFileId} openFiles={openFiles} onCloseTab={onCloseTab}
                isSplitView={isSplitView} setIsSplitView={setIsSplitView} splitRatio={splitRatio} secondaryFileId={secondaryFileId} setSecondaryFileId={setSecondaryFileId}
                diffFileId={diffFileId} setDiffFileId={setDiffFileId} previewDiff={previewDiff} setPreviewDiff={setPreviewDiff}
                activeFile={activeFile} secondaryFile={secondaryFile} diffFile={diffFile}
                editorRef={editorRef} updateFileContent={updateFileContent} editorConfig={editorConfig} handleCodeAction={handleCodeAction} setEditorSelection={setEditorSelection}
                breakpoints={breakpoints} setBreakpoints={setBreakpoints} setCursorPos={setCursorPos} addToast={addToast}
                layout={layout} toggleLayout={toggleLayout} bottomPanelHeight={bottomPanelHeight} handleResizeStart={handleResizeStart}
                terminalLogs={terminalLogs} onCommand={handleCommand} onAiFix={handleAiFix}
            />
        )}

        {!isRightPanelMaximized && layout.showRight && <div className="w-2 bg-gray-900 border-l border-gray-800 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => handleResizeStart('rightPanel', e)} />}

        {(layout.showRight || isRightPanelMaximized) && (
            <div 
                className={`flex-shrink-0 relative bg-gray-900 border-l border-gray-800 absolute md:static inset-0 md:inset-auto z-40 md:z-0 w-full md:w-auto pointer-events-auto transition-all duration-300`} 
                style={{ 
                    width: isRightPanelMaximized 
                        ? '100%' 
                        : window.innerWidth < 768 ? '100%' : rightPanelWidth, 
                    pointerEvents: isResizing ? 'none' : 'auto' 
                }}
            >
                <PreviewPanel 
                    project={project!} previewSrc={previewSrc} activeTab={activeTab} setActiveTab={setActiveTab} onToggleLayout={() => toggleLayout('right')}
                    onExport={handleExport} onRefreshPreview={() => {/* impl */}} roadmap={roadmap} isGeneratingPlan={isGeneratingPlan} onGeneratePlan={handleGeneratePlan}
                    onExecutePhase={handleExecutePhase} onToggleTask={() => {/* impl */}} onLog={(l) => setTerminalLogs(p => [...p, l])} files={files} onSaveFile={addFile}
                    isMaximized={isRightPanelMaximized} onToggleMaximize={toggleMaximizeRight} onUpdateProject={onUpdateProject} onDeleteProject={handleDeleteWrapper}
                    onDeploymentComplete={handleDeploymentComplete}
                />
            </div>
        )}
      </div>

      <div className="h-6 bg-gray-900 border-t border-gray-800 text-gray-400 text-[10px] flex items-center px-3 justify-between select-none z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><GitBranch size={10} /><span>{currentBranch}</span></div>
            <div className="hidden md:block w-px h-3 bg-gray-700"></div>
            <div className="hidden md:block">Ln {cursorPos.line}, Col {cursorPos.col}</div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => setShowShortcuts(true)} title="Shortcuts (?)"><HelpCircle size={10}/></button>
           <button onClick={() => setShowVoiceCommander(true)} title="Voice Command"><Mic size={10}/></button>
           <button onClick={() => toggleLayout('bottom')} title="Toggle Terminal (Ctrl+J)"><PanelBottom size={10}/></button>
           <button onClick={() => toggleLayout('right')} title="Toggle Sidebar (Ctrl+B)"><Columns size={10}/></button>
        </div>
      </div>

      <ChatWidget 
          isOpen={isChatOpen} setIsOpen={setIsChatOpen}
          history={chatHistory} setHistory={setChatHistory}
          input={chatInput} setInput={setChatInput}
          isGenerating={isGenerating} onSubmit={handleChatSubmit}
          onApplyCode={handleApplyCode} onCompareCode={handleCompareCode}
          onApplyAll={(codes) => codes.forEach(c => handleApplyCode(c))}
          onAutoFix={handleAutoFix}
      />
    </div>
  );
};
