import React from 'react';
import { Physics } from '@react-three/rapier';
import { Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { Player } from './Player';
import { Enemies } from './Enemies';

export const Scene = () => {
    return (
        <>
            <color attach="background" args={['#050505']} />
            <ambientLight intensity={0.2} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            {/* Layer A: Neon Cyan (Base Theme) - Ultra-Low Density */}
            <Sparkles
                count={200}
                scale={[100, 100, 100]}
                size={10}
                speed={0.4}
                noise={0.2}
                color="#00f3ff"
                opacity={0.4}
            />

            {/* Layer B: Neon Purple (Contrast) - Large Chunks */}
            <Sparkles
                count={100}
                scale={[120, 120, 120]}
                size={15}
                speed={0.3}
                noise={0.3}
                color="#bf00ff"
                opacity={0.6}
            />

            {/* Layer C: Stardust White - Massive Beacons */}
            <Sparkles
                count={40}
                scale={[90, 90, 90]}
                size={25}
                speed={0.2}
                noise={0.1}
                color="#ffffff"
                opacity={0.4}
            />

            {/* --- CRYSTAL SHARDS (Debug/Simple Implementation) --- */}
            {[...Array(100)].map((_, i) => (
                <mesh
                    key={`shard-${i}`}
                    position={[
                        (Math.random() - 0.5) * 200, // Spread wide X
                        (Math.random() - 0.5) * 100, // Spread wide Y
                        (Math.random() - 0.5) * 100  // Spread wide Z
                    ]}
                    rotation={[Math.random() * Math.PI, Math.random() * Math.PI, 0]}
                    scale={[2, 2, 2]} // Make them LARGE and visible
                >
                    <octahedronGeometry args={[1, 0]} /> {/* Diamond shape */}
                    <meshStandardMaterial
                        color="lime"       // Bright DEBUG Green
                        emissive="lime"    // Glows in the dark
                        emissiveIntensity={2}
                        wireframe={true}   // Wireframe looks cool & techy
                        transparent={true}
                        opacity={0.6}
                    />
                </mesh>
            ))}

            <Physics gravity={[0, 0, 0]}>
                <Player />
                <Enemies />
            </Physics>



            <EffectComposer>
                <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.5} />
                <Noise opacity={0.05} />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
        </>
    );
};
