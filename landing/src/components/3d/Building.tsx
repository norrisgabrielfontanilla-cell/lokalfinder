import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';

export type BuildingSpec = {
  /** Ground anchor [x, 0, z] — the building's base always stays pinned to y=0. */
  position: [number, number, number];
  height: number;
  width: number;
  depth: number;
  color: string;
  delay: number;
};

export function Building({ position, height, width, depth, color, delay }: BuildingSpec) {
  const meshRef = useRef<Mesh>(null);
  const startRef = useRef<number | null>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    if (startRef.current === null) {
      startRef.current = state.clock.elapsedTime + delay;
    }

    const elapsed = state.clock.elapsedTime - startRef.current;
    const progress = Math.min(Math.max(elapsed / 0.9, 0), 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    mesh.scale.y = Math.max(eased, 0.001);
    mesh.position.set(position[0], (height / 2) * eased, position[2]);
  });

  return (
    <mesh ref={meshRef} position={position} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

export function Marker({ position, color = '#0E8A5A' }: { position: [number, number, number]; color?: string }) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.4 + position[0]) * 0.18;
    mesh.scale.setScalar(pulse);
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.14, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} />
    </mesh>
  );
}
