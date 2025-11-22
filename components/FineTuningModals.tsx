
import React, { useState } from 'react';
import { X, Database, Upload, MessageSquare, Send, Brain } from 'lucide-react';
import { Button } from './Button';
import { Dataset, FineTuningJob } from '../types';
import { testFineTunedModel } from '../services/geminiService';

// --- Dataset Inspector ---
interface DatasetModalProps {
  dataset: Dataset | null;
  onClose: () => void;
}
export const DatasetModal: React.FC<DatasetModalProps> = ({ dataset, onClose }) => {
  if (!dataset) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
         <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
           <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Database className="text-yellow-400" size={20} /> Dataset Inspector</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{dataset.name}</p>
           </div>
           <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
         </div>
         <div className="flex-1 bg-black p-6 overflow-auto">
            <div className="font-mono text-xs text-gray-400 whitespace-pre leading-relaxed">{dataset.content}</div>
         </div>
         <div className="px-6 py-3 bg-gray-850 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
            <span>Format: {dataset.format.toUpperCase()}</span>
            <span>Size: {dataset.size}</span>
         </div>
      </div>
    </div>
  );
};

// --- Playground Modal ---
interface PlaygroundModalProps {
  modelName: string;
  onClose: () => void;
}
export const PlaygroundModal: React.FC<PlaygroundModalProps> = ({ modelName, onClose }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([{ role: 'model', text: `Model ${modelName} loaded. How can I help you?` }]);
  const [input, setInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    const prompt = input;
    setInput('');
    setIsTesting(true);
    setMessages(prev => [...prev, { role: 'model', text: '' }]);
    let response = '';
    await testFineTunedModel(modelName, prompt, (chunk) => {
      response += chunk;
      setMessages(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1].text = response;
        return newHistory;
      });
    });
    setIsTesting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2"><MessageSquare className="text-green-400" size={20} /> Model Playground</h2>
            <p className="text-xs text-green-400 font-mono mt-0.5">Connected to: {modelName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-900">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'}`}>
                {msg.text}{msg.text === '' && isTesting && <span className="animate-pulse">▋</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-800 bg-gray-850">
          <form onSubmit={handleSubmit} className="relative">
            <input type="text" className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-4 pr-12 py-3 text-sm text-white focus:border-primary-500 focus:outline-none" placeholder={`Message ${modelName}...`} value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
            <button type="submit" disabled={!input.trim() || isTesting} className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-primary-500 hover:text-white hover:bg-primary-600 rounded-md transition-colors"><Send size={16} /></button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- New Job Modal ---
interface NewJobModalProps {
  datasets: Dataset[];
  onClose: () => void;
  onStart: (job: Partial<FineTuningJob>) => void;
}
export const NewJobModal: React.FC<NewJobModalProps> = ({ datasets, onClose, onStart }) => {
  const [step, setStep] = useState(1);
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Brain className="text-primary-500" size={20} /> New Fine-Tuning Job</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Base Model</label>
                <div className="grid grid-cols-2 gap-4">
                  {['Llama-3-8b', 'Mistral-7b-v0.3', 'Llama-3-70b (Quantized)', 'Gemma-7b'].map((model) => (
                    <div key={model} className="border border-gray-700 rounded-lg p-4 hover:border-primary-500 cursor-pointer hover:bg-gray-800 transition-all group">
                      <div className="flex justify-between items-center"><span className="text-white font-medium">{model}</span><div className="w-4 h-4 rounded-full border border-gray-500 group-hover:border-primary-500"></div></div>
                      <p className="text-xs text-gray-500 mt-2">Unsloth Optimized</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Dataset</label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none mb-2">
                    {datasets.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                </select>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center hover:border-gray-500 hover:bg-gray-800/50 transition-colors cursor-pointer">
                  <Upload className="text-gray-500 mb-3" size={24} />
                  <p className="text-sm text-gray-300">Or drag & drop new dataset</p>
                  <p className="text-xs text-gray-600 mt-1">Supports .jsonl, .txt (Max 1GB)</p>
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div><label className="block text-xs font-medium text-gray-400 mb-1">Epochs</label><input type="number" defaultValue={3} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none" /></div>
                   <div><label className="block text-xs font-medium text-gray-400 mb-1">Batch Size</label><input type="number" defaultValue={4} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none" /></div>
                   <div><label className="block text-xs font-medium text-gray-400 mb-1">Learning Rate</label><input type="text" defaultValue="2e-4" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none" /></div>
                   <div><label className="block text-xs font-medium text-gray-400 mb-1">LoRA Rank (r)</label><input type="number" defaultValue={16} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none" /></div>
                </div>
                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                   <h4 className="text-sm font-medium text-blue-400 mb-1">Estimated Cost</h4>
                   <p className="text-xs text-blue-200">Based on your dataset size and A100 usage, this job will cost approximately <span className="font-bold text-white">$2.40</span> and take ~45 minutes.</p>
                </div>
             </div>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-850 border-t border-gray-800 flex justify-end gap-3">
           {step > 1 && <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
           {step < 2 ? <Button onClick={() => setStep(step + 1)}>Next: Configuration</Button> : <Button onClick={() => onStart({ modelName: `Custom-Model-${Math.floor(Math.random()*1000)}`, baseModel: 'Llama-3-8b' })}>Start Training Job</Button>}
        </div>
      </div>
    </div>
  );
};
