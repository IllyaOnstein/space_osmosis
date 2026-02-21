import React, { useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const ICON_SIZE = 56;
const DASH_COOLDOWN = 5.0;
const SHIELD_COOLDOWN = 10.0;
const LASER_COOLDOWN = 2.0;

// 绘制单个技能图标
const drawSkillIcon = (ctx, cx, cy, r, state, unlocked, drawIcon, keyLabel, lockLabel, activeColor, cooldownTotal) => {
    // === 技能背景圈 ===
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = unlocked
        ? (state.active ? `rgba(${activeColor}, 0.25)` : 'rgba(0, 30, 60, 0.7)')
        : 'rgba(30, 30, 30, 0.7)';
    ctx.fill();

    // === 边框 ===
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = unlocked
        ? (state.ready ? `rgba(${activeColor}, 0.8)` : `rgba(${activeColor}, 0.3)`)
        : 'rgba(80, 80, 80, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // === 技能图标 ===
    ctx.save();
    ctx.translate(cx, cy);
    drawIcon(ctx, unlocked, state);
    ctx.restore();

    // === 冷却遮罩 ===
    if (unlocked && !state.ready && !state.active && state.cooldownLeft > 0) {
        const progress = state.cooldownLeft / cooldownTotal;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();

        ctx.font = "bold 13px 'Orbitron', monospace";
        ctx.fillStyle = 'rgba(200, 230, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(state.cooldownLeft.toFixed(1), cx, cy + 1);
    }

    // === 锁定标记 ===
    if (!unlocked) {
        ctx.font = "bold 10px 'Orbitron', sans-serif";
        ctx.fillStyle = 'rgba(150, 150, 150, 0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lockLabel, cx, cy + 15);
    }

    // === 激活时发光 ===
    if (state.active) {
        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${activeColor}, 0.4)`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgb(${activeColor})`;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    ctx.restore();

    // === 按键提示 ===
    ctx.font = "bold 10px 'Orbitron', monospace";
    ctx.fillStyle = unlocked
        ? (state.ready ? `rgba(${activeColor}, 0.8)` : `rgba(${activeColor}, 0.4)`)
        : 'rgba(80, 80, 80, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(keyLabel, cx, cy + r + 14);
};

// 闪电图标 (冲刺)
const drawLightning = (ctx, unlocked, state) => {
    ctx.beginPath();
    ctx.moveTo(-4, -12);
    ctx.lineTo(3, -3);
    ctx.lineTo(-1, -3);
    ctx.lineTo(4, 12);
    ctx.lineTo(-3, 3);
    ctx.lineTo(1, 3);
    ctx.closePath();
    ctx.fillStyle = unlocked
        ? (state.active ? '#00e5ff' : (state.ready ? '#00d4ff' : 'rgba(0, 150, 200, 0.3)'))
        : 'rgba(80, 80, 80, 0.5)';
    if (state.active) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00e5ff';
    }
    ctx.fill();
    ctx.shadowBlur = 0;
};

// 六边形图标 (护盾)
const drawShield = (ctx, unlocked, state) => {
    const s = 12;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = Math.cos(angle) * s;
        const y = Math.sin(angle) * s;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = unlocked
        ? (state.active ? '#00ffaa' : (state.ready ? '#00e0aa' : 'rgba(0, 180, 140, 0.3)'))
        : 'rgba(80, 80, 80, 0.5)';
    ctx.lineWidth = 2;
    if (state.active) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00ffaa';
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内部十字
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 6);
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.strokeStyle = unlocked
        ? (state.active ? '#00ffcc' : (state.ready ? '#00d4aa' : 'rgba(0, 150, 120, 0.3)'))
        : 'rgba(80, 80, 80, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
};

// 十字准星图标 (激光)
const drawCrosshair = (ctx, unlocked, state) => {
    const color = unlocked
        ? (state.active ? '#ff4400' : (state.ready ? '#ff6633' : 'rgba(200, 80, 40, 0.3)'))
        : 'rgba(80, 80, 80, 0.5)';

    if (state.active) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ff4400';
    }

    // 外圈
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 十字线
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(0, -5);
    ctx.moveTo(0, 5);
    ctx.lineTo(0, 13);
    ctx.moveTo(-13, 0);
    ctx.lineTo(-5, 0);
    ctx.moveTo(5, 0);
    ctx.lineTo(13, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 中心点
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;
};

export const SkillPanel = () => {
    const canvasRef = useRef(null);
    const { dashStateRef, shieldStateRef, laserStateRef, level } = useGame();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;

        const render = () => {
            const W = canvas.width;
            const H = canvas.height;
            ctx.clearRect(0, 0, W, H);

            const dashState = dashStateRef.current;
            const shieldState = shieldStateRef.current;
            const laserState = laserStateRef.current;
            const r = ICON_SIZE / 2 - 4;
            const spacing = ICON_SIZE + 12;

            // 冲刺图标
            const dashCx = ICON_SIZE / 2 + 4;
            const cy = H / 2;
            drawSkillIcon(ctx, dashCx, cy, r, dashState, level >= 2, drawLightning, 'Z', 'LV2', '0, 229, 255', DASH_COOLDOWN);

            // 护盾图标
            const shieldCx = dashCx + spacing;
            drawSkillIcon(ctx, shieldCx, cy, r, shieldState, level >= 3, drawShield, 'X', 'LV3', '0, 255, 170', SHIELD_COOLDOWN);

            // 激光图标
            const laserCx = shieldCx + spacing;
            drawSkillIcon(ctx, laserCx, cy, r, laserState, level >= 4, drawCrosshair, 'C', 'LV4', '255, 68, 0', LASER_COOLDOWN);

            animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animId);
    }, [dashStateRef, shieldStateRef, laserStateRef, level]);

    const totalWidth = ICON_SIZE * 3 + 12 * 2 + 16;

    return (
        <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
        }}>
            <div style={{
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '9px',
                color: 'rgba(0, 200, 255, 0.6)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
            }}>
                SKILLS
            </div>
            <canvas
                ref={canvasRef}
                width={totalWidth}
                height={ICON_SIZE + 20}
                style={{
                    width: `${totalWidth}px`,
                    height: `${ICON_SIZE + 20}px`,
                }}
            />
        </div>
    );
};
