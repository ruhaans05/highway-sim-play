import * as THREE from 'three';
import {
  posAt, headingAt, medianHalfAt, pavedHalfAt, njGapAt, buildRibbon,
} from './road.js';
import { LANE_WIDTH } from './config.js';
import {
  groundY, buildTrees, buildSuburb, buildNoiseWall, scatterInstanced, facadeTexture,
  deepSprawl, farRidge,
} from './environment.js';
import {
  welcomeSign, gantry, textBoard, buildTollPlaza, skyline, water, viaductPiers, port,
} from './turnpike.js';

// Garden State Parkway, the WHOLE 172 miles at true scale (s = mile · 1609):
// Cape May's salt marshes → the shore exits and the Great Egg Harbor crossing
// → Atlantic City rising off to the east → the long dark Pine Barrens → the
// Ocean County sprawl → Monmouth's local/express run (Exit 105 → Driscoll
// Bridge over the Raritan) → the classic urban north past Newark and Paterson
// into the wooded Bergen highlands and the NY line. Tree-lined essentially the
// whole way: you should almost never see open ground past the tree wall.

const TAU = Math.PI * 2;

// A SOLID tree wall right up to the shoulder — dense enough that you see
// nothing beyond the trees. Three tight rows here; forestFill (main.js) stacks
// the deep woods behind so the canopy runs to the horizon.
function forestBand(scene, seed, s0, s1, tight = 6, pine = false) {
  buildTrees(scene, seed,     s0, s1, 6,  tight,      tight + 22, 0, pine);   // solid near wall
  buildTrees(scene, seed + 1, s0, s1, 7,  tight + 2,  tight + 26, 0, !pine);
  buildTrees(scene, seed + 2, s0, s1, 8,  tight + 8,  80, 0, pine);           // second rank
}

// Trees planted down the middle of the wide grassy median: you can't see the
// opposing side through them. Placed near the centerline, so they bypass the
// usual off-road clamp. Pitch pines through the Barrens, hardwood up north.
function medianTrees(scene, s0, s1, pine = false) {
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.5, 5); trunkGeo.translate(0, 1.25, 0);
  const crownGeo = pine ? new THREE.ConeGeometry(1.4, 4.2, 7) : new THREE.IcosahedronGeometry(1.7, 0);
  crownGeo.translate(0, pine ? 3.8 : 4.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: pine ? 0x2c4a2e : 0x33602b, roughness: 1 });
  let a = 20260701 + (s0 | 0);
  const rand = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const places = [];
  for (let s = s0; s < s1; s += 5 + rand() * 4) {
    const half = medianHalfAt(s);
    if (half < 6) continue;                    // pinched bridge medians stay clear
    // stay inside the grass median, off both inner shoulders
    const lat = (rand() - 0.5) * Math.max(0, half - 3) * 1.4;
    const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
    const sc = 1.1 + rand() * 1.8;
    places.push({ pos, rot: rand() * TAU, sx: sc, sy: sc * (1 + rand() * 0.5), sz: sc });
  }
  scatterInstanced(scene, trunkGeo, trunkMat, places, { shadow: false });
  scatterInstanced(scene, crownGeo, crownMat, places, { shadow: false });
}

// Trees in the strip BETWEEN the local and express carriageways (Exit 105 →
// Driscoll): on the real Parkway there are long stretches where you can't see
// the local lanes from the express lanes through the trees.
function gapTrees(scene, s0, s1) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 2.4, 5); trunkGeo.translate(0, 1.2, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.5, 0); crownGeo.translate(0, 3.9, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x3a662f, roughness: 1 });
  let a = 77118822 + (s0 | 0);
  const rand = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const places = [];
  for (let s = s0; s < s1; s += 6 + rand() * 5) {
    const gap = njGapAt(s);
    if (gap < 5) continue;
    for (const side of [-1, 1]) {
      if (rand() < 0.2) continue;
      const center = side * (medianHalfAt(s) + 3 * LANE_WIDTH + gap / 2);
      const lat = center + (rand() - 0.5) * (gap - 5);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat) + 0.2;
      const sc = 0.9 + rand() * 1.5;
      places.push({ pos, rot: rand() * TAU, sx: sc, sy: sc * (1 + rand() * 0.5), sz: sc });
    }
  }
  scatterInstanced(scene, trunkGeo, trunkMat, places, { shadow: false });
  scatterInstanced(scene, crownGeo, crownMat, places, { shadow: false });
}

// Grass strip + edge lines over the local/express separation (the divider is
// grass with guiderail, not pavement).
function gapStrip(scene, s0, s1) {
  const grass = new THREE.MeshStandardMaterial({ color: 0x4f7040, roughness: 1 });
  const white = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  for (const side of [-1, 1]) {
    const center = s => side * (medianHalfAt(s) + 3 * LANE_WIDTH + njGapAt(s) / 2);
    scene.add(new THREE.Mesh(buildRibbon(
      s => center(s) - Math.max(0, njGapAt(s) / 2 - 0.9),
      s => center(s) + Math.max(0, njGapAt(s) / 2 - 0.9), 0.05, 0.05, 12, s0, s1), grass));
    const eIn = s => side * (medianHalfAt(s) + 3 * LANE_WIDTH + 0.15);
    const eOut = s => side * (medianHalfAt(s) + 3 * LANE_WIDTH + njGapAt(s) - 0.15);
    scene.add(new THREE.Mesh(buildRibbon(s => eIn(s) - 0.08, s => eIn(s) + 0.08, 0.03, 0.03, 10, s0, s1), white));
    scene.add(new THREE.Mesh(buildRibbon(s => eOut(s) - 0.08, s => eOut(s) + 0.08, 0.03, 0.03, 10, s0, s1), white));
  }
}

// A service area: building + fuel canopy, in the median (latOff 0) or off the
// shoulder (latOff ±). Named, the way NJ names its rest stops after locals.
function restStop(scene, registry, s, name, latOff = 0) {
  const conc = new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.25, metalness: 0.5 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.9 });
  const g = new THREE.Group();
  const build = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 14), glass); build.position.y = 3; g.add(build);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 16), roofMat); roof.position.y = 6.3; g.add(roof);
  // fuel canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 8), conc); canopy.position.set(0, 5, -14); g.add(canopy);
  for (const dx of [-6, 0, 6]) { const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), conc); col.position.set(dx, 2.5, -14); g.add(col); }
  const sign = textBoard([name, 'SERVICE AREA', '⛽ FOOD · FUEL'], 7, 3.4, '#046a38', '#fff');
  sign.position.set(0, 9, 8); g.add(sign);
  registry.signs.push({ userData: { board: sign } });
  g.position.copy(posAt(s, latOff, new THREE.Vector3()));
  g.position.y = groundY(s, latOff) + (latOff === 0 ? 0.2 : 0);
  g.rotation.y = headingAt(s);
  scene.add(g);
}

// Overhead guide gantry, boards both directions (parkway guide signs).
function jn(scene, registry, s, lines) {
  const a = textBoard(lines, 7, 3.4, '#046a38', '#fff');
  const b = textBoard(lines, 7, 3.4, '#046a38', '#fff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 6.8);
}

// Named barrier toll: advance purple E-ZPass boards each way + the plaza.
function toll(scene, registry, s, name) {
  const mk = () => textBoard([name.toUpperCase() + ' TOLL', 'E-ZPass · EXPRESS KEEP LEFT'], 13, 3.2, '#3d1d63', '#ffffff');
  const a = mk(); a.rotation.y = Math.PI;
  gantry(scene, registry, s - 500, [{ lat: -6, mesh: a }], 6.9);
  gantry(scene, registry, s + 500, [{ lat: 6, mesh: mk() }], 6.9);
  buildTollPlaza(scene, registry, s);
}

// E-ZPass pavement decal, shared texture: purple patch, white marque
let ezDecalTex = null;
function ezTex() {
  if (ezDecalTex) return ezDecalTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3d1d63'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(8, 8, 112, 240);
  g.fillStyle = '#ffffff'; g.textAlign = 'center';
  g.font = 'bold italic 40px "Helvetica Neue", Arial, sans-serif';
  g.save(); g.translate(64, 128); g.rotate(-Math.PI / 2);
  g.fillText('E-ZPass', 0, 14); g.restore();
  ezDecalTex = new THREE.CanvasTexture(c);
  ezDecalTex.colorSpace = THREE.SRGBColorSpace;
  return ezDecalTex;
}

// Open-road tolling: the modern GSP barriers. No booths — a steel gantry with
// scanner heads and cameras over full-speed lanes, purple E-ZPass boards, an
// advance "E-ZPass ACCEPTED · MAINTAIN SPEED" sign, TOLL BY MAIL signage for
// the tagless, and E-ZPass decals painted on every lane.
function orToll(scene, registry, s, name) {
  // advance + toll-by-mail signs, each bound (−lat shoulder serves +s traffic)
  const sign = (atS, lines, w) => {
    const a = textBoard(lines, w, 3.4, '#3d1d63', '#ffffff'); a.rotation.y = Math.PI;
    gantry(scene, registry, atS, [{ lat: -6, mesh: a }], 6.9);
    gantry(scene, registry, 2 * s - atS, [{ lat: 6, mesh: textBoard(lines, w, 3.4, '#3d1d63', '#ffffff') }], 6.9);
  };
  sign(s - 750, [name.toUpperCase() + ' TOLL 1/2 MILE', 'E-ZPass ACCEPTED', 'MAINTAIN SPEED'], 12);
  sign(s - 220, ['NO CASH · NO STOPPING', 'NO E-ZPASS? TOLL BY MAIL', 'INVOICE MAILED TO OWNER'], 12.5);

  // the scanner gantry itself: purple marque boards + reader heads + cameras
  const mkTag = () => textBoard(['E-ZPass', name.toUpperCase() + ' TOLL'], 5.6, 2.3, '#3d1d63', '#ffffff');
  const tagA = mkTag(); tagA.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: tagA }, { lat: 6, mesh: mkTag() }], 7.0);
  const steel = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.5, metalness: 0.6 });
  const scanGeo = new THREE.BoxGeometry(0.55, 0.4, 0.8);
  const camGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.5, 8);
  const half = pavedHalfAt(s) - 0.5;
  const heading = headingAt(s);
  for (let lat = -half + LANE_WIDTH / 2; lat < half; lat += LANE_WIDTH) {
    const box = new THREE.Mesh(scanGeo, steel);
    box.position.copy(posAt(s, lat, new THREE.Vector3()));
    box.position.y += 6.3;
    box.rotation.y = heading;
    scene.add(box);
    const cam = new THREE.Mesh(camGeo, steel);
    cam.position.copy(box.position);
    cam.position.y += 0.55;
    cam.rotation.z = 0.5;
    scene.add(cam);
  }

  // painted E-ZPass lane decals ~70 m ahead of the gantry for each bound
  const decGeo = new THREE.PlaneGeometry(1.1, 3.2);
  const decMat = new THREE.MeshStandardMaterial({
    map: ezTex(), transparent: true, roughness: 0.9, polygonOffset: true,
    polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  for (const dir of [1, -1]) {
    const ds = s - dir * 70;
    const mh = medianHalfAt(ds), ph = pavedHalfAt(ds) - 0.5;
    for (let lane = mh + LANE_WIDTH / 2; lane < ph; lane += LANE_WIDTH) {
      const lat = -dir * lane;      // +s traffic drives the lat<0 side
      const d = new THREE.Mesh(decGeo, decMat);
      d.position.copy(posAt(ds, lat, new THREE.Vector3()));
      d.position.y += 0.04;
      d.rotation.x = -Math.PI / 2;
      d.rotation.z = -headingAt(ds) + (dir > 0 ? 0 : Math.PI);
      scene.add(d);
    }
  }
}

// Girder bridge dressing: side girders + piers + the water below.
function riverBridge(scene, s0, s1, waterLen, waterWide) {
  const girder = new THREE.MeshStandardMaterial({ color: 0x77828c, roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const latF = s => side * (pavedHalfAt(s) + 0.5);
    scene.add(new THREE.Mesh(buildRibbon(latF, latF, -1.4, 1.15, 10, s0, s1), girder));
  }
  viaductPiers(scene, s0 - 100, s1 + 100);
  water(scene, (s0 + s1) / 2, waterLen, waterWide);
}

// Coastal salt marsh: flat brackish grass plane flanking the road (Cape May /
// Great Egg) — open on purpose, it's the one honest gap in the tree wall.
function saltMarsh(scene, s, length, width) {
  const marsh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x5d7050, roughness: 0.95 })
  );
  marsh.rotation.x = -Math.PI / 2;
  marsh.position.copy(posAt(s, 0, new THREE.Vector3()));
  marsh.position.y = -0.6;
  marsh.rotation.z = -headingAt(s);
  scene.add(marsh);
}

function buildNewark(scene, registry) {
  // downtown Newark sits a couple of km EAST of the parkway and only north of
  // the Essex toll — through Woodbridge/Rahway/Union nothing big overlooks
  // the road, so the skyline starts at the toll and stands well back
  skyline(scene, registry, 7710, 229000, 240000, 26, 500, 1100, 55, 135, [-1]);
}
function buildPaterson(scene, registry) {
  skyline(scene, registry, 7720, 253000, 260000, 30, 130, 360, 40, 95, [-1]);
}

export function buildGsp(scene, registry) {
  const tex = facadeTexture(29);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, color: 0xffffff,
  })];

  // ------------------------------------------------------------------ trees
  // a SOLID tree wall essentially the whole 172 miles — broken only where the
  // road rides out over open water/marsh. Cities poke ABOVE the trees.
  forestBand(scene, 7601, 3000, 42500, 8);                 // Cape May → shore exits
  forestBand(scene, 7605, 46800, 66000, 7);                // Somers Point → Absecon
  forestBand(scene, 7611, 66000, 112000, 6, true);         // PINE BARRENS: pitch-pine wall
  forestBand(scene, 7617, 112000, 168800, 7);              // Ocean county → Monmouth
  forestBand(scene, 7623, 168800, 202500, 7);              // local/express run
  forestBand(scene, 7629, 206200, 253000, 7);              // Woodbridge → Paterson
  forestBand(scene, 7635, 253000, 279000, 5);              // Bergen highlands: tightest walls
  // The shore exits are developed coastal New Jersey, with dense natural tree
  // cover hiding subdivisions and commercial strips. Add deep canopy behind
  // the close forest wall so no generic open terrain leaks through it.
  buildTrees(scene, 7650, 3000, 42500, 12, 75, 300, 0, false, 1.2);
  buildTrees(scene, 7651, 46800, 66000, 12, 80, 320, 0, true, 1.18);
  buildTrees(scene, 7652, 112000, 168800, 13, 85, 350, 0, false, 1.22);
  // trees down the wide medians: the Barrens (pines) and the northern woods
  medianTrees(scene, 68000, 110000, true);
  medianTrees(scene, 120000, 152000);
  medianTrees(scene, 263000, 279000);

  // -------------------------------------------------- Cape May & the shore
  welcomeSign(scene, registry, 700, 1, ['GARDEN STATE PKWY', 'MILE 0 · CAPE MAY', 'NORTH: NY 172 MI'], '#046a38');
  welcomeSign(scene, registry, 1600, -1, ['END GARDEN STATE PKWY', 'CAPE MAY · NJ-109', 'LEWES FERRY →'], '#046a38');
  saltMarsh(scene, 2200, 4200, 1600);                      // Cape May wetlands
  jn(scene, registry, 6400, ['EXIT 4B', 'NJ-47', 'WILDWOOD']);
  // shore towns off to the EAST past the trees (low beach-town carpet)
  deepSprawl(scene, 8101, 3000, 42500, { density: 0.95, towers: false, latStart: 55 });
  buildNoiseWall(scene, 14500, 32000, { seed: 7653, height: 5.2, margin: 4, step: 12, gapChance: 0.05 });
  jn(scene, registry, 27400, ['EXIT 17', 'SEA ISLE CITY', 'AVALON']);
  restStop(scene, registry, 29400, 'OCEAN VIEW', -55);
  orToll(scene, registry, 32000, 'Cape May');

  // Great Egg Harbor Bay: twin spans over open water and salt marsh
  saltMarsh(scene, 43000, 3000, 2200);
  saltMarsh(scene, 46200, 2400, 2000);
  riverBridge(scene, 43400, 45800, 3000, 2600);
  jn(scene, registry, 42200, ['GREAT EGG HARBOR', 'BAY CROSSING', 'REDUCED SPEED']);
  orToll(scene, registry, 46600, 'Great Egg');

  // ------------------------------------------------ Atlantic City corridor
  jn(scene, registry, 61100, ['EXIT 38', 'ATLANTIC CITY EXPWY', 'ATLANTIC CITY · PHILA']);
  // the casino skyline rising far off to the east over the trees
  skyline(scene, registry, 7740, 56000, 64500, 45, 620, 1150, 45, 115, [-1]);
  deepSprawl(scene, 8102, 46500, 66000, { density: 0.95, towers: false });
  buildNoiseWall(scene, 49200, 64500, { seed: 7654, height: 5.1, margin: 4, step: 12, gapChance: 0.06 });
  restStop(scene, registry, 66600, 'ATLANTIC CITY', 60);

  // ------------------------------------------------------- PINE BARRENS
  jn(scene, registry, 68500, ['ENTERING', 'PINELANDS NATIONAL', 'RESERVE']);
  riverBridge(scene, 78500, 79600, 900, 1500);             // Mullica River
  orToll(scene, registry, 81900, 'New Gretna');
  jn(scene, registry, 101400, ['EXIT 63', 'NJ-72 EAST', 'MANAHAWKIN · LBI']);
  orToll(scene, registry, 111000, 'Barnegat');

  // --------------------------------------------------------- Ocean County
  restStop(scene, registry, 122900, 'FORKED RIVER');
  jn(scene, registry, 131900, ['EXIT 82', 'NJ-37 EAST', 'TOMS RIVER · SEASIDE']);
  riverBridge(scene, 132750, 133350, 500, 1000);           // Toms River
  orToll(scene, registry, 134200, 'Toms River');
  // Toms River / Brick / Lakewood: real sprawl, both sides, malls + houses
  buildSuburb(scene, registry, 128000, 150000);
  deepSprawl(scene, 8103, 112000, 128000, { density: 1.0, towers: false });
  buildNoiseWall(scene, 113000, 131000, { seed: 7655, height: 5.5, margin: 4, step: 11, gapChance: 0.03 });
  jn(scene, registry, 157700, ['EXIT 98', 'I-195 WEST', 'TRENTON · SIX FLAGS']);
  deepSprawl(scene, 8104, 150000, 168000, { density: 1.05, towers: false });
  buildNoiseWall(scene, 137000, 166500, { seed: 7656, height: 5.6, margin: 4, step: 11, gapChance: 0.03 });
  restStop(scene, registry, 160900, 'MONMOUTH', -55);
  orToll(scene, registry, 167700, 'Asbury Park');

  // ------------------------------- Monmouth: the LOCAL / EXPRESS split
  jn(scene, registry, 169000, ['EXIT 105', 'NJ-36', 'EATONTOWN · LONG BRANCH']);
  const exprLat = s => medianHalfAt(s) + 1.5 * LANE_WIDTH;
  const loclLat = s => medianHalfAt(s) + 3 * LANE_WIDTH + njGapAt(s) + LANE_WIDTH;
  const splitBoards = (s, nb) => {
    const e = textBoard(['EXPRESS', '3 LANES · NO EXITS'], 8.5, 3.0, '#046a38', '#ffffff');
    const l = textBoard(['LOCAL', 'ALL EXITS'], 7, 3.0, '#046a38', '#ffffff');
    if (nb) { e.rotation.y = Math.PI; l.rotation.y = Math.PI; }
    const sgn = nb ? -1 : 1;
    gantry(scene, registry, s, [{ lat: sgn * exprLat(s), mesh: e }, { lat: sgn * loclLat(s), mesh: l }], 6.8);
  };
  splitBoards(170000, true);        // northbound split
  splitBoards(202600, false);       // southbound split (after the Driscoll)
  jn(scene, registry, 202000, ['LOCAL · EXPRESS', 'MERGE', '1/2 MILE']);
  jn(scene, registry, 170800, ['LOCAL · EXPRESS', 'SB MERGE AHEAD', '']);
  gapStrip(scene, 169500, 202900);
  // long runs where trees hide the local lanes from the express lanes
  gapTrees(scene, 171500, 177500);
  gapTrees(scene, 180500, 186500);
  gapTrees(scene, 189500, 196500);
  jn(scene, registry, 175400, ['EXIT 109', 'CR-520', 'RED BANK · LINCROFT']);
  jn(scene, registry, 183400, ['EXIT 114', 'HOLMDEL', 'PNC ARTS CENTER']);
  // Monmouth commuter suburbia never lets up
  deepSprawl(scene, 8105, 168000, 202000, { density: 0.85, towers: false });

  // ---------------------------------------- Raritan: Driscoll Bridge
  orToll(scene, registry, 201900, 'Raritan');
  restStop(scene, registry, 199200, 'JON BON JOVI');
  // the famous sign, southbound, right after you come off the Driscoll
  welcomeSign(scene, registry, 200900, -1, ['JON BON JOVI', 'SERVICE AREA', '1 MILE'], '#046a38');
  welcomeSign(scene, registry, 198100, 1, ['JON BON JOVI', 'SERVICE AREA', 'NEXT RIGHT'], '#046a38');
  jn(scene, registry, 203000, ['DRISCOLL BRIDGE', 'RARITAN RIVER', 'NJ-440 · I-287 AHEAD']);
  riverBridge(scene, 203500, 205100, 1500, 3000);
  jn(scene, registry, 205700, ['EXIT 127', 'I-287 · NJ-440', 'EDISON · PERTH AMBOY']);
  // Raritan-mouth industry + Perth Amboy off the east bank
  port(scene, 405, 205500, 206600);
  skyline(scene, registry, 7745, 205600, 208000, 60, 300, 620, 18, 55, [-1]);

  // -------------------------------------------------- the urban north
  // sprawl in EVERY direction: NJ never opens up between Woodbridge and the
  // Bergen woods — receding development both sides the whole way
  buildSuburb(scene, registry, 207000, 229000);
  // Central Jersey / Woodbridge: the Parkway is screened, but not empty —
  // dense hardwood rows, sound walls, and set-back industrial/suburban fabric
  // carry the road through the Rahway–Edison metro without open flatland.
  forestBand(scene, 7641, 202500, 229500, 6);
  buildTrees(scene, 7642, 205000, 229000, 13, 100, 390, 0, false, 1.12);
  buildNoiseWall(scene, 207000, 229000, { seed: 7643, height: 5.8, margin: 4.0, step: 10, gapChance: 0.02 });
  // towers only NORTH of the Essex toll; Woodbridge→Union is low sprawl
  deepSprawl(scene, 8106, 206500, 228000, { density: 1.1, towers: false });
  deepSprawl(scene, 8116, 228000, 253000, { density: 1.1 });
  deepSprawl(scene, 8107, 253000, 262000, { density: 0.8, towers: false });
  forestBand(scene, 7644, 229000, 253000, 6);
  buildTrees(scene, 7645, 229000, 253000, 15, 110, 430, 0, true, 1.08);
  buildNoiseWall(scene, 229000, 253000, { seed: 7646, height: 5.5, margin: 4.0, step: 10, gapChance: 0.03 });
  deepSprawl(scene, 8117, 229000, 253000, { density: 0.9, towers: false });
  // the Manhattan skyline wall far off to the EAST over the trees
  skyline(scene, registry, 7730, 234000, 252000, 26, 900, 1500, 90, 320, [-1]);
  // the wooded Highlands ridgeline to the NORTHWEST
  farRidge(scene, 4411, 236000, 279000, 1);

  // only the skylines poke above the trees
  buildNewark(scene, registry);
  buildPaterson(scene, registry);

  // the classic southbound SHORE POINTS reassurance, all the way down from
  // the NY line to where the shore exits actually start
  for (const sp of [265500, 246000, 227000, 209500, 191000, 160000, 121000])
    welcomeSign(scene, registry, sp, -1, ['PARKWAY SOUTH', 'SHORE POINTS', ''], '#046a38');

  // barrier toll plazas
  toll(scene, registry, 228000, 'Essex');
  toll(scene, registry, 267000, 'Bergen');

  // median service areas: Vauxhall + Montvale in the northern woods
  restStop(scene, registry, 230600, 'VAUXHALL');
  restStop(scene, registry, 273500, 'MONTVALE');

  // NJ / NY state line at the top, both directions (becomes the I-87 Thruway)
  welcomeSign(scene, registry, 275600, 1, ['WELCOME TO', 'NEW YORK', 'I-87 · THRUWAY'], '#12264a');
  welcomeSign(scene, registry, 275000, -1, ['WELCOME TO', 'NEW JERSEY', 'GARDEN STATE PKWY'], '#046a38');

  // control-city / interchange gantries (northern originals, at true mileposts)
  jn(scene, registry, 207500, ['EXIT 129', 'I-95 · NJ TPKE', 'NEW YORK · TRENTON']);
  jn(scene, registry, 225000, ['EXIT 140', 'US-22', 'UNION · SPRINGFIELD']);
  jn(scene, registry, 231000, ['EXIT 143', 'I-78', 'NEWARK · JERSEY CITY']);
  jn(scene, registry, 235000, ['EXIT 145', 'I-280', 'NEWARK · THE ORANGES']);
  jn(scene, registry, 251000, ['EXIT 153', 'NJ-3 EAST', 'SECAUCUS · LINCOLN TUNNEL']);
  jn(scene, registry, 259000, ['EXIT 159', 'NJ-208 · I-80', 'PATERSON · FAIR LAWN']);
  jn(scene, registry, 275000, ['NY STATE LINE', 'I-87 THRUWAY', 'TAPPAN ZEE · ALBANY']);
}
