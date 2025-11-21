
import React, { useState, useEffect, useRef } from 'react';
import { Clapperboard, Youtube, Instagram, Twitter, Plus, Upload, Image as ImageIcon, Film, Wand2, Eye, MoreHorizontal, CheckCircle, FileText, Layout, Edit3, X, PlayCircle, Video, Loader2, Sparkles, Globe, Tag, Share2, CloudUpload, Save, Download, Calendar, LayoutGrid, List, User, Scissors, ScanFace, Layers, Eraser, Play, Pause, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { MOCK_SOCIAL_POSTS } from '../constants';
import { SocialPost, Scene, Character, TimelineClip } from '../types';
import { generateSocialContent, generateImage, generateVideo, analyzeMediaStyle, removeBackground } from '../services/geminiService';
import JSZip from 'jszip';

export const MediaStudio: React.FC = () => {
  const [posts, setPosts] = useState<SocialPost[]>(() => {
    const saved = localStorage.getItem('omni_social_posts');
    return saved ? JSON.parse(saved) : MOCK_SOCIAL_POSTS;
  });

  // Pro Assets: Characters
  const [characters, setCharacters] = useState<Character[]>(() => {
      const saved = localStorage.getItem('omni_characters');
      return saved ? JSON.parse(saved) : [];
  });
  
  const [activeView, setActiveView] = useState<'kanban' | 'calendar' | 'create' | 'detail' | 'director'>('kanban');
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

  // Pro State
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [referenceStyle, setReferenceStyle] = useState<string>('');
  const [analyzingRef, setAnalyzingRef] = useState(false);

  // Director's Cut State
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);

  // Persistence
  useEffect(() => {
    const postsToSave = posts.map(p => ({
        ...p,
        scenes: p.scenes?.map(s => ({
            ...s,
            videoUrl: s.videoUrl?.startsWith('blob:') ? undefined : s.videoUrl
        })),
        timeline: p.timeline?.map(t => ({
            ...t,
            url: t.url?.startsWith('blob:') && t.type === 'video' ? undefined : t.url
        }))
    }));
    localStorage.setItem('omni_social_posts', JSON.stringify(postsToSave));
    window.dispatchEvent(new Event('omniAssetsUpdated'));
  }, [posts]);

  useEffect(() => {
      localStorage.setItem('omni_characters', JSON.stringify(characters));
  }, [characters]);

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
        { id: 's2', description: 'Main topic explanation', status: 'pending' },
        { id: 's3', description: 'Call to action', status: 'pending' }
    ];
    
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 14));

    const newPost: SocialPost = {
      id: `p${Date.now()}`,
      title: title,
      platform: selectedPlatform as any,
      status: 'idea',
      script: generatedScript,
      scenes: defaultScenes,
      timeline: [],
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
     
     // Pro: Find associated character description
     let charDesc = undefined;
     if (scene.characterId) {
         const char = characters.find(c => c.id === scene.characterId);
         if (char) charDesc = char.description;
     }

     const imageUrl = await generateImage(scene.description, charDesc, referenceStyle);
     
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
      const videoUrl = await generateVideo(scene.description, scene.imageUrl);

      if (videoUrl) {
          updateScene(sceneId, { videoUrl, status: 'done' });
      } else {
          updateSceneStatus(sceneId, 'pending');
      }
  };

  const handleRemoveBackground = async (sceneId: string) => {
      if (!selectedPost) return;
      const scene = selectedPost.scenes?.find(s => s.id === sceneId);
      if (!scene || !scene.imageUrl) return;
      
      updateScene(sceneId, { status: 'generating' }); // reuse generating status
      const newImage = await removeBackground(scene.imageUrl);
      updateScene(sceneId, { imageUrl: newImage, status: 'done', removeBackground: true });
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

  // --- Director's Mode Logic ---
  const handleAddToTimeline = (scene: Scene) => {
      if (!selectedPost || (!scene.videoUrl && !scene.imageUrl)) return;
      
      const newClip: TimelineClip = {
          id: `clip-${Date.now()}`,
          sceneId: scene.id,
          startTime: selectedPost.timeline?.reduce((acc, curr) => acc + curr.duration, 0) || 0,
          duration: scene.videoUrl ? 5 : 3, // Default durations
          type: scene.videoUrl ? 'video' : 'image',
          url: scene.videoUrl || scene.imageUrl!
      };
      
      const updatedTimeline = [...(selectedPost.timeline || []), newClip];
      const updatedPost = { ...selectedPost, timeline: updatedTimeline };
      setSelectedPost(updatedPost);
      setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
  };

  const moveClip = (index: number, direction: 'left' | 'right') => {
      if (!selectedPost?.timeline) return;
      const newTimeline = [...selectedPost.timeline];
      const newIndex = direction === 'left' ? index - 1 : index + 1;
      
      if (newIndex < 0 || newIndex >= newTimeline.length) return;
      
      const [clip] = newTimeline.splice(index, 1);
      newTimeline.splice(newIndex, 0, clip);
      
      const updatedPost = { ...selectedPost, timeline: newTimeline };
      setSelectedPost(updatedPost);
      setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
  };

  const updateClipDuration = (index: number, duration: number) => {
      if (!selectedPost?.timeline) return;
      const newTimeline = [...selectedPost.timeline];
      newTimeline[index] = { ...newTimeline[index], duration: Math.max(1, duration) }; // Min 1s
      const updatedPost = { ...selectedPost, timeline: newTimeline };
      setSelectedPost(updatedPost);
      setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
  }

  const handlePlayTimeline = () => {
      if (!selectedPost?.timeline?.length) return;
      setTimelinePlaying(true);
      let currentIndex = 0;
      
      const playNext = () => {
          if (currentIndex >= (selectedPost.timeline?.length || 0)) {
              setTimelinePlaying(false);
              return;
          }
          const clip = selectedPost.timeline![currentIndex];
          setPreviewUrl(clip.url);
          currentIndex++;
          setTimeout(playNext, clip.duration * 1000);
      };
      playNext();
  };

  const handleRenderMovie = async () => {
      if (!selectedPost?.timeline?.length) return;
      setIsRendering(true);

      // Simulate rendering delay
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock download
      alert("Render complete! In a real app, this would trigger a download of the stitched video file.");
      setIsRendering(false);
  }

  // --- Character Logic ---
  const handleCreateCharacter = async (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          const analysis = await analyzeMediaStyle(base64, 'image');
          
          const newChar: Character = {
              id: `char-${Date.now()}`,
              name: `Character ${characters.length + 1}`,
              imageUrl: base64,
              description: analysis
          };
          setCharacters(prev => [...prev, newChar]);
          setShowCharacterModal(false);
      };
      reader.readAsDataURL(file);
  };

  const handleRefUpload = async (file: File) => {
      setAnalyzingRef(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
          const base64 = e.target?.result as string;
          const styleDesc = await analyzeMediaStyle(base64, 'image');
          setReferenceStyle(styleDesc);
          setAnalyzingRef(false);
      };
      reader.readAsDataURL(file);
  };

  const handleSaveDraft = () => {
    const postsToSave = posts.map(p => ({
        ...p,
        scenes: p.scenes?.map(s => ({
            ...s,
            videoUrl: s.videoUrl?.startsWith('blob:') ? undefined : s.videoUrl
        })),
        timeline: p.timeline?.map(t => ({
            ...t,
            url: t.url?.startsWith('blob:') && t.type === 'video' ? undefined : t.url
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
      zip.file("script.md", `# ${selectedPost.title}\n\n${selectedPost.script || 'No script generated.'}`);
      
      // Add Assets
      const assetsFolder = zip.folder("assets");
      if (assetsFolder && selectedPost.scenes) {
          for (let i = 0; i < selectedPost.scenes.length; i++) {
              const scene = selectedPost.scenes[i];
              if (scene.imageUrl) {
                  const response = await fetch(scene.imageUrl);
                  const blob = await response.blob();
                  assetsFolder.file(`scene_${i + 1}_image.png`, blob);
              }
              if (scene.videoUrl) {
                  try {
                      const response = await fetch(scene.videoUrl);
                      const blob = await response.blob();
                      assetsFolder.file(`scene_${i + 1}_video.mp4`, blob);
                  } catch (e) { console.warn(`Could not export video for scene ${i+1}`); }
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

  const UploadModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><CloudUpload className="text-primary-500" /> Publish</h3>
                <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
            </div>
            {isUploading ? (
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-400"><span>Uploading...</span><span>{Math.round(uploadProgress)}%</span></div>
                    <div className="w-full bg-gray-800 rounded-full h-2"><div className="bg-primary-500 h-full transition-all" style={{ width: `${uploadProgress}%` }}></div></div>
                </div>
            ) : (
                <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setShowUploadModal(false)}>Cancel</Button>
                    <Button className="flex-1" onClick={handleConfirmUpload}><Share2 size={16} className="mr-2" /> Publish Now</Button>
                </div>
            )}
        </div>
    </div>
  );

  const CalendarView = () => {
      const days = Array.from({length: 35}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - d.getDay() + i);
          return d;
      });
      const today = new Date();
      return (
          <div className="flex-1 p-8 overflow-hidden flex flex-col">
             <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white">Content Schedule</h2></div>
             <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 overflow-hidden flex flex-col">
                 <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-850">
                     {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day} className="p-3 text-center text-xs font-medium text-gray-500 uppercase">{day}</div>)}
                 </div>
                 <div className="grid grid-cols-7 grid-rows-5 flex-1">
                     {days.map((date, i) => {
                         const dayPosts = posts.filter(p => p.scheduledDate ? new Date(p.scheduledDate).toDateString() === date.toDateString() : !p.scheduledDate && parseInt(p.id.slice(-2)) % 30 === i);
                         const isToday = date.toDateString() === today.toDateString();
                         return (
                             <div key={i} className={`border border-gray-800/50 p-2 flex flex-col gap-1 min-h-[100px] ${date.getMonth() !== today.getMonth() ? 'bg-gray-900/30 text-gray-600' : 'bg-gray-900'}`}>
                                 <div className={`text-xs mb-1 font-mono ${isToday ? 'text-primary-400 font-bold' : 'text-gray-500'}`}>{date.getDate()}</div>
                                 {dayPosts.map(post => (
                                     <div key={post.id} onClick={() => { setSelectedPost(post); setActiveView('detail'); }} className="text-[10px] p-1 rounded truncate cursor-pointer bg-primary-900/20 text-primary-300">{post.title}</div>
                                 ))}
                             </div>
                         );
                     })}
                 </div>
             </div>
          </div>
      );
  };

  const DirectorView = () => {
      if (!selectedPost) return <div>Select a post first</div>;
      
      return (
          <div className="flex-1 flex flex-col h-full">
              {/* Top: Preview Area & Asset Bin */}
              <div className="flex-1 flex min-h-0">
                  <div className="w-2/3 bg-black flex flex-col p-4 items-center justify-center relative border-r border-gray-800">
                      <div className="aspect-video bg-gray-900 w-full max-h-full flex items-center justify-center rounded-lg border border-gray-800 overflow-hidden relative">
                          {previewUrl ? (
                              previewUrl.startsWith('data:image') ? <img src={previewUrl} className="w-full h-full object-contain" /> : <video src={previewUrl} autoPlay className="w-full h-full object-contain" />
                          ) : (
                              <div className="text-gray-600 flex flex-col items-center">
                                  <Film size={48} />
                                  <span className="mt-2">Preview Window</span>
                              </div>
                          )}
                          {timelinePlaying && <div className="absolute top-4 right-4 text-red-500 animate-pulse font-mono">PLAYING</div>}
                      </div>
                      <div className="w-full mt-4 flex justify-center gap-4">
                           <Button onClick={handlePlayTimeline}><Play size={16} className="mr-2"/> Play Sequence</Button>
                           <Button variant="secondary" onClick={handleRenderMovie} disabled={isRendering}>
                               {isRendering ? <Loader2 size={16} className="animate-spin mr-2"/> : <Download size={16} className="mr-2"/>} 
                               Render Movie
                           </Button>
                      </div>
                  </div>
                  
                  <div className="w-1/3 bg-gray-900 p-4 border-l border-gray-800 flex flex-col">
                      <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Generated Assets</h3>
                      <div className="flex-1 overflow-y-auto space-y-2">
                          {selectedPost.scenes?.map((scene, i) => (
                              <div key={scene.id} className="bg-gray-800 p-2 rounded flex gap-2 items-center group">
                                  {scene.imageUrl ? <img src={scene.imageUrl} className="w-12 h-12 object-cover rounded bg-black"/> : <div className="w-12 h-12 bg-gray-700 rounded"></div>}
                                  <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium text-white truncate">Scene {i+1}</div>
                                      <div className="text-[10px] text-gray-500 truncate">{scene.description}</div>
                                  </div>
                                  <Button size="sm" onClick={() => handleAddToTimeline(scene)}><Plus size={12}/></Button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Bottom: Timeline */}
              <div className="h-48 bg-gray-950 border-t border-gray-800 flex flex-col">
                  <div className="h-8 bg-gray-900 border-b border-gray-800 flex items-center px-4 text-xs text-gray-500">
                      <span>00:00</span>
                      <span className="mx-auto">Timeline Editor</span>
                      <span>Total: {selectedPost.timeline?.reduce((acc, c) => acc + c.duration, 0) || 0}s</span>
                  </div>
                  <div className="flex-1 p-4 overflow-x-auto whitespace-nowrap relative">
                       <div className="absolute top-0 bottom-0 w-px bg-red-500 z-10 left-4"></div>
                       <div className="flex gap-1 h-full">
                           {selectedPost.timeline?.map((clip, i) => (
                               <div key={clip.id} className="h-full bg-primary-900/40 border border-primary-500/50 rounded p-2 min-w-[140px] relative group flex flex-col justify-center transition-all hover:bg-primary-900/60">
                                    <span className="text-[10px] text-primary-200 font-bold mb-1 truncate">Clip {i+1}</span>
                                    <div className="flex-1 bg-black/20 rounded overflow-hidden mb-1 relative">
                                        {clip.type === 'image' ? <img src={clip.url} className="w-full h-full object-cover opacity-50"/> : <video src={clip.url} className="w-full h-full object-cover opacity-50"/>}
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                                            <button onClick={() => moveClip(i, 'left')} className="text-white hover:text-primary-300 p-1" disabled={i === 0}><ArrowLeft size={12}/></button>
                                            <button onClick={() => moveClip(i, 'right')} className="text-white hover:text-primary-300 p-1" disabled={i === (selectedPost.timeline?.length || 0) - 1}><ArrowRight size={12}/></button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <input 
                                           type="number" 
                                           className="w-10 bg-black/50 text-white text-[10px] border border-gray-600 rounded px-1"
                                           value={clip.duration}
                                           onChange={(e) => updateClipDuration(i, parseFloat(e.target.value))}
                                           min={1}
                                        />
                                        <span className="text-[9px] text-gray-400">sec</span>
                                    </div>
                               </div>
                           ))}
                           {(!selectedPost.timeline || selectedPost.timeline.length === 0) && <div className="text-gray-600 text-sm self-center ml-4 italic">Drag scenes here to build your cut</div>}
                       </div>
                  </div>
              </div>
          </div>
      );
  }

  const CharacterModal = () => (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-white mb-4">Add New Character</h3>
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 flex flex-col items-center justify-center mb-4 cursor-pointer hover:bg-gray-800" onClick={() => document.getElementById('char-upload')?.click()}>
                  <ScanFace size={32} className="text-gray-500 mb-2"/>
                  <span className="text-sm text-gray-400">Upload Reference Face</span>
                  <input type="file" id="char-upload" className="hidden" onChange={(e) => e.target.files?.[0] && handleCreateCharacter(e.target.files[0])} />
              </div>
              <Button variant="secondary" className="w-full" onClick={() => setShowCharacterModal(false)}>Cancel</Button>
          </div>
      </div>
  );

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
       {showUploadModal && <UploadModal />}
       {showCharacterModal && <CharacterModal />}

       {/* Sidebar */}
       <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-6 shadow-xl z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Clapperboard className="text-red-500" /> Media Pro</h2>
          <Button onClick={() => { setSelectedPost(null); setActiveView('create'); }} className="mb-6 w-full shadow-lg shadow-primary-900/20">
             <Plus size={16} className="mr-2" /> New Project
          </Button>

          <div className="space-y-1 mb-6">
             <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">Studio</div>
             <button onClick={() => setActiveView('kanban')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${activeView === 'kanban' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}><LayoutGrid size={16} /> Pipeline</button>
             <button onClick={() => setActiveView('calendar')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${activeView === 'calendar' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}><Calendar size={16} /> Schedule</button>
             <button onClick={() => setActiveView('director')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${activeView === 'director' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}><Scissors size={16} /> Director's Cut</button>
          </div>

          <div className="flex-1">
             <div className="flex justify-between items-center mb-2 px-2">
                 <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Characters</div>
                 <button onClick={() => setShowCharacterModal(true)} className="text-gray-400 hover:text-white"><Plus size={12}/></button>
             </div>
             <div className="space-y-2 max-h-48 overflow-y-auto">
                 {characters.map(c => (
                     <div key={c.id} className="flex items-center gap-2 px-2 py-1 bg-gray-800/50 rounded border border-gray-800">
                         <img src={c.imageUrl} className="w-6 h-6 rounded-full object-cover"/>
                         <span className="text-xs text-gray-300 truncate">{c.name}</span>
                     </div>
                 ))}
                 {characters.length === 0 && <div className="text-xs text-gray-600 px-2 italic">No characters added</div>}
             </div>
          </div>
       </div>

       {/* Main Content */}
       <div className="flex-1 flex flex-col overflow-hidden bg-gray-950 relative">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
          
          {activeView === 'kanban' && (
             <div className="flex-1 p-8 overflow-x-auto">
                <div className="flex gap-6 h-full">
                   {/* Kanban Columns simplified for brevity, logic identical to previous */}
                   {['idea', 'scripting', 'generating', 'ready', 'uploaded'].map(status => (
                       <div key={status} className="flex-1 min-w-[250px] bg-gray-900/50 rounded-xl p-4 border border-gray-800 flex flex-col">
                           <div className="uppercase text-xs font-bold text-gray-500 mb-4">{status}</div>
                           <div className="space-y-3">
                               {posts.filter(p => p.status === status).map(post => (
                                   <div key={post.id} onClick={() => { setSelectedPost(post); setActiveView('detail'); }} className="bg-gray-800 p-3 rounded-lg border border-gray-700 cursor-pointer hover:border-primary-500">
                                       <h4 className="text-sm font-medium text-white mb-1">{post.title}</h4>
                                       <div className="text-[10px] text-gray-500 capitalize">{post.platform}</div>
                                   </div>
                               ))}
                           </div>
                       </div>
                   ))}
                </div>
             </div>
          )}

          {activeView === 'calendar' && <CalendarView />}
          {activeView === 'director' && <DirectorView />}

          {activeView === 'create' && (
             <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <button className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors" onClick={() => setActiveView('kanban')}>&larr; Back</button>
                   <h1 className="text-3xl font-bold mb-2">Create Viral Content</h1>
                   
                   {/* Reference Upload */}
                   <div className="mb-6 bg-gray-900 p-4 rounded-xl border border-gray-800">
                       <div className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2"><Wand2 size={14} className="text-purple-400"/> Style Reference (Optional)</div>
                       <div className="flex gap-4 items-center">
                           <Button variant="secondary" size="sm" onClick={() => document.getElementById('ref-upload')?.click()}>Upload Reference Image</Button>
                           <input type="file" id="ref-upload" className="hidden" onChange={(e) => e.target.files?.[0] && handleRefUpload(e.target.files[0])} />
                           {analyzingRef && <span className="text-xs text-purple-400 animate-pulse">Analyzing style...</span>}
                           {referenceStyle && (
                               <div className="flex items-center gap-2">
                                   <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={12}/> Style Active</span>
                                   <button onClick={() => setReferenceStyle('')} className="text-gray-500 hover:text-red-400"><X size={12}/></button>
                               </div>
                           )}
                       </div>
                   </div>

                   <textarea className="w-full h-32 bg-black border border-gray-700 rounded-lg p-4 text-gray-200 mb-4" placeholder="Describe your idea..." value={newPostPrompt} onChange={(e) => setNewPostPrompt(e.target.value)}/>
                   <Button size="lg" className="w-full py-4" onClick={handleCreateContentPlan} disabled={isGeneratingPlan}>
                      {isGeneratingPlan ? <Loader2 size={20} className="animate-spin mr-2"/> : <Wand2 size={20} className="mr-2" />} Generate Plan
                   </Button>
                </div>
             </div>
          )}

          {activeView === 'detail' && selectedPost && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                <div className="h-16 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        <button className="text-gray-500 hover:text-white" onClick={() => setActiveView('kanban')}><X size={20} /></button>
                        <h2 className="font-bold text-white">{selectedPost.title}</h2>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={handleSaveDraft}><Save size={14} className="mr-2" /> Save Draft</Button>
                        <Button variant="secondary" onClick={handleExportPackage} disabled={isExporting}><Download size={14} className="mr-2" /> Package</Button>
                        <Button onClick={(e) => handleOpenUpload(selectedPost, e)}><Upload size={16} className="mr-2"/> Publish</Button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-1/2 border-r border-gray-800 bg-gray-900 p-6 overflow-y-auto">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Script</h3>
                        <textarea className="w-full h-[calc(100%-2rem)] bg-black/50 border border-gray-800 rounded-xl p-6 text-gray-300 font-mono text-sm" defaultValue={selectedPost.script} />
                    </div>

                    <div className="w-1/2 bg-gray-950 p-6 overflow-y-auto">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Scenes</h3>
                        <div className="space-y-6">
                            {selectedPost.scenes?.map((scene, idx) => (
                                <div key={scene.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                                    <div className="p-3 border-b border-gray-800 bg-gray-850 flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-500">SCENE {idx + 1}</span>
                                        {characters.length > 0 && (
                                            <select 
                                              className="bg-gray-800 text-[10px] text-gray-300 border border-gray-700 rounded px-1"
                                              onChange={(e) => updateScene(scene.id, { characterId: e.target.value })}
                                              value={scene.characterId || ''}
                                            >
                                                <option value="">No Character</option>
                                                {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <p className="text-sm text-gray-300 mb-4">{scene.description}</p>
                                        <div className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden group border border-gray-800">
                                            {scene.videoUrl ? <video src={scene.videoUrl} controls className="w-full h-full object-cover" /> : 
                                             scene.imageUrl ? <img src={scene.imageUrl} className="w-full h-full object-cover" /> : 
                                             <div className="text-gray-700 flex flex-col items-center gap-2"><Sparkles size={24} /><span className="text-xs">No visuals</span></div>}
                                            
                                            {!scene.imageUrl && !scene.videoUrl && !scene.status.includes('generating') && (
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button size="sm" onClick={() => handleGenerateImage(scene.id)}>Gen Image</Button>
                                                </div>
                                            )}
                                            {scene.imageUrl && !scene.removeBackground && (
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
                                                    <button onClick={() => handleRemoveBackground(scene.id)} className="p-1 bg-black/50 text-white rounded" title="Remove BG"><Eraser size={14}/></button>
                                                    <button onClick={() => handleGenerateVideo(scene.id)} className="p-1 bg-black/50 text-white rounded ml-1" title="Gen Video"><Video size={14}/></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <Button variant="secondary" className="w-full"><Plus size={16} /> Add Scene</Button>
                        </div>
                    </div>
                </div>
            </div>
          )}
       </div>
    </div>
  );
};