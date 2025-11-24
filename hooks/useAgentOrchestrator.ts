
import React, { useState, useEffect, useRef } from 'react';
import { AIAgent, AgentTask, FileNode, ProjectPhase, AgentContext, ProjectType } from '../types';
import { DEFAULT_AGENTS } from '../constants';
import { executeBuildTask, reviewBuildTask, delegateTasks, generateProjectPlan, runAgentFileTask, generateChangelog, planAgentTask, analyzeFile, autoUpdateReadme } from '../services/geminiService';
import { getAllFiles, findFileById, findNodeByPath, normalizePath } from '../utils/fileHelpers';
import { findDependents, getRelatedFileContent } from '../utils/projectAnalysis';

interface UseAgentOrchestratorProps {
  filesRef: React.MutableRefObject<FileNode[]>;
  updateFileContent: (id: string, content: string) => void;
  addFile: (path: string, content: string) => void;
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>;
  deleteFile: (id: string) => void;
  addSystemMessage: (text: string) => void;
  setTerminalLogs: React.Dispatch<React.SetStateAction<string[]>>;
  terminalLogs: string[];
  liveConsoleLogs: string[];
  roadmap: ProjectPhase[];
  setRoadmap: React.Dispatch<React.SetStateAction<ProjectPhase[]>>;
  debugVariables: any[];
  projectDescription: string;
  projectType: ProjectType;
  projectRules?: string;
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
  setChatInput: (val: string) => void;
  setIsChatOpen: (val: boolean) => void;
  setChatHistory: React.Dispatch<React.SetStateAction<any[]>>;
  triggerGeneration: (prompt: string) => void;
  runTests: (files?: string[]) => Promise<any>;
  handleCommand?: (cmd: string) => void;
}

export const useAgentOrchestrator = ({
  filesRef,
  updateFileContent,
  addFile,
  setFiles,
  deleteFile,
  addSystemMessage,
  setTerminalLogs,
  terminalLogs,
  liveConsoleLogs,
  roadmap,
  setRoadmap,
  debugVariables,
  projectDescription,
  projectType,
  projectRules,
  addToast,
  setChatInput,
  setIsChatOpen,
  setChatHistory,
  triggerGeneration,
  runTests,
  handleCommand
}: UseAgentOrchestratorProps) => {
  
  const [activeAgentTask, setActiveAgentTask] = useState<AgentTask & { fileList?: { name: string, path?: string, status: string }[] } | null>(null);
  const [activeAgent, setActiveAgent] = useState<AIAgent | null>(null);
  const [taskHistory, setTaskHistory] = useState<AgentTask[]>([]);
  const abortAgentRef = useRef(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  const modifiedFilesRef = useRef<Record<string, string>>({});
  const preRunSnapshot = useRef<FileNode[] | null>(null);

  const revertLastAgentRun = () => {
      if (preRunSnapshot.current) {
          setFiles(JSON.parse(JSON.stringify(preRunSnapshot.current)));
          addSystemMessage("🔄 Reverted changes from last agent workflow.");
          addToast("info", "File system restored to pre-run state.");
          preRunSnapshot.current = null;
      } else {
          addToast("error", "No snapshot available to revert.");
      }
  };

  // --- AUTONOMOUS AGENT ORCHESTRATION (Manager -> Builder -> Tester -> Critic) ---
  useEffect(() => {
      if (!activeAgentTask || activeAgentTask.status !== 'running') return;
      
      const runWorkflow = async () => {
          // 1. SNAPSHOT FOR REVERT SAFETY
          if (!preRunSnapshot.current) {
              preRunSnapshot.current = JSON.parse(JSON.stringify(filesRef.current));
          }
          modifiedFilesRef.current = {};
          
          // Determine Agents
          const savedAgents = localStorage.getItem('omni_agents');
          const agents: AIAgent[] = savedAgents ? JSON.parse(savedAgents) : DEFAULT_AGENTS;
          const manager = agents.find(a => a.isManager) || DEFAULT_AGENTS[0];
          const critic = agents.find(a => a.role.includes('QA') || a.name.includes('Critic')) || DEFAULT_AGENTS[3];
          let builder = activeAgent || agents.find(a => a.role.includes('Frontend')) || DEFAULT_AGENTS[1];

          // --- PLANNING PHASE ---
          if (!activeAgentTask.fileList || activeAgentTask.fileList.length === 0) {
              setTerminalLogs(prev => [...prev, `[${manager.name}] 🧠 Analyzing request: "${activeAgentTask.name}"...`]);
              
              const allFiles = getAllFiles(filesRef.current);
              const fileStructure = allFiles.map(f => f.path).join('\n');
              
              const plan = await planAgentTask(manager, activeAgentTask.name, fileStructure, projectType);
              
              if (plan.filesToEdit.length > 0) {
                  const plannedTargets = plan.filesToEdit.map(path => {
                      const normalized = normalizePath(path);
                      return { name: normalized.split('/').pop() || normalized, path: normalized, status: 'pending' as const };
                  });
                  setTerminalLogs(prev => [...prev, `[${manager.name}] 📋 Plan: Edit ${plannedTargets.map(t => t.name).join(', ')}.`]);
                  addSystemMessage(`**Manager Plan:** ${plan.strategy}`);
                  
                  setActiveAgentTask(prev => prev ? { ...prev, totalFiles: plannedTargets.length, fileList: plannedTargets } : null);
                  await new Promise(r => setTimeout(r, 100));
              } else {
                  setTerminalLogs(prev => [...prev, `[${manager.name}] ⚠️ Could not determine specific files. Scanning defaults...`]);
                  const initialTargets = allFiles
                      .filter(f => f.node.name.match(/\.(tsx|ts|js|jsx|swift|kt|json|py)$/) && !f.path.includes('node_modules'))
                      .slice(0, 3)
                      .map(f => ({ name: f.node.name, path: f.path, status: 'pending' as const }));
                  setActiveAgentTask(prev => prev ? { ...prev, totalFiles: initialTargets.length, fileList: initialTargets } : null);
              }
          }

          const currentTaskState = await new Promise<any>(resolve => {
              setActiveAgentTask(prev => {
                  resolve(prev);
                  return prev;
              });
          });

          if (!currentTaskState.fileList || currentTaskState.fileList.length === 0) {
               const completedTask = { ...currentTaskState, status: 'completed', logs: [...(currentTaskState?.logs || []), "No files targeted."] };
               setActiveAgentTask(null);
               setTaskHistory(prev => [completedTask, ...prev]);
               return;
          }

          abortAgentRef.current = false;
          let processedCount = 0;
          const modifiedFileNames: string[] = [];

          // Gather environment context
          const allFilesForContext = getAllFiles(filesRef.current);
          const pkgFile = allFilesForContext.find(f => f.node.name === 'package.json' || f.node.name === 'Podfile' || f.node.name === 'build.gradle');
          const pkgContent = pkgFile?.node.content || '{}';

          const context: AgentContext = {
              roadmap,
              terminalLogs: terminalLogs.slice(-20),
              liveLogs: liveConsoleLogs.slice(-20),
              debugVariables,
              projectRules,
              relatedCode: pkgContent !== '{}' ? `Dependency Config:\n${pkgContent}` : undefined
          };

          addSystemMessage(`**${manager.name}:** Starting workflow "${activeAgentTask.name}". Targets: ${activeAgentTask.fileList?.length || 0}`);

          // Dynamic Loop
          let i = 0;
          while (true) {
              if (abortAgentRef.current) {
                  setActiveAgentTask(prev => {
                      if (prev) setTaskHistory(h => [{ ...prev, status: 'cancelled' }, ...h]);
                      return null;
                  });
                  return;
              }

              const currentTaskLoop = await new Promise<any>(resolve => {
                  setActiveAgentTask(prev => { resolve(prev); return prev; });
              });
              
              if (!currentTaskLoop || !currentTaskLoop.fileList || i >= currentTaskLoop.fileList.length) {
                  break; // Done
              }

              const targetFileObj = currentTaskLoop.fileList[i];
              
              if (targetFileObj.status !== 'pending') {
                  i++;
                  continue;
              }

              // USE ROBUST FINDER
              let fileNode: FileNode | undefined;
              if (targetFileObj.path) {
                  fileNode = findNodeByPath(filesRef.current, targetFileObj.path);
              } else {
                  const latestFiles = getAllFiles(filesRef.current);
                  fileNode = latestFiles.find(f => f.node.name === targetFileObj.name)?.node;
              }
              
              let isNewFile = false;

              if (!fileNode) {
                  if (targetFileObj.path) {
                      setTerminalLogs(prev => [...prev, `[System] Creating new file: ${targetFileObj.path}`]);
                      const normalizedPath = normalizePath(targetFileObj.path);
                      addFile(normalizedPath, "");
                      isNewFile = true;
                      await new Promise(r => setTimeout(r, 300));
                      fileNode = findNodeByPath(filesRef.current, normalizedPath);
                  }
                  
                  if (!fileNode) {
                      setTerminalLogs(prev => [...prev, `[System] ⚠️ Skipping ${targetFileObj.name} (Not found)`]);
                      setActiveAgentTask(prev => prev ? { ...prev, fileList: prev.fileList?.map((f, idx) => idx === i ? { ...f, status: 'error' } : f) } : null);
                      i++;
                      continue;
                  }
              }

              setActiveAgentTask(prev => prev ? { ...prev, currentFile: fileNode.name, logs: [...prev.logs, `Processing ${fileNode.name}...`], fileList: prev.fileList?.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f) } : null);
              
              const instructions = activeAgentTask.name || "Improve code quality and fix bugs.";
              
              let attempts = 0;
              const MAX_RETRIES = 3;
              let feedback = "";
              let success = false;

              setTerminalLogs(prev => [...prev, `[${manager.name}] Assigned ${fileNode.name} to ${builder.name}`]);

              while (attempts < MAX_RETRIES && !success) {
                  if (abortAgentRef.current) break;
                  attempts++;
                  
                  // Read content (prefer modified cache > live file)
                  const currentContent = modifiedFilesRef.current[fileNode.id] || findFileById(filesRef.current, fileNode.id)?.content || '';
                  
                  // 0. PRE-CHECK / SCAN (Get Context)
                  if (attempts === 1) {
                      setTerminalLogs(prev => [...prev, `[${builder.name}] 🔍 Scanning ${fileNode.name} for issues...`]);
                      
                      // ANALYZE BEFORE ACTING
                      const analysis = await analyzeFile(builder, fileNode.name, currentContent, instructions, context);
                      setTerminalLogs(prev => [...prev, `[${builder.name}] 💡 Findings: ${analysis.replace(/\n/g, '; ')}`]);
                      feedback = `Analysis findings: ${analysis}`;

                      const latestFiles = getAllFiles(filesRef.current);
                      const relatedCode = getRelatedFileContent(currentContent, latestFiles);
                      if (relatedCode.length > 50) {
                          const imports = relatedCode.match(/\[Context from (.*?)\]/g);
                          if (imports) {
                              setTerminalLogs(prev => [...prev, `[System] Found context in: ${imports.map(s => s.replace('[Context from ', '').replace(']', '')).join(', ')}`]);
                          }
                      }
                      context.relatedCode = relatedCode;
                      await new Promise(r => setTimeout(r, 600)); 
                  }

                  // 1. BUILD
                  setTerminalLogs(prev => [...prev, `[${builder.name}] ${attempts > 1 ? `Applying Fixes (Attempt ${attempts})...` : `Generating optimizations...`}`]);
                  
                  const enrichedContext = { ...context };

                  let buildResult;
                  if (activeAgentTask.type === 'custom' || activeAgentTask.type === 'refactor') {
                      buildResult = await executeBuildTask(builder, fileNode.name, currentContent, instructions, enrichedContext, feedback, projectType, isNewFile);
                  } else {
                      const resultText = await runAgentFileTask(builder, fileNode.name, currentContent, enrichedContext);
                      buildResult = { code: resultText || currentContent, logs: [] };
                  }

                  // --- DELETION CHECK ---
                  if (buildResult.code.trim() === 'DELETE_FILE') {
                      setTerminalLogs(prev => [...prev, `[System] 🗑️ ${builder.name} requested deletion of ${fileNode.name}.`]);
                      deleteFile(fileNode.id);
                      addSystemMessage(`**${builder.name}** deleted \`${fileNode.name}\` as requested.`);
                      success = true;
                      processedCount++;
                      setActiveAgentTask(prev => prev ? { ...prev, processedFiles: prev.processedFiles + 1, fileList: prev.fileList?.map((f, idx) => idx === i ? { ...f, status: 'done' } : f) } : null);
                      break; // Exit retry loop
                  }

                  // --- ANTI-LAZY CHECK ---
                  const isDeleteRequest = instructions.toLowerCase().includes('delete') || instructions.toLowerCase().includes('remove');
                  const isSuspiciouslyShort = buildResult.code.length < currentContent.length * 0.4 && !isDeleteRequest && !isNewFile;
                  const hasPlaceholders = buildResult.code.includes('// ...') || buildResult.code.includes('// existing code');
                  
                  if (hasPlaceholders || isSuspiciouslyShort) {
                      setTerminalLogs(prev => [...prev, `[System] ⚠️ Lazy code detected. Rejecting...`]);
                      feedback = "REJECTED: You returned incomplete code with placeholders (// ...). You MUST return the FULL file content. Do NOT be lazy.";
                      continue; 
                  }

                  if (buildResult.code.trim() === currentContent.trim() && attempts === 1 && !isNewFile) {
                      setTerminalLogs(prev => [...prev, `[System] No changes required for ${fileNode.name}.`]);
                      success = true;
                      processedCount++;
                      setActiveAgentTask(prev => prev ? { ...prev, processedFiles: prev.processedFiles + 1, fileList: prev.fileList?.map((f, idx) => idx === i ? { ...f, status: 'done' } : f) } : null);
                      break; 
                  }
                  
                  // 2. CRITIQUE
                  setTerminalLogs(prev => [...prev, `[${critic.name}] Verifying changes...`]);
                  const review = await reviewBuildTask(fileNode.name, currentContent, buildResult.code, instructions, enrichedContext, projectType);

                  if (review.approved) {
                      // 3. APPLY
                      updateFileContent(fileNode.id, buildResult.code);
                      modifiedFilesRef.current[fileNode.id] = buildResult.code;
                      
                      // 4. VERIFY (TESTS)
                      let testPassed = true;
                      if (activeAgentTask.type !== 'docs') {
                          const latestFiles = getAllFiles(filesRef.current);
                          const matchingTest = latestFiles.find(f => f.node.name.includes(fileNode!.name.split('.')[0]) && (f.node.name.includes('.test.') || f.node.name.includes('.spec.')));
                          if (matchingTest) {
                              setTerminalLogs(prev => [...prev, `[System] Running tests for ${fileNode!.name}...`]);
                              const results = await runTests([matchingTest.node.name]);
                              const result = results[matchingTest.node.name];
                              if (result && result.status === 'fail') {
                                  testPassed = false;
                                  feedback = `Code approved by Critic but FAILED TESTS. Errors: ${result.suites.flatMap(s=>s.assertions).filter(a=>a.status==='fail').map(a=>a.error).join('; ')}`;
                                  setTerminalLogs(prev => [...prev, `[System] ❌ Tests Failed. Retry needed.`]);
                              } else {
                                  setTerminalLogs(prev => [...prev, `[System] ✔️ Tests Passed.`]);
                              }
                          }
                      }

                      if (testPassed) {
                          addSystemMessage(`**${critic.name}** approved changes to \`${fileNode.name}\`.`);
                          setTerminalLogs(prev => [...prev, `[System] ✔️ ${fileNode.name} updated successfully.`]);
                          success = true;
                          modifiedFileNames.push(fileNode.name);

                          if (!isNewFile) {
                              const latestFiles = getAllFiles(filesRef.current);
                              const dependents = findDependents(fileNode.name, latestFiles);
                              if (dependents.length > 0) {
                                  setTerminalLogs(prev => [...prev, `[Manager] 🔄 Sync: Checking ${dependents.length} dependent files...`]);
                                  
                                  setActiveAgentTask(prev => {
                                      if (!prev || !prev.fileList) return prev;
                                      const existingNames = new Set(prev.fileList.map(f => f.name));
                                      const newFiles = dependents
                                          .filter(d => !existingNames.has(d.node.name))
                                          .map(d => ({ name: d.node.name, path: d.path, status: 'pending' as const }));
                                      
                                      if (newFiles.length > 0) {
                                          return {
                                              ...prev,
                                              totalFiles: prev.totalFiles + newFiles.length,
                                              fileList: [...prev.fileList, ...newFiles]
                                          };
                                      }
                                      return prev;
                                  });
                              }
                          }
                      }

                  } else if (review.fixCode) {
                      // AUTO-FIX
                      updateFileContent(fileNode.id, review.fixCode);
                      modifiedFilesRef.current[fileNode.id] = review.fixCode;
                      addSystemMessage(`**${critic.name}** auto-fixed issues in \`${fileNode.name}\`.`);
                      setTerminalLogs(prev => [...prev, `[${critic.name}] 🛠️ Auto-applied fix.`]);
                      success = true;
                      modifiedFileNames.push(fileNode.name);
                  } else if (review.suggestedCommand && handleCommand) {
                      setTerminalLogs(prev => [...prev, `[${critic.name}] 🛠️ Running: ${review.suggestedCommand}`]);
                      handleCommand(review.suggestedCommand);
                      feedback = `Ran command: ${review.suggestedCommand}. Please re-check if dependencies are now resolved.`;
                  } else {
                      feedback = review.feedback;
                      const issues = review.issues?.slice(0, 2).join(', ') || "Validation failed";
                      setTerminalLogs(prev => [...prev, `[${critic.name}] ❌ Rejected: ${issues}. Retrying...`]);
                  }
                  
                  if (success) {
                      processedCount++;
                      setActiveAgentTask(prev => prev ? { ...prev, processedFiles: prev.processedFiles + 1, fileList: prev.fileList?.map((f, idx) => idx === i ? { ...f, status: 'done' } : f) } : null);
                  }
                  
                  await new Promise(r => setTimeout(r, 1000));
              }

              if (!success) {
                  setActiveAgentTask(prev => prev ? { ...prev, fileList: prev.fileList?.map((f, idx) => idx === i ? { ...f, status: 'error' } : f) } : null);
                  addSystemMessage(`**${critic.name}** stopped updates to \`${fileNode.name}\` after ${MAX_RETRIES} failed attempts.`);
                  setTerminalLogs(prev => [...prev, `[System] ⚠️ Skipped ${fileNode.name}.`]);
              }
              
              i++; // Next file
          }

          const finalStatus: AgentTask = { 
              ...activeAgentTask, 
              status: 'completed', 
              logs: [...activeAgentTask.logs, `Done. Processed ${processedCount} files.`],
              processedFiles: processedCount
          };
          setActiveAgentTask(null);
          setTaskHistory(prev => [finalStatus, ...prev]);
          setActiveAgent(null);
          addToast('success', 'Agent workflow completed');
          
          if (modifiedFileNames.length > 0) {
              const changelog = await generateChangelog(modifiedFileNames, activeAgentTask.name);
              addSystemMessage(`**Workflow Summary:**\n\n${changelog}\n\n[Revert Changes]`);
              
              // AUTO-UPDATE README
              const readmeNode = getAllFiles(filesRef.current).find(f => f.node.name.toLowerCase() === 'readme.md')?.node;
              if (readmeNode && readmeNode.content) {
                  setTerminalLogs(prev => [...prev, `[System] Updating README.md...`]);
                  const newReadme = await autoUpdateReadme(readmeNode.content, changelog);
                  updateFileContent(readmeNode.id, newReadme);
              }
          }
      };

      runWorkflow();
  }, [activeAgentTask?.id]);

  const handleStartAgentTask = (agent: AIAgent, type: AgentTask['type']) => {
      setActiveAgent(agent);
      const taskId = `task-${Date.now()}`;
      setActiveAgentTask({ 
          id: taskId, 
          type, 
          name: `${type} run by ${agent.name}`, 
          status: 'running', 
          totalFiles: 0, 
          processedFiles: 0, 
          logs: [`Workflow started for ${agent.name}`], 
          fileList: [] 
      });
      addToast('info', `Started ${type}`);
  };

  const handleCancelAgentTask = () => { abortAgentRef.current = true; };

  const handleGeneratePlan = async () => {
      setIsGeneratingPlan(true);
      const plan = await generateProjectPlan(projectDescription || "Project", projectType);
      setRoadmap(plan);
      setIsGeneratingPlan(false);
      addToast('success', 'Roadmap Generated');
  };

  const handleExecutePhase = async (phase: ProjectPhase) => {
      const savedAgents = localStorage.getItem('omni_agents');
      const agents: AIAgent[] = savedAgents ? JSON.parse(savedAgents) : DEFAULT_AGENTS;
      const manager = agents.find(a => a.isManager);
      
      if (manager) {
          setIsChatOpen(true);
          setChatInput(`[Manager] Planning "${phase.title}"...`);
          const { assignments } = await delegateTasks(phase, agents);
          
          if (assignments.length > 0) {
              const taskList = assignments.map(a => `- ${a.agentName}: ${a.taskDescription}`).join('\n');
              addSystemMessage(`**Plan:**\n${taskList}`);
              
              const firstTask = assignments[0];
              const assignedAgent = agents.find(a => a.name === firstTask.agentName) || DEFAULT_AGENTS[1];
              
              setActiveAgentTask({
                  id: `phase-exec-${Date.now()}`,
                  type: 'custom',
                  name: firstTask.taskDescription,
                  status: 'running',
                  totalFiles: 1,
                  processedFiles: 0,
                  logs: [`Starting phase...`],
                  fileList: firstTask.targetFile ? [{ name: firstTask.targetFile, status: 'pending' }] : []
              });
              setActiveAgent(assignedAgent);
          } else {
              setChatInput(`Execute: ${phase.title}`);
              triggerGeneration(`Execute Phase: ${phase.title}`);
          }
      } else {
          setChatInput(`Execute: ${phase.title}`);
          setIsChatOpen(true);
          triggerGeneration(`Execute Phase: ${phase.title}`);
      }
  };

  return {
      activeAgentTask,
      activeAgent,
      isGeneratingPlan,
      taskHistory,
      handleStartAgentTask,
      handleCancelAgentTask,
      handleGeneratePlan,
      handleExecutePhase,
      setActiveAgentTask,
      revertLastAgentRun,
      isWorking: activeAgentTask?.status === 'running'
  };
};
