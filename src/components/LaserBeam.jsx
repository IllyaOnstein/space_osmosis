import React, { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const LASER_RANGE = 120;
const BEAM_DURATION = 0.4; // 光束可见持续时间
const BEAM_WIDTH = 0.08;

export const LaserBeam = () => {
    const { scene } = useThree();
    const beamRef = useRef();
    const glowRef = useRef();
    const hitEffectRef = useRef();
    const stateRef = useRef({
        active: false,
        timer: 0,
        origin: new THREE.Vector3(),
        direction: new THREE.Vector3(),
        endPoint: new THREE.Vector3(),
        hitPoint: null,
        lastShotTime: 0,
    });

    // 碎裂粒子
    const shardGroupRef = useRef();
    const shardDataRef = useRef([]);
    const shardTimerRef = useRef(0);
    const SHARD_COUNT = 12;
    const SHARD_DURATION = 0.6;

    useFrame((_, delta) => {
        const st = stateRef.current;

        // 检查新激光发射
        if (window.laserShot && window.laserShot.time !== st.lastShotTime) {
            const shot = window.laserShot;
            st.lastShotTime = shot.time;
            st.active = true;
            st.timer = BEAM_DURATION;
            st.origin.set(shot.origin.x, shot.origin.y, shot.origin.z);
            st.direction.set(shot.direction.x, shot.direction.y, shot.direction.z).normalize();
            st.hitPoint = null;

            // 射线检测
            const raycaster = new THREE.Raycaster(st.origin, st.direction, 1.5, LASER_RANGE);
            const allMeshes = [];
            scene.traverse((obj) => {
                if (obj.isMesh && obj.visible) {
                    allMeshes.push(obj);
                }
            });

            const intersects = raycaster.intersectObjects(allMeshes, false);

            // 过滤掉玩家自身的mesh
            let hitResult = null;
            for (const hit of intersects) {
                // 向上查找是否属于玩家
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
                st.endPoint.copy(hitResult.point);
                st.hitPoint = hitResult.point.clone();

                // 找到被击中物体的 RigidBody（向上查找userData）
                let hitObj = hitResult.object;
                while (hitObj) {
                    const ud = hitObj.userData;
                    if (ud?.type === 'enemy' || ud?.type === 'crystal') {
                        // 标记被激光击中，让对应组件处理消失
                        window.laserHit = {
                            id: ud.id || ud.type,
                            type: ud.type,
                            point: st.hitPoint,
                            time: Date.now(),
                        };
                        break;
                    }
                    hitObj = hitObj.parent;
                }

                // 生成碎裂粒子
                shardTimerRef.current = SHARD_DURATION;
                shardDataRef.current = new Array(SHARD_COUNT).fill(0).map(() => ({
                    pos: new THREE.Vector3(),
                    vel: new THREE.Vector3(
                        (Math.random() - 0.5) * 8,
                        (Math.random() - 0.5) * 8,
                        (Math.random() - 0.5) * 8
                    ),
                }));
            } else {
                st.endPoint.copy(st.origin).addScaledVector(st.direction, LASER_RANGE);
            }
        }

        // 更新光束
        if (st.active) {
            st.timer -= delta;
            if (st.timer <= 0) {
                st.active = false;
            }
        }

        // 光束几何
        if (beamRef.current) {
            beamRef.current.visible = st.active;
            if (st.active) {
                const mid = st.origin.clone().add(st.endPoint).multiplyScalar(0.5);
                beamRef.current.position.copy(mid);
                const length = st.origin.distanceTo(st.endPoint);
                beamRef.current.scale.set(1, length, 1);
                // 用四元数旋转 cylinder（Y轴对齐 → 光束方向）
                const dir = st.endPoint.clone().sub(st.origin).normalize();
                const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                beamRef.current.quaternion.copy(quat);

                const fade = st.timer / BEAM_DURATION;
                beamRef.current.material.opacity = fade * 0.8;
            }
        }

        // 外层发光
        if (glowRef.current) {
            glowRef.current.visible = st.active;
            if (st.active) {
                const mid = st.origin.clone().add(st.endPoint).multiplyScalar(0.5);
                glowRef.current.position.copy(mid);
                const length = st.origin.distanceTo(st.endPoint);
                glowRef.current.scale.set(1, length, 1);
                const dir = st.endPoint.clone().sub(st.origin).normalize();
                const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                glowRef.current.quaternion.copy(quat);

                const fade = st.timer / BEAM_DURATION;
                glowRef.current.material.opacity = fade * 0.3;
            }
        }

        // 击中闪光
        if (hitEffectRef.current) {
            if (st.active && st.hitPoint) {
                hitEffectRef.current.visible = true;
                hitEffectRef.current.position.copy(st.hitPoint);
                const fade = st.timer / BEAM_DURATION;
                const scale = 1 + (1 - fade) * 3;
                hitEffectRef.current.scale.set(scale, scale, scale);
                hitEffectRef.current.material.opacity = fade * 0.8;
            } else {
                hitEffectRef.current.visible = false;
            }
        }

        // 碎裂粒子动画
        if (shardGroupRef.current) {
            if (shardTimerRef.current > 0) {
                shardTimerRef.current -= delta;
                shardGroupRef.current.visible = true;
                const t = 1 - shardTimerRef.current / SHARD_DURATION;
                const children = shardGroupRef.current.children;
                for (let i = 0; i < children.length && i < shardDataRef.current.length; i++) {
                    const sd = shardDataRef.current[i];
                    sd.pos.addScaledVector(sd.vel, delta);
                    children[i].position.copy(st.hitPoint || st.endPoint).add(sd.pos);
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
            {/* 核心光束 */}
            <mesh ref={beamRef} visible={false}>
                <cylinderGeometry args={[BEAM_WIDTH, BEAM_WIDTH, 1, 8, 1, true]} />
                <meshBasicMaterial
                    color="#ff3300"
                    transparent
                    opacity={0.8}
                    toneMapped={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* 外层发光 */}
            <mesh ref={glowRef} visible={false}>
                <cylinderGeometry args={[BEAM_WIDTH * 3, BEAM_WIDTH * 3, 1, 8, 1, true]} />
                <meshBasicMaterial
                    color="#ff6600"
                    transparent
                    opacity={0.3}
                    toneMapped={false}
                    side={THREE.DoubleSide}
                />
            </mesh>

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
