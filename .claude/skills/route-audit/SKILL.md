---
name: route-audit
description: Use when auditing the Archetype backend + frontend for redundant endpoints, dead code, deprecation markers, cross-layer field drift, or handler placement issues. Runs from VM cron at 9am in audit mode; runs from the orchestrator on Telegram approval in fix mode. Also use when the caller's prompt says to apply approved findings TDD-style.
---

# Route Audit Routine

This skill runs on the Archetype VM via `claude -p` subprocess (not in Anthropic cloud). See `DESIGN.md` in this directory for the full design notes.

## Mode selection

The caller passes an intent in the prompt. Decide the mode:

- **caller says "audit mode" or payload is empty** → audit mode
- **caller says "fix mode" with a payload like `apply YYYY-MM-DD #N [#M ...]`** → fix mode
- **caller says "mute"** → reserved; not implemented yet, noop with a Telegram ack

Always run `git config user.email "routines@archetype.bot"` and `git config user.name "route-audit"` once at the start so commits are attributed.

## Repositories (VM layout)

The VM has a single working tree at `/home/archetype/archetype-project/` which is the `Archetype_collab_bot` repo; Backend and Frontend are git repositories nested inside as subdirectories.

- `/home/archetype/archetype-project/` — `Archetype_collab_bot` (cwd; this skill lives here, log branch lives here)
- `/home/archetype/archetype-project/Archetype_Backend/` — backend repo, tests in `_tests/`
- `/home/archetype/archetype-project/archetype_frontend/` — frontend repo (path on disk is lowercase; the GitHub remote is `MCxiaoguu/Archetype_Frontend`), tests in component dirs or `src/__tests__`

Before doing anything else, `cd /home/archetype/archetype-project` and verify all three directories exist; abort with a readable error if any are missing.

## Environment variables expected

- `TELEGRAM_BOT_TOKEN` — Telegram Bot API token
- `TELEGRAM_CHAT_ID` — chat ID for posting findings and fix results

If either is missing, abort with a readable error in the session log; do not continue.

---

## Audit mode

### 1. Hydrate the log state (via a throwaway worktree — keeps cwd's main checkout untouched)

```bash
cd /home/archetype/archetype-project     # Archetype_collab_bot
WORKTREE=/tmp/route-audit-log

git fetch origin claude/route-audit-log 2>/dev/null || true
rm -rf "$WORKTREE"
if git show-ref --verify --quiet refs/remotes/origin/claude/route-audit-log; then
  git worktree add "$WORKTREE" origin/claude/route-audit-log
  (cd "$WORKTREE" && git switch -C claude/route-audit-log --track origin/claude/route-audit-log 2>/dev/null \
                 || git switch claude/route-audit-log)
else
  git worktree add -b claude/route-audit-log "$WORKTREE"
  mkdir -p "$WORKTREE/docs/audits/runs"
  [ -f "$WORKTREE/docs/audits/state.json" ] || echo '{"findings":{},"last_run":null,"_schema":"route-audit/1"}' > "$WORKTREE/docs/audits/state.json"
  [ -f "$WORKTREE/docs/audits/INDEX.md" ]   || printf "# Route audit run log\n\nMost recent first.\n\n" > "$WORKTREE/docs/audits/INDEX.md"
fi

# All audit writes go into $WORKTREE/docs/audits/. The cwd checkout (main) is never touched.
```

### 2. Walk the checklist

Load `references/checklist.md`. Each bullet is a check. For each check, scan both cloned source repos using a combination of `grep`, AST-aware search (`rg` with type filters), and targeted `Read`s. Be thorough but bounded — no recursive exploration past the symbols the check names.

Classify each raw finding into one of the five categories used by the fingerprint:

- `redundant-endpoint` — duplicate route registration, duplicate handlers, module-missing blueprint, naming-only duplicates
- `dead-code` — unused imports, unreferenced helpers, commented-out routes, mock returns shadowing real endpoints, copy-paste error handlers, **try-except blocks that silently swallow errors or keep broken code alive** (bare `except:`, `except: pass`, fallback assignments that mask failures, try-except around imports of non-existent modules)
- `deprecation` — `# deprecated`, `# TODO: remove`, hook-to-old-endpoint, unmigrated state access
- `field-dup` — cross-layer field name drift, enum divergence, timestamp multi-writer, inconsistent user_id extraction, split validation rules
- `placement` — business logic in route handler, direct DB in handler, ad-hoc LLM client, inconsistent auth check, inline constants

### 3. Compute fingerprints and suppress

```
fp = sha1_hex(category + "|" + normalized_path + "|" + lowercase_title_key_tokens)[:16]
```

- `normalized_path` = repo-relative path with line number stripped
- `lowercase_title_key_tokens` = 3–5 significant tokens from the finding title, sorted, joined with `_`

Load `docs/audits/state.json`. For each raw finding:
- if `fp` exists and `status == "implemented"` and `last_seen >= today - 30d` → suppress (carry forward last_seen)
- if `fp` exists and `status == "skipped"` and `skip_until > today` → suppress
- else → include

### 4. Post to Telegram

Build a numbered message, one block per surviving finding:

```
🔎 Route audit 2026-04-20
Backend: Archetype_Backend@<short-sha>  Frontend: archetype_frontend@<short-sha>
Suppressed: <N> (stale/skipped); Open: <M>

#1 [redundant-endpoint] Archetype_Backend/app/routes/test.py:142
Two handlers for GET /api/tests/{id} — blueprints test_bp and legacy_bp register identical paths. The legacy one was supposed to be removed in the notte-backend-merge cleanup.
fp: 9ac3f2e10db481c7

#2 [field-dup] test_id vs testId vs id
Backend route uses test_id (snake_case); frontend hook uses testId; DB doc stores id. No single source of truth.
Spans: Archetype_Backend/app/routes/test.py, archetype_frontend/src/hooks/useTest.ts
fp: 1f8bde4497a07c33
...

Reply with: approve 2026-04-20 #1 #3   (or skip #2)
```

Send via:

```bash
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d chat_id="${TELEGRAM_CHAT_ID}" \
  -d parse_mode="Markdown" \
  --data-urlencode text@/tmp/audit-message.md
```

If the body exceeds 4000 chars, split into multiple `sendMessage` calls; if it exceeds ~20 blocks total, send a brief summary first and attach the full run MD as a document via `sendDocument`.

### 5. Persist the run

Write `docs/audits/runs/2026-04-20.md` with the full finding table (including suppressed ones, with a `suppressed: yes (reason)` column for transparency). Update `docs/audits/state.json` — for each fingerprint: bump `last_seen`; new fingerprints get `status: "open"`, `first_seen: today`. Prepend a one-line entry to `docs/audits/INDEX.md`.

Commit and push from the worktree (not the main checkout):

```bash
(cd "$WORKTREE" && \
  git add docs/audits/ && \
  git commit -m "audit: $(date +%F) (open=${M}, suppressed=${N})" && \
  git push origin claude/route-audit-log)

# Clean up the worktree so future runs start fresh
git worktree remove --force "$WORKTREE" 2>/dev/null || rm -rf "$WORKTREE"
```

No PR. Log branch only — `main` is never touched by the audit.

---

## Fix mode

### 1. Parse and load

Parse `text`: expect `apply YYYY-MM-DD #<N>[ #<M>...]`. Date = audit run identifier. Numbers = 1-based indexes from that day's Telegram post (and that day's `runs/YYYY-MM-DD.md` table).

```bash
cd /home/archetype/archetype-project
WORKTREE=/tmp/route-audit-log
git fetch origin claude/route-audit-log
rm -rf "$WORKTREE"
git worktree add "$WORKTREE" origin/claude/route-audit-log
(cd "$WORKTREE" && git switch -C claude/route-audit-log --track origin/claude/route-audit-log)
```

Load `$WORKTREE/docs/audits/runs/YYYY-MM-DD.md`. Map each approved number to a finding row (category, fingerprint, path, title, detail, spans).

### 2. TDD per-finding

For each approved finding (in order), do exactly this. If any step fails, record the outcome, skip to the next finding, do not abort the whole run.

1. **Locate** — `cd` into the affected repo (Backend or Frontend) at its default branch. Read the flagged file(s).
2. **Search existing tests** — grep the symbol or endpoint path in `_tests/` (backend) or `src/**/__tests__` + `*.test.{ts,tsx}` (frontend). Note any hits.
3. **Adopt or write**:
   - If a test already covers this path and exercises the behavior that the fix might change → adopt it. Record the test name.
   - Otherwise → write a minimal **characterization test** that asserts current observable behavior (input → output or request → response), not the desired future behavior. Place it in the same directory as the feature's existing tests, named to match the project's convention.
4. **Pre-change green check** — run just that one test (pytest `-k`, vitest filter, etc.). Must pass. If red, the characterization test is wrong; revise until it captures existing behavior, then continue. If you can't pin the behavior in three tries, abort this finding and report.
5. **Apply the change** — implement the fix narrowly. Do not bundle unrelated cleanup.
6. **Post-change green check** — re-run that same test. Must still pass. This is the idempotency gate. If red, revert the change and report.
7. **Full layer suite** — run the layer's test command (`uv run python -m pytest _tests/ -v` backend; the frontend's `npm test -- --run` or `vitest run`). Must pass. If red, the PR will be marked draft with a regression warning, but we still commit.
8. **Commit** in the affected repo on branch `claude/route-audit-fixes/YYYY-MM-DD`:
   ```
   fix(audit): #<N> <finding title>

   Characterization test: <new-test-name | adopted:OldTestName>
   Fingerprint: <fp>
   Run: Archetype_collab_bot@claude/route-audit-log:docs/audits/runs/YYYY-MM-DD.md
   ```
9. Return outcome dict: `{fp, status: "implemented"|"skipped"|"failed", test_name, reason?}`.

### 3. Open PRs

For each affected repo (Backend at `./Archetype_Backend`, Frontend at `./archetype_frontend`) that received at least one successful fix commit:

```bash
cd /home/archetype/archetype-project/<repo-subdir>
git push -u origin claude/route-audit-fixes/YYYY-MM-DD
gh pr create --base dev --head claude/route-audit-fixes/YYYY-MM-DD \
  --title "audit fixes YYYY-MM-DD (<repo-short>)" \
  --body "$(cat <<EOF
Applies approved findings from audit run YYYY-MM-DD. Log branch: \`claude/route-audit-log\` in Archetype_collab_bot.

| # | Category | Title | Test | Result |
|---|----------|-------|------|--------|
<rows>

If any row shows "⚠️ suite regression" the PR is a **draft**; do not merge until the regression is investigated.
EOF
)"
```

If the layer's full suite failed on any fix, pass `--draft` to `gh pr create`.

### 4. Update state + notify

In the log worktree at `/tmp/route-audit-log`:
- For each outcome, update `docs/audits/state.json` — `status` → `implemented` / `failed`, add `pr_url`, append to `history`.
- Commit: `audit: apply YYYY-MM-DD (#<N> #<M> ...) — <K> PRs opened`.
- Push. Then `git worktree remove --force /tmp/route-audit-log` to clean up.

Telegram:

```
✅ Applied audit fixes for 2026-04-20
• #1 redundant-endpoint → PR <url>   (adopted: test_test_routes::test_get_by_id)
• #3 field-dup           → PRs <backend-url>, <frontend-url>   (new test: test_field_normalization)
• #5 dead-code           → SKIPPED (pre-change test red: could not pin behavior)
```

---

## Rules (inherited from project CLAUDE.md)

- Never mock DB in tests. Real services only.
- No chained `or` fallback ladders; no redundant `or {}` after `.get("key", {})`; no nested `.get().get()` without extracting intermediate.
- Commits use intent prefix (`fix:`, `feat:`, `chore:`). Never pass `--no-verify`.
- Never force-push. Never push to `main` or `dev` directly; always via PR.

## Guardrails

- If `state.json` is malformed, back it up to `state.json.bak-<epoch>` and reinitialize. Emit Telegram warning.
- If a fix touches more than 40 lines outside the flagged file, abort that finding — the scope is probably wrong, flag for human.
- If a finding's category is `field-dup` or `placement` and the fix requires coordinated changes in both repos, commit both before opening PRs. If one side's tests fail, revert both commits for that finding.
- Cap at 10 findings per audit post. If more, post the top 10 by category severity (field-dup > deprecation > redundant-endpoint > placement > dead-code) and attach the full MD as a document.
