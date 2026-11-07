"""
Pure I/O module for PostgreSQL database persistence with local SQLite fallback.
Black-box input -> output database functions.
"""

import os
import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./loopiter.db")

# Handle Render PostgreSQL postgres:// fix for SQLAlchemy
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TaskSessionDB(Base):
    __tablename__ = "task_sessions"
    id = Column(String(64), primary_key=True)
    title = Column(Text, nullable=False)
    status = Column(String(32), default="in_progress") # in_progress, completed, paused
    current_stage = Column(String(64), default="stage_1_questions")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TaskMessageDB(Base):
    __tablename__ = "task_messages"
    id = Column(String(64), primary_key=True)
    task_id = Column(String(64), ForeignKey("task_sessions.id", ondelete="CASCADE"))
    role = Column(String(16), nullable=False) # user, assistant, system
    content = Column(Text, nullable=False)
    stage = Column(String(64), nullable=True)
    step_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class TaskSummaryDB(Base):
    __tablename__ = "task_summaries"
    id = Column(String(64), primary_key=True)
    task_id = Column(String(64), ForeignKey("task_sessions.id", ondelete="CASCADE"))
    summary_text = Column(Text, nullable=False) # 20-30 words summary
    start_step = Column(Integer, nullable=False)
    end_step = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class SystemPromptDB(Base):
    __tablename__ = "system_prompts"
    stage_key = Column(String(64), primary_key=True)
    prompt_text = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db_io() -> bool:
    """Pure I/O function to initialize DB tables."""
    try:
        Base.metadata.create_all(bind=engine)
        return True
    except Exception as e:
        print(f"DB Init Error: {e}")
        return False

def save_task_session_io(task_id: str, title: str, status: str = "in_progress", current_stage: str = "stage_1_questions") -> Dict[str, Any]:
    """Pure I/O function to insert or update task session."""
    session = SessionLocal()
    try:
        task = session.query(TaskSessionDB).filter(TaskSessionDB.id == task_id).first()
        if not task:
            task = TaskSessionDB(id=task_id, title=title, status=status, current_stage=current_stage)
            session.add(task)
        else:
            task.title = title
            task.status = status
            task.current_stage = current_stage
            task.updated_at = datetime.utcnow()
        session.commit()
        return {"id": task.id, "title": task.title, "status": task.status, "current_stage": task.current_stage}
    except Exception as e:
        session.rollback()
        return {"error": str(e)}
    finally:
        session.close()

def get_task_sessions_io() -> List[Dict[str, Any]]:
    """Pure I/O function to list all task sessions."""
    session = SessionLocal()
    try:
        tasks = session.query(TaskSessionDB).order_by(TaskSessionDB.updated_at.desc()).all()
        return [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "current_stage": t.current_stage,
                "created_at": t.created_at.isoformat(),
                "updated_at": t.updated_at.isoformat()
            }
            for t in tasks
        ]
    finally:
        session.close()

def save_message_io(task_id: str, role: str, content: str, stage: Optional[str] = None) -> Dict[str, Any]:
    """Pure I/O function to append a message to task session history."""
    session = SessionLocal()
    try:
        count = session.query(TaskMessageDB).filter(TaskMessageDB.task_id == task_id).count()
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        msg = TaskMessageDB(
            id=msg_id,
            task_id=task_id,
            role=role,
            content=content,
            stage=stage,
            step_number=count + 1
        )
        session.add(msg)
        session.commit()
        return {
            "id": msg.id,
            "task_id": msg.task_id,
            "role": msg.role,
            "content": msg.content,
            "stage": msg.stage,
            "step_number": msg.step_number
        }
    except Exception as e:
        session.rollback()
        return {"error": str(e)}
    finally:
        session.close()

def get_task_messages_io(task_id: str) -> List[Dict[str, Any]]:
    """Pure I/O function to fetch all messages for a task."""
    session = SessionLocal()
    try:
        msgs = session.query(TaskMessageDB).filter(TaskMessageDB.task_id == task_id).order_by(TaskMessageDB.step_number.asc()).all()
        return [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "stage": m.stage,
                "step_number": m.step_number,
                "created_at": m.created_at.isoformat()
            }
            for m in msgs
        ]
    finally:
        session.close()

def truncate_task_messages_from_io(task_id: str, message_id: str) -> Dict[str, Any]:
    """
    Pure I/O function for editing/resending messages:
    Deletes the target message and ALL subsequent messages after it.
    """
    session = SessionLocal()
    try:
        target_msg = session.query(TaskMessageDB).filter(TaskMessageDB.id == message_id, TaskMessageDB.task_id == task_id).first()
        if not target_msg:
            return {"success": False, "error": "Message not found"}
        
        step_num = target_msg.step_number
        deleted_count = session.query(TaskMessageDB).filter(
            TaskMessageDB.task_id == task_id,
            TaskMessageDB.step_number >= step_num
        ).delete()
        
        # Also delete any summaries that included truncated steps
        session.query(TaskSummaryDB).filter(
            TaskSummaryDB.task_id == task_id,
            TaskSummaryDB.end_step >= step_num
        ).delete()
        
        session.commit()
        return {"success": True, "deleted_count": deleted_count, "truncated_from_step": step_num}
    except Exception as e:
        session.rollback()
        return {"success": False, "error": str(e)}
    finally:
        session.close()

def delete_task_session_io(task_id: str) -> bool:
    """Pure I/O function to delete an entire task session and all its messages."""
    session = SessionLocal()
    try:
        session.query(TaskMessageDB).filter(TaskMessageDB.task_id == task_id).delete()
        session.query(TaskSummaryDB).filter(TaskSummaryDB.task_id == task_id).delete()
        session.query(TaskSessionDB).filter(TaskSessionDB.id == task_id).delete()
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        return False
    finally:
        session.close()

def bulk_delete_tasks_io(task_ids: List[str]) -> int:
    """Pure I/O function to delete multiple task sessions from database."""
    session = SessionLocal()
    try:
        session.query(TaskMessageDB).filter(TaskMessageDB.task_id.in_(task_ids)).delete(synchronize_session=False)
        session.query(TaskSummaryDB).filter(TaskSummaryDB.task_id.in_(task_ids)).delete(synchronize_session=False)
        deleted = session.query(TaskSessionDB).filter(TaskSessionDB.id.in_(task_ids)).delete(synchronize_session=False)
        session.commit()
        return deleted
    except Exception as e:
        session.rollback()
        return 0
    finally:
        session.close()

def save_summary_io(task_id: str, summary_text: str, start_step: int, end_step: int) -> Dict[str, Any]:
    """Pure I/O function to save a 20-30 word message block summary."""
    session = SessionLocal()
    try:
        summary_id = f"sum_{uuid.uuid4().hex[:10]}"
        summary = TaskSummaryDB(
            id=summary_id,
            task_id=task_id,
            summary_text=summary_text,
            start_step=start_step,
            end_step=end_step
        )
        session.add(summary)
        session.commit()
        return {
            "summary_id": summary.id,
            "task_id": summary.task_id,
            "summary_text": summary.summary_text,
            "start_step": summary.start_step,
            "end_step": summary.end_step
        }
    except Exception as e:
        session.rollback()
        return {"error": str(e)}
    finally:
        session.close()

def get_summaries_io(task_id: str) -> List[Dict[str, Any]]:
    """Pure I/O function to list all summaries for a task."""
    session = SessionLocal()
    try:
        sums = session.query(TaskSummaryDB).filter(TaskSummaryDB.task_id == task_id).order_by(TaskSummaryDB.start_step.asc()).all()
        return [
            {
                "summary_id": s.id,
                "summary_text": s.summary_text,
                "start_step": s.start_step,
                "end_step": s.end_step
            }
            for s in sums
        ]
    finally:
        session.close()

def get_full_chat_from_summary_id_io(summary_id: str) -> Dict[str, Any]:
    """
    AGENT TOOL: Pure I/O function. Given a summary_id, returns the full block
    of messages summarized by that summary ID.
    """
    session = SessionLocal()
    try:
        summary = session.query(TaskSummaryDB).filter(TaskSummaryDB.id == summary_id).first()
        if not summary:
            return {"found": False, "error": f"Summary ID {summary_id} not found."}
        
        msgs = session.query(TaskMessageDB).filter(
            TaskMessageDB.task_id == summary.task_id,
            TaskMessageDB.step_number >= summary.start_step,
            TaskMessageDB.step_number <= summary.end_step
        ).order_by(TaskMessageDB.step_number.asc()).all()
        
        return {
            "found": True,
            "summary_id": summary.id,
            "summary_text": summary.summary_text,
            "start_step": summary.start_step,
            "end_step": summary.end_step,
            "messages": [
                {"step": m.step_number, "role": m.role, "content": m.content, "stage": m.stage}
                for m in msgs
            ]
        }
    finally:
        session.close()

# Alias for agent tool lookup
agent_tool_get_full_chat_from_summary_io = get_full_chat_from_summary_id_io

def save_prompt_settings_io(prompts: Dict[str, str]) -> bool:
    """Pure I/O function to save custom system prompts to database."""
    session = SessionLocal()
    try:
        for key, val in prompts.items():
            db_prompt = session.query(SystemPromptDB).filter(SystemPromptDB.stage_key == key).first()
            if not db_prompt:
                db_prompt = SystemPromptDB(stage_key=key, prompt_text=val)
                session.add(db_prompt)
            else:
                db_prompt.prompt_text = val
                db_prompt.updated_at = datetime.utcnow()
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        return False
    finally:
        session.close()

def get_prompt_settings_io() -> Dict[str, str]:
    """Pure I/O function to retrieve custom system prompts from database."""
    session = SessionLocal()
    try:
        prompts = session.query(SystemPromptDB).all()
        return {p.stage_key: p.prompt_text for p in prompts}
    finally:
        session.close()
