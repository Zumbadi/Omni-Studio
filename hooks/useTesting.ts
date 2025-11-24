
import { useState, useCallback } from 'react';
import { FileNode, TestResult } from '../types';
import { generateTestResults } from '../services/geminiService';
import { getAllFiles } from '../utils/fileHelpers';

interface UseTestingProps {
  files: FileNode[];
  onLog?: (msg: string) => void;
}

export const useTesting = ({ files, onLog }: UseTestingProps) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const runTests = useCallback(async (specificFiles?: string[]) => {
      setIsRunningTests(true);
      if (onLog) onLog('[System] Starting test suite...');
      
      // Identify test files
      const allFiles = getAllFiles(files);
      let targetFiles: {name: string, id: string, content: string}[] = [];
      
      if (specificFiles && specificFiles.length > 0) {
          targetFiles = allFiles.filter(f => specificFiles.includes(f.node.name)).map(f => ({ name: f.node.name, id: f.node.id, content: f.node.content || '' }));
      } else {
          targetFiles = allFiles.filter(f => 
              f.node.type === 'file' && (f.node.name.includes('.test.') || f.node.name.includes('.spec.'))
          ).map(f => ({ name: f.node.name, id: f.node.id, content: f.node.content || '' }));
      }

      if (targetFiles.length === 0 && !specificFiles) {
          // Mock if no tests found for demo
          targetFiles.push({ name: 'App.test.tsx', id: 'mock-test-1', content: '// Mock test for App component' });
          targetFiles.push({ name: 'utils.test.ts', id: 'mock-test-2', content: '// Mock test for utilities' });
      }

      // Initialize pending state
      setTestResults(prev => {
          const newResults = [...prev];
          targetFiles.forEach(f => {
              const idx = newResults.findIndex(r => r.id === f.id);
              const pending: TestResult = {
                  id: f.id,
                  file: f.name,
                  status: 'pending',
                  duration: 0,
                  passed: 0,
                  failed: 0,
                  suites: []
              };
              if (idx >= 0) newResults[idx] = pending;
              else newResults.push(pending);
          });
          return newResults;
      });

      const resultsMap: Record<string, TestResult> = {};

      // Run sequentially
      for (let i = 0; i < targetFiles.length; i++) {
          const file = targetFiles[i];
          setTestResults(prev => prev.map(r => r.id === file.id ? { ...r, status: 'running' } : r));
          
          if (onLog) onLog(`[Test] Running ${file.name}...`);
          
          // AI Simulation
          const result = await generateTestResults(file.name, file.content);
          
          const finalResult: TestResult = {
              id: file.id,
              file: file.name,
              ...result,
              status: (result.failed || 0) > 0 ? 'fail' : 'pass'
          } as TestResult;

          resultsMap[file.name] = finalResult;

          setTestResults(prev => prev.map(r => r.id === file.id ? finalResult : r));
          await new Promise(r => setTimeout(r, 500));
      }

      setIsRunningTests(false);
      if (onLog) onLog('[System] Test run complete.');
      
      return resultsMap;
  }, [files, onLog]);

  return {
      testResults,
      isRunningTests,
      runTests
  };
};
