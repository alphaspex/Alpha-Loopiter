import React, { useState, useEffect } from 'react';
import { fetchSystemPromptsIO, saveSystemPromptsIO, SystemPrompts } from '../services/api_io';
import { Save, RotateCcw, CheckCircle2, ShieldAlert } from 'lucide-react';

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
  const [prompts, setPrompts] = useState<SystemPrompts>({});
  const [defaults, setDefaults] = useState<SystemPrompts>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setLoading(true);
    const data = await fetchSystemPromptsIO();
    setPrompts(data.prompts);
    setDefaults(data.defaults);
    setLoading(false);
  };

  const handlePromptChange = (key: string, value: string) => {
    setPrompts(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await saveSystemPromptsIO(prompts);
    setSaving(false);
    if (success) {
      setSaveStatus('Prompts saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleResetToDefault = (key?: string) => {
    if (key) {
      setPrompts(prev => ({ ...prev, [key]: defaults[key] || '' }));
    } else {
      setPrompts({ ...defaults });
    }
    setSaveStatus('Reset to default system prompts.');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-sm">
        Loading system prompt settings...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Agent System Prompts Configuration</h2>
          <p className="text-sm text-slate-400 mt-1">
            Customize the system prompts for every call type and stage in the 8-stage Alpha Loopiter autonomous architecture.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleResetToDefault()}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Prompts'}
          </button>
        </div>
      </div>

      {/* Save Notification */}
      {saveStatus && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-xs rounded-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      {/* Prompts Cards */}
      <div className="space-y-6">
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
    </div>
  );
}
