/* App: Renderer, Kamera, Steuerung (render-on-demand). */
window.EYE = window.EYE || {};
(function () {
  'use strict';
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
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
  controls.maxDistance = 180;
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
    request();
  }
  function applyBg() { renderer.setClearColor(bgColor()); request(); }
  window.addEventListener('resize', resize);
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
  EYE.setView = function (name, dist) {
    const v = EYE.views[name] || EYE.views.home;
    const d = new THREE.Vector3(...v.dir).normalize();
    controls.target.set(0, 0, EYE.viewCenterZ || 0);
    camera.up.set(...v.up);
    camera.position.copy(controls.target).addScaledVector(d, dist || EYE.viewDistance());
    camera.lookAt(controls.target);
    controls.update();
    request();
  };
  EYE.viewDistance = function () {
    const aspect = camera.aspect || 1;
    const fov = camera.fov * Math.PI / 180;
    const half = (EYE.viewRadius || 24);
    const dv = half / Math.tan(fov / 2);
    const dh = half / (Math.tan(fov / 2) * aspect);
    return Math.max(dv, dh) * 1.05;
  };

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
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    EYE.viewRadius = 22 + 20 * t;
    EYE.viewCenterZ = -6 - 2 * t;
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
    if (!anim) return;
    const f = Math.min(1, (performance.now() - anim.t0) / anim.dur);
    EYE.setExplosion(anim.from + (anim.target - anim.from) * smooth(f));
    if (f >= 1) { anim = null; EYE.animating = false; }
  };
  const slider = document.getElementById('explo');
  slider.addEventListener('input', () => { anim = null; EYE.animating = false; EYE.setExplosion(slider.value / 100); });
  document.getElementById('btnTogether').addEventListener('click', () => EYE.animateTo(0));
  document.getElementById('btnExploded').addEventListener('click', () => EYE.animateTo(1));

  resize();
  applyBg();
  EYE.setExplosion(0);
  EYE.setView('home');
  request();
})();
