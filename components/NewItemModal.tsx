
import React, { useState, useEffect, useRef } from 'react';
import { X, File, Folder } from 'lucide-react';
import { Button } from './Button';

interface NewItemModalProps {
  type: 'file' | 'folder';
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}

export const NewItemModal: React.FC<NewItemModalProps> = ({ type, isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850 rounded-t-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {type === 'file' ? <File size={16} className="text-blue-400"/> : <Folder size={16} className="text-yellow-400"/>}
            New {type === 'file' ? 'File' : 'Folder'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Name / Path</label>
            <input 
              ref={inputRef}
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none transition-colors"
              placeholder={type === 'file' ? "src/components/Header.tsx" : "src/utils"}
            />
            <p className="text-[10px] text-gray-500 mt-1">Tip: Use slashes to create nested directories instantly.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!name.trim()}>Create</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
