import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTreeStore } from '../store'; // 引入刚才修好的 store

// --- 1. 基础配置 ---
const TREE_HEIGHT = 16;
const TREE_RADIUS = 6;
const CHAR_SEQUENCE = ['圣', '诞', '快', '乐'];
const CHAR_SCALE = 15;

// --- 工具函数: 生成文字粒子 ---
const generateCharParticles = (char: string, count: number): Float32Array => {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Float32Array(count * 3);
  ctx.fillStyle = 'black'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'white'; ctx.font = '900 90px "Microsoft YaHei", "SimHei", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(char, size / 2, size / 2);
  const imgData = ctx.getImageData(0, 0, size, size);
  const pixels = imgData.data;
  const validPoints: number[] = [];
  for (let i = 0; i < size * size; i++) {
    if (pixels[i * 4] > 150) { 
      const x = (i % size) / size - 0.5; 
      const y = 0.5 - Math.floor(i / size) / size; 
      validPoints.push(x, y);
    }
  }
  const positions = new Float32Array(count * 3);
  if (validPoints.length === 0) return positions;
  for (let i = 0; i < count; i++) {
    const randIdx = Math.floor(Math.random() * (validPoints.length / 2)) * 2;
    positions[i * 3] = validPoints[randIdx] * CHAR_SCALE; 
    positions[i * 3 + 1] = validPoints[randIdx + 1] * CHAR_SCALE; 
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5; 
  }
  return positions;
};

const getTreePosition = (ratio: number, fixedTheta?: number, radiusOffset: number = 0) => {
  const y = -TREE_HEIGHT / 2 + ratio * TREE_HEIGHT;
  const r = (1 - ratio) * (TREE_RADIUS + radiusOffset);
  const theta = fixedTheta !== undefined ? fixedTheta : Math.random() * Math.PI * 2;
  return new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));
};

const getScatteredPosition = () => {
  const v = new THREE.Vector3();
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 8 + Math.random() * 10; 
  v.setFromSphericalCoords(r, phi, theta);
  return v;
};

// --- 组件: 针叶 (Foliage) ---
const Foliage = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const count = 20000;
  const geoRef = useRef<THREE.BufferGeometry>(null);
  const { initialTarget, initialChaos, randoms } = useMemo(() => {
    const tArr = new Float32Array(count * 3);
    const cArr = new Float32Array(count * 3);
    const rArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const t = getTreePosition(Math.pow(Math.random(), 0.8));
      tArr.set([t.x, t.y, t.z], i * 3);
      const c = getScatteredPosition();
      cArr.set([c.x, c.y, c.z], i * 3);
      rArr[i] = Math.random();
    }
    return { initialTarget: tArr, initialChaos: cArr, randoms: rArr };
  }, []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uChaos.value = useTreeStore.getState().chaosFactor;
    }
  });

  return (
    <points>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" count={count} array={initialTarget} itemSize={3} />
        <bufferAttribute attach="attributes-aTargetPos" count={count} array={initialTarget} itemSize={3} />
        <bufferAttribute attach="attributes-aChaosPos" count={count} array={initialChaos} itemSize={3} />
        <bufferAttribute attach="attributes-aRandom" count={count} array={randoms} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        uniforms={{
          uTime: { value: 0 },
          uChaos: { value: 0 },
          uColor1: { value: new THREE.Color('#003311') },
          uColor2: { value: new THREE.Color('#FFD700') },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          uniform float uTime; uniform float uChaos;
          attribute vec3 aTargetPos; attribute vec3 aChaosPos; attribute float aRandom;
          varying float vAlpha; varying float vRandom;
          float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
          void main() {
            vec3 pos = mix(aTargetPos, aChaosPos, uChaos);
            float explodeFactor = sin(uChaos * 3.14159);
            vec3 explodeDir = normalize(pos) * (aRandom * 2.0 - 1.0); 
            explodeDir.y += (random(vec2(aRandom, 1.0)) - 0.5) * 2.0;
            pos += explodeDir * explodeFactor * 5.0; 
            pos.y += sin(uTime + pos.x) * 0.05 * (1.0 - uChaos);
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = (25.0 * aRandom + 5.0) * (1.0 / -mvPosition.z);
            vAlpha = 1.0; vRandom = aRandom;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor1; uniform vec3 uColor2;
          varying float vAlpha; varying float vRandom;
          void main() {
            if (length(gl_PointCoord - 0.5) > 0.5) discard;
            vec3 color = mix(uColor1, uColor2, vRandom * 0.5 + 0.2);
            gl_FragColor = vec4(color + 0.2, vAlpha);
          }
        `}
      />
    </points>
  );
};

// --- 组件: 装饰球 (Ornaments) ---
const Ornaments = ({ count = 100, color = '#FFD700', isGold = false, radiusOffset = 0, globalScale = 0.5, angleOffset = 0, mode, char }: any) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const data = useMemo(() => new Array(count).fill(0).map((_, i) => ({
      treePos: new THREE.Vector3(),
      textPos: new THREE.Vector3(),
      chaosPos: getScatteredPosition(),
      current: new THREE.Vector3(),
      baseScale: (isGold && i === count - 1) ? 0.8 : globalScale,
      explodeDir: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize()
  })), [count, isGold, globalScale]);

  useMemo(() => {
    data.forEach((d, i) => {
        let h, theta;
        if (isGold && i === count - 1) { h = 1.0; theta = 0; }
        else {
            const areaRatio = (i + 0.5) / count;
            h = 1 - Math.sqrt(1 - areaRatio);
            theta = i * goldenAngle + angleOffset;
        }
        d.treePos.copy(getTreePosition(h, theta, radiusOffset));
    });
  }, [data, isGold, radiusOffset, angleOffset, goldenAngle, count]);

  useEffect(() => {
      const charPositions = generateCharParticles(char, count);
      data.forEach((d, i) => {
          d.textPos.set(charPositions[i * 3], charPositions[i * 3 + 1], charPositions[i * 3 + 2]);
      });
  }, [char, data, count]);

  useFrame(() => {
    if (!meshRef.current) return;
    const chaosFactor = useTreeStore.getState().chaosFactor;
    data.forEach((d, i) => {
      const targetShape = mode === 'TREE' ? d.treePos : d.textPos;
      const targetPos = new THREE.Vector3().lerpVectors(targetShape, d.chaosPos, chaosFactor);
      const explodeFactor = Math.sin(chaosFactor * Math.PI);
      targetPos.addScaledVector(d.explodeDir, explodeFactor * 5.0);
      d.current.lerp(targetPos, 0.08); 
      dummy.position.copy(d.current);
      const scale = d.baseScale * (1 + chaosFactor * 0.1);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.1} metalness={1} />
    </instancedMesh>
  );
};

// --- 组件: 丝带 (SpiralRibbon) ---
const SpiralRibbon = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 2000;
  const data = useMemo(() => new Array(count).fill(0).map((_, i) => {
    const t = i / (count - 1);
    const theta = t * 3 * Math.PI * 2;
    const y = -(TREE_HEIGHT + 4) / 2 + t * (TREE_HEIGHT + 4);
    const r = THREE.MathUtils.lerp(10.0, 2.0, t);
    return {
      target: new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)),
      chaos: getScatteredPosition(),
      current: new THREE.Vector3(),
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
      scale: 0.8 + Math.random() * 0.4,
      explodeDir: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize()
    };
  }), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const chaosFactor = useTreeStore.getState().chaosFactor;
    data.forEach((d, i) => {
      const targetPos = new THREE.Vector3().lerpVectors(d.target, d.chaos, chaosFactor);
      const explodeFactor = Math.sin(chaosFactor * Math.PI);
      targetPos.addScaledVector(d.explodeDir, explodeFactor * 12.0);
      d.current.lerp(targetPos, 0.08);
      dummy.position.copy(d.current);
      dummy.rotation.set(d.rotation[0] + chaosFactor, d.rotation[1] + chaosFactor, d.rotation[2]);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <tetrahedronGeometry args={[0.05, 0]} />
      <meshStandardMaterial color="#F0F0F0" emissive="#FFFFFF" emissiveIntensity={0.3} transparent opacity={0.8} />
    </instancedMesh>
  );
};

// --- ✨ 组件: 增强版便签 (StickyNote) ✨ ---
const StickyNote = ({ id, anchorParams, initialText }: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  const [text, setText] = useState(initialText);
  
  // 从 useTreeStore 获取状态
  const focusedNoteId = useTreeStore((state) => state.focusedNoteId);
  const setFocusedNoteId = useTreeStore((state) => state.setFocusedNoteId);
  const isFocused = focusedNoteId === id;

  const treePosition = useMemo(() => {
    const { radius, phi, theta } = anchorParams;
    return new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
  }, [anchorParams]);

  useFrame((state) => {
    if (!groupRef.current) return;

    if (isFocused) {
      // Focus: 飞向相机
      const camera = state.camera;
      const targetPos = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8));
      groupRef.current.position.lerp(targetPos, 0.1);
      groupRef.current.lookAt(camera.position);
    } else {
      // Attached: 回归树
      groupRef.current.position.lerp(treePosition, 0.1);
      groupRef.current.lookAt(0, 0, 0); 
      groupRef.current.rotateY(Math.PI);
    }
  });

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); setFocusedNoteId(isFocused ? null : id); }}>
      <mesh>
        <planeGeometry args={[1.2, 1.2]} />
        <meshStandardMaterial 
          color="#FFFBF0" 
          emissive="#FFFFFF" 
          emissiveIntensity={0.2} 
          roughness={0.4} 
          side={THREE.DoubleSide} 
        />
        {!isFocused && (
          <Text position={[0, 0, 0.02]} fontSize={0.15} color="black" maxWidth={1} textAlign="center">
            {text}
          </Text>
        )}
      </mesh>
      {isFocused && (
        <Html position={[0, 0, 0]} transform>
          <div className="p-4 bg-white/90 rounded-lg flex flex-col items-center gap-2" style={{ width: '200px' }}>
             <textarea 
               value={text} 
               onChange={(e) => setText(e.target.value)}
               className="w-full h-20 p-2 border border-gray-300 rounded text-black"
             />
             <button 
               onClick={(e) => { e.stopPropagation(); setFocusedNoteId(null); }}
               className="px-4 py-1 bg-red-600 text-white rounded"
             >
               完成
             </button>
          </div>
        </Html>
      )}
    </group>
  );
};

// --- ✨ 最终总装组件 (ChristmasTree) ✨ ---
const ChristmasTree = () => {
  const innerGroupRef = useRef<THREE.Group>(null);
  const outerGroupRef = useRef<THREE.Group>(null);
  const [stepIndex, setStepIndex] = useState(0); 
  const isSwitchedRef = useRef(false);
  const updateChaos = useTreeStore((state) => state.updateChaos);

  const isTreeMode = stepIndex % 2 === 0;
  const currentMode = isTreeMode ? 'TREE' : 'TEXT';
  const charIndex = Math.floor(stepIndex / 2) % CHAR_SEQUENCE.length;
  const currentChar = CHAR_SEQUENCE[charIndex];

  const notesData = useMemo(() => {
    const count = 8; 
    return new Array(count).fill(0).map((_, i) => ({
        id: i,
        anchorParams: { 
            radius: 7.5 + Math.random(), 
            phi: Math.acos(-1 + (2 * i) / count), 
            theta: Math.sqrt(count * Math.PI) * Math.acos(-1 + (2 * i) / count) 
        },
        initialText: `愿望 ${i + 1}`
    }));
  }, []);

  useFrame((state, delta) => {
    updateChaos();
    const chaos = useTreeStore.getState().chaosFactor;
    if (chaos > 0.8 && !isSwitchedRef.current) { setStepIndex(prev => prev + 1); isSwitchedRef.current = true; }
    if (chaos < 0.1) { isSwitchedRef.current = false; }

    const { x } = useTreeStore.getState().handRotation;
    const rotationSpeed = x * delta * 0.3;

    if (outerGroupRef.current) outerGroupRef.current.rotation.y += rotationSpeed + delta * 0.1;
    if (innerGroupRef.current) {
        if (isTreeMode || chaos >= 0.5) innerGroupRef.current.rotation.y += rotationSpeed + delta * 0.1;
    }
  });

  return (
    <>
      <group ref={innerGroupRef} position={[0, -5, 0]}>
        <Ornaments mode={currentMode} char={currentChar} count={1500} color="#FFD700" speed={0.05} isGold={true} />
        <Ornaments mode={currentMode} char={currentChar} count={400} color="#8B0000" speed={0.08} radiusOffset={0.5} />
      </group>
      <group ref={outerGroupRef} position={[0, -5, 0]}>
        <Foliage /> 
        <SpiralRibbon />
        {/* 新便签系统 */}
        {notesData.map((note) => (
           <StickyNote key={note.id} {...note} />
        ))}
      </group>
    </>
  );
};

export default ChristmasTree;