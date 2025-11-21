
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Folder, File as FileIcon, Play, Save, ChevronRight, ChevronDown, MoreVertical, Box, Smartphone, Paperclip, Video, Mic, CornerDownLeft, ArrowRight, Check, RefreshCw, Rocket, Loader2, Globe, ExternalLink, Zap, Server, Plus, Trash2, FolderPlus, FilePlus, MicOff, Download, Network, GitBranch, Search, Files, Settings, GitCommit, Tablet, Monitor, Database, Table, QrCode, History, Image, Music, LayoutTemplate, X, Command, Package, AlertTriangle, AlertCircle, Info, Sidebar as SidebarIcon, PanelBottom, Columns, Edit2, Copy, MessageSquare, FileText, Puzzle, Cloud, UploadCloud, FolderInput, FileInput, AlignLeft, Link, User, Bug, Replace, Clock, GitPullRequest, Layers, Wand2 } from 'lucide-react';
import { WEB_FILE_TREE, NATIVE_FILE_TREE, NODE_FILE_TREE, MOCK_DEPLOYMENTS, SYSTEM_COMMANDS, MOCK_EXTENSIONS, MOCK_COMMITS } from '../constants';
import { FileNode, ChatMessage, Project, ProjectType, SocialPost, AudioTrack, Extension, GitCommit as GitCommitType } from '../types';
import { CodeEditor, CodeEditorHandle } from '../components/CodeEditor';
import { Terminal } from '../components/Terminal';
import { generateCodeResponse, generateImage, generateSpeech } from '../services/geminiService';
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
  onSaveAsset?: (type: 'image' | 'audio', url: string, name: string) => void;
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

const MessageRenderer: React.FC<MessageRendererProps> = ({ message, onApplyCode, onApplyAll, onSaveAsset }) => {
  const parts = message.text.split(/(```[\s\S]*?```)/g);
  const codeBlocks = parts.filter(part => part.startsWith('```') && part.endsWith('```')).map(part => part.replace(/^```\w*\n?/, '').replace(/```$/, ''));

  return (
    <div className={`flex flex-col w-full ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[95%] rounded-lg p-3 text-sm shadow-md border relative ${message.role === 'user' ? 'bg-primary-600 text-white border-primary-500' : 'bg-gray-800 text-gray-200 border-gray-700'}`}>
         
         {/* Text Content */}
         {message.role !== 'model' ? (
             <div>
                {message.text.startsWith('[Attached:') ? (
                   <div className="mb-1">
                      <div className="flex items-center gap-2 text-blue-200 font-semibold text-xs mb-1">
                          <Paperclip size={12} /> {message.text.split('\n')[0]}
                      </div>
                      {message.text.split('\n').slice(1).join('\n')}
                   </div>
                ) : message.text}
             </div>
         ) : (
             // Model Content with Code Blocks
             <div className="w-full">
                 {codeBlocks.length > 1 && onApplyAll && (
                     <div className="w-full bg-gray-900/50 border-b border-gray-700 p-2 flex justify-end mb-2 rounded">
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
                       const filenameMatch = content.match(/^\/\/ filename: (.*)/);
                       const targetFile = filenameMatch ? filenameMatch[1].trim() : 'Current File';
        
                       return (
                         <div key={idx} className="my-2 first:mt-0 last:mb-0 rounded overflow-hidden border border-gray-700">
                            <div className="flex justify-between items-center bg-gray-900 px-3 py-1.5 border-b border-gray-700">
                               <div className="flex items-center gap-2">
                                   <span className="text-xs text-gray-500 font-mono uppercase">{lang}</span>
                                   {filenameMatch && <span className="text-xs text-blue-400 font-mono bg-blue-900/20 px-1 rounded border border-blue-800">{targetFile}</span>}
                               </div>
                               <button 
                                 onClick={() => onApplyCode(content)}
                                 className="flex items-center gap-1 text-[10px] bg-primary-900/30 hover:bg-primary-900/50 border border-primary-700 text-primary-300 px-2 py-1 rounded transition-colors"
                               >
                                 <CornerDownLeft size={10} /> {filenameMatch ? `Create/Update` : 'Apply'}
                               </button>
                            </div>
                            <pre className="p-3 overflow-x-auto bg-gray-950/50 font-mono text-xs text-gray-300 scrollbar-thin scrollbar-thumb-gray-700">
                               {content}
                            </pre>
                         </div>
                       );
                    }
                    if (!part.trim()) return null;
                    return <div key={idx} className="whitespace-pre-wrap mb-2">{part}</div>
                 })}
             </div>
         )}

         {/* Attachments */}
         {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 space-y-3">
               {message.attachments.map((att, i) => (
                   <div key={i} className="bg-gray-900/50 rounded p-2 border border-gray-700">
                       {att.type === 'image' && (
                           <div className="relative group">
                               <img src={att.url} alt="Generated" className="w-full h-auto rounded max-h-64 object-contain bg-gray-950" />
                               <button 
                                  onClick={() => onSaveAsset?.('image', att.url, att.name || `image_${Date.now()}.png`)}
                                  className="absolute top-2 right-2 bg-black/60 hover:bg-primary-600 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-all"
                                  title="Save to Assets"
                               >
                                   <Save size={14} />
                               </button>
                           </div>
                       )}
                       {att.type === 'audio' && (
                           <div className="flex items-center gap-2">
                               <audio controls src={att.url} className="h-8 w-full" />
                               <button 
                                  onClick={() => onSaveAsset?.('audio', att.url, att.name || `audio_${Date.now()}.wav`)}
                                  className="bg-gray-700 hover:bg-primary-600 text-white p-1.5 rounded transition-colors"
                                  title="Save to Assets"
                               >
                                   <Save size={14} />
                               </button>
                           </div>
                       )}
                       <div className="mt-1 text-[10px] text-gray-500 flex justify-between items-center">
                           <span className="italic">{att.name || 'Generated Asset'}</span>
                           <span className="uppercase">{att.type}</span>
                       </div>
                   </div>
               ))}
            </div>
         )}
      </div>
    </div>
  );
};

export const Workspace: React.FC<WorkspaceProps> = ({ project }) => {
  const isNative = project?.type === ProjectType.REACT_NATIVE;
  const isBackend = project?.type === ProjectType.NODE_API;
  
  const [files, setFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const [openFiles, setOpenFiles] = useState<string[]>(['1']);
  
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'deploy' | 'database'>('preview');
  const [bottomPanelTab, setBottomPanelTab] = useState<'terminal' | 'problems'>('terminal');
  const [previewMode, setPreviewMode] = useState<'web' | 'mobile'>(isNative ? 'mobile' : 'web');
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
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

  const loadAssets = useCallback(() => {
      const posts: SocialPost[] = JSON.parse(localStorage.getItem('omni_social_posts') || '[]');
      const audio: AudioTrack[] = JSON.parse(localStorage.getItem('omni_audio_tracks') || '[]');
      const newAssets: {type: 'image' | 'video' | 'audio', url: string, name: string}[] = [];

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
  }, []);

  useEffect(() => {
    loadAssets();
    window.addEventListener('omniAssetsUpdated', loadAssets);
    return () => window.removeEventListener('omniAssetsUpdated', loadAssets);
  }, [loadAssets]);

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
       setPreviewMode(isNative ? 'mobile' : 'web');
    }

    return () => window.removeEventListener('omniSettingsChanged', loadSettings);
  }, [project?.id, project?.type, isNative, isBackend]);

  useEffect(() => {
    const runLinter = () => {
        const newProblems: Problem[] = [];
        const activeFile = findFileById(files, activeFileId);
        if (activeFile?.content) {
            const lines = activeFile.content.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('console.log')) newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Unexpected console statement', severity: 'warning' });
                if (line.includes('TODO:')) newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Pending TODO item', severity: 'info' });
                if (line.length > 120) newProblems.push({ file: activeFile.name, line: idx + 1, message: 'Line exceeds 120 characters', severity: 'warning' });
            });
            
            // Simple Regex for vars
            const vars: {name: string, value: string}[] = [];
            const varMatch = activeFile.content.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*([^;]+)/g);
            for (const match of varMatch) {
               vars.push({ name: match[1], value: match[2].trim() });
            }
            setDebugVariables(vars);
        }
        setProblems(newProblems);
    };
    runLinter();
  }, [files, activeFileId]);

  useEffect(() => {
    if (project) {
        localStorage.setItem(`omni_open_tabs_${project.id}`, JSON.stringify({ openFiles, activeFileId }));
    }
  }, [openFiles, activeFileId, project]);

  // Debounce preview generation
  useEffect(() => {
    const timer = setTimeout(() => {
        const activeFile = findFileById(files, activeFileId);
        // For preview, we want App.tsx usually. Let's just use active file if it's runnable, 
        // OR find App.tsx/index.html from files.
        // Simplified: Use active file content if it looks like a component, or find App.tsx
        let codeToRun = '';
        const appFile = files.flatMap(f => f.children || [f]).find(f => f.name === 'App.tsx' || f.name === 'index.html');
        
        if (appFile) codeToRun = appFile.content || '';
        else codeToRun = activeFile?.content || '';

        if (codeToRun) {
            setPreviewSrc(generatePreviewHtml(codeToRun, isNative));
        }
    }, 1000);
    return () => clearTimeout(timer);
  }, [files, activeFileId, isNative]);

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

  const updateFileContent = (fileId: string, newContent: string) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === fileId) {
          return { ...node, content: newContent, gitStatus: 'modified' };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    const newFiles = updateNode(files);
    setFiles(newFiles);
    if (project) {
        localStorage.setItem(`omni_files_${project.id}`, JSON.stringify(newFiles));
    }
  };

  const handleApplyCode = (code: string) => {
    // 1. Check for filename comment
    const filenameMatch = code.match(/^\/\/ filename: (.*)/);
    
    if (filenameMatch) {
        const path = filenameMatch[1].trim();
        upsertFileByPath(path, code.replace(filenameMatch[0], '').trim());
        setTerminalLogs(prev => [...prev, `> Updated file: ${path}`]);
    } else {
        // Apply to currently open file
        if (activeFileId) {
            updateFileContent(activeFileId, code);
            setTerminalLogs(prev => [...prev, `> Applied changes to active file.`]);
        }
    }
  };

  const handleApplyAll = (codes: string[]) => {
      codes.forEach(code => handleApplyCode(code));
      setTerminalLogs(prev => [...prev, `> Applied all ${codes.length} changes.`]);
  };

  const upsertFileByPath = (path: string, content: string) => {
      const parts = path.split('/');
      const fileName = parts.pop()!;
      
      // Recursive upsert logic
      const upsert = (nodes: FileNode[], currentPathIdx: number): FileNode[] => {
          const currentSegment = parts[currentPathIdx];
          
          // If we are at the file level (no more directories)
          if (currentPathIdx >= parts.length) {
              const existingFileIndex = nodes.findIndex(n => n.name === fileName && n.type === 'file');
              if (existingFileIndex !== -1) {
                  // Update existing
                  const updatedNodes = [...nodes];
                  updatedNodes[existingFileIndex] = { ...updatedNodes[existingFileIndex], content, gitStatus: 'modified' };
                  return updatedNodes;
              } else {
                  // Create new file
                  return [...nodes, { id: Math.random().toString(36).substr(2, 9), name: fileName, type: 'file', content, gitStatus: 'added' }];
              }
          }

          // Handle directory traversal
          const existingDirIndex = nodes.findIndex(n => n.name === currentSegment && n.type === 'directory');
          if (existingDirIndex !== -1) {
               const updatedNodes = [...nodes];
               updatedNodes[existingDirIndex] = {
                   ...updatedNodes[existingDirIndex],
                   isOpen: true,
                   children: upsert(updatedNodes[existingDirIndex].children || [], currentPathIdx + 1)
               };
               return updatedNodes;
          } else {
               // Create new directory
               const newDir: FileNode = {
                   id: Math.random().toString(36).substr(2, 9),
                   name: currentSegment,
                   type: 'directory',
                   isOpen: true,
                   gitStatus: 'added',
                   children: []
               };
               newDir.children = upsert([], currentPathIdx + 1);
               return [...nodes, newDir];
          }
      };

      const newFiles = upsert(files, 0);
      setFiles(newFiles);
      if (project) localStorage.setItem(`omni_files_${project.id}`, JSON.stringify(newFiles));
  };

  const handleTerminalCommand = (cmd: string) => {
      const args = cmd.trim().split(' ');
      const command = args[0];

      if (command === 'clear') {
          setTerminalLogs([]);
          return;
      }
      if (command === 'ls') {
          const list = files.map(f => f.name + (f.type === 'directory' ? '/' : '')).join('  ');
          setTerminalLogs(prev => [...prev, list]);
          return;
      }
      if (command === 'npm') {
          if (args[1] === 'install') {
              setTerminalLogs(prev => [...prev, '> npm install', 'added 142 packages in 2s']);
          } else if (args[1] === 'start') {
              setTerminalLogs(prev => [...prev, '> npm start', '> Starting development server...', '> Ready on http://localhost:3000']);
          } else if (args[1] === 'test') {
             setTerminalLogs(prev => [...prev, '> jest', 'PASS src/App.test.js', 'Test Suites: 1 passed, 1 total']);
          }
          return;
      }
      if (command === 'git') {
          if (args[1] === 'status') {
              setTerminalLogs(prev => [...prev, `On branch ${currentBranch}`, 'Changes to be committed:', ...files.filter(f => f.gitStatus === 'modified').map(f => `  modified: ${f.name}`)]);
          }
          return;
      }
      
      setTerminalLogs(prev => [...prev, `sh: command not found: ${command}`]);
  };

  const handleSaveChatAsset = (type: 'image' | 'audio', url: string, name: string) => {
      if (type === 'audio') {
          const tracks = JSON.parse(localStorage.getItem('omni_audio_tracks') || '[]');
          tracks.push({
              id: `gen-${Date.now()}`,
              name: name,
              type: 'sfx',
              duration: 5,
              startOffset: 0,
              audioUrl: url
          });
          localStorage.setItem('omni_audio_tracks', JSON.stringify(tracks));
      } else {
          const posts = JSON.parse(localStorage.getItem('omni_social_posts') || '[]');
          let assetPost = posts.find((p: any) => p.id === 'omni-assets-inbox');
          if (!assetPost) {
              assetPost = {
                  id: 'omni-assets-inbox',
                  title: 'Generated Assets Inbox',
                  platform: 'instagram',
                  status: 'idea',
                  scenes: []
              };
              posts.push(assetPost);
          }
          assetPost.scenes.push({
              id: `gen-${Date.now()}`,
              description: 'Generated in Chat',
              status: 'done',
              imageUrl: url
          });
          localStorage.setItem('omni_social_posts', JSON.stringify(posts));
      }
      
      window.dispatchEvent(new Event('omniAssetsUpdated'));
      setTerminalLogs(prev => [...prev, `> Asset saved: ${name}`]);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    if (chatInput.startsWith('/')) {
        const [cmd, ...args] = chatInput.split(' ');
        const prompt = args.join(' ');
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
                text: `Available Commands:\n${SYSTEM_COMMANDS.join('\n')}\n/image <prompt>\n/tts <text>`,
                timestamp: Date.now()
            }]);
            return;
        }
        if (cmd === '/image') {
             if (!prompt) return;
             setIsGenerating(true);
             const tempId = Date.now().toString();
             setChatHistory(prev => [...prev, { id: tempId, role: 'model', text: 'Generating image...', timestamp: Date.now() }]);
             
             const imgUrl = await generateImage(prompt);
             setIsGenerating(false);
             
             if (imgUrl) {
                 setChatHistory(prev => prev.map(m => m.id === tempId ? {
                     ...m,
                     text: `Generated image for: "${prompt}"`,
                     attachments: [{ type: 'image', url: imgUrl, name: prompt.substring(0, 20) }]
                 } : m));
             } else {
                 setChatHistory(prev => prev.map(m => m.id === tempId ? { ...m, text: 'Failed to generate image.' } : m));
             }
             return;
        }
        if (cmd === '/tts') {
             if (!prompt) return;
             setIsGenerating(true);
             const tempId = Date.now().toString();
             setChatHistory(prev => [...prev, { id: tempId, role: 'model', text: 'Generating audio...', timestamp: Date.now() }]);
             
             const audioUrl = await generateSpeech(prompt);
             setIsGenerating(false);
             
             if (audioUrl) {
                 setChatHistory(prev => prev.map(m => m.id === tempId ? {
                     ...m,
                     text: `Generated audio for: "${prompt}"`,
                     attachments: [{ type: 'audio', url: audioUrl, name: prompt.substring(0, 20) }]
                 } : m));
             } else {
                 setChatHistory(prev => prev.map(m => m.id === tempId ? { ...m, text: 'Failed to generate audio.' } : m));
             }
             return;
        }
        if (cmd === '/explain') {
            triggerGeneration(`Explain the code in ${activeFile?.name || 'the current file'} step by step.`);
            return;
        }
        if (cmd === '/fix') {
            triggerGeneration(`Find and fix bugs in ${activeFile?.name || 'the current file'}.`);
            return;
        }
    }

    const newUserMsg = { id: Date.now().toString(), role: 'user' as const, text: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');
    triggerGeneration(newUserMsg.text);
  };

  const triggerGeneration = async (prompt: string) => {
    setIsGenerating(true);
    const currentCode = activeFile?.content || '';
    const fileStructure = JSON.stringify(files.map(f => f.name));

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
      attachedImage 
    );
    
    setAttachedImage(undefined);
    setIsGenerating(false);
  };

  const handleCodeAction = (action: string, selectedCode: string) => {
     const prompt = `${action} the following code:\n${selectedCode}`;
     const userMsg = { id: Date.now().toString(), role: 'user' as const, text: prompt, timestamp: Date.now() };
     setChatHistory(prev => [...prev, userMsg]);
     triggerGeneration(prompt);
  };

  const handleCommit = () => {
    if (!commitMessage) return;
    const newCommit = {
        id: Math.random().toString(36).substr(2, 7),
        message: commitMessage,
        author: 'User',
        date: 'Just now',
        hash: Math.random().toString(16).substr(2, 7)
    };
    setCommits([newCommit, ...commits]);
    setCommitMessage('');
    // Reset modified flags
    const cleanFiles = (nodes: FileNode[]): FileNode[] => nodes.map(n => ({
        ...n,
        gitStatus: 'unmodified',
        children: n.children ? cleanFiles(n.children) : undefined
    }));
    setFiles(cleanFiles(files));
    setTerminalLogs(prev => [...prev, `> git commit -m "${commitMessage}"`, `[${currentBranch} ${newCommit.hash}] ${commitMessage}`]);
  };

  const handleMultimediaUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result as string;
        if (file.type.startsWith('image/')) {
            setAttachedImage(result);
            setChatInput(prev => `[Attached: ${file.name}]\n` + prev);
        }
    };
    reader.readAsDataURL(file);
  };

  const handleExport = async () => {
      const zip = new JSZip();
      const addFiles = (nodes: FileNode[], parentPath: string) => {
          nodes.forEach(node => {
              if (node.type === 'file' && node.content) {
                  zip.file(`${parentPath}${node.name}`, node.content);
              } else if (node.type === 'directory' && node.children) {
                  addFiles(node.children, `${parentPath}${node.name}/`);
              }
          });
      };
      addFiles(files, '');
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'project'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleDeploy = () => {
      setDeploymentState('building');
      setTerminalLogs(prev => [...prev, '> Building for production...']);
      
      setTimeout(() => {
          setDeploymentState('optimizing');
          setTerminalLogs(prev => [...prev, '> Optimizing assets...']);
          setTimeout(() => {
              setDeploymentState('uploading');
              setTerminalLogs(prev => [...prev, '> Uploading to Edge Network...']);
              setTimeout(() => {
                   setDeploymentState('deployed');
                   const url = `https://${project?.name.toLowerCase().replace(/\s+/g, '-')}.omni.app`;
                   setDeployUrl(url);
                   setTerminalLogs(prev => [...prev, `> Deployment Complete! Live at: ${url}`]);
              }, 1500);
          }, 1500);
      }, 1500);
  };

  const activeFile = findFileById(files, activeFileId);

  // Recursive render for file tree
  const renderTree = (nodes: FileNode[], depth = 0) => (
    <div className="select-none">
      {nodes.map(node => (
        <div key={node.id}>
          <div 
            className={`flex items-center py-1 px-2 hover:bg-gray-800 cursor-pointer ${activeFileId === node.id ? 'bg-gray-800 text-white' : 'text-gray-400'} ${node.gitStatus === 'modified' ? 'text-yellow-400' : node.gitStatus === 'added' ? 'text-green-400' : ''}`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => {
              if (node.type === 'directory') {
                 // Toggle open
                 const toggleNode = (ns: FileNode[]): FileNode[] => ns.map(n => n.id === node.id ? { ...n, isOpen: !n.isOpen } : { ...n, children: n.children ? toggleNode(n.children) : undefined });
                 setFiles(toggleNode(files));
              } else {
                 setActiveFileId(node.id);
                 if (!openFiles.includes(node.id)) setOpenFiles([...openFiles, node.id]);
              }
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ visible: true, x: e.clientX, y: e.clientY, fileId: node.id });
            }}
          >
            <span className="mr-1">
              {node.type === 'directory' ? (
                node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <FileIcon size={14} className={node.name.endsWith('css') ? 'text-blue-400' : node.name.endsWith('ts') || node.name.endsWith('tsx') ? 'text-blue-500' : 'text-gray-500'} />
              )}
            </span>
            <span className="text-sm truncate">{node.name}</span>
            {node.gitStatus === 'modified' && <span className="ml-auto text-[10px] font-bold text-yellow-500">M</span>}
            {node.gitStatus === 'added' && <span className="ml-auto text-[10px] font-bold text-green-500">A</span>}
          </div>
          {node.type === 'directory' && node.isOpen && node.children && renderTree(node.children, depth + 1)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden w-full" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files[0]) handleMultimediaUpload(e.dataTransfer.files[0]); }}>
      
      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => { /* handle upload */ }} multiple />
      <input type="file" ref={folderInputRef} className="hidden" onChange={(e) => { /* handle folder */ }} {...{ webkitdirectory: "" } as any} />

      {/* Context Menu */}
      {contextMenu.visible && (
          <div className="fixed bg-gray-800 border border-gray-700 rounded shadow-xl py-1 z-50" style={{ top: contextMenu.y, left: contextMenu.x }}>
              <button className="w-full text-left px-4 py-1 text-sm text-gray-300 hover:bg-gray-700" onClick={() => { /* rename */ setContextMenu({...contextMenu, visible: false}); }}>Rename</button>
              <button className="w-full text-left px-4 py-1 text-sm text-gray-300 hover:bg-gray-700" onClick={() => { /* delete */ setContextMenu({...contextMenu, visible: false}); }}>Delete</button>
              <button className="w-full text-left px-4 py-1 text-sm text-gray-300 hover:bg-gray-700" onClick={() => setContextMenu({...contextMenu, visible: false})}>Copy Path</button>
          </div>
      )}
      {contextMenu.visible && <div className="fixed inset-0 z-40" onClick={() => setContextMenu({...contextMenu, visible: false})}></div>}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <div className="w-12 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-4 z-20 flex-shrink-0">
             <button onClick={() => setActiveActivity('EXPLORER')} className={`p-2 rounded ${activeActivity === 'EXPLORER' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-gray-300'}`}><Files size={20}/></button>
             <button onClick={() => setActiveActivity('GIT')} className={`p-2 rounded ${activeActivity === 'GIT' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-white'}`}><GitBranch size={20}/></button>
             <button onClick={() => setActiveActivity('SEARCH')} className={`p-2 rounded ${activeActivity === 'SEARCH' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-white'}`}><Search size={20}/></button>
             <button onClick={() => setActiveActivity('ASSETS')} className={`p-2 rounded ${activeActivity === 'ASSETS' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-white'}`}><Image size={20}/></button>
             <button onClick={() => setActiveActivity('EXTENSIONS')} className={`p-2 rounded ${activeActivity === 'EXTENSIONS' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-white'}`}><Puzzle size={20}/></button>
             <button onClick={() => setActiveActivity('DEBUG')} className={`p-2 rounded ${activeActivity === 'DEBUG' ? 'text-white bg-gray-800' : 'text-gray-500 hover:text-white'}`}><Bug size={20}/></button>
             <div className="mt-auto">
                 <button onClick={() => setLayout(p => ({...p, showSidebar: !p.showSidebar}))} className="p-2 text-gray-400"><SidebarIcon /></button>
             </div>
        </div>
        
        {layout.showSidebar && (
            <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
               <div className="p-3 text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between items-center">
                   {activeActivity}
                   {activeActivity === 'EXPLORER' && (
                       <div className="flex gap-1">
                          <button className="hover:text-white"><FilePlus size={14}/></button>
                          <button className="hover:text-white"><FolderPlus size={14}/></button>
                       </div>
                   )}
               </div>
               
               <div className="flex-1 overflow-y-auto">
                   {activeActivity === 'EXPLORER' && renderTree(files)}
                   
                   {activeActivity === 'GIT' && (
                       <div className="p-2">
                           <div className="mb-4">
                               <textarea 
                                 className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-white" 
                                 placeholder="Commit message..." 
                                 rows={3}
                                 value={commitMessage}
                                 onChange={e => setCommitMessage(e.target.value)}
                               />
                               <Button size="sm" className="w-full mt-2" onClick={handleCommit}>Commit</Button>
                           </div>
                           <div className="border-t border-gray-800 pt-2">
                               <div className="text-xs font-bold text-gray-500 mb-2">HISTORY</div>
                               {commits.map(c => (
                                   <div key={c.id} className="mb-2 p-2 bg-gray-800 rounded text-xs border border-gray-700">
                                       <div className="font-bold text-gray-300">{c.message}</div>
                                       <div className="flex justify-between text-gray-500 mt-1">
                                           <span>{c.hash}</span>
                                           <span>{c.date}</span>
                                       </div>
                                   </div>
                               ))}
                           </div>
                       </div>
                   )}

                   {activeActivity === 'ASSETS' && (
                       <div className="p-2 grid grid-cols-2 gap-2">
                           {assets.map((asset, i) => (
                               <div key={i} className="bg-gray-800 rounded p-1 group relative border border-gray-700" draggable onDragStart={(e) => {
                                   e.dataTransfer.setData('text/plain', asset.type === 'image' ? `<img src="${asset.url}" />` : `<audio src="${asset.url}" />`);
                               }}>
                                   {asset.type === 'image' ? (
                                       <img src={asset.url} className="w-full aspect-square object-cover rounded bg-black" />
                                   ) : (
                                       <div className="w-full aspect-square bg-gray-900 flex items-center justify-center rounded">
                                           <Music size={24} className="text-purple-500"/>
                                       </div>
                                   )}
                                   <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                       <span className="text-[10px] text-white font-mono truncate px-1">{asset.name}</span>
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
                   
                   {/* Extensions, Search, Debug simplified for brevity but structure exists */}
                   {activeActivity === 'SEARCH' && <div className="p-4 text-gray-500 text-xs text-center">Global search available via Command Palette (Cmd+K)</div>}
               </div>
            </div>
        )}

        {/* Center: Editor & Terminal */}
        <div className="flex-1 flex flex-col min-w-0">
           {/* Editor Tabs */}
           <div className="h-9 bg-gray-900 border-b border-gray-800 flex items-center px-0 overflow-x-auto scrollbar-none">
               {openFiles.map(fid => {
                   const file = findFileById(files, fid);
                   if (!file) return null;
                   return (
                       <div 
                         key={fid}
                         onClick={() => setActiveFileId(fid)}
                         className={`h-full px-3 flex items-center gap-2 text-xs border-r border-gray-800 cursor-pointer min-w-[120px] max-w-[200px] ${activeFileId === fid ? 'bg-gray-800 text-white border-t-2 border-t-primary-500' : 'bg-gray-900 text-gray-500 hover:bg-gray-800'}`}
                       >
                           <span className="truncate">{file.name}</span>
                           <button 
                              onClick={(e) => { e.stopPropagation(); setOpenFiles(prev => prev.filter(id => id !== fid)); }} 
                              className="hover:text-white p-0.5 rounded hover:bg-gray-700"
                           >
                               <X size={10} />
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
                      onChange={(val) => updateFileContent(activeFileId, val)} 
                      fileName={activeFile.name}
                      config={editorConfig}
                      onCodeAction={handleCodeAction}
                    />
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center"><Command size={32}/></div>
                        <div>Select a file to start editing</div>
                    </div>
                 )}
              </div>
              
              {layout.showBottom && (
                  <div className="h-48 border-t border-gray-800 flex flex-col bg-black">
                      <div className="flex bg-gray-900 border-b border-gray-800 text-xs">
                          <button 
                             onClick={() => setBottomPanelTab('terminal')} 
                             className={`px-4 py-1.5 ${bottomPanelTab === 'terminal' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}
                          >
                              Terminal
                          </button>
                          <button 
                             onClick={() => setBottomPanelTab('problems')} 
                             className={`px-4 py-1.5 flex items-center gap-2 ${bottomPanelTab === 'problems' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}
                          >
                              Problems <span className="bg-primary-900 text-primary-400 px-1.5 rounded-full text-[10px]">{problems.length}</span>
                          </button>
                      </div>
                      <div className="flex-1 overflow-hidden">
                          {bottomPanelTab === 'terminal' ? (
                             <Terminal logs={terminalLogs} onCommand={handleTerminalCommand} />
                          ) : (
                             <div className="p-2 overflow-y-auto h-full space-y-1">
                                 {problems.map((p, i) => (
                                     <div key={i} className="flex items-start gap-2 text-xs p-1 hover:bg-gray-900 rounded cursor-pointer">
                                         {p.severity === 'error' ? <AlertCircle size={14} className="text-red-500 mt-0.5"/> : <AlertTriangle size={14} className="text-yellow-500 mt-0.5"/>}
                                         <div>
                                             <span className="text-gray-300">{p.message}</span>
                                             <div className="text-gray-500">{p.file} [Ln {p.line}]</div>
                                         </div>
                                     </div>
                                 ))}
                                 {problems.length === 0 && <div className="text-gray-500 text-center mt-4">No problems detected.</div>}
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
           <div className="flex border-b border-gray-800 bg-gray-950">
               <button onClick={() => setActiveTab('preview')} className={`flex-1 py-2 text-xs ${activeTab==='preview'?'text-white border-b-2 border-primary-500':'text-gray-500'}`}>Preview</button>
               <button onClick={() => setActiveTab('deploy')} className={`flex-1 py-2 text-xs ${activeTab==='deploy'?'text-white border-b-2 border-primary-500':'text-gray-500'}`}>Deploy</button>
               {isBackend && <button onClick={() => setActiveTab('database')} className={`flex-1 py-2 text-xs ${activeTab==='database'?'text-white border-b-2 border-primary-500':'text-gray-500'}`}>Database</button>}
           </div>

           <div className="h-[60%] border-b border-gray-800 bg-gray-950 relative overflow-hidden">
               {activeTab === 'preview' && (
                   <div className="w-full h-full flex flex-col">
                       <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center px-2 justify-between">
                           <div className="flex bg-gray-800 rounded px-2 py-0.5 text-xs text-gray-400 w-full mr-2">localhost:3000</div>
                           <button className="text-gray-400 hover:text-white p-1"><RefreshCw size={12}/></button>
                           <button className="text-gray-400 hover:text-white p-1"><ExternalLink size={12}/></button>
                       </div>
                       <iframe 
                         srcDoc={previewSrc} 
                         className="flex-1 w-full bg-white border-none" 
                         sandbox="allow-scripts" 
                         title="Preview"
                       />
                   </div>
               )}
               
               {activeTab === 'deploy' && (
                   <div className="p-8 flex flex-col items-center justify-center h-full text-center">
                       {deploymentState === 'idle' ? (
                           <>
                              <Rocket size={48} className="text-gray-700 mb-4" />
                              <h3 className="text-white font-bold mb-2">Ready to Ship?</h3>
                              <p className="text-gray-500 text-sm mb-6">Deploy your project to the edge in one click.</p>
                              <Button onClick={handleDeploy}>Deploy to Production</Button>
                           </>
                       ) : deploymentState === 'deployed' ? (
                           <>
                              <Check size={48} className="text-green-500 mb-4" />
                              <h3 className="text-white font-bold mb-2">Live on the Edge!</h3>
                              <a href={deployUrl} target="_blank" className="text-primary-400 text-sm hover:underline mb-6">{deployUrl}</a>
                              <Button variant="secondary" onClick={() => setDeploymentState('idle')}>Deploy Again</Button>
                           </>
                       ) : (
                           <>
                              <Loader2 size={48} className="text-primary-500 animate-spin mb-4" />
                              <h3 className="text-white font-bold capitalize">{deploymentState}...</h3>
                              <div className="w-48 h-1 bg-gray-800 rounded-full mt-4 overflow-hidden">
                                  <div className="h-full bg-primary-500 animate-pulse"></div>
                              </div>
                           </>
                       )}
                   </div>
               )}

               {activeTab === 'database' && (
                   <div className="flex flex-col h-full">
                       <div className="p-2 border-b border-gray-800 bg-gray-900">
                           <textarea 
                              className="w-full bg-black border border-gray-700 rounded p-2 text-xs text-green-400 font-mono resize-none" 
                              rows={3} 
                              value={sqlQuery} 
                              onChange={e => setSqlQuery(e.target.value)}
                           />
                           <div className="flex justify-end mt-2">
                              <Button size="sm">Run Query</Button>
                           </div>
                       </div>
                       <div className="flex-1 overflow-auto">
                           <table className="w-full text-left text-xs text-gray-400">
                               <thead className="bg-gray-900 text-gray-500">
                                   <tr>{Object.keys(dbResults[0]).map(k => <th key={k} className="p-2 border-b border-gray-800">{k}</th>)}</tr>
                               </thead>
                               <tbody>
                                   {dbResults.map((row, i) => (
                                       <tr key={i} className="hover:bg-gray-900">
                                           {Object.values(row).map((v: any, j) => <td key={j} className="p-2 border-b border-gray-800">{v}</td>)}
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
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
                    onSaveAsset={handleSaveChatAsset}
                  />
                ))}
                {isGenerating && <div className="text-xs text-gray-400 ml-2 flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> Omni is coding...</div>}
              </div>
              
              <div className="p-3 bg-gray-850 border-t border-gray-800">
                 <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-none">
                     {['/image', '/tts', '/explain', '/fix'].map(cmd => (
                         <button key={cmd} onClick={() => setChatInput(cmd + ' ')} className="px-2 py-1 bg-gray-800 rounded text-[10px] text-gray-400 hover:text-white border border-gray-700 whitespace-nowrap">
                             {cmd}
                         </button>
                     ))}
                 </div>
                 <form onSubmit={handleChatSubmit} className="relative">
                    <input 
                      type="text" 
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-12 py-3 text-sm text-white focus:outline-none focus:border-primary-500 placeholder-gray-500"
                      placeholder="Ask Omni to generate code, assets or fix bugs..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={isGenerating}
                    />
                    <button type="submit" className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-primary-500 hover:text-white disabled:opacity-50" disabled={!chatInput.trim()}>
                        <ArrowRight size={16} />
                    </button>
                 </form>
              </div>
           </div>
        </div>
        )}
      </div>
      
      {/* Status Bar */}
      <div className="h-6 bg-blue-900 text-white flex items-center justify-between px-3 text-[10px] select-none z-30">
           <div className="flex items-center gap-3">
               <div className="flex items-center gap-1 cursor-pointer hover:text-blue-200" onClick={() => setShowBranchMenu(!showBranchMenu)}>
                   <GitBranch size={10} /> {currentBranch}
               </div>
               {problems.length > 0 && (
                   <div className="flex items-center gap-1 text-yellow-300">
                       <AlertTriangle size={10} /> {problems.length} Problems
                   </div>
               )}
           </div>
           <div className="flex items-center gap-3">
               <div className="cursor-pointer hover:text-blue-200" onClick={() => setLayout(p => ({...p, showBottom: !p.showBottom}))}>
                   <PanelBottom size={10} className={layout.showBottom ? 'opacity-100' : 'opacity-50'} />
               </div>
               <div className="cursor-pointer hover:text-blue-200" onClick={() => setLayout(p => ({...p, showRight: !p.showRight}))}>
                   <Columns size={10} className={layout.showRight ? 'opacity-100' : 'opacity-50'} />
               </div>
               <span>UTF-8</span>
               <span>{isNative ? 'TypeScript JSX' : 'TypeScript'}</span>
               <span className="text-blue-300">Prettier: On</span>
           </div>
      </div>
    </div>
  );
};
