# Route Audit Checklist

This is the canonical checklist the audit walks each morning. Each bullet maps to one or more raw findings. Author: project owner, preserved verbatim except for category tagging in brackets.

## Redundant Endpoints  `[redundant-endpoint]`
- Same HTTP method + URL pattern registered more than once across blueprints
- Two handlers calling identical service functions
- Blueprints registered in `app.py` whose module no longer exists or exports nothing
- Endpoints that differ only in URL naming convention (e.g. `/test_id` vs `/testId`) but resolve to the same resource

## Redundant Code  `[dead-code]`
- Imports never referenced in any handler in that file
- Helper/validation functions defined but never called
- Commented-out route definitions left in place
- Mock data returns inside hooks where a real endpoint now exists
- Duplicate middleware application across handlers that should be centralized
- Error handling logic copy-pasted across multiple handlers instead of shared
- `try-except` blocks wrapping imports of non-existent modules (used to keep broken code alive)
- `try-except` blocks that catch and silently swallow exceptions (`except: pass`, `except Exception: pass`, or `except Exception: variable = None`)
- `try-except` blocks where the except branch sets a fallback that hides a real failure (e.g., `except: data = {}` masking a broken service call)
- `try-except` around code that should never fail — if the guarded code is correct, the try-except is dead weight; if it does fail, the silent catch hides the bug
- Bare `except:` without specifying an exception type

## Deprecation Markers  `[deprecation]`
- `# deprecated`, `# TODO: remove`, or explicit deprecation comments in module docstrings
- Modules marked as the old path but still imported somewhere
- Frontend hooks still calling old endpoints that have since been replaced
- State access patterns that were supposed to be migrated but weren't

## Field / Semantic Duplication (Cross-Placement)  `[field-dup]`
- Same concept represented by different field names across layers — e.g. `test_id` in backend, `testId` in frontend hook, `id` in the DB document — referring to the same entity but never normalized
- Status enums defined independently in multiple places with overlapping but non-identical values (e.g. backend has `"blocked"` that gets mapped to `"fail"` before the frontend ever sees it — but if that mapping ever drifts, both sides silently disagree)
- Credential or auth fields stored/passed in multiple shapes across request body, headers, and DB documents
- Progress or metadata fields that exist on both the task payload and the DB document but are written independently, creating potential divergence
- Validation logic for the same field duplicated in both route layer and service layer with different rules
- Timestamp fields (`created_at`, `updated_at`) generated in multiple places rather than a single authoritative writer
- User identity (`user_id`) extracted from request in inconsistent ways across different route files

## Structural / Placement Issues  `[placement]`
- Business logic living inside route handlers instead of the service layer
- DB queries written directly in route handlers bypassing the service layer
- LLM client instantiated ad-hoc inside handlers instead of shared/lazy-init pattern
- Auth checks inconsistently applied — some routes use decorator, others do manual inline checks
- Constants (limits, valid value sets) hardcoded inline in handlers rather than defined once and referenced
