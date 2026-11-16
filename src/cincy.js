import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, buildRibbon } from './road.js';
import { groundY, clampOffRoad, roadClearAt, buildBillboards } from './environment.js';
import { makeParkedCar } from './vehicles.js';

const TAU = Math.PI * 2;
const C_START = 34000, C_END = 38000;
// route beats along the drive: UC/Calhoun → CUF hillside → Vine St hill →
// OTR → Central Pkwy → downtown Vine → Main/5th at Government Square
const UC0 = 34050, UC1 = 34900;      // uptown campus plateau
const CUF0 = 34600, CUF1 = 35600;    // hillside houses
const OTR0 = 35800, OTR1 = 37000;    // Italianate rowhouse blocks
const DT0 = 37000, DT1 = 38000;      // downtown core

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const CINCY_ADS = [
  ['SKYLINE CHILI', '#1b4fa0', '#ffd23d'], ["GRAETER'S", '#0d6b3f', '#fff'],
  ['UDF · MALTS', '#c8342a', '#fff'], ['FINDLAY MARKET', '#d97b1f', '#fff'],
  ['CINCINNATI REDS', '#c8102e', '#fff'], ['BENGALS · WHO DEY', '#fb4f14', '#111'],
  ['FC CINCINNATI', '#f05323', '#fff'], ['TAFT THEATRE', '#15355e', '#ffd23d'],
  ['KROGER', '#0b3b8c', '#fff'], ['MADTREE BREWING', '#2e5339', '#fff'],
];

function streetSign(text) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#0d6b3f';
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = '#fff'; g.lineWidth = 4;
  g.strokeRect(4, 4, 248, 56);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = 'bold 30px "Helvetica Neue", Arial, sans-serif';
  g.fillText(text, 128, 43);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.08,
    roughness: 0.6, side: THREE.DoubleSide,
  });
}

// blade street-name signs on poles at the corners
const CINCY_STREETS = [
  [34250, 'CALHOUN ST'], [34600, 'W McMILLAN ST'], [34950, 'HOLLISTER ST'],
  [35300, 'RAVINE ST'], [35700, 'W CLIFTON AVE'], [36100, 'LIBERTY ST'],
  [36450, 'E 14th ST'], [36800, 'CENTRAL PKWY'], [37150, 'COURT ST'],
  [37500, 'E 5th ST'], [37850, 'MAIN ST'],
];

function buildStreetSigns(scene, registry) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.6 });
  const signGeo = new THREE.PlaneGeometry(2.6, 0.65);
  for (const [s, name] of CINCY_STREETS) {
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 6), poleMat);
      pole.position.y = 2.1;
      g.add(pole);
      const mat = streetSign(name);
      const sign = new THREE.Mesh(signGeo, mat);
      sign.position.y = 4.0;
      g.add(sign);
      const lat = side * (pavedHalfAt(s) + 1.0);
      g.position.copy(posAt(s + 10, lat, new THREE.Vector3()));
      g.rotation.y = headingAt(s) + Math.PI / 2;
      scene.add(g);
      registry.signs.push({ userData: { board: sign } });
    }
  }
}

// Vine St storefronts: brick shells with glowing local shop signs
function buildStorefronts(scene, registry, rand) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const signMats = CINCY_ADS.map(([text, bg, fg]) => {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
    g.fillStyle = fg; g.textAlign = 'center';
    g.font = 'bold 30px "Helvetica Neue", Arial, sans-serif';
    g.fillText(text, 128, 44);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1,
      roughness: 0.6, side: THREE.DoubleSide,
    });
  });
  const signGeo = new THREE.PlaneGeometry(4.2, 1.05);
  let k = 0;
  for (let s = OTR0; s < DT1 - 100; s += 55 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.45) continue;
      const lat = side * (roadClearAt(s) + 2.5);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const sign = new THREE.Mesh(signGeo, signMats[k++ % signMats.length]);
      sign.position.copy(pos);
      sign.position.y += 3.4;
      sign.rotation.y = headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      scene.add(sign);
    }
  }
  for (const mat of signMats) {
    registry.signs.push({ userData: { board: { material: mat } } });
  }
}

// Metro route 78 (Lincoln Hts – Downtown via Vine): curbside stops every few
// blocks, blue Metro flag signs, shelters at the major boardings.
const METRO_STOPS = [
  [34250, 'UC · CALHOUN', true],
  [34620, 'W McMILLAN', false],
  [35000, 'CLIFTON AVE', true],
  [35450, 'VINE & RAVINE', false],
  [36100, 'VINE & LIBERTY', true],
  [36650, 'FINDLAY MARKET', true],
  [37150, 'COURT ST', false],
  [37520, 'GOVERNMENT SQ', true],
];

function metroSign(text) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#0e4d8f';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#7ac143';
  g.fillRect(0, 96, 256, 32);
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = 'bold 44px "Helvetica Neue", Arial, sans-serif';
  g.fillText('METRO 78', 128, 52);
  g.font = 'bold 22px "Helvetica Neue", Arial, sans-serif';
  g.fillText(text, 128, 88);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1,
    roughness: 0.6, side: THREE.DoubleSide,
  });
}

function buildBusStops(scene, registry) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.6 });
  const shelterMat = new THREE.MeshStandardMaterial({ color: 0x5d6672, roughness: 0.5, metalness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbcd4de, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.55,
  });
  const signGeo = new THREE.PlaneGeometry(1.4, 0.7);
  for (const [s, name, shelter] of METRO_STOPS) {
    for (const side of [-1, 1]) {
      const lat = side * (pavedHalfAt(s) + 1.4);
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6), poleMat);
      pole.position.y = 1.7;
      g.add(pole);
      const mat = metroSign(name);
      const sign = new THREE.Mesh(signGeo, mat);
      sign.position.y = 3.1;
      g.add(sign);
      if (shelter) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 1.9), shelterMat);
        roof.position.set(side > 0 ? 2.6 : -2.6, 2.6, 0);
        g.add(roof);
        const back = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 0.08), glassMat);
        back.position.set(side > 0 ? 2.6 : -2.6, 1.35, side > 0 ? 0.85 : -0.85);
        g.add(back);
        for (const dx of [-2.0, 2.0]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), shelterMat);
          leg.position.set((side > 0 ? 2.6 : -2.6) + dx, 1.3, 0);
          g.add(leg);
        }
        const bench = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.5), shelterMat);
        bench.position.set(side > 0 ? 2.6 : -2.6, 0.55, side > 0 ? 0.5 : -0.5);
        g.add(bench);
      }
      g.position.copy(posAt(s + (side > 0 ? 16 : -16), lat, new THREE.Vector3()));
      g.rotation.y = headingAt(s);
      scene.add(g);
      registry.signs.push({ userData: { board: sign } });
    }
  }
}

// The things that make it read as a local street, not a highway: concrete
// sidewalks along both curbs, striped crosswalks at every corner, and a
// line of parallel-parked cars in the curb lane.
function buildStreetscape(scene, rand) {
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x8f8d86, roughness: 1 });
  for (const side of [-1, 1]) {
    scene.add(new THREE.Mesh(buildRibbon(
      s => side * (pavedHalfAt(s) + 0.15), s => side * (pavedHalfAt(s) + 3.4),
      0.13, 0.13, 10, C_START + 40, C_END - 40), walkMat));
  }
  // crosswalk bars at every signalized corner
  const barGeo = new THREE.PlaneGeometry(0.6, 2.6);
  barGeo.rotateX(-Math.PI / 2);
  const barMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  const bars = [];
  for (const [s] of CINCY_STREETS) {
    const half = pavedHalfAt(s) - 0.6;
    for (let lat = -half + 0.8; lat < half; lat += 1.5) bars.push([s + 6, lat]);
  }
  const inst = new THREE.InstancedMesh(barGeo, barMat, bars.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(1, 1, 1);
  const UP = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  bars.forEach(([s, lat], i) => {
    posAt(s, lat, p);
    p.y += 0.04;
    q.setFromAxisAngle(UP, headingAt(s));
    m.compose(p, q, v);
    inst.setMatrixAt(i, m);
  });
  scene.add(inst);
  // parallel-parked cars in the curb lane, gaps at corners and bus stops
  for (let s = C_START + 120; s < C_END - 120; s += 26 + rand() * 30) {
    if (METRO_STOPS.some(([ms]) => Math.abs(ms - s) < 30)) continue;
    if (CINCY_STREETS.some(([cs]) => Math.abs(cs - s) < 18)) continue;
    if (rand() < 0.35) continue;
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (pavedHalfAt(s) - 1.5);
    const car = makeParkedCar(rand);
    car.position.copy(posAt(s, lat, new THREE.Vector3()));
    car.rotation.y = headingAt(s) + (side > 0 ? Math.PI : 0);
    scene.add(car);
  }
}

export function buildCincy(scene, registry) {
  const rand = rng(513);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });

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
      if (b.color) mesh.setColorAt(i, b.color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  };

  // --- UC campus: chunky brick + limestone academic blocks around Calhoun
  const campus = [];
  const campusTints = [0x9a4a38, 0xb0553f, 0xc9beac, 0xb8ab95];
  for (let s = UC0; s < UC1; s += 40 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue;
      const lat = side * (24 + rand() * 110);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      campus.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
        sx: 18 + rand() * 22, sy: 10 + rand() * 14, sz: 14 + rand() * 16,
        color: new THREE.Color(campusTints[(rand() * campusTints.length) | 0]),
      }, s, lat, 1));
    }
  }
  place(campus, flat);

  // --- CUF: wood-frame houses stacked on the hillside
  const cuf = [];
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0x9aa3ad];
  for (let s = CUF0; s < CUF1; s += 16 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue;
      const lat = side * (24 + rand() * 150);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      cuf.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.3,
        sx: 8 + rand() * 4, sy: 5 + rand() * 4, sz: 8 + rand() * 4,
        color: new THREE.Color(siding[(rand() * siding.length) | 0]),
      }, s, lat, 0.5));
    }
  }
  place(cuf, flat);

  // --- OTR: tight, colorful 4–5 story Italianate rowhouses on both walls
  const otr = [];
  const italianate = [0xb5533c, 0xc98a4b, 0x8a9a6a, 0xc9beac, 0x7f6a55,
                      0xa84a4a, 0xd9c6a8, 0x6a7f8a, 0xb0836a];
  for (let s = OTR0; s < OTR1; s += 10 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.12) continue;
      const lat = side * (22 + Math.pow(rand(), 1.6) * 90);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      otr.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.15,
        sx: 8 + rand() * 6, sy: 12 + rand() * 8, sz: 10 + rand() * 6,
        color: new THREE.Color(italianate[(rand() * italianate.length) | 0]),
      }, s, lat, -0.5));
    }
  }
  place(otr, flat);
  // cornice caps — the OTR signature silhouette
  place(otr.map(b => ({
    pos: b.pos.clone().setY(b.pos.y + b.sy),
    rot: b.rot, sx: b.sx * 1.12, sy: 0.7, sz: b.sz * 1.12,
    color: new THREE.Color(0x554a3c),
  })), flat);

  // --- Downtown: the Cincinnati skyline, lit windows at night
  const dt = [];
  for (let s = DT0; s < DT1; s += 18 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.2) continue;
      const lat = side * (26 + rand() * 300);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      dt.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.3,
        sx: 16 + rand() * 24, sz: 16 + rand() * 24,
        sy: 30 + Math.pow(rand(), 1.4) * 130,
        color: new THREE.Color(0xffffff).multiplyScalar(0.7 + rand() * 0.4),
      }, s, lat, 2));
    }
  }
  // signature towers: Great American Tower (crown) + Carew Tower (art-deco brick)
  const gaPos = posAt(37650, 120, new THREE.Vector3());
  gaPos.y = groundY(37650, 120);
  dt.push({ pos: gaPos, rot: headingAt(37650), sx: 34, sy: 190, sz: 30,
    color: new THREE.Color(0xdfe6ee) });
  const carewPos = posAt(37450, -105, new THREE.Vector3());
  carewPos.y = groundY(37450, -105);
  dt.push({ pos: carewPos, rot: headingAt(37450), sx: 26, sy: 170, sz: 24,
    color: new THREE.Color(0xb5876a) });
  const towerMat = registry.towerMats?.[0] ?? flat;
  place(dt, towerMat);
  // GA Tower "tiara" crown
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0, 15, 20, 4, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
  crown.position.copy(gaPos).y += 198;
  scene.add(crown);

  // --- Fountain Square: plaza + Tyler Davidson fountain by 5th & Vine
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(26, 24),
    new THREE.MeshStandardMaterial({ color: 0x9b968c, roughness: 1 }));
  plaza.rotation.x = -Math.PI / 2;
  const plazaPos = posAt(37500, -46, new THREE.Vector3());
  plazaPos.y = groundY(37500, -46) + 0.12;
  plaza.position.copy(plazaPos);
  scene.add(plaza);
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x3f6b52, roughness: 0.5, metalness: 0.6 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 1, 16), bronzeMat);
  basin.position.copy(plazaPos).y += 0.6;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 9, 10), bronzeMat);
  column.position.copy(plazaPos).y += 5;
  const figure = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), bronzeMat);
  figure.position.copy(plazaPos).y += 10;
  scene.add(basin, column, figure);

  // hillside forest on the CUF/Clifton slopes
  buildCincyForest(scene, rand);
  buildStreetSigns(scene, registry);
  buildBusStops(scene, registry);
  buildStreetscape(scene, rand);
  buildStorefronts(scene, registry, rand);
  buildBillboards(scene, registry, 611, C_START + 200, C_END - 200, 10, CINCY_ADS);
}

function buildCincyForest(scene, rand) {
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.5, 5);
  trunkGeo.translate(0, 1.25, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.7, 0);
  crownGeo.translate(0, 4.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x3d6b33, roughness: 1 });
  const places = [];
  for (let s = C_START; s < 36900; s += 14 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.3) continue;
      const lat = side * (60 + rand() * 300);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const scl = 1 + rand() * 1.8;
      places.push({ pos, rot: rand() * TAU, sx: scl, sy: scl * (0.9 + rand() * 0.6), sz: scl });
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
