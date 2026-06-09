import { useState, useEffect, useRef } from 'react';
import { FolderOpen, Terminal, GitBranch, File, Folder, ArrowLeft, RefreshCw, Send, GitCommit as GitCommitIcon, Upload } from 'lucide-react';
import { api, WorkspaceEntry, GitStatus, GitCommit, TerminalResult } from '../lib/api';

interface TerminalHistory {
  command: string;
  result: TerminalResult;
  timestamp: number;
}

export default function Workspace() {
  const [tab, setTab] = useState<'files' | 'terminal' | 'git'>('files');

  // File Browser State
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [filesLoading, setFilesLoading] = useState(false);

  // Terminal State
  const [terminalHistory, setTerminalHistory] = useState<TerminalHistory[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Git State
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFileForDiff, setSelectedFileForDiff] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');
  const [gitLoading, setGitLoading] = useState(false);

  // Load file entries
  const loadFiles = async (path: string) => {
    setFilesLoading(true);
    try {
      const result = await api.workspace.ls(path);
      setEntries(result.entries);
      setCurrentPath(path);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setFilesLoading(false);
    }
  };

  // Load file content
  const loadFileContent = async (filePath: string) => {
    try {
      const result = await api.workspace.read(filePath);
      setFileContent(result.content);
      setSelectedFile(filePath);
    } catch (err) {
      console.error('Failed to read file:', err);
      setFileContent(`Error reading file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Execute terminal command
  const executeCommand = async () => {
    if (!currentCommand.trim() || terminalLoading) return;

    setTerminalLoading(true);
    const command = currentCommand.trim();
    setCurrentCommand('');

    // Add to command history
    setCommandHistory(prev => [...prev, command].slice(-50));
    setHistoryIndex(-1);

    try {
      const result = await api.terminal.exec(command);
      const entry: TerminalHistory = {
        command,
        result,
        timestamp: Date.now()
      };
      setTerminalHistory(prev => [...prev, entry]);
    } catch (err) {
      const entry: TerminalHistory = {
        command,
        result: {
          output: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          exitCode: 1
        },
        timestamp: Date.now()
      };
      setTerminalHistory(prev => [...prev, entry]);
    } finally {
      setTerminalLoading(false);
    }
  };

  // Load git status
  const loadGitStatus = async () => {
    setGitLoading(true);
    try {
      const [statusResult, commitsResult] = await Promise.all([
        api.git.status(),
        api.git.log(10)
      ]);
      setGitStatus(statusResult);
      setCommits(commitsResult.commits);
    } catch (err) {
      console.error('Failed to load git status:', err);
    } finally {
      setGitLoading(false);
    }
  };

  // Load git diff
  const loadGitDiff = async (filePath: string) => {
    try {
      const result = await api.git.diff(filePath);
      setDiffContent(result.diff);
      setSelectedFileForDiff(filePath);
    } catch (err) {
      console.error('Failed to load diff:', err);
      setDiffContent(`Error loading diff: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Git commit
  const commitChanges = async () => {
    if (!commitMessage.trim()) return;
    try {
      await api.git.commit(commitMessage);
      setCommitMessage('');
      await loadGitStatus(); // Refresh status
    } catch (err) {
      console.error('Commit failed:', err);
    }
  };

  // Git push
  const pushChanges = async () => {
    try {
      await api.git.push();
      await loadGitStatus(); // Refresh status
    } catch (err) {
      console.error('Push failed:', err);
    }
  };

  // Handle keyboard navigation in terminal
  const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < 0 ? commandHistory.length - 1 : Math.max(historyIndex - 1, 0);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    }
  };

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalHistory, terminalLoading]);

  // Load initial data
  useEffect(() => {
    if (tab === 'files') {
      loadFiles('/');
    } else if (tab === 'git') {
      loadGitStatus();
    }
  }, [tab]);

  return (
    <div className="max-w-7xl space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text flex items-center gap-2">
          <FolderOpen size={18} className="text-amber" />Workspace
        </h1>
        <p className="text-dim text-xs mt-0.5">File browsing, terminal, and git management</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        {[
          { id: 'files', label: 'File Browser', Icon: File },
          { id: 'terminal', label: 'Terminal', Icon: Terminal },
          { id: 'git', label: 'Git', Icon: GitBranch }
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={[
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === id
                ? 'text-amber border-amber'
                : 'text-dim hover:text-text border-transparent'
            ].join(' ')}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* File Browser Tab */}
      {tab === 'files' && (
        <div className="grid grid-cols-2 gap-6">
          {/* File Tree */}
          <div className="bg-surface border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder size={14} className="text-amber" />
                <span className="text-text text-sm font-medium">Files</span>
                <span className="text-faint text-xs">/{currentPath}</span>
              </div>
              <button
                onClick={() => loadFiles(currentPath)}
                disabled={filesLoading}
                className="text-dim hover:text-text transition-colors"
              >
                <RefreshCw size={14} className={filesLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="p-4 space-y-1 max-h-96 overflow-y-auto">
              {currentPath !== '/' && (
                <button
                  onClick={() => {
                    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
                    loadFiles(parentPath);
                  }}
                  className="flex items-center gap-2 w-full p-2 text-xs text-dim hover:text-text hover:bg-raised rounded"
                >
                  <ArrowLeft size={12} />
                  ..
                </button>
              )}

              {entries.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => {
                    if (entry.type === 'dir') {
                      const newPath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
                      loadFiles(newPath);
                    } else {
                      const filePath = currentPath === '/' ? `/${entry.name}` : `${currentPath}/${entry.name}`;
                      loadFileContent(filePath);
                    }
                  }}
                  className="flex items-center gap-2 w-full p-2 text-xs text-text hover:bg-raised rounded transition-colors"
                >
                  {entry.type === 'dir' ? (
                    <Folder size={14} className="text-blue" />
                  ) : (
                    <File size={14} className="text-dim" />
                  )}
                  <span className="flex-1 text-left">{entry.name}</span>
                  <span className="text-faint text-[10px]">
                    {entry.type === 'file' && entry.size < 1024 ? `${entry.size}b` :
                     entry.type === 'file' && entry.size < 1024 * 1024 ? `${Math.round(entry.size / 1024)}kb` :
                     entry.type === 'file' ? `${Math.round(entry.size / 1024 / 1024)}mb` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* File Content Viewer */}
          <div className="bg-surface border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <File size={14} className="text-amber" />
                <span className="text-text text-sm font-medium">
                  {selectedFile ? selectedFile.split('/').pop() : 'Select a file'}
                </span>
              </div>
            </div>

            <div className="p-4">
              {selectedFile ? (
                <pre className="text-xs font-mono text-text bg-raised border border-border rounded p-3 overflow-auto max-h-80 whitespace-pre-wrap">
                  {fileContent}
                </pre>
              ) : (
                <div className="text-center text-dim py-12">
                  Click on a file to view its contents
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Terminal Tab */}
      {tab === 'terminal' && (
        <div className="bg-surface border border-border rounded-lg" style={{ height: '500px' }}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-amber" />
              <span className="text-text text-sm font-medium">Terminal</span>
            </div>
            <button
              onClick={() => setTerminalHistory([])}
              className="text-dim hover:text-text text-xs transition-colors"
            >
              Clear
            </button>
          </div>

          <div ref={terminalRef} className="p-4 overflow-y-auto font-mono text-sm" style={{ height: 'calc(100% - 120px)' }}>
            {terminalHistory.map((entry, i) => (
              <div key={i} className="mb-4">
                <div className="text-green">
                  $ {entry.command}
                </div>
                <div className={`mt-1 whitespace-pre-wrap ${
                  entry.result.exitCode === 0 ? 'text-text' : 'text-red'
                }`}>
                  {entry.result.output}
                </div>
              </div>
            ))}

            {terminalLoading && (
              <div className="text-amber animate-pulse">
                Executing command...
              </div>
            )}
          </div>

          <div className="border-t border-border p-4 flex items-center gap-3">
            <span className="text-green font-mono text-sm">$</span>
            <input
              type="text"
              value={currentCommand}
              onChange={(e) => setCurrentCommand(e.target.value)}
              onKeyDown={handleTerminalKeyDown}
              placeholder="Enter command... (↑↓ for history)"
              className="flex-1 bg-raised border border-border rounded px-3 py-2 text-sm text-text font-mono placeholder:text-faint focus:outline-none focus:border-border2"
              disabled={terminalLoading}
            />
            <button
              onClick={executeCommand}
              disabled={!currentCommand.trim() || terminalLoading}
              className="bg-amber text-bg px-3 py-2 rounded text-sm font-bold disabled:opacity-40"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Git Tab */}
      {tab === 'git' && (
        <div className="grid grid-cols-3 gap-6">
          {/* Git Status */}
          <div className="bg-surface border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch size={14} className="text-amber" />
                <span className="text-text text-sm font-medium">Status</span>
              </div>
              <button
                onClick={loadGitStatus}
                disabled={gitLoading}
                className="text-dim hover:text-text transition-colors"
              >
                <RefreshCw size={14} className={gitLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {gitStatus && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-dim text-xs">Branch:</span>
                    <span className="text-text text-sm font-medium">{gitStatus.branch}</span>
                  </div>

                  {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                    <div className="flex items-center gap-4 text-xs">
                      {gitStatus.ahead > 0 && (
                        <span className="text-green">↑{gitStatus.ahead}</span>
                      )}
                      {gitStatus.behind > 0 && (
                        <span className="text-red">↓{gitStatus.behind}</span>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-dim text-xs">Changed files:</div>
                    {gitStatus.changes.length === 0 ? (
                      <div className="text-faint text-xs">No changes</div>
                    ) : (
                      <div className="space-y-1">
                        {gitStatus.changes.map((change, i) => (
                          <button
                            key={i}
                            onClick={() => loadGitDiff(change.path)}
                            className="flex items-center gap-2 w-full p-2 text-xs text-text hover:bg-raised rounded transition-colors"
                          >
                            <span className={`font-mono ${
                              change.status.includes('M') ? 'text-amber' :
                              change.status.includes('A') ? 'text-green' :
                              change.status.includes('D') ? 'text-red' : 'text-dim'
                            }`}>
                              {change.status}
                            </span>
                            <span className="flex-1 text-left truncate">{change.path}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {gitStatus.changes.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <input
                        type="text"
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Commit message..."
                        className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={commitChanges}
                          disabled={!commitMessage.trim()}
                          className="flex-1 bg-amber text-bg px-3 py-2 rounded text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1"
                        >
                          <GitCommitIcon size={12} />
                          Commit
                        </button>
                        {gitStatus.ahead > 0 && (
                          <button
                            onClick={pushChanges}
                            className="bg-green text-white px-3 py-2 rounded text-xs font-bold flex items-center gap-1"
                          >
                            <Upload size={12} />
                            Push
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Commit History */}
          <div className="bg-surface border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <GitCommitIcon size={14} className="text-amber" />
                <span className="text-text text-sm font-medium">Recent Commits</span>
              </div>
            </div>

            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {commits.map((commit, i) => (
                <div key={commit.hash} className="space-y-1">
                  <div className="text-xs text-text font-mono">{commit.hash.slice(0, 8)}</div>
                  <div className="text-xs text-text">{commit.message}</div>
                  <div className="text-faint text-[10px]">
                    {commit.author} • {new Date(commit.date).toLocaleDateString()}
                  </div>
                  {i < commits.length - 1 && <div className="border-b border-border mt-2" />}
                </div>
              ))}
            </div>
          </div>

          {/* Diff Viewer */}
          <div className="bg-surface border border-border rounded-lg">
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <File size={14} className="text-amber" />
                <span className="text-text text-sm font-medium">
                  {selectedFileForDiff ? selectedFileForDiff : 'Diff'}
                </span>
              </div>
            </div>

            <div className="p-4">
              {selectedFileForDiff ? (
                <pre className="text-xs font-mono text-text bg-raised border border-border rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                  {diffContent}
                </pre>
              ) : (
                <div className="text-center text-dim py-12 text-xs">
                  Click on a changed file to view diff
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}