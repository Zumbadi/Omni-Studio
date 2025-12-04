
import React, { useState } from 'react';
import { Wand2, Image as ImageIcon, Volume2, CheckCircle2, Loader2, X, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { Scene, AudioTrack, Voice, ReferenceAsset } from '../types';
import { generateImage, generateSpeech, generateSoundEffect, generateBackgroundMusic } from '../services/geminiService';

interface MediaBatchGeneratorProps {
  scenes: Scene[];
  audioTracks: AudioTrack[];
  voices: Voice[];
  styleReferences: ReferenceAsset[];
  onUpdateScene: (id: string, updates: Partial<Scene>) => void;
  onUpdateTrack: (id: string, updates: Partial<AudioTrack>) => void;
  onClose: () => void;
}

export const MediaBatchGenerator: React.FC<MediaBatchGeneratorProps> = ({
  scenes, audioTracks, voices, styleReferences, onUpdateScene, onUpdateTrack, onClose
}) => {
  // Filter only pending items
  const pendingScenes = scenes.filter(s => !s.imageUrl && !s.videoUrl);
  const pendingAudio = audioTracks.filter(t => !t.audioUrl);

  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>(pendingScenes.map(s => s.id));
  const [selectedAudioIds, setSelectedAudioIds] = useState<string[]>(pendingAudio.map(t => t.id));
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(voices[0]?.id || '');
  const [selectedStyleId, setSelectedStyleId] = useState<string>(styleReferences[0]?.id || '');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const toggleScene = (id: string) => {
    setSelectedSceneIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAudio = (id: string) => {
    setSelectedAudioIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(0);
    setLogs([]);

    const total = selectedSceneIds.length + selectedAudioIds.length;
    let completed = 0;

    const updateProgress = (msg: string) => {
        completed++;
        setProgress((completed / total) * 100);
        setLogs(prev => [...prev, msg]);
    };

    // 1. Generate Images
    for (const id of selectedSceneIds) {
        const scene = scenes.find(s => s.id === id);
        if (!scene) continue;

        const styleRef = styleReferences.find(r => r.id === selectedStyleId);
        const prompt = styleRef ? `${scene.description}. Style: ${styleRef.stylePrompt}` : scene.description;

        try {
            onUpdateScene(id, { status: 'generating' });
            const imageUrl = await generateImage(prompt);
            if (imageUrl) {
                onUpdateScene(id, { imageUrl, status: 'done' });
                updateProgress(`Generated image for Scene ${scenes.findIndex(s => s.id === id) + 1}`);
            } else {
                onUpdateScene(id, { status: 'pending' });
                updateProgress(`Failed to generate image for Scene ${scenes.findIndex(s => s.id === id) + 1}`);
            }
        } catch (e) {
            console.error(e);
            onUpdateScene(id, { status: 'pending' });
        }
    }

    // 2. Generate Audio
    for (const id of selectedAudioIds) {
        const track = audioTracks.find(t => t.id === id);
        if (!track) continue;

        try {
            let audioUrl = '';
            // Parse prompt from name or use name as prompt
            const prompt = track.name.split(':')[1]?.trim() || track.name; 

            if (track.type === 'voiceover') {
                const voice = voices.find(v => v.id === selectedVoiceId) || voices[0];
                audioUrl = await generateSpeech(prompt, voice);
            } else if (track.type === 'sfx') {
                audioUrl = await generateSoundEffect(prompt);
            } else if (track.type === 'music') {
                audioUrl = await generateBackgroundMusic(prompt);
            }

            if (audioUrl) {
                onUpdateTrack(id, { audioUrl });
                updateProgress(`Generated audio: ${track.name}`);
            } else {
                updateProgress(`Failed audio: ${track.name}`);
            }
        } catch (e) {
            console.error(e);
        }
    }

    setIsGenerating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Wand2 className="text-purple-500" size={24} /> Magic Build
            </h2>
            <p className="text-sm text-gray-400">Batch generate missing assets for your project.</p>
          </div>
          <button onClick={onClose} disabled={isGenerating} className="text-gray-500 hover:text-white disabled:opacity-50"><X size={24}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Global Settings */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Default Voice</label>
                    <select 
                        value={selectedVoiceId} 
                        onChange={(e) => setSelectedVoiceId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                    >
                        {voices.map(v => <option key={v.id} value={v.id}>{v.name} ({v.gender})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Visual Style</label>
                    <select 
                        value={selectedStyleId} 
                        onChange={(e) => setSelectedStyleId(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none"
                        disabled={styleReferences.length === 0}
                    >
                        {styleReferences.length === 0 && <option>No styles added</option>}
                        {styleReferences.map(s => <option key={s.id} value={s.id}>{s.stylePrompt?.substring(0, 30)}...</option>)}
                    </select>
                </div>
            </div>

            <div className="border-t border-gray-800 pt-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                    <span>Pending Scenes ({selectedSceneIds.length})</span>
                    <button onClick={() => setSelectedSceneIds(selectedSceneIds.length === pendingScenes.length ? [] : pendingScenes.map(s => s.id))} className="text-xs text-blue-400 hover:text-blue-300">
                        {selectedSceneIds.length === pendingScenes.length ? 'Deselect All' : 'Select All'}
                    </button>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {pendingScenes.length === 0 && <div className="text-sm text-gray-500 italic">No pending scenes.</div>}
                    {pendingScenes.map((scene, idx) => (
                        <div key={scene.id} onClick={() => toggleScene(scene.id)} className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${selectedSceneIds.includes(scene.id) ? 'bg-purple-900/20 border-purple-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'}`}>
                            <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center ${selectedSceneIds.includes(scene.id) ? 'bg-purple-500 border-purple-500' : 'border-gray-500'}`}>
                                {selectedSceneIds.includes(scene.id) && <CheckCircle2 size={12} className="text-white"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <ImageIcon size={14} className="text-gray-400"/>
                                    <span className="text-xs font-bold text-gray-300">Scene {scenes.findIndex(s => s.id === scene.id) + 1}</span>
                                </div>
                                <p className="text-xs text-gray-400 truncate">{scene.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="border-t border-gray-800 pt-4">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                    <span>Pending Audio ({selectedAudioIds.length})</span>
                    <button onClick={() => setSelectedAudioIds(selectedAudioIds.length === pendingAudio.length ? [] : pendingAudio.map(t => t.id))} className="text-xs text-blue-400 hover:text-blue-300">
                        {selectedAudioIds.length === pendingAudio.length ? 'Deselect All' : 'Select All'}
                    </button>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {pendingAudio.length === 0 && <div className="text-sm text-gray-500 italic">No pending audio tracks.</div>}
                    {pendingAudio.map((track) => (
                        <div key={track.id} onClick={() => toggleAudio(track.id)} className={`p-3 rounded-lg border flex items-start gap-3 cursor-pointer transition-colors ${selectedAudioIds.includes(track.id) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800 border-gray-700 hover:bg-gray-750'}`}>
                            <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center ${selectedAudioIds.includes(track.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-500'}`}>
                                {selectedAudioIds.includes(track.id) && <CheckCircle2 size={12} className="text-white"/>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Volume2 size={14} className="text-gray-400"/>
                                    <span className="text-xs font-bold text-gray-300">{track.type.toUpperCase()}</span>
                                </div>
                                <p className="text-xs text-gray-400 truncate">{track.name}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Logs Area */}
            {isGenerating && (
                <div className="bg-black rounded-lg p-3 font-mono text-[10px] text-green-400 h-32 overflow-y-auto border border-gray-700">
                    {logs.map((log, i) => <div key={i}>&gt; {log}</div>)}
                    <div className="animate-pulse">&gt; _</div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 bg-gray-850 flex items-center justify-between shrink-0">
            <div className="text-xs text-gray-400">
                {selectedSceneIds.length} scenes, {selectedAudioIds.length} tracks selected
            </div>
            {isGenerating ? (
                <div className="flex items-center gap-4 w-1/2">
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="text-xs font-mono text-white">{Math.round(progress)}%</span>
                </div>
            ) : (
                <Button onClick={handleGenerate} disabled={selectedSceneIds.length === 0 && selectedAudioIds.length === 0} className="bg-purple-600 hover:bg-purple-500">
                    <Sparkles size={16} className="mr-2"/> Generate Assets
                </Button>
            )}
        </div>
      </div>
    </div>
  );
};
