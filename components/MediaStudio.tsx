
import React, { useState, useEffect, useRef } from 'react';
import { Clapperboard, Plus, Upload, Image as ImageIcon, Wand2, X, Video, Loader2, Sparkles, Save, Calendar, LayoutGrid, FileText, Target, Scissors, Grid, Briefcase, Lightbulb, Menu, ArrowRightLeft, Sliders, Clock, Settings, Monitor, Volume2, BrainCircuit } from 'lucide-react';
import { Button } from './Button';
import { MOCK_SOCIAL_POSTS, MOCK_VOICES } from '../constants';
import { SocialPost, Scene, Character, ReferenceAsset, AudioTrack, ContentStrategy, Voice } from '../types';
import { generateSocialContent, generateImage, generateVideo, analyzeMediaStyle, removeBackground, analyzeCharacterFeatures, editImage, generateSpeech, generateSoundEffect, generateSong, generateBackgroundMusic, generateAudioPrompt } from '../services/geminiService';
import { MediaKanban } from './MediaKanban';
import { MediaCalendar } from './MediaCalendar';
import { MediaStrategy } from './MediaStrategy';
import { MediaDirectorView } from './MediaDirectorView';
import { MediaProTools } from './MediaProTools';
import { MediaAssetsLibrary } from './MediaAssetsLibrary';
import { MediaScriptEditor } from './MediaScriptEditor';
import { MediaIdeaGenerator } from './MediaIdeaGenerator';
import { MediaBrainstorm } from './MediaBrainstorm';
import { useDebounce } from '../hooks/useDebounce';
import JSZip from 'jszip';

export const MediaStudio: React.FC = () => {
  const [posts, setPosts] = useState<SocialPost[]>(() => {
    try {
      const saved = localStorage.getItem('omni_social_posts');
      return saved ? JSON.parse(saved) : MOCK_SOCIAL_POSTS;
    } catch (e) {
      return MOCK_SOCIAL_POSTS;
    }
  });
  
  const [strategy, setStrategy] = useState<ContentStrategy>(() => {
      try {
        const saved = localStorage.getItem('omni_media_strategy');
        return saved ? JSON.parse(saved) : { targetAudience: '', primaryGoal: 'engagement', contentPillars: [], toneVoice: '', postingFrequency: 'daily' };
      } catch (e) {
        return { targetAudience: '', primaryGoal: 'engagement', contentPillars: [], toneVoice: '', postingFrequency: 'daily' };
      }
  });

  const [activeView, setActiveView] = useState<'kanban' | 'calendar' | 'create' | 'detail' | 'strategy' | 'assets' | 'generator' | 'brainstorm'>('kanban');
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Brand Management
  const [brands, setBrands] = useState<string[]>(['Nike', 'TechStart', 'Personal']);
  const [activeBrand, setActiveBrand] = useState<string>('Personal');
  const [showBrandMenu, setShowBrandMenu] = useState(false);

  // Detail View Tab
  const [detailTab, setDetailTab] = useState<'script' | 'timeline' | 'pro'>('timeline');

  // Brainstorm Context passing
  const [mindMapContext, setMindMapContext] = useState<string>('');

  // Creation State
  const [newPostPrompt, setNewPostPrompt] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('youtube');

  // Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Preview State
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // Magic Edit State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);

  // Trim Modal State
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [trimSceneId, setTrimSceneId] = useState<string | null>(null);
  const [trimValues, setTrimValues] = useState({ start: 0, duration: 5 });

  // Pro Studio State
  const [characterName, setCharacterName] = useState('');
  const [isAnalyzingChar, setIsAnalyzingChar] = useState(false);
  
  // Audio Integration State
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [voices, setVoices] = useState<Voice[]>(() => {
    try {
        const saved = localStorage.getItem('omni_voices');
        return saved ? JSON.parse(saved) : MOCK_VOICES;
    } catch (e) {
        return MOCK_VOICES;
    }
  });

  const debouncedPosts = useDebounce(posts, 1000);
  const debouncedStrategy = useDebounce(strategy, 1000);

  useEffect(() => {
    const savePosts = () => {
        try {
            localStorage.setItem('omni_social_posts', JSON.stringify(debouncedPosts));
        } catch (e) {
            // QuotaExceededError handling
            console.warn("Storage quota exceeded. Saving light version of posts.");
            const lightPosts = debouncedPosts.map(p => ({
                ...p,
                // Remove heavy base64 data from scenes/assets for storage
                scenes: p.scenes?.map(s => ({
                    ...s,
                    imageUrl: s.imageUrl?.startsWith('data:') ? undefined : s.imageUrl,
                    videoUrl: s.videoUrl?.startsWith('data:') ? undefined : s.videoUrl
                })),
                characters: p.characters?.map(c => ({
                    ...c,
                    imageUrl: c.imageUrl?.startsWith('data:') ? undefined : c.imageUrl
                })),
                styleReferences: p.styleReferences?.map(r => ({
                    ...r,
                    url: r.url?.startsWith('data:') ? undefined : r.url
                }))
            }));
            try {
                localStorage.setItem('omni_social_posts', JSON.stringify(lightPosts));
            } catch (err) {
                console.error("Critical: Storage full even for metadata.", err);
            }
        }
        window.dispatchEvent(new Event('omniAssetsUpdated')); 
    };
    savePosts();
  }, [debouncedPosts]);

  useEffect(() => {
    try {
        localStorage.setItem('omni_media_strategy', JSON.stringify(debouncedStrategy));
    } catch (e) { console.error("Strategy save failed", e); }
  }, [debouncedStrategy]);

  // Timeline Player Logic
  useEffect(() => {
      let interval: any;
      if (isPreviewPlaying) {
          interval = setInterval(() => {
              setCurrentTime(prev => {
                  const totalDuration = selectedPost?.scenes?.reduce((acc, s) => acc + (s.duration || 5), 0) || 10;
                  if (prev >= totalDuration) {
                      setIsPreviewPlaying(false);
                      return 0;
                  }
                  return prev + 0.1;
              });
          }, 100);
      }
      return () => clearInterval(interval);
  }, [isPreviewPlaying, selectedPost]);

  const handleAddBrand = () => {
      const name = prompt("Enter new brand name:");
      if (name && name.trim()) {
          if (!brands.includes(name.trim())) {
              setBrands([...brands, name.trim()]);
              setActiveBrand(name.trim());
          }
      }
  };

  const handleCreatePost = (post: SocialPost) => {
      setPosts([post, ...posts]);
      setSelectedPost(post);
      setActiveView('detail');
  };

  const handleUpdatePost = (updates: Partial<SocialPost>) => {
      if (selectedPost) {
          const updated = { ...selectedPost, ...updates, lastModified: new Date().toISOString() };
          setPosts(posts.map(p => p.id === selectedPost.id ? updated : p));
          setSelectedPost(updated);
      }
  };

  const handleUpdateScene = (sceneId: string, updates: Partial<Scene>) => {
      if (selectedPost) {
          const newScenes = selectedPost.scenes?.map(s => s.id === sceneId ? { ...s, ...updates } : s);
          handleUpdatePost({ scenes: newScenes });
      }
  };

  const handleMagicEdit = async () => {
      if (!selectedPost || !editSceneId || !editPrompt) return;
      
      const scene = selectedPost.scenes?.find(s => s.id === editSceneId);
      if (!scene || !scene.imageUrl) return;

      setIsEditingImage(true);
      const newImage = await editImage(scene.imageUrl, editPrompt);
      
      if (newImage) {
          handleUpdateScene(editSceneId, { imageUrl: newImage });
          setEditModalOpen(false);
          setEditPrompt('');
      } else {
          alert('Failed to edit image.');
      }
      setIsEditingImage(false);
  };

  const handleTrimScene = () => {
      if (!trimSceneId) return;
      handleUpdateScene(trimSceneId, { duration: trimValues.duration });
      setTrimModalOpen(false);
  };

  const handleGenerateImage = async (sceneId: string) => {
      const scene = selectedPost?.scenes?.find(s => s.id === sceneId);
      if (!scene) return;
      
      handleUpdateScene(sceneId, { status: 'generating' });
      
      let prompt = scene.description;
      const char = selectedPost?.characters?.[0];
      const style = selectedPost?.styleReferences?.[0];
      
      if (char) prompt += `. Character: ${char.name}, ${char.description || ''}`;
      if (style) prompt += `. Visual Style: ${style.stylePrompt || 'Cinematic'}`;

      const img = await generateImage(prompt);
      if (img) {
          handleUpdateScene(sceneId, { imageUrl: img, status: 'done' });
      } else {
          handleUpdateScene(sceneId, { status: 'pending' });
      }
  };

  const handleGenerateVideo = async (sceneId: string) => {
      const scene = selectedPost?.scenes?.find(s => s.id === sceneId);
      if (!scene) return;
      
      handleUpdateScene(sceneId, { status: 'generating' });
      
      try {
          // Service handles API Key selection and polling logic
          const video = await generateVideo(scene.description, scene.imageUrl);
          if (video) {
              handleUpdateScene(sceneId, { videoUrl: video, status: 'done' });
          } else {
              handleUpdateScene(sceneId, { status: 'pending' });
              alert("Video generation returned no result. Please try again.");
          }
      } catch (e) {
          console.error("Video Generation Failed", e);
          handleUpdateScene(sceneId, { status: 'pending' });
          alert("Video generation failed. Please ensure you have selected a valid API key with Veo access.");
      }
  };

  const handleGenerateAudio = async (sceneId: string, type: 'voice' | 'sfx' | 'music', prompt: string, voiceId?: string) => {
      let audioUrl = '';
      if (type === 'voice' && voiceId) {
          const voice = voices.find(v => v.id === voiceId);
          if (voice) {
              audioUrl = await generateSpeech(prompt, voice);
          }
      } else if (type === 'sfx') {
          audioUrl = await generateSoundEffect(prompt);
      } else if (type === 'music') {
          audioUrl = await generateBackgroundMusic(prompt);
      }

      // Estimate duration
      const estimatedDuration = Math.max(2, prompt.length / 15);

      if (audioUrl) {
          const newTrack: AudioTrack = {
              id: `tr-${Date.now()}`,
              name: `${type.toUpperCase()}: ${prompt.substring(0,10)}`,
              type: type === 'voice' ? 'voiceover' : type === 'sfx' ? 'sfx' : 'music',
              duration: parseFloat(estimatedDuration.toFixed(1)),
              startOffset: currentTime,
              audioUrl,
              volume: 1.0,
              muted: false
          };
          setAudioTracks([...audioTracks, newTrack]);
      }
  };

  const handleUpdateAudioTrack = (trackId: string, updates: Partial<AudioTrack>) => {
      setAudioTracks(prev => prev.map(t => t.id === trackId ? { ...t, ...updates } : t));
  };

  const handleDeleteAudioTrack = (trackId: string) => {
      setAudioTracks(prev => prev.filter(t => t.id !== trackId));
  };

  const handleAutoGenerateAudioPrompt = async (type: 'voice' | 'sfx' | 'music', sceneId: string): Promise<string> => {
      const scene = selectedPost?.scenes?.find(s => s.id === sceneId);
      if (!scene) return "";
      return await generateAudioPrompt(scene.description, type);
  };

  const handleBrainstormToCampaign = (context: string) => {
      setMindMapContext(context);
      setActiveView('generator');
  };

  const handleRenderMovie = async () => {
      if (!selectedPost) return;
      setIsRendering(true);
      setRenderProgress(0);
      
      try {
          const zip = new JSZip();
          const folder = zip.folder(selectedPost.title.replace(/\s+/g, '_') || 'project');
          
          // 1. Add Manifest
          folder?.file('timeline.json', JSON.stringify(selectedPost, null, 2));
          setRenderProgress(10);

          // 2. Add Script
          if (selectedPost.script) {
              folder?.file('script.txt', selectedPost.script);
          }
          setRenderProgress(20);

          // 3. Add Assets (Images/Videos)
          let completed = 0;
          const assets = selectedPost.scenes?.filter(s => s.imageUrl || s.videoUrl) || [];
          const audio = audioTracks.filter(t => t.audioUrl);
          
          const totalAssets = assets.length + audio.length;
          
          if (totalAssets > 0) {
              // Helper to fetch blob
              const fetchAsset = async (url: string, filename: string) => {
                  if (url.startsWith('data:')) {
                      const base64Data = url.split(',')[1];
                      folder?.file(filename, base64Data, {base64: true});
                  } else {
                      try {
                          const res = await fetch(url);
                          const blob = await res.blob();
                          folder?.file(filename, blob);
                      } catch (e) { console.error("Failed to fetch asset", filename); }
                  }
                  completed++;
                  setRenderProgress(20 + Math.floor((completed / totalAssets) * 60));
              };

              await Promise.all([
                  ...assets.map((s, i) => {
                      const ext = s.videoUrl ? 'mp4' : 'png';
                      const url = s.videoUrl || s.imageUrl!;
                      return fetchAsset(url, `scene_${i + 1}.${ext}`);
                  }),
                  ...audio.map((t, i) => {
                      return fetchAsset(t.audioUrl!, `audio/track_${i + 1}.wav`);
                  })
              ]);
          }
          
          setRenderProgress(90);
          
          // 4. Generate Zip
          const content = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(content);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedPost.title || 'movie'}_render.zip`;
          a.click();
          
          URL.revokeObjectURL(url);
          setRenderProgress(100);
          alert("Render Complete! Project assets downloaded.");
          
      } catch (e) {
          console.error("Render failed", e);
          alert("Render failed. Check console.");
      }
      
      setIsRendering(false);
      setRenderProgress(0);
  };

  const handleAddScene = () => {
      if (!selectedPost) return;
      const newScene: Scene = {
          id: `s-${Date.now()}`,
          description: 'New Scene',
          status: 'pending',
          duration: 5,
          transition: 'cut'
      };
      const newScenes = [...(selectedPost.scenes || []), newScene];
      handleUpdatePost({ scenes: newScenes });
  };

  const handleSplitScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      const scene = scenes[index];
      const newDuration = (scene.duration || 5) / 2;
      
      const scene1 = { ...scene, duration: newDuration };
      const scene2 = { ...scene, id: `s-${Date.now()}`, duration: newDuration };
      
      scenes.splice(index, 1, scene1, scene2);
      handleUpdatePost({ scenes });
  };

  const handleDuplicateScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      const scene = scenes[index];
      const newScene = { ...scene, id: `s-${Date.now()}` };
      scenes.splice(index + 1, 0, newScene);
      handleUpdatePost({ scenes });
  };

  const handleDeleteScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      scenes.splice(index, 1);
      handleUpdatePost({ scenes });
  };

  const handleReorderScenes = (from: number, to: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      if (to < 0 || to >= scenes.length) return;
      const [moved] = scenes.splice(from, 1);
      scenes.splice(to, 0, moved);
      handleUpdatePost({ scenes });
  };

  const handleCreateMontage = (assets: any[]) => {
      const newScenes: Scene[] = assets.map((a, i) => ({
          id: `m-${Date.now()}-${i}`,
          description: a.description,
          status: 'done',
          duration: 3,
          transition: 'fade',
          imageUrl: a.type === 'image' ? a.url : undefined,
          videoUrl: a.type === 'video' ? a.url : undefined
      }));
      
      const newPost: SocialPost = {
          id: `montage-${Date.now()}`,
          title: 'New Montage',
          platform: 'instagram',
          status: 'idea',
          scenes: newScenes,
          lastModified: new Date().toISOString()
      };
      
      handleCreatePost(newPost);
  };

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
        {/* Mobile Sidebar Toggle & Header */}
        <div className="md:hidden p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-50">
            <div className="flex items-center gap-2">
                <button onClick={() => setIsSidebarOpen(true)} className="text-gray-400 hover:text-white">
                    <Menu size={24} />
                </button>
                <span className="font-bold">Media Studio</span>
            </div>
            {selectedPost && (
                <button onClick={() => setActiveView('kanban')} className="text-xs text-gray-400">Back</button>
            )}
        </div>

        {/* Sidebar */}
        {isSidebarOpen && (
            <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
        )}
        <div className={`
            fixed inset-y-0 left-0 z-50 bg-gray-900 border-r border-gray-800 w-64 transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <div className="p-4 border-b border-gray-800 hidden md:block">
                <div className="flex items-center gap-2 font-bold text-lg text-white">
                    <Clapperboard className="text-pink-500" /> Media Studio
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto py-2">
                <div className="px-4 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Workflow</div>
                <nav className="space-y-1 px-2">
                    <button onClick={() => { setActiveView('kanban'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'kanban' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                        <LayoutGrid size={16} /> Production Board
                    </button>
                    <button onClick={() => { setActiveView('calendar'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'calendar' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                        <Calendar size={16} /> Schedule
                    </button>
                    <button onClick={() => { setActiveView('assets'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'assets' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                        <Grid size={16} /> Asset Library
                    </button>
                </nav>

                <div className="mt-6 px-4 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Strategy</div>
                <nav className="space-y-1 px-2">
                    <button onClick={() => { setActiveView('brainstorm'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'brainstorm' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                        <BrainCircuit size={16} /> Brainstorming
                    </button>
                    <button onClick={() => { setActiveView('generator'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'generator' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                        <Lightbulb size={16} /> Idea Generator
                    </button>
                    <button onClick={() => { setActiveView('strategy'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'strategy' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                        <Target size={16} /> Brand Strategy
                    </button>
                </nav>

                <div className="mt-6 px-4 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Brands</div>
                <div className="px-2 space-y-1">
                    {brands.map(brand => (
                        <button key={brand} onClick={() => setActiveBrand(brand)} className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex items-center justify-between ${activeBrand === brand ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                            {brand}
                            {activeBrand === brand && <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>}
                        </button>
                    ))}
                    <button onClick={handleAddBrand} className="w-full text-left px-3 py-1.5 rounded-md text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:bg-gray-800">
                        <Plus size={12} /> Add Brand
                    </button>
                </div>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900 overflow-hidden">
            {activeView === 'kanban' && <MediaKanban posts={posts} onSelectPost={(p) => { setSelectedPost(p); setActiveView('detail'); }} />}
            {activeView === 'calendar' && <MediaCalendar posts={posts} onSelectPost={(p) => { setSelectedPost(p); setActiveView('detail'); }} />}
            {activeView === 'strategy' && <MediaStrategy strategy={strategy} setStrategy={setStrategy} />}
            {activeView === 'assets' && <MediaAssetsLibrary posts={posts} onCreateMontage={handleCreateMontage} />}
            {activeView === 'generator' && <MediaIdeaGenerator onCreatePost={handleCreatePost} activeBrandId={activeBrand} brands={brands} mindMapContext={mindMapContext} />}
            {activeView === 'brainstorm' && <MediaBrainstorm onConvertToCampaign={handleBrainstormToCampaign} />}
            
            {activeView === 'detail' && selectedPost && (
                <div className="flex flex-col h-full">
                    {/* Detail Header */}
                    <div className="h-14 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setActiveView('kanban')} className="text-gray-400 hover:text-white md:hidden">Back</button>
                            <h2 className="font-bold text-white truncate max-w-[200px] md:max-w-md">{selectedPost.title}</h2>
                            <div className="flex bg-gray-800 rounded p-0.5">
                                <button onClick={() => setDetailTab('script')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${detailTab === 'script' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Script</button>
                                <button onClick={() => setDetailTab('timeline')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${detailTab === 'timeline' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Timeline</button>
                                <button onClick={() => setDetailTab('pro')} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${detailTab === 'pro' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Pro Studio</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 uppercase font-bold hidden md:block">{selectedPost.status}</span>
                            <Button size="sm" variant="secondary" className="hidden md:flex" onClick={handleRenderMovie}>
                                {isRendering ? <Loader2 size={14} className="animate-spin mr-2"/> : <Upload size={14} className="mr-2"/>} 
                                Export
                            </Button>
                        </div>
                    </div>

                    {/* Detail Content */}
                    <div className="flex-1 overflow-hidden relative">
                        {detailTab === 'timeline' && (
                            <MediaDirectorView 
                                selectedPost={selectedPost}
                                audioTracks={audioTracks}
                                currentTime={currentTime}
                                setCurrentTime={setCurrentTime}
                                isPreviewPlaying={isPreviewPlaying}
                                setIsPreviewPlaying={setIsPreviewPlaying}
                                isRendering={isRendering}
                                renderProgress={renderProgress}
                                onSelectAudio={() => {}}
                                onUndo={() => {}}
                                onRedo={() => {}}
                                onRenderMovie={handleRenderMovie}
                                onGenerateImage={handleGenerateImage}
                                onGenerateVideo={handleGenerateVideo}
                                onGenerateAudio={handleGenerateAudio}
                                onSplitScene={handleSplitScene}
                                onDuplicateScene={handleDuplicateScene}
                                onDeleteScene={handleDeleteScene}
                                onOpenTrim={() => setTrimModalOpen(true)}
                                onOpenMagicEdit={(id) => { setEditSceneId(id); setEditModalOpen(true); }}
                                onUpdateScene={handleUpdateScene}
                                onReorderScenes={handleReorderScenes}
                                cycleTransition={(t) => t === 'cut' ? 'fade' : 'cut'}
                                historyIndex={0}
                                historyLength={0}
                                onAddScene={handleAddScene}
                                voices={voices}
                                onAutoGenerateAudioPrompt={handleAutoGenerateAudioPrompt}
                                onUpdateAudioTrack={handleUpdateAudioTrack}
                                onDeleteAudioTrack={handleDeleteAudioTrack}
                            />
                        )}
                        {detailTab === 'script' && (
                            <MediaScriptEditor 
                                script={selectedPost.script || ''} 
                                onUpdateScript={(s) => handleUpdatePost({ script: s })}
                                onSyncToTimeline={(scenes) => handleUpdatePost({ scenes })}
                                platform={selectedPost.platform}
                            />
                        )}
                        {detailTab === 'pro' && (
                            <MediaProTools 
                                selectedPost={selectedPost}
                                characterName={characterName}
                                setCharacterName={setCharacterName}
                                isAnalyzingChar={isAnalyzingChar}
                                onUploadCharacter={async (e) => {
                                    const file = e.target.files?.[0];
                                    if(file) {
                                        setIsAnalyzingChar(true);
                                        const reader = new FileReader();
                                        reader.onload = async (ev) => {
                                            const base64 = ev.target?.result as string;
                                            const desc = await analyzeCharacterFeatures(base64);
                                            const newChar: Character = {
                                                id: `char-${Date.now()}`,
                                                name: characterName || 'New Character',
                                                imageUrl: base64,
                                                description: desc,
                                                isAvatar: true
                                            };
                                            handleUpdatePost({ characters: [...(selectedPost.characters || []), newChar] });
                                            setIsAnalyzingChar(false);
                                            setCharacterName('');
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                onUploadReference={async (e) => {
                                    const file = e.target.files?.[0];
                                    if(file) {
                                        const reader = new FileReader();
                                        reader.onload = async (ev) => {
                                            const base64 = ev.target?.result as string;
                                            const style = await analyzeMediaStyle(base64, 'image');
                                            const newRef: ReferenceAsset = {
                                                id: `ref-${Date.now()}`,
                                                type: 'image',
                                                url: base64,
                                                stylePrompt: style
                                            };
                                            handleUpdatePost({ styleReferences: [...(selectedPost.styleReferences || []), newRef] });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                onUpdatePost={handleUpdatePost}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Modals */}
        {editModalOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Wand2 className="text-purple-500"/> Magic Edit</h3>
                    <textarea 
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none h-32 resize-none mb-4"
                        placeholder="Describe changes (e.g., 'Make it raining', 'Add a cyberpunk neon sign')..."
                        value={editPrompt}
                        onChange={e => setEditPrompt(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleMagicEdit} disabled={isEditingImage || !editPrompt}>
                            {isEditingImage ? <Loader2 size={16} className="animate-spin mr-2"/> : <Sparkles size={16} className="mr-2"/>} Apply Magic
                        </Button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
