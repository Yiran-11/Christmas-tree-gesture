import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTreeStore } from './store'; 

const StickyNote = ({ id, anchorParams, initialText = "Wish..." }: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  
  // 本地状态来存储文字
  const [text, setText] = useState(initialText);

  // 全局状态
  const focusedNoteId = useTreeStore((state) => state.focusedNoteId);
  const setFocusedNoteId = useTreeStore((state) => state.setFocusedNoteId);
  const chaosFactor = useTreeStore((state) => state.chaosFactor);
  
  const isFocused = focusedNoteId === id;

  // 1. 原始树上位置
  const treePosition = useMemo(() => {
    const { radius, phi, theta } = anchorParams;
    return new THREE.Vector3().setFromSphericalCoords(radius + 0.2, phi, theta);
  }, [anchorParams]);

  // 2. 散开目标位置
  const scatterPosition = useMemo(() => {
    const v = new THREE.Vector3();
    v.setFromSphericalCoords(10 + Math.random() * 4, Math.acos(2 * Math.random() - 1), Math.random() * Math.PI * 2);
    return v;
  }, []);

  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const targetWorldPos = useMemo(() => new THREE.Vector3(), []);
  const currentFrameTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const hands = useTreeStore.getState().hands;

    // --- 抓取逻辑 ---
    if (hands.left) {
      if (hands.left.isPinching) {
        if (focusedNoteId === null || isFocused) {
            groupRef.current.getWorldPosition(worldPos);
            const distance = worldPos.distanceTo(hands.left.position);
            // 判定距离：稍微加大一点判定范围，因为便签变大了
            if (distance < 5.0) {
                if (!isFocused) setFocusedNoteId(id);
            }
        }
      } else {
        if (isFocused) setFocusedNoteId(null);
      }
    } else {
        if (isFocused) setFocusedNoteId(null);
    }

    // --- 运动逻辑 ---
    if (isFocused) {
      const camera = state.camera;
      targetWorldPos.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8));
      
      if (groupRef.current.parent) {
          groupRef.current.parent.worldToLocal(targetWorldPos);
      }

      groupRef.current.position.lerp(targetWorldPos, 0.2);
      groupRef.current.lookAt(camera.position); 

    } else {
      currentFrameTarget.lerpVectors(treePosition, scatterPosition, chaosFactor * 0.3);
      groupRef.current.position.lerp(currentFrameTarget, 0.1);
      groupRef.current.lookAt(0, 0, 0); 
      groupRef.current.rotateY(Math.PI); 
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        {/* 🟢 修改：放大便签尺寸到 2.5 */}
        <planeGeometry args={[2.5, 2.5]} />
        <meshStandardMaterial 
          color="#FFFBF0" 
          emissive="#FFFFFF" 
          emissiveIntensity={isFocused ? 0.5 : 0.2} 
          side={THREE.DoubleSide} 
        />
        
        {isFocused ? (
          <Html transform position={[0, 0, 0.05]} className="pointer-events-auto">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                // 🟢 修改：输入框尺寸配合放大
                width: '220px',
                height: '200px',
                border: 'none',
                background: 'transparent',
                resize: 'none',
                outline: 'none',
                fontSize: '30px', // 🟢 修改：字体加大
                fontFamily: 'Microsoft YaHei, sans-serif',
                textAlign: 'center',
                color: 'black',
                fontWeight: 'bold',
                overflow: 'hidden',
                lineHeight: '1.5'
              }}
              onPointerDown={(e) => e.stopPropagation()}
            />
          </Html>
        ) : (
          // 🟢 修改：3D文字也同步放大
          <Text position={[0, 0, 0.02]} fontSize={0.35} color="black" maxWidth={2.2} textAlign="center">
              {text}
          </Text>
        )}
      </mesh>
    </group>
  );
};

export default StickyNote;