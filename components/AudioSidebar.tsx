
import React, { useRef } from 'react';
import { Music, Wand2, User, Check, Sliders, Upload, Zap, Mic, Volume2, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { Voice } from '../types';

interface AudioSidebarProps {
  activeTab: string;
  setActiveTab: (tab: 'mixer' | 'cloning' | 'pro') => void;
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
}

export const AudioSidebar: React.FC<AudioSidebarProps> = ({
  activeTab, setActiveTab, voices, selectedVoice, setSelectedVoice,
  ttsInput, setTtsInput, styleReference, isGenerating, onGenerateTTS, onSmartMix,
  mastering, setMastering, onUploadStyleRef, isRecording, startRecording, stopRecording, recordingTime, formatTime
}) => {
  const styleInputRef = useRef<HTMLInputElement>(null);

  return (
      <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-4 z-10 shadow-xl h-full">
        <div className="mb-2">
           <h2 className="text-xl font-bold flex items-center gap-2">
             <Music className="text-primary-500" /> Audio Studio
           </h2>
           <p className="text-xs text-gray-500">Create podcasts, music & clones</p>
        </div>

        <div className="flex gap-2 bg-gray-800 p-1 rounded-lg">
           <button onClick={() => setActiveTab('mixer')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'mixer' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Mixer</button>
           <button onClick={() => setActiveTab('cloning')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'cloning' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Voice Lab</button>
           <button onClick={() => setActiveTab('pro')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'pro' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Pro</button>
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

        {activeTab === 'pro' && (
            <div className="space-y-6">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2"><Zap size={14} className="text-green-400"/> Style Transfer</h3>
                    <p className="text-xs text-gray-500 mb-3">Upload a reference audio file to clone its tone.</p>
                    <input type="file" ref={styleInputRef} className="hidden" onChange={onUploadStyleRef} accept="audio/*" />
                    <button onClick={() => styleInputRef.current?.click()} className="w-full py-2 border border-dashed border-gray-600 rounded text-xs text-gray-400 hover:text-white hover:border-gray-400 flex items-center justify-center gap-2">
                         <Upload size={12} /> {styleReference ? "Update Reference" : "Upload Reference"}
                    </button>
                </div>
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Zap size={14} className="text-yellow-400"/> Mastering</h3>
                        <input type="checkbox" checked={mastering.enabled} onChange={(e) => setMastering(m => ({...m, enabled: e.target.checked}))} />
                     </div>
                     <div className={`space-y-3 ${!mastering.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                         <div><label className="text-xs text-gray-400 flex justify-between mb-1"><span>Warmth</span> <span>{mastering.warmth}%</span></label><input type="range" className="w-full h-1 bg-gray-700 rounded-lg accent-yellow-500" value={mastering.warmth} onChange={(e) => setMastering(m => ({...m, warmth: parseInt(e.target.value)}))} /></div>
                         <div><label className="text-xs text-gray-400 flex justify-between mb-1"><span>Clarity</span> <span>{mastering.clarity}%</span></label><input type="range" className="w-full h-1 bg-gray-700 rounded-lg accent-blue-500" value={mastering.clarity} onChange={(e) => setMastering(m => ({...m, clarity: parseInt(e.target.value)}))} /></div>
                         <div><label className="text-xs text-gray-400 flex justify-between mb-1"><span>Punch</span> <span>{mastering.punch}%</span></label><input type="range" className="w-full h-1 bg-gray-700 rounded-lg accent-red-500" value={mastering.punch} onChange={(e) => setMastering(m => ({...m, punch: parseInt(e.target.value)}))} /></div>
                     </div>
                </div>
            </div>
        )}

        {activeTab === 'cloning' && (
          <div className="space-y-6">
             <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col items-center text-center shadow-sm">
                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4 border-4 border-gray-700 relative overflow-hidden">
                    <Mic size={32} className={isRecording ? "text-red-500 relative z-10" : "text-gray-500 relative z-10"} />
                    {isRecording && (<><div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-50"></div><div className="absolute bottom-2 text-[10px] font-mono text-red-400 font-bold z-20 bg-black/50 px-1 rounded">{formatTime(recordingTime)}</div></>)}
                </div>
                <h3 className="font-medium text-white">Instant Clone</h3>
                <p className="text-xs text-gray-500 mb-4">Record at least 10s of audio.</p>
                <Button onClick={isRecording ? stopRecording : startRecording} variant={isRecording ? "danger" : "primary"} className="w-full">{isRecording ? 'Stop Recording' : 'Start Recording'}</Button>
             </div>
             <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">My Voices</h3>
                <div className="space-y-2">
                    {voices.filter(v => v.isCloned).map(v => (
                        <div key={v.id} className="bg-gray-800 p-3 rounded-lg flex items-center justify-between border border-gray-700">
                            <div className="flex items-center gap-3"><div className="w-8 h-8 bg-purple-900/50 rounded-full flex items-center justify-center text-purple-400"><User size={14} /></div><div><div className="text-sm font-medium text-white">{v.name}</div><div className="text-[10px] text-gray-500 capitalize">{v.style}</div></div></div>
                            <Check size={14} className="text-green-500" />
                        </div>
                    ))}
                </div>
             </div>
          </div>
        )}
      </div>
  );
};
