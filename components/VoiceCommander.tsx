
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, X, Volume2 } from 'lucide-react';
import { chatWithVoice } from '../services/geminiService';

interface VoiceCommanderProps {
  onClose: () => void;
  onProcess?: (text: string) => void;
}

export const VoiceCommander: React.FC<VoiceCommanderProps> = ({ onClose, onProcess }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [bars, setBars] = useState<number[]>(Array(5).fill(10));
  
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const rafRef = useRef<number | null>(null);

  // Animation Loop
  useEffect(() => {
    const animate = () => {
      if (isListening || isSpeaking) {
        setBars(prev => prev.map(() => Math.random() * 40 + 10));
      } else {
        setBars(Array(5).fill(10));
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isListening, isSpeaking]);

  // Initialize Speech API
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
      };

      recognitionRef.current.onend = async () => {
        setIsListening(false);
        if (transcript.trim()) {
           if (onProcess) {
               onProcess(transcript);
               setAiResponse('Processing...');
           } else {
               await handleProcessVoice(transcript);
           }
        }
      };
    }
    synthRef.current = window.speechSynthesis;
    
    // Auto-start
    handleToggleListen();

    return () => {
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
    };
  }, []); // eslint-disable-line

  const handleProcessVoice = async (text: string) => {
      setAiResponse('Thinking...');
      const reply = await chatWithVoice(text);
      setAiResponse(reply);
      speak(reply);
  };

  const speak = (text: string) => {
      if (!synthRef.current) return;
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      // Try to find a good voice
      const voices = synthRef.current.getVoices();
      const preferred = voices.find(v => v.name.includes('Google') && v.name.includes('Female')) || voices[0];
      if (preferred) utterance.voice = preferred;
      
      utterance.onend = () => setIsSpeaking(false);
      synthRef.current.speak(utterance);
  };

  const handleToggleListen = () => {
      if (isListening) {
          recognitionRef.current?.stop();
          setIsListening(false);
      } else {
          setTranscript('');
          setAiResponse('');
          try {
            recognitionRef.current?.start();
            setIsListening(true);
          } catch (e) { console.error(e); }
      }
  };

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-300">
        <div className="bg-gray-900/90 backdrop-blur-xl border border-primary-500/30 rounded-full shadow-2xl flex items-center px-6 py-3 gap-6 min-w-[300px] max-w-[500px] relative overflow-hidden">
            {/* Ambient Glow */}
            <div className={`absolute inset-0 bg-primary-500/10 transition-opacity duration-500 ${isListening || isSpeaking ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></div>
            
            {/* Visualizer */}
            <div className="flex items-center gap-1 h-8">
                {bars.map((h, i) => (
                    <div key={i} className="w-1 bg-gradient-to-t from-primary-500 to-purple-400 rounded-full transition-all duration-75" style={{ height: `${h}px` }}></div>
                ))}
            </div>

            {/* Status & Text */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary-400 flex items-center gap-1">
                    {isListening ? <><Mic size={10}/> Listening</> : isSpeaking ? <><Volume2 size={10}/> Speaking</> : <><Activity size={10}/> Standby</>}
                </div>
                <div className="text-sm text-white truncate font-medium">
                    {transcript || aiResponse || "Say 'Create a component'..."}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 z-10">
                <button 
                    onClick={handleToggleListen}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${isListening ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 'bg-primary-600 hover:bg-primary-500 text-white'}`}
                >
                    {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors">
                    <X size={14} />
                </button>
            </div>
        </div>
    </div>
  );
};
