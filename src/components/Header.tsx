import React from 'react';
import { 
  Bot, 
  Server, 
  FileCode2, 
  Settings, 
  ShieldCheck, 
  Bell, 
  Zap,
  Activity
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'simulator' | 'xui' | 'codebase' | 'settings';
  setActiveTab: (tab: 'simulator' | 'xui' | 'codebase' | 'settings') => void;
  pendingReceiptsCount: number;
  activeConfigsCount: number;
  userBalance: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingReceiptsCount,
  activeConfigsCount,
  userBalance
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">FastVPN</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                  3x-UI Bot
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  aiogram 3
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Automated VPN Sales &amp; 3x-UI Panel Integration</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60" aria-label="Main Navigation">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'simulator'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>Telegram Bot</span>
              {pendingReceiptsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-900 animate-bounce">
                  {pendingReceiptsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('xui')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'xui'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>3x-UI Panel</span>
              <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded bg-slate-700 text-slate-300 font-mono">
                {activeConfigsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('codebase')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'codebase'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              <span>Python Bot Files</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </nav>

          {/* Quick Metrics */}
          <div className="hidden lg:flex items-center space-x-4 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">3x-UI:</span>
              <span className="font-semibold text-emerald-400">Online</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Test User:</span>
              <span className="font-semibold text-cyan-300">${userBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
