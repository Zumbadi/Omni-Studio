
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ProjectType, FileNode } from '../types';
import { generateCodeResponse, critiqueCode, generateImage, generateSpeech, detectIntent, editImage, parseUICommand, generateFullCampaign } from '../services/geminiService';
import { findRelevantContext } from '../utils/projectAnalysis';
import { getAllFiles, findFileById, findNodeByPath, normalizePath } from '../utils/fileHelpers';
import { useDebounce } from './useDebounce';
import { extractSymbols, CodeSymbol } from '../utils/codeParser';
import { formatCode } from '../utils/formatCode';

interface UseOmniAssistantProps {
  projectId: string;
  projectType: ProjectType;
  files: FileNode[];
  activeFile: FileNode | undefined;
  activeModel: string;
  editorSelection: string;
  setEditorSelection: (sel: string) => void;
  onStartAgentTask?: (taskDescription: string) => void;
  runTests?: (files?: string[]) => Promise<any>;
  mcpContext?: string;
  onRunUICommand?: (cmd: string) => void;
}

export const useOmniAssistant = ({ 
  projectId, projectType, files, activeFile, activeModel, editorSelection, setEditorSelection, onStartAgentTask, runTests, mcpContext, onRunUICommand
}: UseOmniAssistantProps) => {
  const [chatInput, setChatInput] = useState('');
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
      const saved = localStorage.getItem(`omni_chat_${projectId}`);
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              return parsed.map((msg: any) => {
                  if (msg.critique) {
                      return {
                          ...msg,
                          critique: {
                              ...msg.critique,
                              issues: Array.isArray(msg.critique.issues) 
                                  ? msg.critique.issues.map((i: any) => 
                                      typeof i === 'object' ? (i.description || i.message || JSON.stringify(i)) : String(i)
                                  ) : [],
                              suggestions: Array.isArray(msg.critique.suggestions)
                                  ? msg.critique.suggestions.map((s: any) => 
                                      typeof s === 'object' ? (s.description || s.message || JSON.stringify(s)) : String(s)
                                  ) : [],
                              fixCode: (typeof msg.critique.fixCode === 'object' && msg.critique.fixCode !== null) 
                                  ? (msg.critique.fixCode.fixCode || msg.critique.fixCode.code || '') 
                                  : (msg.critique.fixCode || undefined)
                          }
                      };
                  }
                  return msg;
              });
          } catch (e) { 
              console.error("Failed to parse chat history", e); 
              return [];
          }
      }
      return [{
          id: 'init-welcome',
          role: 'model',
          text: `Hello! I am Omni-Studio. I've loaded your ${projectType} project. Active Model: ${activeModel}.\n\nI can help you generate code, refactor files, or run tests.\n\n**Try Slash Commands:**\n- \`/image [prompt]\` to generate assets\n- \`/search [query]\` for real-time answers\n- \`/map [location]\` for geographic info\n- \`/pipeline\` to run CI/CD\n- \`/agent [task]\` to auto-assign task\n- \`/docker\` to containerize app\n- **@Filename** to reference specific files`,
          timestamp: Date.now()
      }];
  });

  const debouncedHistory = useDebounce(chatHistory, 2000);

  useEffect(() => {
      if (projectId) {
          localStorage.setItem(`omni_chat_${projectId}`, JSON.stringify(debouncedHistory));
      }
  }, [debouncedHistory, projectId]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(window.innerWidth >= 1024);
  const [enableCritic, setEnableCritic] = useState(true);
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);

  const persistGeneratedAsset = (type: 'image' | 'video' | 'audio', url: string, description: string) => {
      try {
          const existing = JSON.parse(localStorage.getItem('omni_generated_assets') || '[]');
          const newAsset = {
              id: `gen-${Date.now()}`,
              type,
              url,
              description,
              date: new Date().toISOString()
          };
          localStorage.setItem('omni_generated_assets', JSON.stringify([newAsset, ...existing].slice(0, 100)));
          window.dispatchEvent(new Event('omniAssetsUpdated'));
      } catch (e) { console.error("Failed to persist asset", e); }
  };

  const runCritique = async (code: string, task: string) => {
      const criticRes = await critiqueCode(code, task);
      if (criticRes) {
          let fixCodeStr = criticRes.fixCode;
          if (fixCodeStr && typeof fixCodeStr === 'object') {
              fixCodeStr = (fixCodeStr as any).fixCode || (fixCodeStr as any).code || (fixCodeStr as any).content || '';
          }
          if (typeof fixCodeStr !== 'string') fixCodeStr = undefined;

          const normalizeList = (list: any[]) => {
              if (!Array.isArray(list)) return [];
              return list.map(item => {
                  if (typeof item === 'string') return item;
                  if (item && typeof item === 'object') {
                      return item.description || item.message || item.text || JSON.stringify(item);
                  }
                  return String(item);
              });
          };

          setChatHistory(prev => [...prev, {
              id: `critic-${Date.now()}`,
              role: 'critic',
              text: '', 
              timestamp: Date.now(),
              critique: {
                  score: criticRes.score || 75,
                  issues: normalizeList(criticRes.issues),
                  suggestions: normalizeList(criticRes.suggestions),
                  fixCode: fixCodeStr
              }
          }]);
      }
  };

  const triggerGeneration = async (prompt: string, useSearch = false, useMaps = false) => {
    setIsGenerating(true);
    const currentCode = activeFile?.content || '';
    const fileStructure = getAllFiles(files).map(f => f.path).join('\n');
    let responseText = '';
    
    let finalPrompt = prompt;
    
    // --- CONTEXT INJECTION START ---
    
    // 1. Referenced Code Selection
    if (editorSelection) {
        finalPrompt += `\n\n[Referenced Code Selection]:\n\`\`\`\n${editorSelection}\n\`\`\`\n`;
    }

    // 2. Explicit File Mentions (@src/App.tsx)
    const fileMentionRegex = /@\[([\w\-\/\.]*)\]/g;
    let match;
    const mentionedFiles = new Set<string>();
    
    while ((match = fileMentionRegex.exec(prompt)) !== null) {
        const path = match[1];
        const node = findNodeByPath(files, path);
        if (node && node.content && !mentionedFiles.has(node.id)) {
            mentionedFiles.add(node.id);
            finalPrompt += `\n\n[Context: ${node.name}]:\n\`\`\`${node.name.split('.').pop()}\n${node.content}\n\`\`\`\n`;
        }
    }

    // 3. Explicit Symbol Mentions (@[src/App.tsx:App])
    // The format matches selectMention in ChatWidget: @[file:symbol]
    const symbolMentionRegex = /@\[([\w\-\/\.]*):(\w+)\]/g;
    let symMatch;
    
    // We need to re-parse efficiently or reuse a parsed map. For simplicity in hook, we re-parse if needed
    // but typically we'd cache this.
    // However, findRelevantContext does keywords. Let's handle explicit symbols here.
    const symbols = extractSymbols(files);

    while ((symMatch = symbolMentionRegex.exec(prompt)) !== null) {
        const path = symMatch[1];
        const symName = symMatch[2];
        const symbol = symbols.find(s => s.name === symName && (s.fileName === path.split('/').pop() || s.fileName === path));
        
        if (symbol) {
             finalPrompt += `\n\n[Context Symbol: ${symbol.name} in ${symbol.fileName}]:\n\`\`\`typescript\n${symbol.content}\n\`\`\`\n`;
        }
    }

    // 4. Relevant Context (Auto-Discovery)
    const extraContext = findRelevantContext(files, prompt);
    if (extraContext) finalPrompt += `\n\n[Relevant Context]:${extraContext}`;

    // 5. Knowledge Base / MCP Context
    if (mcpContext) {
        finalPrompt += `\n\n[Knowledge Base / Project Rules]:\n${mcpContext}\n`;
    }

    // --- CONTEXT INJECTION END ---

    const tempId = 'temp-' + Date.now();
    setChatHistory(prev => [...prev, { id: tempId, role: 'model', text: '', timestamp: Date.now() }]);
    
    try {
        await generateCodeResponse(
          finalPrompt, currentCode, projectType, fileStructure, activeModel, 
          (chunk) => { responseText += chunk; setChatHistory(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: responseText } : msg)); },
          (metadata) => { if(metadata) setChatHistory(prev => prev.map(msg => msg.id === tempId ? { ...msg, groundingMetadata: metadata } : msg)); },
          attachedImage, chatHistory, useSearch, useMaps
        );
        
        if (enableCritic && !useSearch && !useMaps && responseText.length > 50) runCritique(responseText, finalPrompt);
    } catch (e: any) {
        console.error("Assistant Error", e);
        const errText = e?.message || "Unknown error";
        
        // Specific handling for 429/Quota errors thrown from service
        if (errText.includes('429') || errText.includes('Quota') || errText.includes('RESOURCE_EXHAUSTED')) {
             addSystemMessage("⚠️ **API Quota Exceeded**: You have reached the request limit. Please wait a moment or check your plan.");
        } else {
             addSystemMessage(`⚠️ Error: ${errText}`);
        }
    }
    
    setAttachedImage(undefined);
    setEditorSelection('');
    setIsGenerating(false);
  };

  const submitQuery = async (text: string) => {
    if (!text.trim()) return;
    
    setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'user' as const, text, timestamp: Date.now() }]);

    // Slash Commands logic
    if (text.startsWith('/')) {
        const [command, ...args] = text.split(' ');
        const argText = args.join(' ');

        if (command === '/image') {
            setIsGenerating(true);
            addSystemMessage(`Generating image for: "${argText}"...`);
            const imgUrl = await generateImage(argText);
            if (imgUrl) {
                persistGeneratedAsset('image', imgUrl, argText);
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
        
        if (command === '/search') {
             setIsGenerating(true);
             addSystemMessage(`Searching web for: "${argText}"...`);
             triggerGeneration(argText, true); 
             return;
        }

        if (command === '/map') {
             setIsGenerating(true);
             addSystemMessage(`Searching maps for: "${argText}"...`);
             triggerGeneration(argText, true, true);
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
                persistGeneratedAsset('image', imgUrl, `Edited: ${argText}`);
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
                persistGeneratedAsset('audio', audioUrl, `TTS: ${argText}`);
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
        
        if (command === '/campaign') {
            setIsGenerating(true);
            addSystemMessage(`Designing full media campaign for: "${argText}"...`);
            const post = await generateFullCampaign(argText);
            
            if (post) {
                // Persist new post to shared storage
                const existing = JSON.parse(localStorage.getItem('omni_social_posts') || '[]');
                localStorage.setItem('omni_social_posts', JSON.stringify([post, ...existing]));
                window.dispatchEvent(new Event('omniAssetsUpdated')); // Trigger Media Studio refresh
                
                setChatHistory(prev => [...prev, {
                    id: `camp-${Date.now()}`,
                    role: 'model',
                    text: `**Campaign Created:** "${post.title}"\n- Platform: ${post.platform}\n- Scenes: ${post.scenes?.length}\n\nOpen Media Studio to view and edit.`,
                    timestamp: Date.now()
                }]);
            } else {
                addSystemMessage("Failed to generate campaign.");
            }
            setIsGenerating(false);
            return;
        }
        
        if (command === '/test') {
             if (!runTests) {
                 addSystemMessage("Test runner not available.");
                 return;
             }
             setIsGenerating(true);
             addSystemMessage("Running test suite...");
             try {
                 const results = await runTests();
                 const passed = Object.values(results).filter((r: any) => r.status === 'pass').length;
                 const failed = Object.values(results).filter((r: any) => r.status === 'fail').length;
                 setChatHistory(prev => [...prev, {
                     id: `test-${Date.now()}`,
                     role: 'model',
                     text: `**Test Results:**\n- Passed: ${passed}\n- Failed: ${failed}\n\n${failed > 0 ? 'Check the Test Runner tab for details.' : 'All systems go!'}`,
                     timestamp: Date.now()
                 }]);
             } catch (e) {
                 addSystemMessage("Failed to run tests.");
             }
             setIsGenerating(false);
             return;
        }
        
        if (command === '/docker') {
             setIsGenerating(true);
             addSystemMessage("Analyzing dependencies to generate Docker configuration...");
             triggerGeneration("Generate a production-ready Dockerfile and docker-compose.yml for this project. Explain the build stages.");
             return;
        }
        
        if (command === '/pipeline' || command === '/deploy') {
             setChatHistory(prev => [...prev, {
                 id: `pipe-${Date.now()}`,
                 role: 'model',
                 text: `To run the ${command === '/deploy' ? 'Deployment' : 'CI/CD'} Pipeline, please use the **Deploy** tab in the right panel. It will visually guide you through Linting, Building, Testing, and Pushing containers.`,
                 timestamp: Date.now()
             }]);
             return;
        }
        
        if (command === '/refactor') {
             const instructions = argText || "Refactor this code to be cleaner and more efficient.";
             triggerGeneration(instructions);
             return;
        }

        if (command === '/fix') {
             const instructions = argText || "Analyze this code for bugs and fix them.";
             triggerGeneration(instructions);
             return;
        }

        if (command === '/explain') {
             const instructions = argText || "Explain what this code does in simple terms.";
             triggerGeneration(instructions);
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

        if (command === '/format') {
            if (!activeFile?.content) {
                addSystemMessage("No active file to format.");
                return;
            }
            
            setIsGenerating(true);
            try {
                // Local formatting heuristic
                const formatted = formatCode(activeFile.content);
                setChatHistory(prev => [...prev, {
                    id: `fmt-${Date.now()}`,
                    role: 'model',
                    text: `**Formatted ${activeFile.name}:**\n\`\`\`typescript\n// filename: ${activeFile.name}\n${formatted}\n\`\`\``,
                    timestamp: Date.now()
                }]);
            } catch (e) {
                addSystemMessage("Formatting failed.");
            }
            setIsGenerating(false);
            return;
        }
    }

    // Intent Detection for Agent Tasks or UI Commands
    if (onStartAgentTask || onRunUICommand) {
        setIsGenerating(true); 
        const intent = await detectIntent(text);
        setIsGenerating(false);
        
        if (intent === 'task' && onStartAgentTask) {
            onStartAgentTask(text);
            return;
        }

        if (intent === 'command' && onRunUICommand) {
            setIsGenerating(true);
            const uiCmd = await parseUICommand(text);
            setIsGenerating(false);
            
            if (uiCmd !== 'unknown') {
                onRunUICommand(uiCmd);
                addSystemMessage(`Executing: **${uiCmd.replace('_', ' ').toUpperCase()}**`);
                return;
            }
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
      submitQuery,
      handleCodeAction,
      handleAutoFix,
      addSystemMessage
  };
};
