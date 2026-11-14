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

export type ViewPreset = 'top' | 'front' | 'side' | 'iso';

/** Orbit angles for the camera presets (distance unchanged). */
export function presetAngles(preset: ViewPreset): { azimuth: number; elevation: number } {
  switch (preset) {
    case 'top':
      return { azimuth: 0, elevation: 1.553 }; // just short of 90° so lookAt keeps a stable up vector
    case 'front':
      return { azimuth: 0, elevation: 0.12 };
    case 'side':
      return { azimuth: Math.PI / 2, elevation: 0.12 };
    default:
      return { azimuth: Math.PI / 4, elevation: 0.6 };
  }
}
