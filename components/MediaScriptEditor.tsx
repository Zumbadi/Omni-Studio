
import React, { useState, useRef } from 'react';
import { Upload, Wand2, ArrowRight, Loader2, Sparkles, Clapperboard, Tv, Smile, BookOpen, Film, AlignLeft, Type, User, MessageSquare, StickyNote, Music, Download } from 'lucide-react';
import { Button } from './Button';
import { Scene, AudioTrack } from '../types';
import { parseScriptToScenes, generateCreativeScript } from '../services/geminiService';
import JSZip from 'jszip';

interface MediaScriptEditorProps {
    script: string;
    onUpdateScript: (script: string) => void;
    onSyncToTimeline: (scenes: Scene[], audioTracks?: AudioTrack[]) => void;
    platform: string;
}

type ScriptStyle = 'Film' | 'TV' | 'Cartoon' | 'Anime' | 'Manga';

export const MediaScriptEditor: React.FC<MediaScriptEditorProps> = ({ script, onUpdateScript, onSyncToTimeline, platform }) => {
    const [refType, setRefType] = useState<'image' | 'video'>('image');
    const [refData, setRefData] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [scriptStyle, setScriptStyle] = useState<ScriptStyle>('Film');
    const [genPrompt, setGenPrompt] = useState('');
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setRefData(ev.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAiSplit = async () => {
        if (!script.trim()) return;
        setIsParsing(true);
        const { scenes: parsedScenes, audioTracks } = await parseScriptToScenes(script);
        
        if (parsedScenes.length > 0) {
            const newScenes: Scene[] = parsedScenes.map((ps: any, i: number) => ({
                id: `ai-scene-${Date.now()}-${i}`,
                description: ps.description || "Scene",
                status: 'pending',
                duration: ps.duration || 5,
                transition: 'cut',
                audioScript: ps.audioScript || ps.voiceover // Handle legacy key
            }));
            
            // Convert simple audio track objects to full AudioTrack type if needed
            const newAudioTracks: AudioTrack[] = audioTracks.map((at: any, i: number) => ({
                id: `ai-track-${Date.now()}-${i}`,
                name: at.name || `Track ${i+1}`,
                type: at.type === 'sfx' ? 'sfx' : (at.type === 'voiceover' ? 'voiceover' : 'music'), // Correctly map voiceover type
                duration: at.duration || 5,
                startOffset: at.startOffset || 0,
                volume: 0.8,
                muted: false
            }));

            onSyncToTimeline(newScenes, newAudioTracks);
            alert(`AI generated ${newScenes.length} scenes and ${newAudioTracks.length} audio cues from your script.`);
        } else {
            alert("Failed to parse script with AI. Try the standard sync.");
        }
        setIsParsing(false);
    };

    const handleGenerateScript = async () => {
        if (!genPrompt.trim()) return;
        setIsGenerating(true);
        const generated = await generateCreativeScript(genPrompt, scriptStyle);
        if (generated) {
            const newScript = script ? `${script}\n\n${generated}` : generated;
            onUpdateScript(newScript);
        }
        setIsGenerating(false);
        setGenPrompt('');
    };

    const handleExportPDF = () => {
        // Simulate PDF export by creating a formatted text blob
        // In a real app, use jspdf or similar
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'screenplay.txt'; // Simple text for now, pretending it's PDF
        a.click();
        alert("Script downloaded (Text format).");
    };

    const insertText = (text: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newText = script.substring(0, start) + text + script.substring(end);
        onUpdateScript(newText);
        
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
    };

    const getStyleIcon = (style: ScriptStyle) => {
        switch(style) {
            case 'Film': return <Film size={14}/>;
            case 'TV': return <Tv size={14}/>;
            case 'Cartoon': return <Smile size={14}/>;
            case 'Anime': return <Sparkles size={14}/>;
            case 'Manga': return <BookOpen size={14}/>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-950">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <h3 className="text-white font-bold flex items-center gap-2"><AlignLeft size={16} className="text-primary-400"/> Script Editor</h3>
                    
                    {/* Style Selector */}
                    <div className="flex bg-black/50 rounded-lg p-1 border border-gray-700">
                        {(['Film', 'TV', 'Cartoon', 'Anime', 'Manga'] as ScriptStyle[]).map(style => (
                            <button
                                key={style}
                                onClick={() => setScriptStyle(style)}
                                className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${scriptStyle === style ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                                title={style}
                            >
                                {getStyleIcon(style)} <span className="hidden lg:inline">{style}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                     <button onClick={handleExportPDF} className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white" title="Export PDF">
                         <Download size={16} />
                     </button>
                     <div className="w-px h-6 bg-gray-700 mx-1"></div>
                     <select 
                        value={refType} 
                        onChange={(e) => setRefType(e.target.value as any)}
                        className="bg-gray-800 border border-gray-700 text-xs text-white rounded p-1.5 focus:outline-none"
                     >
                        <option value="image">Image Ref</option>
                        <option value="video">Video Ref</option>
                     </select>
                     
                     <div className="flex items-center gap-2">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept={refType === 'image' ? "image/*" : "video/*,image/*"} 
                            onChange={handleFileUpload} 
                        />
                        <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 text-gray-300 flex items-center gap-1 text-xs transition-colors">
                            <Upload size={12}/> {refData ? 'Ref Loaded' : 'Upload Ref'}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Formatting Bar */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none">
                <button onClick={() => insertText('\n\nINT. LOCATION - DAY\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-gray-300 font-mono border border-gray-700 flex items-center gap-1"><Clapperboard size={10}/> SCENE</button>
                <button onClick={() => insertText('\nAction description here.\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-gray-300 font-mono border border-gray-700 flex items-center gap-1"><Type size={10}/> ACTION</button>
                <button onClick={() => insertText('\n\nCHARACTER\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-gray-300 font-mono border border-gray-700 flex items-center gap-1"><User size={10}/> CHAR</button>
                <button onClick={() => insertText('(parenthetical)\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-gray-300 font-mono border border-gray-700">()</button>
                <button onClick={() => insertText('Dialogue goes here.\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-gray-300 font-mono border border-gray-700 flex items-center gap-1"><MessageSquare size={10}/> DIALOGUE</button>
                <button onClick={() => insertText('\n[DIRECTOR NOTE: Camera angle...]\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-yellow-500 font-mono border border-gray-700 flex items-center gap-1"><StickyNote size={10}/> NOTE</button>
                <button onClick={() => insertText('\n[MUSIC: Sad piano...]\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-blue-400 font-mono border border-gray-700 flex items-center gap-1"><Music size={10}/> MUSIC</button>
                <button onClick={() => insertText('\n[SFX: Sound...]\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-purple-400 font-mono border border-gray-700 flex items-center gap-1"><Sparkles size={10}/> SFX</button>
                {scriptStyle === 'Manga' && <button onClick={() => insertText('\n[PANEL 1]\n')} className="px-2 py-1 bg-gray-900 hover:bg-black rounded text-[10px] text-pink-400 font-mono border border-gray-700">PANEL</button>}
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
                <div className="flex-1 relative flex flex-col">
                    <textarea 
                        ref={textareaRef}
                        className="flex-1 bg-[#1a1a1a] text-gray-300 p-8 font-mono text-sm focus:outline-none resize-none leading-relaxed w-full border-none"
                        style={{ fontFamily: "'Courier Prime', 'Courier New', monospace", maxWidth: '100%' }}
                        placeholder={`Start writing your ${scriptStyle} script here...`}
                        value={script}
                        onChange={(e) => onUpdateScript(e.target.value)}
                        spellCheck={false}
                    />
                    
                    {/* Magic Generator Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 md:left-1/2 md:transform md:-translate-x-1/2 md:w-[500px] bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-xl p-2 flex gap-2 shadow-2xl transition-all hover:bg-gray-900">
                        <div className="flex items-center pl-2 text-gray-500">
                            <Wand2 size={16}/>
                        </div>
                        <input 
                            type="text" 
                            className="flex-1 bg-transparent border-none text-sm text-white focus:outline-none placeholder-gray-500"
                            placeholder={`Describe a scene to auto-generate (${scriptStyle} style)...`}
                            value={genPrompt}
                            onChange={(e) => setGenPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerateScript()}
                        />
                        <button 
                            onClick={handleGenerateScript}
                            disabled={isGenerating || !genPrompt}
                            className="bg-primary-600 hover:bg-primary-500 text-white p-1.5 rounded-lg disabled:opacity-50 transition-colors"
                        >
                            {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <ArrowRight size={16}/>}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-800 bg-gray-900 flex justify-between items-center">
                <div className="text-xs text-gray-500 font-mono">
                    {script.length} chars • {script.split('\n').length} lines
                </div>
                <div className="flex gap-3">
                    <Button onClick={handleAiSplit} disabled={isParsing} className="text-xs">
                        {isParsing ? <Loader2 size={14} className="animate-spin mr-2"/> : <Sparkles size={14} className="mr-2"/>} Sync to Timeline
                    </Button>
                </div>
            </div>
        </div>
    );
};
