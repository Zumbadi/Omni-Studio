
import React, { Suspense, lazy, memo } from 'react';
import { Download, X, Map, BrainCircuit, Gauge, Book, Server, Database, Smartphone, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { Project, ProjectType, ProjectPhase, FileNode } from '../types';
import { LivePreview } from './LivePreview';
import { RoadmapView } from './RoadmapView';

// Lazy load heavy components
const DatabaseStudio = lazy(() => import('./DatabaseStudio').then(m => ({ default: m.DatabaseStudio })));
const ArchitectureDesigner = lazy(() => import('./ArchitectureDesigner').then(m => ({ default: m.ArchitectureDesigner })));
const DeploymentConsole = lazy(() => import('./DeploymentConsole').then(m => ({ default: m.DeploymentConsole })));
const AuditView = lazy(() => import('./AuditView').then(m => ({ default: m.AuditView })));
const DocsViewer = lazy(() => import('./DocsViewer').then(m => ({ default: m.DocsViewer })));

interface PreviewPanelProps {
  project: Project;
  previewSrc: string;
  activeTab: 'preview' | 'deploy' | 'database' | 'roadmap' | 'docs' | 'audit' | 'architecture';
  setActiveTab: (tab: any) => void;
  onToggleLayout: () => void;
  onExport: () => void;
  onRefreshPreview: () => void;
  roadmap: ProjectPhase[];
  isGeneratingPlan: boolean;
  onGeneratePlan: () => void;
  onExecutePhase: (phase: ProjectPhase) => void;
  onToggleTask: (phaseId: string, taskId: string) => void;
  onLog: (msg: string) => void;
  files: FileNode[];
  onSaveFile?: (path: string, content: string) => void;
}

const LoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center text-gray-500">
    <Loader2 size={24} className="animate-spin mr-2"/> Loading View...
  </div>
);

export const PreviewPanel = memo(({
  project, previewSrc, activeTab, setActiveTab, onToggleLayout, onExport, onRefreshPreview,
  roadmap, isGeneratingPlan, onGeneratePlan, onExecutePhase, onToggleTask, onLog, files, onSaveFile
}: PreviewPanelProps) => {
  const isBackend = project.type === ProjectType.NODE_API;

  return (
    <div className="w-full h-full flex flex-col bg-gray-900 border-l border-gray-800">
      {/* Panel Header */}
      <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-2 justify-between shrink-0">
         <div className="flex gap-1 bg-gray-800 p-0.5 rounded-lg overflow-x-auto scrollbar-none w-full md:w-auto max-w-[calc(100%-80px)]">
           <button onClick={() => setActiveTab('preview')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'preview' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
               <Smartphone size={12}/> Preview
           </button>
           {isBackend && <button onClick={() => setActiveTab('database')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'database' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Database size={12}/> DB Studio</button>}
           <button onClick={() => setActiveTab('roadmap')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'roadmap' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Map size={12}/> Roadmap</button>
           <button onClick={() => setActiveTab('architecture')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'architecture' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><BrainCircuit size={12}/> Architect</button>
           <button onClick={() => setActiveTab('audit')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'audit' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Gauge size={12}/> Audit</button>
           <button onClick={() => setActiveTab('docs')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'docs' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Book size={12}/> Docs</button>
           <button onClick={() => setActiveTab('deploy')} className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${activeTab === 'deploy' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}><Server size={12}/> Deploy</button>
         </div>
         <div className="flex gap-1 items-center">
             <Button size="sm" variant="ghost" onClick={onExport} title="Download Zip" className="h-7 w-7 p-0 flex items-center justify-center"><Download size={14}/></Button>
             <button onClick={onToggleLayout} className="text-gray-500 hover:text-white h-7 w-7 flex items-center justify-center rounded hover:bg-gray-800 transition-colors"><X size={14}/></button>
         </div>
      </div>
      
      {/* Panel Content */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
          <Suspense fallback={<LoadingFallback />}>
            {activeTab === 'preview' && <LivePreview project={project} previewSrc={previewSrc} onRefresh={onRefreshPreview} />}
            {activeTab === 'database' && <DatabaseStudio projectType={project.type} />}
            {activeTab === 'architecture' && <ArchitectureDesigner projectDescription={project.description} />}
            {activeTab === 'deploy' && <DeploymentConsole project={project} onLog={onLog} />}
            {activeTab === 'audit' && <AuditView files={files} />}
            {activeTab === 'docs' && <DocsViewer project={project} onSaveFile={onSaveFile} />}
            {activeTab === 'roadmap' && <RoadmapView roadmap={roadmap} isGenerating={isGeneratingPlan} onGenerate={onGeneratePlan} onExecutePhase={onExecutePhase} onToggleTask={onToggleTask} />}
          </Suspense>
      </div>
    </div>
  );
});

PreviewPanel.displayName = 'PreviewPanel';
