
import React, { useRef, useState, useEffect, memo } from 'react';
import { Film, Trash2, ArrowLeft, ArrowRight, Scissors, Copy, Plus, RotateCcw, RotateCw, Download, Share2, Loader2, Pause, Play, GripHorizontal } from 'lucide-react';
import { Scene, AudioTrack } from '../types';

interface MediaDirectorTimelineProps {
  scenes: Scene[];
  audioTracks: AudioTrack[];
  currentTime: number;
  setCurrentTime: (time: number) => void;
  totalDuration: number;
  activeSceneId?: string;
  onUpdateScene: (id: string, updates: Partial<Scene>) => void;
  onReorderScenes: (from: number, to: number) => void;
  onSplitScene: (index: number) => void;
  onDuplicateScene: (index: number) => void;
  onDeleteScene: (index: number) => void;
  cycleTransition: (current: any) => any;
  onUpdateAudioTrack?: (id: string, updates: Partial<AudioTrack>) => void;
  onDeleteAudioTrack?: (id: string) => void;
  // Toolbar Actions
  isPlaying: boolean;
  onTogglePlay: () => void;
  onAddScene: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRenderMovie: () => void;
  isRendering: boolean;
  onPublish?: () => void;
  historyIndex: number;
  historyLength: number;
}

const PIXELS_PER_SECOND = 40;

const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
};

export const MediaDirectorTimeline: React.FC<MediaDirectorTimelineProps> = memo(({
  scenes, audioTracks, currentTime, setCurrentTime, totalDuration, activeSceneId,
  onUpdateScene, onReorderScenes, onSplitScene, onDuplicateScene, onDeleteScene, cycleTransition,
  onUpdateAudioTrack, onDeleteAudioTrack,
  isPlaying, onTogglePlay, onAddScene, onUndo, onRedo, onRenderMovie, isRendering, onPublish, historyIndex, historyLength
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragAudio, setDragAudio] = useState<{ id: string, startX: number, startOffset: number } | null>(null);

  // Calculate Layout Metrics
  let accumulatedTime = 0;
  const sceneMetrics = scenes.map(s => {
      const start = accumulatedTime;
      accumulatedTime += (s.duration || 5);
      return { ...s, startTime: start };
  });
  
  const totalWidth = totalDuration * PIXELS_PER_SECOND;

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

  const getAudioColor = (type: string) => {
      if (type === 'voiceover') return 'bg-purple-600/80 border-purple-500/80 hover:bg-purple-600';
      if (type === 'music') return 'bg-blue-600/80 border-blue-500/80 hover:bg-blue-600';
      return 'bg-orange-600/80 border-orange-500/80 hover:bg-orange-600';
  };

  return (
    <div className="h-72 bg-gray-900 border-t border-gray-800 flex flex-col shrink-0">
        {/* Timeline Tools */}
        <div className="h-10 bg-gray-850 border-b border-gray-800 flex items-center px-4 justify-between">
            <div className="flex items-center gap-2">
                <button onClick={onTogglePlay} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform">
                    {isPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                </button>
                <span className="font-mono text-sm ml-2 text-gray-300">{formatTime(currentTime)}</span>
            </div>
            <div className="flex items-center gap-2">
                <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400" onClick={onAddScene} title="Add Scene"><Plus size={14}/></button>
                <div className="h-4 w-px bg-gray-700 mx-1"></div>
                <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400" onClick={onUndo} disabled={historyIndex <= 0}><RotateCcw size={14}/></button>
                <button className="p-1.5 hover:bg-gray-700 rounded text-gray-400" onClick={onRedo} disabled={historyIndex >= historyLength - 1}><RotateCw size={14}/></button>
                
                <div className="h-4 w-px bg-gray-700 mx-1"></div>
                
                <button 
                    className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                    onClick={onRenderMovie}
                    disabled={isRendering}
                >
                    {isRendering ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>} Export
                </button>
                {onPublish && (
                    <button 
                        className="flex items-center gap-1 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                        onClick={onPublish}
                    >
                        <Share2 size={12}/> Publish
                    </button>
                )}
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
                    <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-red-500 transform rotate-45 shadow-lg"></div>
                </div>

                {/* Scene Track */}
                <div className="h-24 mt-2 relative border-b border-gray-800 bg-black/20">
                    {sceneMetrics.map((scene, index) => (
                        <div 
                            key={scene.id}
                            className={`absolute top-1 bottom-1 bg-gray-800 border rounded-md overflow-hidden group cursor-pointer transition-all ${activeSceneId === scene.id ? 'border-purple-500 ring-2 ring-purple-500/50 z-10' : 'border-gray-600 hover:border-gray-400'}`}
                            style={{ 
                                left: scene.startTime * PIXELS_PER_SECOND, 
                                width: scene.duration ? scene.duration * PIXELS_PER_SECOND : 5 * PIXELS_PER_SECOND 
                            }}
                            onClick={() => {
                                setCurrentTime(scene.startTime);
                            }}
                        >
                            {/* Thumbnail Strip */}
                            <div className="absolute inset-0 flex opacity-70 transition-opacity group-hover:opacity-90">
                                {scene.imageUrl && <img src={scene.imageUrl} className="h-full w-full object-cover" />}
                                {!scene.imageUrl && <div className="w-full h-full bg-gray-800 flex items-center justify-center"><Film size={16} className="text-gray-600"/></div>}
                            </div>
                            
                            <div className="absolute top-1 left-2 text-[10px] font-bold text-white drop-shadow-md truncate max-w-full z-10">
                                Scene {index + 1}
                            </div>

                            {/* Transition Handle */}
                            {index < sceneMetrics.length - 1 && (
                                <div 
                                    className="absolute right-0 top-0 bottom-0 w-6 hover:bg-white/20 cursor-pointer flex items-center justify-center z-20 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); onUpdateScene(scene.id, { transition: cycleTransition(scene.transition || 'cut') }); }}
                                >
                                    {scene.transition === 'fade' ? <div className="w-0 h-0 border-l-[6px] border-l-transparent border-b-[10px] border-b-white/80"></div> : 
                                     scene.transition === 'dissolve' ? <div className="w-3 h-3 rounded-full bg-white/60 backdrop-blur-sm"></div> : 
                                     <div className="w-0.5 h-4 bg-black/50"></div>}
                                </div>
                            )}

                            {/* Context Actions */}
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 z-20">
                                <button onClick={(e) => { e.stopPropagation(); onReorderScenes(index, index - 1); }} className="p-1 bg-black/60 rounded hover:bg-black text-white backdrop-blur-md" title="Move Left" disabled={index === 0}><ArrowLeft size={10}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onReorderScenes(index, index + 1); }} className="p-1 bg-black/60 rounded hover:bg-black text-white backdrop-blur-md" title="Move Right" disabled={index === sceneMetrics.length - 1}><ArrowRight size={10}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onSplitScene(index); }} className="p-1 bg-black/60 rounded hover:bg-black text-white backdrop-blur-md" title="Split"><Scissors size={10}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onDuplicateScene(index); }} className="p-1 bg-black/60 rounded hover:bg-black text-white backdrop-blur-md" title="Duplicate"><Copy size={10}/></button>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteScene(index); }} className="p-1 bg-black/60 rounded hover:bg-red-900/80 text-red-300 backdrop-blur-md" title="Delete"><Trash2 size={10}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Audio Tracks */}
                <div className="flex-1 relative pt-2 pb-2">
                    {audioTracks.map((track) => (
                        <div
                            key={track.id}
                            className={`absolute h-8 rounded-full border flex items-center px-3 cursor-grab active:cursor-grabbing shadow-sm transition-all ${getAudioColor(track.type)}`}
                            style={{
                                left: track.startOffset * PIXELS_PER_SECOND,
                                width: Math.max(20, track.duration * PIXELS_PER_SECOND),
                                top: (['voiceover', 'music', 'sfx'].indexOf(track.type) * 40) + 10 + 'px'
                            }}
                            onMouseDown={(e) => {
                                setDragAudio({ id: track.id, startX: e.clientX, startOffset: track.startOffset });
                            }}
                        >
                            <GripHorizontal size={10} className="mr-2 text-white/50 shrink-0" />
                            <div className="truncate text-[10px] text-white font-medium w-full drop-shadow-md">{track.name}</div>
                            {onDeleteAudioTrack && (
                                <button 
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:text-red-200 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity"
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
  );
});
