
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useEffect, useRef } from 'react';
import { HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { COLORS } from '../types';

interface WebcamPreviewProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    resultsRef: React.MutableRefObject<HandLandmarkerResult | null>;
    isCameraReady: boolean;
}

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], 
    [0, 5], [5, 6], [6, 7], [7, 8], 
    [0, 9], [9, 10], [10, 11], [11, 12], 
    [0, 13], [13, 14], [14, 15], [15, 16], 
    [0, 17], [17, 18], [18, 19], [19, 20], 
    [5, 9], [9, 13], [13, 17], [0, 5], [0, 17]
];

const WebcamPreview: React.FC<WebcamPreviewProps> = ({ videoRef, resultsRef, isCameraReady }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isCameraReady) return;
        let animationFrameId: number;

        const render = () => {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (canvas && video && video.readyState >= 2) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
                    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.translate(-canvas.width, 0);
                    ctx.globalAlpha = 0.5;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    ctx.restore();

                    if (resultsRef.current?.landmarks) {
                        resultsRef.current.landmarks.forEach((landmarks, i) => {
                            const handedness = resultsRef.current!.handedness[i][0];
                            const isPhysicalRight = handedness.categoryName === 'Right';
                            const tipX = landmarks[8].x;
                            
                            // Map to colors: Split screen logic
                            let color = 'white';
                            if (tipX > 0.5) color = isPhysicalRight ? COLORS.p1Right : COLORS.p1Left;
                            else color = isPhysicalRight ? COLORS.p2Right : COLORS.p2Left;

                            ctx.strokeStyle = color;
                            ctx.lineWidth = 4;
                            ctx.beginPath();
                            for (const [start, end] of HAND_CONNECTIONS) {
                                const p1 = landmarks[start];
                                const p2 = landmarks[end];
                                ctx.moveTo((1 - p1.x) * canvas.width, p1.y * canvas.height);
                                ctx.lineTo((1 - p2.x) * canvas.width, p2.y * canvas.height);
                            }
                            ctx.stroke();
                        });
                    }
                }
            }
            animationFrameId = requestAnimationFrame(render);
        };
        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, [isCameraReady, videoRef, resultsRef]);

    if (!isCameraReady) return null;

    return (
        <div className="fixed top-4 right-4 w-48 h-36 bg-black/60 border border-white/20 rounded-2xl overflow-hidden backdrop-blur-md z-50 pointer-events-none">
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 py-1 bg-black/40 text-[8px] text-center uppercase tracking-widest opacity-50">Sync Active</div>
        </div>
    );
};

export default WebcamPreview;
