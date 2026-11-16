import * as THREE from 'three';
import { MAP, DIR, LOOP_LENGTH, zoneAt, EURO, UK } from './config.js';
import { posAt, headingAt } from './road.js';
import { groundY, roadClearAt } from './environment.js';
import { gantry, textBoard } from './turnpike.js';

// zones that get frequent overhead control-city signs, the way a real urban
// freeway is plastered with big green guide signs
const URBAN = new Set([
  'bronx', 'westchester', 'newhaven', 'suburb', 'philly',
  'boston95', 'providence',
  'gsp_i95', 'gsp_rahway', 'gsp_union', 'gsp_essex', 'gsp_clifton', 'gsp_paterson', 'gsp_north',
  'gsp_lakewood', 'gsp_monmouth', 'gsp_raritan',
  'philly76', 'wwb', 'nj42', 'acx_ac',
  'sf', 'baybridge', 'oakland', 'i580', 'dublin', 'i680', 'vallejo', 'richmond', 'eastbay',
  'perthamboy', 'piscataway', 'morristown',
  'yonkers', 'nybronx', 'gwb287',
  'brp_kensico', 'brp_scarsdale', 'brp_bronxville', 'brp_woodlawn', 'brp_bronx',
  'brp_story', 'brp_bruckner', 'brp_i295_bronx', 'brp_throgs', 'brp_bayside',
  'brp_i495', 'brp_queensvillage',
  'hartford', 'boston', 'logan',
  'fortlee', 'njsub80', 'cleveland', 'toledo', 'chi80',
  'ord', 'i90ken', 'chidt', 'danryan', 'skyway', 'i80', 'gary', 'indy', 'cincy', 'downtown',
  'millcreek', 'dayton',
  'lib_reston', 'lib_corridor', 'lib_jacobs',
  'mumbai', 'chembur', 'pcmc', 'pune',
  'd_gurgaon', 'd_dhaula', 'd_cp', 'd_ito', 'd_noida', 'd_ring', 'd_pbagh', 'd_rohtak',
  'andheriW', 'airport', 'bandra', 'sealink', 'marine',
  'p_gaon', 'p_aundh', 'p_link', 'p_baner', 'p_bale', 'p_pashan', 'p_iti',
  'pt_lisboa', 'pt_gaia', 'pt_porto', 'pt_coimbra',
  'es_madrid', 'es_sur', 'es_cordoba', 'es_sevilla',
  'de_ffm', 'de_bonn', 'de_koeln',
  'uk_bham', 'uk_nlondon', 'uk_london', 'uk_slondon',
  'fr_calais', 'fr_amiens', 'fr_stdenis', 'fr_paris',
  'it_roma', 'it_caserta', 'it_napoli',
]);

// ---------------------------------------------------------------------------
// Periodic route-reassurance markers: an interstate shield (or the local
// equivalent) plus a green control-city plate, mounted on the shoulder of the
// carriageway you're driving. The control city shown is the one AHEAD in your
// current direction of travel, so it always reads for your bound.
// ---------------------------------------------------------------------------

// [ increasing-s heading word , decreasing-s heading word ] — same convention
// as the HUD direction label in main.js.
const CARDINALS = {
  i95:     ['SOUTH', 'NORTH'],
  i287:    ['NORTH', 'SOUTH'],
  bronxriver: ['SOUTH', 'NORTH'],
  gsp:     ['NORTH', 'SOUTH'],
  acx:     ['EAST', 'WEST'],
  bay:     ['EAST', 'WEST'],
  newengland: ['EAST', 'WEST'],
  i80:     ['WEST', 'EAST'],
  midwest: ['SOUTH', 'NORTH'],
  libertia: ['EAST', 'WEST'],
  india:   ['EAST', 'WEST'],
  andheri: ['SOUTH', 'NORTH'],
  aundh:   ['', ''],   // Pune signs the chowk ahead, not a compass word
  newdelhi: ['', ''],   // Delhi signs the destination, not a compass word
  // Europe doesn't sign compass cardinals the American way: Portugal posts
  // Norte/Sul, Spain and Germany just sign the control city ('' = omit).
  a1:      ['NORTE', 'SUL'],
  a4:      ['', ''],
  a3:      ['', ''],
  // the great British sign convention: destinations are "The NORTH" and
  // "The SOUTH"
  m1:      ['The SOUTH', 'The NORTH'],
  a16:     ['', ''],
  a1it:    ['', ''],
  swiss:   ['', ''],   // Switzerland signs the control city, not a cardinal
}[MAP] || ['SOUTH', 'NORTH'];

// Route segments along the loop. { s0, s1, route, kind, inc, dec }
//   kind: 'is' interstate shield · 'nh' Indian national highway · 'exp'
//   expressway · 'city' named city road. inc/dec = control city ahead when
//   driving increasing-s / decreasing-s.
const SEGMENTS = {
  i95: [
    { s0: 0,      s1: 31500,  route: 'I-95', kind: 'is', inc: 'New York',     dec: 'New Haven' },
    { s0: 31500,  s1: 44000,  route: 'I-95', kind: 'is', inc: 'Geo Wash Br',  dec: 'New Haven' },
    { s0: 44000,  s1: 73000,  route: 'I-95', kind: 'is', tb: 'njtp', inc: 'Trenton',      dec: 'New York' },
    { s0: 73000,  s1: 77000,  route: 'I-95', kind: 'is', tb: 'njtp', inc: 'Philadelphia', dec: 'New York' },
    { s0: 77000,  s1: 96000,  route: 'I-95', kind: 'is', inc: 'Wilmington',   dec: 'Trenton' },
    // DE → FL true-scale run — control cities shift south along real I-95
    { s0: 96000,   s1: 133700,  route: 'I-95', kind: 'is', inc: 'Baltimore',       dec: 'Philadelphia' },
    { s0: 133700,  s1: 201300,  route: 'I-95', kind: 'is', inc: 'Baltimore',       dec: 'Wilmington' },
    { s0: 201300,  s1: 309100,  route: 'I-95', kind: 'is', inc: 'Washington',      dec: 'Baltimore' },
    { s0: 309100,  s1: 488900,  route: 'I-95', kind: 'is', inc: 'Richmond',        dec: 'Washington' },
    { s0: 488900,  s1: 596700,  route: 'I-95', kind: 'is', inc: 'Rocky Mount',     dec: 'Richmond' },
    { s0: 596700,  s1: 732400,  route: 'I-95', kind: 'is', inc: 'Fayetteville',    dec: 'Richmond' },
    { s0: 732400,  s1: 888500,  route: 'I-95', kind: 'is', inc: 'Florence',    dec: 'Rocky Mount' },
    { s0: 888500,  s1: 1044300, route: 'I-95', kind: 'is', inc: 'Savannah',        dec: 'Fayetteville' },
    { s0: 1044300, s1: 1208400, route: 'I-95', kind: 'is', inc: 'Savannah',        dec: 'Florence' },
    { s0: 1208400, s1: 1388700, route: 'I-95', kind: 'is', inc: 'Jacksonville',    dec: 'Savannah' },
    { s0: 1388700, s1: 1585200, route: 'I-95', kind: 'is', inc: 'Daytona Beach',   dec: 'Savannah' },
    { s0: 1585200, s1: 1841100, route: 'I-95', kind: 'is', inc: 'West Palm Beach', dec: 'Jacksonville' },
    { s0: 1841100, s1: 1963400, route: 'I-95', kind: 'is', inc: 'Miami',           dec: 'Daytona Beach' },
    { s0: 1963400, s1: 2003600, route: 'I-95', kind: 'is', inc: 'Miami',           dec: 'Fort Lauderdale' },
    // Northeast leg (Boston/Providence/New London), shifted +1907600
    { s0: 2003600, s1: 2012600, route: 'I-95', kind: 'is', inc: 'Providence',   dec: 'Boston' },
    { s0: 2012600, s1: 2025600, route: 'I-95', kind: 'is', inc: 'New London',   dec: 'Boston' },
    { s0: 2025600, s1: 2043600, route: 'I-95', kind: 'is', inc: 'New Haven',    dec: 'Providence' },
  ],
  i287: [
    { s0: 0,      s1: 6000,   route: 'I-287', kind: 'is', inc: 'Metuchen',   dec: 'Perth Amboy' },
    { s0: 6000,   s1: 20000,  route: 'I-287', kind: 'is', inc: 'Morristown', dec: 'Edison' },
    { s0: 20000,  s1: 34000,  route: 'I-287', kind: 'is', inc: 'Morristown', dec: 'New Brunswick' },
    { s0: 34000,  s1: 52000,  route: 'I-287', kind: 'is', inc: 'Suffern NY', dec: 'Somerville' },
    { s0: 52000,  s1: 72000,  route: 'I-287', kind: 'is', inc: 'Suffern NY', dec: 'Morristown' },
    { s0: 72000,  s1: 90000,  route: 'I-287', kind: 'is', inc: 'Tappan Zee Br', dec: 'Suffern' },
    { s0: 90000,  s1: 98000,  route: 'I-87',  kind: 'is', inc: 'Westchester',   dec: 'Rockland' },
    { s0: 98000,  s1: 108000, route: 'I-87',  kind: 'is', inc: 'New York',      dec: 'Tappan Zee' },
    { s0: 108000, s1: 130000, route: 'I-87',  kind: 'is', inc: 'GW Bridge',     dec: 'Tappan Zee' },
    { s0: 130000, s1: 134000, route: 'I-95',  kind: 'is', inc: 'New Jersey',    dec: 'Manhattan' },
  ],
  bronxriver: [
    { s0: 0, s1: 20000, route: 'BRONX RIVER PKWY', kind: 'city', inc: 'The Bronx', dec: 'White Plains' },
    { s0: 20000, s1: 35000, route: 'BRONX RIVER PKWY', kind: 'city', inc: 'Bruckner Expwy', dec: 'White Plains' },
    { s0: 35000, s1: 39000, route: 'I-278', kind: 'is', inc: 'I-295 · Queens', dec: 'Manhattan' },
    { s0: 39000, s1: 44500, route: 'I-295', kind: 'is', inc: 'Throgs Neck Br', dec: 'New Haven' },
    { s0: 44500, s1: 50500, route: 'I-295', kind: 'is', inc: 'Hillside Ave', dec: 'Bronx' },
    { s0: 50500, s1: 53000, route: 'I-295', kind: 'is', inc: 'Hillside Ave', dec: 'Throgs Neck Br' },
  ],
  midwest: [
    { s0: 0,      s1: 17000,  route: 'I-294',    kind: 'is', inc: 'I-80 · Indiana', dec: 'Wisconsin' },
    { s0: 17000,  s1: 27000,  route: 'I-294',    kind: 'is', inc: 'I-80 East · Indiana', dec: 'I-57 · Chicago' },
    { s0: 27000,  s1: 38000,  route: 'I-80/294', kind: 'is', inc: 'Indiana · I-65', dec: 'Iowa · I-294 North' },
    { s0: 38000,  s1: 48000,  route: 'I-80/94',  kind: 'is', inc: 'Detroit · I-65', dec: 'Chicago' },
    { s0: 48000,  s1: 79000,  route: 'I-65',     kind: 'is', inc: 'Indianapolis', dec: 'Chicago' },
    { s0: 79000,  s1: 90000,  route: 'I-465',   kind: 'is', inc: 'I-74 East · Cincinnati', dec: 'I-865 · I-65 North' },
    { s0: 90000,  s1: 95000,  route: 'I-74',    kind: 'is', inc: 'Cincinnati', dec: 'I-465 · Indianapolis' },
    { s0: 95000,  s1: 125000, route: 'I-74',    kind: 'is', inc: 'Cincinnati',   dec: 'Indianapolis' },
    { s0: 125000, s1: 138000, route: 'I-74',    kind: 'is', inc: 'I-75 North · Dayton', dec: 'Indianapolis' },
    { s0: 138000, s1: 161000, route: 'I-75',    kind: 'is', inc: 'Dayton · Mason', dec: 'Cincinnati · I-74' },
    { s0: 161000, s1: 180000, route: 'I-75',    kind: 'is', inc: 'Mason',        dec: 'Cincinnati' },
  ],
  libertia: [
    { s0: 0, s1: 245000, route: 'LIBERTIA TPKE', kind: 'city', inc: 'Reston', dec: 'Missouri Line' },
    { s0: 245000, s1: 390000, route: 'LIBERTIA TPKE', kind: 'city', inc: 'Jacobs', dec: 'Reston' },
    { s0: 390000, s1: 630000, route: 'LIBERTIA TPKE', kind: 'city', inc: 'Jacobs', dec: 'Reston' },
    { s0: 630000, s1: 750000, route: 'LIBERTIA TPKE', kind: 'city', inc: 'Jacobs', dec: 'Reston' },
    { s0: 750000, s1: 805000, route: 'LIBERTIA TPKE', kind: 'city', inc: 'Jacobs Terminal', dec: 'Missouri Line' },
  ],
  bay: [
    { s0: 0,     s1: 20000, route: 'I-80',  kind: 'is', inc: 'Oakland',           dec: 'San Francisco' },
    { s0: 20000, s1: 33000, route: 'I-580', kind: 'is', inc: 'Hayward · Stockton', dec: 'Oakland' },
    { s0: 33000, s1: 41000, route: 'I-680', kind: 'is', inc: 'Walnut Creek',      dec: 'San Jose' },
    { s0: 41000, s1: 61000, route: 'I-680', kind: 'is', inc: 'Concord · Sacramento', dec: 'San Jose' },
    { s0: 61000, s1: 75000, route: 'I-80',  kind: 'is', inc: 'Richmond · SF',     dec: 'Sacramento' },
    { s0: 75000, s1: 88000, route: 'I-80',  kind: 'is', inc: 'Berkeley · Bay Br', dec: 'Vallejo' },
    { s0: 88000, s1: 98000, route: 'I-80',  kind: 'is', inc: 'Bay Bridge · SF',   dec: 'Sacramento' },
  ],
  // kind 'gsp' = the real Garden State Parkway trailblazer (green disc,
  // yellow ring, PARKWAY arced along the bottom) instead of a text plate
  gsp: [
    { s0: 0,      s1: 32000,  route: 'GSP', kind: 'gsp', inc: 'Atlantic City', dec: 'Cape May' },
    { s0: 32000,  s1: 66000,  route: 'GSP', kind: 'gsp', inc: 'Toms River',    dec: 'Cape May' },
    { s0: 66000,  s1: 112000, route: 'GSP', kind: 'gsp', inc: 'Toms River',    dec: 'Atlantic City' },
    { s0: 112000, s1: 158000, route: 'GSP', kind: 'gsp', inc: 'Asbury Park',   dec: 'Atlantic City' },
    { s0: 158000, s1: 188000, route: 'GSP', kind: 'gsp', inc: 'Driscoll Br',   dec: 'Toms River' },
    { s0: 188000, s1: 207000, route: 'GSP', kind: 'gsp', inc: 'Woodbridge',    dec: 'Asbury Park' },
    { s0: 207000, s1: 223000, route: 'GSP', kind: 'gsp', inc: 'Newark',        dec: 'Driscoll Br' },
    { s0: 223000, s1: 231000, route: 'GSP', kind: 'gsp', inc: 'Newark',        dec: 'Woodbridge' },
    { s0: 231000, s1: 253000, route: 'GSP', kind: 'gsp', inc: 'Paterson',      dec: 'Newark' },
    { s0: 253000, s1: 267000, route: 'GSP', kind: 'gsp', inc: 'Paramus',       dec: 'Paterson' },
    { s0: 267000, s1: 279000, route: 'GSP', kind: 'gsp', inc: 'NY Thruway',    dec: 'Paterson' },
  ],
  acx: [
    { s0: 0,     s1: 6500,  route: 'I-76',      kind: 'is',   inc: 'Walt Whitman Br', dec: 'Center City' },
    { s0: 6500,  s1: 13500, route: 'I-76',      kind: 'is',   inc: 'Atlantic City',   dec: 'Philadelphia' },
    { s0: 13500, s1: 24800, route: 'NJ-42',     kind: 'city', inc: 'Atlantic City',   dec: 'Philadelphia' },
    { s0: 24800, s1: 50550, route: 'ACE', kind: 'ace', inc: 'Atlantic City',  dec: 'Philadelphia' },
    { s0: 50550, s1: 86500, route: 'ACE', kind: 'ace', inc: 'Atlantic City',  dec: 'Hammonton · Phila' },
    { s0: 86500, s1: 96000, route: 'ACE', kind: 'ace', inc: 'Casinos · Beach', dec: 'Philadelphia' },
  ],
  i80: [
    { s0: 0,      s1: 24000,  route: 'I-80',    kind: 'is', inc: 'Stroudsburg', dec: 'Geo Wash Br' },
    { s0: 24000,  s1: 40000,  route: 'I-80',    kind: 'is', inc: 'Stroudsburg', dec: 'New York' },
    { s0: 40000,  s1: 112000, route: 'I-80',    kind: 'is', inc: 'Bloomsburg',  dec: 'New York' },
    { s0: 112000, s1: 146000, route: 'I-80',    kind: 'is', inc: 'Youngstown',  dec: 'Bloomsburg' },
    { s0: 146000, s1: 164000, route: 'I-80',    kind: 'is', inc: 'Cleveland',   dec: 'Youngstown' },
    { s0: 164000, s1: 204000, route: 'I-80/90', kind: 'is', tb: 'ohtp', inc: 'Toledo',      dec: 'Cleveland' },
    { s0: 204000, s1: 228000, route: 'I-80/90', kind: 'is', tb: 'intr', inc: 'Chicago',     dec: 'Toledo' },
    { s0: 228000, s1: 241000, route: 'I-80/94', kind: 'is', inc: 'Chicago',     dec: 'Cleveland' },
  ],
  newengland: [
    { s0: 0,      s1: 16000,  route: 'I-91', kind: 'is', inc: 'Hartford',       dec: 'New Haven' },
    { s0: 16000,  s1: 23000,  route: 'I-84', kind: 'is', inc: 'Boston',         dec: 'New Haven' },
    { s0: 23000,  s1: 34000,  route: 'I-84', kind: 'is', inc: 'Boston',         dec: 'New York' },
    { s0: 34000,  s1: 53000,  route: 'I-90', kind: 'is', tb: 'pike', inc: 'Boston',         dec: 'Albany' },
    { s0: 53000,  s1: 61000,  route: 'I-90', kind: 'is', tb: 'pike', inc: 'Logan Airport',  dec: 'Worcester' },
    { s0: 61000,  s1: 66000,  route: 'I-90', kind: 'is', tb: 'pike', inc: 'Logan Airport',  dec: 'Boston' },
  ],
  newdelhi: [
    { s0: 0,      s1: 15000, route: 'NH-48',     kind: 'nh',   inc: 'Delhi',        dec: 'Jaipur · Gurugram' },
    { s0: 15000,  s1: 19000, route: 'RING ROAD', kind: 'city', inc: 'India Gate',   dec: 'IGI Airport' },
    { s0: 19000,  s1: 30000, route: 'C-HEXAGON', kind: 'city', inc: 'ITO · Yamuna', dec: 'Dhaula Kuan' },
    { s0: 30000,  s1: 38000, route: 'VIKAS MARG', kind: 'city', inc: 'Noida',       dec: 'Connaught Place' },
    { s0: 38000,  s1: 46000, route: 'DND FLYWAY', kind: 'exp', inc: 'Noida',        dec: 'Delhi' },
    { s0: 46000,  s1: 56000, route: 'OUTER RING', kind: 'city', inc: 'Punjabi Bagh', dec: 'Ashram' },
    { s0: 56000,  s1: 92000, route: 'NH-10',     kind: 'nh',   inc: 'Rohtak',       dec: 'Delhi' },
  ],
  india: [
    { s0: 0,      s1: 32000,  route: 'NH-48',      kind: 'nh',  inc: 'Pune',      dec: 'Mumbai' },
    { s0: 32000,  s1: 87000,  route: 'EXPRESSWAY', kind: 'exp', inc: 'Pune',      dec: 'Mumbai' },
    { s0: 87000,  s1: 97000,  route: 'NH-48',      kind: 'nh',  inc: 'Pune City', dec: 'Mumbai' },
  ],
  aundh: [
    { s0: 0,      s1: 3600,   route: 'AUNDH GAON',   kind: 'city', inc: 'Parihar Chowk', dec: 'ITI Road' },
    { s0: 3600,   s1: 8200,   route: 'AUNDH-BANER',  kind: 'city', inc: 'Baner',         dec: 'Aundh Gaon' },
    { s0: 8200,   s1: 12000,  route: 'LINK ROAD',    kind: 'city', inc: 'Baner Gaon',    dec: 'Parihar Chowk' },
    { s0: 12000,  s1: 17500,  route: 'BANER ROAD',   kind: 'city', inc: 'Balewadi',      dec: 'Aundh' },
    { s0: 17500,  s1: 21000,  route: 'HIGH STREET',  kind: 'city', inc: 'Pashan · Sus',  dec: 'Baner' },
    { s0: 21000,  s1: 24800,  route: 'PASHAN-SUS RD', kind: 'city', inc: 'Pashan Gaon',  dec: 'Balewadi' },
    { s0: 24800,  s1: 28000,  route: 'ITI ROAD',     kind: 'city', inc: 'Aundh Gaon',    dec: 'Pashan' },
  ],
  andheri: [
    { s0: 0,      s1: 20800,  route: 'WEH',       kind: 'city', inc: 'Bandra',      dec: 'Borivali' },
    { s0: 20800,  s1: 24000,  route: 'CSMIA',     kind: 'city', inc: 'Terminals',   dec: 'Andheri' },
    { s0: 24000,  s1: 28000,  route: 'SV ROAD',   kind: 'city', inc: 'Worli',       dec: 'Andheri' },
    { s0: 28000,  s1: 33000,  route: 'SEA LINK',  kind: 'city', inc: 'Worli',       dec: 'Bandra' },
    { s0: 33000,  s1: 52000,  route: 'MARINE DR', kind: 'city', inc: 'Nariman Pt',  dec: 'Worli' },
  ],
  // kind 'ae' = Iberian blue motorway plate; 'de' = German blue Autobahn
  // hexagon. `e` adds the green European E-route plate under the shield.
  a1: [
    { s0: 0,      s1: 30000,  route: 'A1', kind: 'ae', e: 'E 1', inc: 'Vila Franca de Xira', dec: 'Lisboa' },
    { s0: 30000,  s1: 60000,  route: 'A1', kind: 'ae', e: 'E 1', inc: 'Santarém',        dec: 'Lisboa' },
    { s0: 60000,  s1: 90000,  route: 'A1', kind: 'ae', e: 'E 1', inc: 'Torres Novas · Fátima', dec: 'Santarém' },
    { s0: 90000,  s1: 120000, route: 'A1', kind: 'ae', e: 'E 1', inc: 'Leiria',          dec: 'Fátima' },
    { s0: 120000, s1: 150000, route: 'A1', kind: 'ae', e: 'E 1', inc: 'Pombal',          dec: 'Leiria' },
    { s0: 150000, s1: 178000, route: 'A1', kind: 'ae', e: 'E 1', inc: 'Coimbra',         dec: 'Pombal' },
    { s0: 178000, s1: 205000, route: 'A1', kind: 'ae', e: 'E 1', inc: 'Mealhada · Aveiro', dec: 'Coimbra' },
    { s0: 205000, s1: 235000, route: 'A1', kind: 'ae', e: 'E 1', inc: 'Aveiro',          dec: 'Coimbra' },
    { s0: 235000, s1: 262000, route: 'A1', kind: 'ae', e: 'E 1', inc: 'Feira · Gaia',    dec: 'Aveiro' },
    { s0: 262000, s1: 288000, route: 'A1', kind: 'ae', e: 'E 1', inc: 'Porto · V.N. Gaia', dec: 'Aveiro' },
    { s0: 288000, s1: 299000, route: 'A1', kind: 'ae', e: 'E 1', inc: 'Porto Centro',    dec: 'Gaia' },
  ],
  a4: [
    { s0: 0,      s1: 40000,  route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Getafe · Aranjuez', dec: 'Madrid' },
    { s0: 40000,  s1: 90000,  route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Ocaña · Aranjuez',  dec: 'Madrid' },
    { s0: 90000,  s1: 150000, route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Madridejos',        dec: 'Aranjuez' },
    { s0: 150000, s1: 210000, route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Valdepeñas',        dec: 'Madridejos' },
    { s0: 210000, s1: 270000, route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Bailén · Córdoba',  dec: 'Valdepeñas' },
    { s0: 270000, s1: 320000, route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Andújar',           dec: 'Bailén' },
    { s0: 320000, s1: 375000, route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Córdoba',           dec: 'Andújar' },
    { s0: 375000, s1: 425000, route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Écija',             dec: 'Córdoba' },
    { s0: 425000, s1: 480000, route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Carmona · Sevilla', dec: 'Écija' },
    { s0: 480000, s1: 529000, route: 'A-4', kind: 'ae', e: 'E-5', inc: 'Sevilla',           dec: 'Carmona' },
  ],
  a3: [
    { s0: 0,      s1: 24000,  route: 'A3', kind: 'de', e: 'E 35', inc: 'Wiesbaden · Idstein', dec: 'Frankfurt' },
    { s0: 24000,  s1: 50000,  route: 'A3', kind: 'de', e: 'E 35', inc: 'Limburg',        dec: 'Wiesbaden' },
    { s0: 50000,  s1: 80000,  route: 'A3', kind: 'de', e: 'E 35', inc: 'Montabaur',      dec: 'Limburg' },
    { s0: 80000,  s1: 112000, route: 'A3', kind: 'de', e: 'E 35', inc: 'Dernbach · Neuwied', dec: 'Montabaur' },
    { s0: 112000, s1: 134000, route: 'A3', kind: 'de', e: 'E 35', inc: 'Bonn · Siegburg', dec: 'Montabaur' },
    { s0: 134000, s1: 160000, route: 'A3', kind: 'de', e: 'E 35', inc: 'Köln · Bonn',    dec: 'Siegburg' },
    { s0: 160000, s1: 175000, route: 'A3', kind: 'de', e: 'E 35', inc: 'Köln Zentrum',   dec: 'Bonn' },
  ],
  // Britain signs no E-routes (and is not in the EU): plain blue M-shields
  m1: [
    { s0: 0,      s1: 30000,  route: 'M6',  kind: 'uk', inc: 'Coventry · London', dec: 'Birmingham' },
    { s0: 30000,  s1: 50000,  route: 'M6',  kind: 'uk', inc: 'Rugby · M1',    dec: 'Coventry' },
    { s0: 50000,  s1: 90000,  route: 'M1',  kind: 'uk', inc: 'Northampton',   dec: 'Leicester' },
    { s0: 90000,  s1: 120000, route: 'M1',  kind: 'uk', inc: 'Milton Keynes', dec: 'Northampton' },
    { s0: 120000, s1: 150000, route: 'M1',  kind: 'uk', inc: 'Luton · London', dec: 'Milton Keynes' },
    { s0: 150000, s1: 170000, route: 'M1',  kind: 'uk', inc: 'Watford · M25', dec: 'Luton' },
    { s0: 170000, s1: 195000, route: 'A406', kind: 'uk', inc: 'Central London', dec: 'The NORTH' },
    { s0: 195000, s1: 212000, route: 'A2',  kind: 'uk', inc: 'Canterbury',   dec: 'London' },
    { s0: 212000, s1: 260000, route: 'M20', kind: 'uk', inc: 'Maidstone',    dec: 'London' },
    { s0: 260000, s1: 305000, route: 'M20', kind: 'uk', inc: 'Folkestone · Ashford', dec: 'Maidstone' },
    { s0: 305000, s1: 320000, route: 'A20', kind: 'uk', inc: 'Dover · Port', dec: 'Folkestone' },
  ],
  a16: [
    { s0: 0,      s1: 25000,  route: 'A16', kind: 'fr', e: 'E 402', inc: 'Boulogne-sur-Mer', dec: 'Calais' },
    { s0: 25000,  s1: 55000,  route: 'A16', kind: 'fr', e: 'E 402', inc: 'Montreuil',    dec: 'Boulogne' },
    { s0: 55000,  s1: 90000,  route: 'A16', kind: 'fr', e: 'E 402', inc: 'Abbeville',    dec: 'Montreuil' },
    { s0: 90000,  s1: 125000, route: 'A16', kind: 'fr', e: 'E 402', inc: 'Amiens',       dec: 'Abbeville' },
    { s0: 125000, s1: 165000, route: 'A16', kind: 'fr', e: 'E 402', inc: 'Breteuil · Beauvais', dec: 'Amiens' },
    { s0: 165000, s1: 210000, route: 'A16', kind: 'fr', e: 'E 402', inc: 'Beauvais',     dec: 'Amiens' },
    { s0: 210000, s1: 245000, route: 'A16', kind: 'fr', e: 'E 402', inc: "L'Isle-Adam · Paris", dec: 'Beauvais' },
    { s0: 245000, s1: 275000, route: 'A16', kind: 'fr', e: 'E 402', inc: 'Saint-Denis',  dec: "L'Isle-Adam" },
    { s0: 275000, s1: 290000, route: 'A16', kind: 'fr', e: 'E 402', inc: 'Paris · Porte de la Chapelle', dec: 'Saint-Denis' },
  ],
  a1it: [
    { s0: 0,      s1: 20000,  route: 'A1', kind: 'it', e: 'E 45', inc: 'Valmontone',      dec: 'Roma' },
    { s0: 20000,  s1: 40000,  route: 'A1', kind: 'it', e: 'E 45', inc: 'Colleferro · Anagni', dec: 'Roma' },
    { s0: 40000,  s1: 62000,  route: 'A1', kind: 'it', e: 'E 45', inc: 'Frosinone',       dec: 'Anagni' },
    { s0: 62000,  s1: 90000,  route: 'A1', kind: 'it', e: 'E 45', inc: 'Ceprano',         dec: 'Frosinone' },
    { s0: 90000,  s1: 115000, route: 'A1', kind: 'it', e: 'E 45', inc: 'Cassino',         dec: 'Frosinone' },
    { s0: 115000, s1: 140000, route: 'A1', kind: 'it', e: 'E 45', inc: 'San Vittore',     dec: 'Cassino' },
    { s0: 140000, s1: 165000, route: 'A1', kind: 'it', e: 'E 45', inc: 'Caianello · Caserta', dec: 'Cassino' },
    { s0: 165000, s1: 190000, route: 'A1', kind: 'it', e: 'E 45', inc: 'Capua · Caserta', dec: 'Caianello' },
    { s0: 190000, s1: 210000, route: 'A1', kind: 'it', e: 'E 45', inc: 'Caserta · Napoli', dec: 'Capua' },
    { s0: 210000, s1: 225000, route: 'A1', kind: 'it', e: 'E 45', inc: 'Napoli Centro',   dec: 'Caserta' },
  ],
  swiss: [
    // Swiss motorways sign green like Italy. The route number changes with the
    // motorway (A8 over the Brünig, A14/A4 to Zürich, then the A1 across the
    // country, the A12 on the Fribourg branch), but they all carry the green
    // shield and the E-route below. Control cities in the language of the region.
    { s0: 0,      s1: 16000,  route: 'A8',  kind: 'it', e: 'E 62', inc: 'Interlaken · Brienz', dec: 'Thun' },
    { s0: 16000,  s1: 40000,  route: 'A8',  kind: 'it', e: 'E 62', inc: 'Brünig · Meiringen',  dec: 'Interlaken' },
    { s0: 40000,  s1: 60000,  route: 'A8',  kind: 'it', e: 'E 62', inc: 'Sarnen · Luzern',     dec: 'Brünig' },
    { s0: 60000,  s1: 95000,  route: 'A14', kind: 'it', e: 'E 41', inc: 'Luzern · Zug',        dec: 'Sarnen' },
    { s0: 95000,  s1: 120000, route: 'A14', kind: 'it', e: 'E 41', inc: 'Zug · Zürich',        dec: 'Luzern' },
    { s0: 120000, s1: 140000, route: 'A4',  kind: 'it', e: 'E 41', inc: 'Zürich',              dec: 'Zug' },
    { s0: 140000, s1: 162000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Zürich-Nord · Bern',  dec: 'Zürich-City' },
    { s0: 162000, s1: 188000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Baden · Aarau',       dec: 'Zürich' },
    { s0: 188000, s1: 210000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Aarau · Bern',        dec: 'Baden' },
    { s0: 210000, s1: 232000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Bern',                dec: 'Aarau' },
    { s0: 232000, s1: 252000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Bern · Lausanne',     dec: 'Bern-Wankdorf' },
    { s0: 252000, s1: 282000, route: 'A12', kind: 'it', e: 'E 27', inc: 'Fribourg · Lausanne', dec: 'Bern' },
    { s0: 282000, s1: 300000, route: 'A12', kind: 'it', e: 'E 27', inc: 'Bulle · Lausanne',    dec: 'Fribourg' },
    { s0: 300000, s1: 334000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Lausanne · Genève',   dec: 'Fribourg' },
    { s0: 334000, s1: 360000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Morges · Genève',     dec: 'Lausanne' },
    { s0: 360000, s1: 392000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Nyon · Genève',       dec: 'Morges' },
    { s0: 392000, s1: 410000, route: 'A1',  kind: 'it', e: 'E 25', inc: 'Genève · Aéroport',   dec: 'Lausanne' },
  ],
}[MAP] || [];

// Milepost positions of the marquee control cities on each US map, sorted by s.
// Drives the mileage now shown on the overhead guide signs and the big
// white-on-green roadside DISTANCE signs (the "Trenton 6 / Philadelphia 35 /
// Baltimore 120" boards that are pure American interstate). 1 s-unit ≈ 1 metre,
// so miles = Δs / 1609, matching the existing I-80 destination guides.
const MILEPOSTS = {
  i95: [[3000, 'New Haven'], [10000, 'Bridgeport'], [20000, 'Norwalk'], [28000, 'Stamford'],
    [40000, 'New York'], [45000, 'Geo Wash Br'], [51000, 'Newark'], [63000, 'Woodbridge'],
    [68000, 'New Brunswick'], [74000, 'Trenton'], [82000, 'Philadelphia'],
    // DE → FL true-scale control cities at their real downtown s
    [120800, 'Wilmington'], [225400, 'Baltimore'], [294600, 'Washington'],
    [393900, 'Fredericksburg'], [477600, 'Richmond'], [514600, 'Petersburg'],
    [666500, 'Rocky Mount'], [810000, 'Fayetteville'], [955800, 'Florence'],
    [1229400, 'Savannah'], [1460000, 'Jacksonville'], [1591700, 'Daytona Beach'],
    [1714000, 'Melbourne'], [1889300, 'West Palm Beach'], [1960000, 'Fort Lauderdale'],
    [2000000, 'Miami'],
    // NE loop-back (Boston / Providence / New London), shifted +1907600
    [2007600, 'Boston'], [2015600, 'Providence'], [2028600, 'New London']],
  i287: [[3000, 'Perth Amboy'], [6000, 'Metuchen'], [13000, 'Edison'], [24000, 'Somerville'],
    [43000, 'Morristown'], [77000, 'Suffern'], [77000, 'Suffern NY'], [85000, 'Rockland'],
    [90000, 'Tappan Zee Br'], [90000, 'Tappan Zee'], [103000, 'Westchester'], [114000, 'Yonkers'],
    [125000, 'New York'], [126000, 'Manhattan'], [132000, 'GW Bridge'], [133000, 'New Jersey']],
  midwest: [[2600, 'I-294 / Mile Long Br'], [13600, 'Markham Toll Plaza'], [24000, 'I-80 / Southland'], [34000, 'Hammond'], [49000, 'Gary / I-65'],
    [70000, 'Lafayette'], [83000, 'Indianapolis Bypass'], [92500, 'I-74 East'], [108000, 'Greensburg'], [136000, 'I-74 / I-75'],
    [158830, 'Sharonville'], [176500, 'Mason']],
  i80: [[0, 'New York'], [1000, 'Geo Wash Br'], [8000, 'Paterson'], [18000, 'Parsippany'],
    [47000, 'Stroudsburg'], [104000, 'Bloomsburg'], [140000, 'Brookville'], [155000, 'Youngstown'],
    [173000, 'Cleveland'], [192000, 'Toledo'], [232000, 'Gary'], [241000, 'Chicago']],
  newengland: [[0, 'New York'], [2000, 'New Haven'], [13000, 'Hartford'], [26000, 'Manchester'],
    [38000, 'Sturbridge'], [44000, 'Worcester'], [57000, 'Boston'], [63000, 'Logan Airport']],
  gsp: [[1000, 'Cape May'], [12000, 'Wildwood'], [48000, 'Somers Point'], [61000, 'Atlantic City'],
    [80500, 'New Gretna'], [132000, 'Toms River'], [166000, 'Asbury Park'], [175000, 'Red Bank'],
    [204000, 'Driscoll Br'], [209000, 'Woodbridge'], [233000, 'Newark'], [257000, 'Paterson'],
    [264000, 'Paramus'], [277000, 'New York']],
  bay: [[3000, 'San Francisco'], [16000, 'Oakland'], [36000, 'Dublin'], [52000, 'Walnut Creek'],
    [58000, 'Concord'], [71000, 'Vallejo'], [78000, 'Richmond'], [85000, 'Berkeley']],
  acx: [[500, 'Philadelphia'], [8000, 'Walt Whitman Br'], [14000, 'Bellmawr'], [24800, 'Turnersville'],
    [50500, 'Hammonton'], [68000, 'Egg Harbor'], [84300, 'Garden State Pkwy'], [95000, 'Atlantic City']],
}[MAP] || [];

// Miles from sign position s to the named control city (null if that city has
// no milepost). Not for Europe/India — those sign in km via other systems.
function milesTo(name, s) {
  if (EURO || UK) return null;
  const e = MILEPOSTS.find(([, n]) => n === name);
  if (!e) return null;
  return Math.max(1, Math.round(Math.abs(e[0] - s) / 1609));
}

function canvasTex(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// The classic US interstate shield silhouette.
function shieldPath(g) {
  g.beginPath();
  g.moveTo(128, 12);
  g.lineTo(210, 40);
  g.quadraticCurveTo(244, 52, 244, 98);
  g.quadraticCurveTo(244, 172, 128, 244);
  g.quadraticCurveTo(12, 172, 12, 98);
  g.quadraticCurveTo(12, 52, 46, 40);
  g.closePath();
}

const markerCache = new Map();
// Returns { map, emissiveMap } texture for a shield/plate face.
function faceTex(route, kind) {
  const key = kind + '|' + route;
  if (markerCache.has(key)) return markerCache.get(key);
  let tex;
  if (kind === 'is') {
    const c = canvasTex(256, 256);
    const g = c.getContext('2d');
    // white border shield
    shieldPath(g); g.fillStyle = '#f4f4f2'; g.fill();
    // blue body inset
    g.save();
    g.translate(128, 128); g.scale(0.88, 0.88); g.translate(-128, -128);
    shieldPath(g); g.fillStyle = '#0a2b6b'; g.fill();
    // red top banner, clipped to the shield body
    g.save(); shieldPath(g); g.clip();
    g.fillStyle = '#b3202c'; g.fillRect(0, 0, 256, 96);
    g.restore();
    g.restore();
    // "INTERSTATE" and the route number
    g.textAlign = 'center'; g.fillStyle = '#ffffff';
    g.font = 'bold 30px "Helvetica Neue", Arial, sans-serif';
    g.fillText('INTERSTATE', 128, 74);
    const num = route.replace(/^I-?/, '');
    g.font = `bold ${num.length > 3 ? 74 : 96}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(num, 128, 196);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'ae') {
    // Iberian motorway marker: blue plate, white border, white route number
    // (Portugal "A1", Spain "A-4")
    const c = canvasTex(256, 200);
    const g = c.getContext('2d');
    g.fillStyle = '#0d4f9e'; g.fillRect(0, 0, 256, 200);
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(12, 12, 232, 176);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = `bold ${route.length > 2 ? 88 : 104}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(route, 128, 136);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'de') {
    // German Autobahn route sign (Zeichen 405): blue horizontal hexagon,
    // white border and number
    const c = canvasTex(256, 160);
    const g = c.getContext('2d');
    const hex = inset => {
      g.beginPath();
      g.moveTo(8 + inset * 1.4, 80);
      g.lineTo(46 + inset, 12 + inset);
      g.lineTo(210 - inset, 12 + inset);
      g.lineTo(248 - inset * 1.4, 80);
      g.lineTo(210 - inset, 148 - inset);
      g.lineTo(46 + inset, 148 - inset);
      g.closePath();
    };
    hex(0); g.fillStyle = '#ffffff'; g.fill();
    hex(8); g.fillStyle = '#0d4f9e'; g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = 'bold 84px "Helvetica Neue", Arial, sans-serif';
    g.fillText(route, 128, 110);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'uk') {
    // British route marker: white route number straight onto motorway blue
    // (green-backed A-roads get the same plate shape)
    const c = canvasTex(256, 160);
    const g = c.getContext('2d');
    g.fillStyle = route.startsWith('M') ? '#0d4f9e' : '#0b5c37';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = route.startsWith('M') ? '#ffffff' : '#f2d12e';
    g.textAlign = 'center';
    g.font = `bold ${route.length > 3 ? 76 : 96}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(route, 128, 112);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'fr') {
    // French autoroute marker: white number on the red cartouche
    const c = canvasTex(256, 160);
    const g = c.getContext('2d');
    g.fillStyle = '#c8102e'; g.fillRect(0, 0, 256, 160);
    g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(10, 10, 236, 140);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = 'bold 88px "Helvetica Neue", Arial, sans-serif';
    g.fillText(route, 128, 112);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'it') {
    // Italian autostrada marker: white A-number on GREEN (Italy inverts the
    // European colour convention — green motorways, blue ordinary roads)
    const c = canvasTex(256, 200);
    const g = c.getContext('2d');
    g.fillStyle = '#0b7d3e'; g.fillRect(0, 0, 256, 200);
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(12, 12, 232, 176);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = 'bold 104px "Helvetica Neue", Arial, sans-serif';
    g.fillText(route, 128, 136);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'gsp') {
    // The real Garden State Parkway trailblazer: dark-green disc, yellow ring,
    // GARDEN STATE across the middle, PARKWAY arced along the bottom
    const c = canvasTex(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#0b5c37';
    g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f7c942'; g.lineWidth = 9;
    g.beginPath(); g.arc(128, 128, 113, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#f7c942'; g.textAlign = 'center';
    g.font = 'bold 40px "Helvetica Neue", Arial, sans-serif';
    g.fillText('GARDEN', 128, 102);
    g.fillText('STATE', 128, 146);
    g.font = 'bold 27px "Helvetica Neue", Arial, sans-serif';
    const word = 'PARKWAY', arc = Math.PI * 0.62;
    for (let i = 0; i < word.length; i++) {
      // bottom of the disc is a = PI/2 in canvas coords; larger a = further left
      const a = Math.PI / 2 + arc * (0.5 - i / (word.length - 1));
      g.save();
      g.translate(128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86);
      g.rotate(a - Math.PI / 2);
      g.fillText(word[i], 0, 9);
      g.restore();
    }
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'pike') {
    // Mass Pike trailblazer: green square, the white pilgrim hat, MASS PIKE
    const c = canvasTex(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#046a38'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(10, 10, 236, 236);
    g.fillStyle = '#ffffff';
    // crown, flaring down to the band, then the wide brim
    g.beginPath();
    g.moveTo(94, 52); g.lineTo(162, 52);
    g.lineTo(176, 124); g.lineTo(80, 124);
    g.closePath(); g.fill();
    g.beginPath(); g.ellipse(128, 128, 78, 15, 0, 0, Math.PI * 2); g.fill();
    // hat band in the field green, white buckle on it
    g.fillStyle = '#046a38'; g.fillRect(79, 104, 98, 15);
    g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(117, 101, 22, 21);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = 'bold 38px "Helvetica Neue", Arial, sans-serif';
    g.fillText('MASS PIKE', 128, 208);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'njtp') {
    // New Jersey Turnpike trailblazer: green lettering on the white shield
    const c = canvasTex(256, 256);
    const g = c.getContext('2d');
    shieldPath(g); g.fillStyle = '#f4f4f2'; g.fill();
    g.save();
    g.translate(128, 128); g.scale(0.9, 0.9); g.translate(-128, -128);
    shieldPath(g); g.strokeStyle = '#0b5c37'; g.lineWidth = 7; g.stroke();
    g.restore();
    g.fillStyle = '#0b5c37'; g.textAlign = 'center';
    g.font = 'bold 34px "Helvetica Neue", Arial, sans-serif';
    g.fillText('NEW', 128, 86);
    g.fillText('JERSEY', 128, 126);
    g.font = 'bold 29px "Helvetica Neue", Arial, sans-serif';
    g.fillText('TURNPIKE', 128, 168);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'ohtp') {
    // Ohio Turnpike trailblazer: green disc, white ring, stacked name
    const c = canvasTex(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#046a38';
    g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 8;
    g.beginPath(); g.arc(128, 128, 113, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = 'bold 54px "Helvetica Neue", Arial, sans-serif';
    g.fillText('OHIO', 128, 120);
    g.font = 'bold 33px "Helvetica Neue", Arial, sans-serif';
    g.fillText('TURNPIKE', 128, 164);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'intr') {
    // Indiana Toll Road: green plate, white border and name (drawn centered on
    // a square canvas so it shares the square co-brand board)
    const c = canvasTex(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#046a38'; g.fillRect(0, 48, 256, 160);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(10, 58, 236, 140);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = 'bold 44px "Helvetica Neue", Arial, sans-serif';
    g.fillText('INDIANA', 128, 122);
    g.font = 'bold 36px "Helvetica Neue", Arial, sans-serif';
    g.fillText('TOLL ROAD', 128, 172);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'ace') {
    // Atlantic City Expressway trailblazer: white disc, green ring & lettering
    const c = canvasTex(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#f4f4f2';
    g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#0b5c37'; g.lineWidth = 9;
    g.beginPath(); g.arc(128, 128, 113, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#0b5c37'; g.textAlign = 'center';
    g.font = 'bold 24px "Helvetica Neue", Arial, sans-serif';
    g.fillText('ATLANTIC CITY', 128, 96);
    g.font = 'bold 66px "Helvetica Neue", Arial, sans-serif';
    g.fillText('A.C.', 128, 152);
    g.font = 'bold 25px "Helvetica Neue", Arial, sans-serif';
    g.fillText('EXPRESSWAY', 128, 190);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'skyway') {
    // Chicago Skyway: blue plate, white skyline silhouette, name below
    const c = canvasTex(256, 256);
    const g = c.getContext('2d');
    g.fillStyle = '#0d4f9e'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(10, 10, 236, 236);
    g.fillStyle = '#ffffff';
    for (const [x, w, h] of [[36, 20, 50], [62, 18, 70], [86, 26, 42], [118, 20, 84], [144, 24, 56], [174, 18, 72], [198, 22, 40]])
      g.fillRect(x, 140 - h, w, h);
    g.textAlign = 'center';
    g.font = 'bold 40px "Helvetica Neue", Arial, sans-serif';
    g.fillText('CHICAGO', 128, 188);
    g.fillText('SKYWAY', 128, 230);
    tex = new THREE.CanvasTexture(c);
  } else if (kind === 'e') {
    // European E-route plate: green, white border and number
    const c = canvasTex(256, 128);
    const g = c.getContext('2d');
    g.fillStyle = '#0d6b3f'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(8, 8, 240, 112);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    g.font = 'bold 72px "Helvetica Neue", Arial, sans-serif';
    g.fillText(route, 128, 92);
    tex = new THREE.CanvasTexture(c);
  } else {
    // colored named plate (NH / expressway / city road)
    const bg = kind === 'exp' ? '#0d6b3f' : kind === 'nh' ? '#0d6b3f' : '#12356f';
    const c = canvasTex(512, 256);
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(14, 14, 484, 228);
    g.fillStyle = '#ffffff'; g.textAlign = 'center';
    if (kind === 'nh') {
      g.font = 'bold 44px "Helvetica Neue", Arial, sans-serif';
      g.fillText('राष्ट्रीय राजमार्ग', 256, 92);
      g.font = 'bold 108px "Helvetica Neue", Arial, sans-serif';
      g.fillText(route, 256, 200);
    } else {
      const sz = route.length > 8 ? 74 : 104;
      g.font = `bold ${sz}px "Helvetica Neue", Arial, sans-serif`;
      g.fillText(route, 256, 168);
    }
    tex = new THREE.CanvasTexture(c);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  markerCache.set(key, tex);
  return tex;
}

const plateCache = new Map();
function controlTex(cardinal, city) {
  const key = cardinal + '|' + city;
  if (plateCache.has(key)) return plateCache.get(key);
  const c = canvasTex(512, 200);
  const g = c.getContext('2d');
  g.fillStyle = (MAP === 'a1it' || MAP === 'swiss') ? '#0b7d3e' : EURO ? '#0d4f9e' : '#046a38'; g.fillRect(0, 0, 512, 200);
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 180);
  g.fillStyle = '#ffffff'; g.textAlign = 'center';
  if (cardinal) {
    g.font = 'bold 46px "Helvetica Neue", Arial, sans-serif';
    g.fillText(cardinal + '  ▼', 256, 66);
    const sz = city.length > 11 ? 60 : 78;
    g.font = `bold ${sz}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(city, 256, 150);
  } else {
    // no cardinal (Spain / Germany): the control city carries the sign
    const sz = city.length > 11 ? 66 : 86;
    g.font = `bold ${sz}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(city, 256, 122);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  plateCache.set(key, tex);
  return tex;
}

// alpha=true for silhouette faces (shields, discs) drawn on a transparent
// canvas, so the corners of the plane don't render as a dark square
function litBoard(geo, tex, alpha = false) {
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06,
    roughness: 0.6, side: THREE.DoubleSide,
    ...(alpha ? { transparent: true, alphaTest: 0.35 } : {}),
  }));
}

// Posted speed limit by zone. US maps are mph (rectangular black-on-white
// regulatory signs); India/Andheri are km/h (round red-ring signs).
// UK speed signs use the same red-ring disc — with mph numbers on them
const METRIC = MAP === 'india' || MAP === 'andheri' || MAP === 'aundh' || MAP === 'newdelhi' || EURO || UK;
const SPEED_LIMITS = {
  // i95
  newhaven: 55, corridor: 65, westchester: 55, bronx: 50, suburb: 65, njsouth: 65, philly: 55, pa: 65,
  boston95: 55, providence: 55, ctshore: 65,
  // i287
  perthamboy: 55, piscataway: 65, bridgewater: 65, morristown: 65, ramapo: 65,
  rockland: 65, tappanzee: 55, westch: 60, yonkers: 50, nybronx: 50, gwb287: 45,
  gsp_i95: 55, gsp_rahway: 65, gsp_union: 55, gsp_essex: 55, gsp_clifton: 65,
  gsp_paterson: 55, gsp_north: 65, gsp_ny: 65,
  gsp_capemay: 65, gsp_seashore: 65, gsp_atlantic: 65, gsp_pines: 65,
  gsp_ocean: 65, gsp_lakewood: 65, gsp_monmouth: 65, gsp_raritan: 55,
  philly76: 55, wwb: 45, gloucester: 55, nj42: 55,
  acx_west: 65, acx_pines: 65, acx_egg: 65, acx_ac: 55,
  sf: 50, baybridge: 50, oakland: 55, i580: 65, dublin: 65, i680: 65,
  vallejo: 65, richmond: 60, eastbay: 55,
  // midwest
  ord: 45, i90ken: 55, chidt: 45, danryan: 45, skyway: 45, i294: 55, southland: 55, borman: 55, i80: 55, gary: 55,
  i65: 70, indy: 55, i74: 65, hills: 60, cincy: 55, downtown: 45,
  millcreek: 55, sharonville: 65, wchester75: 70, middletown: 70,
  franklin75: 70, moraine: 65, dayton: 55,
  // New England branch
  i91: 65, hartford: 55, i84: 65, masspike: 65, boston: 45, logan: 45,
  // I-80
  fortlee: 50, njsub80: 65, njgap: 65, poconos: 70, paridge: 70, paplat: 70,
  ohio80: 65, cleveland: 60, toledo: 65, inturnpike: 70, chi80: 55,
  // india (km/h)
  mumbai: 80, chembur: 40, puneX: 100, pcmc: 60, pune: 50,
  // Delhi NCR (km/h): wide and posted fast, crawling anyway
  d_gurgaon: 60, d_nh48: 70, d_igi: 60, d_dhaula: 50, d_lutyens: 50, d_cp: 40,
  d_ito: 40, d_yamuna: 60, d_noida: 70, d_ring: 60, d_pbagh: 50, d_bgarh: 70,
  d_sampla: 80, d_rohtak: 40,
  // andheri (km/h)
  andheriW: 40, airport: 40, bandra: 50, sealink: 60, marine: 50,
  // aundh–baner (km/h): PMC posts 30 through the gaons, 50 on Baner Rd
  p_gaon: 30, p_aundh: 40, p_link: 40, p_baner: 50, p_bale: 40, p_pashan: 40, p_iti: 30,
  // Portugal A1 (km/h): 120 on the open autoestrada
  pt_lisboa: 100, pt_vfx: 120, pt_ribatejo: 120, pt_santarem: 120, pt_fatima: 120,
  pt_leiria: 120, pt_pombal: 120, pt_coimbra: 120, pt_bairrada: 120, pt_aveiro: 120,
  pt_gaia: 100, pt_porto: 90,
  // Spain A-4 (km/h): 120 autovía, slower through the gorge and the cities
  es_madrid: 90, es_sur: 100, es_aranjuez: 120, es_ocana: 120, es_mancha: 120,
  es_valdepenas: 120, es_despena: 100, es_bailen: 120, es_andujar: 120,
  es_cordoba: 120, es_ecija: 120, es_carmona: 120, es_sevilla: 90,
  // Germany A3 (km/h): UNLIMITED (sentinel 999 → derestriction sign) on the
  // open Autobahn, posted limits around the Kreuze, cities and the viaducts
  de_ffm: 100, de_wiesbaden: 120, de_taunus: 999, de_limburg: 130, de_montabaur: 999,
  de_westerwald: 999, de_siebengebirge: 130, de_bonn: 120, de_lohmar: 999, de_koeln: 100,
  // Britain (mph! — the national 70 on motorways, slower through London)
  uk_bham: 50, uk_m6: 70, uk_m1n: 70, uk_mk: 70, uk_luton: 70, uk_nlondon: 50,
  uk_london: 40, uk_slondon: 50, uk_m20w: 70, uk_kent: 70, uk_ashford: 70, uk_dover: 50,
  // France A16 (km/h): 130 autoroute, 110 approaching Paris
  fr_calais: 110, fr_boulogne: 130, fr_opale: 130, fr_somme: 130, fr_amiens: 130,
  fr_picardie: 130, fr_beauvais: 130, fr_oise: 110, fr_stdenis: 90, fr_paris: 70,
  // Italy A1 (km/h): 130 autostrada, slower through the city ends
  it_roma: 100, it_castelli: 130, it_colleferro: 130, it_frosinone: 130, it_ceprano: 130,
  it_cassino: 130, it_sanvittore: 110, it_caianello: 130, it_caserta: 130, it_napoli: 80,
};

const limitCache = new Map();
function limitTex(limit) {
  if (limitCache.has(limit)) return limitCache.get(limit);
  const c = canvasTex(256, 256);
  const g = c.getContext('2d');
  if (limit === 999) {
    // German derestriction sign (Zeichen 282): white disc, five black diagonals
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#9aa0a6'; g.lineWidth = 6;
    g.beginPath(); g.arc(128, 128, 117, 0, Math.PI * 2); g.stroke();
    g.save();
    g.beginPath(); g.arc(128, 128, 114, 0, Math.PI * 2); g.clip();
    g.strokeStyle = '#111111'; g.lineWidth = 14;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(-40 + i * 46 + 170, -60);
      g.lineTo(-40 + i * 46 - 60, 320);
      g.stroke();
    }
    g.restore();
  } else if (METRIC) {
    // round white sign, thick red ring, black number (European/Indian style)
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c8102e'; g.lineWidth = 34;
    g.beginPath(); g.arc(128, 128, 100, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#111111'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 132px "Helvetica Neue", Arial, sans-serif';
    g.fillText(String(limit), 128, 132);
  } else {
    // white rectangle, black border, "SPEED / LIMIT / NN" (US MUTCD R2-1)
    g.fillStyle = '#ffffff'; g.fillRect(20, 8, 216, 240);
    g.strokeStyle = '#111111'; g.lineWidth = 8; g.strokeRect(28, 16, 200, 224);
    g.fillStyle = '#111111'; g.textAlign = 'center';
    g.font = 'bold 40px "Helvetica Neue", Arial, sans-serif';
    g.fillText('SPEED', 128, 74);
    g.fillText('LIMIT', 128, 120);
    g.font = 'bold 108px "Helvetica Neue", Arial, sans-serif';
    g.fillText(String(limit), 128, 214);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  limitCache.set(limit, tex);
  return tex;
}

// Roadside speed-limit signs on BOTH shoulders, ~1.6 km apart, each facing its
// own direction of travel — the way a real highway is posted both ways.
function buildSpeedLimits(scene, registry) {
  const STEP = 1600;
  const geo = new THREE.PlaneGeometry(METRIC ? 2.6 : 2.4, METRIC ? 2.6 : 2.8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.6, metalness: 0.4 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 4.8, 8);
  poleGeo.translate(0, 2.4, 0);
  for (let s = 1000; s < LOOP_LENGTH; s += STEP) {
    const limit = SPEED_LIMITS[zoneAt(s).key];
    if (!limit) continue;
    for (const side of [-1, 1]) {
      const lat = side * (roadClearAt(s) + 4.2);
      const group = new THREE.Group();
      group.add(new THREE.Mesh(poleGeo, poleMat));
      const board = litBoard(geo, limitTex(limit));
      board.position.y = 4.4;
      group.add(board);
      registry.signs.push({ userData: { board } });
      group.position.copy(posAt(s, lat, new THREE.Vector3()));
      group.position.y = groundY(s, lat);
      // each faces oncoming traffic on its own side
      group.rotation.y = headingAt(s) + (side < 0 ? Math.PI : 0);
      scene.add(group);
    }
  }
}

// A few work zones per map — orange barrels along the shoulder and a diamond
// ROAD WORK warning ahead. Kept off the travel lanes so nothing blocks the road.
const WORK_ZONES = {
  i95:     [{ s: 12000 }, { s: 64000 }, { s: 84000 }, { s: 100000 }, { s: 112000 }, { s: 127000 }],
  i287:    [{ s: 16000 }, { s: 46000 }, { s: 82000 }, { s: 114000 }],
  newengland: [{ s: 12000 }, { s: 30000 }, { s: 46000 }],
  gsp: [{ s: 58000 }, { s: 130000 }, { s: 172000 }, { s: 237000 }, { s: 257000 }],
  acx: [{ s: 20000 }, { s: 56000 }],
  bay: [{ s: 24000 }, { s: 54000 }, { s: 80000 }],
  i80: [{ s: 30000 }, { s: 78000 }, { s: 120000 }, { s: 176000 }, { s: 216000 }],
  midwest: [{ s: 58000 }, { s: 104000 }, { s: 129000 }, { s: 168000 }, { s: 198000 }],  // I-75: always under construction
  india:   [{ s: 25000 }, { s: 64000 }],
  andheri: [{ s: 14000 }],
  aundh:   [{ s: 9000 }, { s: 22500 }],   // PMC digs up something somewhere, always
  a1: [{ s: 52000 }, { s: 165000 }, { s: 255000 }],
  a4: [{ s: 92000 }, { s: 310000 }, { s: 460000 }],
  a3: [{ s: 38000 }, { s: 95000 }, { s: 151000 }],   // the eternal A3 Baustelle
  m1: [{ s: 68000 }, { s: 118000 }, { s: 232000 }, { s: 278000 }],  // smart-motorway works forever
  a16: [{ s: 70000 }, { s: 180000 }],
  a1it: [{ s: 48000 }, { s: 128000 }, { s: 188000 }],
  swiss: [{ s: 50000 }, { s: 172000 }, { s: 258000 }, { s: 356000 }],
}[MAP] || [];

let workSignTex = null;
function workTex() {
  if (workSignTex) return workSignTex;
  const c = canvasTex(256, 256);
  const g = c.getContext('2d');
  g.translate(128, 128); g.rotate(Math.PI / 4);
  g.fillStyle = '#ff8a00'; g.fillRect(-116, -116, 232, 232);
  g.strokeStyle = '#111111'; g.lineWidth = 8; g.strokeRect(-112, -112, 224, 224);
  g.rotate(-Math.PI / 4);
  g.fillStyle = '#111111'; g.textAlign = 'center'; g.font = 'bold 40px "Helvetica Neue", Arial, sans-serif';
  g.fillText('ROAD', 0, -34); g.fillText('WORK', 0, 12); g.fillText('AHEAD', 0, 58);
  workSignTex = new THREE.CanvasTexture(c);
  workSignTex.colorSpace = THREE.SRGBColorSpace;
  return workSignTex;
}

function buildWorkZones(scene, registry) {
  const side = DIR > 0 ? -1 : 1;
  const barrelMatO = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 });
  const barrelMatW = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
  const barrelGeo = new THREE.CylinderGeometry(0.28, 0.32, 1.05, 10);
  const stripeGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.26, 10);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.6, metalness: 0.4 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 4.2, 8);
  poleGeo.translate(0, 2.1, 0);
  const signGeo = new THREE.PlaneGeometry(2.6, 2.6);
  for (const wz of WORK_ZONES) {
    // warning sign ~180 m upstream in the direction of travel
    const warnS = wz.s - DIR * 180;
    const warnLat = side * (roadClearAt(warnS) + 4.0);
    const wg = new THREE.Group();
    wg.add(new THREE.Mesh(poleGeo, poleMat));
    const wb = litBoard(signGeo, workTex()); wb.position.y = 4.0; wg.add(wb);
    registry.signs.push({ userData: { board: wb } });
    wg.position.copy(posAt(warnS, warnLat, new THREE.Vector3()));
    wg.position.y = groundY(warnS, warnLat);
    wg.rotation.y = headingAt(warnS) + (side < 0 ? Math.PI : 0);
    scene.add(wg);
    // a line of barrels just outside the paved edge on the work-zone shoulder
    for (let i = 0; i < 12; i++) {
      const bs = wz.s + i * 22;
      const blat = side * (roadClearAt(bs) + 1.2);
      const barrel = new THREE.Mesh(barrelGeo, barrelMatO);
      const st1 = new THREE.Mesh(stripeGeo, barrelMatW); st1.position.y = 0.28;
      const st2 = new THREE.Mesh(stripeGeo, barrelMatW); st2.position.y = -0.14;
      barrel.add(st1, st2);
      barrel.position.copy(posAt(bs, blat, new THREE.Vector3()));
      barrel.position.y = groundY(bs, blat) + 0.52;
      scene.add(barrel);
    }
  }
}

// Big green mileage guide signs for a marquee destination, ramping from sparse
// far out to frequent near the city — I-80 East is signed for NEW YORK / the
// George Washington Bridge from a hundred-plus miles out (western PA, eastern
// OH), long before you're close. targetS = where the destination sits; sd/card
// pick the shoulder & bound that faces traffic heading toward it.
const DEST_GUIDES = {
  // NYC is at the GWB (s = 0); EAST-bound = decreasing s = toward New York.
  i80: { targetS: 0, sd: 1, name: 'NEW YORK', near: 'GEO WASH BR', bg: '#046a38' },
  // the classic ACX countdown: ATLANTIC CITY ## MILES all the way from Philly
  acx: { targetS: 95400, sd: -1, name: 'ATLANTIC CITY', near: 'CASINOS · BOARDWALK', bg: '#046a38' },
  // European runs count down to the far terminus in kilometres, blue boards
  a1: { targetS: 296000, sd: -1, name: 'PORTO', near: 'PONTE DA ARRÁBIDA', bg: '#0d4f9e', km: true },
  a4: { targetS: 527000, sd: -1, name: 'SEVILLA', near: 'CENTRO · SE-30', bg: '#0d4f9e', km: true },
  a3: { targetS: 172000, sd: -1, name: 'KÖLN', near: 'ZENTRUM · DOM', bg: '#0d4f9e', km: true },
  m1: { targetS: 317000, sd: -1, name: 'DOVER', near: 'PORT · A20', bg: '#0d4f9e' },       // miles
  a16: { targetS: 288000, sd: -1, name: 'PARIS', near: 'PORTE DE LA CHAPELLE', bg: '#0d4f9e', km: true },
  a1it: { targetS: 221000, sd: -1, name: 'NAPOLI', near: 'CENTRO · PORTO', bg: '#0b7d3e', km: true },
  swiss: { targetS: 404000, sd: -1, name: 'GENÈVE', near: 'CENTRE · AÉROPORT', bg: '#0b7d3e', km: true },
}[MAP];

function buildDestinationGuides(scene, registry) {
  const d = DEST_GUIDES;
  if (!d) return;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.6, metalness: 0.4 });
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 8.6, 8);
  poleGeo.translate(0, 4.3, 0);
  // Walk from the far end toward the destination; spacing shrinks as we close in
  // (a sign every ~13 mi out in the country, tightening to ~2 mi near the city).
  for (let s = (d.km || UK) ? d.targetS - 2500 : LOOP_LENGTH - 1500; s > 1200; ) {
    const distM = Math.abs(s - d.targetS);
    const units = Math.max(0, Math.round(distM / (d.km ? 1000 : 1609)));
    const lines = units <= 1 ? [d.name, d.near] : [d.name, `${units} km`];
    if (!d.km) { lines[1] = units <= 1 ? d.near : `${units} MILES`; }
    const board = textBoard(lines, 9.4, 4.6, d.bg, '#ffffff');
    board.position.y = 8.4;
    const g = new THREE.Group();
    for (const px of [-3.7, 3.7]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(px, 0, 0);
      g.add(pole);
    }
    g.add(board);
    registry.signs.push({ userData: { board } });
    const lat = d.sd * (roadClearAt(s) + 6.5);
    g.position.copy(posAt(s, lat, new THREE.Vector3()));
    g.position.y = groundY(s, lat);
    g.rotation.y = headingAt(s) + (d.sd < 0 ? Math.PI : 0);  // faces destination-bound traffic
    scene.add(g);
    s -= Math.max(3200, distM * 0.14);
  }
}

// American roadside DISTANCE sign: white-on-green with a rounded border, the
// next few control cities down the left and their mileage right-justified — the
// single most recognizable US interstate guide sign.
const distCache = new Map();
function distanceTex(rows) {
  const key = rows.map(r => r.join('~')).join('|');
  if (distCache.has(key)) return distCache.get(key);
  const W = 512, rh = 96, H = rows.length * rh + 44;
  const c = canvasTex(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#006b3c'; g.fillRect(0, 0, W, H);
  const rr = 22;
  g.strokeStyle = '#ffffff'; g.lineWidth = 10;
  g.beginPath();
  g.moveTo(14 + rr, 14); g.lineTo(W - 14 - rr, 14);
  g.quadraticCurveTo(W - 14, 14, W - 14, 14 + rr);
  g.lineTo(W - 14, H - 14 - rr); g.quadraticCurveTo(W - 14, H - 14, W - 14 - rr, H - 14);
  g.lineTo(14 + rr, H - 14); g.quadraticCurveTo(14, H - 14, 14, H - 14 - rr);
  g.lineTo(14, 14 + rr); g.quadraticCurveTo(14, 14, 14 + rr, 14);
  g.closePath(); g.stroke();
  g.fillStyle = '#ffffff';
  rows.forEach((r, i) => {
    const y = 30 + i * rh + rh * 0.66;
    g.textAlign = 'left';
    g.font = `bold ${r[0].length > 12 ? 50 : 64}px "Helvetica Neue", Arial, sans-serif`;
    g.fillText(r[0], 42, y);
    g.textAlign = 'right';
    g.font = 'bold 64px "Helvetica Neue", Arial, sans-serif';
    g.fillText(String(r[1]), W - 42, y);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  distCache.set(key, tex);
  return tex;
}

// The next up-to-n control cities ahead in `bound`, each with its mileage.
function citiesAhead(s, bound, n = 3) {
  return MILEPOSTS
    .filter(([cs]) => bound > 0 ? cs > s + 800 : cs < s - 800)
    .map(([cs, name]) => [name, Math.max(1, Math.round(Math.abs(cs - s) / 1609))])
    .sort((a, b) => a[1] - b[1])
    .slice(0, n);
}

function buildDistanceSigns(scene, registry) {
  if (!MILEPOSTS.length) return;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.6, metalness: 0.4 });
  const poleGeo = new THREE.CylinderGeometry(0.16, 0.2, 6.2, 8); poleGeo.translate(0, 3.1, 0);
  for (let s = 9000; s < LOOP_LENGTH; s += 21000) {
    for (const bound of [1, -1]) {
      const rows = citiesAhead(s, bound);
      if (rows.length < 2) continue;
      const tex = distanceTex(rows);
      const boardH = 6.4 * tex.image.height / tex.image.width;
      const board = litBoard(new THREE.PlaneGeometry(6.4, boardH), tex);
      board.position.y = 2.4 + boardH / 2;
      const g = new THREE.Group();
      for (const px of [-2.4, 2.4]) { const p = new THREE.Mesh(poleGeo, poleMat); p.position.x = px; g.add(p); }
      g.add(board);
      registry.signs.push({ userData: { board } });
      // right shoulder of the bound it serves (+s traffic drives the lat<0 side)
      const lat = (bound > 0 ? -1 : 1) * (roadClearAt(s) + 7);
      g.position.copy(posAt(s, lat, new THREE.Vector3()));
      g.position.y = groundY(s, lat);
      g.rotation.y = headingAt(s) + (bound > 0 ? Math.PI : 0);
      scene.add(g);
    }
  }
}

// Small green mile markers every mile on the increasing-s right shoulder — the
// little "MILE 84" posts that tick by the whole length of a US interstate.
const mileTexCache = new Map();
function mileMarkerTex(n) {
  if (mileTexCache.has(n)) return mileTexCache.get(n);
  const c = canvasTex(96, 150);
  const g = c.getContext('2d');
  g.fillStyle = '#006b3c'; g.fillRect(0, 0, 96, 150);
  g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(6, 6, 84, 138);
  g.fillStyle = '#ffffff'; g.textAlign = 'center';
  g.font = 'bold 26px "Helvetica Neue", Arial, sans-serif';
  g.fillText('MILE', 48, 40);
  g.font = 'bold 62px "Helvetica Neue", Arial, sans-serif';
  g.fillText(String(n), 48, 110);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  mileTexCache.set(n, tex);
  return tex;
}
function buildMileMarkers(scene, registry) {
  // US interstates only — Europe/India have their own km posts.
  if (EURO || UK || MAP === 'india' || MAP === 'andheri' || MAP === 'aundh' || MAP === 'newdelhi' || MAP === 'nyc') return;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.6, metalness: 0.4 });
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 2.4, 6); poleGeo.translate(0, 1.2, 0);
  const geo = new THREE.PlaneGeometry(0.9, 1.4);
  let mi = 1;
  for (let s = 1609; s < LOOP_LENGTH - 200; s += 1609, mi++) {
    const lat = -(roadClearAt(s) + 2.6);          // +s right shoulder
    const g = new THREE.Group();
    g.add(new THREE.Mesh(poleGeo, poleMat));
    const board = litBoard(geo, mileMarkerTex(mi)); board.position.y = 2.7; g.add(board);
    g.position.copy(posAt(s, lat, new THREE.Vector3()));
    g.position.y = groundY(s, lat);
    g.rotation.y = headingAt(s) + Math.PI;         // faces increasing-s traffic
    scene.add(g);
  }
}

// ---------------------------------------------------------------------------
// NJ electronic message boards (VMS): the cheeky NJDOT overheads. Amber
// dot-matrix, and the copy actually ROTATES over time like the real boards.
// Kept sparse — a handful across the whole state, not one every mile.
// ---------------------------------------------------------------------------
// IDOT boards run their own canon on the Chicago expressways
const IDOT_VMS_MSGS = [
  ['DROP THE PHONE', 'DRIVE NOW', 'TEXT LATER'],
  ['DRIVE SOBER', 'OR GET', 'PULLED OVER'],
  ['DA BEARS SUNDAY', 'EXPECT DELAYS', 'SOLDIER FIELD'],
  ['CLICK IT', 'OR TICKET', ''],
  ['SLOW DOWN', 'WORK ZONES', 'FINES DOUBLED'],
  ['KENNEDY EXPRESS', 'CHECK SIGNALS', 'BEFORE ENTERING'],
  ['LATE FOR DEEP DISH?', "IT'S WORTH", 'THE WAIT'],
  ['SNOW ROUTE', 'NO PARKING', 'DEC 1 - APR 1'],
  ['CTA DELAYS?', 'AT LEAST', "YOU'RE DRIVING"],
  ['MERGE LIKE', 'YOU LIVE HERE', ''],
  ['LOOP TRAFFIC', 'HEAVY AS', 'MALORT AFTERTASTE'],
];
const NJ_VMS_MSGS = MAP === 'midwest' ? IDOT_VMS_MSGS : [
  ['SLOW DOWN', "THIS AIN'T", 'THUNDER ROAD'],
  ['GET YOUR HEAD', 'OUT OF', 'YOUR APPS'],
  ['CAMP IN THE WOODS', 'NOT THE', 'LEFT LANE'],
  ['SLOWPOKES', 'LEFT LANE IS', 'FOR PASSING'],
  ['NICE BLINKER', 'USE IT', ''],
  ['DRIVE SOBER', 'OR GET', 'PULLED OVER'],
  ['DRIVING LIKE', 'PA PLATES?', 'KEEP RIGHT'],
  ['WELCOME PA DRIVERS', 'LEFT LANE IS', 'FOR PASSING HERE'],
  ['THE JERSEY SLIDE', 'NOT AN', 'OLYMPIC SPORT'],
  ['TAILGATING?', 'THIS IS NOT A', 'TAYLOR HAM LINE'],
  ['BUCKLE UP', 'BUTTERCUP', 'CLICK IT OR TICKET'],
  ['LEFT LANE CAMPER', 'THIS IS YOUR SIGN', 'MOVE OVER'],
  ['RACING TO THE SHORE?', 'THE BEACH', "ISN'T LEAVING"],
  ["DON'T DRIVE SALTY", 'USE YOUR', 'TURN SIGNAL'],
  ['HUMANS SIGNAL', 'BE A HUMAN', ''],
];
// Southern state-DOT boards (VDOT / NCDOT / SCDOT / GDOT / FDOT): straighter,
// the real overhead-DMS copy you see on I-95 — travel times, safety campaigns,
// Amber/Silver alerts, and (in FL/GA/SC) hurricane-season evacuation notices.
const SOUTH_VMS_MSGS = [
  ['BUCKLE UP', 'IT\'S THE LAW', ''],
  ['MOVE OVER', 'FOR STOPPED', 'VEHICLES'],
  ['SLOW DOWN', 'MOVE OVER', 'IT\'S THE LAW'],
  ['WORK ZONE', 'AHEAD', 'FINES DOUBLED'],
  ['DRIVE SOBER', 'OR GET', 'PULLED OVER'],
  ['PHONE DOWN', 'EYES UP', 'DRIVE SAFE'],
  ['AMBER ALERT', 'CHECK LOCAL', 'MEDIA'],
  ['LEFT LANE', 'FOR PASSING', 'ONLY'],
  ['HURRICANE SEASON', 'KNOW YOUR', 'EVAC ROUTE'],
  ['I-95 SOUTH', 'MIAMI', 'TRAVEL TIME 45 MIN'],
  ['WATCH FOR', 'STOPPED', 'TRAFFIC AHEAD'],
];
// sparse, real-world cadence: a few boards per hundred miles, one bound each
const NJ_VMS_SPOTS = {
  gsp: [
    { s: 24000, dir: 1 }, { s: 70000, dir: -1 }, { s: 118000, dir: 1 },
    { s: 163000, dir: -1 }, { s: 196500, dir: 1 }, { s: 232000, dir: -1 },
    { s: 262000, dir: 1 },
  ],
  // i95: NJDOT's cheeky boards on the Turnpike, then straighter state-DOT DMS
  // down the DE → FL run (each southern spot carries the SOUTH_VMS_MSGS pool)
  i95: [{ s: 47300, dir: 1 }, { s: 58800, dir: -1 }, { s: 70200, dir: 1 },
    { s: 205000, dir: 1, msgs: SOUTH_VMS_MSGS },    // Baltimore approach
    { s: 300000, dir: -1, msgs: SOUTH_VMS_MSGS },   // Capital Beltway
    { s: 470000, dir: 1, msgs: SOUTH_VMS_MSGS },    // Richmond
    { s: 610000, dir: -1, msgs: SOUTH_VMS_MSGS },   // Roanoke Rapids
    { s: 800000, dir: 1, msgs: SOUTH_VMS_MSGS },    // Fayetteville
    { s: 955000, dir: -1, msgs: SOUTH_VMS_MSGS },   // Florence
    { s: 1230000, dir: 1, msgs: SOUTH_VMS_MSGS },   // Savannah
    { s: 1450000, dir: -1, msgs: SOUTH_VMS_MSGS },  // Jacksonville
    { s: 1680000, dir: 1, msgs: SOUTH_VMS_MSGS },   // Space Coast
    { s: 1890000, dir: -1, msgs: SOUTH_VMS_MSGS },  // West Palm Beach
    { s: 1975000, dir: 1, msgs: SOUTH_VMS_MSGS }],  // Miami-Dade
  // ACX: NJ side only (the SJTA runs the same cheeky boards)
  acx: [{ s: 19000, dir: 1 }, { s: 52000, dir: -1 }, { s: 80000, dir: 1 }],
  // IDOT boards on the Kennedy / Dan Ryan / Borman corridor
  midwest: [
    { s: 7200, dir: 1 }, { s: 13000, dir: -1 }, { s: 21500, dir: 1 },
    { s: 30500, dir: -1 }, { s: 44000, dir: 1 },
  ],
}[MAP] || [];

function buildNJVms(scene, registry) {
  if (!NJ_VMS_SPOTS.length) return;
  registry.njVms = [];
  const steel = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.5, metalness: 0.6 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.7 });
  NJ_VMS_SPOTS.forEach((spot, i) => {
    const cv = canvasTex(512, 224);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const boardMat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.5,
    });
    const group = new THREE.Group();
    const half = roadClearAt(spot.s) + 1;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.7, 0.7), steel);
    beam.position.y = 7.2; group.add(beam);
    for (const x of [-half, half]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.2, 0.6), steel);
      post.position.set(x, 3.6, 0); group.add(post);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.9, 0.35), backMat);
    back.position.set(0, 9.3, -0.02); group.add(back);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 3.5), boardMat);
    board.position.set(0, 9.3, 0.2); group.add(board);
    group.position.copy(posAt(spot.s, 0, new THREE.Vector3()));
    // face the board at its bound (+s traffic approaches from decreasing s)
    group.rotation.y = headingAt(spot.s) + (spot.dir > 0 ? Math.PI : 0);
    scene.add(group);
    registry.njVms.push({ cv, tex, phase: i * 3, last: -1, msgs: spot.msgs || NJ_VMS_MSGS });
  });
  updateNJVms(registry, 0);
}

// called from the main loop: rotate each board to a new message every ~50 s
export function updateNJVms(registry, simTime) {
  const list = registry.njVms;
  if (!list) return;
  for (const d of list) {
    const msgs = d.msgs || NJ_VMS_MSGS;
    const idx = (d.phase + Math.floor(simTime / 50)) % msgs.length;
    if (idx === d.last) continue;
    d.last = idx;
    const lines = msgs[idx].filter(l => l);
    const g = d.cv.getContext('2d');
    g.fillStyle = '#0a0c0e'; g.fillRect(0, 0, 512, 224);
    g.fillStyle = '#ffb200'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const rowH = 224 / lines.length;
    lines.forEach((line, i) => {
      const size = Math.min(52, Math.floor(430 / Math.max(6, line.length) * 1.7));
      g.font = `bold ${size}px "Courier New", monospace`;
      g.fillText(line, 256, rowH * (i + 0.5));
    });
    d.tex.needsUpdate = true;
  }
}

export function buildShields(scene, registry) {
  if (!SEGMENTS.length) return;
  const STEP = MAP === 'andheri' || MAP === 'aundh' ? 1800 : 2400;  // marker interval (per side)
  const shieldGeo = new THREE.PlaneGeometry(3.4, 3.4);
  const logoGeo = new THREE.PlaneGeometry(3.6, 3.6);   // standalone logo discs
  const tbGeo = new THREE.PlaneGeometry(2.4, 2.4);     // toll-road co-brand board
  const plateGeoIs = new THREE.PlaneGeometry(4.6, 1.8);
  const plateGeoName = new THREE.PlaneGeometry(5.2, 2.6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.6, metalness: 0.4 });
  const poleGeo = new THREE.CylinderGeometry(0.16, 0.2, 6.4, 8);
  poleGeo.translate(0, 3.2, 0);

  // Route shields + control-city plates on BOTH shoulders, each facing its own
  // direction of travel (so every bound is signed the whole way).
  for (let s = STEP * 0.5; s < LOOP_LENGTH; s += STEP) {
    const seg = SEGMENTS.find(z => s >= z.s0 && s < z.s1) || SEGMENTS[0];
    for (const sd of [-1, 1]) {
      const card = sd < 0 ? CARDINALS[0] : CARDINALS[1];
      const city = sd < 0 ? seg.inc : seg.dec;
      const lat = sd * (roadClearAt(s) + 5.5);
      const group = new THREE.Group();
      group.add(new THREE.Mesh(poleGeo, poleMat));
      if (seg.kind === 'ae' || seg.kind === 'de' || seg.kind === 'uk' || seg.kind === 'fr' || seg.kind === 'it') {
        // European route marker: blue A-plate (or DE hexagon), the green
        // E-route plate under it, then the control-city board
        const shield = litBoard(
          seg.kind === 'de' ? new THREE.PlaneGeometry(3.6, 2.25) : new THREE.PlaneGeometry(3.0, 2.35),
          faceTex(seg.route, seg.kind));
        shield.position.y = 8.4;
        const ePlate = litBoard(new THREE.PlaneGeometry(2.2, 1.1), faceTex(seg.e, 'e'));
        ePlate.position.y = 6.9;
        const plate = litBoard(plateGeoIs, controlTex(card, city));
        plate.position.y = 5.4;
        group.add(shield, ePlate, plate);
        registry.signs.push({ userData: { board: shield } }, { userData: { board: ePlate } }, { userData: { board: plate } });
      } else if (seg.kind === 'is') {
        const shield = litBoard(shieldGeo, faceTex(seg.route, seg.kind), true);
        const plate = litBoard(plateGeoIs, controlTex(card, city));
        if (seg.tb) {
          // toll-road co-brand: the real turnpikes post their own logo right
          // under the interstate shield (pilgrim hat, NJTP shield, …)
          shield.position.y = 9.5;
          const tbBoard = litBoard(tbGeo, faceTex(seg.tb, seg.tb), true);
          tbBoard.position.y = 6.6;
          plate.position.y = 4.4;
          group.add(shield, tbBoard, plate);
          registry.signs.push({ userData: { board: shield } }, { userData: { board: tbBoard } }, { userData: { board: plate } });
        } else {
          shield.position.y = 8.0;
          plate.position.y = 5.5;
          group.add(shield, plate);
          registry.signs.push({ userData: { board: shield } }, { userData: { board: plate } });
        }
      } else if (seg.kind === 'gsp' || seg.kind === 'ace') {
        // standalone real-life logo trailblazer instead of a text plate
        const shield = litBoard(logoGeo, faceTex(seg.route, seg.kind), true);
        shield.position.y = 8.2;
        const plate = litBoard(plateGeoIs, controlTex(card, city));
        plate.position.y = 5.6;
        group.add(shield, plate);
        registry.signs.push({ userData: { board: shield } }, { userData: { board: plate } });
      } else {
        const nameBoard = litBoard(plateGeoName, faceTex(seg.route, seg.kind));
        nameBoard.position.y = 7.6;
        const plate = litBoard(plateGeoIs, controlTex(card, city));
        plate.position.y = 5.2;
        group.add(nameBoard, plate);
        registry.signs.push({ userData: { board: nameBoard } }, { userData: { board: plate } });
      }
      group.position.copy(posAt(s, lat, new THREE.Vector3()));
      group.position.y = groundY(s, lat);
      group.rotation.y = headingAt(s) + (sd < 0 ? Math.PI : 0);
      scene.add(group);
    }
  }

  // Overhead green control-city guide gantries spanning the road, with boards
  // facing BOTH directions — frequent in the cities, still regular in open
  // country (real freeways are plastered with these).
  const gantryBg = (MAP === 'a1it' || MAP === 'swiss') ? '#0b7d3e' : (EURO || UK) ? '#0d4f9e' : '#046a38';
  for (let s = 900; s < LOOP_LENGTH; ) {
    // European city zones (4-lane urban stretches) get the tight city cadence
    const z = zoneAt(s);
    const urban = URBAN.has(z.key) || ((EURO || UK) && z.lanes >= 4);
    const seg = SEGMENTS.find(z => s >= z.s0 && s < z.s1) || SEGMENTS[0];
    // Europe heads the board with the route number instead of a compass word
    const incTop = CARDINALS[0] || seg.route + (seg.e ? ' · ' + seg.e : '');
    const decTop = CARDINALS[1] || seg.route + (seg.e ? ' · ' + seg.e : '');
    // US guide signs name the control city with its mileage under the cardinal
    // ("PHILADELPHIA  35"); Europe heads with the route number, no mileage.
    const cityLine = city => {
      const mi = milesTo(city, s);
      return '▲ ' + city.toUpperCase() + (mi ? '   ' + mi : '');
    };
    // Face each board at its own bound and hang it over that bound's carriageway.
    // The gantry group is rotated headingAt, so a board with local rotation PI
    // faces +s traffic (which drives the lat<0 lanes); local 0 faces −s traffic.
    const incBoard = textBoard([incTop, cityLine(seg.inc)], 7.2, 3.0, gantryBg, '#ffffff');
    incBoard.rotation.y = Math.PI;                       // faces increasing-s traffic
    const decBoard = textBoard([decTop, cityLine(seg.dec)], 7.2, 3.0, gantryBg, '#ffffff');
    gantry(scene, registry, s, [{ lat: -6, mesh: incBoard }, { lat: 6, mesh: decBoard }], 6.8);
    s += urban ? 1250 : ((EURO || UK) ? 2100 : 2500);
  }

  buildSpeedLimits(scene, registry);
  buildWorkZones(scene, registry);
  buildDestinationGuides(scene, registry);
  buildDistanceSigns(scene, registry);   // white-on-green control-city mileage
  buildMileMarkers(scene, registry);      // MILE ## posts, US maps
  buildNJVms(scene, registry);            // the cheeky NJ electronic boards
}
