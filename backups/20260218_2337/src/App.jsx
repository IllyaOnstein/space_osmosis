import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls, Loader } from '@react-three/drei';
import { GameProvider, useGame } from './context/GameContext';
import { Scene } from './components/Scene';
import { MediaPipeController } from './components/MediaPipeController';
import { GestureHUD } from './components/GestureHUD';
import { CrystalRadar } from './components/CrystalRadar';
import { SkillPanel } from './components/SkillPanel';
import './App.css';

const UI = () => {
  const { score, playerMass, gameOver, reset, level, nextLevelScore, MAX_LEVEL, speedMultiplier } = useGame();

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
            SCORE: {score.toFixed(1)}
          </p>
          <p style={{ fontSize: '1.2rem', margin: '0 0 20px 0', opacity: 0.7 }}>
            BIOMASS: {playerMass.toFixed(1)}
          </p>
          <button onClick={reset}>REBOOT SYSTEM</button>
        </div>
      </div>
    );
  }

  // 升级进度百分比
  const LEVEL_THRESHOLDS = [0, 5, 15, 30, 50];
  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const progress = nextLevelScore
    ? ((score - currentThreshold) / (nextLevelScore - currentThreshold)) * 100
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
        {nextLevelScore && (
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
              {score.toFixed(1)} / {nextLevelScore}
            </div>
          </div>
        )}
        {!nextLevelScore && (
          <div style={{ fontSize: '0.8rem', color: '#ff00ff', marginBottom: '5px' }}>★ MAX LEVEL ★</div>
        )}
        <p>SCORE: {score.toFixed(1)}</p>
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
          <MediaPipeController />
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '20px',
            zIndex: 99,
          }}>
            <CrystalRadar />
            <GestureHUD />
            <SkillPanel />
          </div>
          <Loader />
        </KeyboardControls>
      </GameProvider>
    </div>
  );
}

export default App;
