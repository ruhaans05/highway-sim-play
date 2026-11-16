import * as THREE from 'three';
import { buildRibbon, pavedHalfAt, posAt } from '../road.js';
import { groundY, scatterInstanced, buildTrees, buildBillboards } from '../environment.js';
import { textBoard, gantry } from '../turnpike.js';
import {
  urbanTerrain, frontageNetwork, parcelCity, overpassGrid,
  minorOverpassGrid, wallAndTreeScreen, railCorridor, seeded,
} from './primitives.js';

const CINCY_ADS = [
  ['SKYLINE CHILI', '#1b4fa0', '#ffd23d'], ["GRAETER'S ICE CREAM", '#0d6b3f', '#ffffff'],
  ['CINCINNATI REDS', '#c8102e', '#ffffff'], ['KINGS ISLAND · EXIT 24', '#0d6b3f', '#ffd23d'],
  ['IKEA · WEST CHESTER', '#0051ba', '#ffda1a'], ['TRUCK SERVICE · I-75', '#d98218', '#111111'],
];

function stackInterchange(scene, registry) {
  const s0 = 132200, s1 = 139000;
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x292c2e, roughness: 0.96 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x62696d, roughness: 0.72, metalness: 0.3 });
  for (const side of [-1, 1]) {
    const lateral = s => {
      const t = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
      return side * (pavedHalfAt(s) + 8 + 48 * Math.sin(Math.PI * t));
    };
    const rise = s => {
      const t = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
      return 13 * Math.sin(Math.PI * t);
    };
    scene.add(new THREE.Mesh(buildRibbon(
      s => lateral(s) - 4.1, s => lateral(s) + 4.1,
      s => rise(s), s => rise(s), 15, s0, s1,
    ), asphalt));
    scene.add(new THREE.Mesh(buildRibbon(
      s => lateral(s) - 4.55, s => lateral(s) - 4.05,
      s => rise(s) - 2.0, s => rise(s) + 0.25, 15, s0, s1,
    ), steel));
  }
  gantry(scene, registry, 133100, [
    { lat: -6, mesh: textBoard(['I-75 NORTH', 'DAYTON', 'LEFT 2 LANES'], 11, 3.4, '#0d6b3f', '#ffffff') },
    { lat: 6, mesh: textBoard(['I-75 SOUTH', 'DOWNTOWN · LEXINGTON', 'RIGHT LANES'], 11, 3.4, '#0d6b3f', '#ffffff') },
  ], 7.4);
  gantry(scene, registry, 137200, [{ lat: 0, mesh: textBoard([
    'I-75 NORTH', 'MILL CREEK · SHARONVILLE', 'THRU TRAFFIC',
  ], 14, 3.6, '#0d6b3f', '#ffffff') }], 7.3);
}

function millCreekIndustry(scene, s0, s1, seed) {
  const rand = seeded(seed);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const plants = [];
  for (let s = s0; s < s1; s += 95 + rand() * 65) {
    for (const side of [-1, 1]) {
      const lat = side * (95 + rand() * 310);
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      plants.push({
        pos: p, rot: rand() * 0.25,
        sx: 45 + rand() * 90, sy: 8 + rand() * 16, sz: 30 + rand() * 72,
        color: new THREE.Color([0x8e8980, 0xaaa79e, 0x726c67, 0x9a785f][(rand() * 4) | 0]),
      });
    }
  }
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), plants);
}

export function buildCincinnati(scene, registry) {
  const hills = [0x4c5147, 0x52564a, 0x5d594e, 0x494f46];
  urbanTerrain(scene, 125000, 138000, 1100, 3401, hills, { step: 54, bands: 9 });
  frontageNetwork(scene, 125000, 138000, { offset: 24 });
  parcelCity(scene, registry, 125000, 138000, 3402, {
    rows: 5, step: 18, rowGap: 78, hMin: 6, hRange: 20,
    colors: [0x9a6a55, 0xb4a793, 0x8d8175, 0x788083, 0xaaa79e],
  });
  buildTrees(scene, 3403, 125000, 138000, 16, 45, 520, 170, true);
  for (const [a, b, seed] of [[125100, 128500, 3410], [129100, 132100, 3412], [135300, 137900, 3414]]) {
    wallAndTreeScreen(scene, a, b, seed, { gapChance: 0.06, treeWidth: 400, treeCount: 115 });
  }
  overpassGrid(scene, registry, [
    [126500, 'HARRISON AVE'], [129500, 'RYBOLT RD'], [131500, 'MONTANA AVE'],
    [133100, 'ELMORE ST'], [134500, 'I-75 SOUTH'], [136200, 'MITCHELL AVE'],
  ], { roadWidth: 17 });
  minorOverpassGrid(scene, 125000, 138000, 190, 3416);
  stackInterchange(scene, registry);

  // Mill Creek: continuous industrial valley and multiple rail corridors.
  const mill = [0x484b49, 0x53524d, 0x5e5850, 0x424748];
  urbanTerrain(scene, 138000, 147500, 1200, 3420, mill, { step: 50, bands: 9 });
  frontageNetwork(scene, 138000, 147500, { offset: 27 });
  parcelCity(scene, registry, 138000, 147500, 3421, {
    rows: 5, step: 20, rowGap: 90, industrial: true, hMin: 8, hRange: 18,
  });
  millCreekIndustry(scene, 138000, 147500, 3422);
  railCorridor(scene, 138000, 147500, -210, 3423);
  railCorridor(scene, 138500, 147200, 270, 3424);
  overpassGrid(scene, registry, [
    [139500, 'HOPPLE ST'], [142700, 'MITCHELL AVE'], [144350, 'NORWOOD LATERAL'], [147200, 'PADDOCK RD'],
  ], { roadWidth: 18 });
  minorOverpassGrid(scene, 138000, 147500, 210, 3429);
  wallAndTreeScreen(scene, 138100, 141600, 3425, { gapChance: 0.08 });
  wallAndTreeScreen(scene, 142000, 147300, 3427, { gapChance: 0.1 });

  // Sharonville, West Chester and Mason: continuous but low suburban fabric.
  const northSuburb = [0x55564f, 0x5d5b53, 0x4f5452, 0x626057];
  urbanTerrain(scene, 147500, 180000, 1150, 3430, northSuburb, { step: 62, bands: 9 });
  frontageNetwork(scene, 147500, 180000, { offset: 25 });
  parcelCity(scene, registry, 147500, 180000, 3431, {
    rows: 5, step: 24, rowGap: 88, hMin: 5, hRange: 15,
    colors: [0xb4b1a7, 0xa5abad, 0x8b8177, 0xc0b9aa, 0x7c898e],
  });
  buildTrees(scene, 3432, 147500, 180000, 22, 55, 420, 115);
  for (const [a, b, seed] of [
    [148000, 152500, 3440], [153100, 157900, 3442], [159700, 164700, 3444],
    [165600, 170900, 3446], [172000, 177600, 3448],
  ]) wallAndTreeScreen(scene, a, b, seed, { gapChance: 0.12, treeCount: 90 });
  overpassGrid(scene, registry, [
    [149200, 'GALBRAITH RD'], [154000, 'SHARON RD'], [158830, 'I-275'],
    [163660, 'UNION CENTRE BLVD'], [166880, 'CINCINNATI-DAYTON RD'],
    [171700, 'TYLERSVILLE RD'], [176500, 'MASON · KINGS ISLAND'],
  ], { roadWidth: 17 });
  minorOverpassGrid(scene, 147500, 180000, 250, 3452);
  buildBillboards(scene, registry, 3450, 125000, 179000, 28, CINCY_ADS);
}
