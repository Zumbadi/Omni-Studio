
import React from 'react';
import { FileNode } from '../types';
import { getAllFiles } from './fileHelpers';

const bundleCode = (entryCode: string, allFiles: {node: FileNode, path: string}[], depth = 0, visited = new Set<string>(), collectedStyles: string[] = []): string => {
    if (depth > 20) return entryCode; // Recursion limit
    
    let bundled = entryCode;
    
    // 1. Handle CSS Imports
    const cssRegex = /import\s+['"](\..+?\.css)['"];?/g;
    let cssMatch;
    while ((cssMatch = cssRegex.exec(entryCode)) !== null) {
        const importStatement = cssMatch[0];
        const importPath = cssMatch[1];
        const filename = importPath.split('/').pop()?.replace(/['"]/g, '');
        
        const fileEntry = allFiles.find(f => f.node.name === filename);
        if (fileEntry && fileEntry.node.content) {
            collectedStyles.push(fileEntry.node.content);
        }
        bundled = bundled.replace(importStatement, `// ${importStatement} (Injected)`);
    }

    // 2. Handle JS/TS Imports (Named, Default, and Side-effect)
    // Matches: import ... from "..." OR import "..."
    const importRegex = /(import\s+(?:[\w\s{},*]*\s+from\s+)?['"]((\.|@\/).+?)['"];?)/g;
    let match;
    
    // We use a simple approach: find all matches, replace them if we find the file.
    // We need to reset lastIndex if we were using exec in a loop, but with replace or matchAll it's safer.
    // However, to handle recursion order correctly, we iterate.
    
    const matches = [...entryCode.matchAll(importRegex)];
    
    for (const m of matches) {
        const importStatement = m[0];
        const importPath = m[2]; // The path inside quotes
        
        let fileNode: FileNode | undefined;

        if (importPath.startsWith('@/')) {
            const cleanPath = importPath.replace('@/', '');
            // Exact match first
            const exactMatch = allFiles.find(f => f.path === cleanPath || f.path === `${cleanPath}.tsx` || f.path === `${cleanPath}.ts`);
            if (exactMatch) fileNode = exactMatch.node;
            else {
                const filename = cleanPath.split('/').pop();
                fileNode = allFiles.find(f => {
                    const fname = f.node.name.split('.')[0];
                    return fname === filename && (f.node.name.endsWith('.tsx') || f.node.name.endsWith('.ts') || f.node.name.endsWith('.js'));
                })?.node;
            }
        } else {
            // Relative import logic (simplified flat search for this demo)
            const filename = importPath.split('/').pop()?.replace(/['"]/g, '');
            fileNode = allFiles.find(f => {
                const fname = f.node.name.split('.')[0];
                return fname === filename && (f.node.name.endsWith('.tsx') || f.node.name.endsWith('.ts') || f.node.name.endsWith('.js') || f.node.name.endsWith('.jsx'));
            })?.node;
        }

        if (fileNode && fileNode.content && !visited.has(fileNode.id)) {
            visited.add(fileNode.id);
            
            let inlinedContent = bundleCode(fileNode.content, allFiles, depth + 1, visited, collectedStyles);
            
            // Strip imports from the inlined content to prevent duplication/recursion issues
            inlinedContent = inlinedContent
                .replace(/(import\s+(?:[\w\s{},*]*\s+from\s+)?['"]((\.|@\/).+?)['"];?)/g, '')
                .replace(/import\s+['"].*?\.css['"];?/g, '')
                .replace(/export\s+default\s+/g, '') 
                .replace(/export\s+/g, ''); 

            bundled = `${inlinedContent}\n\n${bundled}`;
        }
        bundled = bundled.replace(importStatement, `// ${importStatement} (Inlined)`);
    }
    
    return bundled;
};

export const generatePreviewHtml = (code: string, isNative: boolean, files: FileNode[] = [], activeFilePath?: string, envVars: Record<string, string> = {}) => {
  const isSwift = code.includes('import SwiftUI') || (code.includes('struct') && code.includes('View'));
  const isKotlin = code.includes('import androidx.compose') || code.includes('fun main');
  
  if (isSwift || isKotlin) {
      const lang = isSwift ? 'Swift (iOS)' : 'Kotlin (Android)';
      const color = isSwift ? '#007AFF' : '#3DDC84';
      return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><script src="https://cdn.tailwindcss.com"></script><style>body{margin:0;padding:0;background-color:#000;color:white;font-family:sans-serif;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}.mockup{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at center,#1a1a1a 0%,#000 100%);text-align:center;padding:20px}.icon{font-size:48px;margin-bottom:20px;color:${color}}h1{font-size:24px;margin-bottom:10px}p{color:#888;font-size:14px;max-width:300px;line-height:1.5}.badge{background:#333;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;margin-top:20px;border:1px solid #444}</style></head><body><div class="mockup"><div class="icon">${isSwift ? '' : '🤖'}</div><h1>${lang} Preview</h1><p>Native compilation is required.</p><div class="badge">UI Simulation Mode</div></div></body></html>`;
  }

  const allFiles = getAllFiles(files); 
  const collectedStyles: string[] = [];
  let bundledCode = bundleCode(code, allFiles, 0, new Set(), collectedStyles);
  const styleBlock = collectedStyles.length > 0 ? `<style>${collectedStyles.join('\n')}</style>` : '';

  // Robust 'export default' aliasing to 'App'
  let finalCode = bundledCode;
  
  // 1. Clean up imports
  finalCode = finalCode
    .replace(/import\s+React.*?;/g, '')
    .replace(/import\s+{.*?}\s+from\s+['"]react['"];/g, '')
    .replace(/import\s+{.*?}\s+from\s+['"]react-native['"];/g, '')
    .replace(/import\s+{.*?}\s+from\s+['"]lucide-react['"];/g, '')
    .replace(/import\s+['"].*?\.css['"];?/g, '')
    .replace(/(import\s+(?:[\w\s{},*]*\s+from\s+)?['"]((\.|@\/).+?)['"];?)/g, '');

  let appDefined = false;

  // 2. Identify and alias the default export
  
  // Case A: Named Function: export default function Name() {}
  const namedFuncMatch = finalCode.match(/export\s+default\s+function\s+([a-zA-Z0-9_]+)/);
  if (namedFuncMatch) {
      const name = namedFuncMatch[1];
      finalCode = finalCode.replace(/export\s+default\s+function/, 'function');
      if (name !== 'App') {
          finalCode += `\nconst App = ${name};`;
      }
      appDefined = true;
  }

  // Case B: Named Class: export default class Name {}
  if (!appDefined) {
      const namedClassMatch = finalCode.match(/export\s+default\s+class\s+([a-zA-Z0-9_]+)/);
      if (namedClassMatch) {
          const name = namedClassMatch[1];
          finalCode = finalCode.replace(/export\s+default\s+class/, 'class');
          if (name !== 'App') {
              finalCode += `\nconst App = ${name};`;
          }
          appDefined = true;
      }
  }

  // Case C: Anonymous: export default function() {} or export default () => {}
  if (!appDefined) {
      if (finalCode.match(/export\s+default\s+function\s*\(/)) {
          finalCode = finalCode.replace(/export\s+default\s+function/, 'const App = function');
          appDefined = true;
      } else if (finalCode.match(/export\s+default\s+\(/)) {
          finalCode = finalCode.replace(/export\s+default\s+/, 'const App = ');
          appDefined = true;
      } else if (finalCode.match(/export\s+default\s+class\s*\{/)) {
          finalCode = finalCode.replace(/export\s+default\s+class/, 'const App = class');
          appDefined = true;
      }
  }

  // Case D: Identifier: export default Name;
  if (!appDefined) {
      const idMatch = finalCode.match(/export\s+default\s+([a-zA-Z0-9_]+);?/);
      if (idMatch) {
          const name = idMatch[1];
          // Remove the export line
          finalCode = finalCode.replace(/export\s+default\s+.*?;?/, '');
          if (name !== 'App') {
              finalCode += `\nconst App = ${name};`;
          }
          appDefined = true;
      }
  }

  // 3. Remove any remaining export keywords (safe cleanup for browser script)
  finalCode = finalCode.replace(/^\s*export\s+/gm, '');

  // 4. Asset Resolution (Images/Svgs)
  if (files.length > 0) {
      const pathRegex = /['"](\.{0,2}\/?[^'"]+\.(png|jpg|jpeg|gif|svg))['"]/gi;
      const matches = [...finalCode.matchAll(pathRegex)];
      
      const resolvePath = (relativePath: string, basePath: string): string => {
          if (relativePath.startsWith('/')) return relativePath.substring(1);
          const stack = basePath.split('/');
          stack.pop(); 
          const parts = relativePath.split('/');
          for (const part of parts) {
              if (part === '.') continue;
              if (part === '..') stack.pop();
              else stack.push(part);
          }
          return stack.join('/');
      };

      matches.forEach(match => {
          const originalString = match[1];
          let targetPath = originalString;
          if (activeFilePath) targetPath = resolvePath(originalString, activeFilePath);
          else targetPath = originalString.split('/').pop() || '';

          let fileNode = allFiles.find(f => f.path === targetPath)?.node;
          if (!fileNode) fileNode = allFiles.find(f => f.node.name === originalString.split('/').pop())?.node;
          
          if (fileNode && fileNode.content) {
              let replacement = '';
              if (originalString.match(/\.(png|jpg|jpeg|gif)$/i)) {
                  if (fileNode.content.startsWith('data:')) replacement = fileNode.content;
                  else replacement = `data:image/png;base64,${fileNode.content}`; 
              } else if (originalString.endsWith('.svg')) {
                  if (fileNode.content.startsWith('<svg')) replacement = `data:image/svg+xml;base64,${btoa(fileNode.content)}`;
                  else replacement = fileNode.content;
              }
              if (replacement) finalCode = finalCode.split(originalString).join(replacement);
          }
      });
  }

  const mountScript = `
    const rootEl = document.getElementById('root');
    try {
        if (typeof App !== 'undefined') {
            const root = ReactDOM.createRoot(rootEl);
            root.render(<ErrorBoundary><App /></ErrorBoundary>);
        } else {
            // Fallback for when no export default App is found, check for other components
            const foundComponent = Object.keys(window).find(k => k !== 'App' && typeof window[k] === 'function' && /^[A-Z]/.test(k));
            if (foundComponent) {
                const Comp = window[foundComponent];
                const root = ReactDOM.createRoot(rootEl);
                root.render(<ErrorBoundary><Comp /></ErrorBoundary>);
            } else {
                rootEl.innerHTML = '<div style="color:#ef4444; padding:20px; font-family:monospace;"><h3>Preview Error</h3><p>Entry component "App" not found.</p><p style="font-size:12px; color:#666">Ensure your entry file exports a default component (e.g., <code>export default function App() {}</code>).</p></div>';
            }
        }
    } catch(e) {
        rootEl.innerHTML = '<div style="color:#ef4444; padding:20px;"><h3>Mounting Error</h3><pre>' + e.toString() + '</pre></div>';
    }
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script src="https://unpkg.com/recharts/umd/Recharts.js"></script>
        ${styleBlock}
        <style>
          body { margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          #root { height: 100vh; width: 100%; display: flex; flex-direction: column; }
          ::-webkit-scrollbar { width: 0px; background: transparent; }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script>
          (function() {
            window.process = { env: ${JSON.stringify(envVars)}, version: 'v18.0.0' };
            const originalLog = console.log;
            const originalWarn = console.warn;
            const originalError = console.error;

            function sendToParent(type, args) {
              try {
                const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
                window.parent.postMessage({ type: 'console', level: type, message }, '*');
              } catch (e) {}
            }

            console.log = (...args) => { originalLog(...args); sendToParent('info', args); };
            console.warn = (...args) => { originalWarn(...args); sendToParent('warn', args); };
            console.error = (...args) => { originalError(...args); sendToParent('error', args); };
            
            window.onerror = (msg, url, line) => { sendToParent('error', [\`Runtime Error: \${msg} (Line \${line})\`]); };
          })();
        </script>
        <script type="text/babel">
          const { useState, useEffect, useRef, useMemo, useCallback } = React;
          // Recharts Shim
          const { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } = window.Recharts || {};

          // React Native / Expo Shims for Web Preview
          const flattenStyles = (style) => style ? (Array.isArray(style) ? style.reduce((a,c)=>({...a,...c}), {}) : style) : {};
          const View = ({ style, ...p }) => <div style={{ display:'flex', flexDirection:'column', ...flattenStyles(style) }} {...p} />;
          const Text = ({ style, ...p }) => <span style={{ display:'block', ...flattenStyles(style) }} {...p} />;
          const TouchableOpacity = ({ style, onPress, ...p }) => <button style={{ border:'none', background:'transparent', cursor:'pointer', ...flattenStyles(style) }} onClick={onPress} {...p} />;
          const Image = ({ style, source, ...p }) => <img src={source?.uri || 'https://via.placeholder.com/150'} style={{ objectFit:'cover', ...flattenStyles(style) }} {...p} />;
          const ScrollView = ({ style, contentContainerStyle, children, ...p }) => <div style={{ overflowY:'auto', height:'100%', ...flattenStyles(style) }} {...p}><div style={{ ...flattenStyles(contentContainerStyle) }}>{children}</div></div>;
          const StyleSheet = { create: (s) => s, flatten: flattenStyles };
          
          // Expo Router Shims
          const Slot = () => <div className="p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-400">Router Slot Content</div>;
          const Stack = ({children}) => <>{children}</>; Stack.Screen = () => null;
          const Tabs = ({children}) => <div className="flex flex-col h-full"><div className="flex-1">{children}</div><div className="h-12 bg-gray-100 border-t flex justify-around items-center text-xs text-gray-500">Tabs Footer</div></div>; Tabs.Screen = () => null;

          class ErrorBoundary extends React.Component {
            constructor(props) { super(props); this.state = { hasError: false, error: null }; }
            static getDerivedStateFromError(error) { return { hasError: true, error }; }
            render() {
              if (this.state.hasError) return <div style={{ padding: 20, color: '#ef4444', backgroundColor: '#fee2e2' }}><h3>Runtime Error</h3><pre>{this.state.error.toString()}</pre></div>;
              return this.props.children;
            }
          }

          ${finalCode}
          
          ${mountScript}
        </script>
      </body>
    </html>
  `;
};
