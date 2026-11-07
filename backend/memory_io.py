"""
Pure I/O module for managing chat summarization (every 20 messages)
and the agent tool for retrieving full chat context from summary IDs.
"""

from typing import Dict, Any, List
from database_io import get_task_messages_io, save_summary_io, get_full_chat_from_summary_id_io
from edenai_io import call_edenai_io
from prompt_io import format_system_prompt_io

def check_and_generate_summary_io(task_id: str, custom_prompts: Dict[str, str] = None) -> Dict[str, Any]:
    """
    Pure I/O function: Checks message history for a task session.
    If new unsummarized block of 20 messages exists, generates a 20-30 word summary using Eden AI
    and saves it to the database with a unique summary_id.
    """
    messages = get_task_messages_io(task_id)
    total_msgs = len(messages)
    
    # Check every complete block of 20 messages
    if total_msgs < 20:
        return {"summarized": False, "reason": "Fewer than 20 messages"}
    
    # Block index check: 1-20, 21-40, 41-60...
    block_end = (total_msgs // 20) * 20
    block_start = block_end - 19
    
    # Format message text for the block
    block_msgs = [m for m in messages if block_start <= m["step_number"] <= block_end]
    if not block_msgs:
        return {"summarized": False, "reason": "No block messages"}

    block_text = "\n".join([f"[{m['role'].upper()}]: {m['content']}" for m in block_msgs])
    
    system_prompt = format_system_prompt_io("summarizer", custom_prompts)
    user_prompt = (
        f"Summarize the following 20 chat messages into a concise summary of STRICTLY 20 to 30 words:\n\n{block_text}"
    )

    llm_res = call_edenai_io(
        messages=[{"role": "user", "content": user_prompt}],
        system_prompt=system_prompt
    )

    if llm_res.get("success"):
        summary_text = llm_res.get("text", "").strip()
        saved = save_summary_io(task_id, summary_text, block_start, block_end)
        return {
            "summarized": True,
            "summary_id": saved.get("summary_id"),
            "summary_text": summary_text,
            "start_step": block_start,
            "end_step": block_end
        }
    else:
        return {"summarized": False, "error": llm_res.get("error")}

def agent_tool_get_full_chat_from_summary_io(summary_id: str) -> Dict[str, Any]:
    """
    Agent tool pure I/O function: Takes a summary ID and returns the complete text
    of all 20 messages summarized under that summary ID.
    """
    return get_full_chat_from_summary_id_io(summary_id)
