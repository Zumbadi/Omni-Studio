
import React, { useState, useEffect } from 'react';
import { Play, Pause, Wand2, Plus, Download, X } from 'lucide-react';
import { Button } from './Button';
import { generateSpeech } from '../services/geminiService';
import { AudioTrack, Voice } from '../types';

interface AudioBeatMakerProps {
  onAddTrack: (track: AudioTrack) => void;
}

const DRUM_ROWS = ['Kick', 'Snare', 'HiHat', 'Clap', 'Bass'];

export const AudioBeatMaker: React.FC<AudioBeatMakerProps> = ({ onAddTrack }) => {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [grid, setGrid] = useState<boolean[][]>(DRUM_ROWS.map(() => Array(16).fill(false)));
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!isPlaying) {
      setCurrentStep(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentStep(s => (s + 1) % 16);
    }, (60 / bpm) * 1000 / 4); // 16th notes
    return () => clearInterval(interval);
  }, [isPlaying, bpm]);

  const toggleStep = (row: number, col: number) => {
    const newGrid = [...grid];
    newGrid[row][col] = !newGrid[row][col];
    setGrid(newGrid);
  };

  const handleGeneratePattern = () => {
      const newGrid = grid.map(() => Array(16).fill(false));
      // Simple generative logic simulation
      for (let i = 0; i < 16; i++) {
          if (i % 4 === 0) newGrid[0][i] = true; // Kick on beats
          if (i % 8 === 4) newGrid[1][i] = true; // Snare on backbeat
          if (i % 2 === 0) newGrid[2][i] = true; // HiHats 8ths
          if (Math.random() > 0.8) newGrid[3][i] = true; // Random claps
          if (i % 8 === 0 || Math.random() > 0.9) newGrid[4][i] = true; // Bass
      }
      setGrid(newGrid);
  };

  const handleExportLoop = async () => {
      setIsGenerating(true);
      // Simulate "rendering" the beat by using TTS to beatbox
      // In a real app, we'd stitch AudioBuffers. Here we ask Gemini to "Beatbox this pattern".
      const patternDesc = grid.map((row, i) => `${DRUM_ROWS[i]}: ${row.map(x => x ? 'X' : '.').join('')}`).join('\n');
      const prompt = `Generate a beatbox loop based on this pattern:\n${patternDesc}\nMake it sound like a drum machine at ${bpm} BPM.`;
      
      // Mock voice for beatboxing
      const beatboxVoice: Voice = { id: 'v-bb', name: 'Beatboxer', gender: 'robot', style: 'energetic', isCloned: false };
      
      const audioUrl = await generateSpeech(prompt, beatboxVoice);
      
      if (audioUrl) {
          const newTrack: AudioTrack = {
              id: `loop-${Date.now()}`,
              name: `Drum Loop ${bpm}BPM`,
              type: 'music',
              duration: (60 / bpm) * 4 * 2, // 2 bars
              startOffset: 0,
              audioUrl,
              volume: 0.8
          };
          onAddTrack(newTrack);
          alert("Loop added to timeline!");
      }
      setIsGenerating(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 p-6 overflow-y-auto">
       <div className="flex justify-between items-center mb-6">
           <div>
               <h2 className="text-xl font-bold text-white flex items-center gap-2">AI Beat Sequencer</h2>
               <p className="text-xs text-gray-500">Generative rhythmic patterns</p>
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
               <div className="flex mb-2 ml-20">
                   {[...Array(16)].map((_, i) => (
                       <div key={i} className={`flex-1 text-center text-[10px] font-mono ${i === currentStep ? 'text-primary-400 font-bold' : 'text-gray-600'}`}>
                           {i + 1}
                       </div>
                   ))}
               </div>

               {/* Rows */}
               {DRUM_ROWS.map((row, rIdx) => (
                   <div key={row} className="flex items-center mb-2">
                       <div className="w-20 text-xs font-bold text-gray-400 flex items-center gap-1">
                           {row}
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
           <Button variant="secondary" onClick={handleGeneratePattern}>
               <Wand2 size={16} className="mr-2"/> AI Generate Pattern
           </Button>
           <Button onClick={handleExportLoop} disabled={isGenerating}>
               {isGenerating ? 'Synthesizing...' : 'Add Loop to Timeline'} <Plus size={16} className="ml-2"/>
           </Button>
       </div>
    </div>
  );
};
