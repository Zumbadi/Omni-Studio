
import React, { useState } from 'react';
import { Book, Loader2, FileText, Save, Search, Globe, Link, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { generateProjectDocs, performResearch } from '../services/geminiService';
import { Project, FileNode } from '../types';
import { getAllFiles } from '../utils/fileHelpers';

interface DocsViewerProps {
  project: Project;
  files?: FileNode[]; // Pass files to generate real docs
  onSaveFile?: (path: string, content: string) => void;
}

export const DocsViewer: React.FC<DocsViewerProps> = ({ project, files, onSaveFile }) => {
  const [activeTab, setActiveTab] = useState<'project' | 'research'>('project');
  const [docContent, setDocContent] = useState<string>('');
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  
  // Research State
  const [researchTopic, setResearchTopic] = useState('');
  const [researchResult, setResearchResult] = useState<{ title: string, summary: string, keyPoints: string[], citations: { title: string, url: string }[] } | null>(null);
  const [isResearching, setIsResearching] = useState(false);

  const handleGenerateDocs = async () => {
      setIsGeneratingDocs(true);
      setDocContent('');
      
      // Construct real file structure string
      let fileStructure = "Project Structure:\n";
      if (files) {
          const allFiles = getAllFiles(files);
          // Limit to top 50 important files to fit context
          const structure = allFiles
            .filter(f => !f.path.includes('node_modules') && !f.path.includes('.git'))
            .slice(0, 50)
            .map(f => `- ${f.path}`)
            .join('\n');
          fileStructure += structure;
      } else {
          fileStructure += "(File tree unavailable)";
      }

      await generateProjectDocs(fileStructure, project.type, (chunk) => {
          setDocContent(prev => prev + chunk);
      });
      setIsGeneratingDocs(false);
  };

  const handleRunResearch = async () => {
      if (!researchTopic.trim()) return;
      setIsResearching(true);
      const result = await performResearch(researchTopic);
      setResearchResult(result);
      setIsResearching(false);
  };

  const handleSaveDoc = () => {
      if (onSaveFile && docContent) {
          onSaveFile('README.md', docContent);
          alert('Saved as README.md');
      }
  };

  const handleSaveResearch = () => {
      if (onSaveFile && researchResult) {
          const content = `# Research: ${researchResult.title}\n\n## Summary\n${researchResult.summary}\n\n## Key Takeaways\n${researchResult.keyPoints.map(p => `- ${p}`).join('\n')}\n\n## Sources\n${researchResult.citations.map(c => `- [${c.title}](${c.url})`).join('\n')}`;
          const filename = `docs/research_${researchTopic.replace(/\s+/g, '_').toLowerCase()}.md`;
          onSaveFile(filename, content);
          alert(`Saved to ${filename}`);
      }
  };

  return (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                  <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Book size={16} className="text-blue-400"/> Documentation</h2>
                  <div className="flex bg-gray-800 rounded p-0.5">
                      <button onClick={() => setActiveTab('project')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${activeTab === 'project' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Project Docs</button>
                      <button onClick={() => setActiveTab('research')} className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${activeTab === 'research' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>AI Research</button>
                  </div>
              </div>
              
              <div className="flex gap-2">
                  {activeTab === 'project' && docContent && onSaveFile && (
                      <Button size="sm" variant="secondary" onClick={handleSaveDoc}>
                          <Save size={14} className="mr-2"/> Save to README
                      </Button>
                  )}
                  {activeTab === 'research' && researchResult && onSaveFile && (
                      <Button size="sm" variant="secondary" onClick={handleSaveResearch}>
                          <Save size={14} className="mr-2"/> Save Report
                      </Button>
                  )}
                  {activeTab === 'project' && (
                      <Button size="sm" onClick={handleGenerateDocs} disabled={isGeneratingDocs}>
                          {isGeneratingDocs ? <Loader2 size={14} className="animate-spin mr-2"/> : <FileText size={14} className="mr-2"/>} Generate
                      </Button>
                  )}
              </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'project' ? (
                  docContent ? (
                      <article className="prose prose-invert prose-sm max-w-none animate-in fade-in">
                          <pre className="whitespace-pre-wrap font-sans text-gray-300">{docContent}</pre>
                      </article>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <Book size={48} className="opacity-20 mb-4"/>
                          <p className="text-sm">No documentation generated yet.</p>
                          <p className="text-xs opacity-60">Click Generate to analyze your project structure.</p>
                      </div>
                  )
              ) : (
                  <div className="h-full flex flex-col">
                      <div className="flex gap-2 mb-6">
                          <div className="relative flex-1">
                              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
                              <input 
                                  type="text" 
                                  placeholder="Enter topic (e.g. 'React Server Actions vs API Routes')..." 
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                  value={researchTopic}
                                  onChange={e => setResearchTopic(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleRunResearch()}
                              />
                          </div>
                          <Button onClick={handleRunResearch} disabled={isResearching || !researchTopic}>
                              {isResearching ? <Loader2 size={16} className="animate-spin mr-2"/> : <Globe size={16} className="mr-2"/>} Research
                          </Button>
                      </div>

                      {isResearching ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                              <Loader2 size={32} className="animate-spin mb-4 text-blue-500"/>
                              <p className="text-sm animate-pulse">Browsing the web for knowledge...</p>
                          </div>
                      ) : researchResult ? (
                          <div className="space-y-6 animate-in slide-in-from-bottom-4">
                              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                  <h2 className="text-xl font-bold text-white mb-4">{researchResult.title}</h2>
                                  <p className="text-gray-300 leading-relaxed text-sm mb-6">{researchResult.summary}</p>
                                  
                                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Key Takeaways</h3>
                                  <ul className="space-y-2 mb-6">
                                      {researchResult.keyPoints.map((point, i) => (
                                          <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                                              <ArrowRight size={14} className="mt-1 text-blue-400 shrink-0"/> {point}
                                          </li>
                                      ))}
                                  </ul>

                                  <div className="border-t border-gray-700 pt-4">
                                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Link size={12}/> Sources</h3>
                                      <div className="flex flex-wrap gap-2">
                                          {researchResult.citations.map((cite, i) => (
                                              <a 
                                                  key={i} 
                                                  href={cite.url} 
                                                  target="_blank" 
                                                  rel="noreferrer" 
                                                  className="text-xs bg-gray-900 hover:bg-black px-3 py-1.5 rounded border border-gray-700 text-blue-300 hover:text-blue-200 transition-colors flex items-center gap-1 max-w-xs truncate"
                                              >
                                                  {cite.title || cite.url}
                                              </a>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-gray-600 opacity-50">
                              <Globe size={48} className="mb-4"/>
                              <p className="text-sm">Enter a topic to start researching.</p>
                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>
  );
};
