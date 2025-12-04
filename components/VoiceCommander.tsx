
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, X, Volume2, Wifi, AlertCircle, RefreshCw } from 'lucide-react';
import { LiveSession } from '../services/geminiService';

interface VoiceCommanderProps {
  onClose: () => void;
  onProcess?: (text: string) => void;
}

export const VoiceCommander: React.FC<VoiceCommanderProps> = ({ onClose, onProcess }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [transcript, setTranscript] = useState('');
  const [bars, setBars] = useState<number[]>(Array(5).fill(10));
  const [isInterrupted, setIsInterrupted] = useState(false);
  
  const liveSessionRef = useRef<LiveSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const volumeRef = useRef({ input: 0, output: 0 });

  // Animation Loop - Driven by actual volume data
  useEffect(() => {
    const animate = () => {
      if (status === 'connected') {
        const targetVol = isSpeaking ? volumeRef.current.output : volumeRef.current.input;
        // Normalize 0-255 volume to bar height
        const normalized = Math.min(60, Math.max(5, targetVol / 3));
        
        setBars(prev => prev.map((curr, i) => {
            // Add some jitter for realism and distinct bars
            const noise = Math.random() * 10 - 5;
            const target = Math.max(5, normalized + noise);
            // Smooth interpolation
            return curr + (target - curr) * 0.2; 
        }));
      } else {
        setBars(prev => prev.map(h => h + (10 - h) * 0.1));
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => { if(rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, isListening, isSpeaking]);

  // Flash red on interrupt
  useEffect(() => {
      if (isInterrupted) {
          const t = setTimeout(() => setIsInterrupted(false), 500);
          return () => clearTimeout(t);
      }
  }, [isInterrupted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.disconnect();
      }
    };
  }, []);

  const handleToggleConnection = async () => {
      if (status === 'connected' || status === 'connecting') {
          liveSessionRef.current?.disconnect();
          setStatus('disconnected');
          setIsListening(false);
          setTranscript('Session ended.');
      } else {
          setStatus('connecting');
          setTranscript('Connecting to Neural Engine...');
          
          try {
              liveSessionRef.current = new LiveSession(
                  (text: string, isFinal: boolean) => {
                      setTranscript(text);
                      setIsListening(!isFinal);
                      if (isFinal) setIsSpeaking(true); 
                  },
                  () => {
                      setTranscript('Listening...');
                      setIsSpeaking(false);
                      setIsListening(true);
                      setIsInterrupted(true);
                  },
                  (inVol, outVol) => {
                      volumeRef.current = { input: inVol, output: outVol };
                  }
              );

              await liveSessionRef.current.connect();
              setStatus('connected');
              setTranscript('Omni Live is listening...');
              setIsListening(true);
          } catch (e) {
              console.error(e);
              setStatus('error');
              setTranscript('Connection Failed.');
          }
      }
  };

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-10 fade-in duration-300">
        <div className={`
            backdrop-blur-xl border rounded-full shadow-2xl flex items-center px-6 py-3 gap-6 min-w-[320px] max-w-[500px] relative overflow-hidden transition-all
            ${status === 'error' ? 'bg-red-900/90 border-red-500/50' : isInterrupted ? 'bg-red-900/80 border-red-500' : 'bg-gray-900/90 border-primary-500/30'}
        `}>
            {/* Ambient Glow */}
            <div className={`absolute inset-0 bg-primary-500/10 transition-opacity duration-500 ${status === 'connected' && !isInterrupted ? 'opacity-100' : 'opacity-0'}`}></div>
            
            {/* Visualizer */}
            <div className="flex items-center gap-1 h-8 items-end">
                {bars.map((h, i) => (
                    <div key={i} className={`w-1 rounded-full transition-all duration-75 ${status === 'connected' ? (isInterrupted ? 'bg-red-400' : 'bg-gradient-to-t from-primary-500 to-purple-400') : 'bg-gray-700'}`} style={{ height: `${h}px` }}></div>
                ))}
            </div>

            {/* Status & Text */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${status === 'connected' ? (isInterrupted ? 'text-red-400' : 'text-green-400') : status === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
                    {status === 'connected' ? (isInterrupted ? <RefreshCw size={10} className="animate-spin"/> : <Wifi size={10}/>) : status === 'error' ? <AlertCircle size={10}/> : <Activity size={10}/>}
                    {status === 'connected' ? (isInterrupted ? 'Interrupted' : 'Live Connection') : status}
                </div>
                <div className="text-sm text-white truncate font-medium">
                    {transcript || "Tap mic to start..."}
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 z-10">
                <button 
                    onClick={handleToggleConnection}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${
                        status === 'connected' ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' : 
                        status === 'connecting' ? 'bg-yellow-500 text-white' :
                        'bg-primary-600 hover:bg-primary-500 text-white'
                    }`}
                >
                    {status === 'connected' ? <Mic size={18} /> : status === 'connecting' ? <Activity size={18} className="animate-spin"/> : <MicOff size={18} />}
                </button>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors">
                    <X size={14} />
                </button>
            </div>
        </div>
    </div>
  );
};
