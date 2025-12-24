import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTreeStore } from './store'; 

// 🟢 核心功能：生成云朵渐变 + 文字的纹理
// 这样不需要 3D 模型，也不需要下载字体文件，直接画出来
const createCloudTexture = (text: string) => {
  const canvas = document.createElement('canvas');
  const size = 512; // 画布大小，越大越清晰
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // 1. 绘制云朵背景 (径向渐变)
  // 圆心(x,y,r) -> 外圆(x,y,r)
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  
  // 中心：天蓝色 (Sky Blue - 不透明)
  gradient.addColorStop(0, 'rgba(186, 230, 253, 0.95)'); 
  // 中间：淡蓝色
  gradient.addColorStop(0.6, 'rgba(224, 242, 254, 0.8)');
  // 边缘：完全透明 (实现云朵柔和边缘)
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // 2. 绘制文字 (深蓝色，微软雅黑)
  ctx.font = "bold 45px 'Microsoft YaHei', 'Heiti SC', sans-serif";
  ctx.fillStyle = "#1e3a8a"; // 深蓝色 (Deep Blue)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 处理换行符 \n
  const lines = text.split('\n');
  const lineHeight = 60;
  const startY = size/2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, size/2, startY + i * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
};

const StickyNote = ({ id, anchorParams, initialText = "Wish..." }: any) => {
  const groupRef = useRef<THREE.Group>(null!);
  
  // 全局状态
  const focusedNoteId = useTreeStore((state) => state.focusedNoteId);
  const setFocusedNoteId = useTreeStore((state) => state.setFocusedNoteId);
  const chaosFactor = useTreeStore((state) => state.chaosFactor);
  
  const isFocused = focusedNoteId === id;

  // 1. 原始树上位置
  const treePosition = useMemo(() => {
    const { radius, phi, theta } = anchorParams;
    return new THREE.Vector3().setFromSphericalCoords(radius + 0.5, phi, theta);
  }, [anchorParams]);

  // 2. 散开目标位置
  const scatterPosition = useMemo(() => {
    const v = new THREE.Vector3();
    v.setFromSphericalCoords(10 + Math.random() * 4, Math.acos(2 * Math.random() - 1), Math.random() * Math.PI * 2);
    return v;
  }, []);

  // 3. 🟢 生成一次纹理 (避免每帧重复计算)
  const cloudTexture = useMemo(() => createCloudTexture(initialText), [initialText]);

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
            // 判定距离 5.0
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
      
      // 飞到面前 8 米
      targetWorldPos.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(8));
      
      if (groupRef.current.parent) {
          groupRef.current.parent.worldToLocal(targetWorldPos);
      }

      groupRef.current.position.lerp(targetWorldPos, 0.2);
      
      // 🟢 关键：始终正对相机 (人)
      groupRef.current.lookAt(camera.position); 

    } else {
      currentFrameTarget.lerpVectors(treePosition, scatterPosition, chaosFactor * 0.3);
      groupRef.current.position.lerp(currentFrameTarget, 0.1);
      
      // 正常挂在树上时，背对圆心
      groupRef.current.lookAt(0, 0, 0); 
      groupRef.current.rotateY(Math.PI); 
    }
  });

  return (
    <group ref={groupRef}>
      {/* 🟢 修改：使用 PlaneGeometry 但配合透明纹理，看起来就像云朵 */}
      <mesh>
        <planeGeometry args={[3.5, 3.5]} /> {/* 尺寸加大 */}
        <meshBasicMaterial 
          map={cloudTexture} 
          transparent={true} 
          side={THREE.DoubleSide} 
          depthWrite={false} // 防止透明遮挡问题
        />
      </mesh>
    </group>
  );
};

export default StickyNote;