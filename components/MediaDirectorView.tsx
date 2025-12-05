
import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { SocialPost, AudioTrack, Scene, Voice } from '../types';
import { MediaDirectorPlayer } from './MediaDirectorPlayer';
import { MediaDirectorInspector } from './MediaDirectorInspector';
import { MediaDirectorTimeline } from './MediaDirectorTimeline';
import { MediaBatchGenerator } from './MediaBatchGenerator';
import { Wand2, ZoomIn, ZoomOut } from 'lucide-react';

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
  onUpdateAudioTrack: (trackId: string, updates: Partial<AudioTrack>) => void;
  onDeleteAudioTrack: (trackId: string) => void;
  onPublish: () => void;
}

export const MediaDirectorView: React.FC<MediaDirectorViewProps> = memo(({
  selectedPost, audioTracks, currentTime, setCurrentTime, isPreviewPlaying, setIsPreviewPlaying,
  isRendering, renderProgress, onSelectAudio, onUndo, onRedo, onRenderMovie,
  onGenerateImage, onGenerateVideo, onGenerateAudio, onSplitScene, onDuplicateScene, onDeleteScene, onOpenTrim, onOpenMagicEdit, onUpdateScene, onReorderScenes, cycleTransition,
  historyIndex, historyLength, onAddScene, voices, onAutoGenerateAudioPrompt, onUpdateAudioTrack, onDeleteAudioTrack, onPublish
}) => {
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [showBatchGenerator, setShowBatchGenerator] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Calculate Metrics (Memoized for performance)
  const scenes = selectedPost?.scenes || [];
  const sceneMetrics = useMemo(() => {
      let accumulatedTime = 0;
      return scenes.map(s => {
          const start = accumulatedTime;
          accumulatedTime += (s.duration || 5);
          return { ...s, startTime: start, endTime: accumulatedTime };
      });
  }, [scenes]);
  
  const maxAudioDuration = useMemo(() => {
      return audioTracks.reduce((acc, t) => Math.max(acc, t.startOffset + t.duration), 0);
  }, [audioTracks]);

  const totalDuration = Math.max(sceneMetrics[sceneMetrics.length - 1]?.endTime || 10, maxAudioDuration);

  // Active Scene Logic - this is fast enough to run on render, using the memoized metrics
  const activeScene = sceneMetrics.find(s => currentTime >= s.startTime && currentTime < s.endTime) || sceneMetrics[sceneMetrics.length - 1];
  
  // Loading Message Rotation
  useEffect(() => {
      let interval: any;
      if (activeScene?.status === 'generating') {
          interval = setInterval(() => {
              setLoadingMsgIndex(prev => (prev + 1) % 6);
          }, 3000);
      }
      return () => clearInterval(interval);
  }, [activeScene?.status]);

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // Avoid triggering if in an input field
          if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

          if (e.code === 'Space' || e.key === 'k') {
              e.preventDefault();
              setIsPreviewPlaying(!isPreviewPlaying);
          }
          if (e.key === 'j') {
              setCurrentTime(Math.max(0, currentTime - 5));
          }
          if (e.key === 'l') {
              setCurrentTime(Math.min(totalDuration, currentTime + 5));
          }
          if (e.key === 'ArrowLeft') {
              setCurrentTime(Math.max(0, currentTime - 1));
          }
          if (e.key === 'ArrowRight') {
              setCurrentTime(Math.min(totalDuration, currentTime + 1));
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewPlaying, currentTime, totalDuration, setIsPreviewPlaying, setCurrentTime]);

  return (
    <div className="flex flex-col h-full bg-black/80 text-white overflow-hidden relative">
        {showBatchGenerator && (
            <MediaBatchGenerator 
                scenes={scenes}
                audioTracks={audioTracks}
                voices={voices}
                styleReferences={selectedPost?.styleReferences || []}
                onUpdateScene={onUpdateScene}
                onUpdateTrack={onUpdateAudioTrack}
                onClose={() => setShowBatchGenerator(false)}
            />
        )}

        {/* Top: Player & Inspector */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden relative">
            
            {/* Toolbar Overlay */}
            <div className="absolute top-4 left-4 z-20 flex gap-2">
                <button 
                    onClick={() => setShowBatchGenerator(true)} 
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-full shadow-lg border border-purple-400/50 backdrop-blur-md transition-all hover:scale-105"
                >
                    <Wand2 size={14}/> <span className="text-xs font-bold">Magic Build</span>
                </button>
                <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-full px-2 py-1 border border-white/10">
                    <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 hover:text-primary-400 text-gray-300"><ZoomOut size={14}/></button>
                    <span className="text-[10px] font-mono text-gray-400 w-8 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1 hover:text-primary-400 text-gray-300"><ZoomIn size={14}/></button>
                </div>
            </div>

            <MediaDirectorPlayer 
                activeScene={activeScene}
                isPreviewPlaying={isPreviewPlaying}
                setIsPreviewPlaying={setIsPreviewPlaying}
                isRendering={isRendering}
                renderProgress={renderProgress}
                currentTime={currentTime}
                totalDuration={totalDuration}
                scenes={scenes}
                loadingMsgIndex={loadingMsgIndex}
            />

            <MediaDirectorInspector 
                activeScene={activeScene}
                onUpdateScene={onUpdateScene}
                onGenerateImage={onGenerateImage}
                onGenerateVideo={onGenerateVideo}
                onGenerateAudio={onGenerateAudio}
                onOpenMagicEdit={onOpenMagicEdit}
                onOpenTrim={onOpenTrim}
                voices={voices}
                onAutoGenerateAudioPrompt={onAutoGenerateAudioPrompt}
            />
        </div>

        {/* Bottom: Timeline */}
        <MediaDirectorTimeline 
            scenes={scenes}
            audioTracks={audioTracks}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            totalDuration={totalDuration}
            activeSceneId={activeScene?.id}
            onUpdateScene={onUpdateScene}
            onReorderScenes={onReorderScenes}
            onSplitScene={onSplitScene}
            onDuplicateScene={onDuplicateScene}
            onDeleteScene={onDeleteScene}
            cycleTransition={cycleTransition}
            onUpdateAudioTrack={onUpdateAudioTrack}
            onDeleteAudioTrack={onDeleteAudioTrack}
            isPlaying={isPreviewPlaying}
            onTogglePlay={() => setIsPreviewPlaying(!isPreviewPlaying)}
            onAddScene={onAddScene}
            onUndo={onUndo}
            onRedo={onRedo}
            onRenderMovie={onRenderMovie}
            isRendering={isRendering}
            onPublish={onPublish}
            historyIndex={historyIndex}
            historyLength={historyLength}
            pixelsPerSecond={40 * zoom}
        />
    </div>
  );
});
