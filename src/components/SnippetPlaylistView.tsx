import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Plus,
  Trash2,
  Music,
  Clock,
  Sparkles,
  Search,
  Shuffle,
  X,
  Repeat,
  Heart,
  History,
  LayoutGrid,
  ArrowLeft,
  Disc3,
  Flame,
  Sliders,
  Layers,
} from 'lucide-react';
import { MusicSnippet, SnippetPlaylist, PlaybackMode } from '../types';
import { SnippetCard } from './SnippetCard';

interface SnippetPlaylistViewProps {
  playlists: SnippetPlaylist[];
  snippets: MusicSnippet[];
  currentSnippet: MusicSnippet | null;
  isPlaying: boolean;
  activePlaylistId: string | null;
  recentlyPlayedSnippets?: MusicSnippet[];
  playCounts?: Record<string, number>;
  isMobileHome?: boolean;
  onChangeMobileHome?: (isHome: boolean) => void;
  onSelectPlaylist: (id: string | null) => void;
  onPlaySnippet: (snippet: MusicSnippet) => void;
  onPauseSnippet: () => void;
  onPlayEntirePlaylist: (playlistId: string | null, viewSnippets?: MusicSnippet[]) => void;
  onActiveQueueChange?: (viewSnippets: MusicSnippet[]) => void;
  onEditSnippet: (snippet: MusicSnippet) => void;
  onDeleteSnippet: (id: string) => void;
  onClearAllSnippets?: () => void;
  onCreatePlaylist: (name: string, description?: string) => void;
  onDeletePlaylist: (id: string) => void;
  onAutoGeneratePlaylist?: () => void;
  onOpenMixer?: () => void;
  onOpenMashupModal?: () => void;
  onAutoGenerateMashups?: () => void;
  onOpenClipper: () => void;
  playbackMode?: PlaybackMode;
  onToggleLoopSnippet?: (snippet: MusicSnippet) => void;
  onToggleFavorite?: (snippet: MusicSnippet) => void;
  onAddToQueue?: (snippet: MusicSnippet, playNext?: boolean) => void;
}

interface TopAlbumInfo {
  albumName: string;
  artistName: string;
  albumArt: string;
  playCount: number;
  secondaryArts: string[];
}

export const SnippetPlaylistView: React.FC<SnippetPlaylistViewProps> = ({
  playlists,
  snippets,
  currentSnippet,
  isPlaying,
  activePlaylistId,
  recentlyPlayedSnippets = [],
  playCounts = {},
  isMobileHome,
  onChangeMobileHome,
  onSelectPlaylist,
  onPlaySnippet,
  onPauseSnippet,
  onPlayEntirePlaylist,
  onActiveQueueChange,
  onEditSnippet,
  onDeleteSnippet,
  onClearAllSnippets,
  onCreatePlaylist,
  onDeletePlaylist,
  onAutoGeneratePlaylist,
  onOpenMixer,
  onOpenMashupModal,
  onAutoGenerateMashups,
  onOpenClipper,
  playbackMode,
  onToggleLoopSnippet,
  onToggleFavorite,
  onAddToQueue,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [confirmDeletePlaylist, setConfirmDeletePlaylist] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'favorites' | 'recent'>('all');
  const [internalMobileHome, setInternalMobileHome] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      return isMobileDevice || window.innerWidth < 768;
    }
    return false;
  });

  const showHomeScreen = isMobileHome !== undefined ? isMobileHome : internalMobileHome;
  const setShowHomeScreen = (val: boolean) => {
    setInternalMobileHome(val);
    if (onChangeMobileHome) {
      onChangeMobileHome(val);
    }
  };

  // Compute the top-listened album thumbnail & metadata for a given list of snippets
  const getTopListenedAlbum = useMemo(() => {
    const recentIndexMap = new Map<string, number>();
    recentlyPlayedSnippets.forEach((s, idx) => {
      if (!recentIndexMap.has(s.id)) {
        recentIndexMap.set(s.id, idx);
      }
    });

    return (list: MusicSnippet[]): TopAlbumInfo | null => {
      if (!list || list.length === 0) return null;

      const albumStats = new Map<
        string,
        {
          albumName: string;
          artistName: string;
          albumArt: string;
          score: number;
          plays: number;
        }
      >();

      for (const s of list) {
        const albumName = (s.album || s.title || 'Featured Single').trim();
        const key = albumName.toLowerCase();
        const snippetPlays = playCounts[s.id] || 0;
        const albumPlays = playCounts[`album:${key}`] || 0;
        const recentIdx = recentIndexMap.get(s.id);
        const recencyBonus = recentIdx !== undefined ? Math.max(2, 26 - recentIdx) : 0;
        const favBonus = s.isFavorite ? 1.5 : 0;
        const itemScore = snippetPlays * 10 + albumPlays * 3 + recencyBonus + favBonus + 1;
        const itemPlays = snippetPlays + (recentIdx !== undefined && snippetPlays === 0 ? 1 : 0);

        const existing = albumStats.get(key);
        if (existing) {
          existing.score += itemScore;
          existing.plays += itemPlays;
          if (!existing.albumArt && s.albumArt) {
            existing.albumArt = s.albumArt;
          }
        } else {
          albumStats.set(key, {
            albumName,
            artistName: s.artist || 'Unknown Artist',
            albumArt: s.albumArt || '',
            score: itemScore,
            plays: itemPlays,
          });
        }
      }

      const sorted = Array.from(albumStats.values()).sort((a, b) => b.score - a.score);
      const top = sorted.find((a) => a.albumArt) || sorted[0];
      const secondaryArts = sorted
        .filter((a) => a !== top && a.albumArt && a.albumArt !== top.albumArt)
        .slice(0, 3)
        .map((a) => a.albumArt);

      return {
        albumName: top.albumName,
        artistName: top.artistName,
        albumArt: top.albumArt,
        playCount: top.plays,
        secondaryArts,
      };
    };
  }, [playCounts, recentlyPlayedSnippets]);

  // Active playlist object (or null for all)
  const currentPlaylist = playlists.find((p) => p.id === activePlaylistId) || null;

  // Source list and filtered snippets memoized to prevent unnecessary queue resets on re-render
  const filteredSnippets = useMemo(() => {
    let baseList: MusicSnippet[] = snippets;
    if (filterMode === 'favorites') {
      baseList = snippets.filter((s) => s.isFavorite);
    } else if (filterMode === 'recent') {
      baseList = recentlyPlayedSnippets.length > 0 ? recentlyPlayedSnippets : snippets.slice(0, 10);
    } else if (activePlaylistId) {
      baseList = snippets.filter((s) => s.playlistId === activePlaylistId);
    }

    return baseList.filter((s) => {
      if (selectedTag && !s.tags?.includes(selectedTag)) {
        return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchArtist = s.artist.toLowerCase().includes(q);
        const matchSnippetName = s.snippetName.toLowerCase().includes(q);
        const matchNotes = s.notes?.toLowerCase().includes(q);
        if (!matchTitle && !matchArtist && !matchSnippetName && !matchNotes) {
          return false;
        }
      }
      return true;
    });
  }, [snippets, filterMode, recentlyPlayedSnippets, activePlaylistId, selectedTag, searchFilter]);

  useEffect(() => {
    if (onActiveQueueChange && !showHomeScreen) {
      onActiveQueueChange(filteredSnippets);
    }
  }, [filteredSnippets, onActiveQueueChange, showHomeScreen]);

  // Calculate total seconds of music bits in current view
  const totalBitMs = filteredSnippets.reduce((acc, s) => acc + (s.endMs - s.startMs), 0);
  const totalBitSec = Math.round(totalBitMs / 1000);
  const totalBitMins = Math.floor(totalBitSec / 60);
  const totalBitRemainingSec = totalBitSec % 60;

  // Extract all unique tags
  const allTags = Array.from(
    new Set(snippets.flatMap((s) => s.tags || []).filter(Boolean))
  );

  const favoriteCount = snippets.filter((s) => s.isFavorite).length;

  const headerTitle = (() => {
    if (filterMode === 'favorites') return 'Liked Bits';
    if (filterMode === 'recent') return 'Recently Played';
    if (currentPlaylist) return currentPlaylist.name;
    return 'Saved Music Bits';
  })();

  const formatTotalDuration = (list: MusicSnippet[]) => {
    const ms = list.reduce((acc, s) => acc + Math.max(0, s.endMs - s.startMs), 0);
    const sec = Math.round(ms / 1000);
    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    return mins > 0 ? `${mins}m ${remSec}s` : `${remSec}s`;
  };

  // Build cards for the Mobile Home Screen (User Playlists + All Bits + Liked Bits)
  const homePlaylistCards = useMemo(() => {
    const cards: Array<{
      id: string;
      playlistId: string | null;
      mode: 'playlist' | 'all' | 'favorites' | 'recent';
      name: string;
      description: string;
      gradient: string;
      items: MusicSnippet[];
      topAlbum: TopAlbumInfo | null;
      isCustom: boolean;
    }> = [];

    // 1. User Playlists first
    for (const pl of playlists) {
      const items = snippets.filter((s) => s.playlistId === pl.id);
      cards.push({
        id: pl.id,
        playlistId: pl.id,
        mode: 'playlist',
        name: pl.name,
        description: pl.description || 'Curated music highlights',
        gradient: pl.coverGradient || 'from-emerald-600 via-teal-600 to-indigo-800',
        items,
        topAlbum: getTopListenedAlbum(items),
        isCustom: true,
      });
    }

    // 2. Liked Bits collection card
    const likedItems = snippets.filter((s) => s.isFavorite);
    if (likedItems.length > 0) {
      cards.push({
        id: '__favorites__',
        playlistId: null,
        mode: 'favorites',
        name: '❤️ Liked Bits',
        description: 'Your favorite clipped song moments',
        gradient: 'from-rose-600 via-pink-600 to-purple-800',
        items: likedItems,
        topAlbum: getTopListenedAlbum(likedItems),
        isCustom: false,
      });
    }

    // 3. All Bits collection card
    cards.push({
      id: '__all__',
      playlistId: null,
      mode: 'all',
      name: '✨ All Saved Bits',
      description: 'Complete library of clipped highlights',
      gradient: 'from-indigo-600 via-cyan-600 to-emerald-700',
      items: snippets,
      topAlbum: getTopListenedAlbum(snippets),
      isCustom: false,
    });

    return cards;
  }, [playlists, snippets, getTopListenedAlbum]);

  return (
    <div className="space-y-2.5 sm:space-y-4">
      {/* 1. Horizontal Playlist Tabs (Touch-friendly & fast) */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-0.5 px-0.5">
        {/* Home Screen Card Grid Toggle Pill */}
        <button
          onClick={() => setShowHomeScreen(true)}
          className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
            showHomeScreen
              ? 'theme-btn-primary font-bold shadow-sm'
              : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/[0.06]'
          }`}
          title="Playlists Home Screen (Album Cards)"
        >
          <LayoutGrid className="w-3 h-3" />
          <span>Home ({playlists.length})</span>
        </button>

        <button
          onClick={() => {
            setFilterMode('all');
            onSelectPlaylist(null);
            setShowHomeScreen(false);
          }}
          className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
            !showHomeScreen && activePlaylistId === null && filterMode === 'all'
              ? 'theme-btn-primary font-bold shadow-sm'
              : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/[0.06]'
          }`}
        >
          <Sparkles className="w-3 h-3" />
          <span>All Bits ({snippets.length})</span>
        </button>

        {/* Favorites filter tab */}
        <button
          onClick={() => {
            setFilterMode('favorites');
            onSelectPlaylist(null);
            setShowHomeScreen(false);
          }}
          className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
            !showHomeScreen && filterMode === 'favorites' && activePlaylistId === null
              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold shadow-sm'
              : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/[0.06]'
          }`}
        >
          <Heart className={`w-3 h-3 ${favoriteCount > 0 ? 'fill-current text-rose-300' : ''}`} />
          <span>Liked ({favoriteCount})</span>
        </button>

        {/* Recently Played filter tab */}
        <button
          onClick={() => {
            setFilterMode('recent');
            onSelectPlaylist(null);
            setShowHomeScreen(false);
          }}
          className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
            !showHomeScreen && filterMode === 'recent' && activePlaylistId === null
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold shadow-sm'
              : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/[0.06]'
          }`}
        >
          <History className="w-3 h-3" />
          <span>Recent ({recentlyPlayedSnippets.length})</span>
        </button>

        {playlists.map((pl) => {
          const count = snippets.filter((s) => s.playlistId === pl.id).length;
          return (
            <button
              key={pl.id}
              onClick={() => {
                setFilterMode('all');
                onSelectPlaylist(pl.id);
                setShowHomeScreen(false);
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 active:scale-95 cursor-pointer ${
                !showHomeScreen && activePlaylistId === pl.id
                  ? 'theme-btn-primary font-bold shadow-sm'
                  : 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border border-white/[0.06]'
              }`}
            >
              <span>{pl.name}</span>
              <span className="text-[10px] opacity-75">({count})</span>
            </button>
          );
        })}

        {/* Club Bits into Mashup Button */}
        {onOpenMashupModal && (
          <button
            type="button"
            onClick={onOpenMashupModal}
            className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap bg-gradient-to-r from-amber-500/25 via-rose-500/25 to-purple-500/25 hover:from-amber-500/35 hover:to-purple-500/35 text-amber-300 border border-amber-400/30 flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
            title="Club 2 or 3 bits into a sequential seamless Mashup"
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>Club / Mashup</span>
          </button>
        )}

        {/* Auto Mashups Quick Action */}
        {onAutoGenerateMashups && (
          <button
            type="button"
            onClick={onAutoGenerateMashups}
            className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 hover:from-indigo-500/30 hover:to-pink-500/30 text-indigo-300 border border-indigo-400/30 flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
            title="Auto-generate mashups based on what you hear and your listening history"
          >
            <Sparkles className="w-3 h-3 text-pink-400" />
            <span>Auto-Mashups</span>
          </button>
        )}

        {/* Auto-Curate Bits & Playlist quick button */}
        {onAutoGeneratePlaylist && (
          <button
            type="button"
            onClick={onAutoGeneratePlaylist}
            className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-indigo-500/20 hover:from-emerald-500/30 hover:to-indigo-500/30 text-emerald-300 border border-emerald-400/30 flex items-center gap-1 transition active:scale-95 cursor-pointer"
            title="Auto-curate new bits and create a playlist from your library"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Auto-Curate</span>
          </button>
        )}

        {/* Create playlist quick button */}
        <button
          onClick={() => {
            const name = prompt('Enter new Playlist name:');
            if (name && name.trim()) {
              onCreatePlaylist(name.trim());
            }
          }}
          className="px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-dashed border-slate-700/80 flex items-center gap-1 transition active:scale-95 cursor-pointer"
          title="Create New Playlist"
        >
          <Plus className="w-3 h-3" />
          <span className="hidden xs:inline">New Playlist</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* MOBILE / PLAYLISTS HOME SCREEN: Playlists as Cards w/ Top Album Art */}
      {/* =================================================================== */}
      {showHomeScreen ? (
        <div className="space-y-3 sm:space-y-4 animate-in fade-in duration-200">
          {/* Home Screen Header Banner */}
          <div className="bg-slate-900/60 border border-white/[0.07] rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 theme-text-accent shrink-0" />
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate">
                  Your Playlists
                </h2>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                Tap a playlist card to browse bits • Cover shows top-listened album
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onOpenMixer && (
                <button
                  type="button"
                  onClick={onOpenMixer}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 text-amber-300 border border-amber-400/30 font-bold text-xs flex items-center gap-1 active:scale-95 transition cursor-pointer shadow-sm"
                  title="Open BitStream DJ Audio Mixer"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mixer</span>
                </button>
              )}
              {onAutoGeneratePlaylist && (
                <button
                  type="button"
                  onClick={onAutoGeneratePlaylist}
                  className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-indigo-500/20 hover:from-emerald-500/30 hover:to-indigo-500/30 text-emerald-300 border border-emerald-400/30 font-bold text-xs flex items-center gap-1 active:scale-95 transition cursor-pointer shadow-sm"
                  title="Auto-generate bits & playlist based on your library"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto-Curate</span>
                </button>
              )}
              <button
                onClick={() => {
                  const name = prompt('Enter new Playlist name:');
                  if (name && name.trim()) {
                    onCreatePlaylist(name.trim());
                  }
                }}
                className="px-3 py-1.5 rounded-xl theme-btn-primary font-bold text-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>
          </div>

          {/* Playlists Card Grid (2 columns on mobile, 3 on tablet/desktop) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
            {homePlaylistCards.map((card) => {
              const isActiveCardSource =
                card.mode === 'playlist'
                  ? activePlaylistId === card.playlistId && filterMode === 'all'
                  : activePlaylistId === null && filterMode === card.mode;
              const isCardPlaying =
                isPlaying &&
                currentSnippet !== null &&
                isActiveCardSource &&
                card.items.some((s) => s.id === currentSnippet.id);
              const topAlbum = card.topAlbum;

              return (
                <div
                  key={card.id}
                  onClick={() => {
                    if (card.mode === 'favorites') {
                      setFilterMode('favorites');
                      onSelectPlaylist(null);
                    } else if (card.mode === 'recent') {
                      setFilterMode('recent');
                      onSelectPlaylist(null);
                    } else if (card.mode === 'all') {
                      setFilterMode('all');
                      onSelectPlaylist(null);
                    } else {
                      setFilterMode('all');
                      onSelectPlaylist(card.playlistId);
                    }
                    setShowHomeScreen(false);
                  }}
                  className={`group relative rounded-2xl bg-slate-900/80 hover:bg-slate-900 border transition-all overflow-hidden flex flex-col cursor-pointer active:scale-[0.98] shadow-lg ${
                    isCardPlaying
                      ? 'theme-border-accent ring-1 ring-emerald-500/30'
                      : 'border-white/[0.08] hover:border-white/[0.16]'
                  }`}
                >
                  {/* Top-Listened Album Cover Thumbnail */}
                  <div className="relative aspect-square w-full overflow-hidden bg-slate-950">
                    {topAlbum?.albumArt ? (
                      <img
                        src={topAlbum.albumArt}
                        alt={topAlbum.albumName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${card.gradient} flex items-center justify-center`}
                      >
                        <Disc3 className="w-12 h-12 text-white/60" />
                      </div>
                    )}

                    {/* Multi-stop dark gradient overlay for crisp badge & button legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-black/35" />

                    {/* Top-Left Badge: Top Listened Album indicator */}
                    <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-[9px] sm:text-[10px] font-bold text-amber-300 truncate max-w-[82%] shadow-sm">
                        <Flame className="w-2.5 h-2.5 text-amber-400 fill-current shrink-0" />
                        <span className="truncate">
                          {topAlbum
                            ? topAlbum.playCount > 0
                              ? `Top Album • ${topAlbum.playCount} ${topAlbum.playCount === 1 ? 'play' : 'plays'}`
                              : 'Top Album'
                            : 'Empty'}
                        </span>
                      </span>
                    </div>

                    {/* Bottom-Left: Secondary Album Stack + Track Count */}
                    <div className="absolute bottom-2.5 left-2.5 right-12 flex items-center gap-1.5 pointer-events-none">
                      {topAlbum && topAlbum.secondaryArts.length > 0 && (
                        <div className="flex -space-x-1.5 shrink-0">
                          {topAlbum.secondaryArts.map((artUrl, i) => (
                            <img
                              key={i}
                              src={artUrl}
                              alt=""
                              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover ring-1 ring-slate-950"
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-slate-200 border border-white/10 truncate">
                        {card.items.length} {card.items.length === 1 ? 'bit' : 'bits'}
                      </span>
                    </div>

                    {/* Bottom-Right: Quick Play / Pause Floating Button */}
                    <button
                      type="button"
                      disabled={card.items.length === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isCardPlaying) {
                          onPauseSnippet();
                        } else if (card.items.length > 0) {
                          if (card.mode === 'favorites') {
                            setFilterMode('favorites');
                            onSelectPlaylist(null);
                          } else if (card.mode === 'recent') {
                            setFilterMode('recent');
                            onSelectPlaylist(null);
                          } else if (card.mode === 'all') {
                            setFilterMode('all');
                            onSelectPlaylist(null);
                          } else {
                            setFilterMode('all');
                            onSelectPlaylist(card.playlistId);
                          }
                          setShowHomeScreen(false);
                          onPlayEntirePlaylist(card.playlistId, card.items);
                        }
                      }}
                      className={`absolute bottom-2 right-2 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-xl transition active:scale-90 cursor-pointer disabled:opacity-40 ${
                        isCardPlaying
                          ? 'bg-amber-400 text-slate-950'
                          : 'theme-btn-primary'
                      }`}
                      title={isCardPlaying ? `Pause ${card.name}` : `Play ${card.name}`}
                      aria-label={isCardPlaying ? `Pause ${card.name}` : `Play ${card.name}`}
                    >
                      {isCardPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Card Footer: Playlist Name & Top-Listened Album Metadata */}
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-1.5">
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-extrabold text-white truncate">
                        {card.name}
                      </h3>
                      {topAlbum ? (
                        <p
                          className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5"
                          title={`Top Album: ${topAlbum.albumName} by ${topAlbum.artistName}`}
                        >
                          <span className="text-slate-300 font-semibold">{topAlbum.albumName}</span>
                          <span className="mx-1 opacity-50">•</span>
                          <span>{topAlbum.artistName}</span>
                        </p>
                      ) : (
                        <p className="text-[10px] sm:text-[11px] text-slate-500 truncate mt-0.5">
                          No snippets yet
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/[0.05]">
                      <span className="font-medium truncate">
                        {card.items.length} {card.items.length === 1 ? 'track' : 'tracks'}
                      </span>
                      <span className="flex items-center gap-1 theme-text-accent font-mono font-semibold shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTotalDuration(card.items)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Create New Playlist Card */}
            <button
              type="button"
              onClick={() => {
                const name = prompt('Enter new Playlist name:');
                if (name && name.trim()) {
                  onCreatePlaylist(name.trim());
                }
              }}
              className="rounded-2xl bg-slate-900/35 hover:bg-slate-900/70 border border-dashed border-slate-700/80 hover:border-slate-500 p-4 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white transition active:scale-95 cursor-pointer min-h-[190px]"
            >
              <div className="w-10 h-10 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center theme-text-accent">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold">New Playlist</span>
              <span className="text-[10px] text-slate-500 text-center">
                Create a custom bit collection
              </span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Back-to-Playlists-Home Bar */}
          <div className="flex md:hidden items-center justify-between bg-slate-900/70 border border-white/[0.06] rounded-xl px-2.5 py-1.5">
            <button
              type="button"
              onClick={() => setShowHomeScreen(true)}
              className="flex items-center gap-1.5 text-xs font-bold theme-text-accent active:scale-95 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Playlists (Home)</span>
            </button>
            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[50%]">
              {headerTitle}
            </span>
          </div>

          {/* 2. Compact, Elegant View Header */}
          <div className="bg-slate-900/50 border border-white/[0.06] rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex flex-col gap-2 sm:gap-2.5">
            <div className="flex items-center justify-between gap-2">
              {/* Title & Stats */}
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate flex items-center gap-1.5">
                  <span>{headerTitle}</span>
                </h2>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 font-medium">
              <span>{filteredSnippets.length} {filteredSnippets.length === 1 ? 'track' : 'tracks'}</span>
              <span>•</span>
              <span className="flex items-center gap-1 theme-text-accent font-mono text-[10px] sm:text-[11px]">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                {totalBitMins > 0 ? `${totalBitMins}m ` : ''}{totalBitRemainingSec}s
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition ${
                showSearchInput || searchFilter
                  ? 'theme-bg-soft theme-border-accent theme-text-accent'
                  : 'bg-slate-900 hover:bg-slate-800 border-white/[0.06] text-slate-400 hover:text-white'
              }`}
              title="Search snippets"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Delete playlist if custom */}
            {currentPlaylist && (
              confirmDeletePlaylist ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onDeletePlaylist(currentPlaylist.id);
                      setConfirmDeletePlaylist(false);
                    }}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg transition"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmDeletePlaylist(false)}
                    className="px-1.5 py-1 text-slate-400 hover:text-white text-[10px]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDeletePlaylist(true)}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-rose-500/15 border border-white/[0.06] text-slate-400 hover:text-rose-400 transition"
                  title="Delete playlist"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )
            )}

            {/* DJ Mixer Launch Action */}
            {onOpenMixer && (
              <button
                type="button"
                onClick={onOpenMixer}
                className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-400/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer shadow-sm"
                title="Open DJ Mixer for these bits"
              >
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Mixer</span>
              </button>
            )}

            {/* Play All Button */}
            <button
              onClick={() => onPlayEntirePlaylist(activePlaylistId, filteredSnippets)}
              disabled={filteredSnippets.length === 0}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl theme-btn-primary disabled:opacity-40 font-bold text-xs sm:text-sm flex items-center gap-1.5 active:scale-95 transition cursor-pointer shadow-sm"
            >
              <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current ml-0.5" />
              <span>Play All</span>
            </button>
          </div>
        </div>

        {/* Collapsible search bar */}
        {(showSearchInput || searchFilter) && (
          <div className="relative pt-1 animate-in fade-in duration-150">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by song, artist, or notes..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              autoFocus
              className="w-full pl-8.5 pr-8 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Tag pills (if tags exist) */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pt-0.5">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold transition ${
                selectedTag === null
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold transition whitespace-nowrap ${
                  selectedTag === tag
                    ? 'theme-bg-soft theme-text-accent theme-border-accent border'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Snippet List (Mobile-first, touch-friendly rows) */}
      {filteredSnippets.length === 0 ? (
        <div className="py-8 sm:py-12 px-4 text-center bg-slate-900/30 border border-dashed border-slate-800/80 rounded-2xl space-y-2.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl theme-bg-soft theme-text-accent flex items-center justify-center mx-auto">
            <Music className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">No Snippets Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {searchFilter
                ? 'No clips match your current search.'
                : 'Clip any song highlight from Spotify to build your snippet playlist.'}
            </p>
          </div>
          <button
            onClick={onOpenClipper}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 theme-btn-primary font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Clip Music Bit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2.5">
          {filteredSnippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              isPlaying={isPlaying && currentSnippet?.id === snippet.id}
              isCurrent={currentSnippet?.id === snippet.id}
              isLooping={playbackMode === 'repeat-snippet' && currentSnippet?.id === snippet.id && isPlaying}
              onPlay={(s) => {
                onActiveQueueChange?.(filteredSnippets);
                onPlaySnippet(s);
              }}
              onPause={onPauseSnippet}
              onEdit={onEditSnippet}
              onDelete={onDeleteSnippet}
              onToggleLoopSnippet={onToggleLoopSnippet ? () => onToggleLoopSnippet(snippet) : undefined}
              onToggleFavorite={onToggleFavorite}
              onAddToQueue={onAddToQueue}
            />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
};
