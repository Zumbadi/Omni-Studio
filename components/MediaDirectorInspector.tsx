
import React, { useState, useEffect, memo } from 'react';
import { Wand2, Scissors, Image as ImageIcon, Video, Mic, Volume2, Music, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { Scene, Voice } from '../types';

interface MediaDirectorInspectorProps {
  activeScene: Scene | undefined;
  onUpdateScene: (id: string, updates: Partial<Scene>) => void;
  onGenerateImage: (id: string) => void;
  onGenerateVideo: (id: string) => void;
  onGenerateAudio: (sceneId: string, type: 'voice' | 'sfx' | 'music', prompt: string, voiceId?: string) => Promise<void>;
  onOpenMagicEdit: (id: string) => void;
  onOpenTrim: (id: string) => void;
  voices: Voice[];
  onAutoGenerateAudioPrompt?: (type: 'voice' | 'sfx' | 'music', sceneId: string) => Promise<string>;
}

export const MediaDirectorInspector: React.FC<MediaDirectorInspectorProps> = memo(({
  activeScene, onUpdateScene, onGenerateImage, onGenerateVideo, onGenerateAudio, onOpenMagicEdit, onOpenTrim, voices, onAutoGenerateAudioPrompt
}) => {
  const [audioMode, setAudioMode] = useState<'voice' | 'sfx' | 'music'>('voice');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(voices[0]?.id || 'def');
  const [audioPrompt, setAudioPrompt] = useState('');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Sync internal state when active scene changes
  useEffect(() => {
      if (activeScene) {
          if (audioMode === 'voice' && activeScene.audioScript) {
              setAudioPrompt(activeScene.audioScript);
          } else {
              setAudioPrompt('');
          }
      }
  }, [activeScene?.id, audioMode, activeScene?.audioScript]);

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

  if (!activeScene) {
      return (
          <div className="w-full lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col justify-center items-center text-gray-500 text-xs p-4">
              Select a scene on the timeline to edit.
          </div>
      );
  }

  return (
    <div className="w-full lg:w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden shrink-0">
        <div className="p-3 border-b border-gray-800 font-bold text-xs uppercase text-gray-500">Inspector</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20 lg:pb-4">
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
        </div>
    </div>
  );
});
