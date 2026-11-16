import * as THREE from 'three';
import { posAt, headingAt } from '../road.js';
import { groundY, scatterInstanced, buildTrees, buildBillboards } from '../environment.js';
import { welcomeSign } from '../turnpike.js';
import { buildWindFarm } from '../midwest.js';
import { seeded, urbanTerrain, overpassGrid } from './primitives.js';

const RURAL_ADS = [
  ["LOVE'S · TRAVEL STOP", '#f58220', '#ffffff'], ['PILOT · DIESEL', '#c8102e', '#ffffff'],
  ['PURDUE · NEXT EXITS', '#111111', '#cfb991'], ["CASEY'S · FOOD · FUEL", '#e31837', '#ffffff'],
  ['INDIANA GROWN', '#6a7a35', '#ffffff'], ['TRUCK PARKING · NEXT EXIT', '#0d6b3f', '#ffffff'],
];

function ruralBuildings(scene, s0, s1, seed, opts = {}) {
  const rand = seeded(seed);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const sheds = [], silos = [];
  const siloGeo = new THREE.CylinderGeometry(1, 1, 1, 12); siloGeo.translate(0, 0.5, 0);
  for (let s = s0 + 150; s < s1; s += (opts.step || 420) * (0.7 + rand() * 0.7)) {
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (90 + rand() * 500);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    sheds.push({
      pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.25,
      sx: 38 + rand() * 85, sy: 7 + rand() * 10, sz: 28 + rand() * 65,
      color: new THREE.Color([0xb6b7b2, 0x9a3c31, 0xd2c8ad, 0x8a9497][(rand() * 4) | 0]),
    });
    if (rand() < 0.65) {
      const q = posAt(s + 35, lat + side * 55, new THREE.Vector3()); q.y = groundY(s + 35, lat + side * 55);
      silos.push({ pos: q, rot: 0, sx: 6 + rand() * 5, sy: 18 + rand() * 22, sz: 6 + rand() * 5 });
    }
  }
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), sheds);
  scatterInstanced(scene, siloGeo, new THREE.MeshStandardMaterial({ color: 0xb8b9b6, roughness: 0.65, metalness: 0.2 }), silos);
}

function logisticsBand(scene, s0, s1, seed) {
  const rand = seeded(seed);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const places = [];
  for (let s = s0; s < s1; s += 260 + rand() * 250) {
    if (rand() < 0.3) continue;
    for (const side of [-1, 1]) {
      const lat = side * (80 + rand() * 250);
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      places.push({ pos: p, rot: headingAt(s), sx: 55 + rand() * 95, sy: 8 + rand() * 8, sz: 40 + rand() * 80 });
    }
  }
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0xaeb4b5, roughness: 0.88 }), places);
}

export function buildRuralIndiana(scene, registry) {
  const fields = [0x536a35, 0x6f7437, 0x85743b, 0x59643b, 0x756a3d];
  urbanTerrain(scene, 53000, 79000, 1000, 3101, fields, { step: 110, bands: 9 });
  ruralBuildings(scene, 53000, 79000, 3102, { step: 520 });
  logisticsBand(scene, 53000, 58500, 3103);
  logisticsBand(scene, 70000, 79000, 3104);
  buildTrees(scene, 3105, 53000, 63000, 60, 95, 520, 45);
  buildTrees(scene, 3106, 71000, 79000, 35, 70, 440, 60);
  buildWindFarm(scene, registry, 63000, 71000, 3107, { count: 72 });
  overpassGrid(scene, registry, [
    [54800, 'US-30'], [57500, 'SR-10'], [60500, 'US-24'], [65000, 'SR-18'], [70000, 'SR-26 · LAFAYETTE'], [75200, 'SR-32 · LEBANON'],
  ]);
  welcomeSign(scene, registry, 64200, 1, ['EASTERN TIME ZONE', 'SET CLOCKS AHEAD 1 HOUR', 'WHITE COUNTY'], '#0d6b3f');
  buildBillboards(scene, registry, 3108, 53000, 79000, 17, RURAL_ADS);
}

export function buildRuralI74(scene, registry) {
  const flatFields = [0x586b36, 0x77753b, 0x8a7440, 0x58633c, 0x6e693b];
  urbanTerrain(scene, 95000, 111000, 1000, 3120, flatFields, { step: 110, bands: 9 });
  ruralBuildings(scene, 95000, 111000, 3121, { step: 460 });
  logisticsBand(scene, 95500, 103500, 3122);
  overpassGrid(scene, registry, [
    [97000, 'SHELBYVILLE'], [104500, 'US-421 · GREENSBURG'], [109500, 'SR-229 · OLDENBURG'],
  ]);

  const hillGround = [0x47543a, 0x4f5d3e, 0x5a6240, 0x655f3d];
  urbanTerrain(scene, 111000, 125000, 900, 3130, hillGround, { step: 85, bands: 8 });
  ruralBuildings(scene, 111000, 125000, 3131, { step: 620 });
  buildTrees(scene, 3132, 111000, 125000, 28, 65, 650, 135, true);
  overpassGrid(scene, registry, [
    [113000, 'BATESVILLE'], [118000, 'SUNMAN'], [122500, 'WEST HARRISON · OHIO LINE'],
  ]);
  buildBillboards(scene, registry, 3133, 95000, 124500, 13, RURAL_ADS);
}

