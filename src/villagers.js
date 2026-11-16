import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Villagers — the people who fill the walking maps (Konkan + Bihar villages
// under the British Raj, c. 1920s). Low-poly humanoids with role/caste-based
// dress: farmers, fishermen, brahmins, women in sarees, children, merchants,
// the zamindar — and the machinery of empire, British soldiers in pith helmets
// and Indian sepoys in Raj khaki. They wander, idle, and squat in the shade.
// ---------------------------------------------------------------------------

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const SKIN = [0x8d5524, 0x7a4a1e, 0xa06a34, 0x6b3d18, 0x955e2b, 0xb07840];
const WHITE_SKIN = [0xf0c8a8, 0xe8bfa0, 0xf2d0b8, 0xecc4a4];
const BLACK_SKIN = [0x4a2f1a, 0x3a2412, 0x5a3a20, 0x43301c];
// Rio favela demographics: the full range — preto, pardo, branco, mixed.
const RIO_SKIN = [0x3a2412, 0x4a2f1a, 0x5a3a20, 0x7a4a28, 0x8d5524, 0xa06a3c, 0xb98a5a, 0xd0a074, 0xe8bfa0, 0xf0c8a8];
const RIO_TOPS = [0xe0121a, 0xffd23d, 0x1a7a3f, 0x1a3a8c, 0xff6a1a, 0xe83a8a, 0x18b0c0, 0xffffff, 0x111111, 0x8a2be2];
// Delhi slum dress: worn, dust-faded shirts/kurtas — some colour survives; women
// in sarees/salwar that stay bright even when everything else is grime.
const DELHI_TOPS = [0x3a5a7a, 0x6a7a4a, 0x8a5a3a, 0x5a6a8a, 0x7a3a3a, 0xaa9a7a, 0x4a6a5a, 0xcabf9a, 0xb0703a, 0x5a7a6a, 0x9aa0a4, 0x8a8a72];
const DELHI_SAREE = [0xc21f2f, 0xd08010, 0x207040, 0x903070, 0x1a6a8a, 0xb04a1a, 0x7a1f6b, 0x2a7a4a, 0xd0306a, 0xe0a010];
// Newark airport: a global cross-section of travellers. Skin palettes per broad
// origin so different flights read differently (a Tokyo flight vs a Lagos flight
// vs a domestic hop), the way an international airport actually looks.
const DOM_SKIN = [0x3a2412, 0x4a2f1a, 0x6b3d18, 0x8d5524, 0xa06a3c, 0xb98a5a, 0xd0a074, 0xe8bfa0, 0xf0c8a8, 0xecc4a4];
const ASIA_SKIN = [0xe8c8a0, 0xf0d2ac, 0xe0be94, 0xd8b488, 0xeccdaa, 0xdcb890];
const AFRICA_SKIN = [0x3a2412, 0x43301c, 0x4a2f1a, 0x5a3a20, 0x6b3d18, 0x7a4a28];
const LATIN_SKIN = [0x7a4a28, 0x8d5524, 0xa06a3c, 0xb07840, 0xb98a5a, 0x6b3d18];
const EURO_SKIN = [0xf0c8a8, 0xe8bfa0, 0xf2d0b8, 0xecc4a4, 0xf5d8c0, 0xe0b596];
const SA_SKIN = [0x6b3d18, 0x7a4a1e, 0x8d5524, 0x955e2b, 0xa06a34, 0xb07840];
const CASUAL_TOPS = [0x1a3a8c, 0xe0121a, 0x1a7a3f, 0x333333, 0xffffff, 0xf2c53d, 0x8a2be2, 0x18b0c0, 0xff6a1a, 0x6a7a8a, 0x9a3a3a, 0x2a2a3a];
function pick(rnd, arr) { return arr[(rnd() * arr.length) | 0]; }
function mat(color, rough = 0.85) { return new THREE.MeshStandardMaterial({ color, roughness: rough }); }

// A role → dress descriptor. Colours vary per instance within the palette.
// region 'konkan' | 'bihar' shifts a few defaults (turban vs pagri, brighter
// coastal sarees vs plainer plains dress).
function dressFor(role, rnd, region) {
  const saree = () => pick(rnd, region === 'konkan'
    ? [0x1e7d4f, 0xc21f2f, 0xe0a010, 0x146b8c, 0x8a1f6b, 0xd35400]
    : [0xb02020, 0xd08010, 0x207040, 0x903070, 0xc0902a, 0x7a3010]);
  const white = () => pick(rnd, [0xf2efe4, 0xeae4d2, 0xf5f2ea]);
  const khaki = 0xb9a970, redcoat = 0xa62431, pith = 0xf4efe0;
  switch (role) {
    case 'british':                              // British soldier: red coat / khaki, pith helmet, rifle
      return { skin: 0xe8b892, top: rnd() < 0.5 ? redcoat : khaki, bottom: khaki, hat: 'pith', hatCol: pith, rifle: true, tall: 1.06 };
    case 'sepoy':                                // Indian soldier in British service: khaki + turban + rifle
      return { skin: pick(rnd, SKIN), top: khaki, bottom: khaki, turban: pick(rnd, [0x1a3a6b, 0x7a1020, khaki]), rifle: true, tall: 1.0 };
    case 'noble':                                // Mughal noble: rich jama, jewelled turban, sash
      return { skin: pick(rnd, [0xb07840, 0xc08850]), top: pick(rnd, [0x1a4a3a, 0x6b1f3a, 0x3a2a6a, 0x8a5a1a, 0x2a5a6a]), bottom: white(), turban: pick(rnd, [0xd4af37, 0xf2efe4, 0x2a6a4a]), sash: pick(rnd, [0xd4af37, 0xc21f2f, 0xffffff]), stout: rnd() < 0.5, tall: 1.02 };
    case 'courtier':
      return { skin: pick(rnd, SKIN), top: pick(rnd, [0xf2efe4, 0xd8c8a0, 0x9a7a4a, 0x6a8a7a]), bottom: white(), turban: pick(rnd, [0xf2efe4, 0xd4af37, 0xc21f2f]) };
    case 'mughal':                               // Mughal soldier: tunic, turban, spear + shield
      return { skin: pick(rnd, SKIN), top: pick(rnd, [0x2f6a3a, 0x8a2020, 0x3a3a6a]), bottom: pick(rnd, [0x8a6a44, 0x5a5a5a]), turban: pick(rnd, [0x8a2020, 0x2f5a3a, 0xd4af37]), spear: true, tall: 1.0 };
    case 'brahmin':                              // white dhoti, bare/shawl torso, fair, cap
      return { skin: pick(rnd, [0xb07840, 0xa06a34]), top: white(), bottom: white(), dhoti: true, cap: rnd() < 0.5 };
    case 'zamindar':                             // fine coloured angarkha, big turban, portly
      return { skin: pick(rnd, [0xa06a34, 0xb07840]), top: pick(rnd, [0x6b1f3a, 0x1a4a6b, 0x2a5a2a, 0x5a2a6a]), bottom: white(), turban: pick(rnd, [0xd4af37, 0xc21f2f, 0xe0e0e0]), stout: true };
    case 'merchant':
      return { skin: pick(rnd, SKIN), top: pick(rnd, [0xf2efe4, 0xd0c8b0]), bottom: white(), cap: true, stout: rnd() < 0.5 };
    case 'woman':
      return { skin: pick(rnd, SKIN), saree: saree(), female: true };
    case 'child':
      return { skin: pick(rnd, SKIN), top: pick(rnd, [0xd0d0c0, 0x8899aa, 0xc0a060, 0xa03030]), bottom: pick(rnd, [0x555, 0x764, 0x346]), child: true };
    case 'fisher':                               // Koli fisherman: bare torso, dhoti, red waistcloth
      return { skin: pick(rnd, [0x6b3d18, 0x7a4a1e]), top: null, bottom: 0x8a1f2a, dhoti: true, pagri: 0xc21f2f };
    case 'sadhu':
      return { skin: pick(rnd, SKIN), top: 0xd35400, bottom: 0xe07010, sadhu: true };
    // --- 1840s antebellum North Carolina ---
    case 'planter':                              // wealthy white planter: dark frock coat, top hat
      return { skin: pick(rnd, WHITE_SKIN), top: pick(rnd, [0x1a1a2a, 0x241a12, 0x22303a, 0x2a2a2a]), bottom: pick(rnd, [0xcabf9a, 0x8a7a5a, 0x4a4a44]), hat: 'top', hatCol: 0x141414, tall: 1.04 };
    case 'townsman':
      return { skin: pick(rnd, WHITE_SKIN), top: pick(rnd, [0x3a3a4a, 0x5a3a2a, 0x2a4a3a, 0x4a3a5a]), bottom: pick(rnd, [0x8a7a5a, 0x4a4a4a, 0x6a5a44]), hat: rnd() < 0.6 ? 'brim' : 'top', hatCol: 0x2a2018 };
    case 'townswoman':                           // hoop skirt + bonnet
      return { skin: pick(rnd, WHITE_SKIN), female: true, saree: pick(rnd, [0x6a3a5a, 0x3a4a6a, 0x5a6a4a, 0x8a8a9a, 0x9a6a4a]), hoop: true, hat: 'bonnet', bonnetCol: pick(rnd, [0xf2efe4, 0x8a5a6a, 0x5a6a7a]) };
    case 'overseer':                             // plainer coat, wide-brim hat, carries a stick
      return { skin: pick(rnd, WHITE_SKIN), top: 0x5a4a30, bottom: 0x4a3a28, hat: 'brim', hatCol: 0x3a2a18, stick: true, tall: 1.02 };
    case 'enslaved':                             // field hand: worn osnaburg shirt/trousers
      return { skin: pick(rnd, BLACK_SKIN), top: rnd() < 0.35 ? null : pick(rnd, [0xcabf9a, 0x9a9080, 0xb0a488, 0x8a8272]), bottom: pick(rnd, [0x8a7a5a, 0x6a5a44, 0x7a6a50]) };
    case 'slavewoman':                           // long plain dress + headwrap
      return { skin: pick(rnd, BLACK_SKIN), female: true, saree: pick(rnd, [0x9a8a6a, 0x8a7a5a, 0x7a6a54, 0xa09a80, 0x6a6250]), headwrap: pick(rnd, [0xf2efe4, 0xc21f2f, 0xd0a040, 0x4a6a8a]) };
    case 'child_white':
      return { skin: pick(rnd, WHITE_SKIN), top: pick(rnd, [0xd0d0c0, 0x8899aa, 0xa03030]), bottom: pick(rnd, [0x555, 0x764]), child: true };
    case 'child_black':
      return { skin: pick(rnd, BLACK_SKIN), top: pick(rnd, [0xb0a488, 0x9a9080, 0xcabf9a]), bottom: pick(rnd, [0x6a5a44, 0x7a6a50]), child: true };
    // --- modern Rio favela ---
    case 'rio_m':                                // t-shirt / football jersey / tank + shorts
      return { skin: pick(rnd, RIO_SKIN), top: rnd() < 0.25 ? null : pick(rnd, RIO_TOPS), bottom: pick(rnd, [0x222, 0x2a3a6a, 0x555, 0x8a7a5a, 0x1a1a1a]), hat: rnd() < 0.4 ? 'ballcap' : null, hatCol: pick(rnd, RIO_TOPS) };
    case 'rio_f':
      return { skin: pick(rnd, RIO_SKIN), top: pick(rnd, RIO_TOPS), bottom: pick(rnd, [0x222, 0x8a2be2, 0xe83a8a, 0x1a1a1a, 0x555]) };
    case 'rio_kid':
      return { skin: pick(rnd, RIO_SKIN), top: pick(rnd, [0xe0121a, 0xffd23d, 0x1a3a8c, 0xffffff]), bottom: pick(rnd, [0x222, 0x555]), child: true, hat: rnd() < 0.3 ? 'ballcap' : null, hatCol: pick(rnd, RIO_TOPS) };
    case 'rio_worker':                           // pedreiro (mason): tank + shorts + hard hat
      return { skin: pick(rnd, RIO_SKIN), top: rnd() < 0.5 ? null : 0xd8d0c0, bottom: pick(rnd, [0x555, 0x8a7a5a, 0x2a3a6a]), hat: 'hardhat', hatCol: pick(rnd, [0xffd23d, 0xff6a1a, 0xffffff]) };
    case 'rio_elder':
      return { skin: pick(rnd, RIO_SKIN), top: pick(rnd, [0xf2efe4, 0x8a8a8a, 0x6a7a8a, 0xd0c8b0]), bottom: pick(rnd, [0x333, 0x5a4a3a]), hat: rnd() < 0.4 ? 'ballcap' : null, hatCol: 0xf2efe4 };
    case 'rio_shady':                            // olheiro loitering — plain, cap low
      return { skin: pick(rnd, RIO_SKIN), top: pick(rnd, [0x111111, 0x1a1a1a, 0x222]), bottom: pick(rnd, [0x1a1a1a, 0x222, 0x2a3a6a]), hat: 'ballcap', hatCol: pick(rnd, [0x111111, 0xe0121a]) };
    // --- present-day Delhi slum (Gangetic-plain migrants — very poor) + the
    //     posh society next door (the wealth gulf you can see across a wall) ---
    case 'delhi_m':                              // shirt/kurta + trousers/pyjama; some bare in the heat; Muslim topi
      return { skin: pick(rnd, SKIN), top: rnd() < 0.16 ? null : pick(rnd, DELHI_TOPS), bottom: pick(rnd, [0x2a2a2a, 0x3a3a44, 0x5a4a34, 0xece7d8, 0x1a1a1a]), cap: rnd() < 0.18, pagri: rnd() < 0.12 ? pick(rnd, [0xf2efe4, 0xc21f2f]) : null };
    case 'delhi_f':                              // saree / salwar, ghoonghat pulled up
      return { skin: pick(rnd, SKIN), female: true, saree: pick(rnd, DELHI_SAREE), headwrap: rnd() < 0.35 ? pick(rnd, DELHI_SAREE) : null };
    case 'delhi_kid':
      return { skin: pick(rnd, SKIN), top: rnd() < 0.25 ? null : pick(rnd, [0xd0605a, 0x5a7ac0, 0xd0b040, 0xffffff, 0x5aa06a]), bottom: pick(rnd, [0x333, 0x5a4a34, 0x2a3a6a]), child: true };
    case 'delhi_laborer':                        // mazdoor: bare torso / gamcha, cloth on the head
      return { skin: pick(rnd, [0x6b3d18, 0x7a4a1e, 0x8d5524]), top: rnd() < 0.55 ? null : 0xd8d0c0, bottom: pick(rnd, [0x5a4a34, 0x2a2a2a, 0x8a7a5a]), pagri: pick(rnd, [0xc21f2f, 0xd0c090, 0xf2efe4, 0xd8a030]) };
    case 'delhi_vendor':                         // thela / kirana wallah: kurta + cap
      return { skin: pick(rnd, SKIN), top: pick(rnd, [0xf2efe4, 0xd0c8b0, 0x8a9a6a, 0xc0a86a]), bottom: pick(rnd, [0xece7d8, 0x5a4a34]), cap: rnd() < 0.5 };
    case 'delhi_guard':                          // society/mall security: khaki-olive uniform, cap
      return { skin: pick(rnd, SKIN), top: pick(rnd, [0x4a5a3a, 0x3a4a5a]), bottom: 0x2a3428, cap: true, vest: rnd() < 0.3 ? 0x1a1a1a : null, tall: 1.02 };
    case 'delhi_rich':                           // the society side: clean western dress, fairer
      return { skin: pick(rnd, [0xb07840, 0xc08850, 0xa06a34, 0xd0a074]), female: rnd() < 0.45, saree: pick(rnd, [0xffffff, 0x1a4a6a, 0x6a1030, 0x2a2a3a, 0xd0d0d8]), top: pick(rnd, [0xffffff, 0x1a1e2a, 0x2a4a8a, 0x6a1030, 0x333]), bottom: pick(rnd, [0x1a1e2a, 0x2a2a30, 0x3a3a44]), hat: rnd() < 0.2 ? 'ballcap' : null, hatCol: pick(rnd, [0xffffff, 0x1a1a1a]) };
    // Rail corridor regional passenger mix. These are deliberately compact
    // stylized cues rather than claims about every resident of a state.
    case 'rail_bengal_m': return { skin: pick(rnd, [0x5f351b, 0x6b3d18, 0x7a4a1e, 0x8d5524]), top: pick(rnd, [0xece7d8, 0x6a7a8a, 0x7a3a3a, 0x365d62]), bottom: pick(rnd, [0x252b31, 0x4b4238, 0xe0d7bd]), tall: 0.94 };
    case 'rail_bengal_f': return { skin: pick(rnd, [0x6b3d18, 0x7a4a1e, 0x8d5524]), female: true, saree: pick(rnd, [0xc21f2f, 0xe0a010, 0x207040, 0xffffff, 0x146b8c]), headwrap: rnd() < 0.28 ? 0xf2efe4 : null };
    case 'rail_bihar_m': return { skin: pick(rnd, [0x5a3016, 0x6b3d18, 0x7a4a1e]), top: rnd() < 0.28 ? null : pick(rnd, [0xf2efe4, 0xd8c8a0, 0x7a6a50]), bottom: pick(rnd, [0x5a4a34, 0x2a2a2a, 0xece7d8]), pagri: rnd() < 0.35 ? pick(rnd, [0xc21f2f, 0xd0c090, 0xf2efe4]) : null, tall: 0.95 };
    case 'rail_bihar_f': return { skin: pick(rnd, [0x6b3d18, 0x7a4a1e, 0x8d5524]), female: true, saree: pick(rnd, [0xb02020, 0xd08010, 0x7a3010, 0x903070]), headwrap: rnd() < 0.2 ? 0xd0c8b0 : null, tall: 0.93 };
    case 'rail_up_m': return { skin: pick(rnd, [0x6b3d18, 0x7a4a1e, 0x8d5524, 0xa06a34]), top: pick(rnd, DELHI_TOPS), bottom: pick(rnd, [0x2a2a2a, 0x5a4a34, 0xece7d8]), cap: rnd() < 0.18, tall: 0.98 };
    case 'rail_up_f': return { skin: pick(rnd, [0x7a4a1e, 0x8d5524, 0xa06a34]), female: true, saree: pick(rnd, DELHI_SAREE), headwrap: rnd() < 0.3 ? pick(rnd, DELHI_SAREE) : null };
    case 'rail_delhi_m': return { skin: pick(rnd, SKIN), top: pick(rnd, DELHI_TOPS), bottom: pick(rnd, [0x1a1a1a, 0x3a3a44, 0x2a3a6a]), cap: rnd() < 0.2, pack: rnd() < 0.2, tall: 1.0 };
    case 'rail_delhi_f': return { skin: pick(rnd, SKIN), female: true, saree: pick(rnd, DELHI_SAREE), headwrap: rnd() < 0.25 ? pick(rnd, DELHI_SAREE) : null };
    case 'rail_muslim_f': return { skin: pick(rnd, [0x5a3016, 0x6b3d18, 0x7a4a1e, 0x8d5524]), female: true, saree: pick(rnd, [0x1a3a6b, 0x4a245e, 0x2f5a3a, 0x111c36, 0x8a1f6b]), headwrap: pick(rnd, [0x111c36, 0x1a3a6b, 0x4a245e, 0xf2efe4]) };
    case 'rail_sikh_m': return { skin: pick(rnd, [0x8d5524, 0xa06a34, 0xb07840, 0x7a4a1e]), top: pick(rnd, [0x2a5a6a, 0x365d62, 0xf2efe4, 0x6b1f3a]), bottom: pick(rnd, [0x252b31, 0x3a3a44, 0x1a1a1a]), turban: pick(rnd, [0x1a3a6b, 0xd08010, 0xc21f2f, 0x2a6a4a]), tall: 1.05 };
    // --- modern Newark Liberty airport (EWR) ---
    // staff / workers
    case 'tsa':                                  // TSA officer: navy shirt, dark trousers, cap, gloves
      return { skin: pick(rnd, DOM_SKIN), top: 0x1b2a44, bottom: 0x14181f, hat: 'ballcap', hatCol: 0x14181f, lanyard: 0x2a5aaa };
    case 'agent':                                // airline gate/check-in agent: blue blazer, scarf, lanyard
      return { skin: pick(rnd, DOM_SKIN), top: pick(rnd, [0x1a3a7a, 0x14304a, 0x6a1030]), bottom: 0x1a1e28, female: rnd() < 0.5, saree: 0x14304a, lanyard: 0xf2c53d };
    case 'pilot':                                // captain: white shirt, epaulets, dark trousers, peaked cap
      return { skin: pick(rnd, [...EURO_SKIN, ...DOM_SKIN]), top: 0xf2f4f6, bottom: 0x14161c, hat: 'peaked', hatCol: 0x14161c, epaulet: true, tall: 1.03 };
    case 'attendant':                            // flight attendant: navy/scarf, neat
      return { skin: pick(rnd, DOM_SKIN), female: rnd() < 0.7, saree: pick(rnd, [0x14304a, 0x6a1030, 0x1a3a7a]), top: 0x14304a, bottom: 0x14181f, scarf: pick(rnd, [0xe0121a, 0xf2c53d, 0x18b0c0]), roller: rnd() < 0.6 };
    case 'crew':                                 // ramp / ground crew: hi-vis vest, ear defenders
      return { skin: pick(rnd, DOM_SKIN), top: 0x2a2a30, bottom: 0x2a2a30, vest: pick(rnd, [0xf5e000, 0xff7a1a]), hat: 'ear' };
    case 'cop':                                  // Port Authority police: dark blue, vest, cap
      return { skin: pick(rnd, DOM_SKIN), top: 0x1a2230, bottom: 0x11151c, vest: 0x14181f, hat: 'ballcap', hatCol: 0x11151c, tall: 1.02 };
    case 'cleaner':                              // custodial: polo + cart nearby
      return { skin: pick(rnd, [...DOM_SKIN, ...SA_SKIN]), top: pick(rnd, [0x2a7a5a, 0x6a7a8a]), bottom: 0x2a2a30, cap: rnd() < 0.4 };
    case 'redcap':                               // skycap porter
      return { skin: pick(rnd, [...AFRICA_SKIN, ...DOM_SKIN]), top: 0x8a1020, bottom: 0x1a1e28, cap: true };
    // travellers — palette by broad flight origin; clothing casual/business mixed
    case 'pax_dom': case 'pax_latin': case 'pax_asia': case 'pax_africa':
    case 'pax_euro': case 'pax_sa': {
      const skinPool = role === 'pax_asia' ? ASIA_SKIN : role === 'pax_africa' ? AFRICA_SKIN
        : role === 'pax_latin' ? LATIN_SKIN : role === 'pax_euro' ? EURO_SKIN
        : role === 'pax_sa' ? SA_SKIN : DOM_SKIN;
      const female = rnd() < 0.5;
      const biz = rnd() < 0.22;
      const d = { skin: pick(rnd, skinPool), roller: rnd() < 0.55, pack: rnd() < 0.4,
        hat: rnd() < 0.22 ? 'ballcap' : null, hatCol: pick(rnd, CASUAL_TOPS) };
      if (biz) { d.top = pick(rnd, [0x1a1e2a, 0x2a2a3a, 0x3a3a4a, 0x14304a]); d.bottom = pick(rnd, [0x1a1e2a, 0x2a2a30, 0x3a3a44]); }
      else if (female && rnd() < 0.5) { d.female = true; d.saree = pick(rnd, CASUAL_TOPS); }
      else { d.top = pick(rnd, CASUAL_TOPS); d.bottom = pick(rnd, [0x2a3a6a, 0x333333, 0x1a1a1a, 0x6a5a44, 0x555555]); }
      // South-Asian & some intl women in traditional dress
      if (role === 'pax_sa' && female && rnd() < 0.5) { d.female = true; d.saree = pick(rnd, [0xc21f2f, 0xe0a010, 0x1e7d4f, 0x8a1f6b, 0x146b8c]); }
      return d;
    }
    case 'pax_kid':
      return { skin: pick(rnd, DOM_SKIN), top: pick(rnd, CASUAL_TOPS), bottom: pick(rnd, [0x2a3a6a, 0x333]), child: true, pack: rnd() < 0.5, hat: rnd() < 0.3 ? 'ballcap' : null, hatCol: pick(rnd, CASUAL_TOPS) };
    case 'farmer':
    default:                                     // farmer / labourer: dhoti + gamcha, cloth pagri
      return { skin: pick(rnd, SKIN), top: rnd() < 0.4 ? null : white(), bottom: white(), dhoti: true,
        pagri: region === 'bihar' ? pick(rnd, [0xf2efe4, 0xc21f2f, 0xffffff, 0xd0c090]) : (rnd() < 0.5 ? pick(rnd, [0xf2efe4, 0xd0c090]) : null) };
  }
}

// Build a humanoid from a dress descriptor. Returns { group, legs:[..], arms:[..], h }.
function buildHuman(d) {
  const g = new THREE.Group();
  const scale = d.tall || (d.child ? 0.62 : d.female ? 0.94 : 1);
  const skinMat = mat(d.skin ?? 0x8d5524, 0.9);
  const legMat = mat(d.bottom ?? 0xece7d8);
  const legs = [], arms = [];

  // legs (or a saree/dhoti skirt lower)
  if (d.female || d.sadhu) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(d.hoop ? 0.18 : 0.20, d.hoop ? 0.62 : 0.34, d.hoop ? 1.05 : 0.95, d.hoop ? 12 : 8), mat(d.saree ?? d.bottom ?? 0xb02020));
    skirt.position.y = 0.52; g.add(skirt);
    // still give hidden legs for a subtle stride
    for (const x of [-0.1, 0.1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.15), skinMat); l.position.set(x, 0.25, 0); g.add(l); legs.push(l); }
  } else {
    for (const x of [-0.11, 0.11]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.15, d.dhoti ? 0.62 : 0.86, 0.17), d.dhoti ? mat(d.skin, 0.9) : legMat);
      l.position.set(x, (d.dhoti ? 0.62 : 0.86) / 2, 0); l.geometry.translate(0, (d.dhoti ? 0.31 : 0.43), 0); l.position.y = 0;
      g.add(l); legs.push(l);
    }
    if (d.dhoti) { const dh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.42, 8), legMat); dh.position.y = 0.72; g.add(dh); }
  }

  // torso
  const torsoH = d.child ? 0.42 : 0.56;
  const torsoY = (d.female || d.sadhu) ? 1.02 : 0.86 + torsoH / 2;
  if (d.top === null) {                          // bare torso (fisherman / hot-weather farmer)
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.40, torsoH, 0.24), skinMat);
    t.position.y = torsoY; g.add(t);
  } else if (!d.female) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(d.stout ? 0.52 : 0.42, torsoH, d.stout ? 0.34 : 0.26), mat(d.top ?? 0xf2efe4));
    t.position.y = torsoY; g.add(t);
  } else {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, torsoH + 0.1, 8), mat(d.saree ?? 0xb02020));
    t.position.y = torsoY; g.add(t);
    // saree pallu over one shoulder
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.28), mat(d.saree ?? 0xb02020, 0.8));
    p.position.set(0.16, torsoY, 0.02); p.rotation.z = 0.2; g.add(p);
  }

  // arms
  const armMat = (d.top === null || d.dhoti && d.top == null) ? skinMat : mat(d.female ? (d.saree ?? 0xb02020) : (d.top ?? d.skin), 0.85);
  const shoulderY = torsoY + torsoH / 2 - 0.06;
  for (const x of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.12), d.female ? mat(d.saree ?? 0xb02020) : (d.top === null ? skinMat : armMat));
    a.geometry.translate(0, -0.31, 0);
    a.position.set(x * (d.female ? 0.24 : d.stout ? 0.32 : 0.27), shoulderY, 0);
    g.add(a); arms.push(a);
  }

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), skinMat);
  const headY = torsoY + torsoH / 2 + 0.16;
  head.position.y = headY; head.scale.set(1, 1.15, 1); g.add(head);
  // hair / simple
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1a120a));
  hair.position.y = headY + 0.03; g.add(hair);

  // headwear
  if (d.hat === 'pith') {                         // British sun helmet: white dome + brim
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(d.hatCol ?? 0xf4efe0, 0.6));
    dome.position.y = headY + 0.08; g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 12), mat(d.hatCol ?? 0xf4efe0, 0.6));
    brim.position.y = headY + 0.05; g.add(brim);
  } else if (d.turban) {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 7), mat(d.turban, 0.8));
    t.scale.set(1, 0.72, 1); t.position.y = headY + 0.11; g.add(t);
  } else if (d.pagri) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.06, 6, 12), mat(d.pagri, 0.85));
    t.rotation.x = Math.PI / 2; t.position.y = headY + 0.1; g.add(t);
  } else if (d.cap) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.09, 10), mat(0xf2efe4, 0.8)); // Gandhi cap-ish
    c.position.y = headY + 0.12; g.add(c);
  } else if (d.hat === 'top') {                   // stovepipe top hat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 14), mat(d.hatCol ?? 0x141414, 0.5)); brim.position.y = headY + 0.14; g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.32, 12), mat(d.hatCol ?? 0x141414, 0.5)); crown.position.y = headY + 0.3; g.add(crown);
  } else if (d.hat === 'brim') {                  // wide-brim felt hat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 14), mat(d.hatCol ?? 0x3a2a18, 0.8)); brim.position.y = headY + 0.13; g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.2, 10), mat(d.hatCol ?? 0x3a2a18, 0.8)); crown.position.y = headY + 0.23; g.add(crown);
  } else if (d.hat === 'bonnet') {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(d.bonnetCol ?? 0xf2efe4, 0.85)); b.position.y = headY + 0.06; g.add(b);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12, 1, false, 0, Math.PI), mat(d.bonnetCol ?? 0xf2efe4, 0.85)); brim.position.set(0, headY + 0.07, 0.08); g.add(brim);
  } else if (d.headwrap) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 7), mat(d.headwrap, 0.9)); w.scale.set(1, 0.7, 1); w.position.y = headY + 0.09; g.add(w);
  } else if (d.hat === 'ballcap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(d.hatCol ?? 0xe0121a, 0.8)); dome.position.y = headY + 0.06; g.add(dome);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.2), mat(d.hatCol ?? 0xe0121a, 0.8)); brim.position.set(0, headY + 0.07, 0.18); g.add(brim);
  } else if (d.hat === 'hardhat') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(d.hatCol ?? 0xffd23d, 0.5)); dome.position.y = headY + 0.07; g.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), mat(d.hatCol ?? 0xffd23d, 0.5)); brim.position.y = headY + 0.06; g.add(brim);
  }

  // hi-vis / tactical vest over the torso (ground crew, police)
  if (d.vest) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.46, torsoH * 0.8, 0.3), mat(d.vest, 0.6));
    v.position.y = torsoY - 0.02; g.add(v);
  }
  // lanyard / scarf at the neck (staff)
  if (d.lanyard) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.02), mat(d.lanyard, 0.5));
    l.position.set(0.06, torsoY + 0.02, 0.13); g.add(l);
  }
  if (d.scarf) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 10), mat(d.scarf, 0.6));
    s.rotation.x = Math.PI / 2; s.position.y = headY - 0.14; g.add(s);
  }
  if (d.epaulet) {
    for (const x of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.12), mat(0x14161c, 0.4)); e.position.set(x * 0.2, shoulderY + 0.02, 0); g.add(e); }
  }
  // wheeled cabin bag pulled alongside (travellers, crew)
  if (d.roller) {
    const bag = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.52, 0.22), mat([0x1a1a2a, 0x2a2a3a, 0x6a1020, 0x14304a, 0x333][(Math.random() * 5) | 0], 0.6));
    body.position.y = 0.42; bag.add(body);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.03), mat(0x222, 0.4)); handle.position.y = 0.86; bag.add(handle);
    bag.position.set(0.34, 0, 0.06); g.add(bag);
  }
  // backpack on the back
  if (d.pack) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.2), mat([0x2a2a3a, 0x1a3a6a, 0x6a2a2a, 0x2a5a3a][(Math.abs(d.skin | 0) % 4)], 0.7));
    p.position.set(0, torsoY, -0.2); g.add(p);
  }
  // ear defenders (ramp crew) — reuse a dark band on the head
  if (d.hat === 'ear') {
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 6, 12), mat(0x1a1a1a, 0.5)); b.rotation.z = Math.PI / 2; b.position.y = headY + 0.02; g.add(b);
  }
  // peaked officer/pilot cap
  if (d.hat === 'peaked') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.14, 12), mat(d.hatCol ?? 0x14161c, 0.5)); crown.position.y = headY + 0.14; g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 12), mat(0x0a0c10, 0.4)); band.position.y = headY + 0.08; g.add(band);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.16), mat(0x0a0c10, 0.4)); brim.position.set(0, headY + 0.07, 0.16); g.add(brim);
  }

  // rifle for soldiers (slung across back / held)
  if (d.rifle) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.1), mat(0x2a1a10, 0.6));
    r.position.set(0.24, shoulderY - 0.05, 0.0); r.rotation.x = 0.5; g.add(r);
  }
  // spear + shield for Mughal soldiers
  if (d.spear) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), mat(0x5a3a1a));
    sp.position.set(0.26, shoulderY - 0.3, 0.1); g.add(sp);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), mat(0xcfd2d8, 0.4)); tip.position.set(0.26, shoulderY + 0.95, 0.1); g.add(tip);
    const shield = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), mat(0x6a4a2a, 0.6)); shield.position.set(-0.26, shoulderY - 0.2, 0.14); g.add(shield);
  }
  // a stick / cane held at the side (overseer)
  if (d.stick) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.1, 6), mat(0x3a2414, 0.7));
    st.position.set(0.28, shoulderY - 0.5, 0.12); g.add(st);
  }
  // sash across the torso (nobles)
  if (d.sash) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), mat(d.sash, 0.7));
    s.position.set(0, torsoY, 0.02); s.rotation.z = 0.5; g.add(s);
  }

  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legs, arms, h: 1.8 * scale };
}

// A crowd of wandering/idling villagers confined to the map's walkable area.
// `groups` is [{ role, count, x, z, spread, idle }] describing where each kind
// clusters (so caste tolas, the bazaar crowd, soldier patrols etc. read right).
export class Villagers {
  constructor(scene, region, groundHeight, groups, seed = 71) {
    this.region = region;
    this.groundHeight = groundHeight;
    this.people = [];
    const rnd = rng(seed);
    for (const grp of groups) {
      for (let i = 0; i < grp.count; i++) {
        const d = dressFor(grp.role, rnd, grp.region || region);
        const h = buildHuman(d);
        const spread = grp.spread ?? 30;
        const ox = grp.x + (rnd() - 0.5) * 2 * spread;
        const oz = grp.z + (rnd() - 0.5) * 2 * spread;
        const idle = rnd() < (grp.idle ?? 0.45);
        // dense megacity crowds (Rio favela, Newark airport) pack hundreds of
        // people in — skip their shadow casting so the crowd stays cheap
        if (region === 'rio' || region === 'newark' || region === 'delhislum') h.group.traverse(o => { if (o.isMesh) o.castShadow = false; });
        scene.add(h.group);
        this.people.push({
          ...h, role: grp.role,
          x: ox, z: oz, homeX: grp.x, homeZ: grp.z, spread,
          heading: rnd() * Math.PI * 2, speed: idle ? 0 : (grp.role === 'child' ? 1.5 : 1.0) * (0.6 + rnd() * 0.7),
          idle, phase: rnd() * Math.PI * 2, restT: rnd() * 4,
          squat: idle && rnd() < 0.4 && grp.role !== 'british',
        });
      }
    }
  }

  update(dt, playerPos) {
    for (const p of this.people) {
      // wander: occasionally retarget toward home cluster with some jitter
      if (!p.idle) {
        p.restT -= dt;
        if (p.restT <= 0) {
          p.restT = 2 + Math.random() * 5;
          // steer back if strayed past the cluster spread, else random turn
          const dh = Math.atan2(p.homeZ - p.z, p.homeX - p.x);
          const far = Math.hypot(p.x - p.homeX, p.z - p.homeZ) > p.spread;
          p.heading = far ? dh + (Math.random() - 0.5) * 0.8 : Math.random() * Math.PI * 2;
          p.speed = (p.role === 'child' ? 1.5 : 1.0) * (0.5 + Math.random() * 0.8);
          if (Math.random() < 0.3) p.speed = 0; // pause
        }
        p.x += Math.cos(p.heading) * p.speed * dt;
        p.z += Math.sin(p.heading) * p.speed * dt;
        p.phase += dt * (4 + p.speed * 2);
      }
      const gy = this.groundHeight(p.x, p.z);
      p.group.position.set(p.x, gy, p.z);
      p.group.rotation.y = -p.heading + Math.PI / 2;
      // leg/arm swing while moving; squat when resting
      if (p.speed > 0.05 && !p.idle) {
        const s = Math.sin(p.phase) * 0.5;
        if (p.legs[0]) { p.legs[0].rotation.x = s; p.legs[1].rotation.x = -s; }
        if (p.arms[0]) { p.arms[0].rotation.x = -s * 0.8; p.arms[1].rotation.x = s * 0.8; }
        p.group.position.y = gy + Math.abs(Math.sin(p.phase)) * 0.03;
      } else if (p.squat) {
        p.group.position.y = gy - 0.34; // hunkered down
      } else {
        if (p.legs[0]) { p.legs[0].rotation.x = 0; p.legs[1].rotation.x = 0; }
        if (p.arms[0]) { p.arms[0].rotation.x = 0; p.arms[1].rotation.x = 0; }
      }
    }
  }
}

export { buildHuman, dressFor };
