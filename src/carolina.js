import * as THREE from 'three';
import { Villagers } from './villagers.js';
import { tree, forest, well, animal } from './props.js';

// ---------------------------------------------------------------------------
// Rockford, North Carolina — an antebellum Piedmont town, c. 1840s. A sober,
// historically honest depiction of slavery and segregation, not a romance of
// the "Old South": the columned Great House of the plantation and, behind it,
// the cramped log slave quarters; the cotton and tobacco fields worked by
// enslaved men, women and children under an overseer; and the town square with
// its courthouse, church, store — and the auction block where human beings
// were bought and sold. Presented as history, to be seen plainly.
// ---------------------------------------------------------------------------

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mat(c, r = 0.9, m = 0) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); }
function shadowify(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }

const CREEK_LEVEL = -1.0;

function gh(x, z) {
  const undu = Math.sin(x * 0.005) * 1.0 + Math.cos(z * 0.006) * 0.9 + Math.sin((x + z) * 0.011) * 0.5;
  let y = 2.2 + undu;
  if (z < -300) { const t = Math.min(1, (-300 - z) / 80); y = 2.2 - t * 3.2; }   // Mill Creek to the south
  return y;
}

export function buildCarolina(scene) {
  const rnd = rng(1846);

  // --- ground (red Piedmont clay, green pasture, cultivated fields) ---
  const S = 2600, N = 150;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cClay = new THREE.Color(0xa5674a), cGrass = new THREE.Color(0x5a7a3a), cField = new THREE.Color(0x8a8a52), cWater = new THREE.Color(0x4a5a48);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const y = gh(x, z); p.setY(i, y);
    if (z < -300) tmp.copy(cWater);
    else if ((x > 380 && z > 40) || (x < -220 && z > 120)) tmp.copy(cField);   // fields
    else if (Math.hypot(x, z) < 120) tmp.copy(cClay);                          // town clay
    else tmp.copy(cGrass);
    tmp.offsetHSL(0, 0, Math.sin(x * 0.25 + z * 0.3) * 0.03);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  // --- Mill Creek (south) ---
  const creek = new THREE.Mesh(new THREE.PlaneGeometry(2800, 500), mat(0x40584a, 0.4, 0.15));
  creek.rotation.x = -Math.PI / 2; creek.position.set(0, CREEK_LEVEL + 0.3, -520); scene.add(creek);

  // --- helpers ---
  function board(x, z, rot, text, bg = '#e8e0cc', fg = '#241a10', w = 3, hgt = 1.4, onPost = true) {
    const g = new THREE.Group();
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 120; const c = cv.getContext('2d');
    c.fillStyle = bg; c.fillRect(0, 0, 256, 120); c.strokeStyle = fg; c.lineWidth = 5; c.strokeRect(6, 6, 244, 108);
    c.fillStyle = fg; c.textAlign = 'center';
    const lines = text.split('\n'); c.font = 'bold 26px Georgia';
    lines.forEach((ln, i) => c.fillText(ln, 128, 46 + i * 34));
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
    if (onPost) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), mat(0x5a3a1a)); post.position.y = 1.2; g.add(post); panel.position.y = 2.4; }
    else panel.position.y = hgt / 2;
    g.add(panel); g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
  }
  function fence(x0, z0, x1, z1) {                // split-rail fence
    const g = new THREE.Group();
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), n = Math.floor(len / 3);
    for (let i = 0; i <= n; i++) { const px = x0 + dx * i / n, pz = z0 + dz * i / n; const po = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), mat(0x6a4a2a)); po.position.set(px, gh(px, pz) + 0.6, pz); g.add(po); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, len), mat(0x7a5a34)); rail.position.set((x0 + x1) / 2, gh(x0, z0) + 0.8, (z0 + z1) / 2); rail.rotation.y = Math.atan2(dx, dz); g.add(rail);
    scene.add(shadowify(g)); return g;
  }

  // --- Greek Revival Great House ---
  function greatHouse(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 14), mat(0xf0ece0)); body.position.y = 5; g.add(body);
    // columned front portico
    for (let i = -2; i <= 2; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 10, 12), mat(0xf6f2e8)); c.position.set(i * 4, 5, 8.5); g.add(c); }
    const port = new THREE.Mesh(new THREE.BoxGeometry(20, 0.8, 3.5), mat(0xf0ece0)); port.position.set(0, 10.2, 8.3); g.add(port);
    const ped = new THREE.Mesh(new THREE.ConeGeometry(11, 3, 3), mat(0xe8e2d0)); ped.rotation.y = Math.PI / 2; ped.scale.set(0.16, 1, 1); ped.position.set(0, 12, 8); g.add(ped);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(20.6, 2, 14.6), mat(0x6a5240)); roof.position.y = 11; g.add(roof);
    for (const cx of [-6, 6]) { const ch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 1.2), mat(0x8a4a3a)); ch.position.set(cx, 13, 0); g.add(ch); }
    for (let i = -3; i <= 3; i++) for (const yy of [3.5, 7]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.2), mat(0x243040, 0.3)); w.position.set(i * 2.6, yy, 7.05); g.add(w); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
  }
  // slave cabin: small windowless log house, stick-and-mud chimney
  function cabin(x, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 3.4), mat(0x6a4d30, 1)); body.position.y = 1.2; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 4), mat(0x4a3a26)); roof.position.y = 2.6; g.add(roof);
    const roof2 = new THREE.Mesh(new THREE.ConeGeometry(3, 1.2, 4), mat(0x5a4632)); roof2.rotation.y = Math.PI / 4; roof2.position.y = 3.0; roof2.scale.set(1, 1, 0.85); g.add(roof2);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 0.7), mat(0x7a5a3a)); ch.position.set(2.3, 1.7, 0); g.add(ch);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.1), mat(0x2a1c10)); door.position.set(0, 0.85, 1.72); g.add(door);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
  }
  // town wooden/brick buildings
  function building(x, z, rot, w, h, d, color, sign, roofC = 0x5a4030) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, 1)); body.position.y = h / 2; g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), mat(roofC)); roof.position.y = h + 0.2; g.add(roof);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g));
    if (sign) board(x + Math.sin(rot) * (d / 2 + 0.3), z + Math.cos(rot) * (d / 2 + 0.3), rot, sign, '#e8dcc0', '#241a10', Math.min(w * 0.8, 5), 1.0, false);
    return g;
  }
  function courthouse(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 9, 12), mat(0x9a4a3a, 1)); body.position.y = 4.5; g.add(body);
    for (let i = -2; i <= 2; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 7, 10), mat(0xf0ece0)); c.position.set(i * 3, 3.5, 6.2); g.add(c); }
    const ped = new THREE.Mesh(new THREE.ConeGeometry(9, 2.4, 3)); ped.geometry = new THREE.ConeGeometry(9, 2.4, 3); const pm = mat(0xe8e2d0); ped.material = pm; ped.rotation.y = Math.PI / 2; ped.scale.set(0.16, 1, 1); ped.position.set(0, 8.5, 6); g.add(ped);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.8, 12.6), mat(0x4a3a2a)); roof.position.y = 9.4; g.add(roof);
    const cup = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), mat(0xf0ece0)); cup.position.y = 11; g.add(cup);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8d0bc, 0.5)); dome.position.y = 12.5; g.add(dome);
    g.position.set(x, gh(x, z), z); scene.add(shadowify(g));
    // U.S. flag of the 1840s over the courthouse
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8, 6), mat(0xddd)); pole.position.set(x + 9, gh(x, z) + 4, z); scene.add(pole);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.9), new THREE.MeshStandardMaterial({ map: usFlag(), side: THREE.DoubleSide, roughness: 0.9 })); fl.position.set(x + 10.6, gh(x, z) + 7, z); scene.add(fl);
    return g;
  }
  function church(x, z, rot) {
    const g = new THREE.Group();
    const nave = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 15), mat(0xf2ede0, 1)); nave.position.y = 3; g.add(nave);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 3, 4)); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 1.9); roof.position.y = 7; roof.material = mat(0x6a4030); g.add(roof);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.4, 11, 3.4), mat(0xf2ede0, 1)); tower.position.set(0, 5.5, 8.5); g.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 4), mat(0xe8e2d0)); spire.position.set(0, 13.5, 8.5); g.add(spire);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), mat(0xdcdcdc)); cross.position.set(0, 16.5, 8.5); g.add(cross);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
  }
  // the auction block — a plain raised wooden platform with a post
  function auctionBlock(x, z) {
    const g = new THREE.Group();
    const plat = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 4), mat(0x7a5a38, 1)); plat.position.y = 0.55; g.add(plat);
    const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1.2), mat(0x6a4a2c)); step.position.set(0, 0.25, 2.4); g.add(step);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), mat(0x5a3a1a)); post.position.set(1.4, 2.2, 0); g.add(post);
    g.position.set(x, gh(x, z), z); scene.add(shadowify(g));
    board(x, z + 3, 0, 'PUBLIC AUCTION\nSLAVES · THIS DAY', '#d8cbad', '#3a1a10', 3.2, 1.5);
    return g;
  }
  function oxCart(x, z, rot) {
    const g = new THREE.Group();
    const ox = animal({ add() {} }, () => 0, 0, 0, 0, 'cow'); ox.position.set(0, 0, 2.6); g.add(ox);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 3), mat(0x7a5a34)); bed.position.set(0, 1, -0.4); g.add(bed);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 3), mat(0x6a4a28)); side.position.set(s * 1, 1.3, -0.4); g.add(side); }
    for (const wx of [-1.1, 1.1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 12), mat(0x5a4028)); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.7, -0.8); g.add(w); }
    // a few cotton bales in the bed
    for (let i = 0; i < 2; i++) { const bale = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), mat(0xe8e4d4, 1)); bale.position.set(0, 1.6, -1 + i * 1); g.add(bale); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(shadowify(g)); return g;
  }
  // cotton field: rows of low bushes with white bolls; tobacco: taller green
  function field(cx, cz, w, d, cotton) {
    for (let i = 0; i < (cotton ? 90 : 60); i++) {
      const x = cx + (rnd() - 0.5) * w, z = cz + (rnd() - 0.5) * d;
      if (cotton) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 5), mat(0x4a6a34, 1)); b.position.set(x, gh(x, z) + 0.4, z); scene.add(b); const bo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 5, 4), mat(0xf0ece0, 1)); bo.position.set(x, gh(x, z) + 0.7, z); scene.add(bo); }
      else { const t = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 6), mat(0x3f6a2a, 1)); t.position.set(x, gh(x, z) + 0.7, z); scene.add(t); }
    }
  }

  // --- lay out the town + plantations ---
  courthouse(0, 0);
  auctionBlock(40, 40);
  church(-90, -60, 0.2);
  building(70, -50, -0.4, 10, 5, 8, 0xb5784a, 'GENERAL STORE');
  building(95, -20, -0.6, 8, 4.5, 7, 0x8a6a4a, 'TAVERN');
  building(-40, 50, 0.3, 9, 4.5, 7, 0xcabf9a, 'COURT · CLERK');
  building(60, 60, 0.2, 8, 4, 6, 0x9a7a5a, 'SMITHY');
  board(20, 25, 0.3, '$200 REWARD\nRUNAWAY', '#e8e0cc', '#3a1a10', 2.4, 1.3);
  // town houses
  for (let i = 0; i < 16; i++) building(-120 + rnd() * 240, -110 + rnd() * 100, rnd() * Math.PI, 6 + rnd() * 3, 4, 5 + rnd() * 2, [0xcabf9a, 0xd8cbb0, 0xb5a488][(rnd() * 3) | 0], null);

  // Rosedale plantation: Great House, quarters behind, gin & barns
  greatHouse(320, 160, Math.PI);
  fence(260, 120, 400, 120); fence(400, 120, 400, 300);
  // the slave quarters — two cramped rows of cabins set behind the house
  for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) cabin(320 + i * 7, 250 + r * 10, 0);
  building(240, 240, 0, 12, 6, 8, 0x8a5a3a, 'COTTON GIN', 0x4a3020);   // gin shed
  building(220, 210, 0.3, 14, 7, 9, 0x7a5236, null, 0x3a2818);          // barn
  // second, smaller plantation to the NW (tobacco)
  greatHouse(-320, 240, 0.3);
  for (let i = 0; i < 8; i++) cabin(-360 + i * 7, 300, 0.1);

  // fields
  field(480, 120, 260, 200, true);    // cotton
  field(430, 260, 200, 160, true);
  field(-300, 220, 240, 180, false);  // tobacco
  field(-260, 320, 180, 120, false);

  // --- Southern live oaks, longleaf pines, wells, fences ---
  forest(scene, gh, rnd, { x0: -420, x1: 500, z0: -300, z1: 360, count: 130, kinds: ['banyan', 'cypress', 'mango'], s0: 1.0, s1: 1.9, skip: (x, z) => Math.hypot(x, z) < 110 || (x > 380 && z > 40) || (x < -220 && z > 120) });
  forest(scene, gh, rnd, { x0: -500, x1: 500, z0: -520, z1: -320, count: 60, kinds: ['cypress', 'banyan'], s0: 1.0, s1: 1.7 });   // creek woods
  well(scene, gh, 10, 20); well(scene, gh, 330, 250); well(scene, gh, -330, 300);
  fence(120, -120, 300, -120); fence(-140, -100, -140, 40);

  // --- livestock + wagons ---
  for (let i = 0; i < 8; i++) animal(scene, gh, 120 + rnd() * 260, 80 + rnd() * 160, rnd() * 6, 'cow');
  for (let i = 0; i < 6; i++) animal(scene, gh, -60 + rnd() * 200, -60 + rnd() * 140, rnd() * 6, 'horse');
  for (let i = 0; i < 8; i++) animal(scene, gh, 200 + rnd() * 200, 200 + rnd() * 120, rnd() * 6, 'pig');
  for (let i = 0; i < 6; i++) animal(scene, gh, -40 + rnd() * 160, -40 + rnd() * 120, rnd() * 6, 'dog');
  for (let i = 0; i < 16; i++) animal(scene, gh, -80 + rnd() * 240, -40 + rnd() * 180, rnd() * 6, 'chicken');
  oxCart(240, 200, 0.6); oxCart(80, 20, -0.4); oxCart(-280, 260, 0.2);
  // cotton bales stacked by the gin
  for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1, 1), mat(0xe8e4d4, 1)); b.position.set(232 + (i % 4) * 1.5, gh(232, 232) + 0.5 + Math.floor(i / 4) * 1.05, 232); b.castShadow = true; scene.add(b); }

  // --- the people of Rockford, enslaved and free ---
  const villagers = new Villagers(scene, 'carolina', gh, [
    // enslaved field hands — the labour of the plantation, out in the rows
    { role: 'enslaved', count: 26, x: 480, z: 130, spread: 150 },
    { role: 'slavewoman', count: 16, x: 460, z: 200, spread: 150 },
    { role: 'enslaved', count: 16, x: -300, z: 240, spread: 140 },       // tobacco
    { role: 'slavewoman', count: 10, x: -270, z: 300, spread: 120 },
    { role: 'child_black', count: 16, x: 340, z: 258, spread: 70 },       // quarters
    { role: 'enslaved', count: 10, x: 330, z: 255, spread: 60 },
    // house servants near the Great House
    { role: 'slavewoman', count: 5, x: 320, z: 170, spread: 22, idle: 0.5 },
    { role: 'enslaved', count: 4, x: 320, z: 175, spread: 25, idle: 0.5 },
    // overseers watching the fields
    { role: 'overseer', count: 2, x: 470, z: 150, spread: 90, idle: 0.3 },
    { role: 'overseer', count: 1, x: -290, z: 250, spread: 60, idle: 0.3 },
    { role: 'overseer', count: 1, x: 340, z: 250, spread: 40, idle: 0.4 },
    // planters + townsfolk in the square
    { role: 'planter', count: 4, x: 320, z: 150, spread: 30, idle: 0.5 },
    { role: 'planter', count: 3, x: 20, z: 10, spread: 40, idle: 0.5 },
    { role: 'townsman', count: 12, x: 0, z: -30, spread: 120 },
    { role: 'townswoman', count: 10, x: -20, z: -20, spread: 110 },
    { role: 'child_white', count: 8, x: 0, z: -40, spread: 100 },
    { role: 'townsman', count: 4, x: 40, z: 40, spread: 30, idle: 0.6 },  // by the auction
  ], 1846);

  return {
    groundHeight: gh, seaLevel: CREEK_LEVEL,
    update(dt, t) { creek.material.color.setHSL(0.33, 0.12, 0.30 + 0.02 * Math.sin(t * 0.5)); villagers.update(dt); },
  };
}

// U.S. flag, 1840s (26 stars, simplified)
function usFlag() {
  const cv = document.createElement('canvas'); cv.width = 78; cv.height = 52; const g = cv.getContext('2d');
  for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#f5f2ea' : '#b22234'; g.fillRect(0, i * 4, 78, 4); }
  g.fillStyle = '#1a2a5e'; g.fillRect(0, 0, 32, 28);
  g.fillStyle = '#fff'; for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { g.beginPath(); g.arc(4 + c * 5, 4 + r * 5, 1.1, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
