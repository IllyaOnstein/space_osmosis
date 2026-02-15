import React, { createContext, useContext, useState } from 'react';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

export const GameProvider = ({ children }) => {
  const [score, setScore] = useState(0);
  const [playerMass, setPlayerMass] = useState(1); // Standard mass = 1
  const [gameOver, setGameOver] = useState(false);

  const grow = (amount) => {
    setPlayerMass((m) => m + amount);
    setScore((s) => s + Math.floor(amount * 10));
  };

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
    <GameContext.Provider value={{ score, playerMass, gameOver, setGameOver, grow, reset, controlsRef, landmarksRef }}>
      {children}
    </GameContext.Provider>
  );
};
