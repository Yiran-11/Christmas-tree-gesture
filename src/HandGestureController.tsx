import React, { useEffect, useRef } from 'react';
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { useTreeStore } from './store';

const HandGestureController = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const updateHands = useTreeStore((state) => state.updateHands);
  const setHandRotation = useTreeStore((state) => state.setHandRotation); 
  
  const updateHandsRef = useRef(updateHands);
  const setHandRotationRef = useRef(setHandRotation);
  
  // 用于平滑过渡速度
  const currentRotationRef = useRef(0.1); 

  useEffect(() => {
    updateHandsRef.current = updateHands;
    setHandRotationRef.current = setHandRotation;
  }, [updateHands, setHandRotation]);

  useEffect(() => {
    let gestureRecognizer: GestureRecognizer | null = null;
    let animationFrameId: number;
    let lastVideoTime = -1;

    const setup = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
        );
        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        startWebcam();
      } catch (error) {
        console.error("模型加载失败:", error);
      }
    };

    const startWebcam = () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: { width: 640, height: 480 } })
          .then((stream) => {
            if (videoRef.current) {
              videoRef.current.srcObject = stream;
              videoRef.current.onloadeddata = () => {
                videoRef.current!.play();
                predictWebcam();
              };
            }
          })
          .catch((err) => console.error('Webcam error:', err));
      }
    };

    // 画骨骼线 & 分区线
    const drawOverlay = (ctx: CanvasRenderingContext2D, landmarksList: any[]) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      // 1. 画中间的分区虚线
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]); // 重置实线

      // 2. 画文字标记
      ctx.font = "12px Arial";
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.fillText("左手区 (抓取)", 10, h - 10);
      ctx.fillText("右手区 (旋转&炸开)", w / 2 + 10, h - 10);

      // 3. 画手骨骼
      if (!landmarksList) return;
      const connections = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]];
      
      for (const landmarks of landmarksList) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00FF00'; 
        for (const [start, end] of connections) {
          const p1 = landmarks[start];
          const p2 = landmarks[end];
          ctx.beginPath();
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
          ctx.stroke();
        }
        ctx.fillStyle = 'red'; 
        for (const point of landmarks) {
          ctx.beginPath();
          ctx.arc(point.x * w, point.y * h, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    };

    const predictWebcam = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (!video || !gestureRecognizer || !canvas || video.videoWidth === 0) {
        animationFrameId = requestAnimationFrame(predictWebcam);
        return;
      }

      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      try {
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const results = gestureRecognizer.recognizeForVideo(video, Date.now());
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.scale(-1, 1);
            ctx.translate(-canvas.width, 0);
            
            // 绘制视觉辅助
            drawOverlay(ctx, results.landmarks);
          }

          let leftHand = null;
          let rightHand = null;
          
          // 默认目标速度：0.1 (非常慢的稳定自转)
          let targetSpeed = 0.1; 

          if (results.landmarks && results.landmarks.length > 0) {
            results.handedness.forEach((hand, index) => {
              const landmarks = results.landmarks[index];
              const label = hand[0].displayName; 
              
              // 基础坐标计算
              const x3D = (0.5 - landmarks[8].x) * 35; 
              const y3D = (0.5 - landmarks[8].y) * 25; 
              const position = new THREE.Vector3(x3D, y3D, 8); 

              const thumbTip = new THREE.Vector3(landmarks[4].x, landmarks[4].y, landmarks[4].z);
              const indexTip = new THREE.Vector3(landmarks[8].x, landmarks[8].y, landmarks[8].z);
              const wrist = new THREE.Vector3(landmarks[0].x, landmarks[0].y, landmarks[0].z);

              const pinchDist = thumbTip.distanceTo(indexTip);
              const isPinching = pinchDist < 0.08; 
              const extensionDist = indexTip.distanceTo(wrist);
              const isOpen = extensionDist > 0.15 && !isPinching;

              const handData = { position, isPinching, isOpen };

              // --- 1. 左手逻辑 ---
              if (label === 'Left') {
                leftHand = handData;
              }

              // --- 2. 右手逻辑 (控制旋转) ---
              if (label === 'Right') {
                rightHand = handData;
                
                // 获取手腕的 X 坐标 (0 ~ 1)
                // 镜像后：0.5 是中间，1.0 是最右边
                // 我们设定右侧区域的中心点为 "舒适区" (Neutral Zone) = 0.75
                const x = landmarks[0].x; 
                const neutralX = 0.75; 

                // 计算偏移量：手离 0.75 有多远
                // 如果手在 0.75，diff = 0 -> 速度 = 0.1 (默认慢速)
                // 如果手在 0.50 (偏左)，diff = -0.25 -> 速度减小，变成负数(左转)
                // 如果手在 1.00 (偏右)，diff = +0.25 -> 速度增加(右转)
                const diff = x - neutralX;

                // 灵敏度系数：值越小，变化越温柔
                const sensitivity = 1.5; 

                // 核心公式：基础慢速 + (偏移量 * 灵敏度)
                targetSpeed = 0.1 + (diff * sensitivity);
              }
            });
            
            if (ctx) ctx.restore();
          }

          // 平滑插值：让速度变化像流水一样，而不是瞬变
          currentRotationRef.current += (targetSpeed - currentRotationRef.current) * 0.05;

          updateHandsRef.current({ left: leftHand, right: rightHand });
          setHandRotationRef.current({ x: currentRotationRef.current, y: 0 });
        }
      } catch (e) {
        console.error(e);
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setup();
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (gestureRecognizer) gestureRecognizer.close();
    };
  }, []);

  return (
    <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 50 }}>
      <video
        ref={videoRef}
        style={{ width: '160px', height: '120px', borderRadius: '10px', transform: 'scaleX(-1)', objectFit: 'cover', opacity: 0.6 }}
        autoPlay muted playsInline
      />
      <canvas 
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '160px', height: '120px', transform: 'scaleX(-1)', pointerEvents: 'none' }}
      />
    </div>
  );
};

export default HandGestureController;