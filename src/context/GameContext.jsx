import React, { createContext, useContext, useState, useMemo } from 'react';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [score, setScore] = useState(0);
  const [playerMass, setPlayerMass] = useState(1);
  const [gameOver, setGameOver] = useState(false);

  // 升级系统：等级阈值 (0, 5, 15, 30, 50)
  const MAX_LEVEL = 5;
  const LEVEL_THRESHOLDS = [0, 5, 15, 30, 50];

  const level = useMemo(() => {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (score >= LEVEL_THRESHOLDS[i]) return i + 1;
    }
    return 1;
  }, [score]);

  // 距离下一级还需要多少分
  const nextLevelScore = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level] : null;

  const grow = (amount) => {
    setPlayerMass((m) => m + amount);
    setScore((s) => s + Math.floor(amount * 10));
  };

  const addScore = (points) => {
    setScore((s) => s + points);
  };

  const forceLevelUp = () => {
    if (level < MAX_LEVEL) {
      const nextThreshold = LEVEL_THRESHOLDS[level];
      setScore(nextThreshold);
    }
  };

  // 等级速度系数：1级=0.2x, 每级+0.2x
  const SPEED_MULTIPLIERS = [0.2, 0.4, 0.6, 0.8, 1.0];
  const speedMultiplier = SPEED_MULTIPLIERS[level - 1];

  const reset = () => {
    setScore(0);
    setPlayerMass(1);
    setGameOver(false);
  };

  // Shared ref for high-frequency control data (Gesture, Position)
  const controlsRef = React.useRef({
    gesture: 'NONE', // 'NONE', 'OPEN_PALM', 'PINCH'
    x: 0,
    y: 0
  });

  // Shared ref for raw landmarks (for HUD)
  const landmarksRef = React.useRef(null);

  return (
    <GameContext.Provider value={{ score, playerMass, gameOver, setGameOver, grow, addScore, forceLevelUp, reset, controlsRef, landmarksRef, level, nextLevelScore, MAX_LEVEL, speedMultiplier }}>
      {children}
    </GameContext.Provider>
  );
};
