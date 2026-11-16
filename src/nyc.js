import * as THREE from 'three';
import { posAt, headingAt } from './road.js';
import {
  groundY, buildTrees, buildBillboards, buildSuburb,
  scatterInstanced, placementsAlong, facadeTexture, deepSprawl, buildNoiseWall,
} from './environment.js';

// Long Island Expressway (I-495) big green overhead guide signs: an exit tab
// with the real exit number, the route(s) it meets, and the control town — the
// endless overhead BGS that define the LIE. Both faces so it reads either way.
function lieExit(scene, registry, s, exit, routes, dest, w = 15) {
  const lines = [`EXIT ${exit}`, routes, dest];
  const a = textBoard(lines, w, 4.0, '#046a38', '#ffffff');
  const b = textBoard(lines, w, 4.0, '#046a38', '#ffffff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 7.4);
}
// I-495 pull-through control-city shield gantry (WEST = toward the tunnel/Manhattan,
// EAST = out the Island toward Riverhead).
function lieShield(scene, registry, s, west, east) {
  const a = textBoard(['I-495 WEST', west], 12, 3.6, '#046a38', '#ffffff');
  const b = textBoard(['I-495 EAST', east], 12, 3.6, '#046a38', '#ffffff'); b.rotation.y = Math.PI;
  gantry(scene, registry, s, [{ lat: 0, mesh: a }, { lat: 0, mesh: b }], 7.4);
}

// A continuous concrete jersey-barrier median down the centre — NYC highways
// are divided by barrier, not grass.
function jerseyMedian(scene, s0, s1, lat = 0) {
  const geo = new THREE.BoxGeometry(0.5, 0.9, 1); geo.translate(0, 0.45, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9ca0a4, roughness: 0.9 });
  const step = 6, out = [], v = new THREE.Vector3();
  for (let s = s0; s < s1; s += step) {
    posAt(s, lat, v);
    out.push({ pos: v.clone().setY(groundY(s, lat)), rot: headingAt(s), sx: 0.5, sy: 1, sz: step + 0.3 });
  }
  scatterInstanced(scene, geo, mat, out);
}

import {
  welcomeSign, gantry, textBoard, water, bridgeStructure, skyline, suspensionBridge,
} from './turnpike.js';

// ---------------------------------------------------------------------------
// I-95 George Washington Bridge → the Harlem River Drive / FDR Drive down the
// east side of Manhattan → the Queens-Midtown Tunnel → I-495 Long Island
// Expressway east through Queens and Nassau to Jericho. The scenic run: the GWB
// over the Hudson, the wall of Manhattan towers with the Midtown skyline lit up
// across the FDR, the East River with Roosevelt Island and the Queensboro
// Bridge, the tunnel portal, the elevated 7-train and row houses of Queens,
// Flushing Meadows (the Unisphere, Citi Field), then the Nassau suburbs and the
// malls out to Jericho. Real boroughs, real views, lit at night.
// ---------------------------------------------------------------------------

function jit(n) { const x = Math.sin(n * 127.1) * 43758.5; return x - Math.floor(x); }

// A river running alongside the road, offset to one side (the East River beside
// the FDR). Centered on (s, latOffset), rotated to follow the road.
function riverside(scene, s, length, latOffset, width) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x2b5570, roughness: 0.25, metalness: 0.4 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(posAt(s, latOffset, new THREE.Vector3())); mesh.position.y = -2.6;
  mesh.rotation.z = -headingAt(s);
  scene.add(mesh);
}

// A dense wall of city towers along one side, with a height profile that peaks
// in Midtown. Windows are a shared lit-facade material (glows at night).
function towerWall(scene, towerMat, seed, s0, s1, side, latBase, hMin, hMax, step = 26) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.8 });
  const towers = [];
  let k = seed;
  for (let s = s0; s < s1; s += step + jit(k) * 14) {
    for (let row = 0; row < 3; row++) {
      k += 1.7;
      const lat = side * (latBase + row * 34 + jit(k * 3.1) * 18);
      const pos = posAt(s, lat, new THREE.Vector3()); pos.y = groundY(s, lat);
      const h = hMin + Math.pow(jit(k * 2.3), 1.6) * (hMax - hMin) * (1 - row * 0.22);
      const w = 12 + jit(k * 5.5) * 16;
      towers.push({ pos, rot: headingAt(s) + (jit(k * 7.7) - 0.5) * 0.1, sx: w, sy: h, sz: w * (0.7 + jit(k) * 0.6), h });
    }
  }
  scatterInstanced(scene, geo, towerMat, towers.map(t => ({ pos: t.pos, rot: t.rot, sx: t.sx, sy: t.sy, sz: t.sz })));
  scatterInstanced(scene, geo, roofMat, towers.map(t => ({
    pos: t.pos.clone().setY(t.pos.y + t.sy), rot: t.rot, sx: t.sx * 1.02, sy: 0.6, sz: t.sz * 1.02,
  })), { shadow: false });
}

// A landmark spire — a stepped setback tower with a mast (Empire State / Chrysler feel).
function landmark(scene, towerMat, s, lat, baseH, kind) {
  const g = new THREE.Group();
  const litSide = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.7 });
  let y = 0, w = 26;
  for (let tier = 0; tier < 4; tier++) {
    const th = baseH * (tier === 0 ? 0.5 : 0.16);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, th, w), towerMat);
    box.position.y = y + th / 2; g.add(box);
    y += th; w *= 0.72;
  }
  // crown + mast
  const crown = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, baseH * 0.14, kind === 'chrysler' ? 8 : 12), litSide);
  crown.position.y = y + baseH * 0.07; g.add(crown);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, baseH * 0.16, 6), litSide);
  mast.position.y = y + baseH * 0.2; g.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff3020, emissiveIntensity: 1 }));
  beacon.position.y = y + baseH * 0.29; g.add(beacon);
  const p = posAt(s, lat, new THREE.Vector3()); g.position.set(p.x, groundY(s, lat), p.z); g.rotation.y = headingAt(s);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
}

// Elevated subway (the 7 line over Queens Blvd / Roosevelt Ave): a steel deck on
// bent columns running alongside the road.
function elevatedTrain(scene, s0, s1, side, lat) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.5, metalness: 0.5 });
  const colGeo = new THREE.BoxGeometry(1, 1, 1); colGeo.translate(0, 0.5, 0);
  const cols = [];
  for (let s = s0; s < s1; s += 14) {
    const pos = posAt(s, side * lat, new THREE.Vector3()); pos.y = groundY(s, side * lat);
    cols.push({ pos, rot: headingAt(s), sx: 1.2, sy: 8, sz: 1.2 });
  }
  scatterInstanced(scene, colGeo, steel, cols);
  // continuous deck
  const midS = (s0 + s1) / 2;
  const len = s1 - s0;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, len), steel);
  const p = posAt(midS, side * lat, new THREE.Vector3()); deck.position.set(p.x, groundY(midS, side * lat) + 8.5, p.z);
  deck.rotation.y = headingAt(midS); scene.add(deck);
}

// Row houses / attached brick houses of the outer boroughs.
function rowHouses(scene, s0, s1, seed, dens = 22) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  const brick = [0x8a5a44, 0x9a6a4a, 0xb08050, 0xc4b8a0, 0x8a8078, 0xa03830];
  const houses = placementsAlong(seed, s0, s1, dens, 85, 300, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2),
    sx: 6.5 + rand() * 2, sy: 7 + rand() * 5, sz: 9 + rand() * 4,
    color: new THREE.Color(brick[(rand() * brick.length) | 0]),
  }));
  scatterInstanced(scene, geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), houses);
  scatterInstanced(scene, geo, new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.95 }), houses.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot, sx: h.sx * 1.06, sy: 0.5, sz: h.sz * 1.06,
  })), { shadow: false });
}

// Big-box mall / shopping-center block (Roosevelt Field etc.) with a lot + sign.
function mall(scene, registry, s, side, name) {
  const g = new THREE.Group();
  const p = posAt(s, side * 90, new THREE.Vector3()); g.position.set(p.x, groundY(s, side * 90), p.z); g.rotation.y = headingAt(s);
  const lot = new THREE.Mesh(new THREE.BoxGeometry(140, 0.1, 90), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.95 }));
  lot.position.y = 0.05; g.add(lot);
  const box = new THREE.Mesh(new THREE.BoxGeometry(100, 11, 55), new THREE.MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.85 }));
  box.position.set(0, 5.5, -14); box.castShadow = true; g.add(box);
  const sign = textBoard([name], 16, 3, '#7a1f6b', '#ffffff'); sign.position.set(0, 13, 14); g.add(sign);
  registry.signs.push({ userData: { board: sign } });
  scene.add(g);
}

export function buildNYC(scene, registry) {
  // shared lit-window facade material for all the towers (glows at night)
  const tex = facadeTexture(24);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.7, color: 0xffffff,
  });
  registry.towerMats = [towerMat];

  // NYC highways are walled concrete corridors, not grassy shoulders: continuous
  // retaining walls just off both shoulders (Harlem River Dr / FDR trench, then
  // the sunken LIE through Queens), broken by gaps for the ramps and the open
  // river/skyline views, with a jersey-barrier median down the middle. (The
  // forest blanket is turned off for this map — see main.js.)
  buildNoiseWall(scene, 2600, 24000, { height: 5.8, seed: 771, margin: 2.2, step: 12, gapChance: 0.1 });   // Harlem River Dr + FDR
  buildNoiseWall(scene, 26400, 43000, { height: 4.8, seed: 772, margin: 2.2, step: 12, gapChance: 0.12 }); // I-495 LIE through Queens
  // continuous sound walls out the leafy Nassau/Suffolk LIE too — homes sit well
  // back behind the wall and a tree buffer, not fronting the expressway
  buildNoiseWall(scene, 43000, 60000, { height: 5.0, seed: 773, margin: 2.6, step: 12, gapChance: 0.16 });
  jerseyMedian(scene, 2600, 52500);

  // --- George Washington Bridge over the Hudson (Fort Lee NJ → Washington Hts)
  water(scene, 1500, 4200, 2400);                                  // the Hudson
  suspensionBridge(scene, 300, 3000, 900, 2400, 60);              // GWB towers + cables
  welcomeSign(scene, registry, 400, -1, ['WELCOME TO', 'NEW JERSEY', 'FORT LEE'], '#046a38');
  welcomeSign(scene, registry, 3100, 1, ['WELCOME TO', 'NEW YORK', 'THE BRONX / MANHATTAN'], '#e0821a');

  // --- Washington Heights + Harlem: dense pre-war apartment blocks on the
  // Manhattan (west) side; the Harlem River and the Bronx (Yankee Stadium, the
  // Grand Concourse walk-ups, an elevated line) on the east side.
  towerWall(scene, towerMat, 100, 3000, 12500, -1, 26, 40, 96, 20);   // Washington Hts / Harlem apartments
  towerWall(scene, towerMat, 160, 3000, 12500, -1, 96, 34, 82, 26);   // second rank climbing the ridge
  deepSprawl(scene, 8680, 3000, 12500, { glowMat: towerMat, side: -1, latStart: 60 }); // upper Manhattan behind
  riverside(scene, 7600, 9600, 270, 130);                             // the Harlem River, east side
  towerWall(scene, towerMat, 220, 3000, 12500, 1, 350, 30, 80, 22);   // the Bronx across the river (Grand Concourse)
  elevatedTrain(scene, 3600, 11500, 1, 330);                          // Bronx elevated (the 4 line / Metro-North)
  deepSprawl(scene, 8690, 3000, 12500, { glowMat: towerMat, side: 1, latStart: 360 }); // the Bronx behind
  // Yankee Stadium, in the Bronx across the Harlem River
  (function yankeeStadium() {
    const p = posAt(6000, 445, new THREE.Vector3()); const gy = groundY(6000, 445);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 22, 30, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xeae6d8, roughness: 0.85, side: THREE.DoubleSide }));
    ring.scale.set(48, 1, 42); ring.position.set(p.x, gy + 11, p.z); ring.rotation.y = headingAt(6000); scene.add(ring);
    const field = new THREE.Mesh(new THREE.CircleGeometry(1, 24),
      new THREE.MeshStandardMaterial({ color: 0x2f6a34, roughness: 0.95 }));
    field.rotation.x = -Math.PI / 2; field.scale.set(34, 30, 1); field.position.set(p.x, gy + 0.4, p.z); scene.add(field);
  })();
  // the High Bridge (the old aqueduct footbridge) spanning the Harlem River
  bridgeStructure(scene, 8600, 9200, [8800, 9000]);
  buildBillboards(scene, registry, 202, 3200, 12500, 20);

  // --- FDR Drive down the East River: the Manhattan skyline wall on the inland
  // (west) side rising to Midtown; the river + Roosevelt Island on the east side.
  riverside(scene, 18250, 12000, 210, 360);                        // East River, off the east side
  towerWall(scene, towerMat, 500, 12500, 19000, -1, 26, 40, 150, 24);  // Upper East Side high-rises
  towerWall(scene, towerMat, 900, 19000, 24000, -1, 24, 90, 300, 20);  // MIDTOWN — the big wall
  // landmark spires in Midtown
  landmark(scene, towerMat, 21000, -70, 300, 'empire');            // Empire State-ish
  landmark(scene, towerMat, 22200, -95, 260, 'chrysler');          // Chrysler-ish
  landmark(scene, towerMat, 20200, -120, 210, 'flat');
  // Roosevelt Island + the Queensboro (59th St) Bridge across the river
  const ri = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 900), new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.95 }));
  const rp = posAt(16500, 60, new THREE.Vector3()); ri.position.set(rp.x, 0.3, rp.z); ri.rotation.y = headingAt(16500); scene.add(ri);
  towerWall(scene, towerMat, 700, 15800, 17200, 1, 60, 24, 46, 40); // RI apartments
  bridgeStructure(scene, 17600, 18600, [17900, 18300]);            // Queensboro Bridge
  // Manhattan carries on for blocks behind the FDR wall, and Queens/Brooklyn
  // rise across the East River — never open water or green to the horizon.
  deepSprawl(scene, 8730, 12500, 24000, { glowMat: towerMat, side: -1, latStart: 90 });
  towerWall(scene, towerMat, 760, 12500, 24000, 1, 420, 26, 120, 26);  // LIC / Brooklyn waterfront across the river
  deepSprawl(scene, 8710, 12500, 24000, { glowMat: towerMat, side: 1, latStart: 470 });
  buildBillboards(scene, registry, 203, 12500, 24000, 16);

  // --- Queens-Midtown Tunnel portal (dive under the East River into Queens)
  (function tunnelPortal() {
    for (const s of [24000, 26000]) {
      const p = posAt(s, 0, new THREE.Vector3());
      const portal = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 3), new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 }));
      portal.position.set(p.x, 4.5, p.z); portal.rotation.y = headingAt(s); scene.add(portal);
      const arch = new THREE.Mesh(new THREE.BoxGeometry(24, 5, 3.2), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 }));
      arch.position.set(p.x, 3, p.z); arch.rotation.y = headingAt(s); scene.add(arch);
    }
  })();
  gantry(scene, registry, 24600, [{ lat: -6, mesh: textBoard(['QUEENS-MIDTOWN TUNNEL', 'I-495 EAST', 'LONG ISLAND'], 8, 4, '#046a38', '#ffffff') },
    { lat: 6, mesh: (() => { const b = textBoard(['MIDTOWN TUNNEL', 'I-495 W · MANHATTAN'], 8, 4, '#046a38', '#ffffff'); b.rotation.y = Math.PI; return b; })() }], 7.2);

  // --- Long Island City / Hunters Point: new glass towers by the river
  towerWall(scene, towerMat, 1100, 26000, 30000, -1, 30, 60, 170, 26); // LIC high-rises
  towerWall(scene, towerMat, 1150, 26000, 30000, 1, 34, 40, 120, 30);
  buildBillboards(scene, registry, 204, 26000, 30000, 16);

  // --- Queens along the LIE: elevated 7 train, row houses, mid-rise
  elevatedTrain(scene, 30000, 39000, 1, 46);                       // the 7 line
  rowHouses(scene, 30000, 43000, 205, 18);
  towerWall(scene, towerMat, 1200, 30000, 43000, -1, 40, 18, 44, 40); // apartment mid-rise
  buildBillboards(scene, registry, 206, 30000, 43000, 22);
  // Queens carries on for miles behind the LIE (Jamaica, Corona, Flushing)
  deepSprawl(scene, 8700, 30000, 43000, { glowMat: towerMat });

  // --- the LIE's signature: green overhead BGS the whole way, real exit numbers
  // and control towns, I-495 W/E pull-throughs. This is what makes it read as
  // the Long Island Expressway.
  lieShield(scene, registry, 27000, 'MIDTOWN TUNNEL · MANHATTAN', 'LONG ISLAND');
  lieExit(scene, registry, 30000, '19', 'QUEENS BLVD', 'Woodhaven Bl · Elmhurst');
  lieExit(scene, registry, 32500, '22 · I-278', 'BQE', 'Brooklyn · The Bronx');
  lieExit(scene, registry, 35000, '23', 'GRAND CENTRAL PKWY', 'Whitestone Br · LaGuardia ✈');
  lieExit(scene, registry, 38000, '24', 'KISSENA BLVD', 'Flushing');
  lieExit(scene, registry, 41000, '25', 'UTOPIA PKWY', 'Fresh Meadows');
  lieShield(scene, registry, 43600, 'QUEENS · MANHATTAN', 'RIVERHEAD');
  gantry(scene, registry, 43900, [{ lat: 0, mesh: textBoard(['I-495 · LONG ISLAND EXPRESSWAY', 'HOV LANE · 2+ PERSONS', '6 AM–10 AM · 3 PM–8 PM'], 15, 3.5, '#046a38', '#ffffff') }], 7.3);
  lieExit(scene, registry, 44600, '31', 'CROSS ISLAND PKWY', 'Whitestone Br · JFK ✈');
  lieExit(scene, registry, 46800, '33', 'COMMUNITY DR', 'Manhasset · Great Neck');
  lieExit(scene, registry, 48200, '36', 'SEARINGTOWN RD', 'Port Washington · Roslyn');
  lieExit(scene, registry, 49600, '38', 'NORTHERN STATE PKWY', 'Meadowbrook Pkwy · Jones Beach');
  lieExit(scene, registry, 51000, '40', 'NY 25 · JERICHO TPKE', 'Jericho · Syosset');
  lieExit(scene, registry, 52400, '41', 'NY 107', 'Hicksville · Bethpage');
  lieExit(scene, registry, 55000, '49', 'NY 110', 'Melville · Amityville');
  lieShield(scene, registry, 57500, 'NYC · MIDTOWN TUNNEL', 'RIVERHEAD · THE HAMPTONS');

  // --- Flushing Meadows: the Unisphere + Citi Field + park trees
  (function flushingMeadows() {
    // Unisphere: a big steel globe
    const g = new THREE.Group();
    const globe = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshStandardMaterial({ color: 0x9aa4ac, roughness: 0.4, metalness: 0.7, wireframe: true }));
    globe.position.y = 12; g.add(globe);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 4, 12), new THREE.MeshStandardMaterial({ color: 0x8a8f96 })); base.position.y = 2; g.add(base);
    const up = posAt(37000, -110, new THREE.Vector3()); g.position.set(up.x, groundY(37000, -110), up.z); scene.add(g);
    // Citi Field: a stadium ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 8, 8, 24), new THREE.MeshStandardMaterial({ color: 0x14315c, roughness: 0.8 }));
    ring.rotation.x = Math.PI / 2; const cp = posAt(36000, 130, new THREE.Vector3()); ring.position.set(cp.x, 8, cp.z); scene.add(ring);
  })();
  buildTrees(scene, 207, 35000, 39000, 20, 30, 150, 90);          // the park

  // --- Nassau County suburbs: split-levels, malls, out to Jericho
  buildSuburb(scene, registry, 43000, 52000);
  rowHouses(scene, 43000, 50000, 208, 30);
  // heavily wooded Long Island — a thick canopy that buries the houses so you see
  // green, not blocky boxes: a dense near screen, then deep woods with homes
  // tucked among the trees
  buildTrees(scene, 209, 43000, 52000, 9, 28, 360, 200, false, 1.3);    // dense deciduous canopy, close in
  buildTrees(scene, 2091, 43000, 52000, 14, 38, 400, 150, true, 1.2);   // evergreens mixed through
  buildTrees(scene, 2092, 43000, 52000, 12, 100, 560, 170, false, 1.25); // deep woods behind the homes
  mall(scene, registry, 47500, -1, 'ROOSEVELT FIELD');
  mall(scene, registry, 49500, 1, 'BROADWAY MALL');
  buildBillboards(scene, registry, 210, 43000, 52000, 24);
  welcomeSign(scene, registry, 43200, 1, ['NASSAU COUNTY', 'NEW HYDE PARK'], '#123a7a');

  // --- back half of the loop: generic Long Island so the ring closes (kept
  // built-up, no bare patches — Levittown-style tract housing all the way)
  buildTrees(scene, 211, 52000, 60000, 10, 28, 360, 180, false, 1.3);
  buildTrees(scene, 2111, 52000, 60000, 15, 40, 420, 140, true, 1.2);
  buildTrees(scene, 2112, 52000, 60000, 13, 100, 560, 150, false, 1.25);
  rowHouses(scene, 52000, 59000, 212, 26);
  deepSprawl(scene, 8720, 52000, 60000, { glowMat: towerMat, density: 1.0 });
  buildBillboards(scene, registry, 213, 52000, 60000, 16);

  // --- exit gantries along the LIE (real exit numbers)
  const junc = (s, lines) => {
    const a = textBoard(lines, 7.2, 3.4, '#046a38', '#ffffff');
    const b = textBoard(lines, 7.2, 3.4, '#046a38', '#ffffff'); b.rotation.y = Math.PI;
    gantry(scene, registry, s, [{ lat: -6, mesh: a }, { lat: 6, mesh: b }], 7);
  };
  // FDR / Harlem River Dr through Manhattan (the LIE's own exits are the detailed
  // lieExit/lieShield set above, so no duplicates here)
  junc(1000, ['I-95 · GW BRIDGE', 'FROM NEW JERSEY', 'HARLEM RIVER DR ↑']);
  junc(9000, ['FDR DRIVE SOUTH', 'MIDTOWN · DOWNTOWN', 'EXITS 9–2']);
  junc(20500, ['EXIT 9 · E 42 ST', 'UNITED NATIONS', 'MIDTOWN TUNNEL ↗']);
}
