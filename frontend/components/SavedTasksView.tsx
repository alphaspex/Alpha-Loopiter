import React, { useState, useEffect } from 'react';
import { fetchTasksIO, fetchSummaryDetailIO, TaskSession, TaskMessage, TaskSummary } from '../services/api_io';
import { Database, Clock, Eye, Sparkles, Layers, Search, FileText } from 'lucide-react';

export default function SavedTasksView() {
  const [tasks, setTasks] = useState<TaskSession[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [summaries, setSummaries] = useState<TaskSummary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspectingSummary, setInspectingSummary] = useState(false);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    const data = await fetchTasksIO();
    setTasks(data);
    if (data.length > 0 && !selectedTaskId) {
      handleSelectTask(data[0].id);
    }
    setLoading(false);
  };

  const handleSelectTask = async (taskId: string) => {
    setSelectedTaskId(taskId);
    setSelectedSummary(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setSummaries(data.summaries || []);
      }
    } catch (err) {
      console.warn("Failed to load task details", err);
    }
  };

  const handleInspectSummary = async (summaryId: string) => {
    setInspectingSummary(true);
    const detail = await fetchSummaryDetailIO(summaryId);
    setSelectedSummary(detail);
    setInspectingSummary(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-400" />
          Saved Task Sessions & Persistent Memory
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Explore historic task execution sessions, PostgreSQL 20-message summaries, and test the agent summary memory retrieval tool.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-sm">
          Loading saved tasks from PostgreSQL database...
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-3">
          <Layers className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-medium">No saved task sessions found in database yet.</p>
          <p className="text-xs text-slate-500">Run a deep task in the Loopiter Agent tab to populate persistent memory.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sessions List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
              Task Sessions ({tasks.length})
            </h3>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {tasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTask(t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedTaskId === t.id
                      ? 'bg-indigo-950/60 border-indigo-700/80 text-indigo-200'
                      : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="font-medium text-xs truncate">{t.title}</div>
                  <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-slate-500 font-mono">
                    <span className="capitalize">{t.status}</span>
                    <span>{new Date(t.updated_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Messages & Summaries View */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summaries Panel */}
            {summaries.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold uppercase text-slate-300 tracking-wider">
                    PostgreSQL 20-Message Summaries ({summaries.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summaries.map(s => (
                    <div key={s.summary_id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                        <span className="text-emerald-400">{s.summary_id}</span>
                        <span>Steps {s.start_step}-{s.end_step}</span>
                      </div>
                      <p className="text-xs text-slate-300 italic">"{s.summary_text}"</p>
                      <button
                        onClick={() => handleInspectSummary(s.summary_id)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 pt-1"
                      >
                        <Eye className="w-3 h-3" />
                        Run Agent Tool Lookup
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Inspector Tool Output */}
            {selectedSummary && (
              <div className="bg-slate-900 border border-indigo-900/80 rounded-xl p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs font-mono text-indigo-300 border-b border-indigo-900/50 pb-2">
                  <span>Agent Tool: get_full_chat_from_summary_id("{selectedSummary.summary_id}")</span>
                  <button onClick={() => setSelectedSummary(null)} className="text-slate-400 hover:text-slate-200">
                    Close
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs text-slate-300">
                  {selectedSummary.messages?.map((m: any) => (
                    <div key={m.step} className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-indigo-400 font-semibold">[Step {m.step} - {m.role}]: </span>
                      <span>{m.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full Message Stream */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Full Session Message Stream ({messages.length})
              </h3>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {messages.map(m => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      m.role === 'user'
                        ? 'bg-slate-950 border-slate-800 text-slate-200'
                        : 'bg-indigo-950/40 border-indigo-900/60 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                      <span className="uppercase font-bold text-slate-400">{m.role}</span>
                      <span>Step #{m.step_number}</span>
                    </div>
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
