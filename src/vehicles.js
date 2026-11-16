import * as THREE from 'three';
import { MAP, MPH, EURO, UK } from './config.js';
import { registerEnvMaterial } from './sky.js';

// Shared materials — one headlight/taillight material for the whole fleet so
// night lighting is a couple of uniform writes, not hundreds.
export const headlightMat = new THREE.MeshStandardMaterial({
  color: 0xe8e8dc, emissive: 0xfff6d8, emissiveIntensity: 0.05,
});
export const taillightMat = new THREE.MeshStandardMaterial({
  color: 0x881111, emissive: 0xff2211, emissiveIntensity: 0.25,
});

// Additive red glow sprite hung on each brake lamp: emissive alone can't make
// a 0.14 m box read at distance, a camera-facing halo can. One shared texture
// and material for the whole fleet; callers toggle sprite.visible / scale.
let _brakeGlowMat = null;
export function makeBrakeGlow() {
  if (!_brakeGlowMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,140,110,1)');
    r.addColorStop(0.35, 'rgba(255,40,20,.85)');
    r.addColorStop(1, 'rgba(255,20,10,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _brakeGlowMat = new THREE.SpriteMaterial({
      map: tex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, opacity: 0.9,
    });
  }
  const sp = new THREE.Sprite(_brakeGlowMat);
  sp.visible = false;
  sp.scale.set(0.9, 0.9, 1);
  return sp;
}

// White-blue halo for high beams, same scheme as the brake glow
let _beamGlowMat = null;
export function makeBeamGlow() {
  if (!_beamGlowMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(210,225,255,.9)');
    r.addColorStop(1, 'rgba(160,190,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _beamGlowMat = new THREE.SpriteMaterial({
      map: tex, blending: THREE.AdditiveBlending, depthWrite: false,
      transparent: true, opacity: 0.95,
    });
  }
  const sp = new THREE.Sprite(_beamGlowMat);
  sp.visible = false;
  sp.scale.set(1.1, 1.1, 1);
  return sp;
}
const glassMat = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
  color: 0x11202e, roughness: 0.05, metalness: 0.65, envMapIntensity: 1.3,
}));
const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });

// wheel face: dark tire ring around a 5-spoke alloy, so wheels visibly spin
function wheelFaceTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#101010'; g.fillRect(0, 0, 128, 128);
  g.translate(64, 64);
  g.fillStyle = '#3c3f44';
  g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8f959c';
  for (let i = 0; i < 5; i++) {
    g.rotate((Math.PI * 2) / 5);
    g.fillRect(-6, -40, 12, 34);
  }
  g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const wheelFaceMat = new THREE.MeshStandardMaterial({
  map: wheelFaceTexture(), roughness: 0.55, metalness: 0.5,
});
export const WHEEL_MATS = [tireMat, wheelFaceMat, wheelFaceMat]; // side, cap, cap

// soft dark blob under every vehicle — fake ambient occlusion that keeps cars
// visually glued to the road even when the sun shadow is off (overcast, rain)
let _blobMat = null, _blobGeo = null;
export function contactShadow(L, W) {
  if (!_blobMat) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.5)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    _blobMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.4,
      depthWrite: false,
    });
    _blobGeo = new THREE.PlaneGeometry(1, 1);
    _blobGeo.rotateX(-Math.PI / 2);
  }
  const m = new THREE.Mesh(_blobGeo, _blobMat);
  m.scale.set(W * 1.35, 1, L * 1.1);
  m.position.y = 0.05;
  m.renderOrder = 2;
  return m;
}

export function setNightLights(nightFactor) {
  headlightMat.emissiveIntensity = 0.05 + nightFactor * 4.0;
  taillightMat.emissiveIntensity = 0.25 + nightFactor * 2.2;
  // rear plates catch their plate-lamp after dark — a soft even glow, like real life
  for (const m of plateMatCache.values()) m.emissiveIntensity = nightFactor * 0.45;
}

// Automotive paint: metallic base under a glossy clearcoat, reflecting the
// live sky env map — the Forza two-layer look.
const bodyMatCache = new Map();
function bodyMat(hex, metal = 0.6) {
  const key = hex + '_' + metal;
  if (!bodyMatCache.has(key)) {
    bodyMatCache.set(key, registerEnvMaterial(new THREE.MeshPhysicalMaterial({
      color: hex, roughness: 0.42, metalness: metal,
      clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 0.9,
    })));
  }
  return bodyMatCache.get(key);
}

const geoCache = new Map();
function box(w, h, d) {
  const key = `b${w}|${h}|${d}`;
  if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(key);
}
// Three-ring chamfered prism for passenger-car bodywork. Unlike BoxGeometry,
// this gives cars sloped noses/tails, tapered shoulders and readable highlight
// breaks while staying cheap enough for a full traffic field.
function vehicleShell(w, h, d, topInset = 0.055, frontSlope = 0.055, rearSlope = 0.04) {
  const key = `s${w}|${h}|${d}|${topInset}|${frontSlope}|${rearSlope}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const rings = [
    { y: -h / 2, x: w / 2, front: d / 2, rear: -d / 2 },
    { y: h * 0.12, x: w / 2, front: d / 2 - d * 0.012, rear: -d / 2 + d * 0.01 },
    { y: h / 2, x: w * (0.5 - topInset), front: d / 2 - d * frontSlope, rear: -d / 2 + d * rearSlope },
  ];
  const positions = [];
  for (const r of rings) positions.push(
    -r.x, r.y, r.front, r.x, r.y, r.front,
    r.x, r.y, r.rear, -r.x, r.y, r.rear,
  );
  const indices = [0, 2, 1, 0, 3, 2];
  const bridge = (a, b) => indices.push(
    a, a + 1, b + 1, a, b + 1, b,
    a + 1, a + 2, b + 2, a + 1, b + 2, b + 1,
    a + 2, a + 3, b + 3, a + 2, b + 3, b + 2,
    a + 3, a, b, a + 3, b, b + 3,
  );
  bridge(0, 4); bridge(4, 8);
  indices.push(8, 9, 10, 8, 10, 11);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  geoCache.set(key, geo);
  return geo;
}
const carBody = (w, h, d) => vehicleShell(w, h, d);
const carCabin = (w, h, d) => vehicleShell(w, h, d, 0.11, 0.12, 0.1);
function wheelGeo(r, w) {
  const key = `w${r}|${w}`;
  if (!geoCache.has(key)) {
    const g = new THREE.CylinderGeometry(r, r, w, 10);
    g.rotateZ(Math.PI / 2);
    geoCache.set(key, g);
  }
  return geoCache.get(key);
}

function addWheels(group, r, width, halfTrack, zs) {
  const list = group.userData.wheels ??= [];
  for (const z of zs) {
    for (const x of [-halfTrack, halfTrack]) {
      const wh = new THREE.Mesh(wheelGeo(r, width), WHEEL_MATS);
      wh.position.set(x, r, z);
      wh.userData.r = r;
      group.add(wh);
      list.push(wh);
    }
  }
}

function addLights(group, width, frontZ, rearZ, y) {
  for (const x of [-width * 0.34, width * 0.34]) {
    const h = new THREE.Mesh(box(width * 0.2, 0.16, 0.06), headlightMat);
    h.position.set(x, y, frontZ);
    group.add(h);
    const t = new THREE.Mesh(box(width * 0.22, 0.14, 0.06), taillightMat);
    t.position.set(x, y, rearZ);
    group.add(t);
  }
}

// Vehicles face +z (direction of travel).

// --- accessory bits shared across body styles -------------------------------
const roofBoxMat = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.5 });
const railMat2 = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.4, metalness: 0.6 });
const chromeTrimMat = new THREE.MeshStandardMaterial({ color: 0xc8cdd2, roughness: 0.24, metalness: 0.9 });
const US_VISUAL_FLEET = !EURO && !UK && ![
  'india', 'nh48', 'andheri', 'aundh', 'newdelhi', 'delhikolkata',
].includes(MAP);
function addRoofBox(g, roofY, L) {
  const b = new THREE.Mesh(box(0.78, 0.32, 1.9), roofBoxMat);
  b.position.set(0, roofY + 0.18, -L * 0.05);
  g.add(b);
}
function addRoofRails(g, roofY, W, len, z = 0) {
  for (const x of [-W * 0.36, W * 0.36]) {
    const r = new THREE.Mesh(box(0.07, 0.09, len), railMat2);
    r.position.set(x, roofY + 0.05, z);
    g.add(r);
  }
}
function addSpoiler(g, color, W, H, rearZ) {
  const s = new THREE.Mesh(box(W * 0.82, 0.07, 0.34), bodyMat(color));
  s.position.set(0, 0.3 + H * 0.62, rearZ + 0.12);
  g.add(s);
}

function makeCar(color, L, W, H, cabin = 0.55, rand = null) {
  const g = new THREE.Group();
  const mat = bodyMat(color);
  const body = new THREE.Mesh(carBody(W, H * 0.52, L), mat);
  body.position.y = 0.3 + H * 0.26;
  body.castShadow = true;
  g.add(body);
  const roofY = 0.3 + H * 0.52 + H * 0.4;
  const cab = new THREE.Mesh(carCabin(W * 0.88, H * 0.42, L * cabin), glassMat);
  cab.position.set(0, 0.3 + H * 0.52 + H * 0.2, -L * 0.06);
  g.add(cab);
  addWheels(g, 0.33, 0.24, W / 2 - 0.1, [L * 0.32, -L * 0.32]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.3 + H * 0.3);
  // The common sedan/hatch/SUV pool is most of what the player sees. Give it
  // several American-market fascias and roof/lower-body treatments instead of
  // making every category the same box at a different scale.
  if (rand && US_VISUAL_FLEET) {
    const fascia = rand();
    const grilleMat = fascia < 0.33 ? chromeTrimMat : fascia < 0.72 ? trimMat : mat;
    const grille = new THREE.Mesh(box(W * (fascia < 0.33 ? 0.48 : 0.7), H * 0.13, 0.045), grilleMat);
    grille.position.set(0, 0.3 + H * 0.28, L / 2 + 0.035); g.add(grille);
    if (H > 1.62) {
      const frontClad = new THREE.Mesh(box(W * 0.88, H * 0.11, 0.08), trimMat);
      frontClad.position.set(0, 0.34, L / 2 + 0.045); g.add(frontClad);
      for (const x of [-W * 0.47, W * 0.47]) {
        const rocker = new THREE.Mesh(box(0.06, H * 0.14, L * 0.72), trimMat);
        rocker.position.set(x, 0.36, -L * 0.04); g.add(rocker);
      }
    } else if (rand() < 0.28) {
      const pano = new THREE.Mesh(box(W * 0.58, 0.03, L * 0.3), glassMat);
      pano.position.set(0, roofY + 0.025, -L * 0.08); g.add(pano);
    }
    if (rand() < 0.18) {
      const roof = new THREE.Mesh(box(W * 0.89, 0.055, L * cabin * 0.9),
        bodyMat(rand() < 0.62 ? 0x17191c : 0xe5e7e9, 0.45));
      roof.position.set(0, roofY + 0.03, -L * 0.06); g.add(roof);
    }
  }
  // the odd accessory so no two cars read identical
  if (rand) {
    if (H > 1.6 && rand() < 0.3) addRoofRails(g, roofY, W, L * cabin * 0.9, -L * 0.06);
    if (H > 1.6 && rand() < 0.12) addRoofBox(g, roofY, L);
    if (H <= 1.6 && rand() < 0.07) addSpoiler(g, color, W, H, -L / 2 + 0.1);
  }
  return g;
}

// Tesla (Model 3/Y-ish): sleek fastback with a long panoramic glass canopy,
// no grille line to draw, full-width tail light bar. Real-world palette —
// white heavy, then black/gray/blue/red.
const TESLA_COLORS = [0xf2f3f5, 0xf2f3f5, 0xf2f3f5, 0x1b1d1f, 0x1b1d1f, 0x8e9399, 0x2a4f8f, 0xa32734];
function makeTesla(rand) {
  const color = TESLA_COLORS[(rand() * TESLA_COLORS.length) | 0];
  const L = 4.7, W = 1.85, H = 1.44;
  const g = new THREE.Group();
  const body = new THREE.Mesh(vehicleShell(W, H * 0.52, L, 0.07, 0.1, 0.06), bodyMat(color, 0.18));
  body.position.y = 0.3 + H * 0.26;
  body.castShadow = true;
  g.add(body);
  // one long glass canopy nose-to-tail instead of a boxed cabin
  const cab = new THREE.Mesh(carCabin(W * 0.88, H * 0.4, L * 0.74), glassMat);
  cab.position.set(0, 0.3 + H * 0.52 + H * 0.19, -L * 0.05);
  g.add(cab);
  addWheels(g, 0.33, 0.24, W / 2 - 0.1, [L * 0.33, -L * 0.33]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.3 + H * 0.3);
  // full-width tail light bar
  const bar = new THREE.Mesh(box(W * 0.86, 0.07, 0.05), taillightMat);
  bar.position.set(0, 0.3 + H * 0.42, -L / 2 - 0.02);
  g.add(bar);
  return g;
}

// long-roof wagon: the cabin glass runs almost to the tailgate, roof rails
function makeWagon(color, L, W, H, rand) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(carBody(W, H * 0.52, L), bodyMat(color));
  body.position.y = 0.3 + H * 0.26;
  body.castShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(carCabin(W * 0.88, H * 0.4, L * 0.62), glassMat);
  cab.position.set(0, 0.3 + H * 0.52 + H * 0.19, -L * 0.13);
  g.add(cab);
  addRoofRails(g, 0.3 + H * 0.52 + H * 0.38, W, L * 0.56, -L * 0.13);
  if (rand && rand() < 0.2) addRoofBox(g, 0.3 + H * 0.52 + H * 0.38, L);
  addWheels(g, 0.33, 0.24, W / 2 - 0.1, [L * 0.33, -L * 0.32]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.3 + H * 0.3);
  return g;
}

// one-box minivan: short hood, tall rounded-off cabin the full length
function makeMinivan(color, L, W, H) {
  const g = new THREE.Group();
  const mat = bodyMat(color, 0.4);
  const body = new THREE.Mesh(vehicleShell(W, H * 0.5, L, 0.045, 0.035, 0.03), mat);
  body.position.y = 0.32 + H * 0.25;
  body.castShadow = true;
  g.add(body);
  const upper = new THREE.Mesh(vehicleShell(W * 0.94, H * 0.42, L * 0.74, 0.08, 0.1, 0.06), mat);
  upper.position.set(0, 0.32 + H * 0.5 + H * 0.21, -L * 0.1);
  g.add(upper);
  const glass = new THREE.Mesh(carCabin(W * 0.96, H * 0.2, L * 0.72), glassMat);
  glass.position.set(0, 0.32 + H * 0.52, -L * 0.1);
  g.add(glass);
  addWheels(g, 0.34, 0.24, W / 2 - 0.1, [L * 0.33, -L * 0.32]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.32 + H * 0.3);
  return g;
}

// low coupe: chopped cabin set back, wide stance
function makeCoupe(color, L, W, H, rand) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(vehicleShell(W, H * 0.5, L, 0.08, 0.09, 0.06), bodyMat(color));
  body.position.y = 0.28 + H * 0.25;
  body.castShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(carCabin(W * 0.84, H * 0.36, L * 0.38), glassMat);
  cab.position.set(0, 0.28 + H * 0.5 + H * 0.17, -L * 0.12);
  g.add(cab);
  if (rand && rand() < 0.35) addSpoiler(g, color, W, H * 0.95, -L / 2 + 0.1);
  addWheels(g, 0.32, 0.26, W / 2 - 0.09, [L * 0.32, -L * 0.33]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.28 + H * 0.28);
  return g;
}

// sports car: very low, very wide, always winged
function makeSports(color, L, W, H) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(vehicleShell(W, H * 0.55, L, 0.1, 0.12, 0.09), bodyMat(color, 0.85));
  body.position.y = 0.24 + H * 0.28;
  body.castShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(carCabin(W * 0.78, H * 0.34, L * 0.34), glassMat);
  cab.position.set(0, 0.24 + H * 0.55 + H * 0.15, -L * 0.1);
  g.add(cab);
  const wing = new THREE.Mesh(box(W * 0.9, 0.06, 0.36), bodyMat(color, 0.85));
  wing.position.set(0, 0.24 + H * 0.85, -L / 2 + 0.14);
  g.add(wing);
  addWheels(g, 0.31, 0.3, W / 2 - 0.08, [L * 0.33, -L * 0.34]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.24 + H * 0.3);
  return g;
}

// American compact/midsize crossover: short hood, long passenger cell and
// black lower cladding.  Roof treatment varies between rails, a panoramic
// glass panel and a contrasting roof, so repeated crossovers do not clone.
function makeCrossover(color, L, W, H, rand) {
  const g = new THREE.Group();
  const mat = bodyMat(color, 0.42);
  const lower = new THREE.Mesh(box(W, H * 0.34, L), trimMat);
  lower.position.y = 0.34 + H * 0.17;
  lower.castShadow = true;
  g.add(lower);
  const body = new THREE.Mesh(box(W * 0.97, H * 0.34, L * 0.96), mat);
  body.position.set(0, 0.34 + H * 0.36, -L * 0.01);
  body.castShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(box(W * 0.88, H * 0.36, L * (0.58 + rand() * 0.06)), glassMat);
  cab.position.set(0, 0.34 + H * 0.69, -L * 0.11);
  g.add(cab);
  const roofY = 0.34 + H * 0.89;
  const trim = rand();
  if (trim < 0.42) addRoofRails(g, roofY, W, L * 0.55, -L * 0.11);
  else if (trim < 0.7) {
    const pano = new THREE.Mesh(box(W * 0.65, 0.035, L * 0.42), glassMat);
    pano.position.set(0, roofY + 0.025, -L * 0.12); g.add(pano);
  } else {
    const roof = new THREE.Mesh(box(W * 0.9, 0.08, L * 0.55), bodyMat(rand() < 0.5 ? 0x17191c : 0xe5e7e9, 0.5));
    roof.position.set(0, roofY + 0.03, -L * 0.11); g.add(roof);
  }
  addWheels(g, 0.38, 0.27, W / 2 - 0.1, [L * 0.33, -L * 0.32]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.34 + H * 0.34);
  return g;
}

// Mustang/Camaro/Challenger-shaped muscle car: long hood, cab pushed rearward,
// wide stance, with optional stripes, ducktail or black hood treatment.
function makeMuscle(color, L, W, H, rand) {
  const g = new THREE.Group();
  const mat = bodyMat(color, 0.65);
  const body = new THREE.Mesh(box(W, H * 0.5, L), mat);
  body.position.y = 0.27 + H * 0.25;
  body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(box(W * 0.82, H * 0.34, L * 0.34), glassMat);
  cab.position.set(0, 0.27 + H * 0.64, -L * 0.16); g.add(cab);
  const style = rand();
  if (style < 0.34) {
    const stripeColor = color === 0x1b1d1f ? 0xd9d9d4 : 0x17191c;
    for (const x of [-0.16, 0.16]) {
      const stripe = new THREE.Mesh(box(0.17, 0.025, L * 0.92), bodyMat(stripeColor, 0.5));
      stripe.position.set(x, 0.27 + H * 0.51, 0); g.add(stripe);
    }
  } else if (style < 0.67) {
    const hood = new THREE.Mesh(box(W * 0.7, 0.04, L * 0.38), trimMat);
    hood.position.set(0, 0.27 + H * 0.51, L * 0.25); g.add(hood);
  } else addSpoiler(g, color, W, H, -L / 2 + 0.1);
  addWheels(g, 0.36, 0.31, W / 2 - 0.08, [L * 0.34, -L * 0.34]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.27 + H * 0.28);
  return g;
}

// Older American/Japanese sedan still common in the used-car fleet: upright
// greenhouse, square bumpers and chrome. Some have vinyl-look roofs or a roof
// rack, creating a visibly different age/profile from the modern sedan.
function makeClassicSedan(color, L, W, H, rand) {
  const g = new THREE.Group();
  const mat = bodyMat(color, 0.25);
  const body = new THREE.Mesh(box(W, H * 0.48, L), mat);
  body.position.y = 0.3 + H * 0.24;
  body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(box(W * 0.84, H * 0.4, L * 0.46), glassMat);
  cab.position.set(0, 0.3 + H * 0.66, -L * 0.04); g.add(cab);
  for (const z of [-L / 2 - 0.035, L / 2 + 0.035]) {
    const bumper = new THREE.Mesh(box(W * 0.9, 0.11, 0.09), chromeTrimMat);
    bumper.position.set(0, 0.38, z); g.add(bumper);
  }
  if (rand() < 0.42) {
    const roof = new THREE.Mesh(box(W * 0.86, 0.07, L * 0.43), bodyMat(rand() < 0.55 ? 0x181a1d : 0xe2ded3, 0.15));
    roof.position.set(0, 0.3 + H * 0.88, -L * 0.04); g.add(roof);
  } else if (rand() < 0.3) addRoofRails(g, 0.3 + H * 0.86, W, L * 0.4, -L * 0.04);
  addWheels(g, 0.32, 0.24, W / 2 - 0.1, [L * 0.33, -L * 0.33]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.3 + H * 0.28);
  return g;
}

// Upright body-on-frame/off-road SUV: flat roof, visible lower cladding and a
// rear-mounted spare on some examples. Distinct from the rounded crossover.
function makeOffroadSUV(color, L, W, H, rand) {
  const g = new THREE.Group();
  const mat = bodyMat(color, 0.48);
  const lower = new THREE.Mesh(box(W, H * 0.28, L), trimMat);
  lower.position.y = 0.42 + H * 0.14; lower.castShadow = true; g.add(lower);
  const body = new THREE.Mesh(box(W * 0.96, H * 0.55, L * 0.95), mat);
  body.position.set(0, 0.42 + H * 0.48, -L * 0.02); body.castShadow = true; g.add(body);
  const windows = new THREE.Mesh(box(W * 0.86, H * 0.25, L * 0.58), glassMat);
  windows.position.set(0, 0.42 + H * 0.77, -L * 0.11); g.add(windows);
  addRoofRails(g, 0.42 + H * 0.91, W, L * 0.58, -L * 0.1);
  if (rand() < 0.38) {
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 14), tireMat);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 0.68 + H * 0.2, -L / 2 - 0.13); g.add(spare);
  }
  addWheels(g, 0.43, 0.29, W / 2 - 0.1, [L * 0.33, -L * 0.32]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.42 + H * 0.29);
  return g;
}

// Long-wheelbase luxury sedan: low roof, long hood, bright grille and a full
// glass roof. Kept as a separate silhouette so a luxury badge is not merely
// pasted onto the same economy-car box.
function makeLuxurySedan(color, L, W, H, rand) {
  const g = new THREE.Group();
  const mat = bodyMat(color, 0.82);
  const body = new THREE.Mesh(box(W, H * 0.46, L), mat);
  body.position.y = 0.29 + H * 0.23; body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(box(W * 0.84, H * 0.34, L * 0.46), glassMat);
  cab.position.set(0, 0.29 + H * 0.62, -L * 0.09); g.add(cab);
  const grille = new THREE.Mesh(box(W * 0.58, H * 0.2, 0.055), chromeTrimMat);
  grille.position.set(0, 0.29 + H * 0.27, L / 2 + 0.035); g.add(grille);
  const pano = new THREE.Mesh(box(W * 0.62, 0.035, L * 0.32), glassMat);
  pano.position.set(0, 0.29 + H * 0.81, -L * 0.09); g.add(pano);
  if (rand() < 0.35) {
    const lowerChrome = new THREE.Mesh(box(W * 0.82, 0.055, 0.06), chromeTrimMat);
    lowerChrome.position.set(0, 0.36, -L / 2 - 0.025); g.add(lowerChrome);
  }
  addWheels(g, 0.37, 0.3, W / 2 - 0.08, [L * 0.34, -L * 0.34]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.29 + H * 0.27);
  const tailBar = new THREE.Mesh(box(W * 0.82, 0.065, 0.045), taillightMat);
  tailBar.position.set(0, 0.29 + H * 0.34, -L / 2 - 0.025); g.add(tailBar);
  return g;
}

function makeLuxurySUV(color, L, W, H, rand) {
  const g = makeCrossover(color, L, W, H, rand);
  const grille = new THREE.Mesh(box(W * 0.62, H * 0.2, 0.06), chromeTrimMat);
  grille.position.set(0, 0.39 + H * 0.25, L / 2 + 0.04); g.add(grille);
  const sill = new THREE.Mesh(box(W * 0.9, 0.06, L * 0.7), chromeTrimMat);
  sill.position.set(0, 0.34, -L * 0.03); g.add(sill);
  return g;
}

// tall cargo van (contractor / delivery white sprinter)
const VAN_COLORS = [0xf0f0ec, 0xf0f0ec, 0xf0f0ec, 0xd8d8d4, 0x8c1c1c, 0x1e3a6e];
function makeVan(color, L, W, H) {
  const g = new THREE.Group();
  const mat = bodyMat(color, 0.25);
  const body = new THREE.Mesh(box(W, H * 0.88, L), mat);
  body.position.y = 0.42 + H * 0.44;
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(box(W * 0.92, H * 0.2, L * 0.22), glassMat);
  glass.position.set(0, 0.42 + H * 0.62, L * 0.34);
  g.add(glass);
  addWheels(g, 0.38, 0.26, W / 2 - 0.11, [L * 0.32, -L * 0.32]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.55);
  return g;
}

function makePickup(color, L, W, H, rand = null) {
  const g = new THREE.Group();
  const mat = bodyMat(color);
  const bed = new THREE.Mesh(box(W, H * 0.45, L), mat);
  bed.position.y = 0.42 + H * 0.22;
  bed.castShadow = true;
  g.add(bed);
  const cab = new THREE.Mesh(box(W * 0.94, H * 0.5, L * 0.32), mat);
  cab.position.set(0, 0.42 + H * 0.45 + H * 0.12, L * 0.1);
  g.add(cab);
  const glass = new THREE.Mesh(box(W * 0.84, H * 0.32, L * 0.26), glassMat);
  glass.position.set(0, 0.42 + H * 0.58 + H * 0.12, L * 0.1);
  g.add(glass);
  if (rand) {
    const r = rand();
    if (r < 0.18) {
      // contractor ladder rack over the bed
      for (const z of [-L * 0.42, L * 0.02]) {
        const hoop = new THREE.Mesh(box(W * 0.9, 0.08, 0.08), railMat2);
        hoop.position.set(0, 0.42 + H * 0.95, z);
        g.add(hoop);
        for (const x of [-W * 0.42, W * 0.42]) {
          const post = new THREE.Mesh(box(0.07, H * 0.5, 0.07), railMat2);
          post.position.set(x, 0.42 + H * 0.7, z);
          g.add(post);
        }
      }
    } else if (r < 0.42) {
      // load in the bed: crates / mulch / a toolbox
      const load = new THREE.Mesh(box(W * 0.8, H * 0.3, L * 0.4),
        bodyMat([0x7a5c3a, 0x4a4d52, 0xd8d8d4][(rand() * 3) | 0], 0.1));
      load.position.set(0, 0.42 + H * 0.5, -L * 0.26);
      g.add(load);
    }
  }
  addWheels(g, 0.42, 0.28, W / 2 - 0.12, [L * 0.33, -L * 0.33]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.42 + H * 0.3);
  return g;
}

// NYC yellow cab: checker band down the flanks, black "NYC TAXI" door mark,
// medallion roof light
let _checkerMat = null;
function checkerMat() {
  if (_checkerMat) return _checkerMat;
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 16;
  const g = cv.getContext('2d');
  g.fillStyle = '#f7b500'; g.fillRect(0, 0, 128, 16);
  g.fillStyle = '#111';
  for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
    if ((x + y) % 2 === 0) g.fillRect(x * 8, y * 8, 8, 8);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  _checkerMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.3 });
  return _checkerMat;
}
function makeTaxi(rand, L, W, H) {
  // NYC's active medallion fleet mixes Camry-class sedans, Escape/RAV4-class
  // crossovers and Sienna-style accessible minivans instead of one clone.
  const style = rand();
  const g = style < 0.42
    ? makeCar(0xf7b500, L, W, H, 0.52 + rand() * 0.08, rand)
    : style < 0.72
      ? makeCrossover(0xf7b500, L, W, 1.68, rand)
      : makeMinivan(0xf7b500, L, W, 1.76);
  const roofY = style < 0.42 ? 0.3 + H * 0.97 : style < 0.72 ? 2.02 : 2.1;
  // checker band along both sides
  for (const side of [-1, 1]) {
    const band = new THREE.Mesh(box(0.02, 0.15, L * 0.8), checkerMat());
    band.position.set(side * (W / 2 + 0.005), 0.3 + H * 0.34, 0);
    g.add(band);
  }
  // roof medallion light
  const sign = new THREE.Mesh(box(0.7, 0.2, 0.24), headlightMat);
  sign.position.set(0, roofY, -L * 0.06);
  g.add(sign);
  const signBase = new THREE.Mesh(box(0.78, 0.06, 0.3), trimMat);
  signBase.position.set(0, roofY - 0.12, -L * 0.06);
  g.add(signBase);
  return g;
}

// European city taxi: Lisbon beige, Madrid white with the red door band,
// German Hellelfenbein ivory — with the boxy roof sign, never a yellow cab.
function makeEuroTaxi(L, W, H) {
  const col = MAP === 'a4' ? 0xf2f3f5 : MAP === 'a3' ? 0xefe3c0
    : MAP === 'm1' ? 0x141518   // the London black cab
    : MAP === 'a16' ? 0x2a2d33  // Parisian dark-liveried taxi
    : MAP === 'a1it' ? 0xf2f3f5 // Italian white taxi
    : MAP === 'swiss' ? 0x1c1e22 // Swiss taxis: dark saloons (Merc/Tesla)
    : 0xd8cba8;
  const g = makeCar(col, L, W, H);
  if (MAP === 'a4') {
    // Madrid: red diagonal band on the front doors
    for (const side of [-1, 1]) {
      const band = new THREE.Mesh(box(0.02, H * 0.3, 0.5), bodyMat(0xc8102e, 0.4));
      band.position.set(side * (W / 2 + 0.006), 0.3 + H * 0.34, L * 0.12);
      band.rotation.x = 0.5;
      g.add(band);
    }
  }
  const sign = new THREE.Mesh(box(0.62, 0.2, 0.24), headlightMat);
  sign.position.set(0, 0.3 + H * 0.97, -L * 0.06);
  g.add(sign);
  const signBase = new THREE.Mesh(box(0.7, 0.06, 0.3), trimMat);
  signBase.position.set(0, 0.3 + H * 0.88, -L * 0.06);
  g.add(signBase);
  return g;
}

function makeBoxTruck(color, L, W, H, rand = null) {
  const g = new THREE.Group();
  const cabOver = rand ? rand() < 0.34 : false;
  const cab = new THREE.Mesh(box(W * 0.96, H * (cabOver ? 0.78 : 0.62), L * (cabOver ? 0.2 : 0.28)), bodyMat(color, 0.3));
  cab.position.set(0, 0.5 + H * (cabOver ? 0.39 : 0.31), L * (cabOver ? 0.39 : 0.34));
  cab.castShadow = true;
  g.add(cab);
  const glass = new THREE.Mesh(box(W * 0.86, H * 0.24, L * 0.2), glassMat);
  glass.position.set(0, 0.5 + H * 0.52, L * 0.36);
  g.add(glass);
  const cargoColor = rand
    ? [0xe8e6e0, 0xf1f2f0, 0xd2d6d9, 0xbfc5ca, 0xeee5d2][(rand() * 5) | 0]
    : 0xe8e6e0;
  const cargo = new THREE.Mesh(box(W, H, L * 0.62), bodyMat(cargoColor, 0.1));
  cargo.position.set(0, 0.55 + H * 0.5, -L * 0.16);
  cargo.castShadow = true;
  g.add(cargo);
  if (rand && rand() < 0.48) {
    const stripe = new THREE.Mesh(box(W * 1.01, 0.16, L * 0.54),
      bodyMat([0x1f4fa3, 0x9a3524, 0x2a7a3f, 0xd97b1f, 0x34383d][(rand() * 5) | 0], 0.15));
    stripe.position.set(0, 0.55 + H * (0.35 + rand() * 0.28), -L * 0.16); g.add(stripe);
  }
  addWheels(g, 0.48, 0.32, W / 2 - 0.14, [L * 0.34, -L * 0.28]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.7);
  return g;
}

// intermodal container liveries (generic shipping-line colors) + dry-van tints
const CONTAINER_COLORS = [0x9a3524, 0x1f4fa3, 0x2a7a3f, 0xd97b1f, 0x8a2a86, 0x5a5e63, 0x0e5a72, 0xb8b9bd];
const DRYVAN_COLORS = [0xdedcd6, 0xdedcd6, 0xdedcd6, 0xc9cdd1, 0xb8b4a8, 0x8e9298, 0xd4d0c3, 0x6f7780, 0xb7c4c9];
const tankMat = new THREE.MeshStandardMaterial({ color: 0xd4d6d9, roughness: 0.25, metalness: 0.85 });
const geoCyl = new Map();
function cyl(r, l) {
  const key = `c${r}|${l}`;
  if (!geoCyl.has(key)) {
    const g = new THREE.CylinderGeometry(r, r, l, 14);
    g.rotateX(Math.PI / 2);
    geoCyl.set(key, g);
  }
  return geoCyl.get(key);
}

function makeSemi(cabColor, L, W, H, rand = null) {
  const g = new THREE.Group();
  if (EURO || UK) {
    // European tractor: flat-faced cab-over (Scania/Volvo/MAN silhouette) —
    // no hood, tall cab right at the front bumper
    const cab = new THREE.Mesh(box(W * 0.94, H * 1.15, 2.2), bodyMat(cabColor, 0.5));
    cab.position.set(0, 0.55 + H * 0.58, L / 2 - 1.15);
    cab.castShadow = true;
    g.add(cab);
    const glass = new THREE.Mesh(box(W * 0.86, H * 0.34, 2.24), glassMat);
    glass.position.set(0, 0.55 + H * 0.92, L / 2 - 1.15);
    g.add(glass);
    const deflector = new THREE.Mesh(box(W * 0.9, H * 0.22, 1.4), bodyMat(cabColor, 0.5));
    deflector.position.set(0, 0.55 + H * 1.22, L / 2 - 1.6);
    g.add(deflector);
  } else {
  // tractor
  const nose = new THREE.Mesh(box(W * 0.92, H * 0.5, 2.4), bodyMat(cabColor, 0.5));
  nose.position.set(0, 0.6 + H * 0.25, L / 2 - 1.4);
  nose.castShadow = true;
  g.add(nose);
  const cabTop = new THREE.Mesh(box(W * 0.92, H * 0.42, 1.6), bodyMat(cabColor, 0.5));
  cabTop.position.set(0, 0.6 + H * 0.5 + H * 0.16, L / 2 - 2.2);
  g.add(cabTop);
  const glass = new THREE.Mesh(box(W * 0.84, H * 0.22, 1.5), glassMat);
  glass.position.set(0, 0.6 + H * 0.62, L / 2 - 1.9);
  g.add(glass);
  }
  // trailer: what American semis actually haul — mostly dry vans, plus
  // reefers, intermodal containers, chrome tankers and loaded flatbeds
  const trailerL = L - 6.2;
  const v = rand ? rand() : 0.2;
  if (v < 0.48) {                                   // dry van
    const trailer = new THREE.Mesh(box(W, H * 1.06, trailerL),
      bodyMat(DRYVAN_COLORS[rand ? (rand() * DRYVAN_COLORS.length) | 0 : 0], 0.05));
    trailer.position.set(0, 1.15 + H * 0.53, -3.0);
    trailer.castShadow = true;
    g.add(trailer);
  } else if (v < 0.62) {                            // reefer: white + nose unit
    const trailer = new THREE.Mesh(box(W, H * 1.06, trailerL), bodyMat(0xf0f2f4, 0.05));
    trailer.position.set(0, 1.15 + H * 0.53, -3.0);
    trailer.castShadow = true;
    g.add(trailer);
    const unit = new THREE.Mesh(box(W * 0.7, H * 0.5, 0.35), trimMat);
    unit.position.set(0, 1.15 + H * 0.5, -3.0 + trailerL / 2 + 0.18);
    g.add(unit);
  } else if (v < 0.78) {                            // intermodal container on chassis
    const frame = new THREE.Mesh(box(W * 0.94, 0.24, trailerL), trimMat);
    frame.position.set(0, 1.15, -3.0);
    g.add(frame);
    const cont = new THREE.Mesh(box(W, H * 0.92, trailerL * 0.96),
      bodyMat(CONTAINER_COLORS[rand ? (rand() * CONTAINER_COLORS.length) | 0 : 0], 0.15));
    cont.position.set(0, 1.3 + H * 0.46, -3.0);
    cont.castShadow = true;
    g.add(cont);
  } else if (v < 0.9) {                             // chrome tanker
    const tank = new THREE.Mesh(cyl(H * 0.5, trailerL * 0.96), tankMat);
    tank.position.set(0, 1.3 + H * 0.42, -3.0);
    tank.castShadow = true;
    g.add(tank);
    const frame = new THREE.Mesh(box(W * 0.8, 0.24, trailerL * 0.9), trimMat);
    frame.position.set(0, 1.1, -3.0);
    g.add(frame);
  } else {                                          // flatbed with strapped load
    const deck = new THREE.Mesh(box(W, 0.28, trailerL), trimMat);
    deck.position.set(0, 1.2, -3.0);
    g.add(deck);
    const n = rand ? 2 + (rand() * 2 | 0) : 2;
    const q = x => Math.round(x * 10) / 10;   // quantize → shared geometry cache
    for (let i = 0; i < n; i++) {
      const lh = q(H * (0.3 + (rand ? rand() * 0.3 : 0)));
      const load = new THREE.Mesh(
        box(q(W * (0.55 + (rand ? rand() * 0.3 : 0))), lh, q(trailerL / n * 0.72)),
        bodyMat([0x7a5c3a, 0x55585e, 0x9a3524, 0x3e4854][rand ? (rand() * 4) | 0 : 0], 0.2));
      load.position.set(0, 1.34 + lh / 2, -3.0 - trailerL / 2 + (i + 0.5) * (trailerL / n));
      load.castShadow = true;
      g.add(load);
    }
  }
  const skirt = new THREE.Mesh(box(W * 0.9, 0.5, 2.2), trimMat);
  skirt.position.set(0, 0.5, -L / 2 + 2.2);
  g.add(skirt);
  addWheels(g, 0.5, 0.34, W / 2 - 0.16, [L / 2 - 1.2, L / 2 - 4.2, -L / 2 + 1.6, -L / 2 + 3.0]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.8);
  return g;
}

function makeBus(color, L, W, H) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(box(W, H, L), bodyMat(color, 0.2));
  body.position.y = 0.45 + H * 0.5;
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(box(W * 1.01, H * 0.3, L * 0.92), glassMat);
  glass.position.y = 0.45 + H * 0.68;
  g.add(glass);
  addWheels(g, 0.5, 0.34, W / 2 - 0.16, [L * 0.36, -L * 0.36]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.75);
  return g;
}

export function makeRickshaw(green = false) {
  const g = new THREE.Group();
  // Mumbai autos run black+yellow; Delhi CNG autos run GREEN+yellow
  const body = new THREE.Mesh(box(1.3, 0.8, 2.4), bodyMat(green ? 0x1f7a33 : 0x1a1a1a, 0.2));
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const canopy = new THREE.Mesh(box(1.32, 0.5, 1.7), bodyMat(0xe8b400, 0.1));
  canopy.position.set(0, 1.3, -0.3);
  g.add(canopy);
  const shield = new THREE.Mesh(box(1.2, 0.5, 0.05), glassMat);
  shield.position.set(0, 1.25, 0.85);
  g.add(shield);
  // 3 wheels
  const fw = new THREE.Mesh(wheelGeo(0.26, 0.14), tireMat);
  fw.position.set(0, 0.26, 1.05);
  g.add(fw);
  for (const x of [-0.55, 0.55]) {
    const w = new THREE.Mesh(wheelGeo(0.26, 0.14), tireMat);
    w.position.set(x, 0.26, -0.8);
    g.add(w);
  }
  const h = new THREE.Mesh(box(0.3, 0.14, 0.06), headlightMat);
  h.position.set(0, 0.9, 1.21);
  g.add(h);
  const t = new THREE.Mesh(box(0.5, 0.12, 0.06), taillightMat);
  t.position.set(0, 0.7, -1.21);
  g.add(t);
  return g;
}

export function makeBike(rand, opts = {}) {
  const g = new THREE.Group();
  g.userData.wheels = [];
  const player = !!opts.player;
  const scooter = rand() < 0.5;   // half the two-wheelers are Activa-class scooters
  if (scooter) {
    // step-through scooter: front apron, flat floorboard, boxy tail
    const col = [0xb9bdc2, 0xb9bdc2, 0xc8342a, 0x1b1d1f, 0x2a4f8f, 0xe8b400, 0xf2f3f5][(rand() * 7) | 0];
    const apron = new THREE.Mesh(box(0.42, 0.55, 0.16), bodyMat(col, 0.35));
    apron.position.set(0, 0.72, 0.62);
    g.add(apron);
    const floor = new THREE.Mesh(box(0.4, 0.1, 0.72), bodyMat(col, 0.35));
    floor.position.set(0, 0.36, 0.12);
    g.add(floor);
    const tail = new THREE.Mesh(box(0.42, 0.34, 0.85), bodyMat(col, 0.35));
    tail.position.set(0, 0.72, -0.5);
    g.add(tail);
    for (const z of [0.68, -0.68]) {
      const w = new THREE.Mesh(wheelGeo(0.24, 0.1), tireMat);
      w.position.set(0, 0.24, z);
      w.userData.r = 0.24; g.userData.wheels.push(w);
      g.add(w);
    }
  } else {
    const frame = new THREE.Mesh(box(0.35, 0.5, 1.9), bodyMat([0xc8342a, 0x14161a, 0x1e3a6e][(rand() * 3) | 0], 0.6));
    frame.position.y = 0.65;
    g.add(frame);
    for (const z of [0.75, -0.75]) {
      const w = new THREE.Mesh(wheelGeo(0.3, 0.09), tireMat);
      w.position.set(0, 0.3, z);
      w.userData.r = 0.3; g.userData.wheels.push(w);
      g.add(w);
    }
  }
  // rider (and, often enough in India, a pillion passenger)
  const torso = new THREE.Mesh(box(0.44, 0.62, 0.3), bodyMat(player ? 0x1d3557 : [0xd8d2c3, 0x2e5339, 0x15355e, 0x6b1f8a, 0xc8342a, 0xe8b400][(rand() * 6) | 0], 0));
  torso.position.set(0, 1.25, -0.25);
  g.add(torso);
  const head = new THREE.Mesh(box(0.26, 0.26, 0.26), bodyMat(player ? 0x7a452d : (rand() < 0.6 ? 0x2a2a2a : [0x1b1d1f, 0xc8342a, 0xf2f3f5][(rand() * 3) | 0]), 0.3));
  head.position.set(0, 1.7, -0.25);
  g.add(head);
  if (!player && rand() < 0.3) {
    const p = new THREE.Mesh(box(0.4, 0.56, 0.26), bodyMat([0xc2185b, 0x0d6b3f, 0xd97b1f, 0x6b1f8a][(rand() * 4) | 0], 0));
    p.position.set(0, 1.22, -0.62);
    g.add(p);
    const ph = new THREE.Mesh(box(0.24, 0.24, 0.24), bodyMat(0x6b4028, 0.1));
    ph.position.set(0, 1.62, -0.62);
    g.add(ph);
  }
  const h = new THREE.Mesh(box(0.2, 0.14, 0.05), headlightMat);
  h.position.set(0, 0.85, 0.96);
  g.add(h);
  const t = new THREE.Mesh(box(0.2, 0.1, 0.05), taillightMat);
  t.position.set(0, 0.75, -0.96);
  g.add(t);
  return g;
}

function makeMTABus() {
  const g = makeBus(0xe8eaec, 12.0, 2.55, 3.1);
  const stripe = new THREE.Mesh(box(2.57, 0.5, 12.02), bodyMat(0x1f4fa3, 0.2));
  stripe.position.y = 0.45 + 3.1 * 0.32;
  g.add(stripe);
  return g;
}

// Cincinnati Metro: white body, blue+green swoosh, "78" headsign
export function makeMetroBus() {
  const H = 3.15, L = 12.2, W = 2.6;
  const g = makeBus(0xf2f4f5, L, W, H);
  const blue = new THREE.Mesh(box(W + 0.02, 0.44, L + 0.02), bodyMat(0x0e4d8f, 0.2));
  blue.position.y = 0.45 + H * 0.26;
  g.add(blue);
  const green = new THREE.Mesh(box(W + 0.02, 0.3, L + 0.02), bodyMat(0x7ac143, 0.2));
  green.position.y = 0.45 + H * 0.26 + 0.42;
  g.add(green);
  // destination sign: 78 · LINCOLN HTS
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 48;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 256, 48);
  ctx.fillStyle = '#ffb400';
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('78 · DOWNTOWN', 128, 35);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(box(W * 0.8, 0.4, 0.06),
    new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7,
    }));
  sign.position.set(0, 0.45 + H * 0.88, L / 2 + 0.04);
  g.add(sign);
  return g;
}

// American yellow school bus: black bumpers, rub rails, hooded nose
export function makeSchoolBus() {
  const L = 10.8, W = 2.5, H = 2.9;
  const g = new THREE.Group();
  const body = new THREE.Mesh(box(W, H * 0.82, L * 0.82), bodyMat(0xf2a900, 0.15));
  body.position.set(0, 0.5 + H * 0.41, -L * 0.09);
  body.castShadow = true;
  g.add(body);
  const hood = new THREE.Mesh(box(W * 0.88, H * 0.4, L * 0.18), bodyMat(0xf2a900, 0.15));
  hood.position.set(0, 0.5 + H * 0.2, L * 0.41);
  g.add(hood);
  const glass = new THREE.Mesh(box(W * 1.01, H * 0.22, L * 0.78), glassMat);
  glass.position.set(0, 0.5 + H * 0.6, -L * 0.09);
  g.add(glass);
  for (const y of [0.5 + H * 0.18, 0.5 + H * 0.34]) {   // black rub rails
    const rail = new THREE.Mesh(box(W + 0.03, 0.09, L * 0.8), trimMat);
    rail.position.set(0, y, -L * 0.09);
    g.add(rail);
  }
  addWheels(g, 0.48, 0.32, W / 2 - 0.14, [L * 0.3, -L * 0.34]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.75);
  return g;
}

// intercity coach: tall, dark tinted band, luggage bays
export function makeCoach(rand) {
  const L = 13.2, W = 2.55, H = 3.5;
  const g = new THREE.Group();
  const liv = [[0xe8eaec, 0x1f4fa3], [0xd8d8d2, 0x8c1c1c], [0xf0f0ec, 0x2a7a3f], [0x2b2e33, 0xb8b4a8]][(rand() * 4) | 0];
  const body = new THREE.Mesh(box(W, H * 0.94, L), bodyMat(liv[0], 0.3));
  body.position.y = 0.4 + H * 0.47;
  body.castShadow = true;
  g.add(body);
  const stripe = new THREE.Mesh(box(W + 0.02, H * 0.14, L * 0.98), bodyMat(liv[1], 0.3));
  stripe.position.y = 0.4 + H * 0.4;
  g.add(stripe);
  const glass = new THREE.Mesh(box(W * 1.01, H * 0.24, L * 0.94), glassMat);
  glass.position.y = 0.4 + H * 0.72;
  g.add(glass);
  const bays = new THREE.Mesh(box(W * 1.005, H * 0.2, L * 0.6), trimMat);
  bays.position.set(0, 0.4 + H * 0.18, -L * 0.05);
  g.add(bays);
  addWheels(g, 0.5, 0.34, W / 2 - 0.16, [L * 0.33, -L * 0.3]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.8);
  return g;
}

function makeKaaliPeeli() {
  const g = makeCar(0x191919, 4.3, 1.75, 1.5, 0.6);
  const roof = new THREE.Mesh(box(1.5, 0.1, 2.2), bodyMat(0xe8b400, 0.1));
  roof.position.set(0, 0.3 + 1.5 * 0.52 + 1.5 * 0.4, -0.26);
  g.add(roof);
  return g;
}

// ---------------------------------------------------------------------------
// The Indian fleet looks like India: white/silver Maruti-class hatchbacks
// everywhere, compact sedans, boxy Scorpio/Bolero SUVs, Innova MPVs, the odd
// Omni microvan — and lorries painted like fairground rides.
// ---------------------------------------------------------------------------
const INDIA_CAR_COLORS = [
  0xf2f3f5, 0xf2f3f5, 0xf2f3f5, 0xf2f3f5, 0xe8e6df,   // white dominates
  0xd5d7d9, 0xb9bdc2, 0x8c8f94,                        // silvers
  0x1b1d1f, 0x8c1c1c, 0x2a4f8f, 0xcabb9e, 0x6e1518,   // black/red/blue/beige
];
function pickIndiaColor(rand) {
  _jc.setHex(INDIA_CAR_COLORS[(rand() * INDIA_CAR_COLORS.length) | 0]);
  _jc.offsetHSL((rand() - 0.5) * 0.015, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.05);
  const q = v => Math.min(15, Math.round(v * 15)) * 17;
  return (q(_jc.r) << 16) | (q(_jc.g) << 8) | q(_jc.b);
}

// tall-boy hatchback (Alto / WagonR / Swift): short, narrow, big glasshouse
function makeIndianHatch(color, L = 3.6, W = 1.6, H = 1.62) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(box(W, H * 0.5, L), bodyMat(color, 0.4));
  body.position.y = 0.28 + H * 0.25;
  body.castShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(box(W * 0.92, H * 0.46, L * 0.66), glassMat);
  cab.position.set(0, 0.28 + H * 0.5 + H * 0.21, -L * 0.08);
  g.add(cab);
  addWheels(g, 0.28, 0.18, W / 2 - 0.08, [L * 0.33, -L * 0.33]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.28 + H * 0.28);
  return g;
}

// boxy ladder-frame SUV (Scorpio / Bolero): upright nose, flat roof, rails
function makeBoxSUV(color, L = 4.4, W = 1.8, H = 1.95) {
  const g = new THREE.Group();
  const mat = bodyMat(color, 0.5);
  const body = new THREE.Mesh(box(W, H * 0.56, L), mat);
  body.position.y = 0.4 + H * 0.28;
  body.castShadow = true;
  g.add(body);
  const upper = new THREE.Mesh(box(W * 0.96, H * 0.34, L * 0.66), mat);
  upper.position.set(0, 0.4 + H * 0.56 + H * 0.17, -L * 0.12);
  g.add(upper);
  const glass = new THREE.Mesh(box(W * 0.98, H * 0.2, L * 0.64), glassMat);
  glass.position.set(0, 0.4 + H * 0.6, -L * 0.12);
  g.add(glass);
  addRoofRails(g, 0.4 + H * 0.9, W, L * 0.6, -L * 0.12);
  addWheels(g, 0.38, 0.24, W / 2 - 0.1, [L * 0.32, -L * 0.32]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.4 + H * 0.3);
  return g;
}

// painted Indian lorry: bright cab, crown board, decorated wooden body,
// HORN OK PLEASE across the tail
const TRUCK_BODY_COLORS = [0xd97b1f, 0x1f4fa3, 0xc8342a, 0x0d6b3f, 0xe8b400, 0x8a2a86];
const TRUCK_REAR_TEXTS = ['HORN OK PLEASE', 'HORN OK PLEASE', 'HORN OK PLEASE', 'OK TATA', 'BLOW HORN', 'USE DIPPER AT NIGHT'];
const _truckLiveries = [];
function truckLivery(i) {
  if (_truckLiveries[i]) return _truckLiveries[i];
  const base = '#' + TRUCK_BODY_COLORS[i % TRUCK_BODY_COLORS.length].toString(16).padStart(6, '0');
  const trim = ['#ffd23d', '#f2f2ee', '#0d6b3f', '#c8342a', '#1f4fa3', '#ffd23d'][i % 6];
  const mk = (w, h, draw) => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    draw(g, w, h);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
  };
  const border = (g, w, h) => {
    g.strokeStyle = trim; g.lineWidth = 7;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = trim;
    for (let x = 20; x < w - 12; x += 22) {   // painted dot-and-diamond rows
      g.beginPath(); g.arc(x, 20, 4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x, h - 20, 4, 0, Math.PI * 2); g.fill();
    }
  };
  const side = mk(256, 128, (g, w, h) => {
    border(g, w, h);
    g.fillStyle = trim;
    g.font = 'bold 22px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('PUBLIC CARRIER', w / 2, h / 2 - 8);
    g.font = 'bold 16px Arial';
    g.fillText('GOODS ✦ TRANSPORT', w / 2, h / 2 + 18);
  });
  const back = mk(256, 128, (g, w, h) => {
    border(g, w, h);
    g.fillStyle = '#fff';
    g.font = 'bold 26px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    const text = TRUCK_REAR_TEXTS[i % TRUCK_REAR_TEXTS.length];
    if (text.length > 12) {
      const words = text.split(' ');
      const half = Math.ceil(words.length / 2);
      g.fillText(words.slice(0, half).join(' '), w / 2, h / 2 - 6);
      g.fillText(words.slice(half).join(' '), w / 2, h / 2 + 26);
    } else {
      g.fillText(text, w / 2, h / 2 + 10);
    }
  });
  return (_truckLiveries[i] = { side, back, baseHex: TRUCK_BODY_COLORS[i % TRUCK_BODY_COLORS.length] });
}

export function makeIndianTruck(rand) {
  const L = 7.2, W = 2.35, H = 2.9;
  const liv = truckLivery((rand() * 6) | 0);
  const g = new THREE.Group();
  // decorated cargo body: painted sides, HORN OK PLEASE tail, gray tarp top
  const tarp = bodyMat(0x8a919c, 0.1);
  const cargo = new THREE.Mesh(box(W, 2.15, 4.7),
    [liv.side, liv.side, tarp, trimMat, liv.side, liv.back]);
  cargo.position.set(0, 0.85 + 1.05, -1.15);
  cargo.castShadow = true;
  g.add(cargo);
  // bright cab with crown board over the windshield
  const cabMat = bodyMat(liv.baseHex, 0.3);
  const cab = new THREE.Mesh(box(W * 0.94, 1.5, 1.7), cabMat);
  cab.position.set(0, 0.85 + 0.75, 2.55);
  cab.castShadow = true;
  g.add(cab);
  const glass = new THREE.Mesh(box(W * 0.86, 0.55, 0.1), glassMat);
  glass.position.set(0, 1.95, 3.42);
  g.add(glass);
  const crown = new THREE.Mesh(box(W * 0.98, 0.42, 0.14), liv.back);
  crown.position.set(0, 2.55, 3.2);
  g.add(crown);
  const bumper = new THREE.Mesh(box(W, 0.3, 0.16), bodyMat(0xd8d4c8, 0.2));
  bumper.position.set(0, 0.55, 3.48);
  g.add(bumper);
  addWheels(g, 0.5, 0.32, W / 2 - 0.14, [L / 2 - 1.2, -L / 2 + 1.4, -L / 2 + 2.5]);
  addLights(g, W, L / 2 + 0.01, -L / 2 - 0.01, 0.7);
  return g;
}

// Real US fleet color mix: white/black/gray/silver dominate, then blue, red,
// the occasional green/tan/orange. Each pick also gets a small hue/lightness
// jitter (quantized so materials still pool) — no two whites read identical.
const CAR_COLORS = [
  0xf2f3f5, 0xf2f3f5, 0xf2f3f5, 0xeceae4,             // whites / pearl
  0x1b1d1f, 0x1b1d1f, 0x26282c,                        // blacks
  0xb9bdc2, 0xb9bdc2, 0xd8d8d8, 0xa4a9ae,              // silvers
  0x6b7075, 0x53575c, 0x3b3f45,                        // grays / graphite
  0x8c1c1c, 0xa32b20, 0x6e1518,                        // reds / maroon
  0x1e3a6e, 0x2a4f8f, 0x16295c, 0x3d6a9e,              // blues
  0x2e5339, 0x1f3d2b,                                  // greens
  0x7a5c3a, 0x9a8265, 0xb8a888,                        // tan / champagne
  0xd97b1f, 0x5a3d6e,                                  // the odd loud one
];
const _jc = new THREE.Color();
function pickColor(rand) {
  _jc.setHex(CAR_COLORS[(rand() * CAR_COLORS.length) | 0]);
  _jc.offsetHSL((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.05);
  // quantize to 4-bit steps per channel so the bodyMat cache stays small
  const q = v => Math.min(15, Math.round(v * 15)) * 17;
  return (q(_jc.r) << 16) | (q(_jc.g) << 8) | q(_jc.b);
}

// curbside prop for city streets (Cincinnati parallel parking)
export function makeParkedCar(rand) {
  return makeCar(pickColor(rand), 4.6, 1.8, 1.42, 0.58);
}

// ---------------------------------------------------------------------------
// NPC license plates: mostly the home state of the zone you're in, with a
// realistic sprinkle of neighboring-state traffic.
// ---------------------------------------------------------------------------
const PLATE_SERIAL_L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const PLATE_SERIAL_D = '0123456789';
function serial(chars, n) {
  let out = '';
  for (let i = 0; i < n; i++) out += chars[(Math.random() * chars.length) | 0];
  return out;
}

// state → drawing recipe (real-life colors)
const PLATE_STYLES = {
  CT: { ctDetailed: true, bg: ['#e8f3fa', '#b8d4e7'], text: '#174c82', header: 'CONNECTICUT', footer: 'CONSTITUTION STATE', fmt: () => `${serial(PLATE_SERIAL_L, 2)}·${serial(PLATE_SERIAL_D, 5)}` },
  // Modern NY family: Excelsior (current), Empire Gold (2010–2020), the
  // blue/white Empire State base (2001–2010), and Liberty (1987–2003).
  NY: { nyGold: true, bg: ['#f8b133', '#e89a1e'], text: '#1b2a4a', header: 'NEW YORK', footer: 'THE EMPIRE STATE', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  NY_NEW: { nyExcelsior: true, bg: ['#fbfbf8', '#dbe6f0'], text: '#12356f', header: 'NEW YORK', headerFg: '#1b3f8f', footer: 'EXCELSIOR', footerFg: '#d5a62a', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  // the 2001–2010 blue plate — Niagara Falls + the NYC skyline across the top,
  // white field, navy serial, "THE EMPIRE STATE". Only on cars first plated
  // before ~2010, so it's the minority (drawn specially in drawPlate)
  NY_BLUE: { nyBlue: true, bg: ['#2f5c9e', '#f4f7fb'], text: '#1c3f7a', header: 'NEW YORK', footer: 'THE EMPIRE STATE', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  NY_LIBERTY: { nyLiberty: true, bg: ['#f4f7fb', '#d6e5f2'], text: '#183d75', header: 'NEW YORK', footer: 'EMPIRE STATE', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  NJ: { bg: ['#fdf6d8', '#e8c96a'], text: '#151515', header: 'NEW JERSEY', footer: 'GARDEN STATE', fmt: () => `${serial(PLATE_SERIAL_L, 1)}${serial(PLATE_SERIAL_D, 2)} ${serial(PLATE_SERIAL_L, 3)}` },
  // PA: the older blue/white/yellow "visitPA" plate is still on most cars; the
  // newer plainer design (PA_NEW) is the minority (see the remap in addNpcPlates).
  PA: { bg: ['#1b3a7a', '#f2f4f6', '#f2c53a'], text: '#1b3a7a', header: 'PENNSYLVANIA', headerFg: '#ffffff', footer: 'visitPA.com', footerFg: '#1b3a7a', fmt: () => `${serial(PLATE_SERIAL_L, 3)}•${serial(PLATE_SERIAL_D, 4)}` },
  // newer PA: plain fully-white plate with red serial
  PA_NEW: { bg: ['#ffffff', '#ffffff'], text: '#c0202a', header: 'PENNSYLVANIA', headerFg: '#c0202a', footer: 'visitPA.com', footerFg: '#c0202a', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  // Delaware keyed DEL, not DE — the German Autobahn plate below also claims
  // 'DE' and (being later) wins the object key, so a bare 'DE' renders German.
  DEL: { bg: ['#12264a', '#12264a'], text: '#e8c96a', header: 'DELAWARE', headerFg: '#e8c96a', footer: 'THE FIRST STATE', fmt: () => serial(PLATE_SERIAL_D, 6) },
  IL: { bg: ['#fbfbf8', '#d9e9f3'], text: '#12356f', header: 'ILLINOIS', headerFg: '#b3202c', footer: 'LAND OF LINCOLN', footerFg: '#12356f', fmt: () => `${serial(PLATE_SERIAL_L, 2)} ${serial(PLATE_SERIAL_D, 5)}` },
  WI: { bg: ['#f8fafb', '#dce7ef'], text: '#1d3f70', header: 'WISCONSIN', headerFg: '#b3202c', footer: 'AMERICA’S DAIRYLAND', footerFg: '#1d3f70', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  MI: { bg: ['#f4f7f8', '#d8e6ef'], text: '#163c70', header: 'MICHIGAN', headerFg: '#1d4f86', footer: 'GREAT LAKES', footerFg: '#1d4f86', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  // Current standard passenger base (2017–present): covered-bridge scene,
  // blue serial, and the small county/year marks used in the corners.
  IN: { indianaCovered: true, text: '#12356f', header: 'INDIANA', footer: 'CROSSROADS OF AMERICA', fmt: () => `${serial(PLATE_SERIAL_D, 3)}${serial(PLATE_SERIAL_L, 3)}` },
  IA: { bg: ['#f4f6f8', '#dbe8f3'], text: '#12356f', header: 'IOWA', footer: 'FIELDS OF OPPORTUNITY', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 3)}` },
  MO: { bg: ['#f4f6f8', '#dce7f1'], text: '#12356f', header: 'MISSOURI', footer: 'SHOW-ME STATE', fmt: () => `${serial(PLATE_SERIAL_L, 2)}${serial(PLATE_SERIAL_D, 1)} ${serial(PLATE_SERIAL_L, 3)}` },
  LIB: { bg: ['#9ed7f0', '#9ed7f0'], text: '#111', header: 'LIBERTIA', footer: 'THE FREE STATE', fmt: () => `${serial(PLATE_SERIAL_L, 3)}-${serial(PLATE_SERIAL_L + PLATE_SERIAL_D, 4)}` },
  LIB_TRUCK: { bg: ['#ffffff', '#ffffff'], text: '#111', header: 'LIBERTIA', footer: 'COMMERCIAL', fmt: () => `${serial(PLATE_SERIAL_L, 3)}-${serial(PLATE_SERIAL_L + PLATE_SERIAL_D, 4)}` },
  LIB_TAXI: { bg: ['#f5c928', '#e4b51d'], text: '#111', header: 'LIBERTIA TAXI', footer: 'THE FREE STATE', fmt: () => `${serial(PLATE_SERIAL_L, 3)}-${serial(PLATE_SERIAL_L + PLATE_SERIAL_D, 4)}` },
  OH: { bg: ['#f4f6f8', '#f4f6f8'], text: '#b3202c', header: 'OHIO', headerFg: '#1b3f8f', footer: 'BIRTHPLACE OF AVIATION', footerFg: '#1b3f8f', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  // the scenic "Birthplace of Aviation" Ohio plate: full landscape — sunburst,
  // Wright Flyer, skyline, river, wheat field — with a big navy serial (drawn
  // specially in drawPlate/plateTexture)
  OH_ALT: { ohioScenic: true, bg: ['#e8801c', '#1c4b9c'], text: '#14315c', header: 'OHIO', footer: 'BIRTHPLACE OF AVIATION', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  KY: { bg: ['#f4f6f8', '#bcd8ee'], text: '#12356f', header: 'KENTUCKY', footer: 'UNBRIDLED SPIRIT', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 3)}` },
  MA: { bg: ['#f8f8f4', '#f8f8f4'], text: '#b3202c', header: 'MASSACHUSETTS', headerFg: '#1b3f8f', footer: 'THE SPIRIT OF AMERICA', footerFg: '#1b3f8f', fmt: () => `${serial(PLATE_SERIAL_D, 1)}${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 2)}` },
  RI: { bg: ['#eef4fb', '#dce9f4'], text: '#12356f', header: 'RHODE ISLAND', headerFg: '#1b3f8f', footer: 'OCEAN STATE', footerFg: '#1b3f8f', fmt: () => `${serial(PLATE_SERIAL_L, 2)} ${serial(PLATE_SERIAL_D, 3)}` },
  // rare out-of-state wildcards seen on any US highway
  FL: { bg: ['#fbfefb', '#f2f8f2'], text: '#151515', header: 'Florida', headerFg: '#1f7a3d', footer: 'SUNSHINE STATE', footerFg: '#1f7a3d', oranges: true, fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_L, 1)}${serial(PLATE_SERIAL_D, 2)}` },
  TX: { bg: ['#f4f6f8', '#e9edf1'], text: '#1b2a4a', header: 'TEXAS', headerFg: '#1b3f8f', footer: 'THE LONE STAR STATE', footerFg: '#b3202c', fmt: () => `${serial(PLATE_SERIAL_L, 3)}·${serial(PLATE_SERIAL_D, 4)}` },
  CA: { bg: ['#fbfbf7', '#f1efe6'], text: '#12356f', header: 'California', headerFg: '#c8102e', footer: 'dmv.ca.gov', fmt: () => `${serial(PLATE_SERIAL_D, 1)}${serial(PLATE_SERIAL_L, 3)}${serial(PLATE_SERIAL_D, 3)}` },
  // Neighboring western plates that appear naturally on I-5, especially on
  // cross-state trips and freight moving through the Central Valley.
  NV: { bg: ['#f4f7fb', '#d9e7f2'], text: '#12356f', header: 'NEVADA', headerFg: '#b3202c', footer: 'THE SILVER STATE', footerFg: '#12356f', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 3)}` },
  AZ: { bg: ['#f4e7d0', '#f0c37b'], text: '#12356f', header: 'ARIZONA', headerFg: '#b3202c', footer: 'GRAND CANYON STATE', footerFg: '#12356f', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 3)}` },
  OR: { bg: ['#f4f6f0', '#dce8d6'], text: '#1f5f39', header: 'OREGON', headerFg: '#1f5f39', footer: 'PACIFIC WONDERLAND', footerFg: '#1f5f39', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 3)}` },
  // big long-haul trucking states, seen nationwide on the interstates
  TN: { bg: ['#f4f6f8', '#dfeae0'], text: '#1f6b3a', header: 'TENNESSEE', headerFg: '#1f6b3a', footer: 'The Volunteer State', footerFg: '#1f6b3a', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 3)}` },
  GA: { bg: ['#fbfbf9', '#f4ede4'], text: '#151515', header: 'GEORGIA', headerFg: '#1b3f8f', footer: 'Peach State', footerFg: '#e08a1e', fmt: () => `${serial(PLATE_SERIAL_L, 3)}${serial(PLATE_SERIAL_D, 4)}` },
  NC: { bg: ['#eef4fb', '#dbe9f4'], text: '#12356f', header: 'NORTH CAROLINA', headerFg: '#b3202c', footer: 'First in Flight', footerFg: '#1b3f8f', fmt: () => `${serial(PLATE_SERIAL_L, 3)}·${serial(PLATE_SERIAL_D, 4)}` },
  // I-95 south of Delaware: the states the corridor actually runs through
  MD: { mdProud: true, bg: ['#f8f8f5', '#f8f8f5'], text: '#202c46', header: 'MARYLAND', headerFg: '#b3202c', footer: 'MARYLAND', footerFg: '#202c46', fmt: () => `${serial(PLATE_SERIAL_D, 1)}${serial(PLATE_SERIAL_L, 2)}${serial(PLATE_SERIAL_D, 4)}` },
  VA: { bg: ['#f7f8f5', '#eef0e8'], text: '#1b2a4a', header: 'VIRGINIA', headerFg: '#1b3f8f', footer: 'virginia.gov', footerFg: '#1b3f8f', fmt: () => `${serial(PLATE_SERIAL_L, 3)}·${serial(PLATE_SERIAL_D, 4)}` },
  SC: { bg: ['#eaf3fb', '#d6e6f4'], text: '#12356f', header: 'SOUTH CAROLINA', headerFg: '#1b3f8f', footer: 'While I Breathe I Hope', footerFg: '#1b3f8f', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 3)}` },
  // second real design per state, mixed in so a row of same-state cars isn't
  // identical — swapped in at a set chance in addNpcPlates (like NY/PA do)
  FL_ALT: { bg: ['#fdf6ea', '#f6e7cf'], text: '#151515', header: 'Florida', headerFg: '#e08a1e', footer: 'In God We Trust', footerFg: '#1f7a3d', oranges: true, fmt: () => `${serial(PLATE_SERIAL_L, 2)}${serial(PLATE_SERIAL_D, 1)} ${serial(PLATE_SERIAL_L, 1)}${serial(PLATE_SERIAL_D, 2)}` },
  GA_ALT: { bg: ['#eaf3ea', '#d7e8d7'], text: '#1b5e34', header: 'GEORGIA', headerFg: '#1b5e34', footer: 'georgia.gov', footerFg: '#1b5e34', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  NC_ALT: { bg: ['#f4f7fb', '#e2ecf6'], text: '#b3202c', header: 'NORTH CAROLINA', headerFg: '#12356f', footer: 'First in Freedom', footerFg: '#b3202c', fmt: () => `${serial(PLATE_SERIAL_L, 3)} ${serial(PLATE_SERIAL_D, 4)}` },
  VA_ALT: { bg: ['#fbf7f4', '#f0e6dc'], text: '#8a1b2a', header: 'VIRGINIA', headerFg: '#8a1b2a', footer: 'Virginia is for Lovers', footerFg: '#c8102e', fmt: () => `${serial(PLATE_SERIAL_L, 3)}·${serial(PLATE_SERIAL_D, 4)}` },
  SC_ALT: { bg: ['#eef2f6', '#dbe4ec'], text: '#12356f', header: 'SOUTH CAROLINA', headerFg: '#8a6a2a', footer: 'The Palmetto State', footerFg: '#1b5e34', fmt: () => `${serial(PLATE_SERIAL_D, 3)} ${serial(PLATE_SERIAL_L, 3)}` },
  MD_ALT: { bg: ['#f6f4ef', '#ece7db'], text: '#1b2a4a', header: 'MARYLAND', headerFg: '#1b3f8f', footer: 'Treasure the Chesapeake', footerFg: '#1f7a5a', fmt: () => `${serial(PLATE_SERIAL_L, 3)}·${serial(PLATE_SERIAL_D, 3)}` },
  // Indian plates: same layout everywhere, the state code is the tell.
  // White = private, yellow = commercial (taxis, rickshaws, tempos).
  MH: { india: 'MH' }, GJ: { india: 'GJ' }, KA: { india: 'KA' }, DL: { india: 'DL' },
  HR: { india: 'HR' }, UP: { india: 'UP' }, BR: { india: 'BR' }, JH: { india: 'JH' }, WB: { india: 'WB' }, PB: { india: 'PB' }, RJ: { india: 'RJ' },
  // European plates: the long single-line EU format with the blue stars band
  // and country letter on the left. NL runs yellow; older PT plates keep the
  // yellow date band on the right.
  PT: { euro: 'P',  ptBand: true, fmt: () => `${serial(PLATE_SERIAL_L, 2)}·${serial(PLATE_SERIAL_D, 2)}·${serial(PLATE_SERIAL_L, 2)}` },
  ES: { euro: 'E',  fmt: () => `${serial(PLATE_SERIAL_D, 4)} ${serial('BCDFGHJKLMNPRSTVWXYZ', 3)}` },
  DE: { euro: 'D',  deCity: true, fmt: () => `${serial(PLATE_SERIAL_L, 2)} ${serial(PLATE_SERIAL_D, 3 + ((Math.random() * 2) | 0))}` },
  FR: { euro: 'F',  fmt: () => `${serial(PLATE_SERIAL_L, 2)}-${serial(PLATE_SERIAL_D, 3)}-${serial(PLATE_SERIAL_L, 2)}` },
  NL: { euro: 'NL', yellow: true, fmt: () => `${serial(PLATE_SERIAL_D, 1)}-${serial(PLATE_SERIAL_L, 3)}-${serial(PLATE_SERIAL_D, 2)}` },
  BE: { euro: 'B',  fmt: () => `${serial(PLATE_SERIAL_D, 1)}-${serial(PLATE_SERIAL_L, 3)}-${serial(PLATE_SERIAL_D, 3)}` },
  PL: { euro: 'PL', fmt: () => `${serial(PLATE_SERIAL_L, 2)} ${serial(PLATE_SERIAL_D, 4)}${serial(PLATE_SERIAL_L, 1)}` },
  // Post-Brexit Britain: yellow plate, black text, NO EU star band
  GB: { euro: 'UK', yellow: true, noBand: true, fmt: () => `${serial(PLATE_SERIAL_L, 2)}${serial(PLATE_SERIAL_D, 2)} ${serial(PLATE_SERIAL_L, 3)}` },
  // Italy: blue bands BOTH sides (EU stars left, province/year right)
  IT: { euro: 'I', itBand: true, fmt: () => `${serial(PLATE_SERIAL_L, 2)} ${serial(PLATE_SERIAL_D, 3)} ${serial(PLATE_SERIAL_L, 2)}` },
  RO: { euro: 'RO', fmt: () => `${serial(PLATE_SERIAL_L, 1)} ${serial(PLATE_SERIAL_D, 2)} ${serial(PLATE_SERIAL_L, 3)}` },
  // Switzerland: NOT in the EU — white plate, black serial, NO blue star band.
  // Canton code + up to six digits, with the red band and white cross at right.
  CH: { euro: 'CH', noBand: true, chBand: true, fmt: () => `${['GE', 'VD', 'ZH', 'BE', 'LU', 'ZG', 'FR', 'AG', 'SG', 'TI'][(Math.random() * 10) | 0]} ${serial(PLATE_SERIAL_D, 6)}` },
  // Austria: EU band, black on white, district prefix
  AT: { euro: 'A', fmt: () => `${serial(PLATE_SERIAL_L, 1)} ${serial(PLATE_SERIAL_D, 3)} ${serial(PLATE_SERIAL_L, 2)}` },
};
// German plates carry the city registration prefix; A3 traffic reads
// Frankfurt / Wiesbaden / Limburg / Westerwald / Bonn / Köln by zone.
const DE_CITY_CODES = {
  de_ffm: ['F', 'F', 'OF', 'DA', 'GG'], de_wiesbaden: ['WI', 'MTK', 'F', 'MZ'],
  de_taunus: ['RÜD', 'LM', 'WI', 'F'], de_limburg: ['LM', 'LM', 'WW', 'F'],
  de_montabaur: ['WW', 'WW', 'MYK', 'K'], de_westerwald: ['WW', 'NR', 'AK', 'K'],
  de_siebengebirge: ['SU', 'NR', 'BN', 'K'], de_bonn: ['BN', 'SU', 'SU', 'K'],
  de_lohmar: ['SU', 'K', 'GL', 'BN'], de_koeln: ['K', 'K', 'K', 'BM', 'GL', 'LEV'],
};

// zone → [state, share] — home state dominant, neighbors passing through
const ZONE_PLATES = {
  // I-78: Pennsylvania dominates west of the Delaware, New Jersey takes over
  // east of it, and NY commuter plates become common near the Holland Tunnel.
  // The global wildcard pass below still injects occasional long-distance
  // Florida/Texas/California and other out-of-state registrations.
  i78_lebanon:    [['PA', .82], ['NJ', .06], ['NY', .04], ['MD', .03], ['VA', .02], ['OH', .03]],
  i78_blueridge:  [['PA', .80], ['NJ', .08], ['NY', .04], ['MD', .03], ['OH', .03], ['VA', .02]],
  i78_lehigh:     [['PA', .72], ['NJ', .17], ['NY', .05], ['DEL', .02], ['MD', .02], ['CT', .02]],
  i78_easton:     [['PA', .52], ['NJ', .34], ['NY', .07], ['DEL', .02], ['CT', .02], ['MD', .03]],
  i78_hunterdon:  [['NJ', .68], ['PA', .20], ['NY', .07], ['CT', .02], ['DEL', .01], ['VA', .02]],
  i78_watchung:   [['NJ', .74], ['NY', .13], ['PA', .08], ['CT', .02], ['FL', .01], ['VA', .02]],
  i78_newark:     [['NJ', .70], ['NY', .19], ['PA', .06], ['CT', .02], ['FL', .01], ['VA', .02]],
  i78_newarkbay:  [['NJ', .68], ['NY', .22], ['PA', .05], ['CT', .02], ['FL', .01], ['VA', .02]],
  i78_jerseycity: [['NJ', .62], ['NY', .28], ['PA', .05], ['CT', .02], ['FL', .01], ['VA', .02]],
  i78_holland:    [['NJ', .54], ['NY', .36], ['PA', .05], ['CT', .02], ['FL', .01], ['VA', .02]],
  i78_manhattan:  [['NY', .56], ['NJ', .32], ['PA', .05], ['CT', .03], ['FL', .02], ['VA', .02]],
  i78_return:     [['NY', .50], ['NJ', .35], ['PA', .07], ['CT', .04], ['FL', .02], ['VA', .02]],
  chester_west: [['PA', .72], ['NJ', .10], ['DEL', .08], ['MD', .05], ['NY', .05]],
  chester_wooded: [['PA', .76], ['NJ', .09], ['DEL', .07], ['MD', .05], ['NY', .03]],
  chester_retail: [['PA', .68], ['NJ', .12], ['DEL', .10], ['MD', .06], ['NY', .04]],
  chester_school: [['PA', .78], ['NJ', .08], ['DEL', .07], ['MD', .04], ['NY', .03]],
  chester_south: [['PA', .64], ['DEL', .14], ['NJ', .11], ['MD', .07], ['NY', .04]],
  nh48_mumbai: [['MH', .78], ['GJ', .06], ['KA', .05], ['DL', .04], ['MH', .07]],
  nh48_panvel: [['MH', .76], ['KA', .09], ['GJ', .06], ['DL', .04], ['RJ', .05]],
  nh48_ghat: [['MH', .72], ['KA', .12], ['GJ', .07], ['DL', .04], ['RJ', .05]],
  nh48_pune: [['MH', .76], ['KA', .10], ['GJ', .06], ['DL', .04], ['RJ', .04]],
  nh48_satara: [['MH', .72], ['KA', .14], ['GJ', .06], ['DL', .03], ['RJ', .05]],
  nh48_karad: [['MH', .66], ['KA', .20], ['GJ', .06], ['DL', .03], ['RJ', .05]],
  nh48_kolhapur: [['MH', .58], ['KA', .30], ['GJ', .05], ['DL', .03], ['RJ', .04]],
  nh48_border: [['KA', .48], ['MH', .38], ['GJ', .06], ['DL', .03], ['RJ', .05]],
  nh48_belagavi: [['KA', .72], ['MH', .16], ['GJ', .05], ['DL', .03], ['RJ', .04]],
  nh48_hubballi: [['KA', .76], ['MH', .11], ['GJ', .05], ['DL', .03], ['RJ', .05]],
  nh48_haveri: [['KA', .70], ['MH', .14], ['GJ', .06], ['DL', .04], ['RJ', .06]],
  nh48_davanagere: [['KA', .74], ['MH', .12], ['GJ', .05], ['DL', .04], ['RJ', .05]],
  nh48_tumakuru: [['KA', .78], ['MH', .10], ['GJ', .04], ['DL', .04], ['RJ', .04]],
  nh48_bengaluru: [['KA', .82], ['MH', .08], ['GJ', .03], ['DL', .04], ['RJ', .03]],
  newhaven: [['CT', 0.56], ['NY', 0.17], ['NJ', 0.10], ['PA', 0.08], ['MA', 0.04], ['VA', 0.03], ['MD', 0.02]],
  dk_delhi: [['DL', .72], ['HR', .12], ['UP', .12], ['RJ', .04]],
  dk_ghaziabad: [['UP', .70], ['DL', .16], ['HR', .08], ['RJ', .06]],
  dk_aligarh: [['UP', .82], ['DL', .06], ['HR', .05], ['BR', .04], ['RJ', .03]],
  dk_etawah: [['UP', .86], ['DL', .04], ['BR', .04], ['RJ', .03], ['PB', .03]],
  dk_kanpur: [['UP', .84], ['DL', .05], ['BR', .05], ['RJ', .03], ['PB', .03]],
  dk_fatehpur: [['UP', .83], ['BR', .07], ['DL', .04], ['PB', .03], ['RJ', .03]],
  dk_prayagraj: [['UP', .80], ['BR', .09], ['DL', .04], ['PB', .04], ['JH', .03]],
  dk_mirzapur: [['UP', .76], ['BR', .12], ['DL', .04], ['JH', .04], ['PB', .04]],
  dk_varanasi: [['UP', .72], ['BR', .15], ['DL', .04], ['JH', .05], ['WB', .04]],
  dk_chandauli: [['UP', .62], ['BR', .21], ['JH', .08], ['DL', .04], ['WB', .05]],
  dk_mohania: [['BR', .70], ['UP', .15], ['JH', .07], ['WB', .04], ['DL', .04]],
  dk_sasaram: [['BR', .78], ['UP', .08], ['JH', .08], ['WB', .03], ['DL', .03]],
  dk_aurangabad: [['BR', .80], ['JH', .10], ['UP', .05], ['WB', .03], ['DL', .02]],
  dk_gaya: [['BR', .72], ['JH', .16], ['UP', .05], ['WB', .04], ['DL', .03]],
  dk_barhi: [['JH', .55], ['BR', .27], ['UP', .05], ['WB', .08], ['DL', .05]],
  dk_hazaribagh: [['JH', .72], ['BR', .16], ['WB', .06], ['UP', .03], ['DL', .03]],
  dk_dhanbad: [['JH', .70], ['WB', .13], ['BR', .10], ['UP', .04], ['DL', .03]],
  dk_asansol: [['WB', .58], ['JH', .24], ['BR', .10], ['UP', .05], ['DL', .03]],
  dk_durgapur: [['WB', .72], ['JH', .12], ['BR', .08], ['UP', .05], ['DL', .03]],
  dk_bardhaman: [['WB', .80], ['BR', .08], ['JH', .06], ['UP', .03], ['DL', .03]],
  dk_dankuni: [['WB', .84], ['BR', .07], ['JH', .04], ['UP', .03], ['DL', .02]],
  dk_kolkata: [['WB', .86], ['BR', .06], ['JH', .03], ['UP', .03], ['DL', .02]],
  corridor: [['CT', 0.52], ['NY', 0.19], ['NJ', 0.10], ['PA', 0.08], ['MA', 0.04], ['VA', 0.04], ['MD', 0.03]],
  // Chicago → Indiana → Ohio: home-state plates dominate, but this is a major
  // freight/commuter corridor, so neighboring states and national travelers
  // remain visible instead of every car sharing one local plate.
  ord: [['IL', .62], ['IN', .10], ['WI', .07], ['MI', .06], ['OH', .05], ['IA', .04], ['MO', .03], ['KY', .03]],
  skyway: [['IL', .36], ['IN', .34], ['MI', .08], ['OH', .08], ['WI', .05], ['KY', .05], ['IA', .04]],
  i80: [['IN', .44], ['IL', .28], ['MI', .08], ['OH', .08], ['KY', .05], ['IA', .04], ['MO', .03]],
  gary: [['IN', .62], ['IL', .20], ['MI', .07], ['OH', .05], ['KY', .03], ['IA', .03]],
  i65: [['IN', .66], ['IL', .10], ['OH', .08], ['KY', .07], ['MI', .04], ['IA', .03], ['MO', .02]],
  indy: [['IN', .68], ['OH', .10], ['IL', .08], ['KY', .06], ['MI', .04], ['TN', .02], ['PA', .02]],
  i74: [['IN', .52], ['OH', .20], ['KY', .10], ['IL', .07], ['MI', .04], ['PA', .03], ['TN', .02], ['NC', .02]],
  hills: [['IN', .55], ['OH', .18], ['KY', .12], ['IL', .06], ['PA', .03], ['TN', .03], ['NC', .03]],
  cincy: [['OH', .52], ['KY', .25], ['IN', .10], ['IL', .05], ['TN', .03], ['PA', .03], ['MI', .02]],
  downtown: [['OH', .46], ['KY', .30], ['IN', .10], ['IL', .05], ['PA', .03], ['TN', .03], ['NC', .03]],
  millcreek: [['OH', .48], ['KY', .24], ['IN', .12], ['IL', .05], ['PA', .04], ['TN', .04], ['NC', .03]],
  sharonville: [['OH', .58], ['KY', .16], ['IN', .10], ['IL', .05], ['MI', .04], ['PA', .04], ['TN', .03]],
  wchester75: [['OH', .64], ['KY', .12], ['IN', .08], ['IL', .05], ['MI', .04], ['PA', .04], ['TN', .03]],
  // I-95 northeast extension: MA/RI/CT dominant with a little NY/NJ
  boston95:   [['MA', 0.66], ['RI', 0.09], ['CT', 0.08], ['NY', 0.06], ['NJ', 0.05], ['PA', 0.03], ['VA', 0.03]],
  providence: [['RI', 0.55], ['MA', 0.20], ['CT', 0.09], ['NY', 0.07], ['NJ', 0.05], ['PA', 0.04]],
  ctshore:    [['CT', 0.62], ['RI', 0.10], ['MA', 0.08], ['NY', 0.08], ['NJ', 0.06], ['PA', 0.04], ['VA', 0.02]],
  // I-95 true-scale south, DE → FL. Home-state dominant, with the corridor's
  // heavy through-traffic mixed in — and a growing FL/snowbird share the
  // further south you get (I-95 is the great North-South migration route).
  de_newark:  [['DEL', 0.42], ['PA', 0.20], ['NJ', 0.16], ['MD', 0.14], ['NY', 0.08]],
  de_wilmington: [['DEL', 0.46], ['PA', 0.20], ['NJ', 0.14], ['MD', 0.14], ['NY', 0.06]],
  md_perryville: [['MD', 0.66], ['DEL', 0.10], ['PA', 0.12], ['VA', 0.06], ['NJ', 0.06]],
  md_harford:  [['MD', 0.74], ['PA', 0.10], ['VA', 0.06], ['DEL', 0.05], ['NJ', 0.05]],
  md_baltimore:[['MD', 0.80], ['VA', 0.07], ['PA', 0.07], ['DEL', 0.03], ['NC', 0.03]],
  md_laurel:   [['MD', 0.78], ['VA', 0.12], ['PA', 0.05], ['NC', 0.05]],
  md_beltway:  [['MD', 0.56], ['VA', 0.34], ['PA', 0.04], ['NC', 0.03], ['FL', 0.03]],
  va_springfield: [['VA', 0.66], ['MD', 0.24], ['NC', 0.05], ['PA', 0.03], ['FL', 0.02]],
  va_fredvburg:[['VA', 0.78], ['MD', 0.12], ['NC', 0.05], ['FL', 0.03], ['PA', 0.02]],
  va_ashland:  [['VA', 0.82], ['NC', 0.08], ['MD', 0.05], ['FL', 0.03], ['TN', 0.02]],
  va_richmond: [['VA', 0.84], ['NC', 0.07], ['MD', 0.04], ['FL', 0.03], ['TN', 0.02]],
  va_petersburg: [['VA', 0.80], ['NC', 0.10], ['MD', 0.04], ['FL', 0.04], ['TN', 0.02]],
  va_southside:[['VA', 0.72], ['NC', 0.16], ['FL', 0.05], ['MD', 0.04], ['TN', 0.03]],
  nc_roanokerap: [['NC', 0.74], ['VA', 0.14], ['FL', 0.05], ['SC', 0.04], ['TN', 0.03]],
  nc_rockymount: [['NC', 0.80], ['VA', 0.08], ['FL', 0.05], ['SC', 0.04], ['TN', 0.03]],
  nc_fayetteville: [['NC', 0.82], ['SC', 0.06], ['VA', 0.05], ['FL', 0.04], ['TN', 0.03]],
  nc_lumberton: [['NC', 0.76], ['SC', 0.12], ['VA', 0.04], ['FL', 0.05], ['TN', 0.03]],
  nc40_east: [['NC', 0.78], ['VA', 0.08], ['SC', 0.06], ['GA', 0.04], ['TN', 0.04]],
  nc40_benson: [['NC', 0.84], ['VA', 0.06], ['SC', 0.05], ['GA', 0.03], ['TN', 0.02]],
  nc40_johnston: [['NC', 0.86], ['VA', 0.05], ['SC', 0.04], ['GA', 0.03], ['TN', 0.02]],
  nc40_raleigh: [['NC', 0.88], ['VA', 0.04], ['SC', 0.03], ['GA', 0.03], ['TN', 0.02]],
  nc40_triangle: [['NC', 0.82], ['VA', 0.06], ['SC', 0.04], ['GA', 0.04], ['TN', 0.04]],
  nc40_burlington: [['NC', 0.84], ['VA', 0.07], ['SC', 0.04], ['GA', 0.03], ['TN', 0.02]],
  nc40_greensboro: [['NC', 0.82], ['VA', 0.08], ['SC', 0.04], ['GA', 0.03], ['TN', 0.03]],
  nc40_highpoint: [['NC', 0.84], ['VA', 0.06], ['SC', 0.04], ['GA', 0.03], ['TN', 0.03]],
  nc40_salisbury: [['NC', 0.80], ['SC', 0.08], ['VA', 0.05], ['GA', 0.04], ['TN', 0.03]],
  nc40_charlotte: [['NC', 0.78], ['SC', 0.10], ['GA', 0.05], ['VA', 0.04], ['TN', 0.03]],
  sc_dillon:   [['SC', 0.72], ['NC', 0.16], ['FL', 0.06], ['VA', 0.03], ['GA', 0.03]],
  sc_florence: [['SC', 0.80], ['NC', 0.08], ['FL', 0.06], ['GA', 0.03], ['VA', 0.03]],
  sc_santee:   [['SC', 0.78], ['NC', 0.07], ['FL', 0.08], ['GA', 0.04], ['VA', 0.03]],
  sc_walterboro: [['SC', 0.76], ['GA', 0.09], ['FL', 0.08], ['NC', 0.04], ['VA', 0.03]],
  ga_midway:   [['GA', 0.76], ['SC', 0.08], ['FL', 0.10], ['NC', 0.03], ['TN', 0.03]],
  ga_savannah: [['GA', 0.80], ['SC', 0.09], ['FL', 0.06], ['NC', 0.03], ['TN', 0.02]],
  ga_kingsland:[['GA', 0.68], ['FL', 0.22], ['SC', 0.05], ['NC', 0.03], ['TN', 0.02]],
  fl_jax:      [['FL', 0.78], ['GA', 0.10], ['SC', 0.03], ['NC', 0.03], ['NY', 0.02], ['NJ', 0.02], ['TX', 0.02]],
  fl_daytona:  [['FL', 0.80], ['GA', 0.06], ['NC', 0.03], ['NY', 0.04], ['NJ', 0.03], ['PA', 0.02], ['TX', 0.02]],
  fl_melbourne:[['FL', 0.79], ['GA', 0.04], ['NY', 0.05], ['NJ', 0.04], ['PA', 0.03], ['MA', 0.02], ['TX', 0.03]],
  fl_stlucie:  [['FL', 0.78], ['NY', 0.06], ['NJ', 0.05], ['PA', 0.04], ['MA', 0.02], ['CT', 0.02], ['TX', 0.03]],
  fl_wpb:      [['FL', 0.74], ['NY', 0.08], ['NJ', 0.07], ['PA', 0.04], ['MA', 0.02], ['CT', 0.02], ['IL', 0.01], ['TX', 0.02]],
  fl_ftlaud:   [['FL', 0.75], ['NY', 0.08], ['NJ', 0.06], ['PA', 0.04], ['MA', 0.02], ['CT', 0.02], ['IL', 0.01], ['TX', 0.02]],
  fl_miami:    [['FL', 0.74], ['NY', 0.09], ['NJ', 0.07], ['PA', 0.04], ['MA', 0.02], ['CT', 0.02], ['IL', 0.01], ['TX', 0.01]],
  tx_dallas: [['TX', 0.78], ['GA', 0.06], ['NC', 0.05], ['CA', 0.05], ['FL', 0.03], ['TN', 0.03]],
  tx_lancaster: [['TX', 0.82], ['GA', 0.06], ['NC', 0.05], ['CA', 0.04], ['FL', 0.03]],
  tx_corsicana: [['TX', 0.84], ['GA', 0.05], ['NC', 0.05], ['CA', 0.03], ['FL', 0.03]],
  tx_palestine: [['TX', 0.86], ['GA', 0.06], ['NC', 0.04], ['CA', 0.03], ['FL', 0.01]],
  tx_huntsville: [['TX', 0.84], ['GA', 0.07], ['NC', 0.04], ['CA', 0.03], ['FL', 0.02]],
  tx_woodlands: [['TX', 0.82], ['GA', 0.06], ['NC', 0.04], ['CA', 0.03], ['FL', 0.03], ['TN', 0.02]],
  tx_houston: [['TX', 0.78], ['GA', 0.08], ['FL', 0.04], ['CA', 0.04], ['NC', 0.03], ['TN', 0.03]],
  fltp_miami: [['FL', 0.74], ['NY', 0.09], ['NJ', 0.07], ['PA', 0.04], ['MA', 0.02], ['CT', 0.02], ['IL', 0.01], ['TX', 0.01]],
  fltp_broward: [['FL', 0.76], ['NY', 0.08], ['NJ', 0.07], ['PA', 0.04], ['MA', 0.02], ['CT', 0.01], ['GA', 0.01], ['TX', 0.01]],
  fltp_treasure: [['FL', 0.80], ['NY', 0.06], ['NJ', 0.05], ['PA', 0.03], ['MA', 0.02], ['GA', 0.02], ['TX', 0.02]],
  fltp_palm: [['FL', 0.76], ['NY', 0.08], ['NJ', 0.06], ['PA', 0.04], ['MA', 0.02], ['CT', 0.02], ['GA', 0.01], ['TX', 0.01]],
  fltp_lake: [['FL', 0.82], ['GA', 0.06], ['NY', 0.04], ['NJ', 0.03], ['PA', 0.02], ['TX', 0.03]],
  fltp_orlando: [['FL', 0.78], ['GA', 0.05], ['NY', 0.05], ['NJ', 0.04], ['PA', 0.03], ['MA', 0.01], ['TX', 0.04]],
  fltp_ocala: [['FL', 0.82], ['GA', 0.08], ['NY', 0.03], ['NJ', 0.02], ['PA', 0.02], ['TX', 0.03]],
  fltp_wildwood: [['FL', 0.78], ['GA', 0.11], ['NY', 0.04], ['NJ', 0.02], ['PA', 0.02], ['TX', 0.03]],
  // I-5 California: CA dominates, with real western through-traffic. Trucks
  // are separately mixed through TRUCK_PLATE_POOL below.
  cal5_la: [['CA', 0.90], ['AZ', 0.03], ['NV', 0.025], ['TX', 0.03], ['FL', 0.015]],
  cal5_santaclarita: [['CA', 0.92], ['AZ', 0.03], ['NV', 0.025], ['TX', 0.02], ['OR', 0.005]],
  cal5_tejon: [['CA', 0.82], ['AZ', 0.06], ['NV', 0.05], ['TX', 0.05], ['OR', 0.02]],
  cal5_bakersfield: [['CA', 0.86], ['TX', 0.05], ['AZ', 0.04], ['NV', 0.03], ['OR', 0.02]],
  cal5_valley: [['CA', 0.89], ['TX', 0.04], ['AZ', 0.03], ['NV', 0.02], ['OR', 0.02]],
  cal5_pacheco: [['CA', 0.92], ['OR', 0.025], ['NV', 0.02], ['AZ', 0.02], ['TX', 0.015]],
  cal5_silicon: [['CA', 0.95], ['OR', 0.02], ['NV', 0.015], ['TX', 0.01], ['AZ', 0.005]],
  cal5_sf: [['CA', 0.95], ['OR', 0.03], ['NV', 0.01], ['TX', 0.01]],
  // Garden State Parkway: overwhelmingly NJ, a little NY up toward the line
  gsp_i95: [['NJ', 0.88], ['NY', 0.07], ['PA', 0.05]],
  gsp_rahway: [['NJ', 0.90], ['NY', 0.06], ['PA', 0.04]],
  gsp_union: [['NJ', 0.90], ['NY', 0.06], ['PA', 0.04]],
  gsp_essex: [['NJ', 0.90], ['NY', 0.06], ['PA', 0.04]],
  gsp_clifton: [['NJ', 0.89], ['NY', 0.08], ['PA', 0.03]],
  gsp_paterson: [['NJ', 0.88], ['NY', 0.09], ['PA', 0.03]],
  gsp_north: [['NJ', 0.82], ['NY', 0.15], ['CT', 0.03]],
  gsp_ny: [['NJ', 0.70], ['NY', 0.26], ['CT', 0.04]],
  // GSP south: shore traffic — the summer PA/NY "shoobie" mix thickens near
  // the beach exits, the Pine Barrens are pure NJ
  gsp_capemay:  [['NJ', 0.66], ['PA', 0.20], ['NY', 0.09], ['DE', 0.05]],
  gsp_seashore: [['NJ', 0.68], ['PA', 0.20], ['NY', 0.09], ['DE', 0.03]],
  gsp_atlantic: [['NJ', 0.70], ['PA', 0.20], ['NY', 0.08], ['DE', 0.02]],
  gsp_pines:    [['NJ', 0.86], ['PA', 0.09], ['NY', 0.05]],
  gsp_ocean:    [['NJ', 0.84], ['PA', 0.08], ['NY', 0.08]],
  gsp_lakewood: [['NJ', 0.86], ['NY', 0.09], ['PA', 0.05]],
  gsp_monmouth: [['NJ', 0.87], ['NY', 0.09], ['PA', 0.04]],
  gsp_raritan:  [['NJ', 0.88], ['NY', 0.08], ['PA', 0.04]],
  // Philly → AC: PA-heavy on the Philly end, flipping to NJ across the river,
  // and a thick PA casino-run share the whole way down the expressway
  philly76:   [['PA', 0.84], ['NJ', 0.12], ['DE', 0.04]],
  wwb:        [['PA', 0.62], ['NJ', 0.33], ['DE', 0.05]],
  gloucester: [['NJ', 0.76], ['PA', 0.20], ['DE', 0.04]],
  nj42:       [['NJ', 0.82], ['PA', 0.14], ['DE', 0.04]],
  acx_west:   [['NJ', 0.70], ['PA', 0.25], ['DE', 0.05]],
  acx_pines:  [['NJ', 0.70], ['PA', 0.26], ['NY', 0.04]],
  acx_egg:    [['NJ', 0.72], ['PA', 0.22], ['NY', 0.06]],
  acx_ac:     [['NJ', 0.60], ['PA', 0.28], ['NY', 0.09], ['DE', 0.03]],
  // US-1 New Jersey: overwhelmingly NJ; a little PA near Trenton, more NY
  // commuter traffic toward Newark and Jersey City
  trenton:     [['NJ', 0.82], ['PA', 0.12], ['NY', 0.04], ['DE', 0.02]],
  lawrence:    [['NJ', 0.85], ['PA', 0.09], ['NY', 0.06]],
  princeton:   [['NJ', 0.84], ['PA', 0.08], ['NY', 0.08]],
  nbrunswick:  [['NJ', 0.88], ['NY', 0.07], ['PA', 0.05]],
  newbrunswick:[['NJ', 0.87], ['NY', 0.08], ['PA', 0.05]],
  edison:      [['NJ', 0.88], ['NY', 0.08], ['PA', 0.04]],
  iselin:      [['NJ', 0.87], ['NY', 0.10], ['PA', 0.03]],
  woodbridge:  [['NJ', 0.86], ['NY', 0.11], ['PA', 0.03]],
  linden:      [['NJ', 0.85], ['NY', 0.12], ['PA', 0.03]],
  elizabeth:   [['NJ', 0.83], ['NY', 0.14], ['PA', 0.03]],
  newark1:     [['NJ', 0.80], ['NY', 0.17], ['PA', 0.03]],
  pulaski:     [['NJ', 0.78], ['NY', 0.19], ['CT', 0.03]],
  jerseycity:  [['NJ', 0.74], ['NY', 0.23], ['CT', 0.03]],
  us1_return:  [['NJ', 0.86], ['NY', 0.09], ['PA', 0.05]],
  // Bay Area: overwhelmingly California (a rare out-of-state via the wildcard remap)
  sf: [['CA', 0.96], ['TX', 0.04]],
  baybridge: [['CA', 0.96], ['TX', 0.04]],
  oakland: [['CA', 0.97], ['TX', 0.03]],
  i580: [['CA', 0.97], ['TX', 0.03]],
  dublin: [['CA', 0.97], ['TX', 0.03]],
  i680: [['CA', 0.97], ['TX', 0.03]],
  vallejo: [['CA', 0.97], ['TX', 0.03]],
  richmond: [['CA', 0.97], ['TX', 0.03]],
  eastbay: [['CA', 0.96], ['TX', 0.04]],
  // NYC → Long Island: overwhelmingly NY, a little NJ/CT passing through the city
  gwb: [['NY', 0.66], ['NJ', 0.28], ['CT', 0.06]],
  i278_nj440: [['NJ', 0.46], ['NY', 0.28], ['PA', 0.08], ['CT', 0.06], ['MA', 0.04], ['VA', 0.04], ['NC', 0.04]],
  i278_outerbridge: [['NJ', 0.40], ['NY', 0.40], ['PA', 0.07], ['CT', 0.05], ['MA', 0.03], ['VA', 0.03], ['NC', 0.02]],
  i278_westshore: [['NY', 0.56], ['NJ', 0.26], ['PA', 0.06], ['CT', 0.05], ['MA', 0.03], ['VA', 0.02], ['NC', 0.02]],
  i278_staten: [['NY', 0.62], ['NJ', 0.22], ['CT', 0.06], ['PA', 0.04], ['MA', 0.03], ['VA', 0.02], ['NC', 0.01]],
  i278_verrazzano: [['NY', 0.68], ['NJ', 0.18], ['CT', 0.06], ['PA', 0.04], ['MA', 0.02], ['VA', 0.01], ['NC', 0.01]],
  i278_brooklyn: [['NY', 0.72], ['NJ', 0.14], ['CT', 0.05], ['PA', 0.04], ['MA', 0.02], ['VA', 0.02], ['NC', 0.01]],
  i278_brooklyn_south: [['NY', 0.74], ['NJ', 0.13], ['CT', 0.05], ['PA', 0.03], ['MA', 0.02], ['VA', 0.02], ['NC', 0.01]],
  i278_kosciuszko: [['NY', 0.70], ['NJ', 0.15], ['CT', 0.05], ['PA', 0.04], ['MA', 0.03], ['VA', 0.02], ['NC', 0.01]],
  i278_queens: [['NY', 0.66], ['NJ', 0.16], ['CT', 0.06], ['PA', 0.04], ['MA', 0.03], ['VA', 0.03], ['NC', 0.02]],
  i278_rfk_approach: [['NY', 0.68], ['NJ', 0.15], ['CT', 0.06], ['PA', 0.04], ['MA', 0.03], ['VA', 0.02], ['NC', 0.02]],
  i278_rfk: [['NY', 0.64], ['NJ', 0.17], ['CT', 0.07], ['PA', 0.04], ['MA', 0.03], ['VA', 0.03], ['NC', 0.02]],
  i278_bronx: [['NY', 0.70], ['NJ', 0.15], ['CT', 0.06], ['PA', 0.04], ['MA', 0.02], ['VA', 0.02], ['NC', 0.01]],
  brp_kensico: [['NY', .84], ['CT', .09], ['NJ', .07]],
  brp_scarsdale: [['NY', .88], ['CT', .07], ['NJ', .05]],
  brp_bronxville: [['NY', .90], ['CT', .06], ['NJ', .04]],
  brp_woodlawn: [['NY', .91], ['NJ', .05], ['CT', .04]],
  brp_bronx: [['NY', .92], ['NJ', .05], ['CT', .03]],
  brp_story: [['NY', .93], ['NJ', .05], ['CT', .02]],
  brp_bruckner: [['NY', .90], ['NJ', .07], ['CT', .03]],
  brp_i295_bronx: [['NY', .89], ['NJ', .07], ['CT', .04]],
  brp_throgs: [['NY', .90], ['NJ', .06], ['CT', .04]],
  brp_bayside: [['NY', .94], ['NJ', .04], ['CT', .02]],
  brp_i495: [['NY', .95], ['NJ', .03], ['CT', .02]],
  brp_queensvillage: [['NY', .95], ['NJ', .03], ['CT', .02]],
  washheights: [['NY', 0.82], ['NJ', 0.12], ['CT', 0.06]],
  harlem: [['NY', 0.86], ['NJ', 0.09], ['CT', 0.05]],
  ues: [['NY', 0.88], ['NJ', 0.07], ['CT', 0.05]],
  midtown: [['NY', 0.86], ['NJ', 0.09], ['CT', 0.05]],
  tunnel: [['NY', 0.84], ['NJ', 0.11], ['CT', 0.05]],
  lic: [['NY', 0.90], ['NJ', 0.06], ['CT', 0.04]],
  woodside: [['NY', 0.92], ['NJ', 0.05], ['CT', 0.03]],
  corona: [['NY', 0.93], ['NJ', 0.04], ['CT', 0.03]],
  flushing: [['NY', 0.93], ['NJ', 0.04], ['CT', 0.03]],
  newhydepark: [['NY', 0.94], ['NJ', 0.03], ['CT', 0.03]],
  mineola: [['NY', 0.95], ['NJ', 0.03], ['CT', 0.02]],
  jericho: [['NY', 0.95], ['NJ', 0.03], ['CT', 0.02]],
  li_return: [['NY', 0.95], ['NJ', 0.03], ['CT', 0.02]],
  westchester: [['NY', 0.70], ['CT', 0.18], ['NJ', 0.08], ['PA', 0.04]],
  bronx:    [['NY', 0.68], ['NJ', 0.15], ['CT', 0.12], ['PA', 0.05]],
  suburb:   [['NJ', 0.60], ['NY', 0.17], ['PA', 0.13], ['CT', 0.05], ['DE', 0.05]],
  nj_central: [['NJ', 0.52], ['PA', 0.16], ['NY', 0.14], ['CT', 0.06], ['DE', 0.05], ['MD', 0.04], ['VA', 0.03]],
  nj_industrial: [['NJ', 0.44], ['NY', 0.20], ['PA', 0.12], ['CT', 0.07], ['DE', 0.05], ['MD', 0.05], ['VA', 0.04], ['MA', 0.03]],
  njsouth:  [['NJ', 0.62], ['PA', 0.20], ['NY', 0.10], ['DE', 0.08]],
  perthamboy: [['NJ', 0.78], ['NY', 0.13], ['PA', 0.09]],
  piscataway: [['NJ', 0.80], ['NY', 0.12], ['PA', 0.08]],
  bridgewater: [['NJ', 0.82], ['NY', 0.10], ['PA', 0.08]],
  morristown: [['NJ', 0.80], ['NY', 0.14], ['PA', 0.06]],
  ramapo:   [['NJ', 0.70], ['NY', 0.26], ['PA', 0.04]],
  // New England branch: CT then MA dominant, with plenty of out-of-state
  // (NY, NJ) mixed in the way you actually see on I-91 / the Mass Pike.
  i91:      [['CT', 0.78], ['MA', 0.10], ['NY', 0.08], ['NJ', 0.04]],
  hartford: [['CT', 0.84], ['MA', 0.10], ['NY', 0.04], ['NJ', 0.02]],
  i84:      [['CT', 0.68], ['MA', 0.25], ['NY', 0.05], ['NJ', 0.02]],
  masspike: [['MA', 0.78], ['CT', 0.14], ['NY', 0.05], ['NJ', 0.03]],
  boston:   [['MA', 0.87], ['CT', 0.06], ['NY', 0.04], ['NJ', 0.03]],
  logan:    [['MA', 0.78], ['CT', 0.06], ['NY', 0.09], ['NJ', 0.07]],
  rockland: [['NY', 0.80], ['NJ', 0.16], ['CT', 0.04]],
  tappanzee:[['NY', 0.82], ['NJ', 0.13], ['CT', 0.05]],
  westch:   [['NY', 0.84], ['CT', 0.10], ['NJ', 0.06]],
  yonkers:  [['NY', 0.86], ['NJ', 0.08], ['CT', 0.06]],
  nybronx:  [['NY', 0.86], ['NJ', 0.10], ['CT', 0.04]],
  gwb287:   [['NY', 0.66], ['NJ', 0.28], ['CT', 0.06]],
  philly:   [['PA', 0.54], ['NJ', 0.20], ['DE', 0.08], ['NY', 0.07], ['MD', 0.04], ['VA', 0.04], ['CT', 0.03]],
  pa:       [['PA', 0.62], ['DE', 0.12], ['NJ', 0.10], ['NY', 0.07], ['MD', 0.04], ['VA', 0.03], ['CT', 0.02]],
  // I-80 GWB → Chicago: NJ commuters thin out into PA, then Ohio, then the
  // Indiana/Illinois mix near Chicago — with long-haul traffic all the way
  fortlee:  [['NJ', 0.62], ['NY', 0.24], ['PA', 0.10], ['CT', 0.04]],
  njsub80:  [['NJ', 0.72], ['NY', 0.16], ['PA', 0.12]],
  njgap:    [['NJ', 0.60], ['PA', 0.30], ['NY', 0.10]],
  poconos:  [['PA', 0.72], ['NJ', 0.18], ['NY', 0.10]],
  paridge:  [['PA', 0.82], ['NJ', 0.08], ['OH', 0.06], ['NY', 0.04]],
  paplat:   [['PA', 0.84], ['OH', 0.10], ['NJ', 0.06]],
  ohio80:   [['OH', 0.74], ['PA', 0.16], ['IN', 0.06], ['NY', 0.04]],
  cleveland:[['OH', 0.86], ['PA', 0.08], ['IN', 0.06]],
  toledo:   [['OH', 0.80], ['IN', 0.14], ['IL', 0.06]],
  inturnpike:[['IN', 0.62], ['OH', 0.18], ['IL', 0.16], ['KY', 0.04]],
  chi80:    [['IL', 0.58], ['IN', 0.36], ['OH', 0.06]],
  plains:   [['IL', 0.76], ['IN', 0.14], ['OH', 0.06], ['KY', 0.04]],
  flat:     [['IN', 0.70], ['IL', 0.16], ['OH', 0.09], ['KY', 0.05]],
  cincy:    [['OH', 0.60], ['KY', 0.28], ['IN', 0.12]], // NKY commuters everywhere
  ord:      [['IL', 0.88], ['IN', 0.08], ['OH', 0.04]],
  i90ken:   [['IL', 0.90], ['IN', 0.06], ['OH', 0.04]],
  chidt:    [['IL', 0.92], ['IN', 0.05], ['OH', 0.03]],
  danryan:  [['IL', 0.90], ['IN', 0.07], ['OH', 0.03]],
  skyway:   [['IL', 0.74], ['IN', 0.22], ['OH', 0.04]],
  i294:     [['IL', 0.76], ['IN', 0.12], ['WI', 0.05], ['MI', 0.03], ['OH', 0.02], ['KY', 0.02]],
  southland:[['IL', 0.62], ['IN', 0.25], ['WI', 0.04], ['MI', 0.04], ['OH', 0.03], ['KY', 0.02]],
  borman:   [['IN', 0.55], ['IL', 0.30], ['MI', 0.05], ['OH', 0.05], ['KY', 0.03], ['WI', 0.02]],
  i80:      [['IN', 0.54], ['IL', 0.42], ['OH', 0.04]],
  gary:     [['IN', 0.70], ['IL', 0.24], ['OH', 0.06]], // Chicagoland spillover
  i65:      [['IN', 0.80], ['IL', 0.10], ['OH', 0.06], ['KY', 0.04]],
  indy:     [['IN', 0.86], ['OH', 0.07], ['IL', 0.04], ['KY', 0.03]],
  i74:      [['IN', 0.76], ['OH', 0.16], ['KY', 0.05], ['IL', 0.03]],
  hills:    [['IN', 0.58], ['OH', 0.34], ['KY', 0.08]],
  downtown: [['OH', 0.58], ['KY', 0.30], ['IN', 0.12]],
  millcreek:  [['OH', 0.68], ['KY', 0.24], ['IN', 0.08]],
  sharonville:[['OH', 0.78], ['KY', 0.15], ['IN', 0.07]],
  wchester75: [['OH', 0.84], ['KY', 0.10], ['IN', 0.06]],
  middletown: [['OH', 0.88], ['KY', 0.07], ['IN', 0.05]],
  franklin75: [['OH', 0.90], ['KY', 0.06], ['IN', 0.04]],
  moraine:    [['OH', 0.92], ['KY', 0.04], ['IN', 0.04]],
  dayton:     [['OH', 0.92], ['IN', 0.05], ['KY', 0.03]],
  // Libertia borders Iowa, Illinois and Missouri; home plates dominate while
  // neighboring farm and freight traffic stays visible on every route.
  lib_west: [['LIB', 0.72], ['IA', 0.12], ['IL', 0.10], ['MO', 0.06]],
  lib_prairie: [['LIB', 0.78], ['IA', 0.08], ['IL', 0.09], ['MO', 0.05]],
  lib_ruralring: [['LIB', 0.82], ['IA', 0.03], ['IL', 0.10], ['MO', 0.05]],
  lib_reston: [['LIB', 0.86], ['IL', 0.08], ['IA', 0.02], ['MO', 0.04]],
  lib_corridor: [['LIB', 0.74], ['IL', 0.12], ['IA', 0.06], ['MO', 0.08]],
  lib_tp_reston: [['LIB', 0.76], ['IL', 0.10], ['IA', 0.05], ['MO', 0.09]],
  lib_tp_open: [['LIB', 0.68], ['IL', 0.12], ['IA', 0.08], ['MO', 0.12]],
  lib_jacobs: [['LIB', 0.82], ['IL', 0.12], ['IA', 0.02], ['MO', 0.04]],
  lib_jbelt: [['LIB', 0.86], ['IL', 0.09], ['IA', 0.02], ['MO', 0.03]],
  lib_east: [['LIB', 0.66], ['IL', 0.18], ['IA', 0.04], ['MO', 0.12]],
  // Companion Libertia routes: local plates dominate, with Illinois traffic
  // strongest around Jacobs/Reston and Iowa/Missouri traffic on the outer belts.
  i380_north: [['LIB', 0.86], ['IL', 0.08], ['IA', 0.03], ['MO', 0.03]],
  i380_east: [['LIB', 0.84], ['IL', 0.10], ['IA', 0.03], ['MO', 0.03]],
  i380_south: [['LIB', 0.82], ['IL', 0.10], ['IA', 0.04], ['MO', 0.04]],
  i380_west: [['LIB', 0.78], ['IA', 0.10], ['IL', 0.08], ['MO', 0.04]],
  i980_west: [['LIB', 0.68], ['MO', 0.16], ['IA', 0.10], ['IL', 0.06]],
  i980_north: [['LIB', 0.72], ['IL', 0.12], ['MO', 0.10], ['IA', 0.06]],
  i980_rural: [['LIB', 0.64], ['IA', 0.16], ['MO', 0.12], ['IL', 0.08]],
  i980_south: [['LIB', 0.70], ['MO', 0.14], ['IL', 0.10], ['IA', 0.06]],
  lb24_north: [['LIB', 0.80], ['IL', 0.12], ['IA', 0.04], ['MO', 0.04]],
  lb24_core: [['LIB', 0.74], ['IL', 0.20], ['IA', 0.03], ['MO', 0.03]],
  lb24_illinois: [['IL', 0.48], ['LIB', 0.40], ['IA', 0.07], ['MO', 0.05]],
  lb24_south: [['LIB', 0.82], ['IL', 0.10], ['IA', 0.04], ['MO', 0.04]],
  us67_jacobs: [['LIB', 0.68], ['IL', 0.22], ['IA', 0.05], ['MO', 0.05]],
  us67_farms: [['LIB', 0.62], ['IA', 0.16], ['IL', 0.12], ['MO', 0.10]],
  us67_towns: [['LIB', 0.68], ['IA', 0.12], ['IL', 0.12], ['MO', 0.08]],
  us67_reston_east: [['LIB', 0.94], ['IA', 0.03], ['MO', 0.03]],
  us67_reston_ne: [['LIB', 0.94], ['IA', 0.03], ['MO', 0.03]],
  us67_tunnel: [['LIB', 0.94], ['IA', 0.03], ['MO', 0.03]],
  // Delhi NCR: DL core, Haryana plates flood in from Gurgaon, UP from Noida
  d_gurgaon: [['HR', 0.52], ['DL', 0.34], ['UP', 0.09], ['PB', 0.05]],
  d_nh48:    [['DL', 0.48], ['HR', 0.38], ['UP', 0.10], ['RJ', 0.04]],
  d_igi:     [['DL', 0.55], ['HR', 0.28], ['UP', 0.13], ['PB', 0.04]],
  d_dhaula:  [['DL', 0.66], ['HR', 0.20], ['UP', 0.14]],
  d_lutyens: [['DL', 0.76], ['HR', 0.13], ['UP', 0.11]],
  d_cp:      [['DL', 0.74], ['UP', 0.14], ['HR', 0.12]],
  d_ito:     [['DL', 0.68], ['UP', 0.20], ['HR', 0.12]],
  d_yamuna:  [['DL', 0.52], ['UP', 0.36], ['HR', 0.12]],
  d_noida:   [['UP', 0.56], ['DL', 0.32], ['HR', 0.12]],
  d_ring:    [['DL', 0.70], ['HR', 0.16], ['UP', 0.14]],
  d_pbagh:   [['DL', 0.66], ['HR', 0.24], ['UP', 0.10]],
  d_bgarh:   [['HR', 0.55], ['DL', 0.35], ['UP', 0.10]],
  d_sampla:  [['HR', 0.74], ['DL', 0.20], ['UP', 0.06]],
  d_rohtak:  [['HR', 0.84], ['DL', 0.12], ['UP', 0.04]],
  mumbai:   [['MH', 0.88], ['GJ', 0.06], ['KA', 0.03], ['DL', 0.03]],
  chembur:  [['MH', 0.90], ['GJ', 0.05], ['KA', 0.03], ['DL', 0.02]],
  andheriW: [['MH', 0.92], ['GJ', 0.04], ['KA', 0.02], ['DL', 0.02]],
  airport:  [['MH', 0.86], ['GJ', 0.05], ['KA', 0.05], ['DL', 0.04]],
  bandra:   [['MH', 0.90], ['GJ', 0.05], ['KA', 0.03], ['DL', 0.02]],
  sealink:  [['MH', 0.90], ['GJ', 0.05], ['KA', 0.03], ['DL', 0.02]],
  marine:   [['MH', 0.90], ['GJ', 0.05], ['KA', 0.03], ['DL', 0.02]],
  puneX:    [['MH', 0.88], ['GJ', 0.05], ['KA', 0.07]],
  pcmc:     [['MH', 0.90], ['GJ', 0.04], ['KA', 0.06]],
  pune:     [['MH', 0.90], ['GJ', 0.04], ['KA', 0.06]],
  p_gaon:   [['MH', 0.96], ['KA', 0.02], ['GJ', 0.02]],
  p_aundh:  [['MH', 0.94], ['KA', 0.03], ['GJ', 0.03]],
  p_link:   [['MH', 0.94], ['KA', 0.03], ['GJ', 0.03]],
  p_baner:  [['MH', 0.90], ['KA', 0.05], ['DL', 0.02], ['GJ', 0.03]],   // IT-crowd transplants
  p_bale:   [['MH', 0.88], ['KA', 0.06], ['DL', 0.03], ['GJ', 0.03]],
  p_pashan: [['MH', 0.96], ['KA', 0.02], ['GJ', 0.02]],
  p_iti:    [['MH', 0.96], ['KA', 0.02], ['GJ', 0.02]],
  // Portugal A1: overwhelmingly PT, Spanish through-traffic, French emigrants
  // home for the summer (a real A1 sight)
  pt_lisboa: [['PT', 0.90], ['ES', 0.05], ['FR', 0.05]],
  pt_vfx: [['PT', 0.92], ['ES', 0.04], ['FR', 0.04]],
  pt_ribatejo: [['PT', 0.91], ['ES', 0.05], ['FR', 0.04]],
  pt_santarem: [['PT', 0.92], ['ES', 0.04], ['FR', 0.04]],
  pt_fatima: [['PT', 0.88], ['ES', 0.08], ['FR', 0.04]],   // pilgrim coaches
  pt_leiria: [['PT', 0.92], ['ES', 0.04], ['FR', 0.04]],
  pt_pombal: [['PT', 0.92], ['ES', 0.04], ['FR', 0.04]],
  pt_coimbra: [['PT', 0.92], ['ES', 0.04], ['FR', 0.04]],
  pt_bairrada: [['PT', 0.92], ['ES', 0.04], ['FR', 0.04]],
  pt_aveiro: [['PT', 0.92], ['ES', 0.04], ['FR', 0.04]],
  pt_gaia: [['PT', 0.93], ['ES', 0.04], ['FR', 0.03]],
  pt_porto: [['PT', 0.93], ['ES', 0.04], ['FR', 0.03]],
  // Spain A-4: Spanish with Portuguese and French passing through
  es_madrid: [['ES', 0.93], ['PT', 0.02], ['FR', 0.05]],
  es_sur: [['ES', 0.94], ['PT', 0.02], ['FR', 0.04]],
  es_aranjuez: [['ES', 0.94], ['PT', 0.02], ['FR', 0.04]],
  es_ocana: [['ES', 0.93], ['PT', 0.03], ['FR', 0.04]],
  es_mancha: [['ES', 0.93], ['PT', 0.03], ['FR', 0.04]],
  es_valdepenas: [['ES', 0.94], ['PT', 0.03], ['FR', 0.03]],
  es_despena: [['ES', 0.93], ['PT', 0.04], ['FR', 0.03]],
  es_bailen: [['ES', 0.94], ['PT', 0.03], ['FR', 0.03]],
  es_andujar: [['ES', 0.94], ['PT', 0.03], ['FR', 0.03]],
  es_cordoba: [['ES', 0.95], ['PT', 0.02], ['FR', 0.03]],
  es_ecija: [['ES', 0.95], ['PT', 0.02], ['FR', 0.03]],
  es_carmona: [['ES', 0.95], ['PT', 0.02], ['FR', 0.03]],
  es_sevilla: [['ES', 0.95], ['PT', 0.02], ['FR', 0.03]],
  // Germany A3: the Benelux/Polish long-haul corridor — Dutch and Belgian
  // commuters near Köln, Polish trucks the whole way
  de_ffm: [['DE', 0.87], ['NL', 0.04], ['PL', 0.04], ['FR', 0.03], ['BE', 0.02]],
  de_wiesbaden: [['DE', 0.89], ['NL', 0.04], ['PL', 0.04], ['BE', 0.03]],
  de_taunus: [['DE', 0.88], ['NL', 0.05], ['PL', 0.04], ['BE', 0.03]],
  de_limburg: [['DE', 0.88], ['NL', 0.05], ['PL', 0.04], ['BE', 0.03]],
  de_montabaur: [['DE', 0.88], ['NL', 0.05], ['PL', 0.04], ['BE', 0.03]],
  de_westerwald: [['DE', 0.87], ['NL', 0.05], ['PL', 0.05], ['BE', 0.03]],
  de_siebengebirge: [['DE', 0.87], ['NL', 0.06], ['PL', 0.04], ['BE', 0.03]],
  de_bonn: [['DE', 0.86], ['NL', 0.06], ['PL', 0.04], ['BE', 0.04]],
  de_lohmar: [['DE', 0.87], ['NL', 0.06], ['PL', 0.04], ['BE', 0.03]],
  de_koeln: [['DE', 0.85], ['NL', 0.07], ['PL', 0.04], ['BE', 0.04]],
  // Britain: overwhelmingly GB; continental plates thicken toward the Channel
  uk_bham: [['GB', 0.96], ['PL', 0.02], ['FR', 0.02]],
  uk_m6: [['GB', 0.96], ['PL', 0.02], ['FR', 0.02]],
  uk_m1n: [['GB', 0.95], ['PL', 0.03], ['FR', 0.02]],
  uk_mk: [['GB', 0.95], ['PL', 0.03], ['FR', 0.02]],
  uk_luton: [['GB', 0.94], ['PL', 0.04], ['FR', 0.02]],
  uk_nlondon: [['GB', 0.94], ['PL', 0.03], ['FR', 0.03]],
  uk_london: [['GB', 0.93], ['PL', 0.03], ['FR', 0.02], ['NL', 0.02]],
  uk_slondon: [['GB', 0.93], ['PL', 0.03], ['FR', 0.04]],
  uk_m20w: [['GB', 0.90], ['PL', 0.04], ['FR', 0.04], ['NL', 0.02]],
  uk_kent: [['GB', 0.88], ['PL', 0.05], ['FR', 0.05], ['NL', 0.02]],
  uk_ashford: [['GB', 0.86], ['PL', 0.06], ['FR', 0.06], ['NL', 0.02]],
  uk_dover: [['GB', 0.78], ['PL', 0.08], ['FR', 0.10], ['NL', 0.04]],
  // France A16: GB plates pour off the Shuttle at Calais, fading toward Paris
  fr_calais: [['FR', 0.72], ['GB', 0.18], ['BE', 0.05], ['PL', 0.03], ['NL', 0.02]],
  fr_boulogne: [['FR', 0.80], ['GB', 0.12], ['BE', 0.04], ['PL', 0.04]],
  fr_opale: [['FR', 0.84], ['GB', 0.08], ['BE', 0.04], ['PL', 0.04]],
  fr_somme: [['FR', 0.88], ['GB', 0.05], ['BE', 0.04], ['PL', 0.03]],
  fr_amiens: [['FR', 0.90], ['GB', 0.04], ['BE', 0.03], ['PL', 0.03]],
  fr_picardie: [['FR', 0.90], ['GB', 0.04], ['BE', 0.03], ['PL', 0.03]],
  fr_beauvais: [['FR', 0.92], ['GB', 0.03], ['BE', 0.03], ['PL', 0.02]],
  fr_oise: [['FR', 0.93], ['GB', 0.03], ['BE', 0.02], ['PL', 0.02]],
  fr_stdenis: [['FR', 0.94], ['GB', 0.02], ['BE', 0.02], ['PL', 0.02]],
  fr_paris: [['FR', 0.94], ['GB', 0.02], ['BE', 0.02], ['PL', 0.02]],
  // Italy A1: nearly all Italian, the odd northern tourist or eastern truck
  it_roma: [['IT', 0.95], ['DE', 0.02], ['FR', 0.02], ['RO', 0.01]],
  it_castelli: [['IT', 0.95], ['DE', 0.02], ['FR', 0.01], ['RO', 0.02]],
  it_colleferro: [['IT', 0.95], ['DE', 0.02], ['FR', 0.01], ['RO', 0.02]],
  it_frosinone: [['IT', 0.95], ['DE', 0.02], ['FR', 0.01], ['RO', 0.02]],
  it_ceprano: [['IT', 0.95], ['DE', 0.02], ['FR', 0.01], ['RO', 0.02]],
  it_cassino: [['IT', 0.94], ['DE', 0.03], ['FR', 0.01], ['RO', 0.02]],
  it_sanvittore: [['IT', 0.95], ['DE', 0.02], ['FR', 0.01], ['RO', 0.02]],
  it_caianello: [['IT', 0.95], ['DE', 0.02], ['FR', 0.01], ['RO', 0.02]],
  it_caserta: [['IT', 0.95], ['DE', 0.02], ['FR', 0.01], ['RO', 0.02]],
  it_napoli: [['IT', 0.96], ['DE', 0.01], ['FR', 0.01], ['RO', 0.02]],
  // Switzerland: overwhelmingly Swiss, with the neighbours passing through —
  // German plates in the east, French heavy at Genève (the cross-border
  // frontaliers), a little Italian and Austrian.
  ch_interlaken: [['CH', 0.94], ['DE', 0.03], ['FR', 0.02], ['IT', 0.01]],
  ch_brunig:     [['CH', 0.95], ['DE', 0.03], ['IT', 0.02]],
  ch_luzern:     [['CH', 0.92], ['DE', 0.04], ['IT', 0.02], ['AT', 0.02]],
  ch_zug:        [['CH', 0.91], ['DE', 0.05], ['IT', 0.02], ['AT', 0.02]],
  ch_zurich:     [['CH', 0.87], ['DE', 0.07], ['IT', 0.02], ['AT', 0.02], ['FR', 0.02]],
  ch_aargau:     [['CH', 0.92], ['DE', 0.05], ['FR', 0.02], ['IT', 0.01]],
  ch_bern:       [['CH', 0.93], ['DE', 0.04], ['FR', 0.02], ['IT', 0.01]],
  ch_fribourg:   [['CH', 0.93], ['FR', 0.04], ['DE', 0.02], ['IT', 0.01]],
  ch_lausanne:   [['CH', 0.89], ['FR', 0.08], ['IT', 0.02], ['DE', 0.01]],
  ch_geneve:     [['CH', 0.80], ['FR', 0.16], ['IT', 0.02], ['DE', 0.02]],
};

// long-haul trucks run the whole country: their plates are drawn from a
// nationwide pool weighted to the big trucking/registration states, not just
// the state you happen to be driving through.
const TRUCK_PLATE_POOL = [
  ['TX', 0.17], ['IN', 0.14], ['CA', 0.12], ['NY', 0.10], ['IL', 0.09],
  ['OH', 0.09], ['PA', 0.08], ['FL', 0.06], ['TN', 0.06], ['GA', 0.05],
  ['NC', 0.04],
];
// European long-haul is dominated by eastern-European hauliers — Polish and
// Romanian tractors everywhere — plus the Iberian and Benelux fleets.
const EURO_TRUCK_POOL = [
  ['PL', 0.26], ['RO', 0.13], ['ES', 0.14], ['PT', 0.10], ['DE', 0.12],
  ['NL', 0.07], ['FR', 0.06], ['BE', 0.04], ['CH', 0.04], ['AT', 0.04],
];

// Maharashtra RTO district codes by zone: MH 01/02/03 Mumbai city, MH 04
// Thane, MH 43 Navi Mumbai, MH 47 Borivali, MH 12 Pune, MH 14 Pimpri-
// Chinchwad. The expressway carries the Mumbai↔Pune mix both ways.
const MH_DISTRICTS = {
  nh48_mumbai: ['01', '02', '03', '04', '43', '47'], nh48_panvel: ['43', '04', '12'],
  nh48_ghat: ['04', '12', '11'], nh48_pune: ['12', '14', '11'], nh48_satara: ['11', '12'],
  nh48_karad: ['11', '09'], nh48_kolhapur: ['09', '12'], nh48_border: ['09', '12'],
  mumbai:   ['01', '02', '03', '04', '43', '47', '02', '03'],
  chembur:  ['03', '43', '04', '05', '03'],
  andheriW: ['02', '02', '47', '04', '01'],
  airport:  ['02', '03', '01', '04'],
  bandra:   ['01', '02', '47', '43'],
  sealink:  ['01', '02', '03'],
  marine:   ['01', '01', '02', '03'],
  puneX:    ['12', '14', '01', '03', '04', '43', '12'],   // Mumbai–Pune Expressway
  pcmc:     ['14', '14', '12', '12'],
  pune:     ['12', '12', '12', '14', '11'],
  // Aundh–Baner: MH-12 Pune city, MH-14 across the PCMC line at Baner/Balewadi,
  // the odd MH-11 (Satara) lorry
  p_gaon:   ['12', '12', '12', '14'],
  p_aundh:  ['12', '12', '12', '14'],
  p_link:   ['12', '12', '14', '14'],
  p_baner:  ['12', '14', '14', '12'],
  p_bale:   ['14', '14', '12', '12'],
  p_pashan: ['12', '12', '12', '11'],
  p_iti:    ['12', '12', '12', '14'],
};
const INDIA_STATE_DISTRICTS = {
  GJ: ['01', '05', '06', '18'], KA: ['01', '03', '05'], DL: ['01', '02', '3C', '8C', '4C', '9C'],
  HR: ['26', '51', '12', '10', '13'],   // HR-26 = Gurgaon, everywhere in NCR
  UP: ['16', '14', '32', '15'],         // UP-16 = Noida, UP-14 Ghaziabad
  PB: ['65', '10', '08'], RJ: ['14', '45', '27'],
};

// The scenic "Ohio — Birthplace of Aviation" plate: sky + sunburst, a distant
// city skyline and river on the left, rolling green hills, a wheat field along
// the bottom, the Wright Flyer top-left and the red aviation banner top-right,
// with a big navy serial across the middle. Drawn small (192x96) so it reads as
// an impression of the real plate rather than every detail.
function drawOhioScenic(g, serial) {
  // sky
  const sky = g.createLinearGradient(0, 0, 0, 96);
  sky.addColorStop(0, '#cfe0f2'); sky.addColorStop(1, '#eef5fb');
  g.fillStyle = sky; g.fillRect(0, 0, 192, 96);
  // sunburst rays fanning up from the horizon
  g.save();
  g.translate(96, 66);
  for (let i = 0; i < 16; i++) {
    g.rotate(Math.PI / 8);
    g.fillStyle = i % 2 ? '#f7cf6a' : '#f2a83a';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-11, -110); g.lineTo(11, -110); g.closePath(); g.fill();
  }
  g.restore();
  // the sun sitting on the horizon
  g.fillStyle = '#ef8a2b';
  g.beginPath(); g.arc(96, 66, 15, Math.PI, 2 * Math.PI); g.fill();
  // distant city skyline (left)
  g.fillStyle = '#aab0bc';
  for (const [x, top] of [[6, 46], [12, 50], [17, 41], [23, 52], [29, 47], [35, 51]]) {
    g.fillRect(x, top, 5, 60 - top);
  }
  // green rolling hills
  g.fillStyle = '#5f9042';
  g.beginPath(); g.moveTo(0, 76); g.lineTo(0, 60);
  g.quadraticCurveTo(48, 50, 96, 60); g.quadraticCurveTo(150, 69, 192, 55);
  g.lineTo(192, 76); g.closePath(); g.fill();
  // river spilling to the lower-left
  g.fillStyle = '#5a8fc0';
  g.beginPath(); g.moveTo(0, 70); g.lineTo(44, 76); g.lineTo(0, 88); g.closePath(); g.fill();
  // a tree on the right
  g.fillStyle = '#5a4632'; g.fillRect(171, 54, 2, 12);
  g.fillStyle = '#3f6b33'; g.beginPath(); g.arc(172, 52, 10, 0, Math.PI * 2); g.fill();
  // wheat field along the bottom
  g.fillStyle = '#d3ab52'; g.fillRect(0, 76, 192, 16);
  g.strokeStyle = '#b8912f'; g.lineWidth = 1;
  for (let x = 4; x < 192; x += 6) { g.beginPath(); g.moveTo(x, 91); g.lineTo(x, 79); g.stroke(); }
  // maroon trim top & bottom
  g.fillStyle = '#8a2432'; g.fillRect(0, 0, 192, 4); g.fillRect(0, 92, 192, 4);
  // "Ohio" script + state outline blob, red aviation banner, tiny biplane
  g.fillStyle = '#ffffff'; g.strokeStyle = '#b3202c'; g.lineWidth = 1;
  g.beginPath(); g.ellipse(78, 12, 16, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#14315c'; g.font = 'italic bold 11px Georgia'; g.textAlign = 'center';
  g.fillText('Ohio', 78, 16);
  g.fillStyle = '#b3202c'; g.fillRect(100, 6, 84, 11);
  g.fillStyle = '#ffffff'; g.font = 'bold 7px Arial';
  g.fillText('Birthplace of Aviation', 142, 14);
  g.strokeStyle = '#39404a'; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(20, 22); g.lineTo(36, 22); g.moveTo(20, 26); g.lineTo(36, 26);
  g.moveTo(28, 22); g.lineTo(28, 26); g.stroke();
  // the big navy serial
  g.fillStyle = '#14315c'; g.font = 'bold 46px Arial'; g.textAlign = 'center';
  g.fillText(serial, 96, 70);
}

// The 2001–2010 New York blue plate: Niagara Falls (left) and the NYC skyline
// (right) in white across a blue sky band up top, a white field, a big navy
// serial, and "THE EMPIRE STATE" on the blue band along the bottom.
function drawNYBlue(g, serial) {
  g.fillStyle = '#f4f7fb'; g.fillRect(0, 0, 192, 96);
  const sky = g.createLinearGradient(0, 0, 0, 36);
  sky.addColorStop(0, '#2f5c9e'); sky.addColorStop(1, '#8fb2d8');
  g.fillStyle = sky; g.fillRect(0, 0, 192, 36);
  // Niagara Falls silhouette on the left
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(4, 15, 32, 21);
  g.strokeStyle = '#bcd0e8'; g.lineWidth = 1;
  for (let x = 7; x < 36; x += 3) { g.beginPath(); g.moveTo(x, 21); g.lineTo(x, 35); g.stroke(); }
  // NYC skyline silhouette on the right
  g.fillStyle = 'rgba(255,255,255,0.92)';
  for (const [x, top] of [[148, 20], [154, 13], [160, 22], [166, 10], [172, 17], [178, 15], [184, 22]]) {
    g.fillRect(x, top, 5, 36 - top);
  }
  // NEW YORK header
  g.fillStyle = '#ffffff'; g.font = 'bold 15px Arial'; g.textAlign = 'center';
  g.fillText('NEW YORK', 96, 17);
  // bottom Empire State band
  g.fillStyle = '#1c3f7a'; g.fillRect(0, 80, 192, 16);
  g.fillStyle = '#ffffff'; g.font = 'bold 11px Arial';
  g.fillText('THE EMPIRE STATE', 96, 92);
  // navy serial
  g.fillStyle = '#1c3f7a'; g.font = 'bold 44px Arial';
  g.fillText(serial, 96, 68);
}

// Current 2020–present Excelsior base: white field, blue serial, gold/blue
// header accents, and the state scenery used on the real plate.
function drawNYExcelsior(g, serial) {
  g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, 192, 96);
  g.strokeStyle = '#aeb9c3'; g.lineWidth = 1.5; g.strokeRect(1, 1, 190, 94);
  g.fillStyle = '#1d477f'; g.fillRect(12, 10, 34, 3); g.fillRect(146, 10, 34, 3);
  g.fillStyle = '#d5a62a'; g.fillRect(12, 14, 34, 2); g.fillRect(146, 14, 34, 2);
  g.fillStyle = '#1b3f8f'; g.font = 'bold 15px Arial'; g.fillText('NEW YORK', 96, 20);
  g.fillStyle = '#1b3f8f'; g.font = 'bold 7px Arial'; g.fillText('OCT', 10, 10); g.fillText('YEAR', 181, 10);
  const scene = g.createLinearGradient(0, 68, 0, 94);
  scene.addColorStop(0, '#dcecf4'); scene.addColorStop(1, '#75a9cb');
  g.fillStyle = scene; g.fillRect(3, 68, 186, 25);
  g.fillStyle = '#6d93a6'; g.beginPath();
  g.moveTo(3, 84); g.lineTo(22, 71); g.lineTo(39, 84); g.lineTo(56, 74); g.lineTo(76, 85);
  g.lineTo(98, 76); g.lineTo(121, 86); g.lineTo(143, 72); g.lineTo(165, 84); g.lineTo(189, 74);
  g.lineTo(189, 93); g.lineTo(3, 93); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(7, 74, 23, 19);
  for (let x = 10; x < 30; x += 3) { g.strokeStyle = '#b7d9ea'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, 77); g.lineTo(x, 92); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.9)';
  for (const [x, top] of [[142, 76], [148, 71], [154, 78], [160, 68], [166, 74], [172, 72], [178, 77]]) g.fillRect(x, top, 3.5, 93 - top);
  g.fillStyle = '#1b3f8f'; g.font = 'bold 42px Arial'; g.fillText(serial, 96, 64);
  g.font = 'bold 10px Arial'; g.strokeStyle = '#1b3f8f'; g.lineWidth = 1.4; g.strokeText('EXCELSIOR', 96, 91);
  g.fillStyle = '#d5a62a'; g.fillText('EXCELSIOR', 96, 91);
}

// Empire Gold base issued 2010–2020; the gold field and blue bands are kept
// separate from the current Excelsior plate so older traffic remains visible.
function drawNYGold(g, serial) {
  const grad = g.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#f8b133'); grad.addColorStop(1, '#e89a1e');
  g.fillStyle = grad; g.fillRect(0, 0, 192, 96);
  g.fillStyle = '#1b2a4a'; g.fillRect(0, 0, 192, 7); g.fillRect(0, 88, 192, 8);
  g.fillStyle = '#e68122'; g.font = 'bold 12px Arial'; g.fillText('NEW YORK', 96, 17);
  g.fillStyle = '#1b2a4a'; g.font = 'bold 42px Arial'; g.fillText(serial, 96, 63);
  g.font = 'bold 10px Arial'; g.fillText('THE EMPIRE STATE', 96, 92);
  g.strokeStyle = '#1b2a4a'; g.lineWidth = 1; g.strokeRect(1, 1, 190, 94);
}

// Liberty base used from the late 1980s into the early 2000s: white/blue
// field with red accent and a small Statue of Liberty motif.
function drawNYLiberty(g, serial) {
  const grad = g.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#f8fbfd'); grad.addColorStop(1, '#c9dfee');
  g.fillStyle = grad; g.fillRect(0, 0, 192, 96);
  g.fillStyle = '#183d75'; g.fillRect(0, 0, 192, 8); g.fillRect(0, 88, 192, 8);
  g.fillStyle = '#d14a3a'; g.fillRect(8, 12, 28, 4); g.fillRect(156, 12, 28, 4);
  g.fillStyle = '#183d75'; g.font = 'bold 14px Arial'; g.fillText('NEW YORK', 96, 20);
  g.fillStyle = '#183d75'; g.font = 'bold 42px Arial'; g.fillText(serial, 96, 65);
  // simplified torch/crown silhouette at the left, readable at plate scale
  g.fillStyle = 'rgba(24,61,117,.45)'; g.fillRect(19, 43, 3, 28); g.fillRect(13, 70, 15, 3);
  g.beginPath(); g.moveTo(15, 43); g.lineTo(20, 34); g.lineTo(25, 43); g.closePath(); g.fill();
  g.font = 'bold 10px Arial'; g.fillText('EMPIRE STATE', 96, 93);
  g.strokeStyle = '#183d75'; g.lineWidth = 1; g.strokeRect(1, 1, 190, 94);
}

function drawCTDetailed(g, serial) {
  const grad = g.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#e8f3fa'); grad.addColorStop(1, '#b8d4e7');
  g.fillStyle = grad; g.fillRect(0, 0, 192, 96);
  g.strokeStyle = '#174c82'; g.lineWidth = 1.5; g.strokeRect(1, 1, 190, 94);
  g.fillStyle = '#174c82'; g.fillRect(10, 10, 42, 3); g.fillRect(140, 10, 42, 3);
  g.font = 'bold 15px Arial'; g.fillText('CONNECTICUT', 96, 20);
  g.globalAlpha = 0.22; g.fillStyle = '#174c82';
  for (const x of [66, 96, 126]) { g.beginPath(); g.arc(x, 54, 8, 0, Math.PI * 2); g.fill(); g.fillRect(x - 1.5, 42, 3, 14); }
  g.globalAlpha = 1; g.fillStyle = '#174c82'; g.font = 'bold 42px Arial'; g.fillText(serial, 96, 65);
  g.font = 'bold 10px Arial'; g.fillText('CONSTITUTION STATE', 96, 91);
}

function drawMDProud(g, serial) {
  g.fillStyle = '#f8f8f5'; g.fillRect(0, 0, 192, 96);
  g.strokeStyle = '#243d5c'; g.lineWidth = 1.5; g.strokeRect(1, 1, 190, 94);
  g.fillStyle = '#b3202c'; g.font = 'bold 15px Arial'; g.fillText('MARYLAND', 96, 18);
  g.fillStyle = '#202c46'; g.font = 'bold 7px Arial'; g.fillText('OCT', 10, 10); g.fillText('YEAR', 181, 10);
  g.font = 'bold 43px Arial'; g.fillText(serial, 96, 64);
  // Maryland Proud flag strip along the lower edge: alternating Calvert and
  // Crossland-inspired red, gold, black, and blue blocks.
  const colors = ['#b3202c', '#f0c43d', '#1b3f78', '#111827'];
  for (let i = 0; i < 16; i++) {
    g.fillStyle = colors[i % colors.length]; g.fillRect(3 + i * 11.65, 77, 11.65, 16);
    if (i % 2 === 0) { g.fillStyle = '#f5d46a'; g.beginPath(); g.moveTo(3 + i * 11.65, 77); g.lineTo(14.65 + i * 11.65, 93); g.lineTo(3 + i * 11.65, 93); g.closePath(); g.fill(); }
  }
  g.fillStyle = '#202c46'; g.font = 'bold 8px Arial'; g.fillText('MARYLAND', 96, 89);
}

function drawPlate(style, commercial, district = '12', layout = 'wide') {
  const cv = document.createElement('canvas');
  if (style.euro) {
    // EU single-line plate: blue country band with the star circle, white
    // (or Dutch yellow) field, black serial; PT keeps its yellow right band
    cv.width = 384; cv.height = 82;
    const g = cv.getContext('2d');
    g.fillStyle = style.yellow ? '#f7c531' : '#f5f6f2';
    g.fillRect(0, 0, 384, 82);
    g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(2, 2, 380, 78);
    if (!style.noBand) {
      g.fillStyle = '#0a3696';                  // EU band
      g.fillRect(4, 4, 34, 74);
      g.fillStyle = '#f8d040';                  // circle of stars
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.fillRect(21 + Math.cos(a) * 10 - 1.4, 26 + Math.sin(a) * 10 - 1.4, 2.8, 2.8);
      }
      g.fillStyle = '#fff'; g.textAlign = 'center';
      g.font = 'bold 17px Arial';
      g.fillText(style.euro, 21, 70);
    } else {
      g.textAlign = 'center';   // Brexit: no band, no stars
    }
    if (style.itBand) {                         // Italian right-hand blue band
      g.fillStyle = '#0a3696'; g.fillRect(352, 4, 28, 74);
      g.fillStyle = '#f8d040'; g.font = 'bold 13px Arial'; g.textAlign = 'center';
      g.fillText('RM', 366, 46);
    }
    if (style.ptBand) {                         // Portuguese yellow date band
      g.fillStyle = '#f2c22e'; g.fillRect(346, 4, 34, 74);
      g.fillStyle = '#111'; g.font = 'bold 14px Arial';
      g.fillText(String(8 + ((Math.random() * 16) | 0)).padStart(2, '0'), 363, 34);
      g.fillText(String(1 + ((Math.random() * 12) | 0)).padStart(2, '0'), 363, 62);
    }
    if (style.chBand) {                         // Swiss red band + white cross
      g.fillStyle = '#d52b1e'; g.fillRect(348, 4, 32, 74);
      g.fillStyle = '#fff';
      g.fillRect(362, 24, 4, 20); g.fillRect(354, 32, 20, 4);
      g.font = 'bold 12px Arial'; g.textAlign = 'center';
      g.fillText('CH', 364, 70);
    }
    g.fillStyle = '#111';
    g.font = 'bold 42px Arial';
    const text = style.deCity ? `${district} ${style.fmt()}` : style.fmt();
    g.fillText(text, (style.ptBand || style.itBand || style.chBand) ? 188 : 208, 58);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.india && layout === 'wide') {
    // Full-width Indian plate (all vehicles except two-wheelers). Keep the
    // field plain white/yellow: no European blue strip, stars, or country tag.
    cv.width = 384; cv.height = 96;
    const g = cv.getContext('2d');
    g.fillStyle = commercial ? '#f2c22e' : '#f5f6f2';
    g.fillRect(0, 0, 384, 96);
    g.strokeStyle = '#111';
    g.lineWidth = 5;
    g.strokeRect(3, 3, 378, 90);
    g.fillStyle = '#111';
    g.textAlign = 'center';
    g.font = 'bold 44px Arial';
    g.fillText(`${style.india} ${district} ${serial(PLATE_SERIAL_L, 2)} ${serial(PLATE_SERIAL_D, 4)}`, 192, 64);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  cv.width = 192; cv.height = 96;
  const g = cv.getContext('2d');
  g.textAlign = 'center';
  if (style.ohioScenic) {
    drawOhioScenic(g, style.fmt());
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.nyBlue) {
    drawNYBlue(g, style.fmt());
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.nyExcelsior) {
    drawNYExcelsior(g, style.fmt());
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.nyGold) {
    drawNYGold(g, style.fmt());
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.nyLiberty) {
    drawNYLiberty(g, style.fmt());
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.ctDetailed) {
    drawCTDetailed(g, style.fmt());
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.mdProud) {
    drawMDProud(g, style.fmt());
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.indianaCovered) {
    // Indiana's 2017-present standard base: a pale sky, wooded hills, and a
    // covered bridge behind a dark-blue 3-number + 3-letter serial.
    g.fillStyle = '#eaf3f7';
    g.fillRect(0, 0, 192, 96);
    const sky = g.createLinearGradient(0, 0, 0, 64);
    sky.addColorStop(0, '#c8e2ee');
    sky.addColorStop(1, '#f2f4ed');
    g.fillStyle = sky; g.fillRect(0, 0, 192, 70);
    g.fillStyle = '#87a98a';
    g.beginPath(); g.moveTo(0, 57); g.quadraticCurveTo(35, 35, 72, 55);
    g.quadraticCurveTo(125, 28, 192, 53); g.lineTo(192, 78); g.lineTo(0, 78); g.closePath(); g.fill();
    g.fillStyle = '#4f795c';
    g.beginPath(); g.moveTo(0, 70); g.quadraticCurveTo(50, 52, 103, 69);
    g.quadraticCurveTo(145, 49, 192, 68); g.lineTo(192, 82); g.lineTo(0, 82); g.closePath(); g.fill();
    // Covered bridge silhouette.
    g.fillStyle = '#8b4f32';
    g.fillRect(67, 48, 58, 25);
    g.beginPath(); g.moveTo(63, 49); g.lineTo(129, 49); g.lineTo(124, 42); g.lineTo(69, 42); g.closePath(); g.fill();
    g.fillStyle = '#f0d29b';
    g.fillRect(75, 56, 42, 13);
    g.fillStyle = '#6c402c';
    for (const x of [75, 86, 97, 108, 117]) g.fillRect(x, 55, 2, 15);
    g.fillStyle = '#385f82';
    g.fillRect(0, 78, 192, 18);
    g.fillStyle = '#fff';
    g.font = 'bold 14px Arial';
    g.fillText(style.header, 96, 16);
    g.font = 'bold 40px Arial';
    g.fillStyle = style.text;
    g.fillText(style.fmt(), 96, 62);
    g.fillStyle = '#fff';
    g.font = 'bold 8px Arial';
    g.fillText(style.footer, 96, 90);
    g.font = 'bold 7px Arial';
    g.fillText(String(district).padStart(2, '0'), 12, 12);
    g.fillText('26', 180, 12);
    g.strokeStyle = '#70838d'; g.lineWidth = 1.5; g.strokeRect(1, 1, 190, 94);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style === PLATE_STYLES.MA) {
    g.fillStyle = '#f8f8f4';
    g.fillRect(0, 0, 192, 96);
    g.strokeStyle = '#b8b8b2';
    g.lineWidth = 1.5;
    g.strokeRect(1, 1, 190, 94);
    g.fillStyle = '#1b3f8f';
    g.font = 'bold 14px Arial';
    g.fillText('MASSACHUSETTS', 96, 18);
    g.font = 'bold 7px Arial';
    g.fillText('OCT', 14, 12);
    g.fillText('YEAR', 178, 12);
    g.fillStyle = '#b3202c';
    g.font = 'bold 44px Arial';
    g.fillText(style.fmt(), 96, 63);
    g.fillStyle = '#1b3f8f';
    g.font = 'bold 10px Arial';
    g.fillText('THE SPIRIT OF AMERICA', 96, 90);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style === PLATE_STYLES.IL) {
    g.fillStyle = '#fbfbf8';
    g.fillRect(0, 0, 192, 96);
    const wash = g.createLinearGradient(0, 0, 0, 96);
    wash.addColorStop(0, 'rgba(255,255,255,0.15)');
    wash.addColorStop(1, 'rgba(178,215,232,0.45)');
    g.fillStyle = wash; g.fillRect(0, 0, 192, 96);
    g.strokeStyle = '#b8c4ca'; g.lineWidth = 1.5;
    g.strokeRect(1, 1, 190, 94);
    g.fillStyle = '#b3202c';
    g.font = 'bold 15px Arial';
    g.fillText('ILLINOIS', 96, 18);
    g.fillStyle = '#12356f';
    g.font = 'bold 7px Arial';
    g.fillText('OCT', 14, 12); g.fillText('YEAR', 178, 12);
    g.font = 'bold 42px Arial';
    g.fillText(style.fmt(), 96, 63);
    g.font = 'bold 10px Arial';
    g.fillText('LAND OF LINCOLN', 96, 90);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  if (style.india) {
    // two-line square plate: bikes and rickshaws
    g.fillStyle = commercial ? '#f2c22e' : '#f5f6f2';
    g.fillRect(0, 0, 192, 96);
    g.strokeStyle = '#111';
    g.lineWidth = 5;
    g.strokeRect(3, 3, 186, 90);
    g.fillStyle = '#111';
    g.font = 'bold 38px Arial';
    g.fillText(`${style.india} ${district}`, 96, 42);
    g.fillText(`${serial(PLATE_SERIAL_L, 2)} ${serial(PLATE_SERIAL_D, 4)}`, 96, 82);
  } else {
    const grad = g.createLinearGradient(0, 0, 0, 96);
    grad.addColorStop(0, style.bg[0]);
    grad.addColorStop(1, style.bg[style.bg.length - 1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 192, 96);
    if (style.bg.length === 3) { // PA-style: white field, solid colour bands top & bottom
      g.fillStyle = style.bg[1]; g.fillRect(0, 0, 192, 96);   // clean field, no gradient bleed
      g.fillStyle = style.bg[0]; g.fillRect(0, 0, 192, 22);
      g.fillStyle = style.bg[2]; g.fillRect(0, 78, 192, 18);
    }
    if (style.oranges) {         // Florida: two oranges graphic behind the serial
      g.save(); g.globalAlpha = 0.5;
      for (const ox of [78, 106]) {
        g.fillStyle = '#f0912a'; g.beginPath(); g.arc(ox, 54, 11, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#3f8f36'; g.fillRect(ox - 1.5, 40, 3, 5);
      }
      g.restore();
    }
    g.fillStyle = style.headerFg ?? style.text;
    g.font = 'bold 16px Arial';
    g.fillText(style.header, 96, 18);
    g.fillStyle = style.text;
    g.font = 'bold 44px Arial';
    g.fillText(style.fmt(), 96, 62);
    g.fillStyle = style.footerFg ?? style.headerFg ?? style.text;
    g.font = 'bold 11px Arial';
    g.fillText(style.footer, 96, 90);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// pooled materials: a few serial variants per state so the fleet isn't clones
const plateMatCache = new Map();
function plateMat(state, variant, commercial, district = '12', layout = 'wide') {
  const key = `${state}_${district}_${layout}_${variant}${commercial ? 'C' : ''}`;
  if (!plateMatCache.has(key)) {
    const tex = drawPlate(PLATE_STYLES[state], commercial, district, layout);
    plateMatCache.set(key, new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
      roughness: 0.5, metalness: 0.1,
    }));
  }
  return plateMatCache.get(key);
}

const plateGeoCache = new Map();
function plateGeo(scale, wide = false) {
  const key = `${scale}${wide ? 'w' : ''}`;
  if (!plateGeoCache.has(key)) {
    plateGeoCache.set(key, wide
      ? new THREE.PlaneGeometry(0.52 * scale, 0.13 * scale)
      : new THREE.PlaneGeometry(0.46 * scale, 0.23 * scale));
  }
  return plateGeoCache.get(key);
}

const PLATE_Y = {
  pickup: 0.55, boxtruck: 0.72, tempo: 0.72, semi: 0.78,
  bus: 0.68, mta: 0.68, best: 0.68, metro78: 0.68,
  rickshaw: 0.5, bike: 0.5, moto: 0.5, eurotaxi: 0.5,
  van: 0.6, school: 0.7, coach: 0.7, truckIN: 0.72,
};
const INDIA_COMMERCIAL = new Set(['rickshaw', 'kaali', 'best', 'tempo', 'truckIN']);

// amber turn-signal lamps at the four corners; returns the two side materials
// so the caller can blink them. Cars face +z, +x is the vehicle's left.
const NPC_BLINK_BASE = new THREE.MeshStandardMaterial({ color: 0x6a3f00, emissive: 0xffa817, emissiveIntensity: 0 });
const NPC_BLINK_GEO = new THREE.BoxGeometry(0.16, 0.14, 0.12);
export function addNpcBlinkers(group, type) {
  const halfL = type.L / 2 - 0.05, halfW = type.W / 2;
  const y = type.key === 'bike' ? 0.7 : 0.55;
  const matL = NPC_BLINK_BASE.clone(), matR = NPC_BLINK_BASE.clone();
  for (const zEnd of [halfL, -halfL]) {
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(NPC_BLINK_GEO, side > 0 ? matL : matR);
      m.position.set(side * (halfW - 0.05), y, zEnd + Math.sign(zEnd) * 0.02);
      group.add(m);
    }
  }
  // give this car its own head/tail-light materials (swapped in for the shared
  // ones) so they can flick on at dusk at slightly different moments per car
  const hl = [], tl = [], tlGlow = [], hlGlow = [];
  const tailMeshes = [], headMeshes = [];
  group.traverse(o => {
    if (!o.isMesh) return;
    if (o.material === headlightMat) { o.material = headlightMat.clone(); hl.push(o.material); headMeshes.push(o); }
    else if (o.material === taillightMat) { o.material = taillightMat.clone(); tl.push(o.material); tailMeshes.push(o); }
  });
  for (const t of tailMeshes) {   // can't add children mid-traverse
    const sp = makeBrakeGlow();
    sp.position.z = -0.1;         // just off the lamp face, rearward
    t.add(sp);
    tlGlow.push(sp);
  }
  for (const h of headMeshes) {   // high-beam halos, forward
    const sp = makeBeamGlow();
    sp.position.z = 0.1;
    h.add(sp);
    hlGlow.push(sp);
  }
  return { matL, matR, hl, tl, tlGlow, hlGlow };
}

export function addNpcPlates(group, type, zoneKey, rand) {
  const dist = ZONE_PLATES[zoneKey] || (['libertia', 'i380', 'i980', 'lb24', 'us67'].includes(MAP)
    ? [['LIB', 0.78], ['IL', 0.10], ['IA', 0.06], ['MO', 0.06]]
    : null);
  if (!dist) return;
  let x = rand(), state = dist[0][0];
  for (const [st, w] of dist) { x -= w; if (x <= 0) { state = st; break; } }
  // long-haul trucks (semis + box trucks) carry out-of-state plates from all
  // over: the home state is ~50%, the rest pulled from a national truck pool
  // (Texas, Indiana, California, New York… the states you actually see hauling).
  const longHaul = (type.key === 'semi' || type.key === 'boxtruck');
  if (longHaul && !PLATE_STYLES[state].india) {
    const pool = PLATE_STYLES[state].euro ? EURO_TRUCK_POOL : TRUCK_PLATE_POOL;
    if (rand() < 0.5) {
      let y2 = rand(); state = pool[0][0];
      for (const [st, w] of pool) { y2 -= w; if (y2 <= 0) { state = st; break; } }
    } else {
      state = dist[0][0]; // home state of the region
    }
  }
  // rare out-of-state wildcard on the US maps: a Florida / Texas / California
  // plate turns up every once in a while, far from home
  if (PLATE_STYLES[state] && !PLATE_STYLES[state].india && !PLATE_STYLES[state].euro && rand() < 0.045) {
    // Wildcards are uncommon but visible: snowbirds, military/freight traffic,
    // and long-distance commuters from well outside the Midwest corridor.
    state = ['FL', 'TX', 'CA', 'NY', 'NJ', 'PA', 'VA', 'NC', 'GA', 'TN'][(rand() * 10) | 0];
  }
  // NY: current Excelsior is the majority, while valid older Empire Gold,
  // Empire State blue/white, and Liberty plates preserve the real plate-era mix.
  if (state === 'NY') {
    const r = rand();
    state = r < 0.55 ? 'NY_NEW' : r < 0.68 ? 'NY_BLUE' : r < 0.78 ? 'NY_LIBERTY' : 'NY';
  }
  // PA: most cars still wear the older blue/white/yellow plate; some have the
  // newer plain white one with the red serial.
  if (state === 'PA' && rand() < 0.22) state = 'PA_NEW';
  // OH: a good share carry the orange-sunrise/blue scenic plate.
  if (state === 'OH' && rand() < 0.4) state = 'OH_ALT';
  // Southern states each run two designs concurrently — mix the second in so a
  // pack of same-state cars shows plate-to-plate variety.
  if (state === 'FL' && rand() < 0.35) state = 'FL_ALT';
  if (state === 'GA' && rand() < 0.30) state = 'GA_ALT';
  if (state === 'NC' && rand() < 0.30) state = 'NC_ALT';
  if (state === 'VA' && rand() < 0.28) state = 'VA_ALT';
  if (state === 'SC' && rand() < 0.30) state = 'SC_ALT';
  if (state === 'MD' && rand() < 0.28) state = 'MD_ALT';
  if (['libertia', 'i380', 'i980', 'lb24', 'us67'].includes(MAP)) {
    // Libertia commercial plates are intentionally distinct: white for
    // trucks/buses, yellow for taxis, while ordinary cars keep the blue plate.
    if (type.truckLane) state = 'LIB_TRUCK';
    else if (type.key === 'taxi') state = 'LIB_TAXI';
    else if (!PLATE_STYLES[state] || !['LIB', 'IA', 'IL', 'MO'].includes(state)) state = 'LIB';
  }
  const india = !!PLATE_STYLES[state].india;
  const euro = !!PLATE_STYLES[state].euro;
  const commercial = india && INDIA_COMMERCIAL.has(type.key);
  const small = type.key === 'bike' || type.key === 'rickshaw' || type.key === 'moto';
  // Indian plates: single-line horizontal on everything except two-wheelers,
  // with the RTO district code drawn from the zone you're driving through
  let district = '12';
  if (india) {
    const pool = state === 'MH'
      ? (MH_DISTRICTS[zoneKey] || MH_DISTRICTS.mumbai)
      : (INDIA_STATE_DISTRICTS[state] || ['01']);
    district = pool[(rand() * pool.length) | 0];
  }
  // German plates: the district letter code follows the zone (F, LM, WW, K…)
  if (euro && state === 'DE') {
    const pool = DE_CITY_CODES[zoneKey] || ['K', 'F', 'D'];
    district = pool[(rand() * pool.length) | 0];
  }
  const layout = (india && !small) || euro ? 'wide' : 'square';
  const mat = plateMat(state, (rand() * 4) | 0, commercial, district, layout);
  const geo = plateGeo(small ? 0.5 : type.truckLane ? 1.1 : 1, layout === 'wide');
  const y = PLATE_Y[type.key] ?? 0.5;
  const halfL = type.L / 2;
  const rear = new THREE.Mesh(geo, mat);
  rear.position.set(0, y, -halfL - 0.02);
  rear.rotation.y = Math.PI;
  group.add(rear);
  // Pennsylvania is a rear-plate-only state; do not put a phantom plate on
  // the nose of PA/PA_NEW cars and trucks. Bikes/rickshaws are rear-only too.
  if (!small && !state.startsWith('PA')) {
    const front = new THREE.Mesh(geo, mat);
    front.position.set(0, y, halfL + 0.02);
    group.add(front);
  }
}

// small whole-car scale jitter so even same-model cars differ a touch
const sc = (g, r) => { g.scale.setScalar(0.95 + r() * 0.1); return g; };

// type: weight = spawn probability, speed = desired cruise range (m/s),
// truckLane = biased to outer lanes.
export const VEHICLE_TYPES = [
  { key: 'sedan',  weight: 15, L: 4.8,  W: 1.85, speed: [71, 84], make: r => sc(makeCar(pickColor(r), 4.8, 1.85, 1.45, 0.5 + r() * 0.1, r), r) },
  // ~3% of the pool baseline — real-life Tesla share; WEALTH_ZONES boosts it
  { key: 'tesla',  weight: 3,  L: 4.7,  W: 1.85, speed: [72, 88], make: r => sc(makeTesla(r), r) },
  { key: 'hatch',  weight: 7,  L: 4.3,  W: 1.8,  speed: [65, 76], make: r => sc(makeCar(pickColor(r), 4.3, 1.8, 1.5, 0.62, r), r) },
  { key: 'suv',    weight: 13, L: 5.0,  W: 1.95, speed: [70, 82], make: r => sc(makeCar(pickColor(r), 5.0, 1.95, 1.8, 0.55 + r() * 0.1, r), r) },
  { key: 'crossover', weight: 10, L: 4.75, W: 1.9, speed: [70, 82], make: r => sc(makeCrossover(pickColor(r), 4.75, 1.9, 1.7, r), r) },
  { key: 'offroad', weight: 5, L: 4.9, W: 1.96, speed: [68, 79], make: r => sc(makeOffroadSUV(pickColor(r), 4.9, 1.96, 1.94, r), r) },
  { key: 'luxsedan', weight: 5, L: 5.15, W: 1.94, speed: [71, 84], make: r => sc(makeLuxurySedan([0x111316, 0x25292e, 0xc5c8cc, 0xf0f1ef, 0x16345d, 0x4a1720][(r() * 6) | 0], 5.15, 1.94, 1.43, r), r), luxury: true },
  { key: 'luxsuv', weight: 4, L: 5.15, W: 2.02, speed: [70, 82], make: r => sc(makeLuxurySUV([0x111316, 0x292d33, 0xc2c6ca, 0xf0f1ef, 0x17365f, 0x35291f][(r() * 6) | 0], 5.15, 2.02, 1.84, r), r), luxury: true },
  { key: 'wagon',  weight: 5,  L: 4.9,  W: 1.85, speed: [66, 78], make: r => sc(makeWagon(pickColor(r), 4.9, 1.85, 1.5, r), r) },
  { key: 'minivan', weight: 8, L: 5.1,  W: 1.95, speed: [66, 79], make: r => sc(makeMinivan(pickColor(r), 5.1, 1.95, 1.75), r) },
  { key: 'coupe',  weight: 4,  L: 4.6,  W: 1.86, speed: [72, 88], make: r => sc(makeCoupe(pickColor(r), 4.6, 1.86, 1.32, r), r) },
  { key: 'sports', weight: 2,  L: 4.5,  W: 1.95, speed: [77, 95], make: r => sc(makeSports([0xc8342a, 0xf2a900, 0x1b1d1f, 0x2a4f8f, 0xf2f3f5][(r() * 5) | 0], 4.5, 1.95, 1.2), r) },
  { key: 'muscle', weight: 4, L: 4.85, W: 1.94, speed: [72, 88], make: r => sc(makeMuscle([0xc8342a, 0x1b1d1f, 0x2a4f8f, 0xf2f3f5, 0x4b6b3b, 0xd97b1f][(r() * 6) | 0], 4.85, 1.94, 1.31, r), r) },
  { key: 'classic', weight: 4, L: 4.9, W: 1.84, speed: [65, 76], make: r => sc(makeClassicSedan(pickColor(r), 4.9, 1.84, 1.48, r), r) },
  { key: 'pickup', weight: 11, L: 5.6,  W: 2.0,  speed: [69, 81], make: r => sc(makePickup(pickColor(r), 5.6, 2.0, 1.5, r), r) },
  { key: 'van',    weight: 6,  L: 5.9,  W: 2.0,  speed: [62, 72], make: r => sc(makeVan(VAN_COLORS[(r() * VAN_COLORS.length) | 0], 5.9, 2.0, 2.5), r) },
  { key: 'taxi',   weight: 34, L: 4.8,  W: 1.9, speed: [69, 82], make: r => makeTaxi(r, 4.8, 1.9, 1.45), cityOnly: true },
  // Europe-only (weight 0 elsewhere; EURO_WEIGHTS switches them on): fast
  // motorway motos everywhere in Iberia, and the local city taxi fleets
  { key: 'moto',     weight: 0, L: 2.2, W: 0.8,  speed: [68, 84], make: r => makeBike(r) },
  { key: 'eurotaxi', weight: 0, L: 4.7, W: 1.85, speed: [67, 80], make: () => makeEuroTaxi(4.7, 1.85, 1.45), cityOnly: true },
  { key: 'mta',    weight: 9,  L: 12.0, W: 2.55, speed: [55, 62], make: () => makeMTABus(), cityOnly: true, truckLane: true },
  { key: 'boxtruck', weight: 7, L: 7.6, W: 2.4,  speed: [58, 65], make: r => makeBoxTruck(pickColor(r), 7.6, 2.4, 2.6, r), truckLane: true },
  { key: 'semi',   weight: 9,  L: 19.5, W: 2.55, speed: [58, 63], make: r => makeSemi([0x8c1c1c, 0x1e3a6e, 0x14161a, 0xc9c9c9, 0x2a7a3f, 0xd97b1f, 0xf0f0e8, 0x5a6470, 0x6e2d3b, 0x9a9b3d][(r() * 10) | 0], 19.5, 2.55, 2.4, r), truckLane: true },
  { key: 'bus',    weight: 2,  L: 12.0, W: 2.55, speed: [58, 65], make: () => makeBus(0xd8d8e2, 12.0, 2.55, 3.0), truckLane: true },
  { key: 'school', weight: 2,  L: 10.8, W: 2.5,  speed: [55, 62], make: () => makeSchoolBus(), truckLane: true },
  { key: 'coach',  weight: 2,  L: 13.2, W: 2.55, speed: [62, 70], make: r => makeCoach(r), truckLane: true },
];

// Mumbai fleet — speeds in mph but city-arterial slow (stoplights do the rest)
// Cars look like India's: white tall-boy hatchbacks everywhere, compact
// sedans, boxy Scorpio-class SUVs, Innova MPVs, painted lorries.
export const MUMBAI_TYPES = [
  { key: 'rickshaw', weight: 24, L: 2.6,  W: 1.3,  speed: [14, 25], make: () => makeRickshaw(), mumbai: true },
  { key: 'bike',     weight: 38, L: 2.0,  W: 0.7,  speed: [16, 30], make: r => makeBike(r), mumbai: true },
  { key: 'kaali',    weight: 10, L: 4.3,  W: 1.75, speed: [14, 26], make: () => makeKaaliPeeli(), mumbai: true },
  { key: 'hatchM',   weight: 14, L: 3.6,  W: 1.6,  speed: [15, 28], make: r => sc(makeIndianHatch(pickIndiaColor(r)), r), mumbai: true },
  { key: 'sedanM',   weight: 6,  L: 4.0,  W: 1.7,  speed: [15, 28], make: r => sc(makeCar(pickIndiaColor(r), 4.0, 1.7, 1.5, 0.56, r), r), mumbai: true },
  { key: 'suvM',     weight: 6,  L: 4.4,  W: 1.8,  speed: [15, 28], make: r => sc(makeBoxSUV(pickIndiaColor(r)), r), mumbai: true },
  { key: 'mpv',      weight: 5,  L: 4.7,  W: 1.83, speed: [15, 28], make: r => sc(makeMinivan(pickIndiaColor(r), 4.7, 1.83, 1.8), r), mumbai: true },
  { key: 'truckIN',  weight: 6,  L: 7.2,  W: 2.35, speed: [12, 20], make: r => makeIndianTruck(r), truckLane: true, mumbai: true },
  { key: 'tempo',    weight: 4,  L: 5.2,  W: 1.9,  speed: [13, 22], make: r => makeBoxTruck(pickIndiaColor(r), 5.2, 1.9, 2.2), truckLane: true, mumbai: true },
  { key: 'best',     weight: 4,  L: 10.5, W: 2.5,  speed: [12, 20], make: () => makeBus(0xa8342a, 10.5, 2.5, 3.0), truckLane: true, mumbai: true },
];

// Delhi NCR fleet: green CNG autos, green DTC buses, an SUV-heavy car mix
// (Fortuner nation), Haryana trucks — and everyone drives like the lane
// markings are a rumour.
export const DELHI_TYPES = [
  { key: 'rickshaw', weight: 18, L: 2.6,  W: 1.3,  speed: [14, 25], make: () => makeRickshaw(true), mumbai: true },
  { key: 'bike',     weight: 26, L: 2.0,  W: 0.7,  speed: [16, 30], make: r => makeBike(r), mumbai: true },
  { key: 'hatchM',   weight: 15, L: 3.6,  W: 1.6,  speed: [16, 30], make: r => sc(makeIndianHatch(pickIndiaColor(r)), r), mumbai: true },
  { key: 'sedanM',   weight: 9,  L: 4.2,  W: 1.75, speed: [16, 30], make: r => sc(makeCar(pickIndiaColor(r), 4.2, 1.75, 1.5, 0.56, r), r), mumbai: true },
  { key: 'suvM',     weight: 13, L: 4.6,  W: 1.85, speed: [17, 32], make: r => sc(makeBoxSUV(pickIndiaColor(r)), r), mumbai: true },
  { key: 'mpv',      weight: 6,  L: 4.7,  W: 1.83, speed: [15, 28], make: r => sc(makeMinivan(pickIndiaColor(r), 4.7, 1.83, 1.8), r), mumbai: true },
  { key: 'truckIN',  weight: 6,  L: 7.2,  W: 2.35, speed: [12, 20], make: r => makeIndianTruck(r), truckLane: true, mumbai: true },
  { key: 'tempo',    weight: 4,  L: 5.2,  W: 1.9,  speed: [13, 22], make: r => makeBoxTruck(pickIndiaColor(r), 5.2, 1.9, 2.2), truckLane: true, mumbai: true },
  { key: 'dtc',      weight: 5,  L: 11.0, W: 2.5,  speed: [12, 20], make: () => makeBus(0x2f8a3a, 11.0, 2.5, 3.0), truckLane: true, mumbai: true },
];
// Delhi–Kolkata rural mix: bikes and painted lorries dominate, with shared
// transport and a visible but secondary private-car presence.
export const DELK_TYPES = DELHI_TYPES.map(t => ({ ...t, weight: ({
  rickshaw: 12, bike: 34, hatchM: 12, sedanM: 5, suvM: 7, mpv: 3,
  truckIN: 16, tempo: 8, dtc: 3,
}[t.key] ?? t.weight) }));
const DELHI_ZONES = new Set(['d_gurgaon', 'd_nh48', 'd_igi', 'd_dhaula', 'd_lutyens',
  'd_cp', 'd_ito', 'd_yamuna', 'd_noida', 'd_ring', 'd_pbagh', 'd_bgarh', 'd_sampla', 'd_rohtak']);

// Aundh–Baner inner-Pune fleet: the two-wheeler city — bikes and scooters are
// the outright majority, rickshaws thick behind them, cars a minority, and the
// green-and-white PMPML bus shouldering through. No kaali-peelis (that's
// Mumbai); crawl speeds all round.
export const AUNDH_TYPES = [
  { key: 'bike',     weight: 46, L: 2.0,  W: 0.7,  speed: [12, 24], make: r => makeBike(r), mumbai: true },
  { key: 'rickshaw', weight: 20, L: 2.6,  W: 1.3,  speed: [10, 20], make: () => makeRickshaw(), mumbai: true },
  { key: 'hatchM',   weight: 11, L: 3.6,  W: 1.6,  speed: [11, 22], make: r => sc(makeIndianHatch(pickIndiaColor(r)), r), mumbai: true },
  { key: 'sedanM',   weight: 4,  L: 4.0,  W: 1.7,  speed: [11, 22], make: r => sc(makeCar(pickIndiaColor(r), 4.0, 1.7, 1.5, 0.56, r), r), mumbai: true },
  { key: 'suvM',     weight: 6,  L: 4.4,  W: 1.8,  speed: [11, 23], make: r => sc(makeBoxSUV(pickIndiaColor(r)), r), mumbai: true },
  { key: 'mpv',      weight: 3,  L: 4.7,  W: 1.83, speed: [11, 22], make: r => sc(makeMinivan(pickIndiaColor(r), 4.7, 1.83, 1.8), r), mumbai: true },
  { key: 'tempo',    weight: 3,  L: 5.2,  W: 1.9,  speed: [9, 16],  make: r => makeBoxTruck(pickIndiaColor(r), 5.2, 1.9, 2.2), truckLane: true, mumbai: true },
  { key: 'truckIN',  weight: 1,  L: 7.2,  W: 2.35, speed: [8, 14],  make: r => makeIndianTruck(r), truckLane: true, mumbai: true },
  { key: 'pmpml',    weight: 4,  L: 10.5, W: 2.5,  speed: [9, 16],  make: () => makeBus(0x1f7a4d, 10.5, 2.5, 3.0), truckLane: true, mumbai: true },
];
const AUNDH_ZONES = new Set(['p_gaon', 'p_aundh', 'p_link', 'p_baner', 'p_bale', 'p_pashan', 'p_iti']);

// Mumbai–Pune highway fleet: no rickshaws, but Pune runs on two-wheelers so
// bikes swarm the road; cars, painted lorries and the odd state bus round it out.
export const PUNE_TYPES = [
  MUMBAI_TYPES.find(t => t.key === 'bike'),
  MUMBAI_TYPES.find(t => t.key === 'kaali'),
  MUMBAI_TYPES.find(t => t.key === 'hatchM'),
  MUMBAI_TYPES.find(t => t.key === 'sedanM'),
  MUMBAI_TYPES.find(t => t.key === 'suvM'),
  MUMBAI_TYPES.find(t => t.key === 'mpv'),
  MUMBAI_TYPES.find(t => t.key === 'truckIN'),
  MUMBAI_TYPES.find(t => t.key === 'tempo'),
  MUMBAI_TYPES.find(t => t.key === 'best'),
].map((t, i) => ({
  ...t,
  weight: [38, 4, 18, 9, 9, 7, 9, 4, 5][i],
  speed: [[30, 46], [38, 50], [48, 62], [48, 62], [50, 65], [50, 65], [34, 46], [40, 52], [42, 55]][i],
}));

// South Mumbai (Sea Link / Marine Drive): a modern road — orderly lanes, the
// black-yellow kaali-peeli taxis everywhere, cars and two-wheelers, BEST buses,
// and no autorickshaws. mumbai:false so they hold lanes at a decent clip.
export const SOUTH_MUMBAI_TYPES = [
  MUMBAI_TYPES.find(t => t.key === 'kaali'),
  MUMBAI_TYPES.find(t => t.key === 'hatchM'),
  MUMBAI_TYPES.find(t => t.key === 'sedanM'),
  MUMBAI_TYPES.find(t => t.key === 'suvM'),
  MUMBAI_TYPES.find(t => t.key === 'mpv'),
  MUMBAI_TYPES.find(t => t.key === 'bike'),
  MUMBAI_TYPES.find(t => t.key === 'best'),
].map((t, i) => ({
  ...t, mumbai: false,
  weight: [24, 16, 11, 11, 7, 24, 7][i],
  speed: [[24, 38], [28, 44], [28, 44], [28, 44], [28, 44], [26, 42], [22, 34]][i],
}));

// city-fleet zones (taxis, MTA buses): NYC boroughs the whole way out, plus
// the Bronx stretches of I-95/I-287 — yellow cabs run all five boroughs
const CITY_TAXI_ZONES = new Set([
  'city', 'bronx', 'nybronx', 'yonkers', 'gwb287',
  'gwb', 'washheights', 'harlem', 'ues', 'midtown', 'tunnel',
  'lic', 'woodside', 'corona', 'flushing', 'newhydepark', 'mineola',
  'jericho', 'li_return',
  // NYC fleet begins after Newark Bay in Hudson County. Newark/Union retain
  // ordinary NJ traffic rather than premature yellow cabs and MTA buses.
  'i78_jerseycity', 'i78_holland', 'i78_manhattan',
  'i78_qmt', 'i78_queens', 'i78_nassau', 'i78_jericho',
  'i278_staten', 'i278_verrazzano', 'i278_brooklyn', 'i278_kosciuszko',
  'i278_queens', 'i278_rfk', 'i278_bronx',
  'i280_oranges', 'i280_newark', 'us22_union', 'us22_newark',
  // European city ends of the A1 / A-4 / A3
  'pt_lisboa', 'pt_gaia', 'pt_porto', 'pt_coimbra',
  'es_madrid', 'es_sur', 'es_cordoba', 'es_sevilla',
  'de_ffm', 'de_bonn', 'de_koeln',
  'it_roma', 'it_napoli',
  'lib_reston',
]);

// NJ Turnpike is wall-to-wall trucking
const NJ_BOOST = { semi: 22, boxtruck: 13, bus: 7 };

// ---------------------------------------------------------------------------
// Brand badging: a chrome wordmark on the tail, one shared texture per brand.
// Market-share realistic per region and body style; wealthy zones skew the
// German-luxury share the way real driveways do.
// ---------------------------------------------------------------------------
const LUX_BRANDS = new Set(['BMW', 'MERCEDES', 'AUDI', 'LEXUS', 'VOLVO', 'PORSCHE']);
const US_CAR_BRANDS = [['TOYOTA', 16], ['HONDA', 14], ['CHEVROLET', 8], ['NISSAN', 8], ['HYUNDAI', 7], ['KIA', 7], ['FORD', 6], ['MAZDA', 5], ['SUBARU', 5], ['VOLKSWAGEN', 3], ['BMW', 3], ['MERCEDES', 3], ['LEXUS', 3], ['AUDI', 2]];
const US_SUV_BRANDS = [['TOYOTA', 15], ['HONDA', 12], ['FORD', 11], ['CHEVROLET', 10], ['JEEP', 9], ['HYUNDAI', 7], ['KIA', 7], ['SUBARU', 6], ['NISSAN', 6], ['GMC', 4], ['MAZDA', 4], ['BMW', 3], ['MERCEDES', 3], ['LEXUS', 3], ['AUDI', 2], ['VOLVO', 2]];
const US_PICKUP_BRANDS = [['FORD', 34], ['CHEVROLET', 24], ['RAM', 22], ['TOYOTA', 11], ['GMC', 6], ['NISSAN', 3]];
const US_MINIVAN_BRANDS = [['HONDA', 30], ['TOYOTA', 28], ['CHRYSLER', 24], ['KIA', 18]];
const US_VAN_BRANDS = [['FORD', 40], ['RAM', 25], ['MERCEDES', 20], ['CHEVROLET', 15]];
const US_SPORTS_BRANDS = [['FORD', 26], ['CHEVROLET', 26], ['DODGE', 18], ['PORSCHE', 12], ['BMW', 10], ['TOYOTA', 8]];
const US_LUXURY_BRANDS = [['LEXUS', 18], ['BMW', 17], ['MERCEDES', 17], ['AUDI', 12], ['CADILLAC', 11], ['GENESIS', 9], ['VOLVO', 8], ['LINCOLN', 5], ['PORSCHE', 3]];
const US_TAXI_BRANDS = [['TOYOTA', 35], ['FORD', 22], ['NISSAN', 18], ['HONDA', 10], ['CHRYSLER', 8], ['KIA', 7]];
const EU_CAR_BRANDS = [['VOLKSWAGEN', 13], ['TOYOTA', 7], ['BMW', 7], ['MERCEDES', 7], ['AUDI', 6], ['ŠKODA', 6], ['RENAULT', 6], ['PEUGEOT', 6], ['FORD', 5], ['OPEL', 5], ['FIAT', 5], ['DACIA', 5], ['CITROËN', 4], ['SEAT', 4], ['HYUNDAI', 4], ['KIA', 4], ['VOLVO', 3]];
const IN_CAR_BRANDS = [['MARUTI SUZUKI', 30], ['HYUNDAI', 15], ['TATA', 14], ['MAHINDRA', 12], ['TOYOTA', 7], ['HONDA', 6], ['KIA', 6]];
// home-market skew: French brands own the A16, Fiat owns the A1, VAG+BMW+Merc
// own the Autobahn, Vauxhall/Ford carry Britain
const EU_HOME = MAP === 'a16' ? { RENAULT: 3, PEUGEOT: 3, 'CITROËN': 3, DACIA: 2 }
  : MAP === 'a1it' ? { FIAT: 4 }
  : (MAP === 'a3' || MAP === 'swiss') ? { VOLKSWAGEN: 2, BMW: 2, MERCEDES: 2, AUDI: 2 }
  : (MAP === 'a1' || MAP === 'a4') ? { RENAULT: 2, PEUGEOT: 2, SEAT: 2.5 }
  : MAP === 'm1' ? { FORD: 2, VAUXHALL: 99 } : {};   // 99 = injected below
const EU_POOL = MAP === 'm1' ? [...EU_CAR_BRANDS, ['VAUXHALL', 6]] : EU_CAR_BRANDS;

const BRAND_CATEGORY = {
  sedan: 'car', hatch: 'car', coupe: 'car', wagon: 'car', classic: 'car',
  suv: 'suv', crossover: 'suv', offroad: 'suv', pickup: 'pickup',
  minivan: 'minivan', van: 'van', sports: 'sports', muscle: 'sports',
  luxsedan: 'luxury', luxsuv: 'luxury', taxi: 'taxi',
  // Indian fleet: Maruti/Tata/Mahindra wordmarks on the boot like everyone else
  hatchM: 'car', sedanM: 'car', suvM: 'suv', mpv: 'minivan',
};
const badgeMatCache = new Map();
function badgeMat(name) {
  if (badgeMatCache.has(name)) return badgeMatCache.get(name);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 44;
  const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${name.length > 9 ? 26 : 32}px "Helvetica Neue", Arial, sans-serif`;
  g.lineWidth = 3; g.strokeStyle = 'rgba(20,22,26,.9)';
  g.strokeText(name, 128, 24);
  g.fillStyle = '#dde2e8';
  g.fillText(name, 128, 24);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({
    map: tex, transparent: true, roughness: 0.35, metalness: 0.7,
  });
  badgeMatCache.set(name, mat);
  return mat;
}
export function addBrandBadge(group, type, zoneKey, rand) {
  let name;
  if (type.key === 'tesla') name = 'TESLA';
  else {
    const cat = BRAND_CATEGORY[type.key];
    if (!cat) return;
    const pool = type.mumbai ? IN_CAR_BRANDS
      : (EURO || UK) ? EU_POOL
      : cat === 'suv' ? US_SUV_BRANDS : cat === 'pickup' ? US_PICKUP_BRANDS
      : cat === 'minivan' ? US_MINIVAN_BRANDS : cat === 'van' ? US_VAN_BRANDS
      : cat === 'sports' ? US_SPORTS_BRANDS : cat === 'luxury' ? US_LUXURY_BRANDS
      : cat === 'taxi' ? US_TAXI_BRANDS : US_CAR_BRANDS;
    const luxK = WEALTH_ZONES[zoneKey] ?? 1;
    const wOf = ([n, wt]) => wt * (LUX_BRANDS.has(n) ? luxK : 1) * ((EURO || UK) && EU_HOME[n] && EU_HOME[n] < 99 ? EU_HOME[n] : 1);
    let total = 0;
    for (const e of pool) total += wOf(e);
    let x = rand() * total;
    name = pool[0][0];
    for (const e of pool) { x -= wOf(e); if (x <= 0) { name = e[0]; break; } }
  }
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.052), badgeMat(name));
  badge.position.set(type.W * 0.22, 0.68, -type.L / 2 - 0.025);
  badge.rotation.y = Math.PI;
  group.add(badge);
}

// Wealth geography: Teslas (and German luxury badges) cluster here — the Bay
// Area most of all — but exist everywhere at the baseline weight.
const WEALTH_ZONES = {
  sf: 4.5, baybridge: 4, oakland: 2.2, i580: 3, dublin: 4, i680: 3.5,
  vallejo: 1.4, richmond: 1.8, eastbay: 3,
  westchester: 2.5, westch: 2.2, morristown: 2.4, bridgewater: 2,
  suburb: 1.7, gsp_monmouth: 2, gsp_north: 2, gsp_raritan: 1.6,
  masspike: 2, boston: 2.2, logan: 2, corridor: 2,
  chidt: 1.6, i90ken: 1.6, wchester75: 1.6, indy: 1.3,
  // I-95 south: DC/NoVA money, and the Gold Coast (Palm Beach the richest)
  va_springfield: 2.2, md_beltway: 1.8, va_fredvburg: 1.3,
  fl_wpb: 2.6, fl_ftlaud: 1.8, fl_miami: 2.0, fl_stlucie: 1.3, fl_melbourne: 1.2,
};

// Per-zone vehicle-type multipliers, layered on the base fleet weights so the
// mix looks regional: the rural South runs on pickups and long-haul trucks;
// South Florida skews to convertibles/coupes (and rentals = more plain
// sedans), the retiree coast to sedans and minivans. Applied in pickType.
const REGIONAL_BOOST = {
  brp_kensico: { sedan: 1.15, suv: 1.25, pickup: .55, semi: .05, boxtruck: .35 },
  brp_scarsdale: { sedan: 1.2, suv: 1.25, pickup: .45, semi: .05, boxtruck: .3 },
  brp_bronxville: { sedan: 1.22, suv: 1.18, pickup: .5, semi: .05, boxtruck: .4 },
  brp_woodlawn: { sedan: 1.2, suv: 1.1, taxi: 1.2, pickup: .5, semi: .05 },
  brp_bronx: { sedan: 1.2, taxi: 1.8, pickup: .4, semi: .05, boxtruck: .65 },
  brp_story: { taxi: 2.0, sedan: 1.15, pickup: .35, semi: .4, boxtruck: 1.1 },
  brp_bruckner: { taxi: 1.8, sedan: 1.1, pickup: .4, semi: 1.2, boxtruck: 1.25 },
  brp_i295_bronx: { taxi: 1.55, sedan: 1.15, semi: 1.05, boxtruck: 1.15 },
  brp_throgs: { sedan: 1.2, suv: 1.15, taxi: 1.25, semi: .9 },
  brp_bayside: { sedan: 1.2, suv: 1.2, taxi: 1.35, pickup: .45 },
  brp_i495: { sedan: 1.2, suv: 1.15, taxi: 1.5, boxtruck: 1.05 },
  brp_queensvillage: { sedan: 1.2, suv: 1.15, taxi: 1.45, pickup: .45 },
  i278_nj440: { semi: 1.45, boxtruck: 1.35, pickup: 1.05, taxi: 0.25 },
  i278_outerbridge: { semi: 1.25, boxtruck: 1.2, sedan: 1.1, taxi: 0.45 },
  i278_westshore: { sedan: 1.15, suv: 1.15, taxi: 0.8, semi: 0.85 },
  i278_staten: { sedan: 1.2, suv: 1.15, taxi: 1.15, pickup: 0.65 },
  i278_verrazzano: { sedan: 1.2, suv: 1.15, taxi: 1.5, pickup: 0.45 },
  i278_brooklyn: { taxi: 2.4, sedan: 1.2, pickup: 0.25, boxtruck: 1.15 },
  i278_kosciuszko: { taxi: 2.1, sedan: 1.15, pickup: 0.3, boxtruck: 1.2 },
  i278_queens: { taxi: 2.0, sedan: 1.15, pickup: 0.35, boxtruck: 1.15 },
  i278_rfk: { taxi: 2.2, sedan: 1.15, pickup: 0.3 },
  i278_bronx: { taxi: 2.0, sedan: 1.15, pickup: 0.35, boxtruck: 1.2 },
  nh48_mumbai: { bike: 2.0, rickshaw: 1.7, truckIN: 1.1, sedan: 1.15 },
  nh48_panvel: { bike: 1.6, rickshaw: 1.25, truckIN: 1.35, tempo: 1.2 },
  nh48_ghat: { truckIN: 1.6, tempo: 1.25, bike: 1.15 },
  nh48_pune: { bike: 1.7, rickshaw: 1.35, sedan: 1.2, truckIN: 1.15 },
  nh48_satara: { truckIN: 1.45, tempo: 1.2, bike: 1.1 },
  nh48_karad: { truckIN: 1.5, tempo: 1.25, bike: 1.05 },
  nh48_kolhapur: { bike: 1.35, truckIN: 1.45, tempo: 1.2 },
  nh48_border: { truckIN: 1.65, tempo: 1.25 },
  nh48_belagavi: { bike: 1.35, truckIN: 1.5, tempo: 1.25 },
  nh48_hubballi: { bike: 1.4, truckIN: 1.55, tempo: 1.25 },
  nh48_haveri: { truckIN: 1.8, tempo: 1.35, bike: .9 },
  nh48_davanagere: { truckIN: 1.65, tempo: 1.3, bike: 1.0 },
  nh48_tumakuru: { bike: 1.45, truckIN: 1.45, tempo: 1.25 },
  nh48_bengaluru: { bike: 2.0, rickshaw: 1.7, sedan: 1.25, truckIN: 1.1 },
  // California I-5: dense LA/Silicon Valley commuter mix, pickups inland,
  // and a visibly heavy long-haul tractor share through the Central Valley.
  cal5_la: { sedan: 1.2, suv: 1.25, tesla: 1.35, pickup: 0.65, semi: 1.05 },
  cal5_santaclarita: { suv: 1.15, pickup: 0.9, semi: 1.15 },
  cal5_tejon: { pickup: 1.25, semi: 1.75, sedan: 0.85 },
  cal5_bakersfield: { pickup: 1.65, semi: 1.65, suv: 1.1, sedan: 0.82 },
  cal5_valley: { pickup: 1.55, semi: 1.9, suv: 1.05, sedan: 0.78 },
  cal5_pacheco: { pickup: 1.25, semi: 1.55, sedan: 0.9 },
  cal5_silicon: { tesla: 2.4, sedan: 1.15, suv: 1.2, pickup: 0.6, semi: 1.0 },
  cal5_sf: { tesla: 2.2, sedan: 1.2, suv: 1.15, pickup: 0.55, semi: 1.0 },
  // NYC: yellow cabs everywhere, thick through Manhattan; pickups near-absent
  gwb: { taxi: 1.7, pickup: 0.4, sedan: 1.1 },
  washheights: { taxi: 2.3, pickup: 0.35, suv: 0.9, sedan: 1.15 },
  harlem: { taxi: 2.4, pickup: 0.35, suv: 0.9, sedan: 1.15 },
  ues: { taxi: 2.8, pickup: 0.3, suv: 0.95, sedan: 1.15, tesla: 1.3 },
  midtown: { taxi: 3.2, pickup: 0.3, suv: 0.9, sedan: 1.15 },
  tunnel: { taxi: 2.6, pickup: 0.35, sedan: 1.1 },
  lic: { taxi: 1.9, pickup: 0.5, sedan: 1.1 },
  woodside: { taxi: 1.7, pickup: 0.55, sedan: 1.05 },
  corona: { taxi: 1.6, pickup: 0.55, sedan: 1.05 },
  flushing: { taxi: 1.6, pickup: 0.55, sedan: 1.05 },
  i78_jerseycity: { taxi: 2.0, pickup: 0.3, sedan: 1.2, suv: 0.9 },
  i78_holland: { taxi: 2.8, pickup: 0.25, sedan: 1.2 },
  i78_manhattan: { taxi: 3.2, pickup: 0.2, sedan: 1.15 },
  i78_qmt: { taxi: 2.8, pickup: 0.25, sedan: 1.15 },
  i78_queens: { taxi: 2.4, pickup: 0.35, sedan: 1.1 },
  i78_nassau: { taxi: 1.5, pickup: 0.55, sedan: 1.05 },
  i78_jericho: { taxi: 1.2, pickup: 0.65, sedan: 1.05 },
  i280_oranges: { taxi: 1.15, pickup: 0.55, sedan: 1.1 },
  i280_newark: { taxi: 1.8, pickup: 0.35, sedan: 1.2 },
  us22_union: { taxi: 1.25, pickup: 0.5, sedan: 1.1 },
  us22_newark: { taxi: 1.75, pickup: 0.35, sedan: 1.2 },
  // US-1's fleet changes with its land use: family/commuter traffic around the
  // malls and Metropark, freight around Bayway/EWR, then taxis near Jersey City.
  trenton: { sedan: 1.2, minivan: 1.15, pickup: 0.85, semi: 0.75 },
  lawrence: { sedan: 1.15, suv: 1.1, minivan: 1.15, semi: 0.7 },
  princeton: { sedan: 1.2, suv: 1.15, tesla: 1.55, pickup: 0.65, semi: 0.55 },
  nbrunswick: { suv: 1.2, minivan: 1.2, pickup: 0.9, semi: 0.8 },
  newbrunswick: { sedan: 1.25, bus: 1.35, pickup: 0.65, semi: 0.65 },
  edison: { sedan: 1.15, suv: 1.2, minivan: 1.3, semi: 0.85 },
  iselin: { sedan: 1.25, suv: 1.15, tesla: 1.25, bus: 1.25, semi: 0.8 },
  woodbridge: { sedan: 1.15, suv: 1.15, boxtruck: 1.3, semi: 1.25 },
  linden: { pickup: 1.15, van: 1.3, boxtruck: 1.65, semi: 1.8, taxi: 0.45 },
  elizabeth: { van: 1.35, boxtruck: 1.6, semi: 1.7, bus: 1.25, taxi: 1.1 },
  newark1: { van: 1.3, boxtruck: 1.55, semi: 1.55, bus: 1.3, taxi: 1.4 },
  pulaski: { sedan: 1.15, van: 1.2, boxtruck: 1.35, semi: 1.25, taxi: 1.25 },
  jerseycity: { taxi: 2.15, sedan: 1.2, suv: 0.9, pickup: 0.35, semi: 0.7 },
  us1_return: { taxi: 1.35, sedan: 1.15, van: 1.15, pickup: 0.65 },
  // rural Carolinas / Georgia / Southside VA: pickup country, I-95 truck run
  va_southside: { pickup: 2.2, suv: 1.15, semi: 1.3, sedan: 0.85 },
  nc_roanokerap: { pickup: 2.2, suv: 1.15, semi: 1.3, sedan: 0.85 },
  nc_rockymount: { pickup: 2.0, suv: 1.15, semi: 1.25, sedan: 0.9 },
  nc_fayetteville: { pickup: 2.0, suv: 1.2, semi: 1.15 },   // Fort Bragg trucks
  nc_lumberton: { pickup: 2.3, suv: 1.15, semi: 1.35, sedan: 0.85 },
  nc40_east: { pickup: 2.0, suv: 1.15, semi: 1.3, sedan: 0.88 },
  nc40_benson: { pickup: 1.9, suv: 1.15, semi: 1.35, sedan: 0.9 },
  nc40_johnston: { pickup: 1.8, suv: 1.15, semi: 1.25, sedan: 0.92 },
  nc40_raleigh: { sedan: 1.2, suv: 1.2, tesla: 1.3, pickup: 0.8 },
  nc40_triangle: { sedan: 1.2, suv: 1.2, tesla: 1.45, pickup: 0.72 },
  nc40_burlington: { pickup: 1.45, suv: 1.12, semi: 1.15, sedan: 0.95 },
  nc40_greensboro: { sedan: 1.1, suv: 1.15, pickup: 1.05, semi: 1.2 },
  nc40_highpoint: { pickup: 1.35, suv: 1.15, semi: 1.2, sedan: 0.95 },
  nc40_salisbury: { pickup: 1.55, suv: 1.15, semi: 1.3, sedan: 0.9 },
  nc40_charlotte: { sedan: 1.2, suv: 1.25, tesla: 1.25, pickup: 0.85, semi: 1.1 },
  sc_dillon: { pickup: 2.3, suv: 1.15, semi: 1.4, sedan: 0.85 },
  sc_florence: { pickup: 1.9, suv: 1.15, semi: 1.3, sedan: 0.9 },
  sc_santee: { pickup: 2.2, suv: 1.15, semi: 1.4, sedan: 0.85 },
  sc_walterboro: { pickup: 2.3, suv: 1.15, semi: 1.4, sedan: 0.85 },
  ga_midway: { pickup: 2.2, suv: 1.15, semi: 1.4, sedan: 0.85 },
  ga_kingsland: { pickup: 2.1, suv: 1.15, semi: 1.35, sedan: 0.9 },
  // South Florida: convertibles, sports, exotics — and rental-fleet sedans/SUVs
  fl_miami: { coupe: 2.0, sports: 2.2, sedan: 1.15, suv: 1.1, pickup: 0.6 },
  fl_ftlaud: { coupe: 1.9, sports: 2.0, sedan: 1.15, suv: 1.1, pickup: 0.65 },
  fl_wpb: { coupe: 1.8, sports: 1.9, sedan: 1.1, suv: 1.1, pickup: 0.7 },
  // the retiree coast: big comfortable sedans and minivans, slower fleet
  fl_stlucie: { sedan: 1.35, minivan: 1.25, coupe: 1.2, pickup: 0.8 },
  fl_melbourne: { sedan: 1.3, minivan: 1.2, pickup: 0.85 },
  fl_daytona: { sedan: 1.25, minivan: 1.15, coupe: 1.15 },
  tx_dallas: { pickup: 2.0, suv: 1.2, semi: 1.35, sedan: 0.85 },
  tx_lancaster: { pickup: 2.2, suv: 1.2, semi: 1.45, sedan: 0.82 },
  tx_corsicana: { pickup: 2.3, suv: 1.15, semi: 1.55, sedan: 0.8 },
  tx_palestine: { pickup: 2.2, suv: 1.15, semi: 1.5, sedan: 0.8 },
  tx_huntsville: { pickup: 2.0, suv: 1.15, semi: 1.45, sedan: 0.85 },
  tx_woodlands: { pickup: 1.5, suv: 1.25, semi: 1.25, sedan: 0.95 },
  tx_houston: { pickup: 1.3, suv: 1.2, semi: 1.35, sedan: 1.0 },
  fltp_miami: { coupe: 1.8, sports: 1.8, sedan: 1.15, suv: 1.15, pickup: 0.65 },
  fltp_broward: { coupe: 1.6, sports: 1.5, sedan: 1.15, suv: 1.12, pickup: 0.7 },
  fltp_treasure: { sedan: 1.25, minivan: 1.2, coupe: 1.15, pickup: 0.8, semi: 1.2 },
  fltp_palm: { sedan: 1.2, minivan: 1.15, coupe: 1.3, sports: 1.25, pickup: 0.75 },
  fltp_lake: { pickup: 1.7, suv: 1.15, semi: 1.35, sedan: 0.9 },
  fltp_orlando: { sedan: 1.15, suv: 1.18, minivan: 1.2, semi: 1.25 },
  fltp_ocala: { pickup: 1.55, suv: 1.15, semi: 1.3, sedan: 0.9 },
  fltp_wildwood: { pickup: 1.45, suv: 1.15, semi: 1.35, sedan: 0.92 },
};

// Cincinnati Metro route 78 buses ply the Vine St corridor
const METRO_78 = {
  key: 'metro78', weight: 14, L: 12.2, W: 2.6, speed: [26, 32],
  make: () => makeMetroBus(), truckLane: true,
};

// European fleet mix: hatchbacks, wagons and white panel vans everywhere;
// pickups are a rarity and yellow school buses don't exist.
const EURO_WEIGHTS = {
  sedan: MAP === 'a3' || MAP === 'swiss' ? 17 : 13,
  hatch: MAP === 'a1it' || MAP === 'a16' ? 34 : MAP === 'm1' ? 32 : 29,
  suv: MAP === 'swiss' ? 12 : 9,
  wagon: MAP === 'a3' || MAP === 'swiss' ? 20 : 15,
  minivan: 5, coupe: 3, sports: MAP === 'a3' || MAP === 'a1it' ? 3 : 1.5,
  crossover: 0, offroad: 0, muscle: 0, classic: 0, luxsedan: 0, luxsuv: 0,
  pickup: 0.12, van: 13, boxtruck: 6, semi: MAP === 'a3' || MAP === 'a4' ? 11 : 8,
  bus: 2, school: 0, coach: 3,
  // motos are everywhere in Iberia, rarer on the cold A3/M1; the yellow cab
  // never appears — the euro taxi fleet takes over in the city zones
  moto: MAP === 'a3' ? 3 : (MAP === 'm1' || MAP === 'a16') ? 6
    : MAP === 'a1it' ? 14 : MAP === 'swiss' ? 5 : 9,   // Italy scooters; Switzerland cold + orderly
  taxi: 0,
  tesla: 2,                           // present across Europe, thinner than the US
  eurotaxi: MAP === 'm1' ? 30 : 24,   // London is wall-to-wall black cabs
};
export function pickType(rand, zoneKey) {
  const pool = zoneKey.startsWith('dk_') ? DELK_TYPES
    : zoneKey === 'mumbai' || zoneKey === 'chembur' || zoneKey === 'pune' || zoneKey === 'andheriW' || zoneKey === 'airport' || zoneKey === 'nh48_mumbai' ? MUMBAI_TYPES
    : AUNDH_ZONES.has(zoneKey) ? AUNDH_TYPES
    : DELHI_ZONES.has(zoneKey) ? DELHI_TYPES
    : zoneKey === 'puneX' || zoneKey === 'pcmc' || zoneKey.startsWith('nh48_') ? PUNE_TYPES
    : zoneKey === 'bandra' || zoneKey === 'sealink' || zoneKey === 'marine' ? SOUTH_MUMBAI_TYPES
    : VEHICLE_TYPES.filter(t => !t.cityOnly || CITY_TAXI_ZONES.has(zoneKey));
  const w = (EURO || UK) ? (t => EURO_WEIGHTS[t.key] ?? t.weight)
    : (t => {
      let base = (zoneKey === 'suburb' && NJ_BOOST[t.key]) || t.weight;
      if (t.key === 'tesla') base *= WEALTH_ZONES[zoneKey] ?? 1;
      if (t.luxury) base *= Math.sqrt(WEALTH_ZONES[zoneKey] ?? 1);
      base *= REGIONAL_BOOST[zoneKey]?.[t.key] ?? 1;
      return base;
    });
  let total = 0;
  for (const t of pool) total += w(t);
  let x = rand() * total;
  for (const t of pool) { x -= w(t); if (x <= 0) return t; }
  return pool[0];
}

// desired speed in m/s from the type's mph range
export function desiredSpeed(type, rand) {
  const [a, b] = type.speed;
  return (a + rand() * (b - a)) * MPH;
}
