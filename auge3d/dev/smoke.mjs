// Smoke-Test für die 3D-Augen-Vorschau.
//
// Aufruf (aus dem Repo-Root oder aus auge3d/dev):
//   node auge3d/dev/smoke.mjs
//
// Voraussetzung einmalig: cd auge3d/dev && npm i   (Chromium liegt unter /opt/pw-browsers,
// nicht "playwright install" ausführen).
//
// Was das Skript macht:
//   - startet einen kleinen statischen Server für auge3d/ (Port zufällig, nur 127.0.0.1)
//   - öffnet index.html in zwei Viewports: mobile 390×844 (touch, DPR 2) und desktop 1280×800
//   - wartet, bis das WebGL-Canvas Frames liefert
//   - setzt den Explosionsregler (#explo) auf 0 / 50 / 100 % und speichert Screenshots
//     nach auge3d/dev/shots/<viewport>-<prozent>.png
//   - sammelt Konsolenfehler, Seitenfehler und fehlgeschlagene Requests
//   - Exit-Code 1, wenn Konsolenfehler, Seitenfehler oder fehlgeschlagene Requests auftreten
//
// Fehlt der Explosionsregler, wird nur ein Hinweis ausgegeben (kein Abbruch).

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const shotsDir = join(here, 'shots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];
const EXPLO_STEPS = [0, 50, 100];

// Statischer Server für auge3d/ (ohne Abhängigkeiten).
function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
      const file = normalize(join(root, rel));
      if (!file.startsWith(root + sep) || !existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(500).end('error');
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

// Wartet, bis das Canvas einen WebGL-Kontext hat und mehrere Frames gezeichnet wurden.
async function waitForWebGL(page) {
  await page.waitForFunction(() => {
    const c = document.getElementById('gl');
    if (!c || c.width === 0 || c.height === 0) return false;
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl && !gl.isContextLost();
  }, null, { timeout: 15000 });
  // ein paar Frames abwarten, damit Three.js tatsächlich gezeichnet hat
  await page.evaluate(
    () => new Promise((ok) => {
      let n = 0;
      const tick = () => (++n >= 5 ? ok() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    }),
  );
}

// three.js kommt von jsDelivr. Ist das CDN nicht erreichbar (z. B. in Sandboxen ohne Internet),
// liefert der Test die gleichen Dateien aus auge3d/dev/node_modules/three (r147) nach.
// Nicht erreichbare CDN-Dateien werden im Bericht als Hinweis genannt (kein Fehler-Exit).
async function routeThreeCdn(page, cdnFallbacks) {
  await page.route('https://cdn.jsdelivr.net/npm/three@0.147.0/**', async (route) => {
    const url = route.request().url();
    try {
      const response = await route.fetch({ timeout: 8000 });
      await route.fulfill({ response });
    } catch {
      const rel = new URL(url).pathname.replace('/npm/three@0.147.0/', '');
      const body = await readFile(join(here, 'node_modules', 'three', rel)).catch(() => null);
      if (!body) return route.abort();
      cdnFallbacks.add(url);
      await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
    }
  });
}

// Setzt den Explosionsregler per Event, damit die App ihn wie eine Nutzereingabe verarbeitet.
async function setExplosion(page, percent) {
  return page.evaluate((v) => {
    const el = document.querySelector('input[type=range]#explo') ?? document.querySelector('input[type=range]');
    if (!el) return false;
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, percent);
}

async function main() {
  await mkdir(shotsDir, { recursive: true });
  const server = await startServer();
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/index.html`;

  // Playwright-Version und vorinstallierter Chromium können auseinanderliegen:
  // dann den Chromium aus /opt/pw-browsers direkt starten (überschreibbar per CHROMIUM_PATH).
  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({
    executablePath,
    args:['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const problems = [];
  const cdnFallbacks = new Set();
  const summary = [];
  let explosionMissing = false;

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
      });
      const page = await context.newPage();
      const label = vp.name;
      await routeThreeCdn(page, cdnFallbacks);

      page.on('console', (msg) => {
        if (msg.type() === 'error') problems.push(`[${label}] console.error: ${msg.text()}`);
      });
      page.on('pageerror', (err) => problems.push(`[${label}] pageerror: ${err.message}`));
      page.on('requestfailed', (req) =>
        problems.push(`[${label}] requestfailed: ${req.url()} (${req.failure()?.errorText ?? '?'})`),
      );
      page.on('response', (res) => {
        if (res.status() >= 400) problems.push(`[${label}] HTTP ${res.status()}: ${res.url()}`);
      });

      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await waitForWebGL(page);

      for (const pct of EXPLO_STEPS) {
        const ok = await setExplosion(page, pct);
        if (!ok) {
          if (!explosionMissing) console.log('Hinweis: Explosionsregler (input[type=range]) nicht gefunden – übersprungen.');
          explosionMissing = true;
          break;
        }
        await page.waitForTimeout(1300); // Übergang der Explosion abwarten (Animation ≈ 1,2 s)
        const file = join(shotsDir, `${label}-${pct}.png`);
        await page.screenshot({ path: file });
        summary.push(`${label} ${pct} % → ${file}`);
      }

      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (cdnFallbacks.size) {
    console.log(`Hinweis: CDN nicht erreichbar, three.js lokal geliefert (${cdnFallbacks.size} Datei(en)).`);
  }
  console.log('Screenshots:');
  for (const line of summary) console.log(`  ${line}`);
  if (problems.length) {
    console.log(`\nProbleme (${problems.length}):`);
    for (const p of problems) console.log(`  ${p}`);
    process.exitCode = 1;
  } else {
    console.log('\nKeine Konsolenfehler, Seitenfehler oder fehlgeschlagene Requests.');
  }
}

main().catch((err) => {
  console.error('Smoke-Test abgebrochen:', err);
  process.exit(1);
});
