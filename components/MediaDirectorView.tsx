
import React, { useRef, useState } from 'react';
import { Film, Music, RotateCcw, RotateCw, Pause, Play, Loader2, Download, Scissors, Copy, Trash2, Clock, Sliders, Wand2, Layers, ArrowRightLeft, Plus, Volume2 } from 'lucide-react';
import { Button } from './Button';
import { SocialPost, AudioTrack, Scene } from '../types';

interface MediaDirectorViewProps {
  selectedPost: SocialPost | null;
  audioTracks: AudioTrack[];
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPreviewPlaying: boolean;
  setIsPreviewPlaying: (playing: any) => void; // accepts function or bool
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
  const PIXELS_PER_SECOND = 40;
  
  const activeAudioTrack = audioTracks.find(t => t.id === selectedPost?.audioTrackId);
  const totalDuration = selectedPost?.scenes?.reduce((acc, s) => acc + (s.duration || 5), 0) || 0;
  const totalWidth = totalDuration * PIXELS_PER_SECOND;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft;
      const newTime = Math.max(0, (clickX - 24) / PIXELS_PER_SECOND); // 24px padding
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
      <div className="flex-1 flex flex-col bg-gray-950 p-6 overflow-hidden">
          <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Film size={16}/> Director's Cut Timeline</h3>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                   <div className="flex items-center gap-2 mr-4 border-r border-gray-800 pr-4">
                        <Music size={14} className="text-gray-500" />
                        <select className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white w-40" value={selectedPost?.audioTrackId || ''} onChange={(e) => onSelectAudio(e.target.value)}>
                            <option value="">No Soundtrack</option>
                            {audioTracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                   </div>
                   <Button size="sm" variant="secondary" onClick={onUndo} disabled={historyIndex <= 0} title="Undo"><RotateCcw size={14} className="md:mr-1"/> <span className="hidden md:inline">Undo</span></Button>
                   <Button size="sm" variant="secondary" onClick={onRedo} disabled={historyIndex >= historyLength - 1} title="Redo"><RotateCw size={14} className="md:mr-1"/> <span className="hidden md:inline">Redo</span></Button>
                   <Button size="sm" variant="secondary" onClick={() => setIsPreviewPlaying((p: boolean) => !p)}>{isPreviewPlaying ? <Pause size={14} className="md:mr-2"/> : <Play size={14} className="md:mr-2"/>} <span className="hidden md:inline">{isPreviewPlaying ? 'Pause' : 'Play'}</span></Button>
                   <Button size="sm" onClick={onRenderMovie} disabled={isRendering}>
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
                                  className={`relative z-10 group transition-transform ${dragOverIndex === idx ? 'scale-105 z-30' : ''}`}
                                  draggable 
                                  onDragStart={(e) => handleDragStart(e, idx)}
                                  onDragOver={(e) => handleDragOver(e, idx)}
                                  onDrop={(e) => handleDrop(e, idx)}
                                  onDragLeave={() => setDragOverIndex(null)}
                                  style={{ width: (scene.duration || 5) * PIXELS_PER_SECOND }}
                              >
                                  <div className="absolute -top-8 left-0 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 z-20">
                                      <button onClick={() => onSplitScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-primary-600 text-gray-400 hover:text-white" title="Split"><Scissors size={12} /></button>
                                      <button onClick={() => onDuplicateScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-primary-600 text-gray-400 hover:text-white" title="Duplicate"><Copy size={12} /></button>
                                      <button onClick={() => onDeleteScene(idx)} className="bg-gray-800 p-1.5 rounded hover:bg-red-600 text-gray-400 hover:text-white" title="Delete"><Trash2 size={12} /></button>
                                  </div>

                                  <div className={`w-full h-full bg-black rounded-lg border-2 overflow-hidden relative shadow-lg transition-colors flex-shrink-0 ${dragOverIndex === idx ? 'border-primary-500 ring-2 ring-primary-500/50' : 'border-gray-700 group-hover:border-primary-500'} ${scene.bgRemoved ? 'bg-[url(https://www.transparenttextures.com/patterns/checkered-pattern.png)]' : ''}`}>
                                      {scene.imageUrl ? (
                                          <img src={scene.imageUrl} className={`w-full h-full object-cover ${scene.bgRemoved ? 'object-contain' : ''}`} draggable={false} />
                                      ) : <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">No Visual</div>}
                                      
                                      <div className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded z-10"><Clock size={8} className="inline mr-0.5"/> {scene.duration?.toFixed(1)}s</div>
                                      
                                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 flex-wrap p-2 content-center cursor-grab active:cursor-grabbing">
                                          <div className="flex flex-col gap-1 w-full px-2">
                                              <button onClick={() => onOpenTrim(scene.id)} className="w-full py-1 bg-blue-900/80 rounded text-[9px] text-blue-200 hover:text-white flex items-center justify-center gap-1"><Sliders size={10} /> Trim</button>
                                              <button onClick={() => onOpenMagicEdit(scene.id)} className="w-full py-1 bg-purple-900/80 rounded text-[9px] text-purple-200 hover:text-white flex items-center justify-center gap-1"><Wand2 size={10} /> Edit</button>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="mt-2 text-[9px] text-gray-500 truncate w-full text-center px-1">{idx+1}. {scene.description}</div>
                              </div>

                              {/* Transition Node */}
                              {idx < (selectedPost?.scenes?.length || 0) - 1 && (
                                  <div className="relative z-10 w-6 flex flex-col items-center justify-center cursor-pointer -ml-3 -mr-3 group/trans" onClick={() => onUpdateScene(scene.id, { transition: cycleTransition(scene.transition) })} style={{ zIndex: 20 }}>
                                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-gray-900 transition-colors shadow-md ${scene.transition && scene.transition !== 'cut' ? 'border-purple-500 text-purple-500' : 'border-gray-600 text-gray-600'}`}>
                                          {scene.transition && scene.transition !== 'cut' ? <Layers size={10} /> : <ArrowRightLeft size={10} />}
                                      </div>
                                  </div>
                              )}
                          </React.Fragment>
                      ))}
                      <div className="w-12 h-full rounded-lg border-2 border-dashed border-gray-800 flex items-center justify-center text-gray-600 hover:text-white hover:border-gray-600 cursor-pointer ml-2 transition-colors" onClick={() => onGenerateImage(selectedPost?.scenes?.[0]?.id || '')}><Plus size={20} /></div>
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
