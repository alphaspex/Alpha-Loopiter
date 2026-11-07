"""
Pure I/O engine for Alpha Loopiter 8-Stage Autonomous Agent Loop.
Executes multi-call deep task workflows with continuous self-auditing and stage progression.
"""

import json
from typing import Dict, Any, List, Optional
from edenai_io import call_edenai_io
from prompt_io import format_system_prompt_io
from memory_io import check_and_generate_summary_io

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
        
        # Generator call
        gen_prompt = format_system_prompt_io("detailed_planner", custom_prompts)
        gen_text = (
            f"Master Plan:\n{master_plan}\n\n"
            "Break down this master plan into 3 to 5 main Phase Goals. Format as a JSON list of strings: [\"Phase 1: ...\", \"Phase 2: ...\"]"
        )
        gen_res = call_edenai_io([{"role": "user", "content": gen_text}], system_prompt=gen_prompt)
        raw_phases = gen_res.get("text", "")

        # Auditor call
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
            "output_text": f"Phase Goals Breakdown:\n{raw_phases}\n\nAudit Results:\n{audit_res.get('text', '')}",
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
            "For each main phase, break it down into 3 to 5 tiny, atomic sub-goals that can be executed 1-by-1. "
            "Output as a structured bulleted list with clear section titles and micro-tasks."
        )
        res = call_edenai_io([{"role": "user", "content": user_text}], system_prompt=prompt)

        # Audit call
        audit_prompt = format_system_prompt_io("goal_auditor", custom_prompts)
        audit_res = call_edenai_io(
            [{"role": "user", "content": f"Sub-Goals List:\n{res.get('text', '')}\n\nAudit each tiny goal for black-box I/O clarity."}],
            system_prompt=audit_prompt
        )

        return {
            "stage": "stage_5_tiny_goals_audit",
            "tiny_goals_text": res.get("text", ""),
            "audit_output": audit_res.get("text", ""),
            "output_text": f"Tiny Sub-Goals Queue:\n{res.get('text', '')}\n\nAuditor Check:\n{audit_res.get('text', '')}",
            "next_stage": "stage_6_queue_ready",
            "requires_user_action": False
        }

    # Stage 6 & 7: Tiny Goal Execution & Auditor Loop
    elif stage == "stage_7_tiny_goal_execution":
        current_tiny_goal = stage_data.get("current_tiny_goal", "Execute next micro-step")
        context_so_far = stage_data.get("context_so_far", "")
        
        # Worker Call
        worker_prompt = format_system_prompt_io("tiny_goal_worker", custom_prompts)
        worker_text = (
            f"Current Tiny Goal: {current_tiny_goal}\n\n"
            f"Prior Context / Completed Steps:\n{context_so_far}\n\n"
            "Execute this tiny goal with production-grade details. Provide full implementation/output."
        )
        worker_res = call_edenai_io([{"role": "user", "content": worker_text}], system_prompt=worker_prompt)
        worker_output = worker_res.get("text", "")

        # Auditor Verification Call
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

    # Stage 8: Final Product Synthesis & User Approval
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
