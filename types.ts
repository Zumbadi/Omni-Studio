
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
  NODE_API = 'Node.js API'
}

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  lastModified: string;
  fileCount: number;
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
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  attachments?: {
    type: 'image' | 'audio' | 'video';
    url: string;
    name?: string;
  }[];
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
}

export interface AudioTrack {
  id: string;
  name: string;
  type: 'voiceover' | 'music' | 'sfx';
  duration: number; // seconds
  startOffset: number; // seconds
  audioUrl?: string; // Blob URL or Data URI
  styleReference?: string; // Description of style derived from reference
}

export interface Character {
  id: string;
  name: string;
  imageUrl: string; // Reference face
  description?: string; // AI analyzed description
}

export interface TimelineClip {
  id: string;
  sceneId: string;
  startTime: number;
  duration: number;
  type: 'video' | 'image';
  url: string;
}

export interface Scene {
  id: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'pending' | 'generating' | 'done';
  characterId?: string; // Link to character for consistency
  removeBackground?: boolean;
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
  timeline?: TimelineClip[]; // For Director's Cut
  scheduledDate?: string;
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
