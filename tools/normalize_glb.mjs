#!/usr/bin/env node
// Normalise a generated GLB for the game:
//   origin at bottom-centre (feet), facing +Z (after --yaw), exactly 1 unit tall,
//   optional triangle simplification, textures resized + re-encoded.
//
// Usage: node tools/normalize_glb.mjs IN.glb OUT.glb [--yaw DEG] [--tris N] [--tex 1024] [--info]
//   --yaw   rotate around +Y (degrees) before normalising, to make the model face +Z
//   --tris  simplify to at most N triangles (meshoptimizer)
//   --tex   max texture size (default 1024), re-encoded as JPEG (opaque) or PNG (with alpha)
//   --zs    extra depth (Z) scale after rotation, e.g. 1.4 to thicken a model that came out too flat
//   --info  only print stats
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, simplify, textureCompress, weld, transformMesh } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const [inp, out] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--info'));
const yaw = parseFloat(opt('yaw', '0'));
const maxTris = parseInt(opt('tris', '0'), 10);
const texSize = parseInt(opt('tex', '1024'), 10);
const infoOnly = args.includes('--info');
const zs = parseFloat(opt('zs', '1'));

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const root = doc.getRoot();

function tris() {
  let n = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const idx = p.getIndices();
    n += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  return n;
}
function stats(label) {
  const b = getBounds(root.listScenes()[0]);
  const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(3));
  const tex = root.listTextures().map((t) => `${t.getMimeType()} ${t.getSize()?.join('x')}`);
  console.log(`${label}: size=${JSON.stringify(size)} min=${JSON.stringify(b.min.map((v) => +v.toFixed(3)))} tris=${tris()} meshes=${root.listMeshes().length} nodes=${root.listNodes().length} tex=[${tex.join(', ')}]`);
  return b;
}

stats('in ');
if (infoOnly) process.exit(0);

await doc.transform(flatten(), join(), weld());

// Bake world transforms into the meshes, applying yaw, then recentre + scale to 1 unit tall.
const c = Math.cos((yaw * Math.PI) / 180), s = Math.sin((yaw * Math.PI) / 180);
const rotY = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; // column-major
const mul = (a, b) => { // column-major 4x4
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
  return r;
};
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  transformMesh(mesh, mul(rotY, node.getWorldMatrix()));
  node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
}
for (const node of root.listNodes()) if (!node.getMesh()) node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);

const b = getBounds(root.listScenes()[0]);
const h = b.max[1] - b.min[1];
const k = 1 / h;
const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
const norm = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k * zs, 0, -cx * k, -b.min[1] * k, -cz * k * zs, 1];
for (const mesh of root.listMeshes()) transformMesh(mesh, norm);

if (maxTris && tris() > maxTris) {
  await MeshoptSimplifier.ready;
  const ratio = maxTris / tris();
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false }));
}
await doc.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, resize: [texSize, texSize], targetFormat: 'jpeg', quality: 88, slots: /baseColor/ }),
);
stats('out');
await io.write(out, doc);
console.log('wrote', out);
