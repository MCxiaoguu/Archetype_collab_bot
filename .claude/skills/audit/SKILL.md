---
name: audit
description: >
  Deep vertical audit of a single API endpoint or code path. Trace the full call tree from
  route handler through services, helpers, utilities, and DB/external calls. Find bugs, dead code,
  redundancy, non-canonical assignments, and logic issues. Use when: user says "audit",
  "review endpoint", "trace /api/something", or Telegram /audit command. Enforces canonical
  variable assignment — if the exact source of a value is known, never hide it behind fallback
  chains or ambiguous defaults.
---

# Endpoint Audit — Deep Vertical Code Review

Systematically trace a single endpoint (or code path described in natural language) through the
entire codebase, building a complete dependency tree and auditing every node for bugs, redundancy,
non-canonical patterns, and dead code.

## Input Handling

The user may describe the endpoint in natural language. Translate to a concrete route:
- "the user profile endpoint" → `GET /api/users/me`
- "persona generation" → `POST /api/persona/generate`
- "test creation flow" → `POST /api/uat/tests`

If ambiguous, list matching routes and ask the user to pick.

## Workflow

### Phase 1: Identify the Root

1. Find the route registration for the target endpoint (URL path + HTTP method)
2. Record: file, line number, handler function name, decorators/middleware
3. If ambiguous (multiple matches), present options and ask user to pick

### Phase 2: Build the Call Tree

Use breadth-first traversal. Maintain two lists:

- **Queue**: functions/methods to visit next
- **Visited**: functions already analyzed (prevent cycles)

For each node in the queue:

1. Read the function body
2. Extract all callees: function calls, method calls, class instantiations
3. For each callee:
   - **Internal** (defined in this codebase) → add to queue if not visited
   - **External** (stdlib, third-party) → note it, don't traverse
   - **Dynamic** (string-based dispatch, getattr) → flag for manual review
4. Record the edge: caller → callee with file:line

Continue until queue is empty. Use parallel Agent calls for independent branches.

### Phase 3: Audit Each Node

For every visited function, check for:

#### Bugs
- Unhandled None/empty returns from callees
- Type mismatches between caller expectations and callee return values
- Missing error handling on external calls (DB, HTTP, file I/O)
- Race conditions in shared mutable state

#### Canonical Assignment Violations (CRITICAL)
This is the core quality gate for auto-generated code.

**Rule: If the exact variable or value source is known, ALWAYS use it directly. Never wrap it in a fallback chain, OR expression, or dict merge with defaults.**

Bad (non-canonical):
```python
user_id = request.args.get('user_id') or body.get('userId') or 'default'
config = {**defaults, **(overrides or {})}
name = data.get('name', None) or fallback_name or 'Unknown'
```

Good (canonical):
```python
user_id = request.user_id  # Auth middleware guarantees this exists
config = load_config(env)   # Single source of truth
name = user.display_name    # Fetched from DB, known to exist at this point
```

**Detection patterns:**
- `x or y or z` chains where `x` is guaranteed to exist by upstream code
- `{**a, **(b or {})}` dict merges where `b`'s type is known
- `.get(key, default)` where the key is guaranteed present by schema/validation
- Multiple fallback sources for a value that has a single canonical source
- Re-assignment of a variable already set with a definitive value

#### Redundancy
- Multiple functions doing the same thing
- Repeated inline code that should use an existing helper
- Re-fetching data already available from caller's scope
- Import of utility that reimplements something already available

#### Dead Code
- Parameters passed but never used by callee
- Return values never consumed by any caller
- Conditional branches that can never be true given call chain context
- Defensive checks for states the upstream code guarantees won't happen

#### Logic Issues
- Boolean conditions that are always true/false in context
- Fallback chains (`x or y or z`) that mask real errors
- Silent exception swallowing
- Data transformations that lose information unnecessarily

### Phase 4: Report

Post findings to Telegram (if invoked via /audit) or to terminal. Organized by severity:

```
## Endpoint Audit: [METHOD] [PATH]

### Call Tree
[Indented list showing full traversal with file:line at each node]

### Canonical Assignment Violations
- [file:line] `var = x or y or z` — x is guaranteed by [upstream]. Use `var = x` directly.

### Critical (bugs, data loss, security)
- [file:line] Description of issue

### Redundancy (duplicate logic, unnecessary code)
- [file:line] Description + what it duplicates

### Dead Code (unreachable, unused)
- [file:line] Description + evidence it's dead

### Suggestions (simplification, clarity)
- [file:line] Description of improvement

### Notes
- [Any dynamic dispatch or ambiguous paths flagged for manual review]
```

## Rules

- **Exhaust the tree.** Do not stop early. If a function calls 5 helpers, trace all 5.
- **Stay vertical.** Only follow calls reachable from this endpoint. Don't audit unrelated code.
- **Show evidence.** Every finding must include file:line and explanation.
- **No false positives.** If uncertain, say so explicitly rather than asserting.
- **Parallelize wide branches.** Use parallel Agent/Grep calls when the tree fans out.
- **Respect cycles.** If A calls B calls A, note the cycle and stop.
- **Canonical assignment is king.** This is the #1 quality signal. Every `or` chain and fallback merge is suspicious until proven necessary.
- **Context matters.** A fallback is only valid when the upstream truly cannot guarantee the value (e.g., user input, external API response). If the value comes from our own code with a known contract, the fallback is non-canonical.
