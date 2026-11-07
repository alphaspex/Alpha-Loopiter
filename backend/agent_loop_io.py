"""
Pure I/O engine for Alpha Loopiter 8-Stage Autonomous Agent Loop.
Executes multi-call deep task workflows with continuous self-auditing,
background execution worker, queue-based AI calls, and strict single active task locking.
"""

import re
import threading
from typing import Dict, Any, List, Optional, Tuple
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
            return False
        _CURRENT_RUNNING_TASK_ID = task_id
        return True

def release_task_lock(task_id: str):
    """Releases the execution lock if held by the given task."""
    global _CURRENT_RUNNING_TASK_ID
    with _TASK_LOCK:
        if _CURRENT_RUNNING_TASK_ID == task_id:
            _CURRENT_RUNNING_TASK_ID = None

def parse_sections_and_tiny_goals_io(tiny_goals_text: str) -> List[Dict[str, Any]]:
    """
    Pure I/O function to parse structured bullet text from Stage 5
    into organized sections and tiny goals list.
    """
    lines = tiny_goals_text.strip().split("\n")
    sections: List[Dict[str, Any]] = []
    current_section: Optional[Dict[str, Any]] = None

    for line in lines:
        cleaned = line.strip()
        if not cleaned:
            continue

        # Check for section header (e.g., "Section 1:", "Phase 1:", "## Section", etc.)
        if re.match(r'^(#+|\d+[\.:\)]|Section|Phase|Part)\s+', cleaned, re.IGNORECASE) and not cleaned.startswith("-"):
            if current_section and current_section.get("tiny_goals"):
                sections.append(current_section)
            current_section = {
                "section_name": cleaned.lstrip("#").strip(),
                "tiny_goals": []
            }
        elif cleaned.startswith("-") or cleaned.startswith("*") or re.match(r'^\d+\.', cleaned):
            goal_text = re.sub(r'^[-*\d\.\s\[\]]+', '', cleaned).strip()
            if goal_text:
                if not current_section:
                    current_section = {
                        "section_name": "Main Goal Section 1",
                        "tiny_goals": []
                    }
                current_section["tiny_goals"].append(goal_text)

    if current_section and current_section.get("tiny_goals"):
        sections.append(current_section)

    # Fallback if text format wasn't recognized cleanly
    if not sections:
        sections = [
            {
                "section_name": "Architecture & Models",
                "tiny_goals": [
                    "Establish input/output data contracts and database models",
                    "Configure security boundaries and API validation rules"
                ]
            },
            {
                "section_name": "Core Pipeline Execution",
                "tiny_goals": [
                    "Implement the primary business and processing logic",
                    "Conduct automated verification and error handling audit"
                ]
            },
            {
                "section_name": "Delivery & Synthesis",
                "tiny_goals": [
                    "Integrate full workflow and generate production deliverable"
                ]
            }
        ]

    return sections

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
            "Analyze requirements and generate 2 to 4 essential clarifying questions to ensure complete alignment before planning. "
            "Output clear, numbered questions."
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
            f"User Answers / Requirements: {user_answers}\n"
            f"User Revision Feedback (if any): {feedback}\n\n"
            "Create a concise 1-paragraph High-Level Concept Plan describing the approach and solution idea."
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
        feedback = stage_data.get("user_feedback", "")
        prompt = format_system_prompt_io("detailed_planner", custom_prompts)

        user_text = (
            f"Task: {task_description}\n"
            f"Approved Concept Plan: {concept_plan}\n"
            f"User Clarifications: {user_answers}\n"
            f"User Revision Feedback (if any): {feedback}\n\n"
            "Create a comprehensive Detailed Master Plan with technical phases, architectural goals, component breakdown, and deliverable specifications."
        )
        res = call_edenai_io([{"role": "user", "content": user_text}], system_prompt=prompt)
        return {
            "stage": "stage_3_detailed_approval",
            "output_text": res.get("text", ""),
            "next_stage": "stage_4_phase_breakdown_audit",
            "requires_user_action": True,
            "action_type": "detailed_approval"
        }

    # Stage 4: Cut Master Plan into Main Phase Goals & Audit
    elif stage == "stage_4_phase_breakdown_audit":
        master_plan = stage_data.get("master_plan", "")
        gen_prompt = format_system_prompt_io("detailed_planner", custom_prompts)
        gen_text = (
            f"Master Plan:\n{master_plan}\n\n"
            "Break down this master plan into 3 to 5 main Phase Goals. Format as a clean, numbered list."
        )
        gen_res = call_edenai_io([{"role": "user", "content": gen_text}], system_prompt=gen_prompt)
        raw_phases = gen_res.get("text", "")

        audit_prompt = format_system_prompt_io("goal_auditor", custom_prompts)
        audit_text = (
            f"Master Plan:\n{master_plan}\n\nProposed Phase Goals:\n{raw_phases}\n\n"
            "Audit these phase goals for completeness, clarity, and independence. Reply with 'APPROVED' followed by audit notes."
        )
        audit_res = call_edenai_io([{"role": "user", "content": audit_text}], system_prompt=audit_prompt)

        return {
            "stage": "stage_4_phase_breakdown_audit",
            "phases_raw": raw_phases,
            "audit_output": audit_res.get("text", ""),
            "output_text": f"📋 **Phase Goals Breakdown (Audited)**:\n\n{raw_phases}\n\n🔍 **Auditor Verdict**:\n{audit_res.get('text', '')}",
            "next_stage": "stage_5_tiny_goals_audit",
            "requires_user_action": False
        }

    # Stage 5: Cut Main Goals into Tiny Sub-Goals & Audit
    elif stage == "stage_5_tiny_goals_audit":
        master_plan = stage_data.get("master_plan", "")
        phases_raw = stage_data.get("phases_raw", "")

        prompt = format_system_prompt_io("tiny_goal_auditor", custom_prompts)
        user_text = (
            f"Master Plan:\n{master_plan}\n\nMain Phases:\n{phases_raw}\n\n"
            "For each main phase, break it down into 2 to 4 tiny, atomic sub-goals that can each be executed 1-by-1.\n"
            "Format clearly with section titles like:\n"
            "Section 1: [Phase Name]\n- [Tiny Goal 1]\n- [Tiny Goal 2]\n\n"
            "Section 2: [Phase Name]\n- [Tiny Goal 1]\n- [Tiny Goal 2]"
        )
        res = call_edenai_io([{"role": "user", "content": user_text}], system_prompt=prompt)
        tiny_text = res.get("text", "")

        audit_prompt = format_system_prompt_io("goal_auditor", custom_prompts)
        audit_res = call_edenai_io(
            [{"role": "user", "content": f"Sub-Goals Breakdown:\n{tiny_text}\n\nAudit each tiny goal for atomic black-box clarity. Reply 'APPROVED'."}],
            system_prompt=audit_prompt
        )

        return {
            "stage": "stage_5_tiny_goals_audit",
            "tiny_goals_text": tiny_text,
            "audit_output": audit_res.get("text", ""),
            "output_text": f"🎯 **Tiny Sub-Goals Queue (Audited)**:\n\n{tiny_text}\n\n🔍 **Auditor Check**:\n{audit_res.get('text', '')}",
            "next_stage": "stage_7_tiny_goal_execution",
            "requires_user_action": False
        }

    # Stage 7: Tiny Goal Worker Call
    elif stage == "stage_7_tiny_goal_worker":
        current_tiny_goal = stage_data.get("current_tiny_goal", "Execute next micro-step")
        context_so_far = stage_data.get("context_so_far", "")
        section_name = stage_data.get("section_name", "Current Section")

        worker_prompt = format_system_prompt_io("tiny_goal_worker", custom_prompts)
        worker_text = (
            f"Main Section: {section_name}\n"
            f"Current Tiny Goal: {current_tiny_goal}\n\n"
            f"Context / Completed Prior Work:\n{context_so_far}\n\n"
            "Execute this tiny goal with production-grade details. Output complete, working implementation without stubs."
        )
        worker_res = call_edenai_io([{"role": "user", "content": worker_text}], system_prompt=worker_prompt)
        return {
            "stage": "stage_7_tiny_goal_worker",
            "output_text": worker_res.get("text", ""),
            "tiny_goal": current_tiny_goal
        }

    # Stage 7: Tiny Goal Auditor Call
    elif stage == "stage_7_tiny_goal_auditor":
        current_tiny_goal = stage_data.get("current_tiny_goal", "")
        worker_output = stage_data.get("worker_output", "")

        auditor_prompt = format_system_prompt_io("goal_auditor", custom_prompts)
        audit_text = (
            f"Tiny Goal: {current_tiny_goal}\n\n"
            f"Worker Output:\n{worker_output}\n\n"
            "Audit this result. Verify it is complete, correct, and ready. Reply 'VERIFIED: YES' followed by brief verification notes."
        )
        audit_res = call_edenai_io([{"role": "user", "content": audit_text}], system_prompt=auditor_prompt)
        return {
            "stage": "stage_7_tiny_goal_auditor",
            "output_text": audit_res.get("text", "")
        }

    # Stage 7: Section Synthesizer Call (organize and complete 1 main goal section)
    elif stage == "stage_7_section_synthesizer":
        section_name = stage_data.get("section_name", "")
        section_outputs = stage_data.get("section_outputs", "")

        synth_prompt = format_system_prompt_io("section_synthesizer", custom_prompts)
        synth_text = (
            f"Main Goal Section: {section_name}\n\n"
            f"Completed Tiny Goals Deliverables:\n{section_outputs}\n\n"
            "Synthesize, organize, and compile these completed tiny goal outputs into the cohesive deliverable for this main goal section."
        )
        synth_res = call_edenai_io([{"role": "user", "content": synth_text}], system_prompt=synth_prompt)
        return {
            "stage": "stage_7_section_synthesizer",
            "output_text": synth_res.get("text", "")
        }

    # Stage 8: Final Product Synthesis & User Sign-off
    elif stage == "stage_8_final_product":
        master_plan = stage_data.get("master_plan", "")
        all_sections_output = stage_data.get("all_sections_output", "")

        final_prompt = format_system_prompt_io("final_auditor", custom_prompts)
        final_text = (
            f"Original Task: {task_description}\n"
            f"Detailed Master Plan: {master_plan}\n\n"
            f"Completed Sections Deliverables:\n{all_sections_output}\n\n"
            "Assemble and shape the final product deliverable following the detailed plan. Present complete result for final user review and sign-off."
        )
        final_res = call_edenai_io([{"role": "user", "content": final_text}], system_prompt=final_prompt)
        return {
            "stage": "stage_8_final_product",
            "output_text": final_res.get("text", ""),
            "next_stage": "completed",
            "requires_user_action": True,
            "action_type": "final_approval"
        }

    # Fallback Chat
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
    Launches the autonomous execution queue in a background worker thread.
    Sequentially processes AI calls matching the exact 8-stage specification:
    1. Stage 4: Cut Master Plan into Main Phase Goals (Generator call) -> Audit call
    2. Stage 5: Cut Main Goals into Tiny Sub-Goals (Generator call) -> Audit call
    3. Stage 6: Parse and organize list of tiny goals grouped by main goal section
    4. Stage 7: For each section:
       - For each tiny goal:
         - Worker Call (executes tiny goal)
         - Auditor Call (verifies output)
       - Section Synthesizer Call (combines tiny goals into main smaller goal deliverable)
    5. Stage 8: Shapes the Final Product following Master Plan and requests user sign-off.
    """
    def background_worker():
        try:
            # 1. Stage 4: Phase Goals Breakdown & Audit
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

            # 2. Stage 5: Tiny Goals Decomposition & Audit
            save_task_session_io(task_id, title=task_description[:50], status="running", current_stage="stage_5_tiny_goals_audit")
            res_s5 = execute_agent_stage_io(
                task_id,
                "stage_5_tiny_goals_audit",
                task_description,
                {"master_plan": master_plan, "phases_raw": res_s4.get("phases_raw", "")},
                custom_prompts
            )
            tiny_text = res_s5.get("tiny_goals_text", "")
            out_s5 = res_s5.get("output_text", "")
            if out_s5:
                save_message_io(task_id, role="assistant", content=out_s5, stage="stage_5_tiny_goals_audit")
            check_and_generate_summary_io(task_id, custom_prompts)

            # 3. Stage 6: Parse structured list of all tiny goals grouped by main goal section
            parsed_sections = parse_sections_and_tiny_goals_io(tiny_text)
            
            queue_summary_lines = ["📋 **Stage 6: Structured Execution Queue**\n"]
            for sec_idx, sec in enumerate(parsed_sections, 1):
                queue_summary_lines.append(f"**Section {sec_idx}: {sec['section_name']}**")
                for goal_idx, goal in enumerate(sec["tiny_goals"], 1):
                    queue_summary_lines.append(f"  - Micro-Goal {sec_idx}.{goal_idx}: {goal}")
            save_message_io(task_id, role="assistant", content="\n".join(queue_summary_lines), stage="stage_6_queue_ready")

            # 4. Stage 7: Section-by-Section Execution Loop
            all_section_deliverables = []
            context_accumulator = ""

            for sec_idx, sec in enumerate(parsed_sections, 1):
                sec_name = sec["section_name"]
                tiny_goals = sec.get("tiny_goals", [])
                section_worker_outputs = []

                save_message_io(
                    task_id,
                    role="assistant",
                    content=f"🚀 **Starting Section {sec_idx}/{len(parsed_sections)}**: {sec_name}\n({len(tiny_goals)} tiny goals queued)",
                    stage=f"stage_7_section_{sec_idx}_start"
                )

                # Process each tiny goal in this section 1-by-1
                for goal_idx, goal in enumerate(tiny_goals, 1):
                    stage_key = f"stage_7_goal_{sec_idx}_{goal_idx}"
                    save_task_session_io(task_id, title=task_description[:50], status="running", current_stage=stage_key)

                    # Worker Call
                    worker_res = execute_agent_stage_io(
                        task_id,
                        "stage_7_tiny_goal_worker",
                        task_description,
                        {
                            "section_name": sec_name,
                            "current_tiny_goal": goal,
                            "context_so_far": context_accumulator
                        },
                        custom_prompts
                    )
                    worker_out = worker_res.get("output_text", "")

                    # Auditor Call
                    auditor_res = execute_agent_stage_io(
                        task_id,
                        "stage_7_tiny_goal_auditor",
                        task_description,
                        {
                            "current_tiny_goal": goal,
                            "worker_output": worker_out
                        },
                        custom_prompts
                    )
                    audit_out = auditor_res.get("output_text", "")

                    # Save verified tiny goal output into chat thread
                    formatted_goal_msg = (
                        f"🔨 **Micro-Goal {sec_idx}.{goal_idx} Completed**: {goal}\n\n"
                        f"**Worker Output**:\n{worker_out}\n\n"
                        f"🔍 **Auditor Verification**: {audit_out}"
                    )
                    save_message_io(task_id, role="assistant", content=formatted_goal_msg, stage=stage_key)
                    section_worker_outputs.append(f"Goal: {goal}\nOutput: {worker_out}")
                    context_accumulator += f"\n- {sec_name} ({goal}): {worker_out[:150]}"
                    check_and_generate_summary_io(task_id, custom_prompts)

                # Synthesize the completed section (Section Synthesizer Call)
                synth_res = execute_agent_stage_io(
                    task_id,
                    "stage_7_section_synthesizer",
                    task_description,
                    {
                        "section_name": sec_name,
                        "section_outputs": "\n\n".join(section_worker_outputs)
                    },
                    custom_prompts
                )
                synth_out = synth_res.get("output_text", "")
                save_message_io(
                    task_id,
                    role="assistant",
                    content=f"📦 **Section {sec_idx} Synthesized Deliverable** ({sec_name}):\n\n{synth_out}",
                    stage=f"stage_7_section_{sec_idx}_synthesized"
                )
                all_section_deliverables.append(f"Section {sec_idx} ({sec_name}):\n{synth_out}")
                check_and_generate_summary_io(task_id, custom_prompts)

            # 5. Stage 8: Shape Final Product Following Master Plan
            save_task_session_io(task_id, title=task_description[:50], status="waiting_approval", current_stage="stage_8_final_product")
            final_res = execute_agent_stage_io(
                task_id,
                "stage_8_final_product",
                task_description,
                {
                    "master_plan": master_plan,
                    "all_sections_output": "\n\n".join(all_section_deliverables)
                },
                custom_prompts
            )
            final_out = final_res.get("output_text", "")
            save_message_io(
                task_id,
                role="assistant",
                content=f"🎉 **Final Product Deliverable (Stage 8)**:\n\n{final_out}",
                stage="stage_8_final_product"
            )
            check_and_generate_summary_io(task_id, custom_prompts)

        except Exception as e:
            save_message_io(task_id, role="system", content=f"⚠️ Pipeline Error: {str(e)}", stage="error")
            save_task_session_io(task_id, title=task_description[:50], status="error", current_stage="error")
        finally:
            release_task_lock(task_id)

    # Launch daemon background worker thread
    thread = threading.Thread(target=background_worker, daemon=True)
    thread.start()
