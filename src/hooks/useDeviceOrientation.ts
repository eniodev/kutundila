import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, type RefObject } from 'react';

type Mat3 = [number, number, number, number, number, number, number, number, number]; // row-major

/** Rotation matrix for W3C-style Euler angles: R = Rz(alpha)·Rx(beta)·Ry(gamma). */
export function rotationMatrix(alpha: number, beta: number, gamma: number): Mat3 {
  const cA = Math.cos(alpha), sA = Math.sin(alpha);
  const cB = Math.cos(beta), sB = Math.sin(beta);
  const cG = Math.cos(gamma), sG = Math.sin(gamma);
  return [
    cA * cG - sA * sB * sG, -sA * cB, cA * sG + sA * sB * cG,
    sA * cG + cA * sB * sG, cA * cB, sA * sG - cA * sB * cG,
    -cB * sG, sB, cB * cG,
  ];
}

/** Rotation of the phone around its own axes since the reference pose. Radians. */
export type RelativeRotation = {
  /** Around the phone's long axis: turning it left/right like a page (or turning your body). */
  turn: number;
  /** Around the phone's horizontal axis: top towards/away from you. */
  tilt: number;
  /** Around the screen normal: rotating it like a steering wheel. */
  steer: number;
};

/**
 * Decomposes Rrel = R0ᵀ·R (rotation in the reference device frame) as Ry(turn)·Rx(tilt)·Rz(steer).
 * Being relative to the reference pose, this is well conditioned whether the phone is upright,
 * tilted or almost flat, unlike world-referenced Euler angles, which hit gimbal lock.
 */
export function relativeRotation(r0: Mat3, r: Mat3): RelativeRotation {
  // rel[i][j] = Σk r0[k][i]·r[k][j]
  const rel = (i: number, j: number) => r0[i] * r[j] + r0[3 + i] * r[3 + j] + r0[6 + i] * r[6 + j];
  return {
    turn: Math.atan2(rel(0, 2), rel(2, 2)),
    tilt: Math.asin(Math.max(-1, Math.min(1, -rel(1, 2)))),
    steer: Math.atan2(rel(1, 0), rel(1, 1)),
  };
}

export type OrientationDelta = { horizontal: number; vertical: number };

const DEADZONE = 0.002; // rad (~0.1°): ignore sensor noise when the phone is still

/**
 * Subscribes to DeviceMotion while `enabled` and reports how far the phone has rotated since the
 * reference pose (captured on enable and on `recenter`):
 *   horizontal = turn (page-turn) + steer (steering wheel), vertical = tilt (top away = negative).
 * Calls back without React state, so the caller can write straight into the camera orbit.
 */
export function useDeviceOrientation(enabled: boolean, onDelta: RefObject<(delta: OrientationDelta) => void>) {
  const reference = useRef<Mat3 | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let sub: { remove: () => void } | undefined;
    let cancelled = false;
    let last: OrientationDelta = { horizontal: NaN, vertical: NaN };
    reference.current = null;

    (async () => {
      if (!(await DeviceMotion.isAvailableAsync())) return;
      const perm = await DeviceMotion.requestPermissionsAsync();
      if (!perm.granted || cancelled) return;
      DeviceMotion.setUpdateInterval(20);
      sub = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        const r = rotationMatrix(rotation.alpha, rotation.beta, rotation.gamma);
        if (!reference.current) reference.current = r;
        const rel = relativeRotation(reference.current, r);
        // Page-turn right (+turn) and steering clockwise (−steer) both orbit the same way.
        const delta = { horizontal: rel.turn - rel.steer, vertical: rel.tilt };
        if (
          Math.abs(delta.horizontal - last.horizontal) < DEADZONE &&
          Math.abs(delta.vertical - last.vertical) < DEADZONE
        ) {
          return;
        }
        last = delta;
        onDelta.current?.(delta);
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
