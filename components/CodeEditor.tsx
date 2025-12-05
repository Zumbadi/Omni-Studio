
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle, memo, useMemo } from 'react';
import { Sparkles, MessageSquare, Zap, Wrench, Loader2, ChevronRight, Eye, GitCommit, Play, XCircle, AlertTriangle, AlertCircle, Info, EyeOff, ShieldAlert, FileWarning } from 'lucide-react';
import { highlightCode } from '../utils/syntaxHighlight';

export interface CodeEditorHandle {
  scrollToLine: (line: number) => void;
  focus: () => void;
  insertAtCursor: (text: string) => void;
}

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  fileName: string;
  filePath?: string;
  config?: {
    fontSize?: string;
    tabSize?: string;
    vimMode?: boolean;
  };
  onCodeAction?: (action: string, selectedCode: string) => void;
  onSelectionChange?: (selectedText: string) => void;
  breakpoints?: number[];
  onToggleBreakpoint?: (line: number) => void;
  onGhostTextRequest?: (prefix: string, suffix: string) => Promise<string>;
  onSave?: () => void;
  onCursorChange?: (line: number, col: number) => void;
  onDrop?: (e: React.DragEvent, cursorPos: number) => void;
  readOnly?: boolean;
  interpreterEnabled?: boolean;
  onInterpreterOutput?: (output: string[]) => void;
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

interface LiveDecoration {
    line: number;
    message: string;
    type: 'error' | 'warning' | 'info';
}

export const CodeEditor = memo(forwardRef<CodeEditorHandle, CodeEditorProps>(({ 
  code, onChange, fileName, filePath, config, onCodeAction, onSelectionChange, 
  breakpoints = [], onToggleBreakpoint, onGhostTextRequest, onSave, onCursorChange, onDrop, readOnly = false,
  interpreterEnabled = false, onInterpreterOutput
}, ref) => {
  const lines = code.split('\n');
  const [showMinimap, setShowMinimap] = useState(true);
  
  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPos, setCursorPos] = useState({ top: 0, left: 0 });
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  // Ghost Text State
  const [ghostText, setGhostText] = useState('');
  const [ghostPos, setGhostPos] = useState({ top: 0, left: 0 });
  const [isLoadingGhost, setIsLoadingGhost] = useState(false);
  const typingTimeoutRef = useRef<any>(null);

  // Code Action State
  const [showCodeActions, setShowCodeActions] = useState(false);
  const [selectionCoords, setSelectionCoords] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');

  // Interpreter State
  const [interpreterLogs, setInterpreterLogs] = useState<string[]>([]);
  const [liveDecorations, setLiveDecorations] = useState<LiveDecoration[]>([]);
  const [showLivePanel, setShowLivePanel] = useState(true);
  const interpreterTimeoutRef = useRef<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumsRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const decorationRef = useRef<HTMLDivElement>(null);
  
  // Scroll Sync Ref for Performance
  const rafRef = useRef<number | null>(null);

  // Memoize highlighted content
  const highlightedContent = useMemo(() => highlightCode(code), [code]);

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
    },
    insertAtCursor: (text: string) => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const newValue = code.substring(0, start) + text + code.substring(end);
            onChange(newValue);
            setTimeout(() => {
                if(textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length;
                    textareaRef.current.focus();
                }
            }, 0);
        }
    }
  }));

  // Run interpreter on code change
  useEffect(() => {
      if (interpreterEnabled && !readOnly) {
          if (interpreterTimeoutRef.current) clearTimeout(interpreterTimeoutRef.current);
          interpreterTimeoutRef.current = setTimeout(() => {
              runLiveInterpreter(code);
          }, 600); // 600ms debounce for responsiveness
      } else {
          setInterpreterLogs([]);
          setLiveDecorations([]);
      }
      return () => { if (interpreterTimeoutRef.current) clearTimeout(interpreterTimeoutRef.current); };
  }, [code, interpreterEnabled, readOnly]);

  const runLiveInterpreter = (sourceCode: string) => {
      // Ephemeral logs: We rebuild the log state from scratch every run to represent "Current State"
      const logs: string[] = [];
      const decorations: LiveDecoration[] = [];
      
      logs.push(`[Critique] Analyzing ${fileName}...`);

      // 1. Static Analysis (Smell Detection & Linter Logic)
      const lines = sourceCode.split('\n');
      lines.forEach((line, idx) => {
          const trimmed = line.trim();
          
          // Legacy JS checks
          if (line.includes('var ')) {
              decorations.push({ line: idx, message: "Use 'let' or 'const'", type: 'warning' });
              logs.push(`[Line ${idx + 1}] Warning: 'var' usage is discouraged in ES6+.`);
          }
          
          // Type safety
          if (line.includes(': any')) {
              decorations.push({ line: idx, message: "Avoid 'any' type", type: 'warning' });
              logs.push(`[Line ${idx + 1}] Weak Type: Explicit 'any' detected.`);
          }
          
          // Debugging leftovers
          if (line.includes('console.log')) {
              decorations.push({ line: idx, message: "Console log", type: 'info' });
          }
          if (line.includes('TODO') || line.includes('FIXME')) {
              decorations.push({ line: idx, message: "Pending Task", type: 'info' });
              logs.push(`[Line ${idx + 1}] Note: Pending task found.`);
          }

          // React Antipatterns
          if (trimmed.startsWith('useEffect') && !line.includes('[')) {
             decorations.push({ line: idx, message: "Missing dependency array?", type: 'error' });
             logs.push(`[Line ${idx + 1}] Risk: useEffect missing dependency array (runs on every render).`);
          }
          
          if (line.includes('dangerouslySetInnerHTML')) {
             decorations.push({ line: idx, message: "XSS Vulnerability Risk", type: 'error' });
             logs.push(`[Line ${idx + 1}] Security: dangerouslySetInnerHTML used.`);
          }

          if (line.includes('style={{')) {
             decorations.push({ line: idx, message: "Inline styles (perf)", type: 'info' });
          }
          
          // Logic Errors
          if (trimmed.startsWith('if') && trimmed.includes('=') && !trimmed.includes('==') && !trimmed.includes('!=')) {
             // Basic check for assignment in condition (if (x = 5))
             const conditionContent = trimmed.substring(trimmed.indexOf('(') + 1, trimmed.lastIndexOf(')'));
             if (conditionContent.includes('=') && !conditionContent.includes('==') && !conditionContent.includes('>') && !conditionContent.includes('<')) {
                 decorations.push({ line: idx, message: "Assignment in condition?", type: 'error' });
                 logs.push(`[Line ${idx + 1}] Error: Possible assignment in conditional statement.`);
             }
          }
      });

      const mockConsole = {
          log: (...args: any[]) => logs.push(`[Runtime] ${args.map(a => String(a)).join(' ')}`),
          warn: (...args: any[]) => logs.push(`[Runtime Warn] ${args.map(a => String(a)).join(' ')}`),
          error: (...args: any[]) => logs.push(`[Runtime Error] ${args.map(a => String(a)).join(' ')}`),
      };

      try {
          // 2. Runtime Evaluation (Limited)
          // We strip imports/exports/types to make it runnable as a script body for basic logic testing
          const runnableCode = sourceCode
              .replace(/import\s+.*?from\s+['"].*?['"];?/g, '')
              .replace(/export\s+default\s+/g, '')
              .replace(/export\s+/g, '')
              .replace(/interface\s+\w+\s*{[^}]*}/g, '')
              .replace(/type\s+\w+\s*=.*/g, '');

          // Wrap in a function to capture console and avoid global pollution
          // eslint-disable-next-line no-new-func
          const func = new Function('console', `
              try {
                  ${runnableCode}
              } catch (e) {
                  throw e;
              }
          `);
          
          // Only execute if it looks like safe JS/TS logic (simple heuristic)
          // Avoid executing React components directly as they expect DOM/React env
          if (!sourceCode.includes('return <') && !sourceCode.includes('useContext')) {
             func(mockConsole);
             if (!logs.some(l => l.includes('[Runtime]'))) {
                 logs.push("[Success] Syntax check passed.");
             }
          } else {
             logs.push("[Info] React Component detected. Runtime check skipped (Static analysis only).");
          }

      } catch (e: any) {
          logs.push(`[Runtime Exception] ${e.message}`);
          // Attempt to map error to last line or specific line if possible
          decorations.push({ line: lines.length - 1, message: `Exception: ${e.message}`, type: 'error' });
      }

      setLiveDecorations(decorations);
      setInterpreterLogs(logs);
      if (onInterpreterOutput) onInterpreterOutput(logs);
  };

  // Determine file extension for basic label
  const ext = fileName.split('.').pop() || 'TXT';
  const langColor = ext === 'tsx' || ext === 'ts' ? 'text-blue-400' : ext === 'css' ? 'text-cyan-400' : ext === 'json' ? 'text-yellow-400' : 'text-gray-400';
  
  // Config defaults
  const fontSize = config?.fontSize || '14px';
  const isVim = config?.vimMode || false;
  const tabSizeVal = config?.tabSize === '4 Spaces' ? 4 : config?.tabSize === 'Tabs' ? 4 : 2;

  const breadcrumbs = filePath ? filePath.split('/') : [fileName];

  // Optimized Scroll Handler using RequestAnimationFrame for 60fps performance
  const handleScroll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
        if (textareaRef.current) {
          const { scrollTop, scrollLeft, scrollHeight, clientHeight } = textareaRef.current;
          
          if (preRef.current) {
            preRef.current.scrollTop = scrollTop;
            preRef.current.scrollLeft = scrollLeft;
          }
          
          if (lineNumsRef.current) {
            lineNumsRef.current.scrollTop = scrollTop;
          }

          if (lensRef.current) {
            lensRef.current.scrollTop = scrollTop;
            lensRef.current.scrollLeft = scrollLeft;
          }

          if (decorationRef.current) {
            decorationRef.current.scrollTop = scrollTop;
            decorationRef.current.scrollLeft = scrollLeft;
          }
          
          // Sync Minimap Scroll
          if (minimapRef.current) {
              const percent = scrollTop / (scrollHeight - clientHeight);
              const mapScrollHeight = minimapRef.current.scrollHeight - minimapRef.current.clientHeight;
              minimapRef.current.scrollTop = percent * mapScrollHeight;
          }
          
          // Hide actions on scroll to prevent drift
          if (showCodeActions) setShowCodeActions(false);
        }
    });
  };

  const handleMinimapClick = (e: React.MouseEvent) => {
      if (!minimapRef.current || !textareaRef.current) return;
      const rect = minimapRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top; // Click position in minimap
      const percent = y / rect.height;
      
      const targetScroll = percent * textareaRef.current.scrollHeight;
      textareaRef.current.scrollTop = targetScroll;
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
     
     // Calculate relative position within the scrolling container
     const scrollTop = textareaRef.current.scrollTop;
     const scrollLeft = textareaRef.current.scrollLeft;

     const top = rect.top - editorRect.top + scrollTop;
     const left = rect.left - editorRect.left + scrollLeft;

     if (forSelection) {
         setSelectionCoords({ top: top + 20, left: left + 10 });
     } else {
         setCursorPos({ top: top + 20, left });
         setGhostPos({ top: top + 16, left }); 
     }
  };

  const calculateCursorStats = (val: string, pos: number) => {
      const lines = val.substring(0, pos).split('\n');
      const line = lines.length;
      const col = lines[lines.length - 1].length + 1;
      if (onCursorChange) onCursorChange(line, col);
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
          calculateCursorStats(newValue, textarea.selectionStart);
      }, 0);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd, value } = textarea;
      
      calculateCursorStats(value, selectionStart);

      if (selectionEnd > selectionStart) {
          const selected = value.substring(selectionStart, selectionEnd);
          if (selected.trim().length > 0) {
              setSelectedText(selected);
              updateCaretPosition(selectionEnd, true);
              setShowCodeActions(true);
              if (onSelectionChange) onSelectionChange(selected);
              return;
          }
      }
      setShowCodeActions(false);
      if (onSelectionChange) onSelectionChange('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      onChange(val);
      setShowCodeActions(false);
      setGhostText('');
      
      const { selectionStart } = e.target;
      calculateCursorStats(val, selectionStart);
      
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

      // Ghost Text Logic
      if (onGhostTextRequest && !showSuggestions && !readOnly) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(async () => {
              const prefix = val.substring(0, selectionStart);
              const suffix = val.substring(selectionStart);
              const lastLine = prefix.split('\n').pop() || '';
              if (lastLine.trim().length > 3) {
                  setIsLoadingGhost(true);
                  updateCaretPosition(selectionStart);
                  const completion = await onGhostTextRequest(prefix, suffix);
                  if (completion) {
                      setGhostText(completion);
                  }
                  setIsLoadingGhost(false);
              }
          }, 600);
      }
  };

  const handleTextAreaDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
      if (onDrop && !readOnly) {
          e.preventDefault();
          const textarea = e.currentTarget;
          const { selectionStart } = textarea;
          onDrop(e, selectionStart);
      }
  };

  // Smart Typing Logic
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    // Save Shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        onSave?.();
        return;
    }
    
    // Move Line Up (Alt + ArrowUp)
    if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        const currentLineIndex = value.substring(0, selectionStart).split('\n').length - 1;
        if (currentLineIndex > 0) {
            const lines = value.split('\n');
            const temp = lines[currentLineIndex];
            lines[currentLineIndex] = lines[currentLineIndex - 1];
            lines[currentLineIndex - 1] = temp;
            const newValue = lines.join('\n');
            onChange(newValue);
            const newPos = lines.slice(0, currentLineIndex - 1).join('\n').length + 1 + (selectionStart - value.lastIndexOf('\n', selectionStart - 1));
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = newPos;
            }, 0);
        }
        return;
    }

    // Move Line Down (Alt + ArrowDown)
    if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        const lines = value.split('\n');
        const currentLineIndex = value.substring(0, selectionStart).split('\n').length - 1;
        if (currentLineIndex < lines.length - 1) {
            const temp = lines[currentLineIndex];
            lines[currentLineIndex] = lines[currentLineIndex + 1];
            lines[currentLineIndex + 1] = temp;
            const newValue = lines.join('\n');
            onChange(newValue);
            const newPos = lines.slice(0, currentLineIndex + 1).join('\n').length + 1 + (selectionStart - value.lastIndexOf('\n', selectionStart - 1));
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = newPos;
            }, 0);
        }
        return;
    }

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

    // Ghost Text Acceptance
    if (ghostText && e.key === 'Tab') {
        e.preventDefault();
        const newValue = value.substring(0, selectionStart) + ghostText + value.substring(selectionEnd);
        onChange(newValue);
        setGhostText('');
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + ghostText.length;
            calculateCursorStats(newValue, textarea.selectionStart);
        }, 0);
        return;
    } else if (ghostText) {
        setGhostText('');
    }

    // 1. Handle Tab
    if (e.key === 'Tab') {
        e.preventDefault();
        const spaces = ' '.repeat(tabSizeVal);
        const newValue = value.substring(0, selectionStart) + spaces + value.substring(selectionEnd);
        onChange(newValue);
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + tabSizeVal;
            calculateCursorStats(newValue, textarea.selectionStart);
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
            setShowSuggestions(false);
            calculateCursorStats(newValue, textarea.selectionStart);
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
            calculateCursorStats(newValue, textarea.selectionStart);
        }, 0);
    }
  };

  // Generate CodeLens Overlay
  const renderCodeLens = () => {
      const lenses: {line: number, text: string}[] = [];
      const regex = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|const|let|var)\s+([a-zA-Z0-9_]+)/;
      
      lines.forEach((line, i) => {
          const match = line.trim().match(regex);
          if (match) {
              const type = match[1];
              const name = match[2];
              if (type === 'const' && !line.includes('=>') && !line.includes('require')) return; // Skip simple consts unless arrow func
              
              // Seed random stats based on name char code sum
              const seed = name.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
              const refs = Math.floor((seed % 10) + 1);
              const author = seed % 2 === 0 ? 'Omni' : 'User';
              
              lenses.push({
                  line: i,
                  text: `${refs} references | Author: ${author}`
              });
          }
      });

      return lenses.map((lens, i) => (
          <div 
            key={i} 
            className="absolute right-4 text-[10px] text-gray-500/60 font-sans pointer-events-none select-none flex items-center gap-1"
            style={{ top: `${lens.line * 24}px`, height: '24px' }}
          >
              <Eye size={10} className="opacity-50"/> {lens.text}
          </div>
      ));
  };

  const renderDecorations = () => {
      return liveDecorations.map((deco, i) => {
          const color = deco.type === 'error' ? 'red' : deco.type === 'warning' ? 'yellow' : 'blue';
          return (
              <div 
                key={i}
                className="absolute left-0 right-0 pointer-events-none group"
                style={{ top: `${deco.line * 24}px`, height: '24px' }}
              >
                  <div className={`w-full h-full border-b-2 border-dotted border-${color}-500/50 absolute bottom-0`}></div>
                  {/* Tooltip on Hover */}
                  <div className={`absolute right-4 top-0 text-[10px] bg-${color}-900/90 text-${color}-200 px-2 py-0.5 rounded shadow-lg border border-${color}-500/30 transform translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all z-50 whitespace-nowrap`}>
                      <span className="font-bold uppercase tracking-wider">{deco.type}:</span> {deco.message}
                  </div>
              </div>
          );
      });
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
             padding: '16px',
             width: textareaRef.current?.clientWidth || 'auto',
             opacity: 0,
             zIndex: -1000,
             lineHeight: '24px'
         }}
      ></div>

      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shadow-sm relative z-10 select-none">
        <div className="flex items-center gap-3">
           <div className={`text-[10px] font-black uppercase tracking-widest ${langColor}`}>{ext}</div>
           <div className="h-4 w-px bg-gray-700/50"></div>
           {/* Breadcrumbs */}
           <div className="flex items-center text-xs font-medium text-gray-400 tracking-tight">
               {breadcrumbs.map((part, i) => (
                   <div key={i} className="flex items-center">
                       {i > 0 && <ChevronRight size={10} className="mx-1 opacity-50"/>}
                       <span className={i === breadcrumbs.length - 1 ? 'text-gray-200' : 'text-gray-500'}>{part}</span>
                   </div>
               ))}
           </div>
           {readOnly && <span className="text-[9px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded border border-red-900/50 font-bold tracking-wider">READ ONLY</span>}
        </div>
        <div className="flex items-center gap-2">
          {isLoadingGhost && <div className="flex items-center gap-1 text-[10px] text-primary-400 animate-pulse font-bold tracking-wider"><Sparkles size={10}/> AI THINKING...</div>}
          
          {/* Live Toggle */}
          {interpreterEnabled && (
              <button 
                onClick={() => setShowLivePanel(!showLivePanel)}
                className={`flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border transition-all ${showLivePanel ? 'bg-purple-900/20 text-purple-400 border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.2)]' : 'bg-gray-800 text-gray-500 border-gray-700 hover:text-purple-400'}`}
                title="Toggle Live Critique Panel"
              >
                  {showLivePanel ? <Eye size={10}/> : <EyeOff size={10}/>} CRITIQUE
              </button>
          )}

          {isVim && <div className="px-2 py-0.5 bg-green-900/30 text-green-400 text-[9px] uppercase font-bold border border-green-900 rounded">VIM</div>}
          <button 
             onClick={() => setShowMinimap(!showMinimap)}
             className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded transition-colors hidden sm:block ${showMinimap ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-400'}`}
          >
             Map
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50"></div>
          <div className="text-[9px] text-gray-600 uppercase font-bold tracking-wider hidden sm:block">UTF-8</div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex flex-1 overflow-hidden relative group">
        {/* Line Numbers */}
        <div 
          ref={lineNumsRef}
          className="w-12 flex-shrink-0 bg-gray-900/50 border-r border-gray-800 text-right pr-3 pt-4 text-gray-600 select-none overflow-hidden font-mono text-xs opacity-60 relative cursor-default"
        >
          {lines.map((_, i) => {
            const lineNum = i + 1;
            const hasBreakpoint = breakpoints.includes(lineNum);
            // Check for decoration on this line
            const decoration = liveDecorations.find(d => d.line === i);
            
            return (
              <div 
                key={i} 
                className={`leading-6 relative hover:text-white cursor-pointer transition-colors flex justify-end gap-1 ${highlightedLine === lineNum ? 'text-yellow-400 font-bold bg-yellow-900/10' : ''}`}
                onClick={() => onToggleBreakpoint?.(lineNum)}
              >
                 {hasBreakpoint && <div className="absolute left-1 top-1.5 w-2.5 h-2.5 bg-red-500 rounded-full shadow-red-500/50 shadow-lg z-20 animate-pulse"></div>}
                 
                 {decoration && (
                     <div className={`mr-1 mt-1 ${decoration.type === 'error' ? 'text-red-500' : decoration.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'}`}>
                         {decoration.type === 'error' ? <XCircle size={8}/> : decoration.type === 'warning' ? <AlertTriangle size={8}/> : <Info size={8}/>}
                     </div>
                 )}
                 <span className={hasBreakpoint ? 'invisible' : ''}>{lineNum}</span>
              </div>
            );
          })}
        </div>

        {/* Editor Container */}
        <div className="flex-1 relative overflow-hidden bg-gray-900/30">
             {highlightedLine && (
               <div 
                 className="absolute left-0 right-0 bg-yellow-500/5 pointer-events-none z-0 transition-opacity duration-500"
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
                {highlightedContent}
                <br />
             </pre>

             {/* Live Decorations Overlay */}
             <div 
                ref={decorationRef}
                className="absolute inset-0 p-4 pt-4 m-0 leading-6 font-mono whitespace-pre pointer-events-none overflow-hidden scrollbar-none"
                style={{ fontSize }}
             >
                 {renderDecorations()}
             </div>

             {/* CodeLens Overlay */}
             <div 
                ref={lensRef}
                className="absolute inset-0 p-4 pt-4 m-0 leading-6 font-mono whitespace-pre pointer-events-none overflow-hidden scrollbar-none"
                style={{ fontSize }}
             >
                 {renderCodeLens()}
             </div>

            {/* Ghost Text */}
            {ghostText && (
                <div 
                    className="absolute z-20 pointer-events-none text-gray-500 font-mono leading-6 italic whitespace-pre animate-pulse"
                    style={{ 
                        top: ghostPos.top, 
                        left: ghostPos.left,
                        fontSize,
                        opacity: 0.6 
                    }}
                >
                    {ghostText} <span className="text-[9px] not-italic bg-gray-800 px-1 rounded ml-2 border border-gray-700 text-gray-400 font-bold uppercase tracking-wide">Tab</span>
                </div>
            )}

            {/* Input Area */}
            <textarea
              ref={textareaRef}
              readOnly={readOnly}
              className={`absolute inset-0 w-full h-full bg-transparent text-transparent caret-white p-4 pt-4 leading-6 outline-none resize-none whitespace-pre font-mono ${isVim ? 'cursor-block' : ''} z-10 ${readOnly ? 'cursor-not-allowed opacity-50' : ''}`}
              style={{ fontSize, tabSize: tabSizeVal }}
              value={code}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onScroll={handleScroll}
              onSelect={handleSelect}
              onDrop={handleTextAreaDrop}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />

            {/* Code Actions */}
            {showCodeActions && !readOnly && (
              <div 
                 className="absolute z-50 animate-in zoom-in duration-200"
                 style={{ top: selectionCoords.top, left: selectionCoords.left }}
              >
                <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-1 backdrop-blur-md">
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
                     <Wrench size={14} />
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

            {/* Autocomplete */}
            {showSuggestions && !readOnly && (
                <div 
                   className="absolute z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden w-48 max-h-40 overflow-y-auto animate-in slide-in-from-top-1 fade-in duration-100"
                   style={{ top: cursorPos.top, left: cursorPos.left }}
                >
                   {suggestions.map((s, i) => (
                       <div 
                          key={s}
                          onClick={() => insertSuggestion(s)}
                          className={`px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 font-mono ${i === suggestionIndex ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                       >
                           <span className="opacity-50 font-bold text-[9px] w-4">abc</span>
                           {s}
                       </div>
                   ))}
                </div>
            )}
        </div>
        
        {/* Interpreter Output Panel (Live Critique) - Conditional on showLivePanel */}
        {interpreterEnabled && showLivePanel && (
            <div className="w-1/3 bg-gray-900 border-l border-gray-800 flex flex-col font-mono text-xs overflow-hidden animate-in slide-in-from-right-10 duration-200">
                <div className="bg-gray-850 p-2 border-b border-gray-800 font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center">
                    <span className="flex items-center gap-2"><ShieldAlert size={10} className="text-purple-500"/> Live Critique</span>
                    <span className="text-[9px] text-gray-600 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> Watching</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {interpreterLogs.map((log, i) => (
                        <div key={i} className={`break-all py-0.5 border-b border-gray-800/50 last:border-0 ${log.includes('Error') || log.includes('Exception') || log.includes('Risk') ? 'text-red-400 bg-red-900/10 px-1 rounded' : log.includes('Warning') || log.includes('Weak Type') ? 'text-yellow-400' : log.includes('[Critique]') ? 'text-purple-300 font-bold' : 'text-gray-300'}`}>
                            {log}
                        </div>
                    ))}
                    {interpreterLogs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2 opacity-50">
                            <FileWarning size={24}/>
                            <span>No issues detected.</span>
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {/* Minimap */}
        {showMinimap && (
            <div 
              ref={minimapRef}
              className="w-20 border-l border-gray-800 bg-gray-900/80 overflow-hidden select-none hidden sm:block cursor-pointer relative"
              onClick={handleMinimapClick}
            >
                <div className="w-full text-[2px] leading-[4px] text-gray-500 p-1 opacity-50 whitespace-pre break-all pointer-events-none transition-opacity hover:opacity-80">
                    {code}
                </div>
                <div className="absolute inset-x-0 bg-white/5 pointer-events-none h-16 top-0 border-y border-white/10"></div>
            </div>
        )}
      </div>
    </div>
  );
}));

CodeEditor.displayName = 'CodeEditor';
