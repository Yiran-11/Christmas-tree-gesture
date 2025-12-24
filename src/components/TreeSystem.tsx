import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import StickyNote from './StickyNote';

const TreeSystem = () => {
  const groupRef = useRef<THREE.Group>(null!);

  // 生成 12 个便签的数据
  const notesData = useMemo(() => {
    const count = 12;
    const radius = 2.6; // 树半径 (比球体稍大一点，悬浮感)

    return new Array(count).fill(0).map((_, i) => {
      // 斐波那契球体分布算法 (让便签均匀散布)
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      
      return {
        id: i,
        // 这里就是截图建议的 "Anchor Params"
        anchorParams: {
          radius,
          phi,
          theta
        },
        initialText: `愿望 ${i + 1}`
      };
    });
  }, []);

  // 树的自转动画
  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1; 
    }
  });

  return (
    // 这个 group 就是整棵树
    <group ref={groupRef}>
      
      {/* 树的核心 (球体) */}
      <mesh>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.8} />
      </mesh>

      {/* 渲染所有的便签 */}
      {notesData.map((note) => (
        <StickyNote 
          key={note.id}
          id={note.id}
          anchorParams={note.anchorParams}
          initialText={note.initialText}
        />
      ))}

    </group>
  );
};

export default TreeSystem;