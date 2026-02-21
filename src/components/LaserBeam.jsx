import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const LASER_RANGE = 120;
const LASER_SPEED = 60;
const BOLT_LENGTH = 3;
const BOLT_WIDTH = 0.12;
const MAX_BOLTS = 10;
const HOMING_RANGE = 40; // L5追踪搜索半径
const HOMING_TURN = 2.5; // 追踪转向速度(弧度/秒)

// 等级对应的激光颜色（与玩家小球颜色相同）
const LEVEL_COLORS = {
    4: { color: '#ff4500', emissive: '#ff2200' },  // L4: 橙红色（和L4小球一致）
    5: { color: '#a020f0', emissive: '#8800cc' },  // L5: 紫色（和L5黑洞一致）
};

export const LaserBeam = () => {
    const { scene } = useThree();

    const boltsRef = useRef(
        new Array(MAX_BOLTS).fill(null).map(() => ({
            active: false,
            position: new THREE.Vector3(),
            direction: new THREE.Vector3(),
            traveled: 0,
            level: 4,
            homing: false,
        }))
    );
    const meshRefs = useRef([]);
    const lastShotTimeRef = useRef(0);

    // 碎裂粒子
    const shardGroupRef = useRef();
    const shardDataRef = useRef([]);
    const shardTimerRef = useRef(0);
    const hitPointRef = useRef(new THREE.Vector3());
    const SHARD_COUNT = 12;
    const SHARD_DURATION = 0.6;

    const hitEffectRef = useRef();
    const hitFlashTimerRef = useRef(0);

    const _upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);
    const _tmpVec = useMemo(() => new THREE.Vector3(), []);

    useFrame((_, delta) => {
        const bolts = boltsRef.current;

        // 检查新激光发射
        if (window.laserShot && window.laserShot.time !== lastShotTimeRef.current) {
            const shot = window.laserShot;
            lastShotTimeRef.current = shot.time;

            let slot = bolts.find(b => !b.active);
            if (!slot) {
                slot = bolts.reduce((a, b) => a.traveled > b.traveled ? a : b);
            }

            slot.active = true;
            slot.traveled = 0;
            slot.level = shot.level || 4;
            slot.homing = false;
            slot.position.set(shot.origin.x, shot.origin.y, shot.origin.z);
            slot.direction.set(shot.direction.x, shot.direction.y, shot.direction.z).normalize();
        }

        // 更新所有弹
        for (let i = 0; i < MAX_BOLTS; i++) {
            const bolt = bolts[i];
            const mesh = meshRefs.current[i];
            if (!mesh) continue;

            if (!bolt.active) {
                mesh.visible = false;
                continue;
            }

            // L5追踪：飞行过半距离后启动
            if (bolt.level >= 5 && bolt.traveled >= LASER_RANGE / 2 && !bolt.homing) {
                bolt.homing = true;
            }

            // 追踪逻辑
            if (bolt.homing) {
                let nearest = null;
                let nearestDist = HOMING_RANGE;

                scene.traverse((obj) => {
                    if (!obj.isMesh || !obj.visible) return;
                    // 跳过自己的弹段和玩家
                    if (meshRefs.current.includes(obj)) return;
                    let parent = obj;
                    while (parent) {
                        if (parent.userData?.type === 'player') return;
                        parent = parent.parent;
                    }
                    _tmpVec.setFromMatrixPosition(obj.matrixWorld);
                    const dist = bolt.position.distanceTo(_tmpVec);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearest = _tmpVec.clone();
                    }
                });

                if (nearest) {
                    const toTarget = nearest.sub(bolt.position).normalize();
                    const maxTurn = HOMING_TURN * delta;
                    const angle = bolt.direction.angleTo(toTarget);
                    if (angle > 0.001) {
                        const t = Math.min(maxTurn / angle, 1);
                        bolt.direction.lerp(toTarget, t).normalize();
                    }
                }
            }

            // 飞行
            const moveDistance = LASER_SPEED * delta;
            bolt.position.addScaledVector(bolt.direction, moveDistance);
            bolt.traveled += moveDistance;

            if (bolt.traveled >= LASER_RANGE) {
                bolt.active = false;
                mesh.visible = false;
                continue;
            }

            // 碰撞检测
            const rayOrigin = bolt.position.clone().addScaledVector(bolt.direction, -BOLT_LENGTH);
            const raycaster = new THREE.Raycaster(rayOrigin, bolt.direction, 0, BOLT_LENGTH + moveDistance);
            const allMeshes = [];
            scene.traverse((obj) => {
                if (obj.isMesh && obj.visible && !meshRefs.current.includes(obj)) {
                    allMeshes.push(obj);
                }
            });

            const intersects = raycaster.intersectObjects(allMeshes, false);
            let hitResult = null;
            for (const hit of intersects) {
                let isPlayer = false;
                let parent = hit.object;
                while (parent) {
                    if (parent.userData?.type === 'player') {
                        isPlayer = true;
                        break;
                    }
                    parent = parent.parent;
                }
                if (!isPlayer) {
                    hitResult = hit;
                    break;
                }
            }

            if (hitResult) {
                bolt.active = false;
                mesh.visible = false;
                hitPointRef.current.copy(hitResult.point);

                window.laserHit = {
                    point: hitResult.point.clone(),
                    time: Date.now(),
                };

                shardTimerRef.current = SHARD_DURATION;
                hitFlashTimerRef.current = 0.35;
                shardDataRef.current = new Array(SHARD_COUNT).fill(0).map(() => ({
                    pos: new THREE.Vector3(),
                    vel: new THREE.Vector3(
                        (Math.random() - 0.5) * 8,
                        (Math.random() - 0.5) * 8,
                        (Math.random() - 0.5) * 8
                    ),
                }));
                continue;
            }

            // 渲染
            mesh.visible = true;
            const center = bolt.position.clone().addScaledVector(bolt.direction, -BOLT_LENGTH / 2);
            mesh.position.copy(center);
            const quat = new THREE.Quaternion().setFromUnitVectors(_upVec, bolt.direction);
            mesh.quaternion.copy(quat);

            // 按等级设置颜色
            const lc = LEVEL_COLORS[bolt.level] || LEVEL_COLORS[4];
            mesh.material.color.set(lc.color);
            mesh.material.emissive.set(lc.emissive);
        }

        // 击中闪光
        if (hitEffectRef.current) {
            if (hitFlashTimerRef.current > 0) {
                hitFlashTimerRef.current -= delta;
                hitEffectRef.current.visible = true;
                hitEffectRef.current.position.copy(hitPointRef.current);
                const t = hitFlashTimerRef.current / 0.35;
                const scale = 1 + (1 - t) * 3;
                hitEffectRef.current.scale.set(scale, scale, scale);
                hitEffectRef.current.material.opacity = t * 0.8;
            } else {
                hitEffectRef.current.visible = false;
            }
        }

        // 碎裂粒子
        if (shardGroupRef.current) {
            if (shardTimerRef.current > 0) {
                shardTimerRef.current -= delta;
                shardGroupRef.current.visible = true;
                const t = 1 - shardTimerRef.current / SHARD_DURATION;
                const children = shardGroupRef.current.children;
                for (let i = 0; i < children.length && i < shardDataRef.current.length; i++) {
                    const sd = shardDataRef.current[i];
                    sd.pos.addScaledVector(sd.vel, delta);
                    children[i].position.copy(hitPointRef.current).add(sd.pos);
                    children[i].rotation.x += delta * 8;
                    children[i].rotation.z += delta * 5;
                    children[i].material.opacity = (1 - t) * 0.9;
                    const s = 0.15 * (1 - t * 0.7);
                    children[i].scale.set(s, s, s);
                }
            } else {
                shardGroupRef.current.visible = false;
            }
        }
    });

    return (
        <group>
            {/* 10个激光弹槽 - 使用 MeshStandard 使其像恒星一样发光 */}
            {new Array(MAX_BOLTS).fill(0).map((_, i) => (
                <mesh
                    key={i}
                    ref={(el) => { meshRefs.current[i] = el; }}
                    visible={false}
                >
                    <cylinderGeometry args={[BOLT_WIDTH, BOLT_WIDTH, BOLT_LENGTH, 8, 1]} />
                    <meshStandardMaterial
                        color="#ff4500"
                        emissive="#ff2200"
                        emissiveIntensity={6}
                        toneMapped={false}
                    />
                </mesh>
            ))}

            {/* 击中闪光 */}
            <mesh ref={hitEffectRef} visible={false}>
                <sphereGeometry args={[0.3, 8, 8]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.8}
                    toneMapped={false}
                />
            </mesh>

            {/* 碎裂粒子 */}
            <group ref={shardGroupRef} visible={false}>
                {new Array(SHARD_COUNT).fill(0).map((_, i) => (
                    <mesh key={i}>
                        <tetrahedronGeometry args={[1, 0]} />
                        <meshBasicMaterial
                            color="#ff4400"
                            transparent
                            opacity={0.9}
                            toneMapped={false}
                        />
                    </mesh>
                ))}
            </group>
        </group>
    );
};
