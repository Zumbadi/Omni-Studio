
import React, { useEffect, useRef } from 'react';
import { Edit2, Trash2, Copy, FileText, Sparkles, RotateCcw, XCircle } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExplain: () => void;
  isTrash?: boolean;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, onRename, onDelete, onDuplicate, onExplain, isTrash, onRestore, onPermanentDelete }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={menuRef}
      className="fixed z-[100] w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ top: y, left: x }}
    >
      {!isTrash ? (
          <>
            <div className="p-1 space-y-0.5">
                <button onClick={onRename} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded-md text-left">
                <Edit2 size={14} /> Rename
                </button>
                <button onClick={onDuplicate} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white rounded-md text-left">
                <Copy size={14} /> Duplicate
                </button>
                <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300 rounded-md text-left">
                <Trash2 size={14} /> Delete
                </button>
            </div>
            <div className="h-px bg-gray-700 my-0.5"></div>
            <div className="p-1">
                <button onClick={onExplain} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-400 hover:bg-purple-900/30 hover:text-purple-300 rounded-md text-left">
                <Sparkles size={14} /> Explain with AI
                </button>
            </div>
          </>
      ) : (
          <div className="p-1 space-y-0.5">
              <button onClick={onRestore} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-green-400 hover:bg-green-900/30 hover:text-green-300 rounded-md text-left">
                  <RotateCcw size={14} /> Restore
              </button>
              <button onClick={onPermanentDelete} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300 rounded-md text-left">
                  <XCircle size={14} /> Delete Forever
              </button>
          </div>
      )}
    </div>
  );
};
