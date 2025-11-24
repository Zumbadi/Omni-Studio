
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ProjectType, FileNode } from '../types';
import { generateCodeResponse, critiqueCode, generateImage, generateSpeech, detectIntent, editImage } from '../services/geminiService';
import { findRelevantContext } from '../utils/projectAnalysis';
import { getAllFiles } from '../utils/fileHelpers';

interface UseOmniAssistantProps {
  projectId: string;
  projectType: ProjectType;
  files: FileNode[];
  activeFile: FileNode | undefined;
  activeModel: string;
  editorSelection: string;
  setEditorSelection: (sel: string) => void;
  onStartAgentTask?: (taskDescription: string) => void;
}

export const useOmniAssistant = ({ 
  projectId, projectType, files, activeFile, activeModel, editorSelection, setEditorSelection, onStartAgentTask
}: UseOmniAssistantProps) => {
  const [chatInput, setChatInput] = useState('');
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
      const saved = localStorage.getItem(`omni_chat_${projectId}`);
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) { console.error("Failed to parse chat history"); }
      }
      return [{
          id: 'init-welcome',
          role: 'model',
          text: `Hello! I am Omni-Studio. I've loaded your ${projectType} project. Active Model: ${activeModel}.\n\nI can help you generate code, refactor files, or run tests.\n\n**Try Slash Commands:**\n- \`/image [prompt]\` to generate assets\n- \`/tts [text]\` for speech synthesis\n- \`/agent [task]\` to auto-assign task`,
          timestamp: Date.now()
      }];
  });

  useEffect(() => {
      if (projectId) {
          localStorage.setItem(`omni_chat_${projectId}`, JSON.stringify(chatHistory));
      }
  }, [chatHistory, projectId]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(window.innerWidth >= 1024);
  const [enableCritic, setEnableCritic] = useState(true);
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);

  const runCritique = async (code: string, task: string) => {
      const criticRes = await critiqueCode(code, task);
      if (criticRes) {
          setChatHistory(prev => [...prev, {
              id: `critic-${Date.now()}`,
              role: 'critic',
              text: '', 
              timestamp: Date.now(),
              critique: {
                  score: criticRes.score || 75,
                  issues: criticRes.issues || [],
                  suggestions: criticRes.suggestions || [],
                  fixCode: criticRes.fixCode
              }
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

  const submitQuery = async (text: string) => {
    if (!text.trim()) return;
    
    setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'user' as const, text, timestamp: Date.now() }]);

    // Slash Commands
    if (text.startsWith('/')) {
        const [command, ...args] = text.split(' ');
        const argText = args.join(' ');

        if (command === '/image') {
            setIsGenerating(true);
            addSystemMessage(`Generating image for: "${argText}"...`);
            const imgUrl = await generateImage(argText);
            if (imgUrl) {
                setChatHistory(prev => [...prev, {
                    id: `img-${Date.now()}`,
                    role: 'model',
                    text: `Generated Image: ${argText}\n\n[Attached: image.png]`,
                    timestamp: Date.now(),
                    attachments: [{ type: 'image', url: imgUrl, name: argText }]
                }]);
            } else {
                addSystemMessage("Failed to generate image.");
            }
            setIsGenerating(false);
            return;
        }
        
        if (command === '/edit') {
            if (!attachedImage) {
                addSystemMessage("Please attach an image first to edit it.");
                return;
            }
            setIsGenerating(true);
            addSystemMessage(`Editing image with: "${argText}"...`);
            const imgUrl = await editImage(attachedImage, argText);
            if (imgUrl) {
                setChatHistory(prev => [...prev, {
                    id: `img-${Date.now()}`,
                    role: 'model',
                    text: `Edited Image: ${argText}\n\n[Attached: edited.png]`,
                    timestamp: Date.now(),
                    attachments: [{ type: 'image', url: imgUrl, name: 'edited.png' }]
                }]);
            } else {
                addSystemMessage("Failed to edit image.");
            }
            setAttachedImage(undefined);
            setIsGenerating(false);
            return;
        }

        if (command === '/tts') {
            setIsGenerating(true);
            addSystemMessage(`Synthesizing speech...`);
            const audioUrl = await generateSpeech(argText, { id: 'def', name: 'Default', gender: 'female', style: 'narrative', isCloned: false });
            if (audioUrl) {
                setChatHistory(prev => [...prev, {
                    id: `tts-${Date.now()}`,
                    role: 'model',
                    text: `Speech Output: "${argText}"`,
                    timestamp: Date.now(),
                    attachments: [{ type: 'audio', url: audioUrl, name: 'speech.wav' }]
                }]);
            } else {
                addSystemMessage("Failed to generate speech.");
            }
            setIsGenerating(false);
            return;
        }
        
        if (command === '/agent' || command === '/build') {
             if (onStartAgentTask) onStartAgentTask(argText);
             return;
        }

        if (command === '/clear') {
            setChatHistory([]);
            localStorage.removeItem(`omni_chat_${projectId}`);
            return;
        }
        
        if (command === '/help') {
            addSystemMessage(`**Available Commands:**\n- \`/image [prompt]\`\n- \`/edit [prompt]\` (requires attached image)\n- \`/tts [text]\`\n- \`/agent [task]\`: Delegate to AI Team\n- \`/clear\``);
            return;
        }
    }

    // Smart Intent Detection
    if (onStartAgentTask) {
        setIsGenerating(true); // Temporary spinner while thinking
        const intent = await detectIntent(text);
        setIsGenerating(false);
        
        if (intent === 'task') {
            onStartAgentTask(text);
            return;
        }
    }

    triggerGeneration(text);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitQuery(chatInput);
    setChatInput('');
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

  const handleAutoFix = (issues: string[]) => {
      const prompt = `Fix the following issues identified in the code review:\n- ${issues.join('\n- ')}\n\nPlease output the corrected code.`;
      triggerGeneration(prompt);
  };

  const addSystemMessage = (text: string) => {
      setChatHistory(prev => [...prev, {
          id: `sys-${Date.now()}`,
          role: 'model',
          text: `**Update:** ${text}`,
          timestamp: Date.now()
      }]);
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
      submitQuery, // Exposed for Voice
      handleCodeAction,
      handleAutoFix,
      addSystemMessage
  };
};
