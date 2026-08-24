import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Building, Marker, type BuildingSpec } from './Building';

const BUILDING_COLORS = ['#DCE3DE', '#C9D3CB', '#E4E9E1', '#B9C4BB'];
const MARKER_COLOR = '#0E8A5A';

function generateLayout(): { buildings: BuildingSpec[]; markers: [number, number, number][] } {
  const buildings: BuildingSpec[] = [];
  const markers: [number, number, number][] = [];
  const gridSize = 6;
  const spacing = 1.6;
  let seed = 42;

  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  let index = 0;
  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      if (rand() < 0.18) continue; // leave gaps for "streets"

      const height = 0.6 + rand() * 2.4;
      const width = 0.7 + rand() * 0.35;
      const depth = 0.7 + rand() * 0.35;
      const posX = (x - gridSize / 2) * spacing + (rand() - 0.5) * 0.3;
      const posZ = (z - gridSize / 2) * spacing + (rand() - 0.5) * 0.3;

      buildings.push({
        position: [posX, 0, posZ],
        height,
        width,
        depth,
        color: BUILDING_COLORS[index % BUILDING_COLORS.length],
        delay: Math.hypot(x - gridSize / 2, z - gridSize / 2) * 0.12,
      });

      if (rand() < 0.14 && markers.length < 5) {
        markers.push([posX, height + 0.35, posZ]);
      }

      index++;
    }
  }

  return { buildings, markers };
}

function Scene() {
  const groupRef = useRef<Group>(null);
  const { buildings, markers } = useMemo(() => generateLayout(), []);
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    pointer.current.x = state.pointer.x;
    pointer.current.y = state.pointer.y;

    group.rotation.y += delta * 0.05;
    const targetTiltX = pointer.current.y * 0.08;
    const targetTiltZ = -pointer.current.x * 0.08;
    group.rotation.x += (targetTiltX - group.rotation.x) * 0.03;
    group.rotation.z += (targetTiltZ - group.rotation.z) * 0.03;
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#F1F4F1" roughness={1} />
      </mesh>

      {buildings.map((building, i) => (
        <Building key={i} {...building} />
      ))}

      {markers.map((position, i) => (
        <Marker key={i} position={position} color={MARKER_COLOR} />
      ))}
    </group>
  );
}

export default function CommunityScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [6, 5, 7], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#F1F4F1']} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[5, 8, 3]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <fog attach="fog" args={['#F1F4F1', 9, 18]} />
      <Scene />
    </Canvas>
  );
}
