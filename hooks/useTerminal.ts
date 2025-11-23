
import React, { useState, useCallback } from 'react';
import { FileNode, ProjectType, AIAgent } from '../types';
import { generateTerminalCommand, runAgentFileTask } from '../services/geminiService';
import { getAllFiles, findFileById } from '../utils/fileHelpers';

interface UseTerminalProps {
  files: FileNode[];
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>;
  activeFileId: string;
  projectType: ProjectType;
  addFile: (path: string, content: string) => void;
  onLog: (msg: string) => void;
}

export const useTerminal = ({ 
  files, setFiles, activeFileId, projectType, addFile, onLog 
}: UseTerminalProps) => {
  const [cwd, setCwd] = useState<string>('/');

  const handleCommand = useCallback(async (input: string) => {
    const cmd = input.trim();
    if (!cmd) return;

    // AI Command
    if (cmd.startsWith('?')) {
        const query = cmd.substring(1).trim();
        onLog(`> AI: Analyzing "${query}"...`);
        const translatedCmd = await generateTerminalCommand(query, projectType);
        if (translatedCmd && !translatedCmd.includes('Error')) {
            onLog(`> AI suggests: ${translatedCmd}`);
            // Recursively call handleCommand with the suggestion? 
            // For safety, we just put it in input or auto-run. Let's auto-run for "magic" feel.
            handleCommand(translatedCmd);
        } else {
            onLog(`> AI Error: Could not translate command.`);
        }
        return;
    }

    // Shell Commands
    const parts = cmd.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    switch (command) {
        case 'help':
            onLog('Available commands: ls, cd, cat, mkdir, touch, rm, npm, git, clear');
            break;
        case 'clear':
            // Handled by UI clearing logs usually, but we assume logs prop handles append.
            // In this architecture, we can't clear parent logs easily without a clear callback.
            onLog('--- Terminal Cleared ---');
            break;
        case 'ls':
            const currentDirFiles = cwd === '/' ? files : 
                getAllFiles(files).filter(f => {
                    const pathParts = f.path.split('/');
                    // loose matching for demo
                    return f.path.startsWith(cwd.substring(1)); 
                }).map(f => f.node);
            
            // Simplified listing
            const list = getAllFiles(files).map(f => f.path).join('\n');
            onLog(list);
            break;
        case 'cd':
            const target = args[0];
            if (!target || target === '/') {
                setCwd('/');
            } else {
                setCwd(target.startsWith('/') ? target : `${cwd === '/' ? '' : cwd}/${target}`);
            }
            onLog(`> cwd: ${cwd}`);
            break;
        case 'cat':
            const targetFile = args[0];
            const found = getAllFiles(files).find(f => f.path.endsWith(targetFile) || f.node.name === targetFile);
            if (found) {
                onLog(found.node.content || '(empty)');
            } else {
                onLog(`cat: ${targetFile}: No such file`);
            }
            break;
        case 'touch':
            const newFileName = args[0];
            if (newFileName) {
                addFile(newFileName, '');
                onLog(`Created ${newFileName}`);
            }
            break;
        case 'npm':
            if (args[0] === 'install' || args[0] === 'i') {
                onLog('> npm install');
                await new Promise(r => setTimeout(r, 1000));
                onLog('added 142 packages in 1s');
            } else if (args[0] === 'start') {
                onLog('> npm start');
                onLog('> Starting development server...');
                onLog('> Ready on http://localhost:3000');
            } else if (args[0] === 'test') {
                onLog('> npm test');
                onLog('PASS src/App.test.tsx');
                onLog('PASS src/utils/helpers.test.ts');
                onLog('Test Suites: 2 passed, 2 total');
            } else {
                onLog(`npm: command not found: ${args[0]}`);
            }
            break;
        case 'git':
            if (args[0] === 'status') {
                onLog('On branch main');
                onLog('Changes not staged for commit:');
                getAllFiles(files).filter(f => f.node.gitStatus === 'modified').forEach(f => {
                    onLog(`  modified: ${f.path}`);
                });
            } else if (args[0] === 'commit') {
                onLog('[main] Commit successful.');
            } else {
                onLog(`git: unknown command: ${args[0]}`);
            }
            break;
        default:
            onLog(`sh: command not found: ${command}`);
    }
  }, [files, cwd, projectType, addFile, onLog]);

  const handleAiFix = useCallback(async (errorMsg: string) => {
      onLog(`> Omni-Agent: Analyzing error "${errorMsg.substring(0, 30)}..."`);
      
      // Heuristic to find relevant file
      const allFiles = getAllFiles(files);
      let targetFile = allFiles.find(f => f.node.id === activeFileId)?.node;
      
      if (!targetFile) return;

      onLog(`> Omni-Agent: Attempting fix on ${targetFile.name}...`);
      
      const fixerAgent: AIAgent = {
          id: 'terminal-fixer',
          name: 'Terminal Fixer',
          role: 'Debugger',
          description: 'Automated fixer for terminal errors',
          model: 'gemini-2.5-flash',
          systemPrompt: `You are an expert debugger. A user ran into this error: "${errorMsg}". Fix the code.`
      };

      const fixedCode = await runAgentFileTask(fixerAgent, targetFile.name, targetFile.content || '');
      
      if (fixedCode) {
          const filenameMatch = fixedCode.match(/^\/\/ filename: (.*)/);
          const targetPath = filenameMatch ? filenameMatch[1].trim() : targetFile.name;
          addFile(targetPath, fixedCode);
          onLog(`> Omni-Agent: Applied fix to ${targetPath}.`);
      } else {
          onLog(`> Omni-Agent: Could not generate a fix.`);
      }
  }, [files, activeFileId, addFile, onLog]);

  return {
      handleCommand,
      handleAiFix,
      cwd
  };
};
