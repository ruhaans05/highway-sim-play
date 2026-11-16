import * as THREE from 'three';
import { posAt, headingAt } from '../road.js';
import { groundY, scatterInstanced, buildTrees, buildBillboards } from '../environment.js';
import { textBoard, gantry } from '../turnpike.js';
import {
  urbanTerrain, frontageNetwork, parcelCity, overpassGrid,
  minorOverpassGrid, wallAndTreeScreen, railCorridor, seeded,
} from './primitives.js';

const INDY_ADS = [
  ['INDIANAPOLIS COLTS', '#0b2343', '#ffffff'], ['INDY 500 · MAY', '#c8342a', '#ffffff'],
  ['AIRPORT · I-70', '#123a7a', '#ffffff'], ['DISTRIBUTION SPACE', '#555b60', '#ffffff'],
  ['I-74 EAST · CINCINNATI', '#0d6b3f', '#ffffff'], ['TRUCK PARKING', '#d98218', '#111111'],
];

function briefSkyline(scene, registry) {
  // A short, distant right-side glimpse only. The bypass foreground remains
  // low-rise and the towers disappear behind walls/trees within a few seconds.
  const rand = seeded(3301);
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const places = [];
  for (let i = 0; i < 11; i++) {
    const s = 84600 + rand() * 850;
    const lat = -(650 + rand() * 260);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    places.push({ pos: p, rot: headingAt(s), sx: 18 + rand() * 24, sy: 42 + rand() * 80, sz: 17 + rand() * 22 });
  }
  const mesh = scatterInstanced(scene, geo,
    new THREE.MeshStandardMaterial({ color: 0xa8b2b8, roughness: 0.45, metalness: 0.25 }), places);
  mesh.userData.indyBriefSkyline = true;
}

export function buildIndianapolis(scene, registry) {
  const metro = [0x53534e, 0x5b5952, 0x4d5151, 0x625d54];
  urbanTerrain(scene, 79000, 95000, 1200, 3310, metro, { step: 62, bands: 9 });
  frontageNetwork(scene, 79000, 95000, { offset: 26 });
  parcelCity(scene, registry, 79000, 95000, 3311, {
    rows: 5, step: 22, rowGap: 88, hMin: 6, hRange: 16,
    colors: [0xa6aaab, 0xb7b3a9, 0x8d8278, 0x7f8c91, 0x9a755f],
  });
  railCorridor(scene, 80500, 94400, 305, 3312);
  buildTrees(scene, 3313, 79000, 95000, 18, 45, 390, 125);

  for (const [a, b, seed] of [
    [79100, 81600, 3320], [82000, 84800, 3322], [85200, 87900, 3324],
    [88400, 91300, 3326], [91900, 94700, 3328],
  ]) wallAndTreeScreen(scene, a, b, seed, { gapChance: 0.08, treeCount: 90 });

  overpassGrid(scene, registry, [
    [79600, 'I-865 / I-465'], [80800, '71ST ST'], [82100, '56TH ST'], [83400, '38TH ST'],
    [84700, 'I-74 · CRAWFORDSVILLE RD'], [86000, '10TH ST'], [87300, 'I-70 · ST LOUIS'],
    [88600, 'US-40 · AIRPORT'], [89900, 'KENTUCKY AVE'], [91200, 'US-31 SOUTH'],
    [92500, 'I-74 EAST'], [93900, 'SOUTHPORT RD'],
  ], { roadWidth: 17 });
  minorOverpassGrid(scene, 79000, 95000, 240, 3331);

  for (const [s, lines] of [
    [80300, ['I-465 SOUTH', 'AIRPORT · I-70', 'INDIANAPOLIS BYPASS']],
    [84200, ['I-74 WEST', 'PEORIA', 'RIGHT 2 LANES']],
    [86900, ['I-70', 'ST LOUIS · DAYTON', 'KEEP LEFT']],
    [91600, ['I-74 EAST', 'SHELBYVILLE · CINCINNATI', 'THRU TRAFFIC']],
  ]) gantry(scene, registry, s, [{ lat: 0, mesh: textBoard(lines, 14, 3.5, '#0d6b3f', '#ffffff') }], 7.2);

  briefSkyline(scene, registry);
  buildBillboards(scene, registry, 3330, 79000, 95000, 24, INDY_ADS);
}
