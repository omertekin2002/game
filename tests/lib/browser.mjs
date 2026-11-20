// Shared pieces of the headless-browser tests that run the game from the repo (tests/smoke.mjs, tests/playthrough.mjs, tests/opening.mjs):
// a static server (tools/serve.mjs) on a free port and the Chromium launch options for software WebGL.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

export const SAVE_KEY = 'starseed-isle-save-v2'; // SAVE_KEY in js/data.js
export const SETTINGS_KEY = 'starseed-isle-settings-v1'; // SETTINGS_KEY in js/settings.js

/** the repo root (where tools/serve.mjs serves from) */
export const root = fileURLToPath(new URL('../..', import.meta.url));

/** headless Chromium with software WebGL (SwiftShader), as on a GPU-less CI runner */
export const LAUNCH = {
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
};

export const freePort = () => new Promise((resolve, reject) => {
  const srv = createServer();
  srv.unref();
  srv.on('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

/** tools/serve.mjs on a free port → { proc, url } (kill proc when done) */
export async function startServer() {
  const port = await freePort();
  const proc = spawn(process.execPath, ['tools/serve.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    reject = ((r) => (e) => { proc.kill(); r(e); })(reject);
    const timer = setTimeout(() => reject(new Error('static server did not start within 10 s')), 10_000);
    proc.once('exit', (code) => { clearTimeout(timer); reject(new Error(`static server exited early (code ${code})`)); });
    proc.stdout.on('data', (d) => { if (String(d).includes('http://')) { clearTimeout(timer); resolve(); } });
  });
  return { proc, url: `http://127.0.0.1:${port}/` };
}
