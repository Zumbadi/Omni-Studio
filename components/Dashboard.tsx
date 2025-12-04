
import React, { useState, useEffect } from 'react';
import { LayoutGrid, Code, Zap, Music, Clapperboard, Plus, Trash2, Smartphone, Server, Globe, Youtube, Twitter, Film, Instagram, Volume2, Search, Tablet, Users, Download, Settings, Clock, CheckCircle, AlertTriangle, BarChart2, Check, XCircle, RotateCcw, Activity, Wifi, ShieldCheck, Database, HardDrive, Rocket } from 'lucide-react';
import { AppView, Project, ProjectType, SocialPost, AudioTrack, ActivityItem } from '../types';
import { Button } from './Button';
import { MOCK_SOCIAL_POSTS, WEB_FILE_TREE } from '../constants';
import { getActivities } from '../utils/activityLogger';
import { AnalyticsModal } from './AnalyticsModal';

interface DashboardProps {
  projects: Project[];
  onProjectSelect: (project: Project) => void;
  onDeleteProject: (e: React.MouseEvent, id: string) => void;
  onNewProject: () => void;
  onNavigate: (view: AppView) => void;
  onManageTeam: () => void;
  onExportProject?: (project: Project) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, onProjectSelect, onDeleteProject, onNewProject, onNavigate, onManageTeam, onExportProject }) => {
    const [activeTab, setActiveTab] = useState<'all' | 'code' | 'media' | 'audio'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [recentMedia, setRecentMedia] = useState<SocialPost[]>([]);
    const [recentAudio, setRecentAudio] = useState<AudioTrack[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    
    const [analyticsProject, setAnalyticsProject] = useState<Project | null>(null);

    // System Status Simulation
    const [systemStatus, setSystemStatus] = useState({ status: 'Operational', latency: 45, region: 'US-East-1', uptime: '99.99%' });

    useEffect(() => {
       const savedMedia = localStorage.getItem('omni_social_posts');
       if (savedMedia) setRecentMedia(JSON.parse(savedMedia));
       else setRecentMedia(MOCK_SOCIAL_POSTS); 
       
       const savedAudio = localStorage.getItem('omni_audio_tracks');
       if (savedAudio) setRecentAudio(JSON.parse(savedAudio));

       // Load Activities
       const loadActivities = () => {
           const acts = getActivities();
           setActivities(acts);
       };
       loadActivities();
       window.addEventListener('omniActivityUpdated', loadActivities);
       return () => window.removeEventListener('omniActivityUpdated', loadActivities);
    }, []);
    
    // Simulate Live System Health Updates
    useEffect(() => {
        const interval = setInterval(() => {
            const lat = Math.floor(Math.random() * 20) + 35;
            setSystemStatus(prev => ({ ...prev, latency: lat }));
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Filter Data
    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredMedia = recentMedia.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredAudio = recentAudio.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const getProjectIcon = (type: ProjectType) => {
        switch(type) {
            case ProjectType.REACT_NATIVE: return <Smartphone size={20} />;
            case ProjectType.IOS_APP: return <Tablet size={20} />;
            case ProjectType.ANDROID_APP: return <Smartphone size={20} />;
            case ProjectType.NODE_API: return <Server size={20} />;
            default: return <Globe size={20} />;
        }
    };

    const getProjectColor = (type: ProjectType) => {
        switch(type) {
            case ProjectType.REACT_NATIVE: return 'bg-purple-900/30 text-purple-400 border border-purple-500/30';
            case ProjectType.IOS_APP: return 'bg-blue-900/30 text-blue-300 border border-blue-500/30';
            case ProjectType.ANDROID_APP: return 'bg-green-900/30 text-green-400 border border-green-500/30';
            case ProjectType.NODE_API: return 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30';
            default: return 'bg-indigo-900/30 text-indigo-400 border border-indigo-500/30';
        }
    };

    const formatTimeAgo = (dateString: any) => {
        // Simple mock for "2 mins ago"
        return dateString || 'Recently';
    };

    const handleResetDemo = () => {
        if(confirm("⚠ WARNING: This will reset all demo data to factory defaults. Continue?")) {
            // Deep clean all project-related keys
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('omni_') || key.startsWith('proj_'))) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
            
            // Reload to reset state
            window.location.reload();
        }
    }

    const handleQuickStart = () => {
        // Direct inject of a sample project
        const newProject: Project = {
            id: `quick-${Date.now()}`,
            name: "Quick Start App",
            description: "A fast React template generated instantly.",
            type: ProjectType.REACT_WEB,
            lastModified: "Just now",
            fileCount: WEB_FILE_TREE.length
        };
        localStorage.setItem(`omni_files_${newProject.id}`, JSON.stringify(WEB_FILE_TREE));
        
        // Use window event to update App.tsx state without prop drilling for simplicity in this specific "Quick" action
        const currentProjects = JSON.parse(localStorage.getItem('omni_projects') || '[]');
        const updatedProjects = [newProject, ...currentProjects];
        localStorage.setItem('omni_projects', JSON.stringify(updatedProjects));
        
        // Select it via event
        window.dispatchEvent(new Event('omniProjectsUpdated'));
        
        // Slight hack: we need to trigger selection in App.tsx, but dispatching storage update helps persistence.
        // We can manually call onProjectSelect if available, but for a true "refresh" feel we reload or use prop.
        onProjectSelect(newProject);
    };

    return (
      <div className="flex-1 bg-gray-950 overflow-y-auto p-4 md:p-8 w-full relative scroll-smooth">
        {analyticsProject && <AnalyticsModal project={analyticsProject} onClose={() => setAnalyticsProject(null)} />}
        
        <div className="max-w-[1800px] mx-auto flex flex-col lg:flex-row gap-8">
          
          {/* Main Column */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Mission Control</h1>
                    <span className="hidden md:inline-flex relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                </div>
                <p className="text-sm md:text-base text-gray-400 max-w-lg">
                    Unified workspace for full-stack development, model fine-tuning, and multimedia generation.
                </p>
              </div>
              
              {/* System Status Widget */}
              <div className="hidden xl:flex items-center gap-4 bg-gray-900/50 p-3 rounded-xl border border-gray-800 backdrop-blur-sm shadow-sm">
                  <div className="flex flex-col px-4 border-r border-gray-800">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldCheck size={10}/> Status</span>
                      <div className="flex items-center gap-2 text-xs font-medium text-green-400">
                          <CheckCircle size={12} /> {systemStatus.status}
                      </div>
                  </div>
                  <div className="flex flex-col px-4 border-r border-gray-800">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Wifi size={10}/> Latency</span>
                      <div className="flex items-center gap-2 text-xs font-mono text-blue-400">
                          {systemStatus.latency}ms
                      </div>
                  </div>
                  <div className="flex flex-col px-4 border-r border-gray-800">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Activity size={10}/> Uptime</span>
                      <div className="flex items-center gap-2 text-xs font-mono text-purple-400">
                          {systemStatus.uptime}
                      </div>
                  </div>
                  <div className="flex flex-col px-4">
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><HardDrive size={10}/> Cluster</span>
                      <div className="flex items-center gap-2 text-xs font-mono text-gray-300">
                          {systemStatus.region}
                      </div>
                  </div>
              </div>
            </div>

            {/* Quick Actions & Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
                 <div className="relative flex-1">
                     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                     <input 
                        type="text" 
                        placeholder="Search projects, assets, or commands..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900/80 border border-gray-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all shadow-sm"
                     />
                 </div>
                 <div className="flex gap-2">
                     <Button onClick={onManageTeam} variant="ghost" className="border border-gray-800 bg-gray-900/50 hover:bg-gray-800" title="Manage AI Agents">
                       <Users size={16} className="mr-2"/> Agents
                     </Button>
                     <Button onClick={onNewProject} className="bg-primary-600 hover:bg-primary-500 text-white shadow-lg shadow-primary-900/20">
                       <Plus size={16} className="mr-2" /> New Project
                     </Button>
                 </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
               <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800/50 hover:border-gray-700 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                      <div className="p-2 bg-blue-900/20 rounded-lg text-blue-400 group-hover:text-blue-300 transition-colors"><Code size={20}/></div>
                      <span className="text-xs font-medium text-green-400 bg-green-900/10 px-2 py-0.5 rounded-full border border-green-900/20">+12%</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{projects.length}</div>
                  <div className="text-xs text-gray-500 font-medium">Active Repositories</div>
               </div>
               
               <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800/50 hover:border-gray-700 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                      <div className="p-2 bg-pink-900/20 rounded-lg text-pink-400 group-hover:text-pink-300 transition-colors"><Clapperboard size={20}/></div>
                      <span className="text-xs font-medium text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Stable</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{recentMedia.length}</div>
                  <div className="text-xs text-gray-500 font-medium">Media Campaigns</div>
               </div>
               
               <div className="bg-gray-900/50 p-5 rounded-2xl border border-gray-800/50 hover:border-gray-700 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                      <div className="p-2 bg-purple-900/20 rounded-lg text-purple-400 group-hover:text-purple-300 transition-colors"><Database size={20}/></div>
                      <span className="text-xs font-medium text-blue-400 bg-blue-900/10 px-2 py-0.5 rounded-full border border-blue-900/20">Using 2.4GB</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{recentAudio.length}</div>
                  <div className="text-xs text-gray-500 font-medium">Audio Assets</div>
               </div>
            </div>

            {/* Content Tabs */}
            <div className="flex items-center justify-between border-b border-gray-800 mb-6">
                <div className="flex gap-6">
                   {['all', 'code', 'media', 'audio'].map(tab => (
                      <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`pb-3 text-sm font-medium capitalize transition-colors relative whitespace-nowrap px-1 ${activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                      >
                         {tab === 'all' ? 'All Projects' : tab}
                         {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full shadow-[0_0_10px_#6366f1]"></div>}
                      </button>
                   ))}
                </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-8">
              
              {/* Quick Start Card */}
              {activeTab === 'all' && searchQuery === '' && (
                  <div 
                    onClick={handleQuickStart}
                    className="group bg-gradient-to-br from-primary-900/20 to-gray-900 border border-primary-500/30 rounded-xl p-5 cursor-pointer hover:border-primary-500 hover:shadow-lg hover:shadow-primary-900/20 transition-all duration-300 relative flex flex-col justify-center items-center min-h-[180px] border-dashed"
                  >
                      <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform">
                          <Rocket size={24} className="text-white"/>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">Quick Start</h3>
                      <p className="text-sm text-primary-200/70 text-center">Launch a React + Tailwind template instantly.</p>
                  </div>
              )}

              {/* Code Projects */}
              {(activeTab === 'all' || activeTab === 'code') && filteredProjects.map(project => (
                <div 
                  key={project.id} 
                  onClick={() => onProjectSelect(project)}
                  className="group bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-primary-500/30 hover:bg-gray-800/50 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 relative overflow-hidden flex flex-col h-full"
                >
                  <div className="flex justify-between items-start mb-4">
                     <div className={`p-2.5 rounded-lg ${getProjectColor(project.type)} shadow-sm`}>
                         {getProjectIcon(project.type)}
                     </div>
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setAnalyticsProject(project); }} className="text-gray-500 hover:text-white p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="View Analytics">
                            <BarChart2 size={16} />
                        </button>
                        {onExportProject && (
                            <button onClick={(e) => { e.stopPropagation(); onExportProject(project); }} className="text-gray-500 hover:text-white p-1.5 rounded hover:bg-gray-700/50 transition-colors" title="Export Source">
                                <Download size={16} />
                            </button>
                        )}
                        <button 
                          onClick={(e) => onDeleteProject(e, project.id)}
                          className="text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-gray-700/50"
                          title="Delete Project"
                        >
                          <Trash2 size={16} />
                        </button>
                     </div>
                  </div>
                  
                  <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                          <h3 className="text-base font-bold text-white group-hover:text-primary-400 transition-colors truncate pr-4">{project.name}</h3>
                          {project.deploymentStatus && (
                              <span className={`flex-shrink-0 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1 border ${project.deploymentStatus === 'live' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                  {project.deploymentStatus === 'live' ? <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> : <XCircle size={8}/>} {project.deploymentStatus}
                              </span>
                          )}
                      </div>
                      <p className="text-xs text-gray-400 mb-4 line-clamp-2 leading-relaxed h-8">{project.description}</p>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] text-gray-500 font-medium pt-3 border-t border-gray-800/50 mt-auto">
                     <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-gray-600"/> {project.type}</span>
                     <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                     <span>{project.fileCount} files</span>
                     <span className="ml-auto font-mono text-gray-600">{project.lastModified}</span>
                  </div>
                </div>
              ))}

              {/* Media Posts */}
              {(activeTab === 'all' || activeTab === 'media') && filteredMedia.map(post => (
                <div 
                  key={post.id} 
                  onClick={() => onNavigate(AppView.MEDIA)}
                  className="group bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-pink-500/30 hover:shadow-xl transition-all duration-300 relative flex flex-col h-full"
                >
                  <div className="h-32 w-full bg-gray-800 relative overflow-hidden">
                      {post.thumbnail ? (
                          <img src={post.thumbnail} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" alt="thumb" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                             <Clapperboard className="text-gray-700" size={32} />
                          </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-90"></div>
                      
                      <div className={`absolute top-3 right-3 p-1.5 rounded-lg bg-black/60 backdrop-blur border border-white/10 ${
                          post.platform === 'youtube' ? 'text-red-400' : 
                          post.platform === 'twitter' ? 'text-blue-400' : 
                          'text-pink-400'
                      }`}>
                          {post.platform === 'youtube' && <Youtube size={14} />}
                          {post.platform === 'twitter' && <Twitter size={14} />}
                          {post.platform === 'tiktok' && <Film size={14} />}
                          {post.platform === 'instagram' && <Instagram size={14} />}
                      </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                     <h3 className="text-sm font-bold text-white mb-2 group-hover:text-pink-400 transition-colors line-clamp-1">{post.title}</h3>
                     <div className="mt-auto flex justify-between items-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wide border ${
                            post.status === 'uploaded' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        }`}>
                           {post.status}
                        </span>
                        {post.views && <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1"><Activity size={10}/> {post.views}</span>}
                     </div>
                  </div>
                </div>
              ))}

              {/* Audio Tracks */}
              {(activeTab === 'all' || activeTab === 'audio') && filteredAudio.map(track => (
                 <div 
                   key={track.id}
                   onClick={() => onNavigate(AppView.AUDIO)}
                   className="group bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-purple-500/30 hover:bg-gray-800/50 hover:shadow-xl transition-all duration-300 relative flex items-center gap-4"
                 >
                   <div className="p-3 rounded-lg bg-purple-900/20 text-purple-400 border border-purple-500/20 shrink-0">
                       {track.type === 'music' ? <Music size={20} /> : <Volume2 size={20} />}
                   </div>
                   
                   <div className="flex-1 min-w-0">
                       <h3 className="text-sm font-bold text-white mb-1 group-hover:text-purple-400 transition-colors truncate">{track.name}</h3>
                       <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                          <span>{track.type}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                          <span className="font-mono text-gray-400">{Math.floor(track.duration)}s</span>
                       </div>
                   </div>
                   
                   <div className="flex gap-0.5 h-6 items-end shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                      {[1,2,3,4,5,6,7].map(i => <div key={i} className="w-1 bg-purple-500/50 rounded-t-sm" style={{height: `${Math.random() * 100}%`}}></div>)}
                   </div>
                 </div>
              ))}
              
              {/* Empty States */}
              {activeTab === 'code' && filteredProjects.length === 0 && <div className="col-span-full text-center py-16 text-gray-600 font-medium">No projects found matching "{searchQuery}"</div>}
              {activeTab === 'media' && filteredMedia.length === 0 && <div className="col-span-full text-center py-16 text-gray-600 font-medium">No media posts found matching "{searchQuery}"</div>}
              {activeTab === 'audio' && filteredAudio.length === 0 && <div className="col-span-full text-center py-16 text-gray-600 font-medium">No audio tracks found matching "{searchQuery}"</div>}
            </div>
          </div>

          {/* Activity Feed Column */}
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-800 lg:pl-8 pt-8 lg:pt-0">
              <div className="sticky top-6">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={14}/> Recent Activity
                      </h3>
                      <button onClick={handleResetDemo} className="text-gray-600 hover:text-red-400 transition-colors p-1" title="Reset Demo Data">
                          <RotateCcw size={14}/>
                      </button>
                  </div>
                  
                  <div className="space-y-0 relative">
                      <div className="absolute left-[19px] top-3 bottom-3 w-px bg-gray-800"></div>
                      
                      {activities.length === 0 && <div className="text-xs text-gray-500 italic pl-10 py-2">No recent activity</div>}

                      {activities.map((activity, i) => (
                          <div key={activity.id} className="relative flex gap-4 group pb-6 last:pb-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 z-10 border-2 border-gray-950 shadow-sm transition-transform group-hover:scale-110 ${
                                  activity.type === 'commit' ? 'bg-blue-600' : 
                                  activity.type === 'deploy' ? 'bg-green-600' : 
                                  activity.type === 'alert' ? 'bg-red-600' : 
                                  activity.type === 'task' ? 'bg-purple-600' : 'bg-gray-700'
                              }`}>
                                  {activity.type === 'commit' && <Code size={18} className="text-white"/>}
                                  {activity.type === 'deploy' && <Zap size={18} className="text-white"/>}
                                  {activity.type === 'alert' && <AlertTriangle size={18} className="text-white"/>}
                                  {activity.type === 'task' && <Users size={18} className="text-white"/>}
                                  {activity.type === 'post' && <Clapperboard size={18} className="text-white"/>}
                              </div>
                              
                              <div className="pt-1">
                                  <div className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors line-clamp-1">{activity.title}</div>
                                  <div className="text-xs text-gray-500 mb-1 line-clamp-1">{activity.desc}</div>
                                  <div className="text-[10px] text-gray-600 font-mono">{formatTimeAgo(activity.time)}</div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
        </div>
      </div>
    );
};