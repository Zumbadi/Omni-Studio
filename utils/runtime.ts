
import React from 'react';

export const generatePreviewHtml = (code: string, isNative: boolean) => {
  // Improved sanitizer to handle export defaults and imports
  const sanitizedCode = code
    .replace(/import\s+React.*?;/g, '')
    .replace(/import\s+{.*?}\s+from\s+['"]react-native['"];/g, '')
    .replace(/import\s+.*?;/g, '')
    .replace(/export\s+default\s+function\s+App/g, 'function App') // Convert export default to regular function
    .replace(/export\s+default\s+class\s+App/g, 'class App')
    .replace(/export\s+default\s+App;/g, ''); // Remove standalone export

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
        <style>
          body { margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          #root { height: 100vh; width: 100%; display: flex; flex-direction: column; }
          /* Custom Scrollbar for "mobile" feel */
          ::-webkit-scrollbar { width: 0px; background: transparent; }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script type="text/babel">
          const { useState, useEffect, useRef, useMemo, useCallback } = React;

          // --- React Native Shim for Web ---
          const View = ({ style, children, ...props }) => <div style={{ display: 'flex', flexDirection: 'column', ...style }} {...props}>{children}</div>;
          const Text = ({ style, children, ...props }) => <span style={{ display: 'block', ...style }} {...props}>{children}</span>;
          const TouchableOpacity = ({ style, children, onPress, ...props }) => (
            <button 
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', ...style }} 
              onClick={onPress}
              {...props}
            >
              {children}
            </button>
          );
          const Image = ({ style, source, ...props }) => <img src={source?.uri || 'https://via.placeholder.com/150'} style={{ objectFit: 'cover', ...style }} {...props} />;
          const ScrollView = ({ style, children, contentContainerStyle, ...props }) => (
            <div style={{ overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', ...style }} {...props}>
              <div style={{ display: 'flex', flexDirection: 'column', ...contentContainerStyle }}>{children}</div>
            </div>
          );
          const TextInput = ({ style, value, onChangeText, placeholder, secureTextEntry, ...props }) => (
            <input 
              type={secureTextEntry ? "password" : "text"}
              value={value}
              onChange={(e) => onChangeText && onChangeText(e.target.value)}
              placeholder={placeholder}
              style={{ outline: 'none', border: '1px solid #ccc', padding: '8px', ...style }}
              {...props}
            />
          );
          const FlatList = ({ data, renderItem, keyExtractor, style, ...props }) => (
             <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', ...style }}>
                {data && data.map((item, index) => (
                   <React.Fragment key={keyExtractor ? keyExtractor(item) : index}>
                      {renderItem({ item, index })}
                   </React.Fragment>
                ))}
             </div>
          );
          const ActivityIndicator = ({ size, color }) => (
             <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
               <span style={{ 
                  width: size === 'large' ? 32 : 20, 
                  height: size === 'large' ? 32 : 20, 
                  borderRadius: '50%', 
                  border: \`3px solid \${color || '#000'}\`, 
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                  display: 'block'
               }}></span>
               <style>{\`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\`}</style>
             </div>
          );
          const Alert = {
             alert: (title, msg) => window.alert(\`\${title}\\n\${msg || ''}\`)
          };

          const StyleSheet = { 
            create: (styles) => styles, 
            absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } 
          };
          const SafeAreaView = ({ style, children, ...props }) => <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', ...style }} {...props}>{children}</div>;

          // --- Error Boundary ---
          class ErrorBoundary extends React.Component {
            constructor(props) {
              super(props);
              this.state = { hasError: false, error: null };
            }
            static getDerivedStateFromError(error) { return { hasError: true, error }; }
            render() {
              if (this.state.hasError) {
                return (
                  <div style={{ padding: 20, color: '#ef4444', backgroundColor: '#fee2e2', height: '100vh' }}>
                    <h3 style={{fontWeight: 'bold'}}>Runtime Error</h3>
                    <pre style={{whiteSpace: 'pre-wrap', fontSize: 12}}>{this.state.error.toString()}</pre>
                  </div>
                );
              }
              return this.props.children;
            }
          }

          // --- User Code Injection ---
          try {
            ${sanitizedCode}

            // --- Mount ---
            const root = ReactDOM.createRoot(document.getElementById('root'));
            root.render(
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            );
          } catch (err) {
             const root = ReactDOM.createRoot(document.getElementById('root'));
             root.render(
                <div style={{ padding: 20, color: '#ef4444', backgroundColor: '#fee2e2', height: '100vh' }}>
                  <h3 style={{fontWeight: 'bold'}}>Compilation Error</h3>
                  <pre style={{whiteSpace: 'pre-wrap', fontSize: 12}}>{err.toString()}</pre>
                </div>
             );
          }
        </script>
      </body>
    </html>
  `;
};
