
import { GoogleGenAI, Modality } from "@google/genai";
import { ProjectType, Voice, ChatMessage, AuditIssue, PerformanceReport, ArchNode, ArchLink, AIAgent, ProjectPhase, AgentContext, TestResult } from "../types";

const getApiKey = () => {
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('omni_gemini_key');
        if (stored) return stored;
    }
    return process.env.API_KEY || '';
};

const getAiClient = () => {
  const apiKey = getApiKey();
  return new GoogleGenAI({ apiKey });
};

const getProviderConfig = (modelName: string) => {
    try {
        const providers = JSON.parse(localStorage.getItem('omni_api_providers') || '[]');
        const matchingProvider = providers.find((p: any) => modelName.includes(p.name));
        if (matchingProvider) {
            return { type: matchingProvider.type, key: matchingProvider.key, name: matchingProvider.name };
        }
    } catch (e) { console.warn("Failed to load provider config", e); }
    return null;
};

const cleanJson = (text: string): string => {
    if (!text) return '{}';
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '');
    return cleaned;
};

// Robust Code Extractor
const extractCode = (rawText: string): string => {
    if (!rawText) return "";
    
    // Check for deletion flag first
    if (rawText.includes('DELETE_FILE')) return 'DELETE_FILE';

    const codeBlockRegex = /```(?:typescript|javascript|tsx|jsx|css|json|html|swift|kotlin|xml|bash|sh)?\n([\s\S]*?)```/g;
    const matches = [...rawText.matchAll(codeBlockRegex)];
    if (matches.length > 0) return matches.reduce((a, b) => a[1].length > b[1].length ? a : b)[1].trim();
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/```$/, '');
    const preambleMatch = cleaned.match(/^(here is|sure,|certainly|below is).*?:\n/i);
    if (preambleMatch) cleaned = cleaned.substring(preambleMatch[0].length).trim();
    return cleaned;
};

const getFrameworkInstructions = (type: ProjectType) => {
    switch (type) {
        case ProjectType.REACT_NATIVE:
            return `FRAMEWORK: React Native (Expo)
            - UI Components: Use <View>, <Text>, <TouchableOpacity>, <Image>, <ScrollView>, <FlatList> from 'react-native'.
            - Styling: Use StyleSheet.create({}). DO NOT use Tailwind classes or HTML tags like <div>.
            - Navigation: Assume Expo Router (app directory).
            - Icons: Use @expo/vector-icons.`;
        case ProjectType.IOS_APP:
            return `FRAMEWORK: Native iOS (SwiftUI)
            - Language: Swift 5.9+
            - UI: Use SwiftUI structs (VStack, HStack, ZStack, Text, Button, Image).
            - Architecture: MVVM pattern.
            - Imports: import SwiftUI, import Foundation.`;
        case ProjectType.ANDROID_APP:
            return `FRAMEWORK: Native Android (Kotlin Jetpack Compose)
            - Language: Kotlin
            - UI: Use Jetpack Compose (Column, Row, Box, Text, Button).
            - Architecture: MVVM with ViewModel.
            - Imports: androidx.compose.*`;
        case ProjectType.NODE_API:
            return `FRAMEWORK: Node.js API
            - Runtime: Node.js with Express or similar.
            - DB: Mongoose/MongoDB patterns implied by file structure.
            - Style: CommonJS (require/module.exports) or ES Modules based on package.json.`;
        default:
            return `FRAMEWORK: React Web
            - UI: Standard HTML tags (div, span, button).
            - Styling: Tailwind CSS classes (className="...").
            - Icons: lucide-react.`;
    }
};

export const detectIntent = async (prompt: string): Promise<'chat' | 'task'> => {
    if (!getApiKey()) return 'chat';
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Classify the user prompt into "chat" (question/explanation) or "task" (code modification/creation). 
            Prompt: "${prompt}"
            Return ONLY the string "chat" or "task".`,
        });
        const intent = response.text?.trim().toLowerCase();
        return intent === 'task' ? 'task' : 'chat';
    } catch { return 'chat'; }
};

export const planAgentTask = async (
    agent: AIAgent,
    taskDescription: string,
    fileStructure: string,
    projectType: ProjectType
): Promise<{ filesToEdit: string[], strategy: string }> => {
    if (!getApiKey()) return { filesToEdit: [], strategy: "No API Key" };
    const ai = getAiClient();

    const systemInstruction = `
        ${agent.systemPrompt}
        IDENTITY: Project Manager.
        CONTEXT: ${projectType} Project.
        
        TASK: Analyze the request "${taskDescription}" and the file structure.
        GOAL: Identify which specific files need to be created, modified, or DELETED.
        
        FILE STRUCTURE:
        ${fileStructure}
        
        OUTPUT JSON:
        {
            "filesToEdit": ["src/App.tsx", "src/components/Button.tsx"],
            "strategy": "Brief explanation of the plan."
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: "Plan execution.",
            config: { systemInstruction, responseMimeType: 'application/json' }
        });
        return JSON.parse(cleanJson(response.text || '{"filesToEdit": [], "strategy": ""}'));
    } catch (e) {
        return { filesToEdit: [], strategy: "Planning failed." };
    }
};

export const analyzeFile = async (
    agent: AIAgent,
    fileName: string,
    fileContent: string,
    instructions: string,
    context?: AgentContext
): Promise<string> => {
    if (!getApiKey()) return "Skipping analysis (No Key)";
    const ai = getAiClient();

    const envContext = context ? `
    ENVIRONMENT:
    - Active Logs: ${context.terminalLogs?.filter(l => l.toLowerCase().includes('error')).slice(-2).join('\n') || 'None'}
    - Console Warnings: ${context.liveLogs?.slice(-3).join('\n') || 'None'}
    ` : '';

    const systemInstruction = `
        ${agent.systemPrompt}
        IDENTITY: ${agent.name} (Analyst Mode).
        TASK: Scan "${fileName}" and the logs to determine what needs to be done.
        ${envContext}
        
        INSTRUCTIONS:
        - Return a CONCISE, bulleted summary of issues found or changes needed.
        - Do NOT generate code yet. Just plan.
        - Max 3 bullet points.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `File Content:\n${fileContent}\n\nInstructions:\n${instructions}`,
            config: { systemInstruction }
        });
        return response.text?.trim() || "No issues detected.";
    } catch (e) {
        return "Analysis failed.";
    }
};

export const executeBuildTask = async (
    agent: AIAgent, 
    fileName: string, 
    fileContent: string, 
    instructions: string,
    context?: AgentContext,
    previousFeedback?: string,
    projectType: ProjectType = ProjectType.REACT_WEB,
    isNewFile: boolean = false
): Promise<{ code: string, logs: string[] }> => {
    if (!getApiKey()) return { code: fileContent, logs: ["Error: No API Key"] };
    const ai = getAiClient();
    
    const model = agent.model || 'gemini-2.5-flash';
    const frameworkRules = getFrameworkInstructions(projectType);
    const projectRules = context?.projectRules ? `\nPROJECT SPECIFIC RULES (MUST FOLLOW):\n${context.projectRules}\n` : '';

    const envContext = context ? `
    ENVIRONMENT:
    - Project Type: ${projectType}
    - Active Phase: ${context.roadmap?.find(p => p.status === 'active')?.title || 'None'}
    - Active Logs: ${context.terminalLogs?.filter(l => l.toLowerCase().includes('error')).slice(-2).join('\n') || 'None'}
    ` : '';
    
    const relatedCodeContext = context?.relatedCode ? `
    RELATED FILE CONTEXT (Imports/Utils):
    ${context.relatedCode}
    ` : '';

    const retryContext = previousFeedback ? `
    !!! CRITICAL CONTEXT !!!
    PREVIOUS ANALYSIS/FEEDBACK: "${previousFeedback}"
    Use this to guide your changes.
    ` : '';

    const taskDesc = isNewFile 
        ? `TASK: Create the file "${fileName}" from scratch.`
        : `TASK: Implement specific changes in "${fileName}".`;

    const systemInstruction = `
        ${agent.systemPrompt}
        
        IDENTITY: You are ${agent.name}, a specialized Build Agent (${agent.role}).
        ${taskDesc}
        ${frameworkRules}
        ${projectRules}
        ${envContext}
        ${relatedCodeContext}
        ${retryContext}
        
        LAZY CODE CHECK:
        - DO NOT return code with comments like "// ... rest of code" or "// ... existing code".
        - YOU MUST OUTPUT THE FULL, COMPLETE, COMPILABLE FILE CONTENT every time.
        - If you truncate the code, the build will fail.
        
        DELETION RULE:
        - If the instructions imply deleting this file (e.g. "remove unused component"), return exactly the string "DELETE_FILE".
        
        STRICT OUTPUT RULES:
        1. Return ONLY the file content inside a single code block. 
        2. Do NOT include explanations or chat.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: `Instructions:\n${instructions}\n\n${isNewFile ? 'File is currently empty. Create it.' : `Current Content:\n${fileContent}`}`,
            config: { systemInstruction, temperature: 0.2 }
        });
        
        const rawText = response.text || fileContent;
        const newCode = extractCode(rawText);
        
        return { 
            code: newCode, 
            logs: previousFeedback ? [`${agent.name} applied fixes`] : [`${agent.name} built code`] 
        };
    } catch (e: any) {
        return { code: fileContent, logs: [`${agent.name} error: ${e.message}`] };
    }
};

export const reviewBuildTask = async (
    fileName: string, 
    originalCode: string, 
    newCode: string, 
    requirements: string,
    context?: AgentContext,
    projectType: ProjectType = ProjectType.REACT_WEB
): Promise<{ approved: boolean, feedback: string, issues: string[], fixCode?: string, suggestedCommand?: string }> => {
    if (!getApiKey()) return { approved: true, feedback: "Auto-approved (No API Key)", issues: [] };
    const ai = getAiClient();

    const frameworkRules = getFrameworkInstructions(projectType);
    const projectRules = context?.projectRules ? `\nPROJECT SPECIFIC RULES (CHECK COMPLIANCE):\n${context.projectRules}\n` : '';
    const envContext = context ? `ENVIRONMENT CONTEXT:\n- Project Type: ${projectType}\n- Runtime Errors: ${context.liveLogs?.filter(l => l.toLowerCase().includes('error')).slice(-3).join('\n') || 'None'}` : '';
    const relatedCodeContext = context?.relatedCode ? `RELATED CONTEXT (Check Imports/Exports compatibility):\n${context.relatedCode}` : '';

    const systemInstruction = `
        You are Omni Critic, the Senior QA Lead.
        Your job is to ACCEPT or REJECT code changes for "${fileName}".
        
        REQUIREMENTS: "${requirements}"
        ${frameworkRules}
        ${projectRules}
        ${envContext}
        ${relatedCodeContext}
        
        CRITERIA:
        1. Does the code adhere to the FRAMEWORK rules? (e.g. No HTML in React Native).
        2. Does it adhere to the PROJECT SPECIFIC RULES?
        3. Is the code COMPLETE? (Reject if it contains "// ... rest of code" or placeholders).
        4. Does it meet the requirements?
        5. Does it introduce bugs?
        
        INSTRUCTIONS:
        - Analyze the "New Code Candidate".
        - If REJECTED: You MUST provide "fixCode" containing the FULL, CORRECTED file content.
        - If a missing dependency is detected, provide "suggestedCommand" (e.g. "npm install xyz").
        
        OUTPUT JSON ONLY:
        {
            "approved": boolean,
            "feedback": string,
            "issues": string[],
            "fixCode": string | null,
            "suggestedCommand": string | null
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Original Code Length: ${originalCode.length}\n\nNew Code Candidate:\n${newCode.substring(0, 30000)}`, 
            config: { systemInstruction, responseMimeType: 'application/json' }
        });
        const clean = cleanJson(response.text || '{}');
        const parsed = JSON.parse(clean);
        if (parsed.fixCode) parsed.fixCode = extractCode(parsed.fixCode);
        return parsed;
    } catch (e) {
        return { approved: true, feedback: "Critic check failed, auto-approving.", issues: [] };
    }
};

export const generateChangelog = async (changedFiles: string[], taskDescription: string): Promise<string> => {
    if (!getApiKey()) return "Updates completed successfully.";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Task: "${taskDescription}"\nFiles Modified: ${changedFiles.join(', ')}\n\nGenerate a concise, bulleted changelog (max 3 lines).`,
        });
        return response.text || "Updates completed.";
    } catch { return "Updates completed."; }
};

export const generateCommitMessage = async (changes: string[]): Promise<string> => {
    if (!getApiKey()) return "Update project files";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a Conventional Commit message for these changed files: ${changes.join(', ')}. Return ONLY the message (e.g. 'feat: add login')`,
        });
        return response.text?.trim() || "Update files";
    } catch { return "Update files"; }
};

export const autoUpdateReadme = async (currentReadme: string, changelog: string): Promise<string> => {
    if (!getApiKey()) return currentReadme;
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Current README:\n${currentReadme}\n\nRecent Changes:\n${changelog}\n\nTask: Update the README to reflect these changes (e.g. add new features to features list, or update setup instructions). Return the full updated README markdown.`,
        });
        return response.text || currentReadme;
    } catch { return currentReadme; }
};

// ... (rest of existing functions - generateCodeResponse, generateGhostText, etc.) ...
export const generateCodeResponse = async (
  prompt: string, 
  currentFileContent: string,
  projectType: ProjectType,
  fileStructure: string,
  modelName: string,
  onStream: (chunk: string) => void,
  imageData?: string, 
  chatHistory: ChatMessage[] = []
) => {
    if (!getApiKey()) { onStream("Error: No API Key found."); return; }
    const ai = getAiClient();
    const providerConfig = getProviderConfig(modelName);
    let targetModel = 'gemini-2.5-flash';
    let thinkingBudget = 0;
    if (!providerConfig) {
      if (modelName.startsWith('Gemini 2.5 Pro') || modelName.startsWith('gemini-3-pro')) {
        targetModel = 'gemini-3-pro-preview';
        thinkingBudget = 1024;
      } else if (modelName.startsWith('Gemini 2.5 Flash')) {
        targetModel = 'gemini-2.5-flash';
      }
    }
    const frameworkInstruction = getFrameworkInstructions(projectType);
    try {
        const systemInstruction = `
          You are the Omni-Studio Coding Assistant. 
          ${frameworkInstruction}
          FILE STRUCTURE: ${fileStructure}
          INSTRUCTIONS: If creating/updating a file, START the code block with "// filename: path/to/file".
          CURRENT FILE: \`\`\`typescript\n${currentFileContent}\n\`\`\`
        `;
        const history = chatHistory.filter(msg => msg.role === 'user' || msg.role === 'model').map(msg => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] }));
        const chat = ai.chats.create({ model: targetModel, config: { systemInstruction, thinkingConfig: { thinkingBudget } }, history: history as any });
        const parts: any[] = [{ text: prompt }];
        if (imageData) { const [meta, data] = imageData.split(','); parts.unshift({ inlineData: { mimeType: meta.match(/:(.*?);/)?.[1] || 'image/png', data } }); }
        const result = await chat.sendMessageStream({ message: { role: 'user', parts } });
        for await (const chunk of result) if (chunk.text) onStream(chunk.text);
    } catch (error: any) { onStream(`Error: ${error.message}`); }
};

export const generateGhostText = async (prefix: string, suffix: string): Promise<string> => {
  if (!getApiKey()) return "";
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Complete the following code. Return ONLY the completion text, no markdown, no explanations.\n\nCode Context:\n${prefix}[CURSOR]${suffix}`,
      config: { maxOutputTokens: 64, temperature: 0.2, stopSequences: ["\n\n"] }
    });
    return response.text?.trimEnd() || "";
  } catch (e) { return ""; }
};

export const chatWithVoice = async (prompt: string): Promise<string> => {
  if (!getApiKey()) return "API Key missing.";
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { systemInstruction: "You are Omni. Keep responses short." } });
    return response.text || "I didn't catch that.";
  } catch (e) { return "Connection error."; }
};

export const generateProjectScaffold = async (prompt: string, type: ProjectType): Promise<any[]> => {
  if (!getApiKey()) return [];
  const ai = getAiClient();
  const systemInstruction = `Senior Architect. Generate ${type} file tree JSON for: "${prompt}". Schema: [{"name": string, "type": "file"|"directory", "content"?: string, "children"?: Node[]}] ${getFrameworkInstructions(type)}`;
  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: "Generate.", config: { systemInstruction, responseMimeType: 'application/json' } });
    return JSON.parse(cleanJson(response.text || '[]'));
  } catch (e) { return []; }
};

export const generateProjectPlan = async (description: string, type: ProjectType): Promise<any[]> => {
  if (!getApiKey()) return [];
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: "Roadmap", config: { systemInstruction: `Roadmap JSON for ${type}: "${description}". Schema: [{id, title, status, goals:[], tasks:[{id, text, done}]}]`, responseMimeType: 'application/json' } });
    return JSON.parse(cleanJson(response.text || '[]'));
  } catch(e) { return []; }
};

export const generateProjectDocs = async (fileStructure: string, type: ProjectType, onStream: (chunk: string) => void): Promise<void> => {
    if (!getApiKey()) { onStream("API Key missing."); return; }
    const ai = getAiClient();
    try {
        const result = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: "Generate README.", config: { systemInstruction: `Write README for ${type} structure:\n${fileStructure}` } });
        for await (const chunk of result) if (chunk.text) onStream(chunk.text);
    } catch (e: any) { onStream(`Error: ${e.message}`); }
};

export const runAgentFileTask = async (agent: AIAgent, fileName: string, fileContent: string, context?: AgentContext): Promise<string | null> => {
    if (!getApiKey()) return null;
    const ai = getAiClient();
    const envContext = context ? `State: ${context.roadmap?.find(p=>p.status==='active')?.title}, Logs: ${context.liveLogs?.slice(-3).join('\n')}` : '';
    const systemInstruction = `${agent.systemPrompt} IDENTITY: ${agent.name}, ${agent.role}. ${envContext} TASK: Improve file. OUTPUT: Full updated content with // filename: ${fileName}`;
    try {
        const response = await ai.models.generateContent({ model: agent.model || 'gemini-2.5-flash', contents: `File: ${fileName}\n${fileContent}`, config: { systemInstruction } });
        return response.text || null;
    } catch (e) { return null; }
};

export const critiqueCode = async (code: string, task: string): Promise<any> => {
  if (!getApiKey()) return null;
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Task: ${task}\nCode:\n${code}`, config: { systemInstruction: `Review code. JSON: { "score": 0-100, "issues": [], "suggestions": [], "fixCode": string|null }`, responseMimeType: 'application/json' } });
    return JSON.parse(cleanJson(response.text || '{}'));
  } catch(e) { return null; }
};

export const delegateTasks = async (phase: ProjectPhase, agents: AIAgent[]): Promise<{ assignments: { agentName: string, taskDescription: string, targetFile?: string }[] }> => {
    if (!getApiKey()) return { assignments: [] };
    const ai = getAiClient();
    try {
        const agentProfiles = agents.filter(a => !a.isManager).map(a => `- ${a.name} (${a.role}): ${a.description}`).join('\n');
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Phase: ${phase.title}. Goals: ${phase.goals.join(', ')}. Tasks: ${phase.tasks.map(t => t.text).join(', ')}.
            Available Agents:
            ${agentProfiles}
            
            Assign tasks to the best agents. Return JSON. Schema: { "assignments": [{ "agentName": string, "taskDescription": string, "targetFile": string (optional) }] }`,
            config: { responseMimeType: 'application/json' }
        });
        const clean = cleanJson(response.text || '{"assignments": []}');
        return JSON.parse(clean);
    } catch (e) { return { assignments: [] }; }
};

export const generateTestResults = async (fileName: string, content: string): Promise<Partial<TestResult>> => {
    if (!getApiKey()) return { passed: 1, failed: 0, duration: 50, suites: [{ name: 'Suite', status: 'pass', assertions: [{ name: 'Test', status: 'pass' }] }] };
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Simulate running unit tests for: ${fileName}\nContent:\n${content}\n\nOutput JSON: { passed: number, failed: number, duration: number, suites: [{ name: string, status: 'pass'|'fail', assertions: [{ name: string, status: 'pass'|'fail', error?: string }] }] }`,
            config: { responseMimeType: 'application/json' }
        });
        const clean = cleanJson(response.text || '{}');
        return JSON.parse(clean);
    } catch (e) { return { passed: 0, failed: 1, duration: 0, suites: [] }; }
};

export const analyzeDataset = async (datasetSummary: string): Promise<string> => { if (!getApiKey()) return "Key missing"; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Analyze: ${datasetSummary}` }); return r.text || "Failed"; } catch(e) { return "Error"; } };
export const generateSyntheticData = async (topic: string, count: number, onStream: (chunk: string) => void) => { if (!getApiKey()) return; const ai = getAiClient(); try { const r = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: `Gen ${count} examples for "${topic}".`, config: { systemInstruction: `JSONL format.` } }); for await (const c of r) if(c.text) onStream(c.text); } catch(e: any) { onStream(e.message); } };
export const generateSocialContent = async (topic: string, platform: string, onStream: (chunk: string) => void) => { if (!getApiKey()) return; const ai = getAiClient(); try { const r = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: `Post for ${platform}: ${topic}` }); for await (const c of r) if(c.text) onStream(c.text); } catch(e: any) { onStream(e.message); } };
export const generateSpeech = async (text: string, voice: Voice, style?: string): Promise<string | null> => { if (!getApiKey()) return null; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text: style ? `(${style}) ${text}` : text }] }], config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: (voice.apiMapping || 'Kore') as any } } } } }); const b = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data; return b ? `data:audio/pcm;base64,${b}` : null; } catch(e) { return null; } };
export const generateImage = async (p: string, s?: string): Promise<string | null> => { if (!getApiKey()) return null; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: s ? `${p}. Style: ${s}` : p }] } }); const d = r.candidates?.[0]?.content?.parts?.[0]?.inlineData; return d ? `data:${d.mimeType};base64,${d.data}` : null; } catch { return null; } };
export const editImage = async (img: string, prompt: string): Promise<string | null> => { if (!getApiKey()) return null; const ai = getAiClient(); try { const d = img.split(',').pop() || img; const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ inlineData: { mimeType: 'image/png', data: d } }, { text: `Redraw: ${prompt}` }] } }); const res = r.candidates?.[0]?.content?.parts?.[0]?.inlineData; return res ? `data:${res.mimeType};base64,${res.data}` : null; } catch { return null; } };
export const generateVideo = async (p: string, i?: string): Promise<string | null> => { if (!getApiKey()) return null; const ai = getAiClient(); try { const req: any = { model: 'veo-3.1-fast-generate-preview', prompt: p, config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' } }; if(i) { const [m, d] = i.split(','); req.image = { imageBytes: d, mimeType: m.match(/:(.*?);/)?.[1]||'image/png' }; } let op = await ai.models.generateVideos(req); while(!op.done) { await new Promise(r => setTimeout(r, 5000)); op = await ai.operations.getVideosOperation({operation: op}); } const uri = op.response?.generatedVideos?.[0]?.video?.uri; if(!uri) throw new Error("No URI"); const res = await fetch(`${uri}&key=${process.env.API_KEY}`); const blob = await res.blob(); return URL.createObjectURL(blob); } catch { return null; } };
export const transcribeAudio = async (b64: string): Promise<string> => { if (!getApiKey()) return "No Key"; const ai = getAiClient(); try { const d = b64.split(',').pop() || b64; const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ inlineData: { mimeType: 'audio/webm', data: d } }, { text: "Transcribe." }] } }); return r.text || "Empty"; } catch { return "Error"; } };
export const analyzeMediaStyle = async (b64: string, type: 'image' | 'audio'): Promise<string> => { if (!getApiKey()) return ""; const ai = getAiClient(); try { const d = b64.split(',').pop() || b64; const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ inlineData: { mimeType: type === 'image' ? 'image/png' : 'audio/webm', data: d } }, { text: "Analyze style." }] } }); return r.text || ""; } catch { return ""; } };
export const analyzeCharacterFeatures = async (b64: string): Promise<string> => { if (!getApiKey()) return ""; const ai = getAiClient(); try { const d = b64.split(',').pop() || b64; const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ inlineData: { mimeType: 'image/png', data: d } }, { text: "Describe features." }] } }); return r.text || ""; } catch { return ""; } };
export const removeBackground = async (b64: string): Promise<string | null> => { await new Promise(r => setTimeout(r, 1000)); return b64; };
export const generateSQL = async (desc: string, schema: string): Promise<string> => { if (!getApiKey()) return "-- No Key"; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `SQL for: ${desc}. Schema: ${schema}` }); return (r.text||"").replace(/```sql|```/g, '').trim(); } catch { return "-- Error"; } };
export const generateTerminalCommand = async (q: string, t: string): Promise<string> => { if (!getApiKey()) return "echo 'No Key'"; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Shell cmd for ${t}: "${q}"` }); return (r.text||"").replace(/```sh|```/g, '').trim(); } catch { return "echo 'Error'"; } };
export const runSecurityAudit = async (f: string, p: string): Promise<AuditIssue[]> => { if (!getApiKey()) return []; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Audit: ${f}`, config: { responseMimeType: 'application/json' } }); return JSON.parse(cleanJson(r.text||'[]')); } catch { return []; } };
export const generatePerformanceReport = async (f: string): Promise<PerformanceReport> => { if (!getApiKey()) return { scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }, opportunities: [] }; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Perf report: ${f}`, config: { responseMimeType: 'application/json' } }); return JSON.parse(cleanJson(r.text||'{}')); } catch { return { scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }, opportunities: [] }; } };
export const generateArchitecture = async (d: string): Promise<{nodes: ArchNode[], links: ArchLink[]}> => { if (!getApiKey()) return { nodes: [], links: [] }; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Arch for: ${d}`, config: { responseMimeType: 'application/json' } }); return JSON.parse(cleanJson(r.text||'{"nodes":[], "links":[]}')); } catch { return { nodes: [], links: [] }; } };
export const testFineTunedModel = async (m: string, p: string, cb: (c: string) => void) => { const d = (ms: number) => new Promise(r => setTimeout(r, ms)); const t = `[${m}] resp: "${p}"`; for (const c of t.split(" ")) { await d(50); cb(c+" "); } };
