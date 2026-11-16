import * as THREE from 'three';
import { posAt, headingAt } from './road.js';
import {
  groundY, buildTrees, scatterInstanced, placementsAlong, facadeTexture,
} from './environment.js';
import {
  gantry, textBoard, skyline, water, suspensionBridge, bridgeStructure,
} from './turnpike.js';

// San Francisco Bay Area loop: SF skyline + the long Bay Bridge, the Port of
// Oakland cranes, sprawl climbing the golden East Bay hills, Mount Diablo over
// the I-680 valley, and the Carquinez/Benicia crossings up north.

const TAU = Math.PI * 2;
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A signature tapered tower (Salesforce Tower, Transamerica Pyramid).
function tower(scene, mat, s, lat, w, h, taper) {
  const geo = taper
    ? new THREE.CylinderGeometry(w * 0.15, w * 0.62, h, 4)
    : new THREE.BoxGeometry(w, h, w * 0.85);
  if (!taper) geo.translate(0, h / 2, 0); else geo.translate(0, h / 2, 0);
  const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(pos); m.rotation.y = headingAt(s) + (taper ? Math.PI / 4 : 0);
  m.castShadow = true; scene.add(m);
}

// California hills: golden grass dotted with dark oaks, homes and mid-rises
// climbing the slopes so the ridgelines read as urbanized even from a distance.
function hillsideUrban(scene, seed, s0, s1) {
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x9a6b4a, roughness: 0.95 });
  const tints = [0xe6ddca, 0xd8cbb0, 0xcbb89a, 0xe0d0b4, 0xd0b89a, 0xc9c4b4];
  // stucco homes + the odd mid-rise, spread from just off the road up the slopes
  const homes = placementsAlong(seed, s0, s1, 14, 40, 460, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.7,
    sx: 7 + rand() * 8, sy: 4 + Math.pow(rand(), 1.6) * 20, sz: 7 + rand() * 8,
    color: new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.85 + rand() * 0.25),
  }));
  scatterInstanced(scene, bodyGeo, bodyMat, homes);
  scatterInstanced(scene, bodyGeo, roofMat, homes.filter(h => h.sy < 8).map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot, sx: h.sx * 1.15, sy: 0.5, sz: h.sz * 1.15,
  })));
  // sparse oaks
  buildTrees(scene, seed + 3, s0, s1, 26, 30, 420, 0);
}

// Flat valley / bayshore town: denser low-rise carpet with a few towers.
function townUrban(scene, registry, seed, s0, s1) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const tints = [0xd9d2c2, 0xc8c0ae, 0xbfb6a4, 0xd4c2a4, 0xc2b09a];
  const low = [], towers = [];
  const rand = rng(seed);
  for (let s = s0; s < s1; s += 9 * (0.6 + rand() * 0.7)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.12) continue;
      const lat = side * (24 + Math.pow(rand(), 1.3) * 300);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.8 + rand() * 0.3);
      if (rand() < 0.86) low.push({ pos, rot: headingAt(s) + (rand() - 0.5) * 0.5, sx: 8 + rand() * 13, sz: 8 + rand() * 13, sy: 6 + Math.pow(rand(), 1.4) * 20, color });
      else towers.push({ pos, rot: headingAt(s) + (rand() - 0.5) * 0.4, sx: 12 + rand() * 8, sz: 12 + rand() * 8, sy: 34 + rand() * 40, color });
    }
  }
  scatterInstanced(scene, boxGeo, flat, low);
  scatterInstanced(scene, boxGeo, registry.towerMats?.[0] ?? flat, towers);
}

// Port of Oakland: the row of tall white container gantry cranes on the bayside.
function portCranes(scene, s0, s1) {
  const white = new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.6, metalness: 0.3 });
  const rand = rng(9931);
  for (let s = s0; s < s1; s += 90 + rand() * 60) {
    const lat = -(70 + rand() * 60);   // bay side
    const g = new THREE.Group();
    for (const dx of [-9, 9]) for (const dz of [-5, 5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 42, 1.4), white);
      leg.position.set(dx, 21, dz); g.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 46), white); beam.position.set(0, 43, 6); g.add(beam);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 30), white); boom.position.set(-14, 40, 0); boom.rotation.z = 0.2; g.add(boom);
    g.position.copy(posAt(s, lat, new THREE.Vector3())); g.position.y = groundY(s, lat);
    g.rotation.y = headingAt(s);
    scene.add(g);
  }
}

// Mount Diablo rising over the I-680 valley — a big distant peak.
function mtDiablo(scene, s) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8248, roughness: 1 });
  const lat = -1300;
  const peak = new THREE.Mesh(new THREE.ConeGeometry(900, 780, 5), mat);
  peak.position.copy(posAt(s, lat, new THREE.Vector3()));
  peak.position.y = groundY(s, lat) + 260;
  scene.add(peak);
}

// North Bay freeway edges are a patchwork of salt ponds, levees and vineyards.
// Long, low bands keep the scenery geographically legible without turning the
// loop into a collection of isolated props.
function northBayAgriculture(scene, s0, s1) {
  const salt = new THREE.MeshStandardMaterial({ color: 0x6f8174, roughness: 0.95 });
  const vine = new THREE.MeshStandardMaterial({ color: 0x69733f, roughness: 1 });
  const band = new THREE.BoxGeometry(1, 0.08, 1);
  for (let s = s0; s < s1; s += 360) {
    const side = s < 68000 ? -1 : 1;
    const lat = side * (roadClearAtBay(s) + 110);
    const p = posAt(s, lat, new THREE.Vector3());
    const mat = (s % 720 < 360) ? salt : vine;
    const m = new THREE.Mesh(band, mat);
    m.position.copy(p); m.position.y = groundY(s, lat) + 0.04;
    m.rotation.y = headingAt(s); m.scale.set(80, 1, 260); scene.add(m);
  }
}

function roadClearAtBay(s) {
  return 18 + (s < 12000 ? 5 : 0);
}

// The East Bay hills read less like bare cones and more like California's
// eucalyptus/oak suburban ridges when a few tall windbreaks break the roofline.
function eucalyptusRidges(scene, s0, s1) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x645548, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4e6c52, roughness: 1 });
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 8, 7); trunk.translate(0, 4, 0);
  const leaf = new THREE.SphereGeometry(2.2, 7, 5); leaf.translate(0, 8.5, 0);
  const trees = [];
  for (let s = s0; s < s1; s += 190) for (const side of [-1, 1]) {
    const lat = side * (90 + ((s / 190) % 3) * 22);
    const p = posAt(s, lat, new THREE.Vector3());
    trees.push({ pos: p, rot: headingAt(s), sx: 0.8, sy: 0.9, sz: 0.8 });
  }
  scatterInstanced(scene, trunk, trunkMat, trees, { shadow: false });
  scatterInstanced(scene, leaf, leafMat, trees, { shadow: false });
}

function jn(scene, registry, s, lines) {
  const a = textBoard(lines, 7, 3.4, '#046a38', '#fff');
  const b = textBoard(lines, 7, 3.4, '#046a38', '#fff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 6.8);
}

export function buildBay(scene, registry) {
  const tex = facadeTexture(31);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  });
  registry.towerMats = [towerMat];

  // --- San Francisco: dense downtown skyline with signature towers
  skyline(scene, registry, 3110, 300, 5600, 20, 70, 320, 45, 150, [-1]);
  skyline(scene, registry, 3111, 300, 5600, 24, 70, 340, 40, 120, [1]);
  tower(scene, towerMat, 2600, -150, 34, 190);              // Salesforce Tower
  tower(scene, towerMat, 2200, -120, 26, 150, true);        // Transamerica Pyramid
  tower(scene, towerMat, 3000, -185, 26, 140);              // 555 California

  // --- Bay Bridge: long west suspension span + east self-anchored span, water
  suspensionBridge(scene, 6600, 8600, 7000, 8200, 60);     // west span (SF anchorage)
  bridgeStructure(scene, 8600, 11400, [9200, 10400]);      // east span truss/tower
  water(scene, 9000, 5200, 4200);                          // San Francisco Bay

  // --- Oakland / Emeryville: downtown + the Port of Oakland cranes
  townUrban(scene, registry, 3120, 12000, 20000);
  portCranes(scene, 12500, 18500);

  // --- I-580 Oakland hills → Castro Valley: sprawl climbing the golden hills
  hillsideUrban(scene, 3130, 20000, 33000);
  eucalyptusRidges(scene, 21000, 33000);

  // --- Dublin / Pleasanton valley
  townUrban(scene, registry, 3140, 33000, 41000);

  // --- I-680 Diablo valley: San Ramon/Walnut Creek/Concord under Mt Diablo
  hillsideUrban(scene, 3150, 41000, 45000);
  townUrban(scene, registry, 3151, 45000, 60000);
  mtDiablo(scene, 50000);

  // --- Benicia / Carquinez crossings + north-bay water
  bridgeStructure(scene, 59300, 60700, [59800, 60300]);
  water(scene, 60000, 1400, 2600);
  bridgeStructure(scene, 71800, 73300, [72300, 72800]);
  water(scene, 72500, 1500, 2800);

  // --- North bay + East Bay: Fairfield/Vallejo/Richmond/Berkeley/Emeryville
  townUrban(scene, registry, 3160, 61000, 75000);
  northBayAgriculture(scene, 61000, 75000);
  hillsideUrban(scene, 3170, 75000, 88000);                // Richmond/El Cerrito/Berkeley hills
  townUrban(scene, registry, 3180, 88000, 97500);

  // control-city / interchange gantries around the loop
  jn(scene, registry, 13000, ['MACARTHUR MAZE', 'I-580 E · I-880 S', 'HAYWARD · SAN JOSE']);
  jn(scene, registry, 26000, ['I-238', 'I-880 · HAYWARD', 'SAN LEANDRO']);
  jn(scene, registry, 34000, ['I-680 NORTH', 'WALNUT CREEK', 'SACRAMENTO']);
  jn(scene, registry, 50000, ['CA-24', 'WALNUT CREEK', 'BERKELEY · OAKLAND']);
  jn(scene, registry, 64000, ['I-80', 'SACRAMENTO', 'SAN FRANCISCO']);
  jn(scene, registry, 76000, ['I-580 WEST', 'RICHMOND–SAN RAFAEL BR', 'SAN RAFAEL · MARIN']);
  jn(scene, registry, 92000, ['I-80 WEST', 'BAY BRIDGE', 'SAN FRANCISCO']);
}
