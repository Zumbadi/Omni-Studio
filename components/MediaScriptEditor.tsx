
import React, { useState, useEffect } from 'react';
import { FileText, ArrowRight, Wand2, RefreshCw, Layers, Sparkles, Loader2, Palette } from 'lucide-react';
import { Button } from './Button';
import { Scene } from '../types';
import { generateSocialContent } from '../services/geminiService';

interface MediaScriptEditorProps {
  script: string;
  onUpdateScript: (script: string) => void;
  onSyncToTimeline: (scenes: Scene[]) => void;
  platform: string;
  topic?: string;
}

const VISUAL_STYLES = ['Realistic', 'Cartoon', 'Animation', 'Manga', 'Documentary', 'Film', 'TV'];

export const MediaScriptEditor: React.FC<MediaScriptEditorProps> = ({ script, onUpdateScript, onSyncToTimeline, platform, topic }) => {
  const [parsedScenes, setParsedScenes] = useState<Partial<Scene>[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [visualStyle, setVisualStyle] = useState('Realistic');

  // Auto-parse script into potential scenes
  useEffect(() => {
    const lines = script.split('\n');
    const scenes: Partial<Scene>[] = [];
    let currentScene: Partial<Scene> | null = null;

    lines.forEach((line) => {
        // Updated regex to support: Scene 1, Shot 1, [Scene 1], **Scene 1**, # Scene 1
        const sceneMatch = line.match(/^([#*]*\s*)?(Scene|Shot|Clip)\s*(\d+):?\s*[*]*\s*(.*)/i) || line.match(/^\[(.*?)\]\s*(.*)/);
        
        if (sceneMatch) {
            if (currentScene) scenes.push(currentScene);
            // Capture description: checks match groups differently based on regex used
            const desc = sceneMatch[4] || sceneMatch[2] || line.replace(/^[#*]*\s*(Scene|Shot|Clip)\s*\d+[:\s]*/i, '');
            currentScene = {
                description: desc.trim(),
                duration: 5, // Default estimate
                transition: 'cut'
            };
        } else if (currentScene) {
            // Append to description if it's a continuation and not empty
            if (line.trim()) currentScene.description += ` ${line.trim()}`;
        }
    });
    if (currentScene) scenes.push(currentScene);
    
    setParsedScenes(scenes);
  }, [script]);

  const handleMagicWrite = async () => {
      setIsGenerating(true);
      const styleInstruction = `Visual Style: ${visualStyle}.`;
      const prompt = script 
        ? `Continue this script maintaining the style:\n${script}\n\n${styleInstruction}` 
        : `Write a viral ${platform} script about ${topic || 'trending tech'}. Format as "Scene X: [Visual] Description". ${styleInstruction} Make it detailed and cinematic.`;
      
      let newScript = script ? script + "\n" : "";
      await generateSocialContent(prompt, platform, (chunk) => {
          newScript += chunk; 
          onUpdateScript(newScript);
      });
      onUpdateScript(newScript); 
      setIsGenerating(false);
  };

  const handleSync = () => {
      if (parsedScenes.length === 0) {
          alert("No scenes detected. Try formatting your script like 'Scene 1: Description'.");
          return;
      }
      
      const fullScenes: Scene[] = parsedScenes.map((s, i) => ({
          id: `s-${Date.now()}-${i}`,
          description: s.description || 'New Scene',
          status: 'pending',
          duration: s.duration || 5,
          transition: 'cut',
          mediaStartTime: 0
      }));
      
      onSyncToTimeline(fullScenes);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 bg-gray-950 overflow-hidden h-full">
        {/* Editor */}
        <div className="flex-1 flex flex-col bg-gray-900 rounded-xl border border-gray-800 shadow-lg overflow-hidden">
            <div className="p-3 border-b border-gray-800 bg-gray-850 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2"><FileText size={16}/> Script Editor</h3>
                    <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-2 py-1 border border-gray-700">
                        <Palette size={12} className="text-gray-400"/>
                        <select 
                            value={visualStyle} 
                            onChange={(e) => setVisualStyle(e.target.value)}
                            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                        >
                            {VISUAL_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
                <Button size="sm" variant="secondary" onClick={handleMagicWrite} disabled={isGenerating}>
                    {isGenerating ? <Loader2 size={14} className="animate-spin mr-2"/> : <Wand2 size={14} className="mr-2"/>}
                    {isGenerating ? 'Writing...' : 'Magic Write'}
                </Button>
            </div>
            <textarea 
                className="flex-1 w-full bg-black/50 p-6 text-sm text-gray-300 leading-relaxed focus:outline-none font-mono resize-none"
                value={script}
                onChange={(e) => onUpdateScript(e.target.value)}
                placeholder={`Scene 1: Wide shot of the city (${visualStyle} style)...`}
            />
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center text-gray-600">
            <ArrowRight size={24} className="hidden md:block"/>
            <ArrowRight size={24} className="md:hidden rotate-90"/>
        </div>

        {/* Preview & Sync */}
        <div className="w-full md:w-80 bg-gray-900 rounded-xl border border-gray-800 shadow-lg flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-800 bg-gray-850 flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Layers size={16}/> Scene Preview</h3>
                <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">{parsedScenes.length} scenes</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20">
                {parsedScenes.length === 0 ? (
                    <div className="text-center text-gray-600 py-10 px-4">
                        <p className="text-xs mb-2">Write your script using "Scene X:" format to auto-generate timeline clips.</p>
                    </div>
                ) : (
                    parsedScenes.map((s, i) => (
                        <div key={i} className="bg-gray-800 p-3 rounded-lg border border-gray-700/50">
                            <div className="text-[10px] font-bold text-primary-400 uppercase mb-1">Scene {i + 1}</div>
                            <p className="text-xs text-gray-300 line-clamp-3">{s.description}</p>
                        </div>
                    ))
                )}
            </div>

            <div className="p-4 border-t border-gray-800 bg-gray-850">
                <Button className="w-full" onClick={handleSync} disabled={parsedScenes.length === 0}>
                    <RefreshCw size={14} className="mr-2"/> Sync to Timeline
                </Button>
                <p className="text-[10px] text-gray-500 text-center mt-2">Overwrites current timeline</p>
            </div>
        </div>
    </div>
  );
};
