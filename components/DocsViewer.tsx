import React, { useState } from 'react';
import { Book, Loader2, FileText } from 'lucide-react';
import { Button } from './Button';
import { generateProjectDocs } from '../services/geminiService';
import { Project } from '../types';

interface DocsViewerProps {
  project: Project;
}

export const DocsViewer: React.FC<DocsViewerProps> = ({ project }) => {
  const [docContent, setDocContent] = useState<string>('');
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);

  const handleGenerateDocs = async () => {
      setIsGeneratingDocs(true);
      setDocContent('');
      // Mock file structure for prompt - in reality would traverse file tree
      const fileStructure = `- src/\n  - App.tsx\n  - components/\n- package.json`;
      await generateProjectDocs(fileStructure, project.type, (chunk) => {
          setDocContent(prev => prev + chunk);
      });
      setIsGeneratingDocs(false);
  };

  return (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Book size={16} className="text-blue-400"/> Documentation</h2>
              <Button size="sm" onClick={handleGenerateDocs} disabled={isGeneratingDocs}>
                  {isGeneratingDocs ? <Loader2 size={14} className="animate-spin mr-2"/> : <FileText size={14} className="mr-2"/>} Generate
              </Button>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
              {docContent ? (
                  <article className="prose prose-invert prose-sm max-w-none animate-in fade-in">
                      <pre className="whitespace-pre-wrap font-sans text-gray-300">{docContent}</pre>
                  </article>
              ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <Book size={48} className="opacity-20 mb-4"/>
                      <p className="text-sm">No documentation generated yet.</p>
                      <p className="text-xs opacity-60">Click Generate to create a README.md</p>
                  </div>
              )}
          </div>
      </div>
  );
};