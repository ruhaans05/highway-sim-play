import * as THREE from 'three';
import { EXITS, LOOP_LENGTH, zoneAt } from './config.js';
import { posAt, headingAt, pavedHalfAt } from './road.js';
import { groundY, buildTrees, placementsAlong, scatterInstanced, facadeTexture } from './environment.js';
import { textBoard } from './turnpike.js';
import { makeParkedCar } from './vehicles.js';
import { SIGNALS, signalState } from './mumbai.js';

const TAU = Math.PI * 2;
function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

function box(scene, mat, s, lat, sx, sy, sz, y = 0) {
  const p = posAt(s, lat, new THREE.Vector3());
  p.y = groundY(s, lat) + y;
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.copy(p); m.rotation.y = headingAt(s); scene.add(m); return m;
}

function roadsideSign(scene, registry, s, lat, lines, bg = '#174a86') {
  const sign = textBoard(lines, 8.5, 2.6, bg, '#fff');
  sign.position.copy(posAt(s, lat, new THREE.Vector3()));
  sign.position.y = groundY(s, lat) + 5.4;
  sign.rotation.y = headingAt(s) + (lat < 0 ? 0 : Math.PI);
  scene.add(sign); registry.signs.push({ userData: { board: sign } });
}

function home(scene, s, lat, rand) {
  const body = new THREE.MeshStandardMaterial({ color: [0xd5c7b0, 0xb9c9d0, 0xd9d8d2, 0xa88770][(rand() * 4) | 0], roughness: 0.9 });
  const roof = new THREE.MeshStandardMaterial({ color: [0x3f454b, 0x5b4036, 0x7c6c54][(rand() * 3) | 0], roughness: 1 });
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(12 + rand() * 5, 5 + rand() * 2, 9 + rand() * 4), body);
  b.position.y = 2.5; g.add(b);
  const r = new THREE.Mesh(new THREE.ConeGeometry(8 + rand() * 2, 3.2, 4), roof);
  r.rotation.y = Math.PI / 4; r.position.y = 6.4; g.add(r);
  const porch = new THREE.Mesh(new THREE.BoxGeometry(4, 0.35, 2), new THREE.MeshStandardMaterial({ color: 0xeee8dc }));
  porch.position.set(0, 0.25, 5.2); g.add(porch);
  g.position.copy(posAt(s, lat, new THREE.Vector3())); g.position.y = groundY(s, lat); g.rotation.y = headingAt(s) + (rand() - 0.5) * 0.4;
  scene.add(g);
}

function crossStreet(scene, s) {
  const p = posAt(s, 0, new THREE.Vector3()); p.y = groundY(s, 0) + 0.03;
  const road = new THREE.Mesh(new THREE.BoxGeometry(110, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0x303336, roughness: 0.95 }));
  road.position.copy(p); road.rotation.y = headingAt(s) + Math.PI / 2; scene.add(road);
  for (const lat of [-pavedHalfAt(s) - 6, pavedHalfAt(s) + 6]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.025, 0.18), new THREE.MeshBasicMaterial({ color: 0xf2f2e8 }));
    line.position.copy(posAt(s, lat, new THREE.Vector3())); line.position.y = groundY(s, lat) + 0.08;
    line.rotation.y = headingAt(s) + Math.PI / 2; scene.add(line);
  }
}

export function buildChester(scene, registry) {
  const rand = rng(7431);
  const green = new THREE.MeshStandardMaterial({ color: 0x38643b, roughness: 1 });
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x34383b, roughness: 0.95 });
  const brick = new THREE.MeshStandardMaterial({ color: 0x8d4e3c, roughness: 0.9 });
  const retail = new THREE.MeshStandardMaterial({ map: facadeTexture(38), color: 0xffffff, roughness: 0.8 });

  // Continuous wooded setbacks prevent the arterial from reading as a flat prop
  // strip; buildings sit behind the trees, with occasional real open fields.
  buildTrees(scene, 7432, 0, LOOP_LENGTH, 34, pavedHalfAt(0) + 13, 78, 3, false, 1.15);
  buildTrees(scene, 7433, 0, LOOP_LENGTH, 46, pavedHalfAt(0) + 80, 190, 3, false, 1.35);
  const homes = placementsAlong(7440, 0, LOOP_LENGTH, 170, 105, 235, (r, pos, s, lat) => ({ pos, s, lat, r }));
  homes.forEach(h => home(scene, h.s, h.lat, h.r));

  // School campus, bus loop, athletic fields, and a recognizable red-brick sign.
  box(scene, brick, 15100, 165, 58, 8, 28, 0);
  box(scene, green, 15100, 215, 100, 0.05, 54, 0);
  box(scene, asphalt, 15100, 265, 70, 0.06, 12, 0);
  roadsideSign(scene, registry, 15100, 105, ['PENNCREST', 'SCHOOL DISTRICT'], '#7b2d2d');
  roadsideSign(scene, registry, 16600, -105, ['SCHOOL ZONE', '25 MPH'], '#c51e2a');

  // Retail nodes: supermarket, drive-through pads, and a set-back mall parking
  // field. These are deliberately clustered at signalized intersections.
  for (const [s, name, color] of [[9300, 'GIANT FOOD', '#245b36'], [10800, 'CONCORDVILLE SHOPPING', '#174a86'], [12500, 'TARGET · RETAIL', '#c51e2a']]) {
    box(scene, retail, s, 135, 52, 8, 28, 0);
    box(scene, asphalt, s, 178, 76, 0.05, 58, 0);
    roadsideSign(scene, registry, s, 90, [name, 'NEXT RIGHT'], color);
  }
  for (const [s, name] of [[5200, 'WAWA'], [8600, 'DUNKIN'], [11400, 'SHEETZ']]) {
    box(scene, new THREE.MeshStandardMaterial({ color: 0xe4e0d5 }), s, -105, 24, 5, 16, 0);
    box(scene, asphalt, s, -125, 38, 0.05, 30, 0);
    roadsideSign(scene, registry, s, -82, [name, 'DRIVE-THRU'], '#b31d2b');
  }

  // Route identity / control-city signs and the live cross streets.
  roadsideSign(scene, registry, 1800, -92, ['PA 3 WEST', 'WEST CHESTER'], '#1265a6');
  roadsideSign(scene, registry, 8200, 92, ['PA 352', 'MEDIA · GLEN MILLS'], '#1265a6');
  roadsideSign(scene, registry, 20100, -92, ['US 1 SOUTH', 'WILMINGTON · BALTIMORE'], '#1265a6');
  for (const sig of SIGNALS) crossStreet(scene, sig.s);

  const cars = [];
  for (const sig of SIGNALS.slice(0, 8)) {
    for (const dir of [-1, 1]) for (let i = 0; i < 2; i++) {
      const car = makeParkedCar(rand); car.scale.setScalar(0.92); scene.add(car);
      cars.push({ car, sig, dir, lat: dir < 0 ? -58 - i * 13 : 58 + i * 13, v: 8 + rand() * 3 });
    }
  }
  return {
    update(dt, simTime) {
      for (const c of cars) {
        const red = signalState(c.sig, simTime) === 'green';
        const stop = c.dir < 0 ? -pavedHalfAt(c.sig.s) - 7 : pavedHalfAt(c.sig.s) + 7;
        const approaching = c.dir < 0 ? c.lat < stop : c.lat > stop;
        const blocked = red && approaching && Math.abs(c.lat - stop) < 12;
        if (!blocked) c.lat += c.dir * c.v * dt;
        if (c.lat < -72 || c.lat > 72) c.lat = c.dir < 0 ? 72 : -72;
        c.car.position.copy(posAt(c.sig.s, c.lat, new THREE.Vector3()));
        c.car.position.y = groundY(c.sig.s, c.lat) + 0.1;
        c.car.rotation.y = headingAt(c.sig.s) + (c.dir < 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    },
  };
}
