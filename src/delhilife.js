import * as THREE from 'three';
import { buildHuman } from './villagers.js';

// ---------------------------------------------------------------------------
// "Ek Din Delhi Mein" — a daily-life layer over the Delhi-slum map.
// You are RUMAL, a labourer from Rajasthan, now a security guard in the city
// centre. Your wife NANDINI (also from Rajasthan) works as a maid; you have a
// young daughter. You live in a jhuggi in Yamuna Khadar with ₹1,00,000 saved.
// Each day: take the Metro to work, get through a shift and whatever the city
// throws at you, come home, feed the family, and try to get ahead — buy a
// scooter, a car, better clothes, a better job. Progress persists (localStorage).
// ---------------------------------------------------------------------------

const SAVE_KEY = 'delhilife.rumal.v1';
const ADDRESS = 'Jhuggi No. 7, Gali No. 4, Yamuna Khadar, Delhi';

function inr(n) {
  n = Math.round(n); const neg = n < 0; let s = String(Math.abs(n));
  let last3 = s.slice(-3), rest = s.slice(0, -3);
  if (rest) rest = rest.replace(/\B(?=(\d\d)+(?!\d))/g, ',') + ',';
  return (neg ? '−' : '') + '₹' + rest + last3;
}

const JOBS = {
  guard:      { title: 'Security Guard · City Centre', pay: 500 },
  supervisor: { title: 'Mall Security Supervisor',      pay: 850 },
  driver:     { title: 'App Cab Driver',                pay: 1000, needs: 'car' },
  factory:    { title: 'Factory Line Worker · Okhla',   pay: 650 },
  guard2:     { title: 'Head Guard · DLF Towers',       pay: 1200 },
};

// costs / income knobs
const WIFE_PAY = 320, FOOD_COST = 300, FOOD_DAYS = 3, CLOTHES_COST = 900;
const SCOOTER_COST = 55000, CAR_COST = 285000, RENT = 1500, SCHOOL = 250;

// --- daily storylines. Single-outcome events have {apply}; choice events have
//     a:{}/b:{} branches. apply(s) mutates state and returns a result line. ---
const WORK_EVENTS = [
  { t: 'A drunk man is shoving people at the mall gate.', choice: true,
    a: { label: 'Throw him out firmly', apply: s => { s.money += 300; return 'The manager slips you ₹300 baksheesh. +₹300'; } },
    b: { label: 'Let him off quietly', apply: s => { s.happy += 2; return 'No trouble today. You keep the peace.'; } } },
  { t: 'You catch a pickpocket lifting a wallet on your watch.', choice: true,
    a: { label: 'Detain him, call police', apply: s => { s.money += 600; return 'The shopkeeper rewards you ₹600. +₹600'; } },
    b: { label: 'Just scare him off', apply: s => { return 'He runs. Quiet end to the shift.'; } } },
  { t: 'Your supervisor says you were late this morning.', apply: s => { s.money -= 100; return 'Half-hour pay cut. −₹100'; } },
  { t: 'A regular customer tips you for helping with bags.', apply: s => { s.money += 150; return '+₹150 tip.'; } },
  { t: 'The boss praises your record this week.', apply: s => { s.money += 250; s.happy += 3; return 'Small bonus. +₹250'; } },
  { t: 'Long, dull shift in the Delhi heat. Nothing happens.', apply: s => { return 'You clock out, drenched in sweat.'; } },
  { t: 'A VIP visit means a double shift.', choice: true,
    a: { label: 'Take the overtime', apply: s => { s.money += 400; s.happy -= 4; return 'Exhausting, but +₹400.'; } },
    b: { label: 'Go home on time', apply: s => { return 'You head home to Nandini and the girl.'; } } },
  { t: 'Fire alarm false-triggers; you manage the crowd well.', apply: s => { s.money += 200; return 'Management notes it. +₹200'; } },
];
const HOME_EVENTS = [
  { t: 'Your daughter has a fever.', choice: true,
    a: { label: 'Take her to the clinic (₹800)', apply: s => { s.money -= 800; s.happy += 6; return 'She rests and recovers. −₹800'; } },
    b: { label: 'Wait and hope it passes', apply: s => { s.happy -= 14; return 'A rough, worried night. Family unhappy.'; } } },
  { t: 'The landlord comes for extra "maintenance".', choice: true,
    a: { label: 'Pay ₹500', apply: s => { s.money -= 500; return 'He leaves satisfied. −₹500'; } },
    b: { label: 'Argue it down', apply: s => { s.happy -= 5; return 'Tense words, but you keep the money.'; } } },
  { t: 'Nandini picked up an extra kothi (house) to clean.', apply: s => { s.money += 400; s.happy += 3; return 'Extra maid work. +₹400'; } },
  { t: 'The water tanker skipped your gali today.', apply: s => { s.happy -= 6; return 'A dry, difficult evening.'; } },
  { t: 'Diwali is here — the girl wants sweets and a diya.', choice: true,
    a: { label: 'Celebrate properly (₹1000)', apply: s => { s.money -= 1000; s.happy += 15; return 'The jhuggi glows. Family very happy! −₹1000'; } },
    b: { label: 'Keep it simple', apply: s => { s.happy -= 6; return 'A quiet Diwali. The girl is a little sad.'; } } },
  { t: 'A neighbour repays an old loan.', apply: s => { s.money += 600; return '+₹600 returned.'; } },
  { t: 'Ration shop had subsidised atta and rice.', apply: s => { s.food += 2; s.money -= 120; return 'Stocked up cheap. +2 days food, −₹120'; } },
  { t: 'Your daughter came first in a class test.', apply: s => { s.happy += 10; return 'You are proud. Family happy!'; } },
  { t: 'Someone tried to break into the jhuggi.', choice: true,
    a: { label: 'Buy a better lock (₹250)', apply: s => { s.money -= 250; return 'Safer now. −₹250'; } },
    b: { label: 'Ignore it', apply: s => { s.happy -= 8; return 'Nandini worries all night.'; } } },
];

export class DelhiLife {
  constructor(scene, ctx = {}) {
    this.scene = scene; this.gh = ctx.gh || (() => 0);
    this.s = this._load();
    this._modal = null; this._prompt = null; this._fDown = false; this._gDown = false;
    this._acc = 0; this._flash = '';  this._flashT = 0;
    this._buildUI();
    this._buildMarkers();
    addEventListener('keydown', e => {
      if (e.code === 'KeyF') this._fDown = true;
      if (e.code === 'KeyG') this._gDown = true;
    });
    this._renderStats();
  }

  get busy() { return !!this._modal; }

  _load() {
    try { const j = JSON.parse(localStorage.getItem(SAVE_KEY)); if (j && j.day) return j; } catch (e) {}
    return { day: 1, money: 100000, food: 3, happy: 70, jobId: 'guard',
      scooter: false, car: false, clothes: false, phase: 'toWork', workedToday: false };
  }
  _save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) {} }

  // --- world markers you walk up to (home, work, shops, dealer, job centre) ---
  get locations() {
    return [
      { id: 'home', x: -40, z: -120, r: 13 },
      { id: 'work', x: 200, z: 650, r: 15 },
      { id: 'food_basti', x: -90, z: 40, r: 11 },
      { id: 'food_cc', x: 70, z: 566, r: 12 },
      { id: 'clothes', x: -300, z: 566, r: 12 },
      { id: 'dealer', x: -250, z: 640, r: 15 },
      { id: 'jobs', x: 150, z: 520, r: 13 },
    ];
  }
  _sign(x, z, text, col, sub) {
    const g = new THREE.Group(); const gy = this.gh(x, z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5, 6), new THREE.MeshStandardMaterial({ color: 0x555, roughness: 0.8 }));
    post.position.y = 2.5; g.add(post);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = sub ? 96 : 64; const c = cv.getContext('2d');
    c.fillStyle = '#' + col.toString(16).padStart(6, '0'); c.fillRect(0, 0, 256, cv.height);
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 30px Arial'; c.fillText(text, 128, sub ? 36 : 40);
    if (sub) { c.font = '18px Arial'; c.fillText(sub, 128, 70); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(4.6, sub ? 1.7 : 1.15), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
    panel.position.y = 5.4; g.add(panel);
    g.position.set(x, gy, z); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.scene.add(g);
  }
  _buildMarkers() {
    this._sign(-40, -120, 'GHAR', 0x1a3a8c, 'Rumal · Jhuggi 7');            // home
    this._sign(200, 650, 'SECURITY POST', 0x1a5a2a, 'Duty Point');           // work
    this._sign(-90, 40, 'KIRANA', 0x1a7a3f, 'Ration · Groceries');           // basti food
    this._sign(70, 566, 'BIG BAZAAR', 0xe0121a, 'Groceries');                // cc food
    this._sign(-300, 566, 'VASTRA · CLOTHES', 0x8a1f6b, 'Kapde');            // clothes
    this._sign(-250, 640, 'HERO · MARUTI', 0x1a3a8c, 'Scooters · Cars');     // dealer
    this._sign(150, 520, 'ROZGAR KENDRA', 0xd0902a, 'Naukri / Jobs');        // job centre
    // Nandini + daughter waiting at home
    const nandini = buildHuman({ skin: 0x9a6a3a, female: true, saree: 0xc21f2f, headwrap: 0xd0306a });
    nandini.group.position.set(-38, this.gh(-38, -116), -116); this.scene.add(nandini.group);
    const beti = buildHuman({ skin: 0x9a6a3a, top: 0xffd23d, bottom: 0x903070, child: true });
    beti.group.position.set(-42, this.gh(-42, -117), -117); this.scene.add(beti.group);
  }

  // --- UI ---
  _buildUI() {
    const mk = (css) => { const d = document.createElement('div'); d.style.cssText = css; document.body.appendChild(d); return d; };
    this.$stats = mk('position:fixed;left:14px;top:14px;font:600 13px system-ui,Arial;color:#fff;background:linear-gradient(180deg,rgba(20,20,32,.86),rgba(20,20,32,.72));padding:11px 14px;border-radius:12px;z-index:60;line-height:1.5;min-width:210px;box-shadow:0 3px 16px rgba(0,0,0,.45)');
    this.$obj = mk('position:fixed;left:14px;top:170px;font:600 13px system-ui,Arial;color:#ffe6a0;background:rgba(30,24,10,.82);padding:8px 13px;border-radius:10px;z-index:60;max-width:260px;box-shadow:0 2px 10px rgba(0,0,0,.4)');
    this.$prompt = mk('position:fixed;left:50%;bottom:150px;transform:translateX(-50%);font:600 16px system-ui,Arial;color:#fff;background:rgba(10,20,40,.78);padding:9px 18px;border-radius:10px;z-index:55;display:none;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.4)');
    this.$modal = mk('position:fixed;left:50%;top:46%;transform:translate(-50%,-50%);font:500 16px system-ui,Arial;color:#fff;background:rgba(14,16,26,.95);padding:20px 24px;border-radius:14px;z-index:70;display:none;text-align:center;max-width:440px;box-shadow:0 8px 40px rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.1)');
  }
  _renderStats() {
    const s = this.s, job = JOBS[s.jobId];
    const mood = s.happy >= 75 ? '😊 Happy' : s.happy >= 45 ? '🙂 Getting by' : s.happy >= 20 ? '😟 Struggling' : '😣 Desperate';
    const ride = s.car ? '🚗 Car' : s.scooter ? '🛵 Scooter' : '🚶 On foot';
    this.$stats.innerHTML =
      `<div style="font-size:15px;font-weight:800">RUMAL <span style="opacity:.6;font-weight:600">· Rajasthan → Delhi</span></div>` +
      `<div style="opacity:.7;font-size:11px;margin-bottom:5px">${ADDRESS}</div>` +
      `<div>💰 <b>${inr(s.money)}</b></div>` +
      `<div>📅 Day <b>${s.day}</b> &nbsp; 🍚 Food <b>${s.food}d</b> &nbsp; ${ride}</div>` +
      `<div>👷 ${job.title}</div>` +
      `<div>👨‍👩‍👧 Nandini + beti · ${mood} (${Math.round(s.happy)})</div>` +
      (this._flashT > 0 ? `<div style="margin-top:5px;color:#8fe0a0">${this._flash}</div>` : '');
  }
  _objective() {
    const s = this.s;
    if (s.phase === 'toWork') return `🎯 Day ${s.day}: get to your <b>Security Post</b> in the City Centre — take the <b>Metro</b> from the basti station.`;
    return `🎯 Shift done. Head <b>home</b> to Yamuna Khadar (Metro back), buy food if low, and <b>rest</b> to end the day.`;
  }
  _flashMsg(m) { this._flash = m; this._flashT = 6; }

  _openModal(ev) {
    this._modal = ev;
    if (ev.choice) this.$modal.innerHTML = `<div style="font-size:17px;margin-bottom:14px">${ev.t}</div>` +
      `<div style="display:flex;gap:10px;justify-content:center"><div style="background:#1a5a2a;padding:8px 12px;border-radius:8px">[F] ${ev.a.label}</div><div style="background:#6a1030;padding:8px 12px;border-radius:8px">[G] ${ev.b.label}</div></div>`;
    else this.$modal.innerHTML = `<div style="font-size:17px;margin-bottom:12px">${ev.t}</div><div style="opacity:.8">[F] Continue</div>`;
    this.$modal.style.display = 'block';
  }
  _closeModal() { this._modal = null; this.$modal.style.display = 'none'; }

  // --- daily transitions ---
  _startShift() {
    if (this.s.workedToday) return;
    const job = JOBS[this.s.jobId];
    this.s.workedToday = true; this.s.money += job.pay; this.s.phase = 'toHome';
    this._flashMsg(`Shift pay +${inr(job.pay)}`);
    this._openModal(WORK_EVENTS[Math.floor(Math.random() * WORK_EVENTS.length)]);
    this._save();
  }
  _rest() {
    const s = this.s;
    s.money += WIFE_PAY;                                   // Nandini's maid income
    if (s.food > 0) { s.food -= 1; s.happy += 2; } else { s.happy -= 16; this._flashMsg('No food — hungry night!'); }
    let extra = '';
    if (s.day % 7 === 0) { s.money -= RENT + SCHOOL; extra = ` Rent + school −${inr(RENT + SCHOOL)}.`; }
    s.happy = Math.max(0, Math.min(100, s.happy));
    s.day += 1; s.workedToday = false; s.phase = 'toWork';
    this._save();
    // a home storyline most nights
    if (Math.random() < 0.8) { const ev = HOME_EVENTS[Math.floor(Math.random() * HOME_EVENTS.length)]; ev._extra = extra; this._openModal(ev); }
    else this._openModal({ t: `You rest. Nandini's work brought +${inr(WIFE_PAY)}.${extra}`, apply: () => {} });
  }
  _buy(kind) {
    const s = this.s;
    if (kind === 'food') { if (s.money < FOOD_COST) return this._flashMsg('Not enough money for groceries.'); s.money -= FOOD_COST; s.food += FOOD_DAYS; this._flashMsg(`Groceries +${FOOD_DAYS} days food`); }
    if (kind === 'clothes') { if (s.money < CLOTHES_COST) return this._flashMsg('Cannot afford clothes.'); s.money -= CLOTHES_COST; s.clothes = true; s.happy = Math.min(100, s.happy + 8); this._flashMsg('New clothes — family happy!'); }
    if (kind === 'scooter') { if (s.scooter) return this._flashMsg('You already own a scooter.'); if (s.money < SCOOTER_COST) return this._flashMsg('Save more for a scooter.'); s.money -= SCOOTER_COST; s.scooter = true; s.happy = Math.min(100, s.happy + 10); this._flashMsg('🛵 Bought a Hero scooter!'); }
    if (kind === 'car') { if (s.car) return this._flashMsg('You already own a car.'); if (s.money < CAR_COST) return this._flashMsg('A car is still out of reach.'); s.money -= CAR_COST; s.car = true; s.happy = Math.min(100, s.happy + 14); this._flashMsg('🚗 Bought a Maruti — big day!'); }
    this._save();
  }
  _lookForJob() {
    const s = this.s;
    const pool = Object.keys(JOBS).filter(k => k !== s.jobId && (!JOBS[k].needs || s[JOBS[k].needs]));
    if (!pool.length) return this._openModal({ t: 'No better openings today. Come back tomorrow.', apply: () => {} });
    const offId = pool[Math.floor(Math.random() * pool.length)], off = JOBS[offId];
    this._openModal({ t: `Opening: ${off.title} — pays ${inr(off.pay)}/day. Take it?`, choice: true,
      a: { label: 'Take the job', apply: st => { st.jobId = offId; return `You are now: ${off.title}.`; } },
      b: { label: 'Stay put', apply: () => 'You keep your current job.' } });
  }

  // --- per-frame ---
  update(dt, pos, riding) {
    this._flashT = Math.max(0, this._flashT - dt);

    // modal has priority — consume F/G
    if (this._modal) {
      this.$prompt.style.display = 'none';
      const ev = this._modal;
      if (ev.choice) {
        if (this._fDown || this._gDown) {
          const pick = this._fDown ? ev.a : ev.b;
          const note = pick.apply(this.s) || '';
          this._closeModal(); if (note) this._flashMsg(note); this.s.happy = Math.max(0, Math.min(100, this.s.happy)); this._save();
        }
      } else if (this._fDown) {
        if (ev.apply) ev.apply(this.s);
        const ex = ev._extra || ''; this._closeModal(); if (ex) this._flashMsg(ex.trim());
      }
      this._fDown = this._gDown = false; this._acc += dt; if (this._acc > 0.2) { this._acc = 0; this._renderStats(); }
      return;
    }

    this.$obj.innerHTML = this._objective();

    if (riding) { this.$prompt.style.display = 'none'; this._fDown = this._gDown = false; this._acc += dt; if (this._acc > 0.25) { this._acc = 0; this._renderStats(); } return; }

    // nearest interactable
    let here = null, bd = 1e9;
    for (const L of this.locations) { const d = Math.hypot(pos.x - L.x, pos.z - L.z); if (d < L.r && d < bd) { bd = d; here = L; } }
    const s = this.s;
    let text = '', act = null;
    if (here) {
      if (here.id === 'work') {
        if (s.phase === 'toWork') { text = `🛡 <b>Start your security shift</b> — press <b>F</b>`; act = () => this._startShift(); }
        else text = `🛡 Shift done for today. Head home and rest.`;
      } else if (here.id === 'home') {
        if (s.phase === 'toHome') { text = `🏠 <b>Rest for the night</b> (end day) — press <b>F</b>`; act = () => this._rest(); }
        else text = `🏠 Home. Nandini's waiting — but you have a shift to get to.`;
      } else if (here.id === 'food_basti' || here.id === 'food_cc') { text = `🛒 <b>Buy groceries</b> ${inr(FOOD_COST)} (+${FOOD_DAYS}d food) — <b>F</b>`; act = () => this._buy('food'); }
      else if (here.id === 'clothes') { text = `👕 <b>Buy new clothes</b> ${inr(CLOTHES_COST)} — <b>F</b>`; act = () => this._buy('clothes'); }
      else if (here.id === 'dealer') { text = `🛵 <b>F</b>: Scooter ${inr(SCOOTER_COST)} &nbsp; | &nbsp; 🚗 <b>G</b>: Car ${inr(CAR_COST)}`; act = () => this._buy('scooter'); this._altG = () => this._buy('car'); }
      else if (here.id === 'jobs') { text = `💼 <b>Look for a better job</b> — press <b>F</b>`; act = () => this._lookForJob(); }
    }
    if (here && here.id !== 'dealer') this._altG = null;

    if (text) { this.$prompt.innerHTML = text; this.$prompt.style.display = 'block'; } else { this.$prompt.style.display = 'none'; }
    if (this._fDown && act) act();
    if (this._gDown && this._altG) this._altG();
    this._fDown = this._gDown = false;

    this._acc += dt; if (this._acc > 0.2) { this._acc = 0; this._renderStats(); }
  }
}
