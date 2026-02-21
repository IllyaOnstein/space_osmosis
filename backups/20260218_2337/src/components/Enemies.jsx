import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../context/GameContext';
import * as THREE from 'three';

const LARGE_COUNT = 225;    // 150 * 1.5
const SMALL_COUNT = 900;    // 600 * 1.5
const MIN_SPAWN_DIST = 60;  // 传送最近距离（不会出现在玩家眼前）
const MAX_SPAWN_DIST = 150; // 传送最远距离
const DESPAWN_DIST = 180;   // 超过此距离回收
const RESPAWN_THRESHOLD = Math.floor(SMALL_COUNT / 2);
const RESPAWN_INTERVAL = 200; // 更快补充

// 在玩家周围的球壳中生成随机位置（保证不会太近也不会太远）
const randomPosInShell = (center = { x: 0, y: 0, z: 0 }, innerR = MIN_SPAWN_DIST, outerR = MAX_SPAWN_DIST) => {
    // 随机方向（均匀球面分布）
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // 随机距离（在内外半径之间）
    const r = innerR + Math.random() * (outerR - innerR);
    return [
        center.x + r * Math.sin(phi) * Math.cos(theta),
        center.y + r * Math.sin(phi) * Math.sin(theta),
        center.z + r * Math.cos(phi)
    ];
};

// 初始生成：围绕原点均匀分布
const randomPosAround = (center = { x: 0, y: 0, z: 0 }, radius = MAX_SPAWN_DIST) => [
    center.x + (Math.random() - 0.5) * radius * 2,
    center.y + (Math.random() - 0.5) * radius * 2,
    center.z + (Math.random() - 0.5) * radius * 2
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

// 大天体组件
const LargeEnemy = React.forwardRef(({ data }, ref) => (
    <RigidBody
        ref={ref}
        position={data.position}
        colliders="ball"
        linearDamping={0.1}
        userData={{ type: 'enemy', mass: data.mass, id: data.key }}
        onCollisionEnter={(e) => {
            const other = e.other?.rigidBodyObject;
            if (other?.userData?.type === 'player' && window.shieldActive) {
                // 护盾吸收：大天体传送走，护盾碎裂
                window.shieldActive = false;
                window.shieldBroken = true;
                if (ref?.current) {
                    const pos = ref.current.translation();
                    // 传送到远处随机位置
                    const angle = Math.random() * Math.PI * 2;
                    const phi = Math.acos(2 * Math.random() - 1);
                    const dist = 150 + Math.random() * 50;
                    ref.current.setTranslation({
                        x: pos.x + Math.sin(phi) * Math.cos(angle) * dist,
                        y: pos.y + Math.cos(phi) * dist * 0.5,
                        z: pos.z + Math.sin(phi) * Math.sin(angle) * dist,
                    }, true);
                    ref.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
                }
            }
        }}
    >
        <mesh>
            <sphereGeometry args={[Math.pow(data.mass, 1 / 3) * 0.75, 16, 16]} />
            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={2} />
        </mesh>
    </RigidBody>
));

let nextId = SMALL_COUNT;
const createSmallData = (id, center) => ({
    id,
    key: `small-${id}-${Date.now()}`,
    position: randomPosInShell(center, MIN_SPAWN_DIST, MAX_SPAWN_DIST),
    // 小球体积增加: 0.15 -> 0.25 (约1.5倍)
    size: 0.25 + Math.random() * 0.2,
    color: new THREE.Color().setHSL(0.45 + Math.random() * 0.15, 0.9, 0.6)
});

// 收集特效组件（超轻量版：仅发光球扩散）
const MAX_EFFECTS = 8;

const OrbExplosion = ({ position, color, onComplete }) => {
    const ringRef = useRef();
    const elapsed = useRef(0);
    const done = useRef(false);
    const duration = 0.4; // 0.4秒，更短更轻

    useFrame((_, delta) => {
        if (done.current) return;
        elapsed.current += delta;
        const t = elapsed.current / duration;

        if (t >= 1.0) {
            done.current = true;
            onComplete();
            return;
        }

        // 发光球：快速扩大然后淡出
        if (ringRef.current) {
            const scale = 0.3 + t * 1.5;
            ringRef.current.scale.set(scale, scale, scale);
            ringRef.current.material.opacity = (1 - t) * 0.5;
        }
    });

    return (
        <mesh ref={ringRef} position={position}>
            <sphereGeometry args={[0.5, 6, 6]} />
            <meshBasicMaterial
                color={color}
                transparent
                opacity={0.5}
                toneMapped={false}
            />
        </mesh>
    );
};

export const Enemies = () => {
    const { addScore, playerPosRef } = useGame();
    const largeRefs = useRef([]);

    // 收集特效列表
    const [effects, setEffects] = useState([]);

    const removeEffect = useCallback((id) => {
        setEffects(prev => prev.filter(e => e.id !== id));
    }, []);

    // 大天体数据
    const largeEnemies = useMemo(() => {
        return new Array(LARGE_COUNT).fill(0).map((_, i) => ({
            key: `large-${i}`,
            position: randomPosAround({ x: 0, y: 0, z: 0 }, MAX_SPAWN_DIST),
            mass: Math.random() * 10 + 3,
            color: new THREE.Color().setHSL(Math.random(), 0.75, 0.5)
        }));
    }, []);

    // 每帧检测大天体距离
    const lastLaserHitRef = useRef(0);
    useFrame(() => {
        const pp = playerPosRef.current;
        if (!pp) return;

        largeRefs.current.forEach((ref) => {
            if (!ref) return;
            const t = ref.translation();
            const dx = t.x - pp.x;
            const dy = t.y - pp.y;
            const dz = t.z - pp.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist > DESPAWN_DIST) {
                // 传送到玩家远处的球壳中（不会紧贴玩家）
                const newPos = randomPosInShell(pp, MIN_SPAWN_DIST, MAX_SPAWN_DIST);
                ref.setTranslation({ x: newPos[0], y: newPos[1], z: newPos[2] }, true);
                ref.setLinvel({ x: 0, y: 0, z: 0 }, true);
            }
        });

        // --- 激光击中检测 ---
        if (window.laserHit && window.laserHit.time !== lastLaserHitRef.current) {
            const hitPt = window.laserHit.point;
            lastLaserHitRef.current = window.laserHit.time;

            // 检查大天体
            let closestDist = 5; // 命中半径阈值
            let closestRef = null;
            largeRefs.current.forEach((ref) => {
                if (!ref) return;
                const t = ref.translation();
                const dx = t.x - hitPt.x;
                const dy = t.y - hitPt.y;
                const dz = t.z - hitPt.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestRef = ref;
                }
            });

            if (closestRef) {
                // 传送走（消失）
                const newPos = randomPosInShell(pp, MIN_SPAWN_DIST + 50, MAX_SPAWN_DIST + 50);
                closestRef.setTranslation({ x: newPos[0], y: newPos[1], z: newPos[2] }, true);
                closestRef.setLinvel({ x: 0, y: 0, z: 0 }, true);
            }

            // 检查得分小球
            let closestOrbDist = 3;
            let closestOrbId = null;
            smallList.forEach((orb) => {
                if (collected.has(orb.id)) return;
                const dx = orb.position[0] - hitPt.x;
                const dy = orb.position[1] - hitPt.y;
                const dz = orb.position[2] - hitPt.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist < closestOrbDist) {
                    closestOrbDist = dist;
                    closestOrbId = orb.id;
                }
            });

            if (closestOrbId !== null) {
                handleCollect(closestOrbId);
            }
        }
    });

    // 小天体列表
    const [smallList, setSmallList] = useState(() =>
        new Array(SMALL_COUNT).fill(0).map((_, i) => ({
            id: i,
            key: `small-${i}-init`,
            position: randomPosAround({ x: 0, y: 0, z: 0 }, MAX_SPAWN_DIST),
            size: 0.25 + Math.random() * 0.2,
            color: new THREE.Color().setHSL(0.45 + Math.random() * 0.15, 0.9, 0.6)
        }))
    );
    const [collected, setCollected] = useState(new Set());

    const handleCollect = useCallback((id) => {
        setCollected(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });

        // 在 setCollected 外部处理加分和特效，避免嵌套状态更新
        addScore(1);

        // 查找被收集的小球数据以获取位置和颜色
        const orb = smallList.find(item => item.id === id);
        if (orb) {
            const effectId = Date.now() + Math.random();
            setEffects(prev => {
                const next = [...prev, {
                    id: effectId,
                    position: orb.position,
                    color: orb.color
                }];
                return next.length > MAX_EFFECTS ? next.slice(-MAX_EFFECTS) : next;
            });
        }
    }, [addScore, smallList]);

    // 补充机制
    useEffect(() => {
        const remaining = smallList.length - collected.size;
        if (remaining >= RESPAWN_THRESHOLD) return;

        const toSpawn = SMALL_COUNT - remaining;
        let spawned = 0;

        const timer = setInterval(() => {
            if (spawned >= toSpawn) {
                clearInterval(timer);
                return;
            }
            const newId = nextId++;
            setSmallList(prev => [...prev, createSmallData(newId, playerPosRef.current)]);
            spawned++;
        }, RESPAWN_INTERVAL);

        return () => clearInterval(timer);
    }, [collected.size, smallList.length]);

    return (
        <>
            {/* 大天体（五颜六色，危险） */}
            {largeEnemies.map((data, i) => (
                <LargeEnemy
                    key={data.key}
                    data={data}
                    ref={(el) => { largeRefs.current[i] = el; }}
                />
            ))}

            {/* 收集特效 */}
            {effects.map(effect => (
                <OrbExplosion
                    key={effect.id}
                    position={effect.position}
                    color={effect.color}
                    onComplete={() => removeEffect(effect.id)}
                />
            ))}

            {/* 1分得分小球（可收集） */}
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
