
import React, { useState, useRef, useEffect } from 'react';
import { X, FileText, LayoutTemplate } from 'lucide-react';
import { Button } from './Button';
import { MOCK_VOICES } from '../constants';
import { Voice, AudioTrack } from '../types';
import { generateSpeech, transcribeAudio, analyzeMediaStyle } from '../services/geminiService';
import { AudioTimeline } from './AudioTimeline';
import { AudioSidebar } from './AudioSidebar';
import { AudioBeatMaker } from './AudioBeatMaker';
import { bufferToWav } from '../utils/audioHelpers';

export const AudioStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cloning' | 'mixer' | 'pro' | 'sequencer'>('mixer');
  const [showAssets, setShowAssets] = useState(true);
  
  const [voices, setVoices] = useState<Voice[]>(() => {
    const saved = localStorage.getItem('omni_voices');
    return saved ? JSON.parse(saved) : MOCK_VOICES;
  });

  const [tracks, setTracks] = useState<AudioTrack[]>(() => {
    const saved = localStorage.getItem('omni_audio_tracks');
    return saved ? JSON.parse(saved) : [
      { id: 't1', name: 'Intro Music - Lofi Chill', type: 'music', duration: 30, startOffset: 0, volume: 0.8, muted: false, solo: false },
    ];
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const [ttsInput, setTtsInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [styleReference, setStyleReference] = useState<string | undefined>(undefined);
  
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [isExporting, setIsExporting] = useState(false);

  const [mastering, setMastering] = useState({ enabled: false, warmth: 50, clarity: 50, punch: 50 });

  useEffect(() => {
    const tracksToSave = tracks.map(t => ({ ...t, audioUrl: t.audioUrl?.startsWith('data:') ? t.audioUrl : undefined })); 
    localStorage.setItem('omni_audio_tracks', JSON.stringify(tracksToSave));
    window.dispatchEvent(new Event('omniAssetsUpdated'));
  }, [tracks]);

  useEffect(() => {
    localStorage.setItem('omni_voices', JSON.stringify(voices));
  }, [voices]);

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

  const handleTogglePlay = () => {
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    Object.values(audioRefs.current).forEach(audio => {
      const audioEl = audio as HTMLAudioElement;
      if (newIsPlaying) audioEl.play().catch(e => console.log("Play error:", e)); else audioEl.pause();
    });
  };

  const handleGenerateTTS = async () => {
    if (!ttsInput) return;
    setIsGenerating(true);
    const voice = voices.find(v => v.id === selectedVoice);
    const audioDataUri = await generateSpeech(ttsInput, voice || voices[0], styleReference);
    if (audioDataUri) {
      const newTrack: AudioTrack = {
        id: `t${Date.now()}`, name: `TTS: ${ttsInput.substring(0, 15)}...`, type: 'voiceover', duration: 10, startOffset: 0, audioUrl: audioDataUri, volume: 1.0, muted: false, solo: false
      };
      setTracks(prev => [...prev, newTrack]);
      setTtsInput('');
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

  const startRecording = async () => {
    if (!navigator.mediaDevices) { alert("Microphone access not supported."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
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

  const handleFinishClone = (audioUrl: string) => {
      const name = prompt("Recording complete! Enter a name for this voice clone:");
      if (name) {
          const newVoice: Voice = { id: `v-clone-${Date.now()}`, name: `${name} (Cloned)`, gender: 'robot', style: 'narrative', isCloned: true };
          setVoices(prev => [...prev, newVoice]);
          alert(`Voice "${name}" cloned successfully!`);
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
          const response = await fetch(track.audioUrl);
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
          console.error(error);
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
          
          // Mastering Chain
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
          
          setIsExporting(false);
      } catch (error) { 
          console.error(error); 
          alert("Export failed. Check console for details.");
          setIsExporting(false); 
      }
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddTrack = (asset: any) => {
      const newTrack: AudioTrack = { id: `asset-${Date.now()}`, name: asset.name, type: 'sfx', duration: 5, startOffset: 0, audioUrl: asset.url, volume: 1.0 };
      setTracks(prev => [...prev, newTrack]);
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
        activeTab={activeTab} setActiveTab={setActiveTab as any} voices={voices} selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
        ttsInput={ttsInput} setTtsInput={setTtsInput} styleReference={styleReference} setStyleReference={setStyleReference}
        isGenerating={isGenerating} onGenerateTTS={handleGenerateTTS} onSmartMix={handleSmartMix} mastering={mastering} setMastering={setMastering}
        onUploadStyleRef={handleUploadStyleRef} isRecording={isRecording} startRecording={startRecording} stopRecording={stopRecording} recordingTime={recordingTime} formatTime={formatTime}
      />

      {activeTab === 'sequencer' ? (
          <AudioBeatMaker onAddTrack={(t) => { setTracks(p => [...p, t]); setActiveTab('mixer'); }} />
      ) : (
          <AudioTimeline 
            tracks={tracks} isPlaying={isPlaying} onTogglePlay={handleTogglePlay} onExportMix={handleExportMix} isExporting={isExporting}
            onShowAssets={() => setShowAssets(!showAssets)} activeTab={activeTab} setActiveTab={setActiveTab as any} isRecording={isRecording}
            startRecording={startRecording} stopRecording={stopRecording} onTranscribe={handleTranscribe} isTranscribing={isTranscribing}
            onDeleteTrack={handleDeleteTrack} toggleMute={toggleMute} toggleSolo={toggleSolo} handleVolumeChange={(id, v) => setTracks(p => p.map(t => t.id === id ? {...t, volume: v} : t))}
            setTracks={setTracks} audioRefs={audioRefs}
          />
      )}

      {showAssets && activeTab !== 'sequencer' && (
          <div className="w-64 bg-gray-900 border-l border-gray-800 p-4 hidden md:flex flex-col transition-all">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assets</h3><button onClick={() => setShowAssets(false)} className="text-gray-500 hover:text-white"><X size={14}/></button></div>
              <div className="flex-1 overflow-y-auto space-y-2">
                  <div className="text-xs text-gray-600 mb-2">Drag to Timeline</div>
                  {tracks.filter(t => t.audioUrl).map((t, i) => (
                      <div key={i} className="bg-gray-800 p-2 rounded border border-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-500" onClick={() => handleAddTrack(t)}>
                          <div className="text-xs font-medium text-gray-300 truncate">{t.name}</div>
                          <div className="text-[10px] text-gray-500">{formatTime(t.duration)}</div>
                      </div>
                  ))}
                  {tracks.length === 0 && <div className="text-xs text-gray-600 italic">No assets available.</div>}
              </div>
          </div>
      )}
    </div>
  );
};
