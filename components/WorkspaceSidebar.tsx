
import React, { memo } from 'react';
import { Files, GitBranch, Search, Bug, Bot, Puzzle, LayoutTemplate, Scissors, BrainCircuit, Save } from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { GitPanel, SearchPanel, DebugPanel, ExtensionsPanel, AssetsPanel, AgentsPanel, SnippetsPanel, KnowledgePanel } from './SidebarPanels';
import { FileNode, Project, GitCommit, Extension, AgentTask, Snippet, AIAgent, KnowledgeDoc } from '../types';

interface WorkspaceSidebarProps {
  layout: { showSidebar: boolean };
  sidebarWidth: number;
  activeActivity: 'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS' | 'SNIPPETS' | 'KNOWLEDGE';
  setActiveActivity: (activity: 'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS' | 'SNIPPETS' | 'KNOWLEDGE') => void;
  onToggleSidebar: () => void;
  // Explorer Props
  files: FileNode[];
  deletedFiles?: FileNode[];
  activeFileId: string;
  openFiles: string[];
  project: Project;
  remoteDirName: string | null;
  onFileClick: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string, isTrash?: boolean) => void;
  onFileOps: {
      onConnectRemote: () => void;
      onAddFile: () => void;
      onAddFolder: () => void;
      onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
      onUploadFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
      onInstallPackage: () => void;
      onRunScript: (script: string, cmd: string) => void;
      onEmptyTrash?: () => void;
      onMoveNode?: (nodeId: string, targetId: string) => void;
      onToggleDirectory?: (id: string) => void;
  };
  // Git Props
  commits: GitCommit[];
  currentBranch: string;
  branches: string[];
  onCommit: (msg: string) => void;
  onCreateBranch: (name: string) => void;
  onSwitchBranch: (name: string) => void;
  // Search Props
  searchQuery: string;
  onSearch: (q: string) => void;
  searchResults: any[];
  onResultClick: (fileId: string, line: number) => void;
  onReplace: (fileId: string, line: number, text: string, newText: string) => void;
  onReplaceAll: (searchText: string, newText: string) => void;
  // Debug Props
  debugVariables: any[];
  breakpoints: number[];
  onRemoveBreakpoint: (line: number) => void;
  // Extensions Props
  extensions: Extension[];
  onToggleExtension: (id: string) => void;
  // Assets Props
  assets: any[];
  onInsertAsset: (asset: any) => void;
  // Agents Props
  activeAgentTask: AgentTask | null;
  agentHistory?: AgentTask[];
  onStartAgentTask: (agent: any, type: any) => void;
  onCancelAgentTask: () => void;
  activeAgent?: AIAgent | null;
  // Snippets Props
  snippets: Snippet[];
  onAddSnippet: () => void;
  onDeleteSnippet: (id: string) => void;
  onInsertSnippet: (code: string) => void;
  // Knowledge Props
  knowledgeDocs: KnowledgeDoc[];
  onAddKnowledgeDoc: (doc: KnowledgeDoc) => void;
  onUpdateKnowledgeDoc: (doc: KnowledgeDoc) => void;
  onDeleteKnowledgeDoc: (id: string) => void;
}

export const WorkspaceSidebar = memo(({
  layout, sidebarWidth, activeActivity, setActiveActivity, onToggleSidebar,
  files, activeFileId, openFiles, project, remoteDirName, onFileClick, onContextMenu, onFileOps,
  commits, currentBranch, branches, onCommit, onCreateBranch, onSwitchBranch,
  searchQuery, onSearch, searchResults, onResultClick, onReplace, onReplaceAll,
  debugVariables, breakpoints, onRemoveBreakpoint,
  extensions, onToggleExtension,
  assets, onInsertAsset,
  activeAgentTask, agentHistory, onStartAgentTask, onCancelAgentTask, activeAgent,
  deletedFiles,
  snippets, onAddSnippet, onDeleteSnippet, onInsertSnippet,
  knowledgeDocs, onAddKnowledgeDoc, onUpdateKnowledgeDoc, onDeleteKnowledgeDoc
}: WorkspaceSidebarProps) => {

  const handleActivityClick = (activity: typeof activeActivity) => {
      // If sidebar is closed (only possible on desktop usually, as mobile hides the bar), open it.
      // On mobile, if the bar is visible, the sidebar 'should' be considered open in our new logic, but just in case:
      if (!layout.showSidebar) onToggleSidebar();
      setActiveActivity(activity);
  };

  const handleEmptyTrash = () => {
      if (onFileOps.onEmptyTrash) {
          if (confirm("Are you sure you want to permanently delete all items in the trash? This cannot be undone.")) {
              onFileOps.onEmptyTrash();
          }
      }
  };

  return (
    <>
      {/* Activity Bar: 
          Desktop: Always visible on the left.
          Mobile: Visible only when sidebar is toggled open (acts as the nav for the drawer). 
      */}
      <div className={`
          w-12 bg-gray-900 border-r border-gray-800 flex-col items-center py-4 gap-4 z-50 flex-shrink-0
          ${layout.showSidebar ? 'flex fixed inset-y-0 left-0 md:relative' : 'hidden md:flex'}
      `}>
          {[
             { id: 'EXPLORER', icon: Files },
             { id: 'SEARCH', icon: Search },
             { id: 'GIT', icon: GitBranch },
             { id: 'DEBUG', icon: Bug },
             { id: 'AGENTS', icon: Bot },
             { id: 'SNIPPETS', icon: Scissors },
             { id: 'EXTENSIONS', icon: Puzzle },
             { id: 'ASSETS', icon: LayoutTemplate },
             { id: 'KNOWLEDGE', icon: BrainCircuit },
          ].map(item => (
              <button 
                key={item.id} 
                onClick={() => handleActivityClick(item.id as any)} 
                className={`p-2 rounded-lg transition-colors relative ${activeActivity === item.id && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`} 
                title={item.id.charAt(0) + item.id.slice(1).toLowerCase()}
              >
                  <item.icon size={24} strokeWidth={1.5} />
              </button>
          ))}
      </div>

      {/* Side Panel Content */}
      {layout.showSidebar && (
        <>
            {/* Mobile Backdrop */}
            <div className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm" onClick={onToggleSidebar}></div>
            
            {/* Sidebar Panel */}
            <div 
                className="bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0 fixed inset-y-0 left-12 md:static z-40 shadow-2xl md:shadow-none animate-in slide-in-from-left-10 duration-200" 
                style={{ width: sidebarWidth, maxWidth: 'calc(100vw - 48px)' }}
            >
              {activeActivity === 'EXPLORER' && (
                  <div className="flex flex-col h-full">
                       {/* Explicit Save Button */}
                       <div className="px-4 pt-3 pb-1">
                           <button 
                               onClick={() => onFileOps.onRunScript('save', 'save')} 
                               className="w-full bg-primary-600 hover:bg-primary-500 text-white py-2 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 mb-2 border border-primary-500/50"
                           >
                               <Save size={14} /> Save Project
                           </button>
                       </div>
                       <FileExplorer 
                            files={files} 
                            activeFileId={activeFileId} 
                            openFiles={openFiles}
                            project={project} 
                            remoteDirName={remoteDirName} 
                            deletedFiles={deletedFiles}
                            onFileClick={onFileClick} 
                            onContextMenu={onContextMenu}
                            {...onFileOps}
                            onEmptyTrash={handleEmptyTrash}
                        />
                  </div>
              )}
              {activeActivity === 'GIT' && <GitPanel files={files} commits={commits} currentBranch={currentBranch} branches={branches} onCommit={onCommit} onCreateBranch={onCreateBranch} onSwitchBranch={onSwitchBranch} />}
              {activeActivity === 'SEARCH' && <SearchPanel query={searchQuery} onSearch={onSearch} results={searchResults} onResultClick={onResultClick} onReplace={onReplace} onReplaceAll={onReplaceAll} />}
              {activeActivity === 'DEBUG' && <DebugPanel variables={debugVariables} breakpoints={breakpoints} onRemoveBreakpoint={onRemoveBreakpoint} />}
              {activeActivity === 'EXTENSIONS' && <ExtensionsPanel extensions={extensions} onToggle={onToggleExtension} />}
              {activeActivity === 'ASSETS' && <AssetsPanel assets={assets} onInsertAsset={onInsertAsset} />}
              {activeActivity === 'AGENTS' && <AgentsPanel activeTask={activeAgentTask} history={agentHistory} onStartTask={onStartAgentTask} onCancelTask={onCancelAgentTask} activeAgent={activeAgent} />}
              {activeActivity === 'SNIPPETS' && <SnippetsPanel snippets={snippets} onAddSnippet={onAddSnippet} onDeleteSnippet={onDeleteSnippet} onInsertSnippet={onInsertSnippet} />}
              {activeActivity === 'KNOWLEDGE' && <KnowledgePanel docs={knowledgeDocs} onAddDoc={onAddKnowledgeDoc} onUpdateDoc={onUpdateKnowledgeDoc} onDeleteDoc={onDeleteKnowledgeDoc} />}
            </div>
        </>
      )}
    </>
  );
});

WorkspaceSidebar.displayName = 'WorkspaceSidebar';
