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

  // 1. Login
  console.log('1. Logging in...');
  await page.goto('https://dev.syntheticarchetype.com', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('a, button')];
    const login = btns.find(b => /log\s*in|sign\s*in/i.test(b.textContent));
    if (login) login.click();
  });
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});

  const emailInput = await page.$('input[name="username"]') || await page.$('input[name="email"]') || await page.$('input[type="email"]');
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
  // Dismiss welcome modal
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, a')];
    const btn = btns.find(b => /continue|go to workspace|dashboard/i.test(b.textContent));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 2000));
  console.log('   Logged in');

  // Use an existing completed test that has scroll errors
  const testId = '0f0f0b215d274c2682e9e27cd533e2ec';

  // 2. Navigate to Test Hub expanded to this test
  console.log('2. Opening test in Test Hub...');
  await page.goto(`https://dev.syntheticarchetype.com/workspace/tests?expand=${testId}`, { waitUntil: 'networkidle2', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('onboarding-complete', '1'));
  await new Promise(r => setTimeout(r, 4000));

  // Scroll to the expanded section
  await page.evaluate((tid) => {
    const el = document.getElementById(`section-${tid}`);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, testId);
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(outputDir, 'final-test-top.png') });
  console.log('   Screenshot: final-test-top.png');

  // 3. Click the "Test Details" tab to see step logs
  await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('button')];
    const details = tabs.find(b => /test details/i.test(b.textContent));
    if (details) { details.click(); return 'clicked details'; }
    return 'no details tab';
  });
  await new Promise(r => setTimeout(r, 1000));

  // 4. Scroll down to see the steps section with icons
  await page.evaluate(() => {
    // Find the "Steps" label and scroll to it
    const allTds = [...document.querySelectorAll('td')];
    const stepsTd = allTds.find(td => td.textContent.trim() === 'Steps');
    if (stepsTd) stepsTd.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outputDir, 'final-steps-case1.png') });
  console.log('   Screenshot: final-steps-case1.png');

  // 5. Check what test case is visible, switch to case 2 if possible
  const caseCount = await page.evaluate(() => {
    // Look for test case navigation/tabs - numbered cases UAT-001, UAT-002
    const allText = [...document.querySelectorAll('*')].filter(el => el.children.length === 0);
    const cases = allText.filter(el => /UAT-00\d/.test(el.textContent));
    return cases.map(c => c.textContent.trim());
  });
  console.log('   Cases found:', caseCount);

  // 6. Try scrolling further to see UAT-002
  await page.evaluate(() => window.scrollBy(0, 500));
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outputDir, 'final-scrolled.png') });
  console.log('   Screenshot: final-scrolled.png');

  // 7. Look for and click on UAT-002 case tab/row
  const switchResult = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('button, [role="tab"], [class*="cursor-pointer"], td')];
    for (const el of elements) {
      if (/UAT-002|Scroll and Navigation|case\s*2/i.test(el.textContent)) {
        el.click();
        return `Clicked: ${el.textContent.trim().substring(0, 50)}`;
      }
    }
    // Try number tabs
    const numBtns = elements.filter(el => el.textContent.trim() === '2');
    if (numBtns.length > 0) { numBtns[0].click(); return 'Clicked tab 2'; }
    return 'No UAT-002 found';
  });
  console.log('   Switch result:', switchResult);
  await new Promise(r => setTimeout(r, 1500));

  // 8. Scroll to steps of current case
  await page.evaluate(() => {
    const allTds = [...document.querySelectorAll('td')];
    const stepsTd = allTds.find(td => td.textContent.trim() === 'Steps');
    if (stepsTd) stepsTd.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(outputDir, 'final-steps-case2.png') });
  console.log('   Screenshot: final-steps-case2.png');

  // 9. Full page screenshot
  await page.screenshot({ path: path.join(outputDir, 'final-fullpage.png'), fullPage: true });
  console.log('   Screenshot: final-fullpage.png');

  // 10. Debug: dump what step log icons are visible
  const iconInfo = await page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];
    const icons = svgs.filter(s => {
      const cls = s.className?.baseVal || s.getAttribute('class') || '';
      return cls.includes('text-emerald') || cls.includes('text-red') || cls.includes('text-amber');
    });
    return icons.map(s => {
      const cls = s.className?.baseVal || s.getAttribute('class') || '';
      const parent = s.parentElement?.parentElement;
      const nearby = parent?.textContent?.trim().substring(0, 60) || '';
      return { class: cls, nearby };
    });
  });
  console.log('   Icons found:', JSON.stringify(iconInfo, null, 2));

  await browser.close();
  console.log('Done!');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
