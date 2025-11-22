
import { useState, useEffect } from 'react';
import { FineTuningJob, Dataset } from '../types';
import { MOCK_JOBS, DATASET_PREVIEW } from '../constants';

export const useFineTuning = () => {
  const [jobs, setJobs] = useState<FineTuningJob[]>(() => {
    const saved = localStorage.getItem('omni_jobs');
    return saved ? JSON.parse(saved) : MOCK_JOBS;
  });

  const [datasets, setDatasets] = useState<Dataset[]>(() => {
      const saved = localStorage.getItem('omni_datasets');
      return saved ? JSON.parse(saved) : [
          { id: 'ds1', name: 'customer_chats_v2.jsonl', format: 'jsonl', size: '124MB', content: DATASET_PREVIEW, created: '2 days ago', description: 'Customer support logs' }
      ];
  });

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

  const addJob = (job: FineTuningJob) => {
      const updatedJobs = [job, ...jobs];
      setJobs(updatedJobs);
      localStorage.setItem('omni_jobs', JSON.stringify(updatedJobs));
  };

  const addDataset = (dataset: Dataset) => {
      setDatasets(prev => [...prev, dataset]);
  };

  return {
      jobs,
      datasets,
      addJob,
      addDataset,
      activeJob: jobs.find(j => j.status === 'training') || jobs[0]
  };
};
