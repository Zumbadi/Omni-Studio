
import React from 'react';
import { FileNode } from '../types';
import { getAllFiles } from './fileHelpers';

const bundleCode = (entryCode: string, allFiles: {node: FileNode, path: string}[], depth = 0, visited = new Set<string>(), collectedStyles: string[] = []): string => {
    if (depth > 20) return entryCode; // Increased depth limit but still safe
    
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

    // 2. Handle JS/TS Imports
    const importRegex = /import\s+.*?\s+from\s+['"]((\.|@\/).+?)['"];?/g;
    let match;
    while ((match = importRegex.exec(entryCode)) !== null) {
        const importStatement = match[0];
        const importPath = match[1];
        
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
            const filename = importPath.split('/').pop()?.replace(/['"]/g, '');
            fileNode = allFiles.find(f => {
                const fname = f.node.name.split('.')[0];
                return fname === filename && (f.node.name.endsWith('.tsx') || f.node.name.endsWith('.ts') || f.node.name.endsWith('.js') || f.node.name.endsWith('.jsx'));
            })?.node;
        }

        if (fileNode && fileNode.content && !visited.has(fileNode.id)) {
            visited.add(fileNode.id);
            
            let inlinedContent = bundleCode(fileNode.content, allFiles, depth + 1, visited, collectedStyles);
            
            // Strip imports from the inlined content
            inlinedContent = inlinedContent
                .replace(/import\s+.*?\s+from\s+['"].*?['"];?/g, '')
                .replace(/import\s+['"].*?\.css['"];?/g, '')
                .replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
                .replace(/export\s+const\s+(\w+)/g, 'const $1')
                .replace(/export\s+class\s+(\w+)/g, 'class $1')
                .replace(/export\s+default\s+(\w+);?/g, '') 
                .replace(/export\s+{.*?};?/g, ''); 

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

  const allFiles = getAllFiles(files); // Flatten once
  const collectedStyles: string[] = [];
  let bundledCode = bundleCode(code, allFiles, 0, new Set(), collectedStyles);
  const styleBlock = collectedStyles.length > 0 ? `<style>${collectedStyles.join('\n')}</style>` : '';

  if (files.length > 0) {
      const pathRegex = /['"](\.{0,2}\/?[^'"]+\.(png|jpg|jpeg|gif|svg))['"]/gi;
      const matches = [...bundledCode.matchAll(pathRegex)];
      
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
              if (replacement) bundledCode = bundledCode.split(originalString).join(replacement);
          }
      });
  }

  const sanitizedCode = bundledCode
    .replace(/import\s+React.*?;/g, '')
    .replace(/import\s+{.*?}\s+from\s+['"]react-native['"];/g, '')
    .replace(/import\s+{.*?}\s+from\s+['"]lucide-react['"];/g, '')
    .replace(/import\s+{.*?}\s+from\s+['"]expo-router['"];/g, '')
    .replace(/import\s+.*?\s+from\s+['"]@expo\/vector-icons\/.*?['"];/g, '')
    .replace(/import\s+['"].*?\.css['"];?/g, '')
    .replace(/import\s+.*?;/g, '')
    .replace(/export\s+default\s+function\s+App/g, 'function App')
    .replace(/export\s+default\s+class\s+App/g, 'class App')
    .replace(/export\s+default\s+App;/g, '')
    .replace(/export\s+default\s+/g, '');

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

            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'eval') {
                    try {
                        const result = eval(event.data.code);
                        console.log(result);
                    } catch (e) {
                        console.error(e);
                    }
                }
            });
          })();
        </script>
        <script type="text/babel">
          const { useState, useEffect, useRef, useMemo, useCallback } = React;

          const flattenStyles = (style) => {
             if (!style) return {};
             if (Array.isArray(style)) {
                 return style.reduce((acc, curr) => ({ ...acc, ...flattenStyles(curr) }), {});
             }
             return style;
          };

          const View = ({ style, children, ...props }) => <div style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box', ...flattenStyles(style) }} {...props}>{children}</div>;
          const Text = ({ style, children, ...props }) => <span style={{ display: 'block', ...flattenStyles(style) }} {...props}>{children}</span>;
          const TouchableOpacity = ({ style, children, onPress, ...props }) => <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', ...flattenStyles(style) }} onClick={onPress} {...props}>{children}</button>;
          const Image = ({ style, source, ...props }) => <img src={source?.uri || 'https://via.placeholder.com/150'} style={{ objectFit: 'cover', ...flattenStyles(style) }} {...props} />;
          const ScrollView = ({ style, children, contentContainerStyle, ...props }) => <div style={{ overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', ...flattenStyles(style) }} {...props}><div style={{ display: 'flex', flexDirection: 'column', ...flattenStyles(contentContainerStyle) }}>{children}</div></div>;
          const TextInput = ({ style, value, onChangeText, placeholder, secureTextEntry, ...props }) => <input type={secureTextEntry ? "password" : "text"} value={value} onChange={(e) => onChangeText && onChangeText(e.target.value)} placeholder={placeholder} style={{ outline: 'none', border: '1px solid #ccc', padding: '8px', ...flattenStyles(style) }} {...props} />;
          const FlatList = ({ data, renderItem, keyExtractor, style, ...props }) => <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', ...flattenStyles(style) }}>{data && data.map((item, index) => <React.Fragment key={keyExtractor ? keyExtractor(item) : index}>{renderItem({ item, index })}</React.Fragment>)}</div>;
          const ActivityIndicator = ({ size, color }) => <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}><span style={{ width: 20, height: 20, borderRadius: '50%', border: \`3px solid \${color||'#000'}\`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite', display: 'block' }}></span><style>{\`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\`}</style></div>;
          const Alert = { alert: (title, msg) => window.alert(\`\${title}\\n\${msg || ''}\`) };
          const StyleSheet = { create: (styles) => styles, flatten: flattenStyles, absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } };
          const SafeAreaView = ({ style, children, ...props }) => <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', ...flattenStyles(style) }} {...props}>{children}</div>;

          const Slot = () => <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #444', borderRadius: 8, margin: 10, color: '#666' }}>[Router Slot]</div>;
          const Stack = ({ children }) => <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>;
          Stack.Screen = () => null;
          const Tabs = ({ children, screenOptions }) => (
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, position: 'relative' }}><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>[Tab Content Area]</div></div>
                <div style={{ height: 60, borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-around', alignItems: 'center', backgroundColor: '#fff' }}>
                   {React.Children.map(children, child => {
                      if(!child) return null;
                      const { name, options } = child.props;
                      return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.6 }}>{options?.tabBarIcon && options.tabBarIcon({ color: '#888' })}<span style={{ fontSize: 10, marginTop: 2 }}>{options?.title || name}</span></div>;
                   })}
                </div>
             </div>
          );
          Tabs.Screen = () => null;

          const IconShim = ({ size = 24, color = 'currentColor', ...props }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>;
          const ProxyComponent = new Proxy({}, { get: (target, prop) => IconShim });
          Object.assign(window, ProxyComponent);
          const TabBarIcon = IconShim;

          class ErrorBoundary extends React.Component {
            constructor(props) { super(props); this.state = { hasError: false, error: null }; }
            static getDerivedStateFromError(error) { return { hasError: true, error }; }
            render() {
              if (this.state.hasError) return <div style={{ padding: 20, color: '#ef4444', backgroundColor: '#fee2e2' }}><h3>Runtime Error</h3><pre>{this.state.error.toString()}</pre></div>;
              return this.props.children;
            }
          }

          try {
            ${sanitizedCode}
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(<ErrorBoundary><App /></ErrorBoundary>);
          } catch (err) {
             const root = ReactDOM.createRoot(document.getElementById('root'));
             root.render(<div style={{ padding: 20, color: '#ef4444' }}><h3>Compilation Error</h3><pre>{err.toString()}</pre></div>);
          }
        </script>
      </body>
    </html>
  `;
};
