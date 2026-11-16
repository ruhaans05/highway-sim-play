import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt } from './road.js';
import { groundY, buildTrees, buildSuburb, buildBillboards, deepSprawl, placementsAlong, scatterInstanced, facadeTexture } from './environment.js';
import { gantry, skyline, textBoard, welcomeSign } from './turnpike.js';

const rand = seed => { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };
function board(scene, registry, s, lines, lat = 0, color = '#046a38') {
  const side = lat || pavedHalfAt(s) + 8; const b = textBoard(lines, 9.8, 2.8, color, '#fff');
  b.position.copy(posAt(s, side, new THREE.Vector3())); b.position.y = groundY(s, side) + 6.2; b.rotation.y = headingAt(s) + Math.PI;
  scene.add(b); registry.signs.push({ userData: { board: b } });
}
function stores(scene, registry, s0, s1, seed, density = 1) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xb9afa2, roughness: .88 }); const r = rand(seed); const lots = [];
  for (let s = s0; s < s1; s += 145 / density) for (const side of [-1, 1]) {
    const lat = side * (55 + r() * 180); const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    lots.push({ pos: p, rot: headingAt(s), sx: 18 + r() * 38, sy: 5 + r() * 8, sz: 18 + r() * 34, color: new THREE.Color([0xc7b6a2, 0xb8c2c6, 0xd1c8b7, 0x9eabb1][(r() * 4) | 0]) });
  }
  scatterInstanced(scene, geo, mat, lots);
  buildBillboards(scene, registry, seed + 1, s0, s1, Math.max(5, Math.floor((s1 - s0) / 750)), [
    ['SHOPPING · GAS · FOOD', '#145a38', '#fff'], ['NJ LOCAL BUSINESSES', '#123c68', '#fff'], ['NEXT EXIT · RETAIL', '#a83228', '#fff'], ['GARDEN STATE SHOPPING', '#164d77', '#fff'],
  ]);
}
function bridges(scene, registry, list) {
  for (const [s, name] of list) {
    const g = new THREE.Group(); const deck = new THREE.Mesh(new THREE.BoxGeometry(pavedHalfAt(s) * 2 + 22, .9, 10), new THREE.MeshStandardMaterial({ color: 0x70777d, roughness: .75 }));
    deck.position.y = groundY(s, 0) + 7.5; g.add(deck);
    for (const x of [-pavedHalfAt(s) - 7, pavedHalfAt(s) + 7]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.7, 7.4, .7), deck.material); p.position.set(x, 3.7, 0); g.add(p); }
    g.position.copy(posAt(s, 0, new THREE.Vector3())); g.rotation.y = headingAt(s); scene.add(g); board(scene, registry, s, [name, 'NEW JERSEY'], 0);
  }
}
function layeredWoods(scene, s0, s1, seed) {
  buildTrees(scene, seed, s0, s1, 18, 28, 140, 0, false, 1.15);
  buildTrees(scene, seed + 1, s0, s1, 27, 120, 340, 0, true, 1.0);
  buildTrees(scene, seed + 2, s0, s1, 42, 300, 720, 0, false, .95);
}
function buildStoresAndSigns(scene, registry, s0, s1, seed) {
  stores(scene, registry, s0, s1, seed, 1.2);
  for (const s of [s0 + 1000, s0 + 5200, s1 - 1800]) board(scene, registry, s, ['NEXT EXIT', 'RETAIL · FOOD · GAS'], 0, '#145a38');
}
export function buildI280(scene, registry) {
  const tex = facadeTexture(44); const towers = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, roughness: .76 }); registry.towerMats = (registry.towerMats || []).concat(towers);
  layeredWoods(scene, 0, 39000, 2801); layeredWoods(scene, 39000, 52000, 2804); layeredWoods(scene, 52000, 70000, 2807);
  buildSuburb(scene, registry, 0, 30000, { wall: true }); buildStoresAndSigns(scene, registry, 30000, 52000, 2810); deepSprawl(scene, 2812, 39000, 70000, { density: 1.7, towers: true, glowMat: towers });
  skyline(scene, registry, 2813, 52000, 70000, 1400, 70, 330, 22, 82, [-1, 1]);
  bridges(scene, registry, [[4800, 'I-80 / US 46'], [13500, 'EISENHOWER PARKWAY'], [23500, 'NJ 24 / MORRISTOWN'], [33000, 'PLEASANT VALLEY WAY'], [42000, 'NORTHFIELD AVE'], [50500, 'GARDEN STATE PARKWAY'], [59500, 'NJ 21 · NEWARK']]);
  gantry(scene, registry, 900, [{ lat: -5, mesh: textBoard(['I-280 EAST', 'NEWARK · THE ORANGES'], 11, 3, '#046a38', '#fff') }], 7);
  gantry(scene, registry, 51500, [{ lat: 5, mesh: textBoard(['I-280 EAST', 'NEWARK · I-95 / TURNPIKE'], 11, 3, '#046a38', '#fff') }], 7);
  welcomeSign(scene, registry, 1500, 1, ['I-280', 'MORRIS COUNTY → NEWARK', 'GARDEN STATE'], '#046a38');
}
export function buildUS22(scene, registry) {
  const tex = facadeTexture(49); const towers = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, roughness: .78 }); registry.towerMats = (registry.towerMats || []).concat(towers);
  layeredWoods(scene, 0, 52000, 2201); layeredWoods(scene, 52000, 76000, 2204); layeredWoods(scene, 76000, 98000, 2207);
  buildSuburb(scene, registry, 0, 52000, { wall: false }); buildSuburb(scene, registry, 52000, 98000, { wall: true });
  buildStoresAndSigns(scene, registry, 30000, 76000, 2210); deepSprawl(scene, 2212, 30000, 98000, { density: 1.9, towers: true, glowMat: towers });
  skyline(scene, registry, 2213, 80000, 98000, 1500, 60, 300, 22, 82, [-1, 1]);
  bridges(scene, registry, [[9500, 'PHILLIPSBURG'], [22000, 'NJ 31 · CLINTON'], [35500, 'US 202 · SOMERVILLE'], [54000, 'GARDEN STATE PARKWAY'], [68000, 'NJ 82 · UNION'], [82000, 'SPRINGFIELD AVE · NEWARK']]);
  gantry(scene, registry, 54500, [{ lat: -5, mesh: textBoard(['GARDEN STATE PARKWAY', 'NORTH / SOUTH · EXIT'], 11, 3, '#046a38', '#fff') }], 7);
  gantry(scene, registry, 90000, [{ lat: 5, mesh: textBoard(['US-22 EAST', 'NEWARK · HUDSON COUNTY · NYC'], 11, 3, '#046a38', '#fff') }], 7);
  board(scene, registry, 93000, ['HUDSON COUNTY', 'NEW YORK CITY SKYLINE AHEAD'], 0, '#123c68');
  welcomeSign(scene, registry, 1200, 1, ['US-22', 'LEHIGH VALLEY → UNION', 'NEW JERSEY'], '#046a38');
}
