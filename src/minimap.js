import * as THREE from 'three';
import { LOOP_LENGTH, ZONES } from './config.js';
import { posAt } from './road.js';

// ---------------------------------------------------------------------------
// Live minimap: a narrow vertical strip on the right edge showing the actual
// plan-view shape of this map's highway (sampled from the real centerline),
// the region's zone names, and your live position as an amber dot. Faded by
// default so it doesn't fight the road; hover to bring it up to full opacity.
// ---------------------------------------------------------------------------

const PANEL_W = 112;
const PAD = 16;

let panel = null, cv = null, ctx = null, staticCv = null;
let toPx = null, dpr = 1, panelH = 0;

function samplePath() {
  const N = 512, v = new THREE.Vector3(), pts = [];
  for (let i = 0; i < N; i++) {
    posAt((i / N) * LOOP_LENGTH, 0, v);
    pts.push([v.x, v.z]);
  }
  return pts;
}

function buildStatic() {
  panelH = Math.max(260, Math.round(innerHeight * 0.62));
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = PANEL_W * dpr; cv.height = panelH * dpr;
  cv.style.width = PANEL_W + 'px'; cv.style.height = panelH + 'px';

  const pts = samplePath();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  // rotate the plan view so the route's long dimension runs down the strip
  const swap = (maxX - minX) > (maxZ - minZ);
  const u = p => swap ? p[1] : p[0];
  const w = p => swap ? p[0] : p[1];
  let minU = swap ? minZ : minX, maxU = swap ? maxZ : maxX;
  let minW = swap ? minX : minZ, maxW = swap ? maxX : maxZ;
  const sc = Math.min(
    (PANEL_W - PAD * 2) / Math.max(1, maxU - minU),
    (panelH - PAD * 2) / Math.max(1, maxW - minW));
  const ox = (PANEL_W - (maxU - minU) * sc) / 2;
  const oy = (panelH - (maxW - minW) * sc) / 2;
  toPx = p => [ox + (u(p) - minU) * sc, oy + (w(p) - minW) * sc];

  staticCv = document.createElement('canvas');
  staticCv.width = cv.width; staticCv.height = cv.height;
  const g = staticCv.getContext('2d');
  g.scale(dpr, dpr);

  // the route ribbon: dark casing under a bright line, like a printed map
  for (const [wpx, col] of [[4, 'rgba(0,0,0,.55)'], [2, 'rgba(255,255,255,.9)']]) {
    g.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = toPx(p);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.lineWidth = wpx; g.strokeStyle = col;
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.stroke();
  }

  // region labels from the zone list, deduped and spaced out
  g.font = '600 9px -apple-system, "Segoe UI", Roboto, sans-serif';
  g.textBaseline = 'middle';
  const placed = [];
  let lastLabel = null;
  const v = new THREE.Vector3();
  for (const z of ZONES) {
    const label = z.label || z.name;
    if (!label || label === lastLabel) continue;
    lastLabel = label;
    posAt((z.start + z.end) / 2, 0, v);
    const [x, y] = toPx([v.x, v.z]);
    if (placed.some(([, py]) => Math.abs(py - y) < 22)) continue;
    placed.push([x, y]);
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)';
    const left = x > PANEL_W / 2;
    g.textAlign = left ? 'right' : 'left';
    g.fillText(label, x + (left ? -5 : 5), y);
  }
}

export function initMinimap() {
  if (panel) return;
  panel = document.createElement('div');
  panel.id = 'minimap';
  Object.assign(panel.style, {
    position: 'fixed', right: '12px', top: '50%', transform: 'translateY(-50%)',
    zIndex: 6, borderRadius: '10px', overflow: 'hidden',
    background: 'rgba(10,14,22,.45)', backdropFilter: 'blur(5px)',
    border: '1px solid rgba(255,255,255,.14)',
    opacity: 0.3, transition: 'opacity .25s ease',
    userSelect: 'none',
  });
  panel.addEventListener('mouseenter', () => { panel.style.opacity = 1; });
  panel.addEventListener('mouseleave', () => { panel.style.opacity = 0.3; });
  cv = document.createElement('canvas');
  cv.style.display = 'block';
  panel.appendChild(cv);
  document.body.appendChild(panel);
  buildStatic();
  addEventListener('resize', buildStatic);
}

const _p = new THREE.Vector3();
export function updateMinimap(playerS) {
  if (!ctx) { if (!cv) return; ctx = cv.getContext('2d'); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(staticCv, 0, 0);
  ctx.scale(dpr, dpr);
  posAt(playerS % LOOP_LENGTH, 0, _p);
  const [x, y] = toPx([_p.x, _p.z]);
  ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb200'; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
}
