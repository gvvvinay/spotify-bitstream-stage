import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Volume2,
  Volume1,
  VolumeX,
  Laptop,
  Smartphone,
  Speaker,
  Heart,
  ChevronUp,
} from 'lucide-react';
import { MusicSnippet, PlaybackMode, SpotifyDevice } from '../types';
import { formatMsToTime } from '../utils/time';

interface SnippetPlayerBarProps {
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
  isSpotifyAuth: boolean;
  isFavorite?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (targetMs: number) => void;
  onTogglePlaybackMode: () => void;
  onToggleShuffle: () => void;
  onChangeVolume: (val: number) => void;
  onToggleMute: () => void;
  onSelectDevice: (deviceId: string) => void;
  onOpenNowPlaying?: () => void;
  onToggleFavorite?: (snippetId: string) => void;
}

export const SnippetPlayerBar: React.FC<SnippetPlayerBarProps> = ({
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
  isSpotifyAuth,
  isFavorite,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onTogglePlaybackMode,
  onToggleShuffle,
  onChangeVolume,
  onToggleMute,
  onSelectDevice,
  onOpenNowPlaying,
  onToggleFavorite,
}) => {
  const [showDevices, setShowDevices] = useState(false);

  if (!currentSnippet) return null;

  const startMs = currentSnippet.startMs;
  const endMs = currentSnippet.endMs;
  const snippetDurationMs = Math.max(1000, endMs - startMs);

  // Position relative to snippet start
  const snippetElapsedMs = Math.max(0, Math.min(snippetDurationMs, positionMs - startMs));
  const progressPercent = Math.min(100, Math.max(0, (snippetElapsedMs / snippetDurationMs) * 100));

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fraction = parseFloat(e.target.value) / 100;
    const targetMs = startMs + fraction * snippetDurationMs;
    onSeek(targetMs);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-4px_30px_rgba(0,0,0,0.5)] transition-all">
      {/* Top Scrubber Line across entire bar width */}
      <div className="relative w-full h-1 bg-slate-800/80 cursor-pointer group">
        <div
          className="absolute left-0 top-0 bottom-0 transition-all duration-75"
          style={{ width: `${progressPercent}%`, backgroundColor: 'var(--theme-accent)' }}
        />
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progressPercent}
          onChange={handleSliderChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          title="Scrub within snippet"
        />
      </div>

      <div className="max-w-6xl mx-auto px-2.5 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Artwork, Metadata & Favorite button (Clickable to open Now Playing) */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 md:flex-initial md:w-1/3">
          <button
            onClick={onOpenNowPlaying}
            className="relative w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden shrink-0 shadow-sm bg-slate-900 border border-white/[0.08] group cursor-pointer"
            title="Expand Now Playing Screen"
          >
            <img
              src={currentSnippet.albumArt}
              alt={currentSnippet.title}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full theme-pulse-dot animate-ping" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <ChevronUp className="w-4 h-4 text-white" />
            </div>
          </button>

          <button
            onClick={onOpenNowPlaying}
            className="min-w-0 flex-1 text-left cursor-pointer group"
            title="Expand Now Playing Screen"
          >
            <div className="flex items-center gap-1.5 truncate">
              {currentSnippet.isMashup && (
                <span className="px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-[9px] uppercase shrink-0 shadow-sm">
                  Mashup {currentSnippet.mashupSegments ? `• Part ${mashupSegmentIndex + 1}/${currentSnippet.mashupSegments.length}` : ''}
                </span>
              )}
              <span className="text-xs sm:text-sm font-bold text-white truncate leading-tight group-hover:theme-text-accent transition">
                {currentSnippet.isMashup && currentSnippet.mashupSegments?.[mashupSegmentIndex]
                  ? currentSnippet.mashupSegments[mashupSegmentIndex].title
                  : currentSnippet.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5">
              <span className="truncate">
                {currentSnippet.isMashup && currentSnippet.mashupSegments?.[mashupSegmentIndex]
                  ? currentSnippet.mashupSegments[mashupSegmentIndex].artist
                  : currentSnippet.artist}
              </span>
              <span>•</span>
              <span className="theme-text-accent font-mono text-[9px] sm:text-[10px] shrink-0 font-semibold">
                {formatMsToTime(positionMs)} / {formatMsToTime(endMs)}
              </span>
            </div>
          </button>

          {/* Mini-Player Favorite Toggle */}
          {onToggleFavorite && (
            <button
              onClick={() => onToggleFavorite(currentSnippet.id)}
              className="p-1.5 text-slate-400 hover:text-white transition active:scale-90 cursor-pointer shrink-0"
              title={isFavorite ? 'Remove from Liked' : 'Add to Liked'}
            >
              <Heart
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition ${
                  isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-white'
                }`}
              />
            </button>
          )}
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {/* Shuffle (desktop) */}
          <button
            onClick={onToggleShuffle}
            className={`p-1.5 rounded-lg transition hidden sm:block ${
              isShuffle ? 'theme-text-accent' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={isShuffle ? 'Shuffle: On' : 'Shuffle: Off'}
          >
            <Shuffle className="w-4 h-4" />
          </button>

          {/* Prev */}
          <button
            onClick={onPrev}
            className="p-1 sm:p-1.5 text-slate-300 hover:text-white rounded-lg active:scale-90 transition cursor-pointer"
            title="Previous Bit"
          >
            <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          </button>

          {/* Play / Pause button */}
          <button
            onClick={isPlaying ? onPause : onPlay}
            className="w-8 h-8 sm:w-11 sm:h-11 rounded-full theme-btn-primary font-bold flex items-center justify-center transition active:scale-95 cursor-pointer shadow-md"
            title={isPlaying ? 'Pause' : 'Play Snippet'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg active:scale-90 transition cursor-pointer"
            title="Next Bit"
          >
            <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
          </button>

          {/* Repeat Mode */}
          <button
            onClick={onTogglePlaybackMode}
            className={`p-1.5 rounded-lg transition relative active:scale-90 cursor-pointer ${
              playbackMode === 'repeat-snippet'
                ? 'theme-text-accent theme-bg-soft theme-border-accent border'
                : playbackMode === 'repeat-playlist'
                ? 'theme-text-accent'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            title={
              playbackMode === 'repeat-snippet'
                ? 'Repeat Snippet: ON'
                : playbackMode === 'repeat-playlist'
                ? 'Repeat Playlist: ON'
                : 'Repeat: OFF'
            }
          >
            {playbackMode === 'repeat-snippet' ? (
              <Repeat1 className="w-4 h-4 theme-text-accent stroke-[2.5]" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Right: Expand Now Playing, Device & Volume Controls */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 min-w-0 md:w-1/3">
          {/* Active Spotify Device Selector (Mobile & Desktop) */}
          <div className="relative block">
            <button
              onClick={() => setShowDevices(!showDevices)}
              className={`px-2 sm:px-2.5 py-1 rounded-xl border text-[11px] sm:text-xs font-medium flex items-center gap-1 sm:gap-1.5 transition cursor-pointer ${
                activeDevice
                  ? 'theme-bg-soft theme-border-accent theme-text-accent'
                  : 'bg-slate-900 border-white/[0.08] text-slate-400 hover:text-slate-200'
              }`}
              title="Spotify Connect Output Device"
            >
              {activeDevice?.type?.toLowerCase() === 'smartphone' || !activeDevice ? (
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
              ) : activeDevice?.type?.toLowerCase() === 'speaker' ? (
                <Speaker className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Laptop className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="hidden xs:inline max-w-[68px] sm:max-w-[85px] truncate">
                {activeDevice ? activeDevice.name : isSpotifyAuth ? 'Phone' : 'Demo'}
              </span>
            </button>

            {/* Devices dropdown */}
            {showDevices && (
              <div className="absolute right-0 bottom-9 w-56 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1">
                <div className="px-2.5 py-1 font-bold text-slate-300 border-b border-slate-800 mb-1">
                  Spotify Connect Devices
                </div>
                {devices.length === 0 ? (
                  <div className="p-2.5 text-slate-400 text-center text-[11px]">
                    No active devices. Open Spotify on phone or PC.
                  </div>
                ) : (
                  devices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => {
                        onSelectDevice(device.id);
                        setShowDevices(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition ${
                        device.is_active
                          ? 'theme-bg-soft theme-text-accent font-bold'
                          : 'hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {device.type === 'Smartphone' ? (
                          <Smartphone className="w-3.5 h-3.5" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5" />
                        )}
                        <span className="truncate">{device.name}</span>
                      </div>
                      {device.is_active && <span className="text-[10px] theme-text-accent">Active</span>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Volume Control (Desktop) */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={onToggleMute}
              className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-3.5 h-3.5" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
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
              className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Expand Now Playing Button */}
          {onOpenNowPlaying && (
            <button
              onClick={onOpenNowPlaying}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] text-slate-300 hover:text-white flex items-center gap-1.5 transition text-xs font-semibold cursor-pointer active:scale-95"
              title="Expand to Full Now Playing Screen"
            >
              <ChevronUp className="w-4 h-4 theme-text-accent" />
              <span className="hidden lg:inline text-[11px]">Now Playing</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
