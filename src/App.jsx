import React, { Suspense, useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls, Loader } from '@react-three/drei';
import { GameProvider, useGame } from './context/GameContext';
import { Scene } from './components/Scene';
import { MediaPipeController } from './components/MediaPipeController';
import { GestureHUD } from './components/GestureHUD';
import { CrystalRadar } from './components/CrystalRadar';
import { SkillPanel } from './components/SkillPanel';
import { DurabilityBar } from './components/DurabilityBar';
import './App.css';

const CROSSHAIR_TIMEOUT = 5000; // 5秒无射击后隐藏

const Crosshair = () => {
  const [visible, setVisible] = useState(false);
  const lastShotRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const shotTime = window.laserShot?.time || 0;
      const now = Date.now();

      if (shotTime !== lastShotRef.current && shotTime > 0) {
        lastShotRef.current = shotTime;
        setVisible(true);
      }

      if (visible && now - lastShotRef.current > CROSSHAIR_TIMEOUT) {
        setVisible(false);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [visible]);

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 50,
      opacity: visible ? 1 : 0,
      scale: visible ? '1' : '0.5',
      transition: 'opacity 0.25s ease, scale 0.25s ease',
    }}>
      {/* 横线 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '24px',
        height: '2px',
        background: 'rgba(0, 229, 255, 0.7)',
        boxShadow: '0 0 4px rgba(0, 229, 255, 0.5)',
      }} />
      {/* 竖线 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '2px',
        height: '24px',
        background: 'rgba(0, 229, 255, 0.7)',
        boxShadow: '0 0 4px rgba(0, 229, 255, 0.5)',
      }} />
      {/* 中心点 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '4px',
        height: '4px',
        borderRadius: '50%',
        background: 'rgba(0, 229, 255, 0.9)',
        boxShadow: '0 0 6px rgba(0, 229, 255, 0.8)',
      }} />
    </div>
  );
};

// 耐久度低于20%时屏幕边缘红光警告
const LowDurabilityWarning = () => {
  const { durability, maxDurability } = useGame();
  const ratio = maxDurability > 0 ? durability / maxDurability : 1;
  const show = ratio <= 0.2 && ratio > 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      zIndex: 90,
      opacity: show ? 1 : 0,
      transition: 'opacity 0.3s ease',
      boxShadow: 'inset 0 0 80px 30px rgba(255, 20, 20, 0.5)',
      animation: show ? 'durabilityPulse 1.2s ease-in-out infinite' : 'none',
    }} />
  );
};

// 黑洞引力波特效
const GravityWaveOverlay = () => {
  const { ultimateStateRef } = useGame();
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const check = setInterval(() => {
      setActive(!!ultimateStateRef.current?.active);
    }, 50);
    return () => clearInterval(check);
  }, [ultimateStateRef]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      zIndex: 88,
      opacity: active ? 1 : 0,
      transition: 'opacity 0.5s ease',
      overflow: 'hidden',
    }}>
      {/* 引力波纹 */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '200vmax', height: '200vmax',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: `2px solid rgba(150, 60, 255, ${0.15 - i * 0.04})`,
          boxShadow: `inset 0 0 60px rgba(100, 30, 200, ${0.1 - i * 0.03}), 0 0 40px rgba(150, 60, 255, ${0.08 - i * 0.02})`,
          animation: active ? `gravityWave ${2 + i * 0.5}s ease-in-out infinite ${i * 0.3}s` : 'none',
        }} />
      ))}
      {/* 中心暗化 */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: '40vmin', height: '40vmin',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,0,0,0.4) 0%, transparent 70%)',
        boxShadow: '0 0 120px 60px rgba(80, 20, 160, 0.15)',
      }} />
    </div>
  );
};

// 金色无敌护盾特效
const GoldenShieldOverlay = () => {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const check = setInterval(() => {
      setActive(!!window.goldenShieldActive);
    }, 50);
    return () => clearInterval(check);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      zIndex: 89,
      opacity: active ? 1 : 0,
      transition: 'opacity 0.5s ease',
      boxShadow: 'inset 0 0 100px 40px rgba(255, 200, 50, 0.25)',
      animation: active ? 'goldenPulse 2s ease-in-out infinite' : 'none',
    }} />
  );
};

const UI = () => {
  const { experience, durability, maxDurability, gameOver, reset, level, nextLevelExp, MAX_LEVEL, speedMultiplier } = useGame();

  const LEVEL_COLORS = ['#00f3ff', '#00ff88', '#ffcc00', '#ff6600', '#ff00ff'];

  if (gameOver) {
    return (
      <div className="ui-overlay game-over">
        <h1>SYSTEM FAILURE</h1>
        <div className="cyber-hud" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 10px 0', color: LEVEL_COLORS[level - 1] }}>
            LEVEL {level}
          </p>
          <p style={{ fontSize: '1.5rem', margin: '0 0 10px 0', color: 'var(--neon-cyan)' }}>
            EXP: {experience.toFixed(1)}
          </p>
          <p style={{ fontSize: '1.2rem', margin: '0 0 20px 0', opacity: 0.7 }}>
            DURABILITY: {Math.ceil(durability)} / {maxDurability}
          </p>
          <button onClick={reset}>REBOOT SYSTEM</button>
        </div>
      </div>
    );
  }

  // 升级进度百分比
  const LEVEL_THRESHOLDS = [0, 5, 15, 30, 50];
  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const progress = nextLevelExp
    ? ((experience - currentThreshold) / (nextLevelExp - currentThreshold)) * 100
    : 100;

  return (
    <div className="ui-overlay hud">
      <div className="score-panel cyber-hud">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
          <span style={{ fontSize: '1.4rem', color: LEVEL_COLORS[level - 1], fontWeight: 'bold' }}>
            LV.{level}
          </span>
          <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>/ {MAX_LEVEL}</span>
        </div>
        {nextLevelExp && (
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px', overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: `linear-gradient(90deg, ${LEVEL_COLORS[level - 1]}, ${LEVEL_COLORS[level] || '#fff'})`,
                borderRadius: '3px', transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '2px' }}>
              {experience.toFixed(1)} / {nextLevelExp}
            </div>
          </div>
        )}
        {!nextLevelExp && (
          <div style={{ fontSize: '0.8rem', color: '#ff00ff', marginBottom: '5px' }}>★ MAX LEVEL ★</div>
        )}
        <p>EXP: {experience.toFixed(1)}</p>
        <p style={{ fontSize: '0.9rem', color: LEVEL_COLORS[level - 1] }}>
          SPEED: {(speedMultiplier * 100).toFixed(0)}%
        </p>
      </div>
      <div className="instructions cyber-hud">
        <p>WASD / PALM :: THRUST</p>
        <p>FIST :: BRAKE</p>
        <p>PINCH :: GRAVITY WELL</p>
        <div style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--neon-purple)' }}>
          WARNING: AVOID LARGE MASSES
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="app-container">
      <GameProvider>
        <KeyboardControls
          map={[
            { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
            { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
            { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
            { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
            { name: 'shift', keys: ['Shift'] },
          ]}
        >
          <Canvas camera={{ position: [0, 20, 20], fov: 60 }} dpr={[1, 2]}>
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
          <UI />
          <Crosshair />
          <LowDurabilityWarning />
          <GravityWaveOverlay />
          <GoldenShieldOverlay />
          <MediaPipeController />
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 99,
          }}>
            <DurabilityBar />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
              <CrystalRadar />
              <GestureHUD />
              <SkillPanel />
            </div>
          </div>
          <Loader />
        </KeyboardControls>
      </GameProvider>
    </div>
  );
}

export default App;
