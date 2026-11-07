import React, { useState } from 'react';
import LoopiterAgentView from './components/LoopiterAgentView';
import SavedTasksView from './components/SavedTasksView';
import SettingsView from './components/SettingsView';
import { Zap, Database, Settings, Terminal } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'agent' | 'saved' | 'settings'>('agent');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Bar Contract Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-8">
          {/* Zone 1: Single element brand wordmark */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/30">
              α
            </div>
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              Alpha Loopiter
            </span>
          </div>

          {/* Zone 2: Navigation Tabs */}
          <nav className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('agent')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'agent'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              ⚡ Loopiter Agent
            </button>

            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'saved'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              📚 Saved Tasks
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              ⚙️ Agent Settings
            </button>
          </nav>

          {/* Zone 3: Single primary action status */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800/80 rounded-md px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              ternary-bonsai-27b
            </span>
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'agent' && <LoopiterAgentView />}
        {activeTab === 'saved' && <SavedTasksView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        Alpha Loopiter AI Agent Engine &bull; Render Docker & PostgreSQL Persistent Memory &bull; 2026
      </footer>
    </div>
  );
}
