import * as THREE from 'three';
import { posAt, headingAt, pavedHalfAt, buildRibbon } from './road.js';
import {
  groundY, facadeTexture, deepSprawl, farRidge, buildTrees, buildBillboards,
  lowLitMaterial, placementsAlong, scatterInstanced,
} from './environment.js';
import {
  gantry, textBoard, skyline, bridgeStructure, viaductPiers, water, welcomeSign, port,
} from './turnpike.js';
import { makeParkedCar, addNpcPlates } from './vehicles.js';
import { signalState } from './mumbai.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
boxGeo.translate(0, 0.5, 0);

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function urbanCarpet(scene, registry, seed, s0, s1, { towers = false, density = 1 } = {}) {
  deepSprawl(scene, seed, s0, s1, {
    density, towers, glowMat: registry.towerMats[0], litMat: lowLitMaterial(registry),
  });
}

function roadsideWall(scene, s0, s1, seed, height = 4.8) {
  const mats = [0xa6a39a, 0x8b918f, 0x777d79].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  for (const side of [-1, 1]) {
    const lat = s => side * (pavedHalfAt(s) + 2.2);
    scene.add(new THREE.Mesh(buildRibbon(lat, lat, 0, height, 24, s0, s1), mats[(seed + (side > 0 ? 1 : 0)) % mats.length]));
  }
}

function woodedCorridor(scene, s0, s1, seed, intensity = 1) {
  // Four overlapping bands make the road feel cut through forest rather than
  // bordered by decorative trees. The nearest band remains beyond the clear zone.
  buildTrees(scene, seed, s0, s1, Math.max(7, 15 / intensity), 34, 145, 48, false, 1.15);
  buildTrees(scene, seed + 1, s0, s1, Math.max(9, 20 / intensity), 120, 310, 72, false, 1.3);
  buildTrees(scene, seed + 2, s0, s1, Math.max(12, 28 / intensity), 280, 620, 105, false, 1.5);
  buildTrees(scene, seed + 3, s0, s1, Math.max(15, 36 / intensity), 560, 1050, 150, false, 1.7);
}

function forestedRidge(scene, s0, s1, seed, side, tall = false) {
  const rand = rng(seed);
  const ridgeGeo = new THREE.IcosahedronGeometry(1, 2);
  const ridgeMat = new THREE.MeshStandardMaterial({ color: tall ? 0x344b35 : 0x405941, roughness: 1, flatShading: true });
  const peaks = [];
  for (let s = s0; s < s1; s += 1500 + rand() * 1200) {
    const lat = side * (720 + rand() * 750);
    const p = posAt(s, lat, new THREE.Vector3());
    p.y = groundY(s, lat) - 22;
    peaks.push({
      pos: p, rot: rand() * Math.PI * 2,
      sx: 520 + rand() * 480, sy: (tall ? 130 : 85) + rand() * (tall ? 115 : 75), sz: 500 + rand() * 520,
    });
  }
  scatterInstanced(scene, ridgeGeo, ridgeMat, peaks, { shadow: false });
}

function mountainCut(scene, s0, s1) {
  const rock = new THREE.MeshStandardMaterial({ color: 0x575d55, roughness: 1, side: THREE.DoubleSide });
  const cap = new THREE.MeshStandardMaterial({ color: 0x324b34, roughness: 1, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const inner = s => side * (pavedHalfAt(s) + 2.8);
    const outer = s => side * (pavedHalfAt(s) + 22);
    scene.add(new THREE.Mesh(buildRibbon(inner, inner, 0, 13, 12, s0, s1), rock));
    scene.add(new THREE.Mesh(buildRibbon(inner, outer, 13, 18, 12, s0, s1), cap));
  }
}

function buildRuralPennsylvania(scene, registry) {
  // Hard corridor rule: Lebanon through Watchung is continuously enclosed by
  // woodland. These close overlapping bands prevent any bare grass horizon;
  // hills, cuts and distant Lehigh development rise behind the tree curtain.
  buildTrees(scene, 77990, 0, 215000, 8, 32, 105, 0, false, 1.28);
  buildTrees(scene, 77991, 0, 215000, 13, 88, 210, 0, false, 1.38);
  woodedCorridor(scene, 0, 62000, 78010, 1.25);
  woodedCorridor(scene, 62000, 105000, 78020, 0.9);
  woodedCorridor(scene, 105000, 125000, 78030, 1.05);
  woodedCorridor(scene, 125000, 175000, 78040, 1.3);
  woodedCorridor(scene, 175000, 215000, 78050, 1.35);
  forestedRidge(scene, 0, 62000, 78110, 1, true);
  forestedRidge(scene, 0, 66000, 78111, -1, true);
  forestedRidge(scene, 60000, 125000, 78112, 1, false);
  forestedRidge(scene, 66000, 125000, 78113, -1, false);
  forestedRidge(scene, 125000, 175000, 78120, -1, false);
  forestedRidge(scene, 155000, 215000, 78130, 1, true);
  farRidge(scene, 78140, 22000, 68000, -1);
  mountainCut(scene, 39000, 44500);
  mountainCut(scene, 181000, 186500);
  roadsideWall(scene, 188000, 200000, 1, 5.2);
  // The Lehigh Valley is developed but not a downtown canyon from I-78:
  // distribution buildings, subdivisions and industry sit behind wooded slopes.
  urbanCarpet(scene, registry, 78150, 65000, 108000, { towers: false, density: 0.62 });
}

function buildEssexTransition(scene, registry) {
  // Route 24 → Parkway → Newark uses the real 3-local / 2-express pattern in
  // each direction. It is a fully enclosed urban corridor: concrete between
  // the roadways, high sound walls outside, mature canopy, then dense sprawl.
  const s0 = 199800, s1 = 237300;
  roadsideWall(scene, s0, s1, 2, 7.2);
  const dividerMat = new THREE.MeshStandardMaterial({ color: 0xa6a39a, roughness: 0.96, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const splitLat = side * 11.4; // two express lanes inside, three local outside
    scene.add(new THREE.Mesh(buildRibbon(() => splitLat, () => splitLat, 0, 1.25, 18, 200700, 236400), dividerMat));
  }
  buildTrees(scene, 78200, s0, s1, 7.5, 39, 125, 0, false, 1.18);
  buildTrees(scene, 78201, s0, s1, 10, 105, 260, 0, false, 1.28);
  buildTrees(scene, 78202, s0, s1, 13, 230, 480, 0, false, 1.38);
  denseUrbanFabric(scene, registry, 78209, 215000, 238000, {
    near: 128, bands: 7, tallChance: 0.04, height: 58, lowMin: 4, lowMax: 18,
  });
  urbanCarpet(scene, registry, 78210, 199800, 238000, { towers: false, density: 1.7 });
  skyline(scene, registry, 78211, 220000, 232000, 48, 280, 880, 14, 46, [-1, 1]);
  skyline(scene, registry, 78213, 232000, 238000, 48, 420, 980, 20, 55, [-1]);
  buildBillboards(scene, registry, 78212, 200000, 238000, 18);
  // Parkway interchange and the many local streets cross above/below the
  // depressed lanes, keeping the enclosed section visually layered.
  for (const [s, seed, width] of [
    [203200, 521, 48], [207100, 522, 52], [210900, 523, 82],
    [212050, 524, 68], [216000, 525, 50], [220200, 526, 54],
    [225000, 527, 52], [230100, 528, 58], [234000, 529, 50],
  ]) urbanOverpass(scene, s, seed, width);
  for (const [s, lines] of [
    [201500, ['I-78 EAST EXPRESS', 'NEWARK · NEW YORK CITY']],
    [203000, ['I-78 EAST LOCAL', 'ALL EXITS · GARDEN STATE PARKWAY']],
    [208700, ['EXIT 52', 'GARDEN STATE PARKWAY · LOCAL LANES']],
    [212500, ['GARDEN STATE PARKWAY', 'NORTH · SOUTH']],
    [218500, ['I-78 EAST', 'NEWARK · NEW YORK CITY']],
    [225500, ['EXIT 57', 'NEWARK AIRPORT · US 1-9']],
    [231500, ['I-78 EAST · NEW YORK CITY', 'JERSEY CITY · HOLLAND TUNNEL']],
  ]) gantry(scene, registry, s, [{ lat: 0, mesh: textBoard(lines, 16, 3.5, '#046a38', '#ffffff') }], 7.2);
}

function buildLandmarkSkyline(scene, registry) {
  const addTower = (s, lat, width, depth, height, matIndex = 0, rot = 0) => {
    const tower = new THREE.Mesh(boxGeo, registry.towerMats[matIndex % registry.towerMats.length]);
    tower.position.copy(posAt(s, lat, new THREE.Vector3()));
    tower.position.y = groundY(s, lat);
    tower.scale.set(width, height, depth);
    tower.rotation.y = headingAt(s) + rot;
    scene.add(tower);
    return tower;
  };

  // Jersey City's close vertical cluster belongs at Newport/waterfront near
  // the eastern end, not along the whole Newark Bay/Hudson County approach.
  addTower(258000, 270, 44, 40, 205, 1, 0.08);
  addTower(258650, 350, 52, 44, 270, 2, -0.12);
  addTower(259050, 430, 38, 36, 225, 1, 0.16);

  // Lower Manhattan background, explicitly anchored by One World Trade Center.
  // Keep the whole cluster within the camera horizon from Jersey City and fan
  // it laterally across the windshield. Route-relative future coordinates put
  // downtown straight ahead; lateral offsets create the broad Hudson view.
  const wtcS = 263900, wtcLat = -90;
  const wtc = new THREE.Mesh(new THREE.CylinderGeometry(38, 55, 440, 4), registry.towerMats[1]);
  wtc.position.copy(posAt(wtcS, wtcLat, new THREE.Vector3()));
  wtc.position.y = groundY(wtcS, wtcLat) + 220;
  wtc.rotation.y = headingAt(wtcS) + Math.PI / 4;
  scene.add(wtc);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.2, 92, 8), registry.crownMats?.[5] || registry.towerMats[2]);
  spire.position.copy(wtc.position); spire.position.y += 266; scene.add(spire);
  for (const spec of [
    [263250, -1450, 58, 48, 175, 0], [263450, -1210, 48, 44, 235, 2],
    [263700, -930, 68, 54, 205, 0], [264050, -650, 45, 40, 285, 1],
    [263500, -390, 54, 46, 250, 2], [264250, 250, 66, 55, 315, 0],
    [263700, 510, 48, 42, 245, 1], [264150, 760, 72, 58, 210, 2],
    [263400, 1010, 52, 46, 270, 0], [263850, 1240, 44, 40, 190, 1],
    [263250, 1480, 62, 52, 155, 2],
  ]) addTower(...spec);
}

function roadsideAd(scene, s, side, lines, bg = '#f58220', fg = '#ffffff') {
  const lat = side * (pavedHalfAt(s) + 16);
  const board = textBoard(lines, 10.5, 4.4, bg, fg);
  board.position.copy(posAt(s, lat, new THREE.Vector3()));
  board.position.y += 6.3;
  board.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0);
  scene.add(board);
}

function urbanOverpass(scene, s, seed, widthExtra = 32) {
  const rand = rng(seed);
  const concrete = new THREE.MeshStandardMaterial({ color: 0x777a78, roughness: 0.95 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x303235, roughness: 0.97 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3f464c, roughness: 0.65, metalness: 0.45 });
  const g = new THREE.Group();
  const width = pavedHalfAt(s) * 2 + widthExtra;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.85, 10 + rand() * 5), asphalt);
  deck.position.y = 8.2; g.add(deck);
  for (const z of [-4.8, 4.8]) {
    const girder = new THREE.Mesh(new THREE.BoxGeometry(width, 1.05, 0.45), steel);
    girder.position.set(0, 7.35, z); g.add(girder);
  }
  for (const x of [-(pavedHalfAt(s) + 4.5), pavedHalfAt(s) + 4.5]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.5, 7.4, 3.0), concrete);
    pier.position.set(x, 3.7, 0); g.add(pier);
  }
  for (const x of [-width / 2 + 1, width / 2 - 1]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.25, 12), concrete);
    parapet.position.set(x, 9.0, 0); g.add(parapet);
  }
  g.position.copy(posAt(s, 0, new THREE.Vector3()));
  g.rotation.y = headingAt(s); scene.add(g);
}

function denseUrbanFabric(scene, registry, seed, s0, s1, {
  near = 80, bands = 5, tallChance = 0.2, height = 80,
  lowMin = 6, lowMax = 28,
} = {}) {
  const rand = rng(seed);
  const lots = [];
  const blocks = [];
  const lotColors = [0x484a4b, 0x4d4f50, 0x53514e];
  const blockColors = [0x7b4d3f, 0x966451, 0xaaa39a, 0x6f7477, 0x8a8177, 0x5d666c];
  // Each station is a differently sized city block. Random omissions create
  // cross streets, yards and glimpses into deeper sprawl instead of a wall of
  // buildings following the highway in a straight line.
  for (let s = s0 + 45; s < s1 - 35; s += 70 + rand() * 105) {
    for (const side of [-1, 1]) {
      for (let band = 0; band < bands; band++) {
        if (rand() < (band === 0 ? 0.16 : 0.25)) continue;
        const ss = s + (rand() - 0.5) * 95;
        const lat = side * (near + band * (54 + rand() * 22) + rand() * 24);
        const p = posAt(ss, lat, new THREE.Vector3());
        p.y = groundY(ss, lat) + 0.02;
        const clearance = Math.abs(lat) - pavedHalfAt(ss) - 22;
        const lotW = Math.min(42 + rand() * 50, Math.max(24, clearance * 1.65));
        const lotD = 55 + rand() * 95;
        lots.push({
          pos: p, rot: headingAt(ss) + (rand() - 0.5) * 0.28,
          sx: lotW, sy: 0.22, sz: lotD,
          color: new THREE.Color(lotColors[(rand() * lotColors.length) | 0]),
        });
        const count = 1 + (rand() < 0.48 ? 1 : 0) + (rand() < 0.22 ? 1 : 0);
        for (let i = 0; i < count; i++) {
          const bs = ss + (i - (count - 1) / 2) * (22 + rand() * 25);
          const bl = lat + side * ((rand() - 0.5) * 22);
          const bp = posAt(bs, bl, new THREE.Vector3());
          bp.y = groundY(bs, bl) + 0.16;
          const tall = rand() < tallChance + band * 0.012;
          const maxAcross = Math.max(12, (Math.abs(bl) - pavedHalfAt(bs) - 18) * 1.65);
          const sx = Math.min(15 + rand() * (tall ? 28 : 34), maxAcross);
          // Quarter-turn blocks only occur in the safely distant rings; close
          // buildings never swing their long footprint across the highway.
          const quarterTurn = band >= 2 && rand() < 0.3;
          blocks.push({
            pos: bp,
            rot: headingAt(bs) + (quarterTurn ? Math.PI / 2 : 0) + (rand() - 0.5) * 0.18,
            sx,
            sy: tall ? height * (0.55 + rand()) : lowMin + rand() * (lowMax - lowMin),
            sz: 16 + rand() * (tall ? 25 : 38),
            color: new THREE.Color(blockColors[(rand() * blockColors.length) | 0]),
          });
        }
      }
    }
  }
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), lots, { shadow: false });
  scatterInstanced(scene, boxGeo, lowLitMaterial(registry), blocks, { shadow: false });
}

function continuousViaductDeck(scene, s0, s1) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x686b6d, roughness: 0.95, side: THREE.DoubleSide });
  const underside = new THREE.MeshStandardMaterial({ color: 0x3d4144, roughness: 0.98, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(buildRibbon(
    s => -pavedHalfAt(s), s => pavedHalfAt(s), -1.35, -1.35, 14, s0, s1), underside));
  for (const side of [-1, 1]) {
    const edge = s => side * (pavedHalfAt(s) + 0.25);
    scene.add(new THREE.Mesh(buildRibbon(edge, edge, -1.4, 0.35, 14, s0, s1), concrete));
  }
}

function underViaductSprawl(scene, registry, seed, s0, s1) {
  const rand = rng(seed), lots = [], buildings = [];
  const lotColors = [0x454748, 0x4a4c4d, 0x504f4c];
  const colors = [0x805346, 0x956353, 0xaaa198, 0x777b7d, 0x8a8176, 0x666d70];
  for (let s = s0 + 25; s < s1 - 20; s += 38 + rand() * 32) {
    for (const side of [-1, 1]) for (let band = 0; band < 8; band++) {
      if (rand() < 0.1) continue;
      const ss = s + (rand() - 0.5) * 42;
      const lat = side * (31 + band * 42 + rand() * 17);
      const p = posAt(ss, lat, new THREE.Vector3()); p.y = groundY(ss, lat) + 0.02;
      lots.push({ pos: p, rot: headingAt(ss) + (rand() - 0.5) * 0.1,
        sx: 30 + rand() * 34, sy: 0.18, sz: 44 + rand() * 62,
        color: new THREE.Color(lotColors[(rand() * lotColors.length) | 0]) });
      const count = 1 + (rand() < 0.7 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const bs = ss + (i ? 18 + rand() * 18 : -(12 + rand() * 14));
        const bl = lat + side * ((rand() - 0.5) * 15);
        const bp = posAt(bs, bl, new THREE.Vector3()); bp.y = groundY(bs, bl) + 0.12;
        const inner = band < 2;
        buildings.push({ pos: bp, rot: headingAt(bs) + (rand() - 0.5) * 0.12,
          sx: 10 + rand() * 22, sy: inner ? 3.2 + rand() * 3.2 : 4 + rand() * 10,
          sz: 14 + rand() * 32,
          color: new THREE.Color(colors[(rand() * colors.length) | 0]) });
      }
    }
  }
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), lots, { shadow: false });
  scatterInstanced(scene, boxGeo, lowLitMaterial(registry), buildings, { shadow: false });
}

function buildNewarkBayExtension(scene, registry) {
  // The eastern Turnpike extension is predominantly elevated: industrial
  // viaduct, Newark Bay bridge, then the Hudson County elevated approach.
  continuousViaductDeck(scene, 214800, 259350);
  viaductPiers(scene, 214800, 259350);
  bridgeStructure(scene, 238000, 247000, [240500, 244700]);
  water(scene, 242500, 1800, 4600);
  port(scene, 78305, 232500, 246500);
  underViaductSprawl(scene, registry, 78306, 215500, 237500);
  underViaductSprawl(scene, registry, 78309, 247000, 258400);
  denseUrbanFabric(scene, registry, 78310, 257500, 260000, {
    near: 76, bands: 7, tallChance: 0.34, height: 155, lowMin: 8, lowMax: 34,
  });
  urbanCarpet(scene, registry, 78300, 232000, 255000, { towers: false, density: 2.15 });
  urbanCarpet(scene, registry, 78307, 255000, 260000, { towers: true, density: 2.35 });
  skyline(scene, registry, 78301, 233000, 254500, 38, 220, 920, 10, 38, [-1, 1]);
  skyline(scene, registry, 78302, 254500, 257500, 38, 190, 560, 16, 42, [-1, 1]);
  skyline(scene, registry, 78308, 257000, 260000, 20, 85, 430, 75, 245, [-1, 1]);
  // Distant Lower Manhattan is ahead across the Hudson. Keep only low/midrise
  // Hudson County fabric broadside to the elevated approach.
  skyline(scene, registry, 78303, 262200, 265800, 42, 430, 1650, 105, 370, [-1, 1]);
  buildLandmarkSkyline(scene, registry);
  buildBillboards(scene, registry, 78304, 245000, 259000, 22);
  // The Turnpike Extension/Hudson County approach is a dense advertising
  // corridor. Alternate sides and subjects so it reads as NYC-area clutter,
  // not a single repeated prop floating beside the viaduct.
  for (const [s, side, lines, bg, fg] of [
    [247450, 1, ['PATH TO NYC', 'JOURNAL SQUARE'], '#174a73', '#ffffff'],
    [248300, -1, ['NEW YORK CITY', 'WHAT’S YOUR NEXT?'], '#111111', '#f4d35e'],
    [249250, 1, ['BROADWAY', 'LIVE TONIGHT'], '#7a1832', '#ffffff'],
    [250150, -1, ['NYC RUNS ON', 'DUNKIN’'], '#f58220', '#ffffff'],
    [251050, 1, ['NJ TRANSIT', 'NEW YORK · NEWARK'], '#1d5c36', '#ffffff'],
    [251950, -1, ['MADISON SQUARE', 'GARDEN'], '#174a86', '#ffffff'],
    [252850, 1, ['VISIT NYC', 'SOHO · TRIBECA'], '#242b36', '#f6db77'],
    [253650, -1, ['YANKEES', 'BRONX BOUND'], '#132448', '#ffffff'],
    [254450, 1, ['THE MET', 'NEW YORK'], '#9d1c20', '#ffffff'],
    [255200, -1, ['JERSEY CITY', 'MAKE IT YOURS'], '#195f58', '#ffffff'],
    [255950, 1, ['ONE WORLD', 'OBSERVATORY'], '#2a465f', '#ffffff'],
    [256700, -1, ['NYC RUNS ON', 'DUNKIN’'], '#f58220', '#ffffff'],
    [257350, 1, ['HOLLAND TUNNEL', 'MANHATTAN AHEAD'], '#174a73', '#ffffff'],
    [258050, -1, ['BROADWAY', 'GET TICKETS'], '#6f1738', '#ffffff'],
    [258650, 1, ['PATH', '33 ST · WTC'], '#174a73', '#ffffff'],
  ]) roadsideAd(scene, s, side, lines, bg, fg);
  for (const [s, seed] of [[248600, 31], [252100, 32], [255700, 33], [258100, 34]]) {
    urbanOverpass(scene, s, seed, 42);
  }
  for (const [s, lines] of [
    [247800, ['EXIT 14A', 'BAYONNE · JERSEY CITY']],
    [251400, ['I-78 EAST · NEW YORK CITY', 'HOLLAND TUNNEL']],
    [254800, ['12TH STREET · 14TH STREET', 'HOLLAND TUNNEL · 1 MILE']],
    [257200, ['HOLLAND TUNNEL', 'NEW YORK CITY · KEEP LEFT']],
  ]) gantry(scene, registry, s, [{ lat: 0, mesh: textBoard(lines, 16, 3.5, '#046a38', '#ffffff') }], 7.3);
}

function addTunnelPortal(scene, s, center, label) {
  const tile = new THREE.MeshStandardMaterial({ color: 0xb7bbb8, roughness: 0.76 });
  const heading = headingAt(s);
  const p = posAt(s, center, new THREE.Vector3());
  for (const lat of [center - 4.55, center + 4.55]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.2, 2.8), tile);
    col.position.copy(posAt(s, lat, new THREE.Vector3()));
    col.position.y += 4.1; col.rotation.y = heading; scene.add(col);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(9.9, 1.1, 2.8), tile);
  beam.position.copy(p); beam.position.y += 7.65; beam.rotation.y = heading; scene.add(beam);
  const board = textBoard([label, 'PORT AUTHORITY'], 8.5, 1.65, '#174a73', '#ffffff');
  board.position.copy(p); board.position.y += 8.6; board.rotation.y = heading + Math.PI; scene.add(board);
}

function buildTunnelCityCover(scene, registry, t0, t1) {
  const capMat = new THREE.MeshStandardMaterial({ color: 0x55585b, roughness: 0.96, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(buildRibbon(-125, 125, 8.05, 8.05, 14, t0 + 180, t1 - 100), capMat);
  scene.add(cap);

  const rand = rng(78600);
  const buildings = [];
  const colors = [0x765346, 0x8b6655, 0x9c9489, 0x62686d, 0x85796c, 0x535c63];
  for (let s = t0 + 260; s < t1 - 160; s += 65 + rand() * 85) {
    for (const side of [-1, 1]) {
      for (let band = 0; band < 3; band++) {
        if (rand() < 0.18) continue;
        const ss = s + (rand() - 0.5) * 65;
        const lat = side * (22 + band * 38 + rand() * 18);
        const p = posAt(ss, lat, new THREE.Vector3());
        p.y += 8.1;
        buildings.push({
          pos: p,
          rot: headingAt(ss) + (rand() < 0.35 ? Math.PI / 2 : 0) + (rand() - 0.5) * 0.18,
          sx: 18 + rand() * 34,
          sy: 22 + Math.pow(rand(), 0.8) * 105,
          sz: 20 + rand() * 48,
          color: new THREE.Color(colors[(rand() * colors.length) | 0]),
        });
      }
    }
  }
  scatterInstanced(scene, boxGeo, lowLitMaterial(registry), buildings, { shadow: false });
}

function buildHollandTunnel(scene, registry) {
  const t0 = 260000, t1 = 266500;
  const wall = new THREE.MeshStandardMaterial({ color: 0xd1d0c6, roughness: 0.72, side: THREE.DoubleSide });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0x43484d, roughness: 0.9, side: THREE.DoubleSide });
  const floor = new THREE.MeshStandardMaterial({ color: 0x25282b, roughness: 0.96, side: THREE.DoubleSide });
  const white = new THREE.MeshBasicMaterial({ color: 0xf6f3df, side: THREE.DoubleSide });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffd995, side: THREE.DoubleSide });
  const centers = [-7.7, 7.7]; // south tube eastbound, north tube westbound
  for (const center of centers) {
    const left = center - 4.45, right = center + 4.45;
    scene.add(new THREE.Mesh(buildRibbon(left, left, 0, 6.8, 12, t0, t1), wall));
    scene.add(new THREE.Mesh(buildRibbon(right, right, 0, 6.8, 12, t0, t1), wall));
    scene.add(new THREE.Mesh(buildRibbon(left, right, 6.8, 6.8, 12, t0, t1), ceiling));
    // A dedicated opaque tube floor sits just above the world road/terrain,
    // preventing grass or water planes from ever bleeding through underground.
    scene.add(new THREE.Mesh(buildRibbon(left, right, 0.025, 0.025, 10, t0, t1), floor));
    scene.add(new THREE.Mesh(buildRibbon(center - 0.16, center - 0.06, 0.08, 0.08, 10, t0 + 15, t1 - 15), white));
    scene.add(new THREE.Mesh(buildRibbon(center + 0.06, center + 0.16, 0.08, 0.08, 10, t0 + 15, t1 - 15), white));
    for (const offset of [-2.0, 2.0]) scene.add(new THREE.Mesh(
      buildRibbon(center + offset - 0.09, center + offset + 0.09, 6.48, 6.48, 12, t0 + 20, t1 - 20), lamp));
  }
  addTunnelPortal(scene, t0, -7.7, 'SOUTH TUBE · NEW YORK');
  addTunnelPortal(scene, t0, 7.7, 'NORTH TUBE · NEW JERSEY');
  addTunnelPortal(scene, t1, -7.7, 'LOWER MANHATTAN');
  addTunnelPortal(scene, t1, 7.7, 'TO NEW JERSEY');
  buildTunnelCityCover(scene, registry, t0, t1);
  gantry(scene, registry, 258700, [{ lat: -7.7, mesh: textBoard(['I-78 EAST', 'HOLLAND TUNNEL · NEW YORK'], 12, 3.0, '#046a38', '#ffffff') }], 7.4);
}

function buildHollandApproach(scene, registry) {
  const eastLat = -13.25, westLat = 13.25;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4e555b, roughness: 0.7, metalness: 0.45 });
  const lampColors = { red: 0xff3228, yellow: 0xffb52e, green: 0x35d66b };
  const signalS = 259420;
  const signalSpec = { s: signalS, offset: 18, cycle: 88, green: 54, yellow: 4 };
  const crossStreet = new THREE.Mesh(new THREE.BoxGeometry(170, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x2d3034, roughness: 0.98 }));
  crossStreet.position.copy(posAt(signalS, 0, new THREE.Vector3()));
  crossStreet.position.y = groundY(signalS, 0) + 0.08;
  crossStreet.rotation.y = headingAt(signalS) + Math.PI / 2; scene.add(crossStreet);
  const signal = new THREE.Group();
  const signalLamps = [];
  for (const [dir, center, z] of [[1, eastLat, -5], [-1, westLat, 5]]) {
    for (const x of [center - 11.2, center + 11.2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 8.1, 8), poleMat);
      pole.position.set(x, 4.05, z); signal.add(pole);
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(22.6, 0.18, 0.18), poleMat);
    arm.position.set(center, 8.05, z); signal.add(arm);
    for (let lane = 0; lane < 5; lane++) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.8, 0.42), new THREE.MeshStandardMaterial({ color: 0x202329 }));
      head.position.set(center + (lane - 2) * 3.7, 7.12, z); signal.add(head);
      const mats = {};
      for (const [i, key] of ['red', 'yellow', 'green'].entries()) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x171717, emissive: 0x171717, emissiveIntensity: 1 });
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.19, 9, 7), mat);
        light.position.set(center + (lane - 2) * 3.7, 7.64 - i * 0.5, z + dir * 0.24); signal.add(light);
        mats[key] = mat;
      }
      signalLamps.push(mats);
    }
  }
  signal.position.copy(posAt(signalS, 0, new THREE.Vector3()));
  signal.rotation.y = headingAt(signalS); scene.add(signal);

  const tollS = 259680;
  const toll = new THREE.Group();
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(25.0, 0.6, 7.5), new THREE.MeshStandardMaterial({ color: 0x244866, roughness: 0.8 }));
  canopy.position.set(eastLat, 7.1, 0); toll.add(canopy);
  const boothMat = new THREE.MeshStandardMaterial({ color: 0xd7d9d4, roughness: 0.72 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x294b5b, roughness: 0.22, metalness: 0.18 });
  for (let lane = 0; lane < 5; lane++) {
    const x = eastLat + (lane - 2) * 4.35;
    const island = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 7.2), new THREE.MeshStandardMaterial({ color: 0xd6c998, roughness: 0.9 }));
    island.position.set(x, 0.11, 0); toll.add(island);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.7, 3.8), boothMat);
    booth.position.set(x, 1.46, 0.8); toll.add(booth);
    const window = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.75, 0.08), glass);
    window.position.set(x, 1.85, -1.13); toll.add(window);
    const arrow = textBoard(['↓'], 1.35, 1.2, '#0b7a42', '#ffffff');
    arrow.position.set(x, 5.75, -2.1); toll.add(arrow);
  }
  const tollSign = textBoard(['HOLLAND TUNNEL', 'E-ZPASS · CASHLESS TOLLING'], 9.4, 2.1, '#174a73', '#ffffff');
  tollSign.position.set(eastLat, 7.55, 0); toll.add(tollSign);
  toll.position.copy(posAt(tollS, 0, new THREE.Vector3())); toll.rotation.y = headingAt(tollS); scene.add(toll);

  // Concrete channel walls begin after Jersey Avenue. Tall Jersey City fabric
  // remains visible above them, as it does on the sunken 12th/14th Street pair.
  roadsideWall(scene, signalS + 35, 259980, 9, 6.4);
  denseUrbanFabric(scene, registry, 78412, signalS + 45, 259990, {
    near: 42, bands: 5, tallChance: 0.36, height: 165, lowMin: 12, lowMax: 48,
  });

  // Port Authority police cruiser camping just beyond the E-ZPass booths.
  const cruiser = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x111d34, roughness: 0.48, metalness: 0.2 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe7ebef, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.78, 4.8), navy); body.position.y = .68; cruiser.add(body);
  const doors = new THREE.Mesh(new THREE.BoxGeometry(1.98, .44, 2.65), white); doors.position.y = .72; cruiser.add(doors);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, .72, 2.25), navy); cabin.position.y = 1.38; cruiser.add(cabin);
  const redMat = new THREE.MeshStandardMaterial({ color: 0x330008, emissive: 0xff1028, emissiveIntensity: .15 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x000833, emissive: 0x285cff, emissiveIntensity: .15 });
  for (const [x, mat] of [[-.3, redMat], [.3, blueMat]]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.52, .16, .36), mat); bar.position.set(x, 1.82, 0); cruiser.add(bar);
  }
  const copS = tollS + 65, copLat = -(pavedHalfAt(copS) + 3.2);
  cruiser.position.copy(posAt(copS, copLat, new THREE.Vector3())); cruiser.position.y = groundY(copS, copLat) + .08;
  cruiser.rotation.y = headingAt(copS); scene.add(cruiser);

  // A few eastbound cars peel right into Jersey Avenue on green. The player
  // remains on I-78, but surrounding traffic makes the junction function.
  const rand = rng(78413), turners = [];
  for (let i = 0; i < 6; i++) {
    const car = makeParkedCar(rand);
    addNpcPlates(car, { key: 'sedan', L: 4.6, W: 1.8, H: 1.42 }, 'i78_jerseycity', rand);
    car.scale.setScalar(.92); scene.add(car);
    turners.push({ car, progress: -i * .09, speed: .105 + rand() * .025, laneLat: eastLat - 5.4 + (i % 2) * 3.7 });
  }

  const blocks = placementsAlong(78410, 257600, 260300, 34, 88, 175, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.14,
    sx: 14 + rand() * 24, sy: 26 + rand() * 105, sz: 16 + rand() * 28,
    color: new THREE.Color([0x8f7664, 0x756f69, 0xa18c78, 0x6d777d][(rand() * 4) | 0]),
  }));
  scatterInstanced(scene, boxGeo, lowLitMaterial(registry), blocks);
  return { update(dt, simTime) {
    const state = signalState(signalSpec, simTime);
    for (const mats of signalLamps) for (const key of ['red', 'yellow', 'green']) {
      const on = key === state; mats[key].emissive.setHex(on ? lampColors[key] : 0x171717); mats[key].emissiveIntensity = on ? 3.5 : 1;
    }
    const flash = Math.floor(simTime * 2.4) % 2;
    redMat.emissiveIntensity = flash ? 2.8 : .15; blueMat.emissiveIntensity = flash ? .15 : 2.8;
    for (const t of turners) {
      // Cars already committed to the turn clear the junction through yellow/
      // red; the waiting queue only releases when the main signal is green.
      if (state === 'green' || t.progress >= .46) t.progress += dt * t.speed;
      if (t.progress > 1) t.progress = -.25;
      // Negative progress values stagger the waiting queue behind the line;
      // retaining them here prevents all six turning cars occupying one spot.
      const u = t.progress;
      if (u < .5) {
        const s = signalS - 105 + u * 200;
        t.car.position.copy(posAt(s, t.laneLat, new THREE.Vector3()));
        t.car.position.y = groundY(s, t.laneLat) + .12;
        t.car.rotation.y = headingAt(s);
      } else {
        const q = (u - .5) * 2;
        const lat = t.laneLat - q * 72;
        t.car.position.copy(posAt(signalS + 7, lat, new THREE.Vector3()));
        t.car.position.y = groundY(signalS + 7, lat) + .12;
        t.car.rotation.y = headingAt(signalS) - q * Math.PI / 2;
      }
    }
  }};
}

function buildCanalStreetTerminus(scene, registry) {
  const sig = { s: 267450, offset: 7, cycle: 82, green: 48, yellow: 4 };
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x292c30, roughness: 0.98 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xaaa9a2, roughness: 0.95 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f0df, roughness: 0.8 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf4c735, roughness: 0.78 });
  const cross = new THREE.Mesh(new THREE.BoxGeometry(220, 0.12, 22), asphalt);
  cross.position.copy(posAt(sig.s, 0, new THREE.Vector3()));
  cross.position.y = groundY(sig.s, 0) + 0.08;
  cross.rotation.y = headingAt(sig.s) + Math.PI / 2;
  scene.add(cross);

  // Manhattan sidewalks and the unmistakable zebra crossings at the end of I-78.
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(150, 0.32, 7), concrete);
    walk.position.copy(posAt(sig.s, side * 31, new THREE.Vector3()));
    walk.position.y = groundY(sig.s, side * 31) + 0.18;
    walk.rotation.y = headingAt(sig.s) + Math.PI / 2; scene.add(walk);
  }
  for (let lat = -22; lat <= 22; lat += 4.4) {
    for (const ds of [-8, 8]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.035, 3.0), white);
      stripe.position.copy(posAt(sig.s + ds, lat, new THREE.Vector3()));
      stripe.position.y = groundY(sig.s + ds, lat) + 0.16;
      stripe.rotation.y = headingAt(sig.s); scene.add(stripe);
    }
  }
  for (const lat of [-0.22, 0.22]) {
    const center = new THREE.Mesh(buildRibbon(() => lat, () => lat, 0.08, 0.08, 8, 266520, 267430), yellow);
    scene.add(center);
  }

  const street = textBoard(['CANAL STREET', 'VARICK ST · HUDSON ST'], 12, 2.8, '#17643a', '#ffffff');
  street.position.copy(posAt(sig.s - 14, -(pavedHalfAt(sig.s) + 4), new THREE.Vector3()));
  street.position.y += 6.2; street.rotation.y = headingAt(sig.s) + Math.PI; scene.add(street);
  const end = textBoard(['END', 'INTERSTATE 78'], 6.4, 4.0, '#ffffff', '#111111');
  end.position.copy(posAt(sig.s - 28, pavedHalfAt(sig.s) + 5, new THREE.Vector3()));
  end.position.y += 4.0; end.rotation.y = headingAt(sig.s) + Math.PI; scene.add(end);

  const rand = rng(78661), cars = [];
  for (const dir of [-1, 1]) for (let i = 0; i < 4; i++) {
    const car = makeParkedCar(rand);
    addNpcPlates(car, { key: 'sedan', L: 4.6, W: 1.8, H: 1.42 }, 'i78_manhattan', rand);
    car.scale.setScalar(0.92); scene.add(car);
    cars.push({ car, dir, lat: dir < 0 ? -94 - i * 18 : 94 + i * 18, v: 7.5 + rand() * 3.5 });
  }
  const people = [];
  const skin = new THREE.MeshStandardMaterial({ color: 0xb77b55, roughness: 0.9 });
  const clothes = [0x285b8f, 0xb83d45, 0x34433b, 0xd19c35, 0x76518f].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  for (let i = 0; i < 18; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.24, .32, 1.15, 7), clothes[i % clothes.length]); body.position.y = 1.1; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), skin); head.position.y = 1.9; g.add(head);
    scene.add(g); people.push({ g, phase: i / 18, side: i % 2 ? 1 : -1, ds: i % 3 === 0 ? -8 : 8 });
  }
  return { update(dt, simTime) {
    const red = signalState(sig, simTime) === 'red';
    for (const c of cars) {
      const stop = c.dir < 0 ? -pavedHalfAt(sig.s) - 7 : pavedHalfAt(sig.s) + 7;
      const approaching = c.dir < 0 ? c.lat < stop : c.lat > stop;
      if (red || !approaching || Math.abs(c.lat - stop) > 11) c.lat += c.dir * c.v * dt;
      if (c.lat < -115 || c.lat > 115) c.lat = c.dir < 0 ? 115 : -115;
      c.car.position.copy(posAt(sig.s, c.lat, new THREE.Vector3()));
      c.car.position.y = groundY(sig.s, c.lat) + 0.15;
      c.car.rotation.y = headingAt(sig.s) + (c.dir < 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    const ph = ((simTime + sig.offset) % sig.cycle - sig.green - sig.yellow) / (sig.cycle - sig.green - sig.yellow);
    for (const p of people) {
      const u = red ? (ph + p.phase) % 1 : 0;
      const lat = p.side * (27 - u * 54);
      p.g.position.copy(posAt(sig.s + p.ds, lat, new THREE.Vector3()));
      p.g.position.y = groundY(sig.s + p.ds, lat) + 0.16;
      p.g.rotation.y = headingAt(sig.s) + (p.side > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
  }};
}

function buildLowerManhattan(scene, registry) {
  denseUrbanFabric(scene, registry, 78490, 266500, 275000, {
    near: 70, bands: 7, tallChance: 0.5, height: 210, lowMin: 12, lowMax: 48,
  });
  urbanCarpet(scene, registry, 78500, 266500, 275000, { towers: true, density: 2.65 });
  skyline(scene, registry, 78501, 266500, 275000, 14, 38, 310, 95, 380, [-1, 1]);
  buildBillboards(scene, registry, 78502, 267000, 274500, 26);
  return buildCanalStreetTerminus(scene, registry);
}

export function buildI78(scene, registry) {
  const tex = facadeTexture(78); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  registry.towerMats = [new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.7, color: 0xffffff,
  })];
  for (const [color, emissive] of [[0xb8d3df, 0x79b7d8], [0xd6c7ad, 0xffb56b]]) {
    const mat = registry.towerMats[0].clone();
    mat.color.setHex(color); mat.emissive.setHex(emissive);
    registry.towerMats.push(mat);
  }
  buildRuralPennsylvania(scene, registry);
  buildEssexTransition(scene, registry);
  bridgeStructure(scene, 111000, 117000, [114000]);
  water(scene, 114000, 600, 2600);
  welcomeSign(scene, registry, 105500, 1, ['WELCOME TO NEW JERSEY', 'THE GARDEN STATE']);
  welcomeSign(scene, registry, 104500, -1, ['WELCOME TO PENNSYLVANIA', 'KEYSTONE STATE']);
  buildNewarkBayExtension(scene, registry);
  const jerseyApproach = buildHollandApproach(scene, registry);
  buildHollandTunnel(scene, registry);
  const manhattanTerminus = buildLowerManhattan(scene, registry);
  return { update(dt, simTime) {
    jerseyApproach.update(dt, simTime);
    manhattanTerminus.update(dt, simTime);
  }};
}
