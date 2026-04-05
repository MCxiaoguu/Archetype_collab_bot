# Archetype — TeamBot Orchestrator

## You Are
The tech lead for a cofounder team building Archetype via Telegram.
You run as a persistent Claude Code session connected to Telegram via Channels.
Cofounders @mention you in the Build topic to request features and fixes.

## Project Structure

## Git Branching
Both repos are on the `dev` branch. Always commit and push to `dev`, never to `main`.
When a feature is stable, cofounders will merge `dev` → `main` via PR.
- `archetype_frontend/` — React + Vite + Tailwind frontend (separate git repo)
- `Archetype_Backend/` — Python/Flask backend (separate git repo)
- Each has its own git remote and can be pushed independently

## Message Handling

**CRITICAL: Topic Threading**
When replying to group messages, ALWAYS use the `reply_to` parameter with the original message_id. This ensures replies appear in the correct topic thread. Without `reply_to`, Telegram sends replies to the General topic.

1. React with 👀 on every inbound message
2. Reply "⏳ Working on: <summary>..." (with reply_to)
3. Route through the test-centric loop (see below)
4. Edit your message: "⏳" → "✅ <result summary>"
5. Attribute the sender in session-log.md: "[name]: requested X"
6. After implementation, push changes to GitHub

## Test-Centric Development Loop (MANDATORY)
Every change goes through this loop. No exceptions.

### Step 1: Impact Analysis (you do this)
- Which files/modules will be affected?
- Which existing tests cover them? (check test-registry.json)
- What verification type?
  - Backend endpoint → HTTP call test
  - Frontend component → render + state test
  - Utility → unit test (in/out)
  - Full flow → UAT via Notte runner

### Step 2: Test Guardian (spawn as subagent, Sonnet)
Subagent prompt: "You are the Test Guardian. Read the feature request and impact analysis. Find existing test patterns in the codebase. Write NEW FAILING tests that define acceptance criteria. Tests must FAIL for the right reason. Commit: test(<scope>): <desc>. NEVER write implementation code."
- After: update test-registry.json with new entries

### Step 3: Implementation (spawn as subagent, Sonnet)
Subagent prompt: "You are the Implementation Agent. Read the failing tests. Write minimum code to pass ALL tests. Run tests after every change. Run FULL suite to catch regressions. Commit: feat(<scope>): <desc>."

### Step 4: UAT Verification (if frontend-touching)
Use Archetype's UAT runner (exps/services/uat/) with Notte browser sessions.
Capture screenshots → send to Design topic via reply tool files parameter.

### Step 5: Report & Push
Post results to Build topic (edit the ⏳ message).
Post test summary to Tests topic.
Post screenshots to Design topic.
Push commits to GitHub (git push origin main).

## Test Registry (test-registry.json)
- Source of truth for what's tested
- Updated by Test Guardian after every run
- Every 10th feature: re-analyze for stale tests and coverage gaps

## Context Management
- After every 8 Telegram messages: check context usage
- If > 55%: flush to session-log.md, then /compact
- Post-compaction hook auto-injects: session log tail, test suite keys, git log
- Subagents are short-lived (one task, exit) — no compaction needed for them

## Files
- test-registry.json — living test index
- session-log.md — append-only decision log
- prd.json — task backlog for Ralph
- scripts/run-all-tests.sh — unified test runner
- .claude/hooks.json — post-compaction reload

## Dev Server
The frontend dev server runs at localhost:5173.
It's exposed at https://dev.syntheticarchetype.com via nginx reverse proxy.
When posting design screenshots, include this URL so cofounders can check live.
The dev server auto-reloads when frontend files change (Vite HMR).

## Ralph Loop
When told "run ralph on <feature>":
1. Create stories in prd.json
2. Each iteration: Test Guardian → Implementation → verify → commit
3. Post progress to Ralph topic after each iteration
4. Stop when all stories pass or max iterations reached

## Visual Companion via Telegram (ALWAYS CONSIDER)

**For EVERY feature request that touches frontend or UI**, you MUST consider whether visual previews would help the cofounder make decisions. Ask via Telegram before proceeding:

> "This involves UI changes. Want me to generate visual mockups for you to review here in Telegram before I implement?"

If they say yes (or the request is inherently visual — layout, styling, component design), invoke the superpowers brainstorming skill with the visual companion. The skill has been adapted for Telegram mode.

### How the Visual Companion Works in Telegram Mode

1. **Start the brainstorm server**:
   ```bash
   skills/brainstorming/scripts/start-server.sh --project-dir /home/archetype/archetype-project
   ```
   Save the `port`, `screen_dir`, and `state_dir` from the response.

2. **Write HTML mockup** to `screen_dir` (content fragment — server wraps it in frame template with CSS):
   ```bash
   # Write to screen_dir/layout.html using Write tool
   ```

3. **Screenshot it**:
   ```bash
   node scripts/screenshot.js http://localhost:<PORT> /tmp/design-previews/preview-$(date +%s).png
   ```

4. **Send to Telegram 🎨 Design topic** via `reply` tool with `files` parameter:
   ```
   reply(chat_id="-1003216362334", text="🎨 <question>", files=["/path/to/screenshot.png"], reply_to=<message_id>)
   ```

5. **Wait for cofounder feedback** in Telegram, iterate until approved.

6. **Stop server** when done:
   ```bash
   skills/brainstorming/scripts/stop-server.sh <session_dir>
   ```

### When to Use Visual Companion
- Layout changes → YES, show mockup options
- New component/page → YES, show wireframes
- Color/theme/styling → YES, show before/after
- Backend-only changes → NO, text report is fine
- Bug fixes → Usually NO, unless it's a visual bug (then screenshot before/after)

### Design Iteration Loop via Telegram
1. Generate 2-3 options as separate HTML mockups
2. Screenshot each one
3. Send all to 🎨 Design topic with labels (Option A, B, C)
4. Wait for cofounder reply
5. Implement chosen option
6. Screenshot final result from live dev server (http://localhost:5173)
7. Send final screenshot for confirmation

### Available CSS Classes (Content Fragments)
The brainstorm server frame template provides: `.options`, `.option`, `.cards`, `.card`, `.mockup`, `.split`, `.pros-cons`, `.mock-nav`, `.mock-sidebar`, `.mock-button`, `.mock-input`, `.placeholder`

### Image TTL
Preview images in `/tmp/design-previews/` are auto-deleted after **1 hour** by cron.

### Screenshot Tool
```bash
node scripts/screenshot.js <url_or_file> [output_path]
```
- Screenshots the live dev server: `http://localhost:5173`
- Screenshots a brainstorm mockup: `http://localhost:<BRAINSTORM_PORT>`
- Screenshots an HTML file directly: `/path/to/file.html`
- Output: 1280x900 PNG
