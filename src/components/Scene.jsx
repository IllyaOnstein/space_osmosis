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

    float cloud1 = smoothstep(-0.1, 0.5, n1 * nebulaBand);
    float cloud2 = smoothstep(0.0, 0.6, n2 * nebulaBand * 0.9);
    float dreamCloud = smoothstep(-0.2, 0.4, n3 * nebulaWide);

    vec3 nebulaColor = vec3(0.0);
    nebulaColor += deepBlue * cloud1 * 0.5;
    nebulaColor += brightPurple * cloud2 * 0.6;
    nebulaColor += dreamCyan * cloud1 * cloud2 * 0.4;
    nebulaColor += hotPink * smoothstep(0.2, 0.7, n1 * n2) * nebulaBand * 0.4;
    nebulaColor += lavender * dreamCloud * 0.35;
    nebulaColor += softGold * smoothstep(0.1, 0.6, n3 * n1) * nebulaWide * 0.25;
    // 底色微光
    nebulaColor += vec3(0.03, 0.02, 0.06) * 0.2;

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
      <Stars radius={200} depth={80} count={5000} factor={4} saturation={0} fade speed={0.5} />
      <Sparkles count={250} scale={[250, 250, 250]} size={8} speed={0} noise={0} color="#00f3ff" opacity={0.4} />
      <Sparkles count={120} scale={[280, 280, 280]} size={14} speed={0} noise={0} color="#bf00ff" opacity={0.5} />
      <Sparkles count={50} scale={[220, 220, 220]} size={22} speed={0} noise={0} color="#ffffff" opacity={0.4} />
    </group>
  );
};

export const Scene = () => {
  return (
    <>
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.2} />
      <FollowingSkybox />

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
