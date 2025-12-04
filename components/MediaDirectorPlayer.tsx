
import React, { useRef, useEffect, memo } from 'react';
import { Film, Loader2, Play, Maximize, Download } from 'lucide-react';
import { Scene } from '../types';

interface MediaDirectorPlayerProps {
  activeScene: Scene | undefined;
  isPreviewPlaying: boolean;
  setIsPreviewPlaying: (playing: boolean) => void;
  isRendering: boolean;
  renderProgress: number;
  currentTime: number;
  totalDuration: number;
  scenes: Scene[];
  loadingMsgIndex: number;
}

const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
};

const LOADING_MESSAGES = [
    "Initializing neural renderer...",
    "Dreaming up frames...",
    "Applying cinematic lighting...",
    "Synthesizing motion vectors...",
    "Polishing pixels...",
    "Almost there..."
];

export const MediaDirectorPlayer: React.FC<MediaDirectorPlayerProps> = memo(({
  activeScene, isPreviewPlaying, setIsPreviewPlaying, isRendering, renderProgress,
  currentTime, totalDuration, scenes, loadingMsgIndex
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync Video Element
  useEffect(() => {
      if (videoRef.current && activeScene?.videoUrl) {
          // Calculate time relative to the start of the scene
          // We need the scene's start time. We can estimate it or pass it. 
          // Ideally, the parent passes exact scene start time, but for now we rely on the parent's logic
          // ensuring activeScene is correct.
          
          if (isPreviewPlaying && videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
          } else if (!isPreviewPlaying && !videoRef.current.paused) {
              videoRef.current.pause();
          }
      }
  }, [isPreviewPlaying, activeScene]);

  const handleFullscreen = () => {
      const el = document.getElementById('media-player-container');
      if (el) {
          if (el.requestFullscreen) el.requestFullscreen();
          else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
      }
  };

  return (
    <div className="flex-1 bg-black relative flex items-center justify-center p-4 border-b lg:border-b-0 lg:border-r border-gray-800 min-h-[300px]">
        <div id="media-player-container" className="aspect-video w-full max-w-4xl bg-gray-900 rounded-lg overflow-hidden shadow-2xl relative group flex items-center justify-center">
            {activeScene?.videoUrl ? (
                <video 
                    ref={videoRef}
                    src={activeScene.videoUrl} 
                    className="w-full h-full object-contain"
                    muted // Muted by default to allow autoplay, audio is handled by global mixer
                    playsInline
                />
            ) : activeScene?.imageUrl ? (
                <img src={activeScene.imageUrl} className="w-full h-full object-contain" alt="Scene" />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-700">
                    {activeScene?.status === 'generating' ? (
                        <>
                            <Loader2 size={48} className="animate-spin mb-4 text-purple-500" />
                            <div className="text-sm font-mono animate-pulse text-purple-300">Generating Video...</div>
                            <div className="text-xs text-gray-500 mt-2 font-mono animate-pulse">{LOADING_MESSAGES[loadingMsgIndex]}</div>
                        </>
                    ) : (
                        <>
                            <Film size={48} className="mb-4" />
                            <p className="text-sm">No Media</p>
                        </>
                    )}
                </div>
            )}
            
            {/* Render Overlay */}
            {isRendering && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Loader2 size={64} className="text-primary-500 animate-spin mb-6" />
                    <div className="text-xl font-bold text-white mb-2">Rendering Movie</div>
                    <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${renderProgress}%` }}></div>
                    </div>
                    <div className="text-sm text-gray-400 mt-2">{renderProgress}% Complete</div>
                </div>
            )}
            
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button
                    onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
                    className="bg-black/60 text-white p-2 rounded-full hover:bg-primary-600 transition-colors backdrop-blur-md"
                    title="Fullscreen"
                >
                    <Maximize size={16} />
                </button>
                {activeScene?.videoUrl && (
                    <a 
                        href={activeScene.videoUrl} 
                        download={`scene-${activeScene.id}.mp4`}
                        className="bg-black/60 text-white p-2 rounded-full hover:bg-primary-600 transition-colors backdrop-blur-md"
                        title="Download Video"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download size={16} />
                    </a>
                )}
            </div>
            
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded text-xs font-mono text-white/90 backdrop-blur-sm pointer-events-none">
                Scene {scenes.findIndex(s => s.id === activeScene?.id) + 1} • {formatTime(currentTime)} / {formatTime(totalDuration)}
            </div>
            
            {!isPreviewPlaying && !isRendering && (
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
  );
});
