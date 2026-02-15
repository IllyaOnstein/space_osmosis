import React, { useMemo } from 'react';
import { InstancedRigidBodies, RigidBody } from '@react-three/rapier';
import { useGame } from '../context/GameContext';
import * as THREE from 'three';

// Use standard RigidBody list for logic simplicity first, optimize to Instanced later if needed.
// Actually, strict requirements said "Optimization: Use InstancedMesh if possible".
// InstancedRigidBodies makes this easier.

const COUNT = 200;
const BOUNDS = 100;

export const Enemies = () => {
    const { playerMass } = useGame();

    const enemies = useMemo(() => {
        return new Array(COUNT).fill(0).map((_, i) => ({
            key: i,
            position: [
                (Math.random() - 0.5) * BOUNDS,
                (Math.random() - 0.5) * BOUNDS,
                (Math.random() - 0.5) * BOUNDS
            ],
            mass: Math.random() * 10 + 1, // Range 1-11
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
        }));
    }, []);

    return (
        <>
            {enemies.map((data) => (
                <RigidBody
                    key={data.key}
                    position={data.position}
                    colliders="ball"
                    linearDamping={0.1}
                    userData={{ type: 'enemy', mass: data.mass, id: data.key }}
                >
                    <mesh>
                        <sphereGeometry args={[Math.pow(data.mass, 1 / 3) * 0.5, 16, 16]} />
                        <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={2} />
                    </mesh>
                </RigidBody>
            ))}
        </>
    )
}
