import React, { useState } from 'react';
import {
  X,
  Volume2,
  Smartphone,
  Laptop,
  RefreshCw,
  ExternalLink,
  Zap,
  Info,
  Check,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { MusicSnippet, SpotifyDevice } from '../types';
import { spotify } from '../services/spotify';

export interface PlaybackNotice {
  title: string;
  message: string;
  type: 'client_credentials' | 'no_device' | 'premium_required' | 'error';
  snippet?: MusicSnippet | null;
}

interface PlaybackNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  notice: PlaybackNotice | null;
  onOpenSpotifySetup: () => void;
  onRefreshDevices: () => void;
  devices: SpotifyDevice[];
  onSelectDevice: (deviceId: string) => void;
  onRetryPlay?: () => void;
}

export const PlaybackNoticeModal: React.FC<PlaybackNoticeModalProps> = ({
  isOpen,
  onClose,
  notice,
  onOpenSpotifySetup,
  onRefreshDevices,
  devices,
  onSelectDevice,
  onRetryPlay,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  if (!isOpen || !notice) return null;

  const handleSyncFromPC = async () => {
    setIsSyncing(true);
    setSyncStatus('Checking host PC for active Spotify connection...');
    try {
      const active = await spotify.checkServerSession();
      if (active && spotify.getAuthStatus().authMode === 'user_oauth') {
        setSyncStatus('✅ Connected to Spotify account from PC!');
        setTimeout(() => {
          onClose();
          if (onRetryPlay) onRetryPlay();
        }, 1000);
      } else if (active) {
        setSyncStatus('⚠️ Host PC is still in Search-only mode. Please click "Authorize Full Song Playback" on your PC first.');
      } else {
        setSyncStatus('⚠️ No active session found. Please open http://127.0.0.1:4100 on your host PC.');
      }
    } catch (e: any) {
      setSyncStatus(`❌ Sync error: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const isNetworkDevice =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                notice.type === 'client_credentials'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : notice.type === 'no_device'
                  ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {notice.type === 'client_credentials' ? (
                <Zap className="w-5 h-5 fill-current" />
              ) : notice.type === 'no_device' ? (
                <Smartphone className="w-5 h-5" />
              ) : (
                <AlertTriangle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{notice.title}</h3>
              <p className="text-xs text-slate-400">
                {notice.type === 'client_credentials'
                  ? 'Spotify Account Link Required'
                  : notice.type === 'no_device'
                  ? 'Spotify Connect Device Setup'
                  : 'Playback Requirement'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 text-xs text-slate-300">
          {/* Target Track Preview */}
          {notice.snippet && (
            <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <img
                src={notice.snippet.albumArt}
                alt={notice.snippet.title}
                className="w-11 h-11 rounded-lg object-cover shadow"
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white truncate text-xs">{notice.snippet.title}</div>
                <div className="text-slate-400 truncate text-[11px]">{notice.snippet.artist}</div>
                <div className="text-emerald-400 font-mono text-[10px] mt-0.5">
                  Snippet: {notice.snippet.snippetName || 'Highlighted Bit'}
                </div>
              </div>
              <a
                href={notice.snippet.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold text-[11px] flex items-center gap-1 transition shrink-0"
                title="Open in Spotify App"
              >
                <span>Spotify App</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Explanation based on Type */}
          {notice.type === 'client_credentials' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Why didn't audio play on your phone?</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  You are currently in <strong>Search & Snipping Mode</strong> using Server App Credentials.
                  Spotify's Web API <strong>strictly requires linking a personal Spotify account (Spotify Premium)</strong> before remote playback commands can be executed.
                </p>
              </div>

              {isNetworkDevice ? (
                <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/40 rounded-xl space-y-3">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    Enable playback on your mobile device:
                  </h4>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Direct mobile authorization with 192 IP is enabled! You can authorize Spotify right now on this device, or sync if already connected on your PC.
                  </p>

                  {syncStatus && (
                    <div className="p-2 rounded-lg bg-slate-900 border border-indigo-500/30 text-[11px] text-indigo-200">
                      {syncStatus}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSpotifySetup();
                      }}
                      className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] text-xs"
                    >
                      <Zap className="w-4 h-4 fill-current text-slate-950" />
                      <span>Authorize on Mobile</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSyncFromPC}
                      disabled={isSyncing}
                      className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-[0.99] text-xs"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sync from PC</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSpotifySetup();
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <Zap className="w-4 h-4 fill-current text-slate-950" />
                    <span>Authorize Spotify Premium Playback (1-Click)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {notice.type === 'no_device' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/25 rounded-xl space-y-2">
                <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Wake up Spotify Connect on your device</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Spotify Connect needs an active player to stream music through.
                  Open the <strong>Spotify app on your phone, computer, or speakers</strong> and play any track for 1 second to make the device discoverable.
                </p>
              </div>

              {devices.length > 0 ? (
                <div className="space-y-2">
                  <div className="font-semibold text-white">Select a device to play on:</div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {devices.map((dev) => (
                      <button
                        key={dev.id}
                        onClick={() => {
                          onSelectDevice(dev.id);
                          if (onRetryPlay) setTimeout(() => onRetryPlay(), 200);
                          onClose();
                        }}
                        className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between border transition ${
                          dev.is_active
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {dev.type === 'Smartphone' ? (
                            <Smartphone className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Laptop className="w-4 h-4 text-indigo-400" />
                          )}
                          <span className="truncate">{dev.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">{dev.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onRefreshDevices}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Devices</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {notice.type === 'premium_required' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl space-y-2">
                <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Spotify Premium Required</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Spotify's playback API is restricted to Spotify Premium accounts. Free accounts cannot be remote-controlled by third-party applications.
                </p>
              </div>

              {notice.snippet && (
                <a
                  href={notice.snippet.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open & Listen in Spotify App</span>
                </a>
              )}
            </div>
          )}

          {notice.type === 'error' && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl text-slate-300">
              {notice.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSpotifySetup();
            }}
            className="text-slate-400 hover:text-emerald-400 transition text-xs font-semibold"
          >
            Open Spotify Settings
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
