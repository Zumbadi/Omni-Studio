
import React, { useState } from 'react';
import { useFineTuning } from '../hooks/useFineTuning';
import { FineTuningJobs } from './FineTuningJobs';
import { FineTuningDataLab } from './FineTuningDataLab';
import { NewJobModal, PlaygroundModal, DatasetModal } from './FineTuningModals';
import { FineTuningJob, Dataset } from '../types';

export const FineTuningDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'data'>('jobs');
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [showPlayground, setShowPlayground] = useState(false);
  const [showDatasetInspector, setShowDatasetInspector] = useState(false);
  const [activePlaygroundModel, setActivePlaygroundModel] = useState('');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const { jobs, datasets, addJob, addDataset, activeJob } = useFineTuning();

  const handleStartJob = (jobData: Partial<FineTuningJob>) => {
    const newJob: FineTuningJob = {
      id: `job-${Date.now()}`,
      modelName: jobData.modelName || 'Custom-Model',
      baseModel: jobData.baseModel || 'Llama-3-8b',
      status: 'training',
      progress: 0,
      accuracy: 0.1,
      loss: 3.0,
      datasetSize: '120MB',
      startedAt: 'Just now'
    };
    addJob(newJob);
    setShowNewJobModal(false);
  };

  const handleDeploy = (job: FineTuningJob) => {
    const deployedKey = 'omni_deployed_models';
    const deployed = JSON.parse(localStorage.getItem(deployedKey) || '[]');
    if (!deployed.find((m: any) => m.id === job.id)) {
      deployed.push(job);
      localStorage.setItem(deployedKey, JSON.stringify(deployed));
      window.dispatchEvent(new Event('modelsUpdated'));
      alert(`Model ${job.modelName} successfully deployed to inference cluster!`);
    } else {
      alert(`Model ${job.modelName} is already deployed.`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-900 p-8 relative">
      {showNewJobModal && (
        <NewJobModal 
            datasets={datasets} 
            onClose={() => setShowNewJobModal(false)} 
            onStart={handleStartJob} 
        />
      )}
      {showPlayground && (
        <PlaygroundModal 
            modelName={activePlaygroundModel} 
            onClose={() => setShowPlayground(false)} 
        />
      )}
      {showDatasetInspector && selectedDataset && (
        <DatasetModal 
            dataset={selectedDataset} 
            onClose={() => setShowDatasetInspector(false)} 
        />
      )}
      
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
        <FineTuningJobs 
            jobs={jobs}
            activeJob={activeJob}
            datasets={datasets}
            onNewJob={() => setShowNewJobModal(true)}
            onDeploy={handleDeploy}
            onTest={(name) => { setActivePlaygroundModel(name); setShowPlayground(true); }}
            onViewDataset={(ds) => { setSelectedDataset(ds); setShowDatasetInspector(true); }}
            onSwitchToDataLab={() => setActiveTab('data')}
        />
      ) : (
        <FineTuningDataLab onSaveDataset={addDataset} />
      )}
    </div>
  );
};
