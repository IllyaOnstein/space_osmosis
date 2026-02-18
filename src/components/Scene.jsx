import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import { Player } from './Player';
import { Enemies } from './Enemies';
import { CrystalShards } from './CrystalShards';
import * as THREE from 'three';

// --- 程序化星云 Shader ---
const nebulaVertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragmentShader = `
  varying vec3 vWorldPosition;
  uniform float time;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      value += amplitude * snoise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);

    // 多层噪声
    float n1 = fbm(dir * 3.0 + time * 0.008);
    float n2 = fbm(dir * 5.0 - time * 0.005 + 100.0);
    float n3 = fbm(dir * 7.0 + time * 0.006 + 200.0);
    float n4 = fbm(dir * 2.0 + time * 0.003 + 300.0); // 大尺度梦幻云

    // 银河带状结构
    float band = exp(-pow(dir.y * 2.0, 2.0));
    // 更宽的弥散带
    float wideBand = exp(-pow(dir.y * 1.2, 2.0));

    // 梦幻星云颜色（更亮更鲜艳）
    vec3 deepBlue    = vec3(0.15, 0.3, 0.9);     // 亮蓝
    vec3 brightPurple = vec3(0.6, 0.15, 0.8);    // 亮紫
    vec3 hotPink      = vec3(0.9, 0.2, 0.5);     // 粉红
    vec3 dreamCyan    = vec3(0.1, 0.8, 0.9);     // 梦幻青
    vec3 softGold     = vec3(0.9, 0.7, 0.2);     // 柔金
    vec3 lavender     = vec3(0.6, 0.4, 0.9);     // 薰衣草紫

    // 各层星云
    float cloud1 = smoothstep(-0.1, 0.5, n1 * band);
    float cloud2 = smoothstep(0.0, 0.6, n2 * band * 0.9);
    float cloud3 = smoothstep(0.1, 0.7, n3) * 0.4;
    float dreamCloud = smoothstep(-0.2, 0.4, n4 * wideBand); // 大范围梦幻云

    vec3 color = vec3(0.0);

    // 主星云带（银河核心）
    color += deepBlue * cloud1 * 0.6;
    color += brightPurple * cloud2 * 0.7;
    color += dreamCyan * cloud1 * cloud2 * 0.5;
    color += hotPink * smoothstep(0.2, 0.7, n1 * n2) * band * 0.5;

    // 梦幻弥散层（更大范围，更亮）
    color += lavender * dreamCloud * 0.4;
    color += softGold * smoothstep(0.1, 0.6, n3 * n4) * wideBand * 0.3;

    // 高光亮核
    float core = smoothstep(0.4, 0.9, n1 * n2 * band);
    color += vec3(1.0, 0.9, 0.95) * core * 0.4; // 亮白核心

    // 全天底色微光
    color += vec3(0.03, 0.02, 0.06) * (cloud3 + 0.15);

    // 透明度
    float alpha = clamp((cloud1 + cloud2 + dreamCloud * 0.5) * 0.45, 0.0, 0.7);

    gl_FragColor = vec4(color, alpha);
  }
`;

// 星云天球
const NebulaSphere = () => {
    const matRef = useRef();
    const uniforms = useMemo(() => ({ time: { value: 0.0 } }), []);

    useFrame((state, delta) => {
        if (matRef.current) matRef.current.uniforms.time.value += delta;
    });

    return (
        <mesh>
            <sphereGeometry args={[190, 64, 64]} />
            <shaderMaterial
                ref={matRef}
                vertexShader={nebulaVertexShader}
                fragmentShader={nebulaFragmentShader}
                uniforms={uniforms}
                side={THREE.BackSide}
                transparent={true}
                depthWrite={false}
            />
        </mesh>
    );
};

// --- 流星系统 ---
const METEOR_COUNT = 6;
const METEOR_DIST = 150; // 流星出现距离

const ShootingStars = () => {
    const meteorsRef = useRef([]);
    const groupRef = useRef();
    const { camera } = useThree();

    // 初始化流星数据
    const meteors = useMemo(() => {
        return new Array(METEOR_COUNT).fill(0).map(() => ({
            mesh: null,
            trail: null,
            // 随机生命周期偏移，避免所有流星同时出现
            timer: Math.random() * 15,
            lifetime: 0.6 + Math.random() * 0.8,  // 持续 0.6-1.4 秒
            delay: 3 + Math.random() * 12,          // 间隔 3-15 秒
            active: false,
            progress: 0,
            startPos: new THREE.Vector3(),
            direction: new THREE.Vector3(),
            speed: 80 + Math.random() * 120,        // 速度 80-200
            length: 3 + Math.random() * 5,           // 拖尾长度
        }));
    }, []);

    useFrame((state, delta) => {
        if (!groupRef.current) return;
        // 跟随摄像头
        groupRef.current.position.copy(camera.position);

        meteors.forEach((m, i) => {
            const mesh = meteorsRef.current[i];
            if (!mesh) return;

            m.timer += delta;

            if (!m.active) {
                // 等待下一次出现
                if (m.timer >= m.delay) {
                    m.active = true;
                    m.progress = 0;
                    m.timer = 0;
                    m.delay = 3 + Math.random() * 12;
                    m.lifetime = 0.6 + Math.random() * 0.8;
                    m.speed = 80 + Math.random() * 120;

                    // 随机方向（从天空上半球某处划过）
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.random() * Math.PI * 0.4 + 0.2; // 偏上方
                    m.startPos.set(
                        METEOR_DIST * Math.sin(phi) * Math.cos(theta),
                        METEOR_DIST * Math.cos(phi),
                        METEOR_DIST * Math.sin(phi) * Math.sin(theta)
                    );

                    // 斜向下的方向
                    m.direction.set(
                        (Math.random() - 0.5) * 2,
                        -0.5 - Math.random() * 0.5,
                        (Math.random() - 0.5) * 2
                    ).normalize();
                }
                mesh.visible = false;
                return;
            }

            // 动画进行中
            m.progress += delta;
            const t = m.progress / m.lifetime;

            if (t >= 1.0) {
                // 流星结束
                m.active = false;
                mesh.visible = false;
                return;
            }

            mesh.visible = true;

            // 当前位置
            const dist = m.speed * m.progress;
            mesh.position.copy(m.startPos).addScaledVector(m.direction, dist);

            // 朝向运动方向
            mesh.lookAt(
                mesh.position.x + m.direction.x,
                mesh.position.y + m.direction.y,
                mesh.position.z + m.direction.z
            );

            // 透明度：淡入淡出
            const fadeIn = Math.min(t * 5, 1);
            const fadeOut = Math.max(1 - (t - 0.6) / 0.4, 0);
            const opacity = fadeIn * fadeOut;
            mesh.children[0].material.opacity = opacity;

            // 缩放：拖尾拉长效果
            mesh.scale.set(0.08, 0.08, m.length * (0.5 + t * 0.5));
        });
    });

    return (
        <group ref={groupRef}>
            {meteors.map((_, i) => (
                <group
                    key={`meteor-${i}`}
                    ref={(el) => { meteorsRef.current[i] = el; }}
                    visible={false}
                >
                    <mesh>
                        <cylinderGeometry args={[0, 1, 1, 4]} />
                        <meshBasicMaterial
                            color="#ffffff"
                            transparent
                            opacity={1}
                            toneMapped={false}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

// 跟随摄像头的天空盒
const FollowingSkybox = () => {
    const groupRef = useRef();
    const { camera } = useThree();

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.position.copy(camera.position);
        }
    });

    return (
        <group ref={groupRef}>
            <NebulaSphere />
            <Stars radius={200} depth={80} count={8000} factor={4} saturation={0} fade speed={0.5} />
            <Sparkles count={400} scale={[250, 250, 250]} size={8} speed={0} noise={0} color="#00f3ff" opacity={0.4} />
            <Sparkles count={200} scale={[280, 280, 280]} size={14} speed={0} noise={0} color="#bf00ff" opacity={0.5} />
            <Sparkles count={80} scale={[220, 220, 220]} size={22} speed={0} noise={0} color="#ffffff" opacity={0.4} />
        </group>
    );
};

export const Scene = () => {
    return (
        <>
            <color attach="background" args={['#050505']} />
            <ambientLight intensity={0.2} />
            <FollowingSkybox />
            <ShootingStars />

            <Physics gravity={[0, 0, 0]}>
                <Player />
                <Enemies />
                <CrystalShards />
            </Physics>

            <EffectComposer>
                <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.5} />
                <Noise opacity={0.05} />
                <Vignette eskil={false} offset={0.1} darkness={1.1} />
            </EffectComposer>
        </>
    );
};
