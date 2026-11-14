import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, type RefObject } from 'react';

import type { GyroMode } from '../types';

/** Orientation derived from DeviceMotion.rotation, free of Euler gimbal issues. Radians. */
export type DeviceAngles = {
  /** Heading of the direction the back of the phone points at (around the world vertical). */
  heading: number;
  /** Up/down angle of that direction (−π/2 looking at the floor, +π/2 at the ceiling). */
  pitch: number;
  /** Steering-wheel rotation in the screen plane (0 when the phone is upright). */
  roll: number;
};

/**
 * Converts W3C-style Euler angles (R = Rz(alpha)·Rx(beta)·Ry(gamma)) into direction-based angles.
 * Reading the device's back direction and the gravity vector avoids the gimbal lock that
 * raw beta/gamma have when the phone is held upright (beta ≈ 90°).
 */
export function anglesFromRotation(alpha: number, beta: number, gamma: number): DeviceAngles {
  const cA = Math.cos(alpha), sA = Math.sin(alpha);
  const cB = Math.cos(beta), sB = Math.sin(beta);
  const cG = Math.cos(gamma), sG = Math.sin(gamma);

  // Back of the phone = −(device Z axis) in world coordinates.
  const fx = -(cA * sG + sA * sB * cG);
  const fy = -(sA * sG - cA * sB * cG);
  const fz = -(cB * cG);

  // Gravity ("world up") in device coordinates = third row of R.
  const gx = -cB * sG;
  const gy = sB;

  return {
    heading: Math.atan2(fx, fy),
    pitch: Math.asin(Math.max(-1, Math.min(1, fz))),
    roll: Math.atan2(-gx, gy),
  };
}

/** Wraps an angle difference to (−π, π]. */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export type OrientationDelta = { horizontal: number; vertical: number };

/**
 * Subscribes to DeviceMotion while `enabled` and reports how far the phone has moved since the
 * reference pose (captured on enable and on `recenter`). Calls back on every sample (~60 Hz)
 * without React state, so the caller can write straight into the camera orbit.
 */
export function useDeviceOrientation(
  enabled: boolean,
  mode: GyroMode,
  onDelta: RefObject<(delta: OrientationDelta) => void>,
) {
  const reference = useRef<DeviceAngles | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    reference.current = null;
  }, [mode]);

  useEffect(() => {
    if (!enabled) return;
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    reference.current = null;

    (async () => {
      if (!(await DeviceMotion.isAvailableAsync())) return;
      const perm = await DeviceMotion.requestPermissionsAsync();
      if (!perm.granted || cancelled) return;
      DeviceMotion.setUpdateInterval(16);
      sub = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        const now = anglesFromRotation(rotation.alpha, rotation.beta, rotation.gamma);
        if (!reference.current) reference.current = now;
        const ref = reference.current;
        const horizontal =
          modeRef.current === 'look' ? wrapAngle(now.heading - ref.heading) : wrapAngle(now.roll - ref.roll);
        onDelta.current?.({ horizontal, vertical: now.pitch - ref.pitch });
      });
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, onDelta]);

  /** The next sample becomes the new reference pose. */
  const recenter = () => {
    reference.current = null;
  };

  return { recenter };
}
