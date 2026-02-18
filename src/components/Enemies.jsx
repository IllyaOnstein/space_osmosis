import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../context/GameContext';
import * as THREE from 'three';

const LARGE_COUNT = 50;
const SMALL_COUNT = 150;
const BOUNDS = 100;
const RESPAWN_THRESHOLD = Math.floor(SMALL_COUNT / 2); // 剩余一半时开始补充
const RESPAWN_INTERVAL = 500; // 每500ms补充一个

// 生成随机位置
const randomPos = () => [
    (Math.random() - 0.5) * BOUNDS,
    (Math.random() - 0.5) * BOUNDS,
    (Math.random() - 0.5) * BOUNDS
];

// 单个可收集小天体
const Collectible = ({ id, position, size, color, onCollect }) => {
    const handleCollision = useCallback((e) => {
        const other = e.other?.rigidBodyObject;
        if (other?.userData?.type === 'player') {
            onCollect(id);
        }
    }, [id, onCollect]);

    return (
        <RigidBody
            position={position}
            colliders="ball"
            type="fixed"
            sensor={true}
            userData={{ type: 'collectible', id }}
            onIntersectionEnter={handleCollision}
        >
            <mesh>
                <sphereGeometry args={[size, 12, 12]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={3}
                    transparent={true}
                    opacity={0.8}
                />
            </mesh>
        </RigidBody>
    );
};

// 生成一个小天体数据
let nextId = SMALL_COUNT;
const createSmallData = (id) => ({
    id,
    key: `small-${id}-${Date.now()}`,
    position: randomPos(),
    size: 0.15 + Math.random() * 0.15,
    color: new THREE.Color().setHSL(0.45 + Math.random() * 0.15, 0.9, 0.6)
});

export const Enemies = () => {
    const { addScore } = useGame();

    // 小天体列表（可变，支持增删）
    const [smallList, setSmallList] = useState(() =>
        new Array(SMALL_COUNT).fill(0).map((_, i) => createSmallData(i))
    );
    const [collected, setCollected] = useState(new Set());

    // 收集小天体
    const handleCollect = useCallback((id) => {
        setCollected(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            addScore(1);
            return next;
        });
    }, [addScore]);

    // 补充机制：当剩余数量 < 一半时，逐渐补充
    useEffect(() => {
        const remaining = smallList.length - collected.size;
        if (remaining >= RESPAWN_THRESHOLD) return;

        const toSpawn = SMALL_COUNT - remaining; // 需要补充的数量
        let spawned = 0;

        const timer = setInterval(() => {
            if (spawned >= toSpawn) {
                clearInterval(timer);
                return;
            }
            const newId = nextId++;
            setSmallList(prev => [...prev, createSmallData(newId)]);
            spawned++;
        }, RESPAWN_INTERVAL);

        return () => clearInterval(timer);
    }, [collected.size, smallList.length]);

    // 大天体（五颜六色）
    const largeEnemies = useMemo(() => {
        return new Array(LARGE_COUNT).fill(0).map((_, i) => ({
            key: `large-${i}`,
            position: randomPos(),
            mass: Math.random() * 10 + 3,
            // 五颜六色：随机色相，高饱和度
            color: new THREE.Color().setHSL(Math.random(), 0.75, 0.5)
        }));
    }, []);

    return (
        <>
            {/* 大天体（五颜六色，危险） */}
            {largeEnemies.map((data) => (
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

            {/* 小天体（可收集） */}
            {smallList.map((data) => (
                !collected.has(data.id) && (
                    <Collectible
                        key={data.key}
                        id={data.id}
                        position={data.position}
                        size={data.size}
                        color={data.color}
                        onCollect={handleCollect}
                    />
                )
            ))}
        </>
    );
};
