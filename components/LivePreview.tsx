import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Smartphone, Globe, QrCode, RefreshCw, Network, Loader2, Play, Terminal, ChevronUp, ChevronDown, ExternalLink, Download, Shield, Layers, Zap, AlertTriangle, Activity, X } from 'lucide-react';
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
  envVars?: Record<string, string>;
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

export const LivePreview: React.FC<LivePreviewProps> = ({ project, previewSrc: propPreviewSrc, onRefresh, onConsoleLog, files = [], currentBranch = 'main', onAiFix, envVars = {} }) => {
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
          'main.tsx', 'main.jsx', 'main.js',
          // Expo Router
          'app/index.tsx', 'app/index.jsx', 'app/index.js',
          'app/_layout.tsx', 'app/_layout.jsx',
          'app/(tabs)/index.tsx'
      ];

      for (const path of entryPoints) {
          const found = allFiles.find(f => f.path === path || f.node.name === path);
          if (found) {
              entryFile = found.node;
              entryPath = found.path;
              break;
          }
      }
      
      // 2. Native iOS/Android specific
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

      // 3. Scan content for entry point markers if no file matched by name
      if (!entryFile) {
          const found = allFiles.find(f => f.node.content && (
              f.node.content.includes('createRoot(') || 
              f.node.content.includes('ReactDOM.render') ||
              f.node.content.includes('@main') ||
              f.node.content.includes('export default function App') ||
              f.node.content.includes('export default class App') ||
              f.node.content.includes('registerRootComponent') ||
              f.node.content.includes('class MainActivity')
          ));
          if (found) {
              entryFile = found.node;
              entryPath = found.path;
          }
      }

      // 4. Fallback to active file prop if nothing global found (Component Preview Mode)
      const codeToRun = entryFile?.content || propPreviewSrc;
      const pathToRun = entryPath || 'src/App.tsx'; // Default context

      if (!codeToRun) return '';

      return generatePreviewHtml(
          codeToRun, 
          isNative || isIOS || isAndroid, 
          files, 
          pathToRun, 
          envVars
      );
  }, [files, project, propPreviewSrc, isNative, isIOS, isAndroid, envVars]);

  useEffect(() => {
      if (Object.keys(envVars).length > 0) {
          setLogs(prev => [...prev, { level: 'info', message: `[System] Loaded ${Object.keys(envVars).length} Environment Variables`, time: new Date().toLocaleTimeString().split(' ')[0] }]);
      }
  }, [envVars]);

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
    <div className="flex-1 flex flex-col bg-gray-950 overflow-hidden relative group/preview">
        {showBuildModal && <BuildSettingsModal isOpen={showBuildModal} onClose={() => setShowBuildModal(false)} onExport={handleExportWithSettings} projectType={project.type} />}
        
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setPreviewMode('web')}
                    className={`p-1.5 rounded-md transition-colors ${previewMode === 'web' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Web View"
                >
                    <Globe size={16} />
                </button>
                <button 
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-1.5 rounded-md transition-colors ${previewMode === 'mobile' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Mobile View"
                >
                    <Smartphone size={16} />
                </button>
                
                <div className="h-4 w-px bg-gray-800 mx-2"></div>
                
                <button onClick={onRefresh} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors" title="Reload">
                    <RefreshCw size={14} />
                </button>
                
                <button onClick={() => setShowQrCode(!showQrCode)} className={`p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors ${showQrCode ? 'bg-gray-800 text-white' : ''}`} title="QR Code">
                    <QrCode size={14} />
                </button>

                <div className="h-4 w-px bg-gray-800 mx-2"></div>
                
                <button onClick={handleDownloadSource} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors" title="Download Source">
                    <Download size={14} />
                </button>
                
                <button onClick={handleOpenNewTab} className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-md transition-colors" title="Open in New Tab">
                    <ExternalLink size={14} />
                </button>
                
                {(isNative || isIOS || isAndroid) && (
                    <button onClick={handleGenerateEcosystem} className="text-[10px] bg-primary-900/30 text-primary-300 px-2 py-1 rounded border border-primary-500/30 hover:bg-primary-900/50 transition-colors ml-2 font-bold uppercase tracking-wider flex items-center gap-1">
                       <Layers size={10}/> Sync Ecosystem
                    </button>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Live
                </span>
            </div>
        </div>

        {/* Console Overlay Toggle */}
        <button 
            onClick={() => setShowConsole(!showConsole)}
            className={`absolute bottom-4 right-4 z-50 bg-gray-900 border border-gray-700 text-gray-400 p-2 rounded-lg shadow-lg hover:text-white hover:border-gray-500 transition-all ${showConsole ? 'bg-gray-800 text-white' : ''}`}
        >
            <Terminal size={16} />
        </button>

        {/* Runtime Error Overlay */}
        {runtimeError && (
            <div className="absolute inset-x-4 top-14 z-40 bg-red-900/90 border border-red-700 rounded-lg p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2 text-red-200 font-bold mb-1">
                        <AlertTriangle size={18}/> Runtime Error Detected
                    </div>
                    <button onClick={() => setRuntimeError(null)} className="text-red-300 hover:text-white"><X size={16}/></button>
                </div>
                <div className="font-mono text-xs text-white bg-black/30 p-2 rounded border border-red-800/50 mb-3 overflow-x-auto">
                    {runtimeError.message}
                </div>
                {onAiFix && (
                    <Button size="sm" variant="secondary" className="w-full bg-red-950/50 hover:bg-red-900 text-red-200 border-red-800" onClick={triggerHeal}>
                        <Zap size={14} className="mr-2"/> Auto-Fix with AI
                    </Button>
                )}
            </div>
        )}

        {/* Console Panel */}
        <div 
            className={`absolute bottom-0 left-0 right-0 bg-black/95 border-t border-gray-800 transition-all duration-300 ease-in-out z-40 flex flex-col ${showConsole ? 'h-48' : 'h-0'}`}
        >
            <div className="flex justify-between items-center px-4 py-1 bg-gray-900 border-b border-gray-800 shrink-0">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Console Output</span>
                <button onClick={() => setLogs([])} className="text-[10px] text-gray-500 hover:text-white">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1" ref={consoleRef}>
                {logs.length === 0 && <div className="text-gray-600 italic px-2">No logs yet...</div>}
                {logs.map((log, i) => (
                    <div key={i} className={`flex gap-2 ${log.level === 'error' ? 'text-red-400 bg-red-900/10' : log.level === 'warn' ? 'text-yellow-400' : log.level === 'input' ? 'text-blue-400' : 'text-gray-300'}`}>
                        <span className="text-gray-600 shrink-0 select-none">[{log.time}]</span>
                        <span className="break-all">{log.message}</span>
                    </div>
                ))}
            </div>
            <form onSubmit={handleConsoleSubmit} className="border-t border-gray-800 flex shrink-0">
                <span className="px-2 py-1 text-blue-500 font-mono">{'>'}</span>
                <input 
                    type="text" 
                    className="flex-1 bg-transparent text-gray-300 font-mono text-xs focus:outline-none py-1"
                    value={consoleInput}
                    onChange={(e) => setConsoleInput(e.target.value)}
                    placeholder="Evaluate JS..."
                />
            </form>
        </div>

        <div className="flex-1 bg-gray-900/50 flex items-center justify-center overflow-hidden relative">
            {isInitialLoading && <SplashScreen />}
            
            {showQrCode && (
                <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=omni-studio-demo`} alt="QR Code" className="w-32 h-32" />
                    <div className="text-center text-[10px] text-black font-bold mt-1">Scan to Preview</div>
                </div>
            )}

            {isGeneratingEcosystem && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in">
                    <div className="w-64 mb-6 relative">
                        <div className="absolute top-0 left-0 h-1 bg-gray-800 w-full rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 animate-[shimmer_1.5s_infinite] w-1/3 rounded-full"></div>
                        </div>
                    </div>
                    <div className="text-primary-400 font-bold animate-pulse text-lg mb-2">Generating Ecosystem</div>
                    <div className="text-gray-500 text-sm font-mono">{ecosystemStep}</div>
                </div>
            )}

            {isBuilding ? (
                <div className="flex flex-col items-center animate-in fade-in">
                    <div className="w-16 h-16 border-4 border-gray-800 border-t-primary-500 rounded-full animate-spin mb-4"></div>
                    <div className="text-gray-400 font-mono text-sm">{buildStep}</div>
                </div>
            ) : (
                <div className={`transition-all duration-500 ease-in-out relative ${previewMode === 'mobile' ? 'scale-[0.85] md:scale-100' : 'w-full h-full'}`}>
                    {previewMode === 'mobile' ? (
                        <div className="mockup-phone border-gray-800">
                            <div className="camera"></div> 
                            <div className="display">
                                <div className={`artboard artboard-demo phone-1 bg-white overflow-hidden relative ${deviceFrame === 'iphone14' ? 'w-[375px] h-[812px]' : 'w-[412px] h-[915px]'}`}>
                                    <iframe 
                                        id="preview-iframe"
                                        title="Preview"
                                        srcDoc={previewSrc}
                                        className="w-full h-full border-none bg-white"
                                        sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
                                    />
                                    {/* Notch Overlay for realism */}
                                    <div className="absolute top-0 left-0 right-0 h-8 bg-black/90 z-20 pointer-events-none"></div>
                                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/20 rounded-full z-20 pointer-events-none"></div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full bg-white relative">
                            <iframe 
                                id="preview-iframe"
                                title="Preview"
                                srcDoc={previewSrc}
                                className="w-full h-full border-none"
                                sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};