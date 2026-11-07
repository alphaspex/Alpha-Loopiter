import React, { useState } from 'react';
import LoopiterAgentView from './components/LoopiterAgentView';
import SavedTasksView from './components/SavedTasksView';
import SettingsView from './components/SettingsView';
import { Zap, Database, Settings } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'agent' | 'saved' | 'settings'>('agent');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col w-full overflow-x-hidden selection:bg-indigo-600/30 selection:text-indigo-200">
      {/* Top Bar Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 w-full">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30 text-sm">
              α
            </div>
            <span className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
              Alpha Loopiter
            </span>
          </div>

          {/* Navigation Segmented Tabs */}
          <nav className="flex items-center gap-1 p-0.5 sm:p-1 bg-slate-950 rounded-lg border border-slate-800/80 shrink-0">
            <button
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'agent'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Agent</span>
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'saved'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Saved</span>
              <span className="xs:hidden">Tasks</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Model Badge */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/80 rounded-md px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ternary-bonsai-27b
            </span>
          </div>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-2 sm:p-4 md:p-6 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'agent' && <LoopiterAgentView />}
        {activeTab === 'saved' && <SavedTasksView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-2.5 px-4 text-center text-[11px] text-slate-500 font-mono shrink-0">
        Alpha Loopiter Engine &bull; Render Docker &bull; PostgreSQL Persistent Memory
      </footer>
    </div>
  );
}
