import { invalidate } from '@react-three/fiber/native';
import { useEffect, useMemo } from 'react';
import { DoubleSide, type BufferGeometry } from 'three';

import type { ColorMode } from '../types';
import { applyColorMode } from '../utils/colors';

type Props = {
  geometry: BufferGeometry;
  hasFaces: boolean;
  pointSize: number;
  colorMode: ColorMode;
  /** Used when the model has no colours of its own. */
  flatColor: string;
};

/** Renders a parsed PLY as points (no faces) or a lit mesh (with faces). */
export function PlyModel({ geometry, hasFaces, pointSize, colorMode, flatColor }: Props) {
  const vertexColors = useMemo(() => applyColorMode(geometry, colorMode), [geometry, colorMode]);
  // Swapping the colour attribute isn't a prop change, so ask for a frame (frameloop="demand").
  useEffect(() => {
    invalidate();
  }, [vertexColors, colorMode, pointSize, flatColor]);
  const color = vertexColors ? '#ffffff' : flatColor;
  // Changing vertexColors needs a shader recompile, so remount the material when it flips.
  const key = vertexColors ? 'vc' : 'flat';

  if (hasFaces) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial
          key={key}
          vertexColors={vertexColors}
          color={color}
          side={DoubleSide}
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>
    );
  }
  return (
    <points geometry={geometry}>
      <pointsMaterial key={key} size={pointSize} sizeAttenuation vertexColors={vertexColors} color={color} />
    </points>
  );
}
