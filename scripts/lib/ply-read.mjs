// Minimal PLY vertex reader shared by the data-preparation scripts.
// Supports ascii and binary_little_endian with any scalar vertex properties; other elements
// (faces, PCL "camera") after the vertex element are ignored.
import { readFileSync } from 'node:fs';

const SIZES = {
  char: 1, uchar: 1, int8: 1, uint8: 1, short: 2, ushort: 2, int16: 2, uint16: 2,
  int: 4, uint: 4, int32: 4, uint32: 4, float: 4, float32: 4, double: 8, float64: 8,
};

/**
 * @returns {{ count: number, props: string[], read: (i: number, out: number[]) => void,
 *             index: (...names: string[]) => number }}
 */
export function readPlyVertices(path) {
  const buf = readFileSync(path);
  const headerEnd = buf.indexOf('end_header');
  if (headerEnd < 0) throw new Error(`${path}: no end_header`);
  const bodyStart = buf.indexOf('\n', headerEnd) + 1;
  let format = '';
  const elements = [];
  for (const line of buf.subarray(0, headerEnd).toString('latin1').split(/\r?\n/)) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'format') format = p[1];
    else if (p[0] === 'element') elements.push({ name: p[1], count: Number(p[2]), props: [] });
    else if (p[0] === 'property') {
      const el = elements[elements.length - 1];
      el.props.push(p[1] === 'list' ? { list: true, name: p[4] } : { type: p[1], name: p[2] });
    }
  }
  const vertex = elements[0];
  if (vertex?.name !== 'vertex') throw new Error(`${path}: expected vertex as the first element`);
  if (vertex.props.some((p) => p.list)) throw new Error(`${path}: list properties in vertex not supported`);

  let read;
  if (format === 'binary_little_endian') {
    const dv = new DataView(buf.buffer, buf.byteOffset + bodyStart);
    let stride = 0;
    const readers = vertex.props.map((p) => {
      const o = stride;
      stride += SIZES[p.type];
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
    read = (i, out) => { const b = i * stride; for (let k = 0; k < readers.length; k++) out[k] = readers[k](b); };
  } else if (format === 'ascii') {
    const lines = buf.subarray(bodyStart).toString('latin1').split(/\r?\n/);
    read = (i, out) => { const p = lines[i].trim().split(/\s+/); for (let k = 0; k < out.length; k++) out[k] = Number(p[k]); };
  } else {
    throw new Error(`${path}: unsupported format ${format}`);
  }

  const props = vertex.props.map((p) => p.name);
  return { count: vertex.count, props, read, index: (...names) => props.findIndex((n) => names.includes(n)) };
}
