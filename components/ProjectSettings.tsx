
import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, Trash2, Lock, AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Project } from '../types';

interface ProjectSettingsProps {
  project: Project;
  onUpdate: (updatedProject: Project) => void;
  onDeleteProject?: (id: string) => void;
}

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({ project, onUpdate, onDeleteProject }) => {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [envVars, setEnvVars] = useState<{key: string, value: string}[]>([]);

  useEffect(() => {
      // Mock loading env vars from a "secure" location or parsing .env file
      // For this demo we just keep local state or load from a specific localStorage key
      const savedEnv = localStorage.getItem(`omni_env_${project.id}`);
      if (savedEnv) setEnvVars(JSON.parse(savedEnv));
      else setEnvVars([
          { key: 'API_URL', value: 'https://api.example.com' },
          { key: 'NODE_ENV', value: 'development' }
      ]);
  }, [project.id]);

  const handleSave = () => {
      const updated = { ...project, name, description: desc };
      onUpdate(updated);
      
      // Save Env Vars
      localStorage.setItem(`omni_env_${project.id}`, JSON.stringify(envVars));
      
      // Also try to update the actual .env file if it exists in the file system (simulated)
      // This would typically be handled by the parent, but we'll just save the config here.
      
      alert('Project settings saved successfully.');
  };

  const addEnvVar = () => {
      setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const removeEnvVar = (idx: number) => {
      const newVars = [...envVars];
      newVars.splice(idx, 1);
      setEnvVars(newVars);
  };

  const updateEnvVar = (idx: number, field: 'key' | 'value', val: string) => {
      const newVars = [...envVars];
      newVars[idx][field] = val;
      setEnvVars(newVars);
  };

  const handleDelete = () => {
      if (onDeleteProject && confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
          onDeleteProject(project.id);
      }
  };

  return (
      <div className="flex-1 bg-gray-900 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-850 flex justify-between items-center shrink-0">
              <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2"><Settings size={16} className="text-gray-400"/> Project Settings</h2>
              <Button size="sm" onClick={handleSave}><Save size={14} className="mr-2"/> Save Changes</Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* General Info */}
              <div className="space-y-4 max-w-2xl">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-gray-800 pb-2">General</h3>
                  <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Project Name</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 focus:outline-none" />
                  </div>
                  <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
                      <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 focus:outline-none resize-none" />
                  </div>
              </div>

              {/* Environment Variables */}
              <div className="space-y-4 max-w-2xl">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Environment Variables</h3>
                      <button onClick={addEnvVar} className="text-xs text-primary-400 hover:text-white flex items-center gap-1"><Plus size={12}/> Add Variable</button>
                  </div>
                  
                  <div className="space-y-2">
                      {envVars.map((v, i) => (
                          <div key={i} className="flex gap-2 items-center">
                              <div className="relative flex-1">
                                  <input 
                                    type="text" 
                                    placeholder="KEY" 
                                    value={v.key} 
                                    onChange={e => updateEnvVar(i, 'key', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs font-mono text-yellow-400 uppercase focus:border-primary-500 outline-none"
                                  />
                              </div>
                              <div className="relative flex-1">
                                  <input 
                                    type="text" 
                                    placeholder="VALUE" 
                                    value={v.value} 
                                    onChange={e => updateEnvVar(i, 'value', e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-white focus:border-primary-500 outline-none"
                                  />
                                  <Lock size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"/>
                              </div>
                              <button onClick={() => removeEnvVar(i)} className="text-gray-600 hover:text-red-400 p-1"><Trash2 size={14}/></button>
                          </div>
                      ))}
                      {envVars.length === 0 && <div className="text-xs text-gray-500 italic">No environment variables configured.</div>}
                  </div>
                  <p className="text-[10px] text-gray-500 flex items-center gap-1"><Lock size={10}/> Values are encrypted at rest (Simulated)</p>
              </div>

              {/* Danger Zone */}
              {onDeleteProject && (
                  <div className="space-y-4 max-w-2xl pt-4">
                      <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider border-b border-red-900/30 pb-2 flex items-center gap-2"><AlertTriangle size={14}/> Danger Zone</h3>
                      <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-4 flex items-center justify-between">
                          <div>
                              <div className="text-sm font-medium text-red-200">Delete Project</div>
                              <div className="text-xs text-red-400/70">Once you delete a project, there is no going back. Please be certain.</div>
                          </div>
                          <Button variant="danger" size="sm" onClick={handleDelete}>Delete Project</Button>
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
};
