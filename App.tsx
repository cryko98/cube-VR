
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useState, useEffect, useCallback, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { GameStatus, NoteData, SongData } from './types';
import { generateDemoChart, SONGS } from './constants';
import { useMediaPipe } from './hooks/useMediaPipe';
import GameScene from './components/GameScene';
import WebcamPreview from './components/WebcamPreview';
import { Play, RefreshCw, Users, Tv, Camera, ChevronRight, Sliders, Music, Loader2, AlertCircle } from 'lucide-react';

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
  
  const { isCameraReady, handPositionsRef, lastResultsRef, error, toggleCamera } = useMediaPipe(videoRef, detectionThreshold);

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
          if (document.fullscreenElement) {
              await document.exitFullscreen();
          } else {
              await document.documentElement.requestFullscreen();
          }
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
        alert("Interakció szükséges az audio lejátszásához!");
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
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      <video ref={videoRef} className="absolute opacity-0 pointer-events-none" playsInline muted autoPlay />

      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.8, 4], fov: 60 }}>
          <Suspense fallback={null}>
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
          </Suspense>
      </Canvas>

      <WebcamPreview videoRef={videoRef} resultsRef={lastResultsRef} isCameraReady={isCameraReady} />

      {/* Heads-Up Display */}
      {gameStatus !== GameStatus.LOADING && (
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none z-10">
              <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-mono tracking-[0.3em] text-red-500 uppercase">P1 Score</div>
                  <div className="text-4xl font-black italic">{scores.p1.toLocaleString()}</div>
                  <div className="text-[10px] opacity-40">{combo.p1}X COMBO</div>
              </div>

              <div className="w-1/4 max-w-xs flex flex-col items-center gap-2">
                  <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className="h-full bg-white transition-all duration-300" style={{ width: `${health}%` }} />
                  </div>
              </div>

              <div className="flex flex-col gap-1 items-end">
                  <div className="text-[10px] font-mono tracking-[0.3em] text-blue-500 uppercase">P2 Score</div>
                  <div className="text-4xl font-black italic text-right">{playerCount === 2 ? scores.p2.toLocaleString() : "OFFLINE"}</div>
                  <div className="text-[10px] opacity-40">{combo.p2}X COMBO</div>
              </div>
          </div>
      )}

      {/* User Interface Overlays */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto z-20">
          {gameStatus === GameStatus.LOADING && (
              <div className="flex flex-col items-center gap-4 bg-black/80 backdrop-blur-xl p-12 rounded-3xl border border-white/10">
                  {error ? (
                      <div className="flex flex-col items-center gap-4 text-red-400 max-w-sm text-center">
                          <AlertCircle size={48} />
                          <h2 className="text-xl font-bold uppercase">Hiba történt</h2>
                          <p className="text-xs opacity-80 leading-relaxed">{error}</p>
                          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors">
                            Újratöltés
                          </button>
                      </div>
                  ) : (
                      <>
                        <Loader2 className="animate-spin text-blue-500" size={48} />
                        <div className="text-center">
                            <h2 className="text-xl font-black italic tracking-widest uppercase">Betöltés</h2>
                            <p className="text-[10px] opacity-40 uppercase tracking-[0.3em] mt-2">Kamera és modulok inicializálása...</p>
                        </div>
                      </>
                  )}
              </div>
          )}

          {gameStatus === GameStatus.IDLE && (
              <div className="bg-black/90 backdrop-blur-3xl p-10 rounded-[2.5rem] border border-white/10 w-full max-w-2xl text-center shadow-2xl animate-in fade-in zoom-in duration-500">
                  <h1 className="text-5xl font-black italic tracking-tighter mb-8">
                      CUBE <span className="text-blue-500">STRIKE</span>
                  </h1>
                  
                  <div className="flex flex-col gap-8">
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setPlayerCount(1)} className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${playerCount === 1 ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                            <ChevronRight className={playerCount === 1 ? 'text-blue-400' : 'text-white/20'} />
                            <span className="font-bold text-sm tracking-widest uppercase">Szóló</span>
                        </button>
                        <button onClick={() => setPlayerCount(2)} className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${playerCount === 2 ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                            <Users className={playerCount === 2 ? 'text-emerald-400' : 'text-white/20'} />
                            <span className="font-bold text-sm tracking-widest uppercase">Duó</span>
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {SONGS.map(song => (
                          <button key={song.id} onClick={() => setSelectedSong(song)} className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedSong.id === song.id ? 'border-blue-500 bg-blue-500/20' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                            <div className="font-black text-sm uppercase truncate">{song.title}</div>
                            <div className="text-[10px] opacity-40 uppercase truncate">{song.artist}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                        onClick={startRegistration}
                        disabled={!isCameraReady}
                        className="w-full py-6 rounded-full bg-white text-black text-lg font-black hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        <Play fill="black" size={18} /> JÁTÉK INDÍTÁSA
                    </button>
                  </div>
              </div>
          )}

          {gameStatus === GameStatus.REGISTRATION && (
              <div className="absolute top-1/4 text-center w-full pointer-events-none">
                  <h2 className="text-2xl font-black italic animate-pulse tracking-[0.3em] uppercase">Kalibrálás</h2>
                  <p className="opacity-40 text-[10px] mt-2 uppercase tracking-widest">Tartsd a kezed a jelzett négyzetekbe</p>
              </div>
          )}

          {(gameStatus === GameStatus.GAME_OVER || gameStatus === GameStatus.VICTORY) && (
              <div className="bg-black/95 p-12 rounded-[2.5rem] border border-white/10 text-center">
                  <h2 className="text-5xl font-black italic mb-2 tracking-tighter">
                      {gameStatus === GameStatus.VICTORY ? "KÉSZ!" : "MÉG EGYSZER?"}
                  </h2>
                  <div className="flex gap-12 justify-center my-8">
                      <div className="text-left">
                          <div className="text-[10px] opacity-30 uppercase tracking-widest mb-1">P1 Pontszám</div>
                          <div className="text-4xl font-black">{scores.p1.toLocaleString()}</div>
                      </div>
                  </div>
                  <button onClick={() => setGameStatus(GameStatus.IDLE)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-10 py-4 rounded-full mx-auto transition-all text-xs font-bold uppercase tracking-widest">
                      <RefreshCw size={16} /> Menü
                  </button>
              </div>
          )}
      </div>

      <div className="fixed bottom-6 left-6 flex gap-3 pointer-events-auto z-30">
          <button onClick={toggleCamera} className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center">
              <Camera size={16} />
          </button>
          <button onClick={castToTV} className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center">
              <Tv size={16} />
          </button>
      </div>
    </div>
  );
};

export default App;
