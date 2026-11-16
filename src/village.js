import * as THREE from 'three';
import { MAP, WORLD, DAY_LENGTH } from './config.js';
import { buildKonkan } from './konkan.js';
import { buildBihar } from './bihar.js';
import { buildDelhi } from './delhi.js';
import { buildCarolina } from './carolina.js';
import { buildRio } from './rio.js';
import { buildNewark } from './newark.js';
import { buildDelhiSlum } from './delhislum.js';
import { buildRailCorridor, buildRailRide } from './railcorridor.js?rail-20261101-7';
import { buildHuman } from './villagers.js';
import { initAudio } from './audio.js';

// ---------------------------------------------------------------------------
// Free-roam village engine (walking maps). Entirely separate from the road
// loop: you walk a person around a 1920s Raj-era village in all directions with
// WASD + mouse-look, day/night + weather + a live local-weather readout, and
// spawn points at the major places. Konkan (coastal) and Bihar (Gangetic plains)
// share this shell and differ only in their world builder + villager mix.
// ---------------------------------------------------------------------------

export function startVillage({ scene, camera, renderer }) {
  const W = WORLD;
  const half = W.size;
  // Driving-only controls otherwise obscure the walking/rail view.
  const trafficControl = document.getElementById('trafficcontrol');
  const rearViewButton = document.getElementById('rearviewbutton');
  if (trafficControl) trafficControl.style.display = 'none';
  if (rearViewButton) rearViewButton.style.display = 'none';
  const q = new URLSearchParams(location.search);
  const characters = {
    bengali_man: { label: "BENGALI MAN · 5'5", skin: 0x6b3d18, top: 0x365d62, bottom: 0x252b31, tall: 0.954 },
    bengali_woman: { label: "BENGALI WOMAN · 5'0", skin: 0x7a4a1e, female: true, saree: 0xc21f2f, headwrap: 0xf2efe4, tall: 0.881 },
    bihari_guy: { label: "BIHARI GUY · 5'6", skin: 0x6b3d18, top: 0xd8c8a0, bottom: 0x5a4a34, pagri: 0xc21f2f, tall: 0.969 },
    up_guy: { label: "UP GUY · 5'8", skin: 0x8d5524, top: 0x6a7a8a, bottom: 0x2a2a2a, cap: true, tall: 0.998 },
    bihari_woman: { label: "BIHARI WOMAN · 5'2", skin: 0x7a4a1e, female: true, saree: 0x903070, headwrap: 0xd0c8b0, tall: 0.91 },
  };
  let characterKey = characters[q.get('character')] ? q.get('character') : 'bengali_man';

  // --- lighting -------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xcfe0f2, 0x6b5a3a, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 1; sc.far = 1400;
  scene.add(sun, sun.target);
  const ambient = new THREE.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);

  scene.fog = new THREE.Fog(0x9fb8cc, 40, half * 1.4);

  // --- build the world ------------------------------------------------------
  const world = (MAP === 'railcorridor' ? buildRailCorridor : MAP === 'railride' ? buildRailRide : MAP === 'konkan' ? buildKonkan : MAP === 'bihar' ? buildBihar
    : MAP === 'delhi' ? buildDelhi : MAP === 'carolina' ? buildCarolina
    : MAP === 'newark' ? buildNewark : MAP === 'delhislum' ? buildDelhiSlum : buildRio)(scene);
  const groundHeight = world.groundHeight;
  const seaLevel = world.seaLevel ?? -999;

  // --- the walker (you) -----------------------------------------------------
  let you = buildHuman((MAP === 'railcorridor' || MAP === 'railride') ? characters[characterKey] : (MAP === 'konkan'
    ? { skin: 0x8d5524, top: 0xf2efe4, bottom: 0xece7d8, dhoti: true, pagri: 0xf2efe4 }
    : MAP === 'bihar'
    ? { skin: 0x8d5524, top: 0xeae4d2, bottom: 0xece7d8, dhoti: true, pagri: 0xc21f2f }
    : MAP === 'delhi'
    ? { skin: 0xb07840, top: 0x2a5a4a, bottom: 0xf2efe4, turban: 0xd4af37, tall: 1.02 }        // Mughal Delhi
    : MAP === 'carolina'
    ? { skin: 0xe8bfa0, top: 0x4a4a3a, bottom: 0x6a5a44, hat: 'brim', hatCol: 0x3a2a18 }        // 1840s Carolina
    : MAP === 'newark'
    ? { skin: 0x8d5524, top: 0x1a3a8c, bottom: 0x2a3a44, pack: true, roller: true }              // EWR traveller
    : MAP === 'railcorridor' || MAP === 'railride'
    ? { skin: 0x8d5524, top: 0x3a6a7a, bottom: 0xece7d8, pack: true }
    : MAP === 'delhislum'
    ? { skin: 0x8d5524, top: 0x3a6a7a, bottom: 0xece7d8, cap: false }                             // Delhi basti resident
    : { skin: 0x8d5524, top: 0xe0121a, bottom: 0x1a1a1a, hat: 'ballcap', hatCol: 0x111111 }));   // modern Rio
  scene.add(you.group);

  const requested = q.get('station');
  const start = (MAP === 'railcorridor' || MAP === 'railride') ? { x: 0, z: MAP === 'railride' ? 0 : 18 } : (W.spawns.find(s => s.key === requested) || W.spawns[0]);
  const pos = new THREE.Vector3(start.x, 0, start.z);
  let yaw = MAP === 'railride' ? Math.PI / 2 : Math.PI, pitch = -0.12;
  // C cycles first person → close shoulder camera → wide third person.
  let viewMode = (MAP === 'railcorridor' || MAP === 'railride') ? 0 : 2;
  const EYE = 1.62;

  // --- input ----------------------------------------------------------------
  const keys = {};
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyC') viewMode = (viewMode + 1) % 3;
    if (e.code === 'KeyT') timeScale = timeScale === 1 ? 8 : 1;
    initAudio();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });

  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => { canvas.requestPointerLock(); initAudio(); });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas) return;
    yaw -= e.movementX * 0.0022;
    pitch -= e.movementY * 0.0020;
    pitch = Math.max(-1.2, Math.min(0.85, pitch));
  });

  // --- HUD ------------------------------------------------------------------
  const elSpeed = document.getElementById('speed');
  const elMeta = document.getElementById('meta');
  const elZone = document.getElementById('zone');
  const elClock = document.getElementById('clock');
  const elWeather = document.getElementById('weather');
  elSpeed.style.fontSize = '30px';
  document.getElementById('signal').innerHTML =
    'move<b>W&nbsp;A&nbsp;S&nbsp;D</b><br>turn<b>← →</b> &nbsp; run<b>Shift</b><br>look<b>Mouse</b> <span style="opacity:.6">(click)</span><br>' +
    'view ×3<b>C</b> &nbsp; time ×8<b>T</b>' + (MAP === 'delhislum' || MAP === 'railcorridor' || MAP === 'railride' ? ' &nbsp; interact<b>F</b>' : '') + (MAP === 'railcorridor' || MAP === 'railride' ? '<br>character<b>panel</b>' : '');

  // --- panels: maps / spawns / weather --------------------------------------
  const mpanel = document.getElementById('mpanel');
  const panel = document.getElementById('panel');
  const wpanel = document.getElementById('wpanel');
  const characterpanel = document.getElementById('characterpanel');
  function reloadWith(params) {
    const url = new URLSearchParams(location.search);
    url.delete('zone'); url.delete('s');
    for (const [k, v] of Object.entries(params)) url.set(k, v);
    location.search = url.toString();
  }
  const mapBtns = [
    { label: '🚆 CHECKPOINT TOWNS', on: MAP === 'railcorridor', go: () => reloadWith({ map: 'railcorridor', station: 'delhi' }) },
    { label: '🚆 TRAIN RIDE · GANGES PLAIN', on: MAP === 'railride', go: () => reloadWith({ map: 'railride', station: 'delhi' }) },
    { label: '🚶 KONKAN · 1920s', on: MAP === 'konkan', go: () => reloadWith({ map: 'konkan' }) },
    { label: '🚶 BIHAR · 1920s', on: MAP === 'bihar', go: () => reloadWith({ map: 'bihar' }) },
    { label: '🕌 MUGHAL DELHI', on: MAP === 'delhi', go: () => reloadWith({ map: 'delhi' }) },
    { label: '🏛 CAROLINA · 1840s', on: MAP === 'carolina', go: () => reloadWith({ map: 'carolina' }) },
    { label: '🏙 RIO · FAVELA', on: MAP === 'rio', go: () => reloadWith({ map: 'rio' }) },
    { label: '🛖 DELHI · SLUM', on: MAP === 'delhislum', go: () => reloadWith({ map: 'delhislum' }) },
    { label: '🛫 NEWARK AIRPORT · EWR', on: MAP === 'newark', go: () => reloadWith({ map: 'newark' }) },
    { label: '🚗 I-95 · NORTHEAST', on: false, go: () => reloadWith({ map: 'i95' }) },
    { label: '🚗 INDIA · MUM-PUNE', on: false, go: () => reloadWith({ map: 'india' }) },
  ];
  for (const b of mapBtns) {
    const btn = document.createElement('button');
    btn.textContent = b.label; btn.classList.toggle('active', b.on);
    btn.addEventListener('click', b.go); mpanel.appendChild(btn);
  }
  for (const sp of W.spawns) {
    const btn = document.createElement('button');
    btn.textContent = sp.label;
    btn.addEventListener('click', () => { if (MAP === 'railcorridor') { const u = new URL(location.href); u.searchParams.set('station', sp.key || 'howrah'); location.href = u.toString(); } else { pos.set(sp.x, 0, sp.z); } btn.blur(); });
    panel.appendChild(btn);
  }
  for (let h = 0; h < 24; h += 3) {
    const btn = document.createElement('button');
    const ap = h >= 12 ? 'PM' : 'AM';
    btn.textContent = `${h % 12 || 12}${ap}`;
    btn.addEventListener('click', () => { tod = h / 24; btn.blur(); });
    wpanel.appendChild(btn);
  }
  const wBtns = [];
  const WPRESETS = [
    { label: '🌤 Summer', key: 'summer', apply: () => { season = 'summer'; weather = 'clear'; } },
    { label: '⛅ Humid', key: 'cloudy', apply: () => { season = 'summer'; weather = 'cloudy'; } },
    { label: '❄️ Cool Season', key: 'winter', apply: () => { season = 'winter'; weather = 'clear'; } },
    { label: '🌧 Monsoon', key: 'monsoon', apply: () => { season = 'summer'; weather = 'monsoon'; } },
  ];
  for (const p of WPRESETS) {
    const btn = document.createElement('button');
    btn.textContent = p.label;
    btn.addEventListener('click', () => { p.apply(); markW(); btn.blur(); });
    wpanel.appendChild(btn); wBtns.push({ btn, p });
  }
  if (MAP === 'railcorridor' || MAP === 'railride') {
    for (const [key, d] of Object.entries(characters)) {
      const btn = document.createElement('button');
      btn.textContent = d.label;
      btn.classList.toggle('active', key === characterKey);
      btn.addEventListener('click', () => {
        characterKey = key;
        scene.remove(you.group);
        you = buildHuman(characters[characterKey]);
        scene.add(you.group);
        for (const b of characterpanel.querySelectorAll('button')) b.classList.toggle('active', b === btn);
        const u = new URL(location.href); u.searchParams.set('character', key); history.replaceState(null, '', u);
        btn.blur();
      });
      characterpanel.appendChild(btn);
    }
  }
  function markW() {
    for (const { btn, p } of wBtns) {
      const on = p.key === 'monsoon' ? weather === 'monsoon'
        : p.key === 'cloudy' ? weather === 'cloudy'
        : p.key === 'winter' ? (season === 'winter' && weather === 'clear')
        : (season === 'summer' && weather === 'clear');
      btn.classList.toggle('active', on);
    }
  }

  // --- weather + time state -------------------------------------------------
  let tod = q.get('tod') ? parseFloat(q.get('tod')) : 15 / 24;   // 3 PM
  let timeScale = 1;
  let season = 'summer';
  let weather = 'clear';   // clear | cloudy | monsoon
  let simTime = 0;
  let railNotice = '', railNoticeT = 0;
  markW();

  // rain particles (monsoon)
  const RAIN_N = 1500;
  const rp = new Float32Array(RAIN_N * 3);
  for (let i = 0; i < RAIN_N; i++) {
    rp[i * 3] = (Math.random() - 0.5) * 120;
    rp[i * 3 + 1] = Math.random() * 60;
    rp[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0xaebccb, size: 0.16, transparent: true, opacity: 0.6, depthWrite: false,
  }));
  rain.frustumCulled = false; rain.visible = false; scene.add(rain);

  // Delhi basti sits under permanent dust/smog: a dirty tan sky and a close,
  // brown-grey haze that swallows the far towers — the air you can taste.
  const SMOG = W.smog === true;
  const SKY_DAY = SMOG ? new THREE.Color(0xc3b494) : MAP === 'konkan' ? new THREE.Color(0x8ec0e8) : new THREE.Color(0x9fc0d8);
  const SKY_NIGHT = SMOG ? new THREE.Color(0x241c14) : new THREE.Color(0x0a1020);
  const SKY_DUSK = new THREE.Color(0xdd8a52);
  const SKY_GRAY = new THREE.Color(SMOG ? 0x9a8f78 : 0x8a97a2);
  const FOG_DAY = new THREE.Color(SMOG ? 0xbcae90 : (MAP === 'konkan' ? 0xbcd2df : 0xcdd2c8));
  const bg = new THREE.Color();

  // --- dynamic weather (like the road maps): the sky isn't static. A slow
  // multi-scale signal drifts cloud cover over game time (summer skews clear,
  // the cool season grayer, humid coasts hazier), and random passing showers /
  // downpours roll through — heavier and more often on humid/tropical maps and
  // in the afternoon, some days none at all. A weather button just overrides it.
  let wxT = Math.random() * 6000;
  const WX = { ph: [Math.random() * 7, Math.random() * 7, Math.random() * 7], cond: 'clear', cloud: 0.3 };
  const TROPICAL = MAP === 'rio' || MAP === 'konkan' || MAP === 'bihar' || MAP === 'delhi' || MAP === 'delhislum';
  function updateAutoWeather(dt) {
    wxT += dt * timeScale;
    const bias = season === 'winter' ? 0.16 : (W.humid ? 0.05 : -0.06);
    const c = 0.46 + bias + 0.34 * Math.sin(wxT / 1875 + WX.ph[0])
      + 0.20 * Math.sin(wxT / 620 + WX.ph[1]) + 0.12 * Math.sin(wxT / 210 + WX.ph[2]);
    WX.cloud = Math.min(1, Math.max(0, c));
    if (WX.cloud > 0.6) WX.cond = 'cloudy';
    else if (WX.cloud < 0.32) WX.cond = 'clear';
    // else hold (hysteresis)
  }
  // passing showers / storms — automatic, game-time driven
  const shower = { active: false, t: 0, intensity: 0 };
  const SHOWER_RATE = W.humid ? 0.95 : 0.5;
  function updateShowers(dt) {
    if (shower.active) {
      shower.t -= dt * timeScale;
      if (shower.t <= 0) { shower.active = false; shower.intensity = 0; }
      return;
    }
    if (weather === 'monsoon') return;                 // user forced rain
    const eligible = season !== 'winter' || W.humid;    // dry cool season inland
    if (!eligible) return;
    const hour = tod * 24;
    const humidBias = weather === 'cloudy' ? 2.2 : 1;   // "Humid" preset → wetter
    const sp = (hour > 13 && hour < 19 ? 2 : 1) * humidBias * (0.35 + WX.cloud * 1.8) * (TROPICAL ? 1.3 : 1);
    if (Math.random() < dt * timeScale * (SHOWER_RATE / DAY_LENGTH) * sp) {
      shower.active = true;
      shower.t = 40 + Math.random() * 90;
      const r = Math.random();
      shower.intensity = r < 0.3 ? 0.3 : r < 0.7 ? 0.6 : 1.0;
    }
  }
  // what the sky actually does right now (forced button > passing shower > drift)
  function effWeather() {
    if (weather === 'monsoon') return 'monsoon';
    if (shower.active) return shower.intensity < 0.4 ? 'cloudy' : 'monsoon';
    return WX.cond;   // 'clear' | 'cloudy'
  }

  // nearest named place, for the HUD
  function nearestPlace() {
    let best = W.spawns[0], bd = Infinity;
    for (const sp of W.spawns) {
      const d = (sp.x - pos.x) ** 2 + (sp.z - pos.z) ** 2;
      if (d < bd) { bd = d; best = sp; }
    }
    return { name: best.label, dist: Math.sqrt(bd) };
  }

  function fmtClock(t) {
    const mins = Math.round(t * 24 * 60) % (24 * 60);
    let h = Math.floor(mins / 60); const m = mins % 60;
    const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  }
  function weatherReadout(nightF, ew) {
    const c = W.climate;
    const base = season === 'winter' ? c[1] : c[0];
    const range = season === 'winter' ? 12 : 15;
    const warm = 0.5 - 0.5 * Math.cos((tod - 0.21) * 2 * Math.PI);
    let t = (base - range) + range * warm;
    const day = nightF < 0.5;
    let label, icon;
    if (ew === 'monsoon') {
      const heavy = weather === 'monsoon' || shower.intensity >= 0.9;
      t -= heavy ? 7 : 4;
      label = weather === 'monsoon' ? (TROPICAL ? 'Monsoon Rain' : 'Heavy Rain')
        : heavy ? (TROPICAL ? 'Heavy Monsoon' : 'Downpour') : (TROPICAL ? 'Passing Monsoon' : 'Passing Shower');
      icon = heavy ? '⛈' : '🌧';
    } else if (ew === 'cloudy') {
      t -= 2; label = W.smog ? (season === 'winter' ? 'Heavy Smog' : 'Hazy · Smog') : W.humid ? 'Humid · Hazy' : (season === 'winter' ? 'Overcast' : 'Partly Cloudy'); icon = W.smog ? '😷' : '⛅';
    } else if (W.smog) { t += day ? 1 : 0; label = season === 'winter' ? 'Smog' : 'Hazy · Dusty'; icon = day ? '🌫' : '🌫'; }
    else if (!day) { label = 'Clear'; icon = '🌙'; }
    else { t += 2; label = (W.humid && season !== 'winter' && t >= 88) ? 'Hot & Humid' : (t >= 98 ? 'Scorching' : 'Sunny'); icon = '☀️'; }
    return `${Math.round(t)}°F · ${label} ${icon}`;
  }

  // --- frame loop -----------------------------------------------------------
  const clock = new THREE.Clock();
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  let hudAcc = 0;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    tod = (tod + (dt * timeScale) / DAY_LENGTH) % 1;
    if (MAP === 'railcorridor' || MAP === 'railride') globalThis.__railTod = tod;
    simTime += dt;
    updateAutoWeather(dt);
    updateShowers(dt);
    const ew = effWeather();

    // --- day/night ---
    const hour = tod * 24;
    const elev = Math.sin((hour - 6) / 12 * Math.PI);   // +1 noon, 0 at 6/18, <0 night
    const day = Math.max(0, elev);
    const nightF = Math.min(1, Math.max(0, -elev * 2 + 0.15));
    const dusk = Math.max(0, 1 - Math.abs(elev) * 4) * (hour > 4 && hour < 20 ? 1 : 0);
    // sun position
    const az = (hour / 24) * Math.PI * 2;
    sun.position.set(Math.cos(az) * 300, 60 + elev * 320, Math.sin(az) * 300 + 40);
    sun.target.position.copy(pos);
    const cloudy = ew === 'cloudy', wet = ew === 'monsoon';
    sun.intensity = (wet ? 0.25 : cloudy ? 0.7 : 1.5) * (0.15 + day);
    hemi.intensity = (wet ? 0.5 : cloudy ? 0.75 : 0.9) * (0.25 + day * 0.85);
    ambient.intensity = 0.12 + day * 0.12;

    // sky colour
    bg.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    if (dusk > 0.02 && !wet) bg.lerp(SKY_DUSK, dusk * 0.6);
    if (cloudy) bg.lerp(SKY_GRAY, 0.5 * day + 0.1);
    if (wet) bg.lerp(SKY_GRAY, 0.72 * (0.3 + day)).multiplyScalar(0.7);
    scene.background = bg;
    scene.fog.color.copy(FOG_DAY).lerp(SKY_NIGHT, nightF * 0.8);
    if (cloudy) scene.fog.color.lerp(SKY_GRAY, 0.4);
    if (wet) scene.fog.color.lerp(SKY_GRAY, 0.6).multiplyScalar(0.8);
    const targetFar = wet ? 260 : SMOG ? (cloudy ? half * 0.55 : half * 0.9) : cloudy ? half * 0.8 : half * 1.4;
    scene.fog.far += (targetFar * (1 - nightF * 0.35) - scene.fog.far) * Math.min(1, dt * 2);

    if (world.update) world.update(dt, simTime, nightF, pos);

    if ((MAP === 'railcorridor' || MAP === 'railride') && keys.KeyF && !keys._railF) {
      keys._railF = true;
      const result = world.board?.(pos);
      if (result?.message) { railNotice = result.message; railNoticeT = 3.5; }
    }
    if (!keys.KeyF) keys._railF = false;
    railNoticeT = Math.max(0, railNoticeT - dt);

    // --- turn with the arrow keys (Roblox-style), look with the mouse ---
    if (keys.ArrowLeft) yaw += 1.9 * dt;
    if (keys.ArrowRight) yaw -= 1.9 * dt;
    if (keys.KeyQ) yaw += 1.9 * dt;
    if (keys.KeyE) yaw -= 1.9 * dt;

    // --- movement (WASD + arrows fwd/back, relative to facing) ---
    fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    // Camera-facing right vector. The previous sign made A/D feel reversed
    // because this walking camera looks along +Z at yaw zero.
    right.set(-Math.cos(yaw), 0, Math.sin(yaw));
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) { mx += fwd.x; mz += fwd.z; }
    if (keys.KeyS || keys.ArrowDown) { mx -= fwd.x; mz -= fwd.z; }
    if (keys.KeyD) { mx += right.x; mz += right.z; }
    if (keys.KeyA) { mx -= right.x; mz -= right.z; }
    const moving = mx || mz;
    let stepped = 0;
    if (moving) {
      const len = Math.hypot(mx, mz);
      const spd = (keys.ShiftLeft || keys.ShiftRight ? 6.4 : 3.1);
      const nx = pos.x + (mx / len) * spd * dt;
      const nz = pos.z + (mz / len) * spd * dt;
      // clamp to world, block wading below the sea / world-defined no-go areas
      const cx = Math.max(-half, Math.min(half, nx));
      const cz = Math.max(-half, Math.min(half, nz));
      if (groundHeight(cx, cz) > seaLevel - 0.2 && !(world.blocked && world.blocked(cx, cz))) { pos.x = cx; pos.z = cz; stepped = spd; }
      yaw += 0; // body faces camera yaw
    }
    pos.y = groundHeight(pos.x, pos.z);

    // walk animation
    const ph = simTime * (stepped > 5 ? 11 : 8);
    const sw = moving ? Math.sin(ph) * 0.5 : 0;
    if (you.legs[0]) { you.legs[0].rotation.x = sw; you.legs[1].rotation.x = -sw; }
    if (you.arms[0]) { you.arms[0].rotation.x = -sw * 0.7; you.arms[1].rotation.x = sw * 0.7; }
    you.group.position.set(pos.x, pos.y + (moving ? Math.abs(Math.sin(ph)) * 0.03 : 0), pos.z);
    you.group.rotation.y = yaw + Math.PI;   // model +z forward → faces look dir
    you.group.visible = viewMode !== 0;

    // --- camera ---
    const headY = pos.y + EYE;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    if (viewMode === 0) {
      camera.position.set(pos.x, headY, pos.z);
      camera.lookAt(pos.x + dir.x, headY + dir.y, pos.z + dir.z);
    } else {
      const close = viewMode === 1;
      const dist = close ? 2.25 : 5.2;
      const lift = close ? 0.46 : 1.1;
      camera.position.set(pos.x - dir.x * dist + (close ? right.x * .34 : 0), headY + lift - dir.y * dist, pos.z - dir.z * dist + (close ? right.z * .34 : 0));
      camera.lookAt(pos.x + dir.x * (close ? 2.8 : 2), headY + (close ? .05 : -.2), pos.z + dir.z * (close ? 2.8 : 2));
    }
    camera.far = scene.fog.far + 4000;
    camera.updateProjectionMatrix();

    // --- rain ---
    rain.visible = wet;
    if (wet) {
      rain.position.copy(camera.position).add(new THREE.Vector3(0, -25, 0));
      const arr = rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_N; i++) {
        arr[i * 3 + 1] -= (34 + (i % 6)) * dt;
        if (arr[i * 3 + 1] < 0) { arr[i * 3 + 1] = 60; arr[i * 3] = (Math.random() - 0.5) * 120; arr[i * 3 + 2] = (Math.random() - 0.5) * 120; }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // --- HUD ---
    hudAcc += dt;
    if (hudAcc > 0.15) {
      hudAcc = 0;
      const np = nearestPlace();
      elSpeed.innerHTML = (MAP === 'railcorridor' || MAP === 'railride') ? world.placeName() : np.name;
      const era = { modern: 'Present Day', antebellum: 'c. 1840s', mughal: 'c. 1650s' }[W.era] || 'c. 1920s';
      elMeta.textContent = `${W.region}, ${W.state} · ${era}`;
      elZone.textContent = railNoticeT > 0 ? railNotice : ((MAP === 'railcorridor' || MAP === 'railride') ? world.status(pos) : (np.dist < 22 ? np.name : (W.era === 'modern' ? W.region : `${W.region} Countryside`)));
      elClock.textContent = fmtClock(tod) + (timeScale > 1 ? '  ⏩' : '');
      elWeather.textContent = weatherReadout(nightF, ew);
    }

    renderer.render(scene, camera);
  }
  frame();
}
