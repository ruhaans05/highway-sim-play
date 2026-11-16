import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, buildRibbon } from './road.js';
import {
  groundY, buildTrees, buildSuburb, scatterInstanced, placementsAlong,
  deepSprawl, facadeTexture,
} from './environment.js';
import { textBoard, gantry, welcomeSign, water, skyline } from './turnpike.js';

// Texas and Florida share the game's American road fabric, but their roadside
// signatures are different: frontage-road sprawl and giant interchanges in
// Texas; flat pinewoods, wetlands, toll plazas and palms in Florida.

function routeBoard(scene, registry, s, lines, bg = '#056b3a') {
  const a = textBoard(lines, 9.5, 3.4, bg, '#fff');
  const b = textBoard(lines, 9.5, 3.4, bg, '#fff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -5.5, mesh: a }, { lat: 5.5, mesh: b }], 6.8);
}

function ensureSkylineMaterial(registry) {
  if (registry.towerMats?.length) return;
  const tex = facadeTexture(4500);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.7, color: 0xffffff,
  })];
}

function simpleServiceArea(scene, registry, s, name, color = 0x2d5d38) {
  const g = new THREE.Group();
  const p = posAt(s, 58, new THREE.Vector3());
  g.position.set(p.x, groundY(s, 58), p.z); g.rotation.y = headingAt(s);
  const lot = new THREE.Mesh(new THREE.BoxGeometry(68, 0.12, 54), new THREE.MeshStandardMaterial({ color: 0x3e4144, roughness: 1 }));
  lot.position.y = 0.06; g.add(lot);
  const b = new THREE.Mesh(new THREE.BoxGeometry(24, 5, 14), new THREE.MeshStandardMaterial({ color: 0xd5d0c6, roughness: .9 }));
  b.position.set(0, 2.5, -15); g.add(b);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(28, .6, 15), new THREE.MeshStandardMaterial({ color: color, roughness: .6 }));
  canopy.position.set(0, 5.5, 6); g.add(canopy);
  for (const x of [-11, 11]) for (const z of [0, 12]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.45, 5.3, .45), new THREE.MeshStandardMaterial({ color: 0x9ea3a6, metalness: .4 }));
    post.position.set(x, 2.65, 6 + z - 6); g.add(post);
  }
  const sign = textBoard([name, 'SERVICE PLAZA', 'FUEL · FOOD'], 7.5, 3.2, '#0d4a2c', '#fff');
  sign.position.set(0, 8.5, 8); g.add(sign); registry.signs.push({ userData: { board: sign } });
  scene.add(g);
}

function frontageRoads(scene, s0, s1) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x3c4144, roughness: .98 });
  for (const side of [-1, 1]) {
    const lat = s => side * (pavedHalfAt(s) + 15);
    scene.add(new THREE.Mesh(buildRibbon(s => lat(s) - 2.8, s => lat(s) + 2.8, .025, .025, 18, s0, s1), mat));
  }
}

function palms(scene, s0, s1, seed, step = 42) {
  const trunk = new THREE.CylinderGeometry(.18, .3, 3.6, 7); trunk.translate(0, 1.8, 0);
  const crown = new THREE.ConeGeometry(1.7, 2.6, 7); crown.translate(0, 4.6, 0);
  const places = placementsAlong(seed, s0, s1, step, 35, 95, (rand, pos, s, lat) => ({
    pos, rot: rand() * Math.PI * 2, sx: .8 + rand() * .5, sy: .8 + rand() * .5, sz: .8 + rand() * .5,
  }), 12);
  scatterInstanced(scene, trunk, new THREE.MeshStandardMaterial({ color: 0x76533d, roughness: 1 }), places, { shadow: false });
  scatterInstanced(scene, crown, new THREE.MeshStandardMaterial({ color: 0x2f6d3d, roughness: 1 }), places, { shadow: false });
}

export function buildTexasI45(scene, registry) {
  ensureSkylineMaterial(registry);
  routeBoard(scene, registry, 2200, ['I-45 SOUTH', 'DOWNTOWN DALLAS', 'HOUSTON']);
  routeBoard(scene, registry, 382500, ['I-45 NORTH', 'DALLAS', 'DOWNTOWN HOUSTON']);
  welcomeSign(scene, registry, 8500, 1, ['WELCOME TO DALLAS', 'NORTH TEXAS', 'I-45 SOUTH'], '#125b91');
  welcomeSign(scene, registry, 376000, -1, ['WELCOME TO HOUSTON', 'HARRIS COUNTY', 'I-45 NORTH'], '#125b91');
  frontageRoads(scene, 0, 32000);
  frontageRoads(scene, 356000, 388000);
  // Ornamental palms occur around the Dallas/Houston metro edges, but I-45's
  // long middle is oak, pecan, pine, pasture, and bottomland—not palm-lined.
  palms(scene, 0, 18000, 4601, 150);
  palms(scene, 342000, 388000, 4602, 150);
  buildSuburb(scene, registry, 0, 24000, { seed: 451, density: 28 });
  buildSuburb(scene, registry, 354000, 388000, { seed: 452, density: 24 });
  deepSprawl(scene, 453, 10000, 42000, { sides: [-1, 1], density: 1.2 });
  deepSprawl(scene, 454, 344000, 380000, { sides: [-1, 1], density: 1.35 });
  skyline(scene, registry, 4501, 0, 9000, 110, 90, 230, 35, 150, [-1, 1]);
  skyline(scene, registry, 4502, 373000, 388000, 120, 90, 250, 35, 170, [-1, 1]);
  water(scene, 129000, 2600, 1300);
  water(scene, 319000, 1800, 1000);
  simpleServiceArea(scene, registry, 105000, 'NAVARRO COUNTY');
  simpleServiceArea(scene, registry, 260000, 'PALESTINE');
  simpleServiceArea(scene, registry, 333000, 'HUNTSVILLE');
}

export function buildFloridaTurnpike(scene, registry) {
  ensureSkylineMaterial(registry);
  routeBoard(scene, registry, 2500, ['FLORIDA\'S TURNPIKE', 'MIAMI', 'SUNPASS']);
  routeBoard(scene, registry, 766000, ['FLORIDA\'S TURNPIKE', 'WILDWOOD', 'OCALA']);
  welcomeSign(scene, registry, 7000, 1, ['MIAMI-DADE COUNTY', 'SUNSHINE STATE', 'FLORIDA\'S TURNPIKE'], '#126d9a');
  welcomeSign(scene, registry, 756000, -1, ['WELCOME TO CENTRAL FLORIDA', 'FLORIDA\'S TURNPIKE', 'NORTHBOUND'], '#126d9a');
  palms(scene, 0, 110000, 7601);
  // Central/north Florida gets sabal palms as scattered accents, not a dense
  // South-Florida boulevard treatment.
  palms(scene, 550000, 660000, 7602, 92);
  buildTrees(scene, 7610, 85000, 760000, 9, 40, 130, 0, true);
  buildTrees(scene, 7611, 120000, 730000, 10, 45, 170, 0, false);
  buildSuburb(scene, registry, 0, 52000, { seed: 7612, density: 34 });
  buildSuburb(scene, registry, 510000, 650000, { seed: 7613, density: 38 });
  deepSprawl(scene, 7614, 0, 76000, { sides: [-1, 1], density: 1.25 });
  deepSprawl(scene, 7615, 516000, 650000, { sides: [-1, 1], density: 1.1 });
  skyline(scene, registry, 7620, 0, 18000, 120, 85, 220, 35, 135, [-1, 1]);
  // The Turnpike stays inland, so the coastal high-rise skylines are distant
  // and one-sided rather than a wall: Broward, Palm Beach, and Orlando read as
  // intermittent towers over the tree line, not as downtown street canyons.
  skyline(scene, registry, 7622, 42000, 76000, 240, 360, 920, 28, 105, [1]);
  skyline(scene, registry, 7623, 211000, 245000, 260, 380, 980, 30, 120, [1]);
  skyline(scene, registry, 7624, 426000, 475000, 230, 240, 760, 32, 145, [-1, 1]);
  skyline(scene, registry, 7621, 520000, 555000, 140, 100, 260, 40, 180, [-1, 1]);
  water(scene, 73500, 4500, 1700);
  water(scene, 421000, 5000, 1900);
  water(scene, 681000, 3500, 1500);
  simpleServiceArea(scene, registry, 145000, 'PORT ST. LUCIE');
  simpleServiceArea(scene, registry, 295000, 'FORT DRUM');
  simpleServiceArea(scene, registry, 478000, 'FORT PIERCE');
  simpleServiceArea(scene, registry, 615000, 'ORLANDO SOUTH');
}
