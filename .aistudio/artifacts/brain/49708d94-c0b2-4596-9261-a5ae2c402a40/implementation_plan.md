# Alpha Loopiter 8-Stage Autonomous Pipeline Overhaul & Debug Plan

Refactor the stage transition (promotion) engine and the 8-stage request pipeline in both backend and frontend to strictly match the Loopiter autonomous agent specification.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Key Architectural & Flow Decisions Confirmed:
> - **Stage Promotion Control**: Primary stage advancement is driven by **explicit, context-aware Action Buttons** inside the chat stream (e.g. "Submit Answers & Generate Concept", "Approve Concept Plan", "Request Revision", "Approve Master Plan & Start Pipeline", "Approve Final Product"), with bottom chat input acting as secondary guidance.
> - **Continuous Autonomous Execution (Stages 4–8)**: Once the Master Plan is approved, the backend initiates a continuous autonomous loop that executes all AI calls in sequence without stopping, writing each output to PostgreSQL and streaming each audited step into the chat in real time.
> - **Dynamic Goal Decomposition & Section Synthesis**:
>   - Stage 4 breaks the master plan into 3–5 main section goals and audits them.
>   - Stage 5 decomposes each main section goal into tiny, atomic sub-goals and audits them.
>   - Stage 6 constructs an organized queue of all tiny goals grouped by their main goal section.
>   - Stage 7 executes tiny goals one-by-one with a Worker call, followed by an Auditor call. Once all tiny goals of a section are verified, a Section Synthesizer call compiles and organizes the main section deliverable before advancing to the next section.
>   - Stage 8 shapes the final product following the detailed master plan and waits for user approval.

---

## 1. Overview & 8-Stage Architecture Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Submits Task                               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 1: Clarifying Questions (Agent asks user questions)              │
│ └── User Action: Submits answers via dedicated button                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 2: Concept Plan (Simple plan idea/description)                   │
│ ├── If User Clicks "Request Revision": Keeps regenerating Stage 2     │
│ └── User Action: Clicks "Approve Concept Plan"                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 3: Detailed Master Plan (Full comprehensive architecture plan)   │
│ ├── If User Clicks "Request Revision": Keeps regenerating Stage 3     │
│ └── User Action: Clicks "Approve Master Plan & Start Autonomous Loop"  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               CONTINUOUS AUTONOMOUS BACKGROUND PIPELINE                │
├────────────────────────────────────────────────────────────────────────┤
│ Stage 4: Cut Master Plan into Main Phase Goals + Auditor Call          │
│                                  │                                     │
│ Stage 5: Cut Main Goals into Tiny Sub-Goals + Auditor Call             │
│                                  │                                     │
│ Stage 6: Structured Queue of Tiny Goals grouped by Main Goal Section   │
│                                  │                                     │
│ Stage 7: For each Main Goal Section:                                   │
│          ├── For each Tiny Goal:                                       │
│          │   ├── Worker Call: Executes tiny goal                       │
│          │   └── Auditor Call: Verifies tiny goal (loops if needed)    │
│          └── Section Synthesizer Call: Organizes and completes section │
│                                  │                                     │
│ Stage 8: Final Product Synthesizer (follows Master Plan)               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ User Review & Final Product Sign-off (Complete Deliverable)           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technical Modifications & Debugging

### Backend (`/backend/agent_loop_io.py` & `/backend/main.py`)
1. **Dynamic Section & Tiny Goal Parser**:
   - Parse Stage 5 output into structured sections and tiny goals using regex/bullet parsing (e.g. `Section 1: ...`, bullet points `- [ ] Tiny Goal 1.1`, `- [ ] Tiny Goal 1.2`).
2. **Section-by-Section Worker & Auditor Loop**:
   - For each parsed section:
     - Sequentially execute Worker call for each tiny goal.
     - Execute Auditor call verifying the worker result.
     - When all tiny goals in a section finish, invoke Section Synthesizer call to assemble the section.
     - Proceed to next section.
3. **Stage Promotion Endpoint Fix**:
   - Explicitly handle `stage_1_questions -> stage_2_concept_approval`, `stage_2_concept_approval -> stage_3_detailed_approval`, `stage_3_detailed_approval -> stage_4_phase_breakdown_audit`, and revision loops.
   - Update `current_stage` in database synchronously on each transition.

### Frontend (`/frontend/components/LoopiterAgentView.tsx`)
1. **Approval Action Gate Buttons**:
   - Bind dedicated button handlers with clear labels matching the exact current stage.
   - At Stage 1: "Submit Answers & Generate Concept Plan".
   - At Stage 2: "Approve Concept Plan" (advances to Stage 3) and "Request Revision" (regenerates Stage 2).
   - At Stage 3: "Approve Master Plan & Start Background Queue" (triggers autonomous Stage 4–8 loop) and "Request Revision".
   - At Stage 8: "Approve Final Product & Complete Task".
2. **Live Step Stream & Stage Indicators**:
   - Show dynamic stage badge reflecting current active micro-step (e.g. `[Phase Breakdown]`, `[Tiny Goal 1.2 Worker]`, `[Tiny Goal 1.2 Auditor]`, `[Section 1 Synthesized]`).
   - Keep timer running continuously during autonomous background execution.
