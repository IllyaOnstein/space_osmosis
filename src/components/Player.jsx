import React, { useRef } from "react";
import { RigidBody } from "@react-three/rapier";
import { Trail } from "@react-three/drei";

export const Player = () => {
    const body = useRef();

    return (
        // 这里设置 gravityScale={0} 是为了防止飞船一开始就掉进虚空导致黑屏
        <RigidBody ref={body} colliders="ball" position={[0, 0, 0]} gravityScale={0}>
            {/* 拖尾特效，保留你的酷炫感 */}
            <Trail width={6} length={8} color={"#00f3ff"} attenuation={(t) => t * t}>
                <mesh castShadow receiveShadow>
                    <sphereGeometry args={[0.5, 32, 32]} />
                    <meshStandardMaterial
                        color="#00f3ff"
                        emissive="#00f3ff"
                        emissiveIntensity={3}
                    />
                </mesh>
            </Trail>
        </RigidBody>
    );
};