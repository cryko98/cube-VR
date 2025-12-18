
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import * as THREE from 'three';

export enum GameStatus {
  LOADING = 'LOADING',
  IDLE = 'IDLE',
  REGISTRATION = 'REGISTRATION',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export type HandType = 'left' | 'right';
export type PlayerId = 1 | 2;

// 0: Up, 1: Down, 2: Left, 3: Right, 4: Any (Dot)
export enum CutDirection {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3,
  ANY = 4
}

export interface SongData {
  id: string;
  title: string;
  artist: string;
  url: string;
  bpm: number;
}

export interface NoteData {
  id: string;
  time: number;     // Time in seconds when it should reach the player
  lineIndex: number; // 0-3 (horizontal position)
  lineLayer: number; // 0-2 (vertical position)
  type: HandType;    // which hand should cut it
  playerId: PlayerId; // which player should hit it
  cutDirection: CutDirection;
  hit?: boolean;
  missed?: boolean;
  hitTime?: number; // Time when hit occurred
}

export interface HandPositions {
  p1Left: THREE.Vector3 | null;
  p1Right: THREE.Vector3 | null;
  p2Left: THREE.Vector3 | null;
  p2Right: THREE.Vector3 | null;
  p1LeftVelocity: THREE.Vector3;
  p1RightVelocity: THREE.Vector3;
  p2LeftVelocity: THREE.Vector3;
  p2RightVelocity: THREE.Vector3;
}

export const COLORS = {
  p1Left: '#ef4444',  // Red
  p1Right: '#3b82f6', // Blue
  p2Left: '#10b981',  // Green
  p2Right: '#f59e0b', // Orange
  track: '#111111',
  hittable: '#ffffff'
};
