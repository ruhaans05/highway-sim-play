import * as THREE from 'three';
import { MAP, wrapS, loopDelta } from './config.js';
import { posAt, headingAt, elevAt, pavedHalfAt, sideFactorAt, buildRibbon } from './road.js';
import { groundY, clampOffRoad, roadClearAt } from './environment.js';
import { makeBike } from './vehicles.js';

const TAU = Math.PI * 2;
// city-street span: the full New Link Road on the india map, the whole
// small loop on the inner-Andheri map
export const M_START = 0, M_END = MAP === 'india' ? 32000 : MAP === 'andheri' ? 24000
  : MAP === 'aundh' ? 28000 : 6000;
// where the packed local streetscape ends and the airport flyover begins
export const ANDHERI_LOCAL_END = 20600;

// ---------------------------------------------------------------------------
// Traffic signals (shared by sim + visuals). Mumbai's New Link Road and
// Manhattan's avenue both run on lights.
// ---------------------------------------------------------------------------
// Signals exist on city streets only: Mumbai's New Link Road (india map)
// and Cincinnati's Vine/Main (midwest map). I-95 is all freeway.
export const SIGNALS = MAP === 'delhikolkata' ? (() => {
  const out = [];
  for (const [a, b, step] of [[0, 35000, 500], [280000, 390000, 720], [505000, 575000, 650], [1460000, 1530000, 520]]) {
    for (let s = a + 450, i = 0; s < b - 300; s += step + ((i * 37) % 180), i++) out.push({ s, offset: (i * 11) % 44 });
  }
  return out;
})() : MAP === 'newdelhi' ? (() => {
  // central Delhi (Lutyens → CP → ITO) is signalised like the real thing —
  // a light every few hundred metres, red-light discipline optional; a few
  // more out along NH-10 through the Haryana towns
  const out = [];
  for (let s = 19400, i = 0; s < 33800; s += 650 + ((i * 41) % 320), i++) {
    out.push({ s, offset: (i * 13) % 44 });
  }
  for (const s of [58800, 63800, 68900, 76300, 87200, 89500]) out.push({ s, offset: ((s / 700) | 0) % 44 });
  return out;
})() : MAP === 'india' ? (() => {
  // one junction roughly every kilometre down the New Link Road
  const out = [];
  for (let s = 600, i = 0; s < 27000; s += 950 + ((i * 37) % 260), i++) {
    out.push({ s, offset: (i * 11) % 44 });
  }
  // Chembur / Sion-Panvel: signalised chaos, a junction every few hundred metres
  for (let s = 27000, i = 0; s < 31900; s += 300 + ((i * 53) % 170), i++) {
    out.push({ s, offset: (i * 7 + 3) % 44 });
  }
  // Pune city: once NH-48 drops off the bypass into Shivajinagar/Swargate the
  // road runs on signals again — a junction every 500-odd metres
  for (let s = 92800, i = 0; s < 96800; s += 480 + ((i * 47) % 260), i++) {
    out.push({ s, offset: (i * 9 + 2) % 44 });
  }
  return out;
})() : MAP === 'aundh' ? [
  // Aundh–Baner Road: the signalised chowks (the stop-signed minor junctions
  // live in pune.js AUNDH_STOPS — keep the two lists apart)
  700, 1600, 2600, 3600, 4400, 5200, 6100, 6900, 7700,       // Aundh Gaon → DP Rd
  8600, 9600, 10600, 11600,                                  // Link Road
  12500, 13400, 14300, 15200, 16100, 17000,                  // Baner Road
  17900, 18800, 19700, 20600,                                // Balewadi High St
  21800, 23200, 24800, 25700, 26600, 27500,                  // Pashan → ITI Rd
].map((s, i) => ({ s, offset: (i * 9 + 3) % 44 }))
: MAP === 'andheri' ? (() => {
  // inner Andheri: a signalised junction every few hundred metres the whole
  // way down the local roads (stops at the airport flyover)
  const out = [];
  for (let s = 480, i = 0; s < 20500; s += 470 + ((i * 53) % 190), i++) {
    out.push({ s, offset: (i * 9 + 4) % 44 });
  }
  return out;
})() : MAP === 'i78' ? [
  // Jersey Avenue at the paired 12th/14th Street Holland approaches. The
  // route builds its own ten-head gantry, so suppress the generic side heads.
  { s: 259420, offset: 18, cycle: 88, green: 54, yellow: 4, visual: false },
  // I-78 ends at the first Manhattan surface intersection after the Holland
  // Tunnel. Mainline traffic queues here while Canal/Varick traffic crosses.
  { s: 267450, offset: 7, cycle: 82, green: 48, yellow: 4 },
] : MAP === 'acx' ? [
  // The ACE terminates at a signalized surface intersection near
  // Baltic/Fairmount and Tanger Outlets; keep this live so traffic queues.
  { s: 95300, offset: 9, cycle: 78, green: 42, yellow: 4 },
] : MAP === 'chester' ? (() => {
  const out = [];
  [700, 2350, 4350, 6100, 8250, 10100, 11900, 14500, 16550, 18900, 21300]
    .forEach((s, i) => out.push({ s, offset: (i * 17 + 5) % 78, cycle: 78, green: 50, yellow: 4 }));
  return out;
})() : MAP === 'us1' ? (() => {
  // Curated Route 1 junctions.  Keeping the names and jughandle flags on the
  // simulation signal makes the visual intersection, the sign and the traffic
  // queue share one source of truth. Adjacent lights use the same offset family
  // to create a northbound green wave instead of unrelated stop/go cycles.
  const junctions = [
    [800,   'Perry St · Trenton',              true],
    [1550,  'Olden Ave',                       true],
    [2350,  'Whitehead Rd',                    true],
    [3650,  'Quakerbridge Rd',                 true],
    [5200,  'I-295 · Bakers Basin Rd',          false],
    [7050,  'Meadow Rd',                       true],
    [8100,  'Washington Rd · Princeton',       true],
    [10150, 'Harrison St · MarketFair',        true],
    [12150, 'Ryders Ln',                       true],
    [13850, 'Milltown Rd',                     true],
    [15350, 'Livingston Ave',                  true],
    [16350, 'George St · New Brunswick',       false],
    [17450, 'Route 18 · Rutgers',              false],
    [19550, 'Plainfield Ave',                  true],
    [21150, 'Route 27 · Edison',               true],
    [23450, 'Parsonage Rd · Menlo Park',       true],
    [25950, 'Gill Ln',                         true],
    [27800, 'Metropark · Wood Ave',            true],
    [48650, 'Tonnele Ave · Route 139',         false],
    [49750, 'Newark Ave · Journal Square',     false],
    [50750, 'Communipaw Ave',                  false],
  ];
  const cycle = 86, green = 58, yellow = 4;
  return junctions.map(([s, name, jughandle], i) => ({
    s, name, jughandle, cycle, green, yellow,
    // Progression follows distance along the corridor; the small district
    // adjustment prevents every separated town from changing simultaneously.
    offset: (cycle - (Math.round(s / 18) % cycle) + Math.floor(s / 7000) * 3) % cycle,
    major: i % 3 === 1 || !jughandle,
  }));
})() : [];   // midwest is all freeway now — no street signals
const CYCLE = 44, GREEN = 20, YELLOW = 3;

// A signal may override the cycle timing (US-1's arterial lights run long greens
// on a longer cycle; Mumbai keeps the short default chaos cycle).
export function signalState(sig, t) {
  const cycle = sig.cycle ?? CYCLE, green = sig.green ?? GREEN, yellow = sig.yellow ?? YELLOW;
  const ph = (t + sig.offset) % cycle;
  if (ph < green) return 'green';
  if (ph < green + yellow) return 'yellow';
  return 'red';
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Dense Indian streets still have different urban grains. Keep the route
// packed, but make the airport edge and inner Andheri frontage feel built-up
// rather than uniformly sampled.
function frontageDensity(s) {
  if (MAP === 'andheri') {
    if (s >= 20800) return 1.35; // CSMIA access / airport frontage
    if (s >= 10500 && s < 20500) return 1.2; // station and commercial core
    return 1.08;
  }
  if (MAP === 'india') {
    if (s < 27000) return 1.36; // New Link Road: wall-to-wall western Mumbai frontage
    if (s < 32000) return 1.05; // Chembur / Sion-Panvel transition
  }
  return 1;
}

function frontageDepth(s) {
  if (MAP === 'andheri') {
    // Older Andheri streets sit almost against the road; the airport edge is
    // a little more open because of flyovers, terminals and compounds.
    return s >= 20800 ? 150 : 105;
  }
  if (MAP === 'india') {
    // Western Mumbai and Chembur are continuous city fabric. Keep only a
    // shallow second layer before the terrain transitions toward Panvel.
    return s < 27000 ? 210 : 145;
  }
  return 440;
}

// ---------------------------------------------------------------------------
// Flyover: elevated deck over the median, concrete pillars — the classic
// "driving under the Metro line" New Link Road feel.
// ---------------------------------------------------------------------------
function deckHeight(s) {
  // rises from grade at the zone edges to full height
  const a = Math.min(1, Math.max(0, (wrapS(s) - (M_START + 40)) / 260));
  const b = Math.min(1, Math.max(0, ((M_END - 40) - wrapS(s)) / 260));
  const t = Math.min(a, b);
  return 4 + 5.8 * (t * t * (3 - 2 * t));
}

function buildFlyover(scene, registry) {
  const conc = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.9, side: THREE.DoubleSide });
  const concDark = new THREE.MeshStandardMaterial({ color: 0x7e7a72, roughness: 0.95, side: THREE.DoubleSide });

  const steps = Math.max(220, Math.ceil((M_END - M_START) / 26));
  const mkStrip = (latA, latB, yFn, mat) => {
    const verts = [], idx = [];
    const va = new THREE.Vector3(), vb = new THREE.Vector3();
    for (let i = 0; i <= steps; i++) {
      const s = M_START + ((M_END - M_START) * i) / steps;
      const h = yFn(s);
      posAt(s, latA, va); posAt(s, latB, vb);
      verts.push(va.x, elevAt(s) + h, va.z, vb.x, elevAt(s) + h, vb.z);
      if (i < steps) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = true;
    scene.add(mesh);
  };
  mkStrip(-7.5, 7.5, s => deckHeight(s), conc);            // deck
  mkStrip(-7.5, -7.5, s => deckHeight(s) + 1.1, concDark); // parapets (vertical via DoubleSide trick)
  mkStrip(7.5, 7.5, s => deckHeight(s) + 1.1, concDark);

  // parapet walls: two thin ribbons slightly inset, vertical faces
  const wall = (lat) => {
    const verts = [], idx = [];
    const v = new THREE.Vector3();
    for (let i = 0; i <= steps; i++) {
      const s = M_START + ((M_END - M_START) * i) / steps;
      posAt(s, lat, v);
      const y = elevAt(s) + deckHeight(s);
      verts.push(v.x, y, v.z, v.x, y + 1.1, v.z);
      if (i < steps) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, concDark));
  };
  wall(-7.4); wall(7.4);

  // Continuous warm marker lamps along the New Link Road divider viaduct.
  // These are separate from the road lamps so the bridge itself never becomes
  // a dark concrete strip at night.
  const bridgeLampMat = new THREE.MeshStandardMaterial({
    color: 0xffd7a0, emissive: 0xffb45c, emissiveIntensity: 0,
  });
  registry.bridgeLightMats = (registry.bridgeLightMats || []).concat(bridgeLampMat);
  const lampGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const lampCount = Math.ceil((M_END - M_START) / 18) * 2 + 2;
  const lamps = new THREE.InstancedMesh(lampGeo, bridgeLampMat, lampCount);
  const lm = new THREE.Matrix4(), lp = new THREE.Vector3();
  let li = 0;
  for (let s = M_START + 8; s < M_END; s += 18) {
    for (const lat of [-6.8, 6.8]) {
      posAt(s, lat, lp); lp.y = elevAt(s) + deckHeight(s) + 1.45;
      lm.setPosition(lp.x, lp.y, lp.z); lamps.setMatrixAt(li++, lm);
    }
  }
  scene.add(lamps);

  // pillars in the median
  const count = Math.floor((M_END - M_START) / 34);
  const pillarGeo = new THREE.BoxGeometry(2.2, 1, 1.4);
  pillarGeo.translate(0, 0.5, 0);
  const pillars = new THREE.InstancedMesh(pillarGeo, conc, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const s = M_START + 20 + i * 34;
    posAt(s, 0, p);
    q.setFromAxisAngle(UP, headingAt(s));
    sc.set(1, deckHeight(s), 1);
    m.compose(p, q, sc);
    pillars.setMatrixAt(i, m);
  }
  pillars.castShadow = true;
  scene.add(pillars);
}

// Western Express Highway-style grade separation on the Andheri inner route:
// short concrete flyovers over the signalised surface road, with columns,
// parapets and their own sodium lights rather than a bare flat carriageway.
function buildWesternExpressFlyovers(scene) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.92 });
  const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x6f706d, roughness: 0.96 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x27231d, emissive: 0xffc56d, emissiveIntensity: 1.5 });
  const deckGeo = new THREE.BoxGeometry(76, 1.15, 10);
  const parapetGeo = new THREE.BoxGeometry(76, 1.0, 0.34);
  const pillarGeo = new THREE.BoxGeometry(1.9, 1, 1.9);
  const lampGeo = new THREE.SphereGeometry(0.26, 8, 6);
  const spans = [3200, 7600, 11600, 15400, 19200, 22000];
  for (const s of spans) {
    const p = posAt(s, 0, new THREE.Vector3());
    const h = elevAt(s);
    const deck = new THREE.Mesh(deckGeo, concrete);
    deck.position.set(p.x, h + 6.4, p.z);
    deck.rotation.y = headingAt(s);
    deck.castShadow = true; deck.receiveShadow = true;
    scene.add(deck);
    for (const z of [-5.15, 5.15]) {
      const wall = new THREE.Mesh(parapetGeo, darkConcrete);
      wall.position.set(p.x, h + 7.25, p.z);
      wall.rotation.y = headingAt(s);
      wall.position.add(new THREE.Vector3(Math.sin(headingAt(s)) * z, 0, Math.cos(headingAt(s)) * -z));
      scene.add(wall);
    }
    for (const lat of [-15, 15]) {
      const pp = posAt(s, lat, new THREE.Vector3());
      const col = new THREE.Mesh(pillarGeo, concrete);
      col.position.set(pp.x, h + 3.15, pp.z);
      col.scale.y = 6.3;
      col.rotation.y = headingAt(s);
      col.castShadow = true;
      scene.add(col);
    }
    // paired lamps on the elevated parapet, visible as warm points after dusk
    for (const lat of [-29, 29]) {
      const lp = posAt(s, lat, new THREE.Vector3());
      const lamp = new THREE.Mesh(lampGeo, lightMat);
      lamp.position.set(lp.x, h + 8.0, lp.z);
      scene.add(lamp);
    }
  }
}

// ---------------------------------------------------------------------------
// Signal posts with live lamps
// ---------------------------------------------------------------------------
const lampOff = new THREE.Color(0x1c1c1c);
const lampColors = { red: 0xff2020, yellow: 0xffb300, green: 0x20e050 };

export function buildSignals(scene) {
  const heads = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 0.6 });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.7 });
  for (const sig of SIGNALS) {
    if (sig.visual === false) continue;
    for (const dir of [1, -1]) {
      // left-hand traffic in Mumbai: signal sits on the travel side
      const side = (dir > 0 ? -1 : 1) * Math.sign(sideFactorAt(sig.s, dir) || 1);
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), poleMat);
      pole.position.y = 2.7;
      g.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.35, 0.3), boxMat);
      head.position.y = 5.2;
      g.add(head);
      const lamps = {};
      ['red', 'yellow', 'green'].forEach((c, i) => {
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x111111, emissive: lampOff, emissiveIntensity: 1 })
        );
        lamp.position.set(0, 5.62 - i * 0.42, 0.14 * -dir * side);
        // face oncoming traffic
        lamp.position.z = 0.17;
        g.add(lamp);
        lamps[c] = lamp.material;
      });
      const sPos = sig.s - dir * 6;
      g.position.copy(posAt(sPos, side * (pavedHalfAt(sPos) + 1.2), new THREE.Vector3()));
      g.rotation.y = headingAt(sPos) + (dir > 0 ? Math.PI : 0);
      scene.add(g);
      heads.push({ sig, lamps });
    }
  }
  return heads;
}

export function updateSignals(heads, t) {
  for (const h of heads) {
    const st = signalState(h.sig, t);
    for (const c of ['red', 'yellow', 'green']) {
      const on = c === st;
      h.lamps[c].emissive.set(on ? lampColors[c] : 0x1c1c1c);
      h.lamps[c].emissiveIntensity = on ? 2.5 : 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Streetscape: weathered midrises, slum patches, hoardings
// ---------------------------------------------------------------------------

// Weathered Indian plaster facade: light wall (instance-tinted), monsoon grime
// streaks, small shuttered windows. Separate emissive map = only windows glow.
function mumbaiFacadeMaterial(seed) {
  const w = 128, h = 256;
  const rand = rng(seed);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const ev = document.createElement('canvas');
  ev.width = w; ev.height = h;
  const eg = ev.getContext('2d');
  g.fillStyle = '#efe6d2';           // near-white warm plaster; tint via instance color
  g.fillRect(0, 0, w, h);
  eg.fillStyle = '#000';
  eg.fillRect(0, 0, w, h);
  // monsoon grime streaks
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    g.fillStyle = `rgba(70,60,45,${0.06 + rand() * 0.14})`;
    g.fillRect(x, 0, 1.5 + rand() * 3, h * (0.35 + rand() * 0.65));
  }
  const cols = 6, rows = 16;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * (w / cols) + 4, py = y * (h / rows) + 3;
      const ww = w / cols - 8, wh = h / rows - 6;
      g.fillStyle = rand() < 0.3 ? '#4a4238' : '#5d5648'; // shutters / dark rooms
      g.fillRect(px, py, ww, wh);
      // window ledge
      g.fillStyle = 'rgba(40,35,25,0.5)';
      g.fillRect(px - 2, py + wh, ww + 4, 2);
      if (rand() < 0.4) { // lit at night — warm tube-light glow
        eg.fillStyle = rand() < 0.75
          ? `rgba(255,205,120,${0.6 + rand() * 0.4})`
          : `rgba(210,235,255,${0.5 + rand() * 0.4})`;
        eg.fillRect(px + 1, py + 1, ww - 2, wh - 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const etex = new THREE.CanvasTexture(ev);
  etex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: etex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.95, color: 0xffffff,
  });
}

// A city this dense does not expose a lawn between the carriageway and the
// first building row.  Keep the geometry deliberately cheap: two continuous
// hardscape ribbons hide the terrain, then instanced property walls, work
// yards and utility poles break the strip into recognisable Mumbai plots.
function buildMumbaiUrbanGround(scene) {
  const footpathMat = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.98 });
  const plotMat = new THREE.MeshStandardMaterial({ color: 0x766f63, roughness: 1 });
  for (const side of [-1, 1]) {
    const curb = s => side * (roadClearAt(s) + 0.15);
    const walk = s => side * (roadClearAt(s) + 3.4);
    const plots = s => side * (roadClearAt(s) + (MAP === 'andheri'
      ? (s >= ANDHERI_LOCAL_END ? 16 : 20) : 24));
    scene.add(new THREE.Mesh(buildRibbon(curb, walk, 0.07, 0.07, 12, M_START, M_END), footpathMat));
    scene.add(new THREE.Mesh(buildRibbon(walk, plots, 0.025, 0.025, 14, M_START, M_END), plotMat));
  }

  const rand = rng(9187);
  const padGeo = new THREE.BoxGeometry(1, 0.12, 1);
  const wallGeo = new THREE.BoxGeometry(1, 1, 0.24); wallGeo.translate(0, 0.5, 0);
  const poleGeo = new THREE.CylinderGeometry(0.11, 0.15, 6.2, 6); poleGeo.translate(0, 3.1, 0);
  const pads = [], walls = [], poles = [], frontage = [];
  for (let s = M_START + 30; s < M_END - 30; s += 14 + rand() * 14) {
    for (const side of [-1, 1]) {
      const clear = roadClearAt(s);
      const airportEdge = MAP === 'andheri' && s >= ANDHERI_LOCAL_END;
      const lat = side * (clear + (airportEdge ? 10 : 13) + rand() * (airportEdge ? 9 : 18));
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat) + 0.06;
      pads.push({ pos, rot: headingAt(s), sx: 11 + rand() * 20, sy: 1, sz: 9 + rand() * 16,
        color: new THREE.Color(rand() < 0.38 ? 0x55575a : rand() < 0.55 ? 0x9a764d : 0x827b70) });
      if (rand() < (airportEdge ? 0.25 : 0.38)) {
        const flat = side * (clear + 5.5 + rand() * 5);
        const fp = posAt(s + 4, flat, new THREE.Vector3()); fp.y = groundY(s + 4, flat);
        frontage.push({ pos: fp, rot: headingAt(s), sx: 6 + rand() * 6, sy: 3 + rand() * 6,
          sz: 9 + rand() * 14,
          color: new THREE.Color(airportEdge ? 0xb0aaa0 : rand() < 0.25 ? 0xb78258 : 0x8e887d) });
      }
      if (rand() < 0.72) {
        const wlat = side * (clear + 5.5 + rand() * 4);
        const wp = posAt(s, wlat, new THREE.Vector3()); wp.y = groundY(s, wlat);
        walls.push({ pos: wp, rot: headingAt(s), sx: 8 + rand() * 18, sy: 1.2 + rand() * 1.6, sz: 1,
          color: new THREE.Color(airportEdge ? 0x8d8a82 : rand() < 0.25 ? 0x8d5e42 : 0x9a927f) });
      }
      if (rand() < 0.46) {
        const plat = side * (clear + 2.7);
        const pp = posAt(s + 8, plat, new THREE.Vector3()); pp.y = groundY(s + 8, plat);
        poles.push({ pos: pp, rot: 0, sx: 1, sy: 1, sz: 1 });
      }
    }
  }
  const place = (list, geo, mat, tint = false) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    list.forEach((b, i) => {
      q.setFromAxisAngle(up, b.rot); sc.set(b.sx, b.sy, b.sz); m.compose(b.pos, q, sc);
      mesh.setMatrixAt(i, m); if (tint) mesh.setColorAt(i, b.color);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  };
  place(pads, padGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), true);
  place(walls, wallGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98 }), true);
  place(frontage, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 }), true);
  place(poles, poleGeo, new THREE.MeshStandardMaterial({ color: 0x4d4b47, roughness: 0.9 }));
}

export function buildMumbaiScape(scene, registry, makeBillboards) {
  const rand = rng(77);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  buildMumbaiUrbanGround(scene);

  // Indian-style building mix: weathered plaster mid-rises with grime streaks,
  // long low chawls, and only the occasional modern glass tower — sprawling
  // deep into the background so the city reads as endless Mumbai
  const plasterMat = mumbaiFacadeMaterial(41);
  registry.towerMats = (registry.towerMats || []).concat(plasterMat);

  // mostly white/gray weathered concrete going moldy in the monsoon,
  // with the odd ochre / faded-pink survivor
  const tints = [0xe8e4da, 0xdcd8ce, 0xd0cec6, 0xc4c2ba, 0xb4b2aa, 0xa4a49c,
                 0xd9c49a, 0xd4a89a, 0xc2884f, 0x9aa89c];
  const blocks = [], chawls = [], towers = [];
  // Mumbai is wall-to-wall built: tight step, almost never a gap, and buildings
  // biased hard toward the road so there's no open ground beside it
  for (let s = M_START; s < M_END; s += 4.4 * (0.6 + rand() * 0.8) / frontageDensity(s)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.012 / frontageDensity(s)) continue;
      const lat = side * (roadClearAt(s) + 4 + Math.pow(rand(), 1.5) * frontageDepth(s));
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const r = rand();
      const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.72 + rand() * 0.35);
      // close/touching the road is Mumbai; ON the road is not
      if (r < 0.30) {
        // chawl: long, low, old — balcony-striped paint
        chawls.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.3,
          sx: 20 + rand() * 22, sy: 7 + rand() * 6, sz: 9 + rand() * 6, color,
        }, s, lat, -1));
      } else if (r < 0.94) {
        // weathered plaster mid-rise
        blocks.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
          sx: 10 + rand() * 16, sz: 10 + rand() * 16,
          sy: 8 + Math.pow(rand(), 1.6) * 44, color,
        }, s, lat, -1));
      } else {
        // the odd new glass tower rising out of the sprawl
        towers.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.4,
          sx: 12 + rand() * 10, sz: 12 + rand() * 10,
          sy: 45 + rand() * 55,
          color: new THREE.Color(0xffffff).multiplyScalar(0.8 + rand() * 0.3),
        }, s, lat, -1));
      }
    }
  }
  // Background carpet: the city does not end behind the first frontage row.
  // Fill the sightline with another pair of staggered residential layers so
  // Mumbai reads like continuous sprawl instead of isolated roadside props.
  for (let s = M_START; s < M_END; s += 13 + rand() * 9) {
    for (const side of [-1, 1]) {
      for (let layer = 0; layer < 3; layer++) {
        const lat = side * (roadClearAt(s) + 72 + layer * 82 + rand() * 42);
        const pos = posAt(s, lat, new THREE.Vector3());
        pos.y = groundY(s, lat);
        const color = new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.65 + rand() * 0.25);
        blocks.push(clampOffRoad({
          pos, rot: headingAt(s) + (rand() - 0.5) * 0.3,
          sx: 18 + rand() * 24, sz: 16 + rand() * 22,
          sy: 9 + Math.pow(rand(), 1.4) * 30, color,
        }, s, lat, -0.5));
      }
    }
  }
  // Dense skyline carpet at the horizon: Mumbai's built fabric continues for
  // kilometres, with towers mixed into chawls rather than ending at a wooded
  // suburban edge.
  for (let s = M_START; s < M_END; s += 25 + rand() * 16) {
    for (const side of [-1, 1]) {
      const lat = side * (roadClearAt(s) + 330 + rand() * 500);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      blocks.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.22,
        sx: 28 + rand() * 38, sz: 25 + rand() * 35,
        sy: 18 + Math.pow(rand(), 1.3) * 78,
        color: new THREE.Color(tints[(rand() * tints.length) | 0]).multiplyScalar(0.58 + rand() * 0.22),
      }, s, lat, -0.5));
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
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    scene.add(mesh);
  };
  place(blocks, plasterMat);
  place(chawls, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.98 }));
  if (registry.towerMats?.[0]) place(towers, registry.towerMats[0]);

  // Indian façade language: repeated balcony slabs, rooftop water tanks and
  // service clutter break up the placeholder-box silhouette of the massing.
  const balconyGeo = new THREE.BoxGeometry(1, 1, 1); balconyGeo.translate(0, 0.5, 0);
  const balconyMat = new THREE.MeshStandardMaterial({ color: 0xaaa49a, roughness: 0.96 });
  const balconyRows = [], tanks = [];
  for (const b of [...blocks, ...chawls]) {
    if (rand() > 0.72) continue;
    const rows = Math.max(1, Math.min(4, Math.floor(b.sy / 9)));
    for (let i = 0; i < rows; i++) {
      balconyRows.push({
        pos: b.pos.clone().setY(b.pos.y + 4.5 + i * Math.max(5.2, b.sy / (rows + 1))),
        rot: b.rot, sx: b.sx * 0.98, sy: 0.22, sz: b.sz * 1.03,
      });
    }
    if (rand() < 0.48) tanks.push({
      pos: b.pos.clone().setY(b.pos.y + b.sy + 1.2), rot: rand() * TAU,
      sx: 1.1 + rand() * 0.7, sy: 1.4 + rand() * 1.2, sz: 1.1 + rand() * 0.7,
    });
  }
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), ds = new THREE.Vector3();
  const detailPlace = (list, geo, mat) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((b, i) => {
      dq.setFromAxisAngle(UP, b.rot); ds.set(b.sx, b.sy, b.sz);
      dm.compose(b.pos, dq, ds); mesh.setMatrixAt(i, dm);
    });
    scene.add(mesh);
  };
  detailPlace(balconyRows, balconyGeo, balconyMat);
  detailPlace(tanks, new THREE.CylinderGeometry(1, 1, 1, 10),
    new THREE.MeshStandardMaterial({ color: 0x263a43, roughness: 0.82, metalness: 0.15 }));

  // slum patches: dense tiny boxes with rust/blue-tarp roofs
  const roofColors = [0x8a6a4a, 0x6b5d50, 0x2a5f9e, 0x9a4030, 0x757a70];
  const shacks = [];
  const nClusters = Math.max(48, Math.round((M_END - M_START) / 92 * (MAP === 'andheri' ? 1.18 : MAP === 'india' ? 1.28 : 1)));
  for (let c = 0; c < nClusters; c++) {
    const cs = M_START + 200 + rand() * (M_END - M_START - 400);
    const cside = rand() < 0.5 ? -1 : 1;
    const clat = cside * (20 + rand() * 90);
    for (let i = 0; i < 46; i++) {
      const s = cs + (rand() - 0.5) * 130;
      const lat = clat + (rand() - 0.5) * 40 * cside;
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      shacks.push(clampOffRoad({
        pos, rot: rand() * TAU,
        sx: 2.5 + rand() * 2, sy: 2.2 + rand() * 1.4, sz: 2.5 + rand() * 2,
        color: new THREE.Color(roofColors[(rand() * roofColors.length) | 0]),
      }, s, lat, -0.5));
    }
  }
  // continuous roadside band: shacks, stalls and lean-tos pressed right up to
  // the shoulder the whole length, so no open space fronts the road
  for (let s = M_START + 30; s < M_END - 30; s += (3.6 + rand() * 3.2) / frontageDensity(s)) {
    for (const side of [-1, 1]) {
      if (rand() < (MAP === 'india' && s < 27000 ? 0.07 : 0.14)) continue;
      const lat = side * (roadClearAt(s) + 1.2 + rand() * 22);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      shacks.push(clampOffRoad({
        pos, rot: headingAt(s) + (rand() - 0.5) * 0.7,
        sx: 2.4 + rand() * 3, sy: 2.2 + rand() * 3.4, sz: 2.4 + rand() * 3,
        color: new THREE.Color(roofColors[(rand() * roofColors.length) | 0]),
      }, s, lat, -0.6));
    }
  }
  const shackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const shackMesh = new THREE.InstancedMesh(boxGeo, shackMat, shacks.length);
  shacks.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx, b.sy, b.sz);
    m.compose(b.pos, q, sc);
    shackMesh.setMatrixAt(i, m);
    shackMesh.setColorAt(i, b.color);
  });
  shackMesh.instanceColor.needsUpdate = true;
  scene.add(shackMesh);

  if (makeBillboards) {
    const n = Math.max(46, Math.round((M_END - M_START) / (MAP === 'india' ? 270 : 360)));
    makeBillboards(scene, registry, 707, M_START + 100, M_END - 100, n, MUMBAI_ADS);
  }

  buildShops(scene, registry, rand);
  buildCrossStreets(scene, rand);
}

// Roadside shop stalls with glowing Devanagari signboards — the bazaar strip
function buildShops(scene, registry, rand) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const stallColors = [0x9a8a6a, 0x7a8a92, 0xa07060, 0x8a9a7a, 0x9a7a8a];
  const stalls = [];
  for (let s = M_START + 80; s < M_END - 80; s += (MAP === 'india' && s < 27000 ? 30 : 40) * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < (MAP === 'india' && s < 27000 ? 0.18 : 0.3)) continue;
      const lat = side * (roadClearAt(s) + 2 + rand() * 4);
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      stalls.push({
        s, lat, side, pos, rot: headingAt(s) + (side > 0 ? -Math.PI / 2 : Math.PI / 2),
        sx: 3.5 + rand() * 2.5, sy: 2.8 + rand() * 1.2, sz: 3 + rand() * 2,
        color: new THREE.Color(stallColors[(rand() * stallColors.length) | 0]),
      });
    }
  }
  const mesh = new THREE.InstancedMesh(boxGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), stalls.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  stalls.forEach((b, i) => {
    q.setFromAxisAngle(UP, b.rot);
    sc.set(b.sx, b.sy, b.sz);
    m.compose(b.pos, q, sc);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, b.color);
  });
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  // glowing signboards: one shared material per ad, planes facing the road
  const signMats = MUMBAI_ADS.map(([text, bg, fg]) => {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 256, 64);
    g.fillStyle = fg; g.textAlign = 'center';
    g.font = 'bold 34px "Helvetica Neue", Arial, "Devanagari Sangam MN", sans-serif';
    g.fillText(text, 128, 44);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.1,
      roughness: 0.6, side: THREE.DoubleSide,
    });
  });
  const signGeo = new THREE.PlaneGeometry(3.4, 0.9);
  stalls.forEach((b, i) => {
    const sign = new THREE.Mesh(signGeo, signMats[i % signMats.length]);
    sign.position.copy(b.pos);
    sign.position.y += b.sy + 0.55;
    sign.rotation.y = b.rot;
    scene.add(sign);
  });
  // register each shared material once for the night-glow pass
  for (const mat of signMats) {
    registry.signs.push({ userData: { board: { material: mat } } });
  }
}

// Cross streets feeding the New Link Road — dark asphalt stubs + lane gaps
function buildCrossStreets(scene, rand) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 1 });
  const geo = new THREE.PlaneGeometry(9, 120);
  geo.rotateX(-Math.PI / 2);
  for (const sig of SIGNALS) {
    if (sig.s < M_START || sig.s > M_END) continue;
    for (const side of [-1, 1]) {
      const lat = side * 75;
      const road = new THREE.Mesh(geo, mat);
      const pos = posAt(sig.s, lat, new THREE.Vector3());
      pos.y = groundY(sig.s, lat) + 0.06;
      road.position.copy(pos);
      road.rotation.y = headingAt(sig.s) + Math.PI / 2;
      scene.add(road);
    }
  }
  // a few extra non-signalized side lanes
  const nSide = Math.max(8, Math.round((M_END - M_START) / 750));
  for (let i = 0; i < nSide; i++) {
    const s = M_START + 300 + rand() * (M_END - M_START - 600);
    const side = rand() < 0.5 ? -1 : 1;
    const road = new THREE.Mesh(geo, mat);
    const pos = posAt(s, side * 70, new THREE.Vector3());
    pos.y = groundY(s, side * 70) + 0.06;
    road.position.copy(pos);
    road.rotation.y = headingAt(s) + Math.PI / 2;
    scene.add(road);
  }
}

export const MUMBAI_ADS = [
  ['अमूल बटर', '#15355e', '#ffd23d'], ['VIMAL', '#0d6b3f', '#fff'],
  ['चाय पॉइंट', '#c8342a', '#fff'], ['MUMBAI METRO', '#005baa', '#fff'],
  ['पान मसाला', '#3d1054', '#ffd23d'], ['DOSA PLAZA', '#d97b1f', '#fff'],
  ['AIRTEL 5G', '#e40000', '#fff'], ['सोना ज्वेलर्स', '#8a6a10', '#fff'],
  ['CUTTING CHAI ₹10', '#111111', '#ffd23d'], ['बॉलीवुड नाइट', '#6b1f8a', '#ffd23d'],
  ['सस्ता बाज़ार SALE', '#c8342a', '#ffd23d'], ['JIO', '#0a2885', '#fff'],
  ['TATA', '#15355e', '#fff'], ['MAHINDRA', '#c8342a', '#fff'],
  ['RELIANCE', '#0a2885', '#ffd23d'], ['मुंबई इंडियन्स', '#005baa', '#ffd23d'],
  ['भाजपा 🪷', '#ff9933', '#0d3a12'], ['शिवसेना उद्धव', '#ff6f00', '#fff'],
];

// ---------------------------------------------------------------------------
// Pedestrians: walking the shoulders, crossing wherever they feel like it
// ---------------------------------------------------------------------------
// merge simple indexed geometries into one, with a per-part vertex tint that
// multiplies under the per-person instance color
function mergeTinted(parts) {
  let vCount = 0, iCount = 0;
  for (const g of parts) { vCount += g.attributes.position.count; iCount += g.index.count; }
  const pos = new Float32Array(vCount * 3);
  const norm = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const idx = new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, vo * 3);
    norm.set(g.attributes.normal.array, vo * 3);
    const t = g.userData.tint;
    for (let i = 0; i < g.attributes.position.count; i++) {
      col.set(t, (vo + i) * 3);
    }
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    io += gi.length; vo += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
function tBox(w, h, d, x, y, z, tint) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  g.userData.tint = tint;
  return g;
}

// proportioned body parts (unit height ~1.72 m, scaled per person):
// torso+arms tinted white (takes the shirt instance color), a hip band that
// reads as the waistline, separate swinging legs, and a head with dark hair
const WHITE = [1, 1, 1];
function pedTorsoGeo() {
  return mergeTinted([
    tBox(0.34, 0.56, 0.19, 0, 1.06, 0, WHITE),          // torso
    tBox(0.30, 0.16, 0.18, 0, 0.70, 0, [0.55, 0.5, 0.48]), // waist
    tBox(0.085, 0.52, 0.11, 0.215, 1.05, 0, WHITE),      // arms (sleeves)
    tBox(0.085, 0.52, 0.11, -0.215, 1.05, 0, WHITE),
    tBox(0.07, 0.10, 0.09, 0.215, 0.74, 0, [0.62, 0.45, 0.34]), // hands (skin-ish)
    tBox(0.07, 0.10, 0.09, -0.215, 0.74, 0, [0.62, 0.45, 0.34]),
  ]);
}
function pedHeadGeo() {
  const head = new THREE.SphereGeometry(0.115, 8, 7);
  head.scale(0.86, 1.06, 0.92);                          // oval face, not a ball
  head.translate(0, 1.52, 0);
  head.userData.tint = WHITE;                            // instance color = skin
  const hair = new THREE.SphereGeometry(0.121, 8, 5, 0, TAU, 0, Math.PI * 0.55);
  hair.scale(0.88, 1.05, 0.94);
  hair.translate(0, 1.525, -0.012);
  hair.userData.tint = [0.16, 0.13, 0.11];               // near-black hair
  const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.09, 6);
  neck.translate(0, 1.38, 0);
  neck.userData.tint = WHITE;
  return mergeTinted([head, hair, neck]);
}
function pedLegGeo() {
  // origin at the hip so the leg swings from the pelvis
  return mergeTinted([
    tBox(0.105, 0.68, 0.13, 0, -0.34, 0, WHITE),         // leg (instance = pants)
    tBox(0.11, 0.07, 0.2, 0, -0.685, 0.035, [0.18, 0.16, 0.15]), // shoe
  ]);
}

// Indian street crowd: mostly lean working-class builds with deep skin tones,
// a sprinkling of heavier, lighter-skinned prosperous types — everything varies
const SKIN_TONES = [
  [0x5c3620, 3], [0x6b4028, 4], [0x7a4c33, 4], [0x8a5c3f, 3],
  [0x9a6a48, 2], [0xa5765a, 1], [0xb98a68, 0.6],
];
const CLOTHES_POOR = [0x9a917e, 0x7a746a, 0x8a8272, 0xb0a890, 0x5c6a5e, 0x6e5a4a, 0xa89a86, 0x8a5b4a];
const CLOTHES_BRIGHT = [0xc8342a, 0xe8b400, 0x0d6b3f, 0x6b1f8a, 0xd97b1f, 0x1f6e8c, 0xc2185b, 0x2e7d5b];
const CLOTHES_RICH = [0xf2f2ee, 0xe8e2d4, 0xcfe0ee, 0xd8c8b8, 0x2b3a55, 0xf2f3f5];
const PANTS = [0x3a3d45, 0x2b2b30, 0x4a3b2a, 0x59616e, 0x6e5a3a, 0x8a8578, 0xd8d4c8];
// European street dress: jeans and jackets in muted tones, the odd loud coat
const EURO_TOPS = [0x2b3a55, 0x1a1a1a, 0x6d6d6d, 0x8a2b2b, 0x3e5c3a, 0xd8d2c8,
  0x3a5f8a, 0x7a4a8a, 0xc9762c, 0x35706e, 0xa8a29a, 0x24303e];
const EURO_PANTS = [0x2b3f63, 0x1e2836, 0x3a3a3a, 0x6b5d4a, 0x24486b, 0x4a4e57];

function pickWeighted(rand, pool) {
  let total = 0;
  for (const [, w] of pool) total += w;
  let x = rand() * total;
  for (const [v, w] of pool) { x -= w; if (x <= 0) return v; }
  return pool[0][0];
}

export class Pedestrians {
  // opts: { s0, s1, mix: {walk, slum, divider} fractions, seed }
  constructor(scene, count = 900, opts = {}) {
    this.count = count;
    this.s0 = opts.s0 ?? M_START;
    this.s1 = opts.s1 ?? M_END;
    this.activity = 1;
    const mix = opts.mix ?? { walk: 0.40, slum: 0.38, divider: 0.22 };
    // offRoad: [min,max] metres — clamps the milling crowd well clear of the
    // carriageway (European sidewalks/plazas, not Indian shoulder-walkers)
    const offRoad = opts.offRoad ?? null;
    const euro = opts.euro === true;
    const rand = rng(opts.seed ?? 4242);
    this.people = [];
    for (let i = 0; i < count; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const s0 = this.s0 + rand() * (this.s1 - this.s0);
      const r = rand();
      const mode = r < mix.walk ? 'walk' : r < mix.walk + mix.slum ? 'slum' : 'divider';
      // body/wealth archetype: most are lean working folk, darker-skinned;
      // some are heavier and lighter-skinned; every dimension jitters
      const rich = rand() < 0.22;
      const female = rand() < 0.52;
      const kid = mode !== 'divider' && rand() < 0.13;
      let h = rich ? 0.97 + rand() * 0.16 : 0.86 + rand() * 0.16;   // height scale
      let w = (rich ? 1.0 + rand() * 0.35 : 0.82 + rand() * 0.2);   // build
      if (kid) { h *= 0.5 + rand() * 0.16; w *= 0.82; }
      this.people.push({
        mode,
        s: s0,
        lat: mode === 'divider'
          // aundh's divider is a 0.9 m sliver of kerb blocks — stand ON it,
          // not out in lane 0 like on Mumbai's wide medians
          ? (rand() < 0.5 ? -1 : 1) * (MAP === 'aundh' ? 0.3 + rand() * 0.45 : 1.0 + rand() * 0.8)
          : mode === 'slum'
            ? side * (offRoad ? offRoad[0] + rand() * (offRoad[1] - offRoad[0]) : 24 + rand() * 34)
          : side * (pavedHalfAt(s0) + 1.2 + rand() * 3.8),   // keep walkers on the shoulder, not in live lanes
        walkDir: rand() < 0.5 ? 1 : -1,
        speed: mode === 'divider' ? 0.15 : mode === 'slum' ? 0.5 + rand() * 0.6
          : (kid ? 1.0 + rand() * 0.8 : 0.8 + rand() * 0.9),
        crossing: false,
        targetLat: 0,
        phase: rand() * TAU,
        h, w, kid,
        crowdSeed: rand(),
        baseSpeed: 0,
        freq: (kid ? 6.2 : 4.6) + rand() * 1.6,
      });
      const pe = this.people[i];
      pe.baseSpeed = pe.speed;
      // a big share of street life just stands around — waiting, watching,
      // chatting in little face-to-face knots outside the shops
      if (mode !== 'divider' && !kid && rand() < 0.34) {
        pe.stand = true;
        pe.speed = 0;
        pe.standYaw = rand() * TAU;
        const prev = this._lastStand;
        if (prev && rand() < 0.55 && Math.abs(prev.s - pe.s) < (this.s1 - this.s0)) {
          // pull into a talking pair/knot with the previous stander
          pe.s = prev.s + 0.55 + rand() * 0.3;
          pe.lat = prev.lat + (rand() - 0.5) * 0.5;
          pe.standYaw = prev.standYaw + Math.PI + (rand() - 0.5) * 0.6;
        }
        this._lastStand = pe;
      }
      // clothes: worn earth tones for the many, saris/kurtas in loud color
      // (women especially), crisp whites and pastels for the prosperous few
      const palette = rich ? CLOTHES_RICH : (female ? (rand() < 0.7 ? CLOTHES_BRIGHT : CLOTHES_POOR)
        : (rand() < 0.25 ? CLOTHES_BRIGHT : CLOTHES_POOR));
      pe.shirt = palette[(rand() * palette.length) | 0];
      // sari/kurta drape: lower body matches the top; else trousers
      pe.pants = (female && rand() < 0.65) ? pe.shirt
        : rich && rand() < 0.5 ? 0x2b3a55
        : PANTS[(rand() * PANTS.length) | 0];
      // skin: weighted to deeper tones; the prosperous skew a shade lighter
      let skin = pickWeighted(rand, SKIN_TONES);
      if (rich && rand() < 0.5) skin = SKIN_TONES[Math.min(6, 4 + (rand() * 3 | 0))][0];
      pe.skin = skin;
      if (euro) {
        // western dress + the full range of skin tones on a European street
        pe.shirt = EURO_TOPS[(rand() * EURO_TOPS.length) | 0];
        pe.pants = EURO_PANTS[(rand() * EURO_PANTS.length) | 0];
        pe.skin = SKIN_TONES[(rand() * SKIN_TONES.length) | 0][0];
      }
    }

    const mkInst = (geo, n) => {
      const m = new THREE.InstancedMesh(geo,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }), n);
      m.frustumCulled = false;
      return m;
    };
    this.torsos = mkInst(pedTorsoGeo(), count);
    this.heads = mkInst(pedHeadGeo(), count);
    this.legsL = mkInst(pedLegGeo(), count);
    this.legsR = mkInst(pedLegGeo(), count);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const pe = this.people[i];
      this.torsos.setColorAt(i, c.setHex(pe.shirt));
      this.heads.setColorAt(i, c.setHex(pe.skin));
      this.legsL.setColorAt(i, c.setHex(pe.pants));
      this.legsR.setColorAt(i, c.setHex(pe.pants));
    }
    for (const m of [this.torsos, this.heads, this.legsL, this.legsR]) {
      m.instanceColor.needsUpdate = true;
      scene.add(m);
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._sc = new THREE.Vector3(1, 1, 1);
    this._p = new THREE.Vector3();
    this._p2 = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._x = new THREE.Vector3(1, 0, 0);
    this._rand = rand;
    this._t = 0;
  }

  update(dt, player, onHit, activity = 1) {
    this._t += dt;
    this.activity = activity;
    const near = Math.abs(loopDelta(player.s, (this.s0 + this.s1) / 2)) < (this.s1 - this.s0) / 2 + 600;
    this.torsos.visible = this.heads.visible = this.legsL.visible = this.legsR.visible = near;
    if (!near) return;

    for (let i = 0; i < this.count; i++) {
      const pe = this.people[i];
      // Casual roadside life expands after work in dry weather and thins
      // during rain. Some walkers become chatting/standing groups; rain can
      // release those groups back into motion or hide them under shelter.
      if (activity > 1.05 && !pe.stand && pe.mode !== 'divider' && !pe.kid && pe.crowdSeed < 0.22) {
        pe.stand = true;
        pe.speed = 0;
        pe.standYaw = pe.phase;
      } else if (activity < 0.75 && pe.stand && pe.crowdSeed < 0.22) {
        pe.stand = false;
        pe.speed = pe.baseSpeed;
      }
      // beyond sight range (city fog closes in well before this): leave the
      // matrices where they are — frees the CPU for much denser crowds
      if (Math.abs(loopDelta(player.s, pe.s)) > 1000) continue;
      if (pe.crossing) {
        const step = Math.sign(pe.targetLat - pe.lat) * 1.25 * dt;
        pe.lat += step;
        if (Math.abs(pe.lat - pe.targetLat) < 0.2) pe.crossing = false;
      } else if (pe.stand) {
        // standing around: shift weight, drift a step now and then
        if (this._rand() < dt * 0.03) pe.standYaw += (this._rand() - 0.5) * 1.2;
        if (this._rand() < dt * 0.015) pe.s += (this._rand() - 0.5) * 0.6;
      } else {
        pe.s += pe.walkDir * pe.speed * dt;
        if (pe.mode === 'slum') {
          // milling around between the shacks
          pe.lat += Math.sin(this._t * 0.35 + pe.phase) * 0.5 * dt;
          if (this._rand() < dt * 0.05) pe.walkDir *= -1;
        } else if (pe.mode === 'divider') {
          // shuffling along the median, occasionally turning around
          if (this._rand() < dt * 0.1) pe.walkDir *= -1;
        } else {
          pe.lat += Math.sin(this._t * 0.6 + pe.phase) * 0.15 * dt;
        }
        if (pe.s > this.s1 - 20) { pe.s = this.s1 - 20; pe.walkDir = -1; }
        if (pe.s < this.s0 + 20) { pe.s = this.s0 + 20; pe.walkDir = 1; }
        // crossing behavior: mostly people wait for a red light and cross
        // there (or work the stopped cars — beggars, sellers); the odd
        // jaywalker still makes a break for it mid-block
        if (this._rand() < dt * 0.6) { // roll a crossing decision ~0.6×/s
          let nearRed = false;
          for (const sig of SIGNALS) {
            const d = Math.abs(loopDelta(pe.s, sig.s));
            if (d < 70 && signalState(sig, this._t) !== 'green') { nearRed = true; break; }
          }
          if (nearRed && pe.mode === 'divider' && this._rand() < 0.4) {
            // beggars/sellers drift out to the stopped traffic
            pe.crossing = true;
            pe.targetLat = Math.sign(pe.lat || 1) * (2.5 + this._rand() * 4);
          } else {
            // Crossings are tied to a red/yellow signal. Keep mid-block
            // jaywalking rare enough that the roadway still reads as traffic,
            // not as a pedestrian plaza.
            const base = pe.mode === 'walk' ? 0.003 : pe.mode === 'divider' ? 0.003 : 0;
            if (nearRed && this._rand() < base * 48) {
              pe.crossing = true;
              pe.targetLat = -Math.sign(pe.lat) * (pavedHalfAt(pe.s) - 0.6 + this._rand() * 2.5);
            }
          }
        }
      }
      posAt(pe.s, pe.lat, this._p);
      // gait: stride swing scaled to how fast this person is moving, with a
      // matched step-bounce; shufflers barely lift their feet
      const moving = pe.crossing ? 1.25 : pe.speed;
      const gait = Math.min(1, moving / 1.3);
      const idle = pe.stand && !pe.crossing;
      const swing = idle
        ? Math.sin(this._t * 0.9 + pe.phase) * 0.05           // weight shift
        : Math.sin(this._t * pe.freq + pe.phase) * 0.55 * gait;
      if (!idle) this._p.y += Math.abs(Math.sin(this._t * pe.freq + pe.phase)) * 0.035 * gait;
      const yaw = idle ? pe.standYaw
        : headingAt(pe.s)
        + (pe.crossing ? Math.sign(pe.targetLat - pe.lat) * Math.PI / 2 : (pe.walkDir > 0 ? 0 : Math.PI));
      this._q.setFromAxisAngle(this._up, yaw);
      const visibleChance = activity >= 1 ? 1 : 0.25 + activity * 0.65;
      this._sc.set(pe.w, pe.h * (pe.crowdSeed < visibleChance ? 1 : 0), pe.w);
      this._m.compose(this._p, this._q, this._sc);
      this.torsos.setMatrixAt(i, this._m);
      this.heads.setMatrixAt(i, this._m);
      // legs hang from the hips and counter-swing
      const hipY = 0.72 * pe.h;
      const hipX = 0.095 * pe.w;
      const sinY = Math.sin(yaw), cosY = Math.cos(yaw);
      for (const side of [-1, 1]) {
        this._p2.set(this._p.x + cosY * side * hipX, this._p.y + hipY, this._p.z - sinY * side * hipX);
        this._q2.setFromAxisAngle(this._x, side > 0 ? swing : -swing);
        this._q2.premultiply(this._q);
        this._m.compose(this._p2, this._q2, this._sc);
        (side > 0 ? this.legsL : this.legsR).setMatrixAt(i, this._m);
      }

      if (Math.abs(loopDelta(player.s, pe.s)) < 2.6 && Math.abs(player.lat - pe.lat) < 1.2 && player.v > 2) {
        onHit && onHit(pe);
        // dive out of the way
        pe.crossing = true;
        pe.targetLat = pe.lat + (pe.lat > player.lat ? 2.5 : -2.5);
      }
    }
    this.torsos.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    this.legsL.instanceMatrix.needsUpdate = true;
    this.legsR.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Metro trains running on the flyover deck overhead
// ---------------------------------------------------------------------------
const METRO_CARS = 4, CAR_LEN = 15;

export function buildMetro(scene) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b6fb5, roughness: 0.35, metalness: 0.4 });
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xcfe4ff, emissive: 0xbfd9ff, emissiveIntensity: 0.8, roughness: 0.2,
  });
  const trains = [];
  for (const [dir, side, offset] of [[1, 3.2, 0], [-1, -3.2, 2600]]) {
    const cars = [];
    for (let i = 0; i < METRO_CARS; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.1, CAR_LEN - 1.2), bodyMat);
      body.position.y = 1.55;
      g.add(body);
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.9, CAR_LEN - 2.4), winMat);
      win.position.y = 2.1;
      g.add(win);
      scene.add(g);
      cars.push(g);
    }
    trains.push({ cars, dir, side, offset, speed: 19 });
  }
  return trains;
}

export function updateMetro(trains, t) {
  const s0 = M_START + 320, s1 = M_END - 320;
  const span = s1 - s0;
  const v = new THREE.Vector3();
  for (const tr of trains) {
    const head = ((tr.offset + t * tr.speed) % span + span) % span;
    for (let i = 0; i < tr.cars.length; i++) {
      let p = head - i * CAR_LEN;
      p = ((p % span) + span) % span;
      const s = tr.dir > 0 ? s0 + p : s1 - p;
      posAt(s, tr.side, v);
      v.y = elevAt(s) + deckHeight(s) + 0.4;
      tr.cars[i].position.copy(v);
      tr.cars[i].rotation.y = headingAt(s) + (tr.dir > 0 ? 0 : Math.PI);
    }
  }
}

// ---------------------------------------------------------------------------
// Wrong-way two-wheelers hugging the shoulder against traffic — peak Mumbai
// ---------------------------------------------------------------------------
export class WrongWayRiders {
  constructor(scene, count = 4) {
    this.riders = [];
    const rand = rng(31337);
    for (let i = 0; i < count; i++) {
      const group = makeBike(rand);
      scene.add(group);
      this.riders.push({
        group,
        s: M_START + 300 + rand() * (M_END - M_START - 600),
        side: rand() < 0.5 ? 1 : -1, // which carriageway's shoulder
        v: 6 + rand() * 3,
      });
    }
  }

  update(dt, player, onHit) {
    for (const r of this.riders) {
      // ride against the flow: on the lat>0 side (dir +1 in LHT) head toward -s
      r.s += (r.side > 0 ? -1 : 1) * r.v * dt;
      if (r.s < M_START + 120) r.s = M_END - 120;
      if (r.s > M_END - 120) r.s = M_START + 120;
      const lat = r.side * (pavedHalfAt(r.s) - 1.1);
      posAt(r.s, lat, r.group.position);
      r.group.rotation.y = headingAt(r.s) + (r.side > 0 ? Math.PI : 0);
      if (player && Math.abs(loopDelta(player.s, r.s)) < 2.4
          && Math.abs(player.lat - lat) < 1.2 && player.v > 2) {
        onHit && onHit(r);
        r.s += (r.side > 0 ? -1 : 1) * 8; // knocked ahead, keeps going
      }
    }
  }
}

export function buildMumbai(scene, registry, makeBillboards) {
  // the Metro line rides the New Link Road median; inner Andheri has none
  if (MAP === 'india') buildFlyover(scene, registry);
  if (MAP === 'andheri') buildWesternExpressFlyovers(scene);
  buildMumbaiScape(scene, registry, makeBillboards);
  return buildSignals(scene);
}
