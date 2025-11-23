
import React, { useState } from 'react';
import { X, Github, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface ConnectModalProps {
  onClose: () => void;
  onConnectLocal: () => void;
  onConnectGitHub: (url: string) => Promise<void>;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({ onClose, onConnectLocal, onConnectGitHub }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'github'>('local');
  const [repoUrl, setRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGitHubSubmit = async () => {
      if (!repoUrl) return;
      setIsLoading(true);
      await onConnectGitHub(repoUrl);
      setIsLoading(false);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
          <h3 className="font-bold text-white">Connect Remote Source</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        
        <div className="p-6">
            <div className="flex gap-4 mb-6">
                <button 
                    onClick={() => setActiveTab('local')}
                    className={`flex-1 py-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${activeTab === 'local' ? 'bg-primary-900/20 border-primary-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'}`}
                >
                    <FolderOpen size={24} />
                    <span className="text-xs font-medium">Local Directory</span>
                </button>
                <button 
                    onClick={() => setActiveTab('github')}
                    className={`flex-1 py-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${activeTab === 'github' ? 'bg-primary-900/20 border-primary-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'}`}
                >
                    <Github size={24} />
                    <span className="text-xs font-medium">GitHub Repo</span>
                </button>
            </div>

            {activeTab === 'local' ? (
                <div className="text-center space-y-4">
                    <p className="text-sm text-gray-400">
                        Select a folder from your computer to edit directly in the browser using the File System Access API.
                    </p>
                    <Button onClick={() => { onConnectLocal(); onClose(); }} className="w-full">
                        Open Local Folder
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Repository URL</label>
                        <input 
                            type="text" 
                            placeholder="https://github.com/username/repo" 
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 outline-none text-sm"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-gray-500">
                        Note: Only public repositories are supported in this demo. Limit 50 files.
                    </p>
                    <Button onClick={handleGitHubSubmit} className="w-full" disabled={isLoading || !repoUrl}>
                        {isLoading ? <Loader2 size={16} className="animate-spin mr-2"/> : <Github size={16} className="mr-2"/>}
                        {isLoading ? 'Importing...' : 'Import Repository'}
                    </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
