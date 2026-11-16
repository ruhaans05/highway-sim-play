import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, buildRibbon } from '../road.js';
import {
  groundY, roadClearAt, clampOffRoad, scatterInstanced, lowLitMaterial,
  buildNoiseWall, buildTrees,
} from '../environment.js';
import { textBoard, gantry } from '../turnpike.js';

export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// A terrain-conforming, parcel-coloured metro floor. Each side is meshed
// independently, so no triangle can bridge across or cover the expressway.
export function urbanTerrain(scene, s0, s1, halfWidth, seed, palette, opts = {}) {
  const step = opts.step || 70;
  const bands = opts.bands || 8;
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const rand = seeded(seed);
  for (const side of [-1, 1]) {
    const positions = new Float32Array((n + 1) * bands * 3);
    const colors = new Float32Array((n + 1) * bands * 3);
    const indices = [];
    for (let i = 0; i <= n; i++) {
      const s = s0 + (s1 - s0) * i / n;
      // Ground cover follows the actual paved edge. Solid scenery still uses
      // roadClearAt(), but letting exit clearances drive this mesh exposed
      // broad grass bands through otherwise continuous metro districts.
      const inner = Math.min(halfWidth - 8, pavedHalfAt(s) + 4);
      const rowColor = new THREE.Color(palette[(i + ((rand() * palette.length) | 0)) % palette.length]);
      for (let j = 0; j < bands; j++) {
        const t = j / (bands - 1);
        const lat = side * (inner + (halfWidth - inner) * t);
        const p = posAt(s, lat, new THREE.Vector3());
        // Sit decisively above the global terrain mesh. A tiny coplanar lift
        // z-fought at shallow camera angles and let the green base erase the
        // urban surface in the exact views this system exists to replace.
        p.y = groundY(s, lat) + 0.22;
        const v = i * bands + j;
        positions.set([p.x, p.y, p.z], v * 3);
        const shade = 0.86 + 0.18 * (((i + j) % 3) / 2);
        colors.set([rowColor.r * shade, rowColor.g * shade, rowColor.b * shade], v * 3);
        if (i < n && j < bands - 1) {
          const k = v, next = k + bands;
          indices.push(k, next, k + 1, k + 1, next, next + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    // The two independently built roadside halves have opposite winding in
    // road-local space. Render both faces so neither side disappears as the
    // route curves or when the player reverses direction.
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 1, side: THREE.DoubleSide,
    }));
    mesh.receiveShadow = true;
    mesh.userData.midwestUrbanTerrain = true;
    scene.add(mesh);
  }
}

export function groundStrip(scene, s0, s1, latAt, width, color, opts = {}) {
  const step = opts.step || 34;
  const lift = opts.lift ?? 0.07;
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  const positions = new Float32Array((n + 1) * 6);
  const indices = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * i / n;
    const center = typeof latAt === 'function' ? latAt(s) : latAt;
    for (let edge = 0; edge < 2; edge++) {
      const lat = center + (edge ? width / 2 : -width / 2);
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat) + lift;
      positions.set([p.x, p.y, p.z], (i * 2 + edge) * 3);
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
  mesh.receiveShadow = true; mesh.userData.midwestGroundStrip = true; scene.add(mesh);
  return mesh;
}

export function frontageNetwork(scene, s0, s1, opts = {}) {
  const streetColor = opts.streetColor || 0x303235;
  for (const side of [-1, 1]) {
    const center = s => side * (roadClearAt(s) + (opts.offset || 25));
    // Continuous paved/service frontage owns the near field between freeway
    // barriers and the first parcels; no broad strip of base grass survives.
    groundStrip(scene, s0, s1, center, opts.apronWidth || 40, 0x55585a, { lift: 0.18, step: 28 });
    groundStrip(scene, s0, s1, center, opts.width || 12, streetColor, { lift: 0.25, step: 28 });
    groundStrip(scene, s0, s1, s => center(s) - side * 7.2, 1.8, 0x928f87, { lift: 0.28, step: 28 });
    groundStrip(scene, s0, s1, s => center(s) + side * 7.2, 1.8, 0x928f87, { lift: 0.28, step: 28 });
  }
}

// Buildings are assigned to repeated parcels behind the frontage street, not
// scattered over a featureless plane. Rows are staggered and each parcel gets
// a paved apron, creating continuous urban depth in forward and reverse views.
export function parcelCity(scene, registry, s0, s1, seed, opts = {}) {
  const rand = seeded(seed);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const buildings = [], lots = [];
  const rows = opts.rows || 4;
  const step = opts.step || 86;
  const colors = opts.colors || [0x8b5e4b, 0xa37b64, 0x929495, 0xb3aa9b, 0x747b7d];
  for (let base = s0 + 30; base < s1; base += step * (0.86 + rand() * 0.28)) {
    for (const side of [-1, 1]) {
      for (let row = 0; row < rows; row++) {
        if (row && rand() < (opts.gapChance ?? 0.08)) continue;
        const s = base + row * 19 + (rand() - 0.5) * 24;
        const clear = roadClearAt(s);
        const lat = side * (clear + 58 + row * (opts.rowGap || 86) + rand() * 30);
        const industrial = opts.industrial || (opts.industrialAfter != null && s >= opts.industrialAfter);
        const sx = (industrial ? 34 : 16) + rand() * (industrial ? 76 : 34);
        const sz = (industrial ? 28 : 15) + rand() * (industrial ? 64 : 32);
        const sy = (opts.hMin || (industrial ? 7 : 6)) + rand() * (opts.hRange || (industrial ? 14 : 22));
        const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
        const b = clampOffRoad({
          pos: p,
          rot: headingAt(s) + (industrial ? (rand() - 0.5) * 0.18 : (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.32),
          sx, sy, sz,
          color: new THREE.Color(colors[(rand() * colors.length) | 0]),
        }, s, lat, 5);
        buildings.push(b);
        const lotLat = lat - side * (sz * 0.55 + 10);
        const lp = posAt(s, lotLat, new THREE.Vector3()); lp.y = groundY(s, lotLat) + 0.05;
        lots.push({ pos: lp, rot: headingAt(s), sx: sx * 1.25, sy: 0.11, sz: 16 + rand() * 24 });
      }
    }
  }
  const buildingMesh = scatterInstanced(scene, box, lowLitMaterial(registry), buildings);
  buildingMesh.userData.midwestParcelBuildings = true;
  const lotMesh = scatterInstanced(scene, box,
    new THREE.MeshStandardMaterial({ color: opts.lotColor || 0x444748, roughness: 0.99 }), lots, { shadow: false });
  lotMesh.userData.midwestParcelLots = true;
}

export function overpass(scene, registry, s, name, opts = {}) {
  const origin = posAt(s, 0, new THREE.Vector3());
  const clear = roadClearAt(s);
  const span = (clear + (opts.overhang || 24)) * 2;
  const deckY = opts.deckY || 8.2;
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: opts.color || 0x999991, roughness: 0.92 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x555e63, roughness: 0.7, metalness: 0.3 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 1.25, opts.roadWidth || 15), concrete);
  deck.position.y = deckY; group.add(deck);
  for (const z of [-7.3, 7.3]) {
    const girder = new THREE.Mesh(new THREE.BoxGeometry(span, 1.6, 0.55), steel);
    girder.position.set(0, deckY - 0.85, z); group.add(girder);
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(span, 1.1, 0.45), concrete);
    barrier.position.set(0, deckY + 1.0, z); group.add(barrier);
  }
  for (const x of [-(clear + 5), clear + 5]) {
    const lat = x;
    const base = groundY(s, lat) - origin.y;
    const h = Math.max(2.5, deckY - 1.2 - base);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, h, 6.5), concrete);
    pier.position.set(x, base + h / 2, 0); group.add(pier);
  }
  if (name) {
    for (const face of [-1, 1]) {
      const board = textBoard([name], 6.2, 1.65, '#0d6b3f', '#ffffff');
      board.position.set(-5, deckY - 1.5, face * 7.7);
      if (face < 0) board.rotation.y = Math.PI;
      group.add(board); registry.signs.push({ userData: { board } });
    }
  }
  group.position.copy(origin); group.rotation.y = headingAt(s); group.userData.midwestOverpass = true;
  group.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(group);
}

export function overpassGrid(scene, registry, crossings, opts = {}) {
  for (const [s, name] of crossings) overpass(scene, registry, s, name, opts);
}

// Frequent unnamed local-road bridges, batched into four instanced meshes.
// Midwest uses a 5× physical distance scale, so a logical interval of ~160
// produces the roughly 0.5-mile urban street rhythm the foreground needs.
export function minorOverpassGrid(scene, s0, s1, step = 170, seed = 1) {
  const rand = seeded(seed);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const decks = [], rails = [], piers = [];
  for (let s = s0 + step * 0.45; s < s1; s += step * (0.84 + rand() * 0.28)) {
    const clear = roadClearAt(s), span = (clear + 20) * 2;
    const h = headingAt(s), tangent = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
    const center = posAt(s, 0, new THREE.Vector3()); center.y += 8.0;
    decks.push({ pos: center, rot: h, sx: span, sy: 1.2, sz: 12.5 });
    for (const z of [-6.3, 6.3]) {
      const p = center.clone().addScaledVector(tangent, z); p.y += 1.0;
      rails.push({ pos: p, rot: h, sx: span, sy: 1.0, sz: 0.45 });
    }
    for (const side of [-1, 1]) {
      const lat = side * (clear + 4.5);
      const p = posAt(s, lat, new THREE.Vector3());
      const base = groundY(s, lat), height = Math.max(2.5, center.y - 0.7 - base);
      p.y = base + height / 2;
      piers.push({ pos: p, rot: h, sx: 2.0, sy: height, sz: 5.5 });
    }
  }
  const concrete = new THREE.MeshStandardMaterial({ color: 0x96948d, roughness: 0.93 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x596166, roughness: 0.72, metalness: 0.25 });
  scatterInstanced(scene, unit, concrete, decks);
  scatterInstanced(scene, unit, concrete, rails);
  scatterInstanced(scene, unit, steel, piers);
}

export function wallAndTreeScreen(scene, s0, s1, seed, opts = {}) {
  buildNoiseWall(scene, s0, s1, {
    seed, height: opts.height || 5.2, margin: opts.margin || 4.8,
    step: opts.step || 11, gapChance: opts.gapChance ?? 0.12,
  });
  if (opts.trees !== false) buildTrees(scene, seed + 1, s0, s1, 14, 38, opts.treeWidth || 250, opts.treeCount || 85);
}

export function railCorridor(scene, s0, s1, lat, seed = 1) {
  groundStrip(scene, s0, s1, lat, 15, 0x4d4943, { lift: 0.05, step: 26 });
  for (const off of [-3.2, 3.2]) groundStrip(scene, s0, s1, lat + off, 0.22, 0xa9a7a0, { lift: 0.18, step: 18 });
  const rand = seeded(seed);
  const tieGeo = new THREE.BoxGeometry(8.5, 0.18, 0.32);
  const ties = [];
  for (let s = s0; s < s1; s += 20) {
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat) + 0.14;
    ties.push({ pos: p, rot: headingAt(s), sx: 0.92 + rand() * 0.1, sy: 1, sz: 1 });
  }
  scatterInstanced(scene, tieGeo, new THREE.MeshStandardMaterial({ color: 0x5a4635, roughness: 1 }), ties, { shadow: false });
}

export function tollArea(scene, registry, s, opts = {}) {
  const width = (pavedHalfAt(s) + 12) * 2;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(width, 1.1, 9),
    new THREE.MeshStandardMaterial({ color: 0x7d8589, roughness: 0.7, metalness: 0.25 }));
  const p = posAt(s, 0, new THREE.Vector3()); canopy.position.copy(p); canopy.position.y += 7.5;
  canopy.rotation.y = headingAt(s); scene.add(canopy);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 7.2, 0.7), canopy.material, 6);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) {
    const lat = -pavedHalfAt(s) + (i + 0.5) * (2 * pavedHalfAt(s) / 6);
    const q = posAt(s, lat, new THREE.Vector3()); q.y = groundY(s, lat) + 3.6;
    matrix.compose(q, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headingAt(s)), new THREE.Vector3(1, 1, 1));
    posts.setMatrixAt(i, matrix);
  }
  scene.add(posts);
  gantry(scene, registry, s - 420, [{ lat: 0, mesh: textBoard([
    opts.title || 'MARKHAM TOLL PLAZA', 'I-PASS · PAY ONLINE', 'KEEP MOVING',
  ], 14, 3.6, '#135f36', '#ffffff') }], 7.4);
  gantry(scene, registry, s + 260, [{ lat: 0, mesh: textBoard(['TOLL RECORDED', 'THANK YOU', ''], 11, 3.0, '#135f36', '#ffffff') }], 7.1);
}

// Visual two-lane directional connectors. The player road remains the route
// centerline, while companion decks show the reciprocal movements and make the
// I-80/94 ↔ I-65 handoff read as a full system interchange in both directions.
export function twoLaneConnector(scene, registry, s0, s1, opts = {}) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x272a2d, roughness: 0.96 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x60686c, roughness: 0.72, metalness: 0.28 });
  const mid = (s0 + s1) / 2;
  const spread = s => {
    const t = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
    return Math.sin(Math.PI * t) * (opts.spread || 42);
  };
  const rise = s => {
    const t = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
    return Math.sin(Math.PI * t) * (opts.rise || 10);
  };
  for (const side of [-1, 1]) {
    const deck = new THREE.Mesh(buildRibbon(
      s => side * (pavedHalfAt(s) + 5 + spread(s)),
      s => side * (pavedHalfAt(s) + 12.4 + spread(s)),
      s => rise(s), s => rise(s), 16, s0, s1,
    ), asphalt);
    deck.castShadow = true; scene.add(deck);
    const fascia = new THREE.Mesh(buildRibbon(
      s => side * (pavedHalfAt(s) + 4.6 + spread(s)),
      s => side * (pavedHalfAt(s) + 5.2 + spread(s)),
      s => rise(s) - 1.8, s => rise(s) + 0.2, 16, s0, s1,
    ), steel);
    scene.add(fascia);
  }
  gantry(scene, registry, mid - 750, [{ lat: 0, mesh: textBoard([
    'I-65 SOUTH · 2 LANES', 'INDIANAPOLIS', 'EXIT 11',
  ], 13, 3.5, '#0d6b3f', '#ffffff') }], 7.3);
  gantry(scene, registry, mid + 550, [{ lat: 0, mesh: textBoard([
    'I-80 / I-94', 'CHICAGO · DETROIT', '2 LANES',
  ], 13, 3.5, '#0d6b3f', '#ffffff') }], 7.3);
}
