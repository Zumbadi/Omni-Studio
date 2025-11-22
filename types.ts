
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
}

export interface Scene {
  id: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'pending' | 'generating' | 'done';
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