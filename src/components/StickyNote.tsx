// src/StickyNote.tsx
import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTreeStore } from './store'; // 引入刚才修好的 store

// 传入参数：id, 树上的锚点位置(anchorParams), 初始文字
export const StickyNote = ({ id, anchorParams, initialText = "点击写愿望..." }: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  const [text, setText] = useState(initialText);
  
  // 1. 获取全局状态
  const focusedNoteId = useTreeStore((state) => state.focusedNoteId);
  const setFocusedNoteId = useTreeStore((state) => state.setFocusedNoteId);
  const isFocused = focusedNoteId === id;

  // 2. 计算它在树上的“老家”位置
  const treePosition = useMemo(() => {
    const { radius, phi, theta } = anchorParams;
    return new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
  }, [anchorParams]);

  useFrame((state) => {
    if (!groupRef.current) return;

    if (isFocused) {
      // === 状态A: 聚焦 (飞到镜头前) ===
      const camera = state.camera;
      // 计算相机正前方 8 单位的位置
      const targetPos = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8));
      
      // 平滑飞过去
      groupRef.current.position.lerp(targetPos, 0.1);
      // 脸始终朝向相机
      groupRef.current.lookAt(camera.position);
    } else {
      // === 状态B: 归位 (回到树上) ===
      // 平滑飞回树上的坐标
      groupRef.current.position.lerp(treePosition, 0.1);
      //背对树心
      groupRef.current.lookAt(0, 0, 0);
      groupRef.current.rotateY(Math.PI); 
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    // 切换聚焦状态
    setFocusedNoteId(isFocused ? null : id);
  };

  return (
    <group ref={groupRef} onClick={handleClick}>
      <mesh>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial 
          color="#FFFBF0"       // 🟢 乳白色
          emissive="#FFFFFF"    // 🟢 微光
          emissiveIntensity={0.2}
          roughness={0.4}
          side={THREE.DoubleSide}
        />
        {/* 未聚焦时显示 3D 文字 */}
        {!isFocused && (
          <Text position={[0, 0, 0.02]} fontSize={0.15} color="black" maxWidth={1.2} textAlign="center">
            {text}
          </Text>
        )}
      </mesh>

      {/* 聚焦时显示 HTML 输入框 */}
      {isFocused && (
        <Html position={[0, 0, 0]} transform>
          <div className="p-4 bg-white/90 rounded-lg flex flex-col items-center gap-2 shadow-xl" style={{width: '200px'}}>
             <textarea 
               value={text} 
               onChange={(e) => setText(e.target.value)}
               className="w-full h-24 p-2 border border-gray-300 rounded text-black bg-transparent"
               placeholder="写下愿望..."
               style={{ pointerEvents: 'auto' }} // 确保能输入
             />
             <button 
               onClick={(e) => { e.stopPropagation(); setFocusedNoteId(null); }}
               className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700"
               style={{ pointerEvents: 'auto' }}
             >
               挂回树上
             </button>
          </div>
        </Html>
      )}
    </group>
  );
};