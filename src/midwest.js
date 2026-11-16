import * as THREE from 'three';
import { LOOP_LENGTH, LANE_WIDTH, laneWidthAt } from './config.js';
import {
  posAt, headingAt, pavedHalfAt, medianHalfAt, njGapAt, buildRibbon,
  latForLane, usableLanesAt, WORK_ZONES,
} from './road.js';
import {
  buildTrees, buildBillboards, buildSuburb, scatterInstanced, placementsAlong,
  groundY, clampOffRoad, facadeTexture, roadClearAt, deepSprawl, lowLitMaterial, buildNoiseWall,
} from './environment.js';
import { welcomeSign, buildTollPlaza, textBoard, addSkyGlow, gantry } from './turnpike.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const MIDWEST_ADS = [
  ['PURDUE · EXIT 193', '#000000', '#cfb991'], ['BOILER UP!', '#cfb991', '#111'],
  ['INDIANAPOLIS COLTS', '#0b2343', '#fff'], ['INDY 500 · MAY', '#c8342a', '#fff'],
  ['SKYLINE CHILI', '#1b4fa0', '#ffd23d'], ['CINCINNATI REDS', '#c8102e', '#fff'],
  ['BENGALS · WHO DEY', '#fb4f14', '#111'], ["GRAETER'S ICE CREAM", '#0d6b3f', '#fff'],
  ['GAS · FOOD · LODGING', '#0d6b3f', '#fff'], ['FIREWORKS · EXIT', '#ffd23d', '#c8342a'],
  ["McDONALD'S · NEXT EXIT", '#d91e18', '#ffcc00'], ['CASEY’S · 24 HOURS', '#e31837', '#ffffff'],
  ["CULVER'S · BUTTERBURGERS", '#00529b', '#f6d044'], ['MENARDS · SAVE BIG MONEY', '#e31837', '#ffffff'],
  ['MEIJER · FOOD · GAS', '#005daa', '#ffffff'], ["LOVE'S · TRAVEL STOP", '#f58220', '#ffffff'],
];

const CHICAGO_ADS = [
  ['CHICAGO BEARS · DA BEARS', '#0b162a', '#c83803'], ['CHICAGO CUBS · WRIGLEY', '#0e3386', '#fff'],
  ['CHICAGO BULLS', '#ce1141', '#111'], ['WHITE SOX · SOUTH SIDE', '#000000', '#c4ced4'],
  ['MALÖRT · SURVIVE IT', '#e0b100', '#111'], ['DEEP DISH · LOU MALNATI', '#c8102e', '#ffd23d'],
  ['GARRETT POPCORN', '#c8102e', '#fff'], ['GOOSE ISLAND 312', '#1b6a3c', '#fff'],
  ['SOUTH SIDE · CHICAGO', '#0b3d91', '#fff'], ['BORMAN · EXPECT DELAYS', '#f2a900', '#111'],
];

// ---------------------------------------------------------------------------
// Farm country: red barns, grain silos, sparse windbreak trees. The crop-field
// striping comes from the terrain shader (flat farmland zones).
// ---------------------------------------------------------------------------
function buildFarmland(scene, registry, seed, s0, s1) {
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
  const barnMat = new THREE.MeshStandardMaterial({ color: 0x8e3b2e, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x666a70, roughness: 0.8 });
  const barns = placementsAlong(seed, s0, s1, 320, 60, 360, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
    sx: 14 + rand() * 8, sy: 6 + rand() * 3, sz: 10 + rand() * 5,
  }));
  scatterInstanced(scene, bodyGeo, barnMat, barns);
  scatterInstanced(scene, bodyGeo, roofMat, barns.map(b => ({
    pos: b.pos.clone().setY(b.pos.y + b.sy), rot: b.rot,
    sx: b.sx * 1.08, sy: 1.8, sz: b.sz * 1.08,
  })));
  // grain silos beside the barns
  const siloGeo = new THREE.CylinderGeometry(1, 1, 1, 12); siloGeo.translate(0, 0.5, 0);
  const siloMat = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.4, metalness: 0.6 });
  scatterInstanced(scene, siloGeo, siloMat, barns.map((b, i) => ({
    pos: b.pos.clone().add(new THREE.Vector3(9 + (i % 4) * 2, 0, 4)),
    rot: 0, sx: 3.2 + (i % 3), sy: 10 + (i * 7) % 9, sz: 3.2 + (i % 3),
  })));
  buildTrees(scene, seed + 1, s0, s1, 220, 55, 400, 40);
  buildBillboards(scene, registry, seed + 2, s0 + 100, s1 - 100,
    Math.max(10, Math.round((s1 - s0) / 1400)), MIDWEST_ADS);
}

// ---------------------------------------------------------------------------
// I-65 wind farm: the fields between Merrillville and Lafayette are covered in
// turbines (like the real Fowler Ridge / Meadow Lake farms). Each carries an
// aviation light on the nacelle; at night they all blink red in unison.
// ---------------------------------------------------------------------------
export function buildWindFarm(scene, registry, s0, s1, seed = 770, opts = {}) {
  const { gap = 42, gapRnd = 60, skip = 0.15 } = opts;   // spacing + drop-rate → density
  const rand = rng(seed);
  const H = 78;
  const towerGeo = new THREE.CylinderGeometry(0.9, 1.9, H, 8); towerGeo.translate(0, H / 2, 0);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.6 });
  const bladeGeo = new THREE.BoxGeometry(1.5, 27, 0.5); bladeGeo.translate(0, 13.5, 0);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.5 });
  const nacGeo = new THREE.BoxGeometry(2.4, 2.4, 6);

  const pts = [];
  for (let s = s0; s < s1; s += gap + rand() * gapRnd) {
    for (const side of [-1, 1]) {
      if (rand() < skip) continue;
      const lat = side * (90 + Math.pow(rand(), 0.8) * 430);
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      const hub = p.clone(); hub.y += H;
      pts.push({ hub, rot: rand() * TAU, phase: rand() * TAU, speed: 0.7 + rand() * 0.7 });
    }
  }
  const n = pts.length;
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, n);
  const nacelles = new THREE.InstancedMesh(nacGeo, towerMat, n);
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, n * 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);

  // red aviation beacon: an additive glow sprite on each nacelle, big and
  // fog-free so it reads across the fields; all blink together at night.
  const beaconMat = new THREE.SpriteMaterial({
    map: beaconTexture(), color: 0xff1414, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  pts.forEach((t, i) => {
    const base = t.hub.clone(); base.y -= H;
    q.setFromAxisAngle(up, t.rot);
    m.compose(base, q, one); towers.setMatrixAt(i, m);
    m.compose(t.hub, q, one); nacelles.setMatrixAt(i, m);
    const spr = new THREE.Sprite(beaconMat);
    spr.position.copy(t.hub); spr.position.y += 3;
    spr.scale.set(22, 22, 1);
    scene.add(spr);
  });
  towers.castShadow = true;
  scene.add(towers, nacelles, blades);
  registry.windmillLights = (registry.windmillLights || []).concat(beaconMat);
  (registry.windFarms ||= []).push({ blades, turbines: pts });
  updateWindFarm(registry, 0);   // set initial blade pose
}

// soft radial glow for the beacon sprites (white core → transparent)
function beaconTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,120,120,0.9)');
  grad.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Spin the rotors. Called every frame from the render loop.
const _wfM = new THREE.Matrix4(), _wfQ = new THREE.Quaternion(), _wfQb = new THREE.Quaternion();
const _wfOne = new THREE.Vector3(1, 1, 1), _wfUp = new THREE.Vector3(0, 1, 0), _wfFwd = new THREE.Vector3(0, 0, 1);
export function updateWindFarm(registry, simTime) {
  const farms = registry.windFarms;
  if (!farms) return;
  for (const { blades, turbines } of farms) {
    for (let i = 0; i < turbines.length; i++) {
      const t = turbines[i];
      const ang = t.phase + simTime * t.speed;
      _wfQ.setFromAxisAngle(_wfUp, t.rot);
      for (let b = 0; b < 3; b++) {
        _wfQb.setFromAxisAngle(_wfFwd, ang + b * 2.0944);
        _wfQb.premultiply(_wfQ);
        _wfM.compose(t.hub, _wfQb, _wfOne);
        blades.setMatrixAt(i * 3 + b, _wfM);
      }
    }
    blades.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Dynamic message signs (electronic travel-time boards). Westbound on I-80/94
// through Gary: time to the state line and to Chicago; a second board with the
// Chicago time just after the Skyway. Minutes update live from speed/distance.
// ---------------------------------------------------------------------------
// dir < 0 boards face northbound/westbound traffic (decreasing s, toward
// O'Hare & the state line); dir > 0 boards face southbound traffic (increasing
// s, out toward Indiana). Minutes update live from speed/distance.
const DMS_SIGNS = [
  // Westbound: Chicago/state-line times from Gary and Hammond. East/southbound:
  // Borman, I-65 and Indianapolis from the Dan Ryan/Bishop Ford approaches.
  { s: 45000, dir: -1, targets: [['CHICAGO', 3000], ['IL STATE LINE', 30000]] },
  { s: 35000, dir: -1, targets: [['DAN RYAN', 8000], ['CHICAGO', 3000]] },
  { s: 26000, dir: -1, targets: [['DAN RYAN', 8000], ['DOWNTOWN', 0]] },
  { s: 8000,  dir: 1,  targets: [['I-57', 20700], ['INDIANA LINE', 30000]] },
  { s: 22000, dir: 1,  targets: [['I-65', 48600], ['INDIANAPOLIS', 86000]] },
];

function buildDMS(scene, registry) {
  registry.dms = [];
  const steel = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.5, metalness: 0.6 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.7 });
  for (const sign of DMS_SIGNS) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const boardMat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.5,
    });
    const group = new THREE.Group();
    const half = pavedHalfAt(sign.s) + 2;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.7, 0.7), steel);
    beam.position.y = 7.4; group.add(beam);
    for (const x of [-half, half]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.4, 0.6), steel);
      post.position.set(x, 3.7, 0); group.add(post);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(8.6, 4.4, 0.35), backMat);
    back.position.set(0, 9.6, -0.02); group.add(back);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), boardMat);
    board.position.set(0, 9.6, 0.2); group.add(board);
    group.position.copy(posAt(sign.s, 0, new THREE.Vector3()));
    group.rotation.y = headingAt(sign.s) + (sign.dir > 0 ? Math.PI : 0);
    scene.add(group);
    registry.dms.push({ ...sign, cv, tex, last: '' });
  }
  updateDMS(registry, 45000, 27);   // initial draw
}

// Called every frame: recompute the minutes and redraw only when they change.
export function updateDMS(registry, playerS, avgSpeed) {
  const list = registry.dms;
  if (!list) return;
  for (const d of list) {
    const lines = d.targets.map(([label, tS]) => {
      const dist = d.dir > 0
        ? (tS - playerS + LOOP_LENGTH) % LOOP_LENGTH    // southbound (increasing s)
        : (playerS - tS + LOOP_LENGTH) % LOOP_LENGTH;   // northbound/westbound
      const min = Math.max(1, Math.min(199, Math.round(dist / avgSpeed / 60)));
      return [label, min + ' MIN'];
    });
    const key = lines.map(l => l.join(' ')).join('|');
    if (key === d.last) continue;
    d.last = key;
    const g = d.cv.getContext('2d');
    g.fillStyle = '#0a0c0e'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#ffb200'; g.textBaseline = 'middle';
    const rowH = 256 / lines.length;
    lines.forEach(([label, val], i) => {
      const y = rowH * (i + 0.5);
      g.font = 'bold 48px "Helvetica Neue", Arial, sans-serif';
      g.textAlign = 'left'; g.fillText(label, 26, y);
      g.textAlign = 'right'; g.fillText(val, 486, y);
    });
    d.tex.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Wooded rolling hills on I-74 through SE Indiana into Ohio.
// ---------------------------------------------------------------------------
function buildHills(scene, s0, s1) {
  buildTrees(scene, 631, s0, s1, 16, 34, 360, 120);        // dense broadleaf on the slopes
  buildTrees(scene, 632, s0, s1, 30, 60, 420, 90, true);   // pines higher up
}

// INDOT-documented open grass medians on rural I-65 and I-74. Short gaps at
// exits keep ramps and gore areas visually separate from the median grass.
function buildGrassMedians(scene) {
  const grass = new THREE.MeshStandardMaterial({ color: 0x536b36, roughness: 1.0 });
  const edge = new THREE.MeshBasicMaterial({ color: 0xe6dfb5, depthWrite: false });
  const spans = [
    [52000, 54800], [55500, 57200], [58000, 61800], [63000, 66800], [68000, 69600],
    [71000, 74200], [75400, 77800],
    [96000, 98500], [99200, 103800], [105000, 109500],
    [111500, 120500], [121500, 124000],
  ];
  for (const [s0, s1] of spans) {
    const half = s => Math.max(1.25, medianHalfAt(s) - 0.32);
    scene.add(new THREE.Mesh(buildRibbon(s => -half(s), s => half(s), 0.045, 0.045, 12, s0, s1), grass));
    scene.add(new THREE.Mesh(buildRibbon(s => -half(s) - 0.11, s => -half(s) + 0.11, 0.12, 0.12, 12, s0, s1), edge));
    scene.add(new THREE.Mesh(buildRibbon(s => half(s) - 0.11, s => half(s) + 0.11, 0.12, 0.12, 12, s0, s1), edge));
  }
}

// ---------------------------------------------------------------------------
// Chicago expressway upgrades: Kennedy + Dan Ryan express/local splits
// (concrete-divided, split/merge boards, reversible-lane signals on the
// Kennedy) and the cashless Skyway ORT gantry.
// ---------------------------------------------------------------------------
function buildSkywayORT(scene, registry, s) {
  const sign = (atS, lines, w) => {
    const a = textBoard(lines, w, 3.4, '#123a7a', '#ffffff'); a.rotation.y = Math.PI;
    gantry(scene, registry, atS, [{ lat: -6, mesh: a }], 6.9);
    gantry(scene, registry, 2 * s - atS, [{ lat: 6, mesh: textBoard(lines, w, 3.4, '#123a7a', '#ffffff') }], 6.9);
  };
  sign(s - 750, ['SKYWAY TOLL 1/2 MILE', 'I-PASS · E-ZPass', 'MAINTAIN SPEED'], 12);
  sign(s - 220, ['NO CASH · NO STOPPING', 'NO TRANSPONDER?', 'TOLL BY MAIL'], 12.5);
  const mkTag = () => textBoard(['I-PASS', 'CHICAGO SKYWAY'], 5.6, 2.3, '#123a7a', '#ffffff');
  const tagA = mkTag(); tagA.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: tagA }, { lat: 6, mesh: mkTag() }], 7.0);
  const steel = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.5, metalness: 0.6 });
  const scanGeo = new THREE.BoxGeometry(0.55, 0.4, 0.8);
  const half = pavedHalfAt(s) - 0.5;
  const heading = headingAt(s);
  for (let lat = -half + LANE_WIDTH / 2; lat < half; lat += LANE_WIDTH) {
    const scan = new THREE.Mesh(scanGeo, steel);
    scan.position.copy(posAt(s, lat, new THREE.Vector3()));
    scan.position.y += 6.3;
    scan.rotation.y = heading;
    scene.add(scan);
  }
}

function buildChicagoSplits(scene, registry) {
  // concrete Jersey barriers down the express/local gap, both carriageways
  const conc = new THREE.MeshStandardMaterial({ color: 0x9a9d9f, roughness: 0.9 });
  for (const [s0, s1] of [[4600, 15500], [24600, 33600]]) {
    for (const side of [-1, 1]) {
      const center = s => side * (medianHalfAt(s) + 3 * LANE_WIDTH + njGapAt(s) / 2);
      scene.add(new THREE.Mesh(
        buildRibbon(s => center(s) - 0.45, s => center(s) + 0.45, 0.85, 0.85, 12, s0, s1), conc));
      scene.add(new THREE.Mesh(
        buildRibbon(s => center(s) - 0.6, s => center(s) + 0.6, 0.06, 0.06, 12, s0, s1), conc));
    }
  }
  // split / merge boards, GSP-style but IDOT green, each bound of each split
  const exprLat = s => medianHalfAt(s) + 1.5 * LANE_WIDTH;
  const loclLat = s => medianHalfAt(s) + 3 * LANE_WIDTH + njGapAt(s) + LANE_WIDTH;
  const splitBoards = (s, nb, exprLines, loclLines) => {
    const e = textBoard(exprLines, 8.5, 3.0, '#046a38', '#ffffff');
    const l = textBoard(loclLines, 7, 3.0, '#046a38', '#ffffff');
    if (nb) { e.rotation.y = Math.PI; l.rotation.y = Math.PI; }
    const sgn = nb ? -1 : 1;
    gantry(scene, registry, s, [{ lat: sgn * exprLat(s), mesh: e }, { lat: sgn * loclLat(s), mesh: l }], 6.8);
  };
  // Kennedy: the reversible express — signal boards at both entrances
  splitBoards(5700, true, ['KENNEDY EXPRESS', '⬇ OPEN · NO EXITS'], ['LOCAL', 'ALL EXITS']);
  splitBoards(14400, false, ['EXPRESS ENDS', 'MERGE AHEAD'], ['LOCAL', 'ALL EXITS']);
  // Dan Ryan: the 14-lane dual-dual
  splitBoards(25700, true, ['DAN RYAN EXPRESS', '3 LANES · NO EXITS'], ['LOCAL', 'ALL EXITS']);
  splitBoards(32700, false, ['EXPRESS ENDS', 'MERGE AHEAD'], ['LOCAL', 'ALL EXITS']);
  // reversible-lane status signals over the Kennedy express entrances: the
  // green-arrow / red-X pairs Chicagoans actually check before diving in
  const sig = open => textBoard([open ? '⬇   ⬇   ⬇' : 'X   X   X', ''], 6.5, 2.0,
    open ? '#0b5c37' : '#7a1020', open ? '#7fff9a' : '#ff5a4a');
  const sA = sig(true); sA.rotation.y = Math.PI;
  gantry(scene, registry, 4900, [{ lat: -exprLat(4900), mesh: sA }], 7.4);
  gantry(scene, registry, 15200, [{ lat: exprLat(15200), mesh: sig(true) }], 7.4);
}

// Chicago roadside texture: sound walls, security/rail fencing, mature tree
// bands, and the low-rise sprawl that fills the gaps between the landmarks.
// Keep these as a separate layer so the expressway geometry remains readable
// and the same treatment can be tuned without touching the road builder.
function buildChicagoRoadside(scene, registry) {
  const wallGeo = new THREE.BoxGeometry(1, 1, 1); wallGeo.translate(0, 0.5, 0);
  const soundMat = new THREE.MeshStandardMaterial({ color: 0x8b9093, roughness: 0.92 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x76554a, roughness: 0.9 });
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x3e474b, roughness: 0.75, metalness: 0.35 });
  const wallBands = [
    // Short Chicago barriers only. Philly's visual language is open, layered
    // metro frontage; long walls here were hiding the very sprawl we want to
    // show. Keep these at airport ramps, rail cuts, and the Skyway approach.
    [5100, 6500, soundMat], [14200, 15100, soundMat],
    [23200, 24600, brickMat], [31600, 32900, brickMat],
    [36200, 37700, soundMat],
  ];
  for (const [s0, s1, mat] of wallBands) {
    for (let s = s0; s <= s1; s += 46) {
      const half = pavedHalfAt(s) + 8;
      for (const side of [-1, 1]) {
        const lat = side * half;
        const p = posAt(s, lat, new THREE.Vector3());
        p.y = groundY(s, lat) + 2.35;
        const wall = new THREE.Mesh(wallGeo, mat);
        wall.position.copy(p); wall.rotation.y = headingAt(s);
        wall.scale.set(0.32, 6.2, 48); scene.add(wall);
      }
    }
  }

  // Chicago's expressways are threaded through a dense bridge grid. These
  // short overpasses keep the road enclosed by real cross streets instead of
  // leaving long empty sightlines between the landmark interchanges.
  for (const [s, street] of [
    [5200, 'CUMBERLAND AVE'], [6000, 'HARLEM AVE'], [8200, 'IRVING PARK RD'],
    [11000, 'KEDZIE AVE'], [13800, 'WESTERN AVE'], [15200, 'ASHLAND AVE'],
    [25800, '31ST ST'], [27200, '47TH ST'], [29600, '59TH ST'],
    [31800, '79TH ST'], [34700, '103RD ST'], [36500, '111TH ST'],
    [38900, '130TH ST'],
  ]) cityOverpass(scene, registry, s, street);
  // Airport, rail, and industrial fencing: lighter and more transparent than
  // the sound walls, with occasional gate posts for scale.
  for (const [s0, s1, h, offset] of [[450, 3900, 2.6, 18], [8200, 15600, 2.1, 15], [34200, 45400, 2.8, 20]]) {
    for (let s = s0; s <= s1; s += 36) {
      for (const side of [-1, 1]) {
        const lat = side * (pavedHalfAt(s) + offset);
        const p = posAt(s, lat, new THREE.Vector3());
        p.y = groundY(s, lat) + h / 2;
        const fence = new THREE.Mesh(wallGeo, fenceMat);
        fence.position.copy(p); fence.rotation.y = headingAt(s);
        fence.scale.set(0.12, h, 38); scene.add(fence);
        if ((s | 0) % 144 < 36) {
          const post = new THREE.Mesh(wallGeo, fenceMat);
          post.position.copy(p); post.position.y += 0.25;
          post.rotation.y = headingAt(s); post.scale.set(0.24, h + 0.5, 0.24); scene.add(post);
        }
      }
    }
  }

  // Tree belts soften the hard infrastructure, but stop at the airport and
  // industrial sightlines instead of turning the whole corridor into forest.
  buildTrees(scene, 731, 900, 3900, 20, 42, 270, 85);
  buildTrees(scene, 732, 4300, 15500, 13, 30, 220, 55);
  buildTrees(scene, 733, 24200, 33600, 16, 34, 240, 70);
  buildTrees(scene, 734, 34200, 39900, 24, 52, 300, 110);
  buildTrees(scene, 737, 4000, 16000, 18, 42, 240, 90);
  buildTrees(scene, 738, 24000, 40000, 18, 44, 260, 90);

  // Low-rise Chicagoland sprawl: apartments and commercial blocks behind the
  // tree/wall layer, with density rising toward downtown and the Dan Ryan.
  const brickCols = [0x8a4b3a, 0x9a5a44, 0x77503f, 0xa5866a, 0x6f5a4c, 0xb9a98f];
  const blocks = [];
  const rand = rng(735);
  for (let s = 1700; s < 15800; s += 45 + rand() * 55) {
    const density = s < 4300 ? 0.55 : 0.9;
    for (const side of [-1, 1]) {
      if (rand() > density) continue;
      const lat = side * (58 + rand() * 250);
      const p = posAt(s, lat, new THREE.Vector3());
      blocks.push({
        pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.35,
        sx: 18 + rand() * 32, sy: 9 + rand() * 30, sz: 16 + rand() * 34,
        color: new THREE.Color(brickCols[(rand() * brickCols.length) | 0]),
      });
    }
  }
  for (let s = 24200; s < 33800; s += 40 + rand() * 52) {
    for (const side of [-1, 1]) {
      const lat = side * (62 + rand() * 310);
      const p = posAt(s, lat, new THREE.Vector3());
      blocks.push({
        pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.3,
        sx: 20 + rand() * 38, sy: 12 + rand() * 52, sz: 18 + rand() * 36,
        color: new THREE.Color(brickCols[(rand() * brickCols.length) | 0]),
      });
    }
  }
  // Continuous low-rise frontage behind the barriers: apartment rows,
  // warehouses, and parking-lot buildings fill the space between the larger
  // skyline clusters and the highway edge.
  for (let s = 4000; s < 16000; s += 34 + rand() * 38) {
    for (const side of [-1, 1]) {
      const lat = side * (72 + rand() * 420);
      const p = posAt(s, lat, new THREE.Vector3());
      blocks.push({
        pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.18,
        sx: 28 + rand() * 46, sy: 8 + rand() * 20, sz: 20 + rand() * 42,
        color: new THREE.Color(brickCols[(rand() * brickCols.length) | 0]),
      });
    }
  }
  for (let s = 33800; s < 40000; s += 38 + rand() * 44) {
    for (const side of [-1, 1]) {
      const lat = side * (78 + rand() * 470);
      const p = posAt(s, lat, new THREE.Vector3());
      blocks.push({
        pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.16,
        sx: 34 + rand() * 58, sy: 7 + rand() * 16, sz: 26 + rand() * 50,
        color: new THREE.Color([0x9b9da0, 0xb6b8b9, 0x876f61, 0x6b7378][(rand() * 4) | 0]),
      });
    }
  }
  scatterInstanced(scene, wallGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), blocks);
  buildBillboards(scene, registry, 736, 1200, 3900, 5, CHICAGO_ADS);
}

// Chicagoland is not just a handful of skyline landmarks. From O'Hare through
// the Southland and into Gary, the highway sees a nearly unbroken mix of
// apartment blocks, retail strips, parking decks, rail-served warehouses, and
// older industrial neighborhoods. Keep this as a broad, low-rise carpet so the
// route feels metropolitan even when the player is outside the Loop view.
function buildChicagoContinuousSprawl(scene, registry) {
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const rand = rng(8840);
  const brick = [0x774b3f, 0x8b5c4b, 0x9b6b56, 0x6f7075, 0x9b9183, 0xb1a28e];
  const siding = [0xb7c0c6, 0xc6b9a8, 0x9faeaa, 0xd0c8b7, 0x8d969b];
  const retail = [0xd7d1c6, 0xc2c0b8, 0xb5bbb9, 0xa7a29b];
  const apartments = [];
  const homes = [];
  const stores = [];
  const garages = [];
  const plants = [];
  const frontage = [];

  const addRows = (s0, s1, step, near, far, kind) => {
    for (let s = s0; s < s1; s += step * (0.72 + rand() * 0.56)) {
      for (const side of [-1, 1]) {
        const lat = side * (near + rand() * (far - near));
        const p = posAt(s, lat, new THREE.Vector3());
        const urban = s < 34000;
        if (kind === 'apartment') apartments.push({
          pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.35,
          sx: 18 + rand() * (urban ? 28 : 38),
          sy: 10 + rand() * (urban ? 36 : 22), sz: 16 + rand() * 28,
          color: new THREE.Color(brick[(rand() * brick.length) | 0]),
        });
        if (kind === 'home') homes.push({
          pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.55,
          sx: 9 + rand() * 8, sy: 3.5 + rand() * 3.5, sz: 9 + rand() * 8,
          color: new THREE.Color(siding[(rand() * siding.length) | 0]),
        });
        if (kind === 'store') stores.push({
          pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.18,
          sx: 30 + rand() * 50, sy: 5.5 + rand() * 4.5, sz: 18 + rand() * 20,
          color: new THREE.Color(retail[(rand() * retail.length) | 0]),
        });
        if (kind === 'garage') garages.push({
          pos: p, rot: headingAt(s),
          sx: 46 + rand() * 55, sy: 12 + rand() * 10, sz: 35 + rand() * 35,
          color: new THREE.Color(0x858b90),
        });
        if (kind === 'plant') plants.push({
          pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.15,
          sx: 65 + rand() * 100, sy: 8 + rand() * 8, sz: 42 + rand() * 70,
          color: new THREE.Color([0x9da3a6, 0x858d91, 0xb0aaa0][(rand() * 3) | 0]),
        });
      }
    }
  };

  // Both sides stay populated. The depth bands are staggered so they read as
  // blocks and neighborhoods rather than two repetitive walls.
  addRows(500, 3900, 95, 80, 280, 'garage');
  addRows(900, 3900, 62, 250, 650, 'apartment');
  addRows(4000, 34000, 48, 72, 230, 'apartment');
  addRows(4300, 33800, 34, 255, 620, 'home');
  addRows(5200, 33000, 92, 82, 260, 'store');
  addRows(34000, 46300, 76, 90, 300, 'plant');
  addRows(34300, 46300, 52, 320, 720, 'apartment');
  addRows(40200, 50500, 58, 82, 270, 'store');
  addRows(46300, 51000, 42, 100, 520, 'apartment');
  addRows(46500, 51000, 30, 300, 760, 'home');

  // Close-in frontage is intentionally continuous from the airport to Gary.
  // This is the layer the driver actually reads at speed: brick walk-ups,
  // small offices, and service buildings just beyond the shoulder/rail edge.
  for (let s = 600; s < 51000; s += 58 + rand() * 34) {
    for (const side of [-1, 1]) {
      if (rand() < (s < 4200 ? 0.12 : 0.05)) continue;
      const lat = side * (pavedHalfAt(s) + 22 + rand() * 58);
      const p = posAt(s, lat, new THREE.Vector3());
      const industrial = s >= 33800;
      frontage.push({
        pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.22,
        sx: industrial ? 28 + rand() * 45 : 16 + rand() * 24,
        sy: industrial ? 7 + rand() * 10 : 8 + rand() * 22,
        sz: industrial ? 20 + rand() * 38 : 14 + rand() * 24,
        color: new THREE.Color(industrial
          ? [0x8d969a, 0xa5a7a2, 0x786d63][(rand() * 3) | 0]
          : brick[(rand() * brick.length) | 0]),
      });
    }
  }

  const lit = lowLitMaterial(registry);
  scatterInstanced(scene, box, lit, apartments);
  scatterInstanced(scene, box, lit, homes);
  scatterInstanced(scene, box, lit, frontage);
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86 }), stores);
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), garages);
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), plants);

  // Parking aprons make the commercial strips read as real frontage instead
  // of isolated boxes, while a few taller apartment nodes add depth at night.
  const apron = new THREE.MeshStandardMaterial({ color: 0x3b3d3f, roughness: 1 });
  scatterInstanced(scene, box, apron, stores.map(s => ({
    pos: s.pos.clone().setY(s.pos.y + 0.03), rot: s.rot,
    sx: s.sx * 1.16, sy: 0.06, sz: s.sz + 18,
  })), { shadow: false });
  const towerNodes = [];
  for (let s = 5200; s < 47000; s += 850 + rand() * 650) {
    for (const side of [-1, 1]) {
      const lat = side * (180 + rand() * 330);
      const p = posAt(s, lat, new THREE.Vector3());
      towerNodes.push({ pos: p, rot: headingAt(s), sx: 20 + rand() * 20, sy: 42 + rand() * 55, sz: 20 + rand() * 20 });
    }
  }
  scatterInstanced(scene, box, registry.towerMats?.[0] || lit, towerNodes);

  // More sign clutter on the commercial stretches helps the player read the
  // corridor as continuous metro frontage instead of empty prairie.
  buildBillboards(scene, registry, 8841, 4200, 34000, 22, CHICAGO_ADS);
  buildBillboards(scene, registry, 8842, 40200, 50500, 12, CHICAGO_ADS);
}

// Philadelphia blueprint pass: repeat the same visual rhythm that makes the
// Philly/Camden route feel like a real metro instead of a few set pieces—close
// suburb fabric, receding rings, frequent cross streets, and signature
// interchanges. Chicago's outer route is longer, so the pattern is staged in
// five overlapping bands from O'Hare to the Gary state-line approach.
function buildChicagoPhillyBlueprint(scene, registry) {
  const bands = [
    [0, 4200, 1.45, true],       // O'Hare / Rosemont
    [3600, 16000, 1.55, false],  // Kennedy / northwest side
    [14800, 30000, 1.5, false],  // Southland / I-294
    [28600, 40500, 1.35, false], // South Side / Skyway
    [39500, 51000, 1.2, false],  // Borman / Gary
  ];
  for (const [s0, s1, density, airport] of bands) {
    buildSuburb(scene, registry, s0, s1);
    deepSprawl(scene, 8870 + s0, s0, s1, {
      density, towers: airport, glowMat: registry.towerMats?.[0],
      litMat: lowLitMaterial(registry),
    });
  }

  // Philadelphia-style bridge grid: nearly every major arterial gets a
  // substantial overpass, with CTA/Metra-style rail crossings mixed in.
  const crossings = [
    [900, 'BESSIE COLEMAN DR'], [1700, 'MANNHEIM RD'], [2500, 'I-190 / TERMINALS'],
    [3600, 'TOUHY AVE'], [4700, 'CUMBERLAND AVE'], [5850, 'HARLEM AVE'],
    [7000, 'IRVING PARK RD'], [8150, 'DEVON AVE'], [9300, 'MONTROSE AVE'],
    [10400, 'LAWRENCE AVE'], [11600, 'ADDISON ST'], [12800, 'BELMONT AVE'],
    [14000, 'FULLERTON AVE'], [15300, 'ARMITAGE AVE'], [16600, 'DIVISION ST'],
    [17900, 'I-290 / EISENHOWER'], [19200, 'ROOSEVELT RD'], [20500, 'ARCHER AVE'],
    [21800, 'I-55 / STEVENSON'], [23100, '75TH ST'], [24400, '83RD ST'],
    [25700, '95TH ST'], [27000, '111TH ST'], [28300, '127TH ST'],
    [29600, 'US-6 / 159TH ST'], [30900, '171ST ST'], [32200, '183RD ST'],
    [33500, 'CALUMET AVE'], [34800, '103RD ST'], [36100, '115TH ST'],
    [37400, '130TH ST'], [38700, 'TORRENCE AVE'], [40000, 'INDIANA TOLL RD'],
    [41300, 'US-12 / HAMMOND'], [42600, 'US-20 / GARY'], [43900, 'BROADWAY'],
    [45200, 'US-30 / MERRILLVILLE'], [46500, 'I-65 NORTH'], [47800, 'US-6'],
    [49100, 'RIDGE RD / GARY'], [50300, 'MELTON RD'],
  ];
  for (const [s, name] of crossings) cityOverpass(scene, registry, s, name);

  // Large guide structures at the band transitions sell the corridor as a
  // continuous urban freeway, like the Philly approach boards and bridges.
  for (const [s, lines] of [
    [4200, ['I-294 SOUTH', 'TRI-STATE TOLLWAY', 'ROSEMONT · OAK BROOK']],
    [15800, ['I-90 / KENNEDY', 'CHICAGO · SOUTH SIDE', 'KEEP RIGHT']],
    [24800, ['I-80/94 EAST', 'GARY · INDIANA', 'TRUCKS KEEP RIGHT']],
    [33800, ['I-90 EAST', 'CHICAGO SKYWAY', 'INDIANA TOLL ROAD']],
    [44200, ['I-65 SOUTH', 'INDIANAPOLIS', 'NEXT EXIT']],
  ]) chicagoInterchange(scene, registry, s, lines.map((line, i) => [line, i === 0 ? 'METRO ACCESS · EXIT' : i === 1 ? 'LOCAL STREETS · RETAIL' : 'MERGE AHEAD']));
}

// Same blueprint for the next two metros, scaled down from Chicago: the
// development is continuous around the beltways and approaches, but the
// buildings stay mostly low-rise and the skyline clusters remain compact.
function buildIndyCincyPhillyBlueprint(scene, registry) {
  const metroBands = [
    [76000, 95000, 0.95, 8920],    // I-65 / I-465 / airport / south Indy
    [124500, 138500, 1.02, 8930],  // west Cincinnati hills to I-75 junction
    [138400, 179500, 0.9, 8940],   // Mill Creek, Sharonville, West Chester, Mason
  ];
  for (const [s0, s1, density, seed] of metroBands) {
    // Indy and north Cincinnati already have a full buildSuburb pass in their
    // dedicated builders. Add the missing west-Cincinnati suburb fabric only;
    // use efficient deep rings for the rest so the scene stays renderable.
    if (s0 === 124500) buildSuburb(scene, registry, s0, s1);
    deepSprawl(scene, seed, s0, s1, {
      density, towers: false, litMat: lowLitMaterial(registry),
    });
  }

  const indyBridges = [
    [78300, 'I-865 / ZIONSVILLE'], [80800, '71ST ST'],
    [83600, '38TH ST'], [86600, 'I-70 / ST LOUIS'], [89700, 'US-40 / AIRPORT'],
    [92800, 'I-74 EAST / CINCINNATI'],
  ];
  const cincyBridges = [
    [125300, 'WHITE OAK RD'], [127400, 'COLERAIN AVE'], [129600, 'NORTH BEND RD'],
    [131900, 'WESTERN HILLS VIADUCT'], [134200, 'I-75 NORTH / DAYTON'], [136300, 'SPRING GROVE AVE'],
    [138000, 'I-74 / I-75 JUNCTION'], [140400, 'SR-562 / NORWOOD'],
    [143000, 'MONTGOMERY RD'], [145800, 'I-275 WEST'], [148600, 'GALBRAITH RD'],
    [151400, 'I-275 EAST'], [154200, 'UNION CENTRE BLVD'], [157000, 'I-275 / EXIT 16'],
    [160000, 'FIELDS ERTEL RD'], [163400, 'WEST CHESTER RD'], [166800, 'MASON RD'],
    [170200, 'LIBERTY WAY'], [174000, 'KING ISLAND DR'],
  ];
  for (const [s, name] of indyBridges.concat(cincyBridges)) cityOverpass(scene, registry, s, name);

  for (const [s, lines] of [
    [79000, ['I-865 / I-465 SOUTH', 'INDIANAPOLIS BYPASS', 'AIRPORT · I-70']],
    [84200, ['I-465 SOUTH', 'I-70 · ST LOUIS', 'AIRPORT · I-74']],
    [93000, ['I-74 EAST', 'SHELBYVILLE · CINCINNATI', 'LEAVE BELTWAY']],
    [129800, ['I-74 EAST', 'I-75 NORTH · DAYTON', 'DOWNTOWN · KEEP RIGHT']],
    [141000, ['I-75 NORTH', 'NORWOOD · SHARONVILLE', 'I-275 LOOP']],
    [156800, ['I-275 LOOP', 'WEST CHESTER · MASON', 'LOCAL EXITS']],
  ]) {
    gantry(scene, registry, s, [{ lat: 0, mesh: textBoard(lines, 13, 3.4, '#046a38', '#ffffff') }], 6.9);
  }
}

// Midwest metro fabric pass. The Northeast maps stay convincing because the
// highway is never surrounded by a single decorative row: walls, setbacks,
// commerce, homes, tree screens, and distant development are layered together.
// Apply that same treatment to the major built-up bands of this route.
function buildMidwestMetroFabric(scene, registry) {
  const walledBands = [
    [79000, 95000],   // Indianapolis beltway and metro ring
    [123000, 147000], // wooded Cincinnati west side through Mill Creek
    [147000, 179500], // Sharonville / West Chester / Mason sprawl
  ];
  for (const [s0, s1] of walledBands) {
    buildSuburb(scene, registry, s0, s1, { wall: true });
  }

  // Local streets, rail crossings, and utility roads break up the walls at
  // believable intervals. Keep the spans outside the road collision topology.
  const bridges = [
    [47400, 'US-12 / GARY'], [49500, 'US-30 / MERRILLVILLE'],
    [54200, 'US-41 / CROWN POINT'], [57800, 'SR-10 / DEMOTTE'],
    [61200, 'SR-16 / RENSSELAER'], [64600, 'US-24 / REMINGTON'],
    [68900, 'US-231 / LAFAYETTE SOUTH'], [71800, 'SR-18 / BATTLE GROUND'],
    [74200, 'SR-47 / LEBANON'], [76800, 'US-52 / WHITESTOWN'],
    [80200, 'I-465 WEST'], [83500, 'US-40 / AIRPORT'], [87500, '16TH ST'], [91800, 'I-465 EAST'],
    [97500, 'US-421 / SHELBYVILLE'], [101800, 'SR-46'], [106500, 'GREENSBURG'],
    [112500, 'US-421 / BATESVILLE'], [117500, 'SR-1'], [121500, 'WEST HARRISON'],
    [139300, 'HOPPLE ST'], [142700, 'MITCHELL AVE'], [144400, 'NORWOOD LATERAL'],
    [149200, 'GALBRAITH RD'], [154000, 'SHARON RD'], [163700, 'UNION CENTRE BLVD'],
    [171700, 'SR-747 / WEST CHESTER'], [176500, 'MASON-MONTGOMERY RD'],
  ];
  for (const [s, street] of bridges) cityOverpass(scene, registry, s, street);

  // A second, quieter wall/landscape layer keeps the edge from turning into
  // bare terrain between the larger building clusters.
  buildTrees(scene, 8830, 46000, 51000, 24, 65, 300, 80);
  buildTrees(scene, 8831, 79000, 95000, 24, 55, 330, 90);
  buildTrees(scene, 8832, 113000, 125000, 24, 72, 500, 135);
  // Cincinnati's Ohio approaches stay heavily wooded even where houses and
  // industry sit close to the interstate. Keep the tree wall dense, then let
  // it open only at the riverfront skyline and major interchange structures.
  buildTrees(scene, 8833, 122500, 133000, 14, 48, 260, 82);
  buildTrees(scene, 8834, 138000, 147000, 11, 42, 320, 150, false, 1.2);
  buildTrees(scene, 8835, 147000, 179500, 12, 50, 420, 170, false, 1.22);
  buildTrees(scene, 8836, 123000, 138000, 10, 42, 440, 175, false, 1.28);
  // Fill the remaining weak sightlines: the long I-65 run, the Indy beltway,
  // and the I-74 farm-to-hills transition all get
  // a close roadside tree wall plus the deeper existing landscape layers.
  // Rural Indiana remains an open, flat plains drive. Woodland becomes dense
  // only on the Indianapolis approach instead of walling the entire I-65 leg.
  buildTrees(scene, 8843, 73000, 79000, 18, 55, 360, 105);
  buildTrees(scene, 8844, 79000, 95000, 15, 68, 420, 120);
  buildTrees(scene, 8845, 113000, 125000, 18, 72, 560, 150);
  buildNoiseWall(scene, 125000, 133000, { seed: 8840, height: 4.6, margin: 5.0, step: 16, gapChance: 0.16 });
}

// Midwest construction treatment: the traffic model closes the lane from the
// shared WORK_ZONES table, while this draws the same solid lane line, taper,
// cones, arrow board, truck, and advance warnings into the world.
function buildMidwestWorkZones(scene, registry) {
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf1e7b0, depthWrite: false });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xe85b10, roughness: 0.82 });
  const coneGeo = new THREE.ConeGeometry(0.42, 1.15, 8); coneGeo.translate(0, 0.58, 0);
  for (const z of WORK_ZONES) {
    if (z.dir === 0 || z.sHigh < 40000 || z.sLow > 150000) continue;
    const laneLat = s => latForLane(z.dir, usableLanesAt(s) - 1, s);
    const solidLat = s => laneLat(s) - z.dir * laneWidthAt(s) * 0.5;
    scene.add(new THREE.Mesh(buildRibbon(
      s => solidLat(s) - 0.1, s => solidLat(s) + 0.1,
      0.08, 0.08, 8, z.sLow, z.sHigh
    ), lineMat));

    const spots = [];
    for (let s = z.sLow; s < z.sHigh; s += 18) {
      const p = posAt(s, laneLat(s), new THREE.Vector3());
      p.y = groundY(s, laneLat(s)) + 0.02;
      spots.push({ pos: p, rot: headingAt(s) });
    }
    const cones = new THREE.InstancedMesh(coneGeo, coneMat, spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    spots.forEach((sp, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sp.rot); m.compose(sp.pos, q, sc); cones.setMatrixAt(i, m); });
    cones.castShadow = false;
    cones.userData.closedLaneMarkers = true;
    scene.add(cones);

    const approach = z.dir > 0 ? z.sLow : z.sHigh;
    for (const [delta, lines] of [[1600, ['ROAD WORK', '1 MILE']], [650, ['RIGHT LANE', 'CLOSED']], [240, ['MERGE LEFT', 'AHEAD']]]) {
      const sign = textBoard(lines, 7.2, 3.2, '#e87512', '#101216');
      sign.position.copy(posAt(approach - z.dir * delta, z.dir * (pavedHalfAt(approach) + 7), new THREE.Vector3()));
      sign.position.y = groundY(approach, z.dir * (pavedHalfAt(approach) + 7)) + 5.8;
      sign.rotation.y = headingAt(approach) + (z.dir > 0 ? Math.PI : 0);
      scene.add(sign); registry.signs.push({ userData: { board: sign } });
    }
  }
}

// ---------------------------------------------------------------------------
// City-identity layer: the Midwest route needs recognizable geographic cues,
// not only a continuous carpet of generic buildings. These are deliberately
// lightweight landmark groups placed beside the real corridor sequence:
// O'Hare/CTA → Chicago industrial belt, IND airport/beltway, then Cincinnati's
// wooded hills and riverfront edge.
// ---------------------------------------------------------------------------
function midwestLandmarkBox(scene, s, lat, sx, sy, sz, color, roof = null) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.08 })
  );
  const p = posAt(s, lat, new THREE.Vector3());
  p.y = groundY(s, lat) + sy * 0.5;
  body.position.copy(p); body.rotation.y = headingAt(s); scene.add(body);
  if (roof) {
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(sx * 1.04, 0.7, sz * 1.04),
      new THREE.MeshStandardMaterial({ color: roof, roughness: 0.72 })
    );
    cap.position.copy(p); cap.position.y += sy * 0.5 + 0.35;
    cap.rotation.y = headingAt(s); scene.add(cap);
  }
}

function buildChicagoIdentity(scene, registry) {
  // O'Hare terminal/parking massing on the north side of the Tri-State: the
  // airport should read as a real complex before the route becomes dense city.
  for (const [s, lat, w, d] of [[1800, 270, 150, 34], [2450, 275, 210, 42], [3150, 270, 170, 32]]) {
    midwestLandmarkBox(scene, s, lat, w, 12, d, 0xb9c2c9, 0x6d7680);
  }
  midwestLandmarkBox(scene, 2750, 330, 22, 72, 22, 0x9ea8af); // control tower
  const terminalBlue = new THREE.MeshStandardMaterial({ color: 0x456b8e, roughness: 0.5, metalness: 0.35 });
  const blueDeck = new THREE.Mesh(buildRibbon(
    s => 365, s => 369, 5.6, 5.6, 14, 2800, 11800
  ), terminalBlue);
  scene.add(blueDeck);
  for (let s = 3000; s <= 11600; s += 420) {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 5.6, 8), terminalBlue);
    const p = posAt(s, 367, new THREE.Vector3()); p.y = groundY(s, 367) + 2.8;
    pier.position.copy(p); scene.add(pier);
  }
  for (const [s, label] of [[3600, 'O’HARE TERMINALS'], [7900, 'CTA BLUE LINE'], [11600, 'ROSEMONT']]) {
    const board = textBoard([label, 'CHICAGO'], 7.4, 2.3, '#123a7a', '#ffffff');
    board.position.copy(posAt(s, 374, new THREE.Vector3()));
    board.position.y = groundY(s, 374) + 7.2; board.rotation.y = headingAt(s) + Math.PI;
    scene.add(board); registry.signs.push({ userData: { board } });
  }

  // South Side industrial identity: brick blocks, rail/warehouse edges, and
  // water-adjacent steel silhouettes around the Skyway approach.
  const brick = [0x884d3f, 0x9a5a45, 0x6e5550, 0xa87555];
  const rand = rng(9901);
  for (let s = 24000; s < 39000; s += 170) {
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue;
      const lat = side * (70 + rand() * 280);
      midwestLandmarkBox(scene, s, lat, 24 + rand() * 38, 10 + rand() * 28, 20 + rand() * 34,
        brick[(rand() * brick.length) | 0], 0x3f4448);
    }
  }
  for (const [s, label] of [[26200, 'SOUTH SIDE'], [31100, 'CALUMET INDUSTRIAL'], [35500, 'CHICAGO SKYWAY']]) {
    const sign = textBoard([label, 'I-90 / I-94'], 8.4, 2.8, '#046a38', '#ffffff');
    sign.position.copy(posAt(s, sideSignLat(s), new THREE.Vector3()));
    sign.position.y = groundY(s, sideSignLat(s)) + 6.2;
    sign.rotation.y = headingAt(s) + Math.PI; scene.add(sign);
  }
}

function sideSignLat(s) { return pavedHalfAt(s) + 7; }

function buildIndianapolisIdentity(scene, registry) {
  // Airport terminal and cargo apron on the southwest/west beltway side.
  midwestLandmarkBox(scene, 80600, 520, 180, 12, 48, 0xb8c3cb, 0x52728e);
  midwestLandmarkBox(scene, 82100, 610, 120, 8, 70, 0x9ba7ad, 0x657078);
  for (let s = 80000; s < 84000; s += 520) midwestLandmarkBox(scene, s, 690, 18, 5, 13, 0x7b8288);
  const airport = textBoard(['INDIANAPOLIS INTERNATIONAL', 'AIRPORT · I-70'], 10, 2.8, '#123a7a', '#ffffff');
  airport.position.copy(posAt(81700, 655, new THREE.Vector3())); airport.position.y = groundY(81700, 655) + 7.5;
  airport.rotation.y = headingAt(81700) + Math.PI; scene.add(airport);

  // Lucas Oil / downtown sports district cue inside the beltway. The route is
  // not downtown itself, so the stadium is offset and visible as a landmark,
  // rather than incorrectly placed on the pavement.
  const stadium = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 32),
    new THREE.MeshStandardMaterial({ color: 0x7d8790, roughness: 0.65, metalness: 0.18 })
  );
  const sp = posAt(87600, -500, new THREE.Vector3()); sp.y = groundY(87600, -500) + 9;
  stadium.position.copy(sp); stadium.scale.set(105, 18, 62); stadium.rotation.y = headingAt(87600); scene.add(stadium);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), new THREE.MeshStandardMaterial({ color: 0xaeb8bd, roughness: 0.5 }));
  roof.position.copy(sp); roof.position.y += 17; roof.scale.set(108, 2.2, 65); roof.rotation.y = headingAt(87600); scene.add(roof);
  const stadiumSign = textBoard(['LUCAS OIL STADIUM', 'DOWNTOWN INDIANAPOLIS'], 8.8, 2.6, '#7a1020', '#ffffff');
  stadiumSign.position.copy(posAt(87600, -575, new THREE.Vector3())); stadiumSign.position.y = groundY(87600, -575) + 8.5;
  stadiumSign.rotation.y = headingAt(87600); scene.add(stadiumSign);

  // Continuous urban frontage along I-65: apartments and office parks
  // are separated by arterial bridges, instead of a single isolated skyline.
  for (const [s, label] of [[80200, 'I-465 WEST · AIRPORT'], [84600, 'I-70 · DOWNTOWN'], [89100, 'I-65 SOUTH'], [92800, 'I-74 EAST · CINCINNATI']]) {
    const sign = textBoard([label, 'INDIANAPOLIS'], 8.5, 2.6, '#046a38', '#ffffff');
    sign.position.copy(posAt(s, sideSignLat(s), new THREE.Vector3())); sign.position.y = groundY(s, sideSignLat(s)) + 6.4;
    sign.rotation.y = headingAt(s) + Math.PI; scene.add(sign);
  }
}

function buildCincinnatiIdentity(scene, registry) {
  // I-74's western approach should feel like Cincinnati's wooded, settled
  // hills before the downtown cut: hillside homes step upward on both sides.
  const rand = rng(9955);
  for (let s = 125600; s < 132600; s += 130) {
    for (const side of [-1, 1]) {
      if (rand() < 0.22) continue;
      const lat = side * (95 + rand() * 400);
      midwestLandmarkBox(scene, s, lat, 9 + rand() * 8, 4 + rand() * 5, 9 + rand() * 7,
        [0xd6cdbc, 0xc3cbd0, 0xb9a58e, 0x9e6e5c][(rand() * 4) | 0], 0x584940);
    }
  }
  // I-74 hands directly to northbound I-75; downtown remains an exit choice.
  for (const [s, lines] of [[133900, ['I-75 NORTH · DAYTON', 'KEEP LEFT']], [134600, ['I-75 SOUTH · DOWNTOWN', 'LEXINGTON · KEEP RIGHT']]]) {
    const sign = textBoard(lines, 9.2, 2.8, '#046a38', '#ffffff');
    sign.position.copy(posAt(s, sideSignLat(s), new THREE.Vector3())); sign.position.y = groundY(s, sideSignLat(s)) + 6.8;
    sign.rotation.y = headingAt(s) + Math.PI; scene.add(sign);
  }
}

const DAYTON_ADS = [
  ['DAYTON FLYERS', '#004b8d', '#ffffff'], ['WRIGHT-PATT AFB · NEXT EXITS', '#0b3d91', '#ffffff'],
  ["MARION'S PIAZZA", '#c8102e', '#ffffff'], ['AIR FORCE MUSEUM · FREE', '#0b3d91', '#ffd23d'],
  ['KINGS ISLAND · EXIT 24', '#0d6b3f', '#ffd23d'], ['IKEA · WEST CHESTER', '#0051ba', '#ffda1a'],
  ['MIAMI UNIVERSITY', '#c8102e', '#ffffff'], ['SKYLINE CHILI', '#1b4fa0', '#ffd23d'],
];

// ---------------------------------------------------------------------------
// I-75 north out of Cincinnati to Mason: Mill Creek industry, the I-275 loop
// flying over at Exit 16, and the continuous Sharonville / West Chester / Mason
// suburban corridor. The map intentionally terminates before Dayton.
// ---------------------------------------------------------------------------
function buildI75Mason(scene, registry, towerMat) {
  const rand = rng(741);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  buildUrbanGround(scene, 147000, 179500, 900, 0x53564d, 65);
  buildNearMetroFabric(scene, registry, 147000, 179500, 7450, {
    step: 72, depth: 2, hMin: 5, hRange: 12,
    colors: [0xb9b7ad, 0xa9afb1, 0x8b8278, 0xc7c2b7, 0x87949a],
  });

  // --- Mill Creek valley: rail-yard warehouses and plants tight to the road
  const ind = [];
  for (let s = 138400; s < 146800; s += 55 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue;
      const lat = side * (36 + rand() * 320);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      ind.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.25,
        sx: 26 + rand() * 50, sy: 7 + rand() * 9, sz: 20 + rand() * 40,
      }, s, lat, 1));
    }
  }
  scatterInstanced(scene, box,
    new THREE.MeshStandardMaterial({ color: 0xb2ada2, roughness: 0.9 }), ind);
  buildTrees(scene, 742, 138000, 147500, 20, 48, 260, 70);
  deepSprawl(scene, 7440, 138000, 147500, {
    density: 1.45, towers: false, latStart: 20, litMat: lowLitMaterial(registry),
  });
  for (const [s0, s1, seed] of [[138000, 141000, 7441], [142000, 146500, 7442]]) {
    buildNoiseWall(scene, s0, s1, { seed, height: 5.3, margin: 4.6, step: 11, gapChance: 0.12 });
  }

  // --- suburbs: Sharonville → West Chester → Mason
  buildSuburb(scene, registry, 147500, 176000);
  buildSuburb(scene, registry, 176000, 179500);
  buildTrees(scene, 741, 147000, 179500, 24, 60, 340, 80);
  for (const [s0, s1, seed] of [[148000, 152200, 7461], [153100, 157900, 7462], [159700, 164800, 7463], [166000, 170800, 7464]]) {
    buildNoiseWall(scene, s0, s1, { seed, height: 5.0, margin: 4.8, step: 12, gapChance: 0.16 });
  }

  // --- the I-275 beltway flying over I-75 at Exit 16 (s = 158830)
  const ix = 158830;
  const deckY = groundY(ix, 0) + 9.2;
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b929a, roughness: 0.6, metalness: 0.3 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2e3134, roughness: 0.95 });
  const ixGroup = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2400, 1.3, 27), asphalt);
  deck.position.y = deckY; ixGroup.add(deck);
  for (const off of [-13.8, 13.8]) {           // parapets
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2400, 1.0, 0.5), steel);
    rail.position.set(0, deckY + 1.1, off); ixGroup.add(rail);
  }
  const pierGeo = new THREE.CylinderGeometry(1.3, 1.5, deckY, 10);
  const clear = pavedHalfAt(ix) + 7;
  for (let x = -1180; x <= 1180; x += 46) {
    if (Math.abs(x) < clear) continue;         // nothing lands on I-75 pavement
    const pier = new THREE.Mesh(pierGeo, steel);
    pier.position.set(x, deckY / 2, 0); ixGroup.add(pier);
  }
  ixGroup.position.copy(posAt(ix, 0, new THREE.Vector3()));
  ixGroup.rotation.y = headingAt(ix);
  scene.add(ixGroup);
  // interchange signage, both bounds: advance + at the split
  const ixBoard = () => textBoard(['EXIT 16 · I-275', 'EAST COLUMBUS', 'WEST INDIANAPOLIS'], 8.6, 3.6, '#046a38', '#ffffff');
  const a1mi = textBoard(['I-275 LOOP', 'EXIT 16 · 1 MILE', ''], 8.6, 3.2, '#046a38', '#ffffff'); a1mi.rotation.y = Math.PI;
  gantry(scene, registry, ix - 1650, [{ lat: -6, mesh: a1mi }], 6.9);
  const aHere = ixBoard(); aHere.rotation.y = Math.PI;
  gantry(scene, registry, ix - 320, [{ lat: -6, mesh: aHere }], 6.9);
  gantry(scene, registry, ix + 1650, [{ lat: 6, mesh: textBoard(['I-275 LOOP', 'EXIT 16 · 1 MILE', ''], 8.6, 3.2, '#046a38', '#ffffff') }], 6.9);
  gantry(scene, registry, ix + 320, [{ lat: 6, mesh: ixBoard() }], 6.9);

  // Mason terminal: a final suburban interchange band instead of a Dayton
  // detour. Keep the northern edge visually developed but clearly finite.
  buildBillboards(scene, registry, 643, 148000, 179200, 18, MIDWEST_ADS);
  welcomeSign(scene, registry, 178400, 1, ['MASON', 'NORTHERN CINCINNATI SUBURBS', 'END OF ROUTE'], '#046a38');
}

// ---------------------------------------------------------------------------
// Skyline cluster of lit-window towers (Indianapolis, Cincinnati).
// ---------------------------------------------------------------------------
function buildSkyline(scene, seed, s0, s1, opts) {
  const { latMin, latMax, hMin, hMax } = opts;
  const mats = opts.mats || [opts.towerMat];   // one InstancedMesh per material
  const sides = opts.side ? [opts.side] : [-1, 1];
  const rand = rng(seed);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const buckets = mats.map(() => []);
  for (let s = s0; s < s1; s += 22 * (0.6 + rand() * 0.8)) {
    for (const sd of sides) {
      if (rand() < 0.18) continue;
      const lat = sd * (latMin + rand() * (latMax - latMin));
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const b = clampOffRoad({
        pos, rot: rand() * TAU,
        sx: 16 + rand() * 30, sz: 16 + rand() * 30,
        sy: hMin + Math.pow(rand(), 1.4) * (hMax - hMin),
        color: new THREE.Color(0xffffff).multiplyScalar(0.68 + rand() * 0.4),
      }, s, lat, 3);
      buckets[(rand() * mats.length) | 0].push(b);
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  buckets.forEach((places, mi) => {
    if (!places.length) return;
    const mesh = new THREE.InstancedMesh(boxGeo, mats[mi], places.length);
    places.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.rot);
      sc.set(b.sx, b.sy, b.sz);
      m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, b.color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

// A single signature tower at (s, lat): tall box + optional crown.
function signatureTower(scene, towerMat, s, lat, w, h, color, crown) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
  const mesh = new THREE.InstancedMesh(boxGeo, towerMat, 1);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), headingAt(s));
  m.compose(pos, q, new THREE.Vector3(w, h, w * 0.85));
  mesh.setMatrixAt(0, m);
  mesh.setColorAt(0, color);
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  scene.add(mesh);
  if (crown) {
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(0, w * 0.5, w * 0.7, 4, 1, true),
      new THREE.MeshStandardMaterial({ color: crown, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }));
    c.position.copy(pos).y += h + w * 0.32;
    c.rotation.y = headingAt(s) + Math.PI / 4;
    scene.add(c);
  }
}

// Close-in metropolitan fabric used where the wider deep-sprawl bands can
// otherwise read as a distant backdrop with an empty verge in front of it.
// Two irregular depth bands, parking/service aprons and varied orientation
// create a continuous corridor without putting any mesh inside the clear zone.
function buildNearMetroFabric(scene, registry, s0, s1, seed, opts = {}) {
  const rand = rng(seed);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const buildings = [], aprons = [];
  const step = opts.step || 76;
  const depth = opts.depth || 2;
  const colors = opts.colors || [0xb8b5aa, 0xa6adb0, 0x927d6d, 0xc2beb2, 0x817873];
  for (let s = s0; s < s1; s += step * (0.72 + rand() * 0.55)) {
    for (const side of [-1, 1]) {
      for (let band = 0; band < depth; band++) {
        if (rand() < (band ? 0.18 : 0.08)) continue;
        const clear = roadClearAt(s) + 12;
        const lat = side * (clear + 28 + band * 72 + rand() * 42);
        const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
        const b = clampOffRoad({
          pos,
          rot: headingAt(s) + (rand() - 0.5) * (band ? 0.55 : 0.28),
          sx: 24 + rand() * (band ? 66 : 48),
          sy: (opts.hMin || 6) + rand() * (opts.hRange || 13),
          sz: 20 + rand() * 48,
          color: new THREE.Color(colors[(rand() * colors.length) | 0]),
        }, s, lat, 4);
        buildings.push(b);
        const apronPos = posAt(s, lat - side * (b.sz * 0.45 + 12), new THREE.Vector3());
        apronPos.y = groundY(s, lat - side * (b.sz * 0.45 + 12)) + 0.08;
        aprons.push({ pos: apronPos, rot: headingAt(s), sx: b.sx * 1.3, sy: 0.16, sz: 18 + rand() * 18 });
      }
    }
  }
  scatterInstanced(scene, box, lowLitMaterial(registry), buildings);
  scatterInstanced(scene, box,
    new THREE.MeshStandardMaterial({ color: opts.apronColor || 0x4d4f50, roughness: 0.98 }), aprons);
}

// Indianapolis: I-65 passes the metro with one brief downtown view off the
// driver's right. Most of the experience is wooded/walled freeway, bridges
// and low suburban fabric rather than a continuous skyline.
function buildIndy(scene, registry, towerMat) {
  buildUrbanGround(scene, 79000, 95000, 950, 0x50514c, 60);
  buildNearMetroFabric(scene, registry, 79000, 95000, 5070, {
    step: 70, depth: 2, hMin: 6, hRange: 12,
    colors: [0xb7b5ae, 0xa7afb1, 0x8e8174, 0xc4c0b5, 0x77858d],
  });
  buildSkyline(scene, 501, 84600, 85800, {
    latMin: 520, latMax: 880, hMin: 38, hMax: 105, side: -1, towerMat,
  });
  signatureTower(scene, towerMat, 85200, -650, 25, 122, new THREE.Color(0xdfe6ee));

  // Suburban office parks, logistics yards and low industrial fabric ring the
  // west/south bypass. The skyline is only the short right-side glimpse above.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fa6b8, roughness: 0.25, metalness: 0.5 });
  scatterInstanced(scene, boxGeo, glassMat,
    placementsAlong(502, 79000, 95000, 95, 85, 390, (rand, pos, s) => ({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.5,
      sx: 30 + rand() * 70, sy: 7 + rand() * 15, sz: 24 + rand() * 54,
      color: new THREE.Color(0xffffff).multiplyScalar(0.8 + rand() * 0.3),
    }), 20));
  // the metro recedes for miles behind a roadside tree/commercial buffer —
  // continuous Indy suburb both sides (flat, landlocked), not a thin row of
  // houses on the shoulder and then bare field
  deepSprawl(scene, 5030, 79000, 95000, { towers: false, glowMat: towerMat, density: 1.65, litMat: lowLitMaterial(registry) });
  buildTrees(scene, 504, 79000, 95000, 14, 42, 420, 150);          // dense bypass tree/wall screen
  for (const [s0, s1, seed] of [[79200, 83250, 5061], [83550, 88150, 5062], [88450, 92450, 5063], [92700, 94700, 5064]]) {
    buildNoiseWall(scene, s0, s1, { seed, height: 5.4, margin: 4.7, step: 11, gapChance: 0.1 });
  }
  const indyCrossings = [
    [79600, 'I-865 / I-465'], [80800, '71ST ST'], [82100, '56TH ST'], [83400, '38TH ST'],
    [84700, 'I-74 / CRAWFORDSVILLE RD'], [86000, '10TH ST'], [87300, 'I-70 / ST LOUIS'],
    [88600, 'US-40 / AIRPORT'], [89900, 'KENTUCKY AVE'], [91200, 'US-31 SOUTH'],
    [92500, 'I-74 EAST / CINCINNATI'], [93900, 'SOUTHPORT RD'],
  ];
  for (const [s, name] of indyCrossings) cityOverpass(scene, registry, s, name);
  buildLocalStreetGrid(scene, indyCrossings, 1250);
  const indyViaducts = [[79900, 83200], [85600, 89100], [91500, 94500]];
  buildUrbanViaductPiers(scene, indyViaducts);
  buildViaductFascias(scene, indyViaducts);
  for (const [s, lines] of [
    [81200, ['I-465 SOUTH', 'INDIANAPOLIS BYPASS', 'AIRPORT · I-70']],
    [84600, ['I-465 SOUTH', 'I-74 · CRAWFORDSVILLE', 'I-70 · ST LOUIS']],
    [87500, ['I-465 SOUTH / EAST', 'AIRPORT · I-74', 'CINCINNATI']],
    [91400, ['I-74 EAST', 'SHELBYVILLE · CINCINNATI', 'THROUGH TRAFFIC']],
  ]) {
    gantry(scene, registry, s, [
      { lat: 0, mesh: textBoard(lines, 14, 3.4, '#046a38', '#ffffff') },
    ], 6.9);
  }
  buildBillboards(scene, registry, 505, 79000, 95000, 26);
}

// I-65 through Indiana: distribution sheds, truck services, farm edges, and
// tree belts fill the long corridor between Gary and Indianapolis.
function buildIndiana65(scene, registry) {
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const warehouse = new THREE.MeshStandardMaterial({ color: 0xb4b9bc, roughness: 0.86 });
  const yard = [];
  const rand = rng(755);
  for (let s = 51200; s < 78500; s += 100 + rand() * 130) {
    if (rand() < 0.28) continue;
    for (const side of [-1, 1]) {
      const lat = side * (70 + rand() * 330);
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      yard.push({ pos: p, rot: headingAt(s) + (rand() - 0.5) * 0.18,
        sx: 42 + rand() * 90, sy: 7 + rand() * 7, sz: 32 + rand() * 70,
        color: new THREE.Color(0xffffff).multiplyScalar(0.78 + rand() * 0.2) });
    }
  }
  scatterInstanced(scene, box, warehouse, yard);
  buildTrees(scene, 756, 51200, 73000, 58, 92, 430, 55);
  buildTrees(scene, 758, 73000, 78500, 24, 55, 400, 95);
  buildBillboards(scene, registry, 757, 51200, 78500, 18, MIDWEST_ADS);
  roadsideBox(scene, 54800, 1, 72, 46, 0xd7d2c8, 0xd71920,
    ['TRUCK PLAZA', 'DIESEL · FOOD', 'I-65'], '#0d6b3f');
  roadsideBox(scene, 68600, -1, 66, 42, 0xd9dfe2, 0x1b4fa0,
    ['LAFAYETTE', 'NEXT EXIT', 'PURDUE'], '#0b3d91');
}

// Cincinnati: wooded I-74 western approach into the I-75 north junction. This
// route bypasses downtown; the riverfront and skyline are not on this path.
function buildCincinnati(scene, registry, towerMat) {
  // --- the wooded western-hills descent (Cheviot / White Oak / Colerain) ------
  // I-74 comes into Cincinnati over ridgelines packed with houses before it
  // drops to the I-75 junction and the river. Hillside homes + a strip or two.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x574a3e, roughness: 0.95 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x8f4a38, roughness: 0.9 });
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xe0dcd2];
  buildUrbanGround(scene, 131500, 147500, 900, 0x4e504b, 55);
  buildNearMetroFabric(scene, registry, 125000, 147500, 6180, {
    step: 66, depth: 2, hMin: 6, hRange: 16,
    colors: [0xb8ad9e, 0x9a6a55, 0xa9afb0, 0xc2bdaa, 0x7e746d],
  });
  const hillHomes = placementsAlong(610, 125500, 133500, 18, 60, 420, (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.3,
    sx: 8 + r() * 5, sy: 4 + r() * 3, sz: 8 + r() * 4,
    color: new THREE.Color(siding[(r() * siding.length) | 0]),
  }), 4);
  scatterInstanced(scene, boxGeo, bodyMat, hillHomes);
  scatterInstanced(scene, boxGeo, roofMat, hillHomes.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
    sx: h.sx * 1.12, sy: 0.5, sz: h.sz * 1.12,
  })));
  // denser brick apartment mid-rises closer in (Fairmount / West End)
  scatterInstanced(scene, boxGeo, brickMat,
    placementsAlong(611, 132500, 134500, 20, 40, 200, (r, pos, s) => ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.2,
      sx: 12 + r() * 12, sy: 12 + Math.pow(r(), 1.3) * 40, sz: 12 + r() * 12,
      color: new THREE.Color([0x8f4a38, 0x9a5a44, 0x77503f, 0xa5866a][(r() * 4) | 0]),
    }), 4));
  buildTrees(scene, 602, 125000, 133000, 22, 60, 360, 90);   // wooded approach hills
  deepSprawl(scene, 6190, 124500, 138000, {
    density: 1.55, towers: false, latStart: 45, litMat: lowLitMaterial(registry),
  });
  for (const [s0, s1, seed] of [[125000, 128300, 6191], [129200, 132200, 6192], [135800, 138000, 6193]]) {
    buildNoiseWall(scene, s0, s1, { seed, height: 5.1, margin: 4.8, step: 11, gapChance: 0.1 });
  }
  churchSteeple(scene, 129000, -140);
  // The approach stays developed into the I-75 junction: hillside homes give
  // way to apartment blocks and frequent cross streets rather than an empty
  // gap before the northbound turn.
  buildTrees(scene, 612, 132800, 134900, 18, 46, 240, 70);
  for (const [s, street] of [[133250, 'ELMORE AVE'], [133900, 'WESTERN HILLS'], [134550, 'I-75 NORTH · DAYTON']]) {
    cityOverpass(scene, registry, s, street);
  }

  buildTrees(scene, 613, 133000, 147000, 12, 44, 360, 145);
  highwayTransition(scene, registry, 135400, [
    ['I-75 NORTH', 'MILL CREEK · MASON'],
    ['I-75 SOUTH', 'DOWNTOWN · LEXINGTON'],
    ['I-74 WEST', 'INDIANAPOLIS'],
  ]);
  for (const [s, street] of [[135150, 'SPRING GROVE AVE'], [136050, 'MITCHELL AVE'], [137150, 'NORWOOD LATERAL']]) {
    cityOverpass(scene, registry, s, street);
  }
  const cincyViaducts = [[127500, 130800], [132500, 137700], [139100, 145500]];
  buildUrbanViaductPiers(scene, cincyViaducts);
  buildViaductFascias(scene, cincyViaducts);
  buildBillboards(scene, registry, 603, 125500, 137500, 18, MIDWEST_ADS);
  welcomeSign(scene, registry, 133600, 1, ['CINCINNATI', 'I-75 NORTH · DAYTON', 'SHARONVILLE · MASON'], '#0b3d91');
}

function buildCincinnatiCoreTunnel(scene, s0, s1) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x74787b, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2227, roughness: 0.96 });
  for (let s = s0; s <= s1; s += 105) {
    const p = posAt(s, 0, new THREE.Vector3());
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), dark);
    roof.position.copy(p); roof.position.y = groundY(s, 0) + 8;
    roof.rotation.y = headingAt(s); roof.scale.set(46, 1.1, 112); scene.add(roof);
    for (const side of [-1, 1]) {
      const lat = side * (pavedHalfAt(s) + 1.5);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), concrete);
      wall.position.copy(posAt(s, lat, new THREE.Vector3()));
      wall.position.y = groundY(s, lat) + 4;
      wall.rotation.y = headingAt(s); wall.scale.set(1.2, 8, 112); scene.add(wall);
    }
  }
  for (const s of [s0, s1]) {
    const portal = new THREE.Group();
    const p = posAt(s, 0, new THREE.Vector3());
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 2), concrete);
      post.position.set(side * (pavedHalfAt(s) + 1.5), 4, 0); portal.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(46, 2, 2), concrete);
    beam.position.y = 8; portal.add(beam);
    portal.position.copy(p); portal.position.y = groundY(s, 0); portal.rotation.y = headingAt(s);
    scene.add(portal);
  }
}

// John A. Roebling Suspension Bridge: two sandstone towers, a slung deck, and
// draped main cables approximated by thin angled members.
function roeblingBridge(scene, s, riverLat) {
  const grp = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xc7b79a, roughness: 0.85 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x2b6cb0, roughness: 0.5, metalness: 0.5 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x50555c, roughness: 0.8 });
  const span = 150;                          // reaches across the river band
  const towerH = 34, deckY = 9;
  // deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 1, span), deckMat);
  deck.position.y = deckY; grp.add(deck);
  // two towers straddling the deck
  for (const tz of [-span * 0.32, span * 0.32]) {
    for (const tx of [-4.5, 4.5]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(3, towerH, 3), towerMat);
      t.position.set(tx, towerH / 2, tz); grp.add(t);
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 3), towerMat);
    cross.position.set(0, towerH - 2, tz); grp.add(cross);
  }
  // main cables: draped catenary approximated by short chords each side
  for (const cx of [-4.5, 4.5]) {
    const zs = [-span / 2, -span * 0.32, 0, span * 0.32, span / 2];
    const ys = [deckY, towerH, deckY + 4, towerH, deckY];
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i], z1 = zs[i + 1], y0 = ys[i], y1 = ys[i + 1];
      const len = Math.hypot(z1 - z0, y1 - y0);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, len, 6), cableMat);
      seg.position.set(cx, (y0 + y1) / 2, (z0 + z1) / 2);
      seg.rotation.x = Math.atan2(z1 - z0, y1 - y0);
      grp.add(seg);
    }
  }
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const p = posAt(s, riverLat, new THREE.Vector3()); p.y = groundY(s, riverLat) - 1;
  grp.position.copy(p);
  grp.rotation.y = headingAt(s) + Math.PI / 2;   // span runs across the river
  scene.add(grp);
}

// riverfront stadium: an open oval bowl (seating ring) around a green field.
function riverStadium(scene, s, lat, trimColor, football) {
  const grp = new THREE.Group();
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, emissive: trimColor, emissiveIntensity: 0.3, roughness: 0.6 });
  const fieldMat = new THREE.MeshStandardMaterial({ color: 0x2f6a34, roughness: 0.95 });
  const rx = football ? 46 : 44, rz = football ? 38 : 44;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 14, 28, 1, true), bowlMat);
  ring.scale.set(rx, 1, rz); ring.position.y = 7; ring.material.side = THREE.DoubleSide; grp.add(ring);
  const trim = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 28, 1, true), trimMat);
  trim.scale.set(rx * 1.02, 1, rz * 1.02); trim.position.y = 13; trim.material.side = THREE.DoubleSide; grp.add(trim);
  const field = new THREE.Mesh(new THREE.CircleGeometry(1, 24), fieldMat);
  field.rotation.x = -Math.PI / 2; field.scale.set(rx * 0.7, rz * 0.7, 1); field.position.y = 0.3; grp.add(field);
  // light towers
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 22, 6),
      new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.6, metalness: 0.5 }));
    mast.position.set(Math.cos(a) * rx, 18, Math.sin(a) * rz); grp.add(mast);
    const bank = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 0.5, roughness: 0.4 }));
    bank.position.set(Math.cos(a) * rx, 28, Math.sin(a) * rz); grp.add(bank);
  }
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  grp.position.copy(p); grp.rotation.y = headingAt(s);
  scene.add(grp);
}

// A thin vertical antenna/mast on top of a signature tower.
function antenna(scene, s, lat, y0, h, r = 0.5) {
  const g = new THREE.CylinderGeometry(r * 0.3, r, h, 6); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.7 }));
  const p = posAt(s, lat, new THREE.Vector3()); p.y = y0;
  m.position.copy(p);
  scene.add(m);
}

// Simple parked jet silhouette: fuselage + swept wings + tail.
function makePlane(scene, s, lat, rot) {
  const white = new THREE.MeshStandardMaterial({ color: 0xeef1f4, roughness: 0.6, metalness: 0.2 });
  const grp = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 34, 10), white);
  fus.rotation.z = Math.PI / 2; fus.position.y = 3;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 30), white); wing.position.y = 2.6;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 6, 0.5), white); tail.position.set(-14, 6, 0);
  grp.add(fus, wing, tail);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  grp.position.copy(p); grp.rotation.y = rot;
  scene.add(grp);
}

// ---------------------------------------------------------------------------
// I-74 corridor towns between Indianapolis and Cincinnati: Shelbyville,
// Greensburg (the courthouse "Tower Tree"), Batesville — brick main streets,
// church steeples, municipal water towers, a fireworks superstore, a truck
// stop. The real small towns the interstate threads between the two cities.
// ---------------------------------------------------------------------------

// municipal water tower: spheroid tank on splayed steel legs, town name banded
function waterTower(scene, s, lat, bowlColor, label) {
  const grp = new THREE.Group();
  const tankMat = new THREE.MeshStandardMaterial({ color: bowlColor, roughness: 0.5, metalness: 0.35 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0xaeb4b8, roughness: 0.6, metalness: 0.5 });
  const H = 24;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, H, 6), legMat);
    leg.position.set(Math.cos(a) * 4.6, H / 2, Math.sin(a) * 4.6);
    leg.rotation.z = Math.cos(a) * 0.12; leg.rotation.x = -Math.sin(a) * 0.12;
    grp.add(leg);
  }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(7.5, 16, 12), tankMat);
  bowl.scale.y = 0.68; bowl.position.y = H + 3.5; grp.add(bowl);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2, 3.5, 10), tankMat);
  cap.position.y = H + 9; grp.add(cap);
  if (label) {
    const css = '#' + (bowlColor >>> 0).toString(16).padStart(6, '0').slice(-6);
    for (const face of [1, -1]) {
      const band = textBoard([label], 12, 3.6, css, '#16407a');
      band.position.set(0, H + 3.4, face * 5.6);
      if (face < 0) band.rotation.y = Math.PI;
      grp.add(band);
    }
  }
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  grp.position.copy(p); grp.rotation.y = headingAt(s);
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(grp);
}

// white clapboard church with a steeple + spire — the tallest thing in town
function churchSteeple(scene, s, lat) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf1eee6, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  const grp = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(12, 7, 22), white); nave.position.y = 3.5;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 7.6, 4, 4, 1), roofMat);
  roof.rotation.y = Math.PI / 4; roof.position.y = 9; roof.scale.z = 22 / 15;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 16, 5), white);
  tower.position.set(0, 8, 11);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.6, 9, 4), white);
  spire.rotation.y = Math.PI / 4; spire.position.set(0, 20.5, 11);
  grp.add(nave, roof, tower, spire);
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  grp.position.copy(p); grp.rotation.y = headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2);
  scene.add(grp);
}

// a compact town: houses, a short brick main-street block, a church steeple
function farmTown(scene, seed, sMid, side, span, label) {
  const s0 = sMid - span / 2, s1 = sMid + span / 2;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3e, roughness: 0.95 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0x8f4a38, roughness: 0.92 });
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xe0dcd2, 0xbfae9a];
  const wrongSide = (lat) => (side > 0 ? lat < 0 : lat > 0);
  // brick two-story main street set close to the highway
  const main = placementsAlong(seed, s0 + 120, s1 - 120, 26, 70, 150, (r, pos, s, lat) =>
    wrongSide(lat) ? null : ({
      pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.1,
      sx: 12 + r() * 10, sy: 7 + r() * 5, sz: 11 + r() * 7,
      color: new THREE.Color([0x8f4a38, 0x9a5a44, 0xa5866a, 0x77503f][(r() * 4) | 0]),
    }), 6);
  scatterInstanced(scene, boxGeo, brickMat, main);
  // ranch/frame houses filling in behind
  const houses = placementsAlong(seed + 1, s0, s1, 20, 150, 520, (r, pos, s, lat) =>
    wrongSide(lat) ? null : ({
      pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.3,
      sx: 8 + r() * 5, sy: 3.4 + r() * 2.2, sz: 7 + r() * 4,
      color: new THREE.Color(siding[(r() * siding.length) | 0]),
    }));
  scatterInstanced(scene, boxGeo, bodyMat, houses);
  scatterInstanced(scene, boxGeo, roofMat, houses.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
    sx: h.sx * 1.12, sy: 0.5, sz: h.sz * 1.12,
  })));
  buildTrees(scene, seed + 2, s0, s1, 26, 60, 480, 40);
  churchSteeple(scene, sMid + span * 0.18, side * 130);
  waterTower(scene, sMid - span * 0.28, side * 190, 0xdfe4e8, label);
}

// Greensburg's Decatur County Courthouse — the one with a tree growing out of
// the clock tower ("The Tower Tree"), the town's real-life claim to fame.
function greensburgCourthouse(scene, s, lat) {
  const grp = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xbdb2a0, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3f5a4a, roughness: 0.85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(26, 14, 20), stone); base.position.y = 7;
  const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 17, 5, 4, 1), roofMat);
  hip.rotation.y = Math.PI / 4; hip.position.y = 16.5; hip.scale.z = 20 / 24;
  const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 22, 8), stone); tower.position.y = 25;
  // clock faces
  const clockMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e4, roughness: 0.5, emissive: 0x2a2a20, emissiveIntensity: 0.2 });
  for (const [dx, dz, ry] of [[4.05, 0, Math.PI / 2], [-4.05, 0, Math.PI / 2], [0, 4.05, 0], [0, -4.05, 0]]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(2, 16), clockMat);
    c.position.set(dx, 31, dz); c.rotation.y = ry; grp.add(c);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(5.5, 9, 4), roofMat);
  spire.rotation.y = Math.PI / 4; spire.position.y = 40.5;
  // the tree, growing from the very top
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3, 5),
    new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }));
  trunk.position.y = 46;
  const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 0),
    new THREE.MeshStandardMaterial({ color: 0x3d7a34, roughness: 1 }));
  foliage.position.y = 49;
  grp.add(base, hip, tower, spire, trunk, foliage);
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  grp.position.copy(p); grp.rotation.y = headingAt(s);
  scene.add(grp);
}

// big-box roadside retail with a tall pylon sign — fireworks superstore, truck
// stop. The kind of thing that lights up at every rural I-74 interchange.
function roadsideBox(scene, s, side, w, d, bodyColor, fascia, pylonText, pylonBg) {
  const lat = side * (95 + Math.random() * 20);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  const rot = headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2);
  const body = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.9 }));
  body.scale.set(w, 8, d); body.position.copy(p); body.rotation.y = rot; body.castShadow = true;
  const strip = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: fascia, emissive: fascia, emissiveIntensity: 0.35, roughness: 0.5 }));
  strip.scale.set(w * 0.98, 2, d + 0.4); strip.position.copy(p).setY(p.y + 6); strip.rotation.y = rot;
  scene.add(body, strip);
  // parking apron
  const lot = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x3a3b3d, roughness: 1 }));
  lot.scale.set(w * 1.3, 0.05, 30); lot.position.copy(p).setY(p.y + 0.02).addScaledVector(new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot)), 0);
  lot.rotation.y = rot; scene.add(lot);
  // pylon sign toward the road
  const pl = posAt(s, side * 40, new THREE.Vector3()); pl.y = groundY(s, side * 40);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 18, 8),
    new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.6, metalness: 0.5 }));
  pole.position.copy(pl).setY(pl.y + 9); scene.add(pole);
  const sign = textBoard(pylonText, 9, 6, pylonBg, '#ffffff');
  sign.material.emissiveIntensity = 0.9;
  sign.position.copy(pl).setY(pl.y + 20); sign.rotation.y = headingAt(s) + (side > 0 ? 0 : Math.PI);
  scene.add(sign);
}

function buildI74Corridor(scene, registry) {
  // Shelbyville (farm country, west), Greensburg (with the courthouse + tree),
  // Batesville (up in the hills). Alternating sides so both windows get a town.
  farmTown(scene, 810, 99500, -1, 1100, 'SHELBYVILLE');
  farmTown(scene, 820, 107000, 1, 1300, 'GREENSBURG');
  greensburgCourthouse(scene, 107100, 210);
  farmTown(scene, 830, 116500, -1, 1000, 'BATESVILLE');
  // classic roadside interchange retail
  roadsideBox(scene, 103200, 1, 70, 40, 0xd9cdb8, 0xc8102e,
    ['FIREWORKS', 'SUPERSTORE', 'EXIT NOW'], '#c8102e');
  roadsideBox(scene, 112000, -1, 60, 45, 0xdedae2, 0x1b4fa0,
    ['TRUCK STOP', 'DIESEL · FOOD', '24 HRS'], '#0d6b3f');
  // county-road overpass silhouettes so the farm run isn't dead-flat empty
  welcomeSign(scene, registry, 96200, 1, ['I-74 EAST', 'CINCINNATI', 'BATESVILLE · GREENSBURG'], '#0b3d91');
}

// ---------------------------------------------------------------------------
// CTA rolling stock: stainless cars with the line-colour stripe under the
// windows. Window band glows after dark (registry.euroLit is the generic
// lit-at-night material list).
// ---------------------------------------------------------------------------
function ctaCars(parent, registry, stripeHex, cars = 8) {
  const silver = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.35, metalness: 0.55 });
  const stripe = new THREE.MeshStandardMaterial({ color: stripeHex, roughness: 0.5 });
  const win = new THREE.MeshStandardMaterial({
    color: 0x1a222c, roughness: 0.2, metalness: 0.4,
    emissive: 0xffe9b8, emissiveIntensity: 0,
  });
  (registry.euroLit ||= []).push(win);
  for (let c = 0; c < cars; c++) {
    const z = -c * 15 + (cars - 1) * 7.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.9, 14.2), silver);
    body.position.set(0, 2.1, z); parent.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.84, 0.5, 14.2), stripe);
    band.position.set(0, 1.05, z); parent.add(band);
    const w = new THREE.Mesh(new THREE.BoxGeometry(2.86, 0.8, 13), win);
    w.position.set(0, 2.7, z); parent.add(w);
  }
}

// CTA island station in the expressway median: side platforms, canopy, lit
// name boards at both ends — the way the Blue/Red Line stations really sit.
function ctaStation(scene, registry, s, name, colorCss) {
  const conc = new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.55, metalness: 0.6 });
  const g = new THREE.Group();
  for (const dx of [-2.55, 2.55]) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 92), conc);
    plat.position.set(dx, 0.7, 0); g.add(plat);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.28, 58), steel);
  canopy.position.y = 4.5; g.add(canopy);
  for (let z = -24; z <= 24; z += 16) {
    for (const dx of [-2.5, 2.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.3, 6), steel);
      post.position.set(dx, 2.6, z); g.add(post);
    }
  }
  for (const face of [1, -1]) {
    const board = textBoard([name], 7, 1.4, colorCss, '#ffffff');
    board.position.set(0, 3.4, face * 30);
    if (face < 0) board.rotation.y = Math.PI;
    g.add(board);
    registry.signs.push({ userData: { board } });
  }
  g.position.copy(posAt(s, 0, new THREE.Vector3()));
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// The CTA riding the expressway median (Blue Line in the Kennedy, Red Line in
// the Dan Ryan): trackbed, rails + third rail, low barrier walls, stations,
// and two 8-car trains shuttling opposite ways.
const _chiV = new THREE.Vector3();
function medianRail(scene, registry, s0, s1, stripeHex, colorCss, stations) {
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x6f6a60, roughness: 1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.7 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xb2aea4, roughness: 0.92 });
  const step = 40;
  const bedPts = [];
  for (let s = s0; s <= s1; s += step) {
    const pos = posAt(s, 0, new THREE.Vector3()); pos.y += 0.16;
    bedPts.push({ pos, rot: headingAt(s), sx: 1, sy: 1, sz: 1 });
  }
  scatterInstanced(scene, new THREE.BoxGeometry(6.4, 0.34, step + 2), bedMat, bedPts, { shadow: false });
  const railGeo = new THREE.BoxGeometry(0.16, 0.3, step + 1); railGeo.translate(0, 0.45, 0);
  for (const off of [-0.75, 0.75, 1.35]) {
    const pts = bedPts.map(p => ({
      pos: p.pos.clone().add(new THREE.Vector3(Math.cos(p.rot) * off, 0, -Math.sin(p.rot) * off)),
      rot: p.rot, sx: 1, sy: 1, sz: 1,
    }));
    scatterInstanced(scene, railGeo, railMat, pts, { shadow: false });
  }
  const wallGeo = new THREE.BoxGeometry(0.45, 1.05, step + 1); wallGeo.translate(0, 0.5, 0);
  for (const off of [-3.55, 3.55]) {
    const pts = bedPts.map(p => ({
      pos: p.pos.clone().add(new THREE.Vector3(Math.cos(p.rot) * off, -0.16, -Math.sin(p.rot) * off)),
      rot: p.rot, sx: 1, sy: 1, sz: 1,
    }));
    scatterInstanced(scene, wallGeo, wallMat, pts, { shadow: false });
  }
  for (const [s, name] of stations) ctaStation(scene, registry, s, name, colorCss);

  const mkTrain = () => {
    const t = new THREE.Group();
    ctaCars(t, registry, stripeHex, 8);
    scene.add(t);
    return t;
  };
  const trains = [
    { mesh: mkTrain(), s: s0 + 900, dir: 1 },
    { mesh: mkTrain(), s: s1 - 900, dir: -1 },
  ];
  (registry.chiMovers ||= []).push((dt) => {
    for (const tr of trains) {
      tr.s += tr.dir * 24 * dt;   // ~55 mph
      if (tr.s > s1 - 200) { tr.dir = -1; tr.s = s1 - 200; }
      if (tr.s < s0 + 200) { tr.dir = 1; tr.s = s0 + 200; }
      tr.mesh.position.copy(posAt(tr.s, 0, _chiV));
      tr.mesh.position.y += 0.5;
      tr.mesh.rotation.y = headingAt(tr.s) + (tr.dir < 0 ? Math.PI : 0);
    }
  });
}

// An elevated 'L' viaduct crossing over the expressway on rusty steel bents,
// with a train rumbling across — the classic view under the Loop approach.
function elCrossing(scene, registry, s, stripeHex, span = 720) {
  const rust = new THREE.MeshStandardMaterial({ color: 0x4f4238, roughness: 0.7, metalness: 0.5 });
  const g = new THREE.Group();
  const deckY = 9.2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 0.9, 7.4), rust);
  deck.position.y = deckY; g.add(deck);
  for (const dz of [-3.4, 3.4]) {
    const girder = new THREE.Mesh(new THREE.BoxGeometry(span, 1.7, 0.45), rust);
    girder.position.set(0, deckY + 0.6, dz); g.add(girder);
  }
  const clear = roadClearAt(s) + 4;
  for (let x = -span / 2 + 12; x < span / 2; x += 30) {
    if (Math.abs(x) < clear) continue;
    for (const dz of [-2.6, 2.6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, deckY, 0.9), rust);
      leg.position.set(x, deckY / 2 - 0.45, dz); g.add(leg);
    }
  }
  for (const x of [-clear, clear]) {   // heavy bents flanking the pavement
    const bent = new THREE.Mesh(new THREE.BoxGeometry(1.6, deckY, 6.4), rust);
    bent.position.set(x, deckY / 2 - 0.45, 0); g.add(bent);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const train = new THREE.Group();
  ctaCars(train, registry, stripeHex, 6);
  train.rotation.y = Math.PI / 2;      // cars run along the crossing
  train.position.y = deckY + 0.5;
  g.add(train);
  let x = -span / 2;
  (registry.chiMovers ||= []).push((dt) => {
    x += 15 * dt;
    if (x > span / 2) x = -span / 2;
    train.position.x = x;
  });
  g.position.copy(posAt(s, 0, new THREE.Vector3()));
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// The South Shore Line / Metra Electric beside the Skyway and Borman: ballast,
// catenary (it's electric), and a bilevel train running the industrial flats.
function southShoreLine(scene, registry, s0, s1, lat) {
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x7d7568, roughness: 1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.7 });
  const step = 40;
  const bedPts = [];
  for (let s = s0; s <= s1; s += step) {
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat) + 0.35;
    bedPts.push({ pos, rot: headingAt(s), sx: 1, sy: 1, sz: 1 });
  }
  scatterInstanced(scene, new THREE.BoxGeometry(8, 0.7, step + 2), bedMat, bedPts, { shadow: false });
  const railGeo = new THREE.BoxGeometry(0.18, 0.3, step + 1); railGeo.translate(0, 0.85, 0);
  for (const off of [-2.1, -0.6, 0.6, 2.1]) {
    const pts = bedPts.map(p => ({
      pos: p.pos.clone().add(new THREE.Vector3(Math.cos(p.rot) * off, 0, -Math.sin(p.rot) * off)),
      rot: p.rot, sx: 1, sy: 1, sz: 1,
    }));
    scatterInstanced(scene, railGeo, railMat, pts, { shadow: false });
  }
  const mastGeo = new THREE.CylinderGeometry(0.12, 0.16, 7.5, 5); mastGeo.translate(0, 3.75, 0);
  const mastPts = [];
  for (let s = s0; s <= s1; s += 70) {
    const pos = posAt(s, lat + 5, new THREE.Vector3()); pos.y = groundY(s, lat) + 0.5;
    mastPts.push({ pos, rot: headingAt(s), sx: 1, sy: 1, sz: 1 });
  }
  scatterInstanced(scene, mastGeo, railMat, mastPts, { shadow: false });

  const steel = new THREE.MeshStandardMaterial({ color: 0xd4d8dc, roughness: 0.3, metalness: 0.5 });
  const band = new THREE.MeshStandardMaterial({ color: 0xd2451e, roughness: 0.55 });
  const win = new THREE.MeshStandardMaterial({
    color: 0x1a222c, roughness: 0.2, metalness: 0.4, emissive: 0xffe9b8, emissiveIntensity: 0,
  });
  (registry.euroLit ||= []).push(win);
  const t = new THREE.Group();
  for (let c = 0; c < 6; c++) {
    const z = -c * 23 + 57.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 4.4, 22), steel);
    body.position.set(0, 2.8, z); t.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.7, 22), band);
    stripe.position.set(0, 1.3, z); t.add(stripe);
    const w = new THREE.Mesh(new THREE.BoxGeometry(3.06, 0.7, 20), win);
    w.position.set(0, 3.9, z); t.add(w);
  }
  scene.add(t);
  const tr = { s: s0 + 500 };
  (registry.chiMovers ||= []).push((dt) => {
    tr.s = s0 + ((tr.s - s0 + 26 * dt) % (s1 - s0));
    t.position.copy(posAt(tr.s, lat, _chiV));
    t.position.y = groundY(tr.s, lat) + 1.0;
    t.rotation.y = headingAt(tr.s);
  });
}

// Movers (CTA + South Shore + 'L' crossings): stepped every frame from main.
export function updateChicago(registry, dt) {
  if (!registry.chiMovers) return;
  for (const f of registry.chiMovers) f(dt);
}

// A sweeping flyover ramp arcing over the mainline — one strand of a big
// system interchange. Short deck chords approximate the curve; piers land
// clear of the pavement.
function flyoverRamp(scene, s, h, flip) {
  const conc = new THREE.MeshStandardMaterial({ color: 0x98948b, roughness: 0.92 });
  const g = new THREE.Group();
  const clear = roadClearAt(s);
  const R = clear + 90;
  const N = 22;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = (t - 0.5) * 2 * R * (flip ? -1 : 1);
    const y = 2.2 + h * Math.sin(t * Math.PI);
    const z = (flip ? -1 : 1) * 70 * Math.sin(t * Math.PI);   // gentle sweep off the mainline
    if (prev) {
      const dx = x - prev.x, dy = y - prev.y, dz = z - prev.z;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dz) + 0.8, 1.3, 9), conc);
      seg.position.set((x + prev.x) / 2, (y + prev.y) / 2, (z + prev.z) / 2);
      seg.rotation.y = -Math.atan2(dz, dx);
      seg.rotation.z = Math.atan2(dy, Math.hypot(dx, dz));
      g.add(seg);
    }
    if (i % 3 === 0 && Math.abs(x) > clear + 6 && y > 3) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, y, 4.5), conc);
      pier.position.set(x, y / 2 - 0.6, z);
      g.add(pier);
    }
    prev = { x, y, z };
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.copy(posAt(s, 0, new THREE.Vector3()));
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// System interchange: two stacked flyovers crossing the mainline plus the big
// green overhead guide signs on gantries ahead of the split.
function chicagoInterchange(scene, registry, s, boards) {
  flyoverRamp(scene, s - 90, 12, false);
  flyoverRamp(scene, s + 90, 17, true);
  const mk = (lines) => textBoard(lines, 9.5, 3.2, '#0d6b3f', '#ffffff');
  gantry(scene, registry, s - 700, [{ lat: -4, mesh: mk(boards[0]) }, { lat: 5, mesh: mk(boards[1]) }], 7.2);
  gantry(scene, registry, s - 250, [{ lat: 0, mesh: mk(boards[2]) }], 7.2);
}

// Route-to-route handoff: the ordinary exit system supplies the physical
// diverge/merge ramp, while this adds the unmistakable advance/fork signage
// and elevated connector that make a new interstate feel like a real choice.
function highwayTransition(scene, registry, s, boards) {
  flyoverRamp(scene, s - 90, 11, false);
  flyoverRamp(scene, s + 100, 15, true);
  const mk = (lines) => textBoard(lines, 9.2, 3.1, '#0d6b3f', '#ffffff');
  gantry(scene, registry, s - 800, [{ lat: -5, mesh: mk(boards[0]) }, { lat: 5, mesh: mk(boards[1]) }], 7.1);
  gantry(scene, registry, s - 290, [{ lat: 0, mesh: mk(boards[2]) }], 7.1);
}

// A cross-street overpass with the street name signed on the fascia.
function cityOverpass(scene, registry, s, street) {
  const conc = new THREE.MeshStandardMaterial({ color: 0x9a978e, roughness: 0.92 });
  const barrier = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.9 });
  const g = new THREE.Group();
  const span = (roadClearAt(s) + 14) * 2;
  const deckY = 7.2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 1.5, 9), conc);
  deck.position.y = deckY; g.add(deck);
  for (const dz of [-4.4, 4.4]) {
    const par = new THREE.Mesh(new THREE.BoxGeometry(span, 1.1, 0.5), barrier);
    par.position.set(0, deckY + 1.2, dz); g.add(par);
  }
  for (const dx of [-(span / 2 - 3), span / 2 - 3]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, deckY, 6), conc);
    pier.position.set(dx, deckY / 2 - 0.7, 0); g.add(pier);
  }
  for (const face of [1, -1]) {
    const sign = textBoard([street], 5.4, 1.7, '#0d6b3f', '#ffffff');
    sign.position.set(-6, deckY - 1.3, face * 4.7);
    if (face < 0) sign.rotation.y = Math.PI;
    g.add(sign);
    registry.signs.push({ userData: { board: sign } });
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.copy(posAt(s, 0, new THREE.Vector3()));
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// A route-following ground sheet replaces the default green terrain inside a
// metro. It sits on terrain, not at roadway elevation, so elevated highways
// visibly pass over city blocks, local streets and industrial yards.
export function buildUrbanGround(scene, s0, s1, halfWidth, color, step = 70) {
  const n = Math.ceil((s1 - s0) / step);
  // Keep the terrain treatment out of the freeway envelope.  The previous
  // implementation joined the two far edges with one enormous quad, which
  // crossed the carriageways and interpolated between only two terrain
  // samples.  It could therefore cover depressed roadway and float beside a
  // viaduct.  Sample several lateral bands on each side instead: every vertex
  // follows groundY(), while the live road and its structures stay clear.
  const lateralBands = 7;
  const vertsPerRow = lateralBands * 2;
  const pos = new Float32Array((n + 1) * vertsPerRow * 3);
  const idx = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n;
    const inner = Math.min(halfWidth - 2, roadClearAt(s) + 8);
    for (let sideI = 0; sideI < 2; sideI++) {
      const side = sideI === 0 ? -1 : 1;
      for (let j = 0; j < lateralBands; j++) {
        const t = j / (lateralBands - 1);
        const lat = side * (inner + (halfWidth - inner) * t);
        posAt(s, lat, p); p.y = groundY(s, lat) + 0.035;
        const v = i * vertsPerRow + sideI * lateralBands + j;
        pos.set([p.x, p.y, p.z], v * 3);
        if (i < n && j < lateralBands - 1) {
          const k = v, next = k + vertsPerRow;
          idx.push(k, next, k + 1, k + 1, next, next + 1);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  mesh.receiveShadow = true; mesh.userData.urbanGround = true; scene.add(mesh);
}

// Terrain-following surface street/yard strip. Unlike buildRibbon(), this is
// pinned to groundY rather than the freeway deck, so it remains populated
// ground beneath viaducts and beside depressed roadway.
function buildGroundStrip(scene, s0, s1, latAt, width, color, step = 34, yLift = 0.07) {
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const positions = new Float32Array((n + 1) * 2 * 3);
  const indices = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n;
    const center = typeof latAt === 'function' ? latAt(s) : latAt;
    for (let side = 0; side < 2; side++) {
      const lat = center + (side ? width * 0.5 : -width * 0.5);
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat) + yLift;
      positions.set([p.x, p.y, p.z], (i * 2 + side) * 3);
    }
    if (i < n) {
      const k = i * 2;
      indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.98 }));
  mesh.receiveShadow = true; mesh.userData.groundStreet = true; scene.add(mesh);
  return mesh;
}

function buildLocalStreetGrid(scene, crossings, width = 1500) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x343638, roughness: 0.98 });
  const sidewalk = new THREE.MeshStandardMaterial({ color: 0x85827a, roughness: 0.98 });
  for (const [s] of crossings) {
    const y = groundY(s, 0);
    const street = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 13), asphalt);
    street.position.copy(posAt(s, 0, new THREE.Vector3())); street.position.y = y + 0.07;
    street.rotation.y = headingAt(s); scene.add(street);
    for (const dz of [-7.4, 7.4]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, 1.8), sidewalk);
      walk.position.copy(street.position); walk.position.y = y + 0.1;
      const h = headingAt(s);
      walk.position.x += Math.sin(h) * dz; walk.position.z += Math.cos(h) * dz;
      walk.rotation.y = h; scene.add(walk);
    }
  }
}

function buildViaductFascias(scene, spans) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x666b6e, roughness: 0.82, metalness: 0.18 });
  const places = [];
  for (const [s0, s1] of spans) {
    for (let s = s0; s <= s1; s += 38) {
      for (const side of [-1, 1]) {
        const lat = side * (pavedHalfAt(s) + 0.55);
        const p = posAt(s, lat, new THREE.Vector3());
        if (p.y - groundY(s, lat) < 2.4) continue;
        p.y -= 1.05;
        places.push({ pos: p, rot: headingAt(s), sx: 0.7, sy: 2.1, sz: 40 });
      }
    }
  }
  const mesh = scatterInstanced(scene, geo, mat, places, { shadow: false });
  mesh.userData.viaductFascia = true;
}

// Support raised metro portions with real outer-line bents. Columns use the
// actual roadway-to-terrain separation and never enter a travel lane.
function buildUrbanViaductPiers(scene, spans) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x858889, roughness: 0.94 });
  const places = [];
  for (const [s0, s1] of spans) {
    for (let s = s0; s <= s1; s += 44) {
      for (const side of [-1, 1]) {
        const lat = side * (pavedHalfAt(s) + 2.8);
        const deck = posAt(s, lat, new THREE.Vector3());
        const base = groundY(s, lat);
        const h = deck.y - base - 0.35;
        if (h < 2.4) continue;
        places.push({
          pos: new THREE.Vector3(deck.x, base, deck.z), rot: headingAt(s),
          sx: 1.35, sy: h, sz: 3.4,
        });
      }
    }
  }
  const mesh = scatterInstanced(scene, geo, mat, places);
  mesh.userData.urbanViaductPiers = true;
}

// Marina City corncob: round tower with stacked scalloped balcony rings.
function marinaTower(scene, towerMat, s, lat, r, h) {
  const geo = new THREE.CylinderGeometry(r, r, h, 16); geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, towerMat);
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
  m.position.copy(p); m.castShadow = true;
  scene.add(m);
  const ringGeo = new THREE.CylinderGeometry(r * 1.14, r * 1.14, 0.9, 16);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.9 });
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, 10);
  const M = new THREE.Matrix4();
  for (let i = 0; i < 10; i++) {
    M.makeTranslation(p.x, p.y + h * 0.36 + i * h * 0.062, p.z);
    rings.setMatrixAt(i, M);
  }
  scene.add(rings);
}

// ---------------------------------------------------------------------------
// Real Chicago south-side corridor.  This is deliberately built as a complete
// urban section rather than a row of decorative buildings: close frontage,
// several deep development rings, rail/industrial land, walls and trees all
// continue beneath and beyond the elevated structures.
function buildChicagoRealCorridor(scene, registry, towerMat) {
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 12); cyl.translate(0, 0.5, 0);
  const lit = lowLitMaterial(registry);
  const brick = [0x6f4338, 0x805044, 0x925c48, 0xa16f58, 0x76665b, 0xb09a82];
  const masonry = [0x777a7b, 0x909393, 0xa7a49c, 0x6d7478, 0xb2aca0];

  // Suppress the base-map grass across the entire visible metro footprint.
  // Slight color shifts distinguish residential Chicago from Calumet industry.
  buildUrbanGround(scene, 0, 26000, 1250, 0x55524b, 55);
  buildUrbanGround(scene, 26000, 51000, 1250, 0x494a47, 55);

  // Massive development depth from the South Side through Hammond and Gary.
  // The close band is readable from the car; deepSprawl supplies the many
  // blocks behind it so no camera angle opens onto a bare terrain plane.
  deepSprawl(scene, 9701, 0, 51000, {
    density: 2.05, towers: false, latStart: 20, litMat: lit,
  });
  deepSprawl(scene, 9702, 0, 15000, {
    density: 1.35, towers: true, latStart: 700, glowMat: towerMat, litMat: lit,
  });

  // A guaranteed three-deep urban edge on both sides. placementsAlong() is
  // useful for broad random fields, but it can leave a long near-side opening
  // at an unlucky camera position. These staggered rows make the South Side
  // continuous without forming a rigid wall or entering the clear zone.
  const closeBlocks = [], closeLots = [];
  const closeRand = rng(9708);
  for (let sBase = 100; sBase < 51000; sBase += 82) {
    for (const side of [-1, 1]) {
      for (let depth = 0; depth < 4; depth++) {
        const s = sBase + depth * 24 + (closeRand() - .5) * 42;
        const industrial = s >= 26000;
        const clear = roadClearAt(s);
        const lat = side * (clear + 54 + depth * 78 + closeRand() * (34 + depth * 12));
        const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
        const sx = (industrial ? 34 : 17) + closeRand() * (industrial ? 70 : 25 + depth * 8);
        const sz = (industrial ? 28 : 15) + closeRand() * (industrial ? 62 : 28);
        const block = {
          pos: p,
          rot: headingAt(s) + (industrial ? (closeRand() - .5) * .2 : (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (closeRand() - .5) * .38),
          sx, sy: (industrial ? 7 : 8) + closeRand() * (industrial ? 14 : 18 + (depth >= 2 ? 12 : 0)), sz,
          color: new THREE.Color((industrial ? masonry : brick)[(closeRand() * (industrial ? masonry.length : brick.length)) | 0]),
        };
        closeBlocks.push(block);
        const lotLat = lat - side * (sz * .55 + 10);
        const lp = posAt(s, lotLat, new THREE.Vector3()); lp.y = groundY(s, lotLat) + .06;
        closeLots.push({ pos: lp, rot: headingAt(s), sx: sx * 1.22, sy: .12, sz: 16 + closeRand() * 18 });
      }
    }
  }
  scatterInstanced(scene, box, lit, closeBlocks);
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0x3f4243, roughness: .99 }), closeLots, { shadow: false });

  // Continuous frontage roads and sidewalks remove the empty-plane effect in
  // long forward views. They bend around interchange ramp envelopes and stay
  // on terrain while the expressway alternates between cut, grade and viaduct.
  for (const side of [-1, 1]) {
    const streetLat = s => side * (roadClearAt(s) + 24);
    buildGroundStrip(scene, 0, 51000, streetLat, 12, 0x303335, 30, .09);
    buildGroundStrip(scene, 0, 51000, s => streetLat(s) - side * 7.4, 2.0, 0x8a867e, 30, .12);
    buildGroundStrip(scene, 0, 51000, s => streetLat(s) + side * 7.4, 2.0, 0x8a867e, 30, .12);
  }

  // The Dan Ryan's near edge is continuously urban and retained; small gaps
  // preserve ramp visibility without opening broad grass/gray fields.
  for (const [s0, s1, seed] of [[150, 3600, 97091], [3850, 7600, 97092], [7850, 11100, 97093], [11350, 13900, 97094]]) {
    buildNoiseWall(scene, s0, s1, { seed, height: 4.8, margin: 4.4, step: 10, gapChance: .05 });
  }

  // Bishop Ford is greener and more screened than the Dan Ryan, but it is
  // still fully urban. Broken sound-wall runs, mature trees, and development
  // behind them prevent either an exposed plain or an artificial solid tunnel.
  for (const [s0, s1, seed] of [
    [14200, 17900, 9711], [18700, 22400, 9712], [23400, 26600, 9713],
  ]) buildNoiseWall(scene, s0, s1, { seed, height: 5.2, margin: 5.0, step: 12, gapChance: .14 });
  buildTrees(scene, 9714, 14000, 27000, 12, 42, 300, 100);

  const residential = placementsAlong(9703, 0, 26000, 17, 62, 330, (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.16,
    sx: 13 + r() * 27, sy: 8 + Math.pow(r(), 1.4) * 34, sz: 14 + r() * 28,
    color: new THREE.Color(brick[(r() * brick.length) | 0]),
  }), 12);
  scatterInstanced(scene, box, lit, residential);

  const neighborhood = placementsAlong(9704, 1200, 33000, 13, 350, 920, (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (r() - 0.5) * 0.55,
    sx: 8 + r() * 12, sy: 4 + r() * 8, sz: 9 + r() * 14,
    color: new THREE.Color(brick[(r() * brick.length) | 0]),
  }), 8);
  scatterInstanced(scene, box, lit, neighborhood);

  // Calumet, Hammond and Gary are a continuous working industrial city, not
  // open prairie: warehouses at the freeway edge, older neighborhoods behind,
  // rail yards, tanks and stacks filling the long views.
  const factories = placementsAlong(9705, 24500, 51000, 24, 70, 470, (r, pos, s) => ({
    pos, rot: headingAt(s) + (r() - 0.5) * 0.18,
    sx: 45 + r() * 105, sy: 7 + r() * 15, sz: 32 + r() * 80,
    color: new THREE.Color(masonry[(r() * masonry.length) | 0]),
  }), 18);
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), factories);
  scatterInstanced(scene, cyl, new THREE.MeshStandardMaterial({ color: 0xbfc3c2, roughness: 0.55, metalness: 0.35 }),
    placementsAlong(9706, 27000, 47000, 65, 120, 620, (r, pos) => ({
      pos, rot: 0, sx: 7 + r() * 15, sy: 7 + r() * 18, sz: 7 + r() * 15,
    }), 16));
  scatterInstanced(scene, cyl, new THREE.MeshStandardMaterial({ color: 0x84473b, roughness: 0.86 }),
    placementsAlong(9707, 28500, 48500, 145, 150, 700, (r, pos) => ({
      pos, rot: 0, sx: 2 + r() * 2.4, sy: 28 + r() * 48, sz: 2 + r() * 2.4,
    }), 20));

  // Long Chicago viaducts need a visible structural underside.  Piers are
  // generated from the actual deck/terrain separation, so they meet the road
  // instead of floating or punching through it.
  const pierGeo = new THREE.BoxGeometry(1, 1, 1); pierGeo.translate(0, 0.5, 0);
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x858889, roughness: 0.94 });
  const piers = [];
  const viaductSpans = [[1300, 5800], [9900, 13900], [16700, 22300], [25900, 33600], [34900, 40900], [42700, 50000]];
  for (const [s0, s1] of viaductSpans) {
    for (let s = s0; s <= s1; s += 42) {
      for (const side of [-1, 1]) {
        // Outer-line bents keep every support beyond the live carriageway;
        // do not grow columns during the low ramp-on/ramp-off transitions.
        const lat = side * (pavedHalfAt(s) + 2.8);
        const deck = posAt(s, lat, new THREE.Vector3());
        const base = groundY(s, lat);
        const h = deck.y - base - 0.35;
        if (h < 2.4) continue;
        piers.push({
          pos: new THREE.Vector3(deck.x, base, deck.z), rot: headingAt(s),
          sx: 1.3, sy: h, sz: 3.3,
        });
      }
    }
  }
  const pierMesh = scatterInstanced(scene, pierGeo, pierMat, piers);
  pierMesh.userData.urbanViaductPiers = true;
  buildViaductFascias(scene, viaductSpans);

  // Real corridor rhythm: dense Dan Ryan street grid, slightly wider Bishop
  // Ford spacing, then repeated industrial/local crossings on the Borman.
  const crossings = [
    [700, '31ST ST'], [1450, '35TH ST'], [2250, '43RD ST'], [3050, '47TH ST'],
    [3900, 'GARFIELD BLVD'], [4800, '63RD ST'], [5700, '69TH ST'], [6550, '75TH ST'],
    [7400, '79TH ST'], [8300, '87TH ST'], [9300, '91ST ST'], [10400, '95TH ST'],
    [11600, '103RD ST'], [12900, '111TH ST'], [14300, '115TH ST'], [15800, 'STONY ISLAND AVE'],
    [17400, '130TH ST'], [19000, 'DOTY AVE'], [20700, 'I-57'], [22600, '159TH ST'],
    [24500, 'IL-394'], [26400, 'TORRENCE AVE'], [28200, 'BURNHAM AVE'],
    [30100, 'STATE LINE RD'], [32000, 'CALUMET AVE'], [34000, 'INDIANAPOLIS BLVD'],
    [36000, 'KENNEDY AVE'], [38100, 'BURR ST'], [40200, 'CLINE AVE · SR-912'],
    [42300, 'GRANT ST'], [44400, 'BROADWAY'], [46300, 'GEORGIA ST'], [48600, 'I-65 SOUTH'],
  ];
  for (const [s, name] of crossings) cityOverpass(scene, registry, s, name);
  buildLocalStreetGrid(scene, crossings, 1700);

  // Walls do not hide the whole city. They alternate with open viaduct views,
  // rail cuts and wooded buffers, matching the changing character of the path.
  for (const [s0, s1, seed, h] of [
    [900, 3600, 9730, 6.2], [6100, 9600, 9731, 6.0], [11800, 15400, 9732, 5.7],
    [18100, 23500, 9733, 5.5], [27800, 31500, 9734, 5.8], [37100, 41800, 9735, 6.1],
    [44800, 47000, 9736, 5.8],
  ]) buildNoiseWall(scene, s0, s1, { seed, height: h, margin: 4.5, step: 10, gapChance: 0.08 });
  buildTrees(scene, 9740, 14200, 27000, 12, 42, 230, 110, false, 1.16);
  buildTrees(scene, 9741, 27000, 35000, 20, 58, 310, 80);
  buildTrees(scene, 9742, 36500, 47000, 17, 55, 280, 82);

  // Dan Ryan Red Line and the freight/commuter rail web are key Chicago cues.
  medianRail(scene, registry, 600, 13200, 0xc60c30, '#78101f', [
    [1800, '35TH–BRONZEVILLE'], [4200, 'GARFIELD'], [6500, '69TH'],
    [8200, '79TH'], [10300, '95TH/DAN RYAN'],
  ]);
  southShoreLine(scene, registry, 24800, 43000, -330);
  southShoreLine(scene, registry, 27800, 46800, 250);

  chicagoInterchange(scene, registry, 9100, [
    ['I-90 EAST', 'CHICAGO SKYWAY'], ['I-94 EAST', 'INDIANA'], ['DAN RYAN', 'KEEP RIGHT'],
  ]);
  chicagoInterchange(scene, registry, 20700, [
    ['I-57 SOUTH', 'MEMPHIS'], ['I-94 EAST', 'BISHOP FORD'], ['INDIANA', 'THROUGH LANES'],
  ]);
  chicagoInterchange(scene, registry, 24500, [
    ['I-80 WEST', 'IOWA'], ['I-94 EAST', 'INDIANA'], ['IL-394 SOUTH', 'DANVILLE'],
  ]);
  chicagoInterchange(scene, registry, 48600, [
    ['I-65 SOUTH', 'INDIANAPOLIS'], ['I-80/94 EAST', 'DETROIT'], ['I-65 EXIT', '3 LANES'],
  ]);

  // The Loop is a distant/backward glimpse from the south-side trunk, not a
  // skyline pasted along the whole road. One compact cluster establishes the
  // enormous metro while the continuous low city remains the dominant view.
  buildSkyline(scene, 9750, 0, 5200, {
    latMin: 900, latMax: 1500, hMin: 70, hMax: 220, side: -1, mats: registry.cityGlow || [towerMat],
  });
  buildBillboards(scene, registry, 9751, 0, 49000, 42, CHICAGO_ADS);

  welcomeSign(scene, registry, 250, 1, ['I-90 / I-94', 'DAN RYAN EXPRESSWAY', 'INDIANA · SOUTH SIDE'], '#0d6b3f');
}

// Chicago: I-294 at O'Hare/Rosemont, the Kennedy inbound, the Loop skyline (Willis, Trump, Aon,
// Hancock), the Dan Ryan south, the Chicago Skyway toll bridge over the
// industrial flats with Lake Michigan to the east, and I-80/94 to Gary.
// ---------------------------------------------------------------------------
function buildChicago(scene, registry, towerMat) {
  // The old airport/Skyway set-piece remains below only as historical source
  // material; the live map uses the geographically coherent south-side route.
  return buildChicagoRealCorridor(scene, registry, towerMat);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);

  // Chicago after dark: many buildings, many window colours, cranked bright.
  const winTex = facadeTexture(31);
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  const glowMat = (hex) => new THREE.MeshStandardMaterial({
    map: winTex, emissiveMap: winTex, emissive: new THREE.Color(hex), emissiveIntensity: 0,
    roughness: 0.6, color: 0xffffff,
  });
  const cityMats = [0xfff0cf, 0xe6efff, 0xbfe0ff, 0xffd27a, 0x9affe4, 0xff8fd6, 0xc0a8ff, 0xffffff]
    .map(glowMat);
  registry.cityGlow = (registry.cityGlow || []).concat(cityMats);

  // --- I-294 / O'Hare (0–4000): Tri-State approach, airport interchange,
  // terminals, control tower, parked jets, and dense Rosemont frontage ------
  const termMat = new THREE.MeshStandardMaterial({ color: 0x9fb0bd, roughness: 0.3, metalness: 0.5 });
  scatterInstanced(scene, boxGeo, termMat,
    placementsAlong(701, 400, 3800, 120, 55, 160, (rand, pos, s) => ({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
      sx: 40 + rand() * 60, sy: 9 + rand() * 8, sz: 26 + rand() * 20,
      color: new THREE.Color(0xffffff).multiplyScalar(0.85 + rand() * 0.2),
    }), 8));
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x8a8d92, roughness: 0.85 });
  scatterInstanced(scene, boxGeo, garageMat,
    placementsAlong(702, 600, 3600, 260, 130, 240, (rand, pos, s) => ({
      pos, rot: headingAt(s), sx: 55 + rand() * 30, sy: 14 + rand() * 6, sz: 44 + rand() * 20,
    }), 10));
  // control tower
  const towerG = new THREE.CylinderGeometry(3, 4, 42, 10); towerG.translate(0, 21, 0);
  const ctrl = new THREE.Mesh(towerG, new THREE.MeshStandardMaterial({ color: 0xc7ccd2, roughness: 0.5 }));
  const cp = posAt(2200, -70, new THREE.Vector3()); cp.y = groundY(2200, -70);
  ctrl.position.copy(cp); scene.add(ctrl);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(6, 5, 8, 10),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.2, metalness: 0.6, emissive: 0x3a4a5a, emissiveIntensity: 0.4 }));
  cab.position.copy(cp).y += 44; scene.add(cab);
  // parked jets at the gates
  for (let i = 0; i < 8; i++) {
    const s = 800 + i * 360;
    makePlane(scene, s, (i % 2 ? -1 : 1) * (110 + (i % 3) * 14), headingAt(s) + Math.PI / 2);
  }
  welcomeSign(scene, registry, 500, 1, ["O'HARE INTERNATIONAL", 'CHICAGO ✈ ORD', 'TERMINALS 1 · 2 · 3 · 5'], '#0b3d91');
  chicagoInterchange(scene, registry, 2500, [
    ['I-294 NORTH', 'TRI-STATE TOLLWAY'],
    ['I-90 EAST', 'KENNEDY · CHICAGO'],
    ['I-190', 'O’HARE TERMINALS'],
  ]);

  // --- Kennedy inbound (4000–16000): dense brick, rising toward the Loop -----
  const brickCols = [0x8a4b3a, 0x9a5a44, 0x77503f, 0xa5866a, 0x6f5a4c, 0x8f7a63, 0xb9a98f];
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    placementsAlong(703, 4200, 15800, 16, 26, 150, (rand, pos, s) => {
      const grow = (s - 4000) / 12000;           // taller nearer downtown
      return {
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.25,
        sx: 12 + rand() * 20, sz: 12 + rand() * 20,
        sy: 12 + Math.pow(rand(), 1.4) * (30 + grow * 90),
        color: new THREE.Color(brickCols[(rand() * brickCols.length) | 0]),
      };
    }, 3));
  buildBillboards(scene, registry, 704, 5000, 15500, 14, CHICAGO_ADS);
  // Blue Line in the Kennedy median, O'Hare branch stations
  medianRail(scene, registry, 4400, 15600, 0x009bda, '#00335f', [
    [5200, 'CUMBERLAND'], [6400, 'HARLEM'], [7800, 'JEFFERSON PARK'],
    [9200, 'IRVING PARK'], [10400, 'ADDISON'], [11600, 'BELMONT'],
    [13000, 'LOGAN SQUARE'], [14800, 'DIVISION'],
  ]);
  // cross-street bridges over the Kennedy
  cityOverpass(scene, registry, 6800, 'MONTROSE AVE');
  cityOverpass(scene, registry, 9600, 'FULLERTON AVE');
  cityOverpass(scene, registry, 12400, 'DIVISION ST');

  // Outer Southland routing: stay on I-294, then peel toward I-80/94 and the
  // Chicago Skyway. These are the only Chicago route choices the player sees.
  chicagoInterchange(scene, registry, 17800, [
    ['I-294 SOUTH', 'TRI-STATE · JOLIET'],
    ['I-80/94 EAST', 'GARY · INDIANA'],
    ['KEEP RIGHT', 'SKYWAY / I-90'],
  ]);
  chicagoInterchange(scene, registry, 29200, [
    ['I-80/94 EAST', 'BORMAN EXPRESSWAY'],
    ['I-90 EAST', 'CHICAGO SKYWAY'],
    ['INDIANA · I-65', 'NEXT EXIT'],
  ]);

  // The Chicago route is intentionally outer-corridor only: no Loop/Dan Ryan
  // traversal. Keep the dense sprawl layer around the bypass, but omit the
  // downtown skyline/cut so the player stays on the Tri-State/Southland line.
  if (false) {
  // --- Jane Byrne Interchange (17000): I-290 Eisenhower splits off ------------
  chicagoInterchange(scene, registry, 17000, [
    ['I-290 WEST', 'EISENHOWER EXPWY'],
    ['I-90/94 EAST', 'LOOP · INDIANA'],
    ['JANE BYRNE', 'INTERCHANGE'],
  ]);

  // --- Downtown Loop (16000–24000): the skyline, both sides, lit hard --------
  buildSkyline(scene, 705, 16000, 24400, {
    latMin: 70, latMax: 560, hMin: 55, hMax: 230, side: -1, mats: cityMats,
  });
  buildSkyline(scene, 706, 16000, 23200, {           // River North / Streeterville cluster
    latMin: 80, latMax: 420, hMin: 45, hMax: 170, side: 1, mats: cityMats,
  });
  buildSkyline(scene, 715, 17000, 23000, {           // West Loop / Fulton Market depth band
    latMin: 560, latMax: 860, hMin: 60, hMax: 190, side: -1, mats: cityMats,
  });
  buildSkyline(scene, 716, 13800, 16000, {           // near-north preview on the Kennedy inbound
    latMin: 90, latMax: 320, hMin: 30, hMax: 95, mats: cityMats,
  });
  // signature towers (west side, the classic I-90/94 view of the Loop)
  signatureTower(scene, cityMats[1], 20200, -190, 38, 330, new THREE.Color(0x2b2f36)); // Willis/Sears
  antenna(scene, 20200, -190, groundY(20200, -190) + 330, 70);
  antenna(scene, 20200, -178, groundY(20200, -178) + 330, 62);
  signatureTower(scene, cityMats[2], 19600, -230, 30, 300, new THREE.Color(0xbfd0dc));  // Trump Tower, glass
  antenna(scene, 19600, -230, groundY(19600, -230) + 300, 55);
  signatureTower(scene, cityMats[7], 20600, -150, 30, 275, new THREE.Color(0xe8ecef));  // Aon Center, white
  signatureTower(scene, cityMats[3], 18600, -210, 26, 265, new THREE.Color(0x30343a), 0xffb020); // Hancock
  antenna(scene, 18600, -210, groundY(18600, -210) + 265, 58);
  antenna(scene, 18600, -200, groundY(18600, -200) + 265, 58);
  signatureTower(scene, cityMats[2], 21000, -260, 24, 235, new THREE.Color(0x1c2a3a));  // Two Prudential
  // more of the notable set
  signatureTower(scene, cityMats[2], 20850, 240, 17, 200, new THREE.Color(0x9fc4dc));   // St Regis, stepped blue glass
  signatureTower(scene, cityMats[2], 20890, 262, 17, 235, new THREE.Color(0x8fb8d4));
  signatureTower(scene, cityMats[2], 20930, 284, 17, 265, new THREE.Color(0xa9cbe0));
  signatureTower(scene, cityMats[0], 18800, 140, 72, 55, new THREE.Color(0xc9c2b2));    // Merchandise Mart, riverside slab
  signatureTower(scene, cityMats[7], 19050, 120, 15, 130, new THREE.Color(0xf2efe6), 0xf2efe6); // Wrigley Building, white + clock crown
  signatureTower(scene, cityMats[0], 19100, 155, 16, 141, new THREE.Color(0xcbc4b4), 0xcbc4b4); // Tribune Tower, gothic crown
  signatureTower(scene, cityMats[3], 18400, 330, 26, 190, new THREE.Color(0x1d232b));   // Lake Point Tower, dark by the lake
  signatureTower(scene, cityMats[0], 20400, -240, 24, 160, new THREE.Color(0xb0a68e), 0x8e8672); // Board of Trade, deco pyramid top
  marinaTower(scene, cityMats[0], 19000, 165, 12, 170);   // Marina City corncobs
  marinaTower(scene, cityMats[0], 19260, 195, 12, 170);
  // CNA Center: the plain red box that burns red over the Loop all night
  const cnaMat = new THREE.MeshStandardMaterial({ color: 0xb01e24, emissive: 0xff2a30, emissiveIntensity: 0.12, roughness: 0.6 });
  (registry.crownMats ||= []).push(cnaMat);
  signatureTower(scene, cnaMat, 20900, -120, 24, 180, new THREE.Color(0xb01e24));
  // blinking red aviation beacons on the supertall masts (share the wind-farm blink)
  const avTex = beaconTexture();
  for (const [bs, blat, bh] of [[20200, -190, 396], [19600, -230, 352], [18600, -210, 320], [20600, -150, 282]]) {
    const avMat = new THREE.SpriteMaterial({
      map: avTex, color: 0xff2020, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    registry.windmillLights = (registry.windmillLights || []).concat(avMat);
    const spr = new THREE.Sprite(avMat);
    const bp = posAt(bs, blat, new THREE.Vector3());
    spr.position.set(bp.x, groundY(bs, blat) + bh, bp.z);
    spr.scale.set(16, 16, 1);
    scene.add(spr);
  }
  // the 'L': Loop approach + Green Line crossings over the expressway
  elCrossing(scene, registry, 22600, 0xb8894a);   // Brown/Orange Loop tracks
  elCrossing(scene, registry, 25900, 0x1f9d4e);   // Green Line over the Ryan
  buildBillboards(scene, registry, 707, 16200, 23800, 8, CHICAGO_ADS);

  // vivid rooftop accent lights glowing over the Loop in many colours
  const beaconTex = beaconTexture();
  const accentMats = [0xff3355, 0x33aaff, 0x55ffcc, 0xffcc33, 0xff66dd, 0x99ff66, 0xffffff]
    .map(c => new THREE.SpriteMaterial({
      map: beaconTex, color: c, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
  const arand = rng(709);
  for (let i = 0; i < 150; i++) {
    const s = 15800 + arand() * 8800;
    const sd = arand() < 0.6 ? -1 : 1;
    const lat = sd * (70 + arand() * 480);
    const p = posAt(s, lat, new THREE.Vector3());
    const spr = new THREE.Sprite(accentMats[(arand() * accentMats.length) | 0]);
    spr.position.set(p.x, groundY(s, lat) + 45 + arand() * 210, p.z);
    const sz = 9 + arand() * 11; spr.scale.set(sz, sz, 1);
    scene.add(spr);
  }
  // lower rooftop lights strung out along the Kennedy + Dan Ryan corridors
  for (let i = 0; i < 70; i++) {
    const s = arand() < 0.5 ? 5000 + arand() * 10500 : 24500 + arand() * 9000;
    const lat = (arand() < 0.5 ? -1 : 1) * (60 + arand() * 220);
    const p = posAt(s, lat, new THREE.Vector3());
    const spr = new THREE.Sprite(accentMats[(arand() * accentMats.length) | 0]);
    spr.position.set(p.x, groundY(s, lat) + 18 + arand() * 60, p.z);
    const sz = 6 + arand() * 8; spr.scale.set(sz, sz, 1);
    scene.add(spr);
  }
  registry.cityBeacons = (registry.cityBeacons || []).concat(accentMats);

  // --- Dan Ryan south (24000–34000): dense south-side brick + mid-rises ------
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    placementsAlong(708, 24200, 33800, 18, 24, 170, (rand, pos, s) => ({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
      sx: 14 + rand() * 20, sz: 14 + rand() * 20,
      sy: 10 + Math.pow(rand(), 1.5) * 70,
      color: new THREE.Color(brickCols[(rand() * brickCols.length) | 0]),
    }), 3));
  buildBillboards(scene, registry, 709, 24500, 33500, 12, CHICAGO_ADS);

  // I-55 Stevenson split at the top of the Ryan
  chicagoInterchange(scene, registry, 24500, [
    ['I-55 SOUTH', 'ST LOUIS'],
    ['I-55 NORTH', 'LAKE SHORE DR'],
    ['I-90/94 · DAN RYAN', 'INDIANA'],
  ]);
  // Red Line in the Dan Ryan median
  medianRail(scene, registry, 25000, 33600, 0xc60c30, '#7a0c1e', [
    [25400, 'CERMAK–CHINATOWN'], [26400, 'SOX–35TH'], [27600, '47TH'],
    [29000, 'GARFIELD'], [30400, '63RD'], [31400, '69TH'],
    [32300, '79TH'], [33300, '95TH/DAN RYAN'],
  ]);
  cityOverpass(scene, registry, 28200, '51ST ST');
  cityOverpass(scene, registry, 30900, '67TH ST');
  cityOverpass(scene, registry, 32800, '87TH ST');

  }

  // --- Lake Michigan to the east, seen from the Skyway -----------------------
  const lake = new THREE.Mesh(
    // PlaneGeometry width is the cross-road axis after the X rotation; keep
    // the shoreline to the east instead of accidentally spanning downtown.
    new THREE.PlaneGeometry(5000, 24000, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x1f4c6b, roughness: 0.2, metalness: 0.5 })
  );
  lake.rotation.x = -Math.PI / 2;
  const lp = posAt(30000, 3000, new THREE.Vector3());
  lake.position.set(lp.x, -2.4, lp.z);
  lake.rotation.z = -headingAt(30000);
  scene.add(lake);

  // --- Chicago Skyway (34000–40000): cashless ORT since 2020 — scanner
  // gantry at speed, I-PASS/E-ZPass boards, toll-by-mail for the tagless
  buildSkywayORT(scene, registry, 37000);
  // South Shore Line / Metra Electric runs through the industrial flats, but
  // keep it a real setback from the expressway instead of placing the rails on
  // the shoulder. The highway gets a tree/warehouse buffer; the catenary reads
  // as a separate parallel corridor in the distance.
  southShoreLine(scene, registry, 34200, 45600, -310);
  // steel truss uprights lining the elevated deck
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x6b5a52, roughness: 0.6, metalness: 0.6 });
  const trussG = new THREE.BoxGeometry(0.8, 1, 0.8); trussG.translate(0, 0.5, 0);
  scatterInstanced(scene, trussG, trussMat,
    placementsAlong(710, 35400, 38600, 26, 12, 13, (rand, pos, s) => ({
      pos, rot: headingAt(s), sx: 1.2, sy: 14 + rand() * 4, sz: 1.2,
    })));
  // refineries / tank farms / stacks
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xb7bcc0, roughness: 0.5, metalness: 0.5 });
  const tankG = new THREE.CylinderGeometry(1, 1, 1, 14); tankG.translate(0, 0.5, 0);
  scatterInstanced(scene, tankG, tankMat,
    placementsAlong(711, 34200, 45800, 40, 60, 320, (rand, pos, s) => ({
      pos, rot: 0, sx: 8 + rand() * 12, sy: 8 + rand() * 14, sz: 8 + rand() * 12,
    }), 6));
  const stackMat = new THREE.MeshStandardMaterial({ color: 0x9a5a44, roughness: 0.8 });
  scatterInstanced(scene, tankG, stackMat,
    placementsAlong(712, 34200, 45800, 130, 70, 300, (rand, pos, s) => ({
      pos, rot: 0, sx: 3 + rand() * 3, sy: 30 + rand() * 30, sz: 3 + rand() * 3,
    }), 8));

  // --- I-80/94 Borman (40000–46000): warehouses, distribution yards ---------
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.85 }),
    placementsAlong(713, 40200, 45800, 80, 60, 300, (rand, pos, s) => ({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.15,
      sx: 60 + rand() * 90, sy: 8 + rand() * 5, sz: 40 + rand() * 60,
      color: new THREE.Color(0xffffff).multiplyScalar(0.8 + rand() * 0.25),
    }), 10));
  buildBillboards(scene, registry, 714, 40500, 45800, 8, CHICAGO_ADS);

  buildChicagoRoadside(scene, registry);
  buildChicagoContinuousSprawl(scene, registry);
  buildChicagoPhillyBlueprint(scene, registry);
}

// Gary: the industrial NW Indiana start — steel mills, tank farms, stacks
function buildGary(scene, registry) {
  buildSuburb(scene, registry, 46300, 50800);
}

export function buildMidwest(scene, registry) {
  // shared lit-window tower material for the skylines (Chicago, Indy, Cincy)
  const tex = facadeTexture(31);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.7, color: 0xffffff,
  });
  registry.towerMats = (registry.towerMats || []).concat(towerMat);

  buildChicago(scene, registry, towerMat);            // Dan Ryan → Bishop Ford → Borman → I-65
  buildDMS(scene, registry);                          // electronic travel-time boards
  buildGary(scene, registry);
  buildFarmland(scene, registry, 401, 51200, 78500);  // I-65 Indiana farm country
  buildIndiana65(scene, registry);                    // I-65 roadside logistics + tree belts
  buildWindFarm(scene, registry, 56000, 66000);        // turbines around Lafayette (Fowler/Meadow Lake) — a tighter band, not the whole run
  buildIndy(scene, registry, towerMat);               // Indianapolis + I-465
  buildFarmland(scene, registry, 411, 95500, 110500); // I-74 farm country
  buildI74Corridor(scene, registry);                  // Shelbyville · Greensburg · Batesville
  buildHills(scene, 108000, 134000);                  // SE Indiana → wooded SW Ohio hills
  buildCincinnati(scene, registry, towerMat);         // wooded I-74 → direct I-75 north junction
  buildIndyCincyPhillyBlueprint(scene, registry);     // Philly-style metro fabric, scaled to Indy/Cincy

  // Chicago dominates the night horizon. Indianapolis gets only a compact,
  // brief glow to the right of I-65; downtown Cincinnati is off-route.
  addSkyGlow(scene, registry, 2600, -1200, 1050, 650);   // distant Chicago Loop behind South Side
  addSkyGlow(scene, registry, 85200, -650, 320, 220);    // brief Indianapolis view

  buildI75Mason(scene, registry, towerMat);    // I-75 north: I-275 loop → Mason terminal
  buildMidwestMetroFabric(scene, registry);   // Northeast-level walls, bridges, and continuous sprawl
  buildGrassMedians(scene);                   // long rural I-65/I-74 open medians with interchange gaps
  buildMidwestWorkZones(scene, registry);     // solid lines, cones, and advance construction signs
  buildCincinnatiIdentity(scene, registry);   // settled hills and I-75 north approach

  // Highway identities change through real junctions, not invisible zone
  // boundaries: signs, ramp envelope, gore, and flyover all meet at each handoff.
  highwayTransition(scene, registry, 46000, [
    ['I-65 SOUTH', 'INDIANAPOLIS'],
    ['I-80/94 WEST', 'CHICAGO · GARY'],
    ['I-65 SOUTH · EXIT 11', 'INDIANAPOLIS · 1/4 MILE'],
  ]);
  highwayTransition(scene, registry, 79000, [
    ['I-65 SOUTH', 'INDIANAPOLIS · LOUISVILLE'],
    ['I-65 NORTH', 'CHICAGO · LAFAYETTE'],
    ['I-465', 'AIRPORT · BELTWAY EXITS'],
  ]);
  highwayTransition(scene, registry, 95000, [
    ['I-74 EAST', 'CINCINNATI'],
    ['I-465 WEST', 'AIRPORT · I-65 NORTH'],
    ['I-74 EAST · EXIT', 'SHELBYVILLE · CINCINNATI'],
  ]);
  highwayTransition(scene, registry, 138000, [
    ['I-75 NORTH', 'MILL CREEK · MASON'],
    ['I-75 SOUTH', 'DOWNTOWN · LEXINGTON'],
    ['I-75 NORTH · EXIT', 'SHARONVILLE · MASON'],
  ]);

  // Indiana → Ohio state line near West Harrison, both directions
  welcomeSign(scene, registry, 122900, 1, ['WELCOME TO OHIO', 'BIRTHPLACE OF AVIATION', 'THE BUCKEYE STATE'], '#7a1020');
  welcomeSign(scene, registry, 122100, -1, ['WELCOME TO INDIANA', 'CROSSROADS OF AMERICA', 'HONEST-TO-GOODNESS INDIANA'], '#123a7a');
  // IL/IN state line near Hammond (auto-placer is disabled for this map)
  welcomeSign(scene, registry, 42200, 1, ['WELCOME TO INDIANA', 'CROSSROADS OF AMERICA', 'HONEST-TO-GOODNESS INDIANA'], '#123a7a');
  welcomeSign(scene, registry, 41800, -1, ['WELCOME TO ILLINOIS', 'THE PRAIRIE STATE', 'LAND OF LINCOLN'], '#0b4d6b');
}
