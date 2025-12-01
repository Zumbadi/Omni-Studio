
import React, { useRef, useState, useEffect } from 'react';
import { Film, Music, RotateCcw, RotateCw, Pause, Play, Loader2, Download, Scissors, Copy, Trash2, Clock, Sliders, Wand2, Layers, ArrowRightLeft, Plus, Volume2, Monitor, Clapperboard, FileText, Image as ImageIcon, Mic } from 'lucide-react';
import { Button } from './Button';
import { SocialPost, AudioTrack, Scene, Voice } from '../types';

interface MediaDirectorViewProps {
  selectedPost: SocialPost | null;
  audioTracks: AudioTrack[];
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPreviewPlaying: boolean;
  setIsPreviewPlaying: (playing: any) => void;
  isRendering: boolean;
  renderProgress: number;
  onSelectAudio: (trackId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRenderMovie: () => void;
  onGenerateImage: (sceneId: string) => void;
  onGenerateVideo: (sceneId: string) => void;
  onGenerateAudio: (sceneId: string, type: 'voice' | 'sfx' | 'music', prompt: string, voiceId?: string) => Promise<void>;
  onSplitScene: (index: number) => void;
  onDuplicateScene: (index: number) => void;
  onDeleteScene: (index: number) => void;
  onOpenTrim: (sceneId: string) => void;
  onOpenMagicEdit: (sceneId: string) => void;
  onUpdateScene: (sceneId: string, updates: Partial<Scene>) => void;
  onReorderScenes: (fromIndex: number, toIndex: number) => void;
  cycleTransition: (current: Scene['transition']) => Scene['transition'];
  historyIndex: number;
  historyLength: number;
  onAddScene: () => void;
  voices: Voice[];
}

const GENERATION_MESSAGES = [
  "Initializing Veo neural engine...",
  "Analyzing scene composition...",
  "Generating geometry and textures...",
  "Calculating light physics...",
  "Rendering frames...",
  "Applying cinematic motion...",
  "Finalizing video encoding..."
];

export const MediaDirectorView: React.FC<MediaDirectorViewProps> = ({
  selectedPost, audioTracks, currentTime, setCurrentTime, isPreviewPlaying, setIsPreviewPlaying,
  isRendering, renderProgress, onSelectAudio, onUndo, onRedo, onRenderMovie,
  onGenerateImage, onGenerateVideo, onGenerateAudio, onSplitScene, onDuplicateScene, onDeleteScene, onOpenTrim, onOpenMagicEdit, onUpdateScene, onReorderScenes, cycleTransition,
  historyIndex, historyLength, onAddScene, voices
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<HTMLAudioElement[]>([]); // Array for multi-track
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const PIXELS_PER_SECOND = 40;
  
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  
  // Audio Gen State
  const [audioPrompt, setAudioPrompt] = useState('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioMode, setAudioMode] = useState<'voice' | 'sfx' | 'music'>('voice');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(voices[0]?.id || 'def');

  // Calculate Timeline Metrics
  const scenes = selectedPost?.scenes || [];
  let accumulatedTime = 0;
  const sceneMetrics = scenes.map(s => {
      const start = accumulatedTime;
      accumulatedTime += (s.duration || 5);
      return { ...s, startTime: start, endTime: accumulatedTime };
  });
  const totalDuration = accumulatedTime || 10;
  const totalWidth = totalDuration * PIXELS_PER_SECOND;

  // Determine Active Scene for Player
  const activeScene = sceneMetrics.find(s => currentTime >= s.startTime && currentTime < s.endTime) || sceneMetrics[sceneMetrics.length - 1];
  
  // Update prompt when active scene changes
  useEffect(() => {
      if (activeScene) {
          // If the description starts with "[Audio]", try to extract it, else default to description
          // But usually description is visual. Let's just default to description for context.
          setAudioPrompt(activeScene.description || '');
      }
  }, [activeScene?.id]);

  // Sync Video Element if video asset
  useEffect(() => {
      if (activeScene?.videoUrl && videoRef.current) {
          if (isPreviewPlaying) {
              videoRef.current.play().catch(() => {});
          } else {
              videoRef.current.pause();
          }
      }
  }, [isPreviewPlaying, activeScene]);

  // Sync All Audio Elements
  useEffect(() => {
      audioRefs.current.forEach((audio) => {
          if (!audio) return;
          // Simple sync check to prevent stuttering
          if (Math.abs(audio.currentTime - currentTime) > 0.3) {
              audio.currentTime = currentTime;
          }
          
          if (isPreviewPlaying) {
              // Only play if within track range
              const start = parseFloat(audio.dataset.start || '0');
              const duration = parseFloat(audio.dataset.duration || '0');
              const end = start + duration;
              
              if (currentTime >= start && currentTime < end) {
                  audio.play().catch(() => {});
              } else {
                  audio.pause();
              }
          } else {
              audio.pause();
          }
      });
  }, [isPreviewPlaying, currentTime, audioTracks]);

  // Loading Message Loop
  useEffect(() => {
    let interval: any;
    if (activeScene?.status === 'generating') {
        setLoadingMsgIndex(0);
        interval = setInterval(() => {
            setLoadingMsgIndex(prev => (prev + 1) % GENERATION_MESSAGES.length);
        }, 4000);
    }
    return () => clearInterval(interval);
  }, [activeScene?.status]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsPreviewPlaying((prev: boolean) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsPreviewPlaying]);

  // Timeline Scrubbing Logic
  const handleRulerMouseDown = (e: React.MouseEvent) => {
      setIsScrubbing(true);
      handleTimelineClick(e);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const newTime = Math.max(0, Math.min((clickX - 24) / PIXELS_PER_SECOND, totalDuration));
      setCurrentTime(newTime);
  };

  useEffect(() => {
      const handleWindowMouseMove = (e: MouseEvent) => {
          if (isScrubbing && timelineRef.current) {
               const rect = timelineRef.current.getBoundingClientRect();
               const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
               const newTime = Math.max(0, Math.min((clickX - 24) / PIXELS_PER_SECOND, totalDuration));
               setCurrentTime(newTime);
          }
      };
      const handleWindowMouseUp = () => setIsScrubbing(false);
      
      if (isScrubbing) {
          window.addEventListener('mousemove', handleWindowMouseMove);
          window.addEventListener('mouseup', handleWindowMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleWindowMouseMove);
          window.removeEventListener('mouseup', handleWindowMouseUp);
      };
  }, [isScrubbing, totalDuration, PIXELS_PER_SECOND, setCurrentTime]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
      e.dataTransfer.setData('text/plain', index.toString());
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(fromIndex) && fromIndex !== index) {
          onReorderScenes(fromIndex, index);
      }
      setDragOverIndex(null);
  };

  const handleClipClick = (e: React.MouseEvent, startTime: number) => {
      e.stopPropagation();
      setCurrentTime(startTime);
  };

  const handleGenAudioSubmit = async () => {
      if (!activeScene || !audioPrompt) return;
      setIsGeneratingAudio(true);
      await onGenerateAudio(activeScene.id, audioMode, audioPrompt, selectedVoiceId);
      setIsGeneratingAudio(false);
  };

  return (
      <div className="flex-1 flex flex-col bg-gray-950 h-full overflow-hidden">
          {/* Hidden Audio Elements for Timeline Tracks */}
          {audioTracks.map((track, i) => (
              track.audioUrl && !track.muted && (
                  <audio 
                    key={track.id}
                    ref={el => { if(el) audioRefs.current[i] = el; }} 
                    src={track.audioUrl} 
                    loop={track.type === 'music'}
                    data-start={track.startOffset}
                    data-duration={track.duration}
                    volume={track.volume ?? 1.0}
                  />
              )
          ))}

          {/* TOP SECTION: PLAYER & TOOLS */}
          <div className="h-[55%] flex border-b border-gray-800">
              
              {/* MAIN PLAYER */}
              <div className="flex-1 bg-black relative flex items-center justify-center p-4">
                  {/* Player Canvas */}
                  <div className="relative aspect-video h-full max-w-full bg-gray-900 border border-gray-800 shadow-2xl flex items-center justify-center overflow-hidden rounded-lg group/player">
                      {activeScene ? (
                          <>
                              {activeScene.videoUrl ? (
                                  <video 
                                    ref={videoRef}
                                    src={activeScene.videoUrl} 
                                    className="w-full h-full object-contain" 
                                    loop 
                                    muted 
                                  />
                              ) : activeScene.imageUrl ? (
                                  <img 
                                    src={activeScene.imageUrl} 
                                    className={`w-full h-full ${activeScene.bgRemoved ? 'object-contain' : 'object-cover'}`} 
                                    alt="Scene Preview" 
                                  />
                              ) : (
                                  <div className="flex flex-col items-center text-gray-600 gap-4">
                                      <Clapperboard size={48} />
                                      <div className="flex gap-2">
                                          <Button size="sm" onClick={() => onGenerateImage(activeScene.id)}>
                                              <Wand2 size={14} className="mr-2"/> Generate Image
                                          </Button>
                                          <Button size="sm" variant="secondary" onClick={() => onGenerateVideo(activeScene.id)}>
                                              <Film size={14} className="mr-2"/> Generate Video
                                          </Button>
                                      </div>
                                      <button onClick={() => onOpenMagicEdit(activeScene.id)} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                          <FileText size={10}/> Edit Prompt
                                      </button>
                                  </div>
                              )}
                              
                              {/* Overlay Info */}
                              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 text-white text-xs font-mono z-10 pointer-events-none">
                                  <div className="font-bold text-primary-400">SCENE {scenes.indexOf(activeScene) + 1}</div>
                                  <div className="opacity-70 truncate max-w-[200px]">{activeScene.description}</div>
                              </div>

                              {/* Generating Overlay */}
                              {activeScene.status === 'generating' && (
                                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-in fade-in duration-500">
                                      <div className="relative mb-6">
                                          <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-purple-500 animate-spin"></div>
                                          <div className="absolute inset-0 flex items-center justify-center">
                                              <Loader2 size={24} className="text-purple-400 animate-pulse"/>
                                          </div>
                                      </div>
                                      <div className="text-white font-bold text-lg animate-pulse transition-all duration-500 text-center px-4">
                                          {GENERATION_MESSAGES[loadingMsgIndex]}
                                      </div>
                                      <div className="text-gray-500 text-xs mt-3 font-mono">This operation can take a few minutes (Veo Model)</div>
                                  </div>
                              )}
                          </>
                      ) : (
                          <div className="text-gray-500 text-sm">Timeline Empty</div>
                      )}

                      {/* Render Overlay */}
                      {isRendering && (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                              <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mb-4">
                                  <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${renderProgress}%` }}></div>
                              </div>
                              <div className="text-red-500 font-bold animate-pulse flex items-center gap-2">
                                  <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                                  RENDERING FINAL CUT
                              </div>
                              <div className="text-gray-500 text-xs font-mono mt-2">{Math.round(renderProgress)}% COMPLETE</div>
                          </div>
                      )}
                  </div>
              </div>

              {/* RIGHT PANEL: SCRIPT & METADATA & AUDIO GEN */}
              <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col hidden lg:flex">
                  <div className="p-3 border-b border-gray-800 font-bold text-xs text-gray-400 uppercase flex items-center gap-2 bg-gray-850">
                      <Monitor size={14} /> Scene Details
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto space-y-6">
                      {activeScene ? (
                          <>
                              {/* Metadata */}
                              <div className="space-y-3">
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-bold text-gray-500 uppercase">Duration</span>
                                      <span className="text-sm font-mono text-white bg-black/50 px-2 rounded border border-gray-700">{activeScene.duration?.toFixed(2)}s</span>
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-bold text-gray-500 uppercase">Transition</label>
                                      <div className="flex items-center gap-2 mt-1">
                                          <span className="px-2 py-1 bg-purple-900/30 text-purple-300 text-xs rounded border border-purple-800 uppercase">
                                              {activeScene.transition || 'Cut'}
                                          </span>
                                      </div>
                                  </div>
                              </div>

                              <div className="h-px bg-gray-800 w-full"></div>

                              {/* Audio Production */}
                              <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block flex items-center gap-2"><Volume2 size={12}/> Audio Production</label>
                                  
                                  <div className="flex bg-gray-800 rounded p-1 mb-2">
                                      <button onClick={() => setAudioMode('voice')} className={`flex-1 py-1 text-[10px] rounded ${audioMode === 'voice' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Voice</button>
                                      <button onClick={() => setAudioMode('sfx')} className={`flex-1 py-1 text-[10px] rounded ${audioMode === 'sfx' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>SFX</button>
                                      <button onClick={() => setAudioMode('music')} className={`flex-1 py-1 text-[10px] rounded ${audioMode === 'music' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Music</button>
                                  </div>

                                  {audioMode === 'voice' && (
                                      <select 
                                          className="w-full bg-gray-800 border border-gray-700 rounded p-1 mb-2 text-xs text-white outline-none focus:border-primary-500"
                                          value={selectedVoiceId}
                                          onChange={e => setSelectedVoiceId(e.target.value)}
                                      >
                                          {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                      </select>
                                  )}

                                  <textarea 
                                      className="w-full bg-black/30 border border-gray-700 rounded p-2 text-xs text-gray-300 focus:outline-none focus:border-primary-500 resize-none h-20 mb-2"
                                      value={audioPrompt}
                                      onChange={(e) => setAudioPrompt(e.target.value)}
                                      placeholder={audioMode === 'voice' ? "Dialogue line..." : audioMode === 'sfx' ? "Sound description..." : "Music mood..."}
                                  />
                                  
                                  <Button size="sm" className="w-full" onClick={handleGenAudioSubmit} disabled={isGeneratingAudio || !audioPrompt}>
                                      {isGeneratingAudio ? <Loader2 size={12} className="animate-spin mr-2"/> : audioMode === 'voice' ? <Mic size={12} className="mr-2"/> : <Music size={12} className="mr-2"/>}
                                      Generate {audioMode === 'voice' ? 'Voiceover' : audioMode === 'sfx' ? 'SFX' : 'Score'}
                                  </Button>
                              </div>

                              <div className="h-px bg-gray-800 w-full"></div>

                              {/* Visual Actions */}
                              <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block">Visuals</label>
                                  <div className="grid grid-cols-2 gap-2">
                                      <Button size="sm" variant="secondary" className="text-xs" onClick={() => onGenerateImage(activeScene.id)}>
                                          <Wand2 size={12} className="mr-1"/> Image
                                      </Button>
                                      <Button size="sm" variant="secondary" className="text-xs" onClick={() => onGenerateVideo(activeScene.id)}>
                                          <Film size={12} className="mr-1"/> Video
                                      </Button>
                                  </div>
                              </div>
                          </>
                      ) : (
                          <div className="text-center text-gray-500 mt-10 text-xs">Select a scene on the timeline</div>
                      )}
                  </div>
              </div>
          </div>

          {/* BOTTOM SECTION: TIMELINE CONTROLS */}
          <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
              {/* Toolbar */}
              <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-850 shrink-0">
                  <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setIsPreviewPlaying(!isPreviewPlaying)} className={isPreviewPlaying ? "border-primary-500 text-primary-400" : ""}>
                          {isPreviewPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-1" />}
                      </Button>
                      <div className="text-lg font-mono text-white ml-2 tabular-nums">
                          {currentTime.toFixed(2)}s <span className="text-gray-600 text-xs">/ {totalDuration.toFixed(2)}s</span>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                       <Button size="sm" variant="ghost" onClick={onUndo} disabled={historyIndex <= 0} title="Undo"><RotateCcw size={14}/></Button>
                       <Button size="sm" variant="ghost" onClick={onRedo} disabled={historyIndex >= historyLength - 1} title="Redo"><RotateCw size={14}/></Button>
                       <div className="h-4 w-px bg-gray-700 mx-2"></div>
                       <Button size="sm" onClick={onRenderMovie} disabled={isRendering}>
                           {isRendering ? <Loader2 size={14} className="animate-spin mr-2"/> : <Download size={14} className="mr-2"/>}
                           Export Project
                       </Button>
                  </div>
              </div>

              {/* Timeline Track Area */}
              <div className="flex-1 overflow-x-auto relative p-6 select-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5" ref={timelineRef}>
                  
                  {/* Ruler */}
                  <div className="absolute top-0 left-0 right-0 h-6 border-b border-gray-800 flex items-end cursor-pointer z-20 min-w-max" onMouseDown={handleRulerMouseDown} style={{ width: Math.max(1000, totalWidth + 100) }}>
                      {[...Array(Math.ceil(totalDuration) + 2)].map((_, i) => (
                          <div key={i} className="absolute bottom-0 border-l border-gray-600 h-2 text-[9px] text-gray-500 pl-1 font-mono pointer-events-none" style={{ left: i * PIXELS_PER_SECOND + 24 }}>
                              {i}s
                          </div>
                      ))}
                  </div>

                  {/* Playhead */}
                  <div className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none transition-transform duration-75 will-change-transform" style={{ transform: `translateX(${currentTime * PIXELS_PER_SECOND + 24}px)` }}>
                      <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-red-500 rotate-45 transform origin-center"></div>
                  </div>

                  {/* Tracks Container */}
                  <div className="flex flex-col gap-4 pt-10 min-w-max pl-6 pb-6">
                      
                      {/* Video Track */}
                      <div className="flex items-center h-28 relative">
                          {/* Track Background Line */}
                          <div className="absolute inset-0 flex items-center h-px bg-gray-800 z-0"></div>
                          
                          {sceneMetrics.map((scene, idx) => (
                              <React.Fragment key={scene.id}>
                                  <div 
                                      className={`relative z-10 group transition-all duration-200 ${dragOverIndex === idx ? 'scale-105 z-30' : 'hover:scale-[1.02]'}`}
                                      draggable 
                                      onDragStart={(e) => handleDragStart(e, idx)}
                                      onDragOver={(e) => handleDragOver(e, idx)}
                                      onDrop={(e) => handleDrop(e, idx)}
                                      onDragLeave={() => setDragOverIndex(null)}
                                      onClick={(e) => handleClipClick(e, scene.startTime)}
                                      style={{ width: (scene.duration || 5) * PIXELS_PER_SECOND }}
                                  >
                                      {/* Context Menu / Actions on Hover */}
                                      <div className="absolute -top-8 left-0 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 z-20">
                                          <button onClick={(e) => { e.stopPropagation(); onSplitScene(idx); }} className="bg-gray-800 p-1.5 rounded hover:bg-primary-600 text-gray-400 hover:text-white shadow-lg border border-gray-700" title="Split"><Scissors size={10} /></button>
                                          <button onClick={(e) => { e.stopPropagation(); onDuplicateScene(idx); }} className="bg-gray-800 p-1.5 rounded hover:bg-primary-600 text-gray-400 hover:text-white shadow-lg border border-gray-700" title="Duplicate"><Copy size={10} /></button>
                                          <button onClick={(e) => { e.stopPropagation(); onDeleteScene(idx); }} className="bg-gray-800 p-1.5 rounded hover:bg-red-600 text-gray-400 hover:text-white shadow-lg border border-gray-700" title="Delete"><Trash2 size={10} /></button>
                                      </div>

                                      {/* Clip Block */}
                                      <div className={`w-full h-full bg-gray-800 rounded-lg border overflow-hidden relative shadow-lg transition-colors flex-shrink-0 cursor-pointer ${activeScene?.id === scene.id ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-700'} ${dragOverIndex === idx ? 'border-yellow-500' : ''}`}>
                                          
                                          {/* Thumbnail */}
                                          {scene.imageUrl ? (
                                              <img src={scene.imageUrl} className={`w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity ${scene.bgRemoved ? 'object-contain bg-gray-900' : ''}`} draggable={false} />
                                          ) : (
                                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 gap-1 bg-gray-900">
                                                  <Film size={16} />
                                                  <span className="text-[9px]">Empty</span>
                                              </div>
                                          )}
                                          
                                          {/* Type Icon Overlay */}
                                          {scene.videoUrl && (
                                              <div className="absolute top-1 left-1 bg-black/50 rounded p-0.5 text-white/80">
                                                  <Film size={10} />
                                              </div>
                                          )}
                                          {!scene.videoUrl && scene.imageUrl && (
                                              <div className="absolute top-1 left-1 bg-black/50 rounded p-0.5 text-white/80">
                                                  <ImageIcon size={10} />
                                              </div>
                                          )}
                                          
                                          {/* Duration Badge */}
                                          <div className="absolute top-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 rounded z-10 backdrop-blur-sm">
                                              {scene.duration?.toFixed(1)}s
                                          </div>
                                          
                                          {/* Status Badge */}
                                          {scene.status === 'generating' && (
                                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                                                  <Loader2 size={16} className="text-purple-500 animate-spin"/>
                                              </div>
                                          )}
                                          
                                          {/* In-Clip Actions */}
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                              <button onClick={(e) => { e.stopPropagation(); onOpenTrim(scene.id); }} className="p-1.5 bg-blue-600 rounded-full text-white hover:scale-110 transition-transform" title="Trim"><Sliders size={12} /></button>
                                              <button onClick={(e) => { e.stopPropagation(); onOpenMagicEdit(scene.id); }} className="p-1.5 bg-purple-600 rounded-full text-white hover:scale-110 transition-transform" title="AI Edit"><Wand2 size={12} /></button>
                                          </div>
                                      </div>
                                      
                                      {/* Clip Label */}
                                      <div className="mt-1 text-[9px] text-gray-500 truncate w-full text-center px-1 font-mono">
                                          {idx + 1}. {scene.description.substring(0, 15)}...
                                      </div>
                                  </div>

                                  {/* Transition Connector */}
                                  {idx < scenes.length - 1 && (
                                      <div 
                                        className="relative z-10 w-6 flex flex-col items-center justify-center cursor-pointer -ml-3 -mr-3" 
                                        onClick={(e) => { e.stopPropagation(); onUpdateScene(scene.id, { transition: cycleTransition(scene.transition) }); }} 
                                        style={{ zIndex: 20 }}
                                        title={`Transition: ${scene.transition || 'Cut'}`}
                                      >
                                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center bg-gray-900 transition-all hover:scale-125 ${scene.transition && scene.transition !== 'cut' ? 'border-purple-500 text-purple-500' : 'border-gray-600 text-gray-600'}`}>
                                              {scene.transition && scene.transition !== 'cut' ? <Layers size={8} /> : <ArrowRightLeft size={8} />}
                                          </div>
                                      </div>
                                  )}
                              </React.Fragment>
                          ))}
                          
                          {/* Add Button */}
                          <div 
                            className="w-10 h-28 rounded-lg border-2 border-dashed border-gray-800 flex items-center justify-center text-gray-700 hover:text-gray-400 hover:border-gray-600 cursor-pointer ml-2 transition-colors bg-gray-900/50" 
                            onClick={onAddScene}
                            title="Add Scene"
                          >
                              <Plus size={16} />
                          </div>
                      </div>

                      {/* Audio Tracks Visual */}
                      <div className="flex flex-col gap-1 mt-4">
                         {audioTracks.map((track) => (
                             <div key={track.id} className="flex items-center h-8 relative group/track">
                                <div className="absolute left-0 -ml-24 w-20 text-xs font-bold text-gray-600 flex items-center gap-2 justify-end pr-2">
                                    {track.type === 'music' ? <Music size={10}/> : <Volume2 size={10}/>} {track.type}
                                </div>
                                <div 
                                    className={`h-full rounded border flex items-center px-2 relative overflow-hidden ${track.type === 'voiceover' ? 'bg-orange-900/20 border-orange-800/50' : 'bg-blue-900/20 border-blue-800/50'}`} 
                                    style={{ width: track.duration * PIXELS_PER_SECOND, marginLeft: track.startOffset * PIXELS_PER_SECOND }}
                                >
                                    <div className="absolute inset-0 opacity-30 flex items-center gap-0.5">
                                        {[...Array(Math.floor(track.duration * 4))].map((_, i) => (
                                            <div key={i} className={`w-1 rounded-full ${track.type === 'voiceover' ? 'bg-orange-400' : 'bg-blue-400'}`} style={{ height: `${20 + Math.random() * 60}%` }}></div>
                                        ))}
                                    </div>
                                    <div className={`relative z-10 text-[9px] font-mono truncate ${track.type === 'voiceover' ? 'text-orange-300' : 'text-blue-300'}`}>{track.name}</div>
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
