import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Disc3,
  Repeat,
  Radio,
  Zap,
  ArrowRightLeft,
  ChevronDown,
  Layers,
  Wand2,
  Activity,
  Flame,
  Music,
  Loader2,
} from 'lucide-react';
import { MusicSnippet, SpotifyDevice } from '../types';
import { audioEngine } from '../services/audioEngine';
import { spotify } from '../services/spotify';
import { formatMsToTime } from '../utils/time';

interface BitMixerModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: MusicSnippet[];
  currentSnippet: MusicSnippet | null;
  devices: SpotifyDevice[];
  activeDevice: SpotifyDevice | null;
  onSelectDevice: (deviceId: string) => void;
  isSpotifyAuth: boolean;
}

export const BitMixerModal: React.FC<BitMixerModalProps> = ({
  isOpen,
  onClose,
  snippets,
  currentSnippet,
  devices,
  activeDevice,
  onSelectDevice,
  isSpotifyAuth,
}) => {
  // Dual Decks: Deck A & Deck B
  const [deckASnippet, setDeckASnippet] = useState<MusicSnippet | null>(() => {
    return currentSnippet || snippets[0] || null;
  });
  const [deckBSnippet, setDeckBSnippet] = useState<MusicSnippet | null>(() => {
    return snippets.length > 1 ? snippets[1] : snippets[0] || null;
  });

  // Crossfader: 0.0 (Deck A full) -> 0.5 (Center blend) -> 1.0 (Deck B full)
  const [crossfader, setCrossfader] = useState<number>(0.5);

  // Deck Playing states
  const [isPlayingA, setIsPlayingA] = useState<boolean>(false);
  const [isPlayingB, setIsPlayingB] = useState<boolean>(false);

  // Deck Audio URLs & Loading
  const [audioUrlA, setAudioUrlA] = useState<string | null>(null);
  const [audioUrlB, setAudioUrlB] = useState<string | null>(null);
  const [loadingAudioA, setLoadingAudioA] = useState<boolean>(false);
  const [loadingAudioB, setLoadingAudioB] = useState<boolean>(false);

  // Deck Positions (seconds)
  const [posSecA, setPosSecA] = useState<number>(0);
  const [posSecB, setPosSecB] = useState<number>(0);

  // Deck EQs (Bass, Mid, Treble in dB)
  const [eqA, setEqA] = useState({ low: 0, mid: 0, high: 0 });
  const [eqB, setEqB] = useState({ low: 0, mid: 0, high: 0 });

  // Loop & Sync states
  const [loopDeckA, setLoopDeckA] = useState<boolean>(true);
  const [loopDeckB, setLoopDeckB] = useState<boolean>(true);

  // Beat Loop Generator & BPM
  const [bpm, setBpm] = useState<number>(124);
  const [isBeatActive, setIsBeatActive] = useState<boolean>(false);

  // Auto-Mix crossfade transition state
  const [isAutoTransitioning, setIsAutoTransitioning] = useState<boolean>(false);
  const autoTransitionRef = useRef<number | null>(null);

  // Canvas visualizer refs
  const canvasRefA = useRef<HTMLCanvasElement>(null);
  const canvasRefB = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Audio HTML elements for simultaneous dual-track Web Audio playback
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);

  // Resolve real audio stream URLs for Deck A & Deck B
  useEffect(() => {
    if (!deckASnippet) return;
    let isMounted = true;
    setLoadingAudioA(true);

    fetch(`/api/audio/preview?title=${encodeURIComponent(deckASnippet.title)}&artist=${encodeURIComponent(deckASnippet.artist)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.previewUrl) {
          setAudioUrlA(data.previewUrl);
        } else {
          setAudioUrlA(deckASnippet.previewUrl || null);
        }
      })
      .catch(() => {
        if (isMounted) setAudioUrlA(deckASnippet.previewUrl || null);
      })
      .finally(() => {
        if (isMounted) setLoadingAudioA(false);
      });

    return () => {
      isMounted = false;
    };
  }, [deckASnippet?.id]);

  useEffect(() => {
    if (!deckBSnippet) return;
    let isMounted = true;
    setLoadingAudioB(true);

    fetch(`/api/audio/preview?title=${encodeURIComponent(deckBSnippet.title)}&artist=${encodeURIComponent(deckBSnippet.artist)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.previewUrl) {
          setAudioUrlB(data.previewUrl);
        } else {
          setAudioUrlB(deckBSnippet.previewUrl || null);
        }
      })
      .catch(() => {
        if (isMounted) setAudioUrlB(deckBSnippet.previewUrl || null);
      })
      .finally(() => {
        if (isMounted) setLoadingAudioB(false);
      });

    return () => {
      isMounted = false;
    };
  }, [deckBSnippet?.id]);

  // Attach audio elements to Web Audio mixer graph
  useEffect(() => {
    if (audioRefA.current) {
      audioEngine.attachDeckAudioElement('A', audioRefA.current);
    }
  }, [audioUrlA]);

  useEffect(() => {
    if (audioRefB.current) {
      audioEngine.attachDeckAudioElement('B', audioRefB.current);
    }
  }, [audioUrlB]);

  // Sync Web Audio crossfader and fallback volume on elements
  useEffect(() => {
    audioEngine.setCrossfader(crossfader);
    const gainA = Math.cos(crossfader * 0.5 * Math.PI);
    const gainB = Math.sin(crossfader * 0.5 * Math.PI);
    if (audioRefA.current) {
      audioRefA.current.volume = Math.max(0, Math.min(1, gainA));
    }
    if (audioRefB.current) {
      audioRefB.current.volume = Math.max(0, Math.min(1, gainB));
    }
  }, [crossfader]);

  // Clean up on modal close
  useEffect(() => {
    if (!isOpen) {
      if (audioRefA.current) audioRefA.current.pause();
      if (audioRefB.current) audioRefB.current.pause();
      setIsPlayingA(false);
      setIsPlayingB(false);
      audioEngine.stopBeatLoop();
      setIsBeatActive(false);
      if (autoTransitionRef.current) {
        cancelAnimationFrame(autoTransitionRef.current);
      }
    }
  }, [isOpen]);

  // Dual canvas VU visualizer animation loop
  useEffect(() => {
    if (!isOpen) return;

    let tick = 0;
    const renderVisualizers = () => {
      tick += 0.08;

      // Draw Deck A Canvas
      if (canvasRefA.current) {
        const cA = canvasRefA.current;
        const ctxA = cA.getContext('2d');
        if (ctxA) {
          ctxA.clearRect(0, 0, cA.width, cA.height);
          const numBars = 16;
          const barWidth = cA.width / numBars - 2;
          for (let i = 0; i < numBars; i++) {
            let h = 4;
            if (isPlayingA) {
              const crossWeight = Math.max(0.15, 1 - crossfader);
              const wave = Math.sin(tick * 3 + i * 0.5) * 0.5 + 0.5;
              h = Math.max(4, wave * cA.height * crossWeight);
            }
            const grad = ctxA.createLinearGradient(0, cA.height, 0, cA.height - h);
            grad.addColorStop(0, '#059669');
            grad.addColorStop(0.7, '#10b981');
            grad.addColorStop(1, '#34d399');
            ctxA.fillStyle = grad;
            ctxA.fillRect(i * (barWidth + 2), cA.height - h, barWidth, h);
          }
        }
      }

      // Draw Deck B Canvas
      if (canvasRefB.current) {
        const cB = canvasRefB.current;
        const ctxB = cB.getContext('2d');
        if (ctxB) {
          ctxB.clearRect(0, 0, cB.width, cB.height);
          const numBars = 16;
          const barWidth = cB.width / numBars - 2;
          for (let i = 0; i < numBars; i++) {
            let h = 4;
            if (isPlayingB) {
              const crossWeight = Math.max(0.15, crossfader);
              const wave = Math.cos(tick * 2.8 + i * 0.45) * 0.5 + 0.5;
              h = Math.max(4, wave * cB.height * crossWeight);
            }
            const grad = ctxB.createLinearGradient(0, cB.height, 0, cB.height - h);
            grad.addColorStop(0, '#7c3aed');
            grad.addColorStop(0.7, '#8b5cf6');
            grad.addColorStop(1, '#a78bfa');
            ctxB.fillStyle = grad;
            ctxB.fillRect(i * (barWidth + 2), cB.height - h, barWidth, h);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderVisualizers);
    };

    renderVisualizers();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, isPlayingA, isPlayingB, crossfader]);

  // Toggle Play Deck A
  const togglePlayDeckA = async () => {
    const el = audioRefA.current;
    if (!el) return;

    if (isPlayingA) {
      el.pause();
      setIsPlayingA(false);
    } else {
      audioEngine.playCueSound(523.25);
      try {
        await el.play();
        setIsPlayingA(true);
      } catch (e) {
        console.warn('Audio A playback error:', e);
      }
    }
  };

  // Toggle Play Deck B
  const togglePlayDeckB = async () => {
    const el = audioRefB.current;
    if (!el) return;

    if (isPlayingB) {
      el.pause();
      setIsPlayingB(false);
    } else {
      audioEngine.playCueSound(659.25);
      try {
        await el.play();
        setIsPlayingB(true);
      } catch (e) {
        console.warn('Audio B playback error:', e);
      }
    }
  };

  // Crossfade Transition Animation (Smooth 3.5-second automated crossfade between decks)
  const handleAutoCrossfade = (target: 0 | 1 | 0.5) => {
    if (isAutoTransitioning) return;
    setIsAutoTransitioning(true);
    const startVal = crossfader;
    const startTime = performance.now();
    const duration = 3200;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 0.5 - Math.cos(progress * Math.PI) * 0.5;
      const currentVal = startVal + (target - startVal) * eased;
      setCrossfader(currentVal);

      if (progress < 1) {
        autoTransitionRef.current = requestAnimationFrame(step);
      } else {
        setIsAutoTransitioning(false);
        autoTransitionRef.current = null;
      }
    };

    autoTransitionRef.current = requestAnimationFrame(step);
  };

  // Beat Looper Toggle
  const handleToggleBeatLoop = () => {
    const nextState = audioEngine.toggleBeatLoop(bpm);
    setIsBeatActive(nextState);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 overflow-y-auto">
      {/* Hidden HTML5 Multitrack Audio Elements (Allow both songs to play simultaneously!) */}
      {audioUrlA && (
        <audio
          ref={audioRefA}
          src={audioUrlA}
          loop={loopDeckA}
          crossOrigin="anonymous"
          onTimeUpdate={() => {
            if (audioRefA.current) setPosSecA(audioRefA.current.currentTime);
          }}
          onEnded={() => setIsPlayingA(false)}
        />
      )}
      {audioUrlB && (
        <audio
          ref={audioRefB}
          src={audioUrlB}
          loop={loopDeckB}
          crossOrigin="anonymous"
          onTimeUpdate={() => {
            if (audioRefB.current) setPosSecB(audioRefB.current.currentTime);
          }}
          onEnded={() => setIsPlayingB(false)}
        />
      )}

      <div className="relative w-full max-w-4xl bg-slate-950 border border-white/[0.12] rounded-3xl shadow-[0_10px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Top Header Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900/90 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-indigo-600 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
                <Sliders className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  BitStream DJ Audio Mixer
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-emerald-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                  Simultaneous Multitrack
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Play both song bits at the same time, blend with the crossfader & apply DJ effects
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Beat Looper Pill */}
            <button
              onClick={handleToggleBeatLoop}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                isBeatActive
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                  : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-white/[0.08]'
              }`}
              title="Toggle rhythmic 4-on-the-floor beat loop"
            >
              <Activity className={`w-3.5 h-3.5 ${isBeatActive ? 'animate-pulse' : ''}`} />
              <span>{isBeatActive ? `Beat ON (${bpm} BPM)` : 'Beat Loop'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition active:scale-95"
              aria-label="Close mixer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mixer Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4">
          {/* ========================================================================= */}
          {/* DUAL DECKS (Deck A on Left, Deck B on Right)                              */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* DECK A */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              isPlayingA
                ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : 'bg-slate-900/60 border-white/[0.07]'
            }`}>
              {/* Deck A Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] mb-3">
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1 border border-emerald-500/30">
                  <Disc3 className={`w-3.5 h-3.5 ${isPlayingA ? 'animate-spin' : ''}`} /> Deck A
                </span>

                {/* Snippet Picker for Deck A */}
                <div className="relative min-w-0 max-w-[200px]">
                  <select
                    value={deckASnippet?.id || ''}
                    onChange={(e) => {
                      const found = snippets.find((s) => s.id === e.target.value);
                      if (found) {
                        setDeckASnippet(found);
                      }
                    }}
                    className="w-full text-xs font-semibold bg-slate-950 text-white border border-white/[0.1] rounded-xl px-2 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
                  >
                    {snippets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({formatMsToTime(s.startMs)}-{formatMsToTime(s.endMs)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Deck A Artwork & Info */}
              {deckASnippet && (
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 shadow-md border border-white/10 bg-slate-900">
                    <img
                      src={deckASnippet.albumArt}
                      alt={deckASnippet.title}
                      className="w-full h-full object-cover"
                    />
                    {isPlayingA && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-white text-xs sm:text-sm truncate">
                      {deckASnippet.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {deckASnippet.artist}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-emerald-400 font-mono font-semibold">
                      {loadingAudioA ? (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading audio track...
                        </span>
                      ) : (
                        <span>Playing: {posSecA.toFixed(1)}s • Bit {formatMsToTime(deckASnippet.startMs)}-{formatMsToTime(deckASnippet.endMs)}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Deck A VU Visualizer */}
              <div className="mt-3 bg-slate-950/80 rounded-xl p-1.5 border border-white/[0.05]">
                <canvas ref={canvasRefA} width={280} height={36} className="w-full h-9 rounded" />
              </div>

              {/* Deck A Controls (Play, Loop, Cue) */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  onClick={togglePlayDeckA}
                  disabled={loadingAudioA}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md disabled:opacity-50 ${
                    isPlayingA
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                  }`}
                >
                  {isPlayingA ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlayingA ? 'Pause Deck A' : 'Play Deck A'}</span>
                </button>

                <button
                  onClick={() => {
                    if (audioRefA.current) audioRefA.current.currentTime = 0;
                    audioEngine.playCueSound(523.25);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono font-bold text-xs transition active:scale-95"
                  title="Jump to Start of Track"
                >
                  CUE
                </button>

                <button
                  onClick={() => setLoopDeckA(!loopDeckA)}
                  className={`p-2 rounded-xl border transition active:scale-95 ${
                    loopDeckA
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-white/[0.06] text-slate-400'
                  }`}
                  title="Loop Bit continuously"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Deck A 3-Band Isolator EQ */}
              <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-3 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>LOW</span>
                    <span className="font-mono text-emerald-400">{eqA.low}dB</span>
                  </div>
                  <input
                    type="range"
                    min="-24"
                    max="12"
                    step="1"
                    value={eqA.low}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEqA((p) => ({ ...p, low: v }));
                      audioEngine.setDeckEq('A', 'low', v);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>MID</span>
                    <span className="font-mono text-emerald-400">{eqA.mid}dB</span>
                  </div>
                  <input
                    type="range"
                    min="-24"
                    max="12"
                    step="1"
                    value={eqA.mid}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEqA((p) => ({ ...p, mid: v }));
                      audioEngine.setDeckEq('A', 'mid', v);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>HIGH</span>
                    <span className="font-mono text-emerald-400">{eqA.high}dB</span>
                  </div>
                  <input
                    type="range"
                    min="-24"
                    max="12"
                    step="1"
                    value={eqA.high}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEqA((p) => ({ ...p, high: v }));
                      audioEngine.setDeckEq('A', 'high', v);
                    }}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* DECK B */}
            <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
              isPlayingB
                ? 'bg-purple-950/20 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                : 'bg-slate-900/60 border-white/[0.07]'
            }`}>
              {/* Deck B Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] mb-3">
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1 border border-purple-500/30">
                  <Disc3 className={`w-3.5 h-3.5 ${isPlayingB ? 'animate-spin' : ''}`} /> Deck B
                </span>

                {/* Snippet Picker for Deck B */}
                <div className="relative min-w-0 max-w-[200px]">
                  <select
                    value={deckBSnippet?.id || ''}
                    onChange={(e) => {
                      const found = snippets.find((s) => s.id === e.target.value);
                      if (found) {
                        setDeckBSnippet(found);
                      }
                    }}
                    className="w-full text-xs font-semibold bg-slate-950 text-white border border-white/[0.1] rounded-xl px-2 py-1 focus:outline-none focus:border-purple-500 cursor-pointer truncate"
                  >
                    {snippets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({formatMsToTime(s.startMs)}-{formatMsToTime(s.endMs)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Deck B Artwork & Info */}
              {deckBSnippet && (
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 shadow-md border border-white/10 bg-slate-900">
                    <img
                      src={deckBSnippet.albumArt}
                      alt={deckBSnippet.title}
                      className="w-full h-full object-cover"
                    />
                    {isPlayingB && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-extrabold text-white text-xs sm:text-sm truncate">
                      {deckBSnippet.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {deckBSnippet.artist}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-purple-400 font-mono font-semibold">
                      {loadingAudioB ? (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> Loading audio track...
                        </span>
                      ) : (
                        <span>Playing: {posSecB.toFixed(1)}s • Bit {formatMsToTime(deckBSnippet.startMs)}-{formatMsToTime(deckBSnippet.endMs)}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Deck B VU Visualizer */}
              <div className="mt-3 bg-slate-950/80 rounded-xl p-1.5 border border-white/[0.05]">
                <canvas ref={canvasRefB} width={280} height={36} className="w-full h-9 rounded" />
              </div>

              {/* Deck B Controls (Play, Loop, Cue) */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  onClick={togglePlayDeckB}
                  disabled={loadingAudioB}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-md disabled:opacity-50 ${
                    isPlayingB
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      : 'bg-purple-600 text-white hover:bg-purple-500'
                  }`}
                >
                  {isPlayingB ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlayingB ? 'Pause Deck B' : 'Play Deck B'}</span>
                </button>

                <button
                  onClick={() => {
                    if (audioRefB.current) audioRefB.current.currentTime = 0;
                    audioEngine.playCueSound(659.25);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono font-bold text-xs transition active:scale-95"
                  title="Jump to Start of Track"
                >
                  CUE
                </button>

                <button
                  onClick={() => setLoopDeckB(!loopDeckB)}
                  className={`p-2 rounded-xl border transition active:scale-95 ${
                    loopDeckB
                      ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                      : 'bg-slate-800 border-white/[0.06] text-slate-400'
                  }`}
                  title="Loop Bit continuously"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Deck B 3-Band Isolator EQ */}
              <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-3 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>LOW</span>
                    <span className="font-mono text-purple-400">{eqB.low}dB</span>
                  </div>
                  <input
                    type="range"
                    min="-24"
                    max="12"
                    step="1"
                    value={eqB.low}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEqB((p) => ({ ...p, low: v }));
                      audioEngine.setDeckEq('B', 'low', v);
                    }}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>MID</span>
                    <span className="font-mono text-purple-400">{eqB.mid}dB</span>
                  </div>
                  <input
                    type="range"
                    min="-24"
                    max="12"
                    step="1"
                    value={eqB.mid}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEqB((p) => ({ ...p, mid: v }));
                      audioEngine.setDeckEq('B', 'mid', v);
                    }}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>HIGH</span>
                    <span className="font-mono text-purple-400">{eqB.high}dB</span>
                  </div>
                  <input
                    type="range"
                    min="-24"
                    max="12"
                    step="1"
                    value={eqB.high}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setEqB((p) => ({ ...p, high: v }));
                      audioEngine.setDeckEq('B', 'high', v);
                    }}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MASTER CROSSFADER & DJ TRANSITION SECTION                                 */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/[0.08] shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white tracking-wider uppercase">
                  Simultaneous Audio Crossfader
                </span>
              </div>

              {/* Quick Transition Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleAutoCrossfade(0)}
                  className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 transition"
                  title="Smooth transition to Deck A"
                >
                  Fade A
                </button>
                <button
                  onClick={() => handleAutoCrossfade(0.5)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-white/10 transition"
                  title="Center crossfader (50/50 blend)"
                >
                  Center (50/50)
                </button>
                <button
                  onClick={() => handleAutoCrossfade(1)}
                  className="px-2 py-0.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-500/30 transition"
                  title="Smooth transition to Deck B"
                >
                  Fade B
                </button>
              </div>
            </div>

            {/* Crossfader Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono font-bold">
                <span className="text-emerald-400">DECK A ({Math.round((1 - crossfader) * 100)}%)</span>
                <span className="text-amber-400 font-sans">
                  {crossfader < 0.45 ? 'Deck A Favored' : crossfader > 0.55 ? 'Deck B Favored' : 'Simultaneous 50/50 Blend'}
                </span>
                <span className="text-purple-400">DECK B ({Math.round(crossfader * 100)}%)</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={crossfader}
                onChange={(e) => setCrossfader(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400 shadow-inner"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DJ SAMPLER PADS (Airhorn, Vinyl Scratch, Noise Sweep, 808 Sub Drop)         */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Live DJ Sound Effect Pads</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Synthesized in real-time via Web Audio API
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => audioEngine.triggerSoundFx('airhorn')}
                className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 hover:from-amber-500/30 hover:to-orange-500/20 border border-amber-500/30 text-amber-300 font-extrabold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition shadow-sm cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>🚨 AIRHORN</span>
              </button>

              <button
                onClick={() => audioEngine.triggerSoundFx('scratch')}
                className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 hover:from-cyan-500/30 hover:to-blue-500/20 border border-cyan-500/30 text-cyan-300 font-extrabold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition shadow-sm cursor-pointer"
              >
                <Disc3 className="w-4 h-4 text-cyan-400" />
                <span>🎧 SCRATCH</span>
              </button>

              <button
                onClick={() => audioEngine.triggerSoundFx('sweep')}
                className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 hover:from-emerald-500/30 hover:to-teal-500/20 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition shadow-sm cursor-pointer"
              >
                <Wand2 className="w-4 h-4 text-emerald-400" />
                <span>🌊 LASER SWEEP</span>
              </button>

              <button
                onClick={() => audioEngine.triggerSoundFx('drop')}
                className="p-3 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/10 hover:from-rose-500/30 hover:to-pink-500/20 border border-rose-500/30 text-rose-300 font-extrabold text-xs flex flex-col items-center justify-center gap-1 active:scale-95 transition shadow-sm cursor-pointer"
              >
                <Activity className="w-4 h-4 text-rose-400" />
                <span>💥 808 SUB DROP</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2.5 sm:px-6 bg-slate-900/60 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dual-Track Web Audio Output</span>
          </span>
          <span className="font-mono text-slate-300">
            {snippets.length} bits available for mixing
          </span>
        </div>
      </div>
    </div>
  );
};
