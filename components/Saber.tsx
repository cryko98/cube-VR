
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HandType } from '../types';

// Bypass intrinsic element type check for R3F tags
const GroupTag = 'group' as any;
const MeshTag = 'mesh' as any;
const CylinderGeometryTag = 'cylinderGeometry' as any;
const CapsuleGeometryTag = 'capsuleGeometry' as any;
const MeshStandardMaterialTag = 'meshStandardMaterial' as any;
const MeshBasicMaterialTag = 'meshBasicMaterial' as any;
const PointLightTag = 'pointLight' as any;

interface SaberProps {
  type: HandType;
  color: string;
  getPos: () => THREE.Vector3 | null;
  getVel: () => THREE.Vector3;
  posRef: React.MutableRefObject<THREE.Vector3 | null>;
  velRef: React.MutableRefObject<THREE.Vector3 | null>;
}

const Saber: React.FC<SaberProps> = ({ type, color, getPos, getVel }) => {
  const meshRef = useRef<THREE.Group>(null);
  const saberLength = 1.1; 

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const targetPos = getPos();
    const velocity = getVel();

    if (targetPos) {
      meshRef.current.visible = true;
      meshRef.current.position.lerp(targetPos, 0.6);
      
      const restingX = -Math.PI / 4;
      const restingZ = type === 'left' ? 0.3 : -0.3; 
      
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, restingX + velocity.y * 0.05, 0.2);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, restingZ - velocity.x * 0.05, 0.2);
    } else {
      meshRef.current.visible = false;
    }
  });

  return (
    <GroupTag ref={meshRef}>
      {/* Handle */}
      <MeshTag position={[0, -0.06, 0]}>
        <CylinderGeometryTag args={[0.02, 0.02, 0.15, 16]} />
        <MeshStandardMaterialTag color="#222" roughness={0.5} metalness={1} />
      </MeshTag>
      
      {/* Blade */}
      <MeshTag position={[0, 0.05 + saberLength / 2, 0]}>
        <CylinderGeometryTag args={[0.01, 0.01, saberLength, 12]} />
        <MeshBasicMaterialTag color="white" toneMapped={false} />
      </MeshTag>

      <MeshTag position={[0, 0.05 + saberLength / 2, 0]}>
        <CapsuleGeometryTag args={[0.025, saberLength, 16, 32]} />
        <MeshStandardMaterialTag 
          color={color} 
          emissive={color} 
          emissiveIntensity={5} 
          toneMapped={false} 
          transparent
          opacity={0.5}
        />
      </MeshTag>
      
      <PointLightTag color={color} intensity={2} distance={3} />
    </GroupTag>
  );
};

export default Saber;
