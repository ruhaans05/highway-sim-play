import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt } from './road.js';
import {
  groundY, clampOffRoad, buildTrees, scatterInstanced, facadeTexture,
  deepSprawl, buildBillboards,
} from './environment.js';
import { welcomeSign, gantry, textBoard, skyline, water } from './turnpike.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const DELHI_ADS = [
  ['DLF CYBER CITY', '#123a7a', '#ffffff'], ['DELHI CAPITALS · IPL', '#17479e', '#c8102e'],
  ['SAROJINI NAGAR SALE', '#c8102e', '#ffd23d'], ["HALDIRAM'S", '#c8102e', '#ffffff'],
  ['ODD-EVEN LAGU HAI', '#0b5c37', '#ffffff'], ['KINGDOM OF DREAMS', '#7a1f7a', '#ffd23d'],
  ['PARANTHE WALI GALI →', '#d97b1f', '#ffffff'], ['METRO · अगला स्टेशन राजीव चौक', '#c8102e', '#ffffff'],
  ['AMBIENCE MALL · NH-48', '#123a7a', '#ffd23d'], ['UBER · दिल्ली चले', '#111111', '#ffffff'],
  ['ROOH AFZA', '#c8102e', '#ffd23d'], ['IIT COACHING · KOTA?', '#0b5c8a', '#ffffff'],
];

// A dhaba: bright little roadside eatery box with a signboard and charpai lot
function dhaba(scene, registry, s, name, side = -1) {
  const rand = rng(s | 0);
  const lat = side * (pavedHalfAt(s) + 16 + rand() * 10);
  const g = new THREE.Group();
  const hut = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: [0xd97b1f, 0x2f8a3a, 0x1b4fa0][(rand() * 3) | 0], roughness: 0.9 }));
  hut.position.y = 1.7; g.add(hut);
  const sign = textBoard([name, 'ढाबा · CHAI · खाना'], 6.4, 2.2, '#d97b1f', '#ffffff');
  sign.position.set(0, 5.2, 0); g.add(sign);
  if (registry) registry.signs.push({ userData: { board: sign } });
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0);
  scene.add(g);
}

// India Gate: the sandstone memorial arch off the C-Hexagon
function indiaGate(scene, s, lat) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xb98d5f, roughness: 0.85 });
  const g = new THREE.Group();
  for (const dx of [-9, 9]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 26, 8), stone);
    pier.position.set(dx, 13, 0); g.add(pier);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(28, 7, 9), stone);
  lintel.position.y = 29.5; g.add(lintel);
  const attic = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 7), stone);
  attic.position.y = 36; g.add(attic);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 4, 10), stone);
  cap.position.y = 41; g.add(cap);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// Akshardham silhouette across the Yamuna: broad plinth, dome cluster
function akshardham(scene, s, lat) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xc79a66, roughness: 0.9 });
  const g = new THREE.Group();
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(120, 14, 60), stone);
  plinth.position.y = 7; g.add(plinth);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(80, 16, 44), stone);
  hall.position.y = 22; g.add(hall);
  for (const [dx, r, h] of [[0, 12, 16], [-28, 8, 11], [28, 8, 11], [-48, 6, 9], [48, 6, 9]]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8, 0, TAU, 0, Math.PI / 2), stone);
    dome.position.set(dx, 30, 0); g.add(dome);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.2, h, 8), stone);
    spire.position.set(dx, 30 + r + h / 2 - 1, 0); g.add(spire);
  }
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// IGI: low glass terminal, control tower, a few tails over the fence
function igiTerminal(scene, registry, s, side) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.3, metalness: 0.5 });
  const conc = new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.9 });
  const lat = side * 260;
  const g = new THREE.Group();
  const term = new THREE.Mesh(new THREE.BoxGeometry(220, 18, 60), glass);
  term.position.y = 9; g.add(term);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(230, 2.5, 66), conc);
  roof.position.y = 19; g.add(roof);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 42, 10), conc);
  tower.position.set(130, 21, 0); g.add(tower);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 10), glass);
  cab.position.set(130, 45, 0); g.add(cab);
  for (const dx of [-70, -20, 30, 80]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 12, 9),
      new THREE.MeshStandardMaterial({ color: [0xc8102e, 0x1b4fa0, 0xd97b1f][(dx + 70) / 50 % 3 | 0], roughness: 0.5 }));
    tail.position.set(dx, 8, -50); g.add(tail);
  }
  const sign = textBoard(['IGI · इंदिरा गांधी', 'INTERNATIONAL AIRPORT', 'TERMINAL 3 →'], 9, 3.6, '#123a7a', '#ffffff');
  sign.position.set(-90, 26, 34); g.add(sign);
  registry.signs.push({ userData: { board: sign } });
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s);
  scene.add(g);
}

export function buildNewDelhi(scene, registry) {
  const rand = rng(1947);
  const tex = facadeTexture(47);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];
  const towerMat = registry.towerMats[0];
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);

  // ---- Gurgaon: the glass Cyber City wall — the NCR's tall buildings live here
  skyline(scene, registry, 91, 400, 6800, 24, 55, 420, 40, 135, [-1, 1]);
  welcomeSign(scene, registry, 600, 1, ['DLF CYBER CITY', 'गुरुग्राम · GURUGRAM', 'MILLENNIUM CITY'], '#123a7a');

  // ---- NH-48 / Aerocity: hotel row, then the airport
  skyline(scene, registry, 92, 7400, 11600, 30, 70, 300, 18, 48, [-1]);
  deepSprawl(scene, 93, 7000, 15000, { density: 0.8, towers: false, side: 1 });
  igiTerminal(scene, registry, 13300, -1);

  // ---- Dhaula Kuan into LUTYENS: avenue trees, low white bungalows, lawns
  buildTrees(scene, 94, 15000, 30500, 10, 14, 60, 20);
  buildTrees(scene, 95, 19000, 26000, 7, 12, 34, 0);      // dense avenue canopy
  const bungalows = [];
  const white = new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.9 });
  for (let s = 19200; s < 26000; s += 60 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.3) continue;
      const lat = side * (34 + rand() * 130);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      bungalows.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
        sx: 14 + rand() * 10, sy: 4.5 + rand() * 3, sz: 12 + rand() * 8,
      }, s, lat, 0.5));
    }
  }
  scatterInstanced(scene, box, white, bungalows);
  indiaGate(scene, 23800, -130);
  welcomeSign(scene, registry, 22800, 1, ['इंडिया गेट', 'INDIA GATE · C-HEXAGON', 'अमर जवान ज्योति'], '#7a3410');

  // ---- Connaught Place: the white colonnade rings
  const cpBlocks = [];
  for (let s = 26200; s < 29800; s += 26 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.15) continue;
      const lat = side * (24 + rand() * 70);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      cpBlocks.push(clampOffRoad({
        pos, rot: headingAt(s),
        sx: 16 + rand() * 8, sy: 11 + rand() * 3, sz: 12 + rand() * 6,
      }, s, lat, -0.5));
    }
  }
  scatterInstanced(scene, box, white, cpBlocks);

  // ---- ITO / Daryaganj: press-building midrise + bazaar clutter
  skyline(scene, registry, 96, 30200, 33800, 20, 30, 160, 16, 45, [-1, 1]);
  deepSprawl(scene, 97, 30000, 34000, { density: 1.2, towers: false });

  // ---- Yamuna crossing + Akshardham on the far bank
  water(scene, 36000, 2400, 1800);
  akshardham(scene, 36400, -420);

  // ---- Noida: the modern high-rise wall
  skyline(scene, registry, 98, 38600, 45400, 26, 60, 380, 45, 140, [-1, 1]);
  deepSprawl(scene, 99, 38000, 46000, { density: 0.9 });

  // ---- Outer Ring Road: endless mid Delhi fabric
  deepSprawl(scene, 100, 46000, 56000, { density: 1.2, towers: false });
  buildTrees(scene, 101, 46000, 56000, 18, 20, 120, 40);
  skyline(scene, registry, 102, 48000, 54000, 40, 120, 420, 15, 40, [1]);

  // ---- Punjabi Bagh + NH-10 west: markets thinning into Haryana fields
  deepSprawl(scene, 103, 56000, 63500, { density: 1.1, towers: false });
  buildTrees(scene, 104, 63500, 86000, 26, 30, 200, 60);
  dhaba(scene, registry, 66500, 'AMRIK SUKHDEV');
  dhaba(scene, registry, 74800, 'GULSHAN DHABA', 1);
  dhaba(scene, registry, 80500, 'RAJ DHABA');
  welcomeSign(scene, registry, 72500, 1, ['हरियाणा में स्वागत', 'NH-10 · ROHTAK ROAD', 'देसां में देस हरियाणा'], '#0b5c37');

  // ---- Rohtak: low bustling blocks to the turn-around
  deepSprawl(scene, 105, 86000, 92000, { density: 1.2, towers: false });
  skyline(scene, registry, 106, 87500, 91000, 30, 26, 130, 10, 26, [-1, 1]);

  buildBillboards(scene, registry, 107, 500, 91500, 16, DELHI_ADS);
}
