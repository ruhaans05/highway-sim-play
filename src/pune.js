import * as THREE from 'three';
import { MAP, wrapS } from './config.js';
import { posAt, headingAt, pavedHalfAt, buildRibbon } from './road.js';
import { groundY, clampOffRoad, roadClearAt, foliageMats } from './environment.js';
import { SIGNALS } from './mumbai.js';
import { makeRickshaw } from './vehicles.js';

const TAU = Math.PI * 2;
const AUNDH = MAP === 'aundh';

// ---------------------------------------------------------------------------
// Aundh–Baner Road (?map=aundh): a 28 km inner-Pune circuit. Old Aundh Gaon
// wadas and the Mandir, the Parihar/Bremen Chowk shopping stretch, the
// Aundh–Baner Link Road, westernized Baner Road cafés, Balewadi High Street,
// then the quieter Pashan–Sus Road under the tekdi and the packed Pashan
// Gaon / ITI Road bazaar back around. Narrow local roads: stop signs at the
// small junctions, low painted divider blocks instead of a median, no lane
// markings — everyone fits where they fit.
// ---------------------------------------------------------------------------

// Stop-signed minor junctions (the signalised chowks live in mumbai.js
// SIGNALS). Traffic treats these as stop-and-go; the boards are built below.
export const AUNDH_STOPS = AUNDH ? [
  1150, 2100, 3100, 4850, 5650, 6500, 7300, 8150,     // Aundh Gaon + DP Road
  9100, 10100, 11100, 14000,                            // Link Road + Shree Datta stop
  21200, 22300, 22800, 23700, 24300,                   // Pashan–Sus Road
  25250, 26150, 27050, 27800,                          // Pashan Gaon · ITI Road
] : [];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Shared tinted-merge helpers (same pattern as mumbai.js pedestrians)
// ---------------------------------------------------------------------------
function mergeTinted(parts) {
  let vCount = 0, iCount = 0;
  for (const g of parts) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const pos = new Float32Array(vCount * 3);
  const norm = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint32Array(iCount);
  let vo = 0, io = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, vo * 3);
    norm.set(g.attributes.normal.array, vo * 3);
    const t = g.userData.tint;
    for (let i = 0; i < g.attributes.position.count; i++) col.set(t, (vo + i) * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    io += gi.length; vo += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
function tBox(w, h, d, x, y, z, tint) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  g.userData.tint = tint;
  return g;
}

// Parked scooter/motorcycle, one merged geometry: body takes the instance
// color, seat/wheels/handlebar stay dark. z+ = nose.
const WHITE = [1, 1, 1];
const DARK = [0.13, 0.13, 0.14];
function scooterGeo() {
  return mergeTinted([
    tBox(0.38, 0.24, 0.85, 0, 0.38, 0.05, WHITE),          // floorboard + body
    tBox(0.34, 0.5, 0.16, 0, 0.6, 0.62, WHITE),            // front apron
    tBox(0.36, 0.13, 0.62, 0, 0.72, -0.28, DARK),          // seat
    tBox(0.52, 0.06, 0.08, 0, 0.98, 0.66, DARK),           // handlebar
    tBox(0.08, 0.42, 0.42, 0, 0.21, 0.72, DARK),           // front wheel
    tBox(0.08, 0.42, 0.42, 0, 0.21, -0.62, DARK),          // rear wheel
  ]);
}
function bikeGeo() {
  return mergeTinted([
    tBox(0.22, 0.22, 1.0, 0, 0.5, 0, WHITE),               // tank + frame
    tBox(0.26, 0.11, 0.55, 0, 0.68, -0.35, DARK),          // seat
    tBox(0.56, 0.06, 0.07, 0, 0.92, 0.6, DARK),            // handlebar
    tBox(0.07, 0.5, 0.5, 0, 0.25, 0.66, DARK),
    tBox(0.07, 0.5, 0.5, 0, 0.25, -0.62, DARK),
  ]);
}
const TW_COLORS = [0xdedede, 0xb8bcc0, 0x8a8f94, 0xc8342a, 0x1f4f8a, 0x1b1d1f,
  0x7a1f1f, 0xd97b1f, 0x3a3d45, 0xefe8dc, 0x2e7d5b];

// Place a batch of parked two-wheelers (mixed scooters/bikes) from a list of
// { s, lat, rot } slots. One InstancedMesh per silhouette.
function placeTwoWheelers(scene, slots, rand) {
  const geos = [scooterGeo(), bikeGeo()];
  const split = [[], []];
  for (const sl of slots) split[rand() < 0.62 ? 0 : 1].push(sl);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  split.forEach((list, gi) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geos[gi],
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 }), list.length);
    list.forEach((sl, i) => {
      const pos = posAt(sl.s, sl.lat, new THREE.Vector3());
      pos.y = groundY(sl.s, sl.lat);
      q.setFromAxisAngle(UP, sl.rot);
      const k = 0.92 + rand() * 0.14;
      sc.set(k, k, k);
      m.compose(pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHex(TW_COLORS[(rand() * TW_COLORS.length) | 0]));
    });
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  });
}

// ---------------------------------------------------------------------------
// Signboards: one shared lit material per ad text, planes over the shopfronts
// ---------------------------------------------------------------------------
// Pune bazaar boards — Marathi first, the classic shop mix
export const PUNE_ADS = [
  ['चितळे बंधू मिठाईवाले', '#7a1f1f', '#ffd23d'], ['काका हलवाई', '#6b1f8a', '#ffd23d'],
  ['जोशी वडेवाले', '#d97b1f', '#fff'], ['मिसळ हाऊस', '#c8342a', '#fff'],
  ['अमृततुल्य चहा', '#0d6b3f', '#ffd23d'], ['वैशाली', '#15355e', '#fff'],
  ['सकाळ', '#c8342a', '#fff'], ['देशपांडे ज्वेलर्स', '#8a6a10', '#fff'],
  ['पुणेरी पाटी', '#111111', '#ffd23d'], ['PMPML', '#1f7a4d', '#fff'],
  ['बजाज ऑटो', '#0d6b3f', '#fff'], ['टाटा मोटर्स', '#15355e', '#fff'],
  ['मेडिकल स्टोअर', '#0a8a3a', '#fff'], ['सायकल मार्ट', '#1f4f8a', '#ffd23d'],
  ['भाजपा 🪷', '#ff9933', '#0d3a12'], ['राष्ट्रवादी काँग्रेस', '#1a5fa8', '#fff'],
  ['शिवसेना', '#ff6f00', '#fff'], ['झेरॉक्स · STD', '#3a3d45', '#ffd23d'],
];
// Baner / Balewadi High Street — the westernized strip
const WEST_ADS = [
  ['THIRD WAVE COFFEE', '#1b1d1f', '#f2e8d8'], ['BARISTA', '#7a1f1f', '#fff'],
  ['CRAFT BREWERY', '#2a2a2a', '#ffd23d'], ['GYM 24×7', '#111111', '#39d07a'],
  ['SALON & SPA', '#3d1054', '#fff'], ['WOODFIRED PIZZA', '#c8342a', '#fff'],
  ['CO-WORKING', '#0a2885', '#fff'], ['SUSHI · PAN ASIAN', '#111111', '#fff'],
  ['D-MART', '#0a8a3a', '#ffd23d'], ['CROMA', '#111111', '#39d0c8'],
  ['DECATHLON', '#0a2885', '#ffd23d'], ['CAFE 1730', '#3e2c22', '#f2e8d8'],
  ['BREWERY & KITCHEN', '#14332a', '#ffd23d'], ['FARM TO TABLE', '#3e5c3a', '#fff'],
];

function adMaterials(ads, registry) {
  return ads.map(([text, bg, fg]) => {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
    g.fillStyle = fg; g.textAlign = 'center';
    g.font = 'bold 30px "Helvetica Neue", Arial, "Devanagari Sangam MN", sans-serif';
    g.fillText(text, 128, 42, 244);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1,
      roughness: 0.6, side: THREE.DoubleSide,
    });
    registry.signs.push({ userData: { board: { material: mat } } });
    return mat;
  });
}

// A run of shopfront stalls pressed to the road with boards on top and a
// cluster of parked two-wheelers angled outside — the Pune shopping strip.
// Returns the two-wheeler slots so callers can batch them in one draw.
function shopStrip(scene, registry, rand, s0, s1, step, ads, opts = {}) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const glass = opts.glass ?? 0;                 // share of glassy cafés
  const stallColors = [0x9a8a6a, 0x7a8a92, 0xa07060, 0x8a9a7a, 0x9a7a8a, 0xbfb49a];
  const stalls = [];
  const twSlots = [];
  for (let s = s0; s < s1; s += step * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < (opts.skip ?? 0.28)) continue;
      const clear = roadClearAt(s);
      const glassy = rand() < glass;
      const sx = glassy ? 6 + rand() * 4 : 3.5 + rand() * 2.5;
      const sz = glassy ? 5 + rand() * 3 : 3 + rand() * 2;
      // deep café boxes sit further back so no corner ever pokes the shoulder
      const lat = side * Math.max(clear + 2 + rand() * 3.5, clear + 0.62 * Math.max(sx, sz) - 0.6);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      stalls.push({
        s, lat, side, pos, glassy,
        rot: headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
        sx, sz,
        sy: glassy ? 3.6 + rand() * 1.2 : 2.8 + rand() * 1.2,
        color: new THREE.Color(glassy ? 0xcfd8dc : stallColors[(rand() * stallColors.length) | 0]),
      });
      // the two-wheeler park outside: a nose-in row on the shoulder strip
      const n = 2 + (rand() * (opts.bikes ?? 5)) | 0;
      for (let b = 0; b < n; b++) {
        twSlots.push({
          s: s + (b - n / 2) * 0.85 + (rand() - 0.5) * 0.3,
          lat: side * (clear + 0.9 + rand() * 0.5),
          rot: headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.5,
        });
      }
    }
  }
  if (!stalls.length) return twSlots;
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.22, metalness: 0.45 });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  for (const pick of [0, 1]) {
    const list = stalls.filter(st => (st.glassy ? 1 : 0) === pick);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(boxGeo, pick ? glassMat : flat, list.length);
    list.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.rot);
      sc.set(b.sx, b.sy, b.sz);
      m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, b.color);
    });
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  }
  const signMats = adMaterials(ads, registry);
  const signGeo = new THREE.PlaneGeometry(3.4, 0.9);
  stalls.forEach((b, i) => {
    const sign = new THREE.Mesh(signGeo, signMats[i % signMats.length]);
    sign.position.copy(b.pos);
    sign.position.y += b.sy + 0.5;
    sign.rotation.y = b.rot;
    scene.add(sign);
  });
  return twSlots;
}

// ---------------------------------------------------------------------------
// Stop signs: red octagon, STOP over थांबा, one per approach at each junction
// ---------------------------------------------------------------------------
let stopTexCache = null;
function stopTex() {
  if (stopTexCache) return stopTexCache;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.translate(128, 128);
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    const x = Math.cos(a) * 122, y = Math.sin(a) * 122;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = '#b81c22'; g.fill();
  g.lineWidth = 10; g.strokeStyle = '#f2f2f2'; g.stroke();
  g.fillStyle = '#ffffff'; g.textAlign = 'center';
  g.font = 'bold 74px "Helvetica Neue", Arial, sans-serif';
  g.fillText('STOP', 0, -6);
  g.font = 'bold 52px "Helvetica Neue", Arial, "Devanagari Sangam MN", sans-serif';
  g.fillText('थांबा', 0, 62);
  stopTexCache = new THREE.CanvasTexture(cv);
  stopTexCache.colorSpace = THREE.SRGBColorSpace;
  return stopTexCache;
}

function buildStopSigns(scene, registry) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.6 });
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 2.9, 6);
  poleGeo.translate(0, 1.45, 0);
  const boardGeo = new THREE.PlaneGeometry(0.95, 0.95);
  const mat = new THREE.MeshStandardMaterial({
    map: stopTex(), emissive: 0xffffff, emissiveMap: stopTex(), emissiveIntensity: 0.05,
    transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5,
  });
  registry.signs.push({ userData: { board: { material: mat } } });
  for (const s of AUNDH_STOPS) {
    for (const dir of [1, -1]) {
      // LHT: the travel side for dir +1 is lat > 0
      const side = dir > 0 ? 1 : -1;
      const sPos = s - dir * 5;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(poleGeo, poleMat));
      const board = new THREE.Mesh(boardGeo, mat);
      board.position.y = 2.55;
      g.add(board);
      g.position.copy(posAt(sPos, side * (pavedHalfAt(sPos) + 1.0), new THREE.Vector3()));
      g.position.y = groundY(sPos, side * (pavedHalfAt(sPos) + 1.0));
      g.rotation.y = headingAt(sPos) + (dir > 0 ? Math.PI : 0);
      scene.add(g);
    }
  }
}

// ---------------------------------------------------------------------------
// Low painted divider blocks down the centre of the narrow stretches — the
// knee-high yellow/black kerb segments every Pune local road gets instead of
// a real median. Gapped at every junction so cross traffic reads through.
// ---------------------------------------------------------------------------
function buildLocalDividers(scene, spans) {
  const junctions = [
    ...SIGNALS.map(sig => sig.s),
    ...AUNDH_STOPS,
  ].sort((a, b) => a - b);
  const blockGeo = new THREE.BoxGeometry(0.32, 0.38, 1.7);
  blockGeo.translate(0, 0.19, 0);
  const slots = [];
  for (const [d0, d1] of spans) {
    for (let s = d0; s < d1; s += 2.4) {
      let nearJ = false;
      for (const j of junctions) {
        if (Math.abs(s - j) < 13) { nearJ = true; break; }
      }
      if (!nearJ) slots.push(s);
    }
  }
  const mesh = new THREE.InstancedMesh(blockGeo,
    new THREE.MeshStandardMaterial({ vertexColors: false, color: 0xffffff, roughness: 0.9 }), slots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const UP = new THREE.Vector3(0, 1, 0);
  const cY = new THREE.Color(0xd7b13a), cK = new THREE.Color(0x2b2b2b);
  slots.forEach((s, i) => {
    const p = posAt(s, 0, new THREE.Vector3());
    q.setFromAxisAngle(UP, headingAt(s));
    m.compose(p, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, i % 2 ? cK : cY);   // alternating yellow/black paint
  });
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}

// Pune's inner roads should read as continuous built-up streets: asphalt,
// narrow concrete footpaths, open drains and kerbs, not grass touching the
// carriageway. The footpath is modest and broken up by access points rather
// than becoming a broad US-style sidewalk.
function buildPuneLocalEdges(scene) {
  const sidewalk = new THREE.MeshStandardMaterial({ color: 0x9b958a, roughness: 0.95 });
  const curb = new THREE.MeshStandardMaterial({ color: 0x6f716d, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const edge = side < 0 ? (s => -pavedHalfAt(s) - 1.62) : (s => pavedHalfAt(s) + 1.62);
    const inner = side < 0 ? (s => -pavedHalfAt(s) - 0.18) : (s => pavedHalfAt(s) + 0.18);
    const path = new THREE.Mesh(buildRibbon(edge, inner, 0.055, 0.055, 10, 0, 28000), sidewalk);
    path.receiveShadow = true;
    scene.add(path);
    const curbEdge = side < 0 ? (s => -pavedHalfAt(s) - 0.2) : (s => pavedHalfAt(s) + 0.2);
    const curbInner = side < 0 ? (s => -pavedHalfAt(s)) : (s => pavedHalfAt(s));
    const kerb = new THREE.Mesh(buildRibbon(curbEdge, curbInner, 0.2, 0.2, 10, 0, 28000), curb);
    kerb.receiveShadow = true;
    scene.add(kerb);
  }
}

// Replace the exposed terrain behind the narrow footpath with the patchwork
// actually seen along Pune arterials: dusty forecourts, apartment drives,
// parking pads and low compound walls.  Pashan-Sus stays visibly greener and
// receives only a shallow developed edge below the tekdi.
function buildPuneUrbanGround(scene) {
  const spans = [
    [0, 12000, 22, 0x766f61],       // Aundh: older, dusty mixed frontage
    [12000, 21000, 26, 0x77736b],   // Baner/Balewadi: newer paved compounds
    [21000, 24800, 14, 0x81755b],   // Pashan-Sus: intentional green hillside edge
    [24800, 28000, 21, 0x716a5d],   // Pashan Gaon / ITI bazaar
  ];
  for (const [s0, s1, depth, color] of spans) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    for (const side of [-1, 1]) {
      const inner = s => side * (roadClearAt(s) + 1.65);
      const outer = s => side * (roadClearAt(s) + depth);
      scene.add(new THREE.Mesh(buildRibbon(inner, outer, 0.025, 0.025, 14, s0, s1), mat));
    }
  }

  const rand = rng(7731);
  const padGeo = new THREE.BoxGeometry(1, 0.1, 1);
  const wallGeo = new THREE.BoxGeometry(1, 1, 0.22); wallGeo.translate(0, 0.5, 0);
  const pads = [], walls = [], frontage = [];
  for (let s = 40; s < 27960; s += 18 + rand() * 18) {
    const pashanEdge = s >= 21000 && s < 24800;
    for (const side of [-1, 1]) {
      if (pashanEdge && rand() < 0.55) continue;
      const clear = roadClearAt(s);
      const lat = side * (clear + 8 + rand() * (pashanEdge ? 7 : 22));
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat) + 0.05;
      pads.push({ pos, rot: headingAt(s), sx: 10 + rand() * 18, sy: 1, sz: 8 + rand() * 14,
        color: new THREE.Color(s >= 12000 && s < 21000 && rand() < 0.55 ? 0x626568 : 0x8a7d67) });
      if (!pashanEdge && rand() < 0.4) {
        const flat = side * (clear + 5 + rand() * 5);
        const fp = posAt(s + 5, flat, new THREE.Vector3()); fp.y = groundY(s + 5, flat);
        const modern = s >= 12000 && s < 21000;
        frontage.push({ pos: fp, rot: headingAt(s), sx: 6 + rand() * 7,
          sy: modern ? 7 + rand() * 12 : 5 + rand() * 8, sz: 11 + rand() * 17,
          color: new THREE.Color(modern ? 0xb5b3aa : rand() < 0.3 ? 0xc09968 : 0x9a917f) });
      }
      if (rand() < 0.7) {
        const wlat = side * (clear + 4.2 + rand() * 3.5);
        const wp = posAt(s, wlat, new THREE.Vector3()); wp.y = groundY(s, wlat);
        walls.push({ pos: wp, rot: headingAt(s), sx: 7 + rand() * 16, sy: 1 + rand() * 1.5, sz: 1,
          color: new THREE.Color(rand() < 0.25 ? 0x9f744d : 0xa19a89) });
      }
    }
  }
  const place = (list, geo, material) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    list.forEach((b, i) => {
      q.setFromAxisAngle(up, b.rot); sc.set(b.sx, b.sy, b.sz); m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m); mesh.setColorAt(i, b.color);
    });
    mesh.instanceColor.needsUpdate = true; scene.add(mesh);
  };
  place(pads, padGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
  place(walls, wallGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98 }));
  place(frontage, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
}

// Cross streets feeding the chowks: dark asphalt stubs both sides at every
// signal and stop sign.
function buildCrossStreets(scene) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 1 });
  const geo = new THREE.PlaneGeometry(7.5, 110);
  geo.rotateX(-Math.PI / 2);
  const all = [...SIGNALS.map(sig => sig.s), ...AUNDH_STOPS];
  for (const s of all) {
    for (const side of [-1, 1]) {
      const lat = side * 63;
      const road = new THREE.Mesh(geo, mat);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat) + 0.06;
      road.position.copy(pos);
      road.rotation.y = headingAt(s) + Math.PI / 2;
      scene.add(road);
    }
  }
}

// ---------------------------------------------------------------------------
// Marathi architecture: wada houses (thick ochre walls, hipped clay-tile
// roofs) and a Maruti Mandir with a stepped shikhara and a saffron flag.
// ---------------------------------------------------------------------------
function buildWadas(scene, rand, s0, s1, density = 1) {
  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  wallGeo.translate(0, 0.5, 0);
  const roofGeo = new THREE.ConeGeometry(0.82, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 0.5, 0);
  const wallTints = [0xd9c49a, 0xc9b384, 0xd4a89a, 0xcbb894, 0xbfae8a, 0xd8cbb0];
  const walls = [], roofs = [];
  for (let s = s0; s < s1; s += (10 / density) * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue;
      const lat = side * (roadClearAt(s) + 7 + Math.pow(rand(), 1.4) * 120);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const sx = 8 + rand() * 8, sz = 7 + rand() * 7, sy = 3.6 + rand() * 4.2;
      const rot = headingAt(s) + (rand() - 0.5) * 0.6;
      const color = new THREE.Color(wallTints[(rand() * wallTints.length) | 0])
        .multiplyScalar(0.8 + rand() * 0.3);
      const w = clampOffRoad({ pos, rot, sx, sy, sz, color }, s, lat, -0.5);
      walls.push(w);
      roofs.push({
        pos: w.pos.clone().setY(w.pos.y + w.sy - 0.05), rot: w.rot,
        sx: w.sx * 1.12, sy: 1.6 + rand() * 1.2, sz: w.sz * 1.12,
        color: new THREE.Color(0x9a4a32).multiplyScalar(0.8 + rand() * 0.35),
      });
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const place = (list, geo, rough) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough }), list.length);
    list.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.rot);
      sc.set(b.sx, b.sy, b.sz);
      m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, b.color);
    });
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  };
  place(walls, wallGeo, 0.95);
  place(roofs, roofGeo, 0.9);
}

function buildMandir(scene, s, side) {
  const g = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2ead2, roughness: 0.85 });
  const saffron = new THREE.MeshStandardMaterial({ color: 0xe8720c, roughness: 0.7 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 12), cream);
  plinth.position.y = 0.6;
  g.add(plinth);
  const hall = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 8), cream);
  hall.position.y = 3.7;
  g.add(hall);
  // stepped shikhara over the sanctum
  let y = 6.2;
  for (const [r, h] of [[3.4, 2.4], [2.5, 2.2], [1.6, 2.0], [0.8, 1.6]]) {
    const tier = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), cream);
    tier.rotation.y = Math.PI / 4;
    tier.position.y = y + h / 2;
    g.add(tier);
    y += h * 0.72;
  }
  const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), saffron);
  kalash.position.y = y + 0.7;
  g.add(kalash);
  // saffron flag on a cane
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x6b5330, roughness: 0.9 }));
  pole.position.set(1.6, y + 1.6, 0);
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), saffron.clone());
  flag.material.side = THREE.DoubleSide;
  flag.position.set(2.35, y + 2.9, 0);
  g.add(flag);
  // katta: the low sitting platform around the tree by the temple where
  // everyone actually hangs out
  const katta = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.7, 10), cream);
  katta.position.set(-8.5, 0.35, 3);
  g.add(katta);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 5, 7),
    new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 1 }));
  trunk.position.set(-8.5, 3, 3);
  g.add(trunk);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 1 });
  crownMat.userData.dry = new THREE.Color(0x74753f);
  crownMat.userData.monsoon = new THREE.Color(0x2f6b2a);
  foliageMats.push(crownMat);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(4.2, 0), crownMat);
  crown.position.set(-8.5, 7.6, 3);
  g.add(crown);

  const lat = side * (roadClearAt(s) + 16);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
  g.traverse(o => { o.castShadow = true; });
  scene.add(g);
}

// chai tapris + handcarts: the tarp-roofed tea stalls with the crowd knots
function buildTapris(scene, rand, spans) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const tarpGeo = new THREE.PlaneGeometry(1, 1);
  const tarpColors = [0x2a5f9e, 0xd97b1f, 0x3f7a3a, 0x9a4030];
  const stalls = [], tarps = [];
  for (const [t0, t1] of spans) {
    for (let s = t0; s < t1; s += 90 * (0.6 + rand() * 0.9)) {
      const side = rand() < 0.5 ? -1 : 1;
      const lat = side * (roadClearAt(s) + 1.4 + rand() * 2);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      stalls.push({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.5,
        sx: 1.6 + rand() * 0.8, sy: 1.5 + rand() * 0.5, sz: 1.2 + rand() * 0.6,
        color: new THREE.Color(0x8a7a5a).multiplyScalar(0.7 + rand() * 0.5),
      });
      tarps.push({
        pos: pos.clone().setY(pos.y + 2.3), rot: headingAt(s),
        sx: 2.8 + rand() * 1.2, sz: 2.4 + rand(),
        color: new THREE.Color(tarpColors[(rand() * tarpColors.length) | 0]),
      });
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const mesh = new THREE.InstancedMesh(boxGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), stalls.length);
  stalls.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx, b.sy, b.sz);
    m.compose(b.pos, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, b.color);
  });
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  const tmesh = new THREE.InstancedMesh(tarpGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), tarps.length);
  tarpGeo.rotateX(-Math.PI / 2);
  tarps.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx, 1, b.sz);
    m.compose(b.pos, q, sc);
    tmesh.setMatrixAt(i, m);
    tmesh.setColorAt(i, b.color);
  });
  tmesh.instanceColor.needsUpdate = true;
  scene.add(tmesh);
}

// mid-rise apartment fabric behind the shop line (Pune's 3-7 storey carpet
// plus the odd newer tower); glassier and taller through Baner/Balewadi
function puneFacadeMaterial(registry) {
  if (registry.puneFacadeMat) return registry.puneFacadeMat;
  const cv = document.createElement('canvas');
  const ev = document.createElement('canvas');
  cv.width = ev.width = 128; cv.height = ev.height = 256;
  const g = cv.getContext('2d');
  const eg = ev.getContext('2d');
  g.fillStyle = '#d8cdb7'; g.fillRect(0, 0, 128, 256);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 128, 256);
  // Pune apartment façade: painted plaster, recessed windows, balcony rails,
  // and the occasional bright awning rather than a blank gray slab.
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 7 + col * 31, y = 7 + row * 25;
      g.fillStyle = row % 3 === 0 ? '#6d6559' : '#817868';
      g.fillRect(x, y, 19, 13);
      g.strokeStyle = '#a99d89'; g.lineWidth = 2;
      g.strokeRect(x - 2, y + 14, 23, 4);
      if ((row + col) % 4 === 0) {
        g.fillStyle = '#c65c35'; g.fillRect(x - 2, y + 18, 23, 3);
      }
      if ((row * 3 + col) % 5 < 2) {
        eg.fillStyle = '#ffd27c'; eg.fillRect(x + 2, y + 2, 15, 9);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const etex = new THREE.CanvasTexture(ev); etex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: etex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.94,
  });
  registry.puneFacadeMat = mat;
  registry.towerMats = (registry.towerMats || []).concat(mat);
  return mat;
}

function buildBlocks(scene, registry, rand, s0, s1, opts = {}) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const tints = [0xe0dcd2, 0xd4d0c6, 0xc8c4ba, 0xd9c49a, 0xd4a89a, 0xb9c9b2, 0xcbb894];
  const low = [], towers = [], glass = [];
  for (let s = s0; s < s1; s += (opts.step ?? 8) * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.035) continue;
      const lat = side * (roadClearAt(s) + 8 + Math.pow(rand(), 1.65) * (opts.depth ?? 330));
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.75 + rand() * 0.3);
      const r = rand();
      const towerShare = opts.tower ?? 0.06;
      const glassShare = opts.glass ?? 0.02;
      if (r < 1 - towerShare - glassShare) {
        low.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.5,
          sx: 9 + rand() * 12, sz: 9 + rand() * 12,
          sy: 6 + Math.pow(rand(), 1.5) * 20, color,
        }, s, lat, -0.5));
      } else if (r < 1 - glassShare) {
        towers.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
          sx: 12 + rand() * 8, sz: 12 + rand() * 8,
          sy: 36 + rand() * 34, color,
        }, s, lat, 0));
      } else {
        glass.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
          sx: 22 + rand() * 18, sz: 15 + rand() * 10,
          sy: 18 + rand() * 24,
          color: new THREE.Color(0xffffff).multiplyScalar(0.85 + rand() * 0.25),
        }, s, lat, 2));
      }
    }
  }
  // Pune's apartment carpet continues behind the shopfronts. Two lighter,
  // lower-density background rows keep Baner/Aundh and the older peth edges
  // from dissolving into empty grass while preserving Pune's lower skyline.
  for (let s = s0; s < s1; s += 16 + rand() * 12) {
    for (const side of [-1, 1]) {
      for (let layer = 0; layer < 3; layer++) {
        const lat = side * (roadClearAt(s) + 72 + layer * 88 + rand() * 46);
        const pos = posAt(s, lat, new THREE.Vector3());
        pos.y = groundY(s, lat);
        const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.68 + rand() * 0.24);
        low.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.35,
          sx: 16 + rand() * 22, sz: 15 + rand() * 20,
          sy: 5 + Math.pow(rand(), 1.3) * 18, color,
        }, s, lat, -0.5));
      }
    }
  }
  // Pune still has a broad, continuous urban carpet behind the arterial:
  // mostly 4–10 storey housing with taller Baner/Aundh nodes, not a forest
  // horizon after the first building row.
  for (let s = s0; s < s1; s += 28 + rand() * 18) {
    for (const side of [-1, 1]) {
      const lat = side * (roadClearAt(s) + 330 + rand() * 430);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      low.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.28,
        sx: 24 + rand() * 32, sz: 22 + rand() * 30,
        sy: 8 + Math.pow(rand(), 1.25) * (opts.glass ? 42 : 28),
        color: new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.62 + rand() * 0.22),
      }, s, lat, -0.5));
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const place = (list, mat) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.rot);
      sc.set(b.sx, b.sy, b.sz);
      m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, b.color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  };
  place(low, puneFacadeMaterial(registry));
  place(towers, registry.towerMats?.[0]
    ?? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
  place(glass, new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.25, metalness: 0.5 }));

  // Pune apartment language: balcony bands, terrace tanks and parapets. These
  // details keep the dense background from reading as anonymous gray cubes.
  const detailGeo = new THREE.BoxGeometry(1, 1, 1); detailGeo.translate(0, 0.5, 0);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xb5aca0, roughness: 0.95 });
  const bands = [], tanks = [];
  for (const b of [...low, ...towers, ...glass]) {
    if (rand() < 0.3) continue;
    const rows = Math.max(1, Math.min(3, Math.floor(b.sy / 8)));
    for (let i = 0; i < rows; i++) bands.push({
      pos: b.pos.clone().setY(b.pos.y + 4 + i * Math.max(5, b.sy / (rows + 1))),
      rot: b.rot, sx: b.sx * 1.01, sy: 0.18, sz: b.sz * 1.02,
    });
    if (rand() < 0.38) tanks.push({
      pos: b.pos.clone().setY(b.pos.y + b.sy + 1), rot: rand() * Math.PI * 2,
      sx: 0.9 + rand() * 0.6, sy: 1.2 + rand() * 1.1, sz: 0.9 + rand() * 0.6,
    });
  }
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), ds = new THREE.Vector3();
  const detailPlace = (list, geo, mat) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((b, i) => {
      dq.setFromAxisAngle(UP, b.rot); ds.set(b.sx, b.sy, b.sz);
      dm.compose(b.pos, dq, ds); mesh.setMatrixAt(i, dm);
    });
    scene.add(mesh);
  };
  detailPlace(bands, detailGeo, bandMat);
  detailPlace(tanks, new THREE.CylinderGeometry(1, 1, 1, 10),
    new THREE.MeshStandardMaterial({ color: 0x34484d, roughness: 0.85 }));
}

// roadside avenue trees (the old banyans and rain trees Pune still has on
// its inner roads, densest along Pashan and the gaon stretches)
function buildAvenueTrees(scene, rand, spans, step = 42) {
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3.2, 6);
  trunkGeo.translate(0, 1.6, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.4, 0);
  crownGeo.translate(0, 5.4, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 1 });
  crownMat.userData.dry = new THREE.Color(0x74753f);
  crownMat.userData.monsoon = new THREE.Color(0x2f6b2a);
  foliageMats.push(crownMat);
  const places = [];
  for (const [t0, t1] of spans) {
    for (let s = t0; s < t1; s += step * (0.7 + rand() * 0.6)) {
      for (const side of [-1, 1]) {
        if (rand() < 0.3) continue;
        const lat = side * (roadClearAt(s) + 1.8 + rand() * 2.4);
        const pos = posAt(s, lat, new THREE.Vector3());
        pos.y = groundY(s, lat);
        const k = 0.9 + rand() * 1.3;
        places.push({ pos, rot: rand() * TAU, sx: k, sy: k * (0.9 + rand() * 0.5), sz: k });
      }
    }
  }
  for (const [geo, mat] of [[trunkGeo, trunkMat], [crownGeo, crownMat]]) {
    const mesh = new THREE.InstancedMesh(geo, mat, places.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    places.forEach((p, i) => {
      q.setFromAxisAngle(UP, p.rot);
      v.set(p.sx, p.sy, p.sz);
      m.compose(p.pos, q, v);
      mesh.setMatrixAt(i, m);
    });
    scene.add(mesh);
  }
}

// ---------------------------------------------------------------------------
// India street furniture shared by the india + aundh maps: bus shelters,
// highway dhabas, auto-rickshaw stands
// ---------------------------------------------------------------------------
// City bus shelter (BEST red / PMPML green): roof slab on posts over a bench,
// operator color on the roof + fascia board. One merged geometry, instanced.
function busStopGeo() {
  return mergeTinted([
    tBox(4.2, 0.16, 1.7, 0, 2.6, 0, WHITE),               // roof (operator color)
    tBox(4.2, 0.5, 0.1, 0, 2.25, 0.82, WHITE),            // fascia board
    tBox(0.12, 2.6, 0.12, -1.9, 1.3, -0.7, DARK),         // posts
    tBox(0.12, 2.6, 0.12, 1.9, 1.3, -0.7, DARK),
    tBox(0.12, 2.6, 0.12, -1.9, 1.3, 0.7, DARK),
    tBox(0.12, 2.6, 0.12, 1.9, 1.3, 0.7, DARK),
    tBox(3.6, 0.1, 0.5, 0, 0.55, -0.45, [0.72, 0.7, 0.66]), // bench
  ]);
}
// spans: [s0, s1, step, colorHex]
function buildBusStops(scene, rand, spans) {
  const slots = [];
  for (const [b0, b1, step, color] of spans) {
    for (let s = b0 + rand() * step; s < b1; s += step * (0.75 + rand() * 0.5)) {
      for (const side of [-1, 1]) {
        if (rand() < 0.35) continue;
        slots.push({ s: s + (side > 0 ? 0 : 26), side, color });
      }
    }
  }
  if (!slots.length) return;
  const mesh = new THREE.InstancedMesh(busStopGeo(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), slots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const UP = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  slots.forEach((sl, i) => {
    const lat = sl.side * (roadClearAt(sl.s) + 1.6);
    const pos = posAt(sl.s, lat, new THREE.Vector3());
    pos.y = groundY(sl.s, lat);
    // shelter opens toward the road
    q.setFromAxisAngle(UP, headingAt(sl.s) + (sl.side > 0 ? Math.PI : 0));
    m.compose(pos, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(sl.color));
  });
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}

const DHABA_ADS = [
  ['वैष्णो ढाबा', '#c8342a', '#ffd23d'], ['हॉटेल श्री दुर्गा', '#0d6b3f', '#fff'],
  ['पंजाबी ढाबा', '#d97b1f', '#111111'], ['चहा · नाश्ता', '#15355e', '#ffd23d'],
  ['शुद्ध शाकाहारी', '#0a8a3a', '#fff'], ['हॉटेल गुरुकृपा', '#6b1f8a', '#ffd23d'],
  ['मिसळ · वडापाव', '#c8342a', '#fff'], ['ट्रक पॉइंट 24 तास', '#3a3d45', '#ffd23d'],
];
// Highway dhabas: shack + bright tarp + glowing board + plastic chairs and a
// couple of parked two-wheelers out front — the NH-48 truck-stop strip.
function buildDhabas(scene, registry, rand, spans) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const shacks = [], chairs = [];
  const twSlots = [];
  const signMats = adMaterials(DHABA_ADS, registry);
  const signGeo = new THREE.PlaneGeometry(4.2, 1.1);
  let si = 0;
  for (const [d0, d1] of spans) {
    for (let s = d0; s < d1; s += 260 * (0.6 + rand() * 0.9)) {
      const side = rand() < 0.5 ? -1 : 1;
      const clear = roadClearAt(s);
      const lat = side * (clear + 6 + rand() * 8);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const rot = headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const sy = 3.2 + rand() * 0.8;
      shacks.push({
        pos, rot, sx: 7 + rand() * 4, sy, sz: 5 + rand() * 3,
        color: new THREE.Color(0x9a8a6a).multiplyScalar(0.7 + rand() * 0.5),
      });
      const sign = new THREE.Mesh(signGeo, signMats[si++ % signMats.length]);
      sign.position.copy(pos);
      sign.position.y += sy + 0.7;
      sign.rotation.y = rot;
      scene.add(sign);
      // plastic chairs + charpais scattered out front
      for (let k = 0; k < 4 + (rand() * 4 | 0); k++) {
        const cl = side * (clear + 2.2 + rand() * 3);
        const cp = posAt(s + (rand() - 0.5) * 10, cl, new THREE.Vector3());
        cp.y = groundY(s, cl);
        chairs.push({
          pos: cp, rot: rand() * TAU, sx: 0.55, sy: 0.8, sz: 0.55,
          color: new THREE.Color(rand() < 0.6 ? 0xd8d4c8 : 0xc8342a),
        });
      }
      for (let b = 0; b < 2 + (rand() * 3 | 0); b++) {
        twSlots.push({
          s: s + (rand() - 0.5) * 12,
          lat: side * (clear + 1.0 + rand() * 0.8),
          rot: headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.5,
        });
      }
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const place = list => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(boxGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), list.length);
    list.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.rot);
      sc.set(b.sx, b.sy, b.sz);
      m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, b.color);
    });
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  };
  place(shacks);
  place(chairs);
  placeTwoWheelers(scene, twSlots, rand);
}

// Auto stands: knots of parked rickshaws nose-to-tail on the shoulder, the
// drivers' adda. Full vehicle groups — kept to a few dozen per map.
function buildRickshawStands(scene, rand, spans, every = 2100) {
  for (const [r0, r1] of spans) {
    for (let s = r0 + rand() * every; s < r1; s += every * (0.7 + rand() * 0.6)) {
      const side = rand() < 0.5 ? -1 : 1;
      const n = 3 + (rand() * 4 | 0);
      for (let k = 0; k < n; k++) {
        const auto = makeRickshaw();
        const lat = side * (roadClearAt(s) + 1.3 + (k % 2) * 1.6);
        auto.position.copy(posAt(s + k * 3.2, lat, new THREE.Vector3()));
        auto.position.y = groundY(s + k * 3.2, lat);
        auto.rotation.y = headingAt(s) + (rand() - 0.5) * 0.4 + (rand() < 0.3 ? Math.PI : 0);
        scene.add(auto);
      }
    }
  }
}

// Maharashtra-style roadside speed-camera boxes: compact yellow warning
// boards, a gray pole, and a dark camera head. These are visual route
// furniture, placed at city approaches and ghat/toll transitions.
function buildSpeedCameras(scene, spans) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x777b7d, roughness: 0.72, metalness: 0.35 });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x28333a, roughness: 0.55, metalness: 0.25 });
  const signMat = new THREE.MeshStandardMaterial({ color: 0xf2c22e, roughness: 0.8 });
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 2.7, 6); poleGeo.translate(0, 1.35, 0);
  const cameraGeo = new THREE.BoxGeometry(0.42, 0.3, 0.28);
  const signGeo = new THREE.BoxGeometry(1.4, 0.72, 0.08);
  for (const s of spans) {
    const side = s % 2 ? 1 : -1;
    const lat = side * (roadClearAt(s) + 1.1);
    const p = posAt(s, lat, new THREE.Vector3());
    p.y = groundY(s, lat);
    const g = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat); g.add(pole);
    const cam = new THREE.Mesh(cameraGeo, boxMat); cam.position.set(0, 2.75, side * -0.15); g.add(cam);
    const sign = new THREE.Mesh(signGeo, signMat); sign.position.set(0, 2.05, side * -0.1); g.add(sign);
    g.position.copy(p); g.rotation.y = headingAt(s) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    scene.add(g);
  }
}

// india map: the full-route realism pass — shelters, dhabas, auto stands
export function buildIndiaExtras(scene, registry) {
  const rand = rng(4747);
  // BEST shelters down the New Link Road + Chembur; PMPML at the Pune end
  buildBusStops(scene, rand, [
    [600, 31500, 850, 0xa8342a],       // BEST red
    [87200, 96800, 750, 0x1f7a4d],     // PMPML green
  ]);
  // dhaba strips: the Panvel approach, the Food Mall bowl in the ghats, and
  // the Talegaon run-in — where the expressway actually eats
  buildDhabas(scene, registry, rand, [[38500, 45500], [58800, 61400], [82500, 86500]]);
  // auto stands at the city ends (rickshaws are banned on the expressway)
  buildRickshawStands(scene, rand, [[900, 31000], [87500, 96500]]);
  buildSpeedCameras(scene, [7200, 15400, 22600, 35200, 46800, 60400, 74200, 84600, 90100]);
}

// ---------------------------------------------------------------------------
// The aundh map world build
// ---------------------------------------------------------------------------
export function buildAundh(scene, registry) {
  const rand = rng(1212);
  buildPuneUrbanGround(scene);

  // old-village cores: wada fabric + mandirs with kattas
  buildWadas(scene, rand, 0, 3600, 1.4);          // Aundh Gaon
  buildWadas(scene, rand, 21600, 24800, 0.9);     // Sus / Pashan edges
  buildWadas(scene, rand, 24800, 28000, 1.4);     // Pashan Gaon
  buildMandir(scene, 850, 1);                     // Aundh Gaon Mandir
  buildMandir(scene, 14000, 1);                   // Shree Datta Mandir stop
  buildMandir(scene, 24950, -1);                  // Pashan Gaon Mandir

  // apartment/tower fabric the whole way round, glassier through Baner/Balewadi
  buildBlocks(scene, registry, rand, 0, 12000, { tower: 0.05, glass: 0.01 });
  buildBlocks(scene, registry, rand, 12000, 21000, { tower: 0.12, glass: 0.06, step: 8 });
  buildBlocks(scene, registry, rand, 21000, 24800, { tower: 0.04, glass: 0.0, step: 13, depth: 220 });
  buildBlocks(scene, registry, rand, 24800, 28000, { tower: 0.04, glass: 0.01 });

  // shopping strips + the two-wheeler parks outside every shop
  const tw = [];
  tw.push(...shopStrip(scene, registry, rand, 100, 3550, 34, PUNE_ADS, { bikes: 6, skip: 0.2 }));
  tw.push(...shopStrip(scene, registry, rand, 3650, 8150, 30, PUNE_ADS, { bikes: 7, skip: 0.18 }));
  tw.push(...shopStrip(scene, registry, rand, 8250, 11950, 44, PUNE_ADS, { bikes: 5 }));
  // Baner Road / Balewadi High Street: the westernized strip — glass cafés,
  // gyms, breweries — but still Marathi boards mixed in (it's Pune, not SoHo)
  tw.push(...shopStrip(scene, registry, rand, 12050, 17450, 36,
    [...WEST_ADS, ...PUNE_ADS.slice(0, 6)], { glass: 0.45, bikes: 8, skip: 0.22 }));
  tw.push(...shopStrip(scene, registry, rand, 17550, 20950, 30,
    [...WEST_ADS, ...WEST_ADS, ...PUNE_ADS.slice(0, 4)], { glass: 0.6, bikes: 9, skip: 0.18 }));
  tw.push(...shopStrip(scene, registry, rand, 21100, 24750, 60, PUNE_ADS, { bikes: 4, skip: 0.4 }));
  tw.push(...shopStrip(scene, registry, rand, 24850, 27950, 28, PUNE_ADS, { bikes: 7, skip: 0.16 }));
  // chowk clusters: the big bike-parking lots at the junctions
  for (const sig of SIGNALS) {
    const n = 8 + (rand() * 10) | 0;
    for (let b = 0; b < n; b++) {
      const side = rand() < 0.5 ? -1 : 1;
      tw.push({
        s: sig.s + 18 + rand() * 30,
        lat: side * (roadClearAt(sig.s) + 0.9 + (b % 2) * 1.1),
        rot: headingAt(sig.s) + side * -Math.PI / 2 + (rand() - 0.5) * 0.6,
      });
    }
  }
  placeTwoWheelers(scene, tw, rand);

  // chai tapris + carts along the local stretches
  buildTapris(scene, rand, [[200, 8200], [21200, 28000], [9000, 11800]]);

  // the local-road divider blocks (narrow stretches only — Baner Road and the
  // High Street run a real kerbed median instead, via medianHalfAt)
  buildLocalDividers(scene, [[150, 11850], [21150, 27900]]);
  buildPuneLocalEdges(scene);
  buildCrossStreets(scene);
  buildStopSigns(scene, registry);
  buildSpeedCameras(scene, [5200, 10400, 14000, 18800, 23200, 26700]);

  // avenue trees: dense under the Pashan tekdi and through the gaons
  buildAvenueTrees(scene, rand, [[0, 3600], [21000, 28000]], 30);
  buildAvenueTrees(scene, rand, [[3600, 21000]], 70);

  // PMPML shelters the whole circuit + auto stands at the chowks
  buildBusStops(scene, rand, [[300, 27800, 800, 0x1f7a4d]]);
  buildRickshawStands(scene, rand, [[400, 27600]], 1700);
}

// ---------------------------------------------------------------------------
// india map: Pune-city roadside life for the last stretch of the Mum–Pune run
// (shops, boards, parked two-wheelers, tapris, cross streets at the new
// city signals) — called from main.js for MAP === 'india'.
// ---------------------------------------------------------------------------
export function buildPuneRoadside(scene, registry) {
  const rand = rng(2323);
  const tw = [];
  // Pimpri fringe + the Pune city core past the NH-48 drop
  tw.push(...shopStrip(scene, registry, rand, 91000, 92450, 60, PUNE_ADS, { bikes: 4, skip: 0.4 }));
  tw.push(...shopStrip(scene, registry, rand, 92550, 96900, 30, PUNE_ADS, { bikes: 7, skip: 0.18 }));
  for (const sig of SIGNALS) {
    if (sig.s < 92000) continue;
    const n = 7 + (rand() * 9) | 0;
    for (let b = 0; b < n; b++) {
      const side = rand() < 0.5 ? -1 : 1;
      tw.push({
        s: sig.s + 16 + rand() * 28,
        lat: side * (roadClearAt(sig.s) + 0.9 + (b % 2) * 1.1),
        rot: headingAt(sig.s) + side * -Math.PI / 2 + (rand() - 0.5) * 0.6,
      });
    }
  }
  placeTwoWheelers(scene, tw, rand);
  buildTapris(scene, rand, [[92600, 96900]]);
  buildWadas(scene, rand, 93400, 96600, 0.7);     // old Pune peth fabric
  buildMandir(scene, 95300, 1);
  // cross streets at the Pune city signals
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 1 });
  const geo = new THREE.PlaneGeometry(8, 110);
  geo.rotateX(-Math.PI / 2);
  for (const sig of SIGNALS) {
    if (sig.s < 92000) continue;
    for (const side of [-1, 1]) {
      const lat = side * 66;
      const road = new THREE.Mesh(geo, mat);
      const pos = posAt(sig.s, lat, new THREE.Vector3());
      pos.y = groundY(sig.s, lat) + 0.06;
      road.position.copy(pos);
      road.rotation.y = headingAt(sig.s) + Math.PI / 2;
      scene.add(road);
    }
  }
}
