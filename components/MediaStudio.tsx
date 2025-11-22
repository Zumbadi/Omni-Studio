
import React, { useState, useEffect, useRef } from 'react';
import { Clapperboard, Plus, Upload, Image as ImageIcon, Wand2, X, Video, Loader2, Sparkles, Save, Calendar, LayoutGrid, FileText, Target, Scissors } from 'lucide-react';
import { Button } from './Button';
import { MOCK_SOCIAL_POSTS } from '../constants';
import { SocialPost, Scene, Character, ReferenceAsset, AudioTrack, ContentStrategy } from '../types';
import { generateSocialContent, generateImage, generateVideo, analyzeMediaStyle, removeBackground, analyzeCharacterFeatures, editImage } from '../services/geminiService';
import { MediaKanban } from './MediaKanban';
import { MediaCalendar } from './MediaCalendar';
import { MediaStrategy } from './MediaStrategy';
import { MediaDirectorView } from './MediaDirectorView';
import { MediaProTools } from './MediaProTools';

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

  // Pro Studio State
  const [characterName, setCharacterName] = useState('');
  const [isAnalyzingChar, setIsAnalyzingChar] = useState(false);
  
  // Audio Integration State
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  
  // Undo/Redo History State
  const [history, setHistory] = useState<SocialPost[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Pro Timeline State
  const [currentTime, setCurrentTime] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

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

  // Preview Playback Logic
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

  // Initialize history
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

  // ... (Keep all creation/generation logic same as before) ...
  const handleCreateContentPlan = async () => {
    if (!newPostPrompt) return;
    setIsGeneratingPlan(true);
    const strategyContext = `Target Audience: ${strategy.targetAudience}, Goal: ${strategy.primaryGoal}, Tone: ${strategy.toneVoice}`;
    const fullPrompt = `${newPostPrompt}. Context: ${strategyContext}`;
    let generatedScript = "";
    await generateSocialContent(fullPrompt, selectedPlatform, (chunk) => { generatedScript += chunk; });
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
      id: `p${Date.now()}`, title: title, platform: selectedPlatform as any, status: 'idea', script: generatedScript,
      scenes: defaultScenes, scheduledDate: futureDate.toISOString(), characters: [], styleReferences: []
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

  const handleGenerateImage = async (sceneId: string) => {
     if (!selectedPost) return;
     const scene = selectedPost.scenes?.find(s => s.id === sceneId);
     if (!scene) return;
     updateScene(sceneId, { status: 'generating' });
     const enhancedPrompt = getEnhancedPrompt(scene.description);
     const stylePrompt = selectedPost.styleReferences?.[0]?.stylePrompt;
     const imageUrl = await generateImage(enhancedPrompt, stylePrompt);
     if (imageUrl) updateScene(sceneId, { imageUrl, status: 'done' });
     else updateScene(sceneId, { status: 'pending' });
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
      updateScene(sceneId, { status: 'generating' });
      const enhancedPrompt = getEnhancedPrompt(scene.description);
      const videoUrl = await generateVideo(enhancedPrompt, scene.imageUrl);
      if (videoUrl) updateScene(sceneId, { videoUrl, status: 'done' });
      else updateScene(sceneId, { status: 'pending' });
  };

  // ... Magic Edit ...
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

  // ... Trim ...
  const handleApplyTrim = () => {
      if (trimSceneId) {
          updateSceneWithHistory(trimSceneId, { mediaStartTime: trimValues.start, duration: trimValues.duration });
          setTrimModalOpen(false);
      }
  };

  // ... Upload ...
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

  // ... Pro Helpers ...
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
     setIsRendering(true); setRenderProgress(0);
     let p = 0;
     const int = setInterval(() => { p += 2; setRenderProgress(p); if (p >= 100) { clearInterval(int); setIsRendering(false); alert("Render Complete! Downloading final cut..."); } }, 100);
  };

  // ... Scene Manipulation ...
  const handleSplitScene = (index: number) => {
      if (!selectedPost?.scenes) return;
      const scenes = [...selectedPost.scenes];
      const scene = scenes[index];
      const splitPoint = (scene.duration || 5) / 2;
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
      return types[(types.indexOf(current || 'cut') + 1) % types.length];
  };

  // ... Modals ...
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

  const TrimModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Scissors className="text-blue-500" /> Precision Trim</h3><button onClick={() => setTrimModalOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button></div>
            <div className="space-y-6">
                <div><label className="flex justify-between text-xs font-medium text-gray-400 mb-2"><span>Start Offset</span><span className="text-white">{trimValues.start.toFixed(2)}s</span></label><input type="range" min="0" max="10" step="0.1" value={trimValues.start} onChange={(e) => setTrimValues(prev => ({...prev, start: parseFloat(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" /></div>
                <div><label className="flex justify-between text-xs font-medium text-gray-400 mb-2"><span>Duration</span><span className="text-white">{trimValues.duration.toFixed(2)}s</span></label><input type="range" min="0.5" max="20" step="0.5" value={trimValues.duration} onChange={(e) => setTrimValues(prev => ({...prev, duration: parseFloat(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" /></div>
                <div className="bg-black p-4 rounded-lg border border-gray-800 flex justify-center text-xs text-gray-500 font-mono">Play Region: {trimValues.start.toFixed(1)}s → {(trimValues.start + trimValues.duration).toFixed(1)}s</div>
                <div className="flex gap-3 justify-end"><Button variant="secondary" onClick={() => setTrimModalOpen(false)}>Cancel</Button><Button onClick={handleApplyTrim}>Apply Trim</Button></div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
       {showUploadModal && <UploadModal />}
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

          {activeView === 'kanban' && <MediaKanban posts={posts} onSelectPost={(p) => { setSelectedPost(p); setActiveView('detail'); }} />}
          {activeView === 'calendar' && <MediaCalendar posts={posts} onSelectPost={(p) => { setSelectedPost(p); setActiveView('detail'); }} />}
          {activeView === 'strategy' && <MediaStrategy strategy={strategy} setStrategy={setStrategy} />}
          
          {activeView === 'create' && (<div className="flex-1 p-4 md:p-8 overflow-y-auto"><div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500"><button className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors" onClick={() => setActiveView('kanban')}>&larr; Back</button><h1 className="text-2xl md:text-3xl font-bold mb-6">Create Viral Content</h1><div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">{['youtube', 'twitter', 'tiktok', 'instagram'].map(p => (<div key={p} onClick={() => setSelectedPlatform(p)} className={`p-4 bg-gray-900 border rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer capitalize ${selectedPlatform === p ? 'border-primary-500 bg-gray-800' : 'border-gray-800'}`}><span className="text-sm font-medium">{p}</span></div>))}</div><div className="bg-gray-900 rounded-xl p-6 border border-gray-800 mb-6"><textarea className="w-full h-32 bg-black border border-gray-700 rounded-lg p-4 text-gray-200 focus:outline-none focus:border-primary-500 transition-colors" placeholder="Describe your idea..." value={newPostPrompt} onChange={(e) => setNewPostPrompt(e.target.value)} /></div><Button size="lg" className="w-full py-4 text-base" onClick={handleCreateContentPlan} disabled={isGeneratingPlan}>{isGeneratingPlan ? 'Generating...' : 'Generate Content Plan'}</Button></div></div>)}
          
          {activeView === 'detail' && selectedPost && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                <div className="h-16 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4 md:px-6"><div className="flex items-center gap-4"><button className="text-gray-500 hover:text-white" onClick={() => setActiveView('kanban')}><X size={20} /></button><div><h2 className="font-bold text-white truncate max-w-[150px] md:max-w-md">{selectedPost.title}</h2></div></div><div className="flex gap-2"><div className="bg-gray-800 rounded-lg p-1 flex gap-1"><button onClick={() => setDetailTab('script')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${detailTab === 'script' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>Script</button><button onClick={() => setDetailTab('pro')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${detailTab === 'pro' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>Pro</button><button onClick={() => setDetailTab('timeline')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${detailTab === 'timeline' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>Director</button></div><Button size="sm" variant="secondary" onClick={() => {}} className="hidden md:flex"><Save size={14} className="mr-2"/> Save</Button><Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedPost(selectedPost); setShowUploadModal(true); setUploadProgress(0); setIsUploading(false); }} className="hidden md:flex"><Upload size={14} className="mr-2"/> Publish</Button></div></div>
                
                {detailTab === 'timeline' ? (
                    <MediaDirectorView 
                        selectedPost={selectedPost}
                        audioTracks={audioTracks}
                        currentTime={currentTime}
                        setCurrentTime={setCurrentTime}
                        isPreviewPlaying={isPreviewPlaying}
                        setIsPreviewPlaying={setIsPreviewPlaying}
                        isRendering={isRendering}
                        renderProgress={renderProgress}
                        onSelectAudio={handleSelectAudio}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        onRenderMovie={handleRenderMovie}
                        onGenerateImage={handleGenerateImage}
                        onSplitScene={handleSplitScene}
                        onDuplicateScene={handleDuplicateScene}
                        onDeleteScene={handleDeleteScene}
                        onOpenTrim={(id) => { setTrimSceneId(id); setTrimValues({start: 0, duration: 5}); setTrimModalOpen(true); }}
                        onOpenMagicEdit={(id) => { setEditSceneId(id); setEditPrompt(''); setEditModalOpen(true); }}
                        onUpdateScene={updateSceneWithHistory}
                        cycleTransition={cycleTransition}
                        historyIndex={historyIndex}
                        historyLength={history.length}
                    />
                ) : detailTab === 'pro' ? (
                    <MediaProTools 
                        selectedPost={selectedPost}
                        characterName={characterName}
                        setCharacterName={setCharacterName}
                        isAnalyzingChar={isAnalyzingChar}
                        onUploadCharacter={handleUploadCharacter}
                        onUploadReference={handleUploadReference}
                    />
                ) : (
                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                        <div className="w-full md:w-1/2 border-r border-gray-800 bg-gray-900 p-6 overflow-y-auto"><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><FileText size={16}/> Script</h3><textarea className="w-full h-[300px] md:h-[calc(100%-2rem)] bg-black/50 border border-gray-800 rounded-xl p-6 text-gray-300 leading-relaxed focus:outline-none font-mono text-sm" defaultValue={selectedPost.script} /></div>
                        <div className="w-full md:w-1/2 bg-gray-900 p-6 overflow-y-auto"><h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><LayoutGrid size={16}/> Scenes</h3><div className="space-y-6">{selectedPost.scenes?.map((scene, idx) => (<div key={scene.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"><div className="p-3 border-b border-gray-800 bg-gray-850 flex justify-between items-center"><span className="text-xs font-bold text-gray-500">SCENE {idx + 1}</span><div className="flex gap-1"><button onClick={() => handleGenerateImage(scene.id)} disabled={scene.status === 'generating'} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">{scene.status === 'generating' ? <Loader2 size={14} className="animate-spin"/> : <ImageIcon size={14}/>}</button><button onClick={() => handleGenerateVideo(scene.id)} disabled={scene.status === 'generating'} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">{scene.status === 'generating' ? <Loader2 size={14} className="animate-spin"/> : <Video size={14}/>}</button></div></div><div className="p-4"><p className="text-sm text-gray-300 mb-4">{scene.description}</p><div className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden group border border-gray-800">{scene.videoUrl ? <video src={scene.videoUrl} controls className="w-full h-full object-cover" /> : scene.imageUrl ? <img src={scene.imageUrl} className={`w-full h-full object-cover ${scene.bgRemoved ? 'object-contain' : ''}`} /> : <div className="text-gray-700 flex flex-col items-center gap-2"><Sparkles size={24} /><span className="text-xs">No visuals</span></div>}</div></div></div>))}</div></div>
                    </div>
                )}
            </div>
          )}
       </div>
    </div>
  );
};