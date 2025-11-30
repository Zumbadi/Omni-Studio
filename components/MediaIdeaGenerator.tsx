
import React, { useState, useRef } from 'react';
import { Upload, Sparkles, Image as ImageIcon, ArrowRight, Loader2, Lightbulb, Target } from 'lucide-react';
import { Button } from './Button';
import { analyzeMediaStyle, generateSocialContent } from '../services/geminiService';
import { SocialPost, Scene } from '../types';

interface MediaIdeaGeneratorProps {
  onCreatePost: (post: SocialPost) => void;
  brandId: string;
}

export const MediaIdeaGenerator: React.FC<MediaIdeaGeneratorProps> = ({ onCreatePost, brandId }) => {
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        setReferenceImage(base64);
        setIsAnalyzing(true);
        const style = await analyzeMediaStyle(base64, 'image');
        setAnalysis(style);
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateIdeas = async () => {
    if (!analysis) return;
    setIsGeneratingIdeas(true);
    setGeneratedIdeas([]);

    const prompt = `
      Based on the visual analysis: "${analysis}"
      Generate 3 distinct social media content ideas for Brand ID: "${brandId}".
      Format ONLY as a JSON array of objects with keys: title, platform, hook, visual_desc.
      Example: [{"title": "Viral Challenge", "platform": "tiktok", "hook": "You won't believe this...", "visual_desc": "Fast paced cuts..."}]
    `;

    // We reuse generateSocialContent but parse the output
    let buffer = "";
    await generateSocialContent(prompt, 'all', (chunk) => { buffer += chunk; });
    
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
          brandId,
          status: 'idea',
          script: `Hook: ${idea.hook}\nVisuals: ${idea.visual_desc}`,
          scenes: [
              { id: `s1-${Date.now()}`, description: idea.visual_desc, status: 'pending', duration: 5, transition: 'fade', imageUrl: referenceImage || undefined }
          ],
          styleReferences: referenceImage ? [{ id: `ref-${Date.now()}`, type: 'image', url: referenceImage, stylePrompt: analysis }] : []
      };
      onCreatePost(newPost);
  };

  return (
    <div className="flex-1 p-8 bg-gray-950 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Sparkles className="text-purple-500"/> Campaign Generator
        </h2>
        <p className="text-gray-400 mb-8">Upload a product shot or reference image to auto-generate on-brand content ideas.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Upload & Analysis */}
            <div className="space-y-6">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer transition-all ${referenceImage ? 'border-purple-500 bg-gray-900' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-900'}`}
                >
                    {referenceImage ? (
                        <img src={referenceImage} className="h-full w-full object-contain rounded-lg p-2" alt="Reference" />
                    ) : (
                        <div className="text-center text-gray-500">
                            <Upload size={32} className="mx-auto mb-2" />
                            <p className="text-sm font-medium">Click to Upload Reference</p>
                            <p className="text-xs">JPG, PNG supported</p>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} accept="image/*" />
                </div>

                {isAnalyzing && (
                    <div className="flex items-center gap-2 text-purple-400 text-sm animate-pulse">
                        <Loader2 size={14} className="animate-spin"/> Analyzing visual features...
                    </div>
                )}

                {analysis && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Visual Analysis</h3>
                        <p className="text-sm text-gray-300 leading-relaxed">{analysis}</p>
                    </div>
                )}

                <Button 
                    size="lg" 
                    className="w-full" 
                    disabled={!analysis || isGeneratingIdeas} 
                    onClick={handleGenerateIdeas}
                >
                    {isGeneratingIdeas ? <Loader2 size={16} className="animate-spin mr-2"/> : <Lightbulb size={16} className="mr-2"/>}
                    {isGeneratingIdeas ? 'Brainstorming...' : 'Generate Concepts'}
                </Button>
            </div>

            {/* Right: Ideas Output */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Target size={18} className="text-blue-400"/> Generated Concepts
                </h3>
                
                {generatedIdeas.length === 0 && !isGeneratingIdeas && (
                    <div className="h-full border border-gray-800 rounded-xl bg-gray-900/50 flex flex-col items-center justify-center text-gray-600 p-8 text-center min-h-[300px]">
                        <ImageIcon size={48} className="mb-4 opacity-20"/>
                        <p>Upload an image to get started.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {generatedIdeas.map((idea, i) => (
                        <div key={i} className="bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-purple-500 transition-all group animate-in slide-in-from-right-4 fade-in" style={{ animationDelay: `${i*150}ms` }}>
                            <div className="flex justify-between items-start mb-2">
                                <h4 className="font-bold text-white text-lg">{idea.title}</h4>
                                <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 uppercase">{idea.platform}</span>
                            </div>
                            <p className="text-sm text-purple-300 mb-2 font-medium">Hook: "{idea.hook}"</p>
                            <p className="text-xs text-gray-400 mb-4">{idea.visual_desc}</p>
                            <Button size="sm" variant="secondary" className="w-full group-hover:bg-purple-600 group-hover:text-white transition-colors" onClick={() => convertToPost(idea)}>
                                Create Campaign <ArrowRight size={14} className="ml-2"/>
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
