// Shared namespace + guarded audio. window.G already holds G.audio (classic script) — never clobber it.
export const G = (window.G = window.G || {});
// debugAllowed: this load has ?debug=1 (the overlay, its ` toggle, the cheat keys and the in-page tests exist only then);
// debugOn: the overlay / debug logging right now (` flips it, only while allowed)
G.debugAllowed = /[?&]debug=1/.test(location.search);
G.debugOn = G.debugAllowed;
const NOAUDIO = /[?&]noaudio=1/.test(location.search);   // test flag: every audio call is a no-op

function A(name, ...args) {
  if (NOAUDIO) return undefined;
  try {
    const a = G.audio;
    if (a && typeof a[name] === 'function') return a[name](...args);
  } catch (e) { /* audio must never crash the game */ }
  return undefined;
}
export const sfx = (n, o) => A('sfx', n, o); // opts ({ x, y, z, vol, rate }) are ignored until positional audio lands
export const music = (t) => A('music', t);
export const audioInit = () => A('init');
export const toggleMute = () => A('toggleMute');
export function isMuted() { try { return !!(G.audio && G.audio.muted); } catch (e) { return false; } }

export function spriteUrl(key) {
  const m = window.ASSET_MANIFEST;
  const s = m && m.sprites && m.sprites[key];
  return s ? (typeof s === 'string' ? s : s.src) : null;
}

export const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
