import React, { useMemo, useCallback, useRef } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../context/GameContext';

const COUNT = 50;
const MIN_SPAWN_DIST = 80;  // 传送最近距离
const MAX_SPAWN_DIST = 180; // 传送最远距离
const DESPAWN_DIST = 220;   // 超过此距离回收

// 在玩家周围的球壳中生成随机位置
const randomPosInShell = (center = { x: 0, y: 0, z: 0 }, innerR = MIN_SPAWN_DIST, outerR = MAX_SPAWN_DIST) => {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = innerR + Math.random() * (outerR - innerR);
    return [
        center.x + r * Math.sin(phi) * Math.cos(theta),
        center.y + r * Math.sin(phi) * Math.sin(theta),
        center.z + r * Math.cos(phi)
    ];
};

export const CrystalShards = () => {
    const { addScore, playerPosRef } = useGame();
    const shardRefs = useRef([]);

    const shards = useMemo(() => {
        return new Array(COUNT).fill(0).map((_, i) => ({
            key: i,
            position: [
                (Math.random() - 0.5) * MAX_SPAWN_DIST * 2,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100
            ],
            rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
            scale: [2, 2, 2],
        }));
    }, []);

    // 每帧检测距离，太远的传送到玩家远处球壳中
    useFrame(() => {
        const pp = playerPosRef.current;
        if (!pp) return;

        shardRefs.current.forEach((ref) => {
            if (!ref) return;
            const t = ref.translation();
            const dx = t.x - pp.x;
            const dy = t.y - pp.y;
            const dz = t.z - pp.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist > DESPAWN_DIST) {
                const newPos = randomPosInShell(pp);
                ref.setTranslation({ x: newPos[0], y: newPos[1], z: newPos[2] }, true);
            }
        });
    });

    const handleCollision = useCallback((e) => {
        const other = e.other?.rigidBodyObject;
        if (other?.userData?.type === 'player') {
            addScore(-0.1);
        }
    }, [addScore]);

    return (
        <>
            {shards.map((data, i) => (
                <RigidBody
                    key={`shard-${data.key}`}
                    ref={(el) => { shardRefs.current[i] = el; }}
                    position={data.position}
                    rotation={data.rotation}
                    type="fixed"
                    sensor={true}
                    onIntersectionEnter={handleCollision}
                >
                    <mesh scale={data.scale}>
                        <octahedronGeometry args={[1, 0]} />
                        <meshStandardMaterial
                            color="lime"
                            emissive="lime"
                            emissiveIntensity={2}
                            wireframe={true}
                            transparent={true}
                            opacity={0.6}
                        />
                    </mesh>
                </RigidBody>
            ))}
        </>
    );
};
