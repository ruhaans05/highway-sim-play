import * as THREE from 'three';
import { DIR, LANE_WIDTH, MEDIAN_HALF } from './config.js';
import {
  posAt, headingAt, pavedHalfAt, njGapAt, buildRibbon, gwbLowerDrop, elevAt, bridgeBumpAt,
  spurTAt, spurRiseAt, latForLane, usableLanesAt, WORK_ZONES, SPUR,
} from './road.js';
import {
  groundY, clampOffRoad, roadClearAt, buildBillboards, buildSuburb, buildTrees,
  placementsAlong, scatterInstanced, facadeTexture, deepSprawl, farRidge, foliageMats, lowLitMaterial, buildNoiseWall,
} from './environment.js';
import {
  gantry, textBoard, water, suspensionBridge, port,
  bridgeStructure, viaductPiers, skyline, buildTollPlaza, welcomeSign,
} from './turnpike.js';

const TAU = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
boxGeo.translate(0, 0.5, 0);

// ---------------------------------------------------------------------------
// New Haven: compact CT downtown — nothing over ~100 m, brick campus blocks
// ---------------------------------------------------------------------------
function buildNewHaven(scene, registry) {
  skyline(scene, registry, 121, 600, 3100, 20, 70, 380, 18, 95);
  // Yale-ish collegiate gothic: low brick + limestone quads
  const tints = [0x9a4a38, 0xb0553f, 0xc9beac, 0xb8ab95, 0x8a6a50];
  const campus = placementsAlong(122, 3000, 4700, 34, 75, 260, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.25,
    sx: 16 + rand() * 18, sy: 8 + rand() * 12, sz: 12 + rand() * 14,
    color: new THREE.Color(tints[(rand() * tints.length) | 0]),
  }), 2);
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), campus);
  buildTrees(scene, 123, 200, 4900, 40, 50, 300, 90);
  buildTrees(scene, 124, 2600, 4900, 14, 40, 120, 0);   // elms screening the campus
  buildNoiseWall(scene, 200, 5000, { seed: 1202, height: 5.2, margin: 4.0, step: 11, gapChance: 0.14 });
  // New Haven is a real small city, not two blocks — dense set-back rowhouse /
  // triple-decker / commercial fabric recedes behind the downtown + campus
  deepSprawl(scene, 1201, 300, 6000, { glowMat: registry.towerMats[0], density: 1.15, litMat: lowLitMaterial(registry) });
  buildBillboards(scene, registry, 125, 300, 5200, 24);
  gantry(scene, registry, 4300, [
    { lat: 0, mesh: textBoard(['I-95 SOUTH', 'NEW YORK CITY'], 13, 3.4, '#046a38', '#ffffff') },
  ], 6.8);
}

// ---------------------------------------------------------------------------
// CT shoreline: leafy suburbs, commuter towns, the Stamford cluster
// ---------------------------------------------------------------------------
function buildCorridor(scene, registry) {
  const bodyMat = lowLitMaterial(registry);
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xe0dcd2];
  const houses = placementsAlong(131, 5200, 31300, 30, 95, 340, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.3,
    sx: 9 + rand() * 5, sy: 3.6 + rand() * 3, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, boxGeo, bodyMat, houses);
  // town commercial strips every so often
  const fascia = [0xc8342a, 0x15355e, 0xd97b1f, 0x0d6b3f];
  const strips = placementsAlong(132, 6000, 31000, 260, 100, 160, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2),
    sx: 26 + rand() * 26, sy: 5 + rand() * 3, sz: 14 + rand() * 8,
    color: new THREE.Color([0xd9d5cc, 0xc9c5bc, 0xb8b4ab][(rand() * 3) | 0]),
  }), 14);
  scatterInstanced(scene, boxGeo, bodyMat, strips);
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    strips.map((m, i) => ({
      pos: m.pos.clone().setY(m.pos.y + m.sy * 0.72),
      rot: m.rot, sx: m.sx * 0.96, sy: 1.4, sz: m.sz + 0.6,
      color: new THREE.Color(fascia[i % fascia.length]),
    })));
  // Connecticut is a forest with a highway through it — near belt plus a deep
  // wooded band so the mid-distance never reads as bare lawn
  buildTrees(scene, 133, 5100, 31300, 20, 55, 380, 200);
  buildTrees(scene, 136, 5100, 31300, 26, 380, 900, 200);
  // tight tree line just off the shoulder — the CT highway look: a green wall,
  // houses and strips glimpsed through the gaps
  buildTrees(scene, 137, 5100, 31300, 9, 38, 110, 0);
  buildTrees(scene, 138, 5100, 31300, 12, 42, 130, 0, true);
  buildNoiseWall(scene, 5100, 31300, { seed: 139, height: 5.4, margin: 4.0, step: 11, gapChance: 0.13 });
  roadsideScreen(scene, 140, 5100, 31300, { step: 7 });
  // Stamford: the mid-corridor mini-skyline
  skyline(scene, registry, 134, 24800, 26900, 22, 120, 420, 25, 130);
  for (const s of [8000, 15000, 22000, 29600]) {
    gantry(scene, registry, s, [
      { lat: 0, mesh: textBoard(['I-95 SOUTH', 'NEW YORK'], 12, 3.2, '#046a38', '#ffffff') },
    ], 6.8);
  }
  buildBillboards(scene, registry, 135, 5400, 31200, 22);
}

// ---------------------------------------------------------------------------
// Westchester County: leafy commuter towns, sound-shore mid-rises, office
// parks, and the White Plains cluster inland on the horizon
// ---------------------------------------------------------------------------
function buildWestchester(scene, registry) {
  const bodyMat = lowLitMaterial(registry);
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xe0dcd2];
  // dense sound-shore suburbia: Port Chester, Rye, Mamaroneck, Larchmont
  const houses = placementsAlong(151, 31600, 36300, 24, 90, 320, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.3,
    sx: 9 + rand() * 5, sy: 3.8 + rand() * 3.4, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, boxGeo, bodyMat, houses);
  // downtown blocks + co-op slabs near the stations
  const brick = [0x9a6a50, 0xb08a68, 0xc9beac, 0x8e9aa8];
  const downtown = placementsAlong(152, 31800, 36200, 90, 85, 200, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
    sx: 14 + rand() * 16, sy: 10 + rand() * 24, sz: 12 + rand() * 12,
    color: new THREE.Color(brick[(rand() * brick.length) | 0]),
  }), 4);
  scatterInstanced(scene, boxGeo, bodyMat, downtown);
  // office parks hugging the interstate
  const parks = placementsAlong(153, 32000, 36000, 320, 95, 200, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2),
    sx: 30 + rand() * 26, sy: 12 + rand() * 10, sz: 18 + rand() * 10,
    color: new THREE.Color(0xaab4bc),
  }), 16);
  scatterInstanced(scene, boxGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 }), parks);
  // New Rochelle: a real mid-rise cluster right by the highway
  skyline(scene, registry, 154, 34100, 35100, 40, 90, 300, 25, 110);
  // White Plains: compact tower cluster far inland (one side)
  skyline(scene, registry, 155, 32500, 33900, 55, 380, 700, 35, 140, [1]);
  buildTrees(scene, 156, 31500, 36400, 24, 55, 360, 140);
  // leafy Westchester: tree screen between the road and the first buildings
  buildTrees(scene, 158, 31500, 36400, 10, 38, 105, 0);
  buildTrees(scene, 159, 31500, 36400, 24, 360, 850, 0);
  buildNoiseWall(scene, 31500, 36400, { seed: 160, height: 5.8, margin: 4.0, step: 10, gapChance: 0.1 });
  roadsideScreen(scene, 161, 31500, 36400, { step: 7 });
  gantry(scene, registry, 33000, [
    { lat: 0, mesh: textBoard(['NEW ENGLAND THRUWAY', 'I-95 SOUTH · NEW YORK'], 15, 3.4, '#046a38', '#ffffff') },
  ], 6.8);
  buildBillboards(scene, registry, 157, 31700, 36300, 8);
}

// ---------------------------------------------------------------------------
// South Bronx: brick walls of the Cross Bronx, Manhattan on the skyline
// ---------------------------------------------------------------------------
function buildBronx(scene, registry) {
  const brick = [0x8a5a44, 0x9c6b50, 0x7a4f3e, 0xa87b5c, 0x8f8578, 0x6e625a];
  const blockMat = lowLitMaterial(registry);   // Bronx tenements light up at night
  // the Cross Bronx is a sunken, walled concrete trench — tall retaining walls
  // right off both shoulders (gaps for the many ramps), not grassy verge
  buildNoiseWall(scene, 36600, 43800, { height: 6.4, seed: 145, margin: 2.0, step: 12, gapChance: 0.14 });
  const blocks = placementsAlong(141, 36600, 43350, 17, 30, 190, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.2,
    sx: 15 + rand() * 16, sy: 12 + Math.pow(rand(), 1.3) * 48, sz: 13 + rand() * 14,
    color: new THREE.Color(brick[(rand() * brick.length) | 0]),
  }), 2);
  scatterInstanced(scene, boxGeo, blockMat, blocks);
  // housing-project towers in cruciform clusters
  const projects = placementsAlong(142, 37200, 42400, 220, 60, 230, (rand, pos, s) => ({
    pos, rot: headingAt(s),
    sx: 16 + rand() * 6, sy: 42 + rand() * 22, sz: 26 + rand() * 10,
    color: new THREE.Color(0x9c8468),
  }), 6);
  scatterInstanced(scene, boxGeo, blockMat, projects);
  for (const s of [37200, 39800]) {
    gantry(scene, registry, s, [
      { lat: 0, mesh: textBoard(['CROSS BRONX EXPWY', 'I-95 SOUTH'], 14, 3.4, '#046a38', '#ffffff') },
    ], 6.8);
  }
  gantry(scene, registry, 42400, [
    { lat: 0, mesh: textBoard(['GEO WASHINGTON BRIDGE', 'I-95 SOUTH · UPPER / LOWER LEVEL'], 18, 3.6, '#046a38', '#ffffff') },
  ], 7);
}

// ---------------------------------------------------------------------------
// Airports: apron, runway, terminals, tower, parked jets
// ---------------------------------------------------------------------------
function buildAirport(scene, registry, sMid, side, label, airline = null) {
  const heading = headingAt(sMid);
  const flat = (w, l, y, lat, color, rough = 1) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, l),
      new THREE.MeshStandardMaterial({ color, roughness: rough }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -heading;
    mesh.position.copy(posAt(sMid, lat, new THREE.Vector3()));
    mesh.position.y = groundY(sMid, lat) + y;
    scene.add(mesh);
  };
  flat(260, 2100, 0.06, side * 235, 0x4a4c4f);           // apron
  flat(48, 2400, 0.12, side * 315, 0x35373a, 0.9);       // runway
  // terminal fingers
  const termMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.7 });
  for (const dS of [-560, 0, 560]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 300), termMat);
    t.position.copy(posAt(sMid + dS, side * 152, new THREE.Vector3()));
    t.position.y = groundY(sMid + dS, side * 152) + 6;
    t.rotation.y = headingAt(sMid + dS);
    t.castShadow = true;
    scene.add(t);
  }
  // control tower
  const twr = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 34, 10),
    new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.6 }));
  shaft.position.y = 17;
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0x27343f, roughness: 0.3, metalness: 0.4 }));
  cab.position.y = 36;
  twr.add(shaft, cab);
  twr.position.copy(posAt(sMid + 300, side * 200, new THREE.Vector3()));
  twr.position.y = groundY(sMid + 300, side * 200);
  scene.add(twr);
  // parked jets at the gates
  const fuseGeo = new THREE.CylinderGeometry(2.0, 2.0, 32, 10);
  fuseGeo.rotateX(Math.PI / 2);
  const white = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.4, metalness: 0.2 });
  const rand = rng(sMid | 0);
  const jets = airline === 'united' ? 10 : 7;
  const unitedBlue = new THREE.MeshStandardMaterial({ color: 0x0b3b8c, roughness: 0.4 });
  const makeJet = i => {
    const g = new THREE.Group();
    const fuse = new THREE.Mesh(fuseGeo, white);
    fuse.position.y = 3;
    g.add(fuse);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 4.6), white);
    wings.position.y = 2.4;
    g.add(wings);
    // EWR is a United fortress hub: nearly every tail is blue
    const tailMat = airline === 'united'
      ? (i % 5 === 4
        ? new THREE.MeshStandardMaterial({ color: [0xc8342a, 0x0d6b3f][i % 2], roughness: 0.4 })
        : unitedBlue)
      : new THREE.MeshStandardMaterial({ color: [0x1f4fa3, 0xc8342a, 0x0d6b3f][i % 3], roughness: 0.4 });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 4.5), tailMat);
    tail.position.set(0, 6, -14);
    g.add(tail);
    if (airline === 'united') { // blue engine pods, the United look
      for (const ex of [-8, 8]) {
        const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 4, 8), unitedBlue);
        eng.rotation.x = Math.PI / 2;
        eng.position.set(ex, 1.7, 2);
        g.add(eng);
      }
    }
    return g;
  };
  for (let i = 0; i < jets; i++) {
    const g = makeJet(i);
    const ss = sMid - 900 + i * (1900 / jets) + rand() * 50;
    const ll = side * (196 + rand() * 18);
    g.position.copy(posAt(ss, ll, new THREE.Vector3()));
    g.position.y = groundY(ss, ll);
    g.rotation.y = headingAt(ss) + (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.2;
    scene.add(g);
  }
  // one departing off the runway end + one rolling for takeoff — the view
  // you get from the turnpike where the runway runs beside the road
  const dep = makeJet(1);
  const ds = sMid + 850;
  dep.position.copy(posAt(ds, side * 315, new THREE.Vector3()));
  dep.position.y = groundY(ds, side * 315) + 26;
  dep.rotation.y = headingAt(ds);
  dep.rotation.x = -0.22;
  scene.add(dep);
  const roll = makeJet(2);
  roll.position.copy(posAt(sMid - 400, side * 315, new THREE.Vector3()));
  roll.position.y = groundY(sMid - 400, side * 315);
  roll.rotation.y = headingAt(sMid - 400);
  scene.add(roll);
  gantry(scene, registry, sMid - 1100, [
    { lat: 0, mesh: textBoard([label, 'NEXT RIGHT ✈'], 15, 3.4, '#15355e', '#ffffff') },
  ], 6.8);
}

// The Meadowlands spurs: TWO SEPARATE TWO-WAY HIGHWAYS. The Western Spur
// (I-95 mainline) and the Eastern Spur (Secaucus / Lincoln Tunnel) are each a
// complete dual carriageway — 3 lanes each direction around their own barrier
// median — riding their own elevated decks over the marsh. They fork just
// south of the GWB toll and rejoin north of Newark; at each fork, two
// carriageways cross the other highway on stacked flyover decks (the road.js
// spur engine drives the lane geometry; this builds the structure/markings).
function spurBridges(scene, registry, s0, s1) {
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x6d7178, roughness: 0.85, side: THREE.DoubleSide });
  const paraMat = new THREE.MeshStandardMaterial({ color: 0xbfbbae, roughness: 0.9, side: THREE.DoubleSide });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8f8d86, roughness: 0.9 });
  const bMat = new THREE.MeshStandardMaterial({ color: 0x9b9b93, roughness: 0.85, side: THREE.DoubleSide });
  const wMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  const yMat = new THREE.MeshBasicMaterial({ color: 0xd7a900 });
  const { g: G, m: M } = SPUR;
  const spurHalf = M + 3 * LANE_WIDTH + 2.9;      // full half-width of one spur roadway

  for (const side of [-1, 1]) {
    // deck underside slab + parapets for each spur (follows the fork blend:
    // the deck rides the spur center as it swings out from the mainline)
    const ctr = s => side * Math.max(spurTAt(s) * G, 0.001);
    scene.add(new THREE.Mesh(buildRibbon(
      s => ctr(s) - spurHalf * Math.max(spurTAt(s), 0.35),
      s => ctr(s) + spurHalf * Math.max(spurTAt(s), 0.35),
      -0.85, -0.85, 12, s0, s1), deckMat));
    for (const out of [-1, 1]) {
      scene.add(new THREE.Mesh(buildRibbon(
        s => ctr(s) + out * spurHalf * spurTAt(s),
        s => ctr(s) + out * (spurHalf * spurTAt(s) + 0.35),
        -0.85, 0.65, 8, s0, s1), paraMat));
    }
    // each spur's own median: jersey barrier + double yellow both sides of it
    const bc = s => side * G * Math.max(spurTAt(s), 0.02);
    scene.add(new THREE.Mesh(buildRibbon(s => bc(s) - 0.35, s => bc(s) + 0.35, 0.8, 0.8, 12, 45350, 52050), bMat));
    scene.add(new THREE.Mesh(buildRibbon(s => bc(s) - 0.5, s => bc(s) - 0.35, 0, 0.8, 12, 45350, 52050), bMat));
    scene.add(new THREE.Mesh(buildRibbon(s => bc(s) + 0.35, s => bc(s) + 0.5, 0, 0.8, 12, 45350, 52050), bMat));
    for (const out of [-1, 1]) {
      const yl = s => bc(s) + out * M * spurTAt(s);
      scene.add(new THREE.Mesh(buildRibbon(s => yl(s) - 0.08, s => yl(s) + 0.08, 0.03, 0.03, 10, 46400, 51150), yMat));
    }
    // inner white edge line where the pavement parts around the void
    const ie = s => side * spurTAt(s) * (G - M - 3 * LANE_WIDTH - 0.4);
    scene.add(new THREE.Mesh(buildRibbon(s => ie(s) - 0.08, s => ie(s) + 0.08, 0.03, 0.03, 10, 45300, 52150), wMat));
  }

  // lane dashes on the formed spurs (road.js skips its own through the fork)
  {
    const verts = [], idx = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3();
    const bounds = [];
    for (const side of [-1, 1]) for (const inner of [-1, 1]) for (let k = 1; k < 3; k++) {
      bounds.push(side * (G + inner * (M + LANE_WIDTH * k)));
    }
    for (const lat of bounds) {
      for (let s = 46600; s < 51000; s += 12) {
        posAt(s, lat - 0.075, a); posAt(s, lat + 0.075, b);
        posAt(s + 3, lat - 0.075, c); posAt(s + 3, lat + 0.075, d);
        const kk = verts.length / 3;
        verts.push(a.x, a.y + 0.03, a.z, b.x, b.y + 0.03, b.z, c.x, c.y + 0.03, c.z, d.x, d.y + 0.03, d.z);
        idx.push(kk, kk + 2, kk + 1, kk + 1, kk + 2, kk + 3);
      }
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    dg.setIndex(idx); dg.computeVertexNormals();
    scene.add(new THREE.Mesh(dg, wMat));
  }

  // the two crossing flyovers at each fork: elevated 3-lane decks with
  // parapets and support columns (dir +s lanes 3-5 ride the top deck to the
  // eastern spur; dir -s lanes 0-2 the lower deck to the western spur)
  const flyMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.95, side: THREE.DoubleSide });
  const colGeo2 = new THREE.BoxGeometry(1.6, 1, 1.6); colGeo2.translate(0, 0.5, 0);
  const colSpots = [];
  for (const [dir, lane] of [[1, 4], [-1, 1]]) {
    for (const [f0, f1] of [[45150, 46450], [51150, 52350]]) {
      const ctr = s => latForLane(dir, lane, s);
      const y = s => spurRiseAt(s, dir, lane) + 0.04;
      scene.add(new THREE.Mesh(buildRibbon(
        s => ctr(s) - 6.6, s => ctr(s) + 6.6, y, y, 8, f0, f1), flyMat));
      for (const out of [-1, 1]) {
        scene.add(new THREE.Mesh(buildRibbon(
          s => ctr(s) + out * 6.6, s => ctr(s) + out * 6.95,
          s => y(s), s => y(s) + 0.9, 8, f0, f1), paraMat));
      }
      for (let s = f0 + 60; s < f1 - 40; s += 55) {
        if (spurRiseAt(s, dir, lane) > 1.2) colSpots.push([s, ctr(s), spurRiseAt(s, dir, lane)]);
      }
    }
  }
  const cols = new THREE.InstancedMesh(colGeo2, pierMat, colSpots.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const p = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    colSpots.forEach(([s, lat, rise], i) => {
      posAt(s, lat, p);
      const top = p.y + rise;
      p.y -= bridgeBumpAt(s) + 2;
      q.setFromAxisAngle(UP, headingAt(s));
      sc.set(1, Math.max(2, top - p.y - 0.6), 1);
      m.compose(p, q, sc);
      cols.setMatrixAt(i, m);
    });
  }
  scene.add(cols);

  // concrete bents under both spurs wherever the decks ride elevated
  const colGeo = new THREE.BoxGeometry(1.8, 1, 1.8);
  colGeo.translate(0, 0.5, 0);
  const spots = [];
  for (let s = s0; s < s1; s += 30) if (bridgeBumpAt(s) > 1.5) spots.push(s);
  const legs = new THREE.InstancedMesh(colGeo, pierMat, spots.length * 2);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const p = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let i = 0;
  for (const s of spots) {
    q.setFromAxisAngle(UP, headingAt(s));
    const base = elevAt(s) - (bridgeBumpAt(s) + 1.5);
    const h = Math.max(2, elevAt(s) - 0.9 - base);
    for (const side of [-1, 1]) {
      posAt(s, side * G * spurTAt(s), p);
      p.y = base;
      sc.set(1, h, 1);
      m.compose(p, q, sc);
      legs.setMatrixAt(i++, m);
    }
  }
  scene.add(legs);

  // Meadowlands marsh below and between the decks: green brackish flat
  const marsh = new THREE.Mesh(
    new THREE.PlaneGeometry(300, s1 - s0, 1, 12),
    new THREE.MeshStandardMaterial({ color: 0x3c4a34, roughness: 0.7, metalness: 0.12 })
  );
  marsh.rotation.x = -Math.PI / 2;
  const mid = (s0 + s1) / 2;
  marsh.position.copy(posAt(mid, 0, new THREE.Vector3()));
  marsh.position.y = -0.9;
  marsh.rotation.z = -headingAt(mid);
  scene.add(marsh);

  // eastern-spur connector curving off + descending toward the Lincoln Tunnel
  const rampMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.95, side: THREE.DoubleSide });
  {
    const edge = s => G + spurHalf;
    const t = s => Math.max(0, Math.min(1, (s - 47700) / 1000));
    const spread = s => t(s) * 26;
    const drop = s => -0.85 - t(s) * t(s) * 7;
    scene.add(new THREE.Mesh(buildRibbon(
      s => edge(s) + spread(s),
      s => edge(s) + spread(s) + 3.6,
      drop, drop, 10, 47700, 48700), rampMat));
  }
}

// ---------------------------------------------------------------------------
// NJ Turnpike: GWB landing → toll → E/W spurs → dual-dual → EWR → Raritan → PA
// ---------------------------------------------------------------------------
function buildTurnpikeI95(scene, registry) {
  // Fort Lee: what I-95 actually looks like coming off the GWB — apartment
  // slabs on the Palisades, dense trees, big green signage. No supertalls.
  const blockMat = lowLitMaterial(registry);
  const slabTints = [0xc9c2b4, 0xb8bcc4, 0xa89e90, 0x9aa4b0];
  const fortLee = placementsAlong(161, 44550, 45750, 55, 70, 260, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.3,
    sx: 18 + rand() * 14, sy: 18 + rand() * 36, sz: 14 + rand() * 10,
    color: new THREE.Color(slabTints[(rand() * slabTints.length) | 0]),
  }), 8);
  scatterInstanced(scene, boxGeo, blockMat, fortLee);
  buildTrees(scene, 162, 44420, 46200, 26, 55, 320, 80);
  // off the GWB: barrier toll, then straight into the Western/Eastern spur fork
  gantry(scene, registry, 44480, [
    { lat: 0, mesh: textBoard(['TOLL PLAZA 1/4 MILE', 'E-ZPass KEEP LEFT'], 16, 3.4, '#3d1d63', '#ffffff') },
  ], 7);
  buildTollPlaza(scene, registry, 44650);
  gantry(scene, registry, 44980, [
    { lat: 0, mesh: textBoard(['NJ TURNPIKE · I-95 SOUTH', 'WESTERN & EASTERN SPUR', 'TWO SEPARATE ROADWAYS'], 17, 3.6, '#046a38', '#ffffff') },
  ], 7);
  const innerLat = MEDIAN_HALF + LANE_WIDTH * 1.5;
  const outerLat = MEDIAN_HALF + LANE_WIDTH * 4.5 + 6;

  // The north-Jersey mainline is not uniformly at grade. These discrete deck
  // runs follow the real sequence of interchange, rail, creek and industrial
  // crossings through Newark/Elizabeth, then shorter Woodbridge/Edison spans.
  // Keeping gaps between them is important: central Jersey is enclosed, but
  // it is not one continuous viaduct.
  const deckRail = new THREE.MeshStandardMaterial({ color: 0x969a98, roughness: 0.88 });
  const deckUnder = new THREE.MeshStandardMaterial({ color: 0x515759, roughness: 0.94 });
  const turnpikeDeck = (s0, s1) => {
    viaductPiers(scene, s0, s1);
    for (const side of [-1, 1]) {
      const edge = s => side * (pavedHalfAt(s) + 0.32);
      scene.add(new THREE.Mesh(buildRibbon(
        s => edge(s) - 0.18, s => edge(s) + 0.18, 0.92, 0.92, 10, s0, s1), deckRail));
    }
    scene.add(new THREE.Mesh(buildRibbon(
      s => -pavedHalfAt(s) - 0.15, s => pavedHalfAt(s) + 0.15,
      -1.05, -1.05, 10, s0, s1), deckUnder));
  };

  // The fork. Western spur = I-95 mainline (straight to the GWB northbound);
  // Eastern spur = the local side, carrying Secaucus / Lincoln Tunnel traffic.
  // Advance sign for southbound drivers just off the bridge:
  gantry(scene, registry, 44720, [
    { lat: -innerLat, mesh: textBoard(['SPUR SPLIT · 1/2 MILE', 'WEST → I-95    EAST → LINCOLN TUNNEL'], 17, 3.0, '#046a38', '#ffffff') },
  ], 6.9);
  gantry(scene, registry, 45400, [
    // southbound fork guidance
    { lat: -innerLat, mesh: textBoard(['WESTERN SPUR', 'I-95 SOUTH · NEWARK'], 9.5, 3.2, '#046a38', '#ffffff') },
    { lat: -outerLat, mesh: textBoard(['EASTERN SPUR (LOCAL)', 'SECAUCUS · LINCOLN TUNNEL'], 12, 3.2, '#046a38', '#ffffff') },
    // northbound drivers are merging back onto the GWB here
    { lat: innerLat, mesh: textBoard(['SPURS MERGE', 'GEO WASHINGTON BRIDGE'], 12, 3.2, '#046a38', '#ffffff') },
  ], 6.6);
  // Lincoln Tunnel / NJ-495 connection peeling off the eastern spur mid-marsh
  gantry(scene, registry, 48200, [
    { lat: -outerLat, mesh: textBoard(['EXIT 16E', 'LINCOLN TUNNEL · NYC'], 9.5, 3.2, '#046a38', '#ffffff') },
    { lat: outerLat, mesh: textBoard(['EXIT 16E', 'LINCOLN TUNNEL · NYC'], 9.5, 3.2, '#046a38', '#ffffff') },
  ], 6.6);
  // the two elevated decks + the eastern-spur ramp down toward the tunnel
  spurBridges(scene, registry, 45200, 52200);
  for (const [s0, s1] of [
    [52100, 54400], // Newark merge, Interchange 15E/14 and EWR approaches
    [54700, 56300], // Elizabeth: rail yards, local roads and industrial flats
    [56900, 58100], // Linden/Rahway industrial crossings
    [59000, 60200], // Woodbridge interchange and creek
    [62600, 63700], // Edison rail/local-road crossing
    [64900, 66000], // Edison short raised crossing
    [69800, 72700], // dual-dual Turnpike connectors rising from the toll fan
  ]) turnpikeDeck(s0, s1);
  // Newark end: southbound drivers merge here; northbound drivers split. Advance
  // sign for northbound traffic just before the fork:
  gantry(scene, registry, 52650, [
    { lat: outerLat, mesh: textBoard(['SPUR SPLIT · 1/2 MILE', 'WEST → GWB    EAST → LINCOLN TUNNEL'], 17, 3.0, '#046a38', '#ffffff') },
  ], 6.9);
  gantry(scene, registry, 52050, [
    // southbound drivers merging toward Newark
    { lat: -innerLat, mesh: textBoard(['SPURS MERGE', 'NEWARK AIRPORT NEXT'], 12, 3.2, '#046a38', '#ffffff') },
    // northbound fork guidance
    { lat: innerLat, mesh: textBoard(['WESTERN SPUR', 'I-95 · GWB STRAIGHT'], 9.5, 3.2, '#046a38', '#ffffff') },
    { lat: outerLat, mesh: textBoard(['EASTERN SPUR (LOCAL)', 'SECAUCUS · LINCOLN TUNNEL'], 12, 3.2, '#046a38', '#ffffff') },
  ], 6.6);
  // dual-dual begins south of Newark: the classic turnpike roadway split
  gantry(scene, registry, 53550, [
    { lat: -innerLat, mesh: textBoard(['CARS', 'ONLY'], 7, 3.2, '#046a38', '#ffffff') },
    { lat: -outerLat, mesh: textBoard(['CARS · TRUCKS', 'BUSES'], 8.5, 3.2, '#046a38', '#ffffff') },
    { lat: innerLat, mesh: textBoard(['CARS', 'ONLY'], 7, 3.2, '#046a38', '#ffffff') },
    { lat: outerLat, mesh: textBoard(['CARS · TRUCKS', 'BUSES'], 8.5, 3.2, '#046a38', '#ffffff') },
  ], 6.6);
  // Bordentown end (Exit 7): where I-95 becomes the NJ Turnpike. Northbound the
  // dual-dual split begins here right after the E-ZPass toll; southbound the two
  // roadways merge back to a single I-95 carriageway.
  gantry(scene, registry, 72300, [
    { lat: 0, mesh: textBoard(['ROADWAYS MERGE', 'I-95 SOUTH · 3 LANES'], 14, 3.4, '#046a38', '#ffffff') },
  ], 6.8);
  gantry(scene, registry, 72100, [
    { lat: -innerLat, mesh: textBoard(['CARS', 'ONLY'], 7, 3.2, '#046a38', '#ffffff') },
    { lat: -outerLat, mesh: textBoard(['CARS · TRUCKS', 'BUSES'], 8.5, 3.2, '#046a38', '#ffffff') },
    { lat: innerLat, mesh: textBoard(['CARS', 'ONLY'], 7, 3.2, '#046a38', '#ffffff') },
    { lat: outerLat, mesh: textBoard(['CARS · TRUCKS', 'BUSES'], 8.5, 3.2, '#046a38', '#ffffff') },
  ], 6.6);
  // E-ZPass toll where I-95 joins the Turnpike at Bordentown
  gantry(scene, registry, 73300, [
    { lat: 0, mesh: textBoard(['NJ TURNPIKE · TOLL 1/4 MILE', 'E-ZPass · CARS-TRUCKS-BUSES SPLIT'], 17, 3.4, '#3d1d63', '#ffffff') },
  ], 7);
  buildTollPlaza(scene, registry, 73000, undefined, 5);
  gantry(scene, registry, 74600, [
    { lat: 0, mesh: textBoard(['NJ TURNPIKE ENTRANCE', '5-LANE E-ZPass PLAZA · 1 MILE'], 17, 3.5, '#3d1d63', '#ffffff') },
  ], 7.1);
  gantry(scene, registry, 72600, [
    { lat: -outerLat, mesh: textBoard(['CARS · TRUCKS · BUSES', 'OUTER ROADWAY'], 11, 3.2, '#046a38', '#ffffff') },
    { lat: -innerLat, mesh: textBoard(['CARS ONLY', 'INNER ROADWAY'], 9.5, 3.2, '#046a38', '#ffffff') },
    { lat: outerLat, mesh: textBoard(['I-95 SOUTH', 'E-ZPass PLAZA AHEAD'], 10.5, 3.2, '#3d1d63', '#ffffff') },
  ], 7);

  // dual-dual divider south of Newark: concrete barrier + edge lines. The spur
  // decks north of here get their own parapets from spurBridges().
  const bMat = new THREE.MeshStandardMaterial({ color: 0x9b9b93, roughness: 0.85, side: THREE.DoubleSide });
  const wMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  for (const side of [-1, 1]) {
    const center = s => side * (MEDIAN_HALF + 3 * LANE_WIDTH + njGapAt(s) / 2);
    scene.add(new THREE.Mesh(buildRibbon(
      s => center(s) - 0.35, s => center(s) + 0.35, 0.8, 0.8, 12, 53050, 72200), bMat));
    scene.add(new THREE.Mesh(buildRibbon(
      s => center(s) - 0.5, s => center(s) - 0.35, 0, 0.8, 12, 53050, 72200), bMat));
    scene.add(new THREE.Mesh(buildRibbon(
      s => center(s) + 0.35, s => center(s) + 0.5, 0, 0.8, 12, 53050, 72200), bMat));
    const eIn = s => side * (MEDIAN_HALF + 3 * LANE_WIDTH + 0.15);
    const eOut = s => side * (MEDIAN_HALF + 3 * LANE_WIDTH + njGapAt(s) - 0.15);
    scene.add(new THREE.Mesh(buildRibbon(s => eIn(s) - 0.08, s => eIn(s) + 0.08, 0.03, 0.03, 10, 53050, 72400), wMat));
    scene.add(new THREE.Mesh(buildRibbon(s => eOut(s) - 0.08, s => eOut(s) + 0.08, 0.03, 0.03, 10, 53050, 72400), wMat));
  }

  // Port Newark cranes beside the elevated spurs
  port(scene, 404, 48200, 50600);

  // North Jersey is NEVER empty: the Manhattan skyline wall far off to the
  // east the whole way down the spurs and past Newark, the wooded Watchung
  // ridge to the west, and receding sprawl filling every direction between.
  // Manhattan is not a continuous backdrop along I-95. It only appears on
  // the southbound approach to Newark, well off the right/east side of the
  // Turnpike; northbound drivers should not be looking into this skyline.
  if (DIR > 0) skyline(scene, registry, 957, 50000, 56500, 30, 780, 1500, 70, 300, [-1]);
  farRidge(scene, 4412, 44500, 66000, -1);
  deepSprawl(scene, 8803, 52200, 61500, { density: 1.0, latStart: 320 });

  // Newark Liberty: runway right beside the roadway, United tails everywhere
  buildAirport(scene, registry, 53200, -1, 'EWR · NEWARK LIBERTY INTL', 'united');

  // Exit 11 (Woodbridge, s=59800): the Turnpike's gateway to the GSP and the
  // beach — signed SHORE POINTS southbound the way NJ actually signs it
  welcomeSign(scene, registry, 57900, 1, ['EXIT 11 · 1 MILE', 'GARDEN STATE PKWY', 'SHORE POINTS'], '#046a38');
  welcomeSign(scene, registry, 59400, 1, ['EXIT 11', 'GARDEN STATE PKWY', 'SHORE POINTS'], '#046a38');

  // industrial sprawl down to 8A — with a clear window at EWR so the
  // terminals, apron, and runway stay in full view from the roadway
  buildSuburb(scene, registry, 46600, 52100, { wall: true, turnpike: true }); // Newark/EWR/port — screened
  buildSuburb(scene, registry, 54400, 72800, { wall: true, turnpike: true, noiseWall: false }); // explicit walls below own this span
  // Elizabeth alternates factory views with concrete/acoustic screens. Edison
  // is much greener: close walls and dense tree belts hide the suburban backs
  // while the short bridge decks still reveal rail/local-road crossings.
  buildNoiseWall(scene, 52600, 59400, { seed: 9830, height: 5.6, margin: 4.2, step: 11, gapChance: 0.24 });
  buildNoiseWall(scene, 59600, 68000, { seed: 9831, height: 6.2, margin: 3.8, step: 10, gapChance: 0.09 });
  buildNoiseWall(scene, 68000, 72800, { seed: 9832, height: 5.8, margin: 3.8, step: 11, gapChance: 0.08 });
  buildTrees(scene, 9832, 59600, 68000, 14, 44, 280, 150);
  buildTrees(scene, 964, 68000, 76800, 22, 60, 380, 160);
  buildBillboards(scene, registry, 965, 68200, 76400, 10);
  // central-NJ development keeps going behind the front row down to the river
  deepSprawl(scene, 8802, 72800, 76500, { towers: false, latStart: 320 });

  // I-95 reassurance gantries
  for (const s of [49800, 56900, 59400, 64200, 67800, 71400, 74200]) {
    gantry(scene, registry, s, [
      { lat: 0, mesh: textBoard(['NJ TURNPIKE', 'I-95 SOUTH'], 12, 3.2, '#046a38', '#ffffff') },
    ], 6.8);
  }

  // Raritan River crossing — open low-girder bridge (no view-blocking truss
  // walls; in real life the crossing is wide open to the west)
  const girder = new THREE.MeshStandardMaterial({ color: 0x77828c, roughness: 0.5, metalness: 0.55, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const latF = s => side * (pavedHalfAt(s) + 0.5);
    scene.add(new THREE.Mesh(buildRibbon(latF, latF, -1.4, 1.15, 10, 61150, 61650), girder));
  }
  water(scene, 61400, 480, 1800);
  // Central Jersey is screened from the Turnpike here. New Brunswick is a
  // nearby city, but it should not read as a visible skyline from this route.
}

// Carteret / Linden / Elizabeth industrial belt: freight plants, tanks,
// pipework and stacks sit back from the Turnpike before Newark Airport. The
// distant NYC skyline stays on the horizon instead of clipping the roadway.
function buildCarteretFactories(scene, registry) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x7b8588, roughness: 0.72, metalness: 0.35 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8e8a7d, roughness: 0.9 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xb8b3a4, roughness: 0.5, metalness: 0.45 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x9b6b42, roughness: 0.55, metalness: 0.35 });
  const smoke = new THREE.MeshBasicMaterial({ color: 0x9a9b93, transparent: true, opacity: 0.22 });
  const rand = rng(9761);
  for (let s = 54800; s < 59400; s += 360 + rand() * 240) {
    const side = rand() < 0.58 ? -1 : 1;
    const lat = side * (330 + rand() * 230);
    const p = posAt(s, lat, new THREE.Vector3());
    const g = new THREE.Group();
    g.position.set(p.x, groundY(s, lat), p.z);
    g.rotation.y = headingAt(s) + (rand() - 0.5) * 0.14;
    const w = 28 + rand() * 34, h = 8 + rand() * 12, d = 24 + rand() * 30;
    const plant = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), concrete);
    plant.position.y = h / 2; g.add(plant);
    for (let i = 0; i < 2 + (rand() * 3 | 0); i++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(4 + rand() * 3, 4 + rand() * 3, 8 + rand() * 8, 12), tankMat);
      tank.rotation.z = Math.PI / 2;
      tank.position.set((rand() - 0.5) * w, 6 + rand() * 4, (rand() - 0.5) * d);
      g.add(tank);
    }
    for (let i = 0; i < 1 + (rand() * 2 | 0); i++) {
      const sh = 20 + rand() * 28;
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.7, sh, 10), steel);
      stack.position.set((rand() - 0.5) * w * 0.6, h + sh / 2, (rand() - 0.5) * d * 0.5);
      g.add(stack);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(2.8 + rand() * 2.4, 8, 6), smoke);
      puff.position.set(stack.position.x, h + sh + 3, stack.position.z);
      g.add(puff);
    }
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, w * 1.6, 8), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, h + 4, d * 0.38);
    g.add(pipe);
    scene.add(g);
  }
  buildSuburb(scene, registry, 54800, 59400, { wall: true, turnpike: true, noiseWall: false });
  if (DIR > 0) skyline(scene, registry, 9762, 50000, 57500, 18, 850, 1500, 60, 250, [-1]);
  for (const s of [55500, 57400, 59000]) {
    gantry(scene, registry, s, [{ lat: 0, mesh: textBoard(['NJ TURNPIKE', 'NEW YORK · NEWARK AIRPORT'], 15, 3.4, '#046a38', '#ffffff') }], 6.9);
  }
  // Keep the wall treatment continuous through Bordentown rather than letting
  // the Central Jersey landscape suddenly open up after Exit 7.
  buildNoiseWall(scene, 72800, 77000, { seed: 9820, height: 5.8, margin: 3.8, step: 12, gapChance: 0.11 });
  buildTrees(scene, 9821, 72800, 77000, 12, 42, 170, 120);
}

// ---------------------------------------------------------------------------
// Philadelphia + southern PA
// ---------------------------------------------------------------------------
// A roadside screen is different from the distant forest blanket in main.js:
// these two close bands are intentionally tight enough to hide the backs of
// houses, parking lots, and flat empty terrain from the driver's eye line.
function roadsideScreen(scene, seed, s0, s1, { pine = false, step = 14 } = {}) {
  buildTrees(scene, seed, s0, s1, step, 28, 145, 0, pine, 1.2);
  buildTrees(scene, seed + 1, s0, s1, step + 3, 42, 230, 0, !pine, 1.12);
}

// Ordinary highway overpasses: local streets, rail lines and utility roads
// cross I-95 constantly. These are deliberately separate from bridge decks in
// road.js, so they never alter lane height, collision, or traffic topology.
function minorOverpass(scene, s, seed = 0) {
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x858a8d, roughness: 0.8, metalness: 0.15 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x5d6468, roughness: 0.65, metalness: 0.35 });
  const p = posAt(s, 0, new THREE.Vector3());
  const y = elevAt(s) + 8.0;
  const half = pavedHalfAt(s) + 7;
  const span = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.25, 8.5), deckMat);
  span.position.set(p.x, y, p.z);
  span.rotation.y = headingAt(s);
  scene.add(span);
  for (const side of [-1, 1]) {
    const lat = side * (pavedHalfAt(s) + 3.6);
    const q = posAt(s, lat, new THREE.Vector3());
    const h = Math.max(3, y - groundY(s, lat));
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.25, h, 1.25), deckMat);
    pier.position.set(q.x, groundY(s, lat) + h / 2, q.z);
    scene.add(pier);
  }
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.65, 0.22), railMat);
    rail.position.set(p.x, y + 1.0, p.z + side * 3.7);
    rail.rotation.y = headingAt(s);
    scene.add(rail);
  }
  // Sparse amber work/maintenance lamps make the overpasses read at dusk
  // without turning every rural crossing into a lit interchange.
  if ((seed & 1) === 0) {
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc36b });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.2), lampMat);
    lamp.position.set(p.x, y + 1.35, p.z);
    lamp.rotation.y = headingAt(s);
    scene.add(lamp);
  }
}

function buildMinorOverpasses(scene) {
  const sites = [
    6400, 11800, 17800, 27400, 34800,       // CT / Westchester
    52500, 54100, 56500, 58400, 60500,      // Newark / Elizabeth / Woodbridge
    62200, 64100, 66800, 68600,             // Edison / Central NJ
    80400, 84600, 90400,                    // Philadelphia / PA
    211000, 242000, 287000,                 // Baltimore / Beltway
    314500, 327000, 348000,                 // Northern Virginia / Fredericksburg
    472000, 507000, 742000, 895000,         // Richmond / NC / SC
    1278200, 1465000, 1637000, 1879000,     // Savannah / Jacksonville / Florida
  ];
  sites.forEach((s, i) => minorOverpass(scene, s, i));
}

// Philadelphia's northern I-95/Turnpike connection: two elevated connector
// lanes peel away, clear the river approach, pass the free-flow Turnpike
// decision area, then sweep back down toward the Turnpike. It is a visual roadway
// parallel to the proven mainline physics, so it cannot strand the player or
// create a second collision topology.
function buildPhillyTurnpikeFlyovers(scene, registry) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x34383b, roughness: 0.92 });
  const barrier = new THREE.MeshStandardMaterial({ color: 0x9b9d9b, roughness: 0.85 });
  const white = new THREE.MeshBasicMaterial({ color: 0xe2e2dc });
  const rampA = s => -31 - 72 * Math.sin(Math.PI * Math.min(1, Math.max(0, (s - 77750) / 1150)));
  const rampB = s => rampA(s) - 7.4;
  // Keep the connector visibly above the mainline/river bridge instead of
  // using a fixed world height that can disappear inside the deck elevation.
  const rampY = s => elevAt(s) + 5.5 + 2.0 * Math.sin(Math.PI * Math.min(1, Math.max(0, (s - 77750) / 1150)));
  scene.add(new THREE.Mesh(buildRibbon(rampA, rampB, rampY, rampY, 10, 77750, 78900), asphalt));
  for (const edge of [rampA, rampB]) scene.add(new THREE.Mesh(buildRibbon(s => edge(s) - 0.18, s => edge(s) + 0.18, s => rampY(s) + 0.9, s => rampY(s) + 0.9, 10, 77750, 78900), barrier));
  scene.add(new THREE.Mesh(buildRibbon(s => (rampA(s) + rampB(s)) / 2, s => (rampA(s) + rampB(s)) / 2, s => rampY(s) + 0.04, s => rampY(s) + 0.04, 10, 77750, 78900), white));
  const connector = textBoard(['TURNPIKE CONNECTOR', 'FREE FLOW · KEEP MOVING'], 15, 3.3, '#046a38', '#ffffff');
  connector.position.copy(posAt(78300, -95, new THREE.Vector3())); connector.position.y = rampY(78300) + 5; connector.rotation.y = headingAt(78300) + Math.PI / 2; scene.add(connector); registry.signs.push({ userData: { board: connector } });
  // Low connector supports are outside the travel envelope; the deck remains
  // cleanly above the road and never receives terrain or water geometry.
  for (const s of [78000, 78350, 78700, 79050]) {
    for (const side of [-1, 1]) {
      const lat = side * (Math.abs(rampA(s)) + 4);
      const p = posAt(s, lat, new THREE.Vector3()); const h = Math.max(4, rampY(s) - groundY(s, lat));
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 1.3), barrier);
      pier.position.set(p.x, groundY(s, lat) + h / 2, p.z); scene.add(pier);
    }
  }
}

// Continuous structural language for a raised approach: visible underside,
// outer parapets and correctly grounded bents. The center river span is kept
// out of these ranges so piers never appear in the navigation channel.
function buildRaisedApproach(scene, s0, s1) {
  viaductPiers(scene, s0, s1);
  const rail = new THREE.MeshStandardMaterial({ color: 0x929796, roughness: 0.86 });
  const underside = new THREE.MeshStandardMaterial({ color: 0x4e5558, roughness: 0.94 });
  for (const side of [-1, 1]) {
    const edge = s => side * (pavedHalfAt(s) + 0.38);
    scene.add(new THREE.Mesh(buildRibbon(
      s => edge(s) - 0.2, s => edge(s) + 0.2, 0.95, 0.95, 8, s0, s1), rail));
  }
  scene.add(new THREE.Mesh(buildRibbon(
    s => -pavedHalfAt(s) - 0.2, s => pavedHalfAt(s) + 0.2,
    -1.2, -1.2, 8, s0, s1), underside));
}

function buildPhillyCrossingContext(scene, registry) {
  buildRaisedApproach(scene, 75600, 77030);
  buildRaisedApproach(scene, 78070, 80000);

  // Bristol/Burlington is low, gritty river industry rather than a downtown
  // skyline: brick warehouses, rail-served plants, tanks and tree-screened
  // neighborhoods continue underneath and beyond the elevated approaches.
  const industrialMat = lowLitMaterial(registry);
  const tones = [0x79584a, 0x8a6655, 0x695e55, 0x8b8174, 0x725247];
  const sheds = placementsAlong(9750, 74400, 80400, 30, 85, 390, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.16,
    sx: 24 + rand() * 46, sy: 5 + rand() * 12, sz: 18 + rand() * 44,
    color: new THREE.Color(tones[(rand() * tones.length) | 0]),
  }), 3);
  scatterInstanced(scene, boxGeo, industrialMat, sheds);
  deepSprawl(scene, 9751, 74200, 80700, { towers: false, density: 1.1, latStart: 250, litMat: industrialMat });
  buildTrees(scene, 9753, 73600, 77000, 13, 42, 270, 95);

  // Local streets and freight/commuter rail remain visibly active beneath the
  // approaches. They sit at ground level and never intersect the raised deck.
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2f3233, roughness: 0.96 });
  const rail = new THREE.MeshStandardMaterial({ color: 0x5b4d42, roughness: 0.85, metalness: 0.15 });
  for (const [s, width, mat] of [
    [76050, 230, asphalt], [76520, 300, rail], [78620, 260, rail], [79380, 220, asphalt],
  ]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.16, mat === rail ? 5 : 10), mat);
    const p = posAt(s, 0, new THREE.Vector3());
    strip.position.set(p.x, groundY(s, 0) + 0.08, p.z);
    strip.rotation.y = headingAt(s);
    scene.add(strip);
  }

  // Sodium-white edge lights make the crossing readable at night without a
  // runway-like illuminated median.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd89a });
  for (let s = 76540; s < 78200; s += 78) {
    for (const side of [-1, 1]) {
      const p = posAt(s, side * (pavedHalfAt(s) + 0.6), new THREE.Vector3());
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), lampMat);
      lamp.position.set(p.x, p.y + 1.3, p.z); scene.add(lamp);
    }
  }
}

function buildPhilly(scene, registry) {
  bridgeStructure(scene, 77030, 78070, [77330, 77770]);
  buildPhillyCrossingContext(scene, registry);
  // From the river/urban approach through Northeast Philly, I-95 is a long
  // elevated viaduct above the surrounding city and wooded suburban fabric.
  // The road elevation comes from bridgeBumpAt; these elements supply the
  // visible deck underside, piers, and continuous parapets.
  viaductPiers(scene, 78000, 89500);
  const viaductRail = new THREE.MeshStandardMaterial({ color: 0x8e9291, roughness: 0.88 });
  const viaductUnderside = new THREE.MeshStandardMaterial({ color: 0x555b5c, roughness: 0.92 });
  for (const side of [-1, 1]) {
    const edge = s => side * (pavedHalfAt(s) + 0.35);
    scene.add(new THREE.Mesh(buildRibbon(s => edge(s) - 0.18, s => edge(s) + 0.18, 0.95, 0.95, 10, 78000, 89500), viaductRail));
  }
  scene.add(new THREE.Mesh(buildRibbon(s => -pavedHalfAt(s) - 0.2, s => pavedHalfAt(s) + 0.2, -1.15, -1.15, 10, 78000, 89500), viaductUnderside));
  water(scene, 77550, 620, 2600);
  buildPhillyTurnpikeFlyovers(scene, registry);
  // Northbound/southbound guidance through the I-95 / PA Turnpike / NJ
  // Turnpike connection: the bridge and flyover sequence should read as a
  // route choice, not as a generic city edge.
  gantry(scene, registry, 76880, [
    { lat: 0, mesh: textBoard(['I-95 NORTH', 'NEW YORK · NEW JERSEY'], 15, 3.4, '#046a38', '#ffffff') },
  ], 6.9);
  gantry(scene, registry, 77420, [
    { lat: 0, mesh: textBoard(['DELAWARE RIVER BRIDGE', 'I-95 · PA TURNPIKE · NJ TURNPIKE'], 17, 3.5, '#046a38', '#ffffff') },
  ], 7.1);
  gantry(scene, registry, 78180, [
    { lat: 0, mesh: textBoard(['NJ TURNPIKE EXIT 6', 'PEARL HARBOR EXTENSION'], 16, 3.4, '#046a38', '#ffffff') },
  ], 7);
  gantry(scene, registry, 78280, [
    { lat: 0, mesh: textBoard(['I-95 FREE FLOW', 'NO TOLL TO NEW JERSEY'], 13, 3.2, '#046a38', '#ffffff') },
  ], 7);
  gantry(scene, registry, 78900, [
    { lat: 0, mesh: textBoard(['NJ TURNPIKE NORTH', 'TRENTON · NEW YORK'], 14, 3.3, '#046a38', '#ffffff') },
  ], 6.9);
  gantry(scene, registry, 79600, [
    { lat: 0, mesh: textBoard(['I-95 NORTH · NEW YORK', 'NJ TURNPIKE · TRENTON', '2 LANES TO BRIDGE'], 16, 3.5, '#046a38', '#ffffff') },
  ], 7);
  // Northeast Philly first: leafy rowhouse-and-ranch suburbs along the
  // interstate before Center City rises (Academy Rd / Cottman Ave stretch)
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8];
  const nePhilly = placementsAlong(905, 78300, 83800, 20, 85, 320, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2),
    sx: 9 + rand() * 5, sy: 3.6 + rand() * 3, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, boxGeo,
    lowLitMaterial(registry), nePhilly);
  // The river-to-city approach is the long, enclosed Northeast Philadelphia
  // suburban leg: continuous walls at the shoulder, then two dense tree belts
  // that screen the houses and commercial sprawl behind them.
  buildNoiseWall(scene, 78200, 85200, { seed: 9081, height: 5.8, margin: 4.2, step: 10, gapChance: 0.045 });
  buildTrees(scene, 906, 78200, 84800, 11, 38, 190, 45);
  buildTrees(scene, 907, 78200, 85500, 16, 150, 480, 130);
  roadsideScreen(scene, 9090, 78200, 85200, { step: 10 });
  // Philly skyline is a concentrated urban node, not a wall of towers all the
  // way to the bridge. Keep a short mid-rise cluster around the construction
  // corridor, then let lower sprawl and tree cover take over.
  skyline(scene, registry, 909, 85500, 87500, 30, 170, 680, 28, 92);
  // brick rowhouse carpet right along the interstate
  const brick = [0x8a5a44, 0x9c6b50, 0xa87b5c, 0x7a4f3e, 0xb08a68];
  const rows = placementsAlong(921, 83500, 90200, 15, 32, 130, (rand, pos, s) => ({
    pos, rot: headingAt(s),
    sx: 9 + rand() * 4, sy: 8 + rand() * 6, sz: 10 + rand() * 4,
    color: new THREE.Color(brick[(rand() * brick.length) | 0]),
  }), 2);
  scatterInstanced(scene, boxGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }), rows);
  for (const s of [79800, 83000, 86200, 88900]) {
    gantry(scene, registry, s, [
      { lat: 0, mesh: textBoard(['I-95 SOUTH', 'CHESTER · WILMINGTON'], 14, 3.4, '#046a38', '#ffffff') },
    ], 6.8);
  }
  // Long, tight north-Philly construction run: a sustained rebuilt viaduct
  // continuous work area, with solid lines across every lane, barriers,
  // shifted lanes, and frequent bridge/utility crossings.
  const workBarrier = new THREE.MeshStandardMaterial({ color: 0x8b8e8b, roughness: 0.9 });
  const workLine = new THREE.MeshBasicMaterial({ color: 0xf0e4a5 });
  const laneLine = new THREE.MeshBasicMaterial({ color: 0xe7e5dc });
  for (const [a, b] of [[82900, 85000], [85000, 87200], [87200, 90000]]) {
    for (const side of [-1, 1]) {
      const lat = s => side * (pavedHalfAt(s) + 0.65);
      scene.add(new THREE.Mesh(buildRibbon(s => lat(s) - side * 0.22, s => lat(s) + side * 0.22, 0.9, 0.9, 10, a, b), workBarrier));
      const lineLat = s => side * (pavedHalfAt(s) - 0.15);
      scene.add(new THREE.Mesh(buildRibbon(s => lineLat(s) - side * 0.12, s => lineLat(s) + side * 0.12, 0.05, 0.05, 10, a, b), workLine));
      // Every lane boundary is continuous through the work area. Drivers are
      // not supposed to cross these, while the traffic model can still have
      // occasional NYC-style violations.
      const lanes = usableLanesAt(a);
      for (let lane = 1; lane < lanes; lane++) {
        const boundary = s => side * (MEDIAN_HALF + lane * LANE_WIDTH);
        scene.add(new THREE.Mesh(buildRibbon(
          s => boundary(s) - side * 0.1, s => boundary(s) + side * 0.1,
          0.07, 0.07, 10, a, b
        ), laneLine));
      }
    }
  }
  [83200, 84500, 85900, 87400, 88900, 89800].forEach((s, i) => minorOverpass(scene, s, 140 + i));
  for (const s of [82900, 85000, 87300, 89400]) {
    gantry(scene, registry, s, [
      { lat: 0, mesh: textBoard(['ROAD WORK AHEAD', 'I-95 RECONSTRUCTION', '45 MPH · KEEP LANES'], 14, 3.4, '#155c38', '#ffffff') },
    ], 7);
  }
  // Low brown brick, repair yards and old industrial roofs are the dominant
  // Northeast Philly texture around the work zone; trees occupy the gaps and
  // the outer neighborhood screen instead of giving way to empty grass.
  const gritty = placementsAlong(927, 82400, 91000, 17, 48, 250, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.18,
    sx: 13 + rand() * 28, sy: 5 + rand() * 14, sz: 12 + rand() * 30,
    color: new THREE.Color([0x765548, 0x875f4d, 0x684c42, 0x8a705d, 0x655c53][(rand() * 5) | 0]),
  }), 3);
  scatterInstanced(scene, boxGeo, lowLitMaterial(registry), gritty);
  buildTrees(scene, 928, 82000, 91200, 13, 90, 360, 75);
  buildTrees(scene, 929, 83000, 90400, 18, 360, 720, 110);
  // Northbound-facing NJ dispensary board: right shoulder for dir=-1, set well
  // back from the road so it reads as a real roadside ad instead of clipping.
  const weedBoard = textBoard(['WEED IS LEGAL IN NJ', 'DISPENSARY · NEXT EXIT'], 12, 3.5, '#235331', '#f4d35e');
  const weedPole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0x52575a, roughness: 0.65 }));
  const weedGroup = new THREE.Group();
  weedBoard.position.y = 10.5; weedPole.position.y = 5.1; weedGroup.add(weedBoard, weedPole);
  weedGroup.position.copy(posAt(80050, 132, new THREE.Vector3()));
  weedGroup.position.y = groundY(80050, 132); weedGroup.rotation.y = headingAt(80050) + Math.PI;
  scene.add(weedGroup); registry.signs.push({ userData: { board: weedBoard } });
  buildAirport(scene, registry, 91400, -1, 'PHL · PHILA INTL');
  buildBillboards(scene, registry, 931, 78800, 93000, 20);
  // Philadelphia doesn't end at the first row of rowhouses — miles of dense
  // rowhouse city recede behind it on both sides
  deepSprawl(scene, 8803, 78300, 91000, { density: 1.45, litMat: lowLitMaterial(registry) });
  // I-95's airport/industrial edge is built-up, but still has planted buffers
  // and sound walls instead of the open lawn that used to show through here.
  buildSuburb(scene, registry, 87600, 91600, { wall: true });

  // southern PA: I-95 tails out through leafy suburbs and woods
  const houses = placementsAlong(941, 89800, 92400, 30, 90, 320, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2),
    sx: 9 + rand() * 5, sy: 3.6 + rand() * 2.6, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, boxGeo, lowLitMaterial(registry), houses);
  buildTrees(scene, 942, 91200, 95800, 22, 55, 380, 150);
  buildTrees(scene, 943, 88900, 96200, 26, 380, 900, 150);
  buildTrees(scene, 944, 89800, 96200, 11, 38, 110, 0);  // wooded PA median-to-treeline look
  roadsideScreen(scene, 945, 91600, 96200, { step: 12 });
  // Delaware-line suburbs: low development filling the mid-distance
  deepSprawl(scene, 8804, 89800, 96200, { towers: false, density: 0.7 });
  gantry(scene, registry, 93600, [
    { lat: 0, mesh: textBoard(['WILMINGTON · BALTIMORE', 'I-95 SOUTH'], 14, 3.4, '#046a38', '#ffffff') },
  ], 6.8);
  buildBillboards(scene, registry, 932, 91400, 95400, 6);
}

export function buildI95(scene, registry) {
  // shared lit-window facade material (skylines + spires)
  const tex = facadeTexture(7);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.7, color: 0xffffff,
  });
  registry.towerMats = [towerMat];

  buildNewHaven(scene, registry);
  // The Northeast megalopolis is continuous development: one unbroken sprawl
  // belt behind the foreground dressing from New Haven to the Bronx, so the
  // view never opens onto empty grass (stops before the Hudson).
  deepSprawl(scene, 8801, 300, 43300, { towers: false });
  // New Haven's northern branch points toward the New England continuation;
  // Hartford is intentionally not part of this I-95 route presentation.
  gantry(scene, registry, 1400, [
    { lat: 0, mesh: textBoard(['EXIT 48 · I-91 NORTH', 'NEW ENGLAND · BOSTON'], 15, 3.4, '#046a38', '#ffffff') },
  ], 7);
  buildCorridor(scene, registry);
  buildWestchester(scene, registry);
  buildBronx(scene, registry);

  // George Washington Bridge over the Hudson — double-decked
  gantry(scene, registry, 43350, [
    { lat: 0, mesh: textBoard(['GEO WASHINGTON BR', 'NJ TURNPIKE · I-95 SOUTH'], 18, 3.6, '#046a38', '#ffffff') },
  ], 7);
  suspensionBridge(scene, 43620, 44380, 43850, 44150, 52);
  water(scene, 44000, 540, 3600);
  buildGwbCrossingContext(scene, registry);
  buildGwbLowerDeck(scene, registry);
  // deck choice right at each bridge mouth: inner (left) lanes ride the upper
  // level, outer (right) lanes drop to the lower level — both directions
  const dHalf = MEDIAN_HALF + LANE_WIDTH * 1.5;
  const dOut = MEDIAN_HALF + LANE_WIDTH * 3.4;
  gantry(scene, registry, 43540, [   // southbound entrance
    { lat: -dHalf, mesh: textBoard(['UPPER LEVEL', 'LEFT LANES'], 8.5, 3.0, '#046a38', '#ffffff') },
    { lat: -dOut, mesh: textBoard(['LOWER LEVEL', 'RIGHT LANES'], 8.5, 3.0, '#3d1d63', '#ffffff') },
  ], 7);
  gantry(scene, registry, 44460, [   // northbound entrance
    { lat: dHalf, mesh: textBoard(['UPPER LEVEL', 'LEFT LANES'], 8.5, 3.0, '#046a38', '#ffffff') },
    { lat: dOut, mesh: textBoard(['LOWER LEVEL', 'RIGHT LANES'], 8.5, 3.0, '#3d1d63', '#ffffff') },
  ], 7);

  // Fort Lee, just off the NJ end of the GWB: I-80 West splits off here toward
  // Paterson, the Water Gap and on to Chicago. (I-80 itself is the i80 map.)
  gantry(scene, registry, 45300, [
    { lat: 0, mesh: textBoard(['EXIT 72 · I-80 WEST', 'PATERSON · CHICAGO'], 15, 3.4, '#046a38', '#ffffff') },
  ], 7);

  // Edison / Metuchen: NJ Turnpike Exit 10 for I-287 north (Metuchen,
  // Bridgewater, Morristown). (I-287 is its own map.)
  gantry(scene, registry, 60600, [
    { lat: 0, mesh: textBoard(['EXIT 10 · I-287 NORTH', 'METUCHEN · MORRISTOWN'], 15, 3.4, '#046a38', '#ffffff') },
  ], 7);

  buildTurnpikeI95(scene, registry);
  buildCarteretFactories(scene, registry);
  buildPhilly(scene, registry);

  // state-line welcome signs, both bounds
  welcomeSign(scene, registry, 31550, 1, ['WELCOME TO NEW YORK', 'THE EMPIRE STATE', 'GOV. KATHY HOCHUL']);
  welcomeSign(scene, registry, 31450, -1, ['WELCOME TO CONNECTICUT', 'FULL OF SURPRISES', 'GOV. NED LAMONT']);
  welcomeSign(scene, registry, 44430, 1, ['WELCOME TO NEW JERSEY', 'THE GARDEN STATE', 'GOV. MIKIE SHERRILL'], '#046a38');
  welcomeSign(scene, registry, 43560, -1, ['WELCOME TO NEW YORK', 'THE EMPIRE STATE', 'GOV. KATHY HOCHUL']);
  welcomeSign(scene, registry, 78230, 1, ['PENNSYLVANIA', 'WELCOMES YOU', 'GOV. JOSH SHAPIRO']);
  welcomeSign(scene, registry, 76880, -1, ['WELCOME TO NEW JERSEY', 'THE GARDEN STATE', 'GOV. MIKIE SHERRILL'], '#046a38');

  // --- roadside furniture to match the i80 standard: control-city mileage
  // boards (several cities per sign), amber-on-black VMS that glow at night,
  // adopt-a-highway (green) and traveler-radio (blue) signs. Sprinkled, not
  // spammy — heaviest through the Northeast where the driving is.
  const mileBGS = (s, lines) => gantry(scene, registry, s,
    [{ lat: 0, mesh: textBoard(lines, 15, 3.8, '#046a38', '#ffffff') }], 7);
  const vms = (s, lines) => {
    const a = textBoard(lines, 6.4, 3.0, '#0b0b0d', '#f2a100');
    const b = textBoard(lines, 6.4, 3.0, '#0b0b0d', '#f2a100'); b.rotation.y = Math.PI;
    gantry(scene, registry, s, [{ lat: -5.5, mesh: a }, { lat: 5.5, mesh: b }], 7);
    registry.signs.push({ userData: { board: a } }, { userData: { board: b } });
  };
  // control-city mileage — real I-95 control cities, real-world miles
  mileBGS(12000, ['STAMFORD   18', 'NEW YORK   42']);
  mileBGS(55000, ['NEW BRUNSWICK   10', 'TRENTON   30', 'PHILADELPHIA   55']);
  mileBGS(72000, ['PHILADELPHIA   8', 'WILMINGTON   35', 'BALTIMORE   105']);
  mileBGS(210000, ['BALTIMORE   12', 'WASHINGTON   50']);
  mileBGS(480000, ['RICHMOND   10', 'PETERSBURG   35', 'ROCKY MOUNT NC   120']);
  mileBGS(1392000, ['JACKSONVILLE   6', 'ORLANDO   140', 'MIAMI   345']);
  // variable message signs
  vms(20000, ['DELAYS AHEAD', 'EXPECT STOP+GO']);
  vms(58000, ['NJ TPK', 'BUCKLE UP']);
  vms(215000, ['511 · TRAVEL INFO', 'CHECK CONDITIONS']);
  vms(1400000, ['WATCH FOR', 'STOPPED TRAFFIC']);
  // adopt-a-highway (green) + traveler radio (blue)
  attractionSign(scene, registry, 15000, 1, ['ADOPT A HIGHWAY', 'NEXT 2 MILES', 'LIONS CLUB'], '#0b6b3a', '#ffffff', 7, 4.2);
  attractionSign(scene, registry, 66000, -1, ['ADOPT A HIGHWAY', 'LITTER CREW', 'VFW POST 7'], '#0b6b3a', '#ffffff', 7, 4.2);
  attractionSign(scene, registry, 470000, 1, ['ADOPT A HIGHWAY', 'NEXT 2 MILES', 'ROTARY CLUB'], '#0b6b3a', '#ffffff', 7, 4.2);
  attractionSign(scene, registry, 25000, 1, ['TRAVELER INFO', 'TUNE 1610 AM'], '#12356f', '#ffffff', 6.4, 3.6);
  attractionSign(scene, registry, 80000, -1, ['HIGHWAY ADVISORY', 'RADIO 1640 AM'], '#12356f', '#ffffff', 6.4, 3.6);
  attractionSign(scene, registry, 500000, 1, ['TRAVELER INFO', 'TUNE 1610 AM'], '#12356f', '#ffffff', 6.4, 3.6);

  buildSouth(scene, registry);
  buildI95NorthCorridorEnhancements(scene, registry);
  buildNortheastExt(scene, registry);
  buildMinorOverpasses(scene);
}

// ---------------------------------------------------------------------------
// DE → FL true-scale run: Wilmington DE line to Miami. s = 96000 + real
// cumulative mileage × 1609, exit number = the real state mile marker (each
// state resets to its own max at the line shared with the state to the
// north, decreasing southbound — same convention as the existing CT/NY/NJ/PA
// exits above). forestFill() already blankets this whole stretch with trees
// from main.js, so everything below is flavor on top of that baseline:
// state lines, metro skylines/sprawl, and the major river crossings.
// ---------------------------------------------------------------------------
function buildDelaware(scene, registry) {
  // Newark/New Castle: Philly exurbs continuing south, walled off like the
  // Turnpike; Wilmington gets DE's one real (modest) skyline.
  buildSuburb(scene, registry, 97000, 109000, { wall: true });
  skyline(scene, registry, 8831, 106000, 118500, 42, 260, 650, 16, 42, [-1]);
  deepSprawl(scene, 8832, 106000, 122000, { density: 0.5, latStart: 260 });
  buildSuburb(scene, registry, 122000, 130000, { wall: true });
  // Delaware's short I-95 run is continuously enclosed by suburban woods or
  // sound walls; leave no exposed lawn between the PA line and Maryland.
  buildNoiseWall(scene, 97000, 130000, { seed: 8830, height: 5.1, margin: 4.2, step: 12, gapChance: 0.1 });
  roadsideScreen(scene, 8836, 96000, 130000, { step: 11 });
  [104500, 116500, 126000].forEach((s, i) => minorOverpass(scene, s, 180 + i));
  gantry(scene, registry, 130800, [
    { lat: 0, mesh: textBoard(['NEWARK TOLL PLAZA', 'E-ZPass · CASH'], 14, 3.2, '#3d1d63', '#ffffff') },
  ], 7);
  buildTollPlaza(scene, registry, 132800);
  welcomeSign(scene, registry, 96500, -1, ['WELCOME TO DELAWARE', 'THE FIRST STATE'], '#046a38');
  welcomeSign(scene, registry, 133600, 1, ['WELCOME TO MARYLAND', 'GOV. WES MOORE'], '#12264a');
  welcomeSign(scene, registry, 133800, -1, ['WELCOME TO DELAWARE', 'THE FIRST STATE'], '#046a38');
}

function buildFortMcHenryTunnel(scene, registry) {
  const s0 = 221700, s1 = 224700;
  const tile = new THREE.MeshStandardMaterial({ color: 0xd3d0c5, roughness: 0.82, side: THREE.DoubleSide });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x777d7e, roughness: 0.9, side: THREE.DoubleSide });
  const curb = new THREE.MeshStandardMaterial({ color: 0xaaa99f, roughness: 0.92, side: THREE.DoubleSide });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe7b0 });

  // Two physically separate, fully covered two-lane bores. The wall and roof
  // meshes follow road curvature/elevation, preventing terrain, sky or harbor
  // water from appearing through the tunnel at any point.
  for (const side of [-1, 1]) {
    const inner = s => side * (MEDIAN_HALF + 0.25);
    const outer = s => side * (pavedHalfAt(s) + 0.15);
    scene.add(new THREE.Mesh(buildRibbon(inner, outer, 6.3, 6.3, 7, s0, s1), roofMat));
    scene.add(new THREE.Mesh(buildRibbon(inner, inner, 0.05, 6.3, 7, s0, s1), tile));
    scene.add(new THREE.Mesh(buildRibbon(outer, outer, 0.05, 6.3, 7, s0, s1), tile));
    scene.add(new THREE.Mesh(buildRibbon(
      s => outer(s) - side * 0.55, outer, 0.12, 0.12, 7, s0, s1), curb));

    const center = s => side * (MEDIAN_HALF + (pavedHalfAt(s) - MEDIAN_HALF) * 0.52);
    for (let s = s0 + 20; s < s1 - 15; s += 38) {
      const p = posAt(s, center(s), new THREE.Vector3());
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.45), lightMat);
      lamp.position.set(p.x, p.y + 6.05, p.z);
      lamp.rotation.y = headingAt(s); scene.add(lamp);
    }
  }

  const portalMat = new THREE.MeshStandardMaterial({ color: 0x686e70, roughness: 0.88 });
  for (const s of [s0, s1]) {
    const half = pavedHalfAt(s) + 1;
    const portal = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.5, 2.5), portalMat);
    const p = posAt(s, 0, new THREE.Vector3());
    portal.position.set(p.x, p.y + 6.2, p.z); portal.rotation.y = headingAt(s); scene.add(portal);
  }
  gantry(scene, registry, 220900, [
    { lat: 0, mesh: textBoard(['FORT McHENRY TUNNEL', 'E-ZPass · VIDEO TOLL'], 15, 3.3, '#3d1d63', '#ffffff') },
  ], 7);
}

function buildMaryland(scene, registry) {
  // Susquehanna River at the Cecil/Harford county line (Perryville ⇄ Havre de Grace)
  bridgeStructure(scene, 158200, 160800, [159500]);
  water(scene, 159500, 1700, 2600);
  buildTollPlaza(scene, registry, 159400);   // JFK Hwy toll (Perryville)
  buildTrees(scene, 8833, 133700, 158000, 20, 60, 320, 90);
  buildTrees(scene, 8834, 160800, 201300, 22, 60, 340, 80);
  roadsideScreen(scene, 8837, 133700, 158000, { step: 11 });
  roadsideScreen(scene, 8839, 160800, 201300, { step: 11 });
  buildBillboards(scene, registry, 8835, 161000, 199500, 14);
  restArea(scene, registry, 177300, 1, 'MARYLAND HOUSE');           // the real I-95 travel plaza

  // Baltimore's downtown is west of I-95: on the driver's right southbound
  // and left northbound. It appears as one short distant cluster, surrounded
  // by low brick/industrial sprawl rather than lining miles of freeway.
  skyline(scene, registry, 8840, 211500, 217000, 34, 260, 720, 28, 105, [-1]);
  deepSprawl(scene, 8841, 201300, 233500, { density: 1.15, towers: false, latStart: 150, litMat: lowLitMaterial(registry) });
  buildSuburb(scene, registry, 201300, 220500, { wall: true });
  buildSuburb(scene, registry, 225000, 233500, { wall: true });
  buildRaisedApproach(scene, 204000, 211500);
  buildRaisedApproach(scene, 213000, 220500);
  buildRaisedApproach(scene, 225000, 231500);
  port(scene, 8846, 216000, 227000);
  buildTrees(scene, 8847, 201300, 220500, 16, 75, 360, 85);
  buildTrees(scene, 8848, 225000, 233500, 17, 70, 340, 80);
  buildNoiseWall(scene, 201300, 220500, { seed: 8849, height: 5.4, margin: 4.0, step: 12, gapChance: 0.18 });
  buildNoiseWall(scene, 225000, 233500, { seed: 8850, height: 5.4, margin: 4.0, step: 12, gapChance: 0.16 });
  [203800, 208000, 212000, 216500, 220300, 225300, 228000, 231000].forEach((s, i) => minorOverpass(scene, s, 230 + i));
  buildFortMcHenryTunnel(scene, registry);

  // Elkridge/Laurel exurbs, then the Capital Beltway co-signage down to VA —
  // continuous DC-suburb sprawl (I-95 mainline never actually enters downtown
  // DC; that stub became I-395)
  buildSuburb(scene, registry, 233500, 252800, { wall: true });
  deepSprawl(scene, 8842, 233500, 309100, { density: 1.3, towers: false, litMat: lowLitMaterial(registry) });
  buildSuburb(scene, registry, 252800, 307800, { wall: true });
  roadsideScreen(scene, 8843, 233500, 265000, { step: 10 });
  buildNoiseWall(scene, 233500, 307800, { seed: 8844, height: 5.2, margin: 4.2, step: 13, gapChance: 0.11 });
  roadsideScreen(scene, 8845, 265000, 309000, { step: 9 });
  // Short real-path elevated nodes: US-50/New Carrollton, Suitland/Andrews,
  // then the denser I-295/MD-210/National Harbor bridge approaches.
  viaductPiers(scene, 270800, 274200);
  viaductPiers(scene, 287300, 290500);
  viaductPiers(scene, 299600, 305200);
  for (const [s, seed] of [[257500, 301], [264200, 302], [272500, 303], [279300, 304],
    [287900, 305], [293200, 306], [299900, 307], [303400, 308], [305400, 309]]) {
    minorOverpass(scene, s, seed);
  }
  gantry(scene, registry, 266500, [
    { lat: 0, mesh: textBoard(['I-495 · CAPITAL BELTWAY', 'WASHINGTON DC'], 15, 3.4, '#046a38', '#ffffff') },
  ], 7);
  welcomeSign(scene, registry, 309000, -1, ['WELCOME TO VIRGINIA', 'VIRGINIA IS FOR LOVERS'], '#0d3b28');
  welcomeSign(scene, registry, 309200, 1, ['WELCOME TO MARYLAND', 'GOV. WES MOORE'], '#12264a');
}

// Northern Virginia 95 Express Lanes: the barrier-separated express (inner) /
// local (outer) split through NoVA. The lane geometry + traffic behaviour ride
// the shared dual-dual machinery (road.js njGapAt/njDualDualAt over this span);
// this draws the concrete divider, edge stripes, and the E-ZPass express
// signage — mirrors the NJ Turnpike dual-dual treatment.
function buildVaExpress(scene, registry) {
  const S0 = 312000, S1 = 324000;
  const bMat = new THREE.MeshStandardMaterial({ color: 0x9b9b93, roughness: 0.85, side: THREE.DoubleSide });
  const wMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  for (const side of [-1, 1]) {
    const center = s => side * (MEDIAN_HALF + 3 * LANE_WIDTH + njGapAt(s) / 2);
    scene.add(new THREE.Mesh(buildRibbon(s => center(s) - 0.35, s => center(s) + 0.35, 0.8, 0.8, 12, S0, S1), bMat));
    scene.add(new THREE.Mesh(buildRibbon(s => center(s) - 0.5, s => center(s) - 0.35, 0, 0.8, 12, S0, S1), bMat));
    scene.add(new THREE.Mesh(buildRibbon(s => center(s) + 0.35, s => center(s) + 0.5, 0, 0.8, 12, S0, S1), bMat));
    const eIn = s => side * (MEDIAN_HALF + 3 * LANE_WIDTH + 0.15);
    const eOut = s => side * (MEDIAN_HALF + 3 * LANE_WIDTH + njGapAt(s) - 0.15);
    scene.add(new THREE.Mesh(buildRibbon(s => eIn(s) - 0.08, s => eIn(s) + 0.08, 0.03, 0.03, 10, S0, S1), wMat));
    scene.add(new THREE.Mesh(buildRibbon(s => eOut(s) - 0.08, s => eOut(s) + 0.08, 0.03, 0.03, 10, S0, S1), wMat));
  }
  const innerLat = MEDIAN_HALF + LANE_WIDTH * 1.5;
  const outerLat = MEDIAN_HALF + LANE_WIDTH * 4.5 + 6;
  // split guidance (southbound sees the choice first at the north end)
  gantry(scene, registry, 322800, [
    { lat: -innerLat, mesh: textBoard(['95 EXPRESS LANES', 'E-ZPass ONLY'], 11, 3.2, '#3d1d63', '#ffffff') },
    { lat: -outerLat, mesh: textBoard(['LOCAL LANES', 'ALL TRAFFIC'], 10, 3.2, '#046a38', '#ffffff') },
    { lat: innerLat, mesh: textBoard(['95 EXPRESS · MERGE', 'LANES END'], 11, 3.2, '#3d1d63', '#ffffff') },
  ], 6.9);
  // dynamic-price E-ZPass gantry mid-span (the hallmark of the 95 Express)
  gantry(scene, registry, 318000, [
    { lat: -innerLat, mesh: textBoard(['95 EXPRESS · E-ZPass', 'WASHINGTON  $7.25', 'MIN OCCUPANCY HOV-3'], 13, 3.4, '#3d1d63', '#ffffff') },
  ], 7);
  // northbound split at the south end
  gantry(scene, registry, 313200, [
    { lat: innerLat, mesh: textBoard(['95 EXPRESS LANES', 'E-ZPass ONLY'], 11, 3.2, '#3d1d63', '#ffffff') },
    { lat: outerLat, mesh: textBoard(['LOCAL LANES', 'ALL TRAFFIC'], 10, 3.2, '#046a38', '#ffffff') },
    { lat: -innerLat, mesh: textBoard(['95 EXPRESS · MERGE', 'LANES END'], 11, 3.2, '#3d1d63', '#ffffff') },
  ], 6.9);
}

function buildVirginia(scene, registry) {
  // Potomac River — Woodrow Wilson Bridge, the MD/VA line
  bridgeStructure(scene, 308000, 310200, [309100]);
  water(scene, 309100, 900, 2400);
  buildVaExpress(scene, registry);

  deepSprawl(scene, 8850, 309100, 330000, { density: 1.35, towers: false, litMat: lowLitMaterial(registry) });
  buildSuburb(scene, registry, 310200, 330000, { wall: true });
  roadsideScreen(scene, 8859, 310200, 330000, { step: 9 });
  viaductPiers(scene, 311200, 324500);
  for (const [s, seed] of [[312100, 320], [314000, 321], [316100, 322], [318300, 323],
    [320600, 324], [322800, 325], [325200, 326], [328000, 327]]) minorOverpass(scene, s, seed);
  buildSuburb(scene, registry, 330000, 358000, { wall: true });
  buildNoiseWall(scene, 310200, 358000, { seed: 8858, height: 5.4, margin: 4.2, step: 12, gapChance: 0.1 });
  buildTrees(scene, 8851, 358000, 393000, 20, 55, 320, 85);
  buildBillboards(scene, registry, 8852, 359000, 392000, 12);

  // Fredericksburg: small riverside downtown
  skyline(scene, registry, 8853, 388500, 396500, 40, 140, 320, 24, 65, [-1]);
  buildSuburb(scene, registry, 383000, 400000);

  buildTrees(scene, 8854, 400000, 461000, 22, 60, 340, 70);
  roadsideScreen(scene, 8856, 358000, 393000, { step: 13 });
  roadsideScreen(scene, 8857, 400000, 461000, { pine: true, step: 15 });
  buildBillboards(scene, registry, 8855, 401000, 460000, 16);
  restArea(scene, registry, 312000, -1, 'VIRGINIA WELCOME CENTER');   // just S of the Potomac, NB
  restArea(scene, registry, 430000, 1, 'CARMEL CHURCH REST AREA');
  // Historic Triangle / Kings Dominion — the real brown-and-blue VA I-95 signs
  attractionSign(scene, registry, 448000, 1, ['KINGS DOMINION', '3 MILES', 'EXIT 98'], '#0a3b8c', '#ffffff');
  attractionSign(scene, registry, 470000, 1, ['HISTORIC RICHMOND', 'VA STATE CAPITOL', 'EXIT 74C'], '#6b1f2b', '#ffffff');

  // James River, downtown Richmond
  bridgeStructure(scene, 478700, 482300, [480500]);
  water(scene, 480500, 1200, 2400);
  skyline(scene, registry, 8860, 469000, 490000, 48, 280, 700, 22, 75, [-1]);
  deepSprawl(scene, 8861, 461500, 490000, { density: 0.65, latStart: 280 });

  // Petersburg: smaller downtown south of Richmond
  skyline(scene, registry, 8862, 505000, 514000, 50, 260, 600, 18, 42, [-1]);
  buildSuburb(scene, registry, 488900, 522700, { wall: true });
  buildNoiseWall(scene, 461500, 478500, { seed: 8865, height: 5.0, margin: 4.4, step: 14, gapChance: 0.13 });
  buildNoiseWall(scene, 482500, 522700, { seed: 8867, height: 5.0, margin: 4.4, step: 14, gapChance: 0.13 });
  roadsideScreen(scene, 8868, 461500, 478500, { step: 9 });
  roadsideScreen(scene, 8877, 482500, 522700, { step: 9 });
  [463500, 491500, 512000].forEach((s, i) => minorOverpass(scene, s, 190 + i));

  // Southside VA: rural pine/farm country down to the NC line
  buildTrees(scene, 8863, 522700, 596700, 24, 60, 360, 55);
  roadsideScreen(scene, 8866, 522700, 596700, { pine: true, step: 7 });
  buildBillboards(scene, registry, 8864, 524000, 595000, 14);

  welcomeSign(scene, registry, 596500, -1, ['WELCOME TO NORTH CAROLINA', 'FIRST IN FLIGHT'], '#a41e34');
  welcomeSign(scene, registry, 596900, 1, ['WELCOME TO VIRGINIA', 'VIRGINIA IS FOR LOVERS'], '#0d3b28');
}

function buildCarolinas(scene, registry) {
  // Roanoke Rapids → Rocky Mount: rural coastal-plain pine flats
  buildTrees(scene, 8870, 596700, 666500, 26, 60, 380, 45);
  buildTrees(scene, 8871, 666500, 732400, 24, 60, 360, 55, true);
  roadsideScreen(scene, 8878, 596700, 816200, { pine: true, step: 8 });
  restArea(scene, registry, 600000, -1, 'NORTH CAROLINA WELCOME CTR'); // just S of the VA line, NB
  buildSuburb(scene, registry, 668000, 686000);           // Rocky Mount
  buildBillboards(scene, registry, 8872, 668000, 730000, 16);
  // The full state now reads as one continuous wooded corridor rather than
  // isolated tree clusters around the named cities.

  // Fayetteville / Fort Bragg
  skyline(scene, registry, 8873, 794000, 810000, 55, 260, 650, 16, 38, [-1]);
  deepSprawl(scene, 8874, 785000, 830000, { density: 0.5, towers: false, latStart: 260 });
  buildSuburb(scene, registry, 785000, 830000, { wall: true });
  buildNoiseWall(scene, 785000, 816000, { seed: 8873, height: 5.2, margin: 4.4, step: 12, gapChance: 0.1 });
  buildNoiseWall(scene, 819000, 830000, { seed: 8874, height: 5.2, margin: 4.4, step: 12, gapChance: 0.1 });
  [790500, 807000, 824000].forEach((s, i) => minorOverpass(scene, s, 200 + i));
  // Cape Fear River, south of Fayetteville
  bridgeStructure(scene, 816200, 818800, [817500]);
  water(scene, 817500, 800, 2000);

  buildTrees(scene, 8875, 830000, 888500, 26, 60, 380, 50, true);
  roadsideScreen(scene, 8889, 818800, 888500, { pine: true, step: 8 });
  buildBillboards(scene, registry, 8876, 832000, 886000, 14);
  welcomeSign(scene, registry, 888300, -1, ['WELCOME TO SOUTH CAROLINA', 'SMILING FACES · BEAUTIFUL PLACES'], '#003876');
  welcomeSign(scene, registry, 888700, 1, ['WELCOME TO NORTH CAROLINA', 'FIRST IN FLIGHT'], '#a41e34');

  // === SOUTH OF THE BORDER — the definitive I-95 attraction, at the NC/SC line
  // (Hamer SC). The giant sombrero tower, and Pedro's famous countdown
  // billboards marching for a hundred-plus miles at travellers both ways.
  sombreroTower(scene, 888450, -1);
  const sob = '#d94f2a';
  // southbound drivers (dir>0) get the NC-side countdown
  attractionSign(scene, registry, 700000, 1, ['SOUTH OF THE BORDER', 'PEDRO SEZ:', '188 MILES'], sob, '#ffffff');
  attractionSign(scene, registry, 780000, 1, ['YOU NEVER SAUSAGE', 'A PLACE!', 'SOUTH OF THE BORDER'], sob, '#ffffff');
  attractionSign(scene, registry, 840000, 1, ['PEDRO\'S WEATHER:', 'CHILI TODAY,', 'HOT TAMALE!'], sob, '#ffffff');
  attractionSign(scene, registry, 875000, 1, ['KEEP YELLING, KIDS!', '(THEY\'LL STOP)', 'SOUTH OF THE BORDER'], sob, '#ffffff');
  attractionSign(scene, registry, 886500, 1, ['SOUTH OF THE BORDER', 'EXIT 1 · NEXT RIGHT', 'YOU\'RE A WIENER!'], sob, '#ffffff');
  // northbound drivers (dir<0) get the SC-side countdown
  attractionSign(scene, registry, 1000000, -1, ['SOUTH OF THE BORDER', 'PEDRO SEZ:', '70 MILES'], sob, '#ffffff');
  attractionSign(scene, registry, 940000, -1, ['TOO MUCH TEQUILA?', 'PEDRO FEEX', 'FLAT TIRE!'], sob, '#ffffff');
  attractionSign(scene, registry, 895000, -1, ['SOUTH OF THE BORDER', 'FIREWORKS · TACOS', 'EXIT 1'], sob, '#ffffff');
  // SC/GA line fireworks stands are an I-95 institution both ways
  attractionSign(scene, registry, 1150000, 1, ['★ FIREWORKS ★', 'BUY 1 GET 5 FREE', 'NEXT EXIT'], '#b3202c', '#ffffff', 10, 4.6);

  // Dillon → Florence: rural, sandhills pine
  buildTrees(scene, 8880, 888500, 913000, 24, 60, 360, 55, true);
  roadsideScreen(scene, 8891, 888500, 913000, { pine: true, step: 15 });
  // Great Pee Dee River near Latta
  bridgeStructure(scene, 913400, 916100, [914700]);
  water(scene, 914700, 700, 1700);
  buildTrees(scene, 8881, 916100, 950900, 24, 60, 360, 55, true);
  roadsideScreen(scene, 8892, 916100, 950900, { pine: true, step: 15 });
  buildBillboards(scene, registry, 8882, 890000, 949000, 14);

  // Florence: I-20/I-95 junction town, modest downtown
  skyline(scene, registry, 8883, 948000, 964000, 44, 130, 320, 22, 60, [-1]);
  buildSuburb(scene, registry, 940000, 968000);
  buildTrees(scene, 8884, 968000, 1044300, 26, 60, 380, 50, true);
  buildBillboards(scene, registry, 8885, 970000, 1042000, 12);

  // Santee / Lake Marion — I-95 crosses the lake on a long low causeway
  bridgeStructure(scene, 1046200, 1049700, [1047400, 1048600]);
  water(scene, 1048000, 2200, 3200);
  buildTrees(scene, 8886, 1049700, 1123100, 26, 60, 380, 50, true);
  buildBillboards(scene, registry, 8887, 1051000, 1121000, 12);

  // Low Country: Walterboro, sandy pine flatwoods down to the Savannah River
  buildSuburb(scene, registry, 1125000, 1145000);
  buildTrees(scene, 8888, 1145000, 1208400, 24, 60, 380, 55, true);
  buildBillboards(scene, registry, 8889, 1147000, 1206000, 12);
}

function buildGeorgia(scene, registry) {
  // Savannah River, the GA/SC line
  bridgeStructure(scene, 1206900, 1209800, [1208350]);
  water(scene, 1208350, 1000, 2200);
  welcomeSign(scene, registry, 1208200, -1, ['WELCOME TO GEORGIA', 'PEACH STATE'], '#004b23');
  welcomeSign(scene, registry, 1208600, 1, ['WELCOME TO SOUTH CAROLINA', 'SMILING FACES · BEAUTIFUL PLACES'], '#003876');

  buildTrees(scene, 8890, 1208400, 1266400, 26, 60, 380, 55, true);
  buildBillboards(scene, registry, 8891, 1210000, 1264000, 12);
  restArea(scene, registry, 1215000, 1, 'GEORGIA WELCOME CENTER');   // just past the river, SB
  // roadside-South staples: pecans and peaches
  attractionSign(scene, registry, 1250000, 1, ['★ GEORGIA PECANS ★', 'BOILED P-NUTS', 'PEACHES · NEXT EXIT'], '#7a4a1f', '#ffffff');

  // Savannah: historic riverfront skyline seen from I-95, port cranes at Garden City
  skyline(scene, registry, 8892, 1300000, 1330000, 40, 130, 340, 26, 100, [-1]);
  deepSprawl(scene, 8893, 1266400, 1342000, { density: 0.65 });
  port(scene, 8894, 1290000, 1305000);
  buildSuburb(scene, registry, 1266400, 1300000, { wall: true });
  attractionSign(scene, registry, 1237000, 1, ['HISTORIC SAVANNAH', 'RIVER STREET', 'EXIT 99 · I-16'], '#0d3b28', '#ffffff');
  attractionSign(scene, registry, 1310000, -1, ['HISTORIC SAVANNAH', 'FORSYTH PARK', 'SR-204 · EXIT 94'], '#0d3b28', '#ffffff');

  // Kingsland/St. Marys: quiet pine flats down to the FL line
  buildTrees(scene, 8895, 1342000, 1388700, 26, 60, 380, 55, true);
  buildBillboards(scene, registry, 8896, 1344000, 1386000, 10);
  welcomeSign(scene, registry, 1388500, -1, ['WELCOME TO FLORIDA', 'THE SUNSHINE STATE'], '#ff8c00');
  welcomeSign(scene, registry, 1388900, 1, ['WELCOME TO GEORGIA', 'PEACH STATE'], '#004b23');
}

// Palms lining a stretch — the iconic South-Florida I-95 look: tall bare
// trunks with a spiky frond burst on top, planted in the median and just off
// the shoulder. Two instanced meshes (trunk + fronds), cheap at any count.
function buildPalms(scene, s0, s1, { step = 26, median = true } = {}) {
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 1, 6);
  trunkGeo.translate(0, 0.5, 0);   // grows up from the base
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1 });
  // frond crown: a shallow many-sided cone reads as a palm's radial burst
  const frondGeo = new THREE.ConeGeometry(1, 0.9, 7);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f6f36, roughness: 1 });
  frondMat.userData.summer = new THREE.Color(0x3f6f36);
  frondMat.userData.winter = new THREE.Color(0x4a6b3a);  // palms stay green
  foliageMats.push(frondMat);

  const trunks = placementsAlong(9930 + ((s0 | 0) % 701), s0, s1, step, 20, 120, (rand, pos, s) => {
    const h = 6.5 + rand() * 6;
    return { pos, rot: rand() * TAU, sx: 1, sy: h, sz: 1, _h: h };
  });
  // median row: straight down the center strip, evenly spaced
  const medPlaces = [];
  if (median) {
    const rand = rng(9931 + ((s0 | 0) % 503));
    for (let s = s0; s < s1; s += step * 1.5) {
      const h = 7 + rand() * 5;
      const pos = posAt(s, 0, new THREE.Vector3());
      pos.y = groundY(s, 0);
      medPlaces.push({ pos, rot: rand() * TAU, sx: 1, sy: h, sz: 1, _h: h });
    }
  }
  const all = trunks.concat(medPlaces);
  scatterInstanced(scene, trunkGeo, trunkMat, all, { shadow: false });
  // fronds sit on top of each trunk
  scatterInstanced(scene, frondGeo, frondMat, all.map(p => ({
    pos: p.pos.clone().setY(p.pos.y + p._h),
    rot: p.rot, sx: 3.2, sy: 2.0, sz: 3.2,
  })), { shadow: false });
}

// A big fixed-copy roadside billboard (named attractions / rest-area guidance —
// NOT the random ad belt). On tall twin poles, on the right shoulder of the
// direction `dir` it serves, facing up-traffic so that bound's drivers read it.
// Same facing convention as welcomeSign so nothing ends up mirrored/backwards.
function attractionSign(scene, registry, s, dir, lines, bg = '#0a3b8c', fg = '#ffffff', w = 12, h = 5.4) {
  const board = textBoard(lines, w, h, bg, fg);
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b4f54, roughness: 0.6 });
  const poleH = 11;
  for (const px of [-w * 0.32, w * 0.32]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, poleH, 8), poleMat);
    pole.position.set(px, poleH / 2, 0); g.add(pole);
  }
  board.position.y = poleH + h / 2;
  g.add(board);
  const side = dir > 0 ? -1 : 1;                     // right shoulder of `dir`
  const lat = side * (roadClearAt(s) + 11);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  g.rotation.y = headingAt(s) + (dir > 0 ? Math.PI : 0);
  scene.add(g);
  registry.signs.push({ userData: { board } });
}

// A real interstate rest area / welcome center: green advance guide signs, then
// a set-back facility — lot, low building with a pitched roof, parked cars and
// a row of overnight semis. Served for one direction (right shoulder).
function restArea(scene, registry, s, dir, name) {
  const side = dir > 0 ? -1 : 1;
  attractionSign(scene, registry, s - dir * 1609, dir, ['REST AREA', '1 MILE'], '#0a5a2a', '#ffffff', 8, 3.6);
  attractionSign(scene, registry, s - dir * 260, dir, [name, 'NEXT RIGHT'], '#0a5a2a', '#ffffff', 9.5, 3.8);
  const g = new THREE.Group();
  // set the facility back off whatever the pavement width is here, so it never
  // clips the travel lanes on the wide (5-6 lane) metro cross-sections
  const facLat = side * (roadClearAt(s) + 30);
  const p = posAt(s, facLat, new THREE.Vector3());
  g.position.set(p.x, groundY(s, facLat), p.z);
  g.rotation.y = headingAt(s);
  const lot = new THREE.Mesh(new THREE.BoxGeometry(84, 0.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95 }));
  lot.position.y = 0.06; lot.receiveShadow = true; g.add(lot);
  const bldg = new THREE.Mesh(new THREE.BoxGeometry(24, 6, 13),
    new THREE.MeshStandardMaterial({ color: 0xd8cbb0, roughness: 0.85 }));
  bldg.position.set(0, 3, -15); bldg.castShadow = true; g.add(bldg);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(17, 3.4, 4),
    new THREE.MeshStandardMaterial({ color: 0x6a4a34, roughness: 0.9 }));
  roof.rotation.y = Math.PI / 4; roof.position.set(0, 7.7, -15); roof.scale.set(1, 1, 0.62); g.add(roof);
  const carCols = [0xffffff, 0x1b3f8f, 0x8c1c1c, 0x2a2e34, 0xb8bcc2, 0x2a6a3a];
  for (let i = 0; i < 9; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 4.6),
      new THREE.MeshStandardMaterial({ color: carCols[i % carCols.length], roughness: 0.5 }));
    car.position.set(-30 + i * 7, 0.9, 7); car.castShadow = true; g.add(car);
  }
  const trailerMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.8 });
  for (let i = 0; i < 4; i++) {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 13), trailerMat);
    tr.position.set(-30 + i * 10, 1.9, 19); tr.castShadow = true; g.add(tr);
  }
  scene.add(g);
}

// South of the Border's landmark: the ~60 m neon sombrero tower straddling the
// road at the NC/SC line — the single most iconic sight on all of I-95.
function sombreroTower(scene, s, side) {
  const g = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0xd94f2a, roughness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.8, 55, 10), legMat);
  pole.position.y = 27.5; g.add(pole);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 1.3, 22),
    new THREE.MeshStandardMaterial({ color: 0xf2c23d, roughness: 0.6 }));
  brim.position.y = 55.5; g.add(brim);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(7.5, 11, 22), legMat);
  hat.position.y = 61.5; g.add(hat);
  const lat = side * (roadClearAt(s) + 42);
  g.position.copy(posAt(s, lat, new THREE.Vector3()));
  g.position.y = groundY(s, lat);
  scene.add(g);
}

function buildFlorida(scene, registry) {
  // St. Johns River, downtown Jacksonville (Fuller Warren Bridge)
  bridgeStructure(scene, 1470200, 1474000, [1472100]);
  water(scene, 1472100, 1600, 2400);
  skyline(scene, registry, 8900, 1440000, 1490000, 26, 100, 340, 36, 170, [-1]);
  deepSprawl(scene, 8901, 1388700, 1500000, { density: 0.85 });
  buildSuburb(scene, registry, 1500000, 1560000, { wall: true });
  gantry(scene, registry, 1467000, [
    { lat: 0, mesh: textBoard(['I-10 WEST', 'TALLAHASSEE · NEW ORLEANS'], 14, 3.2, '#046a38', '#ffffff') },
  ], 7);
  buildTrees(scene, 8902, 1560000, 1585200, 22, 60, 340, 65, true);
  buildPalms(scene, 1388700, 1500000, { step: 40, median: false });   // Jax roadside palms
  restArea(scene, registry, 1520000, 1, 'FLORIDA WELCOME CENTER');    // just over the line, SB
  // St. Augustine — the nation's oldest city — and the classic FL tourist traps
  attractionSign(scene, registry, 1505000, 1, ['ST. AUGUSTINE', 'NATION\'S OLDEST CITY', 'EXIT 318'], '#7a1f2b', '#ffffff');
  attractionSign(scene, registry, 1540000, -1, ['ST. AUGUSTINE', 'HISTORIC DOWNTOWN', 'ALLIGATOR FARM'], '#7a1f2b', '#ffffff');

  // Daytona: speedway country
  skyline(scene, registry, 8903, 1660000, 1678000, 44, 130, 300, 22, 55, [-1]);
  buildSuburb(scene, registry, 1650000, 1680200);
  gantry(scene, registry, 1663000, [
    { lat: 0, mesh: textBoard(['DAYTONA INTL SPEEDWAY', 'NEXT EXIT'], 13, 3.2, '#046a38', '#ffffff') },
  ], 7);
  buildTrees(scene, 8904, 1585200, 1660000, 24, 60, 360, 55, true);
  buildBillboards(scene, registry, 8905, 1587000, 1658000, 14);

  // Space Coast: palmetto scrub, Kennedy Space Center nod near Titusville
  buildTrees(scene, 8906, 1680200, 1767100, 24, 60, 360, 55, true);
  buildPalms(scene, 1680200, 1767100, { step: 45, median: false });   // scattered cabbage palms
  buildBillboards(scene, registry, 8907, 1682000, 1720000, 10);
  gantry(scene, registry, 1696000, [
    { lat: 0, mesh: textBoard(['KENNEDY SPACE CENTER', 'SR-405 · TITUSVILLE'], 14, 3.2, '#046a38', '#ffffff') },
  ], 7);
  // Ron Jon Surf Shop — the Cocoa Beach billboards are a Space-Coast I-95 icon
  attractionSign(scene, registry, 1670000, 1, ['RON JON SURF SHOP', 'COCOA BEACH', '1 MILE OF SURF'], '#f2a900', '#1b3f8f');
  attractionSign(scene, registry, 1700000, -1, ['RON JON SURF SHOP', 'OPEN 24 HOURS', 'SR-520 · COCOA BEACH'], '#f2a900', '#1b3f8f');
  buildSuburb(scene, registry, 1720000, 1745000);

  // Fort Pierce / Port St. Lucie / Stuart: barrier-island suburb belt starts
  buildSuburb(scene, registry, 1780000, 1841100, { wall: true });
  deepSprawl(scene, 8908, 1767100, 1841100, { density: 0.6, towers: false });
  buildTrees(scene, 8909, 1767100, 1780000, 22, 60, 340, 55, true);
  buildPalms(scene, 1780000, 1841100, { step: 32 });

  // Stuart/Jupiter → West Palm Beach: the sprawl never really stops from here to Miami
  deepSprawl(scene, 8910, 1841100, 1897400, { density: 0.9 });
  skyline(scene, registry, 8911, 1875000, 1897400, 30, 110, 320, 40, 150, [-1]);
  buildSuburb(scene, registry, 1841100, 1897400, { wall: true });
  buildPalms(scene, 1841100, 1897400, { step: 24 });   // WPB median palms

  // Delray/Boca/Coconut Creek → Fort Lauderdale
  deepSprawl(scene, 8912, 1897400, 1963400, { density: 0.95 });
  skyline(scene, registry, 8913, 1940000, 1963400, 28, 110, 320, 42, 170, [-1]);
  buildSuburb(scene, registry, 1897400, 1963400, { wall: true });
  buildPalms(scene, 1897400, 1963400, { step: 22 });   // Broward royal-palm medians

  // Hollywood → North Miami Beach → Downtown Miami: big finale skyline,
  // dense right to the southern terminus at US-1
  deepSprawl(scene, 8914, 1963400, 2003600, { density: 1.1 });
  skyline(scene, registry, 8915, 1985000, 2003600, 24, 90, 340, 45, 220, [-1, 1]);
  buildSuburb(scene, registry, 1963400, 2003600, { wall: true });
  buildPalms(scene, 1963400, 2003600, { step: 20 });   // Miami median palms, densest
  gantry(scene, registry, 2001000, [
    { lat: 0, mesh: textBoard(['I-95 SOUTH ENDS', 'US-1 · DOWNTOWN MIAMI'], 15, 3.4, '#046a38', '#ffffff') },
  ], 7);
}

// Construction work zones: the physical half of the lane closures the traffic
// model already merges cars out of (road.js WORK_ZONES / closedLanesAt). Orange
// cones taper the rightmost lane shut, an arrow board points the merge, a work
// truck sits inside the closure, and orange advance signs warn upstream.
function buildWorkZones(scene, registry) {
  const coneGeo = new THREE.ConeGeometry(0.42, 1.15, 8); coneGeo.translate(0, 0.57, 0);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xe8590c, roughness: 0.85 });
  const bandGeo = new THREE.CylinderGeometry(0.31, 0.36, 0.22, 8); bandGeo.translate(0, 0.72, 0);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.5 });
  const TAPER = 130;

  for (const z of WORK_ZONES) {
    const dir = z.dir;
    const approach = dir > 0 ? z.sLow : z.sHigh;   // where a driver first meets it
    // upstream warning signs (orange work-zone panels), 1 mi / 1000 ft / merge
    attractionSign(scene, registry, approach - dir * 1609, dir, ['RIGHT LANE', 'CLOSED', '1 MILE'], '#e8720c', '#101216', 8, 4.2);
    attractionSign(scene, registry, approach - dir * 700, dir, ['ROAD WORK', 'AHEAD'], '#e8720c', '#101216', 7.5, 3.6);
    attractionSign(scene, registry, approach - dir * 300, dir, ['MERGE', 'LEFT'], '#e8720c', '#101216', 7, 3.4);

    // cones down the closed rightmost lane, diagonal taper at the approach end
    const spots = [];
    for (let s = z.sLow; s < z.sHigh; s += 8) {
      const laneLat = latForLane(dir, usableLanesAt(s) - 1, s);
      const into = dir > 0 ? s - z.sLow : z.sHigh - s;   // distance travelled into the zone
      let lat = laneLat;
      if (into < TAPER) {
        const shoulder = Math.sign(laneLat || 1) * (pavedHalfAt(s) - 0.3);
        lat = shoulder + (laneLat - shoulder) * (into / TAPER);
      }
      spots.push({ s, lat });
    }
    const place = (mesh) => {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
      spots.forEach((sp, i) => {
        const p = posAt(sp.s, sp.lat, new THREE.Vector3());
        p.y = groundY(sp.s, sp.lat) + 0.02;
        m.compose(p, q, sc); mesh.setMatrixAt(i, m);
      });
    };
    const cones = new THREE.InstancedMesh(coneGeo, coneMat, spots.length); place(cones);
    const bands = new THREE.InstancedMesh(bandGeo, bandMat, spots.length); place(bands);
    cones.castShadow = false; bands.castShadow = false;
    scene.add(cones, bands);

    // flashing arrow board sitting in the closed lane at the taper head
    const bLat = latForLane(dir, usableLanesAt(approach) - 1, approach);
    const arrow = textBoard(['<<<<<', 'MERGE LEFT'], 6, 2.6, '#111318', '#f2a900');
    const ag = new THREE.Group();
    arrow.position.y = 3; ag.add(arrow);
    ag.position.copy(posAt(approach + dir * 16, bLat, new THREE.Vector3()));
    ag.position.y = groundY(approach, bLat);
    ag.rotation.y = headingAt(approach) + (dir > 0 ? Math.PI : 0);
    scene.add(ag); registry.signs.push({ userData: { board: arrow } });

    // a parked work truck + a small excavator box further inside the closure
    const mid = (z.sLow + z.sHigh) / 2;
    const midLat = latForLane(dir, usableLanesAt(mid) - 1, mid);
    const truck = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 7),
      new THREE.MeshStandardMaterial({ color: 0xf2a900, roughness: 0.6 }));
    body.position.y = 1.7; truck.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xf2c23d, roughness: 0.6 }));
    cab.position.set(0, 1.5, 3.4); truck.add(cab);
    truck.position.copy(posAt(mid, midLat, new THREE.Vector3()));
    truck.position.y = groundY(mid, midLat);
    truck.rotation.y = headingAt(mid);
    scene.add(truck);
  }
}

function buildSouth(scene, registry) {
  buildDelaware(scene, registry);
  buildMaryland(scene, registry);
  buildVirginia(scene, registry);
  buildCarolinas(scene, registry);
  buildGeorgia(scene, registry);
  buildFlorida(scene, registry);
  buildWorkZones(scene, registry);
}

// Long-distance I-95 continuity: the route should alternate between real
// metro edges and convincing rural mileage, never a blank plane. Keep the
// cities compact and dense, then let pine/hardwood screens carry the long
// stretches between them.
function buildI95NorthCorridorEnhancements(scene, registry) {
  const metro = [
    [120800, 133700, 0.85], // Wilmington / New Castle
    [666500, 686000, 0.9],  // Rocky Mount
  ];
  for (const [s0, s1, density] of metro) {
    deepSprawl(scene, 9900 + s0, s0, s1, { density, towers: false, litMat: lowLitMaterial(registry) });
    buildNoiseWall(scene, s0, s1, { seed: 9901 + s0, height: 4.8, margin: 4.2, step: 14, gapChance: 0.12 });
    buildTrees(scene, 9902 + s0, s0, s1, 14, 42, 180, 0, s0 > 600000);
  }

  // The coastal plain is flat by nature, but the VA Piedmont should have a
  // readable low wooded horizon instead of an infinite two-dimensional field.
  farRidge(scene, 9910, 330000, 392000, 1);
  farRidge(scene, 9911, 330000, 392000, -1);

  const controlSigns = [
    [121400, ['WILMINGTON', 'BALTIMORE · I-95 SOUTH']],
    [202000, ['BALTIMORE', 'WASHINGTON · I-95 SOUTH']],
    [310000, ['WASHINGTON DC', 'RICHMOND · I-95 SOUTH']],
    [462000, ['RICHMOND', 'PETERSBURG · I-95 SOUTH']],
    [667800, ['ROCKY MOUNT', 'FAYETTEVILLE · I-95 SOUTH']],
    [733800, ['FAYETTEVILLE', 'LUMBERTON · I-95 SOUTH']],
  ];
  for (const [s, lines] of controlSigns) {
    gantry(scene, registry, s, [
      { lat: 0, mesh: textBoard(lines, 14, 3.4, '#046a38', '#ffffff') },
    ], 6.8);
  }
}

// I-95 northeast of New Haven: up the wooded CT shoreline through New London
// (the Gold Star Bridge over the Thames), across Rhode Island into Providence,
// and on to Boston, where the run terminates. Aggressive corridor.
// Pushed out by NE_SHIFT=1907600 so it sits past the DE→FL true-scale run
// (was 96000–136000; content/spacing untouched, only s-offset changed).
const NE_SHIFT = 1907600;
function buildNortheastExt(scene, registry) {
  const o = s => s + NE_SHIFT;
  // --- CT shoreline: near-continuous coastal woods + shoreline towns
  buildTrees(scene, 9501, o(118000), o(136000), 12, 10, 70);       // wooded right to the road
  buildTrees(scene, 9502, o(118000), o(136000), 16, 60, 300, true);
  buildTrees(scene, 9504, o(118000), o(136000), 22, 300, 800, true); // deep backwoods band
  buildSuburb(scene, registry, o(124000), o(135600));              // Old Saybrook → Guilford towns
  buildBillboards(scene, registry, 9503, o(118500), o(135500), 20);
  // New London: the tall Gold Star Bridge over the Thames + water
  bridgeStructure(scene, o(121300), o(122900), [o(121700), o(122500)]);
  water(scene, o(122100), 1900, 2400);
  // New London / Groton town fabric around the bridge (clear of the Thames)
  deepSprawl(scene, 9505, o(118500), o(121000), { towers: false, density: 0.6 });
  deepSprawl(scene, 9506, o(123200), o(124200), { towers: false, density: 0.6 });

  // --- Providence: compact downtown skyline on the river, RI sprawl
  skyline(scene, registry, 9510, o(106500), o(111500), 24, 80, 300, 40, 120, [-1]);
  buildSuburb(scene, registry, o(111500), o(116500));
  buildBillboards(scene, registry, 9511, o(105500), o(117500), 18);
  bridgeStructure(scene, o(107200), o(108400), [o(107800)]);          // Providence River
  water(scene, o(107800), 1300, 1800);
  // RI is fully built-up along 95: fill behind the skyline and south of town,
  // skipping the river basin
  deepSprawl(scene, 9512, o(105200), o(106900), { density: 1.3 });
  deepSprawl(scene, 9513, o(108700), o(111500), { density: 1.3 });
  deepSprawl(scene, 9514, o(116500), o(118200), { towers: false, density: 1.05 });
  buildSuburb(scene, registry, o(104600), o(106900), { wall: true });
  buildSuburb(scene, registry, o(108700), o(111500), { wall: true });
  buildTrees(scene, 9515, o(112000), o(118000), 24, 320, 800, 150);

  // --- Boston: bigger lit skyline as I-95 comes in; the run ends here
  skyline(scene, registry, 9520, o(96500), o(103500), 22, 90, 360, 45, 155, [-1]);
  buildSuburb(scene, registry, o(99500), o(104500), { wall: true });
  buildBillboards(scene, registry, 9521, o(96500), o(104500), 20);
  // metro Boston: continuous development in from the 95/128 belt, and the
  // gap down to the Providence line stays filled
  deepSprawl(scene, 9522, o(96300), o(99500), { density: 1.35 });
  deepSprawl(scene, 9523, o(104500), o(105200), { towers: false, density: 1.0 });
  roadsideScreen(scene, 9524, o(96300), o(99500), { step: 15 });

  // state lines + a couple of interchange gantries
  welcomeSign(scene, registry, o(117200), -1, ['WELCOME TO CONNECTICUT', 'FULL OF SURPRISES', 'GOV. NED LAMONT']);
  welcomeSign(scene, registry, o(116600), 1, ['WELCOME TO RHODE ISLAND', 'THE OCEAN STATE'], '#12264a');
  welcomeSign(scene, registry, o(105200), -1, ['WELCOME TO RHODE ISLAND', 'THE OCEAN STATE'], '#12264a');
  welcomeSign(scene, registry, o(104600), 1, ['WELCOME TO MASSACHUSETTS', 'THE BAY STATE'], '#12264a');
  const jn = (s, lines) => {
    const a = textBoard(lines, 7, 3.4, '#046a38', '#fff');
    const b = textBoard(lines, 7, 3.4, '#046a38', '#fff'); b.rotation.y = Math.PI;
    gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 6.8);
  };
  jn(o(96700), ['EXIT 20', 'I-93 · DOWNTOWN', 'BOSTON · LOGAN ✈']);
  jn(o(122100), ['EXIT 83', 'I-395 NORTH', 'NORWICH · WORCESTER']);
}

function buildGwbCrossingContext(scene, registry) {
  buildRaisedApproach(scene, 42900, 43620);
  buildRaisedApproach(scene, 44380, 45000);

  // Washington Heights continues directly to the Manhattan anchorage. Dense
  // brick apartments frame the approach, but stay outside the highway trench.
  const brickMat = lowLitMaterial(registry);
  const colors = [0x7d5141, 0x8e5f49, 0x9b7158, 0x6f554a, 0xa17b61];
  const heights = placementsAlong(9810, 42600, 43600, 18, 46, 210, (rand, pos, s) => ({
    pos, rot: headingAt(s) + (rand() - 0.5) * 0.12,
    sx: 17 + rand() * 18, sy: 18 + rand() * 38, sz: 15 + rand() * 18,
    color: new THREE.Color(colors[(rand() * colors.length) | 0]),
  }), 3);
  scatterInstanced(scene, boxGeo, brickMat, heights);

  // The real GWB Bus Station occupies the Manhattan approach. This covered
  // span stays well above vehicle clearance and makes the bridge-to-city
  // transition feel embedded in Washington Heights rather than floating.
  const stationS = 43220;
  const half = pavedHalfAt(stationS) + 10;
  const station = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xa9aaa6, roughness: 0.88 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x344653, roughness: 0.3, metalness: 0.25 });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.6, 58), concrete);
  roof.position.y = 15.5; station.add(roof);
  for (const side of [-1, 1]) {
    const hall = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 54), glass);
    hall.position.set(side * (half - 4), 11.2, 0); station.add(hall);
    for (const z of [-22, 0, 22]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 2), concrete);
      leg.position.set(side * (half - 1.5), 4.5, z); station.add(leg);
    }
  }
  station.position.copy(posAt(stationS, 0, new THREE.Vector3()));
  station.rotation.y = headingAt(stationS);
  scene.add(station);

  // Hudson Terrace / riverside roads and the wooded Palisades remain visible
  // below the high deck on the Fort Lee side.
  const underRoad = new THREE.MeshStandardMaterial({ color: 0x303436, roughness: 0.96 });
  for (const s of [43480, 44520, 44820]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(260, 0.16, 9), underRoad);
    const p = posAt(s, 0, new THREE.Vector3());
    strip.position.set(p.x, groundY(s, 0) + 0.08, p.z);
    strip.rotation.y = headingAt(s); scene.add(strip);
  }
  buildTrees(scene, 9811, 44280, 45100, 9, 42, 340, 65);

  // Vertical shore/anchorage faces close the gap between deck and land, so no
  // grass or water can visually climb through either bridge mouth.
  const retaining = new THREE.MeshStandardMaterial({ color: 0x777b79, roughness: 0.94, side: THREE.DoubleSide });
  for (const [a, b] of [[43480, 43620], [44380, 44540]]) {
    for (const side of [-1, 1]) {
      const edge = s => side * (pavedHalfAt(s) + 0.7);
      scene.add(new THREE.Mesh(buildRibbon(
        edge, edge, s => -bridgeBumpAt(s) - 2.5, 0.9, 6, a, b), retaining));
    }
  }

  const light = new THREE.MeshBasicMaterial({ color: 0xffdda0 });
  for (let s = 43650; s < 44370; s += 58) {
    for (const side of [-1, 1]) {
      const p = posAt(s, side * (pavedHalfAt(s) + 0.45), new THREE.Vector3());
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), light);
      bulb.position.set(p.x, p.y + 1.35, p.z); scene.add(bulb);
    }
  }
}

// GWB lower level: a full second roadway hung ~6.5 m under the main deck, with
// its own side girders, deck lighting and portal headers so it reads clearly as
// a covered lower level. Cars in the right lanes at the approach take it.
function buildGwbLowerDeck(scene, registry) {
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 0.95, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b6672, roughness: 0.45, metalness: 0.65, side: THREE.DoubleSide });
  const litMat = new THREE.MeshBasicMaterial({ color: 0xffd38a }); // always-on lower-deck lighting
  const drop = s => -gwbLowerDrop(s);
  // the lower roadway slab
  scene.add(new THREE.Mesh(buildRibbon(
    s => -pavedHalfAt(s), s => pavedHalfAt(s), s => drop(s) + 0.02, s => drop(s) + 0.02,
    8, 43620, 44380), deckMat));
  // side girders + a run of edge lights down both sides so the level glows
  for (const side of [-1, 1]) {
    const latF = s => side * (pavedHalfAt(s) + 0.4);
    scene.add(new THREE.Mesh(buildRibbon(
      latF, latF, s => drop(s), s => drop(s) + 1.1, 8, 43620, 44380), steel));
    const litF = s => side * (pavedHalfAt(s) - 0.3);
    scene.add(new THREE.Mesh(buildRibbon(
      s => litF(s) - 0.12, s => litF(s) + 0.12, s => drop(s) + 2.4, s => drop(s) + 2.4,
      6, 43700, 44300), litMat));
  }
  // truss verticals tying the two decks together
  const p = new THREE.Vector3();
  for (let s = 43700; s < 44320; s += 45) {
    for (const side of [-1, 1]) {
      const d = gwbLowerDrop(s);
      if (d < 1.5) continue;
      posAt(s, side * (pavedHalfAt(s) + 0.9), p);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, d, 0.5), steel);
      post.position.set(p.x, p.y - d / 2, p.z);
      scene.add(post);
    }
  }
  // portal headers at both lower-level mouths (where the ramp dives under the
  // upper deck) — makes the entrance to the lower level obvious
  for (const ps of [43790, 44210]) {
    const half = pavedHalfAt(ps);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 1, 1.2, 1.0), steel);
    posAt(ps, 0, p);
    beam.position.set(p.x, p.y - gwbLowerDrop(ps) + 3.2, p.z);
    beam.rotation.y = headingAt(ps);
    scene.add(beam);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 0.2), litMat);
    sign.position.set(p.x, p.y - gwbLowerDrop(ps) + 3.0, p.z);
    sign.rotation.y = headingAt(ps);
    scene.add(sign);
  }
}
