// Voxel-grid downsampling for PLY point clouds, producing app-friendly files
// (binary little-endian, float x/y/z + uchar r/g/b).
//
//   node scripts/prepare-maps.mjs <input.ply> <output.ply> [voxelMeters=0.03] [--no-color]
//
//   --no-color  write xyz only (e.g. synthetic clouds whose colours are all white)
//   Tilted mesh scans: level them first with scripts/align-mesh.mjs.
//
// Reads binary_little_endian or ascii PLYs with any vertex properties (e.g. PCL/RTAB-Map
// exports with normals, curvature and an extra "camera" element). Each occupied voxel becomes
// one point at the average position and color of the points inside it.
import { writeFileSync } from 'node:fs';

import { readPlyVertices } from './lib/ply-read.mjs';

const flags = process.argv.filter((a) => a.startsWith('--'));
const [, , input, output, voxelArg] = process.argv.filter((a) => !a.startsWith('--'));
const noColor = flags.includes('--no-color');
if (!input || !output) {
  console.error('usage: node scripts/prepare-maps.mjs <input.ply> <output.ply> [voxelMeters]');
  process.exit(1);
}
const voxel = Number(voxelArg ?? 0.03);

const ply = readPlyVertices(input);
const ix = ply.index('x'), iy = ply.index('y'), iz = ply.index('z');
const ir = ply.index('red', 'r', 'diffuse_red'), ig = ply.index('green', 'g', 'diffuse_green'), ib = ply.index('blue', 'b', 'diffuse_blue');
const hasColor = !noColor && ir >= 0 && ig >= 0 && ib >= 0;
const n = ply.count;
const values = new Array(ply.props.length);
const readVertex = (i) => ply.read(i, values);

// Voxel grid: accumulate sums per occupied cell.
const cells = new Map();
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < n; i++) {
  readVertex(i);
  const x = values[ix], y = values[iy], z = values[iz];
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
  min[0] = Math.min(min[0], x); min[1] = Math.min(min[1], y); min[2] = Math.min(min[2], z);
  max[0] = Math.max(max[0], x); max[1] = Math.max(max[1], y); max[2] = Math.max(max[2], z);
  const key = `${Math.floor(x / voxel)},${Math.floor(y / voxel)},${Math.floor(z / voxel)}`;
  let c = cells.get(key);
  if (!c) cells.set(key, (c = [0, 0, 0, 0, 0, 0, 0]));
  c[0] += x; c[1] += y; c[2] += z;
  if (hasColor) { c[3] += values[ir]; c[4] += values[ig]; c[5] += values[ib]; }
  c[6]++;
}

const pts = [...cells.values()].map((c) => [c[0] / c[6], c[1] / c[6], c[2] / c[6], c[3] / c[6], c[4] / c[6], c[5] / c[6]]);

const stride = hasColor ? 15 : 12;
const out = Buffer.alloc(pts.length * stride);
let o = 0;
for (const p of pts) {
  out.writeFloatLE(p[0], o); out.writeFloatLE(p[1], o + 4); out.writeFloatLE(p[2], o + 8);
  if (hasColor) {
    out.writeUInt8(Math.round(p[3]), o + 12); out.writeUInt8(Math.round(p[4]), o + 13); out.writeUInt8(Math.round(p[5]), o + 14);
  }
  o += stride;
}
const header =
  `ply\nformat binary_little_endian 1.0\ncomment voxel ${voxel} m from ${input.split('/').slice(-3).join('/')}\n` +
  `element vertex ${pts.length}\nproperty float x\nproperty float y\nproperty float z\n` +
  (hasColor ? 'property uchar red\nproperty uchar green\nproperty uchar blue\n' : '') +
  'end_header\n';
writeFileSync(output, Buffer.concat([Buffer.from(header, 'ascii'), out]));

const f = (v) => v.toFixed(2);
console.log(
  `${n} -> ${cells.size} points (voxel ${voxel} m), ${(out.length / 1048576).toFixed(1)} MB` +
  `\n  extent x ${f(min[0])}..${f(max[0])}  y ${f(min[1])}..${f(max[1])}  z ${f(min[2])}..${f(max[2])}` +
  `\n  size ${f(max[0] - min[0])} x ${f(max[1] - min[1])} x ${f(max[2] - min[2])} m, color: ${hasColor}`,
);
