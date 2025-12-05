
import { GoogleGenAI, Type, Schema, Modality, LiveServerMessage, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { ProjectType, AIAgent, ProjectPhase, AgentContext, Voice, Scene, ChatMessage, AudioTrack, SocialPost, ArchNode, ArchLink, PerformanceReport, AuditIssue, TestResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helpers ---

// Rate Limiter to prevent bursting (Client-side throttling)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 4000; // Increased to 4 seconds to prevent 429s (approx 15 req/min)

const throttle = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLast));
  }
  lastRequestTime = Date.now();
};

// Exponential Backoff Retry Helper with Jitter & Better Error Parsing
const retryOperation = async <T>(operation: () => Promise<T>, retries = 5, delay = 5000): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      await throttle(); // Enforce rate limit before request
      return await operation();
    } catch (error: any) {
      // Parse Error Object (handle various SDK/API formats)
      const errBody = error?.response?.data?.error || error?.error || error;
      const code = errBody?.code || error?.status || error?.code;
      const message = errBody?.message || error?.message || JSON.stringify(error);
      
      const isRateLimit = 
        code === 429 || 
        message.includes('429') || 
        message.includes('quota') || 
        message.includes('RESOURCE_EXHAUSTED') ||
        error?.response?.status === 429;
      
      const isServerOverload = code === 503 || message.includes('503') || message.includes('overloaded');

      if (isRateLimit || isServerOverload) {
        if (i < retries - 1) {
            // Add jitter: +/- 1000ms
            const jitter = Math.random() * 1000;
            // Exponential backoff: 5s, 10s, 20s...
            const waitTime = (delay * Math.pow(2, i)) + jitter;
            
            console.warn(`Gemini API Warning (${isRateLimit ? 'Rate Limit' : 'Overload'}). Retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1}/${retries})`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
        } else {
            console.error("Max retries reached for API.");
            throw new Error(`API Error: ${isRateLimit ? 'Rate Limit Exceeded' : 'Service Unavailable'}. Please try again later.`);
        }
      }
      
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

    // Initial connection promise with retry
    const sessionPromise = retryOperation(async () => {
        return await ai.live.connect({
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
    }, 3, 2000); // Retry connection up to 3 times
    
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

export const generatePodcastScript = async (
    topic: string, 
    hostName: string, 
    guestName: string,
    style: string = 'Casual Chat',
    sourceMaterial: string = ''
): Promise<{speaker: string, text: string}[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a podcast script (approx 5-8 exchanges) about "${topic}".
            
            Style: ${style}
            Host Character: ${hostName}
            Guest Character: ${guestName}
            
            ${sourceMaterial ? `Source Material / Context (Ground the discussion in this): \n"${sourceMaterial.substring(0, 3000)}..."\n` : ''}
            
            Style Guidelines:
            - Deep Dive: Analytical, detailed, intellectual tone. Focus on unpacking complexity.
            - Debate: Conflicting viewpoints, respectful but argumentative. Clear thesis and antithesis.
            - News Brief: Quick, factual, rapid-fire information. Professional journalism tone.
            - Casual Chat: Friendly, jokes, loose structure, interruptions, "um"s and "ah"s allowed.
            - Storytelling: Narrative focused, descriptive, immersive.
            
            Return ONLY a JSON array of objects: [{"speaker": "${hostName}", "text": "..."}, ...]`,
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

// --- Architecture ---

export const generateArchitecture = async (description: string): Promise<{ nodes: any[], links: any[] }> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a system architecture diagram for: "${description}".
            Return JSON with "nodes" (id, label, type: frontend|backend|database|storage|function, details) and "links" (source, target).
            Position nodes (x, y) roughly in a layout.`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return { nodes: [], links: [] };
    }
};

export const optimizeArchitecture = async (nodes: any[], links: any[]): Promise<{ nodes: any[], links: any[] }> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Optimize this architecture for scalability and cost.
            Current: ${JSON.stringify({nodes, links})}
            Return updated JSON with "nodes" and "links".`,
            config: { responseMimeType: 'application/json' }
        }));
        const text = cleanJson(response.text || '{}');
        return JSON.parse(text);
    } catch {
        return { nodes, links };
    }
};

// --- Audit ---

export const generatePerformanceReport = async (fileStructure: string): Promise<PerformanceReport | null> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this project structure for performance bottlenecks.
            Structure:
            ${fileStructure}
            
            Return JSON: {
                "scores": { "performance": number, "accessibility": number, "bestPractices": number, "seo": number },
                "opportunities": [{ "title": string, "description": string, "savings": string }]
            }`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '{}'));
    } catch {
        return null;
    }
};

export const runSecurityAudit = async (fileStructure: string, packageJson: string): Promise<AuditIssue[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Perform a security audit.
            Files:
            ${fileStructure}
            Package.json:
            ${packageJson}
            
            Return JSON array of issues: [{ "id": string, "severity": "critical"|"high"|"medium"|"low", "title": string, "description": string, "file": string }]`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '[]'));
    } catch {
        return [];
    }
};

// --- Docs ---

export const generateProjectDocs = async (fileStructure: string, type: string, onChunk: (text: string) => void): Promise<void> => {
    try {
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Generate comprehensive documentation (README.md) for a ${type} project.
            Structure:
            ${fileStructure}
            
            Include: Overview, Setup, Architecture, and Key Features.`
        });
        for await (const chunk of stream) {
            onChunk(chunk.text || '');
        }
    } catch (e) {
        console.error(e);
    }
};

// --- Git ---

export const generateCommitMessage = async (modifiedFiles: string[]): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a concise git commit message for changes in: ${modifiedFiles.join(', ')}. Follow Conventional Commits.`
        }));
        return response.text?.trim() || 'Update files';
    } catch {
        return 'Update files';
    }
};

// --- Scaffold ---

export const generateProjectScaffold = async (description: string, type: string): Promise<any[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a file structure for a ${type} project: "${description}".
            Return a JSON array of file nodes. 
            Format: [{ "name": "filename", "type": "file"|"directory", "children": [], "content": "string (for files)" }]
            Provide valid boilerplate content for key files.`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '[]'));
    } catch {
        return [];
    }
};

// --- Chat & Code ---

export const generateCodeResponse = async (
    prompt: string, 
    currentCode: string, 
    type: string, 
    fileStructure: string, 
    modelName: string,
    onChunk: (text: string) => void,
    onMetadata: (meta: any) => void,
    attachedImage?: string,
    history?: any[],
    useSearch?: boolean,
    useMaps?: boolean
): Promise<void> => {
    try {
        const historyContext = history?.slice(-5).map(h => `${h.role}: ${h.text}`).join('\n') || '';
        const parts: any[] = [{ text: `
            Project Type: ${type}
            File Structure:
            ${fileStructure}
            
            Current File Code:
            ${currentCode}
            
            Chat History:
            ${historyContext}
            
            User Request: ${prompt}
        ` }];

        if (attachedImage) {
            parts.push({ inlineData: { mimeType: 'image/png', data: attachedImage.split(',')[1] } });
        }

        const tools: any[] = [];
        if (useSearch) tools.push({ googleSearch: {} });
        if (useMaps) tools.push({ googleMaps: {} });

        const config: any = {};
        if (tools.length > 0) {
            config.tools = tools;
        }

        const stream = await ai.models.generateContentStream({
            model: modelName.includes('gemini') ? modelName : 'gemini-2.5-flash',
            contents: { parts },
            config
        });

        for await (const chunk of stream) {
            onChunk(chunk.text || '');
            if (chunk.candidates?.[0]?.groundingMetadata) {
                onMetadata(chunk.candidates[0].groundingMetadata);
            }
        }
    } catch (e) {
        console.error(e);
        onChunk(`Error: ${(e as any).message}`);
    }
};

export const critiqueCode = async (code: string, task: string): Promise<any> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Critique this code based on task: "${task}".
            Code:
            ${code}
            
            Return JSON: { "score": number (0-100), "issues": string[], "suggestions": string[], "fixCode": string (optional optimized version) }`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '{}'));
    } catch {
        return null;
    }
};

export const generateGhostText = async (prefix: string, suffix: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Complete this code.
            Prefix:
            ${prefix.slice(-500)}
            Suffix:
            ${suffix.slice(0, 200)}
            
            Return ONLY the missing code text. No markdown.`,
        }));
        return response.text || '';
    } catch {
        return '';
    }
};

// --- Terminal ---

export const generateTerminalCommand = async (query: string, projectType: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate this user request to a terminal command for a ${projectType} project.
            Request: "${query}"
            Return ONLY the command string.`
        }));
        return response.text?.trim() || '';
    } catch {
        return '';
    }
};

// --- Fine Tuning ---

export const generateSyntheticData = async (topic: string, count: number, onChunk: (text: string) => void): Promise<void> => {
    try {
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Generate ${count} synthetic training examples (JSONL format) for: "${topic}".
            Format: {"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}`
        });
        for await (const chunk of stream) {
            onChunk(chunk.text || '');
        }
    } catch (e) {
        console.error(e);
    }
};

export const testFineTunedModel = async (modelName: string, prompt: string, onChunk: (text: string) => void): Promise<void> => {
    // Simulate interaction since we can't actually call custom models easily in this demo setup without endpoint
    try {
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash', // Fallback for demo
            contents: `[Simulating ${modelName}] ${prompt}`
        });
        for await (const chunk of stream) {
            onChunk(chunk.text || '');
        }
    } catch (e) {
        console.error(e);
    }
};

// --- Agent Orchestrator ---

export const planAgentTask = async (agent: any, task: string, fileStructure: string, projectType: string): Promise<{strategy: string, filesToEdit: string[], requiresSearch: boolean}> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `You are ${agent.name}, a ${agent.role}.
            Task: "${task}"
            Project Type: ${projectType}
            Files:
            ${fileStructure}
            
            Plan the execution. Identify which files need creation or modification.
            Return JSON: { "strategy": string, "filesToEdit": string[], "requiresSearch": boolean }`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '{}'));
    } catch {
        return { strategy: "Manual check required", filesToEdit: [], requiresSearch: false };
    }
};

export const runAgentFileTask = async (agent: any, fileName: string, fileContent: string, context: any): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: agent.model || 'gemini-2.5-flash',
            contents: `You are ${agent.name} (${agent.role}).
            Context: ${JSON.stringify(context.debugVariables || {})}
            Task: Modify/Create ${fileName}.
            Current Content:
            ${fileContent}
            
            Return ONLY the new file content.`
        }));
        return cleanJson(response.text || fileContent);
    } catch {
        return fileContent;
    }
};

export const executeBuildTask = async (agent: any, fileName: string, content: string, instructions: string, context: any, feedback: string, type: string, isNew: boolean, useSearch: boolean): Promise<{code: string, logs: string[]}> => {
    try {
        const tools = useSearch ? [{ googleSearch: {} }] : undefined;
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: agent.model || 'gemini-2.5-flash',
            contents: `Agent: ${agent.name}
            Task: ${instructions}
            File: ${fileName}
            Status: ${isNew ? 'New File' : 'Existing'}
            Feedback: ${feedback}
            Code:
            ${content}
            
            Implement the requested changes/code. Return ONLY the code.`,
            config: { tools }
        }));
        
        let code = cleanJson(response.text || content);
        if (code.startsWith('```')) {
            code = code.replace(/^```\w*\n?/, '').replace(/```$/, '');
        }
        
        return { code, logs: [] };
    } catch (e: any) {
        return { code: content, logs: [`Error: ${e.message}`] };
    }
};

export const reviewBuildTask = async (agent: any, fileName: string, original: string, modified: string, instructions: string, context: any, type: string): Promise<any> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `You are ${agent.name} (Reviewer).
            Instructions: ${instructions}
            File: ${fileName}
            
            Original:
            ${original.slice(0, 1000)}...
            
            Modified:
            ${modified.slice(0, 1000)}...
            
            Verify the changes.
            Return JSON: { "approved": boolean, "feedback": string, "issues": string[], "fixCode": string (optional), "suggestedCommand": string (optional) }`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '{}'));
    } catch {
        return { approved: false, feedback: "Review failed", issues: ["AI Error"] };
    }
};

export const delegateTasks = async (phase: any, agents: any[]): Promise<{assignments: any[]}> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Phase: ${phase.title}
            Goals: ${phase.goals.join(', ')}
            Agents: ${JSON.stringify(agents.map((a: any) => ({name: a.name, role: a.role})))}
            
            Delegate tasks to agents.
            Return JSON: { "assignments": [{ "agentName": string, "taskDescription": string, "targetFile": string }] }`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '{"assignments":[]}'));
    } catch {
        return { assignments: [] };
    }
};

export const generateProjectPlan = async (description: string, type: string): Promise<ProjectPhase[]> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Create a development roadmap for a ${type} project: "${description}".
            Return JSON array of phases: [{ "id": string, "title": string, "status": "pending", "goals": string[], "tasks": [{ "id": string, "text": string, "done": boolean }] }]`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '[]'));
    } catch {
        return [];
    }
};

export const generateChangelog = async (files: string[], task: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a changelog entry for task: "${task}". Modified files: ${files.join(', ')}.`
        }));
        return response.text || '';
    } catch {
        return `Updated ${files.length} files.`;
    }
};

export const analyzeFile = async (agent: any, fileName: string, content: string, instructions: string, context: any): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: agent.model || 'gemini-2.5-flash',
            contents: `Analyze ${fileName} for task: "${instructions}".
            Content:
            ${content.slice(0, 2000)}...
            
            Provide a brief summary of necessary changes.`
        }));
        return response.text || '';
    } catch {
        return '';
    }
};

export const autoUpdateReadme = async (currentContent: string, changelog: string): Promise<string> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Append this changelog to the README (or create Recent Changes section).
            Readme:
            ${currentContent}
            
            Changelog:
            ${changelog}
            
            Return full updated README.`
        }));
        return response.text || currentContent;
    } catch {
        return currentContent;
    }
};

export const generateTestResults = async (fileName: string, content: string): Promise<TestResult | Partial<TestResult>> => {
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze this test file and its likely target code (inferred). Simulate a test run.
            File: ${fileName}
            Content:
            ${content}
            
            Return JSON: { "passed": number, "failed": number, "duration": number, "suites": [{ "name": string, "status": "pass"|"fail", "assertions": [{ "name": string, "status": "pass"|"fail", "error": string }] }] }`,
            config: { responseMimeType: 'application/json' }
        }));
        return JSON.parse(cleanJson(response.text || '{}'));
    } catch {
        return { passed: 0, failed: 1, duration: 0, suites: [] };
    }
};

export const generateSocialContent = async (prompt: string, platform: string, onChunk: (text: string) => void, mediaData?: string): Promise<void> => {
    try {
        const parts: any[] = [{ text: prompt }];
        if (mediaData) {
            parts.push({ inlineData: { mimeType: 'image/png', data: mediaData.split(',')[1] } });
        }
        
        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: { parts }
        });
        for await (const chunk of stream) {
            onChunk(chunk.text || '');
        }
    } catch (e) {
        console.error(e);
    }
};
