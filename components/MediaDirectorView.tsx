
import React, { useRef, useState, useEffect } from 'react';
import { Film, Music, RotateCcw, RotateCw, Pause, Play, Loader2, Download, Scissors, Copy, Trash2, Clock, Sliders, Wand2, Layers, ArrowRightLeft, Plus, Volume2, Monitor, Clapperboard } from 'lucide-react';
import { Button } from './Button';
import { SocialPost, AudioTrack, Scene } from '../types';

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
}

export const MediaDirectorView: React.FC<MediaDirectorViewProps> = ({
  selectedPost, audioTracks, currentTime, setCurrentTime, isPreviewPlaying, setIsPreviewPlaying,
  isRendering, renderProgress, onSelectAudio, onUndo, onRedo, onRenderMovie,
  onGenerateImage, onSplitScene, onDuplicateScene, onDeleteScene, onOpenTrim, onOpenMagicEdit, onUpdateScene, onReorderScenes, cycleTransition,
  historyIndex, historyLength
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const PIXELS_PER_SECOND = 40;
  
  const activeAudioTrack = audioTracks.find(t => t.id === selectedPost?.audioTrackId);
  
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

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const newTime = Math.max(0, (clickX - 24) / PIXELS_PER_SECOND);
      setCurrentTime(newTime);
  };

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

  return (
      <div className="flex-1 flex flex-col bg-gray-950 h-full overflow-hidden">
          {/* TOP SECTION: PLAYER & TOOLS */}
          <div className="h-[55%] flex border-b border-gray-800">
              
              {/* MAIN PLAYER */}
              <div className="flex-1 bg-black relative flex items-center justify-center p-4">
                  {/* Player Canvas */}
                  <div className="relative aspect-video h-full max-w-full bg-gray-900 border border-gray-800 shadow-2xl flex items-center justify-center overflow-hidden rounded-lg">
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
                                  <div className="flex flex-col items-center text-gray-600 gap-2">
                                      <Clapperboard size={48} />
                                      <span className="font-mono text-xs uppercase tracking-widest">No Visual Asset</span>
                                  </div>
                              )}
                              
                              {/* Overlay Info */}
                              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded border border-white/10 text-white text-xs font-mono">
                                  <div className="font-bold text-primary-400">SCENE {scenes.indexOf(activeScene) + 1}</div>
                                  <div className="opacity-70 truncate max-w-[200px]">{activeScene.description}</div>
                              </div>
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
                              <div className="text-gray-500 text-xs font-mono mt-2">{renderProgress}% COMPLETE</div>
                          </div>
                      )}
                  </div>
              </div>

              {/* RIGHT PANEL: SCRIPT & METADATA */}
              <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col hidden lg:flex">
                  <div className="p-3 border-b border-gray-800 font-bold text-xs text-gray-400 uppercase flex items-center gap-2 bg-gray-850">
                      <Monitor size={14} /> Scene Details
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto space-y-4">
                      {activeScene ? (
                          <>
                              <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">Duration</label>
                                  <div className="text-xl font-mono text-white">{activeScene.duration?.toFixed(2)}s</div>
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">Prompt</label>
                                  <div className="text-sm text-gray-300 bg-black/30 p-2 rounded border border-gray-800 mt-1">
                                      {activeScene.description}
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase">Transition</label>
                                  <div className="flex items-center gap-2 mt-1">
                                      <span className="px-2 py-1 bg-purple-900/30 text-purple-300 text-xs rounded border border-purple-800 uppercase">
                                          {activeScene.transition || 'Cut'}
                                      </span>
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
                          {isPreviewPlaying ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}
                      </Button>
                      <div className="text-lg font-mono text-white ml-2 tabular-nums">
                          {currentTime.toFixed(2)}s <span className="text-gray-600 text-xs">/ {totalDuration.toFixed(2)}s</span>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                       <Button size="sm" variant="ghost" onClick={onUndo} disabled={historyIndex <= 0} title="Undo"><RotateCcw size={14}/></Button>
                       <Button size="sm" variant="ghost" onClick={onRedo} disabled={historyIndex >= historyLength - 1} title="Redo"><RotateCw size={14}/></Button>
                       <div className="h-4 w-px bg-gray-700 mx-2"></div>
                       <select 
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white w-40 focus:outline-none focus:border-primary-500" 
                          value={selectedPost?.audioTrackId || ''} 
                          onChange={(e) => onSelectAudio(e.target.value)}
                        >
                            <option value="">No Soundtrack</option>
                            {audioTracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                       </select>
                       <Button size="sm" onClick={onRenderMovie} disabled={isRendering}>
                           {isRendering ? <Loader2 size={14} className="animate-spin mr-2"/> : <Download size={14} className="mr-2"/>}
                           Export
                       </Button>
                  </div>
              </div>

              {/* Timeline Track Area */}
              <div className="flex-1 overflow-x-auto relative p-6 select-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5" ref={timelineRef}>
                  
                  {/* Ruler */}
                  <div className="absolute top-0 left-0 right-0 h-6 border-b border-gray-800 flex items-end cursor-pointer z-20 min-w-max" onClick={handleTimelineClick} style={{ width: Math.max(1000, totalWidth + 100) }}>
                      {[...Array(Math.ceil(totalDuration) + 2)].map((_, i) => (
                          <div key={i} className="absolute bottom-0 border-l border-gray-600 h-2 text-[9px] text-gray-500 pl-1 font-mono pointer-events-none" style={{ left: i * PIXELS_PER_SECOND + 24 }}>
                              {i}s
                          </div>
                      ))}
                  </div>

                  {/* Playhead */}
                  <div className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none transition-all duration-75" style={{ left: currentTime * PIXELS_PER_SECOND + 24 }}>
                      <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-red-500 rotate-45 transform origin-center"></div>
                  </div>

                  {/* Tracks Container */}
                  <div className="flex flex-col gap-4 pt-10 min-w-max pl-6 pb-6">
                      
                      {/* Video Track */}
                      <div className="flex items-center h-28 relative">
                          {/* Track Background Line */}
                          <div className="absolute inset-0 flex items-center h-px bg-gray-800 z-0"></div>
                          
                          {scenes.map((scene, idx) => (
                              <React.Fragment key={scene.id}>
                                  <div 
                                      className={`relative z-10 group transition-all duration-200 ${dragOverIndex === idx ? 'scale-105 z-30' : 'hover:scale-[1.02]'}`}
                                      draggable 
                                      onDragStart={(e) => handleDragStart(e, idx)}
                                      onDragOver={(e) => handleDragOver(e, idx)}
                                      onDrop={(e) => handleDrop(e, idx)}
                                      onDragLeave={() => setDragOverIndex(null)}
                                      style={{ width: (scene.duration || 5) * PIXELS_PER_SECOND }}
                                  >
                                      {/* Context Menu / Actions on Hover */}
                                      <div className="absolute -top-8 left-0 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 z-20">
                                          <button onClick={() => onSplitScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-primary-600 text-gray-400 hover:text-white shadow-lg border border-gray-700" title="Split"><Scissors size={10} /></button>
                                          <button onClick={() => onDuplicateScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-primary-600 text-gray-400 hover:text-white shadow-lg border border-gray-700" title="Duplicate"><Copy size={10} /></button>
                                          <button onClick={() => onDeleteScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-red-600 text-gray-400 hover:text-white shadow-lg border border-gray-700" title="Delete"><Trash2 size={10} /></button>
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
                                          
                                          {/* Duration Badge */}
                                          <div className="absolute top-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 rounded z-10 backdrop-blur-sm">
                                              {scene.duration?.toFixed(1)}s
                                          </div>
                                          
                                          {/* In-Clip Actions */}
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                              <button onClick={() => onOpenTrim(scene.id)} className="p-1.5 bg-blue-600 rounded-full text-white hover:scale-110 transition-transform" title="Trim"><Sliders size={12} /></button>
                                              <button onClick={() => onOpenMagicEdit(scene.id)} className="p-1.5 bg-purple-600 rounded-full text-white hover:scale-110 transition-transform" title="AI Edit"><Wand2 size={12} /></button>
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
                                        onClick={() => onUpdateScene(scene.id, { transition: cycleTransition(scene.transition) })} 
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
                            onClick={() => onGenerateImage(scenes[0]?.id || '')} // Logic to add new scene would go here
                            title="Add Scene"
                          >
                              <Plus size={16} />
                          </div>
                      </div>

                      {/* Audio Track Visual */}
                      <div className="flex items-center h-10 relative mt-2">
                         <div className="absolute left-0 -ml-24 w-20 text-xs font-bold text-gray-600 flex items-center gap-2 justify-end pr-2"><Volume2 size={12}/> Audio</div>
                         {activeAudioTrack ? (
                             <div className="h-8 rounded bg-blue-900/20 border border-blue-800/50 flex items-center px-2 relative overflow-hidden" style={{ width: activeAudioTrack.duration * PIXELS_PER_SECOND }}>
                                 <div className="absolute inset-0 opacity-30 flex items-center gap-0.5">
                                     {[...Array(Math.floor(activeAudioTrack.duration * 4))].map((_, i) => (
                                         <div key={i} className="w-1 bg-blue-400 rounded-full" style={{ height: `${20 + Math.random() * 60}%` }}></div>
                                     ))}
                                 </div>
                                 <div className="relative z-10 text-[10px] text-blue-300 font-mono truncate">{activeAudioTrack.name}</div>
                             </div>
                         ) : (
                             <div className="h-8 w-full border border-dashed border-gray-800 rounded flex items-center justify-center text-[10px] text-gray-600 bg-gray-900/30">
                                 No Audio Track Selected
                             </div>
                         )}
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );
};
