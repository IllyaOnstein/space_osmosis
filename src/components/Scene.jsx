import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Stars, Sparkles } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette, HueSaturation } from '@react-three/postprocessing';
import { Player } from './Player';
import { Enemies } from './Enemies';
import { CrystalShards } from './CrystalShards';
import { HostileNPCs } from './HostileNPCs';
import { LaserBeam } from './LaserBeam';
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
    for (int i = 0; i < 4; i++) {
      value += amplitude * snoise(p * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vWorldPosition);

    // === 坐标系 ===
    // 星云用水平坐标 (赤道面 y=0)
    // 银河用垂直坐标 (YZ平面, 经过头顶)
    float nebulaLat = asin(dir.y);  // 星云：离水平面距离
    float galaxyLat = asin(dir.x);  // 银河：离YZ平面距离 -> 竖直带
    float galaxyLon = atan(dir.y, dir.z); // 银河内部经度

    // === 噪声纹理 (3次FBM调用) ===
    float n1 = fbm(dir * 4.0 + time * 0.005);
    float n2 = fbm(dir * 8.0 - time * 0.003 + 50.0);
    float n3 = fbm(dir * 6.0 + time * 0.004 + 150.0);

    // ==========================================
    // Part 1: 银河 (竖直方向，经过头顶)
    // ==========================================
    float narrowBand = exp(-pow(galaxyLat / 0.12, 2.0));
    float midBand = exp(-pow(galaxyLat / 0.25, 2.0));

    // 银河核心隆起 (在头顶方向, galaxyLon ≈ PI/2)
    float bulgeAngle = galaxyLon - 1.5708; // 核心偏向头顶(y+)
    float bulgeDist = sqrt(pow(bulgeAngle * 0.7, 2.0) + pow(galaxyLat * 2.5, 2.0));
    float bulge = exp(-bulgeDist * bulgeDist * 3.0) * 0.6;

    // 暗尘带
    float dust1 = smoothstep(0.1, 0.5, n1 * narrowBand);
    float dust2 = smoothstep(0.0, 0.4, n2 * narrowBand * 0.8);
    float dustLane = 1.0 - dust1 * dust2 * 0.7;

    // 经度密度变化
    float lonDensity = 0.6 + 0.4 * sin(galaxyLon * 2.0 + n1 * 2.0);

    // 银河颜色
    vec3 coreGold   = vec3(1.0, 0.85, 0.5);
    vec3 coreWhite  = vec3(1.0, 0.95, 0.9);
    vec3 armBlue    = vec3(0.4, 0.5, 0.9);

    vec3 galaxyColor = vec3(0.0);
    galaxyColor += mix(coreGold, coreWhite, bulge * 0.5) * bulge;
    float mainBand = narrowBand * lonDensity * dustLane;
    galaxyColor += coreGold * mainBand * 0.5;
    galaxyColor += armBlue * smoothstep(-0.1, 0.5, n1 * midBand) * midBand * 0.3;
    float emNeb = smoothstep(0.5, 0.9, n2 * n3) * narrowBand * 0.3;
    galaxyColor += vec3(0.9, 0.25, 0.4) * emNeb;
    float clusters = pow(max(n1 * 0.5 + 0.5, 0.0), 8.0) * narrowBand;
    galaxyColor += vec3(1.0, 0.95, 0.85) * clusters * 0.25;

    galaxyColor *= 0.35;

    float galaxyAlpha = clamp(narrowBand * 0.5 + midBand * 0.15 + bulge * 0.3, 0.0, 0.5);

    // ==========================================
    // Part 2: 梦幻星云 (水平方向，沿赤道面)
    // ==========================================
    float nebulaWide = exp(-pow(nebulaLat / 0.8, 2.0));
    float nebulaBand = exp(-pow(nebulaLat / 0.5, 2.0));

    vec3 deepBlue     = vec3(0.15, 0.3, 0.9);
    vec3 brightPurple = vec3(0.6, 0.15, 0.8);
    vec3 hotPink      = vec3(0.9, 0.2, 0.5);
    vec3 dreamCyan    = vec3(0.1, 0.8, 0.9);
    vec3 softGold     = vec3(0.9, 0.7, 0.2);
    vec3 lavender     = vec3(0.6, 0.4, 0.9);

    float pulse = 1.0 + 0.15 * sin(time * 0.15);
    
    float cloud1 = smoothstep(-0.1, 0.5, n1 * nebulaBand);
    float cloud2 = smoothstep(0.0, 0.6, n2 * nebulaBand * 0.9);
    float dreamCloud = smoothstep(-0.2, 0.4, n3 * nebulaWide);

    vec3 nebulaColor = vec3(0.0);
    nebulaColor += deepBlue * cloud1 * 0.6 * pulse;
    nebulaColor += brightPurple * cloud2 * 0.7 * pulse;
    nebulaColor += dreamCyan * cloud1 * cloud2 * 0.5;
    nebulaColor += hotPink * smoothstep(0.2, 0.7, n1 * n2) * nebulaBand * 0.5;
    nebulaColor += lavender * dreamCloud * 0.45;
    nebulaColor += softGold * smoothstep(0.1, 0.6, n3 * n1) * nebulaWide * 0.35;
    // 底色微光
    nebulaColor += vec3(0.05, 0.03, 0.1) * 0.3;

    float nebulaAlpha = clamp((cloud1 + cloud2 + dreamCloud * 0.5) * 0.35, 0.0, 0.6);

    // ==========================================
    // Part 3: 发光恒星 (15颗)
    // ==========================================
    vec3 starColor = vec3(0.0);

    vec3 sDirs[15];
    vec3 sTints[15];
    float sSizes[15];
    // 原有7颗
    sDirs[0] = normalize(vec3(-0.4, 0.6, 0.7));
    sDirs[1] = normalize(vec3(0.8, 0.4, 0.3));
    sDirs[2] = normalize(vec3(-0.7, -0.3, 0.5));
    sDirs[3] = normalize(vec3(0.2, 0.9, -0.3));
    sDirs[4] = normalize(vec3(-0.5, -0.6, -0.6));
    sDirs[5] = normalize(vec3(0.6, -0.2, 0.8));
    sDirs[6] = normalize(vec3(0.3, 0.15, -0.9));
    // 新增8颗
    sDirs[7]  = normalize(vec3(0.9, -0.3, -0.2));
    sDirs[8]  = normalize(vec3(-0.2, -0.8, 0.4));
    sDirs[9]  = normalize(vec3(-0.8, 0.5, -0.3));
    sDirs[10] = normalize(vec3(0.4, 0.7, 0.5));
    sDirs[11] = normalize(vec3(-0.3, 0.1, 0.95));
    sDirs[12] = normalize(vec3(0.1, -0.95, -0.2));
    sDirs[13] = normalize(vec3(-0.9, -0.1, -0.4));
    sDirs[14] = normalize(vec3(0.5, 0.5, -0.7));
    // 颜色
    sTints[0]  = vec3(1.0, 0.98, 0.95);  // 白
    sTints[1]  = vec3(0.7, 0.8, 1.0);    // 蓝白
    sTints[2]  = vec3(1.0, 0.7, 0.4);    // 橙
    sTints[3]  = vec3(1.0, 0.95, 0.8);   // 黄白
    sTints[4]  = vec3(0.6, 0.75, 1.0);   // 浅蓝
    sTints[5]  = vec3(1.0, 0.9, 0.75);   // 暖白
    sTints[6]  = vec3(1.0, 0.75, 0.3);   // 太阳橙黄
    sTints[7]  = vec3(1.0, 0.4, 0.3);    // 红巨星
    sTints[8]  = vec3(0.4, 0.6, 1.0);    // 蓝超巨星
    sTints[9]  = vec3(0.3, 1.0, 0.6);    // 翡翠绿
    sTints[10] = vec3(1.0, 0.5, 0.7);    // 玫瑰粉
    sTints[11] = vec3(0.7, 0.4, 1.0);    // 紫罗兰
    sTints[12] = vec3(1.0, 0.55, 0.15);  // 深橙
    sTints[13] = vec3(0.5, 0.85, 1.0);   // 冰蓝
    sTints[14] = vec3(1.0, 0.85, 0.4);   // 金色
    // 大小
    sSizes[0]  = 1.0;  sSizes[1]  = 0.7;  sSizes[2]  = 0.5;
    sSizes[3]  = 0.8;  sSizes[4]  = 0.4;  sSizes[5]  = 0.6;
    sSizes[6]  = 1.6;  sSizes[7]  = 0.9;  sSizes[8]  = 0.55;
    sSizes[9]  = 0.45; sSizes[10] = 0.65; sSizes[11] = 0.5;
    sSizes[12] = 0.7;  sSizes[13] = 0.35; sSizes[14] = 0.75;

    for (int si = 0; si < 15; si++) {
      float sa = acos(clamp(dot(dir, sDirs[si]), -1.0, 1.0));
      float sz = sSizes[si];
      float sc = exp(-pow(sa / (0.003 * sz), 2.0));
      float sg = exp(-pow(sa / (0.02 * sz), 2.0)) * 0.6;
      float sh = exp(-pow(sa / (0.06 * sz), 2.0)) * 0.2;
      vec3 sR = normalize(cross(sDirs[si], vec3(0.0, 1.0, 0.01)));
      vec3 sU = cross(sR, sDirs[si]);
      float lx = dot(dir - sDirs[si], sR);
      float ly = dot(dir - sDirs[si], sU);
      float sp = exp(-abs(lx) * 180.0 / sz) * exp(-abs(ly) * 6.0)
               + exp(-abs(ly) * 180.0 / sz) * exp(-abs(lx) * 6.0);
      sp *= 0.3 * sz * smoothstep(0.12, 0.0, sa);
      starColor += sTints[si] * (sc + sg) + vec3(0.5, 0.6, 1.0) * sh + sTints[si] * sp;
      // 太阳日冕
      if (si == 6) {
        starColor += vec3(1.0, 0.6, 0.2) * exp(-pow(sa / 0.15, 2.0)) * 0.15;
      }
    }

    // ==========================================
    // Part 4: 三个螺旋星系 (含大型宇宙漩涡)
    // ==========================================
    vec3 gDir1 = normalize(vec3(0.7, 0.3, -0.5));     // 小星系
    vec3 gDir2 = normalize(vec3(-0.6, 0.5, -0.4));    // 仙女座
    vec3 gDir3 = normalize(vec3(0.1, -0.7, 0.6));     // 大型宇宙漩涡

    for (int gi = 0; gi < 3; gi++) {
      vec3 gd = (gi == 0) ? gDir1 : (gi == 1) ? gDir2 : gDir3;
      float gSize = (gi == 0) ? 0.12 : (gi == 1) ? 0.35 : 0.55;
      float gScale = (gi == 0) ? 15.0 : (gi == 1) ? 6.0 : 3.5;
      float gBright = (gi == 0) ? 0.7 : (gi == 1) ? 0.4 : 0.45;
      float gTightness = (gi == 0) ? 0.4 : (gi == 1) ? 0.3 : 0.5;
      int nArms = (gi == 2) ? 3 : 2;  // 漩涡用3条臂

      float ga = acos(clamp(dot(dir, gd), -1.0, 1.0));
      float gMask = smoothstep(gSize, gSize * 0.2, ga);

      if (gMask > 0.001) {
        vec3 gR = normalize(cross(gd, vec3(0.0, 1.0, 0.01)));
        vec3 gU = cross(gR, gd);
        float gx = dot(dir - gd, gR) * gScale;
        float gy = dot(dir - gd, gU) * gScale;
        if (gi == 1) { gy *= 1.8; }

        float gRadius = sqrt(gx * gx + gy * gy);
        float gTheta = atan(gy, gx);
        float gCore = exp(-gRadius * gRadius * 3.0);
        float gNoise = n1 * 0.3 + 0.7;

        float sa1 = gTheta - gTightness * log(max(gRadius, 0.01));
        float sa2 = sa1 + 3.14159;
        float sa3 = sa1 + 2.0944;
        // 漩涡用更窄更锐利的臂 (*4.0) 让螺旋更明显
        float armSharp = (gi == 2) ? 4.0 : 2.0;
        float arm1 = exp(-pow(sin(sa1) * gRadius, 2.0) * armSharp);
        float arm2 = exp(-pow(sin(sa2) * gRadius, 2.0) * armSharp);
        float arm3 = (gi == 2) ? exp(-pow(sin(sa3) * gRadius, 2.0) * armSharp) : 0.0;
        float armFalloff = (gi == 2) ? exp(-gRadius * 0.3) : exp(-gRadius * 0.5);
        float arms = (arm1 + arm2 + arm3) * smoothstep(0.0, 0.2, gRadius) * armFalloff;

        if (gi == 0) {
          // 小星系
          starColor += (vec3(1.0, 0.9, 0.6) * gCore + vec3(0.6, 0.7, 1.0) * arms * exp(-gRadius * 0.5))
                     * gMask * gBright * gNoise;
        } else if (gi == 1) {
          // 仙女座
          vec3 gcCol = vec3(0.7, 0.5, 0.9) * gCore;
          vec3 gaCol = vec3(0.3, 0.7, 0.9) * arm1 * exp(-gRadius * 0.4)
                     + vec3(0.9, 0.4, 0.6) * arm2 * exp(-gRadius * 0.4)
                     + vec3(0.5, 0.4, 0.9) * arms * exp(-gRadius * 0.6) * 0.3;
          starColor += (gcCol + gaCol) * gMask * gBright * gNoise;
          starColor += vec3(0.4, 0.3, 0.7) * exp(-gRadius * 0.3) * gMask * 0.15;
        } else {
          // 大型梦幻宇宙漩涡 (3臂，超大，彩色)
          vec3 gcCol = vec3(0.8, 0.4, 1.0) * gCore * 1.5;  // 明亮紫核心
          // 每条臂用饱和梦幻色
          vec3 gaCol = vec3(0.1, 1.0, 0.9) * arm1 * exp(-gRadius * 0.25) * 1.2 // 霓虹青
                     + vec3(1.0, 0.2, 0.8) * arm2 * exp(-gRadius * 0.25) * 1.2 // 霓虹洋红
                     + vec3(1.0, 0.9, 0.2) * arm3 * exp(-gRadius * 0.25) * 1.0; // 明亮金
          // 臂间彩色弥散（基于角度产生渐变色彩）
          float interArm = (1.0 - max(max(arm1, arm2), arm3)) * armFalloff * 0.3;
          vec3 interColor = vec3(
            0.5 + 0.5 * sin(gTheta * 1.5),
            0.5 + 0.5 * sin(gTheta * 1.5 + 2.094),
            0.5 + 0.5 * sin(gTheta * 1.5 + 4.189)
          );
          vec3 diffuse = interColor * interArm + vec3(0.3, 0.15, 0.5) * exp(-gRadius * 0.2) * 0.25;
          // 外围梦幻光晕
          float vortexHalo = exp(-gRadius * 0.12) * gMask * 0.15;
          starColor += (gcCol + gaCol + diffuse) * gMask * gBright * gNoise;
          starColor += vec3(0.5, 0.3, 0.9) * vortexHalo;
        }
      }
    }

    // ==========================================
    // Part 4b: 主银河系漩涡 (Prominent Barred Spiral)
    // ==========================================
    {
      vec3 mgDir = normalize(vec3(0.0, 0.85, -0.5));
      float mgSize = 1.2;    // 超大视角范围
      float mgScale = 1.5;   // 低缩放 = 展开更多细节
      float mgBright = 0.12;  // 降低基础亮度防过曝

      float mga = acos(clamp(dot(dir, mgDir), -1.0, 1.0));
      float mgMask = smoothstep(mgSize, mgSize * 0.08, mga);

      if (mgMask > 0.001) {
        vec3 mgR = normalize(cross(mgDir, vec3(0.0, 0.0, 1.0)));
        vec3 mgU = cross(mgR, mgDir);
        float mgx = dot(dir - mgDir, mgR) * mgScale;
        float mgy = dot(dir - mgDir, mgU) * mgScale;

        float mgRadius = sqrt(mgx * mgx + mgy * mgy);
        float mgTheta = atan(mgy, mgx);

        // 多层噪声细节
        float detail1 = snoise(vec3(mgx * 8.0, mgy * 8.0, 0.5)) * 0.5 + 0.5;
        float detail2 = snoise(vec3(mgx * 16.0, mgy * 16.0, 1.0)) * 0.5 + 0.5;
        float fineDetail = detail1 * 0.7 + detail2 * 0.3;

        // 核心：紧凑明亮 + 棒状结构 (收缩核心范围以防过曝)
        float mgCore = exp(-mgRadius * mgRadius * 12.0);
        float barAngle = atan(mgy, mgx);
        float bar = exp(-pow(sin(barAngle) * mgRadius * 3.0, 2.0)) * exp(-mgRadius * 3.5) * 0.6;

        // 4条螺旋臂 — 更紧密的缠绕
        float tightness = 0.55;
        float s1 = mgTheta - tightness * log(max(mgRadius, 0.005));
        float s2 = s1 + 1.5708;
        float s3 = s1 + 3.14159;
        float s4 = s1 + 4.71239;
        float sharpness = 5.0;  // 更锐利的臂
        float a1 = exp(-pow(sin(s1) * mgRadius, 2.0) * sharpness);
        float a2 = exp(-pow(sin(s2) * mgRadius, 2.0) * sharpness);
        float a3 = exp(-pow(sin(s3) * mgRadius, 2.0) * sharpness);
        float a4 = exp(-pow(sin(s4) * mgRadius, 2.0) * sharpness);
        float armFalloff = exp(-mgRadius * 0.28);
        float allArms = (a1 + a2 + a3 + a4) * smoothstep(0.0, 0.12, mgRadius) * armFalloff;

        // 强尘埃带：臂间区域压暗，增加对比度
        float maxArm = max(max(a1, a2), max(a3, a4));
        float dustLane = 1.0 - (1.0 - maxArm) * 0.7 * exp(-mgRadius * 0.4);

        // 核心：金黄暖色 (降低整体倍率)
        vec3 coreColor = vec3(1.0, 0.88, 0.5) * mgCore * 0.8;
        vec3 barColor = vec3(1.0, 0.82, 0.5) * bar * 0.4;

        // 螺旋臂：带噪声纹理，降低颜色倍率防溢出
        vec3 armColor = vec3(0.5, 0.7, 1.0)  * a1 * exp(-mgRadius * 0.25) * (0.4 + fineDetail * 0.2)
                      + vec3(0.7, 0.65, 1.0) * a2 * exp(-mgRadius * 0.25) * (0.3 + fineDetail * 0.2)
                      + vec3(0.4, 0.75, 1.0) * a3 * exp(-mgRadius * 0.25) * (0.4 + fineDetail * 0.2)
                      + vec3(0.8, 0.55, 0.9) * a4 * exp(-mgRadius * 0.25) * (0.3 + fineDetail * 0.15);

        // HII发射星云区（臂上的粉红色亮点）
        float hiiNoise = pow(snoise(vec3(mgx * 12.0, mgy * 12.0, 2.0)) * 0.5 + 0.5, 4.0);
        vec3 hiiColor = vec3(1.0, 0.3, 0.5) * hiiNoise * allArms * 0.2;

        // 星团细节：臂上的微小亮点
        float clusterNoise = pow(snoise(vec3(mgx * 20.0, mgy * 20.0, 3.0)) * 0.5 + 0.5, 5.0);
        vec3 clusterColor = vec3(1.0, 0.95, 0.9) * clusterNoise * allArms * 0.2;

        // 弥漫光晕（星系外围柔光）
        float halo = exp(-mgRadius * 0.12) * mgMask * 0.03;
        vec3 haloColor = vec3(0.3, 0.35, 0.5) * halo;

        // 臂间弥散（让臂不是孤立线条，有弥漫背景）
        float diffuse = exp(-mgRadius * 0.2) * 0.15;
        vec3 diffuseColor = vec3(0.4, 0.42, 0.6) * diffuse * fineDetail * 0.5;

        // 合成 (引入局部色调映射防过曝)
        float noiseVar = n1 * 0.2 + 0.8;
        vec3 combinedGalaxy = coreColor + barColor + armColor + hiiColor + clusterColor + diffuseColor;
        // Soft-clip 防止中心纯白
        combinedGalaxy = combinedGalaxy / (1.0 + combinedGalaxy * 0.3);
        
        starColor += combinedGalaxy * mgMask * mgBright * noiseVar * dustLane;
        starColor += haloColor;
      }
    }

    // ==========================================
    // Part 4c: 随机彩色漩涡星云 (Random Colorful Nebulas)
    // ==========================================
    for (int ri = 0; ri < 3; ri++) {
      // 这里的种子与之前流星的不同
      float rSeed = float(ri) * 314.159 + 42.0;
      
      // 随机生成方向向量 (通过球面坐标)
      float rTheta = fract(sin(rSeed * 12.34) * 5678.9) * 6.28318;
      float rPhi = acos(2.0 * fract(sin(rSeed * 56.78) * 1234.5) - 1.0);
      vec3 rnDir = vec3(sin(rPhi) * cos(rTheta), sin(rPhi) * sin(rTheta), cos(rPhi));
      
      // 随机尺寸(比较大)和参数
      float rnSize = 0.4 + fract(sin(rSeed * 78.9) * 23.4) * 0.4; 
      float rnScale = 2.0 + fract(sin(rSeed * 11.1) * 34.5) * 2.5;
      float rnBright = 0.2 + fract(sin(rSeed * 22.2) * 45.6) * 0.2;
      
      // 随机主色调 (HSV 思想转 RGB)
      float hue = fract(sin(rSeed * 33.3) * 67.8);
      vec3 baseColor = clamp(abs(fract(hue + vec3(3.0, 2.0, 1.0) / 3.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
      baseColor = mix(vec3(1.0), baseColor, 0.8); // 降低一点颜色饱和度防刺眼
      
      float rna = acos(clamp(dot(dir, rnDir), -1.0, 1.0));
      float rnMask = smoothstep(rnSize, rnSize * 0.1, rna);

      if (rnMask > 0.001) {
        // 构建局部坐标系 (稍微加点随机倾角)
        vec3 rnUp = normalize(vec3(fract(sin(rSeed) * 99.0), fract(cos(rSeed) * 88.0), fract(sin(rSeed*2.0) * 77.0)));
        if (abs(dot(rnDir, rnUp)) > 0.99) rnUp = vec3(0.0, 1.0, 0.0);
        vec3 rnR = normalize(cross(rnDir, rnUp));
        vec3 rnU = cross(rnR, rnDir);
        
        float rnx = dot(dir - rnDir, rnR) * rnScale;
        float rny = dot(dir - rnDir, rnU) * rnScale;
        
        // 星云常常是椭圆的
        float stretch = 1.0 + fract(sin(rSeed * 44.4) * 55.5) * 1.5;
        rny *= stretch;
        
        float rnRadius = sqrt(rnx * rnx + rny * rny);
        float rnTheta = atan(rny, rnx);
        
        // 核心
        float rnCore = exp(-rnRadius * rnRadius * 2.0);
        
        // 梦幻双螺旋气体臂
        float tight = 0.6 + fract(sin(rSeed * 55.5) * 66.6) * 0.6;
        float s1 = rnTheta - tight * log(max(rnRadius, 0.01));
        float s2 = s1 + 3.14159;
        float sharp = 1.5 + fract(sin(rSeed * 66.6) * 77.7) * 2.0; // 星云臂通常比星系臂柔和
        
        float a1 = exp(-pow(sin(s1) * rnRadius, 2.0) * sharp);
        float a2 = exp(-pow(sin(s2) * rnRadius, 2.0) * sharp);
        float arms = (a1 + a2) * exp(-rnRadius * 0.4);
        
        // 增加气体云的噪声扰动，使其看起来像星云而不是规则螺旋
        float gasNoise = snoise(vec3(rnx * 3.0, rny * 3.0, rSeed)) * 0.5 + 0.5;
        arms *= gasNoise;
        
        vec3 outColor = baseColor * (rnCore * 0.8 + arms * 1.2);
        
        // 边缘气体辉光
        float halo = exp(-rnRadius * 0.3) * rnMask * 0.2;
        vec3 haloColor = mix(baseColor, vec3(1.0), 0.3) * halo;
        
        starColor += outColor * rnMask * rnBright + haloColor;
      }
    }

    // ==========================================
    // Part 4d: 极光 (Aurora Borealis) - 头顶区域
    // ==========================================
    // 只在上方天空显示极光，越靠近头顶越明显
    float auroraMask = smoothstep(0.3, 0.9, dir.y);
    if (auroraMask > 0.001) {
      // 展开为极坐标风格的UV，制造类似从极点发散的带状效果
      vec2 aUv = vec2(atan(dir.z, dir.x), dir.y);
      float aTime = time * 0.15;
      
      // 第一个噪声流：主要的形状扭曲 (Domain warping)
      float warp = snoise(vec3(aUv.x * 2.0, aUv.y * 3.0, aTime)) * 0.5 + 0.5;
      
      // 第二个噪声流：细致的极光带
      float aNoise1 = snoise(vec3(aUv.x * 4.0 + warp * 2.0, aUv.y * 6.0, aTime * 1.5)) * 0.5 + 0.5;
      float aNoise2 = snoise(vec3(aUv.x * 8.0 - warp * 1.5, aUv.y * 4.0, aTime * 2.0)) * 0.5 + 0.5;
      
      // 组合多层噪声形成幕帘效果
      float curtain = pow(aNoise1 * aNoise2, 1.5) * 3.0;
      
      // 限制成明显的条带分布，而不是充满整个天空
      float band = sin(aUv.x * 3.0 + warp * 4.0) * 0.5 + 0.5;
      band = pow(band, 2.0);
      curtain *= band;
      
      // 高度上的渐隐 (下部暗，上部亮，然后消失)
      float yFade = smoothstep(0.3, 0.6, dir.y) * smoothstep(1.0, 0.8, dir.y);
      curtain *= yFade;
      
      // 颜色动态变化 (紫/粉 -> 绿/青)
      vec3 colA = vec3(0.1, 0.9, 0.5); // 霓虹绿
      vec3 colB = vec3(0.2, 0.5, 1.0); // 霓虹蓝
      vec3 colC = vec3(0.8, 0.2, 0.9); // 霓虹紫
      
      // 基于角度和时间混合颜色
      vec3 aColor = mix(colA, colB, sin(aUv.x * 2.0 + aTime) * 0.5 + 0.5);
      aColor = mix(aColor, colC, cos(warp * 3.0 + aTime * 0.5) * 0.5 + 0.5);
      
      // 增加底部的高亮粉/紫过渡 (常见于极光底部)
      float bottomFringe = smoothstep(0.5, 0.3, dir.y) * curtain;
      aColor = mix(aColor, vec3(1.0, 0.2, 0.6), bottomFringe * 0.8);

      // 整体提亮，但防止过曝
      vec3 finalAurora = aColor * curtain * 0.6;
      finalAurora = finalAurora / (1.0 + finalAurora * 0.5);
      
      starColor += finalAurora * auroraMask;
    }

    // ==========================================
    // Part 4e: 天文摄影后期细节 (Astrophotography Details)
    // ==========================================
    
    // 1. 动态脉冲星 / 类星体 (Pulsating Quasar) - 减少到2颗并随机分布
    for(int qi = 0; qi < 2; qi++) {
      float qSeed = float(qi) * 114.514;
      float qTheta = fract(sin(qSeed * 1.5) * 111.1) * 6.28318;
      float qPhi = acos(2.0 * fract(sin(qSeed * 2.5) * 222.2) - 1.0);
      vec3 qDir = vec3(sin(qPhi) * cos(qTheta), sin(qPhi) * sin(qTheta), cos(qPhi));
      
      float qa = acos(clamp(dot(dir, qDir), -1.0, 1.0));
      if (qa < 0.2) {
        // 极速脉冲频率
        float pulse = sin(time * (10.0 + float(qi) * 5.0)) * 0.5 + 0.5;
        float blink = pow(sin(time * (1.5 + float(qi) * 0.7)), 8.0); // 偶尔的超亮爆闪
        float qCore = exp(-qa * qa * 4000.0);    // 极小极亮的点
        float qHalo = exp(-qa * 15.0) * 0.1;
        
        // 喷流 (Jets)
        vec3 qR = normalize(cross(qDir, vec3(0.0, 1.0, 0.0)));
        if (length(cross(qDir, vec3(0.0, 1.0, 0.0))) < 0.1) qR = normalize(cross(qDir, vec3(1.0, 0.0, 0.0)));
        vec3 qU = cross(qR, qDir);
        float qx = dot(dir - qDir, qR);
        float qy = dot(dir - qDir, qU);
        
        // 旋转随机角度
        float qAngle = fract(sin(qSeed * 3.5) * 333.3) * 6.28318;
        float qC = cos(qAngle), qS = sin(qAngle);
        float qrx = qx * qC - qy * qS;
        float qry = qx * qS + qy * qC;

        // 上下喷流
        float jet = exp(-abs(qrx) * 150.0) * exp(-abs(qry) * 6.0) * 0.3;
        
        vec3 colBase = (qi == 0) ? vec3(0.4, 0.9, 1.0) : vec3(0.9, 0.3, 1.0); // 一蓝一紫
        vec3 qColor = colBase * (qCore * (1.0 + pulse * 2.0 + blink * 5.0)) + 
                      vec3(0.2, 0.5, 1.0) * qHalo * (1.0 + pulse) + 
                      colBase * jet * (0.5 + pulse * 0.5);
                      
        starColor += qColor;
      }
    }

    // 1b. M87 风格超大质量黑洞照片 (Event Horizon Telescope Image)
    {
      // 放置在一个随机偏上的位置
      vec3 bhDir = normalize(vec3(-0.4, 0.6, 0.5));
      float bhSize = 0.15; // 相对较小但很明显的圆环
      float bha = acos(clamp(dot(dir, bhDir), -1.0, 1.0));
      
      if (bha < bhSize) {
        vec3 bhR = normalize(cross(bhDir, vec3(0.0, 1.0, 0.0)));
        vec3 bhU = cross(bhR, bhDir);
        float bhx = dot(dir - bhDir, bhR);
        float bhy = dot(dir - bhDir, bhU);
        
        float bhRadius = sqrt(bhx * bhx + bhy * bhy);
        float bhTheta = atan(bhy, bhx);
        
        // 黑洞参数
        float eventHorizonInfo = 0.015; // 视界半径 (纯黑区域)
        float photonRing = 0.02;        // 光子环半径 (最亮区域)
        float diskSize = 0.05;          // 吸积盘渐隐范围
        
        // 多普勒束流效应：一侧极亮，另一侧暗
        float dopplerBeaming = sin(bhTheta - 0.5) * 0.5 + 0.5; // 不对称亮度
        dopplerBeaming = mix(0.2, 1.0, dopplerBeaming);
        
        // 圆环形状
        float ringProfile = exp(-pow((bhRadius - photonRing) / 0.005, 2.0));
        
        // 外围吸积盘
        float accretionDisk = exp(-pow(max(0.0, bhRadius - photonRing) / 0.015, 1.5)) * 0.4;
        
        // 著名的橙红色调
        vec3 bhColorCore = vec3(1.0, 0.8, 0.5); // 内部最亮处略偏黄白
        vec3 bhColorDisk = vec3(1.0, 0.4, 0.0); // 外部标志性的火橙色
        vec3 bhColorHalo = vec3(0.8, 0.1, 0.0); // 边缘暗红
        
        // 噪声纹理让环看起来有气体流动感
        float bhNoise = snoise(vec3(bhx * 80.0, bhy * 80.0, time * 0.2)) * 0.5 + 0.5;
        
        // 合成亮度
        float totalBrightness = (ringProfile * 1.5 + accretionDisk * bhNoise) * dopplerBeaming;
        
        // 根据亮度分配颜色
        vec3 finalBhColor = mix(bhColorHalo, bhColorDisk, smoothstep(0.0, 0.4, totalBrightness));
        finalBhColor = mix(finalBhColor, bhColorCore, smoothstep(0.6, 1.5, totalBrightness));
        
        vec3 result = finalBhColor * totalBrightness;
        
        // 绝对黑洞中心 (吞噬一切光线)
        float shadowCore = smoothstep(eventHorizonInfo - 0.002, eventHorizonInfo + 0.002, bhRadius);
        
        // 遮罩叠加，黑洞区域会切断背景星光（真实剪影）
        // 这里只是加亮，但在中心强制用 shadowCore 降低所有亮度
        starColor = starColor * shadowCore + result * shadowCore;
      }
    }

    // 2. JWST 风格衍射十字星芒 (6-point Diffraction Spikes)
    // 我们只给天空中少数几颗“极亮星”添加这种光学衍射效果
    for(int spi = 0; spi < 6; spi++) {
      float spSeed = float(spi) * 88.88;
      float spTheta = fract(sin(spSeed * 1.1) * 111.1) * 6.28318;
      float spPhi = acos(2.0 * fract(sin(spSeed * 2.2) * 222.2) - 1.0);
      vec3 spDir = vec3(sin(spPhi) * cos(spTheta), sin(spPhi) * sin(spTheta), cos(spPhi));
      
      float spa = acos(clamp(dot(dir, spDir), -1.0, 1.0));
      if (spa < 0.15) {
        vec3 spR = normalize(cross(spDir, vec3(0.0, 1.0, 0.0)));
        if (length(cross(spDir, vec3(0.0, 1.0, 0.0))) < 0.1) spR = normalize(cross(spDir, vec3(1.0, 0.0, 0.0)));
        vec3 spU = cross(spR, spDir);
        float spx = dot(dir - spDir, spR);
        float spy = dot(dir - spDir, spU);
        
        // 旋转 6 角星芒 (James Webb style)
        float angle = 0.5; // 倾斜角
        float c = cos(angle), s = sin(angle);
        float rx = spx * c - spy * s;
        float ry = spx * s + spy * c;
        
        // 3条交叉线形成6角
        float line1 = exp(-abs(rx) * 600.0) * exp(-abs(ry) * 15.0);
        
        float r60x = rx * 0.5 - ry * 0.866; // cos(60), sin(60)
        float r60y = rx * 0.866 + ry * 0.5;
        float line2 = exp(-abs(r60x) * 600.0) * exp(-abs(r60y) * 15.0);
        
        float r120x = rx * -0.5 - ry * 0.866;
        float r120y = rx * 0.866 + ry * -0.5;
        float line3 = exp(-abs(r120x) * 600.0) * exp(-abs(r120y) * 15.0);
        
        float spikeIntensity = line1 + line2 + line3;
        float twinkle = sin(time * 3.0 + spSeed) * 0.3 + 0.7; // 闪烁
        
        vec3 spColor = vec3(1.0, 0.9, 0.8) * spikeIntensity * 0.6 * twinkle;
        // 核心亮点
        spColor += vec3(1.0) * exp(-spa * spa * 10000.0) * twinkle;
        
        starColor += spColor;
      }
    }

    // 3. 深空场背景星系 (Deep Field faint galaxies)
    // 在极远处添加一些红色/橙色的微小光斑，模拟宇宙早期的遥远星系
    float dfNoise = snoise(dir * 80.0);
    float dfNoise2 = snoise(dir * 120.0 + 50.0);
    if (dfNoise > 0.85 && dfNoise2 > 0.6) {
      float dfIntensity = (dfNoise - 0.85) * 6.0; // 0 to ~1
      float dfShape = snoise(dir * 200.0);        // 让它们是不规则的
      vec3 dfColor = mix(vec3(1.0, 0.3, 0.1), vec3(0.8, 0.5, 0.2), dfShape * 0.5 + 0.5);
      starColor += dfColor * dfIntensity * 0.15;
    }

    // ==========================================
    // Part 5: 流星动画 (纯 Shader 实现)
    // ==========================================
    vec3 meteorTotal = vec3(0.0);

    for (int mi = 0; mi < 14; mi++) {
      // 每颗流星的伪随机参数
      float mSeed = float(mi) * 137.0;
      float mCycle = 3.0 + fract(sin(mSeed * 91.3) * 43758.5453) * 6.0;   // 周期 3-9秒
      float mDuration = 0.6 + fract(sin(mSeed * 73.1) * 23421.63) * 0.9;  // 持续 0.6-1.5秒 (150%)
      float mPhase = fract(sin(mSeed * 17.7) * 65432.1);                   // 相位偏移

      float cycleTime = mod(time + mPhase * mCycle, mCycle);
      float mT = cycleTime / mDuration;  // 流星进度 0..1+

      if (mT > 0.0 && mT < 1.0) {
        // 流星起点方向 (全球随机分布)
        float mTheta = fract(sin(mSeed * 43.7) * 12345.6) * 6.2832;
        float mPhi = acos(1.0 - 2.0 * fract(sin(mSeed * 61.3) * 54321.0)); // 均匀球面分布
        vec3 mStart = normalize(vec3(
          sin(mPhi) * cos(mTheta),
          cos(mPhi),
          sin(mPhi) * sin(mTheta)
        ));

        // 流星运动方向 (斜向下)
        vec3 mDir = normalize(vec3(
          fract(sin(mSeed * 31.1) * 76543.2) - 0.5,
          fract(sin(mSeed * 53.3) * 34567.8) - 0.5,
          fract(sin(mSeed * 79.9) * 98765.4) - 0.5
        ));

        // 当前流星位置: 起点 + 方向 * 进度
        float mTrailLen = 0.15 + fract(sin(mSeed * 23.3) * 11111.1) * 0.15;  // 拖尾弧度长度
        vec3 mHead = normalize(mStart + mDir * mT * 0.5);
        vec3 mTail = normalize(mStart + mDir * max(mT - mTrailLen, 0.0) * 0.5);

        // 计算像素到流星线段的距离
        // 投影 dir 到 mTail->mHead 线段上
        vec3 mAxis = mHead - mTail;
        float mAxisLen = length(mAxis);
        if (mAxisLen > 0.001) {
          vec3 mAxisN = mAxis / mAxisLen;
          vec3 toPixel = dir - mTail;
          float proj = clamp(dot(toPixel, mAxisN) / mAxisLen, 0.0, 1.0);
          vec3 closest = mTail + mAxis * proj;
          float dist = acos(clamp(dot(dir, normalize(closest)), -1.0, 1.0));

          // 宽度: 头部宽 (0.005)，尾部窄 (接近 0)，明显的渐变细化
          float taper = 1.0 - proj * 0.9;  // 头部 1.0 -> 尾部 0.1
          float width = 0.005 * taper;
          float brightness = exp(-pow(dist / max(width, 0.0001), 2.0));

          // 头部亮，尾部暗
          float headBright = 1.0 - proj * 0.8;
          // 淡入淡出
          float fadeIn = smoothstep(0.0, 0.1, mT);
          float fadeOut = smoothstep(1.0, 0.7, mT);

          float finalBright = brightness * headBright * fadeIn * fadeOut;

          // 颜色: 头部白，尾部带彩
          vec3 mHeadColor = vec3(1.0, 0.98, 0.95);
          vec3 mTailColor = vec3(
            0.3 + 0.7 * fract(sin(mSeed * 11.1) * 22222.2),
            0.3 + 0.7 * fract(sin(mSeed * 33.3) * 33333.3),
            0.5 + 0.5 * fract(sin(mSeed * 55.5) * 44444.4)
          );
          vec3 mColor = mix(mTailColor, mHeadColor, (1.0 - proj) * brightness);

          // 外层柔光晕
          float halo = exp(-pow(dist / (width * 5.0), 2.0)) * 0.15 * fadeIn * fadeOut;
          meteorTotal += mColor * finalBright + vec3(0.5, 0.7, 1.0) * halo;
        }
      }
    }

    // ==========================================
    // 合成：银河 + 星云 + 恒星 + 星系 + 流星 -> 不透明输出
    // ==========================================
    vec3 spaceBlack = vec3(0.02, 0.015, 0.04);
    vec3 color = spaceBlack;
    color = mix(color, nebulaColor + color, nebulaAlpha);
    color = mix(color, galaxyColor + color, galaxyAlpha);
    color += starColor;
    color += meteorTotal;
    color = clamp(color, 0.0, 1.0);

    gl_FragColor = vec4(color, 1.0);
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
    <mesh renderOrder={-100}>
      <sphereGeometry args={[190, 32, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
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
      <Stars radius={200} depth={80} count={6000} factor={6} saturation={0.5} fade speed={1.2} />
      <Sparkles count={300} scale={[250, 250, 250]} size={10} speed={0.4} noise={0.2} color="#00f3ff" opacity={0.5} />
      <Sparkles count={150} scale={[180, 180, 180]} size={16} speed={0.6} noise={0.3} color="#bf00ff" opacity={0.6} />
      {/* 极大的魔法星尘粒子 */}
      <Sparkles count={40} scale={[200, 200, 200]} size={45} speed={0.3} noise={0.1} color="#ffaa00" opacity={0.4} />
      <Sparkles count={30} scale={[220, 220, 220]} size={50} speed={0.2} noise={0.1} color="#ff00ff" opacity={0.3} />

    </group>
  );
};

export const Scene = () => {
  return (
    <>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.2} />
      <FollowingSkybox />

      <Physics gravity={[0, 0, 0]} interpolate>
        <Player />
        <Enemies />
        <CrystalShards />
        <HostileNPCs />
      </Physics>

      <LaserBeam />

      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.25} luminanceSmoothing={0.7} intensity={2.2} />
        <Vignette eskil={false} offset={0.1} darkness={0.8} />
      </EffectComposer>
    </>
  );
};
