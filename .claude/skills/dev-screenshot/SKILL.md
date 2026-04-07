---
name: dev-screenshot
description: >
  Capture authenticated screenshots from the live dev workspace at dev.syntheticarchetype.com.
  Logs in via Auth0 with demo credentials, navigates to any workspace page, and takes real
  screenshots. Use when a cofounder asks to see the live app, verify UI changes, or capture
  workspace state. Invoke with /screenshot or "take a screenshot of...".
---

# Dev Screenshot — Authenticated Workspace Screenshots

Captures real screenshots from the live dev server by logging in via Puppeteer with Auth0
credentials. Unlike simple URL screenshots, this skill handles authentication, onboarding
dismissal, and workspace navigation.

## When to Use

- Cofounder asks "show me what X looks like" or "screenshot the workspace"
- After a UI change, to capture the live result for Design topic
- When verifying a completed UAT test's results display in the workspace
- Any time you need an authenticated view of the app (not just the landing page)

## How It Works

Run the Puppeteer script from the project root. It handles:
1. Auth0 login with demo credentials
2. Dismissing onboarding tour (`localStorage.setItem('onboarding-complete', '1')`)
3. Extracting the auth token for API calls if needed
4. Navigating to the target page
5. Screenshotting with configurable viewport

## Credentials

- **Email**: `demo@syntheticarchetype.com`
- **Password**: `DEMO-archetype`
- **Dev URL**: `https://dev.syntheticarchetype.com`

## Script Template

Use this Puppeteer pattern. Adapt the navigation section for the target page.

```javascript
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function main() {
  const outputDir = '/tmp/design-previews';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // --- AUTH BLOCK (copy as-is) ---
  await page.goto('https://dev.syntheticarchetype.com', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));

  // Click Login
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('a, button')];
    const login = btns.find(b => /log\s*in|sign\s*in/i.test(b.textContent));
    if (login) login.click();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

  // Fill Auth0 form
  const emailInput = await page.$('input[name="username"]') || await page.$('input[name="email"]') || await page.$('input[type="email"]');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 });
    await emailInput.type('demo@syntheticarchetype.com', { delay: 30 });
  }
  const pwInput = await page.$('input[name="password"]') || await page.$('input[type="password"]');
  if (pwInput) {
    await pwInput.click({ clickCount: 3 });
    await pwInput.type('DEMO-archetype', { delay: 30 });
  }

  // Submit
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button[type="submit"], button')];
    const submit = btns.find(b => /continue|log\s*in|submit/i.test(b.textContent));
    if (submit) submit.click();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));

  // Dismiss welcome modal
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const btn = btns.find(b => /continue|go to workspace|dashboard/i.test(b.textContent));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  // --- END AUTH BLOCK ---

  // --- NAVIGATION (adapt per target) ---
  // Examples:
  //   Dashboard:     no navigation needed, already there after login
  //   Test Hub:      await page.goto('https://dev.syntheticarchetype.com/workspace/tests', ...)
  //   Feature Hub:   await page.goto('https://dev.syntheticarchetype.com/workspace/features', ...)
  //   Persona Hub:   await page.goto('https://dev.syntheticarchetype.com/workspace/personas', ...)
  //   Specific test: await page.goto('https://dev.syntheticarchetype.com/workspace/tests?expand=<testId>', ...)
  //
  // After navigation, always:
  //   await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
  //   await new Promise(r => setTimeout(r, 3000));

  // --- SCREENSHOTS ---
  const timestamp = Date.now();
  await page.screenshot({ path: path.join(outputDir, `dev-screenshot-${timestamp}.png`) });
  console.log(`Screenshot saved: dev-screenshot-${timestamp}.png`);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
```

## Getting the Auth Token (for API calls)

If you need to make authenticated API calls from within the page context (e.g., creating
tests, fetching data), extract the token after login:

```javascript
const token = await page.evaluate(() => {
  for (const key of Object.keys(localStorage)) {
    if (key.includes('auth0') || key.includes('@@')) {
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (val?.body?.access_token) return val.body.access_token;
      } catch {}
    }
  }
  return null;
});

// Use in API calls:
const data = await page.evaluate(async (tok) => {
  const resp = await fetch('/api/uat/tests', {
    headers: { 'Authorization': `Bearer ${tok}` }
  });
  return await resp.json();
}, token);
```

## Common Patterns

### Screenshot a specific workspace page
```javascript
await page.goto('https://dev.syntheticarchetype.com/workspace/tests', {
  waitUntil: 'networkidle2', timeout: 20000
});
await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
await new Promise(r => setTimeout(r, 3000));
await page.screenshot({ path: '/tmp/design-previews/test-hub.png' });
```

### Expand a specific test in the Test Hub
```javascript
const testId = '<test-id-here>';
await page.goto(`https://dev.syntheticarchetype.com/workspace/tests?expand=${testId}`, {
  waitUntil: 'networkidle2', timeout: 20000
});
await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
await new Promise(r => setTimeout(r, 4000));
// Scroll to the expanded section
await page.evaluate((tid) => {
  const el = document.getElementById(`section-${tid}`);
  if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
}, testId);
```

### Switch between test case tabs (UAT-001, UAT-002, etc.)
```javascript
await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, td')];
  for (const el of els) {
    if (el.textContent.trim() === 'UAT-002') { el.click(); return; }
  }
});
await new Promise(r => setTimeout(r, 1500));
```

### Scroll to a specific element
```javascript
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input[type="text"]')];
  const target = inputs.find(i => /keyword/i.test(i.value));
  if (target) target.scrollIntoView({ behavior: 'instant', block: 'center' });
});
```

## Important Notes

- **Always set `onboarding-complete`** in localStorage after every navigation, or the onboarding tour overlay blocks the page content.
- **Wait 3-5 seconds** after navigation for React data to load (API calls, state hydration).
- **Viewport**: Use `1440x900` for standard screenshots, `1440x1200` for taller views.
- **Output directory**: `/tmp/design-previews/` — files auto-delete after 1 hour via cron.
- **Send to Telegram**: Use the reply tool with `files` parameter to send screenshots to the Design topic (`chat_id: -1003216362334`).
- **Puppeteer is installed** in the project root `node_modules` — run scripts with `node <script>.js` from `/home/archetype/archetype-project/`.
