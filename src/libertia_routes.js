import * as THREE from 'three';
import { LOOP_LENGTH, MAP } from './config.js';
import { posAt, headingAt, pavedHalfAt, buildRibbon } from './road.js';
import { groundY, buildNoiseWall, buildSuburb, deepSprawl, buildTrees, facadeTexture } from './environment.js';
import { textBoard, skyline, addSkyGlow } from './turnpike.js';

const mat = (color, roughness = .82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const sign = (scene, registry, s, lines, color = '#075b3d', lat = 0) => {
  const b = textBoard(lines, 13, 3.4, color, '#fff');
  // These are ordinary reflective US roadside signs, not electronic message
  // boards.  They should only catch headlights/ambient light after dark.
  b.material.emissive.set(0x000000);
  b.material.emissiveMap = null;
  b.material.emissiveIntensity = 0;
  b.material.roughness = .78;
  b.material.needsUpdate = true;
  const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat) + 5.5;
  b.position.copy(p); b.rotation.y = headingAt(s) + (lat < 0 ? Math.PI : 0); scene.add(b);
  registry.signs.push({ userData: { board: b } });
};

function bridge(scene, s, span = 900, height = 8) {
  const steel = mat(0x53616d, .45, .7);
  const deck = new THREE.Mesh(buildRibbon(s => -pavedHalfAt(s) - 1, s => pavedHalfAt(s) + 1, height, height + .45, 18, s - span / 2, s + span / 2), steel);
  scene.add(deck);
  for (const x of [-1, 1]) {
    for (let t = s - span / 2; t <= s + span / 2; t += 180) {
      const p = posAt(t, x * (pavedHalfAt(t) + 4), new THREE.Vector3()); p.y = groundY(t, 0);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, Math.max(2, height - p.y), 2.2), steel);
      pier.position.copy(p); pier.position.y += pier.geometry.parameters.height / 2; scene.add(pier);
    }
  }
}

function tunnel(scene, registry, s, length = 700) {
  const concrete = mat(0x4e5357, .95);
  const half = pavedHalfAt(s) + 2;
  for (const t of [s - length / 2, s + length / 2]) {
    const g = new THREE.Group();
    const arch = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 10, 3), concrete); arch.position.y = 5; g.add(arch);
    for (const x of [-half, half]) { const p = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 3), concrete); p.position.set(x, 5, 0); g.add(p); }
    g.position.copy(posAt(t, 0, new THREE.Vector3())); g.rotation.y = headingAt(t); scene.add(g);
  }
  // Continuous roof and side walls make this a real tunnel volume, not just
  // two portal frames with an uncovered road between them.
  scene.add(new THREE.Mesh(buildRibbon(s => -half, s => half, 9.8, 9.8, 12, s - length / 2, s + length / 2), concrete));
  for (const side of [-1, 1]) {
    for (let t = s - length / 2; t < s + length / 2; t += 70) {
      const span = Math.min(70, s + length / 2 - t), mid = t + span / 2;
      const p = posAt(mid, side * half, new THREE.Vector3()); p.y = groundY(mid, side * half) + 5;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 10, span + 1), concrete);
      wall.position.copy(p); wall.rotation.y = headingAt(mid); scene.add(wall);
    }
  }
  scene.add(new THREE.Mesh(buildRibbon(s => -half, s => half, 0, 0, 10, s - length / 2, s + length / 2), mat(0x17191b, .98)));
  sign(scene, registry, s - length / 2 - 80, ['TUNNEL AHEAD', MAP === 'us67' ? 'DOWNTOWN RESTON' : 'USE HEADLIGHTS'], '#26333d');
}

function construction(scene, registry, s, label = 'ROAD WORK AHEAD') {
  const orange = mat(0xf28c28, .65);
  const coneGeo = new THREE.ConeGeometry(.55, 1.4, 8); coneGeo.translate(0, .7, 0);
  for (let t = s; t < s + 900; t += 42) for (const side of [-1, 1]) {
    const p = posAt(t, side * (pavedHalfAt(t) - 1.8), new THREE.Vector3()); p.y = groundY(t, 0) + .02;
    const c = new THREE.Mesh(coneGeo, orange); c.position.copy(p); scene.add(c);
  }
  sign(scene, registry, s - 120, [label, 'MERGE LEFT'], '#b9471f');
}

function farmFields(scene, s0, s1) {
  const crops = [mat(0x6d7c32, .98), mat(0x927744, .98), mat(0x4f7137, .98)];
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
    const inner = 115 + i * 105;
    scene.add(new THREE.Mesh(buildRibbon(
      s => side * inner, s => side * (inner + 92), .015, .015, 12, s0, s1,
    ), crops[i]));
  }
}

function buildCorporateFarmBelt(scene) {
  const barnMat = mat(0x7e4d35, .9);
  const shedMat = mat(0x687078, .82, .2);
  const siloMat = mat(0xaeb2ae, .48, .45);
  const roofMat = mat(0x3d454b, .78, .15);
  const yardMat = mat(0x665b4a, .98);
  const complexes = [26000, 31500, 38200, 44800, 51600, 58600, 65400];
  for (let i = 0; i < complexes.length; i++) {
    const s = complexes[i];
    for (const side of [-1, 1]) {
      const lat = side * (170 + (i % 3) * 42);
      const origin = posAt(s, lat, new THREE.Vector3()); origin.y = groundY(s, lat);
      const g = new THREE.Group(); g.position.copy(origin); g.rotation.y = headingAt(s);
      const barn = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 48), barnMat); barn.position.set(0, 4.5, 0); g.add(barn);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(32, 1.3, 50), roofMat); roof.position.set(0, 9.4, 0); roof.rotation.z = side * .08; g.add(roof);
      const shed = new THREE.Mesh(new THREE.BoxGeometry(42, 7, 24), shedMat); shed.position.set(side * 28, 3.5, 14); g.add(shed);
      for (const x of [-14, 14]) {
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 18, 12), siloMat); silo.position.set(x, 9, -25); g.add(silo);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.6, 12), roofMat); cap.position.set(x, 19.3, -25); g.add(cap);
      }
      const elevator = new THREE.Mesh(new THREE.BoxGeometry(7, 28, 8), siloMat); elevator.position.set(side * 22, 14, -8); g.add(elevator);
      scene.add(g);
      scene.add(new THREE.Mesh(buildRibbon(
        x => side < 0 ? x - 42 : x + 6,
        x => side < 0 ? x - 6 : x + 42,
        .025, .025, 6, s - 170, s + 170,
      ), yardMat));
    }
  }
  // A few long access roads and irrigation channels break up the crop carpet
  // and make the agricultural economy read at interstate speed.
  const accessMat = mat(0x514c40, .99);
  for (const s of [29000, 41000, 53500, 63000]) {
    scene.add(new THREE.Mesh(buildRibbon(x => -155, x => -150, .03, .03, 6, s - 260, s + 260), accessMat));
    scene.add(new THREE.Mesh(buildRibbon(x => 150, x => 155, .03, .03, 6, s - 260, s + 260), accessMat));
  }
}

function denseBlocks(scene, s0, s1, step, rows, color, hMin, hMax, seed = 1) {
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, .5, 0);
  const placements = [];
  for (let s = s0, i = 0; s < s1; s += step, i++) for (const side of [-1, 1]) for (let r = 0; r < rows.length; r++) {
    const n = Math.abs(Math.sin(seed + i * 7.17 + side * 3.11 + r * 5.3));
    const lat = side * (rows[r] + n * 22);
    const p = posAt(s + (n - .5) * step * .45, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    placements.push({ pos: p, rot: headingAt(s) + (n - .5) * .18, sx: 12 + n * 17, sy: hMin + n * (hMax - hMin), sz: 13 + (1 - n) * 18 });
  }
  const mesh = new THREE.InstancedMesh(geo, mat(color, .88), placements.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  placements.forEach((b, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot); m.compose(b.pos, q, sc.set(b.sx, b.sy, b.sz)); mesh.setMatrixAt(i, m); });
  scene.add(mesh);
}

function buildOpenCage(scene, s0, s1, height = 4.8, margin = 9) {
  const steel = mat(0x4a5053, .7, .55);
  for (const side of [-1, 1]) for (let s = s0; s < s1; s += 24) {
    const end = Math.min(s + 24, s1);
    const lat = side * (pavedHalfAt(s) + margin);
    for (const y of [0.35, height - .25]) {
      scene.add(new THREE.Mesh(buildRibbon(x => side * (pavedHalfAt(x) + margin - .06), x => side * (pavedHalfAt(x) + margin + .06),
        x => groundY(x, lat) + y, x => groundY(x, lat) + y + .12, 4, s, end), steel));
    }
    for (const t of [s, end]) {
      const p = posAt(t, side * (pavedHalfAt(t) + margin), new THREE.Vector3()); p.y = groundY(t, lat) + height / 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(.16, height, .16), steel); post.position.copy(p); scene.add(post);
    }
  }
}

function buildHardUrbanEdge(scene, s0, s1, width = 18) {
  const concrete = new THREE.MeshStandardMaterial({ color: 0x45484a, roughness: .96, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    scene.add(new THREE.Mesh(buildRibbon(
      s => side * (pavedHalfAt(s) + .1),
      s => side * (pavedHalfAt(s) + width),
      .18,
      .18,
      40, s0, s1,
    ), concrete));
  }
}

function buildI680OverheadTrains(scene) {
  const steel = mat(0x4c5963, .5, .65);
  const rail = mat(0x202a32, .46, .45);
  for (const s of [174000, 189500, 202500]) {
    const deckY = groundY(s, 0) + 13.5;
    scene.add(new THREE.Mesh(buildRibbon(-145, 145, deckY - groundY(s, 0), deckY - groundY(s, 0) + .7, 24, s - 8, s + 8), steel));
    for (const lat of [-118, 118]) {
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.8, 13.5, 1.8), steel); pier.position.copy(p); pier.position.y += 6.75; scene.add(pier);
    }
    const train = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.45, 10), rail);
      car.position.z = (i - 3) * 10.2;
      const windows = new THREE.Mesh(new THREE.BoxGeometry(3.46, .58, 8.1), mat(0x4a9fbd, .32, .15));
      windows.position.set(0, .42, (i - 3) * 10.2);
      train.add(car, windows);
    }
    const p = posAt(s, 0, new THREE.Vector3()); train.position.set(p.x, deckY + 1.4, p.z);
    train.rotation.y = headingAt(s) + Math.PI / 2; scene.add(train);
  }
}

function buildI680RestonEdges(scene) {
  const asphalt = mat(0x303235, .98), sidewalk = mat(0x8d8d86, .95);
  const frontage = [-1, 1];
  // These local roads run beside the viaduct, close enough to read as a city
  // rather than a distant backdrop, while remaining physically separate from
  // the interstate carriageway.
  for (const side of frontage) {
    for (const lat of [side * 47, side * 72]) {
      scene.add(new THREE.Mesh(buildRibbon(s => lat - 3.5, s => lat + 3.5, s => groundY(s, lat) + .08, s => groundY(s, lat) + .08, 80, 166000, 205000), asphalt));
      scene.add(new THREE.Mesh(buildRibbon(s => lat + side * 4.2, s => lat + side * 7.0, s => groundY(s, lat) + .12, s => groundY(s, lat) + .12, 80, 166000, 205000), sidewalk));
    }
  }
  // Cross-street decks make the city visible above and below the interstate;
  // the mainline itself keeps its interstate-only, no-signal operation.
  [169500, 176500, 184500, 191500, 199000].forEach((s, i) => bridge(scene, s, i % 2 ? 680 : 980, i % 2 ? 8.5 : 11));

  const carColors = [0x9b3027, 0x2f5d82, 0xb59c52, 0x44494c, 0x6f303f];
  for (let i = 0; i < 30; i++) {
    const s = 166500 + ((i * 1371) % 37500);
    const side = i % 2 ? 1 : -1;
    const lat = side * (i % 3 ? 47 : 72);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat) + .62;
    const car = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.15, 4.3), mat(carColors[i % carColors.length], .68, .2));
    car.position.copy(p); car.rotation.y = headingAt(s); scene.add(car);
  }
  // Sidewalk life belongs to the adjacent local streets, not the shoulder of
  // I-680.  The small figures are deliberately sparse but continuous in the
  // dense Northeast/inner-city section.
  const skin = [0x6b412f, 0x9a6648, 0x4b2b22, 0xb58160];
  for (let i = 0; i < 34; i++) {
    const s = 168000 + ((i * 1127) % 34500), side = i % 2 ? 1 : -1;
    const lat = side * (i % 3 ? 79 : 54);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    const person = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, 1.15, 7), mat(i % 2 ? 0x33384a : 0x705040, .9)); body.position.y = .58;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), mat(skin[i % skin.length], .9)); head.position.y = 1.38;
    person.add(body, head); person.position.copy(p); person.rotation.y = headingAt(s) + (i % 2 ? .7 : -.7); scene.add(person);
  }
}

function buildI680UrbanContext(scene) {
  // The interstate is separated from local streets, but it still runs through
  // a metropolitan fabric: development continues behind the walls instead of
  // disappearing into a generic green strip.
  denseBlocks(scene, 0, 22000, 170, [260, 390, 535], 0x6d6870, 7, 28, 6801);
  denseBlocks(scene, 0, 22000, 125, [72, 138, 220, 330, 470], 0x777177, 6, 24, 6806);
  denseBlocks(scene, 72000, 125000, 220, [250, 390], 0x77706a, 6, 28, 6802);
  denseBlocks(scene, 125000, 166000, 190, [245, 370, 520], 0x9a9588, 8, 34, 6803);
  denseBlocks(scene, 166000, 205000, 115, [230, 355, 500], 0x565057, 8, 38, 6804);
  denseBlocks(scene, 125000, 215000, 105, [88, 175, 285, 410, 570], 0x716a6f, 7, 34, 6805);
  // Reston has no decorative green setback: the closest bands are continuous
  // apartment blocks, warehouses, parking/loading structures, and service
  // buildings pressed into the narrow interstate edge.
  denseBlocks(scene, 125000, 166000, 82, [42, 78, 124, 185, 260, 355], 0x88837d, 6, 24, 6807);
  denseBlocks(scene, 166000, 215000, 68, [40, 74, 112, 158, 218, 292, 380], 0x514b50, 7, 30, 6808);
  // No grassy freeway verge in Jacobs or Reston: the interstate edge is
  // concrete/asphalt, with trees or buildings beginning beyond it.
  buildHardUrbanEdge(scene, 0, 22000, 18);
  // Alternate hard separation with planted urban buffers so the metro feels
  // layered rather than walled continuously from Jacobs to Reston.
  buildTrees(scene, 6812, 0, 22000, 24, 32, 105, 120);
  buildTrees(scene, 6813, 125000, 166000, 24, 38, 120, 105);
  // Inner Reston is already built over: do not insert a green belt between
  // the road and the city. Local streets, rail, buildings and open fencing
  // occupy that narrow edge instead.

  // Crossings and elevated approaches provide the real interstate texture:
  // urban overpasses, ramps, and utility crossings appear at intervals while
  // the main carriageway remains screened at grade.
  [4500, 10500, 16500, 31500, 82000, 90000, 104000, 132000, 149000, 160000, 174000, 182000, 194000, 202000].forEach((s, i) => {
    bridge(scene, s, i % 3 === 0 ? 1050 : 720, i % 3 === 0 ? 12 : 9);
  });

  // Metro-edge walls are taller and more structural than rural fencing, with
  // occasional openings that reveal apartment blocks, factories, and skyline.
  // Jacobs keeps substantial sound-wall coverage, but the long wall is broken
  // up by dense wooded sections and a few open cages so it still feels like a
  // wealthy, lived-in metro rather than one continuous concrete trench.
  buildNoiseWall(scene, 0, 7000, { height: 6.1, seed: 6810, step: 20, margin: 10, gapChance: .12 });
  buildNoiseWall(scene, 9000, 16000, { height: 6.1, seed: 6813, step: 20, margin: 10, gapChance: .16 });
  buildNoiseWall(scene, 19000, 22000, { height: 6.1, seed: 6814, step: 20, margin: 10, gapChance: .12 });
  buildOpenCage(scene, 7000, 9000, 4.4, 8);
  buildOpenCage(scene, 16000, 19000, 4.4, 8);
  // Reston solid walls cover only selected blocks; its remaining edge is open
  // cage fencing or no wall so the city can be read from the interstate.
  buildNoiseWall(scene, 125000, 145000, { height: 5.7, seed: 6811, step: 20, margin: 10, gapChance: .16 });
  buildNoiseWall(scene, 181000, 198000, { height: 5.7, seed: 6812, step: 20, margin: 10, gapChance: .18 });
  buildOpenCage(scene, 145000, 166000, 4.4, 8);
  buildOpenCage(scene, 166000, 181000, 4.2, 7);
  buildOpenCage(scene, 198000, 205000, 4.0, 7);
}

function buildI680RestonRail(scene) {
  // Reston's inner metro has an elevated regional rail spine running beside
  // the viaduct, with stations and trainsets visible between the towers.
  const steel = mat(0x4c5963, .5, .65);
  const rail = mat(0x202a32, .46, .45);
  const line = s => 220 + 6 * Math.sin(s / 4100);
  const railY = s => groundY(s, line(s)) + 10.2;
  scene.add(new THREE.Mesh(buildRibbon(s => line(s) - 2, s => line(s) + 2, railY, s => railY(s) + .8, 90, 166000, 205000), steel));
  const pillarGeo = new THREE.BoxGeometry(1, 1, 1); pillarGeo.translate(0, .5, 0);
  for (let s = 166000; s < 205000; s += 18) {
    const p = posAt(s, line(s), new THREE.Vector3()); p.y = groundY(s, line(s));
    const pier = new THREE.Mesh(pillarGeo, steel); pier.position.copy(p); pier.position.y += 5.1; pier.scale.set(1.3, 10.2, 1.3); pier.rotation.y = headingAt(s); scene.add(pier);
  }
  for (const s of [176000, 192000]) {
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(24, .45, 34), steel);
    const p = posAt(s, line(s), new THREE.Vector3()); canopy.position.set(p.x, railY(s) + .7, p.z); canopy.rotation.y = headingAt(s); scene.add(canopy);
  }
  for (const s of [171000, 187000, 200000]) {
    const train = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 10.5), rail);
      car.position.z = i * 10.9;
      const windows = new THREE.Mesh(new THREE.BoxGeometry(3.56, .58, 8.4), mat(0x4a9fbd, .32, .15));
      windows.position.set(0, .42, i * 10.9);
      train.add(car, windows);
    }
    const p = posAt(s, line(s), new THREE.Vector3()); train.position.set(p.x, railY(s) + 1.4, p.z); train.rotation.y = headingAt(s); scene.add(train);
  }
}

function referenceDressing(scene, registry, kind) {
  // Reuse the same city grammar as the original Libertia Turnpike: Jacobs is
  // wealthy and lower-rise than Reston; Reston is continuous suburban fabric
  // with deeper sprawl; towns are compact clusters, not endless towers.
  const tex = facadeTexture(kind === 'us67' ? 58 : 72); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, roughness: .72 });
  registry.towerMats = (registry.towerMats || []).concat(towerMat);
  const restonSkyline = (seed, s0, s1, step, latMin, latMax, hMin, hMax) =>
    skyline(scene, registry, seed, s0, s1, step, latMin, latMax, hMin, hMax, [-1, 1]);
  if (kind === 'i380') {
    buildSuburb(scene, registry, 0, LOOP_LENGTH, { wall: false });
    deepSprawl(scene, 1380, 0, LOOP_LENGTH, { density: 1.2, towers: false, glowMat: towerMat });
    buildTrees(scene, 1381, 0, LOOP_LENGTH, 32, 150, 420, 90);
    // Reston is urbanized in every direction around the rich ring: keep a
    // continuous suburban/metro carpet behind the foreground landscaping.
    denseBlocks(scene, 0, LOOP_LENGTH, 145, [78, 165, 285, 430, 590], 0x8c8986, 5, 28, 1384);
    // I-380 is the wealthy Reston ring, so downtown's tower wall remains
    // visible beyond the suburban foreground instead of ending at one core
    // interchange.  The second band is taller and closer on the inner arc.
    restonSkyline(1382, 0, LOOP_LENGTH, 6200, 300, 560, 42, 185);
    restonSkyline(1383, 19000, 93000, 4300, 105, 250, 78, 285);
  } else if (kind === 'lb24') {
    buildSuburb(scene, registry, 0, 76000, { wall: false });
    buildSuburb(scene, registry, 112000, LOOP_LENGTH, { wall: false });
    deepSprawl(scene, 2424, 0, 76000, { density: 1.0, towers: true, glowMat: towerMat });
    skyline(scene, registry, 2425, 38000, 76000, 4200, 45, 190, 20, 92, [-1, 1]);
    addSkyGlow(scene, registry, 56000, 0, 1200, 420, 0x8ac8ff);
  } else if (kind === 'us67') {
    // I-680 does not front Jacobs neighborhoods.  A sound wall and wooded
    // setback hide the closest frontage while the skyline remains visible
    // above it and farther across the metro.
    // Keep the farm and rural-town sections open.  Interstate separation is
    // introduced only where I-680 enters Jacobs and the Reston urban fabric;
    // fields and distant town development remain visible in the middle miles.
    buildTrees(scene, 6801, 0, LOOP_LENGTH, 28, 34, 115, 105);
    skyline(scene, registry, 6701, 0, 22000, 2400, 250, 560, 16, 72, [-1, 1]);
    addSkyGlow(scene, registry, 8500, 0, 1050, 360, 0x8ac8ff);
    for (const s of [76000, 93000, 110000]) buildSuburb(scene, registry, s - 1800, s + 1800, { wall: false });
    buildSuburb(scene, registry, 125000, 166000, { wall: false });
    deepSprawl(scene, 6702, 125000, 166000, { density: .92, towers: false, glowMat: towerMat });
    // I-680 crosses the whole Reston side of the metro.  Keep a broad,
    // distant Reston skyline visible from the affluent east and again as the
    // Northeast district approaches downtown, with lower foreground blocks
    // preserving the wealth contrast.
    restonSkyline(6703, 125000, 205000, 3600, 250, 520, 48, 230);
    restonSkyline(6704, 145000, 166000, 2500, 85, 220, 82, 310);
    // Downtown Reston on I-680 uses the same close, tall core proportions as
    // the original Libertia Turnpike rather than a small generic town cluster.
    restonSkyline(6705, 205000, 215000, 1800, 24, 105, 120, 390);
    restonSkyline(6706, 198000, 215000, 3000, 95, 300, 58, 205);
  }
}

function buildUS67RoadQuality(scene, registry) {
  const patchMat = mat(0x1b1b1c, 1), faded = mat(0x77705e, .98), rust = mat(0x6b4030, .9);
  // Repeated asphalt patches, uneven shoulder seams, and faded edge strips
  // make the Northeast section feel old before the buildings even arrive.
  for (let s = 167000, i = 0; s < 205000; s += 430, i++) {
    for (const side of [-1, 1]) {
      const lat = side * (pavedHalfAt(s) - 1.2);
      scene.add(new THREE.Mesh(buildRibbon(x => side < 0 ? lat - 1.3 : lat, x => side < 0 ? lat : lat + 1.3, .035, .035, 4, s, s + 190), patchMat));
      if (i % 3 === 0) {
        const p = posAt(s + 110, side * (pavedHalfAt(s) + 3.5), new THREE.Vector3()); p.y = groundY(s, 0) + .04;
        const pothole = new THREE.Mesh(new THREE.CylinderGeometry(1.0 + (i % 4) * .25, 1.2, .035, 8), patchMat); pothole.position.copy(p); scene.add(pothole);
      }
    }
  }
  sign(scene, registry, 167000, ['NORTHEAST RESTON', 'ROUGH ROAD · DRIVE CAREFULLY'], '#542d2d');
  sign(scene, registry, 198800, ['CITY MAINTENANCE DISTRICT', 'PATCHING IN PROGRESS'], '#4c342c');
}

function roadside(scene, kind, s0, s1) {
  const rand = n => (Math.sin(n * 9283.17) * 43758.5) % 1;
  const body = new THREE.BoxGeometry(1, 1, 1); body.translate(0, .5, 0);
  const buildings = [], trees = [];
  for (let s = s0, i = 0; s < s1; s += kind === 'i380' ? 110 : 175, i++) {
    for (const side of [-1, 1]) {
      const r = Math.abs(rand(i * 7 + side * 3));
      const baseLat = kind === 'us67' ? 105 : 34;
      const lat = side * (baseLat + r * (kind === 'i980' ? 180 : kind === 'us67' ? 330 : 280));
      const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      if (kind === 'i980') buildings.push({ pos: p, rot: headingAt(s), sx: 15 + r * 18, sy: 5 + r * 18, sz: 12 + r * 20 });
      else if (kind === 'i380') buildings.push({ pos: p, rot: headingAt(s), sx: 14 + r * 18, sy: 5 + r * 18, sz: 16 + r * 20 });
      else if (kind === 'lb24') buildings.push({ pos: p, rot: headingAt(s), sx: 16 + r * 20, sy: 12 + r * 42, sz: 14 + r * 22 });
      else if (kind === 'us67' && s > 165000) buildings.push({ pos: p, rot: headingAt(s), sx: 18 + r * 20, sy: 8 + r * 42, sz: 18 + r * 22 });
      if (kind === 'i380' || kind === 'i980' || kind === 'lb24') trees.push({ pos: p.clone().setY(p.y), rot: 0, sx: 2 + r * 2, sy: 9 + r * 12, sz: 2 + r * 2 });
    }
  }
  if (buildings.length) {
    const mesh = new THREE.InstancedMesh(body, mat(kind === 'i980' ? 0x564b4d : 0x9b9a9a), buildings.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    buildings.forEach((b, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot); m.compose(b.pos, q, v.set(b.sx, b.sy, b.sz)); mesh.setMatrixAt(i, m); });
    scene.add(mesh);
  }
  if (trees.length) {
    const mesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mat(0x28523a), trees.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    trees.forEach((t, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot); m.compose(t.pos, q, v.set(t.sx, t.sy, t.sz)); mesh.setMatrixAt(i, m); });
    scene.add(mesh);
  }
}

export function buildUS67CityStreets(scene, registry) {
  const asphalt = mat(0x343437, .96), sidewalk = mat(0xaaa9a0, .92), storefront = mat(0x876b5b, .9);
  const signals = [], crossTraffic = [];
  // Town segments use the highway as a surface arterial: blocks, sidewalks,
  // cross streets and signal heads sit directly against the route.
  for (const s of [76000, 93000, 145000, 174000, 190000, 203500]) {
    const p = posAt(s, 0, new THREE.Vector3());
    scene.add(new THREE.Mesh(buildRibbon(x => x - 38, x => x + 38, .02, .02, 4, s - 180, s + 180), asphalt));
    for (const side of [-1, 1]) {
      scene.add(new THREE.Mesh(buildRibbon(x => side * (pavedHalfAt(x) + 2), x => side * (pavedHalfAt(x) + 5.2), .12, .12, 4, s - 180, s + 180), sidewalk));
      for (let t = s - 130; t <= s + 130; t += 65) {
        const q = posAt(t, side * (pavedHalfAt(t) + 18), new THREE.Vector3()); q.y = groundY(t, side * 18);
        const shop = new THREE.Mesh(new THREE.BoxGeometry(16, 7 + (t % 3) * 2, 20), storefront); shop.position.copy(q); shop.position.y += shop.geometry.parameters.height / 2; shop.rotation.y = headingAt(t); scene.add(shop);
      }
    }
    // four-arm-looking signal: two roadside heads facing the route.
    for (const dir of [-1, 1]) {
      const q = posAt(s - dir * 8, dir * (pavedHalfAt(s) + 2), new THREE.Vector3()); q.y = groundY(s, 0);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.14, .18, 5.8, 8), mat(0x303337, .65, .35)); pole.position.copy(q); pole.position.y += 2.9; scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(.65, 1.6, .42), mat(0x181a1d, .8)); head.position.copy(q); head.position.y += 5.6; head.rotation.y = headingAt(s) + (dir > 0 ? Math.PI : 0); scene.add(head);
      const lamps = ['red', 'yellow', 'green'].map((name, i) => {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x111111, emissiveIntensity: 1 }));
        lamp.position.set(head.position.x, head.position.y + .48 - i * .42, head.position.z + .25); scene.add(lamp); return lamp.material;
      });
      signals.push({ lamps, phase: (s % 67) / 67 * 16 });
    }
    for (let i = 0; i < 2; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.2), mat(i ? 0x9a3027 : 0x2f6ca7, .65, .25));
      scene.add(car); crossTraffic.push({ car, s, phase: i * 8 });
    }
    // Signal heads and cross traffic mark these intersections; avoid adding a
    // signboard at every one of them.
  }
  sign(scene, registry, 125500, ['ENTERING EASTERN RESTON', 'SPEED LIMIT 45'], '#075b3d');
  sign(scene, registry, 205200, ['DOWNTOWN RESTON', 'SIGNALS · CROSSWALKS · LOCAL ACCESS'], '#123a7a');
  // Northeast Reston has a dense, lived-in community signscape: faith
  // institutions, African American civic life, immigrant-owned businesses,
  // refugee services, and ordinary local campaign posters share the frontage.
  const northeastSigns = [
    [167200, ['MASJID AL-NUR', 'NEXT EXIT · FRIDAY PRAYER'], '#174e63'],
    [178600, ['COMMUNITY POWER', 'VOTE · ORGANIZE · KEEP RESTON PUBLIC'], '#7b2525'],
    [186200, ['ISLAMIC CULTURAL CENTER', 'SCHOOL · LIBRARY · SERVICES'], '#176b4d'],
    [197600, ['HALAL GROCERIES · HAIR · RADIO', 'NORTHEAST RESTON'], '#244e72'],
  ];
  northeastSigns.forEach(([s, lines, color], i) => sign(scene, registry, s, lines, color, i % 2 ? 0 : -2));
  return { signals, crossTraffic };
}

function buildUS67WealthContrast(scene, registry) {
  const richMat = mat(0xd6d0bd, .72), richRoof = mat(0x394b58, .72), decayMat = mat(0x514b4b, .96), rustMat = mat(0x6e3d2e, .9);
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, .5, 0);
  const rich = [], poor = [], factories = [];
  const addRow = (arr, s0, s1, step, seed, fn, baseLat = 110, spread = 250) => {
    for (let s = s0, i = 0; s < s1; s += step, i++) for (const side of [-1, 1]) {
      const r = Math.abs(Math.sin(seed + i * 11.7 + side));
      const lat = side * (baseLat + r * spread); const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
      arr.push(fn(p, s, lat, r));
    }
  };
  // Eastern suburbs: clean setbacks, larger houses, manicured green belts,
  // retaining walls and a conspicuous lack of roadside clutter.
  addRow(rich, 125000, 166000, 170, 19, (pos, s, lat, r) => ({ pos, rot: headingAt(s), sx: 17 + r * 14, sy: 8 + r * 13, sz: 18 + r * 14 }), 62, 170);
  const richMesh = new THREE.InstancedMesh(box, richMat, rich.length), richRoofMesh = new THREE.InstancedMesh(box, richRoof, rich.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  rich.forEach((b, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot); m.compose(b.pos, q, sc.set(b.sx, b.sy, b.sz)); richMesh.setMatrixAt(i, m); m.compose(b.pos.clone().setY(b.pos.y + b.sy), q, sc.set(b.sx * 1.03, 1.1, b.sz * 1.03)); richRoofMesh.setMatrixAt(i, m); });
  scene.add(richMesh, richRoofMesh);
  // The two Reston halves are separated by a broad preserved park. US-67
  // rises onto a long bridge here, with uninterrupted forest below and no
  // buildings in the sightline until the Northeast district resumes.
  bridge(scene, 165500, 2200, 13);
  const parkTrees = [];
  for (let s = 164300, i = 0; s < 166700; s += 75, i++) for (const side of [-1, 1]) {
    const r = Math.abs(Math.sin(i * 17.31 + side * 4.7));
    const lat = side * (28 + r * 210);
    const p = posAt(s, lat, new THREE.Vector3()); p.y = groundY(s, lat);
    parkTrees.push({ pos: p, scale: 5 + r * 7 });
  }
  const parkMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), mat(0x244d35, .98), parkTrees.length);
  parkTrees.forEach((tree, i) => { m.compose(tree.pos, q, sc.set(tree.scale, tree.scale * 2.2, tree.scale)); parkMesh.setMatrixAt(i, m); });
  scene.add(parkMesh);
  sign(scene, registry, 164200, ['RESTON GREENBELT', 'BRIDGE OVER PARK · 2 MILES'], '#2e6946');
  sign(scene, registry, 166700, ['NORTHEAST RESTON', 'CITY STREETS AHEAD'], '#7a2727');
  for (const s of [128000, 162000]) {
    const wall = new THREE.Mesh(buildRibbon(x => -pavedHalfAt(x) - 18, x => -pavedHalfAt(x) - 17.2, .4, 1.8, 6, s, s + 780), richRoof); scene.add(wall);
    sign(scene, registry, s, ['EASTERN RESTON', 'ESTATES · SCHOOLS · PARKLAND'], '#315f45', 0);
  }

  // Northeast Reston: compressed blocks, obsolete industrial frontage,
  // patched-looking dark setbacks, rusted factories, and almost no empty
  // landscaped horizon. Graffiti and community posters fill the walls.
  addRow(poor, 166000, 205000, 95, 71, (pos, s, lat, r) => ({ pos, rot: headingAt(s) + (r - .5) * .15, sx: 12 + r * 18, sy: 4 + r * 16, sz: 12 + r * 18 }), 48, 155);
  const poorMesh = new THREE.InstancedMesh(box, decayMat, poor.length);
  poor.forEach((b, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot); m.compose(b.pos, q, sc.set(b.sx, b.sy, b.sz)); poorMesh.setMatrixAt(i, m); });
  scene.add(poorMesh);
  addRow(factories, 169000, 201000, 620, 91, (pos, s, lat, r) => ({ pos, rot: headingAt(s), sx: 28 + r * 30, sy: 16 + r * 26, sz: 26 + r * 34 }), 105, 150);
  const factoryMesh = new THREE.InstancedMesh(box, rustMat, factories.length);
  factories.forEach((b, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot); m.compose(b.pos, q, sc.set(b.sx, b.sy, b.sz)); factoryMesh.setMatrixAt(i, m); });
  scene.add(factoryMesh);
  for (const s of [168000, 172500, 177000, 181500, 186000, 190500, 195000, 199500]) {
    for (const lat of [-78, 78]) sign(scene, registry, s, [
      ['GRAFFITI DISTRICT', 'NORTHEAST RESTON'][s % 2],
      ['NO EVICTIONS', 'COMMUNITY RADIO', 'WORKERS ORGANIZE', 'RESTON NEEDS REPAIRS'][Math.floor(s / 4500) % 4],
    ], '#282226', lat);
  }
  // Tall, thin smokestacks make the industrial belt read from a distance.
  for (const s of [171000, 183000, 196000]) for (const side of [-1, 1]) {
    const p = posAt(s, side * 135, new THREE.Vector3()); p.y = groundY(s, side * 135);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.1, 38, 10), rustMat); stack.position.copy(p); stack.position.y += 19; scene.add(stack);
  }
  sign(scene, registry, 166200, ['RESTON CITY LINE', 'EASTERN SUBURBS →  |  NORTHEAST DISTRICT ←'], '#7a2727');
}

export function updateUS67CityStreets(city, time) {
  if (!city) return;
  for (const signal of city.signals) {
    const phase = (time + signal.phase) % 16;
    const active = phase < 8 ? 2 : phase < 10 ? 1 : 0;
    signal.lamps.forEach((lamp, i) => { const on = i === active; lamp.emissive.set(on ? [0xff2020, 0xffb300, 0x20e050][i] : 0x111111); lamp.emissiveIntensity = on ? 2.4 : 1; });
  }
  for (const vehicle of city.crossTraffic) {
    const lat = ((time * 7 + vehicle.phase * 14) % 72) - 36;
    const p = posAt(vehicle.s, lat, new THREE.Vector3()); p.y = groundY(vehicle.s, lat) + .65; vehicle.car.position.copy(p); vehicle.car.rotation.y = headingAt(vehicle.s) + Math.PI / 2;
  }
}

export function buildLibertiaRouteEnhancements(scene, registry) {
  // More ordinary infrastructure, plus construction, so Reston/Jacobs do not
  // read as one repeated tower prefab.
  [257000, 287000, 332000, 365000, 440000, 512000, 596000, 675000, 718000].forEach(s => bridge(scene, s, 620, 6 + (s % 3)));
  [302000, 347000, 488000, 650000].forEach(s => tunnel(scene, registry, s, 520));
  [276000, 321000, 415000, 562000, 694000].forEach(s => construction(scene, registry, s, 'LIBERTIA ROAD WORK'));
  sign(scene, registry, 250000, ['RESTON LOCAL  3', 'EXPRESS  2  ·  KEEP RIGHT'], '#4b443c');
  sign(scene, registry, 632000, ['JACOBS METRO', 'BRIDGES · TUNNELS · RIVERFRONT'], '#123a7a');
}

export function buildLibertiaRoute(scene, registry, kind) {
  const ranges = {
    i380: [0, LOOP_LENGTH], i980: [0, LOOP_LENGTH], lb24: [0, LOOP_LENGTH], us67: [0, LOOP_LENGTH],
  }[kind];
  roadside(scene, kind, ...ranges);
  referenceDressing(scene, registry, kind);
  if (kind === 'i380') {
    // Continuous suburban frontage and NJ-style sound walls keep the loop
    // from opening into vacant terrain around the rich belt.
    buildNoiseWall(scene, 0, LOOP_LENGTH, { height: 4.4, seed: 380, step: 22, margin: 5, gapChance: 0.02 });
  }
  if (kind === 'i980') farmFields(scene, 92000, 142000);
  if (kind === 'us67') {
    farmFields(scene, 22000, 72000);
    buildCorporateFarmBelt(scene);
  }
  if (kind === 'us67') buildUS67RoadQuality(scene, registry);
  if (kind === 'i980') denseBlocks(scene, 0, 92000, 150, [45, 105, 180], 0x66565b, 4, 18, 980);
  if (kind === 'us67') {
    denseBlocks(scene, 76000, 125000, 180, [95, 170, 270], 0x786d64, 4, 15, 670);
    denseBlocks(scene, 166000, 205000, 70, [95, 180, 290, 390], 0x50494c, 4, 18, 672);
  }
  if (kind === 'us67') buildUS67WealthContrast(scene, registry);
  if (kind === 'us67') {
    buildI680UrbanContext(scene);
    buildI680OverheadTrains(scene);
  }
  const bridges = kind === 'i380' ? [16500, 38500, 70500, 104000] : kind === 'i980' ? [27500, 101000, 151000] : kind === 'lb24' ? [12000, 48000, 84000, 126000] : [9000, 26000, 78000, 111000, 150000, 158000, 188000];
  bridges.forEach(s => bridge(scene, s, kind === 'i980' ? 1000 : 700, kind === 'i980' ? 5 : 8));
  const tunnels = kind === 'us67' ? [208000] : kind === 'lb24' ? [62000] : [];
  tunnels.forEach(s => tunnel(scene, registry, s, kind === 'us67' ? 900 : 520));
  const works = kind === 'i380' ? [18500, 49200, 88500] : kind === 'i980' ? [36000, 76000, 132000] : kind === 'lb24' ? [24000, 70500, 101000] : [2000, 7000, 13000, 19000, 33000, 136000, 178000];
  works.forEach(s => construction(scene, registry, s, kind === 'us67' ? 'I-680 WORK ZONE' : 'CONSTRUCTION AHEAD'));
  const titles = {
    i380: ['I-380 SUBURBAN LOOP', 'RESTON RICH BELT', '3 LANES · NJ-STYLE WALLS'],
    i980: ['I-980 RURAL LOOP', 'LOWER-INCOME OUTSKIRTS', 'WIND FARMS · FLATLANDS'],
    lb24: ['LB-24 JACOBS TURNPIKE', 'NO TRUCKS', 'J-BUS WORKER SERVICE'],
    us67: ['I-680', 'NON-TOLLED ROUTE TO RESTON', '70 MPH EXCEPT CITY / WORK ZONES'],
  }[kind];
  const routeSignPositions = kind === 'us67'
    ? [0, Math.round(LOOP_LENGTH * .62)]
    : [0, Math.round(LOOP_LENGTH * .28), Math.round(LOOP_LENGTH * .62)];
  routeSignPositions.forEach((s, i) => sign(scene, registry, s + 500, titles, kind === 'i980' ? '#382d37' : '#075b3d', i % 2 ? 0 : -2));
  if (kind === 'us67') {
    sign(scene, registry, 22000, ['I-680 CORPORATE FARM CORRIDOR', 'SPEED LIMIT 70'], '#1f5a36');
    sign(scene, registry, 72000, ['RURAL TOWN INTERCHANGE', 'SPEED LIMIT 70'], '#315a34');
    sign(scene, registry, 125000, ['EASTERN RESTON SUBURBS', 'SPEED LIMIT 70'], '#315f45');
    sign(scene, registry, 167000, ['NORTHEAST RESTON', 'SPEED LIMIT 70 · WORK ZONES AHEAD'], '#542d2d');
    sign(scene, registry, 205000, ['DOWNTOWN RESTON TUNNEL', 'SPEED LIMIT 25 · NEXT SIGNAL'], '#26333d');
    sign(scene, registry, 1800, ['DOWNTOWN JACOBS', 'I-680 · LOCAL ACCESS'], '#18415b', 2);
    sign(scene, registry, 20200, ['DOWNTOWN CONSTRUCTION', 'FOLLOW DETOUR SIGNS'], '#18415b', -2);
  }
}
