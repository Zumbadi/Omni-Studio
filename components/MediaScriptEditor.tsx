
import React, { useState, useRef } from 'react';
import { Upload, Wand2, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { Scene } from '../types';

interface MediaScriptEditorProps {
    script: string;
    onUpdateScript: (script: string) => void;
    onSyncToTimeline: (scenes: Scene[]) => void;
    platform: string;
}

export const MediaScriptEditor: React.FC<MediaScriptEditorProps> = ({ script, onUpdateScript, onSyncToTimeline, platform }) => {
    const [refType, setRefType] = useState<'image' | 'video'>('image');
    const [refData, setRefData] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setRefData(ev.target?.result as string);
                // In a real app, reset the file input here to allow re-uploading same file
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSync = () => {
        // Simple parser: split by double newline as scenes
        const blocks = script.split('\n\n').filter(b => b.trim());
        const newScenes: Scene[] = blocks.map((block, i) => ({
            id: `scene-${Date.now()}-${i}`,
            description: block,
            status: 'pending',
            duration: 5,
            transition: 'cut',
            imageUrl: refType === 'image' && i === 0 ? refData || undefined : undefined
        }));
        onSyncToTimeline(newScenes);
    };

    return (
        <div className="flex flex-col h-full bg-gray-950 p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold">Script Editor</h3>
                <div className="flex gap-2">
                     <select 
                        value={refType} 
                        onChange={(e) => setRefType(e.target.value as any)}
                        className="bg-gray-800 border border-gray-700 text-xs text-white rounded p-1 focus:outline-none"
                     >
                        <option value="image">Image Ref</option>
                        <option value="video">Video Ref</option>
                     </select>
                     
                     <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept={refType === 'image' ? "image/*" : "video/*,image/*"} 
                            onChange={handleFileUpload} 
                        />
                        <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded border border-gray-600 text-gray-300 flex items-center gap-1 text-xs transition-colors">
                            <Upload size={10}/> {refData ? 'Change File' : `Upload ${refType === 'image' ? 'Image' : 'Video'}`}
                        </button>
                        {refData && <span className="text-green-400 flex items-center gap-1 text-xs"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Ready</span>}
                    </div>
                </div>
            </div>
            
            <textarea 
                className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-4 text-white font-mono text-sm focus:border-primary-500 outline-none resize-none mb-4"
                placeholder={`Write your ${platform} script here...\n\nScene 1: Intro...\n\nScene 2: Main content...`}
                value={script}
                onChange={(e) => onUpdateScript(e.target.value)}
            />
            
            <div className="flex justify-end">
                <Button onClick={handleSync}>
                    <Wand2 size={16} className="mr-2"/> Generate Scenes
                </Button>
            </div>
        </div>
    );
};
