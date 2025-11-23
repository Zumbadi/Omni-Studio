
import { Project, ProjectType, FileNode, FineTuningJob, Voice, SocialPost, Extension, GitCommit, AIAgent, Snippet, ActivityItem } from './types';

export const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'E-Commerce Dashboard',
    description: 'Admin panel for Shopify integration',
    type: ProjectType.REACT_WEB,
    lastModified: '2 mins ago',
    fileCount: 24
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
    fileCount: 18
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
  { 
    id: 't6', 
    name: 'iOS Crypto Wallet', 
    type: ProjectType.IOS_APP, 
    description: 'SwiftUI wallet interface with charts.', 
    icon: 'Smartphone',
    prompt: 'Create an iOS Crypto Wallet app using Swift and SwiftUI. Include a dashboard view with a line chart for portfolio value, a list of assets, and a send/receive modal.' 
  },
  { 
    id: 't7', 
    name: 'Android News Reader', 
    type: ProjectType.ANDROID_APP, 
    description: 'Kotlin/Jetpack Compose news feed.', 
    icon: 'Smartphone',
    prompt: 'Create an Android News Reader app using Kotlin and Jetpack Compose. Include a lazy column for news articles, an app bar with search, and a detail view for reading stories.' 
  },
];

// --- EXPANDED DEMO CONTENT ---

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
          { id: 'userCtrl', name: 'userController.js', type: 'file', content: `const User = require('../models/User');\nexports.getUsers = async (req, res) => { try { const users = await User.find(); res.json({ success: true, data: users }); } catch (err) { res.status(500).json({ error: err.message }); } };` },
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
      { id: '1', name: 'app.js', type: 'file', content: `const express = require('express');
const app = express();
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const errorHandler = require('./middleware/error');

app.use(express.json());

// Mock Database Data for Demo
const users = [
  { id: 1, name: 'Alice', role: 'admin', email: 'alice@omni.ai' },
  { id: 2, name: 'Bob', role: 'user', email: 'bob@omni.ai' },
  { id: 3, name: 'Charlie', role: 'user', email: 'charlie@omni.ai' }
];

app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Omni API v1',
    status: 'healthy',
    uptime: process.uptime()
  });
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

app.use('/api/auth', authRoutes);
app.use(errorHandler);

module.exports = app;` },
      { id: 'srv', name: 'server.js', type: 'file', content: `const app = require('./app');\nconst port = process.env.PORT || 3000;\napp.listen(port, () => { console.log(\`Server running on port \${port}\`); });` }
    ]
  },
  { id: 'env', name: '.env.example', type: 'file', content: `PORT=3000\nMONGO_URI=mongodb://localhost:27017/omni\nJWT_SECRET=secret` },
  {
    id: '3',
    name: 'package.json',
    type: 'file',
    content: `{\n  "name": "omni-api",\n  "version": "1.0.0",\n  "main": "src/server.js",\n  "scripts": {\n    "start": "node src/server.js",\n    "dev": "nodemon src/server.js"\n  },\n  "dependencies": {\n    "express": "^4.18.2",\n    "mongoose": "^7.0.0",\n    "dotenv": "^16.0.3",\n    "cors": "^2.8.5",\n    "winston": "^3.8.2"\n  }\n}`
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
  '/fix - Fix bugs in current file',
  '/image - Generate image asset',
  '/tts - Generate speech asset'
];

export const MOCK_EXTENSIONS: Extension[] = [
  { id: 'ext1', name: 'Prettier - Code Formatter', description: 'Code formatter using prettier', publisher: 'Prettier', downloads: '38M', installed: true, icon: 'P' },
  { id: 'ext2', name: 'ES7+ React/Redux Snippets', description: 'Extensions for React, Redux and Graphql', publisher: 'dsznajder', downloads: '12M', installed: true, icon: 'R' },
  { id: 'ext3', name: 'Tailwind CSS IntelliSense', description: 'Intelligent Tailwind CSS tooling', publisher: 'Brad Cornes', downloads: '8M', installed: false, icon: 'T' },
  { id: 'ext4', name: 'Vim', description: 'Vim emulation for Visual Studio Code', publisher: 'vscodevim', downloads: '5M', installed: false, icon: 'V' },
  { id: 'ext5', name: 'GitLens', description: 'Supercharge Git within VS Code', publisher: 'GitKraken', downloads: '28M', installed: true, icon: 'G' },
];

export const DEFAULT_AGENTS: AIAgent[] = [
  { id: 'a1', name: 'Omni Manager', role: 'Project Manager', description: 'Orchestrates other agents and breaks down tasks.', model: 'gemini-3-pro-preview', systemPrompt: 'You are the project manager. Delegate tasks to other agents.', isManager: true, avatar: 'M' },
  { id: 'a2', name: 'Frontend Architect', role: 'Frontend Dev', description: 'Specializes in React, Tailwind, and CSS animations.', model: 'gemini-2.5-flash', systemPrompt: 'You are an expert React developer.', avatar: 'F' },
  { id: 'a3', name: 'Backend Lead', role: 'Backend Dev', description: 'Expert in Node.js, Databases, and API design.', model: 'gemini-3-pro-preview', systemPrompt: 'You are a backend specialist.', avatar: 'B' },
  { id: 'a4', name: 'Omni Critic', role: 'QA & Security', description: 'Reviews code for bugs, security flaws, and performance issues.', model: 'gemini-3-pro-preview', systemPrompt: 'You are a strict code reviewer.', avatar: 'Q' },
];

export const MOCK_SNIPPETS: Snippet[] = [
    { id: 's1', name: 'React Button', language: 'tsx', code: "export const Button = ({ children }) => (\n  <button className=\"bg-blue-500 text-white px-4 py-2 rounded\">\n    {children}\n  </button>\n);" },
    { id: 's2', name: 'Fetch Hook', language: 'ts', code: "export const useFetch = (url) => {\n  const [data, setData] = useState(null);\n  useEffect(() => { fetch(url).then(res => res.json()).then(setData); }, [url]);\n  return data;\n};" }
];

export const MOCK_ACTIVITY: ActivityItem[] = [
    { id: 'a1', type: 'commit', title: 'Commit: Fix auth bug', desc: 'You committed 3 files', time: '2 min ago', projectId: '1' },
    { id: 'a2', type: 'task', title: 'Agent: Refactor components', desc: 'Frontend Architect optimized 5 files', time: '15 min ago', projectId: '1' },
    { id: 'a3', type: 'deploy', title: 'Deployment Success', desc: 'Deployed to Production (v1.2.0)', time: '1 hour ago', projectId: '1' },
    { id: 'a4', type: 'post', title: 'Video Published', desc: 'Top 5 React Native Tips live on YouTube', time: '3 hours ago', projectId: '2' },
    { id: 'a5', type: 'alert', title: 'Security Alert', desc: 'High severity vulnerability detected in package.json', time: '5 hours ago', projectId: '3' }
];
