// Generates synthetic PLY test files in test-maps/generated/ (not bundled; handy for import tests).
//   node scripts/generate-samples.mjs
//
// sample_room.ply  - binary little-endian point cloud with RGB, Z-up (like a SLAM/ROS export).
//                    An 8 x 5 m room, 2.6 m walls, no ceiling, a few "furniture" boxes and a pillar.
// sample_torus.ply - ASCII mesh with faces, no color, Y-up.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-maps', 'generated');
mkdirSync(outDir, { recursive: true });

// Deterministic PRNG so regenerating produces identical files.
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = (s = 0.01) => (rand() - 0.5) * 2 * s;

// ---------- Room point cloud ----------
const pts = []; // [x, y, z, r, g, b]
const add = (x, y, z, [r, g, b], jitter = 12) => {
  const j = () => Math.round(noise(jitter));
  const c = (v) => Math.max(0, Math.min(255, v + j()));
  pts.push([x + noise(), y + noise(), z + noise(), c(r), c(g), c(b)]);
};

const W = 8, D = 5, H = 2.6;
const density = 900; // points per m²

function plane(origin, u, v, color) {
  const area = Math.hypot(...u) * Math.hypot(...v);
  const n = Math.round(area * density);
  for (let i = 0; i < n; i++) {
    const a = rand(), b = rand();
    add(origin[0] + u[0] * a + v[0] * b, origin[1] + u[1] * a + v[1] * b,
      origin[2] + u[2] * a + v[2] * b, color);
  }
}

function box(x, y, w, d, h, color) {
  plane([x, y, h], [w, 0, 0], [0, d, 0], color); // top
  plane([x, y, 0], [w, 0, 0], [0, 0, h], color);
  plane([x, y + d, 0], [w, 0, 0], [0, 0, h], color);
  plane([x, y, 0], [0, d, 0], [0, 0, h], color);
  plane([x + w, y, 0], [0, d, 0], [0, 0, h], color);
}

plane([0, 0, 0], [W, 0, 0], [0, D, 0], [150, 150, 155]); // floor
plane([0, 0, 0], [W, 0, 0], [0, 0, H], [215, 200, 170]); // walls
plane([0, D, 0], [W, 0, 0], [0, 0, H], [215, 200, 170]);
plane([0, 0, 0], [0, D, 0], [0, 0, H], [205, 190, 160]);
plane([W, 0, 0], [0, D, 0], [0, 0, H], [205, 190, 160]);

box(0.5, 0.5, 2.0, 0.8, 0.9, [70, 110, 170]);   // workbench
box(5.5, 0.4, 1.2, 1.2, 1.8, [180, 80, 60]);    // cabinet
box(3.2, 3.2, 1.0, 1.0, 1.0, [200, 160, 40]);   // crate
box(6.8, 3.6, 0.6, 0.6, 2.2, [90, 160, 90]);    // machine

// Pillar (cylinder) at the room center.
{
  const cx = 4, cy = 2.2, r = 0.25;
  const n = Math.round(2 * Math.PI * r * H * density);
  for (let i = 0; i < n; i++) {
    const t = rand() * Math.PI * 2;
    add(cx + Math.cos(t) * r, cy + Math.sin(t) * r, rand() * H, [120, 120, 130]);
  }
}

{
  const header =
    'ply\nformat binary_little_endian 1.0\ncomment PLY Twin Viewer sample room (Z-up, meters)\n' +
    `element vertex ${pts.length}\n` +
    'property float x\nproperty float y\nproperty float z\n' +
    'property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n';
  const stride = 15;
  const body = Buffer.alloc(pts.length * stride);
  pts.forEach((p, i) => {
    const o = i * stride;
    body.writeFloatLE(p[0], o);
    body.writeFloatLE(p[1], o + 4);
    body.writeFloatLE(p[2], o + 8);
    body.writeUInt8(p[3], o + 12);
    body.writeUInt8(p[4], o + 13);
    body.writeUInt8(p[5], o + 14);
  });
  writeFileSync(join(outDir, 'sample_room.ply'), Buffer.concat([Buffer.from(header, 'ascii'), body]));
  console.log(`sample_room.ply: ${pts.length} points`);
}

// ---------- Torus mesh (ASCII) ----------
{
  const R = 0.6, r = 0.22, segU = 64, segV = 24;
  const verts = [];
  const faces = [];
  for (let i = 0; i < segU; i++) {
    const u = (i / segU) * Math.PI * 2;
    for (let j = 0; j < segV; j++) {
      const v = (j / segV) * Math.PI * 2;
      verts.push([
        (R + r * Math.cos(v)) * Math.cos(u),
        r * Math.sin(v),
        (R + r * Math.cos(v)) * Math.sin(u),
      ]);
    }
  }
  const idx = (i, j) => (i % segU) * segV + (j % segV);
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      faces.push([idx(i, j), idx(i, j + 1), idx(i + 1, j + 1)]);
      faces.push([idx(i, j), idx(i + 1, j + 1), idx(i + 1, j)]);
    }
  }
  const lines = [
    'ply', 'format ascii 1.0', 'comment PLY Twin Viewer sample torus (Y-up, meters)',
    `element vertex ${verts.length}`, 'property float x', 'property float y', 'property float z',
    `element face ${faces.length}`, 'property list uchar int vertex_indices', 'end_header',
    ...verts.map((v) => v.map((n) => n.toFixed(5)).join(' ')),
    ...faces.map((f) => `3 ${f.join(' ')}`),
  ];
  writeFileSync(join(outDir, 'sample_torus.ply'), lines.join('\n') + '\n');
  console.log(`sample_torus.ply: ${verts.length} vertices, ${faces.length} faces`);
}
