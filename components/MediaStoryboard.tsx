
import React, { useState, memo } from 'react';
import { Scene } from '../types';
import { GripVertical, Wand2, Trash2, Copy, Plus, Image as ImageIcon, Sparkles, Loader2, CheckSquare, Square } from 'lucide-react';
import { Button } from './Button';
import { enhancePrompt } from '../services/geminiService';

interface MediaStoryboardProps {
  scenes: Scene[];
  onUpdateScene: (id: string, updates: Partial<Scene>) => void;
  onReorderScenes: (from: number, to: number) => void;
  onAddScene: () => void;
  onDuplicateScene: (index: number) => void;
  onDeleteScene: (index: number) => void;
  onGenerateImage: (id: string) => void;
  // Batch Actions Support
  onBatchDelete?: (indices: number[]) => void;
  onBatchDuplicate?: (indices: number[]) => void;
}

const SceneCard = memo(({ scene, index, isSelected, onToggleSelect, onUpdateScene, onReorderScenes, onDuplicateScene, onDeleteScene, onGenerateImage, onDragStart, onDragOver, onDragEnd }: any) => {
    const [enhancingId, setEnhancingId] = useState<string | null>(null);

    const handleEnhance = async () => {
        setEnhancingId(scene.id);
        const enhanced = await enhancePrompt(scene.description);
        onUpdateScene(scene.id, { description: enhanced });
        setEnhancingId(null);
    };

    return (
        <div 
            className={`bg-gray-900 border rounded-xl overflow-hidden flex flex-col group transition-all hover:shadow-lg ${isSelected ? 'border-primary-500 ring-1 ring-primary-500/50' : 'border-gray-800 hover:border-gray-700'}`}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                    onToggleSelect(index);
                }
            }}
        >
            {/* Header */}
            <div className="bg-gray-850 p-2 flex justify-between items-center border-b border-gray-800 cursor-move">
                <div className="flex items-center gap-2 text-gray-500">
                    <GripVertical size={14}/>
                    <span className="text-xs font-bold uppercase">Scene {index + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onToggleSelect(index); }} className={`p-1 rounded hover:bg-gray-700 ${isSelected ? 'text-primary-400' : 'text-gray-500'}`}>
                        {isSelected ? <CheckSquare size={14}/> : <Square size={14}/>}
                    </button>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); onDuplicateScene(index); }} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white" title="Duplicate"><Copy size={12}/></button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteScene(index); }} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400" title="Delete"><Trash2 size={12}/></button>
                    </div>
                </div>
            </div>

            {/* Visual */}
            <div className="aspect-video bg-black relative group/img">
                {scene.imageUrl ? (
                    <img src={scene.imageUrl} className="w-full h-full object-cover" loading="lazy" />
                ) : scene.status === 'generating' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-purple-400 gap-2">
                        <Loader2 size={24} className="animate-spin"/>
                        <span className="text-xs">Generating...</span>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-700">
                        <ImageIcon size={32}/>
                    </div>
                )}
                
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onGenerateImage(scene.id); }}>
                        <Wand2 size={14} className="mr-2"/> {scene.imageUrl ? 'Regenerate' : 'Generate'}
                    </Button>
                </div>
            </div>

            {/* Script */}
            <div className="p-3 flex-1 flex flex-col gap-2">
                <div className="relative">
                    <textarea 
                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-xs text-gray-300 resize-none h-20 focus:border-primary-500 focus:outline-none"
                        placeholder="Scene description..."
                        value={scene.description}
                        onChange={(e) => onUpdateScene(scene.id, { description: e.target.value })}
                        onClick={e => e.stopPropagation()}
                    />
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleEnhance(); }}
                        disabled={enhancingId === scene.id}
                        className="absolute bottom-2 right-2 p-1.5 bg-gray-700/80 hover:bg-primary-600 rounded text-gray-300 hover:text-white backdrop-blur transition-colors"
                        title="Enhance Prompt with AI"
                    >
                        {enhancingId === scene.id ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                    </button>
                </div>
                <div className="flex justify-between items-center text-[10px] text-gray-500">
                    <span>Duration: {scene.duration}s</span>
                    <select 
                        value={scene.transition} 
                        onChange={(e) => onUpdateScene(scene.id, { transition: e.target.value as any })}
                        className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 outline-none"
                        onClick={e => e.stopPropagation()}
                    >
                        <option value="cut">Cut</option>
                        <option value="fade">Fade</option>
                        <option value="dissolve">Dissolve</option>
                    </select>
                </div>
            </div>
        </div>
    );
}, (prev, next) => {
    return prev.scene === next.scene && prev.index === next.index && prev.isSelected === next.isSelected;
});

export const MediaStoryboard: React.FC<MediaStoryboardProps> = ({
  scenes, onUpdateScene, onReorderScenes, onAddScene, onDuplicateScene, onDeleteScene, onGenerateImage, onBatchDelete, onBatchDuplicate
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    onReorderScenes(draggedIdx, index);
    setDraggedIdx(index);
  };

  const toggleSelect = (index: number) => {
      setSelectedIndices(prev => 
          prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
      );
  };

  const handleBatchDelete = () => {
      if (onBatchDelete && selectedIndices.length > 0) {
          onBatchDelete(selectedIndices);
          setSelectedIndices([]);
      }
  };

  return (
    <div className="flex-1 bg-gray-950 p-6 overflow-y-auto relative">
        <div className="max-w-6xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Visual Storyboard</h3>
                <div className="flex gap-2">
                    <div className="text-xs text-gray-500 mr-2 flex items-center">
                        <span className="bg-gray-800 px-1.5 rounded border border-gray-700 mr-1">Ctrl + Click</span> to Select
                    </div>
                    <Button size="sm" onClick={onAddScene}>
                        <Plus size={16} className="mr-2"/> Add Scene
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {scenes.map((scene, index) => (
                    <SceneCard 
                        key={scene.id}
                        scene={scene}
                        index={index}
                        isSelected={selectedIndices.includes(index)}
                        onToggleSelect={toggleSelect}
                        onUpdateScene={onUpdateScene}
                        onReorderScenes={onReorderScenes}
                        onDuplicateScene={onDuplicateScene}
                        onDeleteScene={onDeleteScene}
                        onGenerateImage={onGenerateImage}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={() => setDraggedIdx(null)}
                    />
                ))}
                
                {/* Add Card */}
                <div 
                    onClick={onAddScene}
                    className="border-2 border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-600 hover:text-white hover:border-gray-600 cursor-pointer min-h-[280px] transition-colors"
                >
                    <Plus size={32} className="mb-2"/>
                    <span className="text-sm font-medium">Add Scene</span>
                </div>
            </div>
        </div>

        {/* Batch Actions Toolbar */}
        {selectedIndices.length > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 rounded-full px-6 py-3 shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 z-50">
                <span className="text-sm font-bold text-white">{selectedIndices.length} Selected</span>
                <div className="h-4 w-px bg-gray-600"></div>
                <button onClick={handleBatchDelete} className="text-gray-300 hover:text-red-400 flex items-center gap-1 text-xs font-medium transition-colors">
                    <Trash2 size={14}/> Delete
                </button>
                <button className="text-gray-300 hover:text-white flex items-center gap-1 text-xs font-medium transition-colors">
                    <Copy size={14}/> Duplicate
                </button>
                <button onClick={() => setSelectedIndices([])} className="text-gray-500 hover:text-white ml-2">
                    <span className="sr-only">Close</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        )}
    </div>
  );
};
