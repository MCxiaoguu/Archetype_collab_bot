const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function screenshot(input, outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Convert file path to file:// URL if needed
  let url = input;
  if (fs.existsSync(input)) {
    url = 'file://' + path.resolve(input);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
  await page.screenshot({ path: outputPath, fullPage: false });
  await browser.close();

  console.log(outputPath);
}

const input = process.argv[2];
const output = process.argv[3] || `/tmp/design-previews/screenshot-${Date.now()}.png`;

if (!input) {
  console.error('Usage: node screenshot.js <url_or_html_file> [output_path]');
  process.exit(1);
}

screenshot(input, output).catch(err => {
  console.error(err.message);
  process.exit(1);
});
