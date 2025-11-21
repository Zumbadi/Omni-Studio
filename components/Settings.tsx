import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Shield, Cpu, Type, Zap, Check } from 'lucide-react';
import { Button } from './Button';

export const Settings: React.FC = () => {
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('omni_active_model') || 'Gemini 2.5 Flash (Fastest)');
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("You are an expert React developer.");
  const [customModels, setCustomModels] = useState<any[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  
  // Editor Settings State
  const [fontSize, setFontSize] = useState('14px');
  const [tabSize, setTabSize] = useState('2 Spaces');
  const [vimMode, setVimMode] = useState(false);

  useEffect(() => {
    // Load custom models deployed from Fine-Tuning Dashboard
    const loadModels = () => {
        const deployed = JSON.parse(localStorage.getItem('omni_deployed_models') || '[]');
        setCustomModels(deployed);
    };
    loadModels();
    
    // Load editor settings
    const savedConfig = localStorage.getItem('omni_editor_config');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setFontSize(config.fontSize || '14px');
        setTabSize(config.tabSize || '2 Spaces');
        setVimMode(config.vimMode || false);
    }
    
    // Listen for deployment events
    window.addEventListener('modelsUpdated', loadModels);
    return () => window.removeEventListener('modelsUpdated', loadModels);
  }, []);

  const handleSave = () => {
      localStorage.setItem('omni_active_model', activeModel);
      
      // Save Editor Config
      const editorConfig = { fontSize, tabSize, vimMode };
      localStorage.setItem('omni_editor_config', JSON.stringify(editorConfig));
      
      // Dispatch event for real-time sync
      window.dispatchEvent(new Event('omniSettingsChanged'));

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 bg-gray-950 p-8 overflow-y-auto w-full">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="border-b border-gray-800 pb-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield size={28} className="text-primary-500" />
            Global Settings
          </h1>
          <p className="text-gray-400 mt-1">Configure your AI model, editor preferences, and runtime environment.</p>
        </header>

        {/* Model Configuration */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4 text-blue-400 font-semibold">
            <Cpu size={20} />
            <h2>Model Configuration</h2>
          </div>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Active Model</label>
              <select 
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-primary-500 focus:outline-none transition-colors"
              >
                <optgroup label="Google Gemini">
                    <option>Gemini 2.5 Pro (Latest)</option>
                    <option>Gemini 2.5 Flash (Fastest)</option>
                </optgroup>
                <optgroup label="External Providers">
                    <option>Llama 3 70B (Groq)</option>
                    <option>GPT-4o</option>
                </optgroup>
                {customModels.length > 0 && (
                    <optgroup label="My Fine-Tuned Models">
                        {customModels.map((m, idx) => (
                            <option key={idx} value={m.modelName}>{m.modelName}</option>
                        ))}
                    </optgroup>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">Select the underlying LLM used for code generation.</p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Temperature (Creativity)</label>
                <span className="text-xs text-primary-400 font-mono">{temperature}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={temperature} 
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Precise (0.0)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>
          </div>
        </section>

        {/* System Prompt */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
           <div className="flex items-center gap-2 mb-4 text-purple-400 font-semibold">
            <Zap size={20} />
            <h2>System Instructions</h2>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Base Prompt</label>
            <textarea 
              className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 font-mono focus:border-primary-500 focus:outline-none"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-2">This instruction is prepended to every request to define the AI's persona and constraints.</p>
          </div>
        </section>

        {/* Editor Preferences */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
           <div className="flex items-center gap-2 mb-4 text-yellow-400 font-semibold">
            <Type size={20} />
            <h2>Editor & Runtime</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
               <label className="block text-sm font-medium text-gray-300 mb-2">Font Size</label>
               <select 
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
               >
                  <option>12px</option>
                  <option>14px</option>
                  <option>16px</option>
                  <option>18px</option>
               </select>
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-300 mb-2">Tab Size</label>
               <select 
                  value={tabSize}
                  onChange={(e) => setTabSize(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
               >
                  <option>2 Spaces</option>
                  <option>4 Spaces</option>
                  <option>Tabs</option>
               </select>
            </div>
             <div className="col-span-2 flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 mt-2">
                <input 
                    type="checkbox" 
                    id="vim" 
                    checked={vimMode}
                    onChange={(e) => setVimMode(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-primary-600 focus:ring-primary-500 bg-gray-700" 
                />
                <label htmlFor="vim" className="text-sm text-gray-300">Enable Vim Mode (Simulation)</label>
             </div>
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="secondary">
            <RotateCcw size={16} className="mr-2" /> Reset Defaults
          </Button>
          <Button onClick={handleSave}>
            {isSaved ? <Check size={16} className="mr-2" /> : <Save size={16} className="mr-2" />}
            {isSaved ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};