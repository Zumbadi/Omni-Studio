
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
    description: 'Landing page, Auth, and Dashboard layout using Tailwind.', 
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
    id: 't3', 
    name: 'Social Feed App', 
    type: ProjectType.REACT_NATIVE, 
    description: 'Scrollable feed with images, likes, and comments.', 
    icon: 'Smartphone',
    prompt: 'Create a mobile social media feed app using React Native. Include a scrollable FlatList of posts with images, a like button component, and a tab bar navigation.' 
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
    prompt: 'Create a production-ready REST API boilerplate using Express. Include authentication middleware (JWT), a User model, and CRUD routes for managing resources.' 
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
    id: 't7', 
    name: 'Task Management Suite', 
    type: ProjectType.REACT_WEB, 
    description: 'Kanban board + Mobile Companion App.', 
    icon: 'Layout',
    prompt: 'Create a Task Management Suite. 1. A React Web Kanban board with drag-and-drop columns. 2. A React Native companion app for viewing tasks on the go. 3. A synced Node.js backend with realtime websocket updates.' 
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
    id: 't10',
    name: 'Crypto DeFi Dashboard',
    type: ProjectType.REACT_WEB,
    description: 'Real-time asset tracking and swap interface.',
    icon: 'TrendingUp',
    prompt: 'Create a DeFi Crypto Dashboard. Include a real-time price ticker marquee, a portfolio value line chart, and a "Swap" widget interface similar to Uniswap. Use a dark, cyberpunk neon color scheme.'
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
            { id: 'hero', name: 'hero-bg.png', type: 'file', content: 'Binary data...' }
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
          { id: 'card', name: 'Card.tsx', type: 'file', content: `import React from 'react';\n\nexport const Card = ({ title, children }) => (\n  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-sm hover:border-indigo-500/50 transition-all">\n    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>\n    <div className="text-gray-400">{children}</div>\n  </div>\n);` }
        ]
      },
      {
        id: 'pages',
        name: 'pages',
        type: 'directory',
        isOpen: true,
        children: [
            { id: 'dash', name: 'Dashboard.tsx', type: 'file', content: `import React from 'react';\nimport { Card } from '../components/Card';\n\nexport default function Dashboard() {\n  return (\n    <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6">\n      <Card title="Revenue">\n        <div className="text-3xl font-bold text-white">$12,450</div>\n        <div className="text-sm text-green-400">+15% from last month</div>\n      </Card>\n      <Card title="Active Users">\n        <div className="text-3xl font-bold text-white">1,203</div>\n        <div className="text-sm text-blue-400">Current session</div>\n      </Card>\n      <Card title="Bounce Rate">\n        <div className="text-3xl font-bold text-white">42%</div>\n        <div className="text-sm text-yellow-400">-2% improvement</div>\n      </Card>\n    </div>\n  );\n}` }
        ]
      },
      {
          id: 'hooks',
          name: 'hooks',
          type: 'directory',
          isOpen: false,
          children: [
              { id: 'useauth', name: 'useAuth.ts', type: 'file', content: `import { useState, useEffect } from 'react';\n\nexport const useAuth = () => {\n  const [user, setUser] = useState(null);\n  // Auth logic here\n  return { user };\n};` }
          ]
      },
      { id: '1', name: 'App.tsx', type: 'file', content: `import React, { useState } from 'react';
import { Header } from './components/Header';
import { Button } from './components/Button';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-white">
      <Header />
      <main className="flex-1 overflow-auto">
        <Dashboard />
        
        <div className="px-8 pb-8">
            <div className="max-w-md w-full bg-slate-900 rounded-xl p-8 border border-slate-800">
            <h2 className="text-2xl font-bold text-white mb-2">Interactive Demo</h2>
            <p className="text-slate-400 mb-8">
                Edit <code className="bg-slate-950 px-2 py-1 rounded text-sm text-indigo-300">App.tsx</code> to see live changes.
            </p>
            
            <div className="flex flex-col items-center gap-4">
                <div className="text-7xl font-bold text-white mb-4 tabular-nums tracking-tighter">{count}</div>
                
                <div className="flex gap-4 w-full">
                <button 
                    onClick={() => setCount(c => c - 1)}
                    className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-all"
                >
                    Decrease
                </button>
                <Button onClick={() => setCount(c => c + 1)}>
                    Increase
                </Button>
                </div>
            </div>
            </div>
        </div>
      </main>
    </div>
  );
}` },
      { id: '2', name: 'index.css', type: 'file', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;` },
      { id: 'utils', name: 'utils', type: 'directory', children: [
          { id: 'help', name: 'helpers.ts', type: 'file', content: `export const formatDate = (date: Date) => date.toLocaleDateString();` }
      ]}
    ]
  },
  {
    id: '4',
    name: 'package.json',
    type: 'file',
    content: `{\n  "name": "omni-web",\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0",\n    "lucide-react": "^0.292.0",\n    "tailwindcss": "^3.3.0"\n  },\n  "scripts": {\n    "start": "vite",\n    "build": "vite build"\n  }\n}`
  },
  { id: 'docker', name: 'Dockerfile', type: 'file', content: `FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD ["npm", "start"]` },
  { id: 'compose', name: 'docker-compose.yml', type: 'file', content: `version: '3'\nservices:\n  web:\n    build: .\n    ports:\n      - "3000:3000"\n    volumes:\n      - .:/app\n      - /app/node_modules\n    environment:\n      - NODE_ENV=development` },
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
          { id: 'profile', name: 'profile.tsx', type: 'file', content: `import { View, Text } from 'react-native';\nexport default function Profile() { return <View><Text>Profile</Text></View>; }` }
      ]},
      { id: 'layout', name: '_layout.tsx', type: 'file', content: `import FontAwesome from '@expo/vector-icons/FontAwesome';\nimport { Tabs } from 'expo-router';\n\nexport default function TabLayout() {\n  return (\n    <Tabs screenOptions={{ tabBarActiveTintColor: '#2f95dc' }}>\n      <Tabs.Screen name="index" options={{ title: 'Tab One', tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} /> }} />\n      <Tabs.Screen name="two" options={{ title: 'Tab Two', tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} /> }} />\n    </Tabs>\n  );\n}` },
      { id: '1', name: 'App.tsx', type: 'file', content: `import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ScrollView, SafeAreaView } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
         <Text style={styles.title}>Omni Mobile</Text>
         <Text style={styles.subtitle}>Live Preview</Text>
      </View>
      
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 20 }}>
        <View style={styles.card}>
           <Text style={styles.cardTitle}>Getting Started</Text>
           <Text style={styles.cardText}>
             This is a simulated React Native environment running in the browser.
           </Text>
           <TouchableOpacity 
             style={styles.button} 
             onPress={() => Alert.alert('Interaction', 'Button Pressed!')}
           >
             <Text style={styles.buttonText}>Tap Me</Text>
           </TouchableOpacity>
        </View>

        <View style={[styles.card, { marginTop: 20 }]}>
           <Text style={styles.cardTitle}>Components</Text>
           <View style={styles.row}>
              <View style={styles.badge}><Text style={styles.badgeText}>View</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>Text</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>Image</Text></View>
           </View>
        </View>

        <View style={[styles.card, { marginTop: 20 }]}>
           <Image source={{ uri: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80' }} style={styles.image} />
           <Text style={[styles.cardTitle, { marginTop: 10 }]}>Rich Media</Text>
           <Text style={styles.cardText}>Full image support with proper styling.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#4f46e5',
    paddingTop: 20,
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
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap'
  },
  badge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: 'bold'
  },
  image: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  }
});` },
    ]
  },
  { id: 'components', name: 'components', type: 'directory', isOpen: false, children: [
      { id: 'themed', name: 'Themed.tsx', type: 'file', content: `import { Text as DefaultText, View as DefaultView } from 'react-native';\nexport function Text(props) { return <DefaultText {...props} />; }` },
      { id: 'edit', name: 'EditScreenInfo.tsx', type: 'file', content: `import React from 'react';\nimport { View, Text } from 'react-native';\nexport default function EditScreenInfo({ path }) { return <View><Text>{path}</Text></View>; }` }
  ]},
  { id: 'consts', name: 'constants', type: 'directory', isOpen: false, children: [
      { id: 'colors', name: 'Colors.ts', type: 'file', content: `export default { light: { text: '#000', background: '#fff' }, dark: { text: '#fff', background: '#000' } };` }
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
        { id: 'assets', name: 'Assets.xcassets', type: 'directory', children: [] },
        { id: 'info', name: 'Info.plist', type: 'file', content: `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n    <key>CFBundleDisplayName</key>\n    <string>OmniApp</string>\n</dict>\n</plist>` }
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
                { id: 'res', name: 'res', type: 'directory', children: [] },
                { id: 'man', name: 'AndroidManifest.xml', type: 'file', content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application>\n        <activity android:name=".MainActivity" android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>` }
            ]}
        ]},
        { id: 'build', name: 'build.gradle.kts', type: 'file', content: `plugins {\n    alias(libs.plugins.androidApplication)\n    alias(libs.plugins.kotlinAndroid)\n}` }
    ]
  },
  { id: 'settings', name: 'settings.gradle.kts', type: 'file', content: `rootProject.name = "OmniApp"\ninclude(":app")` }
];

export const NODE_FILE_TREE: FileNode[] = [
  {
    id: 'root',
    name: 'src',
    type: 'directory',
    isOpen: true,
    children: [
      { id: 'config', name: 'config', type: 'directory', children: [
          { id: 'db', name: 'db.js', type: 'file', content: `const mongoose = require('mongoose');\nconst connectDB = async () => { try { await mongoose.connect(process.env.MONGO_URI); console.log('MongoDB Connected'); } catch (err) { console.error(err); process.exit(1); } };\nmodule.exports = connectDB;` },
          { id: 'logger', name: 'logger.js', type: 'file', content: `const winston = require('winston');\nconst logger = winston.createLogger({ transports: [new winston.transports.Console()] });\nmodule.exports = logger;` }
      ]},
      { id: 'ctrl', name: 'controllers', type: 'directory', children: [
          { id: 'userCtrl', name: 'userController.js', type: 'file', content: `const User = require('../models/User');\nexports.getUsers = async (req, res) => { try { const users = await User.find(); res.json({ success: true, data: users }); } catch (err) { res.status(500).json({ error: err.message }); } };\nmodule.exports = router;` },
          { id: 'authCtrl', name: 'authController.js', type: 'file', content: `exports.login = (req, res) => { res.json({ token: 'abc.123.xyz' }); };` }
      ]},
      { id: 'middleware', name: 'middleware', type: 'directory', children: [
          { id: 'authMW', name: 'auth.js', type: 'file', content: `module.exports = (req, res, next) => { if(req.headers.authorization) next(); else res.status(401).json({ error: 'Unauthorized' }); };` },
          { id: 'errMW', name: 'error.js', type: 'file', content: `module.exports = (err, req, res, next) => { console.error(err.stack); res.status(500).send('Something broke!'); };` }
      ]},
      { id: 'models', name: 'models', type: 'directory', children: [
          { id: 'userModel', name: 'User.js', type: 'file', content: `const mongoose = require('mongoose');\nconst UserSchema = new mongoose.Schema({ name: String, email: { type: String, unique: true }, role: { type: String, default: 'user' }, createdAt: { type: Date, default: Date.now } });\nmodule.exports = mongoose.model('User', UserSchema);` },
          { id: 'productModel', name: 'Product.js', type: 'file', content: `const mongoose = require('mongoose');\nconst ProductSchema = new mongoose.Schema({ name: String, price: Number, stock: Number });\nmodule.exports = mongoose.model('Product', ProductSchema);` }
      ]},
      { id: 'routes', name: 'routes', type: 'directory', children: [
          { id: 'userRoute', name: 'users.js', type: 'file', content: `const express = require('express');\nconst router = express.Router();\nconst { getUsers } = require('../controllers/userController');\nrouter.get('/', getUsers);\nmodule.exports = router;` },
          { id: 'authRoute', name: 'auth.js', type: 'file', content: `const express = require('express');\nconst router = express.Router();\nconst { login } = require('../controllers/authController');\nrouter.post('/login', login);\nmodule.exports = router;` }
      ]},
      { id: '1', name: 'app.js', type: 'file', content: `const express = require('express');\nconst app = express();\napp.use(express.json());\napp.get('/', (req, res) => res.send('API Running'));\nmodule.exports = app;` }
    ]
  },
  { id: 'pkg', name: 'package.json', type: 'file', content: `{\n  "name": "omni-api",\n  "version": "1.0.0",\n  "main": "src/app.js",\n  "scripts": { "start": "node src/app.js", "dev": "nodemon src/app.js" },\n  "dependencies": {\n    "express": "^4.18.2",\n    "mongoose": "^7.0.0",\n    "dotenv": "^16.0.0"\n  }\n}` },
  { id: 'docker', name: 'Dockerfile', type: 'file', content: `FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]` },
  { id: 'compose', name: 'docker-compose.yml', type: 'file', content: `version: '3'\nservices:\n  api:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      - MONGO_URI=mongodb://mongo:27017/omni\n    depends_on:\n      - mongo\n  mongo:\n    image: mongo:latest\n    ports:\n      - "27017:27017"` },
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
