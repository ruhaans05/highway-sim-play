import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, latForLane, buildRibbon, elevAt } from './road.js';
import {
  groundY, buildTrees, buildBillboards, buildSuburb, deepSprawl, buildNoiseWall,
  facadeTexture, scatterInstanced, placementsAlong,
} from './environment.js';
import {
  textBoard, gantry, water, suspensionBridge, welcomeSign, port, viaductPiers,
  addSkyGlow,
} from './turnpike.js';

// This extended I-278 drive begins at I-95/NJ-440 in Woodbridge, follows
// NJ-440 over the Outerbridge, then the West Shore/Staten Island Expressways,
// Verrazzano, BQE, RFK Bridge and Bruckner Expressway to I-95 in the Bronx.

const BOX = new THREE.BoxGeometry(1, 1, 1);
BOX.translate(0, 0.5, 0);

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function facadeMaterial(registry, key, seed, roughness = 0.86) {
  if (registry[key]) return registry[key];
  const tex = facadeTexture(seed);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry[key] = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    color: 0xffffff, roughness,
  });
  (registry.litLow ||= []).push(registry[key]);
  return registry[key];
}

function routeSign(scene, registry, s, lines, lat = -6, color = '#046a38', width = 11.5) {
  const front = textBoard(lines, width, 3.6, color, '#ffffff');
  const back = textBoard(lines, width, 3.6, color, '#ffffff');
  back.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat, mesh: front }, { lat: -lat, mesh: back }], 7.2);
}

function urbanFloor(scene, s0, s1, seed, opts = {}) {
  const { walls = true, brick = false, extent = brick ? 2200 : 900 } = opts;
  const extentAt = typeof extent === 'function' ? extent : () => extent;
  const shoulder = s => pavedHalfAt(s) + 2.2;
  const leftOuter = s => -extentAt(s);
  const leftInner = s => -shoulder(s);
  const rightInner = s => shoulder(s);
  const rightOuter = s => extentAt(s);
  const groundOffset = latFn => s => groundY(s, latFn(s)) - elevAt(s) + 0.03;
  const ground = new THREE.MeshStandardMaterial({ color: brick ? 0x665b52 : 0x555755, roughness: 1 });
  scene.add(new THREE.Mesh(buildRibbon(
    leftOuter, leftInner, groundOffset(leftOuter), groundOffset(leftInner), 24, s0, s1
  ), ground));
  scene.add(new THREE.Mesh(buildRibbon(
    rightInner, rightOuter, groundOffset(rightInner), groundOffset(rightOuter), 24, s0, s1
  ), ground));
  if (walls) buildNoiseWall(scene, s0, s1, {
    seed, height: brick ? 7.2 : 5.8, step: 10, margin: 4.2, gapChance: brick ? 0.02 : 0.055,
  });
}

function deckStructure(scene, s0, s1) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x898a86, roughness: 0.96 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x34393c, roughness: 0.75, metalness: 0.35 });
  scene.add(new THREE.Mesh(buildRibbon(
    s => -pavedHalfAt(s) - 0.9, s => pavedHalfAt(s) + 0.9,
    -1.35, -1.35, 12, s0, s1
  ), concrete));
  for (const side of [-1, 1]) scene.add(new THREE.Mesh(buildRibbon(
    s => side * (pavedHalfAt(s) + 0.65) - 0.22,
    s => side * (pavedHalfAt(s) + 0.65) + 0.22,
    -2.25, -0.6, 12, s0, s1
  ), steel));
  viaductPiers(scene, s0, s1);
}

function crossStreetOverpasses(scene, sValues) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x858682, roughness: 0.95 });
  const rail = new THREE.MeshStandardMaterial({ color: 0x3e454a, roughness: 0.72, metalness: 0.25 });
  for (const s of sValues) {
    const half = pavedHalfAt(s) + 18;
    const group = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.2, 13), concrete);
    deck.position.y = 7.4;
    group.add(deck);
    for (const x of [-half, half, -pavedHalfAt(s) - 2.5, pavedHalfAt(s) + 2.5]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.4, 1.4), concrete);
      pier.position.set(x, 3.7, 0);
      group.add(pier);
    }
    for (const z of [-6.2, 6.2]) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.25, 0.35), rail);
      barrier.position.set(0, 8.45, z);
      group.add(barrier);
    }
    group.position.copy(posAt(s, 0, new THREE.Vector3()));
    group.position.y = elevAt(s);
    group.rotation.y = headingAt(s);
    scene.add(group);
  }
}

function beamBetween(scene, a, b, material, width) {
  const delta = b.clone().sub(a);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(width, delta.length(), width), material);
  beam.position.copy(a).add(b).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  scene.add(beam);
}

function outerbridgeTruss(scene, s0, s1) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x3f555e, roughness: 0.62, metalness: 0.55 });
  const previous = new Map();
  for (let s = s0; s <= s1; s += 58) {
    const t = (s - s0) / (s1 - s0);
    const cantilever = Math.max(0, 1 - Math.abs(t - 0.5) * 2);
    for (const side of [-1, 1]) {
      const lat = side * (pavedHalfAt(s) + 1.2);
      const base = posAt(s, lat, new THREE.Vector3());
      base.y += 0.6;
      const top = base.clone();
      top.y += 7 + 20 * Math.pow(cantilever, 1.4);
      beamBetween(scene, base, top, steel, 0.65);
      const old = previous.get(side);
      if (old) {
        beamBetween(scene, old.top, top, steel, 0.7);
        beamBetween(scene, old.flip ? old.base : old.top, old.flip ? top : base, steel, 0.5);
      }
      previous.set(side, { base, top, flip: !old?.flip });
    }
  }
}

function kosciuszkoTwinCableStayed(scene) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0xd7d8d5, roughness: 0.8 });
  const cable = new THREE.MeshStandardMaterial({ color: 0xd8dde0, roughness: 0.4, metalness: 0.48 });
  const centerJoint = new THREE.MeshBasicMaterial({ color: 0x1c2022 });
  const spans = [
    { side: -1, towerS: 58150, mainDir: 1 },
    { side: 1, towerS: 58850, mainDir: -1 },
  ];
  for (const { side, towerS, mainDir } of spans) {
    const roadHalf = pavedHalfAt(towerS);
    const innerLat = side * 1.7;
    const outerLat = side * (roadHalf + 1.4);
    const feet = [innerLat, outerLat].map(lat => {
      const p = posAt(towerS, lat, new THREE.Vector3());
      p.y += 0.8;
      return p;
    });
    const tops = feet.map((foot, i) => {
      const top = foot.clone();
      top.y += 56;
      const targetLat = i === 0 ? innerLat + side * 1.1 : outerLat - side * 1.1;
      const target = posAt(towerS, targetLat, new THREE.Vector3());
      top.x = target.x; top.z = target.z;
      return top;
    });
    beamBetween(scene, feet[0], tops[0], concrete, 2.5);
    beamBetween(scene, feet[1], tops[1], concrete, 2.5);
    beamBetween(scene, tops[0], tops[1], concrete, 2.2);

    // Each independent span has one asymmetric H-pylon. The second bridge
    // mirrors the first, producing the real crossing's overlapping cable fans.
    for (let i = 1; i <= 7; i++) {
      for (const edgeLat of [innerLat, outerLat]) {
        const mainS = towerS + mainDir * (190 + i * 105);
        const backS = towerS - mainDir * (120 + i * 68);
        const mainAnchor = posAt(mainS, edgeLat, new THREE.Vector3()); mainAnchor.y += 0.9;
        const backAnchor = posAt(backS, edgeLat, new THREE.Vector3()); backAnchor.y += 0.9;
        const towerTop = tops[edgeLat === innerLat ? 0 : 1].clone();
        towerTop.y -= 4 + (7 - i) * 4.2;
        beamBetween(scene, towerTop, mainAnchor, cable, 0.16);
        beamBetween(scene, towerTop, backAnchor, cable, 0.16);
      }
    }
  }
  scene.add(new THREE.Mesh(buildRibbon(-0.38, 0.38, 0.09, 0.09, 8, 57000, 60200), centerJoint));
}

function denseBlocks(scene, registry, seed, s0, s1, opts = {}) {
  const { density = 1, height = 1, brownstone = false, towers = false } = opts;
  const mat = facadeMaterial(registry, brownstone ? 'i278BrownstoneMat' : 'i278UrbanMat', seed);
  const colors = brownstone
    ? [0x6f362d, 0x814438, 0x965543, 0x70443b, 0xa1664c, 0x5f3d37]
    : [0x857d73, 0x9b948a, 0x747b80, 0xaaa69f, 0x8d6c5b, 0xb6aea0];
  const near = placementsAlong(seed, s0, s1, 8 / density, 34, 170, (r, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (r() - 0.5) * 0.035,
    sx: (brownstone ? 8 : 12) + r() * (brownstone ? 7 : 18),
    sy: (brownstone ? 10 : 16) * height + Math.pow(r(), 1.4) * (brownstone ? 11 : 58) * height,
    sz: (brownstone ? 20 : 16) + r() * (brownstone ? 17 : 25),
    color: new THREE.Color(colors[(r() * colors.length) | 0]),
  }), 5);
  scatterInstanced(scene, BOX, mat, near);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x343331, roughness: 1 });
  scatterInstanced(scene, BOX, roofMat, near.map((b, i) => ({
    pos: b.pos.clone().setY(b.pos.y + b.sy), rot: b.rot,
    sx: b.sx * 1.03, sy: 0.55 + (i % 5 === 0 ? 1.4 : 0), sz: b.sz * 1.03,
  })));
  deepSprawl(scene, seed + 20, s0, s1, {
    density: density * 1.15, towers, glowMat: mat, latStart: brownstone ? 0 : 30,
  });
}

function packedUrbanFrontage(scene, registry, seed, s0, s1, opts = {}) {
  const { brownstone = false, vertical = 1 } = opts;
  const rand = rng(seed);
  const mat = facadeMaterial(registry, brownstone ? 'i278BrownstoneMat' : 'i278UrbanMat', seed);
  const colors = brownstone
    ? [0x65342d, 0x773c31, 0x88483a, 0x9a5945, 0x70443b, 0xa66a51]
    : [0x716b66, 0x81766d, 0x8f8580, 0x747b80, 0x9b948a, 0x65544b];
  const buildings = [];
  for (const [band, step] of [[0, 17], [1, 25], [2, 36]]) {
    for (let s = s0 + band * 7; s < s1; s += step) {
      for (const side of [-1, 1]) {
        const sx = (brownstone ? 7.5 : 10) + rand() * (brownstone ? 5 : 11);
        const sz = step * (0.96 + rand() * 0.18);
        const lat = side * (pavedHalfAt(s) + 12 + band * 28 + sx * 0.5);
        const pos = posAt(s, lat, new THREE.Vector3());
        pos.y = groundY(s, lat);
        buildings.push({
          pos,
          rot: headingAt(s) + (rand() - 0.5) * (band ? 0.09 : 0.025),
          sx,
          sy: ((brownstone ? 11 : 18) + Math.pow(rand(), 1.25) * (brownstone ? 14 : 48)) * vertical * (1 + band * 0.12),
          sz,
          color: new THREE.Color(colors[(rand() * colors.length) | 0]),
        });
      }
    }
  }
  scatterInstanced(scene, BOX, mat, buildings);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x292a29, roughness: 1 });
  scatterInstanced(scene, BOX, roofMat, buildings.map((b, i) => ({
    pos: b.pos.clone().setY(b.pos.y + b.sy), rot: b.rot,
    sx: b.sx * 1.02, sy: i % 7 === 0 ? 1.8 : 0.5, sz: b.sz * 1.02,
  })));
}

function urbanServiceGrid(scene, s0, s1) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x343638, roughness: 1 });
  const sidewalk = new THREE.MeshStandardMaterial({ color: 0x9b9992, roughness: 1 });
  for (const side of [-1, 1]) {
    scene.add(new THREE.Mesh(buildRibbon(
      s => side < 0 ? -(pavedHalfAt(s) + 10) : pavedHalfAt(s) + 3,
      s => side < 0 ? -(pavedHalfAt(s) + 3) : pavedHalfAt(s) + 10,
      -0.03, -0.03, 12, s0, s1
    ), asphalt));
    scene.add(new THREE.Mesh(buildRibbon(
      s => side < 0 ? -(pavedHalfAt(s) + 16) : pavedHalfAt(s) + 10,
      s => side < 0 ? -(pavedHalfAt(s) + 10) : pavedHalfAt(s) + 16,
      0.02, 0.02, 12, s0, s1
    ), sidewalk));
  }
}

function urbanOverpassSites(s0, s1, spacing) {
  const sites = [];
  for (let s = s0; s < s1; s += spacing) sites.push(s);
  return sites;
}

function interchangeFlyover(scene, s0, s1, side) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x303336, roughness: 0.94 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8d908e, roughness: 0.9 });
  const tAt = s => Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
  const center = s => side * (pavedHalfAt(s) + 6 + 42 * Math.sin(Math.PI * tAt(s)));
  const y = s => 4.8 + 5.5 * Math.sin(Math.PI * tAt(s));
  scene.add(new THREE.Mesh(buildRibbon(
    s => center(s) - 3.6, s => center(s) + 3.6, y, y, 10, s0, s1
  ), asphalt));
  for (const edgeSide of [-1, 1]) scene.add(new THREE.Mesh(buildRibbon(
    s => center(s) + edgeSide * 3.5 - 0.18,
    s => center(s) + edgeSide * 3.5 + 0.18,
    s => y(s) + 0.75, s => y(s) + 0.75, 10, s0, s1
  ), concrete));
  for (let s = s0 + 140; s < s1 - 100; s += 190) {
    const lat = center(s);
    const p = posAt(s, lat, new THREE.Vector3());
    const base = groundY(s, lat);
    const h = Math.max(3, p.y + y(s) - base);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), concrete);
    pier.position.set(p.x, base + h / 2, p.z);
    scene.add(pier);
  }
}

function cashlessToll(scene, registry, s, name) {
  routeSign(scene, registry, s, [name, 'E-ZPASS · TOLLS BY MAIL', 'NO CASH · KEEP MOVING'], 0, '#4c216d', 12.5);
  const cameraMat = new THREE.MeshStandardMaterial({ color: 0x15191c, roughness: 0.55, metalness: 0.4 });
  for (const lat of [-10.5, -3.5, 3.5, 10.5]) {
    const p = posAt(s + 8, lat, new THREE.Vector3());
    p.y = elevAt(s) + 7.8;
    const camera = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.2), cameraMat);
    camera.position.copy(p);
    camera.rotation.y = headingAt(s);
    scene.add(camera);
  }
}

function hovLane(scene, registry, s0, s1, label, occupancy = '2+') {
  const diamondMat = new THREE.MeshBasicMaterial({
    color: 0xf2efe5, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  for (let s = s0 + 120; s < s1; s += 210) {
    for (const dir of [-1, 1]) {
      const lat = latForLane(dir, 0, s);
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), diamondMat);
      mark.position.copy(posAt(s, lat, new THREE.Vector3()));
      mark.position.y += 0.06;
      mark.rotation.x = -Math.PI / 2;
      mark.rotation.z = headingAt(s) + Math.PI / 4;
      scene.add(mark);
    }
  }
  routeSign(scene, registry, s0 + 650, ['◇ HOV / BUS LANE', label, `${occupancy} PERSONS · LEFT LANE`]);
}

function lowerManhattanSkyline(scene, registry, anchorS = 35400, lat = -720, scale = 1) {
  const anchor = posAt(anchorS, lat, new THREE.Vector3());
  anchor.y = 0;
  const group = new THREE.Group();
  if (!registry.i278SkylineMat) {
    const tex = facadeTexture(27890);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    registry.i278SkylineMat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
      color: 0xc8d0d6, roughness: 0.58, metalness: 0.12,
    });
    (registry.towerMats ||= []).push(registry.i278SkylineMat);
  }
  const glass = registry.i278SkylineMat;
  const dark = new THREE.MeshStandardMaterial({ color: 0x56616a, roughness: 0.58, metalness: 0.2 });
  const towers = [
    [-105, 12, 46, 22, 26], [-72, -8, 62, 24, 26], [-38, 16, 84, 28, 25],
    [-4, -4, 146, 31, 31], [35, 12, 72, 24, 26], [68, -10, 58, 22, 23],
    [98, 17, 42, 25, 22], [128, -4, 36, 27, 24],
  ];
  towers.forEach(([x, z, h, w, d], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w * scale, h * scale, d * scale), glass);
    b.position.set(x * scale, h * scale / 2, z * scale);
    group.add(b);
    if (i === 3) {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * scale, 2.2 * scale, 58 * scale, 8), dark);
      spire.position.set(x * scale, (h + 29) * scale, z * scale);
      group.add(spire);
    }
  });
  group.position.copy(anchor);
  group.rotation.y = headingAt(anchorS);
  scene.add(group);
  addSkyGlow(scene, registry, anchorS, lat, 760 * scale, 390 * scale, 0xff9d72);
  addSkyGlow(scene, registry, anchorS + 80, lat + 90, 520 * scale, 300 * scale, 0x6f86ff);
}

// Brooklyn is primarily brick walk-ups and row-house neighborhoods, punctuated
// by taller apartment slabs—not a continuous wall of glass office towers.
function brooklynResidentialSlabs(scene, registry, s0, s1, seed) {
  const rand = rng(seed);
  const mat = facadeMaterial(registry, 'i278BrownstoneMat', seed);
  const colors = [0x6a352e, 0x81483b, 0x9b6551, 0x70524a, 0x8e7868, 0x5e4039];
  const blocks = [];
  for (let s = s0 + 260; s < s1; s += 190 + rand() * 210) {
    if (rand() < 0.3) continue;
    for (const side of [-1, 1]) {
      if (rand() < 0.22) continue;
      const lat = side * (95 + rand() * 165);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      blocks.push({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.13,
        sx: 22 + rand() * 34, sy: 32 + rand() * 46, sz: 18 + rand() * 32,
        color: new THREE.Color(colors[(rand() * colors.length) | 0]),
      });
    }
  }
  scatterInstanced(scene, BOX, mat, blocks);
  const roof = new THREE.MeshStandardMaterial({ color: 0x33302e, roughness: 1 });
  scatterInstanced(scene, BOX, roof, blocks.map((b, i) => ({
    pos: b.pos.clone().setY(b.pos.y + b.sy), rot: b.rot,
    sx: b.sx * 1.02, sy: i % 3 === 0 ? 2.4 : 0.7, sz: b.sz * 1.02,
  })));
}

function njIndustrial(scene, registry) {
  const seamSafeExtent = s => {
    const t = Math.max(0, Math.min(1, s / 2200));
    const minimum = pavedHalfAt(s) + 8;
    return minimum + (900 - minimum) * t * t;
  };
  urbanFloor(scene, 0, 9000, 27801, { walls: false, extent: seamSafeExtent });
  buildNoiseWall(scene, 300, 9000, { seed: 27802, height: 5.7, gapChance: 0.04 });
  buildSuburb(scene, registry, 400, 8900, { wall: true, turnpike: true });
  deepSprawl(scene, 27803, 400, 9000, { density: 1.4, towers: true, glowMat: facadeMaterial(registry, 'i278UrbanMat', 27804) });
  port(scene, 27805, 900, 8200);
  buildBillboards(scene, registry, 27806, 300, 8700, 36);
  buildTrees(scene, 27807, 400, 9000, 22, 55, 260, 0, false, 0.9);
}

function outerbridgeBanks(scene, registry) {
  const warehouseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.08 });
  const warehouseColors = [0x777c7f, 0x909497, 0xa29f96, 0x686f73, 0x8a8177];
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xb9bbb7, roughness: 0.55, metalness: 0.38 });
  const tankGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  tankGeo.translate(0, 0.5, 0);
  const rand = rng(27810);
  for (const [s0, s1, seed] of [[8200, 10500, 27811], [11900, 15000, 27812]]) {
    urbanFloor(scene, s0, s1, seed, { walls: false });
    buildNoiseWall(scene, s0, s1, { seed: seed + 1, height: 5.8, margin: 4, step: 11, gapChance: 0.08 });
    const warehouses = [];
    const tanks = [];
    for (let s = s0; s < s1; s += 58) {
      for (const side of [-1, 1]) {
        const lat = side * (pavedHalfAt(s) + 36 + rand() * 85);
        const pos = posAt(s, lat, new THREE.Vector3());
        pos.y = groundY(s, lat);
        warehouses.push({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.12,
          sx: 28 + rand() * 48, sy: 8 + rand() * 13, sz: 34 + rand() * 54,
          color: new THREE.Color(warehouseColors[(rand() * warehouseColors.length) | 0]),
        });
        if ((s / 58 | 0) % 3 === 0) {
          const tankLat = side * (pavedHalfAt(s) + 125 + rand() * 150);
          const tankPos = posAt(s + 18, tankLat, new THREE.Vector3());
          tankPos.y = groundY(s + 18, tankLat);
          tanks.push({ pos: tankPos, rot: 0, sx: 8 + rand() * 10, sy: 9 + rand() * 13, sz: 8 + rand() * 10 });
        }
      }
    }
    scatterInstanced(scene, BOX, warehouseMat, warehouses);
    scatterInstanced(scene, tankGeo, tankMat, tanks);
    deepSprawl(scene, seed + 2, s0, s1, { density: 1.15, towers: false });
    buildTrees(scene, seed + 3, s0, s1, 19, 150, 430, 0, false, 0.85);
  }
  port(scene, 27815, 8200, 10350);
  port(scene, 27816, 12100, 14800);
}

function statenIsland(scene, registry) {
  urbanFloor(scene, 14000, 32000, 27820, { walls: true });
  buildNoiseWall(scene, 14000, 32000, { seed: 27821, height: 6.4, step: 10, gapChance: 0.045 });
  buildTrees(scene, 27822, 14000, 32000, 8.5, 35, 270, 0, false, 1.15);
  buildSuburb(scene, registry, 14000, 32000, { wall: true, seed: 27823, density: 26 });
  deepSprawl(scene, 27824, 14000, 32000, { density: 1.05, towers: false });
  crossStreetOverpasses(scene, [15100, 16700, 18450, 20300, 22400, 24300, 26100, 28200, 30400]);
}

function brooklynQueens(scene, registry) {
  urbanFloor(scene, 38000, 56000, 27840, { walls: true, brick: true });
  deckStructure(scene, 38000, 56000);
  urbanServiceGrid(scene, 38000, 56000);
  packedUrbanFrontage(scene, registry, 27843, 38000, 56000, { brownstone: true, vertical: 1.2 });
  denseBlocks(scene, registry, 27841, 38000, 56000, { density: 1.72, height: 1.18, brownstone: true, towers: false });
  brooklynResidentialSlabs(scene, registry, 38000, 56000, 27844);
  crossStreetOverpasses(scene, urbanOverpassSites(38400, 55800, 360));
  buildTrees(scene, 27845, 38200, 44400, 31, 48, 150, 55, false, 0.72);
  buildTrees(scene, 27846, 48200, 55800, 34, 52, 170, 50, false, 0.7);
  interchangeFlyover(scene, 40200, 41900, -1);
  interchangeFlyover(scene, 46300, 48100, 1);
  interchangeFlyover(scene, 51500, 53200, -1);

  urbanFloor(scene, 61000, 73000, 27850, { walls: true, brick: true });
  deckStructure(scene, 61000, 73000);
  urbanServiceGrid(scene, 61000, 73000);
  packedUrbanFrontage(scene, registry, 27853, 61000, 73000, { vertical: 1.2 });
  denseBlocks(scene, registry, 27851, 61000, 73000, { density: 1.65, height: 1.12, brownstone: false, towers: true });
  crossStreetOverpasses(scene, urbanOverpassSites(61300, 72800, 340));
  buildTrees(scene, 27847, 61200, 66800, 34, 52, 170, 48, false, 0.68);
  buildTrees(scene, 27848, 69200, 73000, 31, 48, 150, 46, false, 0.7);
  interchangeFlyover(scene, 64000, 65700, 1);
  interchangeFlyover(scene, 66600, 68400, -1);
  interchangeFlyover(scene, 69900, 71600, 1);
}

function bronx(scene, registry) {
  // The rendered road closes into NJ at s=0. Taper broad Bronx scenery before
  // that seam so city slabs and trees cannot overlap the NJ-440 carriageway.
  const seamSafeExtent = s => {
    const t = Math.max(0, Math.min(1, (87500 - s) / 5000));
    return pavedHalfAt(s) + 8 + 2170 * t * t;
  };
  urbanFloor(scene, 79000, 89500, 27860, { walls: true, brick: true, extent: seamSafeExtent });
  deckStructure(scene, 79000, 89200);
  denseBlocks(scene, registry, 27861, 79000, 87000, { density: 1.75, height: 1.22, brownstone: false, towers: true });
  buildTrees(scene, 27862, 79000, 87000, 24, 55, 250, 0, false, 0.62);
  crossStreetOverpasses(scene, [80100, 81800, 83600, 85300, 87000]);
}

export function buildI278(scene, registry) {
  njIndustrial(scene, registry);
  welcomeSign(scene, registry, 650, 1, ['NJ-440 NORTH', 'WOODBRIDGE · PERTH AMBOY', 'I-95 / NJ TURNPIKE'], '#123a7a');
  routeSign(scene, registry, 1650, ['NJ-440 NORTH', 'STATEN ISLAND', 'OUTERBRIDGE CROSSING']);
  routeSign(scene, registry, 6100, ['NJ-440 NORTH', 'OUTERBRIDGE CROSSING', 'NEW YORK · 3 MILES']);

  outerbridgeBanks(scene, registry);
  water(scene, 11200, 1550, 720);
  deckStructure(scene, 8500, 14000);
  outerbridgeTruss(scene, 8500, 14000);
  cashlessToll(scene, registry, 9200, 'OUTERBRIDGE CROSSING');
  welcomeSign(scene, registry, 13600, 1, ['WELCOME TO NEW YORK', 'STATEN ISLAND', 'NY-440 NORTH'], '#123a7a');

  statenIsland(scene, registry);
  routeSign(scene, registry, 15400, ['WEST SHORE EXPRESSWAY', 'NY-440 NORTH', 'I-278 · VERRAZZANO BRIDGE']);
  routeSign(scene, registry, 21900, ['I-278 EAST', 'STATEN ISLAND EXPRESSWAY', 'VERRAZZANO BRIDGE']);
  hovLane(scene, registry, 22000, 31200, 'STATEN ISLAND EXPWY');
  routeSign(scene, registry, 28600, ['I-278 EAST', 'VERRAZZANO-NARROWS BR', 'BROOKLYN · LOWER LEVEL']);

  water(scene, 35000, 6500, 1450);
  suspensionBridge(scene, 31500, 38500, 32900, 36900, 88);
  deckStructure(scene, 31500, 38500);
  lowerManhattanSkyline(scene, registry);
  cashlessToll(scene, registry, 32300, 'VERRAZZANO-NARROWS BRIDGE');
  routeSign(scene, registry, 33700, ['VERRAZZANO-NARROWS BRIDGE', 'UPPER / LOWER LEVELS', 'BROOKLYN · I-278 EAST'], 0, '#046a38', 12.5);
  routeSign(scene, registry, 37400, ['WELCOME TO BROOKLYN', 'I-278 EAST · BQE', 'BELT PKWY · GOWANUS']);

  brooklynQueens(scene, registry);
  // A second compressed-map sightline represents Lower Manhattan reappearing
  // ahead/left through gaps in the elevated BQE fabric near downtown Brooklyn.
  lowerManhattanSkyline(scene, registry, 47200, -1180, 1.2);
  hovLane(scene, registry, 38800, 45500, 'GOWANUS EXPRESSWAY', '3+');
  routeSign(scene, registry, 39700, ['I-278 EAST · GOWANUS', 'BELT PKWY · 4 AVE', 'DOWNTOWN BROOKLYN']);
  routeSign(scene, registry, 45600, ['BQE · I-278 EAST', 'HUGH L CAREY TUNNEL', 'BROOKLYN BRIDGE']);
  routeSign(scene, registry, 51800, ['BQE · I-278 EAST', 'MANHATTAN BR · NAVY YARD', 'QUEENS AHEAD']);

  // Newtown Creek is a narrow industrial channel, not an open bay. Warehouses
  // and local streets run right to both elevated approaches.
  urbanFloor(scene, 55500, 58050, 27854, { walls: false, brick: true });
  packedUrbanFrontage(scene, registry, 27855, 55500, 58050, { vertical: 0.82 });
  denseBlocks(scene, registry, 27858, 55500, 58050, { density: 1.85, height: 0.9, towers: true });
  urbanFloor(scene, 58950, 61500, 27856, { walls: false, brick: true });
  packedUrbanFrontage(scene, registry, 27857, 58950, 61500, { vertical: 0.85 });
  denseBlocks(scene, registry, 27859, 58950, 61500, { density: 1.9, height: 0.95, towers: true });
  crossStreetOverpasses(scene, urbanOverpassSites(55700, 57600, 440));
  crossStreetOverpasses(scene, urbanOverpassSites(59400, 61300, 430));
  water(scene, 58500, 900, 640);
  const creekBankMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 1 });
  for (const [a, b] of [[-2200, -330], [330, 2200]]) {
    scene.add(new THREE.Mesh(buildRibbon(
      a, b,
      s => groundY(s, a) - elevAt(s) + 0.03,
      s => groundY(s, b) - elevAt(s) + 0.03,
      18, 58050, 58950
    ), creekBankMat));
  }
  deepSprawl(scene, 27860, 58050, 58950, {
    density: 2.2, towers: true, glowMat: facadeMaterial(registry, 'i278UrbanMat', 27860), latStart: 220,
  });
  deckStructure(scene, 56000, 61000);
  kosciuszkoTwinCableStayed(scene);
  routeSign(scene, registry, 56600, ['KOSCIUSZKO BRIDGE', 'NEWTOWN CREEK', 'QUEENS · I-278 EAST'], 0, '#123a7a');
  routeSign(scene, registry, 63200, ['BQE · I-278 EAST', 'QUEENS BLVD · BROADWAY', 'LA GUARDIA AIRPORT']);
  routeSign(scene, registry, 66900, ['EXIT 35 · I-495', 'LONG ISLAND EXPWY', 'MIDTOWN TUNNEL · EASTERN LI']);
  routeSign(scene, registry, 71500, ['GRAND CENTRAL PKWY', 'ASTORIA BLVD', 'RFK BRIDGE · BRONX']);

  urbanFloor(scene, 73000, 74900, 27870, { walls: false, brick: true });
  urbanServiceGrid(scene, 73000, 74900);
  packedUrbanFrontage(scene, registry, 27871, 73000, 74900, { vertical: 1.15 });
  denseBlocks(scene, registry, 27872, 73000, 74900, { density: 1.6, height: 1.12, towers: true });
  urbanFloor(scene, 75600, 76600, 27873, { walls: false, brick: false });
  packedUrbanFrontage(scene, registry, 27874, 75600, 76600, { vertical: 0.72 });
  urbanFloor(scene, 77300, 79000, 27875, { walls: false, brick: true });
  urbanServiceGrid(scene, 77300, 79000);
  packedUrbanFrontage(scene, registry, 27876, 77300, 79000, { brownstone: true, vertical: 1.15 });
  denseBlocks(scene, registry, 27877, 77300, 79000, { density: 1.7, height: 1.18, towers: true });
  water(scene, 75200, 1150, 920);
  water(scene, 77000, 1050, 860);
  suspensionBridge(scene, 72500, 79500, 74000, 77800, 62);
  deckStructure(scene, 72500, 79500);
  crossStreetOverpasses(scene, urbanOverpassSites(73100, 74700, 410));
  crossStreetOverpasses(scene, urbanOverpassSites(77500, 79200, 390));
  interchangeFlyover(scene, 73100, 74800, -1);
  interchangeFlyover(scene, 77400, 79000, 1);
  cashlessToll(scene, registry, 73800, 'RFK BRIDGE');
  routeSign(scene, registry, 78100, ['WELCOME TO THE BRONX', 'I-278 EAST · BRUCKNER EXPWY', 'I-87 · I-95']);

  bronx(scene, registry);
  routeSign(scene, registry, 81200, ['BRUCKNER EXPRESSWAY', 'HUNTS POINT · BRONX RIVER', 'I-895 NORTH']);
  routeSign(scene, registry, 85300, ['I-87 NORTH', 'MAJOR DEEGAN EXPWY', 'YANKEE STADIUM · ALBANY']);
  routeSign(scene, registry, 88400, ['I-95 NORTH · NEW HAVEN', 'I-295 · THROGS NECK BR', 'I-678 · WHITESTONE BR']);
  welcomeSign(scene, registry, 89500, 1, ['END I-278', 'BRUCKNER INTERCHANGE', 'I-95 · I-295 · I-678'], '#123a7a');
}
