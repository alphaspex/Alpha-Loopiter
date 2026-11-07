"""
FastAPI Main Application Entry Point for Alpha Loopiter Backend.
Provides clean REST API endpoints for deep tasks, message editing/resending,
PostgreSQL saved tasks, system prompts management, and memory summary lookup tool.
"""

import os
import uuid
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database_io import (
    init_db_io,
    save_task_session_io,
    get_task_sessions_io,
    save_message_io,
    get_task_messages_io,
    truncate_task_messages_from_io,
    get_summaries_io,
    get_full_chat_from_summary_id_io,
    save_prompt_settings_io,
    get_prompt_settings_io
)
from prompt_io import get_default_prompts_io
from memory_io import check_and_generate_summary_io, agent_tool_get_full_chat_from_summary_io
from agent_loop_io import execute_agent_stage_io

app = FastAPI(
    title="Alpha Loopiter AI Agent API",
    description="Python Backend for Autonomous Deep Task Execution & Persistent PostgreSQL Memory",
    version="1.0.0"
)

# Enable CORS for frontend static sites & local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db_io()

# Pydantic Schemas
class StartTaskRequest(BaseModel):
    task_description: str
    custom_prompts: Optional[Dict[str, str]] = None

class StepTaskRequest(BaseModel):
    task_id: str
    stage: str
    task_description: str
    user_input: Optional[str] = None
    stage_data: Optional[Dict[str, Any]] = None
    custom_prompts: Optional[Dict[str, str]] = None

class EditMessageRequest(BaseModel):
    task_id: str
    message_id: str
    new_content: str
    custom_prompts: Optional[Dict[str, str]] = None

class PromptsRequest(BaseModel):
    prompts: Dict[str, str]

# API Endpoints
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": "Alpha Loopiter Backend",
        "model": "ternary-bonsai-27b",
        "db": "connected"
    }

@app.get("/api/prompts")
def get_prompts():
    db_prompts = get_prompt_settings_io()
    default_prompts = get_default_prompts_io()
    merged = {**default_prompts, **db_prompts}
    return {"prompts": merged, "defaults": default_prompts}

@app.post("/api/prompts")
def update_prompts(payload: PromptsRequest):
    success = save_prompt_settings_io(payload.prompts)
    if success:
        return {"success": True, "prompts": payload.prompts}
    raise HTTPException(status_code=500, detail="Failed to save prompt settings")

@app.get("/api/tasks")
def list_tasks():
    tasks = get_task_sessions_io()
    return {"tasks": tasks}

@app.get("/api/tasks/{task_id}")
def get_task_detail(task_id: str):
    messages = get_task_messages_io(task_id)
    summaries = get_summaries_io(task_id)
    return {"task_id": task_id, "messages": messages, "summaries": summaries}

@app.post("/api/deep-task/start")
def start_deep_task(payload: StartTaskRequest):
    task_id = f"task_{uuid.uuid4().hex[:10]}"
    title = payload.task_description[:50] + ("..." if len(payload.task_description) > 50 else "")
    
    save_task_session_io(task_id, title=title, status="in_progress", current_stage="stage_1_questions")
    save_message_io(task_id, role="user", content=payload.task_description, stage="initial_task")

    # Execute Stage 1: Clarifying Questions
    stage_res = execute_agent_stage_io(
        task_id=task_id,
        stage="stage_1_questions",
        task_description=payload.task_description,
        custom_prompts=payload.custom_prompts
    )

    output_text = stage_res.get("output_text", "")
    save_message_io(task_id, role="assistant", content=output_text, stage="stage_1_questions")
    
    # Auto-summarization check
    check_and_generate_summary_io(task_id, payload.custom_prompts)

    return {
        "task_id": task_id,
        "stage": "stage_1_questions",
        "next_stage": stage_res.get("next_stage"),
        "output_text": output_text,
        "requires_user_action": stage_res.get("requires_user_action"),
        "action_type": stage_res.get("action_type")
    }

@app.post("/api/deep-task/step")
def step_deep_task(payload: StepTaskRequest):
    # Save user response if provided
    if payload.user_input:
        save_message_io(payload.task_id, role="user", content=payload.user_input, stage=payload.stage)

    stage_res = execute_agent_stage_io(
        task_id=payload.task_id,
        stage=payload.stage,
        task_description=payload.task_description,
        stage_data=payload.stage_data or {},
        custom_prompts=payload.custom_prompts
    )

    output_text = stage_res.get("output_text", "")
    if output_text:
        save_message_io(payload.task_id, role="assistant", content=output_text, stage=payload.stage)
    
    # Update stage in DB
    save_task_session_io(
        task_id=payload.task_id,
        title=payload.task_description[:50],
        status="completed" if stage_res.get("next_stage") == "completed" else "in_progress",
        current_stage=payload.stage
    )

    # Check 20-message auto summary
    summary_res = check_and_generate_summary_io(payload.task_id, payload.custom_prompts)

    return {
        "task_id": payload.task_id,
        "stage": payload.stage,
        "next_stage": stage_res.get("next_stage"),
        "output_text": output_text,
        "stage_data": stage_res,
        "requires_user_action": stage_res.get("requires_user_action"),
        "action_type": stage_res.get("action_type"),
        "summary_info": summary_res
    }

@app.post("/api/deep-task/edit")
def edit_task_message(payload: EditMessageRequest):
    """
    Message Editing & Resending Endpoint:
    Truncates message history from target message_id forward, updates message text,
    and returns updated history to allow re-running execution loop from that point.
    """
    res = truncate_task_messages_from_io(payload.task_id, payload.message_id)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to truncate message history"))

    # Save edited user message
    saved = save_message_io(payload.task_id, role="user", content=payload.new_content, stage="edited_prompt")
    
    # Return updated message list
    messages = get_task_messages_io(payload.task_id)
    return {
        "success": True,
        "task_id": payload.task_id,
        "edited_message_id": saved.get("id"),
        "messages": messages
    }

@app.get("/api/summary-tool/{summary_id}")
def summary_tool_lookup(summary_id: str):
    """
    Agent tool API endpoint: Fetches full 20-message block for given summary ID.
    """
    result = agent_tool_get_full_chat_from_summary_io(summary_id)
    if not result.get("found"):
        raise HTTPException(status_code=404, detail=result.get("error"))
    return result

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
