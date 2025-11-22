
import React from 'react';
import { X } from 'lucide-react';

interface DiffEditorProps {
  original: string;
  modified: string;
  fileName: string;
  onClose: () => void;
}

export const DiffEditor: React.FC<DiffEditorProps> = ({ original, modified, fileName, onClose }) => {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  // Simple diff logic (naive implementation for demo)
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  const renderLines = () => {
    const rows = [];
    for (let i = 0; i < maxLines; i++) {
      const orig = originalLines[i] || '';
      const mod = modifiedLines[i] || '';
      const isDiff = orig !== mod;
      
      rows.push(
        <div key={i} className="flex text-xs font-mono leading-6 hover:bg-gray-800/50">
           {/* Original Line */}
           <div className={`w-1/2 border-r border-gray-800 flex ${isDiff ? 'bg-red-900/20' : ''}`}>
              <div className="w-8 text-gray-600 text-right pr-2 select-none">{i + 1}</div>
              <div className={`flex-1 whitespace-pre pl-2 overflow-hidden ${isDiff ? 'text-red-300' : 'text-gray-400'}`}>
                 {orig}
              </div>
           </div>
           
           {/* Modified Line */}
           <div className={`w-1/2 flex ${isDiff ? 'bg-green-900/20' : ''}`}>
              <div className="w-8 text-gray-600 text-right pr-2 select-none border-r border-gray-800">{i + 1}</div>
              <div className={`flex-1 whitespace-pre pl-2 overflow-hidden ${isDiff ? 'text-green-300' : 'text-gray-300'}`}>
                 {mod}
              </div>
           </div>
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
         <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase">Working Tree</span>
            <span className="text-sm text-gray-200 font-medium">{fileName}</span>
            <span className="text-xs text-gray-600">(Diff)</span>
         </div>
         <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X size={16} />
         </button>
      </div>
      <div className="flex-1 overflow-auto">
         {renderLines()}
      </div>
    </div>
  );
};
