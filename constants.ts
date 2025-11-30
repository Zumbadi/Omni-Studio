
import { Project, ProjectType, FileNode, FineTuningJob, Voice, SocialPost, Extension, GitCommit, AIAgent, Snippet, ActivityItem } from './types';

export const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'E-Commerce Dashboard',
    description: 'Admin panel for Shopify integration',
    type: ProjectType.REACT_WEB,
    lastModified: '2 mins ago',
    fileCount: 26
  },
  {
    id: '2',
    name: 'Fitness Tracker App',
    description: 'Mobile app for tracking workouts',
    type: ProjectType.REACT_NATIVE,
    lastModified: '4 hours ago',
    fileCount: 32
  },
  {
    id: '3',
    name: 'Payment Microservice',
    description: 'FastAPI backend for payment processing',
    type: ProjectType.NODE_API,
    lastModified: '1 day ago',
    fileCount: 20
  }
];

export const PROJECT_TEMPLATES = [
  { 
    id: 't1', 
    name: 'SaaS Starter Kit', 
    type: ProjectType.REACT_WEB, 
    description: 'Landing page, Auth, and Dashboard layout.', 
    icon: 'Globe',
    prompt: 'Create a SaaS starter kit with a landing page (Hero, Features, Pricing), authentication forms (Login/Signup), and a protected dashboard layout with a sidebar. Use React, Tailwind CSS, and Lucide icons.' 
  },
  { 
    id: 't2', 
    name: 'Food Delivery Ecosystem', 
    type: ProjectType.REACT_NATIVE, 
    description: 'Customer App, Driver App, and Restaurant Dashboard.', 
    icon: 'Smartphone',
    prompt: 'Create a full Food Delivery Ecosystem. 1. React Native Customer App with food feed, cart, and tracking. 2. Driver App with order requests and map navigation. 3. React Web Restaurant Dashboard for order management. 4. Node.js Backend for order dispatching. Focus on the Customer App structure first.' 
  },
  { 
    id: 't4', 
    name: 'AI Chat Platform', 
    type: ProjectType.REACT_WEB, 
    description: 'ChatGPT clone with streaming response UI.', 
    icon: 'Bot',
    prompt: 'Create an AI Chat Interface similar to ChatGPT. Include a sidebar for chat history, a streaming message renderer with markdown support, and a Python (FastAPI) backend wrapper for the model API.' 
  },
  { 
    id: 't5', 
    name: 'REST API Boilerplate', 
    type: ProjectType.NODE_API, 
    description: 'Express server with Auth middleware and User CRUD.', 
    icon: 'Server',
    prompt: 'Create a production-ready REST API boilerplate using Express. Include authentication middleware (JWT), a User model, and CRUD routes for managing resources. Add a Dockerfile.' 
  },
  { 
    id: 't6', 
    name: 'Streaming Service', 
    type: ProjectType.REACT_WEB, 
    description: 'Netflix-style video catalog and player.', 
    icon: 'Film',
    prompt: 'Create a Streaming Service application (Netflix clone). Include a Hero banner with video background, horizontal scrolling rows for movie categories, a video player component, and a detailed info modal.' 
  },
  {
    id: 't8',
    name: 'Influencer Brand Kit',
    type: ProjectType.REACT_WEB,
    description: 'Portfolio, Media Kit, and Link-in-Bio page.',
    icon: 'Camera',
    prompt: 'Create a personal branding site for an influencer. Include a "Link in Bio" style mobile landing page, a Media Kit section with stats (followers, engagement), and a portfolio grid of instagram posts. Use a trendy, high-contrast aesthetic.'
  },
  {
    id: 't9',
    name: 'Travel Companion',
    type: ProjectType.REACT_NATIVE,
    description: 'Itinerary planner with maps and local guides.',
    icon: 'Map',
    prompt: 'Create a Travel Companion mobile app. Features: 1. Trip Itinerary Timeline. 2. Map view with points of interest (simulated). 3. "Local Gems" discovery feed. Use React Native with a bottom tab navigator and sleek, airy UI.'
  },
  {
    id: 't11',
    name: 'E-Commerce Storefront',
    type: ProjectType.REACT_WEB,
    description: 'Modern shop with cart, products, and checkout.',
    icon: 'ShoppingBag',
    prompt: 'Create a comprehensive E-Commerce Storefront. Features: 1. Responsive Grid Product Layout. 2. Product Detail Page with image gallery and "Add to Cart". 3. Slide-over Shopping Cart drawer. 4. Multi-step Checkout Form. Use Tailwind CSS for a minimalist, premium aesthetic.'
  },
  {
    id: 't12',
    name: '2D Browser Game',
    type: ProjectType.REACT_WEB,
    description: 'Canvas-based arcade game engine.',
    icon: 'Activity',
    prompt: 'Create a 2D Browser Game using React and HTML5 Canvas. Implement a core Game Loop, a Sprite Renderer class, and a Physics engine for collision detection. Create a demo "Space Shooter" level with player movement, shooting mechanics, and enemy waves.'
  },
  {
    id: 't13',
    name: 'Personal Finance App',
    type: ProjectType.REACT_NATIVE,
    description: 'Expense tracker with charts and budgets.',
    icon: 'Smartphone',
    prompt: 'Create a Personal Finance mobile app using React Native. Features: 1. Expense logging form with category selection. 2. Dashboard with a Donut Chart visualization of spending (using react-native-svg). 3. Monthly budget setting interface. Use a clean, trustworthy financial color palette.'
  },
  {
    id: 't14',
    name: 'Blog API Platform',
    type: ProjectType.NODE_API,
    description: 'Headless CMS API for blogging.',
    icon: 'Server',
    prompt: 'Create a robust Blog API Platform using Node.js and Express. Define Mongoose models for "Post", "Author", and "Comment". Implement RESTful routes for CRUD operations, pagination, and full-text search. Add JWT authentication middleware for protecting write operations.'
  },
  {
    id: 't15',
    name: 'Realtime Collaboration',
    type: ProjectType.REACT_WEB,
    description: 'Whiteboard app with live cursors (Socket.io).',
    icon: 'Users',
    prompt: 'Create a Realtime Collaboration Whiteboard using React and simulate Socket.io. Features: 1. A canvas where users can draw shapes. 2. Real-time "Live Cursors" of other users moving around. 3. A chat sidebar for team communication. Use React Context to manage the shared state.'
  },
  {
    id: 't16',
    name: 'CRM Dashboard',
    type: ProjectType.REACT_WEB,
    description: 'Customer management with data tables and stats.',
    icon: 'Briefcase',
    prompt: 'Create a CRM Dashboard for sales teams. Features: 1. A data-rich Customer Table with sorting and filtering. 2. A "Deal Pipeline" Kanban board. 3. Revenue forecasting charts using Recharts. Use a professional, enterprise-grade UI design with Tailwind CSS.'
  },
  {
    id: 't17',
    name: 'Markdown Blog',
    type: ProjectType.REACT_WEB,
    description: 'Static blog with markdown rendering.',
    icon: 'FileText',
    prompt: 'Create a developer blog engine. Features: 1. A homepage listing posts with reading time estimates. 2. A Post Viewer that renders Markdown content (simulate a markdown-to-html converter). 3. A dark/light mode toggle. Use a typography-focused layout inspired by Medium.'
  }
];

export const WEB_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'src',
    type: 'directory',
    isOpen: true,
    children: [
      {
        id: 'assets',
        name: 'assets',
        type: 'directory',
        isOpen: false,
        children: [
            { id: 'logo', name: 'logo.svg', type: 'file', content: '<svg>...</svg>' },
        ]
      },
      {
        id: 'components',
        name: 'components',
        type: 'directory',
        isOpen: true,
        children: [
          { id: 'btn', name: 'Button.tsx', type: 'file', content: `import React from 'react';\n\nexport const Button = ({ children, onClick, variant = 'primary' }) => (\n  <button \n    onClick={onClick} \n    className={\`px-4 py-2 rounded transition-colors \${variant === 'primary' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}\`}\n  >\n    {children}\n  </button>\n);` },
          { id: 'head', name: 'Header.tsx', type: 'file', content: `import React from 'react';\nimport { Bell, User } from 'lucide-react';\n\nexport const Header = () => (\n  <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900">\n    <div className="font-bold text-xl text-white">Omni SaaS</div>\n    <div className="flex items-center gap-4">\n      <Bell size={20} className="text-gray-400 hover:text-white cursor-pointer" />\n      <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold"><User size={16} /></div>\n    </div>\n  </header>\n);` },
        ]
      },
      { id: '1', name: 'App.tsx', type: 'file', content: `import React, { useState } from 'react';\nimport { Header } from './components/Header';\nimport { Button } from './components/Button';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-white">\n      <Header />\n      <main className="flex-1 p-8 flex flex-col items-center justify-center">\n        <h1 className="text-4xl font-bold mb-4">Welcome to Omni-Studio</h1>\n        <p className="text-slate-400 mb-8">Edit src/App.tsx to see changes.</p>\n        <div className="flex items-center gap-4">\n           <div className="text-6xl font-bold">{count}</div>\n           <Button onClick={() => setCount(c => c + 1)}>Increment</Button>\n        </div>\n      </main>\n    </div>\n  );\n}` },
      { id: '2', name: 'index.css', type: 'file', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;` },
    ]
  },
  {
    id: '4',
    name: 'package.json',
    type: 'file',
    content: `{\n  "name": "omni-web",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0",\n    "lucide-react": "^0.292.0",\n    "tailwindcss": "^3.3.0"\n  },\n  "scripts": {\n    "start": "vite",\n    "build": "vite build"\n  }\n}`
  },
  { id: 'docker', name: 'Dockerfile', type: 'file', content: `FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD ["npm", "start"]` },
  { id: 'compose', name: 'docker-compose.yml', type: 'file', content: `version: '3.8'\nservices:\n  web:\n    build: .\n    ports:\n      - "3000:3000"\n    volumes:\n      - .:/app\n      - /app/node_modules\n    environment:\n      - NODE_ENV=development` },
  { id: 'read', name: 'README.md', type: 'file', content: `# Omni Web Project\n\nGenerated by Omni-Studio. This project uses React and Tailwind CSS.` }
];

export const NATIVE_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'app',
    type: 'directory',
    isOpen: true,
    children: [
      { id: 'tabs', name: '(tabs)', type: 'directory', isOpen: true, children: [
          { id: 'idx', name: 'index.tsx', type: 'file', content: `import { StyleSheet } from 'react-native';\nimport EditScreenInfo from '@/components/EditScreenInfo';\nimport { Text, View } from '@/components/Themed';\n\nexport default function TabOneScreen() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.title}>Tab One</Text>\n      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />\n      <EditScreenInfo path="app/(tabs)/index.tsx" />\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },\n  title: { fontSize: 20, fontWeight: 'bold' },\n  separator: { marginVertical: 30, height: 1, width: '80%' },\n});` },
      ]},
      { id: 'layout', name: '_layout.tsx', type: 'file', content: `import FontAwesome from '@expo/vector-icons/FontAwesome';\nimport { Tabs } from 'expo-router';\n\nexport default function TabLayout() {\n  return (\n    <Tabs screenOptions={{ tabBarActiveTintColor: '#2f95dc' }}>\n      <Tabs.Screen name="index" options={{ title: 'Tab One', tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} /> }} />\n    </Tabs>\n  );\n}` },
    ]
  },
  { id: 'components', name: 'components', type: 'directory', isOpen: false, children: [
      { id: 'themed', name: 'Themed.tsx', type: 'file', content: `import { Text as DefaultText, View as DefaultView } from 'react-native';\nexport function Text(props) { return <DefaultText {...props} />; }` },
  ]},
  {
    id: '4',
    name: 'app.json',
    type: 'file',
    content: `{\n  "expo": {\n    "name": "omni-mobile",\n    "slug": "omni-mobile",\n    "version": "1.0.0",\n    "orientation": "portrait",\n    "icon": "./assets/images/icon.png",\n    "scheme": "myapp",\n    "userInterfaceStyle": "automatic"\n  }\n}`
  },
  { id: 'pkgn', name: 'package.json', type: 'file', content: `{\n  "name": "omni-mobile",\n  "main": "expo-router/entry",\n  "dependencies": {\n    "expo": "~50.0.14",\n    "expo-router": "~3.4.8",\n    "react": "18.2.0",\n    "react-native": "0.73.6"\n  }\n}` }
];

export const IOS_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'OmniApp',
    type: 'directory',
    isOpen: true,
    children: [
        { id: 'app', name: 'OmniApp.swift', type: 'file', content: `import SwiftUI\n\n@main\nstruct OmniApp: App {\n    var body: some Scene {\n        WindowGroup {\n            ContentView()\n        }\n    }\n}` },
        { id: 'content', name: 'ContentView.swift', type: 'file', content: `import SwiftUI\n\nstruct ContentView: View {\n    var body: some View {\n        VStack {\n            Image(systemName: "globe")\n                .imageScale(.large)\n                .foregroundStyle(.tint)\n            Text("Hello, iOS World!")\n        }\n        .padding()\n    }\n}\n\n#Preview {\n    ContentView()\n}` },
    ]
  },
  { id: 'proj', name: 'project.pbxproj', type: 'file', content: `// Simulated Xcode Project File` }
];

export const ANDROID_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'app',
    type: 'directory',
    isOpen: true,
    children: [
        { id: 'src', name: 'src', type: 'directory', isOpen: true, children: [
            { id: 'main', name: 'main', type: 'directory', isOpen: true, children: [
                { id: 'java', name: 'java', type: 'directory', children: [
                    { id: 'pkg', name: 'com.omni.app', type: 'directory', isOpen: true, children: [
                        { id: 'act', name: 'MainActivity.kt', type: 'file', content: `package com.omni.app\n\nimport android.os.Bundle\nimport androidx.activity.ComponentActivity\nimport androidx.activity.compose.setContent\nimport androidx.compose.material3.Text\nimport androidx.compose.runtime.Composable\n\nclass MainActivity : ComponentActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        setContent {\n            Greeting("Android")\n        }\n    }\n}\n\n@Composable\nfun Greeting(name: String) {\n    Text(text = "Hello $name!")\n}` }
                    ]}
                ]},
                { id: 'man', name: 'AndroidManifest.xml', type: 'file', content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application>\n        <activity android:name=".MainActivity" android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>` }
            ]}
        ]},
        { id: 'build', name: 'build.gradle.kts', type: 'file', content: `plugins {\n    alias(libs.plugins.androidApplication)\n    alias(libs.plugins.kotlinAndroid)\n}` }
    ]
  }
];

export const NODE_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'src',
    type: 'directory',
    isOpen: true,
    children: [
      { id: '1', name: 'app.js', type: 'file', content: `const express = require('express');\nconst app = express();\napp.use(express.json());\napp.get('/', (req, res) => res.send('API Running'));\nmodule.exports = app;` }
    ]
  },
  { id: 'pkg', name: 'package.json', type: 'file', content: `{\n  "name": "omni-api",\n  "version": "1.0.0",\n  "main": "src/app.js",\n  "scripts": { "start": "node src/app.js", "dev": "nodemon src/app.js" },\n  "dependencies": {\n    "express": "^4.18.2",\n    "mongoose": "^7.0.0",\n    "dotenv": "^16.0.0"\n  }\n}` },
  { id: 'docker', name: 'Dockerfile', type: 'file', content: `FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]` },
  { id: 'compose', name: 'docker-compose.yml', type: 'file', content: `version: '3.8'\nservices:\n  api:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      - MONGO_URI=mongodb://mongo:27017/omni\n    depends_on:\n      - mongo\n  mongo:\n    image: mongo:latest\n    ports:\n      - "27017:27017"` },
  { id: 'read', name: 'README.md', type: 'file', content: `# Omni API Project\n\nNode.js Express API generated by Omni-Studio.` }
];

export const DEFAULT_AGENTS: AIAgent[] = [
  { id: 'ag1', name: 'Nexus', role: 'Project Manager', description: 'Architects solutions and breaks down tasks.', model: 'gemini-3-pro-preview', systemPrompt: 'You are an elite software architect.', isManager: true, avatar: 'NX' },
  { id: 'ag2', name: 'Forge', role: 'Frontend Builder', description: 'Expert in React, Tailwind, and UI/UX.', model: 'gemini-2.5-flash', systemPrompt: 'You are a senior frontend engineer.', avatar: 'FG' },
  { id: 'ag3', name: 'Vector', role: 'Backend Engineer', description: 'Scalable APIs, Database, and Docker.', model: 'gemini-2.5-flash', systemPrompt: 'You are a backend specialist.', avatar: 'VT' },
  { id: 'ag4', name: 'Sentinel', role: 'QA & Critic', description: 'Reviews code, writes tests, and fixes bugs.', model: 'gemini-3-pro-preview', systemPrompt: 'You are a ruthless code reviewer.', avatar: 'ST' },
];

export const MOCK_COMMITS: GitCommit[] = [
  { id: 'c1', message: 'Initial commit', author: 'Nexus', date: '2 days ago', hash: '8a92b1' },
  { id: 'c2', message: 'Add authentication middleware', author: 'Vector', date: '1 day ago', hash: '7c44d2' },
  { id: 'c3', message: 'Refactor dashboard layout', author: 'Forge', date: '4 hours ago', hash: '3e11f0' },
];

export const MOCK_EXTENSIONS: Extension[] = [
  { id: 'e1', name: 'Prettier', description: 'Code formatter', publisher: 'esbenp', downloads: '34M', installed: true, icon: 'P' },
  { id: 'e2', name: 'ESLint', description: 'Linting utility', publisher: 'Microsoft', downloads: '28M', installed: true, icon: 'E' },
  { id: 'e3', name: 'Docker', description: 'Container support', publisher: 'Microsoft', downloads: '19M', installed: false, icon: 'D' },
];

export const MOCK_SNIPPETS: Snippet[] = [
  { id: 's1', name: 'React Component', language: 'tsx', code: "import React from 'react';\n\nexport const Component = () => {\n  return <div>Hello</div>;\n};" },
  { id: 's2', name: 'API Route', language: 'ts', code: "app.get('/api', (req, res) => {\n  res.json({ message: 'Hello' });\n});" },
  { id: 's3', name: 'useEffect Hook', language: 'tsx', code: "useEffect(() => {\n  // Effect\n  return () => {\n    // Cleanup\n  };\n}, []);" }
];

export const MOCK_JOBS: FineTuningJob[] = [
  { id: 'job-123', modelName: 'Omni-Coder-v1', baseModel: 'Llama-3-8b', status: 'training', progress: 45, accuracy: 0.82, loss: 0.34, datasetSize: '250MB', startedAt: '2 hours ago' },
  { id: 'job-122', modelName: 'Support-Bot-Gen2', baseModel: 'Mistral-7b', status: 'completed', progress: 100, accuracy: 0.94, loss: 0.12, datasetSize: '1.2GB', startedAt: '1 day ago' },
  { id: 'job-121', modelName: 'Legal-Summarizer', baseModel: 'Gemma-7b', status: 'failed', progress: 12, accuracy: 0.40, loss: 1.8, datasetSize: '500MB', startedAt: '2 days ago' },
];

export const MOCK_SOCIAL_POSTS: SocialPost[] = [
  { id: 'p1', title: 'Launch Announcement Video', platform: 'youtube', status: 'ready', thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80', views: '12.5k' },
  { id: 'p2', title: 'Feature Teaser: Dark Mode', platform: 'twitter', status: 'uploaded', thumbnail: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=800&q=80', views: '3.2k' },
  { id: 'p3', title: 'Behind the Scenes: Coding', platform: 'tiktok', status: 'generating', thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80' },
  { id: 'p4', title: 'Customer Success Story', platform: 'instagram', status: 'idea' },
];

export const MOCK_VOICES: Voice[] = [
  { id: 'v1', name: 'Nexus (Narrative)', gender: 'male', style: 'narrative', isCloned: false, apiMapping: 'Kore' },
  { id: 'v2', name: 'Nova (Energetic)', gender: 'female', style: 'energetic', isCloned: false, apiMapping: 'Puck' },
  { id: 'v3', name: 'Echo (Calm)', gender: 'robot', style: 'casual', isCloned: false, apiMapping: 'Fenrir' },
];

export const MOCK_DEPLOYMENTS = [
    { id: 'd1', hash: 'v1.2.0-8a92b1', env: 'Production', date: '2 mins ago', status: 'Success' },
    { id: 'd2', hash: 'v1.1.5-7c44d2', env: 'Staging', date: '1 hour ago', status: 'Success' },
    { id: 'd3', hash: 'v1.1.4-3e11f0', env: 'Production', date: '1 day ago', status: 'Rolled Back' },
];

export const DATASET_PREVIEW = `{"messages": [{"role": "user", "content": "How do I reset my password?"}, {"role": "assistant", "content": "Go to settings > security > reset password."}]}
{"messages": [{"role": "user", "content": "Billing issue"}, {"role": "assistant", "content": "Please contact support@omni.ai for billing inquiries."}]}
{"messages": [{"role": "user", "content": "API Rate limits?"}, {"role": "assistant", "content": "Free tier is 100 req/min. Pro is 10k req/min."}]}`;
