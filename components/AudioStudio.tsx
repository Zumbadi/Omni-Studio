
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
    try {
        const saved = localStorage.getItem('omni_voices');
        return saved ? JSON.parse(saved) : MOCK_VOICES;
    } catch (e) {
        return MOCK_VOICES;
    }
  });

  // Library of reusable assets (separate from active timeline tracks)
  const [audioAssets, setAudioAssets] = useState<any[]>(() => {
      try {
          const saved = localStorage.getItem('omni_audio_assets');
          if (saved) {
              const parsed = JSON.parse(saved);
              // Filter out blob URLs that might be expired
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
            // If blob URL found on reload, try to clear it to avoid errors (unless we can recover it, which we can't)
            audioUrl: t.audioUrl && t.audioUrl.startsWith('blob:') ? undefined : t.audioUrl
        }));
    } catch(e) {
        return [{ id: 't1', name: 'Intro Music - Lofi Chill', type: 'music', duration: 30, startOffset: 0, volume: 0.8, muted: false, solo: false }];
    }
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
  const [genre, setGenre] = useState('Trap Soul');
  
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
    try {
        localStorage.setItem('omni_audio_tracks', JSON.stringify(tracksToSave));
        window.dispatchEvent(new Event('omniAssetsUpdated'));
    } catch (e) {
        console.error("Storage quota exceeded for audio tracks.", e);
        // Fallback: don't save tracks with large base64 data
        const lightTracks = tracksToSave.map(t => ({...t, audioUrl: undefined}));
        try {
            localStorage.setItem('omni_audio_tracks', JSON.stringify(lightTracks));
        } catch (retryError) {
            console.error("Failed to save audio tracks metadata.", retryError);
        }
    }
  }, [debouncedTracks]);

  useEffect(() => {
    try {
        localStorage.setItem('omni_voices', JSON.stringify(voices));
    } catch (e) {
        console.error("Failed to save voices", e);
    }
  }, [voices]);

  useEffect(() => {
      // Filter out non-persistent URLs before saving assets
      const assetsToSave = audioAssets.filter(a => a.audioUrl && a.audioUrl.startsWith('data:'));
      try {
          localStorage.setItem('omni_audio_assets', JSON.stringify(assetsToSave));
      } catch (e) {
          console.error("Storage quota exceeded for audio assets.", e);
          // If assets are too large, just save metadata or empty array to prevent crash loop
          try {
              const metaAssets = assetsToSave.map(a => ({...a, audioUrl: ''}));
              localStorage.setItem('omni_audio_assets', JSON.stringify(metaAssets));
          } catch(retry) {
              console.error("Critical asset storage failure", retry);
          }
      }
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
            // Get duration
            const tempAudio = new Audio(audioDataUri);
            tempAudio.onloadedmetadata = () => {
                const newTrack: AudioTrack = {
                    id: `t-${Date.now()}`,
                    name: `TTS: ${ttsInput.substring(0, 15)}...`,
                    type: 'voiceover',
                    duration: tempAudio.duration || 5,
                    startOffset: 0,
                    audioUrl: audioDataUri,
                    volume: 1.0
                };
                setTracks(prev => [...prev, newTrack]);
                setAudioAssets(prev => [...prev, { id: newTrack.id, type: 'audio', url: audioDataUri, name: newTrack.name }]);
            };
            // Fallback if metadata fails
            tempAudio.onerror = () => {
                 const newTrack: AudioTrack = {
                    id: `t-${Date.now()}`,
                    name: `TTS: ${ttsInput.substring(0, 15)}...`,
                    type: 'voiceover',
                    duration: 5,
                    startOffset: 0,
                    audioUrl: audioDataUri,
                    volume: 1.0
                };
                setTracks(prev => [...prev, newTrack]);
            };
        }
    } catch (error) {
        console.error(error);
    }
    setIsGenerating(false);
  };

  const handleGenerateSong = async () => {
      if (!ttsInput) return;
      setIsGenerating(true);
      try {
          const audioDataUri = await generateSong(ttsInput, styleReference, selectedVoice, youtubeLink, genre);
          if (audioDataUri) {
              const tempAudio = new Audio(audioDataUri);
              tempAudio.onloadedmetadata = () => {
                  const newTrack: AudioTrack = {
                      id: `song-${Date.now()}`,
                      name: `AI Song: ${genre}`,
                      type: 'music',
                      duration: tempAudio.duration || 15,
                      startOffset: 0,
                      audioUrl: audioDataUri,
                      volume: 0.8
                  };
                  setTracks(prev => [...prev, newTrack]);
                  setAudioAssets(prev => [...prev, { id: newTrack.id, type: 'audio', url: audioDataUri, name: newTrack.name }]);
              };
          }
      } catch (e) {
          console.error(e);
      }
      setIsGenerating(false);
  };

  const handleUploadReferenceTrack = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const base64 = ev.target?.result as string;
              setStyleReference(base64); // Keep as style ref
              
              // Also add as a separate track on timeline
              const tempAudio = new Audio(base64);
              const addTrack = (duration: number) => {
                  const newTrack: AudioTrack = {
                      id: `ref-${Date.now()}`,
                      name: `Ref: ${file.name}`,
                      type: 'music',
                      duration: duration,
                      startOffset: 0,
                      audioUrl: base64,
                      volume: 0.5,
                      muted: false
                  };
                  setTracks(prev => [...prev, newTrack]);
              };

              tempAudio.onloadedmetadata = () => {
                  // Fix for Chrome bug with some base64 audio reporting Infinity
                  if (tempAudio.duration === Infinity) {
                      tempAudio.currentTime = 1e101;
                      tempAudio.ontimeupdate = () => {
                          tempAudio.ontimeupdate = null;
                          addTrack(tempAudio.duration);
                      };
                  } else {
                      addTrack(tempAudio.duration);
                  }
              };
              tempAudio.onerror = () => addTrack(30); // Fallback
          };
          reader.readAsDataURL(file);
      }
  };

  const handleCloneFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsGenerating(true);
      
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          // Analyze style for description
          const analysis = await analyzeMediaStyle(base64, 'audio');
          
          const newVoice: Voice = {
              id: `v-${Date.now()}`,
              name: `Cloned (${file.name})`,
              gender: 'robot', // Default until analysis determines
              style: 'custom',
              isCloned: true,
              apiMapping: 'Kore', // Fallback mapping for the API
              settings: { stability: 0.5, similarity: 0.75 }
          };
          
          setVoices(prev => [...prev, newVoice]);
          setSelectedVoice(newVoice.id);
          setIsGenerating(false);
          alert(`Voice Cloned Successfully! Profile: ${analysis}`);
      };
      reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const dataUri = await blobToDataUri(blob);
        
        // If we are in 'cloning' mode, add to voices
        if (activeTab === 'cloning') {
             const analysis = await analyzeMediaStyle(dataUri, 'audio');
             const newVoice: Voice = {
                  id: `v-rec-${Date.now()}`,
                  name: `Cloned Recording`,
                  gender: 'robot', 
                  style: 'custom',
                  isCloned: true,
                  apiMapping: 'Fenrir',
                  settings: { stability: 0.5, similarity: 0.75 }
             };
             setVoices(prev => [...prev, newVoice]);
             setSelectedVoice(newVoice.id);
             alert(`Voice Cloned from Mic! Profile: ${analysis}`);
        } else {
            // Add as track
            const newTrack: AudioTrack = {
              id: `rec-${Date.now()}`,
              name: 'Microphone Recording',
              type: 'voiceover',
              duration: recordingTime,
              startOffset: 0,
              audioUrl: dataUri,
              volume: 1.0
            };
            setTracks(prev => [...prev, newTrack]);
        }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
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
      alert(`Transcription: ${text}`);
  };

  const handleUpdateVoice = (id: string, updates: Partial<Voice>) => {
      setVoices(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const toggleMute = (id: string) => setTracks(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
  const toggleSolo = (id: string) => setTracks(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : { ...t, solo: false }));
  const handleVolumeChange = (id: string, val: number) => setTracks(prev => prev.map(t => t.id === id ? { ...t, volume: val } : t));
  const handleDeleteTrack = (id: string) => setTracks(prev => prev.filter(t => t.id !== id));

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden">
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
            onSmartMix={() => {}}
            mastering={mastering}
            setMastering={setMastering}
            onUploadStyleRef={handleUploadReferenceTrack}
            isRecording={isRecording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            recordingTime={recordingTime}
            formatTime={(s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`}
            onCloneFromFile={handleCloneFromFile}
            onGenerateSong={handleGenerateSong}
            youtubeLink={youtubeLink}
            setYoutubeLink={setYoutubeLink}
            genre={genre}
            setGenre={setGenre}
            onUpdateVoice={handleUpdateVoice}
        />

        <div className="flex-1 flex flex-col min-w-0">
            {activeTab === 'sequencer' ? (
                <AudioBeatMaker onAddTrack={(t) => setTracks(prev => [...prev, t])} genre={genre} />
            ) : (
                <AudioTimeline 
                    tracks={tracks}
                    isPlaying={isPlaying}
                    onTogglePlay={handleTogglePlay}
                    onExportMix={() => setIsExporting(true)}
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
            )}
        </div>
    </div>
  );
};
