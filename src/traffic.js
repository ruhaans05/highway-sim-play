import * as THREE from 'three';
import {
  MAP, LOOP_LENGTH, LANES_MAX, LANE_WIDTH, laneWidthAt, MEDIAN_HALF, NPC_COUNT, SPAWN_RADIUS, MPH,
  EXITS, RAMP_LENGTH, wrapS, loopDelta, zoneAt,
} from './config.js';
import {
  posAt, headingAt, latForLane, rampOffset, usableLanesAt, closedLanesAt, sideFactorAt, njGapAt,
  njDualDualAt, medianHalfAt, gwbLowerDrop, spurTAt, spurRiseAt, distanceScaleAt,
} from './road.js';
import { pickType, desiredSpeed, addNpcPlates, addNpcBlinkers, addBrandBadge, contactShadow } from './vehicles.js';
import { SIGNALS, signalState } from './mumbai.js';
import { AUNDH_STOPS } from './pune.js';

const LIBERTIA_MAP = ['libertia', 'i380', 'i980', 'lb24', 'us67'].includes(MAP);
const I680_WORK_ZONES = [2000, 7000, 13000, 19000, 33000, 136000, 178000];
// Long-haul freight stays visible overnight on these major corridors. The
// Midwest route includes the I-65 leg; nc40 includes the I-85 leg.
const LATE_NIGHT_FREIGHT_ROUTES = new Set(['i95', 'midwest', 'nc40']);

const mulberry = (() => {
  let a = 1234567;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

// IDM parameters
const IDM = { a: 1.5, b: 2.6, s0: 3.0, T: 1.45, delta: 4 };
const TRUCK_IDM = { a: 0.9, b: 2.2, s0: 4.0, T: 1.7, delta: 4 };
const MUMBAI_IDM = { a: 1.9, b: 3.0, s0: 1.4, T: 0.85, delta: 4 }; // bumper to bumper

// which physical side a lane change is toward: on right-hand-traffic roads a
// higher lane index is the right; on India's left-hand traffic it's the left.
const RIGHT_IS_HIGHER = !(MAP === 'india' || MAP === 'nh48' || MAP === 'andheri' || MAP === 'aundh' || MAP === 'newdelhi' || MAP === 'delhikolkata' || MAP === 'm1');
// flag a lane change so the NPC blinks the correct indicator (if it signals)
function setSignal(npc, delta) {
  if (!npc.usesSignal || !delta) return;
  const toRight = (delta > 0) === RIGHT_IS_HIGHER;
  npc.signal = toRight ? 1 : -1;   // 1 = right lamp, -1 = left lamp
  npc.signalHold = 1.7;            // blink through the manoeuvre
}

const ZONE_DENSITY = {
  brp_kensico: 1.0, brp_scarsdale: 1.12, brp_bronxville: 1.3, brp_woodlawn: 1.48,
  brp_bronx: 1.75, brp_story: 1.9, brp_bruckner: 2.25, brp_i295_bronx: 2.15,
  brp_throgs: 1.9, brp_bayside: 1.75, brp_i495: 2.35, brp_queensvillage: 1.85,
  suburb: 1.15, nj_central: 1.45, nj_industrial: 1.68, philly: 1.22, flat: 0.5,
  i78_lebanon: 0.55, i78_blueridge: 0.62, i78_lehigh: 1.15, i78_easton: 0.9,
  i78_hunterdon: 0.72, i78_watchung: 1.35, i78_newark: 2.0, i78_jerseycity: 2.35,
  i78_holland: 2.6, i78_manhattan: 2.8, i78_qmt: 2.7, i78_queens: 2.35,
  i78_nassau: 1.65, i78_jericho: 1.45, i78_terminus: 1.0,
  i280_parsippany: 1.05, i280_morris: 1.15, i280_essex: 1.45, i280_oranges: 1.85, i280_newark: 2.2,
  us22_phillipsburg: 0.72, us22_clinton: 0.9, us22_bridgewater: 1.55, us22_union: 2.0, us22_newark: 2.3,
  // India zone multipliers stack with a high NPC_COUNT and an always-busy
  // rushFactor baseline — kept below ~2.3 so the pool doesn't clip to 100%
  // active outside real rush hour (see rushFactor's INDIA_ZONE branch).
  mumbai: 2.35, chembur: 2.55, puneX: 0.9, pune: 2.1, pcmc: 1.5, cincy: 1.15, andheriW: 2.25, airport: 1.55,
  nh48_mumbai: 2.2, nh48_panvel: 1.45, nh48_ghat: .85, nh48_pune: 1.8, nh48_satara: .9,
  nh48_karad: .85, nh48_kolhapur: 1.2, nh48_border: .75, nh48_belagavi: 1.2,
  nh48_hubballi: 1.25, nh48_haveri: .65, nh48_davanagere: .95, nh48_tumakuru: 1.15, nh48_bengaluru: 2.0,
  p_gaon: 1.9, p_aundh: 2.1, p_link: 1.9, p_baner: 2.0, p_bale: 1.7, p_pashan: 1.3, p_iti: 2.2,
  d_gurgaon: 2.2, d_nh48: 2.0, d_igi: 1.6, d_dhaula: 2.2, d_lutyens: 1.6, d_cp: 2.6,
  d_ito: 2.8, d_yamuna: 1.8, d_noida: 1.8, d_ring: 2.2, d_pbagh: 2.2, d_bgarh: 1.4,
  d_sampla: 0.8, d_rohtak: 1.6,
  bandra: 1.8, sealink: 1.15, marine: 1.55,
  newhaven: 1.0, corridor: 0.9, bronx: 1.9, pa: 0.55, plains: 0.5,
  westchester: 1.0, njsouth: 1.05,
  boston95: 1.6, providence: 1.2, ctshore: 0.85,
  // DE → FL: packed through the metros (DC beltway, Baltimore, NoVA, Jax,
  // the Gold Coast), near-empty rural-Carolina/Georgia truck stretches
  de_newark: 1.1, de_wilmington: 1.0,
  md_perryville: 0.6, md_harford: 0.7, md_baltimore: 1.6, md_laurel: 1.2, md_beltway: 2.0,
  va_springfield: 2.0, va_fredvburg: 1.3, va_ashland: 0.8, va_richmond: 1.5,
  va_petersburg: 0.9, va_southside: 0.5,
  nc_roanokerap: 0.5, nc_rockymount: 0.85, nc_fayetteville: 1.0, nc_lumberton: 0.55,
  sc_dillon: 0.5, sc_florence: 0.9, sc_santee: 0.5, sc_walterboro: 0.55,
  ga_midway: 0.5, ga_savannah: 1.2, ga_kingsland: 0.55,
  fl_jax: 1.6, fl_daytona: 1.1, fl_melbourne: 0.95, fl_stlucie: 1.0,
  fl_wpb: 1.5, fl_ftlaud: 1.9, fl_miami: 2.1,
  gsp_i95: 1.4, gsp_rahway: 1.7, gsp_union: 1.95, gsp_essex: 1.85, gsp_clifton: 1.5,
  gsp_paterson: 1.5, gsp_north: 1.15, gsp_ny: 0.9,
  gsp_capemay: 0.6, gsp_seashore: 0.75, gsp_atlantic: 0.95, gsp_pines: 0.5,
  gsp_ocean: 0.95, gsp_lakewood: 1.2, gsp_monmouth: 1.4, gsp_raritan: 1.55,
  philly76: 1.7, wwb: 1.6, gloucester: 1.15, nj42: 1.35,
  acx_west: 0.9, acx_pines: 0.55, acx_egg: 0.9, acx_ac: 1.35,
  sf: 1.6, baybridge: 1.8, oakland: 1.9, i580: 1.5, dublin: 1.4, i680: 1.4,
  vallejo: 1.1, richmond: 1.5, eastbay: 1.8,
  perthamboy: 1.2, piscataway: 1.05, bridgewater: 0.85, morristown: 0.8, ramapo: 0.62,
  rockland: 0.7, tappanzee: 0.95, westch: 0.9, yonkers: 1.6, nybronx: 1.95, gwb287: 1.7,
  i294: 1.55, southland: 1.65, borman: 1.7, bishop: 1.5, gary: 1.55, i65: 0.95, indy: 1.35, i74: 0.85, hills: 0.65, downtown: 1.4,
  millcreek: 1.35, sharonville: 1.2, wchester75: 1.05, middletown: 0.95,
  franklin75: 0.85, moraine: 1.05, dayton: 1.3,
  // US-1 is a busy signalized NJ arterial — packed at rush, still emptying out
  // overnight via the time-of-day model. Kept high so it feels like Route 1.
  trenton: 1.15, lawrence: 0.85, princeton: 0.9, nbrunswick: 1.05, newbrunswick: 1.3,
  edison: 1.15, iselin: 1.0, woodbridge: 1.25, linden: 0.85, elizabeth: 1.1,
  newark1: 1.2, pulaski: 0.72, jerseycity: 1.4, us1_return: 0.78,
  // NYC: jammed through Manhattan (FDR/Harlem/Midtown), busy out the LIE
  gwb: 1.9, washheights: 1.9, harlem: 2.0, ues: 2.2, midtown: 2.4, tunnel: 1.8,
  lic: 1.9, woodside: 1.8, corona: 1.7, flushing: 1.6, newhydepark: 1.5,
  mineola: 1.4, jericho: 1.3, li_return: 1.0,
  i278_nj440: 1.55, i278_outerbridge: 1.75, i278_westshore: 1.65, i278_staten: 1.9, i278_verrazzano: 2.05,
  i278_brooklyn: 2.15, i278_brooklyn_south: 2.25, i278_kosciuszko: 2.3,
  i278_queens: 2.35, i278_rfk_approach: 2.45, i278_rfk: 2.1, i278_bronx: 2.4,
  belt_gravesend: 1.8, belt_jamaicabay: 1.5, jfk_airport: 1.9,
  ord: 1.0, i90ken: 1.6, chidt: 1.9, danryan: 1.8, skyway: 1.1, i80: 1.6,
  i91: 0.8, hartford: 1.4, i84: 0.7, masspike: 1.1, boston: 1.9, logan: 1.2,
  fortlee: 1.2, njsub80: 1.0, njgap: 0.5, poconos: 0.5, paridge: 0.45, paplat: 0.45,
  ohio80: 0.6, cleveland: 1.5, toledo: 0.9, inturnpike: 0.6, chi80: 1.4,
  // Libertia: sparse farm traffic, a very busy Reston core, then a steady
  // corporate/wealth corridor toward Jacobs.
  lib_south: 0.45, lib_southtowns: 0.68, lib_reston: 2.05,
  lib_corridor: 1.25, lib_jacobs: 1.45, lib_terminal: 0.8,
  i380_north: 1.65, i380_east: 2.0, i380_south: 1.8, i380_west: 1.45,
  i980_west: 0.95, i980_north: 1.25, i980_rural: 0.35, i980_south: 0.7,
  lb24_north: 1.2, lb24_core: 1.65, lb24_illinois: 1.1, lb24_south: 0.95,
  us67_jacobs: 2.15, us67_farms: 0.9, us67_towns: 1.05, us67_reston_east: 1.55,
  us67_reston_ne: 2.15, us67_tunnel: 2.0,
};

// European traffic has a different rhythm from the US routes: freight-heavy
// A3/A-4 corridors, quieter Alpine and coastal stretches, and sharp density
// rises around the capitals. Keep those differences centralized instead of
// duplicating every European zone in the main density table.
function zoneDensity(zoneKey) {
  if (ZONE_DENSITY[zoneKey] != null) return ZONE_DENSITY[zoneKey];
  if (zoneKey.startsWith('pt_')) {
    if (['pt_lisboa', 'pt_gaia', 'pt_porto'].includes(zoneKey)) return 1.45;
    if (['pt_santarem', 'pt_coimbra', 'pt_aveiro'].includes(zoneKey)) return 1.02;
    return 0.76;
  }
  if (zoneKey.startsWith('es_')) {
    if (['es_madrid', 'es_getafe', 'es_cordoba', 'es_sevilla'].includes(zoneKey)) return 1.42;
    if (['es_despena', 'es_bailen'].includes(zoneKey)) return 0.72;
    return 0.88; // long-distance freight keeps the A-4 occupied
  }
  if (zoneKey.startsWith('de_')) {
    if (['de_ffm', 'de_wiesbaden', 'de_bonn', 'de_koeln'].includes(zoneKey)) return 1.55;
    return 1.08; // dense Autobahn through-traffic even between cities
  }
  if (zoneKey.startsWith('uk_')) {
    if (['uk_bham', 'uk_nlondon', 'uk_london', 'uk_slondon'].includes(zoneKey)) return 1.72;
    if (['uk_luton', 'uk_mk', 'uk_m20w'].includes(zoneKey)) return 1.25;
    return 0.92;
  }
  if (zoneKey.startsWith('fr_')) {
    if (['fr_stdenis', 'fr_paris'].includes(zoneKey)) return 1.82;
    if (['fr_calais', 'fr_amiens', 'fr_beauvais'].includes(zoneKey)) return 1.08;
    return 0.72;
  }
  if (zoneKey.startsWith('it_')) {
    if (['it_roma', 'it_caserta', 'it_napoli'].includes(zoneKey)) return 1.58;
    if (['it_frosinone', 'it_cassino'].includes(zoneKey)) return 1.08;
    return 0.9;
  }
  if (zoneKey.startsWith('ch_')) {
    if (['ch_zurich', 'ch_bern', 'ch_lausanne', 'ch_geneve'].includes(zoneKey)) return 1.38;
    if (['ch_brunig', 'ch_interlaken'].includes(zoneKey)) return 0.62;
    return 0.92;
  }
  return 1;
}

// Manual levels are occupancy bands, not six nearly-identical multipliers.
// The floor keeps adjacent settings visibly distinct overnight, while the
// ceiling prevents a busy zone from flattening levels 1-5 against the pool
// limit. Automatic traffic bypasses these bands entirely.
const DENSITY_LEVEL_PROFILE = [
  { scale: 0.30, floor: 0.025, ceiling: 0.14 },
  { scale: 0.52, floor: 0.07,  ceiling: 0.26 },
  { scale: 0.80, floor: 0.15,  ceiling: 0.41 },
  { scale: 1.10, floor: 0.27,  ceiling: 0.59 },
  { scale: 1.48, floor: 0.68,  ceiling: 0.82 },
  { scale: 2.20, floor: 1.00,  ceiling: 1.00 },
];

// Toll plazas: everything crawls through the booths.
// Share of drivers who'll flash high beams when boxed in behind someone —
// regional driving culture. NJ/NY flash freely, the Midwest mostly waits,
// India leans on them constantly, German Autobahn left-lane flash-to-pass is
// a national institution, Italy close behind; Britain thinks it's rude.
const HB_SHARE = {
  i95: 0.22, gsp: 0.26, i287: 0.18, i278: 0.30, bronxriver: 0.29, i78: 0.30, acx: 0.2, nyc: 0.25, us1: 0.18,
  i80: 0.14, midwest: 0.14, newengland: 0.12, bay: 0.12,
  libertia: 0.34, i380: 0.31, i980: 0.22, lb24: 0.30, us67: 0.34,
  india: 0.6, andheri: 0.55, aundh: 0.5, newdelhi: 0.7, delhikolkata: 0.62,   // Indian routes lean on the dipper
  a3: 0.32, a1it: 0.26, a1: 0.08, a4: 0.08, a16: 0.1, m1: 0.05, swiss: 0.05,
}[MAP] ?? 0.15;
// How hard left-lane pressure builds on this map: NJ/NY and the Autobahn
// stack up behind a camper fast; the Midwest just cruises along behind.
const LANE_PRESSURE = {
  gsp: 1.7, i95: 1.6, i287: 1.5, i278: 1.8, bronxriver: 1.8, i78: 1.75, nyc: 1.6, acx: 1.4, us1: 1.3, newdelhi: 1.8, delhikolkata: 1.25,
  a3: 1.8, a1it: 1.6, i80: 1.2, newengland: 1.2, bay: 1.1,
  midwest: 1.0, m1: 0.8, swiss: 0.8,
  libertia: 1.8, i380: 1.75, i980: 1.45, lb24: 1.7, us67: 1.85,
}[MAP] ?? 1;

// i95: NJ Turnpike GWB plaza + the DE/MD barrier tolls south of Wilmington
// (Newark DE mainline, Perryville/JFK Hwy, Fort McHenry Tunnel). VA/NC/SC/
// GA/FL carry no cash tolls on I-95 mainline. india: Vashi + the Pune-side
// ghat toll. I-278's Outerbridge, Verrazzano and RFK gantries are all
// open-road cashless facilities, so they are rendered in i278.js but do not
// enter this booth/queue list.
export const TOLLS = MAP === 'i95' ? [44650, 73000, 132800, 159400] : MAP === 'i78' ? [116000, 259680] : MAP === 'i278' ? [] : MAP === 'india' ? [34200, 85500] : MAP === 'nh48' ? [52000, 91000, 378000, 575000, 935000]
  : MAP === 'andheri' ? [21500]         // CSMIA airport security checkpoint
  : MAP === 'i287' ? [1500]             // NJ Turnpike toll barrier at Exit 10
  // GSP: booth barriers only at Essex + Bergen — the other seven are
  // open-road gantries (scanners overhead, full speed, no slowdown)
  : MAP === 'gsp' ? [228000, 267000]
  : MAP === 'libertia' ? [398000, 622000]
  // AC Expressway: Egg Harbor main barrier + Pleasantville
  : MAP === 'acx' ? [66600, 86700]
  : MAP === 'bay' ? [9000, 60000, 72500] // Bay Bridge + Benicia + Carquinez tolls
  : MAP === 'a1' ? [18000, 282000]      // A1 portagens: Alverca + Grijó (Via Verde)
  : MAP === 'a16' ? [55000, 245000]     // SANEF péages: Setques-side + Chambly
  : MAP === 'a1it' ? [5000, 211000]     // barriere Roma Sud + Napoli Nord (Telepass)
  : [];   // Skyway went cashless ORT (2020) — no crawl anywhere on midwest. A-4 + A3: toll-free
export const TOLL_S = TOLLS[0] ?? -1;

// Driving culture varies by state: NY/NJ metro is speeders and tailgaters,
// New England is brisk but orderly, the Midwest is patient, India is its own
// physics. [personality, share] — remainder is 'normal'.
const ZONE_PERSONALITY = {
  brp_kensico: [['speeder', .36], ['tailgater', .18], ['passive', .10]],
  brp_scarsdale: [['speeder', .40], ['tailgater', .22], ['passive', .08]],
  brp_bronxville: [['speeder', .42], ['tailgater', .25], ['passive', .06]],
  brp_woodlawn: [['speeder', .44], ['tailgater', .29], ['passive', .04]],
  brp_bronx: [['speeder', .45], ['tailgater', .32], ['passive', .03]],
  brp_story: [['speeder', .42], ['tailgater', .35], ['passive', .03]],
  brp_bruckner: [['speeder', .46], ['tailgater', .34], ['passive', .02]],
  brp_i295_bronx: [['speeder', .48], ['tailgater', .31], ['passive', .03]],
  brp_throgs: [['speeder', .44], ['tailgater', .27], ['passive', .05]],
  brp_bayside: [['speeder', .46], ['tailgater', .28], ['passive', .04]],
  brp_i495: [['speeder', .45], ['tailgater', .34], ['passive', .02]],
  brp_queensvillage: [['speeder', .42], ['tailgater', .29], ['passive', .04]],
  bronx:    [['speeder', 0.48], ['tailgater', 0.30], ['passive', 0.03]],
  westchester: [['speeder', 0.44], ['tailgater', 0.20], ['passive', 0.05]],
  suburb:   [['speeder', 0.40], ['tailgater', 0.22], ['passive', 0.08]],
  nj_central: [['speeder', 0.34], ['tailgater', 0.20], ['passive', 0.12]],
  nj_industrial: [['speeder', 0.38], ['tailgater', 0.24], ['passive', 0.10]],
  njsouth:  [['speeder', 0.30], ['tailgater', 0.14], ['passive', 0.14]],
  i78_watchung:   [['speeder', 0.42], ['tailgater', 0.20], ['passive', 0.07]],
  i78_newark:     [['speeder', 0.49], ['tailgater', 0.29], ['passive', 0.02]],
  i78_newarkbay:  [['speeder', 0.47], ['tailgater', 0.26], ['passive', 0.03]],
  i78_jerseycity: [['speeder', 0.48], ['tailgater', 0.32], ['passive', 0.02]],
  i78_holland:    [['speeder', 0.40], ['tailgater', 0.38], ['passive', 0.02]],
  andheriW: [['speeder', 0.15], ['tailgater', 0.60], ['passive', 0.05]],
  // Pune two-wheeler city: everyone tailgates, nobody speeds, nobody yields
  p_gaon:   [['speeder', 0.08], ['tailgater', 0.62], ['passive', 0.06]],
  p_aundh:  [['speeder', 0.12], ['tailgater', 0.58], ['passive', 0.05]],
  p_link:   [['speeder', 0.14], ['tailgater', 0.55], ['passive', 0.06]],
  p_baner:  [['speeder', 0.18], ['tailgater', 0.52], ['passive', 0.06]],
  p_bale:   [['speeder', 0.16], ['tailgater', 0.50], ['passive', 0.08]],
  p_pashan: [['speeder', 0.14], ['tailgater', 0.48], ['passive', 0.10]],
  p_iti:    [['speeder', 0.08], ['tailgater', 0.64], ['passive', 0.05]],
  airport:  [['speeder', 0.12], ['tailgater', 0.40], ['passive', 0.10]],
  bandra:   [['speeder', 0.18], ['tailgater', 0.30], ['passive', 0.10]],
  sealink:  [['speeder', 0.40], ['tailgater', 0.22], ['passive', 0.06]],
  marine:   [['speeder', 0.24], ['tailgater', 0.28], ['passive', 0.10]],
  philly:   [['speeder', 0.44], ['tailgater', 0.22], ['passive', 0.05]],
  newhaven: [['speeder', 0.30], ['tailgater', 0.14], ['passive', 0.12]],
  // I-95 northeast extension — a notoriously aggressive corridor
  boston95:   [['speeder', 0.46], ['tailgater', 0.34], ['passive', 0.03]],
  providence: [['speeder', 0.44], ['tailgater', 0.30], ['passive', 0.04]],
  ctshore:    [['speeder', 0.40], ['tailgater', 0.22], ['passive', 0.06]],
  // NYC: the aggressive core of the map — speeders + tailgaters everywhere, few
  // passive; midtown gridlock is bumper-to-bumper aggressive
  gwb:        [['speeder', 0.44], ['tailgater', 0.30], ['passive', 0.04]],
  washheights:[['speeder', 0.42], ['tailgater', 0.34], ['passive', 0.03]],
  harlem:     [['speeder', 0.42], ['tailgater', 0.36], ['passive', 0.03]],
  ues:        [['speeder', 0.44], ['tailgater', 0.30], ['passive', 0.04]],
  midtown:    [['speeder', 0.40], ['tailgater', 0.38], ['passive', 0.03]],
  tunnel:     [['speeder', 0.38], ['tailgater', 0.36], ['passive', 0.04]],
  lic:        [['speeder', 0.44], ['tailgater', 0.30], ['passive', 0.04]],
  woodside:   [['speeder', 0.44], ['tailgater', 0.28], ['passive', 0.04]],
  corona:     [['speeder', 0.42], ['tailgater', 0.28], ['passive', 0.05]],
  flushing:   [['speeder', 0.40], ['tailgater', 0.26], ['passive', 0.06]],
  newhydepark:[['speeder', 0.42], ['tailgater', 0.22], ['passive', 0.05]],
  mineola:    [['speeder', 0.42], ['tailgater', 0.22], ['passive', 0.05]],
  jericho:    [['speeder', 0.42], ['tailgater', 0.20], ['passive', 0.05]],
  i278_nj440: [['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.04]],
  i278_outerbridge: [['speeder', 0.46], ['tailgater', 0.32], ['passive', 0.02]],
  i278_westshore: [['speeder', 0.48], ['tailgater', 0.34], ['passive', 0.02]],
  i278_staten: [['speeder', 0.46], ['tailgater', 0.32], ['passive', 0.02]],
  i278_verrazzano: [['speeder', 0.46], ['tailgater', 0.34], ['passive', 0.02]],
  i278_brooklyn: [['speeder', 0.52], ['tailgater', 0.38], ['passive', 0.01]],
  i278_brooklyn_south: [['speeder', 0.54], ['tailgater', 0.40], ['passive', 0.01]],
  i278_kosciuszko: [['speeder', 0.54], ['tailgater', 0.38], ['passive', 0.01]],
  i278_queens: [['speeder', 0.50], ['tailgater', 0.36], ['passive', 0.02]],
  i278_rfk_approach: [['speeder', 0.52], ['tailgater', 0.38], ['passive', 0.01]],
  i278_rfk: [['speeder', 0.50], ['tailgater', 0.36], ['passive', 0.02]],
  i278_bronx: [['speeder', 0.54], ['tailgater', 0.40], ['passive', 0.01]],
  belt_gravesend: [['speeder', 0.48], ['tailgater', 0.32], ['passive', 0.02]],
  belt_jamaicabay: [['speeder', 0.40], ['tailgater', 0.28], ['passive', 0.04]],
  jfk_airport: [['speeder', 0.38], ['tailgater', 0.32], ['passive', 0.04]],
  // I-95 true-scale south, DE → FL. The mid-Atlantic metros (Baltimore, DC
  // beltway, NoVA) drive hard; rural VA/NC/SC/GA is a calm truck run; Florida
  // is the worst-driver capital and bimodal — Miami tailgates at 90 while a
  // retiree does 55 in the middle lane, so both 'speeder' and 'passive' spike.
  de_newark:  [['speeder', 0.34], ['tailgater', 0.18], ['passive', 0.08]],
  de_wilmington: [['speeder', 0.34], ['tailgater', 0.18], ['passive', 0.08]],
  md_perryville: [['speeder', 0.30], ['tailgater', 0.12], ['passive', 0.12]],
  md_harford:  [['speeder', 0.32], ['tailgater', 0.14], ['passive', 0.10]],
  md_baltimore:[['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.05]],
  md_laurel:   [['speeder', 0.38], ['tailgater', 0.20], ['passive', 0.07]],
  md_beltway:  [['speeder', 0.46], ['tailgater', 0.30], ['passive', 0.03]],
  va_springfield: [['speeder', 0.46], ['tailgater', 0.30], ['passive', 0.03]],
  va_fredvburg:[['speeder', 0.40], ['tailgater', 0.22], ['passive', 0.06]],
  va_ashland:  [['speeder', 0.34], ['tailgater', 0.16], ['passive', 0.10]],
  va_richmond: [['speeder', 0.40], ['tailgater', 0.22], ['passive', 0.06]],
  va_petersburg: [['speeder', 0.34], ['tailgater', 0.16], ['passive', 0.10]],
  va_southside:[['speeder', 0.30], ['tailgater', 0.10], ['passive', 0.14]],
  nc_roanokerap: [['speeder', 0.30], ['tailgater', 0.10], ['passive', 0.14]],
  nc_rockymount: [['speeder', 0.30], ['tailgater', 0.12], ['passive', 0.13]],
  nc_fayetteville: [['speeder', 0.34], ['tailgater', 0.16], ['passive', 0.10]],
  nc_lumberton: [['speeder', 0.30], ['tailgater', 0.10], ['passive', 0.15]],
  sc_dillon:   [['speeder', 0.30], ['tailgater', 0.10], ['passive', 0.15]],
  sc_florence: [['speeder', 0.32], ['tailgater', 0.14], ['passive', 0.12]],
  sc_santee:   [['speeder', 0.30], ['tailgater', 0.10], ['passive', 0.15]],
  sc_walterboro: [['speeder', 0.30], ['tailgater', 0.10], ['passive', 0.15]],
  ga_midway:   [['speeder', 0.30], ['tailgater', 0.10], ['passive', 0.14]],
  ga_savannah: [['speeder', 0.36], ['tailgater', 0.18], ['passive', 0.09]],
  ga_kingsland:[['speeder', 0.30], ['tailgater', 0.10], ['passive', 0.14]],
  fl_jax:      [['speeder', 0.40], ['tailgater', 0.22], ['passive', 0.07]],
  fl_daytona:  [['speeder', 0.40], ['tailgater', 0.20], ['passive', 0.12]],
  fl_melbourne:[['speeder', 0.38], ['tailgater', 0.18], ['passive', 0.13]],
  fl_stlucie:  [['speeder', 0.40], ['tailgater', 0.20], ['passive', 0.12]],
  fl_wpb:      [['speeder', 0.46], ['tailgater', 0.28], ['passive', 0.06]],
  fl_ftlaud:   [['speeder', 0.50], ['tailgater', 0.30], ['passive', 0.04]],
  fl_miami:    [['speeder', 0.52], ['tailgater', 0.34], ['passive', 0.03]],
  // Garden State Parkway: all cars, everyone flying — the most aggressive road
  // Philly → AC: Philly-metro aggression, casino-run speeders through the pines
  philly76:  [['speeder', 0.46], ['tailgater', 0.26], ['passive', 0.04]],
  wwb:       [['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.05]],
  gloucester:[['speeder', 0.42], ['tailgater', 0.22], ['passive', 0.06]],
  nj42:      [['speeder', 0.46], ['tailgater', 0.24], ['passive', 0.04]],
  acx_west:  [['speeder', 0.48], ['tailgater', 0.20], ['passive', 0.05]],
  acx_pines: [['speeder', 0.52], ['tailgater', 0.18], ['passive', 0.05]],
  acx_egg:   [['speeder', 0.50], ['tailgater', 0.20], ['passive', 0.05]],
  acx_ac:    [['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.06]],
  gsp_capemay: [['speeder', 0.42], ['tailgater', 0.18], ['passive', 0.08]],
  gsp_seashore:[['speeder', 0.46], ['tailgater', 0.22], ['passive', 0.05]],
  gsp_atlantic:[['speeder', 0.50], ['tailgater', 0.26], ['passive', 0.03]],
  gsp_pines:  [['speeder', 0.52], ['tailgater', 0.20], ['passive', 0.04]],
  gsp_ocean:  [['speeder', 0.52], ['tailgater', 0.26], ['passive', 0.03]],
  gsp_lakewood:[['speeder', 0.54], ['tailgater', 0.30], ['passive', 0.02]],
  gsp_monmouth:[['speeder', 0.56], ['tailgater', 0.32], ['passive', 0.01]],
  gsp_raritan: [['speeder', 0.58], ['tailgater', 0.32], ['passive', 0.01]],
  gsp_i95:    [['speeder', 0.56], ['tailgater', 0.32], ['passive', 0.01]],
  gsp_rahway: [['speeder', 0.58], ['tailgater', 0.32], ['passive', 0.01]],
  gsp_union:  [['speeder', 0.56], ['tailgater', 0.34], ['passive', 0.01]],
  gsp_essex:  [['speeder', 0.58], ['tailgater', 0.32], ['passive', 0.01]],
  gsp_clifton:[['speeder', 0.60], ['tailgater', 0.30], ['passive', 0.01]],
  gsp_paterson:[['speeder', 0.58], ['tailgater', 0.30], ['passive', 0.02]],
  gsp_north:  [['speeder', 0.60], ['tailgater', 0.28], ['passive', 0.02]],
  gsp_ny:     [['speeder', 0.58], ['tailgater', 0.28], ['passive', 0.02]],
  // Bay Area: assertive, tech-commuter fast, but choked with traffic
  sf:        [['speeder', 0.34], ['tailgater', 0.22], ['passive', 0.08]],
  baybridge: [['speeder', 0.38], ['tailgater', 0.26], ['passive', 0.05]],
  oakland:   [['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.05]],
  i580:      [['speeder', 0.44], ['tailgater', 0.24], ['passive', 0.05]],
  dublin:    [['speeder', 0.44], ['tailgater', 0.22], ['passive', 0.06]],
  i680:      [['speeder', 0.44], ['tailgater', 0.22], ['passive', 0.06]],
  vallejo:   [['speeder', 0.40], ['tailgater', 0.18], ['passive', 0.08]],
  richmond:  [['speeder', 0.42], ['tailgater', 0.24], ['passive', 0.06]],
  eastbay:   [['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.05]],
  corridor: [['speeder', 0.34], ['tailgater', 0.14], ['passive', 0.10]],
  pa:       [['speeder', 0.28], ['tailgater', 0.10], ['passive', 0.16]],
  plains:   [['speeder', 0.22], ['tailgater', 0.06], ['passive', 0.24]],
  flat:     [['speeder', 0.24], ['tailgater', 0.08], ['passive', 0.22]],
  cincy:    [['speeder', 0.42], ['tailgater', 0.24], ['passive', 0.06]],
  i294:     [['speeder', 0.48], ['tailgater', 0.30], ['passive', 0.03]],
  southland:[['speeder', 0.46], ['tailgater', 0.28], ['passive', 0.04]],
  borman:   [['speeder', 0.38], ['tailgater', 0.24], ['passive', 0.06]],
  gary:     [['speeder', 0.34], ['tailgater', 0.16], ['passive', 0.10]],
  i65:      [['speeder', 0.36], ['tailgater', 0.14], ['passive', 0.08]],
  indy:     [['speeder', 0.46], ['tailgater', 0.25], ['passive', 0.04]],
  i74:      [['speeder', 0.32], ['tailgater', 0.11], ['passive', 0.14]],
  hills:    [['speeder', 0.28], ['tailgater', 0.10], ['passive', 0.16]],
  downtown: [['speeder', 0.40], ['tailgater', 0.24], ['passive', 0.06]],
  millcreek:  [['speeder', 0.44], ['tailgater', 0.24], ['passive', 0.05]],
  sharonville:[['speeder', 0.38], ['tailgater', 0.20], ['passive', 0.07]],
  wchester75: [['speeder', 0.34], ['tailgater', 0.16], ['passive', 0.10]],
  middletown: [['speeder', 0.26], ['tailgater', 0.10], ['passive', 0.18]],
  franklin75: [['speeder', 0.26], ['tailgater', 0.08], ['passive', 0.20]],
  moraine:    [['speeder', 0.28], ['tailgater', 0.12], ['passive', 0.14]],
  dayton:     [['speeder', 0.32], ['tailgater', 0.18], ['passive', 0.10]],
  ord:      [['speeder', 0.40], ['tailgater', 0.22], ['passive', 0.06]],
  i90ken:   [['speeder', 0.42], ['tailgater', 0.24], ['passive', 0.05]],
  chidt:    [['speeder', 0.40], ['tailgater', 0.24], ['passive', 0.06]],
  danryan:  [['speeder', 0.46], ['tailgater', 0.28], ['passive', 0.04]],
  skyway:   [['speeder', 0.38], ['tailgater', 0.22], ['passive', 0.07]],
  i80:      [['speeder', 0.32], ['tailgater', 0.18], ['passive', 0.10]],
  mumbai:   [['speeder', 0.20], ['tailgater', 0.55], ['passive', 0.05]],
  chembur:  [['speeder', 0.08], ['tailgater', 0.68], ['passive', 0.03]],
  puneX:    [['speeder', 0.36], ['tailgater', 0.30], ['passive', 0.06]],
  pcmc:     [['speeder', 0.16], ['tailgater', 0.48], ['passive', 0.06]],
  pune:     [['speeder', 0.18], ['tailgater', 0.50], ['passive', 0.06]],
  perthamboy: [['speeder', 0.40], ['tailgater', 0.22], ['passive', 0.06]],
  piscataway: [['speeder', 0.40], ['tailgater', 0.20], ['passive', 0.06]],
  bridgewater: [['speeder', 0.34], ['tailgater', 0.18], ['passive', 0.10]],
  morristown: [['speeder', 0.32], ['tailgater', 0.16], ['passive', 0.12]],
  ramapo:   [['speeder', 0.32], ['tailgater', 0.16], ['passive', 0.12]],
  // I-287 NY extension: quieter Rockland, then NYC-grade aggression into the Bronx
  rockland: [['speeder', 0.32], ['tailgater', 0.16], ['passive', 0.12]],
  tappanzee:[['speeder', 0.34], ['tailgater', 0.20], ['passive', 0.08]],
  westch:   [['speeder', 0.38], ['tailgater', 0.22], ['passive', 0.08]],
  yonkers:  [['speeder', 0.44], ['tailgater', 0.30], ['passive', 0.05]],
  nybronx:  [['speeder', 0.46], ['tailgater', 0.34], ['passive', 0.03]],
  gwb287:   [['speeder', 0.44], ['tailgater', 0.32], ['passive', 0.04]],
  // New England branch (I-91/I-84/Mass Pike) — brisk, assertive "masshole" flavor
  i91:      [['speeder', 0.32], ['tailgater', 0.16], ['passive', 0.12]],
  hartford: [['speeder', 0.38], ['tailgater', 0.22], ['passive', 0.08]],
  i84:      [['speeder', 0.34], ['tailgater', 0.18], ['passive', 0.10]],
  masspike: [['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.06]],
  boston:   [['speeder', 0.40], ['tailgater', 0.30], ['passive', 0.05]],
  logan:    [['speeder', 0.28], ['tailgater', 0.24], ['passive', 0.10]],
  // I-80: aggressive NJ metro + Chicago ends, calmer rural PA/Ohio middle
  fortlee:  [['speeder', 0.44], ['tailgater', 0.30], ['passive', 0.05]],
  njsub80:  [['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.06]],
  njgap:    [['speeder', 0.28], ['tailgater', 0.12], ['passive', 0.16]],
  poconos:  [['speeder', 0.28], ['tailgater', 0.10], ['passive', 0.18]],
  paridge:  [['speeder', 0.26], ['tailgater', 0.08], ['passive', 0.20]],
  paplat:   [['speeder', 0.26], ['tailgater', 0.08], ['passive', 0.20]],
  ohio80:   [['speeder', 0.30], ['tailgater', 0.14], ['passive', 0.14]],
  cleveland:[['speeder', 0.40], ['tailgater', 0.26], ['passive', 0.06]],
  toledo:   [['speeder', 0.32], ['tailgater', 0.16], ['passive', 0.12]],
  inturnpike:[['speeder', 0.34], ['tailgater', 0.12], ['passive', 0.14]],
  chi80:    [['speeder', 0.44], ['tailgater', 0.30], ['passive', 0.05]],
  lib_south: [['speeder', 0.22], ['tailgater', 0.06], ['passive', 0.22]],
  lib_southtowns: [['speeder', 0.25], ['tailgater', 0.08], ['passive', 0.18]],
  lib_reston: [['speeder', 0.44], ['tailgater', 0.28], ['passive', 0.04]],
  lib_corridor: [['speeder', 0.32], ['tailgater', 0.14], ['passive', 0.12]],
  lib_jacobs: [['speeder', 0.34], ['tailgater', 0.15], ['passive', 0.10]],
  lib_terminal: [['speeder', 0.24], ['tailgater', 0.08], ['passive', 0.18]],
  i380_east: [['speeder', 0.38], ['tailgater', 0.22], ['passive', 0.05]],
  i980_rural: [['speeder', 0.18], ['tailgater', 0.04], ['passive', 0.28]],
  lb24_core: [['speeder', 0.32], ['tailgater', 0.16], ['passive', 0.08]],
  us67_jacobs: [['speeder', 0.50], ['tailgater', 0.28], ['passive', 0.02]],
  us67_farms: [['speeder', 0.26], ['tailgater', 0.06], ['passive', 0.20]],
  us67_reston_ne: [['speeder', 0.38], ['tailgater', 0.24], ['passive', 0.05]],
  // Route 1 changes from suburban signal progression to aggressive North
  // Jersey merging.  The Skyway is brisk but less weave-heavy on two lanes.
  trenton: [['speeder', 0.28], ['tailgater', 0.18], ['passive', 0.12]],
  lawrence: [['speeder', 0.30], ['tailgater', 0.16], ['passive', 0.12]],
  princeton: [['speeder', 0.32], ['tailgater', 0.16], ['passive', 0.10]],
  nbrunswick: [['speeder', 0.35], ['tailgater', 0.20], ['passive', 0.08]],
  newbrunswick: [['speeder', 0.30], ['tailgater', 0.25], ['passive', 0.08]],
  edison: [['speeder', 0.36], ['tailgater', 0.22], ['passive', 0.07]],
  iselin: [['speeder', 0.38], ['tailgater', 0.24], ['passive', 0.06]],
  woodbridge: [['speeder', 0.42], ['tailgater', 0.26], ['passive', 0.04]],
  linden: [['speeder', 0.40], ['tailgater', 0.25], ['passive', 0.05]],
  elizabeth: [['speeder', 0.42], ['tailgater', 0.28], ['passive', 0.04]],
  newark1: [['speeder', 0.45], ['tailgater', 0.30], ['passive', 0.03]],
  pulaski: [['speeder', 0.43], ['tailgater', 0.24], ['passive', 0.04]],
  jerseycity: [['speeder', 0.37], ['tailgater', 0.34], ['passive', 0.03]],
  us1_return: [['speeder', 0.34], ['tailgater', 0.24], ['passive', 0.07]],
};

// How assertively drivers weave and cut between lanes, by region — higher =
// more frequent lane changes and tighter gaps accepted (not necessarily faster).
// 1 = laid-back interstate; the NE metro and Chicago push well above.
const ZONE_ASSERT = {
  bronx: 2.4, westchester: 1.7, suburb: 1.9, nj_central: 2.0, nj_industrial: 2.25, njsouth: 1.5, philly: 1.9,
  i78_newark: 2.2, i78_jerseycity: 2.45, i78_holland: 2.55, i78_manhattan: 2.6,
  i78_qmt: 2.45, i78_queens: 2.2, i78_nassau: 1.7, i78_jericho: 1.45,
  i280_essex: 1.35, i280_oranges: 1.8, i280_newark: 2.25,
  us22_bridgewater: 1.45, us22_union: 1.9, us22_newark: 2.3,
  corridor: 1.4, perthamboy: 1.6, piscataway: 1.5, bridgewater: 1.25,
  morristown: 1.2, ramapo: 1.2, sealink: 1.4,
  chidt: 2.0, danryan: 2.1, i90ken: 1.8, i294: 2.05, southland: 1.95,
  borman: 1.7, gary: 1.55, i65: 1.2, i74: 1.15, downtown: 1.6, indy: 1.4, skyway: 1.3,
  boston: 2.1, masspike: 1.7, hartford: 1.5, i84: 1.35,
  fortlee: 1.9, njsub80: 1.7, cleveland: 1.7, chi80: 1.9, toledo: 1.3, inturnpike: 1.2,
  yonkers: 2.0, nybronx: 2.4, gwb287: 2.1, westch: 1.5, tappanzee: 1.2,
  boston95: 2.3, providence: 2.1, ctshore: 1.7,
  // NYC proper: FDR / Harlem River Dr / Cross Bronx / the LIE — weaving, horn-
  // heavy, cut-you-off aggressive, easing out toward the Nassau/Suffolk suburbs
  gwb: 2.3, washheights: 2.3, harlem: 2.4, ues: 2.3, midtown: 2.5, tunnel: 2.2,
  lic: 2.2, woodside: 2.1, corona: 2.0, flushing: 1.9,
  newhydepark: 1.7, mineola: 1.6, jericho: 1.5,
  i278_nj440: 1.85, i278_outerbridge: 2.2, i278_westshore: 2.3, i278_staten: 2.35, i278_verrazzano: 2.5,
  i278_brooklyn: 2.8, i278_brooklyn_south: 2.85, i278_kosciuszko: 2.8,
  i278_queens: 2.55, i278_rfk_approach: 2.6, i278_rfk: 2.75, i278_bronx: 2.9,
  belt_gravesend: 2.35, belt_jamaicabay: 1.85, jfk_airport: 2.3,
  // DE → FL: mid-Atlantic metros weave hard, rural South barely at all, South
  // Florida worst of anywhere on the map
  de_newark: 1.5, de_wilmington: 1.5,
  md_perryville: 1.2, md_harford: 1.3, md_baltimore: 1.9, md_laurel: 1.6, md_beltway: 2.2,
  va_springfield: 2.2, va_fredvburg: 1.7, va_ashland: 1.3, va_richmond: 1.7,
  va_petersburg: 1.4, va_southside: 1.1,
  nc_roanokerap: 1.1, nc_rockymount: 1.2, nc_fayetteville: 1.4, nc_lumberton: 1.1,
  sc_dillon: 1.1, sc_florence: 1.3, sc_santee: 1.1, sc_walterboro: 1.1,
  ga_midway: 1.1, ga_savannah: 1.5, ga_kingsland: 1.1,
  fl_jax: 1.7, fl_daytona: 1.6, fl_melbourne: 1.5, fl_stlucie: 1.6,
  fl_wpb: 2.1, fl_ftlaud: 2.4, fl_miami: 2.6,
  gsp_i95: 2.4, gsp_rahway: 2.5, gsp_union: 2.5, gsp_essex: 2.5, gsp_clifton: 2.6,
  gsp_paterson: 2.5, gsp_north: 2.5, gsp_ny: 2.4,
  gsp_capemay: 1.4, gsp_seashore: 1.6, gsp_atlantic: 1.8, gsp_pines: 1.5,
  gsp_ocean: 1.9, gsp_lakewood: 2.1, gsp_monmouth: 2.3, gsp_raritan: 2.4,
  philly76: 1.9, wwb: 1.7, gloucester: 1.5, nj42: 1.7,
  acx_west: 1.4, acx_pines: 1.2, acx_egg: 1.4, acx_ac: 1.7,
  sf: 1.5, baybridge: 1.6, oakland: 1.8, i580: 1.7, dublin: 1.5, i680: 1.5,
  vallejo: 1.3, richmond: 1.6, eastbay: 1.8,
  lib_south: 0.9, lib_southtowns: 1.0, lib_reston: 2.0,
  lib_corridor: 1.35, lib_jacobs: 1.45, lib_terminal: 1.0,
  i380_north: 1.8, i380_east: 2.15, i380_south: 1.95, i380_west: 1.65,
  i980_west: 1.15, i980_north: 1.35, i980_rural: 0.75, i980_south: 0.95,
  lb24_north: 1.45, lb24_core: 1.95, lb24_illinois: 1.55, lb24_south: 1.1,
  us67_jacobs: 2.2, us67_farms: 1.0, us67_towns: 1.2, us67_reston_east: 1.8,
  us67_reston_ne: 2.35, us67_tunnel: 2.15,
  trenton: 1.45, lawrence: 1.3, princeton: 1.35, nbrunswick: 1.55,
  newbrunswick: 1.75, edison: 1.65, iselin: 1.75, woodbridge: 1.95,
  linden: 1.85, elizabeth: 2.05, newark1: 2.2, pulaski: 1.65,
  jerseycity: 2.25, us1_return: 1.6,
};
function pickPersonality(zoneKey, rand) {
  const dist = ZONE_PERSONALITY[zoneKey]
    ?? (zoneKey.startsWith('de_') ? [['speeder', .32], ['tailgater', .08], ['passive', .08]]
      : zoneKey.startsWith('it_') ? [['speeder', .22], ['tailgater', .30], ['passive', .05]]
      : zoneKey.startsWith('fr_') ? [['speeder', .18], ['tailgater', .18], ['passive', .10]]
      : zoneKey.startsWith('es_') || zoneKey.startsWith('pt_')
        ? [['speeder', .20], ['tailgater', .16], ['passive', .10]]
      : zoneKey.startsWith('uk_') ? [['speeder', .12], ['tailgater', .08], ['passive', .20]]
      : zoneKey.startsWith('ch_') ? [['speeder', .08], ['tailgater', .04], ['passive', .30]]
      : null);
  if (!dist) return 'normal';
  let x = rand();
  for (const [name, w] of dist) { x -= w; if (x <= 0) return name; }
  return 'normal';
}

// zones where rush hour really bites: metro cores and commuter corridors
const RUSH_URBAN = new Set([
  'bronx', 'suburb', 'nj_central', 'nj_industrial', 'philly', 'newhaven', 'westchester', 'cincy',
  'i78_newark', 'i78_jerseycity', 'i78_holland', 'i78_manhattan', 'i78_qmt', 'i78_queens', 'i78_nassau',
  'i280_essex', 'i280_oranges', 'i280_newark', 'us22_bridgewater', 'us22_union', 'us22_newark',
  'boston95', 'providence',
  'mumbai', 'chembur', 'pune', 'pcmc', 'andheriW', 'airport', 'indy', 'downtown',
  'p_gaon', 'p_aundh', 'p_link', 'p_baner', 'p_bale', 'p_iti',
  'i90ken', 'chidt', 'danryan', 'hartford', 'boston', 'masspike',
  'fortlee', 'njsub80', 'cleveland', 'chi80', 'yonkers', 'nybronx', 'gwb287',
  'gsp_rahway', 'gsp_union', 'gsp_essex', 'gsp_paterson',
  'gsp_lakewood', 'gsp_monmouth', 'gsp_raritan',
  'philly76', 'nj42', 'acx_ac',
  'sf', 'oakland', 'i580', 'i680', 'richmond', 'eastbay',
  'trenton', 'newbrunswick', 'edison', 'woodbridge', 'iselin', 'elizabeth', 'newark1', 'jerseycity',
  'i278_nj440', 'i278_outerbridge', 'i278_westshore', 'i278_staten', 'i278_verrazzano', 'i278_brooklyn',
  'i278_brooklyn_south', 'i278_kosciuszko', 'i278_queens', 'i278_rfk_approach', 'i278_rfk', 'i278_bronx',
  'belt_gravesend', 'belt_jamaicabay', 'jfk_airport',
  'lib_reston', 'lib_corridor', 'lib_jacobs',
  // Long-route metro approaches: these need the same city-level congestion
  // treatment as the Northeast/Chicago corridors when level 6 is selected.
  'tx_dallas', 'tx_lancaster', 'tx_woodlands', 'tx_houston',
  'fltp_miami', 'fltp_broward', 'fltp_palm', 'fltp_orlando',
  'cal5_la', 'cal5_santaclarita', 'cal5_silicon', 'cal5_sf',
]);

// India drives packed most of the day; the US genuinely empties out overnight
// and midday, so its baseline is much lower and rush hour is what fills it.
const INDIA_ZONE = new Set([
  'mumbai', 'chembur', 'pune', 'pcmc', 'puneX', 'andheriW', 'airport', 'bandra', 'sealink', 'marine',
  'p_gaon', 'p_aundh', 'p_link', 'p_baner', 'p_bale', 'p_pashan', 'p_iti',
]);
// Wider inner-city arterials can still have a fast stream. This is deliberately
// separate from the highway rules: only a minority of non-commercial speeders
// get the burst, while local traffic, buses, rickshaws and trucks stay slower.
const INNER_CITY_FAST_ZONES = new Set([
  'mumbai', 'chembur', 'andheriW', 'airport', 'bandra', 'marine', 'pune', 'pcmc',
  'p_aundh', 'p_link', 'p_baner', 'p_bale', 'p_pashan', 'p_iti',
]);

function rushFactor(tod, zoneKey) {
  // twin peaks: ~8 AM (tod .333) and ~5:30 PM (tod .73). A gentle midday bump
  // keeps things moving at noon; the small hours go dead.
  const peak = (c, w) => Math.exp(-((tod - c) ** 2) / (2 * w * w));
  const p = Math.max(peak(0.333, 0.055), peak(0.73, 0.065));
  const midday = 0.16 * peak(0.52, 0.10);              // lunchtime uptick
  // deep-night trough (~2:30–4:30 AM), wrapped around midnight so late-night and
  // pre-dawn both empty out — a parkway at 3:30 AM should be nearly deserted
  let dn = Math.abs(tod - 0.14); dn = Math.min(dn, 1 - dn);
  const night = Math.exp(-(dn * dn) / (2 * 0.075 * 0.075));   // ~1 at 3:20 AM, ~0 by day
  if (INDIA_ZONE.has(zoneKey) || zoneKey.startsWith('dk_')) {
    // Indian city streets stay busy through daylight and evening. The
    // pre-dawn trough remains, but ordinary daytime traffic is not sparse.
    const busy = 0.82 + 0.30 * p + 0.10 * midday;
    return busy * (1 - 0.68 * night);
  }
  // I-65 and I-74 remain working freight corridors after commuter traffic
  // clears. At night the field becomes truck-dominant rather than vanishing.
  if (MAP === 'midwest' && ['i65', 'i74', 'borman', 'gary'].includes(zoneKey)
      && (tod < 0.25 || tod > 0.82)) {
    return 0.68 + 0.10 * p;
  }
  // US: genuinely near-empty off-peak (3 AM dead, mid-morning/afternoon lulls),
  // heavy only at the real rush peaks. Cities swing hardest; open highway barely
  // fills except at rush.
  const amp = RUSH_URBAN.has(zoneKey) ? 1.10 : 0.62;
  const floor = 0.17 - 0.13 * night;                   // 0.17 daytime lull → ~0.04 at 3 AM
  return floor + amp * p + midday;
}

// small deterministic per-zone phase so different stretches surge and clear at
// different times rather than the whole map breathing in unison
function zonePhase(zoneKey) {
  let h = 0;
  for (let i = 0; i < zoneKey.length; i++) h = (h * 31 + zoneKey.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000 * Math.PI * 2;
}

// Sporadic real-world variance on top of the time-of-day rush: slow congestion
// waves drifting over a few minutes, plus occasional incident-like spikes that
// bunch traffic up, and quiet lulls that open the road right back up. Highways
// swing from near-empty to jammed; dense city zones stay busy but still pulse.
function surgeFactor(t, zoneKey) {
  const ph = zonePhase(zoneKey);
  const a = Math.sin(t / 95 + ph), b = Math.sin(t / 223 + ph * 1.7), c = Math.sin(t / 41 + ph * 0.5);
  // Wider, lower slow drift so a stretch of road genuinely breathes from nearly
  // empty to busy over a few minutes rather than idling near "always moderate."
  // Roughly 0.18 … 1.30, mean ~0.68.
  let f = 0.68 + 0.36 * a + 0.24 * b + 0.12 * c;
  const wave = Math.sin(t / 71 + ph) * Math.sin(t / 149 + ph * 2.1);
  // incident / jam wave: rare genuine backup (not the norm); open-road lulls come
  // often and drop the density right down, so most drives are free-flowing.
  if (wave > 0.92) f *= RUSH_URBAN.has(zoneKey) ? 1.5 : 1.22;
  else if (wave < -0.45) f *= 0.5;
  // Mumbai/Pune city traffic breathes, but it should not disappear during a
  // harmless lull. The early-morning rushFactor still controls the real empty
  // hours; this floor only prevents ordinary daytime waves from clearing the
  // streets unrealistically.
  if (INDIA_ZONE.has(zoneKey)) f = Math.max(f, 0.72);
  return Math.max(0.1, f);
}

// Late-night traffic is sparse by design: cities clear out first, while the
// interstate still gets a steady but intermittent freight pulse. The phase is
// deterministic per zone, so truck pockets move naturally along a route rather
// than every zone becoming busy at the same instant.
function lateNightTruckPocket(t, zoneKey) {
  const ph = zonePhase(zoneKey);
  const wave = 0.5 + 0.5 * Math.sin(t / 125 + ph) * Math.sin(t / 211 + ph * 1.7);
  return wave > 0.58;
}

function lateNightDensity(zoneKey, t) {
  const urban = RUSH_URBAN.has(zoneKey) || INDIA_ZONE.has(zoneKey) || zoneKey.startsWith('dk_');
  const pocket = lateNightTruckPocket(t, zoneKey);
  const routeBoost = LATE_NIGHT_FREIGHT_ROUTES.has(MAP) ? 1.16 : 1;
  const base = (urban ? 0.08 : 0.18) * routeBoost;
  // After-hours traffic stays sparse even when a freight pocket is active;
  // pockets add trucks without turning the road into rush-hour traffic.
  return base * (pocket ? (urban ? 1.20 : 1.55) : 1);
}

function freightType(type) {
  return type.truckLane && !type.cityOnly
    && ['boxtruck', 'semi', 'truckIN', 'tempo'].includes(type.key);
}

function pickLateNightType(zoneKey, simTime = 0) {
  let type = pickType(mulberry, zoneKey);
  // The Garden State Parkway's truck restriction still applies in this mode.
  if (MAP === 'gsp') return type;
  const pocket = lateNightTruckPocket(simTime, zoneKey);
  const freightRoute = LATE_NIGHT_FREIGHT_ROUTES.has(MAP);
  const truckShare = pocket
    ? (freightRoute ? 0.86 : 0.78)
    : (freightRoute ? 0.68 : 0.55);
  if (mulberry() >= truckShare) return type;
  for (let i = 0; i < 16 && !freightType(type); i++) type = pickType(mulberry, zoneKey);
  return freightType(type) ? type : pickType(mulberry, zoneKey);
}

export class Traffic {
  constructor(scene, playerStartS) {
    this.scene = scene;
    // null deliberately means "use the simulation's native density model".
    // A UI level is opt-in, so existing drives behave exactly as before.
    this.densityLevel = null;
    this.trafficMode = null; // null | packed | deadlock | late-night
    this._modeSeeded = false;
    this._densityResetPending = false;
    this._densitySeedPending = false;
    this._densitySpawnBudget = 0;
    this.npcs = [];
    for (let i = 0; i < NPC_COUNT; i++) {
      const npc = {
        dir: 1, s: 0, lane: 0, laneFloat: 0, v: 25, vLat: 0,
        type: null, desired: 28, group: null, active: false,
        exit: null, cooldown: mulberry() * 4, idm: IDM, wanderP: 0,
        pers: 'normal', aggro: 1,
      };
      this.npcs.push(npc);
      // keep a clear bubble around the player's spawn point so nobody
      // materializes on top of you
      let s = (mulberry() * 2 - 1) * SPAWN_RADIUS;
      if (Math.abs(s) < 45) s = Math.sign(s || 1) * (45 + mulberry() * 40);
      this.spawn(npc, wrapS(playerStartS + s), true);
    }
  }

  spawn(npc, s, initial = false) {
    const zoneKey = zoneAt(s).key;
    const nativeFreightNight = MAP === 'midwest'
      && ['i65', 'i74', 'borman', 'gary'].includes(zoneKey)
      && (this.currentTod < 0.25 || this.currentTod > 0.82);
    let type = this.trafficMode === 'late-night' || nativeFreightNight
      ? pickLateNightType(zoneKey, this.simTime)
      : pickType(mulberry, zoneKey);
    // GSP bans trucks outright, the whole 172 miles — buses are fine.
    const isTruck = t => t.truckLane && t.key !== 'bus' && t.key !== 'coach'
      && t.key !== 'school' && t.key !== 'mta';
    if (MAP === 'gsp' && isTruck(type)) {
      for (let i = 0; i < 10 && isTruck(type); i++) type = pickType(mulberry, zoneKey);
      if (isTruck(type)) type = pickType(mulberry, 'suburb');
    }
    // Commercial trucks are prohibited on the Bronx River Parkway portion;
    // they enter the mix only after the route reaches the Bruckner/I-295.
    if (MAP === 'bronxriver' && s < 35000 && isTruck(type)) {
      for (let i = 0; i < 10 && isTruck(type); i++) type = pickType(mulberry, zoneKey);
      if (isTruck(type)) type = pickType(mulberry, 'westchester');
    }
    if (npc.group) { this.scene.remove(npc.group); }
    npc.type = type;
    npc.group = type.make(mulberry);
    npc.group.add(contactShadow(type.L, type.W));
    addNpcPlates(npc.group, type, zoneKey, mulberry);
    addBrandBadge(npc.group, type, zoneKey, mulberry);
    npc.blink = addNpcBlinkers(npc.group, type);
    npc.signal = 0; npc.signalHold = 0;
    // most drivers signal lane changes; some just don't, more so in Mumbai
    npc.usesSignal = mulberry() < (type.mumbai ? 0.48 : 0.82);
    // headlights flick on around dusk at a human-varied moment; a rare car never does
    npc.hasLights = mulberry() < 0.985;
    npc.lightsOnAt = 0.12 + mulberry() * 0.28;
    // high-beam users (regional share). Two temperaments: most wait a while
    // stuck behind someone before flashing; the aggressive ones close right up
    // on the bumper and flash almost immediately, then keep re-flashing.
    if (mulberry() < HB_SHARE) {
      const aggro = mulberry() < 0.4;
      npc.hb = {
        aggro,
        patience: aggro ? 0.6 + mulberry() * 1.6 : 3 + mulberry() * 6,
        waitT: 0, flashT: 0,
      };
    } else npc.hb = null;
    npc.hbFlashing = false;
    npc.boxedT = 0;
    npc.hazardP = mulberry() < 0.3;   // the share who run hazards in a whiteout
    this.scene.add(npc.group);
    npc.dir = mulberry() < 0.5 ? 1 : -1;
    npc.s = wrapS(s);
    const maxL = usableLanesAt(s);
    npc.lane = type.truckLane
      ? Math.max(0, maxL - 1 - ((mulberry() < 0.6 ? 0 : 1)))
      : (mulberry() * maxL) | 0;
    npc.laneFloat = npc.lane;
    npc.desired = desiredSpeed(type, mulberry);
    if (zoneKey === 'downtown') {
      npc.desired = Math.min(npc.desired, 20 + mulberry() * 4); // downtown interstate (ramps, weave)
    }
    if (zoneKey === 'andheriW') {
      npc.desired = Math.min(npc.desired, 7 + mulberry() * 3); // inner-city chaos speed
    }
    if (zoneKey === 'chembur') {
      npc.desired = Math.min(npc.desired, 6 + mulberry() * 4); // Chembur / Sion-Panvel gridlock crawl
    }
    if (zoneKey === 'pcmc') {
      npc.desired = Math.min(npc.desired, 13 + mulberry() * 5); // Pimpri city-highway crawl
    }
    if (zoneKey === 'pune') {
      npc.desired = Math.min(npc.desired, 9 + mulberry() * 4);  // Pune city signals + swarm
    }
    // Mumbai city traffic should keep moving through gaps instead of reading
    // as a permanent crawl. These are still urban speeds, not expressway
    // speeds; signals and the IDM model provide the congestion.
    const MUMBAI_CITY_CAP = {
      mumbai: 14, chembur: 9, andheriW: 11, airport: 14,
      bandra: 13, sealink: 20, marine: 14, pcmc: 16, pune: 12,
    };
    if (MUMBAI_CITY_CAP[zoneKey] != null) {
      npc.desired = Math.min(npc.desired, MUMBAI_CITY_CAP[zoneKey] + mulberry() * 3);
    }
    // Aundh–Baner circuit: inner-city crawl speeds, slowest through the gaons
    const AUNDH_CAP = { p_gaon: 5, p_aundh: 7, p_link: 8, p_baner: 10, p_bale: 9, p_pashan: 8, p_iti: 5 };
    if (AUNDH_CAP[zoneKey] != null) {
      npc.desired = Math.min(npc.desired, AUNDH_CAP[zoneKey] + mulberry() * 3);
    }
    if (MAP === 'us1' || MAP === 'chester') {
      // surface arterial: 40-50 mph posted, slower through the city cores
      const cap = MAP === 'chester'
        ? 13 + (zoneKey === 'chester_retail' ? 2 : 0) + (zoneKey === 'chester_south' ? 3 : 0)
        : { trenton: 15, newbrunswick: 15, jerseycity: 14, newark1: 16,
          elizabeth: 17, edison: 18, woodbridge: 20, pulaski: 22 }[zoneKey] ?? 19;
      npc.desired = Math.min(npc.desired, cap + mulberry() * 4);
    }
    if (MAP === 'us67') {
      // I-680 is 70 mph outside the downtown termination tunnel. Work zones
      // are the only other recurring speed reduction on the corridor.
      const inWorkZone = I680_WORK_ZONES.some(w => Math.abs(loopDelta(s, w)) < 700);
      const cap = zoneKey === 'us67_tunnel' ? 25 : inWorkZone ? 45 : 70;
      npc.desired = Math.min(npc.desired, cap * MPH + mulberry() * 2.2);
    }
    // Mumbai two-wheelers weave through and jump red lights; Delhi treats
    // the red as a suggestion across the board (less civic sense)
    npc.skipsLights = type.key === 'bike' ? mulberry() < (MAP === 'newdelhi' ? 0.75 : 0.6)
      : type.key === 'rickshaw' ? mulberry() < (MAP === 'newdelhi' ? 0.35 : 0.2)
      : MAP === 'newdelhi' ? mulberry() < 0.12 : false;
    npc.stopClear = null; npc.stopWait = 0;   // stop-sign state (aundh)
    npc.v = initial ? npc.desired * (0.93 + mulberry() * 0.07) : npc.desired * (0.95 + mulberry() * 0.05);
    // NJ dual-dual: trucks/buses belong on the OUTER (cars-trucks-buses) roadway.
    // But the E/W spurs north of Newark carry trucks on BOTH roadways, so up
    // there a truck picks a spur at random and rides it — inner (western) or
    // outer (eastern), varying car to car.
    if (type.truckLane && njDualDualAt(s) > 0.1 && npc.lane < 3) {
      npc.lane = 3 + ((mulberry() * 3) | 0);
    } else if (type.truckLane && (njGapAt(s) > 0.1 || spurTAt(s) > 0.1)) {
      npc.lane = mulberry() < 0.5 ? ((mulberry() * 3) | 0) : 3 + ((mulberry() * 3) | 0);
    }
    npc.laneFloat = npc.lane;
    const baseIdm = type.mumbai ? MUMBAI_IDM : (type.truckLane ? TRUCK_IDM : IDM);
    npc.pers = pickPersonality(zoneKey, mulberry);
    // Libertia has a more assertive freeway culture than the default Midwest
    // baseline: speeders and tailgaters are common, but most drivers remain
    // normal and trucks stay governed separately.
    if (LIBERTIA_MAP && !type.truckLane && npc.pers === 'normal') {
      const cultureBoost = MAP === 'i980' ? 0.14 : 0.22;
      const r = mulberry();
      if (r < cultureBoost * 0.62) npc.pers = 'speeder';
      else if (r < cultureBoost) npc.pers = 'tailgater';
    }
    // dynamic real-world variance: some stretches of time see a wave of extra
    // fast drivers on top of the base share — strongest in assertive urban zones,
    // so speeders can swell toward ~55-60% of traffic during a wave, then ebb.
    if (npc.pers === 'normal' && !type.truckLane) {
      const fastWave = 0.5 + 0.5 * Math.sin((this.simTime || 0) / 190 + zonePhase(zoneKey));
      const bump = (ZONE_ASSERT[zoneKey] ? 0.24 : 0.10) * fastWave;
      if (mulberry() < bump) npc.pers = 'speeder';
    }
    if (npc.pers === 'speeder') {
      npc.desired *= 1.20 + mulberry() * 0.20;      // ~10-25 over: the 80-90+ left-lane crowd
      npc.idm = { ...baseIdm, a: baseIdm.a * 1.4, T: baseIdm.T * 0.75 };
      npc.aggro = 1.7;
    } else if (npc.pers === 'tailgater') {
      // Close-following does not mean every vehicle is at maximum speed:
      // tailgaters vary around the local flow and only accelerate when a gap
      // opens.
      npc.desired *= 0.99 + mulberry() * 0.14;
      npc.idm = { ...baseIdm, T: baseIdm.T * 0.5, s0: baseIdm.s0 * 0.6, b: baseIdm.b + 0.6 };
      npc.aggro = 1.25;
    } else if (npc.pers === 'passive') {
      npc.desired *= 0.92 + mulberry() * 0.08;      // a little under, or right at, the limit
      npc.idm = { ...baseIdm, a: baseIdm.a * 0.75, T: baseIdm.T * 1.35 };
      npc.aggro = 0.45;
      if (!type.truckLane) {                         // slow drivers keep right
        npc.lane = Math.max(0, maxL - 1 - (mulberry() < 0.55 ? 0 : 1));
        npc.laneFloat = npc.lane;
      }
    } else {
      // Ordinary drivers are the majority: spread their target speeds so the
      // road has a natural mix of slower and quicker cars rather than a convoy.
      // On free-flowing US highways, most drivers sit at or just above the
      // posted limit; the old 0.84 floor made the whole road feel artificially
      // timid even when there was no leader or weather forcing a slowdown.
      const briskHighway = !type.mumbai && MAP !== 'us1' && MAP !== 'chester';
      npc.desired *= briskHighway ? 0.94 + mulberry() * 0.18 : 0.88 + mulberry() * 0.20;
      npc.idm = baseIdm;
      npc.aggro = 1;
    }
    // The Turnpike is dense and fast, but not an 85-mph convoy. Preserve a
    // visible fast minority while making the majority a 60–76 mph middle pack;
    // trucks retain their separate governed ranges on the outer roadway.
    if (MAP === 'i95' && !type.truckLane
        && ['suburb', 'nj_industrial', 'nj_central', 'njsouth'].includes(zoneKey)
        && npc.pers !== 'speeder' && npc.pers !== 'maniac') {
      const urbanBump = zoneKey === 'nj_industrial' || zoneKey === 'suburb' ? 2 : 0;
      const range = npc.pers === 'passive' ? [58, 68]
        : npc.pers === 'tailgater' ? [68, 80]
        : [62, 76];
      npc.desired = Math.min(npc.desired,
        (range[0] + urbanBump + mulberry() * (range[1] - range[0])) * MPH);
      npc.v = Math.min(npc.v, npc.desired * (0.96 + mulberry() * 0.04));
    }
    if (MAP === 'bronxriver') {
      // Free-flowing NY parkway/expressway traffic: a visibly slower right-lane
      // minority, a broad highway-speed middle, and a real fast-driver group.
      // Bruckner/I-295 freight remains governed below the quickest cars.
      if (type.truckLane) {
        npc.desired = (52 + mulberry() * 13) * MPH;
      } else {
        const range = npc.pers === 'passive' ? [48, 59]
          : npc.pers === 'tailgater' ? [65, 80]
          : npc.pers === 'speeder' ? [76, 92]
          : [57, 73];
        npc.desired = (range[0] + mulberry() * (range[1] - range[0])) * MPH;
      }
      npc.v = npc.desired * (0.90 + mulberry() * 0.08);
    }
    const fastInnerCity = type.mumbai && !type.truckLane && type.key !== 'rickshaw'
      && npc.pers === 'speeder' && INNER_CITY_FAST_ZONES.has(zoneKey);
    if (fastInnerCity) {
      // A passing burst, not a universal cruise speed. The vehicle will still
      // brake for leaders and retain the normal collision/merge clearances.
      npc.desired = Math.max(npc.desired, (55 + mulberry() * 10) * MPH);
      npc.aggro = Math.max(npc.aggro, 1.35);
      npc.idm = { ...npc.idm, T: npc.idm.T * .84, s0: npc.idm.s0 * .9 };
    }
    // maniacs: way over the limit, cutting through traffic, weaving — rare on a
    // calm rural run, a lot more common in the aggressive urban zones (scaled by
    // ZONE_ASSERT so Miami / NYC / the GSP see real cut-you-off drivers)
    if (!type.truckLane && mulberry() < 0.012 * (ZONE_ASSERT[zoneKey] || 1)) {
      npc.pers = 'maniac';
      npc.desired = desiredSpeed(type, mulberry) * (type.mumbai ? 1.35 : 1.5 + mulberry() * 0.4);
      npc.idm = { ...baseIdm, a: baseIdm.a * 1.7, T: baseIdm.T * 0.42, s0: baseIdm.s0 * 0.5, b: baseIdm.b + 0.4 };
      npc.aggro = 2.4;
    }
    npc.exit = null;
    npc.cooldown = 2 + mulberry() * 3;
    npc.wanderP = mulberry() * Math.PI * 2;
    // Keep the small lateral imperfection of Indian traffic, but avoid the
    // old 0.4–1.8 m wander that made cars look drunk between lane changes.
    npc.wanderA = 0.15 + mulberry() * 0.55;
    // never materialize on top of an existing car: hop lanes until the slot is
    // clear; if the whole cross-section is packed (toll queue at the spawn
    // edge), stay inactive and let the density loop retry elsewhere
    const slotClear = ln => !this.npcs.some(o => o !== npc && o.active
      && o.dir === npc.dir && Math.round(o.laneFloat) === ln
      && Math.abs(loopDelta(o.s, npc.s)) < (o.type.L + npc.type.L) / 2 + 14);
    let hops = 0;
    while (hops <= maxL && !slotClear(npc.lane)) { npc.lane = (npc.lane + 1) % (maxL + 1); hops++; }
    if (hops > maxL) { npc.active = false; npc.group.visible = false; return; }
    npc.laneFloat = npc.lane;
    npc.active = true;
    npc.group.visible = true;
  }

  // travel-direction coordinate: increasing u = forward for this vehicle
  u(o) { return wrapS(o.dir * o.s); }

  setDensityLevel(level = null) {
    const leavingLateNight = this.trafficMode === 'late-night';
    this.densityLevel = Number.isInteger(level) && level >= 1 && level <= 6 ? level : null;
    this.trafficMode = null;
    // The constructor intentionally builds a reusable full vehicle pool. When
    // the user selects a lighter density, trim that active pool next frame
    // instead of waiting for every excess car to cross the recycle boundary.
    this._densityResetPending = true;
    // Late Night deliberately clears the ordinary traffic field. Refill the
    // two busiest manual settings immediately instead of making the player
    // wait for an empty road to repopulate from the simulation horizon.
    this._densitySeedPending = leavingLateNight && this.densityLevel >= 5;
    // Never carry a refill burst from the previous setting into a new one.
    this._densitySpawnBudget = 0;
  }

  setTrafficMode(mode = null) {
    this.trafficMode = ['packed', 'deadlock', 'late-night'].includes(mode) ? mode : null;
    if (this.trafficMode) this.densityLevel = null;
    this._modeSeeded = false;
    this._densityResetPending = false;
    this._densitySeedPending = false;
    this._densitySpawnBudget = 0;
    // Rebuild the nearby field so switching into late-night immediately
    // replaces daytime cars with the intended sparse/truck-heavy mix.
    for (const npc of this.npcs) {
      npc.active = false;
      npc.group.visible = false;
    }
  }

  seedPresetTraffic(player) {
    // Lay the preset field out like ordinary roadway traffic: both travel
    // directions, every usable lane, and regular longitudinal gaps around the
    // player. This prevents a preset from looking like cars simply froze at
    // arbitrary spawn coordinates.
    const half = Math.ceil(this.npcs.length / 2);
    // Packed flow should be dense, not an over-compressed queue. Give the
    // preset enough road to maintain highway headways while still filling the
    // visible run around the player.
    const span = Math.max(180, SPAWN_RADIUS * (this.trafficMode === 'packed' ? 2.2 : 1.75));
    for (const npc of this.npcs) {
      npc.active = false;
      if (npc.group) npc.group.visible = false;
    }
    this.npcs.forEach((npc, i) => {
      const dir = i < half ? 1 : -1;
      const rank = i < half ? i : i - half;
      const sOffset = 55 + rank * (span - 55) / Math.max(1, half - 1);
      this.spawn(npc, wrapS(player.s + dir * sOffset), true);
      npc.dir = dir;
      const lanes = Math.max(1, usableLanesAt(npc.s));
      // Keep heavy vehicles out of the passing lane. The old preset overwrite
      // ignored spawn()'s truck-lane placement and put trucks/buses into lane 0,
      // making packed-flow traffic crawl exactly where it should move fastest.
      if (npc.type.truckLane) {
        const outer = lanes - 1;
        npc.lane = Math.max(0, outer - (rank % Math.min(2, lanes)));
        if (njDualDualAt(npc.s) > 0.1) npc.lane = Math.max(3, npc.lane);
      } else {
        npc.lane = rank % lanes;
        if ((this.trafficMode === 'packed' || this.densityLevel === 5) && npc.lane === 0) {
          npc.desired *= 1.12;
          npc.aggro = Math.max(npc.aggro, 1.5);
        }
      }
      npc.laneFloat = npc.lane;
      npc.v = this.trafficMode === 'deadlock'
        ? 0.8 + (rank % 5) * 0.35
        : npc.desired * (0.92 + (rank % 4) * 0.04);
    });
  }

  update(dt, player, tod, onCrash, simTime = 0, nightFactor = 0, grip = 1) {
    // snowpack slows everyone down — nobody does 70 on a buried Dan Ryan.
    // When it's REALLY bad (buried, unsalted, mid-squall) a share of drivers
    // put their hazards on and crawl.
    const snowSlow = 0.55 + 0.45 * grip;
    const hazardy = grip < 0.5;
    const npcs = this.npcs;
    this.simTime = simTime;   // used by spawn() for time-varying speeder waves
    this.currentTod = tod;

    const zoneKey = zoneAt(player.s).key;
    if ((this.trafficMode === 'packed' || this.trafficMode === 'deadlock') && !this._modeSeeded) {
      this.seedPresetTraffic(player);
      this._modeSeeded = true;
    }
    const level6Urban = this.densityLevel === 6 && RUSH_URBAN.has(zoneKey);
    const surge = surgeFactor(simTime, zoneKey);
    // Level 6 city traffic stays near-packed even outside rush hour; the
    // rolling jam pulse still changes speed and spacing, so it does not become
    // a static wall of cars. Other levels/maps retain the normal ebb and flow.
    const effectiveSurge = level6Urban ? Math.max(0.82, surge) : surge;
    const presetTraffic = this.trafficMode === 'packed' || this.trafficMode === 'deadlock';
    const lateNight = this.trafficMode === 'late-night';
    const automaticTarget = NPC_COUNT * zoneDensity(zoneKey)
      * rushFactor(tod, zoneKey) * effectiveSurge;
    const profile = this.densityLevel == null ? null
      : DENSITY_LEVEL_PROFILE[this.densityLevel - 1];
    const manualTarget = profile == null ? automaticTarget : Math.max(
      NPC_COUNT * profile.floor,
      Math.min(NPC_COUNT * profile.ceiling, automaticTarget * profile.scale),
    );
    const target = presetTraffic ? NPC_COUNT : lateNight
      ? Math.min(NPC_COUNT, Math.round(NPC_COUNT * zoneDensity(zoneKey)
        * surge * lateNightDensity(zoneKey, simTime)))
      : Math.min(NPC_COUNT, Math.round(manualTarget));

    if (this._densitySeedPending) {
      this._densitySeedPending = false;
      this.seedPresetTraffic(player);
    }

    // bucket by (dir, rounded lane), sorted by travel coord u
    const buckets = new Map();
    const keyOf = (dir, lane) => (dir > 0 ? 0 : 1) * (LANES_MAX + 2) + lane;
    const push = (dir, lane, entry) => {
      if (lane < 0 || lane >= LANES_MAX) return;
      const k = keyOf(dir, lane);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(entry);
    };
    for (const n of npcs) {
      if (!n.active) continue;
      const e = { u: this.u(n), v: n.v, L: n.type.L, ref: n };
      push(n.dir, Math.round(n.laneFloat), e);
      const frac = n.laneFloat - Math.round(n.laneFloat);
      if (Math.abs(frac) > 0.25) {
        push(n.dir, Math.round(n.laneFloat) + Math.sign(frac), e);
      }
    }
    if (player) {
      const pLane = this.playerLane(player);
      const pDir = player.dir ?? 1;
      if (pLane >= -0.6 && pLane <= LANES_MAX - 0.4) {
        const e = { u: wrapS(pDir * player.s), v: player.v, L: 4.8, ref: 'player' };
        push(pDir, Math.round(pLane), e);
        const frac = pLane - Math.round(pLane);
        if (Math.abs(frac) > 0.25) push(pDir, Math.round(pLane) + Math.sign(frac), e);
      }
    }
    for (const arr of buckets.values()) arr.sort((a, b) => a.u - b.u);

    const leaderOf = (npc, lane) => {
      const arr = buckets.get(keyOf(npc.dir, lane));
      if (!arr || arr.length === 0) return null;
      const myU = this.u(npc);
      let best = null, bestGap = Infinity;
      for (const e of arr) {
        if (e.ref === npc) continue;
        let g = e.u - myU;
        if (g <= 0) g += LOOP_LENGTH;
        if (g < bestGap) { bestGap = g; best = e; }
      }
      const localScale = distanceScaleAt(npc.s);
      if (!best || bestGap > 250 / localScale) return null;
      // u/s are logical route coordinates; IDM operates in rendered meters.
      // Convert with the local physical scale. Philly and central NJ are
      // intentionally lengthened, so the old global scale made cars perceive
      // huge visible gaps as bumper-to-bumper spacing and brake unnecessarily.
      return { gap: (bestGap * localScale) - (best.L + npc.type.L) / 2, v: best.v, ref: best.ref };
    };
    const followerOf = (npc, lane) => {
      const arr = buckets.get(keyOf(npc.dir, lane));
      if (!arr || arr.length === 0) return null;
      const myU = this.u(npc);
      let best = null, bestGap = Infinity;
      for (const e of arr) {
        if (e.ref === npc) continue;
        let g = myU - e.u;
        if (g <= 0) g += LOOP_LENGTH;
        if (g < bestGap) { bestGap = g; best = e; }
      }
      const localScale = distanceScaleAt(npc.s);
      if (!best || bestGap > 250 / localScale) return null;
      return { gap: (bestGap * localScale) - (best.L + npc.type.L) / 2, v: best.v, ref: best.ref };
    };

    this._bsL = false; this._bsR = false;   // blind-spot flags, set in the loop
    let activeCount = 0;
    for (const n of npcs) if (n.active) activeCount++;

    if (this._densityResetPending) {
      this._densityResetPending = false;
      if (!presetTraffic && !lateNight && activeCount > target) {
        // Remove the farthest vehicles first, preserving the closest natural
        // traffic around the player while reaching the new target instantly.
        const active = npcs.filter(n => n.active).sort((a, b) =>
          Math.abs(loopDelta(player.s, b.s)) - Math.abs(loopDelta(player.s, a.s)));
        for (let i = 0; i < activeCount - target; i++) {
          active[i].active = false;
          active[i].group.visible = false;
        }
        activeCount = target;
      }
    }

    // A manual increase becomes a stream arriving from the simulation horizon,
    // not one probability roll per inactive car (which could add dozens in a
    // frame). Larger changes respond faster, but remain visibly progressive.
    const manualDensityRamp = this.densityLevel != null && !presetTraffic && !lateNight;
    if (manualDensityRamp && activeCount < target) {
      const deficit = target - activeCount;
      const perSecond = 1.5 + Math.min(4.5, deficit * 0.025);
      this._densitySpawnBudget = Math.min(4, this._densitySpawnBudget + dt * perSecond);
    } else if (!manualDensityRamp || activeCount >= target) {
      this._densitySpawnBudget = 0;
    }

    for (const npc of npcs) {
      if (!npc.active) {
        const shouldRampSpawn = manualDensityRamp && this._densitySpawnBudget >= 1;
        const shouldAutoSpawn = !manualDensityRamp && mulberry() < dt * 0.5;
        if (activeCount < target && (shouldRampSpawn || shouldAutoSpawn)) {
          this.respawnAtEdge(npc, player);
          if (shouldRampSpawn) this._densitySpawnBudget -= 1;
          activeCount++;
        }
        continue;
      }

      npc.cooldown -= dt;
      const npcZone = zoneAt(npc.s).key;
      const inMumbai = npcZone.startsWith('dk_') || npcZone === 'mumbai' || npcZone === 'chembur' || npcZone === 'pune' || npcZone === 'andheriW' || npcZone === 'airport' || npcZone === 'bandra' || npcZone === 'sealink' || npcZone === 'marine'
        || npcZone.startsWith('p_')   // the whole Aundh–Baner circuit
        || npcZone === 'd_cp' || npcZone === 'd_ito' || npcZone === 'd_lutyens' || npcZone === 'd_rohtak'; // Indian-city driving style
      const fastInnerCity = inMumbai && !npc.type.truckLane && npc.type.key !== 'rickshaw'
        && npc.pers === 'speeder' && INNER_CITY_FAST_ZONES.has(npcZone);
      const assert = (ZONE_ASSERT[npcZone] ?? 1) * (fastInnerCity ? 1.22 : 1);
      // construction closes the rightmost lane here — everyone merges left
      const maxLane = usableLanesAt(npc.s) - 1 - closedLanesAt(npc.s, npc.dir);
      const gapHere = njGapAt(npc.s);
      const spurHere = spurTAt(npc.s);
      // NJ Turnpike E/W spurs + dual-dual + GSP local/express: once the
      // roadways separate there's a barrier/void between them — no crossing
      // until they physically merge back at the ends.
      const lockedRoadways = gapHere > 2 || spurHere > 0.12;
      const sameRoadway = tl => !lockedRoadways || ((npc.lane < 3) === (tl < 3));
      // Do not stack another lane decision on top of a maneuver that is
      // still animating. This keeps assertive traffic assertive in its gap
      // choices without making the cars snap through successive lanes.
      const laneSettled = () => Math.abs(npc.lane - npc.laneFloat) < 0.04;

      // narrowing road: merge left
      if (npc.lane > maxLane) { npc.lane = maxLane; npc.cooldown = Math.max(npc.cooldown, 1.5); }
      // trucks migrate to the outer roadway on the dual-dual (cars-only inner);
      // on the E/W spurs they stay put — either spur is fine for trucks
      if (npc.type.truckLane && njDualDualAt(npc.s) > 0.1 && npc.lane < 3) npc.lane = 3;

      // --- exit-taking decision (rolled ~once per second, not per frame)
      npc.exitTimer = (npc.exitTimer ?? mulberry()) - dt;
      if (!npc.exit && npc.exitTimer < 0) {
        npc.exitTimer = 1;
        // no exit access from the roadway away from the ramps: the turnpike's
        // inner roadway / GSP express lanes (lane < 3), or — on the spur fork,
        // where each spur is two-way — whichever spur sits away from your
        // bound's ramp side (+s exits ride the western spur, -s the eastern)
        const noExits = spurHere > 0.5
          ? (npc.dir > 0 ? npc.lane >= 3 : npc.lane < 3)
          : (lockedRoadways && npc.lane < 3);
        if (noExits) npc.exitTimer = 3;
        else for (const ex of EXITS) {
          const ahead = npc.dir > 0 ? loopDelta(npc.s, ex.s - RAMP_LENGTH)
                                    : loopDelta(ex.s + RAMP_LENGTH, npc.s);
          if (ahead > 200 && ahead < 550 && mulberry() < 0.02) {
            npc.exit = ex;
            break;
          }
        }
      }

      // --- yield to a tailgater (often the player): someone's right on my tail
      // and clearly wants past. Most drivers move over — but not all: speeders
      // and maniacs hold the lane, some just speed up to clear, some ignore it.
      if (npc.cooldown < 0 && !npc.exit && laneSettled()) {
        const back = followerOf(npc, npc.lane);
        // a high-beam flash from behind (NPC or the player on H) reads from
        // further back than plain tailgating does — and works better
        const flashed = back && back.gap < 60
          && (back.ref === 'player' ? !!player.hbOn : !!back.ref.hbFlashing);
        if (back && ((back.gap < Math.max(8, npc.v * 0.7) && back.v > npc.v + 1.2) || flashed)) {
          let courtesy = npc.pers === 'passive' ? 0.9 : npc.pers === 'maniac' ? 0.05
            : npc.pers === 'speeder' ? 0.2 : npc.pers === 'tailgater' ? 0.25 : 0.6;
          if (flashed) courtesy = Math.min(1, courtesy + 0.35);
          const slowLane = RIGHT_IS_HIGHER ? npc.lane + 1 : npc.lane - 1;
          const canYield = slowLane >= 0 && slowLane <= maxLane && sameRoadway(slowLane)
            && !(npc.type.truckLane && slowLane < 3 && njDualDualAt(npc.s) > 0.1);
          const r = mulberry();
          if (r < courtesy && canYield) {
            const f = followerOf(npc, slowLane), l = leaderOf(npc, slowLane);
            if ((!f || f.gap > 9) && (!l || l.gap > 10)) {
              setSignal(npc, slowLane - npc.lane);
              npc.lane = slowLane; npc.cooldown = 3;
            }
          } else if (r < courtesy + 0.12) {
            npc.desired = Math.min(npc.desired * 1.12, npc.desired + 4); // speeds up to clear
            npc.cooldown = 2;
          }
          // else: holds the lane — the frustrating slow driver
        }
      }

      // --- lane logic
      if (npc.exit) {
        if (npc.cooldown < 0 && laneSettled() && npc.lane < maxLane && sameRoadway(npc.lane + 1)) {
          const f = followerOf(npc, npc.lane + 1);
          const l = leaderOf(npc, npc.lane + 1);
          if ((!f || f.gap > 10 + f.v * 0.5) && (!l || l.gap > 12)) {
            npc.lane += 1; npc.cooldown = 2.5; setSignal(npc, 1);
          }
        }
      } else if (npc.cooldown < 0 && laneSettled()) {
        // Mumbai: gaps that would be suicidal elsewhere are an invitation here.
        // Assertive metro/Chicago drivers also accept tighter gaps and weave.
        const gk = (inMumbai ? 0.4 : 1) / assert;
        const lead = leaderOf(npc, npc.lane);
        const wantFaster = lead && lead.gap < npc.v * (fastInnerCity ? 1.7 : 1.4)
          && lead.v < npc.v - (fastInnerCity ? 1 : inMumbai ? 0.5 : 1.5);
        const truckCap = npc.type.truckLane && maxLane >= 3 ? 1 : 0;
        // US fast drivers (speeders/maniacs) ride the left/passing lane at 80-90+
        // and are reluctant to give it up — the way American highways actually run.
        const fastLeft = RIGHT_IS_HIGHER && !inMumbai && npc.aggro >= 1.5;
        if (wantFaster && npc.lane > truckCap && sameRoadway(npc.lane - 1)
            && (npc.aggro >= 1 || npc.boxedT > 3 || mulberry() < npc.aggro * assert)) {
          const tl = npc.lane - 1;
          const f = followerOf(npc, tl), l = leaderOf(npc, tl);
          const ag = npc.aggro >= 1.5 ? 0.7 : 1; // speeders accept tighter gaps
          // tight gaps are fine, but never merge into an occupied space: keep a
          // hard clearance floor front and back so nobody cuts straight into a car
          if ((!f || f.gap > Math.max(3.0, (12 + f.v * 0.7) * gk * ag))
              && (!l || l.gap > Math.max(3.4, Math.max(15, npc.v * 0.8) * gk * ag))) {
            setSignal(npc, tl - npc.lane);
            npc.lane = tl; npc.cooldown = (4 + mulberry() * 3) * (inMumbai ? 0.8 : 1) / npc.aggro / assert;
          }
        } else if (fastLeft && npc.lane > truckCap && sameRoadway(npc.lane - 1)) {
          // drift up into the open left lane to cruise fast, not just when blocked
          const tl = npc.lane - 1;
          const f = followerOf(npc, tl), l = leaderOf(npc, tl);
          if ((!l || (l.gap > Math.max(3.4, npc.v * 1.8) && l.v > npc.v - 3))
              && (!f || f.gap > Math.max(3.4, 12 + f.v * 0.7))
              && mulberry() < 0.55) {
            setSignal(npc, tl - npc.lane);
            npc.lane = tl; npc.cooldown = 3 + mulberry() * 2;
          }
        } else if (npc.lane < maxLane && sameRoadway(npc.lane + 1)) {
          // keep right when clear; assertive drivers also dart into openings.
          // Fast drivers hold the left lane — they almost never move back right.
          const tl = npc.lane + 1;
          const f = followerOf(npc, tl), l = leaderOf(npc, tl);
          const myLead = leaderOf(npc, npc.lane);
          // a driver boxed in for a while gives up on the left lane and bails
          // right to pass — the Jersey slide that breaks the pressure chain
          const bailing = npc.boxedT > 4;
          const clearHere = !myLead || myLead.gap > npc.v * 2.5 * gk || bailing;
          let prob = (wantFaster ? 0.5 : (inMumbai ? 0.55 : 0.35)) * assert;
          if (fastLeft) prob *= 0.1;
          if (bailing) prob = Math.max(prob, 0.6);
          // same hard clearance floor: dart into openings, never into a car
          if (clearHere
              && (!f || f.gap > Math.max(3.0, (14 + f.v * 0.7) * gk))
              && (!l || l.gap > Math.max(3.4, npc.v * 2.0 * gk))
              && mulberry() < prob) {
            setSignal(npc, tl - npc.lane);
            npc.lane = tl; npc.cooldown = (5 + mulberry() * 4) * (inMumbai ? 0.8 : 1) / assert;
          }
        }
        if (npc.cooldown < 0) npc.cooldown = 0.8 + mulberry() * 0.7;
      }

      // --- longitudinal (IDM)
      let idm = npc.idm;
      let lead = leaderOf(npc, Math.round(npc.laneFloat));
      // mid-lane-change: also respect the TARGET lane's leader, so nobody
      // slides sideways into a queue they never braked for
      if (npc.lane !== Math.round(npc.laneFloat)) {
        const lead2 = leaderOf(npc, npc.lane);
        if (lead2 && (!lead || lead2.gap < lead.gap)) lead = lead2;
      }
      let desired = npc.desired * snowSlow * (hazardy && npc.hazardP ? 0.78 : 1);
      // On US freeways the left lane is primarily a passing/fast lane. Keep
      // ordinary cars moving briskly there, let speeders stretch away, and
      // reserve the slower behavior for passive drivers and actual leaders.
      const fastLaneRoad = RIGHT_IS_HIGHER && !inMumbai && !npc.type.truckLane
        && MAP !== 'us1' && MAP !== 'chester';
      if (fastLaneRoad && npc.lane === 0) {
        const laneBoost = npc.pers === 'maniac' ? 1.12
          : npc.pers === 'speeder' ? 1.08
          : npc.pers === 'tailgater' ? 1.05 : 1.03;
        desired *= laneBoost;
      }
      const movingFlow = this.trafficMode === 'packed' || this.densityLevel >= 5;
      if (movingFlow) {
        // Busy freeway flow should preserve momentum behind occasional slower
        // drivers instead of turning every small speed difference into a queue.
        idm = { ...idm, T: idm.T * 0.82, s0: idm.s0 * 0.9 };
      }
      if (this.trafficMode === 'deadlock') {
        // Full saturation: a traveling stop-and-go wave, capped at 10 mph.
        // The low pulse occasionally collapses to a near-stop, then releases
        // different parts of the queue at different rates.
        const wave = 0.5 + 0.5 * Math.sin(simTime / 41 + zonePhase(npcZone) + npc.wanderP);
        const release = 0.5 + 0.5 * Math.sin(simTime / 89 + zonePhase(npcZone) * 1.7);
        desired = Math.min(desired, wave < 0.12 ? 0.32 : (1.2 + 3.25 * wave * (0.65 + 0.35 * release)));
        if (wave < 0.045) desired = 0.08;
      }
      // Density alone should not create an artificial jam. Packed and level 5/6
      // traffic keep moving; only the explicit Deadlock preset is allowed to
      // impose stop-and-go behavior.
      // stuck behind a slow player: the aggressive ones ride your bumper
      if (lead && lead.ref === 'player' && lead.v < npc.desired * 0.8 && npc.aggro > 1.1) {
        idm = { ...idm, T: idm.T * 0.55, s0: idm.s0 * 0.65 };
      }
      // aggressive high-beamers tailgate ANY slower car, not just the player
      if (lead && npc.hb && npc.hb.aggro && lead.v < npc.desired * 0.85) {
        idm = { ...idm, T: idm.T * 0.6, s0: idm.s0 * 0.7 };
      }
      // toll booths: slow to a crawl through the plaza (e-toll lanes roll
      // through a bit faster than the cash/full-service lanes)
      for (const tollS of TOLLS) {
        // I-78 toll collection is directional: Delaware River Bridge tolls
        // westbound into Pennsylvania; Holland Tunnel tolls eastbound into NY.
        // The reverse trips must not form a fake toll queue.
        if (MAP === 'i78' && ((tollS === 116000 && npc.dir > 0)
          || (tollS === 259680 && npc.dir < 0))) continue;
        const dToll = Math.abs(loopDelta(npc.s, tollS));
        if (dToll < 130) desired = Math.min(desired, npc.lane < 3 ? 9 : 4.5);
      }
      // GSP Exit 140 (US-22, Union): the notorious bottleneck — traffic bunches
      if (MAP === 'gsp') {
        const dB = Math.abs(loopDelta(npc.s, 225000));
        if (dB < 340) desired = Math.min(desired, 12);
      }
      if (npc.exit) {
        const distToRamp = npc.dir > 0
          ? loopDelta(npc.s, npc.exit.s) : loopDelta(npc.exit.s, npc.s);
        if (distToRamp < RAMP_LENGTH + 60) desired = Math.min(desired, 18);
      }
      // red lights: parked virtual leader — except the two-wheelers that
      // weave up and jump the light like they own the junction
      if (!npc.skipsLights) {
        for (const sig of SIGNALS) {
          const d = npc.dir > 0 ? loopDelta(npc.s, sig.s) : loopDelta(sig.s, npc.s);
          if (d > -2 && d < 130 && signalState(sig, simTime) !== 'green') {
            const gap = d - 4;
            if (gap > 0.1 && (!lead || gap < lead.gap)) lead = { gap, v: 0 };
          }
        }
      }
      // stop signs (Aundh–Baner): roll up, pause a beat, then go. Two-wheelers
      // treat them the way they treat everything — mostly optional.
      if (AUNDH_STOPS.length && !npc.skipsLights) {
        for (const stS of AUNDH_STOPS) {
          const d = npc.dir > 0 ? loopDelta(npc.s, stS) : loopDelta(stS, npc.s);
          if (d > -2 && d < 55) {
            if (npc.stopClear === stS) continue;
            if (d < 6 && npc.v < 1.2) {
              npc.stopWait = (npc.stopWait ?? 0) + dt;
              if (npc.stopWait > 0.7 + (npc.pers === 'passive' ? 0.6 : 0)) {
                npc.stopClear = stS;
                npc.stopWait = 0;
              }
            }
            const gap = d - 3;
            if (gap > 0.1 && (!lead || gap < lead.gap)) lead = { gap, v: 0 };
          } else if (npc.stopClear === stS && (d < -10 || d > 70)) {
            npc.stopClear = null;
          }
        }
      }
      let acc = idm.a * (1 - Math.pow(npc.v / desired, idm.delta));
      if (lead) {
        const dv = npc.v - lead.v;
        const sStar = idm.s0 + Math.max(0, npc.v * idm.T + (npc.v * dv) / (2 * Math.sqrt(idm.a * idm.b)));
        acc -= idm.a * (sStar / Math.max(lead.gap, 0.5)) ** 2;
      }
      npc.v = Math.max(0, npc.v + acc * dt);
      npc.s = wrapS(npc.s + npc.dir * npc.v * dt / distanceScaleAt(npc.s));
      // already interpenetrating a stopped leader (bad spawn / squeezed merge):
      // back out gently instead of sitting merged into the other car
      if (lead && lead.gap < -0.2) {
        npc.v = 0;
        npc.s = wrapS(npc.s - npc.dir * Math.min(2.5 * dt, -lead.gap / distanceScaleAt(npc.s)));
      }
      // brake lights latch briefly so they read at speed instead of flickering;
      // a car held at 0 by its leader keeps a negative IDM acc, so queued cars
      // sit with their brakes lit like real stop-and-go
      if (acc < -0.7) npc.brakeT = 0.3;
      else if (npc.brakeT > 0) npc.brakeT -= dt;

      // --- boxed-in pressure: time spent stuck behind a slower car at speed.
      // Feeds the left-lane chain (overtake urgency) and the high-beam flashes.
      const boxed = lead && npc.v > 9 && lead.v < desired * 0.9
        && lead.gap < Math.max(14, npc.v * (npc.hb && npc.hb.aggro ? 0.85 : 0.6));
      npc.boxedT = boxed
        ? npc.boxedT + dt * LANE_PRESSURE
        : Math.max(0, npc.boxedT - dt * 2);
      // --- high beams: the flashers run their pulse train once patience runs out
      npc.hbFlashing = false;
      if (npc.hb) {
        const hb = npc.hb;
        if (boxed) hb.waitT += dt; else hb.waitT = Math.max(0, hb.waitT - dt * 2);
        if (hb.flashT <= 0 && hb.waitT > hb.patience) {
          hb.flashT = 1.15;                                  // ~3 quick pulses
          hb.waitT = hb.aggro ? hb.patience * 0.4 : 0;       // aggro re-flashes sooner
        }
        if (hb.flashT > 0) {
          hb.flashT -= dt;
          npc.hbFlashing = (hb.flashT % 0.38) > 0.17;
        }
      }

      // --- lateral animation
      const sf = sideFactorAt(npc.s, npc.dir);
      const sfSign = Math.sign(sf) || 1;
      const laneRate = fastInnerCity ? 0.84 : inMumbai ? 0.72
        : LIBERTIA_MAP ? (MAP === 'i980' ? 0.66 : MAP === 'libertia' ? 0.82 : 0.76)
        : 0.75; // Libertia follows NJ-style assertive, varied lane movement
      const dLane = npc.lane - npc.laneFloat;
      let step = Math.sign(dLane) * Math.min(Math.abs(dLane), laneRate * dt);
      // crawling into a slot that has collapsed under queue compression
      // (either bumper): abort the merge back to the lane we came from
      if (step !== 0 && npc.v < 6) {
        const tLead = leaderOf(npc, npc.lane);
        const tBack = followerOf(npc, npc.lane);
        if ((tLead && tLead.gap < 2.5) || (tBack && tBack.gap < 2.0)) {
          step = 0;
          npc.lane = dLane < 0 ? Math.ceil(npc.laneFloat) : Math.floor(npc.laneFloat);
          npc.cooldown = Math.max(npc.cooldown, 1.5);
        }
      }
      npc.laneFloat += step;
      // latForLane derivative wrt lane is -dir*sideFactor*LANE_WIDTH
      npc.vLat = (step / Math.max(dt, 1e-4)) * laneWidthAt(npc.s) * -npc.dir * sfSign;

      let lat = latForLane(npc.dir, npc.laneFloat, npc.s);
      if (inMumbai && !npc.exit) {
        // nobody holds a lane in Mumbai — straddling markers is the norm...
        let wander = Math.sin(npc.s * 0.05 + npc.wanderP) * npc.wanderA
          + Math.sin(npc.s * 0.013 + npc.wanderP * 2) * 0.5;
        // ...but even Delhi straightens up while squeezing past you
        if (Math.abs(loopDelta(player.s, npc.s)) < 14
          && Math.abs(player.lat - lat) < 5.5) wander *= 0.25;
        lat += wander * -npc.dir;
      }
      if (npc.exit) {
        const off = rampOffset(npc.exit, npc.s, npc.dir);
        if (off === null) {
          npc.active = false;
          npc.group.visible = false;
          npc.exit = null;
          continue;
        }
        lat += -npc.dir * sfSign * off;
      }

      // --- recycle when far from player
      const d = Math.abs(loopDelta(player.s, npc.s));
      if (d > SPAWN_RADIUS) {
        if (activeCount > target) {
          npc.active = false; npc.group.visible = false;
        } else {
          this.respawnAtEdge(npc, player);
        }
        continue;
      }

      // --- GWB: cars pick a deck at the approach and hold it across
      if (MAP === 'i95') {
        const nearGwb = npc.s > 43400 && npc.s < 44600;
        if (nearGwb && !npc.gwbSet) {
          npc.deckLower = mulberry() < 0.45;
          npc.gwbSet = true;
        } else if (!nearGwb) {
          npc.gwbSet = false;
        }
      }

      // --- place mesh
      posAt(npc.s, lat, npc.group.position);
      const npcDrop = ((npc.gwbSet && npc.deckLower) ? gwbLowerDrop(npc.s) : 0)
        - spurRiseAt(npc.s, npc.dir, npc.laneFloat);   // spur-fork flyover decks
      npc.group.position.y -= npcDrop;
      const psi = Math.atan2(npc.dir * npc.vLat, Math.max(npc.v, 3));
      npc.group.rotation.y = headingAt(npc.s) + (npc.dir > 0 ? 0 : Math.PI) + psi;

      // --- roll the wheels at road speed
      const wheels = npc.group.userData.wheels;
      if (wheels) for (const w of wheels) w.rotation.x += (npc.v / w.userData.r) * dt;

      // --- turn signals: blink the indicating side through the lane change
      if (npc.signalHold > 0) {
        npc.signalHold -= dt;
        const on = (simTime % 0.8) < 0.4;
        npc.blink.matL.emissiveIntensity = (npc.signal < 0 && on) ? 3.0 : 0;
        npc.blink.matR.emissiveIntensity = (npc.signal > 0 && on) ? 3.0 : 0;
        if (npc.signalHold <= 0) {
          npc.signal = 0;
          npc.blink.matL.emissiveIntensity = 0;
          npc.blink.matR.emissiveIntensity = 0;
        }
      }

      // --- whiteout hazards: four-way flashers override the turn signals
      if (hazardy && npc.hazardP) {
        const on = (simTime % 0.9) < 0.45;
        npc.blink.matL.emissiveIntensity = on ? 3.0 : 0;
        npc.blink.matR.emissiveIntensity = on ? 3.0 : 0;
      }

      // --- headlights: on past this car's own dusk threshold (rare car: never)
      const lightsOn = npc.hasLights && nightFactor > npc.lightsOnAt;
      const hlI = (lightsOn ? 0.05 + nightFactor * 2.6 : 0.05)
        + (npc.hbFlashing ? 4 + nightFactor * 4 : 0);   // restrained high-beam pulse
      for (const m of npc.blink.hl) m.emissiveIntensity = hlI;
      const bgs = 0.68 + nightFactor * 0.78;
      for (const sp of npc.blink.hlGlow) {
        // Regular headlights get a small bloom halo too; high beams layer a
        // stronger pulse over it so NPC lights read like the player's.
        sp.visible = lightsOn || npc.hbFlashing;
        if (sp.visible) {
          const k = npc.hbFlashing ? bgs * 1.1 : bgs * 0.5;
          sp.scale.set(k, k, 1);
        }
      }
      // brake flare well past the dusk base — hot enough to hit bloom at night
      const braking = npc.brakeT > 0;
      const tlI = (lightsOn ? 0.25 + nightFactor * 2.2 : 0.25)
        + (braking ? 4.5 + nightFactor * 7 : 0);
      for (const m of npc.blink.tl) m.emissiveIntensity = tlI;
      // the halo sprites do the real work: bigger after dark
      const gs = 0.8 + nightFactor * 1.1;
      for (const sp of npc.blink.tlGlow) {
        sp.visible = braking;
        if (braking) sp.scale.set(gs, gs, 1);
      }

      // --- blind-spot monitor: anyone sitting alongside the player?
      if (npc.dir === (player.dir ?? 1)) {
        const rel = loopDelta(player.s, npc.s) * (player.dir ?? 1);   // + = ahead
        if (rel > -7.5 && rel < 2.5) {
          const dLat = (lat - player.lat) * (player.dir ?? 1);        // + = player's left
          if (dLat > 1.6 && dLat < 5.8) this._bsL = true;
          else if (dLat < -1.6 && dLat > -5.8) this._bsR = true;
        }
      }

      // --- player collision (skip when on different GWB decks / spur flyovers)
      const playerDrop = (player.deckLower ? gwbLowerDrop(player.s) : 0)
        - (player.spurRise || 0);
      const playerGap = player
        ? Math.abs(loopDelta(player.s, npc.s)) * distanceScaleAt(player.s)
        : Infinity;
      if (player && Math.abs(npcDrop - playerDrop) < 2
          && playerGap < (npc.type.L + 4.8) / 2
          && Math.abs(player.lat - lat) < (npc.type.W + 1.9) / 2 + 0.4) {
        onCrash && onCrash(npc);
      }
    }
    if (player.setBlindSpot) player.setBlindSpot(this._bsL, this._bsR);
  }

  playerLane(player) {
    // invert lat → lane through latForLane so the local/express gap, spur
    // forks and plaza widenings all map correctly (a flat divide-by-LANE_WIDTH
    // put the player past LANES_MAX on the GSP local lanes — invisible to
    // traffic, which then drove straight through them)
    const pDir = player.dir ?? 1;
    let best = 0, bestD = Infinity;
    for (let ln = 0; ln <= LANES_MAX; ln++) {
      const d = Math.abs(latForLane(pDir, ln, player.s) - player.lat);
      if (d < bestD) { bestD = d; best = ln; }
    }
    if (bestD > laneWidthAt(player.s) * 1.6) return -99;   // off the carriageway entirely
    const l0 = latForLane(pDir, best, player.s);
    const l1 = latForLane(pDir, best + 1, player.s);
    const frac = (l1 - l0) ? (player.lat - l0) / (l1 - l0) : 0;
    return best + Math.max(-0.5, Math.min(0.5, frac));
  }

  respawnAtEdge(npc, player) {
    const sign = mulberry() < 0.5 ? 1 : -1;
    const s = wrapS(player.s + sign * SPAWN_RADIUS * (0.82 + mulberry() * 0.14));
    this.spawn(npc, s);
  }
}
