
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PanelBottom, Columns, Mic, GitBranch, HelpCircle, Layout } from 'lucide-react';
import { MOCK_COMMITS, MOCK_EXTENSIONS, MOCK_SNIPPETS } from '../constants';
import { Project, ProjectType, Extension, GitCommit as GitCommitType, Snippet } from '../types';
import { CodeEditorHandle } from '../components/CodeEditor';
import JSZip from 'jszip';
import { generatePreviewHtml } from '../utils/runtime';
import { PreviewPanel } from '../components/PreviewPanel';
import { useFileSystem } from '../hooks/useFileSystem';
import { useResizable } from '../hooks/useResizable';
import { useOmniAssistant } from '../hooks/useOmniAssistant';
import { useTerminal } from '../hooks/useTerminal';
import { useAgentOrchestrator } from '../hooks/useAgentOrchestrator';
import { useDebounce } from '../hooks/useDebounce';
import { useTesting } from '../hooks/useTesting';
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
import { getFilePath } from '../utils/fileHelpers';

interface WorkspaceProps {
  project: Project | null;
  onDeleteProject?: (e: React.MouseEvent, id: string) => void;
  onUpdateProject?: (p: Project) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ project, onDeleteProject, onUpdateProject }) => {
  // --- FILE SYSTEM HOOK ---
  const { 
      files, filesRef, setFiles, deletedFiles, activeFileId, setActiveFileId, openFiles, setOpenFiles, 
      remoteDirName, setRemoteDirName, updateFileContent, addFile, addDirectory, addPackage, findFileById, getAllFiles,
      handleFileClick: onFileClick, handleCloseTab: onCloseTab, replaceTextInProject,
      deleteFile, renameFile, duplicateFile, restoreFile, permanentlyDeleteFile, emptyTrash, toggleFilePin, moveNode, toggleDirectory
  } = useFileSystem(project);
  
  // --- LAYOUT & RESIZING ---
  const { 
      sidebarWidth, rightPanelWidth, bottomPanelHeight, splitRatio, startResizing 
  } = useResizable();

  const [isResizing, setIsResizing] = useState(false);
  const [layout, setLayout] = useState({ showSidebar: window.innerWidth >= 768, showBottom: true, showRight: window.innerWidth >= 1024 });
  const [isRightPanelMaximized, setIsRightPanelMaximized] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- EDITOR STATE ---
  const [isSplitView, setIsSplitView] = useState(false);
  const [secondaryFileId, setSecondaryFileId] = useState<string | null>(null);
  const activeFile = findFileById(files, activeFileId);
  const secondaryFile = secondaryFileId ? findFileById(files, secondaryFileId) : undefined;
  
  const [diffFileId, setDiffFileId] = useState<string | null>(null);
  const diffFile = diffFileId ? findFileById(files, diffFileId) : undefined;
  const [previewDiff, setPreviewDiff] = useState<{ original: string, modified: string, fileName: string } | null>(null);

  const editorRef = useRef<CodeEditorHandle>(null);
  const [editorSelection, setEditorSelection] = useState('');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [editorConfig, setEditorConfig] = useState<any>({});

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture' | 'settings'>('preview');
  const [activeActivity, setActiveActivity] = useState<'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS' | 'SNIPPETS'>('EXPLORER');
  
  // Persisted Logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>(() => {
      if (project?.id) {
          const saved = localStorage.getItem(`omni_terminal_${project.id}`);
          return saved ? JSON.parse(saved) : ['> Omni-Studio initialized.', '> Ready.'];
      }
      return ['> Omni-Studio initialized.', '> Ready.'];
  });

  useEffect(() => {
      if (project?.id) {
          localStorage.setItem(`omni_terminal_${project.id}`, JSON.stringify(terminalLogs.slice(-200))); 
      }
  }, [terminalLogs, project?.id]);

  const [liveConsoleLogs, setLiveConsoleLogs] = useState<string[]>([]);
  const [debugVariables, setDebugVariables] = useState<{name: string, value: string}[]>([]);
  
  // --- SEARCH & GIT ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [commits, setCommits] = useState<GitCommitType[]>(MOCK_COMMITS);
  const [currentBranch, setCurrentBranch] = useState('main');

  // --- MODALS ---
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showVoiceCommander, setShowVoiceCommander] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Modified context menu to include isDirectory check
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, fileId: string | null, isTrash?: boolean, isDirectory?: boolean, path?: string }>({ visible: false, x: 0, y: 0, fileId: null, isTrash: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newItemModal, setNewItemModal] = useState<{isOpen: boolean, type: 'file' | 'folder', path?: string}>({ isOpen: false, type: 'file' });
  const [renameModal, setRenameModal] = useState<{isOpen: boolean, currentName: string, fileId: string | null}>({ isOpen: false, currentName: '', fileId: null });
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
      const saved = localStorage.getItem('omni_snippets');
      return saved ? JSON.parse(saved) : MOCK_SNIPPETS;
  });

  const [assets, setAssets] = useState<any[]>([]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { id, type, message }]);
  }, []);
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // --- AI ASSISTANT ---
  const activeModel = localStorage.getItem('omni_active_model') || 'Gemini 2.5 Flash (Fastest)';
  
  const {
      chatInput, setChatInput, chatHistory, setChatHistory, isGenerating, 
      isChatOpen, setIsChatOpen, triggerGeneration, handleChatSubmit, submitQuery,
      handleCodeAction, handleAutoFix, addSystemMessage
  } = useOmniAssistant({ 
      projectId: project?.id || 'default',
      projectType: project?.type || ProjectType.REACT_WEB, 
      files, activeFile, activeModel, editorSelection, setEditorSelection,
      onStartAgentTask: (task) => {
          setActiveAgentTask({
              id: `chat-task-${Date.now()}`,
              type: 'custom',
              name: task,
              status: 'running',
              totalFiles: 0,
              processedFiles: 0,
              logs: [`Chat initialized task: ${task}`],
              fileList: []
          });
          addToast('info', 'Agent Team Activated');
      }
  });

  // --- TESTING & TERMINAL HOOKS ---
  const { 
      testResults, isRunningTests, runTests 
  } = useTesting({ 
      files, 
      onLog: (msg) => setTerminalLogs(prev => [...prev, msg]) 
  });

  const { handleCommand: baseHandleCommand, handleAiFix } = useTerminal({
      files, setFiles, activeFileId, projectType: project?.type || ProjectType.REACT_WEB, addFile, addPackage,
      onLog: (msg) => setTerminalLogs(prev => [...prev, msg]),
      onRequestFix: (errorMsg) => {
          const activeFileNode = findFileById(files, activeFileId);
          if (setActiveAgentTask) {
              setActiveAgentTask({
                  id: `fix-${Date.now()}`,
                  type: 'custom',
                  name: `Fix Error: ${errorMsg.substring(0, 50)}...`,
                  status: 'running',
                  totalFiles: 1,
                  processedFiles: 0,
                  logs: [`Initializing fix for: ${errorMsg}`],
                  fileList: activeFileNode ? [{ name: activeFileNode.name, status: 'pending' }] : []
              });
              addToast('info', 'Agent started debugging...');
          }
      }
  });

  const handleCommand = async (input: string) => {
      if (input.startsWith('git commit')) {
          const match = input.match(/-m\s+["'](.+)["']/);
          const message = match ? match[1] : 'Update files';
          setCommits(prev => [{ id: Date.now().toString(), message, author: 'You', date: 'Now', hash: Math.random().toString(36).substr(2, 7) }, ...prev]);
          setTerminalLogs(prev => [...prev, `> ${input}`, `[${currentBranch}] ${message}`]);
          addToast('success', 'Changes committed.');
          if(project) logActivity('commit', `Commit: ${message}`, `You committed changes to ${currentBranch}`, project.id);
      } else {
          await baseHandleCommand(input);
      }
  };

  // --- AGENT ORCHESTRATOR ---
  const [roadmap, setRoadmap] = useState<any[]>(() => {
      if (project?.id) {
          const saved = localStorage.getItem(`omni_roadmap_${project.id}`);
          return saved ? JSON.parse(saved) : [];
      }
      return [];
  });

  useEffect(() => {
      if (project?.id) {
          localStorage.setItem(`omni_roadmap_${project.id}`, JSON.stringify(roadmap));
      }
  }, [roadmap, project?.id]);
  
  const {
      activeAgentTask,
      handleStartAgentTask,
      handleCancelAgentTask,
      handleExecutePhase,
      handleGeneratePlan,
      isGeneratingPlan,
      revertLastAgentRun,
      setActiveAgentTask,
      isWorking,
      taskHistory,
      activeAgent
  } = useAgentOrchestrator({
      filesRef,
      updateFileContent,
      addFile,
      setFiles,
      deleteFile,
      addSystemMessage: (msg) => setChatHistory(prev => [...prev, { id: `sys-${Date.now()}`, role: 'model', text: `**Update:** ${msg}`, timestamp: Date.now() }]),
      setTerminalLogs,
      terminalLogs,
      liveConsoleLogs,
      roadmap,
      setRoadmap,
      debugVariables,
      projectDescription: project?.description || '',
      projectType: project?.type || ProjectType.REACT_WEB,
      projectRules: project?.aiRules,
      addToast,
      setChatInput: () => {}, 
      setIsChatOpen: () => {},
      setChatHistory: () => {}, 
      triggerGeneration: () => {}, 
      runTests,
      handleCommand
  });

  // --- ENV VARS & PREVIEW ---
  const envVars = useMemo(() => {
      if(!project) return {};
      const saved = localStorage.getItem(`omni_env_${project.id}`);
      if (!saved) return {};
      try {
          const vars = JSON.parse(saved);
          return vars.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
      } catch { return {}; }
  }, [project?.id]);

  const debouncedFiles = useDebounce(files, 1000);
  
  const previewSrc = useMemo(() => {
      if (!project) return '';
      const activeCode = findFileById(debouncedFiles, activeFileId)?.content || '';
      const activePath = getFilePath(debouncedFiles, activeFileId) || undefined;
      const cacheBust = refreshTrigger; 
      
      return generatePreviewHtml(
          activeCode, 
          project.type === ProjectType.REACT_NATIVE || project.type === ProjectType.IOS_APP || project.type === ProjectType.ANDROID_APP, 
          debouncedFiles,
          activePath,
          envVars 
      );
  }, [activeFileId, debouncedFiles, project, envVars, refreshTrigger]);

  // --- HANDLERS ---
  const handleToggleRoadmapTask = (phaseId: string, taskId: string) => {
      setRoadmap(prev => prev.map(p => {
          if (p.id === phaseId) {
              return { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) };
          }
          return p;
      }));
  };

  const handleRefreshPreview = () => {
      setRefreshTrigger(prev => prev + 1);
      addToast('info', 'Preview Refreshed');
  };

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
  }, []);

  useEffect(() => {
      if (!searchQuery) { setSearchResults([]); return; }
      const results: any[] = [];
      const all = getAllFiles(files);
      const lower = searchQuery.toLowerCase();
      all.forEach(f => {
          if (f.node.content) {
              f.node.content.split('\n').forEach((line, i) => {
                  if (line.toLowerCase().includes(lower)) results.push({ fileId: f.node.id, fileName: f.node.name, line: i + 1, text: line.trim() });
              });
          }
      });
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

  const handleReplaceAll = (searchText: string, newText: string) => {
      const count = replaceTextInProject(searchText, newText);
      addToast('success', `Replaced ${count} occurrences across project.`);
  };

  useEffect(() => {
    const loadAssets = () => {
        try {
            const posts = JSON.parse(localStorage.getItem('omni_social_posts') || '[]');
            const tracks = JSON.parse(localStorage.getItem('omni_audio_tracks') || '[]');
            const newAssets: any[] = [];
            posts.forEach((p: any) => {
                p.scenes?.forEach((s: any) => {
                    if (s.imageUrl) newAssets.push({ id: s.id, type: 'image', url: s.imageUrl, name: `Img: ${s.description?.substring(0, 10)}` });
                    if (s.videoUrl) newAssets.push({ id: s.id, type: 'video', url: s.videoUrl, name: `Vid: ${s.description?.substring(0, 10)}` });
                });
            });
            tracks.forEach((t: any) => {
                if (t.audioUrl) newAssets.push({ id: t.id, type: 'audio', url: t.audioUrl, name: t.name });
            });
            setAssets(newAssets);
        } catch (e) { console.error("Failed to load assets", e); }
    };
    loadAssets();
    window.addEventListener('omniAssetsUpdated', loadAssets);
    return () => window.removeEventListener('omniAssetsUpdated', loadAssets);
  }, []);

  const toggleLayout = (p: 'sidebar' | 'bottom' | 'right') => {
      setLayout(prev => ({...prev, [p === 'sidebar' ? 'showSidebar' : p === 'bottom' ? 'showBottom' : 'showRight']: !prev[p === 'sidebar' ? 'showSidebar' : p === 'bottom' ? 'showBottom' : 'showRight']}));
  };

  const handleResizeStart = (dir: any, e: any) => {
      setIsResizing(true);
      startResizing(dir, e);
      const onMouseUp = () => { setIsResizing(false); window.removeEventListener('mouseup', onMouseUp); };
      window.addEventListener('mouseup', onMouseUp);
  };

  const onFileClickWrapper = useCallback((id: string) => onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId), [isSplitView, secondaryFileId, onFileClick]);
  
  const handleApplyCode = useCallback((code: string) => {
    const filenameMatch = code.match(/^\/\/ filename: (.*)/i);
    if (filenameMatch) {
      addFile(filenameMatch[1].trim(), code);
      addToast('success', `Applied to ${filenameMatch[1].trim()}`);
    } else {
      updateFileContent(activeFileId, code);
      addToast('success', 'Applied to active file');
    }
  }, [activeFileId, addFile, updateFileContent]);

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
  
  const handleCreateItem = (name: string) => { 
      const path = newItemModal.path ? `${newItemModal.path}/${name}` : name;
      if (newItemModal.type === 'file') addFile(path, '// New file'); 
      else addDirectory(path); 
      addToast('success', `Created ${name}`); 
  };

  const handleRunCommand = (cmd: string) => {
      if (cmd === 'toggle_sidebar') toggleLayout('sidebar');
      if (cmd === 'toggle_terminal') toggleLayout('bottom');
      if (cmd === 'export_project') handleExport();
      if (cmd === 'git_commit') { handleCommand('git commit -m "Update"'); }
      if (cmd === 'open_settings') setActiveTab('settings');
      if (cmd === 'format_document' && activeFile && activeFile.content) {
          import('../utils/formatCode').then(({ formatCode }) => {
              if (activeFile.content) {
                  const formatted = formatCode(activeFile.content);
                  updateFileContent(activeFile.id, formatted);
                  addToast('success', 'Document Formatted');
              }
          });
      }
  };

  const handleDeleteWrapper = (id: string) => { if (onDeleteProject) onDeleteProject({ stopPropagation: () => {} } as React.MouseEvent, id); };

  const handleDeploymentComplete = (url: string) => {
      if (project && onUpdateProject) {
          const updated = { ...project, deploymentStatus: 'live' as const, deploymentUrl: url };
          onUpdateProject(updated);
          addToast('success', 'Deployed to Live');
      }
  };

  const handleConnectGitHub = async (url: string) => {
      addToast('info', 'Fetching repo...');
      setTimeout(() => addToast('success', 'Imported from GitHub'), 1000);
  };

  const handleConnectLocal = async () => { addToast('info', 'Local file system connected'); };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;
      Array.from(fileList).forEach((file: File) => {
          const reader = new FileReader();
          reader.onload = (ev) => { addFile(file.name, ev.target?.result as string); };
          reader.readAsText(file);
      });
      addToast('success', `Uploaded ${fileList.length} files`);
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList) return;
      Array.from(fileList).forEach((file: any) => {
          const path = file.webkitRelativePath;
          const reader = new FileReader();
          reader.onload = (ev) => { addFile(path, ev.target?.result as string); };
          reader.readAsText(file);
      });
      addToast('success', 'Folder uploaded');
  };

  const handleRunScript = (name: string, cmd: string) => {
      handleCommand(`npm run ${name}`);
      setLayout(p => ({ ...p, showBottom: true }));
  };

  const handleCommit = (message: string) => {
      const newCommit = { id: Date.now().toString(), message, author: 'You', date: 'Now', hash: Math.random().toString(36).substr(2, 7) };
      setCommits(prev => [newCommit, ...prev]);
      if (project) logActivity('commit', `Commit: ${message}`, `You committed changes`, project.id);
      addToast('success', 'Committed');
  };

  const handleChatSubmitWrapper = (e: React.FormEvent) => {
      if (chatInput === '[Revert Changes]') { revertLastAgentRun(); setChatInput(''); return; }
      handleChatSubmit(e);
  };

  const handleInsertAsset = (asset: { type: string, url: string }) => {
      if (!editorRef.current) return;
      let code = '';
      if (project?.type === ProjectType.REACT_NATIVE || project?.type === ProjectType.IOS_APP || project?.type === ProjectType.ANDROID_APP) {
          if (asset.type === 'image') code = `<Image source={{ uri: "${asset.url}" }} style={{ width: 200, height: 200 }} />`;
          else code = `// Video url: ${asset.url}`;
      } else {
          if (asset.type === 'image') code = `<img src="${asset.url}" alt="Asset" className="w-full rounded-lg" />`;
          else if (asset.type === 'video') code = `<video src="${asset.url}" controls className="w-full rounded-lg" />`;
          else if (asset.type === 'audio') code = `<audio src="${asset.url}" controls />`;
      }
      editorRef.current.insertAtCursor(code);
      addToast('success', 'Asset inserted');
  };

  const handleEditorDrop = (e: React.DragEvent, cursorPos: number) => {
      e.preventDefault();
      const assetData = e.dataTransfer.getData('application/omni-asset');
      if (assetData) {
          const asset = JSON.parse(assetData);
          handleInsertAsset(asset);
      }
  };

  const handleProcessVoice = (text: string) => {
      setIsChatOpen(true);
      submitQuery(text);
  };

  // Context Menu Downloads
  const handleDownloadFile = (fileId: string) => {
      const file = findFileById(files, fileId);
      if (file && file.content) {
          const blob = new Blob([file.content], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
          addToast('success', `Downloaded ${file.name}`);
      }
  };

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a project to begin</div>;

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Modals */}
      {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} onConnectLocal={handleConnectLocal} onConnectGitHub={handleConnectGitHub} />}
      <NewItemModal isOpen={newItemModal.isOpen} type={newItemModal.type} onClose={() => setNewItemModal({ ...newItemModal, isOpen: false })} onCreate={handleCreateItem} />
      <RenameModal isOpen={renameModal.isOpen} currentName={renameModal.currentName} onClose={() => setRenameModal({ ...renameModal, isOpen: false })} onRename={handleRenameSubmit} />
      <InstallPackageModal isOpen={pkgModalOpen} onClose={() => setPkgModalOpen(false)} onInstall={(name, isDev) => { addPackage(name, isDev); addToast('success', `Installed ${name}`); }} />
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} files={files} onOpenFile={onFileClickWrapper} onRunCommand={(cmd) => { if (cmd === 'export_project') handleExport(); else if(cmd === 'toggle_sidebar') toggleLayout('sidebar'); else if(cmd === 'format_document') handleRunCommand('format_document'); }} />
      {showVoiceCommander && <VoiceCommander onClose={() => setShowVoiceCommander(false)} onProcess={handleProcessVoice} />}
      
      {contextMenu.visible && (
          <ContextMenu 
            x={contextMenu.x} 
            y={contextMenu.y} 
            onClose={() => setContextMenu({ ...contextMenu, visible: false })} 
            onRename={() => { if(contextMenu.fileId) { const f = findFileById(files, contextMenu.fileId); if(f) setRenameModal({isOpen:true, currentName: f.name, fileId: f.id}); setContextMenu({...contextMenu, visible:false}); } }} 
            onDelete={() => { if(contextMenu.fileId) deleteFile(contextMenu.fileId); setContextMenu({...contextMenu, visible:false}); }} 
            onDuplicate={() => { if(contextMenu.fileId) duplicateFile(contextMenu.fileId); setContextMenu({...contextMenu, visible:false}); }} 
            onExplain={() => { handleCodeAction('Explain', findFileById(files, contextMenu.fileId || '')?.content || ''); setContextMenu({...contextMenu, visible:false}); }} 
            isTrash={contextMenu.isTrash} 
            onRestore={() => { if(contextMenu.fileId) restoreFile(contextMenu.fileId); }} 
            onPermanentDelete={() => { if(contextMenu.fileId) permanentlyDeleteFile(contextMenu.fileId); }} 
            onTogglePin={() => { if(contextMenu.fileId) toggleFilePin(contextMenu.fileId); setContextMenu({...contextMenu, visible:false}); }}
            onRefactor={() => { 
                const file = findFileById(files, contextMenu.fileId || '');
                if(file) {
                    setActiveAgentTask({ id: `refactor-${Date.now()}`, type: 'refactor', name: `Refactor ${file.name}`, status: 'running', totalFiles: 1, processedFiles: 0, logs: [], fileList: [{name: file.name, status: 'pending'}] });
                    addToast('info', 'Agent Refactoring...');
                }
                setContextMenu({...contextMenu, visible:false});
            }}
            onGenerateTests={() => { 
                const file = findFileById(files, contextMenu.fileId || '');
                if(file) setActiveAgentTask({ id: `test-${Date.now()}`, type: 'tests', name: `Generate tests for ${file.name}`, status: 'running', totalFiles: 1, processedFiles: 0, logs: [], fileList: [{name: file.name, status: 'pending'}] });
                addToast('info', 'Agent Generating Tests...');
                setContextMenu({...contextMenu, visible:false});
            }}
            onDownload={() => { if(contextMenu.fileId) handleDownloadFile(contextMenu.fileId); setContextMenu({...contextMenu, visible:false}); }}
            
            isDirectory={contextMenu.isDirectory}
            onNewFile={() => { setNewItemModal({ isOpen: true, type: 'file', path: contextMenu.path }); setContextMenu({...contextMenu, visible:false}); }}
            onNewFolder={() => { setNewItemModal({ isOpen: true, type: 'folder', path: contextMenu.path }); setContextMenu({...contextMenu, visible:false}); }}
          />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {isResizing && <div className="absolute inset-0 z-[100] cursor-col-resize" />}

        {!isRightPanelMaximized && (
            <WorkspaceSidebar 
                layout={layout} sidebarWidth={sidebarWidth} activeActivity={activeActivity} setActiveActivity={setActiveActivity} onToggleSidebar={() => toggleLayout('sidebar')}
                files={files} activeFileId={activeFileId} project={project} remoteDirName={remoteDirName} deletedFiles={deletedFiles}
                onFileClick={onFileClickWrapper} 
                onContextMenu={(e, id, isTrash) => { 
                    e.preventDefault(); 
                    const node = findFileById(files, id);
                    const path = getFilePath(files, id) || '';
                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, fileId: id, isTrash, isDirectory: node?.type === 'directory', path }); 
                }}
                onFileOps={{ onConnectRemote: () => setShowConnectModal(true), onAddFile: () => setNewItemModal({ isOpen: true, type: 'file' }), onAddFolder: () => setNewItemModal({ isOpen: true, type: 'folder' }), onUploadFile: handleFileUpload, onUploadFolder: handleFolderUpload, onInstallPackage: () => setPkgModalOpen(true), onRunScript: (n) => handleCommand(`npm run ${n}`), onEmptyTrash: emptyTrash, onMoveNode: moveNode, onToggleDirectory: toggleDirectory }}
                commits={commits} currentBranch={currentBranch} onCommit={handleCommit} onSwitchBranch={() => {}}
                searchQuery={searchQuery} onSearch={setSearchQuery} searchResults={searchResults} onResultClick={(id, line) => { onFileClickWrapper(id); setTimeout(() => editorRef.current?.scrollToLine(line), 100); }} onReplace={handleReplace} onReplaceAll={handleReplaceAll}
                debugVariables={debugVariables} breakpoints={breakpoints} onRemoveBreakpoint={(l) => setBreakpoints(p => p.filter(b => b !== l))}
                extensions={MOCK_EXTENSIONS} onToggleExtension={() => {}}
                assets={assets} activeAgentTask={activeAgentTask} onStartAgentTask={handleStartAgentTask} onCancelAgentTask={handleCancelAgentTask} activeAgent={activeAgent}
                snippets={snippets} onAddSnippet={() => setSnippets(p => [...p, {id:`s-${Date.now()}`, name:'New Snippet', code: editorSelection, language:'ts'}])} onDeleteSnippet={(id) => setSnippets(p => p.filter(s => s.id !== id))} onInsertSnippet={(c) => updateFileContent(activeFileId, (activeFile?.content || '') + '\n' + c)}
                onInsertAsset={handleInsertAsset}
            />
        )}

        {!isRightPanelMaximized && layout.showSidebar && <div className="w-2 bg-gray-900 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => handleResizeStart('sidebar', e)} />}

        {!isRightPanelMaximized && (
            <div className="flex-1 flex flex-col min-w-0" onDrop={(e) => handleEditorDrop(e, 0)} onDragOver={(e) => e.preventDefault()}>
                <EditorArea 
                    files={files} activeFileId={activeFileId} setActiveFileId={setActiveFileId} openFiles={openFiles} onCloseTab={onCloseTab}
                    isSplitView={isSplitView} setIsSplitView={setIsSplitView} splitRatio={splitRatio} secondaryFileId={secondaryFileId} setSecondaryFileId={setSecondaryFileId}
                    diffFileId={diffFileId} setDiffFileId={setDiffFileId} previewDiff={previewDiff} setPreviewDiff={setPreviewDiff}
                    activeFile={activeFile} secondaryFile={secondaryFile} diffFile={diffFile}
                    editorRef={editorRef} updateFileContent={updateFileContent} editorConfig={editorConfig} handleCodeAction={handleCodeAction} setEditorSelection={setEditorSelection}
                    breakpoints={breakpoints} setBreakpoints={setBreakpoints} setCursorPos={setCursorPos} addToast={addToast}
                    layout={layout} toggleLayout={toggleLayout} bottomPanelHeight={bottomPanelHeight} handleResizeStart={handleResizeStart}
                    terminalLogs={terminalLogs} onCommand={handleCommand} onAiFix={handleAiFix}
                    testResults={testResults} isRunningTests={isRunningTests} onRunTests={runTests}
                />
            </div>
        )}

        {!isRightPanelMaximized && layout.showRight && <div className="w-2 bg-gray-900 border-l border-gray-800 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => startResizing('rightPanel', e)} />}

        {(layout.showRight || isRightPanelMaximized) && (
            <div 
                className={`flex-shrink-0 relative bg-gray-900 border-l border-gray-800 absolute md:static inset-0 md:inset-auto z-40 md:z-0 w-full md:w-auto pointer-events-auto transition-all duration-300`} 
                style={{ width: isRightPanelMaximized ? '100%' : window.innerWidth < 768 ? '100%' : rightPanelWidth }}
            >
                <PreviewPanel 
                    project={project!} previewSrc={previewSrc} activeTab={activeTab} setActiveTab={setActiveTab} onToggleLayout={() => toggleLayout('right')}
                    onExport={handleExport} onRefreshPreview={handleRefreshPreview} roadmap={roadmap} isGeneratingPlan={isGeneratingPlan} onGeneratePlan={handleGeneratePlan}
                    onExecutePhase={handleExecutePhase} onToggleTask={handleToggleRoadmapTask} onLog={(l) => setTerminalLogs(p => [...p, l])} files={debouncedFiles} onSaveFile={addFile}
                    isMaximized={isRightPanelMaximized} onToggleMaximize={() => setIsRightPanelMaximized(!isRightPanelMaximized)} onUpdateProject={onUpdateProject} onDeleteProject={(id) => onDeleteProject?.({} as any, id)}
                    onDeploymentComplete={(url) => { onUpdateProject?.({ ...project, deploymentStatus: 'live', deploymentUrl: url }); addToast('success', 'Deployed!'); }}
                    onConsoleLog={(l) => setLiveConsoleLogs(p => [...p, l])}
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
          isGenerating={isGenerating} onSubmit={handleChatSubmitWrapper}
          onApplyCode={handleApplyCode} onCompareCode={(c) => setPreviewDiff({ original: activeFile?.content || '', modified: c, fileName: activeFile?.name || '' })}
          onApplyAll={(codes) => codes.forEach(c => handleApplyCode(c))}
          onAutoFix={handleAutoFix}
          onRevert={revertLastAgentRun}
          isAgentWorking={isWorking}
          activeTask={activeAgentTask}
          onToggleVoice={() => setShowVoiceCommander(!showVoiceCommander)}
      />
    </div>
  );
};
