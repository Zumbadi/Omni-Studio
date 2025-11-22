
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { File as FileIcon, Play, ChevronRight, ChevronDown, MoreVertical, Box, Smartphone, Paperclip, Video, Mic, ArrowRight, Check, RefreshCw, Rocket, Loader2, Globe, ExternalLink, Zap, Server, Plus, Trash2, MicOff, Download, Network, GitBranch, Search, Files, Settings, GitCommit, Tablet, Database, QrCode, History, Image, Music, LayoutTemplate, X, Command, Package, AlertTriangle, AlertCircle, Info, Sidebar as SidebarIcon, PanelBottom, Columns, Edit2, Copy, MessageSquare, FileText, Puzzle, UploadCloud, AlignLeft, Link, User, Bug, Replace, Clock, GitPullRequest, RotateCcw, Menu, Map, Flag, ListChecks, BrainCircuit, ShieldCheck, Bot, Code2, ShieldAlert, Shield, FileSearch, SplitSquareHorizontal, Minimize2, Maximize2 } from 'lucide-react';
import { WEB_FILE_TREE, NATIVE_FILE_TREE, NODE_FILE_TREE, MOCK_DEPLOYMENTS, SYSTEM_COMMANDS, MOCK_EXTENSIONS, MOCK_COMMITS } from '../constants';
import { FileNode, ChatMessage, Project, ProjectType, SocialPost, AudioTrack, Extension, GitCommit as GitCommitType, ProjectPhase, AgentTask, AuditIssue } from '../types';
import { CodeEditor, CodeEditorHandle } from '../components/CodeEditor';
import { Terminal } from '../components/Terminal';
import { generateCodeResponse, generateProjectPlan, critiqueCode, runAgentFileTask, generateTerminalCommand, runSecurityAudit, generateGhostText } from '../services/geminiService';
import { Button } from '../components/Button';
import JSZip from 'jszip';
import { generatePreviewHtml } from '../utils/runtime';
import { MessageRenderer } from '../components/MessageRenderer';
import { FileExplorer } from '../components/FileExplorer';
import { PreviewPanel } from '../components/PreviewPanel';
import { DiffEditor } from '../components/DiffEditor';
import { findRelevantContext } from '../utils/projectAnalysis';

interface WorkspaceProps {
  project: Project | null;
}

interface SearchResult {
  fileId: string;
  fileName: string;
  line: number;
  preview: string;
}

interface Problem {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  fileId: string | null;
}

export const Workspace: React.FC<WorkspaceProps> = ({ project }) => {
  const isNative = project?.type === ProjectType.REACT_NATIVE || project?.type === ProjectType.IOS_APP || project?.type === ProjectType.ANDROID_APP;
  const isBackend = project?.type === ProjectType.NODE_API;
  
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [openFiles, setOpenFiles] = useState<string[]>(['1']); 
  
  // Layout & Resizing State
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [rightPanelWidth, setRightPanelWidth] = useState(500);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(200);
  const [splitRatio, setSplitRatio] = useState(50); // Percentage for split editor

  // Split View State
  const [isSplitView, setIsSplitView] = useState(false);
  const [secondaryFileId, setSecondaryFileId] = useState<string | null>(null);
  
  // Diff View State
  const [diffFileId, setDiffFileId] = useState<string | null>(null);

  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture'>('preview');
  const [bottomPanelTab, setBottomPanelTab] = useState<'terminal' | 'problems'>('terminal');
  
  const [isUploading, setIsUploading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeModel, setActiveModel] = useState('Gemini 2.5 Flash');
  
  // Project Plan / Roadmap
  const [roadmap, setRoadmap] = useState<ProjectPhase[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  // Critic
  const [enableCritic, setEnableCritic] = useState(true);
  const [isReviewing, setIsReviewing] = useState(false);

  // Git State
  const [commits, setCommits] = useState<GitCommitType[]>(MOCK_COMMITS);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  // Editor Settings
  const [editorConfig, setEditorConfig] = useState<any>({});
  const editorRef = useRef<CodeEditorHandle>(null);
  const [editorSelection, setEditorSelection] = useState('');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Debug State
  const [debugVariables, setDebugVariables] = useState<{name: string, value: string}[]>([]);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);

  // Agents State
  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask | null>(null);

  // Audit State
  const [auditIssues, setAuditIssues] = useState<AuditIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  // IDE Layout State
  const [activeActivity, setActiveActivity] = useState<'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS' | 'AUDIT'>('EXPLORER');
  const [layout, setLayout] = useState({
    showSidebar: window.innerWidth >= 768,
    showBottom: true,
    showRight: window.innerWidth >= 1024
  });

  const [commitMessage, setCommitMessage] = useState('');
  const [assets, setAssets] = useState<{type: 'image' | 'video' | 'audio', url: string, name: string}[]>([]);
  
  // Extensions State
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);
  const [extensionQuery, setExtensionQuery] = useState('');

  // Upload Inputs Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [remoteDirName, setRemoteDirName] = useState<string | null>(null);

  // Problems/Linter State
  const [problems, setProblems] = useState<Problem[]>([]);

  // Command Palette State
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, fileId: null });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  // Vision State
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);

  // Resizing Logic
  const startResizing = useCallback((direction: 'sidebar' | 'rightPanel' | 'bottomPanel' | 'split', e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startSidebarWidth = sidebarWidth;
      const startRightWidth = rightPanelWidth;
      const startBottomHeight = bottomPanelHeight;
      const startSplitRatio = splitRatio;
      const editorContainerWidth = document.getElementById('editor-container')?.clientWidth || 800;

      const onMouseMove = (moveEvent: MouseEvent) => {
          if (direction === 'sidebar') {
              const newWidth = Math.max(180, Math.min(500, startSidebarWidth + (moveEvent.clientX - startX)));
              setSidebarWidth(newWidth);
          } else if (direction === 'rightPanel') {
              const newWidth = Math.max(300, Math.min(1000, startRightWidth - (moveEvent.clientX - startX)));
              setRightPanelWidth(newWidth);
          } else if (direction === 'bottomPanel') {
              const newHeight = Math.max(100, Math.min(600, startBottomHeight - (moveEvent.clientY - startY)));
              setBottomPanelHeight(newHeight);
          } else if (direction === 'split') {
              const deltaPixels = moveEvent.clientX - startX;
              const deltaPercent = (deltaPixels / editorContainerWidth) * 100;
              const newRatio = Math.max(20, Math.min(80, startSplitRatio + deltaPercent));
              setSplitRatio(newRatio);
          }
      };

      const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          document.body.style.cursor = 'default';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = direction === 'bottomPanel' ? 'ns-resize' : 'col-resize';
  }, [sidebarWidth, rightPanelWidth, bottomPanelHeight, splitRatio]);

  // Responsive listener
  useEffect(() => {
      const handleResize = () => {
          const isMobile = window.innerWidth < 768;
          setLayout(prev => ({
              ...prev,
              showSidebar: !isMobile && prev.showSidebar,
              showRight: window.innerWidth >= 1024 && prev.showRight
          }));
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Click Away Listeners for Modals
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (contextMenu.visible && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
              setContextMenu(prev => ({ ...prev, visible: false }));
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu]);

  // Load Assets with Event Listener for Real-time updates
  useEffect(() => {
    const loadAssets = () => {
        const posts: SocialPost[] = JSON.parse(localStorage.getItem('omni_social_posts') || '[]');
        const audio: AudioTrack[] = JSON.parse(localStorage.getItem('omni_audio_tracks') || '[]');
        const newAssets: typeof assets = [];

        posts.forEach(p => {
           if(p.thumbnail) newAssets.push({ type: 'image', url: p.thumbnail, name: `thumb_${p.id}.jpg` });
           p.scenes?.forEach((s, i) => {
              if(s.imageUrl) newAssets.push({ type: 'image', url: s.imageUrl, name: `scene_${p.id}_${i+1}.png` });
              if(s.videoUrl) newAssets.push({ type: 'video', url: s.videoUrl, name: `video_${p.id}_${i+1}.mp4` });
           });
        });

        audio.forEach(a => {
           if(a.audioUrl) newAssets.push({ type: 'audio', url: a.audioUrl, name: `${a.name.replace(/[^a-z0-9]/gi, '_')}.mp3` });
        });
        setAssets(newAssets);
    };

    loadAssets();
    window.addEventListener('omniAssetsUpdated', loadAssets);
    return () => window.removeEventListener('omniAssetsUpdated', loadAssets);
  }, []);

  // Initialize project files (Persistent) and Load Settings with Live Sync
  useEffect(() => {
    const loadSettings = () => {
        const savedModel = localStorage.getItem('omni_active_model');
        if (savedModel) setActiveModel(savedModel);
        
        const savedConfig = localStorage.getItem('omni_editor_config');
        if (savedConfig) {
           const parsed = JSON.parse(savedConfig);
           setEditorConfig(parsed);
           
           if (parsed.vimMode) {
               setExtensions(prev => prev.map(e => e.name === 'Vim' ? { ...e, installed: true } : e));
           }
        }
    };
    
    loadSettings();
    window.addEventListener('omniSettingsChanged', loadSettings);
    
    if (project) {
       const storageKey = `omni_files_${project.id}`;
       const savedFiles = localStorage.getItem(storageKey);
       
       const tabsKey = `omni_open_tabs_${project.id}`;
       const savedTabs = localStorage.getItem(tabsKey);
       if (savedTabs) {
           const parsed = JSON.parse(savedTabs);
           setOpenFiles(parsed.openFiles || ['1']);
           setActiveFileId(parsed.activeFileId || '1');
       }
       
       if (savedFiles) {
         setFiles(JSON.parse(savedFiles));
       } else {
         if (isNative) setFiles(NATIVE_FILE_TREE);
         else if (isBackend) setFiles(NODE_FILE_TREE);
         else setFiles(WEB_FILE_TREE);
       }

       const savedRoadmap = localStorage.getItem(`omni_roadmap_${project.id}`);
       if (savedRoadmap) setRoadmap(JSON.parse(savedRoadmap));

       let initLogs = ['> Initializing environment...'];
       if (isNative) initLogs = ['> Starting Metro Bundler...', '> Expo Go ready on port 19000'];
       if (isBackend) initLogs = ['> node index.js', '> Server running at http://localhost:3000'];
       if (!isNative && !isBackend) initLogs = ['> Booting WebContainer...', '> Container initialized.', '> npm install'];
       
       setTerminalLogs(initLogs);

       const savedModel = localStorage.getItem('omni_active_model');
       setChatHistory([{ 
         id: '0', 
         role: 'system', 
         text: `Hello! I am Omni-Studio. I've loaded your ${project.type} project (${project.name}). Active Model: ${savedModel || 'Default'}`, 
         timestamp: Date.now() 
       }]);
    }

    return () => window.removeEventListener('omniSettingsChanged', loadSettings);
  }, [project?.id, project?.type, isNative, isBackend]);

  // Save tabs state on change
  useEffect(() => {
      if (project) {
          const tabsKey = `omni_open_tabs_${project.id}`;
          localStorage.setItem(tabsKey, JSON.stringify({ openFiles, activeFileId }));
          
          const roadmapKey = `omni_roadmap_${project.id}`;
          localStorage.setItem(roadmapKey, JSON.stringify(roadmap));
      }
  }, [openFiles, activeFileId, project, roadmap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          handleSaveProject();
       }
       if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'k')) {
          e.preventDefault();
          setShowCommandPalette(prev => !prev);
          setTimeout(() => commandInputRef.current?.focus(), 50);
       }
       if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          const submitBtn = document.getElementById('chat-submit-btn');
          if (submitBtn) submitBtn.click();
       }
       if (e.key === 'Escape') {
          setShowCommandPalette(false);
          setContextMenu(prev => ({...prev, visible: false}));
          setShowBranchMenu(false);
          setDiffFileId(null); // Close diff on escape
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, files]);

  const getAllFiles = useCallback((nodes: FileNode[], parentPath = ''): {node: FileNode, path: string}[] => {
    let results: {node: FileNode, path: string}[] = [];
    nodes.forEach(node => {
      const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name;
      if (node.type === 'file') results.push({ node, path: currentPath });
      if (node.children) results = results.concat(getAllFiles(node.children, currentPath));
    });
    return results;
  }, []);

  const changedFiles = getAllFiles(files).filter(f => f.node.gitStatus && f.node.gitStatus !== 'unmodified').map(f => f.node);
  const packageJsonNode = getAllFiles(files).find(f => f.node.name === 'package.json')?.node;

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    const clearGitStatus = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => ({
        ...node,
        gitStatus: 'unmodified',
        children: node.children ? clearGitStatus(node.children) : undefined
      }));
    };
    const newCommitHash = Math.random().toString(16).slice(2, 9);
    const newCommit: GitCommitType = { id: `c-${Date.now()}`, message: commitMessage, author: 'You', date: 'Just now', hash: newCommitHash };
    setFiles(clearGitStatus(files));
    setCommits(prev => [newCommit, ...prev]);
    setTerminalLogs(prev => [...prev, `> git commit -m "${commitMessage}"`, `> [${currentBranch} ${newCommitHash}] ${commitMessage}`]);
    setCommitMessage('');
    if (project) { const storageKey = `omni_files_${project.id}`; localStorage.setItem(storageKey, JSON.stringify(clearGitStatus(files))); }
  };

  const formatCode = () => {
      const prettier = extensions.find(e => e.name.includes('Prettier') && e.installed);
      if (prettier && activeFile && activeFile.content) {
          setTerminalLogs(prev => [...prev, `> Prettier: Formatted ${activeFile.name}`]);
      }
  };

  const handleSaveProject = () => {
    if (project) {
      formatCode();
      const storageKey = `omni_files_${project.id}`;
      localStorage.setItem(storageKey, JSON.stringify(files));
      setTerminalLogs(prev => [...prev, `> Project saved locally to ${storageKey}`]);
      const btn = document.getElementById('save-btn');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg> Saved`;
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
      }
    }
  };

  const handleExport = async () => {
      if (!project) return;
      const zip = new JSZip();
      const addFilesToZip = (nodes: FileNode[], currentPath: string) => {
          nodes.forEach(node => {
              if (node.type === 'file' && node.content) {
                  zip.file(`${currentPath}${node.name}`, node.content);
              } else if (node.type === 'directory' && node.children) {
                  addFilesToZip(node.children, `${currentPath}${node.name}/`);
              }
          });
      };
      addFilesToZip(files, '');
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      setTerminalLogs(prev => [...prev, `> Exported project to ${a.download}`]);
  };

  const findFileById = useCallback((nodes: FileNode[], id: string): FileNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findFileById(node.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }, []);

  const activeFile = findFileById(files, activeFileId);
  const secondaryFile = secondaryFileId ? findFileById(files, secondaryFileId) : null;
  const diffFile = diffFileId ? findFileById(files, diffFileId) : null;

  useEffect(() => {
     if (!activeFile || !activeFile.content || activeActivity !== 'DEBUG') return;
     const vars: {name: string, value: string}[] = [];
     const content = activeFile.content;
     const regex = /(?:const|let|var)\s+(\w+)\s*=\s*([^;]+)/g;
     let match;
     while ((match = regex.exec(content)) !== null) {
         vars.push({ name: match[1], value: match[2].trim() });
     }
     if (content.includes('useState')) {
         const stateRegex = /const\s*\[(\w+),\s*set\w+\]\s*=\s*useState\(([^)]+)\)/g;
         while ((match = stateRegex.exec(content)) !== null) {
             vars.push({ name: match[1], value: match[2].trim() });
         }
     }
     setDebugVariables(vars);
  }, [activeFile, activeActivity]);

  useEffect(() => {
      if (!activeFile || !activeFile.content) {
          setProblems([]);
          return;
      }
      const newProblems: Problem[] = [];
      const lines = activeFile.content.split('\n');
      lines.forEach((line, idx) => {
          if (line.includes('console.log')) newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Unexpected console statement', severity: 'warning' });
          if (line.includes('TODO') || line.includes('FIXME')) newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Pending task found', severity: 'info' });
          if (line.length > 120) newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Line exceeds 120 characters', severity: 'warning' });
          if (line.includes('var ')) newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Use "let" or "const" instead of "var"', severity: 'error' });
      });
      setProblems(newProblems);
  }, [activeFile]);

  useEffect(() => {
    if (isBackend) return; 
    const mainFile = findFileById(files, '1'); 
    if (mainFile && mainFile.content) {
      const timeoutId = setTimeout(() => {
        const html = generatePreviewHtml(mainFile.content!, isNative);
        setPreviewSrc(html);
        setTerminalLogs(prev => {
           const lastLog = prev[prev.length - 1];
           return lastLog === '> Hot Reloading...' ? prev : [...prev, '> Hot Reloading...'];
        });
      }, 800); 
      return () => clearTimeout(timeoutId);
    }
  }, [files, isNative, isBackend, findFileById]);

  const updateFileContent = (nodes: FileNode[], id: string, newContent: string): FileNode[] => {
    return nodes.map(node => {
      if (node.id === id) return { ...node, content: newContent, gitStatus: 'modified' };
      if (node.children) return { ...node, children: updateFileContent(node.children, id, newContent) };
      return node;
    });
  };

  const handleFileChange = (newContent: string, targetId?: string) => {
    const idToUpdate = targetId || activeFileId;
    setFiles(updateFileContent(files, idToUpdate, newContent));
  };
  
  const handleReplace = () => {
      if (!searchQuery) return;
      const replaceInNode = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
              if (node.type === 'file' && node.content) {
                  const newContent = node.content.split(searchQuery).join(replaceQuery);
                  if (newContent !== node.content) return { ...node, content: newContent, gitStatus: 'modified' };
              }
              if (node.children) return { ...node, children: replaceInNode(node.children) };
              return node;
          });
      };
      setFiles(replaceInNode(files));
      setTerminalLogs(prev => [...prev, `> Replaced '${searchQuery}' with '${replaceQuery}'`]);
      handleSearch(searchQuery);
  };

  const upsertFileByPath = (nodes: FileNode[], pathParts: string[], newContent: string): FileNode[] => {
    const [currentPart, ...restParts] = pathParts;
    if (restParts.length === 0) {
       const existingFile = nodes.find(n => n.name === currentPart && n.type === 'file');
       if (existingFile) return nodes.map(n => n.id === existingFile.id ? { ...n, content: newContent, gitStatus: 'modified' } : n);
       else {
          const newFile: FileNode = { id: Date.now().toString() + Math.random(), name: currentPart, type: 'file', content: newContent, gitStatus: 'added' };
          return [...nodes, newFile];
       }
    }
    const existingDir = nodes.find(n => n.name === currentPart && n.type === 'directory');
    if (existingDir) {
       return nodes.map(n => n.id === existingDir.id ? { ...n, isOpen: true, children: upsertFileByPath(n.children || [], restParts, newContent) } : n);
    } else {
       const newDir: FileNode = { id: Date.now().toString() + Math.random(), name: currentPart, type: 'directory', children: [], isOpen: true };
       newDir.children = upsertFileByPath([], restParts, newContent);
       return [...nodes, newDir];
    }
  };

  const handleApplyCode = (code: string) => {
    const filenameMatch = code.match(/^\/\/ filename: (.*)/);
    if (filenameMatch) {
        const targetPath = filenameMatch[1].trim();
        const normalizedPath = targetPath.replace(/^(\.\/|\/)/, '');
        const pathParts = normalizedPath.split('/');
        setFiles(prev => upsertFileByPath(prev, pathParts, code));
        setTerminalLogs(prev => [...prev, `> Smart Apply: Updated ${normalizedPath}`]);
    } else if (activeFile) {
      handleFileChange(code);
      setTerminalLogs(prev => [...prev, `> Applied changes to ${activeFile.name}`]);
    } else {
      setTerminalLogs(prev => [...prev, `> Error: No file selected and no filename specified in code.`]);
    }
  };

  const handleApplyAll = (codes: string[]) => {
      codes.forEach(code => handleApplyCode(code));
      setTerminalLogs(prev => [...prev, `> Bulk Apply: Processed ${codes.length} file updates.`]);
  };

  const handleCodeAction = (action: string, selectedCode: string) => {
      const fileContext = activeFile ? ` in ${activeFile.name}` : '';
      let prompt = '';
      if (action === 'Explain') prompt = `Explain this code${fileContext}:\n\n${selectedCode}`;
      if (action === 'Refactor') prompt = `Refactor this code${fileContext} to be cleaner and more efficient:\n\n${selectedCode}`;
      if (action === 'Fix') prompt = `Find and fix any potential bugs in this code${fileContext}:\n\n${selectedCode}`;
      setChatInput(prompt);
      setIsChatOpen(true);
      const userMsg = { id: Date.now().toString(), role: 'user' as const, text: prompt, timestamp: Date.now() };
      setChatHistory(prev => [...prev, userMsg]);
      triggerGeneration(prompt);
  };

  const handleGhostTextRequest = async (prefix: string, suffix: string): Promise<string> => {
      return await generateGhostText(prefix, suffix);
  };

  const handleToggleBreakpoint = (line: number) => {
      setBreakpoints(prev => {
          if (prev.includes(line)) {
              setTerminalLogs(logs => [...logs, `> Removed breakpoint at line ${line}`]);
              return prev.filter(l => l !== line);
          } else {
              setTerminalLogs(logs => [...logs, `> Added breakpoint at line ${line}`]);
              return [...prev, line];
          }
      });
  };

  const handleQuickFix = (problem: Problem) => {
      const file = files.find(f => f.name === problem.file || f.name.endsWith(problem.file));
      if (!file) return;
      const prompt = `Fix the following issue in ${problem.file} at line ${problem.line}: "${problem.message}". Return the corrected code block.`;
      setChatInput(prompt);
      setIsChatOpen(true);
      const userMsg = { id: Date.now().toString(), role: 'user' as const, text: prompt, timestamp: Date.now() };
      setChatHistory(prev => [...prev, userMsg]);
      triggerGeneration(prompt);
  };

  const handleAddFile = () => {
    const name = prompt("Enter file name (e.g. Component.tsx):");
    if (!name) return;
    const newFile: FileNode = { id: Date.now().toString(), name, type: 'file', content: '// New file generated', gitStatus: 'added' };
    const addNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
            if (node.id === 'root' && node.children) return { ...node, children: [...node.children, newFile] };
            if (node.children) return { ...node, children: addNode(node.children) };
            return node;
        });
    };
    setFiles(addNode(files));
    setTerminalLogs(prev => [...prev, `> Created file: ${name}`]);
    setActiveFileId(newFile.id);
    if (!openFiles.includes(newFile.id)) setOpenFiles([...openFiles, newFile.id]);
  };
  
  const handleAddFolder = () => {
     const name = prompt("Enter folder name:");
     if (!name) return;
     const newFolder: FileNode = { id: Date.now().toString(), name, type: 'directory', children: [], isOpen: true };
     const addNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
            if (node.id === 'root' && node.children) return { ...node, children: [...node.children, newFolder] };
            if (node.children) return { ...node, children: addNode(node.children) };
            return node;
        });
    };
    setFiles(addNode(files));
  };

  const handleDeleteNode = (e: React.MouseEvent | null, id: string) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this?")) return;
    const deleteNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.filter(node => node.id !== id).map(node => ({ ...node, children: node.children ? deleteNode(node.children) : undefined }));
    };
    setFiles(deleteNode(files));
    if (openFiles.includes(id)) {
        const newOpenFiles = openFiles.filter(fid => fid !== id);
        setOpenFiles(newOpenFiles);
        if (activeFileId === id) setActiveFileId(newOpenFiles[newOpenFiles.length - 1] || '');
    }
  };

  const handleRenameNode = (id: string) => {
     const target = findFileById(files, id);
     if (!target) return;
     const newName = prompt("Enter new name:", target.name);
     if (!newName || newName === target.name) return;
     const renameNode = (nodes: FileNode[]): FileNode[] => {
         return nodes.map(node => {
             if (node.id === id) return { ...node, name: newName, gitStatus: 'modified' };
             if (node.children) return { ...node, children: renameNode(node.children) };
             return node;
         });
     };
     setFiles(renameNode(files));
  };

  const handleDuplicateNode = (id: string) => {
      const target = findFileById(files, id);
      if (!target || target.type === 'directory') return;
      const copyNode = (nodes: FileNode[]): FileNode[] => {
         return nodes.flatMap(node => {
             if (node.id === id) {
                 const copy: FileNode = { ...node, id: Date.now().toString() + Math.random(), name: `${node.name.split('.')[0]}_copy.${node.name.split('.').pop()}`, gitStatus: 'added' };
                 return [node, copy];
             }
             if (node.children) return [{ ...node, children: copyNode(node.children) }];
             return [node];
         });
      };
      setFiles(copyNode(files));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const newFile: FileNode = { id: Date.now().toString(), name: file.name, type: 'file', content: content, gitStatus: 'added' };
        const addNode = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(node => {
                if (node.id === 'root' && node.children) return { ...node, children: [...node.children, newFile] };
                if (node.children) return { ...node, children: addNode(node.children) };
                return node;
            });
        };
        setFiles(addNode(files));
        setTerminalLogs(prev => [...prev, `> Uploaded: ${file.name}`]);
      };
      reader.readAsText(file);
    }
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setTerminalLogs(prev => [...prev, `> Uploading folder... processing ${fileList.length} files`]);
    let processed = 0;
    const total = fileList.length;
    Array.from(fileList).forEach((file: any) => {
       const reader = new FileReader();
       reader.onload = (ev) => {
          const content = ev.target?.result as string;
          const path = file.webkitRelativePath || file.name;
          const parts = path.split('/');
          setFiles(prev => upsertFileByPath(prev, parts, content));
          processed++;
          if (processed === total) setTerminalLogs(prev => [...prev, `> Folder upload complete.`]);
       };
       reader.readAsText(file);
    });
  };
  
  const handleConnectRemote = async () => {
     if ('showDirectoryPicker' in window) {
         try {
             // @ts-ignore
             const dirHandle = await window.showDirectoryPicker();
             setRemoteDirName(dirHandle.name);
             setTerminalLogs(prev => [...prev, `> Connected to local folder: ${dirHandle.name}`]);
             const readDirectory = async (dirHandle: any, path: string = ''): Promise<FileNode[]> => {
                 const nodes: FileNode[] = [];
                 for await (const entry of dirHandle.values()) {
                     if (entry.kind === 'file') {
                         const file = await entry.getFile();
                         if (file.name.match(/\.(png|jpg|jpeg|gif|ico|mp4|mp3)$/i)) continue; 
                         const content = await file.text();
                         nodes.push({ id: path + entry.name, name: entry.name, type: 'file', content, gitStatus: 'unmodified' });
                     } else if (entry.kind === 'directory') {
                         if (entry.name === 'node_modules' || entry.name === '.git') continue;
                         const children = await readDirectory(entry, path + entry.name + '/');
                         nodes.push({ id: path + entry.name, name: entry.name, type: 'directory', children, isOpen: false });
                     }
                 }
                 return nodes;
             };
             setTerminalLogs(prev => [...prev, `> Scanning local files...`]);
             const localFiles = await readDirectory(dirHandle);
             setFiles([{ id: 'root', name: dirHandle.name, type: 'directory', children: localFiles, isOpen: true }]);
             setTerminalLogs(prev => [...prev, `> Sync complete. Loaded project from disk.`]);
         } catch (e) {
             console.error(e);
             setTerminalLogs(prev => [...prev, `> Error connecting to local folder.`]);
         }
     } else {
         alert("File System Access API not supported in this browser.");
     }
  };

  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
     e.preventDefault();
     setContextMenu({ visible: true, x: e.clientX, y: e.clientY, fileId });
  };

  const handleFileClick = (id: string) => {
      // In split view, allow updating secondary if modifier key held
      if (isSplitView && secondaryFileId === null) {
          setSecondaryFileId(id);
      } else {
          setActiveFileId(id);
      }
      
      if (!openFiles.includes(id)) setOpenFiles([...openFiles, id]);
  };
  
  const handleCloseTab = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const newOpenFiles = openFiles.filter(fid => fid !== id);
      setOpenFiles(newOpenFiles);
      if (activeFileId === id) setActiveFileId(newOpenFiles[newOpenFiles.length - 1] || '');
      if (secondaryFileId === id) setSecondaryFileId(null);
  };
  
  const handleInstallPackage = () => {
      const pkg = prompt("Enter package name (e.g., axios):");
      if (!pkg || !packageJsonNode || !packageJsonNode.content) return;
      setTerminalLogs(prev => [...prev, `> npm install ${pkg}`]);
      setTimeout(() => {
          try {
              const json = JSON.parse(packageJsonNode.content!);
              if (!json.dependencies) json.dependencies = {};
              json.dependencies[pkg] = '^1.0.0';
              handleFileChange(JSON.stringify(json, null, 2), packageJsonNode.id);
              setTerminalLogs(prev => [...prev, `> + ${pkg}@1.0.0`]);
          } catch (e) {
              setTerminalLogs(prev => [...prev, `> Error parsing package.json`]);
          }
      }, 1000);
  };

  const handleRunScript = (script: string, cmd: string) => {
      setTerminalLogs(prev => [...prev, `> npm run ${script}`, `> ${cmd}`]);
      setTimeout(() => {
          setTerminalLogs(prev => [...prev, `> Script '${script}' executed successfully.`]);
      }, 1500);
  };

  const toggleExtension = (id: string) => {
    setExtensions(prev => prev.map(ext => {
        if (ext.id === id) {
             const newInstalled = !ext.installed;
             if (ext.name === 'Vim') {
                 setEditorConfig((prev: any) => ({ ...prev, vimMode: newInstalled }));
                 setTerminalLogs(prev => [...prev, `> Vim Mode ${newInstalled ? 'Enabled' : 'Disabled'}`]);
             }
             return { ...ext, installed: newInstalled };
        }
        return ext;
    }));
  };

  const handleJumpToLine = (fileId: string, line: number) => {
    if (fileId !== activeFileId) {
        handleFileClick(fileId);
        setTimeout(() => editorRef.current?.scrollToLine(line), 100);
    } else {
        editorRef.current?.scrollToLine(line);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
        setSearchResults([]);
        return;
    }
    const results: SearchResult[] = [];
    const searchNodes = (nodes: FileNode[]) => {
        nodes.forEach(node => {
            if (node.type === 'file' && node.content) {
                const lines = node.content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes(query.toLowerCase())) {
                        results.push({ fileId: node.id, fileName: node.name, line: idx + 1, preview: line.trim().substring(0, 60) });
                    }
                });
            }
            if (node.children) searchNodes(node.children);
        });
    };
    searchNodes(files);
    setSearchResults(results);
  };

  // Agent Logic
  const handleStartAgent = async (type: AgentTask['type'], name: string) => {
      const allFiles = getAllFiles(files).filter(f => f.node.type === 'file' && (f.node.name.endsWith('.tsx') || f.node.name.endsWith('.ts') || f.node.name.endsWith('.js')));
      if (allFiles.length === 0) return;

      const newTask: AgentTask = {
          id: Date.now().toString(),
          type,
          name,
          status: 'running',
          totalFiles: allFiles.length,
          processedFiles: 0,
          logs: [`> Starting ${name}...`]
      };
      setActiveAgentTask(newTask);

      // Simulate processing queue
      for (let i = 0; i < allFiles.length; i++) {
          const { node, path } = allFiles[i];
          setActiveAgentTask(prev => prev ? ({ ...prev, currentFile: path, logs: [...prev.logs, `> Processing ${path}...`] }) : null);
          
          // Artificial delay for realism
          await new Promise(resolve => setTimeout(resolve, 800));

          // Run actual API call for the first 3 files only to save quota in demo
          if (i < 3 && node.content) {
              const newContent = await runAgentFileTask(type as any, path, node.content);
              if (newContent) {
                  // Apply changes
                  const isNewFile = newContent.includes('// filename:');
                  if (isNewFile) {
                      handleApplyCode(newContent);
                  } else {
                      // If refactoring/docs, update existing
                      setFiles(prev => updateFileContent(prev, node.id, newContent));
                  }
                  setActiveAgentTask(prev => prev ? ({ ...prev, logs: [...prev.logs, `> Updated ${path}`] }) : null);
              }
          }

          setActiveAgentTask(prev => prev ? ({ ...prev, processedFiles: i + 1 }) : null);
      }

      setActiveAgentTask(prev => prev ? ({ ...prev, status: 'completed', currentFile: undefined, logs: [...prev.logs, `> Task completed successfully.`] }) : null);
  };

  const handleTerminalAiFix = async (errorMsg: string) => {
      setTerminalLogs(prev => [...prev, `> Omni: Analyzing error...`]);
      const prompt = `I got this error in the terminal: "${errorMsg}". What is the command to fix it? Return ONLY the command text.`;
      await generateCodeResponse(prompt, '', project?.type || ProjectType.REACT_WEB, '', activeModel, (chunk) => {
          // Simple simulation since generateCodeResponse streams
      });
      
      // Mock response for speed
      setTimeout(() => {
          const fixCommand = errorMsg.includes('not found') ? 'npm install' : 'npm audit fix';
          setTerminalLogs(prev => [...prev, `> Suggested Fix: ${fixCommand}`, `> Running fix...`]);
          setTimeout(() => {
              handleTerminalCommand(fixCommand);
          }, 1000);
      }, 1500);
  };

  const handleTerminalCommand = async (cmd: string) => {
    const command = cmd.trim();
    
    // AI Helper
    if (command.startsWith('?')) {
        const query = command.slice(1).trim();
        setTerminalLogs(prev => [...prev, `${command}`, `> AI: Interpreting...`]);
        const suggestion = await generateTerminalCommand(query, project?.type || 'web');
        if (suggestion.startsWith('echo')) {
             setTerminalLogs(prev => [...prev, `AI: ${suggestion.replace("echo '", "").replace("'", "")}`]);
        } else {
             setTerminalLogs(prev => [...prev, `AI Suggestion: ${suggestion}`, `> Executing...`]);
             setTimeout(() => handleTerminalCommand(suggestion), 1000);
        }
        return;
    }

    const parts = command.split(' ');
    const base = parts[0];
    setTerminalLogs(prev => [...prev, `${command}`]);
    switch (base) {
      case 'clear': setTerminalLogs([]); break;
      case 'ls':
        const root = files.find(f => f.id === 'root');
        if (root && root.children) setTerminalLogs(prev => [...prev, root.children.map(c => c.type === 'directory' ? `${c.name}/` : c.name).join('  ')]);
        break;
      case 'git':
        if (parts[1] === 'status') {
             if (changedFiles.length === 0) setTerminalLogs(prev => [...prev, `On branch ${currentBranch}`, 'nothing to commit, working tree clean']);
             else setTerminalLogs(prev => [...prev, `On branch ${currentBranch}`, 'Changes not staged for commit:', ...changedFiles.map(f => `  modified: ${f.name}`)]);
        } else if (parts[1] === 'commit') setTerminalLogs(prev => [...prev, 'Please use the Source Control view to commit changes.']);
        else if (parts[1] === 'checkout' && parts[2] === '-b') { const newBranch = parts[3]; if(newBranch) { setCurrentBranch(newBranch); setTerminalLogs(prev => [...prev, `Switched to a new branch '${newBranch}'`]); } }
        else setTerminalLogs(prev => [...prev, `git: '${parts[1]}' is not a git command. See 'git --help'.`]);
        break;
      case 'pwd': setTerminalLogs(prev => [...prev, '/usr/projects/app']); break;
      case 'npm':
        if (parts[1] === 'start') {
           if (isBackend) setTerminalLogs(prev => [...prev, '> node index.js', '> Server listening on port 3000']);
           else setTerminalLogs(prev => [...prev, '> Starting development server...', '> Ready on http://localhost:3000']);
           setTerminalLogs(prev => [...prev, '> Hot Reloading...']);
        } else if (parts[1] === 'install' || parts[1] === 'i') {
           setTimeout(() => setTerminalLogs(prev => [...prev, `> added 1 package in ${Math.floor(Math.random() * 2000) / 1000}s`]), 800);
        } else if (parts[1] === 'test') {
            setTerminalLogs(prev => [...prev, '> react-scripts test', '']);
            setTimeout(() => setTerminalLogs(prev => [...prev, 'PASS  src/App.test.js']), 500);
            setTimeout(() => setTerminalLogs(prev => [...prev, 'FAIL  src/utils.test.js', 'Error: Expected 3 but got 2']), 1000);
            setTimeout(() => setTerminalLogs(prev => [...prev, '', 'Test Suites: 1 passed, 1 failed', 'Tests:       5 passed, 1 failed']), 1500);
        } else if (parts[1] === 'audit') {
            setTerminalLogs(prev => [...prev, 'Running security audit...']);
            setTimeout(() => {
                setTerminalLogs(prev => [...prev, 'found 0 vulnerabilities']);
            }, 1000);
        } else setTerminalLogs(prev => [...prev, `Unknown npm command: ${parts[1]}`]);
        break;
      case 'cat':
        if (parts[1]) {
           const findFile = (nodes: FileNode[]): FileNode | undefined => { for(const n of nodes) { if (n.name === parts[1] && n.type === 'file') return n; if (n.children) { const found = findFile(n.children); if (found) return found; } } return undefined; }
           const file = findFile(files);
           if (file && file.content) setTerminalLogs(prev => [...prev, ...file.content.split('\n').slice(0, 10), '...']);
           else setTerminalLogs(prev => [...prev, `cat: ${parts[1]}: No such file`]);
        } else setTerminalLogs(prev => [...prev, 'usage: cat [file]']);
        break;
      case 'help': setTerminalLogs(prev => [...prev, 'Available commands: ls, cd, cat, clear, npm, pwd, git', 'AI Helper: type ? [query]']); break;
      default: setTerminalLogs(prev => [...prev, `zsh: command not found: ${base}`]);
    }
  };

  const getFileStructureString = (nodes: FileNode[], depth = 0): string => {
      let result = '';
      nodes.forEach(node => {
          const indent = '  '.repeat(depth);
          result += `${indent}- ${node.name} (${node.type})\n`;
          if (node.children) result += getFileStructureString(node.children, depth + 1);
      });
      return result;
  };

  const handleMultimediaUpload = (file?: File) => {
    if (!file) {
       setIsUploading(true);
       setTimeout(() => {
          const transcript = "User wants to change the primary button color to a dark purple gradient and make the text larger.";
          const newMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: `[Attached: demo_video.mp4]\nOmni Vision Analysis: "${transcript}"`, timestamp: Date.now() };
          setChatHistory(prev => [...prev, newMsg]);
          setIsUploading(false);
          setIsChatOpen(true);
          triggerGeneration(newMsg.text);
       }, 1500);
       return;
    }
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
       const base64 = e.target?.result as string;
       setAttachedImage(base64);
       const newMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: `[Attached: ${file.name}]\n`, timestamp: Date.now() };
       setChatHistory(prev => [...prev, newMsg]);
       setIsUploading(false);
       setIsChatOpen(true);
       setChatInput(`Analyze this ${file.type.startsWith('video') ? 'video' : 'image'} and update the code to match the design.`);
    };
    reader.readAsDataURL(file);
  };

  const triggerGeneration = async (prompt: string) => {
    setIsGenerating(true);
    const currentCode = activeFile?.content || '';
    const fileStructure = getFileStructureString(files);
    let responseText = '';
    
    // Inject selection context if available
    let finalPrompt = prompt;
    if (editorSelection) {
        finalPrompt += `\n\n[Referenced Code Selection]:\n\`\`\`\n${editorSelection}\n\`\`\`\nPlease consider this selection in your response.`;
    }

    // Smart Context Retrieval: Find other relevant files
    const extraContext = findRelevantContext(files, prompt);
    if (extraContext) {
        finalPrompt += `\n\n[Relevant Project Files]:${extraContext}`;
    }

    const tempId = 'temp-' + Date.now();
    setChatHistory(prev => [...prev, { id: tempId, role: 'model', text: '', timestamp: Date.now() }]);
    
    await generateCodeResponse(
      finalPrompt, currentCode, project?.type || ProjectType.REACT_WEB, fileStructure, activeModel, 
      (chunk) => { responseText += chunk; setChatHistory(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: responseText } : msg)); },
      attachedImage, chatHistory
    );
    
    // Auto-Critic Logic
    if (enableCritic) {
        runCritique(responseText, finalPrompt);
    }

    setAttachedImage(undefined);
    setEditorSelection(''); // Clear selection after use
    setIsGenerating(false);
  };

  const runCritique = async (code: string, task: string) => {
      setIsReviewing(true);
      const criticRes = await critiqueCode(code, task);
      if (criticRes) {
          setChatHistory(prev => [...prev, {
              id: `critic-${Date.now()}`,
              role: 'critic',
              text: `Omni-Critic Review (Score: ${criticRes.score}/100)`,
              timestamp: Date.now(),
              critique: criticRes
          }]);
      }
      setIsReviewing(false);
  };

  const handleManualReview = () => {
      if (activeFile?.content) {
          setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'user', text: "/review", timestamp: Date.now() }]);
          setIsChatOpen(true);
          runCritique(activeFile.content, "Review this file for errors and best practices.");
      }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (chatInput.startsWith('/')) {
        const [cmd, ...args] = chatInput.split(' ');
        const userMsg = { id: Date.now().toString(), role: 'user' as const, text: chatInput, timestamp: Date.now() };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput('');
        if (cmd === '/clear') { setTimeout(() => setChatHistory([]), 500); return; }
        if (cmd === '/help') { setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'system', text: `Available Commands:\n${SYSTEM_COMMANDS.join('\n')}`, timestamp: Date.now() }]); return; }
        if (cmd === '/explain') { triggerGeneration(`Explain the code in ${activeFile?.name || 'the current file'} step by step. Focus on how the components work.`); return; }
        if (cmd === '/fix') { triggerGeneration(`Find and fix any bugs or errors in ${activeFile?.name || 'the current file'}. Provide the corrected code.`); return; }
        if (cmd === '/review') { handleManualReview(); return; }
    }
    const newUserMsg = { id: Date.now().toString(), role: 'user' as const, text: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');
    triggerGeneration(newUserMsg.text);
  };

  const handleGeneratePlan = async () => {
      if (!project) return;
      setIsGeneratingPlan(true);
      const plan = await generateProjectPlan(project.description || project.name, project.type);
      setRoadmap(plan);
      setIsGeneratingPlan(false);
  };

  const handleExecutePhase = (phase: ProjectPhase) => {
      const prompt = `Implement the goals for ${phase.title}:\n${phase.goals.join('\n')}\n\nFocus on the following tasks:\n${phase.tasks.filter(t => !t.done).map(t => `- ${t.text}`).join('\n')}`;
      setChatInput(prompt);
      setActiveTab('preview'); // Switch away from roadmap to see chat
      setIsChatOpen(true);
  };

  const handleToggleTask = (phaseId: string, taskId: string) => {
      setRoadmap(prev => prev.map(p => {
          if (p.id === phaseId) {
              return { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) };
          }
          return p;
      }));
  };

  const handleStartAudit = async () => {
      setIsAuditing(true);
      const structure = getFileStructureString(files);
      const issues = await runSecurityAudit(structure, packageJsonNode?.content || '{}');
      setAuditIssues(issues);
      setIsAuditing(false);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const assetData = e.dataTransfer.getData('application/omni-asset');
    if (assetData && activeFileId) {
        const asset = JSON.parse(assetData);
        let insertCode = '';
        if (isNative) {
            if (asset.type === 'image') insertCode = `<Image source={{ uri: "${asset.url}" }} style={{ width: 100, height: 100 }} />`;
            else if (asset.type === 'video') insertCode = `// Video component required\n<Video source={{ uri: "${asset.url}" }} style={{ width: 300, height: 200 }} />`;
        } else {
            if (asset.type === 'image') insertCode = `<img src="${asset.url}" alt="${asset.name}" className="w-full rounded-lg" />`;
            else if (asset.type === 'video') insertCode = `<video src="${asset.url}" controls className="w-full rounded-lg" />`;
        }
        if (insertCode && activeFile) { handleFileChange(activeFile.content + '\n' + insertCode); setTerminalLogs(prev => [...prev, `> Inserted asset: ${asset.name}`]); }
        return;
    }
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const file = droppedFiles[0] as File;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) handleMultimediaUpload(file);
      else if (file.type === 'text/plain' || file.name.endsWith('.js') || file.name.endsWith('.tsx') || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (ev) => { const text = ev.target?.result as string; setChatInput(prev => prev + `\n\n[Context from ${file.name}]:\n${text}`); setIsChatOpen(true); };
        reader.readAsText(file);
      }
    }
  };

  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) { alert("Speech recognition is not supported in this browser. Try Chrome."); return; }
    if (isListening) { setIsListening(false); return; }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true); recognition.onend = () => setIsListening(false); recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => { const transcript = event.results[0][0].transcript; setChatInput(prev => prev + (prev ? ' ' : '') + transcript); };
    recognition.start();
  };
  
  const toggleLayout = (panel: 'sidebar' | 'bottom' | 'right') => {
      if (panel === 'sidebar') setLayout(p => ({ ...p, showSidebar: !p.showSidebar }));
      if (panel === 'bottom') setLayout(p => ({ ...p, showBottom: !p.showBottom }));
      if (panel === 'right') setLayout(p => ({ ...p, showRight: !p.showRight }));
  };
  const handleBranchSwitch = (branch: string) => { setCurrentBranch(branch); setShowBranchMenu(false); setTerminalLogs(prev => [...prev, `> git checkout ${branch}`, `> Switched to branch '${branch}'`]); };

  const allFilesList = getAllFiles(files);
  const filteredCommands = [
     ...allFilesList.map(f => ({ type: 'file', id: f.node.id, label: f.path, icon: <FileIcon size={14}/>, action: () => handleFileClick(f.node.id) })),
     { type: 'command', id: 'c1', label: 'Toggle Sidebar', icon: <SidebarIcon size={14}/>, action: () => toggleLayout('sidebar') },
     { type: 'command', id: 'c2', label: 'Toggle Terminal', icon: <PanelBottom size={14}/>, action: () => toggleLayout('bottom') },
     { type: 'command', id: 'c3', label: 'Deploy Project', icon: <Rocket size={14}/>, action: () => { setActiveTab('deploy'); } },
     { type: 'command', id: 'c4', label: 'Export as ZIP', icon: <Download size={14}/>, action: handleExport },
     { type: 'command', id: 'c5', label: 'Git Commit', icon: <GitCommit size={14}/>, action: () => setActiveActivity('GIT') },
  ].filter(item => item.label.toLowerCase().includes(commandQuery.toLowerCase()));

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a project to begin</div>;

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {contextMenu.visible && (
          <div ref={contextMenuRef} className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 z-50 min-w-[160px]" style={{ top: contextMenu.y, left: contextMenu.x }}>
             <button onClick={() => { handleRenameNode(contextMenu.fileId!); setContextMenu(prev => ({...prev, visible: false})); }} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-primary-600 hover:text-white flex items-center gap-2"><Edit2 size={14}/> Rename</button>
             <button onClick={() => { handleDuplicateNode(contextMenu.fileId!); setContextMenu(prev => ({...prev, visible: false})); }} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-primary-600 hover:text-white flex items-center gap-2"><Copy size={14}/> Duplicate</button>
             <button onClick={() => { handleDeleteNode(null, contextMenu.fileId!); setContextMenu(prev => ({...prev, visible: false})); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/50 flex items-center gap-2"><Trash2 size={14}/> Delete</button>
             <div className="h-px bg-gray-700 my-1"></div>
             <button onClick={() => { const file = findFileById(files, contextMenu.fileId!); if (file) { setChatInput(''); triggerGeneration(`Explain the code in ${file.name} and how it works.`); setIsChatOpen(true); } setContextMenu(prev => ({...prev, visible: false})); }} className="w-full text-left px-4 py-2 text-sm text-purple-300 hover:bg-purple-900/50 flex items-center gap-2"><MessageSquare size={14}/> Ask AI to Explain</button>
             <button onClick={() => { setIsSplitView(true); setSecondaryFileId(contextMenu.fileId); setContextMenu(prev => ({...prev, visible: false})); }} className="w-full text-left px-4 py-2 text-sm text-blue-300 hover:bg-blue-900/50 flex items-center gap-2"><SplitSquareHorizontal size={14}/> Open to Side</button>
          </div>
      )}

      {showBranchMenu && (
          <div className="fixed bottom-8 left-16 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 z-50 w-48" onClick={(e) => e.stopPropagation()}>
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-700 uppercase">Switch Branch</div>
              {['main', 'dev', 'feature/auth', 'fix/styles'].map(branch => (
                  <button key={branch} onClick={() => handleBranchSwitch(branch)} className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-blue-600 hover:text-white ${currentBranch === branch ? 'text-white bg-blue-600/20' : 'text-gray-300'}`}><GitBranch size={14} /> {branch} {currentBranch === branch && <Check size={14} className="ml-auto" />}</button>
              ))}
              <div className="border-t border-gray-700 mt-1 pt-1"><button onClick={() => handleBranchSwitch('new-branch')} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-blue-600 hover:text-white flex items-center gap-2"><Plus size={14} /> Create New Branch...</button></div>
          </div>
      )}

      {showCommandPalette && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center pt-[10vh]" onClick={() => setShowCommandPalette(false)}>
              <div className="w-[90%] md:w-[500px] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-3 border-b border-gray-700 flex items-center gap-3"><Command size={18} className="text-gray-500"/><input ref={commandInputRef} type="text" className="flex-1 bg-transparent outline-none text-white placeholder-gray-500" placeholder="Type a command or filename..." value={commandQuery} onChange={e => setCommandQuery(e.target.value)} autoFocus /><div className="flex gap-1"><span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400">↑↓</span><span className="text-[10px] bg-gray-700 px-1.5 rounded text-gray-400">↵</span></div></div>
                  <div className="flex-1 overflow-y-auto py-2">{filteredCommands.length === 0 && <div className="p-4 text-center text-gray-500 text-sm">No results found</div>}{filteredCommands.map((item, i) => (<div key={item.id} className="px-4 py-2 hover:bg-primary-600/20 hover:text-white cursor-pointer flex items-center gap-3 text-sm text-gray-300 group" onClick={() => { item.action(); setShowCommandPalette(false); }}><span className="text-gray-500 group-hover:text-white">{item.icon}</span><span className="flex-1">{item.label}</span>{item.type === 'file' && <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 group-hover:text-white">File</span>}{item.type === 'command' && <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 group-hover:text-white">Cmd</span>}</div>))}</div>
              </div>
          </div>
      )}

      {isDragging && (<div className="absolute inset-0 bg-primary-500/20 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-primary-500 border-dashed m-4 rounded-xl pointer-events-none"><div className="text-white font-bold text-2xl flex flex-col items-center gap-4"><div className="p-6 bg-primary-600 rounded-full shadow-xl"><Paperclip size={48} /></div>Drop images/videos for analysis</div></div>)}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Activity Bar */}
        <div className="w-12 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-4 z-20 flex-shrink-0">
            {['EXPLORER', 'SEARCH', 'GIT', 'DEBUG', 'AGENTS', 'EXTENSIONS', 'ASSETS', 'AUDIT'].map(activity => (
                <button key={activity} onClick={() => { if (!layout.showSidebar) setLayout(l => ({ ...l, showSidebar: true })); setActiveActivity(activity as any); }} className={`p-2 rounded-lg transition-colors relative ${activeActivity === activity && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`} title={activity.charAt(0) + activity.slice(1).toLowerCase()}>
                    {activity === 'EXPLORER' && <Files size={24} strokeWidth={1.5} />}
                    {activity === 'SEARCH' && <Search size={24} strokeWidth={1.5} />}
                    {activity === 'GIT' && <><GitBranch size={24} strokeWidth={1.5} />{changedFiles.length > 0 && <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 text-[10px] text-white rounded-full flex items-center justify-center font-bold border-2 border-gray-900">{changedFiles.length}</div>}</>}
                    {activity === 'DEBUG' && <Bug size={24} strokeWidth={1.5} />}
                    {activity === 'AGENTS' && <Bot size={24} strokeWidth={1.5} />}
                    {activity === 'EXTENSIONS' && <Puzzle size={24} strokeWidth={1.5} />}
                    {activity === 'ASSETS' && <LayoutTemplate size={24} strokeWidth={1.5} />}
                    {activity === 'AUDIT' && <ShieldCheck size={24} strokeWidth={1.5} />}
                </button>
            ))}
            <div className="mt-auto flex flex-col gap-4"><button className="p-2 text-gray-500 hover:text-gray-300"><Settings size={24} strokeWidth={1.5} /></button></div>
        </div>

        {/* Mobile Backdrop for Sidebar */}
        {layout.showSidebar && (
            <div 
                className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
                onClick={() => setLayout(l => ({ ...l, showSidebar: false }))}
            />
        )}

        {/* Side Panel (Collapsible on Mobile) */}
        {layout.showSidebar && (
        <div className="bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0 absolute md:static h-full z-30 shadow-2xl md:shadow-none" style={{ width: sidebarWidth }}>
          {activeActivity === 'EXPLORER' && (
            <FileExplorer 
                files={files} 
                activeFileId={activeFileId} 
                project={project!} 
                remoteDirName={remoteDirName} 
                onFileClick={handleFileClick} 
                onContextMenu={handleContextMenu} 
                onConnectRemote={handleConnectRemote} 
                onUploadFile={handleFileUpload} 
                onUploadFolder={handleFolderUpload} 
                onAddFile={handleAddFile} 
                onAddFolder={handleAddFolder} 
                onInstallPackage={handleInstallPackage}
                onRunScript={handleRunScript}
            />
          )}
          {activeActivity === 'GIT' && (
              <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-gray-800"><div className="flex justify-between items-center mb-2"><span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Source Control</span><div className="flex gap-2"><button className="text-gray-500 hover:text-white" title="Refresh"><RefreshCw size={14}/></button></div></div></div>
                  <div className="flex-1 overflow-y-auto">
                      {changedFiles.length === 0 ? <div className="p-8 text-center text-gray-500 text-xs">No changes detected.</div> : (<div><div className="px-4 py-2 text-xs font-semibold text-gray-400 bg-gray-800/50 flex justify-between items-center"><span>Changes ({changedFiles.length})</span><div className="flex gap-1"><button className="hover:text-white" title="Stage All"><Plus size={12}/></button></div></div>{changedFiles.map(file => (<div key={file.id} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 cursor-pointer group" onClick={() => setDiffFileId(file.id)}><span className="text-yellow-500 font-bold text-[10px] w-4">M</span><span className="truncate flex-1">{file.name}</span></div>))}</div>)}
                      <div className="p-4 border-t border-gray-800 mt-4"><textarea className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white focus:border-primary-500 focus:outline-none mb-2 resize-none h-20" placeholder="Message" value={commitMessage} onChange={e => setCommitMessage(e.target.value)} /><Button size="sm" className="w-full" onClick={handleCommit} disabled={changedFiles.length === 0 || !commitMessage.trim()}><Check size={14} className="mr-2" /> Commit</Button></div>
                      <div className="mt-4 border-t border-gray-800"><div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-800/30">Commits</div>{commits.map(commit => (<div key={commit.id} className="px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"><div className="font-medium text-xs text-gray-200 mb-1">{commit.message}</div><div className="flex justify-between text-[10px] text-gray-500 font-mono"><span>{commit.author}</span><span>{commit.hash.substring(0, 6)}</span></div></div>))}</div>
                  </div>
              </div>
          )}
          {/* ... (Other activities) ... */}
          {activeActivity === 'AGENTS' && (
              <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-gray-800">
                      <div className="flex items-center gap-2 mb-2"><Bot className="text-primary-500" size={16}/><span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">AI Agents</span></div>
                      <p className="text-[10px] text-gray-500 mb-4">Automate complex tasks across your entire project.</p>
                      <div className="space-y-2">
                          <Button size="sm" variant="secondary" className="w-full justify-start" onClick={() => handleStartAgent('docs', 'Doc Generator')} disabled={!!activeAgentTask}><FileText size={14} className="mr-2"/> Generate Docs</Button>
                          <Button size="sm" variant="secondary" className="w-full justify-start" onClick={() => handleStartAgent('tests', 'Test Creator')} disabled={!!activeAgentTask}><Zap size={14} className="mr-2"/> Create Unit Tests</Button>
                          <Button size="sm" variant="secondary" className="w-full justify-start" onClick={() => handleStartAgent('refactor', 'Code Cleaner')} disabled={!!activeAgentTask}><RefreshCw size={14} className="mr-2"/> Refactor Code</Button>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                      {activeAgentTask ? (
                          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-2">
                              <div className="flex justify-between items-center">
                                  <span className="font-bold text-sm text-white">{activeAgentTask.name}</span>
                                  {activeAgentTask.status === 'running' && <Loader2 size={14} className="animate-spin text-primary-500"/>}
                                  {activeAgentTask.status === 'completed' && <Check size={14} className="text-green-500"/>}
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-primary-500 h-full transition-all duration-300" style={{ width: `${(activeAgentTask.processedFiles / activeAgentTask.totalFiles) * 100}%` }}></div>
                              </div>
                              <div className="text-xs text-gray-400 flex justify-between">
                                  <span>{activeAgentTask.processedFiles} / {activeAgentTask.totalFiles} files</span>
                                  <span>{Math.round((activeAgentTask.processedFiles / activeAgentTask.totalFiles) * 100)}%</span>
                              </div>
                              <div className="h-32 bg-black rounded border border-gray-700 p-2 overflow-y-auto font-mono text-[10px] text-green-400">
                                  {activeAgentTask.logs.map((log, i) => <div key={i}>{log}</div>)}
                                  <div ref={(el) => el?.scrollIntoView({ behavior: "smooth" })} />
                              </div>
                              {activeAgentTask.status === 'completed' && <Button size="sm" onClick={() => setActiveAgentTask(null)}>Done</Button>}
                          </div>
                      ) : (
                          <div className="text-center text-gray-600 text-xs mt-10 italic">No active agents running.</div>
                      )}
                  </div>
              </div>
          )}
          {activeActivity === 'AUDIT' && (
              <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-gray-800">
                      <div className="flex items-center gap-2 mb-2"><Shield className="text-green-500" size={16}/><span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Security Audit</span></div>
                      <Button size="sm" onClick={handleStartAudit} disabled={isAuditing} className="w-full">{isAuditing ? <Loader2 size={14} className="animate-spin"/> : "Run Scan"}</Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {auditIssues.length === 0 && !isAuditing && <div className="p-4 text-center text-gray-600 text-xs">No issues found or scan not run.</div>}
                      {auditIssues.map((issue) => (
                          <div key={issue.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3 hover:bg-gray-750 cursor-pointer group">
                              <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${issue.severity === 'critical' ? 'bg-red-900 text-red-400' : issue.severity === 'high' ? 'bg-orange-900 text-orange-400' : 'bg-blue-900 text-blue-400'}`}>{issue.severity}</span>
                                  <span className="text-[10px] text-gray-500 font-mono">{issue.file}:{issue.line}</span>
                              </div>
                              <div className="text-xs font-semibold text-gray-200 mb-1">{issue.title}</div>
                              <p className="text-[10px] text-gray-400 leading-relaxed">{issue.description}</p>
                          </div>
                      ))}
                  </div>
              </div>
          )}
          {activeActivity === 'EXTENSIONS' && (
              <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-gray-800"><span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Marketplace</span><div className="mt-2 bg-gray-800 rounded-lg flex items-center px-2"><Search size={14} className="text-gray-500" /><input type="text" className="bg-transparent border-none text-sm text-white p-2 w-full focus:outline-none placeholder-gray-500" placeholder="Search extensions..." value={extensionQuery} onChange={e => setExtensionQuery(e.target.value)} /></div></div>
                  <div className="flex-1 overflow-y-auto">{extensions.filter(e => e.name.toLowerCase().includes(extensionQuery.toLowerCase())).map(ext => (<div key={ext.id} className="p-4 border-b border-gray-800 hover:bg-gray-800/50 group"><div className="flex justify-between items-start mb-2"><div className="flex gap-3"><div className="w-8 h-8 bg-gray-800 rounded flex items-center justify-center text-primary-500 font-bold text-xs border border-gray-700">{ext.icon || ext.name[0]}</div><div><div className="text-sm font-semibold text-gray-200">{ext.name}</div><div className="text-xs text-gray-500">{ext.publisher}</div></div></div></div><p className="text-xs text-gray-400 mb-3 line-clamp-2">{ext.description}</p><div className="flex items-center justify-between"><div className="flex items-center gap-1 text-[10px] text-gray-500"><Download size={10} /> {ext.downloads}</div><button onClick={() => toggleExtension(ext.id)} className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${ext.installed ? 'bg-gray-700 text-gray-300' : 'bg-primary-600 text-white hover:bg-primary-500'}`}>{ext.installed ? 'Uninstall' : 'Install'}</button></div></div>))}</div>
              </div>
          )}
          {activeActivity === 'SEARCH' && (<div className="flex flex-col h-full"><div className="p-4 border-b border-gray-800"><span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Search</span><div className="mt-2 space-y-2"><div className="bg-gray-800 rounded flex items-center px-2 border border-gray-700 focus-within:border-primary-500"><button className="text-gray-500 mr-1" onClick={() => setShowReplace(!showReplace)}>{showReplace ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button><input type="text" className="bg-transparent border-none text-sm text-white p-1.5 w-full focus:outline-none placeholder-gray-500" placeholder="Search" value={searchQuery} onChange={e => handleSearch(e.target.value)} /></div>{showReplace && (<div className="bg-gray-800 rounded flex items-center px-2 border border-gray-700 focus-within:border-primary-500 animate-in slide-in-from-top-2"><div className="w-5"></div> <input type="text" className="bg-transparent border-none text-sm text-white p-1.5 w-full focus:outline-none placeholder-gray-500" placeholder="Replace" value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)} /><button onClick={handleReplace} className="text-gray-400 hover:text-white ml-1" title="Replace All"><Replace size={14}/></button></div>)}</div></div><div className="flex-1 overflow-y-auto">{searchResults.map(res => (<div key={`${res.fileId}-${res.line}`} className="flex flex-col border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer group" onClick={() => handleJumpToLine(res.fileId, res.line)}><div className="px-3 py-1 bg-gray-800/30 text-xs text-gray-400 font-medium flex items-center gap-2"><FileIcon size={12} /> {res.fileName}</div><div className="px-3 py-2 text-xs font-mono text-gray-500 pl-8 truncate group-hover:text-gray-300"><span className="text-gray-600 mr-2">{res.line}:</span>{res.preview}</div></div>))}</div></div>)}
          {activeActivity === 'ASSETS' && (<div className="flex flex-col h-full"><div className="p-4 border-b border-gray-800"><span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Asset Library</span></div><div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2">{assets.length === 0 && <div className="col-span-2 text-center text-gray-500 text-xs p-4">No assets generated.</div>}{assets.map((asset, idx) => (<div key={idx} draggable onDragStart={(e) => e.dataTransfer.setData('application/omni-asset', JSON.stringify(asset))} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-primary-500 cursor-grab active:cursor-grabbing relative group aspect-square">{asset.type === 'image' && <img src={asset.url} className="w-full h-full object-cover" />}{asset.type === 'video' && <div className="w-full h-full bg-black flex items-center justify-center text-gray-500"><Video size={24}/></div>}{asset.type === 'audio' && <div className="w-full h-full bg-gray-900 flex items-center justify-center text-purple-400"><Music size={24}/></div>}<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2"><div className="text-[10px] text-center text-white break-all">{asset.name}</div></div></div>))}</div></div>)}
          {activeActivity === 'DEBUG' && (<div className="flex flex-col h-full"><div className="p-4 border-b border-gray-800 flex justify-between"><span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Run & Debug</span><div className="flex gap-1"><button className="text-green-500 hover:text-green-400"><Play size={14}/></button><button className="text-gray-500 hover:text-white"><Settings size={14}/></button></div></div><div className="flex-1 overflow-y-auto">
              {/* Breakpoints Section */}
              <div className="px-4 py-2 bg-gray-800/30 text-xs font-bold text-gray-400 flex justify-between cursor-pointer hover:text-white"><span>BREAKPOINTS</span></div>
              {breakpoints.length === 0 && <div className="p-4 text-gray-600 text-xs italic">No active breakpoints.</div>}
              {breakpoints.map(bp => (
                  <div key={bp} className="px-4 py-1 flex items-center gap-2 text-xs font-mono border-b border-gray-800/50 hover:bg-gray-800 cursor-pointer" onClick={() => handleJumpToLine(activeFileId, bp)}>
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-gray-300">{activeFile?.name}:{bp}</span>
                  </div>
              ))}
              <div className="px-4 py-2 bg-gray-800/30 text-xs font-bold text-gray-400 mt-4 flex justify-between cursor-pointer hover:text-white"><span>VARIABLES</span></div>
              {debugVariables.map((v, i) => (<div key={i} className="px-4 py-1 flex justify-between text-xs font-mono border-b border-gray-800/50 hover:bg-gray-800"><span className="text-blue-400">{v.name}:</span><span className="text-red-300 truncate max-w-[120px]">{v.value}</span></div>))}
              {debugVariables.length === 0 && <div className="p-4 text-gray-600 text-xs italic">No active variables.</div>}
              <div className="px-4 py-2 bg-gray-800/30 text-xs font-bold text-gray-400 mt-4"><span>CALL STACK</span></div><div className="px-4 py-1 text-xs font-mono text-gray-400 hover:bg-gray-800 cursor-pointer">App (App.tsx:12)</div>
          </div></div>)}
        </div>
        )}

        {/* Sidebar Resize Handle */}
        {layout.showSidebar && (
            <div
                className="w-1 bg-gray-900 border-r border-gray-800 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block"
                onMouseDown={(e) => startResizing('sidebar', e)}
            />
        )}

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900 h-full" id="editor-container">
          {/* Tabs */}
          <div className="flex bg-gray-900 border-b border-gray-800 overflow-x-auto scrollbar-none shrink-0">
             {openFiles.map(fileId => {
                 const file = findFileById(files, fileId);
                 if (!file) return null;
                 return (
                     <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-r border-gray-800 cursor-pointer min-w-[120px] max-w-[200px] group ${activeFileId === file.id ? 'bg-gray-800 text-primary-400 border-t-2 border-t-primary-500' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200 border-t-2 border-t-transparent'}`}><span className={`truncate ${file.gitStatus === 'modified' ? 'text-yellow-500' : ''}`}>{file.name}</span>{file.gitStatus === 'modified' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>}<button onClick={(e) => handleCloseTab(e, file.id)} className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 text-gray-400 hover:text-white"><X size={12} /></button></div>
                 );
             })}
             <button onClick={() => setIsSplitView(p => !p)} className={`ml-auto px-3 flex items-center text-gray-500 hover:text-white border-l border-gray-800 ${isSplitView ? 'text-primary-500' : ''}`} title="Toggle Split Editor">
                 <SplitSquareHorizontal size={14} />
             </button>
          </div>

          {/* Editor / Diff / Empty State */}
          <div className="flex-1 relative min-h-0 flex">
            {diffFile ? (
                <div className="absolute inset-0 z-10">
                    <DiffEditor 
                        original={diffFile.content || ''} // In a real app, we'd fetch the committed version
                        modified={diffFile.content ? diffFile.content + '\n// Local changes' : ''} 
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
                                onChange={handleFileChange} 
                                fileName={activeFile.name} 
                                config={editorConfig} 
                                onCodeAction={handleCodeAction} 
                                onSelectionChange={setEditorSelection} 
                                breakpoints={breakpoints}
                                onToggleBreakpoint={handleToggleBreakpoint}
                                onGhostTextRequest={handleGhostTextRequest}
                            />
                        ) : (<div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-950"><div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mb-4"><Command size={32} className="opacity-20" /></div><p className="text-sm font-medium mb-2">No file is open</p><div className="text-xs flex flex-col gap-2 opacity-60"><span><kbd className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">Cmd+P</kbd> to search files</span></div></div>)}
                    </div>
                    
                    {isSplitView && (
                        <>
                            {/* Split Resizer */}
                            <div 
                                className="w-1 bg-gray-900 border-l border-r border-gray-800 hover:bg-primary-600 cursor-col-resize z-20 hidden md:block"
                                onMouseDown={(e) => startResizing('split', e)}
                            />
                            <div className="relative flex flex-col bg-gray-950" style={{ width: `${100 - splitRatio}%` }}>
                                {secondaryFile ? (
                                    <>
                                        <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center px-4 text-xs text-gray-400 font-medium"><span className="text-primary-400 mr-2">Split:</span> {secondaryFile.name} <button onClick={() => setSecondaryFileId(null)} className="ml-auto hover:text-white"><X size={12}/></button></div>
                                        <CodeEditor 
                                            code={secondaryFile.content || ''} 
                                            onChange={(val) => handleFileChange(val, secondaryFileId!)} 
                                            fileName={secondaryFile.name} 
                                            config={editorConfig} 
                                            onCodeAction={handleCodeAction} 
                                        />
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-600">
                                        <p className="text-xs mb-2">Select a file to open in split view</p>
                                        <p className="text-[10px] opacity-60">Right-click a file > Open to Side</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}
          </div>

          {/* Bottom Panel (Terminal) */}
          {layout.showBottom && (
            <>
                {/* Terminal Resize Handle */}
                <div 
                    className="h-1 bg-gray-900 border-t border-gray-800 hover:bg-primary-600 cursor-ns-resize z-20 hidden md:block"
                    onMouseDown={(e) => startResizing('bottomPanel', e)}
                />
                <div className="bg-black border-t border-gray-800 flex flex-col flex-shrink-0 transition-all" style={{ height: bottomPanelHeight }}>
                <div className="flex border-b border-gray-800"><button onClick={() => setBottomPanelTab('terminal')} className={`px-4 py-1 text-xs uppercase font-bold ${bottomPanelTab === 'terminal' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}>Terminal</button><button onClick={() => setBottomPanelTab('problems')} className={`px-4 py-1 text-xs uppercase font-bold flex items-center gap-2 ${bottomPanelTab === 'problems' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}>Problems {problems.length > 0 && <span className="bg-yellow-900 text-yellow-500 px-1 rounded-full text-[10px]">{problems.length}</span>}</button><div className="ml-auto flex items-center px-2"><button onClick={() => toggleLayout('bottom')} className="text-gray-500 hover:text-white"><X size={14}/></button></div></div>
                {bottomPanelTab === 'terminal' ? <Terminal logs={terminalLogs} onCommand={handleTerminalCommand} onAiFix={handleTerminalAiFix} /> : (<div className="flex-1 overflow-y-auto p-2 font-mono text-xs">{problems.length === 0 && <div className="text-gray-500 p-2">No problems detected.</div>}{problems.map((p, i) => (<div key={i} className="flex items-center gap-2 p-1 hover:bg-gray-900 cursor-pointer group">{p.severity === 'error' && <AlertCircle size={12} className="text-red-500"/>}{p.severity === 'warning' && <AlertTriangle size={12} className="text-yellow-500"/>}{p.severity === 'info' && <Info size={12} className="text-blue-500"/>}<span className="text-gray-300">{p.message}</span><span className="text-gray-600 ml-auto flex items-center gap-4"><span>{p.file}:{p.line}</span><button onClick={(e) => {e.stopPropagation(); handleQuickFix(p);}} className="text-yellow-500 hover:text-white opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-yellow-900/30 px-2 py-0.5 rounded border border-yellow-800/50"><Zap size={10}/> Auto Fix</button></span></div>))}</div>)}
                </div>
            </>
          )}
        </div>

        {/* Right Panel Resize Handle */}
        {layout.showRight && (
            <div 
                className="w-1 bg-gray-900 border-l border-gray-800 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block"
                onMouseDown={(e) => startResizing('rightPanel', e)}
            />
        )}

        {/* Right Panel (Preview) */}
        {layout.showRight && (
            <div 
                className="flex-shrink-0 relative bg-gray-900 border-l border-gray-800 absolute md:static inset-0 md:inset-auto z-40 md:z-0 w-full md:w-auto"
                style={{ 
                    width: window.innerWidth < 768 ? '100%' : rightPanelWidth,
                    minWidth: window.innerWidth >= 768 ? '300px' : 'auto'
                }}
            >
                <PreviewPanel 
                    project={project!} 
                    previewSrc={previewSrc} 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    onToggleLayout={() => toggleLayout('right')}
                    onExport={handleExport}
                    onRefreshPreview={() => {
                        const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
                        if (iframe) iframe.srcdoc = iframe.srcdoc;
                    }}
                    roadmap={roadmap}
                    isGeneratingPlan={isGeneratingPlan}
                    onGeneratePlan={handleGeneratePlan}
                    onExecutePhase={handleExecutePhase}
                    onToggleTask={handleToggleTask}
                    onLog={(msg) => setTerminalLogs(prev => [...prev, msg])}
                    files={files}
                />
            </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-gray-900 border-t border-gray-800 text-gray-400 text-[10px] flex items-center px-3 justify-between select-none z-50 flex-shrink-0">
        <div className="flex items-center gap-4 overflow-hidden">
          <button onClick={(e) => { e.stopPropagation(); setShowBranchMenu(!showBranchMenu); }} className="flex items-center gap-1 hover:bg-gray-800 hover:text-white px-2 py-0.5 rounded cursor-pointer whitespace-nowrap transition-colors"><GitBranch size={10} /><span>{currentBranch}</span></button>
          <div className="flex items-center gap-1 hover:bg-gray-800 hover:text-white px-2 py-0.5 rounded cursor-pointer whitespace-nowrap transition-colors"><RefreshCw size={10} className={isGenerating ? "animate-spin" : ""} /><span>{isGenerating ? 'Generating...' : 'Ready'}</span></div>
          <div className="hidden sm:flex items-center gap-1 whitespace-nowrap"><AlertCircle size={10} /><span>{problems.length} Problems</span></div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1">
              <button onClick={() => toggleLayout('bottom')} className={`p-0.5 rounded hover:bg-gray-800 hover:text-white ${!layout.showBottom ? 'opacity-50' : ''}`} title="Toggle Terminal"><PanelBottom size={10}/></button>
              <button onClick={() => toggleLayout('right')} className={`p-0.5 rounded hover:bg-gray-800 hover:text-white ${!layout.showRight ? 'opacity-50' : ''}`} title="Toggle Preview"><Columns size={10}/></button>
           </div>
           <div className="hidden sm:flex items-center gap-2"><span>Ln {editorRef.current ? '1' : '1'}, Col 1</span></div>
           <div className="hidden md:flex items-center gap-2"><span>UTF-8</span></div>
           <div className="hidden md:flex items-center gap-1 bg-gray-800 px-2 rounded text-gray-300"><Check size={10} /><span>Prettier</span></div>
           <div className="font-semibold text-primary-400 whitespace-nowrap">{isNative ? 'TS RN' : 'TS React'}</div>
        </div>
      </div>

      {/* Chat Interface (Overlay) */}
      <div className="absolute bottom-8 right-6 w-[90%] md:w-96 z-40 flex flex-col gap-4 pointer-events-none max-h-[60vh]">
        {isChatOpen ? (
            <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[60vh] animate-in slide-in-from-bottom-4">
                {/* Chat Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-gray-850 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-xs font-bold text-gray-200">Omni Assistant</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsChatOpen(false)} className="text-gray-500 hover:text-white transition-colors"><Minimize2 size={14}/></button>
                    </div>
                </div>

                {/* Chat History Bubbles */}
                <div className="flex-1 flex flex-col-reverse gap-2 overflow-y-auto scrollbar-none p-3 min-h-[150px]">
                {chatHistory.slice().reverse().map((msg) => (
                    <div key={msg.id} className="flex flex-col gap-1">
                        <MessageRenderer message={msg} onApplyCode={handleApplyCode} onApplyAll={handleApplyAll} />
                        {msg.critique && (
                            <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg text-xs text-gray-300 shadow-xl ml-4 relative animate-in slide-in-from-left-4">
                                <div className="absolute -left-2 top-3 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-gray-700"></div>
                                <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-1">
                                    <span className="font-bold text-blue-400 flex items-center gap-1"><ShieldCheck size={12}/> Omni-Critic</span>
                                    <span className={`font-bold ${msg.critique.score > 80 ? 'text-green-400' : 'text-yellow-400'}`}>{msg.critique.score}/100</span>
                                </div>
                                {msg.critique.issues.length > 0 && (
                                    <div className="mb-2">
                                        <span className="text-red-400 font-bold uppercase text-[10px]">Issues</span>
                                        <ul className="list-disc pl-3 space-y-0.5 mt-0.5">
                                            {msg.critique.issues.slice(0, 2).map((issue, i) => <li key={i} className="text-gray-400">{issue}</li>)}
                                        </ul>
                                    </div>
                                )}
                                <div className="mb-2">
                                    <span className="text-green-400 font-bold uppercase text-[10px]">Suggestion</span>
                                    <ul className="list-disc pl-3 space-y-0.5 mt-0.5">
                                        {msg.critique.suggestions.slice(0, 2).map((s, i) => <li key={i} className="text-gray-400">{s}</li>)}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {isGenerating && (<div className="flex flex-col items-start animate-pulse"><div className="bg-gray-800 text-gray-400 rounded-lg p-3 text-xs flex items-center gap-2 shadow-lg border border-gray-700"><Loader2 size={12} className="animate-spin text-primary-400" /> <span>AI is thinking... ({activeModel})</span></div></div>)}
                </div>

                {/* Input Area */}
                <div className="p-3 border-t border-gray-700 bg-gray-900/50">
                    {/* Context Pill for Image */}
                    {attachedImage && (<div className="relative inline-block w-16 h-16 rounded-lg overflow-hidden border border-gray-600 mb-2 group"><img src={attachedImage} className="w-full h-full object-cover" alt="attachment" /><button onClick={() => setAttachedImage(undefined)} className="absolute top-0 right-0 bg-black/50 text-white p-0.5 hover:bg-red-500"><X size={12} /></button></div>)}
                    
                    {/* Context Pill for Code Selection */}
                    {editorSelection && (
                    <div className="flex items-center gap-2 bg-blue-900/30 border border-blue-800 rounded-lg px-3 py-2 mb-1 animate-in fade-in slide-in-from-bottom-2">
                        <Code2 size={14} className="text-blue-400" />
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-blue-200 font-bold uppercase">Context Active</div>
                            <div className="text-xs text-gray-400 truncate font-mono">{editorSelection.split('\n')[0]}...</div>
                        </div>
                        <button onClick={() => setEditorSelection('')} className="text-gray-500 hover:text-white"><X size={14}/></button>
                    </div>
                    )}

                    <form onSubmit={handleChatSubmit} className="flex gap-2 items-end">
                    <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500 transition-all flex items-center p-1">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Attach Image/File"><Paperclip size={18} /></button>
                        <textarea className="flex-1 bg-transparent border-none text-sm text-white px-2 py-2 max-h-32 focus:outline-none resize-none scrollbar-none placeholder-gray-500" rows={1} placeholder="Ask Omni to generate code..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(e); } }} />
                        <button type="button" onClick={toggleVoiceInput} className={`p-2 rounded-lg transition-colors ${isListening ? 'text-red-500 animate-pulse bg-red-900/20' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} title="Voice Input">{isListening ? <MicOff size={18} /> : <Mic size={18} />}</button>
                    </div>
                    <Button id="chat-submit-btn" type="submit" disabled={!chatInput.trim() && !attachedImage && !editorSelection || isGenerating} className={`rounded-xl p-3 aspect-square flex items-center justify-center transition-all ${!chatInput.trim() && !attachedImage && !editorSelection ? 'opacity-50 cursor-not-allowed' : 'shadow-lg shadow-primary-900/50'}`}>{isGenerating ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}</Button>
                    </form>
                    <div className="flex justify-between px-1 text-[10px] text-gray-500 font-medium mt-2">
                        <div className="flex items-center gap-2">
                            <span>Using {activeModel}</span>
                            <label className="flex items-center gap-1 cursor-pointer hover:text-white"><input type="checkbox" checked={enableCritic} onChange={e => setEnableCritic(e.target.checked)} className="rounded bg-gray-800 border-gray-600"/> Auto-Critic</label>
                            <button onClick={handleManualReview} className={`flex items-center gap-1 hover:text-blue-400 ${isReviewing ? 'animate-pulse text-blue-400' : ''}`} title="Run Code Review"><ShieldCheck size={10}/> Review</button>
                        </div>
                        <span className="flex items-center gap-1"><Command size={8}/> + K for commands</span>
                    </div>
                </div>
            </div>
        ) : (
            <div className="flex justify-end pointer-events-auto">
                <button 
                    onClick={() => setIsChatOpen(true)} 
                    className="bg-primary-600 text-white p-4 rounded-full shadow-2xl hover:bg-primary-500 transition-all hover:scale-110 flex items-center justify-center group"
                >
                    <MessageSquare size={24} className="group-hover:animate-bounce"/>
                    {isGenerating && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                        </span>
                    )}
                </button>
            </div>
        )}
      </div>

    </div>
  );
};
