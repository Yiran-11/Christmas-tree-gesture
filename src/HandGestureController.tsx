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
            modelAssetPath: './gesture_recognizer.task',
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

    const drawOverlay = (ctx: CanvasRenderingContext2D, landmarksList: any[]) => {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;

      // 1. 画分区线
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]); 

      // 2. 文字标记 (加亮)
      ctx.font = "bold 14px Arial";
      ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
      ctx.shadowColor = "black";
      ctx.shadowBlur = 4;
      ctx.fillText("左手区 (抓取)", 10, h - 10);
      ctx.fillText("右手区 (旋转&炸开)", w / 2 + 10, h - 10);

      // 3. 画骨骼 (加粗)
      if (!landmarksList) return;
      const connections = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]];
      
      for (const landmarks of landmarksList) {
        // 🟢 修改：线宽从 2 改为 3，颜色更亮
        ctx.lineWidth = 3;
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
          ctx.arc(point.x * w, point.y * h, 4, 0, 2 * Math.PI); // 点也变大一点
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
            drawOverlay(ctx, results.landmarks);
          }

          let leftHand = null;
          let rightHand = null;
          // 🟢 修改：默认自转速度降低 (从 0.1 -> 0.05)
          let targetSpeed = 0.05; 

          if (results.landmarks && results.landmarks.length > 0) {
            results.handedness.forEach((hand, index) => {
              const landmarks = results.landmarks[index];
              const label = hand[0].displayName; 
              
              const x3D = (landmarks[8].x - 0.5) * 35; 
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

              if (label === 'Left') {
                leftHand = handData;
              }

              if (label === 'Right') {
                rightHand = handData;
                const rawX = landmarks[0].x; 
                // 🟢 修改：大幅降低手势旋转的灵敏度 (从 1.5 -> 0.8)
                // 这样树转起来会更沉稳，不那么晕
                if (rawX < 0.4) {
                   const factor = (0.4 - rawX) / 0.4; 
                   targetSpeed = -0.8 * factor; 
                } 
                else if (rawX > 0.6) {
                   const factor = (rawX - 0.6) / 0.4;
                   targetSpeed = 0.8 * factor; 
                }
              }
            });
          }

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
      {/* 🟢 修改：Opacity 设为 1.0，完全清晰 */}
      <video
        ref={videoRef}
        style={{ width: '160px', height: '120px', borderRadius: '10px', objectFit: 'cover', opacity: 1.0, border: '2px solid rgba(255,255,255,0.3)' }}
        autoPlay muted playsInline
      />
      <canvas 
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '160px', height: '120px', pointerEvents: 'none' }}
      />
    </div>
  );
};

export default HandGestureController;