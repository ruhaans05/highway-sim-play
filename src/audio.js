// Synthesized traffic sound — no assets, pure WebAudio.
// Browsers require a user gesture before audio starts; call initAudio() from
// any key/click handler.

let ctx = null;
let master = null;
let drive = null;   // shared soft-saturation for horn voices
const AUDIO_ENABLED = false;

export function initAudio() {
  if (!AUDIO_ENABLED) return;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.11;
    master.connect(ctx.destination);
    // gentle tanh drive: takes the digital edge off every synthesized source
    drive = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      const x = (i / 255.5) - 1;
      curve[i] = Math.tanh(x * 1.6);
    }
    drive.curve = curve;
    drive.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function audioReady() {
  return AUDIO_ENABLED && !!ctx && ctx.state === 'running';
}

function noiseBuffer(seconds = 2, brown = false) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  return buf;
}

// one horn voice: detuned saw pair + upper partial, driven through a resonant
// "horn body" formant so it honks instead of beeping
function hornVoice(t, dur, base, vol, pan01, opts = {}) {
  const g = ctx.createGain();
  const pan = ctx.createStereoPanner();
  pan.pan.value = pan01;
  // horn-body resonance: a bandpass formant + presence peak
  const body = ctx.createBiquadFilter();
  body.type = 'bandpass';
  body.frequency.value = opts.formant ?? (900 + Math.random() * 500);
  body.Q.value = 1.4;
  const pres = ctx.createBiquadFilter();
  pres.type = 'peaking';
  pres.frequency.value = 2 * body.frequency.value;
  pres.Q.value = 1.2;
  pres.gain.value = 7;
  g.connect(body); body.connect(pres); pres.connect(pan); pan.connect(drive);

  // pressed-bulb envelope: fast attack, slight settle, release with a tail
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.018);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * 0.8), t + Math.max(0.04, dur * 0.7));
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06);

  const freqs = opts.chord ?? [base, base * 1.26];   // real horns are two-tone
  for (const f of freqs) {
    for (const det of [-7, 6]) {                     // slow beat between units
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.04, t);       // tiny pitch drop on press
      o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      o.detune.value = det;
      o.connect(g);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
  return g;
}

// kind: 'car' | 'truck' | 'rickshaw'. harsh = the nasal, beating, leaned-on
// everyday-Indian-road horn.
export function honk(kind = 'car', distance01 = 1, harsh = false) {
  if (!audioReady()) return;
  const t = ctx.currentTime;
  const vol = (0.2 + Math.random() * 0.5) * distance01;
  const pan = Math.random() * 1.8 - 0.9;

  if (kind === 'truck') {
    if (harsh && Math.random() < 0.4) {
      // Indian pressure horn: the fast little melody run
      const root = 330 + Math.random() * 90;
      const steps = [0, 4, 7, 4, 0, 4].slice(0, 3 + (Math.random() * 3 | 0));
      steps.forEach((st, i) => {
        hornVoice(t + i * 0.16, 0.15, root * Math.pow(2, st / 12), vol * 0.9, pan,
          { formant: 1300, chord: [root * Math.pow(2, st / 12)] });
      });
    } else {
      // deep air horn
      const base = 195 + Math.random() * 50;
      hornVoice(t, 0.5 + Math.random() * 0.7, base, vol * 1.15, pan,
        { formant: 620, chord: [base, base * 1.335] });
    }
    return;
  }

  const base = kind === 'rickshaw' ? 520 + Math.random() * 180 : 380 + Math.random() * 150;
  const dur = harsh ? 0.12 + Math.random() * 0.28 : 0.15 + Math.random() * 0.3;
  hornVoice(t, dur, base, vol * (harsh ? 1.1 : 1), pan, {
    formant: harsh ? 1500 + Math.random() * 600 : 1000 + Math.random() * 300,
    chord: harsh && kind === 'rickshaw' ? [base] : undefined, // rickshaw = single reedy tone
  });

  // rapid re-blips: city horns get leaned on in bursts (ta-ta, ta-ta-taaa)
  if (Math.random() < (harsh ? 0.6 : 0.3)) {
    const n = 1 + (Math.random() * (harsh ? 2 : 1) | 0);
    for (let i = 1; i <= n; i++) {
      setTimeout(() => honk(kind, distance01 * 0.9, harsh),
        i * (dur * 1000 + 50 + Math.random() * 80));
    }
  }
}

// ---------------------------------------------------------------------------
// Continuous street ambience, crossfaded by where you are and how fast
// you're going: traffic rumble everywhere, wind that rises with speed,
// distant-horn din + crowd murmur + two-stroke putter in Indian cities.
// ---------------------------------------------------------------------------
let amb = null;
function buildAmbience() {
  amb = {};
  // low traffic rumble (brown noise, heavily lowpassed)
  const rumbleSrc = ctx.createBufferSource();
  rumbleSrc.buffer = noiseBuffer(3, true); rumbleSrc.loop = true;
  const rumLp = ctx.createBiquadFilter(); rumLp.type = 'lowpass'; rumLp.frequency.value = 180;
  amb.rumble = ctx.createGain(); amb.rumble.gain.value = 0;
  rumbleSrc.connect(rumLp); rumLp.connect(amb.rumble); amb.rumble.connect(master);
  rumbleSrc.start();

  // wind / road hiss that builds with your speed
  const windSrc = ctx.createBufferSource();
  windSrc.buffer = noiseBuffer(2); windSrc.loop = true;
  amb.windBp = ctx.createBiquadFilter(); amb.windBp.type = 'bandpass';
  amb.windBp.frequency.value = 500; amb.windBp.Q.value = 0.5;
  amb.wind = ctx.createGain(); amb.wind.gain.value = 0;
  windSrc.connect(amb.windBp); amb.windBp.connect(amb.wind); amb.wind.connect(master);
  windSrc.start();

  // distant-horn din (the old blanket, kept)
  const dinSrc = ctx.createBufferSource();
  dinSrc.buffer = noiseBuffer(2); dinSrc.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7;
  const bp2 = ctx.createBiquadFilter(); bp2.type = 'peaking'; bp2.frequency.value = 1400; bp2.Q.value = 0.9; bp2.gain.value = 6;
  amb.din = ctx.createGain(); amb.din.gain.value = 0;
  dinSrc.connect(bp); bp.connect(bp2); bp2.connect(amb.din); amb.din.connect(master);
  dinSrc.start();

  // crowd murmur: noise shaped through voice formants, slowly wobbling
  const crowdSrc = ctx.createBufferSource();
  crowdSrc.buffer = noiseBuffer(4); crowdSrc.loop = true;
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 420; f1.Q.value = 2.2;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 2.6;
  amb.crowd = ctx.createGain(); amb.crowd.gain.value = 0;
  const cMix = ctx.createGain(); cMix.gain.value = 0.6;
  crowdSrc.connect(f1); crowdSrc.connect(f2);
  f1.connect(cMix); f2.connect(cMix); cMix.connect(amb.crowd); amb.crowd.connect(master);
  crowdSrc.start();
  // babble: wobble the murmur so it doesn't sound like a fan
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 140;
  lfo.connect(lfoAmt); lfoAmt.connect(f2.frequency); lfo.start();

  // two-stroke rickshaw putter: pulsing lowpassed square, city-only spice
  const put = ctx.createOscillator(); put.type = 'square'; put.frequency.value = 62;
  const putLp = ctx.createBiquadFilter(); putLp.type = 'lowpass'; putLp.frequency.value = 300;
  const putGate = ctx.createGain(); putGate.gain.value = 0.5;
  const gateLfo = ctx.createOscillator(); gateLfo.type = 'square'; gateLfo.frequency.value = 9;
  const gateAmt = ctx.createGain(); gateAmt.gain.value = 0.45;
  gateLfo.connect(gateAmt); gateAmt.connect(putGate.gain);
  amb.put = ctx.createGain(); amb.put.gain.value = 0;
  put.connect(putLp); putLp.connect(putGate); putGate.connect(amb.put); amb.put.connect(master);
  put.start(); gateLfo.start();
}

// audio must never take the render loop down with it
let ambBroken = false;
function ensureAmb() {
  if (ambBroken || !audioReady()) return false;
  if (!amb) {
    try { buildAmbience(); } catch (e) { ambBroken = true; return false; }
  }
  return true;
}

// din level 0..1 (Indian city blanket honking) — kept for compatibility
export function setHonkDin(level) {
  if (!ensureAmb()) return;
  amb.din.gain.setTargetAtTime(level * 0.14, ctx.currentTime, 0.5);
  amb.crowd.gain.setTargetAtTime(level * 0.10, ctx.currentTime, 0.8);
  amb.put.gain.setTargetAtTime(level * 0.035, ctx.currentTime, 0.8);
}

// speed01: player speed 0..1, densityLevel: how busy the road around you is
export function setAmbience(speed01, densityLevel = 0.4) {
  if (!ensureAmb()) return;
  const t = ctx.currentTime;
  amb.rumble.gain.setTargetAtTime(0.10 + densityLevel * 0.15, t, 0.8);
  amb.wind.gain.setTargetAtTime(speed01 * speed01 * 0.34, t, 0.25);
  amb.windBp.frequency.setTargetAtTime(400 + speed01 * 1400, t, 0.25);
}
