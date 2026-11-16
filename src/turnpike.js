import * as THREE from 'three';
import { MAP, MEDIAN_HALF, LANE_WIDTH } from './config.js';
import {
  posAt, headingAt, elevAt, pavedHalfAt, njGapAt, buildRibbon, bridgeBumpAt,
  latForLane, sideFactorAt,
} from './road.js';
import { groundY, buildBillboards, clampOffRoad, foliageMats } from './environment.js';
import { MUMBAI_ADS } from './mumbai.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function textBoard(lines, w, h, bg, fg) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = fg; g.lineWidth = 6;
  g.strokeRect(8, 8, cv.width - 16, cv.height - 16);
  g.fillStyle = fg; g.textAlign = 'center';
  const size = Math.min(84, Math.floor(cv.height / (lines.length + 0.6)));
  g.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
  lines.forEach((l, i) => g.fillText(l, cv.width / 2, (i + 0.95) * (cv.height / (lines.length + 0.3))));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.08,
      roughness: 0.6, side: THREE.DoubleSide,
    })
  );
}

// full-width overhead gantry with sign boards at given lat positions
export function gantry(scene, registry, s, boards, height = 6.4) {
  const group = new THREE.Group();
  const half = pavedHalfAt(s) + 2;
  const steel = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.45, metalness: 0.6 });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.7, 0.7), steel);
  beam.position.y = height;
  group.add(beam);
  for (const x of [-half, half]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, height, 0.6), steel);
    post.position.set(x, height / 2, 0);
    group.add(post);
  }
  for (const b of boards) {
    b.mesh.position.set(b.lat, height + b.mesh.geometry.parameters.height / 2 + 0.35, 0.1);
    group.add(b.mesh);
    registry.signs.push({ userData: { board: b.mesh } });
  }
  group.position.copy(posAt(s, 0, new THREE.Vector3()));
  group.rotation.y = headingAt(s);
  scene.add(group);
}

export function water(scene, s, length, width) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x2b5570, roughness: 0.25, metalness: 0.4 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(posAt(s, 0, new THREE.Vector3()));
  mesh.position.y = -2.6;
  mesh.rotation.z = -headingAt(s);
  scene.add(mesh);
}

// Suspension bridge (George Washington Bridge): tall steel portal towers,
// draped main cables, hangers down to the deck.
export function suspensionBridge(scene, s0, s1, t1, t2, towerH = 52) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b6672, roughness: 0.45, metalness: 0.65, side: THREE.DoubleSide });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x39414b, roughness: 0.5, metalness: 0.6 });

  // towers
  for (const ts of [t1, t2]) {
    const half = pavedHalfAt(ts) + 2;
    const g = new THREE.Group();
    for (const x of [-half, half]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(3, towerH, 3.4), steel);
      col.position.set(x, towerH / 2, 0);
      g.add(col);
    }
    for (const hy of [towerH * 0.55, towerH - 2]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 3, 2.6), steel);
      brace.position.y = hy;
      g.add(brace);
    }
    g.position.copy(posAt(ts, 0, new THREE.Vector3()));
    g.rotation.y = headingAt(ts);
    scene.add(g);
  }

  // main cables: side spans rise to the towers, center span sags between them
  const cableY = s => {
    const deck = elevAt(s) + 1.5;
    const topY = ts => elevAt(ts) + towerH - 1.5;
    if (s <= t1) { const t = (s - s0) / (t1 - s0); return deck + (topY(t1) - deck) * t * t; }
    if (s >= t2) { const t = (s1 - s) / (s1 - t2); return deck + (topY(t2) - deck) * t * t; }
    const t = (s - t1) / (t2 - t1);
    const sag = 4 * t * (1 - t);
    return topY(t1) + (topY(t2) - topY(t1)) * t - sag * (towerH - 8);
  };
  const v = new THREE.Vector3();
  for (const side of [-1, 1]) {
    const pts = [];
    for (let s = s0; s <= s1; s += 12) {
      posAt(s, side * (pavedHalfAt(s) + 1.4), v);
      pts.push(new THREE.Vector3(v.x, cableY(s), v.z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.3, 6), cableMat));
    // hangers
    for (let s = s0 + 18; s < s1 - 12; s += 22) {
      posAt(s, side * (pavedHalfAt(s) + 1.4), v);
      const top = cableY(s), bot = elevAt(s) + 1;
      if (top - bot < 1.5) continue;
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.16, top - bot, 0.16), cableMat);
      h.position.set(v.x, (top + bot) / 2, v.z);
      scene.add(h);
    }
    // deck side girder
    const latF = s => side * (pavedHalfAt(s) + 0.5);
    scene.add(new THREE.Mesh(buildRibbon(latF, latF, -1.6, 1.4, 10, s0, s1), steel));
  }
}

// Elevated viaduct piers (Newark Bay Extension): the turnpike rides above
// the industrial flats on concrete bents.
export function viaductPiers(scene, s0, s1) {
  const conc = new THREE.MeshStandardMaterial({ color: 0x8f8d86, roughness: 0.9 });
  const spots = [];
  for (let s = s0; s < s1; s += 34) if (bridgeBumpAt(s) > 1.5) spots.push(s);
  const colGeo = new THREE.BoxGeometry(2.4, 1, 2.0);
  colGeo.translate(0, 0.5, 0);
  const cols = new THREE.InstancedMesh(colGeo, conc, spots.length * 2);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1.6, 2.4), conc, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  spots.forEach((s, i) => {
    const h = Math.max(2, bridgeBumpAt(s) + 1.2);
    q.setFromAxisAngle(UP, headingAt(s));
    for (const [j, lat] of [[0, -8], [1, 8]].values()) {
      posAt(s, lat, p);
      p.y = elevAt(s) - h;
      sc.set(1, h - 1, 1);
      m.compose(p, q, sc);
      cols.setMatrixAt(i * 2 + j, m);
    }
    posAt(s, 0, p);
    p.y = elevAt(s) - 1.6;
    sc.set(pavedHalfAt(s) * 2 + 2, 1, 1);
    m.compose(p, q, sc);
    caps.setMatrixAt(i, m);
  });
  scene.add(cols, caps);
}

// Port Newark–Elizabeth: container gantry cranes + stacked boxes
export function port(scene, seed, s0, s1) {
  const rand = rng(seed);
  const steel = new THREE.MeshStandardMaterial({ color: 0x2f6b8f, roughness: 0.5, metalness: 0.5 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const contColors = [0xc8342a, 0x15355e, 0x0d6b3f, 0xd97b1f, 0x8a8f94, 0x6b1f8a];
  const stacks = [];
  for (let cs = s0; cs < s1; cs += 480 + rand() * 300) {
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (85 + rand() * 60);
    // crane: 4 legs, portal beam, boom
    const g = new THREE.Group();
    const H = 26 + rand() * 8;
    for (const dx of [-9, 9]) for (const dz of [-6, 6]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, H, 1.4), steel);
      leg.position.set(dx, H / 2, dz);
      g.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(20, 2.2, 3), steel);
    beam.position.y = H;
    g.add(beam);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 34), steel);
    boom.position.set(0, H + 1.6, -8);
    g.add(boom);
    const pos = posAt(cs, lat, new THREE.Vector3());
    pos.y = groundY(cs, lat);
    g.position.copy(pos);
    g.rotation.y = headingAt(cs);
    scene.add(g);
    // container stacks nearby
    for (let k = 0; k < 26; k++) {
      const ss = cs + (rand() - 0.5) * 220;
      const ll = lat + (rand() - 0.5) * 70;
      const p2 = posAt(ss, ll, new THREE.Vector3());
      p2.y = groundY(ss, ll);
      stacks.push(clampOffRoad({
        pos: p2, rot: headingAt(ss),
        sx: 2.5, sy: 2.6 * (1 + (rand() * 3 | 0)), sz: 6 + rand() * 8,
        color: new THREE.Color(contColors[(rand() * contColors.length) | 0]),
      }, ss, ll, 6));
    }
  }
  const mesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), stacks.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  stacks.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx, b.sy, b.sz);
    m.compose(b.pos, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, b.color);
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
}

export function bridgeStructure(scene, s0, s1, towerS) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x46586b, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide });
  // tall side trusses
  for (const side of [-1, 1]) {
    const latF = s => side * (pavedHalfAt(s) + 0.6);
    scene.add(new THREE.Mesh(buildRibbon(latF, latF, 0.4, 7.5, 8, s0, s1), steel));
    scene.add(new THREE.Mesh(buildRibbon(
      s => side * (pavedHalfAt(s) + 0.2), s => side * (pavedHalfAt(s) + 1.0),
      7.5, 7.5, 8, s0, s1), steel));
  }
  // portal towers
  for (const ts of towerS) {
    const half = pavedHalfAt(ts) + 1.5;
    const g = new THREE.Group();
    for (const x of [-half, half]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(2.2, 42, 2.6), steel);
      col.position.set(x, 21, 0);
      g.add(col);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 2, 2.6, 2.6), steel);
    top.position.y = 40;
    g.add(top);
    g.position.copy(posAt(ts, 0, new THREE.Vector3()));
    g.rotation.y = headingAt(ts);
    scene.add(g);
  }
}

// Soft radial glow texture, cached — the falloff used for city sky-glow halos.
let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,226,176,0.95)');
  grad.addColorStop(0.4, 'rgba(255,190,120,0.4)');
  grad.addColorStop(1, 'rgba(255,168,96,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

// A soft additive halo hung over a skyline — the orange light-dome a city
// throws up into the night sky, visible from miles off. Invisible by day; its
// opacity is ramped with nightFactor via registry.skyGlow. As a Sprite it faces
// the camera, so the glow reads from any angle and any distance.
export function addSkyGlow(scene, registry, s, lat, width, height, color = 0xffb478) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(width, height, 1);
  const pos = posAt(s, lat, new THREE.Vector3());
  pos.y = groundY(s, lat) + height * 0.34;
  sp.position.copy(pos);
  scene.add(sp);
  (registry.skyGlow = registry.skyGlow || []).push(mat);
  return sp;
}

// big-city skyline cluster sharing the lit-window tower material
export function skyline(scene, registry, seed, s0, s1, step, latMin, latMax, hMin, hMax, sides = [-1, 1]) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const mat = registry.towerMats[0];
  const rand = rng(seed);
  const places = [];
  for (let s = s0; s < s1; s += step * (0.6 + rand() * 0.8)) {
    for (const side of sides) {
      if (rand() < 0.2) continue;
      const lat = side * (latMin + rand() * (latMax - latMin));
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      places.push(clampOffRoad({
        pos, rot: rand() * TAU,
        sx: 18 + rand() * 34, sz: 18 + rand() * 34,
        sy: hMin + Math.pow(rand(), 1.35) * (hMax - hMin),
        tint: 0.7 + rand() * 0.45,
      }, s, lat, 4));
    }
  }
  const mesh = new THREE.InstancedMesh(boxGeo, mat, places.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  places.forEach((p, i) => {
    q.setFromAxisAngle(UP, p.rot);
    sc.set(p.sx, p.sy, p.sz);
    m.compose(p.pos, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setScalar(p.tint));
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  // colorful crown lighting on the taller towers — the Empire State /
  // skyline-glow effect that makes cities read as cities after dark
  const tall = places.filter(p => p.sy > hMin + (hMax - hMin) * 0.45);
  if (tall.length) {
    if (!registry.crownMats) {
      registry.crownMats = [0xff4d3a, 0x3a8dff, 0xffc23d, 0x35d06a, 0xc84dff, 0x2ee6d6]
        .map(c => new THREE.MeshStandardMaterial({
          color: 0x111111, emissive: c, emissiveIntensity: 0.15,
        }));
    }
    const crownGeo = new THREE.BoxGeometry(1, 1, 1);
    crownGeo.translate(0, 0.5, 0);
    const byMat = registry.crownMats.map(() => []);
    tall.forEach(p => { byMat[(rand() * byMat.length) | 0].push(p); });
    byMat.forEach((group, mi) => {
      if (!group.length) return;
      const crowns = new THREE.InstancedMesh(crownGeo, registry.crownMats[mi], group.length);
      group.forEach((p, i) => {
        q.setFromAxisAngle(UP, p.rot);
        sc.set(p.sx * 0.55, 2.2 + p.sy * 0.03, p.sz * 0.55);
        m.compose(p.pos.clone().setY(p.pos.y + p.sy), q, sc);
        crowns.setMatrixAt(i, m);
      });
      scene.add(crowns);
    });
  }

  // sky-glow halo over a real downtown — only for clusters with genuine towers,
  // sized to the cluster and its height so a big skyline throws a big glow
  // I-95 already has dense illuminated skylines; the oversized additive halo
  // reads as an artificial orange band across the entire night horizon.
  if (hMax > 45 && MAP !== 'i95') {
    const cs = (s0 + s1) / 2;
    const glat = sides.length === 1 ? sides[0] * (latMin + latMax) / 2 : 0;
    addSkyGlow(scene, registry, cs, glat, Math.max(s1 - s0, latMax) * 0.8 + 160, hMax * 2.6);
  }
}

// Full-service toll plaza: canopy over all lanes, booth islands between
// lanes, per-lane signs (E-ZPass / no-cash / full service / cash).
const TOLL_LANE_SIGNS = [
  ['E-ZPass', 'EXPRESS', '#3d1d63'],
  ['E-ZPass', 'EXPRESS', '#3d1d63'],
  ['E-ZPass ONLY', 'NO CASH', '#3d1d63'],
  ['E-ZPass', '· CASH ·', '#0d4a2c'],
  ['FULL', 'SERVICE', '#0d4a2c'],
  ['CASH ONLY', 'RECEIPT', '#0d4a2c'],
];

// Indian toll plaza lane signs: FASTag e-toll + trilingual cash lanes
export const INDIA_TOLL_SIGNS = [
  ['FASTag', 'E-TOLL', '#3d1d63'],
  ['FASTag', 'E-TOLL', '#3d1d63'],
  ['FASTag ONLY', 'NO CASH', '#3d1d63'],
  ['CASH · रोख', 'नकद', '#0d4a2c'],
  ['FULL SERVICE', 'रोख · नकद', '#0d4a2c'],
  ['CASH ONLY', 'रोख / नकद', '#0d4a2c'],
];

export function buildTollPlaza(scene, registry, s, laneSigns = TOLL_LANE_SIGNS, laneTotal = 6) {
  const conc = new THREE.MeshStandardMaterial({ color: 0xb8b4aa, roughness: 0.9 });
  const boothMat = new THREE.MeshStandardMaterial({ color: 0x5d6672, roughness: 0.6, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbcd4de, roughness: 0.15, metalness: 0.3 });
  const half = pavedHalfAt(s) + 3;
  const group = new THREE.Group();

  // canopy across everything
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.7, 9), conc);
  canopy.position.y = 6.1;
  group.add(canopy);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.2, 0.3), boothMat);
  fascia.position.set(0, 5.4, 4.6);
  group.add(fascia);

  for (const dir of [1, -1]) {
    for (let lane = 0; lane <= laneTotal; lane++) {
      // booth island between lane centers (and at the two edges)
      const latA = latForLane(dir, Math.max(0, lane - 1), s);
      const latB = latForLane(dir, Math.min(laneTotal - 1, lane), s);
      const lat = lane === 0 ? latA + (dir > 0 ? 1 : -1) * 2.4
        : lane === laneTotal ? latB - (dir > 0 ? 1 : -1) * 2.4
        : (latA + latB) / 2;
      const island = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 8), conc);
      island.position.set(lat, 0.18, 0);
      group.add(island);
      const booth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 2.6), boothMat);
      booth.position.set(lat, 1.5, 0);
      group.add(booth);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.8, 2.0), glassMat);
      glass.position.set(lat, 2.1, 0);
      group.add(glass);
      // canopy support column every other island
      if (lane % 2 === 0) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), conc);
        col.position.set(lat, 3, 3.4);
        group.add(col);
      }
    }
    // per-lane signs hanging off the canopy
    for (let lane = 0; lane < laneTotal; lane++) {
      const [l1, l2, bg] = laneSigns[lane % laneSigns.length];
      const sign = textBoard([l1, l2], 2.9, 1.7, bg, '#ffffff');
      sign.position.set(latForLane(dir, lane, s), 4.5, dir > 0 ? -4.8 : 4.8);
      if (dir < 0) sign.rotation.y = Math.PI;
      group.add(sign);
      registry.signs.push({ userData: { board: sign } });
    }
  }
  group.position.copy(posAt(s, 0, new THREE.Vector3()));
  group.rotation.y = headingAt(s);
  scene.add(group);
}

export function buildPune(scene, registry) {
  // Vashi creek crossing into Navi Mumbai
  bridgeStructure(scene, 32150, 33050, [32450, 32750]);
  water(scene, 32600, 600, 2400);

  // Vashi toll plaza right after the creek, then the ghat/Pune toll at the far
  // end of the expressway where it drops into Pimpri-Chinchwad
  buildTollPlaza(scene, registry, 34200, INDIA_TOLL_SIGNS);
  buildTollPlaza(scene, registry, 85500, INDIA_TOLL_SIGNS);

  // Navi Mumbai + Panvel: planned-city mid-rises, pastel and orderly
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const tints = [0xd9cfc0, 0xc9d4d9, 0xd9c9c9, 0xcfd9c5, 0xd0c5d9];
  const rand = rng(555);
  const blocks = [];
  for (let s = 33100, sEnd = 41000; s < sEnd; s += 26 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue;
      const lat = side * (26 + rand() * 160);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      blocks.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
        sx: 12 + rand() * 14, sy: 12 + rand() * 34, sz: 12 + rand() * 14,
        color: new THREE.Color(tints[(rand() * tints.length) | 0]),
      }, s, lat, 1));
    }
  }
  const mesh = new THREE.InstancedMesh(boxGeo, mat, blocks.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  blocks.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx, b.sy, b.sz);
    m.compose(b.pos, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, b.color);
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  // Ghats: a long band of dense lush broadleaf forest climbing the steep
  // slopes, with expressway tunnels bored through the ridges
  buildGhatForest(scene, 42000, 82000);
  buildGhatTunnels(scene);

  // Pimpri-Chinchwad: where the expressway hits the city — high-rises, IT
  // parks, hoardings and the chaotic sprawl of greater Pune
  buildPimpri(scene, registry, rng(999));

  buildPuneCity(scene, registry, rng(777));

  // hoardings the whole length of the run: Navi Mumbai, ghats, Pimpri, Pune
  buildBillboards(scene, registry, 977, 33000, 96500, 72, INDIA_HIGHWAY_ADS);
}

// Pimpri-Chinchwad: glassy IT-park slabs (Hinjawadi), residential towers, and
// the dense low sprawl that fronts the highway as you arrive into Pune.
function buildPimpri(scene, registry, rand) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.25, metalness: 0.5 });
  const tints = [0xe0dcd2, 0xd4d0c6, 0xc8c4ba, 0xd9c49a, 0xd4a89a, 0xb9c9b2];
  const low = [], towers = [], glass = [];
  for (let s = 87000, sEnd = 92500; s < sEnd; s += 7 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.08) continue;
      const lat = side * (22 + Math.pow(rand(), 1.25) * 300);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.78 + rand() * 0.3);
      const r = rand();
      if (r < 0.62) {
        low.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.5,
          sx: 9 + rand() * 14, sz: 9 + rand() * 14,
          sy: 7 + Math.pow(rand(), 1.4) * 26, color,
        }, s, lat, -0.5));
      } else if (r < 0.86) {
        towers.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
          sx: 13 + rand() * 9, sz: 13 + rand() * 9,
          sy: 45 + rand() * 45, color,
        }, s, lat, 0));
      } else {
        glass.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.25,
          sx: 24 + rand() * 22, sz: 16 + rand() * 12,
          sy: 22 + rand() * 28,
          color: new THREE.Color(0xffffff).multiplyScalar(0.85 + rand() * 0.25),
        }, s, lat, 2));
      }
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const place = (list, material) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(boxGeo, material, list.length);
    list.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.rot);
      sc.set(b.sx, b.sy, b.sz);
      m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, b.color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  };
  place(low, flat);
  place(towers, registry.towerMats?.[0] ?? flat);
  place(glass, glassMat);
}

// Expressway/Pune hoardings: corporates, cricket, and the political parties
// that own every flyover pillar in Maharashtra
export const INDIA_HIGHWAY_ADS = [
  ['TATA MOTORS', '#15355e', '#fff'], ['MAHINDRA', '#c8342a', '#fff'],
  ['RELIANCE JIO', '#0a2885', '#fff'], ['मुंबई इंडियन्स', '#005baa', '#ffd23d'],
  ['भाजपा 🪷', '#ff9933', '#0d3a12'], ['शिवसेना', '#ff6f00', '#fff'],
  ['AMUL अमूल', '#15355e', '#ffd23d'], ['TATA STEEL', '#2a3b8f', '#fff'],
  ['बजाज BAJAJ', '#0d6b3f', '#fff'], ['IPL 2026', '#3d1054', '#ffd23d'],
];

// Two tunnels on the ghat section: rock walls, flat ceiling, sodium strip
// lights that stay lit around the clock.
function buildGhatTunnels(scene) {
  const rock = new THREE.MeshStandardMaterial({ color: 0x5a5548, roughness: 1, side: THREE.DoubleSide });
  const portalMat = new THREE.MeshStandardMaterial({ color: 0x8f8a7c, roughness: 0.9 });
  const lit = new THREE.MeshBasicMaterial({ color: 0xffc873 });
  for (const [t0, t1] of [[48000, 48800], [57800, 58700], [70200, 71100], [76200, 77000]]) {
    for (const side of [-1, 1]) {
      const latF = s => side * (pavedHalfAt(s) + 1.0);
      scene.add(new THREE.Mesh(buildRibbon(latF, latF, 0, 6.6, 10, t0, t1), rock));
    }
    scene.add(new THREE.Mesh(buildRibbon(
      s => -(pavedHalfAt(s) + 1.0), s => pavedHalfAt(s) + 1.0, 6.6, 6.6, 10, t0, t1), rock));
    // twin rows of ceiling strip lights
    for (const off of [-4.5, 4.5]) {
      scene.add(new THREE.Mesh(buildRibbon(off - 0.18, off + 0.18, 6.35, 6.35, 14, t0 + 10, t1 - 10), lit));
    }
    // portal frames
    for (const ts of [t0, t1]) {
      const half = pavedHalfAt(ts) + 2.2;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 2.4, 2.2), portalMat);
      frame.position.copy(posAt(ts, 0, new THREE.Vector3()));
      frame.position.y += 7.6;
      frame.rotation.y = headingAt(ts);
      scene.add(frame);
    }
  }
}

// State-line welcome sign facing traffic travelling in `dir` (+1 = with
// increasing s), placed on that direction's outer shoulder.
export function welcomeSign(scene, registry, s, dir, lines, bg = '#123a7a') {
  const side = (dir > 0 ? -1 : 1) * Math.sign(sideFactorAt(s, dir) || 1);
  const board = textBoard(lines, 9, 4.4, bg, '#ffffff');
  const g = new THREE.Group();
  board.position.y = 5.6;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.6 });
  for (const px of [-3.4, 3.4]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.6, 6), poleMat);
    pole.position.set(px, 1.8, 0.1);
    g.add(pole);
  }
  g.add(board);
  g.position.copy(posAt(s, side * (pavedHalfAt(s) + 6.5), new THREE.Vector3()));
  // face the traffic travelling in `dir`: a board reads to a driver when its
  // normal points back UP-traffic, i.e. opposite the direction of travel. +s
  // travel is faced by headingAt + PI (see posAt: lat>0 is LEFT of +s).
  g.rotation.y = headingAt(s) + (dir > 0 ? Math.PI : 0);
  scene.add(g);
  registry.signs.push({ userData: { board } });
}

// Pune as it actually is: a low, sprawling city — weathered 3-6 story
// apartment blocks and old wada-style houses stretching to the hills, the
// odd newer 15-20 story tower, and the Hinjawadi IT-park glass slabs where
// the expressway comes down off the ghats. Not a Manhattan skyline.
function buildPuneCity(scene, registry, rand) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const flat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const tints = [0xe0dcd2, 0xd4d0c6, 0xc8c4ba, 0xd9c49a, 0xd4a89a, 0xb9c9b2, 0xcbb894];
  const low = [], towers = [], glass = [];
  for (let s = 92500, sEnd = 97000; s < sEnd; s += 6.2 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.1) continue;
      const lat = side * (24 + Math.pow(rand(), 1.2) * 400);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.75 + rand() * 0.3);
      const r = rand();
      if (r < 0.86) {
        // the endless low carpet: apartment blocks, wadas, shops-with-flats
        low.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.5,
          sx: 9 + rand() * 12, sz: 9 + rand() * 12,
          sy: 6 + Math.pow(rand(), 1.5) * 22, color,
        }, s, lat, -0.5));
      } else if (r < 0.97) {
        // newer residential towers scattered through the sprawl
        towers.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
          sx: 12 + rand() * 8, sz: 12 + rand() * 8,
          sy: 40 + rand() * 30, color,
        }, s, lat, 0));
      } else {
        // Hinjawadi-style IT park glass slabs
        glass.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
          sx: 26 + rand() * 20, sz: 16 + rand() * 10,
          sy: 20 + rand() * 22,
          color: new THREE.Color(0xffffff).multiplyScalar(0.85 + rand() * 0.25),
        }, s, lat, 2));
      }
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const place = (list, mat) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(boxGeo, mat, list.length);
    list.forEach((b, i) => {
      q.setFromAxisAngle(UP, b.rot);
      sc.set(b.sx, b.sy, b.sz);
      m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, b.color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  };
  place(low, flat);
  place(towers, registry.towerMats?.[0] ?? flat);
  place(glass, new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.25, metalness: 0.5 }));
}

function buildGhatForest(scene, s0, s1) {
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.5, 5);
  trunkGeo.translate(0, 1.25, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.9, 0);
  crownGeo.translate(0, 4.3, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3b28, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 1 });
  // the Ghats stay greener than the Deccan flats even in the dry season (the
  // Sahyadri slopes catch the last of the monsoon moisture) — a shallower
  // dry/monsoon swing than the lowland forest fill
  crownMat.userData.dry = new THREE.Color(0x4f7a3f);
  crownMat.userData.monsoon = new THREE.Color(0x2f6b2a);
  foliageMats.push(crownMat);
  const rand = rng(888);
  const places = [];
  for (let s = s0; s < s1; s += 9 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.2) continue;
      const lat = side * (20 + rand() * 320);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const sc = 1 + rand() * 2.4;
      places.push(clampOffRoad(
        { pos, rot: rand() * TAU, sx: sc, sy: sc * (0.9 + rand() * 0.6), sz: sc }, s, lat, 1));
    }
  }
  for (const [geo, mat] of [[trunkGeo, trunkMat], [crownGeo, crownMat]]) {
    const mesh = new THREE.InstancedMesh(geo, mat, places.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    places.forEach((p, i) => {
      q.setFromAxisAngle(UP, p.rot);
      v.set(p.sx, p.sy, p.sz);
      m.compose(p.pos, q, v);
      mesh.setMatrixAt(i, m);
    });
    scene.add(mesh);
  }
}
