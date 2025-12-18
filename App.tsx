
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameStatus, NoteData, SongData } from './types';
import { generateDemoChart, SONGS } from './constants';
import { useMediaPipe } from './hooks/useMediaPipe';
import GameScene from './components/GameScene';
import WebcamPreview from './components/WebcamPreview';
import { Play, RefreshCw, Users, Tv, Camera, ChevronRight, Sliders, Music } from 'lucide-react';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOADING);
  const [playerCount, setPlayerCount] = useState<1 | 2>(1);
  const [selectedSong, setSelectedSong] = useState<SongData>(SONGS[0]);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [combo, setCombo] = useState({ p1: 0, p2: 0 });
  const [health, setHealth] = useState(100);
  const [chart, setChart] = useState<NoteData[]>([]);
  const [detectionThreshold, setDetectionThreshold] = useState(0.4);

  const audioRef = useRef<HTMLAudioElement>(new Audio(selectedSong.url));
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { isCameraReady, handPositionsRef, lastResultsRef, toggleCamera } = useMediaPipe(videoRef, detectionThreshold);

  // Sync audio source with selected song
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = selectedSong.url;
      audioRef.current.load();
    }
  }, [selectedSong]);

  const handleNoteHit = useCallback((note: NoteData) => {
     if (navigator.vibrate) navigator.vibrate(30);

     if (note.playerId === 1) {
         setScores(s => ({ ...s, p1: s.p1 + 100 }));
         setCombo(c => ({ ...c, p1: c.p1 + 1 }));
     } else {
         setScores(s => ({ ...s, p2: s.p2 + 100 }));
         setCombo(c => ({ ...c, p2: c.p2 + 1 }));
     }
     setHealth(h => Math.min(100, h + 1));
  }, []);

  const handleNoteMiss = useCallback((note: NoteData) => {
      if (note.playerId === 1) setCombo(c => ({ ...c, p1: 0 }));
      else setCombo(c => ({ ...c, p2: 0 }));
      setHealth(h => {
          const newHealth = h - 10;
          if (newHealth <= 0) {
             setTimeout(() => endGame(), 0);
             return 0;
          }
          return newHealth;
      });
  }, []);

  const castToTV = async () => {
      try {
          const nav = navigator as any;
          const win = window as any;
          
          if (nav.mediaRouter && typeof nav.mediaRouter.createPresentationRequest === 'function') {
              const request = nav.mediaRouter.createPresentationRequest([win.location.href]);
              await request.start();
              return;
          }

          if (nav.presentation) {
              if (nav.presentation.defaultRequest) {
                  await nav.presentation.defaultRequest.start();
                  return;
              } else if (win.PresentationRequest) {
                  const request = new win.PresentationRequest([win.location.href]);
                  await request.start();
                  return;
              }
          }

          if (document.fullscreenElement) {
              await document.exitFullscreen();
          } else {
              await document.documentElement.requestFullscreen();
          }
          alert("Smart TV casting: Direct API unavailable. Switching to fullscreen.");
          
      } catch (e) {
          console.error("Cast failed", e);
      }
  };

  const startRegistration = () => {
      setGameStatus(GameStatus.REGISTRATION);
  };

  const startGame = async () => {
    setScores({ p1: 0, p2: 0 });
    setCombo({ p1: 0, p2: 0 });
    setHealth(100);
    setChart(generateDemoChart(playerCount, selectedSong.bpm));

    try {
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
          await audioRef.current.play();
          setGameStatus(GameStatus.PLAYING);
      }
    } catch (e) {
        alert("Audio engine error. Please interact with the screen to enable media.");
    }
  };

  const endGame = () => {
      setGameStatus(GameStatus.GAME_OVER);
      if (audioRef.current) audioRef.current.pause();
  };

  useEffect(() => {
      if (gameStatus === GameStatus.LOADING && isCameraReady) {
          setGameStatus(GameStatus.IDLE);
      }
  }, [isCameraReady, gameStatus]);

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans text-white">
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted autoPlay />

      <Canvas shadows dpr={[1, 2]}>
          {gameStatus !== GameStatus.LOADING && (
             <GameScene 
                gameStatus={gameStatus}
                audioRef={audioRef}
                handPositionsRef={handPositionsRef}
                chart={chart}
                playerCount={playerCount}
                bpm={selectedSong.bpm}
                onNoteHit={handleNoteHit}
                onNoteMiss={handleNoteMiss}
                onSongEnd={() => setGameStatus(GameStatus.VICTORY)}
                onRegistered={startGame}
             />
          )}
      </Canvas>

      <WebcamPreview videoRef={videoRef} resultsRef={lastResultsRef} isCameraReady={isCameraReady} />

      {/* Heads-Up Display */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1">
              <div className="text-[10px] font-mono tracking-[0.3em] text-red-500 uppercase">System 01 / Score</div>
              <div className="text-4xl font-black italic">{scores.p1.toLocaleString()}</div>
              <div className="text-[10px] opacity-40">{combo.p1}X COMBO</div>
          </div>

          <div className="w-1/4 max-w-xs flex flex-col items-center gap-2">
              <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                  <div className="h-full bg-white transition-all duration-300" style={{ width: `${health}%` }} />
              </div>
              <div className="text-[8px] tracking-[0.5em] uppercase opacity-20">Integrity</div>
          </div>

          <div className="flex flex-col gap-1 items-end">
              <div className="text-[10px] font-mono tracking-[0.3em] text-blue-500 uppercase">System 02 / Score</div>
              <div className="text-4xl font-black italic text-right">{playerCount === 2 ? scores.p2.toLocaleString() : "OFFLINE"}</div>
              <div className="text-[10px] opacity-40">{combo.p2}X COMBO</div>
          </div>
      </div>

      {/* User Interface Overlays */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
          {gameStatus === GameStatus.IDLE && (
              <div className="bg-black/90 backdrop-blur-3xl p-10 rounded-[2.5rem] border border-white/10 w-full max-w-2xl text-center shadow-2xl animate-in fade-in zoom-in duration-500 overflow-y-auto max-h-[90vh]">
                  <h1 className="text-5xl font-black italic tracking-tighter mb-8">
                      CUBE <span className="text-blue-500">STRIKE</span>
                  </h1>
                  
                  <div className="flex flex-col gap-8">
                    {/* Mode Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setPlayerCount(1)}
                          className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${playerCount === 1 ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                        >
                            <ChevronRight className={playerCount === 1 ? 'text-blue-400' : 'text-white/20'} />
                            <span className="font-bold text-sm tracking-widest uppercase">Solo Drive</span>
                        </button>
                        <button 
                          onClick={() => setPlayerCount(2)}
                          className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${playerCount === 2 ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                        >
                            <Users className={playerCount === 2 ? 'text-emerald-400' : 'text-white/20'} />
                            <span className="font-bold text-sm tracking-widest uppercase">Split Link</span>
                        </button>
                    </div>

                    {/* Song Selection */}
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50">
                          <Music size={12} /> Select Track
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {SONGS.map(song => (
                          <button 
                            key={song.id}
                            onClick={() => setSelectedSong(song)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedSong.id === song.id ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                          >
                            <div className="font-black text-sm uppercase leading-tight mb-1 truncate">{song.title}</div>
                            <div className="text-[10px] opacity-40 uppercase truncate">{song.artist}</div>
                            <div className="text-[10px] mt-2 font-mono text-blue-400">{song.bpm} BPM</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sensitivity */}
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/50 mb-4">
                            <Sliders size={12} /> Tracking Sensitivity
                        </div>
                        <input 
                          type="range" 
                          min="0.1" 
                          max="0.9" 
                          step="0.05" 
                          value={detectionThreshold}
                          onChange={(e) => setDetectionThreshold(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500 mb-2"
                        />
                        <div className="flex justify-between text-[8px] uppercase tracking-tighter opacity-40">
                            <span>Max Reactive (Noisy)</span>
                            <span>High Stability</span>
                        </div>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex justify-center gap-3">
                        <button onClick={toggleCamera} className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 text-xs uppercase tracking-widest border border-white/5">
                            <Camera size={14} /> Flip Optic
                        </button>
                        <button onClick={castToTV} className="px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 text-xs uppercase tracking-widest text-blue-400 border border-blue-400/20">
                            <Tv size={14} /> Big Screen
                        </button>
                    </div>

                    <button 
                        onClick={startRegistration}
                        disabled={!isCameraReady}
                        className="w-full py-6 rounded-full bg-white text-black text-lg font-black hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
                    >
                        <Play fill="black" size={18} /> CALIBRATE & START
                    </button>
                  </div>
                  
                  <p className="mt-8 text-[10px] opacity-30 uppercase tracking-[0.2em]">
                      Optical tracking requires clear visibility.
                  </p>
              </div>
          )}

          {gameStatus === GameStatus.REGISTRATION && (
              <div className="absolute top-1/4 text-center w-full pointer-events-none">
                  <h2 className="text-2xl font-black italic animate-pulse tracking-[0.3em] uppercase">Calibration Active</h2>
                  <p className="opacity-40 text-[10px] mt-2 uppercase tracking-widest">Hold hands in the marker boxes to register</p>
              </div>
          )}

          {(gameStatus === GameStatus.GAME_OVER || gameStatus === GameStatus.VICTORY) && (
              <div className="bg-black/95 p-12 rounded-[2.5rem] border border-white/10 text-center animate-in fade-in zoom-in duration-300">
                  <h2 className="text-5xl font-black italic mb-2 tracking-tighter">
                      {gameStatus === GameStatus.VICTORY ? "COMPLETE" : "HALTED"}
                  </h2>
                  <div className="flex gap-12 justify-center my-8">
                      <div className="text-left">
                          <div className="text-[10px] opacity-30 uppercase tracking-widest mb-1">P1 Data</div>
                          <div className="text-4xl font-black">{scores.p1.toLocaleString()}</div>
                      </div>
                      {playerCount === 2 && (
                          <div className="text-left border-l border-white/10 pl-12">
                              <div className="text-[10px] opacity-30 uppercase tracking-widest mb-1">P2 Data</div>
                              <div className="text-4xl font-black text-emerald-500">{scores.p2.toLocaleString()}</div>
                          </div>
                      )}
                  </div>
                  <button onClick={() => setGameStatus(GameStatus.IDLE)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-10 py-4 rounded-full mx-auto transition-all text-xs font-bold uppercase tracking-widest">
                      <RefreshCw size={16} /> Data Terminal
                  </button>
              </div>
          )}
      </div>

      <div className="fixed bottom-6 left-6 flex gap-3 pointer-events-auto">
          <button onClick={toggleCamera} className="w-10 h-10 rounded-full bg-black/50 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
              <Camera size={16} />
          </button>
          <button onClick={castToTV} className="w-10 h-10 rounded-full bg-black/50 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors">
              <Tv size={16} />
          </button>
      </div>
    </div>
  );
};

export default App;
