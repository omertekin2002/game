// Module registry: one line per work package; each package edits only its own line and its own file.
// A module is a plain object; every hook is optional and each call is wrapped in try/catch by Game._call:
//   attach(game), onSession(isNew), onTitle(), onModal(modal, prev), onResize(w, h),
//   frameInput(input, dt), beforeStep(dt), intent(it, canAct) (adjust this step's player intent), afterStep(dt),
//   beforeCamera(alpha, dt), afterCamera(alpha, dt), afterRender(renderer, dt)
import wp1 from './view/feel.js';        // WP1 camera feel + cinematics
import wp2 from './view/viewmodel.js';   // WP2 viewmodel
import wp3 from './player-fx.js';        // WP3 player physics FX
import wp4 from './targeting.js';        // WP4 combat targeting
import wp5 from './actors-mod.js';       // WP5 actors + audio
import wp6 from './hud/hud.js';          // WP6 HUD
import wp7 from './perf/perf.js';        // WP7 perf
import wp8 from './atmo.js';             // WP8 atmosphere
import wp9 from './world-mod.js';        // WP9 world content

export const MODULES = [wp1, wp2, wp3, wp4, wp5, wp6, wp7, wp8, wp9];

export const HOOKS = ['attach', 'onSession', 'onTitle', 'onModal', 'onResize', 'frameInput', 'beforeStep', 'intent', 'afterStep', 'beforeCamera', 'afterCamera', 'afterRender'];
