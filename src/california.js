import * as THREE from 'three';
import { posAt, headingAt } from './road.js';
import {
  buildTrees, scatterInstanced, placementsAlong, facadeTexture, groundY,
} from './environment.js';
import { gantry, textBoard, skyline, bridgeStructure, water } from './turnpike.js';

// I-5 Los Angeles → San Francisco. This is the long inland California run:
// basin freeway, Tejon/California mountains, Central Valley farms and truck
// stops, Pacheco Pass, then Silicon Valley and the US-101/I-5 Bay approach.

const TAU = Math.PI * 2;
function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function cityCarpet(scene, seed, s0, s1, density = 1) {
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd6c9b5, roughness: 0.92 });
  const places = placementsAlong(seed, s0, s1, 18 / density, 80, 560, (r, pos, s) => ({
    pos, rot: headingAt(s) + (r() - 0.5) * 0.5,
    sx: 10 + r() * 18, sy: 5 + r() * 18, sz: 10 + r() * 18,
    color: new THREE.Color([0xd8cbb7, 0xc3b39d, 0xb8c0c8, 0xe0d7c8][(r() * 4) | 0]),
  }), 6);
  scatterInstanced(scene, box, mat, places);
}

function mountainWall(scene, seed, s0, s1, { snow = false } = {}) {
  const rand = rng(seed);
  const rock = new THREE.MeshStandardMaterial({ color: snow ? 0x626b70 : 0x756044, roughness: 1 });
  const scrub = new THREE.MeshStandardMaterial({ color: 0x5f633d, roughness: 1 });
  const ridge = new THREE.IcosahedronGeometry(1, 1);
  const peaks = [];
  for (let s = s0; s < s1; s += 950 + rand() * 850) {
    for (const side of [-1, 1]) {
      const lat = side * (850 + rand() * 800);
      const p = posAt(s, lat, new THREE.Vector3());
      p.y = groundY(s, lat) - 10;
      peaks.push({ pos: p, rot: rand() * TAU, sx: 450 + rand() * 520, sy: 120 + rand() * 220, sz: 380 + rand() * 500, color: rand() < 0.38 ? rock.color : scrub.color });
    }
  }
  scatterInstanced(scene, ridge, rock, peaks);
  // Closer chaparral/foothill trees break up the repeated mountain geometry.
  buildTrees(scene, seed + 1, s0, s1, 24, 80, 520, 0, false, 0.9);
}

function orchards(scene, seed, s0, s1) {
  const trunk = new THREE.CylinderGeometry(0.18, 0.24, 1.7, 5); trunk.translate(0, 0.85, 0);
  const crown = new THREE.SphereGeometry(1.15, 6, 5); crown.translate(0, 2.0, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x654a30, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x47703a, roughness: 1 });
  const trees = [];
  const rand = rng(seed);
  for (let s = s0; s < s1; s += 24) {
    for (const side of [-1, 1]) {
      const lat = side * (95 + (rand() * 9 | 0) * 34);
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      trees.push({ pos: p, rot: rand() * TAU, sx: 1, sy: 0.9 + rand() * 0.35, sz: 1 });
    }
  }
  scatterInstanced(scene, trunk, trunkMat, trees, { shadow: false });
  scatterInstanced(scene, crown, crownMat, trees, { shadow: false });
}

function losAngelesPalms(scene, s0, s1, seed) {
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 5.5, 7); trunk.translate(0, 2.75, 0);
  const crown = new THREE.ConeGeometry(1.8, 2.8, 8); crown.translate(0, 6.4, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x76533d, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x41663a, roughness: 1 });
  const places = placementsAlong(seed, s0, s1, 105, 38, 115, (rand, pos) => ({
    pos, rot: rand() * TAU, sx: 0.85 + rand() * 0.35, sy: 0.9 + rand() * 0.25, sz: 0.85 + rand() * 0.35,
  }), 8);
  scatterInstanced(scene, trunk, trunkMat, places, { shadow: false });
  scatterInstanced(scene, crown, crownMat, places, { shadow: false });
}

function buildCaliforniaI5(scene, registry) {
  const tex = facadeTexture(37); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff });
  registry.towerMats = [towerMat];

  // Los Angeles basin: the I-5/US-101/SR-170 side of LA is wall-to-wall city.
  skyline(scene, registry, 6100, 0, 48000, 24, 80, 440, 45, 180, [-1, 1]);
  cityCarpet(scene, 6101, 0, 72000, 1.4);
  buildTrees(scene, 6102, 0, 72000, 20, 35, 180, 0);
  // Southern California palms are visible around the LA basin and interchanges;
  // they thin out quickly once I-5 climbs toward the Grapevine.
  losAngelesPalms(scene, 0, 65000, 6103);
  gantry(scene, registry, 15000, [{ lat: 0, mesh: textBoard(['I-5 NORTH', 'SACRAMENTO · SAN FRANCISCO'], 15, 3.4, '#046a38', '#fff') }], 7);

  // Santa Clarita → Grapevine / Tejon Pass: the dramatic mountain departure.
  cityCarpet(scene, 6110, 60000, 92000, 0.65);
  mountainWall(scene, 6111, 76000, 154000, { snow: true });
  buildTrees(scene, 6112, 82000, 151000, 18, 40, 300, 0, false, 0.85);
  gantry(scene, registry, 102000, [{ lat: 0, mesh: textBoard(['TEJON PASS', 'ELEVATION 4,144 FT', 'TRUCKS USE LOW GEAR'], 13, 3.2, '#684b20', '#fff') }], 7);

  // Bakersfield and the southern San Joaquin Valley: oil fields, orchards,
  // irrigation-green agriculture, and a noticeably high truck share.
  skyline(scene, registry, 6120, 154000, 194000, 34, 110, 300, 28, 80, [-1]);
  cityCarpet(scene, 6121, 148000, 205000, 0.7);
  orchards(scene, 6122, 195000, 235000);
  gantry(scene, registry, 181000, [{ lat: 0, mesh: textBoard(['BAKERSFIELD', 'US-99 · OIL COUNTRY'], 13, 3.2, '#046a38', '#fff') }], 7);

  // Fresno / Madera / Merced / Modesto: long flat valley sightlines with
  // orchards, vineyards and farm windbreaks instead of generic empty grass.
  orchards(scene, 6130, 235000, 385000);
  buildTrees(scene, 6131, 230000, 390000, 34, 220, 850, 0, false, 0.8);
  skyline(scene, registry, 6132, 257000, 286000, 38, 120, 300, 22, 60, [-1]);
  skyline(scene, registry, 6133, 340000, 372000, 42, 135, 300, 22, 65, [-1]);
  gantry(scene, registry, 267000, [{ lat: 0, mesh: textBoard(['FRESNO', 'CA-99 · YOSEMITE'], 13, 3.2, '#046a38', '#fff') }], 7);

  // Altamont/Pacheco approach: low Diablo foothills and a tighter, curving
  // freeway before the Bay Area urban wall begins.
  mountainWall(scene, 6140, 390000, 477000);
  buildTrees(scene, 6141, 390000, 477000, 20, 35, 260, 0, false, 0.9);
  gantry(scene, registry, 427000, [{ lat: 0, mesh: textBoard(['PACHECO PASS', 'SAN JOSE · GILROY'], 13, 3.2, '#684b20', '#fff') }], 7);

  // Silicon Valley → San Francisco: continuous development, lit towers and
  // freeway interchanges replacing the valley farms.
  cityCarpet(scene, 6150, 468000, 615000, 1.35);
  skyline(scene, registry, 6151, 470000, 535000, 24, 90, 360, 35, 150, [-1, 1]);
  skyline(scene, registry, 6152, 565000, 615000, 22, 80, 380, 40, 190, [-1, 1]);
  buildTrees(scene, 6153, 470000, 615000, 28, 40, 260, 0, false, 0.75);
  gantry(scene, registry, 515000, [{ lat: 0, mesh: textBoard(['SAN JOSE', 'US-101 · SAN FRANCISCO'], 14, 3.3, '#046a38', '#fff') }], 7);
  gantry(scene, registry, 596000, [{ lat: 0, mesh: textBoard(['SAN FRANCISCO', 'I-5 NORTH ENDS', 'US-101 · DOWNTOWN'], 14, 3.3, '#046a38', '#fff') }], 7);
  bridgeStructure(scene, 604000, 606000, [605000]);
  water(scene, 605000, 1100, 2200);
}

export { buildCaliforniaI5 };
