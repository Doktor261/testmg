/* App: Renderer, Kamera, Steuerung (render-on-demand). */
window.EYE = window.EYE || {};
(function () {
  'use strict';
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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

  resize();
  applyBg();
  EYE.setView('home');
  request();
})();
