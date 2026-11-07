import React, { useState, useEffect, useRef } from 'react';
import {
  startDeepTaskIO,
  stepDeepTaskIO,
  editMessageIO,
  fetchSystemPromptsIO,
  fetchTasksIO,
  fetchTaskDetailIO,
  deleteTaskIO,
  fetchSummaryDetailIO,
  fetchActiveRunningTaskIO,
  TaskSession,
  TaskMessage,
  TaskSummary
} from '../services/api_io';
import {
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Zap,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Bot,
  User,
  Sparkles,
  Layers,
  ChevronRight,
  Eye,
  PanelLeftClose,
  PanelLeft,
  AlertCircle
} from 'lucide-react';

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
  // Chat History Sidebar State
  const [tasks, setTasks] = useState<TaskSession[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Active Chat State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [summaries, setSummaries] = useState<TaskSummary[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Single Active Task Background Engine State
  const [globalActiveTaskId, setGlobalActiveTaskId] = useState<string | null>(null);

  // Message Editing State
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Summary Tool Modal State
  const [inspectedSummary, setInspectedSummary] = useState<any | null>(null);

  const [state, setState] = useState<StageState>({
    currentStage: 'idle',
    taskId: null,
    taskDescription: '',
    workerOutputs: []
  });

  const timerRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Live Timer
  useEffect(() => {
    if (isExecuting || (globalActiveTaskId && globalActiveTaskId === activeTaskId)) {
      if (!timerRef.current) {
        timerRef.current = window.setInterval(() => {
          setSecondsElapsed(prev => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isExecuting, globalActiveTaskId, activeTaskId]);

  // Load Tasks on Mount & Start Global Background Poller
  useEffect(() => {
    loadChatHistory();

    // Check background active task every 1.5 seconds
    pollIntervalRef.current = window.setInterval(async () => {
      const activeId = await fetchActiveRunningTaskIO();
      setGlobalActiveTaskId(activeId);

      // If active running task is the current open chat, sync its messages from DB
      if (activeId && activeId === activeTaskId) {
        setIsExecuting(true);
        const detail = await fetchTaskDetailIO(activeId);
        setMessages(detail.messages);
        setSummaries(detail.summaries);
        if (!detail.is_active_running) {
          setIsExecuting(false);
          loadChatHistory();
        }
      } else if (!activeId && isExecuting) {
        // Task completed in background
        setIsExecuting(false);
        if (activeTaskId) {
          const detail = await fetchTaskDetailIO(activeTaskId);
          setMessages(detail.messages);
          setSummaries(detail.summaries);
          loadChatHistory();
        }
      }
    }, 1500);

    return () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeTaskId, isExecuting]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isExecuting]);

  const loadChatHistory = async () => {
    const list = await fetchTasksIO();
    setTasks(list);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Switch Chat Session
  const handleSelectChat = async (taskId: string) => {
    setActiveTaskId(taskId);
    setEditingMsgId(null);
    const detail = await fetchTaskDetailIO(taskId);
    setMessages(detail.messages);
    setSummaries(detail.summaries);
    setIsExecuting(!!detail.is_active_running);

    const taskObj = tasks.find(t => t.id === taskId);
    setState({
      currentStage: taskObj?.current_stage || 'in_progress',
      taskId: taskId,
      taskDescription: taskObj?.title || '',
      workerOutputs: []
    });
  };

  // Start a Brand New Chat
  const handleNewChat = () => {
    if (globalActiveTaskId) {
      alert('Another task is currently running in background. Only 1 task can execute at a time. Please wait for it to finish.');
      return;
    }
    setActiveTaskId(null);
    setMessages([]);
    setSummaries([]);
    setInputPrompt('');
    setEditingMsgId(null);
    setSecondsElapsed(0);
    setIsExecuting(false);
    setState({
      currentStage: 'idle',
      taskId: null,
      taskDescription: '',
      workerOutputs: []
    });
  };

  // Delete a Chat from Database
  const handleDeleteChat = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    if (globalActiveTaskId === taskId) {
      alert('Cannot delete this task while it is actively executing in background.');
      return;
    }
    if (confirm('Delete this chat session and its persistent memory from the database?')) {
      await deleteTaskIO(taskId);
      await loadChatHistory();
      if (activeTaskId === taskId) {
        handleNewChat();
      }
    }
  };

  // Send New Task or Follow-Up Prompt
  const handleSendMessage = async () => {
    if (!inputPrompt.trim() || isExecuting) return;

    if (globalActiveTaskId && globalActiveTaskId !== activeTaskId) {
      alert('Another task is currently running in background. Only one task can execute at a time.');
      return;
    }

    const userText = inputPrompt.trim();
    setInputPrompt('');
    setIsExecuting(true);

    const { prompts } = await fetchSystemPromptsIO();

    if (!activeTaskId) {
      // Starting a brand new deep task session
      setSecondsElapsed(0);
      const tempUserMsg: TaskMessage = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        content: userText,
        step_number: 1,
        stage: 'initial_task'
      };
      setMessages([tempUserMsg]);

      const res = await startDeepTaskIO(userText, prompts);
      const newTaskId = res.task_id;
      setActiveTaskId(newTaskId);

      const agentMsg: TaskMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: res.output_text,
        step_number: 2,
        stage: res.stage
      };
      setMessages([tempUserMsg, agentMsg]);

      setState({
        currentStage: res.stage,
        taskId: newTaskId,
        taskDescription: userText,
        workerOutputs: []
      });

      await loadChatHistory();
    } else {
      // Continuing existing chat thread
      const nextStepNum = messages.length + 1;
      const userMsg: TaskMessage = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        content: userText,
        step_number: nextStepNum,
        stage: state.currentStage
      };
      setMessages(prev => [...prev, userMsg]);

      const res = await stepDeepTaskIO(
        activeTaskId,
        state.currentStage,
        state.taskDescription || userText,
        userText,
        {
          concept_plan: state.conceptPlan,
          master_plan: state.masterPlan,
          phases_raw: state.phasesRaw
        },
        prompts
      );

      if (res.output_text) {
        const agentMsg: TaskMessage = {
          id: `msg_a_${Date.now()}`,
          role: 'assistant',
          content: res.output_text,
          step_number: nextStepNum + 1,
          stage: res.stage
        };
        setMessages(prev => [...prev, agentMsg]);
      }

      setState(prev => ({
        ...prev,
        currentStage: res.next_stage || prev.currentStage
      }));

      await loadChatHistory();
    }

    setIsExecuting(false);
  };

  // Step Progression Trigger (e.g. from approval buttons)
  const handleTriggerStageStep = async (userAnswer: string, targetStage: string, customData?: any) => {
    if (!activeTaskId || isExecuting) return;

    if (globalActiveTaskId && globalActiveTaskId !== activeTaskId) {
      alert('Another task is currently running in background. Only one task can execute at a time.');
      return;
    }

    setIsExecuting(true);
    const nextStepNum = messages.length + 1;
    const userMsg: TaskMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: userAnswer,
      step_number: nextStepNum,
      stage: targetStage
    };
    setMessages(prev => [...prev, userMsg]);

    const { prompts } = await fetchSystemPromptsIO();
    const res = await stepDeepTaskIO(
      activeTaskId,
      targetStage,
      state.taskDescription,
      userAnswer,
      {
        concept_plan: state.conceptPlan,
        master_plan: state.masterPlan,
        phases_raw: state.phasesRaw,
        ...customData
      },
      prompts
    );

    if (res.output_text) {
      const agentMsg: TaskMessage = {
        id: `msg_a_${Date.now()}`,
        role: 'assistant',
        content: res.output_text,
        step_number: nextStepNum + 1,
        stage: targetStage
      };
      setMessages(prev => [...prev, agentMsg]);
    }

    // If starting autonomous background pipeline, keep execution state active for poller
    if (res.background) {
      setIsExecuting(true);
      setGlobalActiveTaskId(activeTaskId);
    } else {
      setIsExecuting(false);
    }

    setState(prev => {
      const updated = { ...prev, currentStage: res.next_stage || prev.currentStage };
      if (targetStage === 'stage_2_concept_approval') updated.conceptPlan = res.output_text;
      if (targetStage === 'stage_3_detailed_approval') updated.masterPlan = res.output_text;
      if (targetStage === 'stage_4_phase_breakdown_audit') updated.phasesRaw = res.output_text;
      if (targetStage === 'stage_5_tiny_goals_audit') updated.tinyGoalsText = res.output_text;
      if (targetStage === 'stage_8_final_product') updated.finalProduct = res.output_text;
      return updated;
    });

    await loadChatHistory();
  };

  // Inline Message Editing & Resending
  const handleStartEdit = (msg: TaskMessage) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.content);
  };

  const handleSaveAndResend = async (msgId: string) => {
    if (!activeTaskId || !editingText.trim()) return;

    if (globalActiveTaskId && globalActiveTaskId !== activeTaskId) {
      alert('Another task is currently running in background. Only one task can execute at a time.');
      return;
    }

    setIsExecuting(true);
    const newText = editingText.trim();
    setEditingMsgId(null);

    // Call backend endpoint to delete old trailing messages from DB and re-run agent
    const res = await editMessageIO(activeTaskId, msgId, newText);

    if (res.success && res.messages) {
      setMessages(res.messages);
      if (res.summaries) setSummaries(res.summaries);
      if (res.stage) {
        setState(prev => ({
          ...prev,
          currentStage: res.next_stage || res.stage
        }));
      }
    } else {
      // Local UI fallback if offline
      const index = messages.findIndex(m => m.id === msgId);
      if (index !== -1) {
        const sliced = messages.slice(0, index);
        sliced.push({ id: msgId, role: 'user', content: newText, step_number: index + 1 });
        setMessages(sliced);
      }
    }

    await loadChatHistory();
    setIsExecuting(false);
  };

  const handleInspectSummary = async (summaryId: string) => {
    const detail = await fetchSummaryDetailIO(summaryId);
    setInspectedSummary(detail);
  };

  const activeTaskObject = tasks.find(t => t.id === globalActiveTaskId);

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex-col">
      {/* Global Single Active Task Notification Banner */}
      {globalActiveTaskId && (
        <div className="bg-indigo-950 border-b border-indigo-800 px-4 py-2 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
            <span>
              <strong>Active Background Task</strong>: "{activeTaskObject?.title || globalActiveTaskId}" is executing AI calls in queue.
              Only 1 task executes at a time.
            </span>
          </div>
          {globalActiveTaskId !== activeTaskId && (
            <button
              onClick={() => handleSelectChat(globalActiveTaskId)}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold whitespace-nowrap"
            >
              Switch to Running Chat
            </button>
          )}
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 1. Left Sidebar: Chat History */}
        <div
          className={`${
            sidebarOpen ? 'w-72 sm:w-80' : 'w-0'
          } transition-all duration-200 ease-in-out border-r border-slate-800 bg-slate-900/95 flex flex-col shrink-0 overflow-hidden`}
        >
          {/* Sidebar Header */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
            <button
              onClick={handleNewChat}
              disabled={!!globalActiveTaskId}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              New Deep Task Chat
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Chat History ({tasks.length})
            </div>

            {tasks.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No saved chats yet. Start a deep task to begin!
              </div>
            ) : (
              tasks.map(t => {
                const isRunning = t.id === globalActiveTaskId;
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectChat(t.id)}
                    className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer border transition-all text-xs ${
                      activeTaskId === t.id
                        ? 'bg-indigo-950/70 border-indigo-700/80 text-indigo-100 shadow-sm'
                        : 'bg-slate-950/40 border-transparent text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isRunning ? (
                        <Zap className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">{t.title}</span>
                    </div>
                    <button
                      onClick={e => handleDeleteChat(e, t.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 p-1 transition-opacity shrink-0"
                      title="Delete chat from database"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Memory Indicator in Sidebar Footer */}
          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between bg-slate-950/50">
            <span className="flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              20-Msg Summarizer Active
            </span>
          </div>
        </div>

        {/* 2. Main Chat Thread Viewport */}
        <div className="flex-1 flex flex-col bg-slate-950 min-w-0 overflow-hidden relative">
          {/* Chat Top Bar */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Open Chat History"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-100 truncate flex items-center gap-2">
                  <span>{state.taskDescription || 'New Alpha Loopiter Task'}</span>
                </h2>
                <p className="text-[11px] text-slate-400 font-mono truncate">
                  Status:{' '}
                  <span className="text-indigo-400 font-semibold">
                    {globalActiveTaskId === activeTaskId ? 'executing_in_background' : state.currentStage}
                  </span>
                </p>
              </div>
            </div>

            {/* Real-Time Deep Task Timer & Status */}
            <div className="flex items-center gap-3 shrink-0">
              {summaries.length > 0 && (
                <span className="hidden sm:inline-flex text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/80 rounded px-2 py-0.5">
                  💾 {summaries.length} Summaries
                </span>
              )}

              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1 font-mono text-xs text-emerald-400">
                <Clock
                  className={`w-3.5 h-3.5 ${
                    isExecuting || globalActiveTaskId === activeTaskId ? 'animate-pulse text-emerald-400' : 'text-slate-400'
                  }`}
                />
                <span className="font-bold">{formatTimer(secondsElapsed)}</span>
              </div>
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {messages.length === 0 ? (
              /* Zero-State Welcome */
              <div className="h-full flex flex-col items-center justify-center max-w-lg mx-auto text-center space-y-4 p-6">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">Alpha Loopiter Deep Task Agent</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Describe your complex task below. Loopiter asks clarifying questions, generates a concept & master plan,
                  breaks down tiny sub-goals, and autonomously audits each execution call in background until the goal is 100% complete.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left w-full pt-2">
                  <button
                    onClick={() =>
                      setInputPrompt(
                        'Build a production FastAPI backend with PostgreSQL persistence and OAuth authentication'
                      )
                    }
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 transition-colors"
                  >
                    🚀 Build FastAPI backend with PostgreSQL & Auth
                  </button>
                  <button
                    onClick={() =>
                      setInputPrompt(
                        'Design a high-frequency trading risk simulation agent in Python with automated auditing'
                      )
                    }
                    className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs text-slate-300 transition-colors"
                  >
                    📈 Design Python risk simulation agent
                  </button>
                </div>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isUser = m.role === 'user';
                const isEditing = editingMsgId === m.id;

                return (
                  <div key={m.id || idx} className={`flex gap-3 max-w-4xl ${isUser ? 'ml-auto' : 'mr-auto'}`}>
                    {/* Avatar */}
                    {!isUser && (
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed border transition-all ${
                        isUser
                          ? 'bg-indigo-950/80 border-indigo-800/80 text-indigo-50 max-w-xl'
                          : 'bg-slate-900 border-slate-800 text-slate-200 w-full'
                      }`}
                    >
                      {/* Bubble Header */}
                      <div className="flex items-center justify-between gap-3 text-[11px] font-mono mb-2 text-slate-400 border-b border-slate-800/50 pb-1.5">
                        <span className="font-semibold flex items-center gap-1.5">
                          {isUser ? (
                            <>
                              <User className="w-3 h-3 text-indigo-300" /> User
                            </>
                          ) : (
                            <>
                              <Bot className="w-3 h-3 text-indigo-400" /> Alpha Loopiter
                              {m.stage && (
                                <span className="ml-1 text-[10px] text-slate-500 font-normal">[{m.stage}]</span>
                              )}
                            </>
                          )}
                        </span>

                        {/* Edit Button for User Messages */}
                        {isUser && !isEditing && (
                          <button
                            onClick={() => handleStartEdit(m)}
                            className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-white transition-colors"
                            title="Edit this message and re-run chat from here (deleting subsequent messages from DB)"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit & Resend
                          </button>
                        )}
                      </div>

                      {/* Content or Edit Box */}
                      {isEditing ? (
                        <div className="space-y-3 pt-1">
                          <p className="text-[11px] text-amber-300 font-mono">
                            ⚠️ Editing will delete all subsequent messages from the database and restart the loop from this step.
                          </p>
                          <textarea
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-950 border border-indigo-600 rounded-lg p-2.5 text-xs text-slate-100 font-sans focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveAndResend(m.id)}
                              disabled={isExecuting}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Save & Re-run Chat
                            </button>
                            <button
                              onClick={() => setEditingMsgId(null)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
                            >
                              <X className="w-3.5 h-3.5" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap font-sans">{m.content}</div>
                      )}

                      {/* Interactive Stage Approval Buttons inside Agent Message */}
                      {!isUser && idx === messages.length - 1 && !isExecuting && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                          {state.currentStage === 'stage_2_concept_approval' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  handleTriggerStageStep('APPROVED', 'stage_3_detailed_approval')
                                }
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve Concept Plan
                              </button>
                              <button
                                onClick={() =>
                                  handleTriggerStageStep(
                                    'Revise concept to be simpler and more modular',
                                    'stage_2_concept_approval'
                                  )
                                }
                                className="px-3.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
                              >
                                Request Concept Revision
                              </button>
                            </div>
                          )}

                          {state.currentStage === 'stage_3_detailed_approval' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  handleTriggerStageStep('APPROVED', 'stage_4_phase_breakdown_audit')
                                }
                                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve Master Plan & Start Background Execution Queue
                              </button>
                            </div>
                          )}

                          {state.currentStage === 'completed' && (
                            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Deep Task Complete! All audited micro-goals verified.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* User Avatar */}
                    {isUser && (
                      <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/80 flex items-center justify-center text-indigo-300 shrink-0 mt-0.5 shadow-sm">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Working / Execution Loader */}
            {(isExecuting || globalActiveTaskId === activeTaskId) && (
              <div className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-indigo-300 font-mono animate-pulse max-w-md">
                <Zap className="w-4 h-4 text-indigo-400 animate-spin" />
                <span>Alpha Loopiter is auditing and executing AI call queue in background...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 3. Bottom Chat Input Bar */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/80">
            <div className="max-w-4xl mx-auto flex items-end gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 focus-within:border-indigo-600 transition-colors">
              <textarea
                value={inputPrompt}
                onChange={e => setInputPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isExecuting || (!!globalActiveTaskId && globalActiveTaskId !== activeTaskId)}
                rows={1}
                className="flex-1 bg-transparent border-0 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none px-2 py-1 max-h-32 disabled:opacity-40"
                placeholder={
                  globalActiveTaskId && globalActiveTaskId !== activeTaskId
                    ? 'Another task is executing in background. Wait for completion...'
                    : messages.length === 0
                    ? 'Type your deep task to start the Loopiter agent...'
                    : 'Reply, answer questions, or give instructions to Loopiter...'
                }
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputPrompt.trim() || isExecuting || (!!globalActiveTaskId && globalActiveTaskId !== activeTaskId)}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors shrink-0"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Summary Inspector Modal */}
          {inspectedSummary && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-indigo-800 rounded-xl p-5 max-w-lg w-full space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-mono text-emerald-400 font-semibold">
                    Memory Tool Lookup: {inspectedSummary.summary_id}
                  </span>
                  <button
                    onClick={() => setInspectedSummary(null)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 italic">"{inspectedSummary.summary_text}"</p>
                <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
                  {inspectedSummary.messages?.map((m: any) => (
                    <div key={m.step} className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-indigo-400 font-semibold">[Step {m.step} - {m.role}]: </span>
                      <span className="text-slate-200">{m.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
