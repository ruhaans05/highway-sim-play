import * as THREE from 'three';
import { MAP, DIR, WALK, EURO, UK, DAY_LENGTH, DISTANCE_SCALE, LOOP_LENGTH, zoneAt, EXITS, ZONES, SPAWNS, loopDelta } from './config.js';
import { startVillage } from './village.js?rail-20261101-7';
import { buildRoad, buildStreetlights, buildRibbon, pavedHalfAt, posAt } from './road.js?v=brp-lights-20261108-6';
import { buildEnvironment, updateEnvironment, updateClouds, buildBillboards, buildBillboardBelt, forestFill } from './environment.js';
import { setNightLights } from './vehicles.js';
import { Traffic } from './traffic.js?v=density-ramp-20261108-8';
import { BuddyDriver } from './buddy.js';
import { Player, ChaseCamera } from './player.js';
import {
  buildMumbai, buildSignals, updateSignals, Pedestrians, buildMetro, updateMetro,
  WrongWayRiders,
} from './mumbai.js';
import { buildPune, welcomeSign } from './turnpike.js';
import { buildAundh, buildPuneRoadside, buildIndiaExtras } from './pune.js';
import { buildI95 } from './i95.js';
import { buildTexasI45, buildFloridaTurnpike } from './sunbelt.js';
import { buildNH48 } from './nh48.js';
import { buildI287 } from './i287.js';
import { buildI278 } from './i278.js';
import { buildBronxRiver } from './bronxriver.js?v=brp-20261108-5';
import { buildNewEngland } from './boston.js';
import { buildNc40 } from './nc40.js';
import { buildI80 } from './i80.js';
import { buildI78 } from './i78.js';
import { buildI280, buildUS22 } from './nj_routes.js';
import { buildGsp } from './gsp.js';
import { buildAcx } from './acx.js';
import { buildBay } from './bay.js';
import { buildCaliforniaI5 } from './california.js';
import { buildNYC } from './nyc.js';
import { buildUS1, buildUS1Signals } from './us1.js';
import { buildChester } from './chester.js';
import { buildAirport } from './airport.js';
import { buildSouthMumbai } from './southmumbai.js';
import { buildMidwest, updateWindFarm, updateDMS, updateChicago } from './midwest-rebuild.js';
import { buildLibertia } from './libertia.js';
import { buildLibertiaRoute, buildLibertiaRouteEnhancements, buildUS67CityStreets, updateUS67CityStreets } from './libertia_routes.js';
import { buildPortugalA1, buildSpainA4, buildGermanyA3, buildUKM1, buildFranceA16, buildItalyA1, buildSwitzerland, euroLitMat } from './europe.js';
import { buildAmericana } from './america.js';
import { buildNewDelhi } from './newdelhi.js';
import { buildDelhiKolkata } from './delhikolkata.js';
import { buildShields, updateNJVms } from './signage.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { initAudio, honk, setHonkDin, setAmbience } from './audio.js';
import { maybeUpdateEnvMap } from './sky.js';
import { PostFX } from './fx.js';

const app = document.getElementById('app');
// Long-distance real-world routes use a real 24-hour clock by default, so a
// multi-hour drive does not burn through an artificial five-hour day. The
// shorter legacy maps keep their established faster cycle.
const REAL_TIME_LONG_MAP = MAP === 'tx45' || MAP === 'flturnpike' || MAP === 'cal5' || MAP === 'nh48' || MAP === 'delhikolkata' || MAP === 'libertia' || MAP === 'i380' || MAP === 'i980' || MAP === 'lb24' || MAP === 'us67' || MAP === 'nc40';
// The 97 km Mumbai–Pune route is kept at logical scale, but its in-game clock
// is relaxed so a normal congested run reads as roughly 3–4 game hours rather
// than burning through the whole day before Pune.
const CLOCK_DAY_LENGTH = MAP === 'india' ? 30000
  : REAL_TIME_LONG_MAP ? 86400 * DISTANCE_SCALE : DAY_LENGTH;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// PostFX performs the final exposure/tone grade. Keep the renderer's own
// exposure neutral so it cannot double-brighten sun-facing Northeast views.
renderer.toneMappingExposure = 0.90;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 7000);

// HDR post pipeline (road maps): bloom, lens flare, ACES grade, vignette
const post = WALK ? null : new PostFX(renderer);

// Windshield wiper overlay: a plain 2D canvas over the WebGL view, screen-
// space so it stays put through cockpit head-sway/mirror glances. Only wired
// up (and shown) inside the road-loop cockpit view — see startRoad() below.
const wiperCanvas = document.getElementById('wipers');
const wiperCtx = wiperCanvas.getContext('2d');
function sizeWiperCanvas() {
  const dpr = Math.min(devicePixelRatio, 2);
  wiperCanvas.width = innerWidth * dpr;
  wiperCanvas.height = innerHeight * dpr;
  wiperCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeWiperCanvas();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (post) post.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
  sizeWiperCanvas();
});

// Walking maps (Konkan / Bihar villages) run an entirely separate free-roam
// engine; the road-loop setup below is skipped for them.
if (WALK) {
  startVillage({ scene, camera, renderer });
} else {
  startRoad();
}

function startRoad() {
// URL params for deep-linking/testing: ?map=i95|world&dir=south|north&zone=mumbai&tod=0.5
const q = new URLSearchParams(location.search);
const qZone = ZONES.find(z => z.key === q.get('zone')
  || z.label.toLowerCase() === (q.get('zone') || '').toLowerCase());

// registry: handles that day/night animation needs to touch
const registry = { signs: [] };

buildRoad(scene, registry);
buildStreetlights(scene, registry);
buildEnvironment(scene, registry);
initMinimap();   // live region map, right edge (faded; hover to brighten)

// map dressing + map-specific movers. Pedestrians/signals belong to city
// streets (Mumbai, Pune, Cincinnati) — nobody walks across an interstate.
let signalHeads = null, pedestrians = null, puneCityPeds = null, cincyPeds = null, us67City = null;
let chesterCrossTraffic = null, i78Terminus = null;
let chemburPeds = null;
let metroTrains = null, wrongWay = null;
let euroPeds = null;
if (MAP === 'india') {
  signalHeads = buildMumbai(scene, registry, buildBillboards);
  buildPune(scene, registry);
  // people everywhere: shoulders, dividers, slum lanes — 20 miles of it
  pedestrians = new Pedestrians(scene, 8600, {
    mix: { walk: 0.52, slum: 0.36, divider: 0.12 },
  });
  metroTrains = buildMetro(scene);
  wrongWay = new WrongWayRiders(scene, 12);
  // Chembur / Sion-Panvel: absolute chaos — crowds spilling off both shoulders,
  // jaywalking through the jammed junctions, the densest stretch on the map
  chemburPeds = new Pedestrians(scene, 3600, {
    s0: 27000, s1: 32000, seed: 4477, mix: { walk: 0.54, slum: 0.34, divider: 0.12 },
  });
  // Pune-city shops/bike-parks/tapris for the last stretch of the run
  buildPuneRoadside(scene, registry);
  // route realism: BEST/PMPML shelters, NH-48 dhabas, auto stands
  buildIndiaExtras(scene, registry);
  welcomeSign(scene, registry, 33400, 1, ['NAVI MUMBAI', 'नवी मुंबई', 'CIDCO'], '#0d6b3f');
  welcomeSign(scene, registry, 92650, 1, ['WELCOME TO PUNE', 'पुणे नगरी', 'पुणे महानगरपालिका'], '#123a7a');
  welcomeSign(scene, registry, 32050, -1, ['MUMBAI', 'मुंबई', 'बृहन्मुंबई महानगरपालिका'], '#0d6b3f');
  // Pimpri-Chinchwad + Pune street life: crowds spilling onto the highway
  // shoulders and jaywalking across, thick through the FC Road / JM Road core
  puneCityPeds = new Pedestrians(scene, 2800, {
    s0: 87000, s1: 97000, seed: 9182, mix: { walk: 0.72, slum: 0.22, divider: 0.06 },
  });
} else if (MAP === 'aundh') {
  // Aundh–Baner Road: the whole 28 km circuit is street life — shoulder
  // walkers, shop crowds, knots of people chilling outside the tapris,
  // beggars/sellers working the divider at the chowks
  buildAundh(scene, registry);
  signalHeads = buildSignals(scene);
  pedestrians = new Pedestrians(scene, 4600, {
    s0: 0, s1: 28000, seed: 5151, mix: { walk: 0.5, slum: 0.42, divider: 0.08 },
  });
  // extra-dense bazaar crowds: Aundh Gaon → DP Rd, and Pashan Gaon → ITI Rd
  chemburPeds = new Pedestrians(scene, 2400, {
    s0: 0, s1: 8200, seed: 5252, mix: { walk: 0.56, slum: 0.38, divider: 0.06 },
  });
  puneCityPeds = new Pedestrians(scene, 1900, {
    s0: 24800, s1: 28000, seed: 5353, mix: { walk: 0.54, slum: 0.40, divider: 0.06 },
  });
  // Balewadi High Street evening crowd — strolling, not squatting
  cincyPeds = new Pedestrians(scene, 1100, {
    s0: 12000, s1: 21000, seed: 5454, mix: { walk: 0.9, slum: 0.06, divider: 0.04 },
  });
  wrongWay = new WrongWayRiders(scene, 26);   // shoulder wrong-siders, a Pune institution
} else if (MAP === 'andheri') {
  // inner Andheri West blown out to ~15 mi of packed local road, capped by
  // the airport flyover at the top of the loop
  signalHeads = buildMumbai(scene, registry, buildBillboards);
  buildAirport(scene, registry);
  buildSouthMumbai(scene, registry);
  // crowds jam the local streets (not the airport flyover): shoulders, slums,
  // dividers — thousands of them over the whole stretch
  pedestrians = new Pedestrians(scene, 12000, {
    s0: 0, s1: 20600, mix: { walk: 0.47, slum: 0.39, divider: 0.14 },
  });
  // Bandra has its own continuous sidewalk life: residents, shopfront crowds,
  // delivery workers and informal roadside activity, not an empty transition
  // between Andheri and the Sea Link.
  chemburPeds = new Pedestrians(scene, 3200, {
    s0: 20800, s1: 28000, seed: 8121, mix: { walk: 0.56, slum: 0.30, divider: 0.14 },
  });
  // Marine Drive / Chowpatty promenade: people strolling the seafront
  puneCityPeds = new Pedestrians(scene, 1500, {
    s0: 33000, s1: 51000, seed: 8123, mix: { walk: 0.95, slum: 0, divider: 0.05 },
  });
  wrongWay = new WrongWayRiders(scene, 30);
} else if (MAP === 'newdelhi') {
  // Delhi ka chakkar: Gurgaon → IGI → Lutyens → CP → ITO → Noida → Rohtak
  buildNewDelhi(scene, registry);
  signalHeads = buildSignals(scene);
  // crowds where Delhi actually crowds: the signalised inner city + Rohtak
  pedestrians = new Pedestrians(scene, 2600, {
    s0: 19000, s1: 34000, seed: 1911, mix: { walk: 0.66, slum: 0.28, divider: 0.06 },
  });
  puneCityPeds = new Pedestrians(scene, 900, {
    s0: 86000, s1: 92000, seed: 1913, mix: { walk: 0.7, slum: 0.24, divider: 0.06 },
  });
  wrongWay = new WrongWayRiders(scene, 22);   // NH-10 wrong-siders, a Delhi institution
} else if (MAP === 'delhikolkata') {
  buildDelhiKolkata(scene, registry);
  signalHeads = buildSignals(scene);
  // Rural life is visible but pedestrians stay distributed by settlement
  // density; urban spans receive the existing dense city pedestrian model.
  pedestrians = new Pedestrians(scene, 4200, {
    s0: 25000, s1: 1500000, seed: 2207, offRoad: [4, 18],
    mix: { walk: 0.78, slum: 0.18, divider: 0.04 },
  });
  puneCityPeds = new Pedestrians(scene, 2200, {
    s0: 280000, s1: 390000, seed: 2208, offRoad: [5, 22],
    mix: { walk: 0.72, slum: 0.24, divider: 0.04 },
  });
  wrongWay = new WrongWayRiders(scene, 48);
} else if (MAP === 'midwest') {
  buildMidwest(scene, registry);
} else if (MAP === 'libertia') {
  buildLibertia(scene, registry);
  buildLibertiaRouteEnhancements(scene, registry);
} else if (MAP === 'i380' || MAP === 'i980' || MAP === 'lb24' || MAP === 'us67') {
  buildLibertiaRoute(scene, registry, MAP);
  if (false && MAP === 'us67') {
    us67City = buildUS67CityStreets(scene, registry);
    // US-67's town and inner-city sections are sidewalk streets, not empty
    // freeway shoulders. Use the existing diverse pedestrian model: varied
    // ages, genders, skin tones, clothing, and body shapes, kept off-road.
    pedestrians = new Pedestrians(scene, 1850, {
      s0: 167000, s1: 205000, seed: 6707,
      mix: { walk: 1, slum: 0, divider: 0 }, euro: true,
    });
    // Smaller, localized sidewalk crowds at the compact rural-town centers;
    // the open farm and affluent suburban sections stay pedestrian-light.
    puneCityPeds = new Pedestrians(scene, 520, {
      s0: 76000, s1: 125000, seed: 6711,
      mix: { walk: 1, slum: 0, divider: 0 }, euro: true,
    });
  }
} else if (MAP === 'i287') {
  buildI287(scene, registry);
} else if (MAP === 'i278') {
  buildI278(scene, registry);
} else if (MAP === 'bronxriver') {
  buildBronxRiver(scene, registry);
} else if (MAP === 'newengland') {
  buildNewEngland(scene, registry);
} else if (MAP === 'nc40') {
  buildNc40(scene, registry);
} else if (MAP === 'i80') {
  buildI80(scene, registry);
} else if (MAP === 'i78') {
  i78Terminus = buildI78(scene, registry);
  signalHeads = buildSignals(scene);
} else if (MAP === 'i280') {
  buildI280(scene, registry);
} else if (MAP === 'us22') {
  buildUS22(scene, registry);
} else if (MAP === 'gsp') {
  buildGsp(scene, registry);
} else if (MAP === 'acx') {
  buildAcx(scene, registry);
  signalHeads = buildSignals(scene);
} else if (MAP === 'bay') {
  buildBay(scene, registry);
} else if (MAP === 'cal5') {
  buildCaliforniaI5(scene, registry);
} else if (MAP === 'nyc') {
  buildNYC(scene, registry);
  // The GWB → LIE → Jericho route is freeway-only scenery: keep the
  // buildings, traffic, taxis, and signs, but do not place walking people on
  // the shoulders or frontage areas anywhere on this map.
} else if (MAP === 'us1') {
  signalHeads = buildUS1(scene, registry);
} else if (MAP === 'chester') {
  signalHeads = buildUS1Signals(scene);
  chesterCrossTraffic = buildChester(scene, registry);
} else if (MAP === 'tx45') {
  buildTexasI45(scene, registry);
} else if (MAP === 'flturnpike') {
  buildFloridaTurnpike(scene, registry);
} else if (MAP === 'a1') {
  buildPortugalA1(scene, registry);
} else if (MAP === 'a4') {
  buildSpainA4(scene, registry);
} else if (MAP === 'a3') {
  buildGermanyA3(scene, registry);
} else if (MAP === 'm1') {
  buildUKM1(scene, registry);
} else if (MAP === 'a16') {
  buildFranceA16(scene, registry);
} else if (MAP === 'a1it') {
  buildItalyA1(scene, registry);
} else if (MAP === 'swiss') {
  buildSwitzerland(scene, registry);
} else {
  buildI95(scene, registry);
}
if (MAP === 'nh48') buildNH48(scene, registry);
// The American roadside signature — water towers, big-box strips, dealerships,
// green overpasses, Plains grain elevators, New England commons — the US
// counterpart to the country-specific dressing on the European maps. Only the
// US road maps; India, Europe and pure-city NYC are handled elsewhere.
if (MAP !== 'india' && MAP !== 'nh48' && MAP !== 'delhikolkata' && MAP !== 'andheri' && MAP !== 'aundh' && !EURO && !UK && MAP !== 'nyc' && MAP !== 'chester' && MAP !== 'bronxriver') buildAmericana(scene, registry, MAP);

// European city fabric lights its windows at night (ramped by the day/night loop)
if (EURO || UK) registry.euroLit = [euroLitMat];
// European street life: people on the pavements and plazas of the urbanized
// stretches — well clear of the carriageway, nobody walks an autobahn
if (EURO || UK) {
  const PED_SPANS = {
    a1: [[0, 30000], [63000, 71000], [127000, 135000], [178000, 205000], [228000, 240000], [262000, 299000]],
    a4: [[0, 30000], [33000, 40000], [388000, 404000], [449000, 457000], [500000, 507000], [510000, 529000]],
    a3: [[0, 20000], [50000, 57000], [134000, 145000], [160000, 175000]],
    m1: [[0, 15000], [71000, 78000], [92000, 99000], [134000, 142000], [148000, 212000],
      [246000, 252000], [286000, 294000], [306000, 318000]],
    a16: [[0, 12000], [33000, 41000], [92000, 98000], [128000, 142000], [212000, 222000], [258000, 290000]],
    a1it: [[0, 15000], [69000, 76000], [114000, 121000], [189000, 200000], [205000, 225000]],
    swiss: [[3000, 12000], [62000, 92000], [100000, 116000], [120000, 162000],
      [210000, 250000], [258000, 268000], [296000, 346000], [348000, 408000]],
  }[MAP];
  euroPeds = PED_SPANS.map(([s0, s1], i) => new Pedestrians(scene, Math.round((s1 - s0) / 55), {
    s0, s1, seed: 7300 + i * 17, euro: true, offRoad: [20, 70],
    mix: { walk: 0, slum: 1, divider: 0 },
  }));
}
// blanket forest, whole loop, density tuned per region: the Northeast is a
// forest with highways through it; farm country gets hedgerows; the arid Bay
// hills and Indian plains stay sparser
if (MAP === 'i95') {
  // i95 grew from a 136 km NE loop to a 2,044 km New Haven→Boston-via-Miami
  // true-scale run (DE→FL added at real mileage south of Wilmington). A flat
  // factor-1 blanket over the whole thing would be ~15x the tree instances
  // the original NE stretch was tuned for, so the two established NE ranges
  // (New Haven→PA and the shifted Boston/Providence/New London loop-back)
  // keep the original density; the new DE→FL run gets a lighter density that
  // still reads as unbroken pine/hardwood forest (it genuinely is, most of
  // the way) without ballooning instance counts 15x.
  forestFill(scene, 1.18, 0, 36500);     // New Haven → CT → Westchester: continuous wooded enclosure
  forestFill(scene, 1, 44000, 96000);    // NJ Turnpike → Philly → DE (skip the walled Cross Bronx trench 36.5k–44k)
  // The southern run is not a bare median with a few token trees: rural I-95
  // is often a tight pine/hardwood corridor, while the metro calls below add
  // buildings and walls where development replaces the woods.
  // Delaware through North Carolina is a closed-in Eastern woodland corridor:
  // even where the ground is naturally flat, layered trees prevent it from
  // reading as an exposed plain. South Carolina onward keeps the lighter
  // coastal-plain treatment.
  forestFill(scene, 0.72, 96000, 522700, 500);
  forestFill(scene, 0.92, 522700, 888500, 500);
  forestFill(scene, 0.38, 888500, 2003600, 500);
  forestFill(scene, 1, 2003600, LOOP_LENGTH, 900);
} else if (MAP === 'i287') {
  // Keep the suburban/highland corridor fully wooded without planting the
  // blanket forest in the Hudson around the Tappan Zee or beside the GWB.
  forestFill(scene, 1.18, 0, 90000);
  forestFill(scene, 1.08, 98000, 130000, 287);
} else if (MAP === 'bronxriver') {
  // Dense Northeast enclosure rather than the generic baseline: a near tree
  // wall plus mid/deep woodland hides the open terrain throughout Westchester,
  // continues through the Bronx parks, and screens the Clearview suburbs.
  forestFill(scene, 1.42, 0, 20000, 295);
  forestFill(scene, 1.18, 20000, 33000, 296);
  forestFill(scene, 0.92, 44500, LOOP_LENGTH, 297);
} else {
  forestFill(scene, {
    // gsp runs 279 km with its own 3-row wall in gsp.js, so the blanket fill
    // stays moderate — together they read as unbroken forest
    i287: 0, i278: 0, bronxriver: 0, i78: 0, gsp: 0.8, acx: 0.9, newengland: 1.2, i80: 1, nyc: 0, us1: 0.42,
    tx45: 0.5, flturnpike: 0.62, nh48: 0.42,
    midwest: 0.35, libertia: 0.28, i380: 0.95, i980: 0.22, lb24: 0.62, us67: 0.32, bay: 0.4, india: 0.55, delhikolkata: 0.48, andheri: 0.3, aundh: 0.4,
    a1: 0.85, a4: 0.1, a3: 1.25,   // PT pine country / arid meseta / German woods
    m1: 0.8, a16: 0.6, cal5: 0.22, // California valley trees are sparse; custom farms/foothills add the rest
    a1it: 0.45,                    // dry Mediterranean valley
    chester: 1.25,                 // dense wooded suburban Philadelphia
    swiss: 1.15,                   // dark-green Alpine forest and Jura woods
  }[MAP] ?? 0.8);
}
buildShields(scene, registry);   // periodic route shields + control cities, all maps
// big roadside hoardings the whole way around — packed in the cities, thinner
// but ever-present through the country (all road maps, US + India)
buildBillboardBelt(scene, registry, 9090, MAP === 'india' || MAP === 'nh48' || MAP === 'delhikolkata' || MAP === 'andheri' || MAP === 'aundh',
  new Set(['andheriW', 'airport', 'bandra', 'marine', 'chembur', 'mumbai', 'pune', 'pcmc',
    'p_gaon', 'p_aundh', 'p_link', 'p_baner', 'p_bale', 'p_iti',
    'newhaven', 'yonkers', 'nybronx', 'i278_nj440', 'i278_outerbridge', 'i278_westshore', 'i278_staten',
    'i278_verrazzano', 'i278_brooklyn', 'i278_brooklyn_south', 'i278_kosciuszko',
    'i278_queens', 'i278_rfk_approach', 'i278_rfk', 'i278_bronx',
    'chester_west', 'chester_retail', 'chester_school']));

const player = new Player(scene);
// I-95 reload: put the player immediately ahead of the long Philadelphia
// downtown/Northeast construction run, from whichever direction is selected.
const defaultSpawn = MAP === 'i95' ? (DIR < 0 ? 86850 : 79940)
  : MAP === 'india' ? 29100 // ~2.9 km west of Vashi, still Chembur, eastbound
  : MAP === 'midwest' ? 2000
  : MAP === 'libertia' || MAP === 'i380' || MAP === 'i980' || MAP === 'lb24' || MAP === 'us67' ? 1200
  : MAP === 'newengland' ? 800
  : MAP === 'nc40' ? 22000
  : MAP === 'i80' ? 800
  : MAP === 'i78' ? 1200
  : MAP === 'i280' ? 1200
  : MAP === 'us22' ? 1200
  : MAP === 'i278' ? 1200
  : MAP === 'bronxriver' ? 900
  : MAP === 'tx45' ? (DIR < 0 ? 371000 : 1200)
  : MAP === 'flturnpike' ? (DIR < 0 ? 751000 : 1200)
  : MAP === 'gsp' ? 1000   // Cape May, mile 0 — the whole Parkway ahead of you
  : MAP === 'acx' ? (DIR < 0 ? 67000 : 800) // westbound just before Egg Harbor toll
  : MAP === 'bay' ? 1500
  : MAP === 'cal5' ? (DIR < 0 ? 603000 : 1200)
  : MAP === 'nh48' ? (DIR < 0 ? 990000 : 1200)
  : MAP === 'delhikolkata' ? (DIR < 0 ? 1529500 : 1200)
  : MAP === 'nyc' ? (DIR < 0 ? 44800 : 41590) // one mile before Nassau work zone
  : MAP === 'us1' ? 9000    // Princeton shopping corridor
  : MAP === 'chester' ? 900   // West Chester PA-3 suburban arterial
  : MAP === 'aundh' ? 3400  // Parihar Chowk, the heart of Aundh
  : (EURO || UK) ? 800
  : 400;
// ?s=<meters> lands at an exact position (used by the cross-map interchange
// jumps to arrive right at the connecting exit); else a named zone; else default
player.teleport(q.get('s') != null ? +q.get('s') : qZone ? qZone.start + 400 : defaultSpawn);
// ACX's default deep-link is a westbound Egg Harbor toll approach: Tesla, MA
// plate, and the same clear summer setup used for the personal-car reload.
if (MAP === 'acx') {
  const requestedVehicle = q.get('vehicle');
  player.setVehicle(['car', 'jazz', 'tesla', 'bmw', 'volvo', 'mercedes', 'jetta', 'lexus'].includes(requestedVehicle) ? requestedVehicle : 'tesla');
  player.setPlate(q.get('plate') || 'MA');
}
// I-95 reload preset: maroon Jetta, current New York plate, clear summer,
// 3 PM (the clock/season defaults below already provide the latter two).
if (MAP === 'i95') {
  const requestedVehicle = q.get('vehicle');
  player.setVehicle(['car', 'jazz', 'tesla', 'bmw', 'volvo', 'mercedes', 'jetta', 'lexus'].includes(requestedVehicle) ? requestedVehicle : 'jetta');
  player.setPlate(q.get('plate') || 'NY');
}
// NC-40 / I-85 route preset: silver Lexus sedan with North Carolina plates.
if (MAP === 'nc40') {
  const requestedVehicle = q.get('vehicle');
  player.setVehicle(['car', 'jazz', 'tesla', 'bmw', 'volvo', 'mercedes', 'jetta', 'lexus'].includes(requestedVehicle) ? requestedVehicle : 'lexus');
  player.setPlate(q.get('plate') || 'NC');
}
// Midwest reload preset: Volvo, Illinois plate, and the higher offset view.
// Explicit URL parameters still override these defaults.
if (MAP === 'midwest') {
  player.setVehicle(q.get('vehicle') || 'volvo');
  player.setPlate(q.get('plate') || 'IL');
}
const requestedVehicle = q.get('vehicle');
if (['car', 'jazz', 'tesla', 'bmw', 'volvo', 'mercedes', 'jetta', 'lexus'].includes(requestedVehicle)) player.setVehicle(requestedVehicle);
const traffic = new Traffic(scene, player.s);
const buddy = new BuddyDriver(scene, player, traffic);
const chase = new ChaseCamera(camera);
const rearViewButton = document.getElementById('rearviewbutton');
let rearViewHeld = false;
function setRearView(active) {
  if (rearViewHeld === active) return;
  rearViewHeld = active;
  chase.setRearView(active);
  rearViewButton?.classList.toggle('active', active);
  rearViewButton?.setAttribute('aria-pressed', String(active));
}
addEventListener('keydown', e => {
  if (e.code === 'KeyP') {
    e.preventDefault();
    setRearView(true);
  }
});
addEventListener('keyup', e => {
  if (e.code === 'KeyP') setRearView(false);
});
addEventListener('blur', () => setRearView(false));
if (rearViewButton) {
  rearViewButton.addEventListener('pointerdown', e => {
    e.preventDefault();
    rearViewButton.setPointerCapture?.(e.pointerId);
    setRearView(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    rearViewButton.addEventListener(type, () => setRearView(false));
  }
}
const requestedCamera = q.get('cam');
if (requestedCamera === 'angled' || (MAP === 'midwest' && !requestedCamera)) {
  // Keep the original chase view as the default, while allowing deep links to
  // open directly in the clearer offset traffic view.
  chase.mode = 2;
}

// Traffic density is an opt-in control: absent/invalid query params and an
// untouched slider leave Traffic on its long-standing automatic model.
const trafficLevel = document.getElementById('trafficlevel');
const trafficValue = document.getElementById('trafficvalue');
const trafficPacked = document.getElementById('trafficpacked');
const trafficDeadlock = document.getElementById('trafficdeadlock');
const trafficLateNight = document.getElementById('trafficlatenight');
const requestedTrafficLevel = Number.parseInt(q.get('traffic'), 10);
let selectedTrafficLevel = Number.isInteger(requestedTrafficLevel)
  && requestedTrafficLevel >= 1 && requestedTrafficLevel <= 6 ? requestedTrafficLevel : null;
let selectedTrafficMode = ['packed', 'deadlock', 'late-night'].includes(q.get('trafficMode')) ? q.get('trafficMode') : null;
function applyTrafficLevel() {
  selectedTrafficMode = null;
  traffic.setDensityLevel(selectedTrafficLevel);
  trafficLevel.value = String(selectedTrafficLevel ?? 3);
  trafficValue.textContent = selectedTrafficLevel == null ? 'AUTO' : String(selectedTrafficLevel);
  trafficPacked?.classList.remove('active');
  trafficDeadlock?.classList.remove('active');
  trafficLateNight?.classList.remove('active');
}
function applyTrafficMode(mode) {
  selectedTrafficMode = mode;
  selectedTrafficLevel = null;
  traffic.setTrafficMode(mode);
  trafficLevel.value = mode === 'late-night' ? '1' : '6';
  trafficValue.textContent = mode === 'packed' ? 'PACKED FLOW'
    : mode === 'deadlock' ? 'DEADLOCK' : 'LATE NIGHT';
  trafficPacked?.classList.toggle('active', mode === 'packed');
  trafficDeadlock?.classList.toggle('active', mode === 'deadlock');
  trafficLateNight?.classList.toggle('active', mode === 'late-night');
}
trafficLevel.addEventListener('input', () => {
  selectedTrafficLevel = Number.parseInt(trafficLevel.value, 10);
  selectedTrafficMode = null;
  traffic.setDensityLevel(selectedTrafficLevel);
  trafficValue.textContent = String(selectedTrafficLevel);
  trafficPacked?.classList.remove('active');
  trafficDeadlock?.classList.remove('active');
  trafficLateNight?.classList.remove('active');
});
trafficLevel.addEventListener('change', () => trafficLevel.blur());
addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const match = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
  if (!match) return;
  const focused = document.activeElement;
  if (focused?.isContentEditable || focused?.tagName === 'TEXTAREA'
    || (focused?.tagName === 'INPUT' && focused !== trafficLevel)) return;
  e.preventDefault();
  selectedTrafficLevel = Number(match[1]);
  applyTrafficLevel();
});
if (selectedTrafficMode) applyTrafficMode(selectedTrafficMode);
else applyTrafficLevel();
trafficPacked?.addEventListener('click', () => applyTrafficMode('packed'));
trafficDeadlock?.addEventListener('click', () => applyTrafficMode('deadlock'));
trafficLateNight?.addEventListener('click', () => applyTrafficMode('late-night'));

// start at 3 PM
let tod = q.get('tod') ? parseFloat(q.get('tod'))
  : MAP === 'india' ? 18.25 / 24
  : MAP === 'acx' ? 11 / 24 : 15 / 24;
let timeScale = 1;
let weather = 'clear';   // clear | rain | snow (America) | monsoon (India)
const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const monthParam = Number.parseInt(q.get('month'), 10);
const legacySeasonMonth = q.get('season') === 'winter' ? 0 : q.get('season') === 'summer' ? 6 : null;
let month = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12
  ? monthParam - 1 : legacySeasonMonth ?? new Date().getMonth();
const monthHasWinter = !['india', 'nh48', 'andheri', 'aundh', 'newdelhi', 'delhikolkata'].includes(MAP);
const seasonForMonth = m => monthHasWinter && (m <= 2 || m >= 10) ? 'winter' : 'summer';
let season = seasonForMonth(month);
function setMonth(next, resetIncompatibleWeather = true) {
  month = THREE.MathUtils.clamp(Math.round(next), 0, 11);
  season = seasonForMonth(month);
  if (resetIncompatibleWeather && season !== 'winter'
    && (weather === 'snow' || weather === 'snowlight' || weather === 'snowfront')) weather = 'clear';
  const slider = document.getElementById('monthslider');
  const value = document.getElementById('monthvalue');
  if (slider) slider.value = String(month);
  if (value) value.textContent = MONTH_NAMES[month];
}
let simTime = 0;
let dmsSpeed = 27;   // smoothed speed for the electronic travel-time boards

// Which way is "increasing s" on each map, as a compass heading the player can
// read. [ label when DIR<0 (decreasing s), label when DIR>0 (increasing s) ].
const DIR_LABELS = {
  i95:     ['NORTHBOUND', 'SOUTHBOUND'],   // New Haven ↓ Miami (loops back up via Boston)
  i287:    ['SOUTHBOUND', 'NORTHBOUND'],   // Perth Amboy ↑ Suffern NY
  i278:    ['WESTBOUND · NEW JERSEY', 'EASTBOUND · BRONX / I-95'],
  bronxriver: ['NORTHBOUND · WHITE PLAINS', 'SOUTHBOUND · QUEENS'],
  midwest: ['NORTHBOUND', 'SOUTHBOUND'],   // Chicago ↓ Cincinnati
  india:   ['WESTBOUND', 'EASTBOUND'],     // Mumbai → Pune
  nh48:    ['WESTBOUND · MUMBAI', 'EASTBOUND · BENGALURU'],
  andheri: ['NORTHBOUND', 'SOUTHBOUND'],   // Andheri ↓ South Mumbai
  aundh:   ['औंधकडे · TO AUNDH', 'बाणेरकडे · TO BANER'],   // the Aundh–Baner circuit
  newdelhi: ['वापस · ANTI-CLOCKWISE', 'दिल्ली का चक्कर · CLOCKWISE'],   // the NCR circuit
  delhikolkata: ['पश्चिम की ओर · TO DELHI', 'पूर्व की ओर · TO KOLKATA'],
  newengland: ['SOUTHBOUND', 'EASTBOUND'], // Boston ↔ New Haven (I-91 N / Pike E)
  nc40:     ['EASTBOUND', 'WESTBOUND'],    // eastern I-40 → Charlotte via I-85
  i80:     ['EASTBOUND', 'WESTBOUND'],     // GWB → Chicago (westbound)
  i78:     ['EASTBOUND', 'WESTBOUND'],     // PA → Holland Tunnel → Long Island
  i280:    ['WESTBOUND', 'EASTBOUND'],     // Newark → Morris County
  us22:    ['WESTBOUND', 'EASTBOUND'],    // Newark/Union → Lehigh Valley
  tx45:    ['NORTHBOUND · DALLAS', 'SOUTHBOUND · HOUSTON'],
  flturnpike: ['SOUTHBOUND · MIAMI', 'NORTHBOUND · WILDWOOD'],
  gsp:     ['SOUTHBOUND', 'NORTHBOUND'],   // Cape May ↑ NY line
  acx:     ['WESTBOUND', 'EASTBOUND'],     // Philadelphia → Atlantic City
  bay:     ['↺ CCW', '↻ CW'],              // loop around the bay
  cal5:    ['NORTHBOUND · SAN FRANCISCO', 'SOUTHBOUND · LOS ANGELES'],
  nyc:     ['WESTBOUND', 'EASTBOUND'],     // GWB ↔ Jericho (east to Long Island)
  libertia: ['WESTBOUND', 'EASTBOUND'],   // Missouri Line → Reston → Jacobs
  us67:     ['WESTBOUND · RESTON', 'EASTBOUND · JACOBS → RESTON · I-680'],
  us1:     ['SOUTHBOUND', 'NORTHBOUND'],   // Trenton ↑ Jersey City
  a1:      ['SENTIDO LISBOA · SUL', 'SENTIDO PORTO · NORTE'],
  a4:      ['SENTIDO MADRID', 'SENTIDO SEVILLA'],
  a3:      ['RICHTUNG FRANKFURT', 'RICHTUNG KÖLN'],
  m1:      ['THE NORTH · BIRMINGHAM', 'THE SOUTH · DOVER'],
  a16:     ['DIRECTION CALAIS', 'DIRECTION PARIS'],
  a1it:    ['DIREZIONE ROMA', 'DIREZIONE NAPOLI'],
  swiss:   ['↑ INTERLAKEN · BERN', 'GENÈVE · LAUSANNE ↓'],
}[MAP] || ['NORTHBOUND', 'SOUTHBOUND'];
const dirLabel = ' · ' + DIR_LABELS[DIR > 0 ? 1 : 0];
// Midwest route changes compass direction at the real highway handoffs:
// I-294 south → I-80/94 east → I-65 south → I-74 east → I-75 north.
const dirLabelAt = s => {
  if (MAP !== 'midwest') return dirLabel;
  const inc = s < 27000 ? 'SOUTHBOUND'
    : s < 48000 ? 'EASTBOUND'
    : s < 95000 ? 'SOUTHBOUND'
    : s < 138000 ? 'EASTBOUND'
    : 'NORTHBOUND';
  const dec = inc === 'SOUTHBOUND' ? 'NORTHBOUND'
    : inc === 'EASTBOUND' ? 'WESTBOUND' : 'SOUTHBOUND';
  return ' · ' + (DIR > 0 ? inc : dec);
};

// Which city/state you're driving through, by position along the loop. Shown in
// the HUD as "City, ST" and updated as you go.
const CITY_BANDS = {
  nh48: [
    [0, 52000, 'Mumbai', 'MH'], [52000, 90000, 'Panvel', 'MH'], [90000, 138000, 'Lonavala', 'MH'],
    [138000, 205000, 'Pune', 'MH'], [205000, 300000, 'Satara', 'MH'], [300000, 360000, 'Karad', 'MH'],
    [360000, 430000, 'Kolhapur', 'MH'], [430000, 470000, 'Nipani', 'KA'], [470000, 535000, 'Belagavi', 'KA'],
    [535000, 610000, 'Hubballi', 'KA'], [610000, 690000, 'Haveri', 'KA'], [690000, 800000, 'Davanagere', 'KA'],
    [800000, 930000, 'Tumakuru', 'KA'], [930000, 1020000, 'Bengaluru', 'KA'],
  ],
  i95: [
    [0, 6000, 'New Haven', 'CT'], [6000, 14000, 'Bridgeport', 'CT'],
    [14000, 24000, 'Norwalk', 'CT'], [24000, 31500, 'Stamford', 'CT'],
    [31500, 36500, 'White Plains', 'NY'], [36500, 44000, 'The Bronx', 'NY'],
    [44000, 48000, 'Fort Lee', 'NJ'], [48000, 54000, 'Newark', 'NJ'],
    [54000, 60000, 'Elizabeth', 'NJ'], [60000, 66000, 'Woodbridge', 'NJ'],
    [66000, 71000, 'New Brunswick', 'NJ'], [71000, 77000, 'Trenton', 'NJ'],
    [77000, 88000, 'Philadelphia', 'PA'], [88000, 91000, 'Chester', 'PA'],
    [91000, 96000, 'Wilmington', 'DE'],
    // DE → FL true-scale run
    [96000, 120800, 'Newark', 'DE'], [120800, 133700, 'Wilmington', 'DE'],
    [133700, 159400, 'Perryville', 'MD'], [159400, 201300, 'Bel Air', 'MD'],
    [201300, 230200, 'Baltimore', 'MD'], [230200, 252800, 'Laurel', 'MD'],
    [252800, 309100, 'Capital Beltway', 'MD'],
    [309100, 324800, 'Springfield', 'VA'], [324800, 393900, 'Fredericksburg', 'VA'],
    [393900, 461500, 'Ashland', 'VA'], [461500, 488900, 'Richmond', 'VA'],
    [488900, 522700, 'Petersburg', 'VA'], [522700, 596700, 'Emporia', 'VA'],
    [596700, 666500, 'Roanoke Rapids', 'NC'], [666500, 732400, 'Rocky Mount', 'NC'],
    [732400, 798400, 'Fayetteville', 'NC'], [798400, 888500, 'Lumberton', 'NC'],
    [888500, 950900, 'Dillon', 'SC'], [950900, 1044300, 'Florence', 'SC'],
    [1044300, 1123100, 'Santee', 'SC'], [1123100, 1208400, 'Walterboro', 'SC'],
    [1208400, 1266400, 'Midway', 'GA'], [1266400, 1342000, 'Savannah', 'GA'],
    [1342000, 1388700, 'Kingsland', 'GA'],
    [1388700, 1585200, 'Jacksonville', 'FL'], [1585200, 1680200, 'Daytona Beach', 'FL'],
    [1680200, 1767100, 'Melbourne', 'FL'], [1767100, 1841100, 'Fort Pierce', 'FL'],
    [1841100, 1897400, 'West Palm Beach', 'FL'], [1897400, 1963400, 'Fort Lauderdale', 'FL'],
    [1963400, 2003600, 'Miami', 'FL'],
    // Northeast leg (Boston/Providence/New London), shifted +1907600
    [2003600, 2012600, 'Boston', 'MA'], [2012600, 2018600, 'Providence', 'RI'],
    [2018600, 2025600, 'Warwick', 'RI'], [2025600, 2031600, 'New London', 'CT'],
    [2031600, 2038600, 'Old Saybrook', 'CT'], [2038600, 2043600, 'Guilford', 'CT'],
  ],
  nc40: [
    [0, 16000, 'Johnston County', 'NC'], [16000, 32000, 'Benson', 'NC'],
    [32000, 78000, 'Clayton', 'NC'], [78000, 112000, 'Raleigh', 'NC'],
    [112000, 151000, 'Cary', 'NC'], [151000, 190000, 'Burlington', 'NC'],
    [190000, 230000, 'Greensboro', 'NC'], [230000, 265000, 'High Point', 'NC'],
    [265000, 305000, 'Salisbury', 'NC'], [305000, 350000, 'Charlotte', 'NC'],
  ],
  i78: [
    [0, 36000, 'Lebanon', 'PA'], [36000, 62000, 'Blue Mountain', 'PA'],
    [62000, 105000, 'Allentown', 'PA'], [105000, 125000, 'Easton', 'PA'],
    [125000, 175000, 'Hunterdon', 'NJ'], [175000, 215000, 'Watchung', 'NJ'],
    [215000, 238000, 'Newark', 'NJ'], [238000, 247000, 'Newark Bay', 'NJ'],
    [247000, 260000, 'Jersey City', 'NJ'], [260000, 267000, 'Holland Tunnel', 'NY'],
    [267000, 275000, 'Lower Manhattan', 'NY'],
    [275000, 315000, 'Route Boundary', 'PA'],
  ],
  i280: [[0, 26000, 'Morris County', 'NJ'], [26000, 39000, 'Essex Hills', 'NJ'], [39000, 52000, 'The Oranges', 'NJ'], [52000, 70000, 'Newark', 'NJ']],
  us22: [[0, 14000, 'Phillipsburg', 'NJ'], [14000, 30000, 'Clinton', 'NJ'], [30000, 52000, 'Bridgewater', 'NJ'], [52000, 76000, 'Union', 'NJ'], [76000, 98000, 'Newark', 'NJ']],
  i287: [
    [0, 6000, 'Perth Amboy', 'NJ'], [6000, 20000, 'Edison', 'NJ'],
    [20000, 34000, 'Bridgewater', 'NJ'], [34000, 52000, 'Morristown', 'NJ'],
    [52000, 72000, 'Mahwah', 'NJ'], [72000, 82000, 'Suffern', 'NY'],
    [82000, 90000, 'Nanuet', 'NY'], [90000, 98000, 'Tappan Zee', 'NY'],
    [98000, 108000, 'Tarrytown', 'NY'], [108000, 120000, 'Yonkers', 'NY'],
    [120000, 130000, 'The Bronx', 'NY'], [130000, 134000, 'Fort Lee', 'NJ'],
  ],
  i278: [
    [0, 9000, 'Woodbridge / NJ-440', 'NJ'], [9000, 14000, 'Outerbridge Crossing', 'NY'],
    [14000, 22000, 'West Shore Expressway', 'NY'], [22000, 32000, 'Staten Island', 'NY'],
    [32000, 38000, 'Verrazzano', 'NY'], [38000, 56000, 'Brooklyn / BQE', 'NY'],
    [56000, 61000, 'Kosciuszko Bridge', 'NY'], [61000, 73000, 'Queens / BQE', 'NY'],
    [73000, 79000, 'RFK / Triborough', 'NY'], [79000, 90000, 'The Bronx', 'NY'],
  ],
  bronxriver: [
    [0, 5000, 'White Plains', 'NY'], [5000, 13000, 'Scarsdale', 'NY'],
    [13000, 20000, 'Bronxville', 'NY'], [20000, 27000, 'North Bronx', 'NY'],
    [27000, 35000, 'The Bronx', 'NY'], [35000, 41000, 'East Bronx', 'NY'],
    [41000, 44500, 'Throgs Neck Bridge', 'NY'], [44500, 48500, 'Bayside', 'NY'],
    [48500, 50500, 'Fresh Meadows', 'NY'], [50500, 53000, 'Queens Village', 'NY'],
  ],
  midwest: [
    [0, 8000, 'I-294 / Southwest Suburbs', 'IL'], [8000, 17000, 'I-294 / Markham', 'IL'],
    [17000, 27000, 'I-294 / Chicago Southland', 'IL'], [27000, 34000, 'I-80/I-294 / Calumet', 'IL'],
    [34000, 47000, 'Borman / Hammond–Gary', 'IN'], [47000, 53000, 'I-65 / Gary', 'IN'],
    [53000, 56000, 'Merrillville', 'IN'], [56000, 66000, 'Rensselaer', 'IN'],
    [66000, 74000, 'Lafayette', 'IN'], [74000, 79000, 'Lebanon', 'IN'],
    [79000, 90000, 'Indianapolis / I-465 Bypass', 'IN'], [90000, 95000, 'Indianapolis / I-74 East', 'IN'],
    [95000, 104000, 'Shelbyville', 'IN'],
    [104000, 113000, 'Greensburg', 'IN'], [113000, 123000, 'Batesville', 'IN'],
    [123000, 138000, 'Cincinnati West / I-74', 'OH'], [138000, 147000, 'Mill Creek / I-75', 'OH'],
    [147000, 161000, 'Sharonville', 'OH'], [161000, 180000, 'West Chester · Mason', 'OH'],
  ],
  newdelhi: [
    [0, 8000, 'Gurugram', 'HR'], [8000, 15000, 'Mahipalpur', 'DL'],
    [15000, 19000, 'Dhaula Kuan', 'DL'], [19000, 26000, 'New Delhi', 'DL'],
    [26000, 30000, 'Connaught Place', 'DL'], [30000, 34000, 'ITO', 'DL'],
    [34000, 38000, 'Yamuna Bank', 'DL'], [38000, 46000, 'Noida', 'UP'],
    [46000, 56000, 'South Delhi', 'DL'], [56000, 63000, 'Punjabi Bagh', 'DL'],
    [63000, 72000, 'Bahadurgarh', 'HR'], [72000, 86000, 'Sampla', 'HR'],
    [86000, 92000, 'Rohtak', 'HR'],
  ],
  delhikolkata: [
    [0, 35000, 'Delhi', 'DL'], [35000, 95000, 'Ghaziabad–Hapur', 'UP'],
    [95000, 175000, 'Aligarh', 'UP'], [175000, 285000, 'Etawah', 'UP'],
    [285000, 385000, 'Kanpur', 'UP'], [385000, 465000, 'Fatehpur', 'UP'],
    [465000, 565000, 'Prayagraj', 'UP'], [565000, 645000, 'Mirzapur', 'UP'],
    [645000, 715000, 'Varanasi', 'UP'], [715000, 775000, 'Chandauli', 'UP'],
    [775000, 850000, 'Mohania', 'BR'], [850000, 915000, 'Sasaram', 'BR'],
    [915000, 990000, 'Aurangabad', 'BR'], [990000, 1060000, 'Gaya', 'BR'],
    [1060000, 1135000, 'Barhi', 'JH'], [1135000, 1190000, 'Hazaribagh', 'JH'],
    [1190000, 1270000, 'Dhanbad', 'JH'], [1270000, 1335000, 'Asansol', 'WB'],
    [1335000, 1385000, 'Durgapur', 'WB'], [1385000, 1445000, 'Bardhaman', 'WB'],
    [1445000, 1495000, 'Dankuni', 'WB'], [1495000, 1530000, 'Kolkata', 'WB'],
  ],
  india: [
    [0, 4000, 'Andheri', 'MH'], [4000, 12000, 'Goregaon', 'MH'],
    [12000, 20000, 'Malad', 'MH'], [20000, 27000, 'Borivali', 'MH'],
    [27000, 32000, 'Chembur', 'MH'],
    [32000, 42000, 'Navi Mumbai', 'MH'], [42000, 58000, 'Khopoli Ghats', 'MH'],
    [58000, 72000, 'Lonavala Ghats', 'MH'], [72000, 82000, 'Khandala Ghats', 'MH'],
    [82000, 87000, 'Talegaon', 'MH'], [87000, 92500, 'Pimpri-Chinchwad', 'MH'],
    [92500, 97000, 'Pune', 'MH'],
  ],
  andheri: [
    [0, 8000, 'Andheri', 'MH'], [8000, 16000, 'Jogeshwari', 'MH'],
    [16000, 20800, 'Andheri', 'MH'], [20800, 24000, 'CSMIA Airport', 'MH'],
    [24000, 28000, 'Bandra', 'MH'], [28000, 33000, 'Worli', 'MH'],
    [33000, 44000, 'Marine Drive', 'MH'], [44000, 52000, 'Nariman Point', 'MH'],
  ],
  i80: [
    [0, 4000, 'Fort Lee', 'NJ'], [4000, 12000, 'Paterson', 'NJ'],
    [12000, 24000, 'Parsippany', 'NJ'], [24000, 38000, 'Delaware Water Gap', 'NJ'],
    [38000, 58000, 'Stroudsburg', 'PA'], [58000, 80000, 'Poconos', 'PA'],
    [80000, 96000, 'Hazleton', 'PA'], [96000, 112000, 'Bloomsburg', 'PA'],
    [112000, 134000, 'Clearfield', 'PA'], [134000, 146000, 'Brookville', 'PA'],
    [146000, 164000, 'Youngstown', 'OH'], [164000, 182000, 'Cleveland', 'OH'],
    [182000, 204000, 'Toledo', 'OH'], [204000, 222000, 'Elkhart', 'IN'],
    [222000, 242000, 'Gary', 'IN'], [242000, 252000, 'Chicago Southland', 'IL'],
    [252000, 261000, 'Joliet Approach', 'IL'],
  ],
  tx45: [
    [0, 18000, 'Downtown Dallas', 'TX'], [18000, 52000, 'Lancaster', 'TX'],
    [52000, 128000, 'Corsicana', 'TX'], [128000, 205000, 'Palestine', 'TX'],
    [205000, 286000, 'Huntsville', 'TX'], [286000, 342000, 'The Woodlands', 'TX'],
    [342000, 388000, 'Downtown Houston', 'TX'],
  ],
  flturnpike: [
    [0, 38000, 'Miami', 'FL'], [38000, 105000, 'Broward', 'FL'],
    [105000, 205000, 'Treasure Coast', 'FL'], [205000, 285000, 'Palm Beach', 'FL'],
    [285000, 388000, 'Lake Okeechobee', 'FL'], [388000, 515000, 'Orlando', 'FL'],
    [515000, 650000, 'Ocala', 'FL'], [650000, 774000, 'Wildwood', 'FL'],
  ],
  bay: [
    [0, 6000, 'San Francisco', 'CA'], [6000, 12000, 'Bay Bridge', 'CA'],
    [12000, 20000, 'Oakland', 'CA'], [20000, 27000, 'Oakland Hills', 'CA'],
    [27000, 33000, 'Castro Valley', 'CA'], [33000, 41000, 'Dublin', 'CA'],
    [41000, 48000, 'San Ramon', 'CA'], [48000, 55000, 'Walnut Creek', 'CA'],
    [55000, 61000, 'Concord', 'CA'], [61000, 68000, 'Fairfield', 'CA'],
    [68000, 75000, 'Vallejo', 'CA'], [75000, 82000, 'Richmond', 'CA'],
    [82000, 88000, 'Berkeley', 'CA'], [88000, 98000, 'Emeryville', 'CA'],
  ],
  cal5: [
    [0, 72000, 'Los Angeles', 'CA'], [72000, 101000, 'Santa Clarita', 'CA'],
    [101000, 154000, 'Tejon Pass', 'CA'], [154000, 205000, 'Bakersfield', 'CA'],
    [205000, 390000, 'Central Valley', 'CA'], [390000, 477000, 'Pacheco Pass', 'CA'],
    [477000, 560000, 'Silicon Valley', 'CA'], [560000, 615000, 'San Francisco', 'CA'],
  ],
  gsp: [
    [0, 5000, 'Cape May', 'NJ'], [5000, 15000, 'Wildwood', 'NJ'],
    [15000, 24000, 'Cape May Court House', 'NJ'], [24000, 34000, 'Sea Isle City', 'NJ'],
    [34000, 45000, 'Ocean City', 'NJ'], [45000, 56000, 'Somers Point', 'NJ'],
    [56000, 66000, 'Absecon', 'NJ'], [66000, 80000, 'Port Republic', 'NJ'],
    [80000, 96000, 'Bass River · Pine Barrens', 'NJ'], [96000, 112000, 'Barnegat', 'NJ'],
    [112000, 126000, 'Forked River', 'NJ'], [126000, 138000, 'Toms River', 'NJ'],
    [138000, 150000, 'Brick', 'NJ'], [150000, 162000, 'Wall Twp', 'NJ'],
    [162000, 170000, 'Asbury Park', 'NJ'], [170000, 180000, 'Red Bank', 'NJ'],
    [180000, 190000, 'Holmdel', 'NJ'], [190000, 199000, 'Matawan', 'NJ'],
    [199000, 206000, 'Sayreville', 'NJ'],
    [206000, 211000, 'Woodbridge', 'NJ'], [211000, 223000, 'Rahway', 'NJ'],
    [223000, 229000, 'Union', 'NJ'], [229000, 237000, 'Newark', 'NJ'],
    [237000, 241000, 'Irvington', 'NJ'], [241000, 249000, 'Bloomfield', 'NJ'],
    [249000, 253000, 'Clifton', 'NJ'], [253000, 261000, 'Paterson', 'NJ'],
    [261000, 269000, 'Paramus', 'NJ'], [269000, 275000, 'Montvale', 'NJ'],
    [275000, 279000, 'NY State Line', 'NY'],
  ],
  acx: [
    [0, 6000, 'Philadelphia', 'PA'], [6000, 7900, 'South Philadelphia', 'PA'],
    [7900, 13500, 'Gloucester City', 'NJ'], [13500, 19000, 'Bellmawr', 'NJ'],
    [19000, 24800, 'Turnersville', 'NJ'], [24800, 34000, 'Sicklerville', 'NJ'],
    [34000, 43000, 'Williamstown', 'NJ'], [43000, 47000, 'Winslow', 'NJ'],
    [47000, 56000, 'Hammonton', 'NJ'], [56000, 66000, 'Mullica · Pines', 'NJ'],
    [66000, 78000, 'Egg Harbor City', 'NJ'], [78000, 86500, 'Mays Landing', 'NJ'],
    [86500, 93000, 'Pleasantville', 'NJ'], [93000, 96000, 'Atlantic City', 'NJ'],
  ],
  nyc: [
    [0, 3000, 'GW Bridge', 'NY'], [3000, 8000, 'Washington Heights', 'NY'],
    [8000, 12500, 'Harlem', 'NY'], [12500, 19000, 'Upper East Side', 'NY'],
    [19000, 24000, 'Midtown Manhattan', 'NY'], [24000, 26000, 'Midtown Tunnel', 'NY'],
    [26000, 30000, 'Long Island City', 'NY'], [30000, 35000, 'Woodside', 'NY'],
    [35000, 39000, 'Corona', 'NY'], [39000, 43000, 'Flushing', 'NY'],
    [43000, 46500, 'New Hyde Park', 'NY'], [46500, 50000, 'Westbury', 'NY'],
    [50000, 52500, 'Jericho', 'NY'], [52500, 60000, 'Long Island', 'NY'],
  ],
  newengland: [
    [0, 4000, 'New Haven', 'CT'], [4000, 11000, 'Meriden', 'CT'],
    [11000, 16000, 'Wethersfield', 'CT'], [16000, 23000, 'Hartford', 'CT'],
    [23000, 30000, 'Manchester', 'CT'], [30000, 34000, 'Tolland', 'CT'],
    [34000, 42000, 'Sturbridge', 'MA'], [42000, 47000, 'Worcester', 'MA'],
    [47000, 53000, 'Framingham', 'MA'], [53000, 61000, 'Boston', 'MA'],
    [61000, 66000, 'East Boston', 'MA'],
  ],
  a1: [
    [0, 15000, 'Lisboa', 'LIS'], [15000, 30000, 'Vila Franca de Xira', 'LIS'],
    [30000, 60000, 'Carregado · Lezíria', 'STR'], [60000, 85000, 'Santarém', 'STR'],
    [85000, 120000, 'Fátima', 'STR'], [120000, 148000, 'Leiria', 'LEI'],
    [148000, 168000, 'Pombal', 'LEI'], [168000, 205000, 'Coimbra', 'CBR'],
    [205000, 228000, 'Mealhada', 'AVR'], [228000, 262000, 'Aveiro', 'AVR'],
    [262000, 288000, 'Vila Nova de Gaia', 'PRT'], [288000, 299000, 'Porto', 'PRT'],
  ],
  a4: [
    [0, 12000, 'Madrid', 'MAD'], [12000, 30000, 'Getafe', 'MAD'],
    [30000, 45000, 'Aranjuez', 'MAD'], [45000, 100000, 'Ocaña', 'CLM'],
    [100000, 130000, 'Puerto Lápice', 'CLM'], [130000, 165000, 'Manzanares', 'CLM'],
    [165000, 210000, 'Valdepeñas', 'CLM'], [210000, 245000, 'Despeñaperros', 'CLM'],
    [245000, 270000, 'La Carolina', 'AND'], [270000, 285000, 'Bailén', 'AND'],
    [285000, 345000, 'Andújar', 'AND'], [345000, 375000, 'Montoro · El Carpio', 'AND'],
    [375000, 425000, 'Córdoba', 'AND'], [425000, 470000, 'Écija', 'AND'],
    [470000, 510000, 'Carmona', 'AND'], [510000, 529000, 'Sevilla', 'AND'],
  ],
  a3: [
    [0, 10000, 'Frankfurt am Main', 'HE'], [10000, 25000, 'Main-Taunus', 'HE'],
    [25000, 48000, 'Idstein', 'HE'], [48000, 62000, 'Limburg an der Lahn', 'HE'],
    [62000, 84000, 'Montabaur', 'RP'], [84000, 114000, 'Dierdorf · Westerwald', 'RP'],
    [114000, 127000, 'Bad Honnef', 'RP'], [127000, 134000, 'Siebengebirge', 'NW'],
    [134000, 145000, 'Siegburg · Bonn', 'NW'], [145000, 160000, 'Lohmar', 'NW'],
    [160000, 175000, 'Köln', 'NW'],
  ],
  m1: [
    [0, 15000, 'Birmingham', 'WM'], [15000, 32000, 'Coventry', 'WM'],
    [32000, 50000, 'Rugby', 'WAR'], [50000, 90000, 'Northampton', 'NTH'],
    [90000, 128000, 'Milton Keynes', 'BKM'], [128000, 145000, 'Luton', 'BED'],
    [145000, 155000, 'Watford', 'HRT'], [155000, 165000, 'Barnet', 'LDN'],
    [165000, 182000, 'Camden · Westminster', 'LDN'], [182000, 195000, 'City · Tower Hamlets', 'LDN'],
    [195000, 212000, 'Greenwich', 'LDN'], [212000, 232000, 'Sevenoaks', 'KEN'],
    [232000, 256000, 'Maidstone', 'KEN'], [256000, 285000, 'Kent Downs', 'KEN'],
    [285000, 305000, 'Ashford', 'KEN'], [305000, 320000, 'Folkestone · Dover', 'KEN'],
  ],
  a16: [
    [0, 15000, 'Calais', 'HDF'], [15000, 45000, 'Boulogne-sur-Mer', 'HDF'],
    [45000, 85000, "Montreuil · Côte d'Opale", 'HDF'], [85000, 115000, 'Abbeville', 'HDF'],
    [115000, 155000, 'Amiens', 'HDF'], [155000, 200000, 'Plateau Picard', 'HDF'],
    [200000, 235000, 'Beauvais', 'HDF'], [235000, 255000, 'Méru · Chambly', 'HDF'],
    [255000, 268000, "L'Isle-Adam", 'IDF'], [268000, 278000, 'Saint-Denis', 'IDF'],
    [278000, 290000, 'Paris', 'IDF'],
  ],
  a1it: [
    [0, 15000, 'Roma', 'LAZ'], [15000, 35000, 'Valmontone', 'LAZ'],
    [35000, 55000, 'Colleferro · Anagni', 'LAZ'], [55000, 85000, 'Frosinone', 'LAZ'],
    [85000, 110000, 'Ceprano', 'LAZ'], [110000, 138000, 'Cassino', 'LAZ'],
    [138000, 162000, 'San Vittore', 'CAM'], [162000, 182000, 'Caianello', 'CAM'],
    [182000, 205000, 'Caserta', 'CAM'], [205000, 225000, 'Napoli', 'CAM'],
  ],
  swiss: [
    [0, 30000, 'Interlaken', 'BE'], [30000, 60000, 'Brünig', 'OW'],
    [60000, 95000, 'Luzern', 'LU'], [95000, 120000, 'Zug', 'ZG'],
    [120000, 162000, 'Zürich', 'ZH'], [162000, 210000, 'Aarau', 'AG'],
    [210000, 252000, 'Bern', 'BE'], [252000, 292000, 'Fribourg', 'FR'],
    [292000, 348000, 'Lausanne', 'VD'], [348000, 410000, 'Genève', 'GE'],
  ],
  us1: [
    [0, 2500, 'Trenton', 'NJ'], [2500, 6000, 'Lawrence Township', 'NJ'],
    [6000, 11000, 'Princeton', 'NJ'], [11000, 16000, 'North Brunswick', 'NJ'],
    [16000, 20000, 'New Brunswick', 'NJ'], [20000, 25000, 'Edison', 'NJ'],
    [25000, 29000, 'Iselin', 'NJ'], [29000, 33000, 'Woodbridge', 'NJ'],
    [33000, 38000, 'Linden', 'NJ'], [38000, 42000, 'Elizabeth', 'NJ'],
    [42000, 45000, 'Newark', 'NJ'], [45000, 48000, 'Kearny · Meadowlands', 'NJ'],
    [48000, 56000, 'Jersey City', 'NJ'],
  ],
}[MAP] || [];
function cityAt(s) {
  for (const [a, b, city, st] of CITY_BANDS) if (s >= a && s < b) return `${city}, ${st}`;
  return CITY_BANDS.length ? `${CITY_BANDS[0][2]}, ${CITY_BANDS[0][3]}` : '';
}

// Full state name + welcome-sign tagline + sign colour, keyed by the ST code
// used in CITY_BANDS. Drives both the persistent bottom banner and the
// physical "WELCOME TO" boards auto-placed at every state line.
const STATE_INFO = {
  MH: { name: 'Maharashtra', tag: 'NH 48 · WESTERN INDIA', bg: '#1d5d9a' },
  KA: { name: 'Karnataka', tag: 'NH 48 · SOUTHERN INDIA', bg: '#c33b2c' },
  CT: { name: 'Connecticut',    tag: 'Constitution State',    bg: '#0b5c8a' },
  NY: { name: 'New York',       tag: 'The Empire State',      bg: '#12264a' },
  NJ: { name: 'New Jersey',     tag: 'Garden State',          bg: '#046a38' },
  PA: { name: 'Pennsylvania',   tag: 'Pursue Your Happiness', bg: '#0b4d6b' },
  DE: { name: 'Delaware',       tag: 'The First State',       bg: '#0b6b52' },
  MA: { name: 'Massachusetts',  tag: 'The Bay State',         bg: '#123a7a' },
  RI: { name: 'Rhode Island',   tag: 'The Ocean State',       bg: '#0b5c8a' },
  IL: { name: 'Illinois',       tag: 'Land of Lincoln',       bg: '#0b4d6b' },
  IN: { name: 'Indiana',        tag: 'Crossroads of America', bg: '#094a2c' },
  OH: { name: 'Ohio',           tag: 'The Buckeye State',      bg: '#7a1020' },
  CA: { name: 'California',     tag: 'The Golden State',       bg: '#0b6b3a' },
  TX: { name: 'Texas',          tag: 'The Lone Star State',    bg: '#125b91' },
  FL: { name: 'Florida',        tag: 'The Sunshine State',     bg: '#126d9a' },
  MD: { name: 'Maryland',       tag: 'The Old Line State',     bg: '#7a1020' },
  VA: { name: 'Virginia',       tag: 'The Old Dominion',       bg: '#0b4d6b' },
  NC: { name: 'North Carolina', tag: 'The Tar Heel State',     bg: '#123a7a' },
  SC: { name: 'South Carolina', tag: 'The Palmetto State',     bg: '#0b6b3a' },
  GA: { name: 'Georgia',         tag: 'The Peach State',        bg: '#b85b2a' },
  DL: { name: 'Delhi',          tag: 'राष्ट्रीय राजधानी क्षेत्र · NCT', bg: '#7a1020' },
  HR: { name: 'Haryana',        tag: 'हरियाणा सरकार',            bg: '#0b5c37' },
  UP: { name: 'Uttar Pradesh',  tag: 'उत्तर प्रदेश सरकार',        bg: '#7a3410' },
  BR: { name: 'Bihar',           tag: 'बिहार सरकार · BIHAR',         bg: '#8b4a20' },
  JH: { name: 'Jharkhand',       tag: 'झारखंड · JHARKHAND',          bg: '#356b3b' },
  WB: { name: 'West Bengal',     tag: 'পশ্চিমবঙ্গ · WEST BENGAL',    bg: '#1b5d8e' },
  // Portugal districts (A1)
  LIS: { name: 'Distrito de Lisboa',   tag: 'Portugal', bg: '#0b6b3a' },
  STR: { name: 'Distrito de Santarém', tag: 'Portugal', bg: '#0b6b3a' },
  LEI: { name: 'Distrito de Leiria',   tag: 'Portugal', bg: '#0b6b3a' },
  CBR: { name: 'Distrito de Coimbra',  tag: 'Portugal', bg: '#0b6b3a' },
  AVR: { name: 'Distrito de Aveiro',   tag: 'Portugal', bg: '#0b6b3a' },
  PRT: { name: 'Distrito do Porto',    tag: 'Portugal', bg: '#0b6b3a' },
  // Spain autonomous communities (A-4)
  MAD: { name: 'Comunidad de Madrid', tag: 'España',             bg: '#b3202c' },
  CLM: { name: 'Castilla-La Mancha',  tag: 'Tierra del Quijote', bg: '#7a1020' },
  AND: { name: 'Andalucía',           tag: 'España',             bg: '#0b6b3a' },
  // German Länder (A3)
  HE: { name: 'Hessen',              tag: 'Bundesrepublik Deutschland', bg: '#0b4d6b' },
  RP: { name: 'Rheinland-Pfalz',     tag: 'Bundesrepublik Deutschland', bg: '#0b5c8a' },
  NW: { name: 'Nordrhein-Westfalen', tag: 'Bundesrepublik Deutschland', bg: '#046a38' },
  // English counties (M6/M1/M20)
  WM:  { name: 'West Midlands',    tag: 'England', bg: '#0b4d6b' },
  WAR: { name: 'Warwickshire',     tag: 'England', bg: '#0b6b52' },
  NTH: { name: 'Northamptonshire', tag: 'England', bg: '#7a1020' },
  BKM: { name: 'Buckinghamshire',  tag: 'England', bg: '#0b5c8a' },
  BED: { name: 'Bedfordshire',     tag: 'England', bg: '#0b6b3a' },
  HRT: { name: 'Hertfordshire',    tag: 'England', bg: '#0b4d6b' },
  LDN: { name: 'Greater London',   tag: 'England', bg: '#b3202c' },
  KEN: { name: 'Kent',             tag: 'The Garden of England', bg: '#046a38' },
  // French régions (A16)
  HDF: { name: 'Hauts-de-France', tag: 'République Française', bg: '#0b4d6b' },
  IDF: { name: 'Île-de-France',   tag: 'République Française', bg: '#12264a' },
  // Italian regioni (A1)
  LAZ: { name: 'Lazio',    tag: 'Italia', bg: '#7a1020' },
  CAM: { name: 'Campania', tag: 'Italia', bg: '#0b5c8a' },
  // Swiss cantons (Interlaken → Genève). Confédération — four languages; the
  // welcome boards read in the language of the canton you're entering.
  BE: { name: 'Bern · Berne',        tag: 'Schweiz · Suisse · Svizzera', bg: '#c8102e' },
  OW: { name: 'Obwalden',            tag: 'Schweiz · Confoederatio Helvetica', bg: '#c8102e' },
  LU: { name: 'Luzern',              tag: 'Schweiz · Confoederatio Helvetica', bg: '#c8102e' },
  ZG: { name: 'Zug',                 tag: 'Schweiz · Confoederatio Helvetica', bg: '#c8102e' },
  ZH: { name: 'Zürich',              tag: 'Schweiz · Confoederatio Helvetica', bg: '#c8102e' },
  AG: { name: 'Aargau',              tag: 'Schweiz · Confoederatio Helvetica', bg: '#c8102e' },
  FR: { name: 'Fribourg · Freiburg', tag: 'Suisse · Schweiz · Röstigraben', bg: '#0b5c8a' },
  VD: { name: 'Vaud',                tag: 'Suisse · Confédération helvétique', bg: '#0a7a3f' },
  GE: { name: 'Genève',              tag: 'Suisse · Confédération helvétique', bg: '#b3202c' },
};
// ST code at position s (from CITY_BANDS).
function stateCodeAt(s) {
  for (const [a, b, , st] of CITY_BANDS) if (s >= a && s < b) return st;
  return CITY_BANDS.length ? CITY_BANDS[0][3] : '';
}
// State-line crossings for THIS map: every s where the ST code flips between
// consecutive bands. Each border yields a WELCOME sign in each direction — the
// with-traffic shoulder greets the state you're entering, the opposite shoulder
// the one behind you — so a sign faces you on both sides of the highway.
function stateBorders() {
  const out = [];
  for (let i = 1; i < CITY_BANDS.length; i++) {
    const prev = CITY_BANDS[i - 1][3], next = CITY_BANDS[i][3];
    if (prev !== next) out.push({ s: CITY_BANDS[i][0], prev, next });
  }
  return out;
}
function placeStateLineSigns() {
  for (const { s, prev, next } of stateBorders()) {
    const fwd = STATE_INFO[next], back = STATE_INFO[prev];
    // Europe doesn't say "WELCOME TO" — the boundary board just names the
    // district / comunidad / Land you're entering
    const lines = i => (EURO || UK)
      ? [i.name.toUpperCase(), (i.tag || '').toUpperCase()]
      : ['WELCOME TO', i.name.toUpperCase(), (i.tag || '').toUpperCase()];
    if (fwd) welcomeSign(scene, registry, s, 1,  lines(fwd), fwd.bg);
    if (back) welcomeSign(scene, registry, s, -1, lines(back), back.bg);
  }
}
// Maps that hand-place their own richer, governor-named, crossing-aligned
// state-line boards would be doubled up by the generic auto-placer, so skip them
// there (each covers all of its own borders manually).
const MANUAL_STATE_SIGN_MAPS = new Set(['i95', 'gsp', 'newengland', 'midwest']);
if (!MANUAL_STATE_SIGN_MAPS.has(MAP)) placeStateLineSigns();  // road geometry is already built by this point

// Regional climate by zone: [typical summer afternoon high °F, winter high °F].
// The Appalachians and New England run cooler; the coast and India run warm and
// humid; the Midwest gets hot summers and cold winters.
const CLIMATE = {
  dk_delhi: [105, 70], dk_ghaziabad: [105, 69], dk_aligarh: [104, 67], dk_etawah: [104, 66],
  dk_kanpur: [103, 65], dk_fatehpur: [102, 64], dk_prayagraj: [101, 63], dk_mirzapur: [100, 62],
  dk_varanasi: [100, 62], dk_chandauli: [99, 61], dk_mohania: [98, 60], dk_sasaram: [98, 59],
  dk_aurangabad: [98, 59], dk_gaya: [97, 58], dk_barhi: [92, 54], dk_hazaribagh: [91, 53],
  dk_dhanbad: [94, 57], dk_asansol: [95, 61], dk_durgapur: [94, 62], dk_bardhaman: [93, 64],
  dk_dankuni: [92, 66], dk_kolkata: [91, 70],
  nh48_mumbai: [89, 78], nh48_panvel: [89, 77], nh48_ghat: [82, 66], nh48_pune: [90, 63],
  nh48_satara: [88, 61], nh48_karad: [89, 64], nh48_kolhapur: [88, 65], nh48_border: [89, 63],
  nh48_belagavi: [89, 62], nh48_hubballi: [91, 64], nh48_haveri: [92, 64], nh48_davanagere: [92, 63],
  nh48_tumakuru: [88, 62], nh48_bengaluru: [84, 61],
  // i95 Northeast Corridor
  newhaven: [82, 36], corridor: [80, 35], westchester: [84, 36], bronx: [86, 38],
  suburb: [86, 39], njsouth: [87, 40], philly: [88, 41], pa: [85, 37],
  boston95: [81, 34], providence: [82, 34], ctshore: [81, 34],
  // DE → FL true-scale run: climate warms steadily southbound, winters go
  // from cold to essentially frost-free by south Florida
  de_newark: [86, 38], de_wilmington: [86, 39],
  md_perryville: [87, 38], md_harford: [87, 39], md_baltimore: [88, 40],
  md_laurel: [88, 41], md_beltway: [88, 41],
  va_springfield: [89, 42], va_fredvburg: [89, 43], va_ashland: [90, 44],
  va_richmond: [90, 44], va_petersburg: [91, 45], va_southside: [91, 46],
  nc_roanokerap: [91, 47], nc_rockymount: [91, 48], nc_fayetteville: [92, 49],
  nc_lumberton: [92, 50],
  sc_dillon: [93, 51], sc_florence: [93, 52], sc_santee: [93, 53], sc_walterboro: [93, 54],
  ga_midway: [92, 55], ga_savannah: [92, 56], ga_kingsland: [91, 58],
  fl_jax: [91, 60], fl_daytona: [90, 63], fl_melbourne: [90, 66],
  fl_stlucie: [90, 69], fl_wpb: [89, 71], fl_ftlaud: [89, 73], fl_miami: [89, 74],
  tx_dallas: [96, 57], tx_lancaster: [97, 57], tx_corsicana: [96, 55],
  tx_palestine: [95, 54], tx_huntsville: [94, 54], tx_woodlands: [94, 57], tx_houston: [95, 60],
  fltp_miami: [89, 74], fltp_broward: [89, 73], fltp_treasure: [90, 69], fltp_palm: [89, 71],
  fltp_lake: [92, 64], fltp_orlando: [92, 61], fltp_ocala: [92, 57], fltp_wildwood: [91, 55],
  // i287
  perthamboy: [86, 38], piscataway: [85, 37], bridgewater: [85, 36], morristown: [84, 35], ramapo: [83, 34],
  rockland: [83, 33], tappanzee: [83, 33], westch: [84, 34], yonkers: [85, 35], nybronx: [86, 37], gwb287: [86, 38],
  gsp_i95: [86, 38], gsp_rahway: [86, 38], gsp_union: [86, 37], gsp_essex: [86, 37], gsp_clifton: [85, 36],
  gsp_paterson: [85, 36], gsp_north: [83, 34], gsp_ny: [83, 34],
  philly76: [88, 41], wwb: [87, 41], gloucester: [87, 41], nj42: [87, 40],
  acx_west: [87, 40], acx_pines: [88, 39], acx_egg: [86, 41], acx_ac: [84, 42],
  gsp_capemay: [83, 43], gsp_seashore: [84, 42], gsp_atlantic: [85, 41], gsp_pines: [87, 39],
  gsp_ocean: [85, 40], gsp_lakewood: [85, 39], gsp_monmouth: [85, 39], gsp_raritan: [86, 39],
  // NYC + Long Island: humid continental — hot muggy summers, cold winters
  gwb: [85, 40], washheights: [85, 40], harlem: [86, 40], ues: [85, 40], midtown: [86, 41],
  tunnel: [85, 41], lic: [85, 40], woodside: [85, 40], corona: [85, 39], flushing: [85, 39],
  newhydepark: [84, 39], mineola: [84, 39], jericho: [84, 38], li_return: [83, 38],
  // Bay Area: Mediterranean — cool coastal SF, hot inland valleys, mild winters
  sf: [68, 58], baybridge: [66, 56], oakland: [72, 58], i580: [82, 60], dublin: [88, 60],
  i680: [88, 60], vallejo: [84, 58], richmond: [72, 57], eastbay: [72, 58],
  cal5_la: [84, 54], cal5_santaclarita: [88, 52], cal5_tejon: [86, 48],
  cal5_bakersfield: [98, 45], cal5_valley: [96, 44], cal5_pacheco: [88, 48],
  cal5_silicon: [82, 52], cal5_sf: [70, 56],
  // midwest
  ord: [84, 31], i90ken: [84, 31], chidt: [84, 31], danryan: [84, 31], skyway: [83, 32],
  i294: [84, 31], southland: [84, 31], borman: [83, 32],
  i80: [83, 32], gary: [84, 32], i65: [86, 34], indy: [86, 35], i74: [86, 36],
  hills: [85, 36], cincy: [87, 38], downtown: [87, 38],
  millcreek: [87, 38], sharonville: [86, 37], wchester75: [86, 36],
  middletown: [86, 36], franklin75: [86, 35], moraine: [85, 36], dayton: [85, 35],
  // New England branch
  i91: [82, 34], hartford: [84, 34], i84: [82, 32], masspike: [82, 31], boston: [81, 34], logan: [80, 34],
  // I-80 (GWB → Chicago)
  fortlee: [86, 38], njsub80: [85, 37], njgap: [82, 33], poconos: [80, 29], paridge: [80, 28],
  paplat: [79, 27], ohio80: [83, 32], cleveland: [82, 32], toledo: [85, 33], inturnpike: [85, 33], chi80: [84, 32],
  // India (tropical: mild winters, hot humid summers/monsoon)
  mumbai: [90, 82], chembur: [91, 83], puneX: [82, 66], pcmc: [91, 73], pune: [91, 71],
  // Delhi NCR: hotter than Mumbai in June, cold foggy Decembers
  d_gurgaon: [105, 70], d_nh48: [105, 70], d_igi: [105, 69], d_dhaula: [104, 69],
  d_lutyens: [104, 68], d_cp: [104, 68], d_ito: [104, 68], d_yamuna: [103, 67],
  d_noida: [104, 68], d_ring: [104, 69], d_pbagh: [104, 69], d_bgarh: [105, 68],
  d_sampla: [106, 67], d_rohtak: [106, 67],
  andheriW: [91, 82], airport: [91, 82], bandra: [90, 82], sealink: [89, 82], marine: [89, 82],
  // US-1 NJ: humid mid-Atlantic — hot muggy summers, cold winters
  // Portugal A1: Atlantic — mild wet winters, warm dry summers, cooler + damper
  // toward Porto
  pt_lisboa: [84, 59], pt_vfx: [86, 58], pt_ribatejo: [89, 57], pt_santarem: [90, 57],
  pt_fatima: [84, 53], pt_leiria: [82, 55], pt_pombal: [84, 55], pt_coimbra: [87, 56],
  pt_bairrada: [82, 55], pt_aveiro: [78, 56], pt_gaia: [77, 55], pt_porto: [77, 54],
  // Spain A-4: continental meseta (hot days, cold winters) sliding into the
  // furnace of the Guadalquivir valley — Écija/Córdoba are the hottest in Europe
  es_madrid: [92, 52], es_sur: [93, 51], es_aranjuez: [93, 50], es_ocana: [92, 48],
  es_mancha: [93, 47], es_valdepenas: [93, 47], es_despena: [88, 46], es_bailen: [96, 53],
  es_andujar: [99, 55], es_cordoba: [101, 56], es_ecija: [102, 57], es_carmona: [98, 58],
  es_sevilla: [97, 60],
  // Germany A3: cool temperate — mild summers, gray chilly winters, the
  // Westerwald noticeably rawer than the Rhine plain
  de_ffm: [78, 40], de_wiesbaden: [77, 39], de_taunus: [73, 36], de_limburg: [75, 37],
  de_montabaur: [71, 34], de_westerwald: [70, 33], de_siebengebirge: [74, 37],
  de_bonn: [77, 40], de_lohmar: [75, 38], de_koeln: [77, 40],
  // Britain: mild, grey, damp — a good summer day is 22°C
  uk_bham: [70, 44], uk_m6: [70, 43], uk_m1n: [71, 43], uk_mk: [71, 43], uk_luton: [71, 43],
  uk_nlondon: [73, 46], uk_london: [74, 46], uk_slondon: [73, 46],
  uk_m20w: [72, 45], uk_kent: [71, 45], uk_ashford: [71, 45], uk_dover: [68, 45],
  // Northern France: a touch warmer than Kent, Paris warmer still
  fr_calais: [70, 43], fr_boulogne: [69, 44], fr_opale: [70, 43], fr_somme: [72, 42],
  fr_amiens: [73, 42], fr_picardie: [73, 41], fr_beauvais: [74, 42], fr_oise: [75, 42],
  fr_stdenis: [77, 44], fr_paris: [77, 44],
  // Italy: hot Mediterranean summers down the Valle Latina, mild winters
  it_roma: [89, 55], it_castelli: [88, 52], it_colleferro: [90, 51],
  it_frosinone: [91, 50], it_ceprano: [92, 50], it_cassino: [90, 50],
  it_sanvittore: [88, 48], it_caianello: [91, 51], it_caserta: [91, 54],
  it_napoli: [88, 56],
  // Switzerland: cool temperate, colder and snowier the higher you climb —
  // raw on the Brünig, milder down on the Léman at Genève
  ch_interlaken: [75, 38], ch_brunig: [67, 31], ch_luzern: [77, 40],
  ch_zug: [77, 40], ch_zurich: [78, 41], ch_aargau: [79, 41],
  ch_bern: [77, 40], ch_fribourg: [76, 39], ch_lausanne: [79, 42],
  ch_geneve: [81, 43],
  trenton: [87, 40], lawrence: [86, 39], princeton: [86, 39], nbrunswick: [86, 39],
  newbrunswick: [86, 39], edison: [86, 39], iselin: [86, 39], woodbridge: [86, 39],
  linden: [87, 39], elizabeth: [87, 40], newark1: [87, 40], pulaski: [86, 39],
  jerseycity: [86, 40], us1_return: [86, 39],
};
const HUMID_ZONES = new Set([
  'dk_prayagraj', 'dk_mirzapur', 'dk_varanasi', 'dk_chandauli', 'dk_mohania', 'dk_sasaram',
  'dk_aurangabad', 'dk_gaya', 'dk_dhanbad', 'dk_asansol', 'dk_durgapur', 'dk_bardhaman',
  'dk_dankuni', 'dk_kolkata',
  'mumbai', 'chembur', 'andheriW', 'airport', 'bandra', 'sealink', 'marine', 'pcmc', 'pune', 'puneX',
  'philly', 'bronx', 'suburb', 'njsouth', 'fortlee', 'njsub80', 'cleveland', 'toledo', 'downtown', 'cincy',
  'gwb', 'washheights', 'harlem', 'ues', 'midtown', 'tunnel', 'lic', 'woodside', 'corona', 'flushing',
  'newhydepark', 'mineola', 'jericho', 'li_return',
  'trenton', 'lawrence', 'princeton', 'nbrunswick', 'newbrunswick', 'edison', 'iselin',
  'woodbridge', 'linden', 'elizabeth', 'newark1', 'pulaski', 'jerseycity', 'us1_return',
  'tx_dallas', 'tx_lancaster', 'tx_corsicana', 'tx_palestine', 'tx_huntsville', 'tx_woodlands', 'tx_houston',
  'fltp_miami', 'fltp_broward', 'fltp_treasure', 'fltp_palm', 'fltp_lake', 'fltp_orlando', 'fltp_ocala', 'fltp_wildwood',
]);

// Live local weather readout: temperature (°F) + conditions, driven by the
// selected season, the region/city, the current weather, and the time of day.
function weatherReadout(zoneKey, effWeather, nightFactor) {
  const c = CLIMATE[zoneKey] || [84, 38];
  const northWarmth = 0.5 + 0.5 * Math.cos((month - 6) * Math.PI * 2 / 12);
  const indiaWarmth = [0.42, 0.55, 0.72, 0.9, 1, 0.88, 0.78, 0.76, 0.78, 0.75, 0.58, 0.44][month];
  const warmth = INDIAN_MAP ? indiaWarmth : northWarmth;
  const base = c[1] + (c[0] - c[1]) * warmth;
  const range = 11 + 5 * warmth;    // smaller winter, larger warm-season daily swing
  const warm = 0.5 - 0.5 * Math.cos((tod - 0.21) * 2 * Math.PI); // 0 at ~5 AM, 1 at ~5 PM
  let t = (base - range) + range * warm;
  const day = nightFactor < 0.5;
  let label, icon;
  if (effWeather === 'monsoon') {
    t -= 6;
    if (weather === 'rainlight') { label = 'Light Rain · फुहार'; icon = '🌦'; }
    else if (weather === 'rainheavy') { label = burst.active ? 'Heavy Rain · मूसलाधार' : 'Heavy Rain'; icon = '⛈'; }
    else if (weather === 'rainfront' && rainFrontK > 0.6) {
      label = rainFrontStyle === 'hurricane' ? 'Cyclone · चक्रवात' : 'Severe Storm · आंधी';
      icon = '🌀'; t -= 3;
    }
    else { label = burst.active ? 'Heavy Monsoon' : 'Monsoon Rain'; icon = burst.active ? '⛈' : '🌧'; }
  } else if (effWeather === 'rain') {
    if (weather === 'rainfront' && rainFrontK > 0.6) {
      t -= 8;
      label = rainFrontStyle === 'hurricane' ? 'Hurricane'
        : rainFrontStyle === 'tornado' ? 'Tornado Warning' : 'Severe Thunderstorm';
      icon = rainFrontStyle === 'tornado' ? '🌪' : '🌀';
      if (floodPack > 0.45) label += ' · Flooding';
    } else {
      const st = weather === 'storm'; t -= st ? 6 : 4;
      label = st ? 'Thunderstorm' : 'Rain'; icon = st ? '⛈' : '🌧';
    }
  } else if (shower.active) {
    t -= 3; label = shower.thunder ? 'Passing Storm' : 'Passing Shower'; icon = shower.thunder ? '⛈' : '🌦';
  } else if (effWeather === 'overcast') {
    if (precipMode === 'snow') { t = Math.min(t - 8, 33); label = 'Snow'; icon = '🌨'; }
    else { t -= 4; label = 'Overcast'; icon = '☁️'; }
  } else if (effWeather === 'cloudy') {
    t -= 2; label = HUMID_ZONES.has(zoneKey) ? 'Humid · Partly Cloudy' : 'Partly Cloudy'; icon = '⛅';
  } else { // clear
    if (!day) { label = 'Clear'; icon = '🌙'; }
    else {
      t += 2;
      const humid = HUMID_ZONES.has(zoneKey) && season !== 'winter' && t >= 84;
      label = humid ? 'Hot & Humid' : 'Sunny'; icon = '☀️';
    }
  }
  // fog / haze overlay the sky condition (they form independent of cloud cover)
  const dry = effWeather !== 'overcast' && effWeather !== 'rain' && effWeather !== 'monsoon' && !shower.active;
  if (fog.mist > 0.4 && dry) {
    t -= 3; label = fog.mist > 0.62 ? 'Fog' : 'Mist'; icon = '🌫';
  } else if (haze > 0.4 && dry && day) {
    label = INDIAN_MAP ? 'Hazy · Smog' : 'Hazy'; icon = '🌫';
  }
  // Europe (and Britain) reads Celsius
  if (EURO || UK) return `${Math.round((t - 32) * 5 / 9)}°C · ${label} ${icon}`;
  return `${Math.round(t)}°F · ${label} ${icon}`;
}

const INDIAN_MAP = MAP === 'india' || MAP === 'nh48' || MAP === 'andheri' || MAP === 'aundh' || MAP === 'newdelhi' || MAP === 'delhikolkata';
const inIndia = key => key === 'mumbai' || key === 'puneX' || key === 'pune' || key === 'andheriW' || key === 'airport' || key === 'pcmc' || key === 'bandra' || key === 'sealink' || key === 'marine' || key.startsWith('d_') || key.startsWith('p_') || key.startsWith('dk_');

// Dynamic sky: on the passive "clear"/"winter" settings the cloud cover isn't
// static — it drifts over the day the way real weather does. A multi-scale
// signal (broad fronts over a few game-hours + shorter breaks) rolls the sky
// between clear, partly cloudy and overcast; rain then comes from the passing-
// shower system, which is likelier while it's cloudy. Runs on GAME time so the
// time-warp key speeds the weather up too. Explicit buttons still override.
let wxT = Math.random() * 6000;              // random start phase → every run differs
const WX = { ph: [Math.random() * 7, Math.random() * 7, Math.random() * 7, Math.random() * 7], cond: 'clear', cloud: 0.3 };
let summerSunHold = 0;
function updateAutoWeather(dt) {
  wxT += dt * timeScale;
  if (summerSunHold > 0) {
    summerSunHold = Math.max(0, summerSunHold - dt * timeScale);
    WX.cloud += (0.04 - WX.cloud) * Math.min(1, dt * 2);
    WX.cond = 'clear';
    return;
  }
  // Monthly cloud tendency: India peaks in the June-September monsoon; the
  // northern maps are grayer in winter and stormier in spring than midsummer.
  const indiaWet = [0.02, 0.02, 0.03, 0.05, 0.18, 0.9, 1, 1, 0.82, 0.28, 0.06, 0.03][month];
  const northWet = [0.72, 0.68, 0.62, 0.58, 0.5, 0.4, 0.34, 0.36, 0.42, 0.5, 0.62, 0.72][month];
  const bias = INDIAN_MAP ? -0.08 + indiaWet * 0.18 : -0.09 + northWet * 0.2;
  const eastSummer = season === 'summer' && ['i95', 'i80', 'i287', 'gsp', 'acx', 'newengland', 'midwest'].includes(MAP);
  const c = 0.46 + bias + (eastSummer ? 0.39 : 0.34) * Math.sin(wxT / 1875 + WX.ph[0])
    + (eastSummer ? 0.23 : 0.20) * Math.sin(wxT / 620 + WX.ph[1]) + 0.12 * Math.sin(wxT / 210 + WX.ph[2]);
  WX.cloud = Math.min(1, Math.max(0, c));
  // map cloudiness → condition with hysteresis so it doesn't flicker at edges
  let cond = WX.cond;
  if (WX.cloud > 0.66) cond = 'overcast';
  else if (WX.cloud > 0.36) { if (cond !== 'overcast' || WX.cloud < 0.58) cond = 'cloudy'; }
  else if (WX.cloud < 0.28) cond = 'clear';
  else if (cond === 'overcast') cond = 'cloudy';
  WX.cond = cond;
}
// what the sky/lighting actually does, per region:
// India: clear or monsoon; monsoon carries thunderstorm bursts.
// America: rain/storm work any season; summer can be humid-cloudy; winter is
// a gray deck by default but 'sunny' forces the crisp clear-and-dry look.
function effectiveWeather(zoneKey) {
  // a passing shower overlays the sky: light ones just haze it over, heavier
  // ones read as rain (never the near-black storm look)
  if (shower.active) return shower.intensity < 0.45 ? 'cloudy' : 'rain';
  if (inIndia(zoneKey)) {
    if (weather === 'monsoon' || weather === 'rain' || weather === 'storm'
      || weather === 'rainheavy' || weather === 'rainlight') return 'monsoon';
    if (weather === 'rainfront') return rainFrontK > 0.12 ? 'monsoon' : WX.cond;
    if (weather === 'sunny') return 'clear';   // India sun button beats the haze drift
    return WX.cond;                          // clear days still drift cloudy/overcast
  }
  if (weather === 'rain' || weather === 'storm') return 'rain';
  if (weather === 'rainfront') return rainFrontK > 0.12 ? 'rain' : 'cloudy';
  if (weather === 'snow' || weather === 'snowlight' || weather === 'snowfront') return 'overcast'; // gray deck
  if (weather === 'cloudy') return 'cloudy'; // "Humid" holds a partly-cloudy sky
  if (weather === 'sunny') return 'clear';   // winter-sun button forces crisp clear
  // Summer/Winter default: the sky evolves through the day (see updateAutoWeather)
  return WX.cond;
}

// --- summer thunderstorms (I-95 + midwest): random, realistic rate, spiking
// late afternoon. India: the monsoon throws heavier thunderstorm bursts.
let storm = { active: false, t: 0 };
let burst = { active: false, t: 0, next: 40 + Math.random() * 120 }; // monsoon bursts
// automatic passing showers on clear summer days (not a weather button). Some
// places get them more often; some days none at all — random, like real life.
const SHOWER_RATE = {
  i95: 0.95, i287: 0.9, gsp: 0.85, acx: 0.85, newengland: 0.9, i80: 0.85, midwest: 0.95, india: 0.5, nh48: 0.75, andheri: 0.5,
  a1: 0.55, a4: 0.12, a3: 0.95,   // Atlantic PT / bone-dry Andalucía / rainy Rheinland
  m1: 1.15, a16: 0.9,             // it rains in England; Picardie not far behind
  a1it: 0.35,
  swiss: 1.1,                     // Alpine afternoons brew thunderstorms fast
  tx45: 1.05, flturnpike: 1.35, cal5: 0.32,
}[MAP] ?? 0.7;
let shower = { active: false, t: 0, intensity: 0, thunder: false };
let flashT = 0;

// Ground fog / morning mist (all maps): forms on calm, damp nights and builds
// through the pre-dawn hours, thickest just before sunrise, then burns off by
// mid-morning. Heavier in humid regions, river valleys, and on the Indo-
// Gangetic plain; a milder valley haze returns at dusk. A separate afternoon
// HAZE goes milky on hot summer days (smog on the India maps). Both are fully
// automatic — no button — and slew slowly so they roll in and lift naturally.
let fog = { mist: 0 };
let haze = 0;
function updateFog(dt, zoneKey) {
  const h = tod * 24;
  const dawn = h < 6 ? Math.max(0, (h - 2) / 3) : h < 10 ? (10 - h) / 4.5 : 0;
  const dusk = (h > 19.5 && h < 23) ? (h - 19.5) / 5 : 0;
  const diurnal = Math.max(dawn, dusk * 0.55);
  const humidZone = HUMID_ZONES.has(zoneKey) ? 1 : 0.5;
  const damp = 0.35 + 0.65 * WX.cloud;                  // damper air holds more fog
  let target = diurnal * humidZone * damp * (season === 'winter' ? 0.8 : 1);
  if (INDIAN_MAP) target *= 1.2;
  // rain of any kind reads as rain, not fog
  if (weather === 'rain' || weather === 'storm' || weather === 'monsoon' || shower.active) target = 0;
  fog.mist += (target - fog.mist) * Math.min(1, dt * 0.25);

  // afternoon haze: hot, humid, clear-ish summer days go milky; India stays hazy
  const hot = (CLIMATE[zoneKey]?.[0] ?? 84) >= 86;
  const afternoon = h > 11 && h < 19;
  let hz = (INDIAN_MAP ? 0.5 : 0)
    + (season === 'summer' && hot && afternoon && WX.cloud < 0.5 ? 0.5 : 0);
  hz *= (HUMID_ZONES.has(zoneKey) || INDIAN_MAP) ? 1 : 0.35;
  haze += (hz - haze) * Math.min(1, dt * 0.2);
}
function updateStorms(dt) {
  const hour = tod * 24;

  // active shower countdown (all maps)
  if (shower.active) {
    shower.t -= dt;
    if (shower.thunder && Math.random() < dt * 0.25) flashT = 0.08 + Math.random() * 0.1;
    if (shower.t <= 0) { shower.active = false; shower.intensity = 0; shower.thunder = false; }
  }

  if (INDIAN_MAP) {
    if (weather === 'monsoon' || weather === 'rainheavy') {
      // heavy rain, desi style: near-constant bursts, thunder overhead
      const bMin = weather === 'rainheavy' ? 25 : 20;
      const gap = weather === 'rainheavy' ? 25 : 50;
      if (burst.active) {
        burst.t -= dt;
        if (burst.t <= 0) { burst.active = false; burst.next = gap + Math.random() * (weather === 'rainheavy' ? 40 : 140); }
        else if (Math.random() < dt * 0.5) flashT = 0.1 + Math.random() * 0.12;
      } else {
        burst.next -= dt;
        if (burst.next <= 0) { burst.active = true; burst.t = bMin + Math.random() * 45; }
      }
      return; // monsoon dominates
    }
    burst.active = false;
  } else {
    // stray-flash fix: if the storm was switched off manually, kill it now
    if (weather !== 'storm') storm.active = false;
    if (storm.active) {
      storm.t -= dt;
      if (Math.random() < dt * 0.3) flashT = 0.09 + Math.random() * 0.12;
      if (storm.t <= 0) { storm.active = false; weather = 'clear'; markWeatherButtons(); }
      return; // thunderstorm dominates
    }
    // random summer thunderstorm: ~1 every couple game days, biased to 2-8 PM
    if (season === 'summer' && weather === 'clear') {
      const sp = hour > 14 && hour < 20 ? 6 : hour > 11 ? 1.5 : 0.25;
      if (Math.random() < dt * (0.4 / CLOCK_DAY_LENGTH) * sp) {
        storm.active = true;
        storm.t = 60 + Math.random() * 150;
        weather = 'storm';
        markWeatherButtons();
        return;
      }
    }
  }

  // passing showers on clear OR humid days — automatic, some days none. Humid
  // days get them far more often, heavier, and more likely to thunder, at any
  // hour (day or night).
  const eligible = (weather === 'clear' || weather === 'cloudy') && (INDIAN_MAP || season === 'summer');
  if (!shower.active && eligible) {
    const humid = weather === 'cloudy';
    // more likely to rain the cloudier the sky currently is (dynamic weather)
    const sp = (hour > 13 && hour < 19 ? 2 : 1) * (humid ? 2.6 : 1) * (0.35 + WX.cloud * 1.8);
    if (Math.random() < dt * (SHOWER_RATE / CLOCK_DAY_LENGTH) * sp) {
      shower.active = true;
      shower.t = 60 + Math.random() * 100;         // ~4-9 game minutes
      const r = Math.random();                     // drizzle | light | medium | hard
      shower.intensity = humid
        ? (r < 0.2 ? 0.22 : r < 0.45 ? 0.42 : r < 0.78 ? 0.7 : 1.0)
        : (r < 0.35 ? 0.22 : r < 0.65 ? 0.42 : r < 0.87 ? 0.7 : 1.0);
      shower.thunder = shower.intensity >= 0.99 && Math.random() < (humid ? 0.7 : 0.4);
    }
  }
}

// precipitation: a curtain that follows the camera — rain falls as motion-
// streaked lines (like real rain at speed), snow as short drifting flecks
const RAIN_N = 1500;
const drops = [];
for (let i = 0; i < RAIN_N; i++) {
  drops.push({
    x: (Math.random() - 0.5) * 90,
    y: Math.random() * 55,
    z: (Math.random() - 0.5) * 90,
  });
}
const rainPos = new Float32Array(RAIN_N * 6);   // two verts per drop
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({
  color: 0xaebccb, transparent: true, opacity: 0.5, depthWrite: false,
}));
rain.visible = false;
rain.frustumCulled = false;
scene.add(rain);

// ---------------------------------------------------------------------------
// Snow model: dynamic snowpack that builds while it snows and melts after,
// with regional severity (lake-effect Chicago/Cleveland get buried, the
// Jersey shore barely whitens) and squall whiteouts in heavy mode. Snowpack
// whitens the road overlay, cuts everyone's grip, and slows the NPCs.
// ---------------------------------------------------------------------------
const SNOW_SEVERITY = {
  // Chicagoland + lake effect
  ord: 1.5, i90ken: 1.5, chidt: 1.5, danryan: 1.5, skyway: 1.5, i80: 1.4, gary: 1.4,
  chi80: 1.4, inturnpike: 1.3, toledo: 1.3, cleveland: 1.5, ohio80: 1.4,
  // inland Midwest tapering to the Ohio Valley
  i65: 1.1, indy: 1.0, i74: 0.9, hills: 0.9, cincy: 0.8, downtown: 0.8,
  millcreek: 0.8, sharonville: 0.85, wchester75: 0.9, middletown: 0.9,
  franklin75: 0.95, moraine: 0.95, dayton: 1.0,
  // New England runs hard
  boston95: 1.4, providence: 1.3, boston: 1.35, logan: 1.35, masspike: 1.35,
  i84: 1.3, i91: 1.3, hartford: 1.3,
  // I-95 corridor mildening southward
  ctshore: 1.1, newhaven: 1.1, corridor: 1.1, westchester: 1.0, bronx: 1.0,
  suburb: 0.9, njsouth: 0.8, philly: 0.8, pa: 0.9,
  // I-80 mountains
  njgap: 1.4, poconos: 1.4, paridge: 1.3, paplat: 1.3, fortlee: 0.9, njsub80: 1.0,
  // I-287 highlands
  ramapo: 1.2, rockland: 1.2,
  // GSP: coastal south barely whitens, Bergen north does
  gsp_capemay: 0.6, gsp_seashore: 0.6, gsp_atlantic: 0.65, gsp_pines: 0.75,
  gsp_ocean: 0.75, gsp_lakewood: 0.8, gsp_monmouth: 0.85, gsp_raritan: 0.9,
  gsp_i95: 0.9, gsp_rahway: 0.9, gsp_union: 0.95, gsp_essex: 0.95,
  gsp_clifton: 1.0, gsp_paterson: 1.0, gsp_north: 1.1, gsp_ny: 1.1,
  // shore + bay area
  acx_west: 0.75, acx_pines: 0.75, acx_egg: 0.7, acx_ac: 0.65,
  sf: 0.1, baybridge: 0.1, oakland: 0.1, i580: 0.15, dublin: 0.15, i680: 0.15,
  vallejo: 0.15, richmond: 0.1, eastbay: 0.1,
};
// Urban DOT keeps these stretches salted in a storm: the road runs dark, wet
// and mostly grippy while the rural miles stay buried.
const SNOW_SALTED = new Set([
  'chidt', 'danryan', 'i90ken', 'ord', 'skyway', 'downtown', 'millcreek', 'dayton', 'indy',
  'boston', 'logan', 'masspike', 'hartford',
  'suburb', 'philly', 'bronx', 'westchester', 'newhaven', 'fortlee', 'yonkers', 'nybronx',
  'gsp_essex', 'gsp_union', 'gsp_i95', 'gsp_rahway',
  'cleveland', 'toledo', 'perthamboy', 'elizabeth', 'newark1', 'jerseycity', 'trenton', 'acx_ac',
]);
// worldPack whitens the grass/trees/surroundings (BOTH snow modes);
// roadPack buries the pavement and eats grip (insane mode only, salt-relieved)
let worldPack = 0, roadPack = 0;
// Independent visual-only aftermath mode: a previous storm has left snow on
// the landscape and a pale salt film on the plowed road. Current weather,
// road grip, and traffic remain untouched.
let recentSnow = q.get('snowcover') === '1';
let roadSaltFilm = null;
function ensureRoadSaltFilm() {
  if (roadSaltFilm) return;
  roadSaltFilm = new THREE.Mesh(
    buildRibbon(s => -pavedHalfAt(s), s => pavedHalfAt(s), 0.065, 0.065, 14, 0, LOOP_LENGTH),
    new THREE.MeshStandardMaterial({
      color: 0xd8d6cb, roughness: 1, transparent: true, opacity: 0.2,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
  scene.add(roadSaltFilm);
}
function syncRecentSnowVisuals() {
  if (recentSnow) ensureRoadSaltFilm();
  if (roadSaltFilm) roadSaltFilm.visible = recentSnow;
}
// India's version of worldPack: 0 = parched dry-season landscape, 1 = full
// monsoon lushness. Ramps up fast under monsoon rain, dries back out slowly
// over a long clear/sunny spell — greenery tracks the weather you picked.
let monsoonGreen = 0;
function updateMonsoonGreen(dt, effWeather) {
  if (!INDIAN_MAP) return 0;
  const wet = effWeather === 'monsoon';
  const target = wet ? 1 : 0;
  monsoonGreen += (target - monsoonGreen) * Math.min(1, dt / (wet ? 35 : 220));
  return monsoonGreen;
}
// storm-front state: the wall sits at snowFrontS and creeps toward higher s
// (southbound down I-65 on the midwest map); snowFrontK = how deep inside the
// storm the PLAYER currently is (0 clear → 1 buried), used by flakes/fog too
let snowFrontS = 78000, snowFrontK = 0;
const snowSquall = { active: false, t: 0 };
let snowRibbon = null, saltRibbons = null;
function ensureSnowRibbon() {
  if (snowRibbon) return;
  snowRibbon = new THREE.Mesh(
    buildRibbon(s => -pavedHalfAt(s), s => pavedHalfAt(s), 0.07, 0.07, 14, 0, LOOP_LENGTH),
    new THREE.MeshStandardMaterial({
      color: 0xf2f5f8, roughness: 0.95, transparent: true, opacity: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
  scene.add(snowRibbon);
  // dark wet salted stretches drawn over the white, one per salted zone
  saltRibbons = [];
  for (const z of ZONES) {
    if (!SNOW_SALTED.has(z.key)) continue;
    const m = new THREE.Mesh(
      buildRibbon(s => -pavedHalfAt(s), s => pavedHalfAt(s), 0.08, 0.08, 14, z.start, z.end),
      new THREE.MeshStandardMaterial({
        color: 0x24262b, roughness: 0.55, transparent: true, opacity: 0,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
      }));
    scene.add(m);
    saltRibbons.push(m);
  }
}
function updateSnow(dt, zoneKey, playerS) {
  const light = weather === 'snowlight', front = weather === 'snowfront';
  // front mode: how deep in the storm the player is; the wall creeps south
  if (front) {
    snowFrontS += dt * 9;
    snowFrontK = THREE.MathUtils.clamp((snowFrontS - playerS) / 22000, 0, 1);
  } else snowFrontK = 0;
  // "insane intensity" 0..1: full in insane mode, position-based in front mode
  const insaneI = weather === 'snow' ? 1 : front ? snowFrontK : 0;
  if (insaneI > 0.7) {
    if (!snowSquall.active && Math.random() < dt / 90) { snowSquall.active = true; snowSquall.t = 20 + Math.random() * 25; }
    if (snowSquall.active && (snowSquall.t -= dt) <= 0) snowSquall.active = false;
  } else snowSquall.active = false;
  const sev = SNOW_SEVERITY[zoneKey] ?? 1;
  // insane: EVERYTHING whitens — grass fully buried everywhere, roads start
  // going white immediately (fast ramp to half-covered, then slow burial)
  const worldTarget = insaneI > 0 ? insaneI : light ? Math.min(1, 0.55 * sev) : 0;
  const roadTarget = Math.min(1, insaneI * (0.75 + (snowSquall.active ? 0.25 : 0)) * sev);
  const insane = insaneI > 0.3;
  const snowing = insaneI > 0 || light;
  worldPack += (worldTarget - worldPack) * Math.min(1, dt / (insane ? 14 : snowing ? 45 : 30));
  roadPack += (roadTarget - roadPack) * Math.min(1, dt / (insane ? (roadPack < 0.45 ? 10 : 40) : 30));
  if (snowing) ensureSnowRibbon();
  if (snowRibbon) {
    snowRibbon.material.opacity = roadPack * 0.85;
    snowRibbon.visible = roadPack > 0.02;
    for (const m of saltRibbons) {
      m.material.opacity = Math.min(0.85, roadPack * 0.95);
      m.visible = m.material.opacity > 0.02;
    }
  }
  // grip: salted stretches keep ~85% of it even buried; rural drops to ~0.4
  const saltRelief = SNOW_SALTED.has(zoneKey) ? 0.25 : 1;
  return 1 - roadPack * 0.6 * saltRelief;
}

// ---------------------------------------------------------------------------
// Rain front: a storm wall rolling in from the south/west (the high-s end),
// escalating by geography — hurricane on the coast, tornado in the plains,
// severe thunderstorm elsewhere — and ponding into road flooding underneath.
// ---------------------------------------------------------------------------
const RF_COASTAL = new Set([
  'gsp_capemay', 'gsp_seashore', 'gsp_atlantic', 'gsp_pines', 'gsp_ocean', 'gsp_lakewood',
  'gsp_monmouth', 'acx_ac', 'acx_egg', 'acx_pines', 'acx_west',
  'ctshore', 'newhaven', 'corridor', 'boston95', 'providence', 'logan', 'boston',
  'sf', 'baybridge', 'oakland', 'eastbay', 'richmond', 'vallejo',
  // India: the Arabian Sea coast — a rain front here reads as a CYCLONE
  'mumbai', 'andheriW', 'airport', 'bandra', 'sealink', 'marine', 'chembur',
]);
const RF_TORNADO = new Set([
  'i65', 'i74', 'flat', 'plains', 'i80', 'gary', 'chi80', 'inturnpike', 'indy', 'hills',
  'ohio80', 'toledo', 'sharonville', 'wchester75', 'middletown', 'franklin75', 'moraine',
  'dayton', 'millcreek',
]);
let rainFrontS = null, rainFrontK = 0, rainFrontStyle = 'storm';
let floodPack = 0, floodRibbon = null;
let funnel = null, funnelT = 0;
const _rfV = new THREE.Vector3();
function ensureFloodRibbon() {
  if (floodRibbon) return;
  floodRibbon = new THREE.Mesh(
    buildRibbon(s => -pavedHalfAt(s), s => pavedHalfAt(s), 0.06, 0.06, 14, 0, LOOP_LENGTH),
    new THREE.MeshStandardMaterial({
      color: 0x18242c, roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }));
  scene.add(floodRibbon);
}
function ensureFunnel() {
  if (funnel) return;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2b2e33, transparent: true, opacity: 0.82, roughness: 1, side: THREE.DoubleSide,
  });
  funnel = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(64, 5, 360, 12, 1, true), mat);
  funnel.add(cone);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(150, 60, 60, 12, 1, true), mat);
  skirt.position.y = 195;
  funnel.add(skirt);
  scene.add(funnel);
}
function updateRainFront(dt, zoneKey, playerS) {
  if (weather !== 'rainfront') {
    rainFrontK = 0; rainFrontS = null;
    if (funnel) funnel.visible = false;
    floodPack = Math.max(0, floodPack - dt / 40);
    if (floodRibbon) floodRibbon.material.opacity = floodPack * 0.55;
    return 1;
  }
  if (rainFrontS === null) rainFrontS = playerS + 20000;   // wall starts just south/west
  rainFrontS -= dt * 11;                                    // and rolls toward you
  rainFrontK = THREE.MathUtils.clamp((playerS - rainFrontS) / 20000, 0, 1);
  rainFrontStyle = RF_COASTAL.has(zoneKey) ? 'hurricane'
    : RF_TORNADO.has(zoneKey) ? 'tornado' : 'storm';
  // ponding once it's really coming down; coastal surge floods fastest.
  // India maps: no flooding (per spec) — the drains hold, miraculously
  const floodTarget = INDIAN_MAP ? 0
    : Math.min(1, Math.max(0, rainFrontK - 0.45) * (rainFrontStyle === 'hurricane' ? 2.2 : 1.4));
  floodPack += (floodTarget - floodPack) * Math.min(1, dt / 35);
  ensureFloodRibbon();
  floodRibbon.material.opacity = floodPack * 0.55;
  floodRibbon.visible = floodPack > 0.03;
  // the funnel on the horizon, plains only, deep in the cell
  if (rainFrontStyle === 'tornado' && rainFrontK > 0.75) {
    ensureFunnel();
    funnel.visible = true;
    funnelT += dt;
    const fs = playerS + 2400 + Math.sin(funnelT * 0.13) * 900;
    const flat = 520 + Math.sin(funnelT * 0.07) * 180;
    funnel.position.copy(posAtRF(fs, flat));
    funnel.position.y = 175;
    funnel.rotation.y += dt * 2.4;
  } else if (funnel) funnel.visible = false;
  // lightning in the severe core (hurricanes mostly just roar)
  if (rainFrontK > 0.6 && rainFrontStyle !== 'hurricane' && Math.random() < dt * 0.35) {
    flashT = 0.09 + Math.random() * 0.12;
  }
  // wet pavement + hydroplaning in the ponds
  return 1 - rainFrontK * 0.12 - floodPack * 0.18;
}
function posAtRF(s, lat) { return posAt(s % LOOP_LENGTH, lat, _rfV); }

let precipMode = null; // 'rain' | 'snow' | null
let roadWet = 0;       // 0 dry .. 1 soaked (drives reflective asphalt)
function updateRain(dt, zoneKey, effWeather) {
  // February (winter) precipitation falls as snow on the US maps; India never snows
  const wet = effWeather === 'monsoon' || effWeather === 'rain' || shower.active;
  const mode = wet ? (season === 'winter' && !inIndia(zoneKey) ? 'snow' : 'rain')
    : (weather === 'snow' || weather === 'snowlight' || weather === 'snowfront') && !inIndia(zoneKey) ? 'snow' : null;
  const heavy = mode === 'rain' && (weather === 'storm' || burst.active || shower.intensity > 0.6
    || (weather === 'rainfront' && rainFrontK > 0.5));
  if (mode !== precipMode) {
    precipMode = mode;
    rain.material.color.set(mode === 'snow' ? 0xf4f7fa : 0xaebccb);
  }
  rain.material.opacity = mode === 'snow'
    ? (weather === 'snowlight' ? 0.45
      : weather === 'snowfront' ? 0.08 + 0.85 * snowFrontK
      : snowSquall.active ? 0.97 : 0.85)
    : mode === 'rain' && weather === 'rainfront' ? 0.12 + 0.75 * rainFrontK
    : mode === 'rain' && weather === 'rainlight' ? 0.32
    : mode === 'rain' && weather === 'rainheavy' ? (burst.active ? 0.95 : 0.85)
    : heavy ? 0.8 : 0.5;
  // a passing shower's density tracks its intensity (drizzle → downpour)
  if (mode === 'rain' && shower.active && !storm.active && !burst.active) {
    rain.material.opacity = 0.2 + 0.5 * shower.intensity;
  }
  rain.visible = mode !== null;

  // wet road: soaks fast once it rains, dries off slowly after
  const wetTarget = mode === 'rain' ? 1 : 0;
  roadWet += (wetTarget - roadWet) * Math.min(1, dt * (wetTarget > roadWet ? 0.35 : 0.06));
  for (const m of registry.roadMats || []) {
    if (!m.userData.dryCol) m.userData.dryCol = m.color.clone();
    m.roughness = 0.95 - 0.62 * roadWet;
    m.envMapIntensity = 0.3 + 1.2 * roadWet;
    m.color.copy(m.userData.dryCol).multiplyScalar(1 - 0.42 * roadWet);
  }

  if (!rain.visible) return;
  rain.position.copy(camera.position).add(new THREE.Vector3(0, -20, 0));
  const arr = rainGeo.attributes.position.array;
  const fall = mode === 'snow' ? 5 : heavy ? 38 : 26;
  const streak = mode === 'snow' ? 0.12 : heavy ? 1.15 : 0.8;
  for (let i = 0; i < RAIN_N; i++) {
    const d = drops[i];
    d.y -= (fall + (i % 7)) * dt;
    if (mode === 'snow') d.x += Math.sin(simTime * 1.2 + i) * 1.5 * dt; // drift
    if (d.y < 0) {
      d.y = 55;
      d.x = (Math.random() - 0.5) * 90;
      d.z = (Math.random() - 0.5) * 90;
    }
    const k = i * 6;
    arr[k] = d.x; arr[k + 1] = d.y + streak; arr[k + 2] = d.z;
    arr[k + 3] = d.x + (mode === 'snow' ? 0 : 0.06); arr[k + 4] = d.y; arr[k + 5] = d.z;
  }
  rainGeo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Windshield wipers: driver-POV only, screen-space so they hold still through
// cockpit head-sway/mirror glances. Continuous sweep in real rain/snow, slow
// intermittent single-swipes in a light drizzle; parked and hidden otherwise.
// ---------------------------------------------------------------------------
let wiperCycle = 0;   // 0..1 running phase within the current period
const WIPER_ACTIVE_FRAC = 0.4;   // intermittent mode: swipe only this slice of the cycle
function updateWipers(dt) {
  const inCockpit = q.get('cam') !== 'top' && chase.modeName === 'cockpit';
  const active = inCockpit && precipMode !== null;
  wiperCanvas.style.display = active ? 'block' : 'none';
  if (!active) return;

  const intensity = THREE.MathUtils.clamp(rain.material.opacity / 0.95, 0, 1);
  const intermittent = precipMode === 'rain' && intensity < 0.32;
  let sweep;
  if (intermittent) {
    const period = 4.6 - intensity * 2.2;   // a single swipe every few seconds
    wiperCycle = (wiperCycle + dt / period) % 1;
    const local = wiperCycle / WIPER_ACTIVE_FRAC;
    sweep = local <= 1 ? (local < 0.5 ? local * 2 : (1 - local) * 2) : 0;
  } else {
    const period = precipMode === 'snow'
      ? THREE.MathUtils.lerp(2.4, 1.25, intensity)
      : THREE.MathUtils.lerp(1.15, 0.62, intensity);
    wiperCycle = (wiperCycle + dt / period) % 1;
    sweep = wiperCycle < 0.5 ? wiperCycle * 2 : (1 - wiperCycle) * 2;
  }

  const w = innerWidth, h = innerHeight;
  wiperCtx.clearRect(0, 0, w, h);
  wiperCtx.strokeStyle = 'rgba(14,15,17,0.88)';
  wiperCtx.fillStyle = 'rgba(14,15,17,0.88)';
  wiperCtx.lineCap = 'round';
  const bladeLen = Math.min(w, h) * 0.62;
  const drawBlade = (pivotX, pivotY, restDeg, sweptDeg) => {
    const deg = restDeg + (sweptDeg - restDeg) * sweep;
    const rad = deg * Math.PI / 180;
    const tipX = pivotX + Math.sin(rad) * bladeLen;
    const tipY = pivotY - Math.cos(rad) * bladeLen;
    // arm (thin) from pivot to ~35% out, blade (thicker) the rest of the way
    const armX = pivotX + Math.sin(rad) * bladeLen * 0.32;
    const armY = pivotY - Math.cos(rad) * bladeLen * 0.32;
    wiperCtx.lineWidth = 5;
    wiperCtx.beginPath();
    wiperCtx.moveTo(pivotX, pivotY);
    wiperCtx.lineTo(armX, armY);
    wiperCtx.stroke();
    wiperCtx.lineWidth = 11;
    wiperCtx.beginPath();
    wiperCtx.moveTo(armX, armY);
    wiperCtx.lineTo(tipX, tipY);
    wiperCtx.stroke();
    wiperCtx.beginPath();
    wiperCtx.arc(pivotX, pivotY, 7, 0, Math.PI * 2);
    wiperCtx.fill();
  };
  // parked flat along the bottom corners, swept up-and-inward — the classic
  // tandem-wiper motion
  drawBlade(w * 0.14, h * 1.02, -82, -28);
  drawBlade(w * 0.86, h * 1.02, 82, 28);
}

// brief top-center toast (camera mode, cruise state, …)
function uiToast(text) {
  let t = document.getElementById('camtoast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'camtoast';
    Object.assign(t.style, {
      position: 'fixed', top: '18px', left: '50%', transform: 'translateX(-50%)',
      color: '#fff', background: 'rgba(10,14,22,.65)', padding: '7px 18px',
      borderRadius: '999px', font: '600 14px -apple-system, sans-serif',
      letterSpacing: '.14em', textTransform: 'uppercase', zIndex: 8,
      pointerEvents: 'none', transition: 'opacity .4s ease', backdropFilter: 'blur(5px)',
    });
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.style.opacity = 1;
  clearTimeout(uiToast._t);
  uiToast._t = setTimeout(() => { t.style.opacity = 0; }, 1400);
}
const camToast = () => uiToast('camera · ' + chase.modeName);

addEventListener('keydown', e => {
  initAudio();
  if (e.code === 'KeyC') { chase.toggle(); camToast(); }
  if (e.code === 'KeyX') {
    const current = player.lexusMode ? 'lexus' : player.jazzMode ? 'jazz' : player.jettaMode ? 'jetta' : player.mercedesMode ? 'mercedes'
      : player.bmwMode ? 'bmw'
      : player.volvoMode ? 'volvo' : (player.teslaMode ? 'tesla' : 'car');
    const order = ['car', 'jazz', 'tesla', 'bmw', 'volvo', 'mercedes', 'jetta', 'lexus'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    player.setVehicle(next);
    uiToast(next === 'jazz' ? 'vehicle · gray honda jazz'
      : next === 'tesla' ? 'vehicle · tesla model x'
      : next === 'bmw' ? 'vehicle · dark navy bmw x5'
      : next === 'volvo' ? 'vehicle · black volvo xc90'
      : next === 'mercedes' ? 'vehicle · dark green mercedes e class'
      : next === 'jetta' ? 'vehicle · maroon volkswagen jetta'
      : next === 'lexus' ? 'vehicle · silver lexus sedan' : 'vehicle · sedan');
  }
  if (e.code === 'KeyV') {
    player.setVehicle(player.volvoMode ? 'car' : 'volvo');
    uiToast(player.volvoMode ? 'vehicle · black volvo xc90' : 'vehicle · sedan');
  }
  if (e.code === 'KeyU' && !e.repeat) {
    const cv = player.toggleCruise();
    uiToast(cv
      ? 'cruise · ' + (EURO ? Math.round(player.mph * 1.60934) + ' km/h' : Math.round(player.mph) + ' mph')
      : 'cruise off');
  }
  if (e.code === 'KeyT') timeScale = timeScale === 1 ? 8 : 1;
  if (e.code === 'KeyH') honk(player.busMode ? 'truck' : 'car', 0.95);
});
addEventListener('pointerdown', () => initAudio());

// ambient honking: constant chorus in Mumbai, occasional elsewhere
const HONK_RATE = {
  mumbai: 2.4, suburb: 0.12, philly: 0.25, andheriW: 2.8, airport: 1.2,
  // Delhi: the smog is the weather — thick everywhere, worst on the Yamuna
  // flats and the winter fog belt out the Rohtak road
  d_gurgaon: 1.6, d_nh48: 1.6, d_igi: 1.8, d_dhaula: 1.8, d_lutyens: 1.6,
  d_cp: 2.0, d_ito: 2.2, d_yamuna: 2.6, d_noida: 1.8, d_ring: 1.8,
  d_pbagh: 2.0, d_bgarh: 2.2, d_sampla: 3.0, d_rohtak: 2.4,
  bandra: 0.9, sealink: 0.3, marine: 0.8,
  flat: 0.02, puneX: 0.35, pune: 2.2, pcmc: 1.4, cincy: 0.4, chembur: 3.0,
  p_gaon: 2.0, p_aundh: 2.4, p_link: 1.8, p_baner: 2.0, p_bale: 1.4, p_pashan: 1.0, p_iti: 2.6,
  millcreek: 0.45, sharonville: 0.2, wchester75: 0.1, middletown: 0.12,
  franklin75: 0.05, moraine: 0.15, dayton: 0.4,
  newhaven: 0.3, corridor: 0.08, bronx: 1.0, pa: 0.03, plains: 0.02,
  westchester: 0.12, njsouth: 0.06,
  boston95: 0.9, providence: 0.6, ctshore: 0.1,
  perthamboy: 0.22, piscataway: 0.16, bridgewater: 0.1, morristown: 0.08, ramapo: 0.05,
  rockland: 0.05, tappanzee: 0.15, westch: 0.2, yonkers: 0.9, nybronx: 1.2, gwb287: 0.8,
  gsp_i95: 0.2, gsp_rahway: 0.3, gsp_union: 0.5, gsp_essex: 0.4, gsp_clifton: 0.2,
  gsp_paterson: 0.3, gsp_north: 0.08, gsp_ny: 0.06,
  philly76: 1.1, wwb: 0.5, gloucester: 0.3, nj42: 0.35,
  acx_west: 0.08, acx_pines: 0.02, acx_egg: 0.08, acx_ac: 0.7,
  gsp_capemay: 0.05, gsp_seashore: 0.06, gsp_atlantic: 0.12, gsp_pines: 0.02,
  gsp_ocean: 0.1, gsp_lakewood: 0.18, gsp_monmouth: 0.22, gsp_raritan: 0.3,
  // NYC: near-constant horns through Manhattan and Queens, easing on Long Island
  gwb: 1.2, washheights: 1.6, harlem: 1.8, ues: 1.6, midtown: 2.6, tunnel: 1.4,
  lic: 1.4, woodside: 1.3, corona: 1.2, flushing: 1.1, newhydepark: 0.5, mineola: 0.4,
  jericho: 0.3, li_return: 0.15,
  sf: 0.6, baybridge: 0.5, oakland: 0.7, i580: 0.2, dublin: 0.15, i680: 0.15,
  vallejo: 0.2, richmond: 0.3, eastbay: 0.5,
  gary: 0.15, i65: 0.02, indy: 0.4, i74: 0.02, hills: 0.02, downtown: 0.6,
  ord: 0.2, i90ken: 0.5, chidt: 0.7, danryan: 0.6, skyway: 0.15, i80: 0.1,
  i91: 0.08, hartford: 0.5, i84: 0.05, masspike: 0.2, boston: 0.9, logan: 0.6,
  fortlee: 0.9, njsub80: 0.3, njgap: 0.04, poconos: 0.03, paridge: 0.02, paplat: 0.02,
  ohio80: 0.1, cleveland: 0.7, toledo: 0.3, inturnpike: 0.04, chi80: 0.6,
  // US-1 NJ arterial: busy horns at the lights, heaviest in the cities
  trenton: 0.9, lawrence: 0.3, princeton: 0.35, nbrunswick: 0.5, newbrunswick: 1.0,
  edison: 0.7, iselin: 0.5, woodbridge: 0.8, linden: 0.5, elizabeth: 0.9,
  newark1: 1.3, pulaski: 0.4, jerseycity: 1.4, us1_return: 0.4,
  // Europe honks less than the US Northeast; Madrid + the Iberian cities more
  // than Germany, where it's practically a legal event
  pt_lisboa: 0.5, pt_vfx: 0.15, pt_ribatejo: 0.05, pt_santarem: 0.08, pt_fatima: 0.06,
  pt_leiria: 0.08, pt_pombal: 0.05, pt_coimbra: 0.2, pt_bairrada: 0.05, pt_aveiro: 0.1,
  pt_gaia: 0.35, pt_porto: 0.55,
  es_madrid: 0.7, es_sur: 0.3, es_aranjuez: 0.1, es_ocana: 0.04, es_mancha: 0.03,
  es_valdepenas: 0.04, es_despena: 0.05, es_bailen: 0.06, es_andujar: 0.06,
  es_cordoba: 0.4, es_ecija: 0.1, es_carmona: 0.08, es_sevilla: 0.6,
  de_ffm: 0.25, de_wiesbaden: 0.1, de_taunus: 0.03, de_limburg: 0.06, de_montabaur: 0.03,
  de_westerwald: 0.02, de_siebengebirge: 0.04, de_bonn: 0.15, de_lohmar: 0.05, de_koeln: 0.3,
  uk_bham: 0.4, uk_m6: 0.05, uk_m1n: 0.05, uk_mk: 0.08, uk_luton: 0.15,
  uk_nlondon: 0.5, uk_london: 0.8, uk_slondon: 0.5, uk_m20w: 0.06, uk_kent: 0.03,
  uk_ashford: 0.1, uk_dover: 0.25,
  fr_calais: 0.3, fr_boulogne: 0.15, fr_opale: 0.04, fr_somme: 0.05, fr_amiens: 0.3,
  fr_picardie: 0.03, fr_beauvais: 0.15, fr_oise: 0.08, fr_stdenis: 0.6, fr_paris: 1.0,
  // Italy honks — Napoli most of all
  it_roma: 1.0, it_castelli: 0.15, it_colleferro: 0.1, it_frosinone: 0.2,
  it_ceprano: 0.08, it_cassino: 0.2, it_sanvittore: 0.05, it_caianello: 0.08,
  it_caserta: 0.3, it_napoli: 1.8,
};
// Indian *city* zones (not the expressway/ghats or the sea bridges): harsh
// everyday horns + a constant background din of distant honking.
const INDIA_CITY = new Set(['mumbai', 'chembur', 'pune', 'pcmc', 'andheriW', 'airport', 'bandra', 'marine',
  'p_gaon', 'p_aundh', 'p_link', 'p_baner', 'p_bale', 'p_pashan', 'p_iti']);
function updateHonks(dt, zoneKey) {
  const inCity = INDIA_CITY.has(zoneKey)
    || (MAP === 'delhikolkata' && ['dk_delhi', 'dk_kanpur', 'dk_prayagraj', 'dk_varanasi', 'dk_kolkata'].includes(zoneKey));
  setHonkDin(inCity ? 1 : 0);
  // continuous bed: traffic rumble scaled by how honky/busy the zone is,
  // wind that rises with your speed
  const rate = HONK_RATE[zoneKey] ?? 0.05;
  setAmbience(Math.min(1, player.v / 38), Math.min(1, 0.25 + rate * 0.4));
  if (Math.random() < dt * rate) {
    const r = Math.random();
    const kind = (zoneKey === 'mumbai' || zoneKey === 'pune' || zoneKey === 'andheriW' || zoneKey === 'pcmc'
      || zoneKey.startsWith('p_'))
      ? (r < 0.45 ? 'rickshaw' : r < 0.8 ? 'car' : 'truck')
      : (r < 0.75 ? 'car' : 'truck');
    honk(kind, 0.4 + Math.random() * 0.6, inCity);
  }
}

// map / direction switcher — reloads with new URL params
const mpanel = document.getElementById('mpanel');
function reloadWith(params) {
  const url = new URLSearchParams(location.search);
  url.delete('zone'); url.delete('s');
  // weather deep-links don't survive a map/direction switch: every map opens
  // on the default summer-clear sky unless ?wx= is passed explicitly
  url.delete('wx');
  for (const [k, v] of Object.entries(params)) url.set(k, v);
  location.search = url.toString();
}
const mapBtns = [
  { label: 'I-95 · NORTHEAST', on: MAP === 'i95', go: () => reloadWith({ map: 'i95' }) },
  { label: 'I-287 · NEW JERSEY', on: MAP === 'i287', go: () => reloadWith({ map: 'i287' }) },
  { label: 'I-278 · NJ-440→BRONX', on: MAP === 'i278', go: () => reloadWith({ map: 'i278' }) },
  { label: 'BRONX RIVER PKWY → I-295', on: MAP === 'bronxriver', go: () => reloadWith({ map: 'bronxriver' }) },
  { label: 'GARDEN STATE PKWY', on: MAP === 'gsp', go: () => reloadWith({ map: 'gsp' }) },
  { label: 'PHILA→ATLANTIC CITY · ACX', on: MAP === 'acx', go: () => reloadWith({ map: 'acx' }) },
  { label: 'I-40/I-85 · BENSON→CHARLOTTE', on: MAP === 'nc40', go: () => reloadWith({ map: 'nc40' }) },
  { label: 'SF BAY · I-80/580/680', on: MAP === 'bay', go: () => reloadWith({ map: 'bay' }) },
  { label: 'I-5 · LOS ANGELES→SAN FRANCISCO', on: MAP === 'cal5', go: () => reloadWith({ map: 'cal5' }) },
  { label: 'NYC · GWB→LIE JERICHO', on: MAP === 'nyc', go: () => reloadWith({ map: 'nyc' }) },
  { label: 'US-1 · TRENTON→JERSEY CITY', on: MAP === 'us1', go: () => reloadWith({ map: 'us1' }) },
  { label: 'NEW ENGLAND · I-91/90', on: MAP === 'newengland', go: () => reloadWith({ map: 'newengland' }) },
  { label: 'I-80 · GWB→CHICAGO', on: MAP === 'i80', go: () => reloadWith({ map: 'i80' }) },
  { label: 'I-78 · PA→HOLLAND TUNNEL', on: MAP === 'i78', go: () => reloadWith({ map: 'i78' }) },
  { label: 'I-280 · MORRIS COUNTY→NEWARK', on: MAP === 'i280', go: () => reloadWith({ map: 'i280' }) },
  { label: 'US-22 · LEHIGH VALLEY→UNION→NEWARK', on: MAP === 'us22', go: () => reloadWith({ map: 'us22' }) },
  { label: 'I-45 · DALLAS→HOUSTON', on: MAP === 'tx45', go: () => reloadWith({ map: 'tx45' }) },
  { label: "FLORIDA'S TURNPIKE", on: MAP === 'flturnpike', go: () => reloadWith({ map: 'flturnpike' }) },
  { label: 'MIDWEST · I-80/65', on: MAP === 'midwest', go: () => reloadWith({ map: 'midwest' }) },
  { label: 'LIBERTIA · ROUTE HUB', on: false, go: () => { location.href = './libertia-routes.html'; } },
  { label: 'INDIA · MUM-PUNE', on: MAP === 'india', go: () => reloadWith({ map: 'india' }) },
  { label: 'INDIA · MUMBAI→BENGALURU · NH48', on: MAP === 'nh48', go: () => reloadWith({ map: 'nh48' }) },
  { label: 'ANDHERI W · INNER', on: MAP === 'andheri', go: () => reloadWith({ map: 'andheri' }) },
  { label: 'AUNDH-BANER RD · PUNE', on: MAP === 'aundh', go: () => reloadWith({ map: 'aundh' }) },
  { label: 'DELHI NCR · दिल्ली का चक्कर', on: MAP === 'newdelhi', go: () => reloadWith({ map: 'newdelhi' }) },
  // the EUROPE group: one header button folds the European routes in and out
  { label: '🇪🇺 EUROPE ' + (EURO ? '▾' : '▸'), on: EURO, euroHead: true, go: null },
  { label: '🇵🇹 A1 · LISBOA→PORTO', on: MAP === 'a1', euro: true, go: () => reloadWith({ map: 'a1' }) },
  { label: '🇪🇸 A-4 · MADRID→SEVILLA', on: MAP === 'a4', euro: true, go: () => reloadWith({ map: 'a4' }) },
  { label: '🇩🇪 A3 · FRANKFURT→KÖLN', on: MAP === 'a3', euro: true, go: () => reloadWith({ map: 'a3' }) },
  { label: '🇬🇧 M1 · BIRMINGHAM→DOVER', on: MAP === 'm1', euro: true, go: () => reloadWith({ map: 'm1' }) },
  { label: '🇫🇷 A16 · CALAIS→PARIS', on: MAP === 'a16', euro: true, go: () => reloadWith({ map: 'a16' }) },
  { label: '🇮🇹 A1 · ROMA→NAPOLI', on: MAP === 'a1it', euro: true, go: () => reloadWith({ map: 'a1it' }) },
  { label: '🇨🇭 A1 · INTERLAKEN→GENÈVE', on: MAP === 'swiss', euro: true, go: () => reloadWith({ map: 'swiss' }) },
  { label: '🕌 MUGHAL DELHI', on: false, go: () => reloadWith({ map: 'delhi' }) },
  { label: 'CHESTER PA · SUBURBAN ARTERIAL', on: MAP === 'chester', go: () => reloadWith({ map: 'chester' }) },
  { label: '🛫 NEWARK AIRPORT · EWR', on: false, go: () => reloadWith({ map: 'newark' }) },
  {
    label: '⇄ GO ' + DIR_LABELS[DIR > 0 ? 0 : 1],
    on: false,
    go: () => reloadWith({ dir: DIR > 0 ? 'north' : 'south' }),
  },
];
// New Haven I-95 ⨯ I-91 interchange: take the exit across to the other map,
// landing at the New Haven end (maps are separate centerlines).
if (MAP === 'i95') {
  mapBtns.push({ label: '⤴ EXIT 48 · I-91 N → BOSTON', on: false, go: () => reloadWith({ map: 'newengland' }) });
  mapBtns.push({ label: '⤴ I-80 WEST → CHICAGO', on: false, go: () => reloadWith({ map: 'i80' }) });
  // NJ Turnpike Exit 10 (Edison) ⨯ I-287
  mapBtns.push({ label: '⤴ EXIT 10 · I-287 N', on: false, go: () => reloadWith({ map: 'i287', s: 3000 }) });
  // at the GWB, I-95 meets I-87 (the Deegan) heading into the Bronx / Tappan Zee
  mapBtns.push({ label: '⤴ I-87 N · BRONX / TAPPAN ZEE', on: false, go: () => reloadWith({ map: 'i287', s: 127000 }) });
  // NJ Turnpike / I-95 at Woodbridge ⨯ Garden State Parkway
  mapBtns.push({ label: '⤴ GARDEN STATE PKWY N', on: false, go: () => reloadWith({ map: 'gsp', s: 207500 }) });
  // Philadelphia: I-76 east over the Walt Whitman toward Atlantic City
  mapBtns.push({ label: '⤴ I-76 E · WALT WHITMAN → AC', on: false, go: () => reloadWith({ map: 'acx', s: 800 }) });
}
if (MAP === 'gsp') {
  mapBtns.push({ label: '⤴ I-95 · NJ TPKE (S)', on: false, go: () => reloadWith({ map: 'i95', s: 59800 }) });
  mapBtns.push({ label: '⤴ I-87 · NY THRUWAY (N)', on: false, go: () => reloadWith({ map: 'i287', s: 74000 }) });
  // GSP Exit 38 ⨯ Atlantic City Expressway (ACX Exit 7)
  mapBtns.push({ label: '⤴ EXIT 38 · AC EXPWY → PHILA', on: false, go: () => reloadWith({ map: 'acx', s: 84300 }) });
}
if (MAP === 'acx') {
  // ACX Exit 7 ⨯ Garden State Parkway (GSP Exit 38)
  mapBtns.push({ label: '⤴ EXIT 7 · GARDEN STATE PKWY', on: false, go: () => reloadWith({ map: 'gsp', s: 61100 }) });
  // west end: I-76 back into the I-95 corridor at Philadelphia
  mapBtns.push({ label: '⤴ I-95 · PHILADELPHIA', on: false, go: () => reloadWith({ map: 'i95', s: 85200 }) });
}
if (MAP === 'i287') {
  mapBtns.push({ label: '⤴ NJ TURNPIKE · I-95', on: false, go: () => reloadWith({ map: 'i95', s: 60600 }) });
  mapBtns.push({ label: '⤴ GW BRIDGE · I-95 NORTHEAST', on: false, go: () => reloadWith({ map: 'i95', s: 43350 }) });
  mapBtns.push({ label: '⤴ GARDEN STATE PKWY S', on: false, go: () => reloadWith({ map: 'gsp', s: 277000 }) });
}
if (MAP === 'newengland') {
  mapBtns.push({ label: '⤴ I-95 · NEW HAVEN / NYC', on: false, go: () => reloadWith({ map: 'i95' }) });
}
if (MAP === 'i278') {
  mapBtns.push({ label: '⤴ I-495 EAST · LIE / QUEENS', on: false, go: () => reloadWith({ map: 'nyc', s: 28000 }) });
}
if (MAP === 'i80') {
  mapBtns.push({ label: '⤴ I-95 · GWB / NYC', on: false, go: () => reloadWith({ map: 'i95', zone: 'suburb' }) });
  mapBtns.push({ label: '⤴ I-65 S · MIDWEST', on: false, go: () => reloadWith({ map: 'midwest', zone: 'gary' }) });
}
if (MAP === 'midwest') {
  mapBtns.push({ label: '⤴ I-80 EAST → CLEVELAND/NYC', on: false, go: () => reloadWith({ map: 'i80', zone: 'chi80' }) });
}
// Bandra (andheri map) ⨯ Chembur (mumbai-pune / india map)
if (MAP === 'andheri') {
  mapBtns.push({ label: '⤴ CHEMBUR · MUM-PUNE EXPWY', on: false, go: () => reloadWith({ map: 'india', zone: 'chembur' }) });
}
if (MAP === 'india') {
  mapBtns.push({ label: '⤴ BANDRA · ANDHERI', on: false, go: () => reloadWith({ map: 'andheri', zone: 'bandra' }) });
  // off NH-48 at the University flyover onto the Aundh–Baner circuit
  mapBtns.push({ label: '⤴ AUNDH-BANER RD · PUNE', on: false, go: () => reloadWith({ map: 'aundh', s: 3400 }) });
}
if (MAP === 'nh48') mapBtns.push({ label: '⤴ INDIA · MUM-PUNE EXPRESSWAY', on: false, go: () => reloadWith({ map: 'india', zone: 'pune' }) });
if (MAP === 'aundh') {
  mapBtns.push({ label: '⤴ NH-48 · MUM-PUNE EXPWY', on: false, go: () => reloadWith({ map: 'india', zone: 'pune' }) });
}
// the Channel Tunnel links Folkestone (M20 J11A) and Coquelles (A16 sortie 43)
if (MAP === 'm1') {
  mapBtns.push({ label: '⤴ 🚄 EUROTUNNEL → CALAIS · A16', on: false, go: () => reloadWith({ map: 'a16', s: 3000 }) });
}
if (MAP === 'a16') {
  mapBtns.push({ label: '⤴ 🚄 LE SHUTTLE → FOLKESTONE · M20', on: false, go: () => reloadWith({ map: 'm1', s: 309000 }) });
}
if (q.get('standalone') === '1') {
  mapBtns.unshift({ label: '🇮🇳 DELHI → KOLKATA · LOCAL ROAD', on: true, go: null });
}
let euroOpen = EURO;
const euroChildBtns = [];
const visibleMapBtns = q.get('standalone') === '1'
  ? mapBtns.filter(b => b.on || b.label.startsWith('⇄ GO'))
  : mapBtns;
for (const b of visibleMapBtns) {
  const btn = document.createElement('button');
  btn.textContent = b.label;
  btn.classList.toggle('active', b.on);
  if (b.euroHead) {
    btn.addEventListener('click', () => {
      euroOpen = !euroOpen;
      btn.textContent = '🇪🇺 EUROPE ' + (euroOpen ? '▾' : '▸');
      for (const c of euroChildBtns) c.style.display = euroOpen ? '' : 'none';
      btn.blur();
    });
  } else {
    btn.addEventListener('click', b.go);
  }
  if (b.euro) {
    euroChildBtns.push(btn);
    if (!euroOpen) btn.style.display = 'none';
  }
  mpanel.appendChild(btn);
}
const buddyBtn = document.createElement('button');
buddyBtn.textContent = 'BUDDY · OFF';
buddyBtn.addEventListener('click', () => {
  const on = buddy.toggle();
  buddyBtn.textContent = on ? 'BUDDY · ON' : 'BUDDY · OFF';
  buddyBtn.classList.toggle('active', on);
  buddyBtn.blur();
});
mpanel.appendChild(buddyBtn);

// spawn-point jump panel (teleports within the current map). Zone stops and the
// extra named spawn points are merged into a single list ordered by position
// along the route, so the buttons read top-to-bottom the way you drive.
const panel = document.getElementById('panel');
const jumps = [
  ...ZONES.map(z => ({
    label: z.label, sortS: z.start, key: z.key,
    to: () => z.start + (DIR < 0 ? z.end - z.start - 250 : 250),
  })),
  ...SPAWNS.map(sp => ({ label: sp.label, sortS: sp.s, to: () => sp.s })),
].sort((a, b) => a.sortS - b.sortS);
for (const j of jumps) {
  const btn = document.createElement('button');
  btn.textContent = j.label;
  if (j.key) btn.dataset.key = j.key;
  btn.addEventListener('click', () => {
    player.teleport(j.to());
    chase._init = false; // snap camera to new location
    btn.blur();          // keep WASD off the button
  });
  panel.appendChild(btn);
}
// weather / season / time-of-day presets
const wpanel = document.getElementById('wpanel');
const monthSlider = document.getElementById('monthslider');
const monthValue = document.getElementById('monthvalue');
monthSlider.value = String(month);
monthValue.textContent = MONTH_NAMES[month];
monthSlider.addEventListener('input', () => {
  setMonth(Number.parseInt(monthSlider.value, 10));
  monthValue.textContent = MONTH_NAMES[month];
  markWeatherButtons();
});
monthSlider.addEventListener('change', () => monthSlider.blur());
// set-the-clock slider: any time of day in 15-minute steps (96 stops round the
// dial). Dragging scrubs `tod`; the loop nudges the handle back as time flows.
const timeWrap = document.createElement('div');
timeWrap.className = 'timewrap';
const timeLabel = document.createElement('span');
timeLabel.className = 'timeval';
timeLabel.textContent = fmtClock(tod);
const timeSlider = document.createElement('input');
timeSlider.type = 'range'; timeSlider.min = '0'; timeSlider.max = '95'; timeSlider.step = '1';
timeSlider.className = 'timeslider';
timeSlider.value = String(Math.round(tod * 96) % 96);
let scrubbing = false;
timeSlider.addEventListener('input', () => {
  tod = (+timeSlider.value) / 96;
  timeLabel.textContent = fmtClock(tod);
});
timeSlider.addEventListener('pointerdown', () => { scrubbing = true; });
const endScrub = () => { scrubbing = false; timeSlider.blur(); };
timeSlider.addEventListener('pointerup', endScrub);
timeSlider.addEventListener('pointercancel', endScrub);
timeWrap.appendChild(timeLabel);
timeWrap.appendChild(timeSlider);
wpanel.appendChild(timeWrap);
// keep the handle in sync as the clock advances (unless you're mid-drag)
function syncTimeSlider() {
  timeLabel.textContent = fmtClock(tod);
  if (scrubbing) return;
  const v = Math.round(tod * 96) % 96;
  if (+timeSlider.value !== v) timeSlider.value = String(v);
}
const PRESETS = [
  { label: '🌤 Summer', key: 'summer', apply: () => { setMonth(6); summerSunHold = 0; weather = 'clear'; } },
  // An immediate clear-sky reset, then automatic weather resumes after a
  // short stable spell so clouds and rain can still develop naturally.
  { label: '☀️ Summer Sun', key: 'summersun', apply: () => {
    setMonth(6); weather = 'clear'; summerSunHold = 45; WX.cloud = 0.02; WX.cond = 'clear';
  } },
  { label: '⛅ Humid', key: 'cloudy', apply: () => { setMonth(6); weather = 'cloudy'; } },
  { label: '❄️ Winter', key: 'winter', apply: () => { setMonth(0); weather = 'clear'; } },
  { label: '☀️ Winter Sun', key: 'sunny', apply: () => { setMonth(0); weather = 'sunny'; } },
  { label: '🌧 Rain', key: 'rain', apply: () => { weather = 'rain'; } },
  { label: '⛈ Storm', key: 'storm', apply: () => { weather = 'storm'; storm.active = true; storm.t = 90 + Math.random() * 120; } },
  { label: '🌨 Light Snow', key: 'snowlight', apply: () => { setMonth(0, false); weather = 'snowlight'; } },
  { label: '❄️ Insane Snow', key: 'snow', apply: () => { setMonth(0, false); weather = 'snow'; } },
  // regional storm front: buried at the low-s end of the map (Chicago on the
  // midwest run), overcast at the other, the wall creeping toward you
  { label: '🌀 Snow Front', key: 'snowfront', apply: () => { setMonth(0, false); weather = 'snowfront'; } },
  { label: '🌪 Rain Front', key: 'rainfront', apply: () => { setMonth(6); weather = 'rainfront'; } },
  // India's version of the sun button: hard summer sun, no cloud drift
  { label: '☀️ Sunny', key: 'sunnyin', apply: () => {
    setMonth(4); weather = 'sunny';
    shower.active = false; storm.active = false; burst.active = false;   // sun means sun
  } },
  { label: '🌧 Monsoon', key: 'monsoon', apply: () => { weather = 'monsoon'; } },
  // India-only rain ladder: drizzle → full desi downpour (no flooding)
  { label: '🌦 Light Rain', key: 'rainlight', apply: () => { weather = 'rainlight'; } },
  { label: '⛈ Heavy Rain', key: 'rainheavy', apply: () => { weather = 'rainheavy'; } },
];
const INDIA_ONLY = new Set(['monsoon', 'rainlight', 'rainheavy', 'sunnyin']);
const US_ONLY = new Set(['cloudy', 'sunny', 'summersun', 'rain', 'storm', 'snow', 'snowlight', 'snowfront']);   // rainfront runs everywhere
// deep-link a weather preset: ?wx=storm|rain|snow|winter|monsoon|…
{
  // same regional gating as the buttons: no ?wx=snow smuggled into Mumbai
  const p = PRESETS.find(p => p.key === q.get('wx'));
  if (p && !(US_ONLY.has(p.key) && INDIAN_MAP) && !(INDIA_ONLY.has(p.key) && !INDIAN_MAP)) p.apply();
  // deep-linking into a snowstorm means it's ALREADY snowed out — seed the
  // packs so the world doesn't start clean and bury itself in front of you
  if (weather === 'snow' || weather === 'snowfront') { worldPack = 1; roadPack = 0.8; }
}
const wBtns = [];
function markWeatherButtons() {
  for (const { btn, p } of wBtns) {
    const on = p.key === 'monsoon' ? weather === 'monsoon'
      : p.key === 'rainlight' ? weather === 'rainlight'
      : p.key === 'rainheavy' ? weather === 'rainheavy'
      : p.key === 'rain' ? weather === 'rain'
      : p.key === 'storm' ? weather === 'storm'
      : p.key === 'snow' ? weather === 'snow'
      : p.key === 'snowlight' ? weather === 'snowlight'
      : p.key === 'snowfront' ? weather === 'snowfront'
      : p.key === 'rainfront' ? weather === 'rainfront'
      : p.key === 'cloudy' ? weather === 'cloudy'
      : p.key === 'summersun' ? (season === 'summer' && weather === 'clear' && summerSunHold > 0)
      : p.key === 'sunnyin' ? (season === 'summer' && weather === 'sunny')
      : p.key === 'sunny' ? (season === 'winter' && weather === 'sunny')
      : p.key === 'winter' ? (season === 'winter' && weather === 'clear')
      : p.key === 'summer' ? (season === 'summer' && weather === 'clear' && summerSunHold <= 0)
      : false;
    btn.classList.toggle('active', on);
  }
}
for (const p of PRESETS) {
  // weather menus differ per region: India gets the monsoon, America gets the rest
  if (INDIA_ONLY.has(p.key) && !INDIAN_MAP) continue;
  if (US_ONLY.has(p.key) && INDIAN_MAP) continue;
  const btn = document.createElement('button');
  btn.textContent = p.label;
  btn.addEventListener('click', () => {
    p.apply();
    markWeatherButtons();
    btn.blur();
  });
  wpanel.appendChild(btn);
  wBtns.push({ btn, p });
}
markWeatherButtons();

// Settled snow is an independent surface toggle, not a weather preset. The
// sky can continue cycling through sun, clouds, rain, and snow while it stays
// enabled; the salt film is deliberately cosmetic and never changes grip.
if (!INDIAN_MAP) {
  const btn = document.createElement('button');
  btn.textContent = '🏔 Recent Snow';
  const mark = () => btn.classList.toggle('active', recentSnow);
  btn.addEventListener('click', () => {
    recentSnow = !recentSnow;
    syncRecentSnowVisuals();
    mark();
    btn.blur();
  });
  wpanel.appendChild(btn);
  syncRecentSnowVisuals();
  mark();
}

function updatePanel(zoneKey) {
  for (const b of panel.children) b.classList.toggle('active', b.dataset.key === zoneKey);
}

// bottom-right license-plate switcher (US maps): swap your car's plate live
const platepanel = document.getElementById('platepanel');
if (!INDIAN_MAP) {
  const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = 'PLATE';
  platepanel.appendChild(lbl);
  // Keep the original USA set and append the four requested state plates.
  // FL was already part of the original set, so it appears only once.
  for (const st of UK ? ['GB', 'FR', 'NL', 'DE'] : (MAP === 'libertia' || MAP === 'i380' || MAP === 'i980' || MAP === 'lb24' || MAP === 'us67') ? ['LIB', 'IA', 'IL', 'MO'] : MAP === 'a1it' ? ['IT', 'FR', 'DE', 'ES'] : MAP === 'swiss' ? ['CH', 'DE', 'FR', 'IT', 'AT'] : EURO ? ['PT', 'ES', 'DE', 'FR', 'NL'] : MAP === 'delhikolkata' ? ['DL', 'UP', 'BR', 'JH', 'WB'] : MAP === 'newdelhi' ? ['DL', 'HR', 'UP', 'PB', 'RJ'] : (MAP === 'india' || MAP === 'nh48' || MAP === 'andheri' || MAP === 'aundh') ? ['MH', 'DL', 'KA', 'GJ'] : MAP === 'nc40' ? ['NC', 'NJ', 'NY', 'MA', 'CT', 'PA', 'VA', 'SC', 'IL', 'IN', 'OH', 'FL', 'TX', 'CA'] : ['NJ', 'NY', 'MA', 'IL', 'IN', 'OH', 'FL', 'TX', 'CA', 'CT']) {
    const btn = document.createElement('button');
    btn.textContent = st;
    btn.classList.toggle('active', player.plateState === st);
    btn.addEventListener('click', () => {
      player.setPlate(st);
      for (const b of platepanel.querySelectorAll('button')) b.classList.toggle('active', b === btn);
      btn.blur();
    });
    platepanel.appendChild(btn);
  }
}

// HUD
const elSpeed = document.getElementById('speed');
const elMeta = document.getElementById('meta');
const elZone = document.getElementById('zone');
const elState = document.getElementById('statebar');
const elClock = document.getElementById('clock');
const elWeather = document.getElementById('weather');

// persistent bottom state banner: reflects the state you're currently in and
// flashes on each state-line crossing.
let shownState = null;
let shownRoute = null;

// Route marker paired with the current state banner. Interstate markers use
// the optional MUTCD state-name field; US routes and the Parkway keep their
// own official marker families instead of being forced into an I-shield.
function hudRouteAt(s) {
  if (MAP === 'bronxriver') {
    if (s < 35000) return { kind: 'brp', number: 'BRP' };
    if (s < 39000) return { kind: 'interstate', number: '278' };
    return { kind: 'interstate', number: '295' };
  }
  const interstate = {
    i95: '95', i287: '287', i278: '278', i80: '80', i78: '78', i280: '280',
    tx45: '45', cal5: '5', i380: '380', i980: '980', nc40: '40',
  }[MAP];
  if (interstate) return {
    kind: 'interstate', number: interstate,
    companion: MAP === 'i95' && s >= 44000 && s < 77000 ? 'njtp' : null,
  };
  if (MAP === 'us1') return { kind: 'us', number: '1' };
  if (MAP === 'us22') return { kind: 'us', number: '22' };
  if (MAP === 'us67') return { kind: 'us', number: '67' };
  if (MAP === 'gsp') return { kind: 'gsp', number: 'GSP' };
  return null;
}

function routeShieldMarkup(route, stateName) {
  if (!route) return '';
  const companion = route.companion === 'njtp'
    ? `<span class="route-shield" aria-label="New Jersey Turnpike"><svg viewBox="0 0 64 64" role="img">
      <path d="M32 3 52.5 10Q61 13 61 24.5 61 43 32 61 3 43 3 24.5 3 13 11.5 10Z" fill="#f4f4f2" stroke="#0b5c37" stroke-width="2.2"/>
      <text x="32" y="24" fill="#0b5c37" text-anchor="middle" font-size="10" font-weight="900">NEW</text>
      <text x="32" y="35" fill="#0b5c37" text-anchor="middle" font-size="10" font-weight="900">JERSEY</text>
      <text x="32" y="46" fill="#0b5c37" text-anchor="middle" font-size="8" font-weight="900">TURNPIKE</text>
    </svg></span>`
    : '';
  if (route.kind === 'gsp') {
    return `${companion}<span class="route-shield" aria-label="Garden State Parkway"><svg viewBox="0 0 64 64" role="img">
      <circle cx="32" cy="32" r="29" fill="#f3c52b" stroke="#fff" stroke-width="2"/>
      <circle cx="32" cy="32" r="24.5" fill="#08723e" stroke="#153e2b" stroke-width="1.5"/>
      <text x="32" y="18" fill="#fff3bd" text-anchor="middle" font-size="6.2" font-weight="800" letter-spacing=".7">GARDEN</text>
      <text x="32" y="28" fill="#fff3bd" text-anchor="middle" font-size="6.2" font-weight="800" letter-spacing=".7">STATE</text>
      <path d="M22 31h20L38 48H26z" fill="#f3c52b" opacity=".95"/>
      <text x="32" y="41" fill="#08723e" text-anchor="middle" font-size="7.2" font-weight="900">PARKWAY</text>
    </svg></span>`;
  }
  if (route.kind === 'brp') {
    return `<span class="route-shield" aria-label="Bronx River Parkway"><svg viewBox="0 0 64 64" role="img">
      <circle cx="32" cy="32" r="29" fill="#fff" stroke="#174d33" stroke-width="2.5"/>
      <circle cx="32" cy="32" r="25" fill="#147044"/>
      <text x="32" y="20" fill="#fff" text-anchor="middle" font-size="6" font-weight="800">BRONX</text>
      <text x="32" y="29" fill="#fff" text-anchor="middle" font-size="6" font-weight="800">RIVER</text>
      <path d="M19 34h26L39 49H25z" fill="#e8c74a"/>
      <text x="32" y="43" fill="#174d33" text-anchor="middle" font-size="6.6" font-weight="900">PARKWAY</text>
    </svg></span>`;
  }
  if (route.kind === 'us') {
    return `${companion}<span class="route-shield" aria-label="U.S. Route ${route.number}"><svg viewBox="0 0 64 64" role="img">
      <path d="M8 8c8 4 16 1 24-3 8 4 16 7 24 3v23c0 15-10 23-24 29C18 54 8 46 8 31z" fill="#fff" stroke="#111" stroke-width="3"/>
      <text x="32" y="20" fill="#111" text-anchor="middle" font-size="8" font-weight="800">U.S.</text>
      <text x="32" y="47" fill="#111" text-anchor="middle" font-size="28" font-weight="900">${route.number}</text>
    </svg></span>`;
  }
  const compactState = stateName.toUpperCase().replace('NORTH CAROLINA', 'N. CAROLINA').replace('SOUTH CAROLINA', 'S. CAROLINA');
  const numberSize = route.number.length >= 3 ? 22 : 27;
  return `${companion}<span class="route-shield" aria-label="Interstate ${route.number}, ${stateName}"><svg viewBox="0 0 64 64" role="img">
    <path d="M6 8c9 4 18 1 26-3 8 4 17 7 26 3v25c0 14-11 22-26 27C17 55 6 47 6 33z" fill="#fff"/>
    <path d="M9 20h46v13c0 12-9 19-23 24C18 52 9 45 9 33z" fill="#164b9b"/>
    <path d="M9 9c8 3 15 1 23-3 8 4 15 6 23 3v12H9z" fill="#c82232"/>
    <text x="32" y="17" fill="#fff" text-anchor="middle" font-size="7" font-weight="800" letter-spacing=".6">INTERSTATE</text>
    <text x="32" y="29" fill="#fff" text-anchor="middle" font-size="5.6" font-weight="800">${compactState}</text>
    <text x="32" y="51" fill="#fff" text-anchor="middle" font-size="${numberSize}" font-weight="900">${route.number}</text>
  </svg></span>`;
}

function updateStateBanner(s) {
  if (!elState) return;
  const code = stateCodeAt(s);
  const info = STATE_INFO[code];
  if (!code || !info) { elState.style.display = 'none'; shownState = null; shownRoute = null; return; }
  const route = hudRouteAt(s);
  const routeKey = route ? `${route.kind}:${route.number}:${route.companion || ''}` : '';
  elState.style.display = 'flex';
  if (code !== shownState || routeKey !== shownRoute) {
    elState.innerHTML = `${routeShieldMarkup(route, info.name)}<span class="statecopy">${info.name}<span class="tag">${info.tag}</span></span>`;
    elState.style.background = info.bg ? `${info.bg}cc` : 'rgba(9,74,44,.72)';
    if (shownState !== null) {           // real crossing, not first paint — flash
      elState.classList.remove('crossing'); void elState.offsetWidth;
      elState.classList.add('crossing');
    }
    shownState = code;
    shownRoute = routeKey;
  }
}

function fmtClock(t) {
  const mins = Math.round(t * 24 * 60) % (24 * 60);
  let h = Math.floor(mins / 60), m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function nextExit(s) {
  let best = null, bestD = Infinity;
  for (const ex of EXITS) {
    let d = loopDelta(s, ex.s) * DIR; // ahead in the direction of travel
    // loopDelta is already converted into displayed/physical distance by
    // DISTANCE_SCALE.  Add a loop in the same units; the old unscaled wrap
    // made Midwest's 5x route report negative mileage and select exits from
    // the far side of the loop.
    if (d < 0) d += LOOP_LENGTH * DISTANCE_SCALE;
    if (d < bestD) { bestD = d; best = ex; }
  }
  return { exit: best, dist: bestD };
}

const clock = new THREE.Clock();
let hudAcc = 0;
const _sunNdc = new THREE.Vector3();
const _sunPx = new THREE.Vector2(0.5, 0.5);
const _camFwd = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  try {
    frameBody();
  } catch (err) {
    // never let one bad frame kill the loop; surface it in the HUD instead
    if (!frame._err) {
      frame._err = true;
      elZone.textContent = 'ERR: ' + err.message + ' :: ' + (err.stack || '').split('\n')[1];
      console.error(err);
    }
  }
}

function frameBody() {
  const dt = Math.min(clock.getDelta(), 0.05);

  tod = (tod + (dt * timeScale) / CLOCK_DAY_LENGTH) % 1;
  syncTimeSlider();
  simTime += dt;

  updateAutoWeather(dt);
  updateStorms(dt);
  const playerZoneKey = zoneAt(player.s).key;
  // dynamic snowpack + rain front → combined traction
  const grip = Math.min(
    updateSnow(dt, playerZoneKey, player.s),
    updateRainFront(dt, playerZoneKey, player.s));
  player.grip = grip;
  updateFog(dt, playerZoneKey);
  const effWeather = effectiveWeather(playerZoneKey);
  const greenery = updateMonsoonGreen(dt, effWeather);
  const nightFactor = updateEnvironment(scene, registry, tod, player.group.position, effWeather, season, worldPack, greenery, month, playerZoneKey, recentSnow ? 0.92 : 0);
  updateClouds(registry, scene, camera.position, simTime, effWeather, nightFactor);
  // electronic travel-time boards: minutes from a smoothed traffic speed
  dmsSpeed += (THREE.MathUtils.clamp(player.v, 13, 31) - dmsSpeed) * Math.min(1, dt * 0.4);
  updateDMS(registry, player.s, dmsSpeed);
  updateNJVms(registry, simTime);   // rotating cheeky NJ message boards
  // wind farm: rotors always turning; aviation lights blink red in unison at night
  updateWindFarm(registry, simTime);
  // Europe movers (the ICE trains shuttling beside the A3)
  if (registry.euroUpdate) registry.euroUpdate(simTime, dt);
  // Chicago movers (CTA in the medians, the 'L' crossings, the South Shore)
  updateChicago(registry, dt);
  if (registry.windmillLights) {
    const on = nightFactor > 0.12 && (simTime % 1.6) < 0.8;
    for (const m of registry.windmillLights) m.opacity = on ? 1 : 0;
  }
  setNightLights(nightFactor);

  // lightning: a hard white flash across sky and light for a few frames — only
  // ever while a storm/monsoon burst is actually running (no stray flashes)
  if (flashT > 0) {
    flashT -= dt;
    if (storm.active || burst.active || (shower.active && shower.thunder)) {
      registry.skyUniforms.uFlash.value = 1;
      registry.hemi.intensity = Math.max(registry.hemi.intensity, 2.2);
    }
  }

  player.update(dt, nightFactor);
  const onCrash = () => player.crash();
  traffic.update(dt, player, tod, onCrash, simTime, nightFactor, grip);
  buddy.update(dt);
  const hour = tod * 24;
  const eveningStreetLife = Math.max(
    Math.exp(-((hour - 19.5) ** 2) / (2 * 3.2 ** 2)),
    Math.exp(-((hour - 22.0) ** 2) / (2 * 2.4 ** 2)),
  );
  const rainingStreetLife = effWeather === 'monsoon' || effWeather === 'rain' || shower.active;
  const streetActivity = INDIAN_MAP
    ? (rainingStreetLife ? 0.42 : 0.92 + 0.30 * eveningStreetLife)
    : 1;
  if (pedestrians) pedestrians.update(dt, player, onCrash, streetActivity);
  if (puneCityPeds) puneCityPeds.update(dt, player, onCrash, streetActivity);
  if (chemburPeds) chemburPeds.update(dt, player, onCrash, streetActivity);
  if (cincyPeds) cincyPeds.update(dt, player, onCrash);
  if (euroPeds) for (const ep of euroPeds) ep.update(dt, player, onCrash);
  if (wrongWay) wrongWay.update(dt, player, onCrash);
  if (metroTrains) updateMetro(metroTrains, simTime);
  if (signalHeads) updateSignals(signalHeads, simTime);
  if (chesterCrossTraffic) chesterCrossTraffic.update(dt, simTime);
  if (i78Terminus) i78Terminus.update(dt, simTime);
  if (us67City) updateUS67CityStreets(us67City, simTime);
  updateRain(dt, playerZoneKey, effWeather);
  updateHonks(dt, playerZoneKey);
  if (q.get('cam') === 'top') {
    // debug: bird's-eye view, travel direction pointing up the screen
    camera.position.copy(player.group.position).add(new THREE.Vector3(0, 120, 0));
    camera.up.set(Math.sin(player.group.rotation.y), 0, Math.cos(player.group.rotation.y));
    camera.lookAt(player.group.position);
  } else {
    chase.update(dt, player);
  }
  updateWipers(dt);
  if (q.get('dbg') === 'cam') {
    const p = camera.position, u = camera.up;
    elZone.textContent = `cam ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} up ${u.x.toFixed(2)},${u.y.toFixed(2)},${u.z.toFixed(2)} fov ${camera.fov.toFixed(1)} far ${camera.far.toFixed(0)} ply ${player.group.position.x.toFixed(1)},${player.group.position.y.toFixed(1)},${player.group.position.z.toFixed(1)}`;
  }

  // fog range: tighter in the city haze, long sightlines elsewhere; closes in at night
  const zone = zoneAt(player.s);
  let baseFar = zone.key === 'cincy' ? 1100
    : zone.key === 'mumbai' || zone.key === 'andheriW' ? 900
    : zone.key.startsWith('p_') ? 900
    : zone.key === 'pune' || zone.key === 'pcmc' ? 1000
    : zone.key === 'bronx' || zone.key === 'newhaven' ? 1300
    : 1600;
  if (effWeather === 'monsoon') baseFar = weather === 'rainlight' ? 650
    : weather === 'rainheavy' ? (burst.active ? 200 : 280)
    : weather === 'rainfront' ? 800 - rainFrontK * 520
    : burst.active ? 240 : 330;
  else if (effWeather === 'rain') baseFar = weather === 'rainfront'
    ? 900 - rainFrontK * (rainFrontStyle === 'hurricane' ? 640 : 560) - floodPack * 60
    : weather === 'storm' ? 380 : 520;
  else if (effWeather === 'cloudy') baseFar = 850;
  else if (effWeather === 'overcast') baseFar = precipMode === 'snow'
    ? (weather === 'snowlight' ? 800
      : weather === 'snowfront' ? 900 - snowFrontK * (snowSquall.active ? 670 : 460)
      : snowSquall.active ? 230 : 440)
    : 750;
  // ground fog / morning mist (all maps): tightens sightlines hard, thickest at
  // dawn; a milky afternoon haze is a gentler drop. The SF marine layer below is
  // a stronger, coast-specific override on top of this.
  if (fog.mist > 0.12 && effWeather !== 'monsoon' && effWeather !== 'rain') {
    baseFar = Math.min(baseFar, 1300 - fog.mist * 950);   // down to ~350 in thick fog
  } else if (haze > 0.12 && (effWeather === 'clear' || effWeather === 'cloudy')) {
    baseFar = Math.min(baseFar, 1600 - haze * 700);
  }
  // San Francisco marine layer: fog rolls in off the bay, thickest near the
  // water and in the mornings/evenings, and drifts through on cloudy periods
  // ("at certain times of the day or whenever"). Tighter fog = mist.
  if (MAP === 'bay') {
    const coastal = ['sf', 'baybridge', 'eastbay', 'oakland', 'richmond', 'vallejo'].includes(zone.key);
    const h = tod * 24;
    const diurnal = Math.max(h < 9 ? (9 - h) / 4 : 0, h > 17 ? (h - 17) / 5 : 0);
    const mist = Math.min(1, (0.30 + 0.7 * WX.cloud) * (coastal ? 1 : 0.35) * (0.35 + 0.95 * diurnal));
    if (mist > 0.15) baseFar = Math.min(baseFar, 1200 - mist * 840);   // down to ~360 in thick fog
  }
  scene.fog.far += ((baseFar * (1 - nightFactor * 0.3)) - scene.fog.far) * Math.min(1, dt * 2);
  scene.fog.near = 60;
  // i80: the distant Manhattan backdrop sits kilometres off the NJ hills, so the
  // camera has to see much farther than the fog; other maps keep the tight range.
  camera.far = scene.fog.far + (MAP === 'i80' || MAP === 'i78' ? 26000 : 4000); // keep skyline/stars visible
  // far NYC skyline (i80): fog-exempt so it reads on the horizon, but its clarity
  // tracks the live fog — crisp on a clear day, washed out when it's hazy — and
  // it lights up at night. Clarity from how far you can otherwise see (baseFar).
  if (registry.farSkylineMats) {
    const clarity = THREE.MathUtils.clamp((baseFar - 650) / 850, 0.1, 1);
    for (const m of registry.farSkylineMats) {
      m.opacity = 0.14 + 0.86 * clarity;
      m.emissiveIntensity = nightFactor * 6.5;
    }
  }

  hudAcc += dt;
  if (hudAcc > 0.12) {
    hudAcc = 0;
    // Europe drives in km/h and signs distance in kilometres
    elSpeed.innerHTML = ((EURO || INDIAN_MAP)
      ? `${Math.round(player.mph * 1.60934)}<span> km/h</span>`
      : `${Math.round(player.mph)}<span> mph</span>`)
      + (player.cruiseV ? '<span> · CRUISE</span>' : '');
    const ne = nextExit(player.s);
    const exitWord = MAP === 'a1' ? 'SAÍDA' : MAP === 'a4' ? 'SALIDA' : MAP === 'a3' ? 'AUSFAHRT' : MAP === 'a16' ? 'SORTIE' : MAP === 'a1it' ? 'USCITA' : MAP === 'swiss' ? (player.s > 292000 ? 'SORTIE' : 'AUSFAHRT') : 'EXIT';
    const exitTag = (ne.exit.num === '' || ne.exit.num == null) ? ''
      : UK ? `J${ne.exit.num} · `
      : `${exitWord} ${ne.exit.num} · `;
    elMeta.textContent = (EURO || INDIAN_MAP)
      ? `${exitTag}${ne.exit.name} — ${(ne.dist / 1000).toFixed(1)} km`
      : `${exitTag}${ne.exit.name} — ${(ne.dist / 1609).toFixed(1)} mi`;
    elZone.textContent = cityAt(player.s) + dirLabelAt(player.s);
    updateStateBanner(player.s);
    updateMinimap(player.s);
    updatePanel(zone.key);
    // midwest straddles a time zone: Chicago + NW Indiana run on Central, the
    // rest (Indy, Cincinnati) on Eastern. The clock jumps an hour at the I-65
    // line near Remington. Base tod is Eastern.
    const central = MAP === 'midwest' && player.s < 64000;
    const tzTod = ((central ? tod - 1 / 24 : tod) + 1) % 1;
    const dst = monthHasWinter && month >= 2 && month <= 10;
    const tz = MAP === 'midwest' ? (central ? (dst ? ' CDT' : ' CST') : (dst ? ' EDT' : ' EST')) : (dst ? ' · DST' : '');
    elClock.textContent = fmtClock(tzTod) + tz + (timeScale > 1 ? '  ⏩' : '');
    elWeather.textContent = weatherReadout(playerZoneKey, effWeather, nightFactor);
  }

  // refresh the sky-reflection env map when the light has moved on (throttled)
  maybeUpdateEnvMap(renderer, registry, simTime);

  // sun lens flare: project the sun onto the screen; fades at frame edges,
  // gated by the same weather visibility the sky dome uses
  let flare = 0;
  const su = registry.skyUniforms;
  camera.getWorldDirection(_camFwd);
  if (su.uSunI.value > 0.05 && _camFwd.dot(su.uSunDir.value) > 0.2) {
    _sunNdc.copy(su.uSunDir.value).multiplyScalar(1500).add(camera.position);
    _sunNdc.project(camera);
    if (Math.abs(_sunNdc.x) < 1.25 && Math.abs(_sunNdc.y) < 1.25) {
      _sunPx.set(_sunNdc.x * 0.5 + 0.5, _sunNdc.y * 0.5 + 0.5);
      const edge = Math.max(Math.abs(_sunNdc.x), Math.abs(_sunNdc.y));
      flare = Math.min(1, su.uSunI.value * 0.7)
        * THREE.MathUtils.clamp(1.15 - edge, 0, 1) * (1 - nightFactor);
    }
  }

  // ?fx=off falls back to plain rendering (also auto-falls-back if the post
  // pipeline itself ever throws)
  if (post && q.get('fx') !== 'off' && !frameBody._postDead) {
    try {
      post.render(scene, camera, { time: simTime, night: nightFactor, sunScreen: _sunPx, flare });
    } catch (err) {
      frameBody._postDead = true;
      console.error('post pipeline disabled:', err);
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
  } else {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
}
frame();
}  // end startRoad
