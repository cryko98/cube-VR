
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Grid, PerspectiveCamera, Stars, Box } from '@react-three/drei';
import * as THREE from 'three';
import { GameStatus, NoteData, HandPositions, COLORS } from '../types';
import { PLAYER_Z, SPAWN_Z, MISS_Z, NOTE_SPEED, LANE_X_POSITIONS_P1, LANE_X_POSITIONS_P2, LANE_X_POSITIONS_SINGLE, LAYER_Y_POSITIONS } from '../constants';
import Note from './Note';
import Saber from './Saber';

// Bypass intrinsic element type check for R3F tags
const ColorTag = 'color' as any;
const FogTag = 'fog' as any;
const AmbientLightTag = 'ambientLight' as any;
const PointLightTag = 'pointLight' as any;
const GroupTag = 'group' as any;
const MeshBasicMaterialTag = 'meshBasicMaterial' as any;

interface GameSceneProps {
  gameStatus: GameStatus;
  audioRef: React.RefObject<HTMLAudioElement>;
  handPositionsRef: React.MutableRefObject<any>;
  chart: NoteData[];
  playerCount: number;
  bpm: number;
  onNoteHit: (note: NoteData, goodCut: boolean) => void;
  onNoteMiss: (note: NoteData) => void;
  onSongEnd: () => void;
  onRegistered?: () => void;
}

const GameScene: React.FC<GameSceneProps> = ({ 
    gameStatus, audioRef, handPositionsRef, chart, playerCount, bpm, onNoteHit, onNoteMiss, onSongEnd, onRegistered
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const activeNotesRef = useRef<NoteData[]>([]);
  const nextNoteIndexRef = useRef(0);
  const shakeIntensity = useRef(0);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);

  const beatTime = 60 / bpm;

  // Calibration/Registration tracking state
  const [regStatus, setRegStatus] = useState({ p1L: 0, p1R: 0, p2L: 0, p2R: 0 });

  // Saber refs - Defined at top level to satisfy React Hook rules
  const p1LPos = useRef<THREE.Vector3>(null);
  const p1LVel = useRef<THREE.Vector3>(null);
  const p1RPos = useRef<THREE.Vector3>(null);
  const p1RVel = useRef<THREE.Vector3>(null);
  const p2LPos = useRef<THREE.Vector3>(null);
  const p2LVel = useRef<THREE.Vector3>(null);
  const p2RPos = useRef<THREE.Vector3>(null);
  const p2RVel = useRef<THREE.Vector3>(null);

  const vecA = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const hands = handPositionsRef.current as HandPositions;

    // Calibration Phase Logic
    if (gameStatus === GameStatus.REGISTRATION) {
        const checkInZone = (pos: THREE.Vector3 | null, targetX: number, targetY: number) => {
            if (!pos) return false;
            return pos.distanceTo(vecA.set(targetX, targetY, 0)) < 0.6;
        };

        setRegStatus(prev => {
            const next = { ...prev };
            const speed = delta * 1.5;
            
            next.p1L = checkInZone(hands.p1Left, -1.5, 1.5) ? Math.min(1, next.p1L + speed) : Math.max(0, next.p1L - speed);
            next.p1R = checkInZone(hands.p1Right, -0.5, 1.5) ? Math.min(1, next.p1R + speed) : Math.max(0, next.p1R - speed);
            
            if (playerCount === 2) {
                next.p2L = checkInZone(hands.p2Left, 0.5, 1.5) ? Math.min(1, next.p2L + speed) : Math.max(0, next.p2L - speed);
                next.p2R = checkInZone(hands.p2Right, 1.5, 1.5) ? Math.min(1, next.p2R + speed) : Math.max(0, next.p2R - speed);
            } else {
                next.p2L = 1; next.p2R = 1; // Auto-pass for player 2 in solo
            }

            if (next.p1L === 1 && next.p1R === 1 && next.p2L === 1 && next.p2R === 1) {
                if (onRegistered) setTimeout(onRegistered, 500);
            }
            return next;
        });
    }

    // Dynamic Environment Lighting (Beat Pulse)
    if (audioRef.current && gameStatus === GameStatus.PLAYING) {
        const time = audioRef.current.currentTime;
        const pulse = Math.pow(1 - ((time % beatTime) / beatTime), 4); 
        if (ambientLightRef.current) ambientLightRef.current.intensity = 0.2 + (pulse * 0.4);
    }

    // Impact Visual Feedback (Screen Shake)
    if (shakeIntensity.current > 0 && cameraRef.current) {
        cameraRef.current.position.x = (Math.random() - 0.5) * shakeIntensity.current;
        cameraRef.current.position.y = 1.8 + (Math.random() - 0.5) * shakeIntensity.current;
        shakeIntensity.current = THREE.MathUtils.lerp(shakeIntensity.current, 0, 10 * delta);
        if (shakeIntensity.current < 0.01) cameraRef.current.position.set(0, 1.8, 4);
    }

    if (gameStatus !== GameStatus.PLAYING || !audioRef.current) return;

    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    if (audioRef.current.ended) { onSongEnd(); return; }

    // Chart Management: Spawning incoming notes
    const spawnAheadTime = Math.abs(SPAWN_Z - PLAYER_Z) / NOTE_SPEED;
    while (nextNoteIndexRef.current < chart.length) {
      const nextNote = chart[nextNoteIndexRef.current];
      if (nextNote.time - spawnAheadTime <= time) {
        activeNotesRef.current.push(nextNote);
        nextNoteIndexRef.current++;
      } else break;
    }

    // Hit Detection Processing
    for (let i = activeNotesRef.current.length - 1; i >= 0; i--) {
        const note = activeNotesRef.current[i];
        if (note.hit || note.missed) continue;

        const currentZ = PLAYER_Z - ((note.time - time) * NOTE_SPEED);
        if (currentZ > MISS_Z) {
            note.missed = true;
            onNoteMiss(note);
            activeNotesRef.current.splice(i, 1);
            continue;
        }

        // Logic for interaction window
        if (currentZ > PLAYER_Z - 1.5 && currentZ < PLAYER_Z + 1.0) {
            const hPos = note.playerId === 1 
                ? (note.type === 'left' ? hands.p1Left : hands.p1Right)
                : (note.type === 'left' ? hands.p2Left : hands.p2Right);

            if (hPos) {
                 let xPos = 0;
                 if (playerCount === 1) xPos = LANE_X_POSITIONS_SINGLE[note.lineIndex];
                 else xPos = note.playerId === 1 ? LANE_X_POSITIONS_P1[note.lineIndex] : LANE_X_POSITIONS_P2[note.lineIndex];

                 const notePos = vecA.set(xPos, LAYER_Y_POSITIONS[note.lineLayer], currentZ);

                 if (hPos.distanceTo(notePos) < 0.8) {
                     note.hit = true;
                     note.hitTime = time;
                     shakeIntensity.current = 0.2;
                     onNoteHit(note, true);
                     activeNotesRef.current.splice(i, 1);
                 }
            }
        }
    }
  });

  const visibleNotes = useMemo(() => {
     // Notes stay in list for 0.8s after hit to render feedback animations
     return chart.filter(n => !n.missed && (!n.hit || (currentTime - (n.hitTime || 0) < 0.8)) && (n.time - currentTime) < 6 && (n.time - currentTime) > -1);
  }, [chart, currentTime]);

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.8, 4]} fov={60} />
      <ColorTag attach="background" args={['#020202']} />
      <FogTag attach="fog" args={['#020202', 15, 45]} />
      <AmbientLightTag ref={ambientLightRef} intensity={0.2} />
      <PointLightTag position={[0, 5, 2]} intensity={2} />
      <Environment preset="night" />

      <Grid position={[0, 0, 0]} args={[12, 100]} cellThickness={0.1} cellColor="#222" sectionColor="#444" fadeDistance={50} infiniteGrid />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      {/* Visual Calibration Zones */}
      {gameStatus === GameStatus.REGISTRATION && (
          <GroupTag>
              <Box position={[-1.5, 1.5, 0]} args={[0.8, 0.8, 0.1]}>
                  <MeshBasicMaterialTag color={COLORS.p1Left} transparent opacity={0.2 + regStatus.p1L * 0.5} />
              </Box>
              <Box position={[-0.5, 1.5, 0]} args={[0.8, 0.8, 0.1]}>
                  <MeshBasicMaterialTag color={COLORS.p1Right} transparent opacity={0.2 + regStatus.p1R * 0.5} />
              </Box>
              {playerCount === 2 && (
                  <>
                    <Box position={[0.5, 1.5, 0]} args={[0.8, 0.8, 0.1]}>
                        <MeshBasicMaterialTag color={COLORS.p2Left} transparent opacity={0.2 + regStatus.p2L * 0.5} />
                    </Box>
                    <Box position={[1.5, 1.5, 0]} args={[0.8, 0.8, 0.1]}>
                        <MeshBasicMaterialTag color={COLORS.p2Right} transparent opacity={0.2 + regStatus.p2R * 0.5} />
                    </Box>
                  </>
              )}
          </GroupTag>
      )}

      {/* Interactive Sabers */}
      <Saber type="left" color={COLORS.p1Left} posRef={p1LPos} velRef={p1LVel} getPos={() => handPositionsRef.current.p1Left} getVel={() => handPositionsRef.current.p1LeftVelocity} />
      <Saber type="right" color={COLORS.p1Right} posRef={p1RPos} velRef={p1RVel} getPos={() => handPositionsRef.current.p1Right} getVel={() => handPositionsRef.current.p1RightVelocity} />
      
      {playerCount === 2 && (
          <>
            <Saber type="left" color={COLORS.p2Left} posRef={p2LPos} velRef={p2LVel} getPos={() => handPositionsRef.current.p2Left} getVel={() => handPositionsRef.current.p2LeftVelocity} />
            <Saber type="right" color={COLORS.p2Right} posRef={p2RPos} velRef={p2RVel} getPos={() => handPositionsRef.current.p2Right} getVel={() => handPositionsRef.current.p2RightVelocity} />
          </>
      )}

      {gameStatus === GameStatus.PLAYING && visibleNotes.map(note => (
          <Note 
            key={note.id} 
            data={note} 
            zPos={PLAYER_Z - ((note.time - currentTime) * NOTE_SPEED)} 
            currentTime={currentTime}
            playerCount={playerCount}
          />
      ))}
    </>
  );
};

export default GameScene;
