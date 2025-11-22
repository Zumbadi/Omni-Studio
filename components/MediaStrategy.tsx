
import React from 'react';
import { Target, Users, BarChart2, Sparkles } from 'lucide-react';
import { ContentStrategy } from '../types';

interface MediaStrategyProps {
  strategy: ContentStrategy;
  setStrategy: React.Dispatch<React.SetStateAction<ContentStrategy>>;
}

export const MediaStrategy: React.FC<MediaStrategyProps> = ({ strategy, setStrategy }) => {
  return (
      <div className="flex-1 p-8 overflow-y-auto bg-gray-950">
          <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Target className="text-red-500" /> Content Strategy</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Users size={18} className="text-blue-400"/> Target Audience</h3>
                      <textarea 
                        className="w-full bg-black/50 border border-gray-700 rounded-lg p-3 text-sm text-white h-32 focus:border-primary-500 outline-none resize-none" 
                        placeholder="Describe your ideal viewer..."
                        value={strategy.targetAudience}
                        onChange={e => setStrategy(s => ({...s, targetAudience: e.target.value}))}
                      />
                  </div>
                  <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><BarChart2 size={18} className="text-green-400"/> Core Goals</h3>
                      <div className="space-y-2">
                          {['brand_awareness', 'conversion', 'engagement', 'traffic'].map(goal => (
                              <div key={goal} 
                                onClick={() => setStrategy(s => ({...s, primaryGoal: goal as any}))}
                                className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${strategy.primaryGoal === goal ? 'bg-primary-900/30 border-primary-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'}`}
                              >
                                  <span className="capitalize">{goal.replace('_', ' ')}</span>
                                  {strategy.primaryGoal === goal && <div className="w-2 h-2 rounded-full bg-primary-500"></div>}
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-8">
                  <h3 className="text-lg font-semibold text-white mb-4">Content Pillars</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[0, 1, 2].map(i => (
                          <input 
                            key={i}
                            type="text"
                            placeholder={`Pillar ${i+1} (e.g., Educational)`}
                            className="bg-black/50 border border-gray-700 rounded-lg p-3 text-sm text-white focus:border-primary-500 outline-none"
                            value={strategy.contentPillars[i] || ''}
                            onChange={e => {
                                const newPillars = [...strategy.contentPillars];
                                newPillars[i] = e.target.value;
                                setStrategy(s => ({...s, contentPillars: newPillars}));
                            }}
                          />
                      ))}
                  </div>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-6 flex items-start gap-4">
                  <Sparkles className="text-blue-400 mt-1 flex-shrink-0" />
                  <div>
                      <h4 className="text-white font-medium mb-1">AI Optimization Active</h4>
                      <p className="text-sm text-blue-200">Omni uses your strategy to tailor script tone, hashtag selection, and visual style for every new post you generate.</p>
                  </div>
              </div>
          </div>
      </div>
  );
};
