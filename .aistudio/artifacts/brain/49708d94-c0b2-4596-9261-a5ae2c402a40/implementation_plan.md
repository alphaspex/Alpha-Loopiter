# Workspace Restructuring & Cleanup Plan

Clear the current project workspace to set up a clean repository structure for the **Alpha loopiter AI agent**, preparing the repository for GitHub export and Render deployment.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following workspace decisions were confirmed during Phase 1:
> - **Current React code cleanup**: Delete current starter React source code and set up clean `frontend/` and `backend/` target folders.
> - **Configuration files location**: Retain root-level configuration (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`) so the preview environment remains stable without crashing while keeping the workspace clean.
> - **Backend folder initialization**: Keep `backend/` clean and ready for Alpha loopiter agent integration.

---

## 1. Overview & Core Concept
- **Goal**: Transform the default starter app workspace into a structured, dual-directory layout (`frontend/` and `backend/`) suited for GitHub repository cloning and Render server hosting.
- **Audience / Target Agent**: Alpha loopiter AI agent.
- **Key Value**: Clean separation of concerns with dedicated frontend and backend structures while preserving basic root configuration required for repository tooling.

---

## 2. User Experience & Visual Design
- **Minimal Placeholder UI**: Maintain a minimal root HTML/entry point so AI Studio build checks succeed without cluttering the repository with starter boilerplate code.
- **Directory Structure**:
  - `/frontend/`: Folder for frontend code and UI components.
  - `/backend/`: Folder for backend services, APIs, and agent loops.

---

## 3. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────┐
  AI Studio Workspace Root (GitHub / Render Ready)
├───────────────────────────┬─────────────────────────────┤
│                           │                             │
│   /frontend/              │   /backend/                 │
│   (UI Code & Components)  │   (Agent Services & APIs)   │
│                           │                             │
├───────────────────────────┴─────────────────────────────┤
│   Root Build & Repository Config                        │
│   (package.json, vite.config.ts, index.html)            │
└─────────────────────────────────────────────────────────┘
```

- **Clean Action Steps**:
  1. Create `/frontend/` and `/backend/` directories (with minimal placeholders or `.gitkeep` to preserve empty directories in git).
  2. Remove default starter files in `/src/` to clear out sample code as requested.
  3. Ensure root `index.html` and entry imports point cleanly to the frontend structure so preview builds remain valid.

---

## 4. Expected Deliverables & Status Accounting
As requested by user guidelines, status will be reported in 3 tiers upon completion:
- **100% Working**: Files created, workspace structured, build verified.
- **Might Not Work %**: Features awaiting custom agent implementation (e.g. backend logic in `/backend/`).
- **Wasn't Done**: Any out-of-scope features postponed for Alpha loopiter setup turns.
