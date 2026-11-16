import * as THREE from 'three';
import { Villagers, buildHuman } from './villagers.js';

export const RAIL_STATIONS = [
  ['howrah', 'Howrah · Kolkata', 'bengal', 'megacity'], ['bardhaman', 'Bardhaman · West Bengal', 'bengal', 'town'],
  ['asansol', 'Asansol Junction', 'bengal', 'industrial'], ['dhanbad', 'Dhanbad Junction · Jharkhand', 'bihar', 'industrial'],
  ['gaya', 'Gaya Junction · Bihar', 'bihar', 'town'], ['dehri', 'Dehri-on-Sone', 'bihar', 'small'],
  ['ddun', 'DDU Junction · UP', 'up', 'industrial'], ['prayagraj', 'Prayagraj Junction', 'up', 'megacity'],
  ['kanpur', 'Kanpur Central', 'up', 'megacity'], ['etawah', 'Etawah', 'up', 'small'],
  ['aligarh', 'Aligarh Junction', 'up', 'town'], ['delhi', 'New Delhi', 'delhi', 'megacity'],
  ['panipat', 'Panipat', 'delhi', 'industrial'], ['ambala', 'Ambala Cantt', 'punjab', 'town'],
  ['ludhiana', 'Ludhiana Junction', 'punjab', 'megacity'], ['jalandhar', 'Jalandhar City', 'punjab', 'town'],
  ['amritsar', 'Amritsar Terminus', 'punjab', 'megacity'],
].map(([key, label, region, kind]) => ({ key, label, region, kind }));

const mat = (c, opts = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, ...opts });
const box = (p, w, h, d, c, x, y, z, opts = {}) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, opts)); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; p.add(m); return m; };
function label(p, text, x, z, color = 0xffd83d) { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d'); c.fillStyle = '#131313'; c.fillRect(0, 0, 512, 96); c.fillStyle = `#${color.toString(16).padStart(6, '0')}`; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText(text, 256, 60); const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide })); m.position.set(x, 5.4, z); m.rotation.y = Math.PI; p.add(m); }
function tree(p, x, z, s = 1) { box(p, .45 * s, 2.7 * s, .45 * s, 0x5a351d, x, 0, z); const c = new THREE.Mesh(new THREE.SphereGeometry(2.1 * s, 8, 6), mat(0x2f6c3e)); c.position.set(x, 4 * s, z); c.castShadow = true; p.add(c); }

function trainExterior() { const g = new THREE.Group(); box(g, 10, 3.3, 4.1, 0x8b1e25, 0, .8, 0); box(g, 10, .16, 4.3, 0xd7c9a7, 0, 4.18, 0); box(g, 10, .12, 4.3, 0xe3ae21, 0, 2.15, 0); for (const x of [-3.5, -1.2, 1.2, 3.5]) for (const z of [-2.11, 2.11]) box(g, 1.25, 1.1, .08, 0x52758a, x, 2.25, z, { metalness: .15, roughness: .25 }); for (const x of [-5, 5]) box(g, .18, 3.1, 4.2, 0x1d2024, x, 1, 0); return g; }
function coachInterior(train, region = 'up') { const g = new THREE.Group(); g.position.set(0, 0, -9); train.add(g); box(g, 28, .14, 5.8, 0x6f6250, 0, 0, 0); box(g, 28, .12, 5.8, 0x8d8271, 0, 4.1, 0); box(g, 28, 1.1, .12, 0xd4c9aa, 0, .3, -2.9); box(g, 28, 1.1, .12, 0xd4c9aa, 0, .3, 2.9); for (const x of [-12, -8, -4, 0, 4, 8, 12]) for (const z of [-2.9, 2.9]) { box(g, .12, 2.3, .12, 0x55504a, x, 1.3, z); const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), new THREE.MeshStandardMaterial({ color: 0x8eb7c0, emissive: 0x28434c, emissiveIntensity: .18, transparent: true, opacity: .58, roughness: .25, depthWrite: false })); pane.position.set(x, 2.3, z + (z < 0 ? -.03 : .03)); pane.rotation.y = z < 0 ? 0 : Math.PI; g.add(pane); } for (const x of [-10.5, -7, -3.5, 0, 3.5, 7, 10.5]) { box(g, 2.8, .55, .95, 0x6f3541, x, .72, -2.05); box(g, 2.8, .55, .95, 0x6f3541, x, .72, 2.05); box(g, 2.8, 1.7, .18, 0x8b4e58, x, 1, -2.48); box(g, 2.8, 1.7, .18, 0x8b4e58, x, 1, 2.48); } for (const x of [-10, -5, 0, 5, 10]) { const glow = new THREE.Mesh(new THREE.BoxGeometry(1.5, .06, .35), new THREE.MeshBasicMaterial({ color: 0xffd98a })); glow.position.set(x, 3.95, 0); g.add(glow); const light = new THREE.PointLight(0xffd7a0, 1.4, 12); light.position.set(x, 3.3, 0); g.add(light); }
  const skin = region === 'bengal' ? [0x5f351b, 0x6b3d18, 0x7a4a1e] : region === 'punjab' ? [0x8d5524, 0xa06a34, 0xb07840] : [0x6b3d18, 0x7a4a1e, 0x8d5524];
  const tops = [0x365d62, 0x6a7a8a, 0xc21f2f, 0xd8c8a0, 0x2a5a6a, 0x7a3a3a];
  for (let i = 0; i < 16; i++) { const female = i % 5 === 0; const sikh = region === 'punjab' && i % 3 === 0; const h = buildHuman({ skin: skin[i % skin.length], top: female ? undefined : tops[i % tops.length], bottom: 0x2a2a2a, female, saree: female ? [0xc21f2f, 0x903070, 0x207040, 0xd08010][i % 4] : undefined, headwrap: female && i % 2 === 0 ? 0xf2efe4 : null, turban: sikh ? [0x1a3a6b, 0xd08010, 0xc21f2f][i % 3] : null, tall: sikh ? 1.05 : .92 + (i % 4) * .02 }); const x = -12 + (i % 7) * 4; const z = i % 2 ? 1.72 : -1.72; h.group.position.set(x, .72, z); h.group.rotation.y = z > 0 ? Math.PI : 0; h.group.scale.multiplyScalar(.84); if (h.legs[0]) { h.legs[0].rotation.x = .9; h.legs[1].rotation.x = -.9; } g.add(h.group); }
  for (let i = 0; i < 6; i++) { const sack = new THREE.Mesh(new THREE.SphereGeometry(.45 + (i % 2) * .18, 8, 6), mat(i % 2 ? 0x806441 : 0x5f4936)); sack.scale.y = 1.3; sack.position.set(-11 + i * 4.4, 1.3, i % 2 ? -2.35 : 2.35); g.add(sack); }
}

function legacyBuildRailCorridor(scene, { ride = false } = {}) {
  const q = new URLSearchParams(location.search); const selected = RAIL_STATIONS.find(s => s.key === q.get('station')) || RAIL_STATIONS[0]; const root = new THREE.Group(); scene.add(root); const props = [];
  function gh(x, z) { return .2 + Math.sin(x * .01) * .16 + Math.cos(z * .012) * .12; }
  const geo = new THREE.PlaneGeometry(1100, 900, 90, 70); geo.rotateX(-Math.PI / 2); const a = geo.attributes.position; const colors = new Float32Array(a.count * 3);
  for (let i = 0; i < a.count; i++) { const x = a.getX(i), z = a.getZ(i); a.setY(i, gh(x, z)); const c = new THREE.Color(z < -250 ? 0x71805b : ((Math.floor((x + z) / 18) % 2) ? 0x9a9a55 : 0xb09a70)); colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals(); const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.receiveShadow = true; root.add(ground);
  if (['howrah', 'dehri', 'prayagraj'].includes(selected.key)) { const river = new THREE.Mesh(new THREE.PlaneGeometry(1000, 180), mat(0x4b7080, { roughness: .3, metalness: .12 })); river.rotation.x = -Math.PI / 2; river.position.set(0, -1, -390); root.add(river); for (let x = -500; x <= 500; x += 35) tree(root, x, -280 + (x % 4) * 6, 1.1); }
  box(root, 1100, .1, 12, 0x343434, 0, 0, 0); for (let x = -540; x <= 540; x += 4) box(root, 1.1, .12, 13, 0x6e6250, x, .08, 0); for (const z of [-2.2, 2.2]) box(root, 1100, .18, .18, 0x8b8d8d, 0, .3, z);
  box(root, 94, .3, 13, 0xb9a98a, 0, .35, 11); box(root, 88, .14, 8, 0x536b5d, 0, 5.3, 11); for (let x = -36; x <= 36; x += 12) box(root, .25, 5, .25, 0x3d4641, x, .5, 8); label(root, selected.label, 0, 11);
  const city = selected.kind === 'megacity', industrial = selected.kind === 'industrial', small = selected.kind === 'small';
  box(root, 360, .08, 13, 0x292b2e, 0, .03, 73); box(root, 13, .08, 250, 0x292b2e, -90, .04, 90); box(root, 13, .08, 250, 0x292b2e, 90, .04, 90);
  for (let i = -10; i <= 10; i++) { const z = 45 + (Math.abs(i) % 4) * 19; const h = city ? 10 + (i % 5) * 3 : industrial ? 6 + (i % 3) * 2 : small ? 2.4 : 4 + (i % 4) * 2; const c = small ? 0x7e654b : (i % 3 ? 0x9c8467 : 0x5c87a0); box(root, 18 + (Math.abs(i) % 3) * 5, h, 15, c, i * 22, 0, z); if (i % 3 === 0) label(root, small ? 'CHAI' : (industrial ? 'MILL' : 'BAZAAR'), i * 22, z + 8, 0xf0e6cf); }
  if (city) { for (let row = 0; row < 5; row++) for (let i = -13; i <= 13; i++) { const x = i * 8 + (row % 2) * 3, z = 125 + row * 8; box(root, 5.8, 2.1 + ((i + row) % 3) * .3, 5, i % 3 ? 0x8c5940 : 0x5d665e, x, 0, z); box(root, 6.5, .12, 5.8, (i + row) % 2 ? 0x2a5a86 : 0x7a6a5a, x, 2.35, z); } for (let i = -3; i <= 3; i++) box(root, 10, 22 + (i % 2) * 8, 10, 0x547a8c, i * 30, 0, -100, { roughness: .42 }); }
  if (industrial) for (let i = -3; i <= 3; i++) { box(root, 25, 6 + (i % 2), 20, 0x806d5f, i * 34, 0, 165); box(root, 2.5, 34 + (i % 3) * 7, 2.5, 0x6a5c52, i * 34 + 8, 0, 148); }
  if (small) for (let i = -9; i <= 9; i++) { box(root, 2.2, .05, 65, 0x647b40, i * 11, .08, 175); if (i % 3 === 0) tree(root, i * 11 + 4, 150, .9); }
  const worship = selected.region === 'punjab' ? 'GURDWARA' : (selected.region === 'bihar' || selected.region === 'up' ? 'MASJID' : 'MANDIR'); label(root, worship, -44, 42, worship === 'GURDWARA' ? 0xf4d35e : 0xf0e6cf); label(root, selected.key === 'delhi' || selected.key === 'howrah' ? 'BIRYANI · RESTAURANT' : 'CHAI · DHABA', 44, 42, 0xf0e6cf); for (let x = -450; x <= 450; x += 55) { tree(root, x, 230 + (x % 5) * 12, .8); tree(root, x + 20, -120, .65); }
  const roleM = selected.region === 'bengal' ? 'rail_bengal_m' : selected.region === 'bihar' ? 'rail_bihar_m' : selected.region === 'up' ? 'rail_up_m' : selected.region === 'punjab' ? 'rail_sikh_m' : 'rail_delhi_m'; const roleF = selected.region === 'bengal' ? 'rail_bengal_f' : selected.region === 'bihar' ? 'rail_bihar_f' : selected.region === 'up' ? 'rail_up_f' : 'rail_delhi_f'; const crowd = city ? 1.9 : industrial ? 1.5 : 1;
  const people = new Villagers(scene, 'delhislum', gh, [{ role: roleM, region: `rail_${selected.region}`, count: Math.round(14 * crowd), x: 0, z: 18, spread: 38, idle: .3 }, { role: roleF, region: `rail_${selected.region}`, count: Math.round(10 * crowd), x: 15, z: -18, spread: 34, idle: .4 }, { role: 'delhi_vendor', region: `rail_${selected.region}`, count: Math.round(8 * crowd), x: -25, z: 38, spread: 25, idle: .65 }, { role: 'delhi_laborer', region: `rail_${selected.region}`, count: Math.round((industrial ? 9 : 4) * crowd), x: 35, z: 48, spread: 32, idle: .4 }, ...((selected.region === 'bihar' || selected.region === 'up') ? [{ role: 'rail_muslim_f', region: `rail_${selected.region}`, count: Math.round(4 * crowd), x: -8, z: 42, spread: 22, idle: .45 }] : [])], 191);
  const train = new THREE.Group(); root.add(train); for (let i = -3; i <= 3; i++) { const c = trainExterior(); c.position.x = i * 12; train.add(c); if (i === 0) coachInterior(c, selected.region); }
  for (let i = 0; i < 50; i++) props.push(box(root, 7 + (i % 4), 1.5 + (i % 5), 7 + (i % 3), i % 3 ? 0x84904f : 0x9c8467, -520 + i * 21, 0, -80 - (i % 8) * 30));
  let onboard = ride, seated = false;
  function board(pos) { if (onboard) { if (!ride && Math.abs(pos.x) < 80) { onboard = false; pos.z = 18; return { message: `OFF TRAIN · ${selected.label}` }; } seated = !seated; return { message: seated ? 'SEATED · lower-class bench' : 'STANDING · coach aisle' }; } if (Math.abs(pos.x) > 90 || Math.abs(pos.z) > 60) return { message: 'Walk to the platform to board.' }; onboard = true; pos.x = 0; pos.z = -9; return { message: `BOARDED · ${selected.label} · find a bench with F` }; }
  return { groundHeight: gh, blocked: () => false, board, status: () => onboard ? `ON TRAIN · ${selected.label} · coach aisle / seats` : `${selected.label} · platform · hourly service`, update(dt, simTime, nightF, pos) { people.update(dt, pos); if (onboard) { pos.x = 0; if (ride) for (const o of props) { o.position.x -= dt * 18; if (o.position.x < -560) o.position.x = 560; } } } };
}
function legacyBuildRailRide(scene) { return legacyBuildRailCorridor(scene, { ride: true }); }

// ==========================================================================
// Detailed Howrah–Amritsar rail experience. The small legacy builder above is
// intentionally retained as a readable reference while this data-driven pass
// replaces it at the public exports below.
// ==========================================================================

const RAIL_PROFILES = {
  howrah:      { soil:0x756b49, field:0x608044, foliage:0x2e7042, density:1.00, industry:.38, informal:.62, water:1, humid:1, roofs:0x765340, accent:0xb83b28, signature:'HOWRAH TERMINAL · HOOGHLY' },
  bardhaman:   { soil:0x87724b, field:0x6f8c3f, foliage:0x397947, density:.40, industry:.15, informal:.26, water:.55, humid:1, roofs:0x82543a, accent:0x227046, signature:'RICE · PONDS · AGRICULTURAL TRADE' },
  asansol:     { soil:0x795344, field:0x6f7141, foliage:0x4d6939, density:.58, industry:.92, informal:.48, water:.05, dry:1, roofs:0x584c47, accent:0xb14b28, signature:'STEEL · COAL · RAILWAY COLONY' },
  dhanbad:     { soil:0x514641, field:0x5d673c, foliage:0x405b37, density:.66, industry:1.0, informal:.72, water:.04, dry:1, roofs:0x4b4642, accent:0xd66b28, signature:'COAL CAPITAL · FREIGHT YARDS' },
  gaya:        { soil:0x9b714c, field:0x817a43, foliage:0x48663a, density:.48, industry:.16, informal:.38, water:.12, dry:1, roofs:0x8b5738, accent:0xc45a2d, signature:'PILGRIM CITY · ROCKY HORIZON' },
  dehri:       { soil:0xaa805b, field:0x7f8847, foliage:0x477044, density:.24, industry:.22, informal:.30, water:1, sand:1, roofs:0x8e6243, accent:0x2f70a0, signature:'SON RIVER · SANDBANKS · BRIDGE' },
  ddun:        { soil:0x9a7652, field:0x788647, foliage:0x447041, density:.44, industry:.86, informal:.50, water:.08, roofs:0x755746, accent:0xd08a25, signature:'DDU JUNCTION · GREAT RAIL YARD' },
  prayagraj:   { soil:0x9c7954, field:0x778c4a, foliage:0x397349, density:.76, industry:.25, informal:.48, water:1, sand:1, roofs:0x8b654b, accent:0xd88625, signature:'GANGA–YAMUNA PLAIN · CIVIC CITY' },
  kanpur:      { soil:0x806b52, field:0x707d43, foliage:0x3f6840, density:.94, industry:.88, informal:.74, water:.52, haze:1, roofs:0x68564c, accent:0x9f3326, signature:'MILLS · LEATHER · INDUSTRIAL SPRAWL' },
  etawah:      { soil:0xa07855, field:0x7e8c48, foliage:0x477044, density:.28, industry:.16, informal:.27, water:.22, ravine:1, roofs:0x986344, accent:0x3f75a0, signature:'CHAMBAL EDGE · MANDI TOWN' },
  aligarh:     { soil:0x97714f, field:0x758d47, foliage:0x3f7244, density:.60, industry:.52, informal:.44, water:.10, roofs:0x8e5d40, accent:0x3d6f8e, signature:'LOCK WORKSHOPS · UNIVERSITY CITY' },
  delhi:       { soil:0x92775d, field:0x777a4a, foliage:0x496b45, density:1.22, industry:.62, informal:.92, water:.35, haze:1, metro:1, roofs:0x6f6257, accent:0xb13b2c, signature:'NEW DELHI · METRO · CAPITAL SPRAWL' },
  panipat:     { soil:0x9a7753, field:0x7c9147, foliage:0x477548, density:.57, industry:.82, informal:.42, water:.14, roofs:0x786052, accent:0xc06b24, signature:'TEXTILES · WAREHOUSES · GRAND TRUNK ROAD' },
  ambala:      { soil:0x947856, field:0x71964a, foliage:0x3f7749, density:.45, industry:.30, informal:.20, water:.20, cantonment:1, roofs:0x79644e, accent:0x2c6b58, signature:'CANTONMENT · RAILWAY COLONY' },
  ludhiana:    { soil:0x967955, field:0x6e9b46, foliage:0x3c7646, density:.88, industry:.94, informal:.46, water:.14, roofs:0x725d50, accent:0x2e7192, signature:'FACTORIES · HOSIERY · CYCLE WORKS' },
  jalandhar:   { soil:0x987b56, field:0x70a047, foliage:0x397745, density:.62, industry:.57, informal:.28, water:.13, roofs:0x81644e, accent:0xb6522f, signature:'SPORTS GOODS · COLONIES · DOAB' },
  amritsar:    { soil:0x9b7b53, field:0x6fa247, foliage:0x397a45, density:.89, industry:.35, informal:.38, water:.15, pilgrim:1, roofs:0x8a664b, accent:0xd29a22, signature:'AMRITSAR · WALLED CITY · PILGRIM TERMINUS' },
};

export const ROUTE_SEGMENTS = RAIL_STATIONS.slice(0, -1).map((from, i) => {
  const to = RAIL_STATIONS[i + 1];
  const distances = [95,106,58,200,85,118,153,198,139,125,132,90,109,113,59,83];
  return { from:from.key, to:to.key, km:distances[i], run:48 + Math.min(34, distances[i] * .14) };
});
const NATIVE_STATION_NAMES={howrah:'হাওড়া',bardhaman:'বর্ধমান',asansol:'আসানসোল',dhanbad:'धनबाद',gaya:'गया',dehri:'डेहरी',ddun:'पं. दीन दयाल उपाध्याय',prayagraj:'प्रयागराज',kanpur:'कानपुर',etawah:'इटावा',aligarh:'अलीगढ़',delhi:'नई दिल्ली',panipat:'पानीपत',ambala:'अंबाला',ludhiana:'ਲੁਧਿਆਣਾ',jalandhar:'ਜਲੰਧਰ',amritsar:'ਅੰਮ੍ਰਿਤਸਰ'};

const textureCache=new Map();
function surfaceTexture(kind='plaster'){
  if(textureCache.has(kind))return textureCache.get(kind);
  const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');
  const base={plaster:'#b8aa91',brick:'#9b6047',metal:'#657076',road:'#55534e',earth:'#887052',platform:'#a99e88'}[kind]||'#aaa';c.fillStyle=base;c.fillRect(0,0,128,128);
  const rnd=seeded(hashKey(kind));for(let i=0;i<900;i++){const a=.025+rnd()*.09;c.fillStyle=`rgba(${rnd()<.5?20:255},${rnd()<.5?20:255},${rnd()<.5?20:255},${a})`;c.fillRect(rnd()*128,rnd()*128,1+rnd()*3,1+rnd()*2);}
  if(kind==='brick'){c.strokeStyle='rgba(45,25,18,.28)';c.lineWidth=2;for(let y=0;y<128;y+=16){c.beginPath();c.moveTo(0,y);c.lineTo(128,y);c.stroke();for(let x=(y/16)%2?0:16;x<128;x+=32){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+16);c.stroke();}}}
  if(kind==='metal'){c.strokeStyle='rgba(230,240,240,.18)';for(let x=0;x<128;x+=9){c.beginPath();c.moveTo(x,0);c.lineTo(x,128);c.stroke();}}
  if(kind==='road'){c.fillStyle='rgba(15,15,15,.22)';for(let i=0;i<90;i++)c.fillRect(rnd()*128,rnd()*128,1+rnd()*8,1);}
  if(kind==='plaster'){c.strokeStyle='rgba(55,40,30,.2)';for(let i=0;i<14;i++){const x=rnd()*128,y=rnd()*128;c.beginPath();c.moveTo(x,y);c.lineTo(x+(rnd()-.5)*22,y+rnd()*28);c.stroke();}}
  const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;tx.wrapS=tx.wrapT=THREE.RepeatWrapping;tx.repeat.set(3,3);tx.anisotropy=4;textureCache.set(kind,tx);return tx;
}
const rMat = (color, options={}) => {const{surface,...rest}=options;return new THREE.MeshStandardMaterial({color,roughness:.86,metalness:0,...(surface?{map:surfaceTexture(surface)}:{}),...rest});};
function rBox(parent, w,h,d,color,x=0,y=0,z=0, options={}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), rMat(color,options));
  mesh.position.set(x,y+h/2,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function rFarBox(parent,w,h,d,color,x=0,y=0,z=0,rot=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),rMat(color));mesh.position.set(x,y+h/2,z);mesh.rotation.y=rot;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function rCylinder(parent, rt, rb, h, color, x,y,z, sides=12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,sides),rMat(color));
  mesh.position.set(x,y+h/2,z); mesh.castShadow=true; parent.add(mesh); return mesh;
}
function seeded(seed) { let s=seed>>>0; return () => ((s=Math.imul(1664525,s)+1013904223>>>0)/4294967296); }
function hashKey(key) { let h=2166136261; for (const c of key) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
function canvasLabel(text, fg='#f4cf32', bg='#172027', w=768, h=128) {
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const c=cv.getContext('2d');
  c.fillStyle=bg; c.fillRect(0,0,w,h); c.strokeStyle='#eee'; c.lineWidth=6; c.strokeRect(5,5,w-10,h-10);
  c.fillStyle=fg; c.font='bold 42px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(text, w/2,h/2);
  const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; return tx;
}
function rLabel(parent,text,x,y,z,scale=1,rot=0,fg='#f4cf32',bg='#172027') {
  const m=new THREE.Mesh(new THREE.PlaneGeometry(11*scale,1.8*scale),new THREE.MeshBasicMaterial({map:canvasLabel(text,fg,bg),side:THREE.DoubleSide}));
  m.position.set(x,y,z); m.rotation.y=rot; parent.add(m); return m;
}
function railTree(parent,x,z,s=1,type='broad') {
  rCylinder(parent,.16*s,.25*s,2.9*s,0x654429,x,0,z,8);
  if(type==='poplar') { const crown=new THREE.Mesh(new THREE.CylinderGeometry(.3*s,1.05*s,5.2*s,8),rMat(0x397544)); crown.position.set(x,5.1*s,z); crown.castShadow=true; parent.add(crown); }
  else { for(const [dx,dy,dz,k] of [[0,3.5,0,1.2],[-.8,3.3,.1,.75],[.7,3.7,.2,.8]]) { const crown=new THREE.Mesh(new THREE.SphereGeometry(k*s,9,7),rMat(type==='palm'?0x397c46:0x356f3d)); crown.position.set(x+dx*s,dy*s,z+dz*s); crown.castShadow=true; parent.add(crown); } }
}
function addTrack(parent,z,length=1200) {
  rBox(parent,length,.18,7.2,0x554c42,0,-.02,z);
  for(let x=-length/2;x<=length/2;x+=1.8) rBox(parent,.35,.16,6.8,0x71604b,x,.07,z);
  for(const dz of [-2.05,2.05]) rBox(parent,length,.16,.13,0x9fa3a0,0,.24,z+dz,{metalness:.72,roughness:.28});
}
function addSignal(parent,x,z,flip=1) {
  rBox(parent,.35,5,.35,0x414744,x,0,z); rBox(parent,1.2,2,.55,0x202524,x,4.7,z);
  for(let i=0;i<3;i++){ const lamp=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),new THREE.MeshBasicMaterial({color:i===0?0xe33b27:0x26352a})); lamp.position.set(x,6.35-i*.58,z+flip*.31); parent.add(lamp); }
}
function addRoad(parent,x,z,w,d,rot=0) {
  const road=rBox(parent,w,.08,d,0x343638,x,.05,z); road.rotation.y=rot;
  const line=rBox(parent,w*.92,.015,.12,0xd9bd67,x,.14,z); line.rotation.y=rot; return road;
}
function addStreet(parent,x,z,w,d,rot=0,paved=true) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=rot; parent.add(g);
  rBox(g,w,.09,d,paved?0x3e4141:0x81684e,0,.03,0,{surface:paved?'road':'earth'});
  if(paved){ rBox(g,w,.025,.1,0xd0b65c,0,.14,0); for(const side of [-1,1]){rBox(g,w,.18,1.45,0x9b927e,0,.08,side*(d/2+.72));rBox(g,w,.14,.18,0x5e5b54,0,.25,side*(d/2+.08));} }
  return g;
}
function addPath(parent,x,z,w,d,rot=0) { const p=rBox(parent,w,.035,d,0x9c7f5d,x,.04,z); p.rotation.y=rot; return p; }
function addDrain(parent,x,z,length,rot=0) { const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);rBox(g,length,.18,.8,0x5b554b,0,-.12,0);rBox(g,length,.025,.42,0x314c45,0,.07,0);for(let q=-length/2;q<length/2;q+=4)rBox(g,.08,.08,.8,0x575b58,q,.08,0,{metalness:.35}); }
function addUtilityLine(parent,x,z,length,rot=0) {
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);
  for(let q=-length/2;q<=length/2;q+=22){rBox(g,.3,7.2,.3,0x625c50,q,0,0);rBox(g,3.1,.15,.18,0x4d4d48,q,6.55,0);for(const dz of [-1.2,0,1.2])rCylinder(g,.09,.09,.22,0x9c8d72,q,6.68,dz,8);}
  for(const dz of [-1.2,0,1.2])rBox(g,length,.025,.025,0x262a2b,0,6.72,dz,{metalness:.55});
}
function addRoadVehicle(parent,x,z,color=0x2d698c,rot=0,type='auto') {
  const g=new THREE.Group();g.position.set(x,.2,z);g.rotation.y=rot;parent.add(g);
  if(type==='bus'){rBox(g,8,2.8,2.7,color,0,.3,0);rBox(g,7.1,1.1,.08,0x5b8290,0,1.62,1.36,{roughness:.25});for(const dx of [-2.6,2.6])for(const dz of [-1.25,1.25])rCylinder(g,.42,.42,.22,0x202225,dx,.1,dz,12);}
  else if(type==='truck'){rBox(g,3.3,2.5,2.6,color,-2,.2,0);rBox(g,4.7,2.7,2.8,0x756b58,2,.2,0);for(const dx of [-2.6,2.6])for(const dz of [-1.25,1.25])rCylinder(g,.4,.4,.2,0x202225,dx,.05,dz,12);}
  else {rBox(g,2.8,1.6,1.55,color,0,.15,0);rBox(g,1.9,.08,1.65,0xdbc62e,0,1.78,0);for(const dx of [-.9,.9])for(const dz of [-.72,.72])rCylinder(g,.3,.3,.16,0x202225,dx,.02,dz,12);}return g;
}
function addShop(parent,x,z,w,h,color,name,rot=0) {
  const g=new THREE.Group(); g.position.set(x,0,z); g.rotation.y=rot; parent.add(g);
  rBox(g,w,h,5.5,color,0,0,0,{surface:'plaster'}); rBox(g,w+.5,.16,6.2,0x665449,0,h,0,{surface:'metal'});
  rBox(g,w*.7,2.1,.12,0x25292a,0,.2,2.82); rBox(g,w*.32,1.6,.15,0x68a4ab,-w*.25,.35,2.9,{roughness:.2});
  const awn=rBox(g,w*.9,.12,1.5,0xb44b35,0,2.55,3.3); awn.rotation.x=-.18;
  if(name) rLabel(g,name,0,h-.65,2.86,Math.min(1,w/8),0,'#fff','#8c3028'); return g;
}
function addHouse(parent,x,z,w,h,color,roof,stories=1) {
  const total=h*stories; rBox(parent,w,total,w*.72,color,x,0,z,{surface:(Math.abs((x+z)|0)%4===0)?'brick':'plaster'}); rBox(parent,w+.45,.18,w*.78,roof,x,total,z,{surface:'metal'});
  for(let s=0;s<stories;s++) for(const dx of [-w*.24,w*.24]) rBox(parent,w*.18,.75,.08,0x456575,x+dx,.8+s*h,z+w*.365,{roughness:.25,metalness:.08});
  if(stories>1) rBox(parent,w*.64,.12,1.0,0x5f5a51,x,h-.1,z+w*.58);
  if(stories>1&&Math.abs(x|0)%3===0){rBox(parent,.65,.55,.28,0xc8c2b4,x+w*.28,h+.7,z+w*.38);rBox(parent,.72,.08,.35,0x525b5e,x+w*.28,h+.7,z+w*.57);}
  for(let s=0;s<stories;s++)if((s+Math.abs(x|0))%2===0)rBox(parent,w*.72,.045,.045,0x292d2d,x,s*h+2.3,z+w*.41);
  if(Math.abs((x+z)|0)%3===0){ rCylinder(parent,.28,.38,1.15,0x292d32,x,total+.18,z,14); }
}
function addIndustry(parent,x,z,p,rnd) {
  const w=18+rnd()*18, h=5+rnd()*5; rBox(parent,w,h,15,0x756e65,x,0,z,{surface:'brick'}); rBox(parent,w+1,.22,16,0x4b5152,x,h,z,{surface:'metal'});
  for(let i=-1;i<=1;i++) rBox(parent,w*.18,2.2,.12,0x53717b,x+i*w*.27,1.2,z+7.56,{metalness:.2,roughness:.3});
  rCylinder(parent,.65,.95,18+rnd()*18,0x625a54,x+w*.28,0,z-5,12);
}
function addField(parent,x,z,w,d,color,rnd,profile) {
  rBox(parent,w,.06,d,color,x,.04,z); for(let k=0;k<8;k++) rBox(parent,w*.88,.03,.08,k%2?0xb6a953:0x507d3d,x,.11,z-d*.38+k*d*.11);
  if(profile.water && rnd()<.28){ const pond=new THREE.Mesh(new THREE.CircleGeometry(Math.min(w,d)*.18,18),rMat(0x4c7b86,{metalness:.18,roughness:.3})); pond.rotation.x=-Math.PI/2; pond.position.set(x,.16,z); parent.add(pond); }
}
function addWorship(parent,x,z,region,key) {
  if(region==='punjab') { rBox(parent,10,4.4,10,0xf2eee1,x,0,z); rCylinder(parent,.3,2.8,2.2,0xd6a728,x,4.4,z,16); rCylinder(parent,0,.55,1.5,0xd6a728,x,6.6,z,12); rBox(parent,12,.16,12,0xe3c55f,x,.1,z); }
  else if(key==='howrah'||key==='bardhaman'){ rBox(parent,9,4,8,0xb34b32,x,0,z); for(const dx of [-2.5,0,2.5]) rCylinder(parent,0,.75,4,0xd7a440,x+dx,4,z,12); }
  else { rBox(parent,10,4,8,0xe7ded0,x,0,z); for(const dx of [-3.3,3.3]){rCylinder(parent,.3,.45,6,0xe7ded0,x+dx,4,z,12);rCylinder(parent,0,.65,1.4,0x3b7453,x+dx,10,z,12);} rCylinder(parent,.1,2.4,1.9,0x3b7453,x,4,z,16); }
}
function buildStation(parent,station,profile,rnd,ride=false) {
  const major=station.kind==='megacity'||['ddun','dhanbad'].includes(station.key),small=station.kind==='small';
  const platformZ=ride?8.2:10.5,len=ride?230:major?285:small?125:195,depth=major?11:small?6.5:8.5;
  rBox(parent,len,.7,depth,0xb6a98f,0,.05,platformZ);rBox(parent,len,.18,.35,0xf0d34c,0,.76,platformZ-depth/2+.18);
  const canopyStart=small?-len*.18:-len/2+8,canopyEnd=small?len*.18:len/2;
  for(let x=canopyStart;x<canopyEnd;x+=major?10:small?14:12){rBox(parent,.28,major?5.2:4.3,.28,0x3f4b4d,x,.75,platformZ);rBox(parent,major?9.6:small?9:11.5,.12,small?4.4:major?8.5:6.4,station.key==='howrah'?0x6d4230:station.key==='amritsar'?0x6a765f:0x4f6867,x,major?5.9:5.02,platformZ);}
  // Station buildings differ in mass and architectural silhouette.
  if(station.key==='howrah'){rBox(parent,170,14,28,0xa45d3f,0,0,31);for(let x=-72;x<=72;x+=18)rCylinder(parent,1.2,1.2,7,0xd8b184,x,14,31,12);rBox(parent,185,.5,31,0x654232,0,21,31);}
  else if(station.key==='delhi'){rBox(parent,210,11,26,0xd8d0c0,0,0,32);for(let x=-90;x<=90;x+=15)rBox(parent,8,5,.2,0x547887,x,3.4,18.9,{roughness:.25});rBox(parent,220,.35,29,0x7a5945,0,11,32);}
  else if(station.key==='amritsar'){rBox(parent,145,9,24,0xd8c29a,0,0,31);rCylinder(parent,.4,4.2,3.4,0xd7a52f,0,9,31,18);for(const x of [-58,58])rCylinder(parent,.2,2.1,2.2,0xd7a52f,x,9,31,16);}
  else if(small){rBox(parent,46,5.5,15,0xc5a477,-24,0,29);rBox(parent,50,.25,17,0x845b3d,-24,5.5,29);}
  else if(station.kind==='industrial'){rBox(parent,92,7,19,0x8a7765,35,0,30);rBox(parent,96,.3,21,0x555b5b,35,7,30);}
  else{rBox(parent,78,6.5,18,station.region==='punjab'?0xd6c6a4:0xb8946b,-35,0,30);rBox(parent,82,.25,20,profile.roofs,-35,6.5,30);}
  rLabel(parent,`${station.label.toUpperCase()} · ${NATIVE_STATION_NAMES[station.key]}`,0,4.25,platformZ-depth/2-.24,1.08,0,'#ffe04b','#173c78');
  rLabel(parent,profile.signature,0,2.0,platformZ-depth/2-.26,.78,0,'#fff','#8b3829');
  for(const x of [-70,-35,35,70]){ rBox(parent,4.5,.45,1.3,0x74583c,x,.8,platformZ); rBox(parent,.22,.7,.22,0x383a39,x-1.7,.1,platformZ); rBox(parent,.22,.7,.22,0x383a39,x+1.7,.1,platformZ); }
  rCylinder(parent,1.05,1.05,.18,0xf2ead5,-18,4.3,platformZ-3.7,20); rBox(parent,.12,.75,.12,0x16191b,-18,4.38,platformZ-3.82); rBox(parent,.55,.1,.08,0x16191b,-17.75,4.66,platformZ-3.86);
  if(!small){const span=major?240:181;rBox(parent,5.2,8,4.3,0x8f674c,-span/2,.7,platformZ);rBox(parent,5.2,8,4.3,0x8f674c,span/2,.7,platformZ);rBox(parent,span,.55,4.3,0x9b7355,0,8.25,platformZ);}
  const platformPeople=ride?18:major?38:small?9:20;
  for(let i=0;i<platformPeople;i++){const x=-len*.42+(i%Math.max(1,Math.round(platformPeople/2)))*(len*.84/Math.max(1,Math.round(platformPeople/2)-1)),z=platformZ+(i<platformPeople/2?1.7:-1.3);const role=i%6===0?'delhi_vendor':station.region==='punjab'?'rail_sikh_m':station.region==='bengal'?(i%4?'rail_bengal_m':'rail_bengal_f'):station.region==='bihar'?(i%4?'rail_bihar_m':'rail_bihar_f'):station.region==='up'?(i%4?'rail_up_m':'rail_up_f'):(i%4?'rail_delhi_m':'rail_delhi_f');const h=buildHuman(({rail_bengal_m:{skin:0x6b3d18,top:0xd9d0bd,bottom:0x333},rail_bengal_f:{skin:0x7a4a1e,female:true,saree:0xb82828},rail_bihar_m:{skin:0x6b3d18,top:0xe8dfca,bottom:0x55493b},rail_bihar_f:{skin:0x7a4a1e,female:true,saree:0x9b3b70},rail_up_m:{skin:0x8d5524,top:0x638096,bottom:0x292929},rail_up_f:{skin:0x8d5524,female:true,saree:0x247752},rail_delhi_m:{skin:0x8d5524,top:0x324f80,bottom:0x25252a},rail_delhi_f:{skin:0xa06a34,female:true,saree:0xca7920},rail_sikh_m:{skin:0xa06a34,top:0xf0e6d4,bottom:0x333,turban:[0x173f7a,0xc33a2d,0xe89e21][i%3]},delhi_vendor:{skin:0x7a4a1e,top:0xd6c79f,bottom:0x4b4338,cap:true}})[role]);h.group.position.set(x,.8,z);h.group.rotation.y=i<platformPeople/2?Math.PI:0;h.group.scale.multiplyScalar(.92);parent.add(h.group);}
}
function addInfrastructure(parent,station,profile,rnd) {
  // Every checkpoint has its own city topology rather than one renamed grid.
  const k=station.key;
  if(k==='howrah'){
    for(const z of [34,68,106,148,198,252])addStreet(parent,0,z,650,z<70?20:12);
    for(const x of [-250,-165,-82,0,82,165,250])addStreet(parent,x,145,10,250);
    rBox(parent,680,1.2,12,0x6e706e,0,8,305);for(let x=-320;x<=320;x+=24)rBox(parent,.9,8,.9,0x777672,x,0,305);
    rLabel(parent,'HOWRAH · BUS · TAXI',0,6.4,54,.9,0,'#fff','#922f25');
  } else if(k==='bardhaman'){
    addStreet(parent,0,42,300,15);addStreet(parent,0,118,620,11);addStreet(parent,-80,142,10,250,.35);addStreet(parent,115,155,10,280,-.42);
    const pond=new THREE.Mesh(new THREE.CircleGeometry(48,24),rMat(0x4f7f89,{roughness:.25}));pond.rotation.x=-Math.PI/2;pond.position.set(185,.08,205);parent.add(pond);
  } else if(k==='asansol'||k==='dhanbad'){
    addStreet(parent,0,45,340,18);addStreet(parent,0,112,760,14);addStreet(parent,0,205,700,11,.12);addStreet(parent,-185,145,12,270);addStreet(parent,215,150,12,290);
    for(const z of [-38,-50,-62,-74])addTrack(parent,z,980);
  } else if(k==='gaya'){
    addStreet(parent,0,42,260,15);for(const rot of [-.72,-.35,0,.38,.74])addStreet(parent,0,155,620,10,rot);
    rLabel(parent,'PILGRIM ROAD',0,4.2,78,.68,0,'#fff','#a44427');
  } else if(k==='dehri'){
    addStreet(parent,0,45,260,13);addStreet(parent,0,105,820,11);addStreet(parent,-160,155,9,220,.18);addStreet(parent,210,155,9,260,-.2);
    // Long bridge/embankment makes the Son river town unmistakable.
    rBox(parent,1040,1.1,9,0x7c7770,0,5,-300);for(let x=-500;x<=500;x+=35)rBox(parent,.7,5,.7,0x6d6b66,x,0,-300);
  } else if(k==='ddun'){
    addStreet(parent,0,45,300,16);addStreet(parent,0,145,620,12);for(const z of [-34,-44,-54,-64,-74,-84,-94])addTrack(parent,z,1100);
    for(const x of [-180,-60,60,180])addStreet(parent,x,185,10,260);
  } else if(k==='prayagraj'){
    addStreet(parent,0,42,330,17);for(const z of [92,165,245])addStreet(parent,0,z,720,15);for(const x of [-240,-120,0,120,240])addStreet(parent,x,170,13,330);
    rBox(parent,150,.12,150,0x8d897e,210,.04,265);rCylinder(parent,0,3.4,13,0xd8c8a0,210,.1,265,18);
  } else if(k==='kanpur'){
    addStreet(parent,0,40,360,18);for(const z of [90,145,205,270])addStreet(parent,0,z,760,12);for(const x of [-285,-190,-95,0,95,190,285])addStreet(parent,x,175,11,330);
  } else if(k==='etawah'){
    addStreet(parent,0,42,240,13);addStreet(parent,0,110,600,10,.18);addStreet(parent,-130,175,9,260,-.4);addStreet(parent,170,170,9,250,.5);
  } else if(k==='aligarh'){
    addStreet(parent,0,40,280,15);for(const z of [88,132,190,245])addStreet(parent,0,z,640,10,(z%2?.06:-.05));for(const x of [-210,-105,40,155,245])addStreet(parent,x,165,9,290);
    rLabel(parent,'LOCK WORKS',175,5.5,118,.65,0,'#fff','#374f68');
  } else if(k==='delhi'){
    addStreet(parent,0,38,420,24);for(const z of [88,148,215,290])addStreet(parent,0,z,880,z<100?18:14);for(const x of [-330,-220,-110,0,110,220,330])addStreet(parent,x,175,13,350);
    for(let x=-430;x<=430;x+=24)rBox(parent,.9,8,.9,0x777672,x,0,335);rBox(parent,920,1.25,13,0x666866,0,7.8,335);rBox(parent,920,.12,11,0x383b3d,0,9.05,335);
  } else if(k==='panipat'){
    addStreet(parent,0,42,280,15);addStreet(parent,0,125,1050,19);addStreet(parent,0,230,900,11);for(const x of [-280,-140,120,260])addStreet(parent,x,180,10,250);
  } else if(k==='ambala'){
    addStreet(parent,0,42,260,15);for(const z of [105,195,285])addStreet(parent,0,z,760,16);for(const x of [-260,-130,0,130,260])addStreet(parent,x,190,15,330);
    for(const x of [-195,195])for(const z of [145,245]){rBox(parent,70,.05,55,0x60784b,x,.03,z);for(let t=0;t<8;t++)railTree(parent,x-28+t*8,z-20,.55,'broad');}
  } else if(k==='ludhiana'){
    addStreet(parent,0,40,360,18);for(const z of [100,190,290])addStreet(parent,0,z,920,16);for(const x of [-345,-230,-115,0,115,230,345])addStreet(parent,x,190,13,350);
  } else if(k==='jalandhar'){
    addStreet(parent,0,42,280,15);for(const rot of [-.8,-.4,0,.4,.8])addStreet(parent,0,175,760,11,rot);
    const ring=new THREE.Mesh(new THREE.RingGeometry(250,260,64),rMat(0x424442));ring.rotation.x=-Math.PI/2;ring.position.set(0,.06,200);parent.add(ring);
  } else {
    // Amritsar: ring road/walled-city mass with radial market approaches.
    addStreet(parent,0,42,300,17);for(const rot of [-.75,-.38,0,.38,.75])addStreet(parent,0,190,780,11,rot);
    const wall=new THREE.Mesh(new THREE.RingGeometry(225,232,64),rMat(0xa56c43));wall.rotation.x=-Math.PI/2;wall.position.set(0,.09,240);parent.add(wall);
    rCylinder(parent,0,6,8,0xd5a72f,0,4,240,20);rCylinder(parent,0,2,5,0xf0d46b,0,12,240,18);
  }
  for(const z of [64,126,188,250]){addPath(parent,0,z,520,2.1);if(profile.density>.62)addDrain(parent,0,z+6,500);}
  // Forecourts scale with station importance; rural stops do not get the same
  // metropolitan bus terminal as Howrah or Delhi.
  const foreW=120+profile.density*150;rBox(parent,foreW,.09,25+profile.density*9,0x77746c,0,.05,29);
  for(let x=-foreW/2+8;x<foreW/2;x+=12)rBox(parent,.18,.75,.18,0x333936,x,.15,15);
  const autos=Math.round(2+profile.density*8);for(let i=0;i<autos;i++)addRoadVehicle(parent,-foreW*.35+i*7,28,[0x1d7892,0x278d50,0xd1b12c][i%3],0,'auto');
  for(let i=0;i<Math.round(profile.density*3);i++)addRoadVehicle(parent,35+i*25,31,[0xb94135,0xd8c6a3,0x397096][i%3],0,'bus');
  addUtilityLine(parent,0,265,Math.min(900,430+profile.density*250));
  if(['ddun','ambala','asansol','dhanbad'].includes(k)){rCylinder(parent,4.7,4.7,3.5,0x9eaa9f,220,18,165,18);for(const dx of [-3.3,3.3])for(const dz of [-3.3,3.3])rBox(parent,.5,18,.5,0x6d716c,220+dx,0,165+dz);rLabel(parent,'RAILWAY COLONY',170,4.2,126,.65,0,'#fff','#35634c');}
  // Freight/industry profiles receive sidings, loading sheds and truck access.
  if(profile.industry>.45){ for(const z of [-38,-48])addTrack(parent,z,720); rBox(parent,230,.12,15,0x645a4b,110,.05,-63); for(let i=0;i<5;i++){rBox(parent,27,6,18,0x706b63,-40+i*52,0,-92);rBox(parent,29,.2,20,0x4e5657,-40+i*52,6,-92);} for(let i=0;i<4;i++)addRoadVehicle(parent,-75+i*34,-73,0x726553,0,'truck'); }
  if(profile.density>.85&&k!=='delhi'){for(let x=-340;x<=340;x+=24)rBox(parent,.9,7.5,.9,0x777672,x,0,330);rBox(parent,720,1.25,11,0x666866,0,7.4,330);rBox(parent,720,.12,9.4,0x383b3d,0,8.66,330);}
  // Canal/irrigation and farm access are prominent west of Delhi.
  if(station.region==='punjab'||station.key==='panipat'||station.key==='ambala'){rBox(parent,760,.12,8,0x4f7885,0,.02,-205);for(let x=-340;x<=340;x+=85)rBox(parent,12,.4,12,0x8f897c,x,.1,-205);}
}
function addDistantSprawl(parent,station,profile,rnd) {
  const far=new THREE.Group();far.name=`${station.key}-context-belt`;parent.add(far);
  // Land-use texture at the horizon: fields and rough ground cover almost the
  // entire 3.2 km walk world, so the playable town never floats in one plane.
  for(let gx=-3;gx<=3;gx++)for(let gz=-3;gz<=3;gz++){
    if(Math.abs(gx)<=1&&Math.abs(gz)<=1)continue;
    const x=gx*330+(rnd()-.5)*90,z=gz*300+(rnd()-.5)*80;
    const agricultural=Math.abs(gz)>1||profile.density<.55;
    rFarBox(far,270+rnd()*60,.035,235+rnd()*45,agricultural?(rnd()<.5?profile.field:0x8f824f):profile.soil,x,-.03,z,(rnd()-.5)*.06);
    if(agricultural)for(let s=-2;s<=2;s++)rFarBox(far,245,.018,.16,s%2?0xb3a252:0x4f783c,x,.04,z+s*36);
  }
  // Long approach roads tie the foreground graph to settlements beyond it.
  for(const [rot,offset] of [[0,0],[Math.PI/2,0],[.48,85],[-.62,-120]]){
    const road=rFarBox(far,2100,.07,8.5,0x454542,0,.02,offset,rot);road.receiveShadow=true;
    rFarBox(far,1980,.012,.1,0xc2a95a,0,.1,offset,rot);
  }
  const urbanCount=Math.round(45+profile.density*150+profile.industry*35);
  const palette=[0x9b765c,0xad8968,0x7f837b,0xb19b79,0x806b5e,0x9a8f7b];
  for(let i=0;i<urbanCount;i++){
    const angle=rnd()*Math.PI*2, radius=330+Math.pow(rnd(),.72)*(profile.density>.8?850:620);
    let x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    if(Math.abs(z)<34)z+=z<0?-42:42;
    const metro=profile.density>.8, w=8+rnd()*(metro?18:11), stories=metro?(rnd()<.18?5+Math.floor(rnd()*8):1+Math.floor(rnd()*4)):(rnd()<.12?3:1+Math.floor(rnd()*2));
    const h=2.8*stories+rnd()*1.5; rFarBox(far,w,h,w*(.55+rnd()*.35),palette[i%palette.length],x,0,z,(rnd()-.5)*.18);
    if(i%4===0)rFarBox(far,w+.4,.12,w*.75,profile.roofs,x,h,z,(rnd()-.5)*.18);
  }
  // Rural checkpoints still show several complete hamlets, not a lone hut.
  const hamlets=profile.density<.5?9:4;
  for(let c=0;c<hamlets;c++){
    const a=(c/hamlets)*Math.PI*2+rnd()*.25,r=530+rnd()*620,cx=Math.cos(a)*r,cz=Math.sin(a)*r;
    for(let h=0;h<6+Math.round(rnd()*5);h++){const x=cx+(rnd()-.5)*80,z=cz+(rnd()-.5)*65;rFarBox(far,5+rnd()*6,2.4+rnd()*1.5,5+rnd()*6,[0x9c7455,0xb18a62,0x80624c][h%3],x,0,z,(rnd()-.5)*.3);if(h%2===0)railTree(far,x+5,z-4,.45+rnd()*.3,station.region==='punjab'?'poplar':'broad');}
    addPath(far,cx,cz,130,2.5,a);
  }
  // Vegetation belts and shelter rows hide no-content horizons and communicate
  // Bengal humidity versus western irrigated plains through silhouette.
  for(let i=0;i<95;i++){
    const a=rnd()*Math.PI*2,r=390+rnd()*900,x=Math.cos(a)*r,z=Math.sin(a)*r;
    railTree(far,x,z,.38+rnd()*.52,station.region==='punjab'&&i%2===0?'poplar':station.region==='bengal'&&i%5===0?'palm':'broad');
  }
  // Power distribution and industrial silhouettes remain visible from town.
  for(let x=-1250;x<=1250;x+=110){rFarBox(far,.38,12,.38,0x555956,x,0,-760);rFarBox(far,8,.18,.18,0x555956,x,10.7,-760);}
  if(profile.industry>.5)for(let i=0;i<10;i++){const x=-700+i*145;rFarBox(far,80,7+rnd()*7,38,0x696761,x,0,650);rCylinder(far,.8,1.3,26+rnd()*32,0x5c5752,x+28,0,635,12);}
  if(profile.density>.8)for(let i=-5;i<=5;i++){const h=28+Math.abs((i*17)%38);rFarBox(far,22+rnd()*13,h,18+rnd()*12,[0x657982,0x8c796c,0x727c79][Math.abs(i)%3],i*80,0,-650);}
}
function buildNightNetwork(parent,station,profile,ride=false) {
  const glowGroup=new THREE.Group();glowGroup.name='rail-night-lights';parent.add(glowGroup);const lights=[];
  const bulbMat=new THREE.MeshBasicMaterial({color:0xffd27c});
  const coolMat=new THREE.MeshBasicMaterial({color:0xb9dcff});
  // Platform and street lamps retain their physical posts by day; only their
  // luminaires and cast light are time-controlled.
  const lampRows=ride?[[-480,480,48,10]]:[[-250,250,25,15],[-245,245,35,82],[-220,220,44,142]];
  for(const [start,end,step,z] of lampRows)for(let x=start;x<=end;x+=step){
    if(!ride)rBox(parent,.18,6,.18,0x4b514f,x,0,z);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),x%2?bulbMat:coolMat);bulb.position.set(x,ride?2.2:5.9,z);glowGroup.add(bulb);
    if(lights.length<18&&Math.abs(x%75)<step){const light=new THREE.PointLight(x%2?0xffc66d:0xc8e4ff,0,ride?15:28);light.position.copy(bulb.position);parent.add(light);lights.push(light);}
  }
  // Dense belts of lit windows continue beyond the playable district. Large
  // cities have many more occupied buildings; rural profiles show hamlet dots.
  const windowCount=Math.round(45+profile.density*190+profile.industry*30);
  const rnd=seeded(hashKey(station.key)^0x91ab23);
  for(let i=0;i<windowCount;i++){
    const a=rnd()*Math.PI*2,r=ride?40+rnd()*150:170+rnd()*(profile.density>.8?900:650),x=ride?-520+rnd()*1040:Math.cos(a)*r,z=ride?(rnd()<.5?-1:1)*(28+rnd()*70):Math.sin(a)*r;
    const w=new THREE.Mesh(new THREE.PlaneGeometry(.45+rnd()*.8,.38+rnd()*.65),new THREE.MeshBasicMaterial({color:i%5?0xffc76e:0xb9dcff,side:THREE.DoubleSide}));w.position.set(x,2.2+rnd()*(profile.density>.8?22:7),z);w.rotation.y=ride?(z<0?0:Math.PI):Math.atan2(x,z);glowGroup.add(w);
  }
  // Market strings, dhabas and platform kiosks stay bright well after sunset.
  if(!ride)for(const z of [43,82,142])for(let x=-210;x<=210;x+=12){const bulb=new THREE.Mesh(new THREE.SphereGeometry(.09,6,5),new THREE.MeshBasicMaterial({color:[0xffb347,0xffe38b,0xe95838,0x7bdcff][Math.abs((x/12)|0)%4]}));bulb.position.set(x,3.2,z);glowGroup.add(bulb);}
  glowGroup.visible=false;return{group:glowGroup,lights};
}
function districtPoint(station,i,rnd) {
  const k=station.key;
  if(['gaya','jalandhar','amritsar'].includes(k)){const a=rnd()*Math.PI*2,r=55+Math.sqrt(rnd())*260;return{x:Math.cos(a)*r,z:170+Math.sin(a)*r*.62,rot:-a};}
  if(['asansol','dhanbad','panipat','ludhiana'].includes(k)){const band=i%3;return{x:-360+rnd()*720,z:68+band*88+rnd()*28,rot:(rnd()-.5)*.08};}
  if(k==='dehri'){return{x:-390+rnd()*780,z:70+(i%2)*75+rnd()*24,rot:(rnd()-.5)*.06};}
  if(k==='bardhaman'||k==='etawah'){const a=(rnd()-.5)*1.8,r=70+rnd()*280;return{x:Math.sin(a)*r,z:75+Math.cos(a)*r,rot:-a};}
  if(k==='ambala'){const col=i%5,row=(i/5)|0;return{x:-250+col*125+rnd()*22,z:72+(row%4)*78+rnd()*18,rot:0};}
  if(['howrah','prayagraj','kanpur','delhi','aligarh'].includes(k)){const cols=k==='delhi'?9:7;return{x:-330+(i%cols)*(660/(cols-1))+(rnd()-.5)*18,z:64+((i/cols)|0)%6*52+rnd()*15,rot:0};}
  if(k==='ddun'){return{x:-310+rnd()*620,z:92+(i%4)*70+rnd()*16,rot:0};}
  return{x:-300+rnd()*600,z:58+(i%5)*52+rnd()*18,rot:0};
}
function buildTown(parent,station,profile) {
  const rnd=seeded(hashKey(station.key));
  addInfrastructure(parent,station,profile,rnd);
  const buildingCount=Math.round(38+profile.density*92);
  for(let i=0;i<buildingCount;i++){
    const p=districtPoint(station,i,rnd),side=i%2?-1:1;let{x,z}=p;
    if(Math.abs(x)<12&&z<75)x+=22;
    const central=z<115, stories=profile.density>.8&&rnd()<.55?2+(rnd()<.28?1:0):1;
    if((central||['howrah','amritsar','delhi'].includes(station.key))&&rnd()<.46) addShop(parent,x,z,7+rnd()*6,3.7+rnd()*2,[0xa46b48,0x8a775d,0x6f8790,0xb08a56][i%4],['CHAI','HOTEL','MEDICAL','MOBILE','SWEETS','TAILOR','BOOKS','DHABA'][i%8],p.rot??(side<0?Math.PI:0));
    else addHouse(parent,x,z,6+rnd()*7,3+rnd()*1.1,[0x9e7656,0xb28c65,0x7f8b83,0xc09b6d,0x8c6858][i%5],profile.roofs,stories);
  }
  const edgeZ=['asansol','dhanbad','kanpur'].includes(station.key)?390:['delhi','howrah'].includes(station.key)?350:275;
  for(let i=0;i<Math.round(profile.informal*68);i++) { const x=-280+rnd()*560,z=edgeZ+rnd()*90; rBox(parent,4+rnd()*4,2+rnd()*1.3,4+rnd()*4,[0x8a664a,0x665e55,0x9b7858][i%3],x,0,z); rBox(parent,4.7+rnd()*4,.09,5+rnd()*4,[0x345a78,0x776b5a,0x39704d][i%3],x,2.3,z); if(i%7===0)addPath(parent,x,z-7,2,16); }
  for(let i=0;i<Math.round(profile.industry*9);i++) addIndustry(parent,-205+i*52,325+(i%2)*42,profile,rnd);
  for(let i=0;i<12;i++) addField(parent,-250+i*45,-130-(i%3)*50,38,34,profile.field,rnd,profile);
  for(let i=0;i<26;i++) railTree(parent,-270+rnd()*540,-60+rnd()*420,.65+rnd()*.5,station.region==='punjab'&&i%3===0?'poplar':station.region==='bengal'&&i%4===0?'palm':'broad');
  addWorship(parent,-58,127,station.region,station.key);
  if(profile.water){ const river=new THREE.Mesh(new THREE.PlaneGeometry(900,profile.water>.8?120:55),rMat(0x507988,{metalness:.12,roughness:.32})); river.rotation.x=-Math.PI/2; river.position.set(0,.12,-310); parent.add(river); if(profile.sand) rBox(parent,900,.04,35,0xc0a879,0,.08,-260); }
  if(profile.metro){ for(let x=-320;x<=320;x+=25) rBox(parent,.8,9,.8,0x777672,x,0,355); rBox(parent,680,1.1,4.8,0x777672,0,9,355); }
  if(profile.ravine) for(let i=0;i<12;i++) rBox(parent,18+rnd()*24,.2,6+rnd()*8,0x81583d,-260+i*48,.2,-220-i%3*15);
  addDistantSprawl(parent,station,profile,rnd);
}
function coachPassenger(region,i) {
  const female=i%2===0, child=i%9===0||i%13===0, elderly=i%11===0, sikh=region==='punjab'&&i%5===0;
  return buildHuman({skin:[0x5f351b,0x6b3d18,0x7a4a1e,0x8d5524,0xa06a34,0xb07840][i%6],female,child,saree:female?[0xb7242e,0x24734d,0xd18a1d,0x70396f,0x176985,0xd8c9a4][i%6]:undefined,top:female?undefined:[0xe3dac4,0x315c70,0x854c3c,0x677b8c,0x8b342e,0xd19a35][i%6],bottom:[0x292929,0x3c3b38,0x564a3b,0xe1d7c0][i%4],turban:sikh?[0x183f79,0xc43a2e,0xe09122,0xf0e6d4][i%4]:null,headwrap:female&&i%4===0?0xe6ddca:null,cap:elderly&&!sikh,tall:child?undefined:elderly?.9:.92+(i%4)*.025});
}
function buildCoach(parent,region='up') {
  const g=new THREE.Group(); parent.add(g); const pax=[];
  g.add(new THREE.AmbientLight(0xffe5c2,.52));
  rBox(g,31,.18,6.0,0x554f47,0,0,0); rBox(g,31,.12,6.0,0xddd4bd,0,4.22,0);
  // Wall piers leave true window openings rather than a solid opaque box.
  for(const z of [-3,3]){
    rBox(g,31,.75,.14,0xd5cdb7,0,.12,z); rBox(g,31,1.0,.14,0xcfc5ad,0,3.18,z);
    for(let x=-15.5;x<=15.5;x+=3.9){ rBox(g,.3,2.45,.18,0x68655f,x,.8,z); const pane=new THREE.Mesh(new THREE.PlaneGeometry(3.55,1.95),new THREE.MeshPhysicalMaterial({color:0x9bc2c7,transparent:true,opacity:.17,roughness:.12,metalness:.04,transmission:.28,depthWrite:false,side:THREE.DoubleSide})); pane.position.set(x+1.95,2.05,z); g.add(pane); for(let b=-1;b<=1;b++) rBox(g,3.5,.035,.045,0x646761,x+1.95,1.55+b*.48,z+(z<0?-.04:.04)); }
    rBox(g,31,.14,.55,0x8c8a7d,0,3.2,z+(z<0?.35:-.35));
  }
  for(const x of [-15.5,15.5]) { rBox(g,.22,4.1,6.0,0xc8c0aa,x,.12,0); rBox(g,.12,2.7,1.45,0x53666b,x+(x<0?.13:-.13),.55,0,{metalness:.08,roughness:.34}); rBox(g,.08,.82,1.05,0x7fa2a7,x+(x<0?.2:-.2),2.18,0,{emissive:0x1d3b43,emissiveIntensity:.18}); rLabel(g,'VESTIBULE',x+(x<0?.24:-.24),3.72,0,.34,x<0?Math.PI/2:-Math.PI/2,'#f5e6be','#485b60'); }
  // Seven Indian intercity bays: paired transverse lower benches face each
  // other across each compartment, with upper berths and a narrow centre aisle.
  for(let bay=0;bay<7;bay++){
    const x=-12+bay*4;
    for(const row of [-1,1])for(const z of [-1.82,1.82]){
      rBox(g,.78,.45,2.05,0x315f78,x+row*1.03,.55,z);
      rBox(g,.14,1.4,2.08,0x284d62,x+row*1.42,.78,z);
      rBox(g,.82,.18,2.08,0x315f78,x+row*1.03,2.72,z);
    }
    for(const z of [-2.82,2.82]){rCylinder(g,.05,.05,3.1,0xa5a69f,x-1.48,.25,z,8);rCylinder(g,.05,.05,3.1,0xa5a69f,x+1.48,.25,z,8);rBox(g,3.05,.1,.76,0x77786f,x,3.18,z+(z<0?.1:-.1));}
  }
  for(let x=-13;x<=13;x+=4.35){ const tube=rBox(g,2.2,.06,.22,0xfff1c9,x,4.04,0,{emissive:0xffcf7c,emissiveIntensity:1.65}); const light=new THREE.PointLight(0xffd7a0,1.15,9); light.position.set(x,3.72,0); g.add(light); const fan=new THREE.Group(); fan.position.set(x+1.7,3.78,0); rCylinder(fan,.06,.06,.35,0x696c69,0,0,0,8); for(let b=0;b<3;b++){const blade=rBox(fan,1.2,.035,.14,0x747874,.45,.02,0);blade.rotation.y=b*Math.PI*2/3;} fan.userData.fan=true; g.add(fan); }
  // Toilets / wash areas and vestibules at both ends.
  for(const x of [-14.4,14.4]) { rBox(g,1.7,3.45,2.25,0xa9aa99,x,.2,-1.75); rBox(g,.08,2.7,1.25,0x475d64,x+(x<0?.87:-.87),.55,-1.75); rCylinder(g,.28,.22,.18,0xbcc4bd,x,.8,.65,12); }
  // 46 seated passengers fill most rows. Two positions share each broad bench,
  // so families and mixed-age groups read as groups instead of isolated props.
  for(let i=0;i<46;i++){
    const human=coachPassenger(region,i),bay=i%7,row=((i/7)|0)%2?-1:1,side=((i/14)|0)%2?-1:1,inner=((i/28)|0)%2;
    const x=-12+bay*4+row*1.03,z=side*(inner?1.35:2.18);
    human.group.position.set(x,.98,z);human.group.rotation.y=row>0?Math.PI/2:-Math.PI/2;human.group.scale.multiplyScalar(human.group.scale.x*(human.h<1.2?.78:.82));
    if(human.legs[0]){human.legs[0].rotation.x=1.08;human.legs[1].rotation.x=-1.08;}g.add(human.group);pax.push({...human,baseY:.98,phase:i*.57});
  }
  // Standing riders, including children, make the general coach feel genuinely
  // busy without completely blocking the player's path through the aisle.
  for(let i=0;i<11;i++){
    const human=coachPassenger(region,70+i),x=-12+i*2.35,z=(i%2?-.38:.38);
    human.group.position.set(x,.2,z);human.group.rotation.y=i%3?Math.PI/2:-Math.PI/2;human.group.scale.multiplyScalar(.82);g.add(human.group);pax.push({...human,baseY:.2,phase:i*.91,standing:true});
  }
  for(let i=0;i<18;i++){ const x=-13+(i%9)*3.2,z=i%2?2.62:-2.62; if(i%3===0) rBox(g,.7,.55,.45,[0x784b34,0x2e5367,0x8d762f][i%3],x,3.28,z); else {const sack=new THREE.Mesh(new THREE.SphereGeometry(.42,8,6),rMat(i%2?0x7b6548:0x574a3d));sack.scale.set(1,1.25,.75);sack.position.set(x,3.72,z);g.add(sack);} }
  return {group:g,pax};
}
function trainShell(parent,centerX=0,coachCount=7,region='up') {
  const train=new THREE.Group(); parent.add(train);
  for(let i=0;i<coachCount;i++){ const x=centerX+(i-(coachCount-1)/2)*33; if(i===(coachCount-1)/2){const interior=buildCoach(train,region);interior.group.position.x=x;continue;} const car=new THREE.Group(); car.position.x=x; train.add(car); rBox(car,31,3.9,6.2,i===0?0x8a2628:0x9b2f32,0,.25,0); rBox(car,31,.35,6.4,0xd5c8a8,0,4.15,0); rBox(car,31,.16,6.35,0xe0ad25,0,2.25,0); for(const z of [-3.12,3.12]) for(let wx=-12.5;wx<=12.5;wx+=4.15) rBox(car,2.7,1.25,.08,0x4d7785,wx,2.35,z,{metalness:.12,roughness:.28}); for(const bx of [-10,10]){rBox(car,4,.7,5.2,0x30363a,bx,-.55,0);for(const dx of [-1.1,1.1])for(const z of [-2,2]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.48,.48,.18,16),rMat(0x1d2022,{metalness:.6}));wheel.rotation.x=Math.PI/2;wheel.position.set(bx+dx,-.15,z);car.add(wheel);}} }
  return train;
}
function populateSceneryChunk(g,index,station,profile){
  while(g.children.length)g.remove(g.children[g.children.length-1]);const rnd=seeded(hashKey(station.key)+index*9973+Math.round((profile.density||0)*100));
  for(const side of [-1,1]){
    const z=side*(24+rnd()*42); if(rnd()<.50) addField(g,0,z,82,25+rnd()*25,profile.field,rnd,profile);
    if(rnd()<profile.density*.55){ for(let k=0;k<2+Math.round(profile.density*3);k++) addHouse(g,-32+k*18+rnd()*6,z+side*(8+rnd()*13),8+rnd()*6,3.3, [0xa68160,0x98735a,0xb0926b][k%3],profile.roofs,profile.density>.8&&rnd()<.4?2:1); }
    if(rnd()<profile.industry*.28) addIndustry(g,5,z+side*25,profile,rnd);
    for(let t=0;t<3;t++) railTree(g,-35+t*28+rnd()*8,side*(13+rnd()*10),.55+rnd()*.4,station.region==='punjab'?'poplar':'broad');
    rBox(g,.18,7,.18,0x555c58,-40,0,side*10); rBox(g,48,.05,.05,0x454a48,-16,6.8,side*10);
  }
}
function sceneryChunk(parent,index,station,profile,rideProps) {
  const g=new THREE.Group();g.position.x=(index-6)*95;parent.add(g);g.userData.chunk=true;g.userData.index=index;populateSceneryChunk(g,index,station,profile);
  rideProps.push(g); return g;
}
function blendProfile(a,b,t){const mix=(x,y)=>x+(y-x)*t,mixColor=(x,y)=>new THREE.Color(x).lerp(new THREE.Color(y),t).getHex();return{soil:mixColor(a.soil,b.soil),field:mixColor(a.field,b.field),foliage:mixColor(a.foliage,b.foliage),roofs:mixColor(a.roofs,b.roofs),density:mix(a.density,b.density),industry:mix(a.industry,b.industry),informal:mix(a.informal,b.informal),water:mix(a.water||0,b.water||0)};}
function buildRegionalTerrain(station,profile){
  const geo=new THREE.PlaneGeometry(3800,3400,76,68);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=new Float32Array(p.count*3),rnd=seeded(hashKey(station.key)^0x77ac);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z),edge=Math.max(0,Math.min(1,(r-330)/850));let y=0;
    if(['gaya','asansol','dhanbad'].includes(station.key))y=edge*(4+Math.sin(x*.009)*8+Math.cos(z*.011)*6);
    else if(station.key==='etawah')y=edge*(2+Math.sin(x*.018+z*.01)*4)-edge*Math.max(0,7-Math.abs(Math.sin(x*.012)*10));
    else if(station.region==='punjab')y=edge*(Math.sin(x*.006)*1.2+Math.cos(z*.008)*.8);
    else y=edge*(Math.sin(x*.008)*2+Math.cos(z*.006)*1.5);
    p.setY(i,y);const base=new THREE.Color(((Math.floor(x/120)+Math.floor(z/110))&1)?profile.soil:profile.field);base.offsetHSL((rnd()-.5)*.025,(rnd()-.5)*.035,(rnd()-.5)*.05);colors[i*3]=base.r;colors[i*3+1]=base.g;colors[i*3+2]=base.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,map:surfaceTexture('earth'),roughness:1}));mesh.position.y=-.1;mesh.receiveShadow=true;return mesh;
}
function buildLocalTraffic(parent,station,profile){
  const movers=[],count=Math.round(4+profile.density*18+profile.industry*4),rnd=seeded(hashKey(station.key)^0xabc123);
  for(let i=0;i<count;i++){const z=[82,142,205,290][i%4],dir=i%2?1:-1,type=i%9===0?'bus':profile.industry>.6&&i%7===0?'truck':'auto',g=addRoadVehicle(parent,-420+rnd()*840,z,[0x1c7890,0x2b8b4b,0xcfad27,0xa53c32,0xd5c7a7][i%5],dir<0?Math.PI:0,type);g.userData.traffic={dir,speed:(type==='bus'?5:type==='truck'?4:7)+rnd()*4,z};movers.push(g);}
  return movers;
}
function buildAirDetail(parent,station,profile){
  const plumes=[];if(profile.industry>.35)for(let i=0;i<Math.round(3+profile.industry*7);i++){const m=new THREE.Mesh(new THREE.SphereGeometry(1.2+i%3,7,5),new THREE.MeshBasicMaterial({color:0x6b6863,transparent:true,opacity:.12,depthWrite:false}));m.position.set(-260+i*70,20+(i%4)*5,620+(i%2)*32);m.scale.set(1,1.7,1);parent.add(m);plumes.push({mesh:m,baseY:m.position.y,phase:i*.8});}return plumes;
}
function detailedRailWorld(scene,{ride=false}={}) {
  const q=new URLSearchParams(location.search); let stationIndex=Math.max(0,RAIL_STATIONS.findIndex(s=>s.key===q.get('station'))); if(stationIndex<0)stationIndex=0;
  let station=RAIL_STATIONS[stationIndex], profile=RAIL_PROFILES[station.key], root=new THREE.Group(); scene.add(root);
  const rideProps=[],animated=[],terrain=buildRegionalTerrain(station,profile);root.add(terrain);const traffic=ride?[]:buildLocalTraffic(root,station,profile),plumes=ride?[]:buildAirDetail(root,station,profile);
  function rebuildRideScenery(){for(const g of rideProps)root.remove(g);rideProps.length=0;for(let i=0;i<13;i++)sceneryChunk(root,i,station,profile,rideProps);}
  if(!ride){ addTrack(root,0,1200); addTrack(root,-10,1200); buildStation(root,station,profile,seeded(hashKey(station.key))); buildTown(root,station,profile); trainShell(root,0,7,station.region); }
  else {
    addTrack(root,-8,1300); addTrack(root,8,1300); rebuildRideScenery();
    const coach=buildCoach(root,station.region); animated.push(...coach.pax); addSignal(root,250,10,-1);
  }
  let night=buildNightNetwork(root,station,profile,ride);
  const crowdRoles=station.region==='bengal'?['rail_bengal_m','rail_bengal_f']:station.region==='bihar'?['rail_bihar_m','rail_bihar_f']:station.region==='up'?['rail_up_m','rail_up_f']:station.region==='punjab'?['rail_sikh_m','rail_delhi_f']:['rail_delhi_m','rail_delhi_f'];
  const maxCrowd=Math.round(55+profile.density*118+profile.industry*28);
  const people=!ride?new Villagers(scene,'delhislum',()=>.2,[
    {role:crowdRoles[0],region:`rail_${station.region}`,count:Math.round(maxCrowd*.29),x:0,z:22,spread:105,idle:.28},
    {role:crowdRoles[1],region:`rail_${station.region}`,count:Math.round(maxCrowd*.24),x:20,z:34,spread:95,idle:.38},
    {role:'delhi_vendor',region:`rail_${station.region}`,count:Math.round(maxCrowd*.14),x:-25,z:74,spread:85,idle:.58},
    {role:'delhi_laborer',region:`rail_${station.region}`,count:Math.round(maxCrowd*.13),x:45,z:128,spread:120,idle:.30},
    {role:'delhi_kid',region:`rail_${station.region}`,count:Math.round(maxCrowd*.10),x:-35,z:110,spread:105,idle:.25},
    ...((station.region==='bihar'||station.region==='up'||station.key==='delhi')?[{role:'rail_muslim_f',region:`rail_${station.region}`,count:Math.round(maxCrowd*.10),x:-15,z:92,spread:90,idle:.42}]:[])
  ],hashKey(station.key)):null;
  if(people)people.people.forEach((p,i)=>{p.activity=(i+.5)/people.people.length;p.group.visible=true;});
  let onboard=ride,seated=false,speed=ride?18:0,phase=ride?'running':'platform',phaseT=0,segmentIndex=Math.min(stationIndex,ROUTE_SEGMENTS.length-1),distance=0,platform=null;
  function setStation(idx){stationIndex=Math.max(0,Math.min(RAIL_STATIONS.length-1,idx));station=RAIL_STATIONS[stationIndex];profile=RAIL_PROFILES[station.key];if(ride){rebuildRideScenery();root.remove(night.group);for(const light of night.lights)root.remove(light);night=buildNightNetwork(root,station,profile,true);}}
  function spawnRidePlatform(){ if(platform)root.remove(platform); platform=new THREE.Group(); platform.position.x=520; root.add(platform); buildStation(platform,RAIL_STATIONS[Math.min(stationIndex+1,RAIL_STATIONS.length-1)],RAIL_PROFILES[RAIL_STATIONS[Math.min(stationIndex+1,RAIL_STATIONS.length-1)].key],seeded(3),true); }
  if(ride)spawnRidePlatform();
  function board(pos){
    if(ride){ seated=!seated; if(seated){pos.x=Math.max(-12,Math.min(12,Math.round(pos.x/4)*4));pos.z=pos.z>=0?1.35:-1.35;}else pos.z=0; return{message:seated?'SEATED AT WINDOW · F TO STAND':'STANDING IN COACH AISLE'}; }
    if(onboard){onboard=false;pos.set(0,.2,18);return{message:`ALIGHTED · ${station.label}`};}
    if(Math.abs(pos.x)>95||pos.z<2||pos.z>24)return{message:'Walk alongside the train on platform 1 to board.'}; onboard=true;pos.set(0,.2,0);return{message:`BOARDED AT ${station.label.toUpperCase()}`};
  }
  function update(dt,simTime,nightF,pos){
    people?.update(dt,pos);
    if(people){
      const hour=((globalThis.__railTod??.625)*24)%24;
      const major=['howrah','dhanbad','ddun','prayagraj','kanpur','delhi','ludhiana','amritsar'].includes(station.key);
      let activity=hour>=5&&hour<9?.90:hour>=9&&hour<16?.78:hour>=16&&hour<23?1:hour>=23||hour<1?(major?.72:.46):(major?.52:.25);
      activity=Math.min(1,activity*(.72+profile.density*.28));
      for(const p of people.people)p.group.visible=p.activity<=activity;
    }
    const glow=Math.max(0,nightF);night.group.visible=glow>.08;for(const light of night.lights)light.intensity=glow*(ride?.72:profile.density>.8?1.45:.92);
    for(const g of traffic){const t=g.userData.traffic;g.position.x+=t.dir*t.speed*dt;if(g.position.x>520)g.position.x=-520;if(g.position.x<-520)g.position.x=520;}
    for(const p of plumes){p.mesh.position.y=p.baseY+(simTime*.8+p.phase)%22;p.mesh.position.x+=Math.sin(simTime*.35+p.phase)*dt*.35;p.mesh.material.opacity=.08+nightF*.08;}
    for(const p of animated){p.group.position.y=p.baseY+Math.sin(simTime*.8+p.phase)*.012;if(p.arms[0]&&Math.sin(simTime*.23+p.phase)>.78)p.arms[0].rotation.x=-.65;}
    root.traverse(o=>{if(o.userData.fan)o.rotation.y+=dt*6;});
    if(!ride)return;
    phaseT+=dt; if(phase==='running'&&phaseT>42){phase='approach';phaseT=0;spawnRidePlatform();}
    if(phase==='approach'&&platform){const target=Math.max(2.4,Math.min(20,platform.position.x*.055));speed+=(target-speed)*Math.min(1,dt*.9);platform.position.x-=speed*dt;if(platform.position.x<1.2){platform.position.x=0;speed=0;phase='dwell';phaseT=0;}}
    else if(phase==='dwell'&&phaseT>13){phase='depart';phaseT=0;}
    else if(phase==='depart'){speed=Math.min(22,speed+dt*1.6);if(platform)platform.position.x-=speed*dt;if(phaseT>12){phase='running';phaseT=0;segmentIndex=Math.min(segmentIndex+1,ROUTE_SEGMENTS.length-1);setStation(Math.min(stationIndex+1,RAIL_STATIONS.length-1));distance=0;if(platform){root.remove(platform);platform=null;}}}
    else if(phase==='running')speed+=(20-speed)*dt*.3;
    distance+=speed*dt;for(const g of rideProps){g.position.x-=speed*dt;if(g.position.x<-650){g.position.x+=1235;const next=RAIL_STATIONS[Math.min(stationIndex+1,RAIL_STATIONS.length-1)],t=Math.min(1,phase==='approach'||phase==='dwell'?.9:phaseT/42),mixed=blendProfile(profile,RAIL_PROFILES[next.key],t);populateSceneryChunk(g,g.userData.index,next,mixed);}}
    if(onboard){pos.x=Math.max(-14.6,Math.min(14.6,pos.x));pos.z=Math.max(-2.55,Math.min(2.55,pos.z));}
  }
  return {groundHeight:()=>.2,placeName:()=>ride&&phase==='dwell'?RAIL_STATIONS[Math.min(stationIndex+1,RAIL_STATIONS.length-1)].label:station.label,blocked:(x,z)=>ride&&(Math.abs(x)>14.8||Math.abs(z)>2.7),board,update,status:()=>ride?`${phase.toUpperCase()} · ${phase==='dwell'?RAIL_STATIONS[Math.min(stationIndex+1,RAIL_STATIONS.length-1)].label:`${station.label} → ${RAIL_STATIONS[Math.min(stationIndex+1,RAIL_STATIONS.length-1)].label}`} · ${Math.round(speed*3.6)} km/h${phase==='dwell'?` · DEPARTS ${Math.max(0,Math.ceil(13-phaseT))}s`:''}`:onboard?`ON TRAIN · ${station.label}`:`${station.label} · PLATFORM 1 · ${profile.signature}`};
}

export function buildRailCorridor(scene){ return detailedRailWorld(scene,{ride:false}); }
export function buildRailRide(scene){ return detailedRailWorld(scene,{ride:true}); }
