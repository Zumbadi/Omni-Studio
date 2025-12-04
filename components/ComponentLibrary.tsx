
import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, Play, RefreshCw, Settings, Code, Layers, MousePointer } from 'lucide-react';
import { FileNode } from '../types';
import { getAllFiles } from '../utils/fileHelpers';
import { analyzeComponent } from '../services/geminiService';
import { generatePreviewHtml } from '../utils/runtime';

interface ComponentLibraryProps {
  files: FileNode[];
}

interface ComponentMeta {
    name: string;
    description: string;
    props: { name: string, type: string, defaultValue?: any }[];
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ files }) => {
  const [components, setComponents] = useState<{name: string, path: string}[]>([]);
  const [selectedComp, setSelectedComp] = useState<string | null>(null);
  const [meta, setMeta] = useState<ComponentMeta | null>(null);
  const [propsValues, setPropsValues] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
      const all = getAllFiles(files);
      // Heuristic: Files in src/components or with Component-like naming
      const comps = all
        .filter(f => f.path.includes('components/') && f.node.name.match(/^[A-Z].+\.tsx$/))
        .map(f => ({ name: f.node.name.replace('.tsx', ''), path: f.path }));
      setComponents(comps);
  }, [files]);

  const loadComponent = async (comp: { name: string, path: string }) => {
      setSelectedComp(comp.name);
      setIsLoading(true);
      setMeta(null);
      setPropsValues({});

      const fileNode = getAllFiles(files).find(f => f.path === comp.path)?.node;
      if (!fileNode || !fileNode.content) return;

      const metadata = await analyzeComponent(fileNode.content);
      setMeta(metadata);
      
      // Init default props
      const defaults: any = {};
      metadata.props.forEach(p => {
          defaults[p.name] = p.defaultValue !== undefined ? p.defaultValue : (p.type === 'boolean' ? false : p.type === 'number' ? 0 : 'Sample');
      });
      setPropsValues(defaults);
      
      updatePreview(comp.name, comp.path, defaults, fileNode.content);
      setIsLoading(false);
  };

  const updatePreview = (name: string, path: string, props: any, content: string) => {
      // Create a harness that imports the component and renders it with props
      const harnessCode = `
import React from 'react';
import { ${name} } from './${name}';

export default function Harness() {
  const props = ${JSON.stringify(props)};
  return (
    <div className="flex items-center justify-center min-h-screen bg-transparent p-8">
        <div className="border border-dashed border-gray-400 p-4 rounded bg-white shadow-lg">
            <${name} {...props} />
        </div>
    </div>
  );
}

// Inline the component code to avoid complex import resolution for this specific view if possible, 
// or rely on standard runtime bundling. For simplicity, we append the component code but rename export.
// Actually, standard runtime handles relative imports if we provide the file map.
// Let's rely on the file map in generatePreviewHtml.
      `;
      
      // We need to inject the harness as a virtual file "src/Harness.tsx" and set it as entry
      // But generatePreviewHtml takes an entry string.
      // We'll rename the import to match the actual file path.
      
      const adjustedHarness = `
import React from 'react';
import { ${name} } from './${path.replace('src/', '').replace('.tsx', '')}';

export default function Harness() {
  const props = ${JSON.stringify(props)};
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-8">
        <${name} {...props} />
    </div>
  );
}
      `;

      const html = generatePreviewHtml(adjustedHarness, false, files, 'src/Harness.tsx');
      setPreviewSrc(html);
  };

  const handlePropChange = (key: string, value: any) => {
      const newProps = { ...propsValues, [key]: value };
      setPropsValues(newProps);
      
      if (selectedComp) {
          const comp = components.find(c => c.name === selectedComp);
          if (comp) {
              const fileNode = getAllFiles(files).find(f => f.path === comp.path)?.node;
              if (fileNode) updatePreview(comp.name, comp.path, newProps, fileNode.content || '');
          }
      }
  };

  const filteredComponents = components.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-full bg-gray-950">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-800 bg-gray-900 flex flex-col">
            <div className="p-4 border-b border-gray-800">
                <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-3">
                    <Package size={16} className="text-primary-500"/> UI Kit
                </h2>
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-gray-500"/>
                    <input 
                        type="text" 
                        placeholder="Filter components..." 
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:border-primary-500 outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {filteredComponents.map(c => (
                    <button 
                        key={c.path}
                        onClick={() => loadComponent(c)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium mb-1 transition-colors flex items-center gap-2 ${selectedComp === c.name ? 'bg-primary-900/30 text-primary-300 border border-primary-800' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    >
                        <Layers size={14}/> {c.name}
                    </button>
                ))}
            </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col">
            {selectedComp ? (
                <>
                    <div className="h-12 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4">
                        <div>
                            <h3 className="font-bold text-white text-sm">{selectedComp}</h3>
                            <p className="text-[10px] text-gray-500 truncate max-w-md">{meta?.description || 'Loading metadata...'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-400 border border-gray-700 font-mono">
                                &lt;{selectedComp} /&gt;
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex overflow-hidden">
                        {/* Preview */}
                        <div className="flex-1 bg-gray-950 relative flex flex-col">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                                    <RefreshCw size={24} className="animate-spin"/> Analyzing Component...
                                </div>
                            ) : (
                                <iframe 
                                    srcDoc={previewSrc}
                                    className="w-full h-full border-none bg-white"
                                    title="Component Preview"
                                />
                            )}
                        </div>

                        {/* Props Panel */}
                        <div className="w-80 border-l border-gray-800 bg-gray-900 p-4 overflow-y-auto">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Settings size={14}/> Controls</h4>
                            {meta ? (
                                <div className="space-y-4">
                                    {meta.props.map(prop => (
                                        <div key={prop.name}>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs font-medium text-gray-300">{prop.name}</label>
                                                <span className="text-[9px] text-gray-500 font-mono">{prop.type}</span>
                                            </div>
                                            {prop.type === 'boolean' ? (
                                                <div className="flex items-center mt-1">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={propsValues[prop.name] || false} 
                                                        onChange={e => handlePropChange(prop.name, e.target.checked)}
                                                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-offset-gray-900"
                                                    />
                                                </div>
                                            ) : prop.type === 'number' ? (
                                                <input 
                                                    type="number" 
                                                    className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none"
                                                    value={propsValues[prop.name] || 0}
                                                    onChange={e => handlePropChange(prop.name, parseFloat(e.target.value))}
                                                />
                                            ) : (
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none"
                                                    value={propsValues[prop.name] || ''}
                                                    onChange={e => handlePropChange(prop.name, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                    {meta.props.length === 0 && <div className="text-xs text-gray-500 italic">No props detected.</div>}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-800 rounded animate-pulse"></div>)}
                                </div>
                            )}
                            
                            <div className="mt-8 pt-4 border-t border-gray-800">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><Code size={14}/> Usage</h4>
                                <div className="bg-black/50 rounded p-2 text-[10px] font-mono text-gray-400 overflow-x-auto whitespace-pre">
                                    {`<${selectedComp} \n${Object.entries(propsValues).map(([k,v]) => `  ${k}={${typeof v === 'string' ? `"${v}"` : v}}`).join('\n')}\n/>`}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600">
                    <MousePointer size={48} className="mb-4 opacity-20"/>
                    <p className="text-sm">Select a component to view details.</p>
                </div>
            )}
        </div>
    </div>
  );
};
