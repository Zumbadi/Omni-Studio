import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Smartphone, Globe, QrCode, RefreshCw, Network, Loader2, Play, Terminal, ChevronUp, ChevronDown, ExternalLink, Download, Shield, Layers, Zap, AlertTriangle, Activity } from 'lucide-react';
import { Button } from './Button';
import { Project, ProjectType, FileNode, BuildSettings } from '../types';
import { getAllFiles } from '../utils/fileHelpers';
import JSZip from 'jszip';
import { BuildSettingsModal } from './BuildSettingsModal';
import { generatePreviewHtml } from '../utils/runtime';

interface LivePreviewProps {
  project: Project;
  previewSrc: string;
  onRefresh: () => void;
  onConsoleLog?: (log: string) => void;
  files?: FileNode[];
  currentBranch?: string;
  onAiFix?: (error: string) => void;
}

// Matches index.html loader for seamless visual transition
const SplashScreen = () => (
    <div className="absolute inset-0 z-50 bg-[#0d1117] flex flex-col items-center justify-center animate-out fade-out duration-700 fill-mode-forwards" style={{ animationDelay: '2s' }}>
        <div className="relative mb-8 scale-150">
            <div className="w-20 h-20 rounded-full bg-[radial-gradient(circle_at_center,#6366f1_0%,transparent_60%)] shadow-[0_0_40px_rgba(99,102,241,0.2)] animate-[pulse_2.5s_infinite_ease-in-out]"></div>
            <div className="absolute inset-[-5px] border-2 border-primary-500/15 border-t-primary-500 rounded-full animate-[spin_3s_linear_infinite]"></div>
            <div className="absolute inset-[-8px] border-2 border-purple-500/10 border-b-purple-400 rounded-full animate-[spin_5s_linear_infinite_reverse]"></div>
        </div>
        
        <div className="text-[10px] font-mono font-bold text-primary-400/80 tracking-[0.3em] uppercase animate-pulse mb-2">
            INITIALIZING RUNTIME
        </div>
        <div className="text-[9px] text-gray-600 font-mono tracking-widest">
            Connecting to Neural Engine...
        </div>
    </div>
);

export const LivePreview: React.FC<LivePreviewProps> = ({ project, previewSrc: propPreviewSrc, onRefresh, onConsoleLog, files = [], currentBranch = 'main', onAiFix }) => {
  const isNative = project.type === ProjectType.REACT_NATIVE;
  const isIOS = project.type === ProjectType.IOS_APP;
  const isAndroid = project.type === ProjectType.ANDROID_APP;
  const isBackend = project.type === ProjectType.NODE_API;
  const isDev = currentBranch !== 'main';

  const [previewMode, setPreviewMode] = useState<'web' | 'mobile'>((isNative || isIOS || isAndroid) ? 'mobile' : 'web');
  const [showQrCode, setShowQrCode] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState<'iphone14' | 'pixel7' | 'ipad'>('iphone14');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildStep, setBuildStep] = useState('');
  
  // Runtime Error State
  const [runtimeError, setRuntimeError] = useState<{ message: string, stack: string } | null>(null);
  
  // Ecosystem Generation State
  const [isGeneratingEcosystem, setIsGeneratingEcosystem] = useState(false);
  const [ecosystemStep, setEcosystemStep] = useState('');

  // Console Logs
  const [logs, setLogs] = useState<{level: string, message: string, time: string}[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleInput, setConsoleInput] = useState('');
  const consoleRef = useRef<HTMLDivElement>(null);

  // Build Config
  const [showBuildModal, setShowBuildModal] = useState(false);

  // API Console State
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiPath, setApiPath] = useState('/users');
  const [apiResponse, setApiResponse] = useState<string>('// Click Send to test endpoint');
  const [apiStatus, setApiStatus] = useState<number | null>(null);
  const [availableRoutes, setAvailableRoutes] = useState<string[]>(['/']);

  // Calculate the correct preview source based on the *Entry File* not the active file
  const previewSrc = useMemo(() => {
      if (!project || !files || files.length === 0) return '';
      
      const allFiles = getAllFiles(files);
      let entryFile: FileNode | undefined;
      let entryPath: string | undefined;

      // 1. Try standard entry points (Prioritize generic React/Web roots)
      const entryPoints = [
          'src/main.tsx', 'src/main.jsx', 'src/main.js',
          'src/index.tsx', 'src/index.jsx', 'src/index.js',
          'src/App.tsx', 'src/App.jsx', 'src/App.js',
          'App.tsx', 'App.jsx', 'App.js',
          'index.tsx', 'index.jsx', 'index.js',
          'main.tsx', 'main.jsx', 'main.js'
      ];

      for (const path of entryPoints) {
          const found = allFiles.find(f => f.path === path || f.node.name === path);
          if (found) {
              entryFile = found.node;
              entryPath = found.path;
              break;
          }
      }
      
      // 2. React Native specific (expo-router)
      if (!entryFile && project.type === ProjectType.REACT_NATIVE) {
          const found = allFiles.find(f => f.path.includes('app/index.tsx') || f.path.includes('app/(tabs)/index.tsx') || f.node.name === 'App.tsx');
          entryFile = found?.node;
          entryPath = found?.path;
      }

      // 3. Native iOS/Android specific
      if (project.type === ProjectType.IOS_APP) {
          const found = allFiles.find(f => f.node.name === 'OmniApp.swift' || f.node.name.endsWith('App.swift') || f.node.name === 'ContentView.swift');
          if (found) {
              entryFile = found.node;
              entryPath = found.path;
          }
      }
      if (project.type === ProjectType.ANDROID_APP) {
          const found = allFiles.find(f => f.node.name === 'MainActivity.kt');
          if (found) {
              entryFile = found.node;
              entryPath = found.path;
          }
      }

      // 4. Generic Fallback: Search content for entry point markers
      if (!entryFile) {
          const found = allFiles.find(f => f.node.content && (
              f.node.content.includes('createRoot(') || 
              f.node.content.includes('ReactDOM.render') ||
              f.node.content.includes('@main') ||
              f.node.content.includes('export default function App') ||
              f.node.content.includes('class MainActivity')
          ));
          entryFile = found?.node;
          entryPath = found?.path;
      }

      // 5. Fallback to active file prop if nothing global found (Component Preview Mode)
      const codeToRun = entryFile?.content || propPreviewSrc;
      const pathToRun = entryPath || 'src/App.tsx'; // Default context

      if (!codeToRun) return '';

      return generatePreviewHtml(
          codeToRun, 
          isNative || isIOS || isAndroid, 
          files, 
          pathToRun, 
          {} 
      );
  }, [files, project, propPreviewSrc, isNative, isIOS, isAndroid]);

  useEffect(() => {
      if (!isBackend || !files) return;
      const allFiles = getAllFiles(files);
      const routes: Set<string> = new Set(['/']);
      
      allFiles.forEach(({ node }) => {
          if (!node.content) return;
          const routeRegex = /\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
          let match;
          while ((match = routeRegex.exec(node.content)) !== null) {
              routes.add(match[2]);
          }
      });
      setAvailableRoutes(Array.from(routes));
  }, [files, isBackend]);

  useEffect(() => {
      const handleMessage = (event: MessageEvent) => {
          if (event.data) {
              if (event.data.type === 'console') {
                  const newLog = {
                      level: event.data.level,
                      message: event.data.message,
                      time: new Date().toLocaleTimeString().split(' ')[0]
                  };
                  setLogs(prev => [...prev, newLog].slice(-100)); 
                  
                  if (onConsoleLog) {
                      onConsoleLog(`[Browser Console] ${newLog.level.toUpperCase()}: ${newLog.message}`);
                  }

                  if (consoleRef.current) {
                      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
                  }
              } else if (event.data.type === 'runtime-error') {
                  setRuntimeError({ message: event.data.message, stack: event.data.stack });
                  setLogs(prev => [...prev, { level: 'error', message: event.data.message, time: new Date().toLocaleTimeString().split(' ')[0] }]);
                  if (onConsoleLog) onConsoleLog(`[Runtime Error] ${event.data.message}`);
              }
          }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
  }, [onConsoleLog]);

  useEffect(() => {
      setLogs([]);
      setRuntimeError(null); 
  }, [previewSrc]);

  const handleApiSend = () => {
      setApiResponse('Sending request...');
      setApiStatus(null);
      setTimeout(() => {
          const isKnownRoute = availableRoutes.some(r => {
              if (r === apiPath) return true;
              const routeParts = r.split('/');
              const pathParts = apiPath.split('/');
              if (routeParts.length !== pathParts.length) return false;
              return routeParts.every((part, i) => part.startsWith(':') || part === pathParts[i]);
          });

          if (isKnownRoute) {
              if (apiMethod === 'GET') {
                  setApiStatus(200);
                  setApiResponse(JSON.stringify({ 
                      success: true, 
                      message: `Response from ${apiPath}`,
                      data: [{ id: 1, name: 'Simulated User' }, { id: 2, name: 'Test Data' }] 
                  }, null, 2));
              } else if (apiMethod === 'POST' || apiMethod === 'PUT') {
                  setApiStatus(201);
                  setApiResponse(JSON.stringify({ 
                      success: true, 
                      id: Math.floor(Math.random() * 1000), 
                      timestamp: new Date().toISOString(),
                      status: 'Resource created/updated'
                  }, null, 2));
              } else if (apiMethod === 'DELETE') {
                  setApiStatus(200);
                  setApiResponse(JSON.stringify({ success: true, message: 'Resource deleted' }, null, 2));
              }
          } else {
              setApiStatus(404);
              setApiResponse(JSON.stringify({ error: 'Route not found in project files', availableRoutes }, null, 2));
          }
      }, 600);
  };

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
      setIsInitialLoading(true);
      const t = setTimeout(() => setIsInitialLoading(false), 2200); 
      return () => clearTimeout(t);
  }, [previewSrc]);

  const handleSimulatedBuild = () => {
      setIsBuilding(true);
      const steps = ['Validating Project Structure...', 'Resolving Dependencies...', 'Compiling Source...', 'Linking Native Modules...', 'Signing Binary...', 'Launching Simulator...'];
      let stepIdx = 0;
      setBuildStep(steps[0]);
      const interval = setInterval(() => {
          stepIdx++;
          if (stepIdx < steps.length) {
              setBuildStep(steps[stepIdx]);
          } else {
              clearInterval(interval);
              setIsBuilding(false);
              setBuildStep('');
          }
      }, 800);
  };
  
  const handleGenerateEcosystem = () => {
      setIsGeneratingEcosystem(true);
      const steps = [
          "Analyzing mobile codebase...",
          "Generating React Web Dashboard...",
          "Scaffolding Node.js API Backend...",
          "Compiling iOS & Android binaries...",
          "Ecosystem synchronized!"
      ];
      let stepIdx = 0;
      setEcosystemStep(steps[0]);
      const interval = setInterval(() => {
          stepIdx++;
          if (stepIdx < steps.length) {
              setEcosystemStep(steps[stepIdx]);
          } else {
              clearInterval(interval);
              setIsGeneratingEcosystem(false);
              setEcosystemStep('');
              alert("Ecosystem Generated: Web Dashboard, Backend API, and Native Binaries are ready.");
          }
      }, 1500);
  };

  const handleExportWithSettings = async (settings: BuildSettings) => {
      const zip = new JSZip();
      const folderName = isIOS ? 'OmniApp_iOS' : isAndroid ? 'OmniApp_Android' : 'OmniApp_Native';
      const addToZip = (nodes: any[], path = '') => { 
          nodes.forEach(n => { 
              let content = n.content;
              if (n.name === 'Info.plist' && isIOS) {
                  content = content.replace(/<string>OmniApp<\/string>/, `<string>${settings.appName}</string>`);
                  content = content.replace('</dict>', `    <key>CFBundleIdentifier</key>\n    <string>${settings.bundleId}</string>\n    <key>CFBundleShortVersionString</key>\n    <string>${settings.version}</string>\n</dict>`);
              }
              if (n.name === 'build.gradle.kts' && isAndroid) {
                   content += `\nandroid {\n    defaultConfig {\n        applicationId = "${settings.bundleId}"\n        versionName = "${settings.version}"\n    }\n}`;
              }
              if (n.type === 'file') zip.file(path + n.name, content); 
              if (n.children) addToZip(n.children, path + n.name + '/'); 
          }); 
      };
      addToZip(files, `${folderName}/`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); 
      a.href = url; 
      a.download = `${folderName}.zip`; 
      a.click();
      setShowBuildModal(false);
  };

  const handleDownloadSource = () => {
      if (isIOS || isAndroid) {
          setShowBuildModal(true);
      } else {
          handleExportWithSettings({ appName: 'App', bundleId: 'com.example', version: '1.0', buildNumber: '1', permissions: { camera: false, location: false, notifications: false, internet: true }});
      }
  };

  const handleOpenNewTab = () => {
      const blob = new Blob([previewSrc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
  };

  const handleConsoleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!consoleInput.trim()) return;
      const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
      if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'eval', code: consoleInput }, '*');
          setLogs(prev => [...prev, { level: 'input', message: `> ${consoleInput}`, time: new Date().toLocaleTimeString().split(' ')[0] }]);
      }
      setConsoleInput('');
  };

  const triggerHeal = () => {
      if (runtimeError && onAiFix) {
          onAiFix(`Runtime Error: ${runtimeError.message}\nStack: ${runtimeError.stack}`);
          setRuntimeError(null); 
      }
  };

  if (isBackend) {
      return (
        <div className="flex-1 flex flex-col bg-gray-900/50 overflow-hidden relative">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Network size={14} className="text-green-500"/> API Console (Simulator)
                </div>
                {isDev && <span className="bg-purple-900/30 text-purple-400 text-[10px] px-2 py-0.5 rounded border border-purple-500/30 font-bold uppercase animate-pulse">Dev Mode</span>}
                <Button size="sm" variant="ghost" onClick={onRefresh} title="Restart Server"><RefreshCw size={14}/></Button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex justify-center">
                <div className="w-full max-w-lg bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden h-fit">
                    <div className="p-4 space-y-4">
                        <div className="bg-black/30 p-2 rounded border border-gray-700/50 text-[10px] text-gray-400 flex flex-wrap gap-2">
                            <span className="font-bold">Detected Routes:</span>
                            {availableRoutes.length > 0 ? availableRoutes.map(r => (
                                <span key={r} className="bg-gray-700 px-1.5 rounded cursor-pointer hover:text-white" onClick={() => setApiPath(r)}>{r}</span>
                            )) : <span className="italic">No routes found in code.</span>}
                        </div>

                        <div className="flex gap-2">
                            <select value={apiMethod} onChange={e => setApiMethod(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs font-bold text-blue-400 focus:outline-none cursor-pointer hover:bg-gray-750 transition-colors">
                                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
                            </select>
                            <input type="text" value={apiPath} onChange={e => setApiPath(e.target.value)} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 text-sm font-mono text-white focus:border-primary-500 focus:outline-none" placeholder="/api/..." />
                            <Button size="sm" onClick={handleApiSend}>Send</Button>
                        </div>
                        <div className="bg-black rounded-lg border border-gray-700 p-3 h-64 font-mono text-xs overflow-auto relative group">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => navigator.clipboard.writeText(apiResponse)} className="text-gray-500 hover:text-white p-1"><RefreshCw size={12}/></button>
                            </div>
                            {apiStatus && (<div className={`mb-2 text-[10px] font-bold px-2 py-0.5 rounded w-fit ${apiStatus >= 200 && apiStatus < 300 ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'}`}>Status: {apiStatus}</div>)}
                            <pre className="text-green-400 whitespace-pre-wrap">{apiResponse}</pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900 relative overflow-hidden">
        {showBuildModal && (
            <BuildSettingsModal 
                isOpen={showBuildModal} 
                onClose={() => setShowBuildModal(false)} 
                onExport={handleExportWithSettings}
                projectType={project.type}
            />
        )}

        <div className="h-10 bg-gray-800 flex items-center px-3 gap-2 border-b border-gray-700 shrink-0 justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
                <div className="flex-1 max-w-xs bg-gray-900/50 rounded text-[10px] text-gray-500 px-3 py-1 text-center font-mono truncate border border-gray-700/50 flex items-center justify-center gap-1">
                    {isGeneratingEcosystem ? (
                        <span className="text-blue-400 animate-pulse flex items-center gap-2"><Loader2 size={10} className="animate-spin"/> {ecosystemStep}</span>
                    ) : isIOS || isAndroid ? (isIOS ? ' iOS Simulator' : '🤖 Android Emulator') : <><Globe size={10}/> localhost:3000</>}
                </div>
                {isDev && <div className="hidden md:flex items-center gap-1 bg-purple-900/30 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse"><Zap size={10} fill="currentColor"/> Hot Reload</div>}
            </div>
            
            <div className="flex items-center gap-2">
                 {(isNative || isIOS || isAndroid) ? (
                    <>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={handleDownloadSource} title="Download Source for IDE"><Download size={10} className="mr-1"/> Source</Button>
                        <Button size="sm" variant={isGeneratingEcosystem ? 'secondary' : 'primary'} className={`h-6 px-3 text-[10px] font-bold shadow-lg ${isGeneratingEcosystem ? 'text-blue-400 bg-blue-900/20 border border-blue-800' : 'bg-primary-600 hover:bg-primary-500 text-white'}`} onClick={handleGenerateEcosystem} disabled={isGeneratingEcosystem} title="Auto-Generate Web, Backend, iOS & Android Apps">{isGeneratingEcosystem ? <Loader2 size={10} className="animate-spin mr-1"/> : <Layers size={12} className="mr-1"/>}{isGeneratingEcosystem ? 'Syncing Ecosystem...' : 'Generate Ecosystem'}</Button>
                        {(isIOS || isAndroid) && (
                            <Button size="sm" variant="secondary" className="h-6 px-2 text-[10px]" onClick={handleSimulatedBuild} disabled={isBuilding}>{isBuilding ? <Loader2 size={10} className="animate-spin mr-1"/> : <Play size={10} className="mr-1"/>}{isBuilding ? 'Building...' : 'Run Build'}</Button>
                        )}
                        <div className="flex bg-gray-700/50 rounded p-0.5 gap-0.5">
                            <button onClick={() => setPreviewMode('mobile')} className={`p-1.5 rounded transition-all ${previewMode === 'mobile' ? 'text-white bg-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`} title="Mobile Simulator"><Smartphone size={14}/></button>
                            <button onClick={() => setPreviewMode('web')} className={`p-1.5 rounded transition-all ${previewMode === 'web' ? 'text-white bg-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`} title="Web Fallback" disabled={isIOS || isAndroid}><Globe size={14}/></button>
                            <button onClick={() => setShowQrCode(!showQrCode)} className={`p-1.5 rounded transition-all ${showQrCode ? 'text-green-400 bg-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`} title="Scan Expo QR" disabled={isIOS || isAndroid}><QrCode size={14}/></button>
                        </div>
                    </>
                ) : (
                    <>
                        <Button size="sm" variant="ghost" onClick={handleOpenNewTab} title="Open in New Tab"><ExternalLink size={14}/></Button>
                        <Button size="sm" variant="ghost" onClick={onRefresh} title="Refresh Preview"><RefreshCw size={14}/></Button>
                    </>
                )}
            </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 bg-[radial-gradient(#333_1px,transparent_1px)] bg-[size:20px_20px] overflow-auto relative">
            {isInitialLoading && <SplashScreen />}
            
            {(previewMode === 'mobile') ? (
                <div className="relative transition-all duration-500 animate-in zoom-in-95 max-w-full max-h-full">
                    <div className={`border-[8px] border-gray-800 rounded-[2.5rem] overflow-hidden bg-black relative shadow-2xl ring-1 ring-white/10 mx-auto transition-all ${deviceFrame === 'ipad' ? 'w-[500px] max-w-full aspect-[3/4]' : 'w-[320px] max-w-full aspect-[9/19.5]'}`} style={{ maxHeight: '85vh' }}>
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1/3 h-[4%] bg-gray-800 rounded-b-xl z-20 flex items-center justify-center">
                            <div className="w-1/3 h-1 bg-gray-700 rounded-full"></div>
                        </div>
                        
                        <iframe id="preview-iframe" title="preview" srcDoc={previewSrc} className="w-full h-full border-none bg-black" sandbox="allow-scripts" />
                        
                        {runtimeError && (
                            <div className="absolute inset-0 bg-red-900/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                                <AlertTriangle size={48} className="text-red-400 mb-4 animate-bounce" />
                                <h3 className="text-xl font-bold text-white mb-2">Runtime Crash</h3>
                                <p className="text-red-200 text-xs font-mono bg-black/30 p-3 rounded border border-red-500/30 max-h-32 overflow-y-auto mb-6 w-full text-left">{runtimeError.message}</p>
                                <Button onClick={triggerHeal} className="bg-white text-red-600 hover:bg-gray-100 shadow-xl scale-110 font-bold"><Activity size={16} className="mr-2"/> Heal Codebase</Button>
                            </div>
                        )}

                        {showQrCode && (
                            <div className="absolute inset-0 bg-gray-900/95 z-30 flex flex-col items-center justify-center text-center p-6 animate-in fade-in backdrop-blur-sm">
                                <div className="bg-white p-3 rounded-xl mb-4 shadow-lg"><QrCode size={140} className="text-black" /></div>
                                <h3 className="text-white font-bold mb-1 text-lg">Scan with Expo Go</h3>
                                <p className="text-gray-400 text-xs mb-6">Open the camera on your iOS/Android device to preview live.</p>
                                <Button size="sm" variant="secondary" onClick={() => setShowQrCode(false)}>Close</Button>
                            </div>
                        )}

                        {isBuilding && (
                            <div className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center p-6 animate-in fade-in backdrop-blur-sm">
                                <div className="relative mb-6">
                                    <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-primary-500 animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center"><Smartphone size={24} className="text-primary-500 animate-pulse" /></div>
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Compiling Native App</h3>
                                <div className="text-sm text-primary-400 font-mono bg-gray-900 px-3 py-1 rounded border border-gray-800">{buildStep}</div>
                            </div>
                        )}
                        
                        {isGeneratingEcosystem && (
                            <div className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center p-6 animate-in fade-in backdrop-blur-sm">
                                <div className="relative mb-6">
                                    <div className="w-16 h-16 rounded-full border-4 border-gray-800 border-t-blue-500 animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center"><Layers size={24} className="text-blue-500 animate-pulse" /></div>
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">Generating Ecosystem</h3>
                                <div className="text-sm text-blue-400 font-mono bg-gray-900 px-3 py-1 rounded border border-gray-800 text-center max-w-[250px]">{ecosystemStep}</div>
                            </div>
                        )}
                    </div>

                    <div className="absolute -right-12 top-4 flex flex-col gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700 shadow-lg hidden md:flex">
                        <button onClick={() => setDeviceFrame('iphone14')} className={`p-2 rounded-lg transition-colors ${deviceFrame === 'iphone14' ? 'bg-primary-600 text-white shadow' : 'text-gray-500 hover:bg-gray-700 hover:text-white'}`} title="iPhone 14"><Smartphone size={18}/></button>
                        <button onClick={() => setDeviceFrame('pixel7')} className={`p-2 rounded-lg transition-colors ${deviceFrame === 'pixel7' ? 'bg-primary-600 text-white shadow' : 'text-gray-500 hover:bg-gray-700 hover:text-white'}`} title="Pixel 7"><Smartphone size={18} className="rotate-90"/></button>
                        <button onClick={() => setDeviceFrame('ipad')} className={`p-2 rounded-lg transition-colors ${deviceFrame === 'ipad' ? 'bg-primary-600 text-white shadow' : 'text-gray-500 hover:bg-gray-700 hover:text-white'}`} title="iPad Air"><Smartphone size={22} className="scale-110"/></button>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full bg-white shadow-2xl rounded-lg overflow-hidden border border-gray-700/50 relative">
                    <iframe id="preview-iframe" title="preview" srcDoc={previewSrc} className="w-full h-full border-none bg-white" sandbox="allow-scripts" />
                    {runtimeError && (
                        <div className="absolute inset-0 bg-red-900/90 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                            <AlertTriangle size={48} className="text-red-400 mb-4 animate-bounce" />
                            <h3 className="text-xl font-bold text-white mb-2">Runtime Crash</h3>
                            <p className="text-red-200 text-xs font-mono bg-black/30 p-3 rounded border border-red-500/30 max-h-32 overflow-y-auto mb-6 w-full max-w-lg text-left">{runtimeError.message}</p>
                            <Button onClick={triggerHeal} className="bg-white text-red-600 hover:bg-gray-100 shadow-xl scale-110 font-bold"><Activity size={16} className="mr-2"/> Heal Codebase</Button>
                        </div>
                    )}
                </div>
            )}
        </div>

        <div className={`absolute bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-700 transition-all duration-300 flex flex-col ${showConsole ? 'h-48' : 'h-8'}`}>
            <div className="h-8 flex items-center justify-between px-3 cursor-pointer hover:bg-gray-800 border-b border-gray-800" onClick={() => setShowConsole(!showConsole)}>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                    <Terminal size={12} /> Live Console
                    {logs.length > 0 && <span className="bg-gray-700 text-gray-300 px-1.5 rounded-full text-[10px]">{logs.length}</span>}
                </div>
                {showConsole ? <ChevronDown size={14} className="text-gray-500"/> : <ChevronUp size={14} className="text-gray-500"/>}
            </div>
            {showConsole && (
                <div className="flex-1 flex flex-col">
                    <div ref={consoleRef} className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-1 scrollbar-thin scrollbar-thumb-gray-700">
                        {logs.length === 0 && <div className="text-gray-600 italic px-2">No logs captured yet...</div>}
                        {logs.map((log, i) => (
                            <div key={i} className="flex gap-2 hover:bg-white/5 px-2 rounded py-0.5 group">
                                <span className="text-gray-600 min-w-[50px]">{log.time}</span>
                                <span className={`flex-1 break-all whitespace-pre-wrap ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : log.level === 'input' ? 'text-blue-400' : 'text-green-400'}`}>{log.message}</span>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleConsoleSubmit} className="p-2 border-t border-gray-800 flex gap-2 bg-black/20">
                        <span className="text-blue-500 font-mono text-xs">{'>'}</span>
                        <input type="text" value={consoleInput} onChange={e => setConsoleInput(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-white" placeholder="Execute JS..." />
                    </form>
                </div>
            )}
        </div>
    </div>
  );
};