import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, buildRibbon, latForLane, usableLanesAt } from './road.js';
import { laneWidthAt } from './config.js';
import {
  groundY, buildTrees, buildSuburb, buildNoiseWall, deepSprawl, farRidge,
  scatterInstanced, placementsAlong, lowLitMaterial,
} from './environment.js';
import { gantry, textBoard, water, welcomeSign } from './turnpike.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let x = seed >>> 0;
  return () => ((x = Math.imul(1664525, x) + 1013904223 | 0) >>> 0) / 4294967296;
}

function localSkyline(scene, registry, seed, s0, s1, side = -1, density = 28, hMin = 22, hMax = 90) {
  const rand = rng(seed);
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = lowLitMaterial(registry);
  const places = [];
  for (let s = s0; s < s1; s += density * (0.6 + rand() * 0.8)) {
    const lat = side * (150 + rand() * 520);
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
    places.push({ pos, rot: rand() * TAU, sx: 16 + rand() * 24, sy: hMin + rand() * (hMax - hMin), sz: 16 + rand() * 24 });
  }
  scatterInstanced(scene, geo, mat, places);
}

function guide(scene, registry, s, lines, color = '#046a38') {
  const a = textBoard(lines, 8.5, 3.5, color, '#ffffff');
  const b = textBoard(lines, 8.5, 3.5, color, '#ffffff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 6.8);
}

function interchange(scene, registry, s, span, labels) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x34383b, roughness: 0.92 });
  const barrier = new THREE.MeshStandardMaterial({ color: 0x929797, roughness: 0.86 });
  const center = s + span / 2;
  for (const side of [-1, 1]) {
    const ramp = t => side * (pavedHalfAt(t) + 12 + 52 * Math.sin(Math.PI * Math.max(0, Math.min(1, (t - s) / span))));
    const edge = t => ramp(t) + side * 3.7;
    scene.add(new THREE.Mesh(buildRibbon(ramp, edge, t => 1.2 + 2.4 * Math.sin(Math.PI * Math.max(0, Math.min(1, (t - s) / span))), t => 1.2 + 2.4 * Math.sin(Math.PI * Math.max(0, Math.min(1, (t - s) / span))), 10, s, s + span), asphalt));
    scene.add(new THREE.Mesh(buildRibbon(t => ramp(t) - side * 0.18, t => ramp(t) + side * 0.18, 1.8, 1.8, 10, s, s + span), barrier));
  }
  guide(scene, registry, center, labels);
}

function bridge(scene, registry, s, width, label) {
  const rail = new THREE.MeshStandardMaterial({ color: 0x7d858a, roughness: 0.58, metalness: 0.45 });
  for (const side of [-1, 1]) {
    const inner = t => side * (pavedHalfAt(t) + 0.35);
    const outer = t => side * (pavedHalfAt(t) + 1.05);
    scene.add(new THREE.Mesh(buildRibbon(inner, outer, 1.0, 1.9, 10, s - width / 2, s + width / 2), rail));
  }
  water(scene, s, 420, width * 1.5);
  guide(scene, registry, s - width / 2 - 300, [label, 'WATCH FOR CROSSWINDS'], '#15355e');
}

function restArea(scene, registry, s, name, side = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(24, 5, 15), new THREE.MeshStandardMaterial({ color: 0xcac8bf, roughness: 0.9 }));
  body.position.y = 2.5; g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(27, 0.8, 18), new THREE.MeshStandardMaterial({ color: 0x3f5660, roughness: 0.82 }));
  roof.position.y = 5.4; g.add(roof);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(17, 0.55, 9), new THREE.MeshStandardMaterial({ color: 0xd7d0b8, roughness: 0.86 }));
  canopy.position.set(0, 4.5, -13); g.add(canopy);
  for (const x of [-6, 0, 6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.3, 0.55), canopy.material); p.position.set(x, 2.15, -13); g.add(p); }
  const sign = textBoard([name, 'REST AREA', 'FOOD · FUEL · RESTROOMS'], 7.2, 3.4, '#046a38', '#ffffff');
  sign.position.set(0, 8.5, 8); g.add(sign); registry.signs.push({ userData: { board: sign } });
  const lat = side * (pavedHalfAt(s) + 34);
  g.position.copy(posAt(s, lat, new THREE.Vector3())); g.position.y = groundY(s, lat); g.rotation.y = headingAt(s); scene.add(g);
  guide(scene, registry, s - 650, ['REST AREA', name], '#15355e');
}

function constructionZone(scene, registry, s0, s1, side = 1) {
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4e8a9, depthWrite: false });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xf0781c, roughness: 0.84 });
  const coneGeo = new THREE.ConeGeometry(0.42, 1.15, 8); coneGeo.translate(0, 0.58, 0);
  const lane = s => latForLane(side, Math.max(0, usableLanesAt(s) - 1), s);
  const solid = s => lane(s) - side * laneWidthAt(s) * 0.5;
  scene.add(new THREE.Mesh(buildRibbon(s => solid(s) - 0.11, s => solid(s) + 0.11, 0.08, 0.08, 8, s0, s1), lineMat));
  const spots = [];
  for (let s = s0; s < s1; s += 18) { const lat = lane(s); const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat) + 0.02; spots.push({ pos: p, rot: headingAt(s) }); }
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, spots.length);
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
  spots.forEach((sp, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.rot); mat.compose(sp.pos, q, scale); cones.setMatrixAt(i, mat); });
  cones.castShadow = false; scene.add(cones);
  for (const [s, lines] of [[s0 - side * 800, ['ROAD WORK', '1 MILE']], [s0 - side * 260, ['RIGHT LANE', 'CLOSED']], [s0 + side * 80, ['MERGE LEFT', 'AHEAD']]]) {
    const sign = textBoard(lines, 7.0, 3.1, '#e87512', '#101216');
    const lat = side * (pavedHalfAt(s) + 7); sign.position.copy(posAt(s, lat, new THREE.Vector3())); sign.position.y = groundY(s, lat) + 5.7; sign.rotation.y = headingAt(s) + (side > 0 ? Math.PI : 0); scene.add(sign); registry.signs.push({ userData: { board: sign } });
  }
}

export function buildNc40(scene, registry) {
  // Long rural bookends: farms remain visible, but tree walls, utility lines,
  // signs and overpasses keep the drive from becoming empty flatland.
  buildTrees(scene, 7001, 0, 16000, 15, 34, 190, 0, true);
  buildTrees(scene, 7007, 16000, 32000, 18, 42, 260, 0, true);
  buildTrees(scene, 7002, 32000, 78000, 18, 42, 250, 0, true);
  buildTrees(scene, 7003, 151000, 190000, 16, 42, 260, 0, false);
  buildTrees(scene, 7004, 230000, 305000, 16, 38, 260, 0, false);
  buildTrees(scene, 7005, 265000, 305000, 13, 42, 180, 0, true);
  buildTrees(scene, 7006, 305000, 350000, 12, 38, 200, 0, false);
  buildTrees(scene, 7008, 151000, 176000, 20, 48, 300, 0, true);
  buildTrees(scene, 7009, 265000, 305000, 22, 52, 340, 0, true);

  // City fabric: continuous set-back development with tree/sound-wall buffers.
  for (const [s0, s1, density] of [[52000, 112000, 0.9], [112000, 151000, 1.15], [176000, 230000, 1.05], [230000, 265000, 0.9], [305000, 350000, 1.2]]) {
    deepSprawl(scene, 7100 + s0, s0, s1, { density, towers: false, litMat: lowLitMaterial(registry) });
    buildTrees(scene, 7200 + s0, s0, s1, 18, 48, 190, 0, false);
  }
  buildNoiseWall(scene, 76000, 151000, { seed: 7301, height: 5.2, margin: 4.2, step: 14, gapChance: 0.12 });
  buildNoiseWall(scene, 190000, 265000, { seed: 7302, height: 5.0, margin: 4.2, step: 14, gapChance: 0.14 });
  buildNoiseWall(scene, 305000, 350000, { seed: 7303, height: 5.4, margin: 4.0, step: 13, gapChance: 0.1 });

  localSkyline(scene, registry, 7401, 82000, 112000, -1, 25, 28, 110);   // Raleigh
  localSkyline(scene, registry, 7402, 112000, 151000, -1, 22, 30, 120);  // Triangle / RDU
  localSkyline(scene, registry, 7403, 190000, 230000, -1, 20, 35, 125);  // Greensboro
  localSkyline(scene, registry, 7404, 305000, 350000, -1, 19, 40, 145);  // Charlotte

  // Benson: the route's signature I-40/I-95 split, with directional flyovers
  // and separate north/south I-95 guide signs.
  interchange(scene, registry, 17000, 1500, ['I-95 NORTH', 'SMITHFIELD · ROCKY MOUNT']);
  interchange(scene, registry, 19500, 1500, ['I-95 SOUTH', 'FAYETTEVILLE · BENSON']);
  guide(scene, registry, 20500, ['I-40 WEST', 'RALEIGH · GREENSBORO · CHARLOTTE']);
  welcomeSign(scene, registry, 16000, 1, ['WELCOME TO BENSON', 'JOHNSTON COUNTY'], '#a41e34');

  // Raleigh/Cary/RDU: beltline ramps, airport approach and dense commuter signs.
  interchange(scene, registry, 86000, 2200, ['I-440 BELTLINE', 'DOWNTOWN RALEIGH']);
  interchange(scene, registry, 122000, 2400, ['I-540', 'RDU AIRPORT · CARY']);
  guide(scene, registry, 130000, ['RDU AIRPORT', 'TERMINALS · RENTAL CARS'], '#15355e');
  bridge(scene, registry, 108500, 1100, 'NEUSE RIVER');

  // Greensboro: a visible I-40/I-85 concurrency and switch. The ramps are
  // scenery-only, so they add the interchange read without altering driving
  // topology or trapping traffic.
  interchange(scene, registry, 193500, 2400, ['I-840 / URBAN LOOP', 'GREENSBORO']);
  interchange(scene, registry, 216000, 3000, ['I-40 EAST', 'RALEIGH · DURHAM']);
  guide(scene, registry, 220000, ['I-85 SOUTH', 'HIGH POINT · CHARLOTTE']);
  guide(scene, registry, 223500, ['I-85 NORTH', 'DANVILLE · VIRGINIA']);
  bridge(scene, registry, 201500, 900, 'GREENSBORO URBAN LOOP');

  // Piedmont river crossings and the Charlotte approach.
  bridge(scene, registry, 278500, 1000, 'YADKIN RIVER');
  bridge(scene, registry, 318500, 850, 'ROCKY RIVER');
  interchange(scene, registry, 313000, 2200, ['I-485', 'CHARLOTTE OUTER LOOP']);
  guide(scene, registry, 338000, ['CHARLOTTE', 'SUGAR CREEK · DOWNTOWN']);
  farRidge(scene, 7501, 151000, 230000, 1);
  farRidge(scene, 7502, 265000, 305000, -1);

  restArea(scene, registry, 47000, 'JOHNSTON PINES', 1);
  restArea(scene, registry, 164000, 'ALAMANCE OAKS', -1);
  restArea(scene, registry, 252000, 'PIEDMONT TRAVEL PLAZA', 1);
  restArea(scene, registry, 292000, 'YADKIN VALLEY', -1);
  constructionZone(scene, registry, 63500, 65100, 1);
  constructionZone(scene, registry, 145500, 147200, -1);
  constructionZone(scene, registry, 204500, 206200, 1);
  constructionZone(scene, registry, 326000, 327800, -1);
}
