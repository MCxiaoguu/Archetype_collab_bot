# UAT Step-Level Error Details

**Date:** 2026-04-06
**Status:** Approved
**Requested by:** Cofounder via Telegram

## Problem

After a UAT test run completes, users can only see case-level results (pass/fail/blocked + a text "actual result"). There is no way to see which specific step failed, what error occurred, or which steps were blocked. The backend already captures detailed per-step logs (step_idx, instruction, action_taken, success, error, screenshot_b64), but the frontend ignores them.

## Design

### Approved Approach

Inline step status indicators + expandable error details dropdown. After a test run completes:

1. Each step row in the test case table gets a colored status icon:
   - Green checkmark = step passed
   - Red X = step failed
   - Amber dash = step blocked (skipped due to prior failure)

2. Failed steps get a red border highlight on the step text

3. Blocked steps get an amber border + reduced opacity

4. Below the failed step, an expandable "Error Details" dropdown appears with:
   - **What Happened** — the error message from the runner
   - **Action Attempted** — the JSON action the LLM mapper tried to execute
   - **Blocked Steps** — list of subsequent steps that were skipped

5. Passing test cases show all-green checkmarks with no dropdown

### Data Flow

**Backend (already exists, minor change needed):**
- `results.step_logs` is already stored per case in MongoDB and returned via `/api/uat/tests/<id>/results` inside the `results` field
- `transform_to_frontend()` already passes `results` through as-is: `"results": doc.get("results")`
- Step log shape: `{ step_idx, instruction, action_taken, success, error, screenshot_b64 }`
- No backend endpoint changes needed — step_logs are already available in the results response

**Frontend changes needed:**

1. **New type: `StepLog`** in `types/workspace.ts`:
   ```ts
   interface StepLog {
     stepIdx: number;
     instruction: string;
     actionTaken: string;
     success: boolean;
     error: string | null;
     screenshotB64: string;
   }
   ```

2. **New type: `UATResults`** in `types/workspace.ts`:
   ```ts
   interface UATResults {
     total: number;
     passed: number;
     failed: number;
     blocked: number;
     stepLogs: Record<string, StepLog[]>;  // keyed by case ID
     screenshots: Record<string, string[]>;
   }
   ```

3. **`useUATTest.ts` hook** — `loadResults` must also store the `results` object (including `step_logs`) in state so the table component can access it. Add a `results` field to the hook state.

4. **`UATTestCasesTable.tsx`** — after test completion, render step rows with:
   - Status icon (pass/fail/blocked) based on matching step_log entry
   - Red/amber border styling on the step text input
   - Expandable error dropdown below failed steps
   - Steps without matching logs (draft/not-run) render as today (no icon)

5. **New component: `StepErrorDetails.tsx`** — the expandable dropdown panel that shows error info for a failed step. Receives a `StepLog` and renders the three sections.

### Backend: camelCase Transform for Step Logs

The backend stores step_logs with snake_case keys (`step_idx`, `action_taken`, `screenshot_b64`). The frontend expects camelCase. Two options:

- **Option A:** Transform in `transform_to_frontend()` — add a loop that converts step_log keys to camelCase before returning
- **Option B:** Transform on the frontend when consuming

**Decision:** Option A — transform in `transform_to_frontend()` for consistency with the rest of the API. Add a `_transform_step_logs()` helper that converts the `results.step_logs` dict.

### Interaction Details

- The error dropdown is **collapsed by default** — user clicks to expand
- Only appears on steps where `success === false` and the step is not blocked
- Blocked steps show their "blocked by" message in a subtle amber text below the step, not in a full dropdown
- During `running` status, steps remain as plain text (no icons) — icons only appear after completion
- Step inputs remain read-only/disabled after completion (existing behavior)

### Scope Boundaries

- No screenshots in the error dropdown for this iteration (base64 images are large; can add later)
- No step-level timing information (not tracked by runner)
- No changes to the DefectTracker or TestResultsView components
- No changes to real-time streaming/polling behavior
