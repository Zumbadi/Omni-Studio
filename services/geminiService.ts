
import { GoogleGenAI, Modality } from "@google/genai";
import { ProjectType, Voice, ChatMessage, AuditIssue, PerformanceReport, ArchNode, ArchLink, AIAgent } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

// Helper to check for external provider configuration
const getProviderConfig = (modelName: string) => {
    try {
        const providers = JSON.parse(localStorage.getItem('omni_api_providers') || '[]');
        const matchingProvider = providers.find((p: any) => modelName.includes(p.name));
        if (matchingProvider) {
            return {
                type: matchingProvider.type,
                key: matchingProvider.key,
                name: matchingProvider.name
            };
        }
    } catch (e) {
        console.warn("Failed to load provider config", e);
    }
    return null;
};

// Helper to clean JSON output from LLM
const cleanJson = (text: string): string => {
    if (!text) return '{}';
    let cleaned = text.trim();
    // Remove markdown code blocks
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '');
    return cleaned;
};

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
  if (!process.env.API_KEY) {
    onStream("Error: No API Key found in environment variables.");
    return;
  }

  const ai = getAiClient();
  const providerConfig = getProviderConfig(modelName);
  
  const isNative = projectType === ProjectType.REACT_NATIVE;
  const isIOS = projectType === ProjectType.IOS_APP;
  const isAndroid = projectType === ProjectType.ANDROID_APP;

  // Determine actual model to use vs persona to simulate
  let targetModel = 'gemini-2.5-flash';
  let customPersona = '';
  let thinkingBudget = 0;

  // Enhanced Logic for External Providers
  if (providerConfig) {
      if (providerConfig.type === 'openai') {
          customPersona = "SYSTEM: You are simulating GPT-4o. Be concise, highly logical, and prefer advanced modern syntax. Use the user's provided API Key if applicable (simulation).";
      } else if (providerConfig.type === 'anthropic') {
          customPersona = "SYSTEM: You are simulating Claude 3.5 Sonnet. Be articulate, thorough, and prioritize safety and code quality.";
      } else if (providerConfig.type === 'groq') {
          customPersona = "SYSTEM: You are simulating Llama 3 running on Groq. Be extremely fast and direct.";
      }
      
      if (providerConfig.key) {
          // In a real backend, we would use this key. Here we just log it to simulate the connection.
          console.log(`[Omni-Studio] Using external provider key for ${providerConfig.name}: ${providerConfig.key.substring(0,4)}...`);
      }
  } else {
      // Standard Gemini Logic
      if (modelName.startsWith('Gemini 2.5 Pro') || modelName.startsWith('gemini-3-pro')) {
        targetModel = 'gemini-3-pro-preview';
        thinkingBudget = 1024;
      } else if (modelName.startsWith('Gemini 2.5 Flash')) {
        targetModel = 'gemini-2.5-flash';
      } else if (modelName) {
        customPersona = `You are behaving as the custom fine-tuned model "${modelName}". Adopt the specific style, strictness, or domain knowledge associated with this model name.`;
      }
  }

  let frameworkInstruction = '';
  if (isNative) {
      frameworkInstruction = `You are an expert in React Native (Expo). 
       - Use <View>, <Text>, <TouchableOpacity>, <Image>, <ScrollView> components from 'react-native'.
       - Use StyleSheet.create for styling.
       - DO NOT use HTML tags like <div>, <span>, <button>.
       - DO NOT use Tailwind CSS classes.`;
  } else if (isIOS) {
      frameworkInstruction = `You are an expert iOS Developer using Swift and SwiftUI.
       - Write Swift code.
       - Use SwiftUI Views (VStack, HStack, Text, Button, Image).
       - Adhere to MVVM architecture.`;
  } else if (isAndroid) {
      frameworkInstruction = `You are an expert Android Developer using Kotlin and Jetpack Compose.
       - Write Kotlin code.
       - Use Composables (Column, Row, Text, Button, Image).
       - Adhere to modern Android best practices.`;
  } else {
      frameworkInstruction = `You are an expert in React Web and Tailwind CSS.
       - Use standard HTML tags like <div>, <span>, <button>.
       - Use Tailwind CSS classes for styling.`;
  }

  try {
    const systemInstruction = `
      You are the Omni-Studio Coding Assistant. 
      ${customPersona}
      ${frameworkInstruction}
      Your goal is to generate production-ready code based on the user's request.
      
      PROJECT CONTEXT:
      The user is working on a ${projectType} project with the following file structure:
      ${fileStructure}

      INSTRUCTIONS:
      - CRITICAL: If you are creating a new file or updating a specific existing file, YOU MUST start the code block with a comment specifying the relative path.
      - Format: "// filename: src/components/MyComponent.tsx" (Adjust extension for Swift/Kotlin if needed)
      - If no filename is specified, the user will assume it applies to the currently open file.
      - Do not provide markdown fences around the code if possible, or strictly just the code content inside the fences.
      
      CURRENT FILE CONTEXT:
      \`\`\`typescript
      ${currentFileContent}
      \`\`\`
    `;

    const history = chatHistory
        .filter(msg => msg.role === 'user' || msg.role === 'model')
        .map(msg => ({
            role: msg.role === 'model' ? 'model' : 'user',
            parts: [{ text: msg.text }]
        }));

    const chat = ai.chats.create({
      model: targetModel,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget }
      },
      history: history as any
    });

    const parts: any[] = [{ text: prompt }];
    
    if (imageData) {
       const [meta, data] = imageData.split(',');
       const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png';
       parts.unshift({
           inlineData: {
               mimeType: mimeType,
               data: data
           }
       });
    }

    const result = await chat.sendMessageStream({ 
        message: { 
            role: 'user', 
            parts: parts 
        } 
    });

    for await (const chunk of result) {
      if (chunk.text) {
        onStream(chunk.text);
      }
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    onStream(`\nError generating code: ${error.message || 'Unknown error'}`);
  }
};

export const generateGhostText = async (prefix: string, suffix: string): Promise<string> => {
  if (!process.env.API_KEY) return "";
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
  if (!process.env.API_KEY) return "API Key missing.";
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction: "You are Omni, a helpful voice assistant. Keep responses short and conversational." }
    });
    return response.text || "I didn't catch that.";
  } catch (e) { return "Connection error."; }
};

export const generateProjectScaffold = async (prompt: string, type: ProjectType): Promise<any[]> => {
  if (!process.env.API_KEY) return [];
  const ai = getAiClient();
  
  const isNative = type === ProjectType.REACT_NATIVE;
  const isIOS = type === ProjectType.IOS_APP;
  const isAndroid = type === ProjectType.ANDROID_APP;
  const isBackend = type === ProjectType.NODE_API;

  const systemInstruction = `You are a Senior Software Architect. Generate a JSON structure representing the file tree for a new ${type} project.
  Rules: Return ONLY raw JSON array. Schema: { "name": string, "type": "file"|"directory", "content"?: string, "children"?: Node[] }.
  Include essential files. ${isNative ? 'Use React Native.' : isIOS ? 'Use Swift.' : isAndroid ? 'Use Kotlin.' : isBackend ? 'Use Express.' : 'Use React.'}
  User Description: "${prompt}"`;

  try {
    const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: "Generate structure.",
       config: { systemInstruction, responseMimeType: 'application/json' }
    });
    const clean = cleanJson(response.text || '[]');
    return JSON.parse(clean);
  } catch (e) { return []; }
};

export const generateProjectPlan = async (description: string, type: ProjectType): Promise<any[]> => {
  if (!process.env.API_KEY) return [];
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Generate roadmap.",
        config: { 
            systemInstruction: `Create a 3-phase roadmap JSON for a ${type} project: "${description}". Schema: [{id, title, status, goals:[], tasks:[{id, text, done}]}]`, 
            responseMimeType: 'application/json' 
        }
    });
    const clean = cleanJson(response.text || '[]');
    return JSON.parse(clean);
  } catch(e) { return []; }
};

export const generateProjectDocs = async (fileStructure: string, type: ProjectType, onStream: (chunk: string) => void): Promise<void> => {
    if (!process.env.API_KEY) { onStream("API Key missing."); return; }
    const ai = getAiClient();
    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: "Generate README.",
            config: { systemInstruction: `Write a README.md for a ${type} project with structure:\n${fileStructure}` }
        });
        for await (const chunk of result) if (chunk.text) onStream(chunk.text);
    } catch (e: any) { onStream(`Error: ${e.message}`); }
};

export const runAgentFileTask = async (agent: AIAgent, fileName: string, fileContent: string): Promise<string | null> => {
    if (!process.env.API_KEY) return null;
    const ai = getAiClient();

    // Use the agent's preferred model
    const targetModel = agent.model === 'gemini-3-pro-preview' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
    
    // Construct prompt based on agent's persona
    const systemInstruction = `
        ${agent.systemPrompt}
        
        IDENTITY: You are ${agent.name}, a ${agent.role}.
        TASK: Apply your expertise to the provided file.
        OUTPUT FORMAT: Return the complete updated file content. Start with the comment "// filename: ${fileName}".
    `;
    
    const prompt = `Here is the content of ${fileName}:\n\n${fileContent}\n\nPlease perform your assigned role on this code.`;

    try {
        const response = await ai.models.generateContent({
            model: targetModel,
            contents: prompt,
            config: { systemInstruction }
        });
        return response.text || null;
    } catch (e) {
        console.error(`Agent ${agent.name} failed:`, e);
        return null;
    }
};

export const critiqueCode = async (code: string, task: string): Promise<any> => {
  if (!process.env.API_KEY) return null;
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Task: ${task}\nCode:\n${code}`,
        config: { 
            systemInstruction: `You are Omni-Critic. Review the provided code snippet.
            
            Return a JSON object with the following structure:
            {
              "score": 0-100,
              "issues": ["Critical issue 1", "Performance issue 2"],
              "suggestions": ["Suggestion 1", "Suggestion 2"]
            }
            
            Be strict. Check for:
            1. Bugs and Logic Errors
            2. Security Vulnerabilities
            3. Performance Bottlenecks
            4. Code Style and Best Practices`,
            responseMimeType: 'application/json' 
        }
    });
    const clean = cleanJson(response.text || '{}');
    return JSON.parse(clean);
  } catch(e) { return null; }
};

export const analyzeDataset = async (datasetSummary: string): Promise<string> => {
   if (!process.env.API_KEY) return "API Key missing.";
   const ai = getAiClient();
   try {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze dataset: ${datasetSummary}. Suggest LoRA params.`,
     });
     return response.text || "Analysis failed.";
   } catch (e) { return "Error."; }
}

export const generateSyntheticData = async (topic: string, count: number, onStream: (chunk: string) => void): Promise<void> => {
    if (!process.env.API_KEY) { onStream("Error: API Key missing."); return; }
    const ai = getAiClient();
    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Generate ${count} examples.`,
            config: { systemInstruction: `Generate JSONL dataset for topic "${topic}". Format: {"messages": [{"role": "user", ...}, {"role": "model", ...}]}`, temperature: 0.8 }
        });
        for await (const chunk of result) if (chunk.text) onStream(chunk.text);
    } catch (e: any) { onStream(`Error: ${e.message}`); }
};

export const generateSocialContent = async (topic: string, platform: string, onStream: (chunk: string) => void) => {
  if (!process.env.API_KEY) { onStream("Error: API Key missing."); return; }
  const ai = getAiClient();
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: `Viral Manager for ${platform}. Generate Title, Script, Hashtags.` }
    });
    const result = await chat.sendMessageStream({ message: topic });
    for await (const chunk of result) if (chunk.text) onStream(chunk.text);
  } catch (error: any) { onStream(`Error: ${error.message}`); }
};

export const generateSpeech = async (text: string, voice: Voice, styleReference?: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  const ai = getAiClient();
  try {
    let apiVoiceName = voice.apiMapping || 'Kore';
    if (!voice.apiMapping) {
       if (voice.gender === 'male') apiVoiceName = 'Orion';
       else if (voice.gender === 'female') apiVoiceName = 'Nova';
       else apiVoiceName = 'Puck';
    }
    let directionPrefix = "";
    if (voice.isCloned) directionPrefix += `(In the style of ${voice.name}) `;
    if (styleReference) directionPrefix += `(${styleReference}) `;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: directionPrefix ? `${directionPrefix} ${text}` : text }] }],
      config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: apiVoiceName as any } } } },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio ? `data:audio/pcm;base64,${base64Audio}` : null;
  } catch (error) { return null; }
};

export const generateImage = async (prompt: string, stylePrompt?: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: stylePrompt ? `${prompt}. Style: ${stylePrompt}` : prompt }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) { return null; }
}

export const editImage = async (base64Image: string, editPrompt: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  const ai = getAiClient();
  try {
    const cleanData = base64Image.split(',').pop() || base64Image;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanData } }, { text: `Redraw exactly with change: ${editPrompt}` }] }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
    return null;
  } catch (e) { return null; }
}

export const generateVideo = async (prompt: string, inputImage?: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  const ai = getAiClient();
  try {
    const request: any = { model: 'veo-3.1-fast-generate-preview', prompt: prompt, config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' } };
    if (inputImage) {
      const [meta, data] = inputImage.split(',');
      const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png';
      request.image = { imageBytes: data, mimeType: mimeType };
    }
    let operation = await ai.models.generateVideos(request);
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No video URI");
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) throw new Error("Failed to download");
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) { return null; }
}

export const transcribeAudio = async (audioBase64: string): Promise<string> => {
  if (!process.env.API_KEY) return "API Key missing.";
  const ai = getAiClient();
  try {
    const base64Data = audioBase64.split(',').pop() || audioBase64;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ inlineData: { mimeType: 'audio/webm', data: base64Data } }, { text: "Transcribe." }] }
    });
    return response.text || "No transcription.";
  } catch (e) { return "Error."; }
}

export const analyzeMediaStyle = async (base64Data: string, type: 'image' | 'audio'): Promise<string> => {
    if (!process.env.API_KEY) return "";
    const ai = getAiClient();
    const mimeType = type === 'image' ? 'image/png' : 'audio/webm';
    const cleanData = base64Data.split(',').pop() || base64Data;
    const prompt = type === 'image' ? "Analyze style, lighting, color." : "Analyze tone, emotion, pace.";
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { mimeType, data: cleanData } }, { text: prompt }] }
        });
        return response.text || "Analysis failed.";
    } catch (e) { return ""; }
};

export const analyzeCharacterFeatures = async (base64Image: string): Promise<string> => {
    if (!process.env.API_KEY) return "";
    const ai = getAiClient();
    const cleanData = base64Image.split(',').pop() || base64Image;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ inlineData: { mimeType: 'image/png', data: cleanData } }, { text: "Describe physical features in detail." }] }
        });
        return response.text || "Generic character.";
    } catch (e) { return "Generic character."; }
};

export const removeBackground = async (imageBase64: string): Promise<string | null> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return imageBase64; 
};

export const generateSQL = async (description: string, schemaContext: string): Promise<string> => {
  if (!process.env.API_KEY) return "-- API Key missing";
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate PostgreSQL query for: "${description}". Schema: ${schemaContext}. Return ONLY SQL.`,
    });
    return (response.text || "").replace(/```sql/g, '').replace(/```/g, '').trim();
  } catch (e) { return "-- Error"; }
};

export const generateTerminalCommand = async (userInput: string, projectType: string): Promise<string> => {
    if (!process.env.API_KEY) return "echo 'API Key Missing'";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate to shell command for ${projectType}: "${userInput}". Return ONLY command.`,
        });
        return (response.text || "").trim().replace(/```sh/g, '').replace(/```/g, '').trim();
    } catch (e) { return "echo 'Error'"; }
};

export const runSecurityAudit = async (fileStructure: string, packageJson: string): Promise<AuditIssue[]> => {
    if (!process.env.API_KEY) return [];
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Audit project structure: ${fileStructure}. Package.json: ${packageJson}. Return JSON issues.`,
            config: { responseMimeType: 'application/json' }
        });
        const clean = cleanJson(response.text || '[]');
        return JSON.parse(clean);
    } catch (e) { return []; }
};

export const generatePerformanceReport = async (fileStructure: string): Promise<PerformanceReport> => {
    if (!process.env.API_KEY) return { scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }, opportunities: [] };
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze for performance: ${fileStructure}. Return JSON report.`,
            config: { responseMimeType: 'application/json' }
        });
        const clean = cleanJson(response.text || '{}');
        return JSON.parse(clean);
    } catch (e) { return { scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }, opportunities: [] }; }
};

export const generateArchitecture = async (description: string): Promise<{nodes: ArchNode[], links: ArchLink[]}> => {
    if (!process.env.API_KEY) return { nodes: [], links: [] };
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Generate architecture JSON.",
            config: { systemInstruction: `Architect system for: "${description}". Return JSON {nodes, links}.`, responseMimeType: 'application/json' }
        });
        const clean = cleanJson(response.text || '{"nodes":[], "links":[]}');
        return JSON.parse(clean);
    } catch (e) { return { nodes: [], links: [] }; }
};

export const testFineTunedModel = async (modelName: string, prompt: string, onStream: (chunk: string) => void) => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  let responseText = `[${modelName}] processed: "${prompt}"`;
  const chunks = responseText.split(" ");
  for (const chunk of chunks) { await delay(50); onStream(chunk + " "); }
};
