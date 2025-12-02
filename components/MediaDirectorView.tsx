
import React, { useRef, useState, useEffect } from 'react';
import { Film, Music, RotateCcw, RotateCw, Pause, Play, Loader2, Download, Scissors, Copy, Trash2, Clock, Sliders, Wand2, Layers, ArrowRightLeft, Plus, Volume2, Monitor, Clapperboard, FileText, Image as ImageIcon, Mic, Video, ArrowLeft, ArrowRight } from 'lucide-react';
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
  onAutoGenerateAudioPrompt?: (type: 'voice' | 'sfx' | 'music', sceneId: string) => Promise<string>;
  onUpdateAudioTrack?: (trackId: string, updates: Partial<AudioTrack>) => void;
  onDeleteAudioTrack?: (trackId: string) => void;
}

export const MediaDirectorView: React.FC<MediaDirectorViewProps> = ({
  selectedPost, audioTracks, currentTime, setCurrentTime, isPreviewPlaying, setIsPreviewPlaying,
  isRendering, renderProgress, onSelectAudio, onUndo, onRedo, onRenderMovie,
  onGenerateImage, onGenerateVideo, onGenerateAudio, onSplitScene, onDuplicateScene, onDeleteScene, onOpenTrim, onOpenMagicEdit, onUpdateScene, onReorderScenes, cycleTransition,
  historyIndex, historyLength, onAddScene, voices, onAutoGenerateAudioPrompt, onUpdateAudioTrack, onDeleteAudioTrack
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const PIXELS_PER_SECOND = 40;
  
  // Drag State for Audio
  const [dragAudio, setDragAudio] = useState<{ id: string, startX: number, startOffset: number } | null>(null);
  
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
  
  // Calculate max duration including audio tracks to expand timeline if needed
  const maxAudioDuration = audioTracks.reduce((acc, t) => Math.max(acc, t.startOffset + t.duration), 0);
  const totalDuration = Math.max(accumulatedTime || 10, maxAudioDuration);
  const totalWidth = totalDuration * PIXELS_PER_SECOND;

  // Determine Active Scene for Player
  const activeScene = sceneMetrics.find(s => currentTime >= s.startTime && currentTime < s.endTime) || sceneMetrics[sceneMetrics.length - 1];
  
  useEffect(() => {
      if (activeScene) {
          if (audioMode === 'voice' && activeScene.audioScript) {
              setAudioPrompt(activeScene.audioScript);
          } else if (audioMode === 'voice') {
              setAudioPrompt('');
          } else {
              setAudioPrompt(''); 
          }
      }
  }, [activeScene?.id, audioMode]);

  // Sync Video Element if video asset
  useEffect(() => {
      if (videoRef.current && activeScene?.videoUrl) {
          const sceneRelativeTime = currentTime - activeScene.startTime;
          if (Math.abs(videoRef.current.currentTime - sceneRelativeTime) > 0.5) {
              videoRef.current.currentTime = sceneRelativeTime;
          }
          if (isPreviewPlaying && videoRef.current.paused) videoRef.current.play().catch(() => {});
          else if (!isPreviewPlaying && !videoRef.current.paused) videoRef.current.pause();
      }
  }, [currentTime, isPreviewPlaying, activeScene]);

  // Handle Audio Dragging
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!dragAudio || !onUpdateAudioTrack) return;
          const deltaX = e.clientX - dragAudio.startX;
          const deltaSeconds = deltaX / PIXELS_PER_SECOND;
          const newOffset = Math.max(0, dragAudio.startOffset + deltaSeconds);
          onUpdateAudioTrack(dragAudio.id, { startOffset: newOffset });
      };

      const handleMouseUp = () => {
          setDragAudio(null);
      };

      if (dragAudio) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [dragAudio, onUpdateAudioTrack]);

  const handleAudioGen = async () => {
      if (!activeScene) return;
      setIsGeneratingAudio(true);
      await onGenerateAudio(activeScene.id, audioMode, audioPrompt, selectedVoiceId);
      setIsGeneratingAudio(false);
  };

  const handleAutoPrompt = async () => {
      if (onAutoGenerateAudioPrompt && activeScene) {
          const prompt = await onAutoGenerateAudioPrompt(audioMode, activeScene.id);
          setAudioPrompt(prompt);
      }
  };

  const formatTime = (time: number) => {
      const mins = Math.floor(time / 60);
      const secs = Math.floor(time % 60);
      const ms = Math.floor((time % 1) * 10);
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  const getAudioColor = (type: string) => {
      if (type === 'voiceover') return 'bg-purple-900/60 border-purple-700/50';
      if (type === 'music') return 'bg-blue-900/60 border-blue-700/50';
      return 'bg-orange-900/60 border-orange-700/50';
  };

  return (
    <div className="flex flex-col h-full bg-black/80 text-white overflow-hidden">
        {/* Top: Player & Inspector */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
            {/* Player */}
            <div className="flex-1 bg-black relative flex items-center justify-center p-4 border-b lg:border-b-0 lg:border-r border-gray-800 min-h-[300px]">
                <div className="aspect-video w-full max-w-4xl bg-gray-900 rounded-lg overflow-hidden shadow-2xl relative group">
                    {activeScene?.videoUrl ? (
                        <video 
                            ref={videoRef}
                            src={activeScene.videoUrl} 
                            className="w-full h-full object-contain"
                            muted
                        />
                    ) : activeScene?.imageUrl ? (
                        <img src={activeScene.imageUrl} className="w-full h-full object-contain" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-700">
                            {activeScene?.status === 'generating' ? (
                                <>
                                    <Loader2 size={48} className="animate-spin mb-4 text-purple-500" />
                                    <div className="text-sm font-mono animate-pulse text-purple-300">Generating Media...</div>
                                </>
                            ) : (
                                <>
                                    <Film size={48} className="mb-4" />
                                    <p className="text-sm">No Media</p>
                                </>
                            )}
                        </div>
                    )}
                    
                    {/* Scene Text Overlay */}
                    <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded text-xs font-mono text-white/90 backdrop-blur-sm pointer-events-none">
                        Scene {scenes.findIndex(s => s.id === activeScene?.id) + 1} • {formatTime(currentTime)} / {formatTime(totalDuration)}
                    </div>
                    
                    {/* Play Overlay */}
                    {!isPreviewPlaying && (
                        <div 
                            className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
                            onClick={() => setIsPreviewPlaying(true)}
                        >
                            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:scale-110 transition-transform">
                                <Play size={32} fill="currentColor" className="ml-1"/>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Inspector */}
            <div className="w-full lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden shrink-0">
                <div className="p-3 border-b border-gray-800 font-bold text-xs uppercase text-gray-500">Inspector</div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20 lg:pb-4">
                    {activeScene ? (
                        <>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-gray-400">Scene Description</label>
                                <textarea 
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-xs text-white h-24 focus:outline-none focus:border-purple-500 resize-none"
                                    value={activeScene.description}
                                    onChange={(e) => onUpdateScene(activeScene.id, { description: e.target.value })}
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => onGenerateImage(activeScene.id)} disabled={activeScene.status === 'generating'} className="flex-1 text-[10px]">
                                        <ImageIcon size={12} className="mr-1"/> Image
                                    </Button>
                                    <Button size="sm" onClick={() => onGenerateVideo(activeScene.id)} disabled={activeScene.status === 'generating'} className="flex-1 text-[10px] bg-purple-600 hover:bg-purple-500">
                                        <Video size={12} className="mr-1"/> Veo Video
                                    </Button>
                                </div>
                            </div>

                            <div className="border-t border-gray-800 pt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-gray-400">Audio Generation</label>
                                    <div className="flex bg-black/50 rounded p-0.5">
                                        <button onClick={() => setAudioMode('voice')} className={`px-2 py-0.5 rounded text-[10px] ${audioMode === 'voice' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}><Mic size={10}/></button>
                                        <button onClick={() => setAudioMode('sfx')} className={`px-2 py-0.5 rounded text-[10px] ${audioMode === 'sfx' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}><Volume2 size={10}/></button>
                                        <button onClick={() => setAudioMode('music')} className={`px-2 py-0.5 rounded text-[10px] ${audioMode === 'music' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}><Music size={10}/></button>
                                    </div>
                                </div>
                                
                                {audioMode === 'voice' && (
                                    <select 
                                        className="w-full bg-black/50 border border-gray-700 rounded p-1.5 text-xs text-white outline-none"
                                        value={selectedVoiceId}
                                        onChange={(e) => setSelectedVoiceId(e.target.value)}
                                    >
                                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                )}

                                <div className="relative">
                                    <textarea 
                                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-xs text-white h-16 focus:outline-none focus:border-purple-500 resize-none pr-6"
                                        placeholder={audioMode === 'voice' ? "Script to speak..." : "Sound description..."}
                                        value={audioPrompt}
                                        onChange={(e) => setAudioPrompt(e.target.value)}
                                    />
                                    <button onClick={handleAutoPrompt} className="absolute top-2 right-2 text-gray-500 hover:text-purple-400" title="Auto-Generate Prompt"><Wand2 size={12}/></button>
                                </div>
                                
                                <Button size="sm" className="w-full" onClick={handleAudioGen} disabled={isGeneratingAudio || !audioPrompt}>
                                    {isGeneratingAudio ? <Loader2 size={12} className="animate-spin mr-2"/> : <Volume2 size={12} className="mr-2"/>} Generate Audio
                                </Button>
                            </div>

                            <div className="border-t border-gray-800 pt-4 grid grid-cols-2 gap-2">
                                <button onClick={() => onOpenMagicEdit(activeScene.id)} className="flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 p-2 rounded text-[10px] text-gray-300">
                                    <Wand2 size={12}/> Magic Edit
                                </button>
                                <button onClick={() => onOpenTrim(activeScene.id)} className="flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-700 p-2 rounded text-[10px] text-gray-300">
                                    <Scissors size={12}/> Trim
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-500 text-xs py-10">Select a scene on the timeline to edit.</div>
                    )}
                </div>
            </div>
        </div>

        {/* Bottom: Timeline */}
        <div className="h-72 bg-gray-900 border-t border-gray-800 flex flex-col shrink-0">
            {/* Timeline Tools */}
            <div className="h-10 bg-gray-850 border-b border-gray-800 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsPreviewPlaying(!isPreviewPlaying)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform">
                        {isPreviewPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                    </button>
                    <span className="font-mono text-sm ml-2 text-gray-300">{formatTime(currentTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400"><Scissors size={14}/></button>
                    <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400" onClick={onAddScene} title="Add Scene"><Plus size={14}/></button>
                    <div className="h-4 w-px bg-gray-700 mx-1"></div>
                    <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400" onClick={onUndo} disabled={historyIndex <= 0}><RotateCcw size={14}/></button>
                    <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400" onClick={onRedo} disabled={historyIndex >= historyLength - 1}><RotateCw size={14}/></button>
                    
                    <div className="h-4 w-px bg-gray-700 mx-1"></div>
                    <button 
                        className="flex items-center gap-1 bg-primary-600 hover:bg-primary-500 text-white px-2 py-1 rounded text-xs font-bold transition-colors"
                        onClick={onRenderMovie}
                        disabled={isRendering}
                    >
                        {isRendering ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>} Render
                    </button>
                </div>
            </div>

            {/* Tracks Container */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden relative bg-gray-900" ref={timelineRef}>
                <div className="relative h-full" style={{ width: Math.max(1000, totalWidth + 400) }}>
                    
                    {/* Time Ruler */}
                    <div className="h-6 border-b border-gray-800 flex items-end select-none">
                        {[...Array(Math.ceil(totalDuration) + 5)].map((_, i) => (
                            <div key={i} className="absolute bottom-0 text-[9px] text-gray-500 border-l border-gray-800 pl-1 h-3" style={{ left: i * PIXELS_PER_SECOND }}>
                                {i}s
                            </div>
                        ))}
                    </div>

                    {/* Playhead */}
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-red-500 z-30 pointer-events-none"
                        style={{ left: currentTime * PIXELS_PER_SECOND }}
                    >
                        <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45"></div>
                    </div>

                    {/* Scene Track */}
                    <div className="h-20 mt-2 relative border-b border-gray-800">
                        {sceneMetrics.map((scene, index) => (
                            <div 
                                key={scene.id}
                                className={`absolute top-1 bottom-1 bg-gray-800 border rounded-md overflow-hidden group cursor-pointer transition-all ${activeScene?.id === scene.id ? 'border-purple-500 ring-1 ring-purple-500/50 z-10' : 'border-gray-600 hover:border-gray-400'}`}
                                style={{ 
                                    left: scene.startTime * PIXELS_PER_SECOND, 
                                    width: scene.duration ? scene.duration * PIXELS_PER_SECOND : 5 * PIXELS_PER_SECOND 
                                }}
                                onClick={() => {
                                    setCurrentTime(scene.startTime);
                                }}
                            >
                                {/* Thumbnail Strip */}
                                <div className="absolute inset-0 flex opacity-50">
                                    {scene.imageUrl && <img src={scene.imageUrl} className="h-full w-auto object-cover" />}
                                    {!scene.imageUrl && <div className="w-full h-full bg-gray-800 flex items-center justify-center"><Film size={16} className="text-gray-600"/></div>}
                                </div>
                                
                                <div className="absolute top-1 left-2 text-[10px] font-bold text-white drop-shadow-md truncate max-w-full">
                                    Scene {index + 1}
                                </div>

                                {/* Transition Handle */}
                                {index < sceneMetrics.length - 1 && (
                                    <div 
                                        className="absolute right-0 top-0 bottom-0 w-4 hover:bg-white/20 cursor-pointer flex items-center justify-center"
                                        onClick={(e) => { e.stopPropagation(); onUpdateScene(scene.id, { transition: cycleTransition(scene.transition || 'cut') }); }}
                                    >
                                        {scene.transition === 'fade' ? <div className="w-0 h-0 border-l-[4px] border-l-transparent border-b-[8px] border-b-white/50"></div> : 
                                         scene.transition === 'dissolve' ? <div className="w-2 h-2 rounded-full bg-white/30"></div> : 
                                         <div className="w-px h-full bg-black/50"></div>}
                                    </div>
                                )}

                                {/* Context Actions */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); onReorderScenes(index, index - 1); }} className="p-1 bg-black/50 rounded hover:bg-black/80 text-white" title="Move Left" disabled={index === 0}><ArrowLeft size={10}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); onReorderScenes(index, index + 1); }} className="p-1 bg-black/50 rounded hover:bg-black/80 text-white" title="Move Right" disabled={index === sceneMetrics.length - 1}><ArrowRight size={10}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); onSplitScene(index); }} className="p-1 bg-black/50 rounded hover:bg-black/80 text-white" title="Split"><Scissors size={10}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); onDuplicateScene(index); }} className="p-1 bg-black/50 rounded hover:bg-black/80 text-white" title="Duplicate"><Copy size={10}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); onDeleteScene(index); }} className="p-1 bg-black/50 rounded hover:bg-red-900/80 text-red-300" title="Delete"><Trash2 size={10}/></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Audio Tracks */}
                    <div className="flex-1 relative pt-2">
                        {audioTracks.map((track) => (
                            <div
                                key={track.id}
                                className={`absolute top-0 h-8 rounded border flex items-center px-2 cursor-grab active:cursor-grabbing ${getAudioColor(track.type)}`}
                                style={{
                                    left: track.startOffset * PIXELS_PER_SECOND,
                                    width: Math.max(20, track.duration * PIXELS_PER_SECOND),
                                    top: (['voiceover', 'music', 'sfx'].indexOf(track.type) * 36) + 'px'
                                }}
                                onMouseDown={(e) => {
                                    setDragAudio({ id: track.id, startX: e.clientX, startOffset: track.startOffset });
                                }}
                            >
                                <div className="truncate text-[10px] text-white/80 font-mono w-full">{track.name}</div>
                                {onDeleteAudioTrack && (
                                    <button 
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:text-red-300 opacity-0 group-hover:opacity-100"
                                        onClick={(e) => { e.stopPropagation(); onDeleteAudioTrack(track.id); }}
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
