# Alpha Loopiter Deep Task Agent Implementation Plan (Revised)

Build the complete **Alpha Loopiter AI Agent** system with a Python FastAPI Docker backend (Eden AI `ternary-bonsai-27b` model), PostgreSQL memory & summary persistence, customizable System Prompt Settings UI, and an 8-Stage Autonomous Deep Task Agent loop as the single unified interface (with message editing/resending, live execution timer `00:00`, and memory tools).

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Revised Architecture Decisions:
> - **Unified Deep Task Interface**: No separate "normal chat". The main conversation IS the Loopiter Deep Task Agent workflow.
> - **In-Line Conversation Editing**: Users can edit any previous task input or response in the execution thread and click Resend, which trims subsequent steps and re-runs the autonomous loop from that exact step.
> - **Persistent Memory & Summaries**:
>   - Automatic 20–30 word summary generated after every 20 messages in the task execution thread.
>   - Agent tool `get_full_chat_from_summary_id(summary_id)` allowing the LLM to inspect historic task context when performing deep work.
>   - PostgreSQL database (`DATABASE_URL`) with local SQLite fallback for saved task sessions (`Saved Tasks` tab).
> - **Settings UI**: Edit and customize system prompts for all 8 agent call stages (Clarifier, Concept Planner, Detailed Planner, Phase Goal Auditor, Sub-goal Auditor, Tiny Goal Worker, Section Synthesizer, Final Product Auditor).
> - **Python Docker Backend**: Render Web Service ready with `API_KEY` environment variable passed to Eden AI `https://api.edenai.run/v3/chat/completions` (`ternary-bonsai-27b`).

---

## 1. Overview & Core Concept

**Alpha Loopiter** is an autonomous AI agent where the entire interaction model is centered around deep task execution. The user provides a goal/task, and the agent autonomously leads the conversation through clarifying questions, concept approval, detailed master planning, tiny goal breakdown, audited execution loops (handling up to 1,000+ sequential calls), and final deliverable generation.

---

## 2. User Experience & Navigation Layout

### Tabs & Navigation Layout
- **⚡ Loopiter Agent**: Main deep task workspace. Features:
  - Live execution timer (`00:00`) showing elapsed time on deep tasks.
  - Sequential 8-stage execution view (Questions -> Concept Approval -> Detailed Plan Approval -> Sub-Goal Breakdown -> Audited Tiny Goal Execution Loop -> Final Output).
  - In-line prompt editing: Edit any past user message or prompt and click "Resend & Re-run" to restart execution from that point.
- **📚 Saved Tasks**: Session explorer displaying historic deep task sessions, stored summaries (20–30 words), and full task message inspection.
- **⚙️ Agent Settings**: System Prompt Editor for customizing system prompts for every call stage in the agent architecture.

---

## 3. Technical Architecture & Pure I/O Design

```
┌─────────────────────────────────────────────────────────────┐
│               React SPA Frontend (Vite + Tailwind)          │
│   [⚡ Loopiter Agent View | 📚 Saved Tasks | ⚙️ Settings]    │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST API Calls
┌──────────────────────────────▼──────────────────────────────┐
│                Python Docker Backend (Render)               │
├─────────────────────────────────────────────────────────────┤
│  /api/deep-task/start   ──► Start New Deep Task             │
│  /api/deep-task/step    ──► Execute Next Autonomous Step    │
│  /api/deep-task/edit    ──► Edit Message & Truncate History │
│  /api/tasks             ──► List & Fetch Saved Task Sessions│
│  /api/prompts           ──► Manage Stage System Prompts     │
├─────────────────────────────────────────────────────────────┤
│                 Pure I/O Module Pipeline                    │
│  [edenai_io.py]     ──► Call Eden AI (ternary-bonsai-27b)   │
│  [prompt_io.py]     ──► Pure Prompt Formatting Engine      │
│  [memory_io.py]     ──► 20-Msg Summary Generator & Tool API │
│  [agent_loop_io.py] ──► 8-Stage Autonomous Task Loop Engine │
│  [database_io.py]   ──► PostgreSQL / SQLite Persistence     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       Eden AI API                PostgreSQL DB / SQLite
   (ternary-bonsai-27b)            (Tasks, Summaries, Prompts)
```

---

## 4. Implementation Details

### Phase A: Backend Python Files (Pure I/O Architecture)
1. `/backend/requirements.txt`: `fastapi`, `uvicorn`, `requests`, `sqlalchemy`, `psycopg2-binary`, `pydantic`.
2. `/backend/Dockerfile`: Lightweight Python 3.11 Docker container configured for Render Web Service (`$PORT`).
3. `/backend/database_io.py`: Black-box DB functions for PostgreSQL/SQLite (`init_db`, `save_task_session`, `save_message`, `get_messages`, `truncate_messages_from`, `save_summary`, `get_summary_by_id`, `save_prompt_settings`, `get_prompt_settings`).
4. `/backend/edenai_io.py`: Pure I/O function executing Eden AI REST requests using `API_KEY` header and `ternary-bonsai-27b` model.
5. `/backend/memory_io.py`: Generates 20–30 word summaries every 20 messages and provides `get_full_chat_from_summary_id(summary_id)` tool function.
6. `/backend/agent_loop_io.py`: The 8-Stage Autonomous Agent Engine:
   - **Stage 1 (Clarifier)**: Generates clarifying questions for user.
   - **Stage 2 (Concept Planner)**: Creates high-level concept & waits for user approval.
   - **Stage 3 (Detailed Planner)**: Creates full detailed master plan & waits for user approval.
   - **Stage 4 (Phase Goal Auditor)**: Cuts master plan into main phase goals & audits with Auditor LLM call.
   - **Stage 5 (Sub-Goal Auditor)**: Cuts phase goals into tiny goals & audits each tiny goal.
   - **Stage 6 (Queue Generator)**: Constructs ordered execution list of all tiny goals under main goal sections.
   - **Stage 7 (Worker & Auditor Loop)**: Sequentially executes each tiny goal with a Worker LLM call, followed by an Auditor LLM call verifying completion. Synthesizes section goals upon completion of tiny goal groups.
   - **Stage 8 (Final Product)**: Assembles final task deliverable and presents for final sign-off.
7. `/backend/main.py`: FastAPI application serving REST endpoints with CORS enabled.

### Phase B: Frontend React Components (Pure I/O Components)
1. `/frontend/services/api_io.ts`: Clean API client for backend REST routes.
2. `/frontend/components/LoopiterAgentView.tsx`: Main unified Loopiter Deep Task Agent component:
   - Elapsed timer header (`00:00`).
   - Deep task stage progress tracker.
   - Message timeline with inline edit & resend triggers (trimming subsequent steps).
   - Approval controls for Concept & Detailed plan stages.
   - Live worker/auditor execution stream.
3. `/frontend/components/SavedTasksView.tsx`: Explorer for saved task sessions and summary memory inspection.
4. `/frontend/components/SettingsView.tsx`: Customizable prompt editor for all 8 stage system prompts.
5. `/frontend/App.tsx`: Main layout header & tab router.

---

## 5. Step-by-Step Render Deployment Guide

Upon code generation, the final output will include complete instructions for:
1. Pushing the codebase to GitHub.
2. Setting up the Python Docker backend on Render Web Service (configuring `API_KEY` and `DATABASE_URL`).
3. Deploying the React frontend on Render Static Site (configuring `VITE_API_URL`).
