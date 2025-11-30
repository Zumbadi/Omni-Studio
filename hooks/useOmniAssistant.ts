
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, ProjectType, FileNode } from '../types';
import { generateCodeResponse, critiqueCode, generateImage, generateSpeech, detectIntent, editImage } from '../services/geminiService';
import { findRelevantContext } from '../utils/projectAnalysis';
import { getAllFiles } from '../utils/fileHelpers';
import { useDebounce } from './useDebounce';

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
}

export const useOmniAssistant = ({ 
  projectId, projectType, files, activeFile, activeModel, editorSelection, setEditorSelection, onStartAgentTask, runTests
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
          text: `Hello! I am Omni-Studio. I've loaded your ${projectType} project. Active Model: ${activeModel}.\n\nI can help you generate code, refactor files, or run tests.\n\n**Try Slash Commands:**\n- \`/image [prompt]\` to generate assets\n- \`/search [query]\` for real-time answers\n- \`/pipeline\` to run CI/CD\n- \`/agent [task]\` to auto-assign task\n- \`/docker\` to containerize app`,
          timestamp: Date.now()
      }];
  });

  // Debounce history saving to prevent blocking UI during streaming updates
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

  const triggerGeneration = async (prompt: string, useSearch = false) => {
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
      (metadata) => { if(metadata) setChatHistory(prev => prev.map(msg => msg.id === tempId ? { ...msg, groundingMetadata: metadata } : msg)); },
      attachedImage, chatHistory, useSearch
    );
    
    if (enableCritic && !useSearch) runCritique(responseText, finalPrompt);
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
        
        if (command === '/search') {
             setIsGenerating(true);
             addSystemMessage(`Searching web for: "${argText}"...`);
             triggerGeneration(argText, true); // useSearch = true
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
             
             // Scan for dependencies
             const allFiles = getAllFiles(files);
             const packageJson = allFiles.find(f => f.node.name === 'package.json')?.node.content || '';
             
             const hasMongo = packageJson.includes('mongoose') || packageJson.includes('mongodb');
             const hasPostgres = packageJson.includes('pg') || packageJson.includes('sequelize') || packageJson.includes('typeorm');
             const hasRedis = packageJson.includes('redis');
             
             let dockerfileContent = "";
             let composeServices = "";
             
             if (projectType === ProjectType.NODE_API) {
                 dockerfileContent = `# Production Node.js Image
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`;
                 
                 composeServices = `  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development`;
                 
                 if (hasMongo) {
                     composeServices += `\n      - MONGO_URI=mongodb://mongo:27017/app\n    depends_on:\n      - mongo\n  mongo:\n    image: mongo:latest\n    ports:\n      - "27017:27017"`;
                 }
                 if (hasPostgres) {
                     composeServices += `\n      - DATABASE_URL=postgres://user:pass@postgres:5432/app\n    depends_on:\n      - postgres\n  postgres:\n    image: postgres:15\n    environment:\n      POSTGRES_USER: user\n      POSTGRES_PASSWORD: pass\n      POSTGRES_DB: app\n    ports:\n      - "5432:5432"`;
                 }
                 if (hasRedis) {
                     composeServices += `\n      - REDIS_URL=redis://redis:6379\n    depends_on:\n      - redis\n  redis:\n    image: redis:alpine\n    ports:\n      - "6379:6379"`;
                 }

             } else {
                 dockerfileContent = `# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
                 composeServices = `  web:
    build: .
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production`;
             }

             const composeContent = `version: '3.8'\nservices:\n${composeServices}`;

             const response = `Based on your **${projectType}** project and dependencies (${hasMongo ? 'MongoDB' : ''} ${hasPostgres ? 'PostgreSQL' : ''} ${hasRedis ? 'Redis' : ''}), here is your optimized Docker setup.\n\n` +
                `\`\`\`dockerfile\n// filename: Dockerfile\n${dockerfileContent}\n\`\`\`\n\n` +
                `\`\`\`yaml\n// filename: docker-compose.yml\n${composeContent}\n\`\`\``;
             
             setTimeout(() => {
                 setChatHistory(prev => [...prev, {
                     id: `docker-${Date.now()}`,
                     role: 'model',
                     text: response,
                     timestamp: Date.now()
                 }]);
                 setIsGenerating(false);
             }, 1500);
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
        
        if (command === '/help') {
            addSystemMessage(`**Available Commands:**\n- \`/image [prompt]\`\n- \`/search [query]\`\n- \`/pipeline\` (CI/CD)\n- \`/test\`\n- \`/docker\` (Containerize)\n- \`/refactor [notes]\`\n- \`/fix [notes]\`\n- \`/agent [task]\`: Delegate to AI Team\n- \`/clear\``);
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
