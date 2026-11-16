import * as THREE from 'three';
import {
  posAt, headingAt, sideFactorAt, pavedHalfAt, medianHalfAt, elevAt,
  bridgeBumpAt, buildRibbon,
} from './road.js';
import {
  groundY, roadClearAt, buildTrees, buildBillboards, buildSuburb,
  scatterInstanced, placementsAlong, facadeTexture, lowLitMaterial, deepSprawl,
  buildNoiseWall,
} from './environment.js';
import {
  welcomeSign, gantry, textBoard, water, buildTollPlaza, bridgeStructure, skyline,
  viaductPiers,
} from './turnpike.js';
import { buildWindFarm, buildUrbanGround } from './midwest.js';

// I-80 from the George Washington Bridge across to Chicago: north-Jersey
// suburbs, the NJ Appalachians at the Delaware Water Gap, the long PA ridges
// and Allegheny plateau, NE Ohio (Youngstown, Cleveland on Lake Erie, the
// Toledo flats), the Indiana Toll Road, and the Borman into Gary.

// The Manhattan skyline seen from afar across the north-Jersey hills: a tall
// backdrop far off on the NYC (east) side. It opts out of scene fog so it can
// read on the horizon from kilometres away, but main.js fades its clarity with
// the live fog level (crisp on a clear day, hazed-out when it's murky) and
// lights it up at night — so cresting a rise you sometimes catch the city far
// ahead, sometimes lost in haze. Terrain between occludes it except from the tops.
function farNyc(scene, registry) {
  const tex = facadeTexture(23);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    color: 0x93a6c4, roughness: 0.85, transparent: true, opacity: 1, fog: false,
  });
  registry.farSkylineMats = [mat];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const places = [];
  for (let i = 0; i < 150; i++) {
    const s = 200 + Math.random() * 3400;
    const lat = 360 + Math.random() * 1250;                  // across the Hudson, NYC side
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = 0;
    places.push({
      pos, rot: Math.random() * Math.PI * 2,
      sx: 26 + Math.random() * 46, sz: 26 + Math.random() * 46,
      sy: 150 + Math.pow(Math.random(), 1.3) * 220,
    });
  }
  scatterInstanced(scene, boxGeo, mat, places, { shadow: false });
}

// A big water plane offset to one side of the road (Lake Erie).
function lake(scene, s, length, latOffset, width) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length, 1, 6),
    new THREE.MeshStandardMaterial({ color: 0x2b5570, roughness: 0.25, metalness: 0.4 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(posAt(s, latOffset, new THREE.Vector3()));
  mesh.position.y = -2.4;
  mesh.rotation.z = -headingAt(s);
  scene.add(mesh);
}

// Suburban / small-town houses set back behind the tree line.
function buildHouses(scene, s0, s1, seed, dens = 26, registry = null) {
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
  const bodyMat = registry ? lowLitMaterial(registry)
    : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3f36, roughness: 0.95 });
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xb0553f];
  const houses = placementsAlong(seed, s0, s1, dens, 56, 300, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.3,
    sx: 8 + rand() * 5, sy: 3.8 + rand() * 2.6, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, bodyGeo, bodyMat, houses);
  scatterInstanced(scene, bodyGeo, roofMat, houses.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
    sx: h.sx * 1.14, sy: 0.5, sz: h.sz * 1.14,
  })));
}

// Big-box / warehouse / farm-shed low industrial along the flat stretches.
function buildLowSheds(scene, s0, s1, seed) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const tints = [0xcfc9bd, 0xbfc4c9, 0xd0c2a6, 0xb6a99a, 0xc9cdbf];
  scatterInstanced(scene, boxGeo, mat,
    placementsAlong(seed, s0, s1, 120, 70, 300, (rand, pos, s) => ({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
      sx: 22 + rand() * 46, sy: 7 + rand() * 9, sz: 18 + rand() * 34,
      color: new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.85 + rand() * 0.25),
    }), 30));
}

// Overhead guide gantry facing both directions.
function junction(scene, registry, s, lines) {
  const a = textBoard(lines, 7.2, 3.4, '#046a38', '#ffffff');
  const b = textBoard(lines, 7.2, 3.4, '#046a38', '#ffffff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 6.8);
}

// Overhead dynamic message sign (VMS): black panel, amber text, both faces.
// Pushed into registry.signs so the amber glows at night like the real thing.
function vms(scene, registry, s, lines) {
  const a = textBoard(lines, 6.2, 3.0, '#0b0b0d', '#f2a100');
  const b = textBoard(lines, 6.2, 3.0, '#0b0b0d', '#f2a100'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -5.5, mesh: a }, { lat: 5.5, mesh: b }], 6.8);
  registry.signs.push({ userData: { board: a } });
  registry.signs.push({ userData: { board: b } });
}

// One very wide green pull-through sign spanning the whole roadway: the I-80
// East shield and a control-city destination, with a down-arrow hanging over
// each lane (no mileage) — the "I-80 EAST  NEW YORK CITY  ↓ ↓ ↓" gantry.
function laneArrows(scene, registry, s, shield, dest, lanes) {
  const w = 4.2 * lanes + 4;                       // wide enough to bridge the lanes
  const arrows = Array(lanes).fill('↓').join('          ');
  const front = textBoard([`${shield}   ${dest}`, arrows], w, 4.2, '#046a38', '#ffffff');
  const back = textBoard([`${shield}   ${dest}`, arrows], w, 4.2, '#046a38', '#ffffff');
  back.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: 0, mesh: front }, { lat: 0, mesh: back }], 7.4);
}

// Roadside regulatory sign — white board, black text (hazmat / truck / lane
// restrictions). Placed & aimed like a welcome sign: on the outer shoulder of
// the direction `dir` (dir<0 = toward the GWB, decreasing s), facing that
// traffic so a driver approaching the bridge reads it head-on.
function regSign(scene, registry, s, lines, dir = -1, bg = '#f4f4f2', fg = '#111111') {
  const board = textBoard(lines, 6.4, 3.4, bg, fg);
  board.position.y = 4.7;
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.6 });
  for (const px of [-2.5, 2.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.8, 6), poleMat);
    pole.position.set(px, 2.1, 0);
    g.add(pole);
  }
  g.add(board);
  const side = (dir > 0 ? -1 : 1) * Math.sign(sideFactorAt(s, dir) || 1);
  const lat = side * (roadClearAt(s) + 5.0);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + (dir > 0 ? 0 : Math.PI);
  scene.add(g);
  registry.signs.push({ userData: { board } });
}

// A highway travel plaza / truck stop set off the shoulder: a lot, a canopy over
// the fuel islands, a food-and-fuel building with a lit brand pylon, and parked
// trucks. Reads as the Flying J / Pilot clusters along I-80 and the Indiana Toll
// Road oases. `brand` sets the pylon text/colour.
function travelPlaza(scene, registry, s, side, brand = 'TRAVEL PLAZA', bg = '#c8102e') {
  const g = new THREE.Group();
  const rot = headingAt(s);
  const p = posAt(s, side * 62, new THREE.Vector3()); const gy = groundY(s, side * 62);
  g.position.set(p.x, gy, p.z); g.rotation.y = rot;

  const lot = new THREE.Mesh(new THREE.BoxGeometry(90, 0.1, 70), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95 }));
  lot.position.y = 0.05; lot.receiveShadow = true; g.add(lot);
  // main building
  const bldg = new THREE.Mesh(new THREE.BoxGeometry(30, 7, 16), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.85 }));
  bldg.position.set(0, 3.5, -22); bldg.castShadow = true; g.add(bldg);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(30.4, 1.6, 16.4), new THREE.MeshStandardMaterial({ color: 0x1b3f8f, roughness: 0.6 }));
  stripe.position.set(0, 6.2, -22); g.add(stripe);
  // fuel canopy on posts
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(34, 0.8, 20), new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.6 }));
  canopy.position.set(0, 6.4, 6); canopy.castShadow = true; g.add(canopy);
  for (const cx of [-15, 15]) for (const cz of [-8, 8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6.4, 8), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.5 }));
    post.position.set(cx, 3.2, 6 + cz); g.add(post);
  }
  // fuel islands + pumps
  for (const px of [-9, -3, 3, 9]) {
    const island = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.9 }));
    island.position.set(px, 0.2, 6); g.add(island);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1.4), new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.5 }));
    pump.position.set(px, 1.1, 6); g.add(pump);
  }
  // brand pylon (lit at night — registered as a sign board)
  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 18, 8), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.5 }));
  pylon.position.set(-40, 9, 6); g.add(pylon);
  const sign = textBoard([brand, 'FUEL · FOOD', '24 HR'], 8, 5, bg, '#ffffff');
  sign.position.set(-40, 15, 6); sign.rotation.y = Math.PI / 2; g.add(sign);
  registry.signs.push({ userData: { board: sign } });
  // parked semis at the truck lot
  const trailerMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.8 });
  const cabCols = [0x8c1c1c, 0x1e3a6e, 0x14161a, 0x2a6a3a];
  for (let i = 0; i < 6; i++) {
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 13), trailerMat);
    trailer.position.set(-38 + i * 8, 1.9, -34); trailer.castShadow = true; g.add(trailer);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.6, 4), new THREE.MeshStandardMaterial({ color: cabCols[i % 4], roughness: 0.5 }));
    cab.position.set(-38 + i * 8, 1.7, -26); cab.castShadow = true; g.add(cab);
  }
  scene.add(g);
}

// Farm country: big crop fields (corn/soy/tilled earth) beyond the treeline with
// scattered barns, grain silos and round hay bales — the Ohio lake plain and the
// dead-flat Indiana Toll Road farmland.
function farmland(scene, s0, s1, seed) {
  // large low crop quads on both sides
  const cropCols = [0x6a7f38, 0x8a8f3a, 0xc2b25a, 0x9a8256, 0x7a8a40];
  const fields = placementsAlong(seed, s0, s1, 120, 90, 420, (rand, pos, s) => ({
    pos: pos.clone().setY(pos.y + 0.05), rot: headingAt(s) + (rand() - 0.5) * 0.2,
    sx: 70 + rand() * 90, sy: 1, sz: 70 + rand() * 90,
    color: new THREE.Color(cropCols[(rand() * cropCols.length) | 0]),
  }), 20);
  const quad = new THREE.BoxGeometry(1, 0.06, 1);
  scatterInstanced(scene, quad, new THREE.MeshStandardMaterial({ roughness: 1 }), fields, { shadow: false });
  // barns (red gable boxes)
  const barnGeo = new THREE.BoxGeometry(1, 1, 1); barnGeo.translate(0, 0.5, 0);
  const barns = placementsAlong(seed + 1, s0, s1, 320, 80, 340, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.3,
    sx: 10 + rand() * 8, sy: 6 + rand() * 3, sz: 14 + rand() * 8,
    color: new THREE.Color([0x8a2f2a, 0x9a3a2a, 0x6a4a3a, 0xb0553f][(rand() * 4) | 0]),
  }), 24);
  scatterInstanced(scene, barnGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), barns);
  // grain silos (tall metal cylinders, clustered by the barns)
  const siloGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10); siloGeo.translate(0, 0.5, 0);
  const silos = placementsAlong(seed + 2, s0, s1, 300, 84, 320, (rand, pos, s) => ({
    pos, rot: headingAt(s),
    sx: 4 + rand() * 2, sy: 10 + rand() * 6, sz: 4 + rand() * 2,
    color: new THREE.Color(0xcfd2d6),
  }), 24);
  scatterInstanced(scene, siloGeo, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 }), silos);
  // round hay bales dotting the fields
  const haleGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); haleGeo.rotateZ(Math.PI / 2); haleGeo.translate(0, 0.5, 0);
  const bales = placementsAlong(seed + 3, s0, s1, 46, 76, 380, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5),
    sx: 1.6 + rand(), sy: 1.6 + rand() * 0.5, sz: 2.2 + rand(),
    color: new THREE.Color(0xcaa85a),
  }), 20);
  scatterInstanced(scene, haleGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), bales, { shadow: false });
}

// Northwest Indiana is not just generic Midwest farmland: the Toll Road runs
// through exceptionally flat glacial plain, with drainage ditches, shelterbelts
// and occasional wet prairie. These long, low elements make the horizon read as
// Indiana instead of an undifferentiated green carpet.
function indianaLowlands(scene, s0, s1, seed) {
  const ditchMat = new THREE.MeshStandardMaterial({ color: 0x425d4c, roughness: 0.95, metalness: 0.05 });
  const ditch = new THREE.BoxGeometry(1, 0.12, 1);
  const ditches = [];
  for (let s = s0; s < s1; s += 420) {
    for (const side of [-1, 1]) {
      const p = posAt(s, side * (roadClearAt(s) + 15), new THREE.Vector3());
      ditches.push({ pos: p.clone().setY(groundY(s, side * (roadClearAt(s) + 15)) + 0.02), rot: headingAt(s), sx: 1.3, sy: 1, sz: 210 });
    }
  }
  scatterInstanced(scene, ditch, ditchMat, ditches, { shadow: false });

  const trunk = new THREE.CylinderGeometry(0.18, 0.24, 4.5, 6); trunk.translate(0, 2.25, 0);
  const crown = new THREE.SphereGeometry(1.7, 7, 5); crown.translate(0, 4.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4633, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x455f38, roughness: 1 });
  const rows = placementsAlong(seed, s0, s1, 170, 70, 130, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s), sx: 0.8 + rand() * 0.5, sy: 0.8 + rand() * 0.6, sz: 0.8 + rand() * 0.5,
  }), 8);
  scatterInstanced(scene, trunk, trunkMat, rows, { shadow: false });
  scatterInstanced(scene, crown, crownMat, rows, { shadow: false });
}

// The Gary approach has a distinctive steel-and-rail industrial horizon. Keep
// it sparse and set back: the real view alternates mills, slag lots and open
// scrub rather than becoming a continuous city skyline.
function garySteelBelt(scene, s0, s1) {
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x737a78, roughness: 0.65, metalness: 0.55 });
  const rustMat = new THREE.MeshStandardMaterial({ color: 0x713f2b, roughness: 0.9, metalness: 0.25 });
  for (let s = s0; s < s1; s += 1100) {
    const lat = -90 - ((s / 1100) % 2) * 55;
    const p = posAt(s, lat, new THREE.Vector3());
    const g = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 12, 12), tankMat);
    tank.position.y = 6; g.add(tank);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 28, 8), rustMat);
    stack.position.set(12, 14, 4); g.add(stack);
    const shed = new THREE.Mesh(new THREE.BoxGeometry(36, 8, 20), rustMat);
    shed.position.set(-18, 4, -18); g.add(shed);
    g.position.set(p.x, groundY(s, lat), p.z); g.rotation.y = headingAt(s); scene.add(g);
  }
}

// A low concrete deck and regularly spaced bents. Used for the Hackensack,
// Paterson, Calumet and south-Chicago stretches where I-80 rides over local
// streets, rail yards, floodplain and low industrial fabric rather than over
// empty terrain.
function raisedDeck(scene, s0, s1) {
  viaductPiers(scene, s0, s1);
  const concrete = new THREE.MeshStandardMaterial({ color: 0x777975, roughness: 0.92 });
  const underside = new THREE.MeshStandardMaterial({ color: 0x555a5d, roughness: 0.95 });
  const edge = side => side * (pavedHalfAt((s0 + s1) / 2) + 0.45);
  scene.add(new THREE.Mesh(buildRibbon(() => -pavedHalfAt((s0 + s1) / 2) - 0.45, () => pavedHalfAt((s0 + s1) / 2) + 0.45, -1.15, -0.55, 12, s0, s1), underside));
  for (const side of [-1, 1]) {
    scene.add(new THREE.Mesh(buildRibbon(() => edge(side), () => edge(side), 0.2, 1.25, 10, s0, s1), concrete));
  }
}

// Frequent local-road and rail overpasses are the visual cadence of the real
// corridor. Their columns stay outside the clear zone and the deck is high
// enough for trucks, so these add enclosure without creating collisions.
function minorOverpass(scene, s, seed = 0) {
  const h = headingAt(s), half = pavedHalfAt(s) + 8;
  const deckY = elevAt(s) + 8.2;
  const p = posAt(s, 0, new THREE.Vector3());
  const concrete = new THREE.MeshStandardMaterial({ color: seed % 3 ? 0x777b7d : 0x8a8378, roughness: 0.94 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x4c545b, roughness: 0.72, metalness: 0.25 });
  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z); g.rotation.y = h;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.15, 12), concrete);
  deck.position.y = deckY; g.add(deck);
  for (const z of [-5.6, 5.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.5, 1.0, 0.35), steel);
    rail.position.set(0, deckY + 1.05, z); g.add(rail);
  }
  for (const x of [-half + 2.5, half - 2.5]) {
    const ground = groundY(s, x);
    const col = new THREE.Mesh(new THREE.BoxGeometry(1.5, Math.max(2, deckY - ground), 2.0), concrete);
    col.position.set(x, ground + Math.max(2, deckY - ground) / 2, 0); g.add(col);
  }
  scene.add(g);
}

// Dense trees inside the broad PA median make each carriageway feel like a
// separate road. Bridge and interchange decks remain clear; the broken ranges
// below preserve occasional views of opposing traffic instead of producing an
// artificial, perfectly continuous hedge.
function medianForest(scene, s0, s1, seed, step = 12) {
  const trunk = new THREE.CylinderGeometry(0.2, 0.32, 7, 6); trunk.translate(0, 3.5, 0);
  const crown = new THREE.SphereGeometry(1.5, 7, 5); crown.scale(1, 1.75, 1); crown.translate(0, 7.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x554431, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x365b32, roughness: 1 });
  let state = seed >>> 0;
  const rand = () => ((state = Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5 | 0), ((state ^ state >>> 14) >>> 0) / 4294967296);
  const places = [];
  for (let s = s0; s < s1; s += step * (0.7 + rand() * 0.65)) {
    if (bridgeBumpAt(s) > 1.2) continue;
    // Reserve at least 3.1 m between every crown centre and the inside edge
    // line. This was deliberately audited against the maximum crown scale so
    // foliage cannot hang into either live lane.
    const room = Math.max(0.45, medianHalfAt(s) - 3.1);
    const lat = (rand() * 2 - 1) * room;
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
    places.push({ pos, rot: rand() * Math.PI, sx: 0.75 + rand() * 0.45, sy: 0.85 + rand() * 0.55, sz: 0.75 + rand() * 0.45 });
  }
  const trunks = scatterInstanced(scene, trunk, trunkMat, places, { shadow: false });
  const crowns = scatterInstanced(scene, crown, crownMat, places, { shadow: false });
  if (trunks) trunks.userData.roadMedianForest = true;
  if (crowns) crowns.userData.roadMedianForest = true;
}

export function buildI80(scene, registry) {
  // shared lit-window facade material for the skylines (glows at night)
  const tex = facadeTexture(19);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.7, color: 0xffffff,
  });
  registry.towerMats = [towerMat];

  // --- North Jersey off the GWB. Eastbound (s → 0) the sprawl gets denser and
  // closer to the road the nearer you get to the bridge — but this is New
  // Jersey, not Manhattan: continuous mid-rise cities (Paterson, Passaic,
  // Hackensack, Fort Lee), NO towers and NO bare gaps. The skyscrapers live
  // across the Hudson, and only there.

  // continuous fabric the whole way in so there's never an empty patch: receding
  // rows of houses, garden apartments, strip retail, warehouses on both sides
  buildSuburb(scene, registry, 1200, 24000, { wall: true });
  deepSprawl(scene, 8081, 1800, 24000, { density: 1.05, towers: false, litMat: lowLitMaterial(registry) });

  // leafy outer Bergen/Passaic (Parsippany → Paramus): houses behind a tree screen
  buildHouses(scene, 12000, 23000, 8001, 20, registry);
  buildTrees(scene, 8003, 13000, 23000, 9, 26, 82, 300, false, 1.4);   // taller, denser green wall hides the sprawl
  buildTrees(scene, 8004, 14000, 23000, 18, 58, 175, 150, true, 1.35);
  buildTrees(scene, 8005, 2500, 24000, 10, 34, 145, 180, false, 1.3);
  buildTrees(scene, 8006, 6000, 24000, 17, 95, 310, 130, true, 1.2);

  // Hackensack/Paterson/Wayne: repeated urban viaducts over roads, rivers and
  // rail corridors, with low fabric below and sound walls/tree screens beside.
  for (const [a, b] of [[1800, 4100], [5600, 9100], [10400, 12800], [15600, 16900], [19800, 21000]]) raisedDeck(scene, a, b);

  // the inner cities front the road continuously — MID-RISE ONLY, growing a
  // little taller and tighter toward the bridge but never a skyline
  skyline(scene, registry, 8090, 8000, 15000, 46, 46, 240, 8, 22);       // town centres: 2-6 storey blocks
  skyline(scene, registry, 8091, 4200, 9500, 32, 40, 210, 12, 42);       // Paterson/Passaic mid-rise, packed both sides
  skyline(scene, registry, 8092, 300, 4600, 26, 38, 165, 16, 60, [-1]);  // Fort Lee/Palisades apartments — west bank only
  buildBillboards(scene, registry, 8093, 800, 15000, 26);                // urban billboards close in

  // THE REVEAL: the Hudson on the right and Manhattan stacked across it — THIS
  // is where the towers are, not in Jersey. A huge night sky-glow over the far
  // bank; the same skyline shows far off from the NJ hills too (farNyc).
  lake(scene, 1700, 4200, 240, 190);                                // the Hudson between the shore and the city
  skyline(scene, registry, 8095, 200, 3200, 36, 320, 560, 95, 262, [1]);
  farNyc(scene, registry);

  // --- George Washington Bridge approach (eastbound, s → 0): the classic NJ
  // GWB sign sequence — control cities, the I-95/I-80 split, upper/lower-level
  // lane assignment, toll, and the hazmat / truck restrictions.
  junction(scene, registry, 6400, ['I-95 NORTH', 'GEO WASH BRIDGE', 'UPPER · LOWER  2 MI']);
  junction(scene, registry, 4600, ['I-80 WEST — EXIT', 'I-95 SOUTH · NJ TPKE', 'NEWARK · TRENTON']);
  junction(scene, registry, 3400, ['LEFT 2 LANES', 'UPPER LEVEL', 'GWB · MANHATTAN']);
  junction(scene, registry, 3000, ['RIGHT 3 LANES', 'LOWER LEVEL', 'GWB · CROSS BRONX']);
  regSign(scene, registry, 2600, ['TRUCKS · BUSES', 'USE LOWER LEVEL']);
  regSign(scene, registry, 2200, ['⛔ NO HAZ-MAT', 'GWB LOWER LEVEL', 'LAST NJ EXIT']);
  junction(scene, registry, 1000, ['GEORGE WASHINGTON', 'BRIDGE  ·  TOLL', 'E-ZPASS · CASH']);

  // --- Delaware Water Gap: forested Appalachian ridge, Delaware River bridge
  buildTrees(scene, 8010, 22000, 42000, 16, 30, 360, 130);
  buildTrees(scene, 8011, 26000, 42000, 30, 60, 440, 90, true);   // pines up the ridge
  bridgeStructure(scene, 36500, 37900, [36900, 37500]);
  water(scene, 37200, 900, 2600);                                 // Delaware River
  // (the WELCOME TO NJ/PA boards are auto-placed at the state line by
  // placeStateLineSigns() in main.js, aligned to the CITY_BANDS border)

  // --- Pennsylvania: the long haul over the tall ridges + Allegheny plateau,
  // dense forest, the odd small town and truck-stop cluster
  buildTrees(scene, 8020, 42000, 112000, 13, 28, 380, 160, false, 1.25); // PA ridge-and-valley forest
  buildTrees(scene, 8021, 46000, 112000, 24, 52, 460, 110, true, 1.3);   // spruce/pine on the ridgetops
  buildTrees(scene, 8027, 48000, 82000, 10, 24, 300, 190, true, 1.35);   // dense Poconos evergreen wall
  buildTrees(scene, 8022, 112000, 146000, 18, 34, 380, 120);      // plateau woods
  buildTrees(scene, 8037, 42000, 146000, 11, 20, 135, 230, false, 1.45); // close shoulder canopy, including mountain cuts
  buildTrees(scene, 8038, 44000, 144000, 20, 120, 520, 150, true, 1.28); // deep wooded horizon
  for (const [a, b, seed] of [[43000, 57000, 811], [61000, 79000, 812], [84000, 108000, 813], [116000, 142000, 814]]) medianForest(scene, a, b, seed, 10);
  buildHouses(scene, 42000, 52000, 8023, 40, registry);                     // Stroudsburg
  buildHouses(scene, 82000, 104000, 8024, 40, registry);                    // Hazleton / Bloomsburg
  buildHouses(scene, 124000, 132000, 8025, 44, registry);                   // Clearfield
  // a little receding town fabric behind each so they don't stop at one row of
  // houses (mostly screened by the forest, but it fills the gaps you do see)
  deepSprawl(scene, 8028, 42000, 52000, { density: 0.5, towers: false, litMat: lowLitMaterial(registry) });
  deepSprawl(scene, 8029, 82000, 104000, { density: 0.4, towers: false, litMat: lowLitMaterial(registry) });
  buildBillboards(scene, registry, 8026, 42000, 146000, 40);
  // a few scattered turbines on the high Allegheny plateau ridgetops (sparse,
  // not the dense I-65 farm)
  buildWindFarm(scene, registry, 128000, 142000, 781, { gap: 900, gapRnd: 500, skip: 0.45 });
  // travel plazas / truck stops along the long PA haul
  travelPlaza(scene, registry, 70000, -1, 'PILOT · FLYING J', '#c8102e');
  travelPlaza(scene, registry, 104000, 1, 'TRAVEL PLAZA', '#1b3f8f');

  // --- NE Ohio: Youngstown, then Cleveland on Lake Erie, then the Toledo flats
  buildTrees(scene, 8030, 146000, 164000, 24, 40, 380, 90);
  buildTrees(scene, 8035, 146000, 164000, 17, 28, 230, 125, true, 1.15);
  buildHouses(scene, 148000, 162000, 8031, 34, registry);                   // Youngstown / Warren
  deepSprawl(scene, 8032, 148000, 162000, { density: 0.7, towers: false, litMat: lowLitMaterial(registry) });

  // Cleveland skyline on the inland (south) side, Lake Erie behind it (north)
  skyline(scene, registry, 8040, 166000, 172500, 22, 90, 360, 45, 150, [-1]);
  // the Cleveland metro is big — eastern suburbs (Euclid/Willoughby/Mentor),
  // downtown, then the west side out toward Lorain. Continuous inland sprawl,
  // roadside trees and boards, NOT the empty Indiana flats.
  buildTrees(scene, 8033, 158000, 182000, 16, 28, 230, 100);       // roadside trees (lake side auto-culled)
  deepSprawl(scene, 8034, 158000, 182000, { side: -1, glowMat: registry.towerMats[0], density: 0.9, litMat: lowLitMaterial(registry) });
  buildBillboards(scene, registry, 8041, 158000, 182000, 18);
  lake(scene, 173000, 20000, 240, 5200);                          // Lake Erie, Cleveland → Toledo

  // Toledo: flat industrial river city, small skyline
  skyline(scene, registry, 8050, 189000, 192500, 24, 80, 300, 35, 95, [-1]);
  buildLowSheds(scene, 182000, 204000, 8051);
  buildTrees(scene, 8054, 182000, 204000, 38, 42, 250, 85, false, 1.05);
  farmland(scene, 182000, 204000, 8053);                          // Ohio lake-plain farm country
  buildBillboards(scene, registry, 8052, 182000, 204000, 22);
  travelPlaza(scene, registry, 196000, -1, 'PILOT', '#c8102e');   // Ohio Turnpike-side stop
  // (PA/OH welcome boards auto-placed at the state line — see main.js)

  // --- Indiana Toll Road: dead-flat farm country, the toll plaza, high-mast lit
  buildLowSheds(scene, 204000, 228000, 8060);
  buildTrees(scene, 8061, 204000, 228000, 42, 34, 280, 90, false, 1.08);
  buildTrees(scene, 8065, 204000, 228000, 70, 120, 400, 55, true, 1.0);
  farmland(scene, 204000, 228000, 8063);                          // Indiana farmland
  indianaLowlands(scene, 204000, 228000, 8064);
  buildWindFarm(scene, registry, 212000, 222000, 782, { gap: 950, gapRnd: 500, skip: 0.5 }); // a handful in the IN fields
  buildTollPlaza(scene, registry, 206500);                        // IN Toll Road barrier
  travelPlaza(scene, registry, 216000, -1, 'TOLL ROAD OASIS', '#0d4a2c'); // Indiana oasis
  buildBillboards(scene, registry, 8062, 204000, 228000, 18);
  // (OH/IN welcome boards auto-placed at the state line — see main.js)

  // --- Gary / Chicago: heavy industry (steel mills, tank farms), the I-65/80
  // interchange the Midwest map begins from
  // Replace the exposed terrain throughout the visible Southland footprint,
  // but leave the freeway envelope open.  buildUrbanGround samples the real
  // ground on each side, so these bands remain below the raised I-80 decks.
  buildUrbanGround(scene, 228000, 261000, 1100, 0x4d504c, 60);
  buildLowSheds(scene, 228000, 261000, 8070);
  garySteelBelt(scene, 228000, 245000);
  buildBillboards(scene, registry, 8071, 228000, 261000, 16);
  buildNoiseWall(scene, 228000, 261000, { seed: 8072, height: 6.2, step: 10, margin: 3.5, gapChance: 0.08 });
  buildTrees(scene, 8073, 228000, 261000, 22, 38, 190, 130, false, 1.12);
  deepSprawl(scene, 8074, 228000, 261000, { density: 1.05, towers: false, litMat: lowLitMaterial(registry) });
  skyline(scene, registry, 8075, 236000, 254000, 34, 95, 430, 8, 32); // low south-suburban Chicago fabric, not downtown towers
  for (const [a, b] of [[228400, 231300], [233000, 236200], [238000, 241100], [244000, 246700], [251000, 253600]]) raisedDeck(scene, a, b);

  const crossings = [
    2600, 4300, 6100, 7900, 9900, 11800, 14200, 17400, 19500, 21800, 24500,
    44000, 49500, 56500, 64000, 73500, 82500, 91500, 103000, 119000, 132000, 143000,
    151000, 160000, 169000, 178000, 188500, 198000,
    207000, 214000, 221000, 230000, 236800, 242500, 248500, 255500, 259000,
  ];
  crossings.forEach((s, i) => minorOverpass(scene, s, 8200 + i));

  // Major interchanges along the run (the GWB approach is signed above)
  junction(scene, registry, 16000, ['EXIT 43', 'I-287', 'MORRISTOWN · MAHWAH']);
  junction(scene, registry, 62000, ['EXIT 277', 'I-476', 'ALLENTOWN · SCRANTON']);
  junction(scene, registry, 88000, ['EXIT 236', 'I-81', 'WILKES-BARRE · HARRISBURG']);
  junction(scene, registry, 114000, ['EXIT 178', 'I-99', 'STATE COLLEGE · ALTOONA']);
  junction(scene, registry, 164000, ['EXIT 180', 'I-77 SOUTH', 'CLEVELAND · AKRON']);
  junction(scene, registry, 186000, ['EXIT 71', 'I-75', 'TOLEDO · DETROIT · DAYTON']);
  junction(scene, registry, 234000, ['I-65 SOUTH', 'INDIANAPOLIS', 'I-80/94 · CHICAGO']);
  junction(scene, registry, 246000, ['I-294 NORTH', 'CHICAGO · WISCONSIN', 'I-80 WEST · IOWA']);
  junction(scene, registry, 257000, ['I-57 NORTH', 'CHICAGO', 'I-80 WEST · JOLIET']);

  // Youngstown: the big wide I-80 EAST → NEW YORK CITY pull-through, an arrow
  // hanging over each of the three lanes (no mileage) — NYC is THE eastbound
  // control city for I-80.
  laneArrows(scene, registry, 156000, 'I-80 EAST', 'NEW YORK CITY', 3);

  // --- roadside furniture: control-city mileage boards, electronic message
  // signs, adopt-a-highway and traveler-radio signs, sprinkled (not spammy)
  junction(scene, registry, 50000, ['STROUDSBURG   12', 'NEW YORK CITY   88']);
  junction(scene, registry, 100000, ['BLOOMSBURG   10', 'DANVILLE   24', 'CLEARFIELD   96']);
  junction(scene, registry, 140000, ['CLARION   28', 'SHARON   82', 'CLEVELAND OH   140']);
  junction(scene, registry, 178000, ['TOLEDO   52', 'SOUTH BEND   140', 'CHICAGO   238']);
  // variable message signs (amber on black, glow at night)
  vms(scene, registry, 34000, ['DELAWARE RIVER BR', 'EXPECT DELAYS']);
  vms(scene, registry, 120000, ['BUCKLE UP', 'IT IS THE LAW']);
  vms(scene, registry, 198000, ['511 · TRAVEL INFO', 'CHECK CONDITIONS']);
  // adopt-a-highway (green) + traveler-radio (blue) roadside boards
  regSign(scene, registry, 46000, ['ADOPT A HIGHWAY', 'NEXT 2 MILES', 'ROTARY CLUB'], -1, '#0b6b3a', '#ffffff');
  regSign(scene, registry, 168000, ['ADOPT A HIGHWAY', 'LITTER CREW', 'BOY SCOUTS'], -1, '#0b6b3a', '#ffffff');
  regSign(scene, registry, 60000, ['TRAVELER INFO', 'TUNE 1610 AM'], -1, '#12356f', '#ffffff');
  regSign(scene, registry, 190000, ['HIGHWAY RADIO', 'TUNE 1640 AM'], 1, '#12356f', '#ffffff');
}
