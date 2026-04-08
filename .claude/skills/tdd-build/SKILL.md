---
name: tdd-build
description: >
  MANDATORY test-driven build process. Enforces write-test-first discipline for every
  code change. Must be invoked by all Build Agent subagents before any implementation.
  Ensures changes are verifiable and regressions are caught. Cannot be skipped.
user-invocable: false
---

# TDD Build — Enforced Test-First Development

This skill enforces a strict test-first workflow. You CANNOT write implementation code
until you have written and run failing tests. This is not optional.

## Hard Gates

These are blocking checkpoints. You cannot proceed past a gate until it is satisfied.

```
GATE 1: Tests exist and FAIL     →  blocks implementation
GATE 2: Tests PASS after impl    →  blocks commit
GATE 3: Full suite PASSES        →  blocks push
```

## Phase 1: Impact Analysis

Before anything else, understand what you're changing.

1. Read the feature request / bug description
2. Identify which files and modules will be affected
3. Check test-registry.json for existing test coverage on those modules
4. List:
   - Files to be modified
   - Functions/components to be added or changed
   - Existing tests that cover this area (if any)

## Phase 2: Write Failing Tests (GATE 1)

**You MUST complete this phase before writing ANY implementation code.**

### For Backend Changes (Python/Flask)
1. Find existing test patterns in `Archetype_Backend/_tests/`
2. Create or extend test files following existing naming: `test_<module>.py`
3. Write tests that define the acceptance criteria:
   - What inputs should produce what outputs?
   - What error cases should be handled?
   - What side effects should occur (DB writes, API calls)?
4. Run the tests: `cd Archetype_Backend && uv run pytest _tests/<test_file>.py -v`
5. **VERIFY: tests FAIL for the right reason** (not import errors or syntax errors — the test must fail because the feature doesn't exist yet)

### For Frontend Changes (React/TypeScript)
1. Find existing test patterns in `archetype_frontend/src/__tests__/`
2. Create or extend test files: `<Component>.test.tsx`
3. Write tests covering:
   - Component renders with expected content
   - User interactions produce expected state changes
   - Edge cases (empty data, loading states, errors)
4. Run the tests: `cd archetype_frontend && npx vitest run src/__tests__/<test_file> --reporter=verbose`
5. **VERIFY: tests FAIL for the right reason**

### For API Endpoint Changes
1. Write integration tests that call the endpoint
2. Test both success and error cases
3. Test with valid and invalid auth
4. Run and verify failures

### Gate 1 Checklist
- [ ] At least one test written per acceptance criterion
- [ ] Tests run without syntax/import errors
- [ ] Tests FAIL because the feature is not implemented
- [ ] Test names clearly describe what they verify

**If you cannot make tests fail for the right reason, STOP and diagnose. Do not proceed.**

## Phase 3: Implement (GATE 2)

Now and ONLY now, write the minimum code to pass the tests.

1. Implement the feature / fix the bug
2. Run ONLY the new tests after each change: verify they pass
3. **Do NOT modify the tests to make them pass** — modify the implementation
4. When all new tests pass, run the FULL test suite:
   - Backend: `cd Archetype_Backend && uv run pytest _tests/ -v`
   - Frontend: `cd archetype_frontend && npx vitest run --reporter=verbose`

### Gate 2 Checklist
- [ ] All NEW tests pass
- [ ] All EXISTING tests still pass (no regressions)
- [ ] Implementation is minimal — no extra features beyond what tests require

**If existing tests break, fix the implementation, not the tests (unless the tests were wrong).**

## Phase 4: Commit (GATE 3)

1. Run the full test suite one final time
2. Commit with conventional commit format:
   - Tests: `test(<scope>): <description>`
   - Implementation: `feat(<scope>): <description>` or `fix(<scope>): <description>`
3. Push to dev branch

### Gate 3 Checklist
- [ ] Full suite passes
- [ ] Commits are separated: test commit before implementation commit
- [ ] Pushed to dev branch

## Phase 5: Update Registry

Update test-registry.json with the new test entries:
```json
{
  "suites": {
    "<new-suite-name>": {
      "file": "<path to test file>",
      "scope": "<what it covers>",
      "status": "passing",
      "tests": [
        {
          "name": "<test name>",
          "type": "unit|integration|e2e",
          "criteria": "<what it verifies>"
        }
      ]
    }
  }
}
```

## Phase 6: Report

When posting results to Telegram, ALWAYS include:
```
✅ <feature summary>

Tests:
  ✅ <test 1 name> — pass
  ✅ <test 2 name> — pass
  ✅ <test 3 name> — pass
  Full suite: X passed, 0 failed

Commits:
  test(scope): <test description>
  feat(scope): <implementation description>

Pushed to dev branch.
```

## Anti-Patterns (NEVER DO THESE)

1. **Writing implementation before tests** — This is the #1 violation. No exceptions.
2. **Writing tests that pass immediately** — Tests must fail first. If they pass, you haven't tested the new behavior.
3. **Modifying tests to match implementation** — Tests define requirements. Implementation must match tests.
4. **Skipping the full suite run** — Individual test pass is not enough. Regressions hide in other tests.
5. **Committing tests and implementation together** — Separate commits prove the test-first discipline.
6. **Saying "tests are trivial for this change"** — Every change is testable. If you can't test it, you don't understand it.
