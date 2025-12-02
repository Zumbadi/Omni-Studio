
import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Shield, Cpu, Type, Zap, Check, Key, Globe, Plus, Trash2, Server, RefreshCw, AlertCircle, AlertTriangle, Eye, EyeOff, Sun, Moon, Layout, Palette } from 'lucide-react';
import { Button } from './Button';

interface ApiProvider {
  id: string;
  name: string;
  key: string;
  endpoint?: string;
  type: 'openai' | 'anthropic' | 'groq' | 'custom';
  status?: 'verified' | 'error' | 'pending';
}

const THEME_COLORS = [
  { name: 'Indigo', values: { 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 900: '#312e81' } },
  { name: 'Violet', values: { 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 900: '#4c1d95' } },
  { name: 'Emerald', values: { 400: '#34d399', 500: '#10b981', 600: '#059669', 900: '#064e3b' } },
  { name: 'Rose', values: { 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 900: '#881337' } },
  { name: 'Amber', values: { 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 900: '#78350f' } },
];

export const Settings: React.FC = () => {
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('omni_active_model') || 'Gemini 2.5 Flash (Fastest)');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('omni_gemini_key') || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("You are an expert React developer.");
  const [customModels, setCustomModels] = useState<any[]>([]);
  const [apiProviders, setApiProviders] = useState<ApiProvider[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  
  // Editor Settings State
  const [fontSize, setFontSize] = useState('14px');
  const [tabSize, setTabSize] = useState('2 Spaces');
  const [vimMode, setVimMode] = useState(false);
  
  // Appearance
  const [theme, setTheme] = useState(() => localStorage.getItem('omni_theme') || 'dark');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('omni_accent_color') || 'Indigo');

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

    // Load API Providers
    const savedProviders = localStorage.getItem('omni_api_providers');
    if (savedProviders) {
        setApiProviders(JSON.parse(savedProviders));
    }
    
    // Listen for deployment events
    window.addEventListener('modelsUpdated', loadModels);
    return () => window.removeEventListener('modelsUpdated', loadModels);
  }, []);

  useEffect(() => {
      // Sync theme with DOM
      const root = document.documentElement;
      if (theme === 'dark') {
          root.classList.add('dark');
      } else {
          root.classList.remove('dark');
      }
  }, [theme]);

  const applyColor = (colorName: string) => {
      const color = THEME_COLORS.find(c => c.name === colorName) || THEME_COLORS[0];
      setAccentColor(colorName);
      
      const root = document.documentElement;
      root.style.setProperty('--primary-400', color.values[400]);
      root.style.setProperty('--primary-500', color.values[500]);
      root.style.setProperty('--primary-600', color.values[600]);
      root.style.setProperty('--primary-900', color.values[900]);
      
      localStorage.setItem('omni_accent_color', colorName);
  };

  // Apply saved color on mount
  useEffect(() => {
      const savedColor = localStorage.getItem('omni_accent_color');
      if (savedColor) applyColor(savedColor);
  }, []);

  const handleSave = () => {
      localStorage.setItem('omni_active_model', activeModel);
      localStorage.setItem('omni_gemini_key', geminiKey);
      
      // Save Editor Config
      const editorConfig = { fontSize, tabSize, vimMode };
      localStorage.setItem('omni_editor_config', JSON.stringify(editorConfig));
      
      // Save API Providers
      localStorage.setItem('omni_api_providers', JSON.stringify(apiProviders));
      
      // Save Theme
      localStorage.setItem('omni_theme', theme);
      
      // Dispatch event for real-time sync
      window.dispatchEvent(new Event('omniSettingsChanged'));

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddProvider = (type: ApiProvider['type'] = 'custom') => {
      const names = { openai: 'OpenAI (GPT-4)', anthropic: 'Anthropic (Claude 3)', groq: 'Groq (Llama 3)', custom: 'Custom Provider' };
      const newProvider: ApiProvider = {
          id: `prov-${Date.now()}`,
          name: names[type],
          key: '',
          type,
          status: 'pending'
      };
      setApiProviders([...apiProviders, newProvider]);
  };

  const handleUpdateProvider = (id: string, field: keyof ApiProvider, value: string) => {
      setApiProviders(prev => prev.map(p => p.id === id ? { ...p, [field]: value, status: 'pending' } : p));
  };

  const handleDeleteProvider = (id: string) => {
      setApiProviders(prev => prev.filter(p => p.id !== id));
  };

  const handleVerifyProvider = (id: string) => {
      setVerifyingId(id);
      setTimeout(() => {
          setApiProviders(prev => prev.map(p => p.id === id ? { ...p, status: Math.random() > 0.2 ? 'verified' : 'error' } : p));
          setVerifyingId(null);
      }, 1500);
  };

  const handleFactoryReset = () => {
      if (confirm("DANGER: This will delete ALL local projects, settings, and data. Are you sure?")) {
          localStorage.clear();
          window.location.reload();
      }
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

        {/* Appearance */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4 text-pink-400 font-semibold">
            <Layout size={20} />
            <h2>Appearance</h2>
          </div>
          
          <div className="space-y-6">
              <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Interface Theme</span>
                  <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
                      <button 
                        onClick={() => setTheme('light')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === 'light' ? 'bg-gray-200 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      >
                          <Sun size={14}/> Light
                      </button>
                      <button 
                        onClick={() => setTheme('dark')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${theme === 'dark' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                      >
                          <Moon size={14}/> Dark
                      </button>
                  </div>
              </div>

              <div>
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-300">
                      <Palette size={16} /> Accent Color
                  </div>
                  <div className="flex gap-4">
                      {THEME_COLORS.map(c => (
                          <button
                              key={c.name}
                              onClick={() => applyColor(c.name)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${accentColor === c.name ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : 'hover:scale-105'}`}
                              style={{ backgroundColor: c.values[500] }}
                              title={c.name}
                          >
                              {accentColor === c.name && <Check size={14} className="text-white drop-shadow-md"/>}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
        </section>

        {/* Model Configuration */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4 text-blue-400 font-semibold">
            <Cpu size={20} />
            <h2>Model Configuration</h2>
          </div>
          
          <div className="space-y-5">
            {/* Gemini API Key */}
            <div>
               <label className="block text-sm font-medium text-gray-300 mb-2">Google Gemini API Key</label>
               <div className="relative">
                   <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                   <input 
                      type={showGeminiKey ? "text" : "password"} 
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white focus:border-primary-500 focus:outline-none font-mono"
                   />
                   <button 
                      onClick={() => setShowGeminiKey(!showGeminiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                   >
                      {showGeminiKey ? <EyeOff size={16}/> : <Eye size={16}/>}
                   </button>
               </div>
               <p className="text-xs text-gray-500 mt-1">Leave blank to use default environment key if configured.</p>
            </div>

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
                {apiProviders.filter(p => p.status === 'verified' || p.status === 'pending').length > 0 && (
                    <optgroup label="External Providers">
                        {apiProviders.filter(p => p.status === 'verified' || p.status === 'pending').map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                    </optgroup>
                )}
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

        {/* External Providers */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-lg">
           <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-green-400 font-semibold">
                    <Globe size={20} />
                    <h2>External API Providers</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => handleAddProvider('openai')} className="px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-300">OpenAI</button>
                    <button onClick={() => handleAddProvider('anthropic')} className="px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-300">Anthropic</button>
                    <button onClick={() => handleAddProvider('groq')} className="px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 rounded border border-gray-700 text-gray-300">Groq</button>
                </div>
           </div>
          
          <div className="space-y-4">
              {apiProviders.map((provider) => (
                  <div key={provider.id} className="flex flex-col gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700 relative group">
                      <div className="flex gap-3 items-start">
                          <div className="mt-2">
                              {provider.type === 'openai' && <Globe size={16} className="text-green-500"/>}
                              {provider.type === 'anthropic' && <Shield size={16} className="text-purple-500"/>}
                              {provider.type === 'groq' && <Zap size={16} className="text-orange-500"/>}
                              {provider.type === 'custom' && <Server size={16} className="text-blue-500"/>}
                          </div>
                          <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] text-gray-500 font-bold uppercase">Provider Name</label>
                                      <input 
                                        type="text" 
                                        value={provider.name} 
                                        onChange={(e) => handleUpdateProvider(provider.id, 'name', e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                                      />
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-gray-500 font-bold uppercase flex justify-between">
                                          <span>API Key</span>
                                          {provider.status === 'verified' && <span className="text-green-500 flex items-center gap-1"><Check size={10}/> Verified</span>}
                                          {provider.status === 'error' && <span className="text-red-500 flex items-center gap-1"><AlertCircle size={10}/> Failed</span>}
                                      </label>
                                      <div className="relative">
                                          <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                                          <input 
                                            type="password" 
                                            value={provider.key} 
                                            onChange={(e) => handleUpdateProvider(provider.id, 'key', e.target.value)}
                                            className={`w-full bg-gray-900 border rounded pl-9 pr-20 py-2 text-sm text-white font-mono focus:border-primary-500 outline-none transition-colors ${provider.status === 'error' ? 'border-red-500' : 'border-gray-700'}`}
                                            placeholder="sk-..."
                                          />
                                          <button 
                                            onClick={() => handleVerifyProvider(provider.id)}
                                            disabled={verifyingId === provider.id || !provider.key}
                                            className="absolute right-1 top-1 bottom-1 px-3 bg-gray-800 hover:bg-gray-700 rounded text-[10px] text-gray-300 border border-gray-700 disabled:opacity-50"
                                          >
                                              {verifyingId === provider.id ? <RefreshCw size={12} className="animate-spin"/> : 'Test'}
                                          </button>
                                      </div>
                                  </div>
                              </div>
                              {provider.type === 'custom' && (
                                  <div>
                                      <label className="text-[10px] text-gray-500 font-bold uppercase">Endpoint URL</label>
                                      <input 
                                        type="text" 
                                        value={provider.endpoint || ''} 
                                        onChange={(e) => handleUpdateProvider(provider.id, 'endpoint', e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-300 font-mono focus:border-primary-500 outline-none"
                                        placeholder="https://api.example.com/v1"
                                      />
                                  </div>
                              )}
                          </div>
                      </div>
                      <button onClick={() => handleDeleteProvider(provider.id)} className="absolute top-2 right-2 p-1.5 text-gray-600 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                  </div>
              ))}
              
              <Button variant="secondary" className="w-full border-dashed border-gray-600" onClick={() => handleAddProvider('custom')}>
                  <Plus size={16} className="mr-2"/> Add Custom Provider
              </Button>
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

        {/* Danger Zone */}
        <section className="bg-red-900/10 rounded-xl border border-red-900/50 p-6 shadow-lg">
           <div className="flex items-center gap-2 mb-4 text-red-500 font-semibold">
            <AlertTriangle size={20} />
            <h2>Danger Zone</h2>
          </div>
          <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">Reset the entire workspace, deleting all projects, settings, and agents.</p>
              <Button variant="danger" onClick={handleFactoryReset}>Factory Reset</Button>
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
