// HUD projector (arch §10): world point → CSS px through the ViewController's camera. Never NaN: a point at or behind
// the eye (clip w ≤ 0.05) reports behind = true; off-screen points keep an edge angle for indicators. Every
// world-anchored HUD element goes through it (ui.project wraps it for the prompt and floaters). WP6 owns this file.
// It does the maths itself (same matrices as view.worldToScreen) for two reasons: the viewport size is cached here
// (reading window.innerWidth per call forces a style + layout pass on mobile, where the viewport meta is on, so every
// HUD projection after a style write cost a full layout), and the edge angle of a point behind the eye is the real
// direction to it (view.worldToScreen reverses it).
import { G } from '../core.js';

let VW = window.innerWidth, VH = window.innerHeight;
/** the cached viewport (refreshed on resize, never read per projection) */
export function viewport() { return { w: VW, h: VH }; }
export function refreshViewport() { VW = window.innerWidth; VH = window.innerHeight; }
window.addEventListener('resize', refreshViewport);

/** project(v {x, y, z}, out = {}) → { x, y (CSS px), ndcX, ndcY, viewZ, behind, onScreen, edgeAngle, vx, vy, vz }
 *  edgeAngle: direction from the screen centre toward the point (0 = up, +π/2 = right; behind the eye too).
 *  vx / vy / vz: the point in camera space (x right, y up, −z forward) */
export function project(v, out = {}) {
  const c = G.view && G.view.camera;
  if (!c) return Object.assign(out, { x: -9999, y: -9999, ndcX: 0, ndcY: 0, viewZ: 0, behind: true, onScreen: false, edgeAngle: 0, vx: 0, vy: 0, vz: 0 });
  const m = c.matrixWorldInverse.elements, p = c.projectionMatrix.elements, x = v.x, y = v.y, z = v.z;
  const vx = m[0] * x + m[4] * y + m[8] * z + m[12], vy = m[1] * x + m[5] * y + m[9] * z + m[13], vz = m[2] * x + m[6] * y + m[10] * z + m[14];
  const cx = p[0] * vx + p[4] * vy + p[8] * vz + p[12], cy = p[1] * vx + p[5] * vy + p[9] * vz + p[13], w = p[3] * vx + p[7] * vy + p[11] * vz + p[15];
  out.vx = vx; out.vy = vy; out.vz = vz;
  out.behind = !(w > 0.05);
  if (out.behind) { out.x = out.y = -9999; out.ndcX = out.ndcY = 0; out.viewZ = 0; out.onScreen = false; out.edgeAngle = Math.atan2(vx, vy) || 0; return out; }
  out.ndcX = cx / w; out.ndcY = cy / w; out.viewZ = w;
  out.x = (out.ndcX * 0.5 + 0.5) * VW; out.y = (-out.ndcY * 0.5 + 0.5) * VH;
  out.onScreen = Math.abs(out.ndcX) <= 1 && Math.abs(out.ndcY) <= 1;
  out.edgeAngle = Math.atan2(out.ndcX, out.ndcY);
  return out;
}
