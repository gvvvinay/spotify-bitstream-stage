import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  VolumeX,
  Volume1,
  Heart,
  Moon,
  Sliders,
  AlignLeft,
  ListMusic,
  Activity,
  Sparkles,
  ExternalLink,
  Laptop,
  Smartphone,
  Speaker,
  Clock,
  Trash2,
  Plus,
} from 'lucide-react';
import { MusicSnippet, PlaybackMode, SpotifyDevice, EqualizerSettings } from '../types';
import { formatMsToTime, formatSnippetDuration } from '../utils/time';
import { audioEngine, EQUALIZER_PRESETS } from '../services/audioEngine';

interface SyncedLyricLine {
  timeMs: number;
  text: string;
}

interface NowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSnippet: MusicSnippet | null;
  isPlaying: boolean;
  positionMs: number;
  mashupSegmentIndex?: number;
  playbackMode: PlaybackMode;
  isShuffle: boolean;
  volume: number;
  isMuted: boolean;
  devices: SpotifyDevice[];
  activeDevice: SpotifyDevice | null;
  queue: MusicSnippet[];
  sleepTimerMinutes: number | null;
  sleepTimeRemainingMs: number | null;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (targetMs: number) => void;
  onTogglePlaybackMode: () => void;
  onToggleShuffle: () => void;
  onChangeVolume: (val: number) => void;
  onToggleMute: () => void;
  onToggleFavorite: (snippetId: string) => void;
  onSetSleepTimer: (minutes: number | null) => void;
  onSelectDevice: (deviceId: string) => void;
  onPlayFromQueue: (snippet: MusicSnippet) => void;
  onRemoveFromQueue: (snippetId: string) => void;
  onMoveQueueItem: (fromIdx: number, toIdx: number) => void;
}

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({
  isOpen,
  onClose,
  currentSnippet,
  isPlaying,
  positionMs,
  mashupSegmentIndex = 0,
  playbackMode,
  isShuffle,
  volume,
  isMuted,
  devices,
  activeDevice,
  queue,
  sleepTimerMinutes,
  sleepTimeRemainingMs,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onTogglePlaybackMode,
  onToggleShuffle,
  onChangeVolume,
  onToggleMute,
  onToggleFavorite,
  onSetSleepTimer,
  onSelectDevice,
  onPlayFromQueue,
  onRemoveFromQueue,
  onMoveQueueItem,
}) => {
  const [activeTab, setActiveTab] = useState<'art' | 'visualizer' | 'lyrics' | 'queue' | 'eq'>('art');
  const [eqSettings, setEqSettings] = useState<EqualizerSettings>(() => audioEngine.getSettings());
  const [showSleepPicker, setShowSleepPicker] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);

  // Lyrics state
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Visualizer canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Fetch real lyrics from LRCLIB when track changes
  useEffect(() => {
    if (!currentSnippet) return;

    let isMounted = true;
    setLyricsLoading(true);
    setSyncedLyrics([]);
    setPlainLyrics(null);

    const cleanTitle = currentSnippet.title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
    const cleanArtist = currentSnippet.artist.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();

    fetch(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(
        cleanArtist
      )}`
    )
      .then((res) => {
        if (!res.ok) throw new Error('Lyrics not found');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.syncedLyrics) {
          // Parse LRC format: [mm:ss.xx] line
          const lines: SyncedLyricLine[] = [];
          const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
          data.syncedLyrics.split('\n').forEach((rawLine: string) => {
            const match = rawLine.match(regex);
            if (match) {
              const mins = parseInt(match[1], 10);
              const secs = parseInt(match[2], 10);
              const ms = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
              const timeMs = mins * 60000 + secs * 1000 + ms;
              lines.push({ timeMs, text: match[4].trim() });
            }
          });
          setSyncedLyrics(lines);
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
        }
      })
      .catch(() => {
        // Fallback: If snippet has custom notes, show as lyric notes
        if (isMounted && currentSnippet.notes) {
          setPlainLyrics(`Notes for this highlight:\n\n${currentSnippet.notes}`);
        }
      })
      .finally(() => {
        if (isMounted) setLyricsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentSnippet?.id]);

  // Audio Visualizer Canvas animation loop
  useEffect(() => {
    if (activeTab !== 'visualizer' && activeTab !== 'art') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let step = 0;
    const render = () => {
      step += 0.05;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 32;
      const barWidth = (width / numBars) * 0.7;
      const gap = (width / numBars) * 0.3;

      const freqData = audioEngine.getFrequencyData();

      for (let i = 0; i < numBars; i++) {
        let barHeight = 6;
        if (isPlaying) {
          // Combine audio engine real frequency with rhythmic sin simulation
          const realVal = freqData[i % freqData.length] || 0;
          const wave = Math.sin(step * 3 + i * 0.4) * 0.5 + 0.5;
          const wave2 = Math.cos(step * 2 + i * 0.2) * 0.5 + 0.5;
          barHeight = Math.max(8, (realVal / 255) * height * 0.7 + (wave * 0.5 + wave2 * 0.5) * (height * 0.75));
        }

        const x = i * (barWidth + gap) + gap / 2;
        const y = height - barHeight;

        // Gradient from accent to purple/cyan
        const grad = ctx.createLinearGradient(0, height, 0, y);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
        grad.addColorStop(0.6, 'rgba(0, 240, 255, 0.75)');
        grad.addColorStop(1, '#ffffff');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, activeTab]);

  // Auto-scroll lyrics to active line
  useEffect(() => {
    if (activeTab !== 'lyrics' || syncedLyrics.length === 0) return;
    let activeIdx = -1;
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (positionMs >= syncedLyrics[i].timeMs) {
        activeIdx = i;
        break;
      }
    }
    if (activeIdx >= 0 && lyricsContainerRef.current) {
      const activeEl = lyricsContainerRef.current.children[activeIdx] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [positionMs, activeTab, syncedLyrics]);

  if (!isOpen || !currentSnippet) return null;

  const activeSeg =
    currentSnippet.isMashup && currentSnippet.mashupSegments && currentSnippet.mashupSegments[mashupSegmentIndex]
      ? currentSnippet.mashupSegments[mashupSegmentIndex]
      : null;

  const startMs = activeSeg ? activeSeg.startMs : currentSnippet.startMs;
  const endMs = activeSeg ? activeSeg.endMs : currentSnippet.endMs;
  const snippetDurationMs = Math.max(1000, endMs - startMs);
  const snippetElapsedMs = Math.max(0, Math.min(snippetDurationMs, positionMs - startMs));
  const progressPercent = Math.min(100, Math.max(0, (snippetElapsedMs / snippetDurationMs) * 100));

  const handleSeekSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fraction = parseFloat(e.target.value) / 100;
    const targetMs = startMs + fraction * snippetDurationMs;
    onSeek(targetMs);
  };

  const handleUpdateEq = (key: 'bass' | 'mid' | 'treble', value: number) => {
    const next = { ...eqSettings, [key]: value, preset: 'custom' };
    setEqSettings(next);
    audioEngine.setSettings(next);
  };

  const handleSelectEqPreset = (presetKey: string) => {
    audioEngine.setPreset(presetKey);
    setEqSettings(audioEngine.getSettings());
    audioEngine.auditionEqualizer();
  };

  const isFav = Boolean(currentSnippet.isFavorite);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex flex-col justify-between overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
      {/* Dynamic Background Ambient Aura */}
      <div
        className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-30 transition-all duration-700"
        style={{ backgroundColor: 'var(--theme-accent)' }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none opacity-25 transition-all duration-700"
        style={{ backgroundColor: 'var(--theme-accent-hover)' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_70%)] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-4xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5"
          title="Minimize Now Playing"
        >
          <ChevronDown className="w-5 h-5" />
          <span className="text-xs font-semibold hidden sm:inline">Minimize</span>
        </button>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-white/[0.08] p-1 rounded-2xl backdrop-blur-md">
          <button
            onClick={() => setActiveTab('art')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'art'
                ? 'theme-btn-primary shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Artwork
          </button>
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              activeTab === 'visualizer'
                ? 'theme-btn-primary shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Visualizer</span>
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              activeTab === 'lyrics'
                ? 'theme-btn-primary shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Lyrics</span>
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              activeTab === 'queue'
                ? 'theme-btn-primary shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Queue</span>
          </button>
          <button
            onClick={() => setActiveTab('eq')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              activeTab === 'eq'
                ? 'theme-btn-primary shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EQ</span>
          </button>
        </div>

        {/* Top Right: Sleep Timer Pill */}
        <div className="relative">
          <button
            onClick={() => setShowSleepPicker(!showSleepPicker)}
            className={`p-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
              sleepTimerMinutes !== null
                ? 'theme-bg-soft theme-border-accent theme-text-accent'
                : 'bg-slate-900/80 hover:bg-slate-850 border-white/[0.08] text-slate-300'
            }`}
            title="Set Sleep Timer"
          >
            <Moon className="w-4 h-4" />
            {sleepTimeRemainingMs !== null && (
              <span className="font-mono text-[11px]">
                {Math.ceil(sleepTimeRemainingMs / 60000)}m
              </span>
            )}
          </button>

          {/* Sleep timer dropdown */}
          {showSleepPicker && (
            <div className="absolute right-0 top-11 w-48 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <Moon className="w-3 h-3 theme-text-accent" /> Sleep Timer
              </div>
              {[null, 15, 30, 45, 60].map((mins) => (
                <button
                  key={mins ?? 'off'}
                  onClick={() => {
                    onSetSleepTimer(mins);
                    setShowSleepPicker(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                    sleepTimerMinutes === mins
                      ? 'theme-bg-soft theme-text-accent font-bold'
                      : 'hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <span>{mins === null ? 'Turn Off' : `${mins} minutes`}</span>
                  {sleepTimerMinutes === mins && <Sparkles className="w-3.5 h-3.5 theme-text-accent" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Center Stage Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-xl w-full mx-auto px-4 py-2 min-h-0">
        {/* Tab 1: Artwork View */}
        {activeTab === 'art' && (
          <div className="flex flex-col items-center justify-center w-full animate-in fade-in zoom-in-95 duration-200">
            {/* Large Album Art with subtle vinyl ring & glow */}
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl p-1 shadow-2xl transition-all duration-300 group">
              {/* Outer ambient glow */}
              <div
                className="absolute inset-0 rounded-3xl blur-2xl opacity-40 group-hover:opacity-60 transition duration-500 pointer-events-none"
                style={{ backgroundColor: 'var(--theme-accent)' }}
              />
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-900 border border-white/[0.1] shadow-2xl">
                <img
                  src={currentSnippet.albumArt}
                  alt={currentSnippet.title}
                  className={`w-full h-full object-cover transition duration-700 ${
                    isPlaying ? 'scale-105' : 'scale-100'
                  }`}
                />
                {/* Playing pulse wave badge */}
                {isPlaying && (
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1.5 text-[10px] font-bold text-white">
                    <span className="w-1.5 h-1.5 rounded-full theme-pulse-dot animate-ping" />
                    <span>Streaming</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mini Audio Visualizer Bar below artwork */}
            <div className="w-64 sm:w-80 h-10 mt-4 rounded-xl overflow-hidden bg-slate-900/50 border border-white/[0.06] p-1 flex items-center justify-center">
              <canvas ref={canvasRef} width={280} height={36} className="w-full h-full" />
            </div>
          </div>
        )}

        {/* Tab 2: Full Audio Visualizer View */}
        {activeTab === 'visualizer' && (
          <div className="w-full h-72 sm:h-96 flex flex-col items-center justify-center rounded-3xl bg-slate-900/70 border border-white/[0.08] p-6 shadow-2xl backdrop-blur-xl animate-in fade-in duration-200">
            <div className="flex items-center gap-2 mb-4 text-xs font-bold text-slate-300">
              <Activity className="w-4 h-4 theme-text-accent" />
              <span>Real-Time Rhythmic Spectrum Visualizer</span>
            </div>
            <div className="w-full flex-1 flex items-center justify-center">
              <canvas ref={canvasRef} width={420} height={180} className="w-full h-full max-h-48" />
            </div>
            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Synchronized 32-band rhythm frequency analyzer mapped to {currentSnippet.title}
            </p>
          </div>
        )}

        {/* Tab 3: Synced Lyrics View */}
        {activeTab === 'lyrics' && (
          <div className="w-full h-72 sm:h-96 rounded-3xl bg-slate-900/80 border border-white/[0.08] p-4 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-2 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <AlignLeft className="w-4 h-4 theme-text-accent" />
                <span>Track Lyrics</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {syncedLyrics.length > 0 ? 'Synchronized • Click line to seek' : 'Standard'}
              </span>
            </div>

            <div
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto space-y-3.5 pr-2 py-4 text-center scroll-smooth"
            >
              {lyricsLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Loading lyrics for {currentSnippet.title}...</span>
                </div>
              ) : syncedLyrics.length > 0 ? (
                syncedLyrics.map((line, idx) => {
                  const isCurrentLine =
                    positionMs >= line.timeMs &&
                    (idx === syncedLyrics.length - 1 || positionMs < syncedLyrics[idx + 1].timeMs);
                  return (
                    <button
                      key={idx}
                      onClick={() => onSeek(line.timeMs)}
                      className={`block w-full py-1.5 px-3 rounded-xl transition text-sm sm:text-base cursor-pointer ${
                        isCurrentLine
                          ? 'theme-text-accent font-black scale-105 bg-white/[0.04]'
                          : 'text-slate-400 hover:text-slate-200 font-medium'
                      }`}
                    >
                      {line.text || '♪'}
                    </button>
                  );
                })
              ) : plainLyrics ? (
                <div className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                  {plainLyrics}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
                  <AlignLeft className="w-8 h-8 text-slate-600" />
                  <p>No lyrics found online for this track.</p>
                  <p className="text-[10px] text-slate-500 max-w-xs">
                    You can add lyrics or notes to this highlight in the Clipper editor!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Queue Management View */}
        {activeTab === 'queue' && (
          <div className="w-full h-72 sm:h-96 rounded-3xl bg-slate-900/80 border border-white/[0.08] p-4 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ListMusic className="w-4 h-4 theme-text-accent" />
                <span>Up Next Queue ({queue.length})</span>
              </div>
              <span className="text-[10px] text-slate-400">Tap track to play immediately</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {queue.map((snippet, idx) => {
                const isItemCurrent = snippet.id === currentSnippet.id;
                return (
                  <div
                    key={`${snippet.id}-${idx}`}
                    className={`p-2 sm:p-2.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      isItemCurrent
                        ? 'theme-bg-soft theme-border-accent'
                        : 'bg-slate-950/60 border-white/[0.06] hover:bg-slate-900/80'
                    }`}
                  >
                    <button
                      onClick={() => onPlayFromQueue(snippet)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <img
                        src={snippet.albumArt}
                        alt={snippet.title}
                        className="w-9 h-9 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-bold truncate ${isItemCurrent ? 'theme-text-accent' : 'text-white'}`}>
                          {snippet.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {snippet.artist} • {formatSnippetDuration(snippet.startMs, snippet.endMs)}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {idx > 0 && (
                        <button
                          onClick={() => onMoveQueueItem(idx, idx - 1)}
                          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Move up in queue"
                        >
                          ↑
                        </button>
                      )}
                      {idx < queue.length - 1 && (
                        <button
                          onClick={() => onMoveQueueItem(idx, idx + 1)}
                          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Move down in queue"
                        >
                          ↓
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveFromQueue(snippet.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 5: Equalizer View */}
        {activeTab === 'eq' && (
          <div className="w-full h-72 sm:h-96 rounded-3xl bg-slate-900/80 border border-white/[0.08] p-4 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between animate-in fade-in duration-200">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Sliders className="w-4 h-4 theme-text-accent" />
                  <span>3-Band Master Equalizer</span>
                </div>
                <button
                  onClick={() => audioEngine.auditionEqualizer()}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                  title="Audition Equalizer Frequency Response"
                >
                  <Sparkles className="w-3.5 h-3.5 theme-text-accent" /> Audition EQ
                </button>
              </div>

              {/* Presets Chips */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {Object.entries(EQUALIZER_PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => handleSelectEqPreset(key)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                      eqSettings.preset === key
                        ? 'theme-btn-primary shadow-sm'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-white/[0.06]'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {/* 3 Frequency Sliders: Bass (120Hz), Mid (1kHz), Treble (7kHz) */}
              <div className="grid grid-cols-3 gap-4">
                {/* Bass */}
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/[0.06] flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-300">Bass</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">120 Hz</span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={eqSettings.bass}
                    onChange={(e) => handleUpdateEq('bass', parseFloat(e.target.value))}
                    style={{ accentColor: 'var(--theme-accent)' }}
                    className="w-full my-3 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold theme-text-accent">
                    {eqSettings.bass > 0 ? `+${eqSettings.bass}` : eqSettings.bass} dB
                  </span>
                </div>

                {/* Mid */}
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/[0.06] flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-300">Mid</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">1.0 kHz</span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={eqSettings.mid}
                    onChange={(e) => handleUpdateEq('mid', parseFloat(e.target.value))}
                    style={{ accentColor: 'var(--theme-accent)' }}
                    className="w-full my-3 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold theme-text-accent">
                    {eqSettings.mid > 0 ? `+${eqSettings.mid}` : eqSettings.mid} dB
                  </span>
                </div>

                {/* Treble */}
                <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/[0.06] flex flex-col items-center">
                  <span className="text-[11px] font-bold text-slate-300">Treble</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">7.0 kHz</span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={eqSettings.treble}
                    onChange={(e) => handleUpdateEq('treble', parseFloat(e.target.value))}
                    style={{ accentColor: 'var(--theme-accent)' }}
                    className="w-full my-3 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold theme-text-accent">
                    {eqSettings.treble > 0 ? `+${eqSettings.treble}` : eqSettings.treble} dB
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 text-center mt-2">
              Parametric Web Audio filters shape all audio cues and preview audio dynamically.
            </p>
          </div>
        )}
      </main>

      {/* Bottom Controls Area */}
      <footer className="relative z-10 w-full max-w-xl mx-auto px-4 pb-6 pt-2 space-y-4">
        {/* Title, Artist & Like Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {currentSnippet.isMashup && (
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-[10px] uppercase shadow-sm">
                  Mashup • Part {mashupSegmentIndex + 1}/{currentSnippet.mashupSegments?.length || 1}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-white truncate leading-tight">
              {currentSnippet.isMashup && currentSnippet.mashupSegments?.[mashupSegmentIndex]
                ? currentSnippet.mashupSegments[mashupSegmentIndex].title
                : currentSnippet.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 truncate mt-0.5">
              <span className="font-semibold text-slate-300">
                {currentSnippet.isMashup && currentSnippet.mashupSegments?.[mashupSegmentIndex]
                  ? currentSnippet.mashupSegments[mashupSegmentIndex].artist
                  : currentSnippet.artist}
              </span>
              <span>•</span>
              <span className="theme-text-accent font-semibold">{currentSnippet.snippetName}</span>
            </div>
          </div>

          <button
            onClick={() => onToggleFavorite(currentSnippet.id)}
            className="p-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] transition active:scale-90 cursor-pointer shadow-sm shrink-0"
            title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
          >
            <Heart
              className={`w-5 h-5 transition ${
                isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-white'
              }`}
            />
          </button>
        </div>

        {/* Interactive Scrub Bar with Timestamps */}
        <div className="space-y-1">
          <div className="relative w-full h-3 flex items-center group">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-75"
                style={{ width: `${progressPercent}%`, backgroundColor: 'var(--theme-accent)' }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progressPercent}
              onChange={handleSeekSlider}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{formatMsToTime(positionMs)}</span>
            <span className="text-slate-500 font-sans text-[10px]">
              Bit: {formatSnippetDuration(startMs, endMs)}
            </span>
            <span>{formatMsToTime(endMs)}</span>
          </div>
        </div>

        {/* Main Transport Control Buttons */}
        <div className="flex items-center justify-between px-2">
          {/* Shuffle Button */}
          <button
            onClick={onToggleShuffle}
            className={`p-2.5 rounded-2xl transition active:scale-90 cursor-pointer ${
              isShuffle ? 'theme-text-accent bg-white/[0.06]' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isShuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Button */}
          <button
            onClick={onPrev}
            className="p-3 text-slate-200 hover:text-white rounded-2xl active:scale-90 transition cursor-pointer"
            title="Previous Snippet"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          {/* Primary Play / Pause Button */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-14 h-14 rounded-full theme-btn-primary flex items-center justify-center transition active:scale-95 shadow-xl cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            className="p-3 text-slate-200 hover:text-white rounded-2xl active:scale-90 transition cursor-pointer"
            title="Next Snippet"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={onTogglePlaybackMode}
            className={`p-2.5 rounded-2xl transition active:scale-90 cursor-pointer ${
              playbackMode === 'repeat-snippet'
                ? 'theme-text-accent theme-bg-soft border theme-border-accent'
                : playbackMode === 'repeat-playlist'
                ? 'theme-text-accent bg-white/[0.06]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={
              playbackMode === 'repeat-snippet'
                ? 'Repeat Bit: ON'
                : playbackMode === 'repeat-playlist'
                ? 'Repeat Playlist: ON'
                : 'Repeat: OFF'
            }
          >
            {playbackMode === 'repeat-snippet' ? (
              <Repeat1 className="w-5 h-5 theme-text-accent stroke-[2.5]" />
            ) : (
              <Repeat className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Volume & Connect Device Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-xs">
          {/* Volume slider & mute */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
              className="p-1.5 text-slate-400 hover:text-white transition cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={isMuted ? 0 : volume}
              onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
              style={{ accentColor: 'var(--theme-accent)' }}
              className="w-24 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Device Target */}
          <div className="relative">
            <button
              onClick={() => setShowDevicePicker(!showDevicePicker)}
              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-850 border border-white/[0.08] text-slate-300 flex items-center gap-1.5 transition text-[11px] cursor-pointer"
            >
              {activeDevice?.type === 'Smartphone' ? (
                <Smartphone className="w-3.5 h-3.5 theme-text-accent" />
              ) : activeDevice?.type === 'Speaker' ? (
                <Speaker className="w-3.5 h-3.5 theme-text-accent" />
              ) : (
                <Laptop className="w-3.5 h-3.5 theme-text-accent" />
              )}
              <span className="truncate max-w-[120px]">
                {activeDevice?.name || 'Spotify Player'}
              </span>
            </button>

            {/* Device list dropdown */}
            {showDevicePicker && (
              <div className="absolute right-0 bottom-10 w-52 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400">
                  Spotify Connect Devices
                </div>
                {devices.length === 0 ? (
                  <div className="p-2 text-slate-400 text-center text-[11px]">
                    No active devices. Open Spotify.
                  </div>
                ) : (
                  devices.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => {
                        onSelectDevice(d.id);
                        setShowDevicePicker(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                        d.is_active
                          ? 'theme-bg-soft theme-text-accent font-bold'
                          : 'hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <span className="truncate">{d.name}</span>
                      {d.is_active && <span className="text-[10px] theme-text-accent">Active</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
