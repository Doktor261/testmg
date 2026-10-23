/* Geometrie: erzeugt alle Meshes aus den Maßen in DIM (1 Einheit = 1 mm).
   +Z anterior, +Y superior, +X lateral/temporal (rechtes Auge). Ursprung = Mittelpunkt der Sklera-Kugel. */
window.EYE = window.EYE || {};
(function () {
  'use strict';

  const D2R = Math.PI / 180;

  // ---------- Maße (Literaturwerte, gerundet) ----------
  const DIM = {
    scleraR: 12.0,
    scleraT: [[29, 0.5], [45, 0.42], [60, 0.3], [85, 0.45], [120, 0.7], [150, 0.9], [180, 1.0]], // Dicke über Winkel zur Sehachse (°)
    choroidT: 0.5,                                   // real ≈ 0,25 → 2× überhöht
    retinaT: [[60, 0.35], [90, 0.5], [130, 0.65], [180, 0.7]], // real 0,1–0,35 → ≈ 2–2,5× überhöht
    cutY: 1.4,                                       // Trennebene der Schalen (Papille/Fovea liegen darunter)
    limbusR: 5.85,                                   // Ø 11,7
    corneaApexZ: 13.1, corneaR2: 6.5, corneaTc: 0.55,
    oraZ: 5.3, planaLen: 4.0, plicataLen: 2.0,
    irisR: 6.0, pupilR: 1.75, irisRootZ: 9.6, irisMarginZ: 9.85,
    irisThick: [[1.75, 0.5], [3.0, 0.6], [4.5, 0.4], [6.0, 0.3]],
    sphincterR: 2.5,
    lensFrontZ: 9.5, lensRf: 10, lensRb: 6, lensR: 4.75, lensT: 4.0,
    nProc: 72, procH: 0.7, procW: 0.26,
    papilla: { x: -3.0, y: 0.3, a: 0.85, b: 0.95 },  // nasal, leicht superior des hinteren Pols; 1,7 × 1,9
    fovea: { x: 1.2, y: -0.4, r: 0.75 },             // temporal, inferior; Ø 1,5
    macula: { r: 2.75 },                             // Ø 5,5
    schlemm: { r: 6.12, z: 10.0, tube: 0.17 },
    segs: 96
  };

  // ---------- Hilfsfunktionen ----------
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  function tbl(t, x) {
    if (x <= t[0][0]) return t[0][1];
    for (let i = 1; i < t.length; i++) {
      if (x <= t[i][0]) {
        const f = smooth((x - t[i - 1][0]) / (t[i][0] - t[i - 1][0]));
        return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * f;
      }
    }
    return t[t.length - 1][1];
  }
  const rz = (R, phiDeg) => [R * Math.sin(phiDeg * D2R), R * Math.cos(phiDeg * D2R)]; // φ = Winkel von der Sehachse (vorn)

  // Radius-Funktionen der Schalen in Abhängigkeit von φ (°)
  const Rso = () => DIM.scleraR;
  const Rsi = (phi) => DIM.scleraR - tbl(DIM.scleraT, phi);
  const Rci = (phi) => Rsi(phi) - DIM.choroidT;
  const Rri = (phi) => Rci(phi) - tbl(DIM.retinaT, phi);

  // Winkel φ, bei dem die Aderhaut-Innenfläche z = oraZ erreicht (Ora serrata)
  function solvePhi(fn, target) {
    let lo = 20, hi = 100;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (fn(m) * Math.cos(m * D2R) > target) lo = m; else hi = m; // z wächst bei kleinerem φ
    }
    return (lo + hi) / 2;
  }
  const phiOra = solvePhi(Rci, DIM.oraZ);
  const phiPlana = phiOra - (DIM.planaLen / Rsi(50)) / D2R;
  const phiAnt = phiPlana - (DIM.plicataLen / Rsi(40)) / D2R;
  DIM.phiOra = phiOra; DIM.phiPlana = phiPlana; DIM.phiAnt = phiAnt;

  // ---------- Geometrie-Builder ----------
  function Builder() { this.p = []; this.n = []; this.u = []; this.i = []; }
  Builder.prototype.vert = function (x, y, z, nx, ny, nz, u, v) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v);
    return this.p.length / 3 - 1;
  };
  // prof: [{r,z,nr,nz,v?}]; range(r) → [ψ0, ψ1] (Halbschalen)
  Builder.prototype.sweep = function (prof, segs, range) {
    const base = this.p.length / 3, n = prof.length, W = segs + 1;
    for (let i = 0; i < n; i++) {
      const q = prof[i], rg = range ? range(q.r) : [0, 2 * Math.PI];
      for (let j = 0; j <= segs; j++) {
        const a = rg[0] + (rg[1] - rg[0]) * j / segs, c = Math.cos(a), s = Math.sin(a);
        this.vert(q.r * c, q.r * s, q.z, q.nr * c, q.nr * s, q.nz, j / segs, q.v === undefined ? i / Math.max(1, n - 1) : q.v);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < segs; j++) {
        const a = base + i * W + j, b = a + 1, c = a + W, d = c + 1;
        this.i.push(a, c, b, b, c, d);
      }
    }
  };
  Builder.prototype.geo = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  };

  // Normalen (links der Laufrichtung) für ein offenes Profil
  function withNormals(pts) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tr = b[0] - a[0], tz = b[1] - a[1];
      const l = Math.hypot(tr, tz) || 1; tr /= l; tz /= l;
      let nr = -tz, nz = tr;
      if (pts[i][0] < 1e-6) { nr = 0; nz = Math.sign(nz) || 1; }
      out.push({ r: Math.max(0, pts[i][0]), z: pts[i][1], nr, nz });
    }
    return out;
  }

  // geschlossener Profil-Polygonzug → Volumenkörper (Normalen nach außen, Kanten bleiben scharf)
  function polyLathe(pts, o) {
    o = o || {};
    const segs = o.segs || DIM.segs, crease = (o.crease || 40) * D2R, b = new Builder();
    let A = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; }
    if (A > 0) pts = pts.slice().reverse();
    const n = pts.length, en = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const dr = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dr, dz);
      en.push(l < 1e-9 ? null : [-dz / l, dr / l]);
    }
    const near = (i, dir) => { for (let k = 1; k < n; k++) { const e = en[(i + dir * k + n * 4) % n]; if (e) return e; } return null; };
    function vn(p, own, other) {
      let nr = own[0], nz = own[1];
      if (other) {
        const ang = Math.acos(Math.max(-1, Math.min(1, own[0] * other[0] + own[1] * other[1])));
        if (ang < crease) { nr = own[0] + other[0]; nz = own[1] + other[1]; const l = Math.hypot(nr, nz) || 1; nr /= l; nz /= l; }
      }
      if (p[0] < 1e-6) { nr = 0; nz = Math.sign(nz) || 1; }
      return [nr, nz];
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], e = en[i];
      if (!e || (p[0] < 1e-6 && q[0] < 1e-6)) continue;
      const np = vn(p, e, near(i, -1)), nq = vn(q, e, near((i + 1) % n, 1));
      b.sweep([
        { r: Math.max(0, p[0]), z: p[1], nr: np[0], nz: np[1], v: 0 },
        { r: Math.max(0, q[0]), z: q[1], nr: nq[0], nz: nq[1], v: 1 }
      ], segs);
    }
    return b.geo();
  }

  // Halbschalen-Bereich: Schnittebene y = yc für jeden Ring
  function halfRange(yc, side) {
    return (r) => {
      const a = Math.asin(Math.min(1, yc / Math.max(r, 1e-6)));
      return side === 'upper' ? [a, Math.PI - a] : [Math.PI - a, 2 * Math.PI + a];
    };
  }

  // Schale aus Außen-/Innenprofil (gleich viele Punkte, vom hinteren Pol nach vorn), optional obere/untere Hälfte
  function shellGeo(outer, inner, o) {
    o = o || {};
    const segs = o.segs || DIM.segs, b = new Builder(), yc = o.yc === undefined ? DIM.cutY : o.yc;
    const rng = o.side ? halfRange(yc, o.side) : null;
    b.sweep(withNormals(outer), segs, rng);
    b.sweep(withNormals(inner), segs, rng);
    const N = outer.length;
    [0, N - 1].forEach((k) => {
      if (outer[k][0] < 1e-6 && inner[k][0] < 1e-6) return;
      const dr = inner[k][0] - outer[k][0], dz = inner[k][1] - outer[k][1], l = Math.hypot(dr, dz) || 1;
      const nr = -dz / l, nz = dr / l;
      b.sweep([
        { r: outer[k][0], z: outer[k][1], nr, nz, v: 0 },
        { r: inner[k][0], z: inner[k][1], nr, nz, v: 1 }
      ], segs, rng);
    });
    if (rng) {
      const upper = o.side === 'upper', ny = upper ? -1 : 1;
      const P = (rr, zz, e) => {
        const a = Math.asin(yc / rr);
        const psi = upper ? (e === 0 ? a : Math.PI - a) : (e === 0 ? Math.PI - a : 2 * Math.PI + a);
        return [rr * Math.cos(psi), rr * Math.sin(psi), zz];
      };
      for (let i = 0; i < N - 1; i++) {
        const rs = [outer[i], outer[i + 1], inner[i + 1], inner[i]];
        if (rs.some((q) => q[0] <= yc + 1e-3)) continue;
        for (let e = 0; e < 2; e++) {
          const q = rs.map((s) => P(s[0], s[1], e));
          const base = b.p.length / 3;
          q.forEach((v) => b.vert(v[0], v[1], v[2], 0, ny, 0, 0, 0));
          const A = new THREE.Vector3(...q[0]), B = new THREE.Vector3(...q[1]), C = new THREE.Vector3(...q[2]);
          const dir = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).y * ny;
          if (dir >= 0) b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
          else b.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
        }
      }
    }
    return b.geo();
  }

  // Punkte entlang einer Kugelschale (φ von φ0 nach φ1), n+1 Punkte
  function arcPts(Rfn, phi0, phi1, n) {
    const out = [];
    for (let k = 0; k <= n; k++) {
      const phi = phi0 + (phi1 - phi0) * k / n;
      const p = rz(Rfn(phi), phi);
      out.push([phi0 === 180 && k === 0 ? 0 : p[0], p[1]]);
    }
    return out;
  }

  // Flächenstück auf einer Kugel (Papille, Makula, Fovea, Lamina): Mittelpunkt in Richtung dir, Halbachsen a,b (mm)
  function patch(dir, a, b, Rbase, offFn, o) {
    o = o || {};
    const nr = o.nr || 10, na = o.na || 48;
    const n = dir.clone().normalize();
    const t1 = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize();
    const t2 = new THREE.Vector3().crossVectors(t1, n).normalize();
    const pos = [], idx = [];
    for (let k = 0; k <= nr; k++) {
      const rho = k / nr;
      for (let j = 0; j <= na; j++) {
        const th = j / na * 2 * Math.PI;
        const u = a * rho * Math.cos(th), v = b * rho * Math.sin(th);
        const d = n.clone().multiplyScalar(Rbase).addScaledVector(t1, u).addScaledVector(t2, v).normalize();
        const R = Rbase + offFn(rho, th);
        const p = d.multiplyScalar(R);
        pos.push(p.x, p.y, p.z);
      }
    }
    if (o.clipY !== undefined) {
      for (let i = 0; i < pos.length; i += 3) {
        if (pos[i + 1] > o.clipY) {
          const R = Math.hypot(pos[i], pos[i + 1], pos[i + 2]);
          pos[i + 1] = o.clipY;
          const k = Math.sqrt(Math.max(0, R * R - o.clipY * o.clipY)) / (Math.hypot(pos[i], pos[i + 2]) || 1);
          pos[i] *= k; pos[i + 2] *= k;
        }
      }
    }
    const W = na + 1;
    for (let k = 0; k < nr; k++) for (let j = 0; j < na; j++) {
      const A = k * W + j, B = A + 1, C = A + W, D = C + 1;
      idx.push(A, C, B, B, C, D);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // Richtung auf der Kugel (nasal = −x, superior = +y) hinter dem Pol: Bogenmaß-Abstände x,y
  function backDir(x, y) {   // Sehnenabstände auf Retina-Höhe (Radius ≈ 10,5)
    return new THREE.Vector3(x, y, -Math.sqrt(10.5 * 10.5 - x * x - y * y)).normalize();
  }
  DIM.papillaDir = backDir(DIM.papilla.x, DIM.papilla.y);
  DIM.foveaDir = backDir(DIM.fovea.x, DIM.fovea.y);

  // ---------- Kornea-Hilfen ----------
  function circleFit(p0, p1, p2) {
    // Kreis durch drei Punkte (r,z), liefert Mittelpunkt + Radius
    const ax = p0[0], ay = p0[1], bx = p1[0], by = p1[1], cx = p2[0], cy = p2[1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { c: [ux, uy], R: Math.hypot(ax - ux, ay - uy) };
  }

  // ---------- Aufbau ----------
  EYE.DIM = DIM;
  EYE.meshesByPart = {};
  EYE.materials = {};
  EYE.helpers = { smooth, tbl, rz, Builder, polyLathe, shellGeo, patch, withNormals, arcPts, halfRange, backDir, circleFit, Rsi, Rci, Rri };

  EYE.build = function (scene) {
    const root = new THREE.Group();
    root.name = 'auge';
    scene.add(root);
    EYE.root = root;
    EYE.meshesByPart = {};
    EYE.materials = {};

    function material(id, over) {
      const p = EYE.partById[id];
      if (!EYE.materials[id]) {
        const m = new THREE.MeshStandardMaterial(Object.assign({
          color: p.color, roughness: p.rough === undefined ? 0.6 : p.rough, metalness: 0,
          transparent: p.opacity < 1, opacity: p.opacity, side: THREE.DoubleSide,
          depthWrite: !(p.opacity < 1)
        }, over || {}));
        m.userData.baseOpacity = p.opacity;
        m.userData.baseEmissive = m.emissive.clone();
        EYE.materials[id] = m;
      }
      return EYE.materials[id];
    }
    function add(id, geo, o) {
      o = o || {};
      const mesh = o.instanced ? o.instanced : new THREE.Mesh(geo, o.material || material(id));
      mesh.userData.partId = id;
      if (o.half) mesh.userData.half = o.half;
      if (o.renderOrder !== undefined) mesh.renderOrder = o.renderOrder;
      mesh.name = id + (o.half ? '_' + o.half : '');
      root.add(mesh);
      (EYE.meshesByPart[id] = EYE.meshesByPart[id] || []).push(mesh);
      return mesh;
    }
    const ctx = { root, material, add };

    buildGlobe(ctx);
    if (EYE.buildOrbit) EYE.buildOrbit(ctx);
    return ctx;
  };

  function buildGlobe(ctx) {
    const { add, material } = ctx;
    const N = 100;

    // --- Cornea ---
    const Lz = Math.sqrt(DIM.scleraR * DIM.scleraR - DIM.limbusR * DIM.limbusR);        // Limbus außen
    const phiL = Math.atan2(DIM.limbusR, Lz) / D2R;
    const phiLi = Math.asin(5.55 / Rsi(phiL)) / D2R;
    const Si = rz(Rsi(phiLi), phiLi);                                                    // Skleraspitze innen
    // Kreis durch Scheitel + Limbus mit Mittelpunkt auf der Achse:
    const dzc = DIM.corneaApexZ - Lz;
    const R1 = (DIM.limbusR * DIM.limbusR + dzc * dzc) / (2 * dzc);
    DIM.corneaR1 = R1;
    const cz1 = DIM.corneaApexZ - R1;
    const outerC = [];
    for (let k = 0; k <= 40; k++) {
      const r = DIM.limbusR * k / 40;
      outerC.push([r, cz1 + Math.sqrt(R1 * R1 - r * r)]);
    }
    const apexB = DIM.corneaApexZ - DIM.corneaTc, cz2 = apexB - DIM.corneaR2, rJ = 4.2;
    const innerC = [];
    for (let k = 0; k <= 30; k++) {
      const r = rJ * k / 30;
      innerC.push([r, cz2 + Math.sqrt(DIM.corneaR2 * DIM.corneaR2 - r * r)]);
    }
    // weicher Übergang zur Skleraspitze (kubischer Hermite)
    {
      const p0 = innerC[innerC.length - 1], m0 = [1, -rJ / Math.sqrt(DIM.corneaR2 * DIM.corneaR2 - rJ * rJ)];
      const p1 = Si, m1 = [1, -1.0], k = Si[0] - p0[0];
      for (let s = 1; s <= 8; s++) {
        const t = s / 8, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        innerC.push([h00 * p0[0] + h10 * k * m0[0] + h01 * p1[0] + h11 * k * m1[0],
                     h00 * p0[1] + h10 * k * m0[1] + h01 * p1[1] + h11 * k * m1[1]]);
      }
    }
    DIM.corneaInner = innerC;
    {
      const poly = outerC.slice();                       // Scheitel → Limbus außen
      poly.push([DIM.limbusR, Lz]);
      for (let k = innerC.length - 1; k >= 0; k--) poly.push(innerC[k]);
      poly.pop();                                        // Achsenpunkt nicht doppelt
      poly.push([0, apexB]);
      add('cornea', polyLathe(poly), { renderOrder: 5 });
    }

    // --- Sclera (zwei Hälften) ---
    const outerS = arcPts(Rso, 180, phiL, N);
    const innerS = arcPts(Rsi, 180, phiLi, N);
    ['upper', 'lower'].forEach((s) => add('sclera', shellGeo(outerS, innerS, { side: s }), { half: s }));

    // --- Limbus corneae: schmales Band über der Hornhaut-/Skleragrenze ---
    {
      const o = [], i = [];
      for (let k = 0; k <= 8; k++) {            // Hornhautseite
        const r = 5.3 + (DIM.limbusR - 5.3) * k / 8;
        const z = cz1 + Math.sqrt((R1 + 0.03) * (R1 + 0.03) - r * r);
        o.push([r, z]);
      }
      for (let k = 1; k <= 8; k++) {            // Skleraseite
        const r = DIM.limbusR + 0.4 * k / 8;
        o.push([r, Math.sqrt((DIM.scleraR + 0.03) ** 2 - r * r)]);
      }
      o.forEach((p, idx) => {
        const cz = idx <= 8 ? cz1 : 0, dr = p[0], dz = p[1] - cz, l = Math.hypot(dr, dz);
        i.push([p[0] - dr / l * 0.4, p[1] - dz / l * 0.4]);
      });
      add('limbus', polyLathe(o.concat(i.slice().reverse())), { renderOrder: 6 });
    }

    // --- Choroidea (zwei Hälften, 2× überhöht) ---
    const outerC2 = arcPts((p) => Rsi(p) - 0.01, 180, phiOra, N);
    const innerC2 = arcPts(Rci, 180, phiOra, N);
    ['upper', 'lower'].forEach((s) => add('choroidea', shellGeo(outerC2, innerC2, { side: s }), { half: s }));

    // --- Retina Pars optica (zwei Hälften, überhöht) ---
    const outerR = arcPts((p) => Rci(p) - 0.01, 180, phiOra, N);
    const innerR = arcPts(Rri, 180, phiOra, N);
    ['upper', 'lower'].forEach((s) => {
      const g = shellGeo(outerR, innerR, { side: s });
      if (EYE.textures && EYE.textures.applyFundusUV) EYE.textures.applyFundusUV(g);
      add('retina', g, { half: s });
    });

    // --- Ora serrata: gezähnter Ring am Ende der Pars optica ---
    {
      const w = 1.6, o = [], i = [], n = 6;
      for (let k = 0; k <= n; k++) {
        const phi = phiOra - w * k / n;
        o.push(rz(Rci(phi) - 0.01, phi));
        i.push(rz(Rri(phi), phi));
      }
      ['upper', 'lower'].forEach((s) => {
        const g = shellGeo(o, i, { side: s, segs: 192 });
        // Zähnung: vordere Kante in Meridianrichtung sägezahnartig versetzen
        const pos = g.attributes.position;
        for (let v = 0; v < pos.count; v++) {
          const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v), r = Math.hypot(x, y);
          const phi = Math.atan2(r, z) / D2R;
          if (phi < phiOra - w + 0.05) {
            const psi = Math.atan2(y, x), tooth = ((psi * 48 / (2 * Math.PI)) % 1 + 1) % 1;
            const dphi = (tooth < 0.5 ? tooth : 1 - tooth) * 1.2 * D2R;
            const R = Math.hypot(r, z), na = Math.atan2(r, z) - dphi;
            pos.setXYZ(v, R * Math.sin(na) * Math.cos(psi), R * Math.sin(na) * Math.sin(psi), R * Math.cos(na));
          }
        }
        pos.needsUpdate = true; g.computeVertexNormals();
        add('ora_serrata', g, { half: s });
      });
    }

    // --- Papille, Makula, Fovea (gehören zur unteren Retinahälfte) ---
    {
      const phiP = Math.acos(-DIM.papillaDir.z) / D2R;
      const Rp = Rri(180 - phiP) + 0.02;
      const pg = patch(DIM.papillaDir, DIM.papilla.a, DIM.papilla.b, Rp, (rho) => 0.05 + 0.08 * Math.sin(Math.min(1, rho / 0.85) * Math.PI * 0.5) * smooth(rho / 0.85) - 0.1 * (1 - smooth(rho / 0.6)), { nr: 14, na: 48 });
      add('discus_nervi_optici', pg, { half: 'lower', renderOrder: 3 });

      const Rm = Rri(180 - Math.acos(-DIM.foveaDir.z) / D2R);
      const mg = patch(DIM.foveaDir, DIM.macula.r, DIM.macula.r, Rm, () => 0.03, { nr: 10, na: 64, clipY: DIM.cutY - 0.02 });
      add('macula', mg, { half: 'lower', renderOrder: 2 });
      const fg = patch(DIM.foveaDir, DIM.fovea.r, DIM.fovea.r, Rm, (rho) => 0.05 + 0.1 * smooth(rho / 0.8) * (rho < 0.9 ? 1 : 1 - (rho - 0.9) * 10) + 0.0, { nr: 8, na: 40 });
      add('fovea', fg, { half: 'lower', renderOrder: 4 });
    }

    // --- Lamina cribrosa sclerae (Siebplatte am Sehnervenaustritt) ---
    {
      const Rl = DIM.scleraR - 0.5;
      const lg = patch(DIM.papillaDir, 1.15, 1.25, Rl, () => 0.0, { nr: 6, na: 40 });
      add('lamina_cribrosa', lg, { half: 'lower' });
    }

    // --- Iris (Profilfunktionen) ---
    const zm = (r) => DIM.irisRootZ + (DIM.irisMarginZ - DIM.irisRootZ) * (DIM.irisR - r) / (DIM.irisR - DIM.pupilR);
    const th = (r) => tbl([[1.75, 0.5], [3.0, 0.6], [4.5, 0.4], [6.0, 0.3]], r);
    const zf = (r) => zm(r) + th(r) / 2, zb = (r) => zm(r) - th(r) / 2;
    DIM.irisZf = zf; DIM.irisZb = zb;
    const rsamp = (r0, r1, n) => { const a = []; for (let k = 0; k <= n; k++) a.push(r0 + (r1 - r0) * k / n); return a; };
    function irisBand(r0, r1, offB, offF, n) {
      const rs = rsamp(r1, r0, n || 20), pts = [];
      rs.forEach((r) => pts.push([r, zf(r) + offF]));
      rs.slice().reverse().forEach((r) => pts.push([r, zb(r) + offB]));
      return polyLathe(pts, { crease: 50 });
    }
    add('iris', irisBand(DIM.pupilR, DIM.irisR - 0.1, 0, 0, 30), { renderOrder: 4 });
    add('sphincter_pupillae', irisBand(DIM.pupilR + 0.01, DIM.sphincterR, -0.03, 0.03, 8));
    add('dilatator_pupillae', irisBand(DIM.sphincterR, DIM.irisR - 0.25, -0.035, -0.18, 20));

    // --- Linse ---
    const lensZc = DIM.lensFrontZ - DIM.lensT / 2;
    function lensProfile(inset, n) {
      const Rf = DIM.lensRf - inset, Rb = DIM.lensRb - inset;
      const cf = DIM.lensFrontZ - DIM.lensRf, cb = DIM.lensFrontZ - DIM.lensT + DIM.lensRb;
      const rJ = 4.2 - inset * 0.9, req = DIM.lensR - inset;
      const zfJ = cf + Math.sqrt(Rf * Rf - rJ * rJ), zbJ = cb - Math.sqrt(Rb * Rb - rJ * rJ), zeq = (zfJ + zbJ) / 2;
      const pts = [];
      for (let k = 0; k <= n; k++) { const r = rJ * k / n; pts.push([r, cf + Math.sqrt(Rf * Rf - r * r)]); }
      const ar = req - rJ, az = (zfJ - zbJ) / 2;
      for (let k = 1; k < 10; k++) { const a = Math.PI / 2 - Math.PI * k / 10; pts.push([rJ + ar * Math.cos(a), zeq + az * Math.sin(a)]); }
      for (let k = n; k >= 0; k--) { const r = rJ * k / n; pts.push([r, cb - Math.sqrt(Rb * Rb - r * r)]); }
      return pts;
    }
    DIM.lensProfile = lensProfile;
    add('lens_capsula', polyLathe(lensProfile(0, 30), { crease: 80 }), { renderOrder: 8 });
    add('lens_cortex', polyLathe(lensProfile(0.09, 28), { crease: 80 }), { renderOrder: 7 });
    {
      const pts = [], ar = 2.9, az = 1.45;
      for (let k = 0; k <= 36; k++) { const a = Math.PI * k / 36; pts.push([ar * Math.sin(a), lensZc + az * Math.cos(a)]); }
      add('lens_nucleus', polyLathe(pts, { crease: 80 }), { renderOrder: 6 });
    }

    // --- Corpus ciliare, M. ciliaris, Pars caeca, Processus ---
    const phiMus = 50;
    const musTh = (phi) => 0.55 * smooth((phiMus - phi) / (phiMus - phiAnt));
    const depth = (phi) => tbl([[phiAnt, 1.05], [phiPlana, 1.05], [phiOra, 0.85]], phi);
    const Rcbo = (phi) => Rsi(phi) - 0.02 - musTh(phi);
    const Rcbi = (phi) => Rsi(phi) - depth(phi);
    DIM.Rcbi = Rcbi;
    function phiList(a, b, n) { const l = []; for (let k = 0; k <= n; k++) l.push(a + (b - a) * k / n); return l; }
    {
      const ph = phiList(phiOra, phiAnt, 40), pts = [];
      ph.forEach((p) => pts.push(rz(Rcbo(p), p)));
      ph.slice().reverse().forEach((p) => pts.push(rz(Rcbi(p), p)));
      add('corpus_ciliare', polyLathe(pts, { crease: 60 }));
    }
    {
      const ph = phiList(phiMus, phiAnt, 24), pts = [];
      ph.forEach((p) => pts.push(rz(Rsi(p) - 0.02, p)));
      ph.slice().reverse().forEach((p) => pts.push(rz(Rsi(p) - 0.02 - musTh(p) - 0.01, p)));
      add('m_ciliaris', polyLathe(pts, { crease: 60 }));
    }
    {
      const ph = phiList(phiOra, phiAnt, 40), pts = [];
      ph.forEach((p) => pts.push(rz(Rcbi(p) + 0.01, p)));
      ph.slice().reverse().forEach((p) => pts.push(rz(Rcbi(p) - 0.06, p)));
      add('pars_caeca', polyLathe(pts, { crease: 60 }), { renderOrder: 2 });
    }
    {
      // Prisma in der Meridianebene (r,z), tangential extrudiert → 72 Instanzen
      const phiS = phiPlana - 1.0, phiE = phiAnt + 0.6;
      const base = [], top = [], n = 12;
      for (let k = 0; k <= n; k++) {
        const p = phiS + (phiE - phiS) * k / n;
        const h = DIM.procH * smooth(k / n * 2.2) * (1 - 0.0 * smooth((k / n - 0.85) / 0.15));
        base.push(rz(Rcbi(p) + 0.02, p));
        top.push(rz(Rcbi(p) - h, p));
      }
      const shape = new THREE.Shape();
      shape.moveTo(base[0][0], base[0][1]);
      for (let k = 1; k < base.length; k++) shape.lineTo(base[k][0], base[k][1]);
      for (let k = top.length - 1; k >= 0; k--) shape.lineTo(top[k][0], top[k][1]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: DIM.procW, bevelEnabled: false, steps: 1 });
      g.rotateX(Math.PI / 2);
      g.translate(0, DIM.procW / 2, 0);
      const inst = new THREE.InstancedMesh(g, material('processus_ciliares'), DIM.nProc);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 0, 1);
      for (let k = 0; k < DIM.nProc; k++) {
        q.setFromAxisAngle(ax, k / DIM.nProc * 2 * Math.PI);
        m4.compose(new THREE.Vector3(), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(k, m4);
      }
      inst.instanceMatrix.needsUpdate = true;
      add('processus_ciliares', null, { instanced: inst });
    }

    // --- Schlemm-Kanal + Trabekelwerk ---
    {
      const tg = new THREE.TorusGeometry(DIM.schlemm.r, DIM.schlemm.tube, 12, 96);
      tg.translate(0, 0, DIM.schlemm.z);
      add('sinus_venosus', tg);
      add('reticulum', polyLathe([[5.55, 10.02], [5.95, 10.1], [6.0, 9.82], [5.62, 9.8]], { crease: 70 }), { renderOrder: 3 });
    }

    // --- Glaskörper (Polygon bis an die Linsenrückfläche) + Canalis hyaloideus ---
    {
      const pts = [];
      const rb = Rri(180) - 0.03;
      pts.push([0, -rb]);
      arcPts((p) => Rri(p) - 0.03, 180, phiOra, 60).slice(1).forEach((p) => pts.push(p));
      phiList(phiOra, phiPlana, 8).slice(1).forEach((p) => pts.push(rz(Rcbi(p) - 0.03, p)));
      const cb = DIM.lensFrontZ - DIM.lensT + DIM.lensRb;
      pts.push([4.3, cb - Math.sqrt(DIM.lensRb ** 2 - 4.2 ** 2) - 0.12]);
      for (let k = 12; k >= 0; k--) { const r = 4.2 * k / 12; pts.push([r, cb - Math.sqrt(DIM.lensRb ** 2 - r * r) - 0.1]); }
      add('corpus_vitreum', polyLathe(pts, { crease: 60 }), { renderOrder: 1 });

      const Rpap = Rri(180 - Math.acos(-DIM.papillaDir.z) / D2R) - 0.3;
      const a0 = DIM.papillaDir.clone().multiplyScalar(Rpap);
      const a1 = new THREE.Vector3(0, 0, DIM.lensFrontZ - DIM.lensT - 0.15);
      const mid = a0.clone().lerp(a1, 0.5); mid.y -= 0.5;
      const curve = new THREE.CatmullRomCurve3([a0, new THREE.Vector3().lerpVectors(a0, mid, 0.5), mid, new THREE.Vector3().lerpVectors(mid, a1, 0.5), a1]);
      add('canalis_hyaloideus', new THREE.TubeGeometry(curve, 48, 0.35, 12, false), { renderOrder: 2 });
    }

    // --- Zonulafasern ---
    {
      const pos = [], n = 144, cf = DIM.lensFrontZ - DIM.lensRf, cb = DIM.lensFrontZ - DIM.lensT + DIM.lensRb;
      for (let k = 0; k < n; k++) {
        const a = k / n * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
        // vordere Fasern: Ziliarfortsatz-Spitze → Linsenvorderfläche; hintere: Pars plicata/plana → Linsenrückfläche
        const a1 = a + 0.5 * Math.PI / n, c1 = Math.cos(a1), s1 = Math.sin(a1);
        let p = rz(Rcbi(phiAnt + 2.5) - DIM.procH * 0.9, phiAnt + 2.5);
        let rr = 4.35, zz = cf + Math.sqrt(DIM.lensRf ** 2 - rr * rr);
        pos.push(p[0] * c, p[0] * s, p[1], rr * c1, rr * s1, zz);
        p = rz(Rcbi(phiPlana - 0.5) - 0.1, phiPlana - 0.5);
        rr = 4.4; zz = cb - Math.sqrt(DIM.lensRb ** 2 - rr * rr);
        pos.push(p[0] * c, p[0] * s, p[1], rr * c1, rr * s1, zz);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const lm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
      lm.userData.baseOpacity = 0.55;
      lm.userData.isLine = true;
      EYE.materials.fibrae_zonulares = lm;
      add('fibrae_zonulares', null, { instanced: new THREE.LineSegments(g, lm) });
    }

    // --- Kammern (nur über Liste / Auswahl sichtbar) ---
    {
      const pts = [[0, DIM.corneaApexZ - DIM.corneaTc]];
      DIM.corneaInner.forEach((p) => { if (p[0] > 0) pts.push(p); });
      pts.push([5.9, zf(5.9)]);
      rsamp(5.9, DIM.pupilR, 12).forEach((r) => pts.push([r, zf(r)]));
      pts.push([DIM.pupilR, zb(DIM.pupilR)]);
      const cf = DIM.lensFrontZ - DIM.lensRf;
      for (let k = 0; k <= 8; k++) { const r = DIM.pupilR * (1 - k / 8); pts.push([r, cf + Math.sqrt(DIM.lensRf ** 2 - r * r)]); }
      add('camera_anterior', polyLathe(pts, { crease: 60 }), { renderOrder: 9 });

      const q = [];
      rsamp(5.9, DIM.pupilR + 0.03, 12).forEach((r) => q.push([r, zb(r) - 0.02]));
      for (let k = 0; k <= 10; k++) { const r = DIM.pupilR + 0.03 + (4.4 - DIM.pupilR) * k / 10; q.push([r, cf + Math.sqrt(DIM.lensRf ** 2 - r * r) + 0.02]); }
      q.push([4.9, lensZc + 0.4], [5.19, 8.3], rz(Rcbi(phiAnt), phiAnt), rz(Rcbi(phiAnt) + 0.6, phiAnt - 0.8));
      add('camera_posterior', polyLathe(q, { crease: 60 }), { renderOrder: 9 });
    }
  }
})();
