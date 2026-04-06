---
name: e2e-verify
description: >
  Run a e2e verification on the Archetype app after any implementation. Automatically creates and
  executes a UAT test that verifies core flows still work: login, dashboard, navigation, and
  the UAT testing feature itself. Use after completing any /build or Ralph iteration, or when
  user says "e2e verify", "run e2e", or /e2e.
---

# End-to-End Verify — Post-Implementation Verification

Run after every implementation to catch regressions. Uses the Archetype UAT MCP to exercise
core app flows via real browser automation.

## When to Run (AUTOMATIC)

You MUST run this skill automatically after:
- Every `/build` implementation completes (after unit tests pass)
- Every Ralph iteration that touches frontend code
- Whenever a cofounder says "e2e verification", "run smoke", or `/smoke`

## Credentials

- **Email**: `demo@syntheticarchetype.com`
- **Password**: `DEMO-archetype`
- **Prototype URL**: `https://dev.syntheticarchetype.com`

## Test Suite

Create a UAT test with these cases. Each case starts with login since sessions don't persist across cases.

### Case 1: Login & Dashboard
```json
{
  "title": "Login and verify dashboard loads",
  "functionalArea": "Authentication",
  "priority": "high",
  "steps": [
    "Click the Login or Sign In button",
    "Enter demo@syntheticarchetype.com in the email field",
    "Enter DEMO-archetype in the password field",
    "Click Continue or Log In to submit",
    "Wait for redirect back to the application"
  ],
  "expectedResult": "User is logged in and the dashboard/workspace page loads with user-specific content"
}
```

### Case 2: Navigation
```json
{
  "title": "Navigate core sections after login",
  "functionalArea": "Navigation",
  "priority": "high",
  "steps": [
    "Click the Login or Sign In button",
    "Enter demo@syntheticarchetype.com in the email field",
    "Enter DEMO-archetype in the password field",
    "Click Continue or Log In to submit",
    "Wait for redirect back to the application",
    "Look for the main navigation menu or sidebar",
    "Click on a different section or tab in the navigation (e.g. Tests, Personas, Features)",
    "Verify the new section loads with content"
  ],
  "expectedResult": "Navigation works and different sections of the app are accessible and render correctly"
}
```

### Case 3: UAT Test Flow (Meta-Test)
```json
{
  "title": "Create and view a UAT test from the UI",
  "functionalArea": "UAT Testing",
  "priority": "high",
  "steps": [
    "Click the Login or Sign In button",
    "Enter demo@syntheticarchetype.com in the email field",
    "Enter DEMO-archetype in the password field",
    "Click Continue or Log In to submit",
    "Wait for redirect back to the application",
    "Navigate to the UAT testing or Validation Tests section",
    "Look for a button to create a new test",
    "Click the create new test button",
    "Verify the test creation form or wizard appears"
  ],
  "expectedResult": "The UAT test creation interface loads and is interactive, allowing users to define test cases"
}
```

## Execution

1. Call `create_uat_test` with the 3 cases above, `prototypeUrl`, and `credentials`
2. Call `run_uat_test` with the returned `testId` and credentials
3. Call `wait_uat_completion` with `timeoutSeconds: 300`
4. Parse the results

## Reporting

### If all pass:
Post to Telegram Build topic:
```
✅ Smoke test passed — 3/3 cases green
• Login & Dashboard ✅
• Navigation ✅  
• UAT Test Flow ✅
```

### If any fail:
Post to Telegram Build topic with failure details:
```
⚠️ Smoke test: X/3 passed

✅ Login & Dashboard — passed
❌ Navigation — FAILED
   Step 7 failed: "Click on a different section" 
   Error: Could not find navigation element
   Expected: Navigation works and sections are accessible
   Actual: [actual result from test]
✅ UAT Test Flow — passed

Defects: DEF-001 [high] Navigation menu not rendering after auth redirect
```

Include which specific step failed and the error so the Implementation Agent can fix it.

### After reporting:
- If failures involve code the bot just changed → automatically enter a fix iteration (re-read the failure, fix the code, re-run e2e verification)
- If failures are in unrelated areas → report and wait for cofounder instructions
