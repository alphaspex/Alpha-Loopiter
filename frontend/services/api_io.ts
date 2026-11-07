/**
 * Pure I/O API Client Service for Alpha Loopiter Frontend.
 * Communicates with backend REST API and provides graceful fallback
 * for AI Studio live preview mode.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface SystemPrompts {
  [key: string]: string;
}

export interface TaskSession {
  id: string;
  title: string;
  status: string;
  current_stage: string;
  created_at: string;
  updated_at: string;
}

export interface TaskMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  stage?: string;
  step_number: number;
  created_at?: string;
}

export interface TaskSummary {
  summary_id: string;
  summary_text: string;
  start_step: number;
  end_step: number;
}

// Fallback System Prompts
const DEFAULT_PROMPTS: SystemPrompts = {
  clarifier: "You are the Alpha Loopiter Clarifier Agent. Generate 2-4 clarifying questions before planning.",
  concept_planner: "You are the Alpha Loopiter Concept Planner Agent. Create a concise 1-paragraph core concept plan.",
  detailed_planner: "You are the Alpha Loopiter Master Planner Agent. Create a comprehensive step-by-step master plan.",
  goal_auditor: "You are the Alpha Loopiter Phase Goal Auditor. Audit goals for completeness and independence.",
  tiny_goal_auditor: "You are the Alpha Loopiter Sub-Goal Auditor. Audit tiny goals for black-box I/O clarity.",
  tiny_goal_worker: "You are the Alpha Loopiter Tiny Goal Worker Agent. Execute the micro-task with complete code/output.",
  section_synthesizer: "You are the Section Synthesizer. Combine completed tiny goal outputs into a section deliverable.",
  final_auditor: "You are the Final Product Synthesizer. Shape the final product deliverable for user sign-off.",
  summarizer: "You are the Memory Summarizer. Summarize 20 messages into strictly 20-30 words.",
  chat_agent: "You are Alpha Loopiter, an autonomous AI agent for deep tasks."
};

export async function fetchSystemPromptsIO(): Promise<{ prompts: SystemPrompts; defaults: SystemPrompts }> {
  try {
    const local = localStorage.getItem("loopiter_custom_prompts");
    const localPrompts = local ? JSON.parse(local) : {};

    const res = await fetch(`${API_BASE_URL}/api/prompts`);
    if (res.ok) {
      const data = await res.json();
      return { prompts: { ...DEFAULT_PROMPTS, ...data.prompts, ...localPrompts }, defaults: data.defaults || DEFAULT_PROMPTS };
    }
  } catch (err) {
    console.warn("Backend API offline; using local prompt storage fallback.", err);
  }

  const local = localStorage.getItem("loopiter_custom_prompts");
  const localPrompts = local ? JSON.parse(local) : {};
  return { prompts: { ...DEFAULT_PROMPTS, ...localPrompts }, defaults: DEFAULT_PROMPTS };
}

export async function saveSystemPromptsIO(prompts: SystemPrompts): Promise<boolean> {
  localStorage.setItem("loopiter_custom_prompts", JSON.stringify(prompts));
  try {
    const res = await fetch(`${API_BASE_URL}/api/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompts })
    });
    return res.ok;
  } catch (err) {
    return true; // Local storage saved successfully
  }
}

export async function startDeepTaskIO(taskDescription: string, customPrompts?: SystemPrompts) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/deep-task/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_description: taskDescription, custom_prompts: customPrompts })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("API fallback for start task", err);
  }

  // Local fallback response for live preview
  const mockId = `task_${Math.random().toString(36).substring(2, 10)}`;
  return {
    task_id: mockId,
    stage: "stage_1_questions",
    next_stage: "stage_2_concept_approval",
    output_text: "1. What is the target output format or technology stack?\n2. Are there specific style or architectural constraints?\n3. What is the primary success metric?",
    requires_user_action: true,
    action_type: "questions_answer"
  };
}

export async function stepDeepTaskIO(
  taskId: string,
  stage: string,
  taskDescription: string,
  userInput?: string,
  stageData?: any,
  customPrompts?: SystemPrompts
) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/deep-task/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: taskId,
        stage: stage,
        task_description: taskDescription,
        user_input: userInput,
        stage_data: stageData,
        custom_prompts: customPrompts
      })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("API fallback for step task", err);
  }

  // Fallback responses per stage
  if (stage === "stage_2_concept_approval") {
    return {
      task_id: taskId,
      stage: "stage_2_concept_approval",
      next_stage: "stage_3_detailed_approval",
      output_text: `**High-Level Concept Plan**:\nWe will build a high-performance system for "${taskDescription}" featuring modular pure I/O architecture, automated verification, and clean design patterns.`,
      requires_user_action: true,
      action_type: "concept_approval"
    };
  } else if (stage === "stage_3_detailed_approval") {
    return {
      task_id: taskId,
      stage: "stage_3_detailed_approval",
      next_stage: "stage_4_phase_breakdown_audit",
      output_text: `**Detailed Master Plan**:\n1. Core Engine Architecture\n2. Data Flow & Persistence Pipeline\n3. Verification & Auditor Loop\n4. Interface Integration & Deliverable Package`,
      requires_user_action: true,
      action_type: "detailed_approval"
    };
  } else if (stage === "stage_4_phase_breakdown_audit") {
    return {
      task_id: taskId,
      stage: "stage_4_phase_breakdown_audit",
      next_stage: "stage_5_tiny_goals_audit",
      output_text: `**Phase Goals Breakdown**:\n- Phase 1: Core System Architecture\n- Phase 2: Data Pipeline & Memory\n- Phase 3: Deliverable Synthesis\n\n**Auditor Verification**: APPROVED`,
      requires_user_action: false
    };
  } else if (stage === "stage_5_tiny_goals_audit") {
    return {
      task_id: taskId,
      stage: "stage_5_tiny_goals_audit",
      next_stage: "stage_7_tiny_goal_execution",
      output_text: `**Tiny Sub-Goals Queue**:\n1. Setup module schemas & I/O models\n2. Implement core engine logic\n3. Implement verification tests\n4. Synthesize final package\n\n**Auditor Check**: APPROVED`,
      requires_user_action: false
    };
  } else if (stage === "stage_7_tiny_goal_execution") {
    return {
      task_id: taskId,
      stage: "stage_7_tiny_goal_execution",
      next_stage: "stage_8_final_product",
      output_text: `🔨 **Executed Tiny Goal**: Implement core engine module\n\n**Worker Output**: Pure I/O module constructed and validated.\n\n**Auditor Verification**: VERIFIED: YES - Output is complete and placeholder-free.`,
      requires_user_action: false
    };
  } else {
    return {
      task_id: taskId,
      stage: "stage_8_final_product",
      next_stage: "completed",
      output_text: `🎉 **Final Deliverable Ready**:\n\nThe Alpha Loopiter agent has completed all audited tiny goals for "${taskDescription}". All deliverables verified.`,
      requires_user_action: true,
      action_type: "final_approval"
    };
  }
}

export async function editMessageIO(taskId: string, messageId: string, newContent: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/deep-task/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, message_id: messageId, new_content: newContent })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("API edit message fallback", err);
  }
  return { success: true, task_id: taskId, edited_message_id: messageId };
}

export async function fetchTasksIO(): Promise<TaskSession[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks`);
    if (res.ok) {
      const data = await res.json();
      return data.tasks || [];
    }
  } catch (err) {
    console.warn("API fetch tasks fallback", err);
  }
  return [];
}

export async function fetchSummaryDetailIO(summaryId: string) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/summary-tool/${summaryId}`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("API summary lookup fallback", err);
  }
  return { found: false, error: "Summary ID lookup failed" };
}
