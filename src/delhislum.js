import * as THREE from 'three';
import { Villagers, buildHuman } from './villagers.js';
import { DelhiLife } from './delhilife.js';

// ---------------------------------------------------------------------------
// A present-day Delhi jhuggi-jhopri basti — a Gangetic-plain migrant slum, and
// the gated wealth pressed right up against it. North of the road: a sea of
// tin-and-tarp shanties packed wall to wall, tangled galis, an open nullah
// (sewage drain), hand pumps, chai and kirana stalls, a small mandir and a
// masjid, cows and goats, drying laundry, a web of stolen wires — the density
// and poverty of khadar Delhi. Overhead runs the elevated Metro with a station;
// across the boundary wall to the south, the other India: glass apartment
// towers, a shopping mall, manicured lawns and a clean road full of cars. Autos,
// e-rickshaws, cycle-rickshaws, bikes and a DTC bus choke the main road. Heat,
// dust and winter smog hang over all of it. NPCs absolutely everywhere.
// ---------------------------------------------------------------------------

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mat(c, r = 0.9, m = 0) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); }
function emis(c, i = 1) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.5 }); }

// dusty, grimy structural palette: raw brick, bare cement, mud plaster
const WALL_COLS = [0x9a5638, 0xa1583a, 0x8f5030, 0x925032, 0x8a7050, 0x9a8a6a, 0x9a958c, 0x8f8a80, 0xa8a298, 0x847e74, 0xb0a48a];
const TARP_COLS = [0x2a5a9a, 0x2a6a8a, 0x1f5a86, 0xd0602a, 0x3a7a5a, 0x6a6a6a, 0x8a3a3a]; // plastic sheeting
const TIN_COLS = [0x8a6a4a, 0x7a6a5a, 0x9a8a6a, 0x6a5a4a, 0x8a8a80];                       // rusted / asbestos sheet

const MAIN_Z = 60, WALL_Z = 80, POSH_ROAD_Z = 120, NULLAH_X = -180;

export function buildDelhiSlum(scene) {
  const rnd = rng(1947);
  const lights = [];   // emissive materials → ramp at night
  const lamps = [];    // the few real point lights
  const poshLights = []; // society/mall/tower emissives (blaze at night — the contrast)

  const QID = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

  function gh(x, z) { return 0.2 + Math.sin(x * 0.05) * 0.12 + Math.cos(z * 0.045) * 0.12; }

  // --- ground: dusty dirt with patches of cracked concrete + the posh green ---
  const S = 1700, N = 150;
  const geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const cDust = new THREE.Color(0x8a7a5e), cDirt = new THREE.Color(0x7a6a4e), cLawn = new THREE.Color(0x4a6a38), cRoad = new THREE.Color(0x3a3a3c);
  const tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, gh(x, z));
    if (z > WALL_Z + 6 && z < 360) tmp.copy(cLawn);                 // society lawns
    else if (Math.abs(z - MAIN_Z) < 12 || Math.abs(z - POSH_ROAD_Z) < 9) tmp.copy(cRoad);
    else tmp.copy(rnd() < 0.5 ? cDust : cDirt);
    tmp.offsetHSL(0, 0, (Math.sin(x * 0.3 + z * 0.2) * 0.03));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);

  // dusty brown smog dome sitting over the whole scene (backdrop of distant haze)
  const smog = new THREE.Mesh(new THREE.SphereGeometry(820, 16, 12), new THREE.MeshBasicMaterial({ color: 0xb8a890, side: THREE.BackSide, fog: false, transparent: true, opacity: 0.28 }));
  scene.add(smog);

  // === batched shanty instancing (thousands of boxes → a handful of draws) ===
  const wallMx = [], wallCol = [], roofMx = [], roofCol = [], drumMx = [];
  const tmpCol = new THREE.Color();
  function pushBox(list, x, y, z, sx, sy, sz, rotY, colList, color) {
    QID.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    list.push(new THREE.Matrix4().compose(_p.set(x, y, z), QID, _s.set(sx, sy, sz)));
    if (colList) colList.push(color);
  }
  // one jhuggi: 1–2 low storeys of brick/cement/mud + a tarp-or-tin roof, tank
  function jhuggi(x, z) {
    const gy = gh(x, z), rotY = (rnd() - 0.5) * 0.6;
    const w = 3 + rnd() * 3, d = 3 + rnd() * 3;
    const storeys = rnd() < 0.32 ? 2 : 1;
    let y = gy;
    for (let f = 0; f < storeys; f++) {
      const h = 2.2 + rnd() * 0.7;
      tmpCol.setHex(WALL_COLS[(rnd() * WALL_COLS.length) | 0]).offsetHSL(0, 0, (rnd() - 0.5) * 0.06);
      pushBox(wallMx, x, y + h / 2, z, w, h, d, rotY, wallCol, tmpCol.clone());
      y += h;
    }
    // roof: tarp (bright plastic) or a leaning tin sheet
    const tarp = rnd() < 0.6;
    tmpCol.setHex((tarp ? TARP_COLS : TIN_COLS)[(rnd() * (tarp ? TARP_COLS : TIN_COLS).length) | 0]);
    pushBox(roofMx, x, y + 0.12, z, w + 0.5, 0.16, d + 0.5, rotY + (rnd() - 0.5) * 0.1, roofCol, tmpCol.clone());
    if (rnd() < 0.45) pushBox(drumMx, x + (rnd() - 0.5) * w * 0.6, y + 0.45, z + (rnd() - 0.5) * d * 0.6, 1, 1, 1, 0, null);
  }
  function bakeShanties() {
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const walls = new THREE.InstancedMesh(unit, mat(0xffffff, 1), wallMx.length);
    walls.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(wallMx.length * 3), 3);
    wallMx.forEach((m, i) => { walls.setMatrixAt(i, m); walls.setColorAt(i, wallCol[i]); });
    walls.instanceColor.needsUpdate = true; walls.receiveShadow = true; walls.castShadow = true; scene.add(walls);
    const roofs = new THREE.InstancedMesh(unit, mat(0xffffff, 0.8), roofMx.length);
    roofs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(roofMx.length * 3), 3);
    roofMx.forEach((m, i) => { roofs.setMatrixAt(i, m); roofs.setColorAt(i, roofCol[i]); });
    roofs.instanceColor.needsUpdate = true; scene.add(roofs);
    const drumGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.9, 8);
    const drums = new THREE.InstancedMesh(drumGeo, mat(0x2a6ac8), drumMx.length || 1);
    drumMx.forEach((m, i) => drums.setMatrixAt(i, m)); scene.add(drums);
  }

  // --- small live props (kept as real meshes; used sparingly) ---
  function charpai(x, z) {           // rope cot
    const g = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.9), mat(0xc9a06a, 1)); bed.position.y = 0.55; g.add(bed);
    for (const [lx, lz] of [[0.85, 0.4], [0.85, -0.4], [-0.85, 0.4], [-0.85, -0.4]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), mat(0x5a4a2a)); l.position.set(lx, 0.27, lz); g.add(l); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rnd() * Math.PI; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function handpump(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat(0x6a6a6a, 1)); base.position.y = 0.25; g.add(base);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), mat(0x2a5a3a)); pipe.position.y = 0.9; g.add(pipe);
    const hdl = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), mat(0x2a5a3a)); hdl.position.set(0.2, 1.3, 0); hdl.rotation.z = 0.3; g.add(hdl);
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function laundry(x, z, len, rot) {  // a line of drying clothes
    const cols = [0xc21f2f, 0xe0a010, 0x1a6a8a, 0x207040, 0xffffff, 0x903070, 0xd06a2a];
    const n = Math.max(3, len / 0.8 | 0);
    for (let i = 0; i < n; i++) {
      const t = i / n, cx = x + Math.cos(rot) * (t - 0.5) * len, cz = z + Math.sin(rot) * (t - 0.5) * len;
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), mat(cols[(rnd() * cols.length) | 0], 1));
      cloth.position.set(cx, gh(cx, cz) + 2.1, cz); cloth.rotation.y = rot; scene.add(cloth);
    }
  }
  function dish(x, y, z) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), mat(0xd8d0c0, 0.6)); d.position.set(x, y, z); d.rotation.set(-0.8, rnd() * 6, 0); scene.add(d); }
  function pole(x, z, h = 6) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, h, 6), mat(0x555)); po.position.set(x, gh(x, z) + h / 2, z); po.castShadow = true; scene.add(po); return po; }
  function wire(x0, z0, y0, x1, z1, y1) {
    const dx = x1 - x0, dz = z1 - z0, dy = y1 - y0, len = Math.hypot(dx, dz, dy);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 4), mat(0x111));
    w.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()); scene.add(w);
  }
  function cow(x, z, buffalo = false) {
    const g = new THREE.Group(); const c = mat(buffalo ? 0x2a2a30 : 0xd8cdb8);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.8), c); body.position.y = 1.1; g.add(body);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), c); neck.position.set(1.1, 1.3, 0); g.add(neck);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.45), c); head.position.set(1.5, 1.4, 0); g.add(head);
    for (const [lx, lz] of [[0.7, 0.3], [0.7, -0.3], [-0.7, 0.3], [-0.7, -0.3]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), c); l.position.set(lx, 0.55, lz); g.add(l); }
    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), c); hump.position.set(0.6, 1.7, 0); g.add(hump);
    g.position.set(x, gh(x, z), z); g.rotation.y = rnd() * Math.PI * 2; g.scale.setScalar(buffalo ? 1.05 : 0.9); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function goat(x, z) {
    const g = new THREE.Group(); const c = mat([0xd8cdb8, 0x8a7050, 0x3a2a1a, 0xf0e8d8][(rnd() * 4) | 0]);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.35), c); body.position.y = 0.6; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.25), c); head.position.set(0.55, 0.7, 0); g.add(head);
    for (const [lx, lz] of [[0.35, 0.12], [0.35, -0.12], [-0.35, 0.12], [-0.35, -0.12]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), c); l.position.set(lx, 0.25, lz); g.add(l); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rnd() * Math.PI * 2; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function dog(x, z) {   // stray (desi) dog
    const g = new THREE.Group(); const c = mat([0xc79a5a, 0xa07040, 0xd8c8a8, 0x8a6a44, 0x3a2a1a][(rnd() * 5) | 0]);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.36, 0.32), c); body.position.y = 0.48; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.28), c); head.position.set(0.52, 0.56, 0); g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.16), c); snout.position.set(0.72, 0.5, 0); g.add(snout);
    for (const [lx, lz] of [[0.32, 0.11], [0.32, -0.11], [-0.32, 0.11], [-0.32, -0.11]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.36, 0.09), c); l.position.set(lx, 0.18, lz); g.add(l); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.07), c); tail.position.set(-0.55, 0.56, 0); tail.rotation.z = 0.7; g.add(tail);
    g.position.set(x, gh(x, z), z); g.rotation.y = rnd() * Math.PI * 2; g.scale.setScalar(0.85 + rnd() * 0.3); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function pig(x, z) {   // scavenging in the nullah
    const g = new THREE.Group(); const c = mat([0x2a2420, 0x3a2f28, 0x4a3a30][(rnd() * 3) | 0]);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.42), c); body.position.y = 0.4; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), c); head.position.set(0.6, 0.4, 0); g.add(head);
    for (const [lx, lz] of [[0.3, 0.14], [0.3, -0.14], [-0.3, 0.14], [-0.3, -0.14]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.1), c); l.position.set(lx, 0.12, lz); g.add(l); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rnd() * Math.PI * 2; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  // rhesus macaque — sits on walls/wires/rooftops (returns the group so callers
  // can perch it); collected for a gentle idle animation
  const monkeys = [];
  function monkey(x, y, z) {
    const g = new THREE.Group(); const fur = mat(0x8a7a5a), face = mat(0xc9a889);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.4, 0.24), fur); body.position.y = 0.3; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), fur); head.position.y = 0.6; g.add(head);
    const fc = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), face); fc.position.set(0, 0.6, 0.15); g.add(fc);
    for (const ax of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.07), fur); arm.position.set(ax * 0.18, 0.28, 0); g.add(arm); }
    for (const lx of [-0.09, 0.09]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.08), fur); leg.position.set(lx, 0.05, 0); g.add(leg); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.5, 5), fur); tail.position.set(-0.16, 0.28, 0); tail.rotation.z = 1.1; g.add(tail);
    g.position.set(x, y, z); g.rotation.y = rnd() * Math.PI * 2; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
    monkeys.push({ g, base: y, ph: rnd() * 6 }); return g;
  }
  function garbage(x, z) {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.3 + rnd() * 0.5, 0.2 + rnd() * 0.3, 0.3 + rnd() * 0.5), mat([0x6a6a5a, 0x8a3a3a, 0x3a5a7a, 0x8a8a4a, 0x5a4a3a][(rnd() * 5) | 0], 1)); c.position.set((rnd() - 0.5) * 2, 0.15 + rnd() * 0.3, (rnd() - 0.5) * 2); c.rotation.set(rnd(), rnd(), rnd()); g.add(c); }
    g.position.set(x, gh(x, z), z); scene.add(g);
  }
  function handcart(x, z) {  // thela
    const g = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 1.2), mat(0x6a4a2a)); bed.position.y = 0.9; g.add(bed);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.06), mat(0x5a3a1a)); rail.position.set(0, 1.1, -0.6); g.add(rail);
    for (const wx of [-0.7, 0.7]) { const wl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.14, 12), mat(0x222)); wl.rotation.z = Math.PI / 2; wl.position.set(wx, 0.45, 0); g.add(wl); }
    // a heap of produce
    for (let i = 0; i < 10; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), mat([0xd03020, 0xd0a020, 0x30a040, 0xe07020][(rnd() * 4) | 0])); f.position.set((rnd() - 0.5) * 2.2, 1.05 + rnd() * 0.15, (rnd() - 0.5) * 1); g.add(f); }
    g.position.set(x, gh(x, z), z); g.rotation.y = rnd() * Math.PI; g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }

  // hand-painted signboard shop (chai / kirana / STD-PCO / mobile recharge)
  function stall(x, z, w, h, d, color, sign, signCol, posh = false) {
    const g = new THREE.Group(); const gy = gh(x, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, 1)); body.position.y = h / 2; g.add(body);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.16, 1.2), mat(0x3a5a7a, 1)); awn.position.set(0, h * 0.85, d / 2 + 0.6); g.add(awn);
    if (sign) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 56; const c = cv.getContext('2d');
      c.fillStyle = '#' + signCol.toString(16).padStart(6, '0'); c.fillRect(0, 0, 256, 56);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 30px Arial'; c.fillText(sign, 128, 38);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, side: THREE.DoubleSide });
      (posh ? poshLights : lights).push(m);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, 0.95), m); s.position.set(0, h + 0.55, d / 2 + 0.1); g.add(s);
    }
    g.position.set(x, gy, z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g;
  }

  // little Hindu mandir (spire + saffron flag) and a mosque (dome + minaret)
  function mandir(x, z) {
    const g = new THREE.Group(); const gy = gh(x, z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), mat(0xe8b84a, 1)); base.position.y = 1.5; g.add(base);
    const shik = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.5, 8), mat(0xe0902a, 1)); shik.position.y = 4.7; g.add(shik);
    const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(0xf2c53d, 0.4, 0.6)); kalash.position.y = 6.6; g.add(kalash);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), mat(0xff7a1a, 1)); flag.position.set(0.9, 6.6, 0); g.add(flag);
    g.position.set(x, gy, z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  function masjid(x, z) {
    const g = new THREE.Group(); const gy = gh(x, z);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 5), mat(0x8ab0a0, 1)); hall.position.y = 1.75; g.add(hall);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a7a5a, 0.5)); dome.position.y = 3.5; g.add(dome);
    const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 8, 10), mat(0xd8e0d8, 0.8)); minaret.position.set(3.2, 4, 2); g.add(minaret);
    const mcap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a7a5a, 0.5)); mcap.position.set(3.2, 8, 2); g.add(mcap);
    g.position.set(x, gy, z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }

  // === the open nullah (concrete sewage drain) running N–S through the slum ===
  (function nullah() {
    const x0 = NULLAH_X, z0 = -320, z1 = 50, len = z1 - z0;
    const wall = mat(0x8a857c, 1);
    for (const sx of [-2.2, 2.2]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, len), wall); w.position.set(x0 + sx, gh(x0, 0) + 0.3, (z0 + z1) / 2); w.receiveShadow = true; scene.add(w); }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, len), mat(0x3a3a2a, 1)); bed.position.set(x0, gh(x0, 0) - 0.6, (z0 + z1) / 2); scene.add(bed);
    const water = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, len), mat(0x4a4a2a, 0.4, 0.2)); water.position.set(x0, gh(x0, 0) - 0.2, (z0 + z1) / 2); scene.add(water);
    // a couple of plank footbridges across
    for (const bz of [-180, -40]) { const br = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 2.4), mat(0x6a5a3a)); br.position.set(x0, gh(x0, bz) + 0.9, bz); br.castShadow = true; scene.add(br); }
  })();

  // === the elevated Metro viaduct + a station, running along X over the road ===
  const metro = (function metroLine() {
    const zc = MAIN_Z, deckY = 13, conc = mat(0x9a958c, 1);
    // pillars down the median
    for (let x = -440; x <= 440; x += 40) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, deckY, 8), conc); pl.position.set(x, deckY / 2, zc); pl.castShadow = true; scene.add(pl); const cap = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 6), conc); cap.position.set(x, deckY, zc); scene.add(cap); }
    // the deck / guideway
    const deck = new THREE.Mesh(new THREE.BoxGeometry(920, 1.2, 7), conc); deck.position.set(0, deckY + 0.6, zc); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
    const para = mat(0x8ab0c8, 0.6); for (const sz of [-3.2, 3.2]) { const pr = new THREE.Mesh(new THREE.BoxGeometry(920, 0.7, 0.2), para); pr.position.set(0, deckY + 1.6, zc + sz); scene.add(pr); }

    // the station at x = 0: raised platform box + canopy + stairs to both sides
    const stn = new THREE.Group();
    const plat = new THREE.Mesh(new THREE.BoxGeometry(70, 1.4, 22), conc); plat.position.set(0, deckY - 0.7, zc); stn.add(plat);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(74, 0.6, 24), mat(0x3a5a7a, 0.6)); roof.position.set(0, deckY + 6, zc); stn.add(roof);
    for (const rx of [-30, -10, 10, 30]) for (const rz of [-9, 9]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 6, 6), conc); c.position.set(rx, deckY + 3, zc + rz); stn.add(c); }
    // station name board
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 80; const cx = cv.getContext('2d');
    cx.fillStyle = '#1a3a8c'; cx.fillRect(0, 0, 512, 80); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = 'bold 46px Arial'; cx.fillText('YAMUNA VIHAR', 256, 56);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const nm = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2, side: THREE.DoubleSide }); poshLights.push(nm);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(20, 3.1), nm); board.position.set(0, deckY + 4.4, zc + 11.2); stn.add(board);
    // two staircases down (slum side z-, posh side z+)
    for (const side of [-1, 1]) { const steps = 14; for (let i = 0; i < steps; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 0.9), conc); st.position.set(-20, (deckY - 1.4) * (1 - i / steps), zc + side * (12 + i * 0.9)); st.castShadow = true; stn.add(st); } }
    stn.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(stn);

    // the train — a rake of cars that slides along the guideway
    const train = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const carG = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 17), mat(0xc8ccd0, 0.4, 0.3)); body.position.y = 0; carG.add(body);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.5, 17), mat(0x1a3a8c, 0.4)); stripe.position.y = 0.3; carG.add(stripe);
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.06, 1.0, 15), emis(0x9ad0e0, 0.2)); win.position.y = 0.7; carG.add(win); lights.push(win.material);
      carG.position.set(0, deckY + 2.2, zc - 3 + 0 + 0); carG.position.z = 0; carG.position.set(0, deckY + 2.2, zc);
      carG.userData.off = (i - 2.5) * 17.6; train.add(carG);
    }
    scene.add(train);
    const doorL = []; // (no sliding doors on the elevated rake — kept simple)

    // Scheduled service: the train sweeps in from the west, halts at the station
    // for a boarding dwell (doors "open"), then pulls out east and loops back.
    // State: 'incoming' → 'dwell' → 'departing' → 'away' → repeat.
    const CYCLE = { incoming: 7, dwell: 8, departing: 6, away: 12 };
    let phase = 'away', pt = CYCLE.away * 0.6, headX = -520;
    function setCars(x) { for (const car of train.children) { car.position.x = x + car.userData.off; car.position.z = zc; } }
    setCars(-520);
    return {
      get boardable() { return phase === 'dwell'; },
      get phase() { return phase; },
      // seconds until the next boarding dwell begins (for the countdown board)
      get etaDwell() {
        if (phase === 'dwell') return 0;
        if (phase === 'incoming') return CYCLE.incoming - pt;
        if (phase === 'departing') return (CYCLE.departing - pt) + CYCLE.away + CYCLE.incoming;
        return (CYCLE.away - pt) + CYCLE.incoming; // away
      },
      update(dt) {
        pt += dt; const dur = CYCLE[phase];
        if (pt >= dur) { pt = 0; phase = phase === 'incoming' ? 'dwell' : phase === 'dwell' ? 'departing' : phase === 'departing' ? 'away' : 'incoming'; }
        if (phase === 'incoming') headX = -520 + (520 / CYCLE.incoming) * pt;      // −520 → 0
        else if (phase === 'dwell') headX = 0;
        else if (phase === 'departing') headX = (520 / CYCLE.departing) * pt;        // 0 → 520
        else headX = -520;                                                            // parked off-scene, west
        setCars(headX);
      },
    };
  })();

  // === the posh side: boundary wall, glass towers, a mall, a clean road ===
  (function society() {
    // boundary wall with a barbed-wire top and a gate at x≈0
    const wallM = mat(0xcabfa8, 1);
    for (let x = -440; x <= 440; x += 12) {
      if (Math.abs(x) < 14) continue;             // the society gate
      const w = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 0.5), wallM); w.position.set(x, gh(x, WALL_Z) + 1.5, WALL_Z); w.castShadow = true; w.receiveShadow = true; scene.add(w);
      if ((x / 12) % 2 === 0) { const bw = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 12, 4), mat(0x555)); bw.rotation.z = Math.PI / 2; bw.position.set(x, gh(x, WALL_Z) + 3.2, WALL_Z); scene.add(bw); }
    }
    // gate pillars + a lit society name
    for (const gx of [-15, 15]) { const gp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.5, 1.4), mat(0xe8e2d0, 0.8)); gp.position.set(gx, gh(gx, WALL_Z) + 2.25, WALL_Z); gp.castShadow = true; scene.add(gp); }
    const cv = document.createElement('canvas'); cv.width = 400; cv.height = 60; const c = cv.getContext('2d');
    c.fillStyle = '#0a2a5a'; c.fillRect(0, 0, 400, 60); c.fillStyle = '#e8c84a'; c.textAlign = 'center'; c.font = 'bold 32px Arial'; c.fillText('DLF PARK PLACE', 200, 40);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const nm = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2, side: THREE.DoubleSide }); poshLights.push(nm);
    const nb = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.1), nm); nb.position.set(0, gh(0, WALL_Z) + 5.6, WALL_Z + 0.4); scene.add(nb);

    // glass residential towers — tall, lit window grids (blaze at night)
    const towerWin = emis(0xffe6a0, 0); poshLights.push(towerWin);
    const glass = mat(0x6a8496, 0.35, 0.4);
    for (const [tx, tz, th] of [[-260, 210, 100], [-160, 300, 132], [-40, 230, 116], [90, 320, 140], [210, 220, 108], [320, 300, 124], [30, 340, 96], [-330, 250, 90]]) {
      const w = 26 + rnd() * 10, d = 26 + rnd() * 10;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, th, d), glass); b.position.set(tx, gh(tx, tz) + th / 2, tz); b.castShadow = true; scene.add(b);
      for (const face of [1, -1]) { const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, th - 6, 0.2), towerWin); band.position.set(tx, gh(tx, tz) + th / 2 + 3, tz + face * (d / 2 + 0.02)); scene.add(band); }
      for (const face of [1, -1]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.2, th - 6, d * 0.9), towerWin); band.position.set(tx + face * (w / 2 + 0.02), gh(tx, tz) + th / 2 + 3, tz); scene.add(band); }
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 4, d * 0.5), mat(0x3a4650)); cap.position.set(tx, gh(tx, tz) + th + 2, tz); scene.add(cap);
    }
    // the shopping mall: a big box with a glowing brand facade
    const mall = new THREE.Mesh(new THREE.BoxGeometry(120, 22, 70), mat(0xd8d2c8, 0.7)); mall.position.set(140, gh(140, 260) + 11, 260); mall.castShadow = true; scene.add(mall);
    const mallGlass = new THREE.Mesh(new THREE.BoxGeometry(122, 14, 4), emis(0x9ad0e0, 0)); mallGlass.position.set(140, gh(140, 200) + 8, 226); scene.add(mallGlass); poshLights.push(mallGlass.material);
    for (const [sx, txt, col] of [[95, 'SELECT CITYWALK', 0xe0121a], [140, 'MALL', 0x1a3a8c], [185, 'SHOPPING', 0x1a7a3f]]) {
      const cv2 = document.createElement('canvas'); cv2.width = 256; cv2.height = 64; const cc = cv2.getContext('2d');
      cc.fillStyle = '#' + col.toString(16).padStart(6, '0'); cc.fillRect(0, 0, 256, 64); cc.fillStyle = '#fff'; cc.textAlign = 'center'; cc.font = 'bold 34px Arial'; cc.fillText(txt, 128, 44);
      const t2 = new THREE.CanvasTexture(cv2); t2.colorSpace = THREE.SRGBColorSpace;
      const mm = new THREE.MeshStandardMaterial({ map: t2, emissive: 0xffffff, emissiveMap: t2, emissiveIntensity: 0.2, side: THREE.DoubleSide }); poshLights.push(mm);
      const sgn = new THREE.Mesh(new THREE.PlaneGeometry(24, 4), mm); sgn.position.set(sx, gh(sx, 224) + 18, 224); scene.add(sgn);
    }
    // clean landscaped trees + a guard booth at the gate
    for (let i = 0; i < 26; i++) { const tx = -420 + rnd() * 840, tz = 150 + rnd() * 190; tree(tx, tz, true); }
    const booth = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), mat(0xe8e2d0, 0.8)); booth.position.set(24, gh(24, 92) + 1.5, 92); booth.castShadow = true; scene.add(booth);
    // a couple of billboards facing the slum (aspirational ads over the wall)
    for (const bx of [-120, 200]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10, 0.5), mat(0x555)); post.position.set(bx, gh(bx, WALL_Z) + 5, WALL_Z - 3); scene.add(post); const bd = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.4), emis([0xd0306a, 0x1a3a8c][(rnd() * 2) | 0], 0.15)); bd.position.set(bx, gh(bx, WALL_Z) + 11, WALL_Z - 3); scene.add(bd); poshLights.push(bd.material); }
  })();

  function tree(x, z, lush = false) {
    const g = new THREE.Group(); const s = 0.9 + rnd() * 0.8;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.34 * s, 4 * s, 6), mat(0x5a4326)); tr.position.y = 2 * s; g.add(tr);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry((1.8 + rnd()) * s, 8, 6), mat(lush ? [0x2a6a2a, 0x357a35, 0x2f7a3a][(rnd() * 3) | 0] : [0x5a6a3a, 0x6a7040, 0x4a5a2a][(rnd() * 3) | 0])); c.position.set((rnd() - 0.5) * 2 * s, (4 + rnd()) * s, (rnd() - 0.5) * 2 * s); g.add(c); }
    g.position.set(x, gh(x, z), z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }

  // === roads ===
  const roadMat = mat(0x33333a, 1);
  const mainRoad = new THREE.Mesh(new THREE.BoxGeometry(1000, 0.2, 20), roadMat); mainRoad.position.set(0, gh(0, MAIN_Z) + 0.12, MAIN_Z); mainRoad.receiveShadow = true; scene.add(mainRoad);
  for (let x = -480; x < 480; x += 12) { const d = new THREE.Mesh(new THREE.BoxGeometry(6, 0.02, 0.35), mat(0xd8d0b0, 1)); d.position.set(x, gh(x, MAIN_Z) + 0.24, MAIN_Z); scene.add(d); }
  const poshRoad = new THREE.Mesh(new THREE.BoxGeometry(1000, 0.2, 14), mat(0x2c2c30, 1)); poshRoad.position.set(0, gh(0, POSH_ROAD_Z) + 0.12, POSH_ROAD_Z); poshRoad.receiveShadow = true; scene.add(poshRoad);
  for (let x = -480; x < 480; x += 12) { const d = new THREE.Mesh(new THREE.BoxGeometry(6, 0.02, 0.3), mat(0xf2e070, 0.6)); d.position.set(x, gh(x, POSH_ROAD_Z) + 0.24, POSH_ROAD_Z); scene.add(d); }

  // === lay out the basti: pack shanties over the whole north side, leaving the
  //     galis (narrow lanes), the nullah and the road clear. MAX density. ===
  function blockedForBuild(x, z) {
    if (Math.abs(z - MAIN_Z) < 13) return true;             // main road + metro median
    if (Math.abs(x - NULLAH_X) < 3.5 && z < 55 && z > -325) return true; // the nullah
    if (z > WALL_Z - 3) return true;                        // don't build past the wall
    return false;
  }
  for (let gx = -420; gx <= 420; gx += 5.5) {
    for (let gz = -340; gz <= 45; gz += 5.5) {
      // galis: skip whole lanes on a coarse grid so alleys thread through
      if (Math.abs(((gx + 800) % 44) - 22) < 3) continue;
      if (Math.abs(((gz + 800) % 52) - 26) < 3) continue;
      const x = gx + (rnd() - 0.5) * 3, z = gz + (rnd() - 0.5) * 3;
      if (blockedForBuild(x, z)) continue;
      if (rnd() < 0.06) continue;                            // an occasional gap / courtyard
      jhuggi(x, z);
    }
  }
  bakeShanties();

  // wires strung between leaning poles all across the basti (the gambiarra web)
  const polePos = [];
  for (let i = 0; i < 26; i++) { const x = -400 + rnd() * 800, z = -330 + rnd() * 370; if (blockedForBuild(x, z)) continue; pole(x, z, 6.5); polePos.push([x, z]); }
  for (let i = 0; i < polePos.length; i++) { const a = polePos[i], b = polePos[(i + 1) % polePos.length]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 90) wire(a[0], a[1], gh(a[0], a[1]) + 6, b[0], b[1], gh(b[0], b[1]) + 6); }
  // rooftop dishes, laundry lines, charpais, garbage, animals scattered thickly
  for (let i = 0; i < 120; i++) { const x = -400 + rnd() * 800, z = -330 + rnd() * 360; if (blockedForBuild(x, z)) continue; dish(x + (rnd() - 0.5), gh(x, z) + 2.6 + rnd() * 1.5, z + (rnd() - 0.5)); }
  for (let i = 0; i < 60; i++) { const x = -400 + rnd() * 800, z = -330 + rnd() * 360; if (blockedForBuild(x, z)) continue; laundry(x, z, 4 + rnd() * 3, rnd() * Math.PI); }
  for (let i = 0; i < 40; i++) { const x = -400 + rnd() * 800, z = -330 + rnd() * 360; if (blockedForBuild(x, z)) continue; charpai(x, z); }
  for (let i = 0; i < 30; i++) { const x = -400 + rnd() * 800, z = -330 + rnd() * 360; if (blockedForBuild(x, z)) continue; garbage(x, z); }
  for (let i = 0; i < 24; i++) { const x = -400 + rnd() * 800, z = -320 + rnd() * 350; if (blockedForBuild(x, z)) continue; rnd() < 0.4 ? cow(x, z, rnd() < 0.4) : goat(x, z); }
  // stray dogs everywhere, pigs rooting in the nullah, monkeys up on the walls
  for (let i = 0; i < 46; i++) { const x = -400 + rnd() * 800, z = -330 + rnd() * 370; if (blockedForBuild(x, z)) continue; dog(x, z); }
  for (let i = 0; i < 12; i++) { pig(NULLAH_X + (rnd() - 0.5) * 6, -300 + rnd() * 330); }
  for (let i = 0; i < 20; i++) { const x = -400 + rnd() * 800, z = -320 + rnd() * 340; if (blockedForBuild(x, z)) continue; monkey(x, gh(x, z) + 2.6 + rnd() * 2.5, z); }  // on roofs
  for (const [hx, hz] of [[-260, -200], [120, -120], [-60, -260], [280, -60], [-340, -40], [40, 10]]) handpump(hx, hz);
  for (let i = 0; i < 14; i++) { const x = -380 + rnd() * 760, z = -300 + rnd() * 340; if (blockedForBuild(x, z)) continue; handcart(x, z); }

  // community landmarks + the market strip of stalls along the main road
  mandir(-300, -30); masjid(300, -20);
  stall(-40, 44, 4, 3, 3, 0x8a3a2a, 'CHAI', 0xc21f2f);
  stall(-10, 44, 5, 3, 3.5, 0x2a6a4a, 'KIRANA STORE', 0x1a7a3f);
  stall(30, 44, 4.5, 3, 3, 0x1a3a8c, 'MOBILE RECHARGE', 0x1a3a8c);
  stall(70, 44, 4, 3, 3, 0x6a2a6a, 'PAN · BIDI', 0x8a1f6b);
  stall(-90, 44, 5, 3, 3.5, 0xd0902a, 'DHABA · ROTI', 0xb04a1a);
  stall(-130, 44, 4.5, 3, 3, 0x3a6a7a, 'STD · PCO', 0x146b8c);
  stall(110, 44, 4, 3, 3, 0x7a3a3a, 'BARBER', 0x8a2a2a);
  // a public toilet block + a water tanker point (real slum infrastructure)
  stall(-200, 40, 8, 3.2, 4, 0x8ab0c0, 'SULABH · TOILET', 0x1a6a8a);
  // a few chai-stall bulbs — the only real point lights (keep it cheap)
  for (const [lx, lz] of [[-40, 44], [-90, 44], [110, 44]]) { const bulb = emis(0xffdca0, 0); lights.push(bulb); const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), bulb); b.position.set(lx, gh(lx, lz) + 3.2, lz + 1.6); scene.add(b); const pl = new THREE.PointLight(0xffd8a0, 0, 20); pl.position.set(lx, gh(lx, lz) + 3.2, lz + 1.6); scene.add(pl); lamps.push(pl); }

  // === THE CITY CENTRE — where the Metro takes you to work: a packed, very
  //     Delhi bazaar (think Chandni Chowk / Sarojini): rows of signboard shops,
  //     fruit thelas, sweet and chaat stalls, tangled wires and hanging boards,
  //     a clock tower, autos and cycle-rickshaws, cows in the lane, and crowds. ===
  const CC_Z = 560;   // centre of the city-centre district
  const PAX_SKIN = [0x8d5524, 0x7a4a1e, 0xa06a34, 0x6b3d18, 0xb07840, 0x955e2b];
  const PAX_TOP = [0x3a5a7a, 0x6a7a4a, 0x8a5a3a, 0x7a3a3a, 0xffffff, 0x1a3a6a, 0xc21f2f, 0xaa9a7a];
  const PAX_SAREE = [0xc21f2f, 0xd08010, 0x207040, 0x903070, 0x1a6a8a, 0xb04a1a, 0xd0306a, 0xe0a010];
  function paxDress() {
    return rnd() < 0.45
      ? { skin: PAX_SKIN[rnd() * PAX_SKIN.length | 0], female: true, saree: PAX_SAREE[rnd() * PAX_SAREE.length | 0], headwrap: rnd() < 0.25 ? PAX_SAREE[rnd() * PAX_SAREE.length | 0] : null }
      : { skin: PAX_SKIN[rnd() * PAX_SKIN.length | 0], top: PAX_TOP[rnd() * PAX_TOP.length | 0], bottom: [0x2a2a2a, 0x3a3a44, 0xece7d8, 0x5a4a34][rnd() * 4 | 0], cap: rnd() < 0.15 };
  }
  // a stacked bazaar building: 2–4 haphazard pukka floors under a clutter of signs
  function bazaarBlock(x, z, w, d, floors) {
    const g = new THREE.Group(); const gy = gh(x, z), fh = 3.1;
    for (let f = 0; f < floors; f++) {
      tmpCol.setHex([0xc7b89a, 0xd8c8a8, 0xb0a488, 0xc0b090, 0xa89878, 0xcabf9a][(rnd() * 6) | 0]).offsetHSL(0, 0, (rnd() - 0.5) * 0.05);
      const fl = new THREE.Mesh(new THREE.BoxGeometry(w, fh, d), mat(tmpCol.getHex(), 1)); fl.position.y = fh / 2 + f * fh; g.add(fl);
      // window row
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, fh * 0.5, 0.1), emis(0x3a4650, 0.05)); win.position.set(0, fh * 0.55 + f * fh, d / 2 + 0.02); g.add(win);
    }
    // a clutter of stacked shop signboards on the facade (glow at night)
    const boards = ['SAREES', 'SWEETS', 'MOBILES', 'JEWELLERS', 'CLOTH', 'SHOES', 'CHEMIST', 'ELECTRONICS', 'JUICE', 'OPTICALS'];
    const nb = 1 + (rnd() * 2 | 0);
    for (let i = 0; i < nb; i++) {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 44; const c = cv.getContext('2d');
      const bc = [0xe0121a, 0x1a3a8c, 0x1a7a3f, 0xd0902a, 0x8a1f6b][(rnd() * 5) | 0];
      c.fillStyle = '#' + bc.toString(16).padStart(6, '0'); c.fillRect(0, 0, 200, 44); c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 26px Arial'; c.fillText(boards[(rnd() * boards.length) | 0], 100, 31);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, side: THREE.DoubleSide }); lights.push(m);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, 0.9), m); s.position.set((rnd() - 0.5) * w * 0.2, fh * (0.9 + i * 0.5), d / 2 + 0.12); g.add(s);
    }
    g.position.set(x, gy, z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  }
  (function cityCentre() {
    // paved market ground
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(680, 0.15, 240), mat(0x6a6258, 1)); plaza.position.set(0, gh(0, CC_Z) + 0.08, CC_Z); plaza.receiveShadow = true; scene.add(plaza);
    // RAJIV CHOWK metro entrance (where you step out) — canopy, stairs, signage
    const ent = new THREE.Group();
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 8), mat(0x1a3a8c, 0.5)); canopy.position.y = 4; ent.add(canopy);
    for (const ex of [-7, 7]) for (const ez of [-3, 3]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), mat(0xf2e030, 0.6)); c.position.set(ex, 2, ez); ent.add(c); }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 5), mat(0x222)); mouth.position.set(0, 1.5, 0); ent.add(mouth);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 80; const cx = cv.getContext('2d');
    cx.fillStyle = '#1a3a8c'; cx.fillRect(0, 0, 512, 80); cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = 'bold 42px Arial'; cx.fillText('◉ RAJIV CHOWK', 256, 54);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const nm = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2, side: THREE.DoubleSide }); poshLights.push(nm);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.4), nm); board.position.set(0, 5.4, 4.1); ent.add(board);
    ent.position.set(0, gh(0, 470), 470); ent.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(ent);

    // a ghantaghar (clock tower) landmark in the middle of the bazaar
    const ct = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 6), mat(0xb04a3a, 1)); shaft.position.y = 11; ct.add(shaft);
    const top = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 7), mat(0xc25a4a, 1)); top.position.y = 23; ct.add(top);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3, 5, 6), mat(0x8a3a2a)); spire.position.y = 27; ct.add(spire);
    for (const [fx, fz] of [[3.05, 0], [-3.05, 0], [0, 3.05], [0, -3.05]]) { const face = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), emis(0xf2efe4, 0.1)); face.position.set(fx, 22, fz); face.lookAt(fx * 2, 22, fz * 2); ct.add(face); poshLights.push(face.material); }
    ct.position.set(0, gh(0, CC_Z + 20), CC_Z + 20); ct.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(ct);

    // rows of bazaar buildings along two lanes, packed with signboards
    for (let lane = 0; lane < 2; lane++) {
      const lz = CC_Z - 40 + lane * 90;
      for (let x = -320; x <= 320; x += 34) {
        if (Math.abs(x) < 20 && lane === 0) continue; // keep the lane onto the station clear
        bazaarBlock(x + (rnd() - 0.5) * 4, lz, 26 + rnd() * 8, 18 + rnd() * 6, 2 + (rnd() * 3 | 0));
      }
    }
    // a couple of taller towers behind for the skyline
    for (const [tx, th] of [[-260, 70], [250, 84], [120, 60]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(30, th, 30), mat(0x8496a0, 0.4, 0.3)); b.position.set(tx, gh(tx, CC_Z + 90) + th / 2, CC_Z + 90); b.castShadow = true; scene.add(b); const band = new THREE.Mesh(new THREE.BoxGeometry(27, th - 6, 0.2), emis(0xffe6a0, 0)); band.position.set(tx, gh(tx, CC_Z + 90) + th / 2, CC_Z + 90 - 15.1); scene.add(band); poshLights.push(band.material); }

    // signboard stalls facing the central lane — the shops you actually walk past
    const shops = [['SAREE PALACE', 0xe0121a], ['JALEBI · SWEETS', 0xd0902a], ['CHAAT BHANDAR', 0x8a1f6b], ['MOBILE WORLD', 0x1a3a8c], ['JEWELLERS', 0xb08010], ['JUICE CORNER', 0x1a7a3f], ['DHABA', 0xb04a1a], ['CHEMIST', 0x1a7a3f], ['SHOE MART', 0x3a3a6a], ['CHAI POINT', 0xc21f2f]];
    for (let i = 0; i < shops.length; i++) { const x = -300 + i * 66; stall(x, CC_Z + 6, 5.5, 3.2, 4, [0x8a3a2a, 0x2a6a4a, 0x1a3a8c, 0xd0902a][(i % 4)], shops[i][0], shops[i][1]); }
    // fruit/veg thelas lining the lane, plus parked autos & cycle-rickshaws
    for (let i = 0; i < 18; i++) handcart(-320 + rnd() * 640, CC_Z + (rnd() < 0.5 ? -14 : 16));
    for (let i = 0; i < 10; i++) { const a = makeAuto(); a.position.set(-300 + rnd() * 600, gh(0, CC_Z - 28) + 0.05, CC_Z - 28 + (rnd() - 0.5) * 4); a.rotation.y = Math.PI / 2; scene.add(a); }
    for (let i = 0; i < 10; i++) { const r = makeCycleRick(); r.position.set(-300 + rnd() * 600, gh(0, CC_Z + 30) + 0.05, CC_Z + 30 + (rnd() - 0.5) * 4); r.rotation.y = -Math.PI / 2; scene.add(r); }
    // string bulbs + wires over the lane
    for (let i = 0; i < 8; i++) { const bx = -300 + i * 80; const bulb = emis(0xffdca0, 0); lights.push(bulb); const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), bulb); b.position.set(bx, gh(bx, CC_Z) + 5, CC_Z); scene.add(b); }
    // trees + fauna: sacred cows in the lane, dogs, monkeys up on the boards
    for (let i = 0; i < 10; i++) tree(-320 + rnd() * 640, CC_Z + (rnd() < 0.5 ? -30 : 40));
    for (let i = 0; i < 8; i++) cow(-300 + rnd() * 600, CC_Z + (rnd() - 0.5) * 60, false);
    for (let i = 0; i < 16; i++) dog(-320 + rnd() * 640, CC_Z + (rnd() - 0.5) * 90);
    for (let i = 0; i < 14; i++) monkey(-320 + rnd() * 640, gh(0, CC_Z) + 6 + rnd() * 3, CC_Z - 40 + rnd() * 90);
  })();

  // === the rideable Metro journey (a hidden interior "stage" the ride plays in;
  //     the world outside streams past the windows) ===
  const rideRig = new THREE.Group(); rideRig.visible = false; scene.add(rideRig);
  const STAGE = new THREE.Vector3(0, 0, 790);
  const ridePax = [];       // interior passengers (toggled at stops = boarding/alighting)
  const sceneryScroll = [];
  (function buildRideStage() {
    const y0 = 0.3, L = 22, Wd = 3.2, H = 2.5, carC = mat(0xc8ccd0, 0.4, 0.3), glassC = new THREE.MeshStandardMaterial({ color: 0x9ac4d4, transparent: true, opacity: 0.22, roughness: 0.2 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 0.2, Wd), mat(0x556, 0.8)); floor.position.set(STAGE.x, y0, STAGE.z); rideRig.add(floor);
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(L, 0.2, Wd), carC); ceil.position.set(STAGE.x, y0 + H, STAGE.z); rideRig.add(ceil);
    const ceilLight = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.08, 0.5), emis(0xfff4e0, 0.8)); ceilLight.position.set(STAGE.x, y0 + H - 0.15, STAGE.z); rideRig.add(ceilLight);
    for (const zs of [-1, 1]) {
      const zw = STAGE.z + zs * Wd / 2;
      const lower = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.1), carC); lower.position.set(STAGE.x, y0 + 0.45, zw); rideRig.add(lower);
      const win = new THREE.Mesh(new THREE.BoxGeometry(L, 1.0, 0.06), glassC); win.position.set(STAGE.x, y0 + 1.45, zw); rideRig.add(win);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(L, 0.3, 0.1), carC); upper.position.set(STAGE.x, y0 + H - 0.15, zw); rideRig.add(upper);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(L, 0.25, 0.12), mat(0x1a3a8c, 0.4)); stripe.position.set(STAGE.x, y0 + 0.9, zw); rideRig.add(stripe);
    }
    for (const xs of [-1, 1]) { const end = new THREE.Mesh(new THREE.BoxGeometry(0.1, H, Wd), carC); end.position.set(STAGE.x + xs * L / 2, y0 + H / 2, STAGE.z); rideRig.add(end); }
    // grab poles + overhead bars + bench seats
    for (let i = -3; i <= 3; i++) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, H, 6), mat(0xb0b0b0, 0.4, 0.5)); po.position.set(STAGE.x + i * 3, y0 + H / 2, STAGE.z); rideRig.add(po); }
    for (const zs of [-1, 1]) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, L * 0.9, 6), mat(0xb0b0b0, 0.4, 0.5)); bar.rotation.z = Math.PI / 2; bar.position.set(STAGE.x, y0 + H - 0.4, STAGE.z + zs * 0.9); rideRig.add(bar);
      const bench = new THREE.Mesh(new THREE.BoxGeometry(L * 0.86, 0.12, 0.6), mat(0x2a5a7a, 0.5)); bench.position.set(STAGE.x, y0 + 0.5, STAGE.z + zs * (Wd / 2 - 0.4)); rideRig.add(bench); }
    // interior passengers
    for (let i = 0; i < 12; i++) {
      const h = buildHuman(paxDress()); h.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
      const seated = i < 8; const zs = i % 2 ? 1 : -1;
      h.group.position.set(STAGE.x - L / 2 + 1.4 + (i % 6) * 3.4, y0 + (seated ? 0.35 : 0), STAGE.z + zs * (seated ? Wd / 2 - 0.5 : 0.2));
      rideRig.add(h.group); ridePax.push({ h, seated });
    }
    // streaming scenery outside both windows (a passing cityscape)
    for (const zs of [-1, 1]) for (let i = 0; i < 26; i++) {
      const bh = 6 + Math.random() * 26, bx = STAGE.x - 100 + i * 8;
      const b = new THREE.Mesh(new THREE.BoxGeometry(5 + Math.random() * 3, bh, 4), mat([0x8a7a5e, 0x9a8a6a, 0x7a6a54, 0x6a7480, 0xa1583a, 0x8a857c][(Math.random() * 6) | 0], 1));
      b.position.set(bx, bh / 2 - 3, STAGE.z + zs * (Wd / 2 + 5 + Math.random() * 8));
      rideRig.add(b); sceneryScroll.push({ b, baseX: bx });
    }
  })();

  // boarding UI + a keypress to board / alight
  const dhud = document.createElement('div');
  dhud.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);font:600 17px system-ui,Arial;color:#fff;background:rgba(10,20,40,.72);padding:9px 18px;border-radius:10px;pointer-events:none;z-index:50;display:none;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.4)';
  document.body.appendChild(dhud);
  let fPending = false;
  addEventListener('keydown', e => { if (e.code === 'KeyF') fPending = true; });

  // ride state machine
  let riding = false, arrived = false, route = null, legIdx = 0, legPhase = 'move', legT = 0, curStop = '';
  const OUTBOUND = { stops: ['Kashmere Gate', 'Chandni Chowk', 'New Delhi', 'Rajiv Chowk'], dest: new THREE.Vector3(0, 0, 476), destName: 'Rajiv Chowk · City Centre' };
  const INBOUND = { stops: ['New Delhi', 'Chandni Chowk', 'Kashmere Gate', 'Yamuna Vihar'], dest: new THREE.Vector3(0, 0, 52), destName: 'Yamuna Vihar · Basti' };
  const STN_BASTI = new THREE.Vector3(0, 0, 60), STN_CC = new THREE.Vector3(0, 0, 470);
  function near(pos, s, r = 34) { return Math.hypot(pos.x - s.x, pos.z - s.z) < r; }
  function beginRide(r) { riding = true; arrived = false; route = r; legIdx = 0; legPhase = 'move'; legT = 0; curStop = ''; rideRig.visible = true; for (const p of ridePax) p.h.group.visible = true; }
  function endRide(dest) { riding = false; rideRig.visible = false; dest && curPos && curPos.copy(dest); }
  let curPos = null;

  // === traffic ===
  const traffic = new DelhiTraffic(scene);
  const posh = new PoshTraffic(scene);

  // === the people — Gangetic-plain poor everywhere, and the rich across the wall ===
  // A wall-to-wall sea of people — this is a Delhi slum, it should feel more
  // crowded than not. A blanket grid of clusters covers the whole basti so
  // there's never an empty patch, plus dense knots at the market, pumps and
  // places of worship. (Individual meshes, shadows off — see Villagers.)
  const crowd = [];
  // blanket the basti in a grid of mixed-role clusters
  for (let cx = -390; cx <= 390; cx += 90) {
    for (let cz = -330; cz <= 30; cz += 80) {
      const near = Math.abs(cz - MAIN_Z) < 20;
      crowd.push({ role: 'delhi_m', count: 11, x: cx, z: cz, spread: 58 });
      crowd.push({ role: 'delhi_f', count: 9, x: cx + 20, z: cz + 10, spread: 58 });
      crowd.push({ role: 'delhi_kid', count: 13, x: cx - 15, z: cz - 8, spread: 66 });
      if ((cx + cz) % 180 === 0) crowd.push({ role: 'delhi_laborer', count: 8, x: cx, z: cz, spread: 60 });
    }
  }
  const villagers = new Villagers(scene, 'delhislum', gh, [
    ...crowd,
    // the market strip along the road — absolutely packed
    { role: 'delhi_m', count: 60, x: 0, z: 40, spread: 240, idle: 0.35 },
    { role: 'delhi_f', count: 50, x: -40, z: 38, spread: 220, idle: 0.35 },
    { role: 'delhi_vendor', count: 26, x: -60, z: 44, spread: 200, idle: 0.6 },
    { role: 'delhi_kid', count: 44, x: 20, z: 40, spread: 220 },
    { role: 'delhi_laborer', count: 30, x: -140, z: 42, spread: 180, idle: 0.3 },
    // tight knots at the gathering points
    { role: 'delhi_f', count: 26, x: -260, z: -200, spread: 20, idle: 0.5 },  // queue at a hand pump
    { role: 'delhi_f', count: 20, x: 120, z: -120, spread: 18, idle: 0.5 },   // another pump
    { role: 'delhi_m', count: 26, x: -40, z: 44, spread: 14, idle: 0.7 },     // chai adda
    { role: 'delhi_m', count: 30, x: -300, z: -30, spread: 24, idle: 0.5 },   // mandir
    { role: 'delhi_m', count: 30, x: 300, z: -20, spread: 24, idle: 0.5 },    // masjid
    { role: 'delhi_kid', count: 30, x: -200, z: -140, spread: 40 },           // gully cricket
    { role: 'delhi_m', count: 24, x: 40, z: 8, spread: 50, idle: 0.5 },
    // the posh side stays sparse — the emptiness of wealth is the point
    { role: 'delhi_rich', count: 16, x: 140, z: 230, spread: 130, idle: 0.3 },
    { role: 'delhi_rich', count: 12, x: -100, z: 250, spread: 150, idle: 0.3 },
    { role: 'delhi_guard', count: 4, x: 20, z: 90, spread: 10, idle: 0.8 },   // society gate guards
    { role: 'delhi_guard', count: 3, x: 140, z: 226, spread: 30, idle: 0.7 }, // mall security
    // the city-centre bazaar — heaving with shoppers, vendors, commuters
    { role: 'delhi_m', count: 60, x: 0, z: 560, spread: 320, idle: 0.3 },
    { role: 'delhi_f', count: 54, x: 20, z: 560, spread: 320, idle: 0.3 },
    { role: 'delhi_kid', count: 40, x: -20, z: 560, spread: 320 },
    { role: 'delhi_vendor', count: 30, x: 0, z: 566, spread: 300, idle: 0.6 },
    { role: 'delhi_m', count: 44, x: 0, z: 500, spread: 300, idle: 0.35 },
    { role: 'delhi_f', count: 40, x: 40, z: 620, spread: 300, idle: 0.35 },
    { role: 'delhi_rich', count: 24, x: 0, z: 560, spread: 300, idle: 0.3 },
    { role: 'delhi_m', count: 30, x: 0, z: 474, spread: 40, idle: 0.5 },      // pouring out of the station
    { role: 'delhi_laborer', count: 20, x: -120, z: 590, spread: 200, idle: 0.3 },
  ], 1947);

  // Rumal's daily life (economy, family, job, shops, storylines, HUD)
  const life = new DelhiLife(scene, { gh });

  return {
    groundHeight: gh, seaLevel: -9999,
    // keep the walker in the built area (basti + society + the city centre); while
    // riding the Metro the walker is locked in the car
    blocked: (x, z) => riding || z < -348 || z > 700 || Math.abs(x) > 448,
    update(dt, t, nightF, pos) {
      curPos = pos;
      // slum lights are sparse and dim; the society/mall/towers blaze — the
      // inequality is loudest after dark
      const slumGl = 0.1 + nightF * 0.8, poshGl = 0.2 + nightF * 1.9;
      for (const m of lights) m.emissiveIntensity = slumGl;
      for (const m of poshLights) m.emissiveIntensity = poshGl;
      for (const l of lamps) l.intensity = nightF * 1.1;
      metro.update(dt);
      for (const mk of monkeys) { mk.ph += dt; mk.g.position.y = mk.base + Math.sin(mk.ph * 1.5) * 0.05; }
      traffic.update(dt); posh.update(dt); villagers.update(dt);

      // --- the Metro ride / boarding logic ---
      const MOVE = 6, DWELL = 3, SCROLL = 46;
      if (riding) {
        pos.copy(STAGE); pos.x += Math.sin(t * 22) * 0.03;   // stay in the car (tiny sway)
        legT += dt;
        if (!arrived) {
          if (legPhase === 'move') {
            for (const s of sceneryScroll) { s.b.position.x -= SCROLL * dt; if (s.b.position.x < STAGE.x - 104) s.b.position.x += 208; }
            if (legT >= MOVE) { legPhase = 'dwell'; legT = 0; curStop = route.stops[legIdx]; for (const p of ridePax) if (Math.random() < 0.4) p.h.group.visible = Math.random() < 0.7; }
          } else if (legT >= DWELL) { legT = 0; legIdx++; if (legIdx >= route.stops.length) arrived = true; else legPhase = 'move'; }
        }
        if (fPending && arrived && !life.busy) endRide(route.dest);
        if (arrived) dhud.innerHTML = `🏙 <b>${route.destName}</b><br><span style="opacity:.85">press <b>F</b> to get off</span>`;
        else if (legPhase === 'dwell') dhud.innerHTML = `🚇 <b>${curStop}</b> · doors open`;
        else dhud.innerHTML = `🚇 Delhi Metro → <b>${route === OUTBOUND ? 'City Centre' : 'the Basti'}</b><br><span style="opacity:.7">next stop: ${route.stops[legIdx]}</span>`;
        dhud.style.display = 'block';
      } else {
        const atBasti = near(pos, STN_BASTI, 42), atCC = near(pos, STN_CC, 42);
        if (atBasti) {
          if (metro.boardable) { dhud.innerHTML = `🚇 <b>Train at platform</b> — press <b>F</b> to board for the City Centre`; if (fPending && !life.busy) beginRide(OUTBOUND); }
          else dhud.innerHTML = `🚇 <b>Yamuna Vihar</b> Metro · next train in <b>${Math.ceil(metro.etaDwell)}s</b>`;
          dhud.style.display = 'block';
        } else if (atCC) {
          dhud.innerHTML = `🚇 <b>Rajiv Chowk</b> — press <b>F</b> to board for the Basti`;
          if (fPending && !life.busy) beginRide(INBOUND);
          dhud.style.display = 'block';
        } else dhud.style.display = 'none';
      }
      fPending = false;
      life.update(dt, pos, riding);
    },
  };

  // --- chaotic main-road traffic: autos, e-rickshaws, cycle-rickshaws, bikes,
  //     a DTC bus and cars, both directions, jostling in lanes ---
  function DelhiTraffic(scene) {
    const X0 = -490, X1 = 490, span = X1 - X0;
    this.units = [];
    const spec = [['auto', 7], ['erick', 4], ['cyrick', 4], ['bike', 8], ['bus', 2], ['car', 6]];
    let n = 0;
    for (const [kind, c] of spec) for (let i = 0; i < c; i++) {
      const g = kind === 'auto' ? makeAuto() : kind === 'erick' ? makeERick() : kind === 'cyrick' ? makeCycleRick()
        : kind === 'bike' ? makeBike() : kind === 'bus' ? makeBus() : makeCar();
      scene.add(g);
      const dir = (n % 2) ? 1 : -1;
      const lane = dir > 0 ? (2.5 + (n % 2) * 2.6) : -(2.5 + (n % 3) * 2.4);
      this.units.push({ g, dir, lane, x: X0 + ((n++ * 71) % span), spd: (kind === 'bike' ? 10 : kind === 'bus' ? 6 : kind === 'cyrick' ? 4 : 8) + Math.random() * 4 });
    }
    this.update = (dt) => {
      for (const u of this.units) {
        u.x += u.dir * u.spd * dt;
        if (u.x > X1) u.x = X0; else if (u.x < X0) u.x = X1;
        u.g.position.set(u.x, gh(u.x, MAIN_Z) + 0.05, MAIN_Z + u.lane);
        u.g.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    };
  }
  // clean, orderly cars on the society road
  function PoshTraffic(scene) {
    const X0 = -480, X1 = 480, span = X1 - X0;
    this.units = [];
    for (let i = 0; i < 8; i++) { const g = makeCar(i % 3 === 0); scene.add(g); const dir = (i % 2) ? 1 : -1; this.units.push({ g, dir, lane: dir > 0 ? 2.6 : -2.6, x: X0 + ((i * 121) % span), spd: 14 + Math.random() * 6 }); }
    this.update = (dt) => {
      for (const u of this.units) {
        u.x += u.dir * u.spd * dt;
        if (u.x > X1) u.x = X0; else if (u.x < X0) u.x = X1;
        u.g.position.set(u.x, gh(u.x, POSH_ROAD_Z) + 0.05, POSH_ROAD_Z + u.lane);
        u.g.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    };
  }
}

// ---- vehicle meshes ----
function wheel(g, x, y, z, r = 0.34) { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.8 })); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); g.add(w); }
function vmat(c, r = 0.5, m = 0.1) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); }
function makeAuto() {  // green-and-yellow autorickshaw
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 2.4), vmat(0x1a7a3f)); body.position.y = 1.0; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 2.0), vmat(0xf2c010)); top.position.y = 1.75; g.add(top);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 1.1), vmat(0x1a2430, 0.3)); cab.position.set(0, 1.4, 0.5); g.add(cab);
  wheel(g, 0, 0.34, 1.05); wheel(g, -0.7, 0.34, -0.9); wheel(g, 0.7, 0.34, -0.9);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeERick() {  // battery e-rickshaw
  const g = new THREE.Group();
  const c = [0x2a7ac0, 0xc03030, 0x30a060][(Math.random() * 3) | 0];
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 2.2), vmat(c)); roof.position.y = 1.9; g.add(roof);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.2), vmat(c)); seat.position.set(0, 0.9, -0.3); g.add(seat);
  for (const px of [-0.75, 0.75]) { const po = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 5), vmat(0x999)); po.position.set(px, 1.35, -0.5); g.add(po); }
  wheel(g, 0, 0.34, 1.0); wheel(g, -0.7, 0.34, -0.9); wheel(g, 0.7, 0.34, -0.9);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeCycleRick() {  // pedal cycle-rickshaw
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.1), vmat([0xc03030, 0x2a5aa0, 0x2a7a4a][(Math.random() * 3) | 0])); seat.position.set(0, 1.0, -0.4); g.add(seat);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 10, 1, false, 0, Math.PI), vmat(0x111, 0.8)); hood.rotation.z = Math.PI / 2; hood.position.set(0, 1.6, -0.4); g.add(hood);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), vmat(0x333)); bar.position.set(0, 1.0, 0.6); g.add(bar);
  wheel(g, 0, 0.4, 0.9, 0.4); wheel(g, -0.55, 0.4, -0.9, 0.4); wheel(g, 0.55, 0.4, -0.9, 0.4);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeBike() {  // motorbike, often overloaded
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 1.7), vmat([0xc03030, 0x111, 0x1a3a8c, 0x2a2a2a][(Math.random() * 4) | 0])); body.position.y = 0.8; g.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.9), vmat(0x111)); seat.position.set(0, 1.0, -0.2); g.add(seat);
  wheel(g, 0, 0.36, 0.8, 0.36); wheel(g, 0, 0.36, -0.8, 0.36);
  const riders = 1 + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.25 ? 1 : 0);   // whole family sometimes
  for (let i = 0; i < riders; i++) { const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.55, 0.24), vmat([0x3a5a7a, 0xc21f2f, 0xd08010, 0x207040][(Math.random() * 4) | 0], 0.8)); torso.position.set(0, 1.45, 0.2 - i * 0.5); g.add(torso); const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), vmat(i === 0 ? 0x222 : 0x8d5524, 0.8)); head.position.set(0, 1.85, 0.2 - i * 0.5); g.add(head); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeBus() {  // DTC / cluster bus
  const g = new THREE.Group();
  const c = Math.random() < 0.5 ? 0x1a7a3f : 0xd0402a;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 11), vmat(c)); body.position.y = 1.9; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.5, 11), vmat(0xf2e0a0)); stripe.position.y = 1.4; g.add(stripe);
  for (let i = 0; i < 6; i++) { const win = new THREE.Mesh(new THREE.BoxGeometry(2.63, 0.9, 1.2), vmat(0x1a2430, 0.3)); win.position.set(0, 2.5, -4.5 + i * 1.6); g.add(win); }
  wheel(g, -1.15, 0.55, 3.4, 0.6); wheel(g, 1.15, 0.55, 3.4, 0.6); wheel(g, -1.15, 0.55, -3.4, 0.6); wheel(g, 1.15, 0.55, -3.4, 0.6);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
function makeCar(luxury = false) {
  const g = new THREE.Group();
  const c = luxury ? [0xf2f2ea, 0x1a1a1a, 0xb0b4b8, 0x30323a][(Math.random() * 4) | 0]
    : [0xf2f2ea, 0xc03030, 0x1a3a6a, 0x555a60, 0xd0d0c8, 0x6a1030][(Math.random() * 6) | 0];
  const len = luxury ? 4.4 : 3.8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.8, len), vmat(c, 0.35, luxury ? 0.5 : 0.2)); body.position.y = 0.75; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.72, len * 0.55), vmat(c, 0.35, 0.2)); cabin.position.set(0, 1.42, -0.2); g.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.67, 0.6, len * 0.5), vmat(0x1a2430, 0.2)); glass.position.set(0, 1.46, -0.2); g.add(glass);
  wheel(g, -0.85, 0.36, len * 0.32, 0.36); wheel(g, 0.85, 0.36, len * 0.32, 0.36); wheel(g, -0.85, 0.36, -len * 0.32, 0.36); wheel(g, 0.85, 0.36, -len * 0.32, 0.36);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
