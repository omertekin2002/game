#!/usr/bin/env node
// Home-screen / install icons for the web manifest (manifest.webmanifest), drawn as a clean vector redraw of the
// starseed in assets/ui/icon.png (a lime star with a lighter star inside and a two-leaf sprout on top, brown outline).
// Usage: node tools/make-app-icons.mjs   (needs the `sharp` dev dependency: bun install)
// Writes assets/ui/app-icon-192.png and app-icon-512.png (transparent, for any launcher) and app-icon-maskable-512.png
// (full-bleed cream tile, the seed inside the 80 % safe circle that launchers may crop to).
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = new URL('../assets/ui/', import.meta.url);
const INK = '#4a2c1a';   // --brown-d
const CREAM = '#fff6e2'; // --cream, also the manifest's background_color

// A rounded five-point star centred at (cx, cy): outer radius R, inner radius r, corners softened with quadratic curves.
function starPath(cx, cy, R, r, round = 0.32) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  let d = '';
  for (let i = 0; i < 10; i++) {
    const prev = pts[(i + 9) % 10], cur = pts[i], next = pts[(i + 1) % 10];
    const t = i % 2 ? round * 0.6 : round;   // tips rounder than the inner corners
    const a = lerp(cur, prev, t), b = lerp(cur, next, t);
    d += `${i ? 'L' : 'M'}${f(a)} Q${f(cur)} ${f(b)} `;
  }
  return d + 'Z';
}

// The seed on a 100 × 100 canvas (outline included), centred; `bg` fills the whole square first.
function seedSvg(size, { scale = 1, bg = null } = {}) {
  const leaf = 'M0 0 C 6 -13 22 -17 33 -11 C 27 1 12 6 0 0 Z';
  const body = starPath(50, 61, 36, 22.5, 0.38);
  const inner = starPath(50, 64, 14, 7.4, 0.24);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="body" cx="0.42" cy="0.34" r="0.75">
      <stop offset="0" stop-color="#d8f27a"/><stop offset="0.55" stop-color="#9fd23a"/><stop offset="1" stop-color="#5e9a1e"/>
    </radialGradient>
    <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c3e86a"/><stop offset="1" stop-color="#7fb52e"/>
    </linearGradient>
    <radialGradient id="core" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#fdfc9a"/><stop offset="1" stop-color="#e6f26a"/>
    </radialGradient>
  </defs>
  ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}
  <g transform="translate(50 52) scale(${scale}) translate(-50 -52)" stroke-linejoin="round" stroke-linecap="round">
    <path d="M50 28 C 50 25 50 23 50 21" fill="none" stroke="${INK}" stroke-width="6.5"/>
    <path d="M50 28 C 50 25 50 23 50 21" fill="none" stroke="#7fb52e" stroke-width="2.6"/>
    <g transform="translate(50 22) scale(0.82)">
      <path d="${leaf}" fill="url(#leaf)" stroke="${INK}" stroke-width="3.2"/>
      <path d="${leaf}" transform="scale(-1 1)" fill="url(#leaf)" stroke="${INK}" stroke-width="3.2"/>
      <path d="M4 -2 C 12 -8 20 -10 27 -9" fill="none" stroke="#e8f8b0" stroke-width="1.6" opacity="0.8"/>
      <path d="M-4 -2 C -12 -8 -20 -10 -27 -9" fill="none" stroke="#e8f8b0" stroke-width="1.6" opacity="0.8"/>
    </g>
    <path d="${body}" fill="url(#body)" stroke="${INK}" stroke-width="3.6"/>
    <path d="${inner}" fill="url(#core)"/>
    <ellipse cx="39" cy="46" rx="7" ry="3.4" transform="rotate(-28 39 46)" fill="#fbffe0" opacity="0.85"/>
    <ellipse cx="33" cy="75" rx="3.2" ry="4.6" transform="rotate(30 33 75)" fill="#c8ea72" opacity="0.7"/>
    <ellipse cx="67" cy="75" rx="3.2" ry="4.6" transform="rotate(-30 67 75)" fill="#c8ea72" opacity="0.7"/>
  </g>
</svg>`;
}

await mkdir(OUT, { recursive: true });
const jobs = [
  ['app-icon-192.png', seedSvg(192)],
  ['app-icon-512.png', seedSvg(512)],
  // maskable: launchers crop to a circle of 80 % of the size, so the seed (≈ 92 % of the canvas at scale 1) shrinks to fit
  ['app-icon-maskable-512.png', seedSvg(512, { scale: 0.74, bg: CREAM })],
];
for (const [name, svg] of jobs) {
  const file = fileURLToPath(new URL(name, OUT));
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: false }).toFile(file);
  console.log(`make-app-icons: ${name}`);
}
