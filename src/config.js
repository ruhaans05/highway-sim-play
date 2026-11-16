// World + simulation constants. Distances in meters, speeds in m/s.
//
// The game is split into separate maps, chosen by URL param (?map=...):
//   i95     — I-95 New Haven → NYC (South Bronx) → GWB → NJ Turnpike →
//             Philadelphia → true-scale DE/MD/VA/NC/SC/GA/FL to Miami, then
//             loops back up New Haven → Providence → Boston → New London
//             (that leg is real I-95 too, just run the other direction)
//   midwest — I-80 Illinois plains → Indiana I-65 → Cincinnati Metro 78
//   india   — Mumbai New Link Road → Mumbai–Pune Expressway → Pune city
// Direction (?dir=south|north) flips which way the player drives; the map
// is identical either way.

function urlParam(key) {
  if (typeof location !== 'undefined') {
    return new URLSearchParams(location.search).get(key);
  }
  // Node (smoke tests): allow globalThis.__SIM_PARAMS__ = { map: 'world' }
  return globalThis.__SIM_PARAMS__?.[key] ?? null;
}

const mapParam = urlParam('map');
const acceptedMap = ['midwest', 'libertia', 'i380', 'i980', 'lb24', 'i680', 'us67', 'india', 'nh48', 'andheri', 'aundh', 'newdelhi', 'delhikolkata', 'i287', 'i278', 'bronxriver', 'newengland', 'nc40', 'i80', 'i78', 'i280', 'us22', 'gsp', 'acx', 'bay', 'cal5', 'nyc', 'us1', 'chester', 'tx45', 'flturnpike', 'a1', 'a4', 'a3', 'm1', 'a16', 'a1it', 'swiss', 'konkan', 'bihar', 'delhi', 'carolina', 'rio', 'newark', 'delhislum', 'railcorridor', 'railride'].includes(mapParam) ? mapParam : 'i95';
// I-680 reuses the established corridor geometry and internal zone keys;
// its public route identity is I-680.
export const MAP = acceptedMap === 'i680' ? 'us67' : acceptedMap;
// The European motorway maps: Portugal A1, Spain A-4, Germany A3, France A16,
// Italy A1, and Switzerland (Interlaken→Genève). Switzerland is NOT in the EU,
// but shares the Continental road fabric — km/h, metric, right-hand drive, the
// same low-rise city builders — so it rides under the EURO flag. Its own
// touches (green Swiss signage, the vignette instead of tolls, four national
// languages, foreign plates passing through) are handled per-map below.
// The UK (m1) is European in fabric but drives on the left in miles-per-hour,
// so it carries its own flag.
export const EURO = MAP === 'a1' || MAP === 'a4' || MAP === 'a3' || MAP === 'a16' || MAP === 'a1it' || MAP === 'swiss';
export const UK = MAP === 'm1';
export const DIR = urlParam('dir') === 'north' || (MAP === 'acx' && !urlParam('dir')) ? -1 : 1;

const MAPS = {
  bronxriver: {
    // Kensico Circle / White Plains south on the Bronx River Parkway, a
    // short Bruckner Expressway connection, then I-295 over the Throgs Neck
    // Bridge and down the Clearview to its Hillside Avenue terminus.
    LOOP_LENGTH: 53000,
    ZONES: [
      { name: 'Kensico · White Plains', start: 0, end: 5000, key: 'brp_kensico', label: 'White Plains', lanes: 2 },
      { name: 'Hartsdale · Scarsdale', start: 5000, end: 13000, key: 'brp_scarsdale', label: 'Scarsdale', lanes: 2 },
      { name: 'Tuckahoe · Bronxville', start: 13000, end: 20000, key: 'brp_bronxville', label: 'Bronxville', lanes: 2 },
      { name: 'Wakefield · Woodlawn', start: 20000, end: 27000, key: 'brp_woodlawn', label: 'North Bronx', lanes: 2 },
      { name: 'Bronx Park · West Farms', start: 27000, end: 33000, key: 'brp_bronx', label: 'The Bronx', lanes: 2 },
      { name: 'Story Avenue · Bruckner', start: 33000, end: 35000, key: 'brp_story', label: 'Soundview', lanes: 2 },
      { name: 'Bruckner Expressway · I-278', start: 35000, end: 39000, key: 'brp_bruckner', label: 'East Bronx', lanes: 3 },
      { name: 'I-295 · Throgs Neck Approach', start: 39000, end: 41000, key: 'brp_i295_bronx', label: 'Throgs Neck', lanes: 3 },
      { name: 'Throgs Neck Bridge', start: 41000, end: 44500, key: 'brp_throgs', label: 'Throgs Neck Bridge', lanes: 3 },
      { name: 'Clearview · Bayside', start: 44500, end: 48500, key: 'brp_bayside', label: 'Bayside', lanes: 3 },
      { name: 'Clearview · I-495', start: 48500, end: 50500, key: 'brp_i495', label: 'Fresh Meadows', lanes: 3 },
      { name: 'Clearview · Queens Village', start: 50500, end: 53000, key: 'brp_queensvillage', label: 'Queens Village', lanes: 3 },
    ],
    SPAWNS: [
      { label: 'Kensico Circle · White Plains', s: 900 },
      { label: 'Scarsdale', s: 8500 },
      { label: 'Bronxville', s: 16000 },
      { label: 'Bronx Zoo · Bronx Park', s: 28500 },
      { label: 'Story Avenue · BRP Terminus', s: 33800 },
      { label: 'Bruckner Interchange · I-295', s: 39200 },
      { label: 'Throgs Neck Bridge', s: 42500 },
      { label: 'I-495 · Long Island Expressway', s: 49300 },
      { label: 'Queens Village · Hillside Avenue', s: 52100 },
    ],
    EXITS: [
      { s: 1200, num: 27, name: 'Kensico Circle · NY 22' },
      { s: 4800, num: 23, name: 'Main Street · White Plains' },
      { s: 8200, num: 15, name: 'Fenimore Road · Hartsdale' },
      { s: 11200, num: 12, name: 'Crane Road · Scarsdale' },
      { s: 15400, num: 8, name: 'Oak Street · Bronxville' },
      { s: 18500, num: 7, name: 'Cross County Parkway' },
      { s: 22100, num: 10, name: 'East 233rd Street' },
      { s: 25800, num: 9, name: 'Gun Hill Road' },
      { s: 28200, num: 7, name: 'Pelham Parkway · Fordham Road' },
      { s: 31100, num: 4, name: 'Cross Bronx Expressway · I-95' },
      { s: 33700, num: 1, name: 'Story Avenue · Bruckner Expressway' },
      { s: 36500, num: 52, name: 'Hutchinson River Parkway' },
      { s: 39500, num: 6, name: 'I-95 North · New Haven' },
      { s: 44800, num: 9, name: 'Cross Island Parkway' },
      { s: 46600, num: 6, name: '35th Avenue · Bayside' },
      { s: 47800, num: 5, name: 'Northern Boulevard · NY 25A' },
      { s: 49300, num: 4, name: 'I-495 · Long Island Expressway' },
      { s: 51100, num: 2, name: 'Union Turnpike' },
      { s: 52400, num: 1, name: 'Hillside Avenue · NY 25' },
    ],
  },
  nc40: {
    // East of Benson on I-40 → west through Raleigh/Greensboro, then south
    // on I-85 to Charlotte. Logical distance is approximately real mileage.
    LOOP_LENGTH: 350000,
    ZONES: [
      { name: 'Johnston County · I-40 East', start: 0, end: 16000, key: 'nc40_east', label: 'Johnston County', lanes: 2 },
      { name: 'Benson · I-40/I-95', start: 16000, end: 32000, key: 'nc40_benson', label: 'Benson', lanes: 3 },
      { name: 'Clayton · Garner · I-40', start: 32000, end: 78000, key: 'nc40_johnston', label: 'Clayton', lanes: 3 },
      { name: 'Raleigh · I-40', start: 78000, end: 112000, key: 'nc40_raleigh', label: 'Raleigh', lanes: 4 },
      { name: 'Cary · RDU · Durham', start: 112000, end: 151000, key: 'nc40_triangle', label: 'Research Triangle', lanes: 4 },
      { name: 'Burlington · I-40', start: 151000, end: 190000, key: 'nc40_burlington', label: 'Burlington', lanes: 3 },
      { name: 'Greensboro · I-40/I-85', start: 190000, end: 230000, key: 'nc40_greensboro', label: 'Greensboro', lanes: 4 },
      { name: 'High Point · Thomasville · I-85', start: 230000, end: 265000, key: 'nc40_highpoint', label: 'High Point', lanes: 3 },
      { name: 'Salisbury · I-85', start: 265000, end: 305000, key: 'nc40_salisbury', label: 'Salisbury', lanes: 3 },
      { name: 'Concord · Charlotte · I-85', start: 305000, end: 350000, key: 'nc40_charlotte', label: 'Charlotte', lanes: 4 },
    ],
    SPAWNS: [
      { label: 'East I-40 Terminus', s: 1000 }, { label: 'I-95 · Benson', s: 22000 },
      { label: 'Raleigh', s: 93000 }, { label: 'RDU · Cary', s: 126000 },
      { label: 'Greensboro', s: 210000 }, { label: 'High Point', s: 242000 },
      { label: 'Salisbury', s: 280000 }, { label: 'Charlotte', s: 337000 },
    ],
    EXITS: [
      { s: 6000, num: 334, name: 'NC 96 · Johnston County' },
      { s: 17800, num: '328B', name: 'I-95 North · Smithfield · Benson' },
      { s: 18200, num: '328A', name: 'I-95 South · Fayetteville · Benson' },
      { s: 41000, num: 319, name: 'NC 242 · Benson' },
      { s: 72000, num: 306, name: 'NC 42 · Clayton / Raleigh' },
      { s: 88000, num: 301, name: 'I-440 · Raleigh Beltline' },
      { s: 124000, num: 284, name: 'NC 540 · RDU / Cary' },
      { s: 132000, num: 280, name: 'Airport Blvd · RDU' },
      { s: 194000, num: 218, name: 'I-840 · Greensboro Loop' },
      { s: 211000, num: 214, name: 'US 29 · Downtown Greensboro' },
      { s: 232000, num: 118, name: 'US 311 · High Point' },
      { s: 270000, num: 79, name: 'US 52 · Salisbury' },
      { s: 315000, num: 49, name: 'I-485 · Charlotte' },
      { s: 338000, num: 38, name: 'Sugar Creek Rd · Charlotte' },
    ],
  },
  tx45: {
    // Dallas ↔ Houston on I-45, true-scale length (~241 mi / 388 km).
    LOOP_LENGTH: 388000,
    ZONES: [
      { name: 'Downtown Dallas · I-45', start: 0, end: 18000, key: 'tx_dallas', label: 'Dallas', lanes: 5 },
      { name: 'Dallas South · I-45', start: 18000, end: 52000, key: 'tx_lancaster', label: 'South Dallas', lanes: 4 },
      { name: 'Corsicana · I-45', start: 52000, end: 128000, key: 'tx_corsicana', label: 'Corsicana', lanes: 3 },
      { name: 'Palestine · I-45', start: 128000, end: 205000, key: 'tx_palestine', label: 'Palestine', lanes: 2 },
      { name: 'Huntsville · I-45', start: 205000, end: 286000, key: 'tx_huntsville', label: 'Huntsville', lanes: 3 },
      { name: 'The Woodlands · I-45', start: 286000, end: 342000, key: 'tx_woodlands', label: 'The Woodlands', lanes: 4 },
      { name: 'Downtown Houston · I-45', start: 342000, end: 388000, key: 'tx_houston', label: 'Houston', lanes: 5 },
    ],
    SPAWNS: [
      { label: 'Downtown Dallas', s: 1200 }, { label: 'Corsicana', s: 80000 },
      { label: 'Palestine', s: 155000 }, { label: 'Huntsville', s: 238000 },
      { label: 'The Woodlands', s: 313000 }, { label: 'Downtown Houston', s: 371000 },
    ],
    EXITS: [
      { s: 1200, num: 425, name: 'Downtown Dallas · I-30' },
      { s: 7200, num: 426, name: 'US-175 · Hutchins' },
      { s: 19000, num: 275, name: 'TX-342 · Red Oak' },
      { s: 41000, num: 239, name: 'I-20 · Waxahachie' },
      { s: 76000, num: 239, name: 'US-287 · Corsicana' },
      { s: 128000, num: 198, name: 'US-79 · Palestine' },
      { s: 188000, num: 178, name: 'US-84 · Fairfield' },
      { s: 238000, num: 116, name: 'US-190 · Huntsville' },
      { s: 294000, num: 79, name: 'TX-242 · The Woodlands' },
      { s: 331000, num: 48, name: 'Sam Houston Tollway' },
      { s: 371000, num: 44, name: 'Downtown Houston · I-10' },
    ],
  },
  nh48: {
    // Mumbai → Bengaluru on the real NH-48 corridor, approximately 1,020 km.
    // The physical road is compressed by DISTANCE_SCALE while its route
    // mileage, towns, weather and traffic progression remain corridor-based.
    LOOP_LENGTH: 1020000,
    ZONES: [
      { name: 'Mumbai · NH48', start: 0, end: 52000, key: 'nh48_mumbai', label: 'Mumbai', lanes: 5 },
      { name: 'Panvel · NH48', start: 52000, end: 90000, key: 'nh48_panvel', label: 'Panvel', lanes: 4 },
      { name: 'Lonavala–Khandala Ghats', start: 90000, end: 138000, key: 'nh48_ghat', label: 'Lonavala', lanes: 3 },
      { name: 'Pune · NH48', start: 138000, end: 205000, key: 'nh48_pune', label: 'Pune', lanes: 4 },
      { name: 'Satara · NH48', start: 205000, end: 300000, key: 'nh48_satara', label: 'Satara', lanes: 3 },
      { name: 'Karad–Sangli · NH48', start: 300000, end: 360000, key: 'nh48_karad', label: 'Karad', lanes: 3 },
      { name: 'Kolhapur · NH48', start: 360000, end: 430000, key: 'nh48_kolhapur', label: 'Kolhapur', lanes: 3 },
      { name: 'Karnataka Border · NH48', start: 430000, end: 470000, key: 'nh48_border', label: 'Nipani', lanes: 3 },
      { name: 'Belagavi · NH48', start: 470000, end: 535000, key: 'nh48_belagavi', label: 'Belagavi', lanes: 3 },
      { name: 'Dharwad–Hubballi · NH48', start: 535000, end: 610000, key: 'nh48_hubballi', label: 'Hubballi', lanes: 3 },
      { name: 'Haveri–Ranebennur · NH48', start: 610000, end: 690000, key: 'nh48_haveri', label: 'Haveri', lanes: 2 },
      { name: 'Davanagere–Chitradurga · NH48', start: 690000, end: 800000, key: 'nh48_davanagere', label: 'Davanagere', lanes: 3 },
      { name: 'Tumakuru · NH48', start: 800000, end: 930000, key: 'nh48_tumakuru', label: 'Tumakuru', lanes: 3 },
      { name: 'Bengaluru · NH48', start: 930000, end: 1020000, key: 'nh48_bengaluru', label: 'Bengaluru', lanes: 5 },
    ],
    SPAWNS: [
      { label: 'Mumbai · Bandra', s: 1200 }, { label: 'Pune', s: 165000 },
      { label: 'Kolhapur', s: 390000 }, { label: 'Belagavi', s: 500000 },
      { label: 'Hubballi', s: 570000 }, { label: 'Davanagere', s: 725000 },
      { label: 'Tumakuru', s: 860000 }, { label: 'Bengaluru', s: 990000 },
    ],
    EXITS: [
      { s: 1200, num: 1, name: 'Mumbai · Sion–Panvel Expressway' },
      { s: 52000, num: 12, name: 'Panvel · JNPT / Navi Mumbai' },
      { s: 92000, num: 18, name: 'Lonavala · Khandala Ghats' },
      { s: 145000, num: 27, name: 'Pune · Wakad / Hinjawadi' },
      { s: 203000, num: 34, name: 'Pune · Katraj / Satara Road' },
      { s: 245000, num: 43, name: 'Satara' }, { s: 315000, num: 56, name: 'Karad' },
      { s: 378000, num: 67, name: 'Kolhapur' }, { s: 438000, num: 74, name: 'Nipani' },
      { s: 477000, num: 84, name: 'Belagavi' }, { s: 548000, num: 96, name: 'Dharwad' },
      { s: 575000, num: 103, name: 'Hubballi' }, { s: 625000, num: 113, name: 'Haveri' },
      { s: 705000, num: 128, name: 'Davanagere' }, { s: 758000, num: 138, name: 'Chitradurga' },
      { s: 820000, num: 151, name: 'Tumakuru' }, { s: 935000, num: 170, name: 'Nelamangala · Bengaluru' },
      { s: 990000, num: 178, name: 'Bengaluru · Tumakuru Road' },
    ],
  },
  flturnpike: {
    // Florida's Turnpike mainline, Miami Gardens → Wildwood, ~481 mi.
    LOOP_LENGTH: 774000,
    ZONES: [
      { name: 'Miami · Turnpike', start: 0, end: 38000, key: 'fltp_miami', label: 'Miami', lanes: 5 },
      { name: 'Broward · Turnpike', start: 38000, end: 105000, key: 'fltp_broward', label: 'Broward', lanes: 4 },
      { name: 'Treasure Coast · Turnpike', start: 105000, end: 205000, key: 'fltp_treasure', label: 'Treasure Coast', lanes: 3 },
      { name: 'Palm Beach · Turnpike', start: 205000, end: 285000, key: 'fltp_palm', label: 'Palm Beach', lanes: 4 },
      { name: 'Lake Okeechobee · Turnpike', start: 285000, end: 388000, key: 'fltp_lake', label: 'Lake Okeechobee', lanes: 2 },
      { name: 'Orlando · Turnpike', start: 388000, end: 515000, key: 'fltp_orlando', label: 'Orlando', lanes: 4 },
      { name: 'Ocala · Turnpike', start: 515000, end: 650000, key: 'fltp_ocala', label: 'Ocala', lanes: 3 },
      { name: 'Wildwood · Turnpike', start: 650000, end: 774000, key: 'fltp_wildwood', label: 'Wildwood', lanes: 3 },
    ],
    SPAWNS: [
      { label: 'Miami Gardens', s: 1200 }, { label: 'Fort Lauderdale', s: 52000 },
      { label: 'Port St. Lucie', s: 142000 }, { label: 'West Palm Beach', s: 232000 },
      { label: 'Orlando South', s: 438000 }, { label: 'Ocala', s: 578000 },
      { label: 'Wildwood', s: 751000 },
    ],
    EXITS: [
      { s: 1200, num: 2, name: 'Miami Gardens · Golden Glades' },
      { s: 18000, num: 16, name: 'Miramar · Pembroke Pines' },
      { s: 51000, num: 54, name: 'Fort Lauderdale · I-595' },
      { s: 92000, num: 81, name: 'West Palm Beach · Okeechobee Blvd' },
      { s: 142000, num: 138, name: 'Port St. Lucie · FL-70' },
      { s: 228000, num: 193, name: 'Boynton Beach · Atlantic Ave' },
      { s: 314000, num: 249, name: 'Lake Okeechobee · US-27' },
      { s: 424000, num: 249, name: 'Orlando South · US-17/92' },
      { s: 482000, num: 267, name: 'Orlando · Beachline Expressway' },
      { s: 571000, num: 301, name: 'Ocala · US-27' },
      { s: 653000, num: 309, name: 'Wildwood · I-75' },
      { s: 744000, num: 328, name: 'Florida Turnpike Northern Terminus' },
    ],
  },
  i95: {
    // TRUE-SCALE south of Wilmington DE: s continues at real mileage,
    // exit number = state mile marker (state's own south-line = mile 0),
    // same convention GSP/I-75-Dayton use. DE 96000→133700, MD →309100,
    // VA →596700, NC →888500, SC →1208400, GA →1388700, FL →2003600 (Miami).
    // The old Boston/Providence/New London northeast leg is unchanged
    // content, just pushed out by SHIFT=1907600 so the loop still closes.
    LOOP_LENGTH: 2043600,
    ZONES: [
      { name: 'New Haven · I-95',       start: 0,     end: 5000,  key: 'newhaven',    label: 'New Haven',   lanes: 3 },
      { name: 'CT Shoreline · I-95',    start: 5000,  end: 31500, key: 'corridor',    label: 'Shoreline',   lanes: 3 },
      { name: 'Westchester · I-95',     start: 31500, end: 36500, key: 'westchester', label: 'Westchester', lanes: 3 },
      { name: 'South Bronx · I-95',     start: 36500, end: 44000, key: 'bronx',       label: 'NYC',         lanes: 4 },
      { name: 'NJ Turnpike · Carteret / EWR / Meadowlands', start: 44000, end: 60000, key: 'nj_industrial', label: 'Carteret · Newark', lanes: 6 },
      { name: 'NJ Turnpike · Central New Jersey', start: 60000, end: 73000, key: 'nj_central', label: 'Central Jersey', lanes: 6 },
      { name: 'NJ Turnpike · South',    start: 73000, end: 77000, key: 'njsouth',     label: 'Burlington',  lanes: 3 },
      { name: 'Philadelphia · I-95',    start: 77000, end: 91000, key: 'philly',      label: 'Philly',      lanes: 3 },
      { name: 'Southern PA · I-95',     start: 91000, end: 96000, key: 'pa',          label: 'PA',          lanes: 3 },
      // TRUE-SCALE south: Wilmington DE line → Miami FL, real mileage
      // (s = 96000 + cumulative real miles × 1609). See generator notes above.
      { name: 'New Castle County · I-95', start: 96000, end: 120800, key: 'de_newark', label: 'Newark DE', lanes: 3 },
      { name: 'Wilmington · I-95', start: 120800, end: 133700, key: 'de_wilmington', label: 'Wilmington', lanes: 4 },
      { name: 'Cecil County · I-95', start: 133700, end: 159400, key: 'md_perryville', label: 'Perryville', lanes: 3 },
      { name: 'Harford County · I-95', start: 159400, end: 201300, key: 'md_harford', label: 'Harford Co', lanes: 3 },
      { name: 'Baltimore · I-95', start: 201300, end: 230200, key: 'md_baltimore', label: 'Baltimore', lanes: 5 },
      { name: 'Laurel · Elkridge · I-95', start: 230200, end: 252800, key: 'md_laurel', label: 'Laurel', lanes: 4 },
      { name: 'Capital Beltway · I-95/I-495', start: 252800, end: 309100, key: 'md_beltway', label: 'Cap Beltway', lanes: 5 },
      { name: 'Springfield · I-95/I-395', start: 309100, end: 324800, key: 'va_springfield', label: 'Springfield', lanes: 5 },
      { name: 'Fredericksburg · I-95', start: 324800, end: 393900, key: 'va_fredvburg', label: 'Fredericksburg', lanes: 3 },
      { name: 'Ashland · I-95', start: 393900, end: 461500, key: 'va_ashland', label: 'Ashland', lanes: 3 },
      { name: 'Richmond · I-95', start: 461500, end: 488900, key: 'va_richmond', label: 'Richmond', lanes: 5 },
      { name: 'Petersburg · I-95', start: 488900, end: 522700, key: 'va_petersburg', label: 'Petersburg', lanes: 4 },
      { name: 'Southside VA · I-95', start: 522700, end: 596700, key: 'va_southside', label: 'Emporia', lanes: 2 },
      { name: 'Roanoke Rapids · I-95', start: 596700, end: 666500, key: 'nc_roanokerap', label: 'Roanoke Rapids', lanes: 2 },
      { name: 'Rocky Mount · I-95', start: 666500, end: 732400, key: 'nc_rockymount', label: 'Rocky Mount', lanes: 3 },
      { name: 'Fayetteville · I-95', start: 732400, end: 798400, key: 'nc_fayetteville', label: 'Fayetteville', lanes: 3 },
      { name: 'Lumberton · I-95', start: 798400, end: 888500, key: 'nc_lumberton', label: 'Lumberton', lanes: 2 },
      { name: 'Dillon · I-95', start: 888500, end: 950900, key: 'sc_dillon', label: 'Dillon', lanes: 2 },
      { name: 'Florence · I-95', start: 950900, end: 1044300, key: 'sc_florence', label: 'Florence', lanes: 3 },
      { name: 'Santee · Lake Marion · I-95', start: 1044300, end: 1123100, key: 'sc_santee', label: 'Santee', lanes: 2 },
      { name: 'Low Country · I-95', start: 1123100, end: 1208400, key: 'sc_walterboro', label: 'Walterboro', lanes: 2 },
      { name: 'Midway · Riceboro · I-95', start: 1208400, end: 1266400, key: 'ga_midway', label: 'Midway', lanes: 2 },
      { name: 'Savannah · I-95', start: 1266400, end: 1342000, key: 'ga_savannah', label: 'Savannah', lanes: 4 },
      { name: 'Kingsland · St. Marys · I-95', start: 1342000, end: 1388700, key: 'ga_kingsland', label: 'Kingsland', lanes: 2 },
      { name: 'Jacksonville · I-95', start: 1388700, end: 1585200, key: 'fl_jax', label: 'Jacksonville', lanes: 5 },
      { name: 'Daytona Beach · I-95', start: 1585200, end: 1680200, key: 'fl_daytona', label: 'Daytona Beach', lanes: 3 },
      { name: 'Space Coast · I-95', start: 1680200, end: 1767100, key: 'fl_melbourne', label: 'Melbourne', lanes: 3 },
      { name: 'Fort Pierce · I-95', start: 1767100, end: 1841100, key: 'fl_stlucie', label: 'Fort Pierce', lanes: 3 },
      { name: 'West Palm Beach · I-95', start: 1841100, end: 1897400, key: 'fl_wpb', label: 'West Palm Beach', lanes: 5 },
      { name: 'Fort Lauderdale · I-95', start: 1897400, end: 1963400, key: 'fl_ftlaud', label: 'Fort Lauderdale', lanes: 6 },
      { name: 'Miami · I-95', start: 1963400, end: 2003600, key: 'fl_miami', label: 'Miami', lanes: 6 },
      // Northeast extension: New Haven wraps back up the shoreline (decreasing s
      // = NB) through New London and Providence to Boston. Increasing s = SB.
      // Pushed out by SHIFT=1907600 so the loop closes past the FL extension.
      { name: 'Boston · I-95',          start: 2003600,  end: 2012600, key: 'boston95',   label: 'Boston',      lanes: 4 },
      { name: 'Providence · I-95',      start: 2012600, end: 2025600, key: 'providence',  label: 'Providence',  lanes: 4 },
      { name: 'CT Shoreline · I-95 E',  start: 2025600, end: 2043600, key: 'ctshore',     label: 'New London',  lanes: 3 },
    ],
    // Listed in true geographical order, NORTH → SOUTH. The New England leg
    // (Boston = the northernmost point) sits at high s because it's the
    // loop-back, but geographically it's the top of I-95, so it leads the list;
    // then New Haven down the corridor to Miami (the southern terminus).
    SPAWNS: [
      { label: 'Boston · Downtown', s: 2006100 },
      { label: 'Foxborough', s: 2010600 },
      { label: 'Providence', s: 2016100 },
      { label: 'Warwick · T.F. Green ✈', s: 2021600 },
      { label: 'Mystic', s: 2027100 },
      { label: 'New London', s: 2029600 },
      { label: 'Old Saybrook', s: 2037100 },
      { label: 'Guilford', s: 2040600 },
      { label: 'New Haven · I-91 Exit', s: 700 },
      { label: 'White Plains', s: 33200 },
      { label: 'GWB approach · I-80 merge (NJ)', s: 45000 },
      { label: 'EWR ✈', s: 52150 },
      { label: 'New Brunswick', s: 62100 },
      { label: 'Trenton', s: 70900 },
      { label: 'Wilmington DE', s: 108500 },
      { label: 'Baltimore', s: 225400 },
      { label: 'Capital Beltway · DC', s: 294600 },
      { label: 'Fredericksburg', s: 393900 },
      { label: 'Richmond', s: 477600 },
      { label: 'Petersburg', s: 514600 },
      { label: 'Rocky Mount', s: 666500 },
      { label: 'Fayetteville', s: 798400 },
      { label: 'Florence SC', s: 955800 },
      { label: 'Walterboro', s: 1123100 },
      { label: 'Savannah', s: 1229400 },
      { label: 'Kingsland', s: 1383800 },
      { label: 'Jacksonville', s: 1467800 },
      { label: 'Daytona Beach', s: 1591700 },
      { label: 'Melbourne', s: 1714000 },
      { label: 'Fort Pierce', s: 1796000 },
      { label: 'West Palm Beach', s: 1897400 },
      { label: 'Fort Lauderdale', s: 1963400 },
      { label: 'Miami · Downtown', s: 1997100 },
    ],
    // Real-ish southbound exit sequence, New Haven CT 47 → Chester PA 3.
    EXITS: [
      { s: 900,   num: 47,    name: 'Downtown New Haven' },
      { s: 1400,  num: 48,    name: 'I-91 N · New England · Boston' },
      { s: 2700,  num: 46,    name: 'Long Wharf · Sargent Dr' },
      { s: 6800,  num: 40,    name: 'Milford' },
      { s: 10600, num: 33,    name: 'Stratford' },
      { s: 13800, num: 27,    name: 'Bridgeport' },
      { s: 17400, num: 21,    name: 'Fairfield' },
      { s: 21200, num: 15,    name: 'Norwalk · US-7' },
      { s: 25400, num: 8,     name: 'Stamford' },
      { s: 29000, num: 3,     name: 'Greenwich' },
      { s: 31200, num: 1,     name: 'Byram · NY Line' },
      { s: 31900, num: 21,    name: 'Port Chester' },
      { s: 32700, num: 19,    name: 'Rye · Playland Pkwy' },
      { s: 33500, num: 18,    name: 'Mamaroneck · US-1' },
      { s: 34400, num: 16,    name: 'New Rochelle' },
      { s: 35300, num: 15,    name: 'Pelham · Hutchinson Pkwy' },
      { s: 36700, num: 11,    name: 'Co-op City · Bartow Ave' },
      { s: 38800, num: '6A',  name: 'Bruckner Blvd' },
      { s: 41000, num: '4B',  name: 'Webster Ave' },
      { s: 42800, num: 2,     name: 'Jerome Ave' },
      { s: 43400, num: 1,     name: 'GW Bridge · Last Exit NY' },
      { s: 44900, num: 73,    name: 'Fort Lee · Palisades Pkwy' },
      { s: 45400, num: '72',  name: 'I-80 W · Paterson · Chicago' },
      { s: 48600, num: '16E', name: 'Lincoln Tunnel' },
      { s: 51000, num: '15E', name: 'Newark · Jersey City' },
      { s: 52600, num: 14,    name: 'Newark Airport ✈ · I-78' },
      { s: 56200, num: 13,    name: 'Elizabeth' },
      { s: 58200, num: 12,    name: 'Carteret' },
      { s: 59800, num: 11,    name: 'Woodbridge · GSP' },
      { s: 60600, num: 10,    name: 'Edison · I-287 · Metuchen' },
      { s: 62300, num: 9,     name: 'New Brunswick' },
      { s: 67000, num: '8A',  name: 'Jamesburg' },
      { s: 69200, num: 8,     name: 'Hightstown' },
      { s: 71200, num: '7A',  name: 'Trenton · I-195' },
      { s: 73200, num: 7,     name: 'Bordentown' },
      { s: 74900, num: 6,     name: 'PA Turnpike' },
      { s: 76300, num: 5,     name: 'Burlington' },
      { s: 78600, num: 32,    name: 'Academy Rd' },
      { s: 80300, num: 30,    name: 'Cottman Ave' },
      { s: 82000, num: 27,    name: 'Bridge St' },
      { s: 83600, num: 25,    name: 'Allegheny Ave' },
      { s: 85200, num: 22,    name: 'Center City · I-676' },
      { s: 86600, num: 19,    name: 'Columbus Blvd' },
      { s: 88000, num: 13,    name: 'Phila Intl Airport ✈' },
      { s: 89600, num: 10,    name: 'Essington' },
      { s: 90800, num: 3,     name: 'Chester' },
      { s: 92800, num: 2,     name: 'US-322 · Conchester Hwy' },
      { s: 94600, num: 1,     name: 'Wilmington · DE Line' },
      // TRUE-SCALE south, Wilmington DE → Miami FL: exit number = real state
      // mile marker (each state resets to its own max at the north/prior-state
      // line, decreasing southbound), s per the generator note above.
      { s: 96500, num: '11', name: 'DE-92 · Claymont' },
      { s: 99400, num: '10', name: 'Harvey Road' },
      { s: 102900, num: '9', name: 'DE-3 · Bellevue State Park' },
      { s: 106400, num: '8', name: 'US-202 · Concord Pike' },
      { s: 108500, num: '7', name: 'DE-52 · Downtown Wilmington' },
      { s: 109900, num: '6', name: 'DE-4 · Wilmington Riverfront' },
      { s: 114800, num: '5A', name: 'US-202/I-295 · New Castle · NJ' },
      { s: 120800, num: '4', name: 'DE-1/DE-7 · Dover · Beaches' },
      { s: 123000, num: '3', name: 'DE-273 · Newark · Christiana' },
      { s: 129900, num: '1', name: 'DE-896 · Newark · Middletown' },
      { s: 133700, num: '109', name: 'MD-279 · Elkton · DE Line' },
      { s: 148200, num: '100', name: 'MD-7 · Charlestown' },
      { s: 159400, num: '93', name: 'MD-222 · Perryville Toll' },
      { s: 172300, num: '85', name: 'US-40 · Havre de Grace' },
      { s: 177300, num: '82', name: 'Maryland House Service Plaza' },
      { s: 185200, num: '77', name: 'MD-543 · Riverside · Aberdeen' },
      { s: 201300, num: '67', name: 'MD-24/MD-924 · Bel Air South' },
      { s: 207700, num: '63', name: 'MD-152 · Kingsville' },
      { s: 215800, num: '58', name: 'MD-43 · White Marsh' },
      { s: 222200, num: '54', name: 'I-895 · Baltimore Harbor Tunnel' },
      { s: 223800, num: '53', name: 'I-895/Fort McHenry Tunnel' },
      { s: 225400, num: '52', name: 'MLK Blvd · Downtown Baltimore' },
      { s: 230200, num: '49', name: 'I-395 · Downtown Baltimore' },
      { s: 233500, num: '47', name: 'MD-295 · BWI Airport ✈' },
      { s: 239900, num: '43', name: 'MD-175 · Jessup' },
      { s: 247900, num: '38', name: 'MD-100 · Elkridge' },
      { s: 252800, num: '35', name: 'MD-216 · Laurel' },
      { s: 256000, num: '33', name: 'MD-198 · Laurel' },
      { s: 265600, num: '27', name: 'I-495 · College Park Split' },
      { s: 273700, num: '22', name: 'MD-193 · Greenbelt' },
      { s: 281700, num: '17', name: 'US-50 · New Carrollton' },
      { s: 291400, num: '11', name: 'MD-4 · Pennsylvania Ave' },
      { s: 294600, num: '9', name: 'MD-337 · Andrews AFB' },
      { s: 302200, num: '4', name: 'MD-414 · Oxon Hill' },
      { s: 306300, num: '2', name: 'I-295 · National Harbor' },
      { s: 324800, num: '170', name: 'I-395/I-495 · Springfield Interchange' },
      { s: 339200, num: '160', name: 'VA-123 · Newington' },
      { s: 358500, num: '148', name: 'VA-3 · Fredericksburg' },
      { s: 382700, num: '133', name: 'US-17 · Warrenton Business' },
      { s: 393900, num: '126', name: 'US-1/US-17 · Fredericksburg' },
      { s: 406800, num: '118', name: 'VA-207 · Bowling Green' },
      { s: 429300, num: '104', name: 'VA-207 · Carmel Church' },
      { s: 448600, num: '92', name: 'VA-54 · Ashland' },
      { s: 461500, num: '84', name: 'I-295 · Richmond Bypass' },
      { s: 469600, num: '79', name: 'I-64 W/I-195 · Charlottesville' },
      { s: 476000, num: '75', name: 'I-64 E · Williamsburg · Norfolk' },
      { s: 477600, num: '74A', name: 'VA-195 · Downtown Richmond' },
      { s: 488900, num: '67', name: 'VA-150 · Chippenham Pkwy' },
      { s: 498500, num: '61', name: 'VA-10 · Chester' },
      { s: 513000, num: '52', name: 'I-85 S/US-460 · Petersburg' },
      { s: 514600, num: '51', name: 'US-460 · Downtown Petersburg' },
      { s: 521100, num: '47', name: 'VA-36 · Petersburg' },
      { s: 522700, num: '46', name: 'I-295 N · Washington' },
      { s: 537100, num: '37', name: 'VA-40 · McKenney' },
      { s: 569300, num: '17', name: 'US-58 · South Hill' },
      { s: 579000, num: '11', name: 'US-58 · Emporia' },
      { s: 590200, num: '4', name: 'SR-629 · Skippers' },
      { s: 610200, num: '173', name: 'US-158 · Roanoke Rapids' },
      { s: 631100, num: '160', name: 'US-301 · Enfield' },
      { s: 647200, num: '150', name: 'NC-481 · Whitakers' },
      { s: 666500, num: '138B', name: 'US-64 · Rocky Mount · Raleigh' },
      { s: 679300, num: '130', name: 'NC-42 · Wilson' },
      { s: 693800, num: '121', name: 'US-264 · Wilson' },
      { s: 716300, num: '107', name: 'NC-96 · Kenly' },
      { s: 732400, num: '97', name: 'US-70 · Selma · Goldsboro' },
      { s: 743700, num: '90', name: 'US-701 · Newton Grove' },
      { s: 758200, num: '81', name: 'I-40 · Wilmington · Durham' },
      { s: 772700, num: '72', name: 'NC-24 · Warsaw' },
      { s: 798400, num: '56', name: 'US-301 S · Fayetteville' },
      { s: 814500, num: '46', name: 'NC-87 · Elizabethtown' },
      { s: 824100, num: '40', name: 'US-301 N · Fayetteville' },
      { s: 827400, num: '38', name: 'I-295 · Fort Bragg' },
      { s: 853100, num: '22', name: 'NC-71 · St. Pauls' },
      { s: 867600, num: '13', name: 'I-74/US-74 · Lumberton' },
      { s: 885300, num: '2', name: 'NC-130 · Rowland · Fairmont' },
      { s: 897800, num: '193', name: 'SC-9 · Dillon · Bennettsville' },
      { s: 917100, num: '181', name: 'US-501 · Latta' },
      { s: 944500, num: '164', name: 'US-52 · Florence · Darlington' },
      { s: 950900, num: '160', name: 'I-20 · Columbia · Florence' },
      { s: 955800, num: '157', name: 'US-76 · Florence · Timmonsville' },
      { s: 991200, num: '135', name: 'SC-341 · Olanta' },
      { s: 1034600, num: '108', name: 'SC-341 · Manning' },
      { s: 1044300, num: '102', name: 'US-15/US-301 · Manning' },
      { s: 1050700, num: '98', name: 'SC-6 · Santee · Eutawville' },
      { s: 1063600, num: '90', name: 'US-176 · Holly Hill' },
      { s: 1070000, num: '86', name: 'I-26 · Charleston · Columbia' },
      { s: 1084500, num: '77', name: 'US-78 · St. George' },
      { s: 1107000, num: '63', name: 'SC-64 · Ridgeville' },
      { s: 1123100, num: '53', name: 'SC-63 · Walterboro' },
      { s: 1140800, num: '42', name: 'US-21 · Yemassee' },
      { s: 1155300, num: '33', name: 'US-17 · Charleston · Beaufort' },
      { s: 1173000, num: '22', name: 'US-17 · Ridgeland' },
      { s: 1195500, num: '8', name: 'US-278 · Hilton Head Island' },
      { s: 1200300, num: '5', name: 'US-17 · Hardeeville' },
      { s: 1213300, num: '109', name: 'SR-21 · Port Wentworth' },
      { s: 1218100, num: '106', name: 'SR-17 · Savannah' },
      { s: 1224500, num: '102', name: 'US-80 · Pooler' },
      { s: 1229400, num: '99', name: 'I-16 · Savannah Downtown' },
      { s: 1237400, num: '94', name: 'SR-204 · Savannah' },
      { s: 1248700, num: '87', name: 'US-17 · Richmond Hill' },
      { s: 1266400, num: '76', name: 'US-84 · Midway' },
      { s: 1280900, num: '67', name: 'US-17 · Riceboro' },
      { s: 1309800, num: '49', name: 'SR-251 · Darien' },
      { s: 1321100, num: '42', name: 'SR-99 · Darien' },
      { s: 1330700, num: '36', name: 'US-341 · Brunswick' },
      { s: 1342000, num: '29', name: 'US-17 · Brunswick · Golden Isles' },
      { s: 1379000, num: '6', name: 'SR-259 · Kingsland' },
      { s: 1383800, num: '3', name: 'SR-40 · Kingsland · St. Marys' },
      { s: 1387000, num: '1', name: 'St. Marys Road' },
      { s: 1421100, num: '362', name: 'Welcome to Florida · GA Line' },
      { s: 1427600, num: '358', name: 'SR-A1A · Yulee' },
      { s: 1435600, num: '353', name: 'I-295 N · Jax North Beltway' },
      { s: 1450100, num: '344', name: 'Airport Rd · Jacksonville Intl ✈' },
      { s: 1458100, num: '339', name: 'SR-9B · Downtown Jacksonville' },
      { s: 1467800, num: '333', name: 'I-10 · Downtown Jacksonville' },
      { s: 1480700, num: '325', name: 'SR-13 · San Jose Blvd' },
      { s: 1487100, num: '321', name: 'I-295 S · Jax South Beltway' },
      { s: 1512800, num: '305', name: 'SR-206 · St. Augustine' },
      { s: 1546600, num: '284', name: 'SR-207 · St. Augustine' },
      { s: 1585200, num: '260', name: 'I-4 · Daytona Beach · Orlando' },
      { s: 1591700, num: '256', name: 'US-92 · Daytona Beach' },
      { s: 1611000, num: '244', name: 'SR-44 · New Smyrna Beach' },
      { s: 1631900, num: '231', name: 'SR-442 · Edgewater' },
      { s: 1673700, num: '205', name: 'SR-528 · Cape Canaveral · Orlando' },
      { s: 1680200, num: '201', name: 'SR-520 · Cocoa' },
      { s: 1696300, num: '191', name: 'Fisk Blvd · Rockledge' },
      { s: 1714000, num: '180', name: 'US-192 · Melbourne' },
      { s: 1725200, num: '173', name: 'Palm Bay Road' },
      { s: 1752600, num: '156', name: 'SR-514 · Micco' },
      { s: 1767100, num: '147', name: 'SR-60 · Vero Beach' },
      { s: 1781500, num: '138', name: 'SR-70 · Fort Pierce' },
      { s: 1796000, num: '129', name: 'CR-712 · Fort Pierce' },
      { s: 1808900, num: '121', name: 'St. Lucie West Blvd · Port St. Lucie' },
      { s: 1841100, num: '101', name: 'SR-76 · Stuart' },
      { s: 1849100, num: '96', name: 'SR-714 · Stuart' },
      { s: 1863600, num: '87', name: 'Indiantown Road · Jupiter' },
      { s: 1876500, num: '79', name: 'PGA Blvd · Palm Beach Gardens' },
      { s: 1889300, num: '71', name: 'SR-704 · West Palm Beach' },
      { s: 1892600, num: '69', name: 'Belvedere Road · West Palm Beach' },
      { s: 1897400, num: '66', name: 'SR-882 · West Palm Beach' },
      { s: 1911900, num: '57', name: 'Lantana Road · Lake Worth' },
      { s: 1921500, num: '51', name: 'SR-806 · Delray Beach' },
      { s: 1931200, num: '45', name: 'SR-804 · Boca Raton' },
      { s: 1940800, num: '39', name: 'Glades Road · Boca Raton' },
      { s: 1950500, num: '33', name: 'Sample Road · Coconut Creek' },
      { s: 1960100, num: '27', name: 'SR-842 · Fort Lauderdale' },
      { s: 1961700, num: '26', name: 'SR-736 · Fort Lauderdale' },
      { s: 1963400, num: '25', name: 'SR-84 · Fort Lauderdale' },
      { s: 1968200, num: '22', name: 'SR-818 · Griffin Road' },
      { s: 1976200, num: '17', name: 'Hollywood Blvd' },
      { s: 1984300, num: '12B', name: 'SR-826 · North Miami Beach' },
      { s: 1989100, num: '9', name: 'Ives Dairy Road' },
      { s: 1995500, num: '5', name: 'NW 151 St · Opa-locka' },
      { s: 1997100, num: '4', name: 'I-195 · Miami Beach' },
      { s: 1998800, num: '2D', name: 'I-395 · Miami Beach' },
      { s: 2003600, num: '0', name: 'US-1 · Downtown Miami' },
      // Northeast extension (SB numbering, Boston MA → RI → CT shoreline)
      { s: 2004100,  num: 20,   name: 'Boston · I-93 · Downtown' },
      { s: 2007100,  num: 15,   name: 'Route 128 · Dedham' },
      { s: 2010600, num: 9,    name: 'Foxborough · Gillette' },
      { s: 2013600, num: 30,   name: 'Pawtucket · RI' },
      { s: 2016100, num: 22,   name: 'Providence · Downtown' },
      { s: 2019100, num: 16,   name: 'Cranston · RI-10' },
      { s: 2021600, num: 13,   name: 'Warwick · T.F. Green ✈' },
      { s: 2024400, num: 1,    name: 'Westerly · CT/RI Line' },
      { s: 2027100, num: 90,   name: 'Stonington · Mystic' },
      { s: 2029600, num: 83,   name: 'New London · I-395' },
      { s: 2032600, num: 74,   name: 'Waterford · CT-85' },
      { s: 2035600, num: 70,   name: 'Old Lyme · CT-9' },
      { s: 2037600, num: 67,   name: 'Old Saybrook' },
      { s: 2040100, num: 59,   name: 'Guilford · Madison' },
      { s: 2042400, num: 54,   name: 'Branford · East Haven' },
    ],
  },
  midwest: {
    // Chicago Southland → Indianapolis → Cincinnati → Mason. Follow the
    // southern Tri-State route: I-294 south → I-80/I-294 east → I-80/94
    // Borman → a two-lane directional handoff to I-65 south,
    // through Indianapolis on I-65 with only a brief downtown view, then out
    // I-74 through farm country and the SE Indiana hills. At Cincinnati the
    // route turns directly onto I-75 north, bypassing downtown, and continues
    // through Sharonville/West Chester to Mason. End there;
    // Dayton is intentionally outside this map.
    LOOP_LENGTH: 180000,
    ZONES: [
      { name: 'I-294 · Tri-State Tollway South', start: 0, end: 8000, key: 'i294', label: 'I-294 · Tri-State', lanes: 4 },
      { name: 'I-294 · I-57 / Markham', start: 8000, end: 17000, key: 'southland', label: 'I-294 · Markham', lanes: 4 },
      { name: 'I-294 South · I-80 Approach', start: 17000, end: 27000, key: 'southland', label: 'I-294 · Southland', lanes: 4 },
      { name: 'I-80/I-294 · Illinois / Hammond', start: 27000, end: 38000, key: 'southland', label: 'I-80/I-294', lanes: 4 },
      { name: 'I-80/94 · Borman Expressway', start: 38000, end: 47000, key: 'borman', label: 'I-80/94 · Borman', lanes: 4 },
      { name: 'Gary · I-65 Directional Interchange', start: 47000, end: 53000, key: 'gary', label: 'I-65 · Gary', lanes: 3 },
      { name: 'I-65 · Indiana Rural',     start: 53000,  end: 70000,  key: 'i65',      label: 'I-65',      lanes: 3 },
      { name: 'I-65 · Lafayette / Indy Approach', start: 70000, end: 79000, key: 'i65', label: 'I-65', lanes: 3 },
      { name: 'Indianapolis · I-65 / I-465 Bypass', start: 79000, end: 90000, key: 'indy', label: 'I-465 · Indianapolis', lanes: 4 },
      { name: 'Indianapolis · I-74 East', start: 90000, end: 95000, key: 'indy', label: 'I-74 · Indianapolis', lanes: 4 },
      { name: 'I-74 · Farm Country',      start: 95000,  end: 111000, key: 'i74',      label: 'I-74',      lanes: 2 },
      { name: 'SE Indiana Hills · I-74',  start: 111000, end: 125000, key: 'hills',    label: 'Hills',     lanes: 2 },
      { name: 'Cincinnati · I-74',        start: 125000, end: 133000, key: 'cincy',    label: 'Cincy',     lanes: 3 },
      { name: 'Cincinnati · I-74/I-75 Interchange', start: 133000, end: 138000, key: 'cincy', label: 'I-74 / I-75', lanes: 4 },
      { name: 'I-75 North · Mill Creek Valley', start: 138000, end: 147000, key: 'millcreek', label: 'I-75 · Mill Creek', lanes: 4 },
      { name: 'Sharonville · I-275',      start: 147000, end: 161000, key: 'sharonville', label: 'Sharonville', lanes: 4 },
      { name: 'West Chester · I-75',      start: 161000, end: 180000, key: 'wchester75',  label: 'West Chester · Mason', lanes: 3 },
    ],
    SPAWNS: [
      { label: 'I-294 · Schaumburg / I-290', s: 450 },
      { label: 'I-294 · Mile Long Bridge', s: 2600 },
      { label: 'I-294 · Markham Toll Plaza', s: 13600 },
      { label: 'I-80/I-294 · Southland', s: 24000 },
      { label: 'I-80/94 · Hammond', s: 34000 },
      { label: 'Borman Expressway', s: 42000 },
      { label: 'I-80/94 · I-65 Interchange', s: 49500 },
      { label: 'Merrillville', s: 52500 },
      { label: 'Purdue · Lafayette', s: 70000 },
      { label: 'Lebanon IN', s: 75000 },
      { label: 'Indianapolis · I-465 Bypass', s: 83000 },
      { label: 'Indianapolis · I-74 East', s: 92500 },
      { label: 'Shelbyville', s: 97000 },
      { label: 'Greensburg · I-74', s: 107000 },
      { label: 'IN/OH Border', s: 122500 },
      { label: 'Cincinnati · I-74/I-75', s: 134500 },
      { label: 'Norwood · I-75', s: 144000 },
      { label: 'Sharonville · I-275', s: 157500 },
      { label: 'West Chester', s: 165000 },
      { label: 'Mason', s: 176500 },
    ],
    EXITS: [
      { s: 650,    num: '31',  name: 'I-290 West · Schaumburg' },
      { s: 1500,   num: '29',  name: 'Golf Rd' },
      { s: 5200,   num: '17',  name: '95th St · US-12/20' },
      { s: 9000,   num: '7',   name: 'I-57 · Chicago · Memphis' },
      { s: 13600,  num: '',    name: 'Markham · 163rd St Toll Plaza' },
      { s: 17500,  num: '6',   name: '159th St' },
      { s: 21800,  num: '5',   name: 'I-80 West · Iowa' },
      { s: 27000,  num: '0',   name: 'I-80/94 East · Indiana · IL-394' },
      { s: 31500,  num: '161', name: 'US-6 · Torrence Ave' },
      { s: 35000,  num: '2',   name: 'US-41 · Calumet Ave' },
      { s: 39000,  num: '3',   name: 'Kennedy Ave · Hammond' },
      { s: 42000,  num: '5',   name: 'Cline Ave · SR-912' },
      { s: 44500,  num: '10',  name: 'Broadway · Gary' },
      { s: 48600,  num: 11,    name: 'I-65 South · Indianapolis · 2 Lanes' },
      { s: 50500,  num: 261, name: 'Gary · US-12/20' },
      { s: 51500,  num: 253, name: 'Merrillville · US-30' },
      { s: 53000,  num: 249, name: 'Crown Point · US-231' },
      { s: 55000,  num: 240, name: 'Lowell' },
      { s: 57500,  num: 233, name: 'DeMotte · SR-10' },
      { s: 60000,  num: 220, name: 'Rensselaer' },
      { s: 62500,  num: 214, name: 'Wolcottville · US-24' },
      { s: 65000,  num: 205, name: 'Remington · US-24' },
      { s: 67500,  num: 201, name: 'Lafayette South · US-231' },
      { s: 70000,  num: 193, name: 'Lafayette · Purdue' },
      { s: 72500,  num: 185, name: 'Battle Ground · SR-18' },
      { s: 75000,  num: 175, name: 'Lebanon' },
      { s: 78000,  num: 168, name: 'Whitestown · Zionsville' },
      { s: 80500,  num: '129', name: 'I-865 · I-465 SOUTH · Indianapolis' },
      { s: 82800,  num: '17',  name: '38th St · Lafayette Rd' },
      { s: 85000,  num: '16',  name: 'I-74 West · Crawfordsville Rd' },
      { s: 87200,  num: '12',  name: 'I-70 · St Louis · Downtown' },
      { s: 89500,  num: '8',   name: 'US-40 · Indianapolis Airport' },
      { s: 92500,  num: '49',  name: 'I-74 East · Cincinnati' },
      { s: 97000,  num: 149, name: 'Shelbyville' },
      { s: 99000,  num: 146, name: 'SR-44 · Shelbyville' },
      { s: 102000, num: 143, name: 'St. Paul' },
      { s: 104500, num: 138, name: 'US-421 · Greensburg' },
      { s: 107000, num: 132, name: 'Greensburg · I-74' },
      { s: 110000, num: 128, name: 'Oldenburg · SR-229' },
      { s: 113000, num: 149, name: 'Batesville' },
      { s: 115500, num: 156, name: 'Batesville · SR-46' },
      { s: 118000, num: 164, name: 'Sunman' },
      { s: 120500, num: 166, name: 'Harrison · US-52' },
      { s: 122500, num: 169, name: 'West Harrison · IN/OH Line' },
      { s: 126500, num: 7,   name: 'Harrison Ave · Ohio' },
      { s: 129500, num: 5,   name: 'Rybolt Rd' },
      { s: 131500, num: 3,   name: 'Montana Ave' },
      { s: 133500, num: '18', name: 'I-75 North · Dayton' },
      { s: 134500, num: '17', name: 'I-75 South · Downtown · Lexington' },
      { s: 136500, num: '6',  name: 'Mitchell Ave · St. Bernard' },
      // I-75 north through Cincinnati's urban/northern suburbs; exit numbers
      // follow the local corridor sequence through Mason.
      { s: 138500, num: 2,    name: 'I-75 North · Mill Creek' },
      { s: 139500, num: 4,    name: 'Hopple St · Cincinnati' },
      { s: 142740, num: 6,    name: 'Mitchell Ave · St. Bernard' },
      { s: 144350, num: 7,    name: 'SR-562 · Norwood Lateral' },
      { s: 147570, num: 9,    name: 'Seymour Ave · Paddock Rd' },
      { s: 149180, num: '10', name: 'Galbraith Rd' },
      { s: 154000, num: 13,   name: 'Sharon Rd · Sharonville' },
      { s: 158830, num: 16,   name: 'I-275 · Columbus · Indianapolis' },
      { s: 163660, num: 19,   name: 'Union Centre Blvd' },
      { s: 166880, num: 21,   name: 'Cincinnati-Dayton Rd · Mason' },
      { s: 171700, num: 24,   name: 'Union Centre Blvd · West Chester' },
      { s: 176500, num: 25,   name: 'Mason · Kings Island' },
    ],
  },
  libertia: {
    // One 500-mile state-owned highway: Missouri state line → Reston → Jacobs.
    // The engine loops at the terminal so the route remains drivable forever.
    LOOP_LENGTH: 805000,
    ZONES: [
      { name: 'Libertia Turnpike · Missouri Line', start: 0, end: 145000, key: 'lib_south', label: 'Missouri Line', lanes: 3 },
      { name: 'Libertia Turnpike · South Libertia', start: 145000, end: 245000, key: 'lib_southtowns', label: 'South Libertia', lanes: 3 },
      { name: 'Libertia Turnpike · Reston Metro', start: 245000, end: 390000, key: 'lib_reston', label: 'Reston', lanes: 5 },
      { name: 'Libertia Turnpike · Jacobs Corridor', start: 390000, end: 630000, key: 'lib_corridor', label: 'Reston–Jacobs', lanes: 5 },
      { name: 'Libertia Turnpike · Jacobs Metro', start: 630000, end: 750000, key: 'lib_jacobs', label: 'Jacobs', lanes: 3 },
      { name: 'Libertia Turnpike · Jacobs Terminal', start: 750000, end: 805000, key: 'lib_terminal', label: 'Jacobs Terminal', lanes: 3 },
    ],
    SPAWNS: [
      { label: 'Missouri State Line', s: 1200 }, { label: 'Oakwell', s: 52000 },
      { label: 'Mason Creek', s: 112000 }, { label: 'Prairie Junction', s: 178000 },
      { label: 'South Reston', s: 236000 }, { label: 'Downtown Reston', s: 320000 },
      { label: 'Reston–Jacobs Turnpike', s: 455000 }, { label: 'Corporate Farm Belt', s: 545000 },
      { label: 'Jacobs-Side Farm Belt', s: 616000 },
      { label: 'Jacobs Medical Center', s: 676000 }, { label: 'Jacobs Riverfront', s: 712000 },
      { label: 'Jacobs Terminal', s: 781000 },
    ],
    EXITS: [
      { s: 1200, num: 1, name: 'Missouri State Line' }, { s: 52000, num: 8, name: 'Oakwell' },
      { s: 112000, num: 19, name: 'Mason Creek' }, { s: 178000, num: 31, name: 'Prairie Junction' },
      { s: 235000, num: 39, name: 'South Reston' }, { s: 260000, num: 'TP 43', name: 'Reston Local / Express' },
      { s: 318000, num: 'TP 57', name: 'Downtown Reston' }, { s: 370000, num: 'TP 71', name: 'Reston Civic Center' },
      { s: 405000, num: 'TP 85', name: 'Reston–Jacobs Toll Plaza' }, { s: 475000, num: 'TP 101', name: 'Glenhaven' },
      { s: 545000, num: 'TP 118', name: 'Corporate Farm Belt' }, { s: 610000, num: 'TP 137', name: 'Jacobs Tech Corridor' },
      { s: 674000, num: 'TP 153', name: 'Jacobs Medical Center' }, { s: 712000, num: 'TP 162', name: 'Jacobs Riverfront' },
      { s: 781000, num: 'TP 179', name: 'Jacobs Terminal' },
    ],
  },
  i380: {
    LOOP_LENGTH: 128747,
    ZONES: [
      { name: 'I-380 · North Reston', start: 0, end: 30000, key: 'i380_north', label: 'North Reston', lanes: 3 },
      { name: 'I-380 · East Wealth Belt', start: 30000, end: 62000, key: 'i380_east', label: 'East Wealth Belt', lanes: 4 },
      { name: 'I-380 · South Reston', start: 62000, end: 97000, key: 'i380_south', label: 'South Reston', lanes: 3 },
      { name: 'I-380 · West Wealth Belt', start: 97000, end: 128747, key: 'i380_west', label: 'West Wealth Belt', lanes: 3 },
    ],
    SPAWNS: [{ label: 'North Reston', s: 9000 }, { label: 'East Executive Belt', s: 43000 }, { label: 'South Reston', s: 76000 }, { label: 'West Reston', s: 111000 }],
    EXITS: [{ s: 9000, num: 4, name: 'North Reston' }, { s: 43000, num: 12, name: 'Executive Belt' }, { s: 76000, num: 21, name: 'South Reston' }, { s: 111000, num: 31, name: 'West Reston' }],
  },
  i980: {
    LOOP_LENGTH: 177027,
    ZONES: [
      { name: 'I-980 · West Flatlands', start: 0, end: 48000, key: 'i980_west', label: 'West Flatlands', lanes: 3 },
      { name: 'I-980 · North Poor Belt', start: 48000, end: 92000, key: 'i980_north', label: 'North Poor Belt', lanes: 3 },
      { name: 'I-980 · Rural East', start: 92000, end: 142000, key: 'i980_rural', label: 'Rural East', lanes: 2 },
      { name: 'I-980 · South Outskirts', start: 142000, end: 177027, key: 'i980_south', label: 'South Outskirts', lanes: 3 },
    ],
    SPAWNS: [{ label: 'West Flatlands', s: 12000 }, { label: 'North Slums', s: 62000 }, { label: 'Wind Farm', s: 116000 }, { label: 'South Outskirts', s: 158000 }],
    EXITS: [{ s: 12000, num: 3, name: 'West Flatlands' }, { s: 62000, num: 11, name: 'North Slums' }, { s: 116000, num: 20, name: 'Wind Farm' }, { s: 158000, num: 28, name: 'South Outskirts' }],
  },
  lb24: {
    LOOP_LENGTH: 144840,
    ZONES: [
      { name: 'LB-24 · Jacobs North', start: 0, end: 42000, key: 'lb24_north', label: 'Jacobs North', lanes: 3 },
      { name: 'LB-24 · Jacobs Core', start: 42000, end: 76000, key: 'lb24_core', label: 'Jacobs Core', lanes: 3 },
      { name: 'LB-24 · Illinois Worker Belt', start: 76000, end: 112000, key: 'lb24_illinois', label: 'Illinois Worker Belt', lanes: 2 },
      { name: 'LB-24 · South Jacobs', start: 112000, end: 144840, key: 'lb24_south', label: 'South Jacobs', lanes: 3 },
    ],
    SPAWNS: [{ label: 'Jacobs Medical Center', s: 18000 }, { label: 'Jacobs Tech Core', s: 56000 }, { label: 'Illinois Worker Belt', s: 90000 }, { label: 'Jacobs Riverfront', s: 127000 }],
    EXITS: [{ s: 18000, num: 7, name: 'Medical Center' }, { s: 56000, num: 15, name: 'Tech Core' }, { s: 90000, num: 24, name: 'Illinois Worker Belt' }, { s: 127000, num: 34, name: 'Riverfront' }],
  },
  us67: {
    LOOP_LENGTH: 215000,
    ZONES: [
      { name: 'I-680 · Downtown Jacobs', start: 0, end: 22000, key: 'us67_jacobs', label: 'Downtown Jacobs', lanes: 3 },
      { name: 'I-680 · Corporate Farm Corridor', start: 22000, end: 72000, key: 'us67_farms', label: 'Corporate Farm Corridor', lanes: 2 },
      { name: 'I-680 · Rural Towns', start: 72000, end: 125000, key: 'us67_towns', label: 'Rural Towns', lanes: 2 },
      { name: 'I-680 · Eastern Reston Suburbs', start: 125000, end: 166000, key: 'us67_reston_east', label: 'Eastern Reston', lanes: 3 },
      { name: 'I-680 · Northeast Reston', start: 166000, end: 205000, key: 'us67_reston_ne', label: 'Northeast Reston', lanes: 3 },
      { name: 'I-680 · Downtown Tunnel', start: 205000, end: 215000, key: 'us67_tunnel', label: 'Downtown Tunnel', lanes: 3 },
    ],
    SPAWNS: [
      { label: 'Jacobs North Suburbs', s: 9000 }, { label: 'Downtown Jacobs', s: 5000 },
      { label: 'Jacobs South / Industrial Edge', s: 18000 }, { label: 'Corporate Farm Belt · North', s: 28000 },
      { label: 'Industrial Grain Complexes', s: 52000 }, { label: 'Farm–Rural Transition', s: 70000 },
      { label: 'Rural Flatlands', s: 86000 }, { label: 'Rural Towns', s: 108000 },
      { label: 'Eastern Reston Rich Belt', s: 136000 }, { label: 'Reston Greenbelt Viaduct', s: 164000 },
      { label: 'Northeast Reston Urban Belt', s: 184000 }, { label: 'Inner Reston Viaduct + Rail', s: 198000 },
      { label: 'Central Skyline Tunnel', s: 209000 },
    ],
    EXITS: [
      { s: 5000, num: 1, name: 'Downtown Jacobs' }, { s: 18000, num: 5, name: 'Jacobs South' },
      { s: 28000, num: 8, name: 'Corporate Farm Belt' }, { s: 52000, num: 14, name: 'Grain Complexes' },
      { s: 70000, num: 18, name: 'Farm–Rural Transition' }, { s: 86000, num: 22, name: 'Rural Flatlands' },
      { s: 108000, num: 28, name: 'Rural Towns' }, { s: 136000, num: 35, name: 'Eastern Reston Rich Belt' },
      { s: 164000, num: 42, name: 'Reston Greenbelt Viaduct' }, { s: 184000, num: 48, name: 'Northeast Reston' },
      { s: 198000, num: 54, name: 'Inner Reston Viaduct + Rail' }, { s: 209000, num: 58, name: 'Central Skyline Tunnel' },
    ],
  },
  newdelhi: {
    // Delhi ka chakkar: one big circuit of the NCR — Gurgaon's glass Cyber
    // City up NH-48 past IGI, Dhaula Kuan into Lutyens Delhi (wide green
    // boulevards, low white bungalows, India Gate), the signalised inner city
    // through Connaught Place and ITO, over the Yamuna to Noida's towers,
    // back around the Outer Ring Road, and finally NH-10 west through
    // Bahadurgarh and the Haryana fields to Rohtak. Wider roads, fewer
    // towers, greener autos, less civic sense, more smog than Mumbai.
    LOOP_LENGTH: 92000,
    ZONES: [
      { name: 'Cyber City · Gurgaon',   start: 0,     end: 7000,  key: 'd_gurgaon', label: 'Gurgaon',   lanes: 5 },
      { name: 'NH-48 · Aerocity',       start: 7000,  end: 12000, key: 'd_nh48',    label: 'Aerocity',  lanes: 5 },
      { name: 'IGI Airport',            start: 12000, end: 15000, key: 'd_igi',     label: 'IGI ✈',     lanes: 4 },
      { name: 'Dhaula Kuan · Ring Rd',  start: 15000, end: 19000, key: 'd_dhaula',  label: 'Dhaula Kuan', lanes: 4 },
      { name: 'Lutyens · India Gate',   start: 19000, end: 26000, key: 'd_lutyens', label: 'India Gate', lanes: 4 },
      { name: 'Connaught Place',        start: 26000, end: 30000, key: 'd_cp',      label: 'CP',        lanes: 3 },
      { name: 'ITO · Daryaganj',        start: 30000, end: 34000, key: 'd_ito',     label: 'ITO',       lanes: 4 },
      { name: 'Yamuna · Akshardham',    start: 34000, end: 38000, key: 'd_yamuna',  label: 'Akshardham', lanes: 4 },
      { name: 'Noida',                  start: 38000, end: 46000, key: 'd_noida',   label: 'Noida',     lanes: 5 },
      { name: 'Outer Ring Road',        start: 46000, end: 56000, key: 'd_ring',    label: 'Ring Rd',   lanes: 5 },
      { name: 'Punjabi Bagh · NH-10',   start: 56000, end: 62000, key: 'd_pbagh',   label: 'Punjabi Bagh', lanes: 4 },
      { name: 'NH-10 · Bahadurgarh',    start: 62000, end: 72000, key: 'd_bgarh',   label: 'Bahadurgarh', lanes: 4 },
      { name: 'NH-10 · Sampla',         start: 72000, end: 86000, key: 'd_sampla',  label: 'Sampla',    lanes: 3 },
      { name: 'Rohtak',                 start: 86000, end: 92000, key: 'd_rohtak',  label: 'Rohtak',    lanes: 3 },
    ],
    SPAWNS: [
      { label: 'Cyber City · Gurgaon', s: 2000 },
      { label: 'IGI Airport ✈', s: 13000 },
      { label: 'India Gate', s: 23000 },
      { label: 'Connaught Place', s: 27500 },
      { label: 'ITO', s: 31500 },
      { label: 'Noida', s: 41000 },
      { label: 'Outer Ring Rd', s: 50000 },
      { label: 'Punjabi Bagh', s: 58000 },
      { label: 'Bahadurgarh', s: 68000 },
      { label: 'Rohtak', s: 88000 },
    ],
    EXITS: [
      { s: 1500,  num: 1,  name: 'Cyber Hub · DLF', hi: 'साइबर हब' },
      { s: 5200,  num: 2,  name: 'IFFCO Chowk', hi: 'इफ्को चौक' },
      { s: 8600,  num: 3,  name: 'Mahipalpur · NH-48', hi: 'महिपालपुर' },
      { s: 12800, num: 4,  name: 'IGI Airport · T3', hi: 'आईजीआई हवाई अड्डा' },
      { s: 16800, num: 5,  name: 'Dhaula Kuan', hi: 'धौला कुआं' },
      { s: 20500, num: 6,  name: 'Chanakyapuri', hi: 'चाणक्यपुरी' },
      { s: 23800, num: 7,  name: 'India Gate · C-Hexagon', hi: 'इंडिया गेट' },
      { s: 27600, num: 8,  name: 'Connaught Place', hi: 'कनॉट प्लेस' },
      { s: 31500, num: 9,  name: 'ITO · Vikas Marg', hi: 'आईटीओ' },
      { s: 35500, num: 10, name: 'Akshardham', hi: 'अक्षरधाम' },
      { s: 40000, num: 11, name: 'Noida Sector 18', hi: 'नोएडा सेक्टर 18' },
      { s: 44500, num: 12, name: 'Noida City Centre', hi: 'नोएडा सिटी सेंटर' },
      { s: 49000, num: 13, name: 'Ashram · Outer Ring', hi: 'आश्रम' },
      { s: 54000, num: 14, name: 'Naraina · Ring Rd', hi: 'नारायणा' },
      { s: 58500, num: 15, name: 'Punjabi Bagh', hi: 'पंजाबी बाग' },
      { s: 63500, num: 16, name: 'Mundka', hi: 'मुंडका' },
      { s: 68500, num: 17, name: 'Bahadurgarh', hi: 'बहादुरगढ़' },
      { s: 76000, num: 18, name: 'Sampla', hi: 'सांपला' },
      { s: 83000, num: 19, name: 'IIM Rohtak', hi: 'आईआईएम रोहतक' },
      { s: 88500, num: 20, name: 'Rohtak City', hi: 'रोहतक' },
    ],
  },
  delhikolkata: {
    // Delhi → Kolkata local-road corridor. Logical distance follows the
    // historic GT/old NH-2 alignment; DISTANCE_SCALE makes it a practical
    // 5–6 hour drive while preserving every regional transition.
    LOOP_LENGTH: 1530000,
    ZONES: [
      { name: 'Delhi · local city exit', start: 0, end: 35000, key: 'dk_delhi', label: 'Delhi', lanes: 3 },
      { name: 'Ghaziabad–Hapur', start: 35000, end: 95000, key: 'dk_ghaziabad', label: 'Ghaziabad–Hapur', lanes: 2 },
      { name: 'Bulandshahr–Aligarh', start: 95000, end: 175000, key: 'dk_aligarh', label: 'Aligarh', lanes: 2 },
      { name: 'Aligarh–Etawah villages', start: 175000, end: 285000, key: 'dk_etawah', label: 'Etawah', lanes: 2 },
      { name: 'Etawah–Kanpur', start: 285000, end: 385000, key: 'dk_kanpur', label: 'Kanpur', lanes: 2 },
      { name: 'Kanpur–Fatehpur', start: 385000, end: 465000, key: 'dk_fatehpur', label: 'Fatehpur', lanes: 2 },
      { name: 'Fatehpur–Prayagraj', start: 465000, end: 565000, key: 'dk_prayagraj', label: 'Prayagraj', lanes: 2 },
      { name: 'Prayagraj–Mirzapur', start: 565000, end: 645000, key: 'dk_mirzapur', label: 'Mirzapur', lanes: 2 },
      { name: 'Mirzapur–Varanasi', start: 645000, end: 715000, key: 'dk_varanasi', label: 'Varanasi', lanes: 2 },
      { name: 'Varanasi–Chandauli', start: 715000, end: 775000, key: 'dk_chandauli', label: 'Chandauli', lanes: 2 },
      { name: 'Chandauli–Mohania', start: 775000, end: 850000, key: 'dk_mohania', label: 'Mohania', lanes: 2 },
      { name: 'Mohania–Sasaram', start: 850000, end: 915000, key: 'dk_sasaram', label: 'Sasaram', lanes: 2 },
      { name: 'Sasaram–Aurangabad', start: 915000, end: 990000, key: 'dk_aurangabad', label: 'Aurangabad', lanes: 2 },
      { name: 'Aurangabad–Gaya', start: 990000, end: 1060000, key: 'dk_gaya', label: 'Gaya', lanes: 2 },
      { name: 'Gaya–Barhi', start: 1060000, end: 1135000, key: 'dk_barhi', label: 'Barhi', lanes: 2 },
      { name: 'Barhi–Hazaribagh', start: 1135000, end: 1190000, key: 'dk_hazaribagh', label: 'Hazaribagh', lanes: 2 },
      { name: 'Hazaribagh–Dhanbad', start: 1190000, end: 1270000, key: 'dk_dhanbad', label: 'Dhanbad', lanes: 2 },
      { name: 'Dhanbad–Asansol', start: 1270000, end: 1335000, key: 'dk_asansol', label: 'Asansol', lanes: 2 },
      { name: 'Asansol–Durgapur', start: 1335000, end: 1385000, key: 'dk_durgapur', label: 'Durgapur', lanes: 2 },
      { name: 'Durgapur–Bardhaman', start: 1385000, end: 1445000, key: 'dk_bardhaman', label: 'Bardhaman', lanes: 2 },
      { name: 'Bardhaman–Dankuni', start: 1445000, end: 1495000, key: 'dk_dankuni', label: 'Dankuni', lanes: 3 },
      { name: 'Kolkata approach', start: 1495000, end: 1530000, key: 'dk_kolkata', label: 'Kolkata', lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Delhi', s: 1200 }, { label: 'Hapur', s: 65000 }, { label: 'Aligarh', s: 125000 },
      { label: 'Etawah', s: 235000 }, { label: 'Kanpur', s: 330000 }, { label: 'Prayagraj', s: 520000 },
      { label: 'Varanasi', s: 680000 }, { label: 'Sasaram', s: 890000 }, { label: 'Gaya', s: 1025000 },
      { label: 'Dhanbad', s: 1230000 }, { label: 'Asansol', s: 1305000 }, { label: 'Kolkata', s: 1510000 },
    ],
    EXITS: [
      { s: 35000, num: 'NH-91', name: 'Ghaziabad local road' }, { s: 95000, num: 'UP-77', name: 'Hapur–Bulandshahr' },
      { s: 175000, num: 'UP-81', name: 'Aligarh villages' }, { s: 285000, num: 'UP-75', name: 'Etawah' },
      { s: 385000, num: 'UP-78', name: 'Kanpur outskirts' }, { s: 565000, num: 'UP-70', name: 'Prayagraj' },
      { s: 715000, num: 'UP-65', name: 'Varanasi' }, { s: 850000, num: 'BR-24', name: 'Mohania' },
      { s: 990000, num: 'BR-02', name: 'Aurangabad' }, { s: 1135000, num: 'JH-02', name: 'Barhi' },
      { s: 1270000, num: 'JH-10', name: 'Dhanbad' }, { s: 1445000, num: 'WB-37', name: 'Bardhaman' },
    ],
  },
  india: {
    // Full Mumbai → Pune run: the New Link Road down Mumbai's western suburbs,
    // over Vashi Creek into planned Navi Mumbai, then a long, high climb over
    // the Sahyadri ghats on the Expressway (tunnels, rock walls, hoardings),
    // the Pune toll, the high-rise sprawl of Pimpri-Chinchwad, and finally the
    // chaotic two-wheeler swarm of Pune city. ~51 mi. Increasing s = toward Pune.
    LOOP_LENGTH: 97000,
    ZONES: [
      { name: 'New Link Road',          start: 0,     end: 27000, key: 'mumbai',  label: 'Mumbai',  lanes: 4 },
      { name: 'Chembur · Sion-Panvel',  start: 27000, end: 32000, key: 'chembur', label: 'Chembur', lanes: 3 },
      { name: 'Mumbai–Pune Expressway', start: 32000, end: 87000, key: 'puneX',   label: 'Ghats',   lanes: 3 },
      { name: 'Pimpri-Chinchwad',       start: 87000, end: 92500, key: 'pcmc',   label: 'Pimpri',  lanes: 4 },
      { name: 'Pune',                   start: 92500, end: 97000, key: 'pune',   label: 'Pune',    lanes: 3 },
    ],
    SPAWNS: [
      { label: 'Malad', s: 11600 },
      { label: 'Borivali', s: 19800 },
      { label: 'Chembur', s: 29000 },
      { label: 'Vashi · Navi Mumbai', s: 34600 },
      { label: 'Lonavala Ghats', s: 54000 },
      { label: 'Khandala Ghat', s: 66000 },
      { label: 'Ghat Summit', s: 74000 },
      { label: 'Pimpri-Chinchwad', s: 88000 },
      { label: 'Pune City', s: 94000 },
    ],
    EXITS: [
      { s: 1400,  num: 17, name: 'Andheri West', mr: 'अंधेरी पश्चिम', hi: 'अंधेरी वेस्ट' },
      { s: 4200,  num: 18, name: 'Oshiwara · Jogeshwari', mr: 'ओशिवरा', hi: 'ओशिवरा' },
      { s: 7600,  num: 19, name: 'Goregaon', mr: 'गोरेगाव', hi: 'गोरेगांव' },
      { s: 11400, num: 20, name: 'Malad West', mr: 'मालाड', hi: 'मलाड' },
      { s: 15600, num: 21, name: 'Kandivali', mr: 'कांदिवली', hi: 'कांदिवली' },
      { s: 19600, num: 22, name: 'Borivali', mr: 'बोरीवली', hi: 'बोरीवली' },
      { s: 23600, num: 23, name: 'Dahisar', mr: 'दहिसर', hi: 'दहिसर' },
      { s: 27600, num: 24, name: 'Chembur', mr: 'चेंबूर', hi: 'चेंबूर' },
      { s: 29200, num: '24A', name: 'Govandi · Mankhurd', mr: 'गोवंडी', hi: 'गोवंडी' },
      { s: 30800, num: 25, name: 'Sion-Panvel Hwy', mr: 'सायन-पनवेल', hi: 'सायन-पनवेल' },
      { s: 34600, num: 1,  name: 'Vashi', mr: 'वाशी', hi: 'वाशी' },
      { s: 38000, num: 2,  name: 'Panvel', mr: 'पनवेल', hi: 'पनवेल' },
      { s: 46000, num: 3,  name: 'Khopoli', mr: 'खोपोली', hi: 'खोपोली' },
      { s: 54000, num: 4,  name: 'Lonavala', mr: 'लोणावळा', hi: 'लोनावाला' },
      { s: 60000, num: '4A', name: 'Ghat Food Mall', mr: 'फूड मॉल', hi: 'फूड मॉल' },
      { s: 70000, num: '4B', name: 'Amrutanjan Point', mr: 'अमृतांजन', hi: 'अमृतांजन' },
      { s: 77000, num: 5,  name: 'Khandala', mr: 'खंडाळा', hi: 'खंडाला' },
      { s: 83000, num: 6,  name: 'Talegaon', mr: 'तळेगाव', hi: 'तलेगांव' },
      { s: 87500, num: 7,  name: 'Pimpri', mr: 'पिंपरी', hi: 'पिंपरी' },
      { s: 89500, num: 8,  name: 'Chinchwad · Wakad', mr: 'चिंचवड', hi: 'चिंचवड' },
      { s: 91500, num: 9,  name: 'Hinjawadi IT Park', mr: 'हिंजवडी', hi: 'हिंजवडी' },
      { s: 93500, num: 10, name: 'Shivajinagar', mr: 'शिवाजीनगर', hi: 'शिवाजीनगर' },
      { s: 95500, num: 11, name: 'Swargate', mr: 'स्वारगेट', hi: 'स्वारगेट' },
    ],
  },
  aundh: {
    // Aundh–Baner Road, Pune (?map=aundh): a 28 km inner-city circuit through
    // NW Pune at true local-road scale. Old Aundh Gaon (wadas, the Mandir),
    // the Parihar/Bremen Chowk shopping run, the Aundh–Baner Link Road,
    // westernized Baner Road and Balewadi High Street (cafés, breweries,
    // glass showrooms — Pune's most western pocket), then Pashan–Sus Road
    // under the tekdi and the Pashan Gaon / ITI Road bazaar back to Aundh.
    // Narrow roads: stop signs, low painted divider blocks, no lane markings,
    // and a two-wheeler swarm.
    LOOP_LENGTH: 28000,
    ZONES: [
      { name: 'Aundh Gaon',              start: 0,     end: 3600,  key: 'p_gaon',   label: 'Aundh Gaon', lanes: 2 },
      { name: 'Aundh · Parihar Chowk',   start: 3600,  end: 8200,  key: 'p_aundh',  label: 'Aundh',      lanes: 2 },
      { name: 'Aundh–Baner Link Rd',     start: 8200,  end: 12000, key: 'p_link',   label: 'Link Rd',    lanes: 2 },
      { name: 'Baner Road',              start: 12000, end: 17500, key: 'p_baner',  label: 'Baner',      lanes: 3 },
      { name: 'Balewadi High Street',    start: 17500, end: 21000, key: 'p_bale',   label: 'Balewadi',   lanes: 3 },
      { name: 'Pashan–Sus Road',         start: 21000, end: 24800, key: 'p_pashan', label: 'Pashan',     lanes: 2 },
      { name: 'Pashan Gaon · ITI Road',  start: 24800, end: 28000, key: 'p_iti',    label: 'ITI Rd',     lanes: 2 },
    ],
    SPAWNS: [
      { label: 'Aundh Gaon Mandir', s: 850 },
      { label: 'Parihar Chowk', s: 3500 },
      { label: 'Bremen Chowk', s: 5200 },
      { label: 'Baner Gaon', s: 12500 },
      { label: 'Balewadi High St', s: 18300 },
      { label: 'Pashan Lake', s: 23200 },
      { label: 'ITI Road', s: 26200 },
    ],
    EXITS: [
      { s: 800,   num: 1,  name: 'Aundh Gaon Mandir', mr: 'औंध गाव',        hi: 'औंध गांव' },
      { s: 2200,  num: 2,  name: 'Sanewadi',          mr: 'सानेवाडी',        hi: 'सानेवाडी' },
      { s: 3600,  num: 3,  name: 'Parihar Chowk',     mr: 'परिहार चौक',     hi: 'परिहार चौक' },
      { s: 5200,  num: 4,  name: 'Bremen Chowk',      mr: 'ब्रेमेन चौक',     hi: 'ब्रेमेन चौक' },
      { s: 6800,  num: 5,  name: 'Medipoint · DP Rd', mr: 'मेडिपॉईंट',      hi: 'मेडिपॉइंट' },
      { s: 9500,  num: 6,  name: 'Sakal Nagar',       mr: 'सकाळ नगर',       hi: 'सकाल नगर' },
      { s: 11000, num: 7,  name: 'Laxman Nagar',      mr: 'लक्ष्मण नगर',    hi: 'लक्ष्मण नगर' },
      { s: 12500, num: 8,  name: 'Baner Gaon',        mr: 'बाणेर गाव',      hi: 'बानेर गांव' },
      { s: 14000, num: 9,  name: 'Baner Datta Mandir', mr: 'दत्त मंदिर',    hi: 'दत्त मंदिर' },
      { s: 16800, num: 10, name: 'Balewadi Phata',    mr: 'बालेवाडी फाटा',  hi: 'बालेवाड़ी फाटा' },
      { s: 18300, num: 11, name: 'Balewadi High St',  mr: 'हाय स्ट्रीट',     hi: 'हाई स्ट्रीट' },
      { s: 19800, num: 12, name: 'Balewadi Stadium',  mr: 'क्रीडा संकुल',    hi: 'क्रीड़ा संकुल' },
      { s: 21800, num: 13, name: 'Sus Gaon',          mr: 'सूस गाव',        hi: 'सूस गांव' },
      { s: 23200, num: 14, name: 'Pashan Lake',       mr: 'पाषाण तलाव',     hi: 'पाषाण झील' },
      { s: 24800, num: 15, name: 'Pashan Gaon',       mr: 'पाषाण गाव',      hi: 'पाषाण गांव' },
      { s: 26200, num: 16, name: 'ITI Road',          mr: 'आयटीआय रोड',     hi: 'आईटीआई रोड' },
      { s: 27400, num: 17, name: 'Anand Park',        mr: 'आनंद पार्क',     hi: 'आनंद पार्क' },
    ],
  },
  andheri: {
    // Inner Andheri West, blown out to a ~15 mi tangle of tight local roads:
    // no lane discipline, a token divider, cars/rickshaws/two-wheelers packed
    // wall to wall, people spilling off both sides, slums and chawls right up
    // against the tarmac. A signal every few hundred metres.
    LOOP_LENGTH: 52000,
    ZONES: [
      { name: 'Andheri West · Inner Roads', start: 0,     end: 20800, key: 'andheriW', label: 'Andheri W', lanes: 2 },
      { name: 'CSMIA · Airport Access',     start: 20800, end: 24000, key: 'airport',  label: 'Airport ✈', lanes: 2 },
      { name: 'Bandra',                     start: 24000, end: 28000, key: 'bandra',   label: 'Bandra',    lanes: 3 },
      { name: 'Bandra–Worli Sea Link',      start: 28000, end: 33000, key: 'sealink',  label: 'Sea Link',  lanes: 3 },
      { name: 'Marine Drive · SoBo',        start: 33000, end: 52000, key: 'marine',   label: 'Marine Dr', lanes: 3 },
    ],
    SPAWNS: [
      { label: 'Andheri Stn', s: 11400 },
      { label: 'Airport ✈ T2', s: 22300 },
      { label: 'Sea Link', s: 30000 },
      { label: 'Marine Drive', s: 42000 },
      { label: 'Chowpatty', s: 49500 },
    ],
    EXITS: [
      { s: 900,   num: 1,  name: 'Lokhandwala',    mr: 'लोखंडवाला',    hi: 'लोखंडवाला' },
      { s: 2600,  num: 2,  name: 'Four Bungalows', mr: 'चार बंगला',    hi: 'चार बंगला' },
      { s: 4200,  num: 3,  name: 'D.N. Nagar',     mr: 'डी.एन. नगर',   hi: 'डी.एन. नगर' },
      { s: 6000,  num: 4,  name: 'Versova',        mr: 'वर्सोवा',      hi: 'वर्सोवा' },
      { s: 7800,  num: 5,  name: 'Seven Bungalows', mr: 'सात बंगला',   hi: 'सात बंगला' },
      { s: 9600,  num: 6,  name: 'J.P. Road',      mr: 'जे.पी. रोड',   hi: 'जे.पी. रोड' },
      { s: 11400, num: 7,  name: 'Andheri Station', mr: 'अंधेरी स्टेशन', hi: 'अंधेरी स्टेशन' },
      { s: 13200, num: 8,  name: 'S.V. Road',      mr: 'एस.व्ही. रोड', hi: 'एस.व्ही. रोड' },
      { s: 15000, num: 9,  name: 'Juhu Galli',     mr: 'जुहू गल्ली',   hi: 'जुहू गली' },
      { s: 16800, num: 10, name: 'Gulmohar Road',  mr: 'गुलमोहर',      hi: 'गुलमोहर' },
      { s: 18600, num: 11, name: 'Veera Desai',    mr: 'वीरा देसाई',   hi: 'वीरा देसाई' },
      { s: 20400, num: 12, name: 'Oshiwara',       mr: 'ओशिवरा',       hi: 'ओशिवरा' },
      { s: 24000, num: 13, name: 'Bandra',         mr: 'वांद्रे',      hi: 'बांद्रा' },
      { s: 25000, num: '13A', name: 'Chembur · Mumbai-Pune', mr: 'चेंबूर', hi: 'चेंबूर' },
      { s: 26500, num: 14, name: 'Bandstand',      mr: 'बँडस्टँड',     hi: 'बैंडस्टैंड' },
      { s: 34000, num: 15, name: 'Worli',          mr: 'वरळी',         hi: 'वरली' },
      { s: 46000, num: 16, name: 'Charni Road',    mr: 'चरणी रोड',     hi: 'चरनी रोड' },
      { s: 51000, num: 17, name: 'Nariman Point',  mr: 'नरिमन पॉइंट',  hi: 'नरिमन पॉइंट' },
    ],
  },
  newengland: {
    // The New England branch off I-95 North at New Haven (built as its own run
    // so I-95 stays free to push on to Providence later): up I-91 to Hartford,
    // east on I-84 over the CT hills to the Massachusetts line at Sturbridge,
    // then the Mass Pike (I-90) across central Mass into Boston, ending at
    // Logan Airport. ~41 mi. Increasing s = New Haven → Boston (NE/E-bound).
    LOOP_LENGTH: 66000,
    ZONES: [
      { name: 'New Haven · I-91',        start: 0,     end: 4000,  key: 'newhaven', label: 'New Haven', lanes: 3 },
      { name: 'I-91 · Meriden Hills',    start: 4000,  end: 16000, key: 'i91',      label: 'I-91',      lanes: 3 },
      { name: 'Hartford · I-91/84',      start: 16000, end: 23000, key: 'hartford', label: 'Hartford',  lanes: 4 },
      { name: 'I-84 · CT Hills',         start: 23000, end: 34000, key: 'i84',      label: 'I-84',      lanes: 3 },
      { name: 'Mass Pike · I-90',        start: 34000, end: 53000, key: 'masspike', label: 'Mass Pike', lanes: 4 },
      { name: 'Boston · I-90',           start: 53000, end: 61000, key: 'boston',   label: 'Boston',    lanes: 4 },
      { name: 'Logan Airport · I-90',    start: 61000, end: 66000, key: 'logan',    label: 'Logan ✈',   lanes: 3 },
    ],
    SPAWNS: [
      { label: 'New Haven · I-91', s: 800 },
      { label: 'Meriden', s: 9000 },
      { label: 'Hartford', s: 19000 },
      { label: 'Sturbridge MA', s: 36000 },
      { label: 'Worcester', s: 44000 },
      { label: 'Framingham', s: 50000 },
      { label: 'Boston · Copley', s: 57000 },
      { label: 'Logan ✈', s: 63500 },
    ],
    // New Haven Exit 3 up I-91, onto I-84 east, then Mass Pike (I-90) into Boston.
    EXITS: [
      { s: 900,   num: 3,  name: 'Trumbull St · New Haven' },
      { s: 2600,  num: 6,  name: 'Willow St · State St' },
      { s: 6000,  num: 11, name: 'Wallingford' },
      { s: 9000,  num: 16, name: 'Meriden · I-691' },
      { s: 12000, num: 22, name: 'Berlin Turnpike' },
      { s: 15000, num: 29, name: 'Brainard Rd · Hartford' },
      { s: 16800, num: 32, name: 'I-84 · Downtown Hartford' },
      { s: 19000, num: 48, name: 'Capitol Ave · Asylum' },
      { s: 22000, num: 53, name: 'I-291 · East Hartford' },
      { s: 26000, num: 59, name: 'Manchester · Buckland' },
      { s: 30000, num: 67, name: 'Vernon · Tolland' },
      { s: 33500, num: 71, name: 'Union · Sturbridge MA' },
      { s: 36000, num: 9,  name: 'I-90 Mass Pike · Sturbridge' },
      { s: 40000, num: 10, name: 'Auburn · I-395' },
      { s: 44000, num: 11, name: 'Millbury · Worcester' },
      { s: 48000, num: 12, name: 'Framingham' },
      { s: 51000, num: 15, name: 'I-95 · Route 128 · Weston' },
      { s: 54000, num: 17, name: 'Newton · Brighton' },
      { s: 56500, num: 20, name: 'Allston · Cambridge' },
      { s: 58500, num: 22, name: 'Prudential · Copley' },
      { s: 60000, num: 24, name: 'I-93 · South Station' },
      { s: 62000, num: 25, name: 'Ted Williams Tunnel' },
      { s: 63500, num: 26, name: 'Logan Airport ✈' },
    ],
  },
  i80: {
    // I-80 coast-to-Chicago run, branching off I-95 at the George Washington
    // Bridge: over the north-Jersey suburbs, up into the NJ Appalachians at the
    // Delaware Water Gap, the long haul across the tall Pennsylvania ridges and
    // the high Allegheny plateau, into NE Ohio (Youngstown, Cleveland on Lake
    // Erie, Toledo flats), the Indiana Toll Road, and finally the Borman into
    // Gary, the Calumet industrial belt and Chicago's south suburbs to beyond
    // I-57. Increasing s = GWB → Chicago/Joliet (WEST-bound).
    LOOP_LENGTH: 261000,
    ZONES: [
      { name: 'Fort Lee · I-80/GWB',       start: 0,      end: 4000,   key: 'fortlee',    label: 'Fort Lee',   lanes: 4 },
      { name: 'North Jersey · I-80',       start: 4000,   end: 24000,  key: 'njsub80',    label: 'N Jersey',   lanes: 4 },
      { name: 'NW Jersey · Water Gap',     start: 24000,  end: 40000,  key: 'njgap',      label: 'Water Gap',  lanes: 3 },
      { name: 'Poconos · I-80 PA',         start: 40000,  end: 72000,  key: 'poconos',    label: 'Poconos',    lanes: 2 },
      { name: 'PA Ridges · I-80',          start: 72000,  end: 112000, key: 'paridge',    label: 'PA Ridges',  lanes: 2 },
      { name: 'Allegheny Plateau · I-80',  start: 112000, end: 146000, key: 'paplat',     label: 'Plateau',    lanes: 2 },
      { name: 'NE Ohio · I-80',            start: 146000, end: 164000, key: 'ohio80',     label: 'Youngstown', lanes: 3 },
      { name: 'Cleveland · I-80/90',       start: 164000, end: 182000, key: 'cleveland',  label: 'Cleveland',  lanes: 4 },
      { name: 'Toledo · I-80/90',          start: 182000, end: 204000, key: 'toledo',     label: 'Toledo',     lanes: 3 },
      { name: 'Indiana Toll Road · I-80',  start: 204000, end: 228000, key: 'inturnpike', label: 'IN Toll Rd', lanes: 3 },
      { name: 'Gary · I-80/94 · I-65',     start: 228000, end: 242000, key: 'chi80',      label: 'Gary',       lanes: 4 },
      { name: 'Chicago Southland · I-80',  start: 242000, end: 261000, key: 'chi80',      label: 'Chicago',    lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Fort Lee · GWB', s: 800 },
      { label: 'Parsippany', s: 16000 },
      { label: 'Delaware Water Gap', s: 32000 },
      { label: 'Stroudsburg PA', s: 46000 },
      { label: 'Hazleton', s: 84000 },
      { label: 'Bloomsburg', s: 100000 },
      { label: 'Clearfield · start', s: 112000 },
      { label: 'Clearfield · Plateau', s: 128000 },
      { label: 'Brookville PA', s: 135000 },
      { label: 'Youngstown OH', s: 152000 },
      { label: 'Cleveland', s: 172000 },
      { label: 'Toledo', s: 192000 },
      { label: 'Indiana Toll Rd', s: 214000 },
      { label: 'Gary · I-65/80', s: 234000 },
      { label: 'Chicago Southland · I-294', s: 246000 },
      { label: 'I-57 · Joliet approach', s: 257000 },
    ],
    // West-bound exit sequence, roughly descending mile markers NJ → IN.
    EXITS: [
      { s: 700,    num: 72,  name: 'Fort Lee · GWB · I-95' },
      { s: 2600,   num: 68,  name: 'Teaneck · Hackensack' },
      { s: 6000,   num: 62,  name: 'Saddle Brook · GSP' },
      { s: 10000,  num: 55,  name: 'Paterson · Route 19' },
      { s: 16000,  num: 43,  name: 'Parsippany · I-287' },
      { s: 22000,  num: 34,  name: 'Budd Lake · US-206' },
      { s: 30000,  num: 25,  name: 'Hackettstown' },
      { s: 37000,  num: 4,   name: 'Delaware Water Gap · PA Line' },
      { s: 42000,  num: 310, name: 'Stroudsburg · US-209' },
      { s: 50000,  num: 298, name: 'Tannersville · Poconos' },
      { s: 62000,  num: 277, name: 'Hickory Run · I-476' },
      { s: 76000,  num: 256, name: 'Hazleton · PA-93' },
      { s: 88000,  num: 236, name: 'Bloomsburg · I-81' },
      { s: 100000, num: 212, name: 'Lewisburg · US-15' },
      { s: 114000, num: 178, name: 'Milesburg · I-99 · State College' },
      { s: 128000, num: 120, name: 'Clearfield · DuBois' },
      { s: 140000, num: 78,  name: 'Brookville · US-322' },
      { s: 150000, num: 14,  name: 'Sharon · Hermitage' },
      { s: 154000, num: 234, name: 'Youngstown · OH Turnpike' },
      { s: 164000, num: 180, name: 'Cleveland · I-77 Downtown' },
      { s: 172000, num: 173, name: 'W 150th · Cleveland' },
      { s: 186000, num: 71,  name: 'Toledo · I-75' },
      { s: 196000, num: 59,  name: 'Toledo West · US-20' },
      { s: 206000, num: 144, name: 'IN Toll Rd · Angola' },
      { s: 214000, num: 96,  name: 'Elkhart · South Bend' },
      { s: 224000, num: 31,  name: 'Portage · US-20' },
      { s: 234000, num: 15,  name: 'Gary · I-65 South' },
      { s: 238000, num: 10,  name: 'I-80/94 · Chicago Skyway' },
      { s: 246000, num: 4,   name: 'I-294 · Tri-State Tollway' },
      { s: 257000, num: 151, name: 'I-57 · Chicago · Joliet' },
    ],
  },
  i287: {
    // I-287 as a standalone New Jersey run: Perth Amboy (NJ Turnpike / GSP)
    // north through Edison, Piscataway, Bridgewater (I-78), Morristown,
    // Parsippany (I-80), and up the Ramapo valley to the NY line at I-87.
    // Perth Amboy up through the NJ highlands to the NY line at Suffern, then the
    // Thruway east across Rockland, over the Tappan Zee (Mario Cuomo) Bridge, and
    // south on I-87 (the Deegan) through Yonkers and the Bronx to the George
    // Washington Bridge — connecting to I-95. ~83 mi. Increasing s = NB then E/SB.
    LOOP_LENGTH: 134000,
    ZONES: [
      { name: 'Perth Amboy · I-287', start: 0,      end: 6000,   key: 'perthamboy', label: 'Perth Amboy', lanes: 4 },
      { name: 'Edison · I-287',      start: 6000,   end: 20000,  key: 'piscataway', label: 'Edison',      lanes: 3 },
      { name: 'Bridgewater · I-287', start: 20000,  end: 34000,  key: 'bridgewater', label: 'Bridgewater', lanes: 3 },
      { name: 'Morris Hills · I-287', start: 34000, end: 52000,  key: 'morristown', label: 'Morristown', lanes: 3 },
      { name: 'Ramapo Valley · I-287', start: 52000, end: 72000, key: 'ramapo',   label: 'Mahwah',      lanes: 3 },
      { name: 'Rockland · I-287/87',  start: 72000,  end: 90000,  key: 'rockland',  label: 'Rockland',   lanes: 3 },
      { name: 'Tappan Zee Bridge',    start: 90000,  end: 98000,  key: 'tappanzee', label: 'Tappan Zee', lanes: 4 },
      { name: 'Westchester · I-87',   start: 98000,  end: 108000, key: 'westch',    label: 'Westchester', lanes: 3 },
      { name: 'Yonkers · I-87 Deegan', start: 108000, end: 120000, key: 'yonkers',  label: 'Yonkers',    lanes: 3 },
      { name: 'The Bronx · I-87',     start: 120000, end: 130000, key: 'nybronx',   label: 'Bronx',      lanes: 4 },
      { name: 'GW Bridge · I-95',     start: 130000, end: 134000, key: 'gwb287',    label: 'GW Bridge',  lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Perth Amboy', s: 800 },
      { label: 'Edison · US-1', s: 4000 },
      { label: 'Piscataway', s: 9200 },
      { label: 'Bridgewater', s: 24000 },
      { label: 'I-78 Interchange', s: 29200 },
      { label: 'Morristown', s: 43000 },
      { label: 'I-80 · Parsippany', s: 49200 },
      { label: 'Oakland', s: 63000 },
      { label: 'Mahwah · NY Line', s: 69500 },
      { label: 'Nanuet · Rockland', s: 82000 },
      { label: 'Tappan Zee Bridge', s: 93000 },
      { label: 'Tarrytown', s: 102000 },
      { label: 'Yonkers', s: 113000 },
      { label: 'The Bronx', s: 125000 },
      { label: 'GW Bridge', s: 132000 },
    ],
    // Perth Amboy Exit 1 → Suffern → Thruway east → Tappan Zee → I-87 S → GWB.
    EXITS: [
      { s: 700,   num: 1,  name: 'Perth Amboy · NJ Tpke' },
      { s: 2200,  num: 2,  name: 'Metuchen · Main St' },
      { s: 4000,  num: 3,  name: 'Edison · US-1' },
      { s: 6800,  num: 5,  name: 'Washington Ave · Piscataway' },
      { s: 9200,  num: 6,  name: 'River Rd · Highland Park' },
      { s: 12000, num: 9,  name: 'Bound Brook · Stelton Rd' },
      { s: 15000, num: 10, name: 'US-22 · Green Brook' },
      { s: 18500, num: 13, name: 'Bridgewater Commons' },
      { s: 21500, num: 14, name: 'Somerville · US-202/206' },
      { s: 25000, num: 17, name: 'Pluckemin · US-206' },
      { s: 29200, num: 21, name: 'I-78 · Bedminster' },
      { s: 33000, num: 22, name: 'Bernardsville · Mt Airy Rd' },
      { s: 37000, num: 26, name: 'Basking Ridge · N Maple Ave' },
      { s: 40500, num: 30, name: 'Harter Rd · Morristown' },
      { s: 43000, num: 35, name: 'Morristown · South St' },
      { s: 45000, num: 36, name: 'Whippany · Ridgedale Ave' },
      { s: 47500, num: 39, name: 'Morris Plains · US-202' },
      { s: 49200, num: 41, name: 'I-80 · Parsippany' },
      { s: 52500, num: 42, name: 'Montville · US-202' },
      { s: 55500, num: 47, name: 'Boonton · Myrtle Ave' },
      { s: 59000, num: 52, name: 'Riverdale · NJ-23' },
      { s: 63000, num: 57, name: 'Oakland · Skyline Dr' },
      { s: 66500, num: 59, name: 'Mahwah · US-202' },
      { s: 69500, num: 66, name: 'Mahwah · NJ-17' },
      { s: 71000, num: 67, name: 'Suffern NY · I-87 Thruway' },
      { s: 76000, num: '14B', name: 'Airmont · NY-59' },
      { s: 82000, num: 14, name: 'Nanuet · Spring Valley' },
      { s: 87000, num: 13, name: 'Nyack · US-9W' },
      { s: 90000, num: '10', name: 'Nyack · South Nyack · US-9W' },
      { s: 97000, num: 9,  name: 'Tarrytown · US-9' },
      { s: 101000, num: 8, name: 'White Plains · I-287 East' },
      { s: 104000, num: 7, name: 'Ardsley · I-87 South' },
      { s: 110000, num: '6A', name: 'Yonkers · Cross County Pkwy' },
      { s: 114000, num: 4, name: 'Yonkers · McLean Ave' },
      { s: 118000, num: 13, name: 'Van Cortlandt Park · Bronx' },
      { s: 123000, num: 5, name: 'Yankee Stadium · E 161 St' },
      { s: 127000, num: 1, name: 'Cross Bronx Expwy · I-95' },
      { s: 131000, num: 'GWB', name: 'George Washington Br · I-95' },
    ],
  },
  gsp: {
    // Garden State Parkway, THE WHOLE THING, true scale: mile 0 at Cape May to
    // the NY line at mile ~172, where it becomes the I-87 Thruway. 1 s-unit =
    // 1 m, exit number = milepost, s ≈ mile × 1609. South to north: the Cape
    // May marshes, the shore exits and the Great Egg Harbor bay crossing,
    // Atlantic City off to the east, the long dark Pine Barrens, the Ocean
    // County shore sprawl, Monmouth's local/express split (Exit 105 → the
    // Driscoll Bridge over the Raritan), then the classic urban northern run
    // past Newark and Paterson into the wooded Bergen highlands. Cars + buses
    // only — no trucks anywhere. Increasing s = NORTHBOUND (toward NY).
    LOOP_LENGTH: 279000,
    ZONES: [
      { name: 'Cape May · GSP',          start: 0,      end: 15000,  key: 'gsp_capemay',  label: 'Cape May',    lanes: 2 },
      { name: 'The Shore · GSP',         start: 15000,  end: 45000,  key: 'gsp_seashore', label: 'Sea Isle',    lanes: 3 },
      { name: 'Atlantic City · GSP',     start: 45000,  end: 66000,  key: 'gsp_atlantic', label: 'Somers Pt',   lanes: 3 },
      { name: 'Pine Barrens · GSP',      start: 66000,  end: 112000, key: 'gsp_pines',    label: 'New Gretna',  lanes: 2 },
      { name: 'Ocean County · GSP',      start: 112000, end: 142000, key: 'gsp_ocean',    label: 'Toms River',  lanes: 3 },
      { name: 'Lakewood · Wall · GSP',   start: 142000, end: 168000, key: 'gsp_lakewood', label: 'Brick',       lanes: 4 },
      { name: 'Monmouth · Local/Expr',   start: 168000, end: 188000, key: 'gsp_monmouth', label: 'Red Bank',    lanes: 5 },
      { name: 'Raritan · Driscoll Br',   start: 188000, end: 207000, key: 'gsp_raritan',  label: 'Sayreville',  lanes: 5 },
      { name: 'GSP · I-95 / NJ Tpke',    start: 207000, end: 211000, key: 'gsp_i95',      label: 'Woodbridge',  lanes: 5 },
      { name: 'Rahway · GSP',            start: 211000, end: 223000, key: 'gsp_rahway',   label: 'Rahway',      lanes: 5 },
      { name: 'Union · GSP',             start: 223000, end: 229000, key: 'gsp_union',    label: 'Union',       lanes: 5 },
      { name: 'Newark · GSP',            start: 229000, end: 241000, key: 'gsp_essex',    label: 'Newark',      lanes: 3 },
      { name: 'Clifton · GSP',           start: 241000, end: 253000, key: 'gsp_clifton',  label: 'Clifton',     lanes: 3 },
      { name: 'Paterson · GSP',          start: 253000, end: 261000, key: 'gsp_paterson', label: 'Paterson',    lanes: 3 },
      { name: 'Bergen Highlands · GSP',  start: 261000, end: 275000, key: 'gsp_north',    label: 'Paramus',     lanes: 2 },
      { name: 'Montvale · NY Line',      start: 275000, end: 279000, key: 'gsp_ny',       label: 'NY Line',     lanes: 2 },
    ],
    SPAWNS: [
      { label: 'Cape May · Mile 0', s: 1000 },
      { label: 'Wildwood · Exit 4', s: 6400 },
      { label: 'Great Egg Harbor Br', s: 43000 },
      { label: 'Atlantic City Expwy · Exit 38', s: 61000 },
      { label: 'Pine Barrens · Mullica River', s: 78000 },
      { label: 'Barnegat', s: 108000 },
      { label: 'Toms River · Exit 82', s: 131500 },
      { label: 'I-195 · Exit 98', s: 157500 },
      { label: 'Exit 105 · Local/Express', s: 169000 },
      { label: 'Jon Bon Jovi Service Area', s: 199200 },
      { label: 'Driscoll Bridge', s: 203000 },
      { label: 'Woodbridge · I-95', s: 207500 },
      { label: 'Union · Exit 140', s: 225000 },
      { label: 'Essex Toll', s: 228000 },
      { label: 'Newark · Irvington', s: 235000 },
      { label: 'Clifton', s: 247000 },
      { label: 'Paterson', s: 257000 },
      { label: 'Bergen Highlands', s: 267000 },
      { label: 'Montvale · NY Line', s: 277000 },
    ],
    // GSP mile-based exit numbers, increasing south → north (NB); s = mile·1609.
    EXITS: [
      { s: 1200,   num: 0,     name: 'Cape May · NJ-109 · Ferry' },
      { s: 6400,   num: '4B',  name: 'Wildwood · NJ-47' },
      { s: 16100,  num: 10,    name: 'Cape May Court House · Stone Harbor' },
      { s: 20900,  num: 13,    name: 'Avalon · Swainton' },
      { s: 27400,  num: 17,    name: 'Sea Isle City' },
      { s: 32200,  num: 20,    name: 'NJ-50 · Ocean View' },
      { s: 40200,  num: 25,    name: 'Marmora · Ocean City' },
      { s: 46700,  num: 29,    name: 'US-9 · Somers Point' },
      { s: 48300,  num: 30,    name: 'Ocean City · Laurel Dr' },
      { s: 57900,  num: 36,    name: 'Northfield · Margate' },
      { s: 61100,  num: 38,    name: 'Atlantic City Expressway' },
      { s: 64400,  num: 40,    name: 'US-30 · Absecon' },
      { s: 70800,  num: 44,    name: 'Pomona · AC Airport ✈' },
      { s: 77200,  num: 48,    name: 'US-9 · Port Republic' },
      { s: 80500,  num: 50,    name: 'New Gretna · Bass River' },
      { s: 93300,  num: 58,    name: 'Tuckerton · Little Egg Harbor' },
      { s: 101400, num: 63,    name: 'NJ-72 · Manahawkin · LBI' },
      { s: 107800, num: 67,    name: 'Barnegat · Waretown' },
      { s: 119100, num: 74,    name: 'Forked River · Lacey Rd' },
      { s: 128700, num: 80,    name: 'South Toms River' },
      { s: 131900, num: 82,    name: 'NJ-37 · Toms River · Seaside Hts' },
      { s: 133500, num: 83,    name: 'US-9 · Lakewood' },
      { s: 141600, num: 88,    name: 'NJ-70 · Brick · Lakewood' },
      { s: 146400, num: 91,    name: 'CR-549 · Brick Twp' },
      { s: 157700, num: 98,    name: 'I-195 · NJ-138 · Belmar · Trenton' },
      { s: 160900, num: 100,   name: 'NJ-33 · Asbury Park · Freehold' },
      { s: 165700, num: 102,   name: 'Asbury Park · Ocean Twp' },
      { s: 169000, num: 105,   name: 'NJ-36 · Eatontown · Long Branch' },
      { s: 175400, num: 109,   name: 'CR-520 · Red Bank · Lincroft' },
      { s: 183400, num: 114,   name: 'Holmdel · Middletown' },
      { s: 188300, num: 117,   name: 'NJ-36 · Keyport · Hazlet' },
      { s: 193100, num: 120,   name: 'Matawan · Laurence Harbor' },
      { s: 197900, num: 123,   name: 'US-9 · Sayreville · Old Bridge' },
      { s: 201100, num: 125,   name: 'NJ-440 · Perth Amboy' },
      { s: 205700, num: 127,   name: 'I-287 · NJ-440 · Edison' },
      { s: 207500, num: 129,   name: 'Woodbridge · I-95 · NJ Tpke' },
      { s: 213000, num: 131,   name: 'Rahway · Clark' },
      { s: 217000, num: 135,   name: 'Central Ave · Clark' },
      { s: 221000, num: 138,   name: 'Kenilworth · Galloping Hill' },
      { s: 225000, num: 140,   name: 'Union · US-22' },
      { s: 228000, num: 142,   name: 'Essex Toll · Hillside' },
      { s: 231000, num: 143,   name: 'I-78 · Newark · Irvington' },
      { s: 235000, num: 145,   name: 'I-280 · Newark · The Oranges' },
      { s: 239000, num: 148,   name: 'Bloomfield · Belleville' },
      { s: 243000, num: 151,   name: 'Watchung Ave · Montclair' },
      { s: 247000, num: 153,   name: 'Clifton · Allwood' },
      { s: 251000, num: 155,   name: 'NJ-3 · Rutherford · MetLife' },
      { s: 255000, num: 157,   name: 'Paterson · Broadway' },
      { s: 259000, num: 159,   name: 'Hawthorne · NJ-208' },
      { s: 263000, num: 163,   name: 'Ridgewood · Paramus' },
      { s: 267000, num: 165,   name: 'Bergen Toll · Washington Twp' },
      { s: 271000, num: 168,   name: 'Montvale · Woodcliff Lake' },
      { s: 275000, num: 171,   name: 'Montvale · NY State Line' },
      { s: 278000, num: 172,   name: 'I-87 · NY Thruway · Tappan Zee' },
    ],
  },
  acx: {
    // Philadelphia → Atlantic City, the real route at exact scale: I-76 east
    // out of Center City past the stadiums, over the Walt Whitman Bridge,
    // NJ-42 (North–South Freeway) through Bellmawr/Deptford/Turnersville, then
    // the Atlantic City Expressway — mile 44 at Turnersville down to mile 0 in
    // Atlantic City. ACX milepost m sits at s = 24800 + (44 − m) · 1609.
    // ~60 mi total. Increasing s = EASTBOUND (toward AC).
    LOOP_LENGTH: 96000,
    ZONES: [
      { name: 'Philadelphia · I-76',    start: 0,     end: 6500,  key: 'philly76',   label: 'Philadelphia', lanes: 4 },
      // Seven lanes total: three fixed lanes each way plus a reversible centre lane.
      { name: 'Walt Whitman Br · I-76', start: 6500,  end: 9200,  key: 'wwb',        label: 'Walt Whitman', lanes: 3 },
      { name: 'Gloucester · I-76/76',   start: 9200,  end: 13500, key: 'gloucester', label: 'Gloucester',   lanes: 3 },
      { name: 'NJ-42 · N-S Freeway',    start: 13500, end: 24800, key: 'nj42',       label: 'Turnersville', lanes: 3 },
      { name: 'AC Expwy · West',        start: 24800, end: 43000, key: 'acx_west',   label: 'Williamstown', lanes: 3 },
      { name: 'AC Expwy · Pines',       start: 43000, end: 63000, key: 'acx_pines',  label: 'Hammonton',    lanes: 2 },
      { name: 'AC Expwy · Egg Harbor',  start: 63000, end: 86500, key: 'acx_egg',    label: 'Egg Harbor',   lanes: 2 },
      { name: 'Atlantic City',          start: 86500, end: 96000, key: 'acx_ac',     label: 'Atlantic City', lanes: 3 },
    ],
    SPAWNS: [
      { label: 'Philadelphia · Center City', s: 800 },
      { label: 'Walt Whitman Bridge', s: 7000 },
      { label: 'Bellmawr · NJ-42', s: 14000 },
      { label: 'Turnersville · ACX Mile 44', s: 24800 },
      { label: 'Winslow · NJ-73', s: 42500 },
      { label: 'Hammonton', s: 50500 },
      { label: 'Farley Service Plaza', s: 61300 },
      { label: 'Egg Harbor Toll', s: 66000 },
      { label: 'GSP Interchange · Exit 7', s: 84300 },
      { label: 'Pleasantville', s: 87500 },
      { label: 'Atlantic City', s: 94800 },
    ],
    // I-76 / NJ-42 exits, then ACX exits — mile-based, COUNTING DOWN to AC.
    EXITS: [
      { s: 1200,  num: '344', name: 'I-676 · Center City · Vine St' },
      { s: 4300,  num: '347', name: 'Grays Ferry Ave · University City' },
      { s: 6300,  num: '349', name: 'Broad St · Stadiums · Packer Ave' },
      { s: 9000,  num: 1,     name: 'US-130 · Gloucester City · Camden' },
      { s: 11500, num: '1B',  name: 'I-295 · NJ Tpke · Trenton' },
      { s: 13800, num: 13,    name: 'NJ-168 · Bellmawr · Mt Ephraim' },
      { s: 16800, num: 12,    name: 'NJ-41 · Deptford · Deptford Mall' },
      { s: 19800, num: 9,     name: 'CR-544 · Blackwood · Glendora' },
      { s: 24800, num: 44,    name: 'NJ-42 N · Camden · Philadelphia' },
      { s: 29600, num: 41,    name: 'Cross Keys Rd · Sicklerville' },
      { s: 34450, num: 38,    name: 'NJ-536 · Williamstown' },
      { s: 42500, num: 33,    name: 'NJ-73 · Winslow · Blue Anchor' },
      { s: 50550, num: 28,    name: 'NJ-54 · Hammonton' },
      { s: 68250, num: 17,    name: 'NJ-50 · Egg Harbor City' },
      { s: 76300, num: 12,    name: 'US-40 · Mays Landing' },
      { s: 81100, num: 9,     name: 'CR-563 · English Creek' },
      { s: 84330, num: 7,     name: 'Garden State Parkway · N-S' },
      { s: 87550, num: 5,     name: 'US-9 · Pleasantville' },
      { s: 92380, num: 2,     name: 'US-40/322 · Black Horse Pike' },
      { s: 95300, num: 0,     name: 'Atlantic City · Missouri Ave · Casinos' },
    ],
  },
  bay: {
    // The San Francisco Bay Area "loop": there's no single beltway, so the ring
    // is stitched from I-80 (SF ↔ Bay Bridge ↔ the north-bay shore) + I-580
    // (Oakland hills to Dublin) + I-680 (the eastern valleys past Mt Diablo up
    // to Cordelia). A real closed loop around the bay. SF and the Bay Bridge sit
    // at the seam. ~62 mi. Increasing s = clockwise (SF → Oakland → Dublin →
    // Concord → Cordelia → Richmond → back to the Bay Bridge).
    LOOP_LENGTH: 98000,
    ZONES: [
      { name: 'San Francisco · I-80',   start: 0,     end: 6000,  key: 'sf',        label: 'San Francisco', lanes: 4 },
      { name: 'Bay Bridge · I-80',      start: 6000,  end: 12000, key: 'baybridge', label: 'Bay Bridge',     lanes: 5 },
      { name: 'Oakland · I-80/580/880', start: 12000, end: 20000, key: 'oakland',   label: 'Oakland',        lanes: 5 },
      { name: 'Oakland Hills · I-580',  start: 20000, end: 33000, key: 'i580',       label: 'Castro Valley',  lanes: 4 },
      { name: 'Dublin · I-580/680',     start: 33000, end: 41000, key: 'dublin',     label: 'Dublin',         lanes: 5 },
      { name: 'Diablo Valley · I-680',  start: 41000, end: 61000, key: 'i680',       label: 'Walnut Creek',   lanes: 4 },
      { name: 'North Bay · I-80',       start: 61000, end: 75000, key: 'vallejo',    label: 'Vallejo',        lanes: 4 },
      { name: 'Richmond · I-80/580',    start: 75000, end: 88000, key: 'richmond',   label: 'Richmond',       lanes: 4 },
      { name: 'East Bay · I-80',        start: 88000, end: 98000, key: 'eastbay',    label: 'Berkeley',       lanes: 5 },
    ],
    SPAWNS: [
      { label: 'San Francisco', s: 1500 },
      { label: 'Bay Bridge', s: 9000 },
      { label: 'Downtown Oakland', s: 15000 },
      { label: 'Castro Valley', s: 26000 },
      { label: 'Dublin / Pleasanton', s: 36000 },
      { label: 'San Ramon', s: 43000 },
      { label: 'Walnut Creek', s: 50000 },
      { label: 'Concord', s: 57000 },
      { label: 'Fairfield', s: 66000 },
      { label: 'Vallejo', s: 71000 },
      { label: 'Richmond', s: 78000 },
      { label: 'Berkeley', s: 85000 },
      { label: 'Emeryville', s: 92000 },
    ],
    // Clockwise around the bay. CA freeway exits (mile-based, per route).
    EXITS: [
      { s: 800,   num: '1C',  name: 'SF · Fremont St · Downtown' },
      { s: 3000,  num: '2',   name: 'SF · Harrison St · Bay Bridge' },
      { s: 8000,  num: '',    name: 'Treasure Island · Yerba Buena' },
      { s: 13000, num: '8A',  name: 'Oakland · West Grand · MacArthur Maze' },
      { s: 16000, num: '8B',  name: 'I-880 · Downtown Oakland · Alameda' },
      { s: 18500, num: '19',  name: 'I-580 East · Hayward · Stockton' },
      { s: 22000, num: '30',  name: 'Oakland Hills · MacArthur Blvd' },
      { s: 26000, num: '34',  name: 'Castro Valley · I-238' },
      { s: 30000, num: '45',  name: 'Eden Canyon · Dublin Grade' },
      { s: 34000, num: '30',  name: 'Dublin / Pleasanton · I-680' },
      { s: 38000, num: '25',  name: 'Pleasanton · Bernal Ave' },
      { s: 43000, num: '30',  name: 'San Ramon · Bollinger Canyon' },
      { s: 47000, num: '36',  name: 'Danville · Diablo Rd' },
      { s: 50000, num: '46',  name: 'Walnut Creek · CA-24 · Ygnacio Valley' },
      { s: 54000, num: '48',  name: 'Pleasant Hill · Concord' },
      { s: 57000, num: '52',  name: 'Concord · CA-242' },
      { s: 60000, num: '57',  name: 'Benicia Bridge · Martinez' },
      { s: 64000, num: '64',  name: 'Cordelia · I-80' },
      { s: 66000, num: '41',  name: 'Fairfield · Suisun' },
      { s: 70000, num: '33',  name: 'Vallejo · CA-37' },
      { s: 72500, num: '31',  name: 'Carquinez Bridge · Crockett' },
      { s: 76000, num: '27',  name: 'Richmond · Richmond–San Rafael Br · I-580' },
      { s: 80000, num: '20',  name: 'El Cerrito · Central Ave' },
      { s: 84000, num: '11',  name: 'Berkeley · University Ave' },
      { s: 88000, num: '9',   name: 'Emeryville · Powell St' },
      { s: 92000, num: '8A',  name: 'Oakland · West Grand · Bay Bridge' },
      { s: 96000, num: '2',   name: 'Bay Bridge · San Francisco' },
    ],
  },
  cal5: {
    // I-5 Los Angeles → San Francisco, true-scale ~382 mi / 615 km.
    LOOP_LENGTH: 615000,
    ZONES: [
      { name: 'Los Angeles Basin · I-5', start: 0, end: 72000, key: 'cal5_la', label: 'Los Angeles', lanes: 5 },
      { name: 'Santa Clarita · I-5', start: 72000, end: 101000, key: 'cal5_santaclarita', label: 'Santa Clarita', lanes: 4 },
      { name: 'Tejon Pass · I-5', start: 101000, end: 154000, key: 'cal5_tejon', label: 'Tejon Pass', lanes: 2 },
      { name: 'Bakersfield · I-5', start: 154000, end: 205000, key: 'cal5_bakersfield', label: 'Bakersfield', lanes: 3 },
      { name: 'San Joaquin Valley · I-5', start: 205000, end: 390000, key: 'cal5_valley', label: 'Central Valley', lanes: 2 },
      { name: 'Pacheco Pass · I-5', start: 390000, end: 477000, key: 'cal5_pacheco', label: 'Pacheco Pass', lanes: 2 },
      { name: 'Silicon Valley · I-5', start: 477000, end: 560000, key: 'cal5_silicon', label: 'Silicon Valley', lanes: 4 },
      { name: 'San Francisco · I-5', start: 560000, end: 615000, key: 'cal5_sf', label: 'San Francisco', lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Downtown Los Angeles', s: 1200 }, { label: 'Santa Clarita', s: 80000 },
      { label: 'Tejon Pass', s: 120000 }, { label: 'Bakersfield', s: 177000 },
      { label: 'Fresno', s: 267000 }, { label: 'Modesto', s: 360000 },
      { label: 'San Jose', s: 515000 }, { label: 'San Francisco', s: 603000 },
    ],
    EXITS: [
      { s: 1200, num: 114, name: 'Downtown Los Angeles · US-101' },
      { s: 42000, num: 146, name: 'Magic Mountain Pkwy · Santa Clarita' },
      { s: 108000, num: 205, name: 'Grapevine · CA-138' },
      { s: 142000, num: 219, name: 'Tejon Ranch · Wheeler Ridge' },
      { s: 176000, num: 221, name: 'Bakersfield · CA-99' },
      { s: 266000, num: 131, name: 'Fresno · CA-41' },
      { s: 352000, num: 228, name: 'Modesto · CA-132' },
      { s: 432000, num: 334, name: 'Pacheco Pass · CA-152' },
      { s: 515000, num: 356, name: 'San Jose · CA-85' },
      { s: 575000, num: 450, name: 'San Francisco · US-101' },
      { s: 605000, num: 1, name: 'San Francisco Bay approach' },
    ],
  },
  i280: {
    LOOP_LENGTH: 70000,
    ZONES: [
      { name: 'Parsippany · I-280 / I-80', start: 0, end: 12000, key: 'i280_parsippany', label: 'Parsippany', lanes: 3 },
      { name: 'Morris County · I-280', start: 12000, end: 26000, key: 'i280_morris', label: 'Morris County', lanes: 3 },
      { name: 'Essex Hills · I-280', start: 26000, end: 39000, key: 'i280_essex', label: 'Essex Hills', lanes: 3 },
      { name: 'The Oranges · I-280', start: 39000, end: 52000, key: 'i280_oranges', label: 'The Oranges', lanes: 3 },
      { name: 'Newark · I-280 / I-95', start: 52000, end: 70000, key: 'i280_newark', label: 'Newark', lanes: 3 },
    ],
    SPAWNS: [{ label: 'I-80 · Parsippany', s: 1200 }, { label: 'Morris County', s: 16000 }, { label: 'West Orange', s: 39000 }, { label: 'Newark · I-95', s: 59000 }],
    EXITS: [{ s: 1200, num: 1, name: 'I-80 · US 46 · Parsippany' }, { s: 9000, num: 2, name: 'Eisenhower Parkway' }, { s: 18000, num: 4, name: 'NJ 24 · Morristown' }, { s: 28500, num: 7, name: 'Pleasant Valley Way' }, { s: 39500, num: 8, name: 'Northfield Ave · West Orange' }, { s: 47500, num: 10, name: 'Garden State Parkway' }, { s: 56000, num: 12, name: 'Garden State Parkway · Newark' }, { s: 62500, num: 14, name: 'NJ 21 · Newark' }, { s: 69000, num: 'I-95', name: 'Newark / NJ Turnpike' }],
  },
  us22: {
    LOOP_LENGTH: 98000,
    ZONES: [
      { name: 'Phillipsburg · US 22', start: 0, end: 14000, key: 'us22_phillipsburg', label: 'Phillipsburg', lanes: 2 },
      { name: 'Clinton · US 22', start: 14000, end: 30000, key: 'us22_clinton', label: 'Clinton', lanes: 2 },
      { name: 'Bridgewater · US 22', start: 30000, end: 52000, key: 'us22_bridgewater', label: 'Bridgewater', lanes: 3 },
      { name: 'Union · Garden State Parkway', start: 52000, end: 76000, key: 'us22_union', label: 'Union', lanes: 3 },
      { name: 'Newark / Hudson approach · US 22', start: 76000, end: 98000, key: 'us22_newark', label: 'Newark / Hudson', lanes: 3 },
    ],
    SPAWNS: [{ label: 'Phillipsburg · PA Line', s: 1200 }, { label: 'Clinton', s: 19000 }, { label: 'Bridgewater / Somerville', s: 39000 }, { label: 'Garden State Parkway', s: 56000 }, { label: 'Union / Newark', s: 72000 }, { label: 'Hudson County skyline', s: 92000 }],
    EXITS: [{ s: 1200, num: 18, name: 'PA 22 · Easton' }, { s: 17500, num: 31, name: 'NJ 31 · Clinton' }, { s: 33500, num: 29, name: 'I-78 · Somerville / Bridgewater' }, { s: 47000, num: 24, name: 'US 202 · Somerville' }, { s: 56000, num: 'GSP', name: 'Garden State Parkway · Union' }, { s: 68000, num: 22, name: 'NJ 82 · Union' }, { s: 80500, num: 21, name: 'Springfield Ave · Newark' }, { s: 92000, num: 'NJ-21', name: 'Newark / Hudson County' }],
  },
  i78: {
    // I-78 from I-81 through the Lehigh Valley and North Jersey, ending at
    // Canal Street after the Holland Tunnel. I-495 is a separate NYC route.
    // The simulation centerline must close into a loop. A scenery-only return
    // buffer after Canal Street keeps Manhattan physically kilometres away
    // from Lebanon instead of wrapping its skyline beside the PA start.
    LOOP_LENGTH: 315000,
    ZONES: [
      { name: 'Lebanon Valley · I-78', start: 0, end: 36000, key: 'i78_lebanon', label: 'Lebanon Valley', lanes: 2 },
      { name: 'Blue Mountain · I-78', start: 36000, end: 62000, key: 'i78_blueridge', label: 'Blue Mountain', lanes: 2 },
      { name: 'Lehigh Valley · I-78', start: 62000, end: 105000, key: 'i78_lehigh', label: 'Allentown · Bethlehem', lanes: 3 },
      { name: 'Easton · Delaware River', start: 105000, end: 125000, key: 'i78_easton', label: 'Easton', lanes: 2 },
      { name: 'Hunterdon · I-78', start: 125000, end: 175000, key: 'i78_hunterdon', label: 'Hunterdon County', lanes: 2 },
      { name: 'Watchung · I-78', start: 175000, end: 215000, key: 'i78_watchung', label: 'Watchung', lanes: 3 },
      { name: 'Essex County · Newark', start: 215000, end: 238000, key: 'i78_newark', label: 'Newark', lanes: 4 },
      { name: 'Newark Bay Extension', start: 238000, end: 247000, key: 'i78_newarkbay', label: 'Newark Bay Bridge', lanes: 3 },
      { name: 'Hudson County · Jersey City', start: 247000, end: 260000, key: 'i78_jerseycity', label: 'Jersey City', lanes: 3 },
      { name: 'Holland Tunnel · I-78', start: 260000, end: 267000, key: 'i78_holland', label: 'Holland Tunnel', lanes: 2 },
      { name: 'Lower Manhattan · Canal Street', start: 267000, end: 275000, key: 'i78_manhattan', label: 'Lower Manhattan', lanes: 2 },
      { name: 'I-78 closed return buffer', start: 275000, end: 315000, key: 'i78_return', label: 'Route boundary', lanes: 2 },
    ],
    SPAWNS: [
      { label: 'I-81 / Lebanon', s: 1200 }, { label: 'Blue Mountain', s: 47000 },
      { label: 'Allentown', s: 82000 }, { label: 'Easton / Delaware River', s: 112000 },
      { label: 'Clinton', s: 145000 }, { label: 'Watchung', s: 190000 },
      { label: 'Newark / Essex County', s: 226000 }, { label: 'Newark Bay Bridge', s: 242000 },
      { label: 'Jersey City', s: 252000 }, { label: 'Holland Tunnel stoplight · Jersey Avenue', s: 259300 },
      { label: 'Holland Tunnel', s: 263500 }, { label: 'Lower Manhattan / Canal Street', s: 267300 },
    ],
    EXITS: [
      { s: 1200, num: 89, name: 'I-81 · Harrisburg / Scranton' },
      { s: 30000, num: 87, name: 'PA 72 · Lebanon' },
      { s: 47000, num: 23, name: 'PA 183 · Blue Mountain' },
      { s: 69000, num: 54, name: 'PA 309 · Allentown' },
      { s: 82000, num: 53, name: 'US 22 · Bethlehem' },
      { s: 111000, num: 3, name: 'PA 611 · Easton' },
      { s: 116000, num: 'I-78 Toll', name: 'Delaware River Toll Bridge' },
      { s: 142000, num: 17, name: 'NJ 173 · Clinton' },
      { s: 190000, num: 41, name: 'I-287 · Somerville / Morristown' },
      { s: 211500, num: 52, name: 'Garden State Parkway · Local Lanes' },
      { s: 221000, num: '58A', name: 'NJ 21 · Downtown Newark' },
      { s: 242000, num: '14A', name: 'Newark Bay Bridge · Bayonne' },
      { s: 250000, num: 14, name: 'NJ Turnpike · Jersey City' },
      { s: 263000, num: 'Holland', name: 'Holland Tunnel · Manhattan' },
      { s: 267250, num: 'Canal', name: 'Canal Street · SoHo / Lower Manhattan' },
      { s: 267450, num: 'END', name: 'I-78 Ends · Canal Street' },
    ],
  },
  nyc: {
    // I-95 George Washington Bridge → Harlem River Dr / FDR Drive down the east
    // side of Manhattan → Queens-Midtown Tunnel → I-495 Long Island Expressway
    // through Queens and Nassau to Jericho. ~35 mi; the loop closes through outer
    // Long Island. Increasing s = eastbound (GWB → Jericho).
    LOOP_LENGTH: 60000,
    ZONES: [
      { name: 'George Washington Bridge', start: 0,     end: 3000,  key: 'gwb',        label: 'GW Bridge',       lanes: 4 },
      { name: 'Washington Heights',       start: 3000,  end: 8000,  key: 'washheights', label: 'Washington Hts', lanes: 3 },
      { name: 'Harlem River Drive',       start: 8000,  end: 12500, key: 'harlem',     label: 'Harlem',          lanes: 3 },
      { name: 'FDR · Upper East Side',    start: 12500, end: 19000, key: 'ues',        label: 'Upper East Side', lanes: 3 },
      { name: 'FDR · Midtown',            start: 19000, end: 24000, key: 'midtown',    label: 'Midtown',         lanes: 3 },
      { name: 'Queens-Midtown Tunnel',    start: 24000, end: 26000, key: 'tunnel',     label: 'Midtown Tunnel',  lanes: 2 },
      { name: 'Long Island City',         start: 26000, end: 30000, key: 'lic',        label: 'Long Island City', lanes: 3 },
      { name: 'Woodside · Sunnyside',     start: 30000, end: 35000, key: 'woodside',   label: 'Woodside',        lanes: 3 },
      { name: 'Corona · Flushing Mdws',   start: 35000, end: 39000, key: 'corona',     label: 'Corona',          lanes: 3 },
      { name: 'Flushing · Fresh Meadows', start: 39000, end: 43000, key: 'flushing',   label: 'Flushing',        lanes: 3 },
      { name: 'New Hyde Park',            start: 43000, end: 46500, key: 'newhydepark', label: 'New Hyde Park',   lanes: 4 },
      { name: 'Mineola · Westbury',       start: 46500, end: 50000, key: 'mineola',    label: 'Westbury',        lanes: 4 },
      { name: 'Jericho',                  start: 50000, end: 52500, key: 'jericho',    label: 'Jericho',         lanes: 4 },
      { name: 'Long Island',              start: 52500, end: 60000, key: 'li_return',  label: 'Long Island',     lanes: 3 },
    ],
    EXITS: [
      { s: 1000,  num: '1',  name: 'GWB · Harlem River Dr' },
      { s: 20500, num: '9',  name: 'E 42 St · UN · Midtown Tunnel' },
      { s: 28000, num: '15', name: 'Long Island City · BQE' },
      { s: 37500, num: '22', name: 'Grand Central Pkwy · LaGuardia' },
      { s: 44000, num: '33', name: 'Cross Island Pkwy' },
      { s: 50500, num: '40', name: 'Jericho Tpke · Syosset' },
    ],
    SPAWNS: [
      { label: 'George Washington Bridge', s: 1500 },
      { label: 'Harlem River Drive', s: 9500 },
      { label: 'FDR · Midtown Skyline', s: 21000 },
      { label: 'Queensboro Bridge', s: 17800 },
      { label: 'Queens-Midtown Tunnel', s: 25000 },
      { label: 'Long Island City', s: 28000 },
      { label: 'Flushing Meadows · Citi Field', s: 36500 },
      { label: 'Nassau · Roosevelt Field', s: 47500 },
      { label: 'Jericho (Exit 40)', s: 51000 },
    ],
  },
  i278: {
    // Extended I-278 drive: I-95/NJ-440 → Outerbridge → West Shore/Staten
    // Island Expressways → Verrazzano → BQE → RFK → Bronx Bruckner/I-95.
    LOOP_LENGTH: 90000,
    ZONES: [
      { name: 'NJ-440 · I-95 / Woodbridge', start: 0, end: 9000, key: 'i278_nj440', label: 'NJ-440', lanes: 3 },
      { name: 'Outerbridge Crossing', start: 9000, end: 14000, key: 'i278_outerbridge', label: 'Outerbridge', lanes: 3 },
      { name: 'West Shore Expressway · NY-440', start: 14000, end: 22000, key: 'i278_westshore', label: 'West Shore', lanes: 3 },
      { name: 'Staten Island Expressway · I-278', start: 22000, end: 32000, key: 'i278_staten', label: 'Staten Island', lanes: 4 },
      { name: 'Verrazzano-Narrows Bridge', start: 32000, end: 38000, key: 'i278_verrazzano', label: 'Verrazzano', lanes: 4 },
      { name: 'Brooklyn · Gowanus / BQE', start: 38000, end: 56000, key: 'i278_brooklyn', label: 'Brooklyn BQE', lanes: 4 },
      { name: 'Kosciuszko Bridge · Newtown Creek', start: 56000, end: 61000, key: 'i278_kosciuszko', label: 'Kosciuszko', lanes: 4 },
      { name: 'Queens · BQE / I-495 / LIE', start: 61000, end: 73000, key: 'i278_queens', label: 'Queens BQE', lanes: 4 },
      { name: 'RFK / Triborough Bridge', start: 73000, end: 79000, key: 'i278_rfk', label: 'RFK Bridge', lanes: 4 },
      { name: 'Bronx · Bruckner Expressway', start: 79000, end: 90000, key: 'i278_bronx', label: 'Bruckner / Bronx', lanes: 4 },
    ],
    SPAWNS: [
      { label: 'I-95 / NJ-440 · Woodbridge', s: 900 },
      { label: 'Outerbridge Crossing', s: 11200 },
      { label: 'West Shore Expressway', s: 17200 },
      { label: 'Staten Island Expressway', s: 25600 },
      { label: 'Verrazzano Bridge', s: 35000 },
      { label: 'Gowanus · BQE', s: 42000 },
      { label: 'Downtown Brooklyn · BQE', s: 49500 },
      { label: 'Kosciuszko Bridge', s: 58500 },
      { label: 'I-495 / LIE · BQE', s: 66900 },
      { label: 'RFK / Triborough Bridge', s: 76000 },
      { label: 'Bruckner · I-95', s: 88400 },
    ],
    EXITS: [
      { s: 700, num: '1', name: 'I-95 / NJ Turnpike · Woodbridge' },
      { s: 3100, num: '2', name: 'US-9 · Perth Amboy' },
      { s: 6900, num: '3', name: 'NJ-440 · State St' },
      { s: 9300, num: '1', name: 'Outerbridge Crossing · Staten Island' },
      { s: 15100, num: '1', name: 'Page Ave · Arthur Kill Rd' },
      { s: 18100, num: '3', name: 'Bloomingdale Rd' },
      { s: 21900, num: '5', name: 'I-278 · Staten Island Expressway' },
      { s: 24700, num: '7', name: 'Richmond Ave · Staten Island Mall' },
      { s: 28100, num: '9', name: 'Clove Rd · Bradley Ave' },
      { s: 31400, num: '13', name: 'Verrazzano-Narrows Bridge · Brooklyn' },
      { s: 38900, num: '17', name: '92nd St · Belt Parkway' },
      { s: 42400, num: '20', name: '6th Ave · Prospect Expressway' },
      { s: 46100, num: '26', name: 'Hugh L Carey Tunnel · Manhattan' },
      { s: 49500, num: '29', name: 'Atlantic Ave · Brooklyn Bridge' },
      { s: 53200, num: '31', name: 'Wythe Ave · Williamsburg' },
      { s: 56800, num: '33', name: 'Kosciuszko Bridge · Queens' },
      { s: 63200, num: '34', name: 'Queens Blvd · Broadway' },
      { s: 66900, num: '35', name: 'I-495 · Long Island Expressway' },
      { s: 71600, num: '43', name: 'Grand Central Parkway · LaGuardia' },
      { s: 73800, num: '45', name: 'Astoria Blvd · RFK Bridge' },
      { s: 80200, num: '48', name: 'Bruckner Blvd · Hunts Point' },
      { s: 85300, num: '50', name: 'I-87 · Major Deegan Expressway' },
      { s: 88400, num: '6A', name: 'I-95 · I-295 · I-678 · Bruckner Interchange' },
    ],
  },
  us1: {
    // US Route 1 up the spine of New Jersey: Trenton → Lawrence → the Princeton
    // shopping corridor → North Brunswick's car-dealer row → New Brunswick over
    // the Raritan → Edison (Menlo Park) → Iselin/Metropark → the Woodbridge
    // cloverleaf where US-1 joins US-9 → the Linden/Bayway refineries → Elizabeth
    // past Newark Airport → Newark → the black steel Pulaski Skyway over the
    // Meadowlands → Jersey City. A signalized surface arterial for most of the
    // way (jughandles, strip malls, big-box, diners), grade-separated at the
    // north end. ~52 mi; loop closes back through the corridor. Increasing s =
    // northbound (Trenton → Jersey City).
    LOOP_LENGTH: 56000,
    ZONES: [
      { name: 'Trenton · Rt 1',            start: 0,     end: 2500,  key: 'trenton',     label: 'Trenton',       lanes: 3 },
      { name: 'Lawrence Township',         start: 2500,  end: 6000,  key: 'lawrence',    label: 'Lawrence',      lanes: 3 },
      { name: 'Princeton Corridor',        start: 6000,  end: 11000, key: 'princeton',   label: 'Princeton',     lanes: 3 },
      { name: 'North Brunswick',           start: 11000, end: 16000, key: 'nbrunswick',  label: 'N. Brunswick',  lanes: 3 },
      { name: 'New Brunswick · Raritan',   start: 16000, end: 20000, key: 'newbrunswick', label: 'New Brunswick', lanes: 3 },
      { name: 'Edison · Menlo Park',       start: 20000, end: 25000, key: 'edison',      label: 'Edison',        lanes: 3 },
      { name: 'Iselin · Metropark',        start: 25000, end: 29000, key: 'iselin',      label: 'Iselin',        lanes: 3 },
      { name: 'Woodbridge · US-1/9',       start: 29000, end: 33000, key: 'woodbridge',  label: 'Woodbridge',    lanes: 4 },
      { name: 'Linden · Bayway',           start: 33000, end: 38000, key: 'linden',      label: 'Linden',        lanes: 3 },
      { name: 'Elizabeth · Airport',       start: 38000, end: 42000, key: 'elizabeth',   label: 'Elizabeth',     lanes: 3 },
      { name: 'Newark · US-1/9',           start: 42000, end: 45000, key: 'newark1',     label: 'Newark',        lanes: 3 },
      { name: 'Pulaski Skyway',            start: 45000, end: 48000, key: 'pulaski',     label: 'Pulaski Skyway', lanes: 2 },
      { name: 'Jersey City',               start: 48000, end: 51000, key: 'jerseycity',  label: 'Jersey City',   lanes: 3 },
      { name: 'US-1 Corridor',             start: 51000, end: 56000, key: 'us1_return',  label: 'US-1',          lanes: 3 },
    ],
    EXITS: [
      { s: 1200,  num: '', name: 'Trenton · Rt 1 Business' },
      { s: 3800,  num: '', name: 'Quakerbridge Rd · Mall' },
      { s: 5200,  num: '', name: 'I-295 · I-95 · Trenton' },
      { s: 8000,  num: '', name: 'Washington Rd · Princeton (Rt 571)' },
      { s: 10200, num: '', name: 'Harrison St · MarketFair' },
      { s: 13000, num: '', name: 'Ryders Ln · North Brunswick' },
      { s: 17500, num: '', name: 'Rt 18 · New Brunswick · Rutgers' },
      { s: 21500, num: '', name: 'Rt 27 · Menlo Park · Edison' },
      { s: 23500, num: '', name: 'Parsonage Rd · Menlo Park Mall' },
      { s: 27000, num: '', name: 'Metropark · Iselin Station' },
      { s: 30500, num: '', name: 'Rt 9 · Woodbridge Center · GSP' },
      { s: 32500, num: '12', name: 'NJ Turnpike · Carteret' },
      { s: 35500, num: '', name: 'Linden · Bayway · Rt 1/9' },
      { s: 40000, num: '', name: 'Rt 1&9 · Newark Airport · I-78' },
      { s: 43500, num: '', name: 'Haynes Ave · Newark' },
      { s: 47000, num: '', name: 'Pulaski Skyway · Jersey City' },
      { s: 49200, num: '', name: 'Tonnele Ave · Rt 139 · Holland Tunnel' },
      { s: 50500, num: '', name: 'Journal Square · JC' },
    ],
    SPAWNS: [
      { label: 'Trenton', s: 1000 },
      { label: 'Lawrenceville · Quaker Bridge', s: 4000 },
      { label: 'Princeton · MarketFair', s: 9000 },
      { label: 'North Brunswick · Dealer Row', s: 13500 },
      { label: 'New Brunswick · Rutgers', s: 18000 },
      { label: 'Edison · Menlo Park Mall', s: 23000 },
      { label: 'Metropark · Iselin', s: 27000 },
      { label: 'Woodbridge Center', s: 31000 },
      { label: 'Linden · Bayway Refinery', s: 35500 },
      { label: 'Newark Airport · Elizabeth', s: 40000 },
      { label: 'Pulaski Skyway', s: 46500 },
      { label: 'Jersey City · Journal Square', s: 50000 },
    ],
  },
  chester: {
    LOOP_LENGTH: 24000,
    ZONES: [
      { name: 'West Chester · PA-3', start: 0, end: 4300, key: 'chester_west', label: 'West Chester', lanes: 2 },
      { name: 'Edgmont · wooded suburbs', start: 4300, end: 8200, key: 'chester_wooded', label: 'Edgmont', lanes: 2 },
      { name: 'Glen Mills · retail corridor', start: 8200, end: 13200, key: 'chester_retail', label: 'Glen Mills', lanes: 3 },
      { name: 'Media · school district', start: 13200, end: 17800, key: 'chester_school', label: 'Media', lanes: 2 },
      { name: 'Chadds Ford · US-1 approach', start: 17800, end: 24000, key: 'chester_south', label: 'Chadds Ford', lanes: 2 },
    ],
    SPAWNS: [
      { label: 'West Chester', s: 900 }, { label: 'Edgmont', s: 5600 },
      { label: 'Glen Mills shopping', s: 10100 }, { label: 'Media schools', s: 15000 },
      { label: 'Chadds Ford', s: 20400 },
    ],
    EXITS: [
      { s: 1200, num: '', name: 'West Chester · PA-3' }, { s: 4550, num: '', name: 'Newtown Street Road' },
      { s: 8350, num: '', name: 'PA-352 · Edgmont' }, { s: 10100, num: '', name: 'Glen Mills · Concordville' },
      { s: 12200, num: '', name: 'Concordville · Shopping' }, { s: 14500, num: '', name: 'Media · Rose Tree' },
      { s: 16600, num: '', name: 'Penncrest High School' }, { s: 20100, num: '', name: 'US-1 · Chadds Ford' },
      { s: 23100, num: '', name: 'Brandywine Battlefield' },
    ],
  },
  a1: {
    // Portugal: the A1 — Autoestrada do Norte (E1) — Lisboa → Porto, at TRUE
    // scale: 299 km, 1 s-unit = 1 real metre. Out of Lisbon past Sacavém and
    // the Tejo estuary at Vila Franca, across the flat Lezíria farmland of the
    // Ribatejo, up through the limestone Serra d'Aire at Fátima, the pine
    // forests of Leiria, Coimbra on the Mondego, the flat Bairrada / Ria de
    // Aveiro lowlands, the hills of Santa Maria da Feira, and down over the
    // Douro on the Ponte da Arrábida into Porto. Closed toll system
    // (portagens, Via Verde). Increasing s = NORTE.
    LOOP_LENGTH: 299000,
    ZONES: [
      { name: 'Lisboa · A1',              start: 0,      end: 15000,  key: 'pt_lisboa',   label: 'Lisboa',      lanes: 4 },
      { name: 'Alverca · Vila Franca',    start: 15000,  end: 30000,  key: 'pt_vfx',      label: 'Vila Franca', lanes: 3 },
      { name: 'Lezíria do Tejo',          start: 30000,  end: 60000,  key: 'pt_ribatejo', label: 'Ribatejo',    lanes: 3 },
      { name: 'Santarém · A1',            start: 60000,  end: 85000,  key: 'pt_santarem', label: 'Santarém',    lanes: 3 },
      { name: "Fátima · Serra d'Aire",    start: 85000,  end: 120000, key: 'pt_fatima',   label: 'Fátima',      lanes: 3 },
      { name: 'Leiria · Pinhal',          start: 120000, end: 148000, key: 'pt_leiria',   label: 'Leiria',      lanes: 3 },
      { name: 'Pombal · Condeixa',        start: 148000, end: 178000, key: 'pt_pombal',   label: 'Pombal',      lanes: 3 },
      { name: 'Coimbra · Mondego',        start: 178000, end: 205000, key: 'pt_coimbra',  label: 'Coimbra',     lanes: 3 },
      { name: 'Bairrada · Mealhada',      start: 205000, end: 228000, key: 'pt_bairrada', label: 'Mealhada',    lanes: 3 },
      { name: 'Aveiro · Ria',             start: 228000, end: 262000, key: 'pt_aveiro',   label: 'Aveiro',      lanes: 3 },
      { name: 'Sta M. da Feira · Gaia',   start: 262000, end: 288000, key: 'pt_gaia',     label: 'V.N. Gaia',   lanes: 4 },
      { name: 'Porto · Ponte da Arrábida', start: 288000, end: 299000, key: 'pt_porto',   label: 'Porto',       lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Lisboa · Sacavém', s: 800 },
      { label: 'Vila Franca de Xira', s: 22000 },
      { label: 'Santarém', s: 67000 },
      { label: 'Fátima', s: 112000 },
      { label: 'Leiria', s: 131000 },
      { label: 'Coimbra', s: 185000 },
      { label: 'Aveiro', s: 235000 },
      { label: 'Vila Nova de Gaia', s: 288000 },
      { label: 'Porto · Ponte da Arrábida', s: 296000 },
    ],
    // Real A1 saída sequence at its real kilometre points, Lisboa 1 → Porto 20.
    EXITS: [
      { s: 3000,   num: 1,  name: 'Sacavém · Aeroporto' },
      { s: 15000,  num: 2,  name: 'Alverca' },
      { s: 23000,  num: 3,  name: 'Vila Franca de Xira' },
      { s: 30000,  num: 4,  name: 'Carregado · A10' },
      { s: 45000,  num: 5,  name: 'Aveiras' },
      { s: 68000,  num: 6,  name: 'Santarém' },
      { s: 90000,  num: 7,  name: 'Torres Novas · A23' },
      { s: 113000, num: 8,  name: 'Fátima' },
      { s: 132000, num: 9,  name: 'Leiria' },
      { s: 155000, num: 10, name: 'Pombal' },
      { s: 175000, num: 11, name: 'Condeixa' },
      { s: 184000, num: 12, name: 'Coimbra Sul' },
      { s: 196000, num: 13, name: 'Coimbra Norte' },
      { s: 210000, num: 14, name: 'Mealhada' },
      { s: 236000, num: 15, name: 'Aveiro · A25' },
      { s: 248000, num: 16, name: 'Estarreja' },
      { s: 271000, num: 17, name: 'Sta Maria da Feira' },
      { s: 283000, num: 18, name: 'Carvalhos' },
      { s: 290000, num: 19, name: 'Vila Nova de Gaia' },
      { s: 295000, num: 20, name: 'Porto · VCI · Arrábida' },
    ],
  },
  a4: {
    // Spain: the A-4 — Autovía del Sur (E-5) — Madrid → Córdoba → Sevilla, at
    // TRUE scale: 529 km, 1 s-unit = 1 real metre, so every salida sits at its
    // real kilometre point (salida number = km = s/1000). The long route
    // south: out of Madrid past Getafe and Aranjuez, the dead-flat La Mancha
    // meseta (Don Quixote windmill country at Puerto Lápice), the vineyards of
    // Valdepeñas, the Despeñaperros gorge through the Sierra Morena into
    // Andalucía, then the Guadalquivir valley — olive groves at Andújar,
    // Córdoba, the sunflower plains of Écija, Carmona, and into Sevilla.
    // Toll-free autovía. Increasing s = SENTIDO SEVILLA.
    LOOP_LENGTH: 529000,
    ZONES: [
      { name: 'Madrid · Calle 30',        start: 0,      end: 12000,  key: 'es_madrid',    label: 'Madrid',       lanes: 4 },
      { name: 'Getafe · Pinto',           start: 12000,  end: 30000,  key: 'es_sur',       label: 'Getafe',       lanes: 3 },
      { name: 'Aranjuez',                 start: 30000,  end: 48000,  key: 'es_aranjuez',  label: 'Aranjuez',     lanes: 3 },
      { name: 'Ocaña · La Mancha',        start: 48000,  end: 100000, key: 'es_ocana',     label: 'La Mancha',    lanes: 3 },
      { name: 'Puerto Lápice · Molinos',  start: 100000, end: 130000, key: 'es_mancha',    label: 'Pto. Lápice',  lanes: 2 },
      { name: 'Manzanares · Valdepeñas',  start: 130000, end: 210000, key: 'es_valdepenas', label: 'Valdepeñas',  lanes: 2 },
      { name: 'Despeñaperros',            start: 210000, end: 252000, key: 'es_despena',   label: 'Despeñaperros', lanes: 2 },
      { name: 'La Carolina · Bailén',     start: 252000, end: 285000, key: 'es_bailen',    label: 'Bailén',       lanes: 2 },
      { name: 'Andújar · Olivares',       start: 285000, end: 375000, key: 'es_andujar',   label: 'Andújar',      lanes: 3 },
      { name: 'Córdoba',                  start: 375000, end: 425000, key: 'es_cordoba',   label: 'Córdoba',      lanes: 3 },
      { name: 'Écija · Girasoles',        start: 425000, end: 470000, key: 'es_ecija',     label: 'Écija',        lanes: 3 },
      { name: 'Carmona',                  start: 470000, end: 510000, key: 'es_carmona',   label: 'Carmona',      lanes: 3 },
      { name: 'Sevilla',                  start: 510000, end: 529000, key: 'es_sevilla',   label: 'Sevilla',      lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Madrid', s: 800 },
      { label: 'Aranjuez', s: 36000 },
      { label: 'Puerto Lápice · Molinos', s: 104000 },
      { label: 'Valdepeñas', s: 162000 },
      { label: 'Despeñaperros', s: 232000 },
      { label: 'Bailén', s: 268000 },
      { label: 'Andújar', s: 292000 },
      { label: 'Córdoba', s: 398000 },
      { label: 'Écija', s: 453000 },
      { label: 'Carmona', s: 504000 },
      { label: 'Sevilla', s: 522000 },
    ],
    // Spanish salidas are numbered by kilometre point — at true scale the
    // number IS the position: salida 398 sits at s = 398000.
    EXITS: [
      { s: 6000,   num: 6,   name: 'Villaverde · M-40' },
      { s: 13000,  num: 13,  name: 'Getafe' },
      { s: 24000,  num: 24,  name: 'Pinto · Valdemoro' },
      { s: 37000,  num: 37,  name: 'Aranjuez' },
      { s: 52000,  num: 52,  name: 'Ocaña · R-4 · AP-36' },
      { s: 62000,  num: 62,  name: 'Dosbarrios' },
      { s: 84000,  num: 84,  name: 'Madridejos · CM-42' },
      { s: 104000, num: 104, name: 'Puerto Lápice' },
      { s: 119000, num: 119, name: 'Villarta de San Juan' },
      { s: 135000, num: 135, name: 'Manzanares' },
      { s: 162000, num: 162, name: 'Valdepeñas' },
      { s: 177000, num: 177, name: 'Almuradiel' },
      { s: 232000, num: 232, name: 'Despeñaperros · Sta Elena' },
      { s: 257000, num: 257, name: 'La Carolina' },
      { s: 268000, num: 268, name: 'Bailén · A-44 · Granada' },
      { s: 292000, num: 292, name: 'Andújar' },
      { s: 321000, num: 321, name: 'Villa del Río' },
      { s: 359000, num: 359, name: 'El Carpio' },
      { s: 398000, num: 398, name: 'Córdoba' },
      { s: 429000, num: 429, name: 'La Carlota' },
      { s: 453000, num: 453, name: 'Écija' },
      { s: 478000, num: 478, name: 'La Luisiana' },
      { s: 504000, num: 504, name: 'Carmona' },
      { s: 527000, num: 527, name: 'Sevilla · SE-30' },
    ],
  },
  a3: {
    // Germany: the A3 (E35), Frankfurt → Köln, at TRUE scale: 175 km, 1 s-unit
    // = 1 real metre. Off the Frankfurter Kreuz, past the Wiesbadener Kreuz,
    // the climb into the wooded Taunus at Idstein, down to Limburg an der Lahn
    // (cathedral + the Lahntal viaduct), up over the Westerwald at Montabaur
    // (the Köln–Frankfurt ICE high-speed line runs right beside the autobahn),
    // the Siebengebirge hills at Bad Honnef, Kreuz Bonn/Siegburg, the
    // Königsforst, and into Köln under the Dom. No tolls for cars; long
    // derestricted (no-limit) stretches. Increasing s = RICHTUNG KÖLN.
    LOOP_LENGTH: 175000,
    ZONES: [
      { name: 'Frankfurt · Frankfurter Kreuz', start: 0,     end: 10000,  key: 'de_ffm',          label: 'Frankfurt', lanes: 4 },
      { name: 'Main-Taunus · Wiesbaden',   start: 10000,  end: 25000,  key: 'de_wiesbaden',    label: 'Wiesbaden',  lanes: 3 },
      { name: 'Taunus · Idstein',          start: 25000,  end: 48000,  key: 'de_taunus',       label: 'Idstein',    lanes: 3 },
      { name: 'Limburg an der Lahn',       start: 48000,  end: 64000,  key: 'de_limburg',      label: 'Limburg',    lanes: 3 },
      { name: 'Montabaur · Westerwald',    start: 64000,  end: 84000,  key: 'de_montabaur',    label: 'Montabaur',  lanes: 3 },
      { name: 'Westerwald · Dierdorf',     start: 84000,  end: 114000, key: 'de_westerwald',   label: 'Dierdorf',   lanes: 3 },
      { name: 'Siebengebirge · Bad Honnef', start: 114000, end: 134000, key: 'de_siebengebirge', label: 'Bad Honnef', lanes: 3 },
      { name: 'Kreuz Bonn/Siegburg',       start: 134000, end: 145000, key: 'de_bonn',         label: 'Bonn/Siegburg', lanes: 4 },
      { name: 'Lohmar · Königsforst',      start: 145000, end: 160000, key: 'de_lohmar',       label: 'Lohmar',     lanes: 3 },
      { name: 'Köln',                      start: 160000, end: 175000, key: 'de_koeln',        label: 'Köln',       lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Frankfurter Kreuz', s: 800 },
      { label: 'Wiesbadener Kreuz', s: 14000 },
      { label: 'Idstein · Taunus', s: 33000 },
      { label: 'Limburg an der Lahn', s: 55000 },
      { label: 'Montabaur', s: 79000 },
      { label: 'Westerwald', s: 98000 },
      { label: 'Siebengebirge', s: 130000 },
      { label: 'Kreuz Bonn/Siegburg', s: 139000 },
      { label: 'Kreuz Köln-Ost', s: 163000 },
      { label: 'Köln · Dom', s: 169000 },
    ],
    // Real-ish A3 Anschlussstelle numbering at real driving distances from
    // the Frankfurter Kreuz, descending toward Köln.
    EXITS: [
      { s: 2000,   num: 50, name: 'Frankfurter Kreuz · A5' },
      { s: 7000,   num: 49, name: 'Raunheim · Rüsselsheim' },
      { s: 15000,  num: 47, name: 'Wiesbadener Kreuz · A66' },
      { s: 24000,  num: 46, name: 'Niedernhausen' },
      { s: 33000,  num: 45, name: 'Idstein' },
      { s: 43000,  num: 44, name: 'Bad Camberg' },
      { s: 55000,  num: 43, name: 'Limburg-Süd · ICE-Bahnhof' },
      { s: 60000,  num: 42, name: 'Limburg-Nord' },
      { s: 79000,  num: 40, name: 'Montabaur' },
      { s: 90000,  num: 39, name: 'Ransbach-Baumbach' },
      { s: 100000, num: 37, name: 'Dierdorf' },
      { s: 108000, num: 36, name: 'Neuwied' },
      { s: 125000, num: 35, name: 'Bad Honnef · Linz' },
      { s: 132000, num: 34, name: 'Siebengebirge' },
      { s: 140000, num: 33, name: 'Kreuz Bonn/Siegburg · A560' },
      { s: 147000, num: 31, name: 'Lohmar' },
      { s: 155000, num: 30, name: 'Rösrath' },
      { s: 160000, num: 29, name: 'Köln-Königsforst' },
      { s: 164000, num: 28, name: 'Kreuz Köln-Ost · A4' },
      { s: 167000, num: 27, name: 'Köln-Dellbrück' },
      { s: 171000, num: 26, name: 'Köln-Mülheim · Zoobrücke' },
    ],
  },
  m1: {
    // Britain: Birmingham → London → the English Channel at TRUE scale,
    // 320 km, 1 s-unit = 1 real metre, driving on the LEFT in mph. The real
    // signed route: off Spaghetti Junction down the M6 past Coventry to the
    // Catthorpe Interchange, the M1 south through Northampton, Milton Keynes
    // and Luton into London — the capital built at its real ~45 km breadth,
    // Wembley arch to Canary Wharf — then out the A2 and down the M20 through
    // the Kent Downs to Folkestone (Eurotunnel) and the white cliffs of
    // Dover. Increasing s = THE SOUTH.
    LOOP_LENGTH: 320000,
    ZONES: [
      { name: 'Birmingham · Spaghetti Jct', start: 0,      end: 15000,  key: 'uk_bham',    label: 'Birmingham',  lanes: 4 },
      { name: 'M6 · Coventry',              start: 15000,  end: 50000,  key: 'uk_m6',      label: 'M6',          lanes: 3 },
      { name: 'M1 · Northampton',           start: 50000,  end: 95000,  key: 'uk_m1n',     label: 'Northampton', lanes: 3 },
      { name: 'M1 · Milton Keynes',         start: 95000,  end: 130000, key: 'uk_mk',      label: 'Milton Keynes', lanes: 4 },
      { name: 'M1 · Luton',                 start: 130000, end: 150000, key: 'uk_luton',   label: 'Luton',       lanes: 4 },
      { name: 'North London',               start: 150000, end: 165000, key: 'uk_nlondon', label: 'N London',    lanes: 4 },
      { name: 'London',                     start: 165000, end: 195000, key: 'uk_london',  label: 'London',      lanes: 4 },
      { name: 'South London · A2',          start: 195000, end: 212000, key: 'uk_slondon', label: 'S London',    lanes: 4 },
      { name: 'M20 · Maidstone',            start: 212000, end: 248000, key: 'uk_m20w',    label: 'Maidstone',   lanes: 3 },
      { name: 'Kent Downs · M20',           start: 248000, end: 285000, key: 'uk_kent',    label: 'Kent',        lanes: 3 },
      { name: 'Ashford · M20',              start: 285000, end: 305000, key: 'uk_ashford', label: 'Ashford',     lanes: 3 },
      { name: 'Folkestone · Dover',         start: 305000, end: 320000, key: 'uk_dover',   label: 'Dover',       lanes: 2 },
    ],
    SPAWNS: [
      { label: 'Birmingham · Spaghetti Jct', s: 800 },
      { label: 'Coventry', s: 30000 },
      { label: 'Catthorpe · M6→M1', s: 49000 },
      { label: 'Northampton', s: 75000 },
      { label: 'Milton Keynes', s: 95000 },
      { label: 'Luton ✈', s: 138000 },
      { label: 'Brent Cross · Wembley', s: 160000 },
      { label: 'Central London', s: 178000 },
      { label: 'Greenwich · A2', s: 192000 },
      { label: 'Maidstone', s: 248000 },
      { label: 'Ashford', s: 288000 },
      { label: 'Folkestone · Eurotunnel', s: 309000 },
      { label: 'Dover · White Cliffs', s: 317000 },
    ],
    // UK junction numbers (per motorway) at their real spacing.
    EXITS: [
      { s: 2000,   num: 6,     name: 'Spaghetti Junction · Aston' },
      { s: 12000,  num: 4,     name: 'Coleshill · NEC' },
      { s: 30000,  num: 2,     name: 'Coventry' },
      { s: 45000,  num: 1,     name: 'Rugby' },
      { s: 50000,  num: 19,    name: 'Catthorpe · M1 South' },
      { s: 62000,  num: 18,    name: 'Crick · Daventry' },
      { s: 73000,  num: 16,    name: 'Northampton West' },
      { s: 83000,  num: 15,    name: 'Northampton · A45' },
      { s: 95000,  num: 14,    name: 'Milton Keynes' },
      { s: 110000, num: 13,    name: 'Bedford · Woburn' },
      { s: 125000, num: 12,    name: 'Flitwick · Toddington' },
      { s: 138000, num: 10,    name: 'Luton Airport ✈' },
      { s: 148000, num: '6A',  name: 'M25 · London Orbital' },
      { s: 155000, num: 4,     name: 'Edgware · Mill Hill' },
      { s: 162000, num: 2,     name: 'Staples Corner · A406' },
      { s: 168000, num: '',    name: 'A406 North Circular · Brent Cross' },
      { s: 174000, num: '',    name: 'Westway A40 · Paddington' },
      { s: 180000, num: '',    name: 'Westminster · Embankment' },
      { s: 186000, num: '',    name: 'Blackwall Tunnel · A102' },
      { s: 193000, num: '',    name: 'A2 · Greenwich' },
      { s: 205000, num: '',    name: 'M25 · Dartford Crossing' },
      { s: 218000, num: 3,     name: 'M20 · Swanley' },
      { s: 230000, num: 4,     name: 'West Malling' },
      { s: 242000, num: 5,     name: 'Aylesford' },
      { s: 250000, num: 8,     name: 'Maidstone · Leeds Castle' },
      { s: 288000, num: 9,     name: 'Ashford International' },
      { s: 293000, num: 10,    name: 'Ashford South · A2070' },
      { s: 305000, num: 11,    name: 'Westenhanger · Hythe' },
      { s: 310000, num: '11A', name: 'EUROTUNNEL · Le Shuttle' },
      { s: 317000, num: '',    name: 'A20 · Dover Western Docks' },
    ],
  },
  a16: {
    // France: the A16 — L'Européenne (E402) — picking up at the Channel:
    // Calais/Coquelles → Paris at TRUE scale, 290 km, 1 s-unit = 1 real metre.
    // Out of the Eurotunnel terminal under the Côte d'Opale cliffs, Boulogne-
    // sur-Mer, the Somme estuary at Abbeville, Amiens under its cathedral,
    // the turbine-covered Picardie plateau, Beauvais, the Oise valley, and
    // into Paris at its real breadth — Saint-Denis, La Défense on the horizon,
    // the Eiffel Tower over the Haussmann roofs. SANEF toll autoroute.
    // Increasing s = DIRECTION PARIS.
    LOOP_LENGTH: 290000,
    ZONES: [
      { name: 'Calais · Coquelles',       start: 0,      end: 15000,  key: 'fr_calais',   label: 'Calais',      lanes: 3 },
      { name: 'Boulogne-sur-Mer',         start: 15000,  end: 45000,  key: 'fr_boulogne', label: 'Boulogne',    lanes: 2 },
      { name: "Côte d'Opale",             start: 45000,  end: 85000,  key: 'fr_opale',    label: "Côte d'Opale", lanes: 2 },
      { name: 'Abbeville · Baie de Somme', start: 85000,  end: 115000, key: 'fr_somme',    label: 'Abbeville',   lanes: 2 },
      { name: 'Amiens',                   start: 115000, end: 155000, key: 'fr_amiens',   label: 'Amiens',      lanes: 3 },
      { name: 'Plateau Picard',           start: 155000, end: 200000, key: 'fr_picardie', label: 'Picardie',    lanes: 2 },
      { name: 'Beauvais',                 start: 200000, end: 235000, key: 'fr_beauvais', label: 'Beauvais',    lanes: 3 },
      { name: "Vallée de l'Oise",         start: 235000, end: 260000, key: 'fr_oise',     label: 'Oise',        lanes: 3 },
      { name: 'Saint-Denis · La Plaine',  start: 260000, end: 275000, key: 'fr_stdenis',  label: 'Saint-Denis', lanes: 4 },
      { name: 'Paris',                    start: 275000, end: 290000, key: 'fr_paris',    label: 'Paris',       lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Coquelles · Eurotunnel', s: 2500 },
      { label: 'Calais', s: 9000 },
      { label: 'Boulogne-sur-Mer', s: 36000 },
      { label: 'Étaples · Le Touquet', s: 62000 },
      { label: 'Abbeville', s: 95000 },
      { label: 'Amiens', s: 135000 },
      { label: 'Beauvais', s: 215000 },
      { label: "L'Isle-Adam", s: 252000 },
      { label: 'Saint-Denis · Stade de France', s: 270000 },
      { label: 'Paris · Périphérique', s: 283000 },
    ],
    // French sorties, descending toward Paris.
    EXITS: [
      { s: 3000,   num: 43, name: 'Coquelles · Tunnel sous la Manche' },
      { s: 9000,   num: 42, name: 'Calais-Ouest' },
      { s: 14000,  num: 40, name: 'Calais-Sud · A26' },
      { s: 22000,  num: 36, name: 'Marquise · Cap Gris-Nez' },
      { s: 33000,  num: 32, name: 'Boulogne-Nord' },
      { s: 40000,  num: 31, name: 'Boulogne-Sud' },
      { s: 52000,  num: 28, name: 'Neufchâtel-Hardelot' },
      { s: 62000,  num: 26, name: 'Étaples · Le Touquet' },
      { s: 75000,  num: 25, name: 'Berck · Rang-du-Fliers' },
      { s: 95000,  num: 23, name: 'Abbeville · Baie de Somme' },
      { s: 110000, num: 22, name: 'Flixecourt' },
      { s: 130000, num: 21, name: 'Amiens-Ouest' },
      { s: 140000, num: 20, name: 'Amiens-Sud · A29' },
      { s: 165000, num: 19, name: 'Essertaux' },
      { s: 185000, num: 17, name: 'Breteuil · Froissy' },
      { s: 210000, num: 15, name: 'Beauvais-Nord' },
      { s: 220000, num: 14, name: 'Beauvais-Sud · Aéroport ✈' },
      { s: 240000, num: 12, name: 'Méru · Chambly' },
      { s: 252000, num: 10, name: "L'Isle-Adam" },
      { s: 262000, num: 5,  name: 'Francilienne · N104' },
      { s: 272000, num: 3,  name: 'Saint-Denis · Stade de France' },
      { s: 282000, num: 1,  name: 'Porte de la Chapelle · Périph.' },
    ],
  },
  a1it: {
    // Italy: the A1 Autostrada del Sole (E45), Roma → Napoli at TRUE scale,
    // 225 km, 1 s-unit = 1 real metre. Off the GRA at Roma Sud, down the
    // Valle Latina between the Apennine ridges — Valmontone, Frosinone, the
    // Ciociaria — under the abbey of Montecassino, over the Lazio/Campania
    // line at San Vittore, past Capua and the Reggia di Caserta, and into
    // Napoli with Vesuvio filling the windscreen. Closed toll system
    // (Telepass). Increasing s = DIREZIONE NAPOLI.
    LOOP_LENGTH: 225000,
    ZONES: [
      { name: 'Roma · GRA',              start: 0,      end: 15000,  key: 'it_roma',       label: 'Roma',       lanes: 4 },
      { name: 'Valmontone · Castelli',   start: 15000,  end: 35000,  key: 'it_castelli',   label: 'Valmontone', lanes: 3 },
      { name: 'Colleferro · Anagni',     start: 35000,  end: 55000,  key: 'it_colleferro', label: 'Anagni',     lanes: 3 },
      { name: 'Frosinone · Ciociaria',   start: 55000,  end: 85000,  key: 'it_frosinone',  label: 'Frosinone',  lanes: 3 },
      { name: 'Ceprano · Valle Latina',  start: 85000,  end: 110000, key: 'it_ceprano',    label: 'Ceprano',    lanes: 3 },
      { name: 'Cassino · Montecassino',  start: 110000, end: 138000, key: 'it_cassino',    label: 'Cassino',    lanes: 3 },
      { name: 'San Vittore · Apennini',  start: 138000, end: 162000, key: 'it_sanvittore', label: 'San Vittore', lanes: 3 },
      { name: 'Caianello · Campania',    start: 162000, end: 182000, key: 'it_caianello',  label: 'Caianello',  lanes: 3 },
      { name: 'Capua · Caserta',         start: 182000, end: 205000, key: 'it_caserta',    label: 'Caserta',    lanes: 3 },
      { name: 'Napoli · Vesuvio',        start: 205000, end: 225000, key: 'it_napoli',     label: 'Napoli',     lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Roma · GRA', s: 800 },
      { label: 'Valmontone Outlet', s: 30000 },
      { label: 'Anagni · Fiuggi', s: 52000 },
      { label: 'Frosinone', s: 72000 },
      { label: 'Ceprano', s: 92000 },
      { label: 'Cassino · Montecassino', s: 118000 },
      { label: 'Caianello', s: 162000 },
      { label: 'Caserta · Reggia', s: 193000 },
      { label: 'Napoli · Vesuvio', s: 214000 },
      { label: 'Napoli Centro', s: 222000 },
    ],
    // Italian uscite go by name, at their real spacing down the valley.
    EXITS: [
      { s: 5000,   num: '', name: 'Roma Sud · San Cesareo' },
      { s: 18000,  num: '', name: 'Monte Porzio Catone' },
      { s: 30000,  num: '', name: 'Valmontone · Outlet' },
      { s: 40000,  num: '', name: 'Colleferro' },
      { s: 52000,  num: '', name: 'Anagni · Fiuggi' },
      { s: 62000,  num: '', name: 'Ferentino' },
      { s: 72000,  num: '', name: 'Frosinone' },
      { s: 92000,  num: '', name: 'Ceprano' },
      { s: 102000, num: '', name: 'Pontecorvo · Castrocielo' },
      { s: 118000, num: '', name: 'Cassino' },
      { s: 138000, num: '', name: 'San Vittore' },
      { s: 162000, num: '', name: 'Caianello · Venafro' },
      { s: 182000, num: '', name: 'Capua' },
      { s: 192000, num: '', name: 'Santa Maria Capua Vetere' },
      { s: 198000, num: '', name: 'Caserta Sud · Reggia' },
      { s: 208000, num: '', name: 'Napoli Nord · Afragola' },
      { s: 216000, num: '', name: 'Casoria · Napoli Est' },
      { s: 221000, num: '', name: 'Napoli Centro · Porto' },
    ],
  },
  swiss: {
    // Switzerland at TRUE scale — the grand tour, Interlaken → Genève, 410 km,
    // 1 s-unit = 1 real metre. Out of the Berner Oberland under the Eiger–Mönch–
    // Jungfrau wall, over the Brünig to Luzern on the Vierwaldstättersee, past
    // Zug to Zürich on the Limmat (the money), across the Mittelland through the
    // Aargau to Bern the federal city, over the Röstigraben at Fribourg into
    // French Switzerland, down to Lausanne on the Lac Léman and along the vine
    // terraces of Lavaux to Genève with the Jet d'Eau and Mont-Blanc beyond.
    // No toll booths — a vignette sticker instead. Increasing s = toward Genève.
    LOOP_LENGTH: 410000,
    ZONES: [
      { name: 'Interlaken · Berner Oberland', start: 0,      end: 30000,  key: 'ch_interlaken', label: 'Interlaken', lanes: 3 },
      { name: 'Brienz · Brünig',              start: 30000,  end: 60000,  key: 'ch_brunig',     label: 'Brünig',     lanes: 2 },
      { name: 'Luzern · Vierwaldstättersee',  start: 60000,  end: 95000,  key: 'ch_luzern',     label: 'Luzern',     lanes: 3 },
      { name: 'Zug · Zugersee',               start: 95000,  end: 120000, key: 'ch_zug',        label: 'Zug',        lanes: 3 },
      { name: 'Zürich · Limmat',              start: 120000, end: 162000, key: 'ch_zurich',     label: 'Zürich',     lanes: 4 },
      { name: 'Aargau · Mittelland',          start: 162000, end: 210000, key: 'ch_aargau',     label: 'Aarau',      lanes: 3 },
      { name: 'Bern · Bundesstadt',           start: 210000, end: 252000, key: 'ch_bern',       label: 'Bern',       lanes: 4 },
      { name: 'Fribourg · Freiburg',          start: 252000, end: 292000, key: 'ch_fribourg',   label: 'Fribourg',   lanes: 3 },
      { name: 'Lausanne · Léman',             start: 292000, end: 348000, key: 'ch_lausanne',   label: 'Lausanne',   lanes: 4 },
      { name: 'Genève · Léman',               start: 348000, end: 410000, key: 'ch_geneve',     label: 'Genève',     lanes: 4 },
    ],
    SPAWNS: [
      { label: 'Interlaken · Jungfrau', s: 800 },
      { label: 'Brienzersee', s: 24000 },
      { label: 'Brünig Pass', s: 46000 },
      { label: 'Luzern · Kapellbrücke', s: 78000 },
      { label: 'Zug', s: 106000 },
      { label: 'Zürich · Bahnhofstrasse', s: 140000 },
      { label: 'Aarau', s: 186000 },
      { label: 'Bern · Bundeshaus', s: 232000 },
      { label: 'Fribourg · Röstigraben', s: 270000 },
      { label: 'Lausanne · Ouchy', s: 320000 },
      { label: 'Genève · Jet d\'Eau', s: 402000 },
    ],
    // Swiss exits go by name in the local language of the canton — German
    // through the Mittelland, French past the Röstigraben.
    EXITS: [
      { s: 6000,   num: '', name: 'Interlaken Ost' },
      { s: 16000,  num: '', name: 'Interlaken West · Thunersee' },
      { s: 34000,  num: '', name: 'Brienz' },
      { s: 46000,  num: '', name: 'Brünig · Lungern' },
      { s: 56000,  num: '', name: 'Sarnen · Sachseln' },
      { s: 70000,  num: '', name: 'Luzern-Süd · Horw' },
      { s: 82000,  num: '', name: 'Luzern-Zentrum' },
      { s: 92000,  num: '', name: 'Küssnacht · Rigi' },
      { s: 106000, num: '', name: 'Zug' },
      { s: 116000, num: '', name: 'Baar · Sihlbrugg' },
      { s: 128000, num: '', name: 'Zürich-Wollishofen' },
      { s: 142000, num: '', name: 'Zürich-City · Sihlquai' },
      { s: 156000, num: '', name: 'Zürich-Nord · Flughafen ✈' },
      { s: 172000, num: '', name: 'Baden · Wettingen' },
      { s: 188000, num: '', name: 'Aarau-Ost' },
      { s: 200000, num: '', name: 'Oftringen · Zofingen' },
      { s: 220000, num: '', name: 'Bern-Wankdorf' },
      { s: 232000, num: '', name: 'Bern-Zentrum · Bundeshaus' },
      { s: 246000, num: '', name: 'Bern-Bümpliz' },
      { s: 262000, num: '', name: 'Freiburg · Fribourg-Nord' },
      { s: 282000, num: '', name: 'Fribourg-Sud · Bulle' },
      { s: 300000, num: '', name: 'Lausanne-Blécherette' },
      { s: 320000, num: '', name: 'Lausanne-Sud · Ouchy' },
      { s: 334000, num: '', name: 'Morges · La Côte' },
      { s: 352000, num: '', name: 'Nyon · St-Cergue' },
      { s: 372000, num: '', name: 'Coppet · Versoix' },
      { s: 392000, num: '', name: 'Genève-Aéroport ✈' },
      { s: 404000, num: '', name: 'Genève-Lac · Rive · Centre' },
    ],
  },
  // ---------------------------------------------------------------------------
  // WALKING MAPS — not the road engine. These are free-roam villages (walk: true)
  // driven by village.js: you walk a person around in all directions, no loop.
  // The road exports below are harmless placeholders so config stays valid.
  // ---------------------------------------------------------------------------
  konkan: {
    walk: true,
    LOOP_LENGTH: 4000,
    ZONES: [{ name: 'Konkan Village', start: 0, end: 4000, key: 'village', label: 'Village', lanes: 1 }],
    EXITS: [{ s: 0, num: 1, name: 'Village' }],
    SPAWNS: [],
    // A British-Raj Konkan village on the Maharashtra–Goa border, c. 1920s: the
    // wadi (hamlet) of tile-roofed laterite houses under coconut palms, the
    // temple square, paddy terraces climbing toward the Sahyadri ghats to the
    // east, and the Arabian Sea with its beach and fishing jetty to the west.
    // A small colonial town centre (cutchery, church, bazaar, police chowki)
    // sits at the edge. Weather/season/clock all work as on the road maps.
    WORLD: {
      region: 'Konkan', state: 'Bombay Presidency', size: 900,
      climate: [92, 88], humid: true, sea: 'west',
      spawns: [
        { label: 'Temple Square', x: 0, z: 0 },
        { label: 'The Wadi (Hamlet)', x: -120, z: 90 },
        { label: 'Beach · Fishing Jetty', x: -560, z: -40 },
        { label: 'Paddy Terraces', x: 250, z: 160 },
        { label: 'Banyan Chowk', x: 60, z: -140 },
        { label: 'Cutchery · Colonial Office', x: 300, z: -230 },
        { label: 'Town Bazaar', x: 250, z: -120 },
        { label: 'Mission Church', x: 380, z: -80 },
        { label: 'Ghat Viewpoint', x: 470, z: 260 },
      ],
    },
  },
  bihar: {
    walk: true,
    LOOP_LENGTH: 4000,
    ZONES: [{ name: 'Bihar Village', start: 0, end: 4000, key: 'village', label: 'Village', lanes: 1 }],
    EXITS: [{ s: 0, num: 1, name: 'Village' }],
    SPAWNS: [],
    // A rural village in the Gangetic plains of Bihar under the Raj, c. 1920s:
    // flat, dusty, dense. Mud-and-thatch kaccha houses packed along narrow lanes,
    // the zamindar's brick haveli lording over them, segregated caste tolas at
    // the margins, wheat and paddy stretching to the horizon, the Ganga on its
    // embankment, and the machinery of empire — the collectorate/thana, an indigo
    // kothi, a railway halt — pressing on village life.
    WORLD: {
      region: 'Bihar', state: 'Bengal Presidency', size: 950,
      climate: [104, 74], humid: false, river: 'north', dust: true,
      spawns: [
        { label: 'Village Chowk', x: 0, z: 0 },
        { label: "Zamindar's Haveli", x: 140, z: -90 },
        { label: 'Wheat Fields', x: -300, z: 200 },
        { label: 'The Tola (Hamlet)', x: -180, z: -160 },
        { label: 'Ganga Ghat · Riverbank', x: 40, z: -430 },
        { label: 'Collectorate · Thana', x: 300, z: -120 },
        { label: 'Indigo Kothi', x: 340, z: 120 },
        { label: 'Railway Halt', x: -60, z: 300 },
        { label: 'Haat · Bazaar', x: 120, z: 110 },
      ],
    },
  },
  delhi: {
    walk: true,
    LOOP_LENGTH: 4000,
    ZONES: [{ name: 'Shahjahanabad', start: 0, end: 4000, key: 'village', label: 'Delhi', lanes: 1 }],
    EXITS: [{ s: 0, num: 1, name: 'Delhi' }],
    SPAWNS: [],
    // Mughal Delhi — Shahjahanabad, the walled capital of Shah Jahan, 17th c.:
    // the red-sandstone Qila (Red Fort) on the Yamuna, the great Jama Masjid on
    // its plinth, the Chandni Chowk bazaar with its central canal, noble havelis,
    // mosques and a domed tomb in a charbagh garden, city walls and gates. Court
    // nobles, Mughal soldiers, traders, water-carriers, elephants and camels.
    WORLD: {
      region: 'Shahjahanabad', state: 'Mughal Empire', size: 950,
      climate: [106, 70], humid: false, dust: true, river: 'east', era: 'mughal',
      spawns: [
        { label: 'Chandni Chowk', x: 0, z: 0 },
        { label: 'Red Fort · Lahori Gate', x: 360, z: 40 },
        { label: 'Jama Masjid', x: 60, z: 220 },
        { label: 'Diwan-i-Aam Court', x: 470, z: 40 },
        { label: 'Nobles’ Havelis', x: -220, z: -60 },
        { label: 'Tomb · Charbagh Garden', x: -360, z: 260 },
        { label: 'Kashmiri Gate', x: -300, z: -340 },
        { label: 'Caravanserai', x: 200, z: -260 },
        { label: 'Yamuna Riverfront', x: 640, z: 40 },
        { label: 'Kotwali Bazaar', x: -120, z: 120 },
      ],
    },
  },
  carolina: {
    walk: true,
    LOOP_LENGTH: 4000,
    ZONES: [{ name: 'Rockford', start: 0, end: 4000, key: 'village', label: 'Rockford', lanes: 1 }],
    EXITS: [{ s: 0, num: 1, name: 'Rockford' }],
    SPAWNS: [],
    // Antebellum North Carolina, c. 1840s: a Piedmont town, Rockford, ringed by
    // cotton and tobacco plantations worked by enslaved people. A sober,
    // historically honest depiction of slavery and segregation — the columned
    // Great House and the log slave quarters behind it; the fields; the town
    // square with its courthouse, church, store, and the auction block where
    // human beings were sold. Not a romance of the "Old South" but its truth.
    WORLD: {
      region: 'Rockford, N.C.', state: 'United States', size: 950,
      climate: [90, 52], humid: true, river: 'south', era: 'antebellum',
      spawns: [
        { label: 'Town Square · Courthouse', x: 0, z: 0 },
        { label: 'Auction Block', x: 40, z: 40 },
        { label: 'Meeting House Church', x: -90, z: -60 },
        { label: 'General Store & Tavern', x: 70, z: -50 },
        { label: 'Rosedale · Great House', x: 320, z: 160 },
        { label: 'Slave Quarters', x: 360, z: 260 },
        { label: 'Cotton Fields', x: 480, z: 120 },
        { label: 'Tobacco Fields', x: -300, z: 220 },
        { label: 'Cotton Gin & Barns', x: 240, z: 240 },
        { label: 'Mill Creek', x: -60, z: -360 },
      ],
    },
  },
  rio: {
    walk: true,
    LOOP_LENGTH: 4000,
    ZONES: [{ name: 'Favela', start: 0, end: 4000, key: 'village', label: 'Favela', lanes: 1 }],
    EXITS: [{ s: 0, num: 1, name: 'Favela' }],
    SPAWNS: [],
    // A present-day Rio de Janeiro morro, top to bottom: dense raw-brick / bare-
    // concrete houses climbing the hill, becos and public staircases, retaining
    // walls, street lamps, a floodlit quadra, botecos, an igreja, a school and a
    // health post, string lights everywhere — the estrada winding up to a mirante
    // at the crest with the whole city, bay, Lagoa, skyline, Sugarloaf and Cristo
    // laid out below. At the foot, the walkable asfalto: a real avenue with lane
    // lines, sidewalks, a working semáforo, shopfront blocks and a bus terminal,
    // buses and cars running the route. All the life and grit of the morro.
    WORLD: {
      region: 'Morro da Favela', state: 'Rio de Janeiro', size: 720,
      climate: [95, 80], humid: true, era: 'modern', hill: true, night: true,
      spawns: [
        { label: 'Estrada (Main Road)', x: 40, z: 205 },
        { label: 'Praça · Boteco', x: -36, z: 96 },
        { label: 'Base · Bus Stop', x: 0, z: 360 },
        { label: 'Avenida · O Asfalto', x: 0, z: 438 },
        { label: 'Bus Terminal (Centro)', x: -500, z: 512 },
        { label: 'Downtown Shops', x: 70, z: 438 },
        { label: 'Escola · Health Post', x: -90, z: 130 },
        { label: 'Quadra (Soccer Cage)', x: 120, z: 40 },
        { label: 'Mercadinho', x: -110, z: 20 },
        { label: 'Igreja (Church)', x: 90, z: -40 },
        { label: 'Moto-Taxi Stand', x: -20, z: 150 },
        { label: 'Beco (Alley)', x: -140, z: -60 },
        { label: 'Baile Funk', x: 60, z: -120 },
        { label: 'Laje Rooftops', x: -60, z: -160 },
        { label: 'Mirante · City View', x: 0, z: -296 },
      ],
    },
  },
  newark: {
    walk: true,
    LOOP_LENGTH: 4000,
    ZONES: [{ name: 'EWR', start: 0, end: 4000, key: 'airport', label: 'EWR', lanes: 1 }],
    EXITS: [{ s: 0, num: 1, name: 'EWR' }],
    SPAWNS: [],
    // Newark Liberty International (EWR), to scale and walkable: Terminals A, B
    // and C (United's hub) with check-in halls, TSA checkpoints, gates, jet
    // bridges and parked jets; an elevated AirTrain looping the frontage; the
    // arrivals/departures roadway with taxis, Ubers, NJ Transit buses and big
    // green highway signs (NYC via I-78, AirTrain to rail, rideshare) plus World
    // Cup 26 banners. A true global cross-section of travellers and airport staff.
    WORLD: {
      region: 'Newark Liberty (EWR)', state: 'New Jersey', size: 760,
      climate: [88, 44], humid: true, era: 'modern',
      spawns: [
        { label: 'Terminal C · Check-In (United)', x: 320, z: 20 },
        { label: 'Terminal C · Departure Gates', x: 320, z: -18 },
        { label: 'TSA Security Checkpoint · C', x: 320, z: 12 },
        { label: 'Terminal B · International', x: 0, z: 18 },
        { label: 'Terminal B · Gates', x: 0, z: -18 },
        { label: 'Terminal A', x: -320, z: 18 },
        { label: 'AirTrain Station', x: 0, z: 100 },
        { label: 'Arrivals / Departures Roadway', x: 0, z: 138 },
        { label: 'Curbside · Baggage Claim', x: -320, z: 132 },
        { label: 'Apron · Gate View', x: 0, z: -60 },
      ],
    },
  },
  railcorridor: {
    walk: true,
    WORLD: {
      region: 'Kolkata–Delhi–Amritsar Rail Corridor', state: 'India', size: 3200,
      climate: [98, 58], humid: true, era: 'modern', rail: true,
      spawns: [
        { key: 'howrah', label: 'Howrah · Kolkata', x: -2800, z: 0 },
        { key: 'bardhaman', label: 'Bardhaman · West Bengal', x: -2400, z: 0 },
        { key: 'asansol', label: 'Asansol Junction', x: -2000, z: 0 },
        { key: 'dhanbad', label: 'Dhanbad Junction · Jharkhand', x: -1600, z: 0 },
        { key: 'gaya', label: 'Gaya Junction · Bihar', x: -1200, z: 0 },
        { key: 'dehri', label: 'Dehri-on-Sone', x: -800, z: 0 },
        { key: 'ddun', label: 'DDU Junction · UP', x: -400, z: 0 },
        { key: 'prayagraj', label: 'Prayagraj Junction', x: 0, z: 0 },
        { key: 'kanpur', label: 'Kanpur Central', x: 420, z: 0 },
        { key: 'etawah', label: 'Etawah', x: 820, z: 0 },
        { key: 'aligarh', label: 'Aligarh Junction', x: 1220, z: 0 },
        { key: 'delhi', label: 'New Delhi', x: 1620, z: 0 },
        { key: 'panipat', label: 'Panipat', x: 1990, z: 0 },
        { key: 'ambala', label: 'Ambala Cantt', x: 2350, z: 0 },
        { key: 'ludhiana', label: 'Ludhiana Junction', x: 2700, z: 0 },
        { key: 'jalandhar', label: 'Jalandhar City', x: 3000, z: 0 },
        { key: 'amritsar', label: 'Amritsar Terminus', x: 3250, z: 0 },
      ],
    },
  },
  railride: {
    walk: true,
    WORLD: {
      region: 'Indian Railways · Gangetic Plain', state: 'India', size: 650,
      climate: [98, 58], humid: true, era: 'modern', rail: true,
      spawns: [
        { key: 'howrah', label: 'Board at Howrah', x: 0, z: 0 },
        { key: 'delhi', label: 'Delhi service', x: 0, z: 0 },
        { key: 'amritsar', label: 'Amritsar service', x: 0, z: 0 },
      ],
    },
  },
  delhislum: {
    walk: true,
    LOOP_LENGTH: 4000,
    ZONES: [{ name: 'Basti', start: 0, end: 4000, key: 'village', label: 'Basti', lanes: 1 }],
    EXITS: [{ s: 0, num: 1, name: 'Basti' }],
    SPAWNS: [],
    // A present-day Delhi jhuggi-jhopri basti — a Gangetic-plain migrant slum,
    // tin-and-tarp shanties packed wall to wall, an open nullah, hand pumps, a
    // mandir and a masjid, cows and cycle-rickshaws, the elevated Metro overhead
    // — and across the boundary wall, the other India: glass towers, a mall and a
    // clean road full of cars. The density, poverty and wealth gulf of khadar
    // Delhi, under heat, dust and winter smog.
    WORLD: {
      region: 'Yamuna Khadar Basti', state: 'Delhi', size: 700,
      climate: [105, 68], humid: false, smog: true, era: 'modern', night: true,
      spawns: [
        { label: 'Gali (Basti Lane)', x: -40, z: -120 },
        { label: 'Market · Chai Adda', x: -40, z: 40 },
        { label: 'Hand Pump', x: -260, z: -200 },
        { label: 'The Nullah (Drain)', x: -180, z: -120 },
        { label: 'Mandir', x: -300, z: -30 },
        { label: 'Masjid', x: 300, z: -20 },
        { label: 'Metro Station (board here)', x: 0, z: 48 },
        { label: 'Main Road', x: 120, z: 60 },
        { label: 'Society Gate', x: 0, z: 90 },
        { label: 'DLF Towers', x: -100, z: 250 },
        { label: 'The Mall', x: 140, z: 224 },
        { label: 'Deep Basti', x: 150, z: -260 },
        { label: 'City Centre · Rajiv Chowk', x: 0, z: 476 },
        { label: 'Bazaar (Chandni Chowk)', x: 0, z: 560 },
      ],
    },
  },
};

// Walking maps (free-roam villages) vs the road-loop maps.
export const WALK = MAPS[MAP].walk === true;
export const WORLD = MAPS[MAP].WORLD || null;

export const LOOP_LENGTH = MAPS[MAP].LOOP_LENGTH;
// Long routes keep real-world logical coordinates for zones/signs, but their
// rendered/driven road is compressed to a practical session length. Relative
// geography stays intact while a full route no longer requires an all-day run.
// Libertia's 500-mile base map and its companion routes use the same gameplay
// compression: route distances remain logical/real-world in signs and zones,
// while the rendered loop stays practical to drive.
export const DISTANCE_SCALE = MAP === 'i95' ? 0.45
  : MAP === 'nc40' ? 0.45
  // I-278 keeps the real logical checkpoint order, but its rendered loop is
  // compressed to the actual NJ–NYC corridor scale instead of stretching the
  // boroughs into an oversized scenic loop.
  : MAP === 'i278' ? 0.65
  : MAP === 'i78' ? 0.38
  : MAP === 'delhikolkata' ? 0.22
  // Keep the logical 60-mile Philly–AC route for signs and checkpoints, but
  // compress the rendered/driven distance to roughly 20 miles: a 15–25 minute
  // practical run at normal highway speeds.
  : MAP === 'acx' ? 0.33
  // GWB → Jericho is roughly 35 real-world miles; preserve logical exit
  // distances while making the rendered drive practical.
  : MAP === 'nyc' ? 0.60
  : MAP === 'midwest' ? 5.0
  : MAP === 'tx45' || MAP === 'flturnpike' || MAP === 'cal5' || MAP === 'nh48' || MAP === 'libertia' || MAP === 'i380' || MAP === 'i980' || MAP === 'lb24' || MAP === 'us67' ? 0.35 : 1;
export const BASE_RADIUS = LOOP_LENGTH * DISTANCE_SCALE / (2 * Math.PI);
export const ZONES = MAPS[MAP].ZONES;
export const EXITS = MAPS[MAP].EXITS;
export const SPAWNS = MAPS[MAP].SPAWNS ?? [];

export const LANE_WIDTH = 3.7;
export const LANES_MAX = 6;                // widest section (NJ Turnpike: 6 per direction)
export const MEDIAN_HALF = 4.0;            // centerline to inner edge of travel lanes
export const SHOULDER = 3.0;

export function zoneAt(s) {
  s = wrapS(s);
  for (const z of ZONES) if (s >= z.start && s < z.end) return z;
  return ZONES[0];
}

export function wrapS(s) {
  return ((s % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH;
}

// Inner Reston is a constrained, older urban viaduct: keep the lanes visibly
// tighter without changing the lane count or the route's traffic logic.
export function laneWidthAt(s) {
  return MAP === 'us67' && wrapS(s) >= 166000 ? 3.2 : LANE_WIDTH;
}

// Signed shortest distance from a to b along the loop (b - a).
export function loopDelta(a, b) {
  let d = wrapS(b) - wrapS(a);
  if (d > LOOP_LENGTH / 2) d -= LOOP_LENGTH;
  if (d < -LOOP_LENGTH / 2) d += LOOP_LENGTH;
  return d * DISTANCE_SCALE;
}

export const RAMP_LENGTH = 220;

// Traffic — India runs a much bigger fleet: the chaos needs bodies, and the
// road stays visibly packed with cars (the per-zone density target is ~3x,
// so the NPC pool is what actually caps how many are on screen).
export const NPC_COUNT = MAP === 'india' ? 400 : MAP === 'nh48' ? 450 : MAP === 'delhikolkata' ? 520 : MAP === 'andheri' ? 320 : MAP === 'aundh' ? 340 : MAP === 'newdelhi' ? 380 : MAP === 'nyc' ? 300 : MAP === 'i78' ? 340 : MAP === 'i278' ? 300 : MAP === 'bronxriver' ? 310 : MAP === 'm1' ? 300 : MAP === 'us1' ? 240 : MAP === 'gsp' ? 260 : MAP === 'tx45' ? 285 : MAP === 'flturnpike' ? 270 : MAP === 'cal5' ? 285 : (MAP === 'a16' || MAP === 'a1it') ? 220 : MAP === 'swiss' ? 240 : 175;
export const SPAWN_RADIUS = 800;    // keep NPCs within this loop distance of player
export const MPH = 0.44704;         // 1 mph in m/s

// Day/night: full cycle in seconds of real time. Deliberately very slow so the
// time of day barely creeps during a drive; tap the time-scale key to
// fast-forward to night. (A full day is ~5 real hours at 1x.)
// ACX is a roughly 60-mile logical route compressed to a 15–25 minute
// practical drive. Its clock stays slower than real time so the shorter drive
// still reads as a meaningful in-game journey rather than a few minutes.
export const DAY_LENGTH = MAP === 'acx' || MAP === 'nyc' ? 27000 : 18000;
