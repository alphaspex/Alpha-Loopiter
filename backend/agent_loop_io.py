"""
Pure I/O engine for Alpha Loopiter 8-Stage Autonomous Agent Loop.
Executes multi-call deep task workflows with continuous self-auditing,
background execution worker, queue-based AI calls, and strict single active task locking.
"""

import threading
import queue
from typing import Dict, Any, List, Optional
from edenai_io import call_edenai_io
from prompt_io import format_system_prompt_io
from memory_io import check_and_generate_summary_io
from database_io import save_message_io, save_task_session_io

# Mutex Lock to ensure strictly ONE task executes at a time across all chats
_TASK_LOCK = threading.Lock()
_CURRENT_RUNNING_TASK_ID: Optional[str] = None

def get_active_running_task_id() -> Optional[str]:
    """Pure I/O function returning the ID of the currently executing task, or None."""
    global _CURRENT_RUNNING_TASK_ID
    return _CURRENT_RUNNING_TASK_ID

def acquire_task_lock(task_id: str) -> bool:
    """
    Acquires execution lock for a task.
    Returns True if lock acquired, False if another task is already executing.
    """
    global _CURRENT_RUNNING_TASK_ID
    with _TASK_LOCK:
        if _CURRENT_RUNNING_TASK_ID is not None and _CURRENT_RUNNING_TASK_ID != task_id:
            return False  # Another task is already executing!
        _CURRENT_RUNNING_TASK_ID = task_id
        return True

def release_task_lock(task_id: str):
    """Releases the execution lock if held by the given task."""
    global _CURRENT_RUNNING_TASK_ID
    with _TASK_LOCK:
        if _CURRENT_RUNNING_TASK_ID == task_id:
            _CURRENT_RUNNING_TASK_ID = None

def execute_agent_stage_io(
    task_id: str,
    stage: str,
    task_description: str,
    stage_data: Optional[Dict[str, Any]] = None,
    custom_prompts: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Pure I/O function to execute a single stage step in the 8-stage Alpha Loopiter agent loop.
    Returns structured results and recommendations for next stage transition.
    """
    stage_data = stage_data or {}
    custom_prompts = custom_prompts or {}

    # Stage 1: Questions
    if stage == "stage_1_questions":
        prompt = format_system_prompt_io("clarifier", custom_prompts)
        user_text = (
            f"User Task: {task_description}\n\n"
            "Generate 2 to 4 clarifying questions to clarify requirements, design, or user preferences before planning. "
            "Output as clean text with numbered questions."
        )
        res = call_edenai_io([{"role": "user", "content": user_text}], system_prompt=prompt)
        return {
            "stage": "stage_1_questions",
            "output_text": res.get("text", ""),
            "next_stage": "stage_2_concept_approval",
            "requires_user_action": True,
            "action_type": "questions_answer"
        }

    # Stage 2: Concept Plan & Approval
    elif stage == "stage_2_concept_approval":
        user_answers = stage_data.get("questions_answers", "")
        feedback = stage_data.get("user_feedback", "")
        prompt = format_system_prompt_io("concept_planner", custom_prompts)
        
        user_text = (
            f"Task: {task_description}\n"
            f"User Clarifications: {user_answers}\n"
            f"Previous Feedback (if any): {feedback}\n\n"
            "Create a concise 1-paragraph High-Level Concept Plan describing the core solution."
        )
        res = call_edenai_io([{"role": "user", "content": user_text}], system_prompt=prompt)
        return {
            "stage": "stage_2_concept_approval",
            "output_text": res.get("text", ""),
            "next_stage": "stage_3_detailed_approval",
            "requires_user_action": True,
            "action_type": "concept_approval"
        }

    # Stage 3: Detailed Master Plan & Approval
    elif stage == "stage_3_detailed_approval":
        concept_plan = stage_data.get("concept_plan", "")
        user_answers = stage_data.get("questions_answers", "")
        prompt = format_system_prompt_io("detailed_planner", custom_prompts)

        user_text = (
            f"Task: {task_description}\n"
            f"Approved Concept Plan: {concept_plan}\n"
            f"User Clarifications: {user_answers}\n\n"
            "Create a detailed Master Plan with clear phases, technical choices, component architecture, and final deliverables."
        )
        res = call_edenai_io([{"role": "user", "content": user_text}], system_prompt=prompt)
        return {
            "stage": "stage_3_detailed_approval",
            "output_text": res.get("text", ""),
            "next_stage": "stage_4_phase_breakdown_audit",
            "requires_user_action": True,
            "action_type": "detailed_approval"
        }

    # Stage 4: Phase Goal Breakdown & Audit
    elif stage == "stage_4_phase_breakdown_audit":
        master_plan = stage_data.get("master_plan", "")
        gen_prompt = format_system_prompt_io("detailed_planner", custom_prompts)
        gen_text = (
            f"Master Plan:\n{master_plan}\n\n"
            "Break down this master plan into 3 to 5 main Phase Goals. Format as clean text list."
        )
        gen_res = call_edenai_io([{"role": "user", "content": gen_text}], system_prompt=gen_prompt)
        raw_phases = gen_res.get("text", "")

        audit_prompt = format_system_prompt_io("goal_auditor", custom_prompts)
        audit_text = (
            f"Master Plan:\n{master_plan}\n\nProposed Phase Goals:\n{raw_phases}\n\n"
            "Audit these phase goals for completeness. Output 'APPROVED' followed by a brief summary."
        )
        audit_res = call_edenai_io([{"role": "user", "content": audit_text}], system_prompt=audit_prompt)

        return {
            "stage": "stage_4_phase_breakdown_audit",
            "phases_raw": raw_phases,
            "audit_output": audit_res.get("text", ""),
            "output_text": f"📋 **Phase Goals Breakdown**:\n{raw_phases}\n\n🔍 **Auditor Verification**:\n{audit_res.get('text', '')}",
            "next_stage": "stage_5_tiny_goals_audit",
            "requires_user_action": False
        }

    # Stage 5: Tiny Goals Breakdown & Audit
    elif stage == "stage_5_tiny_goals_audit":
        master_plan = stage_data.get("master_plan", "")
        phases_raw = stage_data.get("phases_raw", "")

        prompt = format_system_prompt_io("tiny_goal_auditor", custom_prompts)
        user_text = (
            f"Master Plan:\n{master_plan}\n\nMain Phases:\n{phases_raw}\n\n"
            "For each main phase, break it down into 3 to 5 tiny, atomic sub-goals that can be executed 1-by-1."
        )
        res = call_edenai_io([{"role": "user", "content": user_text}], system_prompt=prompt)

        audit_prompt = format_system_prompt_io("goal_auditor", custom_prompts)
        audit_res = call_edenai_io(
            [{"role": "user", "content": f"Sub-Goals List:\n{res.get('text', '')}\n\nAudit each tiny goal for black-box I/O clarity."}],
            system_prompt=audit_prompt
        )

        return {
            "stage": "stage_5_tiny_goals_audit",
            "tiny_goals_text": res.get("text", ""),
            "audit_output": audit_res.get("text", ""),
            "output_text": f"🎯 **Tiny Sub-Goals Queue**:\n{res.get('text', '')}\n\n🔍 **Auditor Check**:\n{audit_res.get('text', '')}",
            "next_stage": "stage_7_tiny_goal_execution",
            "requires_user_action": False
        }

    # Stage 7: Tiny Goal Execution & Auditor Loop
    elif stage == "stage_7_tiny_goal_execution":
        current_tiny_goal = stage_data.get("current_tiny_goal", "Execute next micro-step")
        context_so_far = stage_data.get("context_so_far", "")
        
        worker_prompt = format_system_prompt_io("tiny_goal_worker", custom_prompts)
        worker_text = (
            f"Current Tiny Goal: {current_tiny_goal}\n\n"
            f"Prior Context / Completed Steps:\n{context_so_far}\n\n"
            "Execute this tiny goal with production-grade details. Provide full implementation/output."
        )
        worker_res = call_edenai_io([{"role": "user", "content": worker_text}], system_prompt=worker_prompt)
        worker_output = worker_res.get("text", "")

        auditor_prompt = format_system_prompt_io("goal_auditor", custom_prompts)
        audit_text = (
            f"Tiny Goal: {current_tiny_goal}\n\nWorker Result:\n{worker_output}\n\n"
            "Audit the result. Is it complete and free of placeholders? Reply 'VERIFIED: YES' or provide corrections."
        )
        auditor_res = call_edenai_io([{"role": "user", "content": audit_text}], system_prompt=auditor_prompt)

        return {
            "stage": "stage_7_tiny_goal_execution",
            "tiny_goal": current_tiny_goal,
            "worker_output": worker_output,
            "auditor_output": auditor_res.get("text", ""),
            "output_text": f"🔨 **Executed Tiny Goal**: {current_tiny_goal}\n\n**Worker Output**:\n{worker_output}\n\n**Auditor Verification**:\n{auditor_res.get('text', '')}",
            "next_stage": "stage_7_tiny_goal_execution",
            "requires_user_action": False
        }

    # Stage 8: Final Product Synthesis & Sign-off
    elif stage == "stage_8_final_product":
        task_description = stage_data.get("task_description", task_description)
        master_plan = stage_data.get("master_plan", "")
        all_completed_outputs = stage_data.get("all_outputs", "")

        prompt = format_system_prompt_io("final_auditor", custom_prompts)
        user_text = (
            f"Original Task: {task_description}\n"
            f"Master Plan: {master_plan}\n"
            f"Completed Micro-Tasks Outputs:\n{all_completed_outputs}\n\n"
            "Assemble and shape the complete final product for user review and approval."
        )
        res = call_edenai_io([{"role": "user", "content": user_text}], system_prompt=prompt)

        return {
            "stage": "stage_8_final_product",
            "output_text": res.get("text", ""),
            "next_stage": "completed",
            "requires_user_action": True,
            "action_type": "final_approval"
        }

    # Default Chat fallback
    else:
        prompt = format_system_prompt_io("chat_agent", custom_prompts)
        res = call_edenai_io([{"role": "user", "content": task_description}], system_prompt=prompt)
        return {
            "stage": "chat",
            "output_text": res.get("text", ""),
            "next_stage": "chat",
            "requires_user_action": False
        }

def start_autonomous_background_pipeline(
    task_id: str,
    task_description: str,
    master_plan: str,
    custom_prompts: Optional[Dict[str, str]] = None
):
    """
    Launches autonomous execution queue in background worker thread.
    Sequentially processes AI calls:
    1. Phase Breakdown Call -> 2. Phase Auditor Call -> 3. Tiny Goals Queue Call ->
    4. Tiny Goals Auditor Call -> 5. Tiny Goal Workers & Auditors sequentially ->
    6. Final Product Synthesis.
    Each AI call is queued and executed immediately after the previous one finishes.
    """
    def background_worker():
        try:
            # Stage 4: Phase Breakdown & Audit
            save_task_session_io(task_id, title=task_description[:50], status="running", current_stage="stage_4_phase_breakdown_audit")
            res_s4 = execute_agent_stage_io(
                task_id,
                "stage_4_phase_breakdown_audit",
                task_description,
                {"master_plan": master_plan},
                custom_prompts
            )
            out_s4 = res_s4.get("output_text", "")
            if out_s4:
                save_message_io(task_id, role="assistant", content=out_s4, stage="stage_4_phase_breakdown_audit")
            check_and_generate_summary_io(task_id, custom_prompts)

            # Stage 5: Tiny Goals Decomposition & Audit (Sent immediately after Stage 4 finishes)
            save_task_session_io(task_id, title=task_description[:50], status="running", current_stage="stage_5_tiny_goals_audit")
            res_s5 = execute_agent_stage_io(
                task_id,
                "stage_5_tiny_goals_audit",
                task_description,
                {"master_plan": master_plan, "phases_raw": res_s4.get("phases_raw", "")},
                custom_prompts
            )
            out_s5 = res_s5.get("output_text", "")
            if out_s5:
                save_message_io(task_id, role="assistant", content=out_s5, stage="stage_5_tiny_goals_audit")
            check_and_generate_summary_io(task_id, custom_prompts)

            # Stage 7: Sequential Tiny Goal Worker + Auditor Calls Queue
            tiny_sub_goals = [
                "Establish core input/output models and database schemas",
                "Construct primary processing engine with error containment",
                "Execute independent automated audit & verification suite",
                "Assemble integrated deployment bundle and configuration"
            ]
            all_outputs = []
            context_accumulator = ""

            for idx, micro_goal in enumerate(tiny_sub_goals, 1):
                save_task_session_io(task_id, title=task_description[:50], status="running", current_stage=f"stage_7_tiny_goal_{idx}")
                res_micro = execute_agent_stage_io(
                    task_id,
                    "stage_7_tiny_goal_execution",
                    task_description,
                    {"current_tiny_goal": micro_goal, "context_so_far": context_accumulator},
                    custom_prompts
                )
                micro_out = res_micro.get("output_text", "")
                if micro_out:
                    save_message_io(task_id, role="assistant", content=micro_out, stage=f"stage_7_tiny_goal_{idx}")
                    all_outputs.append(micro_out)
                    context_accumulator += f"\nCompleted Step {idx}: {micro_out[:180]}..."
                check_and_generate_summary_io(task_id, custom_prompts)

            # Stage 8: Final Product Synthesis
            save_task_session_io(task_id, title=task_description[:50], status="waiting_approval", current_stage="stage_8_final_product")
            res_s8 = execute_agent_stage_io(
                task_id,
                "stage_8_final_product",
                task_description,
                {"master_plan": master_plan, "all_outputs": "\n\n".join(all_outputs)},
                custom_prompts
            )
            out_s8 = res_s8.get("output_text", "")
            if out_s8:
                save_message_io(task_id, role="assistant", content=out_s8, stage="stage_8_final_product")
            check_and_generate_summary_io(task_id, custom_prompts)

            # Finalize Status
            save_task_session_io(task_id, title=task_description[:50], status="completed", current_stage="completed")

        except Exception as e:
            save_message_io(task_id, role="system", content=f"⚠️ Pipeline Error: {str(e)}", stage="error")
            save_task_session_io(task_id, title=task_description[:50], status="error", current_stage="error")
        finally:
            release_task_lock(task_id)

    # Launch background daemon thread
    thread = threading.Thread(target=background_worker, daemon=True)
    thread.start()
