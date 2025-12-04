import { GoogleGenAI, Type, Schema, Modality, LiveServerMessage, GenerateContentResponse } from "@google/genai";
import { ProjectType, AIAgent, ProjectPhase, AgentContext, Voice, Scene, ChatMessage, AudioTrack, SocialPost } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helpers ---

// Exponential Backoff Retry Helper
const retryOperation = async <T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      // Check for Rate Limit (429) or Quota Exceeded errors
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.message?.includes('429') || 
        error?.message?.includes('quota') ||
        error?.message?.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit && i < retries - 1) {
        const waitTime = delay * Math.pow(2, i);
        console.warn(`Gemini API Rate Limit (429). Retrying in ${waitTime}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
      
      // If it's the last retry or not a rate limit error, throw it
      if (i === retries - 1) throw error;
      throw error;
    }
  }
  throw new Error("Max retries reached");
};

const cleanJson = (text: string) => {
  if (!text) return '';
  let cleaned = text.replace(/```json\s*|```JSON\s*|```\s*/g, '').replace(/```/g, '');
  
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const start = (firstBrace === -1) ? firstBracket : (firstBracket === -1) ? firstBrace : Math.min(firstBrace, firstBracket);
  
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);

  if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
  }
  
  return cleaned.trim();
};

const getMimeType = (base64String: string, defaultType: string): string => {
    if (base64String.includes(';base64,')) {
        return base64String.split(';base64,')[0].replace('data:', '');
    }
    return defaultType;
};

// --- Live API (Real-time Voice) ---

export class LiveSession {
  private active = false;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private session: any; // LiveSession interface from SDK
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  
  // Audio Analysis
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  constructor(
      private onMessage: (text: string, isFinal: boolean) => void,
      private onInterrupt?: () => void,
      private onVolume?: (inputVol: number, outputVol: number) => void
  ) {}

  async connect() {
    this.active = true;
    this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Setup Input Analysis
    this.inputAnalyser = this.inputContext.createAnalyser();
    this.inputAnalyser.fftSize = 32;
    this.inputAnalyser.smoothingTimeConstant = 0.5;

    // Setup Output Analysis
    this.outputAnalyser = this.outputContext.createAnalyser();
    this.outputAnalyser.fftSize = 32;
    this.outputAnalyser.smoothingTimeConstant = 0.5;

    // Start Analysis Loop
    this.startAnalysis();

    // Initial connection promise
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
           console.log("Live Session Opened");
           this.startInputStreaming(sessionPromise);
        },
        onmessage: (msg: LiveServerMessage) => {
           this.handleServerMessage(msg);
        },
        onclose: () => {
            console.log("Live Session Closed");
            this.disconnect();
        },
        onerror: (e) => console.error("Live Session Error", e)
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        },
        inputAudioTranscription: {} // Enable input transcription for feedback
      }
    });
    
    this.session = await sessionPromise;
  }

  private startAnalysis() {
      const updateVolume = () => {
          if (!this.active) return;
          
          let inVol = 0;
          let outVol = 0;

          if (this.inputAnalyser) {
              const data = new Uint8Array(this.inputAnalyser.frequencyBinCount);
              this.inputAnalyser.getByteFrequencyData(data);
              inVol = data.reduce((a, b) => a + b, 0) / data.length;
          }

          if (this.outputAnalyser) {
              const data = new Uint8Array(this.outputAnalyser.frequencyBinCount);
              this.outputAnalyser.getByteFrequencyData(data);
              outVol = data.reduce((a, b) => a + b, 0) / data.length;
          }

          if (this.onVolume) {
              this.onVolume(inVol, outVol);
          }
          
          requestAnimationFrame(updateVolume);
      };
      updateVolume();
  }

  private startInputStreaming(sessionPromise: Promise<any>) {
      if (!this.inputContext || !this.mediaStream) return;

      this.inputSource = this.inputContext.createMediaStreamSource(this.mediaStream);
      
      // Connect to Analyser
      if (this.inputAnalyser) {
          this.inputSource.connect(this.inputAnalyser);
      }

      this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
      
      this.processor.onaudioprocess = (e) => {
          if(!this.active) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = this.float32ToInt16(inputData);
          const base64 = this.arrayBufferToBase64(pcmData.buffer);
          
          const blob = {
              data: base64,
              mimeType: 'audio/pcm;rate=16000'
          };

          // Ensure session is resolved before sending
          sessionPromise.then(s => s.sendRealtimeInput({ media: blob }));
      };
      
      this.inputSource.connect(this.processor);
      this.processor.connect(this.inputContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage) {
      // Handle Audio Output
      const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (audioData && this.outputContext) {
          const buffer = await this.decodeAudio(audioData, this.outputContext);
          this.playBuffer(buffer);
      }

      // Handle Input Transcription (User Speech)
      if (message.serverContent?.inputTranscription) {
          this.onMessage(message.serverContent.inputTranscription.text || '', false);
      }
      
      // Handle Turn Completion
      if (message.serverContent?.turnComplete) {
          this.onMessage('', true);
      }

      // Handle Interruption
      if (message.serverContent?.interrupted) {
          console.log("Model interrupted by user");
          this.sources.forEach(source => {
              try { source.stop(); } catch(e) {}
          });
          this.sources.clear();
          this.nextStartTime = 0;
          if (this.onInterrupt) this.onInterrupt();
      }
  }

  private playBuffer(buffer: AudioBuffer) {
      if (!this.outputContext) return;
      
      const currentTime = this.outputContext.currentTime;
      if (this.nextStartTime < currentTime) {
          this.nextStartTime = currentTime;
      }
      
      const source = this.outputContext.createBufferSource();
      source.buffer = buffer;
      
      // Connect to Analyser then Destination
      if (this.outputAnalyser) {
          source.connect(this.outputAnalyser);
          this.outputAnalyser.connect(this.outputContext.destination);
      } else {
          source.connect(this.outputContext.destination);
      }
      
      source.start(this.nextStartTime);
      this.nextStartTime += buffer.duration;
      
      this.sources.add(source);
      source.onended = () => this.sources.delete(source);
  }

  disconnect() {
      this.active = false;
      this.sources.forEach(s => s.stop());
      this.sources.clear();
      
      this.processor?.disconnect();
      this.inputSource?.disconnect();
      this.mediaStream?.getTracks().forEach(t => t.stop());
      
      this.inputContext?.close();
      this.outputContext?.close();
      
      if (this.session && typeof this.session.close === 'function') {
          this.session.close();
      }
  }

  // --- Audio Utils ---
  
  private float32ToInt16(float32: Float32Array) {
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return int16;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
  }

  private async decodeAudio(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for(let i=0; i<int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
      }
      
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      return buffer;
  }
}

// --- Media Generation ---

export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
    }));
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return '';
  } catch (e) {
    console.error("Image Gen Error", e);
    return '';
  }
};

export const editImage = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    const mimeType = getMimeType(base64Image, 'image/png');
    const data = base64Image.split(',')[1] || base64Image;
    
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { mimeType, data } },
          { text: `Edit instructions: ${prompt}` }
        ]
      }
    }));
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return '';
  } catch (e) {
    console.error("Image Edit Error", e);
    return '';
  }
};

export const generateVideo = async (prompt: string, imageBase64?: string): Promise<string> => {
  try {
    // Check if API key is selected for Veo
    if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
    }

    const currentAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let operation;
    if (imageBase64) {
        const data = imageBase64.split(',')[1] || imageBase64;
        const mimeType = getMimeType(imageBase64, 'image/png');

        operation = await retryOperation(() => currentAi.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            image: {
                imageBytes: data,
                mimeType: mimeType
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        }));
    } else {
        operation = await retryOperation(() => currentAi.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        }));
    }

    while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await retryOperation(() => currentAi.operations.getVideosOperation({operation: operation}));
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
        const url = new URL(downloadLink);
        url.searchParams.append('key', process.env.API_KEY || '');
        
        const videoRes = await fetch(url.toString());
        const blob = await videoRes.blob();
        return URL.createObjectURL(blob);
    }
    return '';
  } catch (e) {
    console.error("Video Gen Error", e);
    return '';
  }
};

export const generateSpeech = async (text: string, voice: Voice, styleReference?: string): Promise<string> => {
  try {
    const config: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice.apiMapping || 'Kore' }
            }
        }
    };

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: { parts: [{ text }] },
        config
    }));

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:audio/wav;base64,${part.inlineData.data}`;
        }
    }
    return '';
  } catch (e) {
    console.error("TTS Error", e);
    return '';
  }
};

export const generatePodcastScript = async (topic: string, hostName: string, guestName: string): Promise<{speaker: string, text: string}[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a short podcast script (3-5 exchanges) about "${topic}". 
            Host: ${hostName}. Guest: ${guestName}.
            Return JSON array: [{"speaker": "${hostName}", "text": "..."}, ...]`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '[]');
        return JSON.parse(text);
    } catch {
        return [];
    }
};

export const parseScriptToScenes = async (script: string): Promise<{ scenes: any[], audioTracks: any[] }> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this screenplay script and extract a structured timeline.
            
            Script:
            "${script}"
            
            Tasks:
            1. Break down into Visual Scenes. A new scene starts at a Scene Heading (INT/EXT) or a major shift in visual action.
            2. Extract Audio Tracks. Look for [SFX: ...] or [MUSIC: ...] tags, OR infer sound effects from action lines (e.g. "An explosion booms").
            3. Extract Dialogue. Dialogue lines should be attached to the relevant scene as 'audioScript'.
            
            Return JSON:
            {
              "scenes": [
                { 
                  "description": "Visual description of the action and setting", 
                  "duration": number (estimate 1s per 3 words of action/dialogue, min 3s),
                  "audioScript": "Dialogue text or voiceover for this scene" 
                }
              ],
              "audioTracks": [
                {
                  "name": "Short label (e.g. 'Explosion')",
                  "type": "sfx" | "music" | "voiceover",
                  "prompt": "Description for audio generation",
                  "startOffset": number (estimated seconds from start of script),
                  "duration": number
                }
              ]
            }`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '{}');
        const parsed = JSON.parse(text);
        return {
            scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
            audioTracks: Array.isArray(parsed.audioTracks) ? parsed.audioTracks : []
        };
    } catch (e) {
        console.error("Script Parse Error", e);
        return { scenes: [], audioTracks: [] };
    }
};

export const generateCreativeScript = async (prompt: string, style: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a professional screenwriter. Write a creative script for a "${style}" project based on: "${prompt}".
            
            Strict Formatting Rules for easier parsing:
            1. Start every new scene with a scene heading (e.g., INT. LAB - DAY).
            2. For visual action, write clear descriptions.
            3. For sound effects, MUST use the format: [SFX: Sound description]
            4. For music, MUST use the format: [MUSIC: Music description]
            5. For dialogue, use standard format (CHARACTER NAME centered, dialogue below).
            
            Example:
            INT. KITCHEN - DAY
            
            [MUSIC: Upbeat jazz playing]
            
            JOHN is cooking eggs.
            
            [SFX: Sizzling sound]
            
            JOHN
            Smells good!
            `,
        }));
        return response.text?.trim() || '';
    } catch {
        return '';
    }
};

export const generateSoundEffect = async (prompt: string): Promise<string> => {
    return await generateSpeech(`[Sound Effect: ${prompt}]`, { id: 'sfx', name: 'SFX', gender: 'robot', style: 'custom', isCloned: false });
};

export const generateBackgroundMusic = async (prompt: string): Promise<string> => {
    return await generateSpeech(`[Background Music: ${prompt}]`, { id: 'music', name: 'Music', gender: 'robot', style: 'custom', isCloned: false });
};

export const generateSong = async (
    lyrics: string, 
    styleRef?: string, 
    voiceId?: string, 
    youtubeLink?: string, 
    genre?: string,
    voiceStyle?: string, 
    songStructure?: string
): Promise<string> => {
    return await generateSpeech(`[Song Generation: ${genre}, ${songStructure}] \n\n ${lyrics.substring(0, 100)}...`, { id: 'song', name: 'Song', gender: 'robot', style: 'custom', isCloned: false });
};

export const generateDrumPattern = async (prompt: string): Promise<boolean[][]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a drum pattern for: "${prompt}". Return a JSON 5x16 boolean array (Kick, Snare, HiHat, Clap, Bass). Example: [[true, false, ...], ...]`,
            config: {
                responseMimeType: 'application/json'
            }
        }));
        const text = cleanJson(response.text || '[]');
        return JSON.parse(text);
    } catch {
        return [];
    }
};

export const generateAudioPrompt = async (desc: string, type: 'voice' | 'sfx' | 'music'): Promise<string> => {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create a detailed audio prompt for a ${type} generator based on this scene: "${desc}". Keep it under 20 words.`
    }));
    return response.text || '';
};

export const generateLyrics = async (prompt: string, genre: string, context?: string): Promise<string> => {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Write song lyrics. Genre: ${genre}. Prompt: ${prompt}. ${context ? `Context: ${context}` : ''}`
    }));
    return response.text || '';
};

export const enhancePrompt = async (shortPrompt: string, context?: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Enhance this image generation prompt to be highly detailed, cinematic, and descriptive.
            Original: "${shortPrompt}"
            ${context ? `Context: ${context}` : ''}
            
            Return ONLY the enhanced prompt string. No markdown.`
        }));
        return response.text?.trim() || shortPrompt;
    } catch {
        return shortPrompt;
    }
};

export const expandMindMap = async (nodeText: string, context: string, intent: 'diverge' | 'refine' | 'visuals' = 'diverge'): Promise<string[]> => {
    try {
        let prompt = `Brainstorm 3-5 sub-ideas related to "${nodeText}". Context: ${context}. Return strictly a JSON string array.`;
        
        if (intent === 'refine') {
            prompt = `Provide 3-5 specific, actionable details or tactics for the concept "${nodeText}". Context: ${context}. Return JSON array.`;
        } else if (intent === 'visuals') {
            prompt = `Describe 3-5 visual scenes or imagery ideas that represent "${nodeText}". Context: ${context}. Return JSON array.`;
        }

        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '[]');
        return JSON.parse(text);
    } catch {
        return [];
    }
};

export const analyzeComponent = async (code: string): Promise<{ name: string, description: string, props: { name: string, type: string, defaultValue?: any }[] }> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this React component and extract its name, description, and props interface.
            Code:\n${code}\n
            Return JSON: { "name": string, "description": string, "props": [{ "name": string, "type": "string"|"number"|"boolean"|"function", "defaultValue": any }] }`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return { name: 'Unknown', description: '', props: [] };
    }
};

export const improveCode = async (code: string, type: 'docs' | 'types' | 'clean'): Promise<string> => {
    try {
        const prompts = {
            docs: "Add comprehensive JSDoc/TSDoc comments to this code. Do not change logic.",
            types: "Convert this JavaScript code to TypeScript, inferring types where possible.",
            clean: "Clean up this code: remove unused variables, fix indentation, optimize imports."
        };
        
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${prompts[type]}\n\nCode:\n${code}\n\nReturn ONLY the updated code.`
        }));
        return cleanJson(response.text || code);
    } catch {
        return code;
    }
};

export const performResearch = async (topic: string): Promise<{ title: string, summary: string, keyPoints: string[], citations: { title: string, url: string }[] }> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Using Pro for better research synthesis
            contents: `Research the following topic: "${topic}". 
            Provide a comprehensive summary, 5 key takeaways, and a list of sources.
            Return JSON: { "title": string, "summary": string, "keyPoints": string[], "citations": [{"title": string, "url": string}] }`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json'
            }
        }));
        const text = cleanJson(response.text || '{}');
        
        // Manual fallback extraction if JSON fails but grounding metadata exists
        let result = JSON.parse(text);
        
        if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
            const chunks = response.candidates[0].groundingMetadata.groundingChunks;
            const citations = chunks
                .filter(c => c.web)
                .map(c => ({ title: c.web!.title, url: c.web!.uri }));
            
            // Merge citations if model didn't include them in JSON
            if (!result.citations || result.citations.length === 0) {
                result.citations = citations;
            }
        }
        
        return result;
    } catch {
        return { 
            title: "Research Failed", 
            summary: "Could not complete research request.", 
            keyPoints: [], 
            citations: [] 
        };
    }
};

export const generateDatabaseSchema = async (prompt: string): Promise<any[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Design a normalized database schema for: "${prompt}".
            Return strictly a JSON array of Table objects: 
            [{ 
                "name": "tableName", 
                "columns": [
                    {"name": "colName", "type": "DataType", "isPk": boolean, "isFk": boolean, "references": "RelatedTable"}
                ] 
            }]
            Supported types: UUID, VARCHAR, TEXT, INTEGER, BOOLEAN, TIMESTAMP, FLOAT.`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '[]');
        return JSON.parse(text);
    } catch {
        return [];
    }
};

export const generateMigrationCode = async (schema: any[], type: 'sql'|'prisma'|'mongoose'): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate ${type} code for this schema:
            ${JSON.stringify(schema, null, 2)}
            
            Return ONLY the code. No markdown formatting if possible.`
        }));
        return cleanJson(response.text || '');
    } catch {
        return '// Error generating code';
    }
};

export const generateMockRowData = async (tableName: string, columns: any[], count: number): Promise<any[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate ${count} rows of realistic mock data for table "${tableName}".
            Columns: ${columns.map(c => `${c.name} (${c.type})`).join(', ')}.
            Return strictly a JSON array of objects.`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '[]');
        return JSON.parse(text);
    } catch {
        return [];
    }
};

export const naturalLanguageToSql = async (query: string, schema: any[]): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Convert this natural language query to SQL: "${query}".
            Schema: ${JSON.stringify(schema)}
            Return ONLY the SQL query string. No markdown.`
        }));
        return cleanJson(response.text || '');
    } catch {
        return '-- Error converting query';
    }
};

export const generateFullCampaign = async (prompt: string): Promise<SocialPost | null> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Create a detailed social media campaign for: "${prompt}".
            Return strictly JSON with this structure:
            {
              "title": "Campaign Title",
              "platform": "instagram" | "tiktok" | "youtube",
              "script": "Full script with dialogue...",
              "scenes": [
                { "description": "Visual description of scene 1", "duration": 5 },
                { "description": "Visual description of scene 2", "duration": 4 }
              ]
            }`,
            config: { responseMimeType: 'application/json' }
        }));
        const data = JSON.parse(cleanJson(response.text || '{}'));
        return {
            id: `camp-${Date.now()}`,
            title: data.title || 'New Campaign',
            platform: data.platform || 'instagram',
            status: 'idea',
            script: data.script || '',
            scenes: data.scenes?.map((s: any, i: number) => ({
                id: `s-${Date.now()}-${i}`,
                description: s.description,
                duration: s.duration || 5,
                status: 'pending',
                transition: 'cut'
            })) || [],
            lastModified: new Date().toISOString()
        };
    } catch (e) {
        return null;
    }
};

// --- Analysis & Utility ---

export const analyzeMediaStyle = async (mediaBase64: string, type: 'image' | 'video' | 'audio'): Promise<string> => {
    try {
        const mimeType = getMimeType(mediaBase64, type === 'image' ? 'image/png' : type === 'video' ? 'video/mp4' : 'audio/wav');
        const data = mediaBase64.split(',')[1] || mediaBase64;
        
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: "Analyze the style, mood, and technical details of this media in one concise sentence." }
                ]
            }
        }));
        return response.text || 'Analysis failed';
    } catch {
        return 'Analysis unavailable';
    }
};

export const analyzeCharacterFeatures = async (image: string): Promise<string> => {
    return analyzeMediaStyle(image, 'image');
};

export const removeBackground = async (image: string): Promise<string> => {
    try {
        return await editImage(image, "Remove the background and make it solid white or transparent.");
    } catch {
        return image; 
    }
};

export const transcribeAudio = async (audioUrl: string): Promise<string> => {
    try {
        let blob: Blob;
        
        if (audioUrl.startsWith('data:')) {
            const arr = audioUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'audio/wav';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            blob = new Blob([u8arr], { type: mime });
        } else {
            const response = await fetch(audioUrl);
            blob = await response.blob();
        }

        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
        
        const data = base64.split(',')[1];
        const mimeType = blob.type || 'audio/wav';

        const aiRes = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data } },
                    { text: "Transcribe this audio file verbatim. Provide only the text." }
                ]
            }
        }));
        
        return aiRes.text || "No transcription generated.";
    } catch (e) {
        console.error("Transcription failed", e);
        return "Transcription failed. Please try again.";
    }
};

export const detectIntent = async (text: string): Promise<'chat' | 'task' | 'command'> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Classify the intent of the user's message: "${text}".
            - 'command': For UI actions like "close sidebar", "switch to dark mode", "deploy app", "open settings".
            - 'task': For coding tasks or requests like "create a file", "refactor code", "add a button", "fix bug".
            - 'chat': For general conversation, questions, or greetings.
            
            Return ONLY one of these labels: chat, task, command.`,
        }));
        const result = response.text?.trim().toLowerCase();
        if (result?.includes('task')) return 'task';
        if (result?.includes('command')) return 'command';
        return 'chat';
    } catch {
        return 'chat';
    }
};

export const parseUICommand = async (text: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Map this natural language request to a specific UI command ID.
            Request: "${text}"
            
            Available IDs:
            - toggle_sidebar
            - toggle_terminal
            - export_project
            - git_commit
            - open_settings
            - toggle_theme
            - create_file
            - create_folder
            - deploy_app
            - run_tests
            - split_editor
            - open_preview
            - zoom_in
            - zoom_out
            - close_terminal
            - open_terminal
            
            Return ONLY the command ID. If no match, return 'unknown'.`
        }));
        return response.text?.trim() || 'unknown';
    } catch {
        return 'unknown';
    }
};

// --- Code & Text Generation ---

export const generateCodeResponse = async (
    prompt: string, 
    currentCode: string, 
    projectType: ProjectType, 
    fileStructure: string, 
    modelName: string,
    onStream: (chunk: string) => void,
    onMetadata: (meta: any) => void,
    image?: string,
    history: ChatMessage[] = [],
    useSearch = false,
    useMaps = false
) => {
    try {
        const userSystemPrompt = localStorage.getItem('omni_system_prompt') || '';
        const systemPrompt = `${userSystemPrompt ? `User Instruction: ${userSystemPrompt}\n\n` : ''}You are Omni-Studio, an elite senior software engineer. Project Type: ${projectType}.
        Available Files:\n${fileStructure}\n
        Current File Content:\n${currentCode}\n
        
        Rules:
        1. Write production-ready, bug-free code.
        2. Use strictly typed TypeScript where possible.
        3. If modifying code, output ONLY the changed file content with // filename: [path] comment at the top.
        4. Be concise and precise.
        5. For the entry component (App.tsx), prefer "export default function App() {}" to ensure runtime compatibility.
        6. Do not use external CSS files unless necessary; prefer Tailwind classes or inline styles.
        7. Ensure all imports are relative (e.g. './components/Button') and not absolute unless standard library.
        `;

        const model = modelName.includes('3-pro') ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
        
        const tools: any[] = [];
        if (useSearch) tools.push({ googleSearch: {} });
        if (useMaps) tools.push({ googleMaps: {} }); 

        const parts: any[] = [{ text: prompt }];
        if (image) {
            parts.unshift({ inlineData: { mimeType: getMimeType(image, 'image/png'), data: image.split(',')[1] } });
        }

        // Retry wrapper for stream initiation
        const responseStream = await retryOperation<any>(() => ai.models.generateContentStream({
            model,
            contents: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
                { role: 'user', parts }
            ],
            config: {
                tools: tools.length > 0 ? tools : undefined
            }
        }));

        for await (const chunk of responseStream) {
            if (chunk.text) onStream(chunk.text);
            if (chunk.candidates?.[0]?.groundingMetadata) {
                onMetadata(chunk.candidates[0].groundingMetadata);
            }
        }
    } catch (e) {
        console.error("Gen Code Error", e);
        onStream("// Error generating response. Quota may be exceeded.");
    }
};

export const critiqueCode = async (code: string, task: string) => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Review this code for bugs, security issues, and performance. Task: ${task}.
            Code:\n${code}\n
            Return JSON: { "score": number, "issues": string[], "suggestions": string[], "fixCode": string (optional) }`,
            config: {
                responseMimeType: 'application/json'
            }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return null;
    }
};

export const generateProjectScaffold = async (description: string, type: ProjectType): Promise<any[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Generate a file structure for a ${type} project. Description: ${description}.
            Return strictly a JSON array of FileNode objects: { name: string, type: 'file'|'directory', children?: FileNode[], content?: string }.
            Include essential config files (package.json, tsconfig.json) and basic src structure with placeholder content.
            Ensure App.tsx exports default function App.`,
            config: {
                responseMimeType: 'application/json'
            }
        }));
        const text = cleanJson(response.text || '[]');
        return JSON.parse(text);
    } catch {
        return [];
    }
};

export const generateProjectPlan = async (desc: string, type: ProjectType): Promise<ProjectPhase[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Create a phased roadmap for a ${type} project: "${desc}".
            Return strictly JSON array of ProjectPhase: { id: string, title: string, status: 'pending', goals: string[], tasks: {id: string, text: string, done: false}[] }`,
            config: {
                responseMimeType: 'application/json'
            }
        }));
        const text = cleanJson(response.text || '[]');
        return JSON.parse(text);
    } catch {
        return [];
    }
};

export const generateTerminalCommand = async (query: string, type: ProjectType): Promise<string> => {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate this natural language request into a terminal command for a ${type} project: "${query}". Return ONLY the command.`
    }));
    return response.text?.trim() || '';
};

export const generateCommitMessage = async (changes: string[]): Promise<string> => {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a concise git commit message for changes in: ${changes.join(', ')}.`
    }));
    return response.text?.trim() || 'Update files';
};

export const generateProjectDocs = async (fileStructure: string, type: ProjectType, onStream: (text: string) => void) => {
    const stream = await retryOperation<any>(() => ai.models.generateContentStream({
        model: 'gemini-3-pro-preview',
        contents: `Generate comprehensive documentation (README.md style) for this ${type} project structure:\n${fileStructure}`
    }));
    for await (const chunk of stream) {
        if (chunk.text) onStream(chunk.text);
    }
};

export const generateChangelog = async (files: string[], task: string): Promise<string> => {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a changelog entry for task "${task}" affecting files: ${files.join(', ')}.`
    }));
    return response.text || '';
};

export const autoUpdateReadme = async (current: string, changelog: string): Promise<string> => {
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Append this changelog to the README:\n\n${changelog}\n\nCurrent README:\n${current}\n\nReturn full updated README.`
    }));
    return response.text || current;
};

export const generateGhostText = async (prefix: string, suffix: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Complete the code. Prefix:\n${prefix}\nSuffix:\n${suffix}\nReturn ONLY the missing code.`
        }));
        return response.text || '';
    } catch {
        return '';
    }
};

export const generateTestResults = async (filename: string, content: string): Promise<any> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Simulate running unit tests for this code:\n${content}\nFilename: ${filename}.
            Return JSON: { duration: number, passed: number, failed: number, suites: [{name: string, status: 'pass'|'fail', assertions: [{name: string, status: 'pass'|'fail', error?: string}]}] }`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return { duration: 0, passed: 0, failed: 0, suites: [] };
    }
};

export const generateSyntheticData = async (topic: string, count: number, onStream: (chunk: string) => void) => {
    const stream = await retryOperation<any>(() => ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: `Generate ${count} synthetic data examples for topic "${topic}" in JSONL format.`
    }));
    for await (const chunk of stream) {
        if (chunk.text) onStream(chunk.text);
    }
};

export const testFineTunedModel = async (modelName: string, prompt: string, onStream: (chunk: string) => void) => {
    const stream = await retryOperation<any>(() => ai.models.generateContentStream({
        model: 'gemini-2.5-flash', 
        contents: `[Simulating model ${modelName}] ${prompt}`
    }));
    for await (const chunk of stream) {
        if (chunk.text) onStream(chunk.text);
    }
};

export const generateSocialContent = async (
    prompt: string, 
    platform: string, 
    onStream: (chunk: string) => void,
    mediaRef?: string
) => {
    const parts: any[] = [{ text: `Generate ${platform} content for: ${prompt}` }];
    
    if (mediaRef && mediaRef.startsWith('data:')) {
        const mimeType = getMimeType(mediaRef, 'image/png');
        const data = mediaRef.split(',')[1];
        parts.unshift({ inlineData: { mimeType, data } });
    }

    const stream = await retryOperation<any>(() => ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: { parts }
    }));

    for await (const chunk of stream) {
        if (chunk.text) onStream(chunk.text);
    }
};

export const planAgentTask = async (agent: AIAgent, task: string, fileStructure: string, projectType: ProjectType): Promise<{filesToEdit: string[], strategy: string, requiresSearch: boolean}> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Plan the execution of this task: "${task}". Project Type: ${projectType}.
            File Structure:\n${fileStructure}\n
            Return JSON: { "filesToEdit": string[], "strategy": string, "requiresSearch": boolean }`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: `You are ${agent.name}, role: ${agent.role}. Persona: ${agent.systemPrompt}.`
            }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return { filesToEdit: [], strategy: "Manual intervention required.", requiresSearch: false };
    }
};

export const analyzeFile = async (agent: AIAgent, fileName: string, content: string, task: string, context: AgentContext): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze ${fileName} in relation to task: "${task}".
            Code:\n${content}\n
            Context:\n${JSON.stringify(context.terminalLogs)}\n
            Return a brief analysis of what needs to change.`,
            config: { systemInstruction: agent.systemPrompt }
        }));
        return response.text || 'Analysis failed.';
    } catch {
        return 'Analysis failed.';
    }
};

export const executeBuildTask = async (
    agent: AIAgent, 
    fileName: string, 
    content: string, 
    instructions: string, 
    context: AgentContext, 
    feedback: string, 
    projectType: ProjectType, 
    isNewFile: boolean, 
    useSearch: boolean
): Promise<{ code: string, logs: string[] }> => {
    try {
        const tools: any[] = [];
        if (useSearch) tools.push({ googleSearch: {} });

        const prompt = `Task: ${instructions}. 
        File: ${fileName}. 
        Project Type: ${projectType}.
        ${isNewFile ? 'Create this file from scratch.' : 'Modify existing code.'}
        ${feedback ? `Feedback from previous attempt: ${feedback}` : ''}
        ${context.mcpContext ? `Rules: ${context.mcpContext}` : ''}
        
        Return the FULL file content only. No markdown fences if possible, or inside standard code blocks.`;

        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: prompt }, { text: `Current Code:\n${content}` }] }
            ],
            config: {
                tools: tools.length > 0 ? tools : undefined,
                systemInstruction: agent.systemPrompt
            }
        }));

        const logs: string[] = [];
        if (response.candidates?.[0]?.groundingMetadata) {
            logs.push("Used Google Search grounding.");
        }

        return { code: cleanJson(response.text || content), logs };
    } catch {
        return { code: content, logs: ["Generation failed"] };
    }
};

export const runAgentFileTask = async (agent: AIAgent, fileName: string, content: string, context: AgentContext): Promise<string> => {
    // Wrapper for simple tasks
    const res = await executeBuildTask(agent, fileName, content, "Improve code", context, "", ProjectType.REACT_WEB, false, false);
    return res.code;
};

export const reviewBuildTask = async (agent: AIAgent, fileName: string, oldCode: string, newCode: string, instructions: string, context: AgentContext, projectType: ProjectType): Promise<{ approved: boolean, feedback: string, issues: string[], fixCode?: string, suggestedCommand?: string }> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Review changes for ${fileName}. Task: ${instructions}.
            Old Code Length: ${oldCode.length}. New Code Length: ${newCode.length}.
            Verify logic, syntax, and safety.
            Return JSON: { "approved": boolean, "feedback": string, "issues": string[], "fixCode": string (optional auto-fix), "suggestedCommand": string (optional terminal fix) }`,
            config: { 
                responseMimeType: 'application/json',
                systemInstruction: agent.systemPrompt
            }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return { approved: false, feedback: "Review failed", issues: ["AI Error"] };
    }
};

export const delegateTasks = async (phase: ProjectPhase, agents: AIAgent[]): Promise<{ assignments: { agentName: string, taskDescription: string, targetFile?: string }[] }> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Delegate tasks for phase "${phase.title}".
            Goals: ${phase.goals.join(', ')}.
            Available Agents: ${agents.map(a => a.name + " (" + a.role + ")").join(', ')}.
            Return JSON: { "assignments": [{ "agentName": string, "taskDescription": string, "targetFile": string (optional) }] }`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return { assignments: [] };
    }
};

export const generateArchitecture = async (description: string): Promise<{ nodes: any[], links: any[] }> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Design system architecture for: "${description}".
            Return JSON: { "nodes": [{ "id": string, "label": string, "type": "frontend"|"backend"|"database"|"storage" }], "links": [{ "source": string, "target": string }] }`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '{"nodes":[], "links":[]}');
        return JSON.parse(text);
    } catch {
        return { nodes: [], links: [] };
    }
};

export const optimizeArchitecture = async (nodes: any[], links: any[]): Promise<{ nodes: any[], links: any[] }> => {
    return { nodes, links };
};

export const generatePerformanceReport = async (fileStructure: string): Promise<any> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze project structure for performance:
            ${fileStructure}
            Return JSON: { "scores": { "performance": number, "accessibility": number, "bestPractices": number, "seo": number }, "opportunities": [{ "title": string, "description": string, "savings": string }] }`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return null;
    }
};

export const runSecurityAudit = async (fileStructure: string, packageJson: string): Promise<any[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Audit project for security vulnerabilities.
            Structure:\n${fileStructure}
            Dependencies:\n${packageJson}
            Return JSON array: [{ "severity": "critical"|"high"|"medium"|"low", "title": string, "description": string, "file": string }]`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '[]');
        return JSON.parse(text);
    } catch {
        return [];
    }
};

export const chatWithVoice = async (text: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Conversational response to: "${text}". Keep it concise and natural.`
        }));
        return response.text || "I didn't catch that.";
    } catch {
        return "Service unavailable.";
    }
};