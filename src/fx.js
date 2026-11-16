import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Hand-rolled HDR post pipeline (no examples/jsm in vendor):
//   scene → HDR render target (MSAA) → bright-pass ¼-res → gaussian H/V →
//   composite: bloom + sun lens flare + ACES tone map + grade + vignette +
//   faint grain → screen.
// Rendering into a target skips three's tone mapping/sRGB, so the RT holds
// linear HDR and the composite pass owns the final ACES + sRGB conversion —
// which is what lets headlights, neon and streetlights actually glow.
// ---------------------------------------------------------------------------

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */`
  uniform sampler2D tSrc;
  uniform float uThresh;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(uThresh, uThresh + 0.7, l);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */`
  uniform sampler2D tSrc;
  uniform vec2 uDir;      // texel-scaled blur direction
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 0.227027;
    vec2 o1 = uDir * 1.3846, o2 = uDir * 3.2308;
    c += (texture2D(tSrc, vUv + o1).rgb + texture2D(tSrc, vUv - o1).rgb) * 0.3162162;
    c += (texture2D(tSrc, vUv + o2).rgb + texture2D(tSrc, vUv - o2).rgb) * 0.0702703;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */`
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uExposure;
  uniform float uBloom;
  uniform float uSat;
  uniform float uVig;
  uniform float uGrain;
  uniform float uTime;
  uniform vec2 uSun;       // sun in 0..1 screen space
  uniform float uFlare;    // flare visibility
  uniform float uRays;     // god-ray strength
  uniform float uWarm;     // golden-hour grade
  uniform float uNight;    // night grade (cool shadows, lifted blacks)
  uniform float uSpeed;    // 0..1 → peripheral speed blur
  uniform float uAspect;
  varying vec2 vUv;

  vec3 aces(vec3 color) {
    const mat3 inM = mat3(
      vec3(0.59719, 0.07600, 0.02840),
      vec3(0.35458, 0.90834, 0.13383),
      vec3(0.04823, 0.01566, 0.83777));
    const mat3 outM = mat3(
      vec3( 1.60475, -0.10208, -0.00327),
      vec3(-0.53108,  1.10813, -0.07276),
      vec3(-0.07367, -0.00605,  1.07602));
    color *= uExposure / 0.6;
    color = inM * color;
    color = (color * (color + 0.0245786) - 0.000090537)
          / (color * (0.983729 * color + 0.4329510) + 0.238081);
    return clamp(outM * color, 0.0, 1.0);
  }

  float ghost(vec2 uv, vec2 p, float r) {
    vec2 d = (uv - p) * vec2(uAspect, 1.0);
    return pow(max(0.0, 1.0 - length(d) / r), 2.6);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec3 hdr = texture2D(tScene, vUv).rgb;

    // peripheral speed blur: streak the scene radially away from center as
    // speed builds — center stays sharp, edges smear like real high speed
    float d2 = distance(vUv, vec2(0.5));
    float blurW = uSpeed * smoothstep(0.22, 0.75, d2);
    if (blurW > 0.003) {
      vec2 dir = normalize(vUv - vec2(0.5)) * 0.016 * blurW;
      hdr = hdr * 0.4
          + texture2D(tScene, vUv - dir).rgb * 0.3
          + texture2D(tScene, vUv - dir * 2.2).rgb * 0.2
          + texture2D(tScene, vUv - dir * 3.6).rgb * 0.1;
    }

    hdr += texture2D(tBloom, vUv).rgb * uBloom;

    // crepuscular rays: march the blurred bright buffer toward the sun
    if (uRays > 0.002) {
      vec2 delta = (uSun - vUv) / 14.0;
      vec2 p = vUv;
      float w = 1.0, ray = 0.0;
      for (int i = 0; i < 14; i++) {
        p += delta;
        ray += dot(texture2D(tBloom, p).rgb, vec3(0.333)) * w;
        w *= 0.86;
      }
      hdr += vec3(1.0, 0.9, 0.72) * ray * 0.05 * uRays;
    }

    // Deliberately no lens flare. The real sun, sky haze and road reflections
    // provide enough brightness; synthetic ghosts/streaks wash out the road
    // and can look like a permanent white screen when facing the sun.

    vec3 col = aces(hdr);

    // grade: gentle saturation lift + micro contrast
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, uSat);
    col = clamp(col * 1.02 - 0.01, 0.0, 1.0);

    // golden hour: warm highlights, cool shadows (classic filmic split-tone)
    col *= mix(vec3(1.0), vec3(1.10, 1.0, 0.88), uWarm * smoothstep(0.15, 0.8, lum));
    col *= mix(vec3(1.0), vec3(0.94, 0.96, 1.08), uWarm * (1.0 - smoothstep(0.15, 0.8, lum)));

    // night: scotopic shift — cooler, desaturated shadows, gently lifted blacks
    vec3 nightCol = mix(vec3(lum), col, 0.72) * vec3(0.86, 0.93, 1.14);
    col = mix(col, nightCol, uNight * 0.55);
    col += vec3(0.012, 0.015, 0.022) * uNight;

    // vignette
    col *= 1.0 - uVig * smoothstep(0.42, 0.92, d2);

    // faint animated grain (a touch stronger at night, set from JS)
    col += (hash(vUv * (837.0 + fract(uTime) * 61.0)) - 0.5) * uGrain;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function fsQuad(frag, uniforms) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: frag, uniforms,
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(geo, mat));
  return { scene, mat, camera: new THREE.Camera() };
}

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    const w = 4, h = 4; // real sizes arrive via setSize
    this.rtScene = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: 4, depthBuffer: true,
    });
    const bloomOpts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtA = new THREE.WebGLRenderTarget(w, h, bloomOpts);
    this.rtB = new THREE.WebGLRenderTarget(w, h, bloomOpts);

    this.bright = fsQuad(BRIGHT_FRAG, {
      // Keep daylight sky/road reflections out of the bloom buffer. Emissive
      // signs, headlights, and street lamps still clear this threshold.
      tSrc: { value: null }, uThresh: { value: 1.55 },
    });
    this.blur = fsQuad(BLUR_FRAG, {
      tSrc: { value: null }, uDir: { value: new THREE.Vector2() },
    });
    this.comp = fsQuad(COMPOSITE_FRAG, {
      tScene: { value: null }, tBloom: { value: null },
      // The scene is already lit in HDR; a second strong exposure/bloom pass
      // is what made Northeast sun-facing views wash to white.
      uExposure: { value: 1.0 }, uBloom: { value: 0.34 },
      uSat: { value: 1.12 }, uVig: { value: 0.32 },
      uGrain: { value: 0.006 }, uTime: { value: 0 },
      uSun: { value: new THREE.Vector2(0.5, 0.5) }, uFlare: { value: 0 },
      uRays: { value: 0 }, uWarm: { value: 0 }, uNight: { value: 0 },
      uSpeed: { value: 0 }, uAspect: { value: 1 },
    });
    this._exp = 1.0;
    this.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
  }

  setSize(w, h, pr) {
    const W = Math.floor(w * pr), H = Math.floor(h * pr);
    this.rtScene.setSize(W, H);
    this.rtA.setSize(W >> 2, H >> 2);
    this.rtB.setSize(W >> 2, H >> 2);
    this.blurTexel = new THREE.Vector2(4 / W, 4 / H);
    this.comp.mat.uniforms.uAspect.value = w / h;
  }

  // state: { time, night, sunScreen: Vector2|null, flare: 0..1 }
  render(scene, camera, state) {
    const r = this.renderer;

    r.setRenderTarget(this.rtScene);
    r.render(scene, camera);

    this.bright.mat.uniforms.tSrc.value = this.rtScene.texture;
    r.setRenderTarget(this.rtA);
    r.render(this.bright.scene, this.bright.camera);

    this.blur.mat.uniforms.tSrc.value = this.rtA.texture;
    this.blur.mat.uniforms.uDir.value.set(this.blurTexel.x, 0);
    r.setRenderTarget(this.rtB);
    r.render(this.blur.scene, this.blur.camera);
    this.blur.mat.uniforms.tSrc.value = this.rtB.texture;
    this.blur.mat.uniforms.uDir.value.set(0, this.blurTexel.y);
    r.setRenderTarget(this.rtA);
    r.render(this.blur.scene, this.blur.camera);

    const u = this.comp.mat.uniforms;
    u.tScene.value = this.rtScene.texture;
    u.tBloom.value = this.rtA.texture;
    u.uTime.value = state.time || 0;
    const night = state.night || 0;
    u.uGrain.value = 0.004 + 0.008 * night;
    u.uVig.value = 0.28 + 0.10 * night;
    u.uNight.value = night;
    u.uWarm.value = state.warm || 0;
    u.uSpeed.value = state.speed || 0;
    if (state.sunScreen) u.uSun.value.copy(state.sunScreen);
    // Keep the glare fix hard-disabled even if an older caller still passes
    // flare state. Bloom remains available for headlights, signs and lamps.
    u.uFlare.value = 0;
    u.uRays.value = 0;
    // eye adaptation: pupils open after dark so lit scenes still read
    const targetExp = 1.0 + 0.28 * night;
    this._exp += (targetExp - this._exp) * 0.04;
    u.uExposure.value = this._exp;
    r.setRenderTarget(null);
    r.render(this.comp.scene, this.comp.camera);
  }
}
