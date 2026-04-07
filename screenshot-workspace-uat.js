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
  await page.setViewport({ width: 1280, height: 1000 });

  // 1. Login
  console.log('1. Navigating to app...');
  await page.goto('https://dev.syntheticarchetype.com', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));

  console.log('2. Clicking Login...');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('a, button')];
    const login = btns.find(b => /log\s*in|sign\s*in/i.test(b.textContent));
    if (login) login.click();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

  console.log('3. Filling credentials...');
  await page.waitForSelector('input[name="username"], input[name="email"], input[type="email"]', { timeout: 10000 }).catch(() => {});

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

  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button[type="submit"], button')];
    const submit = btns.find(b => /continue|log\s*in|submit/i.test(b.textContent));
    if (submit) submit.click();
  });

  console.log('4. Waiting for auth redirect...');
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

  // 2. Get auth token from page context
  console.log('5. Getting auth token...');
  const token = await page.evaluate(() => {
    // Auth0 stores tokens in localStorage
    for (const key of Object.keys(localStorage)) {
      if (key.includes('auth0') || key.includes('@@')) {
        try {
          const val = JSON.parse(localStorage.getItem(key));
          if (val && val.body && val.body.access_token) {
            return val.body.access_token;
          }
        } catch {}
      }
    }
    return null;
  });

  if (!token) {
    console.error('Could not get auth token!');
    // Screenshot current state for debugging
    await page.screenshot({ path: path.join(outputDir, 'debug-no-token.png') });
    await browser.close();
    return;
  }
  console.log('   Token obtained:', token.substring(0, 20) + '...');

  // 3. Create a UAT test via authenticated API
  console.log('6. Creating UAT test via API...');
  const createResp = await page.evaluate(async (tok) => {
    const resp = await fetch('https://dev.syntheticarchetype.com/api/uat/tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tok}`
      },
      body: JSON.stringify({
        prototypeUrl: 'https://dev.syntheticarchetype.com',
        featureName: 'E2E Error Display Verification',
        credentials: { email: 'demo@syntheticarchetype.com', password: 'DEMO-archetype' },
        testCases: [
          {
            id: 'UAT-001',
            title: 'Login Flow',
            functionalArea: 'Authentication',
            priority: 'high',
            steps: [
              "Click the 'Login' button",
              "Enter 'demo@syntheticarchetype.com' in the email field",
              "Enter 'DEMO-archetype' in the password field",
              "Click the 'Continue' button"
            ],
            expectedResult: 'User is logged in and redirected to dashboard.',
            status: 'not-started',
          },
          {
            id: 'UAT-002',
            title: 'Scroll and Navigation Test',
            functionalArea: 'Dashboard Navigation',
            priority: 'medium',
            steps: [
              "Verify the user is on the dashboard page",
              "Scroll down the page to view more content",
              "Click on a non-existent 'Analytics' sidebar item"
            ],
            expectedResult: 'Scroll should work. Analytics item should fail.',
            status: 'not-started',
          }
        ]
      })
    });
    return await resp.json();
  }, token);

  const testId = createResp.test_id || createResp.testId;
  if (!testId) {
    console.error('Failed to create test:', JSON.stringify(createResp));
    await browser.close();
    return;
  }
  console.log('   Test created:', testId);

  // 4. Run the test via API
  console.log('7. Running UAT test...');
  const runResp = await page.evaluate(async (tok, tid) => {
    const resp = await fetch(`https://dev.syntheticarchetype.com/api/uat/tests/${tid}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tok}`
      },
      body: JSON.stringify({
        credentials: { email: 'demo@syntheticarchetype.com', password: 'DEMO-archetype' }
      })
    });
    return await resp.json();
  }, token, testId);
  console.log('   Run started:', runResp.status || runResp.message);

  // 5. Poll for completion
  console.log('8. Waiting for completion...');
  let completed = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusResp = await page.evaluate(async (tok, tid) => {
      const resp = await fetch(`https://dev.syntheticarchetype.com/api/uat/tests/${tid}/status`, {
        headers: { 'Authorization': `Bearer ${tok}` }
      });
      return await resp.json();
    }, token, testId);

    const status = statusResp.status;
    const progress = statusResp.progress || 0;
    console.log(`   Status: ${status} (${progress}%)`);

    if (status === 'completed' || status === 'failed') {
      completed = true;
      break;
    }
  }

  if (!completed) {
    console.error('Test did not complete in time');
    await browser.close();
    return;
  }

  // 6. Navigate to workspace Test Hub and find this test
  console.log('9. Navigating to Test Hub...');
  await page.goto('https://dev.syntheticarchetype.com/workspace/tests', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
  await new Promise(r => setTimeout(r, 3000));

  await page.screenshot({ path: path.join(outputDir, 'ws-test-hub.png') });
  console.log('   Screenshot: ws-test-hub.png');

  // 7. Click on the newly created test to expand it
  console.log('10. Expanding test...');
  const expandResult = await page.evaluate(() => {
    // Find test items by looking for the test title or "E2E Error Display"
    const allText = [...document.querySelectorAll('*')];
    for (const el of allText) {
      if (el.children.length === 0 && /e2e error display|error display verification/i.test(el.textContent)) {
        // Click the parent row/section
        let target = el;
        for (let i = 0; i < 5; i++) {
          target = target.parentElement;
          if (target && (target.classList.contains('cursor-pointer') || target.getAttribute('role') === 'button' || target.tagName === 'SECTION')) {
            target.click();
            return `Clicked parent of: ${el.textContent.substring(0, 50)}`;
          }
        }
        // Just click the element itself
        el.click();
        return `Clicked text: ${el.textContent.substring(0, 50)}`;
      }
    }
    // Fallback: click on the first/newest test item
    const sections = document.querySelectorAll('[data-section]');
    if (sections.length > 0) {
      const last = sections[sections.length - 1];
      last.click();
      return `Clicked last section: ${last.textContent?.substring(0, 50)}`;
    }
    return 'No test found';
  });
  console.log('   Expand result:', expandResult);
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(outputDir, 'ws-test-expanded.png') });
  console.log('   Screenshot: ws-test-expanded.png');

  // 8. Navigate to Test Hub with expand parameter to open the specific test
  console.log('11. Navigating to Test Hub with expand param...');
  await page.goto(`https://dev.syntheticarchetype.com/workspace/tests?expand=${testId}`, { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
  await new Promise(r => setTimeout(r, 5000));

  // Scroll to the expanded test section
  await page.evaluate((tid) => {
    const el = document.getElementById(`section-${tid}`);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, testId);
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({ path: path.join(outputDir, 'ws-test-expanded-view.png') });
  console.log('   Screenshot: ws-test-expanded-view.png');

  // 9. Scroll down to see test cases with step icons
  await page.evaluate(() => window.scrollBy(0, 500));
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outputDir, 'ws-test-cases.png') });
  console.log('   Screenshot: ws-test-cases.png');

  // 10. Look for step log icons in the DOM
  const stepLogInfo = await page.evaluate(() => {
    // Check for CheckCircle2, XCircle, MinusCircle icons
    const svgs = document.querySelectorAll('svg');
    let greenCount = 0, redCount = 0, amberCount = 0;
    svgs.forEach(svg => {
      const classes = svg.className?.baseVal || svg.getAttribute('class') || '';
      if (classes.includes('text-green')) greenCount++;
      if (classes.includes('text-red')) redCount++;
      if (classes.includes('text-amber')) amberCount++;
    });
    // Also look for step list items
    const stepItems = document.querySelectorAll('[class*="step"], li');
    return {
      greenIcons: greenCount,
      redIcons: redCount,
      amberIcons: amberCount,
      totalStepItems: stepItems.length,
    };
  });
  console.log('   Step log icons:', JSON.stringify(stepLogInfo));

  // 11. Scroll more
  await page.evaluate(() => window.scrollBy(0, 400));
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outputDir, 'ws-test-steps.png') });
  console.log('   Screenshot: ws-test-steps.png');

  // 12. Click any error/failed step detail buttons
  const errorClicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    let count = 0;
    for (const btn of btns) {
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('error') || text.includes('failed') || text.includes('details') || text.includes('what happened')) {
        btn.click();
        count++;
      }
    }
    return count;
  });
  console.log('   Error detail buttons clicked:', errorClicked);
  await new Promise(r => setTimeout(r, 1500));
  if (errorClicked > 0) {
    await page.screenshot({ path: path.join(outputDir, 'ws-error-details.png') });
    console.log('   Screenshot: ws-error-details.png');
  }

  // 13. Full page screenshot
  await page.screenshot({ path: path.join(outputDir, 'ws-fullpage.png'), fullPage: true });
  console.log('   Screenshot: ws-fullpage.png');

  await browser.close();
  console.log('Done! Test ID:', testId);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
