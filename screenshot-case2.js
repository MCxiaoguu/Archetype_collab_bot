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
  await page.setViewport({ width: 1440, height: 1200 });

  // Login
  console.log('1. Logging in...');
  await page.goto('https://dev.syntheticarchetype.com', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('a, button')];
    const login = btns.find(b => /log\s*in|sign\s*in/i.test(b.textContent));
    if (login) login.click();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  const emailInput = await page.$('input[name="username"]') || await page.$('input[name="email"]');
  if (emailInput) { await emailInput.click({ clickCount: 3 }); await emailInput.type('demo@syntheticarchetype.com', { delay: 30 }); }
  const pwInput = await page.$('input[name="password"]') || await page.$('input[type="password"]');
  if (pwInput) { await pwInput.click({ clickCount: 3 }); await pwInput.type('DEMO-archetype', { delay: 30 }); }
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button[type="submit"], button')];
    const submit = btns.find(b => /continue|log\s*in|submit/i.test(b.textContent));
    if (submit) submit.click();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const btn = btns.find(b => /continue|go to workspace|dashboard/i.test(b.textContent));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  const testId = '0f0f0b215d274c2682e9e27cd533e2ec';

  // Navigate to Test Hub with expand
  console.log('2. Opening test...');
  await page.goto(`https://dev.syntheticarchetype.com/workspace/tests?expand=${testId}`, { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
  await new Promise(r => setTimeout(r, 4000));

  // Click Test Details tab
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')];
    const details = tabs.find(b => /test details/i.test(b.textContent));
    if (details) details.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Switch to UAT-002 tab
  console.log('3. Switching to UAT-002...');
  await page.evaluate(() => {
    const elements = [...document.querySelectorAll('button, [role="tab"], td')];
    for (const el of elements) {
      if (el.textContent.trim() === 'UAT-002') {
        el.click();
        return;
      }
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // Scroll to the steps section of case 2
  await page.evaluate(() => {
    // Find all "Steps" labels and scroll to the last visible one
    const allTds = [...document.querySelectorAll('td')];
    const stepsTds = allTds.filter(td => td.textContent.trim() === 'Steps');
    const target = stepsTds[stepsTds.length - 1] || stepsTds[0];
    if (target) target.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(outputDir, 'case2-steps.png') });
  console.log('   Screenshot: case2-steps.png');

  // Also take a screenshot showing both cases with their status
  // Scroll to show the case header area
  await page.evaluate((tid) => {
    const el = document.getElementById(`section-${tid}`);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, testId);
  await new Promise(r => setTimeout(r, 500));
  // Scroll down a bit to show the test details
  await page.evaluate(() => window.scrollBy(0, 250));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outputDir, 'case2-overview.png') });
  console.log('   Screenshot: case2-overview.png');

  // Now scroll further to show the steps with icons
  await page.evaluate(() => window.scrollBy(0, 400));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outputDir, 'case1-icons.png') });
  console.log('   Screenshot: case1-icons.png');

  // Continue scrolling to see case 2 with blocked icons
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outputDir, 'case2-icons.png') });
  console.log('   Screenshot: case2-icons.png');

  // Full page for context
  await page.screenshot({ path: path.join(outputDir, 'both-cases-fullpage.png'), fullPage: true });
  console.log('   Screenshot: both-cases-fullpage.png');

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
