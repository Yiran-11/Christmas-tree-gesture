import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTreeStore } from './store'; 

const StickyNote = ({ id, anchorParams, initialText = "Wish..." }: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  
  // 全局状态
  const focusedNoteId = useTreeStore((state) => state.focusedNoteId);
  const setFocusedNoteId = useTreeStore((state) => state.setFocusedNoteId);
  
  // 增加获取 chaosFactor，用于处理炸开时的位移
  const chaosFactor = useTreeStore((state) => state.chaosFactor);
  
  const isFocused = focusedNoteId === id;

  // 1. 原始树上位置
  const treePosition = useMemo(() => {
    const { radius, phi, theta } = anchorParams;
    return new THREE.Vector3().setFromSphericalCoords(radius + 0.2, phi, theta);
  }, [anchorParams]);

  // 2. 散开目标位置 (炸开时轻微飘散)
  const scatterPosition = useMemo(() => {
    const v = new THREE.Vector3();
    v.setFromSphericalCoords(10 + Math.random() * 4, Math.acos(2 * Math.random() - 1), Math.random() * Math.PI * 2);
    return v;
  }, []);

  // 临时向量
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const targetWorldPos = useMemo(() => new THREE.Vector3(), []);
  const currentFrameTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!groupRef.current) return;

    const hands = useTreeStore.getState().hands;

    // --- 抓取逻辑 (模拟鼠标) ---
    // 只有左手负责抓取
    if (hands.left) {
      if (hands.left.isPinching) {
        // 状态：按下鼠标
        // 如果当前没有抓任何便签，或者正在抓的就是我自己
        if (focusedNoteId === null || isFocused) {
            // 计算真实世界距离
            groupRef.current.getWorldPosition(worldPos);
            const distance = worldPos.distanceTo(hands.left.position);
            
            // 判定距离：4.0 (比较容易抓到)
            if (distance < 4.0) {
                // 锁定！
                if (!isFocused) setFocusedNoteId(id);
            }
        }
      } else {
        // 状态：松开鼠标
        // 如果我是被抓的，那现在必须释放我
        if (isFocused) {
            setFocusedNoteId(null);
        }
      }
    } else {
        // 如果手移出画面，也释放
        if (isFocused) setFocusedNoteId(null);
    }

    // --- 运动逻辑 ---
    if (isFocused) {
      // === 模式 A: 悬浮在面前 (绝对静止) ===
      const camera = state.camera;
      
      // 1. 计算目标点：相机正前方 8 米
      targetWorldPos.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8));
      
      // 2. 关键：将“绝对静止的世界坐标”转换为“旋转父级下的局部坐标”
      // 这一步会计算出反向位移，完美抵消树的旋转
      if (groupRef.current.parent) {
          groupRef.current.parent.worldToLocal(targetWorldPos);
      }

      // 3. 移动过去 (稍快一点响应)
      groupRef.current.position.lerp(targetWorldPos, 0.2);
      
      // 4. 始终正对相机
      groupRef.current.lookAt(camera.position); 

    } else {
      // === 模式 B: 回归树上 (随树旋转) ===
      
      // 计算当前应该在树的哪里 (考虑炸开效果)
      // chaosFactor * 0.3 意味着便签只受到 30% 的炸开影响，轻微飘散
      currentFrameTarget.lerpVectors(treePosition, scatterPosition, chaosFactor * 0.3);
      
      // 平滑飞回
      groupRef.current.position.lerp(currentFrameTarget, 0.1);
      
      // 面向树外侧
      groupRef.current.lookAt(0, 0, 0); 
      groupRef.current.rotateY(Math.PI); 
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial 
          color="#FFFBF0" 
          emissive="#FFFFFF" 
          emissiveIntensity={isFocused ? 0.5 : 0.2} 
          side={THREE.DoubleSide} 
        />
        <Text position={[0, 0, 0.02]} fontSize={0.2} color="black" maxWidth={1.2} textAlign="center">
            {initialText}
        </Text>
      </mesh>
    </group>
  );
};

export default StickyNote;