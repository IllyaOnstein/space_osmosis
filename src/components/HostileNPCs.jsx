import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import { Trail } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../context/GameContext';

const NPC_COUNT = 6;
const MIN_SPAWN_DIST = 40;
const MAX_SPAWN_DIST = 100;
const TRACKING_RANGE = 45;
const NPC_SHOOT_COOLDOWN = 2.0;    // 和玩家一样的2秒射击冷却
const NPC_SHOOT_RANGE = 120;       // 和玩家激光一样的120射程
const NPC_PROJECTILE_SPEED = 25;   // 子弹速度
const NPC_PROJECTILE_LIFETIME = 4; // 子弹最长存活时间(秒)
const NPC_PROJECTILE_DAMAGE = 1;   // 子弹伤害

const randomPosInShell = (center, innerR = MIN_SPAWN_DIST, outerR = MAX_SPAWN_DIST) => {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = innerR + Math.random() * (outerR - innerR);
    return [
        center.x + r * Math.sin(phi) * Math.cos(theta),
        center.y + r * Math.sin(phi) * Math.sin(theta),
        center.z + r * Math.cos(phi)
    ];
};

// ======================== 单个NPC ========================
const HostileNPC = ({ id, initialLevel, initialPosition, onDestroy }) => {
    const rigidBody = useRef();
    const meshRef = useRef();
    const shieldMeshRef = useRef();
    const destroyedRef = useRef(false);
    const lastLaserHitRef = useRef(null);
    const { playerPosRef, takeDamage, addExperience } = useGame();

    const level = initialLevel;
    const radius = 0.5 + (level - 1) * 0.2;
    const speed = level >= 5 ? 20 : 5 + level * 2; // 5级NPC更快

    // === 4级护盾: 一次性吸收致命伤害 ===
    const shieldActiveRef = useRef(level >= 4);
    const [shieldVisible, setShieldVisible] = useState(level >= 4);

    // === 5级射击: 5秒冷却 ===
    const lastShotTimeRef = useRef(0);

    // 稳定的初始位置
    const stablePosition = useMemo(() => initialPosition, []);

    // 尝试销毁NPC（如果有护盾则消耗护盾）
    const tryDestroy = useCallback(() => {
        if (destroyedRef.current) return false;
        if (shieldActiveRef.current) {
            // 护盾吸收一次伤害
            shieldActiveRef.current = false;
            setShieldVisible(false);
            return false; // 没有被销毁
        }
        return true; // 可以被销毁
    }, []);

    const doDestroy = useCallback(() => {
        if (destroyedRef.current) return;
        if (!tryDestroy()) return; // 护盾抵挡了
        destroyedRef.current = true;
        addExperience(2);
        window.ultimateChargeAdd = (window.ultimateChargeAdd || 0) + 0.1;
        if (window.npcPositions) delete window.npcPositions[id];
        onDestroy(id);
    }, [id, onDestroy, addExperience, tryDestroy]);

    useFrame((state, delta) => {
        if (!rigidBody.current || !playerPosRef.current || destroyedRef.current) return;

        const translation = rigidBody.current.translation();
        const pos = new THREE.Vector3(translation.x, translation.y, translation.z);
        const pPos = new THREE.Vector3(playerPosRef.current.x, playerPosRef.current.y, playerPosRef.current.z);
        const dist = pos.distanceTo(pPos);
        const now = state.clock.getElapsedTime();

        // 上报位置给雷达
        if (!window.npcPositions) window.npcPositions = {};
        window.npcPositions[id] = { x: translation.x, y: translation.y, z: translation.z };

        // --- 追踪与移动逻辑 ---
        // 5级NPC在射程内就会追踪玩家（边射击边接近）
        const effectiveRange = level >= 5 ? NPC_SHOOT_RANGE : TRACKING_RANGE;
        if (dist < effectiveRange) {
            const dir = pPos.clone().sub(pos).normalize();
            rigidBody.current.applyImpulse({
                x: dir.x * speed * delta * 2,
                y: dir.y * speed * delta * 2,
                z: dir.z * speed * delta * 2
            }, true);
        } else {
            const noise = now + id * 17.31;
            rigidBody.current.applyImpulse({
                x: Math.sin(noise) * 2 * delta,
                y: Math.cos(noise * 0.8) * 2 * delta,
                z: Math.sin(noise * 1.2) * 2 * delta
            }, true);
        }

        // 限制速度
        const vel = rigidBody.current.linvel();
        const currentSpeed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
        if (currentSpeed > speed) {
            const ratio = speed / currentSpeed;
            rigidBody.current.setLinvel({
                x: vel.x * ratio,
                y: vel.y * ratio,
                z: vel.z * ratio
            }, true);
        }

        // --- 5级射击逻辑 ---
        if (level >= 5 && dist < NPC_SHOOT_RANGE && now - lastShotTimeRef.current > NPC_SHOOT_COOLDOWN) {
            lastShotTimeRef.current = now;
            // 发射子弹
            const direction = pPos.clone().sub(pos).normalize();
            if (!window.npcProjectiles) window.npcProjectiles = [];
            window.npcProjectiles.push({
                id: `npc_proj_${id}_${Date.now()}`,
                pos: pos.clone(),
                dir: direction,
                speed: NPC_PROJECTILE_SPEED,
                spawnTime: now,
                damage: NPC_PROJECTILE_DAMAGE,
                alive: true
            });
        }

        // --- 护盾视觉脉冲 ---
        if (shieldMeshRef.current && shieldActiveRef.current) {
            shieldMeshRef.current.material.opacity = 0.15 + Math.sin(now * 4) * 0.1;
        }

        // --- 激光击中检测（带去重！） ---
        if (window.laserHit && window.laserHit.time !== lastLaserHitRef.current) {
            const hitPt = window.laserHit.point;
            const dHit = pos.distanceTo(new THREE.Vector3(hitPt.x, hitPt.y, hitPt.z));
            lastLaserHitRef.current = window.laserHit.time;
            if (dHit < radius + 1.5) {
                doDestroy();
                return;
            }
        }

        // --- 黑洞吸引 ---
        if (window.blackHoleActive) {
            const bh = window.blackHoleActive;
            const dBH = pos.distanceTo(new THREE.Vector3(bh.x, bh.y, bh.z));
            if (dBH < bh.radius) {
                if (dBH < 3) {
                    doDestroy();
                    return;
                } else {
                    const pull = 40 / Math.max(dBH, 1);
                    const dir = new THREE.Vector3(bh.x - pos.x, bh.y - pos.y, bh.z - pos.z).normalize();
                    rigidBody.current.setLinvel({
                        x: dir.x * pull,
                        y: dir.y * pull,
                        z: dir.z * pull
                    }, true);
                }
            }
        }

        // --- 范围外回收 ---
        if (dist > 180) {
            const newPos = randomPosInShell(playerPosRef.current);
            rigidBody.current.setTranslation({ x: newPos[0], y: newPos[1], z: newPos[2] }, true);
            rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }
    });

    const onCollision = useCallback((e) => {
        const other = e.other?.rigidBodyObject;
        if (other?.userData?.type === 'player') {
            if (window.dashActive || window.shieldActive || window.rageActive || window.goldenShieldActive) {
                doDestroy();
            } else {
                takeDamage(2);
                doDestroy();
            }
        }
    }, [doDestroy, takeDamage]);

    // NPC 球体颜色：4级偏橙，5级偏紫
    const bodyColor = level >= 5 ? '#cc00ff' : level >= 4 ? '#ff6600' : '#ff2020';
    const emissiveColor = level >= 5 ? '#9900cc' : level >= 4 ? '#cc4400' : '#ff0000';

    return (
        <RigidBody
            ref={rigidBody}
            position={stablePosition}
            colliders="ball"
            onCollisionEnter={onCollision}
            userData={{ type: 'enemy_npc', level }}
            linearDamping={0.5}
        >
            {level >= 3 ? (
                <Trail
                    width={level >= 5 ? 5 : 2}
                    length={level >= 5 ? 10 : 5}
                    color={emissiveColor}
                    attenuation={(t) => t * t}
                >
                    <mesh ref={meshRef}>
                        <sphereGeometry args={[radius, 16, 16]} />
                        <meshStandardMaterial
                            color={bodyColor}
                            emissive={emissiveColor}
                            emissiveIntensity={3}
                            toneMapped={false}
                        />
                    </mesh>
                </Trail>
            ) : (
                <mesh ref={meshRef}>
                    <sphereGeometry args={[radius, 16, 16]} />
                    <meshStandardMaterial
                        color={bodyColor}
                        emissive={emissiveColor}
                        emissiveIntensity={2}
                        toneMapped={false}
                    />
                </mesh>
            )}

            {/* 4级护盾视觉效果 */}
            {shieldVisible && (
                <mesh ref={shieldMeshRef}>
                    <sphereGeometry args={[radius + 0.3, 24, 24]} />
                    <meshStandardMaterial
                        color="#4488ff"
                        emissive="#4488ff"
                        emissiveIntensity={2}
                        transparent
                        opacity={0.2}
                        side={THREE.DoubleSide}
                        toneMapped={false}
                    />
                </mesh>
            )}

            {/* 旋转光环 */}
            {level >= 4 && <NPCRings level={level} radius={radius} color={emissiveColor} />}
        </RigidBody>
    );
};

// ======================== NPC旋转光环 ========================
const NPCRings = ({ level, radius, color }) => {
    const ring1Ref = useRef();
    const ring2Ref = useRef();
    const ringCount = level >= 5 ? 2 : 1;

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (ring1Ref.current) {
            ring1Ref.current.rotation.x = t * 1.5;
            ring1Ref.current.rotation.y = t * 0.8;
        }
        if (ring2Ref.current) {
            ring2Ref.current.rotation.x = -t * 1.2;
            ring2Ref.current.rotation.z = t * 1.0;
        }
    });

    const ringColor = level >= 5 ? '#cc00ff' : '#ff6600';

    return (
        <group>
            <mesh ref={ring1Ref}>
                <torusGeometry args={[radius + 0.5, 0.04, 12, 48]} />
                <meshStandardMaterial
                    color={ringColor}
                    emissive={ringColor}
                    emissiveIntensity={4}
                    toneMapped={false}
                    transparent
                    opacity={0.8}
                />
            </mesh>
            {ringCount >= 2 && (
                <mesh ref={ring2Ref}>
                    <torusGeometry args={[radius + 0.7, 0.04, 12, 48]} />
                    <meshStandardMaterial
                        color={ringColor}
                        emissive={ringColor}
                        emissiveIntensity={4}
                        toneMapped={false}
                        transparent
                        opacity={0.8}
                    />
                </mesh>
            )}
        </group>
    );
};

// ======================== NPC子弹系统 ========================
const NPCProjectiles = () => {
    const groupRef = useRef();
    const { playerPosRef, takeDamage } = useGame();
    const projectileMeshes = useRef({});

    useFrame((state, delta) => {
        if (!window.npcProjectiles || !playerPosRef.current) return;

        const now = state.clock.getElapsedTime();
        const pPos = new THREE.Vector3(playerPosRef.current.x, playerPosRef.current.y, playerPosRef.current.z);

        for (let i = window.npcProjectiles.length - 1; i >= 0; i--) {
            const proj = window.npcProjectiles[i];
            if (!proj.alive) continue;

            // 移动子弹
            proj.pos.x += proj.dir.x * proj.speed * delta;
            proj.pos.y += proj.dir.y * proj.speed * delta;
            proj.pos.z += proj.dir.z * proj.speed * delta;

            // 检测与玩家的碰撞
            const dPlayer = proj.pos.distanceTo(pPos);
            if (dPlayer < 1.5) {
                // 检查玩家当前是否无敌
                if (!window.dashActive && !window.shieldActive && !window.rageActive && !window.goldenShieldActive) {
                    takeDamage(proj.damage);
                }
                proj.alive = false;
            }

            // 超时销毁
            if (now - proj.spawnTime > NPC_PROJECTILE_LIFETIME) {
                proj.alive = false;
            }
        }

        // 清理死亡子弹
        window.npcProjectiles = window.npcProjectiles.filter(p => p.alive);
    });

    // 渲染子弹
    return (
        <group ref={groupRef}>
            <NPCProjectileRenderer />
        </group>
    );
};

// 子弹渲染器：从 window.npcProjectiles 读取数据，每帧渲染
const NPCProjectileRenderer = () => {
    const meshesRef = useRef([]);
    const groupRef = useRef();

    useFrame(() => {
        if (!window.npcProjectiles || !groupRef.current) return;

        // 确保有足够的子弹 mesh
        const container = groupRef.current;
        const projs = window.npcProjectiles.filter(p => p.alive);

        // 动态管理子弹mesh数量
        while (container.children.length > projs.length) {
            const child = container.children[container.children.length - 1];
            child.geometry?.dispose();
            child.material?.dispose();
            container.remove(child);
        }
        while (container.children.length < projs.length) {
            // 激光段：用细长的圆柱体模拟
            const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6);
            geo.rotateX(Math.PI / 2); // 让它沿Z轴延伸
            const mat = new THREE.MeshStandardMaterial({
                color: '#ff4400',
                emissive: '#ff2200',
                emissiveIntensity: 8,
                toneMapped: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            container.add(mesh);
        }

        // 更新位置和朝向
        for (let i = 0; i < projs.length; i++) {
            const mesh = container.children[i];
            const proj = projs[i];
            mesh.position.set(proj.pos.x, proj.pos.y, proj.pos.z);
            // 让激光段朝向飞行方向
            mesh.lookAt(proj.pos.x + proj.dir.x, proj.pos.y + proj.dir.y, proj.pos.z + proj.dir.z);
        }
    });

    return <group ref={groupRef} />;
};

// ======================== 父组件 ========================
export const HostileNPCs = () => {
    const { level: playerLevel, playerPosRef } = useGame();
    const [npcs, setNpcs] = useState([]);
    const npcIdCounter = useRef(100);

    const getWeightedLevel = useCallback((pLevel) => {
        const choices = [];
        // 当玩家满级时，大幅增加同级NPC的比例
        if (pLevel >= 5) {
            // 满级: 50% LV5, 33% LV4, 17% LV3
            for (let i = 0; i < 3; i++) choices.push(5);
            for (let i = 0; i < 2; i++) choices.push(4);
            choices.push(3);
        } else {
            // 非满级: 保持原有的权重
            if (pLevel > 1) {
                for (let i = 0; i < 2; i++) choices.push(pLevel - 1);
            }
            for (let i = 0; i < 3; i++) choices.push(pLevel);
            if (pLevel < 5) {
                for (let i = 0; i < 2; i++) choices.push(pLevel + 1);
            }
        }
        return choices[Math.floor(Math.random() * choices.length)];
    }, []);

    const createNPC = useCallback((center) => {
        const id = npcIdCounter.current++;
        const pos = randomPosInShell(center || { x: 0, y: 0, z: 0 });
        return {
            id,
            level: getWeightedLevel(playerLevel),
            position: pos
        };
    }, [playerLevel, getWeightedLevel]);

    useEffect(() => {
        if (playerLevel < 2) return;
        if (npcs.length === 0) {
            const center = playerPosRef?.current || { x: 0, y: 0, z: 0 };
            const initialNpcs = Array.from({ length: NPC_COUNT }).map(() => createNPC(center));
            setNpcs(initialNpcs);
        }
    }, [playerLevel, npcs.length, createNPC]);

    const handleNPCDestroy = useCallback((id) => {
        setNpcs(prev => prev.filter(npc => npc.id !== id));
        setTimeout(() => {
            setNpcs(prev => {
                if (prev.length >= NPC_COUNT) return prev;
                const center = playerPosRef?.current || { x: 0, y: 0, z: 0 };
                const pos = randomPosInShell(center);
                const newId = npcIdCounter.current++;
                return [...prev, {
                    id: newId,
                    level: getWeightedLevel(playerLevel),
                    position: pos
                }];
            });
        }, 2000);
    }, [playerLevel, getWeightedLevel]);

    // NPC 位置由各自在 useFrame 中写入 window.npcPositions

    if (playerLevel < 2) return null;

    return (
        <group>
            {npcs.map(npc => (
                <HostileNPC
                    key={npc.id}
                    id={npc.id}
                    initialLevel={npc.level}
                    initialPosition={npc.position}
                    onDestroy={handleNPCDestroy}
                />
            ))}
            <NPCProjectiles />
        </group>
    );
};
