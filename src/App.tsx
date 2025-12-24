import React, { useMemo, useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, PerspectiveCamera, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTreeStore } from './store'; 
import HandGestureController from './HandGestureController'; 
import StickyNote from './StickyNote'; 

// --- 全局配置常量 ---
const TREE_HEIGHT = 16;
const TREE_RADIUS = 6;
const CHAR_SEQUENCE = ['圣', '诞', '快', '乐']; 
const CHAR_SCALE = 15; 

// 治愈系文案
const INITIAL_WISHES = [
  "人生不止一个方向",
  "冬天终将过去^^",
  "没关系 我知道我在渐入佳境",
  "亲爱的自己 人生总是柳暗花明",
  "天天开心",
  "未来可期",
  "好快乐 今天吃了好吃的！\n还不开心吗 那再去吃一顿！", 
  "心想事成",
  "岁岁平安",
  "2025 卧槽！又活一年！\n牛逼老铁！"
];

// --- 工具函数 ---
const generateCharParticles = (char: string, count: number): Float32Array => {
  const canvas = document.createElement('canvas'); const size = 128; canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d'); if (!ctx) return new Float32Array(count * 3);
  ctx.fillStyle = 'black'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = 'white'; ctx.font = '900 90px "Microsoft YaHei"';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(char, size / 2, size / 2);
  const imgData = ctx.getImageData(0, 0, size, size); const pixels = imgData.data; const validPoints: number[] = [];
  for (let i = 0; i < size * size; i++) { if (pixels[i * 4] > 150) { validPoints.push((i % size) / size - 0.5, 0.5 - Math.floor(i / size) / size); } }
  const positions = new Float32Array(count * 3); if (validPoints.length === 0) return positions;
  for (let i = 0; i < count; i++) {
    const randIdx = Math.floor(Math.random() * (validPoints.length / 2)) * 2;
    positions[i * 3] = validPoints[randIdx] * CHAR_SCALE; positions[i * 3 + 1] = validPoints[randIdx + 1] * CHAR_SCALE; positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
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
  const v = new THREE.Vector3(); v.setFromSphericalCoords(15 + Math.random() * 20, Math.acos(2 * Math.random() - 1), Math.random() * Math.PI * 2); return v;
};

// --- 视觉组件 ---
const Foliage = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null); const count = 20000; const geoRef = useRef<THREE.BufferGeometry>(null);
  const { initialTarget, initialChaos, randoms } = useMemo(() => {
    const tArr = new Float32Array(count * 3); const cArr = new Float32Array(count * 3); const rArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const t = getTreePosition(Math.pow(Math.random(), 0.8)); tArr.set([t.x, t.y, t.z], i * 3);
      const c = getScatteredPosition(); cArr.set([c.x, c.y, c.z], i * 3); rArr[i] = Math.random();
    } return { initialTarget: tArr, initialChaos: cArr, randoms: rArr };
  }, []);
  useFrame((state) => { if (materialRef.current) { materialRef.current.uniforms.uTime.value = state.clock.elapsedTime; materialRef.current.uniforms.uChaos.value = useTreeStore.getState().chaosFactor; } });
  return ( <points> <bufferGeometry ref={geoRef}> <bufferAttribute attach="attributes-position" count={count} array={initialTarget} itemSize={3} /> <bufferAttribute attach="attributes-aTargetPos" count={count} array={initialTarget} itemSize={3} /> <bufferAttribute attach="attributes-aChaosPos" count={count} array={initialChaos} itemSize={3} /> <bufferAttribute attach="attributes-aRandom" count={count} array={randoms} itemSize={1} /> </bufferGeometry> <shaderMaterial ref={materialRef} uniforms={{ uTime: { value: 0 }, uChaos: { value: 0 }, uColor1: { value: new THREE.Color('#003311') }, uColor2: { value: new THREE.Color('#FFD700') } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} vertexShader={`uniform float uTime; uniform float uChaos; attribute vec3 aTargetPos; attribute vec3 aChaosPos; attribute float aRandom; varying float vAlpha; varying float vRandom; float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); } void main() { vec3 pos = mix(aTargetPos, aChaosPos, uChaos); float explodeFactor = sin(uChaos * 3.14159); vec3 explodeDir = normalize(pos) * (aRandom * 2.0 - 1.0); explodeDir.y += (random(vec2(aRandom, 1.0)) - 0.5) * 2.0; pos += explodeDir * explodeFactor * 12.0; pos.y += sin(uTime + pos.x) * 0.05 * (1.0 - uChaos); vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0); gl_Position = projectionMatrix * mvPosition; gl_PointSize = (25.0 * aRandom + 5.0) * (1.0 / -mvPosition.z); vAlpha = 1.0; vRandom = aRandom; }`} fragmentShader={`uniform vec3 uColor1; uniform vec3 uColor2; varying float vAlpha; varying float vRandom; void main() { if (length(gl_PointCoord - 0.5) > 0.5) discard; vec3 color = mix(uColor1, uColor2, vRandom * 0.5 + 0.2); gl_FragColor = vec4(color + 0.2, vAlpha); }`} /> </points> );
};

const Ornaments = ({ count = 100, color = '#FFD700', isGold = false, radiusOffset = 0, globalScale = 0.5, angleOffset = 0, mode, char }: any) => {
  const meshRef = useRef<THREE.InstancedMesh>(null); const dummy = useMemo(() => new THREE.Object3D(), []); const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const data = useMemo(() => new Array(count).fill(0).map((_, i) => ({ treePos: new THREE.Vector3(), textPos: new THREE.Vector3(), chaosPos: getScatteredPosition(), current: new THREE.Vector3(), baseScale: (isGold && i === count - 1) ? 0.8 : globalScale, explodeDir: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize() })), [count, isGold, globalScale]);
  useMemo(() => { data.forEach((d, i) => { let h, theta; if (isGold && i === count - 1) { h = 1.0; theta = 0; } else { const areaRatio = (i + 0.5) / count; h = 1 - Math.sqrt(1 - areaRatio); theta = i * goldenAngle + angleOffset; } d.treePos.copy(getTreePosition(h, theta, radiusOffset)); }); }, [data, isGold, radiusOffset, angleOffset, goldenAngle, count]);
  useEffect(() => { const charPositions = generateCharParticles(char, count); data.forEach((d, i) => { d.textPos.set(charPositions[i * 3], charPositions[i * 3 + 1], charPositions[i * 3 + 2]); }); }, [char, data, count]);
  useFrame(() => { if (!meshRef.current) return; const chaosFactor = useTreeStore.getState().chaosFactor; data.forEach((d, i) => { const targetShape = mode === 'TREE' ? d.treePos : d.textPos; const targetPos = new THREE.Vector3().lerpVectors(targetShape, d.chaosPos, chaosFactor); const explodeFactor = Math.sin(chaosFactor * Math.PI); targetPos.addScaledVector(d.explodeDir, explodeFactor * 12.0); d.current.lerp(targetPos, 0.08); dummy.position.copy(d.current); const scale = d.baseScale * (1 + chaosFactor * 0.1); dummy.scale.setScalar(scale); dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix); }); meshRef.current.instanceMatrix.needsUpdate = true; });
  return ( <instancedMesh ref={meshRef} args={[undefined, undefined, count]}> <sphereGeometry args={[1, 16, 16]} /> <meshStandardMaterial color={color} roughness={0.1} metalness={1} /> </instancedMesh> );
};

const SpiralRibbon = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null); const dummy = useMemo(() => new THREE.Object3D(), []); const count = 2000;
  const data = useMemo(() => new Array(count).fill(0).map((_, i) => { const t = i / (count - 1); const theta = t * 3 * Math.PI * 2; const y = -(TREE_HEIGHT + 4) / 2 + t * (TREE_HEIGHT + 4); const r = THREE.MathUtils.lerp(10.0, 2.0, t); return { target: new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)), chaos: getScatteredPosition(), current: new THREE.Vector3(), rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI], scale: 0.8 + Math.random() * 0.4, explodeDir: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize() }; }), []);
  useFrame(() => { if (!meshRef.current) return; const chaosFactor = useTreeStore.getState().chaosFactor; data.forEach((d, i) => { const targetPos = new THREE.Vector3().lerpVectors(d.target, d.chaos, chaosFactor); const explodeFactor = Math.sin(chaosFactor * Math.PI); targetPos.addScaledVector(d.explodeDir, explodeFactor * 20.0); d.current.lerp(targetPos, 0.08); dummy.position.copy(d.current); dummy.rotation.set(d.rotation[0] + chaosFactor, d.rotation[1] + chaosFactor, d.rotation[2]); dummy.scale.setScalar(d.scale); dummy.updateMatrix(); meshRef.current!.setMatrixAt(i, dummy.matrix); }); meshRef.current.instanceMatrix.needsUpdate = true; });
  return ( <instancedMesh ref={meshRef} args={[undefined, undefined, count]}> <tetrahedronGeometry args={[0.05, 0]} /> <meshStandardMaterial color="#F0F0F0" emissive="#FFFFFF" emissiveIntensity={0.3} transparent opacity={0.8} /> </instancedMesh> );
};

const HandCursor = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const hands = useTreeStore.getState().hands;
    if (hands.left && meshRef.current) {
      meshRef.current.position.lerp(hands.left.position, 0.2);
      const isPinching = hands.left.isPinching;
      const color = isPinching ? '#ff0000' : '#ffffff';
      (meshRef.current.material as THREE.MeshStandardMaterial).color.set(color);
      (meshRef.current.material as THREE.MeshStandardMaterial).emissive.set(color);
    }
  });
  return ( <mesh ref={meshRef}> <sphereGeometry args={[0.3, 16, 16]} /> <meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} /> </mesh> );
};

// --- Scene 主场景 ---
const Scene = () => {
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
    const count = INITIAL_WISHES.length; 
    return new Array(count).fill(0).map((_, i) => {
      // 🟢 修改：调整 phi 计算公式，避免底部
      // 原始范围 (-1 到 1) 改为 (-0.3 到 1)，切掉底部 35%
      const yProgress = -0.3 + (1.3 * i) / (count - 1); 
      // 反余弦算出的角度
      const phi = Math.acos(yProgress); 
      
      return {
        id: i,
        anchorParams: {
          radius: 7.5 + Math.random(), 
          phi: phi, 
          theta: Math.sqrt(count * Math.PI) * phi * 5 // 重新打散分布
        },
        initialText: INITIAL_WISHES[i]
      };
    });
  }, []);

  useFrame((state, delta) => {
    updateChaos();
    const chaos = useTreeStore.getState().chaosFactor;
    if (isNaN(chaos)) return;
    if (chaos > 0.8 && !isSwitchedRef.current) { setStepIndex(prev => prev + 1); isSwitchedRef.current = true; }
    if (chaos < 0.1) { isSwitchedRef.current = false; }
    const { x } = useTreeStore.getState().handRotation;
    const rotationSpeed = (x || 0) * delta; 
    
    // 🟢 修改：将自转基础速度系数从 0.1 降为 0.02
    if (outerGroupRef.current) outerGroupRef.current.rotation.y += rotationSpeed + delta * 0.02;
    
    if (innerGroupRef.current) {
        let shouldRotate = true;
        if (!isTreeMode && chaos < 0.5) { shouldRotate = false; innerGroupRef.current.rotation.y *= 0.95; }
        // 同步降低内层旋转速度
        if (shouldRotate) innerGroupRef.current.rotation.y += rotationSpeed + delta * 0.02;
    }
  });

  return (
    <>
      <OrbitControls enablePan={false} enableZoom={true} minDistance={10} maxDistance={50} autoRotate={false} />
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 20, 10]} angle={0.5} intensity={50} castShadow color="#FFD700" />
      <Environment preset="city" />
      <HandCursor />
      <group ref={innerGroupRef} position={[0, -5, 0]}>
        <Ornaments mode={currentMode} char={currentChar} count={1500} color="#FFD700" speed={0.05} isGold={true} radiusOffset={0} globalScale={0.18} />
        <Ornaments mode={currentMode} char={currentChar} count={400} color="#8B0000" speed={0.08} radiusOffset={0.5} globalScale={0.15} angleOffset={0} />
        <Ornaments mode={currentMode} char={currentChar} count={400} color="#228B22" speed={0.07} radiusOffset={0.5} globalScale={0.15} angleOffset={Math.PI} />
      </group>
      <group ref={outerGroupRef} position={[0, -5, 0]}>
        <Foliage /> 
        <SpiralRibbon />
        {notesData.map((note) => (
          <StickyNote key={note.id} {...note} />
        ))}
      </group>
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.9} intensity={1.5} radius={0.5} mipmapBlur />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>
    </>
  );
};

// 🟢 新增：音乐播放器组件
const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.log("播放失败，可能需要交互", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="absolute bottom-5 left-5 z-50">
      <audio ref={audioRef} src="/Etereo.mp3" loop />
      <button 
        onClick={togglePlay}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-white/20 transition-all"
      >
        {isPlaying ? (
           // 暂停图标
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
             <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
           </svg>
        ) : (
           // 播放图标
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
             <path d="M8 5v14l11-7z"/>
           </svg>
        )}
        <span className="text-sm font-light tracking-widest">Etereo</span>
      </button>
    </div>
  );
};

export default function App() {
  return (
    <div className="w-full h-screen bg-black relative select-none">
      <HandGestureController />
      
      {/* 顶部文字 */}
      <div className="absolute top-10 w-full text-center z-10 pointer-events-none">
        <h1 className="text-5xl font-bold text-yellow-500 tracking-widest drop-shadow-lg font-serif">MERRY CHRISTMAS</h1>
        <p className="text-white mt-2 tracking-widest text-sm uppercase opacity-80">
          🖐️ Right: Scatter & Rotate | 🤏 Left: Pinch Note (Follow the Red Dot!)
        </p>
        <p className="text-yellow-300 mt-2 text-xs tracking-widest opacity-60 font-mono">
          @2025 -Yiran11-
        </p>
      </div>

      {/* 🟢 插入播放器 */}
      <AudioPlayer />

      <Canvas dpr={[1, 2]} gl={{ antialias: false, toneMapping: THREE.ReinhardToneMapping, toneMappingExposure: 1.5 }}>
        <PerspectiveCamera makeDefault position={[0, 0, 30]} />
        <Suspense fallback={null}>
            <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}