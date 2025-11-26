
import React, { useState } from 'react';
import { X, Smartphone, Settings, Download, Shield } from 'lucide-react';
import { Button } from './Button';
import { BuildSettings, ProjectType } from '../types';

interface BuildSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: BuildSettings) => void;
  projectType: ProjectType;
}

export const BuildSettingsModal: React.FC<BuildSettingsModalProps> = ({ isOpen, onClose, onExport, projectType }) => {
  const [settings, setSettings] = useState<BuildSettings>({
      appName: 'OmniApp',
      bundleId: 'com.omni.app',
      version: '1.0.0',
      buildNumber: '1',
      permissions: {
          camera: false,
          location: false,
          notifications: false,
          internet: true
      }
  });

  if (!isOpen) return null;

  const isIOS = projectType === ProjectType.IOS_APP;
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings size={20} className="text-primary-500"/> Build Configuration
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        
        <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">App Name</label>
                    <input 
                        type="text" 
                        value={settings.appName} 
                        onChange={e => setSettings(s => ({...s, appName: e.target.value}))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bundle ID</label>
                    <input 
                        type="text" 
                        value={settings.bundleId} 
                        onChange={e => setSettings(s => ({...s, bundleId: e.target.value}))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-primary-500 outline-none font-mono"
                    />
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Version</label>
                    <input 
                        type="text" 
                        value={settings.version} 
                        onChange={e => setSettings(s => ({...s, version: e.target.value}))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Build Number</label>
                    <input 
                        type="text" 
                        value={settings.buildNumber} 
                        onChange={e => setSettings(s => ({...s, buildNumber: e.target.value}))}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-primary-500 outline-none"
                    />
                </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2"><Shield size={12}/> Permissions</div>
                <div className="grid grid-cols-2 gap-3">
                    {Object.entries(settings.permissions).map(([key, val]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${val ? 'bg-green-600 border-green-500' : 'bg-gray-800 border-gray-600 group-hover:border-gray-500'}`}>
                                {val && <X size={10} className="text-white rotate-45" style={{transform: 'rotate(0deg)'}}/>} 
                            </div>
                            <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={val} 
                                onChange={e => setSettings(s => ({...s, permissions: {...s.permissions, [key]: e.target.checked}}))}
                            />
                            <span className="text-sm text-gray-300 capitalize">{key}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 flex items-start gap-3">
                <Smartphone size={16} className="text-blue-400 mt-0.5 shrink-0"/>
                <div>
                    <h4 className="text-xs font-bold text-blue-300 mb-1">Native Packaging</h4>
                    <p className="text-[10px] text-blue-200 leading-relaxed">
                        Configuration will be injected into 
                        {isIOS ? <span className="font-mono bg-blue-900/50 px-1 rounded ml-1">Info.plist</span> : <span className="font-mono bg-blue-900/50 px-1 rounded ml-1">build.gradle</span>}. 
                        The exported zip is ready for {isIOS ? 'Xcode' : 'Android Studio'}.
                    </p>
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-850 flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onExport(settings)}>
                <Download size={16} className="mr-2"/> Export Source
            </Button>
        </div>
      </div>
    </div>
  );
};
