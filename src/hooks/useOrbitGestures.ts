import { invalidate } from '@react-three/fiber/native';
import type { RefObject } from 'react';
import { usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';

import { clamp, ELEVATION_MAX, ELEVATION_MIN, type OrbitState } from '../three/orbit';

const ROTATE_SPEED = 0.006; // radians per point dragged

/**
 * One-finger drag orbits (azimuth/elevation), pinch zooms (distance).
 * Writes straight into the orbit ref; the render loop picks it up, so no React re-renders.
 */
export function useOrbitGestures(orbit: RefObject<OrbitState>, { rotate = true } = {}) {
  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    enabled: rotate,
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
    onUpdate: (e) => {
      const s = orbit.current;
      if (!s || !e.scaleChange) return;
      s.distance = clamp(s.distance / e.scaleChange, s.minDistance, s.maxDistance);
      invalidate();
    },
  });

  return useSimultaneousGestures(pan, pinch);
}
