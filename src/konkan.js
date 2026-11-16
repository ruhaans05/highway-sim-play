import * as THREE from 'three';
import { Villagers } from './villagers.js';
import { tree, forest, well, handpump, charpai, animal, vintageCar, tonga, banner, swarajFlag } from './props.js';

// ---------------------------------------------------------------------------
// Konkan village, Maharashtra–Goa border, c. 1920s under the Raj. The wadi of
// laterite houses with terracotta-tiled roofs sits on the coastal plain: coconut
// palms, a temple square with a banyan, paddy terraces climbing east toward the
// blue Sahyadri ghats, and the Arabian Sea with its beach and fishing jetty to
// the west. A small colonial town centre — cutchery, church, bazaar, police
// chowki, the Union Jack — marks the reach of empire.
// ---------------------------------------------------------------------------

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mat(c, r = 0.9) { return new THREE.MeshStandardMaterial({ color: c, roughness: r }); }

const SEA_LEVEL = -1.0;

// Terrain height: flat coastal plain, beach sloping into the sea to the west,
// hills rising toward the Sahyadri ghats to the east.
function gh(x, z) {
  const undu = Math.sin(x * 0.006) * 1.1 + Math.cos(z * 0.007) * 1.0 + Math.sin((x + z) * 0.013) * 0.55;
  let y;
  if (x < -420) {
    const t = (-420 - x) / 120;            // 0 at -420 (beach) → 1 at -540 (sea)
    y = 1.1 - t * 3.2;
  } else {
    y = 2.0 + undu * 0.6;
  }
  if (x > 240) {                            // ghats rise to the east
    const h = x - 240;
    y += Math.min(150, h * 0.17) * (1 + 0.14 * Math.sin(z * 0.02));
  }
  return y;
}

export function buildKonkan(scene) {
  const rnd = rng(4021);

  // --- ground mesh (vertex-coloured: sand / green plain / hillside) ---
  const S = 2400, N = 150;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cSand = new THREE.Color(0xd9c79a), cGreen = new THREE.Color(0x5f8a3e), cHill = new THREE.Color(0x6f7d3c), cDry = new THREE.Color(0x8a9450);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = gh(x, z); p.setY(i, y);
    if (x < -400) tmp.copy(cSand);
    else if (x > 300) tmp.copy(cHill).lerp(cDry, Math.min(1, (y - 6) / 60));
    else tmp.copy(cGreen);
    tmp.offsetHSL(0, 0, (Math.sin(x * 0.3 + z * 0.2) * 0.03));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  // --- the Arabian Sea (west) ---
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1c6b86, roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 3000, 1, 1), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(-1150, SEA_LEVEL + 0.35, 0); scene.add(sea);

  // --- distant Sahyadri range (far east backdrop) ---
  const ghatMat = mat(0x3f5a6b, 1);
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(200 + rnd() * 160, 340 + rnd() * 260, 6), ghatMat);
    c.position.set(900 + rnd() * 700, 40, -900 + i * 240 + rnd() * 120);
    scene.add(c);
  }

  // --- prop builders ---
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 7 * s, 6), mat(0x8a6a44));
    tr.position.y = 3.5 * s; tr.rotation.z = (rnd() - 0.5) * 0.2; g.add(tr);
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 3.2 * s), mat(0x2f6b2a));
      f.position.y = 7 * s; f.rotation.y = i * 0.9; f.rotation.z = -0.5 - rnd() * 0.2;
      f.geometry.translate(0, 0, 1.6 * s); g.add(f);
    }
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function banyan(x, z, s = 1) {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * s, 1.0 * s, 4 * s, 8), mat(0x5a4630));
    tr.position.y = 2 * s; g.add(tr);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry((3.4 + rnd() * 1.6) * s, 8, 6), mat(0x2f5a26));
      c.position.set((rnd() - 0.5) * 4 * s, (4.5 + rnd()) * s, (rnd() - 0.5) * 4 * s); g.add(c);
    }
    for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4 * s, 5), mat(0x5a4630)); r.position.set((rnd() - 0.5) * 5 * s, 2 * s, (rnd() - 0.5) * 5 * s); g.add(r); }
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // Konkan house: laterite/whitewashed walls, sloped terracotta-tiled roof
  function house(x, z, rot = 0, big = false) {
    const g = new THREE.Group();
    const w = big ? 8 : 5.4, d = big ? 6 : 4.4, h = big ? 3.4 : 2.7;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(rnd() < 0.5 ? 0x9a5b3f : 0xd8cbb2));
    wall.position.y = h / 2; g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, big ? 2.6 : 2.0, 4), mat(0xb5502f, 0.95));
    roof.rotation.y = Math.PI / 4; roof.position.y = h + (big ? 1.3 : 1.0); roof.scale.set(1, 1, d / w); g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.1), mat(0x4a3220));
    door.position.set(0, 0.95, d / 2 + 0.02); g.add(door);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g);
  }
  function temple(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 9), mat(0xe6ddc8)); base.position.y = 1; g.add(base);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), mat(0xefe7d2)); hall.position.y = 3.5; g.add(hall);
    const shik = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 8), mat(0xd8b26a)); shik.position.y = 8; g.add(shik);
    const kal = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), mat(0xe8c94a, 0.4)); kal.position.y = 11.2; g.add(kal);
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // Colonial bungalow / cutchery, whitewashed with a veranda + Union Jack
  function bungalow(x, z, rot, flag = true) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 9), mat(0xf0ead8)); body.position.y = 2; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.5, 10.6), mat(0x7a3a2a)); roof.position.y = 4.4; g.add(roof);
    for (let i = -3; i <= 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.6, 8), mat(0xe8e0cc)); c.position.set(i * 2, 1.8, 4.9); g.add(c); }
    const ver = new THREE.Mesh(new THREE.BoxGeometry(15, 0.3, 3), mat(0xcfc4a8)); ver.position.set(0, 0.15, 6); g.add(ver);
    if (flag) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 6), mat(0x777)); pole.position.set(-8, 6.5, 0); g.add(pole);
      const jack = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshStandardMaterial({ map: unionJack(), side: THREE.DoubleSide, roughness: 0.9 }));
      jack.position.set(-6.7, 10, 0); g.add(jack);
    }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function church(x, z, rot) {
    const g = new THREE.Group();
    const nave = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 16), mat(0xf2ede0)); nave.position.y = 3; g.add(nave);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3, 16.4), mat(0x9a4a3a)); roof.rotation.z = 0; roof.position.y = 7; roof.scale.set(1, 1, 1); g.add(roof);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 12, 4), mat(0xf2ede0)); tower.position.set(0, 6, 9); g.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 4), mat(0x7a3a2a)); spire.position.set(0, 14.5, 9); g.add(spire);
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 0.3), mat(0xdcdcdc)); cv.position.set(0, 18, 9); g.add(cv);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.3), mat(0xdcdcdc)); ch.position.set(0, 17.6, 9); g.add(ch);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function stall(x, z) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 2.4), mat([0xb02020, 0x207040, 0xd0a020, 0x2050a0][(rnd() * 4) | 0], 0.95)); top.position.y = 2.3; g.add(top);
    for (const [sx, sz] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 5), mat(0x6a4a2a)); po.position.set(sx, 1.15, sz); g.add(po); }
    const tbl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.2), mat(0x8a6a44)); tbl.position.set(0, 1, 0); g.add(tbl);
    g.position.set(x, gh(x, z), z); g.rotation.y = rnd() * Math.PI; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // paddy terrace: low green field patch with bunds
  function paddy(x, z, w, d) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), mat(0x6fae4a, 1));
    f.position.set(x, gh(x, z) + 0.08, z); f.receiveShadow = true; scene.add(f);
  }
  function jetty(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 10; i++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 2), mat(0x6a4a2a)); pl.position.set(0, 1.1, -i * 2); g.add(pl); const po = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 5), mat(0x4a3220)); po.position.set(1.2, -0.3, -i * 2); g.add(po); const po2 = po.clone(); po2.position.x = -1.2; g.add(po2); }
    g.position.set(x, SEA_LEVEL, z); scene.add(g);
    // a couple of fishing boats
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 5), mat([0x9a3020, 0x206a8a, 0xd0a020][i])); b.position.set(x - 6 - i * 4, SEA_LEVEL + 0.3, z - 4 - i * 3); b.rotation.y = rnd(); scene.add(b); }
  }

  // mosque with dome + minarets (the village is mixed Hindu–Muslim)
  function mosque(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(11, 5, 8), mat(0xe8e2d0)); body.position.y = 2.5; g.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xe0d8bc, 0.5)); dome.position.y = 5; g.add(dome);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 6), mat(0xd8b26a, 0.4)); fin.position.y = 7.4; g.add(fin);
    for (const mx of [-5, 5]) { const min = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 11, 8), mat(0xe8e2d0)); min.position.set(mx, 5.5, 3); g.add(min); const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), mat(0x2f7a4a)); cap.position.set(mx, 11.5, 3); g.add(cap); }
    for (let i = -2; i <= 2; i++) { const arc = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3, 0.4), mat(0x2a2a2a)); arc.position.set(i * 2, 2, 4.05); g.add(arc); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // 20th-century colonial masonry: a two-storey school / dispensary
  function bigBuilding(x, z, rot, label) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 11), mat(0xcf9a5a)); body.position.y = 4; g.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(20.4, 0.6, 11.4), mat(0xe8dcc4)); band.position.y = 4.2; g.add(band);
    for (let i = -4; i <= 4; i++) for (const yy of [2.5, 6]) { const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.2), mat(0x243040, 0.3)); win.position.set(i * 2, yy, 5.6); g.add(win); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(21, 0.5, 12), mat(0x7a3a2a)); roof.position.y = 8.3; g.add(roof);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }

  // --- lay out the world ---
  temple(0, 0);
  mosque(120, 60, -0.5);                    // mosque a short walk from the temple
  banyan(60, -140, 1.2);
  banyan(-20, 20, 0.9);
  // the wadi: cluster of houses around the square + hamlet to the NE
  for (let i = 0; i < 26; i++) {
    const x = -140 + rnd() * 220, z = 40 + rnd() * 160;
    if (Math.hypot(x, z) < 18) continue;
    house(x, z, rnd() * Math.PI);
  }
  for (let i = 0; i < 10; i++) house(-40 + rnd() * 140, -120 + rnd() * 90, rnd() * Math.PI);
  // coconut palms everywhere on the plain
  for (let i = 0; i < 120; i++) {
    const x = -400 + rnd() * 640, z = -300 + rnd() * 620;
    if (x > 240 && gh(x, z) > 20) continue;
    palm(x, z, 0.8 + rnd() * 0.6);
  }
  // paddy terraces to the east
  for (let i = 0; i < 22; i++) paddy(180 + rnd() * 200, -60 + rnd() * 300, 22 + rnd() * 18, 16 + rnd() * 14);
  // beach + sea
  jetty(-470, -40);
  // colonial town centre (SE edge)
  bungalow(300, -230, -0.4, true);        // cutchery
  church(380, -80, 0.2);
  for (let i = 0; i < 14; i++) stall(220 + rnd() * 80, -160 + rnd() * 70);
  bungalow(360, -200, 0.3, false);        // police chowki-ish
  // town-edge houses
  for (let i = 0; i < 12; i++) house(240 + rnd() * 120, -240 + rnd() * 120, rnd() * Math.PI, rnd() < 0.3);

  // --- forest cover: mango/betelnut groves ringing the plain, denser inland ---
  forest(scene, gh, rnd, { x0: -380, x1: 240, z0: -320, z1: 320, count: 140, kinds: ['mango', 'palm', 'neem', 'banyan'], s0: 0.8, s1: 1.6, skip: (x, z) => Math.hypot(x, z) < 90 || (x > 200 && z < -100) });
  forest(scene, gh, rnd, { x0: 260, x1: 640, z0: -300, z1: 340, count: 90, kinds: ['mango', 'neem', 'palm'], s0: 1.0, s1: 1.8 });   // wooded lower ghats
  forest(scene, gh, rnd, { x0: -420, x1: -380, z0: -300, z1: 300, count: 30, kinds: ['palm'], s0: 1.0, s1: 1.5 });                    // coastal palm line

  // --- koliwada: a dense fisherfolk slum lane behind the beach ---
  for (let i = 0; i < 24; i++) house(-380 + rnd() * 80, -140 + rnd() * 220, rnd() * Math.PI);
  for (let i = 0; i < 6; i++) charpai(scene, gh, -360 + rnd() * 60, -100 + rnd() * 180, rnd() * Math.PI);

  // --- a 20th-century mission school / dispensary on the town edge ---
  bigBuilding(430, -150, 0.2, 'school');
  bigBuilding(300, -300, -0.3, 'dispensary');

  // --- wells & hand-pumps ---
  well(scene, gh, 20, 30); well(scene, gh, -90, 110); well(scene, gh, 250, -140);
  handpump(scene, gh, -30, 60); handpump(scene, gh, 200, 40); handpump(scene, gh, -360, -40);

  // --- animals: cattle, goats, dogs, chickens ---
  for (let i = 0; i < 10; i++) animal(scene, gh, -60 + rnd() * 260, -60 + rnd() * 240, rnd() * 6, 'cow');
  for (let i = 0; i < 14; i++) animal(scene, gh, -100 + rnd() * 320, -80 + rnd() * 260, rnd() * 6, 'goat');
  for (let i = 0; i < 8; i++) animal(scene, gh, -80 + rnd() * 300, -40 + rnd() * 220, rnd() * 6, 'dog');
  for (let i = 0; i < 16; i++) animal(scene, gh, -60 + rnd() * 200, 0 + rnd() * 160, rnd() * 6, 'chicken');
  for (let i = 0; i < 3; i++) animal(scene, gh, 240 + rnd() * 60, -180 + rnd() * 80, rnd() * 6, 'horse');

  // --- old vehicles at the colonial town centre ---
  vintageCar(scene, gh, 300, -240, 0.6);
  vintageCar(scene, gh, 340, -190, -0.4, 0x24303a);
  tonga(scene, gh, 250, -100, 1.2); tonga(scene, gh, 120, -60, -0.6);

  // --- political & religious currents, c. 1920–22 (Non-Cooperation / Khilafat) ---
  banner(scene, gh, 0, -30, 0.2, 'VANDE MATARAM', '#c21f2f', '#f5f0d0');
  banner(scene, gh, 220, -110, -0.5, 'BOYCOTT FOREIGN CLOTH', '#0a5a2a', '#f5f0d0');
  banner(scene, gh, -60, 90, 0.4, 'SWARAJ IS MY BIRTHRIGHT', '#c8801a', '#241a10');
  swarajFlag(scene, gh, 30, 10);
  swarajFlag(scene, gh, 118, 58, true);      // Khilafat green flag by the mosque
  banner(scene, gh, 100, 50, -0.5, 'HINDU–MUSLIM EKTA', '#0a5a2a', '#f5f0d0');

  // --- villagers ---
  const villagers = new Villagers(scene, 'konkan', gh, [
    { role: 'brahmin', count: 4, x: 0, z: 0, spread: 16, idle: 0.6 },
    { role: 'woman', count: 16, x: -60, z: 80, spread: 90 },
    { role: 'farmer', count: 18, x: 220, z: 120, spread: 130 },
    { role: 'fisher', count: 12, x: -430, z: -30, spread: 70 },
    { role: 'child', count: 14, x: -40, z: 40, spread: 100 },
    { role: 'merchant', count: 8, x: 245, z: -130, spread: 45, idle: 0.6 },
    { role: 'woman', count: 8, x: 245, z: -130, spread: 50 },
    { role: 'british', count: 5, x: 305, z: -215, spread: 40, idle: 0.35 },
    { role: 'sepoy', count: 6, x: 300, z: -190, spread: 55, idle: 0.3 },
    { role: 'farmer', count: 10, x: -80, z: 100, spread: 120 },
    { role: 'sadhu', count: 2, x: 10, z: 10, spread: 20, idle: 0.7 },
  ], 917);

  // gentle sea shimmer
  return {
    groundHeight: gh, seaLevel: SEA_LEVEL,
    update(dt, t) { seaMat.color.setHSL(0.53, 0.6, 0.30 + 0.03 * Math.sin(t * 0.6)); villagers.update(dt); },
  };
}

// Union Jack canvas texture
function unionJack() {
  const cv = document.createElement('canvas'); cv.width = 96; cv.height = 60;
  const g = cv.getContext('2d');
  g.fillStyle = '#00247d'; g.fillRect(0, 0, 96, 60);
  g.strokeStyle = '#fff'; g.lineWidth = 12; g.beginPath(); g.moveTo(0, 0); g.lineTo(96, 60); g.moveTo(96, 0); g.lineTo(0, 60); g.stroke();
  g.strokeStyle = '#cf142b'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(96, 60); g.moveTo(96, 0); g.lineTo(0, 60); g.stroke();
  g.fillStyle = '#fff'; g.fillRect(38, 0, 20, 60); g.fillRect(0, 20, 96, 20);
  g.fillStyle = '#cf142b'; g.fillRect(42, 0, 12, 60); g.fillRect(0, 24, 96, 12);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
