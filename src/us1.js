import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, elevAt } from './road.js';
import {
  groundY, clampOffRoad, scatterInstanced, placementsAlong, buildTrees, buildBillboards,
  facadeTexture, deepSprawl,
} from './environment.js';
import { SIGNALS, signalState } from './mumbai.js';
import { textBoard, welcomeSign, addSkyGlow } from './turnpike.js';

const TAU = Math.PI * 2;
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.translate(0, 0.5, 0);

// NJ US-1 billboard/ad copy — the real roadside brand soup
const US1_ADS = [
  ['WAWA · NEXT RIGHT', '#c8102e', '#fff'], ['QUICKCHEK', '#0b6b3a', '#fff'],
  ['SHOPRITE', '#e2231a', '#fff'], ["JERSEY MIKE'S SUBS", '#00447c', '#fff'],
  ['MENLO PARK MALL', '#1b3a6b', '#e8c96a'], ['RUTGERS · SCARLET KNIGHTS', '#cc0033', '#fff'],
  ['PORK ROLL EGG & CHEESE', '#c8342a', '#ffd23d'], ['NJ TRANSIT · METROPARK', '#f57200', '#fff'],
  ['IKEA · ELIZABETH', '#0051ba', '#ffda1a'], ['HOLLAND TUNNEL ▶ NYC', '#15355e', '#fff'],
  ['NJ TURNPIKE · EXIT 12', '#0d6b3f', '#fff'], ['DINER · OPEN 24 HRS', '#c8102e', '#fff'],
];

// ---------------------------------------------------------------------------
// Roadside sprawl: strip malls with lit fascia signs + parking aprons + pylon
// signs, right up on the highway the whole arterial. Plus ranch-house carpet
// filling in behind.
// ---------------------------------------------------------------------------
const SPRAWL_STYLES = {
  oldTown:      { mallStep: 42, mallLat: [18, 68],  padStep: 70,  padLat: [10, 24], houseStep: 17, houseLat: [75, 300], apartmentStep: 105 },
  woodedOffice: { mallStep: 135, mallLat: [60, 150], padStep: 210, padLat: [28, 60], houseStep: 42, houseLat: [155, 420], apartmentStep: 165 },
  dealer:       { mallStep: 92, mallLat: [35, 105], padStep: 75,  padLat: [12, 28], houseStep: 28, houseLat: [120, 380], apartmentStep: 150 },
  campus:       { mallStep: 110, mallLat: [45, 125], padStep: 150, padLat: [18, 38], houseStep: 36, houseLat: [145, 400], apartmentStep: 70 },
  mall:         { mallStep: 76, mallLat: [32, 115], padStep: 82,  padLat: [12, 30], houseStep: 31, houseLat: [130, 390], apartmentStep: 105 },
  office:       { mallStep: 120, mallLat: [55, 145], padStep: 145, padLat: [20, 45], houseStep: 40, houseLat: [150, 430], apartmentStep: 85 },
  bigBox:       { mallStep: 86, mallLat: [42, 135], padStep: 92,  padLat: [16, 36], houseStep: 34, houseLat: [160, 430], apartmentStep: 125 },
  industrial:   { mallStep: 155, mallLat: [55, 180], padStep: 170, padLat: [22, 52], houseStep: 0,  houseLat: [0, 0], apartmentStep: 210 },
  airport:      { mallStep: 180, mallLat: [70, 210], padStep: 190, padLat: [28, 60], houseStep: 0,  houseLat: [0, 0], apartmentStep: 230 },
  urban:        { mallStep: 35, mallLat: [22, 80],  padStep: 78,  padLat: [10, 24], houseStep: 0,  houseLat: [0, 0], apartmentStep: 42 },
  returnCity:   { mallStep: 58, mallLat: [26, 105], padStep: 105, padLat: [14, 32], houseStep: 29, houseLat: [125, 330], apartmentStep: 65 },
};

function stripSprawl(scene, registry, s0, s1, seed, style = 'oldTown') {
  const cfg = SPRAWL_STYLES[style] || SPRAWL_STYLES.oldTown;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const fasciaColors = [0xc8102e, 0x15355e, 0xd97b1f, 0x0d6b3f, 0x6b1f8a, 0xe2231a, 0x00447c, 0xf57200];
  // strip stores hugging both sides, wall to wall — long axis facing the road
  const malls = placementsAlong(seed, s0, s1, cfg.mallStep, cfg.mallLat[0], cfg.mallLat[1], (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2),
    sx: 26 + r() * 44, sy: 5.5 + r() * 4, sz: 15 + r() * 10,
    color: new THREE.Color([0xd9d5cc, 0xc9c5bc, 0xb8b4ab, 0xd8cfc0, 0xcabfb0][(r() * 5) | 0]),
  }), 12);
  scatterInstanced(scene, BOX, bodyMat, malls);
  // lit fascia strip across each storefront (a different brand colour each)
  scatterInstanced(scene, BOX,
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.5 }),
    malls.map((m, i) => ({
      pos: m.pos.clone().setY(m.pos.y + m.sy * 0.72), rot: m.rot,
      sx: m.sx * 0.96, sy: 1.5, sz: m.sz + 0.5,
      color: new THREE.Color(fasciaColors[i % fasciaColors.length]),
    })));
  // black-top parking aprons between store and road
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0x37383a, roughness: 1 }),
    malls.map(m => ({ pos: m.pos.clone().setY(m.pos.y + 0.02), rot: m.rot, sx: m.sx * 1.1, sy: 0.05, sz: 24 })),
    { shadow: false });
  // fast-food / bank / pharmacy PAD SITES right at the road edge, each with a
  // bright lit box sign on a short post — the real Route 1 clutter
  const pads = placementsAlong(seed + 3, s0, s1, cfg.padStep, cfg.padLat[0], cfg.padLat[1], (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2),
    sx: 9 + r() * 6, sy: 4 + r() * 2, sz: 9 + r() * 5,
    color: new THREE.Color([0xd12b2b, 0xe8b100, 0xffffff, 0xc8102e, 0x0d6b3f][(r() * 5) | 0]),
  }), 6);
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), pads);
  // bright sign box on a post out front of each pad
  scatterInstanced(scene, BOX,
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.5 }),
    pads.map((p, i) => ({
      pos: p.pos.clone().setY(p.pos.y + 7), rot: p.rot, sx: 3.4, sy: 2.2, sz: 0.5,
      color: new THREE.Color(fasciaColors[(i * 3) % fasciaColors.length]),
    })));
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0x6a6f74, roughness: 0.6 }),
    pads.map(p => ({ pos: p.pos.clone().setY(p.pos.y), rot: p.rot, sx: 0.3, sy: 6, sz: 0.3 })), { shadow: false });
  // ranch/split-level house carpet packed in behind the retail, deep both sides
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xe0dcd2, 0xbfae9a];
  const houses = cfg.houseStep ? placementsAlong(seed + 1, s0, s1, cfg.houseStep,
    cfg.houseLat[0], cfg.houseLat[1], (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.3,
    sx: 9 + r() * 5, sy: 3.4 + r() * 2.2, sz: 8 + r() * 4,
    color: new THREE.Color(siding[(r() * siding.length) | 0]),
  })) : [];
  if (houses.length) {
    scatterInstanced(scene, BOX, bodyMat, houses);
    scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0x574a3e, roughness: 0.95 }),
      houses.map(h => ({ pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot, sx: h.sx * 1.12, sy: 0.5, sz: h.sz * 1.12 })));
  }
  // low-rise apartment / office mid-rises breaking up the horizon (not flat)
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0xb8b4ab, roughness: 0.85 }),
    placementsAlong(seed + 2, s0, s1, cfg.apartmentStep, 55, style === 'urban' ? 190 : 280, (r, pos, s) => ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.3,
      sx: 16 + r() * 18, sy: (style === 'urban' ? 24 : 14) + Math.pow(r(), 1.3) * (style === 'urban' ? 56 : 34), sz: 16 + r() * 16,
      color: new THREE.Color([0xb8b4ab, 0x9a5a44, 0xc4cdd4, 0xa5866a][(r() * 4) | 0]),
    }), 5));
  // and the megalopolis carrying on for miles behind it, to the horizon
  deepSprawl(scene, seed + 8, s0, s1, { glowMat: registry.towerMats?.[0] });
}

// pylon sign toward the road: pole + lit board
function pylon(scene, s, side, lines, bg, h = 12) {
  const p = posAt(s, side * (pavedHalfAt(s) + 8), new THREE.Vector3()); p.y = groundY(s, side * 40);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, h, 8),
    new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.6, metalness: 0.5 }));
  pole.position.copy(p).setY(p.y + h / 2); scene.add(pole);
  const sign = textBoard(lines, 7, 4.6, bg, '#ffffff');
  sign.material.emissiveIntensity = 0.9;
  sign.position.copy(p).setY(p.y + h + 1.5);
  sign.rotation.y = headingAt(s) + (side > 0 ? 0 : Math.PI);
  scene.add(sign);
}

// simple instanced parking-lot cars (cheap: colored boxes)
function parkedCars(scene, list) {
  const geo = new THREE.BoxGeometry(1.9, 1.4, 4.5); geo.translate(0, 0.7, 0);
  scatterInstanced(scene, geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 }), list);
}

// chrome NJ diner: low stainless box with a curved roof band + neon sign
function diner(scene, s, side) {
  const lat = side * (pavedHalfAt(s) + 16);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  const rot = headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.3, metalness: 0.75 }));
  body.position.y = 2.5;
  const band = new THREE.Mesh(new THREE.BoxGeometry(18.4, 1, 10.4),
    new THREE.MeshStandardMaterial({ color: 0xc8102e, emissive: 0xc8102e, emissiveIntensity: 0.4, roughness: 0.4 }));
  band.position.y = 4.2;
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 5),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff3b6a, emissiveIntensity: 0.7 }));
  sign.position.set(-9.4, 6.5, 0);
  g.add(body, band, sign);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.copy(p); g.rotation.y = rot; scene.add(g);
}

// gas station: bright canopy on posts + a pump island + a kiosk
function gasStation(scene, s, side, canopyColor) {
  const lat = side * (pavedHalfAt(s) + 14);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  const rot = headingAt(s);
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 10),
    new THREE.MeshStandardMaterial({ color: canopyColor, emissive: canopyColor, emissiveIntensity: 0.35, roughness: 0.5 }));
  canopy.position.y = 6;
  for (const [dx, dz] of [[-7, -4], [7, -4], [-7, 4], [7, 4]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.5, metalness: 0.4 }));
    post.position.set(dx, 3, dz); g.add(post);
  }
  const kiosk = new THREE.Mesh(new THREE.BoxGeometry(6, 3.4, 5),
    new THREE.MeshStandardMaterial({ color: 0xeae6dd, roughness: 0.8 }));
  kiosk.position.set(0, 1.7, 9);
  g.add(canopy, kiosk);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.copy(p); g.rotation.y = rot; scene.add(g);
}

// North Brunswick car-dealer row: glass showrooms + long rows of lot cars +
// pennant banners + big pylon
function dealership(scene, registry, s0, s1, seed) {
  const rand = rng(seed);
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fbfe0, roughness: 0.2, metalness: 0.55 });
  const cars = [];
  for (let s = s0; s < s1; s += 220 + rand() * 120) {
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (pavedHalfAt(s) + 12);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    const rot = headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    const show = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 14), glass);
    show.position.copy(p).setY(p.y + 3.5); show.rotation.y = rot; show.castShadow = true;
    scene.add(show);
    // rows of inventory out front
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      const cl = side * (pavedHalfAt(s) + 3 + c * 2.4);
      const cs = s + (r - 2) * 5;
      const cp = posAt(cs, cl, new THREE.Vector3()); cp.y = groundY(cs, cl);
      cars.push({ pos: cp, rot: headingAt(cs), sx: 1, sy: 1, sz: 1,
        color: new THREE.Color().setHSL(rand(), 0.5, 0.35 + rand() * 0.4) });
    }
    pylon(scene, s, side, ['AUTO MALL', 'SALES · SERVICE'], '#15355e', 11);
  }
  parkedCars(scene, cars);
}

// Menlo Park Mall + the Edison Memorial Tower (the concrete tower with the giant
// light bulb on top, marking Edison's Menlo Park lab site)
function edisonMenloPark(scene, registry) {
  // the mall: a big beige box ringed by a sea of parking
  const p = posAt(23000, 210, new THREE.Vector3()); p.y = groundY(23000, 210);
  const mall = new THREE.Mesh(new THREE.BoxGeometry(150, 12, 110),
    new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.9 }));
  mall.position.copy(p).setY(p.y + 6); mall.rotation.y = headingAt(23000); mall.castShadow = true;
  scene.add(mall);
  pylon(scene, 23400, 1, ['MENLO PARK', 'MALL'], '#1b3a6b', 15);
  // parking-lot cars
  const rand = rng(2300); const cars = [];
  for (let i = 0; i < 240; i++) {
    const lat = 120 + rand() * 150; const s = 22400 + rand() * 1400;
    const cp = posAt(s, lat, new THREE.Vector3()); cp.y = groundY(s, lat);
    cars.push({ pos: cp, rot: headingAt(s) + (rand() < 0.5 ? 0 : Math.PI), sx: 1, sy: 1, sz: 1,
      color: new THREE.Color().setHSL(rand(), 0.4, 0.4 + rand() * 0.35) });
  }
  parkedCars(scene, cars);

  // Edison Memorial Tower: a fluted concrete obelisk topped by a big glass bulb
  const t = posAt(21800, -150, new THREE.Vector3()); t.y = groundY(21800, -150);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 40, 12),
    new THREE.MeshStandardMaterial({ color: 0xd7d2c6, roughness: 0.85 }));
  shaft.position.copy(t).setY(t.y + 20); shaft.castShadow = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(4.5, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd766, emissiveIntensity: 0.9, roughness: 0.3 }));
  bulb.position.copy(t).setY(t.y + 44);
  scene.add(shaft, bulb);
  const glow = new THREE.PointLight(0xffd766, 0.8, 120); glow.position.copy(bulb.position); scene.add(glow);
}

// Linden / Bayway: an oil refinery — tank farms, distillation columns, pipe
// racks, and flare stacks burning around the clock.
function refinery(scene, s0, s1) {
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xc9cdd0, roughness: 0.5, metalness: 0.5 });
  const tankGeo = new THREE.CylinderGeometry(1, 1, 1, 16); tankGeo.translate(0, 0.5, 0);
  scatterInstanced(scene, tankGeo, tankMat,
    placementsAlong(3300, s0, s1, 70, 55, 300, (r, pos) => ({
      pos, rot: 0, sx: 10 + r() * 16, sy: 8 + r() * 10, sz: 10 + r() * 16,
    }), 20));
  // tall distillation columns
  scatterInstanced(scene, tankGeo, new THREE.MeshStandardMaterial({ color: 0xb7bcc0, roughness: 0.5, metalness: 0.5 }),
    placementsAlong(3301, s0, s1, 130, 60, 260, (r, pos) => ({
      pos, rot: 0, sx: 3 + r() * 3, sy: 30 + r() * 34, sz: 3 + r() * 3,
    }), 20));
  // pipe-rack low boxes
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.7 }),
    placementsAlong(3302, s0, s1, 90, 50, 200, (r, pos, s) => ({
      pos, rot: headingAt(s), sx: 40 + r() * 40, sy: 4, sz: 3,
    }), 20));
  // flare stacks with a live flame
  const rand = rng(3303);
  for (let i = 0; i < 4; i++) {
    const s = s0 + (i + 0.5) * (s1 - s0) / 4;
    const side = i % 2 ? 1 : -1; const lat = side * (90 + rand() * 120);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 52, 10),
      new THREE.MeshStandardMaterial({ color: 0x9a5a44, roughness: 0.8 }));
    stack.position.copy(p).setY(p.y + 26); stack.castShadow = true; scene.add(stack);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff7b1a, emissive: 0xff5a10, emissiveIntensity: 1.4, roughness: 0.4 }));
    flame.position.copy(p).setY(p.y + 56); scene.add(flame);
    const fl = new THREE.PointLight(0xff6a20, 1.0, 160); fl.position.copy(flame.position); scene.add(fl);
  }
}

// water plane offset to one side of the centerline (Raritan, Hackensack, Hudson)
function water(scene, s, latOffset, length, width, color = 0x2f5468) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(length, width, 1, 6),
    new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.45 }));
  m.rotation.x = -Math.PI / 2;
  const p = posAt(s, latOffset, new THREE.Vector3());
  m.position.set(p.x, groundY(s, latOffset) - 1.4, p.z);
  m.rotation.z = -headingAt(s);
  scene.add(m);
}

// Parallel access roads are a defining Route 1 detail around the shopping and
// industrial districts.  Use instanced asphalt slabs so they read continuously
// without adding hundreds of individual draw calls.
function serviceRoad(scene, s0, s1, side, seed) {
  const rand = rng(seed); const slabs = [];
  for (let s = s0 + 45; s < s1 - 35; s += 82 + rand() * 28) {
    const lat = side * (pavedHalfAt(s) + 15);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat) + 0.04;
    slabs.push({ pos: p, rot: headingAt(s), sx: 6.5, sy: 0.08, sz: 104 });
  }
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0x2e3033, roughness: 1 }), slabs, { shadow: false });
}

// Warehouses, distribution sheds and container yards replace suburban houses
// through Linden, Elizabeth and Newark.  This keeps the northern corridor's
// freight character visually separate from Princeton/Edison retail sprawl.
function industrialCorridor(scene, s0, s1, seed) {
  const warehouses = placementsAlong(seed, s0, s1, 105, 65, 260, (r, pos, s) => ({
    pos, rot: headingAt(s) + (r() - 0.5) * 0.08,
    sx: 38 + r() * 72, sy: 7 + r() * 9, sz: 28 + r() * 55,
    color: new THREE.Color([0x9da3a6, 0xb9b4aa, 0x7d858a, 0xa49178, 0x6f777c][(r() * 5) | 0]),
  }), 14);
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }), warehouses);

  const rand = rng(seed + 1), containers = [];
  const colors = [0xa43a31, 0x1f5f82, 0x3d7447, 0xc58b28, 0x756b5f];
  for (let s = s0 + 30; s < s1; s += 32 + rand() * 38) {
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (95 + rand() * 170);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    containers.push({ pos: p, rot: headingAt(s), sx: 2.6, sy: 2.8, sz: 12,
      color: new THREE.Color(colors[(rand() * colors.length) | 0]) });
  }
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.2 }), containers);
}

// Build the cross street and familiar right-side jughandle from the same
// curated SIGNALS table used by traffic.  These are visual/local-access roads;
// the player remains on the continuous mainline simulation ribbon.
function buildArterialIntersections(scene) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x292b2e, roughness: 1 });
  const markings = new THREE.MeshStandardMaterial({ color: 0xe6e1cb, roughness: 0.9 });
  const roads = [], stopBars = [];
  for (const sig of SIGNALS) {
    const p = posAt(sig.s, 0, new THREE.Vector3()); p.y = elevAt(sig.s) + 0.035;
    roads.push({ pos: p, rot: headingAt(sig.s), sx: 170, sy: 0.07, sz: 12 });
    for (const dir of [-1, 1]) {
      const barS = sig.s - dir * 15;
      const bp = posAt(barS, 0, new THREE.Vector3()); bp.y = elevAt(barS) + 0.085;
      stopBars.push({ pos: bp, rot: headingAt(barS), sx: pavedHalfAt(barS) * 2, sy: 0.025, sz: 0.65 });
    }
    if (!sig.jughandle) continue;
    for (const side of [-1, 1]) {
      const lat = side * (pavedHalfAt(sig.s) + 7);
      const ap = posAt(sig.s - 40, lat, new THREE.Vector3()); ap.y = groundY(sig.s - 40, lat) + 0.05;
      roads.push({ pos: ap, rot: headingAt(sig.s - 40), sx: 5.5, sy: 0.06, sz: 86 });
      const cp = posAt(sig.s + 3, side * (pavedHalfAt(sig.s) + 21), new THREE.Vector3());
      cp.y = groundY(sig.s + 3, side * (pavedHalfAt(sig.s) + 21)) + 0.05;
      roads.push({ pos: cp, rot: headingAt(sig.s), sx: 31, sy: 0.06, sz: 5.5 });
    }
    if (sig.major) roadSign(scene, sig.s - 85, 1, [sig.name.toUpperCase(), 'ALL TURNS · JUGHANDLE'], '#046a38');
  }
  scatterInstanced(scene, BOX, asphalt, roads, { shadow: false });
  scatterInstanced(scene, BOX, markings, stopBars, { shadow: false });
}

// The US-1/9/GSP knot at Woodbridge is the route's major change from suburban
// arterial to North Jersey highway. A cross-route deck and four ramp quadrants
// make that transition legible before the lane count widens.
function woodbridgeInterchange(scene) {
  const s = 30500, h = elevAt(s);
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x303236, roughness: 0.96 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.92 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(230, 1.1, 15), asphalt);
  const c = posAt(s, 0, new THREE.Vector3());
  deck.position.set(c.x, h + 7, c.z); deck.rotation.y = headingAt(s); deck.castShadow = true; scene.add(deck);
  for (const lat of [-52, 52]) {
    const p = posAt(s, lat, new THREE.Vector3());
    const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 6.5, 3.5), concrete);
    pier.position.set(p.x, h + 3.25, p.z); pier.rotation.y = headingAt(s); scene.add(pier);
  }
  const ramps = [];
  for (const dir of [-1, 1]) for (const side of [-1, 1]) {
    const rs = s + dir * 105;
    const lat = side * (pavedHalfAt(rs) + 18);
    const p = posAt(rs, lat, new THREE.Vector3()); p.y = groundY(rs, lat) + 0.04;
    ramps.push({ pos: p, rot: headingAt(rs) + side * dir * 0.22, sx: 6.2, sy: 0.08, sz: 150 });
    const qp = posAt(s + dir * 32, side * 60, new THREE.Vector3()); qp.y = h + 0.04;
    ramps.push({ pos: qp, rot: headingAt(s) + Math.PI / 2, sx: 84, sy: 0.08, sz: 6.2 });
  }
  scatterInstanced(scene, BOX, asphalt, ramps, { shadow: false });
}

// Metropark's Northeast Corridor tracks run beside Route 1/9. Platforms,
// rails and catenary poles provide a long moving reference through Iselin.
function metroparkRail(scene) {
  const railMat = new THREE.MeshStandardMaterial({ color: 0x4f5358, roughness: 0.55, metalness: 0.7 });
  const ballastMat = new THREE.MeshStandardMaterial({ color: 0x67645e, roughness: 1 });
  const ballast = [], rails = [], poles = [];
  for (let s = 25100; s < 28900; s += 72) {
    const baseLat = -88;
    const b = posAt(s, baseLat, new THREE.Vector3()); b.y = groundY(s, baseLat) + 0.03;
    ballast.push({ pos: b, rot: headingAt(s), sx: 13, sy: 0.08, sz: 80 });
    for (const d of [-4.2, -1.4, 1.4, 4.2]) {
      const p = posAt(s, baseLat + d, new THREE.Vector3()); p.y = groundY(s, baseLat + d) + 0.14;
      rails.push({ pos: p, rot: headingAt(s), sx: 0.14, sy: 0.12, sz: 80 });
    }
    if ((s - 25100) % 288 < 72) {
      const p = posAt(s, baseLat - 7, new THREE.Vector3()); p.y = groundY(s, baseLat - 7);
      poles.push({ pos: p, rot: 0, sx: 0.22, sy: 8, sz: 0.22 });
    }
  }
  scatterInstanced(scene, BOX, ballastMat, ballast, { shadow: false });
  scatterInstanced(scene, BOX, railMat, rails, { shadow: false });
  scatterInstanced(scene, BOX, railMat, poles, { shadow: false });
  const p = posAt(27000, -88, new THREE.Vector3()); p.y = groundY(27000, -88);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 260),
    new THREE.MeshStandardMaterial({ color: 0xb8b5ac, roughness: 0.9 }));
  platform.position.copy(p).setY(p.y + 0.6); platform.rotation.y = headingAt(27000); scene.add(platform);
  pylon(scene, 27000, -1, ['NJ TRANSIT', 'METROPARK'], '#f57200', 12);
}

// A low skyline cluster of lit-window towers to one side (Jersey City, NYC)
function skylineCluster(scene, towerMat, seed, s0, s1, side, latMin, latMax, hMin, hMax) {
  const rand = rng(seed);
  const buckets = [];
  for (let s = s0; s < s1; s += 24 * (0.6 + rand() * 0.8)) {
    if (rand() < 0.2) continue;
    const lat = side * (latMin + rand() * (latMax - latMin));
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
    buckets.push(clampOffRoad({
      pos, rot: rand() * TAU, sx: 16 + rand() * 26, sz: 16 + rand() * 26,
      sy: hMin + Math.pow(rand(), 1.35) * (hMax - hMin),
      color: new THREE.Color(0xffffff).multiplyScalar(0.66 + rand() * 0.4),
    }, s, lat, 3));
  }
  scatterInstanced(scene, BOX, towerMat, buckets);
}

// The Pulaski Skyway: the black cantilever steel-truss bridge over the
// Meadowlands. Elevated deck (from bridgeBumpAt) with truss side-frames and
// concrete piers marching below.
function pulaskiSkyway(scene, s0, s1) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.7, metalness: 0.5 });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 });
  // Meadowlands water + reed flats under the deck
  water(scene, (s0 + s1) / 2, 0, 4200, 900, 0x3a4a44);
  // truss side-frames along both edges of the deck
  for (let s = s0; s < s1; s += 14) {
    const half = pavedHalfAt(s) + 1;
    const deckY = elevAt(s);
    for (const side of [-1, 1]) {
      const lat = side * half;
      const p = posAt(s, lat, new THREE.Vector3());
      // vertical + diagonal truss posts riding above the deck
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), steel);
      post.position.set(p.x, deckY + 3.5, p.z); post.rotation.y = headingAt(s);
      scene.add(post);
    }
    // top chord cross-tie every so often (portal frames)
    if ((s - s0) % 56 < 14) {
      const c = posAt(s, 0, new THREE.Vector3());
      const tie = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.5, 0.5), steel);
      tie.position.set(c.x, deckY + 7, c.z); tie.rotation.y = headingAt(s); scene.add(tie);
    }
  }
  // piers dropping to the marsh between the water spans
  for (let s = s0 + 40; s < s1; s += 120) {
    const c = posAt(s, 0, new THREE.Vector3());
    const h = elevAt(s) - (groundY(s, 0) - 2);
    if (h < 4) continue;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(6, h, 3), pierMat);
    pier.position.set(c.x, groundY(s, 0) - 2 + h / 2, c.z); pier.rotation.y = headingAt(s);
    pier.castShadow = true; scene.add(pier);
  }
}

// jughandle / arterial destination signs on overhead-ish posts
function roadSign(scene, s, side, lines, bg) {
  const lat = side * (pavedHalfAt(s) + 2.5);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.5, metalness: 0.5 }));
  pole.position.copy(p).setY(p.y + 3); scene.add(pole);
  const board = textBoard(lines, 5.4, 2.4, bg, '#ffffff');
  board.position.copy(p).setY(p.y + 7);
  board.rotation.y = headingAt(s) + (side > 0 ? Math.PI : 0);
  scene.add(board);
}

// ---------------------------------------------------------------------------
// US-style overhead traffic signals: a pole on the right shoulder with a
// horizontal mast arm reaching over the lanes and heads hanging beneath it,
// facing oncoming traffic. Returns {sig, lamps} heads for updateSignals().
// ---------------------------------------------------------------------------
export function buildUS1Signals(scene) {
  const heads = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.6, metalness: 0.5 });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.7 });
  for (const sig of SIGNALS) {
    for (const dir of [1, -1]) {
      const g = new THREE.Group();
      const half = pavedHalfAt(sig.s);
      const side = dir > 0 ? 1 : -1;              // right shoulder for this direction
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 7, 8), poleMat);
      pole.position.set(side * (half + 1), 3.5, 0); g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(half + 1.5, 0.24, 0.24), poleMat);
      arm.position.set(side * (half + 1) / 2, 6.6, 0); g.add(arm);
      // a couple of heads hanging over the lanes
      const lamps = {};
      const headLats = [side * (half * 0.35), side * (half * 0.8)];
      headLats.forEach((hl, hi) => {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 0.4), boxMat);
        box.position.set(hl, 6.0, 0.05); g.add(box);
        ['red', 'yellow', 'green'].forEach((c, i) => {
          const mat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x1c1c1c, emissiveIntensity: 1 });
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat);
          lamp.position.set(hl, 6.36 - i * 0.36, 0.22); g.add(lamp);
          if (hi === 0) lamps[c] = mat; else lamps[c + '2'] = mat;
        });
      });
      const sPos = sig.s - dir * 5;
      g.position.copy(posAt(sPos, 0, new THREE.Vector3()));
      g.position.y = groundY(sPos, 0);
      g.rotation.y = headingAt(sPos) + (dir > 0 ? 0 : Math.PI);
      scene.add(g);
      // updateSignals only drives red/yellow/green; mirror to the 2nd head
      const proxy = {
        red: lamps.red, yellow: lamps.yellow, green: lamps.green,
      };
      heads.push({ sig, lamps: proxy });
      heads.push({ sig, lamps: { red: lamps.red2, yellow: lamps.yellow2, green: lamps.green2 } });
    }
  }
  return heads;
}

// soft radial sprite for rooftop beacons
function radialSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.85)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// The full Manhattan skyline seen east across the Hudson from the Pulaski
// Skyway: a dense, to-scale wall of towers — Lower Manhattan (One WTC) and
// Midtown (Empire State) supertalls over a packed ridge — with windows glowing
// in many colours at night and a field of coloured rooftop beacons.
function manhattanSkyline(scene, registry) {
  const winTex = facadeTexture(31); winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  const glow = hex => new THREE.MeshStandardMaterial({
    map: winTex, emissiveMap: winTex, emissive: new THREE.Color(hex), emissiveIntensity: 0,
    roughness: 0.6, color: 0xffffff,
  });
  const mats = [0xfff0cf, 0xe6efff, 0xbfe0ff, 0xffd27a, 0x9affe4, 0xff8fd6, 0xc0a8ff, 0xffffff, 0x8fffea, 0xffb0e0].map(glow);
  registry.cityGlow = (registry.cityGlow || []).concat(mats);

  const rand = rng(9100);
  const buckets = mats.map(() => []);
  // dense ridge across the river: a near wall + a taller back row for depth
  for (let s = 43500; s < 52500; s += 11 * (0.6 + rand() * 0.8)) {
    for (const [latMin, latMax, hMin, hMax] of [[500, 700, 90, 300], [700, 960, 130, 360]]) {
      if (rand() < 0.1) continue;
      const lat = latMin + rand() * (latMax - latMin);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      buckets[(rand() * mats.length) | 0].push({
        pos, rot: rand() * TAU, sx: 16 + rand() * 30, sz: 16 + rand() * 30,
        sy: hMin + Math.pow(rand(), 1.3) * (hMax - hMin),
      });
    }
  }
  buckets.forEach((list, mi) => scatterInstanced(scene, BOX, mats[mi], list));

  // signature supertalls (to scale: One WTC tallest, Empire State with antenna)
  const sig = (s, lat, w, h, mat, antH) => {
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
    scatterInstanced(scene, BOX, mat, [{ pos, rot: headingAt(s), sx: w, sy: h, sz: w * 0.85 }]);
    if (antH) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, antH, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.7 }));
      a.position.copy(pos).setY(pos.y + h + antH / 2); scene.add(a);
    }
  };
  sig(49800, 590, 36, 460, mats[7], 95);   // One World Trade Center (Lower Manhattan)
  sig(47000, 640, 30, 380, mats[0], 60);   // Empire State Building
  sig(47500, 700, 26, 360, mats[1]);       // One Vanderbilt
  sig(46600, 560, 22, 402, mats[7]);       // 432 Park (slim supertall)
  sig(46200, 770, 42, 300, mats[2]);       // Hudson Yards cluster
  sig(48200, 670, 24, 330, mats[3]);       // Midtown

  // many-coloured rooftop beacons that blaze after dark
  const tex = radialSprite();
  const beaconMats = [0xff3355, 0x33aaff, 0x55ffcc, 0xffcc33, 0xff66dd, 0x99ff66, 0xffffff, 0x8a5cff, 0x00e5ff, 0xff7a1a]
    .map(c => new THREE.SpriteMaterial({ map: tex, color: c, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  registry.cityBeacons = (registry.cityBeacons || []).concat(beaconMats);
  const brand = rng(9101);
  for (let i = 0; i < 110; i++) {
    const s = 43500 + brand() * 9000;
    const lat = 500 + brand() * 460;
    const p = posAt(s, lat, new THREE.Vector3());
    const spr = new THREE.Sprite(beaconMats[(brand() * beaconMats.length) | 0]);
    spr.position.set(p.x, groundY(s, lat) + 70 + brand() * 320, p.z);
    const sz = 8 + brand() * 13; spr.scale.set(sz, sz, 1);
    scene.add(spr);
  }

  // the enormous sky-glow of Manhattan across the Hudson — the brightest night
  // sky on any of the maps, a wall of orange light over the river
  addSkyGlow(scene, registry, 48000, 720, 2600, 1500);
  addSkyGlow(scene, registry, 45500, 660, 1400, 900);
}

export function buildUS1(scene, registry) {
  // shared lit-window tower material for the Jersey City / NYC skylines
  const tex = facadeTexture(31); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  });
  registry.towerMats = (registry.towerMats || []).concat(towerMat);

  // Trenton: denser urban brick + the gold-domed NJ State House hint
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    placementsAlong(3100, 0, 2500, 20, 26, 150, (r, pos, s) => ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.2, sx: 12 + r() * 14, sy: 10 + Math.pow(r(), 1.3) * 40, sz: 12 + r() * 14,
      color: new THREE.Color([0x8f4a38, 0x9a5a44, 0xa5866a, 0xb8b4ab, 0x77503f][(r() * 5) | 0]),
    }), 4));

  // Route 1 changes grain repeatedly.  Keep continuous development, but do not
  // let the same strip-mall generator make Princeton, Bayway and Jersey City
  // look interchangeable.
  stripSprawl(scene, registry, 500,   2500, 3110, 'oldTown');
  stripSprawl(scene, registry, 2500,  6000, 3111, 'oldTown');
  stripSprawl(scene, registry, 6000, 11000, 3112, 'woodedOffice');
  stripSprawl(scene, registry, 11000, 16000, 3113, 'dealer');
  stripSprawl(scene, registry, 16000, 20000, 3114, 'campus');
  stripSprawl(scene, registry, 20000, 25000, 3115, 'mall');
  stripSprawl(scene, registry, 25000, 29000, 3116, 'office');
  stripSprawl(scene, registry, 29000, 33000, 3117, 'bigBox');
  stripSprawl(scene, registry, 33000, 38000, 3118, 'industrial');
  stripSprawl(scene, registry, 38000, 42000, 3119, 'airport');
  stripSprawl(scene, registry, 42000, 45000, 3120, 'industrial');
  stripSprawl(scene, registry, 48000, 51000, 3122, 'urban');
  stripSprawl(scene, registry, 51000, 56000, 3123, 'returnCity');

  // Continuous local access in the commercial sections; freight frontage and
  // distribution yards take over north of Woodbridge.
  serviceRoad(scene, 10800, 15800, -1, 3210);
  serviceRoad(scene, 20200, 28900, 1, 3211);
  serviceRoad(scene, 29200, 32700, -1, 3212);
  serviceRoad(scene, 33300, 44900, 1, 3213);
  industrialCorridor(scene, 33000, 37800, 3220);
  industrialCorridor(scene, 38000, 45000, 3221);
  metroparkRail(scene);
  woodbridgeInterchange(scene);

  // Princeton corridor: office parks + wooded setbacks (Carnegie Center / MarketFair)
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0x8fa6b8, roughness: 0.25, metalness: 0.5 }),
    placementsAlong(3120, 6000, 11000, 150, 70, 220, (r, pos, s) => ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.4, sx: 26 + r() * 34, sy: 9 + r() * 16, sz: 20 + r() * 26,
      color: new THREE.Color(0xffffff).multiplyScalar(0.8 + r() * 0.3),
    }), 12));
  buildTrees(scene, 3121, 2500, 11000, 30, 60, 300, 80);         // Mercer County green
  pylon(scene, 9200, -1, ['MARKETFAIR', 'PRINCETON'], '#1b3a6b', 13);

  // Metropark / Iselin: a small office-tower node
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0x9fb6c8, roughness: 0.3, metalness: 0.5 }),
    placementsAlong(3130, 25500, 28500, 120, 60, 160, (r, pos, s) => ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.3, sx: 22 + r() * 20, sy: 30 + Math.pow(r(), 1.3) * 60, sz: 20 + r() * 18,
      color: new THREE.Color(0xffffff).multiplyScalar(0.75 + r() * 0.35),
    }), 6));

  dealership(scene, registry, 11500, 15800, 3140);     // North Brunswick dealer row
  edisonMenloPark(scene, registry);                    // Menlo Park Mall + Edison Tower

  // New Brunswick: Rutgers-ish brick campus + the Raritan River crossing
  scatterInstanced(scene, BOX, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    placementsAlong(3150, 16000, 20000, 22, 30, 160, (r, pos, s) => ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.2, sx: 14 + r() * 16, sy: 12 + Math.pow(r(), 1.3) * 42, sz: 14 + r() * 14,
      color: new THREE.Color([0x9a4a38, 0xb0553f, 0xc9beac, 0xb8ab95, 0x8f7a63][(r() * 5) | 0]),
    }), 4));
  water(scene, 19000, 120, 1400, 90);                  // Raritan River beside the bridge

  // The signal, cross street, stop bars and jughandle all come from the same
  // curated junction list, so visual intersections match traffic behavior.
  buildArterialIntersections(scene);

  // a few diners + gas stations peppered along the arterial
  for (const [s, sd] of [[3200, -1], [8400, 1], [14200, -1], [26200, 1], [34800, -1], [43000, 1]]) diner(scene, s, sd);
  for (const [s, sd, c] of [[2000, 1, 0xc8102e], [7000, -1, 0x0b6b3a], [12500, 1, 0xf57200],
    [22000, -1, 0xc8102e], [30000, 1, 0x0b6b3a], [41000, -1, 0xf57200]]) gasStation(scene, s, sd, c);

  refinery(scene, 33200, 37800);                       // Linden / Bayway refineries

  // Elizabeth: Newark Liberty adjacent — control tower, parked jets, IKEA box
  {
    const t = posAt(40000, -280, new THREE.Vector3()); t.y = groundY(40000, -280);
    const twr = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 44, 10),
      new THREE.MeshStandardMaterial({ color: 0xc7ccd2, roughness: 0.5 }));
    twr.position.copy(t).setY(t.y + 22); twr.castShadow = true;
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 8, 10),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.2, metalness: 0.6, emissive: 0x3a4a5a, emissiveIntensity: 0.4 }));
    cab.position.copy(t).setY(t.y + 46); scene.add(twr, cab);
    // parked jets
    for (let i = 0; i < 5; i++) {
      const s = 39000 + i * 380; const lat = -200 - (i % 2) * 20;
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      const fus = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 32, 10),
        new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.6 }));
      fus.rotation.z = Math.PI / 2; fus.position.copy(p).setY(p.y + 3);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 28), fus.material);
      wing.position.copy(p).setY(p.y + 2.6); scene.add(fus, wing);
    }
    // IKEA Elizabeth: the giant blue box with a yellow band
    const ik = posAt(41500, 200, new THREE.Vector3()); ik.y = groundY(41500, 200);
    const ikea = new THREE.Mesh(new THREE.BoxGeometry(90, 18, 70),
      new THREE.MeshStandardMaterial({ color: 0x0051ba, roughness: 0.8 }));
    ikea.position.copy(ik).setY(ik.y + 9); ikea.rotation.y = headingAt(41500); ikea.castShadow = true;
    const band = new THREE.Mesh(new THREE.BoxGeometry(90.4, 4, 70.4),
      new THREE.MeshStandardMaterial({ color: 0xffda1a, emissive: 0xffda1a, emissiveIntensity: 0.3, roughness: 0.6 }));
    band.position.copy(ik).setY(ik.y + 13); band.rotation.y = headingAt(41500);
    scene.add(ikea, band);
  }

  pulaskiSkyway(scene, 45000, 48000);                  // the black truss bridge

  // Jersey City: the NJ Gold Coast skyline (30 Hudson / Goldman tower tallest)
  // on the near bank, the Hudson, then the full Manhattan wall beyond it.
  skylineCluster(scene, towerMat, 3160, 47000, 52000, 1, 120, 360, 70, 240);
  water(scene, 47200, 440, 6400, 320, 0x233f56);        // Hudson River, the length of the JC/Skyway view
  manhattanSkyline(scene, registry);                    // the full Manhattan skyline across the river
  pylon(scene, 50000, -1, ['JOURNAL', 'SQUARE'], '#15355e', 13);
  pylon(scene, 52300, 1, ['US 1/9 SOUTH', 'TRENTON · WOODBRIDGE'], '#046a38', 14);
  roadSign(scene, 54800, -1, ['US-1 SOUTH', 'TRENTON · NEXT CORRIDOR'], '#046a38');

  // signage: route/destination boards + jughandle notices
  roadSign(scene, 1500, 1, ['◀ US-1 · TRENTON', 'STATE CAPITOL'], '#046a38');
  roadSign(scene, 4200, -1, ['RIGHT LANE', 'MUST TURN RIGHT'], '#046a38');
  roadSign(scene, 10200, 1, ['PRINCETON ▶', 'JUGHANDLE'], '#046a38');
  roadSign(scene, 17500, -1, ['NEW BRUNSWICK', 'RUTGERS · RT 18'], '#046a38');
  roadSign(scene, 30500, 1, ['US-1/9 NORTH', 'NEWARK · JERSEY CITY'], '#046a38');
  roadSign(scene, 40000, -1, ['NEWARK AIRPORT ✈', 'RT 1&9 · I-78'], '#046a38');
  roadSign(scene, 47000, 1, ['PULASKI SKYWAY', 'JERSEY CITY'], '#046a38');
  roadSign(scene, 49200, -1, ['HOLLAND TUNNEL ▶', 'NYC · RT 139'], '#046a38');
  welcomeSign(scene, registry, 300, 1, ['US ROUTE 1', 'NEW JERSEY', 'TRENTON MAKES · THE WORLD TAKES'], '#046a38');

  buildBillboards(scene, registry, 3170, 400, 44000, 40, US1_ADS);

  return buildUS1Signals(scene);
}
