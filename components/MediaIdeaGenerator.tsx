
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Sparkles, Image as ImageIcon, ArrowRight, Loader2, Lightbulb, Target, Clapperboard, FileText, ShoppingBag, List, Youtube, Video, Link as LinkIcon, Check, BrainCircuit, X } from 'lucide-react';
import { Button } from './Button';
import { analyzeMediaStyle, generateSocialContent } from '../services/geminiService';
import { SocialPost, Scene } from '../types';

interface MediaIdeaGeneratorProps {
  onCreatePost: (post: SocialPost) => void;
  brands: string[];
  activeBrandId: string;
  mindMapContext?: string;
  onClearContext?: () => void;
}

const CONTENT_TYPES = [
  { id: 'viral', label: 'Viral Sensation', icon: Sparkles, desc: 'High engagement hooks & trends' },
  { id: 'script', label: 'Script Outline', icon: FileText, desc: 'Scene breakdown & dialogue' },
  { id: 'director', label: 'Director\'s Notes', icon: Clapperboard, desc: 'Camera angles & lighting' },
  { id: 'showcase', label: 'Product Showcase', icon: ShoppingBag, desc: 'Feature focused highlights' }
];

export const MediaIdeaGenerator: React.FC<MediaIdeaGeneratorProps> = ({ onCreatePost, brands, activeBrandId, mindMapContext, onClearContext }) => {
  const [selectedBrand, setSelectedBrand] = useState(activeBrandId);
  const [refType, setRefType] = useState<'image' | 'video' | 'url'>('image');
  const [refData, setRefData] = useState<string>(''); // Base64 or URL
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState('viral');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      setSelectedBrand(activeBrandId);
  }, [activeBrandId]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setRefData(base64);
        setIsAnalyzing(true);
        const type = file.type.startsWith('video') ? 'video' : 'image';
        setRefType(type);
        const style = await analyzeMediaStyle(base64, type);
        setAnalysis(style);
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setRefData(e.target.value);
      if (e.target.value) {
          // Simple mock analysis for URL without scraping
          setAnalysis(`Content from URL: ${e.target.value}`); 
      } else {
          setAnalysis('');
      }
  };

  const handleGenerateIdeas = async () => {
    setIsGeneratingIdeas(true);
    setGeneratedIdeas([]);

    const typeLabel = CONTENT_TYPES.find(t => t.id === selectedContentType)?.label || 'Social Media Content';

    let prompt = `
      Brand: "${selectedBrand}"
      Strategy: ${typeLabel}
      Reference Context: ${analysis || (refType === 'url' ? `URL: ${refData}` : 'None')}
    `;

    if (mindMapContext) {
        prompt += `\n\n[MIND MAP CONTEXT - PRIORITY]\nUse the following structured brainstorming session to drive the creative direction:\n${mindMapContext}\n`;
    }

    prompt += `
      Generate 3 distinct ${typeLabel} ideas for Brand: "${selectedBrand}".
      Focus on the specific characteristics of a ${typeLabel}.
      If a visual reference, URL, or Mind Map context is provided, ensure the ideas align strictly with that style or content.
      
      Format ONLY as a JSON array of objects with keys: title, platform, hook, visual_desc.
      Example: [{"title": "Viral Challenge", "platform": "tiktok", "hook": "You won't believe this...", "visual_desc": "Fast paced cuts..."}]
    `;

    // We reuse generateSocialContent but parse the output
    let buffer = "";
    const mediaToSend = (refType === 'image' || refType === 'video') && refData.startsWith('data:') ? refData : undefined;
    
    await generateSocialContent(prompt, 'all', (chunk) => { buffer += chunk; }, mediaToSend);
    
    try {
        const cleanJson = buffer.replace(/```json|```/g, '').trim();
        const ideas = JSON.parse(cleanJson);
        if (Array.isArray(ideas)) {
            setGeneratedIdeas(ideas);
        }
    } catch (e) {
        console.error("Failed to parse ideas", e);
        // Fallback mock if parsing fails
        setGeneratedIdeas([
            { title: "Visual Showcase", platform: "instagram", hook: "Pure aesthetic vibes", visual_desc: "Slow pan of the product." },
            { title: "Behind the Scenes", platform: "tiktok", hook: "How we made this", visual_desc: "Time-lapse of creation process." }
        ]);
    }
    setIsGeneratingIdeas(false);
  };

  const convertToPost = (idea: any) => {
      const newPost: SocialPost = {
          id: `idea-${Date.now()}`,
          title: idea.title,
          platform: idea.platform as any || 'instagram',
          brandId: selectedBrand,
          status: 'idea',
          script: `Hook: ${idea.hook}\nVisuals: ${idea.visual_desc}`,
          scenes: [
              { id: `s1-${Date.now()}`, description: idea.visual_desc, status: 'pending', duration: 5, transition: 'fade', imageUrl: (refType === 'image' && refData.startsWith('data:')) ? refData : undefined }
          ],
          styleReferences: refData && refType !== 'url' ? [{ id: `ref-${Date.now()}`, type: refType as any, url: refData, stylePrompt: analysis }] : []
      };
      
      // If URL ref, append to script notes
      if (refType === 'url') {
          newPost.script += `\n\nReference URL: ${refData}`;
      }

      onCreatePost(newPost);
  };

  return (
    <div className="flex-1 p-8 bg-gray-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Sparkles className="text-purple-500"/> Campaign Generator
        </h2>
        <p className="text-gray-400 mb-8">Auto-generate on-brand content ideas from images, videos, URLs, or brainstorming sessions.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Input & Analysis */}
            <div className="space-y-6">
                
                {mindMapContext && (
                    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 animate-in fade-in relative group">
                        <button onClick={onClearContext} className="absolute top-2 right-2 text-yellow-500/50 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                        <h3 className="text-xs font-bold text-yellow-500 uppercase mb-2 flex items-center gap-2">
                            <BrainCircuit size={14}/> Mind Map Active
                        </h3>
                        <p className="text-xs text-yellow-200/80 line-clamp-3 italic">
                            "{mindMapContext.split('\n').slice(0,3).join(' ')}..."
                        </p>
                    </div>
                )}

                {/* Brand Selector */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Target Brand</label>
                    <select 
                        value={selectedBrand} 
                        onChange={(e) => setSelectedBrand(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none"
                    >
                        {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                {/* Reference Input */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Reference Source</label>
                    
                    <div className="flex bg-gray-900 rounded-lg border border-gray-700 p-1 mb-3">
                        <button onClick={() => { setRefType('image'); setRefData(''); }} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 ${refType === 'image' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                            <ImageIcon size={14}/> Image
                        </button>
                        <button onClick={() => { setRefType('video'); setRefData(''); }} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 ${refType === 'video' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                            <Video size={14}/> Video
                        </button>
                        <button onClick={() => { setRefType('url'); setRefData(''); }} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 ${refType === 'url' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                            <LinkIcon size={14}/> URL
                        </button>
                    </div>

                    {refType === 'url' ? (
                        <input 
                            type="text" 
                            placeholder="https://instagram.com/p/..." 
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none"
                            value={refData}
                            onChange={handleUrlChange}
                        />
                    ) : (
                        <div className="w-full h-32 border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:border-gray-500 hover:bg-gray-900/50 transition-colors cursor-pointer relative" onClick={() => fileInputRef.current?.click()}>
                            {refData ? (
                                <img src={refData} className="w-full h-full object-cover rounded-lg opacity-50" />
                            ) : (
                                <>
                                    <Upload size={24} className="mb-2" />
                                    <span className="text-xs">Click to upload {refType}</span>
                                </>
                            )}
                            {refData && <div className="absolute inset-0 flex items-center justify-center"><Check className="text-green-500 bg-black/50 rounded-full p-1" size={32}/></div>}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept={refType === 'image' ? "image/*" : "video/*"} 
                                onChange={handleUpload} 
                            />
                        </div>
                    )}
                </div>

                {/* Analysis Result */}
                {isAnalyzing && (
                    <div className="flex items-center gap-2 text-xs text-blue-400 animate-pulse">
                        <Loader2 size={12} className="animate-spin"/> Analyzing visual style...
                    </div>
                )}
                {analysis && !isAnalyzing && (
                    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800 text-xs">
                        <div className="font-bold text-gray-400 mb-1 uppercase">AI Analysis</div>
                        <p className="text-gray-300 italic">"{analysis}"</p>
                    </div>
                )}

                {/* Content Type */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Campaign Type</label>
                    <div className="space-y-2">
                        {CONTENT_TYPES.map(type => (
                            <div 
                                key={type.id} 
                                onClick={() => setSelectedContentType(type.id)}
                                className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-all ${selectedContentType === type.id ? 'bg-primary-900/20 border-primary-500' : 'bg-gray-900 border-gray-700 hover:bg-gray-800'}`}
                            >
                                <div className={`p-2 rounded-lg ${selectedContentType === type.id ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                                    <type.icon size={16}/>
                                </div>
                                <div>
                                    <div className={`text-sm font-medium ${selectedContentType === type.id ? 'text-white' : 'text-gray-300'}`}>{type.label}</div>
                                    <div className="text-[10px] text-gray-500">{type.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <Button size="lg" className="w-full" onClick={handleGenerateIdeas} disabled={isGeneratingIdeas}>
                    {isGeneratingIdeas ? <Loader2 size={18} className="animate-spin mr-2"/> : <Lightbulb size={18} className="mr-2"/>}
                    {isGeneratingIdeas ? 'Brainstorming...' : 'Generate Concepts'}
                </Button>
            </div>

            {/* Right: Results */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col h-full min-h-[500px]">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Generated Concepts</h3>
                
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {generatedIdeas.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50 space-y-4">
                            <Target size={48} />
                            <p className="text-sm text-center max-w-xs">Select a brand, upload a reference, and let Omni generate tailored content ideas.</p>
                        </div>
                    ) : (
                        generatedIdeas.map((idea, i) => (
                            <div key={i} className="bg-black/30 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors group">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-white text-lg">{idea.title}</h4>
                                    <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 uppercase">{idea.platform}</span>
                                </div>
                                <div className="text-xs text-gray-300 mb-2">
                                    <strong className="text-primary-400">Hook:</strong> {idea.hook}
                                </div>
                                <div className="text-xs text-gray-400 italic mb-4 border-l-2 border-gray-700 pl-2">
                                    {idea.visual_desc}
                                </div>
                                <Button size="sm" variant="secondary" className="w-full group-hover:bg-primary-600 group-hover:text-white transition-colors" onClick={() => convertToPost(idea)}>
                                    Convert to Project <ArrowRight size={14} className="ml-2"/>
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
