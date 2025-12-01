
import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";
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
  if (!apiKey) return new GoogleGenAI({ apiKey: 'dummy' });
  return new GoogleGenAI({ apiKey });
};

// --- Helpers ---

const cleanJson = (text: string): string => {
    if (!text) return '{}';
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '');
    const firstBrace = cleaned.search(/[{[]/);
    if (firstBrace !== -1) {
        cleaned = cleaned.substring(firstBrace);
        const lastCurly = cleaned.lastIndexOf('}');
        const lastSquare = cleaned.lastIndexOf(']');
        const end = Math.max(lastCurly, lastSquare);
        if (end !== -1) {
            cleaned = cleaned.substring(0, end + 1);
        }
    }
    return cleaned;
};

const safeParseJSON = (jsonString: string, fallback: any = {}) => {
    try {
        return JSON.parse(cleanJson(jsonString));
    } catch (e) {
        console.error("JSON Parsing Error:", e);
        return fallback;
    }
};

// --- PCM to WAV Converter ---
const pcmToWav = (base64PCM: string, sampleRate: number = 24000): string => {
    const binaryString = atob(base64PCM);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    // RIFF identifier
    view.setUint32(0, 0x52494646, false); // "RIFF"
    // file length
    view.setUint32(4, 36 + len, true);
    // RIFF type
    view.setUint32(8, 0x57415645, false); // "WAVE"
    // format chunk identifier
    view.setUint32(12, 0x666d7420, false); // "fmt "
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, 1, true);
    // channel count (mono)
    view.setUint16(22, 1, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sampleRate * blockAlign)
    view.setUint32(28, sampleRate * 2, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, false); // "data"
    // data chunk length
    view.setUint32(40, len, true);

    // Combine header and data
    const wavBytes = new Uint8Array(wavHeader.byteLength + len);
    wavBytes.set(new Uint8Array(wavHeader), 0);
    wavBytes.set(bytes, 44);

    // Convert back to base64
    let binary = '';
    const l = wavBytes.byteLength;
    for (let i = 0; i < l; i++) {
        binary += String.fromCharCode(wavBytes[i]);
    }
    return `data:audio/wav;base64,${btoa(binary)}`;
};

export const detectIntent = async (prompt: string): Promise<'chat' | 'task'> => {
    if (!getApiKey()) return 'chat';
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this prompt: "${prompt}". 
            Is the user asking for a specific complex file modification, code refactoring, or a multi-step task? Return "task".
            Is the user asking a general question, asking for an explanation, or chatting? Return "chat".
            Return ONLY the word "task" or "chat".`,
        });
        const text = response.text?.trim().toLowerCase() || 'chat';
        return text.includes('task') ? 'task' : 'chat';
    } catch (e) {
        return 'chat';
    }
};

export const planAgentTask = async (agent: AIAgent, taskDescription: string, fileStructure: string, projectType: ProjectType): Promise<{ filesToEdit: string[], strategy: string, requiresSearch: boolean }> => {
    if (!getApiKey()) return { filesToEdit: [], strategy: "No API Key", requiresSearch: false };
    const ai = getAiClient();
    
    const prompt = `
    You are ${agent.name}, a ${agent.role}.
    Project Type: ${projectType}
    
    Task: ${taskDescription}
    
    File Structure:
    ${fileStructure}
    
    Analyze the task and determine which files need to be created or modified.
    Also determine if external information (docs, libraries, current events) is needed via search.
    Provide a brief strategy and a list of file paths.
    
    Return JSON format:
    {
      "filesToEdit": ["path/to/file1", "path/to/file2"],
      "strategy": "Your step-by-step technical plan...",
      "requiresSearch": boolean
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        filesToEdit: { type: Type.ARRAY, items: { type: Type.STRING } },
                        strategy: { type: Type.STRING },
                        requiresSearch: { type: Type.BOOLEAN }
                    }
                }
            }
        });
        return safeParseJSON(response.text || '{}', { filesToEdit: [], strategy: "Planning failed", requiresSearch: false });
    } catch (e) {
        console.error("Planning Error", e);
        return { filesToEdit: [], strategy: "Planning failed due to API error.", requiresSearch: false };
    }
};

export const analyzeFile = async (agent: AIAgent, fileName: string, fileContent: string, instructions: string, context?: AgentContext): Promise<string> => {
    if (!getApiKey()) return "Analysis skipped (No API Key)";
    const ai = getAiClient();
    
    const prompt = `
    Analyze ${fileName} in the context of these instructions: "${instructions}".
    Identify key areas that need changes. Be concise.
    
    File Content:
    ${fileContent.substring(0, 5000)}... (truncated if too long)
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "No analysis generated.";
    } catch (e) { return "Analysis failed."; }
};

export const executeBuildTask = async (
    agent: AIAgent, fileName: string, fileContent: string, instructions: string, 
    context?: AgentContext, previousFeedback?: string, projectType: ProjectType = ProjectType.REACT_WEB, isNewFile: boolean = false,
    useSearch: boolean = false
): Promise<{ code: string, logs: string[] }> => {
    if (!getApiKey()) return { code: fileContent, logs: ["API Key Missing"] };
    const ai = getAiClient();

    const systemPrompt = `You are an expert ${projectType} developer named ${agent.name}. 
    Your goal is to write clean, performant, and bug-free code.
    Output the FULL content of the file "${fileName}". Do not use markdown blocks or placeholders like "// ... rest of code".
    If the file should be deleted, output exactly: DELETE_FILE`;

    let userPrompt = `Task: ${instructions}\n\n`;
    if (!isNewFile) {
        userPrompt += `Current Content of ${fileName}:\n${fileContent}\n\n`;
    } else {
        userPrompt += `Create new file: ${fileName}\n\n`;
    }

    if (previousFeedback) {
        userPrompt += `Previous attempt feedback (FIX THESE ISSUES): ${previousFeedback}\n\n`;
    }

    if (context?.relatedCode) {
        userPrompt += `Related Context:\n${context.relatedCode}\n\n`;
    }

    const tools: any[] = [];
    if (useSearch) {
        tools.push({ googleSearch: {} });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.2,
                tools: tools.length > 0 ? tools : undefined
            }
        });
        
        let code = response.text || fileContent;
        code = code.replace(/^```[a-z]*\n/, '').replace(/```$/, '');
        
        const logs = [`Generated ${code.length} bytes`];
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks?.length) {
            logs.push(`Used ${response.candidates[0].groundingMetadata.groundingChunks.length} search sources.`);
        }

        return { code, logs };
    } catch (e: any) {
        return { code: fileContent, logs: [`Error: ${e.message}`] };
    }
};

export const reviewBuildTask = async (
    fileName: string, originalCode: string, newCode: string, requirements: string, 
    context?: AgentContext, projectType: ProjectType = ProjectType.REACT_WEB
): Promise<{ approved: boolean, feedback: string, issues: string[], fixCode?: string, suggestedCommand?: string }> => {
    if (!getApiKey()) return { approved: true, feedback: "Skipped review", issues: [] };
    const ai = getAiClient();

    const prompt = `
    Act as a Senior Code Reviewer. Review the changes in ${fileName}.
    
    Requirements: ${requirements}
    
    Original Code (Snippet):
    ${originalCode.substring(0, 500)}...
    
    New Code:
    ${newCode}
    
    Check for:
    1. Syntax errors
    2. Logic bugs
    3. Requirement fulfillment
    4. Best practices for ${projectType}
    
    If critical issues exist, provide the fixed full code in "fixCode".
    If it's a dependency issue, suggest a terminal command in "suggestedCommand".
    
    Return JSON:
    {
        "approved": boolean,
        "feedback": "summary string",
        "issues": ["issue 1", "issue 2"],
        "fixCode": "optional string with full fixed code if easy to fix",
        "suggestedCommand": "optional npm/git command"
    }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        const result = safeParseJSON(response.text || '{}', { approved: false, feedback: "Parse error", issues: ["JSON Error"] });
        return {
            approved: result.approved,
            feedback: result.feedback,
            issues: result.issues || [],
            fixCode: result.fixCode,
            suggestedCommand: result.suggestedCommand
        };
    } catch (e: any) {
        return { approved: false, feedback: e.message, issues: ["Review Generation Failed"] };
    }
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
    useSearch: boolean = false,
    useMaps: boolean = false
) => {
    if (!getApiKey()) {
        onStream("Please configure your Gemini API Key in Settings to use the Assistant.");
        return;
    }
    const ai = getAiClient();
    
    let apiModel = 'gemini-2.5-flash';
    if (modelName.includes('Pro') || modelName.includes('pro')) apiModel = 'gemini-3-pro-preview';
    if (modelName.includes('Flash') || modelName.includes('flash')) apiModel = 'gemini-2.5-flash';

    const systemContext = `
    You are an AI Assistant in Omni-Studio, a web-based IDE.
    Project Type: ${projectType}
    
    Current File Context:
    ${currentFileContent ? currentFileContent.substring(0, 8000) : '(No active file)'}
    
    File Structure:
    ${fileStructure}
    
    Answer specific coding questions, generate snippets, or explain concepts.
    If generating code, use markdown blocks.
    `;

    const tools: any[] = [];
    if (useSearch) tools.push({ googleSearch: {} });
    if (useMaps) tools.push({ googleMaps: {} });

    const history = chatHistory
        .filter(msg => msg.role !== 'system' && msg.role !== 'critic')
        .map(msg => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

    const parts: any[] = [{ text: prompt }];
    if (imageData) {
        const data = imageData.split(',')[1];
        const mimeType = imageData.substring(imageData.indexOf(':') + 1, imageData.indexOf(';'));
        parts.push({ inlineData: { mimeType, data } });
    }

    try {
        const contents = [...history, { role: 'user', parts }];
        
        const result = await ai.models.generateContentStream({
            model: apiModel,
            contents: contents as any,
            config: {
                systemInstruction: systemContext,
                tools: tools.length > 0 ? tools : undefined,
            }
        });

        let fullText = "";
        let groundingMetadata;

        for await (const chunk of result) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                onStream(chunkText);
            }
            if (chunk.candidates?.[0]?.groundingMetadata) {
                groundingMetadata = chunk.candidates[0].groundingMetadata;
            }
        }
        
        if (onComplete) onComplete(groundingMetadata);

    } catch (e: any) {
        console.error("Chat Error", e);
        onStream(`\n\n[Error: ${e.message || "Failed to generate response"}]`);
    }
};

export const generateGhostText = async (prefix: string, suffix: string): Promise<string> => {
    if (!getApiKey()) return "";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Complete this code. Return ONLY the completion text, no markdown.
            Prefix:
            ${prefix.slice(-500)}
            
            Suffix:
            ${suffix.slice(0, 500)}`,
            config: { maxOutputTokens: 64, temperature: 0.1 }
        });
        return response.text?.trimEnd() || "";
    } catch { return ""; }
};

export const generateImage = async (prompt: string, styleRef?: string): Promise<string> => {
    if (!getApiKey()) return "";
    const ai = getAiClient();
    try {
        const p = styleRef ? `${prompt}. Style reference: ${styleRef}` : prompt;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: p,
        });
        
        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        
        return "https://via.placeholder.com/1024x1024?text=AI+Generated+Image";
    } catch (e) {
        console.error(e);
        return "";
    }
};

export const generateSpeech = async (text: string, voice: Voice, styleReference?: string): Promise<string> => {
    if (!getApiKey()) return "";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text }] },
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice.apiMapping || 'Kore' }
                    }
                }
            }
        });
        
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        if (part && part.inlineData) {
            // Convert the raw PCM base64 to a playable WAV Data URI
            return pcmToWav(part.inlineData.data);
        }
    } catch (e) {
        console.error("TTS Error", e);
    }
    return "";
};

export const editImage = async (base64: string, prompt: string): Promise<string> => {
    if (!getApiKey()) return "";
    const ai = getAiClient();
    try {
        const data = base64.split(',')[1];
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data } },
                    { text: prompt }
                ]
            }
        });
        const candidate = response.candidates?.[0];
        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
    } catch (e) {
        console.error("Image Edit Error", e);
    }
    return base64; 
};

export const generateTerminalCommand = async (query: string, type: ProjectType): Promise<string> => {
    if (!getApiKey()) return `echo "No API Key"`;
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate this natural language request into a single terminal command for a ${type} project: "${query}". Return ONLY the command, no markdown.`
        });
        return response.text?.trim() || "";
    } catch { return ""; }
};

export const critiqueCode = async (code: string, task: string): Promise<any> => {
    if (!getApiKey()) return null;
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Critique this code based on the task: "${task}".
            Code:
            ${code.substring(0, 2000)}...
            
            Return JSON: { "score": number (0-100), "issues": string[], "suggestions": string[], "fixCode": string (optional fully fixed code) }`,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}', null);
    } catch { return null; }
};

export const generateProjectDocs = async (structure: string, type: ProjectType, onStream: (chunk: string) => void) => {
    if (!getApiKey()) { onStream("No API Key"); return; }
    const ai = getAiClient();
    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Generate a professional README.md for this ${type} project structure:\n${structure}\n\nInclude: Introduction, Tech Stack, Setup Instructions, and Folder Overview.`
        });
        for await (const chunk of result) {
            if (chunk.text) onStream(chunk.text);
        }
    } catch (e: any) { onStream(`Error: ${e.message}`); }
};

export const generateTestResults = async (file: string, content: string): Promise<any> => {
    if (!getApiKey()) return { passed: 0, failed: 0, suites: [] };
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this test file and simulate the output result as if it were run by Jest/Vitest.
            File: ${file}
            Content: ${content}
            
            Return JSON: { "passed": number, "failed": number, "duration": number, "suites": [{ "name": string, "status": "pass"|"fail", "assertions": [{ "name": string, "status": "pass"|"fail", "error": string }] }] }`,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}', { passed: 0, failed: 1, suites: [] });
    } catch { return { passed: 0, failed: 1, suites: [] }; }
};

export const generateProjectScaffold = async (description: string, type: ProjectType): Promise<any[]> => {
    if (!getApiKey()) return [];
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Generate a file structure for a ${type} project. Description: "${description}".
            Return ONLY valid JSON array of file nodes.
            Example: [{"name": "src", "type": "directory", "children": [...]}]
            Include basic boilerplate content in "content" field for files.`,
            config: { responseMimeType: 'application/json' }
        });
        const json = safeParseJSON(response.text || '[]', []);
        return Array.isArray(json) ? json : [];
    } catch { return []; }
};

export const generateSong = async (lyrics: string, style?: string, voiceId?: string, referenceUrl?: string): Promise<string> => {
    // Mock for now as song gen is complex
    return "data:audio/wav;base64,UklGRiQA..."; 
};

export const analyzeMediaStyle = async (base64: string, type: 'image' | 'audio' | 'video'): Promise<string> => {
    if (!getApiKey()) return "Analysis unavailable";
    const ai = getAiClient();
    try {
        const data = base64.includes(',') ? base64.split(',')[1] : base64;
        const mimeType = type === 'image' ? 'image/png' : type === 'audio' ? 'audio/wav' : 'video/mp4';
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: "Describe the style, mood, and technical details of this media in one concise paragraph." }
                ]
            }
        });
        return response.text || "Analysis failed";
    } catch { return "Error analyzing media"; }
};

export const generateSocialContent = async (prompt: string, platform: string, onStream: (chunk: string) => void) => {
    if (!getApiKey()) { onStream("Error: No API Key."); return; }
    const ai = getAiClient();
    try {
        const systemInstruction = `You are a viral content creator for ${platform}. Format output as: Scene X: [Visual Style] Description.`;
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction }
        });
        for await (const chunk of result) {
            if (chunk.text) onStream(chunk.text);
        }
    } catch (e: any) { 
        onStream(`Error: ${e.message}`); 
    }
};

export const generateVideo = async (prompt: string, image?: string): Promise<string> => {
    if (!getApiKey()) return "";
    const ai = getAiClient();
    try {
        const request: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        };
        
        if (image) {
            const data = image.includes(',') ? image.split(',')[1] : image;
            request.image = { imageBytes: data, mimeType: 'image/png' };
        }

        let operation = await ai.models.generateVideos(request);
        
        let attempts = 0;
        while (!operation.done && attempts < 20) {
            await new Promise(r => setTimeout(r, 3000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            attempts++;
        }
        
        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (uri) {
            return `${uri}&key=${getApiKey()}`;
        }
    } catch (e) {
        console.error("Video Gen Error", e);
    }
    return "";
};

export const transcribeAudio = async (base64: string): Promise<string> => {
    if (!getApiKey()) return "Transcription unavailable";
    const ai = getAiClient();
    try {
        const data = base64.includes(',') ? base64.split(',')[1] : base64;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { mimeType: 'audio/wav', data } }, { text: "Transcribe this audio exactly." }] }
        });
        return response.text || "Transcription failed";
    } catch { return "Transcription error"; }
};

export const analyzeCharacterFeatures = async (base64: string): Promise<string> => {
    return analyzeMediaStyle(base64, 'image');
};

export const removeBackground = async (base64: string): Promise<string> => {
    return base64;
};

export const runAgentFileTask = async (agent: AIAgent, fileName: string, content: string, context: AgentContext): Promise<string> => {
    const ai = getAiClient();
    const prompt = `Task: Update ${fileName}.\n${context.roadmap ? `Roadmap context: ${JSON.stringify(context.roadmap)}` : ''}\n\nFile Content:\n${content}`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text || content;
};

export const generateChangelog = async (files: string[], taskName: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a concise markdown changelog for task "${taskName}". Modified files: ${files.join(', ')}.`
    });
    return response.text || "Updated files.";
};

export const autoUpdateReadme = async (current: string, changelog: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Append this changelog to the "Recent Updates" section of the README (create if missing). Keep existing content.\n\nREADME:\n${current}\n\nChangelog:\n${changelog}`
    });
    return response.text || current;
};

export const chatWithVoice = async (text: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a voice assistant. Respond conversationally (short, spoken style) to: "${text}"`
    });
    return response.text || "I didn't catch that.";
};

export const generatePerformanceReport = async (structure: string): Promise<PerformanceReport> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this project structure for performance bottlenecks. Return JSON PerformanceReport.\n${structure}`,
        config: { responseMimeType: 'application/json' }
    });
    return safeParseJSON(response.text || '{}', { scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }, opportunities: [] });
};

export const runSecurityAudit = async (structure: string, pkgJson: string): Promise<AuditIssue[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Audit this project for security vulnerabilities. Structure:\n${structure}\nPackage.json:\n${pkgJson}\nReturn JSON array of AuditIssue.`,
        config: { responseMimeType: 'application/json' }
    });
    const res = safeParseJSON(response.text || '[]', []);
    return Array.isArray(res) ? res : [];
};

export const generateSQL = async (nl: string, schema: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Convert to SQL. Schema:\n${schema}\nRequest: ${nl}`
    });
    return response.text || "";
};

export const generateArchitecture = async (desc: string): Promise<{nodes: ArchNode[], links: ArchLink[]}> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate system architecture diagram data (nodes and links) for: "${desc}". Return JSON.`,
        config: { responseMimeType: 'application/json' }
    });
    return safeParseJSON(response.text || '{}', { nodes: [], links: [] });
};

export const generateSyntheticData = async (topic: string, count: number, onStream: (chunk: string) => void) => {
    const ai = getAiClient();
    const result = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: `Generate ${count} synthetic data examples for "${topic}" in JSONL format.`
    });
    for await (const chunk of result) {
        if(chunk.text) onStream(chunk.text);
    }
};

export const testFineTunedModel = async (model: string, prompt: string, onStream: (chunk: string) => void) => {
    // Simulating fine-tuned model call
    const ai = getAiClient();
    const result = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash', 
        contents: `[Model: ${model}] ${prompt}`
    });
    for await (const chunk of result) {
        if(chunk.text) onStream(chunk.text);
    }
};

export const generateCommitMessage = async (files: string[]): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a conventional commit message for changes in: ${files.join(', ')}`
    });
    return response.text?.trim() || "Update files";
};

export const generateProjectPlan = async (desc: string, type: ProjectType): Promise<ProjectPhase[]> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Create a phased development roadmap for a ${type} project: "${desc}". Return JSON array of ProjectPhase.`,
        config: { responseMimeType: 'application/json' }
    });
    const res = safeParseJSON(response.text || '[]', []);
    return Array.isArray(res) ? res : [];
};

export const delegateTasks = async (phase: ProjectPhase, agents: AIAgent[]): Promise<{assignments: any[]}> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Delegate tasks from phase "${phase.title}" to agents: ${agents.map(a=>a.name).join(', ')}. Return JSON { assignments: [{agentName, taskDescription, targetFile}] }`,
        config: { responseMimeType: 'application/json' }
    });
    return safeParseJSON(response.text || '{}', { assignments: [] });
};
