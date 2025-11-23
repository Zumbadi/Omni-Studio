
import React, { memo } from 'react';
import { Files, GitBranch, Search, Bug, Bot, Puzzle, LayoutTemplate } from 'lucide-react';
import { FileExplorer } from './FileExplorer';
import { GitPanel, SearchPanel, DebugPanel, ExtensionsPanel, AssetsPanel, AgentsPanel } from './SidebarPanels';
import { FileNode, Project, GitCommit, Extension, AgentTask } from '../types';

interface WorkspaceSidebarProps {
  layout: { showSidebar: boolean };
  sidebarWidth: number;
  activeActivity: 'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS';
  setActiveActivity: (activity: 'EXPLORER' | 'GIT' | 'SEARCH' | 'ASSETS' | 'EXTENSIONS' | 'DEBUG' | 'AGENTS') => void;
  onToggleSidebar: () => void;
  // Explorer Props
  files: FileNode[];
  deletedFiles?: FileNode[];
  activeFileId: string;
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
  };
  // Git Props
  commits: GitCommit[];
  currentBranch: string;
  onCommit: (msg: string) => void;
  onSwitchBranch: () => void;
  // Search Props
  searchQuery: string;
  onSearch: (q: string) => void;
  searchResults: any[];
  onResultClick: (fileId: string, line: number) => void;
  // Debug Props
  debugVariables: any[];
  breakpoints: number[];
  onRemoveBreakpoint: (line: number) => void;
  // Extensions Props
  extensions: Extension[];
  onToggleExtension: (id: string) => void;
  // Assets Props
  assets: any[];
  // Agents Props
  activeAgentTask: AgentTask | null;
  onStartAgentTask: (type: any) => void;
  onCancelAgentTask: () => void;
}

export const WorkspaceSidebar = memo(({
  layout, sidebarWidth, activeActivity, setActiveActivity, onToggleSidebar,
  files, activeFileId, project, remoteDirName, onFileClick, onContextMenu, onFileOps,
  commits, currentBranch, onCommit, onSwitchBranch,
  searchQuery, onSearch, searchResults, onResultClick,
  debugVariables, breakpoints, onRemoveBreakpoint,
  extensions, onToggleExtension,
  assets,
  activeAgentTask, onStartAgentTask, onCancelAgentTask,
  deletedFiles
}: WorkspaceSidebarProps) => {

  const handleActivityClick = (activity: typeof activeActivity) => {
      if (!layout.showSidebar) onToggleSidebar();
      setActiveActivity(activity);
  };

  return (
    <>
      {/* Activity Bar */}
      <div className="w-12 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-4 z-20 flex-shrink-0 md:flex">
          {['EXPLORER', 'SEARCH', 'GIT', 'DEBUG', 'AGENTS', 'EXTENSIONS', 'ASSETS'].map(activity => (
              <button 
                key={activity} 
                onClick={() => handleActivityClick(activity as any)} 
                className={`p-2 rounded-lg transition-colors relative ${activeActivity === activity && layout.showSidebar ? 'text-white border-l-2 border-primary-500' : 'text-gray-500 hover:text-gray-300'}`} 
                title={activity.charAt(0) + activity.slice(1).toLowerCase()}
              >
                  {activity === 'EXPLORER' && <Files size={24} strokeWidth={1.5} />}
                  {activity === 'GIT' && <GitBranch size={24} strokeWidth={1.5} />}
                  {activity === 'SEARCH' && <Search size={24} strokeWidth={1.5} />}
                  {activity === 'DEBUG' && <Bug size={24} strokeWidth={1.5} />}
                  {activity === 'AGENTS' && <Bot size={24} strokeWidth={1.5} />}
                  {activity === 'EXTENSIONS' && <Puzzle size={24} strokeWidth={1.5} />}
                  {activity === 'ASSETS' && <LayoutTemplate size={24} strokeWidth={1.5} />}
              </button>
          ))}
      </div>

      {/* Side Panel Content */}
      {layout.showSidebar && (
        <div className="bg-gray-900 border-r border-gray-800 flex flex-col flex-shrink-0 absolute md:static h-full z-30 shadow-2xl md:shadow-none" style={{ width: sidebarWidth }}>
          {activeActivity === 'EXPLORER' && (
            <FileExplorer 
                files={files} 
                activeFileId={activeFileId} 
                project={project} 
                remoteDirName={remoteDirName} 
                deletedFiles={deletedFiles}
                onFileClick={onFileClick} 
                onContextMenu={onContextMenu}
                {...onFileOps}
            />
          )}
          {activeActivity === 'GIT' && <GitPanel files={files} commits={commits} currentBranch={currentBranch} onCommit={onCommit} onSwitchBranch={onSwitchBranch} />}
          {activeActivity === 'SEARCH' && <SearchPanel query={searchQuery} onSearch={onSearch} results={searchResults} onResultClick={onResultClick} />}
          {activeActivity === 'DEBUG' && <DebugPanel variables={debugVariables} breakpoints={breakpoints} onRemoveBreakpoint={onRemoveBreakpoint} />}
          {activeActivity === 'EXTENSIONS' && <ExtensionsPanel extensions={extensions} onToggle={onToggleExtension} />}
          {activeActivity === 'ASSETS' && <AssetsPanel assets={assets} />}
          {activeActivity === 'AGENTS' && <AgentsPanel activeTask={activeAgentTask} onStartTask={onStartAgentTask} onCancelTask={onCancelAgentTask} />}
        </div>
      )}
    </>
  );
});

WorkspaceSidebar.displayName = 'WorkspaceSidebar';
