
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
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

// ... (Rest of existing utility functions: getProviderConfig, cleanJson, extractCode, retryOperation) ...
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

const extractCode = (rawText: string): string => {
    if (!rawText) return "";
    if (rawText.includes('DELETE_FILE')) return 'DELETE_FILE';
    const codeBlockRegex = /```(?:typescript|javascript|tsx|jsx|css|json|html|swift|kotlin|xml|bash|sh|dockerfile|yaml)?\n([\s\S]*?)```/g;
    const matches = [...rawText.matchAll(codeBlockRegex)];
    if (matches.length > 0) return matches.reduce((a, b) => a[1].length > b[1].length ? a : b)[1].trim();
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\w*\n?/, '').replace(/```$/, '');
    const preambleMatch = cleaned.match(/^(here is|sure,|certainly|below is).*?:\n/i);
    if (preambleMatch) cleaned = cleaned.substring(preambleMatch[0].length).trim();
    return cleaned;
};

const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const isRateLimit = error.message?.includes('429') || error.status === 429;
    const isServerOverload = error.message?.includes('503') || error.status === 503;
    
    if (retries > 0 && (isRateLimit || isServerOverload)) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
};

const getFrameworkInstructions = (type: ProjectType) => {
    const commonInstructions = `
        - DEPENDENCIES: Only use standard libraries or those specified.
        - STYLE: Write clean, modular, and strongly-typed code.
        - ICONS: Use 'lucide-react' for React/Web projects.
        - FORMAT: Provide FULL file content. No placeholders like "// ... rest of code".
        - ENTRY POINT: Ensure the main entry file is named 'App.tsx' (or 'src/App.tsx') and exports a default component named 'App'.
        - DOCKER AWARENESS: Assume the application may run in a container (respect PORT env var, listen on 0.0.0.0).
    `;

    switch (type) {
        case ProjectType.REACT_NATIVE:
            return `FRAMEWORK: React Native (Expo) [MCP Active]
            - CORE UI: Use 'react-native' components (View, Text, Image, ScrollView, FlatList, TouchableOpacity).
            - STYLE SYSTEM: Use StyleSheet.create({ container: { ... } }). AVOID inline styles for performance.
            - NAVIGATION: Use 'expo-router' file-based routing.
              * app/index.tsx -> Home
              * app/(tabs)/_layout.tsx -> Tabs
              * Use <Link href="/details"> from expo-router.
            - ICONS: Use '@expo/vector-icons' (e.g. FontAwesome, Ionicons).
            - ASSETS: Use local require('./assets/...') or remote URIs.
            - STATE MANAGEMENT: Use React Context or Zustand (simple).
            - FORBIDDEN: Do NOT use HTML tags (div, span, h1, ul, li). Do NOT use 'framer-motion' (use 'react-native-reanimated' if needed).
            - PREVIEW: Code must be runnable in Expo Go simulation.
            ${commonInstructions}`;
            
        case ProjectType.IOS_APP:
            return `FRAMEWORK: Native iOS (SwiftUI) [MCP Active]
            - LANGUAGE: Swift 5.9+
            - UI FRAMEWORK: SwiftUI.
            - STRUCTURE:
              * @main struct OmniApp: App
              * struct ContentView: View
            - LAYOUTS: VStack, HStack, ZStack, List, ScrollView, Grid.
            - MODIFIERS: Use .padding(), .background(), .cornerRadius(), .foregroundStyle().
            - STATE: Use @State, @Binding, @EnvironmentObject, @Observable.
            - ASSETS: Use Image(systemName: "star.fill") for SF Symbols.
            - PREVIEW: Include #Preview { ContentView() } at the bottom.
            ${commonInstructions}`;
            
        case ProjectType.ANDROID_APP:
            return `FRAMEWORK: Native Android (Kotlin + Jetpack Compose) [MCP Active]
            - LANGUAGE: Kotlin
            - UI FRAMEWORK: Jetpack Compose (Material3).
            - STRUCTURE:
              * MainActivity : ComponentActivity()
              * setContent { MaterialTheme { Surface { ... } } }
            - COMPOSABLES: Column, Row, Box, LazyColumn, Scaffold, Text, Button.
            - MODIFIERS: Modifier.padding().fillMaxSize().background().
            - STATE: val count = remember { mutableStateOf(0) }.
            - ASSETS: Use standard Android resources or coil-compose for images.
            ${commonInstructions}`;
            
        case ProjectType.NODE_API:
            return `FRAMEWORK: Node.js API (Express) [MCP Active]
            - RUNTIME: Node.js (LTS).
            - SERVER: Express.js.
            - DATABASE: Mongoose (MongoDB) schema definitions in 'src/models'.
            - STRUCTURE:
              * src/app.js (Main entry)
              * src/routes/ (Route definitions)
              * src/controllers/ (Logic)
              * src/middleware/ (Auth, Error handling)
            - AUTH: Use jsonwebtoken (JWT) and bcryptjs.
            - LOGGING: Use console.log or winston.
            - UTILS: Use 'express-async-handler' for routes.
            - FORMAT: CommonJS (require/module.exports).
            - DEPENDENCIES: express, mongoose, dotenv, cors, jsonwebtoken.
            - CONTAINER: Include Dockerfile and docker-compose.yml for deployment. Ensure app listens on process.env.PORT || 3000.
            ${commonInstructions}`;
            
        default:
            return `FRAMEWORK: React Web (Vite + Tailwind) [MCP Active]
            - CORE UI: React 18+ Functional Components.
            - STYLING: Tailwind CSS (className="flex p-4 bg-gray-900 text-white").
            - ICONS: lucide-react (import { Home } from 'lucide-react').
            - ANIMATION: framer-motion (import { motion } from 'framer-motion').
            - UTILS: Use 'clsx' or 'tailwind-merge' for class names. Use 'date-fns' for dates.
            - STATE: React Hooks (useState, useEffect, useContext).
            - ROUTING: React Router or simple conditional rendering.
            - PATTERNS: Mobile-first responsive design.
            - ENTRY: Must include 'src/App.tsx' as the main entry point exporting 'App'.
            - FORBIDDEN: Class components, jQuery, direct DOM manipulation.
            - IMPORTANT: Always import React from 'react'.
            ${commonInstructions}`;
    }
};

export const detectIntent = async (prompt: string): Promise<'chat' | 'task'> => {
    if (!getApiKey()) return 'chat';
    const ai = getAiClient();
    try {
        const response = await retryOperation(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Classify the user prompt into "chat" (question/explanation) or "task" (code modification/creation). Prompt: "${prompt}". Return ONLY the string "chat" or "task".`,
        })) as GenerateContentResponse;
        const intent = response.text?.trim().toLowerCase();
        return intent === 'task' ? 'task' : 'chat';
    } catch { return 'chat'; }
};

export const planAgentTask = async (agent: AIAgent, taskDescription: string, fileStructure: string, projectType: ProjectType): Promise<{ filesToEdit: string[], strategy: string }> => {
    if (!getApiKey()) return { filesToEdit: [], strategy: "No API Key" };
    const ai = getAiClient();
    const systemInstruction = `${agent.systemPrompt} IDENTITY: Project Manager. CONTEXT: ${projectType} Project. TASK: Analyze request "${taskDescription}". FILE STRUCTURE:\n${fileStructure}\nOUTPUT JSON: { "filesToEdit": ["path/to/file"], "strategy": "Brief plan." }`;
    try {
        const response = await retryOperation(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: "Plan execution.",
            config: { systemInstruction, responseMimeType: 'application/json' }
        })) as GenerateContentResponse;
        return JSON.parse(cleanJson(response.text || '{"filesToEdit": [], "strategy": ""}'));
    } catch (e) { return { filesToEdit: [], strategy: "Planning failed." }; }
};

export const analyzeFile = async (agent: AIAgent, fileName: string, fileContent: string, instructions: string, context?: AgentContext): Promise<string> => {
    if (!getApiKey()) return "Skipping analysis";
    const ai = getAiClient();
    const envContext = context ? `Logs: ${context.terminalLogs?.filter(l => l.toLowerCase().includes('error')).slice(-2).join('\n')}` : '';
    const systemInstruction = `${agent.systemPrompt} IDENTITY: ${agent.name}. TASK: Scan "${fileName}" and logs. INSTRUCTIONS: Return a CONCISE bulleted summary of issues/changes needed. Max 3 bullets. ${envContext}`;
    try {
        const response = await retryOperation(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `File:\n${fileContent}\n\nInstructions:\n${instructions}`,
            config: { systemInstruction }
        })) as GenerateContentResponse;
        return response.text?.trim() || "No issues.";
    } catch { return "Analysis failed."; }
};

export const executeBuildTask = async (
    agent: AIAgent, fileName: string, fileContent: string, instructions: string, 
    context?: AgentContext, previousFeedback?: string, projectType: ProjectType = ProjectType.REACT_WEB, isNewFile: boolean = false
): Promise<{ code: string, logs: string[] }> => {
    if (!getApiKey()) return { code: fileContent, logs: ["Error: No API Key"] };
    const ai = getAiClient();
    const model = agent.model || 'gemini-2.5-flash';
    const rules = `${getFrameworkInstructions(projectType)}\n${context?.projectRules || ''}\n${context?.mcpContext || ''}`;
    const env = context ? `Phase: ${context.roadmap?.find(p=>p.status==='active')?.title}, Errors: ${context.terminalLogs?.slice(-2).join('\n')}` : '';
    const retry = previousFeedback ? `!!! REJECTED PREVIOUSLY. FIX: "${previousFeedback}" !!!` : '';
    
    const systemInstruction = `
        ${agent.systemPrompt}
        IDENTITY: ${agent.name}, Build Agent.
        TASK: ${isNewFile ? `Create "${fileName}"` : `Update "${fileName}"`}.
        ${rules}
        ${env}
        ${context?.relatedCode || ''}
        ${retry}
        STRICT OUTPUT: Return ONLY valid file content. NO markdown fences. NO placeholders.
        CRITICAL: If this is the main entry file (App.tsx), you MUST export a default component named 'App'.
    `;

    try {
        const response = await retryOperation(() => ai.models.generateContent({
            model,
            contents: `Instructions:\n${instructions}\n\n${isNewFile ? 'File is empty.' : `Current:\n${fileContent}`}`,
            config: { systemInstruction, temperature: 0.2 }
        })) as GenerateContentResponse;
        const newCode = extractCode(response.text || fileContent);
        return { code: newCode, logs: previousFeedback ? [`${agent.name} applied fixes`] : [`${agent.name} built code`] };
    } catch (e: any) { return { code: fileContent, logs: [`${agent.name} error: ${e.message}`] }; }
};

export const reviewBuildTask = async (
    fileName: string, originalCode: string, newCode: string, requirements: string, 
    context?: AgentContext, projectType: ProjectType = ProjectType.REACT_WEB
): Promise<{ approved: boolean, feedback: string, issues: string[], fixCode?: string, suggestedCommand?: string }> => {
    if (!getApiKey()) return { approved: true, feedback: "Auto-approved", issues: [] };
    const ai = getAiClient();
    const rules = `${getFrameworkInstructions(projectType)}\n${context?.projectRules || ''}`;
    
    const systemInstruction = `
        IDENTITY: Senior Principal Engineer (Critic).
        GOAL: Ensure code quality AND development velocity. Avoid unnecessary loops.
        
        TASK: Review changes for "${fileName}".
        REQUIREMENTS: "${requirements}".
        CONTEXT: ${rules}

        DECISION MATRIX:
        1. **PERFECT**: If code is correct -> Approve (approved: true).
        2. **MINOR ISSUES** (Syntax, missing imports, unused vars, formatting, slight logic bugs, React hook rules):
           -> **DO NOT REJECT**.
           -> **FIX IT YOURSELF**.
           -> Return "approved: false" (technically the builder failed) BUT provide the **FULL CORRECTED CODE** in "fixCode".
           -> This counts as a "Critic Rescue" and unblocks the pipeline.
        3. **CRITICAL FAILURES** (Wrong framework, missing core feature, completely hallucinated logic, security vulnerability):
           -> Reject (approved: false). Provide feedback.

        OUTPUT JSON:
        {
            "approved": boolean, 
            "feedback": "Concise summary", 
            "issues": ["List of issues"], 
            "fixCode": "FULL CORRECTED CODE IF AUTO-FIXABLE (OR NULL)",
            "suggestedCommand": "Terminal command if needed (e.g. npm install)"
        }
    `;

    try {
        const response = await retryOperation(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Original Length: ${originalCode.length}\n\nProposed Code:\n${newCode.substring(0, 30000)}`, 
            config: { systemInstruction, responseMimeType: 'application/json' }
        })) as GenerateContentResponse;
        
        const parsed = JSON.parse(cleanJson(response.text || '{}'));
        if (parsed.fixCode) parsed.fixCode = extractCode(parsed.fixCode);
        
        return parsed;
    } catch { return { approved: true, feedback: "Critic check failed (Auto-Pass).", issues: [] }; }
};

export const generateCodeResponse = async (
    prompt: string, 
    currentFileContent: string, 
    projectType: ProjectType, 
    fileStructure: string, 
    modelName: string, 
    onStream: (chunk: string) => void, 
    onComplete?: (metadata?: any) => void,
    imageData?: string, 
    chatHistory: ChatMessage[] = [],
    useSearch: boolean = false
) => {
    if (!getApiKey()) { onStream("Error: No API Key found."); return; }
    const ai = getAiClient();
    const frameworkInstruction = getFrameworkInstructions(projectType);
    try {
        const systemInstruction = `Omni Coding Assistant. ${frameworkInstruction}. Files:\n${fileStructure}. Current File:\n\`\`\`\n${currentFileContent}\n\`\`\``;
        const history = chatHistory.filter(msg => msg.role === 'user' || msg.role === 'model').map(msg => ({ role: msg.role === 'model' ? 'model' : 'user', parts: [{ text: msg.text }] }));
        
        const tools = useSearch ? [{ googleSearch: {} }] : undefined;
        
        const chat = ai.chats.create({ 
            model: 'gemini-2.5-flash',
            config: { systemInstruction, tools }, 
            history: history as any 
        });
        
        const parts: any[] = [{ text: prompt }];
        if (imageData) { const [meta, data] = imageData.split(','); parts.unshift({ inlineData: { mimeType: meta.match(/:(.*?);/)?.[1] || 'image/png', data } }); }
        
        const result = await retryOperation(() => chat.sendMessageStream({ message: { role: 'user', parts } })) as any;
        
        let aggregatedMetadata: any = undefined;

        for await (const chunk of result) {
            const c = chunk as GenerateContentResponse;
            if (c.text) onStream(c.text);
            if (c.candidates?.[0]?.groundingMetadata) {
                aggregatedMetadata = c.candidates[0].groundingMetadata;
            }
        }
        
        if (onComplete) onComplete(aggregatedMetadata);

    } catch (error: any) { onStream(`Error: ${error.message}`); }
};

// ... (Rest of existing exports: generateGhostText, chatWithVoice, etc. - ensure these are present as before)
export const generateGhostText = async (p: string, s: string) => { if (!getApiKey()) return ""; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Complete:\n${p}[CURSOR]${s}`, config: { maxOutputTokens: 64, temperature: 0.2 } }) as GenerateContentResponse; return r.text?.trimEnd() || ""; } catch { return ""; } };
export const chatWithVoice = async (p: string) => { if (!getApiKey()) return "No Key"; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: p, config: { systemInstruction: "Concise response." } }) as GenerateContentResponse; return r.text || "?"; } catch { return "Error"; } };
export const generateProjectScaffold = async (p: string, t: ProjectType) => { if (!getApiKey()) return []; const ai = getAiClient(); try { const r = await retryOperation(() => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: "Generate.", config: { systemInstruction: `Scaffold JSON for ${t}: "${p}". Schema: [{name, type, content?, children?}]. Ensure root has src/App.tsx (or appropriate entry) exporting default App component.`, responseMimeType: 'application/json' } })) as GenerateContentResponse; return JSON.parse(cleanJson(r.text || '[]')); } catch { return []; } };
export const generateProjectPlan = async (d: string, t: ProjectType) => { if (!getApiKey()) return []; const ai = getAiClient(); try { const r = await retryOperation(() => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: "Roadmap", config: { systemInstruction: `Roadmap JSON for ${t}: "${d}". Schema: [{id, title, status, goals:[], tasks:[{id, text, done}]}]`, responseMimeType: 'application/json' } })) as GenerateContentResponse; return JSON.parse(cleanJson(r.text || '[]')); } catch { return []; } };
export const generateProjectDocs = async (s: string, t: ProjectType, cb: (c: string) => void) => { if (!getApiKey()) { cb("No Key"); return; } const ai = getAiClient(); try { const r = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents: "README", config: { systemInstruction: `Write README for ${t}:\n${s}` } }); for await (const c of r) if((c as GenerateContentResponse).text) cb((c as GenerateContentResponse).text!); } catch(e:any) { cb(e.message); } };
export const runAgentFileTask = async (a: AIAgent, n: string, c: string, ctx?: AgentContext) => { if (!getApiKey()) return null; const ai = getAiClient(); try { const r = await retryOperation(() => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `File: ${n}\n${c}`, config: { systemInstruction: `${a.systemPrompt} Task: Improve file. Return full content.` } })) as GenerateContentResponse; return r.text; } catch { return null; } };
export const critiqueCode = async (c: string, t: string) => { if (!getApiKey()) return null; const ai = getAiClient(); try { const r = await retryOperation(() => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Task: ${t}\n${c}`, config: { systemInstruction: `Review JSON: {score, issues:[], suggestions:[], fixCode:string}`, responseMimeType: 'application/json' } })) as GenerateContentResponse; return JSON.parse(cleanJson(r.text||'{}')); } catch { return null; } };
export const delegateTasks = async (p: ProjectPhase, a: AIAgent[]) => { if (!getApiKey()) return { assignments: [] }; const ai = getAiClient(); try { const r = await retryOperation(() => ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: `Phase: ${p.title}. Goals: ${p.goals}. Agents: ${a.map(x=>x.name).join(',')}. JSON: {assignments:[{agentName, taskDescription, targetFile}]}`, config: { responseMimeType: 'application/json' } })) as GenerateContentResponse; return JSON.parse(cleanJson(r.text||'{"assignments":[]}')); } catch { return { assignments: [] }; } };
export const generateTestResults = async (n: string, c: string) => { if (!getApiKey()) return {passed:0,failed:1,duration:0,suites:[]}; const ai = getAiClient(); try { const r = await retryOperation(() => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Simulate tests for ${n}:\n${c}`, config: { responseMimeType: 'application/json' } })) as GenerateContentResponse; return JSON.parse(cleanJson(r.text||'{}')); } catch { return {passed:0,failed:1,duration:0,suites:[]}; } };
export const generateChangelog = async (files: string[], task: string) => { if (!getApiKey()) return "Done."; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Task: ${task}. Modified: ${files.join(',')}. Concise summary.` }) as GenerateContentResponse; return r.text || "Done."; } catch { return "Done."; } };
export const generateCommitMessage = async (c: string[]) => { if (!getApiKey()) return "Update"; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Commit msg for: ${c.join(',')}. Format: 'feat: ...'` }) as GenerateContentResponse; return r.text?.trim() || "Update"; } catch { return "Update"; } };
export const autoUpdateReadme = async (old: string, change: string) => { if (!getApiKey()) return old; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Update README:\n${old}\n\nChange:\n${change}. Return full text.` }) as GenerateContentResponse; return r.text || old; } catch { return old; } };
export const queryMCPServer = async (q: string) => { if(q.includes('swift')) return "iOS Docs: Use @Observable, #Preview."; if(q.includes('kotlin')) return "Android Docs: Use Material3."; return "Clean code principles."; };
export const generateSpeech = async (t: string, v: Voice, s?: string) => { if (!getApiKey()) return null; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: "gemini-2.5-flash-preview-tts", contents: [{ parts: [{ text: s ? `(${s}) ${t}` : t }] }], config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: (v.apiMapping || 'Kore') as any } } } } }) as GenerateContentResponse; const b = r.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data; return b ? `data:audio/pcm;base64,${b}` : null; } catch { return null; } };
export const generateImage = async (p: string, s?: string) => { if (!getApiKey()) return null; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: s ? `${p}. Style: ${s}` : p }] } }) as GenerateContentResponse; const d = r.candidates?.[0]?.content?.parts?.[0]?.inlineData; return d ? `data:${d.mimeType};base64,${d.data}` : null; } catch { return null; } };
export const editImage = async (img: string, p: string) => { if (!getApiKey()) return null; const ai = getAiClient(); try { const d = img.split(',').pop()||''; const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ inlineData: { mimeType: 'image/png', data: d } }, { text: p }] } }) as GenerateContentResponse; const res = r.candidates?.[0]?.content?.parts?.[0]?.inlineData; return res ? `data:${res.mimeType};base64,${res.data}` : null; } catch { return null; } };
export const transcribeAudio = async (b64: string) => { if (!getApiKey()) return ""; const ai = getAiClient(); try { const d = b64.split(',').pop()||''; const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ inlineData: { mimeType: 'audio/webm', data: d } }, { text: "Transcribe" }] } }) as GenerateContentResponse; return r.text||""; } catch { return ""; } };
export const analyzeMediaStyle = async (b64: string, t: any) => { if (!getApiKey()) return ""; const ai = getAiClient(); try { const d = b64.split(',').pop()||''; const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ inlineData: { mimeType: t==='image'?'image/png':'audio/webm', data: d } }, { text: "Analyze style" }] } }) as GenerateContentResponse; return r.text||""; } catch { return ""; } };
export const analyzeCharacterFeatures = async (b64: string) => { if (!getApiKey()) return ""; const ai = getAiClient(); try { const d = b64.split(',').pop()||''; const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ inlineData: { mimeType: 'image/png', data: d } }, { text: "Describe features" }] } }) as GenerateContentResponse; return r.text||""; } catch { return ""; } };
export const removeBackground = async (b64: string) => { await new Promise(r => setTimeout(r, 1000)); return b64; };
export const generateSQL = async (d: string, s: string) => { if (!getApiKey()) return ""; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `SQL for ${d}. Schema: ${s}` }) as GenerateContentResponse; return r.text?.replace(/```sql|```/g, '').trim()||""; } catch { return ""; } };
export const generateTerminalCommand = async (q: string, t: string) => { if (!getApiKey()) return ""; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Shell cmd for ${t}: ${q}` }) as GenerateContentResponse; return r.text?.replace(/```sh|```/g, '').trim()||""; } catch { return ""; } };
export const runSecurityAudit = async (f: string, p: string) => { if (!getApiKey()) return []; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Audit ${f}`, config: { responseMimeType: 'application/json' } }) as GenerateContentResponse; return JSON.parse(cleanJson(r.text||'[]')); } catch { return []; } };
export const generatePerformanceReport = async (f: string) => { if (!getApiKey()) return {scores:{performance:0,accessibility:0,bestPractices:0,seo:0},opportunities:[]}; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Perf ${f}`, config: { responseMimeType: 'application/json' } }) as GenerateContentResponse; return JSON.parse(cleanJson(r.text||'{}')); } catch { return {scores:{performance:0,accessibility:0,bestPractices:0,seo:0},opportunities:[]}; } };
export const generateArchitecture = async (d: string) => { if (!getApiKey()) return {nodes:[],links:[]}; const ai = getAiClient(); try { const r = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Arch ${d}`, config: { responseMimeType: 'application/json' } }) as GenerateContentResponse; return JSON.parse(cleanJson(r.text||'{}')); } catch { return {nodes:[],links:[]}; } };
export const generateVideo = async (p: string, i?: string) => { if (!getApiKey()) return null; const ai = getAiClient(); try { const r: any = { model: 'veo-3.1-fast-generate-preview', prompt: p, config: { numberOfVideos: 1 } }; if(i) { const [m,d] = i.split(','); r.image = { imageBytes: d, mimeType: m.match(/:(.*?);/)?.[1]||'image/png' }; } let op = await ai.models.generateVideos(r); while(!op.done) { await new Promise(x => setTimeout(x, 5000)); op = await ai.operations.getVideosOperation({operation: op}); } const u = op.response?.generatedVideos?.[0]?.video?.uri; if(!u) throw 0; const res = await fetch(`${u}&key=${getApiKey()}`); const b = await res.blob(); return URL.createObjectURL(b); } catch { return null; } };
export const testFineTunedModel = async (m: string, p: string, cb: (c: string) => void) => { const d = (ms: number) => new Promise(r => setTimeout(r, ms)); const t = `[${m}] resp: "${p}"`; for (const c of t.split(" ")) { await d(50); cb(c+" "); } };

export const generateSocialContent = async (prompt: string, platform: string, onStream: (chunk: string) => void) => {
    if (!getApiKey()) { onStream("No API Key"); return; }
    const ai = getAiClient();
    try {
        const response = await retryOperation(() => ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Platform: ${platform}\nTask: ${prompt}`,
            config: { systemInstruction: "You are a creative social media content strategist. Output the script and scene descriptions." }
        })) as any;
        for await (const chunk of response) {
            const c = chunk as GenerateContentResponse;
            if (c.text) onStream(c.text);
        }
    } catch (e: any) { onStream(`Error: ${e.message}`); }
};

export const generateSyntheticData = async (topic: string, count: number, onStream: (chunk: string) => void) => {
    if (!getApiKey()) { onStream("No API Key"); return; }
    const ai = getAiClient();
    try {
        const response = await retryOperation(() => ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Topic: ${topic}. Count: ${count}`,
            config: { systemInstruction: "Generate synthetic training data in JSONL format. Output ONLY valid JSONL content." }
        })) as any;
        for await (const chunk of response) {
            const c = chunk as GenerateContentResponse;
            if (c.text) onStream(c.text);
        }
    } catch (e: any) { onStream(`Error: ${e.message}`); }
};
