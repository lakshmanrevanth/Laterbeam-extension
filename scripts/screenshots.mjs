// Regenerates docs/screenshots/*.png from the demo mode and the extension prototypes.
//   npm run screenshots          (builds first)
// Needs Chrome or Edge. Set CHROME_PATH if it isn't found automatically.
//
// It serves web/dist with the same headers as Firebase Hosting (including the CSP from
// firebase.json), so any CSP violation or page error fails the run, which doubles as a smoke test.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve('.');
const DIST = resolve('web/dist');
const OUT = resolve('docs/screenshots');
const PORT = 4179;
const DEBUG_PORT = 9339;

const hosting = JSON.parse(readFileSync('firebase.json', 'utf8')).hosting;
const globalHeaders = hosting.headers.find((h) => h.source === '**').headers;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

// ---------- Static server ----------
function fileFor(base, urlPath) {
  const p = resolve(join(base, decodeURIComponent(urlPath)));
  if (p !== base && !p.startsWith(base + sep)) return null; // no path traversal
  if (existsSync(p) && statSync(p).isFile()) return p;
  if (!extname(p) && existsSync(`${p}.html`)) return `${p}.html`; // cleanUrls
  return null;
}

const server = createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  let file;
  let csp = true;
  if (pathname.startsWith('/__repo/')) {
    file = fileFor(ROOT, pathname.slice('/__repo'.length));
    csp = false; // prototypes are local design files, not part of the site
  } else {
    file = fileFor(DIST, pathname) || join(DIST, 'index.html'); // SPA rewrite
  }
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' };
  if (csp) for (const h of globalHeaders) headers[h.key] = h.value;
  res.writeHead(200, headers).end(readFileSync(file));
});

// ---------- Minimal Chrome DevTools Protocol client ----------
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const hit = candidates.find((c) => existsSync(c));
  if (!hit) throw new Error('Chrome not found. Set CHROME_PATH.');
  return hit;
}

async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = bad; });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, bad } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? bad(new Error(msg.error.message)) : ok(msg.result);
    } else if (msg.method) {
      (listeners.get(msg.method) || []).forEach((cb) => cb(msg.params));
    }
  };
  return {
    send: (method, params = {}) => new Promise((ok, bad) => {
      pending.set(++id, { ok, bad });
      ws.send(JSON.stringify({ id, method, params }));
    }),
    on: (method, cb) => listeners.set(method, [...(listeners.get(method) || []), cb]),
    once: (method) => new Promise((ok) => {
      const cb = (p) => { listeners.set(method, listeners.get(method).filter((x) => x !== cb)); ok(p); };
      listeners.set(method, [...(listeners.get(method) || []), cb]);
    }),
    close: () => ws.close(),
  };
}

// ---------- Shots ----------
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false };
const SHOTS = [
  ['mobile-welcome', '/?demo=welcome', PHONE, 'light'],
  ['mobile-list', '/?demo', PHONE, 'light'],
  ['mobile-list-dark', '/?demo', PHONE, 'dark'],
  ['mobile-add', '/?demo=add', PHONE, 'light'],
  ['mobile-item', '/?demo=item', PHONE, 'light'],
  ['mobile-account', '/?demo=account', PHONE, 'light'],
  ['desktop-welcome', '/?demo=welcome', DESKTOP, 'light'],
  ['desktop-list', '/?demo', DESKTOP, 'light'],
  ['desktop-list-dark', '/?demo', DESKTOP, 'dark'],
  ['desktop-add', '/?demo=add', DESKTOP, 'light'],
  ['extension-popup', '/__repo/docs/prototypes/extension-popup.html', { width: 1280, height: 760, deviceScaleFactor: 1.5, mobile: false }, 'light'],
  ['extension-popup-dark', '/__repo/docs/prototypes/extension-popup.html', { width: 1280, height: 760, deviceScaleFactor: 1.5, mobile: false }, 'dark'],
  // Chrome Web Store sizes (exactly 1280x800).
  ['store-1-popup', '/__repo/docs/prototypes/extension-popup.html', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, 'light'],
  ['store-2-app', '/?demo', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, 'light'],
  ['store-3-app-dark', '/?demo', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, 'dark'],
  // Composite of the shots above: must run last.
  ['hero', '/__repo/docs/prototypes/showcase.html', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false }, 'light'],
];

const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const profile = mkdtempSync(join(tmpdir(), 'checklater-shots-'));
const chrome = spawn(findChrome(), [
  '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' });

const problems = [];
try {
  const targets = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    return list.find((t) => t.type === 'page');
  });
  const cdp = await connect(targets.webSocketDebuggerUrl);
  let current = '';
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  cdp.on('Runtime.exceptionThrown', (p) => problems.push(`${current}: ${p.exceptionDetails.exception?.description || p.exceptionDetails.text}`));
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') problems.push(`${current}: console.error ${p.args.map((a) => a.value ?? a.description).join(' ')}`);
  });
  cdp.on('Log.entryAdded', ({ entry }) => {
    // Favicons come from Google; offline or blocked fetches there are not our bug.
    if (entry.level === 'error' && !/favicons|ERR_|net::/.test(`${entry.text} ${entry.url || ''}`)) problems.push(`${current}: ${entry.text}`);
  });

  for (const [name, path, metrics, scheme] of SHOTS) {
    if (only.length && !only.includes(name)) continue;
    current = name;
    await cdp.send('Emulation.setDeviceMetricsOverride', metrics);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}${path}` });
    await loaded;
    await new Promise((r) => setTimeout(r, 1200)); // let data render, sheets animate, favicons load
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`  ✓ ${name}.png`);
  }
  cdp.close();
} finally {
  chrome.kill();
  server.close();
  setTimeout(() => { try { rmSync(profile, { recursive: true, force: true }); } catch {} }, 500);
}

if (problems.length) {
  console.error(`\n${problems.length} page error(s):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`\nAll screenshots written to docs/screenshots/ with no page errors.`);
}
