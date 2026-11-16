import * as THREE from 'three';
import { Villagers } from './villagers.js';

// ---------------------------------------------------------------------------
// Newark Liberty International Airport (EWR) — a to-scale, walkable modern
// airport. Three terminals (A, B, C — United's hub) strung along the frontage,
// each with a glass headhouse, airline check-in rows, a TSA security checkpoint
// with snaking queues, departure gates with jet bridges and parked widebodies,
// gate seating and departure boards. An elevated AirTrain monorail loops between
// the terminals; the arrivals/departures roadway out front runs taxis, black-car
// Ubers, NJ Transit buses and shuttles under big green highway-style signs
// (Terminals A/B/C, New York City via I-78, AirTrain to NJ Transit / Amtrak,
// rideshare pickup) plus FIFA World Cup 26 welcome banners. The crowd is a true
// global cross-section — TSA and gate agents, pilots and flight attendants, ramp
// crew, Port Authority police, skycaps, and travellers whose mix shifts by gate
// the way real flights do (a Tokyo departure vs a Lagos one vs a domestic hop).
// ---------------------------------------------------------------------------

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function mat(c, r = 0.9, m = 0) { return new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }); }
function emis(c, i = 1) { return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.5 }); }
function glassMat() { return new THREE.MeshStandardMaterial({ color: 0x9fc0d8, roughness: 0.12, metalness: 0.6, transparent: true, opacity: 0.34, side: THREE.DoubleSide }); }

const UNIT = new THREE.BoxGeometry(1, 1, 1);

export function buildNewark(scene) {
  const rnd = rng(1974);
  const lights = [];    // emissive materials to ramp at night
  const lamps = [];     // point lights to ramp at night
  const movers = [];    // {update(dt)} — airtrain, roadway traffic

  const gh = () => 0;   // the airport is flat

  // ---- signage helper: a lit board with one or more text lines ----
  function makeSign(lines, w, h, bg = '#0f5a2a', fg = '#ffffff', lit = false, font = 46) {
    const cw = Math.max(128, Math.round(w * 46)), ch = Math.max(64, Math.round(h * 46));
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 4; g.strokeRect(3, 3, cw - 6, ch - 6);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    const n = lines.length;
    lines.forEach((ln, i) => { g.font = `bold ${font}px Arial`; g.fillText(ln, cw / 2, ch * (i + 0.5) / n); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = lit
      ? new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.0, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide });
    if (lit) lights.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    return mesh;
  }
  // FIDS departure board: black with amber rows
  function fids(x, y, z, rot) {
    const rows = ['UA 234  SAN FRANCISCO      GATE C71   ON TIME',
      'UA 88   TOKYO NARITA       GATE C120  BOARDING',
      'LH 403  FRANKFURT          GATE B61   ON TIME',
      'UA 512  CHICAGO OHARE      GATE C99   DELAYED',
      'AA 771  MIAMI              GATE A25   ON TIME',
      'TP 208  LISBON             GATE B57   BOARDING'];
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 360;
    const g = cv.getContext('2d');
    g.fillStyle = '#0a0c10'; g.fillRect(0, 0, 1024, 360);
    g.fillStyle = '#111'; g.fillRect(0, 0, 1024, 46);
    g.fillStyle = '#f5c518'; g.font = 'bold 30px monospace'; g.textAlign = 'left';
    g.fillText('DEPARTURES', 20, 34);
    g.font = 'bold 30px monospace';
    rows.forEach((r, i) => { g.fillStyle = r.includes('DELAYED') ? '#e0121a' : '#f5c518'; g.fillText(r, 20, 90 + i * 44); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7 }); lights.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 3.9), m);
    mesh.position.set(x, y, z); mesh.rotation.y = rot; scene.add(mesh);
  }

  // ---------------------------------------------------------------------------
  // GROUND: concrete apron + landside lawn + distant runways
  // ---------------------------------------------------------------------------
  (function ground() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), mat(0x8d9096, 1));
    g.rotation.x = -Math.PI / 2; g.position.y = 0; g.receiveShadow = true; scene.add(g);
    // landside lawn strip behind the roadway
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(2000, 220), mat(0x466a34, 1));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.02, 240); scene.add(lawn);
    // grass infields way out on the airfield
    const inf = new THREE.Mesh(new THREE.PlaneGeometry(2000, 300), mat(0x3f5f2e, 1));
    inf.rotation.x = -Math.PI / 2; inf.position.set(0, 0.02, -360); scene.add(inf);
    // two runways in the distance
    const rwMat = mat(0x53555b, 1);
    for (const rz of [-520, -640]) {
      const rw = new THREE.Mesh(new THREE.BoxGeometry(1500, 0.2, 44), rwMat);
      rw.position.set(0, 0.1, rz); scene.add(rw);
      // centerline dashes + edge lights (edge lights glow at night)
      const dash = new THREE.InstancedMesh(UNIT, mat(0xdfe2e6, 1), 60);
      const edge = new THREE.InstancedMesh(UNIT, emis(0xfff0c0, 0.0), 120); lights.push(edge.material);
      const M = new THREE.Matrix4();
      for (let i = 0; i < 60; i++) { M.makeScale(10, 0.05, 1.2); M.setPosition(-740 + i * 25, 0.22, rz); dash.setMatrixAt(i, M); }
      for (let i = 0; i < 60; i++) { M.makeScale(1, 0.4, 1); M.setPosition(-740 + i * 25, 0.4, rz - 22); edge.setMatrixAt(i, M); M.setPosition(-740 + i * 25, 0.4, rz + 22); edge.setMatrixAt(60 + i, M); }
      scene.add(dash, edge);
    }
    // taxiway centerline (yellow) leading to the gates
    const tw = new THREE.Mesh(new THREE.BoxGeometry(1400, 0.05, 3), mat(0xd9b93a, 1)); tw.position.set(0, 0.16, -200); scene.add(tw);
  })();

  // ---------------------------------------------------------------------------
  // TERMINAL builder
  // ---------------------------------------------------------------------------
  const steel = mat(0xc4cad0, 0.5, 0.5);
  const white = mat(0xeef1f4, 0.7);
  const floorMat = mat(0xcdd0d4, 0.4);
  const deskMat = mat(0x24406e, 0.5);

  function terminal(cx, name, sub, brandCol, paxOrigins) {
    const W = 150, D = 56, H = 13;
    const g = new THREE.Group();
    // polished floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, D), floorMat); floor.position.set(0, 0.06, 0); floor.receiveShadow = true; g.add(floor);
    // roof — must NOT cast a shadow or it blacks out the whole interior; the sun
    // and sky then light the concourse the way daylight floods a glass terminal
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 0.8, D + 4), white); roof.position.set(0, H, 0); roof.castShadow = false; g.add(roof);
    // curved roof fascia band in the airline brand colour
    const band = new THREE.Mesh(new THREE.BoxGeometry(W + 4.4, 1.4, D + 4.4), mat(brandCol, 0.5)); band.position.set(0, H - 1.1, 0); g.add(band);
    // interior lighting — airports are lit day and night. Bright ceiling panels
    // (constant, so they don't dim by day) + a warm fill light per terminal.
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e6, emissiveIntensity: 0.9, roughness: 0.5 });
    for (let i = -2; i <= 2; i++) for (const z of [-D / 4, D / 4]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(24, 0.2, 3), panelMat); panel.position.set(i * 30, H - 0.6, z); g.add(panel);
    }
    const fill = new THREE.PointLight(0xfff2dc, 1.1, 130); fill.position.set(0, H - 2, 0); g.add(fill);
    const fill2 = new THREE.PointLight(0xfff2dc, 0.8, 110); fill2.position.set(0, H - 2, -D / 3); g.add(fill2);
    // glass curtain walls (transparent) with white mullion columns
    const gm = glassMat();
    for (const [wx, wz, ww, wd] of [[0, D / 2, W, 0.4], [0, -D / 2, W, 0.4], [W / 2, 0, 0.4, D], [-W / 2, 0, 0.4, D]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, H - 0.6, wd), gm); wall.position.set(wx, (H - 0.6) / 2 + 0.1, wz); g.add(wall);
    }
    // structural columns inside
    for (let i = -2; i <= 2; i++) for (const z of [-D / 4, D / 4]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, H, 8), steel); c.position.set(i * 30, H / 2, z); c.castShadow = true; g.add(c);
    }

    // --- check-in hall (landside, +z half): a long row of desks + brand wall ---
    const brandWall = new THREE.Mesh(new THREE.BoxGeometry(W - 8, 5, 0.6), mat(brandCol, 0.6)); brandWall.position.set(0, 3, D / 2 - 3); g.add(brandWall);
    const brandSign = makeSign([name, sub], 34, 4.2, '#ffffff', '#' + brandCol.toString(16).padStart(6, '0'), true, 74);
    brandSign.position.set(0, 3.2, D / 2 - 2.6); g.add(brandSign);
    const desks = 10;
    const deskMesh = new THREE.InstancedMesh(UNIT, deskMat, desks);
    const monMesh = new THREE.InstancedMesh(UNIT, emis(0x8fd0ff, 0.0), desks); lights.push(monMesh.material);
    const M = new THREE.Matrix4();
    for (let i = 0; i < desks; i++) {
      const dx = -W / 2 + 12 + i * ((W - 24) / (desks - 1));
      M.makeScale(4.5, 1.1, 1.6); M.setPosition(dx, 0.65, D / 2 - 8); deskMesh.setMatrixAt(i, M);
      M.makeScale(0.9, 0.6, 0.1); M.setPosition(dx + 1.4, 1.5, D / 2 - 7.4); monMesh.setMatrixAt(i, M);
    }
    deskMesh.castShadow = true; g.add(deskMesh, monMesh);
    // "CHECK-IN / TICKETING" hanging sign
    const ci = makeSign(['✈ CHECK-IN · TICKETING'], 12, 1.6, '#111820', '#ffffff', true, 44); ci.position.set(0, 7.4, D / 2 - 9); g.add(ci);

    // --- TSA security checkpoint (middle) ---
    const tsaSign = makeSign(['SECURITY CHECKPOINT', 'TSA PRE✓ / STANDARD'], 14, 2.6, '#0a1e4a', '#ffffff', true, 44);
    tsaSign.position.set(0, 8, 6); g.add(tsaSign);
    // x-ray lanes: belt tables + archway metal detectors
    for (let l = 0; l < 3; l++) {
      const lx = -18 + l * 18;
      const belt = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 7), mat(0x3a3f47, 0.5)); belt.position.set(lx, 0.55, 2); g.add(belt);
      const rollers = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 7), mat(0x8a8f96, 0.4)); rollers.position.set(lx, 1.05, 2); g.add(rollers);
      const xray = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.8, 2.4), mat(0xe0e2e6, 0.5)); xray.position.set(lx, 1.4, 2); g.add(xray);
      // body scanner arch
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.18, 6, 12, Math.PI), mat(0xdfe2e6, 0.4)); arch.position.set(lx, 1.2, 6); arch.rotation.x = 0; g.add(arch);
    }
    // snaking queue: stanchion posts + belts (instanced posts)
    const posts = [];
    for (let row = 0; row < 5; row++) {
      const qz = 14 + row * 3.2, dir = row % 2 ? -1 : 1;
      for (let i = 0; i <= 8; i++) posts.push([-24 + i * 6, qz]);
    }
    const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.08, 1.0, 6), mat(0x2a2e34, 0.4), posts.length);
    posts.forEach(([px, pz], i) => { M.makeScale(1, 1, 1); M.setPosition(px, 0.5, pz); postMesh.setMatrixAt(i, M); });
    g.add(postMesh);

    // --- departure gates (airside, -z half): podiums, boards, seating ---
    const seatMesh = new THREE.InstancedMesh(UNIT, mat(0x24406e, 0.5), 12 * 4);
    let si = 0;
    for (let gnum = 0; gnum < 4; gnum++) {
      const gx = -W / 2 + 22 + gnum * ((W - 44) / 3);
      // podium
      const pod = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 1.4), mat(0xdfe2e6, 0.4)); pod.position.set(gx, 0.65, -D / 2 + 6); g.add(pod);
      // gate number sign
      const gs = makeSign(['GATE ' + name.slice(-1) + (60 + gnum * 3)], 3.4, 1.4, '#111820', '#f5c518', true, 54); gs.position.set(gx, 3.4, -D / 2 + 5.2); g.add(gs);
      // rows of seats facing the window
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
        M.makeScale(1.1, 0.5, 1.0); M.setPosition(gx - 2 + c * 1.3, 0.55, -D / 2 + 12 + r * 2.4); seatMesh.setMatrixAt(si++, M);
      }
    }
    seatMesh.count = si; g.add(seatMesh);
    fids(0, 8, -6, Math.PI);   // big departures board over the concourse

    // shops / kiosks
    const shopA = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 6), mat(0xe8541a, 0.7)); shopA.position.set(-52, 1.6, 12); g.add(shopA);
    g.add(makeSign(["DUNKIN'"], 6, 1.4, '#ff671f', '#f5008b', true, 50).translateX(-52).translateY(3.6).translateZ(15));
    const shopB = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6), mat(0x1a3a6a, 0.7)); shopB.position.set(50, 1.6, 12); g.add(shopB);
    g.add(makeSign(['HUDSON NEWS'], 7, 1.4, '#0a2a5e', '#ffffff', true, 46).translateX(50).translateY(3.6).translateZ(15));

    g.position.set(cx, 0, 0); scene.add(g);

    // people clusters for this terminal
    return { cx, name, brandCol, paxOrigins };
  }

  const TA = terminal(-320, 'TERMINAL A', 'American · Delta · JetBlue', 0xc8102e, ['pax_dom', 'pax_dom', 'pax_latin']);
  const TB = terminal(0, 'TERMINAL B', 'INTERNATIONAL · Lufthansa · TAP · Air Canada', 0x0a2f6b, ['pax_euro', 'pax_africa', 'pax_dom']);
  const TC = terminal(320, 'TERMINAL C', 'United Airlines Hub', 0x0a3161, ['pax_dom', 'pax_asia', 'pax_euro']);
  const TERMS = [TA, TB, TC];

  // ---------------------------------------------------------------------------
  // JET BRIDGES + PARKED AIRCRAFT at the gates
  // ---------------------------------------------------------------------------
  function makePlane(tailCol, big) {
    const g = new THREE.Group();
    const s = big ? 1.35 : 1;
    const body = mat(0xf2f4f6, 0.4, 0.15);
    const L = 34 * s;
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * s, 1.8 * s, L, 16), body); fuse.rotation.x = Math.PI / 2; fuse.position.y = 3.2; g.add(fuse);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.8 * s, 12, 10), body); nose.position.set(0, 3.2, L / 2); nose.scale.z = 1.3; g.add(nose);
    // cheatline (brand)
    const line = new THREE.Mesh(new THREE.CylinderGeometry(1.82 * s, 1.82 * s, L, 16, 1, true, 0, Math.PI), mat(tailCol, 0.4)); line.rotation.x = Math.PI / 2; line.position.y = 2.6; g.add(line);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(40 * s, 0.5, 5.5 * s), body); wing.position.y = 3.0; g.add(wing);
    for (const ex of [-9 * s, 9 * s]) { const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * s, 1.2 * s, 3.4 * s, 12), mat(0x33383f, 0.4)); eng.rotation.x = Math.PI / 2; eng.position.set(ex, 2.1, 1); g.add(eng); }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7 * s, 5 * s), mat(tailCol, 0.4)); tail.position.set(0, 7 * s + 1, -L / 2 + 3); g.add(tail);
    const hstab = new THREE.Mesh(new THREE.BoxGeometry(14 * s, 0.4, 3.5 * s), body); hstab.position.set(0, 4.6, -L / 2 + 3); g.add(hstab);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  const TAILS = { A: [0xc8102e, 0x003268, 0x1a3a8c], B: [0x05164d, 0xd82b2b, 0x006341], C: [0x0a3161, 0x0a3161, 0x0a3161] };
  for (const t of TERMS) {
    const letter = t.name.slice(-1);
    for (let gnum = 0; gnum < 4; gnum++) {
      const gx = t.cx + (-150 / 2 + 22 + gnum * ((150 - 44) / 3));
      const big = letter !== 'A' && gnum % 2 === 0;
      const plane = makePlane(TAILS[letter][gnum % 3], big);
      plane.position.set(gx, 0, -95); plane.rotation.y = 0; scene.add(plane);
      // jet bridge from terminal edge (z=-28) to plane door (z≈-78)
      const jb = new THREE.Group();
      const tube = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 40), mat(0xb8bcc2, 0.5)); tube.position.set(0, 3.4, 0); jb.add(tube);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3.4, 8), steel); leg.position.set(0, 1.7, -14); jb.add(leg);
      jb.position.set(gx, 0, -55); jb.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(jb);
      // service vehicles by the plane (baggage tug + cart) at night lit
      const tug = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 3.2), mat(0xf2c53d, 0.5)); tug.position.set(gx + 6, 0.7, -86); tug.castShadow = true; scene.add(tug);
    }
  }

  // ---------------------------------------------------------------------------
  // AIRTRAIN — elevated monorail guideway spanning the terminals + moving trains
  // ---------------------------------------------------------------------------
  (function airtrain() {
    const TZ = 108, TY = 9;
    const guideMat = mat(0xb4b8be, 0.6);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(900, 1.2, 3.2), guideMat); beam.position.set(0, TY, TZ); beam.castShadow = true; scene.add(beam);
    // piers
    const pierMesh = new THREE.InstancedMesh(UNIT, mat(0x9a9ea4, 0.7), 30);
    const M = new THREE.Matrix4();
    for (let i = 0; i < 30; i++) { M.makeScale(2, TY, 2); M.setPosition(-435 + i * 30, TY / 2, TZ); pierMesh.setMatrixAt(i, M); }
    pierMesh.castShadow = true; scene.add(pierMesh);
    // stations at each terminal (platform + canopy + sign)
    for (const t of TERMS) {
      const plat = new THREE.Mesh(new THREE.BoxGeometry(40, 0.6, 10), mat(0xd0d4d8, 0.6)); plat.position.set(t.cx, TY - 1.2, TZ); scene.add(plat);
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(42, 0.4, 12), white); canopy.position.set(t.cx, TY + 3.4, TZ); scene.add(canopy);
      const s = makeSign(['AirTrain', t.name], 10, 2.2, '#c8102e', '#ffffff', true, 44); s.position.set(t.cx, TY + 1.4, TZ - 5.4); scene.add(s);
      // escalator hint down to the roadway
      const esc = new THREE.Mesh(new THREE.BoxGeometry(4, TY - 1, 6), mat(0x8a8f96, 0.5)); esc.position.set(t.cx - 15, (TY - 1) / 2, TZ - 6); esc.rotation.x = -0.5; scene.add(esc);
    }
    // trains: two red-and-grey monorail sets looping the frontage
    function train() {
      const g = new THREE.Group();
      for (let c = 0; c < 3; c++) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(11, 3, 3), mat(0xe6e8ea, 0.4, 0.2)); car.position.set(c * 12 - 12, TY + 1.8, 0); g.add(car);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(11.05, 0.7, 3.05), mat(0xc8102e, 0.4)); stripe.position.set(c * 12 - 12, TY + 2.2, 0); g.add(stripe);
        const win = new THREE.Mesh(new THREE.BoxGeometry(11.1, 1.0, 3.06), emis(0xbfe4ff, 0.0)); win.position.set(c * 12 - 12, TY + 1.9, 0); g.add(win); lights.push(win.material);
      }
      g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g;
    }
    const t1 = train(), t2 = train();
    let p1 = -400, p2 = 60;
    movers.push({ update: (dt) => {
      p1 += 22 * dt; if (p1 > 450) p1 = -450;
      p2 -= 22 * dt; if (p2 < -450) p2 = 450;
      t1.position.set(p1, 0, TZ); t2.position.set(p2, 0, TZ);
    } });
  })();

  // ---------------------------------------------------------------------------
  // ARRIVALS / DEPARTURES ROADWAY + ground transportation + big highway signs
  // ---------------------------------------------------------------------------
  (function roadway() {
    const RZ = 150;
    const road = new THREE.Mesh(new THREE.BoxGeometry(1000, 0.15, 26), mat(0x2f3238, 1)); road.position.set(0, 0.12, RZ); scene.add(road);
    // curb
    const curb = new THREE.Mesh(new THREE.BoxGeometry(1000, 0.4, 2), mat(0xbfc3c8, 0.8)); curb.position.set(0, 0.2, RZ - 14); scene.add(curb);
    // lane dashes
    const dash = new THREE.InstancedMesh(UNIT, mat(0xdfe2e6, 1), 80); const M = new THREE.Matrix4();
    for (let i = 0; i < 80; i++) { M.makeScale(4, 0.02, 0.4); M.setPosition(-480 + i * 12, 0.2, RZ); dash.setMatrixAt(i, M); }
    scene.add(dash);
    // crosswalks at each terminal
    for (const t of TERMS) for (let i = 0; i < 8; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 12), mat(0xeef1f4, 1)); st.position.set(t.cx - 4 + i * 1.1, 0.2, RZ); scene.add(st); }

    // overhead green highway sign gantry
    const gantryMat = mat(0x3a3f47, 0.6);
    for (const gx of [-3, 3]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), gantryMat); post.position.set(gx * 60, 4.5, RZ + 12); post.castShadow = true; scene.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(200, 0.8, 0.8), gantryMat); beam.position.set(0, 8.6, RZ + 12); scene.add(beam);
    const g1 = makeSign(['◄ Terminal A', 'Terminal B'], 22, 4, '#0f5a2a', '#ffffff', true, 58); g1.position.set(-40, 6.4, RZ + 12); scene.add(g1);
    const g2 = makeSign(['Terminal C ►', 'P  Parking'], 22, 4, '#0f5a2a', '#ffffff', true, 58); g2.position.set(40, 6.4, RZ + 12); scene.add(g2);

    // ground-transportation signs along the curb
    const gtSigns = [
      [['AirTrain ↑', 'NJ TRANSIT · Amtrak', 'Rail Link'], -230, '#0a2f6b'],
      [['TAXI', 'Authorized Cabs'], -120, '#f2b01a', '#111111'],
      [['Uber · Lyft', 'App-Based Pickup', '↑ Level 2'], -20, '#111820'],
      [['BUSES', 'NJ Transit 62 · Newark Penn'], 90, '#0f5a2a'],
      [['◄ NEW YORK CITY', 'I-78 · NJ Turnpike'], 200, '#0f5a2a'],
    ];
    for (const [lines, gx, bg, fg] of gtSigns) {
      const s = makeSign(lines, 12, lines.length > 2 ? 5 : 3.4, bg, fg || '#ffffff', true, 40);
      s.position.set(gx, 3.2, RZ - 15); scene.add(s);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 0.4), gantryMat); post.position.set(gx, 1.6, RZ - 15.4); scene.add(post);
    }
    // FIFA World Cup 26 welcome banner (NY-NJ host region)
    const wc = makeSign(['FIFA WORLD CUP 26', 'Welcome · Bem-vindo · Bienvenidos'], 30, 4.4, '#0a1e4a', '#f5c518', true, 52);
    wc.position.set(0, 11, RZ + 12); scene.add(wc);
    // "Newark Liberty International" monument sign at the entrance
    const mon = makeSign(['✈ Newark Liberty', 'INTERNATIONAL AIRPORT', 'EWR'], 26, 6, '#c8102e', '#ffffff', true, 60);
    mon.position.set(-460, 5, RZ + 4); mon.rotation.y = 0.5; scene.add(mon);
    const mon2 = makeSign(['Welcome to', 'NEW JERSEY'], 20, 5, '#0a4a2a', '#f5c518', true, 60);
    mon2.position.set(460, 5, RZ + 4); mon2.rotation.y = -0.5; scene.add(mon2);

    // ---- roadway vehicles (taxis, black-car Ubers, NJT bus, shuttles) ----
    const vehicles = [];
    function taxi() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 4.6), mat(0xf2c00a, 0.4)); b.position.y = 0.9; g.add(b); const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 2.2), mat(0x1a2430, 0.3)); cab.position.set(0, 1.7, -0.2); g.add(cab); wheels(g, 2.3, 1); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
    function suv(c) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.8, 5), mat(c, 0.4, 0.2)); b.position.y = 1.1; g.add(b); const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 2.8), mat(0x11151c, 0.2)); cab.position.set(0, 2.0, -0.2); g.add(cab); wheels(g, 2.5, 1.05); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
    function bus() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 12), mat(0xd8dbe0, 0.5)); b.position.y = 1.9; g.add(b); const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.7, 12), mat(0x0a2f6b, 0.5)); stripe.position.y = 2.3; g.add(stripe); for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.BoxGeometry(2.63, 1, 1.3), mat(0x1a2430, 0.3)); w.position.set(0, 2.6, -4.6 + i * 1.7); g.add(w); } wheels(g, 3.6, 1.4); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
    function shuttle(c) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.6, 6.5), mat(c, 0.5)); b.position.y = 1.5; g.add(b); wheels(g, 3, 1.2); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
    function wheels(g, hl, off) { for (const [x, z] of [[-off, hl / 2], [off, hl / 2], [-off, -hl / 2], [off, -hl / 2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 10), mat(0x111, 0.8)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.4, z); g.add(w); } }
    const fleet = [taxi(), taxi(), suv(0x111318), suv(0x1a1a1a), bus(), shuttle(0xffffff), shuttle(0x2a7ac0), taxi(), suv(0x14161a)];
    fleet.forEach((v, i) => { scene.add(v); vehicles.push({ v, x: -420 + i * 100, spd: 5 + Math.random() * 5, dir: 1, lane: (i % 2) * 3 - 1.5 }); });
    // some parked at the curb (dir 0)
    for (let i = 0; i < 4; i++) { const v = i % 2 ? taxi() : suv(0x111318); scene.add(v); v.position.set(-260 + i * 160, 0, RZ - 11); vehicles.push({ v, x: v.position.x, spd: 0, dir: 0, lane: -3 }); }
    movers.push({ update: (dt) => {
      for (const u of vehicles) {
        if (u.spd === 0) continue; // parked at the curb
        u.x += u.spd * dt; if (u.x > 480) u.x = -480;
        u.v.position.set(u.x, 0, RZ + u.lane); u.v.rotation.y = Math.PI / 2;
      }
    } });
  })();

  // ---------------------------------------------------------------------------
  // CONTROL TOWER + a couple of distant terminal masses for depth
  // ---------------------------------------------------------------------------
  (function tower() {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 46, 12), mat(0xd0d4d8, 0.6)); shaft.position.y = 23; g.add(shaft);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 5, 12), mat(0x1a2430, 0.2, 0.4)); cab.position.y = 48; g.add(cab);
    const roofc = new THREE.Mesh(new THREE.ConeGeometry(5.4, 3, 12), mat(0xd0d4d8, 0.6)); roofc.position.y = 52; g.add(roofc);
    const bcn = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), emis(0xff2020, 0.0)); bcn.position.y = 54; g.add(bcn); lights.push(bcn.material);
    g.position.set(150, 0, -180); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
  })();

  // ---------------------------------------------------------------------------
  // PEOPLE — global cross-section, mix shifting by terminal / gate
  // ---------------------------------------------------------------------------
  const groups = [
    // staff spread across the frontage (no police — removed game-wide)
    { role: 'redcap', count: 6, x: 0, z: 135, spread: 380, idle: 0.5 },
    { role: 'cleaner', count: 6, x: 0, z: 20, spread: 380 },
    { role: 'pilot', count: 8, x: 0, z: 30, spread: 360 },
    { role: 'attendant', count: 12, x: 0, z: 30, spread: 360 },
    { role: 'crew', count: 14, x: 0, z: -90, spread: 400 },     // ramp crew by the planes
  ];
  for (const t of TERMS) {
    const [o1, o2, o3] = t.paxOrigins;
    groups.push(
      { role: 'tsa', count: 6, x: t.cx, z: 4, spread: 24, idle: 0.35 },
      { role: 'agent', count: 6, x: t.cx, z: 20, spread: 60 },
      // check-in hall crowd
      { role: o1, count: 20, x: t.cx, z: 18, spread: 66 },
      { role: o2, count: 12, x: t.cx, z: 18, spread: 66 },
      // security queue
      { role: o1, count: 16, x: t.cx, z: 20, spread: 26, idle: 0.6 },
      { role: o3, count: 8, x: t.cx, z: 20, spread: 26, idle: 0.6 },
      // gate areas (airside)
      { role: o1, count: 16, x: t.cx, z: -18, spread: 60, idle: 0.5 },
      { role: o2, count: 12, x: t.cx, z: -18, spread: 60, idle: 0.55 },
      { role: o3, count: 10, x: t.cx, z: -18, spread: 60, idle: 0.55 },
      { role: 'pax_kid', count: 8, x: t.cx, z: -14, spread: 60, idle: 0.4 },
      // curbside arrivals
      { role: o1, count: 10, x: t.cx, z: 132, spread: 50 },
      { role: 'pax_kid', count: 4, x: t.cx, z: 132, spread: 50 },
    );
  }
  const villagers = new Villagers(scene, 'newark', gh, groups, 1974);

  return {
    groundHeight: gh, seaLevel: -9999,
    blocked: (x, z) => z < -140,   // don't wander onto the active runways
    update(dt, t, nightF) {
      const gl = 0.1 + nightF * 1.3;
      for (const m of lights) m.emissiveIntensity = gl;
      for (const l of lamps) l.intensity = nightF * 1.4;
      for (const mv of movers) mv.update(dt);
      villagers.update(dt);
    },
  };
}
