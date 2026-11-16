import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Shared village props for the walking maps: trees & forest cover, animals,
// old vehicles, wells & hand-pumps, street furniture, and cloth banners
// (independence-movement slogans, religious flags). Every builder takes
// (scene, gh, x, z, ...) where gh(x,z) is the world's ground-height function.
// ---------------------------------------------------------------------------

function mat(c, r = 0.9) { return new THREE.MeshStandardMaterial({ color: c, roughness: r }); }
function shadowify(g) { g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }

// ---- trees ---------------------------------------------------------------
// kinds: 'mango' 'neem' 'peepal' 'banyan' 'palm' 'babul' 'cypress'
export function tree(scene, gh, x, z, kind = 'mango', s = 1, rnd = Math.random) {
  const g = new THREE.Group();
  if (kind === 'palm') {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.26 * s, 7 * s, 6), mat(0x8a6a44));
    tr.position.y = 3.5 * s; tr.rotation.z = (rnd() - 0.5) * 0.2; g.add(tr);
    for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 3.2 * s), mat(0x2f6b2a)); f.position.y = 7 * s; f.rotation.y = i * 0.9; f.rotation.z = -0.5 - rnd() * 0.2; f.geometry.translate(0, 0, 1.6 * s); g.add(f); }
  } else if (kind === 'cypress') {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 1.5 * s, 6), mat(0x5a4630)); tr.position.y = 0.75 * s; g.add(tr);
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.3 * s, 8 * s, 8), mat(0x2f5230)); c.position.y = 5 * s; g.add(c);
  } else {
    const trunkC = kind === 'babul' ? 0x6a5236 : 0x5a4630;
    const leafC = kind === 'neem' ? 0x3f6a2a : kind === 'babul' ? 0x6a8a3a : kind === 'peepal' ? 0x3f6a2a : 0x356b2a;
    const th = kind === 'babul' ? 3 : 4.5;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * s, 0.7 * s, th * s, 7), mat(trunkC)); tr.position.y = th / 2 * s; g.add(tr);
    const lobes = kind === 'banyan' ? 5 : 3;
    for (let i = 0; i < lobes; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry((2.6 + rnd() * 1.8) * s, 8, 6), mat(leafC)); c.position.set((rnd() - 0.5) * 4 * s, (th + 1.5 + rnd()) * s, (rnd() - 0.5) * 4 * s); g.add(c); }
    if (kind === 'banyan') for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, th * s, 5), mat(trunkC)); r.position.set((rnd() - 0.5) * 5 * s, th / 2 * s, (rnd() - 0.5) * 5 * s); g.add(r); }
  }
  g.position.set(x, gh(x, z), z); scene.add(shadowify(g)); return g;
}

// scatter a forest belt of mixed trees inside a rectangle, skipping a keep-out fn
export function forest(scene, gh, rnd, { x0, x1, z0, z1, count, kinds = ['mango', 'neem', 'peepal'], s0 = 0.8, s1 = 1.5, skip }) {
  for (let i = 0; i < count; i++) {
    const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
    if (skip && skip(x, z)) continue;
    tree(scene, gh, x, z, kinds[(rnd() * kinds.length) | 0], s0 + rnd() * (s1 - s0), rnd);
  }
}

// ---- animals -------------------------------------------------------------
// type: 'cow' 'buffalo' 'goat' 'dog' 'horse' 'camel' 'elephant' 'pig' 'chicken'
export function animal(scene, gh, x, z, rot = 0, type = 'cow') {
  const g = new THREE.Group();
  const cfg = {
    cow: { c: 0xcdbf9a, L: 2.4, W: 0.9, H: 1.1, legH: 1.0, horns: true, hump: true },
    buffalo: { c: 0x3a3634, L: 2.6, W: 1.1, H: 1.2, legH: 1.0, horns: true },
    goat: { c: 0xd8d2c4, L: 1.1, W: 0.4, H: 0.55, legH: 0.5, horns: true },
    dog: { c: 0xb0824a, L: 1.0, W: 0.32, H: 0.42, legH: 0.4 },
    pig: { c: 0x6a5a52, L: 1.1, W: 0.5, H: 0.55, legH: 0.35 },
    horse: { c: 0x6a4a2a, L: 2.4, W: 0.7, H: 1.4, legH: 1.4, mane: true },
    camel: { c: 0xc2a878, L: 2.8, W: 0.9, H: 1.9, legH: 2.0, hump: true, neck: true },
    elephant: { c: 0x8a8a8a, L: 4.2, W: 1.8, H: 3.0, legH: 2.2, trunk: true, big: true },
    chicken: { c: 0xd8d0c0, L: 0.4, W: 0.25, H: 0.35, legH: 0.25 },
  }[type];
  const m = mat(cfg.c, 0.85);
  const body = new THREE.Mesh(new THREE.BoxGeometry(cfg.W, cfg.H, cfg.L), m); body.position.y = cfg.legH + cfg.H / 2; g.add(body);
  if (cfg.hump) { const h = new THREE.Mesh(new THREE.SphereGeometry(cfg.W * 0.55, 8, 6), m); h.position.set(0, cfg.legH + cfg.H, cfg.L * 0.15); g.add(h); }
  const legLen = cfg.legH;
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, 1], [1, 1], [-1, -1], [1, -1]].slice(0, cfg.big ? 4 : 4)) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(cfg.W * 0.22, legLen, cfg.W * 0.22), mat(cfg.c, 0.9));
    l.position.set(lx * cfg.W * 0.32, legLen / 2, lz * cfg.L * 0.34); g.add(l);
  }
  // head / neck
  const neckLen = cfg.neck ? 1.4 : cfg.trunk ? 0.4 : 0.5;
  const head = new THREE.Mesh(new THREE.BoxGeometry(cfg.W * 0.7, cfg.H * 0.7, 0.8), m);
  head.position.set(0, cfg.legH + cfg.H + (cfg.neck ? 1.0 : cfg.trunk ? 0.6 : 0.2), cfg.L / 2 + neckLen * 0.5); g.add(head);
  if (cfg.trunk) { const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 2.0, 6), m); tk.position.set(0, cfg.legH + cfg.H - 0.4, cfg.L / 2 + 0.9); tk.rotation.x = 0.5; g.add(tk); const e1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 1.4), m); e1.position.set(-0.7, cfg.legH + cfg.H + 0.6, cfg.L / 2); g.add(e1); const e2 = e1.clone(); e2.position.x = 0.7; g.add(e2); }
  if (cfg.horns) { for (const hx of [-1, 1]) { const hn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 5), mat(0xe8e0d0)); hn.position.set(hx * 0.2, cfg.legH + cfg.H + 0.5, cfg.L / 2 + neckLen * 0.5); hn.rotation.z = hx * 0.5; g.add(hn); } }
  if (cfg.mane) { const mn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.2), mat(0x2a1a10)); mn.position.set(0, cfg.legH + cfg.H + 0.3, cfg.L * 0.2); g.add(mn); }
  g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
}

// ---- old vehicles --------------------------------------------------------
// 1920s motorcar (Raj-era boxy black saloon / Model-T-ish)
export function vintageCar(scene, gh, x, z, rot = 0, color = 0x1a1a1a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 3.6), mat(color, 0.4)); body.position.y = 0.9; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.7), mat(0x111, 0.3)); cabin.position.set(0, 1.55, -0.4); g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.2), mat(color, 0.4)); hood.position.set(0, 0.95, 1.6); g.add(hood);
  const rad = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.2), mat(0x999, 0.3)); rad.position.set(0, 0.95, 2.25); g.add(rad);
  for (const sx of [-0.55, 0.55]) { const lp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(0xf5f0d0, 0.3)); lp.position.set(sx, 1.05, 2.2); g.add(lp); }
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 2.0), mat(0x222, 0.5)); board.position.set(0, 0.55, 0); g.add(board);
  for (const [wx, wz] of [[-0.9, 1.2], [0.9, 1.2], [-0.9, -1.2], [0.9, -1.2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 12), mat(0x1a1a1a, 0.7)); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); }
  g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
}

// horse-drawn tonga / carriage
export function tonga(scene, gh, x, z, rot = 0) {
  const g = new THREE.Group();
  const horse = animal({ add() {} }, () => 0, 0, 0, 0, 'horse'); // build detached, then attach
  horse.position.set(0, 0, 2.6); g.add(horse);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.2), mat(0x8a5a30)); bed.position.set(0, 1.0, -0.3); g.add(bed);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 2.2), mat(0x7a2020, 0.9)); canopy.position.set(0, 2.1, -0.3); g.add(canopy);
  for (const cx of [-0.8, 0.8]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), mat(0x5a3a1a)); po.position.set(cx, 1.55, -0.3); g.add(po); }
  for (const wx of [-1.0, 1.0]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 14), mat(0x5a4630)); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.75, -0.6); g.add(w); }
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.6), mat(0x5a3a1a)); shaft.position.set(0, 0.9, 1.3); g.add(shaft);
  g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
}

// ---- water: well + hand-pump --------------------------------------------
export function well(scene, gh, x, z) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 1.3, 16), mat(0x8a7a68)); ring.position.y = 0.65; g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, 1.35, 16), mat(0x2a2a2a, 1)); ring2.position.y = 0.68; g.add(ring2);
  for (const px of [-1.4, 1.4]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 6), mat(0x6a4a2a)); po.position.set(px, 1.9, 0); g.add(po); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 6), mat(0x6a4a2a)); bar.rotation.z = Math.PI / 2; bar.position.y = 3.1; g.add(bar);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4), mat(0x9a8a6a)); rope.position.set(0, 2.3, 0); g.add(rope);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.35, 8), mat(0x5a3a1a)); bucket.position.set(0, 1.4, 0); g.add(bucket);
  g.position.set(x, gh(x, z), z); scene.add(shadowify(g)); return g;
}
export function handpump(scene, gh, x, z) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), mat(0x777)); base.position.y = 0.15; g.add(base);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 8), mat(0x2a4a6a, 0.4)); col.position.y = 0.85; g.add(col);
  const spout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), mat(0x2a4a6a, 0.4)); spout.position.set(0.25, 1.2, 0); g.add(spout);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), mat(0x333)); handle.position.set(-0.2, 1.4, 0); handle.rotation.z = 0.3; g.add(handle);
  g.position.set(x, gh(x, z), z); scene.add(shadowify(g)); return g;
}

// ---- street furniture ----------------------------------------------------
export function charpai(scene, gh, x, z, rot = 0) {   // rope cot
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 2.0), mat(0xcdb98a, 1)); frame.position.y = 0.5; g.add(frame);
  for (const [lx, lz] of [[-0.4, 0.9], [0.4, 0.9], [-0.4, -0.9], [0.4, -0.9]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), mat(0x6a4a2a)); l.position.set(lx, 0.25, lz); g.add(l); }
  g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
}
export function haystack(scene, gh, x, z) {
  const g = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 10), mat(0xc2a24a, 1));
  g.castShadow = true; g.position.set(x, gh(x, z) + 1.5, z); scene.add(g); return g;
}

// ---- banners / flags: independence movement + religious ------------------
function bannerTex(text, bg, fg) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg; g.textAlign = 'center'; g.font = 'bold 30px Georgia';
  g.fillText(text, 128, 44);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
// cloth banner strung between two poles
export function banner(scene, gh, x, z, rot, text, bg = '#c21f2f', fg = '#f5f0d0') {
  const g = new THREE.Group();
  for (const px of [-2.4, 2.4]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), mat(0x6a4a2a)); po.position.set(px, 1.7, 0); g.add(po); }
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.1), new THREE.MeshStandardMaterial({ map: bannerTex(text, bg, fg), side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.position.set(0, 2.6, 0); g.add(cloth);
  g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
}
// the 1921 Swaraj flag (Congress): red/green with a white charkha band
export function swarajFlag(scene, gh, x, z, khilafat = false) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 6), mat(0x8a6a44)); pole.position.y = 3; g.add(pole);
  const cv = document.createElement('canvas'); cv.width = 90; cv.height = 60; const c = cv.getContext('2d');
  if (khilafat) { c.fillStyle = '#0a6b2a'; c.fillRect(0, 0, 90, 60); c.fillStyle = '#fff'; c.beginPath(); c.arc(40, 30, 16, 0.4, Math.PI * 1.6); c.fill(); c.fillStyle = '#0a6b2a'; c.beginPath(); c.arc(46, 30, 13, 0.4, Math.PI * 1.6); c.fill(); }
  else { c.fillStyle = '#c21f2f'; c.fillRect(0, 0, 90, 20); c.fillStyle = '#fff'; c.fillRect(0, 20, 90, 20); c.fillStyle = '#0a7a34'; c.fillRect(0, 40, 90, 20); c.strokeStyle = '#1a3a8a'; c.lineWidth = 2; c.beginPath(); c.arc(45, 30, 9, 0, 7); c.stroke(); for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(45, 30); c.lineTo(45 + Math.cos(i / 8 * 7) * 9, 30 + Math.sin(i / 8 * 7) * 9); c.stroke(); } }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
  flag.position.set(1.4, 5, 0); g.add(flag);
  g.position.set(x, gh(x, z), z); scene.add(shadowify(g)); return g;
}
