
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RefreshCw, PanelBottom, Columns, MessageSquare, ArrowRight, X, Minimize2, SplitSquareHorizontal, GitBranch, Mic } from 'lucide-react';
import { MOCK_COMMITS, MOCK_EXTENSIONS, DEFAULT_AGENTS } from '../constants';
import { Project, ProjectType, SocialPost, AudioTrack, Extension, GitCommit as GitCommitType, ProjectPhase, AgentTask, AIAgent, FileNode } from '../types';
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
import { ContextMenu } from '../components/ContextMenu';
import { ToastContainer, ToastMessage } from '../components/Toast';
import { ConnectModal } from '../components/ConnectModal';
import { NewItemModal } from '../components/NewItemModal';
import { RenameModal } from '../components/RenameModal';
import { InstallPackageModal } from '../components/InstallPackageModal';

interface WorkspaceProps {
  project: Project | null;
}

export const Workspace: React.FC<WorkspaceProps> = ({ project }) => {
  const isNative = project?.type === ProjectType.REACT_NATIVE || project?.type === ProjectType.IOS_APP || project?.type === ProjectType.ANDROID_APP;
  const isBackend = project?.type === ProjectType.NODE_API;
  
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

  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture'>(() => (localStorage.getItem('omni_active_preview_tab') as any) || 'preview');
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
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  
  const {
      chatInput, setChatInput,
      chatHistory, setChatHistory,
      isGenerating,
      isChatOpen, setIsChatOpen,
      enableCritic, setEnableCritic,
      attachedImage, setAttachedImage,
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

  const { handleCommand: baseHandleCommand, handleAiFix, cwd } = useTerminal({
      files, setFiles, activeFileId, projectType: project?.type || ProjectType.REACT_WEB, addFile, onLog: (msg) => setTerminalLogs(prev => [...prev, msg])
  });

  const handleCommand = async (input: string) => {
      // Intercept git commit for UI update
      if (input.startsWith('git commit')) {
          const match = input.match(/-m\s+["'](.+)["']/);
          const message = match ? match[1] : 'Update files';
          setCommits(prev => [...prev, { id: Date.now().toString(), message, author: 'You', date: 'Now', hash: Math.random().toString(36).substr(2, 7) }]);
          setTerminalLogs(prev => [...prev, `> ${input}`, `[${currentBranch} ${Math.random().toString(36).substr(2, 7)}] ${message}`]);
          addToast('success', 'Changes committed.');
      } else {
          await baseHandleCommand(input);
      }
  };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [debugVariables, setDebugVariables] = useState<{name: string, value: string}[]>([]);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);

  // Agents State
  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask | null>(null);
  const [activeAgent, setActiveAgent] = useState<AIAgent | null>(null);
  const abortAgentRef = useRef(false);

  const [activeActivity, setActiveActivity] = useState<'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS'>('EXPLORER');
  const [layout, setLayout] = useState({ showSidebar: window.innerWidth >= 768, showBottom: true, showRight: window.innerWidth >= 1024 });
  const [isRightPanelMaximized, setIsRightPanelMaximized] = useState(false);

  const [assets, setAssets] = useState<{type: 'image' | 'video' | 'audio', url: string, name: string}[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showVoiceCommander, setShowVoiceCommander] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>({ visible: false, x: 0, y: 0, fileId: null, isTrash: false });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newItemModal, setNewItemModal] = useState<{isOpen: boolean, type: 'file' | 'folder'}>({ isOpen: false, type: 'file' });
  const [renameModal, setRenameModal] = useState<{isOpen: boolean, currentName: string, fileId: string | null}>({ isOpen: false, currentName: '', fileId: null });
  const [pkgModalOpen, setPkgModalOpen] = useState(false);
  
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
      if (!searchQuery) {
          setSearchResults([]);
          return;
      }
      const results: any[] = [];
      const all = getAllFiles(files);
      const lowerQuery = searchQuery.toLowerCase();
      
      for (const file of all) {
          if (file.node.content) {
              const lines = file.node.content.split('\n');
              lines.forEach((line, idx) => {
                  if (line.toLowerCase().includes(lowerQuery)) {
                      results.push({
                          fileId: file.node.id,
                          fileName: file.node.name,
                          line: idx + 1,
                          text: line.trim()
                      });
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

  const handleReplaceAll = (searchText: string, newText: string) => {
      let count = 0;
      const all = getAllFiles(files);
      all.forEach(file => {
          if (file.node.content && file.node.content.toLowerCase().includes(searchText.toLowerCase())) {
              const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
              const newContent = file.node.content.replace(regex, newText);
              if (newContent !== file.node.content) {
                  updateFileContent(file.node.id, newContent);
                  count++;
              }
          }
      });
      if (count > 0) addToast('success', `Replaced occurrences in ${count} files`);
      else addToast('info', 'No occurrences found');
  };

  // Save Active Tab
  useEffect(() => {
      localStorage.setItem('omni_active_preview_tab', activeTab);
  }, [activeTab]);

  const toggleLayout = useCallback((p: any) => { 
      setLayout(prev => ({...prev, [p === 'sidebar' ? 'showSidebar' : p === 'bottom' ? 'showBottom' : 'showRight']: !prev[p === 'sidebar' ? 'showSidebar' : p === 'bottom' ? 'showBottom' : 'showRight']}));
  }, []);

  const toggleMaximizeRight = useCallback(() => {
      setIsRightPanelMaximized(prev => !prev);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
          // Avoid handling if event was already processed (e.g., by CodeEditor)
          if (e.defaultPrevented) return;

          // Save: Ctrl+S / Cmd+S
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              addToast('success', 'File saved successfully.');
          }
          // Command Palette: Ctrl+P / Cmd+K
          if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'k')) {
              e.preventDefault();
              setShowCommandPalette(prev => !prev);
          }
          // Toggle Sidebar: Ctrl+B
          if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
              e.preventDefault();
              toggleLayout('sidebar');
          }
          // Toggle Terminal: Ctrl+J
          if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
              e.preventDefault();
              toggleLayout('bottom');
          }
          // Rename: F2
          if (e.key === 'F2' && activeFileId) {
              e.preventDefault();
              const file = findFileById(files, activeFileId);
              if (file) {
                  setRenameModal({ isOpen: true, currentName: file.name, fileId: file.id });
              }
          }
      };
      window.addEventListener('keydown', handleGlobalKeyDown);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [toggleLayout, activeFileId, files]);

  const handleResizeStart = (dir: any, e: any) => {
      setIsResizing(true);
      startResizing(dir, e);
      const onMouseUp = () => {
          setIsResizing(false);
          window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mouseup', onMouseUp);
  };

  // --- Agent Runner Logic ---
  useEffect(() => {
      if (!activeAgentTask || activeAgentTask.status !== 'running' || !activeAgent) return;

      const run = async () => {
          const allFiles = getAllFiles(files);
          const relevantFiles = allFiles.filter(f => 
              f.node.name.endsWith('.tsx') || 
              f.node.name.endsWith('.ts') || 
              f.node.name.endsWith('.js') ||
              f.node.name.endsWith('.jsx')
          );
          
          if (!activeAgentTask.fileList || activeAgentTask.fileList.length === 0) {
              setActiveAgentTask(prev => prev ? { 
                  ...prev, 
                  totalFiles: relevantFiles.length,
                  fileList: relevantFiles.map(f => ({ name: f.node.name, status: 'pending' }))
              } : null);
          }

          abortAgentRef.current = false;
          let processedCount = 0;

          for (let i = 0; i < relevantFiles.length; i++) {
              if (abortAgentRef.current) {
                  setActiveAgentTask(prev => prev ? { ...prev, status: 'cancelled', logs: [...prev.logs, `Task cancelled by user.`] } : null);
                  return;
              }

              const file = relevantFiles[i];
              
              setActiveAgentTask(prev => {
                  if (!prev) return null;
                  const newList = prev.fileList?.map(f => f.name === file.node.name ? { ...f, status: 'processing' as const } : f) || [];
                  return { ...prev, currentFile: file.node.name, logs: [...prev.logs, `[${activeAgent.name}] Analyzing ${file.node.name}...`], fileList: newList };
              });
              
              const result = await runAgentFileTask(activeAgent, file.node.name, file.node.content || '');
              
              if (result) {
                  const filenameMatch = result.match(/^\/\/ filename: (.*)/);
                  const targetName = filenameMatch ? filenameMatch[1].trim() : `processed_${file.node.name}`;
                  addFile(targetName, result);
                  setActiveAgentTask(prev => prev ? { ...prev, logs: [...prev.logs, `> Generated ${targetName}`] } : null);
              }

              processedCount++;
              
              setActiveAgentTask(prev => {
                  if (!prev) return null;
                  const newList = prev.fileList?.map(f => f.name === file.node.name ? { ...f, status: 'done' as const } : f) || [];
                  return { ...prev, processedFiles: processedCount, fileList: newList };
              });

              await new Promise(r => setTimeout(r, 500));
          }

          const statsKey = 'omni_team_stats';
          const currentStats = JSON.parse(localStorage.getItem(statsKey) || '[]');
          const newStat = {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              velocity: processedCount * 10,
              agent: activeAgent.name
          };
          const updatedStats = [...currentStats, newStat].slice(-20);
          localStorage.setItem(statsKey, JSON.stringify(updatedStats));
          window.dispatchEvent(new Event('omniStatsUpdated'));

          setActiveAgentTask(prev => prev ? { ...prev, status: 'completed', logs: [...prev.logs, `Task Completed by ${activeAgent.name}. Velocity recorded.`] } : null);
          setActiveAgent(null);
          addToast('success', 'Agent task completed successfully!');
      };

      run();
  }, [activeAgentTask?.id]);

  const handleStartAgentTask = (agent: AIAgent, type: AgentTask['type']) => {
      setActiveAgent(agent);
      setActiveAgentTask({
          id: `task-${Date.now()}`,
          type,
          name: `${type === 'tests' ? 'QA' : type === 'docs' ? 'Docs' : 'Refactor'} run by ${agent.name}`,
          status: 'running',
          totalFiles: 0,
          processedFiles: 0,
          logs: [`Starting Agent: ${agent.name}`, `Model: ${agent.model}`, `Role: ${agent.role}`],
          fileList: []
      });
      addToast('info', `${agent.name} started task: ${type}`);
  };

  const handleCancelAgentTask = () => {
      abortAgentRef.current = true;
      setActiveAgentTask(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setActiveAgent(null);
      addToast('error', 'Agent task cancelled.');
  };

  useEffect(() => {
      const handleResize = () => {
          const isMobile = window.innerWidth < 768;
          // Auto-adjust layout on resize
          setLayout(prev => ({ 
              ...prev, 
              showSidebar: !isMobile && prev.showSidebar, 
              showRight: window.innerWidth >= 1024 && prev.showRight 
          }));
          // Auto-close chat on mobile to save space
          if (isMobile) setIsChatOpen(false);
      };
      window.addEventListener('resize', handleResize);
      handleResize(); // Init
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
      if (project && (!files || files.length === 0)) {
          setPreviewSrc('');
      } else if (project) {
          const code = findFileById(files, activeFileId)?.content || '';
          const html = generatePreviewHtml(code, project.type === ProjectType.REACT_NATIVE);
          setPreviewSrc(html);
      }
  }, [activeFileId, files, project]);

  const onFileClickWrapper = useCallback((id: string) => onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId), [isSplitView, secondaryFileId, onFileClick]);
  const onResultClickWrapper = useCallback((id: string, line: number) => { onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId); if (editorRef.current) editorRef.current.scrollToLine(line); }, [isSplitView, secondaryFileId, onFileClick]);

  const handleSearch = (q: string) => { setSearchQuery(q); };
  const handleCommit = (m: string) => {
      setCommits(prev => [...prev, { id: Date.now().toString(), message: m, author: 'You', date: 'Now', hash: Math.random().toString(36).substr(2, 7) }]);
      setTerminalLogs(prev => [...prev, `> git commit -m "${m}"`, `[${currentBranch} ${Math.random().toString(36).substr(2, 7)}] ${m}`]);
      addToast('success', 'Changes committed to git.');
  };
  
  const handleFileUpload = (e: any) => {
      const files = e.target.files;
      if (files && files.length > 0) {
          let count = 0;
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const reader = new FileReader();
              const isImage = file.type.startsWith('image/');
              
              reader.onload = (ev) => {
                  const content = ev.target?.result as string;
                  addFile(file.name, content);
                  count++;
                  if (count === files.length) addToast('success', `Uploaded ${count} files.`);
              };
              
              if (isImage) reader.readAsDataURL(file);
              else reader.readAsText(file);
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
              const isImage = file.type.startsWith('image/');
              
              reader.onload = (ev) => {
                  addFile(path, ev.target?.result as string);
              }
              
              if (isImage) reader.readAsDataURL(file);
              else reader.readAsText(file);
          }
          addToast('success', `Uploaded folder with ${files.length} files.`);
      }
  };
  
  // Remote & GitHub
  const handleConnectRemote = () => {
      setShowConnectModal(true);
  };

  const handleConnectLocal = async () => {
      try {
          const dirHandle = await (window as any).showDirectoryPicker();
          setRemoteDirName(dirHandle.name);
          
          const readDir = async (dir: any, path = '') => {
              for await (const entry of dir.values()) {
                  if (entry.kind === 'file') {
                      const file = await entry.getFile();
                      const text = await file.text();
                      addFile(`${path}${entry.name}`, text);
                  } else if (entry.kind === 'directory') {
                      addDirectory(`${path}${entry.name}`);
                      await readDir(entry, `${path}${entry.name}/`);
                  }
              }
          };
          await readDir(dirHandle);
          addToast('success', `Linked local folder: ${dirHandle.name}`);
      } catch (e) {
          console.error(e);
          addToast('error', 'Failed to connect local directory');
      }
  };

  const handleConnectGitHub = async (url: string) => {
      try {
          const parts = url.split('github.com/')[1]?.split('/');
          if (!parts || parts.length < 2) throw new Error('Invalid URL');
          const owner = parts[0];
          const repo = parts[1];
          const branch = 'main';
          
          // Public API fetch (limitations apply)
          const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
          if (!response.ok) throw new Error('Repo not found or private');
          const data = await response.json();
          
          setRemoteDirName(`${owner}/${repo}`);
          
          // Process tree - Limit to 50 files to prevent freeze
          const limit = 50;
          let count = 0;
          for (const item of data.tree) {
              if (count >= limit) break;
              if (item.type === 'blob') {
                  addFile(item.path, `// Content fetched from ${url}\n// File: ${item.path}\n// (Simulated content due to API rate limits)`);
                  count++;
              } else if (item.type === 'tree') {
                  addDirectory(item.path);
              }
          }
          addToast('success', `Imported ${count} files from ${owner}/${repo}`);
      } catch (e: any) {
          console.error(e);
          addToast('error', `GitHub Import Failed: ${e.message}`);
      }
  };

  const handleSystemCommand = (c: string) => {
      if (c === 'toggle_sidebar') toggleLayout('sidebar');
      if (c === 'toggle_terminal') toggleLayout('bottom');
      if (c === 'git_commit') setActiveActivity('GIT');
      if (c === 'open_settings') window.location.hash = '#settings'; 
  };

  const handleFileOps = useMemo(() => ({ 
      onConnectRemote: handleConnectRemote, 
      onAddFile: () => setNewItemModal({ isOpen: true, type: 'file' }), 
      onAddFolder: () => setNewItemModal({ isOpen: true, type: 'folder' }), 
      onUploadFile: handleFileUpload, 
      onUploadFolder: handleFolderUpload, 
      onInstallPackage: () => setPkgModalOpen(true), 
      onRunScript: (name: string, cmd: string) => setTerminalLogs(prev => [...prev, `> npm run ${name}`, `> ${cmd}`]),
      onEmptyTrash: emptyTrash
  }), [emptyTrash]);

  const handleCreateItem = (name: string) => {
      if (newItemModal.type === 'file') {
          addFile(name, '// New file');
          addToast('success', `Created ${name}`);
      } else {
          addDirectory(name);
          addToast('success', `Created folder ${name}`);
      }
  };

  const handleInstallPackage = (name: string, isDev: boolean) => {
      addPackage(name, isDev);
      setTerminalLogs(prev => [...prev, `> npm install ${name} ${isDev ? '-D' : ''}`, `+ ${name}@latest`]);
      addToast('success', `Installed ${name}`);
  };

  const handleApplyCode = useCallback((code: string) => {
    const filenameMatch = code.match(/^\/\/ filename: (.*)/i) || code.match(/^\/\/ filename:(.*)/i);
    if (filenameMatch) {
      addFile(filenameMatch[1].trim(), code);
      addToast('success', `Applied code to ${filenameMatch[1].trim()}`);
    } else {
      updateFileContent(activeFileId, code);
      addToast('success', 'Applied code to active file');
    }
  }, [activeFileId, addFile, updateFileContent]);

  const handleGeneratePlan = async () => {
      setIsGeneratingPlan(true);
      const plan = await generateProjectPlan(project?.description || "Project", project?.type || ProjectType.REACT_WEB);
      setRoadmap(plan);
      setIsGeneratingPlan(false);
      addToast('success', 'Project Roadmap Generated');
  };
  
  const handleExecutePhase = (phase: ProjectPhase) => {
      setChatInput(`Execute Phase: ${phase.title}. Goals: ${phase.goals.join(', ')}`);
      setIsChatOpen(true);
  };
  
  const handleToggleRoadmapTask = (phaseId: string, taskId: string) => {
      setRoadmap(prev => prev.map(p => p.id === phaseId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : p));
  };
  
  const handleRefreshPreview = () => {
      const currentSrc = previewSrc;
      setPreviewSrc('');
      setTimeout(() => {
          setPreviewSrc(currentSrc); // Force iframe reload
          addToast('info', 'Preview refreshed');
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
      addToast('success', 'Project exported successfully');
  };

  const handleApplyAll = (codes: string[]) => {
    codes.forEach(code => handleApplyCode(code));
    addToast('success', `Applied ${codes.length} code blocks`);
  };

  // Context Menu Handlers
  const handleRename = () => {
      if (contextMenu.fileId) {
          const file = findFileById(files, contextMenu.fileId);
          if (file) {
              setRenameModal({ isOpen: true, currentName: file.name, fileId: file.id });
          }
          setContextMenu({ ...contextMenu, visible: false });
      }
  };
  
  const handleRenameSubmit = (newName: string) => {
      if (renameModal.fileId) {
          renameFile(renameModal.fileId, newName);
          addToast('success', 'Renamed successfully');
      }
  };

  const handleDelete = () => {
      if (confirm("Delete this file?") && contextMenu.fileId) {
          deleteFile(contextMenu.fileId);
          setContextMenu({ ...contextMenu, visible: false });
          addToast('success', 'File moved to trash');
      }
  };
  const handleDuplicate = () => {
      if (contextMenu.fileId) {
          duplicateFile(contextMenu.fileId);
          setContextMenu({ ...contextMenu, visible: false });
          addToast('success', 'File duplicated');
      }
  };
  const handleContextExplain = () => {
      const file = findFileById(files, contextMenu.fileId);
      if (file && file.content) {
          setChatInput(`Explain ${file.name}:\n\n${file.content}`);
          setIsChatOpen(true);
          setContextMenu({ ...contextMenu, visible: false });
      }
  };
  
  const handleRestore = () => {
      if (contextMenu.fileId) {
          restoreFile(contextMenu.fileId);
          setContextMenu({ ...contextMenu, visible: false });
          addToast('success', 'File restored');
      }
  };
  
  const handlePermanentDelete = () => {
      if (confirm("Are you sure? This cannot be undone.") && contextMenu.fileId) {
          permanentlyDeleteFile(contextMenu.fileId);
          setContextMenu({ ...contextMenu, visible: false });
          addToast('success', 'File deleted permanently');
      }
  };

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a project to begin</div>;

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} onConnectLocal={handleConnectLocal} onConnectGitHub={handleConnectGitHub} />}
      <NewItemModal isOpen={newItemModal.isOpen} type={newItemModal.type} onClose={() => setNewItemModal({ ...newItemModal, isOpen: false })} onCreate={handleCreateItem} />
      <RenameModal isOpen={renameModal.isOpen} currentName={renameModal.currentName} onClose={() => setRenameModal({ ...renameModal, isOpen: false })} onRename={handleRenameSubmit} />
      <InstallPackageModal isOpen={pkgModalOpen} onClose={() => setPkgModalOpen(false)} onInstall={handleInstallPackage} />
      
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} files={files} onOpenFile={onFileClickWrapper} onRunCommand={handleSystemCommand} />
      {showVoiceCommander && <VoiceCommander onClose={() => setShowVoiceCommander(false)} />}
      
      {contextMenu.visible && (
          <ContextMenu 
              x={contextMenu.x} 
              y={contextMenu.y} 
              onClose={() => setContextMenu({ ...contextMenu, visible: false })} 
              onRename={handleRename}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onExplain={handleContextExplain}
              isTrash={contextMenu.isTrash}
              onRestore={handleRestore}
              onPermanentDelete={handlePermanentDelete}
          />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {isResizing && <div className="absolute inset-0 z-[100] cursor-col-resize" />}

        {/* Sidebar - Hidden if Maximized */}
        {!isRightPanelMaximized && (
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
                deletedFiles={deletedFiles}
                onFileClick={onFileClickWrapper}
                onContextMenu={(e, id, isTrash) => { e.preventDefault(); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, fileId: id, isTrash }); }}
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
                onCancelAgentTask={handleCancelAgentTask}
            />
        )}

        {/* Sidebar Resize Handle */}
        {!isRightPanelMaximized && layout.showSidebar && <div className="w-2 bg-gray-900 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => handleResizeStart('sidebar', e)} />}

        {/* Main Editor - Hidden if Maximized */}
        {!isRightPanelMaximized && (
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
                                    onSave={() => addToast('success', 'File Saved')}
                                    onCursorChange={(line, col) => setCursorPos({ line, col })}
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
        )}

        {/* Resize Handle for Right Panel (Hidden if maximized) */}
        {!isRightPanelMaximized && layout.showRight && <div className="w-2 bg-gray-900 border-l border-gray-800 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => handleResizeStart('rightPanel', e)} />}

        {/* Right Panel - Expanded to full width if maximized */}
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
                    onExport={handleExport} onRefreshPreview={handleRefreshPreview} roadmap={roadmap} isGeneratingPlan={isGeneratingPlan} onGeneratePlan={handleGeneratePlan}
                    onExecutePhase={handleExecutePhase} onToggleTask={handleToggleRoadmapTask} onLog={(l) => setTerminalLogs(p => [...p, l])} files={files} onSaveFile={addFile}
                    isMaximized={isRightPanelMaximized}
                    onToggleMaximize={toggleMaximizeRight}
                />
            </div>
        )}
      </div>

      {/* Status Bar & Chat */}
      <div className="h-6 bg-gray-900 border-t border-gray-800 text-gray-400 text-[10px] flex items-center px-3 justify-between select-none z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><GitBranch size={10} /><span>{currentBranch}</span></div>
            <div className="hidden md:block w-px h-3 bg-gray-700"></div>
            <div className="hidden md:block">Ln {cursorPos.line}, Col {cursorPos.col}</div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => setShowVoiceCommander(true)} title="Voice Command"><Mic size={10}/></button>
           <button onClick={() => toggleLayout('bottom')} title="Toggle Terminal (Ctrl+J)"><PanelBottom size={10}/></button>
           <button onClick={() => toggleLayout('right')} title="Toggle Sidebar (Ctrl+B)"><Columns size={10}/></button>
        </div>
      </div>

      {/* Chat Interface - Starts Minimized on Mobile */}
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
                    {chatHistory.slice().reverse().map((msg) => <MessageRenderer key={msg.id} message={msg} onApplyCode={handleApplyCode} onApplyAll={handleApplyAll} onAutoFix={handleAutoFix} />)}
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
