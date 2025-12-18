
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

const mapHandToWorld = (x: number, y: number): THREE.Vector3 => {
  const GAME_X_RANGE = 7; 
  const GAME_Y_RANGE = 4;
  const Y_OFFSET = 0.8;

  const worldX = (0.5 - x) * GAME_X_RANGE; 
  const worldY = (1.0 - y) * GAME_Y_RANGE - (GAME_Y_RANGE / 2) + Y_OFFSET;
  const worldZ = -Math.max(0, worldY * 0.1);

  return new THREE.Vector3(worldX, Math.max(0.1, worldY), worldZ);
};

export const useMediaPipe = (videoRef: React.RefObject<HTMLVideoElement | null>, detectionThreshold: number = 0.4) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const handPositionsRef = useRef({
    p1Left: null as THREE.Vector3 | null,
    p1Right: null as THREE.Vector3 | null,
    p2Left: null as THREE.Vector3 | null,
    p2Right: null as THREE.Vector3 | null,
    p1LeftVelocity: new THREE.Vector3(0,0,0),
    p1RightVelocity: new THREE.Vector3(0,0,0),
    p2LeftVelocity: new THREE.Vector3(0,0,0),
    p2RightVelocity: new THREE.Vector3(0,0,0),
    lastTimestamp: performance.now()
  });

  const lastResultsRef = useRef<HandLandmarkerResult | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  const toggleCamera = useCallback(() => {
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
      setIsCameraReady(false);
  }, []);

  useEffect(() => {
    let isActive = true;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        if (!isActive) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 4,
          minHandDetectionConfidence: detectionThreshold,
          minHandPresenceConfidence: detectionThreshold,
          minTrackingConfidence: detectionThreshold
        });

        if (!isActive) {
             landmarker.close();
             return;
        }

        landmarkerRef.current = landmarker;
        await startCamera();
      } catch (err: any) {
        if (isActive) {
            console.error("MediaPipe error:", err);
            setError(`Hiba a kézkövető motor betöltésekor. Kérlek ellenőrizd az internetkapcsolatot.`);
        }
      }
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });

        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             if (isActive) {
                 videoRef.current?.play().then(() => {
                     setIsCameraReady(true);
                     predictWebcam();
                 }).catch(e => {
                     setError("A kamera lejátszása blokkolva van. Kattints a képernyőre!");
                 });
             }
          };
        }
      } catch (err: any) {
        if (isActive) {
            setError(`Kamera hozzáférés megtagadva. Kérlek engedélyezd a kamerát a böngészőben!`);
        }
      }
    };

    const predictWebcam = () => {
        if (!videoRef.current || !landmarkerRef.current || !isActive) return;
        const video = videoRef.current;
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
             const startTimeMs = performance.now();
             try {
                 const results = landmarkerRef.current.detectForVideo(video, startTimeMs);
                 lastResultsRef.current = results;
                 processResults(results);
             } catch (e) {
                 // Skip frame error
             }
        }
        requestRef.current = requestAnimationFrame(predictWebcam);
    };

    const processResults = (results: HandLandmarkerResult) => {
        const now = performance.now();
        const deltaTime = (now - handPositionsRef.current.lastTimestamp) / 1000;
        handPositionsRef.current.lastTimestamp = now;

        const s = handPositionsRef.current;
        const LERP = 0.5;
        const nextHands = { p1L: null, p1R: null, p2L: null, p2R: null };

        if (results.landmarks) {
          results.landmarks.forEach((landmarks, i) => {
            if (!results.handedness || !results.handedness[i]) return;
            const classification = results.handedness[i][0];
            const isPhysicalRight = classification.categoryName === 'Right';
            const tip = landmarks[8];
            const worldPos = mapHandToWorld(tip.x, tip.y);

            if (tip.x > 0.5) {
                if (isPhysicalRight) nextHands.p1R = worldPos as any;
                else nextHands.p1L = worldPos as any;
            } else {
                if (isPhysicalRight) nextHands.p2R = worldPos as any;
                else nextHands.p2L = worldPos as any;
            }
          });
        }

        const updateHand = (current: THREE.Vector3 | null, next: THREE.Vector3 | null, velocity: THREE.Vector3) => {
            if (next) {
                if (current) {
                    next.lerpVectors(current, next as any, LERP);
                    if (deltaTime > 0) velocity.subVectors(next as any, current).divideScalar(deltaTime);
                }
                return next;
            }
            return null;
        };

        s.p1Left = updateHand(s.p1Left, nextHands.p1L, s.p1LeftVelocity) as any;
        s.p1Right = updateHand(s.p1Right, nextHands.p1R, s.p1RightVelocity) as any;
        s.p2Left = updateHand(s.p2Left, nextHands.p2L, s.p2LeftVelocity) as any;
        s.p2Right = updateHand(s.p2Right, nextHands.p2R, s.p2RightVelocity) as any;
    };

    setupMediaPipe();

    return () => {
      isActive = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (landmarkerRef.current) landmarkerRef.current.close();
      if (videoRef.current && videoRef.current.srcObject) {
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [videoRef, facingMode, detectionThreshold]);

  return { isCameraReady, handPositionsRef, lastResultsRef, error, toggleCamera, facingMode };
};
