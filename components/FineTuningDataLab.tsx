
import React, { useState } from 'react';
import { FlaskConical, Sparkles, FileJson, Database, Check, FileText, Scissors, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { generateSyntheticData } from '../services/geminiService';
import { Dataset } from '../types';

interface FineTuningDataLabProps {
  onSaveDataset: (ds: Dataset) => void;
}

export const FineTuningDataLab: React.FC<FineTuningDataLabProps> = ({ onSaveDataset }) => {
  const [mode, setMode] = useState<'synthetic' | 'parser'>('synthetic');
  
  // Synthetic State
  const [genTopic, setGenTopic] = useState('');
  const [genCount, setGenCount] = useState(10);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  
  // Parser State
  const [rawText, setRawText] = useState('');
  const [chunkSize, setChunkSize] = useState(500);
  
  // Output State
  const [generatedContent, setGeneratedContent] = useState('');

  const handleGenerateDataset = async () => {
      if(!genTopic) return;
      setIsGeneratingData(true);
      setGeneratedContent('');
      
      await generateSyntheticData(genTopic, genCount, (chunk) => {
          setGeneratedContent(prev => prev + chunk);
      });
      
      setIsGeneratingData(false);
  };

  const handleParseDocument = () => {
      if (!rawText) return;
      const chunks: any[] = [];
      let current = 0;
      while (current < rawText.length) {
          const textChunk = rawText.substr(current, chunkSize);
          chunks.push({
              messages: [
                  { role: 'system', content: 'You are a helpful assistant answering questions about the provided context.' },
                  { role: 'user', content: `Context: ${textChunk.substring(0, 50)}... (Summarize this)` },
                  { role: 'assistant', content: textChunk }
              ]
          });
          current += chunkSize;
      }
      const jsonl = chunks.map(c => JSON.stringify(c)).join('\n');
      setGeneratedContent(jsonl);
  };

  const handleSave = () => {
      if (!generatedContent) return;
      const name = mode === 'synthetic' ? `synth_${genTopic.replace(/\s+/g, '_')}` : `doc_parsed_${Date.now()}`;
      const desc = mode === 'synthetic' ? `Synthetic data for: ${genTopic}` : 'Parsed document chunks';
      
      const newDs: Dataset = {
          id: `ds-${Date.now()}`,
          name: `${name}.jsonl`,
          description: desc,
          format: 'jsonl',
          size: `${(generatedContent.length / 1024).toFixed(1)}KB`,
          content: generatedContent,
          created: 'Just now'
      };
      onSaveDataset(newDs);
      setGeneratedContent('');
      if (mode === 'synthetic') setGenTopic('');
      else setRawText('');
      alert("Dataset saved to library!");
  };

  return (
      <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Generator Panel */}
          <div className="w-1/3 bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col">
              <div className="mb-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><FlaskConical className="text-primary-500"/> Data Lab</h2>
                  <div className="flex gap-2 mt-4 bg-gray-900 p-1 rounded-lg">
                      <button onClick={() => setMode('synthetic')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${mode === 'synthetic' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Synthetic Gen</button>
                      <button onClick={() => setMode('parser')} className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${mode === 'parser' ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'}`}>Doc Parser</button>
                  </div>
              </div>
              
              <div className="space-y-4 flex-1 overflow-y-auto">
                  {mode === 'synthetic' ? (
                      <>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Topic / Domain</label>
                            <input 
                                type="text" 
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 focus:outline-none" 
                                placeholder="e.g. Python Error Handling..."
                                value={genTopic}
                                onChange={(e) => setGenTopic(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Example Count: {genCount}</label>
                            <input 
                                type="range" 
                                min="5" 
                                max="50" 
                                value={genCount} 
                                onChange={(e) => setGenCount(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                        </div>
                        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-xs text-blue-200">
                            <p className="flex items-start gap-2"><Sparkles size={14} className="mt-0.5 shrink-0"/> AI will generate diverse Q&A pairs for this topic.</p>
                        </div>
                      </>
                  ) : (
                      <>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Document Text</label>
                            <textarea 
                                className="w-full h-48 bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:border-primary-500 focus:outline-none text-xs font-mono" 
                                placeholder="Paste documentation, logs, or articles here..."
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Chunk Size (Chars): {chunkSize}</label>
                            <input 
                                type="range" 
                                min="100" 
                                max="2000" 
                                step="100"
                                value={chunkSize} 
                                onChange={(e) => setChunkSize(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>
                        <div className="bg-purple-900/20 border border-purple-800 rounded-lg p-4 text-xs text-purple-200">
                            <p className="flex items-start gap-2"><Scissors size={14} className="mt-0.5 shrink-0"/> Text will be split into {Math.ceil(rawText.length / chunkSize) || 0} chunks for training.</p>
                        </div>
                      </>
                  )}
              </div>

              <Button size="lg" className="w-full mt-6" onClick={mode === 'synthetic' ? handleGenerateDataset : handleParseDocument} disabled={mode === 'synthetic' ? (!genTopic || isGeneratingData) : !rawText}>
                  {mode === 'synthetic' ? (isGeneratingData ? 'Synthesizing...' : 'Generate Data') : 'Parse Document'}
                  {isGeneratingData ? <Sparkles size={16} className="ml-2 animate-spin" /> : <ArrowRightIcon size={16} className="ml-2" />}
              </Button>
          </div>

          {/* Output Panel */}
          <div className="flex-1 bg-gray-950 rounded-xl border border-gray-700 flex flex-col overflow-hidden relative">
              <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><FileJson size={14}/> Output Preview</span>
                  <div className="flex gap-2">
                      <button className="text-gray-500 hover:text-white" onClick={() => navigator.clipboard.writeText(generatedContent)} title="Copy"><Check size={14}/></button>
                      <Button size="sm" variant="secondary" onClick={handleSave} disabled={!generatedContent}>Save to Library</Button>
                  </div>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                  {generatedContent ? (
                      <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{generatedContent}</pre>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-600">
                          <Database size={48} className="mb-4 opacity-20" />
                          <p className="text-sm">Generated data will appear here.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
  );
};

const ArrowRightIcon = ({size, className}: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
);
