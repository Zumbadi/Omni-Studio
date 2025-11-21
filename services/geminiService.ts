
import { GoogleGenAI, Modality } from "@google/genai";
import { ProjectType } from "../types";

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
  imageData?: string // Base64 Data URI
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

  if (modelName.startsWith('Gemini 2.5 Pro')) {
    targetModel = 'gemini-2.0-pro-exp-02-05'; // Use experimental pro if available or fallback
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

    // Construct content parts
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

    const chat = ai.chats.create({
      model: targetModel,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    // Send message with content parts
    // Note: chat.sendMessageStream accepts string | Part[] | Content[]
    // We wrap parts in the correct structure expected by the SDK
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

export const generateSpeech = async (text: string, voiceName: string = 'Kore', styleReference?: string): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key for Speech Generation");
    return null;
  }

  const ai = getAiClient();
  
  // Pro Feature: Style Transfer
  // We simulate style transfer by prompting the model with a directional cue derived from the reference audio.
  let processedText = text;
  if (styleReference) {
      processedText = `(Style: ${styleReference}) ${text}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: processedText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName as any },
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

export const generateImage = async (prompt: string, characterDescription?: string, referenceStyle?: string): Promise<string | null> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key for Image Generation");
    return null;
  }

  const ai = getAiClient();
  
  let fullPrompt = prompt;
  
  // Pro Feature: Character Consistency
  if (characterDescription) {
      fullPrompt += `\n\nCharacter Requirements: Ensure the character matches this description exactly: ${characterDescription}. Maintain consistent facial features, hair, and build.`;
  }
  
  // Pro Feature: Style Transfer
  if (referenceStyle) {
      fullPrompt += `\n\nArtistic Style: ${referenceStyle}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: fullPrompt }],
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
      // inputImage is expected to be a data URI: data:image/png;base64,...
      // We need to split it to get the mimeType and the data
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

    // The response.body contains the MP4 bytes. You must append an API key when fetching from the download link.
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
    // Strip data URI prefix if present
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

// Pro Feature: Analyze Reference Media (Image/Video/Audio)
export const analyzeMediaStyle = async (mediaBase64: string, type: 'image' | 'audio'): Promise<string> => {
  if (!process.env.API_KEY) return "API Key missing.";

  const ai = getAiClient();
  const prompt = type === 'image' 
      ? "Analyze this image. Describe the character (if any) in extreme detail (hair, eyes, facial structure, clothes) and the artistic style. Output a description that can be used to generate consistent variations."
      : "Analyze this audio clip. Describe the mood, tone, emotion, background noise, and speaker style. Output a brief style description.";

  try {
    const base64Data = mediaBase64.split(',').pop() || mediaBase64;
    const mimeType = type === 'image' ? 'image/png' : 'audio/webm';

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt }
            ]
        }
    });
    return response.text || "Analysis failed.";
  } catch (e) {
    console.error("Analysis Error:", e);
    return "Could not analyze media.";
  }
}

// Pro Feature: Simulated Background Removal
export const removeBackground = async (imageBase64: string): Promise<string> => {
    // Since we cannot perform actual segmentation client-side without heavy models,
    // and Gemini doesn't have a dedicated "remove background" endpoint that returns an image,
    // We will simulate this by returning the image as is but assuming the UI handles it,
    // OR in a real scenario, we'd call a specialized API.
    // For this demo, we'll mock a delay and return the image.
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    return imageBase64; 
}

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
