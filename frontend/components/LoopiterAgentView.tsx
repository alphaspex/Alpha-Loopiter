import React, { useState, useEffect, useRef } from 'react';
import { startDeepTaskIO, stepDeepTaskIO, editMessageIO, fetchSystemPromptsIO } from '../services/api_io';
import { Play, RotateCcw, Edit2, Check, X, Clock, Zap, CheckCircle2, AlertCircle, ArrowRight, CornerDownLeft } from 'lucide-react';

interface StageState {
  currentStage: string;
  taskId: string | null;
  taskDescription: string;
  conceptPlan?: string;
  masterPlan?: string;
  phasesRaw?: string;
  tinyGoalsText?: string;
  workerOutputs: string[];
  finalProduct?: string;
}

export default function LoopiterAgentView() {
  const [taskInput, setTaskInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const [state, setState] = useState<StageState>({
    currentStage: 'idle',
    taskId: null,
    taskDescription: '',
    workerOutputs: []
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Timer handler
  useEffect(() => {
    if (isExecuting) {
      timerRef.current = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExecuting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, state]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start New Deep Task
  const handleStartTask = async () => {
    if (!taskInput.trim() || isExecuting) return;

    setIsExecuting(true);
    setSecondsElapsed(0);
    const desc = taskInput.trim();
    setTaskInput('');

    const userMsg = { id: `msg_u_${Date.now()}`, role: 'user', content: desc, stage: 'start' };
    setMessages([userMsg]);

    const { prompts } = await fetchSystemPromptsIO();
    const res = await startDeepTaskIO(desc, prompts);

    const assistantMsg = {
      id: `msg_a_${Date.now()}`,
      role: 'assistant',
      content: res.output_text,
      stage: res.stage
    };

    setMessages(prev => [...prev, assistantMsg]);
    setState({
      currentStage: res.stage,
      taskId: res.task_id,
      taskDescription: desc,
      workerOutputs: []
    });

    setIsExecuting(false);
  };

  // Step Progression Handler
  const handleNextStep = async (userAnswer?: string, nextStageTarget?: string, customStageData?: any) => {
    if (!state.taskId || isExecuting) return;

    setIsExecuting(true);
    const stageToRun = nextStageTarget || state.currentStage;

    if (userAnswer) {
      setMessages(prev => [...prev, { id: `msg_u_${Date.now()}`, role: 'user', content: userAnswer, stage: stageToRun }]);
    }

    const { prompts } = await fetchSystemPromptsIO();
    const res = await stepDeepTaskIO(
      state.taskId,
      stageToRun,
      state.taskDescription,
      userAnswer,
      {
        concept_plan: state.conceptPlan,
        master_plan: state.masterPlan,
        phases_raw: state.phasesRaw,
        ...customStageData
      },
      prompts
    );

    if (res.output_text) {
      setMessages(prev => [...prev, { id: `msg_a_${Date.now()}`, role: 'assistant', content: res.output_text, stage: stageToRun }]);
    }

    // Update state variables based on output
    setState(prev => {
      const newState = { ...prev, currentStage: res.next_stage || prev.currentStage };
      if (stageToRun === 'stage_2_concept_approval') newState.conceptPlan = res.output_text;
      if (stageToRun === 'stage_3_detailed_approval') newState.masterPlan = res.output_text;
      if (stageToRun === 'stage_4_phase_breakdown_audit') newState.phasesRaw = res.output_text;
      if (stageToRun === 'stage_5_tiny_goals_audit') newState.tinyGoalsText = res.output_text;
      if (stageToRun === 'stage_8_final_product') newState.finalProduct = res.output_text;
      return newState;
    });

    setIsExecuting(false);
  };

  // Inline Message Editing & Resending
  const handleStartEdit = (msg: any) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.content);
  };

  const handleSaveAndResend = async (msgId: string) => {
    if (!state.taskId || !editingText.trim()) return;

    setIsExecuting(true);
    const res = await editMessageIO(state.taskId, msgId, editingText.trim());

    if (res.success && res.messages) {
      setMessages(res.messages);
    } else {
      // Local fallback edit
      const index = messages.findIndex(m => m.id === msgId);
      if (index !== -1) {
        const sliced = messages.slice(0, index);
        sliced.push({ id: msgId, role: 'user', content: editingText.trim() });
        setMessages(sliced);
      }
    }

    setEditingMsgId(null);
    setIsExecuting(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Timer & Stage Execution Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/80 border border-indigo-800/80 rounded-lg">
            <Zap className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Alpha Loopiter Deep Task Agent</h2>
            <p className="text-xs text-slate-400">Autonomous multi-call execution loop with continuous auditor verification</p>
          </div>
        </div>

        {/* Live Timer Clock */}
        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2">
          <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-mono text-sm font-bold text-emerald-400">{formatTimer(secondsElapsed)}</span>
          <span className="text-[10px] text-slate-500 font-mono uppercase">Elapsed</span>
        </div>
      </div>

      {/* Deep Task Input Form */}
      {state.currentStage === 'idle' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-semibold text-slate-200">Start Autonomous Deep Task</h3>
          <textarea
            value={taskInput}
            onChange={e => setTaskInput(e.target.value)}
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="Describe your task in detail (e.g., 'Build a secure FastAPI backend with OAuth authentication and PostgreSQL user management')..."
          />
          <button
            onClick={handleStartTask}
            disabled={!taskInput.trim() || isExecuting}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            Initialize Deep Task Loop
          </button>
        </div>
      )}

      {/* Execution Timeline & Stream */}
      {state.currentStage !== 'idle' && (
        <div className="space-y-6">
          {/* Messages Stream */}
          <div className="space-y-4">
            {messages.map(m => (
              <div
                key={m.id}
                className={`p-4 rounded-xl border text-sm space-y-2 transition-all ${
                  m.role === 'user'
                    ? 'bg-slate-900/90 border-slate-800 text-slate-100'
                    : 'bg-slate-950 border-slate-800/80 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-2">
                  <span className="font-semibold uppercase tracking-wider font-mono text-[11px] text-indigo-400">
                    {m.role === 'user' ? '👤 User Requirement' : '🤖 Loopiter Agent Output'}
                  </span>

                  {m.role === 'user' && editingMsgId !== m.id && (
                    <button
                      onClick={() => handleStartEdit(m)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-400 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit & Resend
                    </button>
                  )}
                </div>

                {/* Inline Editing View */}
                {editingMsgId === m.id ? (
                  <div className="space-y-3 pt-1">
                    <textarea
                      value={editingText}
                      onChange={e => setEditingText(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-950 border border-indigo-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none font-mono"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSaveAndResend(m.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md"
                      >
                        <Check className="w-3.5 h-3.5" /> Save & Resend
                      </button>
                      <button
                        onClick={() => setEditingMsgId(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm leading-relaxed">{m.content}</div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Interactive Gate Actions */}
          {state.currentStage === 'stage_1_questions' && !isExecuting && (
            <div className="bg-slate-900 border border-indigo-900/80 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Answer Clarifying Questions</h4>
              <textarea
                id="user_questions_input"
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none"
                placeholder="Type your answers to the questions above..."
              />
              <button
                onClick={() => {
                  const val = (document.getElementById('user_questions_input') as HTMLTextAreaElement)?.value;
                  handleNextStep(val, 'stage_2_concept_approval');
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
              >
                Submit Answers & Generate Concept <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {state.currentStage === 'stage_2_concept_approval' && !isExecuting && (
            <div className="bg-slate-900 border border-emerald-900/80 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">High-Level Concept Approval Gate</h4>
              <p className="text-xs text-slate-300">Review the generated high-level concept plan above. Click approve to proceed to detailed master planning.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleNextStep('APPROVED', 'stage_3_detailed_approval')}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve Concept Plan
                </button>
                <button
                  onClick={() => handleNextStep('Revise concept to be simpler', 'stage_2_concept_approval')}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  Request Concept Revision
                </button>
              </div>
            </div>
          )}

          {state.currentStage === 'stage_3_detailed_approval' && !isExecuting && (
            <div className="bg-slate-900 border border-indigo-900/80 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Detailed Master Plan Approval Gate</h4>
              <p className="text-xs text-slate-300">Approve the master plan to initiate Phase Goal breakdown and audited sub-goal execution.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleNextStep('APPROVED', 'stage_4_phase_breakdown_audit')}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve Master Plan & Start Execution
                </button>
              </div>
            </div>
          )}

          {state.currentStage === 'stage_4_phase_breakdown_audit' && !isExecuting && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <button
                onClick={() => handleNextStep(undefined, 'stage_5_tiny_goals_audit')}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
              >
                Proceed to Tiny Sub-Goal Audit Loop
              </button>
            </div>
          )}

          {state.currentStage === 'stage_5_tiny_goals_audit' && !isExecuting && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <button
                onClick={() => handleNextStep(undefined, 'stage_7_tiny_goal_execution')}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
              >
                Execute Tiny Goals Queue
              </button>
            </div>
          )}

          {state.currentStage === 'stage_7_tiny_goal_execution' && !isExecuting && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center space-y-2">
              <p className="text-xs text-slate-400">Tiny Goal execution step verified by Auditor.</p>
              <button
                onClick={() => handleNextStep(undefined, 'stage_8_final_product')}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg"
              >
                Synthesize Final Product
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
