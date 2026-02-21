import React, { useEffect, useRef, useState } from 'react';
import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { useGame } from '../context/GameContext';

export const MediaPipeController = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const { controlsRef, landmarksRef } = useGame();
    const [cameraActive, setCameraActive] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!videoRef.current) return;

        const hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults((results) => {
            // Update Shared Ref for HUD
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                landmarksRef.current = results.multiHandLandmarks[0];
            } else {
                landmarksRef.current = null;
            }

            // Update Shared Ref for Physics
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                const landmarks = results.multiHandLandmarks[0];

                // Advanced Gesture Detection
                const wrist = landmarks[0];
                const fingers = [
                    { name: 'thumb', tip: 4, pip: 2 }, // Thumb uses IP/MCP/CMC, we use tip vs MCP(2)
                    { name: 'index', tip: 8, pip: 6 },
                    { name: 'middle', tip: 12, pip: 10 },
                    { name: 'ring', tip: 16, pip: 14 },
                    { name: 'pinky', tip: 20, pip: 18 }
                ];

                const dist = (i1, i2) => {
                    const p1 = landmarks[i1];
                    const p2 = landmarks[i2];
                    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
                };

                // Check if finger is curled (Tip closer to wrist than PIP is)
                // Note: For thumb, this is trickier, but often Tip closer to Base(0) than IP(3) works.
                // Let's stick to the 4 main fingers for Fist.
                const isCurled = (fingerIdx) => {
                    const f = fingers[fingerIdx];
                    return dist(f.tip, 0) < dist(f.pip, 0); // 0 is Wrist
                };

                const indexCurled = isCurled(1);
                const middleCurled = isCurled(2);
                const ringCurled = isCurled(3);
                const pinkyCurled = isCurled(4);

                // Fist: At least 3 of 4 main fingers are curled (allows for imperfect fist)
                // Strict: 4
                const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;
                const isFist = curledCount >= 3;

                // Pinch: Index Tip close to Thumb Tip
                const pinchDist = dist(4, 8);
                const isPinch = pinchDist < 0.05;

                // Open Palm: All fingers extended (Tip further from wrist than PIP)
                // Ideally checks if NOT curled
                const isOpenPalm = !indexCurled && !middleCurled && !ringCurled && !pinkyCurled && !isPinch;

                // Count extended fingers (Main 4)
                // Note: The user requested handling 4 or 5 fingers for Vertical Mode.
                // Since thumb detection is tricky, we can rely on the 4 main fingers.
                // 4 Main Fingers Extended -> count = 4 -> Trigger Vertical Mode (>=4).
                const extendedCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(c => !c).length;
                controlsRef.current.fingerCount = extendedCount;

                if (isFist) {
                    controlsRef.current.gesture = 'FIST';
                } else if (isPinch) {
                    controlsRef.current.gesture = 'PINCH';
                } else if (isOpenPalm) {
                    // Open Palm usually implies all 4/5 extended
                    controlsRef.current.gesture = 'OPEN_PALM';
                } else {
                    controlsRef.current.gesture = 'NONE';
                }

                // Position Tracking (Wrist or Center)
                // Position Tracking (Wrist or Center)
                // wrist is already defined above at line 42 as landmarks[0]
                // const wrist = results.multiHandLandmarks[0][0]; // Removed duplicate

                // Write to Global for Player.jsx (New Bridge)
                window.handGesture = {
                    x: wrist.x,
                    y: wrist.y,
                    isDetected: true,
                    isPinching: isPinch // Reuse existing pinch logic
                };

                // Legacy Ref Update (Keep for HUD if needed)
                controlsRef.current.x = (1 - wrist.x) * 2 - 1;
                controlsRef.current.y = -(wrist.y * 2 - 1);
            } else {
                window.handGesture = { x: 0.5, y: 0.5, isDetected: false, isPinching: false };

                controlsRef.current.gesture = 'NONE';
                controlsRef.current.fingerCount = 0;
            }
        });

        const camera = new Camera(videoRef.current, {
            onFrame: async () => {
                await hands.send({ image: videoRef.current });
            },
            width: 640,
            height: 480
        });

        camera.start()
            .then(() => setCameraActive(true))
            .catch((err) => setError(err));

        return () => {
            // cleanup
        }
    }, [controlsRef, landmarksRef]);

    return (
        <video
            ref={videoRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '1px',
                height: '1px',
                opacity: 0,
                zIndex: -1,
                pointerEvents: 'none'
            }}
        />
    );
};
