
import React, { useState, useEffect, useRef } from 'react';
import { X, Edit2 } from 'lucide-react';
import { Button } from './Button';

interface RenameModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({ isOpen, currentName, onClose, onRename }) => {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name !== currentName) {
      onRename(name.trim());
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
            <Edit2 size={16} className="text-primary-400"/>
            Rename Item
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">New Name</label>
            <input 
              ref={inputRef}
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!name.trim() || name === currentName}>Rename</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
