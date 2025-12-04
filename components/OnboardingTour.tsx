
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Zap, Code, Bot, Music, Clapperboard, Check } from 'lucide-react';
import { Button } from './Button';

export const OnboardingTour: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
      const hasSeen = localStorage.getItem('omni_tour_seen');
      if (!hasSeen) {
          setIsVisible(true);
      }
  }, []);

  const handleComplete = () => {
      localStorage.setItem('omni_tour_seen', 'true');
      setIsVisible(false);
      onClose();
  };

  if (!isVisible) return null;

  const steps = [
      {
          title: "Welcome to Omni-Studio",
          desc: "The AI-Native Development Environment. Build full-stack apps, generate media, and fine-tune models in one unified workspace.",
          icon: <Zap size={32} className="text-yellow-400"/>
      },
      {
          title: "Agent Orchestrator",
          desc: "Delegate complex tasks to 'Nexus' (Manager), 'Forge' (Builder), and 'Sentinel' (Critic). They plan, execute, and review code autonomously.",
          icon: <Bot size={32} className="text-purple-400"/>
      },
      {
          title: "Generative Media",
          desc: "Create social posts, edit images with magic commands, and generate video/audio assets directly within your project context.",
          icon: <Clapperboard size={32} className="text-pink-400"/>
      },
      {
          title: "Live Preview & Deploy",
          desc: "Instantly preview React, React Native, and Backend APIs. Deploy to production with a single click using our simulated CI/CD pipeline.",
          icon: <Code size={32} className="text-blue-400"/>
      }
  ];

  const current = steps[step];

  return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Progress Bar */}
              <div className="absolute top-0 left-0 h-1 bg-gray-800 w-full">
                  <div className="h-full bg-primary-500 transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }}></div>
              </div>

              <button onClick={handleComplete} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"><X size={20}/></button>

              <div className="p-8 flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 shadow-xl border border-gray-700">
                      {current.icon}
                  </div>
                  
                  <h2 className="text-2xl font-bold text-white mb-3">{current.title}</h2>
                  <p className="text-gray-400 text-sm leading-relaxed mb-8 min-h-[60px]">
                      {current.desc}
                  </p>

                  <div className="flex w-full gap-3">
                      {step > 0 ? (
                          <Button variant="secondary" className="flex-1" onClick={() => setStep(s => s - 1)}>Back</Button>
                      ) : (
                          <Button variant="secondary" className="flex-1" onClick={handleComplete}>Skip</Button>
                      )}
                      
                      <Button className="flex-1" onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : handleComplete()}>
                          {step < steps.length - 1 ? 'Next' : 'Get Started'} <ArrowRight size={16} className="ml-2"/>
                      </Button>
                  </div>
              </div>
              
              <div className="bg-gray-850 p-3 flex justify-center gap-2">
                  {steps.map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary-500' : 'bg-gray-700'}`}></div>
                  ))}
              </div>
          </div>
      </div>
  );
};
