
import React from 'react';
import { User, Palette, Wand2, Sparkles, Loader2, Plus, Upload } from 'lucide-react';
import { Button } from './Button';
import { SocialPost } from '../types';

interface MediaProToolsProps {
  selectedPost: SocialPost | null;
  characterName: string;
  setCharacterName: (name: string) => void;
  isAnalyzingChar: boolean;
  onUploadCharacter: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadReference: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const MediaProTools: React.FC<MediaProToolsProps> = ({
  selectedPost, characterName, setCharacterName, isAnalyzingChar, onUploadCharacter, onUploadReference
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const refInputRef = React.useRef<HTMLInputElement>(null);

  return (
      <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-y-auto bg-gray-950">
          <div className="w-full md:w-1/3 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col min-h-[300px]">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><User size={16}/> Character Bank</h3>
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {selectedPost?.characters?.map((char) => (
                      <div key={char.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg border border-gray-700">
                          <img src={char.imageUrl} className="w-10 h-10 rounded-full object-cover border border-gray-600" />
                          <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-200">{char.name}</div>
                              {char.description && <div className="text-[10px] text-gray-500 truncate" title={char.description}>Analyzed: {char.description.substring(0, 30)}...</div>}
                          </div>
                      </div>
                  ))}
              </div>
              <div className="border-t border-gray-800 pt-4">
                  <input type="text" placeholder="Character Name" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs mb-2 text-white" value={characterName} onChange={e => setCharacterName(e.target.value)} />
                  <input type="file" ref={fileInputRef} className="hidden" onChange={onUploadCharacter} accept="image/*" />
                  <Button size="sm" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={!characterName || isAnalyzingChar}>
                      {isAnalyzingChar ? <Loader2 size={14} className="animate-spin mr-2"/> : <Plus size={14} className="mr-2"/>} {isAnalyzingChar ? 'Analyzing Features...' : 'Add Character'}
                  </Button>
              </div>
          </div>
          
          <div className="w-full md:w-1/3 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col min-h-[300px]">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2"><Palette size={16}/> Style Matcher</h3>
              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {selectedPost?.styleReferences?.map((ref) => (
                      <div key={ref.id} className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                          <div className="h-24 bg-black rounded mb-2 overflow-hidden"><img src={ref.url} className="w-full h-full object-cover opacity-70" /></div>
                          <div className="text-[10px] text-gray-400 italic line-clamp-3">"{ref.stylePrompt}"</div>
                      </div>
                  ))}
              </div>
              <div className="border-t border-gray-800 pt-4">
                  <input type="file" ref={refInputRef} className="hidden" onChange={onUploadReference} accept="image/*" />
                  <Button size="sm" variant="secondary" className="w-full" onClick={() => refInputRef.current?.click()}>
                      <Upload size={14} className="mr-2"/> Upload Reference
                  </Button>
              </div>
          </div>
          
          <div className="w-full md:w-1/3 bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col justify-center items-center text-center min-h-[200px]">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 text-primary-500"><Wand2 size={32} /></div>
              <h3 className="text-white font-bold mb-2">AI Director</h3>
              <p className="text-xs text-gray-400 mb-6">I will automatically adjust your scene prompts to match your uploaded characters and style references.</p>
              <div className="text-xs text-green-400 flex items-center gap-2 bg-green-900/20 px-3 py-1 rounded-full"><Sparkles size={12} /> Active</div>
          </div>
      </div>
  );
};
