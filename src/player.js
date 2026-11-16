import * as THREE from 'three';
import { MAP, DIR, MEDIAN_HALF, LANE_WIDTH, laneWidthAt, wrapS, MPH, EURO, UK } from './config.js';
import {
  posAt, headingAt, elevAt, pavedHalfAt, sideFactorAt, njGapAt, medianHalfAt, gwbLowerDrop,
  spurTAt, spurRiseAt, latForLane, distanceScaleAt, SPUR,
} from './road.js';
import { headlightMat, taillightMat, makeMetroBus, makeBike, makeBrakeGlow, WHEEL_MATS, contactShadow } from './vehicles.js';
import { registerEnvMaterial } from './sky.js';

// Driver's-eye interior: dash, tilted steering wheel (spins with input), a
// live gauge-cluster canvas behind it, rearview slab, mirror housings and
// A-pillars for the peripheral frame. Only visible in the cockpit cam.
function makeCockpit(seatX) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.85 });
  const dark2 = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.7 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.5), dark);
  dash.position.set(0, 0.9, 0.72); dash.rotation.x = 0.15; g.add(dash);
  const dashTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.34), dark2);
  dashTop.position.set(0, 1.0, 0.78); g.add(dashTop);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16),
    new THREE.MeshBasicMaterial({ color: 0x0e2233 }));
  screen.position.set(0, 1.02, 0.695); screen.rotation.y = Math.PI; screen.rotation.x = -0.12;
  g.add(screen);
  // steering wheel: fixed tilt, inner `spin` group turns with steering
  const wheelG = new THREE.Group();
  wheelG.position.set(seatX, 0.99, 0.55); wheelG.rotation.x = -0.42;
  const spin = new THREE.Group();
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.024, 10, 28), dark2));
  for (const a of [0, 2.1, -2.1]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.17, 0.02), dark2);
    sp.position.set(Math.sin(a) * 0.09, -Math.cos(a) * 0.09, 0);
    sp.rotation.z = a; spin.add(sp);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), dark);
  hub.rotation.x = Math.PI / 2; spin.add(hub);
  wheelG.add(spin); g.add(wheelG);
  // gauge cluster: live canvas, self-lit so it reads at night
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 224;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.18),
    new THREE.MeshBasicMaterial({ map: tex }));
  cluster.position.set(seatX, 1.05, 0.68);
  cluster.rotation.y = Math.PI; cluster.rotation.x = -0.14;
  g.add(cluster);
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.02), dark);
  mirror.position.set(0, 1.34, 0.42); mirror.rotation.x = -0.1; g.add(mirror);
  // blind-spot monitor lamps: amber dot inboard of each mirror, lit by traffic
  const bsmGeo = new THREE.PlaneGeometry(0.05, 0.05);
  const mkBsm = () => new THREE.MeshStandardMaterial({ color: 0x3a2a06, emissive: 0xffa817, emissiveIntensity: 0 });
  const bsmL = mkBsm(), bsmR = mkBsm(), bsmC = mkBsm();
  // master BSM tell-tale: small orange dot top-left of the rearview mirror,
  // lit whenever EITHER blind spot is occupied
  const tell = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.028), bsmC);
  tell.position.set(0.19, 1.385, 0.408);
  tell.rotation.y = Math.PI;
  g.add(tell);
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.24), dark);
    h.position.set(sx * 0.99, 1.02, 0.6); g.add(h);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.07), dark);
    p.position.set(sx * 0.82, 1.28, 0.62); p.rotation.x = 0.5; g.add(p);
    const lamp = new THREE.Mesh(bsmGeo, sx > 0 ? bsmL : bsmR);   // +x = vehicle's left
    lamp.position.set(sx * 0.9, 1.09, 0.63);
    lamp.rotation.y = Math.PI;                                   // faces the driver
    g.add(lamp);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.04, 0.5), dark);
  head.position.set(0, 1.52, 0.28); g.add(head);
  return { group: g, spin, ctx: cv.getContext('2d'), tex, bsmL, bsmR, bsmC };
}

// Silver Tesla Model X-style SUV: panoramic glass, clean EV fascia, flush
// details, aero wheels, full-width tail light bar. The player's EV option.
function makePlayerTeslaX() {
  const g = new THREE.Group();
  const bodyM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xc9ced5, roughness: 0.3, metalness: 0.75,
    clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.1,
  }));
  const glassM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x10161e, roughness: 0.06, metalness: 0.6, envMapIntensity: 1.4,
  }));
  const trimM = new THREE.MeshStandardMaterial({ color: 0x101217, roughness: 0.32, metalness: 0.65 });
  const chromeM = new THREE.MeshStandardMaterial({ color: 0xaeb6c0, roughness: 0.22, metalness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.99, 0.78, 5.05), bodyM);
  body.position.y = 0.72; body.castShadow = true; g.add(body);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.03, 0.18, 4.76), trimM);
  lower.position.y = 0.42; g.add(lower);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.46, 0.82), bodyM);
  nose.position.set(0, 0.86, 2.45); nose.rotation.x = 0.08; g.add(nose);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.62, 3.1), glassM);
  cab.position.set(0, 1.38, -0.15); cab.rotation.x = -0.035; g.add(cab);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.035, 2.38), glassM);
  roof.position.set(0, 1.71, -0.15); g.add(roof);
  // body-color A/B/C pillars, flush handles, rocker brightwork, and mirrors
  for (const x of [-0.82, 0.82]) {
    for (const z of [0.78, -0.58, -1.16]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.55, 0.08), trimM);
      pillar.position.set(x, 1.38, z); pillar.rotation.x = 0.06; g.add(pillar);
    }
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), bodyM);
    mirror.position.set(x * 1.24, 1.12, 0.7); g.add(mirror);
  }
  for (const z of [0.7, -0.45, -1.35]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.28), chromeM);
    handle.position.set(0.995, 1.0, z); g.add(handle);
    const handleOther = handle.clone(); handleOther.position.x = -0.995; g.add(handleOther);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.035, 4.15), chromeM);
  sill.position.set(0, 0.49, -0.02); g.add(sill);
  // smooth EV nose with a dark lower intake and centered Tesla-style badge
  const intake = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 0.05), trimM);
  intake.position.set(0, 0.58, 2.83); g.add(intake);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.03), chromeM);
  badge.position.set(0, 0.9, 2.86); badge.rotation.z = Math.PI / 4; g.add(badge);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  g.userData.wheels = [];
  for (const z of [1.62, -1.62]) for (const x of [-0.88, 0.88]) {
    const w = new THREE.Mesh(wheelGeo, WHEEL_MATS);
    w.position.set(x, 0.38, z);
    w.userData.r = 0.38;
    g.add(w);
    g.userData.wheels.push(w);
  }
  for (const x of [-0.68, 0.68]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.06), headlightMat);
    h.position.set(x, 1.02, 2.61); g.add(h);
    const lampBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.065), headlightMat);
    lampBar.position.set(x + Math.sign(x) * 0.14, 0.98, 2.61); g.add(lampBar);
  }
  // pre-cloned dim material: keeps the bar OFF the shared-taillight traversal
  // (no halo sprite, no full brake flare) — a light bar, not a flare cannon
  const barMat = taillightMat.clone();
  barMat.emissiveIntensity = 0.2;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.05), barMat);
  bar.position.set(0, 1.02, -2.53); g.add(bar);
  const rearLampL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.06), taillightMat);
  rearLampL.position.set(-0.76, 1.02, -2.53); g.add(rearLampL);
  const rearLampR = rearLampL.clone(); rearLampR.position.x = 0.76; g.add(rearLampR);
  const rearTrim = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.035, 0.05), chromeM);
  rearTrim.position.set(0, 0.84, -2.54); g.add(rearTrim);
  g.userData.barMat = barMat;
  return g;
}

// Dark navy BMW X5-style SUV. It is deliberately shorter, narrower and lower
// than the game's XC90, with a sportier greenhouse and rear haunches.
function makePlayerBmwX5() {
  const g = new THREE.Group();
  const bodyM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x071a35, roughness: 0.2, metalness: 0.82,
    clearcoat: 1, clearcoatRoughness: 0.055, envMapIntensity: 1.35,
  }));
  const glassM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x0a1420, roughness: 0.055, metalness: 0.56, transparent: true,
    opacity: 0.83, clearcoat: 0.85, envMapIntensity: 1.35,
  }));
  const blackM = new THREE.MeshStandardMaterial({ color: 0x080a0d, roughness: 0.28, metalness: 0.62 });
  const chromeM = new THREE.MeshStandardMaterial({ color: 0xbfc7d0, roughness: 0.17, metalness: 0.96 });
  const lensM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x340308, roughness: 0.08, metalness: 0.08, transparent: true,
    opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.1,
  }));

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.76, 4.84), bodyM);
  body.position.y = 0.7; body.castShadow = true; g.add(body);
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.24, 3.88), bodyM);
  shoulder.position.set(0, 1.04, -0.08); g.add(shoulder);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.2, 1.18), bodyM);
  hood.position.set(0, 1.04, 1.75); hood.rotation.x = -0.055; g.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.62, 2.56), glassM);
  cabin.position.set(0, 1.38, -0.27); cabin.rotation.x = -0.04; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.05, 2.2), bodyM);
  roof.position.set(0, 1.7, -0.31); g.add(roof);
  const cladding = new THREE.Mesh(new THREE.BoxGeometry(2.01, 0.18, 4.46), blackM);
  cladding.position.y = 0.4; g.add(cladding);

  // BMW window belt, roof rails, mirrors, door handles and Hofmeister-kink
  // dark insert toward the rear quarter glass.
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.045, 2.68), chromeM);
  belt.position.set(0, 1.14, -0.25); g.add(belt);
  for (const x of [-0.72, 0.72]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 2.65), chromeM);
    rail.position.set(x, 1.76, -0.3); g.add(rail);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.29), bodyM);
    mirror.position.set(x * 1.38, 1.18, 0.62); g.add(mirror);
    const kink = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.24), blackM);
    kink.position.set(x * 1.22, 1.39, -1.25); kink.rotation.x = -0.28; g.add(kink);
  }
  for (const z of [0.55, -0.55]) for (const x of [-1.0, 1.0]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.25), chromeM);
    handle.position.set(x, 1.0, z); g.add(handle);
  }

  // Twin kidney grille, slim headlamps and blue-white daytime signatures.
  for (const x of [-0.3, 0.3]) {
    const kidney = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.055), blackM);
    kidney.position.set(x, 0.8, 2.44); g.add(kidney);
    for (const sx of [-0.12, 0, 0.12]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.4, 0.065), chromeM);
      slat.position.set(x + sx, 0.8, 2.47); g.add(slat);
    }
  }
  for (const x of [-0.72, 0.72]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.17, 0.045), blackM);
    housing.position.set(x, 1.01, 2.43); g.add(housing);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.055), headlightMat);
    head.position.set(x, 1.02, 2.46); g.add(head);
  }
  const frontBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 18), chromeM);
  frontBadge.rotation.x = Math.PI / 2; frontBadge.position.set(0, 1.13, 2.25); g.add(frontBadge);

  // Sculpted smoked housings with a single continuous L-shaped LED guide per
  // side. Each guide is one taillight mesh, preserving realistic two-point
  // brake bloom instead of producing a halo for every tiny segment.
  const guideShape = new THREE.Shape();
  guideShape.moveTo(-0.44, 0.12); guideShape.lineTo(0.34, 0.12);
  guideShape.lineTo(0.46, 0.04); guideShape.lineTo(0.12, -0.03);
  guideShape.lineTo(-0.2, 0.01); guideShape.lineTo(-0.32, -0.25);
  guideShape.lineTo(-0.44, -0.22); guideShape.lineTo(-0.35, 0.02);
  guideShape.closePath();
  const guideGeo = new THREE.ShapeGeometry(guideShape);
  for (const side of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.36, 0.055), lensM);
    lens.position.set(side * 0.58, 1.03, -2.43); g.add(lens);
    const guide = new THREE.Mesh(guideGeo, taillightMat);
    guide.position.set(side * 0.58, 1.05, -2.465);
    guide.rotation.y = Math.PI;
    guide.scale.x = side;
    g.add(guide);
  }
  const tailTrim = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.035, 0.05), blackM);
  tailTrim.position.set(0, 0.82, -2.45); g.add(tailTrim);
  const rearBadge = frontBadge.clone(); rearBadge.position.set(0, 1.22, -2.455); rearBadge.rotation.x = -Math.PI / 2; g.add(rearBadge);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 0.16), blackM);
  diffuser.position.set(0, 0.43, -2.38); g.add(diffuser);
  for (const x of [-0.7, 0.7]) {
    const exhaust = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.08), chromeM);
    exhaust.position.set(x, 0.42, -2.48); g.add(exhaust);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.385, 0.385, 0.29, 18);
  wheelGeo.rotateZ(Math.PI / 2); g.userData.wheels = [];
  for (const z of [1.52, -1.52]) for (const x of [-0.91, 0.91]) {
    const w = new THREE.Mesh(wheelGeo, WHEEL_MATS); w.position.set(x, 0.385, z);
    w.userData.r = 0.385; g.add(w); g.userData.wheels.push(w);
  }
  return g;
}

// Black Volvo XC90-style SUV: upright Scandinavian greenhouse, tall shoulders,
// Thor's-hammer headlamps, roof rails, mirrors, grille, and vertical rear lamps.
// It shares the game's road-scale SUV proportions while remaining lightweight.
function makePlayerVolvoXC90() {
  const g = new THREE.Group();
  const bodyM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x111317, roughness: 0.24, metalness: 0.78,
    clearcoat: 1.0, clearcoatRoughness: 0.07, envMapIntensity: 1.2,
  }));
  const trimM = new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 0.34, metalness: 0.55 });
  const chromeM = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.2, metalness: 0.92 });
  const glassM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x0b1219, roughness: 0.08, metalness: 0.55, clearcoat: 0.8, envMapIntensity: 1.3,
  }));
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.9, 5.18), bodyM);
  body.position.y = 0.75; body.castShadow = true; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.24, 1.05), bodyM);
  hood.position.set(0, 1.08, 1.95); hood.rotation.x = -0.06; g.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.72, 2.95), glassM);
  cabin.position.set(0, 1.48, -0.28); cabin.rotation.x = -0.025; g.add(cabin);
  // black lower cladding, silver window belt, roof rails and side mirrors
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.27, 0.2, 4.7), trimM)).position.y = 0.43;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.055, 2.92), chromeM);
  belt.position.set(0, 1.19, -0.28); g.add(belt);
  for (const x of [-0.82, 0.82]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 3.45), chromeM);
    rail.position.set(x, 1.9, -0.25); g.add(rail);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.28), bodyM);
    mirror.position.set(x * 1.28, 1.2, 0.62); g.add(mirror);
  }
  // Volvo grille and diagonal-style central badge
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.42, 0.05), trimM);
  grille.position.set(0, 0.79, 2.6); g.add(grille);
  for (const x of [-0.38, 0, 0.38]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.06), chromeM);
    slat.position.set(x, 0.79, 2.57); slat.rotation.z = Math.PI / 2; g.add(slat);
  }
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.04), chromeM);
  badge.position.set(0, 0.8, 2.52); badge.rotation.z = -0.25; g.add(badge);
  // Thor's-hammer lamps and vertical rear lamp stacks
  for (const x of [-0.74, 0.74]) {
    const headHousing = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.035), trimM);
    headHousing.position.set(x, 1.0, 2.595); g.add(headHousing);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.11, 0.035), headlightMat);
    head.position.set(x, 1.0, 2.615); g.add(head);
    const tailHousing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.035), trimM);
    tailHousing.position.set(x * 1.34, 0.98, -2.595); g.add(tailHousing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.56, 0.035), taillightMat);
    tail.position.set(x * 1.34, 0.98, -2.615); g.add(tail);
  }
  const rearTrim = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.055, 0.05), chromeM);
  rearTrim.position.set(0, 0.86, -2.59); g.add(rearTrim);
  const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
  wheelGeo.rotateZ(Math.PI / 2); g.userData.wheels = [];
  for (const z of [1.62, -1.62]) for (const x of [-1.02, 1.02]) {
    const w = new THREE.Mesh(wheelGeo, WHEEL_MATS); w.position.set(x, 0.4, z);
    w.userData.r = 0.4; g.add(w); g.userData.wheels.push(w);
  }
  return g;
}

// Dark green Mercedes E-Class-style sedan: long-wheelbase executive profile,
// chrome grille with the three-point star, Digital Light signatures, clearcoat
// paint, and a warm luxury interior visible through the greenhouse.
function makePlayerMercedesE() {
  const g = new THREE.Group();
  const bodyM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x123b2c, roughness: 0.2, metalness: 0.78,
    clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.25,
  }));
  const glassM = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x101923, roughness: 0.07, metalness: 0.5, transparent: true,
    opacity: 0.78, clearcoat: 0.8, envMapIntensity: 1.25,
  }));
  const chromeM = new THREE.MeshStandardMaterial({ color: 0xc5cbd0, roughness: 0.18, metalness: 0.95 });
  const blackM = new THREE.MeshStandardMaterial({ color: 0x090b0d, roughness: 0.3, metalness: 0.5 });
  const leatherM = new THREE.MeshStandardMaterial({ color: 0x4a2e21, roughness: 0.78, metalness: 0.02 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x3b2418, roughness: 0.38, metalness: 0.18 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.72, 4.9), bodyM);
  body.position.y = 0.66; body.castShadow = true; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.2, 1.35), bodyM);
  hood.position.set(0, 0.98, 1.75); hood.rotation.x = -0.04; g.add(hood);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.18, 0.85), bodyM);
  deck.position.set(0, 0.98, -1.85); deck.rotation.x = 0.04; g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.6, 2.55), glassM);
  cabin.position.set(0, 1.2, -0.18); cabin.rotation.x = -0.035; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.035, 1.95), glassM);
  roof.position.set(0, 1.52, -0.18); g.add(roof);
  // warm leather front/rear seats and a wood-trimmed center console
  for (const z of [0.18, -0.8]) for (const x of [-0.56, 0.56]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.48), leatherM);
    seat.position.set(x, 0.92, z); seat.rotation.x = -0.08; g.add(seat);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.16), leatherM);
    head.position.set(x, 1.17, z - 0.12); g.add(head);
  }
  const console = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.15, 1.28), woodM);
  console.position.set(0, 0.92, -0.2); g.add(console);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.035), blackM);
  screen.position.set(0, 1.04, 0.58); screen.rotation.x = -0.16; g.add(screen);
  // chrome window surround, flush handles, mirrors, and lower rocker trim
  const surround = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.035, 2.66), chromeM);
  surround.position.set(0, 0.99, -0.18); g.add(surround);
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.035, 3.85), chromeM);
  rocker.position.set(0, 0.43, -0.05); g.add(rocker);
  for (const z of [0.78, -0.38, -1.18]) for (const x of [-1.04, 1.04]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.22), chromeM);
    handle.position.set(x, 0.91, z); g.add(handle);
  }
  for (const x of [-1.06, 1.06]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.12, 0.27), bodyM);
    mirror.position.set(x * 1.08, 1.03, 0.65); g.add(mirror);
  }
  // Panamericana-style grille and Mercedes three-point star.
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.38, 0.05), blackM);
  grille.position.set(0, 0.7, 2.48); g.add(grille);
  for (const x of [-0.38, -0.19, 0, 0.19, 0.38]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.31, 0.07), chromeM);
    slat.position.set(x, 0.7, 2.44); slat.rotation.z = Math.PI / 2; g.add(slat);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 8, 24), chromeM);
  ring.position.set(0, 0.72, 2.39); ring.rotation.x = Math.PI / 2; g.add(ring);
  for (const a of [0, 2.094, 4.188]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.15, 0.018), chromeM);
    spoke.position.set(Math.sin(a) * 0.075, 0.72 + Math.cos(a) * 0.075, 2.385); spoke.rotation.z = a; g.add(spoke);
  }
  // Digital Light: crisp outer lamps with three internal LED bars.
  for (const x of [-0.7, 0.7]) {
    const headHousing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.17, 0.035), blackM);
    headHousing.position.set(x, 0.9, 2.445); g.add(headHousing);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.1, 0.035), headlightMat);
    head.position.set(x, 0.9, 2.47); g.add(head);
    for (let i = -1; i <= 1; i++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.075), headlightMat);
      led.position.set(x + i * 0.085, 0.9, 2.445); g.add(led);
    }
    const tailHousing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.17, 0.035), blackM);
    tailHousing.position.set(x * 1.38, 0.86, -2.445); g.add(tailHousing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.1, 0.035), taillightMat);
    tail.position.set(x * 1.38, 0.86, -2.47); g.add(tail);
  }
  const rearChrome = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.04, 0.05), chromeM);
  rearChrome.position.set(0, 0.86, -2.44); g.add(rearChrome);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14);
  wheelGeo.rotateZ(Math.PI / 2); g.userData.wheels = [];
  for (const z of [1.45, -1.45]) for (const x of [-0.94, 0.94]) {
    const w = new THREE.Mesh(wheelGeo, WHEEL_MATS); w.position.set(x, 0.34, z);
    w.userData.r = 0.34; g.add(w); g.userData.wheels.push(w);
  }
  return g;
}

// Maroon Volkswagen Jetta-style sedan with a restrained rental-fleet finish,
// detailed lamps, grille badge, cabin, and small corner rental stickers on its
// Pennsylvania-style plate.
function makePlayerJetta() {
  const g = new THREE.Group();
  const paint = registerEnvMaterial(new THREE.MeshPhysicalMaterial({ color: 0x641d2a, roughness: 0.24, metalness: 0.72, clearcoat: 0.9, clearcoatRoughness: 0.08 }));
  const glass = registerEnvMaterial(new THREE.MeshPhysicalMaterial({ color: 0x0d1720, roughness: 0.06, metalness: 0.5, clearcoat: 0.8 }));
  const black = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.35, metalness: 0.45 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc1c6ca, roughness: 0.2, metalness: 0.9 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.58, 2.55), glass); cabin.position.set(0, 1.16, -0.2); cabin.rotation.x = -0.035; g.add(cabin);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.67, 4.78), paint); body.position.y = 0.64; body.castShadow = true; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.17, 1.18), paint); hood.position.set(0, 0.94, 1.78); g.add(hood);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.16, 0.88), paint); deck.position.set(0, 0.94, -1.82); g.add(deck);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.035, 2.0), glass); roof.position.set(0, 1.47, -0.2); g.add(roof);
  for (const x of [-0.92, 0.92]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.27), paint); mirror.position.set(x * 1.12, 1.02, 0.67); g.add(mirror);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 2.6), chrome); trim.position.set(x, 1.0, -0.2); g.add(trim);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.28, 0.05), black); grille.position.set(0, 0.72, 2.43); g.add(grille);
  for (const x of [-0.36, -0.18, 0, 0.18, 0.36]) { const slat = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.23, 0.06), chrome); slat.position.set(x, 0.72, 2.40); g.add(slat); }
  const badge = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 18), chrome); badge.position.set(0, 0.74, 2.36); badge.rotation.x = Math.PI / 2; g.add(badge);
  for (const x of [-0.66, 0.66]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.04), headlightMat); head.position.set(x, 0.88, 2.43); g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.15, 0.04), taillightMat); tail.position.set(x * 1.25, 0.84, -2.42); g.add(tail);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 14); wheelGeo.rotateZ(Math.PI / 2); g.userData.wheels = [];
  for (const z of [1.46, -1.46]) for (const x of [-0.88, 0.88]) { const w = new THREE.Mesh(wheelGeo, WHEEL_MATS); w.position.set(x, 0.34, z); w.userData.r = 0.34; g.add(w); g.userData.wheels.push(w); }
  g.userData.rentalStickers = true;
  return g;
}

// Silver Lexus ES-style sedan: low, quiet executive profile with the spindle
// grille and a restrained chrome/silver finish.
export function makePlayerLexusES() {
  const g = new THREE.Group();
  const paint = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xb9bec4, roughness: 0.2, metalness: 0.82,
    clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.2,
  }));
  const glass = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x101820, roughness: 0.06, metalness: 0.5,
    clearcoat: 0.85, envMapIntensity: 1.2,
  }));
  const black = new THREE.MeshStandardMaterial({ color: 0x101317, roughness: 0.32, metalness: 0.48 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd5d9dd, roughness: 0.16, metalness: 0.95 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.7, 4.92), paint);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.18, 1.35), paint);
  hood.position.set(0, 0.98, 1.78); hood.rotation.x = -0.04; g.add(hood);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.17, 0.82), paint);
  deck.position.set(0, 0.98, -1.86); deck.rotation.x = 0.04; g.add(deck);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.62, 2.58), glass);
  cabin.position.set(0, 1.2, -0.2); cabin.rotation.x = -0.035; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.035, 2.02), glass);
  roof.position.set(0, 1.53, -0.2); g.add(roof);
  for (const x of [-1.03, 1.03]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.27), paint);
    mirror.position.set(x * 1.08, 1.04, 0.66); g.add(mirror);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 2.7), chrome);
    trim.position.set(x, 1.0, -0.2); g.add(trim);
  }
  // Lexus spindle grille: dark inset with a silver V surround.
  const grille = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.42, 0.06, 4), black);
  grille.scale.set(1, 1, 0.38); grille.position.set(0, 0.73, 2.49); grille.rotation.y = Math.PI / 4; g.add(grille);
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.07), chrome);
    bar.position.set(side * 0.3, 0.84, 2.45); bar.rotation.z = side * 0.55; g.add(bar);
  }
  const badge = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 18), chrome);
  badge.position.set(0, 0.76, 2.43); badge.rotation.x = Math.PI / 2; g.add(badge);
  for (const x of [-0.69, 0.69]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.04), headlightMat);
    head.position.set(x, 0.9, 2.48); g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.04), taillightMat);
    tail.position.set(x * 1.32, 0.84, -2.48); g.add(tail);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14);
  wheelGeo.rotateZ(Math.PI / 2); g.userData.wheels = [];
  for (const z of [1.48, -1.48]) for (const x of [-0.93, 0.93]) {
    const w = new THREE.Mesh(wheelGeo, WHEEL_MATS);
    w.position.set(x, 0.34, z); w.userData.r = 0.34; g.add(w); g.userData.wheels.push(w);
  }
  return g;
}

// Gray Honda Jazz/Fit-style compact hatchback: tall greenhouse, short hood,
// high rear lamps, black lower cladding, chrome grille bar, and a small roof
// spoiler. It is intentionally more upright and practical than the sedans.
function makePlayerHondaJazz() {
  const g = new THREE.Group();
  const paint = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x777b80, roughness: 0.27, metalness: 0.72,
    clearcoat: 0.9, clearcoatRoughness: 0.08, envMapIntensity: 1.05,
  }));
  const glass = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x101820, roughness: 0.05, metalness: 0.5,
    clearcoat: 0.9, envMapIntensity: 1.25,
  }));
  const black = new THREE.MeshStandardMaterial({ color: 0x121518, roughness: 0.38, metalness: 0.42 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc0c5c9, roughness: 0.2, metalness: 0.92 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.72, 4.12), paint);
  body.position.y = 0.63; body.castShadow = true; g.add(body);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.15, 3.95), black);
  lower.position.y = 0.38; g.add(lower);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.82), paint);
  hood.position.set(0, 0.97, 1.56); g.add(hood);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.86, 2.22), glass);
  cabin.position.set(0, 1.33, -0.12); cabin.rotation.x = -0.035; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.045, 1.85), paint);
  roof.position.set(0, 1.78, -0.16); g.add(roof);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.5, 0.1), paint);
  hatch.position.set(0, 1.06, -2.02); hatch.rotation.x = 0.08; g.add(hatch);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.07, 0.22), black);
  spoiler.position.set(0, 1.73, -1.96); spoiler.rotation.x = -0.12; g.add(spoiler);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.57, 0.045, 2.72), black);
  belt.position.set(0, 0.98, -0.1); g.add(belt);
  for (const x of [-0.96, 0.96]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.27), paint);
    mirror.position.set(x * 1.1, 1.08, 0.63); g.add(mirror);
    const sideTrim = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 2.65), chrome);
    sideTrim.position.set(x * 0.985, 0.96, -0.1); g.add(sideTrim);
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.25, 0.05), black);
  grille.position.set(0, 0.72, 2.08); g.add(grille);
  const grilleBar = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.035, 0.06), chrome);
  grilleBar.position.set(0, 0.82, 2.045); g.add(grilleBar);
  const badge = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.016, 8, 18), chrome);
  badge.position.set(0, 0.75, 2.02); badge.rotation.x = Math.PI / 2; g.add(badge);
  for (const x of [-0.62, 0.62]) {
    const headHousing = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.19, 0.045), black);
    headHousing.position.set(x, 0.91, 2.08); g.add(headHousing);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.05), headlightMat);
    head.position.set(x, 0.91, 2.055); g.add(head);
    const rearHousing = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.045), black);
    rearHousing.position.set(x * 1.37, 1.18, -2.08); g.add(rearHousing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 0.05), taillightMat);
    tail.position.set(x * 1.37, 1.18, -2.105); g.add(tail);
  }
  const rearChrome = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.05), chrome);
  rearChrome.position.set(0, 0.76, -2.08); g.add(rearChrome);
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14);
  wheelGeo.rotateZ(Math.PI / 2); g.userData.wheels = [];
  for (const z of [1.28, -1.28]) for (const x of [-0.84, 0.84]) {
    const w = new THREE.Mesh(wheelGeo, WHEEL_MATS);
    w.position.set(x, 0.32, z); w.userData.r = 0.32; g.add(w); g.userData.wheels.push(w);
  }
  return g;
}

// BMW 3 Series in the same deep metallic blue: sportier stance, twin kidney
// grilles, slim quad-look lamps, boot-lip spoiler, twin exhaust tips.
function makePlayerCar() {
  const g = new THREE.Group();
  // deep metallic blue under a hard clearcoat — your car should look the best
  const bodyMat = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x274b8f, roughness: 0.34, metalness: 0.75,
    clearcoat: 1.0, clearcoatRoughness: 0.08, envMapIntensity: 1.0,
  }));
  const glassMat = registerEnvMaterial(new THREE.MeshPhysicalMaterial({
    color: 0x0d1620, roughness: 0.04, metalness: 0.7, envMapIntensity: 1.35,
  }));
  const trim = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.5, metalness: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb9bfc7, roughness: 0.25, metalness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.83, 0.68, 4.71), bodyMat);
  body.position.y = 0.64;
  body.castShadow = true;
  g.add(body);
  // low, raked greenhouse set back on the deck — the 3-series profile
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.5, 2.25), glassMat);
  cabin.position.set(0, 1.18, -0.32);
  g.add(cabin);
  // twin kidney grilles
  for (const x of [-0.21, 0.21]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.04), trim);
    k.position.set(x, 0.68, 2.36);
    g.add(k);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.03), chrome);
    ring.position.set(x, 0.68, 2.345);
    g.add(ring);
  }
  // boot-lip spoiler + twin exhaust tips
  const lip = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.16), bodyMat);
  lip.position.set(0, 1.0, -2.3);
  g.add(lip);
  for (const x of [-0.55, 0.55]) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), chrome);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(x, 0.34, -2.38);
    g.add(tip);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  g.userData.wheels = [];
  for (const z of [1.5, -1.5]) for (const x of [-0.83, 0.83]) {
    const w = new THREE.Mesh(wheelGeo, WHEEL_MATS);
    w.position.set(x, 0.34, z);
    w.userData.r = 0.34;
    g.add(w);
    g.userData.wheels.push(w);
  }
  for (const x of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06), headlightMat);
    h.position.set(x, 0.78, 2.36);
    g.add(h);
  }
  // --- 7-Series rear: slim, wide L-shaped tail-lamps joined by a full-width
  // LED light bar, with a chrome brightwork strip along the boot lid
  for (const x of [-0.6, 0.6]) {
    // horizontal blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.06), taillightMat);
    blade.position.set(x, 0.86, -2.36);
    g.add(blade);
    // short vertical hook wrapping the corner (the L)
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.06), taillightMat);
    hook.position.set(x + Math.sign(x) * 0.2, 0.77, -2.36);
    g.add(hook);
  }
  // full-width light bar linking the two lamps (glows across at night)
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.055, 0.045), taillightMat);
  lightBar.position.set(0, 0.86, -2.357);
  g.add(lightBar);
  // chrome strip above the light bar — the 7-Series boot brightwork
  const bootStrip = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.03, 0.05), chrome);
  bootStrip.position.set(0, 0.94, -2.352);
  g.add(bootStrip);
  return g;
}

// License plate for the current map: NJ straw-yellow on I-95, Ohio
// white/red/blue in the midwest, Maharashtra white HSRP in India.
// Random serial each run.
// default plate for the current map; US maps let you switch NJ/NY/OH live
export const DEFAULT_PLATE = MAP === 'newdelhi' ? 'DL'
  : (MAP === 'india' || MAP === 'nh48' || MAP === 'andheri' || MAP === 'aundh') ? 'MH'
  : MAP === 'nyc' ? 'NY'
  : MAP === 'a1' ? 'PT' : MAP === 'a4' ? 'ES' : MAP === 'a3' ? 'DE'
  : MAP === 'm1' ? 'GB' : MAP === 'a16' ? 'FR' : MAP === 'a1it' ? 'IT'
  : MAP === 'swiss' ? 'CH'
  : MAP === 'tx45' ? 'TX'
  : MAP === 'flturnpike' ? 'FL'
  : MAP === 'acx' ? 'MA'
  : (MAP === 'libertia' || MAP === 'i380' || MAP === 'i980' || MAP === 'lb24' || MAP === 'us67') ? 'LIB'
  : MAP === 'cal5' ? 'CA'
  : MAP === 'midwest' ? 'IL'
  : MAP === 'nc40' ? 'NC'
  : 'NJ';
const EU_PLATES = new Set(['PT', 'ES', 'DE', 'FR', 'NL', 'GB', 'IT', 'CH', 'AT']);
// keep one random serial per state for the run so switching back looks stable
const plateSerial = {};
function plateTexture(state = DEFAULT_PLATE) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  const rnd = (chars, n) => Array.from({ length: n }, () => chars[(Math.random() * chars.length) | 0]).join('');
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ', D = '0123456789';
  g.textAlign = 'center';
  if (EU_PLATES.has(state)) {
    // EU single-line plate: blue country band + star circle on the left,
    // white field (NL: yellow), black serial. PT keeps the yellow date band.
    const FMT = {
      PT: () => `${rnd(L, 2)}·${rnd(D, 2)}·${rnd(L, 2)}`,
      ES: () => `${rnd(D, 4)} ${rnd('BCDFGHJKLMNPRSTVWXYZ', 3)}`,
      DE: () => `${MAP === 'a3' ? 'K' : 'F'} ${rnd(L, 2)} ${rnd(D, 4)}`,
      FR: () => `${rnd(L, 2)}-${rnd(D, 3)}-${rnd(L, 2)}`,
      NL: () => `${rnd(D, 1)}-${rnd(L, 3)}-${rnd(D, 2)}`,
      GB: () => `${rnd(L, 2)}${rnd(D, 2)} ${rnd(L, 3)}`,
      IT: () => `${rnd(L, 2)} ${rnd(D, 3)} ${rnd(L, 2)}`,
      // Swiss: two-letter canton code + up to six digits (GE 123456)
      CH: () => `${['GE', 'VD', 'ZH', 'BE', 'LU', 'ZG', 'FR', 'AG'][(Math.random() * 8) | 0]} ${rnd(D, 6)}`,
      AT: () => `W ${rnd(D, 3)} ${rnd(L, 2)}`,
    };
    const S = plateSerial[state] ??= FMT[state]();
    cv.width = 384; cv.height = 82;
    g.fillStyle = (state === 'NL' || state === 'GB') ? '#f7c531' : '#f5f6f2';
    g.fillRect(0, 0, 384, 82);
    g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(2, 2, 380, 78);
    if (state !== 'GB' && state !== 'CH') {   // Britain left the EU; Switzerland was never in it — no star band
      g.fillStyle = '#0a3696';
      g.fillRect(4, 4, 34, 74);
      g.fillStyle = '#f8d040';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.fillRect(21 + Math.cos(a) * 10 - 1.4, 26 + Math.sin(a) * 10 - 1.4, 2.8, 2.8);
      }
      g.fillStyle = '#fff';
      g.font = 'bold 17px Arial';
      g.textAlign = 'center';
      g.fillText({ PT: 'P', ES: 'E', DE: 'D', FR: 'F', NL: 'NL', IT: 'I', AT: 'A' }[state], 21, 70);
    }
    if (state === 'CH') {   // Swiss plate: red band with the white cross on the right
      g.fillStyle = '#d52b1e'; g.fillRect(348, 4, 32, 74);
      g.fillStyle = '#fff';
      g.fillRect(362, 22, 4, 20); g.fillRect(354, 30, 20, 4);
      g.font = 'bold 12px Arial'; g.textAlign = 'center';
      g.fillText('CH', 364, 68);
    }
    if (state === 'PT') {
      g.fillStyle = '#f2c22e'; g.fillRect(346, 4, 34, 74);
      g.fillStyle = '#111'; g.font = 'bold 14px Arial';
      g.fillText('19', 363, 34); g.fillText('07', 363, 62);
    }
    if (state === 'IT') {   // Italian right-hand blue band (province + year)
      g.fillStyle = '#0a3696'; g.fillRect(352, 4, 28, 74);
      g.fillStyle = '#f8d040'; g.font = 'bold 13px Arial';
      g.fillText('RM', 366, 46);
    }
    g.fillStyle = '#111';
    g.font = 'bold 44px Arial';
    g.fillText(S, (state === 'PT' || state === 'GB' || state === 'IT' || state === 'CH') ? 188 : 208, 58);
  } else if (state === 'MH') {
    // Maharashtra: white HSRP, single-line horizontal, IND band on the left
    const S = plateSerial.MH ??= `MH 02 ${rnd(L, 2)} ${rnd(D, 4)}`;
    cv.width = 384; cv.height = 96;
    g.fillStyle = '#f5f6f2';
    g.fillRect(0, 0, 384, 96);
    g.strokeStyle = '#111';
    g.lineWidth = 5;
    g.strokeRect(3, 3, 378, 90);
    g.fillStyle = '#1a3a8c';
    g.fillRect(8, 8, 26, 80);
    g.fillStyle = '#fff';
    g.font = 'bold 13px Arial';
    g.save(); g.translate(21, 48); g.rotate(-Math.PI / 2);
    g.textAlign = 'center';
    g.fillText('IND', 0, 4); g.restore();
    g.fillStyle = '#111';
    g.textAlign = 'center';
    g.font = 'bold 46px Arial';
    g.fillText(S, 206, 64);
  } else if (state === 'OH') {
    // Ohio's current scenic base: sunrise over the state, blue serial, and
    // the aviation motto. Add a restrained landscape so it reads as a real
    // state plate at close range instead of a flat text card.
    const S = plateSerial.OH ??= `${rnd(L, 3)} ${rnd(D, 4)}`;
    const sky = g.createLinearGradient(0, 0, 0, 128);
    sky.addColorStop(0, '#b9d9ec'); sky.addColorStop(0.62, '#f8e4b0'); sky.addColorStop(1, '#d7e5d0');
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#f0a52f';
    g.globalAlpha = 0.72;
    g.beginPath(); g.arc(50, 64, 24, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = '#6c9464';
    g.beginPath(); g.moveTo(0, 92); g.quadraticCurveTo(44, 65, 88, 92);
    g.quadraticCurveTo(150, 58, 256, 88); g.lineTo(256, 128); g.lineTo(0, 128); g.closePath(); g.fill();
    g.fillStyle = '#4d7891'; g.fillRect(0, 104, 256, 24);
    // Small Wright Flyer silhouette on the left, behind the serial.
    g.strokeStyle = '#59666b'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(18, 49); g.lineTo(42, 45); g.lineTo(62, 51); g.moveTo(32, 47); g.lineTo(24, 58); g.moveTo(44, 46); g.lineTo(54, 58); g.stroke();
    g.fillStyle = '#c8102e';
    g.font = 'bold 22px Arial';
    g.fillText('OHIO', 128, 26);
    g.fillStyle = '#12356f';
    g.font = 'bold 58px Arial';
    g.fillText(S, 128, 86);
    g.fillStyle = '#1b3f8f';
    g.font = 'bold 14px Arial';
    g.fillText('BIRTHPLACE OF AVIATION', 128, 114);
  } else if (state === 'IL') {
    // Illinois: white fading to sky blue, blue serial, red ILLINOIS header
    const S = plateSerial.IL ??= `${rnd(L, 2)} ${rnd(D, 5)}`;
    // Illinois standard passenger plate: white reflective field, blue serial,
    // red state name, blue slogan, and small renewal markers.
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#fbfbf8');
    grad.addColorStop(1, '#d9e9f3');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#b8c4ca'; g.lineWidth = 2; g.strokeRect(2, 2, 252, 124);
    g.fillStyle = '#b3202c';
    g.font = 'bold 22px Arial';
    g.fillText('ILLINOIS', 128, 26);
    g.fillStyle = '#12356f';
    g.font = 'bold 8px Arial';
    g.fillText('OCT', 19, 17); g.fillText('YEAR', 237, 17);
    g.fillStyle = '#12356f';
    g.font = 'bold 62px Arial';
    g.fillText(S, 128, 86);
    g.font = 'bold 14px Arial';
    g.fillText('LAND OF LINCOLN', 128, 114);
  } else if (state === 'IN') {
    // Indiana standard passenger base: covered bridge landscape, blue serial,
    // and small county/year marks in the upper corners.
    const S = plateSerial.IN ??= `${rnd(D, 3)}${rnd(L, 3)}`;
    const sky = g.createLinearGradient(0, 0, 0, 128);
    sky.addColorStop(0, '#c6e0ec'); sky.addColorStop(0.58, '#f4f0d8'); sky.addColorStop(1, '#dce7d3');
    g.fillStyle = sky; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#7ea17e';
    g.beginPath(); g.moveTo(0, 83); g.quadraticCurveTo(55, 55, 112, 84); g.quadraticCurveTo(178, 50, 256, 79); g.lineTo(256, 128); g.lineTo(0, 128); g.closePath(); g.fill();
    // Covered bridge behind the serial.
    g.fillStyle = '#8a5035'; g.fillRect(84, 61, 86, 35);
    g.beginPath(); g.moveTo(78, 62); g.lineTo(176, 62); g.lineTo(168, 51); g.lineTo(86, 51); g.closePath(); g.fill();
    g.fillStyle = '#f1d19a'; g.fillRect(96, 70, 62, 17);
    g.fillStyle = '#6d402d';
    for (const x of [96, 109, 122, 135, 148, 158]) g.fillRect(x, 69, 3, 19);
    g.fillStyle = '#385f82'; g.fillRect(0, 102, 256, 26);
    g.fillStyle = '#12356f'; g.font = 'bold 22px Arial'; g.fillText('INDIANA', 128, 27);
    g.font = 'bold 8px Arial'; g.fillText('12', 18, 17); g.fillText('26', 238, 17);
    g.font = 'bold 58px Arial'; g.fillText(S, 128, 86);
    g.font = 'bold 14px Arial'; g.fillText('CROSSROADS OF AMERICA', 128, 118);
  } else if (state === 'MA') {
    // Massachusetts passenger normal: white field, blue legends, red serial,
    // with the small renewal markers used on the real plate.
    const S = plateSerial.MA ??= `${rnd(D, 1)}${rnd(L, 3)} ${rnd(D, 2)}`;
    g.fillStyle = '#f8f8f4';
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#b8b8b2';
    g.lineWidth = 2;
    g.strokeRect(2, 2, 252, 124);
    g.fillStyle = '#1b3f8f';
    g.font = 'bold 20px Arial';
    g.fillText('MASSACHUSETTS', 128, 26);
    g.font = 'bold 8px Arial';
    g.fillText('OCT', 19, 17);
    g.fillText('YEAR', 237, 17);
    g.fillStyle = '#b3202c';
    g.font = 'bold 62px Arial';
    g.fillText(S, 128, 86);
    g.fillStyle = '#1b3f8f';
    g.font = 'bold 14px Arial';
    g.fillText('THE SPIRIT OF AMERICA', 128, 114);
  } else if (state === 'CA') {
    const S = plateSerial.CA ??= `${rnd(D, 1)}${rnd(L, 3)}${rnd(D, 3)}`;
    g.fillStyle = '#fbfbf7'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#c8102e'; g.font = 'bold italic 22px Georgia'; g.fillText('California', 128, 26);
    g.fillStyle = '#12356f'; g.font = 'bold 58px Arial'; g.fillText(S, 128, 86);
    g.fillStyle = '#c8102e'; g.font = 'bold 14px Arial'; g.fillText('dmv.ca.gov', 128, 114);
  } else if (state === 'CT') {
    const S = plateSerial.CT ??= `${rnd(L, 2)}·${rnd(D, 5)}`;
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#e8f3fa'); grad.addColorStop(1, '#b8d4e7');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#174c82'; g.lineWidth = 2; g.strokeRect(2, 2, 252, 124);
    g.fillStyle = '#174c82'; g.fillRect(12, 14, 56, 4); g.fillRect(188, 14, 56, 4);
    g.fillStyle = '#174c82'; g.font = 'bold 20px Arial'; g.fillText('CONNECTICUT', 128, 26);
    // Connecticut seal: three small grape-vine motifs behind the serial.
    g.globalAlpha = 0.24; g.fillStyle = '#174c82';
    for (const x of [88, 128, 168]) { g.beginPath(); g.arc(x, 70, 11, 0, Math.PI * 2); g.fill(); g.fillRect(x - 2, 56, 4, 13); }
    g.globalAlpha = 1;
    g.fillStyle = '#174c82'; g.font = 'bold 56px Arial'; g.fillText(S, 128, 84);
    g.font = 'bold 14px Arial'; g.fillText('CONSTITUTION STATE', 128, 114);
  } else if (state === 'MD') {
    const S = plateSerial.MD ??= `${rnd(D, 1)}${rnd(L, 2)}${rnd(D, 4)}`;
    g.fillStyle = '#f8f8f5'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#243d5c'; g.lineWidth = 2; g.strokeRect(2, 2, 252, 124);
    g.fillStyle = '#b3202c'; g.font = 'bold 21px Arial'; g.fillText('MARYLAND', 128, 24);
    g.fillStyle = '#202c46'; g.font = 'bold 8px Arial'; g.fillText('OCT', 18, 15); g.fillText('YEAR', 238, 15);
    g.fillStyle = '#202c46'; g.font = 'bold 58px Arial'; g.fillText(S, 128, 84);
    // Maryland Proud: the state-flag pattern runs across the lower edge.
    const colors = ['#b3202c', '#f0c43d', '#1b3f78', '#111827'];
    for (let i = 0; i < 16; i++) {
      g.fillStyle = colors[i % colors.length]; g.fillRect(4 + i * 15.5, 102, 15.5, 22);
      if (i % 2 === 0) { g.fillStyle = '#f5d46a'; g.beginPath(); g.moveTo(4 + i * 15.5, 102); g.lineTo(19.5 + i * 15.5, 124); g.lineTo(4 + i * 15.5, 124); g.closePath(); g.fill(); }
    }
    g.fillStyle = '#202c46'; g.font = 'bold 10px Arial'; g.fillText('MARYLAND', 128, 117);
  } else if (state === 'TX') {
    const S = plateSerial.TX ??= `${rnd(L, 3)}·${rnd(D, 4)}`;
    g.fillStyle = '#e9edf1'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#1b3f8f'; g.font = 'bold 22px Arial'; g.fillText('TEXAS', 128, 24);
    g.fillStyle = '#1b2a4a'; g.font = 'bold 58px Arial'; g.fillText(S, 128, 84);
    g.fillStyle = '#b3202c'; g.font = 'bold 14px Arial'; g.fillText('THE LONE STAR STATE', 128, 114);
  } else if (state === 'FL') {
    // Florida: white plate, green "Florida" script, two oranges graphic behind a
    // black serial, county line up top, "Sunshine State" in green at the foot
    const S = plateSerial.FL ??= `${rnd(L, 3)} ${rnd(L, 1)}${rnd(D, 2)}`;
    g.fillStyle = '#fbfefb';
    g.fillRect(0, 0, 256, 128);
    // faint orange-and-green map/oranges graphic behind the serial
    g.save();
    g.globalAlpha = 0.5;
    for (const ox of [104, 140]) {
      g.fillStyle = '#f0912a'; g.beginPath(); g.arc(ox, 72, 15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3f8f36'; g.fillRect(ox - 2, 54, 4, 7);   // leaf/stem
    }
    g.restore();
    g.fillStyle = '#1f7a3d';
    g.font = 'bold italic 24px Georgia';
    g.fillText('Florida', 128, 26);
    g.fillStyle = '#151515';
    g.font = 'bold 60px Arial';
    g.fillText(S, 128, 88);
    g.fillStyle = '#1f7a3d';
    g.font = 'bold 14px Arial';
    g.fillText('SUNSHINE STATE', 128, 114);
  } else if (state === 'LIB') {
    // Libertia: light-blue field, black serial, eagle mark, state name and
    // the constitutional nickname. Serial is exactly AAA-AAAA.
    const S = plateSerial.LIB ??= `${rnd(L, 3)}-${rnd(L + D, 4)}`;
    g.fillStyle = '#9ed7f0'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#17354d'; g.lineWidth = 4; g.strokeRect(3, 3, 250, 122);
    g.fillStyle = '#111'; g.font = 'bold 21px Arial'; g.fillText('LIBERTIA', 128, 23);
    g.fillStyle = '#172b3b'; g.beginPath(); g.arc(30, 29, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#9ed7f0'; g.beginPath(); g.moveTo(19, 29); g.lineTo(7, 24); g.lineTo(18, 34); g.lineTo(30, 29); g.lineTo(42, 34); g.lineTo(53, 24); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 43px Arial'; g.fillText(S, 128, 77);
    g.font = 'bold 14px Arial'; g.fillText('THE FREE STATE', 128, 111);
  } else if (state === 'NY') {
    // New York current Excelsior plate (2020–present): white field, blue
    // serial, gold/blue accents, state scenery, and gold slogan.
    const S = plateSerial.NY ??= `${rnd(L, 3)} ${rnd(D, 4)}`;
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#aeb9c3'; g.lineWidth = 2; g.strokeRect(2, 2, 252, 124);
    g.fillStyle = '#1d477f'; g.fillRect(18, 13, 46, 5); g.fillRect(192, 13, 46, 5);
    g.fillStyle = '#d5a62a'; g.fillRect(18, 19, 46, 3); g.fillRect(192, 19, 46, 3);
    g.fillStyle = '#1b3f8f'; g.font = 'bold 21px Arial'; g.fillText('NEW YORK', 128, 27);
    g.font = 'bold 8px Arial'; g.fillText('OCT', 18, 13); g.fillText('YEAR', 238, 13);
    const scene = g.createLinearGradient(0, 88, 0, 128);
    scene.addColorStop(0, '#dcecf4'); scene.addColorStop(1, '#75a9cb');
    g.fillStyle = scene; g.fillRect(4, 88, 248, 36);
    g.fillStyle = '#6d93a6'; g.beginPath();
    g.moveTo(4, 112); g.lineTo(28, 94); g.lineTo(48, 111); g.lineTo(70, 98);
    g.lineTo(92, 113); g.lineTo(120, 101); g.lineTo(146, 114); g.lineTo(174, 96);
    g.lineTo(198, 112); g.lineTo(228, 98); g.lineTo(252, 113); g.lineTo(252, 124); g.lineTo(4, 124); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(9, 99, 30, 25);
    for (let x = 12; x < 39; x += 4) { g.strokeStyle = '#b7d9ea'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 103); g.lineTo(x, 123); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.9)';
    for (const [x, top] of [[190, 99], [197, 92], [204, 103], [211, 88], [218, 97], [225, 94], [232, 102]]) g.fillRect(x, top, 5, 124 - top);
    g.fillStyle = '#1b3f8f'; g.font = 'bold 61px Arial'; g.fillText(S, 128, 82);
    g.font = 'bold 14px Arial'; g.strokeStyle = '#1b3f8f'; g.lineWidth = 2; g.strokeText('EXCELSIOR', 128, 119);
    g.fillStyle = '#d5a62a'; g.fillText('EXCELSIOR', 128, 119);
  } else if (state === 'NC') {
    // North Carolina First in Flight plate: cool reflective field, blue
    // serial, red state name, and a restrained flight motif.
    const S = plateSerial.NC ??= `${rnd(L, 3)}·${rnd(D, 4)}`;
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#f8fbfd'); grad.addColorStop(1, '#d8e8f3');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#9aaebb'; g.lineWidth = 2; g.strokeRect(2, 2, 252, 124);
    g.fillStyle = '#b3202c'; g.font = 'bold 20px Arial'; g.fillText('NORTH CAROLINA', 128, 25);
    g.globalAlpha = 0.28; g.strokeStyle = '#1b3f8f'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(30, 65); g.quadraticCurveTo(128, 35, 226, 65); g.stroke();
    g.beginPath(); g.moveTo(76, 62); g.lineTo(94, 52); g.lineTo(128, 60); g.lineTo(162, 52); g.lineTo(180, 62); g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = '#12356f'; g.font = 'bold 58px Arial'; g.fillText(S, 128, 86);
    g.fillStyle = '#1b3f8f'; g.font = 'bold 14px Arial'; g.fillText('FIRST IN FLIGHT', 128, 114);
  } else {
    // New Jersey (your home plate) — the default across the US maps: i95, i287,
    // I-80, and New England. Pale straw fading to Garden State yellow.
    const S = plateSerial.NJ ??= `${rnd(L, 1)}${rnd(D, 2)} ${rnd(L, 3)}`;
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#fdf6d8');
    grad.addColorStop(1, '#e8c96a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#151515';
    g.font = 'bold 20px Arial';
    g.fillText('NEW JERSEY', 128, 26);
    g.font = 'bold 62px Arial';
    g.fillText(S, 128, 86);
    g.font = 'bold 15px Arial';
    g.fillText('GARDEN STATE', 128, 114);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// turn-signal lamps at the four corners; returns { left: [], right: [] }
const blinkerMat = new THREE.MeshStandardMaterial({
  color: 0x7a4a00, emissive: 0xffa817, emissiveIntensity: 0,
});
function addBlinkers(g, halfL, halfW, y) {
  const out = { left: [], right: [] };
  const geo = new THREE.BoxGeometry(0.16, 0.14, 0.1);
  for (const zEnd of [halfL, -halfL]) {
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(geo, blinkerMat.clone());
      m.position.set(side * (halfW - 0.08), y, zEnd + Math.sign(zEnd) * 0.02);
      g.add(m);
      // vehicle faces +z, so +x is the vehicle's left
      (side > 0 ? out.left : out.right).push(m);
    }
  }
  return out;
}

// front + rear plates on a vehicle; halfL = distance to bumper. Shares one
// material (passed in) so the plate state can be swapped live for both plates.
function addPlates(g, halfL, y, scale = 1, mat) {
  // Indian and European plates are the wide single-line format
  const geo = DEFAULT_PLATE === 'MH' || EU_PLATES.has(DEFAULT_PLATE)
    ? new THREE.PlaneGeometry(0.52 * scale, 0.13 * scale)
    : new THREE.PlaneGeometry(0.5 * scale, 0.25 * scale);
  const front = new THREE.Mesh(geo, mat);
  front.position.set(0, y, halfL + 0.015);
  g.add(front);
  const rear = new THREE.Mesh(geo, mat);
  rear.position.set(0, y, -halfL - 0.015);
  rear.rotation.y = Math.PI;
  g.add(rear);
}

export class Player {
  constructor(scene) {
    this.dir = DIR;            // +1 = southbound (increasing s), -1 = northbound
    this.s = 100;
    this.lat = -this.dir * (MEDIAN_HALF + 3.7 * 2.5); // lane 2
    this.v = 26;
    this.psi = 0;              // heading relative to travel direction (rad, + = left)
    this.group = new THREE.Group();
    // one plate material shared by the car + bus so setPlate() swaps both
    this.plateState = DEFAULT_PLATE;
    const plateTex = plateTexture(this.plateState);
    this.plateMat = new THREE.MeshStandardMaterial({
      map: plateTex, emissiveMap: plateTex, emissive: 0xffffff, emissiveIntensity: 0,
      roughness: 0.5, metalness: 0.1,
    });
    this.carG = makePlayerCar();
    this.carG.add(contactShadow(4.7, 1.86));
    addPlates(this.carG, 2.35, 0.5, 1, this.plateMat);
    this.carBlink = addBlinkers(this.carG, 2.36, 0.93, 0.82);
    // India-only personal vehicle: compact motorcycle/scooter with a fixed
    // brown-skinned rider. The same low-poly bike mesh is also used by NPCs.
    this.bikeG = makeBike(() => 0.23, { player: true });
    this.bikeG.add(contactShadow(1.6, 0.55));
    this.bikeBlink = addBlinkers(this.bikeG, 0.98, 0.28, 0.82);
    this.bikeG.visible = false;
    this.busG = makeMetroBus();  // Cincinnati: you drive the Metro 78
    addPlates(this.busG, 6.1, 0.62, 1.2, this.plateMat);
    this.busBlink = addBlinkers(this.busG, 6.11, 1.3, 0.9);
    // the silver Model X option (X key swaps; EV drivetrain + Tesla cluster)
    this.teslaG = makePlayerTeslaX();
    this.teslaG.add(contactShadow(5.05, 1.99));
    addPlates(this.teslaG, 2.53, 0.55, 1, this.plateMat);
    this.teslaBlink = addBlinkers(this.teslaG, 2.53, 0.98, 0.88);
    this.teslaG.visible = false;
    this.bmwG = makePlayerBmwX5();
    this.bmwG.add(contactShadow(4.78, 1.94));
    addPlates(this.bmwG, 2.43, 0.55, 1, this.plateMat);
    this.bmwBlink = addBlinkers(this.bmwG, 2.43, 0.97, 0.88);
    this.bmwG.visible = false;
    this.volvoG = makePlayerVolvoXC90();
    this.volvoG.add(contactShadow(5.15, 2.02));
    addPlates(this.volvoG, 2.59, 0.55, 1, this.plateMat);
    this.volvoBlink = addBlinkers(this.volvoG, 2.6, 1.0, 0.9);
    this.volvoG.visible = false;
    this.mercedesG = makePlayerMercedesE();
    this.mercedesG.add(contactShadow(4.9, 1.88));
    addPlates(this.mercedesG, 2.45, 0.5, 1, this.plateMat);
    this.mercedesBlink = addBlinkers(this.mercedesG, 2.46, 0.94, 0.82);
    this.mercedesG.visible = false;
    this.jettaG = makePlayerJetta();
    this.jettaG.add(contactShadow(4.9, 1.88));
    addPlates(this.jettaG, 2.4, 0.5, 1, this.plateMat);
    const stickerMat = new THREE.MeshBasicMaterial({ color: 0xf5e2a8 });
    for (const z of [2.425, -2.425]) for (const x of [-0.19, 0.19]) {
      const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.045), stickerMat);
      sticker.position.set(x, 0.57, z); if (z < 0) sticker.rotation.y = Math.PI; this.jettaG.add(sticker);
    }
    this.jettaBlink = addBlinkers(this.jettaG, 2.4, 0.94, 0.82);
    this.jettaG.visible = false;
    this.jazzG = makePlayerHondaJazz();
    this.jazzG.add(contactShadow(4.35, 1.76));
    addPlates(this.jazzG, 2.12, 0.46, 1, this.plateMat);
    this.jazzBlink = addBlinkers(this.jazzG, 2.1, 0.88, 0.82);
    this.jazzG.visible = false;
    this.lexusG = makePlayerLexusES();
    this.lexusG.add(contactShadow(4.95, 1.88));
    addPlates(this.lexusG, 2.46, 0.5, 1, this.plateMat);
    this.lexusBlink = addBlinkers(this.lexusG, 2.47, 0.94, 0.82);
    this.lexusG.visible = false;
    this.teslaMode = false;
    this.bmwMode = false;
    this.volvoMode = false;
    this.mercedesMode = false;
    this.jettaMode = false;
    this.jazzMode = false;
    this.lexusMode = false;
    this.bikeMode = false;
    this.batt = 0.82;
    this.gear = 1; this.shiftT = 0;   // the BMW's ZF 8-speed state
    this.signal = 0;       // -1 left, +1 right, 0 off (Q/E toggles)
    this.signalT = 0;
    this.deckLower = false; // GWB lower level
    this._gwbSet = false;
    this.busG.visible = false;
    this.busMode = false;
    this.group.add(this.carG, this.bikeG, this.busG, this.teslaG, this.bmwG, this.volvoG, this.mercedesG, this.jettaG, this.jazzG, this.lexusG);
    // per-vehicle taillight materials (car + bus) so the brake lights can
    // flare without touching the shared fleet material
    this.tailMats = [];
    this.tailGlows = [];
    this.headMats = [];
    this.hbFlashT = 0; this.hbOn = false;
    const tails = [];
    this.group.traverse(o => {
      if (!o.isMesh) return;
      if (o.material === taillightMat) {
        o.material = taillightMat.clone();
        this.tailMats.push(o.material);
        tails.push(o);
      } else if (o.material === headlightMat) {
        o.material = headlightMat.clone();
        this.headMats.push(o.material);
      }
    });
    for (const t of tails) {   // halo sprite per lamp (can't add mid-traverse)
      const sp = makeBrakeGlow();
      sp.position.z = -0.1;
      t.add(sp);
      this.tailGlows.push(sp);
    }
    // driver's-eye interior (cockpit cam only). Left-hand-traffic countries
    // (Britain, India) put the driver on the RIGHT.
    this.seatX = (UK || MAP === 'india' || MAP === 'nh48' || MAP === 'andheri' || MAP === 'aundh' || MAP === 'newdelhi') ? -0.4 : 0.4;
    const ck = makeCockpit(this.seatX);
    this.cockpit = ck.group;
    this.cockpit.visible = false;
    this.carG.add(this.cockpit);
    this.wheelSpin = ck.spin;
    this.bsmL = ck.bsmL; this.bsmR = ck.bsmR; this.bsmC = ck.bsmC;
    this.gaugeCtx = ck.ctx; this.gaugeTex = ck.tex;
    this.gaugeMetric = EURO || MAP === 'india' || MAP === 'nh48' || MAP === 'andheri' || MAP === 'aundh' || MAP === 'newdelhi';   // UK gauges stay mph
    this.odo = 24000 + Math.random() * 90000;
    this._steerVis = 0; this._gaugeT = 1;
    scene.add(this.group);

    // headlights: two spotlights, on at night (or manual)
    this.lightsOn = false;
    this.autoLights = true;
    this.spots = [];
    for (const x of [-0.62, 0.62]) {
      const sp = new THREE.SpotLight(0xffeecb, 0, 55, 0.46, 0.6, 1.4);
      sp.position.set(x, 0.8, 2.3);
      sp.target.position.set(x * 1.6, -1.2, 18);   // aimed down/short — low beams
      this.group.add(sp, sp.target);
      this.spots.push(sp);
    }

    this.keys = {};
    addEventListener('keydown', e => { this.keys[e.code] = true; });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    const clearDrivingKeys = () => {
      for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        this.keys[code] = false;
      }
    };
    addEventListener('blur', clearDrivingKeys);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearDrivingKeys();
    });

    this.crashTimer = 0;
  }

  update(dt, nightFactor) {
    const k = this.keys;
    const throttle = (k.KeyW || k.ArrowUp) ? 1 : 0;
    const brake = (k.KeyS || k.ArrowDown) ? 1 : 0;
    // Emergency braking wins over power. Without this, holding W while
    // reacting with S lets engine acceleration cancel most of the brake force
    // exactly when a car cuts in front of the player.
    const driveThrottle = brake ? 0 : throttle;
    const steer = ((k.KeyA || k.ArrowLeft) ? 1 : 0) - ((k.KeyD || k.ArrowRight) ? 1 : 0);

    // you always drive the car — no vehicle switch anywhere
    if (this.busMode) {
      this.busMode = false;
      this.carG.visible = true;
      this.busG.visible = false;
    }

    // longitudinal: simple power/drag model; the bus is heavy and slow.
    // Tesla mode = EV drivetrain: instant torque off the line, one-pedal
    // regen when you lift, no gearbox to breathe between.
    const EV = this.teslaMode;
    // Lift-off should feel like a real automatic car coasting, not an arcade
    // brake tap. Aero + rolling drag is deliberately gentle; the road grade
    // below can overcome it on a meaningful downhill.
    // Free-rolling coast: low rolling/aero resistance so speed holds for a
    // while on level pavement, while the grade term still slows an uphill run
    // and accelerates a downhill run.
    const drag = 0.00012 * this.v * this.v + 0.015;
    const gradeSample = 18;
    const grade = this.dir * (elevAt(this.s + gradeSample) - elevAt(this.s - gradeSample))
      / (2 * gradeSample * distanceScaleAt(this.s));
    const gravity = -9.81 * grade;
    // cruise control (U toggles via main.js): holds the set speed with a
    // gentle real-world wobble; W overrides upward, any brake tap cancels
    if (this.cruiseV && brake) this.cruiseV = 0;
    let acc;
    if (this.busMode) {
      acc = driveThrottle * (4.2 - this.v * 0.13) - brake * 8.4 - drag + gravity;
    } else if (this.bikeMode) {
      acc = driveThrottle * (7.8 - this.v * 0.06) - brake * 11.5 - drag + gravity;
    } else if (EV) {
      // Lift-off is a coast, not an automatic brake application. Explicit
      // braking still uses the EV's stronger brake response.
      acc = driveThrottle * (9.2 - this.v * 0.05) - brake * 11.0 - drag + gravity;
    } else {
      // BMW 3 Series: ZF 8-speed auto — stepped gears with a brief torque cut
      // on every shift, downshifts on the way back down
      const SHIFTS = [7, 12, 17, 23, 29, 35, 41];   // m/s upshift points, gears 1→8
      if (this.gear < 8 && this.v > SHIFTS[this.gear - 1]) { this.gear++; this.shiftT = 0.22; }
      else if (this.gear > 1 && this.v < SHIFTS[this.gear - 2] - 1.5) { this.gear--; this.shiftT = 0.14; }
      this.shiftT = Math.max(0, this.shiftT - dt);
      const cut = this.shiftT > 0 ? 0.15 : 1;
      acc = driveThrottle * (8.4 - this.v * 0.075) * cut - brake * 10.2 - drag + gravity;
    }
    // A released accelerator is a light maintenance coast, not an abrupt
    // throttle cut. Offset most level-road drag so the car gently holds speed;
    // gravity remains untouched, allowing uphill loss and downhill gain.
    if (!throttle && !brake && !this.cruiseV && !this.busMode && this.v > 1) {
      acc += Math.min(drag * 0.82, 0.12);
    }
    if (this.crashTimer > 0) this.crashTimer -= dt;
    if (this.cruiseV && !throttle) {
      acc = THREE.MathUtils.clamp((this.cruiseV - this.v) * 0.6, -1.5, 1.6);
    }
    // snowpack (main feeds this.grip): wheelspin on power, slide on brakes
    const grip = this.grip ?? 1;
    acc *= grip;
    this.v = Math.max(0, this.v + acc * dt);
    if (this.bikeMode) this.v = Math.min(this.v, 30);

    // steering: speed-sensitive yaw rate, self-centering
    const steerAuthority = (this.busMode ? 1.1 : 1.6) * (0.5 + 0.5 * grip) / (1 + this.v * 0.06);
    this.psi += steer * steerAuthority * dt * (this.v > 0.5 ? 1 : 0);
    // low grip at speed: the car hunts a little and needs correcting
    if (grip < 0.85 && this.v > 12) {
      this._slipT = (this._slipT || 0) + dt;
      this.psi += (1 - grip) * 0.045 * Math.sin(this._slipT * 0.8) * dt * Math.min(1, this.v / 22);
    }
    this.psi -= this.psi * Math.min(1, dt * (0.4 + this.v * 0.02)); // stability
    this.psi = THREE.MathUtils.clamp(this.psi, -0.6, 0.6);

    // integrate in road coordinates (dir = -1 drives against increasing s)
    this.s = wrapS(this.s + this.dir * Math.cos(this.psi) * this.v * dt / distanceScaleAt(this.s));
    this.lat += this.dir * Math.sin(this.psi) * this.v * dt;

    // road edges: median barrier + outer guardrail. Bounds mirror in Mumbai
    // (left-hand traffic) and flip with travel direction.
    const sf = sideFactorAt(this.s, this.dir);
    const sign = -this.dir * (Math.sign(sf) || 1);
    const eOuter = sign * (pavedHalfAt(this.s) - 1.2);
    const eInner = sign * (medianHalfAt(this.s) - 2.4);
    const lo = Math.min(eOuter, eInner), hi = Math.max(eOuter, eInner);
    if (this.lat < lo) { this.lat = lo; this.psi *= -0.3; this.v *= 0.985; }
    if (this.lat > hi) { this.lat = hi; this.psi *= -0.3; this.v *= 0.985; }

    // NJ dual-dual / GSP local-express divider is a physical barrier — pick
    // your roadway at the split
    const gap = njGapAt(this.s);
    if (gap > 1.8) {
      const center = sign * (medianHalfAt(this.s) + 3 * 3.7 + gap / 2);
      const halfW = gap / 2 - 0.9;
      const d = this.lat - center;
      if (Math.abs(d) < halfW) {
        this.lat = center + Math.sign(d || 1) * halfW;
        this.psi *= -0.3;
        this.v *= 0.99;
      }
    }

    // NJ Turnpike E/W spur fork: two separate two-way highways. Ride a crossing
    // flyover if you're on one; otherwise the void between the spurs is off-limits.
    this.spurRise = 0;
    const spurT = spurTAt(this.s);
    if (spurT > 0.02) {
      const cHi = latForLane(1, 4, this.s);    // +s lanes 3-5: top flyover deck
      const cLo = latForLane(-1, 1, this.s);   // -s lanes 0-2: lower flyover deck
      const rHi = spurRiseAt(this.s, 1, 4), rLo = spurRiseAt(this.s, -1, 1);
      if (rHi > 0.05 && Math.abs(this.lat - cHi) < 7.5) this.spurRise = rHi;
      else if (rLo > 0.05 && Math.abs(this.lat - cLo) < 7.5) this.spurRise = rLo;
      else if (spurT > 0.55) {
        const voidHalf = spurT * (SPUR.g - SPUR.m - 3 * 3.7 - 2.7) - 0.9;
        if (Math.abs(this.lat) < voidHalf) {
          this.lat = Math.sign(this.lat || 1) * voidHalf;
          this.psi *= -0.3;
          this.v *= 0.99;
        }
      }
    }

    // GWB double deck: right lanes at the approach take the lower level
    if (MAP === 'i95') {
      const nearGwb = this.s > 43400 && this.s < 44600;
      if (nearGwb && !this._gwbSet) {
        const lanePos = (Math.abs(this.lat) - medianHalfAt(this.s)) / laneWidthAt(this.s);
        this.deckLower = lanePos > 2;
        this._gwbSet = true;
      } else if (!nearGwb) {
        this._gwbSet = false;
        this.deckLower = false;
      }
    }

    // place
    posAt(this.s, this.lat, this.group.position);
    if (this.deckLower) this.group.position.y -= gwbLowerDrop(this.s);
    this.group.position.y += this.spurRise || 0;
    this.group.rotation.y = headingAt(this.s) + (this.dir > 0 ? 0 : Math.PI) + this.psi;

    // wheels roll at road speed
    const activeG = this.teslaMode ? this.teslaG
      : this.bmwMode ? this.bmwG
      : this.volvoMode ? this.volvoG
      : this.mercedesMode ? this.mercedesG
      : this.jettaMode ? this.jettaG
      : this.jazzMode ? this.jazzG
      : this.lexusMode ? this.lexusG : this.bikeMode ? this.bikeG : this.carG;
    for (const w of activeG.userData.wheels) w.rotation.x += (this.v / w.userData.r) * dt;

    // turn signals: Q = left, E = right; same key again cancels; auto-cancel 12 s
    if (k.KeyQ && !this._qHeld) { this.signal = this.signal === -1 ? 0 : -1; this.signalT = 0; }
    if (k.KeyE && !this._eHeld) { this.signal = this.signal === 1 ? 0 : 1; this.signalT = 0; }
    this._qHeld = !!k.KeyQ;
    this._eHeld = !!k.KeyE;
    if (this.signal !== 0) {
      this.signalT += dt;
      if (this.signalT > 12) this.signal = 0;
    }
    const blinkOn = this.signal !== 0 && (this.signalT % 0.8) < 0.4;
    for (const set of [this.carBlink, this.bikeBlink, this.busBlink, this.teslaBlink, this.bmwBlink, this.volvoBlink, this.mercedesBlink, this.jettaBlink, this.jazzBlink, this.lexusBlink]) {
      for (const m of set.left) m.material.emissiveIntensity = (this.signal === -1 && blinkOn) ? 3.2 : 0;
      for (const m of set.right) m.material.emissiveIntensity = (this.signal === 1 && blinkOn) ? 3.2 : 0;
    }

    // Brake lights flare over the shared fleet material's dusk base only when
    // the driver presses the brake. Lift-off remains a coast, including in EV
    // mode, so releasing W cannot make the rear lamps glow.
    const brakingVis = !!brake;
    const tlBase = taillightMat.emissiveIntensity;
    // Personal-car tail lamps are dark in daylight unless braking. At night
    // they carry the same low running-light glow as ordinary traffic cars.
    const runningTail = nightFactor > 0.12 ? tlBase : 0;
    const flare = 4.5 + nightFactor * 7;   // hot enough to hit bloom at night
    for (const m of this.tailMats) m.emissiveIntensity = brakingVis ? runningTail + flare : runningTail;
    const gs = 0.8 + nightFactor * 1.1;    // halo sprites: bigger after dark
    for (const sp of this.tailGlows) {
      sp.visible = brakingVis;
      if (brakingVis) sp.scale.set(gs, gs, 1);
    }
    // Model X light bar: subtle glow, modest brake lift
    this.teslaG.userData.barMat.emissiveIntensity = brakingVis
      ? runningTail + flare * 0.35
      : runningTail * 0.5;

    // cockpit dressing: wheel turns with steering, gauges refresh ~8 Hz
    this.odo += (this.v * dt) / (this.gaugeMetric ? 1000 : 1609);
    if (this.teslaMode) this.batt = Math.max(0.05, this.batt - this.v * dt / 560000);
    if (this.cockpit.visible) {
      this._steerVis += (steer * 2.0 - this._steerVis) * Math.min(1, dt * 6);
      this.wheelSpin.rotation.z = this._steerVis;
      this._gaugeT += dt;
      if (this._gaugeT > 0.12) { this._gaugeT = 0; this.drawGauges(); }
    }

    // headlights
    if (k.KeyL && !this._lHeld) { this.lightsOn = !this.lightsOn; this.autoLights = false; }
    this._lHeld = !!k.KeyL;
    const on = this.autoLights ? nightFactor > 0.25 : this.lightsOn;

    // high beams (Y): tap = flash-to-pass double pulse, hold = beams stay on.
    // NPCs ahead read this.hbOn and (usually) get out of the left lane.
    if (k.KeyY && !this._yHeld) this.hbFlashT = 0.75;
    this._yHeld = !!k.KeyY;
    if (this.hbFlashT > 0) this.hbFlashT -= dt;
    const hbOn = !!k.KeyY || (this.hbFlashT > 0 && (this.hbFlashT % 0.375) > 0.165);
    this.hbOn = hbOn;
    for (const sp of this.spots) sp.intensity = hbOn ? 320 : (on ? 105 : 0);
    const hlBase = headlightMat.emissiveIntensity;
    for (const m of this.headMats) m.emissiveIntensity = hbOn ? hlBase + 6 : hlBase;
    // your own plate catches its lamp after dark too
    this.plateMat.emissiveIntensity = nightFactor * 0.45;
  }

  // swap the license plate live (NJ / NY / OH on US maps)
  setPlate(state) {
    this.plateState = state;
    const tex = plateTexture(state);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.plateMat.map = tex;
    this.plateMat.emissiveMap = tex;
    this.plateMat.needsUpdate = true;
  }

  teleport(s) {
    this.s = wrapS(s);
    const sf = Math.sign(sideFactorAt(this.s, this.dir)) || 1;
    // lane 2 where the road is wide, outer lane on narrow streets (Cincinnati)
    const off = Math.min(medianHalfAt(this.s) + 3.7 * 2.5, pavedHalfAt(this.s) - 2.2);
    this.lat = -this.dir * sf * off;
    this.psi = 0;
    this.v = Math.max(this.v, 26);
    posAt(this.s, this.lat, this.group.position);
    this.group.rotation.y = headingAt(this.s) + (this.dir > 0 ? 0 : Math.PI);
  }

  // contact: just scrub a little speed — no freeze, no red screen
  crash() {
    if (this.crashTimer <= 0) {
      this.crashTimer = 0.5;
      this.v *= 0.9;
    }
  }

  get mph() { return this.v / MPH; }

  // blind-spot monitor lamps, driven by traffic each frame
  setBlindSpot(l, r) {
    this.bsmL.emissiveIntensity = l ? 3.2 : 0;
    this.bsmR.emissiveIntensity = r ? 3.2 : 0;
    this.bsmC.emissiveIntensity = (l || r) ? 3.2 : 0;   // rearview tell-tale
  }

  // swap between the personal vehicles
  setVehicle(which) {
    this.bikeMode = which === 'bike';
    this.teslaMode = which === 'tesla';
    this.bmwMode = which === 'bmw';
    this.volvoMode = which === 'volvo';
    this.mercedesMode = which === 'mercedes';
    this.jettaMode = which === 'jetta';
    this.jazzMode = which === 'jazz';
    this.lexusMode = which === 'lexus';
    this.carG.visible = !this.bikeMode && !this.teslaMode && !this.bmwMode && !this.volvoMode && !this.mercedesMode && !this.jettaMode && !this.jazzMode && !this.lexusMode;
    this.bikeG.visible = this.bikeMode;
    this.bmwG.visible = this.bmwMode;
    this.volvoG.visible = this.volvoMode;
    this.teslaG.visible = this.teslaMode;
    this.mercedesG.visible = this.mercedesMode;
    this.jettaG.visible = this.jettaMode;
    this.jazzG.visible = this.jazzMode;
    this.lexusG.visible = this.lexusMode;
    const active = this.bikeMode ? this.bikeG : this.teslaMode ? this.teslaG : this.bmwMode ? this.bmwG : this.volvoMode ? this.volvoG
      : this.mercedesMode ? this.mercedesG : this.jettaMode ? this.jettaG
      : this.jazzMode ? this.jazzG : this.lexusMode ? this.lexusG : this.carG;
    this.cockpit.visible = false;
    if (!this.bikeMode) active.add(this.cockpit);
    return this.teslaMode;
  }

  toggleCruise() {
    this.cruiseV = this.cruiseV ? 0 : Math.max(this.v, 9);
    return this.cruiseV;
  }

  // Gauge cluster: analog speedo dial + digital speed, odometer, gear
  drawGauges() {
    const g = this.gaugeCtx, W = 512, H = 224;
    const kmh = this.gaugeMetric;
    const v = kmh ? this.v * 3.6 : this.mph;
    const max = kmh ? 240 : 120;
    if (this.teslaMode) {
      // Tesla cluster: minimalist — big digital speed, battery + range, PRND
      g.fillStyle = '#0b0d10'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#23262c'; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
      g.fillStyle = '#eef1f5'; g.textAlign = 'center';
      g.font = '600 96px "Helvetica Neue", Arial, sans-serif';
      g.fillText(String(Math.round(v)), 168, 124);
      g.font = '600 24px "Helvetica Neue", Arial, sans-serif';
      g.fillStyle = '#8f97a3'; g.fillText(kmh ? 'km/h' : 'mph', 168, 158);
      g.strokeStyle = '#3a404a'; g.lineWidth = 3; g.strokeRect(300, 66, 172, 26);
      g.fillStyle = this.batt > 0.2 ? '#3fbf62' : '#e0a92f';
      g.fillRect(303, 69, 166 * this.batt, 20);
      g.fillStyle = '#c7cdd6'; g.font = '600 24px "Helvetica Neue", Arial, sans-serif';
      g.fillText(Math.round(this.batt * (kmh ? 540 : 335)) + (kmh ? ' km' : ' mi'), 386, 128);
      ['P', 'R', 'N', 'D'].forEach((ch, i) => {
        g.fillStyle = ch === 'D' ? '#ffffff' : '#565c66';
        g.font = 'bold 26px "Helvetica Neue", Arial, sans-serif';
        g.fillText(ch, 318 + i * 46, 196);
      });
      this.gaugeTex.needsUpdate = true;
      return;
    }
    g.fillStyle = '#0d0f12'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#2a2e35'; g.lineWidth = 4; g.strokeRect(4, 4, W - 8, H - 8);
    const cx = 120, cy = 118, R = 86;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.strokeStyle = '#454b54'; g.lineWidth = 3;
    g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    g.textAlign = 'center'; g.font = 'bold 15px Arial';
    const stp = kmh ? 40 : 20;
    for (let s = 0; s <= max; s += stp) {
      const a = a0 + (s / max) * (a1 - a0);
      const c = Math.cos(a), sn = Math.sin(a);
      g.strokeStyle = '#8a919c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx + c * (R - 8), cy + sn * (R - 8)); g.lineTo(cx + c * R, cy + sn * R); g.stroke();
      g.fillStyle = '#c9ced6';
      g.fillText(String(s), cx + c * (R - 24), cy + sn * (R - 24) + 5);
    }
    const av = a0 + Math.min(1, v / max) * (a1 - a0);
    g.strokeStyle = '#e03a2f'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx - Math.cos(av) * 12, cy - Math.sin(av) * 12);
    g.lineTo(cx + Math.cos(av) * (R - 16), cy + Math.sin(av) * (R - 16)); g.stroke();
    g.fillStyle = '#22262c'; g.beginPath(); g.arc(cx, cy, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8ecf2'; g.font = 'bold 68px Arial'; g.textAlign = 'center';
    g.fillText(String(Math.round(v)), 350, 108);
    g.font = '600 20px Arial'; g.fillStyle = '#9aa2ad';
    g.fillText(kmh ? 'km/h' : 'mph', 350, 136);
    g.font = 'bold 26px "Courier New", monospace'; g.fillStyle = '#cfd6df'; g.textAlign = 'right';
    g.fillText(this.odo.toFixed(1).padStart(9, '0') + (kmh ? ' km' : ' mi'), 484, 190);
    g.fillStyle = '#7fd08a'; g.font = 'bold 26px Arial'; g.textAlign = 'left';
    g.fillText('D' + (this.gear || 1), 236, 190);   // ZF 8-speed gear readout
    this.gaugeTex.needsUpdate = true;
  }
}

// Camera modes cycled by KeyC. hood:true is the special first-person shot;
// the rest are smoothed follow cams described by pull-back dist/height, how
// far ahead they aim (look/lookY), and a FOV offset for cinematic width.
const CAM_MODES = [
  { name: 'chase',  dist: 9.5, height: 3.4, look: 12, lookY: 1.6, fov: 0 },
  { name: 'close',  dist: 5.5, height: 2.3, look: 10, lookY: 1.5, fov: 0 },
  // A higher close chase view: straight behind the car, with enough elevation
  // to keep the lead car visible over the Volvo's roofline.
  { name: 'angled', dist: 6.8, height: 4.8, look: 15, lookY: 1.7, fov: 2 },
  { name: 'cockpit', cockpit: true, fov: 6 },
  { name: 'hood',   hood: true },
  { name: 'far',    dist: 22,  height: 8,   look: 12, lookY: 1.6, fov: 0 },
  { name: 'cruise', dist: 15,  height: 2.4, look: 30, lookY: 1.4, fov: 8 },
];

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.mode = 0; // index into CAM_MODES
    this.rearView = false;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this._init = false;
  }

  toggle() { this.mode = (this.mode + 1) % CAM_MODES.length; }

  setRearView(active) {
    this.rearView = active;
    // Re-entering the normal camera should not inherit the smoothed rear
    // cockpit position from the temporary hold.
    if (!active) {
      this._ckPos = null;
      this._ckLook = null;
      this._init = false;
    }
  }

  get modeName() { return CAM_MODES[this.mode].name; }

  update(dt, player) {
    const m = this.rearView ? { name: 'rear view', cockpit: true, fov: 0 } : CAM_MODES[this.mode];
    // racing-game speed feel: the view widens as you wind it up
    const targetFov = 62 + (m.fov || 0) + Math.min(14, Math.max(0, player.v - 24) * 0.4);
    this.fov = this.fov === undefined ? targetFov
      : this.fov + (targetFov - this.fov) * Math.min(1, dt * 2.5);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // --- cockpit: driver's eyes. Cursor zones swap the view — slightly up =
    // rear cam, right edge = right mirror, left edge = left mirror; the
    // default view sits behind the wheel with the cluster in frame, and the
    // cursor sways the head a little inside the deadzone.
    if (m.cockpit) {
      if (!this._ptr) {
        this._ptr = { x: 0, y: 0 };
        addEventListener('pointermove', e => {
          this._ptr.x = (e.clientX / innerWidth) * 2 - 1;
          this._ptr.y = (e.clientY / innerHeight) * 2 - 1;
        });
      }
      const ref = player.busMode ? player.busG : player.carG;
      ref.updateWorldMatrix(true, false);
      const seatX = player.seatX ?? 0.4;
      const px = this._ptr.x, py = this._ptr.y;
      let posL, lookL;
      if (this.rearView || py < -0.35) {      // hold P/button or glance up → rear view
        posL = new THREE.Vector3(0, 1.22, -0.4);
        lookL = new THREE.Vector3(0, 1.0, -40);
      } else if (px > 0.45) {                 // right mirror (right = −x local)
        posL = new THREE.Vector3(-0.98, 1.03, 0.62);
        lookL = new THREE.Vector3(-2.1, 0.97, -30);
      } else if (px < -0.45) {                // left mirror
        posL = new THREE.Vector3(0.98, 1.03, 0.62);
        lookL = new THREE.Vector3(2.1, 0.97, -30);
      } else {                                // behind the wheel, eye high enough to read the road
        posL = new THREE.Vector3(seatX, 1.32, 0.12);
        lookL = new THREE.Vector3(seatX - px * 2.4, 1.05 - py * 1.0, 8);
      }
      if (player.teslaMode) { posL.y += 0.14; lookL.y += 0.14; }   // SUV seat height
      if (player.busMode) { posL.y += 0.9; posL.z += 2.0; lookL.y += 0.9; lookL.z += 2.0; }
      // smooth the view IN CAR-LOCAL SPACE, then rigid-attach to the car —
      // a world-space lerp trails behind the seat at speed
      if (!this._ckPos) { this._ckPos = posL.clone(); this._ckLook = lookL.clone(); }
      const k = 1 - Math.exp(-dt * 11);
      this._ckPos.lerp(posL, k); this._ckLook.lerp(lookL, k);
      const wp = this._ckPos.clone().applyMatrix4(ref.matrixWorld);
      const wl = this._ckLook.clone().applyMatrix4(ref.matrixWorld);
      this.pos.copy(wp); this.look.copy(wl); this._init = true;
      if (this.camera.near !== 0.06) { this.camera.near = 0.06; this.camera.updateProjectionMatrix(); }
      this.camera.up.set(0, 1, 0);
      this.camera.position.copy(wp);
      this.camera.lookAt(wl);
      if (!player.cockpit.visible) player.cockpit.visible = true;
      return;
    }
    if (player.cockpit && player.cockpit.visible) player.cockpit.visible = false;
    if (this.camera.near !== 0.3) { this.camera.near = 0.3; this.camera.updateProjectionMatrix(); }

    const yaw = player.group.rotation.y;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const base = player.group.position;

    let targetPos, targetLook;
    if (m.hood) {
      targetPos = base.clone().addScaledVector(fwd, 0.4).add(new THREE.Vector3(0, 1.25, 0));
      targetLook = base.clone().addScaledVector(fwd, 40).add(new THREE.Vector3(0, 1, 0));
      this.camera.position.copy(targetPos);
      this.camera.lookAt(targetLook);
      return;
    }
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    // The XC90's taller greenhouse blocks the close chase sightline; lift and
    // slightly raise the aim only for that vehicle and camera mode.
    const vehicleCamera = player.volvoMode && m.name === 'close'
      ? { height: m.height + 0.85, lookY: m.lookY + 0.35 }
      : m;
    targetPos = base.clone().addScaledVector(fwd, -m.dist)
      .addScaledVector(right, m.side || 0)
      .add(new THREE.Vector3(0, vehicleCamera.height, 0));
    targetLook = base.clone().addScaledVector(fwd, m.look).add(new THREE.Vector3(0, vehicleCamera.lookY, 0));

    if (!this._init) { this.pos.copy(targetPos); this.look.copy(targetLook); this._init = true; }
    const kp = 1 - Math.exp(-dt * 4.5);
    const kl = 1 - Math.exp(-dt * 8);
    this.pos.lerp(targetPos, kp);
    this.look.lerp(targetLook, kl);

    // body roll into corners, applied by tilting the camera's up vector
    // before lookAt (keeps the view matrix well-formed). No shake — smooth.
    const rollT = THREE.MathUtils.clamp(-player.psi * 0.3 * Math.min(1, player.v / 25), -0.05, 0.05);
    if (this._roll === undefined) this._roll = 0;
    this._roll += (rollT - this._roll) * Math.min(1, dt * 5);
    const roll = this._roll;
    this.camera.position.copy(this.pos);
    // up = world-up rolled about the (horizontal) view direction
    const vx = this.look.x - this.pos.x, vz = this.look.z - this.pos.z;
    const vl = Math.hypot(vx, vz) || 1;
    this.camera.up.set(
      Math.sin(roll) * (vz / vl),
      Math.cos(roll),
      -Math.sin(roll) * (vx / vl),
    );
    this.camera.lookAt(this.look);
  }
}
