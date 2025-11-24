import React from 'react';
import { X } from 'lucide-react';
import { highlightCode } from '../utils/syntaxHighlight';

interface DiffEditorProps {
  original: string;
  modified: string;
  fileName: string;
  onClose: () => void;
}

export const DiffEditor: React.FC<DiffEditorProps> = ({ original, modified, fileName, onClose }) => {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  // Simple line-by-line diff visualization
  const maxLines = Math.max(originalLines.length, modifiedLines.length);
  
  const renderLines = () => {
    const rows = [];
    for (let i = 0; i < maxLines; i++) {
      const orig = originalLines[i] || '';
      const mod = modifiedLines[i] || '';
      const isDiff = orig !== mod;
      
      rows.push(
        <div key={i} className={`flex text-xs font-mono leading-6 hover:bg-gray-800/50 group ${isDiff ? 'bg-yellow-900/5' : ''}`}>
           {/* Original Line */}
           <div className={`w-1/2 border-r border-gray-800 flex ${isDiff ? 'bg-red-900/10' : ''}`}>
              <div className="w-10 text-gray-600 text-right pr-2 select-none bg-gray-900/50">{i + 1}</div>
              <div className={`flex-1 whitespace-pre pl-2 overflow-hidden text-gray-400`}>
                 {isDiff ? <span className="opacity-70">{orig}</span> : highlightCode(orig)}
              </div>
           </div>
           
           {/* Modified Line */}
           <div className={`w-1/2 flex ${isDiff ? 'bg-green-900/10' : ''}`}>
              <div className="w-10 text-gray-600 text-right pr-2 select-none border-r border-gray-800 bg-gray-900/50">{i + 1}</div>
              <div className={`flex-1 whitespace-pre pl-2 overflow-hidden text-gray-300`}>
                 {highlightCode(mod)}
              </div>
           </div>
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 font-mono">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
         <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wide">Original</span>
            <div className="h-px w-8 bg-gray-700"></div>
            <span className="text-sm text-gray-200 font-bold">{fileName}</span>
            <div className="h-px w-8 bg-gray-700"></div>
            <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Modified</span>
         </div>
         <button onClick={onClose} className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 p-1.5 rounded transition-colors">
            <X size={16} />
         </button>
      </div>
      <div className="flex-1 overflow-auto relative">
         <div className="absolute inset-0 min-h-full">
            {renderLines()}
         </div>
      </div>
    </div>
  );
};