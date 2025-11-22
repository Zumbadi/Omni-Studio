
import React, { useState, useEffect, useRef } from 'react';
import { Clapperboard, Plus, Upload, Image as ImageIcon, Film, Wand2, X, Video, Loader2, Sparkles, Save, Calendar, LayoutGrid, ArrowRightLeft, Layers, Clock, User, Palette, Scissors, Trash2, Play, Pause, FileText, Copy, MoveHorizontal, ChevronRight, MoreHorizontal, RotateCcw, RotateCw, Sliders, Music, Volume2, Download, MonitorPlay, Target, BarChart2, Users, MapPin } from 'lucide-react';
import { Button } from './Button';
import { MOCK_SOCIAL_POSTS } from '../constants';
import { SocialPost, Scene, Character, ReferenceAsset, AudioTrack, ContentStrategy } from '../types';
import { generateSocialContent, generateImage, generateVideo, analyzeMediaStyle, removeBackground, analyzeCharacterFeatures, editImage } from '../services/geminiService';
import JSZip from 'jszip';

export const MediaStudio: React.FC = () => {
  const [posts, setPosts] = useState<SocialPost[]>(() => {
    const saved = localStorage.getItem('omni_social_posts');
    return saved ? JSON.parse(saved) : MOCK_SOCIAL_POSTS;
  });
  
  const [strategy, setStrategy] = useState<ContentStrategy>(() => {
      const saved = localStorage.getItem('omni_media_strategy');
      return saved ? JSON.parse(saved) : { targetAudience: '', primaryGoal: 'engagement', contentPillars: [], toneVoice: '', postingFrequency: 'daily' };
  });

  const [activeView, setActiveView] = useState<'kanban' | 'calendar' | 'create' | 'detail' | 'strategy'>('kanban');
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
  
  // Detail View Tab
  const [detailTab, setDetailTab] = useState<'script' | 'timeline' | 'pro'>('script');

  // Creation State
  const [newPostPrompt, setNewPostPrompt] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('youtube');

  // Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Preview State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Magic Edit State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);

  // Trim Modal State
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [trimSceneId, setTrimSceneId] = useState<string | null>(null);
  const [trimValues, setTrimValues] = useState({ start: 0, duration: 5 });

  // Drag and Drop State for Timeline
  const [draggedSceneIndex, setDraggedSceneIndex] = useState<number | null>(null);

  // Pro Studio State
  const [characterName, setCharacterName] = useState('');
  const [isAnalyzingChar, setIsAnalyzingChar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  
  // Audio Integration State
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  
  // Undo/Redo History State
  const [history, setHistory] = useState<SocialPost[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Pro Timeline State
  const [currentTime, setCurrentTime] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const PIXELS_PER_SECOND = 40; // Zoom level

  useEffect(() => {
    const postsToSave = posts.map(p => ({
        ...p,
        scenes: p.scenes?.map(s => ({
            ...s,
            videoUrl: s.videoUrl?.startsWith('blob:') ? undefined : s.videoUrl
        }))
    }));
    localStorage.setItem('omni_social_posts', JSON.stringify(postsToSave));
    window.dispatchEvent(new Event('omniAssetsUpdated'));
  }, [posts]);

  useEffect(() => {
      localStorage.setItem('omni_media_strategy', JSON.stringify(strategy));
  }, [strategy]);

  useEffect(() => {
     const loadAudio = () => {
        const saved = localStorage.getItem('omni_audio_tracks');
        if (saved) setAudioTracks(JSON.parse(saved));
     };
     loadAudio();
     window.addEventListener('omniAssetsUpdated', loadAudio);
     return () => window.removeEventListener('omniAssetsUpdated', loadAudio);
  }, []);

  // Preview Playback Logic (Synchronized with Time)
  useEffect(() => {
    let interval: any;
    if (isPreviewPlaying && selectedPost?.scenes) {
        const totalDuration = selectedPost.scenes.reduce((acc, s) => acc + (s.duration || 5), 0);
        
        interval = setInterval(() => {
            setCurrentTime(prev => {
                const next = prev + 0.1;
                if (next >= totalDuration) {
                    setIsPreviewPlaying(false);
                    return 0;
                }
                return next;
            });
        }, 100);
    }
    return () => clearInterval(interval);
  }, [isPreviewPlaying, selectedPost]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (activeView !== 'detail' || detailTab !== 'timeline') return;

        if (e.code === 'Space') {
            e.preventDefault();
            setIsPreviewPlaying(p => !p);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, detailTab]);

  // Initialize history when entering detail view
  useEffect(() => {
      if (selectedPost && history.length === 0) {
          setHistory([selectedPost]);
          setHistoryIndex(0);
      }
  }, [selectedPost]);

  const pushHistory = (newPost: SocialPost) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPost);
      if (newHistory.length > 20) newHistory.shift(); 
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
      if (historyIndex > 0) {
          const prevIndex = historyIndex - 1;
          const prevPost = history[prevIndex];
          setHistoryIndex(prevIndex);
          setSelectedPost(prevPost);
          setPosts(prev => prev.map(p => p.id === prevPost.id ? prevPost : p));
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1;
          const nextPost = history[nextIndex];
          setHistoryIndex(nextIndex);
          setSelectedPost(nextPost);
          setPosts(prev => prev.map(p => p.id === nextPost.id ? nextPost : p));
      }
  };

  const handleCreateContentPlan = async () => {
    if (!newPostPrompt) return;
    setIsGeneratingPlan(true);

    // Inject Strategy Context
    const strategyContext = `Target Audience: ${strategy.targetAudience}, Goal: ${strategy.primaryGoal}, Tone: ${strategy.toneVoice}`;
    const fullPrompt = `${newPostPrompt}. Context: ${strategyContext}`;

    let generatedScript = "";
    await generateSocialContent(fullPrompt, selectedPlatform, (chunk) => {
        generatedScript += chunk;
    });

    const titleMatch = generatedScript.match(/Title:\s*(.*)/);
    const title = titleMatch ? titleMatch[1] : "New Viral Post";
    
    const defaultScenes: Scene[] = [
        { id: 's1', description: 'Opening shot: energetic intro', status: 'pending', duration: 5, transition: 'cut' },
        { id: 's2', description: 'Main topic explanation with graphics', status: 'pending', duration: 8, transition: 'fade' },
        { id: 's3', description: 'Call to action and subscribe', status: 'pending', duration: 4, transition: 'dissolve' }
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
      scheduledDate: futureDate.toISOString(),
      characters: [],
      styleReferences: []
    };

    setPosts(prev => [...prev, newPost]);
    setIsGeneratingPlan(false);
    setSelectedPost(newPost);
    setActiveView('detail');
    setHistory([newPost]);
    setHistoryIndex(0);
  };

  const getEnhancedPrompt = (description: string) => {
      if (!selectedPost) return description;
      let prompt = description;
      if (selectedPost.characters && selectedPost.characters.length > 0) {
          const mainChar = selectedPost.characters[0];
          prompt += `. Character: ${mainChar.description || mainChar.name}.`;
      }
      if (selectedPost.styleReferences && selectedPost.styleReferences.length > 0) {
          prompt += `. Style: ${selectedPost.styleReferences[0].stylePrompt}`;
      }
      return prompt;
  };

  const handleGenerateImage = async (sceneId: string) => {
     if (!selectedPost) return;
     const scene = selectedPost.scenes?.find(s => s.id === sceneId);
     if (!scene) return;
     updateSceneStatus(sceneId, 'generating');
     const enhancedPrompt = getEnhancedPrompt(scene.description);
     const stylePrompt = selectedPost.styleReferences?.[0]?.stylePrompt;
     const imageUrl = await generateImage(enhancedPrompt, stylePrompt);
     if (imageUrl) updateScene(sceneId, { imageUrl, status: 'done' });
     else updateSceneStatus(sceneId, 'pending');
  };

  const handleGenerateVideo = async (sceneId: string) => {
      if (!selectedPost) return;
      const scene = selectedPost.scenes?.find(s => s.id === sceneId);
      if (!scene) return;
      const win = window as any;
      if (win.aistudio) {
         const hasKey = await win.aistudio.hasSelectedApiKey();
         if (!hasKey && !(await win.aistudio.openSelectKey())) return;
      }
      updateSceneStatus(sceneId, 'generating');
      const enhancedPrompt = getEnhancedPrompt(scene.description);
      const videoUrl = await generateVideo(enhancedPrompt, scene.imageUrl);
      if (videoUrl) updateScene(sceneId, { videoUrl, status: 'done' });
      else updateSceneStatus(sceneId, 'pending');
  };
  
  const handleRemoveBackground = async (sceneId: string) => {
      if (!selectedPost) return;
      const scene = selectedPost.scenes?.find(s => s.id === sceneId);
      if (!scene || !scene.imageUrl) return;
      updateSceneStatus(sceneId, 'generating');
      const processedImage = await removeBackground(scene.imageUrl);
      if (processedImage) updateScene(sceneId, { imageUrl: processedImage, status: 'done', bgRemoved: true });
      else updateSceneStatus(sceneId, 'done');
  };

  const updateSceneStatus = (sceneId: string, status: Scene['status']) => {
     updateScene(sceneId, { status });
  };

  const updateScene = (sceneId: string, updates: Partial<Scene>) => {
     if (!selectedPost) return;
     const updatedScenes = selectedPost.scenes?.map(s => s.id === sceneId ? { ...s, ...updates } : s);
     const updatedPost = { ...selectedPost, scenes: updatedScenes };
     setSelectedPost(updatedPost);
     setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
  };
  
  const updateSceneWithHistory = (sceneId: string, updates: Partial<Scene>) => {
      if (!selectedPost) return;
      const updatedScenes = selectedPost.scenes?.map(s => s.id === sceneId ? { ...s, ...updates } : s);
      const updatedPost = { ...selectedPost, scenes: updatedScenes };
      setSelectedPost(updatedPost);
      setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
      pushHistory(updatedPost);
  };

  // Magic Edit
  const handleOpenMagicEdit = (sceneId: string) => {
      setEditSceneId(sceneId); setEditPrompt(''); setEditModalOpen(true);
  };
  const handleMagicEditSubmit = async () => {
      if (!editSceneId || !editPrompt || !selectedPost) return;
      const scene = selectedPost.scenes?.find(s => s.id === editSceneId);
      if (!scene || !scene.imageUrl) return;
      setIsEditingImage(true);
      const newImage = await editImage(scene.imageUrl, editPrompt);
      if (newImage) updateSceneWithHistory(editSceneId, { imageUrl: newImage });
      else alert("Edit failed.");
      setIsEditingImage(false);
      setEditModalOpen(false);
  };

  // Trim Logic
  const handleOpenTrim = (sceneId: string) => {
      if (!selectedPost?.scenes) return;
      const scene = selectedPost.scenes.find(s => s.id === sceneId);
      if (!scene) return;
      setTrimSceneId(sceneId);
      setTrimValues({ start: scene.mediaStartTime || 0, duration: scene.duration || 5 });
      setTrimModalOpen(true);
  };
  const handleApplyTrim = () => {
      if (trimSceneId) {
          updateSceneWithHistory(trimSceneId, { mediaStartTime: trimValues.start, duration: trimValues.duration });
          setTrimModalOpen(false);
      }
  };

  const handleOpenUpload = (post: SocialPost, e?: React.MouseEvent) => {
      e?.stopPropagation(); setSelectedPost(post); setShowUploadModal(true); setUploadProgress(0); setIsUploading(false);
  };
  const handleConfirmUpload = () => {
      if (!selectedPost) return;
      setIsUploading(true);
      let progress = 0;
      const interval = setInterval(() => {
          progress += Math.random() * 15;
          if (progress >= 100) {
              clearInterval(interval); setUploadProgress(100);
              setTimeout(() => {
                  const updatedPost = { ...selectedPost, status: 'uploaded' as const };
                  setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p));
                  setIsUploading(false); setShowUploadModal(false);
                  alert("Content published successfully!");
              }, 500);
          } else setUploadProgress(progress);
      }, 500);
  };

  const handleSaveDraft = () => {
    const postsToSave = posts.map(p => ({ ...p, scenes: p.scenes?.map(s => ({ ...s, videoUrl: s.videoUrl?.startsWith('blob:') ? undefined : s.videoUrl })) }));
    localStorage.setItem('omni_social_posts', JSON.stringify(postsToSave));
    window.dispatchEvent(new Event('omniAssetsUpdated'));
    alert("Draft saved successfully!");
  };

  // Pro Helpers
  const handleUploadCharacter = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !characterName || !selectedPost) return;
      setIsAnalyzingChar(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          const description = await analyzeCharacterFeatures(base64);
          const newChar: Character = { id: `char-${Date.now()}`, name: characterName, imageUrl: base64, description };
          const updatedPost = { ...selectedPost, characters: [...(selectedPost.characters || []), newChar] };
          setSelectedPost(updatedPost); setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p)); pushHistory(updatedPost);
          setCharacterName(''); setIsAnalyzingChar(false);
      };
      reader.readAsDataURL(file);
  };
  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedPost) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          const type = file.type.startsWith('image') ? 'image' : 'video';
          const stylePrompt = await analyzeMediaStyle(base64, type as any);
          const newRef: ReferenceAsset = { id: `ref-${Date.now()}`, type: type as any, url: base64, stylePrompt };
          const updatedPost = { ...selectedPost, styleReferences: [...(selectedPost.styleReferences || []), newRef] };
          setSelectedPost(updatedPost); setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p)); pushHistory(updatedPost);
      };
      reader.readAsDataURL(file);
  };
  const handleSelectAudio = (trackId: string) => {
      if (!selectedPost) return;
      const updatedPost = { ...selectedPost, audioTrackId: trackId };
      setSelectedPost(updatedPost); setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p)); pushHistory(updatedPost);
  };
  const handleRenderMovie = () => {
     setIsRendering(true);
     setRenderProgress(0);
     let p = 0;
     const int = setInterval(() => {
        p += 2;
        setRenderProgress(p);
        if (p >= 100) {
            clearInterval(int);
            setIsRendering(false);
            alert("Render Complete! Downloading final cut...");
        }
     }, 100);
  };

  // Timeline Handlers
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const newTime = Math.max(0, (clickX - 24) / PIXELS_PER_SECOND); // 24px padding
      setCurrentTime(newTime);
  };

  const handleDragStart = (index: number) => setDraggedSceneIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => e.preventDefault();
  const handleDrop = (index: number) => {
      if (draggedSceneIndex === null || !selectedPost || !selectedPost.scenes) return;
      const newScenes = [...selectedPost.scenes];
      const [draggedItem] = newScenes.splice(draggedSceneIndex, 1);
      newScenes.splice(index, 0, draggedItem);
      const updatedPost = { ...selectedPost, scenes: newScenes };
      setSelectedPost(updatedPost); setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p)); pushHistory(updatedPost);
      setDraggedSceneIndex(null);
  };
  const handleSplitScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      const scene = scenes[index];
      const originalDuration = scene.duration || 5;
      const splitPoint = originalDuration / 2;
      const currentOffset = scene.mediaStartTime || 0;
      const part1: Scene = { ...scene, duration: splitPoint };
      const part2: Scene = { ...scene, id: `s-${Date.now()}`, duration: splitPoint, mediaStartTime: currentOffset + splitPoint };
      scenes.splice(index, 1, part1, part2);
      const updatedPost = { ...selectedPost, scenes };
      setSelectedPost(updatedPost); setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p)); pushHistory(updatedPost);
  };
  const handleDuplicateScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      const scene = scenes[index];
      const copy: Scene = { ...scene, id: `s-copy-${Date.now()}` };
      scenes.splice(index + 1, 0, copy);
      const updatedPost = { ...selectedPost, scenes };
      setSelectedPost(updatedPost); setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p)); pushHistory(updatedPost);
  };
  const handleDeleteScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      if (!confirm("Delete this scene?")) return;
      const scenes = [...selectedPost.scenes];
      scenes.splice(index, 1);
      const updatedPost = { ...selectedPost, scenes };
      setSelectedPost(updatedPost); setPosts(posts.map(p => p.id === selectedPost.id ? updatedPost : p)); pushHistory(updatedPost);
  };
  const cycleTransition = (current: Scene['transition']) => {
      const types: Scene['transition'][] = ['cut', 'fade', 'dissolve', 'slide-left', 'slide-right', 'zoom', 'blur', 'wipe'];
      const idx = types.indexOf(current || 'cut');
      return types[(idx + 1) % types.length];
  };

  // Components (TrimModal, UploadModal, EditModal)
  const TrimModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Scissors className="text-blue-500" /> Precision Trim</h3>
                <button onClick={() => setTrimModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="space-y-6">
                <div>
                    <label className="flex justify-between text-xs font-medium text-gray-400 mb-2"><span>Start Offset</span><span className="text-white">{trimValues.start.toFixed(2)}s</span></label>
                    <input type="range" min="0" max="10" step="0.1" value={trimValues.start} onChange={(e) => setTrimValues(prev => ({...prev, start: parseFloat(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>
                <div>
                    <label className="flex justify-between text-xs font-medium text-gray-400 mb-2"><span>Duration</span><span className="text-white">{trimValues.duration.toFixed(2)}s</span></label>
                    <input type="range" min="0.5" max="20" step="0.5" value={trimValues.duration} onChange={(e) => setTrimValues(prev => ({...prev, duration: parseFloat(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" />
                </div>
                <div className="bg-black p-4 rounded-lg border border-gray-800 flex justify-center text-xs text-gray-500 font-mono">
                    Play Region: {trimValues.start.toFixed(1)}s → {(trimValues.start + trimValues.duration).toFixed(1)}s
                </div>
                <div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setTrimModalOpen(false)}>Cancel</Button><Button onClick={handleApplyTrim}>Apply Trim</Button></div>
            </div>
        </div>
    </div>
  );

  const DirectorView = () => {
      const activeAudioTrack = audioTracks.find(t => t.id === selectedPost?.audioTrackId);
      const totalDuration = selectedPost?.scenes?.reduce((acc, s) => acc + (s.duration || 5), 0) || 0;
      const totalWidth = totalDuration * PIXELS_PER_SECOND;

      return (
      <div className="flex-1 flex flex-col bg-gray-950 p-6 overflow-hidden">
          <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Film size={16}/> Director's Cut Timeline</h3>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                   <div className="flex items-center gap-2 mr-4 border-r border-gray-800 pr-4">
                        <Music size={14} className="text-gray-500" />
                        <select className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white w-40" value={selectedPost?.audioTrackId || ''} onChange={(e) => handleSelectAudio(e.target.value)}>
                            <option value="">No Soundtrack</option>
                            {audioTracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                   </div>
                   <Button size="sm" variant="secondary" onClick={handleUndo} disabled={historyIndex <= 0} title="Undo"><RotateCcw size={14} className="md:mr-1"/> <span className="hidden md:inline">Undo</span></Button>
                   <Button size="sm" variant="secondary" onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo"><RotateCw size={14} className="md:mr-1"/> <span className="hidden md:inline">Redo</span></Button>
                   <Button size="sm" variant="secondary" onClick={() => setIsPreviewPlaying(p => !p)}>{isPreviewPlaying ? <Pause size={14} className="md:mr-2"/> : <Play size={14} className="md:mr-2"/>} <span className="hidden md:inline">{isPreviewPlaying ? 'Pause' : 'Play'}</span></Button>
                   <Button size="sm" onClick={handleRenderMovie} disabled={isRendering}>
                       {isRendering ? <Loader2 size={14} className="animate-spin md:mr-2"/> : <Download size={14} className="md:mr-2"/>}
                       <span className="hidden md:inline">{isRendering ? `Rendering ${renderProgress}%` : 'Render Final Cut'}</span>
                   </Button>
              </div>
          </div>
          
          <div className="flex-1 overflow-x-auto bg-gray-900 rounded-xl border border-gray-800 p-6 relative select-none" ref={timelineRef}>
              {/* Time Ruler Click Area */}
              <div className="absolute top-0 left-0 right-0 h-8 border-b border-gray-800 flex items-end cursor-pointer z-20 min-w-max" onClick={handleTimelineClick} style={{ width: Math.max(1000, totalWidth + 100) }}>
                  {[...Array(Math.ceil(totalDuration / 2) + 5)].map((_, i) => (
                      <div key={i} className="absolute border-l border-gray-700 h-3 text-[10px] text-gray-500 pl-1 pointer-events-none" style={{ left: i * 2 * PIXELS_PER_SECOND + 24 }}>
                          {i * 2}s
                      </div>
                  ))}
              </div>

              {/* Playhead */}
              <div className="absolute top-8 bottom-0 w-px bg-red-500 z-30 pointer-events-none transition-all duration-100" style={{ left: currentTime * PIXELS_PER_SECOND + 24 }}>
                  <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-red-500 rotate-45"></div>
                  <div className="absolute top-0 left-1.5 text-[9px] bg-red-500 text-white px-1 rounded">{currentTime.toFixed(1)}s</div>
              </div>

              <div className="flex flex-col gap-4 pt-10 pb-4 min-w-max pl-6">
                  {/* Video Track */}
                  <div className="flex items-center h-40 relative">
                      <div className="absolute inset-0 flex items-center h-1 bg-gray-800 z-0"></div>
                      {selectedPost?.scenes?.map((scene, idx) => (
                          <React.Fragment key={scene.id}>
                              <div 
                                  className={`relative z-10 group ${draggedSceneIndex === idx ? 'opacity-50' : ''}`}
                                  draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={() => handleDrop(idx)}
                                  style={{ width: (scene.duration || 5) * PIXELS_PER_SECOND }}
                              >
                                  <div className="absolute -top-8 left-0 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 z-20">
                                      <button onClick={() => handleSplitScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-primary-600 text-gray-400 hover:text-white" title="Split"><Scissors size={12} /></button>
                                      <button onClick={() => handleDuplicateScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-primary-600 text-gray-400 hover:text-white" title="Duplicate"><Copy size={12} /></button>
                                      <button onClick={() => handleDeleteScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-red-600 text-gray-400 hover:text-white" title="Delete"><Trash2 size={12} /></button>
                                  </div>

                                  <div className={`w-full h-full bg-black rounded-lg border-2 border-gray-700 overflow-hidden relative shadow-lg group-hover:border-primary-500 transition-colors flex-shrink-0 ${scene.bgRemoved ? 'bg-[url(https://www.transparenttextures.com/patterns/checkered-pattern.png)]' : ''}`}>
                                      {scene.imageUrl ? (
                                          <img src={scene.imageUrl} className={`w-full h-full object-cover ${scene.bgRemoved ? 'object-contain' : ''}`} draggable={false} />
                                      ) : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No Visual</div>}
                                      
                                      <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded z-10"><Clock size={8} className="inline mr-0.5"/> {scene.duration?.toFixed(1)}s</div>
                                      
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-wrap p-2 content-center cursor-grab active:cursor-grabbing">
                                          <div className="flex flex-col gap-1 w-full px-2">
                                              <button onClick={() => handleOpenTrim(scene.id)} className="w-full py-1 bg-blue-900/80 rounded text-[9px] text-blue-200 hover:text-white flex items-center justify-center gap-1"><Sliders size={10} /> Trim</button>
                                              <button onClick={() => handleOpenMagicEdit(scene.id)} className="w-full py-1 bg-purple-900/80 rounded text-[9px] text-purple-200 hover:text-white flex items-center justify-center gap-1"><Wand2 size={10} /> Edit</button>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="mt-2 text-[9px] text-gray-500 truncate w-full text-center px-1">{idx+1}. {scene.description}</div>
                              </div>

                              {/* Transition Node */}
                              {idx < (selectedPost?.scenes?.length || 0) - 1 && (
                                  <div className="relative z-10 w-6 flex flex-col items-center justify-center cursor-pointer -ml-3 -mr-3 group/trans" onClick={() => updateSceneWithHistory(scene.id, { transition: cycleTransition(scene.transition) })} style={{ zIndex: 20 }}>
                                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-gray-900 transition-colors shadow-md ${scene.transition && scene.transition !== 'cut' ? 'border-purple-500 text-purple-500' : 'border-gray-600 text-gray-600'}`}>
                                          {scene.transition && scene.transition !== 'cut' ? <Layers size={10} /> : <ArrowRightLeft size={10} />}
                                      </div>
                                  </div>
                              )}
                          </React.Fragment>
                      ))}
                      <div className="w-12 h-full rounded-lg border-2 border-dashed border-gray-800 flex items-center justify-center text-gray-600 hover:text-white hover:border-gray-600 cursor-pointer ml-2 transition-colors" onClick={() => handleGenerateImage(selectedPost?.scenes?.[0]?.id || '')}><Plus size={20} /></div>
                  </div>

                  {/* Audio Track */}
                  <div className="flex items-center h-12 relative border-t border-gray-800 mt-4 pt-4">
                     <div className="absolute left-0 -ml-24 w-20 text-xs font-bold text-gray-500 flex items-center gap-2"><Volume2 size={12}/> Audio</div>
                     {activeAudioTrack ? (
                         <div className="h-8 rounded bg-blue-900/40 border border-blue-700/50 flex items-center px-3 relative overflow-hidden" style={{ width: activeAudioTrack.duration * PIXELS_PER_SECOND }}>
                             <div className="absolute inset-0 opacity-20 flex items-center gap-0.5">{[...Array(Math.floor(activeAudioTrack.duration * 2))].map((_, i) => <div key={i} className="w-1 bg-blue-300" style={{ height: `${20 + Math.random() * 60}%` }}></div>)}</div>
                             <div className="relative z-10 text-xs text-blue-100 font-medium truncate">{activeAudioTrack.name}</div>
                         </div>
                     ) : <div className="h-8 w-full flex items-center justify-center text-xs text-gray-700 border border-dashed border-gray-800 rounded">No Soundtrack Selected</div>}
                  </div>
              </div>
          </div>
      </div>
      );
  };

  const PreviewModal = () => {
     const currentScene = selectedPost?.scenes?.[previewIndex];
     const activeAudioTrack = audioTracks.find(t => t.id === selectedPost?.audioTrackId);
     const audioRef = useRef<HTMLAudioElement>(null);

     useEffect(() => {
         if (activeAudioTrack && audioRef.current) {
             if (isPreviewPlaying) {
                 if (previewIndex === 0) audioRef.current.currentTime = 0;
                 audioRef.current.play().catch(e => console.log("Audio play failed", e));
             } else audioRef.current.pause();
         }
     }, [isPreviewPlaying, activeAudioTrack, previewIndex]);
     
     const getTransitionStyle = (transition: Scene['transition']) => {
        switch(transition) {
            case 'fade': return 'animate-[fadeIn_1s_ease-in-out]';
            case 'slide-left': return 'animate-[slideInRight_0.5s_ease-out]';
            case 'slide-right': return 'animate-[slideInLeft_0.5s_ease-out]';
            case 'zoom': return 'animate-[zoomIn_0.8s_ease-out]';
            case 'blur': return 'animate-[blurIn_0.8s_ease-out]';
            case 'wipe': return 'animate-[wipeIn_0.5s_linear]';
            case 'dissolve': return 'opacity-0 animate-[fadeIn_1.5s_ease-in_forwards]';
            default: return '';
        }
     };

     return (
     <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
         <style>{`
           @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
           @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
           @keyframes zoomIn { from { transform: scale(1.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
           @keyframes blurIn { from { filter: blur(20px); opacity: 0; } to { filter: blur(0); opacity: 1; } }
           @keyframes wipeIn { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
           @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
         `}</style>
         
         {activeAudioTrack && activeAudioTrack.audioUrl && <audio ref={audioRef} src={activeAudioTrack.audioUrl} loop />}

         <div className="w-full max-w-4xl aspect-video bg-black relative rounded-xl overflow-hidden shadow-2xl border border-gray-800">
             {currentScene ? (
                 <div key={currentScene.id} className={`absolute inset-0 w-full h-full ${getTransitionStyle(currentScene.transition)}`}>
                    {currentScene.videoUrl ? (
                        <video src={currentScene.videoUrl} className="w-full h-full object-cover" autoPlay muted onLoadedMetadata={(e) => { e.currentTarget.currentTime = currentScene.mediaStartTime || 0; }} />
                    ) : <img src={currentScene.imageUrl || ''} className={`w-full h-full object-cover ${currentScene.bgRemoved ? 'object-contain' : ''}`} />}
                    <div className="absolute bottom-8 left-0 right-0 text-center z-30">
                         <div className="inline-block bg-black/50 backdrop-blur px-4 py-2 rounded-full text-white text-sm font-medium">Scene {previewIndex + 1}: {currentScene.description}</div>
                    </div>
                 </div>
             ) : <div className="flex items-center justify-center h-full text-gray-500">No scenes to preview</div>}
         </div>
         <div className="mt-6 flex gap-4 items-center">
             <Button onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}>{isPreviewPlaying ? <Pause size={20} /> : <Play size={20} />}{isPreviewPlaying ? 'Pause' : 'Play'}</Button>
             <Button variant="secondary" onClick={() => { setIsPreviewPlaying(false); setShowPreviewModal(false); setCurrentTime(0); }}>Close Preview</Button>
             <div className="text-gray-400 text-sm font-mono">{previewIndex + 1} / {selectedPost?.scenes?.length || 0}</div>
         </div>
     </div>
     );
  };
  
  const CalendarView = () => {
      const days = Array.from({length: 35}, (_, i) => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + i); return d; });
      const today = new Date();
      const [selectedDayPost, setSelectedDayPost] = useState<SocialPost | null>(null);

      const getPlatformColor = (p: string) => {
          if(p === 'youtube') return 'bg-red-500';
          if(p === 'twitter') return 'bg-blue-500';
          if(p === 'instagram') return 'bg-pink-500';
          if(p === 'tiktok') return 'bg-black border border-gray-700';
          return 'bg-gray-500';
      };

      return (
          <div className="flex-1 p-4 md:p-8 overflow-hidden flex gap-4">
             <div className="flex-1 flex flex-col">
                 <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-white">Content Schedule</h2><div className="text-sm text-gray-500">{today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div></div>
                 <div className="bg-gray-900 border border-gray-800 rounded-xl flex-1 overflow-x-auto flex flex-col shadow-xl">
                     <div className="min-w-[600px] grid grid-cols-7 border-b border-gray-800 bg-gray-850">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (<div key={day} className="p-3 text-center text-xs font-medium text-gray-500 uppercase">{day}</div>))}</div>
                     <div className="min-w-[600px] grid grid-cols-7 grid-rows-5 flex-1">
                         {days.map((date, i) => {
                             const dayPosts = posts.filter(p => { if (p.scheduledDate) return new Date(p.scheduledDate).toDateString() === date.toDateString(); return !p.scheduledDate && parseInt(p.id.slice(-2)) % 30 === i; });
                             const isToday = date.toDateString() === today.toDateString();
                             return (
                                 <div key={i} className={`border border-gray-800/50 p-2 flex flex-col gap-1 min-h-[100px] transition-colors ${date.getMonth() !== today.getMonth() ? 'bg-gray-900/30 text-gray-600' : 'bg-gray-900 hover:bg-gray-800'}`}>
                                     <div className={`text-xs mb-1 font-mono ${isToday ? 'text-primary-400 font-bold' : 'text-gray-500'}`}>{date.getDate()}</div>
                                     {dayPosts.map(post => (
                                         <div 
                                            key={post.id} 
                                            onClick={() => setSelectedDayPost(post)} 
                                            className={`text-[10px] p-1 rounded truncate cursor-pointer text-white shadow-sm hover:scale-105 transition-transform ${getPlatformColor(post.platform)}`}
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
             
             {/* Side Detail Panel */}
             <div className={`w-80 bg-gray-900 border-l border-gray-800 flex-shrink-0 transition-all duration-300 ${selectedDayPost ? 'mr-0' : '-mr-80 hidden'}`}>
                 {selectedDayPost && (
                     <div className="p-6 h-full flex flex-col">
                         <div className="flex justify-between items-start mb-4">
                             <h3 className="font-bold text-white text-lg line-clamp-2">{selectedDayPost.title}</h3>
                             <button onClick={() => setSelectedDayPost(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                         </div>
                         <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-white mb-4 w-fit ${getPlatformColor(selectedDayPost.platform)}`}>
                             <span className="capitalize">{selectedDayPost.platform}</span>
                         </div>
                         
                         <div className="space-y-4 flex-1 overflow-y-auto">
                             <div className="bg-black/30 p-3 rounded-lg border border-gray-800">
                                 <div className="text-xs text-gray-500 uppercase font-bold mb-1">Status</div>
                                 <div className="text-sm text-white capitalize">{selectedDayPost.status}</div>
                             </div>
                             <div className="bg-black/30 p-3 rounded-lg border border-gray-800">
                                 <div className="text-xs text-gray-500 uppercase font-bold mb-1">Scheduled</div>
                                 <div className="text-sm text-white">{selectedDayPost.scheduledDate ? new Date(selectedDayPost.scheduledDate).toDateString() : 'Unscheduled'}</div>
                             </div>
                             {selectedDayPost.thumbnail && (
                                 <div className="rounded-lg overflow-hidden border border-gray-800">
                                     <img src={selectedDayPost.thumbnail} className="w-full h-32 object-cover" />
                                 </div>
                             )}
                         </div>
                         
                         <Button className="mt-4 w-full" onClick={() => { setSelectedPost(selectedDayPost); setActiveView('detail'); }}>
                             Open Editor
                         </Button>
                     </div>
                 )}
             </div>
          </div>
      );
  };

  const KanbanColumn = ({ title, status, color }: { title: string, status: SocialPost['status'], color: string }) => (
    <div className="flex-1 min-w-[280px] bg-gray-900/50 rounded-xl p-4 border border-gray-800 flex flex-col h-full">
      <div className={`text-xs font-bold uppercase tracking-wider mb-4 flex items-center justify-between ${color} bg-gray-900/80 p-2 rounded-lg`}>{title}<span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px]">{posts.filter(p => p.status === status).length}</span></div>
      <div className="space-y-3 overflow-y-auto flex-1 pr-1">{posts.filter(p => p.status === status).map(post => (<div key={post.id} onClick={() => { setSelectedPost(post); setActiveView('detail'); }} className="bg-gray-800 p-3 rounded-lg border border-gray-700 shadow-sm hover:border-primary-500/50 hover:bg-gray-750 transition-all group cursor-pointer relative"><h4 className="text-sm font-medium text-gray-200 mb-2 line-clamp-2 group-hover:text-white">{post.title}</h4><div className="flex justify-between items-center mt-2"><span className="text-[10px] text-gray-500 capitalize">{post.platform}</span><span className="text-[10px] text-gray-500">2d ago</span></div></div>))}</div>
    </div>
  );

  const StrategyView = () => (
      <div className="flex-1 p-8 overflow-y-auto bg-gray-950">
          <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Target className="text-red-500" /> Content Strategy</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Users size={18} className="text-blue-400"/> Target Audience</h3>
                      <textarea 
                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-sm text-white h-32 focus:border-primary-500 outline-none" 
                        placeholder="Describe your ideal viewer..."
                        value={strategy.targetAudience}
                        onChange={e => setStrategy(s => ({...s, targetAudience: e.target.value}))}
                      />
                  </div>
                  <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-green-400"/> Core Goals</h3>
                      <div className="space-y-2">
                          {['brand_awareness', 'conversion', 'engagement', 'traffic'].map(goal => (
                              <div key={goal} 
                                onClick={() => setStrategy(s => ({...s, primaryGoal: goal as any}))}
                                className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${strategy.primaryGoal === goal ? 'bg-primary-900/30 border-primary-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}
                              >
                                  <span className="capitalize">{goal.replace('_', ' ')}</span>
                                  {strategy.primaryGoal === goal && <div className="w-2 h-2 rounded-full bg-primary-500"></div>}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-8">
                  <h3 className="text-lg font-semibold text-white mb-4">Content Pillars</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[0, 1, 2].map(i => (
                          <input 
                            key={i}
                            type="text"
                            placeholder={`Pillar ${i+1} (e.g., Educational)`}
                            className="bg-black/50 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-primary-500 outline-none"
                            value={strategy.contentPillars[i] || ''}
                            onChange={e => {
                                const newPillars = [...strategy.contentPillars];
                                newPillars[i] = e.target.value;
                                setStrategy(s => ({...s, contentPillars: newPillars}));
                            }}
                          />
                      ))}
                  </div>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-6 flex items-start gap-4">
                  <Sparkles className="text-blue-400 mt-1 flex-shrink-0" />
                  <div>
                      <h4 className="text-white font-medium mb-1">AI Optimization Active</h4>
                      <p className="text-sm text-blue-200">Omni uses your strategy to tailor script tone, hashtag selection, and visual style for every new post you generate.</p>
                  </div>
              </div>
          </div>
      </div>
  );

  const UploadModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Upload className="text-primary-500" /> Publish to {selectedPost?.platform}</h3><button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-white"><X size={20}/></button></div>
            <div className="space-y-4 mb-6">
                <div><label className="block text-xs font-medium text-gray-400 mb-1">Video Title</label><input type="text" defaultValue={selectedPost?.title} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary-500"/></div>
                 <div className="bg-gray-800 rounded-lg p-4 border border-gray-700"><div className="flex justify-between text-xs text-gray-400 mb-2"><span>Upload Status</span><span>{Math.round(uploadProgress)}%</span></div><div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden"><div className="bg-primary-500 h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div></div></div>
                <div className="flex gap-3 mt-4"><Button variant="secondary" className="flex-1" onClick={() => setShowUploadModal(false)}>Cancel</Button><Button className="flex-1" onClick={handleConfirmUpload} disabled={isUploading}>{isUploading ? 'Publishing...' : 'Publish Now'}</Button></div>
            </div>
        </div>
    </div>
  );

  const EditModal = () => (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Wand2 className="text-purple-500" /> Magic Scene Edit</h3><button onClick={() => setEditModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button></div>
              <div className="space-y-4"><p className="text-xs text-gray-400">Describe how you want to change this scene.</p><textarea className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-purple-500" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Enter your edit instructions..." autoFocus /><div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setEditModalOpen(false)}>Cancel</Button><Button onClick={handleMagicEditSubmit} disabled={isEditingImage || !editPrompt}>{isEditingImage ? <Loader2 size={16} className="animate-spin mr-2"/> : <Sparkles size={16} className="mr-2"/>}{isEditingImage ? 'Processing...' : 'Apply Magic'}</Button></div></div>
          </div>
      </div>
  );
  
  const ProStudioView = () => (
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-y-auto bg-gray-950">
          <div className="w-full md:w-1/3 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col min-h-[300px]"><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={16}/> Character Bank</h3><div className="flex-1 overflow-y-auto space-y-4 mb-4">{selectedPost?.characters?.map((char) => (<div key={char.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg border border-gray-700"><img src={char.imageUrl} className="w-10 h-10 rounded-full object-cover border border-gray-600" /><div className="flex-1 min-w-0"><div className="text-sm font-medium text-gray-200">{char.name}</div>{char.description && <div className="text-[10px] text-gray-500 truncate" title={char.description}>Analyzed: {char.description.substring(0, 30)}...</div>}</div></div>))}</div><div className="border-t border-gray-800 pt-4"><input type="text" placeholder="Character Name" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs mb-2 text-white" value={characterName} onChange={e => setCharacterName(e.target.value)} /><input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadCharacter} accept="image/*" /><Button size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={!characterName || isAnalyzingChar}>{isAnalyzingChar ? <Loader2 size={14} className="animate-spin mr-2"/> : <Plus size={14} className="mr-2"/>} {isAnalyzingChar ? 'Analyzing Features...' : 'Add Character'}</Button></div></div>
          <div className="w-full md:w-1/3 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col min-h-[300px]"><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Palette size={16}/> Style Matcher</h3><div className="flex-1 overflow-y-auto space-y-4 mb-4">{selectedPost?.styleReferences?.map((ref) => (<div key={ref.id} className="p-3 bg-gray-800 rounded-lg border border-gray-700"><div className="h-24 bg-black rounded mb-2 overflow-hidden"><img src={ref.url} className="w-full h-full object-cover opacity-70" /></div><div className="text-[10px] text-gray-400 italic line-clamp-3">"{ref.stylePrompt}"</div></div>))}</div><div className="border-t border-gray-800 pt-4"><input type="file" ref={refInputRef} className="hidden" onChange={handleUploadReference} accept="image/*" /><Button size="sm" variant="secondary" className="w-full" onClick={() => refInputRef.current?.click()}><Upload size={14} className="mr-2"/> Upload Reference</Button></div></div>
           <div className="w-full md:w-1/3 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col justify-center items-center text-center min-h-[200px]"><div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 text-primary-500"><Wand2 size={32} /></div><h3 className="text-white font-bold mb-2">AI Director</h3><p className="text-xs text-gray-400 mb-6">I will automatically adjust your scene prompts to match your uploaded characters and style references.</p><div className="text-xs text-green-400 flex items-center gap-2 bg-green-900/20 px-3 py-1 rounded-full"><Sparkles size={12} /> Active</div></div>
      </div>
  );

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
       {showUploadModal && <UploadModal />}
       {showPreviewModal && <PreviewModal />}
       {editModalOpen && <EditModal />}
       {trimModalOpen && <TrimModal />}

       {/* Sidebar */}
       <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-6 shadow-xl z-10 hidden md:flex">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Clapperboard className="text-red-500" /> Media Studio</h2>
          <Button onClick={() => { setSelectedPost(null); setActiveView('create'); }} className="mb-6 w-full shadow-lg shadow-primary-900/20"><Plus size={16} className="mr-2" /> New Content</Button>
          <div className="space-y-1 mb-6">
             <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">Views</div>
             <button onClick={() => setActiveView('kanban')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${activeView === 'kanban' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}><LayoutGrid size={16} /> Pipeline</button>
             <button onClick={() => setActiveView('calendar')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${activeView === 'calendar' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}><Calendar size={16} /> Schedule</button>
             <button onClick={() => setActiveView('strategy')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${activeView === 'strategy' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}><Target size={16} /> Strategy</button>
          </div>
       </div>

       {/* Main Content */}
       <div className="flex-1 flex flex-col overflow-hidden bg-gray-950 relative">
          <div className="md:hidden p-4 border-b border-gray-800 flex justify-between items-center">
              <h2 className="font-bold flex items-center gap-2"><Clapperboard className="text-red-500" /> Media</h2>
              <Button size="sm" onClick={() => { setSelectedPost(null); setActiveView('create'); }}><Plus size={14} /></Button>
          </div>
          {/* View Toggle for Mobile */}
          <div className="md:hidden flex border-b border-gray-800 overflow-x-auto">
              <button onClick={() => setActiveView('kanban')} className={`flex-1 py-3 px-4 text-xs font-medium whitespace-nowrap ${activeView === 'kanban' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}>Pipeline</button>
              <button onClick={() => setActiveView('calendar')} className={`flex-1 py-3 px-4 text-xs font-medium whitespace-nowrap ${activeView === 'calendar' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}>Schedule</button>
              <button onClick={() => setActiveView('strategy')} className={`flex-1 py-3 px-4 text-xs font-medium whitespace-nowrap ${activeView === 'strategy' ? 'text-white border-b-2 border-primary-500' : 'text-gray-500'}`}>Strategy</button>
          </div>

          {activeView === 'kanban' && (<div className="flex-1 p-4 md:p-8 overflow-x-auto"><div className="flex gap-6 h-full min-w-[1000px] md:min-w-0"><KanbanColumn title="Ideation" status="idea" color="text-yellow-400" /><KanbanColumn title="Scripting" status="scripting" color="text-blue-400" /><KanbanColumn title="In Production" status="generating" color="text-pink-400" /><KanbanColumn title="Ready" status="ready" color="text-green-400" /></div></div>)}
          {activeView === 'calendar' && <CalendarView />}
          {activeView === 'strategy' && <StrategyView />}
          {activeView === 'create' && (<div className="flex-1 p-4 md:p-8 overflow-y-auto"><div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500"><button className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors" onClick={() => setActiveView('kanban')}>&larr; Back</button><h1 className="text-2xl md:text-3xl font-bold mb-6">Create Viral Content</h1><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">{['youtube', 'twitter', 'tiktok', 'instagram'].map(p => (<div key={p} onClick={() => setSelectedPlatform(p)} className={`p-4 bg-gray-900 border rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer capitalize ${selectedPlatform === p ? 'border-primary-500 bg-gray-800' : 'border-gray-800'}`}><span className="text-sm font-medium">{p}</span></div>))}</div><div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6"><textarea className="w-full h-32 bg-black border border-gray-700 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-primary-500 transition-colors" placeholder="Describe your idea..." value={newPostPrompt} onChange={(e) => setNewPostPrompt(e.target.value)} /></div><Button size="lg" className="w-full py-4 text-base" onClick={handleCreateContentPlan} disabled={isGeneratingPlan}>{isGeneratingPlan ? 'Generating...' : 'Generate Content Plan'}</Button></div></div>)}
          {activeView === 'detail' && selectedPost && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                <div className="h-16 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4 md:px-6"><div className="flex items-center gap-4"><button className="text-gray-500 hover:text-white" onClick={() => setActiveView('kanban')}><X size={20} /></button><div><h2 className="font-bold text-white truncate max-w-[150px] md:max-w-md">{selectedPost.title}</h2></div></div><div className="flex gap-2"><div className="bg-gray-800 rounded-lg p-1 flex gap-1"><button onClick={() => setDetailTab('script')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${detailTab === 'script' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>Script</button><button onClick={() => setDetailTab('pro')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${detailTab === 'pro' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>Pro</button><button onClick={() => setDetailTab('timeline')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${detailTab === 'timeline' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>Director</button></div><Button size="sm" variant="secondary" onClick={handleSaveDraft} className="hidden md:flex"><Save size={14} className="mr-2"/> Save</Button><Button size="sm" onClick={(e) => handleOpenUpload(selectedPost, e)} className="hidden md:flex"><Upload size={14} className="mr-2"/> Publish</Button></div></div>
                {detailTab === 'timeline' ? <DirectorView /> : detailTab === 'pro' ? <ProStudioView /> : (<div className="flex-1 flex flex-col md:flex-row overflow-hidden"><div className="w-full md:w-1/2 border-r border-gray-800 bg-gray-900 p-6 overflow-y-auto"><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><FileText size={16}/> Script</h3><textarea className="w-full h-[300px] md:h-[calc(100%-2rem)] bg-black/50 border border-gray-800 rounded-xl p-6 text-gray-300 leading-relaxed focus:outline-none font-mono text-sm" defaultValue={selectedPost.script} /></div><div className="w-full md:w-1/2 bg-gray-950 p-6 overflow-y-auto"><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><LayoutGrid size={16}/> Scenes</h3><div className="space-y-6">{selectedPost.scenes?.map((scene, idx) => (<div key={scene.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"><div className="p-3 border-b border-gray-800 bg-gray-850 flex justify-between items-center"><span className="text-xs font-bold text-gray-500">SCENE {idx + 1}</span><div className="flex gap-1"><button onClick={() => handleGenerateImage(scene.id)} disabled={scene.status === 'generating'} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">{scene.status === 'generating' ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14}/>}</button><button onClick={() => handleGenerateVideo(scene.id)} disabled={scene.status === 'generating'} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">{scene.status === 'generating' ? <Loader2 size={14} className="animate-spin"/> : <Video size={14}/>}</button></div></div><div className="p-4"><p className="text-sm text-gray-300 mb-4">{scene.description}</p><div className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden group border border-gray-800">{scene.videoUrl ? <video src={scene.videoUrl} controls className="w-full h-full object-cover" /> : scene.imageUrl ? <img src={scene.imageUrl} className={`w-full h-full object-cover ${scene.bgRemoved ? 'object-contain' : ''}`} /> : <div className="text-gray-700 flex flex-col items-center gap-2"><Sparkles size={24} /><span className="text-xs">No visuals</span></div>}</div></div></div>))}</div></div></div>)}
            </div>
          )}
       </div>
    </div>
  );
};
