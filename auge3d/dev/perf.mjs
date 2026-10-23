// Performance-Abschätzung für Handys (nur messen, am Modell wird nichts geändert).
//
// Aufruf (aus dem Repo-Root oder aus auge3d/dev):
//   node auge3d/dev/perf.mjs
//
// Voraussetzung einmalig: cd auge3d/dev && npm i   (Chromium liegt unter /opt/pw-browsers,
// nicht "playwright install" ausführen).
//
// Was das Skript misst (Mobile-Emulation 390 × 844, DPR 2, Touch, CPU-Drosselung 4×):
//   - Zeit bis zum ersten gerenderten Frame (ab Navigationsstart)
//   - Aufbau: EYE.build und die einzelnen Texturen (erster Aufruf)
//   - Meshes, Draw Calls und Dreiecke des letzten Frames
//   - Frame-Zeiten während der Explosionsanimation (3 s) und während einer Orbit-Drehung (3 s):
//     Median und 95-Perzentil der Render-Dauer und der Abstände zwischen Renderaufrufen
//
// Hinweis: Die Renderzeit wird mit gl.finish() gemessen, damit die GPU-Arbeit mitzählt.
// SwiftShader ist Software-GL: GPU-Werte nur relativ werten.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const THROTTLE = 4;
const ANIM_MS = 3000;

// Läuft vor allen Seiten-Scripts: fängt EYE.renderer, EYE.build und EYE.textures ab.
function instrument() {
  window.EYE = window.EYE || {};
  const E = window.EYE;
  window.__frames = [];
  window.__build = null;
  window.__tex = {};

  const wrapRenderer = (r) => {
    const orig = r.render.bind(r);
    r.render = (scene, camera) => {
      const t0 = performance.now();
      orig(scene, camera);
      r.getContext().finish();
      const t1 = performance.now();
      window.__frames.push({ t: t0, dt: t1 - t0, calls: r.info.render.calls, tris: r.info.render.triangles });
    };
  };
  let renderer;
  Object.defineProperty(E, 'renderer', {
    configurable: true,
    get: () => renderer,
    set: (v) => { renderer = v; wrapRenderer(v); },
  });

  let build;
  Object.defineProperty(E, 'build', {
    configurable: true,
    get: () => build,
    set: (fn) => {
      build = (scene) => {
        const t0 = performance.now();
        const out = fn(scene);
        window.__build = { t: t0, dt: performance.now() - t0 };
        return out;
      };
    },
  });

  let tex;
  Object.defineProperty(E, 'textures', {
    configurable: true,
    get: () => tex,
    set: (api) => {
      for (const k of ['iris', 'fundus', 'sclera', 'muscle', 'tendon']) {
        const f = api[k];
        api[k] = (opts) => {
          const t0 = performance.now();
          const out = f(opts);
          window.__tex[k] = (window.__tex[k] || 0) + (performance.now() - t0);
          return out;
        };
      }
      tex = api;
    },
  });
}

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

// three.js von jsDelivr; ist das CDN nicht erreichbar, kommen die Dateien aus auge3d/dev/node_modules/three.
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

function pct(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function summarize(xs) {
  if (!xs.length) return { n: 0 };
  const s = [...xs].sort((a, b) => a - b);
  return { n: s.length, median: +pct(s, 0.5).toFixed(1), p95: +pct(s, 0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) };
}

// Frames zwischen zwei Indizes: Render-Dauer und Abstand zwischen Renderaufrufen
async function frameStats(page, from, to) {
  const frames = await page.evaluate(([a, b]) => window.__frames.slice(a, b), [from, to]);
  const durations = frames.map((f) => f.dt);
  const gaps = [];
  for (let i = 1; i < frames.length; i++) gaps.push(frames[i].t - frames[i - 1].t);
  return { frames: frames.length, render: summarize(durations), gap: summarize(gaps) };
}

const T0 = Date.now();
const log = (msg) => process.stderr.write(`[${((Date.now() - T0) / 1000).toFixed(1)} s] ${msg}\n`);

async function main() {
  const server = await startServer();
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/index.html`;

  const executablePath =
    process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const problems = [];
  const cdnFallbacks = new Set();
  const report = {};

  try {
    const context = await browser.newContext({
      viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
      deviceScaleFactor: VIEWPORT.deviceScaleFactor,
      isMobile: VIEWPORT.isMobile,
      hasTouch: VIEWPORT.hasTouch,
    });
    const page = await context.newPage();
    await routeThreeCdn(page, cdnFallbacks);
    await page.addInitScript(instrument);

    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

    // CPU-Drosselung wie ein Mittelklasse-Handy
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

    log('Seite wird geladen');
    await page.goto(url, { waitUntil: 'load', timeout: 120000 });
    log('load-Event');
    await page.waitForFunction(() => window.__frames && window.__frames.length > 0, null, { timeout: 120000 });
    log('erster Frame');
    await page.waitForTimeout(1500); // Aufbau und erste Frames abklingen lassen

    const boot = await page.evaluate(() => {
      const scene = window.EYE.scene;
      let meshes = 0;
      let triangles = 0;
      scene.traverse((o) => {
        if (!o.isMesh && !o.isLine && !o.isPoints) return;
        meshes++;
        const g = o.geometry;
        const count = g.index ? g.index.count : g.attributes.position.count;
        triangles += (o.isMesh ? count / 3 : count) * (o.isInstancedMesh ? o.count : 1);
      });
      const last = window.__frames[window.__frames.length - 1];
      const textures = Object.fromEntries(Object.entries(window.__tex).map(([k, v]) => [k, +v.toFixed(1)]));
      return {
        firstFrameMs: +window.__frames[0].t.toFixed(0),
        buildMs: window.__build ? +window.__build.dt.toFixed(1) : null,
        texturesMs: textures,
        texturesTotalMs: +Object.values(textures).reduce((a, b) => a + b, 0).toFixed(1),
        textureScale: window.EYE.textures.defaultScale,
        meshes,
        sceneTriangles: Math.round(triangles),
        drawCallsLastFrame: last.calls,
        trianglesLastFrame: last.tris,
      };
    });
    report.boot = boot;

    // Explosion: 3 s ab Klick auf „Explodiert“
    log('Explosion startet');
    const i0 = await page.evaluate(() => window.__frames.length);
    await page.click('#btnExploded');
    await page.waitForTimeout(ANIM_MS);
    const i1 = await page.evaluate(() => window.__frames.length);
    report.explosion = await frameStats(page, i0, i1);

    // Zurück zusammen, dann Orbit-Drehung per Zeiger über 3 s
    await page.click('#btnTogether');
    await page.waitForTimeout(2000);
    log('Orbit startet');
    const o0 = await page.evaluate(() => window.__frames.length);
    await page.mouse.move(195, 330);
    await page.mouse.down();
    const steps = 60;
    for (let s = 1; s <= steps; s++) {
      await page.mouse.move(195 + 60 * Math.sin((s / steps) * Math.PI), 330 + 25 * (s / steps));
      await page.waitForTimeout(ANIM_MS / steps);
    }
    await page.mouse.up();
    await page.waitForTimeout(1000); // Dämpfung ausklingen lassen
    const o1 = await page.evaluate(() => window.__frames.length);
    report.orbit = await frameStats(page, o0, o1);

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  console.log('Performance-Abschätzung (Mobile 390 × 844, DPR 2, CPU-Drosselung ' + THROTTLE + '×, SwiftShader):');
  console.log(JSON.stringify(report, null, 2));
  if (cdnFallbacks.size) console.log(`Hinweis: CDN nicht erreichbar, three.js lokal geliefert (${cdnFallbacks.size} Datei(en)).`);
  if (problems.length) {
    console.log(`\nProbleme (${problems.length}):`);
    for (const p of problems) console.log(`  ${p}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Performance-Messung abgebrochen:', err);
  process.exit(1);
});
