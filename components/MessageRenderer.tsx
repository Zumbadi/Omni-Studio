
import React from 'react';
import { Paperclip, CornerDownLeft, Sparkles, AlertTriangle, CheckCircle, XCircle, GitCompare, RotateCcw, Shield, Zap, Bot, User, Download, Globe, ExternalLink, PenTool, Terminal, MapPin } from 'lucide-react';
import { ChatMessage } from '../types';

interface MessageRendererProps {
  message: ChatMessage;
  onApplyCode: (code: string) => void;
  onApplyAll?: (codes: string[]) => void;
  onAutoFix?: (issues: string[]) => void;
  onCompareCode?: (code: string) => void;
  onRevert?: () => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message, onApplyCode, onAutoFix, onCompareCode, onRevert }) => {
  
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

  // Detect Agent Persona
  let agentIcon = <Bot size={16} />;
  let agentColor = 'text-primary-400';
  let agentName = 'Omni';

  if (message.text.includes('**Manager') || message.text.includes('Manager:')) {
      agentIcon = <Shield size={16} />;
      agentColor = 'text-purple-400';
      agentName = 'Manager';
  } else if (message.text.includes('**Critic') || message.role === 'critic') {
      agentIcon = <AlertTriangle size={16} />;
      agentColor = 'text-red-400';
      agentName = 'Critic';
  } else if (message.text.includes('**Frontend') || message.text.includes('Builder')) {
      agentIcon = <Zap size={16} />;
      agentColor = 'text-blue-400';
      agentName = 'Builder';
  }

  const renderAttachments = () => {
      if (!message.attachments || message.attachments.length === 0) return null;
      
      return (
          <div className="flex flex-wrap gap-2 mt-2">
              {message.attachments.map((att, i) => (
                  <div key={i} className="bg-black/30 rounded-lg overflow-hidden border border-gray-700/50">
                      {att.type === 'image' && (
                          <div className="relative group">
                              <img src={att.url} alt={att.name} className="max-w-[200px] h-auto object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <a href={att.url} download={att.name} className="p-1 bg-gray-800 rounded text-white hover:bg-gray-700"><Download size={14}/></a>
                              </div>
                          </div>
                      )}
                      {att.type === 'audio' && (
                          <div className="p-2 flex items-center gap-2 min-w-[200px]">
                              <audio controls src={att.url} className="h-8 w-full" />
                          </div>
                      )}
                  </div>
              ))}
          </div>
      );
  };

  const renderSources = () => {
      if (!message.groundingMetadata || !message.groundingMetadata.groundingChunks || message.groundingMetadata.groundingChunks.length === 0) return null;
      
      return (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  <Globe size={10} /> Sources
              </div>
              <div className="flex flex-wrap gap-2">
                  {message.groundingMetadata.groundingChunks.map((chunk: any, i: number) => {
                      if (chunk.web) {
                          return (
                              <a 
                                  key={i} 
                                  href={chunk.web.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 bg-blue-900/20 hover:bg-blue-900/40 text-blue-300 border border-blue-800/50 rounded-full px-3 py-1 text-xs transition-colors max-w-full truncate"
                              >
                                  <span className="truncate max-w-[150px]">{chunk.web.title || chunk.web.uri}</span>
                                  <ExternalLink size={10} className="opacity-50 flex-shrink-0" />
                              </a>
                          );
                      }
                      if (chunk.maps) {
                          return (
                              <a 
                                  key={i} 
                                  href={chunk.maps.uri} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 bg-green-900/20 hover:bg-green-900/40 text-green-300 border border-green-800/50 rounded-full px-3 py-1 text-xs transition-colors max-w-full truncate"
                              >
                                  <MapPin size={10} />
                                  <span className="truncate max-w-[150px]">{chunk.maps.title || "Map Location"}</span>
                                  <ExternalLink size={10} className="opacity-50 flex-shrink-0" />
                              </a>
                          );
                      }
                      return null;
                  })}
              </div>
          </div>
      );
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
          {renderAttachments()}
        </div>
      </div>
     );
  }

  // Handle Critic Messages specifically
  if (message.role === 'critic' && message.critique) {
      const { score, issues, suggestions, fixCode } = message.critique;
      return (
          <div className="flex flex-col items-start w-full animate-in slide-in-from-left-2 duration-300">
              <div className="flex items-center gap-2 mb-1 ml-1 text-xs font-bold text-red-400">
                  <AlertTriangle size={12}/> Omni Critic
              </div>
              <div className={`max-w-[90%] rounded-xl p-4 border ${getScoreColor(score)} shadow-lg w-full`}>
                  <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                      <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                          {getScoreIcon(score)} Review
                      </span>
                      <span className="text-sm font-mono font-bold">{score}/100</span>
                  </div>
                  
                  <div className="space-y-3">
                      {issues && issues.length > 0 && (
                          <div>
                              <h4 className="text-[10px] uppercase text-white/60 font-bold mb-1 flex justify-between">
                                  Issues Detected
                                  <span className="text-red-400 bg-red-900/40 px-1.5 rounded-full">{issues.length}</span>
                              </h4>
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

                  {/* Auto-Fix Available Indicator */}
                  {fixCode && (
                      <div className="mt-4 bg-green-900/20 p-3 rounded-lg border border-green-500/30">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-green-300 flex items-center gap-1">
                                  <PenTool size={12}/> Auto-Correction Ready
                              </span>
                              <span className="text-[9px] bg-green-900/50 text-green-200 px-2 py-0.5 rounded font-mono">
                                  SELF-HEALING
                              </span>
                          </div>
                          <div className="text-[10px] text-green-200/70 mb-2">
                              The critic has automatically generated a fix for the identified issues.
                          </div>
                          <button 
                              onClick={() => onApplyCode(fixCode)}
                              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-xs font-medium py-2 rounded-lg transition-all shadow-lg"
                          >
                              <CornerDownLeft size={14} /> Apply Critic's Fix
                          </button>
                      </div>
                  )}

                  {!fixCode && score < 90 && onAutoFix && (
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

  // Handle text logic (System messages, Code blocks, Revert button)
  const renderTextContent = (text: string) => {
      // Split by code blocks
      const parts = text.split(/(```[\s\S]*?```)/g);
      
      return parts.map((part, idx) => {
          // Code Block
          const isCodeBlock = part.startsWith('```') && part.endsWith('```');
          if (isCodeBlock) {
               const content = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
               const langMatch = part.match(/^```(\w+)/);
               const lang = langMatch ? langMatch[1] : 'code';
               
               const filenameMatch = content.match(/^\/\/ filename: (.*)/);
               const targetFile = filenameMatch ? filenameMatch[1].trim() : 'Current File';

               return (
                 <div key={idx} className="my-2 first:mt-0 last:mb-0 group/block relative rounded-lg overflow-hidden shadow-lg border border-gray-700">
                    <div className="flex justify-between items-center bg-gray-900 px-3 py-2 border-b border-gray-700">
                       <div className="flex items-center gap-2">
                           <span className="text-[10px] text-gray-500 font-mono uppercase font-bold">{lang}</span>
                           {filenameMatch && <span className="text-[10px] text-blue-300 font-mono bg-blue-900/30 px-1.5 py-0.5 rounded border border-blue-800/50">{targetFile}</span>}
                       </div>
                       <div className="flex gap-2">
                           {onCompareCode && (
                               <button onClick={() => onCompareCode(content)} className="flex items-center gap-1 text-[10px] bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white px-2 py-1 rounded transition-all" title="Compare">
                                   <GitCompare size={10} /> Diff
                               </button>
                           )}
                           <button onClick={() => onApplyCode(content)} className="flex items-center gap-1 text-[10px] bg-gray-800 hover:bg-primary-600 border border-gray-600 hover:border-primary-500 text-gray-300 hover:text-white px-2 py-1 rounded transition-all" title="Apply">
                             <CornerDownLeft size={10} /> Apply
                           </button>
                       </div>
                    </div>
                    <pre className="p-4 overflow-x-auto bg-gray-950/80 font-mono text-xs text-gray-300 scrollbar-thin scrollbar-thumb-gray-700 leading-relaxed">
                       {content}
                    </pre>
                 </div>
               );
          }
          
          // Revert Button Handling
          if (part.includes('[Revert Changes]')) {
              const splitByRevert = part.split('[Revert Changes]');
              return (
                  <div key={idx} className="p-2 whitespace-pre-wrap leading-relaxed text-gray-300">
                      {splitByRevert.map((subPart, subIdx) => (
                          <React.Fragment key={subIdx}>
                              {subPart}
                              {subIdx < splitByRevert.length - 1 && onRevert && (
                                  <button 
                                      onClick={onRevert}
                                      className="inline-flex items-center gap-1 text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800 px-2 py-1 rounded ml-2 transition-colors"
                                  >
                                      <RotateCcw size={10} /> Revert Changes
                                  </button>
                              )}
                          </React.Fragment>
                      ))}
                  </div>
              );
          }
          
          // Auto-Fix Badge
          if (part.includes('AUTO-FIXED')) {
              const split = part.split('AUTO-FIXED');
              return (
                  <div key={idx} className="p-2 whitespace-pre-wrap leading-relaxed text-gray-300">
                      {split[0]}
                      <span className="inline-flex items-center gap-1 text-[10px] bg-green-900/30 text-green-300 border border-green-800 px-1.5 py-0.5 rounded font-bold uppercase mx-1">
                          <Zap size={8} fill="currentColor"/> Auto-Fixed
                      </span>
                      {split[1]}
                  </div>
              );
          }

          // Standard Text
          if (!part.trim()) return null;
          return <div key={idx} className="p-2 whitespace-pre-wrap leading-relaxed text-gray-300">{part}</div>;
      });
  };

  // If System Update message, style differently
  const isSystemUpdate = message.text.startsWith('**Update:**');

  return (
    <div className={`flex flex-col items-start w-full animate-in slide-in-from-left-2 duration-300 ${isSystemUpdate ? 'opacity-90' : ''}`}>
      {/* Agent Identity Header */}
      {!isSystemUpdate && (
          <div className={`flex items-center gap-1 mb-1 ml-1 text-[10px] font-bold uppercase tracking-wider ${agentColor}`}>
              {agentIcon} {agentName}
          </div>
      )}
      
      <div className={`max-w-[98%] rounded-2xl rounded-tl-none p-2 overflow-hidden border ${isSystemUpdate ? 'bg-gray-900 border-gray-700 border-l-4 border-l-purple-500' : 'bg-gray-800 border-gray-700'} text-gray-200 text-sm w-full shadow-md relative group`}>
         {renderTextContent(message.text)}
         {renderAttachments()}
         {renderSources()}
      </div>
    </div>
  );
};