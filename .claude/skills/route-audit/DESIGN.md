# route-audit — design notes

Decisions captured so we don't forget. Not a full spec. Date: 2026-04-20.

## What this is
A scheduled Claude Code **routine** (cloud-hosted, Anthropic-managed) that audits the Archetype backend + frontend each morning for redundant endpoints, dead code, deprecation markers, cross-layer field drift, and placement issues. Findings post to Telegram. User approves via Telegram reply. Approved findings are fixed TDD-style by an API-triggered run of the same routine, which opens per-repo PRs targeting `dev`.

## Scope
- Repos audited: `Archetype_Backend` + `Archetype_Frontend` (cross-layer checks)
- Repo hosting the skill + logs: `Archetype_collab_bot` (this repo; remote `git@github-collab:MCxiaoguu/Archetype_collab_bot.git`)
- Checklist: see `references/checklist.md`

## Scheduling
Replaces an earlier plan to use VM cron. Uses Claude Code's built-in **routines** feature (`/schedule` in any CLI session or claude.ai/code/routines web UI).
- Schedule trigger: daily 9am local, one routine run per day
- API trigger: same routine, re-fired by the VM orchestrator with `text="apply YYYY-MM-DD #N ..."` to execute approved fixes
- Minimum interval per Anthropic docs: 1 hour (daily is fine)

## Run modes (one routine, two modes)
The routine's prompt branches on the `text` payload from `/fire`:
- **empty** → audit mode
- starts with `apply ` → fix mode

## Audit mode
1. Shallow-clone Backend + Frontend (routine does this automatically)
2. `git fetch origin claude/route-audit-log` on this repo, read state via `git show claude/route-audit-log:docs/audits/state.json`
3. Walk the checklist across both cloned repos
4. For each raw finding, compute fingerprint = sha1(category + normalized_path + title_tokens)
5. Suppress per rules (implemented<30d, skip_until>today)
6. Post numbered surviving findings to Telegram (curl `api.telegram.org` with bot token env var)
7. Commit the updated `state.json` + new `runs/YYYY-MM-DD.md` to branch `claude/route-audit-log` in this repo (no PR, no main touch)

## Fix mode
Payload format: `apply YYYY-MM-DD #3 #5 #7` (date = which audit run's findings, numbers = approved indexes)
1. Fetch `claude/route-audit-log`, read `runs/YYYY-MM-DD.md` → load the finding bodies for the approved numbers
2. For each approved finding, execute the TDD flow (see SKILL.md § "TDD per-finding")
3. Commit per-finding to `claude/route-audit-fixes/YYYY-MM-DD` in whichever repo(s) the change touches
4. Push that branch, `gh pr create --base dev` in each affected repo (PRs target `dev`, not `main`)
5. Append fix outcomes back into `state.json` on `claude/route-audit-log` (status→`implemented` with PR URL) and post PR links to Telegram

## Branching rules
- Routines push `claude/*`-prefixed branches only (Anthropic default). No need to enable unrestricted branch pushes on any repo.
- Backend + Frontend fix PRs target `dev`.
- The audit log lives on a long-lived `claude/route-audit-log` branch in Archetype_collab_bot. Main is never touched by the routine.

## TDD per-finding (idempotency requirement)
Each approved fix runs exactly this sequence. See SKILL.md for the expanded version.
1. Locate flagged file/line.
2. Grep existing test dirs for coverage of the affected symbol/path.
3. If found → adopt it. Else → write a minimal **characterization test** asserting current observable behavior.
4. Run that test on pre-change code — must be green (else abort, report).
5. Apply the change.
6. Re-run that test — must still be green (this is the idempotency check).
7. Run the layer's full test suite — must pass, else PR marked draft with regression warning.
8. Commit with message `fix(audit): #<N> <title> [<new-test|adopted:TEST_NAME>]`.
9. After all findings in a layer complete, push + open PR.

## Telegram
- Existing bot on the VM (`/home/archetype/.claude/channels/telegram/.env`). Token is reused.
- New env vars on the routine's cloud environment: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- Chat ID: the same chat the existing orchestrator uses. TBD — confirm when creating the routine.
- Approval routing: the existing VM orchestrator (`tmux orchestrator`) sees user replies like `approve 2026-04-20 #3 #5` and POSTs to the routine's `/fire` endpoint with a Bearer token stored in `~/.claude/channels/telegram/.env` as `ROUTE_AUDIT_FIRE_TOKEN` + `ROUTE_AUDIT_FIRE_URL`.
- The orchestrator's behavior is extended via a short paragraph in `~/archetype-project/CLAUDE.md` (not a new script).

## Log schema (in-repo)
Path root: `Archetype_collab_bot/docs/audits/` (on `claude/route-audit-log` branch only).
- `state.json` — fingerprint DB (see SKILL.md for shape)
- `runs/YYYY-MM-DD.md` — per-day findings table
- `INDEX.md` — one-line-per-run append log

## What we explicitly do NOT do
- No VM cron. Scheduling is Anthropic-cloud.
- No commits to any repo's `main`.
- No draft PR from audit-mode runs. Audit posts to Telegram only; logs live on `claude/route-audit-log`.
- No mocks in tests. Characterization tests hit real services per project `CLAUDE.md` rule.
- No skipped hooks, no `--no-verify`.

## Setup order
1. `claude update` on the VM (for `/schedule` availability)
2. Commit this skill + seed logs to `Archetype_collab_bot` main
3. User creates the routine on claude.ai/code/routines (paste values this file provides)
4. User pastes the `/fire` URL + token back; those land in `~/.claude/channels/telegram/.env` on the VM
5. CLAUDE.md in `~/archetype-project/` gets a paragraph describing approval routing
6. `/schedule run` once to dry-run the audit end-to-end

## Open/deferred
- Exact wording of the approval-detection prompt in the orchestrator's CLAUDE.md
- Whether the routine should include a manual mute command (e.g., `text="mute <fingerprint> until <date>"`) — deferred until we see noise rates in practice
