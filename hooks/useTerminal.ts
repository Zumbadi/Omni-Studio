
import React, { useState, useCallback } from 'react';
import { FileNode, ProjectType } from '../types';
import { generateTerminalCommand } from '../services/geminiService';
import { getAllFiles, upsertFileByPath, findNodeByPath } from '../utils/fileHelpers';

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

  const resolvePath = (path: string) => {
      if (path.startsWith('/')) return path;
      if (path === '..') {
          const parts = cwd.split('/');
          parts.pop();
          return parts.join('/') || '/';
      }
      return `${cwd === '/' ? '' : cwd}/${path}`;
  };

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
            onLog('Available commands: ls, cd, cat, mkdir, touch, rm, cp, mv, npm, git, clear, ? (AI)');
            break;
        case 'clear':
            onLog('--- Terminal Cleared ---');
            break;
        case 'ls':
            const all = getAllFiles(files);
            const currentDirFiles = all.filter(f => {
                const fPath = '/' + f.path;
                if (cwd === '/') return !fPath.substring(1).includes('/');
                return fPath.startsWith(cwd + '/') && !fPath.substring(cwd.length + 1).includes('/');
            });
            
            if (currentDirFiles.length === 0) {
                onLog('(empty directory)');
            } else {
                onLog(currentDirFiles.map(f => f.node.name + (f.node.type === 'directory' ? '/' : '')).join('  '));
            }
            break;
        case 'cd':
            const target = args[0];
            if (!target || target === '/') {
                setCwd('/');
            } else {
                const newPath = resolvePath(target);
                // Verify path exists (basic check)
                const exists = getAllFiles(files).some(f => ('/' + f.path).startsWith(newPath));
                if (exists || newPath === '/') {
                    setCwd(newPath);
                    onLog(`> cwd: ${newPath}`);
                } else {
                    onLog(`cd: ${target}: No such directory`);
                }
            }
            break;
        case 'cat':
            const targetFile = args[0];
            const fullPath = resolvePath(targetFile).substring(1); // remove leading slash
            const found = getAllFiles(files).find(f => f.path === fullPath || f.node.name === targetFile);
            if (found) {
                onLog(found.node.content || '(empty)');
            } else {
                onLog(`cat: ${targetFile}: No such file`);
            }
            break;
        case 'touch':
            const newFileName = args[0];
            if (newFileName) {
                const path = cwd === '/' ? newFileName : `${cwd.substring(1)}/${newFileName}`;
                addFile(path, '');
                onLog(`Created ${newFileName}`);
            }
            break;
        case 'mkdir':
            const dirName = args[0];
            if (dirName) {
                const path = cwd === '/' ? dirName : `${cwd.substring(1)}/${dirName}`;
                // Using addFile as upsertFileByPath handles intermediate dirs. 
                // We create a hidden file to enforce directory creation.
                addFile(`${path}/.keep`, '');
                onLog(`Created directory ${dirName}`);
            }
            break;
        case 'rm':
            const rmTarget = args[0];
            if (rmTarget) {
                const path = resolvePath(rmTarget).substring(1);
                // Filter out the file
                setFiles(prev => {
                    const remove = (nodes: FileNode[]): FileNode[] => nodes.filter(n => {
                        return n.name !== rmTarget; // Simplistic match, real system needs full path matching logic
                    }).map(n => ({...n, children: n.children ? remove(n.children) : undefined}));
                    return remove(prev);
                });
                onLog(`Removed ${rmTarget}`);
            }
            break;
        case 'cp':
            const src = args[0];
            const dest = args[1];
            if (src && dest) {
                const srcPath = resolvePath(src).substring(1);
                const destPath = resolvePath(dest).substring(1);
                const sourceNode = findNodeByPath(files, srcPath);
                
                if (sourceNode && sourceNode.content !== undefined) {
                    addFile(destPath, sourceNode.content);
                    onLog(`Copied ${src} to ${dest}`);
                } else {
                    onLog(`cp: ${src}: No such file`);
                }
            } else {
                onLog(`usage: cp source_file dest_file`);
            }
            break;
        case 'mv':
            const mvSrc = args[0];
            const mvDest = args[1];
            if (mvSrc && mvDest) {
                const srcPath = resolvePath(mvSrc).substring(1);
                const destPath = resolvePath(mvDest).substring(1);
                const sourceNode = findNodeByPath(files, srcPath);
                
                if (sourceNode && sourceNode.content !== undefined) {
                    // Copy
                    addFile(destPath, sourceNode.content);
                    // Remove original
                    setFiles(prev => {
                        const remove = (nodes: FileNode[]): FileNode[] => nodes.filter(n => {
                            return n.name !== mvSrc; 
                        }).map(n => ({...n, children: n.children ? remove(n.children) : undefined}));
                        return remove(prev);
                    });
                    onLog(`Moved ${mvSrc} to ${mvDest}`);
                } else {
                    onLog(`mv: ${mvSrc}: No such file`);
                }
            } else {
                onLog(`usage: mv source_file dest_file`);
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
                
                const allFiles = getAllFiles(files);
                const testFiles = allFiles.filter(f => f.node.name.includes('.test.') || f.node.name.includes('.spec.'));
                
                if (testFiles.length === 0) {
                    setTimeout(() => onLog('No test files found. Try creating a .test.tsx file.'), 500);
                } else {
                    setTimeout(() => {
                        testFiles.forEach(f => {
                            const isPass = Math.random() > 0.3;
                            if (isPass) {
                                onLog(` PASS  ${f.path}`);
                            } else {
                                onLog(` FAIL  ${f.path}`);
                                onLog(`  ● Test suite failed to run`);
                                onLog(`    ReferenceError: Component is not defined`);
                            }
                        });
                        const passed = Math.floor(Math.random() * testFiles.length);
                        onLog(`\nTest Suites: ${passed} passed, ${testFiles.length - passed} failed, ${testFiles.length} total`);
                        onLog(`Time:        ${(Math.random() * 2 + 0.5).toFixed(3)} s`);
                        onLog(`Ran all test suites.`);
                    }, 1500);
                }
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
