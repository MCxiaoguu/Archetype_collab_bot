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
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

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

  // 2. Clear session storage to get fresh Quick Start state
  console.log('5. Navigating to Quick Start...');
  await page.evaluate(() => sessionStorage.removeItem('archetype:bootstrap-chat'));
  await page.goto('https://dev.syntheticarchetype.com/workspace/quick-start', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));

  // Screenshot: test type cards
  await page.screenshot({ path: path.join(outputDir, 'card-1-selection.png') });
  console.log('   Screenshot: card-1-selection.png');

  // 3. Click UAT Test card
  console.log('6. Selecting UAT Test...');
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const uat = btns.find(b => /UAT Test/i.test(b.textContent) && !/Feature/i.test(b.textContent));
    if (uat) uat.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot: mode selected, input active
  await page.screenshot({ path: path.join(outputDir, 'card-2-uat-selected.png') });
  console.log('   Screenshot: card-2-uat-selected.png');

  // 4. Type prompt and submit
  console.log('7. Typing prompt...');
  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.click();
    await textarea.type('Test the login flow - user enters email and password, clicks continue, and should land on the dashboard', { delay: 15 });
  }

  await page.screenshot({ path: path.join(outputDir, 'card-3-typed.png') });
  console.log('   Screenshot: card-3-typed.png');

  // Submit via Enter key
  console.log('8. Submitting...');
  await page.keyboard.press('Enter');

  // Wait for LLM response
  console.log('9. Waiting for AI response...');
  await new Promise(r => setTimeout(r, 15000));
  await page.screenshot({ path: path.join(outputDir, 'card-4-loading.png') });

  // Wait more for the card to render
  await new Promise(r => setTimeout(r, 15000));
  await page.screenshot({ path: path.join(outputDir, 'card-5-response.png') });
  console.log('   Screenshot: card-5-response.png');

  // Wait a bit more in case it's still loading
  await new Promise(r => setTimeout(r, 10000));
  await page.screenshot({ path: path.join(outputDir, 'card-6-final.png') });
  console.log('   Screenshot: card-6-final.png');

  // Full page
  await page.screenshot({ path: path.join(outputDir, 'card-fullpage.png'), fullPage: true });
  console.log('   Screenshot: card-fullpage.png');

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
