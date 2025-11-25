

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Project, FileNode, ProjectPhase, ChatMessage, AgentTask, TestResult } from '../types';
import { useFileSystem } from '../hooks/useFileSystem';
import { useResizable } from '../hooks/useResizable';
import { useOmniAssistant } from '../hooks/useOmniAssistant';
import { useTerminal } from '../hooks/useTerminal';
import { useTesting } from '../hooks/useTesting';
import { useAgentOrchestrator } from '../hooks/useAgentOrchestrator';
import { WorkspaceSidebar } from '../components/WorkspaceSidebar';
import { EditorArea } from '../components/EditorArea';
import { PreviewPanel } from '../components/PreviewPanel';
import { ChatWidget } from '../components/ChatWidget';
import { ContextMenu } from '../components/ContextMenu';
import { ConnectModal } from '../components/ConnectModal';
import { NewItemModal } from '../components/NewItemModal';
import { RenameModal } from '../components/RenameModal';
import { InstallPackageModal } from '../components/InstallPackageModal';
import { ToastContainer, ToastMessage } from '../components/Toast';
import { generatePreviewHtml } from '../utils/runtime';
import { CodeEditorHandle } from '../components/CodeEditor';
import { getFilePath, findFileById } from '../utils/fileHelpers';
import { CommandPalette } from '../components/CommandPalette';

export interface WorkspaceProps {
  project: Project;
  onDeleteProject?: (e: React.MouseEvent, id: string) => void;
  onUpdateProject?: (project: Project) => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ project, onDeleteProject, onUpdateProject }) => {
  // --- STATE ---
  const [layout, setLayout] = useState({ showSidebar: true, showRight: true, showBottom: true });
  const [isRightPanelMaximized, setIsRightPanelMaximized] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture' | 'settings'>('preview');
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(['> Terminal ready.']);
  const [liveConsoleLogs, setLiveConsoleLogs] = useState<string[]>([]);
  const [roadmap, setRoadmap] = useState<ProjectPhase[]>(project.roadmap || []);
  
  const [isSplitView, setIsSplitView] = useState(false);
  const [secondaryFileId, setSecondaryFileId] = useState<string | null>(null);
  const [diffFileId, setDiffFileId] = useState<string | null>(null);
  const [previewDiff, setPreviewDiff] = useState<{ original: string, modified: string, fileName: string } | null>(null);
  
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [editorSelection, setEditorSelection] = useState('');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  
  // Modals & Menus
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, id: string, isTrash?: boolean } | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemType, setNewItemType] = useState<'file' | 'folder'>('file');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const editorRef = useRef<CodeEditorHandle>(null);

  // --- HOOKS ---
  const {
    sidebarWidth, setSidebarWidth,
    rightPanelWidth, setRightPanelWidth,
    bottomPanelHeight, setBottomPanelHeight,
    splitRatio, setSplitRatio,
    startResizing
  } = useResizable();

  const { 
      files, filesRef, setFiles, deletedFiles, activeFileId, setActiveFileId, openFiles, setOpenFiles, 
      remoteDirName, setRemoteDirName, updateFileContent, addFile, addDirectory, addPackage, findFileById: findFile, getAllFiles,
      handleFileClick, handleCloseTab,
      deleteFile, renameFile, duplicateFile, restoreFile, permanentlyDeleteFile, emptyTrash, toggleFilePin, moveNode, toggleDirectory,
      reorderOpenFiles, closeOtherTabs
  } = useFileSystem(project);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
      setToasts(prev => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const handleLog = (msg: string) => setTerminalLogs(prev => [...prev, msg]);

  const { handleCommand, handleAiFix } = useTerminal({
      files, setFiles, activeFileId, projectType: project.type,
      addFile, addPackage, onLog: handleLog,
      onRequestFix: (err) => { setIsChatOpen(true); omni.setChatInput(`Fix error: ${err}`); omni.triggerGeneration(`Fix error: ${err}`); }
  });

  const { testResults, isRunningTests, runTests } = useTesting({
      files, onLog: handleLog
  });

  const activeFile = findFile(files, activeFileId);
  const secondaryFile = secondaryFileId ? findFile(files, secondaryFileId) : undefined;
  const diffFile = diffFileId ? findFile(files, diffFileId) : undefined;

  const omni = useOmniAssistant({
      projectId: project.id, projectType: project.type, files, activeFile,
      activeModel: localStorage.getItem('omni_active_model') || 'Gemini 2.5 Flash',
      editorSelection, setEditorSelection,
      onStartAgentTask: (task) => orchestrator.handleStartAgentTask(
          { id: 'omni', name: 'Omni', role: 'Manager', description: 'Omni Assistant', model: 'gemini-3-pro-preview', systemPrompt: 'You are the manager.' },
          'custom'
      )
  });

  const orchestrator = useAgentOrchestrator({
      filesRef, updateFileContent, addFile, setFiles, deleteFile,
      addSystemMessage: omni.addSystemMessage,
      setTerminalLogs, terminalLogs, liveConsoleLogs,
      roadmap, setRoadmap,
      debugVariables: [],
      projectDescription: project.description,
      projectType: project.type,
      addToast,
      setChatInput: omni.setChatInput,
      setIsChatOpen,
      setChatHistory: omni.setChatHistory,
      triggerGeneration: omni.triggerGeneration,
      runTests,
      handleCommand
  });

  // --- HANDLERS ---
  const handleContextMenu = (e: React.MouseEvent, id: string, isTrash = false) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, id, isTrash });
  };

  const handleEditorDrop = (e: React.DragEvent, cursorPos: number) => {
      e.preventDefault();
      const assetData = e.dataTransfer.getData('application/omni-asset');
      if (assetData && editorRef.current) {
          const asset = JSON.parse(assetData);
          let insertText = '';
          if (asset.type === 'image') insertText = `<img src="${asset.url}" alt="${asset.name}" />`;
          else if (asset.type === 'video') insertText = `<video src="${asset.url}" controls />`;
          else if (asset.type === 'audio') insertText = `<audio src="${asset.url}" controls />`;
          
          editorRef.current.insertAtCursor(insertText);
      }
  };

  const previewSrc = React.useMemo(() => 
      generatePreviewHtml(
          activeFile?.content || (files.length > 0 ? (findFile(files, '1')?.content || '') : ''), 
          project.type === 'React Native (Expo)', 
          files,
          activeFile?.name ? getFilePath(files, activeFile.id) || undefined : undefined
      ), 
  [activeFile, files, project.type]);

  const toggleLayout = (panel: string) => {
      setLayout(prev => ({ ...prev, [panel === 'sidebar' ? 'showSidebar' : panel === 'right' ? 'showRight' : 'showBottom']: !prev[panel === 'sidebar' ? 'showSidebar' : panel === 'right' ? 'showRight' : 'showBottom' as keyof typeof prev] }));
  };

  const editorConfig = { fontSize: '14px', tabSize: '2 Spaces', vimMode: false };

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden w-full relative text-gray-100 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <CommandPalette 
          isOpen={showCommandPalette} 
          onClose={() => setShowCommandPalette(false)} 
          files={files} 
          onOpenFile={(id) => { setActiveFileId(id); if(!openFiles.includes(id)) setOpenFiles(p => [...p, id]); }}
          onRunCommand={(cmd) => {
              if (cmd === 'toggle_sidebar') toggleLayout('sidebar');
              if (cmd === 'toggle_terminal') toggleLayout('bottom');
              // Add more commands
          }}
      />

      {showConnectModal && <ConnectModal onClose={() => setShowConnectModal(false)} onConnectLocal={() => setRemoteDirName('Local Folder')} onConnectGitHub={async (url) => { /* impl */ }} />}
      {showNewItemModal && <NewItemModal type={newItemType} isOpen={showNewItemModal} onClose={() => setShowNewItemModal(false)} onCreate={(name) => { if(newItemType === 'file') addFile(name, ''); else addDirectory(name); }} />}
      {showRenameModal && renameId && <RenameModal isOpen={showRenameModal} currentName={findFile(files, renameId)?.name || ''} onClose={() => setShowRenameModal(false)} onRename={(name) => renameFile(renameId, name)} />}
      {showInstallModal && <InstallPackageModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} onInstall={addPackage} />}
      
      {contextMenu && (
          <ContextMenu 
              x={contextMenu.x} y={contextMenu.y} 
              onClose={() => setContextMenu(null)}
              onRename={() => { setRenameId(contextMenu.id); setShowRenameModal(true); setContextMenu(null); }}
              onDelete={() => { deleteFile(contextMenu.id); setContextMenu(null); }}
              onDuplicate={() => { duplicateFile(contextMenu.id); setContextMenu(null); }}
              onExplain={() => { omni.handleCodeAction('Explain', findFile(files, contextMenu.id)?.content || ''); setContextMenu(null); }}
              isTrash={contextMenu.isTrash}
              onRestore={() => { restoreFile(contextMenu.id); setContextMenu(null); }}
              onPermanentDelete={() => { permanentlyDeleteFile(contextMenu.id); setContextMenu(null); }}
              onTogglePin={() => { toggleFilePin(contextMenu.id); setContextMenu(null); }}
              onNewFile={() => { setNewItemType('file'); setShowNewItemModal(true); setContextMenu(null); }}
              onNewFolder={() => { setNewItemType('folder'); setShowNewItemModal(true); setContextMenu(null); }}
              isDirectory={findFile(files, contextMenu.id)?.type === 'directory'}
          />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        <WorkspaceSidebar 
            layout={layout} sidebarWidth={sidebarWidth}
            activeActivity="EXPLORER" setActiveActivity={() => {}}
            onToggleSidebar={() => toggleLayout('sidebar')}
            files={files} activeFileId={activeFileId} project={project} remoteDirName={remoteDirName} deletedFiles={deletedFiles}
            onFileClick={(id) => handleFileClick(id, isSplitView, secondaryFileId, setSecondaryFileId)}
            onContextMenu={handleContextMenu}
            onFileOps={{
                onConnectRemote: () => setShowConnectModal(true),
                onAddFile: () => { setNewItemType('file'); setShowNewItemModal(true); },
                onAddFolder: () => { setNewItemType('folder'); setShowNewItemModal(true); },
                onUploadFile: (e) => { /* impl */ },
                onUploadFolder: (e) => { /* impl */ },
                onInstallPackage: () => setShowInstallModal(true),
                onRunScript: (name, cmd) => handleCommand(`npm run ${name}`),
                onEmptyTrash: emptyTrash,
                onMoveNode: moveNode,
                onToggleDirectory: toggleDirectory
            }}
            commits={[]} currentBranch="main" onCommit={() => {}} onSwitchBranch={() => {}}
            searchQuery="" onSearch={() => {}} searchResults={[]} onResultClick={() => {}} onReplace={() => {}} onReplaceAll={() => {}}
            debugVariables={[]} breakpoints={breakpoints} onRemoveBreakpoint={() => {}}
            extensions={[]} onToggleExtension={() => {}}
            assets={[]} onInsertAsset={() => {}}
            activeAgentTask={orchestrator.activeAgentTask} agentHistory={orchestrator.taskHistory} onStartAgentTask={orchestrator.handleStartAgentTask} onCancelAgentTask={orchestrator.handleCancelAgentTask} activeAgent={orchestrator.activeAgent}
            snippets={[]} onAddSnippet={() => {}} onDeleteSnippet={() => {}} onInsertSnippet={() => {}}
        />
        
        {layout.showSidebar && <div className="w-1 bg-gray-800 hover:bg-primary-600 cursor-col-resize z-20 transition-colors" onMouseDown={(e) => startResizing('sidebar', e)} />}

        {!isRightPanelMaximized && (
            <div className="flex-1 flex flex-col min-w-0" onDrop={(e) => handleEditorDrop(e, 0)} onDragOver={(e) => e.preventDefault()}>
                <EditorArea 
                    files={files} activeFileId={activeFileId} setActiveFileId={setActiveFileId} openFiles={openFiles} onCloseTab={handleCloseTab}
                    onReorderTabs={reorderOpenFiles} onCloseOtherTabs={closeOtherTabs}
                    isSplitView={isSplitView} setIsSplitView={setIsSplitView} splitRatio={splitRatio} secondaryFileId={secondaryFileId} setSecondaryFileId={setSecondaryFileId}
                    diffFileId={diffFileId} setDiffFileId={setDiffFileId} previewDiff={previewDiff} setPreviewDiff={setPreviewDiff}
                    activeFile={activeFile} secondaryFile={secondaryFile} diffFile={diffFile}
                    editorRef={editorRef} updateFileContent={updateFileContent} editorConfig={editorConfig} handleCodeAction={omni.handleCodeAction} setEditorSelection={setEditorSelection}
                    breakpoints={breakpoints} setBreakpoints={setBreakpoints} setCursorPos={setCursorPos} addToast={addToast}
                    layout={layout} toggleLayout={toggleLayout} bottomPanelHeight={bottomPanelHeight} handleResizeStart={startResizing}
                    terminalLogs={terminalLogs} onCommand={handleCommand} onAiFix={handleAiFix}
                    testResults={testResults} isRunningTests={isRunningTests} onRunTests={runTests}
                />
            </div>
        )}

        {layout.showRight && !isRightPanelMaximized && <div className="w-1 bg-gray-800 hover:bg-primary-600 cursor-col-resize z-20 transition-colors" onMouseDown={(e) => startResizing('rightPanel', e)} />}

        {layout.showRight && (
            <div className={`flex flex-col bg-gray-900 border-l border-gray-800 z-10 transition-all ${isRightPanelMaximized ? 'absolute inset-0' : ''}`} style={{ width: isRightPanelMaximized ? '100%' : rightPanelWidth }}>
                <PreviewPanel 
                    project={project} previewSrc={previewSrc} activeTab={activeRightTab} setActiveTab={setActiveRightTab}
                    onToggleLayout={() => toggleLayout('right')} onExport={() => {}} onRefreshPreview={() => {}}
                    roadmap={roadmap} isGeneratingPlan={orchestrator.isGeneratingPlan} onGeneratePlan={orchestrator.handleGeneratePlan} onExecutePhase={orchestrator.handleExecutePhase} onToggleTask={() => {}}
                    onLog={handleLog} files={files} onSaveFile={addFile}
                    isMaximized={isRightPanelMaximized} onToggleMaximize={() => setIsRightPanelMaximized(!isRightPanelMaximized)}
                    onUpdateProject={onUpdateProject} onDeleteProject={onDeleteProject && ((id) => onDeleteProject(null as any, id))}
                    onDeploymentComplete={(url) => addToast('success', `Deployed to ${url}`)}
                    onConsoleLog={(log) => setLiveConsoleLogs(p => [...p, log])}
                />
            </div>
        )}
      </div>

      <ChatWidget 
          isOpen={isChatOpen} setIsOpen={setIsChatOpen}
          history={omni.chatHistory} setHistory={omni.setChatHistory}
          input={omni.chatInput} setInput={omni.setChatInput}
          isGenerating={omni.isGenerating} isAgentWorking={orchestrator.isWorking} activeTask={orchestrator.activeAgentTask}
          onSubmit={omni.handleChatSubmit} onApplyCode={(code) => updateFileContent(activeFileId, code)} onCompareCode={(code) => setPreviewDiff({ original: activeFile?.content || '', modified: code, fileName: activeFile?.name || 'Unknown' })}
          onApplyAll={(codes) => {}} onAutoFix={omni.handleAutoFix} onRevert={orchestrator.revertLastAgentRun}
      />
    </div>
  );
};