
import React, { useState, useEffect } from 'react';
import { Clapperboard, Youtube, Instagram, Twitter, Plus, Upload, Image as ImageIcon, Film, Wand2, Eye, MoreHorizontal, CheckCircle, FileText, Layout, Edit3, X, PlayCircle, Video, Loader2, Sparkles, Globe, Tag, Share2, CloudUpload, Save, Download, Calendar, LayoutGrid, List } from 'lucide-react';
import { Button } from './Button';
import { MOCK_SOCIAL_POSTS } from '../constants';
import { SocialPost, Scene } from '../types';
import { generateSocialContent, generateImage, generateVideo } from '../services/geminiService';
import JSZip from 'jszip';

export const MediaStudio: React.FC = () => {
  const [posts, setPosts] = useState<SocialPost[]>(() => {
    const saved = localStorage.getItem('omni_social_posts');
    return saved ? JSON.parse(saved) : MOCK_SOCIAL_POSTS;
  });
  
  const [activeView, setActiveView] = useState<'kanban' | 'calendar' | 'create' | 'detail'>('kanban');
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  
  // Creation State
  const [newPostPrompt, setNewPostPrompt] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('youtube');

  // Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Persistence: Strip blob URLs before saving to prevent broken links on reload
  useEffect(() => {
    const postsToSave = posts.map(p => ({
        ...p,
        scenes: p.scenes?.map(s => ({
            ...s,
            // Strip blob URLs for video as they are ephemeral. Keep Base64 images.
            videoUrl: s.videoUrl?.startsWith('blob:') ? undefined : s.videoUrl
        }))
    }));
    localStorage.setItem('omni_social_posts', JSON.stringify(postsToSave));
    window.dispatchEvent(new Event('omniAssetsUpdated'));
  }, [posts]);

  const handleCreateContentPlan = async () => {
    if (!newPostPrompt) return;
    setIsGeneratingPlan(true);

    let generatedScript = "";
    await generateSocialContent(newPostPrompt, selectedPlatform, (chunk) => {
        generatedScript += chunk;
    });

    const titleMatch = generatedScript.match(/Title:\s*(.*)/);
    const title = titleMatch ? titleMatch[1] : "New Viral Post";
    
    const defaultScenes: Scene[] = [
        { id: 's1', description: 'Opening shot: energetic intro', status: 'pending' },
        { id: 's2', description: 'Main topic explanation with graphics', status: 'pending' },
        { id: 's3', description: 'Call to action and subscribe', status: 'pending' }
    ];
    
    // Assign a random future date for the calendar
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 14));

    const newPost: SocialPost = {
      id: `p${Date.now()}`,
      title: title,
      platform: selectedPlatform as any,
      status: 'idea',
      script: generatedScript,
      scenes: defaultScenes,
      scheduledDate: futureDate.toISOString()
    };

    setPosts(prev => [...prev, newPost]);
    setIsGeneratingPlan(false);
    setSelectedPost(newPost);
    setActiveView('detail');
  };

  const handleGenerateImage = async (sceneId: string) => {
     if (!selectedPost) return;
     const scene = selectedPost.scenes?.find(s => s.id === sceneId);
     if (!scene) return;

     updateSceneStatus(sceneId, 'generating');
     const imageUrl = await generateImage(scene.description);
     
     if (imageUrl) {
        updateScene(sceneId, { imageUrl, status: 'done' });
     } else {
        updateSceneStatus(sceneId, 'pending');
     }
  };

  const handleGenerateVideo = async (sceneId: string) => {
      if (!selectedPost) return;
      const scene = selectedPost.scenes?.find(s => s.id === sceneId);
      if (!scene) return;

      const win = window as any;
      if (win.aistudio) {
         const hasKey = await win.aistudio.hasSelectedApiKey();
         if (!hasKey) {
             const success = await win.aistudio.openSelectKey();
             if (!success) return;
         }
      }

      updateSceneStatus(sceneId, 'generating');
      // Pass existing image URL if available for Image-to-Video generation
      const videoUrl = await generateVideo(scene.description, scene.imageUrl);

      if (videoUrl) {
          updateScene(sceneId, { videoUrl, status: 'done' });
      } else {
          updateSceneStatus(sceneId, 'pending');
      }
  };

  const updateSceneStatus = (sceneId: string, status: Scene['status']) => {
     if (!selectedPost) return;
     const updatedScenes = selectedPost.scenes?.map(s => s.id === sceneId ? { ...s, status } : s);
     const updatedPost = { ...selectedPost, scenes: updatedScenes };
     setSelectedPost(updatedPost);
     setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
  };

  const updateScene = (sceneId: string, updates: Partial<Scene>) => {
     if (!selectedPost) return;
     const updatedScenes = selectedPost.scenes?.map(s => s.id === sceneId ? { ...s, ...updates } : s);
     const updatedPost = { ...selectedPost, scenes: updatedScenes };
     setSelectedPost(updatedPost);
     setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
  };

  const handleOpenUpload = (post: SocialPost, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setSelectedPost(post);
      setShowUploadModal(true);
      setUploadProgress(0);
      setIsUploading(false);
  };

  const handleConfirmUpload = () => {
      if (!selectedPost) return;
      setIsUploading(true);
      
      // Simulate upload
      let progress = 0;
      const interval = setInterval(() => {
          progress += Math.random() * 15;
          if (progress >= 100) {
              clearInterval(interval);
              setUploadProgress(100);
              setTimeout(() => {
                  const updatedPost = { ...selectedPost, status: 'uploaded' as const };
                  setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
                  setIsUploading(false);
                  setShowUploadModal(false);
                  alert("Content published successfully!");
              }, 500);
          } else {
              setUploadProgress(progress);
          }
      }, 500);
  };

  const handleSaveDraft = () => {
    // Just trigger persistence
    const postsToSave = posts.map(p => ({
        ...p,
        scenes: p.scenes?.map(s => ({
            ...s,
            videoUrl: s.videoUrl?.startsWith('blob:') ? undefined : s.videoUrl
        }))
    }));
    localStorage.setItem('omni_social_posts', JSON.stringify(postsToSave));
    window.dispatchEvent(new Event('omniAssetsUpdated'));
    alert("Draft saved successfully!");
  };

  const handleExportPackage = async () => {
      if (!selectedPost) return;
      setIsExporting(true);
      const zip = new JSZip();
      
      // Add Script
      zip.file("script.md", `# ${selectedPost.title}\n\n${selectedPost.script || 'No script generated.'}`);
      
      // Add Metadata
      const metadata = {
          title: selectedPost.title,
          platform: selectedPost.platform,
          hashtags: selectedPost.hashtags,
          generatedAt: new Date().toISOString()
      };
      zip.file("metadata.json", JSON.stringify(metadata, null, 2));

      // Add Assets
      const assetsFolder = zip.folder("assets");
      if (assetsFolder && selectedPost.scenes) {
          for (let i = 0; i < selectedPost.scenes.length; i++) {
              const scene = selectedPost.scenes[i];
              if (scene.imageUrl) {
                  // Convert base64/dataURI to blob
                  const response = await fetch(scene.imageUrl);
                  const blob = await response.blob();
                  assetsFolder.file(`scene_${i + 1}_image.png`, blob);
              }
              if (scene.videoUrl) {
                  try {
                      const response = await fetch(scene.videoUrl);
                      const blob = await response.blob();
                      assetsFolder.file(`scene_${i + 1}_video.mp4`, blob);
                  } catch (e) {
                      console.warn(`Could not export video for scene ${i+1}`);
                  }
              }
          }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedPost.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_package.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setIsExporting(false);
  };

  const UploadModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <CloudUpload className="text-primary-500" />
                    Publish to {selectedPost?.platform}
                </h3>
                <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
            </div>
            
            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Video Title</label>
                    <input 
                        type="text" 
                        defaultValue={selectedPost?.title} 
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                    <textarea 
                        className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500 resize-none"
                        defaultValue={`Check out my latest video generated with Omni-Studio! \n\n#AI #Dev #Tech`}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Tags</label>
                    <div className="flex flex-wrap gap-2">
                        {['AI', 'Technology', 'Viral', 'OmniStudio'].map(tag => (
                            <span key={tag} className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs border border-gray-700 flex items-center gap-1">
                                <Tag size={10} /> {tag}
                            </span>
                        ))}
                        <button className="text-xs text-primary-400 hover:underline">+ Add</button>
                    </div>
                </div>
            </div>

            {isUploading ? (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>Uploading media...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                        <div className="bg-primary-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                </div>
            ) : (
                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setShowUploadModal(false)}>Cancel</Button>
                    <Button className="flex-1" onClick={handleConfirmUpload}>
                        <Share2 size={16} className="mr-2" /> Publish Now
                    </Button>
                </div>
            )}
        </div>
    </div>
  );

  const CalendarView = () => {
      // Mock Calendar Logic
      const days = Array.from({length: 35}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - d.getDay() + i);
          return d;
      });
      const today = new Date();

      return (
          <div className="flex-1 p-8 overflow-hidden flex flex-col">
             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-white">Content Schedule</h2>
                 <div className="text-sm text-gray-500">{today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
             </div>
             <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 overflow-hidden flex flex-col">
                 <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-850">
                     {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                         <div key={day} className="p-3 text-center text-xs font-medium text-gray-500 uppercase">{day}</div>
                     ))}
                 </div>
                 <div className="grid grid-cols-7 grid-rows-5 flex-1">
                     {days.map((date, i) => {
                         // Assign random posts to days for demo visualization if not explicitly set
                         const dayPosts = posts.filter(p => {
                             if (p.scheduledDate) return new Date(p.scheduledDate).toDateString() === date.toDateString();
                             // Fallback visual mock for old posts without date
                             return !p.scheduledDate && parseInt(p.id.slice(-2)) % 30 === i;
                         });
                         
                         const isToday = date.toDateString() === today.toDateString();

                         return (
                             <div key={i} className={`border border-gray-800/50 p-2 flex flex-col gap-1 min-h-[100px] ${date.getMonth() !== today.getMonth() ? 'bg-gray-900/30 text-gray-600' : 'bg-gray-900'}`}>
                                 <div className={`text-xs mb-1 font-mono ${isToday ? 'text-primary-400 font-bold' : 'text-gray-500'}`}>{date.getDate()}</div>
                                 {dayPosts.map(post => (
                                     <div 
                                       key={post.id} 
                                       onClick={() => { setSelectedPost(post); setActiveView('detail'); }}
                                       className={`text-[10px] p-1 rounded truncate cursor-pointer border border-transparent hover:border-gray-600 ${
                                         post.platform === 'youtube' ? 'bg-red-900/20 text-red-300' :
                                         post.platform === 'twitter' ? 'bg-blue-900/20 text-blue-300' :
                                         'bg-purple-900/20 text-purple-300'
                                       }`}
                                     >
                                         {post.title}
                                     </div>
                                 ))}
                             </div>
                         );
                     })}
                 </div>
             </div>
          </div>
      );
  };

  const KanbanColumn = ({ title, status, color }: { title: string, status: SocialPost['status'], color: string }) => (
    <div className="flex-1 min-w-[280px] bg-gray-900/50 rounded-xl p-4 border border-gray-800 flex flex-col h-full">
      <div className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center justify-between ${color} bg-gray-900/80 p-2 rounded-lg`}>
         {title}
         <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px]">{posts.filter(p => p.status === status).length}</span>
      </div>
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">
        {posts.filter(p => p.status === status).map(post => (
           <div 
             key={post.id} 
             onClick={() => { setSelectedPost(post); setActiveView('detail'); }}
             className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-sm hover:border-primary-500/50 hover:bg-gray-750 transition-all group cursor-pointer relative"
           >
              <div className="flex justify-between items-start mb-2">
                 <div className={`p-1.5 rounded ${
                    post.platform === 'youtube' ? 'bg-red-900/30 text-red-400' : 
                    post.platform === 'twitter' ? 'bg-blue-900/30 text-blue-400' : 
                    post.platform === 'tiktok' ? 'bg-pink-900/30 text-pink-400' : 
                    'bg-purple-900/30 text-purple-400'
                 }`}>
                    {post.platform === 'youtube' && <Youtube size={14} />}
                    {post.platform === 'twitter' && <Twitter size={14} />}
                    {post.platform === 'tiktok' && <Film size={14} />}
                    {post.platform === 'instagram' && <Instagram size={14} />}
                 </div>
                 <MoreHorizontal size={14} className="text-gray-600"/>
              </div>
              <h4 className="text-sm font-medium text-gray-200 mb-2 line-clamp-2 group-hover:text-white">{post.title}</h4>
              {post.thumbnail && (
                 <div className="relative aspect-video rounded-md overflow-hidden mb-3">
                    <img src={post.thumbnail} alt="thumb" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                 </div>
              )}
              <div className="flex justify-between items-center mt-2">
                 {status === 'idea' && <div className="text-[10px] text-yellow-500 flex items-center gap-1"><Wand2 size={10}/> AI Draft</div>}
                 {status === 'ready' && (
                     <Button size="sm" className="text-[10px] h-6 py-0 px-2" onClick={(e) => handleOpenUpload(post, e)}>
                         Publish
                     </Button>
                 )}
                 {status === 'uploaded' && <div className="text-[10px] text-green-500 flex items-center gap-1"><CheckCircle size={10}/> Live</div>}
                 <span className="text-[10px] text-gray-500">2d ago</span>
              </div>
           </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
       {showUploadModal && <UploadModal />}

       {/* Sidebar */}
       <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-6 shadow-xl z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
             <Clapperboard className="text-red-500" /> Media Studio
          </h2>
          <Button onClick={() => { setSelectedPost(null); setActiveView('create'); }} className="mb-6 w-full shadow-lg shadow-primary-900/20">
             <Plus size={16} className="mr-2" /> New Content
          </Button>

          <div className="space-y-1 mb-6">
             <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">Views</div>
             <button 
               onClick={() => setActiveView('kanban')}
               className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${activeView === 'kanban' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
             >
               <LayoutGrid size={16} /> Pipeline
             </button>
             <button 
               onClick={() => setActiveView('calendar')}
               className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${activeView === 'calendar' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
             >
               <Calendar size={16} /> Schedule
             </button>
          </div>

          <div className="space-y-1">
             <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">Channels</div>
             <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white cursor-pointer transition-colors">
                <Youtube size={16} className="text-red-500" />
                <span className="text-sm font-medium">Omni Official</span>
             </div>
             <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white cursor-pointer transition-colors">
                <Instagram size={16} className="text-pink-500" />
                <span className="text-sm">@omni_dev</span>
             </div>
             <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white cursor-pointer transition-colors">
                <Twitter size={16} className="text-blue-400" />
                <span className="text-sm">@omni_labs</span>
             </div>
          </div>
       </div>

       {/* Main Content */}
       <div className="flex-1 flex flex-col overflow-hidden bg-gray-950 relative">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
          
          {activeView === 'kanban' && (
             <div className="flex-1 p-8 overflow-x-auto">
                <div className="flex gap-6 h-full">
                   <KanbanColumn title="Ideation" status="idea" color="text-yellow-400" />
                   <KanbanColumn title="Scripting" status="scripting" color="text-blue-400" />
                   <KanbanColumn title="In Production" status="generating" color="text-pink-400" />
                   <KanbanColumn title="Ready" status="ready" color="text-green-400" />
                   <KanbanColumn title="Published" status="uploaded" color="text-purple-400" />
                </div>
             </div>
          )}

          {activeView === 'calendar' && <CalendarView />}

          {activeView === 'create' && (
             <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <button className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors" onClick={() => setActiveView('kanban')}>
                      &larr; Back to Pipeline
                   </button>
                   <h1 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">Create Viral Content</h1>
                   <p className="text-gray-400 mb-8">Describe your idea, and Omni will generate the script, visuals, and captions.</p>

                   <div className="grid grid-cols-4 gap-4 mb-6">
                      {['youtube', 'twitter', 'tiktok', 'instagram'].map(p => (
                          <div 
                             key={p} 
                             onClick={() => setSelectedPlatform(p)}
                             className={`p-4 bg-gray-900 border rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer capitalize transition-all duration-200
                                ${selectedPlatform === p ? 'border-primary-500 ring-1 ring-primary-500 bg-gray-800' : 'border-gray-800 hover:border-gray-600 hover:bg-gray-800'}
                             `}
                          >
                             {p === 'youtube' && <Youtube size={24} className={selectedPlatform === p ? 'text-red-500' : ''} />}
                             {p === 'twitter' && <Twitter size={24} className={selectedPlatform === p ? 'text-blue-400' : ''} />}
                             {p === 'tiktok' && <Film size={24} className={selectedPlatform === p ? 'text-pink-500' : ''} />}
                             {p === 'instagram' && <Instagram size={24} className={selectedPlatform === p ? 'text-purple-500' : ''} />}
                             <span className="text-sm font-medium">{p}</span>
                          </div>
                      ))}
                   </div>

                   <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6 shadow-lg">
                      <label className="block text-sm font-medium text-gray-300 mb-2">Content Prompt</label>
                      <textarea 
                        className="w-full h-32 bg-black border border-gray-700 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-primary-500 transition-colors placeholder-gray-600"
                        placeholder="e.g. A 60-second YouTube Short about how to install Omni-Studio, energetic style..."
                        value={newPostPrompt}
                        onChange={(e) => setNewPostPrompt(e.target.value)}
                      />
                   </div>

                   <Button size="lg" className="w-full py-4 text-base" onClick={handleCreateContentPlan} disabled={isGeneratingPlan}>
                      {isGeneratingPlan ? <Loader2 size={20} className="animate-spin mr-2"/> : <Wand2 size={20} className="mr-2" />}
                      {isGeneratingPlan ? 'Generating Magic...' : 'Generate Content Plan'}
                   </Button>
                </div>
             </div>
          )}

          {activeView === 'detail' && selectedPost && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                {/* Header */}
                <div className="h-16 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        <button className="text-gray-500 hover:text-white" onClick={() => setActiveView('kanban')}>
                            <X size={20} />
                        </button>
                        <div>
                            <h2 className="font-bold text-white">{selectedPost.title}</h2>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="capitalize">{selectedPost.platform}</span>
                                <span>•</span>
                                <span className="uppercase">{selectedPost.status}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleSaveDraft}>
                           <Save size={14} className="mr-2" /> Save Draft
                        </Button>
                        <Button variant="secondary" onClick={handleExportPackage} disabled={isExporting}>
                           {isExporting ? <Loader2 size={14} className="animate-spin mr-2"/> : <Download size={14} className="mr-2" />} 
                           Package
                        </Button>
                        <Button onClick={(e) => handleOpenUpload(selectedPost, e)}>
                            <Upload size={16} className="mr-2"/> Publish
                        </Button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Script Editor */}
                    <div className="w-1/2 border-r border-gray-800 bg-gray-900 p-6 overflow-y-auto">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <FileText size={16}/> Script & Captions
                        </h3>
                        <textarea 
                            className="w-full h-[calc(100%-2rem)] bg-black/50 border border-gray-800 rounded-xl p-6 text-gray-300 leading-relaxed focus:outline-none focus:border-gray-600 resize-none font-mono text-sm"
                            defaultValue={selectedPost.script}
                        />
                    </div>

                    {/* Scene Builder */}
                    <div className="w-1/2 bg-gray-950 p-6 overflow-y-auto">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Layout size={16}/> Scene Builder
                        </h3>
                        <div className="space-y-6">
                            {selectedPost.scenes?.map((scene, idx) => (
                                <div key={scene.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                                    <div className="p-3 border-b border-gray-800 bg-gray-850 flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500">SCENE {idx + 1}</span>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => handleGenerateImage(scene.id)}
                                                disabled={scene.status === 'generating'}
                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" 
                                                title="Generate Image"
                                            >
                                                {scene.status === 'generating' ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14}/>}
                                            </button>
                                            <button 
                                                onClick={() => handleGenerateVideo(scene.id)}
                                                disabled={scene.status === 'generating'}
                                                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors" 
                                                title="Generate Video (Veo)"
                                            >
                                                {scene.status === 'generating' ? <Loader2 size={14} className="animate-spin"/> : <Video size={14}/>}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm text-gray-300 mb-4">{scene.description}</p>
                                        
                                        {/* Visual Placeholder or Result */}
                                        <div className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden group border border-gray-800">
                                            {scene.videoUrl ? (
                                                <video src={scene.videoUrl} controls className="w-full h-full object-cover" />
                                            ) : scene.imageUrl ? (
                                                <img src={scene.imageUrl} alt="scene" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-gray-700 flex flex-col items-center gap-2">
                                                    <Sparkles size={24} />
                                                    <span className="text-xs">No visuals generated</span>
                                                </div>
                                            )}
                                            
                                            {/* Overlay for empty state actions */}
                                            {!scene.imageUrl && !scene.videoUrl && !scene.status.includes('generating') && (
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button size="sm" onClick={() => handleGenerateImage(scene.id)}>Gen Image</Button>
                                                    <Button size="sm" variant="secondary" onClick={() => handleGenerateVideo(scene.id)}>Gen Video</Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button className="w-full py-3 border-2 border-dashed border-gray-800 rounded-xl text-gray-600 hover:border-gray-600 hover:text-gray-400 transition-all flex items-center justify-center gap-2">
                                <Plus size={16} /> Add Scene
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          )}
       </div>
    </div>
  );
};
