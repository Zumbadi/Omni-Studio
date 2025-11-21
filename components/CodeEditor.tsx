
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Sparkles, MessageSquare, Zap, Hammer } from 'lucide-react';

export interface CodeEditorHandle {
  scrollToLine: (line: number) => void;
  focus: () => void;
}

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  fileName: string;
  config?: {
    fontSize?: string;
    tabSize?: string;
    vimMode?: boolean;
  };
  onCodeAction?: (action: string, selectedCode: string) => void;
}

const KEYWORDS = [
  'import', 'export', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 
  'for', 'while', 'switch', 'case', 'default', 'break', 'continue', 'true', 'false', 
  'null', 'undefined', 'new', 'this', 'class', 'extends', 'interface', 'type', 'from',
  'React', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext',
  'console', 'log', 'error', 'warn', 'window', 'document', 'localStorage', 'JSON',
  'map', 'filter', 'reduce', 'forEach', 'find', 'includes', 'push', 'pop', 'length',
  'div', 'span', 'button', 'input', 'form', 'img', 'a', 'p', 'h1', 'h2', 'ul', 'li',
  'className', 'style', 'onClick', 'onChange', 'value', 'key', 'children'
];

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ code, onChange, fileName, config, onCodeAction }, ref) => {
  const lines = code.split('\n');
  const [showMinimap, setShowMinimap] = useState(true);
  
  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0 });
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // Code Action State
  const [showCodeActions, setShowCodeActions] = useState(false);
  const [selectionCoords, setSelectionCoords] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumsRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  // Forward internal ref methods to parent
  useImperativeHandle(ref, () => ({
    scrollToLine: (line: number) => {
      if (textareaRef.current) {
        const lineHeight = 24; // leading-6 is 1.5rem = 24px
        const top = (line - 1) * lineHeight;
        textareaRef.current.scrollTop = top - 100; // scroll with some padding
        setHighlightedLine(line);
        setTimeout(() => setHighlightedLine(null), 2000);
      }
    },
    focus: () => {
      textareaRef.current?.focus();
    }
  }));

  // Determine file extension for basic label
  const ext = fileName.split('.').pop() || 'TXT';
  const langColor = ext === 'tsx' || ext === 'ts' ? 'text-blue-400' : ext === 'css' ? 'text-cyan-400' : ext === 'json' ? 'text-yellow-400' : 'text-gray-400';
  
  // Config defaults
  const fontSize = config?.fontSize || '14px';
  const isVim = config?.vimMode || false;
  const tabSizeVal = config?.tabSize === '4 Spaces' ? 4 : config?.tabSize === 'Tabs' ? 4 : 2;

  // Simple Regex Syntax Highlighter
  const highlightCode = (input: string) => {
    if (!input) return '';
    
    // Escaping HTML entities
    let text = input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Syntax Rules (Order matters)
    return text.split(/([a-zA-Z0-9_$]+|['"`].*?['"`]|\/\/.*|\s+|[{}()[\]<>=!+\-*/.,:;])/g).map((token, i) => {
        if (!token) return null;
        if (token.startsWith('//')) return <span key={i} className="text-gray-500">{token}</span>;
        if (token.match(/^['"`]/)) return <span key={i} className="text-green-400">{token}</span>;
        if (token.match(/^\d+$/)) return <span key={i} className="text-orange-400">{token}</span>;
        if (['import','export','const','let','var','function','return','if','else','for','while','switch','case','default','break','continue','true','false','null','undefined','new','this','class','extends','interface','type','from','default'].includes(token)) return <span key={i} className="text-purple-400 italic">{token}</span>;
        if (['React','useState','useEffect','useRef','useMemo','useCallback','console','window','document','localStorage','JSON','Math','Date'].includes(token)) return <span key={i} className="text-yellow-200">{token}</span>;
        if (token.match(/^[A-Z][a-zA-Z0-9]*$/)) return <span key={i} className="text-blue-300">{token}</span>; // Component-like
        if (['{','}','(',')','[',']'].includes(token)) return <span key={i} className="text-yellow-600">{token}</span>;
        return token;
    });
  };

  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      if (preRef.current) {
        preRef.current.scrollTop = scrollTop;
        preRef.current.scrollLeft = scrollLeft;
      }
      if (lineNumsRef.current) {
        lineNumsRef.current.scrollTop = scrollTop;
      }
      // Hide actions on scroll
      setShowCodeActions(false);
    }
  };

  // Helper to update cursor position for autocomplete dropdown & code actions
  const updateCaretPosition = (position: number, forSelection = false) => {
     if (!textareaRef.current || !mirrorRef.current) return;
     
     const text = textareaRef.current.value.substring(0, position);
     mirrorRef.current.textContent = text;
     
     const span = document.createElement('span');
     span.textContent = '.';
     mirrorRef.current.appendChild(span);
     
     const rect = span.getBoundingClientRect();
     const editorRect = textareaRef.current.getBoundingClientRect();
     
     const top = rect.top - editorRect.top;
     const left = rect.left - editorRect.left;

     if (forSelection) {
         // Position near the end of selection
         setSelectionCoords({ top: top + 20, left: left + 10 });
     } else {
         // Position for autocomplete
         setCursorPos({ top: top + 20, left });
     }
  };

  const insertSuggestion = (suggestion: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart, value } = textarea;
      // Find start of current word
      let start = selectionStart - 1;
      while (start >= 0 && /[a-zA-Z0-9_$]/.test(value[start])) {
          start--;
      }
      start++; // move back to first char of word

      const newValue = value.substring(0, start) + suggestion + value.substring(selectionStart);
      onChange(newValue);
      setShowSuggestions(false);
      
      setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + suggestion.length;
          textarea.focus();
      }, 0);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;
      
      if (selectionEnd > selectionStart) {
          const selected = value.substring(selectionStart, selectionEnd);
          if (selected.trim().length > 0) {
              setSelectedText(selected);
              updateCaretPosition(selectionEnd, true);
              setShowCodeActions(true);
              return;
          }
      }
      setShowCodeActions(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      onChange(val);
      setShowCodeActions(false);
      
      const { selectionStart } = e.target;
      
      // Check for autocomplete trigger
      let start = selectionStart - 1;
      while (start >= 0 && /[a-zA-Z0-9_$]/.test(val[start])) {
          start--;
      }
      const currentWord = val.substring(start + 1, selectionStart);

      if (currentWord.length >= 2) {
          const matches = KEYWORDS.filter(k => k.toLowerCase().startsWith(currentWord.toLowerCase()));
          if (matches.length > 0) {
              setSuggestions(matches);
              setSuggestionIndex(0);
              setShowSuggestions(true);
              updateCaretPosition(selectionStart);
          } else {
              setShowSuggestions(false);
          }
      } else {
          setShowSuggestions(false);
      }
  };

  // Smart Typing Logic
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    // Autocomplete Navigation
    if (showSuggestions) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSuggestionIndex(prev => (prev + 1) % suggestions.length);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insertSuggestion(suggestions[suggestionIndex]);
            return;
        }
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            return;
        }
    }

    // 1. Handle Tab (Insert spaces instead of focus change)
    if (e.key === 'Tab') {
        e.preventDefault();
        const spaces = ' '.repeat(tabSizeVal);
        const newValue = value.substring(0, selectionStart) + spaces + value.substring(selectionEnd);
        onChange(newValue);
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + tabSizeVal;
        }, 0);
    }

    // 2. Handle Enter (Auto-indent)
    if (e.key === 'Enter') {
        e.preventDefault();
        const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const currentLine = value.substring(currentLineStart, selectionStart);
        const match = currentLine.match(/^\s*/);
        const currentIndent = match ? match[0] : '';
        
        const trimmedPrev = currentLine.trim();
        const needsExtra = trimmedPrev.endsWith('{') || trimmedPrev.endsWith('(') || trimmedPrev.endsWith('[');
        const extraIndent = needsExtra ? ' '.repeat(tabSizeVal) : '';
        
        const insertion = `\n${currentIndent}${extraIndent}`;
        
        const nextChar = value[selectionStart];
        const isBetweenBraces = trimmedPrev.endsWith('{') && nextChar === '}';
        const closingInsertion = isBetweenBraces ? `\n${currentIndent}` : '';

        const newValue = value.substring(0, selectionStart) + insertion + closingInsertion + value.substring(selectionEnd);
        onChange(newValue);
        
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + insertion.length;
            // Refresh caret pos/suggestions on Enter usually clears them, so explicit hide
            setShowSuggestions(false); 
        }, 0);
    }

    // 3. Handle Bracket Closing
    const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']', '"': '"', "'": "'" };
    if (pairs[e.key]) {
        e.preventDefault();
        const newValue = value.substring(0, selectionStart) + e.key + pairs[e.key] + value.substring(selectionEnd);
        onChange(newValue);
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
        }, 0);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-300 font-mono relative" style={{ fontSize: fontSize }}>
      {/* Hidden Mirror for Caret Positioning */}
      <div 
         ref={mirrorRef}
         className="absolute top-0 left-0 visibility-hidden pointer-events-none whitespace-pre-wrap break-words"
         style={{ 
             fontSize, 
             fontFamily: 'monospace', 
             padding: '16px', // Match textarea padding
             width: textareaRef.current?.clientWidth || 'auto',
             opacity: 0,
             zIndex: -1000
         }}
      ></div>

      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shadow-sm relative z-10">
        <div className="flex items-center gap-3">
           <div className={`text-xs font-bold uppercase tracking-wider ${langColor}`}>{ext}</div>
           <div className="h-4 w-px bg-gray-700"></div>
           <span className="text-sm font-medium text-gray-200 tracking-tight">{fileName}</span>
        </div>
        <div className="flex items-center gap-2">
          {isVim && <div className="px-2 py-0.5 bg-green-900/30 text-green-400 text-[10px] uppercase font-bold border border-green-900 rounded">VIM NORMAL</div>}
          <button 
             onClick={() => setShowMinimap(!showMinimap)}
             className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded transition-colors ${showMinimap ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
             Minimap
          </button>
          <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">UTF-8</div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider ml-1">Tab: {tabSizeVal}</div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex flex-1 overflow-hidden relative group">
        {/* Line Numbers with Git Gutter */}
        <div 
          ref={lineNumsRef}
          className="w-12 flex-shrink-0 bg-gray-900 border-r border-gray-800 text-right pr-3 pt-4 text-gray-600 select-none overflow-hidden font-mono text-xs opacity-60 relative"
        >
          {lines.map((_, i) => (
            <div key={i} className={`leading-6 relative ${highlightedLine === i + 1 ? 'text-yellow-400 font-bold bg-yellow-900/20' : ''}`}>
               {/* Simulated Git Diff Indicator */}
               {i % 12 === 0 && i > 0 ? <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div> : null}
               {i === 3 ? <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div> : null}
               {i + 1}
            </div>
          ))}
        </div>

        {/* Editor Container */}
        <div className="flex-1 relative overflow-hidden bg-gray-900/50">
             {/* Highlight Line Background */}
             {highlightedLine && (
               <div 
                 className="absolute left-0 right-0 bg-yellow-500/10 pointer-events-none z-0 transition-opacity duration-500"
                 style={{ top: (highlightedLine - 1) * 24 + 16, height: '24px' }} 
               ></div>
             )}

             {/* Highlight Overlay */}
             <pre 
                ref={preRef}
                aria-hidden="true"
                className="absolute inset-0 p-4 pt-4 m-0 leading-6 font-mono whitespace-pre pointer-events-none text-gray-300 overflow-auto scrollbar-none"
                style={{ fontSize, tabSize: tabSizeVal }}
             >
                {highlightCode(code)}
                <br /> {/* Ensure last line visible */}
             </pre>

            {/* Input Area */}
            <textarea
              ref={textareaRef}
              className={`absolute inset-0 w-full h-full bg-transparent text-transparent caret-white p-4 pt-4 leading-6 outline-none resize-none whitespace-pre font-mono ${isVim ? 'cursor-block' : ''} z-10`}
              style={{ fontSize, tabSize: tabSizeVal }}
              value={code}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              onSelect={handleSelect}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />

            {/* Code Actions Widget */}
            {showCodeActions && (
              <div 
                 className="absolute z-50 animate-in zoom-in duration-200"
                 style={{ top: selectionCoords.top, left: selectionCoords.left }}
              >
                <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1">
                   <button 
                      onClick={() => { onCodeAction?.('Explain', selectedText); setShowCodeActions(false); }}
                      className="p-1.5 hover:bg-primary-600 text-gray-300 hover:text-white rounded transition-colors" 
                      title="Explain Code"
                   >
                     <MessageSquare size={14} />
                   </button>
                   <button 
                      onClick={() => { onCodeAction?.('Refactor', selectedText); setShowCodeActions(false); }}
                      className="p-1.5 hover:bg-purple-600 text-gray-300 hover:text-white rounded transition-colors"
                      title="Refactor"
                   >
                     <Hammer size={14} />
                   </button>
                   <button 
                      onClick={() => { onCodeAction?.('Fix', selectedText); setShowCodeActions(false); }}
                      className="p-1.5 hover:bg-yellow-600 text-gray-300 hover:text-white rounded transition-colors"
                      title="Fix Issues"
                   >
                     <Zap size={14} />
                   </button>
                   <div className="w-px bg-gray-700 mx-1"></div>
                   <div className="flex items-center px-1">
                     <Sparkles size={12} className="text-primary-400 animate-pulse" />
                   </div>
                </div>
              </div>
            )}

            {/* Autocomplete Dropdown */}
            {showSuggestions && (
                <div 
                   className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden w-48 max-h-40 overflow-y-auto"
                   style={{ top: cursorPos.top, left: cursorPos.left }}
                >
                   {suggestions.map((s, i) => (
                       <div 
                          key={s}
                          onClick={() => insertSuggestion(s)}
                          className={`px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 ${i === suggestionIndex ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                       >
                           <span className="opacity-50 font-bold text-[10px]">abc</span>
                           {s}
                       </div>
                   ))}
                </div>
            )}
        </div>
        
        {/* Minimap Visualizer */}
        {showMinimap && (
            <div className="w-24 border-l border-gray-800 bg-gray-900/80 overflow-hidden select-none pointer-events-none hidden sm:block">
                <div className="w-full text-[2px] leading-[4px] text-gray-500 p-1 opacity-50 whitespace-pre break-all">
                    {code}
                </div>
            </div>
        )}
      </div>
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';
