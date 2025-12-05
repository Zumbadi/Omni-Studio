
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Wand2, Plus, Download, X, Loader2, Music, Trash2, Brain, Database } from 'lucide-react';
import { Button } from './Button';
import { generateSoundEffect, generateDrumPattern } from '../services/geminiService';
import { AudioTrack } from '../types';
import { bufferToWav } from '../utils/audioHelpers';

interface AudioBeatMakerProps {
  onAddTrack: (track: AudioTrack) => void;
  genre?: string;
}

const DRUM_ROWS = ['Kick', 'Snare', 'HiHat', 'Clap', 'Bass'];

export const AudioBeatMaker: React.FC<AudioBeatMakerProps> = ({ onAddTrack, genre = 'Trap Soul' }) => {
  const [bpm, setBpm] = useState(140);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [grid, setGrid] = useState<boolean[][]>(DRUM_ROWS.map(() => Array(16).fill(false)));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [buffers, setBuffers] = useState<Record<string, AudioBuffer | null>>({});
  const [patternPrompt, setPatternPrompt] = useState('');
  const [isGeneratingPattern, setIsGeneratingPattern] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const timerIDRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  // Initialize AudioContext
  useEffect(() => {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      return () => {
          audioContextRef.current?.close();
      };
  }, []);

  // Scheduler Logic
  const scheduleNote = (stepNumber: number, time: number) => {
      // For visual sync
      setTimeout(() => {
          setCurrentStep(stepNumber);
      }, (time - (audioContextRef.current?.currentTime || 0)) * 1000);

      // Trigger Sounds
      DRUM_ROWS.forEach((row, rowIndex) => {
          if (grid[rowIndex][stepNumber] && buffers[row] && audioContextRef.current) {
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffers[row];
              source.connect(audioContextRef.current.destination);
              source.start(time);
          }
      });
  };

  const scheduler = () => {
      if (!audioContextRef.current) return;
      const lookahead = 25.0; // ms
      const scheduleAheadTime = 0.1; // s

      while (nextNoteTimeRef.current < audioContextRef.current.currentTime + scheduleAheadTime) {
          scheduleNote(stepRef.current, nextNoteTimeRef.current);
          
          // Advance time
          const secondsPerBeat = 60.0 / bpm;
          const secondsPer16th = secondsPerBeat / 4;
          nextNoteTimeRef.current += secondsPer16th;
          
          stepRef.current = (stepRef.current + 1) % 16;
      }
      timerIDRef.current = window.setTimeout(scheduler, lookahead);
  };

  useEffect(() => {
      if (isPlaying) {
          if (audioContextRef.current?.state === 'suspended') {
              audioContextRef.current.resume();
          }
          stepRef.current = 0;
          nextNoteTimeRef.current = audioContextRef.current?.currentTime || 0;
          scheduler();
      } else {
          if (timerIDRef.current) window.clearTimeout(timerIDRef.current);
          setCurrentStep(0);
      }
      return () => {
          if (timerIDRef.current) window.clearTimeout(timerIDRef.current);
      };
  }, [isPlaying, bpm]);

  const toggleStep = (row: number, col: number) => {
    const newGrid = [...grid];
    newGrid[row][col] = !newGrid[row][col];
    setGrid(newGrid);
  };

  const handleGeneratePattern = () => {
      const newGrid = grid.map(() => Array(16).fill(false));
      // Genre-specific simple generative logic
      for (let i = 0; i < 16; i++) {
          // Kick
          if (i === 0 || i === 10) newGrid[0][i] = true; 
          
          // Snare (Trap style: on 3rd beat usually, index 8)
          if (i === 8) newGrid[1][i] = true;
          
          // HiHats (Trap rolls: usually fast)
          if (i % 2 === 0) newGrid[2][i] = true;
          if (i >= 12 && i <= 15) newGrid[2][i] = true; // Roll at end
          
          // Clap
          if (i === 8 || i === 15) newGrid[3][i] = true; 
          
          // Bass
          if (i === 0 || i === 3 || i === 11) newGrid[4][i] = true;
      }
      setGrid(newGrid);
  };

  const handleAiPattern = async () => {
      if (!patternPrompt) return;
      setIsGeneratingPattern(true);
      const newGrid = await generateDrumPattern(patternPrompt);
      if (newGrid && newGrid.length === 5) {
          setGrid(newGrid);
      } else {
          alert("Failed to generate valid pattern.");
      }
      setIsGeneratingPattern(false);
  };

  const handleClearGrid = () => {
      setGrid(DRUM_ROWS.map(() => Array(16).fill(false)));
  };

  const decodeBase64Audio = async (base64: string): Promise<AudioBuffer> => {
      // Ensure context is active
      if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
      }
      const binaryString = atob(base64.split(',')[1]);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      // Decode audio data (buffer needs to be a copy or owned)
      return await audioContextRef.current!.decodeAudioData(bytes.buffer.slice(0));
  };

  const handleLoadStandardKit = async () => {
      if (!audioContextRef.current) return;
      setIsGenerating(true);
      
      try {
          // Retrieve from local storage assets created in AudioStudio
          const savedAssetsStr = localStorage.getItem('omni_audio_assets');
          const savedAssets = savedAssetsStr ? JSON.parse(savedAssetsStr) : [];
          
          const newBuffers: Record<string, AudioBuffer | null> = { ...buffers };
          
          for (const row of DRUM_ROWS) {
              // Find asset with matching ID suffix or name content
              const asset = savedAssets.find((a: any) => 
                  a.id === `${row.toLowerCase()}-std` || 
                  (a.name && a.name.toLowerCase().includes(row.toLowerCase()))
              );
              
              if (asset && asset.audioUrl) {
                  const buffer = await decodeBase64Audio(asset.audioUrl);
                  newBuffers[row] = buffer;
              }
          }
          
          setBuffers(newBuffers);
          alert("Standard Kit Loaded from Library!");
      } catch (e) {
          console.error(e);
          alert("Could not load standard kit. Ensure Audio Studio is initialized.");
      }
      setIsGenerating(false);
  };

  const handleGenerateKit = async () => {
      if (!audioContextRef.current) return;
      setIsGenerating(true);
      
      const newBuffers: Record<string, AudioBuffer | null> = { ...buffers };

      try {
          const promises = DRUM_ROWS.map(async (row) => {
              const prompt = `One-shot authentic ${genre} ${row} drum sample. Clean, punchy, high quality.`;
              const audioUrl = await generateSoundEffect(prompt); 
              if (audioUrl) {
                  const buffer = await decodeBase64Audio(audioUrl);
                  return { row, buffer };
              }
              return null;
          });

          const results = await Promise.all(promises);
          results.forEach(res => {
              if (res) {
                  newBuffers[res.row] = res.buffer;
              }
          });

          setBuffers(newBuffers);
          alert(`Generated Authentic ${genre} Kit!`);
      } catch (e) {
          console.error(e);
          alert("Failed to generate kit");
      }
      setIsGenerating(false);
  };

  const handleExportLoop = async () => {
      if (Object.keys(buffers).length === 0) {
          alert("Please generate or load a drum kit first.");
          return;
      }
      
      setIsExporting(true);
      
      try {
          // Calculate duration of 1 bar (16 steps)
          const secondsPerBeat = 60.0 / bpm;
          const totalDuration = secondsPerBeat * 4; 
          
          const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * 44100), 44100);
          
          for (let r = 0; r < DRUM_ROWS.length; r++) {
              const rowName = DRUM_ROWS[r];
              const buffer = buffers[rowName];
              if (!buffer) continue;
              
              for (let s = 0; s < 16; s++) {
                  if (grid[r][s]) {
                      const time = s * (secondsPerBeat / 4);
                      const source = offlineCtx.createBufferSource();
                      source.buffer = buffer;
                      source.connect(offlineCtx.destination);
                      source.start(time);
                  }
              }
          }
          
          const renderedBuffer = await offlineCtx.startRendering();
          const wavBlob = bufferToWav(renderedBuffer);
          
          // Convert Blob to Data URI for persistence
          const reader = new FileReader();
          reader.readAsDataURL(wavBlob);
          reader.onloadend = () => {
              const base64data = reader.result as string;
              
              const track: AudioTrack = {
                  id: `loop-${Date.now()}`,
                  name: `${genre} Loop ${bpm}BPM`,
                  type: 'music',
                  duration: totalDuration,
                  startOffset: 0,
                  audioUrl: base64data,
                  volume: 0.8
              };
              
              onAddTrack(track);
              setIsExporting(false);
              alert("Loop rendered and added to timeline!");
          };
      } catch (e) {
          console.error("Export Failed", e);
          setIsExporting(false);
          alert("Failed to render loop.");
      }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 p-6 overflow-y-auto">
       <div className="flex justify-between items-center mb-6">
           <div>
               <h2 className="text-xl font-bold text-white flex items-center gap-2">AI Beat Sequencer</h2>
               <p className="text-xs text-gray-500">Genre: <span className="text-primary-400 font-bold">{genre}</span></p>
           </div>
           <div className="flex gap-4 items-center bg-gray-800 p-1 rounded-lg">
               <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 rounded bg-primary-600 text-white hover:bg-primary-500 transition-colors">
                   {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
               </button>
               <div className="flex items-center gap-2 px-2">
                   <span className="text-xs text-gray-400 font-bold">BPM</span>
                   <input 
                     type="number" 
                     value={bpm} 
                     onChange={e => setBpm(parseInt(e.target.value))} 
                     className="w-12 bg-gray-900 border border-gray-700 rounded px-1 text-xs text-white text-center focus:outline-none focus:border-primary-500"
                   />
               </div>
           </div>
       </div>

       <div className="flex gap-2 mb-4">
           <input 
               type="text" 
               className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
               placeholder="Describe pattern (e.g. 'Fast hi-hats with heavy kick')"
               value={patternPrompt}
               onChange={(e) => setPatternPrompt(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleAiPattern()}
           />
           <Button size="sm" onClick={handleAiPattern} disabled={isGeneratingPattern || !patternPrompt}>
               {isGeneratingPattern ? <Loader2 size={14} className="animate-spin"/> : <Brain size={14} className="mr-1"/>} Generate
           </Button>
           <button onClick={handleClearGrid} className="p-2 bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 rounded-lg border border-gray-700 transition-colors" title="Clear Grid">
               <Trash2 size={14}/>
           </button>
       </div>

       <div className="bg-black rounded-xl border border-gray-800 p-4 mb-6 overflow-x-auto">
           <div className="min-w-[600px]">
               {/* Header Steps */}
               <div className="flex mb-2 ml-24">
                   {[...Array(16)].map((_, i) => (
                       <div key={i} className={`flex-1 text-center text-[10px] font-mono ${i === currentStep ? 'text-primary-400 font-bold' : 'text-gray-600'}`}>
                           {i + 1}
                       </div>
                   ))}
               </div>

               {/* Rows */}
               {DRUM_ROWS.map((row, rIdx) => (
                   <div key={row} className="flex items-center mb-2">
                       <div className="w-24 text-xs font-bold text-gray-400 flex items-center justify-between pr-3">
                           {row}
                           {buffers[row] ? (
                               <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div>
                           ) : isGenerating ? (
                               <Loader2 size={10} className="text-blue-500 animate-spin"/>
                           ) : (
                               <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
                           )}
                       </div>
                       <div className="flex-1 flex gap-1">
                           {grid[rIdx].map((active, cIdx) => (
                               <div 
                                 key={cIdx} 
                                 onClick={() => toggleStep(rIdx, cIdx)}
                                 className={`flex-1 h-8 rounded-sm cursor-pointer transition-all border border-transparent
                                    ${active ? 'bg-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-gray-800 hover:bg-gray-700'}
                                    ${cIdx === currentStep ? 'border-white/50' : ''}
                                    ${cIdx % 4 === 0 ? 'mr-1' : ''}
                                 `}
                               ></div>
                           ))}
                       </div>
                   </div>
               ))}
           </div>
       </div>

       <div className="flex gap-4 justify-end">
           <Button variant="ghost" onClick={handleLoadStandardKit} disabled={isGenerating}>
               <Database size={16} className="mr-2"/> Load Standard Kit
           </Button>
           <Button variant="secondary" onClick={handleGenerateKit} disabled={isGenerating}>
               {isGenerating ? <Loader2 size={16} className="animate-spin mr-2"/> : <Music size={16} className="mr-2"/>} 
               AI Generate Kit
           </Button>
           <Button variant="secondary" onClick={handleGeneratePattern}>
               <Wand2 size={16} className="mr-2"/> Randomize
           </Button>
           <Button onClick={handleExportLoop} disabled={isExporting}>
               {isExporting ? <Loader2 size={16} className="animate-spin ml-2"/> : <Plus size={16} className="ml-2"/>}
               {isExporting ? 'Rendering...' : 'Add to Timeline'}
           </Button>
       </div>
    </div>
  );
};
