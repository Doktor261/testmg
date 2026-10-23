/* Phase 1: Gerüst – Renderer, Kamera, Steuerung, Testwürfel */
window.EYE = window.EYE || {};
(function () {
  'use strict';
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 1000);
  camera.position.set(60, 40, 90);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.minDistance = 25;
  controls.maxDistance = 180;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(40, 60, 80);
  scene.add(key);

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(24, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0x1f6fb2 })
  );
  scene.add(cube);

  function bgColor() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    return new THREE.Color(v || '#eef1f4');
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();
  renderer.setClearColor(bgColor());

  function loop() {
    cube.rotation.y += 0.01;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();
})();
