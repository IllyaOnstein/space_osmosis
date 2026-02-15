import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { KeyboardControls, Loader } from '@react-three/drei';
import { GameProvider, useGame } from './context/GameContext';
import { Scene } from './components/Scene';
import { MediaPipeController } from './components/MediaPipeController';
import { GestureHUD } from './components/GestureHUD';
import './App.css';

const UI = () => {
  const { score, playerMass, gameOver, reset } = useGame();

  if (gameOver) {
    return (
      <div className="ui-overlay game-over">
        <h1>SYSTEM FAILURE</h1>
        <div className="cyber-hud" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 20px 0', color: 'var(--neon-cyan)' }}>
            BIOMASS: {playerMass.toFixed(1)}
          </p>
          <button onClick={reset}>REBOOT SYSTEM</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-overlay hud">
      <div className="score-panel cyber-hud">
        <h2>MASS: {playerMass.toFixed(1)}</h2>
        <p>SCORE: {score}</p>
        <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '5px' }}>
          SECTOR: {Math.floor(score / 100)}A
        </div>
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
          <GestureHUD />
          <Loader />
        </KeyboardControls>
      </GameProvider>
    </div>
  );
}

export default App;
