
import React, { useState, useEffect, useRef } from 'react';
import { FileText, ArrowRight, Wand2, RefreshCw, Layers, Sparkles, Loader2, Palette, Upload, Video, Youtube, Image as ImageIcon, HelpCircle } from 'lucide-react';
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

const VISUAL_STYLES = ['Realistic', 'Cinematic', 'Cartoon', 'Animation', 'Manga', 'Documentary', 'Film Noir', 'Cyberpunk', 'TV Series'];

export const MediaScriptEditor: React.FC<MediaScriptEditorProps> = ({ script, onUpdateScript, onSyncToTimeline, platform, topic }) => {
  const [parsedScenes, setParsedScenes] = useState<Partial<Scene>[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [visualStyle, setVisualStyle] = useState('Cinematic');
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  
  // Reference Inputs
  const [refType, setRefType] = useState<'none' | 'image' | 'video' | 'youtube'>('none');
  const [refData, setRefData] = useState<string>(''); // URL or Base64
  const [refYoutube, setRefYoutube] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-parse script into potential scenes
  useEffect(() => {
    const lines = script.split('\n');
    const scenes: Partial<Scene>[] = [];
    let currentScene: Partial<Scene> | null = null;

    // Regex to detect scene headers (e.g. "Scene 1:", "**Scene 1**", "### Scene 1", "[Scene 1]")
    const headerRegex = /^([#*\[]*\s*)?(Scene|Shot|Clip)\s*(\d+).*?([\]*:]|$)/i;
    // Regex to detect duration tags (e.g. "[Duration]: 5s", "Duration: 4.5")
    const durationRegex = /\[?Duration\]?:?\s*(\d+(?:\.\d+)?)s?/i;

    lines.forEach((line) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        const sceneMatch = cleanLine.match(headerRegex);
        
        if (sceneMatch) {
            // Push previous scene if exists
            if (currentScene) scenes.push(currentScene);
            
            // Start new scene
            // Try to extract any description on the same line after the header
            let desc = cleanLine.replace(headerRegex, '').trim();
            // Remove leading colons or hyphens
            desc = desc.replace(/^[:\-\s]+/, '');

            currentScene = {
                description: desc,
                duration: 0, // Will calculate later
                transition: 'cut'
            };
        } else if (currentScene) {
            const durMatch = cleanLine.match(durationRegex);
            if (durMatch) {
                // Parse duration explicitly
                currentScene.duration = parseFloat(durMatch[1]);
            } else {
                // Append to description if it's a continuation
                // We keep [Visuals], [Audio] tags in description for context, but [Duration] is metadata
                currentScene.description = (currentScene.description ? currentScene.description + "\n" : "") + cleanLine;
            }
        }
    });
    
    // Push the last scene
    if (currentScene) scenes.push(currentScene);
    
    // Post-process for duration estimation if explicit duration is missing
    const processedScenes = scenes.map(s => {
        // If duration was parsed (and is valid), use it
        if (s.duration && s.duration > 0) return s;

        const wordCount = (s.description || '').split(/\s+/).length;
        // Estimate: 3 words per second, min 3s, max 10s default
        const estimatedDuration = Math.max(3, Math.min(15, Math.ceil(wordCount / 2.5)));
        return { ...s, duration: estimatedDuration };
    });

    setParsedScenes(processedScenes);
  }, [script]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const res = ev.target?.result as string;
              setRefData(res);
              // Auto-detect type from file
              if (file.type.startsWith('video/')) {
                  setRefType('video');
              } else if (file.type.startsWith('image/')) {
                  setRefType('image');
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleMagicWrite = async () => {
      setIsGenerating(true);
      let styleInstruction = `Visual Style: ${visualStyle}.`;
      
      if (refType === 'youtube' && refYoutube) {
          styleInstruction += ` Reference Video Content: ${refYoutube}.`;
      } else if ((refType === 'image' || refType === 'video') && refData) {
          styleInstruction += ` Use the attached ${refType} as a primary visual and tonal reference. Analyze it for lighting, camera work, and mood.`;
      }

      // Explicit instruction for Scene Headers and Cinematic Elements
      styleInstruction += `
        IMPORTANT: Create a professional screenplay format designed for video generation.
        1. Break the script into distinct "Scene X:" blocks (e.g., Scene 1, Scene 2).
        2. For EACH scene, you MUST include the following structured prompts on separate lines:
           - [Camera Angle]: Specific instructions (e.g., Low angle wide shot, Tracking shot, Extreme close-up).
           - [Visuals]: Detailed, vivid description of the action, lighting, characters, and environment.
           - [Audio]: Dialogue, specific Sound Effects (SFX), and Music cues/mood.
           - [Duration]: A specific duration in seconds (e.g., "5s" or "3.5s"). Base this on the action's pacing.
        3. Ensure the scenes blend seamlessly like a ${visualStyle} production.
        4. Focus on storytelling and pacing suitable for ${platform}.
      `;

      const prompt = script 
        ? `Continue this script maintaining the narrative arc and style:\n${script}\n\n${styleInstruction}` 
        : `Write a viral ${platform} script about ${topic || 'a compelling story'}. ${styleInstruction} Make it detailed, cinematic, and engaging.`;
      
      let newScript = script ? script + "\n" : "";
      
      // Pass refData if it's an image or video
      const mediaToSend = (refType === 'image' || refType === 'video') ? refData : undefined;

      await generateSocialContent(prompt, platform, (chunk) => {
          newScript += chunk; 
          onUpdateScript(newScript);
      }, mediaToSend);
      
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
          description: s.description?.trim() || 'New Scene',
          status: 'pending',
          duration: s.duration || 5,
          transition: 'cut',
          mediaStartTime: 0
      }));
      
      onSyncToTimeline(fullScenes);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 bg-gray-950 overflow-hidden h-full relative">
        {/* Editor */}
        <div className="flex-1 flex flex-col bg-gray-900 rounded-xl border border-gray-800 shadow-lg overflow-hidden relative">
            <div className="p-3 border-b border-gray-800 bg-gray-850 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2"><FileText size={16}/> Script Editor</h3>
                        <div className="relative">
                            <button onClick={() => setShowFormatHelp(!showFormatHelp)} className="text-gray-500 hover:text-white transition-colors">
                                <HelpCircle size={14} />
                            </button>
                            {showFormatHelp && (
                                <div className="absolute top-6 left-0 bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-xl w-64 z-50 text-xs text-gray-300">
                                    <h4 className="font-bold text-white mb-1">Format Guide</h4>
                                    <p className="mb-2">Use these headers to auto-generate scenes:</p>
                                    <code className="block bg-black/50 p-1 rounded mb-1">Scene 1: Description...</code>
                                    <code className="block bg-black/50 p-1 rounded mb-1">[Duration]: 5s</code>
                                    <code className="block bg-black/50 p-1 rounded">[Visuals]: Details...</code>
                                </div>
                            )}
                        </div>
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
                
                {/* Reference Inputs */}
                <div className="flex gap-2 items-center text-xs">
                    <span className="text-gray-500 font-bold uppercase tracking-wider">Reference:</span>
                    
                    <div className="flex bg-gray-800 rounded-lg border border-gray-700 p-0.5">
                        <button 
                            onClick={() => { setRefType(refType === 'image' ? 'none' : 'image'); setRefYoutube(''); }}
                            className={`p-1.5 rounded transition-colors ${refType === 'image' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Image Reference"
                        >
                            <ImageIcon size={14} />
                        </button>
                        <button 
                            onClick={() => { setRefType(refType === 'video' ? 'none' : 'video'); setRefYoutube(''); }}
                            className={`p-1.5 rounded transition-colors ${refType === 'video' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="Video Reference"
                        >
                            <Video size={14} />
                        </button>
                        <button 
                            onClick={() => { setRefType(refType === 'youtube' ? 'none' : 'youtube'); setRefData(''); }}
                            className={`p-1.5 rounded transition-colors ${refType === 'youtube' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            title="YouTube URL Reference"
                        >
                            <Youtube size={14} />
                        </button>
                    </div>

                    {(refType === 'image' || refType === 'video') && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept={refType === 'image' ? "image/*" : "video/*"} 
                                onChange={handleFileUpload} 
                            />
                            <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 text-gray-300 flex items-center gap-1">
                                <Upload size={10}/> {refData ? 'Change File' : `Upload ${refType === 'image' ? 'Image' : 'Video'}`}
                            </button>
                            {refData && <span className="text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Ready</span>}
                        </div>
                    )}

                    {refType === 'youtube' && (
                        <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-left-2">
                            <input 
                                type="text" 
                                placeholder="https://youtube.com/watch?v=..." 
                                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white w-full focus:border-red-500 outline-none"
                                value={refYoutube}
                                onChange={(e) => setRefYoutube(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>
            
            <textarea 
                className="flex-1 w-full bg-black/50 p-6 text-sm text-gray-300 leading-relaxed focus:outline-none font-mono resize-none"
                value={script}
                onChange={(e) => onUpdateScript(e.target.value)}
                placeholder={`Scene 1: Wide shot of the city (${visualStyle} style)...\n[Camera Angle] Panning left\n[Visuals] Neon lights flickering in rain\n[Audio] City ambiance fading in...\n[Duration] 5s\n\nScene 2: Close up of character...`}
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
                        <p className="text-xs mb-2">Write your script using "Scene X" headers (e.g. Scene 1, **Scene 2**) to auto-generate timeline clips.</p>
                    </div>
                ) : (
                    parsedScenes.map((s, i) => (
                        <div key={i} className="bg-gray-800 p-3 rounded-lg border border-gray-700/50">
                            <div className="flex justify-between items-center mb-1">
                                <div className="text-[10px] font-bold text-primary-400 uppercase">Scene {i + 1}</div>
                                <div className="text-[9px] text-gray-500 font-mono">{s.duration}s</div>
                            </div>
                            <p className="text-xs text-gray-300 line-clamp-3 whitespace-pre-wrap">{s.description || '(No description)'}</p>
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
