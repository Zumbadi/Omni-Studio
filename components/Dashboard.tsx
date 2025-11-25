
import React, { useState, useEffect } from 'react';
import { LayoutGrid, Code, Zap, Music, Clapperboard, Plus, Trash2, Smartphone, Server, Globe, Youtube, Twitter, Film, Instagram, Volume2, Search, Tablet, Users, Download, Settings, Clock, CheckCircle, AlertTriangle, BarChart2, Check, XCircle, RotateCcw, Activity } from 'lucide-react';
import { AppView, Project, ProjectType, SocialPost, AudioTrack, ActivityItem } from '../types';
import { Button } from './Button';
import { MOCK_SOCIAL_POSTS } from '../constants';
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

    // System Status
    const [systemStatus, setSystemStatus] = useState({ status: 'Operational', latency: 45 });

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
    
    // Simulate System Health
    useEffect(() => {
        const interval = setInterval(() => {
            const lat = Math.floor(Math.random() * 20) + 30;
            setSystemStatus({ status: 'Operational', latency: lat });
        }, 3000);
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
            case ProjectType.REACT_NATIVE: return 'bg-purple-900/30 text-purple-400';
            case ProjectType.IOS_APP: return 'bg-blue-900/30 text-blue-300';
            case ProjectType.ANDROID_APP: return 'bg-green-900/30 text-green-400';
            case ProjectType.NODE_API: return 'bg-emerald-900/30 text-emerald-400';
            default: return 'bg-indigo-900/30 text-indigo-400';
        }
    };

    const formatTimeAgo = (dateString: any) => {
        return dateString || 'Recently';
    };

    const handleResetDemo = () => {
        if(confirm("Reset all demo projects and data?")) {
            localStorage.clear();
            window.location.reload();
        }
    }

    return (
      <div className="flex-1 bg-gray-950 overflow-y-auto p-4 md:p-8 w-full relative">
        {analyticsProject && <AnalyticsModal project={analyticsProject} onClose={() => setAnalyticsProject(null)} />}
        
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
          
          {/* Main Column */}
          <div className="flex-1">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Welcome back, Creator</h1>
                    <div className="hidden md:flex items-center gap-2 bg-gray-900 border border-gray-800 px-2 py-1 rounded text-[10px] font-mono text-gray-400">
                        <Activity size={10} className="text-green-500" />
                        <span>{systemStatus.status}</span>
                        <span className="text-gray-600">|</span>
                        <span>{systemStatus.latency}ms</span>
                    </div>
                </div>
                <p className="text-sm md:text-base text-gray-400">Unified control center for your Code, Media, and Audio projects.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-stretch md:items-center">
                 <div className="relative w-full md:w-64">
                     <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                     <input 
                        type="text" 
                        placeholder="Search everything..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                     />
                 </div>
                 <div className="flex gap-2 w-full md:w-auto">
                     <Button onClick={onManageTeam} variant="ghost" className="flex-1 md:flex-none border border-gray-700 hover:bg-gray-800" title="Manage AI Team">
                       <Users size={16} />
                     </Button>
                     <Button onClick={() => onNavigate(AppView.MEDIA)} variant="secondary" className="flex-1 md:flex-none">
                       <Clapperboard size={16} className="mr-2" /> New Content
                     </Button>
                     <Button onClick={onNewProject} className="flex-1 md:flex-none">
                       <Plus size={16} className="mr-2" /> New Project
                     </Button>
                 </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
               <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                  <div className="text-gray-500 text-sm font-medium mb-1">Active Projects</div>
                  <div className="text-2xl font-bold text-white">{projects.length} <span className="text-sm text-gray-500 font-normal">Code</span></div>
               </div>
               <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                  <div className="text-gray-500 text-sm font-medium mb-1">Social Reach</div>
                  <div className="text-2xl font-bold text-white">{recentMedia.length} <span className="text-sm text-gray-500 font-normal">Posts</span></div>
               </div>
               <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                  <div className="text-gray-500 text-sm font-medium mb-1">Audio Assets</div>
                  <div className="text-2xl font-bold text-white">{recentAudio.length} <span className="text-sm text-gray-500 font-normal">Tracks</span></div>
               </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 mb-6 border-b border-gray-800 overflow-x-auto">
               {['all', 'code', 'media', 'audio'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`pb-3 text-sm font-medium capitalize transition-colors relative whitespace-nowrap ${activeTab === tab ? 'text-primary-500' : 'text-gray-500 hover:text-white'}`}
                  >
                     {tab === 'all' ? 'All Projects' : tab}
                     {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 rounded-t-full"></div>}
                  </button>
               ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
              {/* Code Projects */}
              {(activeTab === 'all' || activeTab === 'code') && filteredProjects.map(project => (
                <div 
                  key={project.id} 
                  onClick={() => onProjectSelect(project)}
                  className="group bg-gray-900 border border-gray-800 rounded-xl p-6 cursor-pointer hover:border-primary-600/50 hover:shadow-2xl hover:shadow-primary-900/20 transition-all duration-300 relative overflow-hidden flex flex-col"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                     <div className={`p-2 rounded-lg ${getProjectColor(project.type)}`}>
                         {getProjectIcon(project.type)}
                     </div>
                     <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setAnalyticsProject(project); }} className="text-gray-600 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors" title="Analytics">
                            <BarChart2 size={14} />
                        </button>
                        {onExportProject && (
                            <button onClick={(e) => { e.stopPropagation(); onExportProject(project); }} className="text-gray-600 hover:text-white p-1.5 rounded hover:bg-gray-800 transition-colors" title="Export Zip">
                                <Download size={14} />
                            </button>
                        )}
                        <button 
                          onClick={(e) => onDeleteProject(e, project.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-gray-800"
                          title="Delete Project"
                        >
                          <Trash2 size={14} />
                        </button>
                     </div>
                  </div>
                  <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors truncate">{project.name}</h3>
                      {project.deploymentStatus && (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1 border ${project.deploymentStatus === 'live' ? 'bg-green-900/30 text-green-400 border-green-800' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                              {project.deploymentStatus === 'live' ? <Check size={10}/> : <XCircle size={10}/>} {project.deploymentStatus}
                          </span>
                      )}
                  </div>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2 h-10">{project.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-auto">
                     <span className="px-2 py-1 bg-gray-800 rounded border border-gray-700 truncate max-w-[150px]">{project.type}</span>
                     <span>•</span>
                     <span>{project.fileCount} files</span>
                     <span className="ml-auto">{project.lastModified}</span>
                  </div>
                </div>
              ))}

              {/* Media Posts */}
              {(activeTab === 'all' || activeTab === 'media') && filteredMedia.map(post => (
                <div 
                  key={post.id} 
                  onClick={() => onNavigate(AppView.MEDIA)}
                  className="group bg-gray-900 border border-gray-800 rounded-xl p-0 cursor-pointer hover:border-pink-600/50 hover:shadow-2xl hover:shadow-pink-900/20 transition-all duration-300 relative overflow-hidden flex flex-col"
                >
                  <div className="h-32 w-full bg-gray-800 relative overflow-hidden">
                      {post.thumbnail ? (
                          <img src={post.thumbnail} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt="thumb" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                             <Clapperboard className="text-gray-600" size={32} />
                          </div>
                      )}
                      <div className={`absolute top-3 right-3 p-1.5 rounded-lg bg-black/50 backdrop-blur ${
                          post.platform === 'youtube' ? 'text-red-400' : 
                          post.platform === 'twitter' ? 'text-blue-400' : 
                          'text-pink-400'
                      }`}>
                          {post.platform === 'youtube' && <Youtube size={16} />}
                          {post.platform === 'twitter' && <Twitter size={16} />}
                          {post.platform === 'tiktok' && <Film size={16} />}
                          {post.platform === 'instagram' && <Instagram size={16} />}
                      </div>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                     <h3 className="text-md font-semibold text-white mb-2 group-hover:text-pink-400 transition-colors line-clamp-1">{post.title}</h3>
                     <div className="mt-auto flex justify-between items-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                            post.status === 'uploaded' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                        }`}>
                           {post.status}
                        </span>
                        {post.views && <span className="text-xs text-gray-500">{post.views} views</span>}
                     </div>
                  </div>
                </div>
              ))}

              {/* Audio Tracks */}
              {(activeTab === 'all' || activeTab === 'audio') && filteredAudio.map(track => (
                 <div 
                   key={track.id}
                   onClick={() => onNavigate(AppView.AUDIO)}
                   className="group bg-gray-900 border border-gray-800 rounded-xl p-6 cursor-pointer hover:border-purple-600/50 hover:shadow-2xl hover:shadow-purple-900/20 transition-all duration-300 relative overflow-hidden"
                 >
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="flex justify-between items-start mb-4">
                      <div className="p-2 rounded-lg bg-purple-900/30 text-purple-400">
                          {track.type === 'music' ? <Music size={20} /> : <Volume2 size={20} />}
                      </div>
                      <div className="flex items-center gap-1 text-gray-500">
                         <div className="flex gap-0.5 h-4 items-end">
                            {[1,2,3,4,5].map(i => <div key={i} className="w-0.5 bg-gray-600" style={{height: `${Math.random() * 100}%`}}></div>)}
                         </div>
                      </div>
                   </div>
                   <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors truncate">{track.name}</h3>
                   <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="capitalize">{track.type}</span>
                      <span>•</span>
                      <span>{Math.floor(track.duration)}s</span>
                   </div>
                 </div>
              ))}
              
              {/* Empty States */}
              {activeTab === 'code' && filteredProjects.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No projects found matching "{searchQuery}"</div>}
              {activeTab === 'media' && filteredMedia.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No media posts found matching "{searchQuery}"</div>}
              {activeTab === 'audio' && filteredAudio.length === 0 && <div className="col-span-full text-center py-12 text-gray-500">No audio tracks found matching "{searchQuery}"</div>}
            </div>
          </div>

          {/* Activity Feed Column */}
          <div className="w-full lg:w-80 shrink-0">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 sticky top-6">
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                          <Clock size={16}/> Activity Feed
                      </h3>
                      <button onClick={handleResetDemo} className="text-gray-500 hover:text-red-400" title="Reset Demo">
                          <RotateCcw size={14}/>
                      </button>
                  </div>
                  
                  <div className="space-y-6 relative">
                      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-800"></div>
                      
                      {activities.length === 0 && <div className="text-xs text-gray-500 italic pl-8">No recent activity</div>}

                      {activities.map(activity => (
                          <div key={activity.id} className="relative flex gap-4 group animate-in slide-in-from-right-4 fade-in">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-gray-900 ${
                                  activity.type === 'commit' ? 'bg-blue-600' : 
                                  activity.type === 'deploy' ? 'bg-green-600' : 
                                  activity.type === 'alert' ? 'bg-red-600' : 
                                  activity.type === 'task' ? 'bg-purple-600' : 'bg-gray-600'
                              }`}>
                                  {activity.type === 'commit' && <Code size={14} className="text-white"/>}
                                  {activity.type === 'deploy' && <Zap size={14} className="text-white"/>}
                                  {activity.type === 'alert' && <AlertTriangle size={14} className="text-white"/>}
                                  {activity.type === 'task' && <Users size={14} className="text-white"/>}
                                  {activity.type === 'post' && <Clapperboard size={14} className="text-white"/>}
                              </div>
                              
                              <div>
                                  <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors line-clamp-2">{activity.title}</div>
                                  <div className="text-xs text-gray-500 mb-1">{activity.desc}</div>
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
