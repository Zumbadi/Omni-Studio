
import React, { useState } from 'react';
import { Smartphone, Globe, QrCode, RefreshCw, Network, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { Project, ProjectType } from '../types';

interface LivePreviewProps {
  project: Project;
  previewSrc: string;
  onRefresh: () => void;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ project, previewSrc, onRefresh }) => {
  const isNative = project.type === ProjectType.REACT_NATIVE || project.type === ProjectType.IOS_APP || project.type === ProjectType.ANDROID_APP;
  const isBackend = project.type === ProjectType.NODE_API;

  const [previewMode, setPreviewMode] = useState<'web' | 'mobile'>(isNative ? 'mobile' : 'web');
  const [showQrCode, setShowQrCode] = useState(false);
  const [deviceFrame, setDeviceFrame] = useState<'iphone14' | 'pixel7' | 'ipad'>('iphone14');

  // API Console State
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiPath, setApiPath] = useState('/users');
  const [apiResponse, setApiResponse] = useState<string>('// Click Send to test endpoint');
  const [apiStatus, setApiStatus] = useState<number | null>(null);

  const handleApiSend = () => {
      setApiResponse('Sending request...');
      setApiStatus(null);
      setTimeout(() => {
          // Mock Response based on path
          if (apiPath === '/users' && apiMethod === 'GET') { setApiStatus(200); setApiResponse(JSON.stringify({ count: 2, data: [{id: 1, name: 'Alice'}, {id: 2, name: 'Bob'}] }, null, 2)); }
          else if (apiPath === '/' && apiMethod === 'GET') { setApiStatus(200); setApiResponse(JSON.stringify({ message: 'Welcome to Omni API v1' }, null, 2)); }
          else if (apiMethod === 'POST') { setApiStatus(201); setApiResponse(JSON.stringify({ id: 3, status: 'created', timestamp: new Date().toISOString() }, null, 2)); }
          else { setApiStatus(404); setApiResponse(JSON.stringify({ error: 'Route not found' }, null, 2)); }
      }, 600);
  };

  if (isBackend) {
      return (
        <div className="flex-1 flex flex-col bg-gray-900/50 overflow-hidden relative">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Network size={14} className="text-green-500"/> API Console (Postman Mode)
                </div>
                <Button size="sm" variant="ghost" onClick={onRefresh} title="Restart Server"><RefreshCw size={14}/></Button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto flex justify-center">
                <div className="w-full max-w-lg bg-gray-800 rounded-xl border border-gray-700 flex flex-col shadow-xl overflow-hidden h-fit">
                    <div className="p-4 space-y-4">
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
        {/* Toolbar */}
        <div className="h-10 bg-gray-800 flex items-center px-3 gap-2 border-b border-gray-700 shrink-0 justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
                <div className="flex-1 max-w-xs bg-gray-900/50 rounded text-[10px] text-gray-500 px-3 py-1 text-center font-mono truncate border border-gray-700/50 flex items-center justify-center gap-1">
                    <Globe size={10}/> localhost:3000
                </div>
            </div>
            
            {isNative ? (
                <div className="flex bg-gray-700/50 rounded p-0.5 gap-0.5">
                    <button onClick={() => setPreviewMode('mobile')} className={`p-1.5 rounded transition-all ${previewMode === 'mobile' ? 'text-white bg-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`} title="Mobile Simulator"><Smartphone size={14}/></button>
                    <button onClick={() => setPreviewMode('web')} className={`p-1.5 rounded transition-all ${previewMode === 'web' ? 'text-white bg-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`} title="Web Fallback"><Globe size={14}/></button>
                    <button onClick={() => setShowQrCode(!showQrCode)} className={`p-1.5 rounded transition-all ${showQrCode ? 'text-green-400 bg-gray-600 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`} title="Scan Expo QR"><QrCode size={14}/></button>
                </div>
            ) : (
                <Button size="sm" variant="ghost" onClick={onRefresh} title="Refresh Preview"><RefreshCw size={14}/></Button>
            )}
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(#333_1px,transparent_1px)] bg-[size:20px_20px] overflow-auto relative">
            {isNative && previewMode === 'mobile' ? (
                <div className="relative transition-all duration-500 animate-in zoom-in-95">
                    <div className={`border-[8px] border-gray-800 rounded-[3rem] overflow-hidden bg-white relative shadow-2xl ring-1 ring-white/10 ${deviceFrame === 'ipad' ? 'w-[500px] h-[700px]' : 'w-[320px] h-[650px]'}`}>
                        {/* Notch */}
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-7 bg-gray-800 rounded-b-xl z-20 flex items-center justify-center">
                            <div className="w-12 h-1 bg-gray-700 rounded-full"></div>
                        </div>
                        
                        <iframe id="preview-iframe" title="preview" srcDoc={previewSrc} className="w-full h-full border-none bg-white" sandbox="allow-scripts" />
                        
                        {/* QR Overlay */}
                        {showQrCode && (
                            <div className="absolute inset-0 bg-gray-900/95 z-30 flex flex-col items-center justify-center text-center p-6 animate-in fade-in backdrop-blur-sm">
                                <div className="bg-white p-3 rounded-xl mb-4 shadow-lg">
                                    <QrCode size={140} className="text-black" />
                                </div>
                                <h3 className="text-white font-bold mb-1 text-lg">Scan with Expo Go</h3>
                                <p className="text-gray-400 text-xs mb-6">Open the camera on your iOS/Android device to preview live.</p>
                                <Button size="sm" variant="secondary" onClick={() => setShowQrCode(false)}>Close</Button>
                            </div>
                        )}
                    </div>

                    {/* Device Controls */}
                    <div className="absolute -right-14 top-0 flex flex-col gap-2 bg-gray-800 p-1.5 rounded-xl border border-gray-700 shadow-lg">
                        <button onClick={() => setDeviceFrame('iphone14')} className={`p-2 rounded-lg transition-colors ${deviceFrame === 'iphone14' ? 'bg-primary-600 text-white shadow' : 'text-gray-500 hover:bg-gray-700 hover:text-white'}`} title="iPhone 14"><Smartphone size={18}/></button>
                        <button onClick={() => setDeviceFrame('pixel7')} className={`p-2 rounded-lg transition-colors ${deviceFrame === 'pixel7' ? 'bg-primary-600 text-white shadow' : 'text-gray-500 hover:bg-gray-700 hover:text-white'}`} title="Pixel 7"><Smartphone size={18} className="rotate-90"/></button>
                        <button onClick={() => setDeviceFrame('ipad')} className={`p-2 rounded-lg transition-colors ${deviceFrame === 'ipad' ? 'bg-primary-600 text-white shadow' : 'text-gray-500 hover:bg-gray-700 hover:text-white'}`} title="iPad Air"><Smartphone size={22} className="scale-110"/></button>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full bg-white shadow-2xl rounded-lg overflow-hidden border border-gray-700/50">
                    <iframe id="preview-iframe" title="preview" srcDoc={previewSrc} className="w-full h-full border-none" sandbox="allow-scripts" />
                </div>
            )}
        </div>
    </div>
  );
};
