import * as THREE from 'three';
import { posAt, headingAt } from './road.js';
import {
  groundY, roadClearAt, scatterInstanced, placementsAlong, clampOffRoad,
} from './environment.js';
import { textBoard } from './turnpike.js';

// The American roadside, the way Europe got its Osborne bulls and olive groves:
// the things that make a US interstate read as America and nowhere else — the
// municipal water tower with the town's name on it, the big-box retail strip
// with its 40-foot pole signs, the car lot drowning in flags, the green
// overpass, the Plains grain elevator, and the white-steepled New England
// common. buildAmericana() dresses whichever US map is loaded with the set of
// these that belongs to its region.

const TAU = Math.PI * 2;

function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================ shared props ============================ */

// The Stars and Stripes — the flag that flies over every dealership, rest area
// and Main Street in the country. Drawn once to a canvas, reused everywhere.
let flagTex = null;
function starsAndStripes() {
  if (flagTex) return flagTex;
  const c = document.createElement('canvas'); c.width = 76; c.height = 40;
  const g = c.getContext('2d');
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 ? '#f4f4f4' : '#b22234';
    g.fillRect(0, i * (40 / 13), 76, 40 / 13);
  }
  g.fillStyle = '#3c3b6e'; g.fillRect(0, 0, 30, 40 * 7 / 13);
  g.fillStyle = '#fff';
  for (let r = 0; r < 5; r++) for (let col = 0; col < 5; col++) {
    g.beginPath(); g.arc(4 + col * 6, 3 + r * 4.2, 1.1, 0, TAU); g.fill();
  }
  flagTex = new THREE.CanvasTexture(c);
  flagTex.colorSpace = THREE.SRGBColorSpace;
  return flagTex;
}

// A tall flagpole with the flag near the top — big pole (dealership / civic) or
// smaller. The flag has a gentle set-in-the-wind curve.
function americanFlag(scene, s, lat, h = 16) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: 0.4, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, h, 6), poleMat);
  pole.position.y = h / 2; g.add(pole);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xd4a017, roughness: 0.4, metalness: 0.6 }));
  ball.position.y = h + 0.2; g.add(ball);
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(h * 0.42, h * 0.24, 8, 1),
    new THREE.MeshStandardMaterial({ map: starsAndStripes(), side: THREE.DoubleSide, roughness: 0.8 })
  );
  // ripple the trailing edge
  const pos = flag.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x + h * 0.21) * 1.6) * 0.5 * ((x + h * 0.21) / (h * 0.42)));
  }
  pos.needsUpdate = true; flag.geometry.computeVertexNormals();
  flag.position.set(h * 0.21 + 0.1, h - h * 0.16, 0);
  g.add(flag);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  g.position.copy(p); g.rotation.y = headingAt(s);
  scene.add(g);
}

// Municipal water tower: spheroid tank on splayed legs, the town's name banded
// around it — the tallest thing over every small American town.
function waterTower(scene, s, lat, label, bowlColor = 0xe4e8ea) {
  const g = new THREE.Group();
  const tankMat = new THREE.MeshStandardMaterial({ color: bowlColor, roughness: 0.5, metalness: 0.3 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0xaeb4b8, roughness: 0.6, metalness: 0.5 });
  const H = 22 + (s % 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, H, 6), legMat);
    leg.position.set(Math.cos(a) * 4.4, H / 2, Math.sin(a) * 4.4);
    leg.rotation.z = Math.cos(a) * 0.11; leg.rotation.x = -Math.sin(a) * 0.11;
    g.add(leg);
  }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), tankMat);
  bowl.scale.y = 0.66; bowl.position.y = H + 3; g.add(bowl);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 10), tankMat);
  cap.position.y = H + 7.6; g.add(cap);
  if (label) {
    const css = '#' + (bowlColor >>> 0).toString(16).padStart(6, '0').slice(-6);
    for (const face of [1, -1]) {
      const band = textBoard([label], 11, 3.4, css, '#16407a');
      band.position.set(0, H + 2.8, face * 5.2);
      if (face < 0) band.rotation.y = Math.PI;
      g.add(band);
    }
  }
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  g.position.copy(p); g.rotation.y = headingAt(s);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
}

// The 40-foot roadside pole sign — the fast-food / gas / motel pylon that towers
// over the strip so you can read it from the highway. Lights at night (pushed to
// registry.signs so the day/night loop ramps its emissive).
function poleSign(scene, registry, s, lat, lines, bg, h = 13) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.6 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, h, 8), poleMat);
  pole.position.y = h / 2; g.add(pole);
  const w = 5.2, bh = 3.4;
  const board = textBoard(lines, w, bh, bg, '#ffffff');
  board.position.set(0, h + bh / 2, 0.05); g.add(board);
  const back = board.clone(); back.rotation.y = Math.PI; back.position.z = -0.05; g.add(back);
  registry.signs.push({ userData: { board } });
  registry.signs.push({ userData: { board: back } });
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  g.position.copy(p); g.rotation.y = headingAt(s);
  scene.add(g);
}

// A green road-over-highway overpass — the diamond-interchange bridge that
// crosses over the interstate every couple of miles. Deck across the lanes on
// two abutments, jersey-barrier parapets, and a green guide sign hung beneath.
function overpass(scene, registry, s, cross = null) {
  const conc = new THREE.MeshStandardMaterial({ color: 0x9a978e, roughness: 0.92 });
  const barrier = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.9 });
  const g = new THREE.Group();
  const span = (roadClearAt(s) + 14) * 2;
  const deckY = 7.2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 1.5, 9), conc);
  deck.position.y = deckY; g.add(deck);
  for (const dz of [-4.4, 4.4]) {
    const par = new THREE.Mesh(new THREE.BoxGeometry(span, 1.1, 0.5), barrier);
    par.position.set(0, deckY + 1.2, dz); g.add(par);
  }
  for (const dx of [-(span / 2 - 3), span / 2 - 3]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, deckY, 6), conc);
    pier.position.set(dx, deckY / 2 - 0.7, 0); g.add(pier);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, deckY + 1, 11), conc);
    wing.position.set(dx + Math.sign(dx) * 0.4, deckY / 2 - 1.2, 0); g.add(wing);
  }
  if (cross) {
    for (const face of [1, -1]) {
      const sign = textBoard(cross, 5.4, 2.0, '#0d6b3f', '#ffffff');
      sign.position.set(-6, deckY - 1.4, face * 4.7);
      if (face < 0) sign.rotation.y = Math.PI;
      g.add(sign);
      registry.signs.push({ userData: { board: sign } });
    }
  }
  g.position.copy(posAt(s, 0, new THREE.Vector3()));
  g.position.y = groundY(s, 0);
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// Plains grain elevator: a row of tall pale concrete silos under a boxy
// headhouse — the "prairie skyscraper" that marks every farm town on the rail
// line. Bigger and squarer than the round metal bins by the barns.
function grainElevator(scene, s, lat) {
  const g = new THREE.Group();
  const conc = new THREE.MeshStandardMaterial({ color: 0xcac6bb, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8f959a, roughness: 0.5, metalness: 0.5 });
  const n = 5, r = 3.4, H = 26;
  for (let i = 0; i < n; i++) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, H, 12), conc);
    cyl.position.set((i - (n - 1) / 2) * (r * 2 - 0.4), H / 2, 0); g.add(cyl);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(n * (r * 2 - 0.4), 12, r * 2.2), metal);
  head.position.y = H + 6; g.add(head);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 16, 2), metal);
  leg.position.set((n / 2) * (r * 2 - 0.4) + 1, H + 4, 0); g.add(leg);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  g.position.copy(p); g.rotation.y = headingAt(s) + 0.2;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
}

/* =========================== region packagers =========================== */

// The American commercial strip: wide flat big-box stores set back behind their
// parking lots in generic retail livery (red, blue, orange, warehouse-gray),
// pole signs towering over them, and a car dealership drowning in flags. The
// single most recognizable thing about a US suburban highway.
const BIGBOX_COLORS = [0xb5202a, 0x184a8f, 0xd9741a, 0x0d6b3f, 0x6b6f74, 0xd4b40a, 0x7a1f5a];
const STRIP_SIGNS = [
  [['GAS', '$3.19'], '#c8102e'], [['DINER', 'OPEN 24 HRS'], '#0d4a8f'],
  [['MOTEL', 'VACANCY'], '#7a1f8f'], [['⛽ TRUCK', 'DIESEL'], '#0d6b3f'],
  [['BURGERS', 'DRIVE-THRU'], '#d4102a'], [['OUTLETS', 'NEXT EXIT'], '#184a8f'],
  [['PHARMACY', 'OPEN'], '#c8102e'], [['SUPERMARKET', 'ⓅOPEN 6-11'], '#0d6b3f'],
];

function suburbanStrip(scene, registry, seed, s0, s1, opts = {}) {
  const { density = 1, palette = BIGBOX_COLORS } = opts;
  const rand = rng(seed);
  // the big-box boxes, set well back behind the lots
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const boxes = placementsAlong(seed + 1, s0, s1, 190 / density, 40, 150, (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (r() - 0.5) * 0.25,
    sx: 26 + r() * 44, sy: 6 + r() * 3.5, sz: 18 + r() * 30,
    color: new THREE.Color(palette[(r() * palette.length) | 0]),
  }), 8);
  scatterInstanced(scene, boxGeo, bodyMat, boxes);
  // parking-lot pads in front of the boxes (dark asphalt slabs)
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 1 }),
    boxes.map(b => ({ pos: b.pos.clone(), rot: b.rot, sx: b.sx * 1.3, sy: 0.06, sz: b.sz * 1.7 })),
    { shadow: false });
  // the pole signs out at the road edge
  let k = 0;
  for (let s = s0 + 300; s < s1; s += (520 + rand() * 520) / density) {
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (roadClearAt(s) + 7 + rand() * 6);
    const [lines, bg] = STRIP_SIGNS[(k++) % STRIP_SIGNS.length];
    poleSign(scene, registry, s, lat, lines, bg, 11 + rand() * 6);
  }
  // dealerships every so often: flags + a grid of parked cars + a glass showroom
  for (let s = s0 + 1400; s < s1; s += (5200 + rand() * 3600) / density) {
    carDealership(scene, registry, s, (rand() < 0.5 ? -1 : 1), seed + 700 + s);
  }
}

// A car dealership: low glass showroom, rows of small bright cars on the lot,
// the compulsory oversized flag, and a pole sign.
function carDealership(scene, registry, s, side, seed) {
  const rand = rng(seed | 0);
  const lat = side * (roadClearAt(s) + 34);
  const g = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fc0d4, roughness: 0.2, metalness: 0.55 });
  const show = new THREE.Mesh(new THREE.BoxGeometry(26, 6.5, 15), glass);
  show.position.set(0, 3.2, 0); g.add(show);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(27, 1, 16),
    new THREE.MeshStandardMaterial({ color: 0x184a8f, roughness: 0.7 }));
  trim.position.set(0, 6.8, 0); g.add(trim);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  g.position.copy(p); g.rotation.y = headingAt(s);
  scene.add(g);
  // rows of parked cars on the lot in front
  const carGeo = new THREE.BoxGeometry(1.9, 1.4, 4.4); carGeo.translate(0, 0.7, 0);
  const carColors = [0xd42a2a, 0x2255aa, 0xffffff, 0x1a1a1a, 0xb8bcc0, 0x0d6b3f, 0xd4b40a];
  const cars = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      const cs = s + (col - 3.5) * 5.2;
      const cl = side * (roadClearAt(s) + 10 + row * 6);
      const cp = posAt(cs, cl, new THREE.Vector3()); cp.y = groundY(cs, cl);
      cars.push({ pos: cp, rot: headingAt(cs) + Math.PI / 2,
        color: new THREE.Color(carColors[(rand() * carColors.length) | 0]) });
    }
  }
  scatterInstanced(scene, carGeo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 }), cars, { shadow: false });
  americanFlag(scene, s + 18, side * (roadClearAt(s) + 8), 18);
  poleSign(scene, registry, s - 16, side * (roadClearAt(s) + 7), ['AUTO', 'SALES'], '#b5202a', 12);
}

// Farm belt: grain elevators marking the towns, municipal water towers, and the
// odd flag over a homestead. Layered over whatever barns/silos the map already
// scatters — this adds the vertical landmarks that read from miles off.
const FARM_TOWNS = ['CLEARFIELD', 'BROOKVILLE', 'MERCER', 'BELLEVUE', 'FREMONT',
  'NAPOLEON', 'ELKHART', 'PLYMOUTH', 'RENSSELAER', 'REMINGTON', 'LEBANON'];
function farmBelt(scene, registry, seed, s0, s1, opts = {}) {
  const { townStep = 22000, elevators = true } = opts;
  const rand = rng(seed);
  let t = 0;
  for (let s = s0 + townStep * 0.5; s < s1; s += townStep * (0.7 + rand() * 0.6)) {
    const side = rand() < 0.5 ? -1 : 1;
    waterTower(scene, s, side * (roadClearAt(s) + 60 + rand() * 90),
      FARM_TOWNS[t % FARM_TOWNS.length]);
    if (elevators && rand() < 0.7) {
      grainElevator(scene, s + 400 + rand() * 800, -side * (roadClearAt(s) + 90 + rand() * 120));
    }
    americanFlag(scene, s - 300, side * (roadClearAt(s) + 40 + rand() * 40), 13);
    t++;
  }
}

// New England common: white clapboard houses and a white-steepled church around
// a green, with the low fieldstone walls that quilt the whole region.
function newEnglandCommon(scene, seed, s0, s1) {
  const rand = rng(seed);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const white = new THREE.MeshStandardMaterial({ color: 0xf1eee6, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.95 });
  const siding = [0xf1eee6, 0xe6e2d6, 0xd9c8a8, 0x8a5a44, 0xcdd6d2, 0xb9c4a8];
  const houses = placementsAlong(seed + 1, s0, s1, 40, 34, 260, (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.25,
    sx: 8 + r() * 5, sy: 4 + r() * 2.6, sz: 8 + r() * 5,
    color: new THREE.Color(siding[(r() * siding.length) | 0]),
  }), 6);
  scatterInstanced(scene, boxGeo, white, houses);
  scatterInstanced(scene, boxGeo, roofMat, houses.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
    sx: h.sx * 1.15, sy: h.sx * 0.34, sz: h.sz * 1.15,
  })), { shadow: false });
  // fieldstone walls: low gray rubble lines along the field edges
  const rockGeo = new THREE.BoxGeometry(1.4, 0.8, 1.2);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8880, roughness: 1 });
  const walls = placementsAlong(seed + 2, s0, s1, 5, 24, 60, (r, pos, s, lat) => ({
    pos, rot: headingAt(s), sx: 1 + r() * 0.6, sy: 0.7 + r() * 0.5, sz: 1,
  }), 1);
  scatterInstanced(scene, rockGeo, rockMat, walls, { shadow: false });
  // the churches on the green
  for (let s = s0 + 6000; s < s1; s += 12000 + rand() * 8000) {
    newEnglandChurch(scene, s, (rand() < 0.5 ? -1 : 1) * (roadClearAt(s) + 40 + rand() * 40));
  }
}

function newEnglandChurch(scene, s, lat) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f2ea, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3f3a34, roughness: 0.9 });
  const g = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 22), white); nave.position.y = 4; g.add(nave);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 8, 4, 4, 1), roofMat);
  roof.rotation.y = Math.PI / 4; roof.position.y = 10; roof.scale.z = 22 / 16; g.add(roof);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 12, 5), white); tower.position.set(0, 10, 11); g.add(tower);
  const belfry = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), white); tower.position.y = 10; g.add(belfry);
  belfry.position.set(0, 18, 11);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 11, 4), white);
  spire.rotation.y = Math.PI / 4; spire.position.set(0, 26, 11); g.add(spire);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  g.position.copy(p); g.rotation.y = headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
}

// California: rows of fan palms along the strip, the sign of the Golden State.
function palmRow(scene, seed, s0, s1) {
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 10, 6); trunkGeo.translate(0, 5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a6a4c, roughness: 1 });
  const frondGeo = new THREE.ConeGeometry(3.2, 1.6, 6); frondGeo.translate(0, 10.4, 0);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f6b2e, roughness: 1 });
  const rand = rng(seed);
  const places = [];
  for (let s = s0; s < s1; s += 24 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.4) continue;
      const lat = side * (roadClearAt(s) + 5 + rand() * 40);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      const sc = 0.9 + rand() * 0.8;
      places.push(clampOffRoad({ pos, rot: rand() * TAU, sx: sc, sy: sc, sz: sc }, s, lat, 1));
    }
  }
  scatterInstanced(scene, trunkGeo, trunkMat, places, { shadow: false });
  scatterInstanced(scene, frondGeo, frondMat, places, { shadow: false });
}

/* ============================= dispatcher ============================= */

// Which americana each US map gets, and where. Spans avoid the city cores and
// water crossings the individual builders already own.
export function buildAmericana(scene, registry, map) {
  switch (map) {
    case 'us1':
      // the definitive NJ retail corridor: strip almost the whole way
      suburbanStrip(scene, registry, 9310, 2600, 42000, { density: 1.25 });
      overpass(scene, registry, 8500, ['ROUTE 522', 'DEVILS BROOK RD']);
      overpass(scene, registry, 22000, ['MENLO PARK', 'PARSONAGE RD']);
      overpass(scene, registry, 35000, ['ST GEORGES AVE', 'ROUTE 35']);
      break;
    case 'i95':
      suburbanStrip(scene, registry, 9320, 14500, 31000, { density: 0.8, palette: [0x7f3028, 0x8b8f92, 0xb7b1a4, 0x31577a] });   // Norwalk–Stamford: brick/stone/wood
      // The NJ Turnpike is deliberately walled and set back. Do not add the
      // generic close roadside suburban strip here; i95.js supplies distant
      // plants, open land, and the Turnpike sound-wall treatment.
      overpass(scene, registry, 20000, ['EXIT 15', 'US-7 · NORWALK']);
      overpass(scene, registry, 128000, ['CT-9', 'MIDDLETOWN']);
      waterTower(scene, 121000, roadClearAt(121000) + 70, 'OLD SAYBROOK');
      waterTower(scene, 133000, -(roadClearAt(133000) + 80), 'GUILFORD');
      break;
    case 'i80':
      suburbanStrip(scene, registry, 9330, 4000, 22000, { density: 0.7 });    // NJ Paterson–Parsippany
      farmBelt(scene, registry, 9331, 100000, 222000, { townStep: 24000 });   // PA ridge & valley + Ohio plain
      overpass(scene, registry, 70000, ['PA-940', 'POCONOS']);
      overpass(scene, registry, 150000, ['OH-11', 'YOUNGSTOWN']);
      overpass(scene, registry, 200000, ['OH-2', 'TOLEDO']);
      break;
    case 'i287':
      suburbanStrip(scene, registry, 9340, 6000, 34000, { density: 0.7 });    // Edison–Morristown
      overpass(scene, registry, 4200, ['NEW BRUNSWICK AVE', 'PERTH AMBOY']);
      overpass(scene, registry, 7600, ['NJ-27', 'EDISON']);
      overpass(scene, registry, 11100, ['US-1', 'NEW BRUNSWICK']);
      overpass(scene, registry, 14600, ['RIVER RD', 'PISCATAWAY']);
      overpass(scene, registry, 18000, ['US-22', 'BRIDGEWATER']);
      overpass(scene, registry, 22300, ['EASTON AVE', 'NEW BRUNSWICK']);
      overpass(scene, registry, 26800, ['DAVIDSON AVE', 'SOMERSET']);
      overpass(scene, registry, 31500, ['I-78', 'CLINTON · NEWARK']);
      overpass(scene, registry, 36500, ['MT AIRY RD', 'BASKING RIDGE']);
      overpass(scene, registry, 44000, ['I-80', 'PARSIPPANY']);
      break;
    case 'midwest':
      // additive over the existing farm/town system: Plains elevators + towers
      farmBelt(scene, registry, 9350, 52000, 122000, { townStep: 20000 });
      break;
    case 'newengland':
      newEnglandCommon(scene, 9360, 4000, 34000);       // CT river valley towns
      newEnglandCommon(scene, 9361, 34000, 50000);      // MA: Sturbridge–Worcester
      waterTower(scene, 20000, roadClearAt(20000) + 70, 'HARTFORD');
      overpass(scene, registry, 27000, ['CT-30', 'VERNON']);
      overpass(scene, registry, 44000, ['MA-9', 'WORCESTER']);
      break;
    case 'gsp':
      // a tree-walled parkway: just the overpasses that break the green tunnel
      overpass(scene, registry, 36000, ['SHORE RD', 'OCEAN VIEW']);
      overpass(scene, registry, 97000, ['STAGE RD', 'PINELANDS']);
      overpass(scene, registry, 151000, ['HERBERTSVILLE RD', 'BRICK']);
      overpass(scene, registry, 186000, ['LAUREL AVE', 'HOLMDEL']);
      overpass(scene, registry, 219000, ['UNION AVE', 'RAHWAY']);
      overpass(scene, registry, 245000, ['NJ-3', 'CLIFTON']);
      overpass(scene, registry, 262000, ['NJ-4', 'PARAMUS']);
      break;
    case 'acx':
      overpass(scene, registry, 31000, ['BERLIN CROSS KEYS RD', 'SICKLERVILLE']);
      overpass(scene, registry, 58000, ['MOSS MILL RD', 'MULLICA TWP']);
      overpass(scene, registry, 79000, ['WRANGLEBORO RD', 'MAYS LANDING']);
      break;
    case 'bay':
      palmRow(scene, 9370, 27000, 55000);               // inland valley strip
      suburbanStrip(scene, registry, 9371, 33000, 55000, { density: 0.5 });
      break;
    default:
      break;   // nyc: pure city, handled by nyc.js
  }
}
