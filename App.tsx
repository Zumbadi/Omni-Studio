import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AppView, Project, ProjectType, FileNode } from './types';
import { MOCK_PROJECTS } from './constants';
import { Menu } from 'lucide-react';
import { TeamManager } from './components/TeamManager';
import { NewProjectModal } from './components/NewProjectModal';
import { AppSidebar } from './components/AppSidebar';
import JSZip from 'jszip';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Login } from './components/Login';
import { useDebounce } from './hooks/useDebounce';

// Lazy Load Heavy Components for Performance Optimization
const Workspace = lazy(() => import('./pages/Workspace').then(m => ({ default: m.Workspace })));
const FineTuningDashboard = lazy(() => import('./components/FineTuningDashboard').then(m => ({ default: m.FineTuningDashboard })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const AudioStudio = lazy(() => import('./components/AudioStudio').then(m => ({ default: m.AudioStudio })));
const MediaStudio = lazy(() => import('./components/MediaStudio').then(m => ({ default: m.MediaStudio })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));

// Matches the visual language of the index.html loader for seamless transition
const NeuralLoader = () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#0d1117] h-full w-full absolute inset-0 z-50">
        <div className="relative mb-8">
            <div className="w-16 h-16 rounded-full bg-[radial-gradient(circle_at_center,#6366f1_0%,transparent_60%)] animate-[pulse_2.5s_infinite_ease-in-out]"></div>
            <div className="absolute inset-[-10px] border-2 border-primary-500/20 border-t-primary-500 rounded-full animate-[spin_3s_linear_infinite]"></div>
            <div className="absolute inset-[-16px] border-2 border-purple-500/10 border-b-purple-400 rounded-full animate-[spin_5s_linear_infinite_reverse]"></div>
        </div>
        <div className="text-[10px] font-mono font-bold text-primary-400/80 tracking-[0.2em] uppercase animate-pulse">
            Loading Module
        </div>
    </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('omni_auth') === 'true';
  });
  
  const [currentView, setCurrentView] = useState<AppView>(() => {
      return (localStorage.getItem('omni_current_view') as AppView) || AppView.DASHBOARD;
  });
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Initialize projects from localStorage or fallback to mock
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('omni_projects');
    return saved ? JSON.parse(saved) : MOCK_PROJECTS;
  });
  
  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
      const saved = localStorage.getItem('omni_active_project');
      return saved ? JSON.parse(saved) : null;
  });

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Remove the initial loader from the DOM once React mounts
  useEffect(() => {
      const loader = document.getElementById('initial-loader');
      if (loader) {
          // Smooth fade out
          loader.style.opacity = '0';
          loader.style.pointerEvents = 'none';
          setTimeout(() => loader.remove(), 600);
      }
  }, []);

  // Smart Prefetching: If user is on Dashboard, they are likely to open Workspace soon.
  useEffect(() => {
      if (currentView === AppView.DASHBOARD) {
          const timer = setTimeout(() => {
              // Prefetch the heavy Workspace chunk
              import('./pages/Workspace');
          }, 1500); 
          return () => clearTimeout(timer);
      }
  }, [currentView]);

  // Debounced persistence for projects
  const debouncedProjects = useDebounce(projects, 1000);

  // Persist state
  useEffect(() => {
    localStorage.setItem('omni_projects', JSON.stringify(debouncedProjects));
  }, [debouncedProjects]);

  useEffect(() => {
      localStorage.setItem('omni_current_view', currentView);
  }, [currentView]);

  useEffect(() => {
      if (selectedProject) localStorage.setItem('omni_active_project', JSON.stringify(selectedProject));
      else localStorage.removeItem('omni_active_project');
  }, [selectedProject]);

  // Listen for updates
  useEffect(() => {
      const handleProjectsUpdate = () => {
          const saved = localStorage.getItem('omni_projects');
          if (saved) {
              const updatedProjects = JSON.parse(saved);
              setProjects(updatedProjects);
              // Sync selected project if it was updated
              if (selectedProject) {
                  const current = updatedProjects.find((p: Project) => p.id === selectedProject.id);
                  if (current) setSelectedProject(current);
              }
          }
      };
      window.addEventListener('omniProjectsUpdated', handleProjectsUpdate);
      return () => window.removeEventListener('omniProjectsUpdated', handleProjectsUpdate);
  }, [selectedProject]);

  const handleLogin = () => {
    localStorage.setItem('omni_auth', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('omni_auth');
    setIsAuthenticated(false);
    setSelectedProject(null);
    setCurrentView(AppView.DASHBOARD);
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setCurrentView(AppView.WORKSPACE);
  };

  const handleCreateProject = (name: string, type: ProjectType, description: string, initialFiles: FileNode[]) => {
    const projectId = Date.now().toString();
    
    // Save initial files to storage
    localStorage.setItem(`omni_files_${projectId}`, JSON.stringify(initialFiles));

    const newProject: Project = {
      id: projectId,
      name: name || 'Untitled Project',
      description: description || `A new ${type} application generated by Omni-Studio.`,
      type: type,
      lastModified: 'Just now',
      fileCount: initialFiles.length + (initialFiles[0]?.children?.length || 0)
    };

    setProjects([newProject, ...projects]);
    setSelectedProject(newProject);
    setShowNewProjectModal(false);
    setCurrentView(AppView.WORKSPACE);
  };
  
  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setProjects(projects.filter(p => p.id !== id));
    localStorage.removeItem(`omni_files_${id}`);
    if (selectedProject?.id === id) {
      setSelectedProject(null);
      setCurrentView(AppView.DASHBOARD);
    }
  };

  const handleUpdateProject = (updatedProject: Project) => {
      setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
      setSelectedProject(updatedProject);
  };

  const handleExportProject = async (project: Project) => {
      const filesKey = `omni_files_${project.id}`;
      const filesRaw = localStorage.getItem(filesKey);
      if (!filesRaw) {
          alert("Could not load project files.");
          return;
      }
      const files = JSON.parse(filesRaw);
      
      const zip = new JSZip();
      const addToZip = (nodes: any[], path = '') => {
          nodes.forEach(n => {
              if (n.type === 'file') zip.file(path + n.name, n.content || '');
              if (n.children) addToZip(n.children, path + n.name + '/');
          });
      };
      addToZip(files);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${project.name}.zip`; a.click();
      URL.revokeObjectURL(url);
  };

  const handleNavClick = (view: AppView) => {
      if (view === AppView.WORKSPACE && !selectedProject) {
          alert("Please select a project from the dashboard first.");
          return;
      }
      setCurrentView(view);
      setIsMobileMenuOpen(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-gray-100 font-sans selection:bg-primary-500/30 overflow-hidden flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden h-14 border-b border-gray-800 flex items-center px-4 bg-gray-950 sticky top-0 z-40 justify-between shrink-0">
         <div className="flex items-center">
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-400 -ml-2 hover:text-white transition-colors">
               <Menu size={24} />
             </button>
             <span className="ml-2 font-bold text-white tracking-tight">Omni-Studio</span>
         </div>
         {currentView !== AppView.DASHBOARD && (
             <span className="text-[10px] font-mono text-primary-400 bg-primary-900/20 px-2 py-1 rounded border border-primary-500/20">{currentView}</span>
         )}
      </div>

      <AppSidebar 
        currentView={currentView} 
        onNavigate={handleNavClick} 
        onLogout={handleLogout} 
        isOpen={isMobileMenuOpen}
        setIsOpen={setIsMobileMenuOpen}
        onShowHelp={() => setShowHelp(true)}
      />
      
      {showNewProjectModal && (
        <NewProjectModal 
            onClose={() => setShowNewProjectModal(false)} 
            onCreate={handleCreateProject} 
        />
      )}
      {showTeamManager && <TeamManager onClose={() => setShowTeamManager(false)} />}
      {showHelp && <ShortcutsModal onClose={() => setShowHelp(false)} />}
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-gray-950">
          <Suspense fallback={<NeuralLoader />}>
              {currentView === AppView.DASHBOARD && (
                  <div className="relative flex-1 flex flex-col overflow-hidden bg-gray-950">
                      <Dashboard 
                          projects={projects} 
                          onProjectSelect={handleProjectSelect} 
                          onDeleteProject={handleDeleteProject} 
                          onNewProject={() => setShowNewProjectModal(true)}
                          onNavigate={handleNavClick}
                          onManageTeam={() => setShowTeamManager(true)}
                          onExportProject={handleExportProject}
                      />
                  </div>
              )}
              {currentView === AppView.WORKSPACE && <Workspace project={selectedProject} onDeleteProject={handleDeleteProject} onUpdateProject={handleUpdateProject} />}
              {currentView === AppView.FINETUNE && <FineTuningDashboard />}
              {currentView === AppView.AUDIO && <AudioStudio />}
              {currentView === AppView.MEDIA && <MediaStudio />}
              {currentView === AppView.SETTINGS && <Settings />}
          </Suspense>
      </div>
    </div>
  );
};

export default App;