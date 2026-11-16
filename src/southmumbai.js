import * as THREE from 'three';
import {
  posAt, headingAt, elevAt, pavedHalfAt, buildRibbon,
} from './road.js';
import { groundY, clampOffRoad, roadClearAt, buildBillboards } from './environment.js';
import { suspensionBridge, skyline, textBoard, gantry } from './turnpike.js';
import { MUMBAI_ADS } from './mumbai.js';

const TAU = Math.PI * 2;
const SEA_Y = -0.9;          // Arabian Sea surface, just below road grade
const SEA = 1;               // sea on the lat > 0 side, city on lat < 0

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// The Andheri map's southern extension: Bandra → the Bandra–Worli Sea Link →
// Marine Drive → Chowpatty → Nariman Point, all along the Arabian Sea.
export function buildSouthMumbai(scene, registry) {
  buildSea(scene);
  buildSeaLink(scene, registry);
  buildBandra(scene, registry);
  buildMarineDrive(scene, registry);
  buildChowpatty(scene);
  buildNarimanPoint(scene, registry);
  buildSignage(scene, registry);
  buildMumbaiWayfinding(scene, registry);
}

// Compact bilingual route furniture makes the Andheri → Bandra → Sea Link →
// Marine Drive sequence read as one continuous Mumbai journey.
function buildMumbaiWayfinding(scene, registry) {
  const signs = [
    [20400, [['एअरपोर्ट', 'AIRPORT T1/T2'], ['विले पार्ले', 'VILE PARLE']], 6.6],
    [23600, [['बांद्रा', 'BANDRA WEST'], ['BKC', 'BKC / KURLA']], 6.4],
    [27600, [['वर्ली सी लिंक', 'WORLI SEA LINK'], ['दक्षिण मुंबई', 'SOUTH MUMBAI']], 7.0],
    [32800, [['मरीन ड्राइव्ह', 'MARINE DRIVE'], ['चौपाटी', 'CHOWPATTY']], 6.2],
  ];
  for (const [s, labels, height] of signs) {
    const half = pavedHalfAt(s) + 2;
    gantry(scene, registry, s, labels.map((lines, i) => ({
      lat: i === 0 ? -half * 0.48 : half * 0.48,
      mesh: textBoard(lines, 5.0, 1.05, i === 0 ? '#08743c' : '#123b75', '#fff'),
    })), height);
  }
}

// Open water on the sea side, following the coastline, flat at sea level.
function buildSea(scene) {
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x2c6079, roughness: 0.2, metalness: 0.45,
  });
  const verts = [], idx = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const s0 = 27200, s1 = 52000, n = Math.ceil((s1 - s0) / 40);
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n;
    posAt(s, SEA * 34, a); posAt(s, SEA * 1400, b);
    verts.push(a.x, SEA_Y, a.z, b.x, SEA_Y, b.z);
    if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, seaMat));
}

// Bandra–Worli Sea Link: the cable bridge high over the water, with the South
// Mumbai / Worli skyline rising beyond it (lit at night).
function buildSeaLink(scene, registry) {
  suspensionBridge(scene, 28100, 32900, 29600, 31400, 62);
  // deck edge parapets
  const conc = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.7, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const latF = s => side * (pavedHalfAt(s) + 0.3);
    scene.add(new THREE.Mesh(buildRibbon(latF, latF, 0.0, 1.1, 8, 28100, 32900), conc));
  }
  // Worli / Lower Parel skyline beyond the bridge, both flanks
  skyline(scene, registry, 5521, 31500, 37000, 44, 90, 460, 70, 210, [-1, 1]);
}

// Bandra: Bandstand highrises, upmarket blocks — the modern SoBo look begins.
function buildBandra(scene, registry) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const rand = rng(311);
  const tints = [0xe8e4da, 0xd6d2c8, 0xc9c5bc, 0xd9c9a8, 0xbcc9c4, 0xffffff];
  const blocks = [], glass = [];
  // Bandra is urban frontage, not a green suburban setback. A continuous
  // footpath/kerb band removes the visible grass strip, while still leaving
  // small gated compounds and tree pockets behind it.
  const footpathMat = new THREE.MeshStandardMaterial({ color: 0xaaa49a, roughness: 0.95 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x777873, roughness: 0.9 });
  const frontageMat = new THREE.MeshStandardMaterial({ color: 0x756d61, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const inner = side < 0 ? (s => -pavedHalfAt(s) - 0.2) : (s => pavedHalfAt(s) + 0.2);
    const outer = side < 0 ? (s => -pavedHalfAt(s) - 3.4) : (s => pavedHalfAt(s) + 3.4);
    scene.add(new THREE.Mesh(buildRibbon(inner, outer, 0.06, 0.06, 10, 24000, 28000), footpathMat));
    const curbIn = side < 0 ? (s => -pavedHalfAt(s) - 0.45) : (s => pavedHalfAt(s) + 0.2);
    const curbOut = side < 0 ? (s => -pavedHalfAt(s) - 0.2) : (s => pavedHalfAt(s) + 0.45);
    scene.add(new THREE.Mesh(buildRibbon(curbIn, curbOut, 0.2, 0.2, 10, 24000, 28000), curbMat));
    const wallIn = side < 0 ? (s => -pavedHalfAt(s) - 3.5) : (s => pavedHalfAt(s) + 3.5);
    const wallOut = side < 0 ? (s => -pavedHalfAt(s) - 3.8) : (s => pavedHalfAt(s) + 3.8);
    scene.add(new THREE.Mesh(buildRibbon(wallIn, wallOut, 0.15, 1.0, 10, 24000, 28000), frontageMat));
  }
  for (let s = 24000; s < 28000; s += 7 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.08) continue;
      const lat = side * (roadClearAt(s) + 2.5 + Math.pow(rand(), 1.8) * 32);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.82 + rand() * 0.25);
      const r = rand();
      if (r < 0.5) {
        glass.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.3,
          sx: 14 + rand() * 12, sz: 14 + rand() * 12, sy: 40 + rand() * 70,
          color: new THREE.Color(0xffffff).multiplyScalar(0.85 + rand() * 0.2),
        }, s, lat, 1));
      } else {
        blocks.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.35,
          sx: 12 + rand() * 14, sz: 12 + rand() * 14, sy: 14 + rand() * 30, color,
        }, s, lat, 0));
      }
    }
  }
  // Bandra is continuous city fabric on the landward side. Add deep mixed
  // residential/slum blocks so the sea-facing route is not backed by a few
  // isolated towers and empty tree-covered land.
  for (let s = 24000; s < 28000; s += 18 + rand() * 12) {
    for (let layer = 0; layer < 4; layer++) {
      const lat = -(pavedHalfAt(s) + 55 + layer * 92 + rand() * 58);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const r = rand();
      blocks.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.3,
        sx: 20 + rand() * 34, sz: 18 + rand() * 30,
        sy: r < 0.22 ? 8 + rand() * 12 : 12 + Math.pow(rand(), 1.25) * 62,
        color: new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.62 + rand() * 0.25),
      }, s, lat, -0.5));
    }
  }
  // Far Bandra skyline: the landward horizon remains built right through the
  // gaps between towers, with chawl-scale blocks mixed into newer high-rises.
  for (let s = 24000; s < 28000; s += 30 + rand() * 18) {
    const lat = -(pavedHalfAt(s) + 430 + rand() * 430);
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = groundY(s, lat);
    blocks.push(clampOffRoad({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
      sx: 30 + rand() * 42, sz: 28 + rand() * 40,
      sy: 22 + Math.pow(rand(), 1.25) * 86,
      color: new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.58 + rand() * 0.2),
    }, s, lat, -0.5));
  }
  placeBoxes(scene, boxGeo, registry.towerMats?.[0], blocks);
  placeBoxes(scene, boxGeo,
    new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.25, metalness: 0.5 }), glass);
}

// Marine Drive: the Queen's Necklace. Art-Deco frontage on the city side,
// a promenade and the sea on the other, streetlamps curving down the bay.
function buildMarineDrive(scene, registry) {
  const s0 = 33000, s1 = 51500;
  // promenade sidewalk on the sea side
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 1 });
  scene.add(new THREE.Mesh(buildRibbon(
    s => SEA * (pavedHalfAt(s) + 0.2), s => SEA * (pavedHalfAt(s) + 6),
    0.16, 0.05, 10, s0, s1), walkMat));
  // seawall lip
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8f8b82, roughness: 0.95, side: THREE.DoubleSide });
  const wl = s => SEA * (pavedHalfAt(s) + 6);
  scene.add(new THREE.Mesh(buildRibbon(wl, wl, 0.05, -1.0, 12, s0, s1), wallMat));

  // Art-Deco frontage on the city side: cream/pastel mid-rises, uniform line
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const rand = rng(707);
  const deco = [0xe9e2cf, 0xe4dcc4, 0xdcd3bd, 0xe7d9bf, 0xd8ccae, 0xeae6d6];
  const fronts = [];
  for (let s = 34500; s < 51000; s += 11 * (0.7 + rand() * 0.6)) {
    const lat = -1 * (pavedHalfAt(s) + 8 + rand() * 10);
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = groundY(s, lat);
    fronts.push(clampOffRoad({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.06,
      sx: 12 + rand() * 8, sz: 16 + rand() * 10, sy: 18 + rand() * 14,
      color: new THREE.Color(deco[(rand() * deco.length) | 0]).multiplyScalar(0.9 + rand() * 0.15),
    }, s, lat, -0.4));
  }
  placeBoxes(scene, boxGeo, registry.towerMats?.[0], fronts);
  // flat Art-Deco parapet caps
  placeBoxes(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xcfc7b2, roughness: 0.9 }),
    fronts.map(b => ({ pos: b.pos.clone().setY(b.pos.y + b.sy), rot: b.rot, sx: b.sx * 1.06, sy: 0.8, sz: b.sz * 1.06 })));
  // deeper city blocks behind the frontage
  const deep = [];
  for (let s = 34500; s < 51000; s += 13 * (0.6 + rand() * 0.8)) {
    const lat = -1 * (pavedHalfAt(s) + 40 + rand() * 260);
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = groundY(s, lat);
    deep.push(clampOffRoad({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
      sx: 14 + rand() * 16, sz: 14 + rand() * 16, sy: 20 + Math.pow(rand(), 1.4) * 60,
      color: new THREE.Color(deco[(rand() * deco.length) | 0]).multiplyScalar(0.8 + rand() * 0.25),
    }, s, lat, 0));
  }
  // Deep city-side carpet beyond the Art-Deco frontage. The sea side stays
  // open; the landward side does not dissolve into a tree/grass horizon.
  for (let s = 34500; s < 51000; s += 28 + rand() * 18) {
    const lat = -(pavedHalfAt(s) + 330 + rand() * 560);
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = groundY(s, lat);
    deep.push(clampOffRoad({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.25,
      sx: 28 + rand() * 42, sz: 26 + rand() * 38,
      sy: 16 + Math.pow(rand(), 1.3) * 78,
      color: new THREE.Color(deco[(rand() * deco.length) | 0]).multiplyScalar(0.58 + rand() * 0.2),
    }, s, lat, 0));
  }
  placeBoxes(scene, boxGeo, registry.towerMats?.[0], deep);

  // The Queen's Necklace: a curving line of warm sodium lamps along the sea
  // promenade, blazing after dark.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffcf80, emissiveIntensity: 0.2 });
  if (!registry.crownMats) registry.crownMats = [];
  registry.crownMats.push(lampMat);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.6, metalness: 0.4 });
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.11, 6, 6); poleGeo.translate(0, 3, 0);
  const lampGeo = new THREE.SphereGeometry(0.34, 8, 6); lampGeo.translate(0, 6.1, 0);
  const necklace = [];
  for (let s = s0; s < s1; s += 24) necklace.push(s);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, necklace.length);
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, necklace.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  necklace.forEach((s, i) => {
    posAt(s, SEA * (pavedHalfAt(s) + 2.5), p);
    q.setFromAxisAngle(UP, headingAt(s));
    m.compose(p, q, sc);
    poles.setMatrixAt(i, m); lamps.setMatrixAt(i, m);
  });
  scene.add(poles, lamps);

  buildBillboards(scene, registry, 733, 34000, 50800, 18, MUMBAI_ADS);
}

// Chowpatty beach: sand sloping into the sea, with a giant Mumbai Indians
// inflatable floaty bobbing just offshore.
function buildChowpatty(scene) {
  const c0 = 48800, c1 = 50600;
  const sand = new THREE.MeshStandardMaterial({ color: 0xd9c79a, roughness: 1 });
  scene.add(new THREE.Mesh(buildRibbon(
    s => SEA * (pavedHalfAt(s) + 4), s => SEA * (pavedHalfAt(s) + 120),
    0.0, SEA_Y + 0.15, 10, c0, c1), sand));

  // Mumbai Indians floaty
  const g = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: 0x0757a5, roughness: 0.4 });
  const navy = new THREE.MeshStandardMaterial({ color: 0x0a3d7a, roughness: 0.5 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 3.2, 12, 36), blue);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.6; g.add(ring);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 12.5, 0.5, 28), navy);
  disc.position.y = 0.4; g.add(disc);
  const board = textBoard(['MUMBAI', 'INDIANS', '🏏 MI 🏆'], 14, 10, '#0757a5', '#f2c94c');
  board.position.set(0, 8.5, 0); g.add(board);
  const board2 = board.clone(); board2.rotation.y = Math.PI; g.add(board2);
  const cp = posAt(49700, SEA * 165, new THREE.Vector3());
  g.position.set(cp.x, SEA_Y + 0.2, cp.z);
  g.rotation.y = headingAt(49700);
  scene.add(g);
}

// Nariman Point: the modern glass-tower tip at the south end of the drive.
function buildNarimanPoint(scene, registry) {
  skyline(scene, registry, 5599, 50600, 52000, 30, 40, 220, 80, 175, [-1, 1]);
}

function buildSignage(scene, registry) {
  // Bandra: exit for Chembur / Sion-Panvel and the Mumbai–Pune Expressway
  // (the india map). Faces both directions so it reads whichever way you drive.
  const ce = textBoard(['CHEMBUR · SION-PANVEL', 'MUMBAI–PUNE EXPWY', 'चेंबूर →'], 7, 3.6, '#046a38', '#fff');
  const cw = textBoard(['CHEMBUR · SION-PANVEL', 'MUMBAI–PUNE EXPWY', 'चेंबूर →'], 7, 3.6, '#046a38', '#fff');
  cw.rotation.y = Math.PI;
  gantry(scene, registry, 25000, [{ lat: -5.5, mesh: ce }, { lat: 5.5, mesh: cw }], 6.8);
  const a = textBoard(['BANDRA–WORLI', 'SEA LINK', 'वरळी सी लिंक'], 6.5, 3.4, '#0a2a5e', '#fff');
  gantry(scene, registry, 27600, [{ lat: -5, mesh: a }], 6.6);
  const b = textBoard(['MARINE DRIVE', 'मरीन ड्राइव्ह', 'NARIMAN POINT →'], 6.5, 3.4, '#0a2a5e', '#fff');
  gantry(scene, registry, 33400, [{ lat: -5, mesh: b }], 6.6);
  const c = textBoard(['CHOWPATTY', 'गिरगाव चौपाटी', '🏖'], 6, 3.0, '#0d6b3f', '#fff');
  gantry(scene, registry, 48600, [{ lat: -5, mesh: c }], 6.6);
}

function placeBoxes(scene, boxGeo, material, list) {
  if (!material || !list.length) return;
  const mesh = new THREE.InstancedMesh(boxGeo, material, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  list.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx, b.sy, b.sz);
    m.compose(b.pos, q, sc);
    mesh.setMatrixAt(i, m);
    if (b.color) mesh.setColorAt(i, b.color);
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  scene.add(mesh);
}
