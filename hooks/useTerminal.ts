
import React, { useState, useCallback } from 'react';
import { FileNode, ProjectType } from '../types';
import { generateTerminalCommand } from '../services/geminiService';
import { getAllFiles } from '../utils/fileHelpers';

interface UseTerminalProps {
  files: FileNode[];
  setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>;
  activeFileId: string;
  projectType: ProjectType;
  addFile: (path: string, content: string) => void;
  addPackage?: (name: string, isDev: boolean) => void;
  onLog: (msg: string) => void;
  onRequestFix?: (errorMsg: string) => void; // New delegate
}

export const useTerminal = ({ 
  files, setFiles, activeFileId, projectType, addFile, addPackage, onLog, onRequestFix
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
            // Auto-run
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
            onLog('Available commands: ls, cd, cat, mkdir, touch, rm, npm, git, clear, ? (AI)');
            break;
        case 'clear':
            onLog('--- Terminal Cleared ---');
            break;
        case 'ls':
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
                if (args[1] && addPackage) {
                    const pkgName = args[1];
                    const isDev = args.includes('-D') || args.includes('--save-dev');
                    addPackage(pkgName, isDev);
                    onLog(`> npm install ${pkgName}`);
                    await new Promise(r => setTimeout(r, 1000));
                    onLog(`added ${pkgName} in 1s`);
                } else {
                    onLog('> npm install');
                    await new Promise(r => setTimeout(r, 1000));
                    onLog('added 142 packages in 1s');
                }
            } else if (args[0] === 'start') {
                onLog('> npm start');
                onLog('> Starting development server...');
                onLog('> Ready on http://localhost:3000');
            } else if (args[0] === 'test') {
                onLog('> npm test');
                onLog('Running tests...');
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
  }, [files, cwd, projectType, addFile, addPackage, onLog]);

  const handleAiFix = useCallback(async (errorMsg: string) => {
      if (onRequestFix) {
          onRequestFix(errorMsg);
      } else {
          onLog("AI Agents unavailable for fix.");
      }
  }, [onRequestFix, onLog]);

  return {
      handleCommand,
      handleAiFix,
      cwd
  };
};
