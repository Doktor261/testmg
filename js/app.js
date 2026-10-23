/* App: Renderer, Kamera, Steuerung (render-on-demand). */
window.EYE = window.EYE || {};
(function () {
  'use strict';
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 1000);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 25;
  controls.maxDistance = 400;                      // Fit im Hochformat liegt bei ≈ 220 mm (100 %)
  controls.screenSpacePanning = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7785, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(60, 80, 100);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd4ff, 0.45);
  rim.position.set(-80, -30, -90);
  scene.add(rim);

  EYE.scene = scene; EYE.camera = camera; EYE.controls = controls; EYE.renderer = renderer;
  EYE.build(scene);
  Object.keys(EYE.meshesByPart).forEach((id) => {
    if (EYE.partById[id].hidden) EYE.meshesByPart[id].forEach((m) => { m.visible = false; });
  });

  // ---------- Render-on-demand ----------
  let dirty = true, raf = 0;
  function frame() {
    raf = 0;
    const moved = controls.update();
    if (EYE.onFrame) EYE.onFrame();
    if (moved || dirty) { dirty = false; renderer.render(scene, camera); }
    if (moved || EYE.animating) raf = requestAnimationFrame(frame);
  }
  function request() { dirty = true; if (!raf) raf = requestAnimationFrame(frame); }
  EYE.request = request;
  controls.addEventListener('change', request);

  function bgColor() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    return new THREE.Color(v || '#eef1f4');
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyViewOffset();
    request();
  }
  function applyBg() { renderer.setClearColor(bgColor()); request(); }
  // Nach Größen-/Drehänderung (entprellt) neu fitten; der Nutzer-Zoom bleibt als Verhältnis zum Fit erhalten
  let refitTimer = 0;
  window.addEventListener('resize', () => {
    resize();
    clearTimeout(refitTimer);
    refitTimer = setTimeout(() => {
      if (!EYE.camReady || cam || !EYE.lastFit) return;
      const camVec = camera.position.clone().sub(controls.target), dist = camVec.length();
      if (dist < 1e-6) return;
      const dir = camVec.normalize(), oldFit = EYE.lastFit;
      camera.position.copy(controls.target).addScaledVector(dir, dist * EYE.viewDistance(dir) / oldFit);
      request();
    }, 150);
  });
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (mq && mq.addEventListener) mq.addEventListener('change', applyBg);
  EYE.applyBg = applyBg;

  // ---------- Ansichten ----------
  // Rechtes Auge: Frontal = Blick von vorn (+Z) auf die Hornhaut, Lateral = von temporal (+X)
  EYE.views = {
    front: { dir: [0, 0, 1], up: [0, 1, 0] },
    lateral: { dir: [-1, 0, 0], up: [0, 1, 0] },   // temporale Seite des rechten Auges
    superior: { dir: [0, 1, 0], up: [0, 0, -1] },
    posterior: { dir: [0, 0, -1], up: [0, 1, 0] },
    home: { dir: [0.55, 0.32, 1], up: [0, 1, 0] }
  };
  EYE.setView = function (name, dist, instant) {
    const v = EYE.views[name] || EYE.views.home;
    const d = new THREE.Vector3(...v.dir).normalize();
    if (name === 'superior') d.z = 0.02;
    d.normalize();
    EYE.flyTo(new THREE.Vector3(0, 0, EYE.viewCenterZ || 0), d, dist || EYE.viewDistance(d), instant);
  };
  // Kamera animiert zu Ziel/Richtung/Abstand
  let cam = null;
  EYE.flyTo = function (target, dir, dist, instant) {
    const cur = camera.position.clone().sub(controls.target);
    const from = { t: controls.target.clone(), d: cur.clone().normalize(), r: cur.length() };
    const to = { t: target.clone(), d: dir.clone().normalize(), r: dist };
    if (instant || reduceMotion || !from.r) { applyCam(to, 1, from); return; }
    cam = { from, to, t0: performance.now(), dur: 550 };
    EYE.animating = true; request();
  };
  function applyCam(to, f, from) {
    const e = f * f * (3 - 2 * f);
    const t = from.t.clone().lerp(to.t, e);
    const d = from.d.clone().lerp(to.d, e).normalize();
    const r = from.r + (to.r - from.r) * e;
    camera.up.set(0, 1, 0);
    controls.target.copy(t);
    camera.position.copy(t).addScaledVector(d, r);
    camera.lookAt(t);
    controls.update();
    request();
  }
  EYE.stepCam = function () {
    if (!cam) return;
    const f = Math.min(1, (performance.now() - cam.t0) / cam.dur);
    applyCam(cam.to, f, cam.from);
    if (f >= 1) { cam = null; }
  };
  // freier Bereich zwischen Topbar und Chips/Explosionskarte
  function freeArea() {
    const H = canvas.clientHeight || 1;
    const top = document.getElementById('topbar').getBoundingClientRect().bottom;
    let bottom = H;                                   // Unterkante: Chips (Hochformat) und Explosionskarte (Querformat)
    ['chips', 'bottombar'].forEach((id) => {
      const e = document.getElementById(id);
      if (e && getComputedStyle(e).display !== 'none') bottom = Math.min(bottom, e.getBoundingClientRect().top);
    });
    return { H, top: Math.max(0, top), bottom: Math.max(top + 100, bottom) };
  }
  // Fit: kleinster Abstand, bei dem alle sichtbaren Teile im freien Bereich liegen.
  // Je Mesh werden höchstens FIT_MAX Scheitelpunkte gestreut (lokale Koordinaten), zur Laufzeit in Welt-Koordinaten transformiert.
  const FIT_MAX = 300, FIT_MARGIN = 0.94;          // 6 % Rand
  const fitCache = new Map();
  function fitSamples(m) {
    let s = fitCache.get(m);
    if (!s) {
      const pos = m.geometry && m.geometry.attributes.position;
      const stride = pos ? Math.max(1, Math.ceil(pos.count / FIT_MAX)) : 1, arr = [];
      for (let i = 0; pos && i < pos.count; i += stride) arr.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      s = new Float32Array(arr);
      fitCache.set(m, s);
    }
    return s;
  }
  const fitV = new THREE.Vector3(), fitM = new THREE.Matrix4();
  EYE.viewDistance = function (dir) {
    const T = new THREE.Vector3(0, 0, EYE.viewCenterZ || 0);
    const d = (dir ? dir.clone() : new THREE.Vector3(0.55, 0.32, 1)).normalize();
    const r = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();   // Bildrechts
    const u = new THREE.Vector3().crossVectors(d, r).normalize();                            // Bildoben
    const f = freeArea(), tan0 = Math.tan(camera.fov * Math.PI / 360) * FIT_MARGIN;
    const kV = tan0 * (f.bottom - f.top) / f.H;       // vertikal nur der freie Bereich (Ansicht ist dorthin verschoben)
    const kH = tan0 * (camera.aspect || 1);           // horizontal die volle Breite
    let D = 0, n = 0;
    EYE.root.updateMatrix();                          // Wurzel ist gespiegelt (scale.x = −1)
    allMeshes.forEach((m) => {
      if (!m.visible) return;
      m.updateMatrix();
      fitM.multiplyMatrices(EYE.root.matrix, m.matrix);
      const s = fitSamples(m);
      for (let i = 0; i < s.length; i += 3) {
        fitV.set(s[i], s[i + 1], s[i + 2]).applyMatrix4(fitM).sub(T);
        const c = fitV.dot(d), h = Math.abs(fitV.dot(r)), v = Math.abs(fitV.dot(u));
        D = Math.max(D, c + h / kH, c + v / kV);
        n++;
      }
    });
    EYE.lastFit = n ? D : 60;                         // Fit der zuletzt platzierten Kamera (Basis für Refit)
    return EYE.lastFit;
  };
  function applyViewOffset() {
    const w = canvas.clientWidth, f = freeArea();
    camera.setViewOffset(w, f.H, 0, (f.H - f.top - f.bottom) / 2, w, f.H);
  }

  // ---------- Umgebungsreflexion (prozedural) ----------
  try {
    const ec = document.createElement('canvas'); ec.width = 256; ec.height = 128;
    const g = ec.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#cfd8e0'); gr.addColorStop(1, '#6d7680');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#ffffff'; g.fillRect(40, 20, 50, 24); g.fillRect(170, 30, 40, 18);
    const et = new THREE.CanvasTexture(ec); et.encoding = THREE.sRGBEncoding;
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(et).texture;
    pm.dispose(); et.dispose();
  } catch (e) { /* Umgebung optional */ }

  // ---------- Explosion ----------
  const PB = EYE.partById;
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const SPAN = 0.38;
  function local(e, t) {
    const start = (e.phase === 2 ? 0.5 : 0) + (e.delay || 0);
    return smooth((t - start) / SPAN);
  }
  const allMeshes = [];
  Object.keys(EYE.meshesByPart).forEach((id) => EYE.meshesByPart[id].forEach((m) => {
    m.userData.basePos = m.position.clone();
    allMeshes.push(m);
  }));
  EYE.t = 0;
  EYE.setExplosion = function (t) {
    t = Math.max(0, Math.min(1, t));
    EYE.t = t;
    // Nutzer-Zoom = Verhältnis Abstand zu Fit; es bleibt beim Umstellen erhalten
    const oldZ = EYE.viewCenterZ === undefined ? -6 : EYE.viewCenterZ;
    const camVec = camera.position.clone().sub(controls.target), dist = camVec.length();
    const dir = dist > 1e-6 ? camVec.clone().normalize() : null;
    const oldD = EYE.viewDistance(dir);
    allMeshes.forEach((m) => {
      const part = PB[m.userData.partId];
      if (!part || !part.explode) return;
      const src = (m.userData.follow && PB[m.userData.follow]) ? PB[m.userData.follow] : part;
      const e = src.explode;
      const sign = e.split ? (m.userData.half === 'lower' ? -1 : 1) : 1;
      const k = local(e, t) * sign;
      const v = e.vec || [0, 0, 0];
      m.position.set(m.userData.basePos.x + v[0] * k, m.userData.basePos.y + v[1] * k, m.userData.basePos.z + v[2] * k);
      if (e.extra && e.extra.vec) {
        const k2 = local({ phase: e.extra.phase, delay: e.delay }, t);
        m.position.x += e.extra.vec[0] * k2; m.position.y += e.extra.vec[1] * k2; m.position.z += e.extra.vec[2] * k2;
      }
    });
    EYE.viewCenterZ = -6 - 2 * t;
    if (EYE.camReady && !cam) {
      controls.target.z += EYE.viewCenterZ - oldZ;
      if (dir) camera.position.copy(controls.target).addScaledVector(dir, dist * EYE.viewDistance(dir) / oldD);
    }
    const el = document.getElementById('exploVal');
    if (el) el.textContent = Math.round(t * 100) + ' %';
    const sl = document.getElementById('explo');
    if (sl && +sl.value !== Math.round(t * 100)) sl.value = Math.round(t * 100);
    if (EYE.onExplosion) EYE.onExplosion(t);
    request();
  };
  let anim = null;
  EYE.animateTo = function (target) {
    if (reduceMotion) { EYE.setExplosion(target); return; }
    const from = EYE.t, t0 = performance.now(), dur = 1200 * Math.max(0.25, Math.abs(target - from));
    anim = { from, target, t0, dur };
    EYE.animating = true; request();
  };
  EYE.onFrame = function () {
    EYE.stepCam();
    if (anim) {
      const f = Math.min(1, (performance.now() - anim.t0) / anim.dur);
      EYE.setExplosion(anim.from + (anim.target - anim.from) * smooth(f));
      if (f >= 1) anim = null;
    }
    EYE.animating = !!(anim || (cam && true));
    if (EYE.labelsTick) EYE.labelsTick();
  };
  const slider = document.getElementById('explo');
  slider.addEventListener('input', () => { anim = null; EYE.animating = false; EYE.setExplosion(slider.value / 100); });
  document.getElementById('btnTogether').addEventListener('click', () => EYE.animateTo(0));
  document.getElementById('btnExploded').addEventListener('click', () => EYE.animateTo(1));

  // ---------- Inhalte (content.js) in die Teile übernehmen ----------
  Object.keys(PB).forEach((id) => {
    const c = EYE.CONTENT && EYE.CONTENT[id];
    if (!c) return;
    PB[id].text = c.text || PB[id].text;
    PB[id].facts = c.facts || PB[id].facts;
    PB[id].clinic = c.clinic || PB[id].clinic;
    PB[id].extra = c.extra || null;
  });

  // ---------- Sichtbarkeit / Isolieren ----------
  const hiddenSet = new Set(Object.keys(PB).filter((id) => PB[id].hidden));
  let isolated = null, selected = null;
  const $ = (id) => document.getElementById(id);
  const matsOf = (id) => {
    const set = new Set();
    (EYE.meshesByPart[id] || []).forEach((m) => set.add(m.material));
    return Array.from(set);
  };
  EYE.applyVisibility = function () {
    Object.keys(EYE.meshesByPart).forEach((id) => {
      const ghost = isolated && isolated !== id;
      const vis = !hiddenSet.has(id);
      EYE.meshesByPart[id].forEach((m) => {
        m.visible = vis;
        m.userData.pickable = vis && !ghost;
        const mat = m.material, base = PB[id].opacity;
        if (mat.userData.baseOpacity === undefined) mat.userData.baseOpacity = base;
        const tbase = mat.userData.baseOpacity;
        const wantT = ghost || tbase < 1;
        const wantO = ghost ? Math.min(0.08, tbase) : tbase;
        if (mat.transparent !== wantT) { mat.transparent = wantT; mat.needsUpdate = true; }
        mat.opacity = wantO;
        mat.depthWrite = !wantT;
      });
    });
    renderList();
    request();
  };

  // ---------- Hervorhebung ----------
  const HL = new THREE.Color(0x2f86d6);
  function highlight(id, on) {
    matsOf(id).forEach((m) => {
      if (m.emissive) { m.emissive.copy(on ? HL : (m.userData.baseEmissive || new THREE.Color(0))); m.emissiveIntensity = on ? 0.55 : 1; }
      else if (m.color) { if (on) { m.userData.c0 = m.color.clone(); m.color.copy(HL); } else if (m.userData.c0) m.color.copy(m.userData.c0); }
    });
  }

  // ---------- Info-Sheet ----------
  const infoSheet = $('infoSheet'), listSheet = $('listSheet');
  function esc(t) { return String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  function showInfo(id) {
    const p = PB[id], g = EYE.GROUPS[p.group];
    $('infoGrp').textContent = g ? g.name : '';
    $('infoLa').textContent = p.la;
    $('infoDe').textContent = p.de;
    let h = '';
    if (p.text) h += '<p>' + esc(p.text) + '</p>';
    if (p.facts && p.facts.length) h += '<ul>' + p.facts.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>';
    if (p.clinic) h += '<p class="clinic"><b>Klinik:</b> ' + esc(p.clinic) + '</p>';
    if (!h) h = '<p>Beschreibung folgt.</p>';
    $('infoBody').innerHTML = h;
    $('infoBody').scrollTop = 0;
    $('btnIsolate').textContent = isolated === id ? 'Isolierung aufheben' : 'Isolieren';
    listSheet.classList.remove('open');
    infoSheet.classList.add('open');
  }
  function closeInfo() { infoSheet.classList.remove('open'); }
  EYE.select = function (id, opts) {
    opts = opts || {};
    if (selected) highlight(selected, false);
    selected = id;
    if (!id) { closeInfo(); updateLabelsSoon(); renderList(); request(); return; }
    highlight(id, true);
    if (hiddenSet.has(id)) { hiddenSet.delete(id); EYE.applyVisibility(); }
    showInfo(id);
    if (opts.fly) flyToPart(id);
    anchorSel = opts.point || null;
    updateLabelsSoon(); renderList(); request();
  };
  $('infoClose').addEventListener('click', () => EYE.select(null));
  $('btnIsolate').addEventListener('click', () => {
    if (!selected) return;
    isolated = isolated === selected ? null : selected;
    $('btnIsolate').textContent = isolated ? 'Isolierung aufheben' : 'Isolieren';
    EYE.applyVisibility();
  });
  $('btnHide').addEventListener('click', () => {
    if (!selected) return;
    hiddenSet.add(selected);
    const id = selected;
    EYE.select(null);
    EYE.applyVisibility();
  });
  function showAll() {
    isolated = null; hiddenSet.clear();
    Object.keys(PB).forEach((id) => { if (PB[id].hidden && id !== selected) hiddenSet.add(id); });
    EYE.applyVisibility();
    if (selected) $('btnIsolate').textContent = 'Isolieren';
  }
  $('btnShowAll').addEventListener('click', showAll);
  $('btnShowAll2').addEventListener('click', showAll);
  // Wischen nach unten schließt die Sheets
  function swipeClose(grab, close) {
    let y0 = null;
    grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointerup', (e) => { if (y0 !== null && e.clientY - y0 > 40) close(); y0 = null; });
    grab.addEventListener('click', close);
  }
  swipeClose($('infoGrab'), () => EYE.select(null));
  swipeClose($('listGrab'), () => listSheet.classList.remove('open'));

  // ---------- Picking ----------
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.25;
  const LOW = { corpus_vitreum: 1, camera_anterior: 2, camera_posterior: 2 };
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, id: e.pointerId, n: (down && down.n) ? down.n + 1 : 1 }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > 6) return;
    pick(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointercancel', () => { down = null; });
  function pick(cx, cy) {
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    const targets = allMeshes.filter((m) => m.visible && m.userData.pickable !== false);
    const hits = raycaster.intersectObjects(targets, false);
    let hit = hits.find((h) => !LOW[h.object.userData.partId]);
    if (!hit) hit = hits[0];
    if (!hit) { EYE.select(null); return; }
    const id = hit.object.userData.partId;
    EYE.select(id, { point: { mesh: hit.object, local: hit.object.worldToLocal(hit.point.clone()) } });
  }

  // ---------- Teile-Liste ----------
  function renderList() {
    const body = $('listBody');
    if (!body || !EYE.GROUPS) return;
    let h = '';
    Object.keys(EYE.GROUPS).forEach((gid) => {
      const items = EYE.PARTS.filter((p) => p.group === gid && EYE.meshesByPart[p.id]);
      if (!items.length) return;
      h += '<div class="group"><h3>' + esc(EYE.GROUPS[gid].name) + '</h3>';
      items.forEach((p) => {
        const off = hiddenSet.has(p.id);
        h += '<div class="item' + (selected === p.id ? ' sel' : '') + (off ? ' off' : '') + '">' +
          '<button class="nm" data-pick="' + p.id + '">' + esc(p.la) + '<small>' + esc(p.de) + '</small></button>' +
          '<button class="eye" data-vis="' + p.id + '" aria-label="' + esc(p.la) + (off ? ' einblenden' : ' ausblenden') + '">' + (off ? '○' : '●') + '</button></div>';
      });
      h += '</div>';
    });
    body.innerHTML = h;
    $('listCount').textContent = EYE.PARTS.filter((p) => EYE.meshesByPart[p.id]).length + ' Teile';
  }
  $('listBody').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.pick) { EYE.select(b.dataset.pick, { fly: true }); }
    else if (b.dataset.vis) {
      const id = b.dataset.vis;
      if (hiddenSet.has(id)) hiddenSet.delete(id); else hiddenSet.add(id);
      EYE.applyVisibility(); updateLabelsSoon();
    }
  });
  $('btnList').addEventListener('click', () => {
    infoSheet.classList.remove('open');
    listSheet.classList.toggle('open');
  });
  $('listClose').addEventListener('click', () => listSheet.classList.remove('open'));

  // ---------- Kamera auf Teil ----------
  function partCenter(id) {
    const b = new THREE.Box3();
    (EYE.meshesByPart[id] || []).forEach((m) => {
      if (m.geometry && !m.geometry.boundingBox) m.geometry.computeBoundingBox();
      if (m.geometry && m.geometry.boundingBox) { m.updateWorldMatrix(true, false); b.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); }
    });
    return b;
  }
  function flyToPart(id) {
    const b = partCenter(id);
    if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3()).length();
    const dir = camera.position.clone().sub(controls.target).normalize();
    EYE.flyTo(c, dir, Math.min(150, Math.max(32, size * 1.6)));
  }

  // ---------- Ansichten, Zurücksetzen ----------
  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), (b) => b.addEventListener('click', () => EYE.setView(b.dataset.view)));
  $('btnReset').addEventListener('click', () => EYE.setView('home'));

  // ---------- Beschriftungen ----------
  const LABELS = {
    cornea: { p: [2.4, 2.4, 12.1] }, iris: { p: [-3.3, 3.3, 9.95] }, lens_cortex: { p: [0.8, 0.8, 9.45] },
    sclera: { p: [-8.5, -7.0, 4.5], half: 'lower' }, choroidea: { p: [4, -8.4, -6.5], half: 'lower' },
    retina: { p: [-4, -7.4, -5.9], half: 'lower' }, corpus_vitreum: { p: [3, 2, -2] },
    corpus_ciliare: { p: [0, -7.0, 8.35] }, discus_nervi_optici: { p: [-3.0, 0.3, -10.05] },
    macula: { p: [1.2, -0.4, -10.3] }, n_opticus: { p: [-7.5, 0.8, -22] }, rectus_superior: { path: 70 }
  };
  const labelsEl = $('labels'), leader = $('leader'), btnLabels = $('btnLabels');
  let labelsOn = true, anchorSel = null;
  try { if (localStorage.getItem('auge3d.labels') === '0') labelsOn = false; } catch (e) { /* optional */ }
  btnLabels.setAttribute('aria-pressed', String(labelsOn));
  btnLabels.addEventListener('click', () => {
    labelsOn = !labelsOn;
    btnLabels.setAttribute('aria-pressed', String(labelsOn));
    try { localStorage.setItem('auge3d.labels', labelsOn ? '1' : '0'); } catch (e) { /* optional */ }
    updateLabelsSoon();
  });
  const labelEls = {};
  function labelEl(id) {
    if (!labelEls[id]) {
      const d = document.createElement('div');
      d.className = 'lbl'; d.textContent = PB[id].la.replace(/\s*\(.*\)/, '');
      labelsEl.appendChild(d);
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      leader.appendChild(ln);
      labelEls[id] = { d, ln, w: 0 };
    }
    return labelEls[id];
  }
  function anchorWorld(id) {
    const ms = EYE.meshesByPart[id];
    if (!ms || !ms.length) return null;
    if (id === selected && anchorSel && anchorSel.mesh.userData.partId === id) {
      return anchorSel.mesh.localToWorld(anchorSel.local.clone());
    }
    const L = LABELS[id];
    if (L && L.p) {
      const m = ms.find((x) => !L.half || x.userData.half === L.half) || ms[0];
      return EYE.root.localToWorld(new THREE.Vector3(...L.p).add(m.position).sub(m.userData.basePos || m.position));
    }
    // Pfad-/Mesh-Anker: Mittelpunkt des größten Meshes (nahe der Betrachtung)
    const b = partCenter(id);
    if (b.isEmpty()) return null;
    if (L && L.path && EYE.insertion[id]) {
      const pp = EYE.insertion[id].path[L.path];
      return EYE.root.localToWorld(pp.clone().add(ms[0].position));
    }
    return b.getCenter(new THREE.Vector3());
  }
  let labelsDirty = true;
  function updateLabelsSoon() { labelsDirty = true; request(); }
  EYE.updateLabels = updateLabelsSoon;
  const occRay = new THREE.Raycaster();
  function occluded(id, w) {
    const dir = w.clone().sub(camera.position), dist = dir.length();
    occRay.set(camera.position, dir.normalize());
    occRay.far = dist - 0.3;
    const occ = allMeshes.filter((m) => m.visible && m.userData.partId !== id && m.userData.pickable !== false && m.material.opacity > 0.9 && !m.isLineSegments);
    return occRay.intersectObjects(occ, false).length > 0;
  }
  let lastLabelState = '';
  EYE.labelsTick = function () {
    const vw = canvas.clientWidth, vh = canvas.clientHeight;
    const narrow = vw < 700;
    let ids = [];
    if (labelsOn) ids = selected ? [selected] : Object.keys(LABELS).filter((id) => !hiddenSet.has(id) && (!isolated || isolated === id));
    else if (selected) ids = [selected];
    // nur neu berechnen, wenn sich Kamera/Explosion geändert hat
    const state = [camera.position.x.toFixed(2), camera.position.y.toFixed(2), camera.position.z.toFixed(2), EYE.t.toFixed(3), ids.join(','), vw, vh, controls.target.x.toFixed(1)].join('|');
    if (!labelsDirty && state === lastLabelState) return;
    labelsDirty = false; lastLabelState = state;
    Object.keys(labelEls).forEach((id) => { labelEls[id].d.style.display = 'none'; labelEls[id].ln.style.display = 'none'; });
    EYE.root.updateMatrixWorld(true);
    const items = [];
    ids.forEach((id) => {
      const w = anchorWorld(id);
      if (!w) return;
      const pr = w.clone().project(camera);
      if (pr.z > 1 || Math.abs(pr.x) > 1 || Math.abs(pr.y) > 1) return;
      if (occluded(id, w)) return;
      items.push({ id, x: (pr.x + 1) / 2 * vw, y: (1 - pr.y) / 2 * vh });
    });
    items.sort((a, b) => a.y - b.y);
    const side = { l: [], r: [] };
    items.forEach((it) => (it.x < vw / 2 ? side.l : side.r).push(it));
    ['l', 'r'].forEach((k) => {
      let last = -1e9;
      side[k].forEach((it) => {
        const e = labelEl(it.id);
        e.d.style.display = 'block';
        e.d.classList.toggle('sel', it.id === selected);
        const w = e.d.offsetWidth, h = e.d.offsetHeight || 20;
        let ly = Math.max(70, it.y - h / 2);
        if (ly < last + h + 3) ly = last + h + 3;
        last = ly;
        const lx = k === 'l' ? 6 : vw - w - 6;
        e.d.style.transform = 'translate(' + lx + 'px,' + ly + 'px)';
        e.ln.style.display = 'block';
        e.ln.setAttribute('x1', k === 'l' ? lx + w : lx); e.ln.setAttribute('y1', ly + h / 2);
        e.ln.setAttribute('x2', it.x); e.ln.setAttribute('y2', it.y);
      });
    });
  };
  new MutationObserver(applyBg).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  renderList();
  EYE.applyVisibility();

  resize();
  applyBg();
  EYE.setExplosion(0);
  EYE.setView('home', 0, true);
  EYE.camReady = true;
  request();
})();
