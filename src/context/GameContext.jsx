import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';

const GameContext = createContext();

export const useGame = () => useContext(GameContext);

// 等级配置: [经验阈值, 最大耐久度, 最大护甲值]
const LEVEL_CONFIG = [
  { threshold: 0, maxDurability: 5, maxArmor: 0 },  // L1
  { threshold: 5, maxDurability: 15, maxArmor: 0 },  // L2
  { threshold: 15, maxDurability: 40, maxArmor: 10 },  // L3
  { threshold: 30, maxDurability: 70, maxArmor: 30 },  // L4
  { threshold: 50, maxDurability: 100, maxArmor: 50 },  // L5
];

const MAX_LEVEL = 5;
const ARMOR_REGEN_RATE = 1; // 每秒恢复1护甲值

export const GameProvider = ({ children }) => {
  const [experience, setExperience] = useState(0);
  const [durability, setDurability] = useState(LEVEL_CONFIG[0].maxDurability);
  const [armor, setArmor] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [playerMass, setPlayerMass] = useState(1);

  // 等级计算
  const level = useMemo(() => {
    for (let i = LEVEL_CONFIG.length - 1; i >= 0; i--) {
      if (experience >= LEVEL_CONFIG[i].threshold) return i + 1;
    }
    return 1;
  }, [experience]);

  const config = LEVEL_CONFIG[level - 1];
  const maxDurability = config.maxDurability;
  const maxArmor = config.maxArmor;
  const nextLevelExp = level < MAX_LEVEL ? LEVEL_CONFIG[level].threshold : null;

  // 升级时恢复耐久度和护甲
  const prevLevelRef = React.useRef(level);
  useEffect(() => {
    if (level > prevLevelRef.current) {
      const newConfig = LEVEL_CONFIG[level - 1];
      setDurability(newConfig.maxDurability);
      setArmor(newConfig.maxArmor);
    }
    prevLevelRef.current = level;
  }, [level]);

  // 护甲随时间恢复
  useEffect(() => {
    if (gameOver) return;
    const timer = setInterval(() => {
      setArmor((a) => {
        const max = LEVEL_CONFIG[prevLevelRef.current - 1].maxArmor;
        if (max <= 0) return 0;
        return Math.min(a + ARMOR_REGEN_RATE, max);
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameOver]);

  // 获取经验 (原来的 grow / addScore)
  const addExperience = useCallback((points) => {
    setExperience((e) => e + points);
  }, []);

  const grow = useCallback((amount) => {
    setPlayerMass((m) => m + amount);
    setExperience((e) => e + Math.floor(amount * 10));
  }, []);

  // 受伤：先扣护甲，再扣耐久
  const takeDamage = useCallback((amount) => {
    setArmor((a) => {
      const armorAbsorb = Math.min(a, amount);
      const remaining = amount - armorAbsorb;
      if (remaining > 0) {
        setDurability((d) => {
          const newD = d - remaining;
          if (newD <= 0) {
            setGameOver(true);
            return 0;
          }
          return newD;
        });
      }
      return a - armorAbsorb;
    });
  }, []);

  // 强制升级 (debug)
  const forceLevelUp = useCallback(() => {
    if (level < MAX_LEVEL) {
      setExperience(LEVEL_CONFIG[level].threshold);
    }
  }, [level]);

  // 强制降级 (debug Alt+D)
  const forceLevelDown = useCallback(() => {
    if (level > 1) {
      setExperience(LEVEL_CONFIG[level - 2].threshold);
      const newConfig = LEVEL_CONFIG[level - 2];
      setDurability(newConfig.maxDurability);
      setArmor(newConfig.maxArmor);
    }
  }, [level]);

  // 等级速度系数：1级=0.2x, 每级+0.2x
  const SPEED_MULTIPLIERS = [0.2, 0.4, 0.6, 0.8, 1.0];
  const speedMultiplier = SPEED_MULTIPLIERS[level - 1];

  const reset = useCallback(() => {
    setExperience(0);
    setPlayerMass(1);
    setDurability(LEVEL_CONFIG[0].maxDurability);
    setArmor(0);
    setGameOver(false);
  }, []);

  // Shared refs
  const controlsRef = React.useRef({ gesture: 'NONE', x: 0, y: 0 });
  const landmarksRef = React.useRef(null);
  const playerPosRef = React.useRef({ x: 0, y: 0, z: 0 });
  const crystalPosRef = React.useRef([]);
  const cameraYawRef = React.useRef(Math.PI);
  const dashStateRef = React.useRef({ active: false, cooldownLeft: 0, ready: true });
  const shieldStateRef = React.useRef({ active: false, cooldownLeft: 0, ready: true });
  const laserStateRef = React.useRef({ active: false, cooldownLeft: 0, ready: true });
  const rageStateRef = React.useRef({ active: false, cooldownLeft: 0, ready: true });
  const ultimateStateRef = React.useRef({ charge: 0, active: false, ready: false });

  return (
    <GameContext.Provider value={{
      // 经验系统
      experience, addExperience, grow,
      // 耐久度/护甲
      durability, maxDurability, armor, maxArmor, takeDamage,
      // 等级
      level, nextLevelExp, MAX_LEVEL, speedMultiplier,
      // 游戏状态
      playerMass, gameOver, setGameOver, reset, forceLevelUp,
      // 共享Refs
      controlsRef, landmarksRef, playerPosRef, crystalPosRef, cameraYawRef,
      dashStateRef, shieldStateRef, laserStateRef, rageStateRef, ultimateStateRef,
      // 兼容旧代码
      score: experience, addScore: addExperience, nextLevelScore: nextLevelExp,
      forceLevelDown,
    }}>
      {children}
    </GameContext.Provider>
  );
};
