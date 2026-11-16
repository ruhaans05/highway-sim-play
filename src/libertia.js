import * as THREE from 'three';
import { LOOP_LENGTH } from './config.js';
import { posAt, headingAt, pavedHalfAt, buildRibbon, njGapAt } from './road.js';
import { MEDIAN_HALF, LANE_WIDTH } from './config.js';
import {
  buildTrees, buildBillboards, buildSuburb, scatterInstanced, placementsAlong,
  groundY, facadeTexture, clampOffRoad, deepSprawl,
} from './environment.js';
import { welcomeSign, buildTollPlaza, textBoard, gantry, addSkyGlow, skyline, water } from './turnpike.js';

// Libertia is deliberately broad and agricultural: high-yield corn/soy fields,
// grain elevators, small county seats, then two very different metros.
const TOWNS = [
  [22000, 'Oakwell'], [52000, 'Mason Creek'], [98000, 'Millbrook'], [142000, 'Prairie Junction'],
  [188000, 'Harveston'], [226000, 'South Reston'], [264000, 'Reston Heights'], [302000, 'University District'],
  [344000, 'Downtown Reston'], [382000, 'Reston North'], [424000, 'Glenhaven'], [470000, 'New Liberty'],
  [520000, 'Hawthorne'], [570000, 'North Fork'], [614000, 'Jacobs Tech Park'], [658000, 'Jacobs Medical'],
  [704000, 'Jacobs Riverfront'], [752000, 'Old Jacobs'], [786000, 'Jacobs Terminal'],
];

const FARM_ADS = [
  ['LIBERTIA GRAIN · HIGH YIELD', '#2e5d3d', '#fff'], ['CORN BELT · EXIT 25', '#d4a72c', '#111'],
  ['THE FREE STATE', '#0b4f7c', '#fff'], ['JACOBS MEDICAL CENTER', '#183b63', '#fff'],
  ['RESTON · GLOBAL CITY', '#111b2d', '#fff'], ['NEXT EXIT · GAS / FOOD / LODGING', '#145a38', '#fff'],
];

function town(scene, registry, s, name, seed) {
  // Towns are compact clusters: retail front, ranch homes behind, trees and a
  // water tower so even the rural stretches have frequent human landmarks.
  buildSuburb(scene, registry, Math.max(0, s - 1500), Math.min(LOOP_LENGTH, s + 1500), { wall: false });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 18, 16),
    new THREE.MeshStandardMaterial({ color: 0xc8ced2, metalness: 0.45, roughness: 0.55 }));
  tower.position.copy(posAt(s, 105, new THREE.Vector3()));
  tower.position.y = groundY(s, 105) + 18;
  scene.add(tower);
  const tank = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8),
    new THREE.MeshStandardMaterial({ color: 0xe7ecef, metalness: 0.35, roughness: 0.45 }));
  tank.scale.y = 0.55; tank.position.set(tower.position.x, tower.position.y + 10, tower.position.z); scene.add(tank);
  const sign = textBoard([name.toUpperCase(), 'LIBERTIA'], 12, 3.4, '#0d5b3b', '#ffffff');
  sign.position.copy(posAt(s + 350, -pavedHalfAt(s) - 2.5, new THREE.Vector3()));
  sign.position.y = groundY(s + 350, -pavedHalfAt(s) - 2.5) + 4.8;
  sign.rotation.y = headingAt(s + 350);
  scene.add(sign); registry.signs.push({ userData: { board: sign } });
}

function grainBelt(scene, registry, s0, s1, seed) {
  const body = new THREE.BoxGeometry(1, 1, 1); body.translate(0, 0.5, 0);
  const barn = new THREE.MeshStandardMaterial({ color: 0x9d3e2e, roughness: 0.9 });
  const silo = new THREE.MeshStandardMaterial({ color: 0xc8cdd0, metalness: 0.55, roughness: 0.45 });
  const farms = placementsAlong(seed, s0, s1, 1700, 65, 220, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.25,
    sx: 18 + rand() * 18, sy: 6 + rand() * 4, sz: 14 + rand() * 14,
  }));
  scatterInstanced(scene, body, barn, farms);
  const siloGeo = new THREE.CylinderGeometry(1, 1, 1, 14); siloGeo.translate(0, 0.5, 0);
  scatterInstanced(scene, siloGeo, silo, farms.map((f, i) => ({
    pos: f.pos.clone().add(new THREE.Vector3(16 + (i % 3) * 3, 0, 3)), rot: 0,
    sx: 3.5, sy: 12 + (i % 4) * 2, sz: 3.5,
  })));
  buildTrees(scene, seed + 1, s0, s1, 90, 60, 250, 65);
  buildBillboards(scene, registry, seed + 2, s0, s1, Math.max(8, Math.floor((s1 - s0) / 1200)), FARM_ADS);
}

function corporateCorridor(scene, registry) {
  const body = new THREE.BoxGeometry(1, 1, 1); body.translate(0, 0.5, 0);
  const warehouse = new THREE.MeshStandardMaterial({ color: 0xb8bec3, roughness: 0.82 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x446a80, metalness: 0.35, roughness: 0.25 });
  const lots = placementsAlong(8801, 390000, 630000, 540, 95, 300, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.12,
    sx: 62 + rand() * 110, sy: 11 + rand() * 15, sz: 45 + rand() * 60,
  }));
  scatterInstanced(scene, body, warehouse, lots);
  // Corporate farm complexes: giant grain sheds, silos and irrigation pivots.
  const farmMat = new THREE.MeshStandardMaterial({ color: 0x8b6b3d, roughness: 0.92 });
  const farms = placementsAlong(8802, 420000, 590000, 2800, 300, 620, (rand, pos, s) => ({
    pos, rot: headingAt(s), sx: 85 + rand() * 90, sy: 8 + rand() * 8, sz: 75 + rand() * 80,
  }));
  scatterInstanced(scene, body, farmMat, farms);
  const siloGeo = new THREE.CylinderGeometry(1, 1, 1, 14); siloGeo.translate(0, 0.5, 0);
  scatterInstanced(scene, siloGeo, new THREE.MeshStandardMaterial({ color: 0xe1e4e4, metalness: 0.65, roughness: 0.35 }), farms.map((f, i) => ({
    pos: f.pos.clone().add(new THREE.Vector3(65 + (i % 4) * 5, 0, 10)), rot: 0, sx: 4.5, sy: 16 + (i % 5) * 3, sz: 4.5,
  })));
  // Oversized agribusiness campuses are a constant part of the Reston–Jacobs
  // view: processing sheds, cold storage, and high-throughput grain terminals.
  const megaFarms = placementsAlong(8810, 402000, 625000, 7600, 170, 380, (rand, pos, s) => ({
    pos, rot: headingAt(s), sx: 120 + rand() * 150, sy: 13 + rand() * 12, sz: 80 + rand() * 110,
  }));
  scatterInstanced(scene, body, new THREE.MeshStandardMaterial({ color: 0x6f5634, roughness: 0.95 }), megaFarms);
  scatterInstanced(scene, siloGeo, new THREE.MeshStandardMaterial({ color: 0xf0f2f2, metalness: 0.7, roughness: 0.3 }), megaFarms.map((f, i) => ({
    pos: f.pos.clone().add(new THREE.Vector3(88 + (i % 5) * 6, 0, -18)), rot: 0, sx: 5.5, sy: 20 + (i % 4) * 4, sz: 5.5,
  })));
  // New tech campuses and logistics parks make the strip feel unfinished and
  // rapidly developing rather than like an established metro.
  const campuses = placementsAlong(8803, 555000, 650000, 5200, 150, 260, (rand, pos, s) => ({
    pos, rot: headingAt(s), sx: 42 + rand() * 30, sy: 18 + rand() * 18, sz: 35 + rand() * 24,
  }));
  scatterInstanced(scene, body, glass, campuses);
  buildBillboards(scene, registry, 8804, 390000, 650000, 26, [
    ['LIBERTIA LOGISTICS', '#153c5b', '#fff'], ['JACOBS TECH CAMPUS', '#1b5d75', '#fff'],
    ['CORPORATE FARM LEASES', '#7d5a24', '#fff'], ['TURNPIKE EXIT · FUTURE CITY', '#0d6b3f', '#fff'],
  ]);
  // This is a two-city commuter economy, not a generic interstate: Reston
  // dominates the western half of the corridor, while Jacobs takes over near
  // the river and its medical/tech districts.
  buildBillboards(scene, registry, 8805, 390000, 575000, 22, [
    ['LIVE RESTON · COMMUTE EAST', '#123c68', '#fff'],
    ['RESTON METRO HOMES · NEW TOWNS', '#0b6b55', '#fff'],
    ['RESTON TECH · BUILD YOUR FUTURE', '#1d294b', '#fff'],
    ['RESTON SPORTS · CITY LIGHTS AHEAD', '#7c2438', '#fff'],
    ['RESTON UNIVERSITY · APPLY NOW', '#1f5b86', '#fff'],
    ['RESTON NIGHTLIFE · 92 MILES', '#37205f', '#fff'],
    ['RESTON BUSINESS DISTRICT · EASTBOUND', '#25313b', '#fff'],
  ]);
  buildBillboards(scene, registry, 8806, 575000, 630000, 14, [
    ['JACOBS · RIVER CITY AHEAD', '#0a5870', '#fff'],
    ['JACOBS MEDICAL · WORLD-CLASS CARE', '#f2f2ee', '#173b59'],
    ['JACOBS TECH PARK · INNOVATION DISTRICT', '#1b5d75', '#fff'],
    ['JACOBS RIVERFRONT · LIVE WELL', '#0d6b3f', '#fff'],
    ['WELCOME TO JACOBS · 20 MIN', '#16324a', '#fff'],
  ]);
}

function farmBeltInfrastructure(scene, registry) {
  // Rural, but thoroughly capitalized: county frontage roads, a freight rail
  // spur, and long utility corridors make the production landscape feel
  // connected rather than like empty decorative grass.
  const serviceMat = new THREE.MeshStandardMaterial({ color: 0x343b3d, roughness: 0.92 });
  for (const side of [-1, 1]) {
    const inner = side < 0
      ? (s => -pavedHalfAt(s) - 18)
      : (s => pavedHalfAt(s) + 18);
    const outer = side < 0
      ? (s => -pavedHalfAt(s) - 24)
      : (s => pavedHalfAt(s) + 24);
    scene.add(new THREE.Mesh(buildRibbon(inner, outer, 0.02, 0.02, 100, 408000, 620000), serviceMat));
  }

  const railMat = new THREE.MeshStandardMaterial({ color: 0x252b2e, roughness: 0.7, metalness: 0.35 });
  for (const side of [-1, 1]) {
    const railLat = side < 0
      ? (s => -pavedHalfAt(s) - 39)
      : (s => pavedHalfAt(s) + 39);
    scene.add(new THREE.Mesh(buildRibbon(
      s => railLat(s) - 0.55, s => railLat(s) + 0.55,
      0.08, 0.08, 100, 420000, 605000
    ), railMat));
  }

  const poleGeo = new THREE.BoxGeometry(1, 1, 1); poleGeo.translate(0, 0.5, 0);
  const poles = placementsAlong(8840, 405000, 625000, 220, 31, 35, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s), sx: 0.7, sy: 12 + rand() * 3, sz: 0.7,
  }));
  scatterInstanced(scene, poleGeo, new THREE.MeshStandardMaterial({ color: 0x5c5144, roughness: 0.95 }), poles);

  const tankGeo = new THREE.CylinderGeometry(1, 1, 1, 16); tankGeo.translate(0, 0.5, 0);
  const tanks = placementsAlong(8841, 430000, 600000, 7200, 285, 430, (rand, pos, s) => ({
    pos, rot: 0, sx: 4.5 + rand() * 2, sy: 15 + rand() * 8, sz: 4.5 + rand() * 2,
  }));
  scatterInstanced(scene, tankGeo, new THREE.MeshStandardMaterial({ color: 0x9aa4a4, metalness: 0.55, roughness: 0.45 }), tanks);

  for (const s of [438000, 486000, 548000, 596000]) {
    const board = textBoard(['COUNTY FARM ACCESS', 'FREIGHT · GRAIN · LOGISTICS'], 7.2, 2.3, '#315b3b', '#fff');
    const lat = pavedHalfAt(s) + 11;
    board.position.copy(posAt(s, lat, new THREE.Vector3()));
    board.position.y = groundY(s, lat) + 5.2;
    board.rotation.y = headingAt(s) + Math.PI;
    scene.add(board); registry.signs.push({ userData: { board } });
  }
}

function libertiaTreeBuffers(scene) {
  // Layered roadside vegetation keeps development from sitting directly
  // behind a single token row: close canopy, mid-distance trees, then the
  // deeper landscape/building layer. Metro sections stay greener but still
  // keep sightline gaps at signs and interchanges.
  const bands = [
    [0, 245000, 26, 34, 120, 1.12],
    [245000, 390000, 18, 30, 150, 1.05],
    [390000, 630000, 34, 44, 240, 0.95],
    [630000, 750000, 18, 28, 150, 1.05],
    [750000, 805000, 28, 38, 190, 1.0],
  ];
  bands.forEach(([s0, s1, nearStep, farStep, farLat, scale], i) => {
    buildTrees(scene, 9900 + i * 11, s0, s1, nearStep, 28, 135, 0, false, scale);
    buildTrees(scene, 9910 + i * 11, s0, s1, farStep, 135, farLat, 0, false, scale * 0.95);
  });
}

function politicalClashSigns(scene, registry) {
  // A fictional civic culture clash that belongs to this corridor's identity:
  // Reston's open, progressive metro versus wealthy, conservative Jacobs.
  // The boards are paired on both shoulders so either direction sees the
  // contrast without turning it into a real-world campaign endorsement.
  const boards = [
    [430000, ['RESTON SAYS', 'OPEN CITY · BIG IDEAS'], '#253b72'],
    [468000, ['JACOBS SAYS', 'ORDER · GROWTH · PROSPERITY'], '#315225'],
    [512000, ['TWO CITIES', 'ONE TURNPIKE · KEEP MOVING'], '#6b4a22'],
    [556000, ['RESTON VALUES', 'DIVERSITY · TRANSIT · CHANGE'], '#5b2b67'],
    [592000, ['JACOBS VALUES', 'TRADITION · BUSINESS · SECURITY'], '#173f56'],
  ];
  for (const [s, lines, color] of boards) {
    for (const side of [-1, 1]) {
      const lat = side * (pavedHalfAt(s) + 10);
      const board = textBoard(lines, 8.8, 2.8, color, '#ffffff');
      board.position.copy(posAt(s, lat, new THREE.Vector3()));
      board.position.y = groundY(s, lat) + 6.3;
      board.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0);
      scene.add(board);
      registry.signs.push({ userData: { board } });
    }
  }
}

function restonTransit(scene, registry) {
  // Reston has a visible regional rail/elevated subway spine, giving the
  // central metro the unmistakable intensity of a New York-scale city.
  const steel = new THREE.MeshStandardMaterial({ color: 0x4d5964, roughness: 0.48, metalness: 0.62 });
  const rail = new THREE.MeshStandardMaterial({ color: 0x1f2a34, emissive: 0x071018, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.55 });
  const line = s => 232 + 5 * Math.sin(s / 4200);
  scene.add(new THREE.Mesh(buildRibbon(s => line(s) - 2, s => line(s) + 2, 8.2, 9.2, 90, 265000, 382000), steel));
  const pillarGeo = new THREE.BoxGeometry(1, 1, 1); pillarGeo.translate(0, 0.5, 0);
  const pillars = placementsAlong(9410, 265000, 382000, 14, 228, 236, (rand, pos, s) => ({
    pos, rot: headingAt(s), sx: 1.35, sy: 8.2, sz: 1.35,
  }));
  scatterInstanced(scene, pillarGeo, steel, pillars);
  // Station canopies and a few parked trainsets make the rail line readable
  // from the turnpike instead of looking like a generic viaduct.
  for (const s of [278000, 318000, 352000, 376000]) {
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(18, 0.45, 30), steel);
    const p = posAt(s, 232, new THREE.Vector3()); canopy.position.set(p.x, groundY(s, 232) + 10.1, p.z); canopy.rotation.y = headingAt(s); scene.add(canopy);
    const station = textBoard(['RESTON METRO', s > 340000 ? 'CITY CENTER' : 'CROSS-TOWN RAIL'], 12, 2.5, '#263e52', '#fff');
    station.position.copy(posAt(s, 218, new THREE.Vector3())); station.position.y = groundY(s, 218) + 8.5; station.rotation.y = headingAt(s); scene.add(station); registry.signs.push({ userData: { board: station } });
  }
  for (const s of [286000, 331000, 365000]) {
    const train = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.5, 10), rail);
      car.position.z = i * 10.4; train.add(car);
      const windowBand = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.55, 8.2), new THREE.MeshStandardMaterial({ color: 0x67b9d5, emissive: 0x164b63, emissiveIntensity: 0.5, roughness: 0.25 }));
      windowBand.position.set(0, 0.45, i * 10.4); train.add(windowBand);
    }
    const p = posAt(s, 232, new THREE.Vector3()); train.position.set(p.x, groundY(s, 232) + 10.0, p.z); train.rotation.y = headingAt(s); scene.add(train);
  }
}

function restonUrbanWall(scene, towerMat, s0 = 315000, s1 = 390000) {
  // NYC-scale frontage: several uninterrupted rows of apartments, offices,
  // hotels and utility buildings on both sides of the highway. The existing
  // skyline clusters sit behind this wall; this is what removes the open
  // horizon and makes Reston feel like a continuous megacity.
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const roof = new THREE.MeshStandardMaterial({ color: 0x343a42, roughness: 0.82 });
  const buildings = [];
  let n = 0;
  for (let s = s0; s < s1; s += 34) {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 5; row++) {
        n += 1;
        const wobble = Math.sin(n * 12.73) * 0.5 + 0.5;
        const lat = side * (34 + row * 76 + Math.sin(n * 3.17) * 14);
        const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
        const core = s > 300000 && s < 370000;
        const h = core ? 42 + wobble * 170 / (row * 0.22 + 1) : 24 + wobble * 78 / (row * 0.2 + 1);
        const building = { pos: p, rot: headingAt(s) + (wobble - 0.5) * 0.12,
          sx: 18 + wobble * 22, sy: h, sz: 22 + (1 - wobble) * 20 };
        // The frontage is dense, but never allowed to occupy pavement,
        // shoulders, ramp envelopes, or the six-lane Reston road edge.
        buildings.push(clampOffRoad(building, s, lat, 8));
      }
    }
  }
  scatterInstanced(scene, geo, towerMat, buildings);
  scatterInstanced(scene, geo, roof, buildings.map(b => ({
    pos: b.pos.clone().setY(b.pos.y + b.sy), rot: b.rot, sx: b.sx * 1.03, sy: 1.1, sz: b.sz * 1.03,
  })), { shadow: false });
}

function restonArrivalSigns(scene, registry) {
  controlSign(scene, registry, 248000, ['RESTON METRO AHEAD', 'OUTER SPRAWL  ·  92 MILES'], 0);
  controlSign(scene, registry, 278000, ['RESTON SUBURBAN BELT', 'LOCAL EXITS  ·  TRANSIT  ·  HOTELS'], 0);
  controlSign(scene, registry, 312000, ['RESTON GLOBAL CITY', 'DOWNTOWN  ·  TECH  ·  SPORTS'], 0);
  controlSign(scene, registry, 340000, ['DOWNTOWN RESTON', '10 SUPERTALLS  ·  CITY CENTER'], 0);
}

function turnpikeDivider(scene) {
  // Keep the local/express split legible with an ordinary low Jersey barrier.
  // The old treatment stacked a wide raised strip, yellow cap, and repeated
  // oversized blocks, which made the divider look like a construction object.
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8f9598, roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const center = s => side * (MEDIAN_HALF + 3 * LANE_WIDTH + njGapAt(s) * 0.5);
    scene.add(new THREE.Mesh(
      buildRibbon(s => center(s) - side * 0.42, s => center(s) + side * 0.42,
        0.02, 0.85, 120, 390000, 630000), concrete
    ));
  }
}

function turnpikeBranding(scene, registry) {
  const blue = '#0b5b89';
  for (let s = 12000; s < LOOP_LENGTH - 4000; s += 26000) {
    for (const side of [-1, 1]) {
      const board = textBoard(['LIBERTIA', 'TURNPIKE'], 6.8, 2.5, blue, '#ffffff');
      const lat = side * (pavedHalfAt(s) + 5.5);
      board.position.copy(posAt(s, lat, new THREE.Vector3()));
      board.position.y = groundY(s, lat) + 5.8;
      board.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0);
      scene.add(board); registry.signs.push({ userData: { board } });
    }
  }
  controlSign(scene, registry, 398000, ['LIBERTIA TURNPIKE', 'LOCAL  |  EXPRESS', 'RESTON → JACOBS'], 0);
  controlSign(scene, registry, 622000, ['LIBERTIA TURNPIKE', 'LOCAL  |  EXPRESS', 'JACOBS → RESTON'], 0);
}

function travelTimeSigns(scene, registry) {
  // Libertia uses frequent amber DMS boards. Distances are logical route
  // distances, so the displayed drive times remain meaningful after the
  // rendered road is compressed for gameplay.
  const destinations = [
    { s: 0, name: 'MISSOURI LINE', speed: 58 },
    { s: 188000, name: 'PRAIRIE JUNCTION', speed: 60 },
    { s: 344000, name: 'DOWNTOWN RESTON', speed: 46 },
    { s: 390000, name: 'RESTON', speed: 50 },
    { s: 630000, name: 'JACOBS', speed: 58 },
    { s: 676000, name: 'JACOBS MEDICAL', speed: 42 },
    { s: 704000, name: 'JACOBS RIVERFRONT', speed: 42 },
  ];
  const ahead = (s, dest, bound) => bound > 0
    ? (dest - s + LOOP_LENGTH) % LOOP_LENGTH
    : (s - dest + LOOP_LENGTH) % LOOP_LENGTH;
  const eta = (distance, speed) => {
    const minutes = Math.max(1, Math.round((distance / 1609.344) / speed * 60));
    const hours = Math.floor(minutes / 60), mins = minutes % 60;
    return hours ? `${hours} HR ${String(mins).padStart(2, '0')} MIN` : `${mins} MIN`;
  };
  const boardLines = (s, bound) => {
    const rows = destinations
      .map(d => ({ ...d, d: ahead(s, d.s, bound) }))
      .filter(d => d.d > 1800)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    return ['LIBERTIA E-TOLL', ...rows.map(d => `${d.name}  ${eta(d.d, d.speed)}`)];
  };
  for (let s = 18000; s < LOOP_LENGTH - 12000; s += 30000) {
    const inc = textBoard(boardLines(s, 1), 12.5, 3.2, '#17130a', '#ffbf32');
    inc.rotation.y = Math.PI;
    const dec = textBoard(boardLines(s, -1), 12.5, 3.2, '#17130a', '#ffbf32');
    gantry(scene, registry, s, [{ lat: -6.2, mesh: inc }, { lat: 6.2, mesh: dec }], 7.2);
  }
  // Tighter city cadence: local destinations and district names appear on
  // their own overhead boards inside Reston and Jacobs.
  for (const s of [258000, 286000, 318000, 350000, 372000, 642000, 668000, 696000, 728000]) {
    const inc = textBoard(boardLines(s, 1), 13.5, 3.4, '#17130a', '#ffbf32'); inc.rotation.y = Math.PI;
    const dec = textBoard(boardLines(s, -1), 13.5, 3.4, '#17130a', '#ffbf32');
    gantry(scene, registry, s, [{ lat: -6.2, mesh: inc }, { lat: 6.2, mesh: dec }], 7.5);
  }
}

function restonDemographicQuarters(scene, registry) {
  // Reston is huge enough to contain four broad, historically self-contained
  // quarters. These are represented through urban form rather than caricature:
  // different housing ages, density, commercial strips, community institutions
  // and investment levels, with a visibly mixed civic core between them.
  const body = new THREE.BoxGeometry(1, 1, 1); body.translate(0, 0.5, 0);
  const roofs = new THREE.MeshStandardMaterial({ color: 0x4f545d, roughness: 0.9 });
  const quarters = [
    { s0: 270000, s1: 295000, lat: -145, seed: 9301, mat: 0x6f5550, label: 'WEST END · HISTORIC RESTON', sign: '#6a3040', density: 15, h: [3, 8] },
    { s0: 295000, s1: 320000, lat: 145, seed: 9302, mat: 0xa89d8b, label: 'NORTH OAKS · OLD RESTON', sign: '#52613d', density: 22, h: [3, 10] },
    { s0: 320000, s1: 345000, lat: -145, seed: 9303, mat: 0x8e9da8, label: 'LAKE DISTRICT · RESTON', sign: '#245c78', density: 13, h: [5, 15] },
    { s0: 345000, s1: 370000, lat: 145, seed: 9304, mat: 0xb56c4f, label: 'SOUTH MARKET · RESTON', sign: '#8b3d2c', density: 17, h: [3, 12] },
  ];
  for (const q of quarters) {
    const mat = new THREE.MeshStandardMaterial({ color: q.mat, roughness: 0.86 });
    const homes = placementsAlong(q.seed, q.s0, q.s1, q.density, Math.abs(q.lat), Math.abs(q.lat) + 210, (rand, pos, s, lat) => ({
      pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.25,
      sx: 8 + rand() * 11, sy: q.h[0] + rand() * (q.h[1] - q.h[0]), sz: 8 + rand() * 12,
    }));
    scatterInstanced(scene, body, mat, homes);
    scatterInstanced(scene, body, roofs, homes.map(h => ({
      pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot, sx: h.sx * 1.08, sy: 1.8, sz: h.sz * 1.08,
    })));
    buildBillboards(scene, registry, q.seed + 20, q.s0, q.s1, 8, [
      [q.label, q.sign, '#fff'], ['RESTON CITY SERVICES', '#2e3338', '#fff'],
    ]);
    const district = textBoard([q.label, 'COMMUNITY DISTRICT'], 14, 3.4, q.sign, '#fff');
    district.position.copy(posAt((q.s0 + q.s1) / 2, q.lat > 0 ? q.lat - 24 : q.lat + 24, new THREE.Vector3()));
    district.position.y = groundY((q.s0 + q.s1) / 2, q.lat) + 5.2;
    district.rotation.y = headingAt((q.s0 + q.s1) / 2);
    scene.add(district); registry.signs.push({ userData: { board: district } });
  }
  // The seams are deliberate: mixed blocks, immigrant-owned storefronts,
  // universities and civic services soften the boundaries near I-235.
  buildSuburb(scene, registry, 370000, 390000, { wall: false });
  [372500, 379000, 386000].forEach((s, i) => graffiti(scene, registry, s, i % 2 ? -92 : 92, ['MIXED CITY', 'RESTON BELONGS TO EVERYONE', 'NO MORE WALLS'][i], '#f0c84b'));
}

function controlSign(scene, registry, s, lines, lat = 0) {
  gantry(scene, registry, s, [
    { lat: lat - 7, mesh: textBoard(lines, 13, 4.2, '#046a38', '#fff') },
    { lat: lat + 7, mesh: textBoard(['LIBERTIA', 'THE FREE STATE'], 11, 4.2, '#046a38', '#fff') },
  ], 7.3);
}

function graffiti(scene, registry, s, lat, text, color = '#d94b52') {
  const board = textBoard([text, 'RESTON DOESN’T OWN US'], 15, 3.2, '#25282d', color);
  const p = posAt(s, lat, new THREE.Vector3());
  p.y = groundY(s, lat) + 5.8;
  board.position.copy(p); board.rotation.y = headingAt(s) + (lat > 0 ? Math.PI / 2 : -Math.PI / 2);
  scene.add(board); registry.signs.push({ userData: { board } });
}

export function buildLibertia(scene, registry) {
  const tex = facadeTexture(82); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.68 });
  registry.towerMats = (registry.towerMats || []).concat(towerMat);

  grainBelt(scene, registry, 0, 245000, 181);
  grainBelt(scene, registry, 750000, 805000, 191);
  corporateCorridor(scene, registry);
  farmBeltInfrastructure(scene, registry);
  libertiaTreeBuffers(scene);
  // Small cities/county seats every few dozen miles across every route section.
  TOWNS.forEach(([s, name], i) => town(scene, registry, s, name, 300 + i));

  // Reston: enormous diverse global city, with ten very tall signature towers.
  buildSuburb(scene, registry, 245000, 390000, { wall: false });
  restonDemographicQuarters(scene, registry);
  restonTransit(scene, registry);
  // Arrival sequence: low-density outer sprawl, then the suburb belt, then
  // the continuous high-rise core. The megacity wall begins late enough that
  // the skyline reveal has a long, suspenseful approach.
  restonUrbanWall(scene, towerMat, 315000, 390000);
  restonArrivalSigns(scene, registry);
  // Reston is a continuous megaregion: buildings recede to the horizon on
  // both sides of every ring, with no pastoral gaps between neighborhoods.
  deepSprawl(scene, 7601, 245000, 390000, { density: 2.25, towers: true, glowMat: towerMat });
  skyline(scene, registry, 7001, 300000, 390000, 3100, 85, 340, 26, 105, [-1, 1]);
  skyline(scene, registry, 7002, 315000, 378000, 4300, 18, 65, 90, 300, [-1, 1]);
  // Extra Manhattan-like wall of towers around the core: Reston should feel
  // vertical and continuous, with very little empty horizon from the road.
  skyline(scene, registry, 7003, 300000, 370000, 2100, 28, 120, 120, 390, [-1, 1]);
  addSkyGlow(scene, registry, 344000, 0, 2600, 900, 0xffb478);

  // Jacobs: smaller, extraordinarily affluent, research/medicine-led skyline.
  buildSuburb(scene, registry, 630000, 750000, { wall: false });
  skyline(scene, registry, 7101, 630000, 750000, 2600, 70, 260, 22, 82, [-1, 1]);
  skyline(scene, registry, 7102, 662000, 730000, 4200, 20, 60, 52, 118, [-1, 1]);
  // Jacobs keeps its wealth close to the road, but its interstate approaches
  // are heavily wooded: a green river-city belt around the dense core.
  deepSprawl(scene, 7602, 630000, 750000, { density: 1.35, towers: true, glowMat: towerMat });
  buildTrees(scene, 7603, 630000, 805000, 24, 52, 240, 150);
  buildTrees(scene, 7604, 640000, 750000, 18, 260, 520, 90);
  addSkyGlow(scene, registry, 690000, 0, 1250, 430, 0x8ac8ff);
  // Jacobs is built on the Libertia River; the turnpike enters over a broad
  // low bridge with wealthy waterfront development on the far bank.
  water(scene, 704000, 900, 1400);

  // State-owned turnpike: NJ-style toll plaza plus a continuous local/express
  // dual-dual cross-section handled in road.js, with strong control-city signs.
  turnpikeDivider(scene);
  buildTollPlaza(scene, registry, 398000, [
    ['E-TOLL', 'EXPRESS', '#173d73'], ['E-TOLL', 'EXPRESS', '#173d73'],
    ['E-TOLL ONLY', 'NO CASH', '#173d73'], ['LOCAL', 'EXIT 5', '#0d5b3b'],
    ['FULL SERVICE', 'CASH / E-TOLL', '#0d5b3b'], ['TRUCKS OK', 'FULL SERVICE', '#0d5b3b'],
  ]);
  buildTollPlaza(scene, registry, 622000, [
    ['E-TOLL', 'EXPRESS', '#173d73'], ['E-TOLL', 'EXPRESS', '#173d73'], ['E-TOLL ONLY', 'NO CASH', '#173d73'],
    ['LOCAL', 'EXIT 14', '#0d5b3b'], ['FULL SERVICE', 'CASH / E-TOLL', '#0d5b3b'], ['TRUCKS OK', 'FULL SERVICE', '#0d5b3b'],
  ]);
  turnpikeBranding(scene, registry);
  politicalClashSigns(scene, registry);
  travelTimeSigns(scene, registry);
  controlSign(scene, registry, 246000, ['LIBERTIA TURNPIKE', 'RESTON  ·  LOCAL / EXPRESS'], 0);
  controlSign(scene, registry, 352000, ['DOWNTOWN RESTON', 'JACOBS  150  ·  TOLL ROAD'], 0);
  controlSign(scene, registry, 394000, ['LIBERTIA E-TOLL', 'RESTON–JACOBS ENTRY', 'EXPRESS  ·  FULL SERVICE'], 0);
  controlSign(scene, registry, 405000, ['LIBERTIA TURNPIKE', 'JACOBS  150  ·  TOLL ROAD'], 0);
  controlSign(scene, registry, 618000, ['LIBERTIA E-TOLL', 'JACOBS–RESTON ENTRY', 'EXPRESS  ·  FULL SERVICE'], 0);
  controlSign(scene, registry, 612000, ['JACOBS  ·  MEDICAL / TECH', 'RIVERFRONT  14'], 0);

  // Rough Reston neighborhoods use retaining walls, rail underpasses and
  // abandoned industrial frontage as a recurring visual layer. Eastbound on
  // the Turnpike, the Jacobs approach has one deliberately unmistakable
  // bridge tag: "F*CK RESTON".
  [272500, 291500, 315500, 340500, 365500].forEach((s, i) => {
    graffiti(scene, registry, s, i % 2 ? 76 : -76, ['NO RING ROAD', 'RESTON IS NOT THE STATE', 'KEEP RESTON WEIRD', 'NO MORE TOLLS', 'LIBERTIA FOR EVERYONE'][i]);
  });
  graffiti(scene, registry, 440000, 0, 'F*CK RESTON', '#ff625f');
  graffiti(scene, registry, 443000, 0, 'JACOBS WELCOMES YOU', '#66d7ff');

  welcomeSign(scene, registry, 2000, 1, ['WELCOME TO LIBERTIA', 'THE FREE STATE', 'MISSOURI STATE LINE'], '#0b5b89');
  welcomeSign(scene, registry, 802000, -1, ['LIBERTIA TURNPIKE', 'RESTON · JACOBS', '500 MILES OF STATE HIGHWAY'], '#0b5b89');
  welcomeSign(scene, registry, 245000, 1, ['RESTON METRO', 'CITY PROPER 4 MILLION', 'LIBERTIA TURNPIKE'], '#123a7a');
  welcomeSign(scene, registry, 630000, 1, ['JACOBS METRO', 'MEDICINE · TECHNOLOGY', 'LIBERTIA TURNPIKE'], '#123a7a');
}
