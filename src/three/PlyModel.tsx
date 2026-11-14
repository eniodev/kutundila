import { DoubleSide, type BufferGeometry } from 'three';

type Props = {
  geometry: BufferGeometry;
  hasFaces: boolean;
  hasColor: boolean;
  pointSize: number;
};

const DEFAULT_COLOR = '#4fc3f7';

/** Renders a parsed PLY as points (no faces) or a lit mesh (with faces). */
export function PlyModel({ geometry, hasFaces, hasColor, pointSize }: Props) {
  if (hasFaces) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors={hasColor}
          color={hasColor ? '#ffffff' : DEFAULT_COLOR}
          side={DoubleSide}
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>
    );
  }
  return (
    <points geometry={geometry}>
      <pointsMaterial
        size={pointSize}
        sizeAttenuation
        vertexColors={hasColor}
        color={hasColor ? '#ffffff' : DEFAULT_COLOR}
      />
    </points>
  );
}
