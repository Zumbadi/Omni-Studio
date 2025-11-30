
import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, LayoutTemplate, Download, Loader2, Mic, Plus, FileText, Trash2, Volume2 } from 'lucide-react';
import { Button } from './Button';
import { AudioTrack } from '../types';
import { bufferToWav } from '../utils/audioHelpers';
import { AudioTab } from './AudioSidebar';

interface AudioTimelineProps {
  tracks: AudioTrack[];
  isPlaying: boolean;
  onTogglePlay: () => void;
  onExportMix: () => void;
  isExporting: boolean;
  onShowAssets: () => void;
  activeTab: string;
  setActiveTab: (tab: AudioTab) => void;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  onTranscribe: (track: AudioTrack) => void;
  isTranscribing: boolean;
  onDeleteTrack: (id: string) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;
  handleVolumeChange: (id: string, val: number) => void;
  setTracks: React.Dispatch<React.SetStateAction<AudioTrack[]>>;
  audioRefs: React.MutableRefObject<{ [key: string]: HTMLAudioElement }>;
}

export const AudioTimeline: React.FC<AudioTimelineProps> = ({
  tracks, isPlaying, onTogglePlay, onExportMix, isExporting, onShowAssets,
  activeTab, setActiveTab, isRecording, startRecording, stopRecording,
  onTranscribe, isTranscribing, onDeleteTrack, toggleMute, toggleSolo, handleVolumeChange, setTracks, audioRefs
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    trackId: string | null;
    startX: number;
    originalOffset: number;
  }>({ isDragging: false, trackId: null, startX: 0, originalOffset: 0 });

  const rafRef = useRef<number>();

  const formatTime = (seconds: number) => {
      if (isNaN(seconds) || seconds < 0) return "00:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Optimized Canvas Visualizer Loop
  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderFrame = () => {
          if (!canvas) return;
          // Resize if needed
          if (canvas.width !== canvas.clientWidth) {
             canvas.width = canvas.clientWidth;
             canvas.height = canvas.clientHeight;
          }

          const width = canvas.width;
          const height = canvas.height;
          
          ctx.clearRect(0, 0, width, height);
          
          const barWidth = 6;
          const gap = 2;
          const bars = Math.floor(width / (barWidth + gap));
          
          // Create gradient
          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, '#4f46e5');
          gradient.addColorStop(1, '#a855f7');
          ctx.fillStyle = gradient;

          const time = Date.now() / 150;

          for (let i = 0; i < bars; i++) {
              let barHeight = 5;
              
              if (isPlaying) {
                  const wave1 = Math.sin(time + i * 0.1);
                  const wave2 = Math.sin(time * 0.5 + i * 0.05);
                  const noise = Math.random() * 0.2;
                  const value = ((wave1 + wave2 + 2) / 4); // 0 to 1
                  barHeight = value * (height * 0.8) + (noise * height * 0.1);
              } else {
                  barHeight = height * 0.1;
              }

              const x = i * (barWidth + gap);
              const y = height - barHeight;
              
              // Rounded top bar
              ctx.beginPath();
              ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
              ctx.fill();
          }

          rafRef.current = requestAnimationFrame(renderFrame);
      };

      renderFrame();
      return () => { 
          if (rafRef.current) cancelAnimationFrame(rafRef.current); 
      };
  }, [isPlaying]);

  // Dragging Listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging || !dragState.trackId || !timelineRef.current) return;

      const timelineWidth = timelineRef.current.clientWidth;
      const deltaPixels = e.clientX - dragState.startX;
      const deltaPercent = (deltaPixels / timelineWidth) * 100;
      const deltaSeconds = deltaPercent * 0.5; // 1% = 0.5s (Approximation based on zoom)

      const newOffset = Math.max(0, dragState.originalOffset + deltaSeconds);
      
      setTracks(prev => prev.map(t => 
        t.id === dragState.trackId ? { ...t, startOffset: Number(newOffset.toFixed(2)) } : t
      ));
    };

    const handleMouseUp = () => {
      if (dragState.isDragging) {
        setDragState({ isDragging: false, trackId: null, startX: 0, originalOffset: 0 });
      }
    };

    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, setTracks]);

  const handleTrackMouseDown = (e: React.MouseEvent, track: AudioTrack) => {
    setDragState({
      isDragging: true,
      trackId: track.id,
      startX: e.clientX,
      originalOffset: track.startOffset
    });
  };

  const handleExportMixLocal = async () => {
      if (tracks.length === 0) return;
      if (onExportMix) {
          onExportMix();
          return;
      }

      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const totalDuration = Math.max(...tracks.map(t => t.startOffset + t.duration)) || 10;
          const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * 44100), 44100);
          
          let outputNode: AudioNode = offlineCtx.destination;

          for (const track of tracks) {
              if (track.audioUrl && !track.muted) { 
                  try {
                      const response = await fetch(track.audioUrl);
                      const arrayBuffer = await response.arrayBuffer();
                      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                      
                      const source = offlineCtx.createBufferSource();
                      source.buffer = audioBuffer;
                      
                      const gain = offlineCtx.createGain();
                      gain.gain.value = track.volume ?? 1.0;
                      
                      source.connect(gain);
                      gain.connect(outputNode);
                      
                      source.start(track.startOffset);
                  } catch (e) {
                      console.error("Failed to process track", track.id, e);
                  }
              }
          }
          
          const renderedBuffer = await offlineCtx.startRendering();
          const wavBlob = bufferToWav(renderedBuffer);
          
          const url = URL.createObjectURL(wavBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'omni-mix.wav';
          a.click();
      } catch (error) { 
          console.error(error); 
          alert("Export failed. Check console for details.");
      }
  };

  return (
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
         {/* Top Control Bar */}
         <div className="h-14 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-6 shadow-md z-10">
            <div className="flex items-center gap-4">
               <button 
                 onClick={onTogglePlay}
                 className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-500 flex items-center justify-center text-white shadow-lg transition-all active:scale-95"
               >
                 {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
               </button>
               <div className="text-2xl font-mono text-gray-400 tracking-widest">
                  00:00:00 <span className="text-sm text-gray-600 tracking-normal">/ 00:05:30</span>
               </div>
            </div>
            <div className="flex gap-2">
               <Button variant="ghost" size="sm" onClick={onShowAssets}><LayoutTemplate size={14} className="mr-2"/> Assets</Button>
               <Button 
                  size="sm" 
                  onClick={handleExportMixLocal}
                  disabled={isExporting || tracks.length === 0}
               >
                  {isExporting ? <Loader2 size={14} className="animate-spin mr-2"/> : <Download size={14} className="mr-2"/>}
                  Export Mix
               </Button>
            </div>
         </div>

         {/* Visualizer (Canvas) */}
         <div className="h-32 bg-gray-900 border-b border-gray-800 relative overflow-hidden">
            <canvas ref={canvasRef} className="w-full h-full absolute inset-0" />
            <div className="absolute bottom-2 right-4 text-[10px] text-gray-500 font-mono bg-black/50 px-1 rounded z-10">MASTER OUT L/R</div>
         </div>

         {/* Track List */}
         <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black select-none">
            {tracks.map((track) => (
              <div key={track.id} className="flex items-center gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                 {/* Track Control Header */}
                 <div className="w-72 bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col gap-2 flex-shrink-0 shadow-md relative">
                    <div className="flex items-center justify-between">
                        <div className="truncate w-32 text-sm font-medium text-gray-200">{track.name}</div>
                        <div className="flex gap-1">
                            {track.audioUrl && (
                                <button onClick={() => onTranscribe(track)} className="text-gray-600 hover:text-primary-400 p-1" title="Transcribe Audio" disabled={isTranscribing}>
                                    {isTranscribing ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
                                </button>
                            )}
                            <button onClick={() => onDeleteTrack(track.id)} className="text-gray-600 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                        </div>
                    </div>
                    
                    {/* Mixer Controls */}
                    <div className="flex items-center gap-2">
                        <button 
                           onClick={() => toggleMute(track.id)}
                           className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition-colors border ${track.muted ? 'bg-red-900/50 text-red-400 border-red-800' : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-white'}`}
                           title="Mute"
                        >M</button>
                        <button 
                           onClick={() => toggleSolo(track.id)}
                           className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition-colors border ${track.solo ? 'bg-yellow-900/50 text-yellow-400 border-yellow-800' : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-white'}`}
                           title="Solo"
                        >S</button>
                        <div className="flex-1 flex items-center gap-2">
                            <Volume2 size={12} className="text-gray-600" />
                            <input 
                              type="range" 
                              min="0" 
                              max="1" 
                              step="0.1" 
                              value={track.volume ?? 1.0}
                              onChange={(e) => handleVolumeChange(track.id, parseFloat(e.target.value))}
                              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                        </div>
                    </div>

                    {track.audioUrl && (
                      <audio 
                        ref={el => { if(el) audioRefs.current[track.id] = el; }} 
                        src={track.audioUrl} 
                        loop={track.type === 'music'}
                      />
                    )}
                 </div>

                 {/* Timeline Lane */}
                 <div 
                   className={`flex-1 h-20 rounded-lg relative overflow-hidden border shadow-inner cursor-crosshair transition-colors
                     ${track.muted ? 'bg-gray-900 border-gray-800 opacity-50' : 'bg-gray-900 border-gray-800'}
                   `}
                   ref={timelineRef}
                 >
                    <div 
                      onMouseDown={(e) => handleTrackMouseDown(e, track)}
                      className={`absolute top-1 bottom-1 rounded-md border flex items-center px-3 transition-colors shadow-sm z-10
                        ${track.type === 'music' ? 'bg-blue-900/40 border-blue-700/50 hover:bg-blue-900/60' : 'bg-purple-900/40 border-purple-700/50 hover:bg-purple-900/60'}
                        ${dragState.trackId === track.id ? 'cursor-grabbing ring-2 ring-white/50' : 'cursor-grab'}
                      `}
                      style={{ 
                        left: `${track.startOffset * 2}%`, 
                        width: `${Math.max(10, track.duration * 2)}%`,
                        minWidth: '60px'
                      }}
                    >
                       <div className="absolute left-0 w-2 h-full bg-black/20 cursor-ew-resize hover:bg-white/20"></div>
                       
                       {/* Waveform graphic */}
                       <div className="w-full h-full flex items-center gap-0.5 opacity-50 pointer-events-none">
                          {[...Array(20)].map((_, i) => (
                             <div key={i} className="w-1 rounded-full bg-white/50" style={{ height: `${20 + Math.random() * 60}%` }}></div>
                          ))}
                       </div>
                       <span className="absolute left-2 text-[10px] text-white/70 font-medium truncate max-w-full pr-2 drop-shadow-md pointer-events-none select-none">{track.name}</span>
                       
                       {dragState.trackId === track.id && (
                         <div className="absolute -top-6 left-0 bg-white text-black text-[10px] font-bold px-1.5 rounded">
                            {formatTime(track.startOffset)}
                         </div>
                       )}
                    </div>
                    
                    {/* Grid Lines */}
                    <div className="absolute inset-0 grid grid-cols-[repeat(20,1fr)] pointer-events-none opacity-5">
                       {[...Array(20)].map((_, i) => <div key={i} className="border-l border-white h-full"></div>)}
                    </div>
                 </div>
              </div>
            ))}
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-900 mt-8">
                <button 
                   onClick={() => { setActiveTab('mixer'); if(!isRecording) startRecording(); else stopRecording(); }}
                   className={`py-4 border-2 border-dashed rounded-xl transition-all flex items-center justify-center gap-2 ${isRecording && activeTab === 'mixer' ? 'border-red-500 bg-red-900/10 text-red-400' : 'border-gray-800 text-gray-600 hover:border-gray-600 hover:text-gray-400'}`}
                >
                   <Mic size={16} className={isRecording && activeTab === 'mixer' ? "animate-pulse" : ""} /> {isRecording && activeTab === 'mixer' ? 'Stop Recording...' : 'Record Mic Track'}
                </button>
                <button className="py-4 border-2 border-dashed border-gray-800 rounded-xl text-gray-600 hover:border-gray-600 hover:text-gray-400 transition-all flex items-center justify-center gap-2">
                   <Plus size={16} /> Import Audio File
                </button>
            </div>
         </div>
      </div>
  );
};
