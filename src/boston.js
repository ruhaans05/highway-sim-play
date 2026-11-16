import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt } from './road.js';
import {
  groundY, roadClearAt, buildTrees, buildBillboards, buildNoiseWall, deepSprawl,
  scatterInstanced, placementsAlong, lowLitMaterial,
} from './environment.js';
import { welcomeSign, gantry, textBoard, addSkyGlow } from './turnpike.js';

// New England branch off I-95 North at New Haven: I-91 up to Hartford, I-84
// east over the CT hills to the Massachusetts line, then the Mass Pike (I-90)
// across central Massachusetts into Boston, ending at Logan Airport.

const TAU = Math.PI * 2;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Dark facade with a grid of lit windows — used as map + emissiveMap so the
// towers glow at night (ramped by updateEnvironment via registry.cityGlow).
function windowTexture(seed) {
  const rand = rng(seed);
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0d12'; g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 9) {
    for (let x = 4; x < 64; x += 8) {
      g.fillStyle = rand() < 0.62 ? '#fff4d6' : '#12151b';
      g.fillRect(x, y, 5, 6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _beaconTex = null;
function beaconTexture() {
  if (_beaconTex) return _beaconTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,70,70,0.9)');
  grd.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  _beaconTex = new THREE.CanvasTexture(c);
  return _beaconTex;
}

// A cluster of glowing-window towers, one InstancedMesh per glow material so
// each colour-tint lights independently.
function skyline(scene, registry, seed, s0, s1, opts) {
  const { latMin, latMax, hMin, hMax, glowMats, side = -1, dens = 22 } = opts;
  const rand = rng(seed);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const buckets = glowMats.map(() => []);
  for (let s = s0; s < s1; s += dens * (0.55 + rand() * 0.7)) {
    if (rand() < 0.14) continue;
    const lat = side * (latMin + rand() * (latMax - latMin));
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = groundY(s, lat);
    buckets[(rand() * glowMats.length) | 0].push({
      pos, rot: rand() * TAU,
      sx: 14 + rand() * 26, sz: 14 + rand() * 26,
      sy: hMin + Math.pow(rand(), 1.5) * (hMax - hMin),
    });
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  buckets.forEach((places, mi) => {
    if (!places.length) return;
    const mesh = new THREE.InstancedMesh(boxGeo, glowMats[mi], places.length);
    places.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.rot); sc.set(b.sx, b.sy, b.sz);
      m.compose(b.pos, q, sc); mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

// A named signature tower (Prudential, Hancock, Custom House...) with optional crown.
function signatureTower(scene, mat, s, lat, w, h, crownColor) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
  const mesh = new THREE.Mesh(boxGeo, mat);
  mesh.position.copy(pos); mesh.rotation.y = headingAt(s);
  mesh.scale.set(w, h, w * 0.82);
  mesh.castShadow = true;
  scene.add(mesh);
  if (crownColor) {
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0, w * 0.5, w * 0.6, 4, 1, true),
      new THREE.MeshStandardMaterial({ color: crownColor, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
    crown.position.copy(pos).y += h + w * 0.3;
    crown.rotation.y = headingAt(s) + Math.PI / 4;
    scene.add(crown);
  }
}

// Rooftop aviation-beacon sprites scattered over a skyline (blink at night).
function skylineBeacons(scene, registry, seed, s0, s1, side, count) {
  const rand = rng(seed);
  const mats = [0xff3b3b, 0xffffff, 0xff6633].map(c => new THREE.SpriteMaterial({
    map: beaconTexture(), color: c, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  for (let i = 0; i < count; i++) {
    const s = s0 + rand() * (s1 - s0);
    const lat = side * (60 + rand() * 320);
    const spr = new THREE.Sprite(mats[(rand() * mats.length) | 0]);
    spr.position.copy(posAt(s, lat, new THREE.Vector3()));
    spr.position.y = groundY(s, lat) + 40 + rand() * 150;
    const sz = 8 + rand() * 12; spr.scale.set(sz, sz, 1);
    scene.add(spr);
  }
  registry.cityBeacons = (registry.cityBeacons || []).concat(mats);
}

// Hartford: a compact downtown skyline on the west bank of the Connecticut
// River — the "Boston" tower (City Place), Travelers Tower, the Gold Building.
function buildHartford(scene, registry, glowMats) {
  skyline(scene, registry, 4101, 17200, 21500, {
    latMin: 110, latMax: 330, hMin: 40, hMax: 110, glowMats, side: -1, dens: 20,
  });
  signatureTower(scene, glowMats[1], 19200, -150, 26, 130);                 // City Place I
  signatureTower(scene, glowMats[3], 18700, -120, 22, 116, 0xffcf6a);       // Travelers Tower (lit cupola)
  signatureTower(scene, glowMats[2], 19700, -180, 24, 100);                 // Gold Building (glass)
  skylineBeacons(scene, registry, 4102, 17800, 20800, -1, 14);
}

// Boston: the Back Bay / Financial District skyline as the Pike comes in —
// Prudential, 200 Clarendon (Hancock), Custom House clock tower, Fed Reserve.
function buildBoston(scene, registry, glowMats) {
  skyline(scene, registry, 4201, 54000, 60200, {
    latMin: 90, latMax: 420, hMin: 45, hMax: 150, glowMats, side: -1, dens: 18,
  });
  // signature towers, roughly in their real relative positions coming in
  signatureTower(scene, glowMats[0], 58200, -170, 34, 168);                 // Prudential Tower
  signatureTower(scene, glowMats[2], 58700, -135, 30, 158);                 // 200 Clarendon (glass)
  signatureTower(scene, glowMats[7], 59300, -110, 22, 96, 0x9ad0ff);        // Custom House clock tower
  signatureTower(scene, glowMats[1], 59700, -200, 26, 132);                 // One Boston Place
  signatureTower(scene, glowMats[4], 57600, -150, 24, 120);                 // 111 Huntington (lantern top)
  skylineBeacons(scene, registry, 4202, 54000, 60200, -1, 40);
}

// Logan International: control tower, terminal slabs, aprons and a couple of
// parked jets on the harbour side as the Pike surfaces from the Ted Williams
// Tunnel. Terminus of the run.
function buildLogan(scene, registry) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.25, metalness: 0.5 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.6 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const S = 63500, sideLat = 1;   // harbour side

  // terminal buildings
  const terms = [];
  for (let i = 0; i < 5; i++) {
    const s = 61600 + i * 700;
    const lat = sideLat * (60 + (i % 2) * 40);
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
    terms.push({ pos, rot: headingAt(s), sx: 34 + i * 6, sy: 10 + (i % 2) * 6, sz: 90 });
  }
  scatterInstanced(scene, boxGeo, glass, terms);

  // the iconic control tower: twin shafts + a wide cab on top
  const tPos = posAt(S, sideLat * 150, new THREE.Vector3()); tPos.y = groundY(S, sideLat * 150);
  for (const dx of [-3, 3]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 62, 12), concrete);
    shaft.position.copy(tPos); shaft.position.x += dx; shaft.position.y += 31;
    scene.add(shaft);
  }
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(9, 7, 9, 12), glass);
  cab.position.copy(tPos); cab.position.y += 66; scene.add(cab);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 6, 12), white);
  roof.position.copy(tPos); roof.position.y += 73; scene.add(roof);
  // beacon on the tower
  const bmat = new THREE.SpriteMaterial({
    map: beaconTexture(), color: 0xff3b3b, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const beacon = new THREE.Sprite(bmat);
  beacon.position.copy(tPos); beacon.position.y += 79; beacon.scale.set(10, 10, 1);
  scene.add(beacon);
  registry.cityBeacons = (registry.cityBeacons || []).concat([bmat]);

  // apron + a few parked jets (fuselage tube + swept wings + tail)
  const jetBody = new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.5, metalness: 0.2 });
  for (let i = 0; i < 4; i++) {
    const s = 61800 + i * 720;
    const lat = sideLat * (34 + (i % 2) * 8);
    const g = new THREE.Group();
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 34, 10), jetBody);
    fus.rotation.z = Math.PI / 2; fus.position.y = 2.2; g.add(fus);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 26), jetBody);
    wing.position.y = 2.0; g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 5), jetBody);
    tail.position.set(-15, 4.5, 0); g.add(tail);
    g.position.copy(posAt(s, lat, new THREE.Vector3()));
    g.position.y = groundY(s, lat);
    g.rotation.y = headingAt(s) + Math.PI / 2;
    scene.add(g);
  }
}

// CT / central Massachusetts: New England highways run through near-continuous
// forest — walls of trees right up to the tree line, not open land. Dense mixed
// broadleaf + pine hugging the shoulder plus deep woods behind, the whole way
// through the I-91 hills and the I-84 / Mass Pike run (skipping the Hartford
// and Boston urban cores). clampOffRoad keeps trunks off the pavement, so a low
// latMin just packs the tree line tight against the road.
function neForestBand(scene, seed, s0, s1) {
  buildTrees(scene, seed,     s0, s1, 9,  8,  64, 0);          // broadleaf tight to the shoulder
  buildTrees(scene, seed + 1, s0, s1, 11, 10, 60, 0, true);   // pines mixed in close
  buildTrees(scene, seed + 2, s0, s1, 10, 52, 210, 0);        // broadleaf depth behind
  buildTrees(scene, seed + 3, s0, s1, 13, 80, 300, 0, true);  // pine ridgeline depth
}
function buildNewEnglandForest(scene) {
  neForestBand(scene, 4301, 700, 16000);     // I-91 wooded the moment you leave New Haven
  neForestBand(scene, 4311, 23000, 53000);   // I-84 CT hills + central-MA Mass Pike woods
  neForestBand(scene, 4321, 50000, 62000);   // Route 128 / Boston outer approach
}

// New England colonial / triple-decker sprawl set back behind the trees.
function buildHouses(scene, s0, s1, seed) {
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3f36, roughness: 0.95 });
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xb0553f];
  const houses = placementsAlong(seed, s0, s1, 26, 58, 300, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.3,
    sx: 8 + rand() * 5, sy: 4.2 + rand() * 3.2, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, bodyGeo, bodyMat, houses);
  scatterInstanced(scene, bodyGeo, roofMat, houses.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
    sx: h.sx * 1.14, sy: 0.5, sz: h.sz * 1.14,
  })));
}

// HOV / carpool gantry over the left lane at a point on the Mass Pike.
function buildHovSigns(scene, registry) {
  for (const s of [42000, 47000]) {
    const b = textBoard(['◇ HOV 2+', 'LEFT LANE'], 5.6, 3.0, '#046a38', '#ffffff');
    gantry(scene, registry, s, [{ lat: -3.6, mesh: b }], 6.8);
  }
}

export function buildNewEngland(scene, registry) {
  // window-glow palette (Boston/Hartford light up hard and varied at night)
  const cityMats = [0xfff0cf, 0xe6efff, 0xbfe0ff, 0xffd27a, 0x9affe4, 0xff8fd6, 0xc0a8ff, 0xffffff]
    .map((hex, i) => {
      const tex = windowTexture(4000 + i);
      return new THREE.MeshStandardMaterial({
        map: tex, emissiveMap: tex, emissive: new THREE.Color(hex),
        emissiveIntensity: 0, roughness: 0.6, color: 0xffffff,
      });
    });
  registry.cityGlow = (registry.cityGlow || []).concat(cityMats);

  buildNewEnglandForest(scene);
  buildHouses(scene, 5000, 15000, 4401);       // Meriden / Wallingford
  buildHouses(scene, 24000, 50000, 4402);      // CT hills + MetroWest MA
  buildHouses(scene, 50000, 57500, 4404);      // Wellesley / Newton / Brookline edge
  buildNoiseWall(scene, 50000, 61500, { seed: 4450, height: 5.4, margin: 4.2, step: 13, gapChance: 0.12 });
  deepSprawl(scene, 4451, 49000, 61500, { density: 1.15, towers: false, litMat: lowLitMaterial(registry) });
  buildTrees(scene, 4452, 50000, 61500, 12, 42, 180, 0);
  buildTrees(scene, 4453, 50000, 61500, 14, 180, 420, 0, true);
  buildBillboards(scene, registry, 4403, 4000, 52000, 30);

  buildHartford(scene, registry, cityMats);
  buildBoston(scene, registry, cityMats);
  // sky-glow over the two downtowns at night
  addSkyGlow(scene, registry, 19200, -170, 560, 420);    // Hartford
  addSkyGlow(scene, registry, 58000, -220, 900, 620);    // Boston Back Bay / Financial
  buildLogan(scene, registry);
  buildHovSigns(scene, registry);

  // CT / MA state line on I-84 near Sturbridge, both directions
  welcomeSign(scene, registry, 33800, 1, ['WELCOME TO', 'MASSACHUSETTS', 'THE BAY STATE'], '#12264a');
  welcomeSign(scene, registry, 33200, -1, ['WELCOME TO', 'CONNECTICUT', 'CONSTITUTION STATE'], '#12356f');

  // Major interchanges (overhead guide boards, both directions)
  const junction = (s, lines) => {
    const nb = textBoard(lines, 6.8, 3.4, '#046a38', '#ffffff');
    const sb = textBoard(lines, 6.8, 3.4, '#046a38', '#ffffff'); sb.rotation.y = Math.PI;
    gantry(scene, registry, s, [{ lat: -6, mesh: nb }, { lat: 6, mesh: sb }], 6.8);
  };
  // I-91 begins here at the New Haven interchange off I-95 (the i95 map).
  junction(700, ['I-91 NORTH', 'HARTFORD', 'FROM I-95 · NEW HAVEN']);
  junction(16800, ['EXIT 32', 'I-84 EAST', 'HARTFORD · BOSTON']);
  junction(35800, ['I-90 EAST', 'MASS PIKE', 'BOSTON']);
  junction(51000, ['EXIT 15', 'I-95 · RTE 128', 'PROVIDENCE · PORTSMOUTH']);
  junction(53500, ['EXIT 17', 'I-95 / ROUTE 128', 'WALTHAM · PROVIDENCE']);
  junction(57000, ['EXIT 18', 'ALLSTON · CAMBRIDGE', 'DOWNTOWN BOSTON']);
  junction(60000, ['EXIT 24', 'I-93', 'S STATION · LOGAN ✈']);
  junction(61500, ['LOGAN AIRPORT', 'TERMINALS · MASS PIKE EAST']);
}
