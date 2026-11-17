// World grid dimensions. Own module so world.js and world-collide.js share them without an import cycle
// (world.js re-exports them for older importers).
export const SIZE = 360, HALF = 180, N = SIZE + 1;
export const CHUNK = 40;
export const NCH = Math.ceil(SIZE / CHUNK);
