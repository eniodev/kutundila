import { invalidate } from '@react-three/fiber/native';
import { useEffect, useMemo, type Ref } from 'react';
import { DoubleSide, Plane, Vector3, type BufferGeometry, type Object3D } from 'three';

import type { ColorMode } from '../types';
import { applyColorMode } from '../utils/colors';

type Props = {
  geometry: BufferGeometry;
  hasFaces: boolean;
  pointSize: number;
  colorMode: ColorMode;
  /** Used when the model has no colours of its own. */
  flatColor: string;
  /** Hide everything above this height (Y, in the centered model frame). Infinity = off. */
  cutHeight: number;
  /** The rendered object, for raycasting (measuring). */
  objectRef?: Ref<Object3D>;
};

/** Renders a parsed PLY as points (no faces) or a lit mesh (with faces). */
export function PlyModel({ geometry, hasFaces, pointSize, colorMode, flatColor, cutHeight, objectRef }: Props) {
  const vertexColors = useMemo(() => applyColorMode(geometry, colorMode), [geometry, colorMode]);
  const color = vertexColors ? '#ffffff' : flatColor;
  // Changing vertexColors needs a shader recompile, so remount the material when it flips.
  const key = vertexColors ? 'vc' : 'flat';

  // Keeps points with y <= cutHeight (needs renderer.localClippingEnabled).
  const plane = useMemo(() => new Plane(new Vector3(0, -1, 0), 0), []);
  plane.constant = cutHeight;
  const clippingPlanes = Number.isFinite(cutHeight) ? [plane] : [];

  // Swapping the colour attribute or moving the plane isn't a prop change R3F sees: ask for a frame.
  useEffect(() => {
    invalidate();
  }, [vertexColors, colorMode, pointSize, flatColor, cutHeight]);

  if (hasFaces) {
    return (
      <mesh ref={objectRef} geometry={geometry}>
        <meshStandardMaterial
          key={key}
          vertexColors={vertexColors}
          color={color}
          side={DoubleSide}
          roughness={0.8}
          metalness={0.05}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
    );
  }
  return (
    <points ref={objectRef} geometry={geometry}>
      <pointsMaterial
        key={key}
        size={pointSize}
        sizeAttenuation
        vertexColors={vertexColors}
        color={color}
        clippingPlanes={clippingPlanes}
      />
    </points>
  );
}
