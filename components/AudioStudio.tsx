
import React, { useState, useRef, useEffect } from 'react';
import { X, FileText, LayoutTemplate, Play, Pause, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { MOCK_VOICES } from '../constants';
import { Voice, AudioTrack } from '../types';
import { generateSpeech, transcribeAudio, analyzeMediaStyle, generateSong } from '../services/geminiService';
import { AudioTimeline } from './AudioTimeline';
import { AudioSidebar } from './AudioSidebar';
import type { AudioTab } from './AudioSidebar';
import { AudioBeatMaker } from './AudioBeatMaker';
import { bufferToWav } from '../utils/audioHelpers';
import { useDebounce } from '../hooks/useDebounce';

// Helper to ensure audio is saved persistently (Data URI) vs temporary (Blob URL)
const blobToDataUri = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const AudioStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AudioTab>('mixer');
  const [showAssets, setShowAssets] = useState(true);
  
  const [voices, setVoices] = useState<Voice[]>(() => {
    const saved = localStorage.getItem('omni_voices');
    return saved ? JSON.parse(saved) : MOCK_VOICES;
  });

  // Library of reusable assets (separate from active timeline tracks)
  const [audioAssets, setAudioAssets] = useState<any[]>(() => {
      const saved = localStorage.getItem('omni_audio_assets');
      return saved ? JSON.parse(saved) : [];
  });

  const [tracks, setTracks] = useState<AudioTrack[]>(() => {
    const saved = localStorage.getItem('omni_audio_tracks');
    // Filter out potential old dead blob URLs on load
    const parsed = saved ? JSON.parse(saved) : [
      { id: 't1', name: 'Intro Music - Lofi Chill', type: 'music', duration: 30, startOffset: 0, volume: 0.8, muted: false, solo: false },
    ];
    return parsed.map((t: AudioTrack) => ({
        ...t,
        audioUrl: t.audioUrl && t.audioUrl.startsWith('blob:') ? undefined : t.audioUrl
    }));
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  // Previewing asset state
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const [ttsInput, setTtsInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [styleReference, setStyleReference] = useState<string | undefined>(undefined);
  const [youtubeLink, setYoutubeLink] = useState(''); 
  
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  const [mastering, setMastering] = useState({ enabled: false, warmth: 50, clarity: 50, punch: 50 });

  const debouncedTracks = useDebounce(tracks, 2000);

  useEffect(() => {
    // Only save Data URIs to avoid Blob URL revocation issues
    const tracksToSave = debouncedTracks.map(t => ({ 
        ...t, 
        audioUrl: t.audioUrl && t.audioUrl.startsWith('data:') ? t.audioUrl : undefined 
    })); 
    localStorage.setItem('omni_audio_tracks', JSON.stringify(tracksToSave));
    window.dispatchEvent(new Event('omniAssetsUpdated'));
  }, [debouncedTracks]);

  useEffect(() => {
    localStorage.setItem('omni_voices', JSON.stringify(voices));
  }, [voices]);

  useEffect(() => {
      // Filter out non-persistent URLs before saving assets
      const assetsToSave = audioAssets.filter(a => a.audioUrl && a.audioUrl.startsWith('data:'));
      localStorage.setItem('omni_audio_assets', JSON.stringify(assetsToSave));
  }, [audioAssets]);

  useEffect(() => {
     if (isRecording) {
       timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
     } else {
       if (timerRef.current) clearInterval(timerRef.current);
       setRecordingTime(0);
     }
     return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  useEffect(() => {
      const anySolo = tracks.some(t => t.solo);
      tracks.forEach(track => {
          const audioEl = audioRefs.current[track.id];
          if (audioEl) {
              audioEl.volume = track.volume ?? 1.0;
              const shouldMute = track.muted || (anySolo && !track.solo);
              audioEl.muted = shouldMute;
          }
      });
  }, [tracks]);

  // Sync Audio Elements with State
  useEffect(() => {
      Object.values(audioRefs.current).forEach(audio => {
          const audioEl = audio as HTMLAudioElement;
          if (isPlaying) {
              audioEl.play().catch(e => console.log("Play error (expected if empty):", e));
          } else {
              audioEl.pause();
          }
      });
  }, [isPlaying]);

  const handleTogglePlay = () => setIsPlaying(p => !p);

  // Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Only active if NOT in sequencer mode (which has its own shortcut)
        if (activeTab !== 'sequencer' && e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            e.preventDefault();
            setIsPlaying(p => !p);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const handleGenerateTTS = async () => {
    if (!ttsInput) return;
    setIsGenerating(true);
    try {
        const voice = voices.find(v => v.id === selectedVoice);
        const audioDataUri = await generateSpeech(ttsInput, voice || voices[0], styleReference);
        if (audioDataUri) {
          const name = `TTS: ${ttsInput.substring(0, 15)}...`;
          
          const newAsset = {
              id: `asset-${Date.now()}`,
              name,
              type: 'voiceover',
              duration: 10,
              audioUrl: audioDataUri
          };
          setAudioAssets(prev => [newAsset, ...prev]);

          const newTrack: AudioTrack = {
            id: `t${Date.now()}`, name, type: 'voiceover', duration: 10, startOffset: 0, audioUrl: audioDataUri, volume: 1.0, muted: false, solo: false
          };
          setTracks(prev => [...prev, newTrack]);
          setTtsInput('');
        }
    } catch (e) {
        console.error("TTS Error:", e);
        alert("Failed to generate speech. Please check your connection.");
    }
    setIsGenerating(false);
  };

  const handleGenerateSong = async () => {
      if (!ttsInput) return; // Uses ttsInput for lyrics
      setIsGenerating(true);
      try {
          const audioDataUri = await generateSong(ttsInput, styleReference, selectedVoice, youtubeLink);
          if (audioDataUri) {
              const name = `AI Song: ${ttsInput.substring(0, 10)}...`;
              
              const newAsset = {
                  id: `asset-${Date.now()}`,
                  name,
                  type: 'music',
                  duration: 30,
                  audioUrl: audioDataUri
              };
              setAudioAssets(prev => [newAsset, ...prev]);

              const newTrack: AudioTrack = {
                  id: `song-${Date.now()}`,
                  name,
                  type: 'music',
                  duration: 30,
                  startOffset: 0,
                  audioUrl: audioDataUri,
                  volume: 1.0,
                  muted: false,
                  solo: false
              };
              setTracks(prev => [...prev, newTrack]);
              setActiveTab('mixer');
          }
      } catch (e) {
          console.error("Song Gen Error:", e);
          alert("Failed to generate song. Please check your connection.");
      }
      setIsGenerating(false);
  };
  
  const handleUploadStyleRef = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          const styleDesc = await analyzeMediaStyle(base64, 'audio');
          setStyleReference(styleDesc);
          alert(`Style Analyzed: "${styleDesc}"`);
      };
      reader.readAsDataURL(file);
  };

  const handleCloneFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          // Convert to persistent Data URI immediately
          const base64Url = await blobToDataUri(file);
          handleFinishClone(base64Url, file.name.split('.')[0]);
      } catch (e) {
          console.error("File Read Error:", e);
          alert("Failed to process file.");
      }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices) { alert("Microphone access not supported."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Convert to Data URI for persistence
        const url = await blobToDataUri(blob);
        
        if (activeTab === 'cloning') handleFinishClone(url);
        else {
            const newTrack: AudioTrack = { id: `rec-${Date.now()}`, name: 'Microphone Recording', type: 'voiceover', duration: recordingTime || 5, startOffset: 0, audioUrl: url, volume: 1.0, muted: false, solo: false };
            setTracks(prev => [...prev, newTrack]);
        }
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { console.error("Error accessing microphone:", err); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const handleFinishClone = (audioUrl: string, defaultName?: string) => {
      const name = prompt("Enter a name for this voice clone:", defaultName || "New Voice");
      if (name) {
          // 1. Add to Voices
          const newVoice: Voice = { id: `v-clone-${Date.now()}`, name: `${name} (Cloned)`, gender: 'robot', style: 'narrative', isCloned: true };
          setVoices(prev => [...prev, newVoice]);
          
          // 2. Add to Assets Library
          const newAsset = {
              id: `asset-clone-${Date.now()}`,
              name: `Sample: ${name}`,
              type: 'voiceover',
              duration: recordingTime || 5,
              audioUrl: audioUrl
          };
          setAudioAssets(prev => [newAsset, ...prev]);

          alert(`Voice "${name}" cloned and added to Assets!`);
      }
  };

  const handleDeleteTrack = (id: string) => {
    setTracks(tracks.filter(t => t.id !== id));
    delete audioRefs.current[id];
  };

  const toggleMute = (id: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
  };

  const toggleSolo = (id: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t));
  };

  const handleTranscribe = async (track: AudioTrack) => {
      if (!track.audioUrl) return;
      setIsTranscribing(true);
      try {
          // Try to fetch to verify it's valid first
          const response = await fetch(track.audioUrl);
          if (!response.ok) throw new Error("Failed to load audio");
          
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              const result = await transcribeAudio(base64);
              setTranscription(result);
              setIsTranscribing(false);
          };
          reader.readAsDataURL(blob);
      } catch (error) {
          console.error("Transcription Failed:", error);
          alert("Could not load audio for transcription. The source file may be missing or corrupted.");
          setIsTranscribing(false);
      }
  };

  const handleSmartMix = () => {
      const hasVoice = tracks.some(t => t.type === 'voiceover');
      if (hasVoice) setTracks(prev => prev.map(t => t.type === 'music' ? { ...t, volume: 0.3 } : t.type === 'voiceover' ? { ...t, volume: 1.0 } : t));
  };

  const handleExportMix = async () => {
      if (tracks.length === 0) return;
      setIsExporting(true);
      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const totalDuration = Math.max(...tracks.map(t => t.startOffset + t.duration)) || 10;
          const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * 44100), 44100);
          
          let outputNode: AudioNode = offlineCtx.destination;
          
          if (mastering.enabled) {
             const compressor = offlineCtx.createDynamicsCompressor();
             compressor.threshold.value = -20 - (mastering.punch / 10);
             compressor.ratio.value = 4 + (mastering.clarity / 20);
             compressor.connect(offlineCtx.destination);
             outputNode = compressor;
          }

          for (const track of tracks) {
              if (track.audioUrl && !track.muted) { 
                  try {
                      // Robust fetch with checks
                      if (track.audioUrl.startsWith('blob:')) {
                          console.warn(`Skipping dead blob URL for ${track.name}`);
                          continue;
                      }
                      const response = await fetch(track.audioUrl);
                      if (!response.ok) throw new Error(`Fetch failed for ${track.id}`);
                      
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
                      console.warn(`Skipping invalid track ${track.name}`, e);
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
          
          setIsExporting(false);
      } catch (error) { 
          console.error(error); 
          alert("Export failed. Please ensure all audio sources are valid.");
          setIsExporting(false); 
      }
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddTrack = (asset: any) => {
      const newTrack: AudioTrack = { 
          id: `t-${Date.now()}`, 
          name: asset.name, 
          type: asset.type || 'sfx', 
          duration: asset.duration || 5, 
          startOffset: 0, 
          audioUrl: asset.audioUrl, 
          volume: 1.0, 
          muted: false, 
          solo: false 
      };
      setTracks(prev => [...prev, newTrack]);
  };

  const handlePlayAsset = (e: React.MouseEvent, assetId: string, url: string) => {
      e.stopPropagation();
      
      if (previewAssetId === assetId) {
          previewAudioRef.current?.pause();
          setPreviewAssetId(null);
          return;
      }

      if (previewAudioRef.current) {
          previewAudioRef.current.pause();
      }

      try {
          const audio = new Audio(url);
          audio.onended = () => setPreviewAssetId(null);
          audio.onerror = () => {
              alert("Could not play asset. File may be corrupted or missing.");
              setPreviewAssetId(null);
          };
          audio.play();
          previewAudioRef.current = audio;
          setPreviewAssetId(assetId);
      } catch(e) {
          console.error("Playback error:", e);
      }
  };

  const handleDeleteAsset = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setAudioAssets(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
      {transcription && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
             <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[80%]">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850 rounded-t-2xl">
                   <h3 className="font-bold flex items-center gap-2"><FileText size={18} className="text-primary-500"/> Audio Transcription</h3>
                   <button onClick={() => setTranscription(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto text-gray-300 leading-relaxed">{transcription}</div>
                <div className="p-4 border-t border-gray-800 bg-gray-850 rounded-b-2xl flex justify-end"><Button onClick={() => navigator.clipboard.writeText(transcription)}>Copy Text</Button></div>
             </div>
          </div>
      )}

      <AudioSidebar 
        activeTab={activeTab} setActiveTab={setActiveTab} voices={voices} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
        ttsInput={ttsInput} setTtsInput={setTtsInput} styleReference={styleReference} setStyleReference={setStyleReference}
        isGenerating={isGenerating} onGenerateTTS={handleGenerateTTS} onSmartMix={handleSmartMix} mastering={mastering} setMastering={setMastering}
        onUploadStyleRef={handleUploadStyleRef} isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording} recordingTime={recordingTime} formatTime={formatTime}
        onCloneFromFile={handleCloneFromFile}
        onGenerateSong={handleGenerateSong}
        youtubeLink={youtubeLink}
        setYoutubeLink={setYoutubeLink}
      />

      {activeTab === 'sequencer' ? (
          <AudioBeatMaker onAddTrack={(t) => { setTracks(p => [...p, t]); setActiveTab('mixer'); }} />
      ) : (
          <AudioTimeline 
            tracks={tracks} isPlaying={isPlaying} onTogglePlay={handleTogglePlay} onExportMix={handleExportMix} isExporting={isExporting}
            onShowAssets={() => setShowAssets(!showAssets)} activeTab={activeTab} setActiveTab={setActiveTab} isRecording={isRecording}
            startRecording={startRecording} stopRecording={stopRecording} onTranscribe={handleTranscribe} isTranscribing={isTranscribing}
            onDeleteTrack={handleDeleteTrack} toggleMute={toggleMute} toggleSolo={toggleSolo} handleVolumeChange={(id, v) => setTracks(p => p.map(t => t.id === id ? {...t, volume: v} : t))}
            setTracks={setTracks} audioRefs={audioRefs}
          />
      )}

      {showAssets && activeTab !== 'sequencer' && (
          <div className="w-64 bg-gray-900 border-l border-gray-800 p-4 hidden md:flex flex-col transition-all">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Asset Library</h3><button onClick={() => setShowAssets(false)} className="text-gray-500 hover:text-white"><X size={14}/></button></div>
              <div className="flex-1 overflow-y-auto space-y-2">
                  <div className="text-xs text-gray-600 mb-2">Click to Add • Play to Preview</div>
                  {audioAssets.map((asset, i) => (
                      <div key={asset.id} className="bg-gray-800 p-2 rounded border border-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-500 flex items-center justify-between group" onClick={() => handleAddTrack(asset)}>
                          <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-gray-300 truncate">{asset.name}</div>
                              <div className="text-[10px] text-gray-500">{formatTime(asset.duration)}</div>
                          </div>
                          <div className="flex items-center gap-1">
                              <button 
                                  onClick={(e) => handlePlayAsset(e, asset.id, asset.audioUrl)}
                                  className={`p-1.5 rounded-full hover:bg-gray-700 transition-colors ${previewAssetId === asset.id ? 'text-green-400' : 'text-gray-400'}`}
                              >
                                  {previewAssetId === asset.id ? <Pause size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
                              </button>
                              <button
                                  onClick={(e) => handleDeleteAsset(e, asset.id)}
                                  className="p-1.5 rounded-full hover:bg-red-900/30 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                  <Trash2 size={12} />
                              </button>
                          </div>
                      </div>
                  ))}
                  {audioAssets.length === 0 && <div className="text-xs text-gray-600 italic text-center py-4">Library empty.<br/>Create or record audio to save assets.</div>}
              </div>
          </div>
      )}
    </div>
  );
};
