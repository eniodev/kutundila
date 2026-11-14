import { Vector3 } from 'three';

/** Mutable orbit state shared between input (gestures/gyro) and the render loop. Radians/meters. */
export type OrbitState = {
  azimuth: number;
  elevation: number;
  distance: number;
  minDistance: number;
  maxDistance: number;
};

export const ELEVATION_MIN = 0.1;
export const ELEVATION_MAX = 1.4;

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function createOrbitState(radius: number): OrbitState {
  return {
    azimuth: Math.PI / 4,
    elevation: 0.6,
    distance: radius * 2.2,
    minDistance: radius * 0.3,
    maxDistance: radius * 6,
  };
}

/** x = r·cos(e)·sin(a), y = r·sin(e), z = r·cos(e)·cos(a) */
export function orbitToPosition(s: OrbitState, out = new Vector3()): Vector3 {
  const c = Math.cos(s.elevation);
  return out.set(
    s.distance * c * Math.sin(s.azimuth),
    s.distance * Math.sin(s.elevation),
    s.distance * c * Math.cos(s.azimuth),
  );
}
