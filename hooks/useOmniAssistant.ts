
import React, { useState, useEffect } from 'react';
import { ChatMessage, ProjectType, FileNode } from '../types';
import { generateCodeResponse, critiqueCode } from '../services/geminiService';
import { findRelevantContext } from '../utils/projectAnalysis';
import { getAllFiles } from '../utils/fileHelpers';

interface UseOmniAssistantProps {
  projectType: ProjectType;
  files: FileNode[];
  activeFile: FileNode | undefined;
  activeModel: string;
  editorSelection: string;
  setEditorSelection: (sel: string) => void;
}

export const useOmniAssistant = ({ 
  projectType, files, activeFile, activeModel, editorSelection, setEditorSelection 
}: UseOmniAssistantProps) => {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [enableCritic, setEnableCritic] = useState(true);
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);

  const runCritique = async (code: string, task: string) => {
      const criticRes = await critiqueCode(code, task);
      if (criticRes) {
          setChatHistory(prev => [...prev, {
              id: `critic-${Date.now()}`,
              role: 'critic',
              text: `Omni-Critic Review (Score: ${criticRes.score}/100)`,
              timestamp: Date.now(),
              critique: criticRes
          }]);
      }
  };

  const triggerGeneration = async (prompt: string) => {
    setIsGenerating(true);
    const currentCode = activeFile?.content || '';
    const fileStructure = getAllFiles(files).map(f => f.path).join('\n');
    let responseText = '';
    
    let finalPrompt = prompt;
    if (editorSelection) finalPrompt += `\n\n[Referenced Code Selection]:\n\`\`\`\n${editorSelection}\n\`\`\`\n`;
    const extraContext = findRelevantContext(files, prompt);
    if (extraContext) finalPrompt += `\n\n[Relevant Context]:${extraContext}`;

    const tempId = 'temp-' + Date.now();
    setChatHistory(prev => [...prev, { id: tempId, role: 'model', text: '', timestamp: Date.now() }]);
    
    await generateCodeResponse(
      finalPrompt, currentCode, projectType, fileStructure, activeModel, 
      (chunk) => { responseText += chunk; setChatHistory(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: responseText } : msg)); },
      attachedImage, chatHistory
    );
    
    if (enableCritic) runCritique(responseText, finalPrompt);
    setAttachedImage(undefined);
    setEditorSelection('');
    setIsGenerating(false);
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newUserMsg = { id: Date.now().toString(), role: 'user' as const, text: chatInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');
    triggerGeneration(newUserMsg.text);
  };

  const handleCodeAction = (action: string, selectedCode: string) => {
      const fileContext = activeFile ? ` in ${activeFile.name}` : '';
      let prompt = '';
      if (action === 'Explain') prompt = `Explain this code${fileContext}:\n\n${selectedCode}`;
      if (action === 'Refactor') prompt = `Refactor this code${fileContext} to be cleaner and more efficient:\n\n${selectedCode}`;
      if (action === 'Fix') prompt = `Find and fix any potential bugs in this code${fileContext}:\n\n${selectedCode}`;
      setChatInput(prompt);
      setIsChatOpen(true);
      triggerGeneration(prompt);
  };

  return {
      chatInput, setChatInput,
      chatHistory, setChatHistory,
      isGenerating,
      isChatOpen, setIsChatOpen,
      enableCritic, setEnableCritic,
      attachedImage, setAttachedImage,
      triggerGeneration,
      handleChatSubmit,
      handleCodeAction
  };
};
