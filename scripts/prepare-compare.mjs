// Builds a before/after-ready map from a twin-mapping run: real colours from the SLAM cloud plus
// the evaluation's per-point error class, voxel-downsampled, in the world frame.
//
//   node scripts/prepare-compare.mjs --rgb <cloud.ply> --errors <error_cloud.ply> --out <out.ply>
//        [--offset=-10.5,-6.75,0] [--voxel=0.07] [--poses <rtabmap_poses.txt> --trajectory <out.json>]
//
// --rgb      coloured cloud in the map frame (export/rtabmap_cloud.ply or map/map_clean.ply)
// --errors   eval error_cloud.ply in the world frame (grey static, yellow small error,
//            blue other error, red dynamic residue)
// --offset   map → world translation (twin-mapping: map frame = rig spawn pose, the first
//            scenario waypoint, facing +X)
// Output vertex properties: x y z red green blue class, with class 0 static, 1 small error,
// 2 other error, 3 dynamic residue (a voxel takes the worst class of the points inside it).
import { readFileSync, writeFileSync } from 'node:fs';

import { readPlyVertices } from './lib/ply-read.mjs';

const argv = process.argv.slice(2);
const opt = (name) => {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const rgbPath = opt('rgb'), errPath = opt('errors'), outPath = opt('out');
if (!rgbPath || !errPath || !outPath) {
  console.error('usage: see header of scripts/prepare-compare.mjs');
  process.exit(1);
}
const offset = (opt('offset') ?? '-10.5,-6.75,0').split(',').map(Number);
const voxel = Number(opt('voxel') ?? 0.07);
const key = (x, y, z) => `${Math.floor(x / voxel)},${Math.floor(y / voxel)},${Math.floor(z / voxel)}`;

// Error classes from the evaluation colours.
const classOf = (r, g, b) => (r > 200 && g < 60 ? 3 : b > 200 && r < 80 ? 2 : r > 200 && g > 180 && b < 60 ? 1 : 0);
const err = readPlyVertices(errPath);
const ev = new Array(err.props.length);
const [ex, ey, ez, er, eg, eb] = ['x', 'y', 'z', 'red', 'green', 'blue'].map((n) => err.index(n));
const classes = new Map();
const classCount = [0, 0, 0, 0];
const errMean = [0, 0, 0];
for (let i = 0; i < err.count; i++) {
  err.read(i, ev);
  const c = classOf(ev[er], ev[eg], ev[eb]);
  classCount[c]++;
  errMean[0] += ev[ex]; errMean[1] += ev[ey]; errMean[2] += ev[ez];
  const k = key(ev[ex], ev[ey], ev[ez]);
  if ((classes.get(k) ?? -1) < c) classes.set(k, c);
}
errMean.forEach((_, k) => (errMean[k] /= err.count));

// Coloured cloud, shifted into the world frame and voxel-averaged.
const rgb = readPlyVertices(rgbPath);
const rv = new Array(rgb.props.length);
const [rx, ry, rz, rr, rg, rb] = ['x', 'y', 'z', 'red', 'green', 'blue'].map((n) => rgb.index(n));
const cells = new Map();
const rgbMean = [0, 0, 0];
for (let i = 0; i < rgb.count; i++) {
  rgb.read(i, rv);
  const x = rv[rx] + offset[0], y = rv[ry] + offset[1], z = rv[rz] + offset[2];
  rgbMean[0] += x; rgbMean[1] += y; rgbMean[2] += z;
  const k = key(x, y, z);
  let c = cells.get(k);
  if (!c) cells.set(k, (c = [0, 0, 0, 0, 0, 0, 0]));
  c[0] += x; c[1] += y; c[2] += z; c[3] += rv[rr]; c[4] += rv[rg]; c[5] += rv[rb]; c[6]++;
}
rgbMean.forEach((_, k) => (rgbMean[k] /= rgb.count));
const drift = Math.hypot(rgbMean[0] - errMean[0], rgbMean[1] - errMean[1], rgbMean[2] - errMean[2]);
console.log(`centroid check (rgb shifted vs errors): ${drift.toFixed(3)} m apart${drift > 0.25 ? '  ⚠ check --offset' : ''}`);

const out = Buffer.alloc(cells.size * 16);
let o = 0;
const outCount = [0, 0, 0, 0];
for (const [k, c] of cells) {
  const n = c[6];
  const cls = classes.get(k) ?? 0;
  outCount[cls]++;
  out.writeFloatLE(c[0] / n, o); out.writeFloatLE(c[1] / n, o + 4); out.writeFloatLE(c[2] / n, o + 8);
  out[o + 12] = Math.round(c[3] / n); out[o + 13] = Math.round(c[4] / n); out[o + 14] = Math.round(c[5] / n);
  out[o + 15] = cls;
  o += 16;
}
const header =
  `ply\nformat binary_little_endian 1.0\ncomment world frame, ${voxel} m voxels, class 0 static 1 small 2 other 3 dynamic\n` +
  `element vertex ${cells.size}\nproperty float x\nproperty float y\nproperty float z\n` +
  'property uchar red\nproperty uchar green\nproperty uchar blue\nproperty uchar class\nend_header\n';
writeFileSync(outPath, Buffer.concat([Buffer.from(header, 'ascii'), out]));
console.log(`${rgb.count} -> ${cells.size} points; error classes in source ${classCount.join('/')}, in output voxels ${outCount.join('/')}`);

// Optional robot trajectory (RTAB-Map poses, map frame) → world-frame [x, y, z] list.
const posesPath = opt('poses'), trajPath = opt('trajectory');
if (posesPath && trajPath) {
  const pts = readFileSync(posesPath, 'utf8').split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.trim().split(/\s+/).slice(1, 4).map(Number))
    .map(([x, y, z], i) => [x + offset[0], y + offset[1], z + offset[2]].map((v) => Math.round(v * 100) / 100));
  writeFileSync(trajPath, JSON.stringify(pts));
  console.log(`trajectory: ${pts.length} poses -> ${trajPath}`);
}
