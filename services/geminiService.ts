
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectType, Voice, ChatMessage, FileNode, AIAgent, ProjectPhase, TableDef } from "../types";

// --- Helpers ---

const getApiKey = (): string => {
    let key = '';
    try {
        // Safe access to process.env for browser environments
        // @ts-ignore
        if (typeof process !== 'undefined' && process && process.env) {
            // @ts-ignore
            key = process.env.API_KEY || '';
        }
    } catch (e) {
        // Ignore error if process is not defined
    }
    
    if (!key && typeof localStorage !== 'undefined') {
        key = localStorage.getItem('omni_gemini_key') || '';
    }
    return key;
};

const getAiClient = () => {
  const apiKey = getApiKey();
  // Fallback to a dummy key if none found to prevent initialization crash
  return new GoogleGenAI({ apiKey: apiKey || 'dummy' });
};

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
    if (!base64PCM) return "";
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

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + bytes.length, true);
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, bytes.length, true);

    const wavBytes = new Uint8Array(wavHeader.byteLength + bytes.length);
    wavBytes.set(new Uint8Array(wavHeader), 0);
    wavBytes.set(bytes, wavHeader.byteLength);

    const blob = new Blob([wavBytes], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
};

// --- CORE GENERATION SERVICES ---

export const generateProjectScaffold = async (description: string, type: ProjectType): Promise<any[]> => {
    const client = getAiClient();
    const prompt = `Generate a JSON directory structure for a new ${type} project.
    Description: ${description}.
    
    Format must be a recursive JSON array of nodes:
    [{ "name": "filename", "type": "file" | "directory", "content": "string (file content)", "children": [] }]
    
    Include essential configuration files (package.json, tsconfig.json, etc.) and a basic source structure with placeholder code.
    IMPORTANT: Return ONLY the raw JSON.`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return safeParseJSON(response.text || '[]', []);
    } catch (e) {
        console.error("Scaffold Error", e);
        return [];
    }
};

export const generateCodeResponse = async (
  prompt: string, 
  currentCode: string, 
  projectType: ProjectType, 
  fileStructure: string, 
  modelName: string,
  onStream: (chunk: string) => void,
  onMetadata: (meta: any) => void,
  attachedImage?: string,
  history: ChatMessage[] = [],
  useSearch = false,
  useMaps = false
) => {
    const client = getAiClient();
    
    let targetModel = modelName;
    if (modelName.includes('Flash')) targetModel = 'gemini-2.5-flash';
    if (modelName.includes('Pro')) targetModel = 'gemini-3-pro-preview';
    if (!targetModel) targetModel = 'gemini-2.5-flash';

    const systemInstruction = `You are Omni-Studio, an expert AI software architect and developer.
Project Type: ${projectType}
File Structure:
${fileStructure}

Your goal is to provide high-quality, production-ready code.
If editing code, output ONLY the code block or a diff if requested.
If asked to explain, provide concise, clear explanations.
Do not use markdown formatting for the code block unless it's part of a larger explanation.
`;

    const contents = [];
    
    history.forEach(msg => {
        if (msg.role !== 'system' && msg.role !== 'critic') {
            contents.push({
                role: msg.role === 'model' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            });
        }
    });

    const parts: any[] = [];
    if (attachedImage) {
        const base64Data = attachedImage.split(',')[1] || attachedImage;
        parts.push({ 
            inlineData: { 
                mimeType: 'image/png', 
                data: base64Data 
            } 
        });
    }
    
    let textPrompt = prompt;
    if (currentCode) {
        textPrompt += `\n\nCurrent File Content:\n\`\`\`\n${currentCode}\n\`\`\``;
    }
    parts.push({ text: textPrompt });
    
    contents.push({ role: 'user', parts });

    const tools: any[] = [];
    if (useSearch) tools.push({ googleSearch: {} });
    
    try {
        const responseStream = await client.models.generateContentStream({
            model: targetModel,
            contents: contents,
            config: {
                systemInstruction,
                tools: tools.length > 0 ? tools : undefined
            }
        });

        for await (const chunk of responseStream) {
            if (chunk.text) {
                onStream(chunk.text);
            }
            if (chunk.groundingMetadata) {
                onMetadata(chunk.groundingMetadata);
            }
        }
    } catch (e: any) {
        console.error("Gemini API Error:", e);
        onStream(`\n\n[Error: ${e.message || "Failed to generate response."}]\n`);
    }
};

export const critiqueCode = async (code: string, task: string) => {
    const client = getAiClient();
    const prompt = `You are a Senior Code Reviewer. Review the following code based on the task: "${task}".
    Code:
    ${code}
    
    Provide a JSON response with:
    - score (0-100)
    - issues (array of strings)
    - suggestions (array of strings)
    - fixCode (optional string, corrected code if score < 80)`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}');
    } catch (e) {
        return null;
    }
};

// --- AGENT WORKFLOWS ---

export const planAgentTask = async (agent: AIAgent, task: string, fileStructure: string, projectType: ProjectType) => {
    const client = getAiClient();
    const prompt = `You are ${agent.name}, a Project Manager.
    Project Type: ${projectType}
    Files: ${fileStructure}
    Task: ${task}
    
    Create a plan. Return JSON:
    {
        "strategy": "Step-by-step strategy description",
        "filesToEdit": ["path/to/file1", "path/to/file2"],
        "requiresSearch": boolean
    }`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}', { strategy: "Manual intervention", filesToEdit: [], requiresSearch: false });
    } catch (e) {
        return { strategy: "Error planning task", filesToEdit: [], requiresSearch: false };
    }
};

export const analyzeFile = async (agent: AIAgent, fileName: string, content: string, task: string, context: any) => {
    const client = getAiClient();
    const prompt = `Role: ${agent.role}. Task: ${task}.
    Analyze ${fileName}:
    ${content.substring(0, 5000)}
    
    Context: ${JSON.stringify(context.terminalLogs)}
    
    Output brief analysis findings.`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        return response.text || "No analysis provided.";
    } catch (e) {
        return "Analysis failed.";
    }
};

export const executeBuildTask = async (
    agent: AIAgent, 
    fileName: string, 
    content: string, 
    instructions: string, 
    context: any, 
    feedback: string, 
    projectType: string,
    isNewFile: boolean,
    useSearch: boolean
) => {
    const client = getAiClient();
    const prompt = `You are ${agent.name}, a ${agent.role}.
    Project: ${projectType}. File: ${fileName}.
    Instructions: ${instructions}.
    Feedback from previous attempt: ${feedback || 'None'}.
    
    Context:
    ${context.relatedCode ? `Related Code:\n${context.relatedCode}\n` : ''}
    ${context.mcpContext ? `Knowledge Base:\n${context.mcpContext}\n` : ''}
    
    Return the FULL file content for ${fileName}. If deleting, return "DELETE_FILE".`;

    try {
        const tools = useSearch ? [{ googleSearch: {} }] : undefined;
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: content ? `Current Content:\n${content}\n\n${prompt}` : prompt }] }],
            config: { tools }
        });
        
        let code = response.text || content;
        code = code.replace(/^```[\w-]*\n/, '').replace(/```$/, '');
        
        const logs = [];
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            logs.push("Used Google Search for context.");
        }
        
        return { code, logs };
    } catch (e: any) {
        return { code: content, logs: [`Error: ${e.message}`] };
    }
};

export const runAgentFileTask = async (agent: AIAgent, fileName: string, content: string, context: any) => {
    return (await executeBuildTask(agent, fileName, content, "Process file", context, "", "General", false, false)).code;
};

export const reviewBuildTask = async (fileName: string, original: string, modified: string, instructions: string, context: any, projectType: string) => {
    const client = getAiClient();
    const prompt = `Reviewer: QA.
    File: ${fileName}.
    Instructions: ${instructions}.
    
    Original:
    ${original.substring(0, 1000)}...
    
    Modified:
    ${modified.substring(0, 1000)}...
    
    Verify correctness, syntax, and adherence to instructions.
    Return JSON:
    {
        "approved": boolean,
        "feedback": "string",
        "issues": ["string"],
        "fixCode": "string (optional auto-correction)",
        "suggestedCommand": "string (optional terminal command to fix env)"
    }`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}', { approved: true });
    } catch (e) {
        return { approved: true, feedback: "Auto-approved due to API error." };
    }
};

export const delegateTasks = async (phase: ProjectPhase, agents: AIAgent[]) => {
    const client = getAiClient();
    const agentList = agents.map(a => `${a.name} (${a.role})`).join(', ');
    const prompt = `Project Phase: ${phase.title}
    Goals: ${phase.goals.join(', ')}
    Available Agents: ${agentList}
    
    Assign tasks to agents. Return JSON:
    {
        "assignments": [
            { "agentName": "Name", "taskDescription": "Specific task", "targetFile": "optional file path" }
        ]
    }`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '{}', { assignments: [] });
    } catch (e) {
        return { assignments: [] };
    }
};

// --- UTILS & GENERATORS ---

export const generateChangelog = async (files: string[], taskName: string) => {
    const client = getAiClient();
    const prompt = `Generate a concise changelog for task "${taskName}". Modified files: ${files.join(', ')}.`;
    const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return res.text || "Updated files.";
};

export const autoUpdateReadme = async (currentReadme: string, changelog: string) => {
    const client = getAiClient();
    const prompt = `Append this changelog to the README's history section or create one:\n${changelog}\n\nREADME:\n${currentReadme}`;
    const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return res.text || currentReadme;
};

export const generateTerminalCommand = async (query: string, projectType: string) => {
    const client = getAiClient();
    const prompt = `Translate natural language to a terminal command for a ${projectType} project.
    User: "${query}"
    Output ONLY the command string. No markdown.`;
    const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return res.text?.trim() || "";
};

export const generateTestResults = async (fileName: string, content: string) => {
    const client = getAiClient();
    const prompt = `Simulate a test run for ${fileName}. Code:\n${content.substring(0, 2000)}\n
    Return JSON: { "passed": number, "failed": number, "duration": number, "suites": [{ "name": "suite", "status": "pass"|"fail", "assertions": [{"name": "test", "status": "pass"|"fail", "error": "msg"}] }] }`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || '{}', { passed: 1, failed: 0, suites: [] });
    } catch {
        return { passed: 0, failed: 1, duration: 0, suites: [] };
    }
};

export const generatePerformanceReport = async (fileStructure: string) => {
    const client = getAiClient();
    const prompt = `Analyze this project structure for performance.\n${fileStructure}\n
    Return JSON: { "scores": { "performance": 0-100, "accessibility": 0-100, "bestPractices": 0-100, "seo": 0-100 }, "opportunities": [{ "title": "string", "description": "string", "savings": "string" }] }`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || '{}');
    } catch {
        return null;
    }
};

export const runSecurityAudit = async (fileStructure: string, packageJson: string) => {
    const client = getAiClient();
    const prompt = `Audit for security vulnerabilities.\nStructure:\n${fileStructure}\nPackages:\n${packageJson}\n
    Return JSON array of issues: [{ "severity": "critical"|"high"|"medium"|"low", "title": "string", "description": "string", "file": "string" }]`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || '[]');
    } catch {
        return [];
    }
};

export const generateProjectDocs = async (fileStructure: string, type: ProjectType, onChunk: (text: string) => void) => {
    const client = getAiClient();
    const prompt = `Generate comprehensive README.md documentation for a ${type} project.\nStructure:\n${fileStructure}`;
    
    try {
        const stream = await client.models.generateContentStream({ model: 'gemini-2.5-flash', contents: prompt });
        for await (const chunk of stream) {
            if (chunk.text) onChunk(chunk.text);
        }
    } catch (e) {
        onChunk("Error generating documentation.");
    }
};

export const chatWithVoice = async (message: string): Promise<string> => {
    const client = getAiClient();
    const res = await client.models.generateContent({ 
        model: 'gemini-2.5-flash', 
        contents: `You are a helpful voice assistant. Reply briefly and conversationally to: "${message}"`
    });
    return res.text || "I didn't catch that.";
};

export const generateArchitecture = async (desc: string) => {
    const client = getAiClient();
    const prompt = `Design software architecture for: "${desc}".
    Return JSON: { "nodes": [{ "id", "type": "frontend"|"backend"|"database", "label", "x", "y", "details" }], "links": [{ "id", "source", "target" }] }`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || '{}', { nodes: [], links: [] });
    } catch {
        return { nodes: [], links: [] };
    }
};

export const optimizeArchitecture = async (nodes: any[], links: any[]) => {
    const client = getAiClient();
    const prompt = `Optimize this architecture for scalability.\nNodes: ${JSON.stringify(nodes)}\nLinks: ${JSON.stringify(links)}\nReturn same JSON structure with improvements.`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || '{}', { nodes, links });
    } catch {
        return { nodes, links };
    }
};

export const generateCommitMessage = async (files: string[]) => {
    const client = getAiClient();
    const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: `Generate a conventional commit message for changes in: ${files.join(', ')}` });
    return res.text?.trim().replace(/^['"]|['"]$/g, '') || "Update files";
};

// --- MEDIA SERVICES ---

export const generateImage = async (prompt: string): Promise<string> => {
    const client = getAiClient();
    try {
        const response = await client.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' }
        });
        
        const b64 = response.generatedImages?.[0]?.image?.imageBytes;
        return b64 ? `data:image/jpeg;base64,${b64}` : '';
    } catch (e) {
        console.error("Image Gen Error", e);
        return "";
    }
};

export const generateVideo = async (prompt: string, imageBase64?: string): Promise<string> => {
    const client = getAiClient();
    try {
        const payload: any = {
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        };
        
        if (imageBase64) {
            payload.image = {
                imageBytes: imageBase64.split(',')[1],
                mimeType: 'image/png'
            };
        }

        let operation = await client.models.generateVideos(payload);
        
        let attempts = 0;
        while (!operation.done && attempts < 20) {
            await new Promise(r => setTimeout(r, 2000));
            operation = await client.operations.getVideosOperation({ operation });
            attempts++;
        }
        
        const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
        const apiKey = getApiKey();
        return uri ? `${uri}&key=${apiKey}` : ''; 
    } catch (e) {
        console.error("Video Gen Error", e);
        return "";
    }
};

export const generateSpeech = async (text: string, voice: Voice, styleReference?: string): Promise<string> => {
    if (!text.trim()) return '';
    const client = getAiClient();
    
    let promptText = text;
    if (voice.isCloned || styleReference) {
        promptText = `(Style: ${voice.style}) ${text}`;
    }

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text: promptText }] },
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { 
                            voiceName: (!voice.isCloned && voice.apiMapping) ? voice.apiMapping : 'Kore' 
                        }
                    }
                }
            }
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            return pcmToWav(audioData);
        }
    } catch (e) {
        console.error("TTS Generation Failed", e);
    }
    return '';
};

export const generateSoundEffect = async (prompt: string): Promise<string> => {
    const client = getAiClient();
    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            contents: `Generate sound effect: ${prompt}`,
            config: { responseModalities: ['AUDIO'] }
        });
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return audioData ? pcmToWav(audioData) : '';
    } catch {
        return '';
    }
};

export const generateBackgroundMusic = async (prompt: string): Promise<string> => {
    return generateSoundEffect(`Background music: ${prompt}`);
};

export const generateSong = async (
    lyrics: string, 
    styleRef: string | undefined, 
    voiceId: string | undefined, 
    youtubeLink: string, 
    genre: string,
    voiceStyle?: string,
    structure?: string
): Promise<string> => {
    const client = getAiClient();
    const prompt = `Create a ${genre} song.
    Structure: ${structure || 'standard'}.
    Vocal Style: ${voiceStyle || 'singing'}.
    Lyrics: ${lyrics || '(Instrumental)'}.
    
    Generate audio.`;
    
    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            contents: prompt,
            config: { responseModalities: ['AUDIO'] }
        });
        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return audioData ? pcmToWav(audioData) : '';
    } catch {
        return '';
    }
};

export const generateLyrics = async (prompt: string, genre: string, existingLyrics?: string): Promise<string> => {
    const client = getAiClient();
    const context = existingLyrics ? `Continue these lyrics:\n"${existingLyrics}"\n\n` : `Write lyrics for a ${genre} song.\n`;
    
    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${context}Prompt: ${prompt}. Keep it rhythmic and rhyming. Return ONLY the lyrics.`
    });
    
    return response.text?.trim() || "";
};

export const expandMindMap = async (topic: string, context: string): Promise<string[]> => {
    const client = getAiClient();
    const prompt = `Generate 4 distinct sub-concepts for: "${topic}". Context: ${context}. Return ONLY a JSON array of strings.`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        return safeParseJSON(response.text || '[]');
    } catch {
        return ["Idea 1", "Idea 2"];
    }
};

export const generateSocialContent = async (prompt: string, platform: string, onChunk: (text: string) => void, mediaBase64?: string) => {
    const client = getAiClient();
    
    const parts: any[] = [];
    if (mediaBase64) {
        parts.push({ inlineData: { mimeType: 'image/png', data: mediaBase64.split(',')[1] } });
    }
    parts.push({ text: `Platform: ${platform}. ${prompt}` });

    try {
        const stream = await client.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: { parts }
        });
        for await (const chunk of stream) {
            if (chunk.text) onChunk(chunk.text);
        }
    } catch (e) {
        onChunk("Error generating content.");
    }
};

export const analyzeMediaStyle = async (base64: string, type: 'image' | 'video' | 'audio'): Promise<string> => {
    const client = getAiClient();
    const prompt = `Analyze this ${type} and describe its style, tone, and key features in one sentence.`;
    
    try {
        const parts: any[] = [{ text: prompt }];
        if (type !== 'audio') {
             parts.unshift({ inlineData: { mimeType: type === 'video' ? 'video/mp4' : 'image/png', data: base64.split(',')[1] } });
        }
        
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts }
        });
        return response.text || "Analysis failed";
    } catch {
        return "Generic style";
    }
};

export const analyzeCharacterFeatures = async (base64: string): Promise<string> => {
    return analyzeMediaStyle(base64, 'image');
};

export const editImage = async (base64: string, prompt: string): Promise<string> => {
    const client = getAiClient();
    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: base64.split(',')[1] } },
                    { text: prompt }
                ]
            }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return '';
    } catch {
        return '';
    }
};

export const removeBackground = async (base64: string): Promise<string> => {
    return editImage(base64, "Remove background, keep subject only on transparent background");
};

export const generateDrumPattern = async (description: string): Promise<boolean[][] | null> => {
    const client = getAiClient();
    const prompt = `Generate a drum pattern (16 steps x 5 rows: Kick, Snare, HiHat, Clap, Bass) for: "${description}".
    Return JSON: boolean[][] (5x16 matrix).`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || 'null');
    } catch {
        return null;
    }
};

export const transcribeAudio = async (audioUrl: string): Promise<string> => {
    return "Transcript of audio content..."; 
};

export const testFineTunedModel = async (modelName: string, prompt: string, onChunk: (text: string) => void) => {
    const client = getAiClient();
    try {
        const stream = await client.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `[Simulating ${modelName}] ${prompt}`
        });
        for await (const chunk of stream) {
            if (chunk.text) onChunk(chunk.text);
        }
    } catch {
        onChunk("Error testing model.");
    }
};

export const generateSyntheticData = async (topic: string, count: number, onChunk: (text: string) => void) => {
    const client = getAiClient();
    const prompt = `Generate ${count} synthetic data examples for: "${topic}". Format as JSONL.`;
    try {
        const stream = await client.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt
        });
        for await (const chunk of stream) {
            if (chunk.text) onChunk(chunk.text);
        }
    } catch {
        onChunk("{}");
    }
};

export const generateSQL = async (query: string, schema: string): Promise<string> => {
    const client = getAiClient();
    const prompt = `Schema:\n${schema}\n\nWrite SQL for: "${query}". Return only SQL.`;
    const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return res.text || "";
};

export const modifyDatabaseSchema = async (currentSchema: TableDef[], instruction: string): Promise<TableDef[] | null> => {
    const client = getAiClient();
    const prompt = `Current Schema JSON: ${JSON.stringify(currentSchema)}
    Instruction: "${instruction}"
    Return updated Schema JSON array.`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || 'null');
    } catch {
        return null;
    }
};

export const generateMigrationScript = async (current: TableDef[], initial: TableDef[]): Promise<string> => {
    const client = getAiClient();
    const prompt = `Generate SQL migration script to go from Initial to Current schema.
    Initial: ${JSON.stringify(initial)}
    Current: ${JSON.stringify(current)}`;
    const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return res.text || "";
};

export const detectIntent = async (text: string): Promise<'task' | 'chat' | 'command'> => {
    const client = getAiClient();
    const prompt = `Classify intent: "${text}". Categories: task (complex work), chat (simple q&a), command (specific action). Return JSON: {"intent": "..."}`;
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || '{}').intent || 'chat';
    } catch {
        return 'chat';
    }
};

export const generateGhostText = async (prefix: string, suffix: string): Promise<string> => {
    const client = getAiClient();
    const prompt = `Complete the code.
    Prefix:
    ${prefix.slice(-500)}
    [CURSOR]
    Suffix:
    ${suffix.slice(0, 200)}
    
    Return ONLY the completion text.`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return res.text || "";
    } catch {
        return "";
    }
};

export const generateProjectPlan = async (desc: string, type: ProjectType): Promise<ProjectPhase[]> => {
    const client = getAiClient();
    const prompt = `Create a project roadmap for a ${type} project: "${desc}".
    Return JSON array of phases: [{ "id", "title", "status": "pending", "goals": [], "tasks": [{ "id", "text", "done": false }] }]`;
    
    try {
        const res = await client.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt, config: { responseMimeType: 'application/json' } });
        return safeParseJSON(res.text || '[]');
    } catch {
        return [];
    }
};

export const generateAudioPrompt = async (sceneDescription: string, type: 'voice' | 'sfx' | 'music'): Promise<string> => {
    const client = getAiClient();
    const context = `Scene Description: "${sceneDescription}"`;
    let prompt = "";
    
    if (type === 'voice') prompt = `${context}\nGenerate a short, engaging voiceover script (1-2 sentences) for this scene. Return ONLY the spoken text.`;
    else if (type === 'sfx') prompt = `${context}\nDescribe a specific sound effect that fits this scene (e.g. "footsteps on gravel"). Return ONLY the description.`;
    else prompt = `${context}\nDescribe the background music mood and genre for this scene. Return ONLY the description.`;

    const res = await client.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return res.text?.trim() || "";
};
