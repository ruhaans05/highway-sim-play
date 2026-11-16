import * as THREE from 'three';
import { Villagers } from './villagers.js';
import { tree, forest, well, handpump, charpai, haystack, animal, vintageCar, tonga, banner, swarajFlag } from './props.js';

// ---------------------------------------------------------------------------
// Rural Bihar village, Gangetic plains, c. 1920s under the Raj. Flat, dusty,
// dense: mud-and-thatch kaccha houses packed along narrow lanes off the chowk,
// the zamindar's brick haveli lording over them, a segregated caste tola set
// apart at the margin, wheat and paddy to the horizon, the Ganga on its
// embankment to the north — and the apparatus of empire pressing in: the
// collectorate/thana under the Union Jack, an indigo kothi with its chimney,
// and a small railway halt.
// ---------------------------------------------------------------------------

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mat(c, r = 0.95) { return new THREE.MeshStandardMaterial({ color: c, roughness: r }); }

const RIVER_LEVEL = -1.2;

// Flat plain with gentle undulation; the ground drops to the Ganga to the north.
function gh(x, z) {
  const undu = Math.sin(x * 0.004) * 0.7 + Math.cos(z * 0.005) * 0.6 + Math.sin((x - z) * 0.011) * 0.4;
  let y = 1.6 + undu;
  if (z < -340) {                            // embankment down to the river
    const t = Math.min(1, (-340 - z) / 90);
    y = 1.6 - t * 3.2;
  }
  return y;
}

export function buildBihar(scene) {
  const rnd = rng(2718);

  // --- ground mesh (dusty tan plain, greener near fields, mud by the river) ---
  const S = 2600, N = 150;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cDust = new THREE.Color(0xbfa878), cField = new THREE.Color(0x8a9a4a), cMud = new THREE.Color(0x7a6446), cWheat = new THREE.Color(0xcdb56a);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = gh(x, z); p.setY(i, y);
    if (z < -330) tmp.copy(cMud);
    else if (x < -140 || (x > 220 && z > 60)) tmp.copy(cField).lerp(cWheat, 0.5 + 0.5 * Math.sin(x * 0.02 + z * 0.02));
    else tmp.copy(cDust);
    tmp.offsetHSL(0, 0, Math.sin(x * 0.25 + z * 0.3) * 0.03);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  // --- the Ganga (north) ---
  const river = new THREE.Mesh(new THREE.PlaneGeometry(3000, 900), new THREE.MeshStandardMaterial({ color: 0x7a7050, roughness: 0.4, metalness: 0.15 }));
  river.rotation.x = -Math.PI / 2; river.position.set(0, RIVER_LEVEL + 0.3, -560); scene.add(river);
  // far bank tree line
  for (let i = 0; i < 30; i++) { const t = new THREE.Mesh(new THREE.SphereGeometry(6 + rnd() * 5, 6, 5), mat(0x3a5a2a)); t.position.set(-900 + i * 60, 4, -740 - rnd() * 40); scene.add(t); }

  // --- prop builders ---
  // kaccha house: mud walls, thatch roof
  function hut(x, z, rot = 0, poor = false) {
    const g = new THREE.Group();
    const w = poor ? 3.4 : 4.6, d = poor ? 3.0 : 4.0, h = poor ? 2.0 : 2.5;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(poor ? 0x7a6040 : 0x8a6a44));
    wall.position.y = h / 2; g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.62, poor ? 1.4 : 1.8, 4), mat(poor ? 0x9a8a5a : 0xb59a5a, 1));
    roof.rotation.y = Math.PI / 4; roof.position.y = h + (poor ? 0.7 : 0.9); roof.scale.set(1, 1, d / w); g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.6, 0.1), mat(0x3a2818)); door.position.set(0, 0.8, d / 2 + 0.02); g.add(door);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g);
  }
  // zamindar's haveli: two-storey brick with arches and a flat terrace
  function haveli(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 8, 12), mat(0xa5674a)); body.position.y = 4; g.add(body);
    const para = new THREE.Mesh(new THREE.BoxGeometry(18.6, 1, 12.6), mat(0xb98a6a)); para.position.y = 8.5; g.add(para);
    for (let i = -3; i <= 3; i++) {          // arched veranda
      const arc = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 0.6), mat(0xe8dcc4)); arc.position.set(i * 2.4, 2.2, 6.05); g.add(arc);
    }
    const ver = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 3), mat(0xcfc0a0)); ver.position.set(0, 0.2, 7.5); g.add(ver);
    for (const sx of [-8, 8]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 10, 1.6), mat(0xb98a6a)); c.position.set(sx, 5, 6); g.add(c); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function peepal(x, z, s = 1) {
    const g = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.8 * s, 5 * s, 8), mat(0x5a4630)); tr.position.y = 2.5 * s; g.add(tr);
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry((3 + rnd() * 1.6) * s, 8, 6), mat(0x3f6a2a)); c.position.set((rnd() - 0.5) * 4 * s, (5.5 + rnd()) * s, (rnd() - 0.5) * 4 * s); g.add(c); }
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // colonial bungalow (collectorate / thana) + Union Jack
  function bungalow(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(15, 4.2, 9), mat(0xeee6d2)); body.position.y = 2.1; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.5, 10.6), mat(0x8a4030)); roof.position.y = 4.6; g.add(roof);
    for (let i = -3; i <= 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.8, 8), mat(0xe6ddc6)); c.position.set(i * 2.1, 1.9, 4.9); g.add(c); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 10, 6), mat(0x888)); pole.position.set(-9, 7, 0); g.add(pole);
    const jack = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshStandardMaterial({ map: unionJack(), side: THREE.DoubleSide, roughness: 0.9 })); jack.position.set(-7.6, 11, 0); g.add(jack);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // indigo kothi: long sheds + a smoking brick chimney
  function kothi(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const sh = new THREE.Mesh(new THREE.BoxGeometry(20, 5, 8), mat(0x9a5b3f)); sh.position.set(0, 2.5, i * 11); g.add(sh); const rf = new THREE.Mesh(new THREE.BoxGeometry(20.5, 0.4, 8.5), mat(0x555)); rf.position.set(0, 5.1, i * 11); g.add(rf); }
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 16, 10), mat(0x8a4030)); ch.position.set(-12, 8, 0); g.add(ch);
    const smoke = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6), new THREE.MeshStandardMaterial({ color: 0x99938a, transparent: true, opacity: 0.5 })); smoke.position.set(-12, 19, 0); g.add(smoke); g.userData.smoke = smoke;
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g;
  }
  // railway halt: raised platform + rails + small station + name board
  function railway(x, z) {
    const g = new THREE.Group();
    const plat = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 5), mat(0xb0a488)); plat.position.set(0, 0.4, 0); g.add(plat);
    const stn = new THREE.Mesh(new THREE.BoxGeometry(10, 3.5, 4.5), mat(0xc86a4a)); stn.position.set(0, 2.3, 0.2); g.add(stn);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 6), mat(0x555)); roof.position.set(0, 4.2, 0.4); g.add(roof);
    // rails + sleepers
    for (const rx of [-1.8, 1.8]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 80), mat(0x555, 0.5)); rl.position.set(rx, 0.1, -5); g.add(rl); }
    for (let i = 0; i < 20; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.15, 0.5), mat(0x4a3220)); sl.position.set(0, 0.05, -44 + i * 4); g.add(sl); }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.2), new THREE.MeshStandardMaterial({ map: nameBoard(), side: THREE.DoubleSide })); board.position.set(0, 3, 2.6); g.add(board);
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function bullock(x, z, rot) {
    const g = new THREE.Group();
    for (const dx of [-1.2, 1.2]) {          // two bullocks
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 2.4), mat(0xcdbf9a)); body.position.y = 1.1; b.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.7), mat(0xcdbf9a)); head.position.set(0, 1.3, 1.5); b.add(head);
      for (const [lx, lz] of [[-0.3, 0.9], [0.3, 0.9], [-0.3, -0.9], [0.3, -0.9]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), mat(0xb0a080)); l.position.set(lx, 0.55, lz); b.add(l); }
      b.position.set(dx, 0, 2.5); g.add(b);
    }
    const cart = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 3.4), mat(0x8a6a44)); cart.position.set(0, 1.1, -0.5); g.add(cart);
    for (const wx of [-1.6, 1.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.2, 12), mat(0x5a4630)); w.rotation.z = Math.PI / 2; w.position.set(wx, 1.0, -0.8); g.add(w); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function field(x, z, w, d, wheat) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), mat(wheat ? 0xcdb56a : 0x6fae4a, 1));
    f.position.set(x, gh(x, z) + 0.1, z); f.receiveShadow = true; scene.add(f);
  }

  // village temple (small shikhara) + mosque (mixed Hindu–Muslim village)
  function temple(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 6), mat(0xe6ddc8)); base.position.y = 0.75; g.add(base);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 4), mat(0xefe7d2)); hall.position.y = 2.7; g.add(hall);
    const shik = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.5, 8), mat(0xd35a2a)); shik.position.y = 6.2; g.add(shik);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), mat(0xd35400, 0.9)); flag.position.set(0.6, 9, 0); g.add(flag);
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function mosque(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 7), mat(0xe4dcc4)); body.position.y = 2.25; g.add(body);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xdccfa8, 0.5)); dome.position.y = 4.5; g.add(dome);
    for (const mx of [-4.5, 4.5]) { const min = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 10, 8), mat(0xe4dcc4)); min.position.set(mx, 5, 2.5); g.add(min); const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 8), mat(0x2f7a4a)); cap.position.set(mx, 10.5, 2.5); g.add(cap); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function grainMarket(x, z) {
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.15, 2.2), mat([0xb02020, 0x207040, 0xd0a020, 0x8a5020][(rnd() * 4) | 0], 1)); top.position.y = 2.2; g.add(top);
      for (const [sx, sz] of [[-1.3, -0.9], [1.3, -0.9], [-1.3, 0.9], [1.3, 0.9]]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 5), mat(0x6a4a2a)); po.position.set(sx, 1.1, sz); g.add(po); }
      for (let s = 0; s < 3; s++) { const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.6, 7), mat(0xcdb98a)); sack.position.set(-0.8 + s * 0.7, 0.3, 0.4); g.add(sack); }
      g.position.set(x + (rnd() - 0.5) * 40, gh(x, z), z + (rnd() - 0.5) * 30); g.rotation.y = rnd() * Math.PI; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
    }
  }

  // --- lay out the world ---
  peepal(0, 0, 1.3);                          // chowk peepal
  temple(30, 40); mosque(-40, 60, 0.4);       // temple + mosque, a short walk apart
  // dense village lanes of huts around the chowk
  for (let i = 0; i < 60; i++) {
    const x = -120 + rnd() * 240, z = -80 + rnd() * 200;
    if (Math.hypot(x, z) < 14) continue;
    hut(x, z, rnd() * Math.PI);
  }
  haveli(140, -90, -0.5);
  // segregated caste tola (poorer huts, set apart to the NW)
  for (let i = 0; i < 22; i++) hut(-220 + rnd() * 90, -200 + rnd() * 80, rnd() * Math.PI, true);
  peepal(-180, -160, 0.8);
  // empire's edge (SE)
  bungalow(300, -120, -0.5);                  // collectorate / thana
  const kothiG = kothi(320, 120);             // indigo kothi
  railway(-60, 300);                          // railway halt
  // fields
  for (let i = 0; i < 26; i++) field(-360 + rnd() * 220, 40 + rnd() * 300, 28 + rnd() * 20, 20 + rnd() * 16, rnd() < 0.7);
  for (let i = 0; i < 14; i++) field(220 + rnd() * 160, 60 + rnd() * 220, 26 + rnd() * 18, 20 + rnd() * 14, rnd() < 0.5);
  // bullock carts + a few scattered peepals
  for (let i = 0; i < 6; i++) bullock(-60 + rnd() * 200, -20 + rnd() * 180, rnd() * Math.PI);
  for (let i = 0; i < 8; i++) peepal(-300 + rnd() * 600, -100 + rnd() * 400, 0.6 + rnd() * 0.5);

  // --- mango / bamboo groves (dense village woodland, not open steppe) ---
  forest(scene, gh, rnd, { x0: -160, x1: 200, z0: -100, z1: 220, count: 90, kinds: ['mango', 'peepal', 'neem', 'babul'], s0: 0.8, s1: 1.5, skip: (x, z) => Math.hypot(x, z) < 16 });
  forest(scene, gh, rnd, { x0: -420, x1: 420, z0: -320, z1: -140, count: 70, kinds: ['babul', 'mango', 'neem'], s0: 0.7, s1: 1.4 });
  forest(scene, gh, rnd, { x0: 200, x1: 460, z0: -60, z1: 260, count: 60, kinds: ['mango', 'babul'], s0: 0.9, s1: 1.6 });

  // --- more of the village: extra kaccha lanes + haystacks + cots ---
  for (let i = 0; i < 30; i++) hut(-140 + rnd() * 280, -100 + rnd() * 230, rnd() * Math.PI);
  for (let i = 0; i < 10; i++) charpai(scene, gh, -100 + rnd() * 220, -60 + rnd() * 180, rnd() * Math.PI);
  for (let i = 0; i < 12; i++) haystack(scene, gh, -200 + rnd() * 500, -40 + rnd() * 300);
  grainMarket(120, 110);

  // --- wells & hand-pumps ---
  well(scene, gh, 10, 20); well(scene, gh, -80, -40); well(scene, gh, -190, -150);
  handpump(scene, gh, 40, -10); handpump(scene, gh, -120, 30); handpump(scene, gh, 120, -60);

  // --- animals: buffalo, cattle, goats, dogs, pigs ---
  for (let i = 0; i < 8; i++) animal(scene, gh, -60 + rnd() * 240, -40 + rnd() * 200, rnd() * 6, 'buffalo');
  for (let i = 0; i < 10; i++) animal(scene, gh, -80 + rnd() * 280, -60 + rnd() * 240, rnd() * 6, 'cow');
  for (let i = 0; i < 16; i++) animal(scene, gh, -120 + rnd() * 320, -80 + rnd() * 260, rnd() * 6, 'goat');
  for (let i = 0; i < 8; i++) animal(scene, gh, -80 + rnd() * 260, -40 + rnd() * 200, rnd() * 6, 'dog');
  for (let i = 0; i < 6; i++) animal(scene, gh, -180 + rnd() * 120, -180 + rnd() * 80, rnd() * 6, 'pig');   // by the tola
  for (let i = 0; i < 14; i++) animal(scene, gh, -60 + rnd() * 200, 0 + rnd() * 160, rnd() * 6, 'chicken');

  // --- old vehicles at the collectorate ---
  vintageCar(scene, gh, 300, -140, 0.5, 0x1a1a1a);
  vintageCar(scene, gh, 285, -95, -0.4, 0x2a2018);
  tonga(scene, gh, 120, 40, 0.8); tonga(scene, gh, -40, -20, -0.5);

  // --- political & religious currents, c. 1920–22 ---
  banner(scene, gh, 0, -20, 0.2, 'NON-COOPERATION', '#c8801a', '#241a10');
  banner(scene, gh, 30, 60, 0.3, 'CHARKHA · KHADI', '#0a5a2a', '#f5f0d0');
  banner(scene, gh, -60, 80, -0.3, 'GAU RAKSHA', '#c21f2f', '#f5f0d0');   // cow-protection → tension
  banner(scene, gh, -40, 70, 0.4, 'HINDU–MUSLIM EKTA', '#0a5a2a', '#f5f0d0');
  swarajFlag(scene, gh, 20, 30);
  swarajFlag(scene, gh, -40, 55, true);      // Khilafat flag by the mosque

  // --- villagers ---
  const villagers = new Villagers(scene, 'bihar', gh, [
    { role: 'farmer', count: 30, x: 0, z: 60, spread: 200 },
    { role: 'woman', count: 20, x: -20, z: 0, spread: 130 },
    { role: 'child', count: 18, x: 0, z: 20, spread: 150 },
    { role: 'brahmin', count: 4, x: 0, z: 0, spread: 20, idle: 0.6 },
    { role: 'zamindar', count: 2, x: 140, z: -75, spread: 18, idle: 0.7 },
    { role: 'sepoy', count: 3, x: 138, z: -80, spread: 20, idle: 0.4 },   // haveli's men
    { role: 'farmer', count: 14, x: -320, z: 150, spread: 160 },          // in the fields
    { role: 'farmer', count: 10, x: -190, z: -160, spread: 70 },          // the tola
    { role: 'woman', count: 8, x: -190, z: -160, spread: 70 },
    { role: 'british', count: 4, x: 300, z: -110, spread: 35, idle: 0.35 },
    { role: 'sepoy', count: 6, x: 296, z: -95, spread: 55, idle: 0.3 },
    { role: 'merchant', count: 8, x: 120, z: 110, spread: 45, idle: 0.55 },
    { role: 'sadhu', count: 2, x: 40, z: -410, spread: 30, idle: 0.7 },   // at the ghat
    { role: 'farmer', count: 8, x: 330, z: 120, spread: 40 },             // kothi labour
  ], 553);

  return {
    groundHeight: gh, seaLevel: RIVER_LEVEL,
    update(dt, t) { const sm = kothiG.userData.smoke; sm.position.y = 19 + Math.sin(t * 0.5) * 1.5; sm.material.opacity = 0.4 + 0.15 * Math.sin(t * 0.7); villagers.update(dt); },
  };
}

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
function nameBoard() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 52;
  const g = cv.getContext('2d');
  g.fillStyle = '#f0e8d0'; g.fillRect(0, 0, 256, 52);
  g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.font = 'bold 24px Georgia'; g.fillText('RAMPUR HALT', 128, 34);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
