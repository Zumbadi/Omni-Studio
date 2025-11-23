
import React, { useState, useRef, useEffect } from 'react';
import { X, Package, Download, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface InstallPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: (packageName: string, isDev: boolean) => void;
}

export const InstallPackageModal: React.FC<InstallPackageModalProps> = ({ isOpen, onClose, onInstall }) => {
  const [pkgName, setPkgName] = useState('');
  const [isDev, setIsDev] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPkgName('');
      setIsInstalling(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pkgName.trim()) {
      setIsInstalling(true);
      // Simulate network delay
      setTimeout(() => {
          onInstall(pkgName.trim(), isDev);
          setIsInstalling(false);
          onClose();
      }, 1000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850 rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Package size={16} className="text-green-400"/>
            Install Dependency
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Package Name</label>
            <input 
              ref={inputRef}
              type="text" 
              value={pkgName}
              onChange={e => setPkgName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 focus:outline-none transition-colors font-mono"
              placeholder="e.g. axios, framer-motion"
            />
          </div>
          <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="devDep" 
                checked={isDev} 
                onChange={e => setIsDev(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 text-green-600 focus:ring-green-500 bg-gray-700 cursor-pointer"
              />
              <label htmlFor="devDep" className="text-xs text-gray-300 cursor-pointer">Save as devDependency (-D)</label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!pkgName.trim() || isInstalling}>
                {isInstalling ? <Loader2 size={14} className="animate-spin mr-2"/> : <Download size={14} className="mr-2"/>}
                {isInstalling ? 'Installing...' : 'Install'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
