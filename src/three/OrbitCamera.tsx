import { useFrame, useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';

import type { CameraState } from '../types';
import { orbitToPosition, type OrbitState } from './orbit';

type Props = {
  orbit: RefObject<OrbitState>;
  radius: number;
  /** Lerp factor 0..1 (1 = no smoothing). */
  smoothing: number;
  /** Written every rendered frame; the HUD polls it, so the screen doesn't re-render. */
  cameraState: RefObject<CameraState | null>;
};

const RAD2DEG = 180 / Math.PI;

/**
 * Positions the default camera on a sphere around the origin, always looking at (0,0,0).
 * Works with frameloop="demand": inputs call invalidate(), and this keeps requesting frames
 * only until the smoothed camera reaches its target.
 */
export function OrbitCamera({ orbit, radius, smoothing, cameraState }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const target = useMemo(() => new Vector3(), []);
  const first = useRef(true);

  useEffect(() => {
    camera.near = Math.max(radius / 1000, 0.001);
    camera.far = radius * 50;
    camera.updateProjectionMatrix();
    first.current = true;
    invalidate();
  }, [camera, radius, invalidate]);

  useFrame(() => {
    const s = orbit.current;
    if (!s) return;
    orbitToPosition(s, target);
    if (first.current) {
      camera.position.copy(target);
      first.current = false;
    } else {
      camera.position.lerp(target, Math.min(1, Math.max(0.01, smoothing)));
      // Keep animating until close enough (relative to the orbit size).
      if (camera.position.distanceToSquared(target) > (radius * 1e-4) ** 2) invalidate();
      else camera.position.copy(target);
    }
    camera.lookAt(0, 0, 0);

    const p = camera.position;
    const len = Math.max(p.length(), 1e-6);
    cameraState.current = {
      position: { x: p.x, y: p.y, z: p.z },
      azimuth: (Math.atan2(p.x, p.z) * RAD2DEG + 360) % 360,
      elevation: Math.asin(Math.min(1, p.y / len)) * RAD2DEG,
      distance: len,
    };
  });

  return null;
}
