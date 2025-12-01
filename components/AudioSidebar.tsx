
import React, { useRef, useState } from 'react';
import { Music, Wand2, User, Check, Sliders, Upload, Zap, Mic, Volume2, Loader2, Grid, Sparkles, Youtube, Edit2, Save, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { Voice } from '../types';
import { generateLyrics } from '../services/geminiService';

export type AudioTab = 'mixer' | 'cloning' | 'pro' | 'sequencer' | 'music';

interface AudioSidebarProps {
  activeTab: string;
  setActiveTab: (tab: AudioTab) => void;
  voices: Voice[];
  selectedVoice: string;
  setSelectedVoice: (id: string) => void;
  ttsInput: string;
  setTtsInput: (val: string) => void;
  styleReference: string | undefined;
  setStyleReference: (ref: string) => void;
  isGenerating: boolean;
  onGenerateTTS: () => void;
  onSmartMix: () => void;
  mastering: { enabled: boolean, warmth: number, clarity: number, punch: number };
  setMastering: React.Dispatch<React.SetStateAction<{ enabled: boolean, warmth: number, clarity: number, punch: number }>>;
  onUploadStyleRef: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  recordingTime: number;
  formatTime: (s: number) => string;
  onCloneFromFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateSong: () => void;
  youtubeLink?: string;
  setYoutubeLink?: (url: string) => void;
  genre: string;
  setGenre: (g: string) => void;
  onUpdateVoice?: (id: string, updates: Partial<Voice>) => void;
}

export const AudioSidebar: React.FC<AudioSidebarProps> = ({
  activeTab, setActiveTab, voices, selectedVoice, setSelectedVoice,
  ttsInput, setTtsInput, styleReference, isGenerating, onGenerateTTS, onSmartMix,
  mastering, setMastering, onUploadStyleRef, isRecording, startRecording, stopRecording, recordingTime, formatTime,
  onCloneFromFile, onGenerateSong, youtubeLink, setYoutubeLink, genre, setGenre, onUpdateVoice
}) => {
  const cloneInputRef = useRef<HTMLInputElement>(null);
  const musicRefInputRef = useRef<HTMLInputElement>(null);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSettings, setEditSettings] = useState({ stability: 0.5, similarity: 0.75 });
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);

  const GENRES = ["Trap Soul", "Neo Soul", "R&B", "Lofi", "Hip Hop", "Jazz", "Gospel"];

  const handleStartEdit = (voice: Voice) => {
      setEditingVoiceId(voice.id);
      setEditName(voice.name);
      setEditSettings(voice.settings || { stability: 0.5, similarity: 0.75 });
  };

  const handleSaveVoice = () => {
      if (editingVoiceId && onUpdateVoice) {
          onUpdateVoice(editingVoiceId, { name: editName, settings: editSettings });
          setEditingVoiceId(null);
      }
  };

  const handleAiLyrics = async () => {
      setIsGeneratingLyrics(true);
      const isContinuation = !!ttsInput.trim();
      const prompt = isContinuation ? ttsInput : `Generate lyrics for a ${genre} song`;
      
      const newLyrics = await generateLyrics(prompt, genre, isContinuation ? ttsInput : undefined);
      
      // Append if continuing, else set
      setTtsInput(prev => isContinuation ? (prev.trim() + "\n" + newLyrics) : newLyrics);
      setIsGeneratingLyrics(false);
  };

  return (
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-4 z-10 shadow-xl h-full">
        <div className="mb-2">
           <h2 className="text-xl font-bold flex items-center gap-2">
             <Music className="text-primary-500" /> Audio Studio
           </h2>
           <p className="text-xs text-gray-500">Create podcasts, music & clones</p>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-gray-800 p-1 rounded-lg">
           <button onClick={() => setActiveTab('mixer')} className={`py-1.5 text-[10px] font-medium rounded-md transition-colors ${activeTab === 'mixer' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Mixer</button>
           <button onClick={() => setActiveTab('music')} className={`py-1.5 text-[10px] font-medium rounded-md transition-colors ${activeTab === 'music' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Music AI</button>
           <button onClick={() => setActiveTab('cloning')} className={`py-1.5 text-[10px] font-medium rounded-md transition-colors ${activeTab === 'cloning' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Voice Lab</button>
           <button onClick={() => setActiveTab('sequencer')} className={`py-1.5 text-[10px] font-medium rounded-md transition-colors ${activeTab === 'sequencer' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Sequencer</button>
        </div>

        {activeTab === 'mixer' && (
           <div className="space-y-4 flex-1 overflow-y-auto">
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
                 <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Wand2 size={14} className="text-purple-400"/> Text to Speech</h3>
                 <textarea className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 focus:outline-none resize-none h-24 mb-2 focus:border-primary-500" placeholder="Enter text to generate..." value={ttsInput} onChange={(e) => setTtsInput(e.target.value)} />
                 <div className="mb-2">
                    {styleReference && <div className="text-xs text-green-400 flex items-center gap-1 mb-2 bg-green-900/20 px-2 py-1 rounded"><Check size={10} /> Style Active</div>}
                 </div>
                 <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 mb-2">
                    {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                 </select>
                 <Button size="sm" className="w-full" onClick={onGenerateTTS} disabled={isGenerating}>
                    {isGenerating ? <Loader2 size={14} className="animate-spin mr-2"/> : <Volume2 size={14} className="mr-2"/>} {isGenerating ? 'Generating...' : 'Generate Speech'}
                 </Button>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
                 <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Sliders size={14} className="text-blue-400"/> Quick Actions</h3>
                 <Button size="sm" variant="secondary" className="w-full mb-2" onClick={onSmartMix}>Auto-Mix (Ducking)</Button>
              </div>
           </div>
        )}

        {activeTab === 'sequencer' && (
            <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 text-center text-xs text-gray-400">
                <Grid size={24} className="mx-auto mb-2 text-primary-500"/>
                <p>Use the main panel to program beats.</p>
            </div>
        )}

        {activeTab === 'music' && (
            <div className="space-y-4 flex-1 overflow-y-auto">
               <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Music size={14} className="text-pink-400"/> Song Generator</h3>
                  
                  <label className="text-xs text-gray-500 mb-1 block">Genre</label>
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 mb-3">
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>

                  <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-500">Lyrics</label>
                      <button onClick={handleAiLyrics} disabled={isGeneratingLyrics} className="text-[10px] text-primary-400 hover:text-white flex items-center gap-1">
                          {isGeneratingLyrics ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>} {ttsInput ? 'Complete with AI' : 'Magic Write'}
                      </button>
                  </div>
                  <textarea 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs text-gray-300 focus:outline-none resize-none h-24 mb-3 focus:border-primary-500" 
                    placeholder="Verse 1:&#10;In the neon city lights..." 
                    value={ttsInput} 
                    onChange={(e) => setTtsInput(e.target.value)} 
                  />
                  
                  <label className="text-xs text-gray-500 mb-1 block">Reference Track</label>
                  <div className="flex flex-col gap-2 mb-3">
                      <div className="flex items-center gap-2">
                          <Youtube size={14} className="text-red-500" />
                          <input 
                            type="text" 
                            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none"
                            placeholder="YouTube URL..."
                            value={youtubeLink || ''}
                            onChange={(e) => setYoutubeLink && setYoutubeLink(e.target.value)}
                          />
                      </div>
                      
                      <div className="text-[10px] text-gray-500 text-center">- OR -</div>

                      <input type="file" ref={musicRefInputRef} className="hidden" onChange={onUploadStyleRef} accept="audio/*" />
                      <button onClick={() => musicRefInputRef.current?.click()} className="w-full py-2 border border-dashed border-gray-600 rounded text-xs text-gray-400 hover:text-white hover:border-gray-400 flex items-center justify-center gap-2 transition-colors">
                           <Upload size={12} /> {styleReference ? "File Loaded" : "Upload Audio File"}
                      </button>
                  </div>

                  <label className="text-xs text-gray-500 mb-1 block">Vocalist</label>
                  <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300 mb-3">
                     <option value="">Auto-Detect</option>
                     <optgroup label="Cloned Voices">
                        {voices.filter(v => v.isCloned).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                     </optgroup>
                     <optgroup label="Standard">
                        {voices.filter(v => !v.isCloned).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                     </optgroup>
                  </select>

                  <Button size="sm" className="w-full bg-pink-600 hover:bg-pink-500" onClick={onGenerateSong} disabled={isGenerating}>
                     {isGenerating ? <Loader2 size={14} className="animate-spin mr-2"/> : <Sparkles size={14} className="mr-2"/>} {isGenerating ? 'Composing...' : 'Generate Song'}
                  </Button>
               </div>
            </div>
        )}

        {activeTab === 'cloning' && (
          <div className="space-y-6 flex-1 overflow-y-auto">
             <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col items-center text-center shadow-sm">
                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4 border-4 border-gray-700 relative overflow-hidden">
                    <Mic size={32} className={isRecording ? "text-red-500 relative z-10" : "text-gray-500 relative z-10"} />
                    {isRecording && (<><div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-50"></div><div className="absolute bottom-2 text-[10px] font-mono text-red-400 font-bold z-20 bg-black/50 px-1 rounded">{formatTime(recordingTime)}</div></>)}
                </div>
                <h3 className="font-medium text-white">Instant Clone</h3>
                <p className="text-xs text-gray-500 mb-4">Record 10s or upload sample.</p>
                <div className="flex gap-2 w-full">
                    <Button onClick={isRecording ? stopRecording : startRecording} variant={isRecording ? "danger" : "primary"} className="flex-1 text-[10px]">{isRecording ? 'Stop' : 'Record'}</Button>
                    <input type="file" ref={cloneInputRef} className="hidden" onChange={onCloneFromFile} accept="audio/*" />
                    <Button onClick={() => cloneInputRef.current?.click()} variant="secondary" className="flex-1 text-[10px]"><Upload size={12} className="mr-1"/> File</Button>
                </div>
             </div>
             <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Voices</h3>
                <div className="space-y-2">
                    {voices.filter(v => v.isCloned).map(v => (
                        <div key={v.id} className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                            {editingVoiceId === v.id ? (
                                <div className="space-y-2 animate-in fade-in">
                                    <input 
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white" 
                                        value={editName} 
                                        onChange={(e) => setEditName(e.target.value)} 
                                    />
                                    <div className="text-[10px] text-gray-400">Stability: {editSettings.stability.toFixed(2)}</div>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.05" 
                                        value={editSettings.stability} 
                                        onChange={(e) => setEditSettings({...editSettings, stability: parseFloat(e.target.value)})}
                                        className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-primary-500"
                                    />
                                    <div className="text-[10px] text-gray-400">Similarity: {editSettings.similarity.toFixed(2)}</div>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.05" 
                                        value={editSettings.similarity} 
                                        onChange={(e) => setEditSettings({...editSettings, similarity: parseFloat(e.target.value)})}
                                        className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-primary-500"
                                    />
                                    <div className="flex gap-2 pt-1">
                                        <Button size="sm" onClick={handleSaveVoice} className="flex-1 text-[10px] py-1 h-6">Save</Button>
                                        <Button size="sm" variant="secondary" onClick={() => setEditingVoiceId(null)} className="flex-1 text-[10px] py-1 h-6">Cancel</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-purple-900/50 rounded-full flex items-center justify-center text-purple-400"><User size={14} /></div>
                                        <div><div className="text-sm font-medium text-white">{v.name}</div><div className="text-[10px] text-gray-500 capitalize">{v.style}</div></div>
                                    </div>
                                    <button onClick={() => handleStartEdit(v)} className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-700"><Edit2 size={12}/></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}
      </div>
  );
};
