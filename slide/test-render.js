// Quick smoke test for the rendered sjulia slides.
// Launches a local static server and uses Playwright with the system Chrome.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('../web/node_modules/playwright-core');

const SITE_DIR = path.join(__dirname, '_site');
const PORT = 9876;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function serve(req, res) {
  let filePath = path.join(SITE_DIR, req.url === '/' ? 'index.html' : req.url);
  console.log(`[server] ${req.method} ${req.url}`);
  if (!filePath.startsWith(SITE_DIR)) {
    res.writeHead(403); res.end(); return;
  }
  try {
    if (fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (err) {
    console.log(`[server] 404 ${req.url}`);
    res.writeHead(404); res.end('Not found'); return;
  }
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.wasm': 'application/wasm',
    '.css': 'text/css',
    '.json': 'application/json'
  }[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404); res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    }
  });
}

async function runTest() {
  const server = http.createServer(serve).listen(PORT);
  let browser;
  try {
    browser = await chromium.launch({ executablePath: CHROME, headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('console', msg => {
      const text = msg.text();
      console.log(`[${msg.type()}] ${text}`);
    });
    page.on('pageerror', err => {
      console.log(`[pageerror] ${err.message}`);
      errors.push(err.message);
    });
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().includes('favicon.ico')) {
        errors.push(`HTTP ${response.status()} for ${response.url()}`);
      }
    });

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });

    // Wait for runtime to be ready (Run button enabled on first executor).
    await page.waitForFunction(() => {
      const btn = document.querySelector('.sjulia-run-btn');
      return btn && !btn.disabled;
    }, { timeout: 120000 });

    // Navigate to the "Hello, sjulia" slide (slide 2) and run it.
    const revealInfo = await page.evaluate(() => ({
      hasReveal: !!window.Reveal,
      slideCount: window.Reveal ? window.Reveal.getTotalSlides() : 0,
      currentIndex: window.Reveal ? window.Reveal.getIndices().h : -1
    }));
    console.log('[test] reveal info:', revealInfo);
    await page.evaluate(() => {
      if (window.Reveal && typeof window.Reveal.slide === 'function') {
        window.Reveal.slide(2);
      }
    });
    await page.waitForTimeout(500);
    await page.click('.sjulia-run-btn', { force: true });
    await page.waitForFunction(() => {
      const out = document.querySelector('.sjulia-output');
      return out && out.textContent.includes('Hello, sjulia!');
    }, { timeout: 30000 });

    // Navigate to plot slide (slide 3) and run it.
    await page.evaluate(() => {
      if (window.Reveal && typeof window.Reveal.next === 'function') {
        window.Reveal.next();
      }
    });
    await page.waitForTimeout(500);

    await page.click('.sjulia-run-btn', { force: true });
    await page.waitForFunction(() => {
      const plot = document.querySelector('.sjulia-plot:not(.hidden)');
      return plot && plot.querySelector('svg, canvas');
    }, { timeout: 30000 });

    if (errors.length > 0) {
      console.error('\nErrors observed:', errors);
      process.exitCode = 1;
    } else {
      console.log('\nSmoke test passed.');
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

runTest().catch(e => {
  console.error(e);
  process.exit(1);
});
