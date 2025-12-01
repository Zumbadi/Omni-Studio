
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Wand2, Plus, Download, X, Loader2, Music } from 'lucide-react';
import { Button } from './Button';
import { generateSoundEffect } from '../services/geminiService';
import { AudioTrack } from '../types';

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
  const [buffers, setBuffers] = useState<Record<string, AudioBuffer | null>>({});
  
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

  const decodeBase64Audio = async (base64: string): Promise<AudioBuffer> => {
      const binaryString = atob(base64.split(',')[1]);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      return await audioContextRef.current!.decodeAudioData(bytes.buffer);
  };

  const handleGenerateKit = async () => {
      if (!audioContextRef.current) return;
      setIsGenerating(true);
      const newBuffers: Record<string, AudioBuffer | null> = {};

      try {
          for (const row of DRUM_ROWS) {
              const prompt = `One-shot authentic ${genre} ${row} drum sample. Clean, punchy, high quality.`;
              const audioUrl = await generateSoundEffect(prompt); // Using SFX generation
              if (audioUrl) {
                  newBuffers[row] = await decodeBase64Audio(audioUrl);
              }
          }
          setBuffers(newBuffers);
          alert(`Generated Authentic ${genre} Kit!`);
      } catch (e) {
          console.error(e);
          alert("Failed to generate kit");
      }
      setIsGenerating(false);
  };

  const handleExportLoop = async () => {
      // For now, simple export simulation or adding a text representation track
      const track: AudioTrack = {
          id: `loop-${Date.now()}`,
          name: `${genre} Loop ${bpm}BPM`,
          type: 'music',
          duration: (60 / bpm) * 4 * 2,
          startOffset: 0,
          audioUrl: '', // In a real app we'd render the offline context
          volume: 0.8
      };
      onAddTrack(track);
      alert("Loop structure exported to timeline. (Rendering not fully implemented)");
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
                           {buffers[row] && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div>}
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
           <Button variant="secondary" onClick={handleGenerateKit} disabled={isGenerating}>
               {isGenerating ? <Loader2 size={16} className="animate-spin mr-2"/> : <Music size={16} className="mr-2"/>} 
               Generate Authentic Kit
           </Button>
           <Button variant="secondary" onClick={handleGeneratePattern}>
               <Wand2 size={16} className="mr-2"/> AI Pattern
           </Button>
           <Button onClick={handleExportLoop}>
               <Plus size={16} className="ml-2"/> Add to Timeline
           </Button>
       </div>
    </div>
  );
};
