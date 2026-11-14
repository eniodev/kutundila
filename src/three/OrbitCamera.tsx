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
  onCameraState?: (state: CameraState) => void;
  /** HUD update rate. */
  hudHz?: number;
};

const RAD2DEG = 180 / Math.PI;

/** Positions the default camera on a sphere around the origin, always looking at (0,0,0). */
export function OrbitCamera({ orbit, radius, smoothing, onCameraState, hudHz = 10 }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const target = useMemo(() => new Vector3(), []);
  const lastHud = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    camera.near = Math.max(radius / 1000, 0.001);
    camera.far = radius * 50;
    camera.updateProjectionMatrix();
    first.current = true;
  }, [camera, radius]);

  useFrame((state) => {
    const s = orbit.current;
    if (!s) return;
    orbitToPosition(s, target);
    if (first.current) {
      camera.position.copy(target);
      first.current = false;
    } else {
      camera.position.lerp(target, Math.min(1, Math.max(0.01, smoothing)));
    }
    camera.lookAt(0, 0, 0);

    const t = state.clock.elapsedTime;
    if (onCameraState && t - lastHud.current >= 1 / hudHz) {
      lastHud.current = t;
      const p = camera.position;
      onCameraState({
        position: { x: p.x, y: p.y, z: p.z },
        azimuth: ((Math.atan2(p.x, p.z) * RAD2DEG) + 360) % 360,
        elevation: Math.asin(Math.min(1, p.y / Math.max(p.length(), 1e-6))) * RAD2DEG,
        distance: p.length(),
      });
    }
  });

  return null;
}
