import React from 'react';
import { useGame } from '../context/GameContext';

export const DurabilityBar = () => {
    const { durability, maxDurability, armor, maxArmor } = useGame();

    const durPercent = maxDurability > 0 ? (durability / maxDurability) * 100 : 0;
    const armorPercent = maxArmor > 0 ? (armor / maxArmor) * 100 : 0;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            width: '200px',
            fontFamily: "'Orbitron', monospace",
        }}>
            {/* 耐久度条 */}
            <div>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    color: durPercent <= 20 ? '#ff4444' : 'rgba(0, 229, 255, 0.7)',
                    marginBottom: '2px',
                    letterSpacing: '1px',
                }}>
                    <span>HP</span>
                    <span>{Math.ceil(durability)} / {maxDurability}</span>
                </div>
                <div style={{
                    width: '100%',
                    height: '8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    border: durPercent <= 20
                        ? '1px solid rgba(255, 60, 60, 0.6)'
                        : '1px solid rgba(0, 229, 255, 0.2)',
                }}>
                    <div style={{
                        width: `${durPercent}%`,
                        height: '100%',
                        background: durPercent <= 20
                            ? 'linear-gradient(90deg, #ff2222, #ff6644)'
                            : 'linear-gradient(90deg, #00c8ff, #00ff88)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease, background 0.3s ease',
                        boxShadow: durPercent <= 20
                            ? '0 0 8px rgba(255, 60, 60, 0.5)'
                            : '0 0 6px rgba(0, 200, 255, 0.3)',
                    }} />
                </div>
            </div>

            {/* 护甲条 (仅3级以上显示) */}
            {maxArmor > 0 && (
                <div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '9px',
                        color: 'rgba(255, 200, 50, 0.7)',
                        marginBottom: '2px',
                        letterSpacing: '1px',
                    }}>
                        <span>ARMOR</span>
                        <span>{Math.ceil(armor)} / {maxArmor}</span>
                    </div>
                    <div style={{
                        width: '100%',
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 200, 50, 0.2)',
                    }}>
                        <div style={{
                            width: `${armorPercent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #ffaa00, #ffdd44)',
                            borderRadius: '3px',
                            transition: 'width 0.5s ease',
                            boxShadow: '0 0 4px rgba(255, 200, 50, 0.3)',
                        }} />
                    </div>
                </div>
            )}
        </div>
    );
};
