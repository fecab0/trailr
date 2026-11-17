'use strict';
// Shared helpers for the page-driving scripts: find Playwright, launch Chromium, open the
// composition at the right size and seek it to a time.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRequire } = require('module');
const { execSync } = require('child_process');
const { pathToFileURL } = require('url');

const FORMATS = { horizontal: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] };

// Playwright may live in the project, next to the skill, or in the global npm root.
function loadPlaywright() {
  const tries = [
    () => require('playwright'),
    () => createRequire(path.join(process.cwd(), 'noop.js'))('playwright'),
    () => {
      const root = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      return createRequire(path.join(root, 'noop.js'))('playwright');
    },
  ];
  for (const t of tries) {
    try { return t(); } catch (_) { /* next */ }
  }
  throw new Error('Playwright not found. Install it in the project (npm i -D playwright) or globally (npm i -g playwright), then `npx playwright install chromium`.');
}

// A Chromium already downloaded into the ms-playwright cache, newest first.
function cachedChromium() {
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
    path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright'),
  ].filter(Boolean);
  const exes = [
    ['chrome-win64', 'chrome.exe'], ['chrome-win', 'chrome.exe'],
    ['chrome-linux64', 'chrome'], ['chrome-linux', 'chrome'],
    ['chrome-mac-arm64', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
    ['chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'],
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) {
      for (const parts of exes) {
        const p = path.join(root, d, ...parts);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

async function launch() {
  const { chromium } = loadPlaywright();
  const args = ['--disable-web-security', '--allow-file-access-from-files', '--hide-scrollbars', '--force-color-profile=srgb'];
  try {
    return await chromium.launch({ args });
  } catch (err) {
    const exe = cachedChromium();
    if (!exe) throw err;
    console.error(`[trailr] Playwright's expected browser is missing; using cached ${exe}`);
    return chromium.launch({ args, executablePath: exe });
  }
}

function pageUrl(file, format) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`Page not found: ${abs}`);
  const u = pathToFileURL(abs);
  u.searchParams.set('format', format);
  return u.href;
}

// Opens the page (file:// so local fonts and images load) at the format's size and waits
// until it is ready: fonts loaded, window.render present, optional window.__ready resolved.
async function openPage(browser, file, format = 'horizontal') {
  const size = FORMATS[format];
  if (!size) throw new Error(`Unknown format "${format}" (use ${Object.keys(FORMATS).join(', ')})`);
  const [width, height] = size;
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pageUrl(file, format), { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (window.__ready) await window.__ready;
  });
  const ok = await page.evaluate(() => typeof window.render === 'function' && !!window.TIMELINE);
  if (errors.length) throw new Error(`Page error: ${errors[0]}`);
  if (!ok) throw new Error('The page must expose window.render(t) and window.TIMELINE');
  return { page, context, width, height, errors };
}

// render(t), then wait for anything the frame needs (decoded footage frames, etc.).
async function seek(page, t) {
  await page.evaluate(async (time) => {
    const r = window.render(time);
    if (r && typeof r.then === 'function') await r;
    if (window.__frameReady) await window.__frameReady(time);
  }, t);
}

module.exports = { FORMATS, loadPlaywright, launch, openPage, seek };
