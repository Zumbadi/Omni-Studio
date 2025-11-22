
import { GoogleGenAI, Modality } from "@google/genai";
import { ProjectType, Voice, ChatMessage, AuditIssue, PerformanceReport, ArchNode, ArchLink } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

export const generateCodeResponse = async (
  prompt: string, 
  currentFileContent: string,
  projectType: ProjectType,
  fileStructure: string,
  modelName: string,
  onStream: (chunk: string) => void,
  imageData?: string, // Base64 Data URI
  chatHistory: ChatMessage[] = []
) => {
  if (!process.env.API_KEY) {
    onStream("Error: No API Key found in environment variables.");
    return;
  }

  const ai = getAiClient();
  
  const isNative = projectType === ProjectType.REACT_NATIVE;

  // Determine actual model to use vs persona to simulate
  let targetModel = 'gemini-2.5-flash';
  let customPersona = '';
  let thinkingBudget = 0;

  if (modelName.startsWith('Gemini 2.5 Pro') || modelName.startsWith('gemini-3-pro')) {
    targetModel = 'gemini-3-pro-preview';
    thinkingBudget = 1024; // Enable thinking for complex tasks
  } else if (modelName.startsWith('Gemini 2.5 Flash')) {
    targetModel = 'gemini-2.5-flash';
  } else if (modelName) {
    // Assume it's a custom fine-tuned model
    customPersona = `You are behaving as the custom fine-tuned model "${modelName}". Adopt the specific style, strictness, or domain knowledge associated with this model name.`;
  }

  const frameworkInstruction = isNative 
    ? `You are an expert in React Native (Expo). 
       - Use <View>, <Text>, <TouchableOpacity>, <Image>, <ScrollView> components from 'react-native'.
       - Use StyleSheet.create for styling.
       - DO NOT use HTML tags like <div>, <span>, <button>.
       - DO NOT use Tailwind CSS classes.`
    : `You are an expert in React Web and Tailwind CSS.
       - Use standard HTML tags like <div>, <span>, <button>.
       - Use Tailwind CSS classes for styling.`;

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
      - Format: "// filename: src/components/MyComponent.tsx"
      - If no filename is specified, the user will assume it applies to the currently open file.
      - Do not provide markdown fences around the code if possible, or strictly just the code content inside the fences.
      
      CURRENT FILE CONTEXT:
      \`\`\`typescript
      ${currentFileContent}
      \`\`\`
    `;

    // Construct history for the chat session
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

    // Construct content parts for current message
    const parts: any[] = [{ text: prompt }];
    
    if (imageData) {
       // Extract base64 data and mime type
       const [meta, data] = imageData.split(',');
       const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png';
       parts.unshift({
           inlineData: {
               mimeType: mimeType,
               data: data
           }
       });
    }

    // Send message with content parts
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

export const generateProjectScaffold = async (prompt: string, type: ProjectType): Promise<any[]> => {
  if (!process.env.API_KEY) return [];

  const ai = getAiClient();
  const isNative = type === ProjectType.REACT_NATIVE;
  const isBackend = type === ProjectType.NODE_API;

  const systemInstruction = `You are a Senior Software Architect.
  Generate a JSON structure representing the file tree for a new ${type} project based on the user's description.
  
  Rules:
  1. Return ONLY raw JSON. No markdown, no explanations.
  2. The JSON should be an array of file nodes.
  3. Schema: { "name": string, "type": "file" | "directory", "content"?: string, "children"?: Node[] }
  4. Include at least 4-5 essential files (e.g., App.tsx, package.json, a component, styling).
  5. ${isNative ? 'Use React Native components (View, Text).' : isBackend ? 'Use Express/Node.js.' : 'Use React and Tailwind CSS.'}
  6. Ensure package.json has valid dependencies.
  
  User Description: "${prompt}"
  `;

  try {
    const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: "Generate project structure.",
       config: {
         systemInstruction,
         responseMimeType: 'application/json'
       }
    });

    if (response.text) {
       return JSON.parse(response.text);
    }
    return [];
  } catch (e) {
    console.error("Scaffold Error:", e);
    return [];
  }
};

export const generateProjectPlan = async (description: string, type: ProjectType): Promise<any[]> => {
  if (!process.env.API_KEY) return [];
  const ai = getAiClient();
  
  const systemInstruction = `You are a Technical Project Manager.
  Create a phased development roadmap for a ${type} project described as: "${description}".
  
  Return raw JSON strictly matching this schema:
  [
    {
      "id": "p1",
      "title": "Phase 1: MVP Core",
      "status": "pending",
      "goals": ["Goal 1", "Goal 2"],
      "tasks": [{"id": "t1", "text": "Setup Repo", "done": false}, ...]
    }
  ]
  Create 3 distinct phases.
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: "Generate roadmap.",
        config: { systemInstruction, responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || '[]');
  } catch(e) {
    console.error("Plan Gen Error", e);
    return [];
  }
};

export const generateProjectDocs = async (fileStructure: string, type: ProjectType, onStream: (chunk: string) => void): Promise<void> => {
    if (!process.env.API_KEY) {
        onStream("# Error\nAPI Key missing.");
        return;
    }
    const ai = getAiClient();
    
    const systemInstruction = `You are a Technical Writer.
    Generate a professional README.md for a ${type} project with the following structure:
    ${fileStructure}
    
    Include:
    - Project Title & Description
    - Features
    - Tech Stack
    - Installation & Setup
    - Folder Structure Explanation
    
    Format using clean Markdown.
    `;

    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: "Generate documentation now.",
            config: { systemInstruction }
        });

        for await (const chunk of result) {
            if (chunk.text) onStream(chunk.text);
        }
    } catch (e: any) {
        onStream(`Error generating docs: ${e.message}`);
    }
};

export const runAgentFileTask = async (taskType: 'tests' | 'refactor' | 'docs', fileName: string, fileContent: string): Promise<string | null> => {
    if (!process.env.API_KEY) return null;
    const ai = getAiClient();

    let systemInstruction = "";
    let prompt = "";

    if (taskType === 'tests') {
        systemInstruction = "You are a QA Automation Engineer. Write a comprehensive unit test file for the provided component/code.";
        prompt = `Generate a .test.tsx file for the following code. \nFilename: ${fileName}\nCode:\n${fileContent}\n\nReturn ONLY the code for the test file. Start with // filename: ...test.tsx`;
    } else if (taskType === 'refactor') {
        systemInstruction = "You are a Senior Refactoring Specialist. Improve the code quality, remove code smells, and ensure modern best practices.";
        prompt = `Refactor the following file: ${fileName}.\nCode:\n${fileContent}\n\nReturn the full refactored code. Start with // filename: ${fileName}`;
    } else if (taskType === 'docs') {
        systemInstruction = "You are a Documentation Bot. Add JSDoc comments to all functions and classes.";
        prompt = `Add detailed comments to this file: ${fileName}.\nCode:\n${fileContent}\n\nReturn the commented code. Start with // filename: ${fileName}`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction }
        });
        return response.text || null;
    } catch (e) {
        console.error("Agent Error:", e);
        return null;
    }
};

export const critiqueCode = async (code: string, task: string): Promise<any> => {
  if (!process.env.API_KEY) return null;
  const ai = getAiClient();
  
  const systemInstruction = `You are "Omni-Critic", a senior code reviewer and QA engineer.
  Analyze the provided code against the requested task.
  
  Return raw JSON:
  {
    "score": number (0-100),
    "issues": ["Critical security flaw...", "Performance bottleneck..."],
    "suggestions": ["Use useMemo here...", "Add aria-label..."],
    "nextPrompt": "A suggested prompt for the user to fix or improve the code."
  }
  
  Be strict but constructive. Focus on best practices, accessibility, and clean code.
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Task: ${task}\n\nCode:\n${code}`,
        config: { systemInstruction, responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || '{}');
  } catch(e) {
    return null;
  }
};

export const analyzeDataset = async (datasetSummary: string): Promise<string> => {
   if (!process.env.API_KEY) return "API Key missing.";

   const ai = getAiClient();
   try {
     const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze this dataset summary for fine-tuning suitability: ${datasetSummary}. Suggest optimal hyperparameters for LoRA fine-tuning on Llama-3.`,
     });
     return response.text || "Analysis failed.";
   } catch (e) {
     return "Could not analyze dataset.";
   }
}

export const generateSyntheticData = async (topic: string, count: number, onStream: (chunk: string) => void): Promise<void> => {
    if (!process.env.API_KEY) {
        onStream("Error: API Key missing.");
        return;
    }
    
    const ai = getAiClient();
    const systemInstruction = `You are an Expert Data Scientist.
    Generate a high-quality synthetic dataset for Fine-Tuning a Large Language Model (LLM) on the topic: "${topic}".
    
    Format: JSONL (JSON Lines).
    Each line must be a valid JSON object with this structure:
    {"messages": [{"role": "user", "content": "..."}, {"role": "model", "content": "..."}]}
    
    Rules:
    1. Generate exactly ${count} examples.
    2. Ensure diversity in the user prompts.
    3. Ensure high accuracy and helpfulness in the model responses.
    4. Output ONLY the JSONL data. No markdown, no intros.
    `;

    try {
        const result = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Generate the ${count} examples now.`,
            config: {
                systemInstruction,
                temperature: 0.8
            }
        });

        for await (const chunk of result) {
            if (chunk.text) {
                onStream(chunk.text);
            }
        }
    } catch (error: any) {
        onStream(`Error generating data: ${error.message}`);
    }
};

export const generateSocialContent = async (
  topic: string,
  platform: string,
  onStream: (chunk: string) => void
) => {
  if (!process.env.API_KEY) {
    onStream("Error: API Key missing.");
    return;
  }

  const ai = getAiClient();
  const systemInstruction = `You are a Viral Social Media Manager for ${platform}.
  Generate a catchy Title, a Script/Caption, and Hashtags for the given topic.
  
  Format the response exactly like this:
  Title: [Title Here]
  
  Script:
  [Script/Caption Here]
  
  Hashtags: [Hashtags Here]
  `;

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction }
    });

    const result = await chat.sendMessageStream({ message: topic });

    for await (const chunk of result) {
      if (chunk.text) {
        onStream(chunk.text);
      }
    }
  } catch (error: any) {
    onStream(`Error: ${error.message}`);
  }
};

export const generateSpeech = async (text: string, voice: Voice, styleReference?: string): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key for Speech Generation");
    return null;
  }

  const ai = getAiClient();
  try {
    // Smart Voice Selection
    let apiVoiceName = voice.apiMapping || 'Kore'; // Default fallback
    
    if (!voice.apiMapping) {
       // Heuristic mapping if not set
       if (voice.gender === 'male') apiVoiceName = 'Orion'; // or Fenrir
       else if (voice.gender === 'female') apiVoiceName = 'Nova'; // or Aoede
       else apiVoiceName = 'Puck';
    }
    
    // Enhance text with directions for cloned or styled voices
    let directionPrefix = "";
    if (voice.isCloned) {
       directionPrefix += `(In the style of ${voice.name}, mirroring user recording tone) `;
    }
    if (styleReference) {
       directionPrefix += `(${styleReference}) `;
    }
    
    const finalText = directionPrefix ? `${directionPrefix} ${text}` : text;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: finalText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: apiVoiceName as any },
            },
        },
      },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio ? `data:audio/pcm;base64,${base64Audio}` : null;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    return null;
  }
};

export const generateImage = async (prompt: string, stylePrompt?: string): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key for Image Generation");
    return null;
  }

  const ai = getAiClient();
  try {
    // Enhance prompt with style reference if available
    const finalPrompt = stylePrompt ? `${prompt}. Style and aesthetic matching: ${stylePrompt}` : prompt;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: finalPrompt }],
      },
    });
    
    // Try to find image part
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
             return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null;
  }
}

export const editImage = async (base64Image: string, editPrompt: string): Promise<string | null> => {
  if (!process.env.API_KEY) return null;
  const ai = getAiClient();
  try {
    const cleanData = base64Image.split(',').pop() || base64Image;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { mimeType: 'image/png', data: cleanData } },
                { text: `Redraw this image exactly but make the following change: ${editPrompt}` }
            ]
        }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
             return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    return null;
  } catch (e) {
    console.error("Edit Image Error:", e);
    return null;
  }
}

export const generateVideo = async (prompt: string, inputImage?: string): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key for Video Generation");
    return null;
  }

  const ai = getAiClient();
  try {
    const request: any = {
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    };

    if (inputImage) {
      const [meta, data] = inputImage.split(',');
      const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/png';
      request.image = {
          imageBytes: data,
          mimeType: mimeType
      };
    }

    let operation = await ai.models.generateVideos(request);

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    
    if (!downloadLink) {
      throw new Error("No video URI found in response");
    }

    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    if (!response.ok) {
       throw new Error("Failed to download video bytes");
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Video Generation Error:", error);
    return null;
  }
}

export const transcribeAudio = async (audioBase64: string): Promise<string> => {
  if (!process.env.API_KEY) return "API Key missing.";
  
  const ai = getAiClient();
  try {
    const base64Data = audioBase64.split(',').pop() || audioBase64;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType: 'audio/webm', data: base64Data } },
                { text: "Transcribe this audio accurately." }
            ]
        }
    });
    return response.text || "No transcription available.";
  } catch (e) {
    console.error("Transcription Error:", e);
    return "Error transcribing audio.";
  }
}

export const analyzeMediaStyle = async (base64Data: string, type: 'image' | 'audio'): Promise<string> => {
    if (!process.env.API_KEY) return "";
    const ai = getAiClient();
    
    const mimeType = type === 'image' ? 'image/png' : 'audio/webm'; // Simplified assumption
    const cleanData = base64Data.split(',').pop() || base64Data;

    const prompt = type === 'image' 
        ? "Analyze the artistic style, lighting, color palette, and mood of this image. Provide a concise style description I can use to generate similar images."
        : "Analyze the tone, emotion, pace, and background ambience of this audio. Provide a concise style description I can use for TTS generation.";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: cleanData } },
                    { text: prompt }
                ]
            }
        });
        return response.text || "Analysis failed.";
    } catch (e) {
        console.error("Style Analysis Error:", e);
        return "";
    }
};

export const analyzeCharacterFeatures = async (base64Image: string): Promise<string> => {
    if (!process.env.API_KEY) return "";
    const ai = getAiClient();
    const cleanData = base64Image.split(',').pop() || base64Image;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'image/png', data: cleanData } },
                    { text: "Describe the physical features of the character in this image in detail (hair style/color, eye color, clothing, age, accessories, facial structure) so I can recreate them in other scenes." }
                ]
            }
        });
        return response.text || "A generic character.";
    } catch (e) {
        console.error("Character Analysis Error:", e);
        return "A generic character.";
    }
};

export const removeBackground = async (imageBase64: string): Promise<string | null> => {
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1500));
    return imageBase64; 
};

export const generateSQL = async (description: string, schemaContext: string): Promise<string> => {
  if (!process.env.API_KEY) return "-- API Key missing";
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a SQL query for PostgreSQL based on this request: "${description}".\n\nSchema Context:\n${schemaContext}\n\nReturn ONLY the raw SQL code, no markdown.`,
    });
    return response.text || "";
  } catch (e) {
    return "-- Error generating SQL";
  }
};

export const generateTerminalCommand = async (userInput: string, projectType: string): Promise<string> => {
    if (!process.env.API_KEY) return "echo 'API Key Missing'";
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate this user request into a single valid shell command (npm, git, ls, cd, etc) for a ${projectType} project: "${userInput}".\n\nReturn ONLY the command, no explanation.`,
        });
        return (response.text || "").trim().replace(/```/g, '').trim();
    } catch (e) {
        return "echo 'Error generating command'";
    }
};

export const runSecurityAudit = async (fileStructure: string, packageJson: string): Promise<AuditIssue[]> => {
    if (!process.env.API_KEY) return [];
    const ai = getAiClient();
    const systemInstruction = `You are a Senior Security Engineer. Audit the provided project context.
    Return a JSON array of issues: { id: string, severity: 'critical'|'high'|'medium'|'low', title: string, description: string, file?: string, line?: number }.
    Check for:
    1. Vulnerable dependencies in package.json
    2. Exposed secrets (API keys, tokens)
    3. Insecure coding practices
    4. Misconfigurations
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Audit this project.\n\nFile Structure:\n${fileStructure}\n\npackage.json:\n${packageJson}`,
            config: { systemInstruction, responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '[]');
    } catch (e) {
        return [];
    }
};

export const generatePerformanceReport = async (fileStructure: string): Promise<PerformanceReport> => {
    if (!process.env.API_KEY) return { scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }, opportunities: [] };
    const ai = getAiClient();
    
    const systemInstruction = `You are a Google Lighthouse Audit expert. Analyze the project structure and suggest optimizations.
    Return a JSON object matching the PerformanceReport interface:
    {
      "scores": { "performance": number(0-100), "accessibility": number, "bestPractices": number, "seo": number },
      "opportunities": [{ "title": string, "description": string, "savings": string }]
    }
    Simulate realistic scores based on a typical React app structure.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this project structure for performance issues:\n${fileStructure}`,
            config: { systemInstruction, responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 }, opportunities: [] };
    }
};

export const generateArchitecture = async (description: string): Promise<{nodes: ArchNode[], links: ArchLink[]}> => {
    if (!process.env.API_KEY) return { nodes: [], links: [] };
    const ai = getAiClient();
    const systemInstruction = `You are a System Architect.
    Generate a JSON object representing a system architecture diagram for the following description: "${description}".
    
    Output format:
    {
      "nodes": [{ "id": "n1", "type": "frontend"|"backend"|"database"|"auth"|"storage"|"function", "label": "React App", "x": 100, "y": 100, "details": "Host on Vercel" }],
      "links": [{ "id": "l1", "source": "n1", "target": "n2" }]
    }
    
    Include at least 3-5 nodes spread out (x between 0-600, y between 0-400).
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Generate architecture.",
            config: { systemInstruction, responseMimeType: 'application/json' }
        });
        return JSON.parse(response.text || '{"nodes":[], "links":[]}');
    } catch (e) {
        return { nodes: [], links: [] };
    }
};

export const testFineTunedModel = async (
  modelName: string,
  prompt: string,
  onStream: (chunk: string) => void
) => {
  // Simulation of a fine-tuned model inference
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  let responseText = "";
  if (modelName.includes("Support")) {
    responseText = "Thank you for contacting support. Based on your account history, I see you are experiencing issues with the payment gateway. I have reset your session token. Please try logging in again.";
  } else if (modelName.includes("Legal")) {
    responseText = "SECTION 4.2: LIABILITY LIMITATIONS. The Service Provider shall not be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.";
  } else {
    responseText = `[${modelName}] generated response: I have analyzed the input "${prompt}" and updated my internal weights accordingly. The output tensor indicates a 98% probability match.`;
  }

  const chunks = responseText.split(" ");
  for (const chunk of chunks) {
    await delay(50 + Math.random() * 50);
    onStream(chunk + " ");
  }
};
