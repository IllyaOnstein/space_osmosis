import React, { useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const RADAR_SIZE = 200;
const RADAR_RANGE = 200; // 雷达探测范围 (世界单位)
const SWEEP_SPEED = 0.025; // 扫描速度 (弧度/帧)
const FADE_DURATION = 4.0; // 水晶点扫描后可见持续时间 (秒)

export const CrystalRadar = () => {
    const canvasRef = useRef(null);
    const { playerPosRef, crystalPosRef, cameraYawRef } = useGame();
    const sweepAngleRef = useRef(0);
    // 每个水晶上次被扫描到的时间戳
    const lastSweptRef = useRef(new Map());
    const timeRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let lastTime = performance.now();

        const render = (now) => {
            const dt = (now - lastTime) / 1000;
            lastTime = now;
            timeRef.current += dt;

            const W = canvas.width;
            const H = canvas.height;
            const cx = W / 2;
            const cy = H / 2;
            const radius = W / 2 - 10;

            ctx.clearRect(0, 0, W, H);

            // === 背景圆 ===
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 10, 20, 0.85)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.clip();

            // === 距离环 ===
            for (let i = 1; i <= 4; i++) {
                ctx.beginPath();
                ctx.arc(cx, cy, (radius / 4) * i, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 243, 255, ${0.08 + i * 0.03})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }

            // === 十字线 ===
            ctx.beginPath();
            ctx.moveTo(cx - radius, cy);
            ctx.lineTo(cx + radius, cy);
            ctx.moveTo(cx, cy - radius);
            ctx.lineTo(cx, cy + radius);
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.12)';
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // === 扫描线动画 ===
            const prevSweep = sweepAngleRef.current;
            sweepAngleRef.current += SWEEP_SPEED;
            const sweep = sweepAngleRef.current;

            // 扫描尾迹 (多层扇形渐变)
            for (let t = 0; t < 8; t++) {
                const tailAngle = sweep - (t + 1) * 0.12;
                const tailAlpha = 0.12 * (1 - t / 8);
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, radius, tailAngle, tailAngle + 0.12, false);
                ctx.closePath();
                ctx.fillStyle = `rgba(0, 255, 100, ${tailAlpha})`;
                ctx.fill();
            }

            // 扫描主线
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(
                cx + Math.cos(sweep) * radius,
                cy + Math.sin(sweep) * radius
            );
            ctx.strokeStyle = 'rgba(0, 255, 100, 0.8)';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00ff64';
            ctx.stroke();
            ctx.shadowBlur = 0;

            // === 水晶碎片 (只在扫描经过后显示，逐渐消失) ===
            const pp = playerPosRef.current;
            const crystals = crystalPosRef?.current;
            const currentTime = timeRef.current;

            if (pp && crystals && crystals.length > 0) {
                for (let i = 0; i < crystals.length; i++) {
                    const c = crystals[i];
                    if (!c) continue;

                    // 水平面 (XZ) 上的相对位置
                    const rawDx = c.x - pp.x;
                    const rawDz = c.z - pp.z;
                    const dist = Math.sqrt(rawDx * rawDx + rawDz * rawDz);
                    if (dist > RADAR_RANGE) continue;

                    // 用摄像头 yaw 旋转坐标，使雷达上方 = 摄像头前方
                    const yaw = cameraYawRef?.current || 0;
                    const cosY = Math.cos(-yaw + Math.PI / 2);
                    const sinY = Math.sin(-yaw + Math.PI / 2);
                    const dx = rawDx * cosY - rawDz * sinY;
                    const dz = rawDx * sinY + rawDz * cosY;

                    // 映射到雷达坐标 (上方=前方)
                    const rx = cx + (dx / RADAR_RANGE) * radius;
                    const ry = cy - (dz / RADAR_RANGE) * radius;

                    // 水晶在雷达上的角度 (用旋转后的坐标)
                    const angle = Math.atan2(-dz, dx);

                    // 检查扫描线是否刚刚经过这个水晶
                    let normalSweep = sweep % (Math.PI * 2);
                    if (normalSweep < 0) normalSweep += Math.PI * 2;
                    let normalAngle = angle % (Math.PI * 2);
                    if (normalAngle < 0) normalAngle += Math.PI * 2;

                    // 判断这一帧扫描线是否越过了水晶角度
                    let prevNorm = prevSweep % (Math.PI * 2);
                    if (prevNorm < 0) prevNorm += Math.PI * 2;

                    const swept = (prevNorm <= normalAngle && normalSweep > normalAngle) ||
                        (prevNorm > normalSweep && (normalAngle >= prevNorm || normalAngle <= normalSweep));

                    if (swept) {
                        lastSweptRef.current.set(i, currentTime);
                    }

                    // 计算上次被扫描后的衰减
                    const lastSwept = lastSweptRef.current.get(i);
                    if (lastSwept === undefined) continue;
                    const elapsed = currentTime - lastSwept;
                    if (elapsed > FADE_DURATION) continue;

                    const fade = 1.0 - (elapsed / FADE_DURATION);




                    // 距离越近点越大
                    const dotSize = 2 + 2 * (1 - dist / RADAR_RANGE);

                    // 刚被扫到时明亮，之后逐渐暗淡
                    const brightness = fade;

                    ctx.beginPath();
                    ctx.arc(rx, ry, dotSize * (0.5 + fade * 0.5), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(0, 255, 80, ${brightness * 0.9})`;
                    ctx.shadowBlur = 4 + fade * 8;
                    ctx.shadowColor = '#00ff50';
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    // 刚扫到的瞬间闪光环
                    if (elapsed < 0.3) {
                        const flash = 1.0 - elapsed / 0.3;
                        ctx.beginPath();
                        ctx.arc(rx, ry, dotSize * 2 * flash + 3, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(0, 255, 100, ${flash * 0.5})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }

            // === 玩家小球 (中心锁定) ===
            // 外层光晕
            const playerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
            playerGlow.addColorStop(0, 'rgba(0, 243, 255, 0.6)');
            playerGlow.addColorStop(0.5, 'rgba(0, 243, 255, 0.15)');
            playerGlow.addColorStop(1, 'rgba(0, 243, 255, 0.0)');
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fillStyle = playerGlow;
            ctx.fill();

            // 实心小球
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#00f3ff';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f3ff';
            ctx.fill();
            ctx.shadowBlur = 0;

            // 小球高光
            ctx.beginPath();
            ctx.arc(cx - 1, cy - 1, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fill();

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [playerPosRef, crystalPosRef]);

    return (
        <div style={{ position: 'relative', paddingTop: '24px', paddingBottom: '20px' }}>
            <div style={{
                position: 'absolute',
                top: '0px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '10px',
                color: '#00ff64',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                textShadow: '0 0 5px #00ff64',
                whiteSpace: 'nowrap',
            }}>
                CRYSTAL RADAR
            </div>

            <div style={{
                position: 'absolute',
                bottom: '0px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '9px',
                color: 'rgba(0, 255, 100, 0.5)',
                whiteSpace: 'nowrap',
            }}>
                RANGE: {RADAR_RANGE}m
            </div>

            <div className="radar-container cyber-hud" style={{
                position: 'relative',
                width: `${RADAR_SIZE}px`,
                height: `${RADAR_SIZE}px`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                overflow: 'hidden',
            }}>
                <canvas
                    ref={canvasRef}
                    width={RADAR_SIZE}
                    height={RADAR_SIZE}
                    style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                />
            </div>
        </div>
    );
};
