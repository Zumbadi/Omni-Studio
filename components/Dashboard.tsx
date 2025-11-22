
import React, { useState, useEffect } from 'react';
import { LayoutGrid, Code, Zap, Music, Clapperboard, Plus, Trash2, Smartphone, Server, Globe, Youtube, Twitter, Film, Instagram, Volume2, Search } from 'lucide-react';
import { AppView, Project, ProjectType, SocialPost, AudioTrack } from '../types';
import { Button } from './Button';
import { MOCK_SOCIAL_POSTS } from '../constants';

interface DashboardProps {
  projects: Project[];
  onProjectSelect: (project: Project) => void;
  onDeleteProject: (e: React.MouseEvent, id: string) => void;
  onNewProject: () => void;
  onNavigate: (view: AppView) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, onProjectSelect, onDeleteProject, onNewProject, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'all' | 'code' | 'media' | 'audio'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [recentMedia, setRecentMedia] = useState<SocialPost[]>([]);
    const [recentAudio, setRecentAudio] = useState<AudioTrack[]>([]);

    useEffect(() => {
       const savedMedia = localStorage.getItem('omni_social_posts');
       if (savedMedia) setRecentMedia(JSON.parse(savedMedia));
       else setRecentMedia(MOCK_SOCIAL_POSTS); 
       
       const savedAudio = localStorage.getItem('omni_audio_tracks');
       if (savedAudio) setRecentAudio(JSON.parse(savedAudio));
    }, []);

    // Filter Data
    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredMedia = recentMedia.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredAudio = recentAudio.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
      <div className="flex-1 bg-gray-950 overflow-y-auto p-4 md:p-8 w-full">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Welcome back, Creator</h1>
              <p className="text-sm md:text-base text-gray-400">Unified control center for your Code, Media, and Audio projects.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
            {/* Code Projects */}
            {(activeTab === 'all' || activeTab === 'code') && filteredProjects.map(project => (
              <div 
                key={project.id} 
                onClick={() => onProjectSelect(project)}
                className="group bg-gray-900 border border-gray-800 rounded-xl p-6 cursor-pointer hover:border-primary-600/50 hover:shadow-2xl hover:shadow-primary-900/20 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex justify-between items-start mb-4">
                   <div className={`p-2 rounded-lg ${
                      project.type === ProjectType.REACT_NATIVE ? 'bg-purple-900/30 text-purple-400' : 
                      project.type === ProjectType.NODE_API ? 'bg-green-900/30 text-green-400' :
                      'bg-blue-900/30 text-blue-400'
                   }`}>
                       {project.type === ProjectType.REACT_NATIVE ? <Smartphone size={20} /> : 
                        project.type === ProjectType.NODE_API ? <Server size={20} /> : 
                        <Globe size={20} />}
                   </div>
                   <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{project.lastModified}</span>
                      <button 
                        onClick={(e) => onDeleteProject(e, project.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors truncate">{project.name}</h3>
                <p className="text-sm text-gray-400 mb-4 line-clamp-2 h-10">{project.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                   <span className="px-2 py-1 bg-gray-800 rounded border border-gray-700">{project.type}</span>
                   <span>•</span>
                   <span>{project.fileCount} files</span>
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
      </div>
    );
};
