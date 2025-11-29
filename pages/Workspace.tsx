
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PanelBottom, Columns, Mic, GitBranch, HelpCircle, Layout, Loader2, Sparkles, Command } from 'lucide-react';
import { MOCK_COMMITS, MOCK_EXTENSIONS, MOCK_SNIPPETS, DEFAULT_AGENTS } from '../constants';
import { Project, ProjectType, Extension, GitCommit as GitCommitType, Snippet, KnowledgeDoc } from '../types';
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

const WorkspaceBootScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [step, setStep] = useState(0);
  const steps = [
    "Initializing Omni-Kernel...",
    "Mounting Virtual File System...",
    "Connecting to Neural Engine...",
    "Syncing Development Environment...",
    "Ready"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(interval);
          setTimeout(onComplete, 500);
          return prev;
        }
        return prev + 1;
      });
    }, 500); // 500ms per step
    return () => clearInterval(interval);
  }, [onComplete, steps.length]);

  return (
    <div className="absolute inset-0 z-[1000] bg-gray-950 flex flex-col items-center justify-center font-mono overflow-hidden">
      <style>{`
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes spin-reverse-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
        @keyframes pulse-glow { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.1); } }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .animate-spin-reverse-slow { animation: spin-reverse-slow 12s linear infinite; }
        .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
      `}</style>
      
      {/* Ambient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black opacity-80"></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>

      <div className="relative mb-16 scale-110">
         {/* Animated Core */}
         <div className="w-32 h-32 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 bg-primary-500/20 blur-3xl rounded-full animate-pulse-glow"></div>
            <div className="relative z-10 bg-gray-900 p-6 rounded-2xl border border-gray-700 shadow-2xl">
                <Command size={48} className="text-primary-400 animate-pulse" style={{ animationDuration: '3s' }}/>
            </div>
         </div>
         {/* Orbiting Particles */}
         <div className="absolute inset-[-40px] border border-primary-500/30 rounded-full w-52 h-52 animate-spin-slow border-t-transparent border-l-transparent opacity-70"></div>
         <div className="absolute inset-[-60px] border border-purple-500/20 rounded-full w-64 h-64 animate-spin-reverse-slow border-b-transparent border-r-transparent opacity-50"></div>
      </div>

      <div className="w-80 space-y-4 z-10">
         <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden border border-gray-700/50">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 via-purple-500 to-primary-500 transition-all duration-300 ease-out relative" 
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
            </div>
         </div>
         <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-primary-300 transition-all duration-300 animate-in fade-in slide-in-from-bottom-1">
                {steps[step]}
            </span>
            <span className="text-gray-600">{Math.min(100, Math.round(((step + 1) / steps.length) * 100))}%</span>
         </div>
      </div>
      
      <div className="absolute bottom-8 text-[10px] text-gray-600 font-mono tracking-widest uppercase">
          Omni-Studio v1.0 • Neural Engine Active
      </div>
    </div>
  );
};

export const Workspace: React.FC<WorkspaceProps> = ({ project, onDeleteProject, onUpdateProject }) => {
  // Boot Sequence State
  const [isBooting, setIsBooting] = useState(true);

  // --- FILE SYSTEM HOOK ---
  const { 
      files, filesRef, setFiles, deletedFiles, activeFileId, setActiveFileId, openFiles, setOpenFiles, 
      remoteDirName, setRemoteDirName, updateFileContent, addFile, addDirectory, addPackage, findFileById, getAllFiles,
      handleFileClick: onFileClick, handleCloseTab: onCloseTab, replaceTextInProject,
      deleteFile, renameFile, duplicateFile, restoreFile, permanentlyDeleteFile, emptyTrash, toggleFilePin, moveNode, toggleDirectory,
      reorderOpenFiles, closeOtherTabs
  } = useFileSystem(project);
  
  // --- LAYOUT & RESIZING ---
  const { 
      sidebarWidth, rightPanelWidth, bottomPanelHeight, splitRatio, startResizing 
  } = useResizable();

  const [isResizing, setIsResizing] = useState(false);
  const [layout, setLayout] = useState({ showSidebar: window.innerWidth >= 768, showBottom: true, showRight: window.innerWidth >= 1024 });
  const [isRightPanelMaximized, setIsRightPanelMaximized] = useState(false);

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

  const [activeTab, setActiveTab] = useState<'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture' | 'settings'>('preview');
  const [activeActivity, setActiveActivity] = useState<'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS' | 'SNIPPETS' | 'KNOWLEDGE'>('EXPLORER');
  
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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [commits, setCommits] = useState<GitCommitType[]>(MOCK_COMMITS);
  const [currentBranch, setCurrentBranch] = useState('main');

  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>(() => {
      if (project?.id) {
          const saved = localStorage.getItem(`omni_knowledge_${project.id}`);
          return saved ? JSON.parse(saved) : [];
      }
      return [];
  });

  useEffect(() => {
      if (project?.id) {
          localStorage.setItem(`omni_knowledge_${project.id}`, JSON.stringify(knowledgeDocs));
      }
  }, [knowledgeDocs, project?.id]);

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showVoiceCommander, setShowVoiceCommander] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, fileId: string | null, isTrash?: boolean }>({ visible: false, x: 0, y: 0, fileId: null, isTrash: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newItemModal, setNewItemModal] = useState<{isOpen: boolean, type: 'file' | 'folder'}>({ isOpen: false, type: 'file' });
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

  const activeModel = localStorage.getItem('omni_active_model') || 'Gemini 2.5 Flash (Fastest)';
  
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
  
  const mcpContext = useMemo(() => {
      return knowledgeDocs.filter(d => d.isActive).map(d => `[${d.title}]: ${d.content}`).join('\n\n');
  }, [knowledgeDocs]);

  // Define runTests first to pass to Orchestrator and Assistant
  const { 
      testResults, isRunningTests, runTests 
  } = useTesting({ 
      files, 
      onLog: (msg) => setTerminalLogs(prev => [...prev, msg]) 
  });

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
      activeAgent,
      setActiveAgent,
      isAutoPilot,
      handleToggleAutoPilot
  } = useAgentOrchestrator({
      filesRef,
      updateFileContent,
      addFile,
      setFiles,
      deleteFile,
      addSystemMessage: (msg) => addSystemMessage(msg), 
      setTerminalLogs,
      terminalLogs,
      liveConsoleLogs,
      roadmap,
      setRoadmap,
      debugVariables,
      projectDescription: project?.description || '',
      projectType: project?.type || ProjectType.REACT_WEB,
      projectRules: project?.aiRules,
      mcpContext,
      addToast,
      setChatInput: (val) => setChatInput(val), 
      setIsChatOpen: (val) => setIsChatOpen(val), 
      setChatHistory: (val) => setChatHistory(val), 
      triggerGeneration: (val) => triggerGeneration(val), 
      runTests: (files) => runTests(files), 
      handleCommand: (cmd) => handleCommand(cmd) 
  });

  // Bridge between Chat Slash Commands and Orchestrator
  const handleAgentSlashCommand = useCallback((taskDescription: string) => {
       const savedAgents = localStorage.getItem('omni_agents');
       const agents = savedAgents ? JSON.parse(savedAgents) : DEFAULT_AGENTS;
       const manager = agents.find((a: any) => a.isManager) || DEFAULT_AGENTS[0];
       
       setActiveAgentTask({
           id: `cmd-${Date.now()}`,
           type: 'custom',
           name: taskDescription,
           status: 'running',
           totalFiles: 0, // Planning will update this
           processedFiles: 0,
           logs: [`Initialized via chat command: "${taskDescription}"`],
           fileList: []
       });
       setActiveAgent(manager);
       addToast('info', 'Agent task started');
  }, [setActiveAgentTask, setActiveAgent, addToast]);

  const {
      chatInput, setChatInput, chatHistory, setChatHistory, isGenerating, 
      isChatOpen, setIsChatOpen, triggerGeneration, handleChatSubmit, 
      handleCodeAction, handleAutoFix, addSystemMessage, submitQuery
  } = useOmniAssistant({ 
      projectId: project?.id || 'default',
      projectType: project?.type || ProjectType.REACT_WEB, 
      files, activeFile, activeModel, editorSelection, setEditorSelection,
      onStartAgentTask: handleAgentSlashCommand,
      runTests // Pass runTests here
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
      } else if (input === 'npm start') {
          setActiveTab('preview');
          baseHandleCommand(input);
      } else {
          await baseHandleCommand(input);
      }
  };

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
  
  const activeFilePath = useMemo(() => getFilePath(files, activeFileId) || undefined, [files, activeFileId]);

  const previewSrc = useMemo(() => {
      if (!project) return '';
      const activeCode = findFileById(debouncedFiles, activeFileId)?.content || '';
      
      return generatePreviewHtml(
          activeCode, 
          project.type === ProjectType.REACT_NATIVE || project.type === ProjectType.IOS_APP || project.type === ProjectType.ANDROID_APP, 
          debouncedFiles,
          activeFilePath,
          envVars 
      );
  }, [activeFileId, debouncedFiles, project, envVars, activeFilePath]);

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
  const handleCreateItem = (name: string) => { if (newItemModal.type === 'file') addFile(name, '// New file'); else addDirectory(name); addToast('success', `Created ${name}`); };

  const handleRunCommand = (cmd: string) => {
      if (cmd === 'toggle_sidebar') toggleLayout('sidebar');
      if (cmd === 'toggle_terminal') toggleLayout('bottom');
      if (cmd === 'export_project') handleExport();
      if (cmd === 'git_commit') { handleCommand('git commit -m "Update"'); }
      if (cmd === 'open_settings') setActiveTab('settings');
      if (cmd === 'format_document' && activeFile && activeFile.content) {
          const formatted = activeFile.content.split('\n').map(l => l.trim() ? l : '').join('\n'); 
          updateFileContent(activeFile.id, formatted);
          addToast('success', 'Document Formatted');
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

  // Unified Save Logic
  const handleExplicitSave = () => {
      // In a real app, this would sync to backend/cloud
      // Here we rely on the existing localStorage auto-save, but give feedback
      addToast('success', 'Project Saved Successfully');
      if (project) logActivity('post', 'Project Saved', 'Manual save triggered', project.id);
  };

  const handleRunScript = (name: string, cmd: string) => {
      if (name === 'save') {
          handleExplicitSave();
      } else {
          handleCommand(`npm run ${name}`);
          setLayout(p => ({ ...p, showBottom: true }));
      }
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
  
  const handleRefactorFile = () => {
      if (!activeFile) return;
      const taskName = `Refactor ${activeFile.name} to improve code quality and performance`;
      if (setActiveAgentTask) {
          setActiveAgentTask({
              id: `refactor-${Date.now()}`,
              type: 'refactor',
              name: taskName,
              status: 'running',
              totalFiles: 1,
              processedFiles: 0,
              logs: [`Starting refactor for ${activeFile.name}`],
              fileList: [{ name: activeFile.name, status: 'pending' }]
          });
          addToast('info', `Refactoring ${activeFile.name}...`);
          setLayout(p => ({...p, showBottom: true}));
      }
  };
  
  const handleToggleRoadmapTask = (phaseId: string, taskId: string) => {
      setRoadmap(prev => prev.map(p => {
          if (p.id === phaseId) {
              return { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) };
          }
          return p;
      }));
  };
  
  const handleAddKnowledgeDoc = (doc: KnowledgeDoc) => setKnowledgeDocs(prev => [...prev, doc]);
  const handleUpdateKnowledgeDoc = (doc: KnowledgeDoc) => setKnowledgeDocs(prev => prev.map(d => d.id === doc.id ? doc : d));
  const handleDeleteKnowledgeDoc = (id: string) => setKnowledgeDocs(prev => prev.filter(d => d.id !== id));

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a project to begin</div>;

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full relative">
      {isBooting && <WorkspaceBootScreen onComplete={() => setIsBooting(false)} />}
      
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Modals */}
      {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} onConnectLocal={handleConnectLocal} onConnectGitHub={handleConnectGitHub} />}
      <NewItemModal isOpen={newItemModal.isOpen} type={newItemModal.type} onClose={() => setNewItemModal({ ...newItemModal, isOpen: false })} onCreate={(name) => { newItemModal.type === 'file' ? addFile(name, '') : addDirectory(name); addToast('success', 'Created'); }} />
      <RenameModal isOpen={renameModal.isOpen} currentName={renameModal.currentName} onClose={() => setRenameModal({ ...renameModal, isOpen: false })} onRename={(name) => { renameModal.fileId && renameFile(renameModal.fileId, name); addToast('success', 'Renamed'); }} />
      <InstallPackageModal isOpen={pkgModalOpen} onClose={() => setPkgModalOpen(false)} onInstall={(name, isDev) => { addPackage(name, isDev); addToast('success', `Installed ${name}`); }} />
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} files={files} onOpenFile={onFileClickWrapper} onRunCommand={(cmd) => { if (cmd === 'export_project') handleExport(); else if(cmd === 'toggle_sidebar') toggleLayout('sidebar'); else if(cmd === 'format_document') handleRunCommand('format_document'); }} />
      {showVoiceCommander && <VoiceCommander onClose={() => setShowVoiceCommander(false)} onProcess={submitQuery} />}
      
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
            onRefactor={handleRefactorFile}
            onGenerateTests={() => { /* Trigger tests gen task */ }}
            onDownload={() => { /* Single file download */ }}
            onNewFile={() => { setNewItemModal({ isOpen: true, type: 'file' }); setContextMenu({...contextMenu, visible:false}); }}
            onNewFolder={() => { setNewItemModal({ isOpen: true, type: 'folder' }); setContextMenu({...contextMenu, visible:false}); }}
            isDirectory={findFileById(files, contextMenu.fileId || '')?.type === 'directory'}
          />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {isResizing && <div className="absolute inset-0 z-[100] cursor-col-resize" />}

        {!isRightPanelMaximized && (
            <WorkspaceSidebar 
                layout={layout} sidebarWidth={sidebarWidth} activeActivity={activeActivity} setActiveActivity={setActiveActivity} onToggleSidebar={() => toggleLayout('sidebar')}
                files={files} activeFileId={activeFileId} project={project} remoteDirName={remoteDirName} deletedFiles={deletedFiles}
                onFileClick={onFileClickWrapper} onContextMenu={(e, id, isTrash) => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, fileId: id, isTrash }); }}
                onFileOps={{ 
                    onConnectRemote: () => setShowConnectModal(true), 
                    onAddFile: () => setNewItemModal({ isOpen: true, type: 'file' }), 
                    onAddFolder: () => setNewItemModal({ isOpen: true, type: 'folder' }), 
                    onUploadFile: handleFileUpload, 
                    onUploadFolder: handleFolderUpload, 
                    onInstallPackage: () => setPkgModalOpen(true), 
                    onRunScript: handleRunScript, // This now handles 'save' too
                    onEmptyTrash: emptyTrash, 
                    onMoveNode: moveNode, 
                    onToggleDirectory: toggleDirectory 
                }}
                commits={commits} currentBranch={currentBranch} onCommit={handleCommit} onSwitchBranch={() => {}}
                searchQuery={searchQuery} onSearch={setSearchQuery} searchResults={searchResults} onResultClick={(id, line) => { onFileClickWrapper(id); setTimeout(() => editorRef.current?.scrollToLine(line), 100); }} onReplace={handleReplace} onReplaceAll={handleReplaceAll}
                debugVariables={debugVariables} breakpoints={breakpoints} onRemoveBreakpoint={(l) => setBreakpoints(p => p.filter(b => b !== l))}
                extensions={MOCK_EXTENSIONS} onToggleExtension={() => {}}
                assets={assets} activeAgentTask={activeAgentTask} agentHistory={taskHistory} onStartAgentTask={handleStartAgentTask} onCancelAgentTask={handleCancelAgentTask} activeAgent={activeAgent}
                snippets={snippets} onAddSnippet={() => setSnippets(p => [...p, {id:`s-${Date.now()}`, name:'New Snippet', code: editorSelection, language:'ts'}])} onDeleteSnippet={(id) => setSnippets(p => p.filter(s => s.id !== id))} onInsertSnippet={(c) => updateFileContent(activeFileId, (activeFile?.content || '') + '\n' + c)}
                onInsertAsset={handleInsertAsset}
                knowledgeDocs={knowledgeDocs} onAddKnowledgeDoc={handleAddKnowledgeDoc} onUpdateKnowledgeDoc={handleUpdateKnowledgeDoc} onDeleteKnowledgeDoc={handleDeleteKnowledgeDoc}
            />
        )}

        {!isRightPanelMaximized && layout.showSidebar && <div className="w-2 bg-gray-900 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => handleResizeStart('sidebar', e)} />}

        {!isRightPanelMaximized && (
            <div className="flex-1 flex flex-col min-w-0" onDrop={(e) => handleEditorDrop(e, 0)} onDragOver={(e) => e.preventDefault()}>
                <EditorArea 
                    files={files} activeFileId={activeFileId} setActiveFileId={setActiveFileId} openFiles={openFiles} onCloseTab={onCloseTab}
                    onReorderTabs={reorderOpenFiles} onCloseOtherTabs={closeOtherTabs}
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
                    onExport={handleExport} onRefreshPreview={() => {/* force update */}} roadmap={roadmap} isGeneratingPlan={isGeneratingPlan} onGeneratePlan={handleGeneratePlan}
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
          onToggleVoice={() => setShowVoiceCommander(true)}
          isAutoPilot={isAutoPilot}
          onToggleAutoPilot={handleToggleAutoPilot}
      />
    </div>
  );
};
