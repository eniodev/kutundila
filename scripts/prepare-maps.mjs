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
import { readFileSync, writeFileSync } from 'node:fs';

const flags = process.argv.filter((a) => a.startsWith('--'));
const [, , input, output, voxelArg] = process.argv.filter((a) => !a.startsWith('--'));
const noColor = flags.includes('--no-color');
if (!input || !output) {
  console.error('usage: node scripts/prepare-maps.mjs <input.ply> <output.ply> [voxelMeters]');
  process.exit(1);
}
const voxel = Number(voxelArg ?? 0.03);

const SIZES = {
  char: 1, uchar: 1, int8: 1, uint8: 1, short: 2, ushort: 2, int16: 2, uint16: 2,
  int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8,
};

const buf = readFileSync(input);
const headerEnd = buf.indexOf('end_header');
if (headerEnd < 0) throw new Error('no end_header');
const bodyStart = buf.indexOf('\n', headerEnd) + 1;
const headerLines = buf.subarray(0, headerEnd).toString('latin1').split(/\r?\n/);

let format = '';
const elements = [];
for (const line of headerLines) {
  const p = line.trim().split(/\s+/);
  if (p[0] === 'format') format = p[1];
  else if (p[0] === 'element') elements.push({ name: p[1], count: Number(p[2]), props: [] });
  else if (p[0] === 'property') {
    const el = elements[elements.length - 1];
    if (p[1] === 'list') el.props.push({ list: true, countType: p[2], type: p[3], name: p[4] });
    else el.props.push({ type: p[1], name: p[2] });
  }
}
if (elements[0]?.name !== 'vertex') throw new Error('expected vertex as the first element');
const vertex = elements[0];
if (vertex.props.some((p) => p.list)) throw new Error('list properties in vertex not supported');

const idx = (names) => vertex.props.findIndex((p) => names.includes(p.name));
const ix = idx(['x']), iy = idx(['y']), iz = idx(['z']);
const ir = idx(['red', 'r', 'diffuse_red']), ig = idx(['green', 'g', 'diffuse_green']), ib = idx(['blue', 'b', 'diffuse_blue']);
const hasColor = !noColor && ir >= 0 && ig >= 0 && ib >= 0;

// Read every vertex as an array of numbers.
const n = vertex.count;
const values = new Array(vertex.props.length);
let readVertex;
if (format === 'binary_little_endian') {
  const offsets = [];
  let stride = 0;
  for (const p of vertex.props) { offsets.push(stride); stride += SIZES[p.type]; }
  const dv = new DataView(buf.buffer, buf.byteOffset + bodyStart);
  const readers = vertex.props.map((p, k) => {
    const o = offsets[k];
    switch (p.type) {
      case 'float': case 'float32': return (b) => dv.getFloat32(b + o, true);
      case 'double': case 'float64': return (b) => dv.getFloat64(b + o, true);
      case 'uchar': case 'uint8': return (b) => dv.getUint8(b + o);
      case 'char': case 'int8': return (b) => dv.getInt8(b + o);
      case 'ushort': case 'uint16': return (b) => dv.getUint16(b + o, true);
      case 'short': case 'int16': return (b) => dv.getInt16(b + o, true);
      case 'uint': case 'uint32': return (b) => dv.getUint32(b + o, true);
      default: return (b) => dv.getInt32(b + o, true);
    }
  });
  readVertex = (i) => { const b = i * stride; for (let k = 0; k < readers.length; k++) values[k] = readers[k](b); };
} else if (format === 'ascii') {
  const lines = buf.subarray(bodyStart).toString('latin1').split(/\r?\n/);
  readVertex = (i) => { const p = lines[i].trim().split(/\s+/); for (let k = 0; k < values.length; k++) values[k] = Number(p[k]); };
} else {
  throw new Error(`unsupported format ${format}`);
}

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
