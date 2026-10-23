// Prozedurale Canvas-Texturen und UV-Helfer für das Auge (klassisches Script, globales THREE).
// Koordinaten wie in PLAN.md Abschnitt 3: +Z anterior, +Y superior, +X temporal (rechtes Auge).
// Iris und Fundus werden mit flipY = false erzeugt: Zeile 0 im Bild entspricht v = 0
// (oben = Pupillenrand bzw. hinterer Pol).
window.EYE = window.EYE || {};

EYE.textures = (function () {
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  // ---------- kleine Helfer ----------

  // Deterministischer Zufall (mulberry32), damit jede Ansicht gleich aussieht.
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function makeTexture(cv, opts) {
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.flipY = opts.flipY !== false;
    if (opts.wrapS) tex.wrapS = THREE.RepeatWrapping;
    if (opts.wrapT) tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Zeichnet fn einmal pro Kopie um ±W verschoben, damit Elemente über den
  // linken/rechten Rand der Abwicklung nahtlos weiterlaufen.
  function wrapX(ctx, W, fn) {
    for (const ox of [-W, 0, W]) {
      ctx.save();
      ctx.translate(ox, 0);
      fn();
      ctx.restore();
    }
  }

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smoothstep = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a + (b - a) * t;

  // Hash-Rauschen pro Pixel (Werte 0..1)
  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // ---------- Iris ----------

  // Polarabwicklung: x = Winkel (nahtlos), y = Radius (oben Pupillenrand, unten Irisbasis).
  function iris() {
    const W = 1024;
    const H = 512;
    const cv = canvas(W, H);
    const ctx = cv.getContext('2d');
    const rnd = rng(7);

    // Grundfarbe: braun zur Pupille, grünlich-braun zum Rand
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#4a2e14');
    g.addColorStop(0.35, '#8a6a34');
    g.addColorStop(1, '#5d7440');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Krause (Collarette) bei ≈ 30 % des Radius (r ≈ 3,0 mm bei 1,75–6 mm), wellig mit ganzzahligen Perioden (nahtlos)
    const collY = (x) => {
      const a = (x / W) * TAU;
      return H * 0.3 + 7 * Math.sin(a * 18) + 3.5 * Math.sin(a * 41 + 1.3);
    };
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    for (let x = W; x >= 0; x -= 2) ctx.lineTo(x, collY(x));
    ctx.closePath();
    ctx.fillStyle = 'rgba(210,170,96,0.18)';
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      if (x === 0) ctx.moveTo(x, collY(x));
      else ctx.lineTo(x, collY(x));
    }
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(240,212,150,0.8)';
    ctx.stroke();
    ctx.translate(0, 2.5);
    ctx.strokeStyle = 'rgba(40,25,10,0.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Dunkler Pupillarsaum am oberen Rand
    const sg = ctx.createLinearGradient(0, 0, 0, H * 0.08);
    sg.addColorStop(0, 'rgba(12,8,4,0.95)');
    sg.addColorStop(1, 'rgba(12,8,4,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H * 0.08);

    // Radiale Trabekel (Striae): Streifen in Richtung des Radius
    for (let i = 0; i < 520; i++) {
      const x = rnd() * W;
      const y0 = H * (0.08 + rnd() * 0.2);
      const y1 = H * (0.5 + rnd() * 0.5);
      const dx = (rnd() - 0.5) * 3;
      const light = rnd() < 0.5;
      ctx.strokeStyle = light
        ? 'rgba(226,190,120,' + (0.12 + rnd() * 0.2).toFixed(3) + ')'
        : 'rgba(30,18,8,' + (0.15 + rnd() * 0.25).toFixed(3) + ')';
      ctx.lineWidth = 0.6 + rnd() * 2;
      wrapX(ctx, W, () => {
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x + dx, y1);
        ctx.stroke();
      });
    }

    // Kontraktionsfurchen im Ziliarteil (äußeres Drittel): konzentrische Wellenlinien.
    // Ganzzahlige Perioden über die Breite halten die Naht geschlossen.
    for (let k = 0; k < 6; k++) {
      const y0 = H * (0.6 + k * 0.06);
      const amp = 2 + rnd() * 2;
      const periods = 14 + k * 3;
      const phase = rnd() * TAU;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const yy = y0 + amp * Math.sin((x / W) * TAU * periods + phase);
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = 'rgba(25,15,6,0.4)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // heller Rand unterhalb der Furche
      ctx.save();
      ctx.translate(0, 2);
      ctx.strokeStyle = 'rgba(240,210,150,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Krypten: dunkle Vertiefungen im äußeren Irisdrittel, mit hellem Rand
    for (let i = 0; i < 140; i++) {
      const x = rnd() * W;
      const y = H * (0.5 + rnd() * 0.42);
      const rx = 4 + rnd() * 9;
      const ry = 2.5 + rnd() * 4;
      wrapX(ctx, W, () => {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
        ctx.fillStyle = 'rgba(16,9,4,0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(230,190,120,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Pigmentflecke: dunkle und helle, etwas größere Punkte
    for (let i = 0; i < 140; i++) {
      const x = rnd() * W;
      const y = H * (0.1 + rnd() * 0.85);
      const rr = 1.5 + rnd() * 3.5;
      const dark = rnd() < 0.6;
      wrapX(ctx, W, () => {
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, TAU);
        ctx.fillStyle = dark ? 'rgba(60,38,16,0.35)' : 'rgba(225,185,110,0.25)';
        ctx.fill();
      });
    }

    // Pigmentpunkte und feines Stromarauschen
    for (let i = 0; i < 1800; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      ctx.fillStyle = rnd() < 0.5
        ? 'rgba(255,225,160,' + (0.03 + rnd() * 0.06).toFixed(3) + ')'
        : 'rgba(20,12,4,' + (0.04 + rnd() * 0.08).toFixed(3) + ')';
      wrapX(ctx, W, () => ctx.fillRect(x, y, 1 + rnd() * 1.5, 1));
    }

    // Dunkler, grünlicher Rand zur Irisbasis
    const bg = ctx.createLinearGradient(0, H * 0.9, 0, H);
    bg.addColorStop(0, 'rgba(40,60,30,0)');
    bg.addColorStop(1, 'rgba(40,60,30,0.4)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, H * 0.9, W, H * 0.1);

    return makeTexture(cv, { flipY: false, wrapS: true });
  }

  // ---------- Fundus (Retina) ----------

  // Abwicklung: x = φ (0 = temporal, π/2 = superior), y = θ / thetaMax
  // (θ = Winkel zum hinteren Pol (0, 0, −1), thetaMax ≈ 2.06 rad = Ora serrata).
  const FUNDUS = { W: 2048, H: 1024, thetaMax: 2.06 };
  const THMAX_DEG = FUNDUS.thetaMax / DEG;

  // Tangentialebene an den Richtungsvektor c (Gnomonische Projektion):
  // (u, v) in rad nahe der Mitte, Achsen: ey = superior, ex = senkrecht dazu.
  function frame(theta, phi) {
    const c = [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), -Math.cos(theta)];
    const k = c[1];
    let ey = [-k * c[0], 1 - k * c[1], -k * c[2]];
    const len = Math.hypot(ey[0], ey[1], ey[2]);
    ey = [ey[0] / len, ey[1] / len, ey[2] / len];
    const ex = [
      ey[1] * c[2] - ey[2] * c[1],
      ey[2] * c[0] - ey[0] * c[2],
      ey[0] * c[1] - ey[1] * c[0]
    ];
    return { c, ex, ey };
  }

  // Projiziert die Richtung d = (dx, dy, dz) auf die Tangentialebene von f.
  function tangent(f, dx, dy, dz, out) {
    const s = 1 / (dx * f.c[0] + dy * f.c[1] + dz * f.c[2]);
    const tx = dx * s - f.c[0];
    const ty = dy * s - f.c[1];
    const tz = dz * s - f.c[2];
    out[0] = tx * f.ex[0] + ty * f.ex[1] + tz * f.ex[2];
    out[1] = tx * f.ey[0] + ty * f.ey[1] + tz * f.ey[2];
    return out;
  }

  // Gefäßbögen in (θ°, φ°): Stützpunkte, Catmull-Rom-Interpolation in Winkelkoordinaten.
  // Die Bögen laufen um die Makula (≈ 14° Radius) herum und entspringen aus der Papille.
  const ARCADES = [
    { name: 'st', kind: 'artery', pts: [[19, 172], [24, 150], [30, 128], [36, 104], [38, 80], [36, 56], [31, 34], [25, 16], [22, 10]] },
    { name: 'it', kind: 'artery', pts: [[19, 188], [25, 208], [32, 234], [38, 262], [40, 290], [37, 314], [32, 334], [30, 338]] },
    { name: 'sn', kind: 'artery', pts: [[18, 176], [22, 160], [27, 146], [32, 132], [36, 122]] },
    { name: 'in', kind: 'artery', pts: [[18, 184], [23, 200], [29, 214], [34, 226], [38, 236]] }
  ];

  function catmull(pts, steps) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a, b, c, d) =>
          0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // Winkel (Grad) zwischen (θ, φ) und dem Zentrum der Makula
  const MACULA_DEG = { th: 6.2, ph: 342 };
  function angleToMacula(th, ph) {
    const a = th * DEG;
    const b = MACULA_DEG.th * DEG;
    const dph = (ph - MACULA_DEG.ph) * DEG;
    const c = Math.cos(a) * Math.cos(b) + Math.sin(a) * Math.sin(b) * Math.cos(dph);
    return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
  }

  // Zeichnet einen Pfad mit nach außen abnehmender Breite (Gefäß verjüngt sich)
  function strokeTapered(ctx, pts, w0, w1, color) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      ctx.lineWidth = w0 + (w1 - w0) * t;
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  // Winkel-Stützpunkte (θ°, φ°) → Canvas-Koordinaten
  function toCanvas(samples) {
    const { W, H } = FUNDUS;
    return samples.map(([th, ph]) => [
      ((((ph % 360) + 360) % 360) / 360) * W,
      (th / THMAX_DEG) * H
    ]);
  }

  // Gefäßbaum eines Bogens: Vene (dunkel, breiter, etwas außen) und Arterie (hell, schmal) plus Seitenäste
  function drawArcade(ctx, arcade, rnd) {
    const main = catmull(arcade.pts, 10);
    const veinMain = main.map(([th, ph]) => [th + 1.3, ph]);

    // Arterien und Venen bekommen getrennte Bäume; ihre Äste liegen an anderen Stellen,
    // daher kreuzen sich die Gefäße an einigen Stellen (Arterie wird über die Vene gezeichnet).
    const arteries = [{ pts: main, w: 2.6 }];
    growTree(main, 3, 2.6, rnd, arteries);
    const veins = [{ pts: veinMain, w: 4.2 }];
    growTree(veinMain, 3, 4.2, rnd, veins);

    for (const v of veins) strokeTapered(ctx, toCanvas(v.pts), v.w, v.w * 0.45, 'rgba(120,36,24,0.85)');
    for (const a of arteries) strokeTapered(ctx, toCanvas(a.pts), a.w, a.w * 0.35, 'rgba(240,140,108,0.95)');
  }

  // Verzweigungsbaum: bis zu drei Ebenen, nach außen kürzer und dünner.
  // Die Äste werden in (θ, φ)-Grad gezeichnet; Punkte nahe der Makula werden verworfen.
  const BRANCH_LEN = [0, 1.8, 3.2, 5.0]; // Länge je Ebene (1 = feinste) in Grad
  const BRANCH_STEPS = 10;

  function growTree(path, level, width, rnd, out) {
    if (level === 0) return;
    for (let i = 3 + Math.floor(rnd() * 3); i < path.length - 4; i += 6 + Math.floor(rnd() * 4)) {
      const [th, ph] = path[i];
      const [th2, ph2] = path[i + 1];
      const side = rnd() < 0.5 ? -1 : 1;
      let h = Math.atan2(ph2 - ph, th2 - th) + side * (0.45 + rnd() * 0.6);
      const len = BRANCH_LEN[level] * (0.8 + rnd() * 0.4);
      const pts = [[th, ph]];
      let t = th;
      let p = ph;
      for (let k = 1; k <= BRANCH_STEPS; k++) {
        h += (rnd() - 0.5) * 0.5;
        t += (Math.sin(h) * len) / BRANCH_STEPS;
        p += (Math.cos(h) * len) / BRANCH_STEPS;
        pts.push([t, p]);
      }
      // Makula bleibt gefäßfrei
      if (!pts.every((q) => angleToMacula(q[0], q[1]) > 16)) continue;
      out.push({ pts, w: width });
      growTree(pts, level - 1, width * 0.6, rnd, out);
    }
  }

  function fundus() {
    const { W, H, thetaMax } = FUNDUS;
    const cv = canvas(W, H);
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H);
    const px = img.data;

    // Strukturen als Tangentialebenen (Papille, Makula/Fovea)
    const disc = frame(15 * DEG, 180 * DEG);
    const macula = frame(MACULA_DEG.th * DEG, MACULA_DEG.ph * DEG);
    const t = [0, 0];
    const RX = 0.85 / 11; // Papille 1,7 × 1,9 mm auf r = 11 mm
    const RY = 0.95 / 11;
    const MAC_R = 0.25; // Makula Ø 5,5 mm ≈ 29°
    const FOV_R = 0.068; // Fovea Ø 1,5 mm

    // cos/sin von φ spaltenweise vorab berechnen
    const phiOf = new Float64Array(W);
    const cosP = new Float64Array(W);
    const sinP = new Float64Array(W);
    for (let x = 0; x < W; x++) {
      phiOf[x] = ((x + 0.5) / W) * TAU;
      cosP[x] = Math.cos(phiOf[x]);
      sinP[x] = Math.sin(phiOf[x]);
    }

    for (let y = 0; y < H; y++) {
      const theta = ((y + 0.5) / H) * thetaMax;
      const st = Math.sin(theta);
      const ct = Math.cos(theta);
      const peri = smoothstep(0.9, 1.9, theta);
      // Makula und Fovea liegen nahe dem Pol, die Papille im Fenster um φ = π:
      // nur dort werden die Tangentialprojektionen gerechnet (außerhalb sind die Gewichte 0).
      const nearPole = theta < 0.5;
      const nearDisc = theta > 0.12 && theta < 0.42;

      for (let x = 0; x < W; x++) {
        const phi = phiOf[x];
        const dx = st * cosP[x];
        const dy = st * sinP[x];
        const dz = -ct;

        // Grundfarbe orange-rot, zur Peripherie dunkler und gelblicher
        const n = (hash(x, y) - 0.5) * 14;
        let r = 205 + n;
        let gC = 92 + n * 0.6;
        let b = 56 + n * 0.5;
        r = lerp(r, 165, peri * 0.5);
        gC = lerp(gC, 84, peri * 0.5);
        b = lerp(b, 52, peri * 0.5);

        if (nearPole) {
          tangent(macula, dx, dy, dz, t);
          const am = Math.hypot(t[0], t[1]);

          // Makula: gelbes Pigment dunkelt ab
          const sm = am / (MAC_R * 0.8);
          const wm = Math.exp(-sm * sm) * 0.55;
          r = lerp(r, 120, wm);
          gC = lerp(gC, 55, wm);
          b = lerp(b, 35, wm);

          // Fovea: Grube und Foveareflex
          const sf = am / (FOV_R * 1.2);
          const wf = Math.exp(-sf * sf) * 0.5;
          r = lerp(r, 90, wf);
          gC = lerp(gC, 45, wf);
          b = lerp(b, 28, wf);
          const sr = am / 0.02;
          const wr = Math.exp(-sr * sr) * 0.6;
          r = lerp(r, 230, wr);
          gC = lerp(gC, 150, wr);
          b = lerp(b, 110, wr);
        }

        // Papille (hochoval) mit Excavatio
        if (nearDisc && Math.abs(phi - Math.PI) < 0.5) {
          tangent(disc, dx, dy, dz, t);
          const e = (t[0] * t[0]) / (RX * RX) + (t[1] * t[1]) / (RY * RY);
          const wp = 1 - smoothstep(0.9, 1.05, e);
          if (wp > 0) {
            const ec = (t[0] * t[0]) / ((RX * 0.5) * (RX * 0.5)) + (t[1] * t[1]) / ((RY * 0.55) * (RY * 0.55));
            const wc = 1 - smoothstep(0.85, 1.0, ec);
            const rim = 1 - smoothstep(0.5, 1, e);
            const pr = lerp(232 + rim * 13, 250, wc);
            const pg = lerp(196 + rim * 26, 236, wc);
            const pb = lerp(110 + rim * 40, 196, wc);
            r = lerp(r, pr, wp);
            gC = lerp(gC, pg, wp);
            b = lerp(b, pb, wp);
          }
        }

        const i = (y * W + x) * 4;
        px[i] = r;
        px[i + 1] = gC;
        px[i + 2] = b;
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Gefäßbögen (nach dem Pixelfeld, damit sie oben liegen)
    const rnd = rng(23);
    ctx.save();
    for (const arcade of ARCADES) drawArcade(ctx, arcade, rnd);
    ctx.restore();

    return makeTexture(cv, { flipY: false, wrapS: true });
  }

  // ---------- Sklera ----------

  function sclera() {
    const W = 1024;
    const H = 512;
    const cv = canvas(W, H);
    const ctx = cv.getContext('2d');
    const rnd = rng(11);

    ctx.fillStyle = '#f1f4f9';
    ctx.fillRect(0, 0, W, H);

    // Feine Episkleralgefäße: ziellos gewundene Wege
    for (let i = 0; i < 70; i++) {
      let x = rnd() * W;
      let y = rnd() * H;
      let a = rnd() * TAU;
      const pts = [[x, y]];
      for (let s = 0; s < 60; s++) {
        a += (rnd() - 0.5) * 0.5;
        x += Math.cos(a) * 4;
        y += Math.sin(a) * 4;
        pts.push([x, y]);
      }
      const w = 0.5 + rnd() * 1.2;
      ctx.strokeStyle = 'rgba(190,70,80,' + (0.25 + rnd() * 0.25).toFixed(3) + ')';
      ctx.lineWidth = w;
      wrapX(ctx, W, () => {
        ctx.beginPath();
        pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
        ctx.stroke();
      });
    }

    // Feines graues Korn
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = 'rgba(90,100,120,' + (0.02 + rnd() * 0.04).toFixed(3) + ')';
      ctx.fillRect(rnd() * W, rnd() * H, 1, 1);
    }

    return makeTexture(cv, { wrapS: true, wrapT: true });
  }

  // ---------- Muskel und Sehne (kachelbar) ----------

  // Rot-braune Längsfaserstreifen; senkrechte Linien, daher in x und y kachelbar.
  function muscle() {
    const S = 256;
    const cv = canvas(S, S);
    const ctx = cv.getContext('2d');
    const rnd = rng(31);

    ctx.fillStyle = '#7a2e26';
    ctx.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x++) {
      const dark = rnd() < 0.45;
      ctx.fillStyle = dark
        ? 'rgba(70,24,20,' + (0.35 + rnd() * 0.35).toFixed(3) + ')'
        : 'rgba(176,86,66,' + (0.2 + rnd() * 0.35).toFixed(3) + ')';
      ctx.fillRect(x, 0, 1, S);
    }
    // Einzelne Faserbündel als etwas breitere Streifen
    for (let i = 0; i < 26; i++) {
      const x = rnd() * S;
      ctx.fillStyle = 'rgba(50,16,14,0.35)';
      ctx.fillRect(x, 0, 1.5, S);
    }
    return makeTexture(cv, { wrapS: true, wrapT: true });
  }

  // Weißlich-silbrige Sehne mit feinen Längsfasern; kachelbar.
  function tendon() {
    const S = 256;
    const cv = canvas(S, S);
    const ctx = cv.getContext('2d');
    const rnd = rng(47);

    // Seitlicher Glanz, an den Rändern gleich (kachelbar)
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, '#cfc8bd');
    g.addColorStop(0.35, '#fbf9f5');
    g.addColorStop(1, '#cfc8bd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    for (let x = 0; x < S; x++) {
      const bright = rnd() < 0.5;
      ctx.fillStyle = bright
        ? 'rgba(255,255,255,' + (0.2 + rnd() * 0.4).toFixed(3) + ')'
        : 'rgba(150,140,128,' + (0.12 + rnd() * 0.2).toFixed(3) + ')';
      ctx.fillRect(x, 0, 1, S);
    }
    return makeTexture(cv, { wrapS: true, wrapT: true });
  }

  // ---------- UV-Helfer ----------

  // Setzt ein uv-Attribut aus den Vertex-Positionen. Indizierte Geometrie wird vorher
  // aufgelöst, damit Dreiecke über die Naht (u = 0/1) nicht über die ganze Textur gezogen werden.
  function setUV(geometry, uvOf) {
    if (geometry.index) geometry.copy(geometry.toNonIndexed());
    const pos = geometry.attributes.position;
    const n = pos.count;
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const [u, v] = uvOf(pos.getX(i), pos.getY(i), pos.getZ(i));
      uv[2 * i] = u;
      uv[2 * i + 1] = v;
    }
    // Pro Dreieck die u-Werte relativ zur ersten Ecke auf [−0.5, 0.5) abwickeln
    for (let t = 0; t < n; t += 3) {
      const u0 = uv[2 * t];
      for (let k = 1; k < 3; k++) {
        const du = uv[2 * (t + k)] - u0;
        uv[2 * (t + k)] = u0 + (du - Math.round(du));
      }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geometry;
  }

  // Iris: u = Winkel, v = (r − rInner) / (rOuter − rInner)
  function applyPolarUV(geometry, opts) {
    const { rInner, rOuter } = opts;
    return setUV(geometry, (x, y) => {
      let u = Math.atan2(y, x) / TAU;
      if (u < 0) u += 1;
      const v = (Math.sqrt(x * x + y * y) - rInner) / (rOuter - rInner);
      return [u, clamp01(v)];
    });
  }

  // Retina: θ = Winkel zwischen Vertex und dem hinteren Pol (0, 0, −1), v = θ / thetaMax
  function applyFundusUV(geometry, opts) {
    const thetaMax = (opts && opts.thetaMax) || FUNDUS.thetaMax;
    return setUV(geometry, (x, y, z) => {
      let u = Math.atan2(y, x) / TAU;
      if (u < 0) u += 1;
      const theta = Math.atan2(Math.sqrt(x * x + y * y), -z);
      return [u, clamp01(theta / thetaMax)];
    });
  }

  return {
    iris,
    fundus,
    sclera,
    muscle,
    tendon,
    applyPolarUV,
    applyFundusUV
  };
})();
