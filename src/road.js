import * as THREE from 'three';
import {
  MAP, LOOP_LENGTH, BASE_RADIUS, LANE_WIDTH, LANES_MAX, MEDIAN_HALF, SHOULDER,
  ZONES, zoneAt, EXITS, RAMP_LENGTH, DISTANCE_SCALE, wrapS, laneWidthAt,
} from './config.js';
import { registerEnvMaterial } from './sky.js';

const I95 = MAP === 'i95';
const MIDWEST = MAP === 'midwest';
const LIBERTIA = MAP === 'libertia';
const LIBERTIA_ROUTES = LIBERTIA || MAP === 'i380' || MAP === 'i980' || MAP === 'lb24' || MAP === 'us67';
const INDIA = MAP === 'india';
const NH48 = MAP === 'nh48';
const ANDHERI = MAP === 'andheri';
const I287 = MAP === 'i287';
const I278 = MAP === 'i278';
const BRONXRIVER = MAP === 'bronxriver';
const NEWENGLAND = MAP === 'newengland';
const NC40 = MAP === 'nc40';
const I80 = MAP === 'i80';
const I78 = MAP === 'i78';
const I280 = MAP === 'i280';
const US22MAP = MAP === 'us22';
const GSP = MAP === 'gsp';
const ACX = MAP === 'acx'; // Philadelphia → Atlantic City: I-76 · WWB · NJ-42 · AC Expwy
const BAY = MAP === 'bay';
const CAL5 = MAP === 'cal5';
const NYC = MAP === 'nyc';
const CHESTER = MAP === 'chester';
const US1 = MAP === 'us1' || CHESTER;
const TX45 = MAP === 'tx45';
const FLTURNPIKE = MAP === 'flturnpike';
const A1 = MAP === 'a1';    // Portugal: Lisboa → Porto
const A4 = MAP === 'a4';    // Spain: Madrid → Sevilla
const A3 = MAP === 'a3';    // Germany: Frankfurt → Köln
const A16 = MAP === 'a16';  // France: Calais → Paris
const A1IT = MAP === 'a1it'; // Italy: Roma → Napoli
const CH = MAP === 'swiss'; // Switzerland: Interlaken → Genève
const UK = MAP === 'm1';    // Britain: Birmingham → London → Dover
const EURO = A1 || A4 || A3 || A16 || A1IT || CH;
const NEWDELHI = MAP === 'newdelhi';
const DELHIKOLKATA = MAP === 'delhikolkata';
const AUNDH = MAP === 'aundh';   // Aundh–Baner Road, inner Pune
const LHT = INDIA || NH48 || ANDHERI || AUNDH || NEWDELHI || DELHIKOLKATA || UK; // left-hand traffic maps

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Centerline: a wobbly closed loop. Everything is a periodic function of s,
// so s = LOOP_LENGTH wraps seamlessly onto s = 0.
// ---------------------------------------------------------------------------

// Smooth 0..1 window over wrapped s with cosine ramps.
function windowFn(s, rise0, rise1, fall0, fall1) {
  s = wrapS(s);
  if (s <= rise0 || s >= fall1) return 0;
  if (s < rise1) return 0.5 - 0.5 * Math.cos(Math.PI * (s - rise0) / (rise1 - rise0));
  if (s <= fall0) return 1;
  return 0.5 + 0.5 * Math.cos(Math.PI * (s - fall0) / (fall1 - fall0));
}

// Rockies rise well inside the Colorado zone so no mountains are ever
// visible from the Indiana flats.
export function mountainWeight(s) {
  if (CAL5) {
    return 0.95 * windowFn(s, 70000, 90000, 150000, 160000)
      + 0.8 * windowFn(s, 390000, 410000, 470000, 485000);
  }
  return 0;
}

export function flatWeight(s) {
  if (DELHIKOLKATA) return 0.88;
  // Libertia is an intentionally broad, table-flat Midwestern state.
  if (LIBERTIA) return 1;
  // NYC + Long Island: flat river cities and coastal plain, no rolling relief
  if (NYC) return 1;
  if (BRONXRIVER) return s < 20000 ? 0.08 : s < 35000 ? 0.32 : 0.9;
  if (I78) return s < 215000 ? 0.18 : 1;
  // US-1 NJ: coastal-plain arterial, essentially flat and straight the whole way
  if (CHESTER) return 0.22;
  if (US1) return 1;
  // Staten Island/Brooklyn/Queens are coastal-plain boroughs; the notable
  // vertical moments are the bridge decks, not natural relief.
  if (I278) return 1;
  // I-45 traverses a mostly flat Texas coastal-plain corridor; the Dallas
  // approach has gentle North Texas rolling ground rather than Northeast hills.
  if (TX45) return 0.55;
  // Florida's Turnpike is exceptionally flat, with only subtle central-Florida
  // undulation and no meaningful mountain relief.
  if (FLTURNPIKE) return 0.9;
  // I-5 is flat through the Central Valley, but not on the LA/Tejon or
  // Pacheco mountain approaches.
  if (CAL5) return 0.72 * windowFn(s, 150000, 165000, 382000, 397000);
  // GSP south of the Driscoll: the outer coastal plain — the shore run and the
  // Pine Barrens are table-flat and much straighter than the curvy northern half
  if (GSP) return 0.6 * windowFn(s, 0, 3000, 160000, 174000);
  // the AC Expressway is the flattest, straightest road in the state — an
  // arrow through the pines; only the Philly end has any wiggle
  if (ACX) return windowFn(s, 9500, 13000, 94000, 95800);
  // dead-flat, dead-straight farmland: I-65 south of Merrillville and the
  // I-74 farm country east of Indianapolis
  return MIDWEST
    ? windowFn(s, 300, 2000, 30000, 38000)        // I-294/Southland → Skyway flat metro plain
      + windowFn(s, 30000, 38000, 77500, 79000)   // smooth Borman/Gary → I-65 Indiana plain
      + windowFn(s, 95500, 97000, 109500, 111000) // I-74 farm country
    : I80
    ? windowFn(s, 182000, 186000, 259000, 261000) // Toledo flats → IN Toll Rd → Chicago Southland
      + windowFn(s, 164000, 167000, 180000, 182000) * 0.7 // Lake Erie plain at Cleveland
    : A4
    ? windowFn(s, 42000, 50000, 195000, 205000)   // La Mancha meseta: table-flat
      + windowFn(s, 275000, 285000, 525000, 529000) * 0.85 // Guadalquivir valley plains
    : A1
    ? windowFn(s, 12000, 16000, 56000, 60000) * 0.9 // Lezíria do Tejo floodplain
      + windowFn(s, 205000, 210000, 258000, 262000) * 0.9 // Bairrada / Ria de Aveiro lowlands
    : A16
    ? windowFn(s, 85000, 90000, 118000, 124000) * 0.9 // the flat Somme valley
    : UK
    ? windowFn(s, 55000, 60000, 115000, 120000) * 0.7 // Midlands plain
    : CH
    ? windowFn(s, 168000, 176000, 208000, 214000) * 0.6   // Aargau Mittelland
      + windowFn(s, 356000, 362000, 388000, 394000) * 0.55 // Léman shore run to Genève
    : 0;
}

// European relief. Portugal: the limestone Serra d'Aire at Fátima and the
// Feira/Gaia hills before the Douro. Spain: the Despeñaperros gorge over the
// Sierra Morena — the one real mountain pass between the meseta and Andalucía.
// Germany: the wooded Taunus and Westerwald low mountain ranges the A3 rides
// over, plus the Siebengebirge above the Rhine. 0..1 weight.
export function euroReliefAt(s) {
  if (A1) {
    return 0.55 * windowFn(s, 82000, 92000, 112000, 122000)    // Serra d'Aire at Fátima
      + 0.3 * windowFn(s, 146000, 154000, 178000, 186000)      // Pombal → Coimbra hills
      + 0.5 * windowFn(s, 260000, 268000, 284000, 290000);     // Feira → Gaia hills
  }
  if (A4) {
    return 1.0 * windowFn(s, 205000, 215000, 245000, 255000)   // Despeñaperros (tall gorge)
      + 0.35 * windowFn(s, 245000, 252000, 268000, 278000)     // Sierra Morena southern slope
      + 0.2 * windowFn(s, 465000, 475000, 498000, 508000);     // Carmona's low Alcores ridge
  }
  if (A3) {
    return 0.65 * windowFn(s, 22000, 28000, 44000, 50000)      // Taunus climb at Idstein
      + 0.75 * windowFn(s, 62000, 70000, 112000, 120000)       // Westerwald plateau
      + 0.5 * windowFn(s, 114000, 120000, 130000, 135000);     // Siebengebirge
  }
  if (UK) {
    return 0.3 * windowFn(s, 120000, 128000, 146000, 152000)   // Chiltern edge at Luton
      + 0.5 * windowFn(s, 245000, 255000, 298000, 306000)      // Kent / North Downs
      + 0.4 * windowFn(s, 306000, 310000, 317000, 320000);     // chalk above Dover
  }
  if (A16) {
    return 0.5 * windowFn(s, 14000, 20000, 55000, 62000)       // Boulonnais hills, Côte d'Opale
      + 0.25 * windowFn(s, 150000, 158000, 235000, 242000);    // rolling Picardie plateau
  }
  if (A1IT) {
    return 0.35 * windowFn(s, 15000, 25000, 100000, 110000)    // Valle Latina between the ridges
      + 0.95 * windowFn(s, 108000, 118000, 158000, 166000)     // Cassino → San Vittore Apennine pinch
      + 0.25 * windowFn(s, 166000, 174000, 196000, 202000);    // alta Campania rolling
  }
  if (CH) {
    // Switzerland is the most vertical map by far: the Berner Oberland climbs
    // straight into the Jungfrau wall, the Brünig is a real pass, then the
    // pre-Alps around the lakes, the flatter Mittelland, and the Fribourg
    // pre-Alps rising again toward the Léman.
    return 1.0 * windowFn(s, 800, 12000, 40000, 54000)         // Berner Oberland (the giants)
      + 0.9 * windowFn(s, 38000, 46000, 56000, 64000)          // Brünig pass
      + 0.55 * windowFn(s, 60000, 68000, 112000, 120000)       // Pilatus / Rigi over the lakes
      + 0.2 * windowFn(s, 150000, 160000, 205000, 214000)      // Mittelland swells
      + 0.45 * windowFn(s, 250000, 260000, 288000, 296000)     // Fribourg pre-Alps (Röstigraben)
      + 0.6 * windowFn(s, 300000, 312000, 402000, 408000);     // Lavaux terraces + Alps across the Léman
  }
  return 0;
}

// Tall Pennsylvania / NW-Jersey Appalachians on I-80: the Water Gap ridge, the
// Poconos, the long PA ridge-and-valley, and the high Allegheny plateau. 0..1.
export function appalachianAt(s) {
  if (I78) return 0.48 * windowFn(s, 0, 1200, 18000, 24000)
    + 0.85 * windowFn(s, 18000, 25000, 62000, 68000)
    + 0.46 * windowFn(s, 60000, 66000, 119000, 125000);
  return I80
    ? 0.6 * windowFn(s, 24000, 28000, 38000, 42000)     // NJ Delaware Water Gap
      + 1.0 * windowFn(s, 42000, 48000, 110000, 116000) // Poconos + PA ridges (tall)
      + 0.5 * windowFn(s, 116000, 120000, 144000, 148000) // Allegheny plateau (high, rolling)
    : 0;
}

// Western Ghats on the Mumbai–Pune Expressway: a long, high climb over the
// Sahyadri range with steep forested rock walls on either side.
export function ghatWeight(s) {
  if (NH48) return 0.95 * windowFn(s, 65000, 82000, 158000, 172000);
  return INDIA ? windowFn(s, 42000, 46000, 79000, 82000) : 0;
}

// New England low mountains: the traprock ridges beside I-91, the wooded CT
// hills on I-84, and the central-Massachusetts uplands the Mass Pike rolls
// over before dropping to the coast at Boston. 0..1 relief weight.
export function neReliefAt(s) {
  if (I95) {
    return 0.5 * windowFn(s, 0, 1800, 29200, 31500)        // wooded Connecticut shoreline
      + 0.72 * windowFn(s, 30000, 31500, 35600, 36500);    // rolling Westchester Sound shore
  }
  return NEWENGLAND
    ? 0.55 * windowFn(s, 4500, 7000, 14000, 16000)         // Meriden traprock (I-91)
      + 0.7 * windowFn(s, 24000, 27000, 46000, 49000)      // CT hills → central MA
    : 0;
}

// I-287 climbs into the NJ Appalachian highlands through Morris county and the
// Ramapo mountains near the NY line, staying hilly across Rockland before it
// drops to the Hudson at the Tappan Zee. 0..1 relief weight.
export function njHighlandsAt(s) {
  if (I287) {
    return 0.5 * windowFn(s, 33000, 39000, 49000, 53000)     // Morris hills (rolling)
      + 0.9 * windowFn(s, 50000, 56000, 86000, 90000)        // Ramapo Mtns → Rockland (tall)
      + 0.58 * windowFn(s, 97000, 99000, 118000, 121000);    // Tarrytown / I-87 Westchester hills
  }
  // I-80 climbs out of the flat Hackensack valley into the rolling NJ Highlands
  // through Passaic/Morris/Sussex (Wayne → Parsippany → Rockaway → Netcong)
  // before the Water Gap ridge (appalachianAt) takes over west of ~24k.
  if (I80) return 0.55 * windowFn(s, 10500, 15000, 21500, 25000);
  if (I78) return 0.75 * windowFn(s, 125000, 135000, 175000, 182000)
    + 0.95 * windowFn(s, 175000, 184000, 210000, 218000);
  if (I280) return 0.65 * windowFn(s, 9000, 13000, 25000, 29000) + 0.75 * windowFn(s, 26000, 30000, 39000, 42000);
  if (US22MAP) return 0.55 * windowFn(s, 9000, 14000, 30000, 35000);
  return 0;
}

// SE Indiana hills: green wooded relief climbing away from I-74 before the
// drop into the Ohio valley at Cincinnati.
export function cincyWeight(s) {
  return MIDWEST
    ? windowFn(s, 108000, 113500, 122500, 126000) * 0.75
      + windowFn(s, 121000, 124000, 132000, 134000) * 0.55
    : 0;
}

// Big rolling hills across the SE Indiana / SW Ohio ridge line on I-74;
// the road climbs and falls before descending toward downtown Cincinnati.
export function cincyHillAt(s) {
  return MIDWEST
    ? windowFn(s, 108000, 114000, 122000, 126000) * (30 + 12 * Math.sin(TAU * wrapS(s) / 3400 + 1.1))
      + windowFn(s, 121000, 125000, 132000, 134000) * (24 + 10 * Math.sin(TAU * wrapS(s) / 2900 + 0.6))
    : 0;
}

// NJ Turnpike roadway separations:
//  - Eastern/Western spur: straight off the GWB the turnpike forks into two
//    widely separated roadways that ride the Meadowlands on separate elevated
//    decks for miles, rejoining just north of Newark Airport. Northbound the
//    two spurs come together right at the bridge approach.
//  - Dual-dual: from Newark all the way down to Bordentown (where I-95 becomes
//    the Turnpike), inner cars-only / outer cars-trucks-buses with a barrier
//    between them (the classic turnpike arrangement).
export function njGapAt(s) {
  // GSP local/express: from Exit 105 (Eatontown) up to the Driscoll Bridge
  // approach, each direction splits into 3 express + 2 local lanes with a wide
  // grass-and-trees strip between the carriageways.
  if (GSP) return 12 * windowFn(s, 169200, 170400, 202000, 203200);
  // Chicago: the Kennedy express/local (reversible median lanes) and the
  // Dan Ryan's famous 14-lane dual-dual, express + local each direction
  if (MIDWEST) return 8 * windowFn(s, 4300, 5400, 14800, 15700)
    + 10 * windowFn(s, 24300, 25400, 32900, 33800);
  // Libertia Turnpike: three local + two express lanes in each direction
  // through the Reston metro, with a wide NJ-style median separation.
  if (LIBERTIA) return 10 * windowFn(s, 390000, 398000, 622000, 630000);
  if (!I95) return 0;
  return 5 * windowFn(s, 52700, 53500, 72000, 72800)    // dual-dual: Newark → Bordentown
    // Northern Virginia 95 Express Lanes: barrier-separated express (inner) +
    // local (outer) carriageways through NoVA, up toward the Springfield
    // interchange. Same dual-dual machinery as the NJ Turnpike above.
    + 6 * windowFn(s, 312000, 313500, 322500, 324000);
}

// ---------------------------------------------------------------------------
// NJ Turnpike Eastern/Western spurs — TWO SEPARATE TWO-WAY HIGHWAYS. Each spur
// is a complete dual carriageway (3 lanes each direction around its own
// barrier median). They fork just south of the GWB toll, ride the Meadowlands
// on separate elevated decks, and rejoin north of Newark. Unlike the dual-dual
// (same-direction inner/outer), both spurs carry BOTH bounds.
//
// Lane bookkeeping: lanes 0-2 of each direction ride the WESTERN spur
// (centered at lat -SPUR.g), lanes 3-5 the EASTERN spur (+SPUR.g). Two of the
// four lane groups have to cross the centerline at each fork; they do it on
// stacked flyover decks (spurRiseAt) so nothing meets head-on.
// ---------------------------------------------------------------------------
export const SPUR = { g: 26, m: 2.0 };   // spur center offset / spur median half
export function spurTAt(s) {
  return I95 ? windowFn(s, 45000, 46600, 51000, 52400) : 0;
}
// the two crossing groups blend on a slightly inset window (inside the throat)
export function spurCrossT(s) {
  return I95 ? windowFn(s, 45150, 46450, 51150, 52350) : 0;
}
// flyover deck heights: the two crossing carriageways stack over the at-grade
// fork (top deck clears the lower by ~5.5 m, lower clears grade traffic)
const SPUR_RISE_HI = 11, SPUR_RISE_LO = 5.5;
export function spurRiseAt(s, dir, lane) {
  if (!I95) return 0;
  const hi = dir > 0 && lane >= 2.5;    // +s lanes 3-5 cross to the eastern spur
  const lo = dir < 0 && lane < 2.5;     // -s lanes 0-2 cross to the western spur
  if (!hi && !lo) return 0;
  const t = spurCrossT(s);
  if (t <= 0 || t >= 1) return 0;       // at grade on both sides of the crossing
  const lift = Math.sin(t * Math.PI);
  return (hi ? SPUR_RISE_HI : SPUR_RISE_LO) * lift * lift;
}
// lat of a lane in the fully-split spur cross-section
function spurTargetLat(dir, lane) {
  const { g, m } = SPUR;
  if (dir > 0) {
    return lane < 3 ? -(g + m + LANE_WIDTH * (lane + 0.5))       // W spur, outer half
                    :  (g - m - LANE_WIDTH * (lane - 3 + 0.5));  // E spur, inner half
  }
  return lane < 3 ? -(g - m - LANE_WIDTH * (lane + 0.5))         // W spur, inner half
                  :  (g + m + LANE_WIDTH * (lane - 3 + 0.5));    // E spur, outer half
}

// The cars-ONLY inner roadway exists only on the dual-dual (Newark → Bordentown).
// The Eastern/Western spurs north of Newark carry trucks and buses on BOTH
// roadways, so trucks are free to ride either spur up there — this returns 0
// across the spur section and >0 only through the dual-dual.
export function njDualDualAt(s) {
  // NJ Turnpike dual-dual + the NoVA 95 Express/Local split — both keep trucks
  // in the outer (local) lanes
  return I95 ? windowFn(s, 52700, 53500, 72000, 72800)
    + windowFn(s, 312000, 313500, 322500, 324000) : 0;
}

// GWB double deck: how far the lower level sits below the upper roadway.
export function gwbLowerDrop(s) {
  return I95 ? 6.5 * windowFn(s, 43640, 43800, 44200, 44360) : 0;
}

// Bridge decks per map.
// i95: GWB (Hudson) + Newark Bay Extension viaduct + Raritan + Delaware
// world: Vashi Creek (Mumbai→Navi Mumbai)
export function bridgeBumpAt(s) {
  if (BRONXRIVER) {
    return 10 * windowFn(s, 34800, 35200, 38600, 39000)   // Bruckner viaduct
      + 8 * windowFn(s, 39000, 39700, 40500, 41000)       // I-295 approach structures
      + 22 * windowFn(s, 40500, 41400, 44100, 44800)      // Throgs Neck Bridge
      + 5 * windowFn(s, 48600, 48900, 49800, 50100)       // I-495 interchange
      + 4 * windowFn(s, 50900, 51200, 51800, 52100);      // GCP / Union Turnpike decks
  }
  if (DELHIKOLKATA) {
    return 8 * windowFn(s, 36000, 37500, 39000, 40500)
      + 11 * windowFn(s, 510000, 512500, 518000, 520500)
      + 8 * windowFn(s, 742000, 744000, 749000, 751000)
      + 10 * windowFn(s, 1128000, 1130500, 1136500, 1139000)
      + 9 * windowFn(s, 1477000, 1479500, 1485000, 1487500);
  }
  if (I78) {
    return 10 * windowFn(s, 110000, 111500, 116500, 118000) // Delaware River / I-78 Toll Bridge
      + 10 * windowFn(s, 214500, 216000, 258700, 259350)    // elevated Hudson approach, short descent to grade
      + 13 * windowFn(s, 237500, 239000, 246000, 247500);   // Newark Bay bridge rise
  }
  if (I95) {
    return 18 * windowFn(s, 42900, 43550, 44450, 45000) // Cross-Bronx/Fort Lee approaches + GWB
         + 7 * windowFn(s, 45900, 46700, 50900, 51700)   // Meadowlands spur decks
         + 5 * windowFn(s, 51600, 51900, 53800, 54400)   // Newark merge / EWR interchange structures
         + 6 * windowFn(s, 54700, 55000, 55900, 56300)   // Elizabeth industrial viaduct / rail crossings
         + 4.5 * windowFn(s, 56900, 57200, 57700, 58100) // Linden / Rahway industrial crossings
         + 5 * windowFn(s, 59000, 59300, 59800, 60200)   // Woodbridge interchange and creek
         + 8 * windowFn(s, 60900, 61250, 61550, 61900)
         + 4 * windowFn(s, 62600, 62900, 63300, 63700)   // Edison local-road / rail deck
         + 4 * windowFn(s, 64900, 65200, 65600, 66000)   // Edison short raised crossing
         + 6 * windowFn(s, 69800, 70400, 72000, 72700)   // raised cars/trucks Turnpike connectors
         + 15 * windowFn(s, 75600, 76500, 78200, 79000)   // Delaware River Turnpike bridge + long approaches
         + 10 * windowFn(s, 78800, 80000, 87500, 89500)   // urban/Northeast viaduct, then drop to suburban approach
         + 5 * windowFn(s, 204000, 205500, 210000, 211500) // Baltimore north industrial viaduct
         + 6 * windowFn(s, 213000, 214500, 219000, 220500) // downtown/port approach structures
         + 5 * windowFn(s, 225000, 226000, 230000, 231500) // south tunnel approach viaduct
         + 5 * windowFn(s, 270800, 271600, 273400, 274200) // US-50 / New Carrollton bridge complex
         + 5 * windowFn(s, 287300, 288100, 289700, 290500) // Suitland / Andrews crossing
         + 7 * windowFn(s, 299600, 300600, 304200, 305200) // I-295 / MD-210 multi-level approach
         + 15 * windowFn(s, 306300, 307800, 310300, 311700) // Woodrow Wilson Bridge
         + 8 * windowFn(s, 311200, 312600, 322900, 324500) // Springfield Mixing Bowl stacks
         + 6 * windowFn(s, 107200, 107600, 108000, 108400)   // Providence River
         + 12 * windowFn(s, 121300, 121800, 122400, 122900); // Gold Star Br, New London (Thames)
  }
  if (NC40) {
    return 8 * windowFn(s, 108000, 108250, 108750, 109000)      // Neuse River
      + 7 * windowFn(s, 201100, 201350, 201650, 201900)          // Greensboro urban viaduct
      + 9 * windowFn(s, 278000, 278300, 278800, 279100)          // Yadkin River
      + 7 * windowFn(s, 318100, 318350, 318700, 318950);         // Charlotte approach
  }
  if (NYC) {
    return 12 * windowFn(s, 250, 500, 2500, 3000)   // George Washington Bridge
      + 4 * windowFn(s, 8500, 8700, 9200, 9400)     // High Bridge crossing
      + 8 * windowFn(s, 17550, 17850, 18400, 18700); // Queensboro Bridge
  }
  // Chicago → I-65: the real south-side sequence is Dan Ryan → Bishop Ford →
  // I-80/94 Borman → I-65, not an O'Hare/Skyway detour.  Chicago alternates
  // between depressed/at-grade roadway and long urban structures over streets,
  // rail corridors, the Calumet industrial belt and the Borman interchanges.
  if (MIDWEST) {
    return 5.5 * windowFn(s, 1200, 1900, 5200, 5900)      // Dan Ryan urban structure
      + 4.5 * windowFn(s, 9800, 10500, 13200, 14000)      // south-side rail/street deck
      + 6.0 * windowFn(s, 16600, 17400, 21500, 22400)     // Bishop Ford structures
      + 8.0 * windowFn(s, 25800, 27000, 32600, 33700)     // Calumet / IL-394 approach
      + 6.5 * windowFn(s, 34800, 35700, 40100, 41000)     // Hammond urban viaduct
      + 5.0 * windowFn(s, 42600, 43400, 46200, 47000)     // Borman interchange decks
      + 7.5 * windowFn(s, 46700, 47400, 49300, 50100)     // I-65 collector/distributor stack
      + 4.5 * windowFn(s, 79800, 80400, 82600, 83300)     // I-65/I-465 northwest stack
      + 5.0 * windowFn(s, 85500, 86200, 88500, 89200)     // west/south Indy bridge run
      + 4.0 * windowFn(s, 91400, 92000, 94000, 94600)     // I-74 bypass handoff
      + 4.5 * windowFn(s, 127400, 128000, 130200, 130900) // Cincinnati west-side structures
      + 8.5 * windowFn(s, 132400, 133000, 137000, 137800) // I-74/I-75 stack
      + 4.5 * windowFn(s, 139000, 139700, 144800, 145600);// Mill Creek viaducts
  }
  if (INDIA) return 12 * windowFn(s, 32080, 32520, 32680, 33120);
  if (GSP) {
    return 9 * windowFn(s, 43200, 44000, 45200, 46000)      // Great Egg Harbor Bay spans
         + 7 * windowFn(s, 78300, 78800, 79300, 79800)      // Mullica River, Pine Barrens
         + 5 * windowFn(s, 132600, 132900, 133200, 133500)  // Toms River
         + 16 * windowFn(s, 203300, 203900, 204700, 205300) // DRISCOLL BRIDGE · Raritan
         + 6 * windowFn(s, 250600, 251000, 251400, 251800); // Passaic River, Clifton
  }
  if (I278) {
    return 11 * windowFn(s, 8500, 9500, 13000, 14000)      // Outerbridge Crossing
      + 38 * windowFn(s, 31500, 32700, 37300, 38500)       // Verrazzano deck
      + 9 * windowFn(s, 38000, 39000, 55000, 56000)        // Gowanus / Brooklyn BQE
      + 14 * windowFn(s, 56000, 57100, 59900, 61000)       // Kosciuszko Bridge
      + 9 * windowFn(s, 61000, 62000, 72000, 73000)        // Queens BQE
      + 14 * windowFn(s, 72500, 73800, 78200, 79500)       // RFK / Triborough
      + 8 * windowFn(s, 79000, 80000, 89000, 90000);       // Bronx Bruckner deck
  }
  // Philadelphia → AC: the Walt Whitman Bridge over the Delaware, then the low
  // viaduct over the tidal marsh on the Atlantic City approach.
  if (ACX) {
    return 15 * windowFn(s, 7300, 7650, 8350, 8700)
         + 4 * windowFn(s, 93600, 93900, 94600, 94900);
  }
  // US-1: the Raritan River bridge at New Brunswick, then the long high Pulaski
  // Skyway riding over the Passaic/Hackensack Meadowlands into Jersey City.
  if (US1) {
    return 7 * windowFn(s, 18400, 18800, 19200, 19600)     // Raritan River
         + 20 * windowFn(s, 45200, 46000, 47200, 47800);   // Pulaski Skyway deck
  }
  // Bay Area: the long Bay Bridge over the bay, the Benicia and Carquinez
  // bridges over the Carquinez Strait up north.
  if (BAY) {
    return 14 * windowFn(s, 6400, 7400, 10600, 11600)   // San Francisco–Oakland Bay Bridge
         + 8 * windowFn(s, 59300, 59800, 60200, 60700)  // Benicia–Martinez Bridge (I-680)
         + 8 * windowFn(s, 71800, 72300, 72800, 73300); // Carquinez Bridge (I-80)
  }
  // New England: I-91 over the Connecticut River at Hartford; the Pike over
  // the Charles into Boston.
  if (NEWENGLAND) {
    return 9 * windowFn(s, 15700, 16100, 16500, 16900)
         + 7 * windowFn(s, 52600, 53000, 53400, 53800);
  }
  // I-80: natural crossings plus the short viaducts that define North Jersey,
  // the industrial Calumet/Gary approach and Chicago's south-suburban corridor.
  if (I80) {
    return 6 * windowFn(s, 1500, 1800, 4100, 4400)
         + 7 * windowFn(s, 5300, 5600, 9100, 9400)
         + 5 * windowFn(s, 10100, 10400, 12800, 13100)
         + 4 * windowFn(s, 15300, 15600, 16900, 17200)
         + 4 * windowFn(s, 19500, 19800, 21000, 21300)
         + 10 * windowFn(s, 36400, 36800, 37600, 38000)
         + 4 * windowFn(s, 48200, 48600, 49600, 50000)
         + 5 * windowFn(s, 117700, 118100, 120700, 121100)
         + 4 * windowFn(s, 150500, 150900, 152300, 152700)
         + 7 * windowFn(s, 170600, 171000, 171600, 172000)
         + 4 * windowFn(s, 187900, 188300, 189600, 190000)
         + 5 * windowFn(s, 206600, 207000, 208700, 209100)
         + 5 * windowFn(s, 219800, 220200, 222000, 222400)
         + 6 * windowFn(s, 228100, 228400, 231300, 231700)
         + 6 * windowFn(s, 232700, 233000, 236200, 236600)
         + 6 * windowFn(s, 237700, 238000, 241100, 241500)
         + 5 * windowFn(s, 243700, 244000, 246700, 247100)
         + 5 * windowFn(s, 250700, 251000, 253600, 254000);
  }
  // I-287: the long high Tappan Zee (Mario Cuomo) Bridge over the Hudson, and
  // the George Washington Bridge approach at the Bronx/NJ line.
  if (I287) {
    return 22 * windowFn(s, 90600, 92200, 95600, 97000)
         + 9 * windowFn(s, 129900, 130500, 131300, 131900);
  }
  // Andheri: the Sahar airport flyover, then the Bandra–Worli Sea Link riding
  // high over the Arabian Sea.
  if (ANDHERI) {
    return 9 * windowFn(s, 21100, 21800, 23300, 23850)
         + 13 * windowFn(s, 28300, 29300, 31700, 32700);
  }
  // A1 Portugal: the high Ponte da Arrábida arch over the Douro into Porto.
  if (A1) return 15 * windowFn(s, 296200, 296800, 297600, 298200);
  // A-4 Spain: the Guadalquivir crossing at Córdoba.
  if (A4) return 6 * windowFn(s, 396800, 397200, 397700, 398100);
  // A3 Germany: the Lahntalbrücke viaduct at Limburg, the Wiedtalbrücke in the
  // Westerwald — the A3's famous tall valley viaducts.
  if (A3) {
    return 13 * windowFn(s, 57200, 57900, 58800, 59500)
         + 10 * windowFn(s, 103500, 104100, 104900, 105500);
  }
  // Britain: the Thames crossing in central London, the Medway viaduct on the M20.
  if (UK) {
    return 8 * windowFn(s, 179600, 180000, 180500, 180900)
         + 11 * windowFn(s, 236400, 236900, 237600, 238100);
  }
  // France: the Somme crossing below Abbeville, the Oise at L'Isle-Adam.
  if (A16) {
    return 6 * windowFn(s, 97700, 98100, 98500, 98900)
         + 7 * windowFn(s, 254600, 255000, 255500, 255900);
  }
  // Italy: the Liri crossing at Ceprano, the Volturno at Capua.
  if (A1IT) {
    return 5 * windowFn(s, 93600, 94000, 94400, 94800)
         + 6 * windowFn(s, 183600, 184000, 184500, 184900);
  }
  return 0;
}

// Extra-wide paved shoulders on the turnpike — I-95 scale
export function njShoulderAt(s) {
  return I95 ? 2.6 * windowFn(s, 45700, 46300, 75700, 76300) : 0;
}

// Median half-width: 4 m divided highway everywhere except Cincinnati,
// which is a normal American street — just a double yellow line down
// the middle, opposing lanes right beside each other.
export function medianHalfAt(s) {
  if (BRONXRIVER) {
    // The old parkway is intimate: a narrow planted divider becomes a tight
    // barrier in the Bronx; the modern expressways use a concrete median.
    if (s < 20000) return 2.25;
    if (s < 35000) return 1.35;
    return 1.15;
  }
  if (I78 && s >= 266500 && s < 275000) {
    // The Holland Tunnel empties onto a compact Manhattan surface street,
    // not another divided expressway. Opposing lanes share a painted center.
    return 0.35;
  }
  if (DELHIKOLKATA) {
    const urban = Math.max(
      windowFn(s, 0, 4000, 30000, 35000),
      windowFn(s, 280000, 295000, 375000, 390000),
      windowFn(s, 505000, 515000, 560000, 575000),
      windowFn(s, 1460000, 1480000, 1530000, 1530000),
    );
    return 0.15 + 2.05 * urban;
  }
  if (ANDHERI) {
    // token painted divider on the chaotic inner roads, opening to a proper
    // median once it becomes the modern South Mumbai coastal road
    const sobo = windowFn(s, 23600, 24600, 51400, 52000); // Bandra → Nariman Pt
    return MEDIAN_HALF - 3.2 * (1 - sobo);
  }
  if (AUNDH) {
    // narrow local roads run knee-high divider blocks (built in pune.js) on a
    // sliver of a median; only Baner Road / Balewadi High Street get a real
    // kerbed median
    const wide = windowFn(s, 11700, 12500, 20500, 21300);
    return 0.9 + 1.6 * wide;
  }
  if (GSP) {
    // Garden State Parkway median, the real mix: broad grass most of the way,
    // widening into a WOODED median through the Pine Barrens and hugely through
    // the Bergen highlands (trees hide the far carriageway), and pinching to a
    // concrete barrier over the big bridges (Great Egg, Mullica, Driscoll).
    const m = MEDIAN_HALF + 5
      + 9 * windowFn(s, 66000, 74000, 104000, 112000)      // Pine Barrens wooded median
      + 6 * windowFn(s, 118000, 126000, 148000, 156000)    // Ocean county wide grass
      + 8 * windowFn(s, 198000, 198800, 199700, 200500)    // Jon Bon Jovi SA sits in the median
      + 8 * windowFn(s, 229700, 230300, 230900, 231500)    // Vauxhall SA median
      + 13 * windowFn(s, 253000, 261000, 273000, 279000);  // Bergen highlands
    const pinch = Math.max(
      windowFn(s, 42800, 43600, 45600, 46400),             // Great Egg bay decks
      windowFn(s, 78100, 78700, 79400, 80000),             // Mullica
      windowFn(s, 202400, 203200, 205400, 206200));        // Driscoll Bridge
    return m * (1 - pinch) + 1.6 * pinch;
  }
  if (I80) {
    // Much of rural Pennsylvania carries the two roadways on separated grades
    // with a genuinely planted median. These alternating forest bands are wide
    // enough for mature crowns without letting foliage intrude into either
    // inside lane; the gaps preserve interchanges and occasional opposing-road
    // views.
    const forest = Math.max(
      windowFn(s, 42600, 43800, 55800, 57000),
      windowFn(s, 59800, 61000, 77800, 79000),
      windowFn(s, 82800, 84000, 106800, 108000),
      windowFn(s, 114800, 116000, 140800, 142000),
    );
    return MEDIAN_HALF + 4.5 * forest;
  }
  if (MAP === 'us1') {
    // Mercer/Middlesex alternates between grass and curbed medians; industrial
    // 1&9 tightens to barrier width and the Pulaski deck pinches almost away.
    const suburban = 2.8 * windowFn(s, 2600, 4200, 10200, 11400)
      + 1.2 * windowFn(s, 10800, 12500, 28600, 30000);
    const pinch = windowFn(s, 43800, 45000, 47700, 48600);
    return (2.0 + suburban) * (1 - pinch) + 0.78 * pinch;
  }
  if (CHESTER) return 2.3; // preserve the compact West Chester divider
  if (ACX) {
    // AC Expressway: wide grass median (tree-planted) through the western half,
    // barrier-tight over the Walt Whitman and into Atlantic City
    const m = MEDIAN_HALF + 3.5 * windowFn(s, 26000, 30000, 60000, 64000);
    const pinch = Math.max(
      windowFn(s, 7000, 7400, 8600, 9000),        // Walt Whitman deck
      windowFn(s, 88000, 90000, 95900, 96000));   // AC approach barrier
    return m * (1 - pinch) + 1.5 * pinch;
  }
  return MEDIAN_HALF;                    // divided freeway everywhere else
}

// GSP northern hills: the Parkway climbs into the wooded Bergen/Ramapo
// highlands north of Paterson. 0..1 relief weight.
export function gspHillAt(s) {
  return GSP ? windowFn(s, 251000, 257000, 275000, 279000) : 0;
}

// Bay Area relief: the Oakland/East Bay hills on I-580, the Diablo valley and
// Mount Diablo on I-680, and the Berkeley hills on I-80. 0..1 weight.
export function bayHillAt(s) {
  return BAY
    ? 0.7 * windowFn(s, 20000, 23000, 32000, 34000)     // Oakland hills (I-580)
      + 0.9 * windowFn(s, 41000, 45000, 59000, 62000)   // Diablo valley + Mt Diablo (I-680)
      + 0.6 * windowFn(s, 75000, 78000, 87000, 89000)   // Berkeley / El Cerrito hills
    : 0;
}

export function chesterReliefAt(s) {
  return CHESTER
    ? 0.55 * windowFn(s, 2600, 3900, 7200, 8400)
      + 0.8 * windowFn(s, 10300, 11600, 15000, 16200)
      + 0.45 * windowFn(s, 18100, 19500, 22500, 23800)
    : 0;
}

// Southern Virginia and North Carolina are a closed-in rolling woodland
// corridor on this route. This weight drives both road elevation and the
// surrounding terrain, fading cleanly around the state-line and river spans.
export function i95SouthReliefAt(s) {
  if (!I95) return 0;
  return 0.78 * windowFn(s, 500000, 522700, 585000, 600000)
    + 0.58 * windowFn(s, 590000, 603000, 804000, 816200)
    + 0.48 * windowFn(s, 818800, 830000, 876000, 888500);
}

export function bronxRiverReliefAt(s) {
  if (!BRONXRIVER) return 0;
  return 0.72 * windowFn(s, 0, 500, 18500, 20500)
    + 0.38 * windowFn(s, 19000, 20500, 31500, 33000);
}

function radiusAt(phi, routeS = null) {
  // Indiana: kill the wiggles — dead-straight-feeling interstate
  // `phi` may use the physically stretched I-95 route, so zone-specific
  // curves must use the original logical route coordinate instead.
  const s = routeS === null ? (phi / TAU) * LOOP_LENGTH : wrapS(routeS);
  const wiggle = 1 - flatWeight(s);
  // the Garden State Parkway is famously curvy; Bay Area freeways wind too
  const amp = GSP ? 1.8 : BAY ? 1.35 : 1;
  // GSP runs a 279 km loop, so the φ-based terms alone go glassy-straight —
  // fixed-wavelength curves (9 km / 4.2 km) keep the real Parkway sweep;
  // flatWeight damps them across the straight southern coastal plain.
  const gspCurves = GSP
    ? wiggle * (150 * Math.sin(TAU * s / 9000 + 1.0) + 85 * Math.sin(TAU * s / 4200 + 2.4))
    : 0;
  // Real interstates are not all laid on the same gentle loop.  Add a few
  // route-scale sweeps where the geography calls for them: PA/Ohio ridge and
  // valley, the Piedmont and Carolinas, and the tighter Texas/Florida metro
  // approaches.  These are deliberately low-frequency and fade in/out so the
  // road stays smooth and the scenery remains aligned with it.
  const zKey = zoneAt(s).key;
  const ridge = DELHIKOLKATA && ['dk_gaya', 'dk_barhi', 'dk_hazaribagh', 'dk_dhanbad'].includes(zKey) ? 0.55
    : I80 && ['pa', 'ohio80', 'cleveland', 'toledo'].includes(zKey) ? 1
    : I95 && ['va_fredvburg', 'va_ashland', 'va_southside', 'nc_roanokerap', 'nc_rockymount', 'nc_fayetteville', 'nc_lumberton'].includes(zKey) ? 0.78
    : TX45 && ['tx_lancaster', 'tx_corsicana', 'tx_huntsville'].includes(zKey) ? 0.5
    : FLTURNPIKE && ['fltp_treasure', 'fltp_lake', 'fltp_ocala'].includes(zKey) ? 0.32
    : NC40 && ['nc40_benson', 'nc40_johnston', 'nc40_triangle', 'nc40_burlington', 'nc40_greensboro', 'nc40_highpoint', 'nc40_salisbury'].includes(zKey) ? 0.45
    : 0;
  const regionalCurves = ridge * (115 * Math.sin(TAU * s / 12500 + 0.7)
    + 55 * Math.sin(TAU * s / 6100 + 2.1));
  const i95CtCurves = I95
    ? neReliefAt(s) * (150 * Math.sin(TAU * s / 8200 + 0.6)
      + 60 * Math.sin(TAU * s / 3600 + 2.1))
    : 0;
  const i287WestchesterCurves = I287
    ? windowFn(s, 97000, 99000, 118000, 121000)
      * (175 * Math.sin(TAU * s / 7600 + 0.9)
        + 70 * Math.sin(TAU * s / 3300 + 2.4))
    : 0;
  const i95SouthCurves = i95SouthReliefAt(s)
    * (210 * Math.sin(TAU * s / 16500 + 0.35)
      + 92 * Math.sin(TAU * s / 7200 + 1.8));
  // I-95's Philly/Northeast approach is urban and constrained rather than a
  // ruler-straight run. The final approach bends decisively before the river
  // crossing so the bridge is revealed around the curve instead of sitting in
  // the driver's long-range sightline.
  const phillyCurves = I95
    ? windowFn(s, 77000, 79000, 87500, 90500)
      * (260 * Math.sin(TAU * s / 14500 + 0.9) + 150 * Math.sin(TAU * s / 5600 + 2.4))
      + 210 * windowFn(s, 77200, 77800, 79000, 79800)
      + 430 * windowFn(s, 78000, 79000, 80100, 81200)
      + windowFn(s, 77500, 78500, 80500, 81500)
        * (360 * Math.sin(TAU * s / 5200 + 1.35) + 160 * Math.sin(TAU * s / 2600 + 2.1))
    : 0;
  const delkCurves = DELHIKOLKATA
    ? 92 * Math.sin(TAU * s / 22000 + 0.4) + 42 * Math.sin(TAU * s / 7600 + 1.7)
    : 0;
  const i278Curves = I278
    ? (75 * Math.sin(TAU * s / 7200 + 1.1)
      + 32 * Math.sin(TAU * s / 2950 + 2.4))
    : 0;
  const bronxRiverCurves = BRONXRIVER
    ? (s < 35000
      ? 145 * Math.sin(TAU * s / 6100 + .7) + 68 * Math.sin(TAU * s / 2450 + 2.2)
      : 58 * Math.sin(TAU * s / 7200 + 1.1) + 24 * Math.sin(TAU * s / 3100 + .4))
      + 180 * windowFn(s, 38200, 38900, 40300, 41000)
    : 0;
  const i78Curves = I78
    ? windowFn(s, 0, 5000, 205000, 218000)
      * (155 * Math.sin(TAU * s / 10800 + 0.4)
        + 68 * Math.sin(TAU * s / 4700 + 2.0))
    : 0;
  // European motorways follow very different terrain rather than sharing the
  // generic loop wiggle: Iberian plateau straights, wooded German sweeps,
  // British motorway arcs, the Apennine valley and tight Swiss lake/pass roads.
  // Every band fades at its ends so curvature stays continuous at zone joins.
  let euroCurves = 0;
  if (A1) {
    euroCurves = windowFn(s, 10000, 18000, 70000, 78000)
        * (85 * Math.sin(TAU * s / 13200 + .5) + 34 * Math.sin(TAU * s / 5600 + 2.1))
      + windowFn(s, 76000, 84000, 190000, 200000)
        * (150 * Math.sin(TAU * s / 10500 + 1.1) + 62 * Math.sin(TAU * s / 4300 + .2))
      + windowFn(s, 198000, 208000, 292000, 298000)
        * (125 * Math.sin(TAU * s / 9200 + 2.0) + 48 * Math.sin(TAU * s / 3900 + .8));
  } else if (A4) {
    euroCurves = windowFn(s, 0, 8000, 195000, 205000)
        * (42 * Math.sin(TAU * s / 21000 + .7) + 18 * Math.sin(TAU * s / 8300 + 2.3))
      + windowFn(s, 195000, 205000, 278000, 288000)
        * (230 * Math.sin(TAU * s / 8800 + .4) + 105 * Math.sin(TAU * s / 3700 + 1.9))
      + windowFn(s, 278000, 290000, 515000, 527000)
        * (82 * Math.sin(TAU * s / 16800 + 1.4) + 30 * Math.sin(TAU * s / 6500 + .1));
  } else if (A3) {
    euroCurves = windowFn(s, 9000, 16000, 148000, 158000)
      * (185 * Math.sin(TAU * s / 8200 + .9) + 76 * Math.sin(TAU * s / 3400 + 2.2))
      + windowFn(s, 148000, 156000, 171000, 174000)
      * (92 * Math.sin(TAU * s / 6200 + .2) + 36 * Math.sin(TAU * s / 2700 + 1.5));
  } else if (UK) {
    euroCurves = windowFn(s, 5000, 12000, 148000, 156000)
        * (92 * Math.sin(TAU * s / 14500 + .6) + 36 * Math.sin(TAU * s / 6100 + 2.0))
      + windowFn(s, 145000, 153000, 214000, 222000)
        * (145 * Math.sin(TAU * s / 9200 + 1.5) + 58 * Math.sin(TAU * s / 3900 + .2))
      + windowFn(s, 214000, 224000, 316000, 319000)
        * (170 * Math.sin(TAU * s / 10400 + .3) + 65 * Math.sin(TAU * s / 4100 + 2.4));
  } else if (A16) {
    euroCurves = windowFn(s, 4000, 10000, 82000, 90000)
        * (155 * Math.sin(TAU * s / 9300 + .5) + 60 * Math.sin(TAU * s / 3900 + 2.0))
      + windowFn(s, 90000, 102000, 232000, 242000)
        * (55 * Math.sin(TAU * s / 17600 + 1.7) + 22 * Math.sin(TAU * s / 6800 + .4))
      + windowFn(s, 230000, 240000, 285000, 289000)
        * (120 * Math.sin(TAU * s / 8100 + .8) + 42 * Math.sin(TAU * s / 3300 + 2.3));
  } else if (A1IT) {
    euroCurves = windowFn(s, 5000, 12000, 108000, 116000)
        * (145 * Math.sin(TAU * s / 9600 + .4) + 58 * Math.sin(TAU * s / 3900 + 2.0))
      + windowFn(s, 105000, 113000, 171000, 180000)
        * (235 * Math.sin(TAU * s / 7600 + 1.2) + 96 * Math.sin(TAU * s / 3100 + .1))
      + windowFn(s, 176000, 184000, 220000, 224000)
        * (105 * Math.sin(TAU * s / 7000 + 2.1) + 38 * Math.sin(TAU * s / 2900 + .7));
  } else if (CH) {
    euroCurves = windowFn(s, 2000, 8000, 118000, 126000)
        * (255 * Math.sin(TAU * s / 7200 + .6) + 108 * Math.sin(TAU * s / 2850 + 2.2))
      + windowFn(s, 120000, 130000, 286000, 296000)
        * (120 * Math.sin(TAU * s / 10500 + 1.4) + 48 * Math.sin(TAU * s / 4300 + .2))
      + windowFn(s, 286000, 296000, 404000, 409000)
        * (205 * Math.sin(TAU * s / 8200 + .3) + 82 * Math.sin(TAU * s / 3300 + 1.8));
  }
  // Mumbai's roads are constrained by rail lines, creeks, flyovers and old
  // property lines. Add zone-local bends so the city sections do not read as
  // a straight chord of the loop.
  let indiaCurves = 0;
  if (INDIA) {
    indiaCurves = windowFn(s, 0, 1800, 7600, 9200)
      * (180 * Math.sin(TAU * s / 4300 + 0.5) + 72 * Math.sin(TAU * s / 1800 + 1.8))
      + windowFn(s, 18000, 20500, 31800, 33500)
      * (150 * Math.sin(TAU * s / 5200 + 2.1) + 58 * Math.sin(TAU * s / 2300 + 0.3))
      + windowFn(s, 87000, 92500, 96800, 97000)
      * (125 * Math.sin(TAU * s / 2400 + 0.8) + 45 * Math.sin(TAU * s / 1200 + 2.2));
  } else if (ANDHERI) {
    indiaCurves = 115 * windowFn(s, 0, 1600, 19600, 20800) * Math.sin(TAU * s / 3900 + 1.2)
      + 52 * Math.sin(TAU * s / 1700 + 0.7);
  } else if (AUNDH) {
    indiaCurves = 105 * Math.sin(TAU * s / 4100 + 0.9) + 34 * Math.sin(TAU * s / 1450 + 2.0);
  }
  // NYC's route is not a perfect circle: the GWB/Harlem River approach bends,
  // the FDR follows the East River, and the LIE straightens into Nassau.
  const nycCurves = NYC
    ? 75 * windowFn(s, 2800, 4300, 10500, 12500)
      + 105 * windowFn(s, 12000, 14500, 19800, 22000)
      + 52 * windowFn(s, 24000, 26000, 32000, 35000)
      + 28 * Math.sin(TAU * s / 6300 + 1.6)
    : 0;
  // Route 1 follows old property lines, river approaches and industrial
  // viaducts. Broad shallow sweeps reveal each district progressively while
  // keeping traffic and roadside placements on the shared route spline.
  const us1Curves = MAP === 'us1'
    ? 82 * Math.sin(TAU * s / 9200 + 0.45)
      + 34 * Math.sin(TAU * s / 3900 + 2.0)
      + 75 * windowFn(s, 17400, 18200, 19600, 20400)
      + windowFn(s, 43800, 44600, 48200, 49000)
        * (120 * Math.sin(TAU * s / 5600 + 1.25) + 45 * Math.sin(TAU * s / 2500 + 2.3))
    : 0;
  // The Midwest route has its own corridor geometry rather than inheriting a
  // featureless arc: broad Tri-State sweeps, a straighter Borman/I-65 freight
  // run, the Indianapolis beltway curve, and tighter Cincinnati approaches.
  const midwestCurves = MIDWEST
    ? windowFn(s, 0, 600, 25500, 27500)
        * (210 * Math.sin(TAU * s / 11800 + 0.7) + 72 * Math.sin(TAU * s / 4700 + 2.1))
      + windowFn(s, 27000, 28500, 50500, 53000)
        * (95 * Math.sin(TAU * s / 15000 + 1.4) + 38 * Math.sin(TAU * s / 5200 + 0.2))
      + windowFn(s, 78000, 79500, 94000, 96000)
        * (245 * Math.sin(TAU * s / 13200 + 0.45) + 80 * Math.sin(TAU * s / 4700 + 2.0))
      + windowFn(s, 124000, 125500, 147500, 150000)
        * (230 * Math.sin(TAU * s / 9300 + 0.9) + 92 * Math.sin(TAU * s / 3900 + 2.4))
      + windowFn(s, 147000, 149000, 179000, 180000)
        * (130 * Math.sin(TAU * s / 12200 + 1.6) + 48 * Math.sin(TAU * s / 5100 + 0.3))
    : 0;
  return BASE_RADIUS + DISTANCE_SCALE * wiggle * amp * (
    170 * Math.sin(3 * phi + 1.3)
    + 110 * Math.sin(5 * phi + 3.1)
    + 55 * Math.sin(9 * phi + 0.4)
    + 25 * Math.sin(17 * phi + 2.2)
  ) + (GSP ? wiggle * 80 * Math.sin(7 * phi + 2.0) : 0) + gspCurves
    + DISTANCE_SCALE * regionalCurves + DISTANCE_SCALE * i95CtCurves
    + DISTANCE_SCALE * i287WestchesterCurves + DISTANCE_SCALE * i95SouthCurves
    + DISTANCE_SCALE * i278Curves + DISTANCE_SCALE * delkCurves
    + DISTANCE_SCALE * bronxRiverCurves
    + DISTANCE_SCALE * i78Curves
    + DISTANCE_SCALE * nycCurves + DISTANCE_SCALE * us1Curves + DISTANCE_SCALE * indiaCurves
    + DISTANCE_SCALE * phillyCurves + DISTANCE_SCALE * midwestCurves
    + DISTANCE_SCALE * euroCurves;
}

export function elevAt(s) {
  const phi = TAU * wrapS(s) / LOOP_LENGTH;
  const bump = bridgeBumpAt(s);
  // rolling terrain fades out on bridge approaches so the deck never dips
  // below the water plane; Indiana is pancake-flat
  const rolling = (2.5 * Math.sin(5 * phi + 0.7) + 1.5 * Math.sin(13 * phi + 2.2)
    + (CHESTER ? 3.2 * Math.sin(TAU * wrapS(s) / 4100 + 0.4) + 1.4 * Math.sin(TAU * wrapS(s) / 1800 + 1.8) : 0))
    * (1 - 0.85 * flatWeight(s)) * (1 - Math.min(1, bump / 12));
  const mountain = mountainWeight(s) * (30 + 10 * Math.sin(TAU * wrapS(s) / 2600 + 2.0));
  const ghats = ghatWeight(s) * (90 + 24 * Math.sin(TAU * wrapS(s) / 3600 + 1.1));
  const ne = neReliefAt(s) * (26 + 12 * Math.sin(TAU * wrapS(s) / 3000 + 0.6));
  // long-wavelength ridge-and-valley: tall relief but highway-drivable grades
  const app = appalachianAt(s) * (52 + 20 * Math.sin(TAU * wrapS(s) / 8000 + 0.5)
    + 10 * Math.sin(TAU * wrapS(s) / 3300));
  const njh = njHighlandsAt(s) * (44 + 18 * Math.sin(TAU * wrapS(s) / 6500 + 0.9));
  const gsp = gspHillAt(s) * (30 + 14 * Math.sin(TAU * wrapS(s) / 2600 + 0.7));
  const bay = bayHillAt(s) * (40 + 22 * Math.sin(TAU * wrapS(s) / 3400 + 0.4));
  const i95South = i95SouthReliefAt(s)
    * (22 + 10 * Math.sin(TAU * wrapS(s) / 11200 + 0.4)
      + 5 * Math.sin(TAU * wrapS(s) / 4700 + 1.6))
    * (1 - Math.min(1, bump / 12));
  const brp = bronxRiverReliefAt(s)
    * (18 + 8 * Math.sin(TAU * wrapS(s) / 3600 + .4)
      + 4 * Math.sin(TAU * wrapS(s) / 1550 + 1.7))
    * (1 - Math.min(1, bump / 12));
  // Switzerland rides far higher relief than the other euro maps — the road
  // itself climbs the Oberland and the Brünig, tall but still drivable grades.
  const euroAmp = CH ? 86 : 42;
  const euro = euroReliefAt(s) * (euroAmp + 18 * Math.sin(TAU * wrapS(s) / 5200 + 0.8)
    + 8 * Math.sin(TAU * wrapS(s) / 2400 + 1.7));
  // I-680 rises onto a long Reston urban viaduct: the city sits below the
  // carriageway while the skyline remains level with the driver's view.
  const i680UrbanDeck = MAP === 'us67'
    ? 14 * windowFn(s, 160000, 170000, 199000, 207000)
    : 0;
  // Route-specific bridge/cut profile. These long smooth windows provide the
  // Mile Long Bridge, I-65 directional connector, bypass viaducts and Mill
  // Creek structures without abrupt grade changes.
  const midwestDeck = MIDWEST
    ? 13 * windowFn(s, 900, 1700, 4300, 5200)
      - 3.5 * windowFn(s, 5400, 6500, 7600, 8200)
      + 11 * windowFn(s, 46200, 47600, 51600, 53200)
      + 7 * windowFn(s, 79500, 80700, 83100, 84200)
      + 8 * windowFn(s, 85500, 86600, 88900, 90000)
      + 7 * windowFn(s, 91600, 92500, 94300, 95000)
      + 11 * windowFn(s, 131800, 133100, 137800, 139300)
      + 6 * windowFn(s, 139000, 140200, 145300, 146800)
    : 0;
  return rolling + mountain + ghats + ne + app + njh + gsp + bay + i95South + brp
    + euro + cincyHillAt(s) + bump + i680UrbanDeck + midwestDeck;
}

// ---------------------------------------------------------------------------
// Lane count varies by zone (NJ Turnpike 6/dir, Indiana 3/dir...). Blends
// smoothly over ±200 m around each zone border.
// ---------------------------------------------------------------------------
const BLEND_H = 200;

export function laneCountAt(s) {
  s = wrapS(s);
  // Fort McHenry uses separate two-lane tubes in each direction. The long
  // merge zones keep the five-lane Baltimore approaches from snapping inward.
  if (I95 && s >= 220800 && s <= 225600) {
    return 5 - 3 * windowFn(s, 220800, 221700, 224700, 225600);
  }
  // I-95 / NJ Turnpike transition: six-lane dual-dual Turnpike roadways merge
  // into a short five-lane toll fan, then settle to the three-lane I-95 bridge
  // approach. Reversing direction naturally reverses the whole sequence.
  if (I95 && s >= 71600 && s <= 75000) {
    if (s < 72200) return 6 - (s - 71600) / 600;
    if (s <= 74200) return 5;
    return 5 - 2 * (s - 74200) / 800;
  }
  // Route 24 through Newark: I-78's real 3-2-2-3 local/express arrangement.
  // Each direction carries two inner express and three outer local lanes.
  if (I78 && s >= 199500 && s <= 237500) {
    return 3 + 2 * windowFn(s, 199500, 201000, 236000, 237500);
  }
  // Jersey Avenue / Holland Tunnel toll approach fans to five lanes on each
  // carriageway, then compresses smoothly into the two-lane tunnel tubes.
  if (I78 && s >= 258900 && s <= 259950) {
    return 3 + 2 * windowFn(s, 258900, 259250, 259720, 259950);
  }
  // Delaware River bridge: the Philly-to-NJ crossing itself is two lanes per
  // direction; the approaches widen again away from the span.
  if (I95 && s >= 77030 && s <= 78070) return 2;
  // Philadelphia I-95 is not a uniform five-lane freeway: the denser urban
  // approach briefly carries four lanes, then settles to three lanes through
  // the wooded Northeast Philly/Tacony run and its long reconstruction zones.
  if (I95 && s >= 77000 && s < 91000) {
    return 3 + windowFn(s, 77000, 78000, 80500, 81500);
  }
  const z = zoneAt(s);
  const dStart = s - z.start;
  const dEnd = z.end - s;
  if (dStart < BLEND_H) {
    const prev = zoneAt(z.start - 1);
    const w = 0.5 + 0.5 * Math.sin((dStart / BLEND_H) * Math.PI / 2);
    return prev.lanes * (1 - w) + z.lanes * w;
  }
  if (dEnd < BLEND_H) {
    const next = zoneAt(z.end + 1);
    const w = 0.5 - 0.5 * Math.sin((dEnd / BLEND_H) * Math.PI / 2);
    return z.lanes * (1 - w) + next.lanes * w;
  }
  return z.lanes;
}

export function usableLanesAt(s) {
  return Math.max(1, Math.floor(laneCountAt(s) + 1e-3));
}

// Construction lane closures (rightmost lane, one direction). Traffic merges
// left through these — closedLanesAt is subtracted from the usable-lane count
// in the NPC lane logic, so cars peel out of the closed lane; the visual cones
// and signage are built from the same table (see i95.js buildWorkZones). Ranges
// are picked clear of bridges and interchange ramps so nothing conflicts.
export const WORK_ZONES = ({
  // kept on 3+ lane cross-sections so a one-lane closure always leaves >=2
  // lanes open — no funnel-to-single-lane deadlock
  i95: [
    { dir: 1, sLow: 64600, sHigh: 66400 },   // NJ Turnpike central NJ — SB
    { dir: -1, sLow: 68400, sHigh: 70300 },  // NJ Turnpike central NJ — NB
    { dir: 1,  sLow: 249000,  sHigh: 252400 },   // Maryland, Laurel (4 ln) — SB
    { dir: -1, sLow: 465000,  sHigh: 468600 },   // Richmond VA (5 ln) — NB
    { dir: 1,  sLow: 1272000, sHigh: 1275600 },  // Savannah GA (4 ln) — SB
    { dir: -1, sLow: 1750000, sHigh: 1753600 },  // FL Space Coast (3 ln) — NB
    { dir: 1,  sLow: 1975000, sHigh: 1978400 },  // Miami-Dade (6 ln) — SB (always under construction)
  ],
  midwest: [
    { dir: 1,  sLow: 54800,  sHigh: 57800 },  // I-65 near Lowell — SB right lane
    { dir: -1, sLow: 66800,  sHigh: 70100 },  // I-65 near Lafayette — NB right lane
    { dir: 1,  sLow: 82200,  sHigh: 85200 },  // I-465 west side — SB/right lane
    { dir: -1, sLow: 100500, sHigh: 103500 },  // I-74 Shelbyville — NB/right lane
    { dir: 1,  sLow: 143800, sHigh: 147000 },  // I-75 Mill Creek/Norwood — SB/right lane
  ],
})[MAP] || [];

// Permanent capacity bottlenecks (merges / deck splits), NOT construction — no
// cones or signage are built for these (buildWorkZones only reads WORK_ZONES).
// Lanes close progressively so traffic funnels down and, under load (rush hour),
// backs up into a real dynamic jam that clears again when the flow drops.
export const BOTTLENECKS = ({
  i95: [
    // George Washington Bridge northbound (into NYC): the 6-lane NJ approach
    // funnels down for the upper/lower deck split just before the span — the
    // notorious GWB inbound backup, right where I-80 has merged in.
    { dir: -1, sLow: 45400, sHigh: 46000, lanes: 1 },   // outer lane ends first
    { dir: -1, sLow: 44700, sHigh: 45400, lanes: 2 },   // tighten into the deck split
  ],
})[MAP] || [];

export function closedLanesAt(s, dir) {
  let n = 0;
  for (const z of WORK_ZONES) if (z.dir === dir && s >= z.sLow && s < z.sHigh) n += 1;
  for (const z of BOTTLENECKS) if (z.dir === dir && s >= z.sLow && s < z.sHigh) n += (z.lanes ?? 1);
  return n;
}

export function pavedHalfAt(s) {
  // the spur split widens the overall envelope: outer edge of the eastern/
  // western spur outer carriageways sits at ±(SPUR.g + m + 3 lanes + shoulder)
  return medianHalfAt(s) + laneCountAt(s) * laneWidthAt(s) + SHOULDER + njGapAt(s) + njShoulderAt(s)
    + spurTAt(s) * 10.5;
}

export function pointAt(s, out = new THREE.Vector3()) {
  // The post-spur North Jersey leg (Newark/EWR through Elizabeth and Linden)
  // needs a little more driving time before the longer Central Jersey run.
  const newarkStretch = I95 ? 6000 : 0;
  // Central New Jersey is a long, heavily screened Turnpike run in reality.
  // Give that logical segment more physical road length without changing exit
  // numbers, traffic state, or scenery's s coordinates everywhere else.
  const logical = wrapS(s);
  const njStretch = I95 ? 34000 : 0;
  // Northeast Philadelphia is a substantial run between the Delaware River
  // state line and the city proper. Keep its logical mileposts stable, but
  // give that approach enough physical road to read as a real suburban leg.
  const phillyStretch = I95 ? 20000 : 0;
  // The original Midwest loop compressed both long intercity legs until Gary,
  // Lafayette, Indianapolis and Cincinnati felt nearly adjacent. Preserve all
  // logical exits/scenery coordinates, but give the rural I-65 and I-74 legs
  // more physical driving distance.
  const chicagoIndyStretch = MIDWEST ? 18000 : 0;
  const indyCincyStretch = MIDWEST ? 16000 : 0;
  let physical = logical;
  if (I95) {
    if (logical >= 60000) physical += newarkStretch;
    else if (logical > 52000) {
      const t = (logical - 52000) / 8000;
      physical += newarkStretch * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
    if (logical >= 73000) physical += njStretch;
    else if (logical > 60000) {
      const t = (logical - 60000) / 13000;
      physical += njStretch * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
    if (logical >= 91000) physical += phillyStretch;
    else if (logical > 77000) {
      const t = (logical - 77000) / 14000;
      physical += phillyStretch * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
  }
  if (MIDWEST) {
    if (logical >= 79000) physical += chicagoIndyStretch;
    else if (logical > 51000) {
      const t = (logical - 51000) / 28000;
      physical += chicagoIndyStretch * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
    if (logical >= 123000) physical += indyCincyStretch;
    else if (logical > 95000) {
      const t = (logical - 95000) / 28000;
      physical += indyCincyStretch * (0.5 - 0.5 * Math.cos(Math.PI * t));
    }
  }
  const phi = TAU * physical / (LOOP_LENGTH + newarkStretch + njStretch + phillyStretch + chicagoIndyStretch + indyCincyStretch);
  const r = radiusAt(phi, logical);
  return out.set(r * Math.cos(phi), elevAt(s), r * Math.sin(phi));
}

// World metres per logical metre at the current route position. The Philly
// northbound suburban stretch is physically lengthened while exit coordinates
// remain logical, so player/NPC speed must slow proportionally through it.
export function distanceScaleAt(s) {
  const logical = wrapS(s);
  let derivative = 1;
  if (I95) {
    if (logical > 52000 && logical < 60000) {
      const t = (logical - 52000) / 8000;
      derivative += 6000 * 0.5 * Math.PI / 8000 * Math.sin(Math.PI * t);
    }
    if (logical > 60000 && logical < 73000) {
      const t = (logical - 60000) / 13000;
      derivative += 34000 * 0.5 * Math.PI / 13000 * Math.sin(Math.PI * t);
    }
    if (logical > 77000 && logical < 91000) {
      const t = (logical - 77000) / 14000;
      derivative += 20000 * 0.5 * Math.PI / 14000 * Math.sin(Math.PI * t);
    }
  }
  if (MIDWEST) {
    if (logical > 51000 && logical < 79000) {
      const t = (logical - 51000) / 28000;
      derivative += 18000 * 0.5 * Math.PI / 28000 * Math.sin(Math.PI * t);
    }
    if (logical > 95000 && logical < 123000) {
      const t = (logical - 95000) / 28000;
      derivative += 16000 * 0.5 * Math.PI / 28000 * Math.sin(Math.PI * t);
    }
  }
  return DISTANCE_SCALE * derivative;
}

const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();

export function tangentAt(s, out = new THREE.Vector3()) {
  pointAt(s + 1.5, _pa);
  pointAt(s - 1.5, _pb);
  return out.copy(_pa).sub(_pb).normalize();
}

const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// World position at (s, lat). lat > 0 is LEFT of increasing-s travel.
export function posAt(s, lat, out = new THREE.Vector3()) {
  pointAt(s, out);
  tangentAt(s, _t);
  _n.copy(UP).cross(_t).normalize();
  return out.addScaledVector(_n, lat);
}

export function headingAt(s) {
  tangentAt(s, _t);
  return Math.atan2(_t.x, _t.z);
}

// India drives on the left: in the Mumbai zone the carriageways swap sides.
// +1 = right-hand traffic (US), -1 = left-hand (Mumbai). Each direction
// crosses over at a slightly different s so the streams never meet head-on.
export function sideFactorAt(s, dir = 1) {
  // the whole India map (and inner Andheri) drives on the left; US on the right
  return LHT ? -1 : 1;
}

// Lane centers. dir=+1 travels with increasing s; under right-hand traffic
// its lanes sit at negative lat. lane 0 = innermost (fast) lane.
export function latForLane(dir, lane, s = null) {
  let off = (s === null ? MEDIAN_HALF : medianHalfAt(s)) + (s === null ? LANE_WIDTH : laneWidthAt(s)) * (lane + 0.5);
  if (s !== null) {
    // dual-dual gap pushes lanes 3+ outward on the turnpike / GSP local lanes
    off += njGapAt(s) * Math.min(1, Math.max(0, (lane - 2.5) * 2));
  }
  const base = dir > 0 ? -off : off;
  if (s === null) return base;
  // NJ Turnpike E/W spur fork: blend each lane group from the normal
  // cross-section onto its spur (crossing groups take the inset flyover blend)
  if (I95) {
    const crossing = (dir > 0) === (lane >= 2.5);   // dir+1 lanes 3-5, dir-1 lanes 0-2
    const t = crossing ? spurCrossT(s) : spurTAt(s);
    if (t > 0) {
      const li = Math.max(0, Math.min(5, lane));
      // fractional lanes interpolate between the two whole-lane targets
      const lo = Math.floor(li), hi = Math.min(5, lo + 1), f = li - lo;
      const target = spurTargetLat(dir, lo) * (1 - f) + spurTargetLat(dir, hi) * f;
      return (base * (1 - t) + target * t) * sideFactorAt(s, dir);
    }
  }
  return base * sideFactorAt(s, dir);
}

// Extra lateral offset (toward the ramp side) for a vehicle taking `exit`.
export function rampOffset(exit, s, dir) {
  const start = dir > 0 ? exit.s - RAMP_LENGTH : exit.s + RAMP_LENGTH;
  const prog = dir > 0 ? (wrapS(s) - wrapS(start)) : (wrapS(start) - wrapS(s));
  let p = prog;
  if (p < -LOOP_LENGTH / 2) p += LOOP_LENGTH;
  if (p > LOOP_LENGTH / 2) p -= LOOP_LENGTH;
  const total = RAMP_LENGTH + 90;
  if (p < 0) return 0;
  if (p > total) return null;
  const t = Math.min(1, p / RAMP_LENGTH);
  const smooth = t * t * (3 - 2 * t);
  const extra = p > RAMP_LENGTH ? (p - RAMP_LENGTH) * 0.22 : 0;
  return 16 * smooth + extra;
}

// ---------------------------------------------------------------------------
// Geometry builders
// ---------------------------------------------------------------------------

// Ribbon along the loop between lat/y offsets that may be numbers or fns of s.
// UVs are in world meters (u along s, v across lat, /6) so tiled surface
// textures keep a constant real-world scale however wide the ribbon gets.
export function buildRibbon(latA, latB, yA, yB, step, s0 = 0, s1 = LOOP_LENGTH) {
  const fA = typeof latA === 'function' ? latA : () => latA;
  const fB = typeof latB === 'function' ? latB : () => latB;
  const fyA = typeof yA === 'function' ? yA : () => yA;
  const fyB = typeof yB === 'function' ? yB : () => yB;
  const n = Math.ceil((s1 - s0) / step);
  const pos = new Float32Array((n + 1) * 2 * 3);
  const uv = new Float32Array((n + 1) * 2 * 2);
  const idx = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * (i / n);
    posAt(s, fA(s), va); posAt(s, fB(s), vb);
    pos.set([va.x, va.y + fyA(s), va.z, vb.x, vb.y + fyB(s), vb.z], i * 6);
    uv.set([s / 6, fA(s) / 6, s / 6, fB(s) / 6], i * 4);
    if (i < n) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Tileable asphalt: fine aggregate speckle, tar patches, faint cracks.
// Values sit near white so the material color still sets the tone.
function asphaltTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#dcdcdc';
  g.fillRect(0, 0, 512, 512);
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 26000; i++) {   // aggregate grain
    const v = 175 + (rnd() * 80) | 0;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect((rnd() * 512) | 0, (rnd() * 512) | 0, 1, 1);
  }
  for (let i = 0; i < 40; i++) {      // darker tar patches / oil staining
    const x = rnd() * 512, y = rnd() * 512, r = 10 + rnd() * 42;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(70,70,74,${0.05 + rnd() * 0.09})`);
    grad.addColorStop(1, 'rgba(70,70,74,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  g.strokeStyle = 'rgba(60,60,62,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {      // hairline cracks (kept off the tile edges)
    let x = 60 + rnd() * 390, y = 60 + rnd() * 390;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rnd() - 0.5) * 40; y += rnd() * 22;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Weathered Midwest pavement: visible slab joints, sealed cracks and uneven
// repair panels.  This is a visual layer only; it must not add artificial
// steering vibration or change collision/grip behavior.
function midwestWornTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#777773'; g.fillRect(0, 0, 256, 256);
  let state = 0x4d494457;
  const rand = () => ((state = Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5 | 0), ((state ^ state >>> 14) >>> 0) / 4294967296);
  for (let i = 0; i < 5200; i++) {
    const v = 92 + (rand() * 50 | 0);
    g.fillStyle = `rgb(${v},${v},${Math.max(82, v - 2)})`;
    const x = rand() * 256, y = rand() * 256, r = 0.25 + rand() * 0.8;
    g.fillRect(x, y, r, r);
  }
  // Repeating concrete-slab joint and longitudinal construction seam.
  g.fillStyle = 'rgba(34,32,31,.22)'; g.fillRect(0, 0, 2, 256);
  g.fillStyle = 'rgba(42,40,38,.15)'; g.fillRect(0, 126, 256, 2);
  // Tar-sealed wandering cracks and rectangular utility/pothole repairs.
  g.strokeStyle = 'rgba(28,27,26,.58)'; g.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    let x = rand() * 256, y = rand() * 256; g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += 8 + rand() * 18; y += (rand() - .5) * 18; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const x = 12 + rand() * 210, y = 10 + rand() * 215;
    g.fillStyle = `rgba(48,48,47,${.22 + rand() * .18})`;
    g.fillRect(x, y, 16 + rand() * 44, 9 + rand() * 28);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Dashed lane lines: boundary k exists only where the road is wide enough.
function buildDashes(dashLen, gapLen, width, yOff) {
  const verts = [];
  const idx = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(),
        c = new THREE.Vector3(), d = new THREE.Vector3();
  const period = dashLen + gapLen;
  for (let k = 1; k < LANES_MAX; k++) {
    for (const side of [-1, 1]) {
      for (let s = 0; s < LOOP_LENGTH - period; s += period) {
        if (k >= laneCountAt(s + dashLen / 2) - 0.02) continue;
        // no dash across the turnpike's dual-dual divider
        if (k === 3 && njGapAt(s) > 0.5) continue;
        // spur fork: the cross-section is remapped there — i95.js draws its own
        if (spurTAt(s + dashLen / 2) > 0.03) continue;
        // Andheri: markings only on the modern South Mumbai road, none on the
        // free-for-all inner streets
        if (ANDHERI && medianHalfAt(s + dashLen / 2) < 2.5) continue;
        // Aundh–Baner: no lane markings anywhere — traffic packs in regardless
        if (AUNDH) continue;
        // boundaries in the outer roadway shift with the divider gap
        const lat = side * (medianHalfAt(s) + laneWidthAt(s) * k + (k >= 4 ? njGapAt(s) : 0));
        posAt(s, lat - width / 2, a);
        posAt(s, lat + width / 2, b);
        posAt(s + dashLen, lat - width / 2, c);
        posAt(s + dashLen, lat + width / 2, d);
        const kk = verts.length / 3;
        verts.push(a.x, a.y + yOff, a.z, b.x, b.y + yOff, b.z,
                   c.x, c.y + yOff, c.z, d.x, d.y + yOff, d.z);
        idx.push(kk, kk + 2, kk + 1, kk + 1, kk + 2, kk + 3);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A lane closure changes the dashed boundary into a continuous white line,
// as on real Turnpike work zones. The cones/signs are supplied by i95.js.
function buildWorkZoneSolids(yOff) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xf0f0e8, depthWrite: false });
  const meshes = [];
  for (const z of WORK_ZONES) {
    if (MAP !== 'i95') continue;
    const lat = s => latForLane(z.dir, usableLanesAt(s) - 1, s) - z.dir * laneWidthAt(s) * 0.5;
    meshes.push(new THREE.Mesh(buildRibbon(
      s => lat(s) - 0.075, s => lat(s) + 0.075,
      yOff, yOff, 8, z.sLow, z.sHigh
    ), mat));
  }
  return meshes;
}

function signTexture(lines, opts = {}) {
  const w = 512, h = 256;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = opts.bg || '#046a38';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ffffff'; g.lineWidth = 8;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  const n = lines.length;
  lines.forEach((line, i) => {
    const size = Math.min(i === 0 ? 54 : 64, Math.floor(210 / n));
    g.font = `bold ${size}px "Helvetica Neue", Arial, "Devanagari Sangam MN", sans-serif`;
    g.fillText(line, w / 2, 30 + (h - 40) * ((i + 0.8) / (n + 0.3)));
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// European motorway guide signs are blue (Portugal/Spain/Germany/France and
// the UK all use motorway blue); the US default is green.
const SIGN_BG = A1IT ? '#0b7d3e' : (EURO || UK) ? '#0d4f9e' : '#046a38';
function makeSign(lines, width = 7, height = 3.5) {
  const group = new THREE.Group();
  const tex = signTexture(lines, { bg: SIGN_BG });
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06,
      roughness: 0.6, side: THREE.DoubleSide,
    })
  );
  board.position.y = 6.2;
  group.add(board);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.5, metalness: 0.6 });
  for (const px of [-width / 2 + 0.6, width / 2 - 0.6]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.4, 6), poleMat);
    pole.position.set(px, 3.2, 0.15);
    group.add(pole);
  }
  group.userData.board = board;
  return group;
}

export function buildRoad(scene, registry) {
  const group = new THREE.Group();

  // Asphalt: travel lanes + shoulders, width follows the zone lane count.
  // Textured aggregate surface; goes dark and mirror-wet in the rain (main.js
  // drives roadMat wetness via registry).
  const asphaltTex = asphaltTexture();
  const asphaltMat = registerEnvMaterial(new THREE.MeshStandardMaterial({
    color: 0x2e2f31, roughness: 0.95, map: asphaltTex,
    bumpMap: asphaltTex, bumpScale: 0.25, envMapIntensity: 0.3,
  }));
  const additionalRoadMats = [];
  // through the i95 spur fork the middle opens up (two separate highways with
  // marsh between them), so the pavement is built as two ribbons whose inner
  // edges part where the spurs split; everywhere else innerHalf is 0.
  const innerHalf = s => (I95 ? spurTAt(s) * (SPUR.g - SPUR.m - 3 * LANE_WIDTH - 2.7) : 0);
  if (I95) {
    for (const side of [-1, 1]) {
      // keep the edge args in ascending lat order: buildRibbon's winding (and
      // so its face normal) follows the A→B direction, and the shared asphalt
      // material is single-sided — descending args cull the whole carriageway
      const a = new THREE.Mesh(
        buildRibbon(
          s => side < 0 ? -pavedHalfAt(s) : innerHalf(s),
          s => side < 0 ? -innerHalf(s) : pavedHalfAt(s),
          0, 0, 12),
        asphaltMat
      );
      a.receiveShadow = true;
      group.add(a);
    }
  } else {
    const asphalt = new THREE.Mesh(
      buildRibbon(s => -pavedHalfAt(s), s => pavedHalfAt(s), 0, 0, 12),
      asphaltMat
    );
    asphalt.receiveShadow = true;
    group.add(asphalt);
    // Aundh–Baner is an urban local-road circuit, not a rural road with a
    // grass verge. Add a narrow continuous asphalt apron outside the travel
    // envelope so terrain cannot visually leak into the street edge.
    if (AUNDH || ANDHERI || INDIA) {
      const urbanEnd = AUNDH || ANDHERI ? LOOP_LENGTH : 32000;
      for (const side of [-1, 1]) {
        const outer = side < 0
          ? (s => -pavedHalfAt(s) - 1.6)
          : (s => pavedHalfAt(s) + 1.6);
        const inner = side < 0
          ? (s => -pavedHalfAt(s))
          : (s => pavedHalfAt(s));
        const apron = new THREE.Mesh(
          buildRibbon(outer, inner, 0.012, 0.012, 10, 0, urbanEnd),
          asphaltMat
        );
        apron.receiveShadow = true;
        group.add(apron);
      }
    }
    // Libertia's developing farm belt has full-width paved shoulders.  Keep
    // a narrow asphalt apron outside the edge line so the green terrain never
    // visually bleeds into the right travel lane at the compressed scale.
    if (LIBERTIA) {
      for (const side of [-1, 1]) {
        const outer = side < 0
          ? (s => -pavedHalfAt(s) - 3.2)
          : (s => pavedHalfAt(s) + 3.2);
        const inner = side < 0
          ? (s => -pavedHalfAt(s))
          : (s => pavedHalfAt(s));
        const shoulder = new THREE.Mesh(
          buildRibbon(outer, inner, 0.012, 0.012, 12, 390000, 630000),
          asphaltMat
        );
        shoulder.receiveShadow = true;
        group.add(shoulder);
      }
    }
  }
  // Country-specific pavement overlays break up the baseline asphalt: pale,
  // sun-baked Iberian aggregate; dark smooth Autobahn; patched British lanes;
  // older Italian autostrada; and clean Swiss surfacing. Selected spans leave
  // resurfaced transitions visible during a long drive.
  const euroSurface = A1 ? { color: 0x595852, roughness: .96, spans: [[18000, 78000], [132000, 204000], [246000, 292000]] }
    : A4 ? { color: 0x666158, roughness: 1, spans: [[12000, 194000], [276000, 392000], [430000, 510000]] }
    : A3 ? { color: 0x292b2d, roughness: .82, spans: [[8000, 61000], [72000, 132000], [145000, 170000]] }
    : UK ? { color: 0x45464a, roughness: .98, spans: [[15000, 50000], [82000, 128000], [212000, 286000]] }
    : A16 ? { color: 0x55575a, roughness: .94, spans: [[15000, 84000], [118000, 198000], [232000, 262000]] }
    : A1IT ? { color: 0x4d4b48, roughness: .98, spans: [[12000, 65000], [82000, 158000], [178000, 205000]] }
    : CH ? { color: 0x36393b, roughness: .86, spans: [[6000, 59000], [92000, 162000], [210000, 292000], [340000, 400000]] }
    : null;
  if (euroSurface) {
    const euroRoadMat = registerEnvMaterial(new THREE.MeshStandardMaterial({
      color: euroSurface.color, roughness: euroSurface.roughness, map: asphaltTex,
      bumpMap: asphaltTex, bumpScale: 0.22, envMapIntensity: 0.24,
    }));
    for (const [s0, s1] of euroSurface.spans) {
      const overlay = new THREE.Mesh(
        buildRibbon(s => -pavedHalfAt(s), s => pavedHalfAt(s), .008, .008, 10, s0, s1),
        euroRoadMat,
      );
      overlay.receiveShadow = true;
      group.add(overlay);
    }
    additionalRoadMats.push(euroRoadMat);
  }
  // Chicago and older Indiana freeway sections should not read as freshly
  // paved generic asphalt.  Limit the worn treatment to the established urban
  // slabs and older rural runs; newer metro interchange work keeps the base
  // surface.  I-80 receives the same treatment only at its Chicago end.
  const wornSpans = MIDWEST
    ? [[0, 6200], [9100, 13800], [15800, 22200], [28600, 37800], [40800, 47000],
      [51000, 57500], [61500, 67500], [111000, 117500], [120000, 125000]]
    : I80 ? [[228000, 261000]] : [];
  if (wornSpans.length) {
    const wornTex = midwestWornTexture();
    const wornMat = registerEnvMaterial(new THREE.MeshStandardMaterial({
      color: 0x777773, roughness: 1, map: wornTex,
      bumpMap: wornTex, bumpScale: 0.34, envMapIntensity: 0.16,
    }));
    for (const [s0, s1] of wornSpans) {
      const worn = new THREE.Mesh(
        buildRibbon(s => -pavedHalfAt(s), s => pavedHalfAt(s), 0.012, 0.012, 10, s0, s1),
        wornMat,
      );
      worn.receiveShadow = true; worn.userData.midwestWornPavement = true;
      group.add(worn);
    }
    additionalRoadMats.push(wornMat);
  }
  registry.roadMats = [asphaltMat, ...additionalRoadMats];

  // Jersey barrier median — gapped at the Mumbai crossovers.
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x9b9b93, roughness: 0.85, side: THREE.DoubleSide });
  const wornBarrierMat = new THREE.MeshStandardMaterial({ color: 0x695044, roughness: 1, side: THREE.DoubleSide });
  const grassMedianMat = new THREE.MeshStandardMaterial({ color: 0x3f6337, roughness: 1, side: THREE.DoubleSide });
  const bh = 0.85, bw = 0.42;
  // no barrier through Cincinnati — plain double-yellow street
  const barrierSpans = ANDHERI || AUNDH
    ? []                                 // inner Andheri/Pune: painted divider / kerb blocks
    : DELHIKOLKATA
    ? [[0, 35000], [280000, 390000], [505000, 575000], [1460000, LOOP_LENGTH - 180]]
    : I95
    ? [[180, 45350], [52050, LOOP_LENGTH - 180]]  // spur fork: per-spur medians live in i95.js
    : I80
    ? [[180, 43000], [57000, 61000], [79000, 84000], [108000, 116000], [142000, LOOP_LENGTH - 180]]
    : [[180, LOOP_LENGTH - 180]];
  if (LIBERTIA_ROUTES) {
    // Libertia's roads were built by different agencies over decades: some
    // stretches retain concrete, some use a planted median, and some have
    // rust-stained brown barriers with missing sections.
    const styles = {
      libertia: [['concrete', 0, .26], ['worn', .26, .48], ['concrete', .48, .72], ['worn', .72, 1]],
      i380: [['grass', 0, .24], ['concrete', .24, .37], ['grass', .37, .62], ['concrete', .62, .76], ['grass', .76, 1]],
      i980: [['grass', 0, .34], ['worn', .34, .50], ['grass', .50, .78], ['concrete', .78, 1]],
      lb24: [['concrete', 0, .30], ['worn', .30, .52], ['concrete', .52, .78], ['worn', .78, 1]],
      us67: [['concrete', 0, .30], ['worn', .30, .58], ['concrete', .58, .82], ['worn', .82, 1]],
    }[MAP];
    for (const [style, u0, u1] of styles) {
      const s0 = Math.max(180, u0 * LOOP_LENGTH), s1 = Math.min(LOOP_LENGTH - 180, u1 * LOOP_LENGTH);
      if (style === 'grass') {
        group.add(new THREE.Mesh(
          buildRibbon(s => -medianHalfAt(s) + .16, s => medianHalfAt(s) - .16, .035, .035, 12, s0, s1),
          grassMedianMat,
        ));
        continue;
      }
      // Worn barriers have repeated openings instead of one uninterrupted wall.
      const chunk = style === 'worn' ? 140 : s1 - s0;
      const opening = style === 'worn' ? 42 : 0;
      for (let s = s0; s < s1; s += chunk) {
        const end = Math.min(s + chunk - opening, s1);
        if (end <= s) continue;
        const material = style === 'worn' ? wornBarrierMat : barrierMat;
        group.add(new THREE.Mesh(buildRibbon(-bw, bw, bh, bh, 14, s, end), material));
        group.add(new THREE.Mesh(buildRibbon(-bw - 0.18, -bw, 0, bh, 14, s, end), material));
        group.add(new THREE.Mesh(buildRibbon(bw, bw + 0.18, 0, bh, 14, s, end), material));
      }
    }
  } else {
    if (I80) {
      for (const [s0, s1] of [[43000, 57000], [61000, 79000], [84000, 108000], [116000, 142000]]) {
        group.add(new THREE.Mesh(
          buildRibbon(s => -medianHalfAt(s) + .2, s => medianHalfAt(s) - .2, .04, .04, 12, s0, s1),
          grassMedianMat,
        ));
      }
    }
    for (const [b0, b1] of barrierSpans) {
      group.add(new THREE.Mesh(buildRibbon(-bw, bw, bh, bh, 14, b0, b1), barrierMat));
      group.add(new THREE.Mesh(buildRibbon(-bw - 0.18, -bw, 0, bh, 14, b0, b1), barrierMat));
      group.add(new THREE.Mesh(buildRibbon(bw, bw + 0.18, 0, bh, 14, b0, b1), barrierMat));
    }
  }

  // Line markings.
  const lineY = 0.03;
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  const us67LineMat = MAP === 'us67'
    ? new THREE.MeshBasicMaterial({ color: 0xd8d8d8, transparent: true, opacity: 1, depthWrite: false })
    : whiteMat;
  const us67WornMat = new THREE.MeshBasicMaterial({
    color: 0xc5c2b4, transparent: true, opacity: 0.72, depthWrite: false,
  });
  if (MAP === 'us67') registry.us67RoadLineMats = [
    { material: us67LineMat, day: 1, night: .28 },
    { material: us67WornMat, day: .72, night: .08 },
  ];
  // Europe marks the median edge in white like every other line; the US paints
  // the left edge yellow
  const yellowMat = (EURO || UK) ? whiteMat : new THREE.MeshBasicMaterial({ color: 0xd7a900 });

  // inner Andheri roads have no lane markings (buildDashes skips them); the
  // modern South Mumbai coastal road does get them
  group.add(new THREE.Mesh(buildDashes(3, 9, 0.15, lineY), us67LineMat));
  for (const mesh of buildWorkZoneSolids(lineY + 0.002)) group.add(mesh);

  // Outer edge lines track the spur outer carriageways through the fork.  The
  // Northeast Reston segment is almost unmarked, like neglected old asphalt.
  const edge = s => medianHalfAt(s) + laneCountAt(s) * laneWidthAt(s) + njGapAt(s)
    + spurTAt(s) * (SPUR.g + SPUR.m + 3 * LANE_WIDTH - (MEDIAN_HALF + 6 * LANE_WIDTH));
  const edgeSpans = MAP === 'us67'
    ? [[0, 166000, us67LineMat], [166000, 205000, us67WornMat], [205000, LOOP_LENGTH, us67LineMat]]
    : [[0, LOOP_LENGTH, whiteMat]];
  for (const [a, b, lineMat] of edgeSpans) {
    group.add(new THREE.Mesh(buildRibbon(s => -edge(s) - 0.08, s => -edge(s) + 0.08, lineY, lineY, 8, a, b), lineMat));
    group.add(new THREE.Mesh(buildRibbon(s => edge(s) - 0.08, s => edge(s) + 0.08, lineY, lineY, 8, a, b), lineMat));
  }
  // center yellows follow the median: far apart on divided highway,
  // a tight double yellow through Cincinnati. On i95 they stop at the spur
  // fork (each spur gets its own yellows from i95.js).
  const [y0, y1] = I95 ? [45050, 52350] : [0, 0];
  // US-67 uses a white divider stripe; the other US roads keep their usual
  // yellow left-edge treatment.
  const centerLineMat = MAP === 'us67' ? us67LineMat : yellowMat;
  const centerSpans = MAP === 'us67'
    ? [[0, 166000, centerLineMat], [166000, 205000, us67WornMat], [205000, LOOP_LENGTH, centerLineMat]]
    : (I95 ? [[0, y0, centerLineMat], [y1, LOOP_LENGTH, centerLineMat]] : [[0, LOOP_LENGTH, centerLineMat]]);
  for (const [a, b, lineMat] of centerSpans) {
    group.add(new THREE.Mesh(buildRibbon(s => -medianHalfAt(s) - 0.08, s => -medianHalfAt(s) + 0.08, lineY, lineY, 10, a, b), lineMat));
    group.add(new THREE.Mesh(buildRibbon(s => medianHalfAt(s) - 0.08, s => medianHalfAt(s) + 0.08, lineY, lineY, 10, a, b), lineMat));
  }

  // Guardrails on outer edges, split into segments that skip the exit gores.
  const railMat = registerEnvMaterial(new THREE.MeshStandardMaterial({
    color: 0xb9bec4, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide,
  }));
  // no highway guardrails on the inner-Pune local roads — shopfronts and
  // parked two-wheelers come right up to the tarmac instead
  for (const side of AUNDH ? [] : [-1, 1]) {
    const gaps = [];
    for (const ex of EXITS) {
      for (const dir of [1, -1]) {
        const rampSide = (dir > 0 ? -1 : 1) * Math.sign(sideFactorAt(ex.s, dir) || 1);
        if (rampSide !== side) continue;
        gaps.push(dir > 0
          ? [ex.s - RAMP_LENGTH - 10, ex.s + 120]
          : [ex.s - 120, ex.s + RAMP_LENGTH + 10]);
      }
    }
    gaps.sort((a, b) => a[0] - b[0]);
    let cursor = 0;
    const spans = [];
    for (const [g0, g1] of gaps) {
      if (g0 > cursor) spans.push([cursor, g0]);
      cursor = Math.max(cursor, g1);
    }
    if (cursor < LOOP_LENGTH) spans.push([cursor, LOOP_LENGTH]);
    for (const [s0, s1] of spans) {
      group.add(new THREE.Mesh(
        buildRibbon(s => side * (pavedHalfAt(s) + 0.25), s => side * (pavedHalfAt(s) + 0.25), 0.45, 0.78, 10, s0, s1),
        railMat
      ));
    }
  }

  // Exit ramps + signage, both directions.
  const rampMat = registerEnvMaterial(new THREE.MeshStandardMaterial({
    color: 0x323335, roughness: 0.95, side: THREE.DoubleSide,
    map: asphaltTex, bumpMap: asphaltTex, bumpScale: 0.25, envMapIntensity: 0.3,
  }));
  registry.roadMats.push(rampMat);
  for (const exit of EXITS) {
    const laneCenter = medianHalfAt(exit.s) + laneWidthAt(exit.s) * (usableLanesAt(exit.s) - 0.5)
      + (usableLanesAt(exit.s) > 3 ? njGapAt(exit.s) : 0);
    for (const dir of [1, -1]) {
      // ramp on the travel direction's outer side (right in US, left→outer in Mumbai)
      const side = (dir > 0 ? -1 : 1) * Math.sign(sideFactorAt(exit.s, dir) || 1);
      const s0 = dir > 0 ? exit.s - RAMP_LENGTH : exit.s + RAMP_LENGTH;
      const steps = 30;
      const verts = [], uvs = [], idx = [];
      const va = new THREE.Vector3(), vb = new THREE.Vector3();
      for (let i = 0; i <= steps; i++) {
        const p = (i / steps) * (RAMP_LENGTH + 90);
        const s = s0 + dir * p;
        const off = rampOffset(exit, s, dir) ?? (16 + 90 * 0.22);
        posAt(s, side * (laneCenter + off - 2.7), va);
        posAt(s, side * (laneCenter + off + 2.7), vb);
        verts.push(va.x, va.y + 0.01, va.z, vb.x, vb.y + 0.01, vb.z);
        uvs.push(p / 6, 0, p / 6, 0.9);
        if (i < steps) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
      g.setIndex(idx); g.computeVertexNormals();
      group.add(new THREE.Mesh(g, rampMat));

      // Advance sign (~450 m before diverge) + gore sign at the split.
      // Mumbai exits are trilingual: Marathi / Hindi / English. Europe signs
      // in the local language and metric distances.
      const EXIT_WORD = A1 ? 'Saída' : A4 ? 'Salida' : A3 ? 'Ausfahrt' : A16 ? 'Sortie' : A1IT ? 'Uscita' : 'EXIT';
      const exitLabel = UK ? (exit.num === '' ? exit.name : `J${exit.num}`)
        : `${EXIT_WORD} ${exit.num}`;
      const adv = makeSign(exit.mr
        ? [`EXIT ${exit.num}`, exit.mr, exit.hi, exit.name]
        : UK ? [exitLabel, exit.name, '1/2 mile']
        : [`${EXIT_WORD} ${exit.num}`, exit.name, EURO ? '500 m' : '1/4 MILE']);
      const advS = exit.s - dir * (RAMP_LENGTH + 450);
      adv.position.copy(posAt(advS, side * (pavedHalfAt(advS) + 4), new THREE.Vector3()));
      adv.rotation.y = headingAt(advS) + (dir > 0 ? 0 : Math.PI);
      group.add(adv);
      registry.signs.push(adv);

      const goreS = (dir > 0 ? exit.s - RAMP_LENGTH : exit.s + RAMP_LENGTH) - dir * 20;
      const goreLines = exit.mr
        ? [`EXIT ${exit.num}`, exit.mr, `${exit.name} →`]
        : UK ? [exit.num === '' ? exit.name : `J${exit.num}`, exit.name, '→']
        : [`${A1 ? 'Saída' : A4 ? 'Salida' : A3 ? 'Ausfahrt' : A16 ? 'Sortie' : A1IT ? 'Uscita' : 'EXIT'} ${exit.num}`, exit.name, '→'];
      const gore = makeSign(goreLines, 6, 3.2);
      gore.position.copy(posAt(goreS, side * (pavedHalfAt(goreS) + 3.5), new THREE.Vector3()));
      gore.rotation.y = headingAt(goreS) + (dir > 0 ? 0 : Math.PI);
      group.add(gore);
      registry.signs.push(gore);
    }
  }

  scene.add(group);
  return group;
}

// Streetlight poles down the median in the built-up zones.
export function buildStreetlights(scene, registry) {
  // The Bronx River Parkway route supplies its own bridge/urban illumination.
  // Keep the roadway and divider entirely free of generated lamp poles.
  if (BRONXRIVER) return;
  // {s, poleLat, headLats}: median poles with twin arms by default;
  // Cincinnati gets roadside poles (no median on a normal street)
  const positions = [];
  const median = s => ({ s, poleLat: 0, headLats: [-3.2, 3.2] });
  const shoulder = (s, side) => {
    const half = pavedHalfAt(s) + 2.2;
    const head = side * (half - 3.0);
    return { s, poleLat: side * half, headLats: [head, head] };
  };
  const parkwayShoulder = (s, side) => {
    const half = pavedHalfAt(s) + 2.4;
    return {
      s,
      poleLat: side * half,
      // Two short arms point inward over the same carriageway. They are
      // separated laterally instead of occupying the same point.
      headLats: [side * (half - 2.5), side * (half - 4.1)],
    };
  };
  if (DELHIKOLKATA) {
    for (let s = 0; s < 35000; s += 26) positions.push(median(s));
    for (let s = 280000; s < 390000; s += 42) positions.push(median(s));
    for (let s = 1460000; s < LOOP_LENGTH; s += 28) positions.push(median(s));
  } else if (INDIA) {
    for (let s = 0; s < 32000; s += 20) positions.push(median(s));        // New Link Road: dense, bright
    for (let s = 32000; s < 36000; s += 28) positions.push(median(s));    // Navi Mumbai
    for (let s = 36000; s < 42500; s += 42) positions.push(median(s));    // expressway approach
    for (let s = 87000; s < 97000; s += 26) positions.push(median(s));    // Pimpri-Chinchwad + Pune city
  } else if (ANDHERI) {
    for (let s = 0; s < 20800; s += 18) positions.push(median(s));        // packed inner Andheri
    for (let s = 20800; s < LOOP_LENGTH; s += 38) positions.push(median(s)); // airport + South Mumbai coast
  } else if (AUNDH) {
    for (let s = 0; s < 12000; s += 24) positions.push(median(s));        // Aundh + Link Rd
    for (let s = 12000; s < 21000; s += 20) positions.push(median(s));    // Baner + Balewadi: bright
    for (let s = 21000; s < 24800; s += 46) positions.push(median(s));    // Pashan: patchy PMC lighting
    for (let s = 24800; s < LOOP_LENGTH; s += 26) positions.push(median(s)); // Pashan Gaon · ITI Rd
  } else if (BRONXRIVER) {
    // Keep every pole out of the parkway divider. Alternating outer-shoulder
    // fixtures preserve the wooded median and avoid a runway of center poles.
    const alternatingShoulders = (s0, s1, step, startSide = -1) => {
      let side = startSide;
      for (let s = s0; s < s1; s += step) {
        positions.push(parkwayShoulder(s, side));
        side *= -1;
      }
    };
    alternatingShoulders(900, 20000, 180);          // sparse wooded Westchester
    alternatingShoulders(20060, 35000, 118, 1);     // Bronx River Parkway
    alternatingShoulders(35080, 41000, 76);         // Bruckner / I-295 approach
    alternatingShoulders(41100, 44500, 92, 1);      // Throgs Neck approaches/span
    alternatingShoulders(44570, LOOP_LENGTH, 82);   // Clearview
  } else if (I278) {
    for (let s = 0; s < 14000; s += 28) positions.push(median(s));         // NJ-440 + Outerbridge
    for (let s = 14000; s < 32000; s += 34) positions.push(median(s));     // wooded Staten Island
    for (let s = 32000; s < 38000; s += 20) positions.push(median(s));     // Verrazzano
    for (let s = 38000; s < 73000; s += 24) positions.push(median(s));     // Brooklyn / Queens BQE
    for (let s = 73000; s < 79000; s += 20) positions.push(median(s));     // RFK / Triborough
    for (let s = 79000; s < LOOP_LENGTH; s += 24) positions.push(median(s)); // Bruckner / Bronx
  } else if (I287) {
    for (let s = 0; s < LOOP_LENGTH; s += 58) positions.push(median(s));  // suburban NJ interstate
  } else if (BAY) {
    for (let s = 0; s < LOOP_LENGTH; s += 44) positions.push(median(s));   // urbanized bay loop
  } else if (GSP) {
    for (let s = 0; s < 66000; s += 210) positions.push(median(s));       // shore: interchange glow only
    for (let s = 66000; s < 112000; s += 340) positions.push(median(s));  // Pine Barrens: pitch dark
    for (let s = 112000; s < 168000; s += 120) positions.push(median(s)); // Ocean county
    for (let s = 168000; s < 207000; s += 70) positions.push(median(s));  // Monmouth commuter run
    for (let s = 207000; s < 241000; s += 40) positions.push(median(s));  // Woodbridge → Newark: lit
    for (let s = 241000; s < 261000; s += 64) positions.push(median(s));  // Clifton/Paterson: sparser
    // the wooded Bergen highlands run dark — only the odd light
    for (let s = 261000; s < 279000; s += 150) positions.push(median(s));
  } else if (ACX) {
    for (let s = 0; s < 9200; s += 30) positions.push(median(s));         // Philly + WWB: bright
    for (let s = 9200; s < 24800; s += 40) positions.push(median(s));     // Gloucester + NJ-42
    for (let s = 24800; s < 86500; s += 220) positions.push(median(s));   // ACX pines: near-dark
    for (let s = 86500; s < 96000; s += 34) positions.push(median(s));    // Pleasantville → AC: lit
  } else if (NC40) {
    // NC-40 is dark between interchanges; light only the Raleigh/Triangle,
    // Greensboro, and Charlotte urban approaches instead of every divider.
    for (let s = 76000; s < 112000; s += 95) positions.push(median(s));
    for (let s = 112000; s < 151000; s += 78) positions.push(median(s));
    for (let s = 190000; s < 230000; s += 82) positions.push(median(s));
    for (let s = 305000; s < 350000; s += 70) positions.push(median(s));
  } else if (NEWENGLAND) {
    for (let s = 0; s < LOOP_LENGTH; s += 52) positions.push(median(s));  // New England branch
  } else if (NYC) {
    for (let s = 0; s < 43000; s += 24) positions.push(median(s));        // Manhattan + Queens: dense
    for (let s = 43000; s < LOOP_LENGTH; s += 40) positions.push(median(s)); // Long Island suburbs
  } else if (US1) {
    for (let s = 0; s < 45000; s += 30) positions.push(median(s));        // arterial: lit the whole way
    for (let s = 45000; s < 48000; s += 34) positions.push(median(s));    // Pulaski Skyway high mast
    for (let s = 48000; s < LOOP_LENGTH; s += 30) positions.push(median(s)); // Jersey City + return
  } else if (I78) {
    // I-78 is not a runway of median lights. Rural PA/NJ is nearly dark;
    // Newark and Hudson County light from alternating outer shoulders, while
    // the Holland tubes use their own continuous ceiling fixtures.
    let side = -1;
    for (let s = 8000; s < 215000; s += 5200) {
      positions.push(shoulder(s, side)); side *= -1;
    }
    for (let s = 215000; s < 238000; s += 150) {
      positions.push(shoulder(s, side)); side *= -1;
    }
    for (let s = 238000; s < 258700; s += 105) {
      positions.push(shoulder(s, side)); side *= -1;
    }
    for (let s = 258700; s < 260450; s += 70) {
      positions.push(shoulder(s, side)); side *= -1;
    }
    for (let s = 266550; s < 275000; s += 80) {
      positions.push(shoulder(s, side)); side *= -1;
    }
  } else if (I80) {
    for (let s = 0; s < 24000; s += 34) positions.push(median(s));        // north NJ suburb: bright
    for (let s = 24000; s < 146000; s += 90) positions.push(median(s));   // Appalachians: sparse high-mast
    for (let s = 146000; s < 164000; s += 46) positions.push(median(s));  // Youngstown
    for (let s = 164000; s < 204000; s += 34) positions.push(median(s));  // Cleveland + Toledo
    for (let s = 204000; s < 228000; s += 70) positions.push(median(s));  // IN Toll Rd high-mast
    for (let s = 228000; s < 261000; s += 32) positions.push(median(s));  // Gary / Calumet / Chicago Southland
  } else if (A1) {
    for (let s = 0; s < 30000; s += 34) positions.push(median(s));        // Lisboa → Vila Franca: lit
    for (let s = 30000; s < 262000; s += 130) positions.push(median(s));  // rural A1: sparse
    for (let s = 262000; s < LOOP_LENGTH; s += 30) positions.push(median(s)); // Gaia + Porto
  } else if (A4) {
    for (let s = 0; s < 30000; s += 32) positions.push(median(s));        // Madrid + Getafe: lit
    for (let s = 30000; s < 505000; s += 160) positions.push(median(s));  // meseta + valley: sparse
    for (let s = 505000; s < LOOP_LENGTH; s += 30) positions.push(median(s)); // Sevilla
  } else if (A3) {
    // German autobahns famously run unlit — lights only at the big Kreuze and
    // through Köln itself
    for (let s = 0; s < 10000; s += 44) positions.push(median(s));        // Frankfurter Kreuz area
    for (let s = 134000; s < 145000; s += 60) positions.push(median(s));  // Kreuz Bonn/Siegburg
    for (let s = 160000; s < LOOP_LENGTH; s += 34) positions.push(median(s)); // Köln
  } else if (UK) {
    for (let s = 0; s < 15000; s += 36) positions.push(median(s));        // Birmingham
    for (let s = 15000; s < 148000; s += 120) positions.push(median(s));  // M6/M1: junction-lit
    for (let s = 148000; s < 212000; s += 26) positions.push(median(s));  // London: blanket sodium
    for (let s = 212000; s < 305000; s += 110) positions.push(median(s)); // M20 Kent
    for (let s = 305000; s < LOOP_LENGTH; s += 40) positions.push(median(s)); // Folkestone/Dover
  } else if (A16) {
    for (let s = 0; s < 12000; s += 36) positions.push(median(s));        // Calais/Coquelles
    for (let s = 12000; s < 260000; s += 150) positions.push(median(s));  // rural autoroute: dark
    for (let s = 260000; s < LOOP_LENGTH; s += 26) positions.push(median(s)); // Paris: bright
  } else if (A1IT) {
    for (let s = 0; s < 15000; s += 34) positions.push(median(s));        // Roma
    for (let s = 15000; s < 205000; s += 140) positions.push(median(s));  // Valle Latina: sparse
    for (let s = 205000; s < LOOP_LENGTH; s += 28) positions.push(median(s)); // Napoli
  } else if (CH) {
    // Switzerland lights its motorways generously through the towns and the
    // lakeshore runs, but the Oberland and Brünig passes go dark
    for (let s = 0; s < 16000; s += 36) positions.push(median(s));        // Interlaken
    for (let s = 16000; s < 60000; s += 150) positions.push(median(s));   // Brünig pass: dark
    for (let s = 60000; s < 95000; s += 32) positions.push(median(s));    // Luzern
    for (let s = 95000; s < 120000; s += 44) positions.push(median(s));   // Zug
    for (let s = 120000; s < 162000; s += 28) positions.push(median(s));  // Zürich: bright
    for (let s = 162000; s < 210000; s += 60) positions.push(median(s));  // Aargau / Mittelland
    for (let s = 210000; s < 252000; s += 30) positions.push(median(s));  // Bern
    for (let s = 252000; s < 292000; s += 55) positions.push(median(s));  // Fribourg
    for (let s = 292000; s < 348000; s += 30) positions.push(median(s));  // Lausanne + Lavaux shore
    for (let s = 348000; s < LOOP_LENGTH; s += 26) positions.push(median(s)); // Genève: bright
  } else if (MIDWEST) {
    // the CTA rides the Kennedy + Dan Ryan medians, so those stretches light
    // from the shoulders instead (paired roadside poles, denser + brighter)
    const roadside = (s) => {
      const half = pavedHalfAt(s) + 1.6;
      for (const sd of [-1, 1]) {
        positions.push({ s, poleLat: sd * half, headLats: [sd * (half - 3), sd * (half - 3)] });
      }
    };
    for (let s = 0; s < 4000; s += 24) positions.push(median(s));         // O'Hare
    for (let s = 4000; s < 16000; s += 26) roadside(s);                   // Kennedy (Blue Line median)
    for (let s = 16000; s < 24000; s += 20) roadside(s);                  // Loop: blanket bright
    for (let s = 24000; s < 34000; s += 24) roadside(s);                  // Dan Ryan (Red Line median)
    for (let s = 34000; s < 46000; s += 36) positions.push(median(s));    // Skyway + I-80/94
    for (let s = 46000; s < 79000; s += 70) positions.push(median(s));    // Gary + I-65 rural high-mast
    for (let s = 79000; s < 95000; s += 34) positions.push(median(s));    // Indianapolis / I-465
    for (let s = 95000; s < 125000; s += 75) positions.push(median(s));   // I-74 farm country + hills
    for (let s = 125000; s < 138000; s += 30) positions.push(median(s));  // Cincinnati
  } else if (LIBERTIA) {
    // Libertia is not lit end-to-end. Keep the broad rural turnpike dark and
    // reserve median lighting for the two metros, towns, and major junctions.
    for (let s = 0; s < 245000; s += 180) positions.push(median(s));
    for (let s = 245000; s < 390000; s += 52) positions.push(median(s));
    for (let s = 390000; s < 630000; s += 150) positions.push(median(s));
    for (let s = 630000; s < 750000; s += 52) positions.push(median(s));
    for (let s = 750000; s < LOOP_LENGTH; s += 130) positions.push(median(s));
  } else if (MAP === 'us67') {
    // US-67 is an integrated US route: city and Reston sections get regular
    // lamps, while the farm belt keeps widely spaced high-mast lighting.
    for (let s = 0; s < 22000; s += 28) positions.push(median(s));
    for (let s = 22000; s < 72000; s += 115) positions.push(median(s));
    for (let s = 72000; s < 125000; s += 145) positions.push(median(s));
    for (let s = 125000; s < LOOP_LENGTH; s += 30) positions.push(median(s));
  } else {
    for (let s = 0; s < 5000; s += 32) positions.push(median(s));         // New Haven
    for (let s = 5000; s < 31500; s += 48) positions.push(median(s));     // CT corridor
    for (let s = 31500; s < 36500; s += 38) positions.push(median(s));    // Westchester
    for (let s = 36500; s < 44400; s += 28) positions.push(median(s));    // South Bronx + GWB
    for (let s = 44400; s < 77000; s += 40) positions.push(median(s));    // full NJ Turnpike
    for (let s = 77000; s < 91200; s += 32) positions.push(median(s));    // Philly
    for (let s = 91200; s < 96000; s += 55) positions.push(median(s));    // PA
    // DE → FL true-scale run: dense median lighting through the metros
    // (Wilmington, Baltimore, DC suburbs, Richmond, Fayetteville, Florence,
    // Savannah, Jacksonville, the whole FL Gold Coast), sparse rural high-mast
    // the long stretches between.
    for (let s = 96000; s < 133700; s += 42) positions.push(median(s));      // DE
    for (let s = 133700; s < 201300; s += 75) positions.push(median(s));     // rural MD
    for (let s = 201300; s < 309100; s += 34) positions.push(median(s));     // Baltimore → DC beltway
    for (let s = 309100; s < 393900; s += 70) positions.push(median(s));     // N VA
    for (let s = 393900; s < 461500; s += 75) positions.push(median(s));     // central VA
    for (let s = 461500; s < 522700; s += 36) positions.push(median(s));     // Richmond/Petersburg
    for (let s = 522700; s < 732400; s += 90) positions.push(median(s));     // Southside VA + Roanoke Rapids
    for (let s = 732400; s < 798400; s += 38) positions.push(median(s));     // Rocky Mount → Fayetteville
    for (let s = 798400; s < 950900; s += 85) positions.push(median(s));     // Lumberton → Dillon
    for (let s = 950900; s < 1044300; s += 40) positions.push(median(s));    // Florence
    for (let s = 1044300; s < 1208400; s += 90) positions.push(median(s));   // Santee → Walterboro
    for (let s = 1208400; s < 1266400; s += 85) positions.push(median(s));   // Midway
    for (let s = 1266400; s < 1342000; s += 34) positions.push(median(s));   // Savannah
    for (let s = 1342000; s < 1388700; s += 90) positions.push(median(s));   // Kingsland
    for (let s = 1388700; s < 1585200; s += 32) positions.push(median(s));   // Jacksonville
    for (let s = 1585200; s < 1680200; s += 60) positions.push(median(s));   // Daytona
    for (let s = 1680200; s < 1841100; s += 80) positions.push(median(s));   // Space Coast → Fort Pierce
    for (let s = 1841100; s < 2003600; s += 30) positions.push(median(s));   // WPB → Fort Lauderdale → Miami
    // Northeast leg (Boston/Providence/New London), shifted +1907600
    for (let s = 2003600; s < 2012600; s += 28) positions.push(median(s));   // Boston
    for (let s = 2012600; s < 2025600; s += 30) positions.push(median(s));   // Providence
    for (let s = 2025600; s < 2043600; s += 44) positions.push(median(s));   // CT shoreline
  }

  // Fill gaps between the first pass of fixtures with offset lamps. This
  // keeps urban night routes continuously readable without changing daytime
  // road geometry.
  const extraLights = [];
  if (!I78 && !BRONXRIVER) for (let i = 0; i < positions.length; i += 2) {
    const e = positions[i];
    extraLights.push({ ...e, s: wrapS(e.s + 8) });
  }
  positions.push(...extraLights);

  if (!positions.length) return;

  const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 11, 6);
  poleGeo.translate(0, 5.5, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.6, metalness: 0.5 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, positions.length);

  const headGeo = new THREE.BoxGeometry(0.9, 0.22, 0.4);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xccccbb, emissive: 0xffd9a0, emissiveIntensity: 0,
  });
  const heads = new THREE.InstancedMesh(headGeo, headMat, positions.length * 2);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scl = new THREE.Vector3(1, 1, 1);
  const p = new THREE.Vector3();
  positions.forEach((e, i) => {
    posAt(e.s, e.poleLat, p);
    const h = headingAt(e.s);
    q.setFromAxisAngle(UP, h);
    m.compose(p, q, scl);
    poles.setMatrixAt(i, m);
    e.headLats.forEach((headLat, j) => {
      posAt(e.s, headLat, p);
      p.y += 10.6;
      m.compose(p, q, scl);
      heads.setMatrixAt(i * 2 + j, m);
    });
  });
  poles.castShadow = true;
  scene.add(poles, heads);
  registry.streetlightHeads = heads;

  // additive glow blob on every lamp head — the sodium halo you see down a
  // highway at night. One Points draw for the whole map.
  const haloPos = new Float32Array(positions.length * 2 * 3);
  let hi = 0;
  const hp = new THREE.Vector3();
  for (const e of positions) {
    for (const headLat of e.headLats) {
      posAt(e.s, headLat, hp);
      haloPos[hi++] = hp.x; haloPos[hi++] = hp.y + 10.6; haloPos[hi++] = hp.z;
    }
  }
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const haloCv = document.createElement('canvas'); haloCv.width = haloCv.height = 64;
  const hg = haloCv.getContext('2d');
  const hgrad = hg.createRadialGradient(32, 32, 0, 32, 32, 32);
  hgrad.addColorStop(0, 'rgba(255,220,160,1)');
  hgrad.addColorStop(0.25, 'rgba(255,205,130,0.45)');
  hgrad.addColorStop(1, 'rgba(255,190,110,0)');
  hg.fillStyle = hgrad; hg.fillRect(0, 0, 64, 64);
  const haloMat = new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(haloCv), color: 0xffd9a6, size: 3.4,
    transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const halos = new THREE.Points(haloGeo, haloMat);
  halos.renderOrder = 5;
  scene.add(halos);
  registry.streetlightHalos = haloMat;
}
