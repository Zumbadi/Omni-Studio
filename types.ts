
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  WORKSPACE = 'WORKSPACE',
  FINETUNE = 'FINETUNE',
  AUDIO = 'AUDIO',
  MEDIA = 'MEDIA',
  SETTINGS = 'SETTINGS'
}

export enum ProjectType {
  REACT_WEB = 'React Web',
  REACT_NATIVE = 'React Native (Expo)',
  IOS_APP = 'iOS App (Swift)',
  ANDROID_APP = 'Android App (Kotlin)',
  NODE_API = 'Node.js API'
}

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  lastModified: string;
  fileCount: number;
  roadmap?: ProjectPhase[];
}

export interface ProjectPhase {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed';
  goals: string[];
  tasks: { id: string; text: string; done: boolean }[];
}

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileNode[];
  isOpen?: boolean;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'unmodified';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system' | 'critic';
  text: string;
  timestamp: number;
  attachments?: any[];
  critique?: {
    score: number;
    issues: string[];
    suggestions: string[];
  };
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  format: 'jsonl' | 'txt';
  size: string;
  content: string; // The actual training data
  created: string;
}

export interface FineTuningJob {
  id: string;
  modelName: string;
  baseModel: string;
  status: 'queued' | 'training' | 'completed' | 'failed';
  progress: number;
  accuracy: number;
  loss: number;
  datasetSize: string;
  startedAt: string;
}

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'robot';
  style: 'narrative' | 'casual' | 'news' | 'energetic';
  isCloned: boolean;
  apiMapping?: string; // Maps to a valid Gemini Voice Name (e.g., 'Puck')
  voiceId?: string;
}

export interface AudioTrack {
  id: string;
  name: string;
  type: 'voiceover' | 'music' | 'sfx';
  duration: number; // seconds
  startOffset: number; // seconds
  audioUrl?: string; // Blob URL or Data URI
  // Pro Mixing Features
  volume?: number; // 0.0 to 1.0
  muted?: boolean;
  solo?: boolean;
}

export interface TimelineClip {
  id: string;
  start: number;
  duration: number;
  assetId: string;
  transition?: 'cut' | 'fade' | 'dissolve' | 'slide-left' | 'slide-right' | 'zoom' | 'blur' | 'wipe';
}

export interface Scene {
  id: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'pending' | 'generating' | 'done';
  // Pro Timeline Features
  duration?: number; // seconds
  mediaStartTime?: number; // Offset in seconds from the start of the source video
  transition?: 'cut' | 'fade' | 'dissolve' | 'slide-left' | 'slide-right' | 'zoom' | 'blur' | 'wipe';
  bgRemoved?: boolean;
}

export interface Character {
  id: string;
  name: string;
  imageUrl: string;
  description?: string; // AI-generated visual description for consistency
}

export interface ReferenceAsset {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  stylePrompt?: string; // Extracted style description
}

export interface ContentStrategy {
  targetAudience: string;
  primaryGoal: 'brand_awareness' | 'conversion' | 'engagement' | 'traffic';
  contentPillars: string[];
  toneVoice: string;
  postingFrequency: string;
}

export interface SocialPost {
  id: string;
  title: string;
  platform: 'youtube' | 'tiktok' | 'twitter' | 'instagram';
  status: 'idea' | 'scripting' | 'generating' | 'ready' | 'uploaded';
  thumbnail?: string;
  views?: string;
  script?: string;
  hashtags?: string[];
  scenes?: Scene[];
  scheduledDate?: string;
  // Pro Features
  characters?: Character[];
  styleReferences?: ReferenceAsset[];
  audioTrackId?: string; // Linked audio track from Audio Studio
}

export interface Extension {
  id: string;
  name: string;
  description: string;
  publisher: string;
  downloads: string;
  installed: boolean;
  icon?: string;
}

export interface GitCommit {
  id: string;
  message: string;
  author: string;
  date: string;
  hash: string;
}

export interface GitBranch {
  name: string;
  active: boolean;
}

export interface AgentTask {
  id: string;
  type: 'docs' | 'tests' | 'refactor' | 'custom';
  name: string;
  status: 'idle' | 'running' | 'completed' | 'cancelled';
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  logs: string[];
  fileList?: { name: string; status: 'pending' | 'processing' | 'done' | 'error' }[];
}

export interface AuditIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  file?: string;
  line?: number;
}

export interface PerformanceReport {
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  opportunities: {
    title: string;
    description: string;
    savings?: string;
  }[];
}

export interface ArchNode {
  id: string;
  type: 'frontend' | 'backend' | 'database' | 'auth' | 'storage' | 'function';
  label: string;
  x: number;
  y: number;
  details?: string;
}

export interface ArchLink {
  id: string;
  source: string;
  target: string;
}

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  model: 'gemini-3-pro-preview' | 'gemini-2.5-flash';
  systemPrompt: string;
  avatar?: string;
  isManager?: boolean;
}

export interface Snippet {
  id: string;
  name: string;
  language: string;
  code: string;
  description?: string;
}

export interface ActivityItem {
  id: string;
  type: 'commit' | 'deploy' | 'post' | 'alert' | 'task';
  title: string;
  desc: string;
  time: string;
  projectId?: string;
}
