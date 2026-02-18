import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { Trail, Sparkles, shaderMaterial } from '@react-three/drei';
import { useGame } from '../context/GameContext';
import * as THREE from 'three';

// --- Level 3 Shaders ---
const PlasmaMaterial = shaderMaterial(
    { time: 0, color: new THREE.Color(0.2, 0.4, 1.0) },
    // Vertex Shader
    `
    varying vec2 vUv;
    varying vec3 vNormal;
    uniform float time;
    
    // Simplex noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute( permute( permute( 
                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
              + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      vUv = uv;
      vNormal = normal;
      vec3 pos = position;
      float noiseVal = snoise(vec3(pos * 3.0 + time * 0.5));
      pos += normal * noiseVal * 0.1; // Vertex displacement
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
    // Fragment Shader
    `
    varying vec2 vUv;
    varying vec3 vNormal;
    uniform float time;
    uniform vec3 color;

    void main() {
      // Simple plasma glow
      float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
      gl_FragColor = vec4(color * intensity * 2.0 + color, 1.0);
    }
  `
);

extend({ PlasmaMaterial });

// --- Rotating Ring Component ---
const RotatingRing = ({ radius, color, axis, speed }) => {
    const ringRef = useRef();
    useFrame((state, delta) => {
        if (ringRef.current) {
            ringRef.current.rotation[axis] += delta * speed;
        }
    });

    return (
        <group ref={ringRef}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[radius, 0.05, 16, 64]} />
                <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
        </group>
    );
};

// --- Level 1: Basic Rock ---
const Level1Visuals = () => (
    <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#444" roughness={0.8} metalness={0.2} />
    </mesh>
);

// --- Level 2: Awakening Core ---
const Level2Visuals = () => {
    const matRef = useRef();
    useFrame((state) => {
        if (matRef.current) {
            const t = state.clock.getElapsedTime();
            matRef.current.emissiveIntensity = 1.0 + Math.sin(t * 3) * 0.5;
        }
    });

    return (
        <Trail width={6} length={8} color="#00f3ff" attenuation={(t) => t * t}>
            <mesh castShadow receiveShadow>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshStandardMaterial
                    ref={matRef}
                    color="#00f3ff"
                    emissive="#00f3ff"
                    emissiveIntensity={1.5}
                    roughness={0.4}
                />
            </mesh>
        </Trail>
    );
};

// --- Level 3: Fusion Star ---
const Level3Visuals = () => {
    const shaderRef = useRef();
    useFrame((state, delta) => {
        if (shaderRef.current) shaderRef.current.time += delta;
    });

    return (
        <group>
            {/* Inner solid trail */}
            <Trail width={4} length={6} color="#ffd700" attenuation={(t) => t}>
                <mesh>
                    <sphereGeometry args={[0.5, 64, 64]} />
                    <plasmaMaterial ref={shaderRef} color={new THREE.Color(1, 0.8, 0.2)} />
                </mesh>
            </Trail>
            <RotatingRing radius={0.8} color="#ffd700" axis="y" speed={1} />
        </group>
    );
};

// --- Level 4: Gravity Flare ---
const Level4Visuals = () => {
    const meshRef = useRef();

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.position.x = (Math.random() - 0.5) * 0.05;
            meshRef.current.position.y = (Math.random() - 0.5) * 0.05;
            meshRef.current.position.z = (Math.random() - 0.5) * 0.05;
        }
    });

    return (
        <group>
            {/* Main Body */}
            <mesh ref={meshRef}>
                <sphereGeometry args={[0.6, 32, 32]} />
                <meshStandardMaterial color="#ff4500" emissive="#ff2200" emissiveIntensity={4} toneMapped={false} />
            </mesh>

            {/* Aura Particles */}
            <Sparkles count={50} scale={3} size={4} speed={0.4} opacity={0.5} color="#ffaa00" noise={0.5} />

            <RotatingRing radius={0.9} color="#ff4500" axis="y" speed={1.5} />
            <RotatingRing radius={1.1} color="#ffaa00" axis="x" speed={1} />

            <Trail width={8} length={12} color="#ff4500" attenuation={(t) => t * t}>
                <mesh visible={false}><sphereGeometry args={[0.1]} /></mesh>
            </Trail>
        </group>
    );
};

// --- Level 5: Black Hole / Supernova ---
const Level5Visuals = () => {
    const groupRef = useRef();
    const diskRef = useRef();
    const [color, setColor] = useState(new THREE.Color());

    useFrame((state, delta) => {
        // Rotate accretion disk
        if (diskRef.current) {
            diskRef.current.rotation.y += delta * 2;
            diskRef.current.rotation.z += delta * 0.5;
        }

        // Color shift for rings
        const t = state.clock.getElapsedTime();
        setColor(new THREE.Color().setHSL((Math.sin(t * 0.5) + 1) * 0.5, 1, 0.5));
    });

    return (
        <group ref={groupRef}>
            {/* Core - Pure black hole */}
            <mesh>
                <sphereGeometry args={[0.6, 64, 64]} />
                <meshStandardMaterial color="#000000" roughness={0} metalness={1} />
            </mesh>

            {/* Event Horizon Glow */}
            <mesh>
                <sphereGeometry args={[0.65, 32, 32]} />
                <meshBasicMaterial color="#ffffff" side={THREE.BackSide} transparent opacity={0.5} />
            </mesh>

            {/* Accretion Disk Particles */}
            <group ref={diskRef}>
                <Sparkles count={200} scale={[4, 0.2, 4]} size={3} speed={0.2} opacity={0.8} color="#a020f0" />
                <Sparkles count={200} scale={[5, 0.1, 5]} size={2} speed={0.5} opacity={0.6} color="#00ffff" />
            </group>

            <RotatingRing radius={1.0} color={color} axis="y" speed={2} />
            <RotatingRing radius={1.2} color={color} axis="x" speed={1.5} />
            <RotatingRing radius={1.4} color={color} axis="z" speed={1} />

            {/* Vortex Trail */}
            <Trail width={12} length={20} color="#9400d3" attenuation={(t) => t * t * t}>
                <mesh visible={false}><sphereGeometry args={[0.1]} /></mesh>
            </Trail>
        </group>
    );
};

export const PlayerVisuals = () => {
    const { level } = useGame();

    switch (level) {
        case 1: return <Level1Visuals />;
        case 2: return <Level2Visuals />;
        case 3: return <Level3Visuals />;
        case 4: return <Level4Visuals />;
        case 5: return <Level5Visuals />;
        default: return <Level2Visuals />;
    }
};

export const LevelUpFlash = () => {
    const ref = useRef();
    useFrame((state, delta) => {
        if (ref.current) {
            // 快速膨胀
            ref.current.scale.addScalar(delta * 8);
            // 快速褪色 (约 0.5-0.8秒完全消失)
            ref.current.material.opacity = Math.max(0, ref.current.material.opacity - delta * 2.5);
        }
    });
    return (
        <mesh ref={ref} scale={[1, 1, 1]}>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshBasicMaterial color="white" transparent opacity={1} toneMapped={false} />
        </mesh>
    );
};
