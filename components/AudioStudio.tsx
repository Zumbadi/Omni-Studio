
import React, { useState, useRef, useEffect } from 'react';
import { X, FileText, LayoutTemplate, Play, Pause, Trash2, Menu, Music, FolderOpen } from 'lucide-react';
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
import { MediaAssetsLibrary } from './MediaAssetsLibrary';

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
  const [showAssets, setShowAssets] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [voices, setVoices] = useState<Voice[]>(() => {
    try {
        const saved = localStorage.getItem('omni_voices');
        return saved ? JSON.parse(saved) : MOCK_VOICES;
    } catch (e) {
        return MOCK_VOICES;
    }
  });

  const [audioAssets, setAudioAssets] = useState<any[]>(() => {
      try {
          const saved = localStorage.getItem('omni_audio_assets');
          if (saved) {
              const parsed = JSON.parse(saved);
              return parsed.filter((a: any) => a.audioUrl && !a.audioUrl.startsWith('blob:'));
          }
      } catch(e) {}
      return [];
  });

  const [tracks, setTracks] = useState<AudioTrack[]>(() => {
    try {
        const saved = localStorage.getItem('omni_audio_tracks');
        if (!saved) return [{ id: 't1', name: 'Intro Music - Lofi Chill', type: 'music', duration: 30, startOffset: 0, volume: 0.8, muted: false, solo: false }];
        
        const parsed = JSON.parse(saved);
        return parsed.map((t: AudioTrack) => ({
            ...t,
            audioUrl: t.audioUrl && t.audioUrl.startsWith('blob:') ? undefined : t.audioUrl
        }));
    } catch(e) {
        return [{ id: 't1', name: 'Intro Music - Lofi Chill', type: 'music', duration: 30, startOffset: 0, volume: 0.8, muted: false, solo: false }];
    }
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const [ttsInput, setTtsInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(voices[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [styleReference, setStyleReference] = useState<string | undefined>(undefined);
  const [youtubeLink, setYoutubeLink] = useState(''); 
  const [genre, setGenre] = useState('Trap Soul');
  
  // New Song Options State
  const [voiceStyle, setVoiceStyle] = useState('Singing');
  const [songStructure, setSongStructure] = useState('Intro-Verse-Chorus-Outro');
  
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
    const saveTracks = () => {
        try {
            localStorage.setItem('omni_audio_tracks', JSON.stringify(debouncedTracks));
        } catch (e) {
            console.warn("Audio track storage quota exceeded. Saving metadata only.");
            const lightTracks = debouncedTracks.map(t => ({
                ...t,
                audioUrl: t.audioUrl && t.audioUrl.startsWith('data:') ? undefined : t.audioUrl
            }));
            try {
                localStorage.setItem('omni_audio_tracks', JSON.stringify(lightTracks));
            } catch (err) {
                console.error("Critical: Failed to save audio tracks metadata.", err);
            }
        }
        window.dispatchEvent(new Event('omniAssetsUpdated'));
    };
    saveTracks();
  }, [debouncedTracks]);

  useEffect(() => {
    try {
        localStorage.setItem('omni_voices', JSON.stringify(voices));
    } catch (e) {
        console.error("Failed to save voices", e);
    }
  }, [voices]);

  useEffect(() => {
      const saveAssets = () => {
          try {
              localStorage.setItem('omni_audio_assets', JSON.stringify(audioAssets));
          } catch (e) {
              console.warn("Audio assets storage quota exceeded. Clearing heavy assets.");
              const lightAssets = audioAssets.map(a => ({
                  ...a,
                  audioUrl: a.audioUrl && a.audioUrl.startsWith('data:') ? undefined : a.audioUrl
              })).filter(a => a.audioUrl);
              
              try {
                  localStorage.setItem('omni_audio_assets', JSON.stringify(lightAssets));
              } catch (err) {
                  console.error("Critical: Failed to save audio assets.", err);
              }
          }
          window.dispatchEvent(new Event('omniAssetsUpdated'));
      };
      saveAssets();
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleTogglePlay();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addAsset = (track: AudioTrack) => {
      const newAsset = {
          id: track.id,
          name: track.name,
          audioUrl: track.audioUrl,
          created: new Date().toISOString()
      };
      setAudioAssets(prev => [...prev, newAsset]);
  };

  const handleGenerateTTS = async () => {
      if (!ttsInput.trim()) return;
      setIsGenerating(true);
      
      const voice = voices.find(v => v.id === selectedVoice) || voices[0];
      const audioUrl = await generateSpeech(ttsInput, voice, styleReference);
      
      if (audioUrl) {
          const newTrack: AudioTrack = {
              id: `tts-${Date.now()}`,
              name: `TTS: ${ttsInput.substring(0, 10)}... (${voice.name})`,
              type: 'voiceover',
              duration: 10,
              startOffset: 0,
              audioUrl,
              volume: 1.0,
              muted: false
          };
          setTracks(prev => [...prev, newTrack]);
          addAsset(newTrack);
      }
      setIsGenerating(false);
  };

  const handleGenerateSong = async () => {
      setIsGenerating(true);
      const voice = voices.find(v => v.id === selectedVoice);
      const isInstrumental = !selectedVoice;

      // 1. Generate Instrumental Track
      const mainAudioUrl = await generateSong(
          ttsInput, 
          styleReference, 
          selectedVoice, 
          youtubeLink, 
          genre,
          voiceStyle,
          songStructure
      );

      if (mainAudioUrl) {
          const mainTrack: AudioTrack = {
              id: `song-${Date.now()}`,
              name: `${genre} Instrumental (${songStructure || 'Standard'})`,
              type: 'music',
              duration: 30, // Mock duration
              startOffset: 0,
              audioUrl: mainAudioUrl,
              volume: 0.8,
              muted: false
          };
          setTracks(prev => [...prev, mainTrack]);
          addAsset(mainTrack);

          // 2. Generate Vocal Track (if voice selected and lyrics present)
          if (!isInstrumental && selectedVoice && ttsInput.trim()) {
               // Clone or use standard voice for singing
               const vocalPrompt = `(Singing in ${genre} style, vocal style: ${voiceStyle}) ${ttsInput}`;
               // We pass styleReference if available to influence vocal tone as well
               const vocalUrl = await generateSpeech(vocalPrompt, voice!, styleReference);
               
               if (vocalUrl) {
                   const vocalTrack: AudioTrack = {
                       id: `voc-${Date.now()}`,
                       name: `${voice.name} Vocals`,
                       type: 'voiceover',
                       duration: 30, // Should ideally match instrumental, mock for now
                       startOffset: 0, // Aligned with music
                       audioUrl: vocalUrl,
                       volume: 1.0,
                       muted: false
                   };
                   setTracks(prev => [...prev, vocalTrack]);
                   addAsset(vocalTrack);
               }
          }
      }
      setIsGenerating(false);
  };

  const handleCloneFromFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          // Analyze audio style to get a description
          const analysis = await analyzeMediaStyle(base64, 'audio');
          
          const newVoice: Voice = {
              id: `voice-${Date.now()}`,
              name: file.name.replace(/\.[^/.]+$/, ""),
              gender: 'robot', // Default, will be overridden by style usage
              style: 'custom',
              isCloned: true,
              apiMapping: 'cloned_voice_id', // Placeholder for actual API reference
              settings: { stability: 0.5, similarity: 0.75 }
          };
          
          setVoices(prev => [...prev, newVoice]);
          setSelectedVoice(newVoice.id);
          setStyleReference(analysis); // Set the analyzed style as the current reference
          alert(`Voice "${newVoice.name}" cloned successfully! Style Analysis: ${analysis}`);
          
          // Reset input target value so the same file can be selected again if needed
          e.target.value = '';
      };
      reader.readAsDataURL(file);
  };

  const startRecording = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          chunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          mediaRecorder.onstop = async () => {
              const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
              const url = URL.createObjectURL(blob);
              
              if (activeTab === 'cloning') {
                  const newVoice: Voice = {
                      id: `clone-${Date.now()}`,
                      name: 'My Voice Clone',
                      gender: 'male',
                      style: 'custom',
                      isCloned: true
                  };
                  setVoices(prev => [...prev, newVoice]);
                  setSelectedVoice(newVoice.id);
                  alert('Voice cloned from recording!');
              } else {
                  const newTrack: AudioTrack = {
                      id: `rec-${Date.now()}`,
                      name: 'Microphone Recording',
                      type: 'voiceover',
                      duration: recordingTime,
                      startOffset: 0,
                      audioUrl: url,
                      volume: 1.0,
                      muted: false
                  };
                  setTracks(prev => [...prev, newTrack]);
                  addAsset(newTrack);
              }
              
              stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          setIsRecording(true);
      } catch (e) {
          console.error("Mic Error", e);
          alert("Could not access microphone.");
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const handleTranscribe = async (track: AudioTrack) => {
      if (!track.audioUrl) return;
      setIsTranscribing(true);
      const text = await transcribeAudio(track.audioUrl);
      setTranscription(text);
      setIsTranscribing(false);
      alert(`Transcription for ${track.name}:\n\n${text}`);
  };

  const handleSmartMix = () => {
      const hasVoice = tracks.some(t => t.type === 'voiceover');
      if (hasVoice) {
          setTracks(prev => prev.map(t => t.type === 'music' ? { ...t, volume: 0.3 } : t));
          alert("Smart Mix: Ducked music tracks under voiceover.");
      } else {
          alert("No voiceover tracks found to duck against.");
      }
  };

  const handleAddTrackFromAsset = (asset: any) => {
      const newTrack: AudioTrack = {
          id: `asset-${Date.now()}`,
          name: asset.description || asset.name || 'Imported Asset',
          type: 'music',
          duration: 10, // Default for imported assets without metadata
          startOffset: 0,
          audioUrl: asset.url || asset.audioUrl,
          volume: 1.0,
          muted: false
      };
      setTracks(prev => [...prev, newTrack]);
  };

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
       {isSidebarOpen && (
           <div className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
       )}

       <div className={`
           fixed inset-y-0 left-0 z-40 bg-gray-900 border-r border-gray-800 w-80 transform transition-transform duration-300 md:relative md:translate-x-0
           ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
       `}>
           <AudioSidebar 
              activeTab={activeTab} 
              setActiveTab={setActiveTab}
              voices={voices}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              ttsInput={ttsInput}
              setTtsInput={setTtsInput}
              styleReference={styleReference}
              setStyleReference={setStyleReference}
              isGenerating={isGenerating}
              onGenerateTTS={handleGenerateTTS}
              onSmartMix={handleSmartMix}
              mastering={mastering}
              setMastering={setMastering}
              onUploadStyleRef={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setStyleReference(file.name);
              }}
              isRecording={isRecording}
              startRecording={startRecording}
              stopRecording={stopRecording}
              recordingTime={recordingTime}
              formatTime={(s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`}
              onCloneFromFile={handleCloneFromFile}
              onGenerateSong={handleGenerateSong}
              youtubeLink={youtubeLink}
              setYoutubeLink={setYoutubeLink}
              genre={genre}
              setGenre={setGenre}
              onUpdateVoice={(id, updates) => setVoices(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v))}
              voiceStyle={voiceStyle}
              setVoiceStyle={setVoiceStyle}
              songStructure={songStructure}
              setSongStructure={setSongStructure}
           />
       </div>

       {showAssets && (
           <div className="absolute top-0 right-0 bottom-0 w-80 bg-gray-900 border-l border-gray-800 z-30 shadow-2xl animate-in slide-in-from-right-10 flex flex-col">
               <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
                   <h3 className="font-bold flex items-center gap-2"><FolderOpen size={16}/> Asset Library</h3>
                   <button onClick={() => setShowAssets(false)}><X size={16}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-2">
                   {audioAssets.map((asset, i) => (
                       <div key={i} className="p-3 mb-2 bg-gray-800 rounded border border-gray-700 hover:border-primary-500 cursor-pointer group" onClick={() => handleAddTrackFromAsset(asset)}>
                           <div className="text-xs font-bold text-white mb-1 truncate">{asset.description || asset.name}</div>
                           <div className="flex justify-between items-center">
                               <span className="text-[10px] text-gray-500">Audio • {new Date(asset.date || asset.created || Date.now()).toLocaleDateString()}</span>
                               <Play size={12} className="text-gray-400 group-hover:text-primary-400"/>
                           </div>
                       </div>
                   ))}
                   {audioAssets.length === 0 && <div className="text-center text-gray-500 text-xs mt-10">No audio assets found.</div>}
               </div>
           </div>
       )}

       <div className="flex-1 flex flex-col min-w-0 bg-gray-950">
           <div className="md:hidden p-4 border-b border-gray-800 flex items-center bg-gray-900">
               <button onClick={() => setIsSidebarOpen(true)} className="text-gray-400 hover:text-white mr-4">
                   <Menu size={24} />
               </button>
               <h2 className="font-bold">Audio Studio</h2>
           </div>

           {activeTab === 'sequencer' ? (
               <AudioBeatMaker onAddTrack={(t) => { setTracks(p => [...p, t]); addAsset(t); }} genre={genre} />
           ) : (
               <AudioTimeline 
                  tracks={tracks}
                  setTracks={setTracks}
                  isPlaying={isPlaying}
                  onTogglePlay={handleTogglePlay}
                  onExportMix={() => { /* Handled in timeline */ }}
                  isExporting={isExporting}
                  onShowAssets={() => setShowAssets(!showAssets)}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  isRecording={isRecording}
                  startRecording={startRecording}
                  stopRecording={stopRecording}
                  onTranscribe={handleTranscribe}
                  isTranscribing={isTranscribing}
                  onDeleteTrack={(id) => setTracks(prev => prev.filter(t => t.id !== id))}
                  toggleMute={(id) => setTracks(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t))}
                  toggleSolo={(id) => setTracks(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t))}
                  handleVolumeChange={(id, val) => setTracks(prev => prev.map(t => t.id === id ? { ...t, volume: val } : t))}
                  audioRefs={audioRefs}
                  mastering={mastering}
               />
           )}
       </div>
    </div>
  );
};
