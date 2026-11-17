// Generated UI icons (manifest section "ui": icon_*, act_*, pic_*) as DOM images and canvas sources. Every key may be
// missing or 404: html() then returns the fallback glyph, draw() returns false and the caller draws its own shape.
import { Assets } from '../assets.js';
import { spriteUrl } from '../core.js';
import { esc } from './keys.js';

const cache = new Map();   // key → HTMLImageElement | null (failed / absent)
/** URL of a ui key, else of a sprite key (potion, coin, boss_*), else null */
export function iconUrl(key) { return Assets.url('ui', key) || spriteUrl(key) || null; }
/** a loaded image for canvas drawing, or null (starts loading on first ask) */
export function iconImg(key) {
  let im = cache.get(key);
  if (im === undefined) {
    const u = iconUrl(key);
    if (!u) { cache.set(key, null); return null; }
    im = new Image();
    im.decoding = 'async';
    im.onerror = () => cache.set(key, null);
    im.src = u;
    cache.set(key, im);
  }
  return im && im.complete && im.naturalWidth > 0 ? im : null;
}
/** 'ok' (loaded) | 'loading' | 'none' (absent or failed) */
export function iconState(key) { iconImg(key); const im = cache.get(key); return !im ? 'none' : im.complete && im.naturalWidth > 0 ? 'ok' : 'loading'; }
/** draw an icon centred at (cx, cy) with size s on a 2D context; false when it is not available (draw a fallback) */
export function drawIcon(x, key, cx, cy, s) {
  const im = iconImg(key);
  if (!im) return false;
  x.drawImage(im, cx - s / 2, cy - s / 2, s, s);
  return true;
}
/** an <img> for the icon with a text fallback that shows when the image is absent or fails */
export function iconHtml(key, fallback = '', cls = '') {
  const u = iconUrl(key);
  const fb = `<span class="ifb">${esc(fallback)}</span>`;
  if (!u) return `<span class="ico ${cls} noimg">${fb}</span>`;
  return `<span class="ico ${cls}"><img src="${u}" alt="" draggable="false" onerror="this.parentNode.classList.add('noimg');this.remove()">${fb}</span>`;
}
/** warm the browser cache for icons shown later (compass, map, touch buttons) */
export function preloadIcons(keys) { for (const k of keys) iconImg(k); }
