import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, elevAt, latForLane, buildRibbon } from './road.js';
import {
  buildSuburb, buildTrees, buildBillboards, scatterInstanced,
  placementsAlong, groundY, facadeTexture, buildNoiseWall, deepSprawl,
} from './environment.js';
import {
  gantry, textBoard, buildTollPlaza, skyline, water,
  suspensionBridge,
} from './turnpike.js';

// I-287 through New Jersey: industrial central Jersey giving way to the wooded
// Watchung / Morris / Ramapo highlands, then the NY line at the Thruway, east
// across Rockland, over the Tappan Zee Bridge, and south on I-87 (the Deegan)
// through Yonkers and the Bronx to the George Washington Bridge (I-95).

// Morristown / Parsippany corporate campuses: low glass office slabs set back
// behind their parking lots.
function buildOfficeParks(scene, s0, s1) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fa6b8, roughness: 0.25, metalness: 0.5 });
  const parks = placementsAlong(3410, s0, s1, 200, 75, 260, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.5,
    sx: 30 + rand() * 40, sy: 9 + rand() * 16, sz: 22 + rand() * 30,
    color: new THREE.Color(0xffffff).multiplyScalar(0.8 + rand() * 0.3),
  }), 20);
  scatterInstanced(scene, boxGeo, glassMat, parks);
}

// Suburban Morris / Bergen / Rockland: an endless carpet of ranch and colonial
// houses behind the tree line.
function buildHouses(scene, s0, s1, seed = 3420) {
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x54463c, roughness: 0.95 });
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xe0dcd2];
  const houses = placementsAlong(seed, s0, s1, 22, 60, 300, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.3,
    sx: 9 + rand() * 5, sy: 3.6 + rand() * 2.4, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, bodyGeo, bodyMat, houses);
  scatterInstanced(scene, bodyGeo, roofMat, houses.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
    sx: h.sx * 1.12, sy: 0.5, sz: h.sz * 1.12,
  })));
}

// I-287 in NJ/NY runs through near-continuous eastern hardwood forest — walls of
// trees right up to the shoulder covering the towns, with deep woods behind.
// clampOffRoad keeps the trunks off the pavement, so a low latMin just tightens
// the tree line to the road.
function forestBand(scene, seed, s0, s1) {
  buildTrees(scene, seed,     s0, s1, 10, 9,  66, 0);          // broadleaf tight to the shoulder
  buildTrees(scene, seed + 1, s0, s1, 12, 11, 60, 0, true);   // pines mixed in close
  buildTrees(scene, seed + 2, s0, s1, 11, 54, 210, 0);        // broadleaf depth behind
  buildTrees(scene, seed + 3, s0, s1, 14, 82, 300, 0, true);  // conifer ridgeline depth
}

// Dense low/mid urban carpet (Yonkers, the Bronx): shops-with-flats, walk-ups,
// the odd tower and glass slab pressed right up to the highway.
function buildUrban(scene, registry, seed, s0, s1) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.25, metalness: 0.5 });
  const tints = [0xcabfa6, 0xb0a89a, 0xa89c8e, 0xc2b4a0, 0x9c948a, 0xb5433a];
  const low = [], towers = [], glass = [];
  const rand = (() => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  for (let s = s0; s < s1; s += 8 * (0.6 + rand() * 0.7)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.08) continue;
      const lat = side * (20 + Math.pow(rand(), 1.3) * 260);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.78 + rand() * 0.3);
      const r = rand();
      if (r < 0.7) low.push({ pos, rot: headingAt(s) + (rand() - 0.5) * 0.5, sx: 8 + rand() * 14, sz: 8 + rand() * 14, sy: 8 + Math.pow(rand(), 1.4) * 26, color });
      else if (r < 0.9) towers.push({ pos, rot: headingAt(s) + (rand() - 0.5) * 0.4, sx: 12 + rand() * 8, sz: 12 + rand() * 8, sy: 40 + rand() * 46, color });
      else glass.push({ pos, rot: headingAt(s) + (rand() - 0.5) * 0.25, sx: 18 + rand() * 20, sz: 14 + rand() * 12, sy: 20 + rand() * 24, color: new THREE.Color(0xffffff).multiplyScalar(0.85 + rand() * 0.2) });
    }
  }
  scatterInstanced(scene, boxGeo, flat, low);
  scatterInstanced(scene, boxGeo, registry.towerMats?.[0] ?? flat, towers);
  scatterInstanced(scene, boxGeo, glassMat, glass);
}

// Overhead guide gantry at a route junction, boards facing both directions.
function junction(scene, registry, s, lines) {
  const nb = textBoard(lines, 6.5, 3.4, '#046a38', '#ffffff');
  const sb = textBoard(lines, 6.5, 3.4, '#046a38', '#ffffff');
  sb.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: nb }, { lat: 6, mesh: sb }], 6.6);
}

function beamBetween(scene, a, b, radius, material) {
  const delta = b.clone().sub(a); const length = delta.length();
  if (length < 0.1) return;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 7), material);
  beam.position.copy(a).add(b).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  scene.add(beam);
}

// Modern twin-span cable-stayed Governor Mario M. Cuomo Bridge. The roadway
// remains the shared route ribbon; these structures supply the real visual
// language: eight chamfered towers, fan stays, deep approach girders, piers,
// the blue shared-use path and six belvederes.
function buildTappanZee(scene, registry, s0 = 90600, s1 = 97000) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x697d8f, roughness: 0.42, metalness: 0.65, side: THREE.DoubleSide });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xa9adb0, roughness: 0.86 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0xdce4e9, roughness: 0.3, metalness: 0.75 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x2479b8, roughness: 0.82, side: THREE.DoubleSide });
  const edge = side => s => side * (pavedHalfAt(s) + 1.1);
  for (const side of [-1, 1]) {
    scene.add(new THREE.Mesh(buildRibbon(edge(side), edge(side), -3.2, 0.45, 12, s0, s1), steel));
  }
  // Twelve-foot path on the north side of the westbound span.
  scene.add(new THREE.Mesh(buildRibbon(
    s => pavedHalfAt(s) + 1.6, s => pavedHalfAt(s) + 5.25,
    0.38, 0.38, 12, s0, s1), pathMat));

  // Low approach piers across the broad Hudson shallows.
  for (let s = s0 + 140; s < s1 - 140; s += 235) {
    if ((s > 92400 && s < 93500) || (s > 94600 && s < 95700)) continue;
    for (const side of [-1, 1]) {
      const lat = side * (pavedHalfAt(s) * 0.55);
      const p = posAt(s, lat, new THREE.Vector3());
      const h = Math.max(9, elevAt(s) + 6);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(4.6, h, 3.6), concrete);
      pier.position.set(p.x, elevAt(s) - h / 2 - 2.8, p.z);
      pier.rotation.y = headingAt(s); scene.add(pier);
    }
  }

  const towerStations = [92800, 93320, 94780, 95300];
  for (const ts of towerStations) {
    for (const side of [-1, 1]) {
      const lat = side * (pavedHalfAt(ts) + 0.5);
      const base = posAt(ts, lat, new THREE.Vector3());
      const tower = new THREE.Mesh(new THREE.BoxGeometry(3.8, 58, 4.2), concrete);
      tower.position.copy(base).setY(elevAt(ts) + 29); tower.rotation.y = headingAt(ts); scene.add(tower);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 5.2), steel);
      cap.position.copy(base).setY(elevAt(ts) + 58); cap.rotation.y = headingAt(ts); scene.add(cap);
      const top = base.clone().setY(elevAt(ts) + 56);
      for (const ds of [-390, -270, -155, 155, 270, 390]) {
        const anchorS = ts + ds;
        if (anchorS <= s0 + 80 || anchorS >= s1 - 80) continue;
        const anchor = posAt(anchorS, side * (pavedHalfAt(anchorS) + 0.8), new THREE.Vector3());
        anchor.y = elevAt(anchorS) + 1.2;
        beamBetween(scene, top, anchor, 0.13, cableMat);
      }
    }
  }

  // Six widened scenic overlooks along the shared path.
  for (const s of [91400, 92400, 93800, 94800, 95900, 96600]) {
    const lat = pavedHalfAt(s) + 6.2;
    const p = posAt(s, lat, new THREE.Vector3());
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.45, 28), pathMat);
    deck.position.copy(p).setY(elevAt(s) + 0.25); deck.rotation.y = headingAt(s); scene.add(deck);
  }

  const lampMat = new THREE.MeshStandardMaterial({ color: 0xdcecff, emissive: 0x74b9ff, emissiveIntensity: 0 });
  registry.bridgeLightMats = (registry.bridgeLightMats || []).concat(lampMat);
  const lamps = [];
  for (let s = s0 + 20; s < s1; s += 42) for (const side of [-1, 1]) {
    const lat = side * (pavedHalfAt(s) + 1.2);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = elevAt(s) + 1.6;
    lamps.push({ pos: p, rot: 0, sx: 0.28, sy: 0.28, sz: 0.28 });
  }
  scatterInstanced(scene, new THREE.SphereGeometry(1, 7, 5), lampMat, lamps, { shadow: false });
}

// Cashless bridge tolling sits at the Tarrytown landing and reads only the
// increasing-s (eastbound/southbound) carriageway. It intentionally does not
// enter traffic's booth-slowdown table: vehicles pass beneath at highway speed.
function buildTappanTollGantry(scene, registry, s = 97400) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x59636c, roughness: 0.58, metalness: 0.65 });
  const scannerMat = new THREE.MeshStandardMaterial({ color: 0x171b20, emissive: 0x33465a, emissiveIntensity: 0.55 });
  const group = new THREE.Group();
  const laneLats = [0, 1, 2, 3].map(lane => latForLane(1, lane, s));
  const minLat = Math.min(...laneLats) - 2.2, maxLat = Math.max(...laneLats) + 2.2;
  for (const lat of [minLat, maxLat]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.2, 0.55), metal);
    post.position.set(lat, 3.6, 0); group.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(maxLat - minLat + 1, 0.55, 0.55), metal);
  beam.position.set((minLat + maxLat) / 2, 7, 0); group.add(beam);
  for (const lat of laneLats) {
    const scanner = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.0), scannerMat);
    scanner.position.set(lat, 6.45, 0); group.add(scanner);
  }
  const sign = textBoard(['CASHLESS TOLLING', 'E-ZPASS · TOLLS BY MAIL'], 7.2, 2.5, '#164a70', '#ffffff');
  sign.position.set((minLat + maxLat) / 2, 9.1, 0); sign.rotation.y = Math.PI; group.add(sign);
  registry.signs.push({ userData: { board: sign } });
  group.position.copy(posAt(s, 0, new THREE.Vector3())); group.rotation.y = headingAt(s); scene.add(group);
}

function buildHighlandRockCuts(scene) {
  const rock = new THREE.MeshStandardMaterial({ color: 0x56564f, roughness: 1 });
  const faces = [];
  for (const [s0, s1, seed] of [[36500, 42000, 1], [52500, 58500, 2], [61000, 68000, 3], [75500, 84000, 4], [99500, 106000, 5]]) {
    for (let s = s0 + seed * 17; s < s1; s += 115 + (s * seed % 73)) {
      for (const side of [-1, 1]) {
        const lat = side * (pavedHalfAt(s) + 10 + (s % 9));
        const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
        faces.push({ pos: p, rot: headingAt(s), sx: 8 + (s % 11), sy: 7 + (s % 13), sz: 32 + (s % 24),
          color: new THREE.Color(side > 0 ? 0x5c5b53 : 0x4d4f49) });
      }
    }
  }
  scatterInstanced(scene, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), rock, faces);
}

export function buildI287(scene, registry) {
  // shared lit-window facade material for the NY skylines (glows at night)
  const tex = facadeTexture(23);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // Central NJ: Perth Amboy port/industrial + Edison–Bridgewater sprawl
  buildSuburb(scene, registry, 700, 20000);
  // Perth Amboy is inside the continuous New York metro fabric, not an open
  // plain. Keep development behind dense native hardwood screening and broken
  // wall runs so the freeway feels enclosed without putting buildings in the
  // clear zone.
  forestBand(scene, 3380, 300, 20500);
  buildTrees(scene, 3384, 500, 20500, 12, 85, 320, 0, false, 1.25);
  buildTrees(scene, 3385, 500, 20500, 15, 145, 480, 0, true, 1.12);
  deepSprawl(scene, 3386, 400, 22000, { density: 1.3, towers: false });
  buildHouses(scene, 2500, 20500, 3387);
  // One continuous run prevents the old call boundaries and steep grades from
  // producing visible breaks. The shared wall builder now pitches each panel
  // to the terrain, so the ends remain joined even through rolling ground.
  buildNoiseWall(scene, 250, 52000, { seed: 3388, height: 6.1, margin: 4, step: 9, gapChance: 0 });
  // Edison / New Brunswick / Bridgewater: continuous settled corridor behind
  // the walls, then increasingly wooded Watchung terrain rather than gaps.
  deepSprawl(scene, 3390, 20000, 35000, { density: 1.15, towers: false });
  buildHouses(scene, 20500, 34000, 3391);

  // Toll barrier where I-287 meets the NJ Turnpike (Exit 10) at the south end —
  // you pay entering/leaving the Turnpike. Sign both directions.
  buildTollPlaza(scene, registry, 1500);
  const te = textBoard(['NJ TURNPIKE · I-95', 'NEW YORK · TRENTON'], 6.5, 3.4, '#046a38', '#fff');
  const tw = textBoard(['NJ TURNPIKE · I-95', 'NEW YORK · TRENTON'], 6.5, 3.4, '#046a38', '#fff'); tw.rotation.y = Math.PI;
  gantry(scene, registry, 2600, [{ lat: -6, mesh: te }, { lat: 6, mesh: tw }], 6.8);

  // Northern NJ highlands: wooded Watchung/Morris/Ramapo hills, corporate
  // campuses, suburban housing — the highway runs through walls of trees.
  forestBand(scene, 3401, 20000, 72000);
  buildTrees(scene, 3400, 20500, 72000, 12, 95, 420, 0, false, 1.25);
  buildOfficeParks(scene, 34000, 51000);
  buildHouses(scene, 34000, 71000);
  buildBillboards(scene, registry, 3403, 20200, 70000, 22);
  buildHighlandRockCuts(scene);

  // NJ/NY state line at the Thruway — welcome signs (both directions) are now
  // auto-placed from CITY_BANDS state borders in main.js (placeStateLineSigns).

  // --- New York: Rockland County — wooded Thruway suburbs (Suffern → Nyack)
  forestBand(scene, 3420, 72000, 90000);
  buildHouses(scene, 74000, 89000, 3430);
  deepSprawl(scene, 3432, 72000, 90000, { density: 0.85, towers: false, latStart: 170 });
  buildNoiseWall(scene, 72000, 90000, { seed: 3433, height: 5.9, margin: 4, step: 9, gapChance: 0 });
  buildBillboards(scene, registry, 3431, 72000, 89000, 14);

  // --- Tappan Zee (Mario Cuomo) Bridge over the Hudson: long high crossing
  buildTappanZee(scene, registry);
  water(scene, 93700, 8400, 4200);
  buildTappanTollGantry(scene, registry, 97400);
  const tz = textBoard(['TAPPAN ZEE BRIDGE', 'GOV MARIO M. CUOMO', 'WESTCHESTER →'], 8, 3.6, '#0a2a5e', '#fff');
  gantry(scene, registry, 90200, [{ lat: 0, mesh: tz }], 7);

  // --- Westchester: Tarrytown, where I-287 turns south onto I-87 (the Deegan)
  forestBand(scene, 3440, 98000, 120000);
  buildHouses(scene, 99000, 107000, 3441);
  deepSprawl(scene, 3443, 98000, 134000, { density: 1.2, latStart: 170 });
  buildNoiseWall(scene, 98000, 130000, { seed: 3442, height: 5.8, margin: 4.0, step: 9, gapChance: 0 });

  // --- Yonkers: dense city on the Hudson bluffs, a small waterfront skyline
  buildUrban(scene, registry, 3450, 108000, 120000);
  skyline(scene, registry, 3451, 111000, 116000, 22, 70, 240, 34, 92, [-1]);
  buildBillboards(scene, registry, 3452, 108000, 119000, 16);

  // --- The Bronx: wall-to-wall urban along the Major Deegan
  buildUrban(scene, registry, 3460, 120000, 130000);
  skyline(scene, registry, 3461, 122000, 127000, 24, 80, 260, 30, 80, [-1]);

  // --- George Washington Bridge: the crossing back to New Jersey / I-95
  suspensionBridge(scene, 130200, 131900, 130600, 131500, 46);
  water(scene, 131050, 2200, 2600);
  const gw = textBoard(['GEO WASHINGTON BR', 'I-95 · NEW JERSEY', 'FORT LEE →'], 9, 3.6, '#046a38', '#fff');
  gantry(scene, registry, 129600, [{ lat: 0, mesh: gw }], 7.2);

  // Major interchanges
  junction(scene, registry, 29000, ['EXIT 21', 'I-78', 'NEWARK · CLINTON']);
  junction(scene, registry, 49000, ['EXIT 41', 'I-80', 'NEW YORK · WATER GAP']);
  junction(scene, registry, 70800, ['EXIT 67', 'I-87 · THRUWAY', 'ALBANY · NYC']);
  junction(scene, registry, 100800, ['EXIT 8', 'I-287 EAST', 'WHITE PLAINS']);
  junction(scene, registry, 104200, ['I-87 SOUTH', 'MAJOR DEEGAN', 'YONKERS · NYC']);
  junction(scene, registry, 126800, ['EXIT 1', 'I-95 · CROSS BRONX', 'GW BRIDGE · NEW JERSEY']);
}
