
import React, { useState, useEffect } from 'react';
import { MOCK_JOBS, DATASET_PREVIEW } from '../constants';
import { Button } from './Button';
import { Activity, Database, Server, Play, Clock, X, Upload, Brain, MessageSquare, Send, Rocket, Check, Eye, FlaskConical, Sparkles, FileJson, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { testFineTunedModel, generateSyntheticData } from '../services/geminiService';
import { FineTuningJob, Dataset } from '../types';

const CHART_DATA = [
  { step: 0, loss: 2.5, accuracy: 0.2 },
  { step: 10, loss: 2.1, accuracy: 0.35 },
  { step: 20, loss: 1.8, accuracy: 0.45 },
  { step: 30, loss: 1.2, accuracy: 0.65 },
  { step: 40, loss: 0.8, accuracy: 0.80 },
  { step: 50, loss: 0.6, accuracy: 0.88 },
  { step: 60, loss: 0.4, accuracy: 0.92 },
];

export const FineTuningDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'data'>('jobs');
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  
  // Jobs State (Persistent)
  const [jobs, setJobs] = useState<FineTuningJob[]>(() => {
    const saved = localStorage.getItem('omni_jobs');
    return saved ? JSON.parse(saved) : MOCK_JOBS;
  });

  // Datasets State (Persistent)
  const [datasets, setDatasets] = useState<Dataset[]>(() => {
      const saved = localStorage.getItem('omni_datasets');
      return saved ? JSON.parse(saved) : [
          { id: 'ds1', name: 'customer_chats_v2.jsonl', format: 'jsonl', size: '124MB', content: DATASET_PREVIEW, created: '2 days ago', description: 'Customer support logs' }
      ];
  });

  // Generator State
  const [genTopic, setGenTopic] = useState('');
  const [genCount, setGenCount] = useState(10);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');

  // Active Job for Chart visualization
  const activeJob = jobs.find(j => j.status === 'training') || jobs[0];
  
  // Playground State
  const [showPlayground, setShowPlayground] = useState(false);
  const [activeModel, setActiveModel] = useState<string>('');
  const [playgroundMessages, setPlaygroundMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Dataset Inspector State
  const [showDatasetModal, setShowDatasetModal] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  useEffect(() => {
      localStorage.setItem('omni_datasets', JSON.stringify(datasets));
  }, [datasets]);

  // Simulation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prevJobs => {
        let hasChanges = false;
        const updatedJobs = prevJobs.map(job => {
          if (job.status === 'training') {
            hasChanges = true;
            // Simulate progress
            const increment = Math.random() * 2 + 0.5; 
            const newProgress = Math.min(100, job.progress + increment);
            const isComplete = newProgress >= 100;
            
            // Simulate metrics
            const newLoss = Math.max(0.1, job.loss - (0.01 * increment));
            const newAccuracy = Math.min(0.99, job.accuracy + (0.005 * increment));

            return {
              ...job,
              progress: newProgress,
              loss: parseFloat(newLoss.toFixed(3)),
              accuracy: parseFloat(newAccuracy.toFixed(3)),
              status: isComplete ? 'completed' : 'training'
            } as FineTuningJob;
          }
          return job;
        });

        if (hasChanges) {
          localStorage.setItem('omni_jobs', JSON.stringify(updatedJobs));
        }
        return updatedJobs;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDeploy = (job: FineTuningJob) => {
    const deployedKey = 'omni_deployed_models';
    const deployed = JSON.parse(localStorage.getItem(deployedKey) || '[]');
    
    if (!deployed.find((m: any) => m.id === job.id)) {
      deployed.push(job);
      localStorage.setItem(deployedKey, JSON.stringify(deployed));
      
      // Trigger a custom event so Settings component can pick it up if it's mounted
      window.dispatchEvent(new Event('modelsUpdated'));
      
      alert(`Model ${job.modelName} successfully deployed to inference cluster!`);
    } else {
      alert(`Model ${job.modelName} is already deployed.`);
    }
  };

  const handleStartJob = () => {
    const newJob: FineTuningJob = {
      id: `job-${Date.now()}`,
      modelName: `Custom-Model-${Math.floor(Math.random() * 1000)}`,
      baseModel: 'Llama-3-8b',
      status: 'training',
      progress: 0,
      accuracy: 0.1,
      loss: 3.0,
      datasetSize: '120MB',
      startedAt: 'Just now'
    };
    
    const updatedJobs = [newJob, ...jobs];
    setJobs(updatedJobs);
    localStorage.setItem('omni_jobs', JSON.stringify(updatedJobs));
    setShowModal(false);
    setStep(1);
  };

  const handleTestModel = (modelName: string) => {
    setActiveModel(modelName);
    setPlaygroundMessages([{ role: 'model', text: `Model ${modelName} loaded. How can I help you?` }]);
    setShowPlayground(true);
  };

  const handleViewDataset = (ds: Dataset) => {
    setSelectedDataset(ds);
    setShowDatasetModal(true);
  };

  const handleGenerateDataset = async () => {
      if(!genTopic) return;
      setIsGeneratingData(true);
      setGeneratedContent('');
      
      await generateSyntheticData(genTopic, genCount, (chunk) => {
          setGeneratedContent(prev => prev + chunk);
      });
      
      setIsGeneratingData(false);
  };

  const handleSaveGeneratedDataset = () => {
      if (!generatedContent) return;
      const newDs: Dataset = {
          id: `ds-${Date.now()}`,
          name: `synth_${genTopic.replace(/\s+/g, '_')}.jsonl`,
          description: `Synthetic data for: ${genTopic}`,
          format: 'jsonl',
          size: `${(generatedContent.length / 1024).toFixed(1)}KB`,
          content: generatedContent,
          created: 'Just now'
      };
      setDatasets(prev => [...prev, newDs]);
      setGeneratedContent('');
      setGenTopic('');
      alert("Dataset saved to library!");
  };

  const handlePlaygroundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playgroundInput.trim()) return;

    const prompt = playgroundInput;
    setPlaygroundMessages(prev => [...prev, { role: 'user', text: prompt }]);
    setPlaygroundInput('');
    setIsTesting(true);

    // Add temporary model placeholder
    setPlaygroundMessages(prev => [...prev, { role: 'model', text: '' }]);
    let response = '';

    await testFineTunedModel(activeModel, prompt, (chunk) => {
      response += chunk;
      setPlaygroundMessages(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1].text = response;
        return newHistory;
      });
    });
    
    setIsTesting(false);
  };

  const DatasetModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
         <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
           <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Database className="text-yellow-400" size={20} />
                Dataset Inspector
              </h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedDataset?.name}</p>
           </div>
           <button onClick={() => setShowDatasetModal(false)} className="text-gray-500 hover:text-white">
             <X size={20} />
           </button>
         </div>
         <div className="flex-1 bg-black p-6 overflow-auto">
            <div className="font-mono text-xs text-gray-400 whitespace-pre leading-relaxed">
               {selectedDataset?.content}
            </div>
         </div>
         <div className="px-6 py-3 bg-gray-850 border-t border-gray-800 text-xs text-gray-500 flex justify-between">
            <span>Format: {selectedDataset?.format.toUpperCase()}</span>
            <span>Size: {selectedDataset?.size}</span>
         </div>
      </div>
    </div>
  );

  const PlaygroundModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MessageSquare className="text-green-400" size={20} />
              Model Playground
            </h2>
            <p className="text-xs text-green-400 font-mono mt-0.5">Connected to: {activeModel}</p>
          </div>
          <button onClick={() => setShowPlayground(false)} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-900">
          {playgroundMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'}`}>
                {msg.text}
                {msg.text === '' && isTesting && <span className="animate-pulse">▋</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-850">
          <form onSubmit={handlePlaygroundSubmit} className="relative">
            <input 
              type="text" 
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-4 pr-12 py-3 text-sm text-white focus:border-primary-500 focus:outline-none"
              placeholder={`Message ${activeModel}...`}
              value={playgroundInput}
              onChange={(e) => setPlaygroundInput(e.target.value)}
              autoFocus
            />
            <button 
              type="submit" 
              disabled={!playgroundInput.trim() || isTesting}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-primary-500 hover:text-white hover:bg-primary-600 rounded-md transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const NewJobModal = () => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-850">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Brain className="text-primary-500" size={20} />
            New Fine-Tuning Job
          </h2>
          <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Base Model</label>
                <div className="grid grid-cols-2 gap-4">
                  {['Llama-3-8b', 'Mistral-7b-v0.3', 'Llama-3-70b (Quantized)', 'Gemma-7b'].map((model) => (
                    <div key={model} className="border border-gray-700 rounded-lg p-4 hover:border-primary-500 cursor-pointer hover:bg-gray-800 transition-all group">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-medium">{model}</span>
                        <div className="w-4 h-4 rounded-full border border-gray-500 group-hover:border-primary-500"></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Unsloth Optimized</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Dataset</label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none mb-2">
                    {datasets.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
                </select>
                
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center hover:border-gray-500 hover:bg-gray-800/50 transition-colors cursor-pointer">
                  <Upload className="text-gray-500 mb-3" size={24} />
                  <p className="text-sm text-gray-300">Or drag & drop new dataset</p>
                  <p className="text-xs text-gray-600 mt-1">Supports .jsonl, .txt (Max 1GB)</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Epochs</label>
                      <input type="number" defaultValue={3} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none" />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Batch Size</label>
                      <input type="number" defaultValue={4} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none" />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Learning Rate</label>
                      <input type="text" defaultValue="2e-4" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none" />
                   </div>
                   <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">LoRA Rank (r)</label>
                      <input type="number" defaultValue={16} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:border-primary-500 focus:outline-none" />
                   </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                   <h4 className="text-sm font-medium text-blue-400 mb-1">Estimated Cost</h4>
                   <p className="text-xs text-blue-200">Based on your dataset size and A100 usage, this job will cost approximately <span className="font-bold text-white">$2.40</span> and take ~45 minutes.</p>
                </div>
             </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-850 border-t border-gray-800 flex justify-end gap-3">
           {step > 1 && (
             <Button variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>
           )}
           {step < 2 ? (
             <Button onClick={() => setStep(step + 1)}>Next: Configuration</Button>
           ) : (
             <Button onClick={handleStartJob}>Start Training Job</Button>
           )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-900 p-8 relative">
      {showModal && <NewJobModal />}
      {showPlayground && <PlaygroundModal />}
      {showDatasetModal && <DatasetModal />}
      
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-white">Fine-Tuning Workbench</h1>
          <p className="text-gray-400 mt-1">Train custom models on your data using Unsloth optimized pipelines.</p>
        </div>
        <div className="flex gap-2 bg-gray-800 p-1 rounded-lg border border-gray-700">
            <button onClick={() => setActiveTab('jobs')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'jobs' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>Training Jobs</button>
            <button onClick={() => setActiveTab('data')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'data' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>Data Lab</button>
        </div>
      </header>

      {activeTab === 'jobs' ? (
      <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
          <div className="flex items-center gap-3 mb-4 text-blue-400">
            <Activity size={20} />
            <h3 className="font-semibold text-white">Active Training: {activeJob.modelName}</h3>
          </div>
          <div className="h-48">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={CHART_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="step" stroke="#9ca3af" fontSize={10} />
                  <YAxis stroke="#9ca3af" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} 
                  />
                  <Line type="monotone" dataKey="loss" stroke="#f87171" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="accuracy" stroke="#34d399" strokeWidth={2} dot={false} />
                </LineChart>
             </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
             <span className="text-red-300">Loss: {activeJob.loss}</span>
             <span className="text-green-300">Accuracy: {(activeJob.accuracy * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
           <div className="flex items-center gap-3 mb-4 text-purple-400">
            <Server size={20} />
            <h3 className="font-semibold text-white">GPU Status</h3>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-750 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Worker 1 (A100-80G)</span>
                <span className="text-green-400">Active</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
              <div className="text-xs text-right mt-1 text-gray-500">68GB / 80GB VRAM</div>
            </div>
            <div className="bg-gray-750 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">Worker 2 (T4)</span>
                <span className="text-gray-500">Idle</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-gray-600 h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
              <div className="text-xs text-right mt-1 text-gray-500">0GB / 16GB VRAM</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg flex flex-col">
           <div className="flex items-center gap-3 mb-4 text-yellow-400">
            <Database size={20} />
            <h3 className="font-semibold text-white">Datasets</h3>
          </div>
          <ul className="space-y-3 flex-1 overflow-y-auto max-h-[160px]">
             {datasets.map((ds) => (
               <li key={ds.id} className="flex items-center justify-between text-sm p-2 hover:bg-gray-700 rounded cursor-pointer transition group">
                  <span className="text-gray-300 truncate max-w-[150px]" title={ds.name}>{ds.name}</span>
                  <button 
                    onClick={() => handleViewDataset(ds)}
                    className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Preview Dataset"
                  >
                    <Eye size={14} />
                  </button>
               </li>
             ))}
          </ul>
          <Button variant="ghost" size="sm" onClick={() => setActiveTab('data')} className="w-full mt-4 border border-dashed border-gray-600">
            <FlaskConical size={14} className="mr-2"/> Generate Synthetic Data
          </Button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-gray-700 bg-gray-850 flex justify-between items-center">
          <h3 className="font-semibold text-white">Recent Jobs</h3>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Play size={14} className="mr-2" /> New Job
          </Button>
        </div>
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-900 text-xs uppercase font-medium text-gray-500">
            <tr>
              <th className="px-6 py-3">Job ID</th>
              <th className="px-6 py-3">Model Name</th>
              <th className="px-6 py-3">Base Model</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Progress</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-750 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-gray-500">{job.id}</td>
                <td className="px-6 py-4 font-medium text-white">{job.modelName}</td>
                <td className="px-6 py-4">{job.baseModel}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${job.status === 'completed' ? 'bg-green-900 text-green-300' : 
                      job.status === 'training' ? 'bg-blue-900 text-blue-300' : 
                      'bg-gray-700 text-gray-300'}`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="w-24 bg-gray-700 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'}`} 
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  {job.status === 'completed' && (
                    <button 
                      onClick={() => handleDeploy(job)}
                      className="text-green-400 hover:text-white transition-colors p-1 bg-green-900/20 rounded border border-green-900/50 hover:bg-green-600 hover:border-green-500"
                      title="Deploy Model"
                    >
                      <Rocket size={14} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleTestModel(job.modelName)}
                    className="text-primary-400 hover:text-white transition-colors p-1 bg-primary-900/20 rounded border border-primary-900/50 hover:bg-primary-600 hover:border-primary-500"
                    title="Test in Playground"
                  >
                    <Play size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      ) : (
      <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Generator Panel */}
          <div className="w-1/3 bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col">
              <div className="mb-6">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><FlaskConical className="text-primary-500"/> Synthetic Data Generator</h2>
                  <p className="text-sm text-gray-400 mt-1">Generate high-quality Q&A pairs for training using Gemini.</p>
              </div>
              
              <div className="space-y-4 flex-1">
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Topic / Domain</label>
                      <input 
                        type="text" 
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:border-primary-500 focus:outline-none" 
                        placeholder="e.g. Python Error Handling, Legal Contract Review, Medical Triage..."
                        value={genTopic}
                        onChange={(e) => setGenTopic(e.target.value)}
                      />
                  </div>
                  
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Example Count: {genCount}</label>
                      <input 
                        type="range" 
                        min="5" 
                        max="50" 
                        value={genCount} 
                        onChange={(e) => setGenCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                      />
                  </div>

                  <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-xs text-blue-200">
                      <p className="flex items-start gap-2"><Sparkles size={14} className="mt-0.5 shrink-0"/> The generated data will be formatted as JSONL, ready for Unsloth/Llama-3 fine-tuning.</p>
                  </div>
              </div>

              <Button size="lg" className="w-full mt-6" onClick={handleGenerateDataset} disabled={!genTopic || isGeneratingData}>
                  {isGeneratingData ? 'Synthesizing...' : 'Generate Data'}
                  {isGeneratingData ? <Sparkles size={16} className="ml-2 animate-spin" /> : <ArrowRightIcon size={16} className="ml-2" />}
              </Button>
          </div>

          {/* Output Panel */}
          <div className="flex-1 bg-gray-950 rounded-xl border border-gray-700 flex flex-col overflow-hidden relative">
              <div className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2"><FileJson size={14}/> Output Preview</span>
                  <div className="flex gap-2">
                      <button className="text-gray-500 hover:text-white" onClick={() => navigator.clipboard.writeText(generatedContent)} title="Copy"><Check size={14}/></button>
                      <Button size="sm" variant="secondary" onClick={handleSaveGeneratedDataset} disabled={!generatedContent}>Save to Library</Button>
                  </div>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                  {generatedContent ? (
                      <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{generatedContent}</pre>
                  ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-600">
                          <Database size={48} className="mb-4 opacity-20" />
                          <p className="text-sm">Generated data will appear here.</p>
                      </div>
                  )}
              </div>
          </div>
      </div>
      )}
    </div>
  );
};

const ArrowRightIcon = ({size, className}: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
);
