
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, File as FileIcon, Play, Save, ChevronRight, ChevronDown, MoreVertical, Box, Smartphone, Paperclip, Video, Mic, CornerDownLeft, ArrowRight, Check, RefreshCw, Rocket, Loader2, Globe, ExternalLink, Zap, Server, Plus, Trash2, FolderPlus, FilePlus, MicOff, Download, Network, GitBranch, Search, Files, Settings, GitCommit, Tablet, Monitor, Database, Table, QrCode, History, Image, Music, LayoutTemplate, X, Command, Package, AlertTriangle, AlertCircle, Info, Sidebar as SidebarIcon, PanelBottom, Columns, Edit2, Copy, MessageSquare, FileText, Puzzle, Cloud, UploadCloud, FolderInput, FileInput, AlignLeft, Link, User, Bug, Replace, Clock, GitPullRequest, Layers } from 'lucide-react';
import { WEB_FILE_TREE, NATIVE_FILE_TREE, NODE_FILE_TREE, MOCK_DEPLOYMENTS, SYSTEM_COMMANDS, MOCK_EXTENSIONS, MOCK_COMMITS } from '../constants';
import { FileNode, ChatMessage, Project, ProjectType, SocialPost, AudioTrack, Extension, GitCommit as GitCommitType } from '../types';
import { CodeEditor, CodeEditorHandle } from '../components/CodeEditor';
import { Terminal } from '../components/Terminal';
import { generateCodeResponse } from '../services/geminiService';
import { Button } from '../components/Button';
import JSZip from 'jszip';
import { generatePreviewHtml } from '../utils/runtime';

interface WorkspaceProps {
  project: Project | null;
}

interface MessageRendererProps {
  message: ChatMessage;
  onApplyCode: (code: string) => void;
  onApplyAll?: (codes: string[]) => void;
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

const MessageRenderer: React.FC<MessageRendererProps> = ({ message, onApplyCode, onApplyAll }) => {
  if (message.role !== 'model') {
     return (
      <div className="flex flex-col items-end">
        <div className="max-w-[90%] rounded-lg p-3 text-sm whitespace-pre-wrap bg-primary-600 text-white shadow-md">
          {message.text.startsWith('[Attached:') ? (
             <div>
                <div className="flex items-center gap-2 text-blue-200 font-semibold text-xs mb-1">
                    <Paperclip size={12} /> {message.text.split('\n')[0]}
                </div>
                {message.text.split('\n').slice(1).join('\n')}
             </div>
          ) : message.text}
        </div>
      </div>
     );
  }

  const parts = message.text.split(/(```[\s\S]*?```)/g);
  const codeBlocks = parts.filter(part => part.startsWith('```') && part.endsWith('```')).map(part => part.replace(/^```\w*\n?/, '').replace(/```$/, ''));

  return (
    <div className="flex flex-col items-start w-full">
      <div className="max-w-[95%] rounded-lg p-0 overflow-hidden border border-gray-700 bg-gray-800 text-gray-200 text-sm w-full shadow-md relative">
         {codeBlocks.length > 1 && onApplyAll && (
             <div className="w-full bg-gray-900/50 border-b border-gray-700 p-2 flex justify-end">
                 <button 
                    onClick={() => onApplyAll(codeBlocks)}
                    className="text-xs flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition-colors"
                 >
                    <Layers size={12} /> Apply All Changes ({codeBlocks.length})
                 </button>
             </div>
         )}
         
         {parts.map((part, idx) => {
            const isCodeBlock = part.startsWith('```') && part.endsWith('```');
            if (isCodeBlock) {
               const content = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
               const langMatch = part.match(/^```(\w+)/);
               const lang = langMatch ? langMatch[1] : 'code';
               
               // Check for filename header in the code content
               const filenameMatch = content.match(/^\/\/ filename: (.*)/);
               const targetFile = filenameMatch ? filenameMatch[1].trim() : 'Current File';

               return (
                 <div key={idx} className="my-2 first:mt-0 last:mb-0">
                    <div className="flex justify-between items-center bg-gray-900 px-3 py-1.5 border-b border-gray-700">
                       <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-500 font-mono uppercase">{lang}</span>
                           {filenameMatch && <span className="text-xs text-blue-400 font-mono bg-blue-900/20 px-1 rounded border border-blue-800">{targetFile}</span>}
                       </div>
                       <button 
                         onClick={() => onApplyCode(content)}
                         className="flex items-center gap-1 text-[10px] bg-primary-900/30 hover:bg-primary-900/50 border border-primary-700 text-primary-300 px-2 py-1 rounded transition-colors"
                       >
                         <CornerDownLeft size={10} /> {filenameMatch ? `Create/Update` : 'Apply to Editor'}
                       </button>
                    </div>
                    <pre className="p-3 overflow-x-auto bg-gray-950/50 font-mono text-xs text-gray-300 scrollbar-thin scrollbar-thumb-gray-700">
                       {content}
                    </pre>
                 </div>
               );
            }
            if (!part.trim()) return null;
            return <div key={idx} className="p-3 whitespace-pre-wrap">{part}</div>
         })}
      </div>
    </div>
  );
};

export const Workspace: React.FC<WorkspaceProps> = ({ project }) => {
  const isNative = project?.type === ProjectType.REACT_NATIVE;
  const isBackend = project?.type === ProjectType.NODE_API;
  
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [openFiles, setOpenFiles] = useState<string[]>(['1']); // Tab state
  
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'deploy' | 'database'>('preview');
  const [bottomPanelTab, setBottomPanelTab] = useState<'terminal' | 'problems'>('terminal');
  const [previewMode, setPreviewMode] = useState<'web' | 'mobile'>(isNative ? 'mobile' : 'web');
  const [isUploading, setIsUploading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [hoveredFileId, setHoveredFileId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeModel, setActiveModel] = useState('Gemini 2.5 Flash');
  
  // Git State
  const [commits, setCommits] = useState<GitCommitType[]>(MOCK_COMMITS);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [showBranchMenu, setShowBranchMenu] = useState(false);

  // Editor Settings
  const [editorConfig, setEditorConfig] = useState<any>({});
  const editorRef = useRef<CodeEditorHandle>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Debug State
  const [debugVariables, setDebugVariables] = useState<{name: string, value: string}[]>([]);

  // Device Simulation State
  const [deviceFrame, setDeviceFrame] = useState<'iphone14' | 'pixel7' | 'ipad'>('iphone14');
  const [showQrCode, setShowQrCode] = useState(false);

  // IDE Layout State
  const [activeActivity, setActiveActivity] = useState<'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG'>('EXPLORER');
  const [layout, setLayout] = useState({
    showSidebar: true,
    showBottom: true,
    showRight: true
  });

  const [commitMessage, setCommitMessage] = useState('');
  const [assets, setAssets] = useState<{type: 'image' | 'video' | 'audio', url: string, name: string}[]>([]);
  
  // Extensions State
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);
  const [extensionQuery, setExtensionQuery] = useState('');

  // Upload Inputs Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [remoteDirName, setRemoteDirName] = useState<string | null>(null);

  // API Console State
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiPath, setApiPath] = useState('/users');
  const [apiResponse, setApiResponse] = useState<string>('// Click Send to test endpoint');
  const [apiStatus, setApiStatus] = useState<number | null>(null);

  // Problems/Linter State
  const [problems, setProblems] = useState<Problem[]>([]);

  // Database Studio State
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 10;');
  const [dbResults, setDbResults] = useState<any[]>([
     { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', created_at: '2023-10-12' },
     { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user', created_at: '2023-10-14' },
     { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'user', created_at: '2023-10-15' }
  ]);
  
  // Deployment States
  const [deploymentState, setDeploymentState] = useState<'idle' | 'building' | 'optimizing' | 'uploading' | 'deployed'>('idle');
  const [deployUrl, setDeployUrl] = useState('');

  // Command Palette State
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, fileId: null });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  // Vision State (Multimodal)
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);

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
    // Load settings function
    const loadSettings = () => {
        const savedModel = localStorage.getItem('omni_active_model');
        if (savedModel) setActiveModel(savedModel);
        
        const savedConfig = localStorage.getItem('omni_editor_config');
        if (savedConfig) {
           const parsed = JSON.parse(savedConfig);
           setEditorConfig(parsed);
           
           // Sync extensions state if persistent setting exists (simplified simulation)
           if (parsed.vimMode) {
               setExtensions(prev => prev.map(e => e.name === 'Vim' ? { ...e, installed: true } : e));
           }
        }
    };
    
    // Initial load
    loadSettings();
    
    // Listen for updates
    window.addEventListener('omniSettingsChanged', loadSettings);
    
    if (project) {
       const storageKey = `omni_files_${project.id}`;
       const savedFiles = localStorage.getItem(storageKey);
       
       // Persist Open Tabs
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

       let initLogs = ['> Initializing environment...'];
       if (isNative) initLogs = ['> Starting Metro Bundler...', '> Expo Go ready on port 19000'];
       if (isBackend) initLogs = ['> node index.js', '> Server running at http://localhost:3000'];
       if (!isNative && !isBackend) initLogs = ['> Booting WebContainer...', '> Container initialized.', '> npm install'];
       
       setTerminalLogs(initLogs);

       const savedModel = localStorage.getItem('omni_active_model'); // get again for initial chat
       setChatHistory([{ 
         id: '0', 
         role: 'system', 
         text: `Hello! I am Omni-Studio. I've loaded your ${project.type} project (${project.name}). Active Model: ${savedModel || 'Default'}`, 
         timestamp: Date.now() 
       }]);
       setPreviewMode(isNative ? 'mobile' : 'web');
    }

    return () => window.removeEventListener('omniSettingsChanged', loadSettings);
  }, [project?.id, project?.type, isNative, isBackend]);

  // Save tabs state on change
  useEffect(() => {
      if (project) {
          const tabsKey = `omni_open_tabs_${project.id}`;
          localStorage.setItem(tabsKey, JSON.stringify({ openFiles, activeFileId }));
      }
  }, [openFiles, activeFileId, project]);

  // Keyboard Shortcuts
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
          // Trigger chat submit if input is focused or active
          const submitBtn = document.getElementById('chat-submit-btn');
          if (submitBtn) submitBtn.click();
       }
       if (e.key === 'Escape') {
          setShowCommandPalette(false);
          setContextMenu(prev => ({...prev, visible: false}));
          setShowBranchMenu(false);
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, files]);

  // Close Context Menu on Click
  useEffect(() => {
     const handleClick = (e: MouseEvent) => {
        if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
           setContextMenu(prev => ({...prev, visible: false}));
        }
        setShowBranchMenu(false);
     };
     window.addEventListener('click', handleClick);
     return () => window.removeEventListener('click', handleClick);
  }, []);

  // Helper: Flatten files for Git view & Search & Command Palette
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
    const newCommit: GitCommitType = {
        id: `c-${Date.now()}`,
        message: commitMessage,
        author: 'You',
        date: 'Just now',
        hash: newCommitHash
    };

    setFiles(clearGitStatus(files));
    setCommits(prev => [newCommit, ...prev]);
    setTerminalLogs(prev => [...prev, `> git commit -m "${commitMessage}"`, `> [${currentBranch} ${newCommitHash}] ${commitMessage}`]);
    setCommitMessage('');
    
    // Also save to local storage
    if (project) {
       const storageKey = `omni_files_${project.id}`;
       localStorage.setItem(storageKey, JSON.stringify(clearGitStatus(files)));
    }
  };

  const formatCode = () => {
      const prettier = extensions.find(e => e.name.includes('Prettier') && e.installed);
      if (prettier && activeFile && activeFile.content) {
          // Simplified Mock Formatting: Just indentation
          // In a real app, we'd use the prettier browser API
          setTerminalLogs(prev => [...prev, `> Prettier: Formatted ${activeFile.name}`]);
      }
  };

  // Save project files to local storage
  const handleSaveProject = () => {
    if (project) {
      formatCode(); // Auto-format on save if prettier enabled
      
      const storageKey = `omni_files_${project.id}`;
      localStorage.setItem(storageKey, JSON.stringify(files));
      setTerminalLogs(prev => [...prev, `> Project saved locally to ${storageKey}`]);
      
      const btn = document.getElementById('save-btn');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg> Saved`;
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 2000);
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

  // Active file helper
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

  // Parse Variables for Debug View
  useEffect(() => {
     if (!activeFile || !activeFile.content || activeActivity !== 'DEBUG') return;
     
     const vars: {name: string, value: string}[] = [];
     const content = activeFile.content;
     
     // Simple regex to find const/let variable declarations
     const regex = /(?:const|let|var)\s+(\w+)\s*=\s*([^;]+)/g;
     let match;
     while ((match = regex.exec(content)) !== null) {
         vars.push({ name: match[1], value: match[2].trim() });
     }
     
     // Add some fake React state variables if present
     if (content.includes('useState')) {
         const stateRegex = /const\s*\[(\w+),\s*set\w+\]\s*=\s*useState\(([^)]+)\)/g;
         while ((match = stateRegex.exec(content)) !== null) {
             vars.push({ name: match[1], value: match[2].trim() });
         }
     }
     
     setDebugVariables(vars);
  }, [activeFile, activeActivity]);

  // Linter / Problems Logic
  useEffect(() => {
      if (!activeFile || !activeFile.content) {
          setProblems([]);
          return;
      }

      const newProblems: Problem[] = [];
      const lines = activeFile.content.split('\n');
      
      lines.forEach((line, idx) => {
          if (line.includes('console.log')) {
              newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Unexpected console statement', severity: 'warning' });
          }
          if (line.includes('TODO') || line.includes('FIXME')) {
               newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Pending task found', severity: 'info' });
          }
          if (line.length > 120) {
               newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Line exceeds 120 characters', severity: 'warning' });
          }
          if (line.includes('var ')) {
               newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Use "let" or "const" instead of "var"', severity: 'error' });
          }
      });

      setProblems(newProblems);
  }, [activeFile]);

  // Update preview when code changes
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
                  // Fix: replaceAll might not be available in older TS lib configs
                  const newContent = node.content.split(searchQuery).join(replaceQuery);
                  if (newContent !== node.content) {
                      return { ...node, content: newContent, gitStatus: 'modified' };
                  }
              }
              if (node.children) {
                  return { ...node, children: replaceInNode(node.children) };
              }
              return node;
          });
      };
      
      setFiles(replaceInNode(files));
      setTerminalLogs(prev => [...prev, `> Replaced '${searchQuery}' with '${replaceQuery}'`]);
      handleSearch(searchQuery); // Refresh results
  };

  const upsertFileByPath = (nodes: FileNode[], pathParts: string[], newContent: string): FileNode[] => {
    const [currentPart, ...restParts] = pathParts;
    
    // If we are at the file level
    if (restParts.length === 0) {
       const existingFile = nodes.find(n => n.name === currentPart && n.type === 'file');
       if (existingFile) {
          // Update existing
          return nodes.map(n => n.id === existingFile.id ? { ...n, content: newContent, gitStatus: 'modified' } : n);
       } else {
          // Create new file
          const newFile: FileNode = {
             id: Date.now().toString() + Math.random(),
             name: currentPart,
             type: 'file',
             content: newContent,
             gitStatus: 'added'
          };
          return [...nodes, newFile];
       }
    }

    // We are at a directory level
    const existingDir = nodes.find(n => n.name === currentPart && n.type === 'directory');
    if (existingDir) {
       return nodes.map(n => n.id === existingDir.id ? { 
          ...n, 
          isOpen: true, // Ensure directory is open to reveal new content
          children: upsertFileByPath(n.children || [], restParts, newContent) 
       } : n);
    } else {
       // Create directory and descend
       const newDir: FileNode = {
          id: Date.now().toString() + Math.random(),
          name: currentPart,
          type: 'directory',
          children: [],
          isOpen: true
       };
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

  // --- Code Actions ---
  const handleCodeAction = (action: string, selectedCode: string) => {
      const fileContext = activeFile ? ` in ${activeFile.name}` : '';
      let prompt = '';
      
      if (action === 'Explain') prompt = `Explain this code${fileContext}:\n\n${selectedCode}`;
      if (action === 'Refactor') prompt = `Refactor this code${fileContext} to be cleaner and more efficient:\n\n${selectedCode}`;
      if (action === 'Fix') prompt = `Find and fix any potential bugs in this code${fileContext}:\n\n${selectedCode}`;
      
      setChatInput(prompt);
      const userMsg = { id: Date.now().toString(), role: 'user' as const, text: prompt, timestamp: Date.now() };
      setChatHistory(prev => [...prev, userMsg]);
      triggerGeneration(prompt);
  };

  // --- File Management ---
  const handleAddFile = () => {
    const name = prompt("Enter file name (e.g. Component.tsx):");
    if (!name) return;
    
    const newFile: FileNode = {
      id: Date.now().toString(),
      name,
      type: 'file',
      content: '// New file generated',
      gitStatus: 'added'
    };
    
    const targetFolderId = 'root'; 
    
    const addNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
            if (node.id === targetFolderId && node.children) {
                return { ...node, children: [...node.children, newFile] };
            }
            if (node.children) return { ...node, children: addNode(node.children) };
            return node;
        });
    };
    
    setFiles(addNode(files));
    setTerminalLogs(prev => [...prev, `> Created file: ${name}`]);
    
    // Open the new file
    setActiveFileId(newFile.id);
    if (!openFiles.includes(newFile.id)) {
        setOpenFiles([...openFiles, newFile.id]);
    }
  };
  
  const handleAddFolder = () => {
     const name = prompt("Enter folder name:");
     if (!name) return;
     
     const newFolder: FileNode = {
       id: Date.now().toString(),
       name,
       type: 'directory',
       children: [],
       isOpen: true
     };
     
     const targetFolderId = 'root';
     
     const addNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(node => {
            if (node.id === targetFolderId && node.children) {
                return { ...node, children: [...node.children, newFolder] };
            }
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
        return nodes.filter(node => node.id !== id).map(node => ({
            ...node,
            children: node.children ? deleteNode(node.children) : undefined
        }));
    };
    setFiles(deleteNode(files));
    
    // Close tab if deleted
    if (openFiles.includes(id)) {
        const newOpenFiles = openFiles.filter(fid => fid !== id);
        setOpenFiles(newOpenFiles);
        if (activeFileId === id) {
            setActiveFileId(newOpenFiles[newOpenFiles.length - 1] || '');
        }
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
      if (!target || target.type === 'directory') return; // Shallow duplicate for files only for now

      const copyNode = (nodes: FileNode[]): FileNode[] => {
         return nodes.flatMap(node => {
             if (node.id === id) {
                 const copy: FileNode = {
                     ...node,
                     id: Date.now().toString() + Math.random(),
                     name: `${node.name.split('.')[0]}_copy.${node.name.split('.').pop()}`,
                     gitStatus: 'added'
                 };
                 return [node, copy];
             }
             if (node.children) {
                 return [{ ...node, children: copyNode(node.children) }];
             }
             return [node];
         });
      };
      setFiles(copyNode(files));
  };

  // --- Upload Handling ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const newFile: FileNode = {
           id: Date.now().toString(),
           name: file.name,
           type: 'file',
           content: content,
           gitStatus: 'added'
        };
        
        // Add to root
        const addNode = (nodes: FileNode[]): FileNode[] => {
            return nodes.map(node => {
                if (node.id === 'root' && node.children) {
                    return { ...node, children: [...node.children, newFile] };
                }
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
    
    // We need to read all files and build the tree structure
    let processed = 0;
    const total = fileList.length;

    Array.from(fileList).forEach(file => {
       const reader = new FileReader();
       reader.onload = (ev) => {
          const content = ev.target?.result as string;
          const path = file.webkitRelativePath || file.name;
          const parts = path.split('/'); // "folder/sub/file.txt"
          
          setFiles(prev => upsertFileByPath(prev, parts, content));
          processed++;
          if (processed === total) {
             setTerminalLogs(prev => [...prev, `> Folder upload complete.`]);
          }
       };
       reader.readAsText(file);
    });
  };
  
  const handleExplorerDrop = (e: React.DragEvent) => {
     e.preventDefault();
     e.stopPropagation();
     const droppedFiles = Array.from(e.dataTransfer.files);
     
     if (droppedFiles.length === 0) return;
     
     setTerminalLogs(prev => [...prev, `> Importing ${droppedFiles.length} files from drop...`]);
     
     droppedFiles.forEach(file => {
         const reader = new FileReader();
         reader.onload = (ev) => {
            const content = ev.target?.result as string;
            // For drop, we don't easily get webkitRelativePath without webkitGetAsEntry
            // We'll insert into root or create a "Dropped" folder
            const newFile: FileNode = {
                id: Date.now().toString() + Math.random(),
                name: file.name,
                type: 'file',
                content: content,
                gitStatus: 'added'
            };
            
            const addNode = (nodes: FileNode[]): FileNode[] => {
               return nodes.map(node => {
                   if (node.id === 'root' && node.children) {
                       return { ...node, children: [...node.children, newFile] };
                   }
                   if (node.children) return { ...node, children: addNode(node.children) };
                   return node;
               });
            };
            setFiles(addNode(files));
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
             
             // Recursive Reader
             const readDirectory = async (dirHandle: any, path: string = ''): Promise<FileNode[]> => {
                 const nodes: FileNode[] = [];
                 for await (const entry of dirHandle.values()) {
                     if (entry.kind === 'file') {
                         const file = await entry.getFile();
                         // Skip binary files or large files in this demo (simple filter)
                         if (file.name.match(/\.(png|jpg|jpeg|gif|ico|mp4|mp3)$/i)) {
                             continue; 
                         }
                         
                         const content = await file.text();
                         nodes.push({
                             id: path + entry.name,
                             name: entry.name,
                             type: 'file',
                             content,
                             gitStatus: 'unmodified'
                         });
                     } else if (entry.kind === 'directory') {
                         if (entry.name === 'node_modules' || entry.name === '.git') continue;
                         const children = await readDirectory(entry, path + entry.name + '/');
                         nodes.push({
                             id: path + entry.name,
                             name: entry.name,
                             type: 'directory',
                             children,
                             isOpen: false
                         });
                     }
                 }
                 return nodes;
             };
             
             setTerminalLogs(prev => [...prev, `> Scanning local files...`]);
             const localFiles = await readDirectory(dirHandle);
             
             // Replace root
             setFiles([{
                 id: 'root',
                 name: dirHandle.name,
                 type: 'directory',
                 children: localFiles,
                 isOpen: true
             }]);
             
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
     setContextMenu({
         visible: true,
         x: e.clientX,
         y: e.clientY,
         fileId
     });
  };

  const handleFileClick = (id: string) => {
      setActiveFileId(id);
      if (!openFiles.includes(id)) {
          setOpenFiles([...openFiles, id]);
      }
  };
  
  const handleCloseTab = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const newOpenFiles = openFiles.filter(fid => fid !== id);
      setOpenFiles(newOpenFiles);
      if (activeFileId === id) {
          setActiveFileId(newOpenFiles[newOpenFiles.length - 1] || '');
      }
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

  const toggleExtension = (id: string) => {
    setExtensions(prev => prev.map(ext => {
        if (ext.id === id) {
             const newInstalled = !ext.installed;
             // Apply side effects for extensions
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
        // Delay scroll slightly to allow editor to mount
        setTimeout(() => editorRef.current?.scrollToLine(line), 100);
    } else {
        editorRef.current?.scrollToLine(line);
    }
  };

  // --- Search Logic ---
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
                        results.push({
                            fileId: node.id,
                            fileName: node.name,
                            line: idx + 1,
                            preview: line.trim().substring(0, 60)
                        });
                    }
                });
            }
            if (node.children) searchNodes(node.children);
        });
    };
    searchNodes(files);
    setSearchResults(results);
  };

  // --- API Console Logic ---
  const handleApiSend = () => {
      setApiResponse('Sending request...');
      setApiStatus(null);
      
      setTimeout(() => {
          const indexFile = findFileById(files, '1');
          const code = indexFile?.content || '';
          const routeRegex = new RegExp(`app\\.${apiMethod.toLowerCase()}\\(['"]${apiPath}['"]`, 'i');
          
          if (routeRegex.test(code) || apiPath === '/') {
              setApiStatus(200);
              if (apiPath === '/users' && apiMethod === 'GET') {
                  setApiResponse(JSON.stringify({
                      count: 2,
                      data: dbResults
                  }, null, 2));
              } else if (apiPath === '/' && apiMethod === 'GET') {
                  setApiResponse(JSON.stringify({ message: 'Welcome to Omni API v1' }, null, 2));
              } else if (apiMethod === 'POST') {
                  setApiResponse(JSON.stringify({ id: 3, status: 'created', timestamp: new Date().toISOString() }, null, 2));
                  setApiStatus(201);
              } else {
                  setApiResponse(JSON.stringify({ message: 'Simulated success from endpoint code.' }, null, 2));
              }
          } else {
              setApiStatus(404);
              setApiResponse(JSON.stringify({ error: 'Route not found in index.js' }, null, 2));
          }
      }, 600);
  };

  const handleRunQuery = () => {
      // Simple mock query runner
      if (sqlQuery.toLowerCase().includes('users')) {
          setDbResults(prev => [...prev]); // Trigger refresh effect visual
      }
  };

  // --- Terminal Command Handler ---
  const handleTerminalCommand = (cmd: string) => {
    const command = cmd.trim();
    const parts = command.split(' ');
    const base = parts[0];

    setTerminalLogs(prev => [...prev, `${command}`]);

    switch (base) {
      case 'clear':
        setTerminalLogs([]);
        break;
      case 'ls':
        const root = files.find(f => f.id === 'root');
        if (root && root.children) {
           const output = root.children.map(c => c.type === 'directory' ? `${c.name}/` : c.name).join('  ');
           setTerminalLogs(prev => [...prev, output]);
        }
        break;
      case 'git':
        if (parts[1] === 'status') {
             if (changedFiles.length === 0) {
                 setTerminalLogs(prev => [...prev, `On branch ${currentBranch}`, 'nothing to commit, working tree clean']);
             } else {
                 setTerminalLogs(prev => [...prev, `On branch ${currentBranch}`, 'Changes not staged for commit:', ...changedFiles.map(f => `  modified: ${f.name}`)]);
             }
        } else if (parts[1] === 'commit') {
             setTerminalLogs(prev => [...prev, 'Please use the Source Control view to commit changes.']);
        } else if (parts[1] === 'checkout' && parts[2] === '-b') {
             const newBranch = parts[3];
             if(newBranch) {
                 setCurrentBranch(newBranch);
                 setTerminalLogs(prev => [...prev, `Switched to a new branch '${newBranch}'`]);
             }
        } else {
             setTerminalLogs(prev => [...prev, `git: '${parts[1]}' is not a git command. See 'git --help'.`]);
        }
        break;
      case 'pwd':
        setTerminalLogs(prev => [...prev, '/usr/projects/app']);
        break;
      case 'npm':
        if (parts[1] === 'start') {
           if (isBackend) {
               setTerminalLogs(prev => [...prev, '> node index.js', '> Server listening on port 3000']);
           } else {
               setTerminalLogs(prev => [...prev, '> Starting development server...', '> Ready on http://localhost:3000']);
           }
           setTerminalLogs(prev => [...prev, '> Hot Reloading...']);
        } else if (parts[1] === 'install' || parts[1] === 'i') {
           const pkg = parts[2] || 'package';
           setTimeout(() => {
              setTerminalLogs(prev => [...prev, `> added 1 package in ${Math.floor(Math.random() * 2000) / 1000}s`]);
           }, 800);
        } else if (parts[1] === 'test') {
            setTerminalLogs(prev => [...prev, '> react-scripts test', '']);
            setTimeout(() => setTerminalLogs(prev => [...prev, 'PASS  src/App.test.js']), 500);
            setTimeout(() => setTerminalLogs(prev => [...prev, 'PASS  src/utils.test.js']), 1000);
            setTimeout(() => setTerminalLogs(prev => [...prev, '', 'Test Suites: 2 passed, 2 total', 'Tests:       5 passed, 5 total', 'Snapshots:   0 total', 'Time:        1.2s']), 1500);
        } else {
           setTerminalLogs(prev => [...prev, `Unknown npm command: ${parts[1]}`]);
        }
        break;
      case 'cat':
        if (parts[1]) {
           const findFile = (nodes: FileNode[]): FileNode | undefined => {
             for(const n of nodes) {
                if (n.name === parts[1] && n.type === 'file') return n;
                if (n.children) {
                   const found = findFile(n.children);
                   if (found) return found;
                }
             }
             return undefined;
           }
           const file = findFile(files);
           if (file && file.content) {
              setTerminalLogs(prev => [...prev, ...file.content.split('\n').slice(0, 10), '...']);
           } else {
              setTerminalLogs(prev => [...prev, `cat: ${parts[1]}: No such file`]);
           }
        } else {
           setTerminalLogs(prev => [...prev, 'usage: cat [file]']);
        }
        break;
      case 'help':
        setTerminalLogs(prev => [...prev, 'Available commands: ls, cd, cat, clear, npm, pwd, git']);
        break;
      default:
        setTerminalLogs(prev => [...prev, `zsh: command not found: ${base}`]);
    }
  };

  // --- AI & Chat ---
  const getFileStructureString = (nodes: FileNode[], depth = 0): string => {
      let result = '';
      nodes.forEach(node => {
          const indent = '  '.repeat(depth);
          result += `${indent}- ${node.name} (${node.type})\n`;
          if (node.children) {
              result += getFileStructureString(node.children, depth + 1);
          }
      });
      return result;
  };

  const handleMultimediaUpload = (file?: File) => {
    if (!file) {
       // Simulating mock upload if no file passed (e.g. button click without selection)
       setIsUploading(true);
       setTimeout(() => {
          const transcript = "User wants to change the primary button color to a dark purple gradient and make the text larger.";
          const newMsg: ChatMessage = {
             id: Date.now().toString(),
             role: 'user',
             text: `[Attached: demo_video.mp4]\nOmni Vision Analysis: "${transcript}"`,
             timestamp: Date.now()
          };
          setChatHistory(prev => [...prev, newMsg]);
          setIsUploading(false);
          triggerGeneration(newMsg.text);
       }, 1500);
       return;
    }

    // Real file handling
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
       const base64 = e.target?.result as string;
       setAttachedImage(base64);
       
       const newMsg: ChatMessage = {
           id: Date.now().toString(),
           role: 'user',
           text: `[Attached: ${file.name}]\n`,
           timestamp: Date.now()
       };
       setChatHistory(prev => [...prev, newMsg]);
       setIsUploading(false);
       // Don't trigger immediately, let user type prompt or infer default
       setChatInput(`Analyze this ${file.type.startsWith('video') ? 'video' : 'image'} and update the code to match the design.`);
    };
    reader.readAsDataURL(file);
  };

  const triggerGeneration = async (prompt: string) => {
    setIsGenerating(true);
    const currentCode = activeFile?.content || '';
    const fileStructure = getFileStructureString(files);

    let responseText = '';
    const tempId = 'temp-' + Date.now();
    setChatHistory(prev => [...prev, { id: tempId, role: 'model', text: '', timestamp: Date.now() }]);

    await generateCodeResponse(
      prompt, 
      currentCode,
      project?.type || ProjectType.REACT_WEB,
      fileStructure,
      activeModel, 
      (chunk) => {
        responseText += chunk;
        setChatHistory(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: responseText } : msg));
      },
      attachedImage // Pass the base64 image if attached
    );
    
    // Clear attachment after use
    setAttachedImage(undefined);
    setIsGenerating(false);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Handle Slash Commands
    if (chatInput.startsWith('/')) {
        const [cmd, ...args] = chatInput.split(' ');
        const userMsg = { id: Date.now().toString(), role: 'user' as const, text: chatInput, timestamp: Date.now() };
        setChatHistory(prev => [...prev, userMsg]);
        setChatInput('');

        if (cmd === '/clear') {
            setTimeout(() => setChatHistory([]), 500);
            return;
        }

        if (cmd === '/help') {
            setChatHistory(prev => [...prev, {
                id: Date.now().toString(),
                role: 'system',
                text: `Available Commands:\n${SYSTEM_COMMANDS.join('\n')}`,
                timestamp: Date.now()
            }]);
            return;
        }

        if (cmd === '/explain') {
            triggerGeneration(`Explain the code in ${activeFile?.name || 'the current file'} step by step. Focus on how the components work.`);
            return;
        }

        if (cmd === '/fix') {
            triggerGeneration(`Find and fix any bugs or errors in ${activeFile?.name || 'the current file'}. Provide the corrected code.`);
            return;
        }
        // If command not recognized, fall through to normal chat
    }

    const newUserMsg = { id: Date.now().toString(), role: 'user' as const, text: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');
    triggerGeneration(newUserMsg.text);
  };

  const handleDeploy = () => {
    setDeploymentState('building');
    
    const sequence = [
      { state: 'building', log: '> Building production bundle...', delay: 2000 },
      { state: 'optimizing', log: '> Optimizing assets & images...', delay: 1500 },
      { state: 'uploading', log: '> Uploading to Edge Network...', delay: 1500 },
      { state: 'deployed', log: '> Deployed successfully!', delay: 500 }
    ];

    let currentDelay = 0;

    sequence.forEach(({ state, log, delay }) => {
      currentDelay += delay;
      setTimeout(() => {
        setDeploymentState(state as any);
        setTerminalLogs(prev => [...prev, log]);
        if (state === 'deployed') {
          setDeployUrl(`https://${project?.name.toLowerCase().replace(/\s+/g, '-')}.vercel.app`);
        }
      }, currentDelay);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Handle internal asset drag
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
        
        if (insertCode && activeFile) {
            handleFileChange(activeFile.content + '\n' + insertCode);
            setTerminalLogs(prev => [...prev, `> Inserted asset: ${asset.name}`]);
        }
        return;
    }
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const file = droppedFiles[0] as File;
      
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        handleMultimediaUpload(file);
      } else if (file.type === 'text/plain' || file.name.endsWith('.js') || file.name.endsWith('.tsx') || file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          setChatInput(prev => prev + `\n\n[Context from ${file.name}]:\n${text}`);
        };
        reader.readAsText(file);
      }
    }
  };

  const toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e: any) => {
      console.error(e);
      setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.start();
  };

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => (
      <div key={node.id}>
        <div 
          className={`flex items-center justify-between px-4 py-1 cursor-pointer text-sm hover:bg-gray-800 transition-colors border-l-2 group relative
            ${node.id === activeFileId ? 'bg-gray-800 text-white border-primary-500' : 'text-gray-400 border-transparent'}
          `}
          style={{ paddingLeft: `${depth * 12 + 12}px` }}
          onClick={() => node.type === 'file' && handleFileClick(node.id)}
          onContextMenu={(e) => handleContextMenu(e, node.id)}
          onMouseEnter={() => setHoveredFileId(node.id)}
          onMouseLeave={() => setHoveredFileId(null)}
        >
          <div className="flex items-center overflow-hidden">
              <span className="mr-2 opacity-70 flex-shrink-0 relative">
                {node.type === 'directory' ? (
                  node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                ) : <FileIcon size={14} />}
                {node.gitStatus === 'modified' && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>}
                {node.gitStatus === 'added' && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full"></div>}
              </span>
              <span className={`truncate ${node.gitStatus === 'modified' ? 'text-yellow-400' : node.gitStatus === 'added' ? 'text-green-400' : ''}`}>
                 {node.name}
              </span>
          </div>
          {(hoveredFileId === node.id && node.id !== 'root' && node.id !== '1') && (
             <button 
                onClick={(e) => { e.stopPropagation(); handleContextMenu(e, node.id); }}
                className="text-gray-600 hover:text-white p-1"
             >
                <MoreVertical size={12} />
             </button>
          )}
        </div>
        {node.children && node.isOpen && renderFileTree(node.children, depth + 1)}
      </div>
    ));
  };
  
  // ... (Keep existing helper functions like renderDependencies, handleScanQr, etc.)
  const renderDependencies = () => {
      if (!packageJsonNode || !packageJsonNode.content) return (
          <div className="p-4 text-xs text-gray-500 text-center">No package.json found</div>
      );
      try {
          const json = JSON.parse(packageJsonNode.content);
          const deps = json.dependencies || {};
          return (
              <div className="p-2 space-y-1">
                  {Object.entries(deps).map(([name, version]) => (
                      <div key={name} className="flex justify-between items-center px-2 py-1 hover:bg-gray-800 rounded text-xs text-gray-300">
                          <div className="flex items-center gap-2">
                              <Package size={12} className="text-primary-400"/>
                              <span>{name}</span>
                          </div>
                          <span className="text-gray-600 font-mono">{version as string}</span>
                      </div>
                  ))}
                  <button 
                    onClick={handleInstallPackage}
                    className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-primary-400 hover:text-white hover:bg-gray-800 py-1 rounded border border-transparent hover:border-gray-700 border-dashed"
                  >
                     <Plus size={12} /> Add Package
                  </button>
              </div>
          );
      } catch(e) {
          return <div className="p-4 text-xs text-red-400 text-center">Error parsing package.json</div>;
      }
  };
  
  const handleScanQr = () => setShowQrCode(!showQrCode);
  const toggleLayout = (panel: 'sidebar' | 'bottom' | 'right') => {
      if (panel === 'sidebar') setLayout(p => ({ ...p, showSidebar: !p.showSidebar }));
      if (panel === 'bottom') setLayout(p => ({ ...p, showBottom: !p.showBottom }));
      if (panel === 'right') setLayout(p => ({ ...p, showRight: !p.showRight }));
  };
  const handleBranchSwitch = (branch: string) => {
      setCurrentBranch(branch);
      setShowBranchMenu(false);
      setTerminalLogs(prev => [...prev, `> git checkout ${branch}`, `> Switched to branch '${branch}'`]);
  };

  // --- Command Palette Renderer ---
  const allFilesList = getAllFiles(files);
  const filteredCommands = [
     ...allFilesList.map(f => ({ type: 'file', id: f.node.id, label: f.path, icon: <FileIcon size={14}/>, action: () => handleFileClick(f.node.id) })),
     { type: 'command', id: 'c1', label: 'Toggle Sidebar', icon: <SidebarIcon size={14}/>, action: () => toggleLayout('sidebar') },
     { type: 'command', id: 'c2', label: 'Toggle Terminal', icon: <PanelBottom size={14}/>, action: () => toggleLayout('bottom') },
     { type: 'command', id: 'c3', label: 'Deploy Project', icon: <Rocket size={14}/>, action: () => { setActiveTab('deploy'); handleDeploy(); } },
     { type: 'command', id: 'c4', label: 'Export as ZIP', icon: <Download size={14}/>, action: handleExport },
     { type: 'command', id: 'c5', label: 'Git Commit', icon: <GitCommit size={14}/>, action: () => setActiveActivity('GIT') },
  ].filter(item => item.label.toLowerCase().includes(commandQuery.toLowerCase()));

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a project to begin</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden w-full" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      
      {/* Hidden Inputs for Upload */}
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
      <input type="file" ref={folderInputRef} className="hidden" onChange={handleFolderUpload} {...{ webkitdirectory: "" } as any} />

      {/* Context Menu */}
      {contextMenu.visible && (
          <div 
            ref={contextMenuRef}
            className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 z-50 min-w-[160px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
             <button onClick={() => { handleRenameNode(contextMenu.fileId!); setContextMenu(prev => ({...prev, visible: false})); }} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-primary-600 hover:text-white flex items-center gap-2">
                 <Edit2 size={14}/> Rename
             </button>
             <button onClick={() => { handleDuplicateNode(contextMenu.fileId!); setContextMenu(prev => ({...prev, visible: false})); }} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-primary-600 hover:text-white flex items-center gap-2">
                 <Copy size={14}/> Duplicate
             </button>
             <button onClick={() => { handleDeleteNode(null, contextMenu.fileId!); setContextMenu(prev => ({...prev, visible: false})); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/50 flex items-center gap-2">
                 <Trash2 size={14}/> Delete
             </button>
             <div className="h-px bg-gray-700 my-1"></div>
             <button onClick={() => { 
                 const file = findFileById(files, contextMenu.fileId!);
                 if (file) {
                     setChatInput('');
                     triggerGeneration(`Explain the code in ${file.name} and how it works.`);
                 }
                 setContextMenu(prev => ({...prev, visible: false})); 
             }} className="w-full text-left px-4 py-2 text-sm text-purple-300 hover:bg-purple-900/50 flex items-center gap-2">
                 <MessageSquare size={14}/> Ask AI to Explain
             </button>
          </div>
      )}

      {/* Branch Switcher Menu */}
      {showBranchMenu && (
          <div className="fixed bottom-8 left-16 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 z-50 w-48">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b border-gray-700 uppercase">Switch Branch</div>
              {['main', 'dev', 'feature/auth', 'fix/styles'].map(branch => (
                  <button 
                     key={branch}
                     onClick={() => handleBranchSwitch(branch)}
                     className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-blue-600 hover:text-white ${currentBranch === branch ? 'text-white bg-blue-600/20' : 'text-gray-300'}`}
                  >
                     <GitBranch size={14} /> {branch}
                     {currentBranch === branch && <Check size={14} className="ml-auto" />}
                  </button>
              ))}
              <div className="border-t border-gray-700 mt-1 pt-1">
                   <button 
                     onClick={() => handleBranchSwitch('new-branch')}
                     className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-blue-600 hover:text-white flex items-center gap-2"
                   >
                       <Plus size={14} /> Create New Branch...
                   </button>
              </div>
          </div>
      )}

      {/* Command Palette */}
      {showCommandPalette && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center pt-[10vh]" onClick={() => setShowCommandPalette(false)}>
              <div className="w-[500px] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-3 border-b border-gray-700 flex items-center gap-3">
                      <Command size={18} className="text-gray-500"/>
                      <input 
                         ref={commandInputRef}
                         type="text" 
                         className="flex-1 bg-transparent outline-none text-white placeholder-gray-500"
                         placeholder="Type a command or filename..."
                         value={commandQuery}
                         onChange={e => setCommandQuery(e.target.value)}
                         autoFocus
                      />
                      <div className="flex gap-1">
                          <span className="text-[10px] bg-gray-700 px-1.5 rounded text-gray-400">↑↓</span>
                          <span className="text-[10px] bg-gray-700 px-1.5 rounded text-gray-400">↵</span>
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2">
                      {filteredCommands.length === 0 && <div className="p-4 text-center text-gray-500 text-sm">No results found</div>}
                      {filteredCommands.map((item, i) => (
                          <div 
                             key={item.id} 
                             className="px-4 py-2 hover:bg-primary-600/20 hover:text-white cursor-pointer flex items-center gap-3 text-sm text-gray-300 group"
                             onClick={() => { item.action(); setShowCommandPalette(false); }}
                          >
                              <span className="text-gray-500 group-hover:text-white">{item.icon}</span>
                              <span className="flex-1">{item.label}</span>
                              {item.type === 'file' && <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 group-hover:text-white">File</span>}
                              {item.type === 'command' && <span className="text-[10px] bg-gray-700 px-1.5 py-0.5 rounded text-gray-400 group-hover:text-white">Cmd</span>}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary-500/20 backdrop-blur-sm z-50 flex items-center justify-center border-4 border-primary-500 border-dashed m-4 rounded-xl pointer-events-none">
          <div className="text-white font-bold text-2xl flex flex-col items-center gap-4">
             <div className="p-6 bg-primary-600 rounded-full shadow-xl">
                <Paperclip size={48} />
             </div>
             Drop images/videos for analysis
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar (Far Left) */}
        <div className="w-12 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-4 z-20 flex-shrink-0">
            <button 
              onClick={() => {
                  if (!layout.showSidebar) setLayout(l => ({ ...l, showSidebar: true }));
                  setActiveActivity('EXPLORER');
              }}
              className={`p-2 rounded-lg transition-colors ${activeActivity === 'EXPLORER' && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`}
              title="Explorer"
            >
              <Files size={24} strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => {
                  if (!layout.showSidebar) setLayout(l => ({ ...l, showSidebar: true }));
                  setActiveActivity('SEARCH');
              }}
              className={`p-2 rounded-lg transition-colors ${activeActivity === 'SEARCH' && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`}
              title="Search"
            >
              <Search size={24} strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => {
                  if (!layout.showSidebar) setLayout(l => ({ ...l, showSidebar: true }));
                  setActiveActivity('GIT');
              }}
              className={`p-2 rounded-lg transition-colors relative ${activeActivity === 'GIT' && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`}
              title="Source Control"
            >
              <GitBranch size={24} strokeWidth={1.5} />
              {changedFiles.length > 0 && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 text-[10px] text-white rounded-full flex items-center justify-center font-bold border-2 border-gray-900">
                  {changedFiles.length}
                </div>
              )}
            </button>
            <button 
              onClick={() => {
                  if (!layout.showSidebar) setLayout(l => ({ ...l, showSidebar: true }));
                  setActiveActivity('DEBUG');
              }}
              className={`p-2 rounded-lg transition-colors relative ${activeActivity === 'DEBUG' && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`}
              title="Run & Debug"
            >
              <Bug size={24} strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => {
                  if (!layout.showSidebar) setLayout(l => ({ ...l, showSidebar: true }));
                  setActiveActivity('EXTENSIONS');
              }}
              className={`p-2 rounded-lg transition-colors relative ${activeActivity === 'EXTENSIONS' && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`}
              title="Extensions"
            >
              <Puzzle size={24} strokeWidth={1.5} />
            </button>
            <button 
              onClick={() => {
                  if (!layout.showSidebar) setLayout(l => ({ ...l, showSidebar: true }));
                  setActiveActivity('ASSETS');
              }}
              className={`p-2 rounded-lg transition-colors relative ${activeActivity === 'ASSETS' && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`}
              title="Asset Library"
            >
              <LayoutTemplate size={24} strokeWidth={1.5} />
            </button>
            <div className="mt-auto flex flex-col gap-4">
               <button className="p-2 text-gray-500 hover:text-gray-300"><Settings size={24} strokeWidth={1.5} /></button>
            </div>
        </div>

        {/* Side Panel */}
        {layout.showSidebar && (
        <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0 hidden md:flex">
          {activeActivity === 'EXPLORER' && (
            <div className="flex flex-col h-full" onDrop={handleExplorerDrop} onDragOver={(e) => e.preventDefault()}>
              {/* ... Explorer UI ... */}
              <div className="p-4 border-b border-gray-800 flex flex-col gap-3 bg-gray-900 sticky top-0 z-10">
                  <div className="flex justify-between items-center font-semibold text-gray-200 text-sm">
                      <span className="uppercase tracking-wider text-xs text-gray-500">Explorer</span>
                      <div className="flex gap-1">
                          <button onClick={handleConnectRemote} className={`text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700 ${remoteDirName ? 'text-green-500' : ''}`} title={remoteDirName ? `Connected: ${remoteDirName}` : "Connect Remote Folder"}>
                              <Link size={14} />
                          </button>
                          <button onClick={() => folderInputRef.current?.click()} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700" title="Upload Folder">
                              <FolderInput size={14} />
                          </button>
                           <button onClick={() => fileInputRef.current?.click()} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700" title="Upload File">
                              <FileInput size={14} />
                          </button>
                          <button onClick={handleAddFile} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700" title="New File">
                              <FilePlus size={14} />
                          </button>
                          <button onClick={handleAddFolder} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700" title="New Folder">
                              <FolderPlus size={14} />
                          </button>
                      </div>
                  </div>
                  <div className="text-xs text-gray-600 font-mono truncate flex items-center justify-between">
                     <span>{project.name}</span>
                     {remoteDirName && <span className="text-[10px] text-green-500 flex items-center gap-1"><Link size={10} /> {remoteDirName}</span>}
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto py-2 font-mono text-sm">
                {renderFileTree(files)}
              </div>
              
              {/* Dependencies Section */}
              <div className="border-t border-gray-800">
                  <div className="px-4 py-2 bg-gray-850 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <Package size={12} /> Dependencies
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                      {renderDependencies()}
                  </div>
              </div>
            </div>
          )}

          {/* ... Other Activities (GIT, SEARCH, etc. - keeping existing code structure) ... */}
          {activeActivity === 'EXTENSIONS' && (
             // ... Extensions UI ...
              <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-gray-800">
                      <span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Extensions</span>
                  </div>
                  <div className="p-4 border-b border-gray-800 bg-gray-850">
                     <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                        <input 
                          type="text" 
                          placeholder="Search Marketplace..." 
                          className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
                          value={extensionQuery}
                          onChange={(e) => setExtensionQuery(e.target.value)}
                        />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                      {extensions.filter(e => e.name.toLowerCase().includes(extensionQuery.toLowerCase())).map(ext => (
                          <div key={ext.id} className="p-3 hover:bg-gray-800 rounded border border-transparent hover:border-gray-700 mb-2 group flex gap-3">
                              <div className="w-8 h-8 bg-gray-800 border border-gray-700 rounded flex items-center justify-center font-bold text-gray-500">
                                  {ext.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start">
                                      <h4 className="text-sm font-medium text-gray-200 truncate">{ext.name}</h4>
                                  </div>
                                  <p className="text-[10px] text-gray-500 truncate">{ext.description}</p>
                                  <div className="flex justify-between items-center mt-2">
                                      <div className="flex items-center gap-1 text-[10px] text-gray-600">
                                          <Download size={10}/> {ext.downloads}
                                      </div>
                                      <button 
                                        onClick={() => toggleExtension(ext.id)}
                                        className={`text-[10px] px-2 py-0.5 rounded border ${ext.installed ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500'}`}
                                      >
                                          {ext.installed ? 'Uninstall' : 'Install'}
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {activeActivity === 'GIT' && (
             // ... GIT UI ...
             <div className="flex flex-col h-full">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                   <span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Source Control</span>
                   <span className="text-[10px] bg-gray-800 px-1.5 rounded text-gray-400">{currentBranch}</span>
                </div>
                <div className="p-4 border-b border-gray-800 bg-gray-850">
                   <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Message" 
                        className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                      />
                      <button 
                        onClick={handleCommit}
                        disabled={changedFiles.length === 0}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        <Check size={12} className="mr-1" /> Commit
                      </button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                   <div className="text-xs text-gray-500 uppercase mb-2 px-2 font-bold flex justify-between items-center cursor-pointer hover:text-white">
                      <span>Staged Changes</span>
                      <span className="bg-blue-900 text-blue-300 text-[9px] px-1.5 rounded-full">{changedFiles.length}</span>
                   </div>
                   {changedFiles.length === 0 ? (
                       <div className="text-xs text-gray-600 px-2 italic text-center py-4 border-b border-gray-800 mb-4">No changes to commit.</div>
                   ) : (
                       changedFiles.map(file => (
                          <div key={file.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-800 rounded cursor-pointer" onClick={() => setActiveFileId(file.id)}>
                             <span className={`text-xs font-bold ${file.gitStatus === 'added' ? 'text-green-500' : 'text-yellow-500'}`}>
                                {file.gitStatus === 'added' ? 'A' : 'M'}
                             </span>
                             <span className="text-sm text-gray-300 truncate">{file.name}</span>
                             <span className="text-xs text-gray-600 ml-auto">{file.type === 'directory' ? '/' : ''}</span>
                          </div>
                       ))
                   )}

                   <div className="text-xs text-gray-500 uppercase mb-2 px-2 font-bold mt-4">History</div>
                   <div className="space-y-2 pl-2 border-l border-gray-800 ml-2">
                      {commits.map(c => (
                          <div key={c.id} className="relative">
                              <div className="absolute -left-[13px] top-1.5 w-2 h-2 rounded-full bg-gray-600"></div>
                              <div className="text-xs text-gray-300 font-medium">{c.message}</div>
                              <div className="text-[10px] text-gray-500 flex gap-2">
                                 <span>{c.hash}</span>
                                 <span>• {c.date}</span>
                              </div>
                          </div>
                      ))}
                   </div>
                </div>
             </div>
          )}

          {activeActivity === 'ASSETS' && (
             // ... ASSETS UI ...
             <div className="flex flex-col h-full">
                <div className="p-4 border-b border-gray-800">
                   <span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Asset Library</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 auto-rows-max">
                   {assets.length === 0 && (
                      <div className="col-span-2 text-xs text-gray-500 text-center mt-4 p-4">
                         No assets found. Generate content in Media/Audio Studio first.
                      </div>
                   )}
                   {assets.map((asset, i) => (
                      <div 
                        key={i}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/omni-asset', JSON.stringify(asset));
                        }}
                        className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-primary-500 cursor-grab active:cursor-grabbing group relative"
                      >
                         <div className="aspect-square bg-black flex items-center justify-center">
                            {asset.type === 'image' ? (
                               <img src={asset.url} className="w-full h-full object-cover" alt={asset.name} />
                            ) : asset.type === 'video' ? (
                               <Video size={24} className="text-gray-500" />
                            ) : (
                               <Music size={24} className="text-gray-500" />
                            )}
                         </div>
                         <div className="p-1.5 text-[10px] text-gray-300 truncate bg-gray-850">
                            {asset.name}
                         </div>
                         <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-1">
                            {asset.type === 'image' && <Image size={12} className="text-white" />}
                            {asset.type === 'video' && <Video size={12} className="text-white" />}
                            {asset.type === 'audio' && <Music size={12} className="text-white" />}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {activeActivity === 'DEBUG' && (
            // ... DEBUG UI ...
            <div className="flex flex-col h-full">
               <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Run & Debug</span>
                  <div className="flex gap-1">
                    <button className="p-1 text-green-500 hover:bg-gray-800 rounded"><Play size={14} fill="currentColor" /></button>
                    <button className="p-1 text-gray-500 hover:bg-gray-800 rounded"><Settings size={14} /></button>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto">
                  <div className="border-b border-gray-800">
                     <div className="px-4 py-2 bg-gray-850 text-xs font-bold text-gray-400 uppercase flex justify-between">
                        <span>Variables</span>
                     </div>
                     <div className="p-2 font-mono text-xs">
                         {debugVariables.length === 0 && <div className="text-gray-600 italic px-2">No active variables</div>}
                         {debugVariables.map((v, i) => (
                            <div key={i} className="flex justify-between px-2 py-1 hover:bg-gray-800 rounded cursor-pointer">
                               <span className="text-blue-400">{v.name}:</span>
                               <span className="text-orange-400 truncate max-w-[100px]">{v.value}</span>
                            </div>
                         ))}
                     </div>
                  </div>
                  <div className="border-b border-gray-800">
                     <div className="px-4 py-2 bg-gray-850 text-xs font-bold text-gray-400 uppercase">Call Stack</div>
                     <div className="p-2 font-mono text-xs space-y-1">
                        <div className="px-2 text-yellow-500">App (Active)</div>
                        <div className="px-2 text-gray-500">render</div>
                        <div className="px-2 text-gray-500">react-dom.development.js</div>
                     </div>
                  </div>
               </div>
            </div>
          )}
          
          {activeActivity === 'SEARCH' && (
             // ... SEARCH UI ...
             <div className="flex flex-col h-full">
               <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                   <span className="uppercase tracking-wider text-xs text-gray-500 font-semibold">Search</span>
                   <button 
                     onClick={() => setShowReplace(!showReplace)} 
                     className={`p-1 rounded ${showReplace ? 'text-white bg-gray-700' : 'text-gray-500 hover:text-white'}`}
                     title="Toggle Replace"
                   >
                     <Replace size={14} />
                   </button>
               </div>
               <div className="p-4 border-b border-gray-800 bg-gray-850 space-y-2">
                  <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                      <input 
                        type="text" 
                        placeholder="Search files..." 
                        className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                      />
                  </div>
                  {showReplace && (
                     <div className="relative flex gap-2">
                        <div className="relative flex-1">
                            <Replace size={14} className="absolute left-3 top-2.5 text-gray-500" />
                            <input 
                                type="text" 
                                placeholder="Replace with..." 
                                className="w-full bg-gray-800 border border-gray-700 rounded pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" 
                                value={replaceQuery}
                                onChange={(e) => setReplaceQuery(e.target.value)}
                            />
                        </div>
                        <button 
                           onClick={handleReplace}
                           className="px-3 py-1 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 text-gray-300"
                           title="Replace All"
                        >
                           <Replace size={14} />
                        </button>
                     </div>
                  )}
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                  {searchResults.map((result, idx) => (
                     <div 
                        key={idx} 
                        className="p-2 hover:bg-gray-800 rounded cursor-pointer group border border-transparent hover:border-gray-700 mb-1"
                        onClick={() => handleJumpToLine(result.fileId, result.line)}
                     >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-blue-300 truncate">{result.fileName}</span>
                            <span className="text-[10px] text-gray-500">Ln {result.line}</span>
                        </div>
                        <div className="text-xs text-gray-400 font-mono truncate opacity-80 group-hover:opacity-100">
                            {result.preview}
                        </div>
                     </div>
                  ))}
                  {searchResults.length === 0 && searchQuery && (
                     <div className="mt-4 text-center text-xs text-gray-600">No results found.</div>
                  )}
               </div>
             </div>
          )}
        </div>
        )}

        {/* Center: Editor & Terminal */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Toolbar */}
          <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                 <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleSaveProject} id="save-btn">
                    <Save size={12} className="mr-2" /> Save
                 </Button>
                 <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500 hover:text-white" onClick={handleExport}>
                    <Download size={12} className="mr-2" /> Export Project
                 </Button>
              </div>
              <div className="text-xs text-gray-500 font-mono hidden md:flex items-center gap-2">
                 {extensions.find(e => e.name.includes('Prettier') && e.installed) && (
                     <button onClick={formatCode} className="px-2 py-0.5 rounded hover:bg-gray-800 text-blue-400 border border-blue-900/30 flex items-center gap-1" title="Format with Prettier">
                         <AlignLeft size={10} /> Format
                     </button>
                 )}
                 {isNative ? <div className="flex items-center gap-1 text-green-500"><Check size={12}/> Metro Connected</div> : 
                  isBackend ? <div className="flex items-center gap-1 text-green-500"><Check size={12}/> Node v18.0.0</div> :
                  <div className="flex items-center gap-1 text-green-500"><Check size={12}/> Container Ready</div>}
              </div>
          </div>
          
          {/* Tab Bar */}
          <div className="flex bg-gray-950 border-b border-gray-800 overflow-x-auto scrollbar-none">
              {openFiles.map(fileId => {
                  const file = findFileById(files, fileId);
                  if (!file) return null;
                  const isActive = activeFileId === fileId;
                  return (
                      <div 
                          key={fileId}
                          onClick={() => setActiveFileId(fileId)}
                          className={`
                              group flex items-center gap-2 px-3 py-2 text-xs border-r border-gray-800 cursor-pointer min-w-[100px] max-w-[200px]
                              ${isActive ? 'bg-gray-900 text-white border-t-2 border-t-primary-500' : 'text-gray-500 hover:bg-gray-900 hover:text-gray-300 border-t-2 border-t-transparent'}
                          `}
                      >
                          <span className={`truncate ${file.gitStatus === 'modified' ? 'text-yellow-500' : ''}`}>{file.name}</span>
                          <button 
                              onClick={(e) => handleCloseTab(e, fileId)}
                              className={`opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-gray-700 ${file.gitStatus === 'modified' ? 'text-yellow-500' : 'text-gray-500'}`}
                          >
                              {file.gitStatus === 'modified' ? <div className="w-2 h-2 bg-yellow-500 rounded-full" /> : <X size={10} />}
                          </button>
                      </div>
                  )
              })}
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-gray-900/50">
            <div className="flex-1 min-h-0 overflow-hidden relative">
               {activeFile ? (
                  <CodeEditor 
                    ref={editorRef}
                    code={activeFile.content || ''} 
                    onChange={handleFileChange} 
                    fileName={activeFile.name}
                    config={editorConfig}
                    onCodeAction={handleCodeAction}
                  />
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                    <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center text-gray-600">
                        <FileIcon size={32} />
                    </div>
                    <p>Select a file to edit</p>
                    <div className="flex gap-2 text-xs">
                        <span className="px-2 py-1 bg-gray-800 rounded">Ctrl+P to search</span>
                        <span className="px-2 py-1 bg-gray-800 rounded">Ctrl+S to save</span>
                    </div>
                 </div>
               )}
            </div>
            {layout.showBottom && (
            <div className="h-40 flex-shrink-0 z-10 border-t border-gray-800 flex flex-col">
              <div className="flex border-b border-gray-800 bg-gray-900">
                  <button 
                     onClick={() => setBottomPanelTab('terminal')}
                     className={`px-4 py-1 text-xs uppercase font-semibold ${bottomPanelTab === 'terminal' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}
                  >
                      Terminal
                  </button>
                  <button 
                     onClick={() => setBottomPanelTab('problems')}
                     className={`px-4 py-1 text-xs uppercase font-semibold flex items-center gap-1 ${bottomPanelTab === 'problems' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}
                  >
                      Problems
                      {problems.length > 0 && <span className="bg-yellow-500 text-black px-1 rounded-full text-[9px]">{problems.length}</span>}
                  </button>
              </div>
              <div className="flex-1 overflow-hidden relative">
                  {bottomPanelTab === 'terminal' && <Terminal logs={terminalLogs} onCommand={handleTerminalCommand} />}
                  {bottomPanelTab === 'problems' && (
                      <div className="h-full overflow-y-auto bg-gray-950 p-2 text-sm font-mono">
                          {problems.length === 0 && (
                              <div className="text-gray-500 italic text-xs p-2">No problems detected in active file.</div>
                          )}
                          {problems.map((prob, i) => (
                              <div 
                                 key={i} 
                                 onClick={() => handleJumpToLine(activeFileId, prob.line)}
                                 className="flex gap-2 items-start p-1 hover:bg-gray-800 rounded cursor-pointer"
                              >
                                  {prob.severity === 'error' && <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0"/>}
                                  {prob.severity === 'warning' && <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0"/>}
                                  {prob.severity === 'info' && <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0"/>}
                                  <div className="flex-1">
                                      <span className="text-gray-300 mr-2">{prob.message}</span>
                                      <span className="text-gray-600 text-xs">{prob.file}({prob.line})</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Right: Preview & Chat */}
        {layout.showRight && (
        <div className="w-[450px] bg-gray-900 border-l border-gray-800 flex flex-col flex-shrink-0 shadow-2xl z-20">
           <div className="flex border-b border-gray-800 flex-shrink-0 bg-gray-950">
              <button 
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-2 text-xs text-center font-medium transition-all ${activeTab === 'preview' ? 'border-b-2 border-primary-500 text-white bg-gray-900' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900 border-b-2 border-transparent'}`}
              >
                {isBackend ? 'API Console' : 'Preview'}
              </button>
              {isBackend && (
                <button 
                  onClick={() => setActiveTab('database')}
                  className={`flex-1 py-2 text-xs text-center font-medium transition-all ${activeTab === 'database' ? 'border-b-2 border-primary-500 text-white bg-gray-900' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900 border-b-2 border-transparent'}`}
                >
                  Database
                </button>
              )}
              <button 
                onClick={() => setActiveTab('deploy')}
                className={`flex-1 py-2 text-xs text-center font-medium transition-all ${activeTab === 'deploy' ? 'border-b-2 border-primary-500 text-white bg-gray-900' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900 border-b-2 border-transparent'}`}
              >
                Deploy
              </button>
           </div>

           <div className="h-[60%] border-b border-gray-800 flex flex-col bg-gray-950 relative">
              {activeTab === 'preview' ? (
                isBackend ? (
                   // API Console
                   <div className="flex-1 p-6 bg-gray-900 font-mono">
                      <div className="flex items-center gap-2 mb-6">
                          <Network size={18} className="text-green-500" />
                          <span className="text-white font-bold">API Tester</span>
                          <span className="text-xs text-gray-500 ml-auto">localhost:3000</span>
                      </div>
                      <div className="flex gap-2 mb-4">
                          <select 
                              value={apiMethod} 
                              onChange={e => setApiMethod(e.target.value)}
                              className="bg-gray-800 text-white text-xs rounded border border-gray-700 px-2 py-2 focus:outline-none"
                          >
                              <option>GET</option>
                              <option>POST</option>
                              <option>PUT</option>
                              <option>DELETE</option>
                          </select>
                          <input 
                              type="text" 
                              value={apiPath}
                              onChange={e => setApiPath(e.target.value)}
                              className="flex-1 bg-gray-800 text-white text-xs rounded border border-gray-700 px-3 py-2 focus:outline-none font-mono"
                          />
                          <Button size="sm" onClick={handleApiSend}>Send</Button>
                      </div>
                      <div className="flex-1 flex flex-col">
                          <div className="text-xs text-gray-500 mb-2 flex justify-between">
                             <span>Response</span>
                             {apiStatus && (
                                 <span className={apiStatus >= 200 && apiStatus < 300 ? 'text-green-400' : 'text-red-400'}>
                                     Status: {apiStatus}
                                 </span>
                             )}
                          </div>
                          <textarea 
                              readOnly
                              value={apiResponse}
                              className="w-full h-64 bg-black/50 border border-gray-800 rounded p-3 text-xs text-green-400 font-mono resize-none focus:outline-none"
                          />
                      </div>
                   </div>
                ) : (
                <>
                  <div className="absolute top-2 right-2 z-10 bg-gray-800/80 backdrop-blur rounded p-1 flex gap-1 border border-gray-700">
                    <button 
                      onClick={() => setPreviewMode('web')}
                      className={`p-1.5 rounded transition-colors ${previewMode === 'web' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="Web View"
                    >
                      <Box size={14} />
                    </button>
                    <button 
                      onClick={() => setPreviewMode('mobile')}
                      className={`p-1.5 rounded transition-colors ${previewMode === 'mobile' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="Mobile Simulator"
                    >
                      <Smartphone size={14} />
                    </button>
                    <button 
                      onClick={() => setTerminalLogs(p => [...p, '> Manual Reload...'])}
                      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  
                  <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px]">
                    {previewMode === 'web' ? (
                      <div className="w-full h-full bg-white rounded shadow-lg overflow-hidden border border-gray-700 relative">
                          <iframe 
                            title="app-preview"
                            className="w-full h-full"
                            srcDoc={previewSrc}
                          />
                      </div>
                    ) : (
                      <div className={`transition-all duration-500 relative border-[12px] border-gray-800 bg-black overflow-hidden shadow-2xl flex flex-col ring-1 ring-gray-700
                          ${deviceFrame === 'iphone14' ? 'w-[280px] h-[560px] rounded-[40px]' : 
                            deviceFrame === 'pixel7' ? 'w-[270px] h-[550px] rounded-[24px]' : 
                            'w-[400px] h-[540px] rounded-[16px]' /* iPad */
                          }
                      `}>
                          <div className="absolute top-2 left-2 z-20 flex gap-1">
                             <select 
                               value={deviceFrame} 
                               onChange={(e) => setDeviceFrame(e.target.value as any)}
                               className="bg-gray-900/80 text-[10px] text-gray-400 border border-gray-700 rounded px-1 focus:outline-none backdrop-blur"
                             >
                                <option value="iphone14">iPhone 14</option>
                                <option value="pixel7">Pixel 7</option>
                                <option value="ipad">iPad Air</option>
                             </select>
                             <button 
                               onClick={handleScanQr}
                               className={`bg-gray-900/80 text-gray-400 border border-gray-700 rounded px-1.5 flex items-center justify-center hover:text-white ${showQrCode ? 'text-primary-500 border-primary-500' : ''}`}
                               title="Scan QR Code (Expo Go)"
                             >
                               <QrCode size={12} />
                             </button>
                          </div>

                          {/* Notch logic */}
                          {deviceFrame === 'iphone14' && (
                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-20 flex justify-center items-end pb-1">
                                <div className="w-12 h-1 bg-gray-700 rounded-full"></div>
                            </div>
                          )}
                           {deviceFrame === 'pixel7' && (
                            <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-3 h-3 bg-gray-800 rounded-full z-20"></div>
                          )}

                          <div className="flex-1 bg-white w-full h-full pt-8 relative overflow-hidden">
                              <div className="absolute top-0 left-0 right-0 h-20 bg-white/90 backdrop-blur z-10 border-b flex items-end justify-between px-4 pb-2">
                                  <span className="text-xs font-bold text-gray-800">Expo Go</span>
                                  <span className="text-[10px] text-gray-400">Connected</span>
                              </div>
                              <iframe 
                                  title="mobile-preview"
                                  className="w-full h-full"
                                  style={{ border: 'none' }}
                                  srcDoc={previewSrc}
                              />
                              
                              {/* QR Code Overlay */}
                              {showQrCode && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-6">
                                  <div className="bg-white p-4 rounded-xl shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                     <div className="w-40 h-40 bg-gray-900 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden">
                                        <div className="absolute inset-0 opacity-10 bg-[url('https://upload.wikimedia.org/wikipedia/commons/d/d0/Qr_code_2d_barcode_wikipedia.png')] bg-cover"></div>
                                        <QrCode size={64} className="text-white" />
                                     </div>
                                     <p className="text-sm font-bold text-gray-800 mb-1">Scan with Expo Go</p>
                                     <p className="text-xs text-gray-500 text-center">Android & iOS supported</p>
                                     <button onClick={() => setShowQrCode(false)} className="mt-4 text-xs text-blue-600 font-medium hover:underline">Close</button>
                                  </div>
                                </div>
                              )}
                          </div>
                          {deviceFrame === 'iphone14' && (
                            <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gray-500 rounded-full z-20"></div>
                          )}
                      </div>
                    )}
                  </div>
                </>
                )
              ) : activeTab === 'database' ? (
                 // ... DATABASE UI ...
                 <div className="flex-1 p-6 bg-gray-900 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                       <Database size={18} className="text-blue-500" />
                       <span className="text-white font-bold">Postgres Studio</span>
                       <span className="text-xs text-gray-500 ml-auto">v15.2</span>
                    </div>
                    
                    <div className="mb-4">
                       <label className="text-xs text-gray-400 font-mono mb-1 block">SQL Query</label>
                       <div className="flex gap-2">
                          <input 
                             type="text" 
                             className="flex-1 bg-black border border-gray-800 rounded px-3 py-2 text-sm text-green-400 font-mono focus:outline-none focus:border-blue-500"
                             value={sqlQuery}
                             onChange={(e) => setSqlQuery(e.target.value)}
                          />
                          <Button size="sm" onClick={handleRunQuery}><Play size={12} className="mr-1" /> Run</Button>
                       </div>
                    </div>

                    <div className="flex-1 bg-gray-800 border border-gray-700 rounded overflow-hidden">
                        <div className="bg-gray-700 px-4 py-2 text-xs font-medium text-gray-300 flex gap-4 border-b border-gray-600">
                            <div className="flex items-center gap-1"><Table size={12}/> public.users</div>
                            <div className="flex items-center gap-1 text-gray-500">public.products</div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                               <thead className="bg-gray-750 text-gray-400">
                                  <tr>
                                     <th className="px-4 py-2 font-medium">id</th>
                                     <th className="px-4 py-2 font-medium">name</th>
                                     <th className="px-4 py-2 font-medium">email</th>
                                     <th className="px-4 py-2 font-medium">role</th>
                                     <th className="px-4 py-2 font-medium">created_at</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-gray-700 text-gray-300">
                                  {dbResults.map((row, idx) => (
                                     <tr key={idx} className="hover:bg-gray-700/50">
                                        <td className="px-4 py-2 font-mono text-blue-300">{row.id}</td>
                                        <td className="px-4 py-2">{row.name}</td>
                                        <td className="px-4 py-2">{row.email}</td>
                                        <td className="px-4 py-2">
                                           <span className={`px-1.5 py-0.5 rounded text-[10px] ${row.role === 'admin' ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-300'}`}>{row.role}</span>
                                        </td>
                                        <td className="px-4 py-2 text-gray-500">{row.created_at}</td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                        </div>
                        <div className="p-2 bg-gray-800 text-[10px] text-gray-500 border-t border-gray-700">
                           {dbResults.length} rows returned in 0.04s
                        </div>
                    </div>
                 </div>
              ) : (
                // Deployment View
                <div className="flex-1 p-8 flex flex-col items-center bg-gray-900 overflow-y-auto">
                  {deploymentState === 'idle' ? (
                    <div className="text-center my-auto">
                      <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-500">
                        <Rocket size={32} />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Ready to Launch</h3>
                      <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                        Build and deploy your application to the Edge Network. This will make it publicly accessible.
                      </p>
                      <Button onClick={handleDeploy} className="w-full">
                        Deploy Production Build
                      </Button>
                    </div>
                  ) : deploymentState === 'deployed' ? (
                    <div className="text-center w-full">
                      <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500">
                        <Check size={32} />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Deployment Successful!</h3>
                      <div className="bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-2 mb-6 border border-gray-700">
                        <Globe size={16} className="text-gray-400" />
                        <span className="text-xs text-blue-400 font-mono truncate flex-1">{deployUrl}</span>
                        <a href="#" className="text-gray-400 hover:text-white"><ExternalLink size={14} /></a>
                      </div>
                      <Button variant="secondary" onClick={() => setDeploymentState('idle')}>
                        Deploy Again
                      </Button>
                    </div>
                  ) : (
                     <div className="w-full max-w-xs space-y-6 my-auto">
                       {/* Progress bars simulated */}
                       <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${deploymentState === 'building' ? 'bg-blue-500/20 text-blue-400 animate-pulse' : 'bg-gray-800 text-gray-500'}`}>
                           <Box size={16} />
                         </div>
                         <div className="flex-1">
                           <div className="text-sm font-medium text-white">Bundling</div>
                           <div className="h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
                             <div className={`h-full bg-blue-500 transition-all duration-1000 ${deploymentState === 'building' ? 'w-1/2' : 'w-full'}`}></div>
                           </div>
                         </div>
                       </div>
                       {/* Optimizing */}
                       <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${['optimizing', 'uploading'].includes(deploymentState) ? 'bg-purple-500/20 text-purple-400 animate-pulse' : 'bg-gray-800 text-gray-500'}`}>
                           <Zap size={16} />
                         </div>
                         <div className="flex-1">
                           <div className="text-sm font-medium text-white">Optimizing</div>
                           <div className="h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
                             <div className={`h-full bg-purple-500 transition-all duration-1000 ${['optimizing', 'uploading'].includes(deploymentState) ? 'w-1/2' : deploymentState === 'building' ? 'w-0' : 'w-full'}`}></div>
                           </div>
                         </div>
                       </div>
                       {/* Uploading */}
                       <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-full ${deploymentState === 'uploading' ? 'bg-green-500/20 text-green-400 animate-pulse' : 'bg-gray-800 text-gray-500'}`}>
                           <Server size={16} />
                         </div>
                         <div className="flex-1">
                           <div className="text-sm font-medium text-white">Uploading</div>
                           <div className="h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
                             <div className={`h-full bg-green-500 transition-all duration-1000 ${deploymentState === 'uploading' ? 'w-1/2' : 'w-0'}`}></div>
                           </div>
                         </div>
                       </div>
                     </div>
                  )}
                  
                  {/* Deployment History Table */}
                  <div className="w-full mt-12 border-t border-gray-800 pt-6">
                     <div className="flex items-center gap-2 mb-4 text-gray-400">
                        <History size={16} />
                        <span className="text-sm font-medium uppercase tracking-wider">Deployment History</span>
                     </div>
                     <div className="w-full bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                        <table className="w-full text-left text-xs">
                           <thead className="bg-gray-900 text-gray-500 font-medium">
                              <tr>
                                 <th className="px-4 py-2">Env</th>
                                 <th className="px-4 py-2">Status</th>
                                 <th className="px-4 py-2">Commit</th>
                                 <th className="px-4 py-2 text-right">Time</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-700">
                              {MOCK_DEPLOYMENTS.map((dep, i) => (
                                 <tr key={i} className="text-gray-300 hover:bg-gray-700/50">
                                    <td className="px-4 py-2">{dep.env}</td>
                                    <td className="px-4 py-2">
                                       <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${dep.status === 'Success' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                          {dep.status}
                                       </span>
                                    </td>
                                    <td className="px-4 py-2 font-mono text-gray-500">{dep.hash}</td>
                                    <td className="px-4 py-2 text-right text-gray-500">{dep.date}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
                </div>
              )}
           </div>

           <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.map(msg => (
                  <MessageRenderer 
                    key={msg.id} 
                    message={msg} 
                    onApplyCode={handleApplyCode} 
                    onApplyAll={handleApplyAll}
                  />
                ))}
                {attachedImage && (
                   <div className="mx-4 mb-2 relative inline-block group">
                      <img src={attachedImage} alt="attachment" className="h-24 rounded-lg border border-gray-700 object-cover" />
                      <button 
                         onClick={() => setAttachedImage(undefined)}
                         className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                         <X size={12} />
                      </button>
                   </div>
                )}
                {isUploading && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 ml-2">
                     <div className="w-2 h-2 bg-primary-500 rounded-full animate-ping"></div>
                     Reading file...
                  </div>
                )}
                {isGenerating && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 ml-2">
                     <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                     Omni is thinking...
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-gray-850 border-t border-gray-800">
                 <form onSubmit={handleChatSubmit} className="relative">
                    <input 
                      type="text" 
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-24 py-3 text-sm text-white focus:outline-none focus:border-primary-500 placeholder-gray-500 transition-all"
                      placeholder="Ask to change the app, or type / for commands..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={isGenerating}
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                       <button 
                          type="button"
                          title="Voice Input"
                          onClick={toggleVoiceInput}
                          className={`p-1.5 rounded-md transition-colors ${isListening ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                       >
                          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                       </button>
                       <button 
                          type="button"
                          title="Attach Video/Image"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                       >
                          <Video size={16} />
                       </button>
                        <button 
                          type="submit"
                          title="Send"
                          id="chat-submit-btn"
                          disabled={isGenerating || (!chatInput.trim() && !attachedImage)}
                          className="p-1.5 text-primary-500 hover:text-white hover:bg-primary-600 rounded-md transition-colors"
                       >
                          <ArrowRight size={16} />
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="h-6 bg-blue-900 text-white flex items-center px-3 text-xs select-none z-50 justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => toggleLayout('sidebar')}
            className={`flex items-center gap-1 hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer ${!layout.showSidebar && 'opacity-50'}`}
            title="Toggle Sidebar"
          >
            <SidebarIcon size={10} />
          </button>
          <div className="w-px h-3 bg-blue-700 mx-1"></div>
          <div 
            onClick={() => setShowBranchMenu(prev => !prev)}
            className="flex items-center gap-1 hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer"
            title="Switch Branch"
          >
            <GitBranch size={10} />
            <span className="font-medium">{currentBranch}*</span>
          </div>
          {extensions.find(e => e.name === 'GitLens' && e.installed) && (
            <div className="hidden md:flex items-center gap-1 text-gray-300 hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer">
               <span className="italic opacity-70">You, 2 mins ago • Uncommitted changes</span>
            </div>
          )}
          <div className="flex items-center gap-1 hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer text-yellow-300">
            <AlertTriangle size={10} />
            <span>{problems.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1 mr-4">
              <button 
                onClick={() => toggleLayout('bottom')}
                className={`p-1 hover:bg-blue-800 rounded ${!layout.showBottom && 'opacity-50'}`}
                title="Toggle Terminal"
              >
                 <PanelBottom size={10} />
              </button>
              <button 
                onClick={() => toggleLayout('right')}
                className={`p-1 hover:bg-blue-800 rounded ${!layout.showRight && 'opacity-50'}`}
                title="Toggle Preview"
              >
                 <Columns size={10} />
              </button>
           </div>
          <span className="hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer">Ln 12, Col 44</span>
          <span className="hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer">UTF-8</span>
          <span className="hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer">{activeFile?.name.endsWith('json') ? 'JSON' : activeFile?.name.endsWith('css') ? 'CSS' : 'TypeScript React'}</span>
          {extensions.find(e => e.name.includes('Prettier') && e.installed) && (
            <span className="hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer flex items-center gap-1">
               <Check size={10} /> Prettier
            </span>
          )}
          <span className="hover:bg-blue-800 px-2 py-0.5 rounded cursor-pointer text-blue-200 font-semibold">
             {activeModel}
          </span>
        </div>
      </div>
    </div>
  );
};
