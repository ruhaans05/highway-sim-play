import * as THREE from 'three';
import { LOOP_LENGTH, wrapS } from './config.js';
import { posAt, headingAt } from './road.js';
import { groundY } from './environment.js';
import { textBoard, gantry, welcomeSign } from './turnpike.js';

// Mumbai–Bengaluru is a working freight corridor, not an empty scenic spline.
// This builder keeps the long route legible: dense Indian metros, sugarcane and
// dry Deccan farmland, Western Ghats relief, toll-road furniture and local
// roadside texture all change with the real corridor.
function rng(seed) {
  let x = seed >>> 0;
  return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
}

function placeBox(scene, s, lat, w, h, d, color, rot = 0) {
  const p = posAt(s, lat, new THREE.Vector3());
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: .92 }));
  m.position.set(p.x, groundY(s, lat) + h / 2, p.z);
  m.rotation.y = headingAt(s) + rot;
  m.castShadow = true; m.receiveShadow = true; scene.add(m);
}

function building(scene, s, lat, rand, urban = 1) {
  const floors = 1 + Math.floor(rand() * (urban > 1.5 ? 7 : urban > 1 ? 4 : 2));
  const palette = [0xd5b38a, 0xb87855, 0xc9c2ae, 0x8fa9a2, 0xd9d0bb];
  placeBox(scene, s, lat, 9 + rand() * 14, floors * (2.6 + rand()), 8 + rand() * 12,
    palette[Math.floor(rand() * palette.length)], (rand() - .5) * .12);
  if (floors >= 3 && rand() < .55) placeBox(scene, s + 2, lat + (rand() - .5) * 4, 10, .28, 9, 0x9c3d2d);
}

function city(scene, s0, s1, seed, density = 1.4) {
  const rand = rng(seed);
  const step = density > 1.7 ? 145 : 220;
  for (let s = s0; s < s1; s += step) {
    for (const side of [-1, 1]) {
      const count = Math.max(1, Math.round(density * (0.8 + rand() * 1.3)));
      for (let i = 0; i < count; i++) building(scene, s + rand() * 100, side * (42 + rand() * 110), rand, density);
    }
  }
}

function trees(scene, s0, s1, seed, density, color = 0x2f6b43) {
  const rand = rng(seed);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x604532, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const trunk = new THREE.CylinderGeometry(.18, .32, 3.6, 7);
  const crown = new THREE.SphereGeometry(1.8, 7, 5);
  for (let s = s0; s < s1; s += 48 / Math.max(.35, density)) {
    for (const side of [-1, 1]) if (rand() < density) {
      const lat = side * (40 + rand() * 125);
      const p = posAt(s + rand() * 20, lat, new THREE.Vector3());
      const y = groundY(s, lat);
      const t = new THREE.Mesh(trunk, trunkMat); t.position.set(p.x, y + 1.8, p.z); scene.add(t);
      const c = new THREE.Mesh(crown, crownMat); c.position.set(p.x, y + 4.7 + rand() * 1.2, p.z); c.scale.setScalar(.7 + rand() * .9); scene.add(c);
    }
  }
}

function fields(scene, s0, s1, seed, crop = 0x5d8b3b) {
  const rand = rng(seed);
  const mat = new THREE.MeshStandardMaterial({ color: crop, roughness: 1 });
  for (let s = s0; s < s1; s += 115) for (const side of [-1, 1]) {
    if (rand() < .2) continue;
    const p = posAt(s, side * (72 + rand() * 80), new THREE.Vector3());
    const h = .25 + rand() * .55;
    const row = new THREE.Mesh(new THREE.BoxGeometry(28 + rand() * 30, h, 3.2), mat);
    row.position.set(p.x, groundY(s, side * 90) + h / 2, p.z);
    row.rotation.y = headingAt(s); scene.add(row);
  }
}

function ghats(scene) {
  const rand = rng(4801);
  const rock = new THREE.MeshStandardMaterial({ color: 0x4b5c46, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x756b5a, roughness: 1 });
  for (let s = 70000; s < 158000; s += 420) for (const side of [-1, 1]) {
    const lat = side * (150 + rand() * 170);
    const p = posAt(s, lat, new THREE.Vector3());
    const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(34 + rand() * 35, 1), rand() < .72 ? rock : stone);
    mound.position.set(p.x, groundY(s, lat) + 18 + rand() * 22, p.z);
    mound.scale.set(1.6 + rand(), .75 + rand() * .7, .65 + rand() * .8);
    mound.rotation.y = rand() * Math.PI; scene.add(mound);
  }
  trees(scene, 82000, 150000, 4891, 1.4, 0x285c3b);
}

function board(scene, registry, s, lines) {
  const a = textBoard(lines, 8.2, 3.1, '#08733e', '#fff');
  const b = textBoard(lines, 8.2, 3.1, '#08733e', '#fff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -5.4, mesh: a }, { lat: 5.4, mesh: b }], 6.8);
}

export function buildNH48(scene, registry) {
  board(scene, registry, 1800, ['NH 48', 'BENGALURU', 'PUNE · KOLHAPUR']);
  board(scene, registry, 1016000, ['NH 48', 'MUMBAI', 'TUMAKURU · HUBBALLI']);
  welcomeSign(scene, registry, 432000, 1, ['WELCOME TO', 'KARNATAKA', 'NH 48'], '#c33b2c');
  welcomeSign(scene, registry, 428000, -1, ['WELCOME TO', 'MAHARASHTRA', 'NH 48'], '#1d5d9a');

  // Urbanization follows the corridor rather than filling every rural mile.
  city(scene, 0, 90000, 4801, 2.1);             // Mumbai–Navi Mumbai–Panvel
  city(scene, 138000, 205000, 4802, 1.8);       // Pune / PCMC fringe
  city(scene, 360000, 430000, 4803, 1.15);      // Kolhapur
  city(scene, 470000, 535000, 4804, 1.25);      // Belagavi
  city(scene, 535000, 610000, 4805, 1.35);      // Dharwad–Hubballi
  city(scene, 690000, 800000, 4806, 1.05);      // Davanagere–Chitradurga
  city(scene, 800000, 930000, 4807, .9);         // Tumakuru / ribbon development
  city(scene, 930000, 1020000, 4808, 2.0);      // Bengaluru approach

  ghats(scene);
  fields(scene, 180000, 360000, 4810, 0x5d913d); // Maharashtra sugar belt
  fields(scene, 430000, 690000, 4811, 0x8c883b); // north Karnataka dry farmland
  fields(scene, 690000, 930000, 4812, 0x9a8e4d); // Davanagere–Tumakuru plateau
  trees(scene, 0, 70000, 4813, .8, 0x397447);
  trees(scene, 160000, 430000, 4814, .65, 0x477845);
  trees(scene, 470000, 610000, 4815, .62, 0x4d7141);
  trees(scene, 930000, LOOP_LENGTH, 4816, .9, 0x35633f);
}
