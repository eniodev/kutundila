import { useThree } from '@react-three/fiber/native';
import { useEffect, useMemo, type RefObject } from 'react';
import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, type Camera, type Scene, type WebGLRenderer } from 'three';

import type { Vec3 } from '../types';

/** Lets screen code (outside the Canvas) raycast, render and snapshot. */
export type SceneHandle = { camera: Camera; scene: Scene; gl: WebGLRenderer };

export function SceneBridge({ handle }: { handle: RefObject<SceneHandle | null> }) {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.localClippingEnabled = true; // for the height cut
    handle.current = { camera, scene, gl };
    return () => {
      handle.current = null;
    };
  }, [camera, scene, gl, handle]);
  return null;
}

/** A polyline through points already in the centered model frame. */
export function Polyline({ points, color, visible = true }: { points: Vec3[]; color: string; visible?: boolean }) {
  const line = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3));
    // Draw on top so the path stays visible through walls.
    return new Line(g, new LineBasicMaterial({ color, depthTest: false, transparent: true }));
  }, [points, color]);
  useEffect(() => () => {
    line.geometry.dispose();
    (line.material as LineBasicMaterial).dispose();
  }, [line]);
  line.renderOrder = 10;
  return <primitive object={line} visible={visible} />;
}

/** Measurement endpoints and the segment between them. */
export function Measurement({ points, size, color }: { points: Vec3[]; size: number; color: string }) {
  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} renderOrder={11}>
          <sphereGeometry args={[size, 16, 12]} />
          <meshBasicMaterial color={color} depthTest={false} transparent />
        </mesh>
      ))}
      {points.length === 2 && <Polyline points={points} color={color} />}
    </>
  );
}
