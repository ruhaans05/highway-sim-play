import * as THREE from 'three';
import { MAP } from './config.js';

// ---------------------------------------------------------------------------
// Sky dome + image-based lighting.
//
// A camera-following shader dome replaces the flat scene.background color:
// zenith→horizon gradient, a real sun disc with warm forward scatter, a faint
// moon, and the lightning flash. The same material renders into a tiny
// environment scene that PMREM-filters into an env map, so car paint, glass
// and the wet road reflect the actual sky as it changes through the day.
// ---------------------------------------------------------------------------

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const SKY_FRAG = /* glsl */`
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunCol;
  uniform float uSunI;      // sun disc/glow visibility (weather-dimmed)
  uniform float uCityGlow;  // route-specific artificial horizon light pollution
  uniform float uNight;     // 0 day .. 1 night
  uniform float uMoonI;     // route-specific moon visibility
  uniform float uFlash;     // lightning
  varying vec3 vDir;

  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    // gradient: zenith high up, horizon color pooling low; below the horizon
    // hold the horizon tone and darken so the ground plane never shows a seam
    float t = pow(1.0 - clamp(y, 0.0, 1.0), 2.4);
    vec3 col = mix(uZenith, uHorizon, t);
    if (y < 0.0) col = uHorizon * (1.0 + y * 0.7);

    float cosA = dot(d, uSunDir);
    // Restrained sun disc/glow: keep the sun readable without creating a
    // blown-out HDR hotspot that blooms across the whole driving view.
    float disc = smoothstep(0.99955, 0.99987, cosA);
    float glow = pow(clamp(cosA, 0.0, 1.0), 160.0) * 0.22
               + pow(clamp(cosA, 0.0, 1.0), 7.0) * 0.055 * (0.4 + t);
    col += uSunCol * (disc * 0.75 + glow) * min(uSunI, 0.72);

    // faint moon opposite the sun at night
    float moon = smoothstep(0.99992, 0.999975, dot(d, -uSunDir));
    col += vec3(0.68, 0.74, 0.88) * moon * uNight * 0.42 * uMoonI;

    // city light pollution: a faint warm rim right at the horizon, not a wash
    // over the whole night sky — the actual streetlights/signage do the
    // heavy lifting for "lit up at night", this is just the skyglow they'd
    // throw a mile off
    col += vec3(0.30, 0.22, 0.11) * pow(1.0 - clamp(y, 0.0, 1.0), 11.0) * uNight * 0.14 * uCityGlow;

    col = mix(col, vec3(0.87, 0.90, 0.97), uFlash);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function buildSky(scene, registry) {
  const uniforms = {
    uZenith: { value: new THREE.Color(0x7fb2e5) },
    uHorizon: { value: new THREE.Color(0xb9cdd9) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(0xfff2d8) },
    uSunI: { value: 1 },
    // I-95's dense urban corridor otherwise reads as a large orange disk on
    // the horizon at night; roadway/city emissives still provide night light.
    uCityGlow: { value: MAP === 'i95' ? 0 : 1 },
    uNight: { value: 0 },
    // On I-80 the old large bright moon was easily mistaken for a sun still
    // shining at night. Keep only a restrained cool lunar point there.
    uMoonI: { value: MAP === 'i80' ? 0.35 : 1 },
    uFlash: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 20), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -100;
  scene.add(dome);

  registry.skyDome = dome;
  registry.skyUniforms = uniforms;
  registry.skyColor = new THREE.Color(0x7fb2e5); // current sky tint (sRGB) for clouds etc.

  // tiny scene PMREM-filtered into the shared environment map
  registry._envScene = new THREE.Scene();
  registry._envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), mat));
}

// Feed the dome the frame's sky state (colors arrive in sRGB — the same values
// that used to go straight to scene.background — and are linearized here).
const _lin = new THREE.Color();
export function setSkyState(registry, playerPos, sky, fog, sunPos, sunCol, sunI, night) {
  const u = registry.skyUniforms;
  if (!u) return;
  registry.skyDome.position.copy(playerPos);
  u.uZenith.value.copy(_lin.copy(sky).convertSRGBToLinear());
  u.uHorizon.value.copy(_lin.copy(fog).convertSRGBToLinear());
  u.uSunDir.value.copy(sunPos).sub(playerPos).normalize();
  u.uSunCol.value.copy(_lin.copy(sunCol).convertSRGBToLinear());
  // Hard safety gate: no residual shader disc/glow is allowed after the
  // lighting model has classified the scene as night. This also prevents a
  // stale sun uniform from surviving a fast time/month scrub.
  u.uSunI.value = night >= 0.5 ? 0 : sunI;
  u.uNight.value = night;
  u.uFlash.value = 0;                 // main.js re-raises it while lightning is live
  registry.skyColor.copy(sky);
}

// ---------------------------------------------------------------------------
// Shared environment map: shiny materials opt in (car paint, glass, rails,
// wet asphalt) so scene lighting balance stays untouched elsewhere.
// ---------------------------------------------------------------------------
const envMats = new Set();
export function registerEnvMaterial(m) {
  envMats.add(m);
  if (_envTex) { m.envMap = _envTex; m.needsUpdate = true; }
  return m;
}

let _pmrem = null, _envRT = null, _envTex = null;
let _lastKey = null, _lastTime = -1e9;

// Rebuild the PMREM env map when the sky has actually changed (throttled).
export function maybeUpdateEnvMap(renderer, registry, simTime) {
  const u = registry.skyUniforms;
  if (!u) return;
  if (simTime - _lastTime < 1.0) return;   // at most 1 rebuild/second
  const z = u.uZenith.value, h = u.uHorizon.value, sd = u.uSunDir.value;
  const key = `${(z.r * 40) | 0}|${(z.g * 40) | 0}|${(z.b * 40) | 0}|${(h.r * 40) | 0}|${(h.g * 40) | 0}|` +
    `${(sd.y * 24) | 0}|${(u.uSunI.value * 12) | 0}|${(u.uNight.value * 16) | 0}`;
  if (key === _lastKey) return;
  _lastKey = key;
  _lastTime = simTime;

  if (!_pmrem) _pmrem = new THREE.PMREMGenerator(renderer);
  const flash = u.uFlash.value;
  u.uFlash.value = 0;                      // never bake lightning into reflections
  const rt = _pmrem.fromScene(registry._envScene, 0.03);
  u.uFlash.value = flash;
  if (_envRT) _envRT.dispose();
  _envRT = rt;
  _envTex = rt.texture;
  for (const m of envMats) {
    const first = !m.envMap;
    m.envMap = _envTex;
    if (first) m.needsUpdate = true;
  }
}
