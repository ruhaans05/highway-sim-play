import * as THREE from 'three';
import { Villagers } from './villagers.js';
import { tree, forest, well, animal } from './props.js';

// ---------------------------------------------------------------------------
// Mughal Delhi — Shahjahanabad, Shah Jahan's walled capital on the Yamuna,
// 17th century. The red-sandstone Qila (Red Fort) with its Lahori Gate and the
// marble Diwan-i-Aam; the great Jama Masjid on its plinth with three domes and
// two soaring minarets; the Chandni Chowk bazaar with its central water canal
// and tree-lined shops; noble havelis, small mosques, a domed marble tomb in a
// charbagh garden, the city walls and Kashmiri Gate, a caravanserai. Court
// nobles, Mughal soldiers with spears, traders, faqirs, elephants and camels.
// ---------------------------------------------------------------------------

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mat(c, r = 0.9, m = 0) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); }

const RED = 0x9c3a2a, REDL = 0xb0492f, MARBLE = 0xeee6d8, SAND = 0xc79a5a;
const RIVER_LEVEL = -1.2;

function gh(x, z) {
  const undu = Math.sin(x * 0.004) * 0.5 + Math.cos(z * 0.005) * 0.4;
  let y = 2.0 + undu;
  if (x > 560) { const t = Math.min(1, (x - 560) / 90); y = 2.0 - t * 3.4; }   // Yamuna to the east
  return y;
}

export function buildDelhi(scene) {
  const rnd = rng(1631);

  // --- ground (dusty ochre plain, greener in gardens) ---
  const S = 2600, N = 150;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cDust = new THREE.Color(0xc2a878), cGarden = new THREE.Color(0x4f7a3a), cBank = new THREE.Color(0x8a7654);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = gh(x, z); p.setY(i, y);
    if (x > 540) tmp.copy(cBank);
    else if (x < -240 && z > 120) tmp.copy(cGarden);        // charbagh gardens
    else tmp.copy(cDust);
    tmp.offsetHSL(0, 0, Math.sin(x * 0.22 + z * 0.28) * 0.03);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  // --- the Yamuna (east) ---
  const river = new THREE.Mesh(new THREE.PlaneGeometry(700, 3000), mat(0x5a6a5a, 0.4, 0.15));
  river.rotation.x = -Math.PI / 2; river.position.set(760, RIVER_LEVEL + 0.3, 0); scene.add(river);

  // ---- shared architectural bits ----
  function chhatri(x, y, z, r = 0.8, col = MARBLE) {          // domed kiosk
    const g = new THREE.Group();
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, r * 2.4, 8), mat(col)); c.position.set(dx * r, r * 1.2, dz * r); g.add(c); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, 0.2, r * 2.6), mat(col)); roof.position.y = r * 2.4; g.add(roof);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(col, 0.5)); dome.position.y = r * 2.5; g.add(dome);
    g.position.set(x, y, z); return g;
  }
  function onionDome(r, col = MARBLE, stripe = true) {
    const g = new THREE.Group();
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, r * 0.5, 16), mat(col)); drum.position.y = r * 0.25; g.add(drum);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(col, 0.4)); dome.scale.y = 1.25; dome.position.y = r * 0.5; g.add(dome);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.9, 8), mat(0xd4af37, 0.3, 0.4)); fin.position.y = r * 1.7; g.add(fin);
    if (stripe) { const b = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, 0.06, 6, 20), mat(0x2a2a2a)); b.rotation.x = Math.PI / 2; b.position.y = r * 0.9; g.add(b); }
    return g;
  }
  function wallRun(cx, cz, len, rot, h = 9) {                  // crenellated fort wall
    const g = new THREE.Group();
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, h, 3), mat(RED, 1)); w.position.y = h / 2; g.add(w);
    const n = Math.floor(len / 3);
    for (let i = 0; i < n; i++) { const cr = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 3.2), mat(REDL, 1)); cr.position.set(-len / 2 + 1.5 + i * 3, h + 0.6, 0); g.add(cr); }
    g.position.set(cx, gh(cx, cz), cz); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g;
  }

  // ---- Red Fort ----
  function redFort() {
    // walls forming an L around the fort precinct on the east
    wallRun(300, 180, 160, 0);
    wallRun(300, -100, 160, 0);
    wallRun(220, 40, 280, Math.PI / 2);
    wallRun(500, 40, 280, Math.PI / 2);
    // Lahori Gate: tall red gatehouse with chhatris
    const gate = new THREE.Group();
    const gh0 = gh(300, 180);
    const body = new THREE.Mesh(new THREE.BoxGeometry(22, 16, 8), mat(RED, 1)); body.position.y = 8; gate.add(body);
    const arch = new THREE.Mesh(new THREE.BoxGeometry(5, 9, 8.4), mat(0x1a1512)); arch.position.set(0, 4.5, 0); gate.add(arch);
    for (const cx of [-9, -3, 3, 9]) gate.add(chhatri(cx, 16.5, 0, 0.8, REDL));
    for (const mx of [-11, 11]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 20, 10), mat(RED, 1)); t.position.set(mx, 10, 0); gate.add(t); gate.add(chhatri(mx, 20, 0, 1, REDL)); }
    gate.position.set(300, gh0, 200); gate.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(gate);
    // Diwan-i-Aam: open marble pillared hall inside
    const hall = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(24, 1.5, 12), mat(MARBLE)); plinth.position.y = 0.75; hall.add(plinth);
    for (let i = -4; i <= 4; i++) for (const dz of [-4, 4]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 6, 10), mat(MARBLE)); c.position.set(i * 2.6, 4.5, dz); hall.add(c); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(25, 1.2, 13), mat(MARBLE)); roof.position.y = 8; hall.add(roof);
    for (const cx of [-9, 0, 9]) hall.add(chhatri(cx, 8.6, 0, 0.9));
    hall.position.set(470, gh(470, 40), 40); hall.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(hall);
    // white marble pavilion (Diwan-i-Khas / Rang Mahal) by the river
    const pav = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 8), mat(MARBLE)); pav.position.set(510, gh(510, -60) + 3, -60); pav.castShadow = true; scene.add(pav);
    const pd = onionDome(2.2); pd.position.set(510, gh(510, -60) + 6, -60); scene.add(pd);
  }
  redFort();

  // ---- Jama Masjid ----
  function jamaMasjid(x, z) {
    const g = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(46, 4, 40), mat(REDL, 1)); plinth.position.y = 2; g.add(plinth);
    const steps = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 8), mat(REDL, 1)); steps.position.set(0, 1, 24); g.add(steps);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 14), mat(MARBLE)); hall.position.set(0, 10, -8); g.add(hall);
    // central iwan arch
    const iwan = new THREE.Mesh(new THREE.BoxGeometry(9, 12, 1), mat(0x2a2018)); iwan.position.set(0, 9, -0.9); g.add(iwan);
    // three domes with black marble stripes
    for (const [dx, r] of [[-9, 3.4], [0, 4.4], [9, 3.4]]) { const d = onionDome(r); d.position.set(dx, 16 + (r - 3.4), -8); g.add(d); }
    // two minarets
    for (const mx of [-22, 22]) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.7, 30, 12), mat(REDL, 1));
      // vertical marble ribs (stripes)
      shaft.position.set(mx, 19, 6); g.add(shaft);
      for (const by of [12, 20, 27]) { const bal = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.6, 12), mat(MARBLE)); bal.position.set(mx, by, 6); g.add(bal); }
      g.add(chhatri(mx, 34, 6, 1.2));
    }
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  jamaMasjid(60, 260);

  // ---- Chandni Chowk bazaar: canal + tree-lined shops ----
  function bazaar() {
    const z0 = 120;
    // central water canal
    const canal = new THREE.Mesh(new THREE.BoxGeometry(500, 0.3, 4), mat(0x3a6a8a, 0.3, 0.2)); canal.position.set(50, gh(0, z0) + 0.2, z0); scene.add(canal);
    for (let i = 0; i < 60; i++) {
      const x = -200 + i * 8.4;
      for (const side of [-1, 1]) {
        const zz = z0 + side * 9;
        const shop = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 5), mat([0xc2926a, 0xb5784a, 0xcf9a5a, 0xa5674a][(rnd() * 4) | 0], 1)); box.position.y = 1.7; shop.add(box);
        const awn = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.15, 2.2), mat([0x8a2020, 0x2a5a3a, 0xd0a020, 0x30507a][(rnd() * 4) | 0], 1)); awn.position.set(0, 2.7, side * -2.8); awn.rotation.x = side * 0.2; shop.add(awn);
        if (rnd() < 0.4) { const up = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.4, 4), mat(0xb98a6a, 1)); up.position.y = 4.7; shop.add(up); const jh = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 0.4), mat(SAND, 1)); jh.position.set(0, 4.7, side * -2.2); shop.add(jh); }
        shop.position.set(x, gh(x, zz), zz); shop.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(shop);
      }
      if (i % 3 === 0) { tree(scene, gh, -200 + i * 8.4, z0 + 3.5, 'mango', 1.0, rnd); }
    }
  }
  bazaar();

  // ---- havelis (noble courtyard houses) ----
  function haveli(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 13), mat(SAND, 1)); body.position.y = 4.5; g.add(body);
    const court = new THREE.Mesh(new THREE.BoxGeometry(7, 9.2, 6), mat(0x1a1512)); court.position.set(0, 4.6, 0); g.add(court); // dark courtyard void hint
    for (let i = -3; i <= 3; i++) for (const yy of [3, 6.5]) { const arc = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.5), mat(0x2a2018)); arc.position.set(i * 2.1, yy, 6.6); g.add(arc); }
    // jharokha balconies
    for (const jx of [-5, 5]) { const jh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 1.2), mat(REDL, 1)); jh.position.set(jx, 6.5, 7); g.add(jh); const jr = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, 1.6), mat(MARBLE)); jr.position.set(jx, 7.6, 7); g.add(jr); }
    const para = new THREE.Mesh(new THREE.BoxGeometry(16.6, 1, 13.6), mat(REDL, 1)); para.position.y = 9.5; g.add(para);
    for (const cx of [-7, 7]) g.add(chhatri(cx, 10, 0, 0.7, SAND));
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  for (let i = 0; i < 10; i++) haveli(-260 + rnd() * 120, -140 + rnd() * 140, rnd() * Math.PI);

  // ---- small neighbourhood mosque ----
  function smallMosque(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 7), mat(MARBLE)); body.position.y = 2.5; g.add(body);
    const d = onionDome(2); d.position.y = 5; g.add(d);
    for (const mx of [-4.5, 4.5]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 10, 8), mat(MARBLE)); t.position.set(mx, 5, 2.5); g.add(t); g.add(chhatri(mx, 10.5, 2.5, 0.5)); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  smallMosque(-120, 40, 0.3); smallMosque(180, -180, -0.4);

  // ---- domed tomb in a charbagh garden ----
  function tomb(x, z) {
    const g = new THREE.Group();
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(26, 5, 26), mat(REDL, 1)); plinth.position.y = 2.5; g.add(plinth);
    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 12, 18), mat(MARBLE)); body.position.y = 11; g.add(body);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const iw = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 1), mat(0x2a2018)); iw.position.set(dx * 0, 9, dz * 9.1); if (dx === 0) g.add(iw); }
    const iwx = new THREE.Mesh(new THREE.BoxGeometry(1, 9, 6), mat(0x2a2018)); iwx.position.set(9.1, 9, 0); g.add(iwx); const iwx2 = iwx.clone(); iwx2.position.x = -9.1; g.add(iwx2);
    const dome = onionDome(7); dome.position.y = 17; g.add(dome);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(chhatri(dx * 9, 17.5, dz * 9, 1.1));
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
    // charbagh: crossing water channels + cypress rows
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(120, 0.2, 3), mat(0x3a6a8a, 0.3, 0.2)); c1.position.set(x, gh(x, z) + 0.15, z); scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 120), mat(0x3a6a8a, 0.3, 0.2)); c2.position.set(x, gh(x, z) + 0.15, z); scene.add(c2);
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; tree(scene, gh, x + Math.cos(a) * 45, z + Math.sin(a) * 45, 'cypress', 0.9 + rnd() * 0.4, rnd); }
  }
  tomb(-360, 260);

  // ---- city wall + Kashmiri Gate (NW) ----
  wallRun(-300, -340, 200, 0, 10);
  (function kashmiriGate() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 13, 6), mat(RED, 1)); body.position.y = 6.5; g.add(body);
    for (const ax of [-4.5, 4.5]) { const arch = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 6.4), mat(0x1a1512)); arch.position.set(ax, 4, 0); g.add(arch); }
    for (const cx of [-6, 6]) g.add(chhatri(cx, 13, 0, 0.8, REDL));
    g.position.set(-300, gh(-300, -340), -340); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  })();

  // ---- caravanserai (courtyard of arched cells) with camels ----
  function serai(x, z) {
    for (const side of [-1, 1]) for (let i = -3; i <= 3; i++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 6), mat(SAND, 1));
      cell.position.set(x + i * 6.2, gh(x, z) + 2, z + side * 14); cell.castShadow = true; scene.add(cell);
      const arch = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 0.4), mat(0x2a2018)); arch.position.set(x + i * 6.2, gh(x, z) + 1.5, z + side * (14 - side * 3.2)); scene.add(arch);
    }
  }
  serai(200, -260);
  for (let i = 0; i < 6; i++) animal(scene, gh, 190 + rnd() * 40, -280 + rnd() * 30, rnd() * 6, 'camel');

  // ---- gardens, trees, wells, fountains ----
  forest(scene, gh, rnd, { x0: -420, x1: 120, z0: 60, z1: 340, count: 90, kinds: ['mango', 'neem', 'cypress'], s0: 0.9, s1: 1.6, skip: (x, z) => Math.hypot(x - (-360), z - 260) < 40 });
  forest(scene, gh, rnd, { x0: -420, x1: 500, z0: -420, z1: 420, count: 70, kinds: ['mango', 'neem', 'babul'], s0: 0.8, s1: 1.5, skip: (x, z) => (x > 200 && x < 520 && z > -120 && z < 220) });
  well(scene, gh, -100, 0); well(scene, gh, 40, 80); well(scene, gh, -220, -100);
  function fountain(x, z) {
    const g = new THREE.Group();
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.8, 20), mat(MARBLE)); basin.position.y = 0.4; g.add(basin);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 20), mat(0x3a6a8a, 0.2, 0.3)); water.position.y = 0.7; g.add(water);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 6), mat(0x9fc0d8, 0.2, 0.3)); jet.position.y = 1.6; g.add(jet);
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  fountain(0, 40); fountain(-360, 260);

  // caparisoned elephants + horses about the court
  for (let i = 0; i < 3; i++) animal(scene, gh, 260 + rnd() * 120, 120 + rnd() * 60, rnd() * 6, 'elephant');
  for (let i = 0; i < 10; i++) animal(scene, gh, -100 + rnd() * 400, -100 + rnd() * 200, rnd() * 6, 'horse');

  // --- Mughal flag (green imperial standard) over the fort gate ---
  (function flag() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 12, 6), mat(0xd4af37, 0.3, 0.5)); pole.position.y = 6; g.add(pole);
    const cv = document.createElement('canvas'); cv.width = 90; cv.height = 60; const c = cv.getContext('2d');
    c.fillStyle = '#0a6b34'; c.fillRect(0, 0, 90, 60); c.strokeStyle = '#e8c94a'; c.lineWidth = 4;
    c.beginPath(); c.arc(46, 30, 15, 0.5, Math.PI * 1.55); c.stroke(); // crescent
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 })); fl.position.set(1.8, 10.5, 0); g.add(fl);
    g.position.set(300, gh(300, 210) + 24, 210); scene.add(g);
  })();

  // --- people of the court + city ---
  const villagers = new Villagers(scene, 'delhi', gh, [
    { role: 'noble', count: 8, x: 460, z: 40, spread: 60, idle: 0.5 },      // Diwan-i-Aam
    { role: 'courtier', count: 12, x: 440, z: 40, spread: 80 },
    { role: 'mughal', count: 16, x: 300, z: 120, spread: 120, idle: 0.3 },  // guards
    { role: 'mughal', count: 8, x: 300, z: 200, spread: 30, idle: 0.5 },    // gate guard
    { role: 'trader', count: 20, x: 0, z: 120, spread: 220 },               // Chandni Chowk
    { role: 'merchant', count: 12, x: 40, z: 120, spread: 180, idle: 0.5 },
    { role: 'woman', count: 18, x: -40, z: 100, spread: 200 },
    { role: 'child', count: 14, x: 0, z: 90, spread: 200 },
    { role: 'farmer', count: 16, x: -20, z: 60, spread: 240 },              // labourers / water-carriers
    { role: 'noble', count: 4, x: -260, z: -80, spread: 60, idle: 0.6 },    // havelis
    { role: 'sadhu', count: 4, x: -360, z: 260, spread: 40, idle: 0.7 },    // faqirs at the tomb
    { role: 'trader', count: 8, x: 200, z: -260, spread: 40 },              // caravanserai
  ], 733);

  return {
    groundHeight: gh, seaLevel: RIVER_LEVEL,
    update(dt, t) { river.material.color.setHSL(0.33, 0.15, 0.34 + 0.02 * Math.sin(t * 0.5)); villagers.update(dt); },
  };
}
