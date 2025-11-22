
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, PanelBottom, Columns, MessageSquare, ArrowRight, X, Minimize2, SplitSquareHorizontal, GitBranch } from 'lucide-react';
import { MOCK_COMMITS, MOCK_EXTENSIONS } from '../constants';
import { ChatMessage, Project, ProjectType, SocialPost, AudioTrack, Extension, GitCommit as GitCommitType, ProjectPhase, AgentTask, AuditIssue } from '../types';
import { CodeEditor, CodeEditorHandle } from '../components/CodeEditor';
import { Terminal } from '../components/Terminal';
import { generateCodeResponse, critiqueCode, runAgentFileTask, generateGhostText } from '../services/geminiService';
import { Button } from '../components/Button';
import JSZip from 'jszip';
import { generatePreviewHtml } from '../utils/runtime';
import { MessageRenderer } from '../components/MessageRenderer';
import { PreviewPanel } from '../components/PreviewPanel';
import { DiffEditor } from '../components/DiffEditor';
import { findRelevantContext } from '../utils/projectAnalysis';
import { useFileSystem } from '../hooks/useFileSystem';
import { useResizable } from '../hooks/useResizable';
import { WorkspaceSidebar } from '../components/WorkspaceSidebar';

interface WorkspaceProps {
  project: Project | null;
}

interface SearchResult {
  fileId: string;
  fileName: string;
  line: number;
  preview: string;
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
  
  // Hook: File System Logic
  const { 
      files, setFiles, activeFileId, setActiveFileId, openFiles, setOpenFiles, 
      remoteDirName, setRemoteDirName, updateFileContent, findFileById, getAllFiles,
      handleFileClick: onFileClick, handleCloseTab: onCloseTab
  } = useFileSystem(project);
  
  // Hook: Resizable Layout
  const { 
      sidebarWidth, setSidebarWidth, 
      rightPanelWidth, setRightPanelWidth, 
      bottomPanelHeight, setBottomPanelHeight, 
      splitRatio, setSplitRatio, 
      startResizing 
  } = useResizable();

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
  
  const [previewSrc, setPreviewSrc] = useState<string>('');
  const [activeModel, setActiveModel] = useState('Gemini 2.5 Flash');
  
  // Project Plan / Roadmap
  const [roadmap, setRoadmap] = useState<ProjectPhase[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  // Critic
  const [enableCritic, setEnableCritic] = useState(true);
  
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Debug State
  const [debugVariables, setDebugVariables] = useState<{name: string, value: string}[]>([]);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);

  // Agents State
  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask | null>(null);

  // IDE Layout State
  const [activeActivity, setActiveActivity] = useState<'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS'>('EXPLORER');
  const [layout, setLayout] = useState({
    showSidebar: window.innerWidth >= 768,
    showBottom: true,
    showRight: window.innerWidth >= 1024
  });

  const [assets, setAssets] = useState<{type: 'image' | 'video' | 'audio', url: string, name: string}[]>([]);
  const [extensions, setExtensions] = useState<Extension[]>(MOCK_EXTENSIONS);

  // Command Palette
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, fileId: null });
  
  // Vision State
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);

  // --- Agent Runner Logic ---
  useEffect(() => {
      if (!activeAgentTask || activeAgentTask.status === 'completed') return;

      const run = async () => {
          const allFiles = getAllFiles(files);
          const relevantFiles = allFiles.filter(f => f.node.name.endsWith('.tsx') || f.node.name.endsWith('.ts') || f.node.name.endsWith('.js'));
          
          setActiveAgentTask(prev => prev ? { ...prev, totalFiles: relevantFiles.length } : null);

          for (let i = 0; i < relevantFiles.length; i++) {
              const file = relevantFiles[i];
              setActiveAgentTask(prev => prev ? { ...prev, currentFile: file.node.name, logs: [...prev.logs, `Processing ${file.node.name}...`] } : null);
              
              const result = await runAgentFileTask(activeAgentTask.type as any, file.node.name, file.node.content || '');
              
              if (result) {
                  const filenameMatch = result.match(/^\/\/ filename: (.*)/);
                  const targetName = filenameMatch ? filenameMatch[1].trim() : `processed_${file.node.name}`;
                  setActiveAgentTask(prev => prev ? { ...prev, logs: [...prev.logs, `> Generated ${targetName}`] } : null);
              }

              setActiveAgentTask(prev => prev ? { ...prev, processedFiles: i + 1 } : null);
              await new Promise(r => setTimeout(r, 500));
          }

          setActiveAgentTask(prev => prev ? { ...prev, status: 'completed', logs: [...prev.logs, 'Task Completed Successfully.'] } : null);
      };

      run();
  }, [activeAgentTask?.status]);

  const handleStartAgentTask = (type: AgentTask['type']) => {
      setActiveAgentTask({
          id: `task-${Date.now()}`,
          type,
          name: type === 'tests' ? 'Unit Test Generation' : type === 'docs' ? 'Documentation Generator' : 'Code Refactor',
          status: 'running',
          totalFiles: 0,
          processedFiles: 0,
          logs: ['Initializing Agent...', 'Scanning project files...']
      });
  };

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

  // Load Assets
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

  // Initialize Logs & Config
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
  }, [project?.id]);

  // Save roadmap
  useEffect(() => {
      if (project) {
          const roadmapKey = `omni_roadmap_${project.id}`;
          localStorage.setItem(roadmapKey, JSON.stringify(roadmap));
      }
  }, [roadmap, project]);

  // Hotkeys
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
       if (e.key === 'Escape') {
          setShowCommandPalette(false);
          setContextMenu(prev => ({...prev, visible: false}));
          setShowBranchMenu(false);
          setDiffFileId(null);
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, files]);

  const activeFile = findFileById(files, activeFileId);
  const secondaryFile = secondaryFileId ? findFileById(files, secondaryFileId) : null;
  const diffFile = diffFileId ? findFileById(files, diffFileId) : null;

  // ... Handlers ...
  const handleCommit = (msg: string) => {
    if (!msg.trim()) return;
    const newCommit: GitCommitType = { id: `c-${Date.now()}`, message: msg, author: 'You', date: 'Just now', hash: Math.random().toString(16).slice(2, 9) };
    setCommits(prev => [newCommit, ...prev]);
    setTerminalLogs(prev => [...prev, `> git commit -m "${msg}"`]);
  };

  const handleSaveProject = () => {
    if (project) {
      const storageKey = `omni_files_${project.id}`;
      localStorage.setItem(storageKey, JSON.stringify(files));
      setTerminalLogs(prev => [...prev, `> Project saved locally.`]);
    }
  };

  const handleExport = async () => {
      if (!project) return;
      const zip = new JSZip();
      const addFilesToZip = (nodes: any[], currentPath: string) => {
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

  // Preview Update Logic
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

  // ... Apply Code Logic ...
  const upsertFileByPath = (nodes: any[], pathParts: string[], newContent: string): any[] => {
    const [currentPart, ...restParts] = pathParts;
    if (restParts.length === 0) {
       const existingFile = nodes.find(n => n.name === currentPart && n.type === 'file');
       if (existingFile) return nodes.map(n => n.id === existingFile.id ? { ...n, content: newContent, gitStatus: 'modified' } : n);
       else {
          const newFile = { id: Date.now().toString() + Math.random(), name: currentPart, type: 'file', content: newContent, gitStatus: 'added' };
          return [...nodes, newFile];
       }
    }
    const existingDir = nodes.find(n => n.name === currentPart && n.type === 'directory');
    if (existingDir) {
       return nodes.map(n => n.id === existingDir.id ? { ...n, isOpen: true, children: upsertFileByPath(n.children || [], restParts, newContent) } : n);
    } else {
       const newDir = { id: Date.now().toString() + Math.random(), name: currentPart, type: 'directory', children: [], isOpen: true };
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
      updateFileContent(activeFile.id, code);
      setTerminalLogs(prev => [...prev, `> Applied changes to ${activeFile.name}`]);
    } else {
      setTerminalLogs(prev => [...prev, `> Error: No file selected and no filename specified.`]);
    }
  };

  const handleApplyAll = (codes: string[]) => {
      codes.forEach(code => handleApplyCode(code));
      setTerminalLogs(prev => [...prev, `> Bulk Apply: Processed ${codes.length} file updates.`]);
  };

  // Trigger AI Generation
  const triggerGeneration = async (prompt: string) => {
    setIsGenerating(true);
    const currentCode = activeFile?.content || '';
    const fileStructure = getAllFiles(files).map(f => f.path).join('\n');
    let responseText = '';
    
    let finalPrompt = prompt;
    if (editorSelection) finalPrompt += `\n\n[Referenced Code Selection]:\n\`\`\`\n${editorSelection}\n\`\`\`\n`;
    const extraContext = findRelevantContext(files, prompt);
    if (extraContext) finalPrompt += `\n\n[Relevant Context]:${extraContext}`;

    const tempId = 'temp-' + Date.now();
    setChatHistory(prev => [...prev, { id: tempId, role: 'model', text: '', timestamp: Date.now() }]);
    
    await generateCodeResponse(
      finalPrompt, currentCode, project?.type || ProjectType.REACT_WEB, fileStructure, activeModel, 
      (chunk) => { responseText += chunk; setChatHistory(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: responseText } : msg)); },
      attachedImage, chatHistory
    );
    
    if (enableCritic) runCritique(responseText, finalPrompt);
    setAttachedImage(undefined);
    setEditorSelection('');
    setIsGenerating(false);
  };

  const runCritique = async (code: string, task: string) => {
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
  };

  // Handlers for Search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const results: SearchResult[] = [];
    getAllFiles(files).forEach(({node}) => {
        if (node.content) {
            node.content.split('\n').forEach((line, idx) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                    results.push({ fileId: node.id, fileName: node.name, line: idx + 1, preview: line.trim().substring(0, 60) });
                }
            });
        }
    });
    setSearchResults(results);
  };

  const toggleLayout = (panel: 'sidebar' | 'bottom' | 'right') => {
      if (panel === 'sidebar') setLayout(p => ({ ...p, showSidebar: !p.showSidebar }));
      if (panel === 'bottom') setLayout(p => ({ ...p, showBottom: !p.showBottom }));
      if (panel === 'right') setLayout(p => ({ ...p, showRight: !p.showRight }));
  };

  // File Explorer Handlers
  const handleFileOps = {
      onConnectRemote: async () => {
          if ('showDirectoryPicker' in window) {
             try {
                 // @ts-ignore
                 const dirHandle = await window.showDirectoryPicker();
                 setRemoteDirName(dirHandle.name);
                 setTerminalLogs(prev => [...prev, `> Connected to local folder: ${dirHandle.name}`]);
             } catch (e) {}
          }
      },
      onAddFile: () => {
          const name = prompt("Enter file name:");
          if (!name) return;
          setFiles(prev => [...prev, { id: Date.now().toString(), name, type: 'file', content: '', gitStatus: 'added' }]);
      },
      onAddFolder: () => {},
      onUploadFile: () => {},
      onUploadFolder: () => {},
      onInstallPackage: () => {},
      onRunScript: (script: string, cmd: string) => setTerminalLogs(prev => [...prev, `> Running ${script}: ${cmd}`, '> ...'])
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newUserMsg = { id: Date.now().toString(), role: 'user' as const, text: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');
    triggerGeneration(newUserMsg.text);
  };

  const handleCodeAction = (action: string, selectedCode: string) => {
      const fileContext = activeFile ? ` in ${activeFile.name}` : '';
      let prompt = '';
      if (action === 'Explain') prompt = `Explain this code${fileContext}:\n\n${selectedCode}`;
      if (action === 'Refactor') prompt = `Refactor this code${fileContext} to be cleaner and more efficient:\n\n${selectedCode}`;
      if (action === 'Fix') prompt = `Find and fix any potential bugs in this code${fileContext}:\n\n${selectedCode}`;
      setChatInput(prompt);
      setIsChatOpen(true);
      triggerGeneration(prompt);
  };

  const onFileClickWrapper = useCallback((id: string) => onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId), [isSplitView, secondaryFileId, onFileClick]);
  const onResultClickWrapper = useCallback((id: string, line: number) => {
      onFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId);
      // Logic to jump to line would be here (via editorRef)
  }, [isSplitView, secondaryFileId, onFileClick]);

  if (!project) return <div className="flex-1 flex items-center justify-center text-gray-500">Select a project to begin</div>;

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full">
      <div className="flex-1 flex overflow-hidden relative">
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

        {/* Sidebar Resize Handle */}
        {layout.showSidebar && <div className="w-2 bg-gray-900 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => startResizing('sidebar', e)} />}

        {/* Main Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900 h-full" id="editor-container">
          <div className="flex bg-gray-900 border-b border-gray-800 overflow-x-auto scrollbar-none shrink-0">
             {openFiles.map(fileId => {
                 const file = findFileById(files, fileId);
                 if (!file) return null;
                 return (
                     <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-r border-gray-800 cursor-pointer min-w-[120px] max-w-[200px] group ${activeFileId === file.id ? 'bg-gray-800 text-primary-400 border-t-2 border-t-primary-500' : 'text-gray-500 hover:bg-gray-800 hover:text-gray-200 border-t-2 border-t-transparent'}`}><span className={`truncate ${file.gitStatus === 'modified' ? 'text-yellow-500' : ''}`}>{file.name}</span>{file.gitStatus === 'modified' && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500"></div>}<button onClick={(e) => onCloseTab(file.id, secondaryFileId, setSecondaryFileId)} className="ml-auto opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded p-0.5 text-gray-400 hover:text-white"><X size={12} /></button></div>
                 );
             })}
             <button onClick={() => setIsSplitView(p => !p)} className={`ml-auto px-3 flex items-center text-gray-500 hover:text-white border-l border-gray-800 ${isSplitView ? 'text-primary-500' : ''}`} title="Toggle Split Editor"><SplitSquareHorizontal size={14} /></button>
          </div>

          <div className="flex-1 relative min-h-0 flex">
            {diffFile ? (
                <div className="absolute inset-0 z-10"><DiffEditor original={diffFile.content || ''} modified={diffFile.content ? diffFile.content + '\n// Local changes' : ''} fileName={diffFile.name} onClose={() => setDiffFileId(null)} /></div>
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
                            />
                        ) : (<div className="flex flex-col items-center justify-center h-full text-gray-500 bg-gray-950"><p className="text-sm font-medium">No file open</p></div>)}
                    </div>
                    
                    {isSplitView && (
                        <>
                            <div className="w-2 bg-gray-900 border-l border-r border-gray-800 hover:bg-primary-600 cursor-col-resize z-20 hidden md:block" onMouseDown={(e) => startResizing('split', e)} />
                            <div className="relative flex flex-col bg-gray-950" style={{ width: `${100 - splitRatio}%` }}>
                                {secondaryFile ? (
                                    <>
                                        <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center px-4 text-xs text-gray-400 font-medium"><span className="text-primary-400 mr-2">Split:</span> {secondaryFile.name} <button onClick={() => setSecondaryFileId(null)} className="ml-auto hover:text-white"><X size={12}/></button></div>
                                        <CodeEditor code={secondaryFile.content || ''} onChange={(val) => updateFileContent(secondaryFileId!, val)} fileName={secondaryFile.name} config={editorConfig} onCodeAction={handleCodeAction} />
                                    </>
                                ) : (<div className="flex flex-col items-center justify-center h-full text-gray-600"><p className="text-xs">Select a file to open in split view</p></div>)}
                            </div>
                        </>
                    )}
                </>
            )}
          </div>

          {/* Bottom Panel */}
          {layout.showBottom && (
            <>
                <div className="h-2 bg-gray-900 border-t border-gray-800 hover:bg-primary-600 cursor-ns-resize z-20 hidden md:block" onMouseDown={(e) => startResizing('bottomPanel', e)} />
                <div className="bg-black border-t border-gray-800 flex flex-col flex-shrink-0 transition-all" style={{ height: bottomPanelHeight }}>
                    <div className="flex border-b border-gray-800"><button onClick={() => setBottomPanelTab('terminal')} className={`px-4 py-1 text-xs uppercase font-bold ${bottomPanelTab === 'terminal' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}>Terminal</button><div className="ml-auto flex items-center px-2"><button onClick={() => toggleLayout('bottom')} className="text-gray-500 hover:text-white"><X size={14}/></button></div></div>
                    {bottomPanelTab === 'terminal' && <Terminal logs={terminalLogs} onCommand={async (cmd) => { /* Command logic */ }} />}
                </div>
            </>
          )}
        </div>

        {/* Right Panel Resize Handle */}
        {layout.showRight && <div className="w-2 bg-gray-900 border-l border-gray-800 hover:bg-primary-600 hover:cursor-col-resize transition-colors z-30 flex-shrink-0 hidden md:block" onMouseDown={(e) => startResizing('rightPanel', e)} />}

        {/* Preview Panel */}
        {layout.showRight && (
            <div 
                className="flex-shrink-0 relative bg-gray-900 border-l border-gray-800 absolute md:static inset-0 md:inset-auto z-40 md:z-0 w-full md:w-auto"
                style={{ width: window.innerWidth < 768 ? '100%' : rightPanelWidth }}
            >
                <PreviewPanel 
                    project={project!} 
                    previewSrc={previewSrc} 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab} 
                    onToggleLayout={() => toggleLayout('right')}
                    onExport={handleExport}
                    onRefreshPreview={() => {}}
                    roadmap={roadmap}
                    isGeneratingPlan={isGeneratingPlan}
                    onGeneratePlan={() => {}}
                    onExecutePhase={() => {}}
                    onToggleTask={() => {}}
                    onLog={(l) => setTerminalLogs(p => [...p, l])}
                    files={files}
                />
            </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-6 bg-gray-900 border-t border-gray-800 text-gray-400 text-[10px] flex items-center px-3 justify-between select-none z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1"><GitBranch size={10} /><span>{currentBranch}</span></div>
          <div className="flex items-center gap-1"><RefreshCw size={10} className={isGenerating ? "animate-spin" : ""} /><span>{isGenerating ? 'Generating...' : 'Ready'}</span></div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => toggleLayout('bottom')} className={`p-0.5 rounded hover:bg-gray-800 hover:text-white ${!layout.showBottom ? 'opacity-50' : ''}`} title="Toggle Terminal"><PanelBottom size={10}/></button>
           <button onClick={() => toggleLayout('right')} className={`p-0.5 rounded hover:bg-gray-800 hover:text-white ${!layout.showRight ? 'opacity-50' : ''}`} title="Toggle Preview"><Columns size={10}/></button>
           <div className="hidden sm:flex items-center gap-2"><span>UTF-8</span></div>
           <div className="font-semibold text-primary-400">{isNative ? 'TS RN' : 'TS React'}</div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="absolute bottom-8 right-6 w-[90%] md:w-96 z-40 flex flex-col gap-4 pointer-events-none max-h-[60vh]">
        {isChatOpen ? (
            <div className="bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl pointer-events-auto flex flex-col overflow-hidden max-h-[60vh] animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-850 border-b border-gray-700">
                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-xs font-bold text-gray-200">Omni Assistant</span></div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsChatOpen(false)} className="text-gray-500 hover:text-white transition-colors" title="Minimize"><Minimize2 size={14}/></button>
                        <button onClick={() => { setIsChatOpen(false); setChatHistory([]); }} className="text-gray-500 hover:text-red-400 transition-colors" title="Close Chat"><X size={14}/></button>
                    </div>
                </div>
                <div className="flex-1 flex flex-col-reverse gap-2 overflow-y-auto scrollbar-none p-3 min-h-[150px]">
                    {chatHistory.slice().reverse().map((msg) => (
                        <MessageRenderer key={msg.id} message={msg} onApplyCode={handleApplyCode} onApplyAll={handleApplyAll} />
                    ))}
                    {isGenerating && <div className="text-xs text-gray-500 italic p-2">Thinking...</div>}
                </div>
                <div className="p-3 border-t border-gray-700 bg-gray-900/50">
                    <form onSubmit={handleChatSubmit} className="flex gap-2">
                        <input type="text" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500" placeholder="Ask Omni..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
                        <Button type="submit" disabled={isGenerating || !chatInput.trim()}><ArrowRight size={16}/></Button>
                    </form>
                </div>
            </div>
        ) : (
            <div className="flex justify-end pointer-events-auto">
                <button onClick={() => setIsChatOpen(true)} className="bg-primary-600 text-white p-4 rounded-full shadow-2xl hover:bg-primary-500 transition-all hover:scale-110 flex items-center justify-center group"><MessageSquare size={24} className="group-hover:animate-bounce"/></button>
            </div>
        )}
      </div>
    </div>
  );
};
