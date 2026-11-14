import { BufferAttribute, type BufferGeometry } from 'three';

// Height gradient stops (low → high), similar to common elevation colour maps.
const STOPS: [number, number, number][] = [
  [0.19, 0.27, 0.75], // blue
  [0.12, 0.65, 0.85], // cyan
  [0.3, 0.78, 0.35], // green
  [0.98, 0.83, 0.2], // yellow
  [0.9, 0.25, 0.18], // red
];

function gradient(t: number, out: Float32Array, o: number) {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = STOPS[i], b = STOPS[i + 1];
  out[o] = a[0] + (b[0] - a[0]) * f;
  out[o + 1] = a[1] + (b[1] - a[1]) * f;
  out[o + 2] = a[2] + (b[2] - a[2]) * f;
}

/** Colour attribute from normalized Y (the up axis after loading). */
export function heightColorAttribute(geometry: BufferGeometry): BufferAttribute {
  const pos = geometry.getAttribute('position');
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const range = max.y - min.y || 1;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) gradient((pos.getY(i) - min.y) / range, colors, i * 3);
  return new BufferAttribute(colors, 3);
}

/**
 * Switches the geometry's 'color' attribute between the file's colours and the height gradient.
 * Both are cached on the geometry, so switching back and forth is instant.
 * Returns whether the geometry now has vertex colours.
 */
export function applyColorMode(geometry: BufferGeometry, mode: 'original' | 'height'): boolean {
  const data = geometry.userData as { originalColor?: BufferAttribute | null; heightColor?: BufferAttribute };
  if (data.originalColor === undefined) {
    data.originalColor = (geometry.getAttribute('color') as BufferAttribute | undefined) ?? null;
  }
  if (mode === 'height') {
    data.heightColor ??= heightColorAttribute(geometry);
    geometry.setAttribute('color', data.heightColor);
    return true;
  }
  if (data.originalColor) {
    geometry.setAttribute('color', data.originalColor);
    return true;
  }
  geometry.deleteAttribute('color');
  return false;
}
