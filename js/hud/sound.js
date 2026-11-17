// UI sounds (contract C8): the menus ask for the new names (uiMove, uiSelect, uiBack, uiOpen, uiClose, uiTab, uiSlider,
// coach, waypoint, heartbeat). Until the audio layer (WP5) has a name, its legacy sound plays instead, never both.
import { G, sfx } from '../core.js';

const LEGACY = { uiMove: 'menu', uiSelect: 'select', uiBack: 'cancel', uiOpen: 'menu', uiClose: 'cancel', uiTab: 'menu', uiSlider: 'menu', coach: 'select', waypoint: 'select' };
/** true when the audio layer knows the name (G.audio.has(name), else its sfxNames list) */
export function hasSfx(name) {
  const a = G.audio;
  if (!a) return false;
  try { if (typeof a.has === 'function') return !!a.has(name); return Array.isArray(a.sfxNames) && a.sfxNames.includes(name); } catch (e) { return false; }
}
/** play a UI sound by its new name, falling back to the legacy one (or silence) */
export function uiSfx(name, opts) { sfx(hasSfx(name) || !LEGACY[name] ? name : LEGACY[name], opts); }
