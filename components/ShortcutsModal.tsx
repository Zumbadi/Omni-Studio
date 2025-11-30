
import React, { useEffect } from 'react';
import { X, Keyboard, Command, CornerDownLeft } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const ShortcutRow = ({ keys, desc }: { keys: string[], desc: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-300 text-sm">{desc}</span>
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <kbd key={i} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs font-mono text-gray-400 min-w-[24px] text-center">
            {k}
          </kbd>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Keyboard size={20} className="text-primary-500"/> Keyboard Shortcuts
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
        </div>
        
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">General</h4>
            <ShortcutRow keys={['Ctrl', 'P']} desc="Command Palette / Go to File" />
            <ShortcutRow keys={['Ctrl', 'S']} desc="Save Active File" />
            <ShortcutRow keys={['Ctrl', 'B']} desc="Toggle Sidebar" />
            <ShortcutRow keys={['Ctrl', 'J']} desc="Toggle Terminal" />
            <ShortcutRow keys={['Ctrl', 'Shift', 'Z']} desc="Toggle Zen Mode" />
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Editor</h4>
            <ShortcutRow keys={['Tab']} desc="Indent / Accept Ghost Text" />
            <ShortcutRow keys={['Ctrl', 'Space']} desc="Trigger Autocomplete" />
            <ShortcutRow keys={['Esc']} desc="Close Suggestions" />
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Media Studio</h4>
            <ShortcutRow keys={['Space']} desc="Play / Pause Preview" />
            <ShortcutRow keys={['Delete']} desc="Remove Selected Scene" />
          </div>
        </div>
        
        <div className="p-4 bg-gray-850 border-t border-gray-800 text-center">
            <span className="text-xs text-gray-500">Press <kbd className="bg-gray-800 px-1 rounded border border-gray-700">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
