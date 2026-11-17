// Way-finding: the objective rule, world markers (contract C6: W.landmarks when present, else W.greatTree / W.treePos,
// W.arenas, W.shop, W.pedestal), the compass ribbon (top centre, 180° span, markers clamp to its edges), the heading-up
// minimap (real horizontal-FOV wedge, N badge orbiting the rim) and the parchment map card with a click-to-place
// waypoint (also keyboard / pad: a cursor driven by the move keys / stick). Canvas 2D only, redrawn on change.
import { SEED_ORDER, SEEDS, BOSSES, REGIONS } from '../data.js';
import { HALF, SIZE } from '../world-const.js';
import { hud as TH } from '../tune.js';
import { drawIcon, iconImg, iconUrl } from './icons.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const C = { cream: '#fff6e2', brown: '#7a4b2a', brownD: '#4a2c1a', tick: '#b48a5a', north: '#e0607a', gold: '#f5c040', coral: '#ff7a6a', green: '#5fae3e', ink: '#5a3a24' };
const ARENA_ICON = { woods: 'icon_woods', peaks: 'icon_peaks', shores: 'icon_shores' };
const FB = { tree: '✿', altar: '✿', arena: '!', shop: '$', waypoint: '★', landmark: '◆', chest: '▣', via: '!' };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** the next thing to do as { id (marker id), x, z, text, short } or null (the isle is blooming) */
export function objective(W, S, pl) {
  if (!W || !S || S.ending) return null;
  // carrying a seed: the altar (its own marker, so the compass badge, its pill, the minimap ring and the map all point
  // where the objective line counts to); a world without one falls back to the Great Tree
  const home = W.pedestal || W.greatTree || W.treePos;
  const carried = SEED_ORDER.filter((k) => S.seeds[k] === 1).length;
  if (carried && home) return { id: W.pedestal ? 'altar' : 'tree', x: home.x, z: home.z, text: carried > 1 ? 'Bring the Starseeds home' : 'Bring the Starseed home', short: 'Altar' };
  for (const id of SEED_ORDER) {
    const a = W.arenas && W.arenas[id];
    if (a && S.bosses[id] && !S.seeds[id]) return { id: 'arena-' + id, x: a.x, z: a.z, text: 'Pick up the ' + SEEDS[id].name, short: SEEDS[id].name };
  }
  let best = null, bd = Infinity;
  for (const id of SEED_ORDER) {
    const a = W.arenas && W.arenas[id];
    if (!a || S.bosses[id] || S.seeds[id]) continue;
    const d = pl ? dist(a, pl) : 0;
    if (d < bd) { bd = d; best = id; }
  }
  if (!best) return null;
  const found = SEED_ORDER.filter((k) => S.seeds[k] > 0).length, a = W.arenas[best], pre = found ? (3 - found) + ' to go · ' : 'Find the Starseeds · ';
  const via = pl ? viaBridge(W, best, a, pl) : null;
  if (via) return { id: 'via-' + best, x: via.x, z: via.z, text: pre + 'Bridge to ' + BOSSES[best].name, short: 'Bridge', via: best };
  return { id: 'arena-' + best, x: a.x, z: a.z, text: pre + BOSSES[best].name, short: BOSSES[best].name };
}
/** r4: the bridge on the way to an arena whose straight line from Pip crosses the river (the peaks: the river's east bank
 *  is a wall for 100 m but at its bridge, and steering at Frostbun's marker walked Pip into the water below it): its mouth
 *  on Pip's side (the end farther from the arena) until he is within viaReach m of it, then its far mouth (also while on
 *  the deck); null when the line crosses no river, or Pip is already across (his line to the far mouth crosses none) */
function viaBridge(W, id, a, pl) {
  if (!W.bridges || !W.riverFAt) return null;
  for (const b of W.bridges) {
    if (b.id !== id) continue;
    const A = { x: b.ax, z: b.az }, B = { x: b.bx, z: b.bz }, near = dist(A, a) > dist(B, a) ? A : B, far = near === A ? B : A;
    if (W.bridgeAt && W.bridgeAt(pl.x, pl.z) !== null) return far;
    if (!crossesRiver(W, pl, a) || !crossesRiver(W, pl, far)) return null;
    return dist(near, pl) < TH.viaReach ? far : near;
  }
  return null;
}
/** the straight line p → q passes over the river (sampled every viaStep m; a bridge deck over it counts) */
function crossesRiver(W, p, q) {
  const n = Math.max(2, Math.ceil(dist(p, q) / TH.viaStep));
  for (let i = 1; i < n; i++) { const t = i / n; if (W.riverFAt(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t) < 0.55) return true; }
  return false;
}

/** every way-finding marker: { id, kind: 'tree'|'landmark'|'arena'|'shop'|'waypoint'|'via', icon, x, z, name, beaten, range }
 *  (obj: the objective; r4: when it leads over a bridge first, its own 'via' marker at the bridge) */
export function navMarkers(W, S, out = [], obj = null) {
  out.length = 0;
  if (!W) return out;
  if (obj && obj.via) out.push({ id: obj.id, kind: 'via', icon: ARENA_ICON[obj.via], x: obj.x, z: obj.z, name: 'Bridge to ' + BOSSES[obj.via].name });
  const lm = Array.isArray(W.landmarks) ? W.landmarks.filter((l) => l && Number.isFinite(l.x) && Number.isFinite(l.z)) : null;
  const tl = lm && lm.find((l) => /tree/i.test(String(l.id || '')) || /great tree/i.test(String(l.name || '')));
  const tree = tl || W.greatTree || W.treePos;
  if (tree) out.push({ id: 'tree', kind: 'tree', icon: 'icon_tree', x: tree.x, z: tree.z, name: 'Great Tree' });
  // the Starseed altar (C6 W.pedestal) while a seed is carried to it: the tree badge with a gold star pip
  if (W.pedestal && Number.isFinite(W.pedestal.x) && S && S.seeds && SEED_ORDER.some((k) => S.seeds[k] === 1)) out.push({ id: 'altar', kind: 'altar', icon: 'icon_tree', x: W.pedestal.x, z: W.pedestal.z, name: 'Starseed altar' });
  if (lm) for (const l of lm) if (l !== tl) out.push({ id: 'lm-' + (l.id || l.name), kind: 'landmark', icon: 'icon_' + (l.region || 'village'), x: l.x, z: l.z, name: l.name || '', range: TH.landmarkRange });
  for (const id of SEED_ORDER) {
    const a = W.arenas && W.arenas[id];
    if (a) out.push({ id: 'arena-' + id, kind: 'arena', icon: ARENA_ICON[id], x: a.x, z: a.z, name: BOSSES[id].name, beaten: !!(S && S.bosses[id]) });
  }
  if (W.shop) out.push({ id: 'shop', kind: 'shop', icon: 'icon_shop', x: W.shop.x, z: W.shop.z, name: 'Miso\'s Shop' });
  if (S && S.waypoint && Number.isFinite(S.waypoint.x)) out.push({ id: 'wp', kind: 'waypoint', icon: 'icon_waypoint', x: S.waypoint.x, z: S.waypoint.z, name: 'Marker' });
  return out;
}

/** a round badge with an icon (or a drawn glyph when the icon is absent) */
function badge(x, m, cx, cy, r, o = {}) {
  x.save();
  x.globalAlpha = o.alpha ?? 1;
  x.beginPath(); x.arc(cx, cy, r, 0, TAU);
  x.fillStyle = m.kind === 'waypoint' ? '#fff3c4' : C.cream; x.fill();
  x.lineWidth = o.ring ? Math.max(2, r * 0.2) : Math.max(1.5, r * 0.13);
  x.strokeStyle = o.ring || C.brown; x.stroke();
  if (!drawIcon(x, m.icon, cx, cy, r * 1.62)) {
    x.fillStyle = m.kind === 'arena' ? (m.beaten ? C.green : C.coral) : m.kind === 'tree' || m.kind === 'altar' ? C.green : C.brown;
    x.font = `700 ${Math.round(r * 1.1)}px Fredoka, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(FB[m.kind] || '•', cx, cy + r * 0.06);
  }
  if (m.kind === 'arena' || m.kind === 'altar') {
    const px = cx + r * 0.72, py = cy - r * 0.72, pr = r * 0.42, alt = m.kind === 'altar';
    x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fillStyle = alt ? C.gold : m.beaten ? C.green : C.coral; x.fill();
    x.lineWidth = Math.max(1, r * 0.1); x.strokeStyle = C.brownD; x.stroke();
    x.fillStyle = alt ? C.brownD : '#fff'; x.font = `700 ${Math.round(pr * 1.5)}px Fredoka, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(alt ? '★' : m.beaten ? '✓' : '!', px, py + pr * 0.08);
  }
  x.restore();
}

// ------------------------------------------------------------------ DOM marker badges (compass + minimap)
/** a badge element: icon image over a drawn glyph (shown when the icon is absent / fails), arena pip, objective pill */
function badgeEl(m, parent, cls) {
  const e = document.createElement('div');
  e.className = cls + ' k-' + m.kind;
  const u = iconUrl(m.icon);
  e.innerHTML = `<i class="g">${FB[m.kind] || '•'}</i>${u ? `<img src="${u}" alt="" draggable="false" onerror="this.remove()">` : ''}<b class="pip"></b><span class="dist"></span>`;
  parent.appendChild(e);
  return e;
}
/** per-element style cache: write only on change; returns the number of writes */
function put(e, k, v) { const c = e._c || (e._c = {}); if (c[k] === v) return 0; c[k] = v; if (k === 'cls') e.className = v; else if (k === 'text') e.lastChild.textContent = v; else e.style[k] = v; return 1; }

// ------------------------------------------------------------------ compass ribbon
/** the 180° ribbon: a tick strip drawn once into a canvas and the N / E / S / W letters on a second canvas above the
 *  markers (a badge never hides a letter; only the objective sits above them); the strips and the markers inside the
 *  window ride one sliding container (one transform write per frame while turning). Outside the window the objective,
 *  the map marker and the Great Tree stay pinned to the edge (colour muted), stacked inward in that order (the objective at
 *  the edge, its distance pill inward), the rest hide. Marker positions are rewritten only when Pip moves or a marker
 *  crosses the window edge */
export class Compass {
  constructor(el) {
    this.el = el;
    el.innerHTML = '<div class="cwin"><div class="cslide"><canvas class="cstrip"></canvas><canvas class="clet"></canvas></div><div class="cpin"></div></div><i class="caret"></i>';
    this.win = el.firstChild; this.slide = this.win.firstChild; this.cv = this.slide.firstChild; this.lv = this.cv.nextSibling; this.pin = this.win.lastChild;
    this.pins = [];
    this.w = TH.compassW; this.h = TH.compassH; this.dpr = 1;
    this.els = new Map(); this.draws = 0; this.writes = 0;
    // the strip is drawn with Fredoka: redraw it once the font is in
    try { document.fonts && document.fonts.ready.then(() => this.buildStrip()); } catch (e) { /* ignore */ }
  }
  /** CSS size in px (layout pass, never per frame) */
  size(w, h) {
    this.w = Math.round(w); this.h = Math.round(h);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.win.style.width = this.w + 'px'; this.win.style.height = this.h + 'px';
    this.el.style.setProperty('--ch', this.h + 'px');
    this.buildStrip();
    for (const e of this.els.values()) { e._code = e._x = e._dm = undefined; }
    this.sx0 = undefined;
  }
  /** ticks + letters for -90°…450° (strip x of degree g = (g + 90)·ppd); the cardinal letters go on their own canvas
   *  (above the badges) with a cream halo */
  buildStrip() {
    const W = this.w, H = this.h, d = this.dpr, ppd = W / TH.compassSpan, k = H / 38, c = this.cv, lv = this.lv;
    for (const cv of [c, lv]) { cv.width = Math.ceil(540 * ppd * d); cv.height = Math.ceil(H * d); cv.style.width = (540 * ppd).toFixed(1) + 'px'; cv.style.height = H + 'px'; }
    const x = c.getContext('2d'), lx = lv.getContext('2d');
    for (const q of [x, lx]) { q.setTransform(d, 0, 0, d, 0, 0); q.clearRect(0, 0, c.width, c.height); q.lineCap = 'round'; q.lineJoin = 'round'; q.textAlign = 'center'; q.textBaseline = 'middle'; }
    for (let deg = -90; deg <= 450; deg += 15) {
      const sx = (deg + 90) * ppd, n = ((deg % 360) + 360) % 360;
      if (n % 90 === 0) {
        const L = 'NESW'[n / 90];
        lx.font = `700 ${Math.round(18 * k)}px Fredoka, sans-serif`;
        lx.strokeStyle = '#fffaf0'; lx.lineWidth = 4.5 * k; lx.strokeText(L, sx, H / 2 + 1 * k);
        lx.fillStyle = L === 'N' ? C.north : C.brown; lx.fillText(L, sx, H / 2 + 1 * k);
      } else if (n % 45 === 0) {
        x.font = `600 ${Math.round(11 * k)}px Fredoka, sans-serif`; x.fillStyle = C.tick;
        x.fillText(['NE', 'SE', 'SW', 'NW'][(n - 45) / 90], sx, H / 2 + 1 * k);
      } else {
        x.strokeStyle = C.tick; x.lineWidth = 2 * k;
        x.beginPath(); x.moveTo(sx, H - 6 * k); x.lineTo(sx, H - 13 * k); x.moveTo(sx, 6 * k); x.lineTo(sx, 9 * k); x.stroke();
      }
    }
    this.draws++;
  }
  /** heading = compass degrees of the view (0 N, 90 E) */
  draw(heading, pl, list, obj) {
    let w = 0;
    const W = this.w, ppd = W / TH.compassSpan, k = this.h / 38;
    const h = ((heading % 360) + 360) % 360;
    const sx0 = Math.round(-h * ppd * 2) / 2;
    if (sx0 !== this.sx0) { this.sx0 = sx0; this.slide.style.transform = 'translateX(' + sx0 + 'px)'; w++; }
    const r = 13 * k, edgeDeg = (r + 5 * k) / ppd - 90, stamp = (this.stamp = (this.stamp || 0) + 1), pins = this.pins;
    let n = 0;
    pins.length = 0;
    for (const m of list) {
      let e = this.els.get(m.id);
      if (!e) { e = badgeEl(m, this.slide, 'cmk'); this.els.set(m.id, e); }
      if (e._seen !== stamp) { e._seen = stamp; n++; }
      const dd = Math.hypot(m.x - pl.x, m.z - pl.z);
      if (m.range && dd > m.range) { if (e._code !== -1) { e._code = -1; e.style.opacity = '0'; w++; } continue; }
      const b = Math.atan2(m.x - pl.x, -(m.z - pl.z)) / D2R, rel = ((b - h + 540) % 360) - 180;
      const isObj = !!(obj && obj.id === m.id), inWin = Math.abs(rel) <= -edgeDeg;
      // outside the window the objective, the map marker and the Great Tree stay, pinned to the edge (stacked below);
      // the rest would pile up there
      const pk = isObj ? 0 : m.kind === 'waypoint' ? 1 : m.kind === 'tree' ? 2 : -1;
      if (!inWin && pk < 0) { if (e._code !== -1) { e._code = -1; e.style.opacity = '0'; w++; } continue; }
      if (inWin) w += this.put(e, m, (h + rel + 90) * ppd, 0, isObj, dd, rel, W, ppd, k);   // on the strip: rides the slide
      else { e._pk = pk; e._side = rel < 0 ? -1 : 1; e._dd = dd; e._m = m; e._obj = isObj; pins.push(e); }
    }
    // pinned badges per edge, from the edge inward: objective (its distance pill points inward), map marker, Great Tree
    for (let side = -1; side <= 1; side += 2) {
      let off = 0;
      for (let pk = 0; pk < 3; pk++) {
        for (let i = 0; i < pins.length; i++) {
          const e = pins[i];
          if (e._side !== side || e._pk !== pk) continue;
          const x0 = (90 + edgeDeg) * ppd + off;
          w += this.put(e, e._m, side < 0 ? x0 : W - x0, side, e._obj, e._dd, 0, W, ppd, k);
          // the next one clears this badge (and the objective's pill: "117 m" ≈ 0.47 r per character + padding)
          off += 2 * r + 4 * k + (e._obj && e._dm >= 0 ? 3 + String(e._dm).length * 0.47 * r + 0.95 * r + 10 * k : 0);
        }
      }
    }
    if (this.els.size !== n) for (const [id, e] of this.els) if (e._seen !== stamp) { e.remove(); this.els.delete(id); }
    this.writes = w;
    return w;
  }
  /** one badge: parent (strip or pin layer), state class, opacity, z order, x and the objective's distance (on change) */
  put(e, m, x, off, isObj, dd, rel, W, ppd, k) {
    let w = 0;
    const par = off ? this.pin : this.slide;
    if (e.parentNode !== par) { par.appendChild(e); w++; }
    // pinned badges stay opaque (a see-through pill let the strip's letters show through it); CSS mutes their colour
    let op = 1;
    if (dd < 3 && m.kind !== 'tree') op *= 0.5;
    const flip = isObj && !off && rel * ppd > W / 2 - 80 * k;
    // a small state code: the class string is only built when it changes
    const code = (m.beaten ? 1 : 0) | (isObj ? 2 : 0) | (off < 0 ? 4 : off > 0 ? 8 : flip ? 16 : 0) | (op < 1 ? 32 : 0) | (op < 0.55 ? 64 : 0) | (isObj ? 0 : Math.max(0, 2 - Math.floor(dd / 120)) << 7);
    if (code !== e._code) {
      e._code = code; w++;
      e.className = 'cmk k-' + m.kind + (m.beaten ? ' beaten' : '') + (isObj ? ' obj' : '') + (off < 0 ? ' offl' : off > 0 ? ' offr' : flip ? ' flip' : '');
      // under the letters (z 4) by distance; the objective above them
      e.style.opacity = String(op); e.style.zIndex = isObj ? '5' : String(code >> 7);
    }
    const xq = Math.round(x * 2) / 2;
    if (xq !== e._x) { e._x = xq; e.style.transform = 'translateX(' + xq + 'px)'; w++; }
    if (isObj) { const dm = dd < 1000 ? Math.round(dd) : -1; if (dm !== e._dm) { e._dm = dm; e.lastChild.textContent = dm >= 0 ? dm + ' m' : ''; w++; } }
    else e._dm = -1;
    return w;
  }
}

// ------------------------------------------------------------------ minimap (heading-up or north-up)
/** the island map canvas and the marker dots live in one container, turned / slid / scaled by a single transform (one
 *  write per frame while turning); dots beyond the rim are held on it (rewritten only when Pip moves). The FOV wedge
 *  (real horizontal FOV), Pip's arrow and the orbiting N badge are their own small elements */
export class Minimap {
  constructor(el) {
    this.el = el;
    el.innerHTML = '<div class="mrot"><div class="mdots"></div></div><i class="wedge"></i><i class="arrow"></i><div class="n">N</div>';
    this.rot = el.firstChild; this.dots = this.rot.firstChild; this.wedge = el.children[1]; this.arrow = el.children[2]; this.nEl = el.lastChild;
    this.px = 156; this.els = new Map(); this.draws = 0; this.writes = 0; this.lp = null;
  }
  /** px: the CSS border-box size. The map, the dots and the N orbit are centred on the content box (inside the 5 u rim
   *  border, where the arrow and the wedge sit at 50 %): R = half of it (a layout pass here, never per frame) */
  size(px) {
    this.px = Math.round(px);
    const cw = this.el.clientWidth;
    this.R = cw > 0 ? cw / 2 : (this.px * (1 - 10 / TH.miniSize)) / 2;
    // the N badge's orbit: its outer edge 1.5 px inside the rim at every HUD scale (the badge is 22 u wide: a fixed
    // R − 10 put it over the rim border once u > 0.8, e.g. at 1920×1080)
    this.nr = this.R - (this.nEl.offsetWidth || (22 * this.px) / TH.miniSize) / 2 - 1.5;
    this.el.style.setProperty('--msc', (this.px / TH.miniSpan).toFixed(4));
    for (const e of this.els.values()) e._c = {};
    this.lp = null; this.qt = this.qw = this.qa = this.qn = undefined;
  }
  setMap(canvas) {
    if (!canvas || this.mapImg === canvas) return;
    this.mapImg = canvas;
    canvas.className = 'mimg';
    canvas.style.width = canvas.style.height = SIZE + 'px';     // 1 CSS px per metre inside the container
    this.rot.insertBefore(canvas, this.dots);
  }
  /** ver: bumped by the caller whenever it rebuilt the marker list (beaten flags, waypoint, landmarks) */
  draw(pl, viewYaw, facing, halfFov, heading, list, obj, ver = 0) {
    let w = 0;
    const R = this.R || this.px / 2, sc = this.px / TH.miniSpan, hd = (a) => Math.atan2(Math.sin(a), -Math.cos(a));
    const hv = hd(viewYaw), th = heading ? -hv : 0;
    const qt = Math.round(th * 2000) / 2000, qx = Math.round(pl.x * 50) / 50, qz = Math.round(pl.z * 50) / 50;
    if (qt !== this.qt || qx !== this.qx || qz !== this.qz || sc !== this.qsc || R !== this.qR) {
      this.qt = qt; this.qx = qx; this.qz = qz; this.qsc = sc; this.qR = R; w++;
      this.rot.style.transform = 'translate(' + R + 'px,' + R + 'px) rotate(' + qt + 'rad) scale(' + sc.toFixed(4) + ') translate(' + (-(qx + HALF)).toFixed(2) + 'px,' + (-(qz + HALF)).toFixed(2) + 'px)';
    }
    const hf = (halfFov / D2R).toFixed(1) + 'deg';
    if (this.hf !== hf) { this.hf = hf; this.el.style.setProperty('--hf', hf); w++; }
    const qw = heading ? 0 : Math.round(hv * 1000) / 1000, qa = Math.round((heading ? hd(facing) - hv : hd(facing)) * 1000) / 1000;
    if (qw !== this.qw) { this.qw = qw; this.wedge.style.transform = 'rotate(' + qw + 'rad)'; w++; }
    if (qa !== this.qa) { this.qa = qa; this.arrow.style.transform = 'rotate(' + qa + 'rad)'; w++; }
    // dots: world metres inside the container, so a dot inside the rim never moves; one beyond the rim sits on it and
    // is rewritten once Pip moved 0.6 m (≤ 1 px of drift) or the marker list was rebuilt (ver) / the objective changed
    const oid = obj ? obj.id : '';
    const moved = !this.lp || Math.abs(pl.x - this.lp.x) + Math.abs(pl.z - this.lp.z) > 0.6 || ver !== this.ver || oid !== this.oid;
    if (moved) {
      this.lp = { x: pl.x, z: pl.z }; this.ver = ver; this.oid = oid;
      const crW = (R * 0.8) / sc, stamp = (this.stamp = (this.stamp || 0) + 1);
      let n = 0;
      for (const m of list) {
        let e = this.els.get(m.id);
        if (!e) { e = document.createElement('i'); this.dots.appendChild(e); this.els.set(m.id, e); }
        if (e._seen !== stamp) { e._seen = stamp; n++; }
        let dx = m.x - pl.x, dz = m.z - pl.z;
        const l = Math.hypot(dx, dz);
        if (m.range && l > m.range) { w += put(e, 'opacity', '0'); continue; }
        const out = l > crW;
        if (out) { dx *= crW / l; dz *= crW / l; }
        w += put(e, 'cls', 'mdot k-' + m.kind + (m.beaten ? ' beaten' : '') + (obj && obj.id === m.id ? ' obj' : ''));
        w += put(e, 'transform', `translate(${(pl.x + dx + HALF).toFixed(1)}px,${(pl.z + dz + HALF).toFixed(1)}px)`);
        w += put(e, 'opacity', out ? '0.8' : '1');
      }
      if (this.els.size !== n) for (const [id, e] of this.els) if (e._seen !== stamp) { e.remove(); this.els.delete(id); }
    }
    if (qt !== this.qn) { this.qn = qt; const nr = this.nr ?? R - 10; this.nEl.style.transform = 'translate(' + (Math.sin(qt) * nr).toFixed(1) + 'px,' + (-Math.cos(qt) * nr).toFixed(1) + 'px)'; w++; }
    this.draws++; this.writes = w;
    return w;
  }
}

// ------------------------------------------------------------------ the parchment map card
export class MapCard {
  constructor(card) {
    this.card = card;
    this.cv = card.querySelector('canvas');
    this.x = this.cv.getContext('2d');
    this.cursor = null;          // keyboard / pad cursor (world x, z) or null
    this.cv.addEventListener('pointerdown', (e) => { e.preventDefault(); this.click(e); });
  }
  /** world ↔ canvas (CSS px) */
  toWorld(cx, cy) { const s = this.sc; return { x: (cx - this.cw / 2) / s, z: (cy - this.cw / 2) / s }; }
  open(ctx) {
    this.ctx = ctx;   // { mapImg, labels, W, S, pl, facing, halfFov, list, obj }
    this.cursor = null;
    const cw = this.cv.clientWidth || 600, d = Math.min(2, window.devicePixelRatio || 1);
    this.cw = cw; this.d = d; this.sc = cw / (SIZE * 0.92);
    this.cv.width = this.cv.height = Math.round(cw * d);
    iconImg('icon_chest');
    this.draw();
  }
  click(e) {
    if (!this.ctx) return;
    const r = this.cv.getBoundingClientRect();
    const p = this.toWorld(((e.clientX - r.left) / r.width) * this.cw, ((e.clientY - r.top) / r.height) * this.cw);
    this.place(p.x, p.z);
  }
  /** place a waypoint (or remove it when placed on the current one) */
  place(x, z) {
    const S = this.ctx && this.ctx.S;
    if (!S) return;
    const wp = S.waypoint;
    if (wp && Math.hypot(wp.x - x, wp.z - z) < 7) { delete S.waypoint; this.onChange && this.onChange(null); }
    else if (Math.abs(x) < HALF && Math.abs(z) < HALF) { S.waypoint = { x: +x.toFixed(1), z: +z.toFixed(1) }; this.onChange && this.onChange(S.waypoint); }
    this.ctx.list = navMarkers(this.ctx.W, S);
    this.draw();
  }
  /** keyboard / pad: move the cursor (axis in -1..1), confirm places */
  nudge(ax, ay, dt) {
    if (!this.ctx) return;
    if (!this.cursor) this.cursor = { x: this.ctx.pl.x, z: this.ctx.pl.z };
    this.cursor.x = Math.max(-HALF, Math.min(HALF, this.cursor.x + ax * 120 * dt));
    this.cursor.z = Math.max(-HALF, Math.min(HALF, this.cursor.z - ay * 120 * dt));
    this.draw();
  }
  confirm() { if (this.cursor) this.place(this.cursor.x, this.cursor.z); else if (this.ctx) { this.cursor = { x: this.ctx.pl.x, z: this.ctx.pl.z }; this.draw(); } }
  draw() {
    const c = this.ctx;
    if (!c) return;
    const x = this.x, d = this.d, w = this.cw, s = this.sc;
    x.setTransform(d, 0, 0, d, 0, 0);
    x.fillStyle = '#7cc3e0'; x.fillRect(0, 0, w, w);
    x.save(); x.translate(w / 2, w / 2);
    if (c.mapImg) { x.globalAlpha = 0.96; x.drawImage(c.mapImg, -HALF * s, -HALF * s, SIZE * s, SIZE * s); x.globalAlpha = 1; }
    // region names (unvisited: ???), each moved off the marker badges (the village name sat under the tree + shop) and
    // off the names already placed (visited names first; a '???' with no free spot is left out rather than drawn over one)
    const fpx = Math.round(Math.max(13, 18 * (w / 600)));
    x.font = `700 ${fpx}px Fredoka, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const placed = [], seen = (r) => { const ri = REGIONS.findIndex((q) => q.name === r.name); return !!(c.S && c.S.visited && c.S.visited[ri]); };
    for (const r of (c.labels || []).slice().sort((a, b) => seen(b) - seen(a))) {
      const vis = seen(r), t = vis ? r.name : '???';
      const tw = x.measureText(t).width, lx = r.x * s;
      const freeOfMarks = (ly) => !c.list.some((m) => { const br = (m.kind === 'landmark' ? 9 : 12) + 3; return Math.abs(m.x * s - lx) < tw / 2 + br && Math.abs(m.z * s - ly) < fpx / 2 + br; });
      const freeOfNames = (ly) => !placed.some((p) => Math.abs(p.x - lx) < (p.w + tw) / 2 + 6 && Math.abs(p.y - ly) < fpx + 4);
      let ly = null;
      for (const dy of [-22, -46, 20, -70, 44]) if (freeOfMarks(r.z * s + dy) && freeOfNames(r.z * s + dy)) { ly = r.z * s + dy; break; }
      if (ly == null) for (const dy of [-22, -46, 20, -70, 44, 68, -94]) if (freeOfNames(r.z * s + dy)) { ly = r.z * s + dy; break; }
      if (ly == null && !vis) continue;
      if (ly == null) ly = r.z * s - 22;
      placed.push({ x: lx, y: ly, w: tw, h: fpx, t });
      x.lineWidth = 5; x.strokeStyle = 'rgba(74,44,26,0.85)'; x.fillStyle = vis ? '#fff6e2' : 'rgba(255,246,226,0.65)';
      x.strokeText(t, lx, ly);
      x.fillText(t, lx, ly);
    }
    this.placed = placed;          // (tests: where each name went)
    // opened chests
    for (const ch of (c.W && c.W.chests) || []) {
      if (!c.S.chests[ch.id]) continue;
      x.save(); x.globalAlpha = 0.85;
      if (!drawIcon(x, 'icon_chest', ch.x * s, ch.z * s, 16)) { x.fillStyle = '#c8873a'; x.fillRect(ch.x * s - 4, ch.z * s - 3, 8, 6); }
      x.restore();
    }
    for (const m of c.list) badge(x, m, m.x * s, m.z * s, m.kind === 'landmark' ? 9 : 12, { ring: c.obj && c.obj.id === m.id ? C.gold : m.kind === 'arena' && !m.beaten ? C.coral : null });
    // Pip + a translucent view cone
    const p = c.pl;
    x.save(); x.translate(p.x * s, p.z * s);
    x.fillStyle = 'rgba(124,195,90,0.35)';
    x.beginPath(); x.moveTo(0, 0);
    for (let i = 0; i <= 10; i++) { const a = c.viewYaw - c.halfFov + (2 * c.halfFov * i) / 10; x.lineTo(Math.sin(a) * 46, Math.cos(a) * 46); }
    x.closePath(); x.fill();
    x.rotate(-c.facing + Math.PI);
    x.fillStyle = '#fff6e2'; x.strokeStyle = '#7a4b2a'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, -10); x.lineTo(8, 8); x.lineTo(0, 4); x.lineTo(-8, 8); x.closePath(); x.fill(); x.stroke();
    x.restore();
    // keyboard / pad cursor
    if (this.cursor) {
      const cx = this.cursor.x * s, cz = this.cursor.z * s;
      x.strokeStyle = '#4a2c1a'; x.lineWidth = 3;
      x.beginPath(); x.arc(cx, cz, 10, 0, TAU); x.moveTo(cx - 16, cz); x.lineTo(cx - 6, cz); x.moveTo(cx + 6, cz); x.lineTo(cx + 16, cz); x.moveTo(cx, cz - 16); x.lineTo(cx, cz - 6); x.moveTo(cx, cz + 6); x.lineTo(cx, cz + 16); x.stroke();
      x.strokeStyle = '#fff6e2'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cz, 10, 0, TAU); x.stroke();
    }
    x.restore();
  }
}
