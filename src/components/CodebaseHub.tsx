import React, { useState } from 'react';
import JSZip from 'jszip';
import { 
  FileCode2, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  Folder, 
  FolderOpen, 
  File, 
  ExternalLink,
  ChevronRight,
  BookOpen,
  Sparkles,
  Server
} from 'lucide-react';
import { BOT_FILES, BotFile } from '../data/botFiles';

export const CodebaseHub: React.FC = () => {
  const [selectedFilePath, setSelectedFilePath] = useState<string>('bot/main.py');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'files' | 'deployment'>('files');

  const selectedFile = BOT_FILES.find(f => f.path === selectedFilePath) || BOT_FILES[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();

      // Add all bot files to the zip archive
      for (const file of BOT_FILES) {
        zip.file(file.path, file.content);
      }

      // Generate the zip blob
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fastvpn_3xui_telegram_bot.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating zip:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 text-slate-100 space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileCode2 className="w-6 h-6 text-cyan-400" />
              Python aiogram 3 Bot Codebase
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
              Production Ready
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            This entire modular bot is built with asynchronous Python 3.11, aiogram 3, aiosqlite, and 3x-ui REST API integration. You can inspect all files, copy code, or download the full ZIP bundle to deploy on any VPS.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('deployment')}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              activeTab === 'deployment'
                ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/60'
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-300" />
            <span>VPS Setup Guide</span>
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Packaging ZIP...' : 'Download Bot ZIP'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'deployment' ? (
        /* VPS Deployment Guide */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              How to Deploy the Bot on Your Linux VPS (Ubuntu / Debian)
            </h3>
            <button
              onClick={() => setActiveTab('files')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium"
            >
              ← Back to File Explorer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Option A: Docker Compose */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  A
                </span>
                <h4 className="font-bold text-sm text-white">Method 1: Docker Compose (Recommended)</h4>
              </div>
              <p className="text-slate-400">
                Guarantees all Python dependencies, SQLite libraries, and QR generator tools run in an isolated container.
              </p>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 space-y-1">
                <p className="text-slate-500"># 1. Unzip the downloaded archive</p>
                <p>unzip fastvpn_3xui_telegram_bot.zip -d vpn_bot</p>
                <p>cd vpn_bot</p>
                <p className="text-slate-500"># 2. Configure .env with your bot token &amp; 3x-ui URL</p>
                <p>cp bot/.env.example .env</p>
                <p>nano .env</p>
                <p className="text-slate-500"># 3. Start container in background</p>
                <p>docker compose up -d --build</p>
                <p className="text-slate-500"># 4. View real-time logs</p>
                <p>docker compose logs -f</p>
              </div>
            </div>

            {/* Option B: Native Python Systemd */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                  B
                </span>
                <h4 className="font-bold text-sm text-white">Method 2: Native Python Virtualenv</h4>
              </div>
              <p className="text-slate-400">
                Run directly on Ubuntu/Debian with systemd service for auto-restart on boot.
              </p>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-300 space-y-1">
                <p className="text-slate-500"># 1. Install Python 3.11 &amp; venv</p>
                <p>sudo apt update &amp;&amp; sudo apt install -y python3 python3-venv</p>
                <p className="text-slate-500"># 2. Setup virtual environment</p>
                <p>python3 -m venv venv &amp;&amp; source venv/bin/activate</p>
                <p>pip install -r bot/requirements.txt</p>
                <p className="text-slate-500"># 3. Run the bot</p>
                <p>python -m bot.main</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* File Explorer and Code Viewer */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File Tree Sidebar */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-blue-400" />
                Bot Files ({BOT_FILES.length})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                aiogram 3
              </span>
            </div>

            <div className="space-y-1">
              {BOT_FILES.map((file) => {
                const isSelected = file.path === selectedFilePath;
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FileCode2 className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span className="truncate">{file.path}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono uppercase">
                      {file.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Code Viewer Panel */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
            {/* Code Header */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-mono text-xs font-bold text-cyan-300">{selectedFile.path}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{selectedFile.description}</p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 transition-all"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
            </div>

            {/* Code Text Body with Line Numbers */}
            <div className="p-4 bg-slate-950 overflow-x-auto max-h-[580px] font-mono text-xs leading-relaxed text-slate-200 divide-y divide-transparent">
              <pre className="text-slate-300">
                {selectedFile.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
