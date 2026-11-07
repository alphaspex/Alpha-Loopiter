import React, { useState, useEffect } from 'react';
import {
  fetchSystemPromptsIO,
  saveSystemPromptsIO,
  fetchTasksIO,
  deleteTaskIO,
  bulkDeleteTasksIO,
  SystemPrompts,
  TaskSession
} from '../services/api_io';
import {
  Save,
  RotateCcw,
  CheckCircle2,
  Trash2,
  MessageSquare,
  AlertTriangle,
  Sliders,
  Database
} from 'lucide-react';

interface StageMeta {
  key: string;
  title: string;
  description: string;
}

const STAGE_METADATA: StageMeta[] = [
  { key: 'clarifier', title: '1. Clarifier Agent Prompt', description: 'Used during initial task intake to generate 2-4 clarifying questions.' },
  { key: 'concept_planner', title: '2. Concept Planner Agent Prompt', description: 'Generates the high-level concept plan for initial user approval.' },
  { key: 'detailed_planner', title: '3. Detailed Master Planner Prompt', description: 'Generates the full master plan with technical breakdown and phases.' },
  { key: 'goal_auditor', title: '4. Phase Goal Auditor Prompt', description: 'Audits phase goal decomposition for completeness and independence.' },
  { key: 'tiny_goal_auditor', title: '5. Sub-Goal Auditor Prompt', description: 'Audits tiny goals for black-box I/O clarity.' },
  { key: 'tiny_goal_worker', title: '6. Tiny Goal Worker Prompt', description: 'Executes individual micro-tasks and outputs full deliverables.' },
  { key: 'section_synthesizer', title: '7. Section Synthesizer Prompt', description: 'Combines finished tiny goals into a cohesive section deliverable.' },
  { key: 'final_auditor', title: '8. Final Product Synthesizer Prompt', description: 'Assembles and shapes the final product for final sign-off.' },
  { key: 'summarizer', title: 'Memory Summarizer Prompt', description: 'Generates 20-30 word summaries every 20 messages for PostgreSQL persistence.' },
  { key: 'chat_agent', title: 'General Loopiter Agent Prompt', description: 'Fallback system prompt for direct agent task interactions.' },
];

export default function SettingsView() {
  const [activeSubTab, setActiveSubTab] = useState<'prompts' | 'storage'>('prompts');

  // Prompts State
  const [prompts, setPrompts] = useState<SystemPrompts>({});
  const [defaults, setDefaults] = useState<SystemPrompts>({});
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Chat Storage Management State
  const [tasks, setTasks] = useState<TaskSession[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [deletingTasks, setDeletingTasks] = useState(false);

  useEffect(() => {
    loadPrompts();
    loadTasks();
  }, []);

  const loadPrompts = async () => {
    setLoadingPrompts(true);
    const data = await fetchSystemPromptsIO();
    setPrompts(data.prompts);
    setDefaults(data.defaults);
    setLoadingPrompts(false);
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    const list = await fetchTasksIO();
    setTasks(list);
    setLoadingTasks(false);
  };

  const handlePromptChange = (key: string, value: string) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
  };

  const handleSavePrompts = async () => {
    setSavingPrompts(true);
    const success = await saveSystemPromptsIO(prompts);
    setSavingPrompts(false);
    if (success) {
      notify('Prompts saved successfully to database & localStorage!');
    }
  };

  const handleResetToDefault = (key?: string) => {
    if (key) {
      setPrompts(prev => ({ ...prev, [key]: defaults[key] || '' }));
    } else {
      setPrompts({ ...defaults });
    }
    notify('Reset to default system prompts.');
  };

  const notify = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Toggle selection for a task
  const handleToggleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAllTasks = () => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map(t => t.id));
    }
  };

  // Delete Single Task
  const handleDeleteSingleTask = async (taskId: string) => {
    if (confirm('Delete this chat and its messages from the database?')) {
      setDeletingTasks(true);
      await deleteTaskIO(taskId);
      await loadTasks();
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
      setDeletingTasks(false);
      notify('Chat deleted from database.');
    }
  };

  // Bulk Delete Selected Tasks
  const handleDeleteSelectedTasks = async () => {
    if (selectedTaskIds.length === 0) return;
    if (confirm(`Delete ${selectedTaskIds.length} selected chats and their persistent memory from the database?`)) {
      setDeletingTasks(true);
      const count = await bulkDeleteTasksIO(selectedTaskIds);
      await loadTasks();
      setSelectedTaskIds([]);
      setDeletingTasks(false);
      notify(`Successfully deleted ${count} chats from database.`);
    }
  };

  // Delete All Chats
  const handleClearAllChats = async () => {
    if (tasks.length === 0) return;
    if (confirm(`Are you sure you want to delete ALL ${tasks.length} saved chats from the database? This cannot be undone.`)) {
      setDeletingTasks(true);
      const allIds = tasks.map(t => t.id);
      const count = await bulkDeleteTasksIO(allIds);
      await loadTasks();
      setSelectedTaskIds([]);
      setDeletingTasks(false);
      notify(`All ${count} chats have been deleted from the database.`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Agent & Storage Settings</h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure system prompts for every autonomous call type and manage saved chat history stored in PostgreSQL.
          </p>
        </div>

        {/* Section Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveSubTab('prompts')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'prompts'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            System Prompts
          </button>
          <button
            onClick={() => {
              setActiveSubTab('storage');
              loadTasks();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeSubTab === 'storage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Chat Storage & History ({tasks.length})
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs rounded-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. System Prompts Editor */}
      {activeSubTab === 'prompts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-slate-400 font-mono">
              Custom prompts are injected for Eden AI calls across all 8 autonomous stages.
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleResetToDefault()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All Defaults
              </button>
              <button
                onClick={handleSavePrompts}
                disabled={savingPrompts}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingPrompts ? 'Saving...' : 'Save Prompts'}
              </button>
            </div>
          </div>

          {loadingPrompts ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">Loading system prompts...</div>
          ) : (
            <div className="space-y-4">
              {STAGE_METADATA.map(meta => {
                const currentVal = prompts[meta.key] || '';
                const isModified = currentVal !== (defaults[meta.key] || '');

                return (
                  <div key={meta.key} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-200">{meta.title}</h3>
                          {isModified && (
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded">
                              Customized
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{meta.description}</p>
                      </div>
                      <button
                        onClick={() => handleResetToDefault(meta.key)}
                        className="text-xs text-slate-400 hover:text-slate-200 transition-colors shrink-0"
                        title="Reset this prompt to default"
                      >
                        Reset
                      </button>
                    </div>

                    <textarea
                      value={currentVal}
                      onChange={e => handlePromptChange(meta.key, e.target.value)}
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                      placeholder={`Enter system prompt for ${meta.title}...`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Chat Storage & History Manager */}
      {activeSubTab === 'storage' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">PostgreSQL Chat Session Records</h3>
              <p className="text-xs text-slate-400">
                Delete individual old chats or bulk purge task sessions from the database.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteSelectedTasks}
                disabled={selectedTaskIds.length === 0 || deletingTasks}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-300 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded-lg transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedTaskIds.length})
              </button>
              <button
                onClick={handleClearAllChats}
                disabled={tasks.length === 0 || deletingTasks}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-40"
              >
                Clear All Old Chats
              </button>
            </div>
          </div>

          {loadingTasks ? (
            <div className="p-8 text-center text-xs font-mono text-slate-500">Loading chat records from database...</div>
          ) : tasks.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-medium">No saved chat sessions in database.</p>
              <p className="text-xs text-slate-500">Your chat storage is clean.</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.length === tasks.length && tasks.length > 0}
                    onChange={handleSelectAllTasks}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                  />
                  <span>Select All ({tasks.length})</span>
                </label>
                <span>Total Stored Tasks: {tasks.length}</span>
              </div>

              <div className="divide-y divide-slate-800/60 max-h-[500px] overflow-y-auto">
                {tasks.map(t => {
                  const isSelected = selectedTaskIds.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectTask(t.id)}
                          className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{t.title}</div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-slate-500">
                            <span className="text-indigo-400">ID: {t.id}</span>
                            <span>Status: {t.status}</span>
                            <span>Updated: {new Date(t.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteSingleTask(t.id)}
                        disabled={deletingTasks}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                        title="Delete this chat from database"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
