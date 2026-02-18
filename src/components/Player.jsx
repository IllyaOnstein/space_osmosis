import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { Vector3, MathUtils } from "three";
import { useGame } from "../context/GameContext";
import { PlayerVisuals, LevelUpFlash } from "./PlayerVisuals";

const BASE_THRUST = 8;
const BRAKE_FACTOR = 0.85;
const BASE_MAX_SPEED = 20;
const CAM_DISTANCE = 10;   // 摄像头距玩家距离
const CAM_HEIGHT_OFFSET = 1; // 摄像头看向玩家时稍微偏上
const MOUSE_SENSITIVITY = 0.003;

export const Player = () => {
    const body = useRef();
    const { camera, gl } = useThree();
    const { controlsRef, speedMultiplier, forceLevelUp, level, playerPosRef, cameraYawRef, dashStateRef, shieldStateRef, laserStateRef } = useGame();
    const [showLevelUpEffect, setShowLevelUpEffect] = React.useState(false);

    // 监听等级变化，触发特效
    const prevLevel = useRef(level);
    useEffect(() => {
        if (level > prevLevel.current) {
            setShowLevelUpEffect(true);
            setTimeout(() => setShowLevelUpEffect(false), 1000); // 1秒持续时间
        }
        prevLevel.current = level;
    }, [level]);

    // Alt+L 升级快捷键
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.altKey && (e.key === 'l' || e.key === 'L')) {
                forceLevelUp();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [forceLevelUp]);

    // 根据等级调整速度
    const THRUST = BASE_THRUST * speedMultiplier;
    const MAX_SPEED = BASE_MAX_SPEED * speedMultiplier;

    // 摄像头球坐标：yaw（水平角）和 pitch（垂直角）
    const camYaw = useRef(Math.PI); // 初始从后方看
    const camPitch = useRef(0.4);     // 初始稍微俯视

    // 键盘上下键状态（Space=上, Shift=下）
    const keysRef = useRef({ up: false, down: false });

    // --- 冲刺系统 ---
    const DASH_DURATION = 1.0;   // 冲刺持续1秒
    const DASH_COOLDOWN = 5.0;   // 冷却5秒
    const DASH_SPEED_MULT = 5.0; // 5倍速度
    const dashRef = useRef({
        active: false,
        timer: 0,
        cooldownTimer: 0,
        direction: new Vector3(),
    });

    // Z 键监听
    useEffect(() => {
        const onDashKey = (e) => {
            if ((e.key === 'z' || e.key === 'Z') && !e.altKey && !e.ctrlKey) {
                if (level >= 2 && !dashRef.current.active && dashRef.current.cooldownTimer <= 0) {
                    // 启动冲刺
                    const yaw = camYaw.current;
                    const pitch = camPitch.current;
                    dashRef.current.active = true;
                    dashRef.current.timer = DASH_DURATION;
                    dashRef.current.cooldownTimer = DASH_COOLDOWN;
                    dashRef.current.direction.set(
                        -Math.sin(yaw) * Math.cos(pitch),
                        Math.sin(pitch),
                        -Math.cos(yaw) * Math.cos(pitch)
                    ).normalize();
                }
            }
        };
        window.addEventListener('keydown', onDashKey);
        return () => window.removeEventListener('keydown', onDashKey);
    }, [level]);

    // --- 护盾系统 ---
    const SHIELD_COOLDOWN = 10.0;
    const shieldRef = useRef({
        active: false,
        cooldownTimer: 0,
    });

    // X 键监听
    useEffect(() => {
        const onShieldKey = (e) => {
            if ((e.key === 'x' || e.key === 'X') && !e.altKey && !e.ctrlKey) {
                if (level >= 3 && !shieldRef.current.active && shieldRef.current.cooldownTimer <= 0) {
                    shieldRef.current.active = true;
                    shieldRef.current.cooldownTimer = SHIELD_COOLDOWN;
                    window.shieldActive = true;
                }
            }
        };
        window.addEventListener('keydown', onShieldKey);
        return () => window.removeEventListener('keydown', onShieldKey);
    }, [level]);

    // --- 激光系统 ---
    const LASER_COOLDOWN = 2.0;
    const laserRef = useRef({
        cooldownTimer: 0,
    });

    // C 键监听
    useEffect(() => {
        const onLaserKey = (e) => {
            if ((e.key === 'c' || e.key === 'C') && !e.altKey && !e.ctrlKey) {
                if (level >= 4 && laserRef.current.cooldownTimer <= 0) {
                    laserRef.current.cooldownTimer = LASER_COOLDOWN;
                    const yaw = camYaw.current;
                    const pitch = camPitch.current;
                    const dir = {
                        x: -Math.sin(yaw) * Math.cos(pitch),
                        y: Math.sin(pitch),
                        z: -Math.cos(yaw) * Math.cos(pitch),
                    };
                    const pos = body.current?.translation();
                    if (pos) {
                        window.laserShot = {
                            origin: { x: pos.x, y: pos.y, z: pos.z },
                            direction: dir,
                            time: Date.now(),
                        };
                    }
                }
            }
        };
        window.addEventListener('keydown', onLaserKey);
        return () => window.removeEventListener('keydown', onLaserKey);
    }, [level]);

    // Pointer Lock 鼠标控制
    useEffect(() => {
        const canvas = gl.domElement;

        const onMouseMove = (e) => {
            // 只有锁定状态下才处理
            if (document.pointerLockElement !== canvas) return;
            camYaw.current -= e.movementX * MOUSE_SENSITIVITY;
            camPitch.current -= e.movementY * MOUSE_SENSITIVITY;
            // 限制俯仰角，防止翻转（-80° ~ 80°）
            camPitch.current = MathUtils.clamp(
                camPitch.current,
                -Math.PI / 2.2,
                Math.PI / 2.2
            );
        };

        const onClick = () => {
            canvas.requestPointerLock();
        };

        canvas.addEventListener("click", onClick);
        document.addEventListener("mousemove", onMouseMove);

        return () => {
            canvas.removeEventListener("click", onClick);
            document.removeEventListener("mousemove", onMouseMove);
        };
    }, [gl]);

    // Space / Shift 垂直控制
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.code === "Space") { e.preventDefault(); keysRef.current.up = true; }
            if (e.code === "ShiftRight" || e.code === "ShiftLeft") keysRef.current.down = true;
        };
        const onKeyUp = (e) => {
            if (e.code === "Space") keysRef.current.up = false;
            if (e.code === "ShiftRight" || e.code === "ShiftLeft") keysRef.current.down = false;
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    const [, getKeys] = useKeyboardControls();

    useFrame(() => {
        if (!body.current) return;

        const { forward, backward, left, right } = getKeys();
        const gesture = window.handGesture;
        const controls = controlsRef?.current;

        // 根据摄像头 yaw + pitch 计算完整3D方向（太空中移动跟随视角）
        const yaw = camYaw.current;
        const pitch = camPitch.current;

        // 摄像头看向的3D方向（含垂直分量）
        // pitch > 0 = 抬头, camFwd.y > 0 = 向上
        const camFwd = new Vector3(
            -Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch)
        ).normalize();

        // 摄像头的右方（始终水平，不受 pitch 影响）
        const camRgt = new Vector3(
            Math.cos(yaw),
            0,
            -Math.sin(yaw)
        ).normalize();

        // 摄像头的局部上方（垂直于 forward 和 right）
        const camLocalUp = new Vector3().crossVectors(camRgt, camFwd).normalize();

        const impulse = new Vector3();

        // --- WASD / 方向键：沿摄像头实际3D方向移动 ---
        if (forward) impulse.addScaledVector(camFwd, THRUST);
        if (backward) impulse.addScaledVector(camFwd, -THRUST);
        if (left) impulse.addScaledVector(camRgt, -THRUST);
        if (right) impulse.addScaledVector(camRgt, THRUST);

        // --- Space / Shift：沿摄像头局部上方移动 ---
        if (keysRef.current.up) impulse.addScaledVector(camLocalUp, THRUST);
        if (keysRef.current.down) impulse.addScaledVector(camLocalUp, -THRUST);

        // --- 手势控制 ---
        if (gesture?.isDetected && controls) {
            const gtype = controls.gesture;
            if (gtype === "FIST") {
                // 拳头 = 刹车
                const vel = body.current.linvel();
                body.current.setLinvel(
                    { x: vel.x * BRAKE_FACTOR, y: vel.y * BRAKE_FACTOR, z: vel.z * BRAKE_FACTOR },
                    true
                );
            } else if (gtype === "OPEN_PALM" || gtype === "NONE") {
                const dx = (0.5 - gesture.x) * 2;
                const dy = (0.5 - gesture.y) * 2;
                impulse.addScaledVector(camRgt, dx * THRUST * 0.8);
                impulse.addScaledVector(camLocalUp, dy * THRUST * 0.8);
            }
        }

        // 施加推力
        if (impulse.length() > 0) {
            body.current.applyImpulse(
                { x: impulse.x * 0.016, y: impulse.y * 0.016, z: impulse.z * 0.016 },
                true
            );
        }

        // --- 冲刺逻辑 ---
        const dash = dashRef.current;
        if (dash.cooldownTimer > 0) {
            dash.cooldownTimer -= 0.016;
        }
        if (dash.active) {
            dash.timer -= 0.016;
            if (dash.timer <= 0) {
                dash.active = false;
                dash.timer = 0;
            } else {
                // 冲刺中：强制设置速度为 5 倍最大速度沿冲刺方向
                const dashSpeed = MAX_SPEED * DASH_SPEED_MULT;
                body.current.setLinvel({
                    x: dash.direction.x * dashSpeed,
                    y: dash.direction.y * dashSpeed,
                    z: dash.direction.z * dashSpeed,
                }, true);
            }
        }
        // 更新冲刺状态供UI读取
        dashStateRef.current = {
            active: dash.active,
            cooldownLeft: Math.max(dash.cooldownTimer, 0),
            ready: !dash.active && dash.cooldownTimer <= 0 && level >= 2,
        };

        // --- 护盾逻辑 ---
        const shield = shieldRef.current;
        if (shield.cooldownTimer > 0 && !shield.active) {
            shield.cooldownTimer -= 0.016;
        }
        // 检查护盾是否被碰撞打破（由 window.shieldActive 标记）
        if (shield.active && !window.shieldActive) {
            shield.active = false;
        }
        window.shieldActive = shield.active;
        shieldStateRef.current = {
            active: shield.active,
            cooldownLeft: Math.max(shield.cooldownTimer, 0),
            ready: !shield.active && shield.cooldownTimer <= 0 && level >= 3,
        };

        // --- 激光冷却 ---
        const laser = laserRef.current;
        if (laser.cooldownTimer > 0) {
            laser.cooldownTimer -= 0.016;
        }
        laserStateRef.current = {
            active: laser.cooldownTimer > LASER_COOLDOWN - 0.3, // 前0.3秒显示活跃
            cooldownLeft: Math.max(laser.cooldownTimer, 0),
            ready: laser.cooldownTimer <= 0 && level >= 4,
        };

        // 限制最大速度 (冲刺时不限制)
        if (!dash.active) {
            const vel = body.current.linvel();
            const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
            if (speed > MAX_SPEED) {
                const scale = MAX_SPEED / speed;
                body.current.setLinvel(
                    { x: vel.x * scale, y: vel.y * scale, z: vel.z * scale },
                    true
                );
            }
        }

        // --- Minecraft 风格第三人称摄像头 ---
        // 用球坐标计算摄像头相对玩家的偏移
        const pos = body.current.translation();
        const playerPos = new Vector3(pos.x, pos.y, pos.z);

        // 更新共享玩家位置（供其他组件读取）
        playerPosRef.current = { x: pos.x, y: pos.y, z: pos.z };
        cameraYawRef.current = camYaw.current;

        // 球坐标 → 直角坐标
        // pitch > 0 = 抬头 → 摄像头在玩家下方 → offset.y 为负
        const camOffset = new Vector3(
            CAM_DISTANCE * Math.sin(camYaw.current) * Math.cos(camPitch.current),
            -CAM_DISTANCE * Math.sin(camPitch.current),
            CAM_DISTANCE * Math.cos(camYaw.current) * Math.cos(camPitch.current)
        );

        const targetCamPos = playerPos.clone().add(camOffset);

        // 直接设置摄像头位置，不用 lerp，避免抖动
        camera.position.copy(targetCamPos);

        // 始终看向玩家
        const lookAt = playerPos.clone().add(new Vector3(0, CAM_HEIGHT_OFFSET, 0));
        camera.lookAt(lookAt);
    });

    return (
        <RigidBody ref={body} colliders="ball" position={[0, 0, 0]} gravityScale={0} linearDamping={0.5} userData={{ type: 'player' }}>
            <PlayerVisuals />
            {showLevelUpEffect && <LevelUpFlash />}
        </RigidBody>
    );
};