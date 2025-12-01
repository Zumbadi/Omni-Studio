
import { GoogleGenAI, GenerateContentResponse, Type, FunctionDeclaration } from "@google/genai";
import { ProjectType, Voice, ChatMessage, AuditIssue, PerformanceReport, ArchNode, ArchLink, AIAgent, ProjectPhase, AgentContext, TestResult } from "../types";
import { getAllFiles, findNodeByPath, normalizePath } from '../utils/fileHelpers';

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
    let binaryString;
    try {
        binaryString = atob(base64PCM);
    } catch (e) {
        console.error("Failed to decode base64 PCM", e);
        return "";
    }
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
            Is the user asking for a general question, asking for an explanation, or chatting? Return "chat".
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

export const generateSong = async (lyrics: string, style?: string, voiceId?: string, referenceUrl?: string, genre: string = 'Trap Soul'): Promise<string> => {
    if (!getApiKey()) return "";
    const ai = getAiClient();
    try {
        const prompt = `Genre: ${genre}. Style: ${style || 'Soulful'}. (Singing) ${lyrics}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Fenrir' } 
                    }
                }
            }
        });
        
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        if (part && part.inlineData) {
            return pcmToWav(part.inlineData.data);
        }
    } catch (e) {
        console.error("Song Gen Error", e);
    }
    return "";
};

export const generateLyrics = async (prompt: string, genre: string, existingLyrics?: string): Promise<string> => {
    if (!getApiKey()) return "Lyrics generation unavailable without API Key.";
    const ai = getAiClient();
    try {
        let contentPrompt = `Write song lyrics for a ${genre} song about: ${prompt}.`;
        if (existingLyrics) {
            contentPrompt = `Continue these lyrics for a ${genre} song. Only provide the next 4-8 lines.\n\nContext:\n${existingLyrics}`;
        }
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contentPrompt,
            config: {
                maxOutputTokens: 200,
                temperature: 0.8
            }
        });
        return response.text?.trim() || "";
    } catch (e) {
        return "Failed to generate lyrics.";
    }
};

export const generateSoundEffect = async (description: string): Promise<string> => {
    if (!getApiKey()) return "";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text: `(Beatbox Sound Effect) Make a sound of: ${description}` }] },
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Puck' } 
                    }
                }
            }
        });
        
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        if (part && part.inlineData) {
            return pcmToWav(part.inlineData.data);
        }
    } catch (e) {
        console.error("SFX Gen Error", e);
    }
    return "";
};

// --- NEWLY ADDED FUNCTIONS ---

export const transcribeAudio = async (audioData: string): Promise<string> => {
    if (!getApiKey()) return "Transcription unavailable (No API Key)";
    const ai = getAiClient();
    try {
        const data = audioData.split(',')[1];
        const mimeType = audioData.substring(audioData.indexOf(':') + 1, audioData.indexOf(';'));
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: "Transcribe this audio." }
                ]
            }
        });
        return response.text || "";
    } catch (e) {
        console.error("Transcription error", e);
        return "Failed to transcribe.";
    }
};

export const analyzeMediaStyle = async (mediaData: string, type: 'image' | 'video' | 'audio'): Promise<string> => {
    if (!getApiKey()) return "Analysis unavailable";
    const ai = getAiClient();
    try {
        const data = mediaData.split(',')[1];
        const mimeType = mediaData.substring(mediaData.indexOf(':') + 1, mediaData.indexOf(';'));
        
        const prompt = type === 'audio' 
            ? "Analyze the style, genre, and mood of this audio."
            : "Analyze the visual style, lighting, composition, and mood of this image/video. Provide a concise style prompt.";

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: prompt }
                ]
            }
        });
        return response.text || "Analysis failed";
    } catch (e) {
        return "Analysis error";
    }
};

export const generateSocialContent = async (
    prompt: string, 
    platform: string, 
    onStream?: (chunk: string) => void,
    media?: string // Base64 data URI for image/video reference
): Promise<string> => {
    if (!getApiKey()) return "";
    const ai = getAiClient();
    try {
        const parts: any[] = [{ text: `Generate viral content for ${platform}. Prompt: ${prompt}` }];
        
        if (media) {
            const data = media.split(',')[1];
            const mimeType = media.substring(media.indexOf(':') + 1, media.indexOf(';'));
            // Gemini supports multimodal input via inlineData for both images and video (up to size limits)
            parts.push({ inlineData: { mimeType, data } });
        }

        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash', // Supports video and image input
            contents: { role: 'user', parts }
        });
        
        let fullText = "";
        for await (const chunk of result) {
            const text = chunk.text;
            if (text) {
                fullText += text;
                if (onStream) onStream(text);
            }
        }
        return fullText;
    } catch (e) {
        console.error("Generate Content Error", e);
        return "";
    }
};

export const generateVideo = async (prompt: string, image?: string): Promise<string> => {
    const win = window as any;
    
    // Force key selection check if available
    if (win.aistudio && win.aistudio.hasSelectedApiKey) {
        const hasKey = await win.aistudio.hasSelectedApiKey();
        if (!hasKey && win.aistudio.openSelectKey) {
            await win.aistudio.openSelectKey();
        }
    }

    // Function to execute generation
    const executeGen = async (apiKey: string) => {
        const ai = new GoogleGenAI({ apiKey });
        const payload: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        };
        
        if (image) {
            const data = image.split(',')[1];
            const mimeType = image.substring(image.indexOf(':') + 1, image.indexOf(';'));
            payload.image = {
                imageBytes: data,
                mimeType: mimeType
            };
        }

        let operation = await ai.models.generateVideos(payload);
        
        // Poll
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({operation: operation});
        }
        
        if (operation.response?.generatedVideos?.[0]?.video?.uri) {
             const uri = operation.response.generatedVideos[0].video.uri;
             return `${uri}&key=${apiKey}`;
        }
        return "";
    };

    // Priority: Env Key > LocalStorage Key
    // Note: getApiKey() prioritizes LocalStorage. We invert this for Veo because usually Veo requires the injected key.
    let activeKey = process.env.API_KEY;
    if (!activeKey) activeKey = getApiKey(); // Fallback

    try {
        return await executeGen(activeKey);
    } catch (e: any) {
        console.error("Video Gen Error", e);
        const errStr = JSON.stringify(e);
        
        // Handle 404 (Entity Not Found) -> Likely bad key or project
        if (errStr.includes("Requested entity was not found") || e.status === 404 || (e.error && e.error.code === 404)) {
            if (win.aistudio && win.aistudio.openSelectKey) {
                console.log("Veo access error. Requesting key...");
                await win.aistudio.openSelectKey();
                
                // Retry with fresh env key
                const freshKey = process.env.API_KEY || getApiKey();
                try {
                    return await executeGen(freshKey);
                } catch (retryError) {
                    console.error("Retry Video Gen Error", retryError);
                }
            }
        }
        return "";
    }
};

export const removeBackground = async (image: string): Promise<string> => {
    return await editImage(image, "Remove the background, make it white");
};

export const analyzeCharacterFeatures = async (image: string): Promise<string> => {
    return await analyzeMediaStyle(image, 'image'); 
};

export const generateSQL = async (query: string, schema: string): Promise<string> => {
    if (!getApiKey()) return "-- No API Key";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write SQL for: "${query}".\nSchema Context:\n${schema}\nReturn ONLY the SQL.`
        });
        return response.text || "";
    } catch (e) { return "-- Error generating SQL"; }
};

export const generateArchitecture = async (description: string): Promise<{ nodes: ArchNode[], links: ArchLink[] }> => {
    if (!getApiKey()) return { nodes: [], links: [] };
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Design a system architecture for: "${description}".
            Return JSON with "nodes" (id, type, label, x, y, details) and "links" (id, source, target).
            Types can be: frontend, backend, database, auth, storage, function.`,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}', { nodes: [], links: [] });
    } catch (e) { return { nodes: [], links: [] }; }
};

export const generatePerformanceReport = async (codeStructure: string): Promise<PerformanceReport | null> => {
    if (!getApiKey()) return null;
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this project structure for performance:\n${codeStructure}\n\nReturn JSON report with scores (0-100) for performance, accessibility, bestPractices, seo and list of opportunities.`,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}', null);
    } catch (e) { return null; }
};

export const runSecurityAudit = async (codeStructure: string, packageJson: string): Promise<AuditIssue[]> => {
    if (!getApiKey()) return [];
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Perform a security audit on this project.\nStructure:\n${codeStructure}\nDependencies:\n${packageJson}\n\nReturn JSON array of issues (id, severity, title, description, file).`,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '[]', []);
    } catch (e) { return []; }
};

export const generateCommitMessage = async (diff: string[]): Promise<string> => {
    if (!getApiKey()) return "Update files";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a concise git commit message for changes in these files: ${diff.join(', ')}.`
        });
        return response.text?.trim() || "Update files";
    } catch (e) { return "Update files"; }
};

export const generateSyntheticData = async (topic: string, count: number, onStream?: (chunk: string) => void): Promise<void> => {
    if (!getApiKey()) return;
    const ai = getAiClient();
    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Generate ${count} synthetic examples for "${topic}" in JSONL format.`
        });
        for await (const chunk of result) {
            if (chunk.text && onStream) onStream(chunk.text);
        }
    } catch (e) {}
};

export const testFineTunedModel = async (modelName: string, prompt: string, onStream: (chunk: string) => void): Promise<void> => {
    if (!getApiKey()) { onStream("No API Key"); return; }
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash', // Fallback for demo
            contents: `[Simulating ${modelName}] ${prompt}`
        });
        for await (const chunk of response) {
            if (chunk.text) onStream(chunk.text);
        }
    } catch (e: any) { onStream(`Error: ${e.message}`); }
};

export const chatWithVoice = async (input: string): Promise<string> => {
    if (!getApiKey()) return "I can't hear you without an API Key.";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `User said: "${input}". Reply conversationally and briefly.`
        });
        return response.text || "I didn't catch that.";
    } catch (e) { return "Error processing voice."; }
};

export const delegateTasks = async (phase: ProjectPhase, agents: AIAgent[]): Promise<{ assignments: any[] }> => {
    if (!getApiKey()) return { assignments: [] };
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Phase: ${phase.title}\nGoals: ${phase.goals.join(', ')}\nAgents: ${agents.map(a => a.name + " (" + a.role + ")").join(', ')}\n\nAssign tasks to agents. Return JSON { "assignments": [{ "agentName": string, "taskDescription": string, "targetFile": string }] }`,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}', { assignments: [] });
    } catch (e) { return { assignments: [] }; }
};

export const generateProjectPlan = async (description: string, type: string): Promise<ProjectPhase[]> => {
    if (!getApiKey()) return [];
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Create a development roadmap for a ${type} project: "${description}".
            Return JSON array of phases. Each phase has { "id": string, "title": string, "status": "pending", "goals": string[], "tasks": [{ "id": string, "text": string, "done": boolean }] }`,
            config: { responseMimeType: 'application/json' }
        });
        const json = safeParseJSON(response.text || '[]', []);
        return Array.isArray(json) ? json : [];
    } catch (e) { return []; }
};

export const runAgentFileTask = async (agent: AIAgent, fileName: string, content: string, context: AgentContext): Promise<string> => {
    const { code } = await executeBuildTask(agent, fileName, content, "Improve and fix issues.", context);
    return code;
};

export const generateChangelog = async (files: string[], taskName: string): Promise<string> => {
    if (!getApiKey()) return `Updated ${files.length} files.`;
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a brief changelog for task "${taskName}". Modified files: ${files.join(', ')}.`
        });
        return response.text || "Updated files.";
    } catch (e) { return "Updated files."; }
};

export const autoUpdateReadme = async (currentContent: string, changelog: string): Promise<string> => {
    if (!getApiKey()) return currentContent;
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Append this changelog to the README:\n${changelog}\n\nCurrent README:\n${currentContent}`
        });
        return response.text || currentContent;
    } catch (e) { return currentContent; }
};
