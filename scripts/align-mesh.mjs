// Levels a tilted indoor mesh scan (e.g. BundleFusion, stored in the first camera's frame) and
// writes its vertices as an axis-aligned, Z-up point cloud PLY (xyz + rgb) for prepare-maps.mjs.
//
//   node scripts/align-mesh.mjs <input.ply> <output.ply> [--up=-y]
//
// 1. Up: area-weighted mean of face normals within 25° of the current estimate, iterated from a
//    prior (default −Y, i.e. camera Y pointing down). Horizontal surfaces (floor, tables, ceiling)
//    dominate this cluster, so it converges on the gravity direction.
// 2. Heading: circular mean of 4·θ over wall normals (Manhattan world), so walls line up with X/Y.
// 3. Floor at z = 0.
// Only binary_little_endian with float xyz, uchar rgb[a] and "list uchar int" faces is supported.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const [input, output] = args.filter((a) => !a.startsWith('--'));
const upArg = (args.find((a) => a.startsWith('--up=')) ?? '--up=-y').slice(5);
const prior = { x: [1, 0, 0], '-x': [-1, 0, 0], y: [0, 1, 0], '-y': [0, -1, 0], z: [0, 0, 1], '-z': [0, 0, -1] }[upArg];
if (!input || !output || !prior) {
  console.error('usage: node scripts/align-mesh.mjs <input.ply> <output.ply> [--up=-y|y|z|-z|x|-x]');
  process.exit(1);
}

const SIZES = { char: 1, uchar: 1, short: 2, ushort: 2, int: 4, uint: 4, float: 4, double: 8 };
const buf = readFileSync(input);
const headerEnd = buf.indexOf('end_header');
const body = buf.indexOf('\n', headerEnd) + 1;
const lines = buf.subarray(0, headerEnd).toString('latin1').split(/\r?\n/);
const elements = [];
for (const l of lines) {
  const p = l.trim().split(/\s+/);
  if (p[0] === 'format' && p[1] !== 'binary_little_endian') throw new Error('binary_little_endian only');
  if (p[0] === 'element') elements.push({ name: p[1], count: +p[2], props: [] });
  if (p[0] === 'property') elements.at(-1).props.push(p[1] === 'list' ? { list: true, c: p[2], t: p[3] } : { t: p[1], name: p[2] });
}
const [V, F] = elements;
if (V.name !== 'vertex' || F?.name !== 'face') throw new Error('expected vertex then face elements');
const off = {}; let stride = 0;
for (const p of V.props) { off[p.name] = stride; stride += SIZES[p.t]; }
const fp = F.props[0];
if (!(fp.list && fp.c === 'uchar' && (fp.t === 'int' || fp.t === 'uint') && F.props.length === 1)) throw new Error('faces must be list uchar int');

const n = V.count;
const dv = new DataView(buf.buffer, buf.byteOffset + body);
const pos = new Float32Array(n * 3), col = new Uint8Array(n * 3);
for (let i = 0; i < n; i++) {
  const b = i * stride;
  pos[i * 3] = dv.getFloat32(b + off.x, true); pos[i * 3 + 1] = dv.getFloat32(b + off.y, true); pos[i * 3 + 2] = dv.getFloat32(b + off.z, true);
  col[i * 3] = dv.getUint8(b + off.red); col[i * 3 + 1] = dv.getUint8(b + off.green); col[i * 3 + 2] = dv.getUint8(b + off.blue);
}

// Area-weighted face normals (cross product length = 2·area).
const normals = new Float32Array(F.count * 3);
let o = n * stride;
for (let f = 0; f < F.count; f++) {
  const k = dv.getUint8(o); o += 1;
  const a = dv.getInt32(o, true), b = dv.getInt32(o + 4, true), c = dv.getInt32(o + 8, true);
  o += 4 * k;
  const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2];
  const vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
  normals[f * 3] = uy * vz - uz * vy; normals[f * 3 + 1] = uz * vx - ux * vz; normals[f * 3 + 2] = ux * vy - uy * vx;
}

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// 1. Up direction by iterated cone mean (sign-agnostic: flip normals into the up hemisphere).
let up = prior.slice();
const cosCone = Math.cos((25 * Math.PI) / 180);
for (let it = 0; it < 30; it++) {
  const sum = [0, 0, 0];
  for (let f = 0; f < F.count; f++) {
    const m = [normals[f * 3], normals[f * 3 + 1], normals[f * 3 + 2]];
    const len = Math.hypot(...m); if (!len) continue;
    const d = dot(m, up) / len;
    if (Math.abs(d) < cosCone) continue;
    const s = d > 0 ? 1 : -1;
    sum[0] += s * m[0]; sum[1] += s * m[1]; sum[2] += s * m[2];
  }
  up = norm(sum);
}
console.log(`up = [${up.map((v) => v.toFixed(3))}], ${((Math.acos(Math.min(1, dot(up, prior))) * 180) / Math.PI).toFixed(1)}° from prior`);

// Horizontal basis.
let ex = norm(cross(Math.abs(up[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], up));
let ey = cross(up, ex);

// 2. Wall heading: circular mean of 4θ for near-horizontal normals (walls), area-weighted.
let s4 = 0, c4 = 0;
for (let f = 0; f < F.count; f++) {
  const m = [normals[f * 3], normals[f * 3 + 1], normals[f * 3 + 2]];
  const len = Math.hypot(...m); if (!len) continue;
  if (Math.abs(dot(m, up)) / len > 0.3) continue;
  const th = Math.atan2(dot(m, ey), dot(m, ex));
  s4 += len * Math.sin(4 * th); c4 += len * Math.cos(4 * th);
}
const heading = Math.atan2(s4, c4) / 4;
const ch = Math.cos(heading), sh = Math.sin(heading);
const ax = ex.map((v, i) => ch * v + sh * ey[i]);
const ay = cross(up, ax);
console.log(`wall heading ${((heading * 180) / Math.PI).toFixed(1)}° (Manhattan strength ${(Math.hypot(s4, c4) / 1).toExponential(2)})`);

// 3. Rotate into (ax, ay, up), floor at z = 0.
const out = Buffer.alloc(n * 15);
let zmin = Infinity;
const rot = new Float32Array(n * 3);
for (let i = 0; i < n; i++) {
  const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  rot[i * 3] = dot(p, ax); rot[i * 3 + 1] = dot(p, ay); rot[i * 3 + 2] = dot(p, up);
  zmin = Math.min(zmin, rot[i * 3 + 2]);
}
for (let i = 0; i < n; i++) {
  const b = i * 15;
  out.writeFloatLE(rot[i * 3], b); out.writeFloatLE(rot[i * 3 + 1], b + 4); out.writeFloatLE(rot[i * 3 + 2] - zmin, b + 8);
  out[b + 12] = col[i * 3]; out[b + 13] = col[i * 3 + 1]; out[b + 14] = col[i * 3 + 2];
}
const header = `ply\nformat binary_little_endian 1.0\ncomment aligned Z-up by align-mesh.mjs\nelement vertex ${n}\n` +
  'property float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n';
writeFileSync(output, Buffer.concat([Buffer.from(header, 'ascii'), out]));
console.log(`wrote ${n} vertices`);
