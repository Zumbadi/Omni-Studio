
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Play, Pause, Music, Settings, Plus, Volume2, Download, Wand2, Radio, Disc, User, MoreVertical, Trash2, Loader2, Check, FileText, X, MoveHorizontal } from 'lucide-react';
import { Button } from './Button';
import { MOCK_VOICES } from '../constants';
import { Voice, AudioTrack } from '../types';
import { generateSpeech, transcribeAudio } from '../services/geminiService';

export const AudioStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'cloning' | 'mixer'>('mixer');
  
  // Persistent Voices State
  const [voices, setVoices] = useState<Voice[]>(() => {
    const saved = localStorage.getItem('omni_voices');
    return saved ? JSON.parse(saved) : MOCK_VOICES;
  });

  const [tracks, setTracks] = useState<AudioTrack[]>(() => {
    const saved = localStorage.getItem('omni_audio_tracks');
    return saved ? JSON.parse(saved) : [
      { id: 't1', name: 'Intro Music - Lofi Chill', type: 'music', duration: 30, startOffset: 0 },
    ];
  });
  
  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Generation State
  const [ttsInput, setTtsInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  
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

  // Dragging State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    trackId: string | null;
    startX: number;
    originalOffset: number;
  }>({ isDragging: false, trackId: null, startX: 0, originalOffset: 0 });

  const timelineRef = useRef<HTMLDivElement>(null);

  // Persistence Effects
  useEffect(() => {
    // Save tracks that have a data: URL (TTS/Gen) but strip blob: URLs (Recordings)
    // This ensures TTS tracks persist across reloads
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

  useEffect(() => {
     if (isRecording) {
       timerRef.current = window.setInterval(() => setRecordingTime(t => t + 1), 1000);
     } else {
       if (timerRef.current) clearInterval(timerRef.current);
       setRecordingTime(0);
     }
     return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  // Dragging Listeners (Global for smoothness)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging || !dragState.trackId || !timelineRef.current) return;

      const timelineWidth = timelineRef.current.clientWidth;
      // Total timeline represents roughly 300 seconds (5 minutes) in this visualization (width: 100% = 300s approx logic via startOffset*2%)
      // Actually, logic below: left = startOffset * 2%. So 100% = 50 seconds.
      // Let's stick to the visual scaling: 1% width = 0.5 seconds.
      
      const deltaPixels = e.clientX - dragState.startX;
      const deltaPercent = (deltaPixels / timelineWidth) * 100;
      const deltaSeconds = deltaPercent * 0.5; // 1% = 0.5s

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
  }, [dragState]);

  const handleTrackMouseDown = (e: React.MouseEvent, track: AudioTrack) => {
    setDragState({
      isDragging: true,
      trackId: track.id,
      startX: e.clientX,
      originalOffset: track.startOffset
    });
  };

  const handleTogglePlay = () => {
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    
    Object.values(audioRefs.current).forEach(audio => {
      const audioEl = audio as HTMLAudioElement;
      if (newIsPlaying) {
        audioEl.play();
      } else {
        audioEl.pause();
      }
    });
  };

  const handleGenerateTTS = async () => {
    if (!ttsInput) return;
    setIsGenerating(true);
    
    const voice = voices.find(v => v.id === selectedVoice);
    const audioDataUri = await generateSpeech(ttsInput, voice?.name || 'Kore');
    
    if (audioDataUri) {
      const newTrack: AudioTrack = {
        id: `t${Date.now()}`,
        name: `TTS: ${ttsInput.substring(0, 15)}...`,
        type: 'voiceover',
        duration: 10, // Simplified duration calculation (would need metadata in real app)
        startOffset: 0,
        audioUrl: audioDataUri
      };
      setTracks(prev => [...prev, newTrack]);
      setTtsInput('');
    }
    setIsGenerating(false);
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
              audioUrl: url
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
              gender: 'robot', // Fallback for UI
              style: 'narrative',
              isCloned: true
          };
          setVoices(prev => [...prev, newVoice]);
          // In a real app, you would upload the audio blob to the voice cloning provider here
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

  // --- Audio Export Logic ---
  const bufferToWav = (buffer: AudioBuffer) => {
      const numOfChan = buffer.numberOfChannels;
      const length = buffer.length * numOfChan * 2 + 44;
      const bufferArray = new ArrayBuffer(length);
      const view = new DataView(bufferArray);
      const channels = [];
      let i;
      let sample;
      let offset = 0;
      let pos = 0;

      function setUint16(data: any) {
          view.setUint16(pos, data, true);
          pos += 2;
      }

      function setUint32(data: any) {
          view.setUint32(pos, data, true);
          pos += 4;
      }

      // write WAVE header
      setUint32(0x46464952); // "RIFF"
      setUint32(length - 8); // file length - 8
      setUint32(0x45564157); // "WAVE"

      setUint32(0x20746d66); // "fmt " chunk
      setUint32(16); // length = 16
      setUint16(1); // PCM (uncompressed)
      setUint16(numOfChan);
      setUint32(buffer.sampleRate);
      setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
      setUint16(numOfChan * 2); // block-align
      setUint16(16); // 16-bit

      setUint32(0x61746164); // "data" - chunk
      setUint32(length - pos - 4); // chunk length

      // write interleaved data
      for(i = 0; i < buffer.numberOfChannels; i++)
          channels.push(buffer.getChannelData(i));

      // Write data
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

          for (const track of tracks) {
              if (track.audioUrl) {
                  try {
                      const response = await fetch(track.audioUrl);
                      const arrayBuffer = await response.arrayBuffer();
                      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                      
                      const source = offlineCtx.createBufferSource();
                      source.buffer = audioBuffer;
                      source.connect(offlineCtx.destination);
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
                 <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Disc size={14} className="text-pink-400"/> Music Gen</h3>
                 <input 
                   type="text"
                   className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 mb-2"
                   placeholder="e.g., Cyberpunk synthwave"
                 />
                 <Button size="sm" variant="secondary" className="w-full">Generate Track</Button>
              </div>
           </div>
        )}

        {activeTab === 'cloning' && (
          <div className="space-y-6">
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
                {voices.filter(v => v.isCloned).length === 0 && <p className="text-xs text-gray-600 italic text-center py-4">No clones created yet.</p>}
             </div>
          </div>
        )}
      </div>

      {/* Main Timeline Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
         {/* Top Control Bar */}
         <div className="h-14 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-6 shadow-md z-10">
            <div className="flex items-center gap-4">
               <button 
                 onClick={handleTogglePlay}
                 className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-500 flex items-center justify-center text-white shadow-lg transition-all active:scale-95"
               >
                 {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
               </button>
               <div className="text-2xl font-mono text-gray-400 tracking-widest">
                  00:00:00 <span className="text-sm text-gray-600 tracking-normal">/ 00:05:30</span>
               </div>
            </div>
            <div className="flex gap-2">
               <Button variant="secondary" size="sm"><Settings size={14} className="mr-2"/> Settings</Button>
               <Button 
                  size="sm" 
                  onClick={handleExportMix}
                  disabled={isExporting || tracks.length === 0}
               >
                  {isExporting ? <Loader2 size={14} className="animate-spin mr-2"/> : <Download size={14} className="mr-2"/>}
                  Export Mix
               </Button>
            </div>
         </div>

         {/* Visualizer */}
         <div className="h-48 bg-gray-900 border-b border-gray-800 p-6 flex items-center justify-center relative overflow-hidden">
            {/* Simulated Frequency Bars */}
            <div className="flex gap-1 h-24 items-end">
               {[...Array(50)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1.5 bg-gradient-to-t from-primary-600 to-purple-500 rounded-t-sm transition-all duration-100 ease-in-out`}
                    style={{ height: isPlaying ? `${Math.random() * 100}%` : '5%' }}
                  ></div>
               ))}
            </div>
            <div className="absolute bottom-2 right-4 text-[10px] text-gray-500 font-mono">MASTER OUT L/R</div>
         </div>

         {/* Track List */}
         <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black select-none">
            {tracks.map((track, idx) => (
              <div key={track.id} className="flex items-center gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300">
                 {/* Track Control Header */}
                 <div className="w-56 bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center justify-between flex-shrink-0 shadow-md relative">
                    <div>
                       <div className="text-sm font-medium text-gray-200 truncate w-36">{track.name}</div>
                       <div className="text-[10px] text-gray-500 flex items-center gap-1 uppercase tracking-wider mt-1">
                          {track.type === 'music' ? <Music size={10}/> : <Volume2 size={10}/>}
                          {track.type}
                       </div>
                    </div>
                    <div className="flex gap-1">
                        {track.audioUrl && (
                            <button 
                                onClick={() => handleTranscribe(track)}
                                className="text-gray-600 hover:text-primary-400 p-1"
                                title="Transcribe Audio"
                                disabled={isTranscribing}
                            >
                                {isTranscribing ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>}
                            </button>
                        )}
                       <button onClick={() => handleDeleteTrack(track.id)} className="text-gray-600 hover:text-red-400 p-1"><Trash2 size={14}/></button>
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
                   className="flex-1 h-14 bg-gray-900 rounded-lg relative overflow-hidden border border-gray-800 shadow-inner cursor-crosshair"
                   ref={timelineRef}
                 >
                    {/* Track Block (Draggable) */}
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
                       
                       {/* Waveform graphic inside track */}
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
    </div>
  );
};
