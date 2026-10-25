import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Search,
  Radio,
  Scissors,
  Play,
  PlayCircle,
  Pause,
  Square,
  Sparkles,
  Repeat,
  Repeat1,
  Music2,
  Plus,
  Clock,
  ExternalLink,
  ChevronRight,
  RotateCcw,
  Volume2,
  Check,
  FastForward,
  Rewind,
  Crosshair,
  Lock,
  Unlock,
  Zap,
  Laptop,
  Smartphone,
  Speaker,
  RefreshCw,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MusicSnippet, SnippetPlaylist, SpotifyDevice, SpotifyTrackResult } from '../types';
import { spotify } from '../services/spotify';
import { audioEngine } from '../services/audioEngine';
import { getSpotifyCredentialsFromFirestore, saveSpotifyCredentialsToFirestore } from '../services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { formatMsToDetailed, formatMsToTime, formatSnippetDuration } from '../utils/time';

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: any) => void;
    SpotifyIframeApi?: any;
  }
}

interface SnippetClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: SnippetPlaylist[];
  onSaveSnippet: (snippet: MusicSnippet) => void;
  onCreatePlaylist: (name: string) => string;
  initialTrack?: Partial<SpotifyTrackResult> | null;
  initialSnippet?: MusicSnippet | null;
  onDeleteSnippet?: (id: string) => void;
  isSpotifyAuth?: boolean;
  hasStoredSpotifyCreds?: boolean;
  devices?: SpotifyDevice[];
  activeDevice?: SpotifyDevice | null;
  onSelectDevice?: (deviceId: string) => void;
  onOpenSpotifySetup?: () => void;
  googleUser?: FirebaseUser | null;
}

export const SnippetClipperModal: React.FC<SnippetClipperModalProps> = ({
  isOpen,
  onClose,
  playlists,
  onSaveSnippet,
  onCreatePlaylist,
  initialTrack,
  initialSnippet,
  onDeleteSnippet,
  isSpotifyAuth,
  hasStoredSpotifyCreds,
  devices = [],
  activeDevice,
  onSelectDevice,
  onOpenSpotifySetup,
  googleUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrackResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [confirmDeleteInModal, setConfirmDeleteInModal] = useState(false);
  const [loopCount, setLoopCount] = useState<number>(0);

  // Selected Track
  const [selectedTrack, setSelectedTrack] = useState<{
    id: string;
    title: string;
    artist: string;
    album: string;
    albumArt: string;
    durationMs: number;
    uri: string;
    url: string;
  } | null>(null);

  // Snippet Timestamps
  const [startMs, setStartMs] = useState<number>(0);
  const [endMs, setEndMs] = useState<number>(30000);
  const [snippetName, setSnippetName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(playlists[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('highlight, favorite');

  // Spotify live tracking & automatic seconds synchronization
  const [spotifyCurrentMs, setSpotifyCurrentMs] = useState<number>(0);
  const [isSpotifyPlaying, setIsSpotifyPlaying] = useState<boolean>(false);
  const [isFullSongPlaying, setIsFullSongPlaying] = useState<boolean>(false);
  const [isLiveAutoFollowEnd, setIsLiveAutoFollowEnd] = useState<boolean>(false);
  const [isTestingSnippetOnSpotify, setIsTestingSnippetOnSpotify] = useState<boolean>(false);
  const [isRepeatSnippet, setIsRepeatSnippet] = useState<boolean>(false);
  const [testSnippetTimer, setTestSnippetTimer] = useState<number | null>(null);
  const testSnippetTimerRef = useRef<number | null>(null);
  const isRepeatSnippetRef = useRef<boolean>(false);
  const isFullSongPlayingRef = useRef<boolean>(false);
  const isTestingSnippetOnSpotifyRef = useRef<boolean>(false);
  const showEmbedPreviewRef = useRef<boolean>(false);

  // Point B Guard state (strictly prevents audio from playing past Point B)
  const [stopAtPointB, setStopAtPointB] = useState<boolean>(true);
  const stopAtPointBRef = useRef<boolean>(true);
  const startMsRef = useRef<number>(startMs);
  const endMsRef = useRef<number>(endMs);

  useEffect(() => {
    startMsRef.current = startMs;
  }, [startMs]);

  useEffect(() => {
    endMsRef.current = endMs;
  }, [endMs]);

  useEffect(() => {
    stopAtPointBRef.current = stopAtPointB;
  }, [stopAtPointB]);

  useEffect(() => {
    isRepeatSnippetRef.current = isRepeatSnippet;
  }, [isRepeatSnippet]);

  useEffect(() => {
    isFullSongPlayingRef.current = isFullSongPlaying;
  }, [isFullSongPlaying]);

  useEffect(() => {
    isTestingSnippetOnSpotifyRef.current = isTestingSnippetOnSpotify;
  }, [isTestingSnippetOnSpotify]);

  // Spotify Authentication & Device states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(isSpotifyAuth ?? spotify.getAuthStatus().authenticated)
  );
  const [showEmbedPreview, setShowEmbedPreview] = useState<boolean>(false);

  useEffect(() => {
    showEmbedPreviewRef.current = showEmbedPreview;
  }, [showEmbedPreview]);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(activeDevice?.id || '');
  const [localDevices, setLocalDevices] = useState<SpotifyDevice[]>(devices || []);
  const [isAutoConnecting, setIsAutoConnecting] = useState<boolean>(false);
  const [playbackErrorMessage, setPlaybackErrorMessage] = useState<string | null>(null);
  const [showDeviceSelector, setShowDeviceSelector] = useState<boolean>(false);

  const selectedDeviceIdRef = useRef(selectedDeviceId);
  const activeDeviceRef = useRef(activeDevice);
  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);
  useEffect(() => {
    activeDeviceRef.current = activeDevice;
  }, [activeDevice]);

  // Stop all playback immediately (for modal close, save, or cancel)
  const stopAllClipperPlayback = useCallback(async () => {
    if (testSnippetTimerRef.current) {
      clearTimeout(testSnippetTimerRef.current);
      testSnippetTimerRef.current = null;
    }
    setTestSnippetTimer(null);
    setIsTestingSnippetOnSpotify(false);
    isTestingSnippetOnSpotifyRef.current = false;
    setIsRepeatSnippet(false);
    isRepeatSnippetRef.current = false;
    setLoopCount(0);
    setIsSpotifyPlaying(false);
    setIsFullSongPlaying(false);
    isFullSongPlayingRef.current = false;

    try {
      const targetDev = selectedDeviceIdRef.current || activeDeviceRef.current?.id || null;
      await spotify.pause(targetDev);
    } catch (e) {
      console.warn('Failed to pause Spotify on clipper exit:', e);
    }

    if (embedControllerRef.current) {
      try {
        embedControllerRef.current.pause();
      } catch (e) {}
    }

    try {
      audioEngine.stopAll();
    } catch (e) {}
  }, []);

  const handleCloseModal = async () => {
    await stopAllClipperPlayback();
    onClose();
  };

  const stopAllClipperPlaybackRef = useRef(stopAllClipperPlayback);
  useEffect(() => {
    stopAllClipperPlaybackRef.current = stopAllClipperPlayback;
  }, [stopAllClipperPlayback]);

  // Stop playback ONLY when component actually unmounts from the DOM
  useEffect(() => {
    return () => {
      stopAllClipperPlaybackRef.current();
    };
  }, []);

  // Confirmation banner when noting timestamps
  const [notedBanner, setNotedBanner] = useState<{
    message: string;
    type: 'start' | 'end';
  } | null>(null);

  const [isLoadingCurrentlyPlaying, setIsLoadingCurrentlyPlaying] = useState(false);
  const [grabError, setGrabError] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const embedControllerRef = useRef<any>(null);

  // 1. Initialize modal state & ensure playback stops when closed
  useEffect(() => {
    if (!isOpen) {
      stopAllClipperPlayback();
      return;
    }

    if (initialSnippet) {
      setSelectedTrack({
        id: initialSnippet.trackId,
        title: initialSnippet.title,
        artist: initialSnippet.artist,
        album: initialSnippet.album,
        albumArt: initialSnippet.albumArt,
        durationMs: initialSnippet.durationMs,
        uri: initialSnippet.spotifyUri,
        url: initialSnippet.spotifyUrl,
      });
      setStartMs(initialSnippet.startMs);
      setEndMs(initialSnippet.endMs);
      setSpotifyCurrentMs(initialSnippet.startMs);
      setSnippetName(initialSnippet.snippetName);
      setSelectedPlaylistId(initialSnippet.playlistId);
      setNotes(initialSnippet.notes || '');
      setTags(initialSnippet.tags?.join(', ') || '');
    } else if (initialTrack && initialTrack.id) {
      loadTrackDetails(initialTrack.id);
    } else {
      setSelectedTrack(null);
      setStartMs(0);
      setEndMs(30000);
      setSpotifyCurrentMs(0);
      setSnippetName('');
      setNotes('');
      setTags('');
    }
  }, [initialSnippet, initialTrack, isOpen]);

  // Sync selected playlist
  useEffect(() => {
    if (playlists.length > 0 && !selectedPlaylistId) {
      setSelectedPlaylistId(playlists[0].id);
    }
  }, [playlists, selectedPlaylistId]);

  // Sync auth and device state
  const refreshLocalDevices = useCallback(async () => {
    if (!spotify.getAuthStatus().authenticated) return;
    try {
      const devList = await spotify.getDevices();
      setLocalDevices(devList);
      if (devList.length > 0) {
        const preferred = spotify.resolvePreferredDevice(devList);
        if (preferred && (!selectedDeviceId || !devList.some((d) => d.id === selectedDeviceId))) {
          setSelectedDeviceId(preferred.id);
        }
      }
    } catch (e) {}
  }, [selectedDeviceId]);

  useEffect(() => {
    setIsAuthenticated(Boolean(isSpotifyAuth ?? spotify.getAuthStatus().authenticated));
    const unsub = spotify.subscribeAuth((status) => {
      setIsAuthenticated(status.authenticated);
      if (status.authenticated) {
        refreshLocalDevices();
      }
    });
    return unsub;
  }, [isSpotifyAuth, refreshLocalDevices]);

  useEffect(() => {
    if (devices && devices.length > 0) {
      setLocalDevices(devices);
      const preferred = spotify.resolvePreferredDevice(devices);
      if (preferred && (!selectedDeviceId || (spotify.isMobileEnvironment() && !spotify.getUserSelectedDeviceId()))) {
        setSelectedDeviceId(preferred.id);
      }
    }
  }, [devices, selectedDeviceId]);

  // Attempt auto-connect from stored Firestore credentials on modal open if disconnected
  useEffect(() => {
    if (!isOpen) return;
    if (!spotify.getAuthStatus().authenticated && googleUser) {
      getSpotifyCredentialsFromFirestore(googleUser.uid)
        .then(async (creds) => {
          if (creds && creds.clientId) {
            const res = await spotify.autoConnectFromCredentials(creds);
            if (res.success) {
              setIsAuthenticated(true);
              refreshLocalDevices();
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, googleUser, refreshLocalDevices]);

  // 2. Initialize official Spotify Embed Iframe API to receive playback_update events
  useEffect(() => {
    if (!isOpen || !selectedTrack) return;

    // Load Spotify IFrame API script dynamically if not already present
    if (!document.getElementById('spotify-iframe-api-script')) {
      const script = document.createElement('script');
      script.id = 'spotify-iframe-api-script';
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      document.body.appendChild(script);
    }

    const initEmbedController = (IFrameAPI: any) => {
      const container = document.getElementById('spotify-embed-controller-target');
      if (!container) return;

      const options = {
        uri: selectedTrack.uri,
        width: '100%',
        height: 152,
      };

      try {
        IFrameAPI.createController(container, options, (EmbedController: any) => {
          embedControllerRef.current = EmbedController;

          // Listen to playback_update from embedded Spotify player
          EmbedController.addListener('playback_update', (e: any) => {
            if (e && e.data) {
              const pos = e.data.position;
              const isPaused = e.data.isPaused;
              // Only update if using the embedded iframe player and NOT playing via Spotify Connect Web API
              if (showEmbedPreviewRef.current && !isFullSongPlayingRef.current && !isTestingSnippetOnSpotifyRef.current) {
                if (typeof pos === 'number') {
                  setSpotifyCurrentMs(pos);
                }
                if (typeof isPaused === 'boolean') {
                  setIsSpotifyPlaying(!isPaused);
                }
              }
            }
          });
        });
      } catch (err) {
        console.warn('Could not initialize Spotify Embed Controller:', err);
      }
    };

    if (window.SpotifyIframeApi) {
      initEmbedController(window.SpotifyIframeApi);
    } else {
      window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
        window.SpotifyIframeApi = IFrameAPI;
        initEmbedController(IFrameAPI);
      };
    }
  }, [isOpen, selectedTrack?.id]);

  // 3. Listen to window message events directly from the Spotify embed iframe
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowMessage = (event: MessageEvent) => {
      try {
        let payload = event.data;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch (e) {}
        }
        if (payload) {
          // Detect Spotify playback_update event
          if (
            payload.type === 'playback_update' ||
            payload.position !== undefined ||
            payload.data?.position !== undefined
          ) {
            const pos = payload.data?.position ?? payload.position;
            const isPaused = payload.data?.isPaused ?? payload.isPaused;

            // Only update from embedded iframe preview if user is using it and not playing via Spotify Connect
            if (showEmbedPreviewRef.current && !isFullSongPlayingRef.current && !isTestingSnippetOnSpotifyRef.current) {
              if (typeof pos === 'number') {
                setSpotifyCurrentMs(pos);
              }
              if (typeof isPaused === 'boolean') {
                setIsSpotifyPlaying(!isPaused);
              }
            }
          }
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [isOpen]);

  // 4. Smooth clock advance when playing so seconds match automatically in real time
  useEffect(() => {
    if (!isSpotifyPlaying || !selectedTrack) return;

    const tick = setInterval(() => {
      setSpotifyCurrentMs((prev) => {
        const next = prev + 100;
        if (next >= selectedTrack.durationMs) {
          setIsSpotifyPlaying(false);
          return selectedTrack.durationMs;
        }

        // If Auto-Follow End is active, automatically match Point B with current second!
        if (isLiveAutoFollowEnd && next > startMsRef.current) {
          setEndMs(Math.round(next));
        }

        // Point B Cutoff Watchdog:
        // When testing snippet OR when Point B Guard is active, enforce endMs strictly!
        const targetDev = selectedDeviceIdRef.current || activeDeviceRef.current?.id || null;
        const isLocalWeb = Boolean(targetDev && targetDev === spotify.getWebPlaybackDeviceId());
        const leadTime = isLocalWeb ? 30 : 450;
        const cutoffThreshold = Math.max(startMsRef.current + 300, endMsRef.current - leadTime);
        const shouldStopAtB =
          isTestingSnippetOnSpotifyRef.current ||
          (stopAtPointBRef.current && prev < endMsRef.current);

        if (shouldStopAtB && next >= cutoffThreshold) {
          if (isRepeatSnippetRef.current) {
            spotify.seek(startMsRef.current, targetDev);
            return startMsRef.current;
          } else {
            spotify.pause(targetDev);
            setIsSpotifyPlaying(false);
            setIsTestingSnippetOnSpotify(false);
            isTestingSnippetOnSpotifyRef.current = false;
            setIsFullSongPlaying(false);
            isFullSongPlayingRef.current = false;
            if (testSnippetTimerRef.current) {
              clearTimeout(testSnippetTimerRef.current);
              testSnippetTimerRef.current = null;
            }
            return endMsRef.current;
          }
        }

        return next;
      });
    }, 100);

    return () => clearInterval(tick);
  }, [isSpotifyPlaying, selectedTrack, isLiveAutoFollowEnd]);

  // 5. Poll Spotify Web API as additional sync source if playing on Spotify app
  useEffect(() => {
    if (!isOpen || !selectedTrack) return;

    const pollSpotifyAPI = async () => {
      try {
        const cur = await spotify.getCurrentlyPlaying();
        if (cur && cur.item && cur.item.id === selectedTrack.id) {
          const targetDev = selectedDeviceIdRef.current || activeDeviceRef.current?.id || null;
          const isLocalWeb = Boolean(targetDev && targetDev === spotify.getWebPlaybackDeviceId());
          const leadTime = isLocalWeb ? 30 : 450;
          const cutoffThreshold = Math.max(startMsRef.current + 300, endMsRef.current - leadTime);
          const shouldStopAtB =
            isTestingSnippetOnSpotifyRef.current ||
            (stopAtPointBRef.current && cur.progress_ms < endMsRef.current + 2500);

          if (shouldStopAtB && cur.progress_ms >= cutoffThreshold && cur.is_playing) {
            console.log('🛑 Clipper Watchdog: Spotify progress_ms reached Point B cutoff:', cur.progress_ms);
            if (isRepeatSnippetRef.current) {
              await spotify.seek(startMsRef.current, targetDev);
              setSpotifyCurrentMs(startMsRef.current);
            } else {
              await spotify.pause(targetDev);
              setIsSpotifyPlaying(false);
              setIsTestingSnippetOnSpotify(false);
              isTestingSnippetOnSpotifyRef.current = false;
              setIsFullSongPlaying(false);
              isFullSongPlayingRef.current = false;
              if (testSnippetTimerRef.current) {
                clearTimeout(testSnippetTimerRef.current);
                testSnippetTimerRef.current = null;
              }
              setSpotifyCurrentMs(endMsRef.current);
            }
            return;
          }

          setSpotifyCurrentMs(cur.progress_ms);
          setIsSpotifyPlaying(cur.is_playing);
        }
      } catch (e) {}
    };

    const interval = setInterval(pollSpotifyAPI, 1000);
    return () => clearInterval(interval);
  }, [isOpen, selectedTrack]);

  if (!isOpen) return null;

  // Search Spotify Catalog
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const parsed = spotify.parseSpotifyInput(searchQuery);
    if (parsed.trackId) {
      await loadTrackDetails(parsed.trackId);
      setSearchQuery('');
      return;
    }

    setIsSearching(true);
    try {
      const results = await spotify.searchTracks(searchQuery, 6);
      setSearchResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const loadTrackDetails = async (trackId: string) => {
    setIsSearching(true);
    const details = await spotify.getTrackDetails(trackId);
    if (details) {
      const duration = details.duration_ms || 240000;
      setSelectedTrack({
        id: trackId,
        title: details.name || 'Unknown Track',
        artist: details.artists?.[0]?.name || 'Unknown Artist',
        album: details.album?.name || '',
        albumArt:
          details.album?.images?.[0]?.url ||
          'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
        durationMs: duration,
        uri: details.uri || `spotify:track:${trackId}`,
        url: details.external_urls?.spotify || `https://open.spotify.com/track/${trackId}`,
      });
      setStartMs(0);
      setEndMs(Math.min(30000, duration));
      setSpotifyCurrentMs(0);
      setSnippetName(`${details.name || 'Song'} Highlight`);
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  // Grab currently playing track from active Spotify session
  const handleGrabCurrentlyPlaying = async () => {
    setIsLoadingCurrentlyPlaying(true);
    setGrabError(null);
    try {
      const current = await spotify.getCurrentlyPlaying();
      if (!current || !current.item) {
        setGrabError('No active playback found on Spotify. Play a song on Spotify and try again!');
        return;
      }
      const item = current.item;
      const progress = current.progress_ms || 0;
      const duration = item.duration_ms || 240000;

      setSelectedTrack({
        id: item.id,
        title: item.name,
        artist: item.artists?.[0]?.name || 'Unknown Artist',
        album: item.album?.name || '',
        albumArt: item.album?.images?.[0]?.url || '',
        durationMs: duration,
        uri: item.uri,
        url: item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`,
      });

      setSpotifyCurrentMs(progress);
      setStartMs(progress);
      setEndMs(Math.min(progress + 30000, duration));
      setSnippetName(`${item.name} Snippet`);
      setIsSpotifyPlaying(current.is_playing);
      audioEngine.playCueSound(784);
    } catch (err: any) {
      setGrabError('Could not connect to Spotify session.');
    } finally {
      setIsLoadingCurrentlyPlaying(false);
    }
  };

  // -------------------------------------------------------------
  // NOTE START TIME & NOTE END TIME (MATCHES EXACT PLAYING SECONDS!)
  // -------------------------------------------------------------
  const handleNoteStartTime = async () => {
    let captured = Math.round(spotifyCurrentMs);

    // Also check fresh Spotify Web API reading
    try {
      const cur = await spotify.getCurrentlyPlaying();
      if (cur && cur.progress_ms !== undefined) {
        captured = Math.round(cur.progress_ms);
        setSpotifyCurrentMs(captured);
      }
    } catch (e) {}

    setStartMs(captured);
    if (endMs <= captured) {
      const newEnd = Math.min(selectedTrack?.durationMs || captured + 30000, captured + 15000);
      setEndMs(newEnd);
    }

    audioEngine.playCueSound(880);
    setNotedBanner({
      message: `Start Time (Point A) set to ${formatMsToDetailed(captured)}`,
      type: 'start',
    });
    setTimeout(() => setNotedBanner(null), 3000);
  };

  const handleNoteEndTime = async () => {
    let captured = Math.round(spotifyCurrentMs);

    // Also check fresh Spotify Web API reading
    try {
      const cur = await spotify.getCurrentlyPlaying();
      if (cur && cur.progress_ms !== undefined) {
        captured = Math.round(cur.progress_ms);
        setSpotifyCurrentMs(captured);
      }
    } catch (e) {}

    if (captured <= startMs) {
      setEndMs(Math.max(captured, startMs + 1000));
    } else {
      setEndMs(captured);
    }

    audioEngine.playCueSound(1046.5);
    setNotedBanner({
      message: `End Time (Point B) set to ${formatMsToDetailed(captured)}`,
      type: 'end',
    });
    setTimeout(() => setNotedBanner(null), 3000);
  };

  // Device icon helper
  const getDeviceIcon = (type?: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('phone') || t.includes('mobile')) return <Smartphone className="w-3.5 h-3.5" />;
    if (t.includes('speaker') || t.includes('audio') || t.includes('cast')) return <Speaker className="w-3.5 h-3.5" />;
    return <Laptop className="w-3.5 h-3.5" />;
  };

  // Connect Spotify User OAuth (for Spotify Premium playback using same Client ID & Secret)
  const handleConnectPremiumOAuth = async (action: 'play_full' | 'test_snippet' | 'repeat_snippet' = 'play_full') => {
    setIsAutoConnecting(true);
    setPlaybackErrorMessage(null);
    try {
      let clientId = '';
      let clientSecret = '';
      if (googleUser) {
        const creds = await getSpotifyCredentialsFromFirestore(googleUser.uid);
        if (creds) {
          clientId = creds.clientId || '';
          clientSecret = creds.clientSecret || '';
        }
      }

      if (!clientId || !clientSecret) {
        const stored = spotify.getStoredCredentials();
        clientId = clientId || stored.clientId;
        clientSecret = clientSecret || stored.clientSecret;
      }

      const result = await spotify.startUserOAuthFlow(
        clientId,
        clientSecret,
        async (user, refreshToken) => {
          spotify.saveStoredCredentials(clientId, clientSecret, refreshToken);
          if (googleUser && clientId && refreshToken) {
            await saveSpotifyCredentialsToFirestore(googleUser.uid, clientId, clientSecret, refreshToken);
          }
        }
      );

      if (result.success) {
        setIsAuthenticated(true);
        audioEngine.playCueSound(1046.5);
        await refreshLocalDevices();
        setPlaybackErrorMessage(null);
        // Automatically start full song playback or snippet test if a track is chosen!
        if (selectedTrack) {
          setTimeout(() => {
            if (action === 'repeat_snippet') {
              setIsRepeatSnippet(true);
              handleTestSnippetOnSpotify();
            } else if (action === 'test_snippet') {
              handleTestSnippetOnSpotify();
            } else {
              handlePlayFullSong();
            }
          }, 350);
        }
      } else if (result.error) {
        setPlaybackErrorMessage(result.error);
      }
    } catch (e: any) {
      setPlaybackErrorMessage(e.message || 'Could not connect Spotify Premium account');
    } finally {
      setIsAutoConnecting(false);
    }
  };

  // Connect or Auto-Connect Spotify
  const handleConnectSpotify = async () => {
    setIsAutoConnecting(true);
    setPlaybackErrorMessage(null);
    try {
      // 0. Check if server already has active session (from PC auth or server credentials)
      const serverActive = await spotify.checkServerSession();
      if (serverActive) {
        audioEngine.playCueSound(1046.5);
        setIsAuthenticated(true);
        await refreshLocalDevices();
        setIsAutoConnecting(false);
        if (selectedTrack && spotify.getAuthStatus().isPremium) {
          setTimeout(() => handlePlayFullSong(), 300);
        }
        return;
      }

      let clientId = '';
      let clientSecret = '';
      let refreshToken = '';

      if (googleUser) {
        const creds = await getSpotifyCredentialsFromFirestore(googleUser.uid);
        if (creds) {
          clientId = creds.clientId || '';
          clientSecret = creds.clientSecret || '';
          refreshToken = creds.refreshToken || '';
        }
      }

      if (!clientId || !clientSecret) {
        const stored = spotify.getStoredCredentials();
        clientId = clientId || stored.clientId;
        clientSecret = clientSecret || stored.clientSecret;
        refreshToken = refreshToken || stored.refreshToken || '';
      }

      // If refresh token exists, auto-connect to existing User OAuth session
      if (clientId && clientSecret && refreshToken) {
        const res = await spotify.autoConnectFromCredentials({ clientId, clientSecret, refreshToken });
        if (res.success && res.mode === 'oauth_refresh') {
          audioEngine.playCueSound(1046.5);
          setIsAuthenticated(true);
          await refreshLocalDevices();
          setIsAutoConnecting(false);
          if (selectedTrack) {
            setTimeout(() => handlePlayFullSong(), 300);
          }
          return;
        }
      }

      // If Client ID & Secret exist, directly launch OAuth to authorize Premium with same credentials
      if (clientId) {
        setIsAutoConnecting(false);
        await handleConnectPremiumOAuth();
        return;
      }
    } catch (e) {
      console.warn('Auto connect in clipper failed:', e);
    }
    setIsAutoConnecting(false);
    if (onOpenSpotifySetup) {
      onOpenSpotifySetup();
    }
  };

  // Play full song continuously on Spotify (not 30s preview)
  const handlePlayFullSong = async (startPosMs?: number) => {
    if (!selectedTrack) return;
    setPlaybackErrorMessage(null);

    if (testSnippetTimerRef.current) {
      clearTimeout(testSnippetTimerRef.current);
      testSnippetTimerRef.current = null;
    }
    if (testSnippetTimer) {
      clearTimeout(testSnippetTimer);
      setTestSnippetTimer(null);
    }
    setIsTestingSnippetOnSpotify(false);
    isTestingSnippetOnSpotifyRef.current = false;

    const auth = spotify.getAuthStatus();
    if (!auth.authenticated) {
      await handleConnectSpotify();
      return;
    }

    if (auth.authMode === 'client_credentials') {
      // Check if we can silently refresh to User OAuth
      const stored = spotify.getStoredCredentials();
      if (stored.clientId && stored.clientSecret && stored.refreshToken) {
        setIsAutoConnecting(true);
        const res = await spotify.autoConnectFromCredentials({
          clientId: stored.clientId,
          clientSecret: stored.clientSecret,
          refreshToken: stored.refreshToken,
        });
        setIsAutoConnecting(false);
        if (res.success && res.mode === 'oauth_refresh') {
          setIsAuthenticated(true);
          await refreshLocalDevices();
          handlePlayFullSong(startPosMs);
          return;
        }
      }

      // Automatically launch 1-click authorization with the SAME Client ID and Secret!
      await handleConnectPremiumOAuth('play_full');
      return;
    }

    const pos = startPosMs !== undefined ? startPosMs : spotifyCurrentMs;
    const targetDev = selectedDeviceId || activeDevice?.id || null;
    const res = await spotify.playTrack(selectedTrack.uri, pos, targetDev);

    if (res.success) {
      setIsSpotifyPlaying(true);
      setIsFullSongPlaying(true);
      setPlaybackErrorMessage(null);
      audioEngine.playCueSound(784);
    } else {
      setIsSpotifyPlaying(false);
      setIsFullSongPlaying(false);
      const isDeviceIssue = res.error?.toLowerCase().includes('device') || res.error?.includes('404');
      setPlaybackErrorMessage(
        isDeviceIssue
          ? 'No active Spotify player detected. Please open Spotify (on phone, computer, or web) and click play once to wake up Spotify Connect, then click Play Full Song here.'
          : (res.error || 'Could not start Spotify playback.')
      );
    }
  };

  // Pause playback
  const handlePauseFullSong = async () => {
    if (testSnippetTimerRef.current) {
      clearTimeout(testSnippetTimerRef.current);
      testSnippetTimerRef.current = null;
    }
    if (testSnippetTimer) {
      clearTimeout(testSnippetTimer);
      setTestSnippetTimer(null);
    }
    setIsTestingSnippetOnSpotify(false);
    isTestingSnippetOnSpotifyRef.current = false;
    const targetDev = selectedDeviceId || activeDevice?.id || null;
    await spotify.pause(targetDev);
    setIsSpotifyPlaying(false);
    setIsFullSongPlaying(false);
    isFullSongPlayingRef.current = false;
    audioEngine.playCueSound(523.25);
  };

  // Seek playback in full song
  const handleSeek = async (targetMs: number) => {
    if (!selectedTrack) return;
    const clamped = Math.max(0, Math.min(selectedTrack.durationMs, Math.round(targetMs)));
    setSpotifyCurrentMs(clamped);

    if (embedControllerRef.current) {
      try {
        embedControllerRef.current.seek(Math.floor(clamped / 1000));
      } catch (e) {}
    }

    if (spotify.getAuthStatus().authenticated) {
      const targetDev = selectedDeviceId || activeDevice?.id || null;
      await spotify.seek(clamped, targetDev);
    }
    audioEngine.playCueSound(784);
  };

  const handleSelectDeviceLocal = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (onSelectDevice) onSelectDevice(deviceId);
    await spotify.transferPlayback(deviceId, isSpotifyPlaying);
    setShowDeviceSelector(false);
  };

  // Play snippet on Spotify directly from Point A to Point B
  const handleTestSnippetOnSpotify = async () => {
    if (!selectedTrack) return;

    if (isTestingSnippetOnSpotify) {
      if (testSnippetTimerRef.current) {
        clearTimeout(testSnippetTimerRef.current);
        testSnippetTimerRef.current = null;
      }
      if (testSnippetTimer) clearTimeout(testSnippetTimer);
      setIsTestingSnippetOnSpotify(false);
      isTestingSnippetOnSpotifyRef.current = false;
      setLoopCount(0);
      const targetDev = selectedDeviceId || activeDevice?.id || null;
      await spotify.pause(targetDev);
      setIsSpotifyPlaying(false);
      return;
    }

    const auth = spotify.getAuthStatus();
    if (!auth.authenticated) {
      await handleConnectSpotify();
      return;
    }

    if (auth.authMode === 'client_credentials') {
      const stored = spotify.getStoredCredentials();
      if (stored.clientId && stored.clientSecret && stored.refreshToken) {
        setIsAutoConnecting(true);
        const res = await spotify.autoConnectFromCredentials({
          clientId: stored.clientId,
          clientSecret: stored.clientSecret,
          refreshToken: stored.refreshToken,
        });
        setIsAutoConnecting(false);
        if (res.success && res.mode === 'oauth_refresh') {
          setIsAuthenticated(true);
          await refreshLocalDevices();
          handleTestSnippetOnSpotify();
          return;
        }
      }

      // Automatically launch 1-click authorization with the SAME Client ID and Secret!
      await handleConnectPremiumOAuth(isRepeatSnippet ? 'repeat_snippet' : 'test_snippet');
      return;
    }

    setIsTestingSnippetOnSpotify(true);
    isTestingSnippetOnSpotifyRef.current = true;
    setIsFullSongPlaying(false);
    isFullSongPlayingRef.current = false;
    setPlaybackErrorMessage(null);
    setLoopCount(1);
    const targetDev = selectedDeviceId || activeDevice?.id || null;

    const playLoopIteration = async (isFirst = true) => {
      let res: { success: boolean; error?: string };
      const curStart = startMsRef.current;
      const curEnd = endMsRef.current;

      if (isFirst) {
        res = await spotify.playSnippet(selectedTrack.uri, curStart, targetDev);
      } else {
        // Fast seek on same track to loop cleanly without reloading stream
        await spotify.seek(curStart, targetDev);
        await spotify.resume(targetDev);
        res = { success: true };
      }

      if (!res.success) {
        setIsTestingSnippetOnSpotify(false);
        isTestingSnippetOnSpotifyRef.current = false;
        setLoopCount(0);
        setPlaybackErrorMessage(res.error || 'Could not start Spotify playback. Open Spotify on your device.');
        return;
      }

      setIsSpotifyPlaying(true);
      setSpotifyCurrentMs(curStart);

      // Compensate for network transmission latency so audio halts/loops PRECISELY on endMs
      // Remote Spotify Connect devices (like mobile phones) require ~450ms lead time.
      const isLocalWeb = Boolean(targetDev && targetDev === spotify.getWebPlaybackDeviceId());
      const leadTimeMs = isLocalWeb ? 30 : 450;

      const snippetDurationMs = Math.max(500, curEnd - curStart);
      const effectiveDelayMs = Math.max(50, snippetDurationMs - leadTimeMs);

      const timer = window.setTimeout(async () => {
        if (isRepeatSnippetRef.current) {
          setLoopCount((c) => c + 1);
          playLoopIteration(false);
        } else {
          await spotify.pause(targetDev);
          setIsTestingSnippetOnSpotify(false);
          isTestingSnippetOnSpotifyRef.current = false;
          setIsSpotifyPlaying(false);
          setTestSnippetTimer(null);
          testSnippetTimerRef.current = null;
          setLoopCount(0);
          setSpotifyCurrentMs(curEnd);
        }
      }, effectiveDelayMs);

      testSnippetTimerRef.current = timer;
      setTestSnippetTimer(timer);
    };

    playLoopIteration(true);
  };

  // Dedicated Play Bit (A ➔ B) Audition Handler
  const handlePlayBit = async (loop = false) => {
    if (isTestingSnippetOnSpotify) {
      if (testSnippetTimerRef.current) {
        clearTimeout(testSnippetTimerRef.current);
        testSnippetTimerRef.current = null;
      }
      if (testSnippetTimer) clearTimeout(testSnippetTimer);
      setIsTestingSnippetOnSpotify(false);
      isTestingSnippetOnSpotifyRef.current = false;
      setLoopCount(0);
      const targetDev = selectedDeviceId || activeDevice?.id || null;
      await spotify.pause(targetDev);
      setIsSpotifyPlaying(false);
      return;
    }

    setIsRepeatSnippet(loop);
    isRepeatSnippetRef.current = loop;
    await handleTestSnippetOnSpotify();
  };

  // Timeline click scrubber
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !selectedTrack) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const targetMs = Math.round(fraction * selectedTrack.durationMs);
    handleSeek(targetMs);
  };

  const handleSave = async () => {
    if (!selectedTrack) return;
    const tagList = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const newSnippet: MusicSnippet = {
      id: initialSnippet?.id || `snippet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: selectedTrack.title,
      artist: selectedTrack.artist,
      album: selectedTrack.album,
      albumArt: selectedTrack.albumArt,
      spotifyUri: selectedTrack.uri,
      trackId: selectedTrack.id,
      spotifyUrl: selectedTrack.url,
      durationMs: selectedTrack.durationMs,
      startMs,
      endMs,
      snippetName: snippetName.trim() || `${selectedTrack.title} Bit`,
      playlistId: selectedPlaylistId || playlists[0]?.id || 'default',
      notes: notes.trim(),
      tags: tagList,
      createdAt: initialSnippet?.createdAt || Date.now(),
      color: '#10b981',
    };

    // Immediately stop playing music so it does not continue in the background when window closes
    await stopAllClipperPlayback();

    onSaveSnippet(newSnippet);

    try {
      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'],
      });
    } catch (e) {}

    audioEngine.playCueSound(1046.5);
    onClose();
  };

  const totalDuration = selectedTrack?.durationMs || 240000;
  const currentProgressPercent = Math.min(100, Math.max(0, (spotifyCurrentMs / totalDuration) * 100));
  const startPercent = Math.min(100, Math.max(0, (startMs / totalDuration) * 100));
  const endPercent = Math.min(100, Math.max(0, (endMs / totalDuration) * 100));
  const snippetDurationSec = Math.max(0, (endMs - startMs) / 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-950/95 border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[95vh] backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-4 border-b border-white/[0.08] bg-slate-900/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl theme-bg-soft theme-border-accent border flex items-center justify-center theme-text-accent shrink-0 shadow-sm">
              <Scissors className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate">
                <span>{initialSnippet ? 'Edit Music Bit' : 'Clip Music Bit'}</span>
              </h2>
              <p className="hidden sm:block text-xs text-slate-400 truncate">
                Play the full song below and pin timestamps in real-time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {isAuthenticated ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full theme-bg-soft theme-border-accent border theme-text-accent text-xs font-semibold">
                <Zap className="w-3.5 h-3.5" /> Spotify Connected
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConnectSpotify}
                disabled={isAutoConnecting}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl theme-btn-primary text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                {isAutoConnecting ? 'Connecting...' : 'Connect Spotify'}
              </button>
            )}
            <button
              onClick={handleCloseModal}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-5 flex-1 text-slate-200">
          {/* Search or Grab Song */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <form onSubmit={handleSearch} className="flex-1 flex items-center relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search song, artist, or paste Spotify link..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 sm:pr-4 py-2 sm:py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>

              <button
                type="button"
                onClick={handleSearch}
                disabled={isSearching}
                title="Search song"
                className="p-2 sm:px-3.5 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-1.5 shrink-0"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">{isSearching ? 'Searching...' : 'Search'}</span>
              </button>

              {/* Grab Current Spotify Track */}
              <button
                type="button"
                onClick={handleGrabCurrentlyPlaying}
                disabled={isLoadingCurrentlyPlaying}
                title="Grab song currently playing in your Spotify app"
                className="p-2 sm:px-3.5 sm:py-2.5 theme-bg-soft hover:brightness-125 theme-text-accent theme-border-accent border rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Radio className={`w-4 h-4 ${isLoadingCurrentlyPlaying ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{isLoadingCurrentlyPlaying ? 'Grabbing...' : 'Grab Song'}</span>
              </button>
            </div>

            {grabError && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                {grabError}
              </p>
            )}

            {/* Search results list */}
            {searchResults.length > 0 && (
              <div className="p-2 bg-slate-950 border border-slate-800 rounded-2xl space-y-1 max-h-52 overflow-y-auto">
                <span className="text-[10px] font-semibold text-slate-400 px-2 py-0.5 uppercase tracking-wider block">
                  Select a song to clip:
                </span>
                {searchResults.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => loadTrackDetails(track.id)}
                    className="w-full flex items-center gap-2.5 p-1.5 sm:p-2 rounded-xl hover:bg-slate-900 transition text-left"
                  >
                    <img
                      src={track.album.images?.[0]?.url || ''}
                      alt={track.name}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover bg-slate-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-white truncate">{track.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {track.artists.map((a) => a.name).join(', ')} • {formatMsToTime(track.duration_ms)}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Track Banner or Empty Placeholder */}
          {selectedTrack ? (
            <div className="p-2.5 sm:p-3.5 bg-slate-950 border border-slate-800/80 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <img
                  src={selectedTrack.albumArt}
                  alt={selectedTrack.title}
                  className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl object-cover shadow-md border border-slate-700/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-white truncate">{selectedTrack.title}</div>
                  <div className="text-[11px] text-slate-400 truncate">{selectedTrack.artist}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span className="hidden sm:inline truncate max-w-[150px]">{selectedTrack.album} •</span>
                    <span>Duration: {formatMsToTime(selectedTrack.durationMs)}</span>
                  </div>
                </div>
              </div>

              <a
                href={selectedTrack.url}
                target="_blank"
                rel="noreferrer"
                title="Open in Spotify"
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 flex items-center gap-1.5 transition shrink-0"
              >
                <span className="hidden sm:inline">Spotify</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div className="p-6 sm:p-10 text-center bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <Music2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">Select a Song to Clip</h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Search above by title or artist, paste any Spotify track link, or click &ldquo;Grab Song&rdquo; while playing music in your Spotify app.
                </p>
              </div>
            </div>
          )}

          {/* SPOTIFY FULL SONG PLAYER (LISTEN RIGHT HERE & SNIP ANY TIME) */}
          {selectedTrack && (
            <div className="space-y-3 sm:space-y-4 p-3 sm:p-5 bg-slate-950/95 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-xl">
              {/* Spotify Player Control Header with Connection & Device status */}
              <div className="space-y-2 pb-2.5 border-b border-slate-800/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Music2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 truncate">
                        <span>Spotify Player</span>
                        {isAuthenticated && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono font-semibold shrink-0 ${
                              spotify.getAuthStatus().authMode === 'user_oauth'
                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                                : 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                            }`}
                          >
                            {spotify.getAuthStatus().authMode === 'user_oauth' ? 'Premium' : 'Connected'}
                          </span>
                        )}
                      </div>
                      <p className="hidden sm:block text-[10px] text-slate-400 truncate">
                        {isAuthenticated
                          ? spotify.getAuthStatus().authMode === 'user_oauth'
                            ? `Full playback enabled (${spotify.getAuthStatus().user?.display_name || 'Active'})`
                            : 'Client ID & Secret active'
                          : 'Connect Spotify to play full song'}
                      </p>
                    </div>
                  </div>

                  {/* Connection Button / Device Picker */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isAuthenticated && spotify.getAuthStatus().authMode === 'user_oauth' ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowDeviceSelector(!showDeviceSelector)}
                          className="px-2 sm:px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[11px] sm:text-xs text-slate-200 flex items-center gap-1.5 transition"
                          title={`Device: ${activeDevice?.name || 'Spotify Device'}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-emerald-400 flex items-center gap-1 font-medium">
                            {getDeviceIcon(activeDevice?.type)}
                            <span className="max-w-[70px] sm:max-w-[120px] truncate">{activeDevice?.name || 'Device'}</span>
                          </span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>

                        {/* Device Dropdown */}
                        {showDeviceSelector && (
                          <div className="absolute right-0 top-full mt-2 w-64 p-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-30 space-y-1">
                            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-400">
                              <span>PLAYBACK DEVICE</span>
                              <button
                                type="button"
                                onClick={refreshLocalDevices}
                                className="text-emerald-400 hover:underline flex items-center gap-1 text-[10px]"
                              >
                                <RefreshCw className="w-3 h-3" /> Refresh
                              </button>
                            </div>
                            {localDevices.length > 0 ? (
                              localDevices.map((d) => (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => handleSelectDeviceLocal(d.id)}
                                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition ${
                                    d.id === (selectedDeviceId || activeDevice?.id)
                                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                                      : 'hover:bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    {getDeviceIcon(d.type)}
                                    <span className="truncate">{d.name}</span>
                                  </div>
                                  {d.id === (selectedDeviceId || activeDevice?.id) && (
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  )}
                                </button>
                              ))
                            ) : (
                              <div className="p-3 text-center text-xs text-slate-400">
                                No active Spotify devices found. Open Spotify app on phone/PC.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : isAuthenticated && spotify.getAuthStatus().authMode === 'client_credentials' ? (
                      <button
                        type="button"
                        onClick={() => handleConnectPremiumOAuth('play_full')}
                        disabled={isAutoConnecting}
                        className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span className="hidden sm:inline">{isAutoConnecting ? 'Connecting...' : 'Authorize Full Song'}</span>
                        <span className="sm:hidden">Authorize</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectSpotify}
                        disabled={isAutoConnecting}
                        className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span className="hidden sm:inline">{isAutoConnecting ? 'Connecting...' : 'Connect Spotify'}</span>
                        <span className="sm:hidden">Connect</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* If Client Credentials mode banner */}
                {isAuthenticated && spotify.getAuthStatus().authMode === 'client_credentials' && (
                  <div className="p-2.5 sm:p-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/30 border border-emerald-500/25 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-200">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[11px] truncate">Authorize with Spotify Premium to play full songs</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConnectPremiumOAuth('play_full')}
                      disabled={isAutoConnecting}
                      className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 active:scale-95"
                    >
                      <PlayCircle className="w-3.5 h-3.5 fill-current" />
                      <span>Authorize</span>
                    </button>
                  </div>
                )}

                {/* If not authenticated warning banner */}
                {!isAuthenticated && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-200">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-[11px]">30s Preview Mode. Connect Spotify for full song.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleConnectSpotify}
                      disabled={isAutoConnecting}
                      className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-[11px] font-bold transition shrink-0 flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3 fill-current" />
                      <span>Connect</span>
                    </button>
                  </div>
                )}

                {/* Error Banner */}
                {playbackErrorMessage && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-300">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="text-[11px] truncate">{playbackErrorMessage}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href="https://open.spotify.com"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold transition flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> App
                      </a>
                      <button
                        type="button"
                        onClick={refreshLocalDevices}
                        className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded text-[10px] font-semibold transition flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* PRIMARY PLAYBACK & BIT AUDITION CONTROLS */}
              <div className="p-2 sm:p-3 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
                  {/* Left Playback Toolbar: Play Bit, Loop Bit, Full Track, Navigation */}
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    {/* Primary Action: Play Bit (A ➔ B) */}
                    {isTestingSnippetOnSpotify && !isRepeatSnippet ? (
                      <button
                        type="button"
                        onClick={() => handlePlayBit(false)}
                        className="p-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95 cursor-pointer"
                        title="Pause Bit Playback"
                      >
                        <Pause className="w-4 h-4 fill-current" />
                        <span className="hidden sm:inline">Pause Bit</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePlayBit(false)}
                        className="p-2 sm:px-3.5 sm:py-2.5 rounded-xl theme-btn-primary font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                        title={`Play Bit: Audition from Point A (${formatMsToTime(startMs)}) to Point B (${formatMsToTime(endMs)}) and stop strictly at Point B`}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span className="hidden sm:inline">Play Bit</span>
                      </button>
                    )}

                    {/* Repeat/Loop Snip Button */}
                    <button
                      type="button"
                      onClick={() => handlePlayBit(true)}
                      className={`p-2 sm:px-3 sm:py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer ${
                        isTestingSnippetOnSpotify && isRepeatSnippet
                          ? 'theme-btn-primary shadow-md'
                          : isRepeatSnippet
                          ? 'theme-bg-soft theme-text-accent theme-border-accent'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                      }`}
                      title={
                        isTestingSnippetOnSpotify && isRepeatSnippet
                          ? `Looping bit (${loopCount > 0 ? `Loop #${loopCount}` : 'Active'}). Click to stop.`
                          : 'Repeat this bit continuously in a loop from Point A to Point B'
                      }
                    >
                      <Repeat className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isTestingSnippetOnSpotify && isRepeatSnippet ? 'opacity-90 animate-pulse' : 'theme-text-accent'}`} />
                      <span className="hidden sm:inline">
                        {isTestingSnippetOnSpotify && isRepeatSnippet
                          ? (loopCount > 0 ? `Looping (#${loopCount})` : 'Looping...')
                          : isRepeatSnippet
                          ? 'Loop: ON'
                          : 'Loop Bit'}
                      </span>
                    </button>

                    {/* Scan Full Track / Full Song Button */}
                    {isSpotifyPlaying && isFullSongPlaying ? (
                      <button
                        type="button"
                        onClick={handlePauseFullSong}
                        className="p-2 sm:px-2.5 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition"
                        title="Pause Full Track"
                      >
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span className="hidden md:inline">Pause Track</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePlayFullSong()}
                        className="p-2 sm:px-2.5 sm:py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Listen continuously to the full track for finding or browsing timestamps"
                      >
                        <Music2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="hidden md:inline">Full Track</span>
                      </button>
                    )}

                    {/* Rewind to 0:00 */}
                    <button
                      type="button"
                      onClick={() => handleSeek(0)}
                      className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                      title="Rewind to 00:00"
                    >
                      <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>

                    {/* Jump -10s */}
                    <button
                      type="button"
                      onClick={() => handleSeek(Math.max(0, spotifyCurrentMs - 10000))}
                      className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono font-bold transition flex items-center gap-0.5"
                      title="Jump backward 10s"
                    >
                      <Rewind className="w-3.5 h-3.5" />
                      <span className="text-[10px] sm:text-xs">10s</span>
                    </button>

                    {/* Jump +10s */}
                    <button
                      type="button"
                      onClick={() => handleSeek(Math.min(selectedTrack.durationMs, spotifyCurrentMs + 10000))}
                      className="p-2 sm:px-2.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono font-bold transition flex items-center gap-0.5"
                      title="Jump forward 10s"
                    >
                      <span className="text-[10px] sm:text-xs">10s</span>
                      <FastForward className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Right: Point A, Point B, & Point B Guard */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleSeek(startMs)}
                      className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1 transition"
                      title="Jump playhead to Point A"
                    >
                      <span className="w-3.5 h-3.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] flex items-center justify-center font-bold">A</span>
                      <span className="font-mono text-[10px] sm:text-xs">{formatMsToTime(startMs)}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSeek(endMs)}
                      className="px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1 transition"
                      title="Jump playhead to Point B"
                    >
                      <span className="w-3.5 h-3.5 rounded bg-rose-500/20 text-rose-400 font-mono text-[9px] flex items-center justify-center font-bold">B</span>
                      <span className="font-mono text-[10px] sm:text-xs">{formatMsToTime(endMs)}</span>
                    </button>

                    {/* Point B Guard Toggle */}
                    <button
                      type="button"
                      onClick={() => setStopAtPointB(!stopAtPointB)}
                      className={`px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center gap-1 border transition ${
                        stopAtPointB
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                      title={
                        stopAtPointB
                          ? 'Point B Guard is ACTIVE: Playback will strictly pause at Point B'
                          : 'Point B Guard is OFF: Playback will not be bounded by Point B'
                      }
                    >
                      {stopAtPointB ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span className="hidden md:inline font-mono text-[10px]">Guard:</span>
                      <span className="font-mono text-[10px] sm:text-xs font-bold">{stopAtPointB ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </div>

                {/* Subtitle / Helper */}
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 px-0.5">
                  <span>
                    {isTestingSnippetOnSpotify ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>
                          {isRepeatSnippet
                            ? `Looping Bit (${formatMsToTime(startMs)} ➔ ${formatMsToTime(endMs)}) • Strict Point B boundary`
                            : `Playing Bit (${formatMsToTime(startMs)} ➔ ${formatMsToTime(endMs)}) • Strictly stops at Point B`}
                        </span>
                      </span>
                    ) : isSpotifyPlaying && isFullSongPlaying ? (
                      <span className="text-cyan-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                        <span>Playing track... {stopAtPointB ? 'Point B Guard active' : 'Scanning full track'}</span>
                      </span>
                    ) : (
                      <span className="hidden sm:inline">
                        Tap <strong>Play Bit</strong> to audition Point A to B (stops at Point B), or <strong>Full Track</strong> to browse
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEmbedPreview(!showEmbedPreview)}
                    className="text-slate-400 hover:text-slate-200 underline flex items-center gap-1"
                  >
                    {showEmbedPreview ? 'Hide IFrame (30s)' : 'Embed Preview (30s)'}
                  </button>
                </div>
              </div>

              {/* Optional Embedded Spotify Player (30s preview) if user toggles it */}
              {showEmbedPreview && (
                <div className="space-y-1.5 p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Info className="w-3.5 h-3.5 text-amber-400" />
                      Embedded IFrame (30s preview only):
                    </span>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-black">
                    <div id="spotify-embed-controller-target" className="w-full">
                      <iframe
                        id="spotify-embed-iframe"
                        src={`https://open.spotify.com/embed/track/${selectedTrack.id}?utm_source=generator&theme=0`}
                        width="100%"
                        height="80"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        title="Spotify Embed Player"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TIMELINE RANGE WAVEFORM (WITH INTEGRATED LIVE PLAYHEAD & AUTO-FOLLOW) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-base sm:text-xl font-black text-emerald-400">
                        {formatMsToDetailed(spotifyCurrentMs)}
                      </span>
                      <span className="font-mono text-[10px] sm:text-xs text-slate-500">
                        / {formatMsToTime(selectedTrack.durationMs)}
                      </span>
                    </div>
                    {isSpotifyPlaying && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono text-[10px] sm:text-[11px] font-bold border border-emerald-500/30">
                      {snippetDurationSec.toFixed(1)}s bit
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsLiveAutoFollowEnd(!isLiveAutoFollowEnd)}
                      className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold flex items-center gap-1 border transition ${
                        isLiveAutoFollowEnd
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title="Automatically extends End Point (B) as the song plays"
                    >
                      {isLiveAutoFollowEnd ? <Unlock className="w-3 h-3 text-rose-400" /> : <Lock className="w-3 h-3 text-slate-400" />}
                      <span className="hidden sm:inline">Auto-Follow:</span>
                      <span>{isLiveAutoFollowEnd ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSpotifyCurrentMs(0);
                        if (embedControllerRef.current) {
                          try { embedControllerRef.current.seek(0); } catch (e) {}
                        }
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                      title="Reset to 00:00"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Timeline Scrubber */}
                <div
                  ref={timelineRef}
                  onClick={handleTimelineClick}
                  className="relative h-11 sm:h-14 bg-slate-900 border border-slate-700/80 rounded-2xl cursor-pointer overflow-hidden group select-none shadow-inner"
                >
                  {/* Waveform graphic bars */}
                  <div className="absolute inset-0 flex items-center justify-between px-2 opacity-20 pointer-events-none">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-slate-300 rounded-full"
                        style={{ height: `${Math.sin(i * 0.35) * 45 + 50}%` }}
                      />
                    ))}
                  </div>

                  {/* Highlighted active snippet segment between startMs and endMs */}
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none transition-all"
                    style={{
                      left: `${startPercent}%`,
                      width: `${Math.max(1, endPercent - startPercent)}%`,
                      backgroundColor: 'var(--theme-accent-soft, rgba(139, 92, 246, 0.25))',
                      borderTop: '2px solid var(--theme-accent, #8b5cf6)',
                      borderBottom: '2px solid var(--theme-accent, #8b5cf6)',
                    }}
                  />

                  {/* Point A Marker Flag */}
                  <div
                    className="absolute top-0 bottom-0 w-2 z-20 pointer-events-none"
                    style={{
                      left: `${startPercent}%`,
                      backgroundColor: 'var(--theme-accent, #8b5cf6)',
                      boxShadow: '0 0 12px var(--theme-accent-glow, rgba(139, 92, 246, 0.5))',
                    }}
                  >
                    <div
                      className="absolute -top-1 -left-2.5 font-bold text-[9px] px-1.5 py-0.2 rounded-full font-mono shadow-md"
                      style={{
                        backgroundColor: 'var(--theme-accent, #8b5cf6)',
                        color: 'var(--theme-text-contrast, #ffffff)',
                        border: '1px solid var(--theme-accent-hover, #a78bfa)',
                      }}
                    >
                      A
                    </div>
                  </div>

                  {/* Point B Marker Flag */}
                  <div
                    className="absolute top-0 bottom-0 w-2 bg-rose-400 shadow-[0_0_12px_#f43f5e] z-20 pointer-events-none"
                    style={{ left: `${endPercent}%` }}
                  >
                    <div className="absolute -top-1 -left-2.5 bg-rose-500 text-white font-bold text-[9px] px-1.5 py-0.2 rounded-full font-mono shadow-md border border-rose-300">
                      B
                    </div>
                  </div>

                  {/* Live Playhead Cursor */}
                  <div
                    className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_15px_#ffffff] z-30 pointer-events-none transition-all duration-100"
                    style={{ left: `${currentProgressPercent}%` }}
                  >
                    <div className="absolute -bottom-1 -left-2 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-lg border-2 theme-border-accent">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: 'var(--theme-accent, #8b5cf6)' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
                  <span>00:00.0</span>
                  <span className="theme-text-accent font-bold">
                    Playing: {formatMsToDetailed(spotifyCurrentMs)}
                  </span>
                  <span>{formatMsToDetailed(selectedTrack.durationMs)}</span>
                </div>
              </div>

              {/* UNIFIED POINT A & POINT B PINNING & FINE-TUNING MODULES */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {/* Point A Module */}
                  <div className="p-2.5 sm:p-3 bg-slate-900/90 theme-border-accent border rounded-2xl space-y-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-lg font-black flex items-center justify-center text-xs"
                          style={{
                            backgroundColor: 'var(--theme-accent, #8b5cf6)',
                            color: 'var(--theme-text-contrast, #ffffff)',
                          }}
                        >
                          A
                        </span>
                        <span className="text-xs font-bold theme-text-accent">Point A (Start)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSeek(startMs)}
                          title="Jump playhead to Point A"
                          className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-xs sm:text-sm font-bold text-white bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                          {formatMsToDetailed(startMs)}
                        </span>
                      </div>
                    </div>

                    {/* Pin Start Button */}
                    <button
                      type="button"
                      onClick={handleNoteStartTime}
                      className="w-full py-2 px-3 rounded-xl theme-bg-soft hover:brightness-125 theme-text-accent theme-border-accent border font-bold text-xs transition flex items-center justify-between shadow-sm active:scale-98 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Pin Start (A)</span>
                      </span>
                      <span className="font-mono text-[11px] opacity-80">@{formatMsToDetailed(spotifyCurrentMs)}</span>
                    </button>

                    {/* Fine-Tuning Row */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setStartMs(Math.max(0, startMs - 1000))}
                        className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-mono transition"
                        title="-1s"
                      >
                        -1s
                      </button>
                      <button
                        type="button"
                        onClick={() => setStartMs(Math.max(0, startMs - 200))}
                        className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-mono transition"
                        title="-0.2s"
                      >
                        -0.2s
                      </button>
                      <button
                        type="button"
                        onClick={() => setStartMs(Math.min(endMs - 500, startMs + 200))}
                        className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-mono transition"
                        title="+0.2s"
                      >
                        +0.2s
                      </button>
                      <button
                        type="button"
                        onClick={() => setStartMs(Math.min(endMs - 1000, startMs + 1000))}
                        className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-mono transition"
                        title="+1s"
                      >
                        +1s
                      </button>
                    </div>
                  </div>

                  {/* Point B Module */}
                  <div className="p-2.5 sm:p-3 bg-slate-900 border border-rose-500/30 rounded-2xl space-y-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-lg bg-rose-500 text-white font-black flex items-center justify-center text-xs">
                          B
                        </span>
                        <span className="text-xs font-bold text-rose-300">Point B (End)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSeek(endMs)}
                          title="Jump playhead to Point B"
                          className="p-1 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-xs sm:text-sm font-bold text-white bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                          {formatMsToDetailed(endMs)}
                        </span>
                      </div>
                    </div>

                    {/* Pin End Button */}
                    <button
                      type="button"
                      onClick={handleNoteEndTime}
                      className="w-full py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 hover:border-rose-400 font-bold text-xs transition flex items-center justify-between shadow-sm active:scale-98"
                    >
                      <span className="flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Pin End (B)</span>
                      </span>
                      <span className="font-mono text-[11px] opacity-80">@{formatMsToDetailed(spotifyCurrentMs)}</span>
                    </button>

                    {/* Fine-Tuning Row */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEndMs(Math.max(startMs + 1000, endMs - 1000))}
                        className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-mono transition"
                        title="-1s"
                      >
                        -1s
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndMs(Math.max(startMs + 500, endMs - 200))}
                        className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-mono transition"
                        title="-0.2s"
                      >
                        -0.2s
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndMs(Math.min(totalDuration, endMs + 200))}
                        className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-mono transition"
                        title="+0.2s"
                      >
                        +0.2s
                      </button>
                      <button
                        type="button"
                        onClick={() => setEndMs(Math.min(totalDuration, endMs + 1000))}
                        className="flex-1 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 font-mono transition"
                        title="+1s"
                      >
                        +1s
                      </button>
                    </div>
                  </div>
                </div>

                {/* Instant Feedback banner */}
                {notedBanner && (
                  <div
                    className={`py-1 px-3 rounded-xl text-center text-xs font-bold transition ${
                      notedBanner.type === 'start'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    ✅ {notedBanner.message}
                  </div>
                )}
              </div>

              {/* PRESETS & TEST SNIPPET ON SPOTIFY */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-400 hidden sm:inline mr-1">Presets:</span>
                  {[15, 30, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setEndMs(Math.min(totalDuration, startMs + sec * 1000))}
                      className="px-2 py-1 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                    >
                      {sec}s
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Repeat Snippet Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isRepeatSnippet;
                      setIsRepeatSnippet(next);
                      isRepeatSnippetRef.current = next;
                      if (next) {
                        handlePlayBit(true);
                      } else if (isTestingSnippetOnSpotify) {
                        handlePlayBit(false);
                      }
                    }}
                    className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border ${
                      isRepeatSnippet
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700/80'
                    }`}
                    title={isRepeatSnippet ? 'Repeat is ON' : 'Turn Repeat ON'}
                  >
                    <Repeat className={`w-3.5 h-3.5 ${isRepeatSnippet ? 'text-emerald-400' : ''}`} />
                    <span className="hidden sm:inline">Repeat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlayBit(false)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isTestingSnippetOnSpotify
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25 animate-pulse'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20'
                    }`}
                  >
                    {isTestingSnippetOnSpotify ? (
                      <Square className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{isTestingSnippetOnSpotify ? 'Stop' : `Test Bit (${snippetDurationSec.toFixed(1)}s)`}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Snippet Metadata Fields */}
          {selectedTrack && (
            <div className="space-y-2.5 sm:space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="text-[11px] sm:text-xs text-slate-400 block mb-0.5 font-medium">Snippet Name / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Guitar Solo, Climax Drop, Saxophone Bridge"
                    value={snippetName}
                    onChange={(e) => setSnippetName(e.target.value)}
                    className="w-full px-3 py-1.5 sm:py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] sm:text-xs text-slate-400 block mb-0.5 font-medium">Target Playlist</label>
                  <div className="flex gap-1.5 sm:gap-2">
                    <select
                      value={selectedPlaylistId}
                      onChange={(e) => setSelectedPlaylistId(e.target.value)}
                      className="flex-1 px-3 py-1.5 sm:py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      {playlists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const name = prompt('New Playlist Name:');
                        if (name && name.trim()) {
                          const newId = onCreatePlaylist(name.trim());
                          setSelectedPlaylistId(newId);
                        }
                      }}
                      className="px-2.5 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs flex items-center gap-1 transition shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">New</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="text-[11px] sm:text-xs text-slate-400 block mb-0.5 font-medium">Tags (comma separated)</label>
                  <input
                    type="text"
                    placeholder="guitar-solo, peak, rock, drop"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-1.5 sm:py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] sm:text-xs text-slate-400 block mb-0.5 font-medium">Personal Notes</label>
                  <input
                    type="text"
                    placeholder="The moment the drums kick in..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 sm:py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between sticky bottom-0 z-10">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-900 transition"
            >
              Cancel
            </button>

            {initialSnippet && onDeleteSnippet && (
              <button
                type="button"
                onClick={async () => {
                  if (confirmDeleteInModal) {
                    await stopAllClipperPlayback();
                    onDeleteSnippet(initialSnippet.id);
                    onClose();
                  } else {
                    setConfirmDeleteInModal(true);
                  }
                }}
                className={`p-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                  confirmDeleteInModal
                    ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30'
                    : 'bg-slate-900 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border-slate-800'
                }`}
                title="Delete this music bit from your library"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{confirmDeleteInModal ? 'Confirm Delete Bit?' : 'Delete Bit'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedTrack}
            className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl theme-btn-primary disabled:opacity-40 font-bold text-xs sm:text-sm transition flex items-center gap-1.5 sm:gap-2 shadow-lg active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{initialSnippet ? 'Update Bit' : 'Save Bit'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
