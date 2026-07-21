"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { MutableRefObject, useMemo, useRef } from "react";
import * as THREE from "three";

export type ProductKind = "home" | "voice" | "ai" | "api";
type SceneKind = Exclude<ProductKind, "home">;

type SceneProps = {
  progress: MutableRefObject<number>;
  listening?: boolean;
  thinking?: boolean;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

function VoiceWaveform({ progress, listening = false, thinking = false }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const count = 37;

  useFrame((state) => {
    if (!group.current) return;
    const strength = listening ? 1.35 : thinking ? 0.82 : 0.42;
    group.current.rotation.x = -0.18 + progress.current * 0.28;
    group.current.position.z = progress.current * 0.8;
    group.current.children.forEach((child, index) => {
      const distance = Math.abs(index - (count - 1) / 2) / (count / 2);
      const envelope = Math.max(0.12, 1 - distance * 0.82);
      const signal = Math.sin(state.clock.elapsedTime * (listening ? 5.8 : 2.1) + index * 0.72);
      const height = 0.24 + Math.abs(signal) * envelope * strength * 2.45;
      child.scale.y = THREE.MathUtils.lerp(child.scale.y, height, 0.14);
      child.position.z = Math.sin(index * 0.48 + state.clock.elapsedTime * 0.75) * 0.16;
    });
  });

  return (
    <group ref={group} position={[0.8, 0, 0]}>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index} position={[(index - (count - 1) / 2) * 0.19, 0, 0]} castShadow>
          <boxGeometry args={[0.09, 1, 0.28]} />
          <meshStandardMaterial
            color={index % 3 === 0 ? "#37d8ff" : index % 3 === 1 ? "#5865ff" : "#aa78ff"}
            emissive={listening ? "#214cff" : "#091635"}
            emissiveIntensity={listening ? 0.85 : 0.18}
            roughness={0.28}
            metalness={0.34}
          />
        </mesh>
      ))}
      <mesh position={[0, -1.75, 0]} receiveShadow>
        <boxGeometry args={[8.4, 0.08, 2.4]} />
        <meshStandardMaterial color="#11182d" roughness={0.38} metalness={0.46} />
      </mesh>
    </group>
  );
}

function NeuralConstellation({ progress }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const constellation = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const orbit = useRef<THREE.Group>(null);
  const coreMaterial = useRef<THREE.MeshStandardMaterial>(null);

  const { nodePositions, linePositions } = useMemo(() => {
    const count = 160;
    const radius = 2.55;
    const points: THREE.Vector3[] = [];
    for (let index = 0; index < count; index++) {
      const phi = Math.acos(1 - (2 * (index + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * index;
      points.push(new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      ));
    }
    const nodePositions = new Float32Array(count * 3);
    points.forEach((point, index) => point.toArray(nodePositions, index * 3));
    const segments: number[] = [];
    points.forEach((point, index) => {
      points
        .map((other, otherIndex) => ({ otherIndex, distance: point.distanceToSquared(other) }))
        .filter(({ otherIndex }) => otherIndex > index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 2)
        .forEach(({ otherIndex }) => {
          segments.push(point.x, point.y, point.z, points[otherIndex].x, points[otherIndex].y, points[otherIndex].z);
        });
    });
    return { nodePositions, linePositions: new Float32Array(segments) };
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const build = ease(progress.current * 1.4 + 0.2);
    const breath = 1 + Math.sin(time * 0.9) * 0.025;
    if (group.current) {
      group.current.rotation.y = time * 0.08 + build * 0.5;
      group.current.rotation.x = 0.12 - build * 0.2;
    }
    if (constellation.current) {
      constellation.current.scale.setScalar(breath * (0.94 + build * 0.1));
      constellation.current.rotation.y = time * 0.05;
    }
    if (shell.current) {
      shell.current.rotation.y = -time * 0.16;
      shell.current.rotation.z = time * 0.07;
    }
    if (core.current) {
      core.current.scale.setScalar(1 + Math.sin(time * 1.7) * 0.06);
    }
    if (coreMaterial.current) {
      coreMaterial.current.emissiveIntensity = 0.75 + Math.sin(time * 1.7) * 0.35;
    }
    if (orbit.current) {
      orbit.current.rotation.y = time * 0.42;
      orbit.current.rotation.x = 0.5 + Math.sin(time * 0.3) * 0.1;
      orbit.current.children.forEach((child, index) => {
        child.rotation.x = time * (0.8 + index * 0.2);
        child.rotation.y = time * 0.6;
      });
    }
  });

  return (
    <group ref={group} position={[1.5, 0.1, 0]}>
      <group ref={constellation}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[nodePositions, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#d7ff58" size={0.075} sizeAttenuation transparent opacity={0.95} />
        </points>
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#65e6a8" transparent opacity={0.32} />
        </lineSegments>
      </group>
      <mesh ref={shell}>
        <icosahedronGeometry args={[1.7, 1]} />
        <meshBasicMaterial color="#a6ffcb" wireframe transparent opacity={0.28} />
      </mesh>
      <mesh ref={core} castShadow>
        <icosahedronGeometry args={[0.85, 2]} />
        <meshStandardMaterial
          ref={coreMaterial}
          color="#1c3524"
          emissive="#7dff6a"
          emissiveIntensity={0.9}
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>
      <group ref={orbit}>
        {Array.from({ length: 5 }, (_, index) => {
          const angle = (index / 5) * Math.PI * 2;
          return (
            <mesh key={index} position={[Math.cos(angle) * 3.4, 0, Math.sin(angle) * 3.4]} castShadow>
              <octahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial color="#f4ffca" emissive="#bdfc58" emissiveIntensity={0.6} roughness={0.35} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function ApiGateway({ progress }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const packets = useRef<THREE.Group>(null);
  const knot = useRef<THREE.Mesh>(null);
  const ringCount = 6;
  const tunnelLength = 6.6;

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const reveal = ease(progress.current * 1.35 + 0.22);
    if (group.current) {
      group.current.rotation.y = -0.55 + reveal * 0.35;
      group.current.rotation.x = 0.08 + Math.sin(time * 0.22) * 0.04;
      group.current.position.y = -0.1 + reveal * 0.3;
    }
    if (rings.current) {
      rings.current.children.forEach((child, index) => {
        const direction = index % 2 ? 1 : -1;
        child.rotation.z = time * direction * (0.25 + index * 0.06);
        const pulse = 1 + Math.sin(time * 1.6 - index * 0.7) * 0.035;
        child.scale.setScalar(pulse);
      });
    }
    if (packets.current) {
      packets.current.children.forEach((child, index) => {
        const speed = 1.15 + (index % 3) * 0.24;
        const travel = (time * speed + index * 1.37) % (tunnelLength + 1.4);
        const x = -tunnelLength / 2 - 0.7 + travel;
        const spiral = time * 2.1 + index * 1.9;
        child.position.set(x, Math.sin(spiral) * 0.62, Math.cos(spiral) * 0.62);
        child.rotation.x = time * 2.4 + index;
        child.rotation.y = time * 1.8;
      });
    }
    if (knot.current) {
      knot.current.rotation.x = time * 0.35;
      knot.current.rotation.y = time * 0.5;
    }
  });

  return (
    <group ref={group} position={[1.5, 0, 0]}>
      <group ref={rings}>
        {Array.from({ length: ringCount }, (_, index) => {
          const x = -tunnelLength / 2 + (index * tunnelLength) / (ringCount - 1);
          const accent = index === 2;
          return (
            <group key={index} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <mesh castShadow>
                <torusGeometry args={[1.35 + Math.sin(index * 1.1) * 0.16, 0.075, 20, 72]} />
                <meshStandardMaterial
                  color={accent ? "#ff6a39" : "#06333a"}
                  emissive={accent ? "#ff6a39" : "#0d5e66"}
                  emissiveIntensity={accent ? 0.55 : 0.25}
                  metalness={0.7}
                  roughness={0.28}
                />
              </mesh>
              {Array.from({ length: 4 }, (_, tick) => {
                const angle = (tick / 4) * Math.PI * 2 + index * 0.5;
                const radius = 1.35 + Math.sin(index * 1.1) * 0.16;
                return (
                  <mesh key={tick} position={[Math.cos(angle) * radius, Math.sin(angle) * radius, 0]} castShadow>
                    <boxGeometry args={[0.16, 0.16, 0.24]} />
                    <meshStandardMaterial color={tick % 2 ? "#f7fbfc" : "#0a444c"} metalness={0.55} roughness={0.3} />
                  </mesh>
                );
              })}
            </group>
          );
        })}
      </group>
      <mesh ref={knot} position={[tunnelLength / 2 + 1.35, 0, 0]} castShadow>
        <torusKnotGeometry args={[0.52, 0.16, 120, 18]} />
        <meshStandardMaterial color="#007980" emissive="#00b3ba" emissiveIntensity={0.4} metalness={0.75} roughness={0.22} />
      </mesh>
      <group ref={packets}>
        {Array.from({ length: 8 }, (_, index) => (
          <mesh key={index}>
            <octahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial
              color={index % 3 ? "#ff6a39" : "#00c2cb"}
              emissive={index % 3 ? "#ff6a39" : "#00c2cb"}
              emissiveIntensity={1.4}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Scene({ kind, ...props }: SceneProps & { kind: SceneKind }) {
  if (kind === "voice") {
    return (
      <>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 6, 6]} intensity={2.8} color="#a9c8ff" castShadow />
        <VoiceWaveform {...props} />
      </>
    );
  }
  if (kind === "ai") {
    return (
      <>
        <ambientLight intensity={1.1} />
        <directionalLight position={[-4, 7, 5]} intensity={2.6} color="#dcff9a" castShadow />
        <pointLight position={[2, 0, 4]} intensity={26} color="#4effad" distance={12} />
        <NeuralConstellation {...props} />
      </>
    );
  }
  return (
    <>
      <ambientLight intensity={1.6} />
      <directionalLight position={[4, 7, 6]} intensity={2.8} color="#efffff" castShadow />
      <pointLight position={[0, 2, 5]} intensity={14} color="#7ce8ee" distance={14} />
      <ApiGateway {...props} />
    </>
  );
}

export function ProductScene({ kind, ...props }: SceneProps & { kind: SceneKind }) {
  return (
    <div className={`product-scene product-scene-${kind}`} aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, kind === "voice" ? 8.2 : 8.7], fov: kind === "api" ? 40 : 43 }}
        dpr={[1, 1.45]}
        shadows
        gl={{ alpha: true, antialias: true }}
      >
        <Scene kind={kind} {...props} />
      </Canvas>
    </div>
  );
}
