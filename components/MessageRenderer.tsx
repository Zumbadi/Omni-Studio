import React from 'react';
import { Paperclip, Layers, CornerDownLeft } from 'lucide-react';
import { ChatMessage } from '../types';

interface MessageRendererProps {
  message: ChatMessage;
  onApplyCode: (code: string) => void;
  onApplyAll?: (codes: string[]) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message, onApplyCode, onApplyAll }) => {
  if (message.role !== 'model') {
     return (
      <div className="flex flex-col items-end">
        <div className="max-w-[90%] rounded-lg p-3 text-sm whitespace-pre-wrap bg-primary-600 text-white shadow-md">
          {message.text.startsWith('[Attached:') ? (
             <div>
                <div className="flex items-center gap-2 text-blue-200 font-semibold text-xs mb-1">
                    <Paperclip size={12} /> {message.text.split('\n')[0]}
                </div>
                {message.text.split('\n').slice(1).join('\n')}
             </div>
          ) : message.text}
        </div>
      </div>
     );
  }

  const parts = message.text.split(/(```[\s\S]*?```)/g);
  const codeBlocks = parts.filter(part => part.startsWith('```') && part.endsWith('```')).map(part => part.replace(/^```\w*\n?/, '').replace(/```$/, ''));

  return (
    <div className="flex flex-col items-start w-full">
      <div className="max-w-[95%] rounded-lg p-0 overflow-hidden border border-gray-700 bg-gray-800 text-gray-200 text-sm w-full shadow-md relative">
         {codeBlocks.length > 1 && onApplyAll && (
             <div className="w-full bg-gray-900/50 border-b border-gray-700 p-2 flex justify-end">
                 <button 
                    onClick={() => onApplyAll(codeBlocks)}
                    className="text-xs flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition-colors"
                 >
                    <Layers size={12} /> Apply All Changes ({codeBlocks.length})
                 </button>
             </div>
         )}
         
         {parts.map((part, idx) => {
            const isCodeBlock = part.startsWith('```') && part.endsWith('```');
            if (isCodeBlock) {
               const content = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
               const langMatch = part.match(/^```(\w+)/);
               const lang = langMatch ? langMatch[1] : 'code';
               
               // Check for filename header in the code content
               const filenameMatch = content.match(/^\/\/ filename: (.*)/);
               const targetFile = filenameMatch ? filenameMatch[1].trim() : 'Current File';

               return (
                 <div key={idx} className="my-2 first:mt-0 last:mb-0">
                    <div className="flex justify-between items-center bg-gray-900 px-3 py-1.5 border-b border-gray-700">
                       <div className="flex items-center gap-2">
                           <span className="text-xs text-gray-500 font-mono uppercase">{lang}</span>
                           {filenameMatch && <span className="text-xs text-blue-400 font-mono bg-blue-900/20 px-1 rounded border border-blue-800">{targetFile}</span>}
                       </div>
                       <button 
                         onClick={() => onApplyCode(content)}
                         className="flex items-center gap-1 text-[10px] bg-primary-900/30 hover:bg-primary-900/50 border border-primary-700 text-primary-300 px-2 py-1 rounded transition-colors"
                       >
                         <CornerDownLeft size={10} /> {filenameMatch ? `Create/Update` : 'Apply to Editor'}
                       </button>
                    </div>
                    <pre className="p-3 overflow-x-auto bg-gray-950/50 font-mono text-xs text-gray-300 scrollbar-thin scrollbar-thumb-gray-700">
                       {content}
                    </pre>
                 </div>
               );
            }
            if (!part.trim()) return null;
            return <div key={idx} className="p-3 whitespace-pre-wrap">{part}</div>
         })}
      </div>
    </div>
  );
};