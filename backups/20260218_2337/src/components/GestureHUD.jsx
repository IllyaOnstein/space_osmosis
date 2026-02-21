import React, { useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
    [0, 13], [13, 14], [14, 15], [15, 16],// Ring
    [0, 17], [17, 18], [18, 19], [19, 20],// Pinky
    [5, 9], [9, 13], [13, 17]             // Palm
];

export const GestureHUD = () => {
    const canvasRef = useRef(null);
    const { landmarksRef } = useGame();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const render = () => {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const landmarks = landmarksRef.current;

            if (landmarks) {
                // Sci-Fi Style Config
                ctx.strokeStyle = '#00f3ff'; // Neon Cyan
                ctx.fillStyle = '#00f3ff';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00f3ff';

                const width = canvas.width;
                const height = canvas.height;

                // Draw Connections (Lines)
                ctx.beginPath();
                for (const [start, end] of HAND_CONNECTIONS) {
                    const p1 = landmarks[start];
                    const p2 = landmarks[end];

                    // Flip X for mirror effect
                    const x1 = (1 - p1.x) * width;
                    const y1 = p1.y * height;
                    const x2 = (1 - p2.x) * width;
                    const y2 = p2.y * height;

                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                }
                ctx.stroke();

                // Draw Landmarks (Dots)
                for (const point of landmarks) {
                    const x = (1 - point.x) * width;
                    const y = point.y * height;

                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [landmarksRef]);

    // CSS handled inline or via class? Step 2 mentions Visual Style (CSS).
    // I will use inline styles for positioning and class for glass effect to be consistent but can also put it here.

    return (
        <div className="gesture-hud-container cyber-hud" style={{
            position: 'relative',
            width: '320px',
            height: '240px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '15px',
                fontFamily: "'Orbitron', sans-serif",
                fontSize: '12px',
                color: '#00f3ff',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                textShadow: '0 0 5px #00f3ff',
                animation: 'pulse 2s infinite'
            }}>
                SYSTEM ONLINE // SENSORS ACTIVE
            </div>

            {/* Decor Elements */}
            <div style={{ position: 'absolute', top: '10px', right: '15px', color: 'rgba(0, 243, 255, 0.5)', fontSize: '10px' }}>010110</div>
            <div style={{ position: 'absolute', bottom: '10px', left: '15px', color: 'rgba(0, 243, 255, 0.5)', fontSize: '10px' }}>SYS.RDY</div>

            <canvas
                ref={canvasRef}
                width={320}
                height={240}
                style={{ width: '100%', height: '100%', opacity: 0.9, position: 'absolute', top: 0, left: 0, zIndex: 10 }}
            />
        </div>
    );
};
