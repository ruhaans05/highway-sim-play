import * as THREE from 'three';
import { posAt, headingAt } from './road.js';
import {
  groundY, roadClearAt, buildTrees, scatterInstanced, facadeTexture,
} from './environment.js';
import {
  gantry, textBoard, buildTollPlaza, skyline, water,
} from './turnpike.js';
import { buildWindFarm } from './midwest.js';

// The three European motorway maps:
//   a1 — Portugal: A1 Autoestrada do Norte (E1), Lisboa → Porto
//   a4 — Spain: A-4 Autovía del Sur (E-5), Madrid → Córdoba → Sevilla
//   a3 — Germany: A3 (E35), Frankfurt → Köln
// Everything visual that makes each run read as ITS country lives here:
// portagens and Via Verde, La Mancha windmills and Osborne bulls, the ICE
// line beside the A3 and the Dom at the end of it.

const TAU = Math.PI * 2;
const EU_BLUE = '#0d4f9e';

function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Overhead guide gantry, blue EU boards facing both directions.
function jn(scene, registry, s, lines, bg = EU_BLUE) {
  const a = textBoard(lines, 7, 3.4, bg, '#fff');
  const b = textBoard(lines, 7, 3.4, bg, '#fff');
  b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 6.8);
}

// Solid roadside tree wall (same recipe as the GSP's).
function forestBand(scene, seed, s0, s1, tight = 6, pineBias = false) {
  buildTrees(scene, seed,     s0, s1, 6,  tight,     tight + 22, 0, pineBias);
  buildTrees(scene, seed + 1, s0, s1, 7,  tight + 2, tight + 26, 0, true);
  buildTrees(scene, seed + 2, s0, s1, 8,  tight + 8, 70, 0, pineBias);
  buildTrees(scene, seed + 3, s0, s1, 10, 55, 220, 0, pineBias);
  buildTrees(scene, seed + 4, s0, s1, 13, 90, 340, 0, true);
}

// Orange European SOS emergency phone posts, both shoulders, ~2 km apart.
function sosPosts(scene, s0, s1) {
  const postGeo = new THREE.BoxGeometry(0.5, 1.5, 0.35); postGeo.translate(0, 0.95, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xe8641b, roughness: 0.6 });
  const places = [];
  for (let s = s0 + 900; s < s1; s += 2000) {
    for (const side of [-1, 1]) {
      const lat = side * (roadClearAt(s) + 2.2);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      places.push({ pos, rot: headingAt(s), sx: 1, sy: 1, sz: 1 });
    }
  }
  scatterInstanced(scene, postGeo, postMat, places, { shadow: false });
}

// European reflector bollards are a constant part of the motorway view and
// vary subtly by country. They make rural sections read as Europe even when no
// landmark or guide sign is currently visible.
function delineatorPosts(scene, s0, s1, style = 'eu') {
  const bodyGeo = new THREE.BoxGeometry(0.22, 1.05, 0.16); bodyGeo.translate(0, 0.53, 0);
  const panelGeo = new THREE.BoxGeometry(0.25, 0.24, 0.175); panelGeo.translate(0, 0.78, 0);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f0e9, roughness: 0.82 });
  const panelColor = style === 'italy' ? 0x111216 : style === 'france' ? 0x25282c : 0x17191c;
  const panelMat = new THREE.MeshStandardMaterial({ color: panelColor, roughness: 0.5 });
  const bodies = [], panels = [];
  const spacing = style === 'germany' || style === 'swiss' ? 150 : 200;
  for (let s = s0 + 120; s < s1; s += spacing) {
    for (const side of [-1, 1]) {
      const lat = side * (roadClearAt(s) + 1.35);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      const place = { pos, rot: headingAt(s), sx: 1, sy: 1, sz: 1 };
      bodies.push(place); panels.push(place);
    }
  }
  scatterInstanced(scene, bodyGeo, bodyMat, bodies, { shadow: false });
  scatterInstanced(scene, panelGeo, panelMat, panels, { shadow: false });
}

// Transparent/green urban motorway sound walls, placed only where nearby
// housing warrants them. Short repeated bays follow the centerline cleanly.
function noiseBarriers(scene, spans, color = 0x81908f) {
  const geo = new THREE.BoxGeometry(18, 3.2, 0.18); geo.translate(0, 1.6, 0);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0.15, transparent: true, opacity: 0.72,
  });
  const places = [];
  for (const [s0, s1, side] of spans) {
    for (let s = s0; s < s1; s += 18) {
      const lat = side * (roadClearAt(s) + 1.9);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      places.push({ pos, rot: headingAt(s), sx: 1, sy: 1, sz: 1 });
    }
  }
  scatterInstanced(scene, geo, mat, places, { shadow: false });
}

// A broad still-water plane set off to one side of the road (estuaries, rias).
function sideWater(scene, s0, s1, latCenter, width) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b5570, roughness: 0.22, metalness: 0.4 });
  for (let s = s0; s < s1; s += 700) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, 760), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(posAt(s + 350, latCenter, new THREE.Vector3()));
    mesh.position.y = -1.6;
    mesh.rotation.z = -headingAt(s + 350);
    scene.add(mesh);
  }
}

// Fuel + food service area with a branded totem (Galp orange-green, Repsol
// orange, Aral blue — close-enough colors, no trademarks rendered as logos).
function serviceArea(scene, registry, s, name, brandBg) {
  const conc = new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.25, metalness: 0.5 });
  const g = new THREE.Group();
  const shop = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 12), glass); shop.position.set(0, 2.5, -6); g.add(shop);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(20, 0.8, 14), conc); roof.position.set(0, 5.4, -6); g.add(roof);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 9), conc); canopy.position.set(0, 5, 8); g.add(canopy);
  for (const dx of [-6, 0, 6]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), conc);
    col.position.set(dx, 2.5, 8); g.add(col);
  }
  const totem = textBoard([name, '⛽ 24h'], 5.4, 3.2, brandBg, '#fff');
  totem.position.set(0, 9.5, 2);
  g.add(totem);
  registry.signs.push({ userData: { board: totem } });
  const lat = -(roadClearAt(s) + 26);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s);
  scene.add(g);
}


/* ================= European building fabric (shared) ================= */
// Instanced low-rise European city: 3–7 story pastel/stucco blocks under
// hipped terracotta roofs (Iberia) or gray slate (Germany) — dense, street-
// aligned, and low. Nothing like American strip-mall sprawl.
const IBERIA_WALLS = [0xf2ede0, 0xe8dcc4, 0xf5efe2, 0xead9b8, 0xf2d98c, 0xd8e4ea, 0xe8c4b8, 0xe0cba6];
const IBERIA_ROOFS = [0xa8502e, 0x9c4a2c, 0xb05c36];
const GERMAN_WALLS = [0xe8e2d4, 0xd8d2c2, 0xcfc5b2, 0xc9b9a0, 0xbfb9ad, 0xd9cfc0];
const GERMAN_ROOFS = [0x3a3f46, 0x464038, 0x53483c];
// London: brown-brick terraces and mansion blocks under slate
const LONDON_WALLS = [0x8a5a44, 0x9a6a50, 0x7a4a38, 0xb08968, 0xd8d2c8, 0xa87a5c, 0x6e4534];
const LONDON_ROOFS = [0x3a3f46, 0x4a443c, 0x50555c];
// Paris: uniform Haussmann cream limestone under blue-grey zinc
const PARIS_WALLS = [0xe8dcc4, 0xe2d6bc, 0xeee2ca, 0xd8ccb4, 0xe5dac0];
const PARIS_ROOFS = [0x6a7076, 0x5d646c, 0x757c84];
// French provincial: pale render, slate and tile mixed
const FRANCE_WALLS = [0xe8e0cc, 0xd8d0bc, 0xc9c2b0, 0xb8ab90, 0xe2d8c2];
const FRANCE_ROOFS = [0x4a4f56, 0x8a5038, 0x3a3f46];
// Italy: Roman ochre, burnt sienna and faded terracotta render
const ITALIA_WALLS = [0xd9a662, 0xc98a4b, 0xe8c69a, 0xb85c3a, 0xe2d0ae, 0xa8683e, 0xd9b98a];
const ITALIA_ROOFS = [0xa8502e, 0x9c4a2c, 0x8f4226];
// Switzerland: pale Mittelland stucco and cream Altstadt stone mixed with the
// warm timber browns of the Oberland chalets, under dark shingle / grey slate
const SWISS_WALLS = [0xf0ead8, 0xe6dcc6, 0xd8c8a8, 0xc9a878, 0xbfa082, 0xe2d6bc, 0xa87848, 0xd0b98a];
const SWISS_ROOFS = [0x4a4038, 0x3a3a3e, 0x5a4a3a, 0x6b4a30, 0x45484c];
function stylePalette(style) {
  switch (style) {
    case 'german': return [GERMAN_WALLS, GERMAN_ROOFS];
    case 'london': return [LONDON_WALLS, LONDON_ROOFS];
    case 'paris':  return [PARIS_WALLS, PARIS_ROOFS];
    case 'france': return [FRANCE_WALLS, FRANCE_ROOFS];
    case 'italia': return [ITALIA_WALLS, ITALIA_ROOFS];
    case 'swiss':  return [SWISS_WALLS, SWISS_ROOFS];
    default:       return [IBERIA_WALLS, IBERIA_ROOFS];
  }
}

let _roofGeo = null;
function hipRoofGeo() {
  if (!_roofGeo) {
    _roofGeo = new THREE.ConeGeometry(0.72, 1, 4);
    _roofGeo.rotateY(Math.PI / 4);
    _roofGeo.translate(0, 0.5, 0);
  }
  return _roofGeo;
}
const _cityBodyGeo = new THREE.BoxGeometry(1, 1, 1);
_cityBodyGeo.translate(0, 0.5, 0);
const _whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
// Body material for European buildings: keeps the per-instance pastel wall
// colour by day, but carries a SPARSE low-rise window emissive map so a few
// windows glow warm at night — a lived-in house, not a blazing skyscraper.
// emissiveIntensity is ramped by the day/night loop (registry.euroLit). Roofs
// stay on the plain white mat.
function euroWindowTexture() {
  const w = 64, h = 80;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#090b0f'; g.fillRect(0, 0, w, h);   // dark field = no emission
  const rand = rng(88);
  const cols = 3, rows = 4, cw = w / cols, ch = h / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rand() < 0.4;                       // only some windows on
      if (lit) {
        const warm = rand() < 0.85;
        g.fillStyle = warm
          ? `rgba(255,205,128,${0.7 + 0.3 * rand()})`
          : `rgba(198,220,255,${0.6 + 0.3 * rand()})`;
      } else {
        g.fillStyle = '#14171d';                       // unlit window: nearly black
      }
      g.fillRect(x * cw + cw * 0.28, y * ch + ch * 0.22, cw * 0.44, ch * 0.44);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export const euroLitMat = new THREE.MeshStandardMaterial({
  color: 0xffffff, roughness: 0.88,
  emissive: 0xffffff, emissiveMap: euroWindowTexture(), emissiveIntensity: 0,
});

// Named-city morphology. The common instancing path remains fast, but each
// metro gets its real broad character instead of the same boxes with a new
// palette: narrow Atlantic blocks, Castilian superblocks, terraces, uniform
// Haussmann streets, irregular Italian fabric and lower Swiss lake cities.
const CITY_MORPH = {
  811: { step: [18, 30], rows: [5, 8], setback: 15, rowGap: [20, 29], w: [8, 18], d: [9, 17], h: [8, 22], aligned: .72, flat: .16, side: [1, .72] }, // Lisboa
  815: { step: [24, 38], rows: [4, 7], setback: 22, rowGap: [24, 34], w: [9, 18], d: [8, 15], h: [6, 15], aligned: .68, flat: .08 }, // Coimbra
  816: { step: [30, 46], rows: [3, 6], setback: 28, rowGap: [30, 43], w: [12, 24], d: [9, 17], h: [5, 12], aligned: .82, flat: .14 }, // Aveiro
  817: { step: [22, 34], rows: [5, 8], setback: 18, rowGap: [22, 32], w: [11, 24], d: [10, 20], h: [8, 19], aligned: .8, flat: .28 }, // Gaia
  818: { step: [16, 27], rows: [6, 9], setback: 14, rowGap: [18, 27], w: [7, 15], d: [10, 19], h: [9, 23], aligned: .58, flat: .1 }, // Porto
  911: { step: [22, 34], rows: [6, 10], setback: 18, rowGap: [24, 34], w: [18, 34], d: [15, 27], h: [12, 29], aligned: .94, flat: .62, core: 8 }, // Madrid
  914: { step: [25, 40], rows: [4, 7], setback: 24, rowGap: [23, 34], w: [10, 21], d: [9, 17], h: [6, 14], aligned: .7, flat: .22 }, // Córdoba
  915: { step: [20, 33], rows: [5, 8], setback: 19, rowGap: [21, 31], w: [10, 23], d: [10, 20], h: [7, 18], aligned: .76, flat: .32 }, // Sevilla
  1011: { step: [22, 35], rows: [5, 8], setback: 24, rowGap: [29, 42], w: [15, 31], d: [13, 25], h: [10, 28], aligned: .9, flat: .55, core: 9 }, // Frankfurt
  1014: { step: [28, 42], rows: [4, 6], setback: 30, rowGap: [32, 46], w: [12, 24], d: [10, 19], h: [7, 17], aligned: .91, flat: .24 }, // Siegburg/Bonn
  1015: { step: [21, 34], rows: [5, 8], setback: 22, rowGap: [26, 38], w: [14, 29], d: [12, 24], h: [10, 25], aligned: .88, flat: .46 }, // Köln
  3011: { step: [19, 32], rows: [5, 8], setback: 17, rowGap: [21, 31], w: [10, 23], d: [15, 29], h: [7, 19], aligned: .86, flat: .34 }, // Birmingham
  3016: { step: [22, 34], rows: [5, 8], setback: 13, rowGap: [17, 25], w: [7, 15], d: [17, 30], h: [8, 22], aligned: .97, flat: .12, core: 7 }, // London terraces
  3514: { step: [25, 39], rows: [4, 7], setback: 25, rowGap: [27, 38], w: [11, 24], d: [10, 20], h: [7, 17], aligned: .85, flat: .18 }, // Amiens
  3516: { step: [22, 34], rows: [5, 8], setback: 15, rowGap: [19, 28], w: [18, 34], d: [14, 25], h: [15, 28], aligned: .98, flat: .06, core: 5 }, // Paris
  4011: { step: [18, 31], rows: [5, 9], setback: 16, rowGap: [20, 30], w: [10, 24], d: [10, 22], h: [8, 23], aligned: .52, flat: .38, side: [.78, 1] }, // Roma
  4016: { step: [19, 31], rows: [5, 9], setback: 13, rowGap: [17, 27], w: [8, 22], d: [9, 22], h: [9, 27], aligned: .42, flat: .56, core: 5 }, // Napoli
  5015: { step: [29, 45], rows: [3, 6], setback: 34, rowGap: [36, 52], w: [11, 23], d: [9, 19], h: [5, 14], aligned: .78, flat: .08, side: [.7, 1] }, // Luzern
  5017: { step: [22, 36], rows: [5, 8], setback: 27, rowGap: [29, 43], w: [13, 28], d: [11, 23], h: [8, 23], aligned: .91, flat: .42, core: 5 }, // Zürich
  5020: { step: [26, 40], rows: [4, 7], setback: 29, rowGap: [31, 45], w: [12, 25], d: [10, 21], h: [7, 18], aligned: .84, flat: .18 }, // Bern
  5022: { step: [23, 37], rows: [5, 8], setback: 23, rowGap: [27, 40], w: [11, 25], d: [10, 22], h: [8, 22], aligned: .79, flat: .28, side: [.72, 1] }, // Lausanne
  5023: { step: [24, 38], rows: [5, 8], setback: 20, rowGap: [24, 36], w: [13, 29], d: [11, 23], h: [9, 24], aligned: .9, flat: .4, side: [.68, 1] }, // Genève
};

function euroCity(scene, s0, s1, style, seed, density = 1) {
  const rand = rng(seed);
  const [walls, roofsC] = stylePalette(style);
  const m = CITY_MORPH[seed] ?? {
    step: [26, 44], rows: [4, 8], setback: 20, rowGap: [28, 40],
    w: [12, 26], d: [10, 20], h: [9, 21], aligned: .75, flat: .08,
  };
  const bodies = [], roofs = [];
  for (let s = s0; s < s1; s += m.step[0] + rand() * (m.step[1] - m.step[0])) {
    const t = (s - s0) / Math.max(1, s1 - s0);
    for (const [sideIndex, side] of [-1, 1].entries()) {
      const sideScale = m.side?.[sideIndex] ?? 1;
      const rows = Math.max(2, Math.round((m.rows[0] + rand() * (m.rows[1] - m.rows[0])) * density * sideScale));
      for (let r = 0; r < rows; r++) {
        const rowGap = m.rowGap[0] + rand() * (m.rowGap[1] - m.rowGap[0]);
        const lat = side * (roadClearAt(s) + m.setback + r * rowGap + rand() * rowGap * .28);
        const pos = posAt(s + (rand() - 0.5) * m.step[1] * .7, lat, new THREE.Vector3());
        pos.y = groundY(s, lat);
        const w = m.w[0] + rand() * (m.w[1] - m.w[0]);
        const d = m.d[0] + rand() * (m.d[1] - m.d[0]);
        const h = m.h[0] + rand() * (m.h[1] - m.h[0]) + (m.core ?? 0) * Math.sin(Math.PI * t);
        const rot = headingAt(s) + (rand() < m.aligned ? 0 : (rand() - 0.5) * .7);
        bodies.push({ pos, rot, sx: w, sy: h, sz: d, color: new THREE.Color(walls[(rand() * walls.length) | 0]) });
        if (rand() >= m.flat) {
          roofs.push({
            pos: pos.clone().setY(pos.y + h), rot,
            sx: w * 1.45, sy: 2.4 + rand() * 2.4, sz: d * 1.45,
            color: new THREE.Color(roofsC[(rand() * roofsC.length) | 0]),
          });
        }
      }
    }
  }
  scatterInstanced(scene, _cityBodyGeo, euroLitMat, bodies);
  scatterInstanced(scene, hipRoofGeo(), _whiteMat, roofs, { shadow: false });
}

// A town: a tighter, lower band of houses with a church — Santarém, Getafe,
// Limburg scale. Same fabric, two stories.
function euroTown(scene, s0, s1, style, seed) {
  const rand = rng(seed);
  const [walls, roofsC] = stylePalette(style);
  const form = {
    german: { step: [25, 39], rows: [3, 6], gap: [28, 40], w: [10, 20], d: [9, 17], h: [5, 10], align: .9 },
    london: { step: [14, 25], rows: [4, 7], gap: [17, 25], w: [6, 13], d: [14, 25], h: [5, 11], align: .96 },
    paris:  { step: [18, 29], rows: [4, 7], gap: [21, 30], w: [13, 25], d: [11, 20], h: [8, 15], align: .96 },
    france: { step: [22, 35], rows: [3, 6], gap: [24, 36], w: [9, 18], d: [8, 16], h: [5, 10], align: .84 },
    italia: { step: [17, 30], rows: [4, 7], gap: [19, 29], w: [8, 17], d: [8, 16], h: [5, 12], align: .58 },
    swiss:  { step: [27, 43], rows: [3, 5], gap: [32, 48], w: [10, 21], d: [9, 18], h: [4, 9], align: .82 },
    iberia: { step: [18, 32], rows: [3, 6], gap: [21, 32], w: [8, 17], d: [7, 15], h: [5, 10], align: .72 },
  }[style] ?? { step: [18, 32], rows: [3, 6], gap: [20, 30], w: [8, 16], d: [7, 13], h: [4.5, 8.5], align: .8 };
  // Seeded compactness keeps adjacent towns from becoming cloned bands.
  const spread = .86 + (seed % 5) * .07;
  const bodies = [], roofs = [];
  for (let s = s0; s < s1; s += (form.step[0] + rand() * (form.step[1] - form.step[0])) * spread) {
    for (const side of [-1, 1]) {
      const rows = form.rows[0] + Math.floor(rand() * (form.rows[1] - form.rows[0] + 1));
      for (let r = 0; r < rows; r++) {
        const gap = form.gap[0] + rand() * (form.gap[1] - form.gap[0]);
        const lat = side * (roadClearAt(s) + 24 + r * gap + rand() * gap * .3);
        const pos = posAt(s + (rand() - 0.5) * 16, lat, new THREE.Vector3());
        pos.y = groundY(s, lat);
        const w = form.w[0] + rand() * (form.w[1] - form.w[0]);
        const d = form.d[0] + rand() * (form.d[1] - form.d[0]);
        const h = form.h[0] + rand() * (form.h[1] - form.h[0]);
        const rot = headingAt(s) + (rand() < form.align ? 0 : (rand() - 0.5) * .65);
        bodies.push({ pos, rot, sx: w, sy: h, sz: d, color: new THREE.Color(walls[(rand() * walls.length) | 0]) });
        roofs.push({
          pos: pos.clone().setY(pos.y + h), rot,
          sx: w * 1.45, sy: 2.2 + rand() * 1.8, sz: d * 1.45,
          color: new THREE.Color(roofsC[(rand() * roofsC.length) | 0]),
        });
      }
    }
  }
  scatterInstanced(scene, _cityBodyGeo, euroLitMat, bodies);
  scatterInstanced(scene, hipRoofGeo(), _whiteMat, roofs, { shadow: false });
  churchTower(scene, (s0 + s1) / 2, (rand() < 0.5 ? -1 : 1), style);
}

// A village: 25–45 houses CLUSTERED around a church tower on one side of the
// road — the aldeia / pueblo / Dorf you pass every few kilometres in Europe,
// not a continuous carpet.
function euroVillage(scene, s, side, style, seed, opts = {}) {
  const rand = rng(seed);
  const [walls, roofsC] = stylePalette(style);
  const { latMin = 90, latMax = 220, yLift = 0 } = opts;
  const centerLat = side * (roadClearAt(s) + latMin + rand() * (latMax - latMin));
  const bodies = [], roofs = [];
  const n = 25 + Math.floor(rand() * 20);
  for (let i = 0; i < n; i++) {
    const ds = (rand() - 0.5) * 220, dlat = (rand() - 0.5) * 150;
    const lat = centerLat + dlat;
    if (Math.abs(lat) < roadClearAt(s) + 22) continue;
    const pos = posAt(s + ds, lat, new THREE.Vector3());
    pos.y = groundY(s + ds, lat) + yLift;
    const w = 6.5 + rand() * 6, d = 6 + rand() * 5, h = 3.6 + rand() * 3;
    const rot = rand() * TAU;
    bodies.push({ pos, rot, sx: w, sy: h, sz: d, color: new THREE.Color(walls[(rand() * walls.length) | 0]) });
    roofs.push({
      pos: pos.clone().setY(pos.y + h), rot,
      sx: w * 1.45, sy: 2 + rand() * 1.6, sz: d * 1.45,
      color: new THREE.Color(roofsC[(rand() * roofsC.length) | 0]),
    });
  }
  scatterInstanced(scene, _cityBodyGeo, euroLitMat, bodies);
  scatterInstanced(scene, hipRoofGeo(), _whiteMat, roofs, { shadow: false });
  churchTower(scene, s + (rand() - 0.5) * 80, side, style, centerLat, yLift);
}

// A belt of DISTANT hamlets: village clusters with their church towers dotted
// across the middle distance the whole length of a rural run — the thing you
// actually see from a European motorway. yLift perches them on the foothills.
function hamletBelt(scene, s0, s1, style, seed, opts = {}) {
  const { spacing = 7500, latMin = 300, latMax = 640, yLift = [0, 0] } = opts;
  const rand = rng(seed);
  let i = 0;
  for (let s = s0 + spacing * 0.4; s < s1; s += spacing * (0.6 + rand() * 0.9)) {
    const side = rand() < 0.5 ? -1 : 1;
    const lift = yLift[0] + rand() * (yLift[1] - yLift[0]);
    euroVillage(scene, s, side, style, seed + 31 * (++i), { latMin, latMax, yLift: lift });
  }
}

// Every European village is anchored by its church: a square bell tower with
// a slender slate spire in Germany, a whitewashed tower with a small pyramid
// cap and cross in Iberia.
function churchTower(scene, s, side, style, latOverride = null, yLift = 0) {
  const g = new THREE.Group();
  const iberia = style === 'iberia' || style === 'italia';
  const wallMat = new THREE.MeshStandardMaterial({ color: iberia ? 0xf5f0e4 : 0xd8d2c2, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: iberia ? 0xa8502e : 0x3a3f46, roughness: 0.9 });
  const nave = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 8), wallMat); nave.position.y = 3.5; g.add(nave);
  const naveRoof = new THREE.Mesh(hipRoofGeo(), roofMat); naveRoof.scale.set(20, 4, 12); naveRoof.position.y = 7; g.add(naveRoof);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4.4, iberia ? 13 : 15, 4.4), wallMat);
  tower.position.set(8.4, (iberia ? 13 : 15) / 2, 0); g.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(3.0, iberia ? 4.5 : 11, 4), roofMat);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(8.4, (iberia ? 13 + 2.2 : 15 + 5.5), 0); g.add(spire);
  const crossMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.5, metalness: 0.5 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.2, 0.22), crossMat);
  v.position.set(8.4, iberia ? 20.5 : 27.5, 0); g.add(v);
  const h = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.22), crossMat);
  h.position.set(8.4, iberia ? 20 : 27, 0); g.add(h);
  const lat = latOverride ?? side * (roadClearAt(s) + 110);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat) + yLift;
  g.rotation.y = headingAt(s) + (Math.abs(s) % 1.1);
  scene.add(g);
}

/* =========================== PORTUGAL · A1 =========================== */

// Portuguese toll plaza lane signs: Via Verde green e-toll lanes + manual.
const PT_TOLL_SIGNS = [
  ['Via Verde', '⟩⟩⟩', '#0b7d3e'],
  ['Via Verde', '⟩⟩⟩', '#0b7d3e'],
  ['Via Verde', 'SÓ ADERENTES', '#0b7d3e'],
  ['MANUAL', '€ · MOEDAS', '#12356f'],
  ['MANUAL', '€ · CARTÃO', '#12356f'],
  ['MANUAL', '€', '#12356f'],
];

// Sanctuary of Fátima: the tall white basilica tower on the plateau.
function fatimaBasilica(scene, s) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.8 });
  const g = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 14), white); nave.position.y = 6; g.add(nave);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 42, 8), white); tower.position.set(0, 21, 10); g.add(tower);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3.4, 6, 8), white); cap.position.set(0, 45, 10); g.add(cap);
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xd8c26a, roughness: 0.4, metalness: 0.6 });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), crossMat); v.position.set(0, 50.5, 10); g.add(v);
  const h = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.5), crossMat); h.position.set(0, 49.6, 10); g.add(h);
  const lat = -190;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s);
  scene.add(g);
}

export function buildPortugalA1(scene, registry) {
  const tex = facadeTexture(41);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // Lisboa out of Sacavém: dense pastel low-rise with a small modern cluster
  // at Parque das Nações — European city fabric, not glass-tower sprawl
  euroCity(scene, 300, 16000, 'iberia', 811, 1.2);
  skyline(scene, registry, 4110, 4000, 9000, 60, 220, 420, 25, 60);
  euroTown(scene, 13000, 30000, 'iberia', 812);        // Alverca / Vila Franca
  euroTown(scene, 63000, 71000, 'iberia', 813);        // Santarém
  euroTown(scene, 127000, 135000, 'iberia', 814);      // Leiria
  euroCity(scene, 180000, 192000, 'iberia', 815);      // Coimbra
  euroCity(scene, 229000, 239000, 'iberia', 816, 0.8); // Aveiro
  euroCity(scene, 260000, 292000, 'iberia', 817, 1.1); // Vila Nova de Gaia
  euroCity(scene, 286000, 298600, 'iberia', 818, 1.3); // Porto
  skyline(scene, registry, 4140, 280000, 287000, 70, 240, 420, 22, 55);  // Gaia towers
  // aldeias: clustered red-roof villages with their church, every few km
  for (const [vs, side, seed] of [[40000, -1, 821], [52000, 1, 822], [78000, 1, 823],
    [96000, -1, 824], [108000, 1, 825], [145000, -1, 826], [160000, 1, 827],
    [172000, -1, 828], [214000, 1, 829], [252000, -1, 830]]) {
    euroVillage(scene, vs, side, 'iberia', seed);
  }

  // Tejo estuary beside the run at Vila Franca; the Ria de Aveiro flats; the
  // Douro under the Ponte da Arrábida
  sideWater(scene, 15000, 32000, -300, 320);
  sideWater(scene, 228000, 246000, 300, 300);
  water(scene, 297200, 520, 1700);

  // landscape: olives and cork oak across the Ribatejo, the great pine and
  // eucalyptus belts of Leiria/Coimbra, greener hills north of Aveiro
  buildTrees(scene, 4201, 30000, 85000, 18, 20, 240, 0);
  forestBand(scene, 4210, 85000, 155000, 8, true);   // Pinhal de Leiria
  forestBand(scene, 4220, 155000, 205000, 9);
  buildTrees(scene, 4230, 205000, 262000, 14, 16, 200, 0);
  forestBand(scene, 4240, 262000, 290000, 8);

  fatimaBasilica(scene, 113000);

  // the serras: Montejunto west of the Lezíria, the limestone Serra d'Aire e
  // Candeeiros walling the east at Fátima, Caramulo/Buçaco on the horizon
  // past Coimbra, the Valongo hills behind Gaia (driving north: east = -1)
  mountainRange(scene, 24000, 46000, 1, { hMin: 100, hMax: 180, latMin: 560, latMax: 860, seed: 6111 });   // Montejunto
  mountainRange(scene, 78000, 132000, -1, { hMin: 140, hMax: 280, latMin: 520, latMax: 920, seed: 6112 }); // Serra d'Aire
  mountainRange(scene, 192000, 238000, -1, { hMin: 180, hMax: 340, latMin: 640, latMax: 1100, seed: 6113 }); // Caramulo/Buçaco
  mountainRange(scene, 262000, 292000, -1, { hMin: 90, hMax: 170, latMin: 540, latMax: 860, seed: 6114, rocks: false }); // Valongo hills

  // portagens (closed toll system): barriers at Alverca and Grijó
  for (const s of [18000, 282000]) {
    jn(scene, registry, s - 800, ['PORTAGEM 800 m', 'Via Verde ⟩⟩⟩', 'VIAS DA ESQUERDA'], '#0b7d3e');
    buildTollPlaza(scene, registry, s, PT_TOLL_SIGNS);
  }

  // distant aldeias across the middle distance the whole way north
  hamletBelt(scene, 30000, 260000, 'iberia', 6611, { spacing: 8000 });

  serviceArea(scene, registry, 75000, 'GALPE · ÁREA DE SERVIÇO', '#e8641b');
  serviceArea(scene, registry, 200000, 'ÁREA DE SERVIÇO', '#0b7d3e');
  sosPosts(scene, 0, 299000);
  delineatorPosts(scene, 0, 299000, 'portugal');
  noiseBarriers(scene, [[1200, 10800, -1], [268000, 294000, 1]], 0x76908a);

  // the big interchange guide boards
  jn(scene, registry, 3000,   ['Saída 1', 'AEROPORTO ✈ · LISBOA', 'A1 NORTE · PORTO']);
  jn(scene, registry, 30000,  ['Saída 4', 'A10 · CARREGADO', 'ÉVORA · ESPANHA']);
  jn(scene, registry, 90000,  ['Saída 7', 'A23 · TORRES NOVAS', 'CASTELO BRANCO']);
  jn(scene, registry, 132000, ['Saída 9', 'LEIRIA · A8', 'MARINHA GRANDE']);
  jn(scene, registry, 184000, ['Saída 12', 'COIMBRA SUL', 'FIGUEIRA DA FOZ']);
  jn(scene, registry, 236000, ['Saída 15', 'A25 · AVEIRO', 'VISEU · ESPANHA']);
  jn(scene, registry, 295000, ['Saída 20', 'PORTO · VCI', 'PONTE DA ARRÁBIDA']);
}

/* ============================= SPAIN · A-4 ============================= */

// The white windmills of La Mancha, up on their little rises at Puerto Lápice.
function molinos(scene, s0, s1) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.9 });
  const rand = rng(4813);
  for (let i = 0; i < 9; i++) {
    const s = s0 + (s1 - s0) * (i / 9) + rand() * 800;
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (170 + rand() * 120);
    const g = new THREE.Group();
    const mound = new THREE.Mesh(new THREE.ConeGeometry(26, 10, 10), new THREE.MeshStandardMaterial({ color: 0x9a8a5c, roughness: 1 }));
    mound.position.y = 4; g.add(mound);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.0, 11, 10), white); body.position.y = 14.5; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 4, 10), dark); roof.position.y = 22; g.add(roof);
    // four lattice sails
    for (let b = 0; b < 4; b++) {
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9.5, 1.6), dark);
      sail.position.set(0, 19.5, 4.2);
      sail.rotation.z = b * Math.PI / 2 + 0.4;
      sail.translateY(4.4);
      g.add(sail);
    }
    g.position.copy(posAt(s, lat, new THREE.Vector3()));
    g.position.y = groundY(s, lat) - 2;
    g.rotation.y = rand() * TAU;
    scene.add(g);
  }
}

// The Osborne bull — the giant black roadside bull silhouette that IS driving
// in Spain. Drawn as a flat cutout on a frame, up on the ridges.
let bullTex = null;
function osborneBull(scene, s, side) {
  if (!bullTex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#0c0c0e';
    // body
    g.beginPath(); g.ellipse(128, 118, 78, 46, 0, 0, TAU); g.fill();
    // hindquarters + head lump
    g.beginPath(); g.ellipse(72, 100, 34, 40, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(196, 92, 26, 30, 0, 0, TAU); g.fill();
    // neck/head
    g.beginPath(); g.ellipse(214, 74, 18, 22, 0.4, 0, TAU); g.fill();
    // horns
    g.strokeStyle = '#0c0c0e'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(216, 58); g.quadraticCurveTo(232, 34, 250, 40); g.stroke();
    g.beginPath(); g.moveTo(208, 58); g.quadraticCurveTo(196, 36, 180, 38); g.stroke();
    // legs
    for (const lx of [66, 96, 156, 188]) g.fillRect(lx, 118, 13, 78);
    // tail
    g.beginPath(); g.moveTo(52, 92); g.quadraticCurveTo(30, 120, 40, 152); g.lineWidth = 8; g.stroke();
    bullTex = new THREE.CanvasTexture(c);
    bullTex.colorSpace = THREE.SRGBColorSpace;
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 11.7),
    new THREE.MeshStandardMaterial({ map: bullTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 })
  );
  const lat = side * (200 + (s % 7) * 12);
  mesh.position.copy(posAt(s, lat, new THREE.Vector3()));
  mesh.position.y = groundY(s, lat) + 7.5;
  mesh.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0);
  scene.add(mesh);
}

// Olive groves: the endless ordered rows of Jaén/Córdoba province.
function oliveGroves(scene, s0, s1) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1.6, 5); trunkGeo.translate(0, 0.8, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.5, 0); crownGeo.translate(0, 2.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x5a6b3e, roughness: 1 });   // silvery olive green
  const rand = rng(4901);
  const places = [];
  for (let s = s0; s < s1; s += 26) {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 12; row++) {
        const lat = side * (roadClearAt(s) + 14 + row * 17 + rand() * 3);
        const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
        const sc = 0.8 + rand() * 0.5;
        places.push({ pos, rot: rand() * TAU, sx: sc, sy: sc, sz: sc });
      }
    }
  }
  scatterInstanced(scene, trunkGeo, trunkMat, places, { shadow: false });
  scatterInstanced(scene, crownGeo, crownMat, places, { shadow: false });
}

// Sunflower plains at Écija: a yellow-headed carpet on both sides.
function sunflowerFields(scene, s0, s1) {
  const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.4, 4); stemGeo.translate(0, 0.7, 0);
  const headGeo = new THREE.SphereGeometry(0.34, 6, 5); headGeo.translate(0, 1.5, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4c6b2e, roughness: 1 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xe8b820, roughness: 0.9 });
  const rand = rng(4977);
  const places = [];
  for (let s = s0; s < s1; s += 30) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 9; k++) {
        const lat = side * (roadClearAt(s) + 10 + rand() * 170);
        const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
        const sc = 1.5 + rand() * 1.6;   // oversized clumps that read at speed
        places.push({ pos, rot: rand() * TAU, sx: sc, sy: sc, sz: sc });
      }
    }
  }
  scatterInstanced(scene, stemGeo, stemMat, places, { shadow: false });
  scatterInstanced(scene, headGeo, headMat, places, { shadow: false });
}

// Despeñaperros: the granite gorge walls pressing on the roadway.
function gorgeWalls(scene, s0, s1) {
  const rockGeo = new THREE.BoxGeometry(6, 1, 5);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.95 });
  const rand = rng(4850);
  const places = [];
  for (let s = s0; s < s1; s += 11) {
    for (const side of [-1, 1]) {
      const lat = side * (roadClearAt(s) + 4 + rand() * 9);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat) + 2;
      const h = 7 + rand() * 17;
      places.push({ pos, rot: rand() * TAU, sx: 1 + rand() * 1.6, sy: h, sz: 1 + rand() * 1.4 });
    }
  }
  scatterInstanced(scene, rockGeo, rockMat, places, { shadow: false });
}

// The Giralda at Sevilla / the Mezquita bell tower at Córdoba, over the skyline.
function giralda(scene, s, lat, h = 40) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfae7a, roughness: 0.85 });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(7, h, 7), stone); shaft.position.y = h / 2; g.add(shaft);
  const belfry = new THREE.Mesh(new THREE.BoxGeometry(5, h * 0.2, 5), stone); belfry.position.y = h * 1.1; g.add(belfry);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 6), stone); cap.position.y = h * 1.2 + 2.8; g.add(cap);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s);
  scene.add(g);
}

export function buildSpainA4(scene, registry) {
  const tex = facadeTexture(53);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // Madrid at the top — with the Cuatro Torres poking well above everything
  // Madrid: dense low-rise with the Cuatro Torres cluster on the skyline
  euroCity(scene, 300, 16000, 'iberia', 911, 1.3);
  skyline(scene, registry, 5110, 2000, 7000, 90, 260, 420, 60, 130);
  euroTown(scene, 11000, 30000, 'iberia', 912);   // Getafe / Pinto
  euroTown(scene, 33000, 40000, 'iberia', 913);   // Aranjuez
  euroCity(scene, 382000, 410000, 'iberia', 914); // Córdoba
  giralda(scene, 397500, -160, 34);               // Mezquita bell tower
  euroCity(scene, 506000, 528000, 'iberia', 915, 1.2); // Sevilla
  skyline(scene, registry, 5130, 516000, 521000, 90, 260, 420, 26, 55);  // Torre Sevilla etc
  giralda(scene, 522000, -150, 46);               // La Giralda
  euroTown(scene, 449000, 457000, 'iberia', 916); // Écija white town
  euroTown(scene, 500000, 507000, 'iberia', 917); // Carmona
  // pueblos of La Mancha and the olive country
  for (const [vs, side, seed] of [[62000, 1, 921], [84000, -1, 922], [104000, 1, 923],
    [119000, -1, 924], [135000, 1, 925], [162000, -1, 926], [257000, 1, 927],
    [292000, -1, 928], [321000, 1, 929], [359000, -1, 930], [429000, 1, 931],
    [478000, -1, 932]]) {
    euroVillage(scene, vs, side, 'iberia', seed);
  }

  // the land: near-treeless meseta scrub, then windmills, vineyards read as
  // low rows, the gorge, and the olive sea of Andalucía
  buildTrees(scene, 5201, 45000, 100000, 34, 30, 260, 0);   // sparse holm oaks
  molinos(scene, 102000, 122000);
  buildTrees(scene, 5211, 130000, 205000, 30, 24, 220, 0);  // Valdepeñas vine country
  gorgeWalls(scene, 212000, 250000);
  forestBand(scene, 5221, 250000, 270000, 9, true);         // Sierra Morena pines
  oliveGroves(scene, 285000, 355000);
  oliveGroves(scene, 375000, 392000);
  sunflowerFields(scene, 425000, 462000);
  buildTrees(scene, 5231, 470000, 510000, 28, 26, 240, 0);

  // wind farm on the meseta ridge — modern Spain runs on these
  buildWindFarm(scene, registry, 150000, 185000, 5771);

  // the Sierra Morena: the dark wall across the southern horizon that the
  // gorge at Despeñaperros cuts through, plus the faint Subbética beyond
  // Córdoba (La Mancha stays dead flat — that's the point of it)
  mountainRange(scene, 185000, 270000, 1, { hMin: 200, hMax: 380, latMin: 540, latMax: 1000, seed: 6211 });
  mountainRange(scene, 190000, 265000, -1, { hMin: 180, hMax: 340, latMin: 560, latMax: 1000, seed: 6212 });
  mountainRange(scene, 375000, 425000, 1, { hMin: 110, hMax: 200, latMin: 700, latMax: 1150, seed: 6213, rocks: false }); // Subbética, far

  // Osborne bulls on the ridge lines
  osborneBull(scene, 95000, -1);
  osborneBull(scene, 190000, 1);
  osborneBull(scene, 300000, -1);
  osborneBull(scene, 440000, 1);

  // pueblos scattered thin across the meseta, whitewashed cortijo country
  // thickening down the Guadalquivir valley
  hamletBelt(scene, 45000, 200000, 'iberia', 6621, { spacing: 13000 });
  hamletBelt(scene, 280000, 505000, 'iberia', 6622, { spacing: 9000 });

  serviceArea(scene, registry, 140000, 'REPSOLIO · ÁREA DE SERVICIO', '#e8641b');
  serviceArea(scene, registry, 410000, 'ÁREA DE SERVICIO', '#c8102e');
  sosPosts(scene, 0, 529000);
  delineatorPosts(scene, 0, 529000, 'spain');
  noiseBarriers(scene, [[2000, 26000, 1], [510000, 527000, -1]], 0xb29a78);

  jn(scene, registry, 6000,   ['Salida 6', 'M-40 · VILLAVERDE', 'A-4 ANDALUCÍA']);
  jn(scene, registry, 52000,  ['Salida 52', 'R-4 · AP-36 · OCAÑA', 'ALBACETE · VALENCIA']);
  jn(scene, registry, 104000, ['Salida 104', 'PUERTO LÁPICE', 'RUTA DEL QUIJOTE']);
  jn(scene, registry, 228000, ['DESPEÑAPERROS', 'PUERTO · 2 km', 'ANDALUCÍA']);
  jn(scene, registry, 268000, ['Salida 268', 'A-44 · BAILÉN', 'GRANADA · JAÉN']);
  jn(scene, registry, 398000, ['Salida 398', 'CÓRDOBA', 'BADAJOZ · N-432']);
  jn(scene, registry, 527000, ['Salida 527', 'SE-30 · SEVILLA', 'HUELVA · CÁDIZ']);
}

/* ============================ GERMANY · A3 ============================ */

// Limburg cathedral (the orange-and-white Georgsdom) above the Lahn valley.
function limburgerDom(scene, s) {
  const orange = new THREE.MeshStandardMaterial({ color: 0xc46a3a, roughness: 0.85 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.85 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x3c4148, roughness: 0.9 });
  const g = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 11), orange); nave.position.y = 7; g.add(nave);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(20.4, 2.2, 11.4), white); trim.position.y = 10; g.add(trim);
  for (const dz of [-6.5, 6.5]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 22, 5), orange); tower.position.set(9, 11, dz); g.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.4, 10, 4), slate); spire.position.set(9, 27, dz); g.add(spire);
  }
  const mid = new THREE.Mesh(new THREE.ConeGeometry(4, 11, 4), slate); mid.position.set(-4, 21, 0); g.add(mid);
  const lat = -170;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat) + 6;   // up on the old-town hill
  g.rotation.y = headingAt(s) + 0.5;
  scene.add(g);
}

// Kölner Dom: the twin dark gothic spires over the Rhine — visible the moment
// the A3 drops out of the Königsforst.
function koelnerDom(scene, s) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a4a48, roughness: 0.92 });
  const g = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(30, 24, 14), stone); nave.position.y = 12; g.add(nave);
  for (const dz of [-5.5, 5.5]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 44, 8), stone); tower.position.set(13, 22, dz); g.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.6, 26, 4), stone); spire.position.set(13, 57, dz); g.add(spire);
  }
  const lat = -190;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + 0.4;
  scene.add(g);
}

// The Köln–Rhein/Main ICE high-speed line, which famously rides right beside
// the A3 through the Westerwald: ballast, catenary masts, and a white ICE 3
// shuttling both ways at 300 km/h.
function iceLine(scene, registry, s0, s1, lat) {
  // trackbed
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.7 });
  const bedPts = [];
  const step = 40;
  for (let s = s0; s <= s1; s += step) {
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat) + 0.4;
    bedPts.push({ pos, rot: headingAt(s), sx: 1, sy: 1, sz: 1 });
  }
  const bedGeo = new THREE.BoxGeometry(9, 0.8, step + 2);
  scatterInstanced(scene, bedGeo, bedMat, bedPts, { shadow: false });
  const railGeo = new THREE.BoxGeometry(0.18, 0.3, step + 1); railGeo.translate(0, 0.95, 0);
  for (const off of [-2.2, -0.7, 0.7, 2.2]) {
    const pts = bedPts.map(p => ({
      pos: p.pos.clone().add(new THREE.Vector3(Math.cos(p.rot) * off, 0, -Math.sin(p.rot) * off)),
      rot: p.rot, sx: 1, sy: 1, sz: 1,
    }));
    scatterInstanced(scene, railGeo, railMat, pts, { shadow: false });
  }
  // catenary masts
  const mastGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 5); mastGeo.translate(0, 3.5, 0);
  const mastPts = [];
  for (let s = s0; s <= s1; s += 65) {
    const pos = posAt(s, lat + 5.5, new THREE.Vector3()); pos.y = groundY(s, lat) + 0.6;
    mastPts.push({ pos, rot: headingAt(s), sx: 1, sy: 1, sz: 1 });
  }
  scatterInstanced(scene, mastGeo, railMat, mastPts, { shadow: false });

  // the trains: two 8-car ICEs, one per direction
  const white = new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.35, metalness: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.15, metalness: 0.5 });
  const makeICE = () => {
    const t = new THREE.Group();
    for (let c = 0; c < 8; c++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.9, 3.4, 24), white);
      car.position.set(0, 2.4, -c * 25 + 87.5);
      t.add(car);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.5, 24), red);
      stripe.position.set(0, 1.6, -c * 25 + 87.5);
      t.add(stripe);
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.8, 22), glass);
      win.position.set(0, 3.1, -c * 25 + 87.5);
      t.add(win);
    }
    scene.add(t);
    return t;
  };
  const trains = [
    { mesh: makeICE(), s: s0 + 4000, dir: 1 },
    { mesh: makeICE(), s: s1 - 4000, dir: -1 },
  ];
  registry.euroUpdate = (simTime, dt = 0.016) => {
    for (const tr of trains) {
      tr.s += tr.dir * 83 * dt;   // ~300 km/h
      if (tr.s > s1 - 200) { tr.dir = -1; tr.s = s1 - 200; }
      if (tr.s < s0 + 200) { tr.dir = 1; tr.s = s0 + 200; }
      tr.mesh.position.copy(posAt(tr.s, lat, new THREE.Vector3()));
      tr.mesh.position.y = groundY(tr.s, lat) + 1.0;
      tr.mesh.rotation.y = headingAt(tr.s) + (tr.dir < 0 ? Math.PI : 0);
    }
  };
}

export function buildGermanyA3(scene, registry) {
  const tex = facadeTexture(67);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // Frankfurt: the one real skyscraper skyline in Germany, rising out of a
  // low gray-roofed European city
  euroCity(scene, 300, 14000, 'german', 1011, 1.1);
  skyline(scene, registry, 6110, 1500, 7500, 60, 230, 420, 55, 150);
  euroTown(scene, 9500, 23000, 'german', 1012);   // Main-Taunus
  euroTown(scene, 50000, 57000, 'german', 1013);  // Limburg
  limburgerDom(scene, 54500);
  euroCity(scene, 132000, 148000, 'german', 1014, 0.9);   // Siegburg / Bonn edge
  skyline(scene, registry, 6120, 137000, 141000, 100, 260, 400, 28, 60, [-1]);
  euroCity(scene, 154000, 174000, 'german', 1015, 1.2);   // Köln
  skyline(scene, registry, 6130, 165000, 171000, 90, 250, 400, 26, 60);
  koelnerDom(scene, 169000);
  // Westerwald + Taunus Dörfer: slate-spired villages in the clearings
  for (const [vs, side, seed] of [[24000, 1, 1021], [33000, -1, 1022], [43000, 1, 1023],
    [66000, -1, 1024], [79000, 1, 1025], [90000, -1, 1026], [100000, 1, 1027],
    [108000, -1, 1028], [125000, 1, 1029], [147000, -1, 1030], [155000, 1, 1031]]) {
    euroVillage(scene, vs, side, 'german', seed);
  }

  // the A3 is a green tunnel: dense spruce/beech the whole way between towns
  forestBand(scene, 6201, 20000, 50000, 6, true);    // Taunus
  forestBand(scene, 6211, 57000, 134000, 5, true);   // Westerwald — tightest
  forestBand(scene, 6221, 145000, 160000, 6, true);  // Königsforst

  // the flanking forested ridges: the Taunus crest, the rolling Westerwald
  // horizon, and the Siebengebirge's volcanic humps toward the Rhine
  mountainRange(scene, 14000, 52000, 1, { hMin: 100, hMax: 200, latMin: 520, latMax: 900, seed: 6311, slopeCol: 0x3d5a35, rocks: false });
  mountainRange(scene, 14000, 52000, -1, { hMin: 90, hMax: 170, latMin: 560, latMax: 940, seed: 6312, slopeCol: 0x3d5a35, rocks: false });
  mountainRange(scene, 58000, 132000, 1, { hMin: 90, hMax: 180, latMin: 540, latMax: 960, seed: 6313, slopeCol: 0x37542f, rocks: false });
  mountainRange(scene, 112000, 136000, -1, { hMin: 140, hMax: 260, latMin: 520, latMax: 860, seed: 6314, slopeCol: 0x3d5a35, rocks: false }); // Siebengebirge

  // the ICE line beside the carriageway through the Westerwald
  iceLine(scene, registry, 62000, 118000, -30);

  // Dörfer in the forest clearings, church spires over the treeline
  hamletBelt(scene, 14000, 160000, 'german', 6631, { spacing: 8000 });

  serviceArea(scene, registry, 42000, 'RASTSTÄTTE BAD CAMBERG', '#0d4f9e');
  serviceArea(scene, registry, 96000, 'RASTSTÄTTE WESTERWALD', '#0d4f9e');
  sosPosts(scene, 0, 175000);
  delineatorPosts(scene, 0, 175000, 'germany');
  noiseBarriers(scene, [[1000, 19000, -1], [153000, 173000, 1]], 0x668581);

  jn(scene, registry, 2000,   ['FRANKFURTER KREUZ', 'A5 · KASSEL / BASEL', 'FLUGHAFEN ✈']);
  jn(scene, registry, 15000,  ['WIESBADENER KREUZ', 'A66 · WIESBADEN', 'RHEINGAU']);
  jn(scene, registry, 55000,  ['Ausfahrt 43', 'LIMBURG-SÜD', 'ICE-BAHNHOF 🚄']);
  jn(scene, registry, 79000,  ['Ausfahrt 40', 'MONTABAUR', 'ICE-PARK']);
  jn(scene, registry, 140000, ['KREUZ BONN/SIEGBURG', 'A560 · BONN', 'SANKT AUGUSTIN']);
  jn(scene, registry, 164000, ['KREUZ KÖLN-OST', 'A4 · AACHEN / OLPE', 'KÖLN ZENTRUM']);
  jn(scene, registry, 169500, ['KÖLN', 'ZENTRUM · DOM', 'ZOOBRÜCKE · RHEIN']);
}

/* ======================= BRITAIN · M6/M1/A2/M20 ======================= */

// Wembley Stadium's arch over north-west London.
function wembleyArch(scene, s) {
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(70, 2.4, 8, 40, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.35, metalness: 0.5 })
  );
  const lat = -240;
  arch.position.copy(posAt(s, lat, new THREE.Vector3()));
  arch.position.y = groundY(s, lat);
  arch.rotation.y = headingAt(s) + 0.9;
  scene.add(arch);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(60, 66, 16, 18),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.7 }));
  bowl.position.copy(arch.position); bowl.position.y += 8;
  scene.add(bowl);
}

// The Elizabeth Tower — Big Ben — with its lit clock faces.
function bigBen(scene, s) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9b98a, roughness: 0.85 });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(7, 55, 7), stone); shaft.position.y = 27.5; g.add(shaft);
  const clockBox = new THREE.Mesh(new THREE.BoxGeometry(8.4, 8.4, 8.4), stone); clockBox.position.y = 59; g.add(clockBox);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xf5f0dc, emissive: 0xfff2c4, emissiveIntensity: 0.25 });
  for (const [dx, dz, ry] of [[0, 4.3, 0], [0, -4.3, 0], [4.3, 0, Math.PI / 2], [-4.3, 0, Math.PI / 2]]) {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.2, 16), faceMat);
    face.rotation.x = Math.PI / 2; face.rotation.z = ry;
    face.position.set(dx, 59, dz); g.add(face);
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(5.4, 14, 4),
    new THREE.MeshStandardMaterial({ color: 0x3a4a3e, roughness: 0.8 }));
  spire.rotation.y = Math.PI / 4; spire.position.y = 70; g.add(spire);
  // the Palace of Westminster alongside
  const palace = new THREE.Mesh(new THREE.BoxGeometry(60, 18, 16), stone); palace.position.set(-32, 9, 0); g.add(palace);
  const lat = -170;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + 0.4;
  scene.add(g);
}

// The London Eye on the South Bank.
function londonEye(scene, s) {
  const white = new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.4, metalness: 0.4 });
  const g = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(32, 1.2, 8, 36), white);
  wheel.position.y = 36; g.add(wheel);
  for (let i = 0; i < 12; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 63, 0.5), white);
    spoke.position.y = 36; spoke.rotation.z = (i / 12) * Math.PI; g.add(spoke);
  }
  for (const dx of [-10, 10]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 40, 1.6), white);
    leg.position.set(dx, 18, 6); leg.rotation.x = 0.25; g.add(leg);
  }
  const lat = 150;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + 0.5;
  scene.add(g);
}

// The Shard, the Gherkin, the BT Tower — the towers everyone recognises.
function londonTowers(scene, s) {
  const glass = new THREE.MeshStandardMaterial({ color: 0xb8ccd8, roughness: 0.2, metalness: 0.7 });
  // Shard
  const shard = new THREE.Mesh(new THREE.ConeGeometry(11, 105, 4), glass);
  shard.rotation.y = Math.PI / 4;
  const shardLat = 180;
  shard.position.copy(posAt(s + 1200, shardLat, new THREE.Vector3()));
  shard.position.y = groundY(s, shardLat) + 52.5;
  scene.add(shard);
  // Gherkin
  const gherkin = new THREE.Mesh(new THREE.SphereGeometry(11, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x5f7a68, roughness: 0.25, metalness: 0.6 }));
  gherkin.scale.set(1, 2.6, 1);
  const gLat = -200;
  gherkin.position.copy(posAt(s, gLat, new THREE.Vector3()));
  gherkin.position.y = groundY(s, gLat) + 28;
  scene.add(gherkin);
  // BT Tower
  const bt = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 66, 12),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.4 }));
  const btLat = -240;
  bt.position.copy(posAt(s - 7000, btLat, new THREE.Vector3()));
  bt.position.y = groundY(s - 7000, btLat) + 33;
  scene.add(bt);
}

// The white cliffs above Folkestone/Dover, with the Channel beyond.
function whiteCliffs(scene, s0, s1) {
  const chalk = new THREE.MeshStandardMaterial({ color: 0xeceadf, roughness: 0.95 });
  const rockGeo = new THREE.BoxGeometry(7, 1, 6);
  const rand = rng(3111);
  const places = [];
  for (let s = s0; s < s1; s += 12) {
    const lat = roadClearAt(s) + 8 + rand() * 14;   // cliffs on the landward left
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat) + 3;
    places.push({ pos, rot: rand() * TAU, sx: 1 + rand() * 1.6, sy: 10 + rand() * 20, sz: 1 + rand() * 1.5 });
  }
  scatterInstanced(scene, rockGeo, chalk, places, { shadow: false });
}

// Eurotunnel terminal: the long canopies and the Le Shuttle gantry.
function eurotunnelTerminal(scene, registry, s, toCity) {
  const conc = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.8 });
  const g = new THREE.Group();
  for (const dz of [-30, -46, -62]) {
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(90, 0.8, 10), conc);
    canopy.position.set(0, 6, dz); g.add(canopy);
    for (const dx of [-40, -20, 0, 20, 40]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6, 0.7), conc);
      col.position.set(dx, 3, dz); g.add(col);
    }
  }
  const lat = -(roadClearAt(s) + 70);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s);
  scene.add(g);
  jn(scene, registry, s, ['EUROTUNNEL', 'LE SHUTTLE 🚄', '→ ' + toCity], '#0d4f9e');
}

export function buildUKM1(scene, registry) {
  const tex = facadeTexture(73);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // Birmingham out of Spaghetti Junction
  euroCity(scene, 300, 18000, 'london', 3011, 1.1);
  skyline(scene, registry, 7110, 3000, 9000, 80, 240, 420, 30, 85);
  euroTown(scene, 24000, 35000, 'london', 3012);     // Coventry
  euroTown(scene, 71000, 78000, 'london', 3013);     // Northampton
  euroTown(scene, 92000, 99000, 'london', 3014);     // Milton Keynes
  euroTown(scene, 134000, 142000, 'london', 3015);   // Luton

  // LONDON — at its real breadth: 60+ km of brick fabric, Wembley to the
  // City cluster to Canary Wharf
  euroCity(scene, 145000, 215000, 'london', 3016, 1.3);
  skyline(scene, registry, 7120, 182000, 187000, 70, 230, 420, 45, 130);  // the City cluster
  skyline(scene, registry, 7130, 188000, 193000, 60, 220, 420, 55, 150);  // Canary Wharf
  wembleyArch(scene, 158000);
  bigBen(scene, 179500);
  londonEye(scene, 180800);
  londonTowers(scene, 183000);
  water(scene, 180200, 460, 1500);   // the Thames

  euroTown(scene, 246000, 252000, 'london', 3017);   // Maidstone
  euroTown(scene, 286000, 293000, 'london', 3018);   // Ashford
  euroTown(scene, 306000, 312000, 'london', 3019);   // Folkestone

  // hedgerow country between the towns; the Kent Downs
  buildTrees(scene, 3201, 15000, 148000, 16, 14, 220, 0);
  buildTrees(scene, 3211, 212000, 305000, 14, 12, 200, 0);
  forestBand(scene, 3221, 252000, 285000, 8);        // wooded Kent Downs

  // the low English scarps: the Chiltern edge at Luton, the wooded North
  // Downs ridge over the M20, chalk-flanked at the Dover end
  mountainRange(scene, 118000, 152000, 1, { hMin: 60, hMax: 120, latMin: 520, latMax: 880, seed: 6511, rocks: false });
  mountainRange(scene, 240000, 306000, 1, { hMin: 80, hMax: 160, latMin: 500, latMax: 880, seed: 6512, rocks: false });
  mountainRange(scene, 296000, 318000, -1, { hMin: 70, hMax: 140, latMin: 520, latMax: 800, seed: 6513, slopeCol: 0x9aa088, rocks: false }); // chalk downs

  whiteCliffs(scene, 310000, 319000);
  sideWater(scene, 311000, 320000, -320, 340);       // the English Channel
  eurotunnelTerminal(scene, registry, 309000, 'CALAIS');

  // English villages in the middle distance, both rural legs
  hamletBelt(scene, 15000, 148000, 'london', 6651, { spacing: 7000 });
  hamletBelt(scene, 212000, 305000, 'london', 6652, { spacing: 7000 });

  serviceArea(scene, registry, 60000, 'WATFORD GAP SERVICES', '#0d4f9e');
  serviceArea(scene, registry, 125000, 'TODDINGTON SERVICES', '#0d4f9e');
  serviceArea(scene, registry, 250000, 'MAIDSTONE SERVICES M20', '#0d4f9e');
  sosPosts(scene, 0, 320000);
  delineatorPosts(scene, 0, 320000, 'uk');
  noiseBarriers(scene, [[2000, 13000, 1], [145000, 214000, -1], [286000, 304000, 1]], 0x71817d);

  jn(scene, registry, 2000,   ['SPAGHETTI JUNCTION', 'A38(M) · CITY CENTRE', 'M6 · The SOUTH']);
  jn(scene, registry, 50000,  ['CATTHORPE', 'M1 · London', 'THE SOUTH ▼']);
  jn(scene, registry, 148000, ['J6A · M25', 'LONDON ORBITAL', 'HEATHROW ✈']);
  jn(scene, registry, 162000, ['STAPLES CORNER', 'A406 · Central London', 'BRENT CROSS']);
  jn(scene, registry, 180000, ['WESTMINSTER', 'City of London', 'A2 · Canterbury']);
  jn(scene, registry, 205000, ['M25 · DARTFORD', 'M20 · Channel Tunnel', 'DOVER ▼']);
  jn(scene, registry, 288000, ['J9 · ASHFORD', 'International 🚄', 'M20 · Folkestone']);
  jn(scene, registry, 317000, ['DOVER', 'Port · Ferries ⛴', 'A20 Western Docks']);
}

/* ========================= FRANCE · A16 (E402) ========================= */

// French péage lane signs: orange 't' télépéage + CB card + coin lanes.
const FR_TOLL_SIGNS = [
  ['t ⟩⟩', 'TÉLÉPÉAGE 30', '#e8641b'],
  ['t ⟩⟩', 'TÉLÉPÉAGE 30', '#e8641b'],
  ['t · CB', 'AUTOMATIQUE', '#e8641b'],
  ['CB', 'CARTES', '#12356f'],
  ['€', 'PIÈCES · MONNAIE', '#0d6b3f'],
  ['€ · CB', 'TOUS PAIEMENTS', '#12356f'],
];

// Amiens cathedral — the tallest complete Gothic nave in France — and its
// little sister at Beauvais.
function gothicCathedral(scene, s, scale = 1) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xcfc5ae, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a4f56, roughness: 0.85 });
  const g = new THREE.Group();
  const nave = new THREE.Mesh(new THREE.BoxGeometry(38, 26, 13), stone); nave.position.y = 13; g.add(nave);
  const naveRoof = new THREE.Mesh(hipRoofGeo(), dark); naveRoof.scale.set(40, 9, 15); naveRoof.position.y = 26; g.add(naveRoof);
  for (const dz of [-5.5, 5.5]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 42, 7), stone); tower.position.set(17, 21, dz); g.add(tower);
  }
  // the flèche: the slender crossing spire
  const fleche = new THREE.Mesh(new THREE.ConeGeometry(2.6, 26, 6), dark); fleche.position.set(-3, 42, 0); g.add(fleche);
  g.scale.setScalar(scale);
  const lat = -175;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + 0.5;
  scene.add(g);
}

// The Eiffel Tower: four splayed legs, two decks, the tapering top.
function eiffelTower(scene, s) {
  const iron = new THREE.MeshStandardMaterial({ color: 0x5a4a3c, roughness: 0.7, metalness: 0.4 });
  const g = new THREE.Group();
  for (const [dx, dz] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(4.5, 42, 4.5), iron);
    leg.position.set(dx * 0.62, 20, dz * 0.62);
    leg.rotation.z = -dx * 0.014; leg.rotation.x = dz * 0.014;
    g.add(leg);
  }
  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 26), iron); deck1.position.y = 38; g.add(deck1);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(13, 26, 13), iron); mid.position.y = 52; g.add(mid);
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 16), iron); deck2.position.y = 66; g.add(deck2);
  const top = new THREE.Mesh(new THREE.ConeGeometry(7, 34, 4), iron); top.rotation.y = Math.PI / 4; top.position.y = 84; g.add(top);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 12, 6), iron); antenna.position.y = 106; g.add(antenna);
  const lat = -230;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  scene.add(g);
}

// Sacré-Cœur's white domes on the Montmartre hill; the Montparnasse slab;
// the Grande Arche out at La Défense.
function parisLandmarks(scene, s) {
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.8 });
  const sc = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 14, 12), white); drum.position.y = 7; sc.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), white);
  dome.position.y = 14; sc.add(dome);
  for (const dx of [-13, 13]) {
    const sd = new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), white);
    sd.position.set(dx, 9, 0); sc.add(sd);
    const sdr = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5, 9, 10), white); sdr.position.set(dx, 4.5, 0); sc.add(sdr);
  }
  const scLat = 210;
  sc.position.copy(posAt(s - 7000, scLat, new THREE.Vector3()));
  sc.position.y = groundY(s - 7000, scLat) + 14;   // up on Montmartre
  scene.add(sc);
  // Montparnasse
  const slab = new THREE.Mesh(new THREE.BoxGeometry(18, 62, 9),
    new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.3, metalness: 0.6 }));
  const mpLat = -260;
  slab.position.copy(posAt(s + 2500, mpLat, new THREE.Vector3()));
  slab.position.y = groundY(s + 2500, mpLat) + 31;
  scene.add(slab);
}

function grandeArche(scene, s) {
  const white = new THREE.MeshStandardMaterial({ color: 0xeceadf, roughness: 0.5 });
  const g = new THREE.Group();
  for (const dx of [-13, 13]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(8, 34, 12), white); pillar.position.set(dx, 17, 0); g.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(34, 8, 12), white); beam.position.y = 38; g.add(beam);
  const lat = -290;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + 0.3;
  scene.add(g);
}

export function buildFranceA16(scene, registry) {
  const tex = facadeTexture(79);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // the Channel at Calais, then the Côte d'Opale
  sideWater(scene, 0, 14000, 300, 340);
  eurotunnelTerminal(scene, registry, 2500, 'FOLKESTONE (UK)');
  euroTown(scene, 5000, 12000, 'france', 3511);      // Calais
  euroTown(scene, 33000, 41000, 'france', 3512);     // Boulogne-sur-Mer
  euroTown(scene, 92000, 98000, 'france', 3513);     // Abbeville
  sideWater(scene, 96000, 110000, -280, 300);        // Baie de Somme

  euroCity(scene, 128000, 142000, 'france', 3514);   // Amiens
  gothicCathedral(scene, 135000, 1.25);              // the great cathedral
  euroTown(scene, 212000, 222000, 'france', 3515);   // Beauvais
  gothicCathedral(scene, 216000, 0.9);

  // PARIS — Haussmann cream and zinc at the capital's real breadth, La
  // Défense on the skyline, the tower over everything
  euroCity(scene, 250000, 290000, 'paris', 3516, 1.4);
  skyline(scene, registry, 7510, 262000, 268000, 60, 240, 420, 50, 140, [-1]);  // La Défense
  grandeArche(scene, 265000);
  parisLandmarks(scene, 283000);
  eiffelTower(scene, 285000);

  // the Boulonnais: the green hill country behind the Côte d'Opale (the
  // Picardie plateau beyond stays open and rolling — as it is)
  mountainRange(scene, 14000, 62000, -1, { hMin: 70, hMax: 150, latMin: 520, latMax: 900, seed: 6411, rocks: false });

  // Picardie: hedgerow farmland + the turbine forests of Hauts-de-France
  buildTrees(scene, 3601, 15000, 85000, 16, 14, 220, 0);
  buildTrees(scene, 3611, 110000, 200000, 18, 16, 220, 0);
  buildTrees(scene, 3621, 222000, 258000, 15, 14, 200, 0);
  buildWindFarm(scene, registry, 60000, 82000, 3771);
  buildWindFarm(scene, registry, 150000, 200000, 3772);

  // SANEF péages
  for (const s of [55000, 245000]) {
    jn(scene, registry, s - 900, ['PÉAGE 900 m', 't ⟩ TÉLÉPÉAGE', 'VOIES DE GAUCHE'], '#e8641b');
    buildTollPlaza(scene, registry, s, FR_TOLL_SIGNS);
  }

  // clochers on the horizon: hamlets right across the Picardie plateau
  hamletBelt(scene, 15000, 255000, 'france', 6641, { spacing: 7500 });

  serviceArea(scene, registry, 78000, 'AIRE DE LA CÔTE PICARDE', '#0d4f9e');
  serviceArea(scene, registry, 188000, 'AIRE DU PLATEAU PICARD', '#0d4f9e');
  sosPosts(scene, 0, 290000);
  delineatorPosts(scene, 0, 290000, 'france');
  noiseBarriers(scene, [[258000, 286000, -1], [266000, 289000, 1]], 0x728b91);

  // villages of the Pas-de-Calais and Picardie
  for (const [vs, side, seed] of [[20000, 1, 3711], [48000, -1, 3712], [58000, 1, 3713],
    [70000, -1, 3714], [80000, 1, 3715], [105000, -1, 3716], [122000, 1, 3717],
    [160000, -1, 3718], [175000, 1, 3719], [192000, -1, 3720], [228000, 1, 3721],
    [245000, -1, 3722]]) {
    euroVillage(scene, vs, side, 'france', seed);
  }

  jn(scene, registry, 3000,   ['Sortie 43', 'TUNNEL SOUS LA MANCHE', 'COQUELLES · UK 🚄']);
  jn(scene, registry, 14000,  ['Sortie 40', 'A26 · REIMS', 'CALAIS-SUD']);
  jn(scene, registry, 40000,  ['Sortie 31', 'BOULOGNE-SUR-MER', 'LE PORT']);
  jn(scene, registry, 95000,  ['Sortie 23', 'ABBEVILLE', 'BAIE DE SOMME']);
  jn(scene, registry, 140000, ['Sortie 20', 'A29 · AMIENS-SUD', 'ROUEN · SAINT-QUENTIN']);
  jn(scene, registry, 220000, ['Sortie 14', 'BEAUVAIS ✈', 'AÉROPORT']);
  jn(scene, registry, 282000, ['Sortie 1', 'PORTE DE LA CHAPELLE', 'PARIS · PÉRIPHÉRIQUE']);
}

/* ==================== ITALY · A1 AUTOSTRADA DEL SOLE ==================== */

// A background mountain chain: big overlapping peaks marching along one side
// of the road, green-grey lower slopes under bare-rock summits (or fully
// forested ridges — set rocks:false and a deeper green). Instanced — two
// draw calls for a whole range.
function mountainRange(scene, s0, s1, side, opts = {}) {
  const {
    hMin = 150, hMax = 320, latMin = 520, latMax = 920,
    spacing = 1500, seed = 6001, slopeCol = 0x55684a, rocks = true,
  } = opts;
  const slopeGeo = new THREE.ConeGeometry(1, 1, 9);
  slopeGeo.translate(0, 0.5, 0);
  const slopeMat = new THREE.MeshStandardMaterial({ color: slopeCol, roughness: 1 });
  const rockGeo = new THREE.ConeGeometry(0.55, 0.55, 9);
  rockGeo.translate(0, 0.28, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d8a80, roughness: 1 });
  const rand = rng(seed);
  const slopes = [], rockPts = [];
  for (let s = s0; s < s1; s += spacing * (0.6 + rand() * 0.8)) {
    const h = hMin + rand() * (hMax - hMin);
    const r = h * (1.6 + rand() * 0.9);
    const lat = side * (latMin + rand() * (latMax - latMin)) + r * 0.3;
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = -18;   // roots below the plain so foothills never float
    slopes.push({ pos, rot: rand() * TAU, sx: r, sy: h, sz: r * (0.8 + rand() * 0.5) });
    // bare summit rock on the tall peaks
    if (rocks && h > (hMin + hMax) / 2) {
      rockPts.push({
        pos: pos.clone().setY(pos.y + h * 0.62), rot: rand() * TAU,
        sx: r * 0.66, sy: h * 0.62, sz: r * 0.6,
      });
    }
  }
  scatterInstanced(scene, slopeGeo, slopeMat, slopes, { shadow: false });
  scatterInstanced(scene, rockGeo, rockMat, rockPts, { shadow: false });
}

// Italian toll plaza lane signs: yellow Telepass lanes + cards + cash.
const IT_TOLL_SIGNS = [
  ['Telepass', '⟩⟩⟩', '#e8b400'],
  ['Telepass', '⟩⟩⟩', '#e8b400'],
  ['CARTE', 'VIACARD · CB', '#12356f'],
  ['CARTE', 'CB', '#12356f'],
  ['€', 'CONTANTI', '#0d6b3f'],
  ['€ · CARTE', 'TUTTI', '#12356f'],
];

// Italian stone pines — the flat-topped umbrella pines of the Roman roads.
function stonePines(scene, s0, s1, seed, step = 90) {
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 9, 6); trunkGeo.translate(0, 4.5, 0);
  const crownGeo = new THREE.SphereGeometry(4.4, 8, 6); crownGeo.scale(1, 0.42, 1); crownGeo.translate(0, 9.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e4f38, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f5a30, roughness: 1 });
  const rand = rng(seed);
  const places = [];
  for (let s = s0; s < s1; s += step * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.35) continue;
      const lat = side * (roadClearAt(s) + 8 + rand() * 60);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      const sc = 0.9 + rand() * 0.7;
      places.push({ pos, rot: rand() * TAU, sx: sc, sy: sc, sz: sc });
    }
  }
  scatterInstanced(scene, trunkGeo, trunkMat, places, { shadow: false });
  scatterInstanced(scene, crownGeo, crownMat, places, { shadow: false });
}

// The Colosseum: an elliptical drum wrapped in a painted arcade.
let colosseumTex = null;
function colosseum(scene, s) {
  if (!colosseumTex) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#cbb290'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#5a4a38';
    for (let row = 0; row < 3; row++) {
      for (let x = 8; x < 512; x += 32) {
        g.beginPath();
        g.arc(x + 8, 34 + row * 40, 8, Math.PI, 0);
        g.rect(x, 34 + row * 40, 16, 14);
        g.fill();
      }
    }
    colosseumTex = new THREE.CanvasTexture(c);
    colosseumTex.wrapS = THREE.RepeatWrapping; colosseumTex.repeat.x = 6;
    colosseumTex.colorSpace = THREE.SRGBColorSpace;
  }
  const mat = new THREE.MeshStandardMaterial({ map: colosseumTex, roughness: 0.9, side: THREE.DoubleSide });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 17, 24, 1, true), mat);
  drum.scale.z = 0.82;   // elliptical
  const lat = -190;
  drum.position.copy(posAt(s, lat, new THREE.Vector3()));
  drum.position.y = groundY(s, lat) + 8.5;
  scene.add(drum);
  // the broken upper ring
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 6, 24, 1, true, 0, Math.PI * 1.2), mat);
  rim.scale.z = 0.82;
  rim.position.copy(drum.position); rim.position.y += 11;
  scene.add(rim);
}

// St Peter's: the great dome over the Vatican, far off across Rome.
function sanPietro(scene, s) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.85 });
  const g = new THREE.Group();
  const facade = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 12), stone); facade.position.y = 7; g.add(facade);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(10, 10.5, 10, 14), stone); drum.position.set(0, 19, -4); g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), stone);
  dome.scale.y = 1.15; dome.position.set(0, 24, -4); g.add(dome);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 4, 8), stone); lantern.position.set(0, 36, -4); g.add(lantern);
  const lat = -300;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + 0.6;
  scene.add(g);
}

// Montecassino: the white abbey rebuilt on its mountain over the valley.
function montecassino(scene, s) {
  const white = new THREE.MeshStandardMaterial({ color: 0xefe9da, roughness: 0.85 });
  const g = new THREE.Group();
  const hill = new THREE.Mesh(new THREE.ConeGeometry(120, 95, 10),
    new THREE.MeshStandardMaterial({ color: 0x5d7048, roughness: 1 }));
  hill.position.y = 42; g.add(hill);
  const abbey = new THREE.Mesh(new THREE.BoxGeometry(58, 10, 20), white); abbey.position.y = 94; g.add(abbey);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 34), white); wing.position.set(14, 93, 0); g.add(wing);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), white);
  dome.position.y = 101; g.add(dome);
  const lat = 300;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat) - 6;
  scene.add(g);
}

// The Reggia di Caserta: the immense Bourbon palace front.
function reggiaDiCaserta(scene, s) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xd0b894, roughness: 0.9 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.9 });
  const g = new THREE.Group();
  const front = new THREE.Mesh(new THREE.BoxGeometry(90, 16, 16), stone); front.position.y = 8; g.add(front);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(92, 2.4, 18), roof); cap.position.y = 17; g.add(cap);
  const centre = new THREE.Mesh(new THREE.BoxGeometry(18, 20, 18), stone); centre.position.y = 10; g.add(centre);
  const lat = -200;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + 0.4;
  scene.add(g);
}

// Vesuvio: the twin-humped cone over the Bay of Naples.
function vesuvio(scene, s) {
  const slope = new THREE.MeshStandardMaterial({ color: 0x4f5a44, roughness: 1 });
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(60, 340, 150, 18), slope);
  cone.position.y = 75; g.add(cone);
  const somma = new THREE.Mesh(new THREE.CylinderGeometry(50, 200, 88, 14), slope);
  somma.position.set(180, 44, 60); g.add(somma);
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(58, 62, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0x3a352e, roughness: 1 }));
  crater.position.y = 150; g.add(crater);
  const lat = -700;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat) - 10;
  scene.add(g);
}

export function buildItalyA1(scene, registry) {
  const tex = facadeTexture(83);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // Roma off the GRA: ochre fabric, the dome and the arena on the horizon
  euroCity(scene, 300, 20000, 'italia', 4011, 1.2);
  colosseum(scene, 6500);
  sanPietro(scene, 3500);
  stonePines(scene, 0, 20000, 4021, 60);

  euroTown(scene, 38000, 43000, 'italia', 4012);     // Colleferro
  euroTown(scene, 69000, 76000, 'italia', 4013);     // Frosinone
  euroTown(scene, 114000, 121000, 'italia', 4014);   // Cassino
  montecassino(scene, 122000);
  euroTown(scene, 189000, 200000, 'italia', 4015);   // Capua / Caserta
  reggiaDiCaserta(scene, 194000);

  // NAPOLI under Vesuvio, the bay beyond
  euroCity(scene, 198000, 225000, 'italia', 4016, 1.4);
  skyline(scene, registry, 8110, 219000, 224000, 90, 240, 420, 26, 60);  // Centro Direzionale
  vesuvio(scene, 213000);
  sideWater(scene, 216000, 225000, 320, 320);        // the Bay of Naples

  // THE APENNINES: the ranges wall the Valle Latina the whole way down —
  // Prenestini/Ernici and then the big Mainarde/Matese massifs to the
  // north-east, the lower Lepini/Ausoni/Aurunci chain to the south-west.
  mountainRange(scene, 8000, 100000, 1, { hMin: 150, hMax: 280, latMin: 550, latMax: 950, seed: 6011 });
  mountainRange(scene, 95000, 175000, 1, { hMin: 240, hMax: 420, latMin: 520, latMax: 980, seed: 6012 }); // Mainarde/Matese: the big ones
  mountainRange(scene, 170000, 212000, 1, { hMin: 140, hMax: 260, latMin: 560, latMax: 900, seed: 6013 });
  mountainRange(scene, 14000, 120000, -1, { hMin: 110, hMax: 220, latMin: 520, latMax: 880, seed: 6014 }); // Lepini/Ausoni
  mountainRange(scene, 118000, 165000, -1, { hMin: 140, hMax: 260, latMin: 540, latMax: 900, seed: 6015 }); // Aurunci at Cassino

  // the Valle Latina: olives, vines and umbrella pines between the ridges
  buildTrees(scene, 4031, 15000, 110000, 18, 16, 220, 0);
  buildTrees(scene, 4041, 138000, 205000, 18, 16, 220, 0);
  forestBand(scene, 4051, 110000, 138000, 9, true);  // wooded Apennine pinch at Cassino
  stonePines(scene, 180000, 225000, 4061, 80);

  // barriere: Roma Sud + Napoli Nord (closed Telepass system)
  for (const s of [5000, 211000]) {
    jn(scene, registry, s - 900, ['BARRIERA 900 m', 'Telepass ⟩⟩⟩', 'CORSIE GIALLE'], '#e8b400');
    buildTollPlaza(scene, registry, s, IT_TOLL_SIGNS);
  }

  // paesi arroccati: hilltop villages perched on the Apennine foothills the
  // whole way down the valley — the signature view of the Autostrada del Sole
  hamletBelt(scene, 15000, 205000, 'italia', 6661, { spacing: 6500, latMin: 360, latMax: 680, yLift: [12, 55] });

  serviceArea(scene, registry, 48000, 'AUTOGRILL · LA MACCHIA', '#e0121a');
  serviceArea(scene, registry, 150000, 'AUTOGRILL · TEANO', '#e0121a');
  sosPosts(scene, 0, 225000);
  delineatorPosts(scene, 0, 225000, 'italy');
  noiseBarriers(scene, [[1000, 16000, 1], [202000, 223000, -1]], 0x7e897f);

  // paesi on their hilltops down the valley
  for (const [vs, side, seed] of [[22000, 1, 4111], [48000, -1, 4112], [60000, 1, 4113],
    [82000, -1, 4114], [96000, 1, 4115], [130000, -1, 4116], [146000, 1, 4117],
    [158000, -1, 4118], [170000, 1, 4119], [184000, -1, 4120]]) {
    euroVillage(scene, vs, side, 'italia', seed);
  }

  jn(scene, registry, 5500,   ['ROMA SUD', 'G.R.A. · SS Appia', 'A1 · NAPOLI ▼']);
  jn(scene, registry, 30000,  ['VALMONTONE', 'OUTLET', 'USCITA 1 km']);
  jn(scene, registry, 72000,  ['FROSINONE', 'SORA · CIOCIARIA', 'A1 · NAPOLI']);
  jn(scene, registry, 118000, ['CASSINO', 'MONTECASSINO ✝', 'ABBAZIA']);
  jn(scene, registry, 162000, ['CAIANELLO', 'VENAFRO · ISERNIA', 'A1 · NAPOLI']);
  jn(scene, registry, 198000, ['CASERTA SUD', 'REGGIA 🏛', 'NAPOLI 25 km']);
  jn(scene, registry, 221000, ['NAPOLI', 'CENTRO · PORTO ⛴', 'TANGENZIALE']);
}

/* ========================= SWITZERLAND · A1/N1 ========================= */

// The high Alps: colossal snow-capped peaks — the Eiger/Mönch/Jungfrau wall
// above Interlaken, Pilatus over Luzern, Mont-Blanc across the Léman. These
// are the tallest meshes in the sim: bare grey rock with a bright snow cap on
// the summit, rooted well below the plain so nothing floats.
function snowPeaks(scene, s0, s1, side, opts = {}) {
  const {
    hMin = 900, hMax = 2400, latMin = 900, latMax = 2800,
    spacing = 3400, seed = 7001,
  } = opts;
  const rockGeo = new THREE.ConeGeometry(1, 1, 8); rockGeo.translate(0, 0.5, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6f74, roughness: 1 });
  const snowGeo = new THREE.ConeGeometry(1, 1, 8); snowGeo.translate(0, 0.5, 0);
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.8 });
  const rand = rng(seed);
  const rocks = [], caps = [];
  for (let s = s0; s < s1; s += spacing * (0.6 + rand() * 0.8)) {
    const h = hMin + rand() * (hMax - hMin);
    const r = h * (0.8 + rand() * 0.45);
    const lat = side * (latMin + rand() * (latMax - latMin)) + r * 0.2;
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = -60;   // deep roots so the giants never float over the valley
    rocks.push({ pos, rot: rand() * TAU, sx: r, sy: h, sz: r * (0.85 + rand() * 0.4) });
    // snow cap over the top ~40% of the peak
    caps.push({
      pos: pos.clone().setY(pos.y + h * 0.58), rot: rand() * TAU,
      sx: r * 0.48, sy: h * 0.44, sz: r * 0.46,
    });
  }
  scatterInstanced(scene, rockGeo, rockMat, rocks, { shadow: false });
  scatterInstanced(scene, snowGeo, snowMat, caps, { shadow: false });
}

// Bern's Bundeshaus: the sandstone federal palace under its oxidised green
// copper cupola.
function bundeshaus(scene, s) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 0.9 });
  const copper = new THREE.MeshStandardMaterial({ color: 0x3f7d68, roughness: 0.6, metalness: 0.3 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(56, 16, 20), stone); body.position.y = 8; g.add(body);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 16), stone); wingL.position.set(-32, 6, 0); g.add(wingL);
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 16), stone); wingR.position.set(32, 6, 0); g.add(wingR);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 8, 14), stone); drum.position.set(0, 18, 0); g.add(drum);
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), copper);
  cupola.scale.y = 1.15; cupola.position.set(0, 22, 0); g.add(cupola);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 4, 8), copper); lantern.position.set(0, 33, 0); g.add(lantern);
  const lat = -150;
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + 0.4;
  scene.add(g);
}

// Genève's Jet d'Eau: the 140-metre plume of water standing off the lakefront.
function jetDeau(scene, s) {
  const water = new THREE.MeshStandardMaterial({
    color: 0xdff0f8, roughness: 0.25, transparent: true, opacity: 0.82,
    emissive: 0x9fc6dd, emissiveIntensity: 0.25,
  });
  const lat = -300;
  const base = posAt(s, lat, new THREE.Vector3()); base.y = groundY(s, lat);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 3.6, 140, 12), water);
  jet.position.copy(base); jet.position.y += 70;
  scene.add(jet);
  const plume = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), water);
  plume.scale.set(1, 1.9, 1);
  plume.position.copy(base); plume.position.y += 142;
  scene.add(plume);
}

// Swiss motorway service-area sign brand (the state Raststätte green).
export function buildSwitzerland(scene, registry) {
  const tex = facadeTexture(88);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // ── INTERLAKEN · BERNER OBERLAND: the town between its two lakes, under the
  //    Eiger–Mönch–Jungfrau wall filling the whole southern horizon ──
  euroTown(scene, 3000, 12000, 'swiss', 5011);                 // Interlaken
  euroTown(scene, 20000, 27000, 'swiss', 5012);                // Brienz chalets
  sideWater(scene, 0, 12000, -280, 300);                       // Thunersee to the west
  sideWater(scene, 18000, 30000, 300, 340);                    // Brienzersee to the east
  snowPeaks(scene, 0, 40000, 1, { hMin: 1400, hMax: 2600, latMin: 1100, latMax: 2900, seed: 7011 }); // the Jungfrau wall
  snowPeaks(scene, 0, 40000, -1, { hMin: 900, hMax: 1700, latMin: 1300, latMax: 3000, seed: 7012 });

  // ── BRÜNIG: the pass down to the Vierwaldstättersee, forest and peaks ──
  snowPeaks(scene, 34000, 66000, 1, { hMin: 1000, hMax: 2100, latMin: 900, latMax: 2400, seed: 7013 });
  snowPeaks(scene, 34000, 66000, -1, { hMin: 800, hMax: 1600, latMin: 1000, latMax: 2600, seed: 7014 });
  forestBand(scene, 5031, 30000, 60000, 8, true);
  euroVillage(scene, 46000, -1, 'swiss', 5013, { latMin: 120, latMax: 260, yLift: 30 }); // Lungern
  euroVillage(scene, 56000, 1, 'swiss', 5014, { latMin: 120, latMax: 240, yLift: 18 });  // Sarnen

  // ── LUZERN on the Vierwaldstättersee, Pilatus and the Rigi behind ──
  euroCity(scene, 62000, 92000, 'swiss', 5015, 1.0);
  sideWater(scene, 68000, 95000, -300, 360);                   // Vierwaldstättersee
  snowPeaks(scene, 60000, 95000, 1, { hMin: 900, hMax: 1900, latMin: 900, latMax: 2200, seed: 7015 }); // Pilatus / Rigi

  // ── ZUG on its lake ──
  euroTown(scene, 100000, 116000, 'swiss', 5016);
  sideWater(scene, 98000, 120000, 300, 300);                   // Zugersee

  // ── ZÜRICH · LIMMAT: the biggest city, the money — dense fabric, a real
  //    skyline (Prime Tower), and the Zürichsee reaching south-east ──
  euroCity(scene, 120000, 162000, 'swiss', 5017, 1.4);
  skyline(scene, registry, 8210, 138000, 150000, 80, 220, 400, 30, 72);
  sideWater(scene, 120000, 138000, 300, 320);                  // Zürichsee
  churchTower(scene, 144000, -1, 'swiss');                     // Grossmünster

  // ── AARGAU · MITTELLAND: the flatter industrious heartland, towns and farms ──
  euroTown(scene, 168000, 176000, 'swiss', 5018);              // Baden
  euroTown(scene, 184000, 192000, 'swiss', 5019);              // Aarau
  forestBand(scene, 5041, 196000, 210000, 7, false);

  // ── BERN · BUNDESSTADT: the federal capital, the Bundeshaus, the Münster spire ──
  euroCity(scene, 210000, 250000, 'swiss', 5020, 1.15);
  bundeshaus(scene, 232000);
  churchTower(scene, 236000, 1, 'swiss');                      // the Berner Münster
  sideWater(scene, 226000, 240000, -260, 150);                 // the Aare loop

  // ── FRIBOURG · FREIBURG: the bilingual Röstigraben, old town on its bluff,
  //    the pre-Alps rising again to the south ──
  euroTown(scene, 258000, 268000, 'swiss', 5021);
  hamletBelt(scene, 252000, 292000, 'swiss', 5661, { spacing: 7000, latMin: 320, latMax: 620, yLift: [10, 40] });
  snowPeaks(scene, 252000, 296000, 1, { hMin: 700, hMax: 1500, latMin: 1100, latMax: 2600, seed: 7016 }); // Gruyère pre-Alps

  // ── LAUSANNE · LÉMAN: French Switzerland now — pale Romandie fabric climbing
  //    from the lake, the Lavaux vine terraces above the water ──
  euroCity(scene, 296000, 346000, 'france', 5022, 1.15);
  sideWater(scene, 300000, 348000, -320, 420);                 // Lac Léman
  buildTrees(scene, 5051, 300000, 346000, 16, 30, 160, 0);     // Lavaux vineyards / slopes
  churchTower(scene, 320000, 1, 'france');                     // Cathédrale de Lausanne

  // ── GENÈVE · LÉMAN: the end of the run — the Jet d'Eau on the lake, the city
  //    around the Rade, and Mont-Blanc and the Savoy Alps across the water ──
  euroCity(scene, 348000, 408000, 'france', 5023, 1.35);
  skyline(scene, registry, 8220, 392000, 404000, 90, 220, 380, 24, 54);
  sideWater(scene, 348000, 410000, -340, 460);                 // the Rade / Lac Léman
  jetDeau(scene, 402000);
  snowPeaks(scene, 348000, 410000, -1, { hMin: 1400, hMax: 2800, latMin: 1600, latMax: 3400, seed: 7017 }); // Mont-Blanc / Savoy across the lake

  // distant chalet hamlets perched on the Oberland and pre-Alp foothills
  hamletBelt(scene, 4000, 118000, 'swiss', 5771, { spacing: 6500, latMin: 340, latMax: 720, yLift: [18, 90] });

  // the Continental forest carpet through the Mittelland and the Jura foothills
  buildTrees(scene, 5061, 60000, 210000, 20, 18, 240, 0);

  // NO toll booths in Switzerland — a vignette sticker instead. The signs at
  // the border and the first service areas remind you.
  jn(scene, registry, 4000, ['🇨🇭 SCHWEIZ · SUISSE', 'AUTOBAHNVIGNETTE', 'OBLIGATORISCH'], '#c8102e');
  jn(scene, registry, 250000, ['VIGNETTE', 'AUTOROUTE · OBLIGATOIRE', 'CHF 40'], '#0b7d3e');

  serviceArea(scene, registry, 88000, 'RASTSTÄTTE · LUZERN', '#0b7d3e');
  serviceArea(scene, registry, 205000, 'RASTSTÄTTE · GUNZGEN', '#0b7d3e');
  serviceArea(scene, registry, 336000, 'AIRE · LA CÔTE', '#0b7d3e');
  sosPosts(scene, 0, 410000);
  delineatorPosts(scene, 0, 410000, 'swiss');
  noiseBarriers(scene, [[118000, 160000, -1], [210000, 250000, 1], [372000, 408000, -1]], 0x6f8f8b);

  // more chalet / Dorf clusters down the whole route
  for (const [vs, side, seed] of [[26000, 1, 5111], [52000, -1, 5112], [90000, 1, 5113],
    [110000, -1, 5114], [170000, 1, 5115], [198000, -1, 5116], [244000, 1, 5117],
    [278000, -1, 5118], [334000, 1, 5119], [360000, -1, 5120]]) {
    euroVillage(scene, vs, side, side < 0 && vs > 292000 ? 'france' : 'swiss', seed);
  }

  jn(scene, registry, 16000,  ['INTERLAKEN', 'THUN · BERN ▲', 'BRÜNIG · LUZERN ▼']);
  jn(scene, registry, 82000,  ['LUZERN', 'ZENTRUM · KKL', 'A14 · ZUG · ZÜRICH']);
  jn(scene, registry, 142000, ['ZÜRICH', 'CITY · HB', 'A1 · BERN ▼']);
  jn(scene, registry, 232000, ['BERN', 'ZENTRUM · BUNDESHAUS', 'A1 · LAUSANNE ▼']);
  jn(scene, registry, 262000, ['FRIBOURG', 'FREIBURG · BULLE', 'A12 · LAUSANNE']);
  jn(scene, registry, 300000, ['LAUSANNE', 'CENTRE · OUCHY ⛴', 'A1 · GENÈVE ▼']);
  jn(scene, registry, 404000, ['GENÈVE', 'CENTRE · RIVE · LAC', 'AÉROPORT ✈']);
}
