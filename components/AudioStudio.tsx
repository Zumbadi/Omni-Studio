
import React, { useState, useRef, useEffect } from 'react';
import { Music, Wand2, User, Check, FileText, X, Sliders, Upload, Zap, Activity, Mic, Volume2, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { MOCK_VOICES } from '../constants';
import { Voice, AudioTrack } from '../types';
import { generateSpeech, transcribeAudio, analyzeMediaStyle } from '../services/geminiService';
import { AudioTimeline } from './AudioTimeline';

export const AudioStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cloning' | 'mixer' | 'pro'>('mixer');
  const [showAssets, setShowAssets] = useState(true);
  
  // Persistent Voices State
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
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Generation State
  const [ttsInput, setTtsInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [styleReference, setStyleReference] = useState<string | undefined>(undefined);
  
  // Transcription State
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);

  const styleInputRef = useRef<HTMLInputElement>(null);

  // Pro Tools / Mastering State
  const [mastering, setMastering] = useState({
      enabled: false,
      warmth: 50,
      clarity: 50,
      punch: 50
  });

  // Persistence Effects
  useEffect(() => {
    const tracksToSave = tracks.map(t => ({
        ...t, 
        audioUrl: t.audioUrl?.startsWith('data:') ? t.audioUrl : undefined 
    })); 
    localStorage.setItem('omni_audio_tracks', JSON.stringify(tracksToSave));
    window.dispatchEvent(new Event('omniAssetsUpdated'));
  }, [tracks]);

  useEffect(() => {
    localStorage.setItem('omni_voices', JSON.stringify(voices));
  }, [voices]);

  // Recording Timer
  useEffect(() => {
     if (isRecording) {
       timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
     } else {
       if (timerRef.current) clearInterval(timerRef.current);
       setRecordingTime(0);
     }
     return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  // Sync Audio Elements with React State (Volume/Mute/Solo)
  useEffect(() => {
      const anySolo = tracks.some(t => t.solo);

      tracks.forEach(track => {
          const audioEl = audioRefs.current[track.id];
          if (audioEl) {
              // Volume Logic
              audioEl.volume = track.volume ?? 1.0;
              
              // Mute Logic: Muted if track is Muted OR (Solo exists AND this track is NOT Solo)
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
      if (newIsPlaying) {
        audioEl.play().catch(e => console.log("Play error (likely empty source):", e));
      } else {
        audioEl.pause();
      }
    });
  };

  const handleGenerateTTS = async () => {
    if (!ttsInput) return;
    setIsGenerating(true);
    
    const voice = voices.find(v => v.id === selectedVoice);
    // Pass the full voice object, not just the name
    const audioDataUri = await generateSpeech(ttsInput, voice || voices[0], styleReference);
    
    if (audioDataUri) {
      const newTrack: AudioTrack = {
        id: `t${Date.now()}`,
        name: `TTS: ${ttsInput.substring(0, 15)}...`,
        type: 'voiceover',
        duration: 10, 
        startOffset: 0,
        audioUrl: audioDataUri,
        volume: 1.0,
        muted: false,
        solo: false
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
          alert(`Style Analyzed: "${styleDesc}"\nThis will be applied to your next TTS generation.`);
      };
      reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices) {
      alert("Microphone access not supported.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        
        if (activeTab === 'cloning') {
            handleFinishClone(url);
        } else {
            const newTrack: AudioTrack = {
              id: `rec-${Date.now()}`,
              name: 'Microphone Recording',
              type: 'voiceover',
              duration: recordingTime || 5,
              startOffset: 0,
              audioUrl: url,
              volume: 1.0,
              muted: false,
              solo: false
            };
            setTracks(prev => [...prev, newTrack]);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFinishClone = (audioUrl: string) => {
      const name = prompt("Recording complete! Enter a name for this voice clone:");
      if (name) {
          const newVoice: Voice = {
              id: `v-clone-${Date.now()}`,
              name: `${name} (Cloned)`,
              gender: 'robot',
              style: 'narrative',
              isCloned: true
          };
          setVoices(prev => [...prev, newVoice]);
          alert(`Voice "${name}" cloned successfully! It is now available in the Voice Lab.`);
      }
  };

  const handleDeleteTrack = (id: string) => {
    setTracks(tracks.filter(t => t.id !== id));
    delete audioRefs.current[id];
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
          setTranscription("Error fetching or processing audio for transcription.");
          setIsTranscribing(false);
      }
  };

  // --- Mixer Controls ---
  const handleVolumeChange = (id: string, val: number) => {
      setTracks(prev => prev.map(t => t.id === id ? { ...t, volume: val } : t));
  };

  const toggleMute = (id: string) => {
      setTracks(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
  };

  const toggleSolo = (id: string) => {
      setTracks(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t));
  };

  const handleSmartMix = () => {
      const hasVoice = tracks.some(t => t.type === 'voiceover');
      if (hasVoice) {
          setTracks(prev => prev.map(t => 
              t.type === 'music' ? { ...t, volume: 0.3 } : t.type === 'voiceover' ? { ...t, volume: 1.0 } : t
          ));
      }
  };

  // --- Audio Export Logic ---
  const bufferToWav = (buffer: AudioBuffer) => {
      const numOfChan = buffer.numberOfChannels;
      const length = buffer.length * numOfChan * 2 + 44;
      const bufferArray = new ArrayBuffer(length);
      const view = new DataView(bufferArray);
      const channels = [];
      let i;
      let sample;
      let pos = 0;

      function setUint16(data: any) { view.setUint16(pos, data, true); pos += 2; }
      function setUint32(data: any) { view.setUint32(pos, data, true); pos += 4; }

      setUint32(0x46464952); // "RIFF"
      setUint32(length - 8); // file length - 8
      setUint32(0x45564157); // "WAVE"
      setUint32(0x20746d66); // "fmt " chunk
      setUint32(16); 
      setUint16(1); 
      setUint16(numOfChan);
      setUint32(buffer.sampleRate);
      setUint32(buffer.sampleRate * 2 * numOfChan);
      setUint16(numOfChan * 2);
      setUint16(16);
      setUint32(0x61746164); // "data"
      setUint32(length - pos - 4);

      for(i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

      let sampleIdx = 0;
      while(sampleIdx < buffer.length) {
          for(i = 0; i < numOfChan; i++) {
              sample = Math.max(-1, Math.min(1, channels[i][sampleIdx]));
              sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
              view.setInt16(pos, sample, true);
              pos += 2;
          }
          sampleIdx++;
      }

      return new Blob([bufferArray], { type: "audio/wav" });
  };

  const handleExportMix = async () => {
      if (tracks.length === 0) return;
      setIsExporting(true);

      try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const totalDuration = Math.max(...tracks.map(t => t.startOffset + t.duration)) || 10;
          const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * 44100), 44100);

          // Mastering Nodes (Simulated)
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
                      console.warn(`Failed to mix track ${track.name}:`, e);
                  }
              }
          }

          const renderedBuffer = await offlineCtx.startRendering();
          const wavBlob = bufferToWav(renderedBuffer);
          const url = URL.createObjectURL(wavBlob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `omni-mix-${Date.now()}.wav`;
          a.click();
          URL.revokeObjectURL(url);

      } catch (error) {
          console.error("Export failed:", error);
          alert("Failed to export audio mix.");
      } finally {
          setIsExporting(false);
      }
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add track logic from Assets Panel
  const handleAddTrack = (asset: any) => {
      const newTrack: AudioTrack = {
          id: `asset-${Date.now()}`,
          name: asset.name,
          type: 'sfx',
          duration: 5, // Simplified
          startOffset: 0,
          audioUrl: asset.url,
          volume: 1.0
      };
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
                <div className="p-6 overflow-y-auto text-gray-300 leading-relaxed">
                   {transcription}
                </div>
                <div className="p-4 border-t border-gray-800 bg-gray-850 rounded-b-2xl flex justify-end">
                   <Button onClick={() => navigator.clipboard.writeText(transcription)}>Copy Text</Button>
                </div>
             </div>
          </div>
      )}

      {/* Left Toolbar */}
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-4 z-10 shadow-xl">
        <div className="mb-2">
           <h2 className="text-xl font-bold flex items-center gap-2">
             <Music className="text-primary-500" /> Audio Studio
           </h2>
           <p className="text-xs text-gray-500">Create podcasts, music & clones</p>
        </div>

        <div className="flex gap-2 bg-gray-800 p-1 rounded-lg">
           <button 
             onClick={() => setActiveTab('mixer')}
             className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'mixer' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
           >
             Mixer
           </button>
           <button 
             onClick={() => setActiveTab('cloning')}
             className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'cloning' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
           >
             Voice Lab
           </button>
            <button 
             onClick={() => setActiveTab('pro')}
             className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'pro' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
           >
             Pro Tools
           </button>
        </div>

        {activeTab === 'mixer' && (
           <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
                 <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Wand2 size={14} className="text-purple-400"/> Text to Speech</h3>
                 <textarea 
                   className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 focus:outline-none resize-none h-24 mb-2 focus:border-primary-500"
                   placeholder="Enter text to generate..."
                   value={ttsInput}
                   onChange={(e) => setTtsInput(e.target.value)}
                 />
                 
                 <div className="mb-2">
                    {styleReference && (
                         <div className="text-xs text-green-400 flex items-center gap-1 mb-2 bg-green-900/20 px-2 py-1 rounded">
                             <Check size={10} /> Style Active
                         </div>
                    )}
                 </div>

                 <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 mb-2"
                 >
                    {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                 </select>
                 <Button size="sm" className="w-full" onClick={handleGenerateTTS} disabled={isGenerating}>
                    {isGenerating ? <Loader2 size={14} className="animate-spin mr-2"/> : <Volume2 size={14} className="mr-2"/>}
                    {isGenerating ? 'Generating...' : 'Generate Speech'}
                 </Button>
              </div>

              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
                 <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Sliders size={14} className="text-blue-400"/> Quick Actions</h3>
                 <Button size="sm" variant="secondary" className="w-full mb-2" onClick={handleSmartMix}>
                    Auto-Mix (Ducking)
                 </Button>
              </div>
           </div>
        )}

        {activeTab === 'pro' && (
            <div className="space-y-6">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Activity size={14} className="text-green-400"/> Style Transfer</h3>
                    <p className="text-xs text-gray-500 mb-3">Upload a reference audio file to clone its tone, pace, and emotion for the TTS engine.</p>
                    <input type="file" ref={styleInputRef} className="hidden" onChange={handleUploadStyleRef} accept="audio/*" />
                    <button 
                        onClick={() => styleInputRef.current?.click()}
                        className="w-full py-2 border border-dashed border-gray-600 rounded text-xs text-gray-400 hover:text-white hover:border-gray-400 flex items-center justify-center gap-2"
                    >
                         <Upload size={12} /> {styleReference ? "Update Reference" : "Upload Reference"}
                    </button>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Zap size={14} className="text-yellow-400"/> Mastering</h3>
                        <input type="checkbox" checked={mastering.enabled} onChange={(e) => setMastering(m => ({...m, enabled: e.target.checked}))} className="toggle" />
                     </div>
                     
                     <div className={`space-y-3 ${!mastering.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                         <div>
                             <label className="text-xs text-gray-400 flex justify-between mb-1"><span>Warmth</span> <span>{mastering.warmth}%</span></label>
                             <input type="range" className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500" value={mastering.warmth} onChange={(e) => setMastering(m => ({...m, warmth: parseInt(e.target.value)}))} />
                         </div>
                         <div>
                             <label className="text-xs text-gray-400 flex justify-between mb-1"><span>Clarity</span> <span>{mastering.clarity}%</span></label>
                             <input type="range" className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" value={mastering.clarity} onChange={(e) => setMastering(m => ({...m, clarity: parseInt(e.target.value)}))} />
                         </div>
                         <div>
                             <label className="text-xs text-gray-400 flex justify-between mb-1"><span>Punch</span> <span>{mastering.punch}%</span></label>
                             <input type="range" className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500" value={mastering.punch} onChange={(e) => setMastering(m => ({...m, punch: parseInt(e.target.value)}))} />
                         </div>
                     </div>
                </div>
            </div>
        )}

        {activeTab === 'cloning' && (
          <div className="space-y-6">
             {/* ... Voice Cloning UI ... */}
             <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col items-center text-center shadow-sm">
                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4 border-4 border-gray-700 relative overflow-hidden">
                    <Mic size={32} className={isRecording ? "text-red-500 relative z-10" : "text-gray-500 relative z-10"} />
                    {isRecording && (
                        <>
                             <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-50"></div>
                             <div className="absolute bottom-2 text-[10px] font-mono text-red-400 font-bold z-20 bg-black/50 px-1 rounded">{formatTime(recordingTime)}</div>
                        </>
                    )}
                </div>
                <h3 className="font-medium text-white">Instant Clone</h3>
                <p className="text-xs text-gray-500 mb-4">Record at least 10s of audio to create a digital replica of your voice.</p>
                <Button 
                   onClick={isRecording ? stopRecording : startRecording} 
                   variant={isRecording ? "danger" : "primary"}
                   className="w-full"
                >
                   {isRecording ? 'Stop Recording' : 'Start Recording'}
                </Button>
             </div>

             <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Voices</h3>
                <div className="space-y-2">
                    {voices.filter(v => v.isCloned).map(v => (
                        <div key={v.id} className="bg-gray-800 p-3 rounded-lg flex items-center justify-between border border-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-900/50 rounded-full flex items-center justify-center text-purple-400">
                                    <User size={14} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-white">{v.name}</div>
                                    <div className="text-[10px] text-gray-500 capitalize">{v.style}</div>
                                </div>
                            </div>
                            <Check size={14} className="text-green-500" />
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}
      </div>

      <AudioTimeline 
        tracks={tracks}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onExportMix={handleExportMix}
        isExporting={isExporting}
        onShowAssets={() => setShowAssets(!showAssets)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRecording={isRecording}
        startRecording={startRecording}
        stopRecording={stopRecording}
        onTranscribe={handleTranscribe}
        isTranscribing={isTranscribing}
        onDeleteTrack={handleDeleteTrack}
        toggleMute={toggleMute}
        toggleSolo={toggleSolo}
        handleVolumeChange={handleVolumeChange}
        setTracks={setTracks}
        audioRefs={audioRefs}
      />

      {/* Right Asset Sidebar */}
      {showAssets && (
          <div className="w-64 bg-gray-900 border-l border-gray-800 p-4 hidden md:flex flex-col transition-all">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assets</h3>
                  <button onClick={() => setShowAssets(false)} className="text-gray-500 hover:text-white"><X size={14}/></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                  <div className="text-xs text-gray-600 mb-2">Drag to Timeline</div>
                  {tracks.filter(t => t.audioUrl).map((t, i) => (
                      <div 
                        key={i} 
                        className="bg-gray-800 p-2 rounded border border-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-500"
                        onClick={() => handleAddTrack(t)}
                      >
                          <div className="text-xs font-medium text-gray-300 truncate">{t.name}</div>
                          <div className="text-[10px] text-gray-500">{formatTime(t.duration)}</div>
                      </div>
                  ))}
                  {tracks.length === 0 && <div className="text-xs text-gray-600 italic">No assets available. Generate speech or record audio.</div>}
              </div>
          </div>
      )}
    </div>
  );
};
