
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { CutDirection, NoteData, PlayerId, SongData } from "./types";
import * as THREE from 'three';

// Game World Config
export const TRACK_LENGTH = 50;
export const SPAWN_Z = -35;
export const PLAYER_Z = 0;
export const MISS_Z = 5;
export const NOTE_SPEED = 12; 

export const LANE_WIDTH = 0.7;
export const LAYER_HEIGHT = 0.8;
export const NOTE_SIZE = 0.45;

// Positions for lanes. 1P uses central lanes. 2P split screen style.
export const LANE_X_POSITIONS_P1 = [-2.2, -1.5, -0.8, -0.1];
export const LANE_X_POSITIONS_P2 = [0.1, 0.8, 1.5, 2.2];
export const LANE_X_POSITIONS_SINGLE = [-1.5 * LANE_WIDTH, -0.5 * LANE_WIDTH, 0.5 * LANE_WIDTH, 1.5 * LANE_WIDTH];

export const LAYER_Y_POSITIONS = [0.8, 1.6, 2.4]; 

// Available Songs
export const SONGS: SongData[] = [
  {
    id: 'cyber-racer',
    title: 'Cyber Racer',
    artist: 'RetroFuture',
    url: 'https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race2.ogg',
    bpm: 140
  },
  {
    id: 'synth-pulse',
    title: 'Synth Pulse',
    artist: 'Neon Wave',
    url: 'https://commondatastorage.googleapis.com/codeskulptor-assets/EvS_Song_2.mp3',
    bpm: 130
  },
  {
    id: 'collision',
    title: 'Collision Force',
    artist: 'Delta Sector',
    url: 'https://commondatastorage.googleapis.com/codeskulptor-assets/CollisionXmas76877_Action_Music.mp3',
    bpm: 128
  }
];

export const generateDemoChart = (playerCount: number, bpm: number): NoteData[] => {
  const notes: NoteData[] = [];
  let idCount = 0;
  const beatTime = 60 / bpm;

  // Generate ~120 beats of notes
  for (let i = 4; i < 240; i += 2) {
    const time = i * beatTime;
    const players: PlayerId[] = playerCount === 2 ? [1, 2] : [1];

    players.forEach(pId => {
        const pattern = Math.floor(i / 8) % 3;
        if (pattern === 0) {
            notes.push({
                id: `note-${idCount++}`,
                time: time,
                lineIndex: (i % 4),
                lineLayer: 0,
                type: (i % 4 < 2 ? 'left' : 'right'),
                playerId: pId,
                cutDirection: CutDirection.ANY
            });
        } else if (pattern === 1) {
             if (i % 4 === 0) {
                 notes.push({
                    id: `note-${idCount++}`,
                    time: time,
                    lineIndex: 1,
                    lineLayer: 1,
                    type: 'left',
                    playerId: pId,
                    cutDirection: CutDirection.ANY
                });
                notes.push({
                    id: `note-${idCount++}`,
                    time: time,
                    lineIndex: 2,
                    lineLayer: 1,
                    type: 'right',
                    playerId: pId,
                    cutDirection: CutDirection.ANY
                });
             }
        } else {
             notes.push({
                id: `note-${idCount++}`,
                time: time,
                lineIndex: (i % 2 === 0 ? 0 : 3),
                lineLayer: (i % 3),
                type: (i % 2 === 0 ? 'left' : 'right'),
                playerId: pId,
                cutDirection: CutDirection.ANY
            });
        }
    });
  }

  return notes.sort((a, b) => a.time - b.time);
};

export const DIRECTION_VECTORS: Record<CutDirection, THREE.Vector3> = {
  [CutDirection.UP]: new THREE.Vector3(0, 1, 0),
  [CutDirection.DOWN]: new THREE.Vector3(0, -1, 0),
  [CutDirection.LEFT]: new THREE.Vector3(-1, 0, 0),
  [CutDirection.RIGHT]: new THREE.Vector3(1, 0, 0),
  [CutDirection.ANY]: new THREE.Vector3(0, 0, 0)
};
