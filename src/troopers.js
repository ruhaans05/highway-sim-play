import * as THREE from 'three';
import { MAP, wrapS, loopDelta, SPAWN_RADIUS } from './config.js';
import { posAt, headingAt, pavedHalfAt, latForLane } from './road.js';

// State police cruisers: rare. They either sit clocking traffic on the shoulder
// or come zooming past in a travel lane, sometimes with the light bar going.
// They never pull anyone over. US maps only; the door decal shows the state.
const US = MAP === 'i95' || MAP === 'i287' || MAP === 'midwest' || MAP === 'newengland' || MAP === 'i80' || MAP === 'gsp' || MAP === 'bay';

function stateFor(s) {
  if (MAP === 'i287') return s < 72000 ? 'NEW JERSEY' : 'NEW YORK';
  if (MAP === 'gsp') return 'NEW JERSEY';
  if (MAP === 'bay') return 'CALIFORNIA';
  if (MAP === 'i95') {
    // Boston/Providence/New London loop-back, shifted +1907600 past the DE→FL run
    if (s >= 2003600) return s < 2012600 ? 'MASSACHUSETTS' : s < 2025600 ? 'RHODE ISLAND' : 'CONNECTICUT';
    if (s >= 96000) {
      if (s < 133700) return 'DELAWARE';
      if (s < 309100) return 'MARYLAND';
      if (s < 596700) return 'VIRGINIA';
      if (s < 888500) return 'NORTH CAROLINA';
      if (s < 1208400) return 'SOUTH CAROLINA';
      if (s < 1388700) return 'GEORGIA';
      return 'FLORIDA';
    }
    return s < 31500 ? 'CONNECTICUT' : s < 44000 ? 'NEW YORK'
      : s < 77000 ? 'NEW JERSEY' : 'PENNSYLVANIA';
  }
  if (MAP === 'newengland') return s < 34000 ? 'CONNECTICUT' : 'MASSACHUSETTS';
  if (MAP === 'i80') {
    return s < 40000 ? 'NEW JERSEY' : s < 150000 ? 'PENNSYLVANIA'
      : s < 204000 ? 'OHIO' : 'INDIANA';
  }
  return s < 46000 ? 'ILLINOIS' : s < 123000 ? 'INDIANA' : 'OHIO'; // midwest
}

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

function makeCruiser() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x161d2b, roughness: 0.45, metalness: 0.25 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.5 });
  const lower = box(1.95, 0.82, 4.9, bodyMat); lower.position.y = 0.7; g.add(lower);
  const band = box(1.97, 0.42, 3.0, whiteMat); band.position.y = 0.7; g.add(band);
  const cabin = box(1.78, 0.72, 2.3, bodyMat); cabin.position.set(0, 1.34, -0.05); g.add(cabin);
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c1622, roughness: 0.2, metalness: 0.5 });
  const wind = box(1.72, 0.5, 2.0, glass); wind.position.set(0, 1.42, -0.05); g.add(wind);
  // light bar
  const barR = new THREE.MeshStandardMaterial({ color: 0x330008, emissive: 0xff0018, emissiveIntensity: 0 });
  const barB = new THREE.MeshStandardMaterial({ color: 0x000833, emissive: 0x1848ff, emissiveIntensity: 0 });
  const lr = box(0.52, 0.16, 0.36, barR); lr.position.set(-0.3, 1.78, -0.05); g.add(lr);
  const lb = box(0.52, 0.16, 0.36, barB); lb.position.set(0.3, 1.78, -0.05); g.add(lb);
  // wheels
  const wm = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), wm);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w);
  }
  // door decal (redrawn per activation with the current state)
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const plateMat = new THREE.MeshStandardMaterial({ map: tex, transparent: true });
  const pl1 = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.86), plateMat);
  pl1.position.set(0.99, 0.72, 0.1); pl1.rotation.y = Math.PI / 2; g.add(pl1);
  const pl2 = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.86), plateMat);
  pl2.position.set(-0.99, 0.72, 0.1); pl2.rotation.y = -Math.PI / 2; g.add(pl2);
  return { group: g, barR, barB, cv, tex };
}

function drawPlate(u, state) {
  const g = u.cv.getContext('2d');
  g.clearRect(0, 0, 256, 96);
  g.fillStyle = '#0b2a5e'; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#e9c94a'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 84);
  g.fillStyle = '#ffffff'; g.textAlign = 'center';
  g.font = 'bold 30px "Helvetica Neue", Arial, sans-serif'; g.fillText('STATE POLICE', 128, 40);
  g.font = 'bold 26px "Helvetica Neue", Arial, sans-serif'; g.fillText(state, 128, 74);
  u.tex.needsUpdate = true;
}

export class Troopers {
  constructor(scene, count = 3) {
    this.units = [];
    if (!US) return;
    this.scene = scene;
    for (let i = 0; i < count; i++) {
      const c = makeCruiser();
      c.group.visible = false;
      scene.add(c.group);
      this.units.push({
        ...c, active: false, mode: 'parked', s: 0, lat: 0, dir: 1, v: 0,
        lightsOn: false, cool: Math.random() * 30,
      });
    }
  }

  activate(u, player) {
    const sign = Math.random() < 0.5 ? 1 : -1;
    u.dir = Math.random() < 0.5 ? 1 : -1;
    u.s = wrapS(player.s + sign * (320 + Math.random() * SPAWN_RADIUS * 0.5));
    u.mode = Math.random() < 0.6 ? 'parked' : 'patrol';
    if (u.mode === 'parked') {
      u.v = 0;
      u.lightsOn = Math.random() < 0.12;            // usually just clocking traffic
    } else {
      u.v = 30 + Math.random() * 16;                // zooming past
      u.lightsOn = Math.random() < 0.4;             // sometimes running code
    }
    drawPlate(u, stateFor(u.s));
    u.active = true;
    u.group.visible = true;
  }

  update(dt, player, simTime, onCrash) {
    for (const u of this.units) {
      if (!u.active) {
        u.cool -= dt;
        if (u.cool <= 0 && Math.random() < dt * 0.035) this.activate(u, player);
        continue;
      }
      if (u.mode === 'patrol') u.s = wrapS(u.s + u.dir * u.v * dt);

      if (Math.abs(loopDelta(player.s, u.s)) > SPAWN_RADIUS) {
        u.active = false;
        u.group.visible = false;
        u.cool = 15 + Math.random() * 40;
        continue;
      }

      const lat = u.mode === 'parked'
        ? -u.dir * (pavedHalfAt(u.s) - 1.4)          // outer shoulder
        : latForLane(u.dir, 1, u.s);                 // an inner lane, moving
      u.lat = lat;
      posAt(u.s, lat, u.group.position);
      u.group.rotation.y = headingAt(u.s) + (u.dir > 0 ? 0 : Math.PI);

      // light bar: alternating red/blue strobe when running
      if (u.lightsOn) {
        const ph = (simTime * 6) % 1;
        u.barR.emissiveIntensity = ph < 0.5 ? 7 : 0.15;
        u.barB.emissiveIntensity = ph < 0.5 ? 0.15 : 7;
      } else {
        u.barR.emissiveIntensity = 0;
        u.barB.emissiveIntensity = 0;
      }

      if (onCrash && Math.abs(loopDelta(player.s, u.s)) < 3.2
          && Math.abs(player.lat - lat) < 1.5 && player.v > 2) {
        onCrash(u);
      }
    }
  }
}
