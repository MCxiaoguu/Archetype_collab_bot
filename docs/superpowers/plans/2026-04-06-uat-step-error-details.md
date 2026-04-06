# UAT Step-Level Error Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface per-step pass/fail/blocked indicators and expandable error details in the UAT test cases table after a test run completes.

**Architecture:** Backend already stores step_logs per case in `results.step_logs`. We add a camelCase transform in the backend service, add TypeScript types for step logs, pipe them through the useUATTest hook into state, and render step-level status indicators + error dropdowns in UATTestCasesTable.

**Tech Stack:** Python/Flask (backend transform), React + TypeScript + Tailwind (frontend components)

---

### Task 1: Backend — camelCase transform for step_logs in results

**Files:**
- Modify: `Archetype_Backend/services/uat/uat_service.py:242-302` (transform_to_frontend)

- [ ] **Step 1: Add _transform_step_logs helper**

Add this function above `transform_to_frontend` in `uat_service.py`:

```python
def _transform_step_logs(results: dict | None) -> dict | None:
    """Convert step_logs keys from snake_case to camelCase for frontend."""
    if not results:
        return results
    step_logs = results.get("step_logs", {})
    transformed_logs = {}
    for case_id, logs in step_logs.items():
        transformed_logs[case_id] = [
            {
                "stepIdx": log.get("step_idx", 0),
                "instruction": log.get("instruction", ""),
                "actionTaken": log.get("action_taken", ""),
                "success": log.get("success", False),
                "error": log.get("error"),
                "screenshotB64": log.get("screenshot_b64", ""),
            }
            for log in logs
        ]
    return {
        **results,
        "step_logs": None,
        "stepLogs": transformed_logs,
    }
```

- [ ] **Step 2: Wire into transform_to_frontend**

In `transform_to_frontend`, change line `"results": doc.get("results"),` to:

```python
"results": _transform_step_logs(doc.get("results")),
```

- [ ] **Step 3: Verify backend starts cleanly**

Run: `cd Archetype_Backend && PYTHONPATH=. python -c "from services.uat.uat_service import transform_to_frontend; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd Archetype_Backend
git add services/uat/uat_service.py
git commit -m "feat(uat): add camelCase transform for step_logs in results API"
```

---

### Task 2: Frontend — Add StepLog and UATResults types

**Files:**
- Modify: `archetype_frontend/src/types/workspace.ts` (after UATTestCase interface, around line 111)

- [ ] **Step 1: Add StepLog interface**

Add after the `UATTestCase` interface in `types/workspace.ts`:

```typescript
export interface StepLog {
  stepIdx: number;
  instruction: string;
  actionTaken: string;
  success: boolean;
  error: string | null;
  screenshotB64: string;
}

export interface UATResults {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  stepLogs: Record<string, StepLog[]>;
  screenshots: Record<string, string[]>;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd archetype_frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors related to StepLog or UATResults

- [ ] **Step 3: Commit**

```bash
cd archetype_frontend
git add src/types/workspace.ts
git commit -m "feat(uat): add StepLog and UATResults type definitions"
```

---

### Task 3: Frontend — Pipe step logs through useUATTest hook

**Files:**
- Modify: `archetype_frontend/src/hooks/useUATTest.ts`

- [ ] **Step 1: Add stepLogs to hook state**

In `UseUATTestState` interface (around line 11), add a new field:

```typescript
stepLogs: Record<string, StepLog[]>;
```

Add the import at top of file:

```typescript
import type { UATTestCase, DefectEntry, StepLog } from '../types/workspace';
```

(Replace the existing import that only imports `UATTestCase, DefectEntry`.)

- [ ] **Step 2: Initialize stepLogs in default state**

Find where `useState<UseUATTestState>` is initialized (the initial state object). Add:

```typescript
stepLogs: {},
```

- [ ] **Step 3: Update loadResults to store stepLogs**

In the `loadResults` callback (around line 472), inside the `setState` call, add stepLogs extraction. Change:

```typescript
return {
  ...prev,
  cases: updatedCases,
  defects: res.defects || prev.defects,
  status: (res.status as any) || 'completed',
  progress: 100,
};
```

To:

```typescript
return {
  ...prev,
  cases: updatedCases,
  defects: res.defects || prev.defects,
  status: (res.status as any) || 'completed',
  progress: 100,
  stepLogs: res.results?.stepLogs || prev.stepLogs,
};
```

- [ ] **Step 4: Expose stepLogs in return value**

In the return statement of the hook (around line 505), `stepLogs` is already available via `...state`. No change needed — confirm it's there.

- [ ] **Step 5: Verify types compile**

Run: `cd archetype_frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 6: Commit**

```bash
cd archetype_frontend
git add src/hooks/useUATTest.ts
git commit -m "feat(uat): pipe step logs through useUATTest hook state"
```

---

### Task 4: Frontend — Create StepErrorDetails component

**Files:**
- Create: `archetype_frontend/src/components/workspace/StepErrorDetails.tsx`

- [ ] **Step 1: Create the component**

Write `StepErrorDetails.tsx`:

```tsx
import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { StepLog } from '../../types/workspace';

interface StepErrorDetailsProps {
  stepLog: StepLog;
  blockedSteps: { idx: number; instruction: string }[];
}

export function StepErrorDetails({ stepLog, blockedSteps }: StepErrorDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1.5 border border-red-300 rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 flex items-center gap-1.5 hover:bg-red-100 transition-colors"
      >
        {expanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
        Step {stepLog.stepIdx + 1} Failed — Error Details
      </button>
      {expanded && (
        <div className="px-3 py-2.5 bg-white border-t border-red-200 space-y-2.5">
          <div>
            <div className="text-[10px] font-semibold text-stone-500 uppercase mb-0.5">What Happened</div>
            <div className="text-xs text-stone-700 leading-relaxed">
              {stepLog.error || 'Unknown error'}
            </div>
          </div>
          {stepLog.actionTaken && stepLog.actionTaken !== '(blocked)' && (
            <div>
              <div className="text-[10px] font-semibold text-stone-500 uppercase mb-0.5">Action Attempted</div>
              <div className="text-xs text-stone-700 leading-relaxed">
                <code className="bg-red-50 px-1 py-0.5 rounded text-[11px] text-red-600 break-all">
                  {stepLog.actionTaken}
                </code>
              </div>
            </div>
          )}
          {blockedSteps.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-stone-500 uppercase mb-0.5">Blocked Steps</div>
              <div className="text-xs text-stone-700 leading-relaxed">
                {blockedSteps.map(s => (
                  <div key={s.idx}>Step {s.idx + 1} ("{s.instruction}") was skipped.</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd archetype_frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd archetype_frontend
git add src/components/workspace/StepErrorDetails.tsx
git commit -m "feat(uat): create StepErrorDetails expandable dropdown component"
```

---

### Task 5: Frontend — Add step status indicators to UATTestCasesTable

**Files:**
- Modify: `archetype_frontend/src/components/workspace/UATTestCasesTable.tsx`

- [ ] **Step 1: Add stepLogs prop and imports**

Update the imports and props interface:

```tsx
import { PlusIcon, Trash2Icon, CheckCircle2Icon, XCircleIcon, MinusCircleIcon } from 'lucide-react';
import type { UATTestCase, PersonaCredential, StepLog } from '../../types/workspace';
import { StepErrorDetails } from './StepErrorDetails';

interface UATTestCasesTableProps {
  cases: UATTestCase[];
  onCasesChange: (cases: UATTestCase[]) => void;
  status: 'draft' | 'running' | 'completed' | 'failed';
  personaOptions: { id: string; name: string }[];
  initialTestCases?: UATTestCase[];
  stepLogs: Record<string, StepLog[]>;
}
```

- [ ] **Step 2: Update the destructured props**

Change the function signature:

```tsx
export function UATTestCasesTable({ cases, onCasesChange, status, personaOptions, initialTestCases, stepLogs }: UATTestCasesTableProps) {
```

- [ ] **Step 3: Replace the Steps row rendering**

Find the `{/* Steps */}` section (around line 267-305). Replace the step rendering inside the `<td>` with this logic that conditionally shows status icons when step logs are available:

```tsx
{/* Steps */}
<tr className={preRunOpacity}>
  <td className="px-3 py-2.5 font-semibold text-stone-700 border border-stone-200 bg-stone-50/50 align-top">Steps</td>
  <td className="px-3 py-2.5 border border-stone-200">
    <div className="space-y-2">
      {tc.steps.map((step, stepIdx) => {
        const logs = stepLogs[tc.id] || [];
        const log = logs.find(l => l.stepIdx === stepIdx);
        const hasResults = logs.length > 0;
        const isSuccess = log?.success === true;
        const isFailed = log ? !log.success && log.actionTaken !== '(blocked)' : false;
        const isBlocked = log ? !log.success && log.actionTaken === '(blocked)' : false;

        // Collect blocked steps for error dropdown
        const blockedSteps = isFailed
          ? logs
              .filter(l => !l.success && l.actionTaken === '(blocked)' && l.stepIdx > stepIdx)
              .map(l => ({ idx: l.stepIdx, instruction: l.instruction }))
          : [];

        return (
          <div key={stepIdx}>
            <div className="flex items-center gap-2">
              {hasResults && (
                <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {isSuccess && <CheckCircle2Icon className="w-4 h-4 text-emerald-600" />}
                  {isFailed && <XCircleIcon className="w-4 h-4 text-red-500" />}
                  {isBlocked && <MinusCircleIcon className="w-4 h-4 text-amber-500" />}
                </span>
              )}
              <span className="text-xs text-stone-400 shrink-0 w-12">Step {stepIdx + 1}:</span>
              <input
                type="text"
                value={step}
                onChange={e => updateStep(caseIdx, stepIdx, e.target.value)}
                placeholder="[Action to perform]"
                disabled={isPreRunLocked}
                className={`flex-1 text-sm outline-none border bg-stone-50/50 focus:border-stone-300 focus:bg-white px-2 py-1.5 placeholder:text-stone-400 transition-colors ${
                  isFailed
                    ? 'border-red-300 bg-red-50/50'
                    : isBlocked
                      ? 'border-amber-300 bg-amber-50/30 opacity-60'
                      : 'border-stone-200'
                }`}
              />
              {tc.steps.length > 1 && !isPreRunLocked && (
                <button
                  type="button"
                  onClick={() => removeStep(caseIdx, stepIdx)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center text-stone-400 hover:text-red-500 transition-colors"
                >
                  <Trash2Icon className="w-3 h-3" />
                </button>
              )}
            </div>
            {isFailed && log && (
              <div className="ml-[calc(20px+8px+48px+8px)]">
                <StepErrorDetails stepLog={log} blockedSteps={blockedSteps} />
              </div>
            )}
          </div>
        );
      })}
      {!isPreRunLocked && (
        <button
          type="button"
          onClick={() => addStep(caseIdx)}
          className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 transition-colors mt-1"
        >
          <PlusIcon className="w-3 h-3" />
          <span>Add Step</span>
        </button>
      )}
    </div>
  </td>
</tr>
```

- [ ] **Step 4: Verify types compile**

Run: `cd archetype_frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd archetype_frontend
git add src/components/workspace/UATTestCasesTable.tsx
git commit -m "feat(uat): add step-level status indicators and error details to test cases table"
```

---

### Task 6: Frontend — Wire stepLogs prop through TestTemplate

**Files:**
- Modify: `archetype_frontend/src/pages/Workspace/TestTemplate.tsx` (around line 202-208)

- [ ] **Step 1: Pass stepLogs to UATTestCasesTable**

Find the `<UATTestCasesTable` usage (around line 202). Add the `stepLogs` prop:

```tsx
<UATTestCasesTable
  cases={hook.cases}
  onCasesChange={hook.setCases}
  status={hook.status}
  personaOptions={availablePersonas}
  initialTestCases={initialTestCases}
  stepLogs={hook.stepLogs}
/>
```

- [ ] **Step 2: Verify types compile and dev server builds**

Run: `cd archetype_frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd archetype_frontend
git add src/pages/Workspace/TestTemplate.tsx
git commit -m "feat(uat): wire stepLogs from hook through to UATTestCasesTable"
```

---

### Task 7: Screenshot live dev server and send to Design topic

- [ ] **Step 1: Take screenshot of live app**

Navigate to the UAT test page on the dev server and screenshot it. If the dev server is running at `http://localhost:5173`, find a URL that shows the UAT test template page:

```bash
node scripts/screenshot.js http://localhost:5173 /tmp/design-previews/uat-live-final.png
```

- [ ] **Step 2: Send to Design topic for confirmation**

Send the screenshot to Telegram Design topic with a summary of what changed.

- [ ] **Step 3: Final commit — push to dev branch**

```bash
cd /home/archetype/archetype-project/Archetype_Backend && git push origin dev
cd /home/archetype/archetype-project/archetype_frontend && git push origin dev
```
