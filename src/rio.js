import * as THREE from 'three';
import { Villagers } from './villagers.js';

// ---------------------------------------------------------------------------
// A present-day Rio de Janeiro morro, top to bottom. Up the hill: dense raw-brick
// and bare-concrete houses (mostly unfinished, only the odd painted façade),
// tangled becos and public staircases (escadarias), retaining walls, street
// lamps, water tanks and a web of wires, a floodlit quadra, botecos, an
// evangelical church, a school and a health post, murals and string lights —
// the winding estrada snaking up to a proper mirante at the crest, where the
// whole Cidade Maravilhosa opens up (bay, beach, Lagoa, Centro skyline, far
// favela-covered hills, Sugarloaf and a lit Cristo). At the foot: O ASFALTO —
// the walkable formal city, a paved avenue with lane lines, sidewalks and a
// live semáforo, mid-rise shopfront blocks, a praça and a bus terminal, with
// buses, cars, taxis and kombis actually running the route. Motos thread the
// morro; most people are on foot, and the place is packed with life.
// ---------------------------------------------------------------------------

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mat(c, r = 0.9, m = 0) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); }
function emis(c, i = 1) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.5 }); }

// Realistic morro palette: dominated by raw unrendered brick and bare grey/
// beige concrete (most houses are unfinished), with only the occasional faded
// painted façade — not a carnival of saturated colour.
const HOUSE_COLS = [
  0xa1583a, 0x9a5638, 0xac6042, 0x925032, 0x8f5030,               // raw brick (dominant)
  0xa15a3a, 0x975438,
  0x9a958c, 0x8f8a80, 0xa8a298, 0x847e74, 0x9c968c,                 // bare concrete / cement
  0xc7bda8, 0xd8cdb8, 0xbdb2a0,                                     // beige plaster
  0x8a9a94, 0x8a94a0, 0xc8b878, 0xc09088, 0x7a8a72,                 // a few faded painted façades
];

// Steep hill: high at the summit (negative z), dropping to the base (positive z)
// and, past the summit, falling away toward the city below.
function gh(x, z) {
  // the flat asfalto (formal city) at the foot of the morro — paved and level so
  // streets, sidewalks and bus lanes read true underfoot (no favela-hill bumps).
  if (z > 415) return 1.6 + Math.sin(x * 0.02) * 0.3;
  const t = Math.max(0, (400 - z) / 700);              // 0 at base → ~1 at summit
  let h = 2 + t * 78;
  if (z < -300) h = 80 - (-300 - z) * 0.95;            // back slope down to the city
  h += Math.sin(x * 0.03) * 3 + Math.cos(z * 0.04) * 2 + Math.sin((x + z) * 0.05) * 1.4;
  if (z > 380) h *= (415 - z) / 35;                    // ease the hill foot down to the flat asfalto
  return h;
}

// winding estrada up the morro
const ROAD = [[0, 380], [22, 320], [-26, 268], [40, 210], [-38, 156], [58, 100], [-58, 46], [70, -8], [-66, -66], [52, -128], [-40, -196], [14, -258], [0, -300]];

export function buildRio(scene) {
  const rnd = rng(2024);
  const lights = [];         // emissive materials to ramp up at night
  const lamps = [];          // point lights to ramp at night

  // Batched geometry: the whole favela is thousands of stacked boxes. Building
  // them as separate meshes tanks the framerate, so every floor / window / tank
  // is collected here and baked into a handful of InstancedMeshes (a few draw
  // calls for the entire hillside). No per-building shadow casting either.
  const UNIT = new THREE.Matrix4(), QID = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const floorMx = [], floorCol = [], winLitMx = [], winDarkMx = [], tankMx = [];
  function box(list, M, lx, ly, lz, sx, sy, sz, colList, color) {
    _p.set(lx, ly, lz); _s.set(sx, sy, sz);
    const local = new THREE.Matrix4().compose(_p, QID, _s);
    list.push(M.clone().multiply(local));
    if (colList) colList.push(color);
  }

  // --- ground (the hillside) ---
  const S = 1500, N = 140;
  const geo = new THREE.PlaneGeometry(S, S, N, N);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cDirt = new THREE.Color(0x8a7256), cRock = new THREE.Color(0x6a6258), cGreen = new THREE.Color(0x3f5a2f);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, gh(x, z));
    tmp.copy(z < -320 ? cGreen : Math.abs(x) > 320 ? cRock : cDirt).offsetHSL(0, 0, Math.sin(x * 0.2 + z * 0.25) * 0.03);
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  // --- the full carioca panorama far below (Cidade Maravilhosa backdrop): the
  //     bay and Atlantic, a long beach arc, the Lagoa, a dense Centro skyline,
  //     far hills carpeted in more favela (that light up at night), Sugarloaf
  //     with its cable car, Corcovado and a lit Cristo. Not walkable — the view. ---
  (function cityBelow() {
    const SEA = -260;
    // Guanabara Bay + Atlantic
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000), mat(0x1c5a86, 0.35, 0.25));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, SEA, -1700); scene.add(sea);
    // the Lagoa (Rodrigo de Freitas) — an inland lagoon closer in
    const lagoa = new THREE.Mesh(new THREE.CircleGeometry(280, 24), mat(0x246a92, 0.3, 0.2));
    lagoa.rotation.x = -Math.PI / 2; lagoa.position.set(-620, SEA + 2, -640); scene.add(lagoa);
    // a long crescent beach (Copacabana-style arc) with the black-and-white promenade
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(3000, 130), mat(0xdccfa0, 1));
    beach.rotation.x = -Math.PI / 2; beach.rotation.z = 0.06; beach.position.set(120, SEA + 5, -840); scene.add(beach);
    const promen = new THREE.Mesh(new THREE.PlaneGeometry(3000, 22), mat(0xbfb8a8, 1));
    promen.rotation.x = -Math.PI / 2; promen.rotation.z = 0.06; promen.position.set(120, SEA + 5.5, -778); scene.add(promen);

    // shared lit-window materials (ramp up after dark)
    const winMat = emis(0xffe6a0, 0.0); lights.push(winMat);
    const farFav = emis(0xffcf88, 0.0); lights.push(farFav);

    // dense Centro skyline — a deep field of towers, tallest at the core
    for (let i = 0; i < 280; i++) {
      const bx = -1500 + rnd() * 3000, spread = Math.abs(bx) / 1500;
      const bz = -700 - rnd() * 520 - spread * 200;
      const bh = (30 + rnd() * 170) * (1 - spread * 0.45);
      const bw = 20 + rnd() * 30;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw + rnd() * 12), mat(0x6a7480, 0.6, 0.2));
      b.position.set(bx, SEA + bh / 2, bz); scene.add(b);
      if (rnd() < 0.75) { const w = new THREE.Mesh(new THREE.BoxGeometry(bw - 4, bh * 0.9, bw - 4), winMat); w.position.copy(b.position); scene.add(w); }
    }
    // far hills carpeted in more favela — thousands of tiny boxes, lights at night
    const favBox = mat(0xbaa892, 0.9);
    for (const [hx, hz, hw, hh] of [[-1050, -1000, 700, 220], [900, -1150, 760, 260], [-1500, -1250, 640, 280], [1500, -1050, 620, 220]]) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(hw / 1.6, hh, 6), mat(0x35533f, 1));
      hill.position.set(hx, SEA + hh / 2, hz); scene.add(hill);
      const shackMx = [], litMx = [];
      for (let i = 0; i < 260; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * hw / 2.4;
        const sx = hx + Math.cos(a) * r, sz = hz + Math.sin(a) * r * 0.6;
        const sy = SEA + Math.max(0, hh / 2 - (r / (hw / 2.4)) * hh / 2) + 3;
        const M = new THREE.Matrix4().compose(_p.set(sx, sy, sz), QID, _s.set(4 + rnd() * 3, 4 + rnd() * 4, 4 + rnd() * 3));
        shackMx.push(M.clone());
        if (rnd() < 0.5) litMx.push(M.clone());
      }
      const unit = new THREE.BoxGeometry(1, 1, 1);
      const shacks = new THREE.InstancedMesh(unit, favBox, shackMx.length); shackMx.forEach((m, i) => shacks.setMatrixAt(i, m)); scene.add(shacks);
      const lit = new THREE.InstancedMesh(unit, farFav, litMx.length || 1); litMx.forEach((m, i) => lit.setMatrixAt(i, m)); scene.add(lit);
    }

    // Sugarloaf (Pão de Açúcar) — twin granite domes with the cable car
    const rock = mat(0x5a5148, 1);
    const morro = new THREE.Mesh(new THREE.SphereGeometry(90, 12, 10), rock); morro.scale.set(1, 1.7, 1); morro.position.set(760, SEA + 120, -900); scene.add(morro);
    const urca = new THREE.Mesh(new THREE.SphereGeometry(60, 12, 10), rock); urca.scale.set(1, 1.5, 1); urca.position.set(640, SEA + 78, -840); scene.add(urca);
    const cableM = mat(0x222); const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 150, 4), cableM);
    cable.position.set(700, SEA + 205, -870); cable.rotation.z = Math.PI / 2 + 0.15; scene.add(cable);
    const gondola = emis(0xffe6a0, 0); lights.push(gondola);
    const car = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 8), gondola); car.position.set(695, SEA + 200, -868); scene.add(car);

    // Corcovado peak + a lit Cristo Redentor with arms outstretched
    const gm = mat(0x2f4a3a, 1);
    for (const [px, pz, pr, ph] of [[-760, -1250, 200, 380], [460, -1350, 240, 340], [1180, -1200, 180, 300], [-1320, -1400, 260, 420]]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(pr, ph, 7), gm); c.position.set(px, SEA + ph / 2, pz); scene.add(c);
    }
    const christ = new THREE.Group();
    const cristoM = emis(0xe8e2d4, 0); lights.push(cristoM);
    const ped = new THREE.Mesh(new THREE.BoxGeometry(10, 12, 10), mat(0x8a8378)); ped.position.y = 6; christ.add(ped);
    const bodyC = new THREE.Mesh(new THREE.BoxGeometry(3.4, 26, 3.4), cristoM); bodyC.position.y = 25; christ.add(bodyC);
    const head = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), cristoM); head.position.y = 40; christ.add(head);
    const arms = new THREE.Mesh(new THREE.BoxGeometry(26, 3.4, 3.4), cristoM); arms.position.y = 33; christ.add(arms);
    christ.position.set(460, SEA + 340, -1350); christ.scale.setScalar(1.5); scene.add(christ);
  })();

  // --- the estrada: an unmarked concrete lane winding up (no lane lines) ---
  const roadMat = mat(0x8a8782, 1);
  for (let i = 0; i < ROAD.length - 1; i++) {
    const [x0, z0] = ROAD[i], [x1, z1] = ROAD[i + 1];
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.3, len + 2), roadMat);
    seg.position.set(mx, gh(mx, mz) + 0.16, mz); seg.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    seg.receiveShadow = true; scene.add(seg);
  }

  // --- prop builders ---
  // a favela house/block: several stacked painted/brick boxes with a laje roof,
  // tank and lit windows — appended to the instance pools (no live mesh yet).
  const tmpCol = new THREE.Color();
  function house(x, z, minF = 2, maxF = 5, wide = false) {
    const gy = gh(x, z), rotY = rnd() * Math.PI;
    _p.set(x, gy, z);
    const M = new THREE.Matrix4().compose(_p, QID.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), _s.set(1, 1, 1));
    QID.identity();
    const w = (wide ? 5 : 3.4) + rnd() * (wide ? 5 : 3.2), d = (wide ? 5 : 3.4) + rnd() * (wide ? 5 : 3.2);
    const floors = minF + (rnd() * (maxF - minF + 1) | 0);
    let y = 0;
    for (let f = 0; f < floors; f++) {
      const fh = 2.5 + rnd() * 0.8;
      tmpCol.setHex(HOUSE_COLS[(rnd() * HOUSE_COLS.length) | 0]).offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
      box(floorMx, M, 0, y + fh / 2, 0, w, fh, d, floorCol, tmpCol.clone());
      for (let wi = 0; wi < 2; wi++) {
        box(rnd() < 0.5 ? winLitMx : winDarkMx, M, -w / 2 + 0.7 + wi * (w - 1.4), y + fh * 0.55, d / 2 + 0.02, 0.7, 0.9, 0.1);
      }
      y += fh;
    }
    if (rnd() < 0.7) box(tankMx, M, (rnd() - 0.5) * w * 0.6, y + 0.45, (rnd() - 0.5) * d * 0.6, 1, 1, 1);
  }
  // bake the collected boxes into instanced meshes (call once, after layout)
  function bakeHouses() {
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const floors = new THREE.InstancedMesh(unit, mat(0xffffff, 1), floorMx.length);
    floors.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(floorMx.length * 3), 3);
    floorMx.forEach((m, i) => { floors.setMatrixAt(i, m); floors.setColorAt(i, floorCol[i]); });
    floors.instanceColor.needsUpdate = true; floors.receiveShadow = true; scene.add(floors);
    const litM = emis(0xffe0a0, 0.0); lights.push(litM);
    const winLit = new THREE.InstancedMesh(unit, litM, winLitMx.length || 1);
    winLitMx.forEach((m, i) => winLit.setMatrixAt(i, m)); scene.add(winLit);
    const winDark = new THREE.InstancedMesh(unit, mat(0x20242a, 0.4), winDarkMx.length || 1);
    winDarkMx.forEach((m, i) => winDark.setMatrixAt(i, m)); scene.add(winDark);
    const tankGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.9, 8);
    const tanks = new THREE.InstancedMesh(tankGeo, mat(0x2a6ac8), tankMx.length || 1);
    tankMx.forEach((m, i) => tanks.setMatrixAt(i, m)); scene.add(tanks);
  }

  // string lights strung between two points (glowing bulbs on a catenary)
  function stringLights(x0, z0, x1, z1, yh = 4.5) {
    const n = 8; const y0 = gh(x0, z0) + yh, y1 = gh(x1, z1) + yh;
    const m = emis(0xffdca0, 0.0); lights.push(m);
    for (let i = 0; i <= n; i++) {
      const t = i / n; const sag = Math.sin(t * Math.PI) * 1.2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), m);
      b.position.set(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag, z0 + (z1 - z0) * t); scene.add(b);
    }
  }
  // a wire between two poles (gambiarra)
  function wire(x0, z0, x1, z1) {
    const g = new THREE.Group();
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 4), mat(0x111));
    w.position.set((x0 + x1) / 2, gh(x0, z0) + 4.6, (z0 + z1) / 2); w.rotation.z = Math.PI / 2; w.rotation.y = Math.atan2(dx, dz); scene.add(w);
  }
  function pole(x, z) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 6, 6), mat(0x555)); po.position.set(x, gh(x, z) + 3, z); po.castShadow = true; scene.add(po); return po; }

  // the soccer cage (quadra): concrete court, chain-link, goals, floodlights
  function quadra(x, z) {
    const g = new THREE.Group(); const gy = gh(x, z);
    const court = new THREE.Mesh(new THREE.BoxGeometry(26, 0.3, 16), mat(0x2a6a8a, 1)); court.position.y = 0.15; g.add(court);
    const paint = new THREE.Mesh(new THREE.BoxGeometry(24, 0.32, 14), mat(0x2f8a5a, 1)); paint.position.y = 0.17; g.add(paint);
    // fence
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.28, roughness: 0.8 });
    for (const [w, d, px, pz] of [[26, 0.1, 0, 8], [26, 0.1, 0, -8], [0.1, 16, 13, 0], [0.1, 16, -13, 0]]) { const fw = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), fenceMat); fw.position.set(px, 2.5, pz); g.add(fw); }
    // goals
    for (const gx of [-11.5, 11.5]) { const goal = new THREE.Group(); for (const s of [-1.5, 1.5]) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.4, 0.15), mat(0xffffff)); po.position.set(0, 1.2, s); goal.add(po); } const cross = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3), mat(0xffffff)); cross.position.y = 2.4; goal.add(cross); goal.position.set(gx, 0, 0); g.add(goal); }
    // floodlights
    for (const [px, pz] of [[-13, 8], [13, 8], [-13, -8], [13, -8]]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 9, 6), mat(0x555)); po.position.set(px, 4.5, pz); g.add(po); const lampM = emis(0xfff4d0, 0.0); lights.push(lampM); const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.6), lampM); lamp.position.set(px, 9, pz); g.add(lamp); }
    g.position.set(x, gy, z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
    const fl = new THREE.PointLight(0xfff0d0, 0, 40); fl.position.set(x, gy + 10, z); scene.add(fl); lamps.push(fl);
  }

  // small building with a lit sign (boteco / mercadinho / igreja / baile)
  function shop(x, z, w, h, d, color, sign, signCol = 0xe0121a) {
    const g = new THREE.Group(); const gy = gh(x, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, 1)); body.position.y = h / 2; g.add(body);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.2, 1.6), mat(0xf2c53d, 1)); awn.position.set(0, h * 0.75, d / 2 + 0.7); g.add(awn);
    if (sign) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d');
      c.fillStyle = '#' + signCol.toString(16).padStart(6, '0'); c.fillRect(0, 0, 256, 64);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 34px Arial'; c.fillText(sign, 128, 44);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.0, side: THREE.DoubleSide }); lights.push(m);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 1.1), m); s.position.set(0, h + 0.7, d / 2 + 0.1); g.add(s);
    }
    g.position.set(x, gy, z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g;
  }
  // graffiti / mural wall
  const GRAFFITI = [0xe0121a, 0x2a86c8, 0x2fae6a, 0xf2c53d, 0xef7d3a, 0x18b0a8, 0x8a5ac8, 0xe83a8a, 0xffffff, 0x111111];
  function mural(x, z, rot) {
    const c = GRAFFITI[(rnd() * GRAFFITI.length) | 0];
    const w = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 0.4), mat(c, 1));
    for (let i = 0; i < 4; i++) { const blob = new THREE.Mesh(new THREE.CircleGeometry(0.4 + rnd() * 0.6, 8), mat(GRAFFITI[(rnd() * GRAFFITI.length) | 0], 1)); blob.position.set(-2 + rnd() * 4, 0.5 + rnd() * 2, 0.22); w.add(blob); }
    w.position.set(x, gh(x, z) + 1.75, z); w.rotation.y = rot; w.castShadow = true; scene.add(w);
  }
  function flagPole(x, z, colors) {
    const po = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), mat(0x888)); po.position.set(x, gh(x, z) + 3, z); scene.add(po);
    const cv = document.createElement('canvas'); cv.width = 60; cv.height = 40; const c = cv.getContext('2d');
    if (colors === 'br') { c.fillStyle = '#009c3b'; c.fillRect(0, 0, 60, 40); c.fillStyle = '#ffdf00'; c.beginPath(); c.moveTo(30, 4); c.lineTo(56, 20); c.lineTo(30, 36); c.lineTo(4, 20); c.fill(); c.fillStyle = '#002776'; c.beginPath(); c.arc(30, 20, 8, 0, 7); c.fill(); }
    else { c.fillStyle = '#e0121a'; c.fillRect(0, 0, 60, 20); c.fillStyle = '#111'; c.fillRect(0, 20, 60, 20); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide })); fl.position.set(x + 1.3, gh(x, z) + 5, z); scene.add(fl);
  }

  // distance from a point to the winding estrada (for the gully walls)
  function distToRoad(x, z) {
    let m = 1e9;
    for (let i = 0; i < ROAD.length - 1; i++) {
      const [x0, z0] = ROAD[i], [x1, z1] = ROAD[i + 1];
      const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
      let t = ((x - x0) * dx + (z - z0) * dz) / L2; t = Math.max(0, Math.min(1, t));
      const dd = Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t));
      if (dd < m) m = dd;
    }
    return m;
  }
  const nearQuadra = (x, z) => Math.abs(x - 120) < 15 && Math.abs(z - 40) < 11;

  // tropical vegetation (coconut palms, big Atlantic-forest canopies, banana)
  function tropical(x, z, kind) {
    const g = new THREE.Group(); const gy = gh(x, z);
    if (kind === 'palm') {
      const s = 0.9 + rnd() * 0.8;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.24 * s, 8 * s, 6), mat(0x7a6242)); tr.position.y = 4 * s; tr.rotation.z = (rnd() - 0.5) * 0.25; g.add(tr);
      for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 3.4 * s), mat(0x1f7a34)); f.position.y = 8 * s; f.rotation.y = i * 0.8; f.rotation.z = -0.5 - rnd() * 0.25; f.geometry.translate(0, 0, 1.7 * s); g.add(f); }
    } else if (kind === 'banana') {
      for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 2.4), mat(0x2f8a3a)); l.position.set((rnd() - 0.5), 2 + rnd(), (rnd() - 0.5)); l.rotation.set(-0.6, i * 1.2, 0); g.add(l); }
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.2, 6), mat(0x4a7a3a)); tr.position.y = 1.1; g.add(tr);
    } else {
      const s = 1.0 + rnd() * 1.1;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.5 * s, 4 * s, 7), mat(0x4a3826)); tr.position.y = 2 * s; g.add(tr);
      for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry((2.4 + rnd() * 1.6) * s, 8, 6), mat([0x1f6a2a, 0x2a7a34, 0x3a8a3a][(rnd() * 3) | 0])); c.position.set((rnd() - 0.5) * 4 * s, (4.5 + rnd() * 1.5) * s, (rnd() - 0.5) * 4 * s); g.add(c); }
    }
    g.position.set(x, gy, z); scene.add(g);
  }

  // ---- shared infrastructure helpers (streetlights, stairs, walls, benches) ----
  // a concrete street lamp (poste) — glows after dark, ramped via `lights`
  // NB: no real PointLight per lamp — dozens of forward-rendered point lights
  // tanks the framerate. The emissive lamp head (ramped at night) reads fine.
  function streetlight(x, z, h = 7) {
    const gy = gh(x, z);
    const po = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, h, 6), mat(0x777)); po.position.set(x, gy + h / 2, z); po.castShadow = true; scene.add(po);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), mat(0x777)); arm.position.set(x + 0.6, gy + h - 0.1, z); scene.add(arm);
    const lm = emis(0xffe0a0, 0); lights.push(lm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), lm); lamp.position.set(x + 1.2, gy + h - 0.2, z); scene.add(lamp);
  }
  // public staircase up the slope (escadaria) — the favela's real pedestrian spine
  function escadaria(x0, z0, x1, z1, wide = 2.4) {
    const steps = Math.max(6, Math.floor(Math.hypot(x1 - x0, z1 - z0) / 1.1));
    const hd = Math.atan2(x1 - x0, z1 - z0);
    const stepM = mat(0xbdb6ab, 1);
    for (let i = 0; i < steps; i++) {
      const t = i / steps, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      const st = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.35, 1.2), stepM);
      st.position.set(px, gh(px, pz) + 0.2, pz); st.rotation.y = hd; st.receiveShadow = true; scene.add(st);
    }
    // a painted handrail down one side
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, Math.hypot(x1 - x0, z1 - z0)), mat(0xf2c53d, 1));
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    rail.position.set(mx + Math.cos(hd) * wide / 2, (gh(x0, z0) + gh(x1, z1)) / 2 + 1, mz - Math.sin(hd) * wide / 2);
    rail.rotation.y = hd; rail.rotation.x = Math.atan2(gh(x1, z1) - gh(x0, z0), Math.hypot(x1 - x0, z1 - z0)); scene.add(rail);
  }
  // retaining wall (muro de arrimo) holding the cut slope — infra you always see
  function retainWall(x, z, len, rot, h = 3) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.6), mat(0x9a938a, 1));
    w.position.set(x, gh(x, z) + h / 2 - 0.5, z); w.rotation.y = rot; w.castShadow = true; w.receiveShadow = true; scene.add(w);
  }
  function bench(x, z, rot = 0) {
    const g = new THREE.Group(); const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 0.6), mat(0x6a5a44)); seat.position.y = 0.5; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.12), mat(0x6a5a44)); back.position.set(0, 0.8, -0.24); g.add(back);
    for (const sx of [-0.8, 0.8]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.5), mat(0x333)); lg.position.set(sx, 0.25, 0); g.add(lg); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // a scruffy street dog (vira-lata) — life on the corner
  function dog(x, z) {
    const g = new THREE.Group(); const c = mat([0xb5893a, 0x8a6a44, 0x3a2a1a, 0xd8c0a0][(rnd() * 4) | 0]);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.35), c); body.position.y = 0.5; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 0.3), c); head.position.set(0.55, 0.6, 0); g.add(head);
    for (const [lx, lz] of [[0.35, 0.12], [0.35, -0.12], [-0.35, 0.12], [-0.35, -0.12]]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), c); lg.position.set(lx, 0.2, lz); g.add(lg); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.08), c); tail.position.set(-0.6, 0.6, 0); tail.rotation.z = 0.6; g.add(tail);
    g.position.set(x, gh(x, z), z); g.rotation.y = rnd() * Math.PI * 2; scene.add(g);
  }
  // a churrasco / laje hangout: a grill with smoke, a cooler, a plastic table
  function churrasco(x, z) {
    const g = new THREE.Group(); const gy = gh(x, z);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.6), mat(0x333)); grill.position.y = 0.9; g.add(grill);
    for (const sx of [-0.5, 0.5]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), mat(0x222)); lg.position.set(sx, 0.45, 0); g.add(lg); }
    const coals = emis(0xff5a1a, 0.6); const cb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.5), coals); cb.position.y = 1.0; g.add(cb);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 12), mat(0xf2f2ea)); table.position.set(2, 0.75, 0.5); g.add(table);
    const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 6), mat(0xf2f2ea)); tl.position.set(2, 0.37, 0.5); g.add(tl);
    for (let i = 0; i < 3; i++) { const sm = new THREE.Mesh(new THREE.SphereGeometry(0.3 + i * 0.15, 6, 5), new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.18 })); sm.position.set(0, 1.4 + i * 0.6, 0); g.add(sm); }
    g.position.set(x, gy, z); scene.add(g);
  }

  // ---- the asfalto: the walkable formal city at the foot of the morro ----
  // A real neighbourhood — a paved avenue with lane lines and sidewalks, mid-rise
  // apartment/commercial blocks with lit shopfronts, a praça, a bus terminal, a
  // traffic light and street furniture. This is where the buses and cars run.
  const cityWin = emis(0xffe6a0, 0);           // lit apartment/office windows
  lights.push(cityWin);
  function cityBuilding(x, z, w, d, floors, color) {
    const g = new THREE.Group(); const gy = gh(x, z), fh = 3.2, H = floors * fh;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mat(color, 0.85)); body.position.y = H / 2; g.add(body);
    // window bands on the long faces
    for (const face of [1, -1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, H - fh, 0.12), cityWin);
      band.position.set(0, H / 2 + fh / 2, face * (d / 2 + 0.02)); g.add(band);
    }
    // ground-floor shopfront (glass + awning)
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, fh * 0.8, 0.1), mat(0x1a2430, 0.3)); glass.position.set(0, fh * 0.45, d / 2 + 0.05); g.add(glass);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.15, 1.2), mat([0xe0121a, 0x1a7a3f, 0x1a3a8c, 0xf2c53d][(rnd() * 4) | 0], 1)); awn.position.set(0, fh * 0.9, d / 2 + 0.7); g.add(awn);
    // rooftop water tanks + a stair box
    if (rnd() < 0.8) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 8), mat(0x2a6ac8)); t.position.set((rnd() - 0.5) * w * 0.5, H + 0.6, (rnd() - 0.5) * d * 0.5); g.add(t); }
    // no shadow casting — the downtown bulk is background; keeps the shadow pass cheap
    g.position.set(x, gy, z); scene.add(g); return g;
  }
  function busShelter(x, z, rot) {
    const g = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.15, 1.8), mat(0x2a3a6a, 0.6)); roof.position.y = 2.6; g.add(roof);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 0.1), mat(0x88a0c0, 0.3, 0.2)); back.position.set(0, 1.5, -0.8); g.add(back);
    for (const sx of [-2.3, 2.3]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), mat(0x555)); po.position.set(sx, 1.3, 0.7); g.add(po); }
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 0.5), mat(0x444)); b.position.set(0, 0.5, -0.4); g.add(b);
    const signM = emis(0xffffff, 0); lights.push(signM);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.9), signM); sign.position.set(2.6, 2.0, 0.7); g.add(sign);
    g.position.set(x, gh(x, z), z); g.rotation.y = rot; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // an avenue traffic light (semáforo) — real red/amber/green timing, tracked here
  const semaforos = [];
  function semaforo(x, z, rot, offset) {
    const g = new THREE.Group();
    const po = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6, 6), mat(0x333)); po.position.y = 3; g.add(po);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3), mat(0x333)); arm.position.set(0, 5.6, 1.5); g.add(arm);
    const head = new THREE.Group(); head.position.set(0, 5.6, 3);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.3), mat(0x111)); head.add(box);
    const red = emis(0xff2a1a, 0), amber = emis(0xffb020, 0), green = emis(0x2aff5a, 0);
    for (const [m, y] of [[red, 0.5], [amber, 0], [green, -0.5]]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m); l.position.set(0, y, 0.16); head.add(l); }
    g.add(head); g.position.set(x, gh(x, z), z); g.rotation.y = rot; scene.add(g);
    semaforos.push({ red, amber, green, offset });
  }
  function sigState(t, offset) { const ph = (t + offset) % 12; return ph < 6 ? 'green' : ph < 8 ? 'amber' : 'red'; }

  // --- lay out the favela: mid-rise buildings packed wall-to-wall up the hill,
  //     leaving only the narrow estrada and the odd beco — a real morro. Dense
  //     grid (now batched, so density is basically free) ---
  for (let gx = -320; gx <= 320; gx += 10) for (let gz = -310; gz <= 410; gz += 10) {
    const x = gx + (rnd() - 0.5) * 8, z = gz + (rnd() - 0.5) * 8;
    const dr = distToRoad(x, z);
    if (dr < 3.2 || nearQuadra(x, z)) continue;      // keep the lane + the cage clear
    if (rnd() < 0.07) continue;                        // occasional gap / beco
    const wide = rnd() < 0.16;                         // some larger apartment blocks
    house(x, z, wide ? 3 : 2, wide ? 7 : 5, wide);
  }
  // gully walls: taller blocks lining the estrada so the road runs in a canyon
  for (let i = 0; i < ROAD.length - 1; i++) {
    const [x0, z0] = ROAD[i], [x1, z1] = ROAD[i + 1];
    const steps = Math.max(2, Math.floor(Math.hypot(x1 - x0, z1 - z0) / 6));
    const hd = Math.atan2(x1 - x0, z1 - z0), nx = Math.cos(hd), nz = -Math.sin(hd);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      for (const side of [-1, 1]) {
        if (rnd() < 0.14) continue;
        const off = 4.2 + rnd() * 2;
        const bx = px + nx * side * off, bz = pz + nz * side * off;
        if (nearQuadra(bx, bz)) continue;
        house(bx, bz, 3, 7, rnd() < 0.3);
      }
    }
  }
  bakeHouses();
  // heavy tropical forest woven through and around the buildings
  for (let i = 0; i < 460; i++) {
    const x = -350 + rnd() * 700, z = -330 + rnd() * 760;
    if (distToRoad(x, z) < 3 || nearQuadra(x, z)) continue;
    const r = rnd();
    tropical(x, z, r < 0.4 ? 'palm' : r < 0.6 ? 'banana' : 'leafy');
  }

  quadra(120, 40);
  shop(-30, 90, 6, 3, 5, 0x2fae6a, 'BAR DO ZÉ');                     // boteco
  shop(-110, 20, 7, 3.2, 5, 0xf2c53d, 'MERCADINHO', 0x1a7a3f);
  shop(90, -40, 8, 5, 6, 0xffffff, 'IGREJA · DEUS É FIEL', 0x1a3a8c); // evangelical church
  const igrejaCross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3), emis(0xfff0d0, 0)); igrejaCross.position.set(90, gh(90, -40) + 6.5, -40); scene.add(igrejaCross); lights.push(igrejaCross.material);
  shop(60, -120, 6, 3, 5, 0x8a5ac8, 'BAILE FUNK', 0xe83a8a);
  // paredão (wall of speakers) at the baile
  for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1), mat(0x111)); sp.position.set(56 + (i % 3) * 1.6, gh(60, -116) + 0.7 + Math.floor(i / 3) * 1.6, -116); sp.castShadow = true; scene.add(sp); }
  shop(-20, 150, 5, 2.6, 4, 0xef7d3a, 'MOTO-TAXI');

  // wires + string lights + poles woven across the praça and becos
  const poles = [[0, 200], [-30, 90], [90, -40], [120, 40], [-110, 20], [60, -120], [-140, -60], [40, 160]];
  for (const [px, pz] of poles) pole(px, pz);
  for (let i = 0; i < poles.length - 1; i++) { wire(poles[i][0], poles[i][1], poles[i + 1][0], poles[i + 1][1]); }
  stringLights(-30, 90, 40, 60); stringLights(40, 60, 120, 40); stringLights(-30, 90, -110, 20); stringLights(0, 200, 40, 160);
  for (let i = 0; i < 8; i++) mural(-200 + rnd() * 400, -200 + rnd() * 400, rnd() * Math.PI);
  flagPole(20, 190, 'br'); flagPole(-40, 80, 'fla'); flagPole(100, -30, 'fla');

  // --- favela infrastructure: it's poor, not without a city. Public staircases,
  //     street lamps down the estrada, retaining walls, a school, a health post,
  //     a water tower — the everyday hardware of the morro. ---
  // street lamps down every switchback of the estrada
  for (let i = 0; i < ROAD.length - 1; i += 1) {
    const [x0, z0] = ROAD[i], [x1, z1] = ROAD[i + 1];
    const hd = Math.atan2(x1 - x0, z1 - z0), nx = Math.cos(hd), nz = -Math.sin(hd);
    const side = (i % 2) ? 1 : -1;
    streetlight((x0 + x1) / 2 + nx * side * 4, (z0 + z1) / 2 + nz * side * 4);
  }
  // public staircases (escadarias) climbing between the switchbacks
  escadaria(-58, 46, -66, -66); escadaria(70, -8, 52, -128); escadaria(22, 320, 40, 210);
  escadaria(-38, 156, -58, 46, 2.0); escadaria(58, 100, 70, -8, 2.0); escadaria(-40, -196, 14, -258, 2.0);
  // retaining walls holding the cut slope along the road
  retainWall(-90, 250, 60, 0.5); retainWall(90, 120, 70, -0.4); retainWall(-120, 10, 60, 0.3); retainWall(60, -180, 50, 0.6, 4);
  // a state school (escola municipal) and a health post (UPA) — real services
  shop(-90, 130, 12, 6, 8, 0xf2c53d, 'ESCOLA MUNICIPAL', 0x1a3a8c);
  shop(130, 100, 10, 5, 7, 0xffffff, 'UPA · SAÚDE', 0xe0121a);
  // a community water tower feeding the tanks
  (function waterTower() {
    const gy = gh(-160, 120), g = new THREE.Group();
    for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 10, 6), mat(0x777)); lg.position.set(sx, 5, sz); g.add(lg); }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.4, 12), mat(0x2a6ac8)); tank.position.y = 11.7; g.add(tank);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.2, 12), mat(0x1a4a8c)); cap.position.y = 14; g.add(cap);
    g.position.set(-160, gy, 120); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  })();
  // laje churrascos + street dogs scattered through the morro
  churrasco(-46, 70); churrasco(30, -100); churrasco(-70, -150); churrasco(110, 20);
  for (const [dx, dz] of [[-28, 96], [44, 60], [-115, 28], [66, -118], [0, 205], [-140, -55], [95, -34]]) dog(dx, dz);

  // === the mirante: a proper lookout deck at the crest where the estrada tops
  //     out — a paved terrace with a low wall, coin telescopes, benches, string
  //     lights and a sign. Walk up here and the whole city opens up below. ===
  (function mirante() {
    const MZ = -298, gy = gh(0, MZ), g = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(46, 0.4, 14), mat(0xbdb6ab, 1)); deck.position.y = 0.2; deck.receiveShadow = true; g.add(deck);
    // low parapet wall facing the view (negative z)
    const wall = new THREE.Mesh(new THREE.BoxGeometry(46, 1.1, 0.5), mat(0xd8d2c4, 1)); wall.position.set(0, 0.75, -6.8); g.add(wall);
    // metal railing posts along the parapet
    for (let x = -22; x <= 22; x += 2.2) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), mat(0x888)); po.position.set(x, 1.35, -6.8); g.add(po); }
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(46, 0.1, 0.1), mat(0x888)); railTop.position.set(0, 1.9, -6.8); g.add(railTop);
    // coin telescopes pointed at the bay
    for (const tx of [-14, 0, 14]) { const tg = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.3, 6), mat(0x2a5a7a)); post.position.y = 0.65; tg.add(post); const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), mat(0x1a3a5a)); scope.position.set(0, 1.4, -0.2); scope.rotation.x = 1.2; tg.add(scope); tg.position.set(tx, 0, -6); g.add(tg); }
    // benches for the view + a lit sign
    g.position.set(0, gy, MZ); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
    bench(-8, MZ + 3, 0); bench(8, MZ + 3, 0);
    streetlight(-20, MZ + 5, 7); streetlight(20, MZ + 5, 7);
    stringLights(-20, MZ + 5, 20, MZ + 5, 4);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48; const c = cv.getContext('2d');
    c.fillStyle = '#0a4a6a'; c.fillRect(0, 0, 256, 48); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 26px Arial'; c.fillText('MIRANTE · CIDADE MARAVILHOSA', 128, 32);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sm = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, side: THREE.DoubleSide }); lights.push(sm);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.9), sm); sign.position.set(0, gy + 3.4, MZ + 6.9); scene.add(sign);
  })();

  // === O ASFALTO — the walkable formal city at the foot of the morro ===
  (function asfalto() {
    const AVZ = 450;                               // the avenue runs along X here
    const asphalt = mat(0x2c2c30, 1), walk = mat(0x9a958c, 1);
    // the estrada spills down onto the avenue (a paved connector + crosswalk)
    const conn = new THREE.Mesh(new THREE.BoxGeometry(9, 0.3, 80), asphalt);
    conn.position.set(0, gh(0, 410) + 0.16, 410); conn.receiveShadow = true; scene.add(conn);
    // the avenue itself: two carriageways, wide, with sidewalks either side
    const av = new THREE.Mesh(new THREE.BoxGeometry(1160, 0.3, 22), asphalt);
    av.position.set(0, gh(0, AVZ) + 0.15, AVZ); av.receiveShadow = true; scene.add(av);
    for (const off of [-13.5, 13.5]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(1160, 0.4, 6), walk); sw.position.set(0, gh(0, AVZ) + 0.2, AVZ + off); sw.receiveShadow = true; scene.add(sw); }
    // centre double-yellow + dashed lanes
    const yl = emis(0xf2c53d, 0.15);
    for (let x = -560; x < 560; x += 14) { const d = new THREE.Mesh(new THREE.BoxGeometry(7, 0.02, 0.4), mat(0xf2f2ea, 1)); d.position.set(x, gh(x, AVZ) + 0.32, AVZ); scene.add(d); }
    for (const cy of [-0.7, 0.7]) { const cl = new THREE.Mesh(new THREE.BoxGeometry(1160, 0.02, 0.35), yl); cl.position.set(0, gh(0, AVZ) + 0.32, AVZ + cy); scene.add(cl); }
    // zebra crossing where the estrada meets the avenue
    for (let i = -5; i <= 5; i++) { const zb = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 22), mat(0xf2f2ea, 1)); zb.position.set(i * 1.6, gh(0, AVZ) + 0.33, AVZ); scene.add(zb); }
    // the semáforos guarding that junction (opposed phase)
    semaforo(9, AVZ - 13, -Math.PI / 2, 0); semaforo(-9, AVZ + 13, Math.PI / 2, 0); semaforo(0, 428, Math.PI, 6);

    // downtown blocks: a proper grid of mid-rise apartment/commercial buildings
    // filling BOTH sides of the avenue and sprawling back — no empty ground.
    const CITY_COLS = [0xd8d2c4, 0xc8b89a, 0xe0c0a0, 0xb0b8c0, 0xd0a890, 0xc0c8b8, 0xe8dcc4, 0xa8b0b8];
    for (let bx = -540; bx <= 540; bx += 60) {
      if (Math.abs(bx) < 22) continue;             // leave the estrada mouth clear
      for (const bz of [AVZ - 34, AVZ + 34, AVZ + 90, AVZ + 146, 575]) {
        if (bz > 605) continue;
        const w = 34 + rnd() * 16, d = 30 + rnd() * 14, fl = 4 + (rnd() * 9 | 0);
        cityBuilding(bx + (rnd() - 0.5) * 8, bz + (rnd() - 0.5) * 8, w, d, fl, CITY_COLS[(rnd() * CITY_COLS.length) | 0]);
      }
    }
    // named shopfronts along the avenue (the services a bairro actually has)
    shop(-200, AVZ - 20, 10, 5, 6, 0x1a7a3f, 'FARMÁCIA', 0x1a7a3f);
    shop(-90, AVZ - 20, 10, 5, 6, 0xe0121a, 'PADARIA', 0x8a2a1a);
    shop(70, AVZ - 20, 12, 5, 6, 0xf2c53d, 'SUPERMERCADO', 0x1a3a8c);
    shop(200, AVZ - 20, 10, 5, 6, 0x1a3a8c, 'BANCO', 0x1a3a8c);
    shop(320, AVZ - 20, 10, 5, 6, 0xef7d3a, 'LANCHONETE', 0xe0121a);
    shop(-320, AVZ - 20, 10, 5, 6, 0x8a5ac8, 'BOTEQUIM', 0xe83a8a);

    // a small praça with trees + benches on the near sidewalk
    for (let i = 0; i < 6; i++) { const px = -400 + i * 160; bench(px, AVZ - 11, Math.PI); bench(px + 60, AVZ - 11, Math.PI); }
    for (let i = 0; i < 22; i++) tropical(-540 + rnd() * 1080, AVZ - 12 + (rnd() < 0.5 ? 0 : 24), rnd() < 0.6 ? 'leafy' : 'palm');
    // street lamps marching down the avenue
    for (let x = -540; x <= 540; x += 60) { streetlight(x, AVZ - 12, 8); streetlight(x + 30, AVZ + 12, 8); }

    // the bus terminal (ponto final) at the west end + shelters along the avenue
    const term = new THREE.Mesh(new THREE.BoxGeometry(60, 0.3, 40), asphalt); term.position.set(-500, gh(-500, 500) + 0.16, 500); scene.add(term);
    shop(-500, 520, 20, 5, 8, 0x1a3a8c, 'TERMINAL · CENTRO', 0xf2c53d);
    busShelter(-260, AVZ - 12, 0); busShelter(120, AVZ + 12, Math.PI); busShelter(360, AVZ - 12, 0);
  })();

  // a couple of key point-lights (kept few for performance)
  for (const [lx, lz] of [[-30, 90], [0, 200], [60, -120]]) { const pl = new THREE.PointLight(0xffd8a0, 0, 34); pl.position.set(lx, gh(lx, lz) + 6, lz); scene.add(pl); lamps.push(pl); }

  // --- vehicles: motos/kombis/taxis up the estrada + buses & cars on the avenue ---
  const traffic = new FavelaTraffic(scene);
  const avenida = new AvenidaTraffic(scene);

  // parked motos at the stand
  for (let i = 0; i < 5; i++) { const m = makeMoto(); m.position.set(-24 + i * 1.6, gh(-20, 150), 150); m.rotation.y = 1.2; scene.add(m); }
  // parked buses waiting at the terminal
  for (let i = 0; i < 2; i++) { const b = makeBus(); b.position.set(-514 + i * 8, gh(-510, 500), 500); b.rotation.y = 0; scene.add(b); }

  // --- people of the morro (mostly on foot; the full demographic range) ---
  const villagers = new Villagers(scene, 'rio', gh, [
    { role: 'rio_kid', count: 22, x: 120, z: 40, spread: 14, idle: 0.3 },     // playing in the quadra
    { role: 'rio_m', count: 44, x: 0, z: 140, spread: 240 },                  // crowds everywhere
    { role: 'rio_f', count: 42, x: -20, z: 120, spread: 240 },
    { role: 'rio_kid', count: 28, x: 0, z: 120, spread: 250 },
    { role: 'rio_worker', count: 16, x: -60, z: -40, spread: 200 },           // construction on the slope
    { role: 'rio_elder', count: 16, x: -30, z: 90, spread: 160, idle: 0.6 },
    { role: 'rio_m', count: 18, x: -30, z: 90, spread: 46, idle: 0.5 },       // hanging at the boteco
    { role: 'rio_f', count: 16, x: -110, z: 20, spread: 46 },                 // at the mercadinho
    { role: 'rio_m', count: 16, x: 60, z: -120, spread: 34, idle: 0.5 },      // at the baile
    { role: 'rio_f', count: 12, x: 60, z: -120, spread: 34, idle: 0.4 },
    { role: 'rio_shady', count: 5, x: -140, z: -60, spread: 25, idle: 0.8 },  // olheiros on the corner
    { role: 'rio_shady', count: 3, x: 70, z: -8, spread: 20, idle: 0.85 },
    { role: 'rio_m', count: 8, x: -20, z: 150, spread: 20, idle: 0.4 },       // moto-taxi drivers
    { role: 'rio_elder', count: 10, x: 90, z: -40, spread: 34, idle: 0.6 },   // churchgoers
    { role: 'rio_m', count: 22, x: 0, z: 300, spread: 260 },                  // upper hill
    { role: 'rio_f', count: 20, x: 0, z: 300, spread: 260 },
    { role: 'rio_kid', count: 14, x: 0, z: 300, spread: 260 },
    { role: 'rio_elder', count: 8, x: 0, z: -298, spread: 20, idle: 0.7 },    // taking in the view at the mirante
    { role: 'rio_m', count: 6, x: 0, z: -298, spread: 20, idle: 0.5 },
    { role: 'rio_worker', count: 10, x: -120, z: 200, spread: 120 },          // pedreiros on the lower slope
    // --- the asfalto below: commuters, shoppers, vendors spread along the
    //     avenue (clusters spaced in x; spread kept tight so nobody wanders off
    //     the sidewalks up the hill or onto the empty ground past downtown) ---
    { role: 'rio_m', count: 10, x: -400, z: 440, spread: 60 },
    { role: 'rio_f', count: 9, x: -300, z: 440, spread: 60 },
    { role: 'rio_m', count: 10, x: -150, z: 440, spread: 60 },
    { role: 'rio_f', count: 9, x: 0, z: 440, spread: 60 },
    { role: 'rio_m', count: 10, x: 200, z: 440, spread: 60 },
    { role: 'rio_f', count: 9, x: 380, z: 440, spread: 60 },
    { role: 'rio_elder', count: 10, x: -120, z: 440, spread: 80, idle: 0.5 },
    { role: 'rio_kid', count: 10, x: 120, z: 440, spread: 90 },
    { role: 'rio_worker', count: 8, x: -200, z: 480, spread: 70 },
    { role: 'rio_m', count: 16, x: -500, z: 512, spread: 26, idle: 0.4 },     // queue at the bus terminal
    { role: 'rio_f', count: 14, x: -500, z: 512, spread: 26, idle: 0.4 },
    { role: 'rio_f', count: 10, x: 70, z: 438, spread: 22, idle: 0.5 },       // shoppers at the supermercado
    { role: 'rio_m', count: 8, x: -260, z: 438, spread: 16, idle: 0.6 },      // waiting at the bus shelter
    { role: 'rio_shady', count: 4, x: 360, z: 438, spread: 18, idle: 0.7 },   // camelôs on the corner
  ], 2024);

  return {
    groundHeight: gh, seaLevel: -9999,
    // stay within the morro + the asfalto below; the far ridge and the empty
    // ground past the downtown sprawl are out of bounds (the view is the reward)
    blocked: (x, z) => z < -305 || z > 620 || Math.abs(x) > 585,
    update(dt, t, nightF) {
      const gl = 0.15 + nightF * 1.25;
      for (const m of lights) m.emissiveIntensity = gl;
      for (const l of lamps) l.intensity = nightF * 1.4;
      // avenue traffic lights cycle (real red/amber/green timing)
      for (const s of semaforos) {
        const st = sigState(t, s.offset);
        s.red.emissiveIntensity = st === 'red' ? 1 : 0.02;
        s.amber.emissiveIntensity = st === 'amber' ? 1 : 0.02;
        s.green.emissiveIntensity = st === 'green' ? 1 : 0.02;
      }
      traffic.update(dt);
      avenida.update(dt, t);
      villagers.update(dt);
    },
  };

  // --- favela path traffic (defined here to capture gh/ROAD) ---
  function FavelaTraffic(scene) {
    // cumulative road length for arc-length travel
    const seg = [], cum = [0];
    for (let i = 0; i < ROAD.length - 1; i++) { const d = Math.hypot(ROAD[i + 1][0] - ROAD[i][0], ROAD[i + 1][1] - ROAD[i][1]); seg.push(d); cum.push(cum[i] + d); }
    const total = cum[cum.length - 1];
    function at(dist) {
      dist = ((dist % total) + total) % total;
      let i = 0; while (i < seg.length - 1 && dist > cum[i + 1]) i++;
      const t = (dist - cum[i]) / seg[i];
      const x = ROAD[i][0] + (ROAD[i + 1][0] - ROAD[i][0]) * t;
      const z = ROAD[i][1] + (ROAD[i + 1][1] - ROAD[i][1]) * t;
      const hd = Math.atan2(ROAD[i + 1][0] - ROAD[i][0], ROAD[i + 1][1] - ROAD[i][1]);
      return { x, z, hd };
    }
    this.units = [];
    const spec = [['moto', 5], ['moto', 0], ['kombi', 2], ['taxi', 2]];
    let n = 0;
    for (const [kind, c] of spec) for (let i = 0; i < c; i++) {
      const g = kind === 'moto' ? makeMoto() : kind === 'kombi' ? makeKombi() : makeTaxi();
      scene.add(g);
      this.units.push({ g, kind, d: (n++ / 9) * total, dir: Math.random() < 0.5 ? 1 : -1, spd: kind === 'moto' ? 6 + Math.random() * 4 : 4 + Math.random() * 2, lat: (Math.random() - 0.5) * 1.6 });
    }
    this.update = (dt) => {
      for (const u of this.units) {
        u.d += u.dir * u.spd * dt;
        const a = at(u.d), a2 = at(u.d + u.dir * 2);
        const nx = Math.cos(a.hd), nz = -Math.sin(a.hd); // side offset
        u.g.position.set(a.x + nx * u.lat, gh(a.x, a.z) + 0.05, a.z + nz * u.lat);
        u.g.rotation.y = a.hd + (u.dir < 0 ? Math.PI : 0);
      }
    };
  }

  // --- the avenue (asfalto) traffic: buses, cars and taxis running each way,
  //     stopping at the semáforo junction on red — the real city moving. ---
  function AvenidaTraffic(scene) {
    const AVZ = 450, X0 = -560, X1 = 560, span = X1 - X0;
    this.units = [];
    // eastbound in the far lane (+z), westbound in the near lane (-z)
    const spec = [['bus', 3], ['car', 8], ['taxi', 3], ['kombi', 2]];
    let n = 0;
    for (const [kind, c] of spec) for (let i = 0; i < c; i++) {
      const g = kind === 'bus' ? makeBus() : kind === 'car' ? makeCar() : kind === 'taxi' ? makeTaxi() : makeKombi();
      scene.add(g);
      const dir = (n % 2) ? 1 : -1;
      this.units.push({ g, kind, dir, x: X0 + ((n++ * 83) % span), spd: kind === 'bus' ? 9 + Math.random() * 3 : 12 + Math.random() * 6 });
    }
    this.update = (dt, t) => {
      const red = sigState(t, 0) === 'red';        // junction at x≈0 is red for the avenue
      for (const u of this.units) {
        const stopLine = -u.dir * 4;               // hold a few metres before the crossing
        const approaching = u.x * u.dir < 0 && Math.abs(u.x) < 16;   // before the junction, closing in
        const wouldCross = (u.x + u.dir * u.spd * dt) * u.dir >= stopLine * u.dir;
        if (!(red && approaching && wouldCross)) u.x += u.dir * u.spd * dt;
        else u.x = stopLine;                        // queue at the stop line
        if (u.x > X1) u.x = X0; else if (u.x < X0) u.x = X1;
        const lane = u.dir > 0 ? 5.5 : -5.5;
        u.g.position.set(u.x, gh(u.x, AVZ) + 0.05, AVZ + lane);
        u.g.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    };
  }
}

// ---- vehicle meshes ----
function wheelSet(g, pts, r = 0.4) { for (const [x, y, z] of pts) { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 12), mat(0x111, 0.8)); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); g.add(w); } }
function makeMoto() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 1.8), mat([0xe0121a, 0x111, 0x1a3a8c][(Math.random() * 3) | 0], 0.5)); body.position.y = 0.8; g.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.9), mat(0x111)); seat.position.set(0, 1.0, -0.2); g.add(seat);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.1), mat(0x222)); bar.position.set(0, 1.15, 0.8); g.add(bar);
  wheelSet(g, [[0, 0.4, 0.8], [0, 0.4, -0.8]], 0.4);
  // rider
  const rider = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.28), mat([0xffd23d, 0xe0121a, 0x18b0a8][(Math.random() * 3) | 0])); torso.position.y = 1.5; rider.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat(0x111)); head.position.y = 1.95; rider.add(head); // helmet
  g.add(rider);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeKombi() {
  const g = new THREE.Group();
  const c = [0xf2f2ea, 0x8ab0d0, 0xe8b04a][(Math.random() * 3) | 0];
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 4.2), mat(c, 0.5)); lower.position.y = 1.1; g.add(lower);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 4.2), mat(0xf2f2ea, 0.5)); upper.position.y = 2.0; g.add(upper);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.5, 3.4), mat(0x1a2430, 0.3)); glass.position.set(0, 2.05, 0); g.add(glass);
  wheelSet(g, [[-0.9, 0.4, 1.4], [0.9, 0.4, 1.4], [-0.9, 0.4, -1.4], [0.9, 0.4, -1.4]]);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeTaxi() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 3.8), mat(0xf2c00a, 0.4)); body.position.y = 0.9; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.24, 3.82), mat(0x1a3a8c, 0.4)); stripe.position.y = 0.7; g.add(stripe);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.9), mat(0x1a2430, 0.3)); cabin.position.set(0, 1.5, -0.3); g.add(cabin);
  wheelSet(g, [[-0.85, 0.42, 1.2], [0.85, 0.42, 1.2], [-0.85, 0.42, -1.2], [0.85, 0.42, -1.2]], 0.42);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeCar() {
  const g = new THREE.Group();
  const c = [0xf2f2ea, 0x1a1a1a, 0x8a1020, 0x1a3a6a, 0x555a60, 0xb0b4b8][(Math.random() * 6) | 0];
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.8, 4), mat(c, 0.4, 0.1)); body.position.y = 0.75; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.2), mat(c, 0.4, 0.1)); cabin.position.set(0, 1.4, -0.2); g.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.6, 2.0), mat(0x1a2430, 0.3)); glass.position.set(0, 1.45, -0.2); g.add(glass);
  wheelSet(g, [[-0.85, 0.38, 1.3], [0.85, 0.38, 1.3], [-0.85, 0.38, -1.3], [0.85, 0.38, -1.3]], 0.38);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeBus() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 11), mat(0x2a6ac8, 0.5)); body.position.y = 1.9; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.6, 11), mat(0xf2c53d, 0.5)); stripe.position.y = 2.2; g.add(stripe);
  for (let i = 0; i < 6; i++) { const win = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.9, 1.2), mat(0x1a2430, 0.3)); win.position.set(0, 2.6, -4.5 + i * 1.6); g.add(win); }
  wheelSet(g, [[-1.1, 0.5, 3.4], [1.1, 0.5, 3.4], [-1.1, 0.5, -3.4], [1.1, 0.5, -3.4]], 0.6);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
