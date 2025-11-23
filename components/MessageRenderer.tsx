
import React from 'react';
import { Paperclip, Layers, CornerDownLeft, Sparkles, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { ChatMessage } from '../types';

interface MessageRendererProps {
  message: ChatMessage;
  onApplyCode: (code: string) => void;
  onApplyAll?: (codes: string[]) => void;
  onAutoFix?: (issues: string[]) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message, onApplyCode, onApplyAll, onAutoFix }) => {
  
  const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-green-400 border-green-500/30 bg-green-900/20';
      if (score >= 70) return 'text-yellow-400 border-yellow-500/30 bg-yellow-900/20';
      return 'text-red-400 border-red-500/30 bg-red-900/20';
  };

  const getScoreIcon = (score: number) => {
      if (score >= 90) return <CheckCircle size={14} />;
      if (score >= 70) return <AlertTriangle size={14} />;
      return <XCircle size={14} />;
  };

  if (message.role !== 'model' && message.role !== 'critic') {
     return (
      <div className="flex flex-col items-end animate-in slide-in-from-right-2 duration-300">
        <div className="max-w-[90%] rounded-2xl rounded-tr-none p-3 text-sm whitespace-pre-wrap bg-primary-600 text-white shadow-md">
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

  // Handle Critic Messages specifically
  if (message.role === 'critic' && message.critique) {
      const { score, issues, suggestions } = message.critique;
      return (
          <div className="flex flex-col items-start w-full animate-in slide-in-from-left-2 duration-300">
              <div className={`max-w-[90%] rounded-xl p-4 border ${getScoreColor(score)} shadow-lg w-full`}>
                  <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                      <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                          {getScoreIcon(score)} Omni-Critic Review
                      </span>
                      <span className="text-sm font-mono font-bold">{score}/100</span>
                  </div>
                  
                  <div className="space-y-3">
                      {issues && issues.length > 0 && (
                          <div>
                              <h4 className="text-[10px] uppercase text-white/60 font-bold mb-1">Issues Detected</h4>
                              <ul className="list-disc list-inside text-xs space-y-1 text-white/80">
                                  {issues.map((issue, i) => <li key={i}>{issue}</li>)}
                              </ul>
                          </div>
                      )}
                      
                      {suggestions && suggestions.length > 0 && (
                          <div>
                              <h4 className="text-[10px] uppercase text-white/60 font-bold mb-1">Suggestions</h4>
                              <ul className="list-disc list-inside text-xs space-y-1 text-white/80">
                                  {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                          </div>
                      )}
                  </div>

                  {score < 90 && onAutoFix && (
                      <button 
                          onClick={() => onAutoFix(issues)}
                          className="mt-4 w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-medium py-2 rounded-lg transition-colors"
                      >
                          <Sparkles size={14} className="text-yellow-300"/> Auto-Fix Issues
                      </button>
                  )}
              </div>
          </div>
      );
  }

  const parts = message.text.split(/(```[\s\S]*?```)/g);
  const codeBlocks = parts.filter(part => part.startsWith('```') && part.endsWith('```')).map(part => part.replace(/^```\w*\n?/, '').replace(/```$/, ''));

  return (
    <div className="flex flex-col items-start w-full animate-in slide-in-from-left-2 duration-300">
      <div className="max-w-[98%] rounded-2xl rounded-tl-none p-0 overflow-hidden border border-gray-700 bg-gray-800 text-gray-200 text-sm w-full shadow-md relative group">
         {codeBlocks.length > 1 && onApplyAll && (
             <div className="w-full bg-gray-900/50 border-b border-gray-700 p-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 z-10">
                 <button 
                    onClick={() => onApplyAll(codeBlocks)}
                    className="text-xs flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded transition-colors shadow-lg"
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
                 <div key={idx} className="my-2 first:mt-0 last:mb-0 group/block relative">
                    <div className="flex justify-between items-center bg-gray-900 px-3 py-2 border-b border-gray-700">
                       <div className="flex items-center gap-2">
                           <span className="text-[10px] text-gray-500 font-mono uppercase font-bold">{lang}</span>
                           {filenameMatch && <span className="text-[10px] text-blue-300 font-mono bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-800/50">{targetFile}</span>}
                       </div>
                       <button 
                         onClick={() => onApplyCode(content)}
                         className="flex items-center gap-1 text-[10px] bg-gray-800 hover:bg-primary-600 border border-gray-600 hover:border-primary-500 text-gray-300 hover:text-white px-2 py-1 rounded transition-all"
                         title="Inject code into editor"
                       >
                         <CornerDownLeft size={10} /> Apply
                       </button>
                    </div>
                    <pre className="p-4 overflow-x-auto bg-gray-950/80 font-mono text-xs text-gray-300 scrollbar-thin scrollbar-thumb-gray-700 leading-relaxed">
                       {content}
                    </pre>
                 </div>
               );
            }
            if (!part.trim()) return null;
            return <div key={idx} className="p-4 whitespace-pre-wrap leading-relaxed">{part}</div>
         })}
      </div>
    </div>
  );
};
