import * as THREE from 'three';
import { MAP, EURO, LOOP_LENGTH, wrapS, ZONES, EXITS, RAMP_LENGTH } from './config.js';
const DELHIKOLKATA = MAP === 'delhikolkata';
import {
  posAt, elevAt, headingAt, mountainWeight, ghatWeight, cincyWeight, neReliefAt, appalachianAt, njHighlandsAt, gspHillAt, bayHillAt, chesterReliefAt, i95SouthReliefAt, bronxRiverReliefAt, bridgeBumpAt,
  pointAt, pavedHalfAt,
} from './road.js';
import { buildSky, setSkyState } from './sky.js';

const TAU = Math.PI * 2;

// Deterministic pseudo-random
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function zoneWeight(key, s) {
  // smooth 0..1 membership with 250 m cosine blend at zone borders
  const z = ZONES.find(z => z.key === key);
  if (!z) return 0;
  const B = 250;
  s = wrapS(s);
  const d = signedInside(s, z);
  if (d <= -B) return 0;
  if (d >= B) return 1;
  return 0.5 + 0.5 * Math.sin((d / B) * Math.PI / 2);
}

function inRange(s, z) { return s >= z.start && s < z.end; }
function loopDist(a, b) {
  const d = Math.abs(wrapS(a) - wrapS(b));
  return Math.min(d, LOOP_LENGTH - d);
}
// distance inside zone (positive) or outside (negative), to nearest border
function signedInside(s, z) {
  const d0 = loopDist(s, z.start), d1 = loopDist(s, z.end);
  const m = Math.min(d0, d1);
  return inRange(s, z) ? m : -m;
}

// ---------------------------------------------------------------------------
// Terrain height away from the road
// ---------------------------------------------------------------------------
// Terrain is held flat (just below road level) across the full road corridor —
// travel lanes, widest NJ cross-section, and exit-ramp envelope — so it can
// never poke up through the pavement between terrain-mesh sample columns.
const CORRIDOR = 46;

export function groundY(s, lat) {
  const a = Math.abs(lat);
  const bridge = bridgeBumpAt(s);
  const road = elevAt(s) - bridge; // terrain doesn't climb bridge decks
  if (a <= CORRIDOR && bridge < 0.5) return road - 0.2;
  const t = Math.min(1, (a - CORRIDOR) / 260);
  const settle = a <= CORRIDOR ? road - 0.2 : road * (1 - t * t);
  const mw = mountainWeight(s);
  const gw = ghatWeight(s);
  const relief = Math.max(mw, gw, 0.45 * cincyWeight(s), 0.7 * neReliefAt(s), appalachianAt(s), 0.85 * njHighlandsAt(s), 0.75 * gspHillAt(s), 0.9 * bayHillAt(s), chesterReliefAt(s), i95SouthReliefAt(s), bronxRiverReliefAt(s)); // Clifton hills are modest
  const phi = TAU * wrapS(s) / LOOP_LENGTH;
  const noise = 3 * Math.sin(s * 0.011 + lat * 0.021) + 2 * Math.sin(s * 0.027 - lat * 0.013);
  // Colorado rock walls / lush Ghats climbing away from the road
  const hills = relief * Math.min(150, (a - CORRIDOR) * 0.55) * (1 + 0.5 * Math.sin(phi * 11 + lat * 0.01));
  const rolling = (1 - relief) * noise * t;
  // river basins under the bridges (Hudson, Raritan, Delaware / Vashi creek)
  const basin = MAP === 'i95'
    ? 10 * windowFn2(s, 43650, 43900, 44100, 44350)
      + 7 * windowFn2(s, 60850, 61100, 61700, 61950)
      + 9 * windowFn2(s, 76900, 77200, 77900, 78200)
      // DE→FL true-scale run: Susquehanna (Perryville/Havre de Grace county
      // line), Potomac (Woodrow Wilson Br, MD/VA line), James (Richmond),
      // Cape Fear (Fayetteville), Great Pee Dee (Latta), Santee/Lake Marion,
      // Savannah River (GA/SC line), St. Johns (Jacksonville)
      + 9 * windowFn2(s, 158200, 158900, 160100, 160800)
      + 11 * windowFn2(s, 307700, 308400, 309800, 310500)
      + 8 * windowFn2(s, 478700, 479400, 481600, 482300)
      + 7 * windowFn2(s, 816200, 816800, 818200, 818800)
      + 6 * windowFn2(s, 913400, 913900, 915600, 916100)
      + 8 * windowFn2(s, 1046200, 1046800, 1049100, 1049700)
      + 10 * windowFn2(s, 1206900, 1207600, 1209100, 1209800)
      + 8 * windowFn2(s, 1470200, 1470800, 1473400, 1474000)
      // Northeast leg, shifted +1907600 with the rest of buildNortheastExt
      + 7 * windowFn2(s, 2014700, 2015100, 2015700, 2016100)   // Providence River
      + 12 * windowFn2(s, 2029100, 2029600, 2030400, 2030900)  // Thames, New London
    : MAP === 'india' ? 9 * windowFn2(s, 32050, 32350, 32850, 33150)
    : MAP === 'newengland'
      ? 9 * windowFn2(s, 15650, 15950, 16650, 16950)   // Connecticut River, Hartford
        + 6 * windowFn2(s, 52550, 52850, 53550, 53850) // Charles River, Boston
    : MAP === 'i80'
      ? 11 * windowFn2(s, 36350, 36750, 37650, 38050)  // Delaware River, Water Gap
        + 7 * windowFn2(s, 170550, 170950, 171650, 172050) // Cuyahoga, Cleveland
    : MAP === 'i78'
      ? 12 * windowFn2(s, 110000, 111500, 116500, 118000) // Delaware River
        + 16 * windowFn2(s, 237500, 239000, 246000, 247500) // Newark Bay: sink grass below water/deck
    : MAP === 'bronxriver'
      ? 16 * windowFn2(s, 40500, 41200, 44200, 44900)  // East River beneath Throgs Neck Bridge
    : MAP === 'i287'
      ? 13 * windowFn2(s, 90400, 91800, 95800, 97200)  // Hudson River, Tappan Zee
        + 8 * windowFn2(s, 129700, 130300, 131500, 132100) // Hudson at the GWB
    : MAP === 'bay'
      ? 16 * windowFn2(s, 6300, 7200, 10800, 11700)    // SF Bay under the Bay Bridge
        + 9 * windowFn2(s, 59200, 59700, 60300, 60800)  // Carquinez Strait (Benicia Br)
        + 9 * windowFn2(s, 71700, 72200, 72900, 73400)  // Carquinez Strait (Carquinez Br)
    : MAP === 'gsp'
      ? 10 * windowFn2(s, 43300, 44100, 45100, 45900)   // Great Egg Harbor Bay
        + 7 * windowFn2(s, 78400, 78800, 79300, 79700)  // Mullica River
        + 5 * windowFn2(s, 132650, 132950, 133150, 133450) // Toms River
        + 13 * windowFn2(s, 203400, 204000, 204600, 205200) // Raritan at the Driscoll
        + 6 * windowFn2(s, 250700, 251050, 251350, 251700)  // Passaic, Clifton
    : MAP === 'acx'
      ? 12 * windowFn2(s, 7400, 7700, 8300, 8600)       // the Delaware under the WWB
        + 3 * windowFn2(s, 93650, 93950, 94550, 94850)  // AC approach tidal marsh
    : 0;
  let gy = settle + hills + rolling + relief * noise * 2.2 * t - 0.18 - basin;
  // South Mumbai coast (andheri map): sink the ground below the sea plane on the
  // sea side (lat > 0) from the Sea Link down past Nariman Point, so the Arabian
  // Sea reads as open water instead of green terrain.
  if (MAP === 'andheri') {
    const coast = windowFn2(s, 27200, 28600, 51200, 52000);
    if (coast > 0.02 && lat > 10) gy = Math.min(gy, -3.5);
  }
  // Lake Erie on the north shoulder past Cleveland and along the Toledo flats
  if (MAP === 'i80') {
    const lake = windowFn2(s, 165000, 168000, 202000, 204000);
    if (lake > 0.02 && lat > 55) gy = Math.min(gy, -3.2);
  }
  return gy;
}

// local copy of the cosine window (road.js keeps its own private)
function windowFn2(s, r0, r1, f0, f1) {
  s = wrapS(s);
  if (s <= r0 || s >= f1) return 0;
  if (s < r1) return 0.5 - 0.5 * Math.cos(Math.PI * (s - r0) / (r1 - r0));
  if (s <= f0) return 1;
  return 0.5 + 0.5 * Math.cos(Math.PI * (s - f0) / (f1 - f0));
}

// tileable mottle: breaks up the flat vertex-colored ground so it reads as
// grass/soil instead of smooth plastic. Mostly-white values multiply over the
// zone tints without shifting them.
function groundDetailTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e9e9e9';
  g.fillRect(0, 0, 256, 256);
  const rand = rng(31337);
  for (let i = 0; i < 5200; i++) {
    const v = 205 + (rand() * 50) | 0;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect((rand() * 256) | 0, (rand() * 256) | 0, 1 + (rand() * 2 | 0), 1 + (rand() * 2 | 0));
  }
  for (let i = 0; i < 60; i++) { // soft blotches (worn dirt / thicker growth)
    const x = rand() * 256, y = rand() * 256, r = 8 + rand() * 26;
    const dark = rand() < 0.5;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, dark ? 'rgba(120,118,110,0.16)' : 'rgba(255,255,255,0.14)');
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function buildTerrain(scene) {
  const latSamples = [-420, -300, -200, -130, -80, -47, -19, 19, 47, 80, 130, 200, 300, 420];
  const sStep = 40;
  const nS = Math.ceil(LOOP_LENGTH / sStep);
  const nL = latSamples.length;
  const positions = new Float32Array(nS * nL * 3);
  const uvs = new Float32Array(nS * nL * 2);
  const colors = new Float32Array(nS * nL * 3);
  const idx = [];
  const p = new THREE.Vector3();
  const col = new THREE.Color();
  // ground tint per zone key (any map)
  const ZONE_COLS = {
    suburb: 0x51763f, philly: 0x6a6d68, flat: 0x86904d,
    mumbai: 0x8a7f6d, chembur: 0x726d61, puneX: 0x33612e, pune: 0x8a7f6d, pcmc: 0x8a7f6d, cincy: 0x5f7250,
    d_gurgaon: 0x8a8272, d_nh48: 0x8a8272, d_igi: 0x8f887a, d_dhaula: 0x6f7a52,
    d_lutyens: 0x4f7040, d_cp: 0x8a8272, d_ito: 0x8a8272, d_yamuna: 0x7d8060,
    d_noida: 0x8a8272, d_ring: 0x7d7a66, d_pbagh: 0x8a8272, d_bgarh: 0x8f8668,
    d_sampla: 0x9a8f55, d_rohtak: 0x8f8668,
    dk_delhi: 0x8a8272, dk_ghaziabad: 0x978b68, dk_aligarh: 0x9a8d55, dk_etawah: 0x8d914e,
    dk_kanpur: 0x8a8d59, dk_fatehpur: 0x909257, dk_prayagraj: 0x7d9050, dk_mirzapur: 0x7d8b54,
    dk_varanasi: 0x78905a, dk_chandauli: 0x718c58, dk_mohania: 0x6c8854, dk_sasaram: 0x668451,
    dk_aurangabad: 0x6b8654, dk_gaya: 0x648052, dk_barhi: 0x527548, dk_hazaribagh: 0x466f42,
    dk_dhanbad: 0x5d6c50, dk_asansol: 0x58754c, dk_durgapur: 0x4f754b, dk_bardhaman: 0x527f4f,
    dk_dankuni: 0x557f58, dk_kolkata: 0x666f62,
    bandra: 0x8a7f6d, sealink: 0x6d7a80, marine: 0x8a7f6d,
    // Aundh–Baner: dusty urban earth, greener under the Pashan tekdi
    p_gaon: 0x8a7f6d, p_aundh: 0x8a7f6d, p_link: 0x877e68, p_baner: 0x84806e,
    p_bale: 0x7f7d70, p_pashan: 0x6d7a52, p_iti: 0x8a7f6d,
    newhaven: 0x5d7247, corridor: 0x4f7040, bronx: 0x6a6d68, pa: 0x54763f,
    chester_west: 0x547244, chester_wooded: 0x46683b, chester_retail: 0x5f6d55, chester_school: 0x4f6c43, chester_south: 0x536f46,
    boston95: 0x66696a, providence: 0x63675f, ctshore: 0x4f7040,
    // DE→FL true-scale run: Delmarva/Piedmont green-brown, red Piedmont clay
    // through VA, sandy pine flatwoods NC/SC/GA, palmetto scrub + urban grey
    // down the FL Gold Coast
    de_newark: 0x577244, de_wilmington: 0x66696a,
    md_perryville: 0x54763f, md_harford: 0x577244, md_baltimore: 0x66696a,
    md_laurel: 0x53763f, md_beltway: 0x62655f,
    va_springfield: 0x5f625f, va_fredvburg: 0x6b7248, va_ashland: 0x77714a,
    va_richmond: 0x66696a, va_petersburg: 0x6a7048, va_southside: 0x71753f,
    nc_roanokerap: 0x74773f, nc_rockymount: 0x777a44, nc_fayetteville: 0x676a5c,
    nc_lumberton: 0x527545,
    sc_dillon: 0x4f7645, sc_florence: 0x666a5c, sc_santee: 0x557548,
    sc_walterboro: 0x4c7248,
    ga_midway: 0x4a7048, ga_savannah: 0x666a5c, ga_kingsland: 0x4a7048,
    fl_jax: 0x62655f, fl_daytona: 0x6b7248, fl_melbourne: 0x577a52,
    fl_stlucie: 0x5c7d54, fl_wpb: 0x63655c, fl_ftlaud: 0x5f615f, fl_miami: 0x5a5e5c,
    plains: 0x86904d, westchester: 0x4d6e3f, njsouth: 0x53763f, andheriW: 0x8a7f6d,
    airport: 0x7c7a72,
    i294: 0x62645f, southland: 0x5d605c, borman: 0x565b59,
    gary: 0x5f6a55, i65: 0x86904d, indy: 0x5f625d, i74: 0x8a9247,
    millcreek: 0x6b7060, sharonville: 0x5d7247, wchester75: 0x577445,
    middletown: 0x5d7444, franklin75: 0x83904c, moraine: 0x577244, dayton: 0x5f7250,
    hills: 0x3f6b33, downtown: 0x6a6d68,
    ord: 0x6a6f66, i90ken: 0x64665f, chidt: 0x62636a, danryan: 0x5f615f,
    skyway: 0x596066, i80: 0x6a6a62,
    perthamboy: 0x6a6d68, piscataway: 0x53763f, bridgewater: 0x4d6e3f,
    morristown: 0x466a38, ramapo: 0x3d6233,
    rockland: 0x3f6b33, tappanzee: 0x4a6068, westch: 0x466a38,
    yonkers: 0x66696a, nybronx: 0x6a6d68, gwb287: 0x66696a,
    gsp_i95: 0x51763f, gsp_rahway: 0x51763f, gsp_union: 0x53763f, gsp_essex: 0x557040,
    gsp_clifton: 0x4f7040, gsp_paterson: 0x466a38, gsp_north: 0x3a6330, gsp_ny: 0x386428,
    // GSP south: salt-marsh green at Cape May, sandy pine-forest floor through
    // the Barrens, suburban green up the shore counties
    gsp_capemay: 0x6f8560, gsp_seashore: 0x5f7f55, gsp_atlantic: 0x577547,
    gsp_pines: 0x4a6b38, gsp_ocean: 0x527046, gsp_lakewood: 0x53724a,
    gsp_monmouth: 0x4f7040, gsp_raritan: 0x557040,
    // Philadelphia → Atlantic City: urban grey, river, SJ suburbs, sandy pines,
    // salt marsh at the shore end
    philly76: 0x6a6d68, wwb: 0x5a6668, gloucester: 0x5f6a55, nj42: 0x53724a,
    acx_west: 0x4f7040, acx_pines: 0x4a6b38, acx_egg: 0x527046, acx_ac: 0x6f8560,
    // Bay Area: golden-brown California hills + urban grey
    sf: 0x66696a, baybridge: 0x3a5a70, oakland: 0x64665f, i580: 0x8a8248, dublin: 0x86904d,
    i680: 0x8f8748, vallejo: 0x82904a, richmond: 0x66696a, eastbay: 0x66696a,
    i91: 0x466a38, hartford: 0x60685c, i84: 0x3f6b33, masspike: 0x46703a,
    boston: 0x66696a, logan: 0x6a6f66,
    fortlee: 0x6a6d68, njsub80: 0x51763f, njgap: 0x3d6233, poconos: 0x35602b,
    paridge: 0x386428, paplat: 0x4f7a3a, ohio80: 0x5f7d3e, cleveland: 0x66696a,
    toledo: 0x82904a, inturnpike: 0x86904d, chi80: 0x5f6a55,
    // NYC + Long Island: dense urban grey through the city, greener out on LI
    gwb: 0x5a6b58, washheights: 0x64676a, harlem: 0x66696a, ues: 0x66696a,
    midtown: 0x62636a, tunnel: 0x5f615f, lic: 0x64665f, woodside: 0x60685c,
    corona: 0x5f6a55, flushing: 0x557040, newhydepark: 0x557040, mineola: 0x54763f,
    jericho: 0x557040, li_return: 0x4f7040,
    // US-1 NJ: urban grey through the cities, some green in the corridor
    trenton: 0x64676a, lawrence: 0x557040, princeton: 0x557040, nbrunswick: 0x5f6a55,
    newbrunswick: 0x64676a, edison: 0x5f6a55, iselin: 0x60685c, woodbridge: 0x5f6a55,
    linden: 0x66696a, elizabeth: 0x66696a, newark1: 0x66696a, pulaski: 0x4a5560,
    jerseycity: 0x64676a, us1_return: 0x5f6a55,
    // I-78: explicit corridor surfaces. The metro end is concrete/asphalt gray,
    // never the default green used for unclassified rural zones.
    i78_lebanon: 0x426b35, i78_blueridge: 0x31572c, i78_lehigh: 0x536b46,
    i78_easton: 0x496743, i78_hunterdon: 0x345c30, i78_watchung: 0x3d6337,
    i78_newark: 0x63655f, i78_newarkbay: 0x465158, i78_jerseycity: 0x595b5d,
    i78_holland: 0x44484b, i78_manhattan: 0x55575a, i78_return: 0x3f6040,
    // Portugal A1: Atlantic green in the north, sun-dried gold across the
    // Ribatejo, pine-dark through the Pinhal
    pt_lisboa: 0x7c7a6e, pt_vfx: 0x6d7a52, pt_ribatejo: 0x8a8a54, pt_santarem: 0x848450,
    pt_fatima: 0x74784e, pt_leiria: 0x3f6b33, pt_pombal: 0x4a7038, pt_coimbra: 0x4f7040,
    pt_bairrada: 0x5d7a45, pt_aveiro: 0x5f8050, pt_gaia: 0x527544, pt_porto: 0x66696a,
    // Spain A-4: this is DRY country — ochre meseta, dun olive hills, gold
    // stubble around Écija. Nothing lush south of Aranjuez.
    es_madrid: 0x7c7a6e, es_sur: 0x8f875e, es_aranjuez: 0x7f8a50, es_ocana: 0xa08b52,
    es_mancha: 0xa8905a, es_valdepenas: 0x96854e, es_despena: 0x7a6f52, es_bailen: 0x9c8a50,
    es_andujar: 0x8f8248, es_cordoba: 0x9a8a55, es_ecija: 0xa89454, es_carmona: 0x9c8e58,
    es_sevilla: 0x8a845c,
    // Germany A3: genuinely green — deep forest shades over the ranges
    de_ffm: 0x64676a, de_wiesbaden: 0x4d6e3f, de_taunus: 0x35602b, de_limburg: 0x466a38,
    de_montabaur: 0x35602b, de_westerwald: 0x2f5a28, de_siebengebirge: 0x386428,
    de_bonn: 0x5a6b58, de_lohmar: 0x3d6233, de_koeln: 0x66696a,
    // Britain: hedgerow green all the way, chalk-pale over the Downs at Dover
    uk_bham: 0x64676a, uk_m6: 0x4a7038, uk_m1n: 0x4f7040, uk_mk: 0x53763f,
    uk_luton: 0x4d6e3f, uk_nlondon: 0x5f6a55, uk_london: 0x64676a, uk_slondon: 0x5f6a55,
    uk_m20w: 0x4a7038, uk_kent: 0x4f7a3a, uk_ashford: 0x53763f, uk_dover: 0x8a8f78,
    // Northern France: green Picardie farmland with pale chalky field tones
    fr_calais: 0x6d7a68, fr_boulogne: 0x4d7040, fr_opale: 0x5d7a45, fr_somme: 0x6f8050,
    fr_amiens: 0x5f7a48, fr_picardie: 0x7a8450, fr_beauvais: 0x5f7a48, fr_oise: 0x53763f,
    fr_stdenis: 0x64676a, fr_paris: 0x6a6d68,
    // Italy: sun-dried Mediterranean green-gold down the Valle Latina
    it_roma: 0x7c7a6e, it_castelli: 0x6d7a52, it_colleferro: 0x7a8450,
    it_frosinone: 0x84864e, it_ceprano: 0x7a8450, it_cassino: 0x6d7a52,
    it_sanvittore: 0x5d7a45, it_caianello: 0x7a8450, it_caserta: 0x84864e,
    it_napoli: 0x74766a,
  };
  const zoneCols = ZONES.map(z => new THREE.Color(ZONE_COLS[z.key] ?? 0x51763f));
  const cRock = new THREE.Color(0x7a7568);
  const cSnow = new THREE.Color(0xe6eaee);
  const cWater = new THREE.Color(0x27506b);
  const cCorn = new THREE.Color(0x9aa544);
  const cSoy = new THREE.Color(0x5d8a3c);
  const cDirt = new THREE.Color(0x9a7d55);

  for (let i = 0; i < nS; i++) {
    const s = i * sStep;
    const wz = ZONES.map(z => zoneWeight(z.key, s));
    const wm = zoneWeight('mountain', s);
    const wf = zoneWeight('flat', s) + zoneWeight('plains', s)
      + zoneWeight('i65', s) + zoneWeight('i74', s);   // midwest farmland crop bands
    for (let j = 0; j < nL; j++) {
      const lat = latSamples[j];
      posAt(s, lat, p);
      p.y = groundY(s, lat);
      const k = (i * nL + j) * 3;
      positions[k] = p.x; positions[k + 1] = p.y; positions[k + 2] = p.z;
      const k2 = (i * nL + j) * 2;
      uvs[k2] = s / 14; uvs[k2 + 1] = lat / 14;
      let wSum = 0, r = 0, g2 = 0, b2 = 0;
      for (let zi = 0; zi < wz.length; zi++) {
        wSum += wz[zi];
        r += zoneCols[zi].r * wz[zi];
        g2 += zoneCols[zi].g * wz[zi];
        b2 += zoneCols[zi].b * wz[zi];
      }
      if (wSum === 0) { wSum = 1; r = zoneCols[0].r; g2 = zoneCols[0].g; b2 = zoneCols[0].b; }
      col.setRGB(r / wSum, g2 / wSum, b2 / wSum);
      if (wm > 0.3 && p.y > 22) col.lerp(cRock, Math.min(1, (p.y - 22) / 30));
      if (wm > 0.3 && p.y > 55) col.lerp(cSnow, Math.min(1, (p.y - 55) / 30)); // snowline
      if (p.y < -2.5) col.lerp(cWater, Math.min(1, (-p.y - 2.5) / 3)); // river basins
      // Indiana / Illinois plains: alternating crop fields
      if (wf > 0.5 && Math.abs(lat) > 25) {
        const band = Math.floor((s + lat * 3) / 130) % 3;
        col.lerp(band === 0 ? cCorn : band === 1 ? cSoy : cDirt, 0.55 * Math.min(1, wf));
      }
      const shade = 0.92 + 0.16 * Math.sin(s * 0.037 + lat * 0.05);
      col.multiplyScalar(shade);
      colors[k] = col.r; colors[k + 1] = col.g; colors[k + 2] = col.b;
    }
  }
  for (let i = 0; i < nS; i++) {
    const i2 = (i + 1) % nS; // close the loop
    for (let j = 0; j < nL - 1; j++) {
      const a = i * nL + j, b = i2 * nL + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const detail = groundDetailTexture();
  terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, map: detail,
    bumpMap: detail, bumpScale: 0.4,
  });
  const mesh = new THREE.Mesh(g, terrainMat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Far base plane so gaps never show sky through
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(6000, 48),
    new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 1 })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -1.2;
  scene.add(base);
}

// ---------------------------------------------------------------------------
// Facade texture for towers (windows; emissive at night)
// ---------------------------------------------------------------------------
export function facadeTexture(seed) {
  const w = 128, h = 256;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  // This texture is also the daytime diffuse map.  A near-black base made
  // every facade collapse to black whenever its night emissive pass was off.
  // Keep a charcoal facade, but leave enough albedo for daylight/overcast
  // illumination to reveal the building's colour and shape.
  g.fillStyle = '#454b54';
  g.fillRect(0, 0, w, h);
  const rand = rng(seed);
  const cols = 8, rows = 24;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rand() < 0.42;
      const warm = rand() < 0.7;
      g.fillStyle = lit
        ? (warm ? `rgba(255,214,140,${0.55 + 0.45 * rand()})` : `rgba(190,220,255,${0.5 + 0.4 * rand()})`)
        : 'rgba(70,80,95,0.6)';
      g.fillRect(x * (w / cols) + 3, y * (h / rows) + 2, w / cols - 6, h / rows - 4);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Warm, sparse lit-window emissive for houses and suburban low-rise. Only the
// windows glow (the gaps are black → no emissive), so by day (intensity 0) the
// box keeps its plain siding color and by night a handful of warm windows come
// on. One shared material memoized on the registry; registry.litLow ramps it.
let _lowLitTex = null;
export function lowLitMaterial(registry) {
  if (registry._litLowMat) return registry._litLowMat;
  if (!_lowLitTex) {
    // a grid of small windows (not big LED-panel cells): most dark, the lit
    // ones vary in warmth and brightness so a facade reads as ordinary lit
    // rooms rather than a uniform sign
    const w = 128, h = 128;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);       // black between windows = no glow
    const rand = rng(4242);
    const cols = 6, rows = 8;
    const cw = w / cols, ch = h / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (rand() < 0.62) continue;                       // most windows dark
        const b = 0.35 + 0.5 * rand();                     // varied brightness, kept soft
        const warm = rand() < 0.9;
        g.fillStyle = warm
          ? `rgba(255,214,150,${b})`
          : `rgba(200,220,255,${b * 0.9})`;                // occasional cool window
        // small pane centred in its cell, with margin so windows stay separated
        g.fillRect(x * cw + cw * 0.28, y * ch + ch * 0.22, cw * 0.44, ch * 0.5);
      }
    }
    _lowLitTex = new THREE.CanvasTexture(cv);
    _lowLitTex.colorSpace = THREE.SRGBColorSpace;
  }
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9,
    emissive: 0xffffff, emissiveMap: _lowLitTex, emissiveIntensity: 0,
  });
  (registry.litLow ||= []).push(mat);
  registry._litLowMat = mat;
  return mat;
}

// ---------------------------------------------------------------------------
// Zone dressing: buildings, houses, trees, barns, pines, rocks
// ---------------------------------------------------------------------------
export function scatterInstanced(scene, geo, mat, placements, { shadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  placements.forEach((pl, i) => {
    if (pl.quat) q.copy(pl.quat);
    else q.setFromAxisAngle(UP, pl.rot || 0);
    v.set(pl.sx || 1, pl.sy || 1, pl.sz || 1);
    m.compose(pl.pos, q, v);
    mesh.setMatrixAt(i, m);
    if (pl.color) mesh.setColorAt(i, pl.color);
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

// Lateral clearance the road needs at s: paved width plus the exit-ramp
// envelope near interchanges. Nothing solid may be placed inside this.
export function roadClearAt(s) {
  let clear = pavedHalfAt(s) + 1.5;
  // These map labels are surface-street junctions, not grade-separated
  // highway exits. Reserving the normal 48 m ramp envelope around every one
  // pushed all shops and housing away from the road and created empty lots.
  // The Andheri airport/coastal section keeps normal ramp clearance.
  if (MAP === 'aundh') return pavedHalfAt(s) + 5;
  if (MAP === 'andheri' && wrapS(s) < 20600) return pavedHalfAt(s) + 7.5;
  for (const ex of EXITS) {
    const d = Math.abs(wrapS(s) - ex.s);
    if (Math.min(d, LOOP_LENGTH - d) < RAMP_LENGTH + 140) clear += 48;
  }
  return clear;
}

// Push a sized placement fully off the pavement: |lat| must exceed the road
// clearance plus the object's rotated half-footprint.
export function clampOffRoad(pl, s, lat, margin = 0) {
  const halfExt = 0.62 * Math.max(pl.sx || 1, pl.sz || 1);
  const minLat = roadClearAt(s) + margin + halfExt;
  if (Math.abs(lat) < minLat) {
    const newLat = Math.sign(lat || 1) * minLat;
    posAt(s, newLat, pl.pos);
    pl.pos.y = groundY(s, newLat);
  }
  return pl;
}

export function placementsAlong(seedBase, s0, s1, step, latMin, latMax, fn, margin = 0) {
  const out = [];
  const rand = rng(seedBase);
  for (let s = s0; s < s1; s += step * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.25) continue;
      const lat = side * (latMin + rand() * (latMax - latMin));
      const pos = posAt(s, lat, new THREE.Vector3());
      pos.y = groundY(s, lat);
      const pl = fn(rand, pos, s, lat);
      if (pl) out.push(clampOffRoad(pl, s, lat, margin));
    }
  }
  return out;
}

function buildCity(scene, registry) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const tex = facadeTexture(7);
  const towerMat = new THREE.MeshStandardMaterial({
    map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0,
    roughness: 0.7, color: 0xffffff,
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

  const tints = [0xb8bcc4, 0x9aa4b0, 0xc9c2b4, 0x8e9aa8, 0xb2a89a, 0x7f8fa0, 0x6f7f95, 0xd0cabc];
  // Canyon walls: tight, tall, right up against the highway (stop at the Hudson)
  const near = placementsAlong(101, 0, 5550, 15, 32, 190, (rand, pos) => ({
    pos, rot: rand() * TAU,
    sx: 13 + rand() * 22, sz: 13 + rand() * 22,
    sy: 25 + Math.pow(rand(), 1.5) * 150,
    color: new THREE.Color(tints[(rand() * tints.length) | 0]),
  }));
  // Slender supertalls scattered through midtown
  const spires = placementsAlong(103, 0, 5450, 120, 45, 160, (rand, pos) => ({
    pos, rot: rand() * TAU,
    sx: 11 + rand() * 7, sz: 11 + rand() * 7,
    sy: 160 + rand() * 130,
    color: new THREE.Color(tints[(rand() * tints.length) | 0]),
  }));
  // Far skyline wall — bleeds into NJ so the turnpike sees Manhattan,
  // split so nothing stands in the Hudson
  const farFn = (rand, pos) => ({
    pos, rot: rand() * TAU,
    sx: 24 + rand() * 42, sz: 24 + rand() * 42,
    sy: 70 + Math.pow(rand(), 1.3) * 240,
    color: new THREE.Color(tints[(rand() * tints.length) | 0]),
  });
  const far = placementsAlong(102, 0, 5500, 20, 220, 560, farFn)
    .concat(placementsAlong(104, 6500, 8500, 20, 220, 560, farFn));
  registry.towerMats = [towerMat];
  scatterInstanced(scene, boxGeo, towerMat, near.concat(spires, far));

  buildTimesSquare(scene, registry);
}

// Times Square: canyon walls plastered in giant LED boards that glow day
// and night, midtown blocks 1200–4200.
const TS_ADS = [
  ['COCA-COLA', '#e0121a', '#fff'], ['HAMILTON', '#b8860b', '#111'],
  ['THE LION KING', '#d97b1f', '#111'], ['WICKED', '#0d6b3f', '#ffd23d'],
  ['SAMSUNG', '#0b3b8c', '#fff'], ["M&M'S WORLD", '#ffd23d', '#c8342a'],
  ['NASDAQ', '#005baa', '#fff'], ['TKTS', '#c8102e', '#fff'],
  ['BROADWAY', '#111111', '#ffd23d'], ['DISNEY', '#15355e', '#fff'],
  ['LIVE FROM NYC', '#6b1f8a', '#ffd23d'], ['PEPSI', '#0b3b8c', '#e0121a'],
];

function buildTimesSquare(scene, registry) {
  const rand = rng(2121);
  const mats = TS_ADS.map(([text, bg, fg]) => {
    const tex = billboardTexture(text, bg, fg);
    return new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55,
      roughness: 0.5, side: THREE.DoubleSide,
    });
  });
  registry.tsMats = mats;
  let k = 0;
  for (let s = 1200; s < 4200; s += 55 * (0.6 + rand() * 0.8)) {
    for (const side of [-1, 1]) {
      if (rand() < 0.2) continue;
      const lat = side * (24 + rand() * 12);
      const stack = 1 + (rand() * 3 | 0);
      for (let j = 0; j < stack; j++) {
        const w = 9 + rand() * 13, h = 4.5 + rand() * 6;
        const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats[k++ % mats.length]);
        board.position.copy(posAt(s + rand() * 20, lat, new THREE.Vector3()));
        board.position.y += 7 + j * (h + 2.5) + rand() * 3;
        board.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0) + (rand() - 0.5) * 0.15;
        scene.add(board);
      }
    }
  }
}

function roofGeometry() {
  // triangular prism, 1x1 footprint, apex at y=1
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -0.5, 0, -0.5,  0.5, 0, -0.5,  0, 1, -0.5,   // back gable
    -0.5, 0, 0.5,   0, 1, 0.5,     0.5, 0, 0.5,  // front gable
    -0.5, 0, -0.5,  0, 1, -0.5,    0, 1, 0.5,    // left slope a
    -0.5, 0, -0.5,  0, 1, 0.5,    -0.5, 0, 0.5,  // left slope b
    0.5, 0, -0.5,   0.5, 0, 0.5,   0, 1, 0.5,    // right slope a
    0.5, 0, -0.5,   0, 1, 0.5,     0, 1, -0.5,   // right slope b
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function billboardTexture(text, bg, fg) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 192);
  g.fillStyle = fg; g.textAlign = 'center';
  g.font = 'bold 72px "Helvetica Neue", Arial, sans-serif';
  g.fillText(text, 256, 118);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// I-65 corridor: Purdue is up at Exit 168 (Lafayette), IU billboards too
const INDIANA_ADS = [
  ['PURDUE UNIV · EXIT 168', '#000000', '#cfb991'], ['BOILER UP!', '#cfb991', '#111'],
  ['INDIANA UNIVERSITY', '#990000', '#fff'], ['IU HOOSIERS', '#990000', '#fff'],
  ['BECK\'S HYBRIDS', '#0d6b3f', '#fff'], ['FIREWORKS USA', '#ffd23d', '#c8342a'],
  ['DINER · EXIT 253', '#c8342a', '#fff'], ['GAS · FOOD', '#0d6b3f', '#fff'],
];

const BILLBOARD_ADS = [
  ['DINER · EXIT 6', '#c8342a', '#fff'], ['MOTEL $49', '#15355e', '#ffd23d'],
  ['OUTLETS 2 MI', '#f2f2ee', '#111'], ['LIQUOR', '#111111', '#ff3b30'],
  ['FIREWORKS', '#ffd23d', '#c8342a'], ['CASINO', '#3d1054', '#ffd23d'],
  ['GAS · FOOD', '#0d6b3f', '#fff'], ['ATTORNEY 1-800', '#f2f2ee', '#15355e'],
];

export function buildBillboards(scene, registry, seed, s0, s1, count, ads = BILLBOARD_ADS) {
  const rand = rng(seed);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b4f54, roughness: 0.6 });
  for (let i = 0; i < count; i++) {
    const s = s0 + ((i + 0.5) / count) * (s1 - s0) + rand() * 120;
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (roadClearAt(s) + 10 + rand() * 26);
    const [text, bg, fg] = ads[(rand() * ads.length) | 0];
    const tex = billboardTexture(text, bg, fg);
    const group = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 4.5),
      new THREE.MeshStandardMaterial({
        map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05,
        roughness: 0.7, side: THREE.DoubleSide,
      })
    );
    board.position.y = 11;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 9, 8), poleMat);
    pole.position.y = 4.5;
    group.add(board, pole);
    group.position.copy(posAt(s, lat, new THREE.Vector3()));
    group.position.y = groundY(s, lat);
    // face oncoming traffic on its side of the road
    group.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0) + (rand() - 0.5) * 0.2;
    group.userData.board = board;
    scene.add(group);
    registry.signs.push(group);
  }
}

// Big roadside ad copy for the whole-loop belt. Americana on the US maps,
// familiar brands + hoardings on the India maps.
const BIG_ADS_US = [
  ['SOUTH OF THE BORDER', '#e0121a', '#ffd23d'], ['PEDRO SEZ: KEEP GOING', '#f2b01e', '#c8102e'],
  ["McDONALD'S · NEXT EXIT", '#c8102e', '#ffd23d'], ['WAWA · 24 HR', '#c8102e', '#fff'],
  ['SHEETZ · FUEL', '#e0121a', '#ffd23d'], ["DUNKIN'", '#ff671f', '#6f2b8b'],
  ['GEICO · 15 MIN', '#0a7a3f', '#fff'], ['MOHEGAN SUN', '#1a1a1a', '#e8b923'],
  ['SIX FLAGS', '#0d6b3f', '#fff'], ["CABELA'S", '#14421f', '#fff'],
  ['HERSHEYPARK', '#5a2d0c', '#fff'], ['INJURY? CALL 1-800-LAW', '#f2f2ee', '#15355e'],
  ['ADULT SUPERSTORE', '#111', '#ff3b30'], ['CASINO · 24/7', '#3d1054', '#ffd23d'],
  ['JESUS SAVES', '#f2f2ee', '#15355e'], ['OUTLETS · EXIT 2', '#f2f2ee', '#111'],
  ['BUD LIGHT', '#0b3b8c', '#fff'], ['MOTEL 6 · $59', '#15355e', '#ffd23d'],
  ['FIREWORKS · BUY 1 GET 3', '#ffd23d', '#c8342a'], ['REAL ESTATE · SOLD', '#0a7a3f', '#fff'],
];
// European hoardings: the brands you actually pass on the A1 / A-4. Germany
// gets none — roadside advertising is banned along the autobahn.
const BIG_ADS_PT = [
  ['GALP', '#e8641b', '#fff'], ['CONTINENTE', '#e0121a', '#fff'],
  ['PINGO DOCE', '#0a7a3f', '#fff'], ['MEO · 5G', '#009de0', '#fff'],
  ['SUPER BOCK', '#c8102e', '#f2b01e'], ['SAGRES', '#0b3b8c', '#fff'],
  ['DELTA CAFÉS', '#5a2d0c', '#f2ede0'], ['TAP AIR PORTUGAL', '#0a7a3f', '#e0121a'],
  ['WORTEN', '#e0121a', '#fff'], ['MILLENNIUM BCP', '#c8102e', '#fff'],
  ['PASTÉIS DE BELÉM', '#0b3b8c', '#f2ede0'], ['VINHO DO PORTO', '#3d1054', '#f2b01e'],
  ['FÁTIMA · SANTUÁRIO', '#f2f2ee', '#15355e'], ['AUTO-ESTRADA SEGURA · 120', '#0d4f9e', '#fff'],
];
const BIG_ADS_ES = [
  ['REPSOL', '#e8641b', '#fff'], ['EL CORTE INGLÉS', '#0a7a3f', '#fff'],
  ['MOVISTAR', '#009de0', '#fff'], ['CRUZCAMPO', '#e0121a', '#f2b01e'],
  ['MAHOU', '#c8102e', '#fff'], ['IBERIA', '#f2f2ee', '#c8102e'],
  ['MERCADONA', '#0b3b8c', '#f2b01e'], ['SANTANDER', '#e0121a', '#fff'],
  ['TÍO PEPE', '#c8102e', '#f2b01e'], ['LOTERÍA DE NAVIDAD', '#f2b01e', '#c8102e'],
  ['SEAT', '#1a1a1a', '#e0121a'], ['ONCE', '#0a7a3f', '#fff'],
  ['ANDALUCÍA TE QUIERE', '#0a7a3f', '#fff'], ['JAMÓN IBÉRICO · VENTA', '#5a2d0c', '#f2ede0'],
];
const BIG_ADS_IT = [
  ['ENI · AGIP', '#f2b01e', '#1a1a1a'], ['AUTOGRILL', '#e0121a', '#fff'],
  ['BARILLA', '#0b3b8c', '#e0121a'], ['LAVAZZA', '#12356f', '#f2b01e'],
  ['FIAT', '#7a1020', '#fff'], ['TIM', '#0b3b8c', '#e0121a'],
  ['FERRERO ROCHER', '#5a2d0c', '#f2b01e'], ['CONAD', '#e0121a', '#f2b01e'],
  ['PERONI', '#0b3b8c', '#f2b01e'], ['TELEPASS ⟩⟩', '#e8b400', '#111'],
  ['REGGIA DI CASERTA', '#f2f2ee', '#15355e'], ['PIZZA · VERA NAPOLI', '#0a7a3f', '#e0121a'],
];
const BIG_ADS_FR = [
  ['TOTALENERGIES', '#e0121a', '#fff'], ['CARREFOUR', '#0b3b8c', '#e0121a'],
  ['E.LECLERC', '#0a7a3f', '#f2b01e'], ['ORANGE', '#1a1a1a', '#e8641b'],
  ['RENAULT', '#f2b01e', '#1a1a1a'], ['CRÉDIT AGRICOLE', '#0a7a3f', '#fff'],
  ['INTERMARCHÉ', '#e0121a', '#fff'], ['PMU', '#0a7a3f', '#f2b01e'],
  ['McDO · SORTIE 20', '#c8102e', '#ffd23d'], ['AIRE DE LA BAIE DE SOMME', '#0d4f9e', '#fff'],
  ['CATHÉDRALE D\'AMIENS', '#f2f2ee', '#15355e'], ['SANEF · PÉAGE t', '#e8641b', '#fff'],
];
const BIG_ADS_CH = [
  ['MIGROS', '#f57c00', '#fff'], ['COOP', '#e0121a', '#fff'],
  ['UBS', '#111', '#e0121a'], ['ROLEX', '#0a5c2e', '#f2c200'],
  ['NESTLÉ', '#0a2a6b', '#fff'], ['SWISSCOM', '#0a2a6b', '#e0121a'],
  ['LINDT · EXCELLENCE', '#5a2d0c', '#f2c200'], ['SBB · CFF · FFS', '#e0121a', '#fff'],
  ['TAG HEUER', '#111', '#e0121a'], ['RICOLA', '#0a7a3f', '#fff'],
  ['CREDIT SUISSE', '#0a2a6b', '#fff'], ['VIGNETTE · CHF 40', '#0b7d3e', '#fff'],
  ['ZERMATT · MATTERHORN', '#f2f2ee', '#15355e'], ['EMMI · CAFFÈ LATTE', '#e0121a', '#fff'],
];
const BIG_ADS_INDIA = [
  ['TATA', '#1a3a8c', '#fff'], ['AMUL · TASTE OF INDIA', '#e0121a', '#fff'],
  ['VODAFONE IDEA', '#e0121a', '#fff'], ['airtel', '#e0121a', '#fff'],
  ['PARLE-G', '#f2b01e', '#c8102e'], ['KINGFISHER', '#e0121a', '#f2b01e'],
  ['LIC · ZINDAGI KE SAATH', '#1a3a8c', '#f2b01e'], ['THUMS UP', '#c8102e', '#fff'],
  ['JIO · 5G', '#0a2a6b', '#e0121a'], ['FLIPKART', '#2874f0', '#f2b01e'],
  ['MRF TYRES', '#111', '#e0121a'], ['SBI', '#1a3a8c', '#fff'],
  ['DABUR', '#0a7a3f', '#fff'], ['HERO · SPLENDOR', '#e0121a', '#fff'],
  ['BOLLYWOOD · NOW SHOWING', '#3d1054', '#ffd23d'], ['NIRMA', '#f2b01e', '#e0121a'],
  [' maggi · 2-MINUTE', '#e0121a', '#f2b01e'], ['PAN MASALA', '#0a7a3f', '#f2b01e'],
  ['REAL ESTATE · 2BHK', '#1a3a8c', '#fff'], ['SANDEEP COACHING · IIT', '#c8102e', '#fff'],
];

// A billboard "belt" the whole way around the loop: big hoardings on both
// shoulders, packed tight through the cities (lanes ≥ 4 or the urban set) and
// thinning — but never vanishing — through the country. Every road map calls it.
export function buildBillboardBelt(scene, registry, seed, india = false, urbanKeys = new Set()) {
  // Germany bans autobahn advertising outright; Britain keeps its motorways
  // effectively hoarding-free too
  if (MAP === 'a3' || MAP === 'm1') return;
  const rand = rng(seed);
  const ads = india ? BIG_ADS_INDIA
    : MAP === 'a1' ? BIG_ADS_PT
    : MAP === 'a4' ? BIG_ADS_ES
    : MAP === 'a16' ? BIG_ADS_FR
    : MAP === 'a1it' ? BIG_ADS_IT
    : MAP === 'swiss' ? BIG_ADS_CH
    : BIG_ADS_US;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b4f54, roughness: 0.6 });
  let s = 0;
  while (s < LOOP_LENGTH) {
    const z = ZONES.find(zz => s >= zz.start && s < zz.end) || ZONES[0];
    const urban = urbanKeys.has(z.key) || (z.lanes || 2) >= 4;
    // Iberia posts far fewer hoardings than a US interstate
    let spacing = urban ? 190 + rand() * 150 : 620 + rand() * 520;
    // Libertia's rural companion routes are intentionally quieter: farms,
    // wind country, and open outskirts should not become a wall of hoardings.
    if ((MAP === 'i980' || MAP === 'us67') && !urban) spacing = 1800 + rand() * 2200;
    if (EURO) spacing *= 2.6;
    for (const side of [-1, 1]) {
      if (!urban && rand() < ((MAP === 'i980' || MAP === 'us67') ? 0.68 : 0.42)) continue;
      if (urban && rand() < 0.12) continue;
      const lat = side * (roadClearAt(s) + 9 + rand() * (urban ? 20 : 34));
      const stack = urban && rand() < 0.28 ? 2 : 1;   // stacked double-deckers in town
      for (let j = 0; j < stack; j++) {
        const w = 15 + rand() * 9, h = 6 + rand() * 3.5;
        const [text, bg, fg] = ads[(rand() * ads.length) | 0];
        const tex = billboardTexture(text, bg, fg);
        const group = new THREE.Group();
        const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
          map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.05, roughness: 0.7, side: THREE.DoubleSide,
        }));
        const poleH = 10 + rand() * 5;
        board.position.y = poleH + h / 2 + j * (h + 1.6);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, poleH, 8), poleMat);
        pole.position.y = poleH / 2;
        group.add(board); if (j === 0) group.add(pole);
        group.position.copy(posAt(s + rand() * 30, lat, new THREE.Vector3()));
        group.position.y = groundY(s, lat);
        group.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0) + (rand() - 0.5) * 0.18;
        group.userData.board = board;
        scene.add(group);
        registry.signs.push(group);
      }
    }
    s += spacing;
  }
}

// Continuous roadside sound-barrier wall (the tan/brown acoustic walls that line
// the NJ Turnpike and most NE freeways, blocking any view of what's behind them).
// Panels march just off each shoulder, following the road; occasional gaps for
// interchanges/overpasses. Cheap: baked into one instanced mesh per call.
export function buildNoiseWall(scene, s0, s1, opts = {}) {
  const { height = 5.2, seed = 930, step = 12, margin = 3.6, gapChance = 0.05, sides = [-1, 1] } = opts;
  const rand = rng(seed);
  const panel = new THREE.BoxGeometry(0.5, 1, 1); panel.translate(0, 0.5, 0);
  const cols = [0x9a8a68, 0x8f7f60, 0xa2916c, 0x877a5c, 0x94855f];  // weathered tan concrete
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96 });
  const placements = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const along = new THREE.Vector3(), across = new THREE.Vector3(), localUp = new THREE.Vector3();
  const basis = new THREE.Matrix4(), quat = new THREE.Quaternion();
  const gapRuns = new Map(sides.map(side => [side, 0]));
  for (let s = s0; s < s1; s += step) {
    const nextS = Math.min(s + step, s1);
    for (const side of sides) {
      const remaining = gapRuns.get(side) || 0;
      if (remaining > 0) {
        gapRuns.set(side, remaining - 1);
        continue;
      }
      // Openings represent ramps/bridges, so keep them in short coherent runs
      // instead of independently perforating the wall one panel at a time.
      if (rand() < gapChance / 3) {
        gapRuns.set(side, 1 + (rand() * 3 | 0));
        continue;
      }
      const latA = side * (pavedHalfAt(s) + margin);
      const latB = side * (pavedHalfAt(nextS) + margin);
      posAt(s, latA, a);
      posAt(nextS, latB, b);
      a.y = groundY(s, latA);
      b.y = groundY(nextS, latB);
      along.copy(b).sub(a);
      const length = along.length();
      if (length < 0.01) continue;
      along.multiplyScalar(1 / length);
      // Build a full 3-D basis instead of yaw-only panels. On I-287's grades
      // this keeps neighboring ends touching the terrain rather than floating,
      // burying themselves, or opening triangular seams between panels.
      across.set(along.z, 0, -along.x).normalize();
      localUp.copy(along).cross(across).normalize();
      basis.makeBasis(across, localUp, along);
      quat.setFromRotationMatrix(basis);
      placements.push({
        pos: new THREE.Vector3((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5),
        quat: quat.clone(), sx: 0.6,
        sy: height * (0.92 + rand() * 0.16), sz: length + 0.7,
        color: new THREE.Color(cols[(rand() * cols.length) | 0]),
      });
    }
  }
  scatterInstanced(scene, panel, mat, placements);
}

export function buildSuburb(scene, registry, s0 = 6450, s1 = 26200, opts = {}) {
  // `wall`: the NJ-Turnpike treatment — a continuous tan sound wall + a thick
  // tree screen line the shoulder and everything is set well back, so you can't
  // see the sprawl right against the highway. Off by default (kept for the
  // Midwest/Indy and Connecticut-town reuses, where close-in buildings read right).
  const { wall = false, turnpike = false, noiseWall = wall } = opts;
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
  const roofGeo = roofGeometry();
  const bodyMat = lowLitMaterial(registry);   // warm windows that light up at night
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x54463c, roughness: 0.95 });
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xe0dcd2];

  if (wall) {
    // continuous sound wall just off both shoulders + a dense tree belt in the
    // setback between wall and buildings — the classic walled-off Turnpike view
    if (noiseWall) buildNoiseWall(scene, s0, s1, { seed: 930 + ((s0 | 0) % 613) });
    buildTrees(scene, 2020, s0, s1, 12, 40, 150, 150);
  }
  // industrial sprawl (distribution centers, tank farms, smokestacks). Pulled
  // well back when walled; otherwise fronting the road as before.
  const whLat = turnpike ? 340 : wall ? 170 : 85;
  const tankLat = turnpike ? 380 : wall ? 190 : 100;
  const stackLat = turnpike ? 400 : wall ? 200 : 110;
  const whMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const whColors = [0xb9bcc0, 0x9aa0a6, 0xc8c4ba, 0x8d949c];
  scatterInstanced(scene, bodyGeo, whMat,
    placementsAlong(210, s0, s1, 90, whLat, whLat + 300, (rand, pos, s) => ({
      pos, rot: headingAt(s) + (rand() - 0.5) * 0.3,
      sx: 55 + rand() * 75, sy: 10 + rand() * 9, sz: 34 + rand() * 48,
      color: new THREE.Color(whColors[(rand() * whColors.length) | 0]),
    }), 25));
  const tankGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  tankGeo.translate(0, 0.5, 0);
  scatterInstanced(scene, tankGeo,
    new THREE.MeshStandardMaterial({ color: 0xd8d8d4, roughness: 0.5, metalness: 0.3 }),
    placementsAlong(211, s0, s1, 190, tankLat, tankLat + 240, (rand, pos) => ({
      pos, rot: 0, sx: 11 + rand() * 12, sy: 8 + rand() * 8, sz: 11 + rand() * 12,
    }), 25));
  const stackGeo = new THREE.CylinderGeometry(0.8, 1.3, 1, 8);
  stackGeo.translate(0, 0.5, 0);
  scatterInstanced(scene, stackGeo,
    new THREE.MeshStandardMaterial({ color: 0x8a4038, roughness: 0.8 }),
    placementsAlong(212, s0, s1, 300, stackLat, stackLat + 250, (rand, pos) => ({
      pos, rot: 0, sx: 2.8, sy: 36 + rand() * 28, sz: 2.8,
    }), 25));

  // Strip malls and houses do not belong immediately beside the NJ Turnpike.
  // Keep the corridor to walls, distant plants, and open land there.
  if (turnpike) {
    buildTrees(scene, 202, s0, s1, 34, 150, 360, 90);
    buildBillboards(scene, registry, 206, s0 + 50, s1 - 100, 34);
    deepSprawl(scene, 8600 + ((s0 | 0) % 997), s0, s1, { towers: false, latStart: 320, litMat: bodyMat });
    return;
  }

  // strip malls + big-box stores (hugging the road normally; set back when walled)
  const mallLat = wall ? 160 : 70;
  const fasciaColors = [0xc8342a, 0x15355e, 0xd97b1f, 0x0d6b3f, 0x6b1f8a];
  const malls = placementsAlong(205, s0, s1, 110, mallLat, mallLat + 60, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2),
    sx: 34 + rand() * 34, sy: 5.5 + rand() * 3.5, sz: 16 + rand() * 10,
    color: new THREE.Color([0xd9d5cc, 0xc9c5bc, 0xb8b4ab][(rand() * 3) | 0]),
  }), 20);
  scatterInstanced(scene, bodyGeo, bodyMat, malls);
  // fascia sign strip across the front of each store
  scatterInstanced(scene, bodyGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    malls.map((m, i) => ({
      pos: m.pos.clone().setY(m.pos.y + m.sy * 0.72),
      rot: m.rot, sx: m.sx * 0.96, sy: 1.6, sz: m.sz + 0.6,
      color: new THREE.Color(fasciaColors[i % fasciaColors.length]),
    })));
  // parking aprons between store and road
  const lotMat = new THREE.MeshStandardMaterial({ color: 0x3b3c3e, roughness: 1 });
  scatterInstanced(scene, bodyGeo, lotMat, malls.map(m => ({
    pos: m.pos.clone().setY(m.pos.y + 0.02).sub(new THREE.Vector3()),
    rot: m.rot, sx: m.sx * 1.1, sy: 0.05, sz: 26,
  })), { shadow: false });

  // Endless ranch-house carpet behind the retail strip
  const houses = placementsAlong(201, s0, s1, 20, 150, 380, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.3,
    sx: 9 + rand() * 5, sy: 3.6 + rand() * 2.6, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, bodyGeo, bodyMat, houses);
  const roofs = houses.map(h => ({
    pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
    sx: h.sx * 1.08, sy: 2.2 + h.sy * 0.25, sz: h.sz * 1.08,
  }));
  scatterInstanced(scene, roofGeo, roofMat, roofs);

  buildTrees(scene, 202, s0, s1, 34, 150, 360, 90);
  buildBillboards(scene, registry, 206, s0 + 50, s1 - 100, 34);
  deepSprawl(scene, 8600 + ((s0 | 0) % 997), s0, s1, { towers: false, litMat: bodyMat });
}

// ---------------------------------------------------------------------------
// Deep metropolitan sprawl. The Northeast megalopolis doesn't stop at the first
// row of buildings — development recedes for miles. This lays receding layers
// BEHIND the front strip: mid-rise apartment/commercial blocks, then a low
// carpet of houses and warehouses, then a faint deep field with the odd downtown
// tower cluster on the horizon. Flat metro maps stay at grade far from the road,
// so the depth reads right; call it on the built-up zones.
// ---------------------------------------------------------------------------
export function deepSprawl(scene, seed, s0, s1, opts = {}) {
  const { density = 1, towers = true, glowMat = null, side = 0, latStart = 0, litMat = null } = opts;
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
  const flat = litMat || new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0, 0xe0dcd2, 0xbfae9a];
  const brick = [0x8f4a38, 0x9a5a44, 0x77503f, 0xa5866a, 0xb8b4ab, 0x8f7a63];
  const L = latStart;
  const bad = lat => side && Math.sign(lat) !== side;   // restrict to one bank if asked

  // NOTE: nothing residential fronts the shoulder — that's not how US interstates
  // are built. The roadside buffer is trees / sound walls / interchange commercial
  // (handled by buildSuburb + buildTrees); development recedes set-BACK from here.
  // mid ring: 2-4 story apartment + commercial blocks — set well BACK from the
  // road, behind the wooded buffer (interstates keep development off the shoulder)
  scatterInstanced(scene, box, flat,
    placementsAlong(seed, s0, s1, 22 / density, 175 + L, 470 + L, (r, pos, s, lat) => bad(lat) ? null : ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.4,
      sx: 12 + r() * 22, sy: 7 + Math.pow(r(), 1.3) * 24, sz: 12 + r() * 20,
      color: new THREE.Color(brick[(r() * brick.length) | 0]),
    }), 6));
  // far ring: low houses + warehouse boxes carpet
  scatterInstanced(scene, box, flat,
    placementsAlong(seed + 1, s0, s1, 15 / density, 430 + L, 840 + L, (r, pos, s, lat) => bad(lat) ? null : ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.5,
      sx: 9 + r() * 10, sy: 4 + r() * 5, sz: 9 + r() * 9,
      color: new THREE.Color(siding[(r() * siding.length) | 0]),
    }), 6));
  scatterInstanced(scene, box, new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.85 }),
    placementsAlong(seed + 2, s0, s1, 120 / density, 480 + L, 900 + L, (r, pos, s, lat) => bad(lat) ? null : ({
      pos, rot: headingAt(s) + (r() - 0.5) * 0.2, sx: 40 + r() * 60, sy: 8 + r() * 5, sz: 30 + r() * 50,
    }), 6));
  // deep field: faint carpet to the horizon
  scatterInstanced(scene, box, flat,
    placementsAlong(seed + 3, s0, s1, 26 / density, 840 + L, 1500 + L, (r, pos, s, lat) => bad(lat) ? null : ({
      pos, rot: r() * TAU, sx: 10 + r() * 14, sy: 5 + Math.pow(r(), 1.6) * 30, sz: 10 + r() * 14,
      color: new THREE.Color(0xffffff).multiplyScalar(0.7 + r() * 0.3),
    }), 6));
  // scattered downtown tower nodes rising out of the deep field (Newark, New
  // Brunswick, Jamaica…) — the skyline you always see off in the distance
  if (towers) {
    scatterInstanced(scene, box, glowMat || new THREE.MeshStandardMaterial({ color: 0xc8c4bc, roughness: 0.7 }),
      placementsAlong(seed + 4, s0, s1, 300 / density, 650 + L, 1350 + L, (r, pos, s, lat) => bad(lat) ? null : ({
        pos, rot: r() * TAU, sx: 16 + r() * 22, sy: 45 + Math.pow(r(), 1.3) * 100, sz: 16 + r() * 22,
        color: new THREE.Color(0xffffff).multiplyScalar(0.72 + r() * 0.32),
      }), 6));
  }
}

// Far wooded ridgeline (the NJ Highlands / Watchungs / Ramapos seen from the
// metro highways): big soft dark-green mounds rising past the sprawl, beyond
// the terrain mesh where real relief can't reach.
export function farRidge(scene, seed, s0, s1, side) {
  const hillGeo = new THREE.IcosahedronGeometry(1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2e4f28, roughness: 1, flatShading: true });
  const rand = rng(seed);
  const places = [];
  for (let s = s0; s < s1; s += 500 + rand() * 500) {
    const lat = side * (750 + rand() * 650);
    const pos = posAt(s, lat, new THREE.Vector3());
    pos.y = -12;
    places.push({
      pos, rot: rand() * TAU,
      sx: 320 + rand() * 320, sy: 55 + rand() * 55, sz: 320 + rand() * 320,
    });
  }
  scatterInstanced(scene, hillGeo, mat, places, { shadow: false });
}

// season-aware materials: US deciduous crowns go brown in winter, the ground
// goes strawy. India has no winter, but the monsoon/dry-season swing is just
// as dramatic — India-tagged materials carry userData.dry/monsoon instead of
// userData.summer/winter and are driven by monsoonGreen (see main.js).
export const foliageMats = [];
let terrainMat = null;

export function buildTrees(scene, seed, s0, s1, step, latMin, latMax, count0, pine = false, scale = 1) {
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 2.5, 5); trunkGeo.translate(0, 1.25, 0);
  // Tree silhouettes change with the corridor: tight conifers in the Pine
  // Barrens/Florida, broad layered crowns in the Northeast, and smaller,
  // drought-tolerant canopies in Texas and California.
  const dry = MAP === 'tx45' || MAP === 'cal5' || MAP === 'bay';
  const lush = MAP === 'i95' || MAP === 'gsp' || MAP === 'newengland' || MAP === 'flturnpike' || MAP === 'chester' || MAP === 'bronxriver';
  const crownGeo = pine
    ? new THREE.ConeGeometry(1, lush ? 3.8 : 3.1, 7)
    : (lush ? new THREE.SphereGeometry(1.65, 7, 5) : new THREE.IcosahedronGeometry(dry ? 1.3 : 1.6, 0));
  crownGeo.translate(0, pine ? (lush ? 3.8 : 3.4) : (lush ? 4.25 : 4.1), 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const crownColor = pine ? (lush ? 0x24542e : 0x2c4a2e)
    : dry ? (MAP === 'cal5' ? 0x657844 : 0x4f713b) : (lush ? 0x356c36 : 0x3f6b33);
  const crownMat = new THREE.MeshStandardMaterial({ color: crownColor, roughness: 1 });
  if (MAP !== 'india' && MAP !== 'andheri' && MAP !== 'aundh' && !DELHIKOLKATA) {
    crownMat.userData.summer = new THREE.Color(crownColor);
    crownMat.userData.winter = new THREE.Color(pine ? 0x2c4a2e : 0x7a5c38); // pines stay green
    foliageMats.push(crownMat);
  } else {
    // dusty sun-baked olive through the dry season, deep saturated monsoon
    // green once the rains set in
    crownMat.userData.dry = new THREE.Color(pine ? 0x4a5a34 : 0x74753f);
    crownMat.userData.monsoon = new THREE.Color(pine ? 0x1f5a24 : 0x2f6b2a);
    foliageMats.push(crownMat);
  }
  const trees = placementsAlong(seed, s0, s1, step, latMin, latMax, (rand, pos, s, lat) => {
    if (pos.y < -1.2) return null;   // never plant in the rivers/bays
    // Mumbai/Pune city limits are built-up, not a North-American tree buffer.
    // Keep the deliberately placed avenue trees and tiny roadside pockets, but
    // let the city-specific building carpets own the middle/background view.
    if ((MAP === 'india' || MAP === 'andheri' || MAP === 'aundh') && Math.abs(lat) > 28) {
      const urban = ZONES.some(z => (
        ['mumbai', 'chembur', 'pune', 'pcmc', 'andheriW', 'airport', 'bandra', 'sealink', 'marine',
          'p_gaon', 'p_aundh', 'p_link', 'p_baner', 'p_bale', 'p_pashan', 'p_iti'].includes(z.key)
        && s >= z.start && s < z.end));
      if (urban) return null;
    }
    const sc = (0.8 + rand() * (pine ? 2.6 : (lush ? 2.0 : 1.6))) * scale;
    return { pos, rot: rand() * TAU, sx: sc, sy: sc * (0.9 + rand() * 0.5), sz: sc };
  });
  scatterInstanced(scene, trunkGeo, trunkMat, trees, { shadow: false });
  scatterInstanced(scene, crownGeo, crownMat, trees, { shadow: false });
}

// Blanket forest for a whole map: layered tree bands from just off the
// shoulder out to the horizon, the entire way around the loop, so no stretch
// of roadside ever reads as empty lawn. Rivers/bays are skipped (buildTrees
// culls anything below water level) and buildings simply rise among the
// trees. factor scales density: 1 = northeastern hardwood forest,
// ~0.35 = farm-country hedgerows, 0 = off.
export function forestFill(scene, factor = 1, s0 = 0, s1 = LOOP_LENGTH, seedOffset = 0) {
  if (factor <= 0) return;
  const band = (seed, step, latMin, latMax, pine, scale = 1) =>
    buildTrees(scene, seed + seedOffset, s0, s1, step / factor, latMin, latMax, 0, pine, scale);
  // a thick, tall roadside tree wall right off the shoulder — interstates are set
  // well back behind a wooded buffer, so development sits screened beyond it
  const wallBoost = (MAP === 'i95' || MAP === 'gsp' || MAP === 'flturnpike' || MAP === 'newengland' || MAP === 'bronxriver') ? 1.25 : 1;
  band(77001, 6 / wallBoost, 30, 150, false, 1.15 * wallBoost);   // dense roadside wall, closer + taller
  band(77002, 8 / wallBoost, 34, 165, true, 1.15 * wallBoost);
  band(77003, 11, 150, 470, false, 1.1);  // mid-distance woods
  band(77004, 13, 165, 500, true, 1.1);
  band(77005, 15, 460, 1050, false);      // horizon canopy
  band(77006, 18, 490, 1050, true);
}

function buildFlat(scene, registry) {
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
  const roofGeo = roofGeometry();
  const barnMat = new THREE.MeshStandardMaterial({ color: 0x8e3b2e, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x666a70, roughness: 0.8 });
  const barns = placementsAlong(301, 28000, 34000, 300, 60, 350, (rand, pos, s) => ({
    pos, rot: headingAt(s), sx: 14 + rand() * 8, sy: 6 + rand() * 3, sz: 10 + rand() * 5,
  }));
  scatterInstanced(scene, bodyGeo, barnMat, barns);
  scatterInstanced(scene, roofGeo, roofMat, barns.map(b => ({
    pos: b.pos.clone().setY(b.pos.y + b.sy), rot: b.rot,
    sx: b.sx * 1.05, sy: 3.4, sz: b.sz * 1.05,
  })));
  // grain silos next to the barns
  const siloGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  siloGeo.translate(0, 0.5, 0);
  const siloMat = new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: 0.4, metalness: 0.6 });
  scatterInstanced(scene, siloGeo, siloMat, barns.map((b, i) => ({
    pos: b.pos.clone().add(new THREE.Vector3(0, 0, 0)).setY(b.pos.y),
    rot: 0, sx: 3.2 + (i % 3), sy: 11 + (i * 7) % 9, sz: 3.2 + (i % 3),
  })).map((p, i) => { p.pos.x += 12 + (i % 5) * 2; return p; }));
  // classic lone windbreak trees, very sparse
  buildTrees(scene, 302, 28000, 34000, 220, 60, 400, 40);
  buildBillboards(scene, registry, 306, 28100, 33900, 16, INDIANA_ADS);

  // I-65 terminates at the Indianapolis suburbs: a carpet of ranch houses
  const bodyMat2 = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const siding = [0xd8d2c3, 0xc4cdd4, 0xb9c4a8, 0xd9c6a8, 0xc9b9b0];
  const indy = placementsAlong(310, 33150, 33980, 18, 55, 300, (rand, pos, s, lat) => ({
    pos, rot: headingAt(s) + (lat > 0 ? -Math.PI / 2 : Math.PI / 2) + (rand() - 0.5) * 0.2,
    sx: 9 + rand() * 5, sy: 3.6 + rand() * 2.4, sz: 8 + rand() * 4,
    color: new THREE.Color(siding[(rand() * siding.length) | 0]),
  }));
  scatterInstanced(scene, bodyGeo, bodyMat2, indy);
  scatterInstanced(scene, roofGeo,
    new THREE.MeshStandardMaterial({ color: 0x54463c, roughness: 0.95 }),
    indy.map(h => ({
      pos: h.pos.clone().setY(h.pos.y + h.sy), rot: h.rot,
      sx: h.sx * 1.08, sy: 2 + h.sy * 0.25, sz: h.sz * 1.08,
    })));
}

// I-80 across Illinois: cornfield country rolling toward Indiana
function buildPlains(scene, registry) {
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1); bodyGeo.translate(0, 0.5, 0);
  const roofGeo = roofGeometry();
  const barnMat = new THREE.MeshStandardMaterial({ color: 0x8e3b2e, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x666a70, roughness: 0.8 });
  const barns = placementsAlong(701, 200, 27600, 340, 60, 350, (rand, pos, s) => ({
    pos, rot: headingAt(s), sx: 14 + rand() * 8, sy: 6 + rand() * 3, sz: 10 + rand() * 5,
  }));
  scatterInstanced(scene, bodyGeo, barnMat, barns);
  scatterInstanced(scene, roofGeo, roofMat, barns.map(b => ({
    pos: b.pos.clone().setY(b.pos.y + b.sy), rot: b.rot,
    sx: b.sx * 1.05, sy: 3.4, sz: b.sz * 1.05,
  })));
  buildTrees(scene, 702, 200, 27600, 200, 60, 400, 60);
  buildBillboards(scene, registry, 706, 400, 27400, 24);
}

// ---------------------------------------------------------------------------
// Sky / lighting / day-night
// ---------------------------------------------------------------------------
export function buildEnvironment(scene, registry) {
  buildTerrain(scene);
  // Map dressing lives with each map's builder (via main.js): i95 in i95.js,
  // India in mumbai.js/turnpike.js, midwest in midwest.js, i287 in i287.js.

  buildSky(scene, registry);

  // Keep direct daylight below the post stack's bloom range. The old 2.4
  // intensity combined with ACES + the HDR bright pass and produced a white
  // veil whenever the camera faced the sun, especially across the Northeast.
  const sun = new THREE.DirectionalLight(0xffffff, 1.75);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -140; sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140; sun.shadow.camera.bottom = -140;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.15;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x54503e, 0.7);
  scene.add(hemi);

  // Stars: a dome that follows the player (kept inside the far plane) with
  // per-star brightness so the field reads as depth, not a stencil
  const starCount = 1900;
  const sp = new Float32Array(starCount * 3);
  const sc = new Float32Array(starCount * 3);
  const srand = rng(999);
  const starTint = new THREE.Color();
  for (let i = 0; i < starCount; i++) {
    const a = srand() * TAU, e = Math.asin(srand() * 0.95);
    const r = 4400;
    sp[i * 3] = r * Math.cos(e) * Math.cos(a);
    sp[i * 3 + 1] = r * Math.sin(e) + 100;
    sp[i * 3 + 2] = r * Math.cos(e) * Math.sin(a);
    // magnitude spread: a few bright, most dim; occasional warm giant
    const mag = Math.pow(srand(), 2.2);
    starTint.setHSL(srand() < 0.12 ? 0.08 : 0.62, srand() < 0.3 ? 0.35 : 0.12, 0.55 + mag * 0.45);
    sc[i * 3] = starTint.r; sc[i * 3 + 1] = starTint.g; sc[i * 3 + 2] = starTint.b;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const starMat = new THREE.PointsMaterial({
    vertexColors: true, size: 2.6, sizeAttenuation: false, transparent: true,
    opacity: 0, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(sg, starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  scene.fog = new THREE.Fog(0x9db4c8, 80, 1500);

  registry.sun = sun;
  registry.hemi = hemi;
  registry.stars = stars;

  buildClouds(scene, registry);
}

// Drifting cumulus: a pool of soft sprites orbiting the camera in a big box,
// wrapping as they drift so the sky is never dead-clear. Coverage/opacity/tint
// are set per weather each frame in updateClouds().
function cloudTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const puff = (x, y, r, a = 0.95) => {
    const grad = g.createRadialGradient(x, y - r * 0.15, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.45, `rgba(252,253,255,${a * 0.6})`);
    grad.addColorStop(0.8, `rgba(244,248,252,${a * 0.2})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  };
  // cumulus: flat-ish base, billowing cauliflower top of many overlapping lobes
  const rand = rng(777);
  puff(128, 158, 74); puff(88, 168, 54); puff(170, 166, 58);
  for (let i = 0; i < 22; i++) {
    const x = 60 + rand() * 136;
    const y = 108 + rand() * 55;
    puff(x, y, 16 + rand() * 30, 0.5 + rand() * 0.45);
  }
  // wispy fringes
  for (let i = 0; i < 10; i++) {
    puff(50 + rand() * 156, 165 + rand() * 18, 10 + rand() * 16, 0.25);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildClouds(scene, registry) {
  const R = 1500, N = 40;
  const rand = rng(4242);
  const tex = cloudTexture();
  const sprites = [], data = [];
  for (let i = 0; i < N; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false,
    });
    const spr = new THREE.Sprite(mat);
    const scale = 320 + rand() * 460;
    spr.scale.set(scale * 1.5, scale, 1);
    spr.renderOrder = -2;
    scene.add(spr);
    sprites.push(spr);
    data.push({
      wx: (rand() * 2 - 1) * R, wz: (rand() * 2 - 1) * R,
      y: 300 + rand() * 380, spd: 0.6 + rand() * 0.8, cover: rand(),
    });
  }
  registry.clouds = { sprites, data, R, windX: 0.94, windZ: 0.34, lastT: 0 };
}

const _cloudTint = new THREE.Color();
export function updateClouds(registry, scene, camPos, t, weather, nightFactor) {
  const cl = registry.clouds;
  if (!cl) return;
  const R = cl.R, span = R * 2;
  let dt = t - cl.lastT; cl.lastT = t;
  if (!(dt > 0) || dt > 1) dt = dt > 1 ? 0.05 : 0;   // clamp jumps / pauses

  // coverage + look per weather
  let baseOp, grayMix, coverFrac;
  if (weather === 'rain' || weather === 'monsoon' || weather === 'overcast') {
    baseOp = 0.85; grayMix = 0.72; coverFrac = 1.0;
  } else if (weather === 'cloudy') {
    baseOp = 0.62; grayMix = 0.38; coverFrac = 0.9;
  } else {
    baseOp = 0.34; grayMix = 0.12; coverFrac = 0.5;   // clear: scattered fair-weather cumulus
  }
  baseOp *= (1 - 0.78 * nightFactor);

  // tint: sky-lit white by day, gray under cloud, dark at night
  _cloudTint.copy(registry.skyColor || _white)
    .lerp(_white, 0.55).lerp(_cloudGray, grayMix)
    .multiplyScalar(1 - 0.68 * nightFactor);

  const windX = cl.windX * 26, windZ = cl.windZ * 26;
  for (let i = 0; i < cl.sprites.length; i++) {
    const d = cl.data[i], spr = cl.sprites[i];
    d.wx += windX * d.spd * dt;
    d.wz += windZ * d.spd * dt;
    let dx = ((d.wx - camPos.x) % span + span * 1.5) % span - R;
    let dz = ((d.wz - camPos.z) % span + span * 1.5) % span - R;
    spr.position.set(camPos.x + dx, d.y, camPos.z + dz);
    const vis = d.cover < coverFrac;
    spr.visible = vis && baseOp > 0.02;
    if (spr.visible) {
      spr.material.opacity = baseOp * (0.7 + 0.3 * Math.sin(t * 0.05 + i));
      spr.material.color.copy(_cloudTint);
    }
  }
}
const _white = new THREE.Color(0xffffff);
const _cloudGray = new THREE.Color(0x8a929a);

const skyStops = {
  // night keeps a sodium-lit floor: highways are lit, nothing goes pitch black
  night: { sky: new THREE.Color(0x0a1020), fog: new THREE.Color(0x131a2a), hemi: 0.30, sunI: 0 },
  dawn:  { sky: new THREE.Color(0x8a6a8f), fog: new THREE.Color(0xc98a5e), hemi: 0.35, sunI: 0.9 },
  day:   { sky: new THREE.Color(0x7fb2e5), fog: new THREE.Color(0xb9cdd9), hemi: 0.76, sunI: 2.05 },
  dusk:  { sky: new THREE.Color(0x4a3a5e), fog: new THREE.Color(0xd07840), hemi: 0.30, sunI: 0.7 },
};

const _sky = new THREE.Color(), _fog = new THREE.Color();
const _winterGround = new THREE.Color(1.07, 0.96, 0.66); // slightly drier/yellower straw over vertex colors (NE/Midwest winter) — subtle
// India ground multipliers: parched/dusty through the dry season, darker and
// more saturated once the monsoon soaks the ground
const _indiaDryGround = new THREE.Color(1.12, 1.0, 0.76);
const _indiaMonsoonGround = new THREE.Color(0.74, 0.96, 0.7);

const monsoon = {
  sky: new THREE.Color(0x3f474e), fog: new THREE.Color(0x4a535c),
};
const overcastCol = {
  sky: new THREE.Color(0x8a929a), fog: new THREE.Color(0x9aa2aa), // winter gray
};
const rainCol = {
  sky: new THREE.Color(0x59626c), fog: new THREE.Color(0x6a737d), // wet gray
};
const cloudyCol = {
  sky: new THREE.Color(0xb2b8b4), fog: new THREE.Color(0xc6ccc4), // humid milk-white haze
};

// Month-aware daylight. Times are local clock time; DST moves solar noon to
// roughly 1 PM. Zone keys let long maps (notably I-95) transition between
// tropical/subtropical and northern daylight instead of using one latitude.
const isIndiaMap = MAP === 'india' || MAP === 'nh48' || MAP === 'andheri'
  || MAP === 'aundh' || MAP === 'newdelhi' || MAP === 'delhikolkata' || DELHIKOLKATA;
const isEuropeMap = ['a1', 'a4', 'a3', 'a16', 'm1', 'a1it', 'swiss'].includes(MAP);
const isDstMonth = month => !isIndiaMap && (isEuropeMap ? month >= 3 && month <= 9 : month >= 2 && month <= 10);

function daylightTimes(month = 6, zoneKey = '') {
  const m = THREE.MathUtils.clamp(Math.round(month), 0, 11);
  const summer = Math.cos((m - 6) * TAU / 12); // -1 January, +1 July
  const florida = zoneKey.startsWith('fltp_') || zoneKey === 'miami' || zoneKey === 'broward';
  let mean = 12.1, amplitude = 3.25;
  if (isIndiaMap) { mean = 12.35; amplitude = 0.75; }
  else if (florida) { mean = 12.15; amplitude = 1.25; }
  else if (isEuropeMap || MAP === 'm1') { mean = 12.2; amplitude = 4.0; }
  else if (MAP === 'tx45' || MAP === 'cal5' || MAP === 'bay') { mean = 12.15; amplitude = 2.2; }
  else if (MAP === 'midwest' || MAP === 'i80' || MAP === 'newengland') amplitude = 3.45;
  const dayLength = mean + amplitude * summer;
  const solarNoon = 12 + (isDstMonth(m) ? 1 : 0);
  return [solarNoon - dayLength / 2, solarNoon + dayLength / 2];
}

// piecewise remap: actual hour → standard tod where 0.25 = sunrise, 0.75 = sunset
function solarTod(tod, month, zoneKey) {
  const [rise, set] = daylightTimes(month, zoneKey);
  const h = tod * 24;
  if (h >= rise && h <= set) {
    return 0.25 + 0.5 * (h - rise) / (set - rise);
  }
  const nightLen = 24 - (set - rise);
  const since = h > set ? h - set : h + 24 - set;
  return (0.75 + 0.5 * (since / nightLen)) % 1;
}

// tod: 0..1, 0 = midnight. Returns nightFactor for other systems.
const _snowGroundCol = new THREE.Color(0xe8edf2);
const _snowCrownCol = new THREE.Color(0xdfe6ea);
export function updateEnvironment(scene, registry, tod, playerPos, weather = 'clear', season = 'summer', snowGround = 0, monsoonGreen = 0, month = 6, zoneKey = '', settledSnow = 0) {
  const st = solarTod(tod, month, zoneKey);
  const ang = (st - 0.25) * TAU;         // sun angle; st 0.25 = sunrise
  const elev = Math.sin(ang);            // -1..1
  // Keep the game fully dark through the low-sun band.  The horizon disc and
  // warm dawn/dusk wash otherwise read as a stray yellow sun during night
  // driving.  Daylight returns only once the sun is clearly up.
  const nightCutoff = 0.16;
  const daylight = THREE.MathUtils.smoothstep(elev, nightCutoff, nightCutoff + 0.10);
  const az = Math.cos(ang);

  const sun = registry.sun;
  sun.position.set(
    playerPos.x + az * 600,
    playerPos.y + elev * 800,
    playerPos.z + 250,
  );
  sun.target.position.copy(playerPos);
  sun.target.updateMatrixWorld();

  // blend stops by sun elevation
  let a, b, t;
  if (elev < nightCutoff) { a = skyStops.night; b = skyStops.night; t = 0; }
  else if (elev < 0.45) {
    a = elevSlope(st) >= 0 ? skyStops.dawn : skyStops.dusk;
    b = skyStops.day;
    t = (elev - nightCutoff) / 0.29;
  } else { a = skyStops.day; b = skyStops.day; t = 1; }

  _sky.copy(a.sky).lerp(b.sky, t);
  _fog.copy(a.fog).lerp(b.fog, t);
  scene.fog.color.copy(_fog);
  registry.hemi.intensity = a.hemi + (b.hemi - a.hemi) * t;
  sun.intensity = (a.sunI + (b.sunI - a.sunI) * t) * daylight;
  // Once the sun is below the horizon it must not continue to illuminate the
  // scene or appear as a yellow disc/glare through the sky dome.
  if (elev < nightCutoff) sun.intensity = 0;
  sun.color.setHSL(0.09, elev < 0.35 ? 0.7 : 0.15, elev < 0.35 ? 0.62 : 0.98);
  sun.castShadow = elev > 0.03;

  let nightFactor = elev < nightCutoff
    ? 1
    : THREE.MathUtils.clamp((0.1 - elev) / 0.25, 0, 1);

  if (weather === 'monsoon') {
    // grey rain light, but still clearly daytime — not a blackout
    _sky.lerp(monsoon.sky, 0.7 * (1 - nightFactor));
    _fog.lerp(monsoon.fog, 0.7 * (1 - nightFactor));
    scene.fog.color.copy(_fog);
    sun.intensity *= 0.62;
    registry.hemi.intensity = Math.max(registry.hemi.intensity * 0.9, 0.62);
    sun.castShadow = false;
    nightFactor = Math.max(nightFactor, 0.28); // lights come on in the rain
  } else if (weather === 'rain') {
    // American rain: overcast but bright daylight; headlights come on
    _sky.lerp(rainCol.sky, 0.58 * (1 - nightFactor));
    _fog.lerp(rainCol.fog, 0.58 * (1 - nightFactor));
    scene.fog.color.copy(_fog);
    sun.intensity *= 0.72;
    registry.hemi.intensity = Math.max(registry.hemi.intensity * 0.92, 0.66);
    sun.castShadow = false;
    nightFactor = Math.max(nightFactor, 0.22);
  } else if (weather === 'cloudy') {
    // humid summer overcast: bright but flat and hazy, no hard shadows
    _sky.lerp(cloudyCol.sky, 0.75 * (1 - nightFactor));
    _fog.lerp(cloudyCol.fog, 0.75 * (1 - nightFactor));
    scene.fog.color.copy(_fog);
    sun.intensity *= 0.62;
    registry.hemi.intensity = Math.max(registry.hemi.intensity * 0.9, 0.5);
    sun.castShadow = false;
  } else if (weather === 'overcast') {
    // American winter: flat gray cloud deck, weak diffuse light
    _sky.lerp(overcastCol.sky, 0.8 * (1 - nightFactor));
    _fog.lerp(overcastCol.fog, 0.8 * (1 - nightFactor));
    scene.fog.color.copy(_fog);
    sun.intensity *= 0.45;
    registry.hemi.intensity = Math.max(registry.hemi.intensity * 0.8, 0.35);
    sun.castShadow = false;
    nightFactor = Math.max(nightFactor, 0.2);
  }
  registry.stars.material.opacity = weather === 'clear' ? nightFactor * 0.9 : 0;
  registry.stars.position.copy(playerPos);   // keep the star dome overhead

  // hand the frame's sky to the shader dome: disc/glow visibility tracks the
  // cloud deck, and the disc fades out right at the horizon
  const sunVis = daylight * (weather === 'clear' ? 1 : weather === 'cloudy' ? 0.3
    : weather === 'overcast' ? 0.06 : 0.05);
  const horizonGate = THREE.MathUtils.clamp((elev + 0.05) / 0.12, 0, 1);
  setSkyState(registry, playerPos, _sky, _fog, sun.position, sun.color,
    sunVis * horizonGate * (0.55 + sun.intensity * 0.35), nightFactor);

  // streetlight halos: warm additive glow blobs after dark
  if (registry.streetlightHalos) registry.streetlightHalos.opacity = nightFactor * 0.82;

  // seasonal foliage + ground: brown trees and strawy grass in a US winter;
  // India has no winter but swings just as hard between monsoon-lush and
  // dry-season-parched, driven by monsoonGreen (ramps up under monsoon rain,
  // decays slowly through a dry spell — see main.js updateMonsoonGreen)
  if (MAP !== 'india' && MAP !== 'andheri' && MAP !== 'aundh' && !DELHIKOLKATA) {
    const winter = season === 'winter';
    for (const m of foliageMats) {
      m.color.copy(winter ? m.userData.winter : m.userData.summer);
      if (snowGround > 0.02) m.color.lerp(_snowCrownCol, snowGround * 0.7);   // dusted crowns
    }
    if (terrainMat) {
      terrainMat.color.setRGB(1, 1, 1).lerp(_winterGround, winter ? 1 : 0);
      const groundSnow = Math.max(snowGround, settledSnow);
      if (groundSnow > 0.02) terrainMat.color.lerp(_snowGroundCol, groundSnow); // white blanket
    }
  } else {
    for (const m of foliageMats) {
      if (!m.userData.dry) continue;
      m.color.copy(m.userData.dry).lerp(m.userData.monsoon, monsoonGreen);
    }
    if (terrainMat) {
      terrainMat.color.copy(_indiaDryGround).lerp(_indiaMonsoonGround, monsoonGreen);
    }
  }

  // lit windows + streetlights + sign glow — big-city skylines blaze at night
  // The facade map now carries usable daytime albedo, so a lower night
  // multiplier preserves the dark wall tone while windows still clear bloom.
  for (const m of registry.towerMats || []) m.emissiveIntensity = nightFactor * 3.4;
  // Chicago: cranked far brighter and in many window colours
  for (const m of registry.cityGlow || []) m.emissiveIntensity = nightFactor * 10;
  // the orange sky-glow domes hung over the skylines — bloom in hard after dusk
  // (squared so they stay invisible by day and light the sky deep at night)
  for (const m of registry.skyGlow || []) m.opacity = nightFactor * nightFactor * 0.95;
  // European low-rise fabric: a few warm windows lit as you pass through the
  // cities — lived-in, not a blazing skyline
  for (const m of registry.euroLit || []) m.emissiveIntensity = nightFactor * 1.3;
  // suburban houses + low-rise: warm windows come on after dark so no
  // neighbourhood ever reads as a black void at night
  for (const m of registry.litLow || []) m.emissiveIntensity = nightFactor * 1.15;
  for (const m of registry.cityBeacons || []) m.opacity = nightFactor * 0.95;
  for (const m of registry.crownMats || []) m.emissiveIntensity = 0.15 + nightFactor * 6.2;
  for (const m of registry.bridgeLightMats || []) m.emissiveIntensity = nightFactor * 12;
  if (registry.streetlightHeads) {
    registry.streetlightHeads.material.emissiveIntensity = nightFactor * 16;
  }
  for (const entry of registry.us67RoadLineMats || []) {
    entry.material.opacity = THREE.MathUtils.lerp(entry.day, entry.night, nightFactor);
  }
  for (const sgn of registry.signs || []) {
    sgn.userData.board.material.emissiveIntensity = 0.06 + nightFactor * 1.5;
  }
  // Times Square LED boards blaze at all hours, brighter after dark
  for (const m of registry.tsMats || []) m.emissiveIntensity = 0.55 + nightFactor * 1.0;
  return nightFactor;
}

function elevSlope(tod) {
  // rising before noon (tod<0.5), falling after
  return tod < 0.5 ? 1 : -1;
}
