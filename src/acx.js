import * as THREE from 'three';
import {
  posAt, headingAt, elevAt, medianHalfAt, pavedHalfAt, buildRibbon,
} from './road.js';
import {
  groundY, buildTrees, buildSuburb, scatterInstanced, facadeTexture,
  deepSprawl, farRidge,
} from './environment.js';
import {
  welcomeSign, gantry, textBoard, buildTollPlaza, skyline, water,
  suspensionBridge, viaductPiers, port,
} from './turnpike.js';
import { makeParkedCar } from './vehicles.js';

// Philadelphia → Atlantic City, the real route at exact scale: I-76 east out
// of Center City past the sports complex, over the Walt Whitman Bridge,
// NJ-42 through the Camden County suburbs, then the Atlantic City Expressway
// — a dead-straight 44-mile shot through the Pine Barrens to the casinos.
// ACX milepost m sits at s = 24800 + (44 − m) · 1609.

const TAU = Math.PI * 2;

// solid tree wall (same treatment as the GSP): three tight rows; forestFill
// stacks the deep woods behind
function forestBand(scene, seed, s0, s1, tight = 6, pine = false) {
  buildTrees(scene, seed,     s0, s1, 6,  tight,      tight + 22, 0, pine);
  buildTrees(scene, seed + 1, s0, s1, 7,  tight + 2,  tight + 26, 0, !pine);
  buildTrees(scene, seed + 2, s0, s1, 8,  tight + 8,  80, 0, pine);
}

// pitch pines down the wide grass median of the western expressway
function medianPines(scene, s0, s1) {
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.5, 5); trunkGeo.translate(0, 1.25, 0);
  const crownGeo = new THREE.ConeGeometry(1.4, 4.2, 7); crownGeo.translate(0, 3.8, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2c4a2e, roughness: 1 });
  let a = 40440044 + (s0 | 0);
  const rand = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const places = [];
  for (let s = s0; s < s1; s += 6 + rand() * 5) {
    const half = medianHalfAt(s);
    if (half < 5.5) continue;
    const lat = (rand() - 0.5) * Math.max(0, half - 3) * 1.4;
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
    const sc = 1.0 + rand() * 1.6;
    places.push({ pos, rot: rand() * TAU, sx: sc, sy: sc * (1 + rand() * 0.5), sz: sc });
  }
  scatterInstanced(scene, trunkGeo, trunkMat, places, { shadow: false });
  scatterInstanced(scene, crownGeo, crownMat, places, { shadow: false });
}

// named service plaza off the shoulder
function servicePlaza(scene, registry, s, name, latOff) {
  const conc = new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.25, metalness: 0.5 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.9 });
  const g = new THREE.Group();
  const build = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 14), glass); build.position.y = 3; g.add(build);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 16), roofMat); roof.position.y = 6.3; g.add(roof);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 8), conc); canopy.position.set(0, 5, -14); g.add(canopy);
  for (const dx of [-6, 0, 6]) { const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), conc); col.position.set(dx, 2.5, -14); g.add(col); }
  const sign = textBoard([name, 'SERVICE PLAZA', '⛽ FOOD · FUEL'], 7, 3.4, '#046a38', '#fff');
  sign.position.set(0, 9, 8); g.add(sign);
  registry.signs.push({ userData: { board: sign } });
  g.position.copy(posAt(s, latOff, new THREE.Vector3()));
  g.position.y = groundY(s, latOff);
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// overhead guide gantry, boards both directions
function jn(scene, registry, s, lines) {
  const a = textBoard(lines, 7, 3.4, '#046a38', '#fff');
  const b = textBoard(lines, 7, 3.4, '#046a38', '#fff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 6.8);
}

// named barrier toll: purple E-ZPass advance boards each way + the plaza
function toll(scene, registry, s, name) {
  const mk = () => textBoard([name.toUpperCase() + ' TOLL', 'E-ZPass · EXPRESS KEEP LEFT'], 13, 3.2, '#3d1d63', '#ffffff');
  const a = mk(); a.rotation.y = Math.PI;
  gantry(scene, registry, s - 500, [{ lat: -6, mesh: a }], 6.9);
  gantry(scene, registry, s + 500, [{ lat: 6, mesh: mk() }], 6.9);
  buildTollPlaza(scene, registry, s);
}

// tidal salt marsh flats flanking the AC approach
function saltMarsh(scene, s, length, width) {
  const marsh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x5d7050, roughness: 0.95 })
  );
  marsh.rotation.x = -Math.PI / 2;
  marsh.position.copy(posAt(s, 0, new THREE.Vector3()));
  marsh.position.y = -0.6;
  marsh.rotation.z = -headingAt(s);
  scene.add(marsh);
}

// the South Philly sports complex: two stadium bowls + arena + parking seas
function sportsComplex(scene, s) {
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.7, metalness: 0.2 });
  const lotMat = new THREE.MeshStandardMaterial({ color: 0x3b3c3e, roughness: 1 });
  for (const [ds, lat, r, h] of [[0, -220, 90, 22], [420, -300, 80, 20], [220, -420, 55, 16]]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 24, 1, true), bowlMat);
    bowl.position.copy(posAt(s + ds, lat, new THREE.Vector3()));
    bowl.position.y = groundY(s + ds, lat) + h / 2;
    scene.add(bowl);
    const lot = new THREE.Mesh(new THREE.CircleGeometry(r * 2.1, 24), lotMat);
    lot.rotation.x = -Math.PI / 2;
    lot.position.copy(bowl.position); lot.position.y -= h / 2 - 0.05;
    scene.add(lot);
  }
}

// The Walt Whitman has seven lanes total: three fixed lanes each way plus a
// reversible centre lane separated by a visible zipper barrier. The traffic
// engine keeps its normal six-lane carriageways; these bridge-only cars make
// the centre lane read correctly without allowing NPCs to cross live traffic.
function waltWhitmanReversible(scene, s0, s1) {
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xb8b9b5, roughness: 0.8 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2a900, roughness: 0.7 });
  for (let s = s0 + 70; s < s1 - 40; s += 10) {
    const p = posAt(s, 0, new THREE.Vector3());
    p.y = elevAt(s) + 1.05;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.05, 2.5), barrierMat);
    b.position.copy(p); b.rotation.y = headingAt(s); scene.add(b);
    if ((s | 0) % 40 === 0) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.42), stripeMat);
      cap.position.set(p.x, p.y + 0.56, p.z); cap.rotation.y = headingAt(s); scene.add(cap);
    }
  }
  for (const [s, lat] of [[6900, 2.0], [7350, 2.0], [7820, 2.0], [8280, -2.0], [8640, -2.0]]) {
    const car = makeParkedCar(() => 0.35);
    const p = posAt(s, lat, new THREE.Vector3());
    p.y = elevAt(s) + 0.12;
    car.position.copy(p); car.rotation.y = headingAt(s) + (lat < 0 ? Math.PI : 0);
    car.scale.setScalar(0.9); scene.add(car);
  }
}

function phillyMetroSigns(scene, registry) {
  jn(scene, registry, 900, ['I-76 EAST', 'CENTER CITY · SPORTS COMPLEX', 'WALT WHITMAN BRIDGE']);
  jn(scene, registry, 1700, ['SPEED LIMIT 55', 'I-76 · URBAN FREEWAY', 'TRUCKS KEEP RIGHT']);
  jn(scene, registry, 2500, ['I-676 · CENTER CITY', 'I-95 · NEW YORK / BALTIMORE', 'SEPTA · PATCO']);
  jn(scene, registry, 4700, ['EXIT 349', 'BROAD ST · SPORTS COMPLEX', 'LINCOLN FINANCIAL · CITIZENS BANK']);
  jn(scene, registry, 5750, ['WALT WHITMAN BRIDGE', 'NEW JERSEY · ATLANTIC CITY', 'TOLL / E-ZPASS']);
  jn(scene, registry, 10100, ['I-295 · NJ TURNPIKE', 'CAMDEN · TRENTON', 'PATCO / LINDENWOLD LINE']);
  jn(scene, registry, 15800, ['NJ-41 · DEPTFORD', 'DEPTFORD MALL · BLACKWOOD', 'PHILADELPHIA']);
  jn(scene, registry, 23200, ['NJ-42 SOUTH', 'ATLANTIC CITY · HAMMONTON', 'PHILADELPHIA WEST']);
}

function gspCheckpoint(scene, registry) {
  jn(scene, registry, 83600, ['CHECKPOINT · ACE EXIT 7', 'GARDEN STATE PARKWAY 38', 'NORTH · NEW YORK / SOUTH · CAPE MAY']);
  jn(scene, registry, 84300, ['EXIT 7', 'GARDEN STATE PARKWAY', 'ATLANTIC CITY · CAPE MAY']);
  welcomeSign(scene, registry, 84800, 1, ['ACE EXIT 7 CHECKPOINT', 'GSP 38 · EGG HARBOR TWP', 'ATLANTIC CITY AHEAD'], '#046a38');
  jn(scene, registry, 85500, ['SPEED LIMIT 55', 'PLEASANTVILLE · ATLANTIC CITY', 'USE RIGHT LANES FOR EXITS']);
}

function atlanticTerminus(scene, registry) {
  jn(scene, registry, 94600, ['ATLANTIC CITY', 'MISSOURI AVE · TANGER OUTLETS', 'NEXT SIGNAL']);
  jn(scene, registry, 95250, ['EXPRESSWAY ENDS', 'BALTIC / FAIRMOUNT AVE', 'STOPLIGHT · BOARDWALK / CASINOS']);
  const mat = new THREE.MeshStandardMaterial({ color: 0x77746e, roughness: 0.9 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x292b2d, roughness: 1 });
  const cross = new THREE.Mesh(new THREE.BoxGeometry(90, 0.08, 14), asphalt);
  const cp = posAt(95300, 0, new THREE.Vector3()); cp.y = groundY(95300, 0) + 0.03;
  cross.position.copy(cp); cross.rotation.y = headingAt(95300) + Math.PI / 2; scene.add(cross);
  const stripe = new THREE.MeshStandardMaterial({ color: 0xf1eee4, roughness: 0.8 });
  for (let i = -4; i <= 4; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 12), stripe);
    const bp = posAt(95300 + i * 1.5, 0, new THREE.Vector3()); bp.y = groundY(95300, 0) + 0.1;
    bar.position.copy(bp); bar.rotation.y = headingAt(95300); scene.add(bar);
  }
  for (const [s, lat, w, h] of [[94900, -34, 42, 7], [95200, 34, 54, 8], [95500, -42, 34, 6]]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, 18), mat);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat) + h / 2;
    g.position.copy(p); g.rotation.y = headingAt(s); scene.add(g);
  }
  const shopping = textBoard(['TANGER OUTLETS', 'ATLANTIC CITY', 'SHOPPING · PARKING'], 10, 3.2, '#7a2637', '#fff');
  shopping.position.copy(posAt(95150, 38, new THREE.Vector3())); shopping.position.y = groundY(95150, 38) + 9; shopping.rotation.y = headingAt(95150); scene.add(shopping);
  registry.signs.push({ userData: { board: shopping } });
}

export function buildAcx(scene, registry) {
  const tex = facadeTexture(31);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // ---------------------------------------------------------- Philadelphia
  // Center City canyon both sides, receding rowhouse sprawl behind it
  skyline(scene, registry, 811, 300, 5800, 22, 90, 420, 40, 165, [-1, 1]);
  deepSprawl(scene, 8201, 0, 6500, { density: 1.2 });
  jn(scene, registry, 5600, ['I-76 EAST', 'WALT WHITMAN BR', 'ATLANTIC CITY']);
  sportsComplex(scene, 6300);
  phillyMetroSigns(scene, registry);

  // ------------------------------------------------- Walt Whitman Bridge
  suspensionBridge(scene, 7300, 8700, 7650, 8350, 55);
  waltWhitmanReversible(scene, 6500, 9200);
  water(scene, 8000, 1100, 2800);
  // Delaware waterfront industry on both banks
  port(scene, 407, 8900, 10800);
  jn(scene, registry, 9200, ['WELCOME TO', 'NEW JERSEY', 'NJ-42 · AC EXPWY']);

  // -------------------------------------------- Gloucester + NJ-42 suburbia
  deepSprawl(scene, 8202, 9200, 13500, { density: 0.9, towers: false });
  buildSuburb(scene, registry, 13500, 24800);          // Bellmawr → Turnersville retail
  deepSprawl(scene, 8203, 13500, 24800, { density: 1.0, towers: false });
  forestBand(scene, 8301, 20000, 24800, 9);

  // ------------------------------------------ Atlantic City Expressway
  gantry(scene, registry, 25100, [
    { lat: 0, mesh: textBoard(['ATLANTIC CITY EXPRESSWAY', 'EXPRESS ROUTE TO THE SHORE'], 17, 3.6, '#046a38', '#ffffff') },
  ], 7);
  jn(scene, registry, 25900, ['SPEED LIMIT 65', 'ATLANTIC CITY EXPRESSWAY', 'HAMMONTON · ATLANTIC CITY']);
  // the pine wall: mixed hardwood west, solid pitch pine through the Barrens
  forestBand(scene, 8305, 24800, 43000, 8);
  forestBand(scene, 8311, 43000, 86500, 6, true);
  forestBand(scene, 8317, 86500, 92000, 8);
  medianPines(scene, 27000, 62000);

  jn(scene, registry, 42500, ['EXIT 33', 'NJ-73', 'WINSLOW · BLUE ANCHOR']);
  welcomeSign(scene, registry, 49800, 1, ['HAMMONTON', 'BLUEBERRY CAPITAL', 'OF THE WORLD'], '#046a38');
  jn(scene, registry, 50550, ['EXIT 28', 'NJ-54', 'HAMMONTON']);
  // Hammonton town cluster north of the road, past the trees
  deepSprawl(scene, 8204, 48500, 52500, { density: 0.45, towers: false, side: 1, latStart: 60 });

  servicePlaza(scene, registry, 61300, 'FRANK S. FARLEY', -55);
  toll(scene, registry, 66600, 'Egg Harbor');
  jn(scene, registry, 68250, ['EXIT 17', 'NJ-50', 'EGG HARBOR CITY']);
  deepSprawl(scene, 8205, 74000, 86500, { density: 0.5, towers: false });

  // the GSP crossing — the biggest interchange on the expressway
  jn(scene, registry, 83600, ['EXIT 7 · 1 MILE', 'GARDEN STATE PARKWAY', 'NORTH · SOUTH']);
  jn(scene, registry, 84330, ['EXIT 7', 'GARDEN STATE PKWY', 'CAPE MAY · NEW YORK']);
  gspCheckpoint(scene, registry);
  toll(scene, registry, 86700, 'Pleasantville');
  jn(scene, registry, 87550, ['EXIT 5', 'US-9', 'PLEASANTVILLE']);

  // --------------------------------------------------- Atlantic City
  deepSprawl(scene, 8206, 86500, 93000, { density: 0.9, towers: false });
  saltMarsh(scene, 91500, 3200, 1800);
  saltMarsh(scene, 94200, 2400, 2200);
  viaductPiers(scene, 93500, 95000);
  // the casino skyline dead ahead: boardwalk towers on both flanks
  skyline(scene, registry, 812, 92800, 95800, 28, 140, 680, 50, 135, [-1, 1]);
  welcomeSign(scene, registry, 93200, 1, ['WELCOME TO', 'ATLANTIC CITY', 'ALWAYS TURNED ON'], '#12264a');
  welcomeSign(scene, registry, 94000, -1, ['ATLANTIC CITY', 'EXPRESSWAY WEST', 'PHILADELPHIA 60'], '#046a38');
  jn(scene, registry, 95300, ['EXPRESSWAY ENDS', 'MISSOURI AVE', 'CASINOS · BOARDWALK']);
  jn(scene, registry, 95600, ['SPEED LIMIT 25', 'MISSOURI AVE · ATLANTIC CITY', 'SIGNALIZED INTERSECTION']);
  atlanticTerminus(scene, registry);
  // the ocean past the end of the island
  water(scene, 95600, 700, 2400);

  // low pine ridgeline on the horizon south of the pines (visual depth)
  farRidge(scene, 4413, 30000, 80000, -1);
}
