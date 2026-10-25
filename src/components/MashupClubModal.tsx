import React, { useState, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  Wand2,
  Sparkles,
  Layers,
  ArrowRight,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Check,
  Disc3,
  Flame,
  Music,
} from 'lucide-react';
import { MusicSnippet, MashupSegment } from '../types';
import { formatMsToTime } from '../utils/time';

interface MashupClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: MusicSnippet[];
  currentSnippet: MusicSnippet | null;
  onSaveMashup: (mashupSnippet: MusicSnippet) => void;
  onPlaySnippet: (snippet: MusicSnippet, startAtMs?: number, segmentIndex?: number) => void;
  onAutoGenerateMashups?: () => void;
}

export const MashupClubModal: React.FC<MashupClubModalProps> = ({
  isOpen,
  onClose,
  snippets,
  currentSnippet,
  onSaveMashup,
  onPlaySnippet,
  onAutoGenerateMashups,
}) => {
  // Candidate pool: exclude existing mashups to avoid recursion
  const eligibleSnippets = useMemo(() => {
    return snippets.filter((s) => !s.isMashup);
  }, [snippets]);

  // Selected snippets to club (2 or 3)
  const [selectedList, setSelectedList] = useState<MusicSnippet[]>(() => {
    const list: MusicSnippet[] = [];
    if (currentSnippet && !currentSnippet.isMashup) {
      list.push(currentSnippet);
    }
    for (const s of eligibleSnippets) {
      if (list.length >= 2) break;
      if (!list.some((item) => item.id === s.id)) {
        list.push(s);
      }
    }
    return list;
  });

  const [mashupTitle, setMashupTitle] = useState('');
  const [mashupNotes, setMashupNotes] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [previewSnippetId, setPreviewSnippetId] = useState<string | null>(null);

  // Compute suggested title when selected bits change
  const computedDefaultTitle = useMemo(() => {
    if (selectedList.length === 0) return 'New Mashup';
    const titles = selectedList.map((s) => s.snippetName || s.title.split('(')[0].trim());
    return `${titles.join(' × ')} Mashup`;
  }, [selectedList]);

  const activeTitle = mashupTitle.trim() || computedDefaultTitle;

  // Total mashup duration
  const totalDurationMs = useMemo(() => {
    return selectedList.reduce((acc, s) => acc + (s.endMs - s.startMs), 0);
  }, [selectedList]);

  if (!isOpen) return null;

  const handleAddSnippet = (snippet: MusicSnippet) => {
    if (selectedList.length >= 3) {
      alert('You can club up to 3 bits into a single Mashup!');
      return;
    }
    if (selectedList.some((s) => s.id === snippet.id)) return;
    setSelectedList([...selectedList, snippet]);
  };

  const handleRemoveSnippet = (id: string) => {
    setSelectedList(selectedList.filter((s) => s.id !== id));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const next = [...selectedList];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setSelectedList(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= selectedList.length - 1) return;
    const next = [...selectedList];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setSelectedList(next);
  };

  const handleCreateMashup = () => {
    if (selectedList.length < 2) {
      alert('Please select at least 2 bits to create a mashup.');
      return;
    }

    const segments: MashupSegment[] = selectedList.map((s) => ({
      snippetId: s.id,
      title: s.title,
      artist: s.artist,
      albumArt: s.albumArt,
      spotifyUri: s.spotifyUri,
      trackId: s.trackId,
      startMs: s.startMs,
      endMs: s.endMs,
      durationMs: s.endMs - s.startMs,
      snippetName: s.snippetName,
    }));

    const first = selectedList[0];
    const mashupSnippet: MusicSnippet = {
      id: `mashup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: activeTitle,
      artist: selectedList.map((s) => s.artist.split(',')[0].trim()).join(' × '),
      album: `${selectedList.length}-Part Mashup`,
      albumArt: first.albumArt,
      spotifyUri: first.spotifyUri,
      trackId: first.trackId,
      spotifyUrl: first.spotifyUrl,
      durationMs: totalDurationMs,
      startMs: first.startMs,
      endMs: first.endMs,
      snippetName: activeTitle,
      playlistId: 'playlist-auto-mashups',
      notes:
        mashupNotes.trim() ||
        `Clubbed Mashup with ${selectedList.length} bits: ${selectedList.map((s) => s.title).join(' -> ')}`,
      tags: ['Mashup', 'Clubbed', `${selectedList.length}-Bits`],
      createdAt: Date.now(),
      isFavorite: true,
      isMashup: true,
      mashupSegments: segments,
    };

    onSaveMashup(mashupSnippet);
    onClose();
  };

  const filteredPool = eligibleSnippets.filter(
    (s) =>
      !selectedList.some((sel) => sel.id === s.id) &&
      (s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        s.artist.toLowerCase().includes(searchFilter.toLowerCase()) ||
        s.snippetName.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-950 border border-white/[0.1] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <Layers className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5">
                Club Bits into Mashup
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Sequential Flow
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Stitch 2 or 3 saved bits into a continuous, seamless Spotify medley.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Section 1: Selected Bits Sequence */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Mashup Sequence ({selectedList.length}/3 Bits)
              </span>
              <span className="text-xs text-amber-300 font-mono font-semibold">
                Total: {formatMsToTime(totalDurationMs)}
              </span>
            </div>

            {selectedList.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 text-slate-400 text-xs">
                Select 2 or 3 bits from your library below to club them together.
              </div>
            ) : (
              <div className="space-y-2">
                {selectedList.map((item, idx) => {
                  const cutDuration = item.endMs - item.startMs;
                  const isPlaying = previewSnippetId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 sm:p-3 rounded-2xl bg-slate-900/90 border border-white/[0.08] flex items-center gap-2.5 sm:gap-3 transition hover:border-white/[0.15]"
                    >
                      {/* Step Number */}
                      <div className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 font-mono text-xs font-extrabold flex items-center justify-center shrink-0 border border-white/[0.06]">
                        {idx + 1}
                      </div>

                      {/* Art */}
                      <img
                        src={item.albumArt}
                        alt={item.title}
                        className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/[0.08]"
                      />

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.snippetName || item.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                          <span>{item.artist}</span>
                          <span>•</span>
                          <span className="font-mono text-amber-300 font-semibold">
                            {formatMsToTime(item.startMs)} - {formatMsToTime(item.endMs)} (
                            {Math.round(cutDuration / 1000)}s)
                          </span>
                        </div>
                      </div>

                      {/* Play Preview */}
                      <button
                        onClick={() => {
                          if (isPlaying) {
                            setPreviewSnippetId(null);
                          } else {
                            setPreviewSnippetId(item.id);
                            onPlaySnippet(item, item.startMs);
                          }
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white transition active:scale-95 shrink-0"
                        title="Listen to this cut"
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      {/* Move Up/Down */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMoveUp(idx)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 transition"
                          title="Move up"
                        >
                          <MoveUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={idx === selectedList.length - 1}
                          onClick={() => handleMoveDown(idx)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 transition"
                          title="Move down"
                        >
                          <MoveDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemoveSnippet(item.id)}
                        className="p-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition shrink-0"
                        title="Remove from mashup"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Mashup Metadata */}
          {selectedList.length >= 2 && (
            <div className="p-3.5 rounded-2xl bg-slate-900/40 border border-white/[0.06] space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Mashup Title
                </label>
                <input
                  type="text"
                  placeholder={computedDefaultTitle}
                  value={mashupTitle}
                  onChange={(e) => setMashupTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/[0.1] text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Perfect transition from bridge to chorus"
                  value={mashupNotes}
                  onChange={(e) => setMashupNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          {/* Section 3: Selectable Library Bits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-indigo-400" />
                Add from Library ({eligibleSnippets.length} Bits Available)
              </span>

              {/* Auto Mashup Trigger */}
              {onAutoGenerateMashups && (
                <button
                  onClick={onAutoGenerateMashups}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 flex items-center gap-1 transition"
                  title="Automatically generate mashups based on your listening history"
                >
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Auto-Mashups</span>
                </button>
              )}
            </div>

            <input
              type="text"
              placeholder="Search bits by title, artist, or snippet name..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900/80 border border-white/[0.08] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />

            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {filteredPool.slice(0, 20).map((s) => (
                <div
                  key={s.id}
                  className="p-2 rounded-xl bg-slate-900/50 hover:bg-slate-850 border border-white/[0.04] flex items-center justify-between gap-2 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={s.albumArt}
                      alt={s.title}
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {s.snippetName || s.title}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {s.artist} • {Math.round((s.endMs - s.startMs) / 1000)}s
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={selectedList.length >= 3}
                    onClick={() => handleAddSnippet(s)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Club</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-white/[0.08] bg-slate-900/70 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>

          <button
            disabled={selectedList.length < 2}
            onClick={handleCreateMashup}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-rose-500/25 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Wand2 className="w-4 h-4" />
            <span>Create {selectedList.length}-Part Mashup</span>
          </button>
        </div>
      </div>
    </div>
  );
};
