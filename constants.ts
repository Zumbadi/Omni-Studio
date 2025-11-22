
import { Project, ProjectType, FileNode, FineTuningJob, Voice, SocialPost, Extension, GitCommit } from './types';

export const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'E-Commerce Dashboard',
    description: 'Admin panel for Shopify integration',
    type: ProjectType.REACT_WEB,
    lastModified: '2 mins ago',
    fileCount: 12
  },
  {
    id: '2',
    name: 'Fitness Tracker App',
    description: 'Mobile app for tracking workouts',
    type: ProjectType.REACT_NATIVE,
    lastModified: '4 hours ago',
    fileCount: 24
  },
  {
    id: '3',
    name: 'Payment Microservice',
    description: 'FastAPI backend for payment processing',
    type: ProjectType.NODE_API,
    lastModified: '1 day ago',
    fileCount: 8
  }
];

export const PROJECT_TEMPLATES = [
  { 
    id: 't1', 
    name: 'SaaS Starter Kit', 
    type: ProjectType.REACT_WEB, 
    description: 'Landing page, Auth, and Dashboard layout using Tailwind.', 
    icon: 'Globe',
    prompt: 'Create a SaaS starter kit with a landing page (Hero, Features, Pricing), authentication forms (Login/Signup), and a protected dashboard layout with a sidebar.' 
  },
  { 
    id: 't2', 
    name: 'E-commerce Store', 
    type: ProjectType.REACT_WEB, 
    description: 'Product grid, cart logic, and checkout flow.', 
    icon: 'ShoppingBag',
    prompt: 'Create an e-commerce store with a responsive product grid, a shopping cart state manager, and a checkout form with validation.' 
  },
  { 
    id: 't3', 
    name: 'Social Feed App', 
    type: ProjectType.REACT_NATIVE, 
    description: 'Scrollable feed with images, likes, and comments.', 
    icon: 'Smartphone',
    prompt: 'Create a mobile social media feed app using React Native. Include a scrollable FlatList of posts with images, a like button component, and a tab bar navigation.' 
  },
  { 
    id: 't4', 
    name: 'Fitness Tracker', 
    type: ProjectType.REACT_NATIVE, 
    description: 'Workout logger with progress charts.', 
    icon: 'Activity',
    prompt: 'Create a fitness tracking mobile app. Include a screen to log workouts (sets/reps), a timer component, and a summary screen showing weekly progress.' 
  },
  { 
    id: 't5', 
    name: 'REST API Boilerplate', 
    type: ProjectType.NODE_API, 
    description: 'Express server with Auth middleware and User CRUD.', 
    icon: 'Server',
    prompt: 'Create a production-ready REST API boilerplate using Express. Include authentication middleware (JWT), a User model, and CRUD routes for managing resources.' 
  },
];

// Simplified template for Web Preview Compatibility
export const WEB_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'src',
    type: 'directory',
    isOpen: true,
    children: [
      { id: '1', name: 'App.tsx', type: 'file', content: `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans text-white">
      <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 shadow-2xl border border-slate-700">
        <h1 className="text-3xl font-bold text-indigo-400 mb-2">Omni Web App</h1>
        <p className="text-slate-400 mb-8">
          Edit <code className="bg-slate-950 px-2 py-1 rounded text-sm text-indigo-300">App.tsx</code> to see live changes.
        </p>
        
        <div className="flex flex-col items-center gap-4">
          <div className="text-6xl font-bold text-white mb-4 tabular-nums">{count}</div>
          
          <div className="flex gap-4 w-full">
             <button 
               onClick={() => setCount(c => c - 1)}
               className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all"
             >
               Decrease
             </button>
             <button 
               onClick={() => setCount(c => c + 1)}
               className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-900/50"
             >
               Increase
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}` },
      { id: '2', name: 'index.css', type: 'file', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;` },
    ]
  },
  {
    id: '4',
    name: 'package.json',
    type: 'file',
    content: `{\n  "name": "omni-web",\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  }\n}`
  }
];

// Simplified template for Native Preview Compatibility (Shimmed)
export const NATIVE_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'app',
    type: 'directory',
    isOpen: true,
    children: [
      { id: '1', name: 'App.tsx', type: 'file', content: `import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <Text style={styles.title}>Omni Mobile</Text>
         <Text style={styles.subtitle}>Live Preview</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.card}>
           <Text style={styles.cardTitle}>Getting Started</Text>
           <Text style={styles.cardText}>
             This is a simulated React Native environment running in the browser.
           </Text>
           <TouchableOpacity 
             style={styles.button} 
             onPress={() => alert('Button Pressed!')}
           >
             <Text style={styles.buttonText}>Tap Me</Text>
           </TouchableOpacity>
        </View>

        <View style={[styles.card, { marginTop: 20 }]}>
           <Text style={styles.cardTitle}>Features</Text>
           <Text style={styles.cardText}>• Hot Reloading</Text>
           <Text style={styles.cardText}>• Flexbox Layout</Text>
           <Text style={styles.cardText}>• Touch Handling</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#4f46e5',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#a5b4fc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  }
});` },
    ]
  },
  {
    id: '4',
    name: 'app.json',
    type: 'file',
    content: `{\n  "expo": {\n    "name": "omni-mobile",\n    "slug": "omni-mobile"\n  }\n}`
  }
];

// Node/Express Template
export const NODE_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'src',
    type: 'directory',
    isOpen: true,
    children: [
      { id: '1', name: 'index.js', type: 'file', content: `const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Mock Database
const users = [
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' }
];

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Omni API v1' });
});

app.get('/users', (req, res) => {
  res.json({ 
    count: users.length,
    data: users 
  });
});

app.post('/users', (req, res) => {
  const newUser = { id: users.length + 1, ...req.body };
  users.push(newUser);
  res.status(201).json(newUser);
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});` },
    ]
  },
  {
    id: '3',
    name: 'package.json',
    type: 'file',
    content: `{\n  "name": "omni-api",\n  "main": "index.js",\n  "dependencies": {\n    "express": "^4.18.2"\n  }\n}`
  }
];

export const MOCK_JOBS: FineTuningJob[] = [
  {
    id: 'job-101',
    modelName: 'Customer-Support-Bot-v1',
    baseModel: 'Llama-3-8b',
    status: 'training',
    progress: 45,
    accuracy: 0.76,
    loss: 1.2,
    datasetSize: '150MB (JSONL)',
    startedAt: '10:30 AM'
  },
  {
    id: 'job-100',
    modelName: 'Legal-Doc-Analyzer',
    baseModel: 'Mistral-7b',
    status: 'completed',
    progress: 100,
    accuracy: 0.92,
    loss: 0.4,
    datasetSize: '500MB (JSONL)',
    startedAt: 'Yesterday'
  }
];

export const MOCK_DEPLOYMENTS = [
  { id: 'dep-1', date: 'Oct 12, 10:30 AM', hash: 'a1b2c3d', status: 'Success', env: 'Production', url: 'https://app-v1.omni.ai' },
  { id: 'dep-2', date: 'Oct 11, 4:15 PM', hash: 'e5f6g7h', status: 'Failed', env: 'Staging', url: '-' },
  { id: 'dep-3', date: 'Oct 10, 9:00 AM', hash: 'i8j9k0l', status: 'Success', env: 'Preview', url: 'https://pr-102.omni.ai' },
];

export const MOCK_COMMITS: GitCommit[] = [
    { id: 'c1', message: 'Initial commit', author: 'You', date: '2 days ago', hash: '8a2b3c' },
    { id: 'c2', message: 'Add auth service', author: 'You', date: 'Yesterday', hash: '9f1e2d' },
    { id: 'c3', message: 'Update styles', author: 'You', date: '5 hours ago', hash: '4d5c6b' }
];

export const DATASET_PREVIEW = `{"messages": [{"role": "user", "content": "Create a button component in React Native"}, {"role": "assistant", "content": "Here is a custom button component..."}]}
{"messages": [{"role": "user", "content": "How do I optimize FlatList?"}, {"role": "assistant", "content": "To optimize FlatList, use getItemLayout and memoize renderItem..."}]}
{"messages": [{"role": "user", "content": "Fix this flexbox layout"}, {"role": "assistant", "content": "The issue is with alignItems. Set it to 'center' to fix alignment."}]}
{"messages": [{"role": "user", "content": "What is Expo?"}, {"role": "assistant", "content": "Expo is a framework and platform for universal React applications."}]}
{"messages": [{"role": "user", "content": "Add TypeScript support"}, {"role": "assistant", "content": "Install typescript and @types/react to get started."}]}
... (Showing 5 of 12,405 lines)`;

export const MOCK_VOICES: Voice[] = [
  { id: 'v1', name: 'Marcus (Narrator)', gender: 'male', style: 'narrative', isCloned: false },
  { id: 'v2', name: 'Sarah (News)', gender: 'female', style: 'news', isCloned: false },
  { id: 'v3', name: 'Glados-X', gender: 'robot', style: 'casual', isCloned: true },
  { id: 'v4', name: 'Leo (Energetic)', gender: 'male', style: 'energetic', isCloned: false },
];

export const MOCK_SOCIAL_POSTS: SocialPost[] = [
  { id: 'p1', title: 'Top 5 React Native Tips', platform: 'youtube', status: 'uploaded', views: '12.5K', thumbnail: 'https://via.placeholder.com/150/000000/FFFFFF/?text=React' },
  { id: 'p2', title: 'Coding Vlog #42', platform: 'tiktok', status: 'ready', thumbnail: 'https://via.placeholder.com/150/000000/FFFFFF/?text=Vlog' },
  { id: 'p3', title: 'AI Architecture Explain', platform: 'twitter', status: 'generating' },
  { id: 'p4', title: 'Omni Launch Trailer', platform: 'youtube', status: 'idea' },
];

export const SYSTEM_COMMANDS = [
  '/clear - Clear chat history',
  '/help - Show this list',
  '/explain - Explain current file',
  '/fix - Fix bugs in current file'
];

export const MOCK_EXTENSIONS: Extension[] = [
  { id: 'ext1', name: 'Prettier - Code Formatter', description: 'Code formatter using prettier', publisher: 'Prettier', downloads: '38M', installed: true, icon: 'P' },
  { id: 'ext2', name: 'ES7+ React/Redux Snippets', description: 'Extensions for React, Redux and Graphql', publisher: 'dsznajder', downloads: '12M', installed: true, icon: 'R' },
  { id: 'ext3', name: 'Tailwind CSS IntelliSense', description: 'Intelligent Tailwind CSS tooling', publisher: 'Brad Cornes', downloads: '8M', installed: false, icon: 'T' },
  { id: 'ext4', name: 'Vim', description: 'Vim emulation for Visual Studio Code', publisher: 'vscodevim', downloads: '5M', installed: false, icon: 'V' },
  { id: 'ext5', name: 'GitLens', description: 'Supercharge Git within VS Code', publisher: 'GitKraken', downloads: '28M', installed: true, icon: 'G' },
];
