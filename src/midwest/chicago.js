import * as THREE from 'three';
import { posAt, headingAt } from '../road.js';
import { groundY, scatterInstanced, buildTrees, buildBillboards } from '../environment.js';
import { textBoard, gantry } from '../turnpike.js';
import {
  seeded, urbanTerrain, frontageNetwork, parcelCity, overpassGrid,
  minorOverpassGrid, wallAndTreeScreen, railCorridor, tollArea, twoLaneConnector, groundStrip,
} from './primitives.js';

const SOUTH_CHICAGO_ADS = [
  ['CHICAGO SOUTHLAND', '#1b4f8a', '#ffffff'], ['I-PASS · PAY ONLINE', '#135f36', '#ffffff'],
  ['WHITE SOX', '#111111', '#c4ced4'], ['GARY WORKS', '#555b60', '#ffffff'],
  ['HAMMOND · NEXT EXITS', '#0d6b3f', '#ffffff'], ['TRUCK SERVICE · 24 HR', '#d98218', '#111111'],
];

function industrialHardware(scene, s0, s1, seed) {
  const rand = seeded(seed);
  const tankGeo = new THREE.CylinderGeometry(1, 1, 1, 14); tankGeo.translate(0, 0.5, 0);
  const stackGeo = new THREE.CylinderGeometry(1, 1.3, 1, 10); stackGeo.translate(0, 0.5, 0);
  const tanks = [], stacks = [];
  for (let s = s0; s < s1; s += 105 + rand() * 85) {
    for (const side of [-1, 1]) {
      const lat = side * (145 + rand() * 520);
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      tanks.push({ pos: p, rot: 0, sx: 8 + rand() * 16, sy: 8 + rand() * 16, sz: 8 + rand() * 16 });
      if (rand() < 0.38) {
        const q = posAt(s + 25, lat + side * 50, new THREE.Vector3()); q.y = groundY(s + 25, lat + side * 50);
        stacks.push({ pos: q, rot: 0, sx: 2.5 + rand() * 2.5, sy: 35 + rand() * 55, sz: 2.5 + rand() * 2.5 });
      }
    }
  }
  scatterInstanced(scene, tankGeo,
    new THREE.MeshStandardMaterial({ color: 0xb7bdbe, roughness: 0.55, metalness: 0.35 }), tanks);
  scatterInstanced(scene, stackGeo,
    new THREE.MeshStandardMaterial({ color: 0x854a3e, roughness: 0.88 }), stacks);
}

function mileLongBridgeContext(scene) {
  // The road elevation comes from road.js. Below it, canals, rail and working
  // industrial land prevent the bridge from floating over a blank plane.
  groundStrip(scene, 1700, 4400, s => 190, 72, 0x24485a, { lift: -0.12, step: 22 });
  railCorridor(scene, 1200, 5100, -150, 2921);
  railCorridor(scene, 1500, 4800, 245, 2922);
}

export function buildChicagoSouthland(scene, registry) {
  const residential = [0x57544d, 0x605c54, 0x4d5150, 0x625b51];
  const industrial = [0x4a4b48, 0x505150, 0x5c5850, 0x44484a];

  // I-294 south: dense suburbs and employment land, never a downtown tour.
  urbanTerrain(scene, 0, 8000, 1150, 2901, residential);
  frontageNetwork(scene, 0, 8000, { offset: 24 });
  parcelCity(scene, registry, 0, 8000, 2902, { rows: 5, step: 18, rowGap: 82, hMin: 6, hRange: 17 });
  mileLongBridgeContext(scene);
  overpassGrid(scene, registry, [
    [650, 'I-290 WEST · SCHAUMBURG'], [1350, 'GOLF RD'], [5100, '95TH ST'], [6750, '127TH ST'],
  ]);
  minorOverpassGrid(scene, 0, 8000, 165, 2909);
  wallAndTreeScreen(scene, 200, 1500, 2910, { gapChance: 0.05, treeCount: 75 });
  wallAndTreeScreen(scene, 4700, 7900, 2912, { gapChance: 0.08, treeCount: 95 });

  // I-57 / Markham: large interchange and the real southern tollway context.
  urbanTerrain(scene, 8000, 17000, 1200, 2920, residential);
  frontageNetwork(scene, 8000, 17000, { offset: 27 });
  parcelCity(scene, registry, 8000, 17000, 2923, { rows: 5, step: 19, industrialAfter: 11200, rowGap: 86 });
  overpassGrid(scene, registry, [
    [8700, 'I-57'], [10400, '147TH ST'], [12100, '159TH ST'], [15800, 'DIXIE HWY'],
  ], { roadWidth: 18 });
  tollArea(scene, registry, 13600, { title: 'MARKHAM · 163RD STREET TOLL PLAZA' });
  minorOverpassGrid(scene, 8000, 17000, 180, 2927);
  gantry(scene, registry, 8200, [
    { lat: -6, mesh: textBoard(['I-57 NORTH', 'CHICAGO', 'LEFT 2 LANES'], 10.5, 3.3, '#0d6b3f', '#ffffff') },
    { lat: 6, mesh: textBoard(['I-294 SOUTH', 'INDIANA', 'THRU TRAFFIC'], 10.5, 3.3, '#0d6b3f', '#ffffff') },
  ], 7.3);
  wallAndTreeScreen(scene, 9000, 13000, 2924, { gapChance: 0.08 });
  wallAndTreeScreen(scene, 14300, 16900, 2926, { gapChance: 0.08 });

  // Southern I-294 bends onto I-80. Low/mid-rise Southland remains continuous.
  urbanTerrain(scene, 17000, 27000, 1250, 2930, residential);
  frontageNetwork(scene, 17000, 27000, { offset: 25 });
  parcelCity(scene, registry, 17000, 27000, 2931, { rows: 5, step: 19, rowGap: 84, industrialAfter: 22000 });
  railCorridor(scene, 17200, 26800, -285, 2932);
  overpassGrid(scene, registry, [
    [18000, 'I-80 WEST'], [19900, 'HALSTED ST'], [22000, 'WOOD ST'], [24400, 'IL-394'], [26100, 'STATE LINE RD'],
  ]);
  minorOverpassGrid(scene, 17000, 27000, 185, 2937);
  wallAndTreeScreen(scene, 17100, 19700, 2933, { gapChance: 0.1 });
  wallAndTreeScreen(scene, 22400, 26600, 2935, { gapChance: 0.12 });

  // I-80/I-294 and Borman: nearly unbroken industrial/rail/warehouse fabric.
  urbanTerrain(scene, 27000, 48000, 1350, 2940, industrial);
  frontageNetwork(scene, 27000, 48000, { offset: 28, streetColor: 0x2d3032 });
  parcelCity(scene, registry, 27000, 48000, 2941, {
    rows: 5, step: 22, rowGap: 94, industrial: true, hMin: 7, hRange: 16,
    colors: [0x8d8f8d, 0xaaa79f, 0x756c64, 0x697276, 0x9a8b78],
  });
  railCorridor(scene, 27000, 48000, -240, 2942);
  railCorridor(scene, 29500, 47200, 315, 2943);
  industrialHardware(scene, 28500, 47500, 2944);
  buildTrees(scene, 2945, 27000, 48000, 20, 46, 260, 70);
  overpassGrid(scene, registry, [
    [28200, 'TORRENCE AVE'], [30300, 'CALUMET AVE'], [32300, 'INDIANAPOLIS BLVD'],
    [34400, 'KENNEDY AVE'], [36500, 'BURR ST'], [38700, 'CLINE AVE · SR-912'],
    [40900, 'GRANT ST'], [43100, 'BROADWAY'], [45400, 'RIPLEY ST'],
  ], { roadWidth: 17 });
  minorOverpassGrid(scene, 27000, 48000, 230, 2958);
  for (const [a, b, seed] of [[27400, 30200, 2950], [31100, 35600, 2952], [36900, 40500, 2954], [41700, 47000, 2956]]) {
    wallAndTreeScreen(scene, a, b, seed, { gapChance: 0.09, treeCount: 70 });
  }

  // Full directional bridge handoff. Both reciprocal movements are visible.
  urbanTerrain(scene, 48000, 53500, 1250, 2960, industrial);
  parcelCity(scene, registry, 48000, 53500, 2961, { rows: 5, step: 18, industrial: true, rowGap: 92 });
  railCorridor(scene, 48000, 53500, 290, 2962);
  twoLaneConnector(scene, registry, 46800, 52800, { spread: 36, rise: 4.5 });
  overpassGrid(scene, registry, [[48600, 'I-65 SOUTH'], [51600, 'US-12 / US-20']], { roadWidth: 19 });

  buildBillboards(scene, registry, 2965, 0, 52500, 34, SOUTH_CHICAGO_ADS);
}
