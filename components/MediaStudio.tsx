import React, { useState, useEffect } from 'react';
import { Clapperboard, Plus, Menu, LayoutGrid, Calendar, Target, Lightbulb, Grid, BrainCircuit } from 'lucide-react';
import { SocialPost, Character, ReferenceAsset, AudioTrack, ContentStrategy, Voice, Scene } from '../types';
import { MOCK_VOICES } from '../constants';
import { generateImage, generateVideo, analyzeMediaStyle, analyzeCharacterFeatures, editImage, generateSpeech, generateSoundEffect, generateBackgroundMusic, generateAudioPrompt } from '../services/geminiService';
import { MediaKanban } from './MediaKanban';
import { MediaCalendar } from './MediaCalendar';
import { MediaStrategy } from './MediaStrategy';
import { MediaDirectorView } from './MediaDirectorView';
import { MediaProTools } from './MediaProTools';
import { MediaAssetsLibrary } from './MediaAssetsLibrary';
import { MediaScriptEditor } from './MediaScriptEditor';
import { MediaIdeaGenerator } from './MediaIdeaGenerator';
import { MediaBrainstorm } from './MediaBrainstorm';
import { MediaStoryboard } from './MediaStoryboard';
import { useDebounce } from '../hooks/useDebounce';
import { useMediaProject } from '../hooks/useMediaProject';
import { useMediaTime } from '../hooks/useMediaTime';
import JSZip from 'jszip';

export const MediaStudio: React.FC = () => {
  // Use Custom Hook for Project Data
  const { 
      posts, setPosts, selectedPost, setSelectedPost, 
      createPost, updatePost, updateScene, addScene, deleteScene, duplicateScene, reorderScenes,
      brands, addBrand
  } = useMediaProject();

  const [strategy, setStrategy] = useState<ContentStrategy>(() => {
      try {
        const saved = localStorage.getItem('omni_media_strategy');
        return saved ? JSON.parse(saved) : { targetAudience: '', primaryGoal: 'engagement', contentPillars: [], toneVoice: '', postingFrequency: 'daily' };
      } catch {
        return { targetAudience: '', primaryGoal: 'engagement', contentPillars: [], toneVoice: '', postingFrequency: 'daily' };
      }
  });

  // Mind Map Persistence
  const [mindMapNodes, setMindMapNodes] = useState<any[]>(() => {
      try {
          const saved = localStorage.getItem('omni_mindmap_nodes');
          return saved ? JSON.parse(saved) : [{ id: 'root', text: 'Central Brand Theme', x: 0, y: 0, type: 'root' }];
      } catch {
          return [{ id: 'root', text: 'Central Brand Theme', x: 0, y: 0, type: 'root' }];
      }
  });

  const debouncedNodes = useDebounce(mindMapNodes, 1000);

  useEffect(() => {
      localStorage.setItem('omni_mindmap_nodes', JSON.stringify(debouncedNodes));
  }, [debouncedNodes]);

  const [activeView, setActiveView] = useState<'kanban' | 'calendar' | 'create' | 'detail' | 'strategy' | 'assets' | 'generator' | 'brainstorm'>('kanban');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeBrand, setActiveBrand] = useState<string>('Personal');
  const [detailTab, setDetailTab] = useState<'script' | 'timeline' | 'storyboard' | 'pro'>('timeline');
  const [mindMapContext, setMindMapContext] = useState<string>('');

  // Player State via Hook
  const sceneDuration = selectedPost?.scenes?.reduce((acc, s) => acc + (s.duration || 5), 0) || 10;
  const { isPlaying: isPreviewPlaying, setIsPlaying: setIsPreviewPlaying, currentTime, setCurrentTime } = useMediaTime(sceneDuration);

  // Other UI State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [trimSceneId, setTrimSceneId] = useState<string | null>(null);
  const [trimValues, setTrimValues] = useState({ start: 0, duration: 5 });
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [characterName, setCharacterName] = useState('');
  const [isAnalyzingChar, setIsAnalyzingChar] = useState(false);
  
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [voices] = useState<Voice[]>(MOCK_VOICES);

  const debouncedStrategy = useDebounce(strategy, 1000);

  useEffect(() => {
    localStorage.setItem('omni_media_strategy', JSON.stringify(debouncedStrategy));
  }, [debouncedStrategy]);

  const handleAddBrand = () => {
      const name = prompt("Enter new brand name:");
      if (name && name.trim()) {
          addBrand(name.trim());
          setActiveBrand(name.trim());
      }
  };

  const handleCreatePostWrapper = (post: SocialPost) => {
      createPost(post);
      setActiveView('detail');
  };

  const handleMagicEdit = async () => {
      if (!selectedPost || !editSceneId || !editPrompt) return;
      const scene = selectedPost.scenes?.find(s => s.id === editSceneId);
      if (!scene || !scene.imageUrl) return;

      setIsEditingImage(true);
      const newImage = await editImage(scene.imageUrl, editPrompt);
      if (newImage) {
          updateScene(editSceneId, { imageUrl: newImage });
          setEditModalOpen(false);
          setEditPrompt('');
      } else {
          alert('Failed to edit image.');
      }
      setIsEditingImage(false);
  };

  const handleOpenTrim = (sceneId: string) => {
      const scene = selectedPost?.scenes?.find(s => s.id === sceneId);
      if (scene) {
          setTrimSceneId(sceneId);
          setTrimValues({ start: 0, duration: scene.duration || 5 });
          setTrimModalOpen(true);
      }
  };

  const handleTrimScene = () => {
      if (!trimSceneId) return;
      updateScene(trimSceneId, { duration: trimValues.duration });
      setTrimModalOpen(false);
  };

  const handleGenerateImage = async (sceneId: string) => {
      const scene = selectedPost?.scenes?.find(s => s.id === sceneId);
      if (!scene) return;
      
      updateScene(sceneId, { status: 'generating' });
      let prompt = scene.description;
      const char = selectedPost?.characters?.[0];
      const style = selectedPost?.styleReferences?.[0];
      if (char) prompt += `. Character: ${char.name}, ${char.description || ''}`;
      if (style) prompt += `. Visual Style: ${style.stylePrompt || 'Cinematic'}`;

      const img = await generateImage(prompt);
      updateScene(sceneId, { imageUrl: img || undefined, status: img ? 'done' : 'pending' });
  };

  const handleGenerateVideo = async (sceneId: string) => {
      const scene = selectedPost?.scenes?.find(s => s.id === sceneId);
      if (!scene) return;
      updateScene(sceneId, { status: 'generating' });
      try {
          const video = await generateVideo(scene.description, scene.imageUrl);
          updateScene(sceneId, { videoUrl: video || undefined, status: video ? 'done' : 'pending' });
      } catch {
          updateScene(sceneId, { status: 'pending' });
      }
  };

  const handleGenerateAudio = async (sceneId: string, type: 'voice' | 'sfx' | 'music', prompt: string, voiceId?: string) => {
      let audioUrl = '';
      if (type === 'voice' && voiceId) {
          const voice = voices.find(v => v.id === voiceId);
          if (voice) audioUrl = await generateSpeech(prompt, voice);
      } else if (type === 'sfx') {
          audioUrl = await generateSoundEffect(prompt);
      } else if (type === 'music') {
          audioUrl = await generateBackgroundMusic(prompt);
      }

      if (audioUrl) {
          setAudioTracks([...audioTracks, {
              id: `tr-${Date.now()}`,
              name: `${type.toUpperCase()}: ${prompt.substring(0,10)}`,
              type: type === 'voice' ? 'voiceover' : type === 'sfx' ? 'sfx' : 'music',
              duration: Math.max(2, prompt.length / 15),
              startOffset: currentTime,
              audioUrl,
              volume: 1.0,
              muted: false
          }]);
      }
  };

  const handleAutoGenerateAudioPrompt = async (type: 'voice' | 'sfx' | 'music', sceneId: string): Promise<string> => {
      const scene = selectedPost?.scenes?.find(s => s.id === sceneId);
      return scene ? await generateAudioPrompt(scene.description, type) : "";
  };

  const handleRenderMovie = async () => {
      if (!selectedPost) return;
      setIsRendering(true);
      setRenderProgress(10);
      
      try {
          const zip = new JSZip();
          const folder = zip.folder(selectedPost.title.replace(/\s+/g, '_') || 'project');
          folder?.file('timeline.json', JSON.stringify(selectedPost, null, 2));
          
          const assets = selectedPost.scenes?.filter(s => s.imageUrl || s.videoUrl) || [];
          const audio = audioTracks.filter(t => t.audioUrl);
          const totalAssets = assets.length + audio.length;
          let completed = 0;

          if (totalAssets > 0) {
              const fetchAsset = async (url: string, filename: string) => {
                  if (url.startsWith('data:')) {
                      folder?.file(filename, url.split(',')[1], {base64: true});
                  } else {
                      try {
                          const res = await fetch(url);
                          folder?.file(filename, await res.blob());
                      } catch (e) { console.error("Asset fetch failed", filename); }
                  }
                  completed++;
                  setRenderProgress(20 + Math.floor((completed / totalAssets) * 60));
              };

              await Promise.all([
                  ...assets.map((s, i) => fetchAsset(s.videoUrl || s.imageUrl!, `scene_${i + 1}.${s.videoUrl ? 'mp4' : 'png'}`)),
                  ...audio.map((t, i) => fetchAsset(t.audioUrl!, `audio/track_${i + 1}.wav`))
              ]);
          }
          
          const content = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedPost.title}_render.zip`;
          a.click();
          URL.revokeObjectURL(url);
          setRenderProgress(100);
          alert("Render Complete! Downloaded ZIP.");
      } catch {
          alert("Render failed.");
      }
      setIsRendering(false);
      setRenderProgress(0);
  };

  const handleSplitScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      const scene = scenes[index];
      const newDuration = (scene.duration || 5) / 2;
      scenes.splice(index, 1, { ...scene, duration: newDuration }, { ...scene, id: `s-${Date.now()}`, duration: newDuration });
      updatePost({ scenes });
  };

  const handleCreateMontage = (assets: any[]) => {
      const newScenes = assets.map((a, i) => ({
          id: `m-${Date.now()}-${i}`,
          description: a.description,
          status: 'done' as const,
          duration: 3,
          transition: 'fade' as const,
          imageUrl: a.type === 'image' ? a.url : undefined,
          videoUrl: a.type === 'video' ? a.url : undefined
      }));
      createPost({
          id: `montage-${Date.now()}`,
          title: 'New Montage',
          platform: 'instagram',
          status: 'idea',
          scenes: newScenes,
          lastModified: new Date().toISOString(),
          brandId: activeBrand // Assign current active brand
      });
  };

  const handlePublish = () => {
      setIsPublishing(true);
      setTimeout(() => {
          updatePost({ status: 'uploaded' });
          setIsPublishing(false);
          setPublishModalOpen(false);
          alert(`Successfully published to ${selectedPost?.platform}!`);
      }, 2000);
  };

  const handleBatchDelete = (indices: number[]) => {
      if (!selectedPost?.scenes) return;
      // Filter out indices to delete
      const newScenes = selectedPost.scenes.filter((_, i) => !indices.includes(i));
      updatePost({ scenes: newScenes });
  };

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
        {/* Sidebar */}
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
                    {[
                        { id: 'kanban', label: 'Production Board', icon: LayoutGrid },
                        { id: 'calendar', label: 'Schedule', icon: Calendar },
                        { id: 'assets', label: 'Asset Library', icon: Grid },
                    ].map(item => (
                        <button key={item.id} onClick={() => { setActiveView(item.id as any); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === item.id ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                            <item.icon size={16} /> {item.label}
                        </button>
                    ))}
                </nav>

                <div className="mt-6 px-4 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Strategy</div>
                <nav className="space-y-1 px-2">
                    <button onClick={() => { setActiveView('brainstorm'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'brainstorm' ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                        <BrainCircuit size={16} /> Brainstorming
                    </button>
                    <button onClick={() => { setActiveView('generator'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'generator' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                        <Lightbulb size={16} /> Idea Generator
                    </button>
                    <button onClick={() => { setActiveView('strategy'); setIsSidebarOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${activeView === 'strategy' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                        <Target size={16} /> Brand Strategy
                    </button>
                </nav>

                <div className="mt-6 px-4 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Brands</div>
                <div className="px-2 space-y-1">
                    {brands.map(brand => (
                        <button key={brand} onClick={() => setActiveBrand(brand)} className={`w-full text-left px-3 py-1.5 rounded-md text-xs flex items-center justify-between ${activeBrand === brand ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                            {brand} {activeBrand === brand && <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>}
                        </button>
                    ))}
                    <button onClick={handleAddBrand} className="w-full text-left px-3 py-1.5 rounded-md text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:bg-gray-800"><Plus size={12} /> Add Brand</button>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-900 overflow-hidden">
            <div className="md:hidden p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-50">
                <button onClick={() => setIsSidebarOpen(true)} className="text-gray-400"><Menu size={24} /></button>
                <span className="font-bold">Media Studio</span>
                {selectedPost && <button onClick={() => setActiveView('kanban')} className="text-xs text-gray-400">Back</button>}
            </div>

            {activeView === 'kanban' && <MediaKanban posts={posts} onSelectPost={(p) => { setSelectedPost(p); setActiveView('detail'); }} />}
            {activeView === 'calendar' && <MediaCalendar posts={posts} onSelectPost={(p) => { setSelectedPost(p); setActiveView('detail'); }} />}
            {activeView === 'strategy' && <MediaStrategy strategy={strategy} setStrategy={setStrategy} />}
            {activeView === 'assets' && <MediaAssetsLibrary posts={posts} onCreateMontage={handleCreateMontage} brands={brands} activeBrand={activeBrand} />}
            {activeView === 'generator' && <MediaIdeaGenerator onCreatePost={handleCreatePostWrapper} activeBrandId={activeBrand} brands={brands} mindMapContext={mindMapContext} onClearContext={() => setMindMapContext('')} />}
            {activeView === 'brainstorm' && (
                <MediaBrainstorm 
                    nodes={mindMapNodes}
                    onNodesChange={setMindMapNodes}
                    onConvertToCampaign={(ctx) => { setMindMapContext(ctx); setActiveView('generator'); }} 
                />
            )}
            
            {activeView === 'detail' && selectedPost && (
                <div className="flex flex-col h-full">
                    <div className="h-14 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4 shrink-0">
                        <div className="flex items-center gap-4">
                            <h2 className="font-bold text-white truncate max-w-[200px] md:max-w-md">{selectedPost.title}</h2>
                            <div className="flex bg-gray-800 rounded p-0.5">
                                {['script', 'storyboard', 'timeline', 'pro'].map(tab => (
                                    <button key={tab} onClick={() => setDetailTab(tab as any)} className={`px-3 py-1 text-xs font-medium rounded capitalize ${detailTab === tab ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>{tab}</button>
                                ))}
                            </div>
                        </div>
                        <span className="text-xs text-gray-500 uppercase font-bold">{selectedPost.status}</span>
                    </div>

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
                                onDuplicateScene={duplicateScene}
                                onDeleteScene={deleteScene}
                                onOpenTrim={handleOpenTrim}
                                onOpenMagicEdit={(id) => { setEditSceneId(id); setEditModalOpen(true); }}
                                onUpdateScene={updateScene}
                                onReorderScenes={reorderScenes}
                                cycleTransition={(t) => t === 'cut' ? 'fade' : 'cut'}
                                historyIndex={0}
                                historyLength={0}
                                onAddScene={addScene}
                                voices={voices}
                                onAutoGenerateAudioPrompt={handleAutoGenerateAudioPrompt}
                                onUpdateAudioTrack={(id, u) => setAudioTracks(prev => prev.map(t => t.id === id ? {...t, ...u} : t))}
                                onDeleteAudioTrack={(id) => setAudioTracks(prev => prev.filter(t => t.id !== id))}
                                onPublish={() => setPublishModalOpen(true)}
                            />
                        )}
                        {detailTab === 'storyboard' && (
                            <MediaStoryboard 
                                scenes={selectedPost.scenes || []}
                                onUpdateScene={updateScene}
                                onReorderScenes={reorderScenes}
                                onAddScene={addScene}
                                onDuplicateScene={duplicateScene}
                                onDeleteScene={deleteScene}
                                onGenerateImage={handleGenerateImage}
                                onBatchDelete={handleBatchDelete}
                            />
                        )}
                        {detailTab === 'script' && (
                            <MediaScriptEditor 
                                script={selectedPost.script || ''} 
                                onUpdateScript={(s) => updatePost({ script: s })}
                                onSyncToTimeline={(scenes, newTracks) => {
                                    updatePost({ scenes });
                                    if(newTracks && newTracks.length > 0) {
                                        setAudioTracks(prev => [...prev, ...newTracks]);
                                    }
                                    setDetailTab('timeline');
                                }}
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
                                            const newChar: Character = { id: `char-${Date.now()}`, name: characterName || 'New Character', imageUrl: base64, description: desc, isAvatar: true };
                                            updatePost({ characters: [...(selectedPost.characters || []), newChar] });
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
                                            const newRef: ReferenceAsset = { id: `ref-${Date.now()}`, type: 'image', url: base64, stylePrompt: style };
                                            updatePost({ styleReferences: [...(selectedPost.styleReferences || []), newRef] });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                onUpdatePost={updatePost}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};