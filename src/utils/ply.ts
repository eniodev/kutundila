import { BufferGeometry, Vector3 } from 'three';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';

import type { PlyFormat, UpAxis, Vec3 } from '../types';

export type PlyHeader = {
  format: PlyFormat;
  vertexCount: number;
  faceCount: number;
  hasColor: boolean;
  headerLength: number;
};

export type LoadedPly = {
  geometry: BufferGeometry;
  header: PlyHeader;
  dimensions: Vec3;
  center: Vec3;
  /** Bounding sphere radius after centering, used to frame the camera. */
  radius: number;
};

const END_HEADER = 'end_header';
const MAX_HEADER_BYTES = 64 * 1024;

/** Reads only the PLY header. Cheap enough to run before deciding to fully parse. */
export function parsePlyHeader(bytes: Uint8Array): PlyHeader {
  const limit = Math.min(bytes.length, MAX_HEADER_BYTES);
  let text = '';
  for (let i = 0; i < limit; i++) text += String.fromCharCode(bytes[i]);

  if (!text.startsWith('ply')) throw new Error('This is not a valid PLY file.');
  const endIdx = text.indexOf(END_HEADER);
  if (endIdx < 0) throw new Error('Incomplete PLY header.');
  const lineEnd = text.indexOf('\n', endIdx);
  const headerLength = (lineEnd < 0 ? endIdx + END_HEADER.length : lineEnd) + 1;

  let format: PlyFormat | null = null;
  let vertexCount = 0;
  let faceCount = 0;
  let hasColor = false;
  let current = '';

  for (const raw of text.slice(0, endIdx).split('\n')) {
    const parts = raw.trim().split(/\s+/);
    switch (parts[0]) {
      case 'format':
        format = parts[1] === 'ascii' ? 'ascii' : 'binary';
        break;
      case 'element':
        current = parts[1];
        if (current === 'vertex') vertexCount = parseInt(parts[2], 10);
        if (current === 'face') faceCount = parseInt(parts[2], 10);
        break;
      case 'property': {
        const name = parts[parts.length - 1];
        if (current === 'vertex' && /^(red|r|diffuse_red)$/.test(name)) hasColor = true;
        break;
      }
    }
  }

  if (!format) throw new Error('PLY format not specified.');
  return { format, vertexCount, faceCount, hasColor, headerLength };
}

/** Parses PLY bytes into a centered, Y-up geometry plus metadata. Blocks the JS thread. */
export function buildPlyGeometry(bytes: Uint8Array, upAxis: UpAxis): LoadedPly {
  const header = parsePlyHeader(bytes);

  // PLYLoader needs an ArrayBuffer that starts at the file's first byte.
  const buffer =
    bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? (bytes.buffer as ArrayBuffer)
      : (bytes.slice().buffer as ArrayBuffer);

  const geometry = new PLYLoader().parse(buffer);

  // SLAM/ROS exports are Z-up; three.js is Y-up.
  if (upAxis === 'z') geometry.rotateX(-Math.PI / 2);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  geometry.center();
  geometry.computeBoundingSphere();

  if (header.faceCount > 0) {
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  } else if (geometry.getAttribute('normal')) {
    // Point clouds aren't lit, so normals (e.g. from PCL exports) only cost memory.
    geometry.deleteAttribute('normal');
  }

  return {
    geometry,
    header,
    dimensions: { x: size.x, y: size.y, z: size.z },
    center: { x: center.x, y: center.y, z: center.z },
    radius: geometry.boundingSphere?.radius || 1,
  };
}
