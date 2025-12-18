
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useMemo, useRef } from 'react';
import { Box, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NoteData, COLORS } from '../types';
import { LANE_X_POSITIONS_P1, LANE_X_POSITIONS_P2, LANE_X_POSITIONS_SINGLE, LAYER_Y_POSITIONS, NOTE_SIZE } from '../constants';

// Bypass intrinsic element type check for R3F tags
const GroupTag = 'group' as any;
const MeshTag = 'mesh' as any;
const BoxGeometryTag = 'boxGeometry' as any;
const SphereGeometryTag = 'sphereGeometry' as any;
const MeshStandardMaterialTag = 'meshStandardMaterial' as any;
const MeshPhysicalMaterialTag = 'meshPhysicalMaterial' as any;
const MeshBasicMaterialTag = 'meshBasicMaterial' as any;

interface NoteProps {
  data: NoteData;
  zPos: number;
  currentTime: number;
  playerCount: number;
}

const ScoreFeedback: React.FC<{ timeSinceHit: number, accuracy: number }> = ({ timeSinceHit, accuracy }) => {
    const textRef = useRef<THREE.Group>(null);
    
    const rating = useMemo(() => {
        const absAcc = Math.abs(accuracy);
        // Timing accuracy rating thresholds (in seconds)
        if (absAcc < 0.08) return { text: 'PERFECT', color: '#ffea00' };
        if (absAcc < 0.15) return { text: 'GREAT', color: '#00ffcc' };
        return { text: 'GOOD', color: '#ffffff' };
    }, [accuracy]);

    useFrame(() => {
        if (textRef.current) {
            // Float up effect
            textRef.current.position.y = 0.8 + timeSinceHit * 1.5;
            // Face the camera slightly tilted for better readability
            textRef.current.rotation.x = -Math.PI / 8;
        }
    });

    const opacity = Math.max(0, 1 - timeSinceHit * 1.5);

    return (
        <GroupTag ref={textRef}>
            <Text
                fontSize={0.35}
                color={rating.color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#000000"
                font="https://fonts.gstatic.com/s/orbitron/v31/y97pyXat_SY9iS0E6uM45B-W.woff"
            >
                {rating.text}
                {/* Fixed: Use MeshBasicMaterialTag instead of meshBasicMaterial to satisfy type checking */}
                <MeshBasicMaterialTag transparent opacity={opacity} depthTest={false} toneMapped={false} />
            </Text>
        </GroupTag>
    );
};

const ExplosionEffect: React.FC<{ timeSinceHit: number, color: string }> = ({ timeSinceHit, color }) => {
    const groupRef = useRef<THREE.Group>(null);
    const particleCount = 12;
    
    // Create random directions and rotations for particles once
    const particles = useMemo(() => {
        return [...Array(particleCount)].map(() => ({
            direction: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize(),
            speed: 4 + Math.random() * 6,
            rotationSpeed: (Math.random() - 0.5) * 10,
            size: 0.05 + Math.random() * 0.15
        }));
    }, []);

    const flashDuration = 0.25;
    const particleDuration = 0.5;

    useFrame(() => {
        if (groupRef.current) {
            const scale = Math.max(0.01, 1 - timeSinceHit / particleDuration);
            groupRef.current.scale.setScalar(scale);
        }
    });

    // Flash expanding core
    const flashProgress = Math.min(1, timeSinceHit / flashDuration);
    const flashScale = 0.1 + flashProgress * 4;
    const flashOpacity = 1 - flashProgress;

    return (
        <GroupTag ref={groupRef}>
            {/* Initial Hit Flash */}
            {timeSinceHit < flashDuration && (
                <MeshTag scale={[flashScale, flashScale, flashScale]}>
                    <SphereGeometryTag args={[0.5, 16, 16]} />
                    <MeshBasicMaterialTag 
                        color="white" 
                        transparent 
                        opacity={flashOpacity * 0.8} 
                        toneMapped={false} 
                    />
                </MeshTag>
            )}

            {/* Flying Debris Particles */}
            {particles.map((p, i) => {
                const distance = p.speed * timeSinceHit;
                const pos = p.direction.clone().multiplyScalar(distance);
                const rotation = p.rotationSpeed * timeSinceHit;
                
                return (
                    <MeshTag 
                        key={i} 
                        position={[pos.x, pos.y, pos.z]} 
                        rotation={[rotation, rotation, rotation]}
                    >
                        <BoxGeometryTag args={[p.size, p.size, p.size]} />
                        <MeshStandardMaterialTag 
                            color={color} 
                            emissive={color} 
                            emissiveIntensity={2} 
                            toneMapped={false}
                        />
                    </MeshTag>
                );
            })}
        </GroupTag>
    );
};

const Note: React.FC<NoteProps> = ({ data, zPos, currentTime, playerCount }) => {
  const color = data.playerId === 1 
    ? (data.type === 'left' ? COLORS.p1Left : COLORS.p1Right)
    : (data.type === 'left' ? COLORS.p2Left : COLORS.p2Right);
  
  const position: [number, number, number] = useMemo(() => {
     const pId = data.playerId;
     const lIdx = data.lineIndex;
     const lLayer = data.lineLayer;
     
     let finalX = 0;
     if (playerCount === 1) {
       finalX = LANE_X_POSITIONS_SINGLE[lIdx];
     } else {
       finalX = pId === 1 ? LANE_X_POSITIONS_P1[lIdx] : LANE_X_POSITIONS_P2[lIdx];
     }

     return [finalX, LAYER_Y_POSITIONS[lLayer], zPos];
  }, [data.lineIndex, data.lineLayer, zPos, data.playerId, playerCount]);

  if (data.missed) return null;

  if (data.hit && data.hitTime) {
      const timeSinceHit = currentTime - data.hitTime;
      // Note stays alive for 0.8s to show feedback
      if (timeSinceHit > 0.8) return null; 
      
      return (
        <GroupTag position={position}>
            <ExplosionEffect timeSinceHit={timeSinceHit} color={color} />
            <ScoreFeedback timeSinceHit={timeSinceHit} accuracy={data.hitTime - data.time} />
        </GroupTag>
      );
  }

  return (
    <GroupTag position={position}>
      {/* Cube Body */}
      <Box args={[NOTE_SIZE, NOTE_SIZE, NOTE_SIZE]} castShadow receiveShadow>
        <MeshPhysicalMaterialTag 
            color={color} 
            roughness={0.1} 
            metalness={0.8}
            emissive={color}
            emissiveIntensity={0.6}
        />
      </Box>
      
      {/* Inner Glow Core */}
      <MeshTag position={[0, 0, 0]}>
         <BoxGeometryTag args={[NOTE_SIZE * 0.4, NOTE_SIZE * 0.4, NOTE_SIZE * 0.4]} />
         <MeshBasicMaterialTag color="white" toneMapped={false} />
      </MeshTag>

      {/* Frame for extra contrast */}
      <Box args={[NOTE_SIZE * 1.05, NOTE_SIZE * 1.05, NOTE_SIZE * 1.05]}>
         <MeshBasicMaterialTag color={color} wireframe transparent opacity={0.4} />
      </Box>
    </GroupTag>
  );
};

export default React.memo(Note);
