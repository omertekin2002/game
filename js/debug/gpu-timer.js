// GPU pass timer (EXT_disjoint_timer_query_webgl2) for G.debug.perf: begin(tag) / end(tag) around a pass, results
// arrive a few frames later through poll(); samples from a disjoint interval are dropped. One query open at a time
// (TIME_ELAPSED queries cannot nest). Game.gpuT holds an instance only while perf() samples; passes check it.
// r4: a lost WebGL context (driver reset, GPU switch, sleep, a phone dropping it in the background) kills every query and
// the extension object: on 'webglcontextlost' the open and pending queries are forgotten (never deleted: they belong to
// the dead context) and nothing is timed; on 'webglcontextrestored' the extension is fetched again on the new context.
// poll() also drops a query whose availability reads null (not this context's) instead of waiting on it forever.
const EXT = 'EXT_disjoint_timer_query_webgl2';
export class GpuTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl ? gl.getExtension(EXT) : null;
    this.pending = []; this.samples = {}; this.open = null; this.dropped = 0; this.lost = false; this.restored = 0;
    const cv = gl && gl.canvas;
    if (cv && cv.addEventListener) {
      this._onLost = () => this.contextLost();
      this._onRestored = () => this.contextRestored();
      cv.addEventListener('webglcontextlost', this._onLost);
      cv.addEventListener('webglcontextrestored', this._onRestored);
    }
  }
  get ok() { return !!this.ext && !this.lost; }
  dead() { return this.lost || !!(this.gl && this.gl.isContextLost && this.gl.isContextLost()); }
  contextLost() { this.lost = true; this.open = null; this.pending.length = 0; }
  contextRestored() { this.lost = false; this.open = null; this.pending.length = 0; this.ext = this.gl ? this.gl.getExtension(EXT) : null; this.restored++; }
  begin(tag) {
    if (!this.ext || this.open || this.dead()) return;
    const q = this.gl.createQuery();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.open = { q, tag };
  }
  end(tag) {
    if (!this.open || this.open.tag !== tag) return;
    if (this.dead()) { this.open = null; return; }
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.open);
    this.open = null;
  }
  /** collect finished queries → samples[tag] (ms) */
  poll() {
    const gl = this.gl;
    if (this.dead()) return;
    while (this.pending.length) {
      const p = this.pending[0];
      const av = gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE);
      if (av === null) { this.pending.shift(); this.dropped++; continue; }   // not this context's query
      if (!av) break;
      const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT), ns = gl.getQueryParameter(p.q, gl.QUERY_RESULT);
      if (disjoint) this.dropped++; else (this.samples[p.tag] || (this.samples[p.tag] = [])).push(ns / 1e6);
      gl.deleteQuery(p.q);
      this.pending.shift();
    }
  }
  dispose() {
    const cv = this.gl && this.gl.canvas;
    if (cv && cv.removeEventListener && this._onLost) { cv.removeEventListener('webglcontextlost', this._onLost); cv.removeEventListener('webglcontextrestored', this._onRestored); }
    if (this.dead()) { this.open = null; this.pending = []; return; }
    if (this.open) { try { this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); } catch (e) { /* ignore */ } this.pending.push(this.open); this.open = null; }
    for (const p of this.pending) this.gl.deleteQuery(p.q);
    this.pending = [];
  }
}
/** p50 / p90 / n of a list of numbers */
export function pct(a) {
  if (!a || !a.length) return null;
  const s = a.slice().sort((x, y) => x - y), q = (k) => +s[Math.min(s.length - 1, Math.floor(k * s.length))].toFixed(3);
  return { p50: q(0.5), p90: q(0.9), n: s.length };
}
