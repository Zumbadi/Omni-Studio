
import React from 'react';
import { AudioTrack, AudioEffect } from '../types';
import { Plus, Trash2, Sliders, Activity, Zap, Waves, Gauge } from 'lucide-react';

interface AudioEffectsRackProps {
  track: AudioTrack;
  onUpdateTrack: (id: string, updates: Partial<AudioTrack>) => void;
}

export const AudioEffectsRack: React.FC<AudioEffectsRackProps> = ({ track, onUpdateTrack }) => {
  
  const handleAddEffect = (type: AudioEffect['type']) => {
      const newEffect: AudioEffect = {
          id: `fx-${Date.now()}`,
          type,
          active: true,
          params: { mix: 0.5, feedback: 0.3, time: 0.2, decay: 1.5, gain: 0.5, frequency: 1000 }
      };
      onUpdateTrack(track.id, { effects: [...(track.effects || []), newEffect] });
  };

  const handleRemoveEffect = (fxId: string) => {
      onUpdateTrack(track.id, { effects: track.effects?.filter(e => e.id !== fxId) });
  };

  const handleUpdateEffect = (fxId: string, updates: Partial<AudioEffect>) => {
      onUpdateTrack(track.id, {
          effects: track.effects?.map(e => e.id === fxId ? { ...e, ...updates } : e)
      });
  };

  const updateParam = (fxId: string, param: string, value: number) => {
      const effect = track.effects?.find(e => e.id === fxId);
      if (effect) {
          handleUpdateEffect(fxId, { params: { ...effect.params, [param]: value } });
      }
  };

  const renderKnob = (label: string, value: number, min: number, max: number, onChange: (val: number) => void) => (
      <div className="flex flex-col items-center gap-1">
          <div className="relative w-8 h-8 rounded-full bg-gray-900 border border-gray-600 flex items-center justify-center group cursor-ns-resize">
              <div 
                  className="absolute w-1 h-3 bg-primary-500 rounded-full origin-bottom bottom-1/2"
                  style={{ transform: `rotate(${((value - min) / (max - min)) * 270 - 135}deg)` }}
              ></div>
              <input 
                  type="range" 
                  min={min} max={max} step={(max - min) / 100}
                  value={value}
                  onChange={(e) => onChange(parseFloat(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  title={`${label}: ${value.toFixed(2)}`}
              />
          </div>
          <span className="text-[8px] text-gray-400 uppercase font-bold">{label}</span>
      </div>
  );

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
            <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Sliders size={14} className="text-blue-400"/> Effects Rack
            </h3>
            <div className="flex gap-1">
                <button onClick={() => handleAddEffect('reverb')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-purple-400" title="Add Reverb"><Waves size={14}/></button>
                <button onClick={() => handleAddEffect('delay')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-green-400" title="Add Delay"><Activity size={14}/></button>
                <button onClick={() => handleAddEffect('distortion')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400" title="Add Distortion"><Zap size={14}/></button>
                <button onClick={() => handleAddEffect('filter')} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-yellow-400" title="Add Filter"><Gauge size={14}/></button>
            </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-600">
            {(!track.effects || track.effects.length === 0) && (
                <div className="text-xs text-gray-600 text-center py-4 italic">No effects active.</div>
            )}
            
            {track.effects?.map((fx, i) => (
                <div key={fx.id} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700 relative group animate-in slide-in-from-left-2">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={fx.active} 
                                onChange={(e) => handleUpdateEffect(fx.id, { active: e.target.checked })}
                                className="w-3 h-3 rounded bg-gray-700 border-gray-500 text-primary-500"
                            />
                            <span className="text-xs font-bold text-gray-300 uppercase">{fx.type}</span>
                        </div>
                        <button onClick={() => handleRemoveEffect(fx.id)} className="text-gray-600 hover:text-red-400 p-0.5"><Trash2 size={12}/></button>
                    </div>
                    
                    <div className="flex justify-between items-center px-1">
                        {fx.type === 'reverb' && (
                            <>
                                {renderKnob('Mix', fx.params.mix || 0.5, 0, 1, (v) => updateParam(fx.id, 'mix', v))}
                                {renderKnob('Decay', fx.params.decay || 1.5, 0.1, 5, (v) => updateParam(fx.id, 'decay', v))}
                            </>
                        )}
                        {fx.type === 'delay' && (
                            <>
                                {renderKnob('Mix', fx.params.mix || 0.5, 0, 1, (v) => updateParam(fx.id, 'mix', v))}
                                {renderKnob('Time', fx.params.time || 0.2, 0.05, 1, (v) => updateParam(fx.id, 'time', v))}
                                {renderKnob('Fdbk', fx.params.feedback || 0.3, 0, 0.9, (v) => updateParam(fx.id, 'feedback', v))}
                            </>
                        )}
                        {fx.type === 'distortion' && (
                            <>
                                {renderKnob('Mix', fx.params.mix || 0.5, 0, 1, (v) => updateParam(fx.id, 'mix', v))}
                                {renderKnob('Gain', fx.params.gain || 0.5, 0, 10, (v) => updateParam(fx.id, 'gain', v))}
                            </>
                        )}
                        {fx.type === 'filter' && (
                            <>
                                {renderKnob('Mix', fx.params.mix || 1, 0, 1, (v) => updateParam(fx.id, 'mix', v))}
                                {renderKnob('Freq', fx.params.frequency || 1000, 20, 20000, (v) => updateParam(fx.id, 'frequency', v))}
                            </>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
