import * as THREE from 'three';
import { LOOP_LENGTH, ZONES } from './config.js';
import { buildRibbon, posAt, headingAt, pavedHalfAt } from './road.js';
import {
  groundY, clampOffRoad, scatterInstanced, buildTrees, facadeTexture,
  deepSprawl,
} from './environment.js';
import { textBoard, welcomeSign } from './turnpike.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let x = seed >>> 0;
  return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
}

function routeS(km) { return km * 1000; }

function roadsideHouse(scene, s, side, rand, poor = false) {
  const lat = side * (pavedHalfAt(s) + 12 + rand() * 80);
  const pos = posAt(s, lat, new THREE.Vector3());
  pos.y = groundY(s, lat);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(
    poor ? 5 + rand() * 5 : 8 + rand() * 8,
    poor ? 2.5 + rand() * 1.5 : 3.5 + rand() * 3,
    poor ? 4 + rand() * 4 : 7 + rand() * 6,
  ), new THREE.MeshStandardMaterial({
    color: poor ? [0xa97852, 0x9f6d4e, 0xb58c68][(rand() * 3) | 0] : [0xc8b28f, 0xd0c7b6, 0xb9c5bc][(rand() * 3) | 0],
    roughness: 1,
  }));
  body.position.y = body.geometry.parameters.height / 2; g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(body.scale.x, 1) * 5, 2.2, 4),
    new THREE.MeshStandardMaterial({ color: poor ? 0x5b4b3f : 0x6f6254, roughness: 1 }));
  roof.scale.set(1, 1, 0.7); roof.position.y = body.geometry.parameters.height + 1; g.add(roof);
  g.position.copy(pos); g.rotation.y = headingAt(s) + (rand() - 0.5) * 0.3;
  scene.add(g);
}

function animal(scene, s, side, rand, kind = 'cow') {
  const lat = side * (pavedHalfAt(s) + 4 + rand() * 18);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(kind === 'goat' ? 0.55 : 0.85, 8, 6),
    new THREE.MeshStandardMaterial({ color: kind === 'goat' ? 0x8c7864 : [0xf0ede2, 0x6d5d4d, 0x9d8c72][(rand() * 3) | 0], roughness: 1 }));
  body.scale.set(1.5, 0.8, 0.75); body.position.y = 0.9; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(kind === 'goat' ? 0.35 : 0.48, 7, 5), body.material);
  head.position.set(0, 1.05, 0.95); g.add(head);
  for (const x of [-0.42, 0.42]) for (const z of [-0.35, 0.35]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 5), body.material);
    leg.position.set(x, 0.38, z); g.add(leg);
  }
  g.position.copy(p); g.rotation.y = rand() * TAU; scene.add(g);
}

function culvertBridge(scene, registry, s, width = 18) {
  const lat = pavedHalfAt(s) + 1;
  const railMat = new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 1 });
  for (const side of [-1, 1]) {
    const a = side * (lat + width * 0.5), b = side * (lat + width * 0.5 + 0.35);
    scene.add(new THREE.Mesh(buildRibbon(a, b, 1.1, 1.1, 8, s - 90, s + 90), railMat));
  }
  const sign = textBoard(['पुलिया', 'CULVERT / पुल'], 4.4, 1.5, '#385b3b', '#ffffff');
  sign.position.copy(posAt(s - 85, -pavedHalfAt(s) - 3, new THREE.Vector3()));
  sign.position.y += 2.1; sign.rotation.y = headingAt(s);
  scene.add(sign); registry.signs.push({ userData: { board: sign } });
}

function worshipSite(scene, s, side, rand, kind = 'temple') {
  const lat = side * (pavedHalfAt(s) + 26 + rand() * 70);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: kind === 'temple' ? 0xd39a61 : 0xd8d6c8, roughness: 0.95 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(10 + rand() * 8, 4 + rand() * 3, 8 + rand() * 6), wall);
  base.position.y = 2.5; g.add(base);
  if (kind === 'temple') {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0xb65b36, roughness: 0.9 }));
    spire.position.y = 9; g.add(spire);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.2), new THREE.MeshBasicMaterial({ color: 0xf07a28, side: THREE.DoubleSide }));
    flag.position.set(0, 14, 0); flag.rotation.y = Math.PI / 2; g.add(flag);
  } else {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8, 0, TAU, 0, Math.PI / 2), wall);
    dome.position.y = 7; g.add(dome);
    for (const x of [-5, 5]) {
      const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 8, 8), wall);
      minaret.position.set(x, 6, 0); g.add(minaret);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0x6e7e73, roughness: 0.9 }));
      cap.position.set(x, 10.8, 0); g.add(cap);
    }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ color: 0x2d7b4c, side: THREE.DoubleSide }));
    flag.position.set(0, 12, 0); flag.rotation.y = Math.PI / 2; g.add(flag);
  }
  g.position.copy(p); g.rotation.y = headingAt(s); scene.add(g);
}

function roadsideStatue(scene, s, side, rand, color = 0x8c6d4c) {
  const lat = side * (pavedHalfAt(s) + 8 + rand() * 14);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 2.8), mat); plinth.position.y = 0.75; g.add(plinth);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 2.3, 7), mat); body.position.y = 2.5; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), mat); head.position.y = 4.1; g.add(head);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.4, 5), new THREE.MeshStandardMaterial({ color: 0x6c7e42, roughness: 1 }));
  canopy.position.y = 5.9; g.add(canopy);
  g.position.copy(p); scene.add(g);
}

export function buildDelhiKolkata(scene, registry) {
  const rand = rng(220622);
  const houseBox = new THREE.BoxGeometry(1, 1, 1);
  const houseMat = new THREE.MeshStandardMaterial({ map: facadeTexture(2206), roughness: 1 });

  // City edges: dense, abrupt transitions into poorer ribbon settlements.
  for (const [s0, s1, density] of [
    [0, 35000, 1.2], [280000, 390000, 1.0], [505000, 575000, 0.95],
    [1460000, 1530000, 1.25],
  ]) deepSprawl(scene, 2200 + s0, s0, s1, { density, towers: false, side: 1 });

  // Rural settlement rhythm: no endless empty countryside. Poorer clustered
  // homes, brick walls, farm compounds and occasional larger pucca houses.
  for (const z of ZONES) {
    if (!z.key.startsWith('dk_')) continue;
    const rural = !['dk_delhi', 'dk_kanpur', 'dk_prayagraj', 'dk_varanasi', 'dk_kolkata'].includes(z.key);
    const step = rural ? 1500 : 650;
    for (let s = z.start + 700; s < z.end - 500; s += step * (0.65 + rand() * 0.8)) {
      if (rand() < (rural ? 0.7 : 0.45)) roadsideHouse(scene, s, rand() < 0.5 ? -1 : 1, rand, rural && rand() < 0.72);
      if (rural && rand() < 0.55) roadsideHouse(scene, s + 120 + rand() * 260, rand() < 0.5 ? -1 : 1, rand, true);
    }
  }

  // Agricultural texture and regional tree canopy.
  buildTrees(scene, 2210, 35000, 720000, 95, 45, 310, 0, false, 0.9);
  buildTrees(scene, 2211, 720000, 1270000, 78, 38, 260, 0, false, 1.05);
  buildTrees(scene, 2212, 1270000, 1495000, 62, 40, 240, 0, false, 1.15);
  buildTrees(scene, 2213, 1495000, LOOP_LENGTH, 44, 32, 210, 0, false, 1.25);

  // Bridges, floodplain crossings and small culverts.
  for (const s of [37000, 512000, 744000, 1131000, 1478500]) culvertBridge(scene, registry, s);

  const signs = [
    [1200, ['दिल्ली', 'DELHI · LOCAL ROAD', 'दिल्ली से कोलकाता']],
    [174500, ['अलीगढ़', 'ALIGARH', 'उत्तर प्रदेश']],
    [384500, ['कानपुर देहात', 'KANPUR REGION', 'गांव का रास्ता']],
    [714500, ['वाराणसी', 'VARANASI', 'पूर्वांचल']],
    [914500, ['सासाराम', 'SASARAM', 'बिहार']],
    [1269500, ['धनबाद', 'DHANBAD', 'झारखंड']],
    [1494500, ['বর্ধমান', 'BARDHAMAN', 'পশ্চিমবঙ্গ']],
    [1510000, ['कोलकाता', 'KOLKATA', 'কলকাতা']],
  ];
  for (const [s, lines] of signs) welcomeSign(scene, registry, s, 1, lines, '#12613f');

  // Places of worship are frequent but not wall-to-wall. Hindu temples are
  // the majority of roadside shrines, with mosques represented in a visible
  // minority that increases through eastern UP, Bihar and Bengal.
  const worshipBands = [
    [45000, 285000, 0.22], [385000, 715000, 0.19], [715000, 1060000, 0.28],
    [1060000, 1335000, 0.26], [1335000, 1530000, 0.24],
  ];
  for (const [s0, s1, mosqueShare] of worshipBands) {
    for (let s = s0 + 9000; s < s1; s += 24000 + rand() * 26000) {
      const kind = rand() < mosqueShare ? 'mosque' : 'temple';
      worshipSite(scene, s, rand() < 0.5 ? -1 : 1, rand, kind);
      if (rand() < 0.24) roadsideStatue(scene, s + 180 + rand() * 240, rand() < 0.5 ? -1 : 1, rand, kind === 'mosque' ? 0x8d8a78 : 0x9a6445);
    }
  }

  // Livestock is concentrated around farms, ponds and village ribbons.
  for (const z of ZONES) {
    if (!z.key.startsWith('dk_') || z.key === 'dk_delhi' || z.key === 'dk_kolkata') continue;
    const count = Math.max(2, Math.round((z.end - z.start) / 28000));
    for (let i = 0; i < count; i++) animal(scene, z.start + 3000 + rand() * (z.end - z.start - 6000), rand() < 0.5 ? -1 : 1, rand, rand() < 0.25 ? 'goat' : 'cow');
  }

  // Sparse roadside utility poles: villages have power, but not a polished
  // continuous lighting system.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x69645c, roughness: 1 });
  for (let s = 40000; s < 1460000; s += 260 + rand() * 260) {
    if (rand() < 0.34) continue;
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (pavedHalfAt(s) + 10 + rand() * 25);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7 + rand() * 2, 5), poleMat);
    pole.position.copy(p); pole.position.y += 4; pole.rotation.z = (rand() - 0.5) * 0.04; scene.add(pole);
  }
}
