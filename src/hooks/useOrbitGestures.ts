import { invalidate } from '@react-three/fiber/native';
import { useRef, type RefObject } from 'react';
import { usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';

import { clamp, ELEVATION_MAX, ELEVATION_MIN, type OrbitState } from '../three/orbit';

const ROTATE_SPEED = 0.006; // radians per point dragged

type Options = {
  /** One-finger drag orbits (off in gyro mode). */
  rotate?: boolean;
  /** Called with view coordinates on a single tap (e.g. to pick measurement points). */
  onTap?: (x: number, y: number) => void;
  /** Called when the user starts dragging or pinching (e.g. to stop auto-rotate). */
  onInteract?: () => void;
};

/**
 * One-finger drag orbits (azimuth/elevation), pinch zooms (distance), tap reports a point.
 * Writes straight into the orbit ref and requests a frame, so there are no React re-renders.
 */
export function useOrbitGestures(orbit: RefObject<OrbitState>, { rotate = true, onTap, onInteract }: Options = {}) {
  // Latest callbacks without re-creating the gestures.
  const cb = useRef({ onTap, onInteract });
  cb.current = { onTap, onInteract };

  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    enabled: rotate,
    onActivate: () => cb.current.onInteract?.(),
    onUpdate: (e) => {
      const s = orbit.current;
      if (!s) return;
      s.azimuth -= e.changeX * ROTATE_SPEED;
      s.elevation = clamp(s.elevation + e.changeY * ROTATE_SPEED, ELEVATION_MIN, ELEVATION_MAX);
      invalidate();
    },
  });

  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: () => cb.current.onInteract?.(),
    onUpdate: (e) => {
      const s = orbit.current;
      if (!s || !e.scaleChange) return;
      s.distance = clamp(s.distance / e.scaleChange, s.minDistance, s.maxDistance);
      invalidate();
    },
  });

  const tap = useTapGesture({
    runOnJS: true,
    maxDistance: 12,
    onActivate: (e) => cb.current.onTap?.(e.x, e.y),
  });

  return useSimultaneousGestures(pan, pinch, tap);
}
