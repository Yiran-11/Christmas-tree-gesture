// src/store.ts
import { create } from 'zustand';
import * as THREE from 'three'; 

export type HandData = {
  position: THREE.Vector3;
  isPinching: boolean;
  isOpen: boolean;
};

interface TreeState {
  chaosFactor: number;
  handRotation: { x: number; y: number };
  hands: { left: HandData | null; right: HandData | null };
  focusedNoteId: number | null; 

  updateChaos: () => void;
  updateHands: (hands: { left: HandData | null; right: HandData | null } | null) => void;
  setHandData: (hand: 'left' | 'right', data: HandData | null) => void;
  setHandRotation: (rotation: { x: number; y: number }) => void;
  setDirectChaosFactor: (factor: number) => void;
  setFocusedNoteId: (id: number | null) => void;
}

export const useTreeStore = create<TreeState>((set) => ({
  chaosFactor: 0,
  handRotation: { x: 0, y: 0 },
  hands: { left: null, right: null },
  focusedNoteId: null,

  // 🟢 核心修改：让 Store 自己根据手势状态来计算炸裂效果
  updateChaos: () => set((state) => {
    // 1. 获取右手是否张开
    const isRightOpen = state.hands.right?.isOpen;
    
    // 2. 设定目标值：如果张开就是 1 (炸)，否则是 0 (收)
    //    (你也可以把这里改成 0.8 或 1.5 来调整炸开的程度)
    const targetChaos = isRightOpen ? 1.0 : 0.0;

    // 3. 平滑过渡 (Lerp)：让动画更流畅，而不是瞬间跳变
    return { 
      chaosFactor: THREE.MathUtils.lerp(state.chaosFactor, targetChaos, 0.1) 
    };
  }),

  // 🛡️ 防护：防止 null 导致崩溃
  updateHands: (payload) => set((state) => {
    if (!payload) return { hands: { left: null, right: null } };
    return { hands: { ...state.hands, left: payload.left, right: payload.right } };
  }),

  setHandData: (hand, data) => set((state) => ({
    hands: { ...state.hands, [hand]: data }
  })),

  setHandRotation: (rotation) => set({ handRotation: rotation }),

  // 兼容旧代码的直接设置
  setDirectChaosFactor: (factor) => set({ 
    chaosFactor: (typeof factor === 'number' && !isNaN(factor)) ? factor : 0 
  }),

  setFocusedNoteId: (id) => set({ focusedNoteId: id }),
}));