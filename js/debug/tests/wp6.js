// WP6 in-page suites: HUD, menus, touch and settings UI (arch §15.2 WP6 Accept, WP-BRIEFS WP6). Providers of the
// contracts WP6 consumes (C1 lock target, C3 telegraphs, C4 hurt direction, C5 hp / maxHp / name, C6 landmarks, C9
// speedFx) are simulated here by emitting the events / setting the fields. 'wp6' runs in 'all'; 'wp6-heavy' (60 s
// session, overlap audit over every HUD state) runs on request: G.debug.test.run('wp6-heavy').
import { G, store } from '../../core.js';
import { SETTINGS_KEY, SCHEMA, Settings } from '../../settings.js';
import { fmtKeys, keyParts } from '../../hud/keys.js';
import { navMarkers, objective } from '../../hud/nav.js';
import { META, kbmRowsHidden } from '../../hud/menus.js';
import { iconUrl } from '../../hud/icons.js';
import { audit } from '../../hud/hud.js';
import { project } from '../../hud/projector.js';
import { topFit } from '../../ui.js';
import { hud as TH } from '../../tune.js';
import { Boss } from '../../bosses.js';
/** r4: an earlier test may have beaten this boss (smoke's 'place' gives its seed): bring it back (the runner restores the save) */
function reviveBoss(game, id) {
  if (!game.S.bosses[id] && game.bosses[id]) return;
  game.S.bosses[id] = false; game.S.seeds[id] = 0;
  for (const p of game.pickups) if (p.kind === 'seed' && p.seedId === id) p.remove();
  if (!game.bosses[id]) game.bosses[id] = new Boss(id, game.world.arenas[id]);
}


const D2R = Math.PI / 180;
const xy = (e) => { const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(e.style.transform || ''); return m ? [+m[1], +m[2]] : null; };
const vis = (e) => +(e.style.opacity || 0) > 0.05;
const inter = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const R = (e) => e.getBoundingClientRect();
/** Pip's screen box from 16 projected points (feet to hood, ±0.3 m), the way a reviewer measures it */
function pipRect(t) {
  const p = t.pl.pos, xs = [], ys = [];
  for (const y of [0, 0.5, 0.85, 1.0]) for (const a of [0, 1.57, 3.14, 4.71]) { const s = t.ui.project({ x: p.x + Math.sin(a) * 0.3, y: p.y + y, z: p.z + Math.cos(a) * 0.3 }, t.game.camera, {}); if (s) { xs.push(s.x); ys.push(s.y); } }
  return xs.length ? { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) } : null;
}
/** a clean HUD for one test: no petals / chevrons / hints / coach / feed lines, keyboard glyphs */
function clean(t) {
  const { ui, input } = t;
  ui.fx.reset(); ui.coach.stop(); ui.coach.hints.length = 0; ui.coach.hint = null; ui.coach.seen.clear(); ui.feed.clear();
  ui.notices.reset(); input.setDevice('keyboard'); t.view.lockOn(null); t.view.speedFx = 0;
  // r3: the portrait "turn sideways" tip is queued 2.5 s (real time) after a session starts: on a loaded machine it
  // landed in the middle of a test (coach marks: "pill hidden" failed at 390×844); drop it if it has not queued yet
  const mod = t.game.modules.find((m) => m.name === 'wp6-hud'); if (mod) clearTimeout(mod.sideT);
  t.frames(2);
}
const P = { view: 'fp', pose: 'spawn', god: true, freeze: true, time: 12 };

export default function register(suite) {
  suite('wp6', [
    ['C7 fmtKeys: tokens become the device\'s glyphs; a control the device lacks is never named', (t) => {
      t.eq(fmtKeys('Press {interact} to talk', { device: 'keyboard' }), 'Press E to talk', 'kbm');
      t.eq(fmtKeys('Press {interact} to talk', { device: 'pad' }), 'Press Y to talk', 'pad');
      t.eq(fmtKeys('Press {interact} to talk', { device: 'touch' }), 'Press Use to talk', 'touch');
      t.eq(fmtKeys('{roll} / {lockon} / {hop}', { device: 'keyboard' }), 'Shift / Q / Space', 'aliases');
      t.eq(fmtKeys('{shoulder}', { device: 'touch' }), '', 'touch has no shoulder swap');
      t.eq(fmtKeys('{nosuch} {', { device: 'pad' }), '{nosuch} {', 'unknown tokens stay');
      t.ok(/<kbd[^>]*>Space<\/kbd>/.test(fmtKeys('{jump} & <b>', { html: true, device: 'keyboard' })) && /&lt;b&gt;/.test(fmtKeys('{jump} & <b>', { html: true })), 'html keycaps, text escaped');
      t.ok(/kp a/.test(fmtKeys('{jump}', { html: true, device: 'pad' })), 'pad face button');
      const p = keyParts('Hop with {jump}!', 'pad');
      t.eq(p.length, 3, 'typewriter parts'); t.ok(!!p[1].html && p[1].s === 'A', 'key part');
    }],
    ['C7 in ui.js: dialogue, toasts and banners format at display time and follow the device', (t) => {
      const { ui, input } = t;
      clean(t);
      ui.say(['Swing with {attack}, then {interact}.'], {}); t.frames(90);
      t.ok(/LMB/.test(ui.dlgEl.textContent) && /E/.test(ui.dlgEl.textContent) && !/\{/.test(ui.dlgEl.textContent), 'keyboard glyphs', ui.dlgEl.textContent);
      input.setDevice('pad'); t.frames(2);
      t.ok(/X/.test(ui.dlgEl.querySelector('.text').textContent) && /Y/.test(ui.dlgEl.querySelector('.text').textContent), 'pad glyphs live', ui.dlgEl.querySelector('.text').textContent);
      t.dlgDone();
      ui.toast('Open the map with {map}'); t.frames(1);
      t.ok(ui.feed.lines.some((l) => /Back/.test(l.e.textContent)), 'toast (pad)');
      input.setDevice('keyboard');
      ui.showBanner('{view} Test', 'press {pause}'); t.frames(1);
      t.eq(ui.banner.querySelector('.t').textContent, 'V Test', 'banner');
      clean(t);
    }],
    ['prompt pill: [key] Verb · Name under the crosshair, the ring pops; hidden in dialogue', (t) => {
      const { ui, D } = t;
      clean(t);
      D.standAt('sign'); t.frames(4);
      t.ok(!ui.promptHidden && /E/.test(ui.promptEl.querySelector('.pk').textContent) && /Read/.test(ui.promptEl.textContent) && /Sign/.test(ui.promptEl.textContent), 'pill', ui.promptEl.textContent);
      t.eq(ui.crossEl.dataset.st, 'target', 'crosshair ring');
      t.press('interact'); t.frames(3);
      t.ok(!!ui.dlg && ui.promptHidden, 'hidden in dialogue');
      t.dlgDone(); t.frames(2);
    }],
    ['crosshair: enemy in reach shows the coral petals; a hit flashes the marker', (t) => {
      const { ui, D, game } = t;
      clean(t);
      D.teleport(0, 9.5, 0, 0); t.frames(2);
      D.spawn('slime', 1.3, 0); t.frames(3);
      t.eq(ui.crossEl.dataset.st, 'reach', 'reach state');
      t.clearEnemies(); t.frames(2);
      t.eq(ui.crossEl.dataset.st, 'idle', 'idle again');
      let n = 0; const f = ui.fx.flash; ui.fx.flash = (...a) => { n++; return f.apply(ui.fx, a); };
      let r;
      try { r = t.swing({ type: 'slime', dist: 1.4, rel: 0 }); } finally { ui.fx.flash = f; }
      t.ok(r.hit && n > 0, 'hit marker flashed', { r, n });
      void game;
    }],
    ['C4 damage petals: point at the source, turn with the view, gone after 0.8 s', (t) => {
      const { ui, D, view } = t;
      clean(t);
      D.look(0, 0); t.frames(1);
      D.hud.petal(90); t.frames(1);
      const p = ui.fx.petals.find((s) => s.on);
      t.ok(!!p && vis(p.e), 'petal shown');
      let q = xy(p.e);
      t.ok(q && q[0] < -50 && Math.abs(q[1]) < 30, 'from the left → left of centre', q);
      D.look(Math.PI / 2, 0); t.frames(1);              // turned 90° left: the source is now ahead
      q = xy(p.e);
      t.ok(q && q[1] < -50 && Math.abs(q[0]) < 30, 'turning moves it to the top', q);
      D.look(0, 0); D.hud.petal(180); t.frames(1);
      q = xy(ui.fx.petals.find((s) => s.on && s !== p).e);
      t.ok(q && q[1] > 50, 'from behind → below', q);
      t.frames(Math.ceil(TH.petalLife * 60) + 2);
      t.eq(ui.fx.petals.filter((s) => s.on).length, 0, 'faded');
      void view;
    }],
    ['C3 threat chevrons: only off the screen, at the screen edge, for the wind-up; look-up caret above the view', (t) => {
      const { ui, D } = t;
      clean(t);
      D.look(0, 0); t.frames(1);
      D.hud.telegraph(20, 5, 1); t.frames(2);
      t.eq(ui.fx.chevs.filter((s) => s.on).length, 0, 'in view: no chevron');
      D.hud.telegraph(-120, 6, 1); t.frames(2);
      const c = ui.fx.chevs.find((s) => s.on);
      t.ok(!!c, 'behind-right: chevron');
      const q = c && xy(c.e);
      t.ok(q && q[0] > innerWidth * 0.08 && q[1] > innerHeight * 0.03, 'on the right / lower edge', q);
      t.frames(Math.ceil((1 + 0.3) * 60));
      t.eq(ui.fx.chevs.filter((s) => s.on).length, 0, 'gone after t');
      D.hud.telegraph(5, 4, 1, t.pl.pos.y + 14); t.frames(2);
      t.ok(ui.fx.upOn, 'look-up caret for a threat high above');
      clean(t);
    }],
    ['C3 chevrons follow the real screen edge (WP5 offView), not a fixed cone: FOV 80 / 100, just inside vs just outside; a removed attacker\'s chevron goes', (t) => {
      const { ui, D, view, settings } = t;
      const on = () => ui.fx.chevs.filter((s) => s.on).length, rows = [];
      try {
        for (const fov of [80, 100]) {
          settings.set('fovFP', fov); clean(t); D.look(0, 0); t.frames(2);
          // the screen's half-width as the camera sees it (Hor+ at this aspect), in degrees
          const half = Math.atan(Math.tan((view.fovV * D2R) / 2) * view.camera.aspect) / D2R;
          // (53°: off the screen at both FOVs, inside the old fixed ±55° cone that showed nothing there)
          for (const [rel, want] of [[half - 8, 0], [half + 6, 1], [-(half + 6), 1], ...(half + 2 < 53 ? [[53, 1]] : [])]) {
            clean(t); D.look(0, 0); t.frames(1);
            D.hud.telegraph(rel, 6, 1.5); t.frames(2);
            rows.push([fov, +half.toFixed(1), +rel.toFixed(1), on()]);
            t.eq(on(), want, `FOV ${fov} (half-width ${half.toFixed(1)}°): a threat at ${rel.toFixed(1)}° ` + (want ? 'off the screen gets a chevron' : 'on the screen gets none'));
          }
        }
        // a real attacker that announced from behind, then was removed (killed / despawned / respawn): its chevron goes
        settings.set('fovFP', 100); clean(t); D.look(0, 0); D.teleport(0, 9.5, 0, 0); t.frames(1);
        D.spawn('slime', 4, 150); const e = D.last;
        t.game.events.emit(t.EV.TELEGRAPH, { kind: 'lunge', x: e.pos.x, y: e.pos.y, z: e.pos.z, t: 2.5, source: e }); t.frames(2);
        t.eq(on(), 1, 'an attacker behind: chevron');
        t.clearEnemies(); t.frames(2);
        t.eq(on(), 0, 'removed: the chevron goes at once (not after its 2.75 s life)');
      } finally { t.note('rows', rows); t.clearEnemies(); clean(t); }
    }],
    ['C1 lock reticle on view.lockTarget; C5 pips from hp / maxHp (locked, aimed, last hit)', (t) => {
      const { ui, D, view, game, EV } = t;
      clean(t);
      D.teleport(0, 9.5, 0, 0); t.frames(1);
      D.spawn('slime', 4, 0); const e = D.last;
      D.spawn('mushroom', 5, 20); const m = D.last;
      D.spawn('bee', 5, 120); const bee = D.last;
      view.lockOn(e); t.frames(2);
      t.ok(ui.fx.retOn && vis(ui.fx.reticle), 'reticle on');
      const s = xy(ui.fx.reticle);
      t.ok(s && Math.abs(s[0] - innerWidth / 2) < innerWidth * 0.15, 'reticle on the target', s);
      const pip = ui.fx.pips.find((p) => p.who === e);
      t.ok(!!pip && pip.in.querySelectorAll('.f').length === Math.ceil(e.hp), 'pips = hp', pip && pip.in.innerHTML);
      e.maxHp = 4; e.hp = 3; e.name = 'Wobbly Slime'; t.frames(1);
      t.ok(pip.in.querySelectorAll('span.f, span.e').length === 4 && pip.in.querySelectorAll('.f').length === 3 && /Wobbly/.test(pip.in.textContent), 'maxHp / hp / name (C5)', pip.in.innerHTML);
      view.lockOn(null); t.frames(2);
      t.ok(!ui.fx.retOn, 'reticle off');
      game.events.emit(EV.HIT, { kind: 'enemy', target: m, x: m.pos.x, y: m.pos.y, z: m.pos.z, dmg: 1, killed: false }); t.frames(2);
      t.ok(ui.fx.pips.some((p) => p.who === m && p.on), 'last hit enemy pips');
      game.events.emit(EV.HIT, { kind: 'enemy', target: bee, x: bee.pos.x, y: bee.pos.y, z: bee.pos.z, dmg: 1, killed: false }); t.frames(2);
      t.ok(!ui.fx.pips.some((p) => p.who === bee && p.on), 'a hit enemy off screen (not locked): no pips clamped onto the HUD');
      t.frames(Math.ceil(TH.pipHold * 60) + 4);
      t.ok(!ui.fx.pips.some((p) => p.who === m && p.on), 'pips go 2 s after the hit');
      t.clearEnemies(); t.frames(2);
      t.ok(!ui.fx.pips.some((p) => p.on), 'no pips without enemies');
    }],
    ['r4 objective over the river: from the spawn the way to Frostbun goes over the bridge — its near mouth, then (at it, on the deck) its far mouth, then past the river the arena; the compass badge and the line follow', (t) => {
      const { ui, W, game, D } = t;
      clean(t);
      const S = game.S, a = W.arenas.peaks, b = W.bridges.find((q) => q.id === 'peaks');
      if (!a || !b) { t.ok(false, 'the peaks arena and its bridge', { a: !!a, b: !!b }); return; }
      const A = { x: b.ax, z: b.az }, B = { x: b.bx, z: b.bz }, d = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
      const near = d(A, a) > d(B, a) ? A : B, far = near === A ? B : A;
      const seeds = { ...S.seeds }, bosses = { ...S.bosses };
      try {
        S.seeds = { woods: 2, peaks: 0, shores: 2 }; S.bosses = { woods: true, shores: true };
        const at = (x, z) => objective(W, S, { x, z });
        const o1 = at(W.spawn.x, W.spawn.z);
        t.ok(o1 && o1.id === 'via-peaks' && o1.x === near.x && o1.z === near.z && /Bridge to Frostbun/.test(o1.text), 'from the spawn: the bridge\'s near mouth', o1);
        const o2 = at(near.x + 0.5, near.z + 0.5), mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 }, o3 = at(mid.x, mid.z);
        t.ok(o2 && o2.x === far.x && o3 && o3.x === far.x, 'at the near mouth and on the deck: its far mouth', { o2, o3 });
        const fx = far.x + (far.x - near.x) / d(far, near) * 4, fz = far.z + (far.z - near.z) / d(far, near) * 4, o4 = at(fx, fz);
        t.ok(o4 && o4.id === 'arena-peaks', 'past the river: the arena', o4);
        const o5 = at(a.x - 20, a.z);
        t.ok(o5 && o5.id === 'arena-peaks', 'near the arena: the arena', o5);
        // the compass: a via marker, the objective badge on it, and the line counting to it
        D.pose('spawn'); ui.markersDirty = true; t.frames(3);
        const e = ui.compass.els.get('via-peaks');
        t.ok(ui.obj && ui.obj.id === 'via-peaks' && !!e && /obj/.test(e.className), 'the compass objective badge is the bridge', ui.obj);
        t.ok(/Bridge to Frostbun/.test(ui.objShown), 'the objective line says so', ui.objShown);
      } finally { S.seeds = seeds; S.bosses = bosses; ui.markersDirty = true; t.frames(1); }
    }],
    ['C6 compass + map markers: W.landmarks when present, else the old fields; objective; waypoint', (t) => {
      const { ui, W, game, D } = t;
      clean(t);
      const S = game.S, keep = W.landmarks;
      try {
        W.landmarks = [{ id: 'great_tree', name: 'Great Tree', region: 'village', x: 1, z: -2, height: 20 }, { id: 'mushroom', name: 'Giant Mushroom', region: 'woods', x: -30, z: -120, height: 18 }];
        const L = navMarkers(W, S);
        t.ok(L.find((m) => m.id === 'tree').x === 1 && L.some((m) => m.id === 'lm-mushroom' && m.range === TH.landmarkRange), 'landmarks used', L.map((m) => m.id));
        delete W.landmarks;
        const L2 = navMarkers(W, S);
        t.ok(L2.find((m) => m.id === 'tree').x === W.greatTree.x && L2.filter((m) => m.kind === 'arena').length === 3 && L2.some((m) => m.id === 'shop'), 'fallback fields', L2.map((m) => m.id));
      } finally { if (keep) W.landmarks = keep; else delete W.landmarks; }
      const seeds = { ...S.seeds }, bosses = { ...S.bosses };
      try {
        S.seeds = { woods: 0, peaks: 0, shores: 0 }; S.bosses = {};
        const o = objective(W, S, game.player.pos);
        t.ok(o && (/^arena-/.test(o.id) || (/^via-/.test(o.id) && !!W.arenas[o.via])), 'objective = a guardian (r4: or the bridge on the way to it)', o);
        S.seeds.woods = 1; S.bosses.woods = true;
        // carrying a seed: the altar (C6 W.pedestal) is the objective, with its own marker, so the compass badge, its
        // distance pill and the objective line all count to the same spot (they pointed at the trunk 8.8 m away)
        const o2 = objective(W, S, game.player.pos), alt = navMarkers(W, S).find((m) => m.id === 'altar');
        t.ok(o2.id === 'altar' && o2.x === W.pedestal.x && o2.z === W.pedestal.z, 'carrying a seed → the altar', o2);
        t.ok(!!alt && alt.x === W.pedestal.x && alt.z === W.pedestal.z, 'an altar marker at W.pedestal', alt);
        D.teleport(W.pedestal.x + 7, W.pedestal.z + 1, -Math.PI / 2, 0); ui.markersDirty = true; t.frames(3);
        const e = ui.compass.els.get('altar'), pl = game.player.pos;
        t.ok(ui.obj && ui.obj.id === 'altar' && !!e && /obj/.test(e.className), 'the compass objective badge is the altar', ui.obj);
        t.eq(e && e.lastChild.textContent, Math.round(Math.hypot(W.pedestal.x - pl.x, W.pedestal.z - pl.z)) + '\u00a0m', 'its pill counts to the altar');
        t.ok(ui.objShown.endsWith(e.lastChild.textContent), 'the objective line says the same distance', ui.objShown);
        S.seeds.woods = 2;
        t.ok(!navMarkers(W, S).some((m) => m.id === 'altar'), 'placed: no altar marker');
      } finally { S.seeds = seeds; S.bosses = bosses; ui.markersDirty = true; }
      ui.openMap(game.player.pos, t.view.yaw, S); t.frames(1);
      ui.mapCard.place(-40, -60);
      t.ok(S.waypoint && S.waypoint.x === -40, 'waypoint placed');
      ui.closeMenu(true); ui.markersDirty = true; t.frames(2);
      t.ok(ui.compass.els.has('wp'), 'compass shows it');
      ui.openMap(game.player.pos, t.view.yaw, S); ui.mapCard.place(-41, -61); ui.closeMenu(true);
      t.ok(!S.waypoint, 'clicking it again removes it');
      void D;
    }],
    ['map card: region names never draw over each other or over a marker pin (a waypoint dropped next to a name)', (t) => {
      const { ui, game } = t;
      clean(t);
      const S = game.S, vis = { ...S.visited }, bad = [];
      try {
        S.visited = { 0: true };                                // the village known, the rest '???'
        const tries = [null, ...ui.regionLabels.map((r) => ({ x: r.x, z: r.z - 1 }))];
        for (const w of tries) {
          if (w) S.waypoint = { x: +w.x.toFixed(1), z: +w.z.toFixed(1) }; else delete S.waypoint;
          ui.openMap(game.player.pos, t.view.yaw, S); t.frames(1);
          const P = ui.mapCard.placed || [];
          for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.abs(P[i].x - P[j].x) < (P[i].w + P[j].w) / 2 && Math.abs(P[i].y - P[j].y) < P[i].h) bad.push([P[i].t, P[j].t, w]);
          if (!P.some((p) => p.t !== '???')) bad.push(['no visited name drawn', w]);
          ui.closeMenu(true);
        }
      } finally { S.visited = vis; delete S.waypoint; ui.markersDirty = true; t.frames(1); }
      t.eq(bad.length, 0, 'names overlapping: ' + JSON.stringify(bad.slice(0, 4)));
    }],
    ['map by keyboard / pad: the move stick drives a cursor, confirm drops the marker, {map} closes', async (t) => {
      const { ui, game, D } = t;
      clean(t);
      delete game.S.waypoint;
      t.press('map'); t.frames(2);
      t.eq(ui.menu, 'map', 'map opened by its key');
      t.press('interact'); t.frames(1);                 // first confirm: the cursor appears on Pip
      D.move(1, 0); t.frames(30); D.move(0, 0); t.frames(1);
      t.ok(ui.mapCard.cursor && ui.mapCard.cursor.x > game.player.pos.x + 40, 'cursor moved east', ui.mapCard.cursor);
      t.press('jump'); t.frames(1);
      t.ok(game.S.waypoint && Math.abs(game.S.waypoint.x - ui.mapCard.cursor.x) < 0.2, 'marker at the cursor', game.S.waypoint);
      t.press('map'); t.frames(2);
      t.eq(ui.menu, null, 'closed');
      delete game.S.waypoint; ui.markersDirty = true;
      await t.wait(130);
    }],
    ['compass bearing: the Great Tree straight ahead sits at the centre; to the right when it is on the right', (t) => {
      const { ui, D, W } = t;
      clean(t);
      D.teleport(0, 30, Math.PI, 0); t.frames(1);       // south of the tree, looking north at it
      D.lookAt(W.greatTree.x, 2, W.greatTree.z); ui.markersDirty = true; t.frames(2);
      // window x = the badge's x (on the sliding strip, or pinned) + the slide offset
      const winX = (e) => +/translateX\(([-\d.]+)px\)/.exec(e.style.transform)[1] + (e.parentNode === ui.compass.slide ? ui.compass.sx0 : 0);
      const e = ui.compass.els.get('tree'), x = winX(e);
      t.near(x, ui.compass.w / 2, ui.compass.w * 0.03, 'centre');
      D.look(t.view.yaw + 45 * D2R, 0); t.frames(2);     // turn left 45°: the tree is now on the right
      const x2 = winX(e);
      t.near(x2 - ui.compass.w / 2, 45 * ui.compass.w / TH.compassSpan, 4, 'right by 45°');
    }],
    ['minimap: a marker at Pip\'s feet sits under his arrow (the map is centred inside the rim border), heading-up and north-up', (t) => {
      const { ui, D, game, settings } = t;
      clean(t);
      if (ui.lay !== 'desk') { t.ok(true, 'no minimap on phone layouts'); return; }
      const off = [];
      try {
        for (const m of ['heading', 'north']) for (const yaw of [Math.PI, 0.7]) {
          settings.set('minimap', m); D.teleport(20, 30, yaw, 0); t.frames(2);
          const p = t.pl.pos; game.S.waypoint = { x: p.x, z: p.z }; ui.markersDirty = true; t.frames(2);
          const a = R(ui.mini.querySelector('.arrow')), d = R(ui.minimap.els.get('wp'));
          off.push([m, +(d.left - (a.left + a.width / 2)).toFixed(1), +(d.top - (a.top + a.height / 2)).toFixed(1)]);
        }
        t.note('off', off);
        t.ok(off.every((o) => Math.abs(o[1]) <= 1 && Math.abs(o[2]) <= 1), 'within 1 px of the arrow (was +2.8 / +2.8 px at 1280×720)', off);
        const n = R(ui.mini.querySelector('.n')), b = R(ui.mini), bw = parseFloat(getComputedStyle(ui.mini).borderLeftWidth) || 0;
        const nd = Math.hypot(n.left + n.width / 2 - (b.left + b.width / 2), n.top + n.height / 2 - (b.top + b.height / 2)) + n.width / 2;
        t.ok(nd <= b.width / 2 - bw + 1, 'the N badge orbits inside the rim', { outer: +nd.toFixed(1), rim: b.width / 2 - bw });
      } finally { delete game.S.waypoint; ui.markersDirty = true; settings.set('minimap', 'heading'); t.frames(1); }
    }],
    ['minimap: every marker kind has a shape of its own (readable without colour); a beaten guardian differs from an unbeaten one in shape, not only colour and size; the objective ring shows around each', (t) => {
      const { ui } = t;
      // one .mdot per kind in the real marker layer (it carries --msc); the non-colour computed properties of each
      const kinds = [['tree', 'k-tree'], ['arena', 'k-arena'], ['arena.beaten', 'k-arena beaten'], ['shop', 'k-shop'], ['altar', 'k-altar'], ['landmark', 'k-landmark'], ['waypoint', 'k-waypoint']];
      const made = [];
      try {
        const shape = (cls) => {
          const e = document.createElement('i'); e.className = 'mdot ' + cls; ui.minimap.dots.appendChild(e); made.push(e);
          const b = getComputedStyle(e, '::before'), a = getComputedStyle(e, '::after');
          return { clip: b.clipPath, radius: [b.borderTopLeftRadius, b.borderTopRightRadius, b.borderBottomRightRadius, b.borderBottomLeftRadius].join(' '),
            w: parseFloat(b.width), h: parseFloat(b.height), before: b.content, after: a.content, e };
        };
        const S = Object.fromEntries(kinds.map(([k, cls]) => [k, shape(cls)]));
        t.note('shapes', Object.fromEntries(kinds.map(([k]) => { const { e, ...r } = S[k]; return [k, r]; })));
        /** the non-colour properties that tell a and b apart (size counts only when it differs by 30 % or more) */
        const diff = (a, b, size = true) => {
          const d = [];
          if (a.clip !== b.clip) d.push('clip-path');
          if (a.radius !== b.radius) d.push('border-radius');
          if (a.before !== b.before) d.push('::before content');
          if (a.after !== b.after) d.push('::after content');
          if (size && (Math.max(a.w, b.w) / Math.min(a.w, b.w) >= 1.3 || Math.max(a.h, b.h) / Math.min(a.h, b.h) >= 1.3)) d.push('size');
          return d;
        };
        t.ok(kinds.every(([k]) => S[k].w > 0 && S[k].h > 0), 'every kind draws a marker', kinds.map(([k]) => [k, S[k].w, S[k].h]));
        const same = [];
        for (let i = 0; i < kinds.length; i++) for (let j = i + 1; j < kinds.length; j++) {
          const a = kinds[i][0], b = kinds[j][0];
          if (!diff(S[a], S[b]).length) same.push(a + ' ~ ' + b);
        }
        t.ok(!same.length, 'every pair of kinds differs in a non-colour property (clip-path, border-radius, size ≥ 30 % or glyph)', same);
        const ab = diff(S.arena, S['arena.beaten'], false);
        t.ok(ab.length > 0, 'unbeaten and beaten guardians differ in shape or glyph, not only colour and size', ab);
        t.eq(S.waypoint.clip.replace(/(^|[ (,])0px/g, (m, p) => p + '0%'), 'polygon(50% 0%, 62% 35%, 98% 36%, 69% 58%, 80% 93%, 50% 72%, 20% 93%, 31% 58%, 2% 36%, 38% 35%)', 'the waypoint keeps its star');
        // the objective's gold ring: drawn around every kind and larger than the marker inside it
        const ring = kinds.map(([k, cls]) => { const r = shape(cls + ' obj'), a = getComputedStyle(r.e, '::after'); return [k, a.content !== 'none' && a.content !== 'normal', parseFloat(a.width), Math.max(r.w, r.h)]; });
        t.ok(ring.every(([, on, rw, mw]) => on && rw > mw), 'the objective ring shows around every kind, outside the marker', ring);
      } finally { for (const e of made) e.remove(); }
    }],
    ['C9 speed lines follow view.speedFx (WP1\'s feel module writes it every frame: driven by a real dash)', (t) => {
      const { ui, view, D } = t;
      clean(t);
      D.pose('meadow'); t.frames(2);
      t.eq(+ui.fx.speed.style.opacity, 0, 'at rest: none');
      // run, then roll: the provider raises speedFx and the overlay follows it frame by frame (opacity = speedFx × 0.55)
      t.move(0, 1); t.frames(20); t.press('dash');
      let peak = 0, peakFx = 0, track = 0, n = 0;
      for (let i = 0; i < 40; i++) {
        t.frames(1);
        const o = +ui.fx.speed.style.opacity || 0, fx = Math.max(0, Math.min(1, +view.speedFx || 0));
        peak = Math.max(peak, o); peakFx = Math.max(peakFx, fx); n++;
        if (Math.abs(o - Math.round(fx * TH.speedAlpha * 50) / 50) < 0.021) track++;
      }
      t.note('dash', { peak, peakFx, track, n });
      t.ok(peakFx > 0.5 && peak > 0.3, 'a dash shows the speed lines', { peak, peakFx });
      t.eq(track, n, 'the overlay follows view.speedFx every frame');
      t.move(0, 0); t.frames(120);
      t.ok(+ui.fx.speed.style.opacity < 0.05 && (+view.speedFx || 0) < 0.1, 'settled: gone again', { o: ui.fx.speed.style.opacity, fx: view.speedFx });
    }],
    ['C18 hints: EV.HINT queued one at a time, the same id not twice, tokens formatted', (t) => {
      const { ui, game, EV } = t;
      clean(t);
      game.events.emit(EV.HINT, { id: 'a', text: 'Hop the ring with {jump}' });
      game.events.emit(EV.HINT, { id: 'a', text: 'Hop the ring with {jump}' });
      game.events.emit(EV.HINT, { id: 'b', text: 'Second' });
      t.frames(2);
      t.ok(ui.coachEl.classList.contains('show') && /Space/.test(ui.coachEl.textContent), 'first hint', ui.coachEl.textContent);
      t.eq(ui.coach.hints.length, 1, 'second queued, duplicate dropped');
      ui.coach.hint.t0 -= 1e5; t.frames(2);
      t.ok(/Second/.test(ui.coachEl.textContent), 'next');
      clean(t);
    }],
    ['r4 first-person dialogue: the portrait hides for a speaker framed close by, stays for one more than dlgFar m away (Elder Shellby\'s opening from the wake-up spot)', async (t) => {
      const { ui, game, D } = t;
      clean(t);
      const sh = game.npcs.find((n) => n.id === 'shellby');
      const talk = () => { ui.say(['Hello, Pip.'], { name: sh.name, portrait: sh.key }); t.frames(2); const r = { fpnpc: ui.dlgEl.classList.contains('fpnpc'), d: +Math.hypot(sh.pos.x - t.view.eye.x, sh.pos.z - t.view.eye.z).toFixed(2) }; t.dlgDone(); return r; };
      try {
        D.standAt('shellby'); t.frames(2);
        const near = talk();
        await t.wait(130);
        D.pose('spawn'); t.frames(2);
        const far = talk();
        t.note('portrait', { near, far });
        t.ok(near.d < TH.dlgFar && near.fpnpc, 'close by: the real face is in frame, no portrait', near);
        t.ok(far.d > TH.dlgFar && !far.fpnpc, 'far: the portrait stays', far);
      } finally { if (ui.dlg) t.dlgDone(); D.pose('spawn'); clean(t); }
    }],
    ['r4 hints in a boss fight: only the fight\'s own show (one from before waits for the end, whole); the pill stacks over the reticle and pips; a phone in first person docks it at the top', (t) => {
      const { ui, D, game } = t;
      clean(t);
      const txt = () => (ui.coachEl.classList.contains('show') ? ui.coachEl.textContent : '');
      try {
        ui.hint('r4a', 'First tip'); t.frames(2);
        ui.hint('r4b', 'Second tip'); t.frames(2);
        t.ok(/First tip/.test(txt()) && ui.coach.hints.length === 1, 'before the fight: one up, one queued', txt());
        reviveBoss(game, 'woods');
        D.cutscene('bossIntro', 'woods'); t.frames(3);
        for (let i = 0; i < 200 && game.fight && game.fight.phase === 'intro'; i++) t.frames(1);
        t.frames(5);
        t.ok(game.fight && game.fight.phase === 'fight' && !/tip/.test(txt()), 'in the fight: neither shows', { phase: game.fight && game.fight.phase, text: txt() });
        ui.hint('r4ring', 'A glowing ring! Hop over it'); t.frames(3);
        t.ok(/glowing ring/.test(txt()), 'the fight\'s own hint shows', txt());
        const kids = [...ui.hud.children];
        t.ok(kids.indexOf(ui.coachEl) > kids.indexOf(ui.fx.wm) && kids.indexOf(ui.coachEl) > kids.indexOf(ui.fx.petalRoot), 'the pill stacks over #worldmarks and #petals (DOM order)', kids.map((e) => e.id));
        if (ui.lay !== 'desk') t.ok(ui.coachEl.classList.contains('ctop'), ui.lay + ', first person: docked at the top in the fight');
        else t.ok(!ui.coachEl.classList.contains('ctop'), 'desktop, first person: the usual slot (under the boss, clear of it)');
        game.endFight(true); D.pose('spawn'); t.frames(2);           // (out of the arena: the fight would start again)
        ui.coach.hint.t0 -= 1e5; t.frames(2);
        t.ok(/First tip/.test(txt()), 'after the fight: the held hint, whole', txt());
        ui.coach.hint.t0 -= 1e5; t.frames(2);
        t.ok(/Second tip/.test(txt()), 'then the queued one', txt());
      } finally { if (game.fight) game.endFight(true); ui.showBossCard('', '', false); D.pose('spawn'); clean(t); }
    }],
    ['r4 coach marks count from the start: walked and swung before looking around → the look step jumps straight to the flourish; partly done → the first step still missing', async (t) => {
      const { ui, D } = t;
      clean(t);
      let done = 0;
      ui.coach.start(() => done++); t.frames(2);
      D.move(0, 1); for (let i = 0; i < 90; i++) t.frames(1); D.move(0, 0);          // ≈ 6 m before any look
      await t.wait(130); t.press('attack'); t.frames(30);
      t.ok(ui.coach.step === 0 && /mouse/i.test(ui.coachEl.textContent), 'still the look step (no look yet)', { step: ui.coach.step, text: ui.coachEl.textContent });
      for (let i = 0; i < 30 && ui.coach.step === 0; i++) { D.lookDelta(30, 0); t.frames(1); }
      t.ok(ui.coach.step === 3 && done === 1, 'looked 45°: walk and swing already done → all set at once', { step: ui.coach.step, done, did: ui.coach.did });
      t.frames(Math.ceil(TH.coachHold * 60) + 2);
      // partly: looked and swung, not walked → the walk step shows, then finishes on the walk alone
      ui.coach.start(() => done++); t.frames(2);
      for (let i = 0; i < 30 && ui.coach.did.look < TH.coachLook; i++) { D.lookDelta(30, 0); t.frames(1); }
      t.press('jump'); t.frames(40);
      t.ok(ui.coach.step === 1 && /walk/i.test(ui.coachEl.textContent), 'looked + hopped: the walk step', { step: ui.coach.step, text: ui.coachEl.textContent });
      D.move(0, 1); for (let i = 0; i < 120 && ui.coach.step === 1; i++) t.frames(1); D.move(0, 0);
      t.ok(ui.coach.step === 3 && done === 2, 'walked → all set (the hop counted)', { step: ui.coach.step, done });
      ui.coach.stop(); t.frames(1);
    }],
    ['coach marks advance when the player does it: look 45°, walk 4 m, swing', async (t) => {
      const { ui, D } = t;
      clean(t);
      let done = 0;
      ui.coach.start(() => done++); t.frames(2);
      t.ok(ui.coachEl.classList.contains('show') && /mouse/i.test(ui.coachEl.textContent), 'step 1 shown', ui.coachEl.textContent);
      for (let i = 0; i < 30 && ui.coach.step === 0; i++) { D.lookDelta(30, 0); t.frames(1); }
      t.eq(ui.coach.step, 1, 'looked around');
      D.move(0, 1); for (let i = 0; i < 120 && ui.coach.step === 1; i++) t.frames(1); D.move(0, 0);
      t.eq(ui.coach.step, 2, 'walked');
      await t.wait(130);
      t.press('attack'); t.frames(3);
      t.ok(ui.coach.step === 3 && done === 1, 'swung → done', { step: ui.coach.step, done });
      t.frames(Math.ceil(TH.coachHold * 60) + 2);
      t.eq(ui.coach.step, -1, 'gone');
      t.ok(!ui.coachEl.classList.contains('show'), 'pill hidden');
      ui.coach.start(() => {}); t.frames(2);
      t.ok(ui.coachEl.classList.contains('show'), 'restarted');
      ui.coach.stop(); t.frames(1);
      t.ok(!ui.coachEl.classList.contains('show'), 'stop (Save & Quit, new session) hides the pill that is up');
    }],
    ['boss bar "Now!" follows WP5\'s boss.opening (the free-hit window: recovering after a big attack, or stunned)', (t) => {
      const { ui } = t;
      const b = { hp: 6, maxHp: 10, def: { name: 'Test Guardian' }, state: 'walk', opening: false, enraged: false }, now = () => ui.bossbar.classList.contains('vuln');
      try {
        ui.bossBar(b); t.ok(!ui.bossbar.classList.contains('hidden') && !now(), 'walking: no tag');
        b.state = 'recover'; b.opening = true; ui.bossBar(b); t.ok(now(), 'recover with opening (Shroom / Frostbun openings): Now!');
        b.opening = false; ui.bossBar(b); t.ok(!now(), 'recover without an opening: none');
        b.state = 'stunned'; b.opening = true; ui.bossBar(b); t.ok(now(), 'stunned (Pinch\'s wall bonk): Now!');
      } finally { ui.bossBar(null); }
    }],
    ['the region card gives the upper screen to a fight: a telegraph, a hurt or an enemy noticing Pip nearby hides it', (t) => {
      const { ui, D, game, EV } = t;
      clean(t);
      const up = () => ui.banner.classList.contains('show');
      ui.showBanner('Bloom Meadow', 'Test'); t.frames(1); t.ok(up(), 'card up');
      D.hud.telegraph(30, 4, 1); t.frames(1); t.ok(!up(), 'a telegraph hides it');
      ui.showBanner('Bloom Meadow', 'Test'); game.events.emit(EV.HURT, { dmg: 1, fromX: t.pl.pos.x + 1, fromZ: t.pl.pos.z, rel: 0 }); t.frames(1); t.ok(!up(), 'a hurt hides it');
      D.teleport(0, 9.5, 0, 0); t.frames(1);
      D.spawn('bat', 20, 0); const far = D.last; far.noticed = true;
      ui.showBanner('Bloom Meadow', 'Test'); t.frames(2); t.ok(up(), 'an enemy 20 m away: the card stays');
      D.spawn('bat', 6, 10); D.last.noticed = true; t.frames(1); t.ok(!up(), 'one that noticed Pip 6 m away: hidden');
      t.clearEnemies(); clean(t);
    }],
    ['notification slot: the region card and the boss card are never on screen together', (t) => {
      const { ui } = t;
      clean(t);
      ui.showBanner('Whispering Woods', 'Mind the mushrooms');
      t.ok(ui.banner.classList.contains('show'), 'banner');
      ui.showBossCard('Grumble Shroom', 'Grumpy Guardian', true);
      t.ok(!ui.banner.classList.contains('show'), 'boss card hides the banner');
      t.eq(ui.showBanner('Frostcap Peaks', ''), false, 'banner refused while the boss card is up');
      ui.showBossCard('', '', false);
      t.ok(ui.showBanner('Frostcap Peaks', '') === true, 'free again');
      ui.notices.reset();
    }],
    ['boss card up: a portrait phone\'s pickup feed steps aside (the card reaches its slot); other layouts keep it', async (t) => {
      const { ui } = t;
      clean(t);
      try {
        ui.toast('No potions! Miso sells them.'); ui.showBossCard('Grumble Shroom', 'Grumpy Guardian', true);
        await t.wait(TH.bossCardDelay * 1000 + 120);
        for (const a of ui.feedEl.getAnimations()) try { a.finish(); } catch (e) { /* ignore */ }
        const op = +getComputedStyle(ui.feedEl).opacity;
        t.ok(ui.bosscard.classList.contains('show') && ui.root.classList.contains('bosscard'), '#ui.bosscard while the card shows');
        if (ui.lay === 'port') { t.eq(op, 0, 'portrait: feed hidden'); const a = audit(); t.ok(!a.list.some((p) => p.includes('feed') && p.includes('bosscard')), 'no feed / boss card overlap', a.list); }
        else t.eq(op, 1, ui.lay + ': feed stays');
      } finally { ui.showBossCard('', '', false); }
      t.ok(!ui.root.classList.contains('bosscard'), 'cleared with the card');
      clean(t);
    }],
    ['boss card (r3): in third person it never sits on Pip (the intro shot frames him under its lower-left slot, so it takes the right); first person keeps the slot', async (t) => {
      const { ui, D, game } = t;
      clean(t);
      const run = async (mode) => {
        D.setView(mode); t.frames(2);
        D.cutscene('bossIntro', 'woods'); t.frames(45);          // the intro shot has landed
        await t.wait(TH.bossCardDelay * 1000 + 150);
        for (const a of ui.bosscard.getAnimations()) try { a.finish(); } catch (e) { /* ignore */ }
        const c = R(ui.bosscard), p = game.player.root.position, ft = ui.project(p, game.camera), hd = ui.project({ x: p.x, y: p.y + 1.0, z: p.z }, game.camera);
        const pip = ft && hd ? { left: hd.x - (ft.y - hd.y) * 0.35, right: hd.x + (ft.y - hd.y) * 0.35, top: hd.y, bottom: ft.y } : null;
        const r = { shown: ui.bosscard.classList.contains('show'), flip: ui.bosscard.classList.contains('flip'), over: pip && game.view.bodyOut ? Math.round(inter(c, pip)) : 0, card: [c.left, c.right].map(Math.round), pip: pip && [pip.left, pip.right].map(Math.round) };
        if (game.fight) game.endFight(true);
        ui.showBossCard('', '', false); D.pose('spawn'); t.frames(2);
        return r;
      };
      try {
        const tp = await run('tp'), fp = await run('fp');
        t.note('card', { lay: ui.lay, tp, fp });
        t.ok(tp.shown && tp.over === 0, 'third person: the card is clear of Pip', tp);
        if (ui.lay !== 'port') t.ok(tp.flip, 'third person: on the right', tp);
        t.ok(fp.shown && !fp.flip, 'first person: the usual slot', fp);
      } finally { if (game.fight) game.endFight(true); ui.showBossCard('', '', false); D.setView('fp'); clean(t); }
    }],
    ['r4 boss card on the intro\'s own clock: a pause (or a hidden tab) early in the intro holds it; after Resume it shows for the rest of the intro, and goes with it', async (t) => {
      const { ui, D, game } = t;
      clean(t);
      const shown = () => ui.bosscard.classList.contains('show');
      try {
        reviveBoss(game, 'woods');
        D.cutscene('bossIntro', 'woods'); t.frames(12);                  // 0.2 s in: Esc
        t.ok(game.fight && game.fight.phase === 'intro' && !shown(), 'intro, card not in yet');
        ui.openPause(); t.frames(2);
        await t.wait(TH.bossCardDelay * 1000 + 2800);                       // longer than the whole intro, in real time
        t.frames(30);
        t.ok(ui.menu === 'pause' && game.fight.phase === 'intro' && !shown() && game.fight.t < TH.bossCardDelay, 'paused: the intro and its card wait', { menu: ui.menu, t: game.fight.t, shown: shown() });
        ui.closeMenu(true); await t.wait(130);
        t.frames(Math.ceil((TH.bossCardDelay - game.fight.t) * 60) + 2);
        t.ok(game.fight.phase === 'intro' && shown(), 'resumed: the card comes in on the intro clock', { t: game.fight.t, shown: shown() });
        for (let i = 0; i < 200 && game.fight && game.fight.phase === 'intro'; i++) t.frames(1);
        t.ok(game.fight && game.fight.phase === 'fight' && !shown(), 'and goes with the intro', { phase: game.fight && game.fight.phase, shown: shown() });
      } finally { if (game.fight) game.endFight(true); if (ui.menu) ui.closeMenu(true); ui.showBossCard('', '', false); D.pose('spawn'); clean(t); }
    }],
    ['pickup feed: gem pickups merge into one counting line; toasts and self floaters are feed lines', (t) => {
      const { ui, game, EV } = t;
      clean(t);
      for (let i = 0; i < 3; i++) game.events.emit(EV.COLLECT, { kind: 'gem', value: 5 });
      t.frames(1);
      const g = ui.feed.lines.filter((l) => l.key === 'gems');
      t.ok(g.length === 1 && /\+15 gems/.test(g[0].e.textContent), 'merged', g.map((l) => l.e.textContent));
      ui.toast('No potions! Miso sells them.'); ui.selfFloater('Refreshed!'); ui.selfFloater('+10 gems!');
      t.frames(1);
      const txt = ui.feed.lines.filter((l) => !l.out).map((l) => l.e.textContent);
      t.ok(txt.some((s) => /No potions/.test(s)) && txt.some((s) => /Refreshed! ♥ full/.test(s)) && !txt.some((s) => /\+10 gems/.test(s)), 'lines', txt);
      t.ok(txt.length <= TH.feedMax, 'at most ' + TH.feedMax + ' rows');
      t.frames(Math.ceil(TH.feedLife * 60) + 30);
      clean(t);
    }],
    ['"Controller ready ✿": a pad picked up on the title (or in talk / a menu) gets its note once Pip is free, once', (t) => {
      const { ui, input, game } = t, mod = game.modules.find((m) => m.name === 'wp6-hud');
      clean(t);
      const was = mod.padNoted, notes = () => ui.feed.lines.filter((l) => !l.out && /Controller ready/.test(l.e.textContent)).length;
      try {
        // the title case: the device became 'pad' while no session ran (EV.DEVICE fired then and nobody showed the line)
        mod.padNoted = false; input.setDevice('pad');
        ui.say(['Good morning, Pip!'], {}); t.frames(3);
        t.eq(notes(), 0, 'not under the intro talk');
        t.dlgDone(); t.frames(2);
        t.eq(notes(), 1, 'free to move: the note shows');
        t.frames(3); t.eq(notes(), 1, 'one line, not one per frame');
        ui.feed.clear(); input.setDevice('keyboard'); t.frames(2); input.setDevice('pad'); t.frames(2);
        t.eq(notes(), 0, 'once per visit');
        mod.padNoted = false; ui.feed.clear(); ui.openPause(); t.frames(2);
        t.eq(notes(), 0, 'not under a menu'); ui.closeMenu(true); t.frames(2);
        t.eq(notes(), 1, 'after the menu');
      } finally { input.setDevice('keyboard'); mod.padNoted = was; clean(t); }
    }],
    ['settings card: a tab taller than its box gets a scroll cue (edge fade + "more ▾" chip that scrolls), none when it fits', (t) => {
      const { ui } = t, card = ui.settingsCard, b = card.body, chip = ui.settingsEl.querySelector('.smore');
      ui.openPause(); ui.onPauseChoice(1); t.frames(1);
      try {
        const st = () => ({ over: b.scrollHeight - b.clientHeight, dn: b.classList.contains('more-dn'), up: b.classList.contains('more-up'), chip: card.card.classList.contains('more-dn') });
        // a box shorter than the tab (what a 1280×720 window does to the View tab) and one taller than it
        b.style.maxHeight = '160px'; card.setTab('view'); const a = st();
        t.ok(a.over > 20 && a.dn && a.chip && !a.up, 'overflowing tab: bottom fade + chip', a);
        b.scrollTop = 40; card.cue(); const m = st(); t.ok(m.dn && m.up, 'scrolled part-way: both edges fade', m);
        b.scrollTop = b.scrollHeight; card.cue(); const e = st(); t.ok(!e.dn && e.up && !e.chip, 'at the end: no bottom cue', e);
        // the chip scrolls (instant under Motion comfort, so this test can read it at once)
        b.scrollTop = 0; card.cue(); const rd = ui.reduced; ui.reduced = true;
        try { chip.click(); } finally { ui.reduced = rd; }
        t.ok(b.scrollTop > 60, 'a click on the chip scrolls down', b.scrollTop);
        b.style.maxHeight = ''; card.setTab('sound'); const f = st();
        // (the Sound tab fits on every desktop; on a short phone it may scroll too, and then it must be cued)
        if (f.over <= 2) { t.ok(!f.dn && !f.up && !f.chip, 'a tab that fits: no cue', f); t.eq(getComputedStyle(chip).pointerEvents, 'none', 'hidden chip takes no clicks'); }
        else t.ok(f.dn && f.chip, 'Sound overflows at this size: cued too', f);
      } finally { b.style.maxHeight = ''; ui.closeMenu(true); t.frames(1); }
    }],
    ['r4: the Settings and Controls headings never run under a tab at this viewport (568×320: "Controls" under "Keyboard + mouse")', (t) => {
      const { ui } = t, bad = [];
      try {
        for (const [open, sel] of [[() => { ui.openPause(); ui.onPauseChoice(1); }, '#settings'], [() => ui.openControls(true), '#controls']]) {
          open(); t.frames(2);
          const h = document.querySelector(sel + ' .chead h2'), hr = h && R(h);
          for (const b of document.querySelectorAll(sel + ' .tabs > *')) { const r = R(b); if (hr && inter(hr, r) > 0) bad.push([sel, b.textContent, Math.round(inter(hr, r))]); }
          ui.closeMenu(true); t.frames(1);
        }
        t.eq(bad.length, 0, `heading clear of the tabs at ${innerWidth}×${innerHeight} (${ui.lay})`, bad);
      } finally { if (ui.menu) ui.closeMenu(true); t.frames(1); }
    }],
    ['r4: the "more ▾" chip takes taps on itself (and the gap under it) only, never on the row of buttons it sits on', async (t) => {
      const { ui, D, game } = t, card = ui.settingsCard, b = card.body, se = ui.settingsEl, chip = se.querySelector('.smore');
      // the overlay gets .show on the next animation frame (ui.showOverlay), and with the manual clock's redraw each
      // animation frame waits for a software-WebGL frame of the island: seconds in headless Chromium (CI's wp6 once saw
      // none in 5 s, #58). No redraw here (nothing below reads the 3D view), then wait for that frame itself
      const redraw = game.clock.redraw;
      D.clock({ redraw: false });
      ui.openPause(); ui.onPauseChoice(1); t.frames(1);
      try {
        b.style.maxHeight = '160px'; card.setTab('view'); b.scrollTop = 0; card.cue();
        const f0 = performance.now();
        const framed = await t.nextFrame();
        t.settle();                                   // the opening fade and pop, as a player sees them once settled
        t.note('opened', { framed, frameMs: Math.round(performance.now() - f0), menu: ui.menu, want: se.want, show: se.classList.contains('show'), hidden: se.classList.contains('hidden'), vis: document.visibilityState });
        t.ok(ui.menu === 'settings' && se.classList.contains('show'), 'Settings is open and shown after one frame', { menu: ui.menu, cls: se.className });
        const c = R(chip), at = (x, y) => document.elementFromPoint(x, y), hit = (x, y) => { const e = at(x, y); return !!(e && (e === chip || chip.contains(e))); };
        const r = { on: hit(c.left + c.width / 2, c.top + c.height / 2), above: hit(c.left + c.width / 2, c.top - 3), left: hit(c.left - 4, c.top + c.height / 2), right: hit(c.right + 4, c.top + c.height / 2), under: hit(c.left + c.width / 2, c.bottom + 6) };
        const e0 = at(c.left + c.width / 2, c.top + c.height / 2);
        t.note('chip', { rect: [c.left, c.top, c.right, c.bottom].map(Math.round), ...r, centre: e0 && (e0.id || e0.className || e0.tagName) });
        t.ok(r.on && r.under, 'the chip and the gap under it take the tap', r);
        t.ok(!r.above && !r.left && !r.right, 'beside / above it the row underneath does (was a −10 / −12 px ring)', r);
      } finally { b.style.maxHeight = ''; ui.closeMenu(true); t.frames(1); D.clock({ redraw }); }
    }],
    ['settings card is generated from SCHEMA: every key has a control, except the ones nothing reads (no dead switches)', (t) => {
      const { ui, input } = t;
      ui.openPause(); ui.onPauseChoice(1); t.frames(1);
      const seen = new Set();
      for (const [tab] of [['view'], ['controls'], ['sound'], ['comfort']]) { ui.settingsCard.setTab(tab); ui.settingsCard.rows.forEach((r) => seen.add(r.dataset.k)); }
      // META.hidden marks SCHEMA keys no package reads yet; everything else must have a row. Round 2 built the three
      // missing consumers (arrowLook → input.js, tpAutoRecenter / tpBodyFacesCamera → view/feel.js), so nothing is hidden
      const hidden = Object.keys(SCHEMA).filter((k) => META[k] && META[k].hidden);
      // (a touch-only screen nobody typed on leaves the Keyboard + mouse rows out: they do nothing there; r3)
      const kbmKeys = Object.keys(META).filter((k) => META[k].g === 'Keyboard + mouse'), bare = kbmRowsHidden();
      const missing = Object.keys(SCHEMA).filter((k) => !seen.has(k) && !hidden.includes(k));
      t.eq(missing.join(','), bare ? kbmKeys.join(',') : '', 'keys without a control' + (bare ? ' (touch-only screen: exactly the keyboard + mouse rows)' : ''));
      t.eq(hidden.filter((k) => seen.has(k)).join(','), '', 'hidden keys get no row');
      t.eq(hidden.slice().sort().join(','), '', 'no key is hidden: every setting has a consumer');
      for (const k of ['arrowLook', 'tpAutoRecenter', 'tpBodyFacesCamera']) t.ok(seen.has(k) || (bare && k === 'arrowLook'), k + ' has a row');
      t.ok(seen.has('_mute'), 'mute row');
      // the device in use puts its own group first on the Controls tab (a phone opens on its Touch rows), then Sword and
      // Third person (the TP drift a portrait phone gets by default is not under other devices' rows)
      const groups = () => [...ui.settingsCard.body.querySelectorAll('.sgrp')].map((e) => e.textContent);
      input.setDevice('touch'); ui.settingsCard.setTab('controls'); const gt = groups();
      input.setDevice('pad'); ui.settingsCard.setTab('controls'); const gp = groups();
      input.setDevice('keyboard'); ui.settingsCard.setTab('controls'); const gk = groups();
      t.note('groups', { touch: gt, pad: gp, kbm: gk });
      // (a touch-only screen counts as touch even when the last device reads as the keyboard: it has no mouse)
      let touchOnly = false; try { touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch (e) { /* ignore */ }
      t.ok(gt[0] === 'Touch' && gp[0] === 'Controller' && gk[0] === (touchOnly ? 'Touch' : 'Keyboard + mouse') && gt[1] === 'Sword' && gt[2] === 'Third person', 'device group first, then Sword and Third person', { gt, gp, kbm: gk, touchOnly });
      // the rule itself, on any screen: touch-only and untouched by a keyboard → no keyboard + mouse rows, Touch first
      const card = ui.settingsCard, bareT = card.keysOf('controls', 'touch', true), fullK = card.keysOf('controls', 'kbm', false);
      t.ok(!kbmKeys.some((k) => bareT.includes(k)) && bareT[0] === 'touchSens' && bareT.includes('tpAutoRecenter'), 'touch-only: no keyboard + mouse rows, Touch first', bareT);
      t.ok(kbmKeys.every((k) => fullK.includes(k)) && fullK[0] === 'sens', 'with a keyboard / mouse: all of them, first', fullK);
      ui.closeMenu(true); t.frames(1);
      // the controls card's Touch tab shows touch pictograms (not the mouse / keycap)
      ui.openControls(true); ui.controlsCard.setDev('touch');
      const src = (r) => { const i = r.querySelector('.cico img'); return i ? i.getAttribute('src') : 'none'; }, bad = [iconUrl('pic_mouse'), iconUrl('pic_keycap')].filter(Boolean);
      const pics = [...ui.controlsCard.grid.querySelectorAll('.crow')].slice(0, 2).map(src);
      t.ok(pics.length === 2 && pics.every((s) => !bad.includes(s)), 'touch tab: no mouse / keycap pictograms', pics);
      ui.closeMenu(true); t.frames(1);
    }],
    ['motion comfort caps the full-screen hurt and white flashes (photosensitivity); the steady low-HP tint stays', (t) => {
      const { game, ui } = t, hp = game.S.hp, rd = ui.reduced;
      const frame = (calm, red, white, h) => { ui.reduced = calm; game.S.hp = h; game.redFlash = red; game.whiteFlash = white; ui.frame(game, 0); return { vig: ui.vigA, flash: ui.flA }; };
      try {
        const full = frame(false, 1, 0.9, 6), calm = frame(true, 1, 0.9, 6), tint = frame(true, 0, 0, 1), both = frame(true, 1, 0, 1), faint = frame(true, 0.1, 0.1, 6);
        t.note('flashes', { full, calm, tint, both, faint, cap: TH.flashCap });
        t.ok(Math.abs(full.vig - 0.9) < 2e-3 && Math.abs(full.flash - 0.9) < 2e-3, 'comfort off: the flashes as they were', full);
        t.ok(Math.abs(calm.vig - TH.flashCap) < 2e-3 && Math.abs(calm.flash - TH.flashCap) < 2e-3, 'comfort on: both flashes at the cap', calm);
        t.near(tint.vig, TH.lowBase, 2e-3, 'comfort on: the low-HP tint is steady and not capped');
        t.near(both.vig, TH.flashCap + TH.lowBase, 2e-3, 'comfort on, low HP and hurt: the capped flash over the tint');
        t.ok(Math.abs(faint.vig - 0.09) < 2e-3 && Math.abs(faint.flash - 0.1) < 2e-3, 'comfort on: a flash under the cap is left alone', faint);
      } finally { ui.reduced = rd; game.S.hp = hp; game.redFlash = 0; game.whiteFlash = 0; ui.frame(game, 0); }
    }],
    ['settings change live through the card and persist (FOV, sensitivity, invert, bob, shake)', (t) => {
      const { ui, D, view, game, settings, EV } = t;
      ui.openPause(); ui.onPauseChoice(1); t.frames(1);
      const card = ui.settingsCard, row = (k) => card.rows.find((r) => r.dataset.k === k);
      const slide = (k, v) => { const rg = row(k).querySelector('input[type=range]'); rg.value = v; rg.dispatchEvent(new Event('input', { bubbles: true })); };
      // FOV (View tab): the camera follows at once
      // (the expected camera FOV follows the Hor+ rule, which caps it at 100° tall on portrait phones: there 100 → 110
      // may not move it, and the camera must still equal what the rule says)
      card.setTab('view'); t.eq(view.mode, 'fp', 'first person'); const f0 = game.camera.fov; slide('fovFP', 110); t.frames(1);
      const want = view.baseFov(), moves = want > f0 + 3;
      t.ok(settings.get('fovFP') === 110 && Math.abs(game.camera.fov - want) < 0.5 && (!moves || game.camera.fov > f0 + 3), 'FOV live', { f0, f1: game.camera.fov, want });
      // sensitivity + invert (Controls tab): the next mouse delta turns by the new amount, pitch flips
      card.setTab('controls'); slide('sens', 2); row('invertY').querySelector('.tog').click();
      t.ok(settings.get('sens') === 2 && settings.get('invertY') === true, 'set');
      ui.closeMenu(true); t.frames(1);
      D.look(0, 0); t.frames(1); D.lookDelta(100, 50); t.frames(1);
      t.near(view.yaw, -100 * 0.0022 * 2, 1e-6, 'yaw ×2'); t.ok(view.pitch > 0, 'inverted pitch', view.pitch);
      // bob + shake (Comfort tab): shake scales the trauma pose live; head bob is read by WP1 (EV.SETTINGS emitted)
      ui.openPause(); ui.onPauseChoice(1); card.setTab('comfort'); t.frames(1);
      game.events.clearLog();
      slide('headBob', 0.4); slide('shake', 0);
      t.ok(settings.get('headBob') === 0.4 && settings.get('shake') === 0 && t.events(EV.SETTINGS).some((p) => p.key === 'headBob'), 'bob / shake set, EV.SETTINGS');
      ui.closeMenu(true); t.frames(1);
      view.shake(1); t.frames(3);
      t.near(Math.abs(view.shk.p) + Math.abs(view.shk.y), 0, 1e-9, 'shake 0 → still');
      settings.set('shake', 1); view.shake(1); t.frames(3);
      t.ok(Math.abs(view.shk.p) + Math.abs(view.shk.y) > 1e-4, 'shake 1 → moves');
      // persisted: a fresh Settings reads them back (what a reload does)
      settings.flush();
      const stored = store.get(SETTINGS_KEY), again = new Settings();
      t.ok(stored && stored.fovFP === 110 && stored.sens === 2 && stored.invertY === true && stored.headBob === 0.4, 'stored', stored);
      t.ok(again.get('fovFP') === 110 && again.get('sens') === 2 && again.get('invertY') === true && again.get('headBob') === 0.4, 'reloaded');
      settings.set('headBob', 1);
    }],
    ['menus by keyboard / pad: pause → Settings → change a value → Back → Resume', (t) => {
      const { ui, D, settings } = t;
      settings.set('crosshair', 'dot');
      t.press('pause'); t.frames(2);
      t.eq(ui.menu, 'pause', 'paused');
      t.press('down'); t.frames(1); t.press('interact'); t.frames(2);
      t.eq(ui.menu, 'settings', 'settings opened');
      ui.settingsCard.setTab('view'); ui.settingsCard.f = ui.settingsCard.rows.findIndex((r) => r.dataset.k === 'crosshair'); ui.settingsCard.mark();
      t.press('right'); t.frames(1);
      t.eq(settings.get('crosshair'), 'ring', '→ changes the value');
      t.eq(ui.crossEl.dataset.kind, 'ring', 'live on the crosshair');
      t.press('dash'); t.frames(2);                      // B / Shift: back
      t.eq(ui.menu, 'pause', 'back to pause');
      t.press('up'); t.frames(1); t.press('jump'); t.frames(2);   // A / Space on Resume
      t.eq(ui.menu, null, 'resumed');
      settings.set('crosshair', 'dot'); void D;
    }],
    ['r4: the press that closes a card is the card\'s — V (RB) on the ending\'s "any button" closes it without switching the view; X in third person without swapping the shoulder', (t) => {
      const { ui, view, D } = t;
      clean(t);
      const cb = ui.onEndingClosed;
      const close = (action) => {
        ui.openEnding(); t.frames(2);
        ui.endingT = performance.now() - 2000;   // past its 1.5 s guard
        t.press(action); t.frames(2);
        return ui.menu;
      };
      try {
        ui.onEndingClosed = null;          // (the real one blinks the eyes open: not this test's subject)
        t.eq(close('view'), null, 'V closed the card');
        t.eq(view.mode, 'fp', 'and the view stayed first person (was: third person, saved)');
        D.setView('tp', { instant: true }); t.frames(2);
        const side = view.shoulderSide();
        t.eq(close('shoulder'), null, 'X closed the card');
        t.ok(view.mode === 'tp' && view.shoulderSide() === side, 'and the shoulder stayed', { mode: view.mode, side: view.shoulderSide(), was: side });
      } finally { ui.onEndingClosed = cb; if (ui.menu) ui.closeMenu(true); D.setView('fp', { instant: true }); t.frames(1); }
    }],
    ['chat log: pause → Chat log lists the lines shown, keys formatted for the device; back returns to pause', (t) => {
      const { ui, input } = t;
      clean(t);
      ui.chatLog.length = 0;
      ui.say(['Hello, Pip!', 'Hop with {jump}.'], { name: 'Mayor Ribbit', portrait: 'npc_frog' });
      t.dlgDone(); t.frames(2);
      t.eq(ui.chatLog.length, 2, 'both lines logged');
      input.setDevice('pad');
      ui.openPause(); ui.onPauseChoice(4); t.frames(1);
      t.eq(ui.menu, 'log', 'log open');
      const txt = ui.logEl.querySelector('.lbody').textContent;
      t.ok(/Mayor Ribbit/.test(txt) && /Hello, Pip!/.test(txt) && /Hop with A/.test(txt) && !/\{/.test(txt), 'lines with the pad glyph', txt);
      t.press('dash'); t.frames(2);
      t.eq(ui.menu, 'pause', 'back to pause');
      ui.closeMenu(true); input.setDevice('keyboard'); t.frames(1);
    }],
    ['pointer lock lost → pause opens; the pause key is ignored for 200 ms', async (t) => {
      const { game, ui, input } = t, L = game.lock;
      if (!L || !L.supported) { t.ok(true, 'no pointer-lock API here'); t.note('skipped', true); return; }
      input.setDevice('pad');                           // no automatic lock requests from this test
      t.frames(1);
      L.locked = true; L.wanted = true; L.expectUnlock = false;
      const pre = t.note('pre', { playing: game.playing, busy: game.lockBusy(), trans: !!game.trans, cutscene: !!game.cutscene, menu: ui.menu, dlg: !!ui.dlg, pl: t.pl.state, fight: game.fight && game.fight.phase });
      // a real lock may be held (page.evaluate grants user activation and headless Chromium then grants the lock): the
      // manager compares document.pointerLockElement with its canvas, so it looks at a stand-in canvas for this event
      let lost = 0; const ol = L.onLost, cv = L.canvas; L.onLost = () => { lost++; ol && ol(); }; L.canvas = document.createElement('canvas');
      try { document.dispatchEvent(new Event('pointerlockchange')); } finally { L.onLost = ol; L.canvas = cv; }
      t.eq(ui.menu, 'pause', 'pause opened (pre ' + JSON.stringify(pre) + ' lost ' + lost + ' ' + JSON.stringify(L.info()) + ')');
      t.press('pause'); t.frames(1);
      t.eq(ui.menu, 'pause', 'Esc delivered within 200 ms is ignored');
      await t.wait(220);
      t.press('pause'); t.frames(1);
      t.eq(ui.menu, null, 'after 200 ms it closes');
      L.locked = false; input.setDevice('keyboard');
    }],
    ['touch: controls hide in dialogue, menus and the shop; Use follows the target', (t) => {
      const { game, input, ui, D } = t;
      const was = input.touchVisible;
      input.showTouch(); t.frames(1);
      t.eq(input.touchRoot.style.display, '', 'play: shown');
      D.standAt('sign'); t.frames(4);
      t.ok(!input.useBtn.classList.contains('off') && /Read/.test(input.useBtn.textContent), 'Use shows the verb', input.useBtn.textContent);
      t.press('interact'); t.frames(2);
      t.eq(input.touchRoot.style.display, 'none', 'dialogue: hidden');
      t.dlgDone(); t.frames(2);
      ui.openPause(); t.frames(1);
      t.eq(input.touchRoot.style.display, 'none', 'pause: hidden');
      ui.closeMenu(true); t.frames(1);
      t.eq(input.touchRoot.style.display, '', 'back');
      // cinematics are 'cinema', not 'play': no buttons over a fade, a cutscene with the HUD off or the boss intro
      try {
        game.fadeIn(0.4); t.frames(2);
        t.ok(input.touchMode === 'cinema' && input.touchRoot.style.display === 'none', 'a fade: hidden', input.touchMode);
        t.frames(40);
        t.ok(!game.trans && input.touchMode === 'play' && input.touchRoot.style.display === '', 'after the fade: back', input.touchMode);
        ui.showHud(false); t.frames(1);
        t.ok(input.touchMode === 'cinema' && input.touchRoot.style.display === 'none', 'HUD off (ending, seed placing): hidden');
        ui.showHud(true); t.frames(1);
        D.cutscene('bossIntro', 'woods'); t.frames(3);
        t.ok(game.fight && game.fight.phase === 'intro' && input.touchMode === 'cinema' && input.touchRoot.style.display === 'none', 'boss intro: hidden', { fight: game.fight && game.fight.phase, mode: input.touchMode });
      } finally { D.teleport(0, 9.5, 0, 0); if (game.fight) game.endFight(true); game.trans = null; ui.setFade(0); ui.showHud(true); t.resetPlayer(); t.frames(2); }   // (out of the ring first, or the reset boss starts the intro again)
      t.ok(input.touchMode === 'play' && input.touchRoot.style.display === '', 'play again: shown', input.touchMode);
      if (!was) { input.touchVisible = false; input.touchRoot.classList.add('hidden'); }
      input.setDevice('keyboard'); void game;
    }],
    ['gamepad menus through a stubbed navigator.getGamepads: D-pad ↑↓ moves through the Settings rows and scrolls Controls; LB / RB switch tabs', async (t) => {
      const { ui, input } = t;
      clean(t);
      const btn = () => ({ pressed: false, value: 0 });
      const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, btn), id: 'wp6 test pad', index: 0, timestamp: 0 };
      const own = Object.prototype.hasOwnProperty.call(navigator, 'getGamepads'), old = navigator.getGamepads;
      const press = (i) => { pad.buttons[i] = { pressed: true, value: 1 }; t.frames(2); pad.buttons[i] = btn(); t.frames(3); };
      navigator.getGamepads = () => [pad];
      try {
        t.frames(2);
        press(9); t.eq(ui.menu, 'pause', 'Start: pause');
        press(13); press(0); t.eq(ui.menu, 'settings', 'D-pad ↓, A: Settings');
        const c = ui.settingsCard, tab0 = c.tab;
        press(13); press(13);
        t.ok(c.tab === tab0 && c.f === 1, 'D-pad ↓ ×2 walks into the rows (the tab stays)', { tab: c.tab, f: c.f });
        press(12); t.ok(c.tab === tab0 && c.f === 0, 'D-pad ↑ walks back', { tab: c.tab, f: c.f });
        press(5); t.ok(c.tab !== tab0 && c.f === -1, 'RB: next tab', { tab: c.tab });
        press(4); t.eq(c.tab, tab0, 'LB: previous tab');
        press(1); t.eq(ui.menu, 'pause', 'B: back to pause');
        press(13); press(0); t.eq(ui.menu, 'controls', 'D-pad ↓, A: Controls');
        await t.wait(230);
        const dev = ui.controlsCard.dev;
        press(13); press(12); t.eq(ui.controlsCard.dev, dev, 'D-pad ↑↓ scroll, the device tab stays');
        press(5); t.ok(ui.controlsCard.dev !== dev, 'RB: next device', ui.controlsCard.dev);
        press(1); press(1); t.eq(ui.menu, null, 'B, B: back in play');
      } finally { if (own) navigator.getGamepads = old; else delete navigator.getGamepads; input.padPrev = []; input.setDevice('keyboard'); t.frames(2); ui.closeMenu(true); t.frames(1); }
    }],
    ['C1 edge reticle: a locked target beside / behind points the way to turn (±100°, ±160°); at pitch ±85° it stays in the free area', (t) => {
      const { ui, D, view } = t;
      clean(t);
      D.teleport(0, 9.5, 0, 0); t.frames(1);
      const cx = innerWidth / 2, cy = innerHeight / 2, rows = [];
      const lockAt = (rel, pitchDeg = 0, d = 5) => { t.clearEnemies(); D.look(0, 0); D.spawn('mushroom', d, rel); view.lockOn(D.last); D.look(0, pitchDeg * D2R); t.frames(2); return xy(ui.fx.reticle); };
      for (const rel of [100, -100, 160, -160]) {
        const q = lockAt(rel); rows.push([rel, q]);
        t.ok(ui.fx.retEdge && q && (rel > 0 ? q[0] < cx - 20 : q[0] > cx + 20) && q[1] > cy, (rel > 0 ? 'left' : 'right') + ' and below for ' + rel + '°', q);
        const a = ((+/rotate\(([-\d.]+)deg/.exec(ui.fx.reticle.lastChild.style.transform)[1]) % 360 + 360) % 360;
        t.ok(rel > 0 ? a > 180 : a < 180, 'the arrow points ' + (rel > 0 ? 'left' : 'right') + ' (' + a + '°)');
      }
      const keep = [['compass', ui.compassEl], ['objective', ui.objEl], ['minimap', ui.mini], ['hearts', ui.hearts]];
      for (const [p, d] of [[85, 5], [85, 3], [85, 8], [-85, 5]]) {   // (looking up, the target sits just past the eye plane)
        const q = lockAt(0, p, d); rows.push(['pitch ' + p + ' at ' + d + ' m', q]);
        t.ok(q && (p > 0 ? q[1] > cy : q[1] < cy), 'pitch ' + p + ': ' + (p > 0 ? 'below' : 'above'), q);
        const parts = [R(ui.fx.retIn), R(ui.fx.reticle.querySelector('.ra svg')), ...ui.fx.pips.filter((x) => x.on).map((x) => R(x.in))];
        const hits = []; for (const [n, e] of keep) { const r = R(e); if (r.width > 1) for (const b of parts) if (inter(b, r) > 4) hits.push(n); }
        t.eq(hits.join(','), '', 'pitch ' + p + ': reticle / pips clear of the HUD');
        t.ok(ui.fx.pips.some((x) => x.on && x.who === D.last), 'pitch ' + p + ': the locked pips hang on the edge reticle');
      }
      t.note('rows', rows);
      view.lockOn(null); t.clearEnemies(); t.frames(1);
    }],
    ['projector: the same point as view.worldToScreen in front; behind the eye the edge angle is the real direction', (t) => {
      const { D, view, pl } = t;
      D.look(0, 0); t.frames(1);
      const at = (rel, d, y = 0.6) => { const a = view.yaw + rel * D2R; return { x: pl.pos.x + Math.sin(a) * d, y: pl.pos.y + y, z: pl.pos.z + Math.cos(a) * d }; };
      for (const [rel, d] of [[0, 5], [25, 8], [-30, 3]]) { const a = project(at(rel, d), {}), b = view.worldToScreen(at(rel, d), {}); t.ok(!a.behind && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5, 'same point ' + rel, [a.x, a.y, b.x, b.y]); }
      const L = project(at(150, 5), {}), Rr = project(at(-150, 5), {});
      t.ok(L.behind && Math.sin(L.edgeAngle) < -0.3 && Rr.behind && Math.sin(Rr.edgeAngle) > 0.3, 'behind-left → left, behind-right → right', [L.edgeAngle, Rr.edgeAngle]);
    }],
    ['third person: the prompt pill sits on the target and never on Pip; the coach moves off Pip', (t) => {
      const { ui, D } = t;
      clean(t);
      D.setView('tp'); D.pose('plaza-S'); t.frames(40);
      ui.coach.start(() => {}); t.frames(3);
      let B = pipRect(t), c = R(ui.coachEl);
      t.ok(B && inter(c, B) === 0, 'coach clear of Pip', { coach: [c.left, c.top, c.right, c.bottom].map(Math.round), pip: B && Object.values(B).map(Math.round) });
      ui.coach.stop(); t.frames(1);
      for (const who of ['miso', 'sign']) {
        D.standAt(who); t.frames(40);
        B = pipRect(t); const pr = R(ui.promptEl);
        t.ok(!ui.promptHidden && B && inter(pr, B) === 0 && pr.top >= ui.safeTop - 1, who + ': pill clear of Pip and of the compass', { pill: [pr.left, pr.top, pr.right, pr.bottom].map(Math.round), pip: B && Object.values(B).map(Math.round), safeTop: ui.safeTop });
      }
      D.setView('fp'); D.standAt('sign'); t.frames(6);
      const pr = R(ui.promptEl);
      t.ok(!ui.promptHidden && Math.abs((pr.left + pr.right) / 2 - innerWidth / 2) < 2 && pr.top > innerHeight / 2, 'first person: under the crosshair again', { hidden: ui.promptHidden, pill: [pr.left, pr.top, pr.right, pr.bottom].map(Math.round), tf: ui.promptEl.style.transform, cls: ui.promptEl.className });
    }],
    ['top row: late-game hearts never under the compass or the minimap (8 hearts at 800×600, 820×1180, 640×800 …; and here)', (t) => {
      const { ui, game } = t;
      const bad = [];
      for (const [w, h] of [[640, 800], [700, 600], [800, 600], [820, 1180], [1024, 768], [1280, 720], [1920, 1080], [2560, 1080]]) {
        const u = Math.min(TH.uMax, Math.max(TH.uMin, Math.min(w / 1920, h / 1080) * TH.uK));
        for (const n of [3, 5, 8, 10]) {
          const f = topFit('desk', w, u, n, true), hr = 24 * u + Math.max(Math.min(n, f.cols) * 39 * u - 3 * u, n > f.cols ? 0 : 160 * u), cl = w / 2 - f.cw / 2, cr = w / 2 + f.cw / 2, ml = w - (24 + TH.miniSize) * u;
          if (!(hr + 4 <= cl && cr + 4 <= ml && f.cw >= 200 * u - 0.01)) bad.push([w, h, n, f.cols, Math.round(f.cw), Math.round(hr), Math.round(ml)]);
        }
      }
      t.eq(bad.length, 0, 'fits: ' + JSON.stringify(bad));
      const S = game.S, keep = [S.maxHp, S.hp];
      try {
        S.maxHp = 16; S.hp = 16; t.frames(2);
        const comp = R(ui.compassEl), mini = R(ui.mini), hits = [...ui.hearts.children, ui.counters].filter((e) => inter(R(e), comp) > 0 || (mini.width > 1 && inter(R(e), mini) > 0)).length;
        t.eq(hits, 0, '8 hearts and the counters here (' + innerWidth + '×' + innerHeight + ') clear of the compass / minimap');
      } finally { S.maxHp = keep[0]; S.hp = keep[1]; t.frames(2); }
    }],
    ['menu input runs on the real frame time: the map cursor and a held slider move alike at 30, 60 and 144 Hz', (t) => {
      const { ui, game, D, settings } = t;
      const out = [];
      for (const hz of [30, 60, 144]) {
        const o = { dt: 1 / hz };
        ui.openMap(game.player.pos, t.view.yaw, game.S); t.frames(2, o);
        ui.mapCard.confirm(); const x0 = ui.mapCard.cursor.x;
        D.hold('right'); t.frames(Math.round(hz / 2), o); D.release('right'); t.frames(1, o);
        const mx = ui.mapCard.cursor.x - x0;
        ui.closeMenu(true); t.frames(2, o);
        settings.set('sens', 1);
        ui.openPause(); ui.onPauseChoice(1); ui.settingsCard.setTab('controls');
        ui.settingsCard.f = ui.settingsCard.rows.findIndex((r) => r.dataset.k === 'sens'); ui.settingsCard.mark(false); t.frames(2, o);
        D.hold('right'); t.frames(hz, o); D.release('right'); t.frames(1, o);
        out.push({ hz, mapMetres: +mx.toFixed(1), sens: +settings.get('sens').toFixed(2) });
        ui.closeMenu(true); t.frames(2, o);
      }
      t.note('rates', out);
      settings.set('sens', 1); delete game.S.waypoint;
      t.ok(out.every((r) => Math.abs(r.mapMetres - out[1].mapMetres) < 5), 'map cursor', out);
      t.ok(out.every((r) => Math.abs(r.sens - out[1].sens) < 0.11), 'slider repeat', out);
    }],
    ['compass: the objective, the map marker and the Great Tree pin to the edge when behind, stacked without overlap', (t) => {
      const { ui, game, D, W } = t;
      clean(t);
      const S = game.S, T = W.greatTree;
      D.teleport(T.x + 30, T.z + 30, 0, 0); t.frames(1);
      D.lookAt(T.x, 2, T.z); const y0 = t.view.yaw; D.look(y0 + 150 * D2R, 0);           // the tree behind on one side
      const a = y0 + 8 * D2R; S.waypoint = { x: +(t.pl.pos.x + Math.sin(a) * 40).toFixed(1), z: +(t.pl.pos.z + Math.cos(a) * 40).toFixed(1) };   // the marker beside it
      ui.markersDirty = true; t.frames(2);
      const C = ui.compass, wp = C.els.get('wp'), tree = C.els.get('tree');
      t.ok(wp && wp.parentNode === C.pin && +wp.style.opacity > 0.3, 'the map marker is pinned at the edge');
      const pinned = [...C.pin.children].filter((e) => +e.style.opacity > 0.3), x = (e) => +/translateX\(([-\d.]+)px\)/.exec(e.style.transform)[1];
      const r = 13 * C.h / 38, close = [];
      for (let i = 0; i < pinned.length; i++) for (let j = i + 1; j < pinned.length; j++) if (Math.abs(x(pinned[i]) - x(pinned[j])) < 2 * r - 0.5) close.push([pinned[i].className, pinned[j].className]);
      t.ok(tree && tree.parentNode === C.pin, 'the Great Tree is pinned too');
      t.eq(close.length, 0, 'pinned badges do not overlap: ' + JSON.stringify(close));
      delete S.waypoint; ui.markersDirty = true; t.frames(1);
    }],
    ['key chips stay hidden while the touch controls are up (a touchscreen laptop with a keyboard)', (t) => {
      const { ui, input } = t;
      const was = input.touchVisible;
      try {
        ui.keyHints.until = performance.now() + 5000; input.setDevice('keyboard'); t.frames(2);
        t.ok(ui.keyHintsEl.classList.contains('show'), 'chips for a keyboard');
        input.showTouch(); input.setDevice('keyboard'); t.frames(2);
        t.ok(!ui.keyHintsEl.classList.contains('show'), 'hidden with the touch controls up');
      } finally { if (!was) { input.touchVisible = false; input.touchRoot.classList.add('hidden'); } ui.keyHints.until = 0; input.setDevice('keyboard'); t.frames(1); }
    }],
    ['one source for the volumes and the low-HP heartbeat: an audio layer with setVolumes / heartbeat(k) gets neither from the HUD', (t) => {
      const { ui, game } = t;
      const real = G.audio, calls = [];
      const fake = (own) => Object.assign({ sfx: (n) => calls.push('sfx:' + n), setMusicVolume: () => calls.push('vol'), setSfxVolume: () => calls.push('vol'), has: (n) => n === 'heartbeat', muted: false }, own ? { setVolumes: () => {}, heartbeat: () => {} } : {});
      try {
        G.audio = fake(false); ui.applyVolumes(); game.S.hp = 1; ui.beatN = -5; t.frames(1);
        t.ok(calls.includes('vol') && calls.includes('sfx:heartbeat'), 'foundation audio: the HUD pushes the volumes and plays the beat', calls);
        calls.length = 0; G.audio = fake(true); ui.applyVolumes(); ui.beatN = -5; t.frames(1);
        t.ok(!calls.includes('vol') && !calls.includes('sfx:heartbeat'), 'an audio layer of its own: neither (no squared volume, no second beat)', calls);
      } finally { G.audio = real; game.S.hp = game.S.maxHp; ui.beatN = null; t.frames(1); ui.applyVolumes(); }
    }],
    ['HUD frame CPU p95 ≤ 0.3 ms (turning, walking, enemies, petals, chevrons; per-frame median over 7 replays of one scripted run: load noise drops out, a real regression stays)', (t) => {
      const { ui, D } = t;
      // One scripted 200-frame run (walking, turning, 3 enemies, petals, chevrons), replayed from the same state: seeded
      // random, same pose, same enemies, same input, so frame i of every replay does the same HUD work. On a shared machine
      // wall time only ever ADDS to that work (preemption, a busy sibling core, GC or JIT left over from earlier tests),
      // and it lands on different frames in different replays. So frame i is judged by its median over the replays, and the
      // p95 of those 200 medians against the budget: noise that hits frame i in fewer than half of the replays drops out,
      // while a real regression costs the same in every replay and stays. (The median, not the minimum: performance.now
      // is clamped to 0.1 ms with jitter, so the minimum of a few readings reads up to a step low; the median rounds.)
      // r3: the old median-of-3-runs p95 read 0.5 ms at load 12–15 on the merged tree; injected regressions on this
      // machine at load ~11: +0.25 ms of work per frame → 0.4 (fails), a forced layout per frame → ≥ 0.9 (fails).
      const q = (a, k) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(k * a.length))];
      const replay = () => {
        clean(t); t.clearEnemies(); t.resetPlayer(); D.seed(6006); D.pose('woods');
        D.spawn('slime', 3, 10); D.spawn('bee', 5, -30, 1.2); D.spawn('mushroom', 6, 60);
        t.frames(2); ui.frameMs.length = 0;
        D.move(0, 1);
        for (let i = 0; i < 200; i++) {
          D.lookDelta(5, i % 40 < 20 ? 1 : -1);
          if (i % 30 === 0) D.hud.petal(i * 7);
          if (i % 45 === 0) D.hud.telegraph(140, 6, 0.8);
          t.frames(1);
        }
        D.move(0, 0);
        return ui.frameMs.slice(0, 200);
      };
      const cold = [replay(), replay()], runs = [];     // 2 warm-up replays: a cold page measures the JIT, not the HUD
      for (let k = 0; k < 7; k++) runs.push(replay());
      const med = runs[0].map((_, i) => q(runs.map((r) => r[i] ?? Infinity), 0.5)), est = +q(med, 0.95).toFixed(2);
      const sum = (a) => ({ p50: +q(a, 0.5).toFixed(2), p95: +q(a, 0.95).toFixed(2), mean: +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(3) });
      t.note('cpu', { medianPerFrame: sum(med), perReplay: runs.map((r) => r.length && sum(r).p95), cold: cold.map((r) => sum(r).p95), viewport: innerWidth + 'x' + innerHeight + '@' + devicePixelRatio, timer: 'performance.now (0.1 ms steps)' });
      t.ok(runs.every((r) => r.length === 200), 'one HUD frame per sim frame', runs.map((r) => r.length));
      t.ok(est <= 0.3, 'p95 of the per-frame medians ' + est + ' ms (7 replays)');
      t.clearEnemies();
    }],
  ], { desc: 'WP6 HUD, menus, touch, settings UI', prepare: P });

  suite('wp6-heavy', [
    ['0 NaN or empty style coordinates in a 60 s first-person session', (t) => {
      const { ui, D, game } = t;
      clean(t);
      D.pose('woods');
      const els = () => [...document.querySelectorAll('#hud *, #prompt, #crosshair *, .floater')];
      let bad = 0, seen = 0;
      const check = () => { for (const e of els()) { const s = e.style; if (!s) continue; const v = s.transform + '|' + s.left + '|' + s.top + '|' + s.opacity + '|' + s.width; seen++; if (/NaN|undefined|Infinity/.test(v)) bad++; } };
      for (let sec = 0; sec < 60; sec++) {
        D.move(Math.sin(sec), Math.cos(sec * 0.7));
        if (sec % 6 === 0) { t.clearEnemies(); D.spawn('slime', 3, sec * 13); t.view.lockOn(game.enemies[0] || null); }
        if (sec % 4 === 0) D.hud.petal(sec * 31);
        if (sec % 5 === 0) D.hud.telegraph(sec * 47, 6, 1, t.pl.pos.y + (sec % 10 ? 0.5 : 9));
        if (sec % 7 === 0) game.events.emit('collect', { kind: 'gem', value: 1 });
        if (sec === 20) { D.setView('tp'); }
        if (sec === 40) { D.setView('fp'); }
        for (let f = 0; f < 60; f++) { D.lookDelta(Math.sin(sec + f * 0.05) * 9, Math.cos(sec + f * 0.03) * 3); t.frames(1); }
        check();
      }
      D.move(0, 0); t.view.lockOn(null); t.clearEnemies();
      t.note('sampled', seen);
      t.ok(seen > 1000, 'sampled ' + seen);
      t.eq(bad, 0, 'NaN / empty coordinates');
    }],
    ['overlap audit: 0 forbidden overlaps across the HUD states at this viewport (incl. 8 hearts)', async (t) => {
      const { ui, D, game } = t;
      clean(t);
      // the timeline only advances with rendered frames: on a loaded machine a 380 ms wait can still see a fade halfway,
      // so finite CSS transitions are finished before measuring (the state a player sees once they settle)
      // (and an overlay opened just before gets its .show on the next animation frame, which waits for a software-WebGL
      // frame: one frame is waited for, not assumed within the 380 ms)
      const out = [], A = async (name) => { await t.wait(380); await t.nextFrame(); t.settle(); const a = audit(); out.push([name, a.count, a.list]); };
      D.pose('plaza-S'); t.frames(2); await A('play');
      D.standAt('sign'); t.frames(4); await A('prompt');
      t.press('interact'); t.frames(30); await A('dialogue');
      t.dlgDone(); t.frames(2);
      ui.coach.start(() => {}); t.frames(2); await A('coach'); ui.coach.stop();
      ui.openPause(); t.frames(1); await A('pause');
      for (const tab of ['view', 'controls', 'sound', 'comfort']) { if (ui.menu !== 'settings') ui.onPauseChoice(1); ui.settingsCard.setTab(tab); t.frames(1); await A('settings-' + tab); }
      ui.closeSettings(true); ui.onPauseChoice(2); t.frames(1); await A('controls');
      ui.closeControls(); ui.onPauseChoice(3); t.frames(1); await A('map');
      ui.closeMenu(true); t.frames(1);
      game.S.hp = 2; ui.toast('No potions! Miso sells them.'); game.events.emit('collect', { kind: 'gem', value: 5 }); D.hud.hint('x', 'Hop with {jump}!'); t.frames(2); await A('feed-hint');
      game.S.hp = game.S.maxHp;
      const mh = game.S.maxHp; game.S.maxHp = game.S.hp = 16; t.frames(2); await A('hearts-8');   // late game: 8 heart containers
      game.S.maxHp = game.S.hp = mh; t.frames(2);
      ui.showBanner('Whispering Woods', 'Mind the mushrooms'); t.frames(1); await A('banner');
      D.cutscene('bossIntro', 'woods'); t.frames(40); await A('boss-intro');
      t.frames(130); await A('boss-fight');
      game.endFight(true); D.pose('spawn'); t.frames(2);
      const total = out.reduce((s, r) => s + r[1], 0);
      t.note('states', out.map((r) => r[0] + ':' + r[1]).join(' '));
      if (total) t.note('list', out.filter((r) => r[1]));
      t.eq(total, 0, 'forbidden overlaps');
    }],
  ], { desc: 'WP6 slow checks: 60 s NaN session, overlap audit', prepare: P, heavy: true });
}
