import React, { useState } from 'react';
import {
  Play,
  Pause,
  Repeat,
  ExternalLink,
  MoreVertical,
  Edit2,
  Trash2,
  Clock,
  X,
  Heart,
  ListPlus,
  PlaySquare,
} from 'lucide-react';
import { MusicSnippet } from '../types';
import { formatMsToTime, formatSnippetDuration } from '../utils/time';

interface SnippetCardProps {
  snippet: MusicSnippet;
  isPlaying: boolean;
  isCurrent: boolean;
  onPlay: (snippet: MusicSnippet) => void;
  onPause: () => void;
  onEdit: (snippet: MusicSnippet) => void;
  onDelete: (id: string) => void;
  onToggleLoopSnippet?: () => void;
  isLooping?: boolean;
  onToggleFavorite?: (snippet: MusicSnippet) => void;
  onAddToQueue?: (snippet: MusicSnippet, playNext?: boolean) => void;
}

export const SnippetCard: React.FC<SnippetCardProps> = ({
  snippet,
  isPlaying,
  isCurrent,
  onPlay,
  onPause,
  onEdit,
  onDelete,
  onToggleLoopSnippet,
  isLooping,
  onToggleFavorite,
  onAddToQueue,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <div
      className={`group relative rounded-xl sm:rounded-2xl p-2 sm:p-2.5 transition-all duration-200 flex items-center justify-between gap-2 sm:gap-3 ${
        showMenu ? 'z-30' : 'z-0'
      } ${
        isCurrent
          ? isPlaying
            ? 'bg-slate-900 border theme-active-card ring-1 ring-white/10 shadow-[0_4px_25px_var(--theme-accent-glow)] scale-[1.005]'
            : 'bg-slate-900 border border-white/[0.1] shadow-sm'
          : 'bg-slate-900/60 hover:bg-slate-900/90 border border-white/[0.05] hover:border-white/[0.1]'
      }`}
    >
      {/* Inline Delete Confirmation */}
      {isConfirmingDelete && (
        <div className="absolute inset-0 z-20 bg-slate-950/95 backdrop-blur-sm rounded-xl px-3 flex items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 min-w-0">
            <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="text-xs font-semibold text-white truncate">Delete this bit?</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsConfirmingDelete(false);
                onDelete(snippet.id);
              }}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[11px] transition active:scale-95"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(false)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Left: Thumbnail & Instant Play/Pause Button */}
      <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden shrink-0 bg-slate-950 border border-white/[0.08] shadow-sm">
        <img
          src={snippet.albumArt}
          alt={snippet.title}
          className={`w-full h-full object-cover transition duration-200 ${
            isCurrent && isPlaying ? 'brightness-75 scale-105' : ''
          }`}
        />
        {/* Play/Pause Button overlay */}
        <button
          onClick={() => {
            if (isCurrent && isPlaying) {
              onPause();
            } else {
              onPlay(snippet);
            }
          }}
          className={`absolute inset-0 flex items-center justify-center transition ${
            isCurrent && isPlaying
              ? 'bg-black/35 opacity-100'
              : 'bg-black/20 hover:bg-black/50 opacity-90 sm:opacity-0 sm:group-hover:opacity-100'
          }`}
          title={isCurrent && isPlaying ? 'Pause' : 'Play Snippet'}
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-5 h-5 sm:w-6 sm:h-6 theme-text-accent fill-current drop-shadow" />
          ) : (
            <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-current ml-0.5 drop-shadow hover:theme-text-accent transition" />
          )}
        </button>

        {/* Animated Equalizer soundwave bars overlay on thumbnail */}
        {isCurrent && isPlaying && (
          <div className="absolute inset-x-0 bottom-0 py-0.5 bg-black/60 backdrop-blur-[1px] flex items-end justify-center gap-[2px] pointer-events-none">
            <span className="w-[2.5px] rounded-full theme-pulse-dot animate-eq-bar-1" />
            <span className="w-[2.5px] rounded-full theme-pulse-dot animate-eq-bar-2" />
            <span className="w-[2.5px] rounded-full theme-pulse-dot animate-eq-bar-3" />
            <span className="w-[2.5px] rounded-full theme-pulse-dot animate-eq-bar-4" />
          </div>
        )}
      </div>

      {/* Middle: Title, Artist & Timestamp */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => {
          if (isCurrent && isPlaying) {
            onPause();
          } else {
            onPlay(snippet);
          }
        }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Animated Soundwave Equalizer Badge in List */}
          {isCurrent && isPlaying ? (
            <div
              className="inline-flex items-end gap-[2px] h-3.5 px-1.5 py-0.5 rounded-full theme-bg-soft border theme-border-accent shrink-0 shadow-sm"
              title="Now Playing"
            >
              <span className="w-[2px] rounded-full theme-pulse-dot animate-eq-bar-1" />
              <span className="w-[2px] rounded-full theme-pulse-dot animate-eq-bar-2" />
              <span className="w-[2px] rounded-full theme-pulse-dot animate-eq-bar-3" />
              <span className="w-[2px] rounded-full theme-pulse-dot animate-eq-bar-4" />
            </div>
          ) : isCurrent ? (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Paused" />
          ) : null}

          {snippet.isMashup && (
            <span className="px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-[9px] uppercase shrink-0 shadow-sm">
              Mashup ({snippet.mashupSegments?.length || 2} Bits)
            </span>
          )}

          <span
            className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px] sm:max-w-none ${
              isCurrent && isPlaying ? 'theme-text-accent' : 'theme-text-accent/80'
            }`}
          >
            {snippet.snippetName || 'Music Bit'}
          </span>
          <span className="text-[9px] font-mono text-slate-500 hidden xs:inline">•</span>
          <span className="px-1 py-0.2 rounded theme-bg-soft text-[9px] font-mono font-semibold theme-text-accent shrink-0">
            {formatSnippetDuration(snippet.startMs, snippet.endMs)}
          </span>
        </div>

        <h3
          className={`text-xs sm:text-sm font-bold truncate leading-snug transition-colors flex items-center gap-1.5 ${
            isCurrent && isPlaying ? 'theme-text-accent font-extrabold' : 'text-white'
          }`}
        >
          <span className="truncate">{snippet.title}</span>
        </h3>

        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-400 truncate">
          <span className="truncate">{snippet.artist}</span>
          <span className="text-slate-600">•</span>
          <span className="font-mono text-slate-300 text-[9px] sm:text-[10px] shrink-0">
            {formatMsToTime(snippet.startMs)}➔{formatMsToTime(snippet.endMs)}
          </span>
        </div>
      </div>

      {/* Right: Loop toggle, Favorite & 3-dots Menu */}
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        {/* Quick Favorite toggle */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(snippet);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer active:scale-95"
            title={snippet.isFavorite ? 'Remove from Liked' : 'Save to Liked'}
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition ${
                snippet.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-rose-400'
              }`}
            />
          </button>
        )}

        {/* Quick Loop / Repeat toggle */}
        {onToggleLoopSnippet && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLoopSnippet();
            }}
            className={`p-1.5 rounded-lg transition cursor-pointer active:scale-95 ${
              isLooping
                ? 'theme-bg-soft theme-text-accent theme-border-accent border'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title={isLooping ? 'Looping this bit continuously (Tap to stop)' : 'Loop this bit continuously'}
          >
            <Repeat className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLooping ? 'animate-pulse theme-text-accent' : ''}`} />
          </button>
        )}

        {/* 3-dots Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
              showMenu
                ? 'bg-slate-800 text-white shadow-sm ring-1 ring-white/10 rotate-90'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80 active:scale-95'
            }`}
            title="Options"
          >
            <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {showMenu && (
            <>
              {/* Invisible click-away overlay to dismiss menu */}
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />

              {/* Compact Floating Context Menu with Pop-in Animation */}
              <div
                className="absolute right-0 top-full mt-1.5 z-50 w-48 sm:w-52 bg-slate-950/95 backdrop-blur-xl border border-white/[0.12] rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.85)] p-1.5 animate-menu-pop text-slate-100 divide-y divide-white/[0.06]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Compact Bit Info Header */}
                <div className="px-2.5 py-1.5 pb-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider theme-text-accent truncate">
                    {snippet.snippetName || 'Music Bit'}
                  </div>
                  <div className="text-[11px] font-semibold text-white truncate leading-tight mt-0.5">
                    {snippet.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {formatSnippetDuration(snippet.startMs, snippet.endMs)}
                  </div>
                </div>

                {/* Primary Queue & Library Actions */}
                <div className="py-1 space-y-0.5">
                  {/* Play Next */}
                  {onAddToQueue && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onAddToQueue(snippet, true);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-slate-200 hover:text-white flex items-center gap-2.5 text-xs font-medium transition cursor-pointer active:scale-95 text-left"
                    >
                      <PlaySquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Play Next</span>
                    </button>
                  )}

                  {/* Add to Queue */}
                  {onAddToQueue && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onAddToQueue(snippet, false);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-slate-200 hover:text-white flex items-center gap-2.5 text-xs font-medium transition cursor-pointer active:scale-95 text-left"
                    >
                      <ListPlus className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>Add to Queue</span>
                    </button>
                  )}

                  {/* Toggle Liked */}
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onToggleFavorite(snippet);
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-slate-200 hover:text-white flex items-center gap-2.5 text-xs font-medium transition cursor-pointer active:scale-95 text-left"
                    >
                      <Heart
                        className={`w-3.5 h-3.5 shrink-0 ${
                          snippet.isFavorite ? 'fill-rose-500 text-rose-500' : 'text-rose-400'
                        }`}
                      />
                      <span>{snippet.isFavorite ? 'Remove Liked' : 'Save to Liked'}</span>
                    </button>
                  )}
                </div>

                {/* Edit, Loop & External Spotify Link */}
                <div className="py-1 space-y-0.5">
                  {/* Edit Highlight */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(snippet);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-slate-200 hover:text-white flex items-center gap-2.5 text-xs font-medium transition cursor-pointer active:scale-95 text-left"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Edit Highlight</span>
                  </button>

                  {/* Loop Bit Continuously */}
                  {onToggleLoopSnippet && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onToggleLoopSnippet();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-slate-200 hover:text-white flex items-center gap-2.5 text-xs font-medium transition cursor-pointer active:scale-95 text-left"
                    >
                      <Repeat className={`w-3.5 h-3.5 shrink-0 ${isLooping ? 'theme-text-accent' : 'text-slate-400'}`} />
                      <span>{isLooping ? 'Stop Looping' : 'Loop Continuously'}</span>
                    </button>
                  )}

                  {/* Open in Spotify */}
                  <a
                    href={snippet.spotifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setShowMenu(false)}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-slate-200 hover:text-white flex items-center gap-2.5 text-xs font-medium transition cursor-pointer active:scale-95 text-left"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Open in Spotify</span>
                  </a>
                </div>

                {/* Danger: Delete Bit */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setIsConfirmingDelete(true);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-500/15 text-rose-300 hover:text-rose-200 flex items-center gap-2.5 text-xs font-medium transition cursor-pointer active:scale-95 text-left"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Delete Snippet</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
