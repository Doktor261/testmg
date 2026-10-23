// Interaktions-Test für die 3D-Augen-Vorschau.
//
// Aufruf (aus dem Repo-Root oder aus auge3d/dev):
//   node auge3d/dev/interact.mjs
//
// Voraussetzung einmalig: cd auge3d/dev && npm i   (Chromium liegt unter /opt/pw-browsers,
// nicht "playwright install" ausführen).
//
// Prüft je Viewport (mobil 390×844 mit Touch, Desktop 1280×800):
//   - Tippen auf Sklera, Iris, M. rectus lateralis, N. opticus → Info-Sheet mit Name, Text, Fakten, Klinik
//   - Drehen (Ziehen) löst kein Antippen aus
//   - Isolieren / Ausblenden / Alle zeigen
//   - Teile-Liste öffnen, Teil wählen, Sichtbarkeits-Schalter
//   - Ansichts-Chips, Zurücksetzen, Beschriftung an/aus
//   - Explosion 100 %: Modell im Bild? Verdeckt das Info-Sheet das Modell?
//   - Konsolenfehler, Seitenfehler, fehlgeschlagene Requests
// Screenshots: auge3d/dev/shots/interact-<viewport>-<schritt>.png (gitignored)
// Exit-Code 1, wenn ein Check fehlschlägt oder Fehler auftreten.

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
const TAP_PARTS = ['sclera', 'iris', 'rectus_lateralis', 'n_opticus'];
const VIEW_DIRS = {
  front: { dir: [0, 0, 1], test: (d) => d.z > 0.9 },
  lateral: { dir: [-1, 0, 0], test: (d) => d.x < -0.9 },
  superior: { dir: [0, 1, 0], test: (d) => d.y > 0.9 },
  posterior: { dir: [0, 0, -1], test: (d) => d.z < -0.9 },
};

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

async function waitForWebGL(page) {
  await page.waitForFunction(() => {
    const c = document.getElementById('gl');
    if (!c || c.width === 0 || c.height === 0) return false;
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl && !gl.isContextLost();
  }, null, { timeout: 15000 });
  await page.evaluate(
    () => new Promise((ok) => {
      let n = 0;
      const tick = () => (++n >= 5 ? ok() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    }),
  );
}

// three.js von jsDelivr; ohne Internet aus auge3d/dev/node_modules/three nachliefern (wie smoke.mjs).
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

// Sucht einen Bildschirmpunkt, an dem ein Tipp genau dieses Teil träfe (gleiche Logik wie app.js pick()).
// Liefert außerdem die oberste Trefferfläche an der ersten Probe, um Verdeckung zu erklären.
function findTapPoint(id) {
  const LOW = { corpus_vitreum: 1, camera_anterior: 2, camera_posterior: 2 };
  const cam = EYE.camera, r = document.getElementById('gl').getBoundingClientRect();
  const targets = [];
  EYE.scene.traverse((o) => { if (o.isMesh && o.userData.partId && o.visible && o.userData.pickable !== false) targets.push(o); });
  const rc = new THREE.Raycaster();
  let firstRaw = null, n = 0;
  for (const m of (EYE.meshesByPart[id] || []).filter((x) => x.visible)) {
    const pos = m.geometry && m.geometry.attributes.position;
    if (!pos) continue;
    const step = Math.max(1, Math.floor(pos.count / 60));
    for (let i = 0; i < pos.count; i += step) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(cam);
      if (p.z > 1 || Math.abs(p.x) > 0.97 || Math.abs(p.y) > 0.97) continue;
      n++;
      rc.setFromCamera(new THREE.Vector2(p.x, p.y), cam);
      const hits = rc.intersectObjects(targets, false);
      const hit = hits.find((h) => !LOW[h.object.userData.partId]) || hits[0];
      if (!firstRaw && hits[0]) firstRaw = hits[0].object.userData.partId;
      if (hit && hit.object.userData.partId === id) {
        return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, n, firstRaw };
      }
    }
  }
  return { x: null, n, firstRaw };
}

// Sichtbarer Inhalt des Info-Sheets gegen die Teildaten.
function readSheet(id) {
  const P = EYE.partById[id], C = EYE.CONTENT && EYE.CONTENT[id];
  const body = document.getElementById('infoBody');
  const paras = [...body.querySelectorAll('p:not(.clinic)')].map((p) => p.textContent);
  const clinic = body.querySelector('.clinic');
  return {
    la: document.getElementById('infoLa').textContent,
    de: document.getElementById('infoDe').textContent,
    grp: document.getElementById('infoGrp').textContent,
    text: paras[0] || '',
    facts: body.querySelectorAll('li').length,
    clinic: clinic ? clinic.textContent : '',
    expLa: P.la, expDe: P.de, expText: P.text || '', expFacts: (P.facts || []).length,
    expClinic: P.clinic || '', contentText: C ? C.text || '' : null,
  };
}

// Anteil des Modells im Bild und Überdeckung durch das Info-Sheet (Stichprobe der Mesh-Scheitel).
function modelCoverage() {
  const cam = EYE.camera, cv = document.getElementById('gl').getBoundingClientRect();
  const sheet = document.getElementById('infoSheet');
  const sr = sheet.classList.contains('open') ? sheet.getBoundingClientRect() : null;
  let n = 0, out = 0, under = 0, inside = 0;
  EYE.scene.traverse((o) => {
    if (!o.isMesh || !o.userData.partId || !o.visible || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 120));
    for (let i = 0; i < pos.count; i += step) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).project(cam);
      n++;
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) { out++; continue; }
      const x = cv.left + (v.x + 1) / 2 * cv.width, y = cv.top + (1 - v.y) / 2 * cv.height;
      inside++;
      if (sr && x >= sr.left && x <= sr.right && y >= sr.top && y <= sr.bottom) under++;
    }
  });
  return {
    outPct: n ? Math.round(100 * out / n) : 0,
    sheetCoverPct: inside ? Math.round(100 * under / inside) : 0,
    sheetTop: sr ? Math.round(sr.top) : null,
  };
}

// Ein Schritt mit Zeitgrenze: Hänger oder Fehler werden als FAIL protokolliert, der Lauf geht weiter.
async function step(report, vp, name, fn, ms = 20000) {
  let timer;
  const limit = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`Zeitüberschreitung nach ${ms / 1000} s`)), ms); });
  try {
    await Promise.race([fn(), limit]);
  } catch (err) {
    report.check(vp, name, false, 'Schritt abgeschlossen', err.message, null);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  await mkdir(shotsDir, { recursive: true });
  const server = await startServer();
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/index.html`;

  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({
    executablePath,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  const problems = [];
  const checks = [];
  const cdnFallbacks = new Set();
  const report = {
    check(vp, step, ok, expected, actual, shot) {
      checks.push({ vp, step, ok, expected, actual, shot });
      console.log(`  ${ok ? 'OK  ' : 'FAIL'} [${vp}] ${step}${ok ? '' : ` — erwartet ${expected}, tatsächlich ${actual}`}`);
      if (!ok) problems.push(`[${vp}] ${step}: erwartet „${expected}“, tatsächlich „${actual}“${shot ? ` (${shot})` : ''}`);
    },
  };

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
      page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`[${label}] console.error: ${msg.text()}`); });
      page.on('pageerror', (err) => problems.push(`[${label}] pageerror: ${err.message}`));
      page.on('requestfailed', (req) => problems.push(`[${label}] requestfailed: ${req.url()}`));
      page.on('response', (res) => { if (res.status() >= 400) problems.push(`[${label}] HTTP ${res.status()}: ${res.url()}`); });

      const ck = (name, ok, expected, actual, shot) => report.check(label, name, ok, expected, actual, shot);
      const run = (name, fn, ms) => step(report, label, name, fn, ms);
      const shot = async (name) => {
        const file = `interact-${label}-${name}.png`;
        await page.screenshot({ path: join(shotsDir, file), timeout: 15000 });
        return file;
      };
      const tap = async (x, y) => {
        if (vp.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
        await page.waitForTimeout(350);
      };
      const sheetOpen = (id) => page.evaluate((i) => document.getElementById(i).classList.contains('open'), id);
      const closeInfo = async () => { if (await sheetOpen('infoSheet')) { await page.click('#infoClose'); await page.waitForTimeout(400); } };
      const camDir = () => page.evaluate(() => EYE.camera.position.clone().sub(EYE.controls.target).normalize().toArray());
      const visibleOf = (id) => page.evaluate((i) => (EYE.meshesByPart[i] || []).every((m) => m.visible), id);

      console.log(`start ${label}`);
      await run('laden', async () => {
        await page.goto(url, { waitUntil: 'load', timeout: 30000 });
        await waitForWebGL(page);
      }, 60000);

      // 1. Antippen der Teile → Info-Sheet. Nerv über Ansicht „Posterior“.
      for (const id of ['sclera', 'iris', 'rectus_lateralis']) {
        await run(`tippen ${id}`, async () => {
          await closeInfo();
          await page.click('[data-view="front"]'); await page.waitForTimeout(900);
          const hit = await page.evaluate(findTapPoint, id);
          if (hit.x === null) {
            ck(`tippen ${id}`, false, `Tippziel für ${id} vorhanden`, `kein Tipp-Punkt (${hit.n} Proben; oberste Fläche: ${hit.firstRaw})`, null);
            return;
          }
          await tap(hit.x, hit.y);
          const opened = await sheetOpen('infoSheet');
          const s = await page.evaluate(readSheet, id);
          const name = await shot(`info-${id}`);
          ck(`tippen ${id}`, opened && s.la === s.expLa, s.expLa, opened ? s.la : 'Sheet geschlossen', name);
          ck(`${id} Name`, s.de === s.expDe, s.expDe, s.de);
          ck(`${id} Gruppe`, s.grp !== '', 'Gruppenname', s.grp);
          ck(`${id} Text`, s.text !== '' && s.text === s.expText, 'Text aus EYE.partById', s.text.slice(0, 60));
          ck(`${id} Fakten`, s.facts === s.expFacts, String(s.expFacts), String(s.facts));
          ck(`${id} Klinik`, !!s.clinic === !!s.expClinic, s.expClinic ? 'Klinik-Absatz' : 'kein Klinik-Absatz', s.clinic ? 'vorhanden' : 'fehlt');
          await closeInfo();
        });
      }
      await run('tippen n_opticus (Ansicht Posterior)', async () => {
        await page.click('[data-view="posterior"]'); await page.waitForTimeout(900);
        const hit = await page.evaluate(findTapPoint, 'n_opticus');
        if (hit.x === null) {
          ck('tippen n_opticus', false, 'Tippziel für n_opticus vorhanden', `kein Tipp-Punkt (${hit.n} Proben; oberste Fläche: ${hit.firstRaw})`, null);
          return;
        }
        await tap(hit.x, hit.y);
        const opened = await sheetOpen('infoSheet');
        const s = await page.evaluate(readSheet, 'n_opticus');
        const name = await shot('info-n_opticus');
        ck('tippen n_opticus', opened && s.la === s.expLa, s.expLa, opened ? s.la : 'Sheet geschlossen', name);
        ck('n_opticus Text', s.text !== '' && s.text === s.expText, 'Text aus EYE.partById', s.text.slice(0, 60));
        await closeInfo();
      });
      await run('Ansicht zurücksetzen', async () => { await page.click('#btnReset'); await page.waitForTimeout(900); });

      // 2. Drehen darf nicht antippen (Maus, auf beiden Viewports)
      await run('Drehen ohne Antippen', async () => {
        const hit = await page.evaluate(findTapPoint, 'sclera');
        const x0 = hit.x ?? vp.width / 2, y0 = hit.y ?? vp.height / 2;
        const before = await page.evaluate(() => EYE.camera.position.toArray());
        await page.mouse.move(x0, y0); await page.mouse.down();
        for (let k = 1; k <= 10; k++) await page.mouse.move(x0 + k * 9, y0 + k * 3);
        await page.mouse.up();
        await page.waitForTimeout(900);
        const after = await page.evaluate(() => EYE.camera.position.toArray());
        const moved = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
        const opened = await sheetOpen('infoSheet');
        ck('Drehen ohne Antippen', !opened && moved > 0.5, 'Kamera bewegt, kein Sheet', `Kamera Δ=${moved.toFixed(2)}, Sheet ${opened ? 'offen' : 'zu'}`, await shot('drag'));
        await closeInfo();
      });

      // 3. Isolieren / Aufheben
      await run('Isolieren', async () => {
        const hit = await page.evaluate(findTapPoint, 'sclera');
        if (hit.x === null) { ck('Isolieren', false, 'Sklera antippbar', 'kein Tipp-Punkt'); return; }
        await tap(hit.x, hit.y);
        await page.click('#btnIsolate');
        await page.waitForTimeout(300);
        const pick = await page.evaluate(() => {
          const others = [], own = [];
          EYE.scene.traverse((o) => {
            if (!o.isMesh || !o.userData.partId) return;
            (o.userData.partId === 'sclera' ? own : others).push(o.userData.pickable !== false);
          });
          return { othersPickable: others.filter(Boolean).length, others: others.length, own: own.filter(Boolean).length, ownN: own.length };
        });
        ck('Isolieren', pick.othersPickable === 0 && pick.own === pick.ownN, 'andere Teile nicht pickbar', `${pick.othersPickable}/${pick.others} pickbar`, await shot('isolate'));
        await page.click('#btnIsolate');
        await page.waitForTimeout(300);
        const restored = await page.evaluate(() => {
          let n = 0, p = 0;
          EYE.scene.traverse((o) => { if (o.isMesh && o.userData.partId && o.visible) { n++; if (o.userData.pickable !== false) p++; } });
          return { n, p };
        });
        ck('Isolierung aufheben', restored.p === restored.n, 'alle sichtbaren Teile pickbar', `${restored.p}/${restored.n}`);
        await closeInfo();
      });

      // 4. Ausblenden und Alle zeigen (Liste)
      await run('Ausblenden und Alle zeigen', async () => {
        const hit = await page.evaluate(findTapPoint, 'sclera');
        if (hit.x === null) { ck('Ausblenden', false, 'Sklera antippbar', 'kein Tipp-Punkt'); return; }
        await tap(hit.x, hit.y);
        await page.click('#btnHide');
        await page.waitForTimeout(400);
        const vis = await visibleOf('sclera');
        ck('Ausblenden', vis === false, 'Sklera unsichtbar', vis ? 'sichtbar' : 'unsichtbar', await shot('hide'));
        ck('Ausblenden schließt Sheet', !(await sheetOpen('infoSheet')), 'Sheet zu', (await sheetOpen('infoSheet')) ? 'offen' : 'zu');
        await page.click('#btnList'); await page.waitForTimeout(300);
        await page.click('#btnShowAll2'); await page.waitForTimeout(300);
        const back = await visibleOf('sclera');
        ck('Alle zeigen (Liste)', back === true, 'Sklera wieder sichtbar', back ? 'sichtbar' : 'unsichtbar');
        await page.click('#listClose'); await page.waitForTimeout(300);
      });

      // 5. Teile-Liste: Teil wählen, Sichtbarkeits-Schalter
      await run('Teile-Liste', async () => {
        await page.click('#btnList'); await page.waitForTimeout(400);
        const listOpen = await page.evaluate(() => document.getElementById('listSheet').classList.contains('open'));
        const count = await page.textContent('#listCount');
        const items = await page.evaluate(() => document.querySelectorAll('#listBody button.nm').length);
        ck('Teile-Liste öffnet', listOpen && items > 30, '> 30 Einträge', `${items} Einträge, „${count}“`, await shot('list'));
        await page.click('#listBody button[data-pick="rectus_superior"]'); await page.waitForTimeout(900);
        const s = await page.evaluate(readSheet, 'rectus_superior');
        ck('Liste wählt Teil', (await sheetOpen('infoSheet')) && s.la === s.expLa, s.expLa, s.la, await shot('list-pick'));
        await closeInfo();
        await page.click('#btnList'); await page.waitForTimeout(300);
        await page.click('#listBody button[data-vis="iris"]'); await page.waitForTimeout(300);
        const off = await visibleOf('iris');
        ck('Sichtbarkeit aus (Liste)', off === false, 'Iris unsichtbar', off ? 'sichtbar' : 'unsichtbar');
        await page.click('#listBody button[data-vis="iris"]'); await page.waitForTimeout(300);
        const on = await visibleOf('iris');
        ck('Sichtbarkeit ein (Liste)', on === true, 'Iris sichtbar', on ? 'sichtbar' : 'unsichtbar');
        await page.click('#listClose'); await page.waitForTimeout(300);
      });

      // 6. Ansichts-Chips
      for (const [view, spec] of Object.entries(VIEW_DIRS)) {
        await run(`Ansicht ${view}`, async () => {
          await page.click(`[data-view="${view}"]`);
          await page.waitForTimeout(900);
          const d = await camDir();
          ck(`Ansicht ${view}`, spec.test({ x: d[0], y: d[1], z: d[2] }), spec.dir.join(','), d.map((v) => v.toFixed(2)).join(','), await shot(`view-${view}`));
        });
      }

      // 7. Zurücksetzen
      await run('Zurücksetzen', async () => {
        await page.click('#btnReset'); await page.waitForTimeout(900);
        const d = await camDir();
        const h = [0.55, 0.32, 1], n = Math.hypot(...h);
        const dot = (d[0] * h[0] + d[1] * h[1] + d[2] * h[2]) / n;
        ck('Zurücksetzen', dot > 0.98, 'Home-Richtung', d.map((v) => v.toFixed(2)).join(','));
      });

      // 8. Beschriftung an/aus
      await run('Beschriftung', async () => {
        const cnt = () => page.evaluate(() => [...document.querySelectorAll('#labels .lbl')].filter((e) => e.style.display === 'block').length);
        await page.click('#btnLabels'); await page.waitForTimeout(300);
        const pressed0 = await page.getAttribute('#btnLabels', 'aria-pressed');
        const off = await cnt();
        ck('Beschriftung aus', pressed0 === 'false' && off === 0, '0 Labels, aria-pressed=false', `${off} Labels, aria-pressed=${pressed0}`);
        await page.click('#btnLabels'); await page.waitForTimeout(300);
        const pressed1 = await page.getAttribute('#btnLabels', 'aria-pressed');
        const again = await cnt();
        ck('Beschriftung an', pressed1 === 'true' && again > 0, 'Labels > 0, aria-pressed=true', `${again} Labels, aria-pressed=${pressed1}`, await shot('labels'));
      });

      // 9. Explosion 100 %: Modell im Bild? Verdeckt das Sheet es?
      await run('Explosion 100 %', async () => {
        await page.evaluate(() => { const el = document.getElementById('explo'); el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); });
        await page.waitForTimeout(1500);
        const cov0 = await page.evaluate(modelCoverage);
        ck('Explosion 100 % passt ins Bild', cov0.outPct === 0, '0 % der Scheitel außerhalb', `${cov0.outPct} % außerhalb`, await shot('explo100'));
        const hit = await page.evaluate(findTapPoint, 'sclera');
        if (hit.x !== null) await tap(hit.x, hit.y);
        await page.waitForTimeout(500);
        const cov1 = await page.evaluate(modelCoverage);
        ck('Info-Sheet verdeckt bei 100 % wenig', cov1.sheetCoverPct < 25, '< 25 % des Modells unter dem Sheet', `${cov1.sheetCoverPct} % (Sheet-Oberkante ${cov1.sheetTop}px)`, await shot('explo100-sheet'));
        await closeInfo();
        await page.evaluate(() => { const el = document.getElementById('explo'); el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      });

      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (cdnFallbacks.size) console.log(`Hinweis: CDN nicht erreichbar, three.js lokal geliefert (${cdnFallbacks.size} Datei(en)).`);
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\nErgebnis: ${checks.length - failed} OK, ${failed} FAIL.`);
  if (problems.length) {
    console.log(`\nProbleme (${problems.length}):`);
    for (const p of problems) console.log(`  ${p}`);
    process.exitCode = 1;
  } else {
    console.log('\nKeine Konsolenfehler, Seitenfehler oder fehlgeschlagene Requests.');
  }
}

main().catch((err) => {
  console.error('Interaktions-Test abgebrochen:', err);
  process.exit(1);
});
