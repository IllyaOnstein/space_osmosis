import React, { useMemo, useCallback } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useGame } from '../context/GameContext';
import * as THREE from 'three';

const COUNT = 50; // 原100减半
const BOUNDS = 200; // 保持宽范围

export const CrystalShards = () => {
    const { addScore } = useGame();

    const shards = useMemo(() => {
        return new Array(COUNT).fill(0).map((_, i) => ({
            key: i,
            position: [
                (Math.random() - 0.5) * BOUNDS,
                (Math.random() - 0.5) * 100,
                (Math.random() - 0.5) * 100
            ],
            rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
            scale: [2, 2, 2], // 保持原有大小
        }));
    }, []);

    const handleCollision = useCallback((e) => {
        // 检查是否和玩家碰撞
        const other = e.other?.rigidBodyObject;
        if (other?.userData?.type === 'player') {
            addScore(-0.1); // 扣 0.1 分
        }
    }, [addScore]);

    return (
        <>
            {shards.map((data) => (
                <RigidBody
                    key={`shard-${data.key}`}
                    position={data.position}
                    rotation={data.rotation}
                    type="fixed"
                    sensor={true} // 传感器模式，不产生物理碰撞反应，只触发事件
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
