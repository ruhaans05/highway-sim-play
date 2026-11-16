import * as THREE from 'three';
import {
  posAt, headingAt, elevAt, pavedHalfAt, bridgeBumpAt, buildRibbon,
} from './road.js';
import { groundY } from './environment.js';
import { textBoard, gantry } from './turnpike.js';

// Chhatrapati Shivaji Maharaj International Airport (CSMIA / BOM), Terminal 2.
// The Andheri local roads climb the Sahar elevated access flyover, pass a
// security checkpoint, run alongside the T2 terminal, then drop back down and
// loop into the city. Occupies the airport zone at the top of the loop.
const S0 = 20800, S1 = 24000;

export function buildAirport(scene, registry) {
  buildFlyover(scene);
  buildSecurity(scene, registry, 21500);
  buildTerminal(scene, registry);
  buildSignage(scene, registry);
}

// Elevated deck: parapets, underside slab, concrete bents where it's aloft.
function buildFlyover(scene) {
  const conc = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.9, side: THREE.DoubleSide });
  const concDark = new THREE.MeshStandardMaterial({ color: 0x7e7a72, roughness: 0.95, side: THREE.DoubleSide });
  const edge = s => pavedHalfAt(s) + 0.3;
  scene.add(new THREE.Mesh(buildRibbon(s => -edge(s), s => edge(s), -0.7, -0.7, 10, S0, S1), conc));
  for (const side of [-1, 1]) {
    const latF = s => side * edge(s);
    scene.add(new THREE.Mesh(buildRibbon(latF, latF, 0.0, 1.2, 8, S0, S1), concDark));
  }

  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8f8d86, roughness: 0.9 });
  const spots = [];
  for (let s = S0; s < S1; s += 32) if (bridgeBumpAt(s) > 1.5) spots.push(s);
  const colGeo = new THREE.BoxGeometry(1.8, 1, 1.6); colGeo.translate(0, 0.5, 0);
  const cols = new THREE.InstancedMesh(colGeo, pierMat, spots.length * 2);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.2, 2.0), pierMat, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  spots.forEach((s, i) => {
    q.setFromAxisAngle(UP, headingAt(s));
    const deckY = elevAt(s);
    for (const [j, lat] of [[0, -5.5], [1, 5.5]]) {
      const g = groundY(s, lat);
      posAt(s, lat, p); p.y = g;
      sc.set(1, Math.max(1, deckY - 0.8 - g), 1);
      m.compose(p, q, sc); cols.setMatrixAt(i * 2 + j, m);
    }
    posAt(s, 0, p); p.y = deckY - 1.0;
    sc.set(pavedHalfAt(s) * 2 + 1, 1, 1);
    m.compose(p, q, sc); caps.setMatrixAt(i, m);
  });
  cols.castShadow = true;
  scene.add(cols, caps);
}

// Security checkpoint on the flyover: canopy, booths, barrier arms, sign.
function buildSecurity(scene, registry, s) {
  const g = new THREE.Group();
  const half = pavedHalfAt(s) + 0.5;
  const steel = new THREE.MeshStandardMaterial({ color: 0x6d7681, roughness: 0.5, metalness: 0.4 });
  const conc = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbcd4de, roughness: 0.15, metalness: 0.3 });

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.5, 7), steel);
  canopy.position.y = 5.4; g.add(canopy);
  for (const x of [-half, half]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.4, 0.5), steel);
    post.position.set(x, 2.7, 0); g.add(post);
  }
  // booth islands between the two carriageways
  for (const lat of [-half + 2.6, -0.4, half - 2.6]) {
    const island = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 6), conc);
    island.position.set(lat, 0.15, 0); g.add(island);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 2.2), steel);
    booth.position.set(lat, 1.35, 0); g.add(booth);
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.7, 1.6), glassMat);
    win.position.set(lat, 1.9, 0); g.add(win);
  }
  // red/white boom barriers, one per carriageway
  const armMat = new THREE.MeshStandardMaterial({ color: 0xd12b2b, roughness: 0.5 });
  for (const x of [-half / 2, half / 2]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(half - 1.2, 0.16, 0.16), armMat);
    arm.position.set(x, 1.1, 1.6); g.add(arm);
  }
  const sign = textBoard(['SECURITY CHECK', 'सुरक्षा तपासणी', 'CSMIA · T2 →'], 6, 2.8, '#0a2a5e', '#ffffff');
  sign.position.set(0, 6.7, 0.2); g.add(sign);
  registry.signs.push({ userData: { board: sign } });

  g.position.copy(posAt(s, 0, new THREE.Vector3()));
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// T2 terminal: long glass headhouse, central atrium, big lit sign, control
// tower, and a couple of parked widebodies at the gates.
function buildTerminal(scene, registry) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.2, metalness: 0.55 });
  const white = new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.7 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const side = 1; // terminal frontage on the +lat side

  const frontage = [];
  for (let k = 0; k < 6; k++) {
    const s = 21850 + k * 300;
    const lat = side * (34 + (k % 2) * 3);
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = groundY(s, lat);
    frontage.push({
      pos, rot: headingAt(s) + (rand01(k) - 0.5) * 0.1,
      sx: 58, sy: k === 3 ? 24 : 15, sz: 44,
    });
  }
  const mesh = new THREE.InstancedMesh(boxGeo, glass, frontage.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  frontage.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx, b.sy, b.sz);
    m.compose(b.pos, q, sc);
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true;
  scene.add(mesh);

  // white roof fascia band across the frontage
  const roof = new THREE.InstancedMesh(boxGeo, white, frontage.length);
  frontage.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx * 1.04, 1.6, b.sz * 1.04);
    m.compose(b.pos.clone().setY(b.pos.y + b.sy), q, sc);
    roof.setMatrixAt(i, m);
  });
  scene.add(roof);

  // big lit terminal sign facing the road
  const sgnS = 22450, sgnLat = side * (pavedHalfAt(sgnS) + 4);
  const sign = textBoard(
    ['छत्रपती शिवाजी महाराज', 'INTERNATIONAL AIRPORT', 'TERMINAL 2  ·  ✈'],
    16, 5.2, '#12143a', '#ffffff');
  const sp = posAt(sgnS, sgnLat, new THREE.Vector3());
  sign.position.set(sp.x, groundY(sgnS, sgnLat) + 9, sp.z);
  sign.rotation.y = headingAt(sgnS) + (side > 0 ? Math.PI : 0);
  scene.add(sign);
  registry.signs.push({ userData: { board: sign } });

  // control tower
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.6 });
  const tS = 23050, tLat = side * 66;
  const tg = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.4, 36, 12), towerMat);
  shaft.position.y = 18; tg.add(shaft);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 2.8, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a3440, roughness: 0.2, metalness: 0.4 }));
  cab.position.y = 37.5; tg.add(cab);
  const roofc = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.2, 12), towerMat);
  roofc.position.y = 40.6; tg.add(roofc);
  const tp = posAt(tS, tLat, new THREE.Vector3());
  tg.position.set(tp.x, groundY(tS, tLat), tp.z);
  tg.castShadow = true;
  scene.add(tg);

  // parked aircraft at the apron
  for (const [ps, pl, rot] of [[22150, 92, 0.5], [22850, 100, -0.4]]) {
    const plane = makePlane();
    const pp = posAt(ps, side * pl, new THREE.Vector3());
    plane.position.set(pp.x, groundY(ps, side * pl), pp.z);
    plane.rotation.y = headingAt(ps) + rot;
    scene.add(plane);
  }
}

function buildSignage(scene, registry) {
  const nb = textBoard(['✈ CSMIA AIRPORT', 'DEPARTURES · T2', 'सुरक्षा तपासणी पुढे'], 6.5, 3.4, '#0a2a5e', '#ffffff');
  gantry(scene, registry, 20950, [{ lat: -5, mesh: nb }], 6.6);
  const back = textBoard(['ANDHERI (W)', 'लिंक रोड', '↩ CITY'], 6, 3.0, '#0d6b3f', '#ffffff');
  gantry(scene, registry, 23650, [{ lat: -5, mesh: back }], 6.6);
}

function makePlane() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.4, metalness: 0.2 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xc8342a, roughness: 0.5 });
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 34, 14), white);
  fuse.rotation.x = Math.PI / 2; fuse.position.y = 2.4; g.add(fuse);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8), white);
  nose.position.set(0, 2.4, 17); g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(36, 0.5, 5), white);
  wing.position.y = 2.2; g.add(wing);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 4.5), trim);
  tail.position.set(0, 5, -15); g.add(tail);
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, 3), white);
  hstab.position.set(0, 3.2, -15.5); g.add(hstab);
  g.castShadow = true;
  return g;
}

// tiny deterministic jitter without pulling in a full RNG
function rand01(n) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
