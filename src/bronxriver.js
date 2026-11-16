import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, elevAt, buildRibbon } from './road.js';
import {
  buildTrees, buildNoiseWall, placementsAlong, scatterInstanced,
  facadeTexture, groundY,
} from './environment.js';
import { gantry, textBoard, water, suspensionBridge, viaductPiers } from './turnpike.js';

// White Plains / Kensico → Bronx River Parkway → Bruckner Expressway →
// I-295 / Throgs Neck Bridge → Clearview Expressway → Hillside Avenue.

const BOX = new THREE.BoxGeometry(1, 1, 1);
BOX.translate(0, 0.5, 0);

function mat(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function corridorFloor(scene, s0, s1, color = 0x42533b, width = 330) {
  const material = mat(color, 1);
  for (const side of [-1, 1]) {
    const inner = s => side * (pavedHalfAt(s) + 0.8);
    const outer = () => side * width;
    scene.add(new THREE.Mesh(buildRibbon(
      side < 0 ? outer : inner, side < 0 ? inner : outer,
      s => groundY(s, side < 0 ? -width : pavedHalfAt(s) + 1) - elevAt(s) + 0.02,
      s => groundY(s, side < 0 ? -pavedHalfAt(s) - 1 : width) - elevAt(s) + 0.02,
      22, s0, s1,
    ), material));
  }
}

function riverRibbon(scene, s0, s1, side = 1) {
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x315d68, roughness: 0.24, metalness: 0.28 });
  const inner = s => side * (pavedHalfAt(s) + 12 + 5 * Math.sin(s / 700));
  const outer = s => side * (pavedHalfAt(s) + 23 + 7 * Math.sin(s / 540 + 1.2));
  scene.add(new THREE.Mesh(buildRibbon(
    side < 0 ? outer : inner, side < 0 ? inner : outer,
    -1.1, -1.1, 16, s0, s1,
  ), waterMat));
}

function houses(scene, s0, s1, seed, latMin = 65, latMax = 230) {
  const siding = [0xcac3b3, 0xd9d5cc, 0xb8c1b0, 0xb7c3cb, 0xd2bba4, 0xc5b4aa];
  const bodies = placementsAlong(seed, s0, s1, 30, latMin, latMax, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - .5) * .25,
    sx: 8 + rand() * 7, sy: 3.5 + rand() * 3, sz: 8 + rand() * 7,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, BOX, mat(0xffffff), bodies);
  scatterInstanced(scene, BOX, mat(0x493e37), bodies.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
    sx: h.sx * 1.12, sy: .55, sz: h.sz * 1.12,
  })));
}

function urbanBlocks(scene, registry, s0, s1, seed, opts = {}) {
  const { minLat = 42, maxLat = 260, height = 32, dense = true } = opts;
  const tex = facadeTexture(seed);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const material = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    color: 0xffffff, roughness: .82,
  });
  (registry.litLow ||= []).push(material);
  const palette = [0x8f6252, 0x9d6f57, 0x7e665b, 0xaaa299, 0x786d68, 0xb28a6d];
  const blocks = placementsAlong(seed, s0, s1, dense ? 18 : 32, minLat, maxLat, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - .5) * .15,
    sx: 12 + rand() * 25, sy: 8 + rand() * height, sz: 10 + rand() * 22,
    color: new THREE.Color(palette[(rand() * palette.length) | 0]),
  }), dense ? 14 : 22);
  scatterInstanced(scene, BOX, material, blocks);
}

function streetOverpass(scene, s, name, stone = false) {
  const half = pavedHalfAt(s) + 16;
  const group = new THREE.Group();
  const deckMat = mat(stone ? 0x827a69 : 0x777b7d, .95);
  const steel = mat(0x39434a, .68, .32);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.15, 12), deckMat);
  deck.position.y = 7.15;
  group.add(deck);
  for (const x of [-half + 1, -pavedHalfAt(s) - 2, pavedHalfAt(s) + 2, half - 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(stone ? 2.2 : 1.35, 7.2, stone ? 2.2 : 1.35), deckMat);
    pier.position.set(x, 3.6, 0);
    group.add(pier);
  }
  for (const z of [-5.8, 5.8]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.1, .28), stone ? deckMat : steel);
    rail.position.set(0, 8.2, z);
    group.add(rail);
  }
  if (name) {
    const board = textBoard([name], Math.min(7.5, 2.8 + name.length * .28), 1.25, '#145c38', '#ffffff');
    board.position.set(0, 8.45, -6.02);
    group.add(board);
  }
  group.position.copy(posAt(s, 0, new THREE.Vector3()));
  group.position.y = elevAt(s);
  group.rotation.y = headingAt(s);
  scene.add(group);
}

function routeGantry(scene, registry, s, lines, lat = -7, width = 11) {
  const front = textBoard(lines, width, 3.7, '#075a39', '#ffffff');
  const back = textBoard(lines, width, 3.7, '#075a39', '#ffffff');
  back.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat, mesh: front }, { lat: -lat, mesh: back }], 7.1);
}

function cashlessGantry(scene, registry, s) {
  const board = textBoard(['E-ZPASS  ·  TOLLS BY MAIL', 'CASHLESS TOLLING'], 15, 3.4, '#175f3b', '#ffffff');
  const back = textBoard(['THROGS NECK BRIDGE', 'BRONX · WESTCHESTER'], 15, 3.4, '#175f3b', '#ffffff');
  back.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -7, mesh: board }, { lat: 7, mesh: back }], 7.7);
}

function elevatedDeck(scene, s0, s1) {
  const concrete = mat(0x858784, .95);
  scene.add(new THREE.Mesh(buildRibbon(
    s => -pavedHalfAt(s) - 1, s => pavedHalfAt(s) + 1,
    -1.35, -1.35, 12, s0, s1,
  ), concrete));
  viaductPiers(scene, s0, s1);
}

function kensicoDam(scene) {
  const s = 350;
  const group = new THREE.Group();
  const stone = mat(0xa9a394, .98);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(145, 25, 7), stone);
  wall.position.y = 12.5;
  group.add(wall);
  for (let x = -62; x <= 62; x += 15.5) {
    const buttress = new THREE.Mesh(new THREE.BoxGeometry(5.5, 20, 10), stone);
    buttress.position.set(x, 10, 2);
    group.add(buttress);
  }
  group.position.copy(posAt(s, -150, new THREE.Vector3()));
  group.position.y = groundY(s, -150);
  group.rotation.y = headingAt(s);
  scene.add(group);
}

export function buildBronxRiver(scene, registry) {
  // No uncovered land: every section gets a floor before detail layers.
  corridorFloor(scene, 0, 20000, 0x3f5638, 420);
  corridorFloor(scene, 20000, 35000, 0x455044, 340);
  corridorFloor(scene, 35000, 41000, 0x5b5853, 420);
  corridorFloor(scene, 44500, 53000, 0x55544f, 360);

  kensicoDam(scene);
  riverRibbon(scene, 1100, 19800, 1);
  riverRibbon(scene, 20200, 32800, -1);

  // Westchester: layered woodland at the shoulder, deep suburbia behind it.
  for (const [s0, s1, seed] of [[0, 5000, 8100], [5000, 13000, 8200], [13000, 20000, 8300]]) {
    buildTrees(scene, seed, s0, s1, 9, 8, 72, 0);
    buildTrees(scene, seed + 1, s0, s1, 12, 55, 230, 0);
    buildTrees(scene, seed + 2, s0, s1, 15, 90, 360, 0, true);
    houses(scene, s0, s1, seed + 3);
  }
  // Tall roadside screening plus the dense tree layers makes Westchester a
  // continuous green tunnel and hides the exposed hillside beyond.
  buildNoiseWall(scene, 700, 16500, { seed: 8370, height: 7.4, step: 9, margin: 3.8, gapChance: .008 });
  buildNoiseWall(scene, 16500, 20500, { seed: 8380, height: 8.1, step: 9, margin: 4, gapChance: .012 });

  const westchesterBridges = [
    [1900, 'VIRGINIA ROAD'], [3900, 'MAIN STREET'], [6100, 'GREENACRES AVE'],
    [8200, 'FENIMORE ROAD'], [10500, 'CRANE ROAD'], [12800, 'POPHAM ROAD'],
    [15100, 'OAK STREET'], [17800, 'CROSS COUNTY PKWY'], [19600, 'YONKERS AVE'],
  ];
  westchesterBridges.forEach(([s, name]) => streetOverpass(scene, s, name, true));

  // Bronx: walls and trees remain close, while the building mass rises behind.
  buildNoiseWall(scene, 20000, 35000, { seed: 8400, height: 6.4, step: 8, margin: 3.6, gapChance: .018 });
  buildTrees(scene, 8410, 20000, 33000, 11, 9, 70, 0);
  buildTrees(scene, 8411, 20000, 33000, 14, 52, 155, 0);
  urbanBlocks(scene, registry, 20000, 27000, 8420, { minLat: 75, maxLat: 290, height: 34 });
  urbanBlocks(scene, registry, 27000, 35000, 8430, { minLat: 52, maxLat: 310, height: 48 });
  [
    [21500, 'E 233 STREET'], [23900, 'E 222 STREET'], [25800, 'GUN HILL ROAD'],
    [27600, 'PELHAM PARKWAY'], [29100, 'FORDHAM ROAD'], [30900, 'I-95 · CROSS BRONX'],
    [32100, 'E 174 STREET'], [33700, 'STORY AVENUE'],
  ].forEach(([s, name]) => streetOverpass(scene, s, name));

  // Bruckner: a dense, highly bridged urban connector.
  buildNoiseWall(scene, 34500, 41000, { seed: 8500, height: 7.2, step: 8, margin: 4, gapChance: .01 });
  urbanBlocks(scene, registry, 34500, 41000, 8510, { minLat: 42, maxLat: 350, height: 54 });
  elevatedDeck(scene, 35200, 38700);
  [35050, 35800, 36650, 37400, 38200, 39700, 40500].forEach((s, i) =>
    streetOverpass(scene, s, ['BRUCKNER BLVD', 'CASTLE HILL AVE', 'ZEREGA AVE', 'WESTCHESTER AVE', 'I-95 / I-678', 'PENNYFIELD AVE', 'HARDING AVE'][i]));
  routeGantry(scene, registry, 33900, ['BRONX RIVER PKWY ENDS', 'I-278 EAST · BRUCKNER EXPWY'], -6.5, 14);
  routeGantry(scene, registry, 38600, ['I-295 SOUTH · THROGS NECK BR', 'QUEENS · LONG ISLAND'], -7, 14);

  // Throgs Neck: long approaches, cashless tolling, water and suspension span.
  water(scene, 42750, 5200, 1800);
  // The approach viaducts are long, but the suspended portion is compact:
  // roughly a 550 m main span between the two steel towers.
  suspensionBridge(scene, 41700, 43900, 42400, 43000, 61);
  elevatedDeck(scene, 40600, 44600);
  cashlessGantry(scene, registry, 40750);
  routeGantry(scene, registry, 44480, ['I-295 SOUTH · CLEARVIEW EXPWY', 'I-495 · EASTERN LONG ISLAND'], -7, 15);

  // Queens: continuous walls, houses and apartment blocks over the cut.
  buildNoiseWall(scene, 44500, 53000, { seed: 8600, height: 7.8, step: 8, margin: 3.2, gapChance: .012 });
  houses(scene, 44500, 53000, 8610, 48, 210);
  urbanBlocks(scene, registry, 44500, 53000, 8620, { minLat: 120, maxLat: 360, height: 28 });
  buildTrees(scene, 8630, 44500, 53000, 12, 35, 130, 0);
  [
    [45100, 'CROSS ISLAND PKWY'], [46200, '35 AVENUE'], [47400, 'NORTHERN BLVD'],
    [48400, '73 AVENUE'], [49300, 'I-495 · L.I.E.'], [50300, 'UNION TURNPIKE'],
    [51400, 'GRAND CENTRAL PKWY'], [52500, 'HILLSIDE AVENUE'],
  ].forEach(([s, name]) => streetOverpass(scene, s, name));
  routeGantry(scene, registry, 48650, ['EXIT 4 · I-495', 'L.I.E. · MANHATTAN · EASTERN L.I.'], -7, 15);
  routeGantry(scene, registry, 52050, ['I-295 ENDS · 1 MILE', 'HILLSIDE AVE · NY 25'], -7, 13);

}
