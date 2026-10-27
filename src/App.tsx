/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { SnippetPlaylistView } from './components/SnippetPlaylistView';
import { SnippetPlayerBar } from './components/SnippetPlayerBar';
import { SnippetClipperModal } from './components/SnippetClipperModal';
import { SpotifySetupModal } from './components/SpotifySetupModal';
import { ExportImportModal } from './components/ExportImportModal';
import { FirebaseAuthModal } from './components/FirebaseAuthModal';
import { PlaybackNoticeModal, PlaybackNotice } from './components/PlaybackNoticeModal';
import { ThemeSelectorModal } from './components/ThemeSelectorModal';
import { ReleaseNotesView } from './components/ReleaseNotesView';
import { UserGuideView } from './components/UserGuideView';
import { AppLoginScreen, AppUserSession } from './components/AppLoginScreen';
import { NowPlayingModal } from './components/NowPlayingModal';
import { BitMixerModal } from './components/BitMixerModal';
import { MashupClubModal } from './components/MashupClubModal';
import { ToastContainer } from './components/Toast';
import { ThemeId, getStoredTheme, saveStoredTheme, applyTheme } from './utils/theme';
import { MusicSnippet, SnippetPlaylist, PlaybackMode, SpotifyDevice, ToastMessage } from './types';
import { StorageService } from './services/storage';
import { spotify, SpotifyAuthStatus } from './services/spotify';
import { audioEngine } from './services/audioEngine';
import { backgroundAudio } from './services/backgroundAudio';
import {
  auth,
  signInWithGoogle,
  signOutGoogle,
  subscribeToAuth,
  saveSnippetToFirestore,
  deleteSnippetFromFirestore,
  subscribeToUserSnippets,
  savePlaylistToFirestore,
  deletePlaylistFromFirestore,
  subscribeToUserPlaylists,
  subscribeToSpotifyCredentials,
  saveSpotifyCredentialsToFirestore,
  getSpotifyCredentialsFromFirestore,
} from './services/firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { Cloud, ShieldCheck, Key, Zap, HardDrive, X } from 'lucide-react';

export default function App() {
  // Library state
  const [snippets, setSnippets] = useState<MusicSnippet[]>(() => StorageService.loadSnippets());
  const [playlists, setPlaylists] = useState<SnippetPlaylist[]>(() => StorageService.loadPlaylists());
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);

  // Google User & Firebase state
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [hasStoredSpotifyCreds, setHasStoredSpotifyCreds] = useState<boolean>(false);

  // Player state
  const [currentSnippet, setCurrentSnippet] = useState<MusicSnippet | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [positionMs, setPositionMs] = useState<number>(0);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('linear');
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Stage Extended Features: Now Playing, Custom Queue, Recently Played, Play Counts, Mobile Home, Sleep Timer, Toasts
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
  const [customQueue, setCustomQueue] = useState<MusicSnippet[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<MusicSnippet[]>(() => StorageService.loadRecentlyPlayed());
  const [playCounts, setPlayCounts] = useState<Record<string, number>>(() => StorageService.loadPlayCounts());
  const [isMobileHome, setIsMobileHome] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      return isMobileDevice || window.innerWidth < 768;
    }
    return false;
  });
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimeRemainingMs, setSleepTimeRemainingMs] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast System
  const showToast = useCallback(
    (text: string, type: 'success' | 'info' | 'warning' | 'heart' = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    []
  );

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Spotify state
  const [authStatus, setAuthStatus] = useState<SpotifyAuthStatus>(() => spotify.getAuthStatus());
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [activeDevice, setActiveDevice] = useState<SpotifyDevice | null>(null);

  // Modals
  const [isClipperOpen, setIsClipperOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(
    () => localStorage.getItem('bitstream_local_mode_dismissed') === 'true'
  );
  const [editingSnippet, setEditingSnippet] = useState<MusicSnippet | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState<PlaybackNotice | null>(null);
  const [isDbSynced, setIsDbSynced] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => getStoredTheme());
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isMixerOpen, setIsMixerOpen] = useState(false);
  const [isMashupModalOpen, setIsMashupModalOpen] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [isUserGuideOpen, setIsUserGuideOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      return p.get('guide') === 'true' || window.location.hash === '#guide';
    }
    return false;
  });

  // URL synchronization for User Guide (?guide=true or #guide)
  useEffect(() => {
    const handlePopState = () => {
      const p = new URLSearchParams(window.location.search);
      setIsUserGuideOpen(p.get('guide') === 'true' || window.location.hash === '#guide');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // App-level Gate Session (Persists login access to BitStream)
  const [appSession, setAppSession] = useState<AppUserSession | null>(() => {
    try {
      const saved = localStorage.getItem('bitstream_app_session');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed reading bitstream_app_session:', e);
    }
    return null;
  });

  const handleLogoutApp = () => {
    try {
      localStorage.removeItem('bitstream_app_session');
    } catch (e) {}
    setAppSession(null);
  };

  // Apply active theme to document root
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Client ID & device identifier for cross-device LAN synchronization
  const clientIdRef = useRef<string>((() => {
    try {
      let id = sessionStorage.getItem('bitstream_client_id');
      if (!id) {
        id = 'client-' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem('bitstream_client_id', id);
      }
      return id;
    } catch (e) {
      return 'client-' + Math.random().toString(36).slice(2, 9);
    }
  })()).current;

  const clientDeviceNameRef = useRef<string>(
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      ? 'Mobile Device'
      : 'Desktop / Laptop'
  ).current;

  // Track playback status synchronously in a ref to guard timer callbacks from desync
  const isPlayingRef = useRef<boolean>(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const syncPlaybackToServer = useCallback(
    (playing: boolean, snippet?: MusicSnippet | null, targetPositionMs?: number) => {
      fetch('/api/playback/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientIdRef,
          isPlaying: playing,
          snippetId: snippet?.id,
          title: snippet?.title,
          artist: snippet?.artist,
          trackUri: snippet?.spotifyUri,
          positionMs: targetPositionMs !== undefined ? targetPositionMs : currentPositionMsRef.current,
          deviceName: clientDeviceNameRef,
          deviceId: activeDevice?.id,
        }),
      }).catch(() => {});
    },
    [clientIdRef, clientDeviceNameRef, activeDevice?.id]
  );

  // High-frequency playback monitor timer and position tracking refs
  const [activeMashupSegmentIndex, setActiveMashupSegmentIndex] = useState<number>(0);
  const activeMashupSegmentIndexRef = useRef<number>(0);
  const playbackTimerRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const lastPlaybackCommandTimeRef = useRef<number>(0);
  const currentPositionMsRef = useRef<number>(0);
  const currentSnippetRef = useRef<MusicSnippet | null>(null);
  const activeViewQueueRef = useRef<MusicSnippet[] | null>(null);
  const playbackQueueRef = useRef<MusicSnippet[]>([]);
  const playbackRunIdRef = useRef<number>(0);
  const completedSnippetRunRef = useRef<string | null>(null);
  useEffect(() => {
    currentSnippetRef.current = currentSnippet;
  }, [currentSnippet]);

  // 1. Initial Google Auth & Spotify background setup
  useEffect(() => {
    // Check Spotify session on backend
    spotify.checkServerSession();

    // Subscribe to Spotify auth status changes
    const unsubSpotify = spotify.subscribeAuth((status) => {
      setAuthStatus(status);
      if (status.authenticated) {
        refreshDevices();
      }
    });

    // Subscribe to Firebase Google Authentication
    const unsubGoogle = subscribeToAuth((user) => {
      setGoogleUser(user);
    });

    // Handle redirect return from full-page mobile OAuth flow
    if (typeof window !== 'undefined' && window.location.search.includes('spotify_auth=success')) {
      window.history.replaceState({}, document.title, window.location.pathname);
      spotify.checkServerSession().then((active) => {
        refreshDevices();
        showToast('Spotify authorization complete! Device connected.', 'success');
      });
    } else if (typeof window !== 'undefined' && window.location.search.includes('spotify_auth=error')) {
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast('Spotify authorization was cancelled or encountered an error.', 'warning');
    }

    // Handle OAuth popup postMessage (from both direct auth and custom client ID exchange)
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data.accessToken) {
          spotify.setToken(event.data.accessToken, event.data.expiresIn || 3600, event.data.user, 'user_oauth');
        }
        if (googleUser && event.data.refreshToken) {
          try {
            const creds = await getSpotifyCredentialsFromFirestore(googleUser.uid);
            if (creds && creds.clientId) {
              await saveSpotifyCredentialsToFirestore(
                googleUser.uid,
                creds.clientId,
                creds.clientSecret,
                event.data.refreshToken
              );
            }
          } catch (e) {
            console.warn('Could not save refresh token to Firestore:', e);
          }
        }
        refreshDevices();
        showToast('Spotify account linked successfully!', 'success');
      } else if (event.data?.type === 'OAUTH_AUTH_CODE') {
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

          if (clientId && clientSecret) {
            const exchRes = await fetch('/api/auth/exchange-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: event.data.code,
                clientId,
                clientSecret,
              }),
            });
            const tokenData = await exchRes.json();
            if (tokenData.access_token) {
              spotify.setToken(tokenData.access_token, tokenData.expires_in || 3600, tokenData.user, 'user_oauth');
              spotify.saveStoredCredentials(clientId, clientSecret, tokenData.refresh_token);
              if (googleUser && tokenData.refresh_token) {
                await saveSpotifyCredentialsToFirestore(
                  googleUser.uid,
                  clientId,
                  clientSecret,
                  tokenData.refresh_token
                );
              }
              refreshDevices();
              showToast('Spotify account linked successfully!', 'success');
            }
          }
        } catch (e) {
          console.warn('Error handling OAuth code exchange in App.tsx:', e);
        }
      }
    };
    window.addEventListener('message', handleMessage);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('spotify_oauth_channel');
      bc.onmessage = (event) => {
        handleMessage(event as any);
      };
    } catch (e) {}

    return () => {
      unsubSpotify();
      unsubGoogle();
      window.removeEventListener('message', handleMessage);
      if (bc) {
        try {
          bc.close();
        } catch (e) {}
      }
    };
  }, []);

  // 1b. Real-time Local Disk Database Sync (Persistent between Laptop & Phone)
  useEffect(() => {
    let isMounted = true;

    const pullDatabaseUpdates = async (forceFullLoad: boolean = false) => {
      try {
        const lastSync = forceFullLoad ? undefined : StorageService.getLastSyncTimestamp();
        const syncData = await StorageService.fetchFromBackend(lastSync && lastSync > 0 ? lastSync : undefined);
        if (syncData && isMounted) {
          setIsDbSynced(true);
          if (syncData.hasChanges || forceFullLoad || !lastSync) {
            if (Array.isArray(syncData.snippets) && syncData.snippets.length > 0) {
              setSnippets(syncData.snippets);
            }
            if (Array.isArray(syncData.playlists) && syncData.playlists.length > 0) {
              setPlaylists(syncData.playlists);
            }
          }
        }
      } catch (err) {
        console.warn('Local disk database sync error:', err);
      }
    };

    // Initial load on mount: Phone immediately receives all snippets saved on laptop
    pullDatabaseUpdates(true);

    // Continuous poll every 2.5s: snippets clipped on laptop automatically appear on phone
    const pollInterval = setInterval(() => pullDatabaseUpdates(false), 2500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  // 2. Sync with Firestore when Google User is logged in
  useEffect(() => {
    if (!googleUser) return;

    setIsCloudSyncing(true);

    // Listen to user's saved snippets in Firestore
    const unsubSnippets = subscribeToUserSnippets(
      googleUser.uid,
      (cloudSnippets) => {
        setIsCloudSyncing(false);
        const localSnippets = StorageService.loadSnippets();
        if (cloudSnippets.length > 0) {
          const cloudIds = new Set(cloudSnippets.map((s) => s.id));
          const missingAutoBits = localSnippets.filter(
            (s) =>
              !cloudIds.has(s.id) &&
              (s.id.startsWith('auto-bit-') || s.tags?.includes('auto-curated'))
          );
          if (missingAutoBits.length > 0) {
            missingAutoBits.forEach((s) => {
              saveSnippetToFirestore(googleUser.uid, s).catch(() => {});
            });
          }
          const merged = [...missingAutoBits, ...cloudSnippets];
          setSnippets(merged);
          StorageService.saveSnippets(merged);
        } else {
          // If Firestore is empty for new user, but local snippets exist, migrate them to user's Firestore!
          if (localSnippets.length > 0) {
            localSnippets.forEach((s) => {
              saveSnippetToFirestore(googleUser.uid, s);
            });
          }
        }
      },
      (err) => {
        console.warn('Firestore snippets sync notice:', err);
        setIsCloudSyncing(false);
      }
    );

    // Listen to user's playlists in Firestore
    const unsubPlaylists = subscribeToUserPlaylists(
      googleUser.uid,
      (cloudPlaylists) => {
        const localPlaylists = StorageService.loadPlaylists();
        if (cloudPlaylists.length > 0) {
          const cloudIds = new Set(cloudPlaylists.map((p) => p.id));
          const missingAutoPlaylists = localPlaylists.filter(
            (p) => !cloudIds.has(p.id) && p.id.startsWith('playlist-auto-')
          );
          if (missingAutoPlaylists.length > 0) {
            missingAutoPlaylists.forEach((p) => {
              savePlaylistToFirestore(googleUser.uid, p).catch(() => {});
            });
          }
          const merged = [...cloudPlaylists, ...missingAutoPlaylists];
          setPlaylists(merged);
          StorageService.savePlaylists(merged);
        } else {
          if (localPlaylists.length > 0) {
            localPlaylists.forEach((p) => {
              savePlaylistToFirestore(googleUser.uid, p);
            });
          }
        }
      },
      (err) => {
        console.warn('Firestore playlists sync notice:', err);
      }
    );

    // Listen to user's Spotify credentials in Firestore and auto-connect
    const unsubCreds = subscribeToSpotifyCredentials(
      googleUser.uid,
      async (creds) => {
        if (creds && creds.clientId) {
          spotify.saveStoredCredentials(creds.clientId, creds.clientSecret || '', creds.refreshToken);
        }
        const hasCreds = Boolean(creds && creds.clientId && creds.clientSecret);
        setHasStoredSpotifyCreds(Boolean(creds && creds.clientId));

        // Auto-connect if credentials exist in Firestore and Spotify is not currently authenticated
        if (hasCreds && creds && !spotify.getAuthStatus().authenticated) {
          try {
            console.log('🔄 Auto-connecting to Spotify with credentials stored in Firebase...');
            const result = await spotify.autoConnectFromCredentials({
              clientId: creds.clientId,
              clientSecret: creds.clientSecret,
              refreshToken: creds.refreshToken,
            });
            if (result.success) {
              console.log('✅ Auto-connected to Spotify using Firebase stored credentials:', result.mode);
              if (result.newRefreshToken && result.newRefreshToken !== creds.refreshToken) {
                saveSpotifyCredentialsToFirestore(
                  googleUser.uid,
                  creds.clientId,
                  creds.clientSecret,
                  result.newRefreshToken
                ).catch(() => {});
              }
              refreshDevices();
            }
          } catch (err) {
            console.warn('Auto-connect with Firebase credentials error:', err);
          }
        }
      },
      (err) => {
        console.warn('Firestore Spotify creds notice:', err);
      }
    );

    return () => {
      unsubSnippets();
      unsubPlaylists();
      unsubCreds();
    };
  }, [googleUser]);

  const handleSignInGoogle = async () => {
    try {
      setAuthErrorCode(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google sign in error:', err);
      const code =
        err?.code ||
        (err?.message?.includes('unauthorized-domain')
          ? 'auth/unauthorized-domain'
          : 'auth/error');
      setAuthErrorCode(code);
      setIsAuthModalOpen(true);
    }
  };

  const handleSelectLocalMode = () => {
    setIsLocalMode(true);
    localStorage.setItem('bitstream_local_mode_dismissed', 'true');
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOutGoogle();
      setGoogleUser(null);
    } catch (err: any) {
      console.error('Google sign out error:', err);
    }
  };

  // 2. Poll Spotify devices when authenticated
  const refreshDevices = useCallback(async () => {
    if (!spotify.getAuthStatus().authenticated) return;
    const devList = await spotify.getDevices();
    setDevices(devList);
    const preferred = spotify.resolvePreferredDevice(devList);
    setActiveDevice(preferred);
  }, []);

  useEffect(() => {
    if (authStatus.authenticated) {
      refreshDevices();
      const interval = setInterval(refreshDevices, 10000);
      return () => clearInterval(interval);
    }
  }, [authStatus.authenticated, refreshDevices]);

  // Pre-cache album URIs for all snippets so mobile context_uri playback has 0ms latency
  useEffect(() => {
    if (authStatus.authenticated && snippets.length > 0) {
      spotify.prefetchAlbumUris(snippets.map((s) => s.spotifyUri));
    }
  }, [authStatus.authenticated, snippets]);

  // Re-evaluate preferred device if viewport switches between desktop and mobile view
  useEffect(() => {
    const handleResize = () => {
      if (devices.length > 0) {
        const preferred = spotify.resolvePreferredDevice(devices);
        if (preferred && preferred.id !== activeDevice?.id) {
          setActiveDevice(preferred);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [devices, activeDevice?.id]);

  // 3. Queue resolution based on locked playback queue, active view/playlist, and shuffle
  const getQueue = useCallback((): MusicSnippet[] => {
    const activeCur = currentSnippetRef.current;
    if (
      playbackQueueRef.current.length > 0 &&
      (!activeCur || playbackQueueRef.current.some((s) => s.id === activeCur.id))
    ) {
      return playbackQueueRef.current;
    }

    let list = snippets;
    if (activeViewQueueRef.current && activeViewQueueRef.current.length > 0) {
      list = activeViewQueueRef.current;
    } else if (activePlaylistId) {
      list = snippets.filter((s) => s.playlistId === activePlaylistId);
    }
    if (isShuffle) {
      const shuffled = [...list].sort(() => Math.random() - 0.5);
      playbackQueueRef.current = shuffled;
      return shuffled;
    }
    playbackQueueRef.current = [...list];
    return playbackQueueRef.current;
  }, [snippets, activePlaylistId, isShuffle]);

  // 4. Play Snippet from Point A to Point B (Supports Multi-Segment Seamless Mashups)
  const playSnippet = useCallback(
    async (snippet: MusicSnippet, startAtMs?: number, segmentIndex?: number) => {
      // Determine segment configuration for mashup bits
      const isMashupBit = Boolean(snippet.isMashup && snippet.mashupSegments && snippet.mashupSegments.length > 0);
      const segIdx = isMashupBit ? (segmentIndex !== undefined ? segmentIndex : 0) : 0;
      activeMashupSegmentIndexRef.current = segIdx;
      setActiveMashupSegmentIndex(segIdx);

      const activeSeg = isMashupBit && snippet.mashupSegments ? snippet.mashupSegments[segIdx] : null;
      const targetStart = startAtMs !== undefined ? startAtMs : (activeSeg ? activeSeg.startMs : snippet.startMs);
      const effectiveUri = activeSeg ? activeSeg.spotifyUri : snippet.spotifyUri;

      // Ensure playbackQueueRef contains a stable ordered queue including this snippet
      if (!playbackQueueRef.current.some((s) => s.id === snippet.id)) {
        if (
          activeViewQueueRef.current &&
          activeViewQueueRef.current.some((s) => s.id === snippet.id)
        ) {
          playbackQueueRef.current = [...activeViewQueueRef.current];
        } else if (snippet.playlistId) {
          const plItems = snippets.filter((s) => s.playlistId === snippet.playlistId);
          playbackQueueRef.current = plItems.length > 0 ? plItems : [...snippets];
        } else {
          playbackQueueRef.current = [...snippets];
        }
      }

      playbackRunIdRef.current += 1;
      const thisRunId = playbackRunIdRef.current;
      completedSnippetRunRef.current = null;

      currentPositionMsRef.current = targetStart;
      currentSnippetRef.current = snippet;
      lastPlaybackCommandTimeRef.current = Date.now();
      lastTickTimeRef.current = Date.now();
      isPlayingRef.current = true;

      setCurrentSnippet(snippet);
      setPositionMs(targetStart);
      setIsPlaying(true);

      // Broadcast active playback to server coordinator so other devices pause
      syncPlaybackToServer(true, snippet, targetStart);

      // Record to Recently Played & increment album/snippet play counts
      StorageService.recordRecentlyPlayed(snippet);
      setRecentlyPlayed(StorageService.loadRecentlyPlayed());
      setPlayCounts(StorageService.loadPlayCounts());

      // Trigger Spotify API
      if (authStatus.authenticated) {
        // Direct Spotify playSnippet command (routes to Phone in mobile view)
        const res = await spotify.playSnippet(effectiveUri, targetStart, activeDevice?.id);
        lastPlaybackCommandTimeRef.current = Date.now();

        // Ignore stale resolution if another snippet was started while awaiting Spotify
        if (playbackRunIdRef.current !== thisRunId) {
          return;
        }

        if (!res.success) {
          setIsPlaying(false);
          isPlayingRef.current = false;
          syncPlaybackToServer(false, snippet, targetStart);
          if (res.isClientCredentialsOnly) {
            setPlaybackNotice({
              title: 'Spotify Account Required for Audio Playback',
              message:
                'You are currently in Search Mode using Server App Credentials. To stream audio on your phone or speakers, Spotify strictly requires linking your personal Spotify Premium account.',
              type: 'client_credentials',
              snippet,
            });
          } else if (res.isNoDevice) {
            setPlaybackNotice({
              title: 'No Active Spotify Player Found',
              message:
                'Spotify Connect needs an active player to stream music through. Open Spotify on your phone or computer, play any track to wake up Spotify Connect, then tap play again!',
              type: 'no_device',
              snippet,
            });
          } else if (res.isPremiumRequired) {
            setPlaybackNotice({
              title: 'Spotify Premium Required for Remote Playback',
              message:
                'Spotify requires a Spotify Premium account for remote playback via Spotify Connect.',
              type: 'premium_required',
              snippet,
            });
          } else {
            setPlaybackNotice({
              title: 'Playback Error',
              message: res.error || 'Could not start Spotify playback.',
              type: 'error',
              snippet,
            });
          }
        } else {
          if (res.device && res.device.id !== activeDevice?.id) {
            setActiveDevice(res.device);
          }
          // Reset tick anchor and position right when Spotify playback actually begins
          if (
            playbackRunIdRef.current === thisRunId &&
            currentSnippetRef.current?.id === snippet.id &&
            isPlayingRef.current
          ) {
            lastTickTimeRef.current = Date.now();
            currentPositionMsRef.current = targetStart;
            setPositionMs(targetStart);
          }
          setPlaybackNotice(null);
        }
      } else {
        // Prompt user to connect Spotify
        setIsSetupOpen(true);
      }
    },
    [authStatus.authenticated, activeDevice, snippets, syncPlaybackToServer]
  );

  // 5. Completion handler when current playhead reaches point B
  const handleSnippetCompleted = useCallback(
    async (finishedSnippet: MusicSnippet) => {
      // Guard against double invocation or stale completion
      if (!isPlayingRef.current) return;
      if (currentSnippetRef.current && currentSnippetRef.current.id !== finishedSnippet.id) {
        return;
      }

      // Check if this is a multi-segment mashup and we have remaining segments!
      if (
        finishedSnippet.isMashup &&
        finishedSnippet.mashupSegments &&
        finishedSnippet.mashupSegments.length > 1
      ) {
        const curIdx = activeMashupSegmentIndexRef.current;
        if (curIdx < finishedSnippet.mashupSegments.length - 1) {
          const nextIdx = curIdx + 1;
          const nextSeg = finishedSnippet.mashupSegments[nextIdx];
          // Seamless leap to next mashup segment on Spotify!
          playSnippet(finishedSnippet, nextSeg.startMs, nextIdx);
          return;
        }

        // All mashup segments (part 1, part 2, etc.) have now completed!
        // 1. Loop same mashup if repeat-snippet is active
        if (playbackMode === 'repeat-snippet') {
          playSnippet(finishedSnippet, undefined, 0);
          return;
        }

        // 2. Custom user queue
        if (customQueue.length > 0) {
          const [nextInQueue, ...remainingQueue] = customQueue;
          setCustomQueue(remainingQueue);
          playSnippet(nextInQueue);
          return;
        }

        // 3. Repeat entire playlist if explicitly enabled
        if (playbackMode === 'repeat-playlist') {
          const queue = getQueue();
          const currentIndex = queue.findIndex((s) => s.id === finishedSnippet.id);
          const nextSnippet = queue[(currentIndex + 1) % queue.length];
          if (nextSnippet) {
            playSnippet(nextSnippet);
            return;
          }
        }

        // 4. Default: MASHUP IS COMPLETE! Immediately stop playback after the second song!
        setIsPlaying(false);
        isPlayingRef.current = false;
        activeMashupSegmentIndexRef.current = 0;
        setActiveMashupSegmentIndex(0);

        const initialStart = finishedSnippet.mashupSegments[0]?.startMs ?? finishedSnippet.startMs;
        currentPositionMsRef.current = initialStart;
        setPositionMs(initialStart);
        syncPlaybackToServer(false, finishedSnippet, initialStart);

        if (authStatus.authenticated) {
          await spotify.pause(activeDevice?.id);
          spotify.pause().catch(() => {});
        }
        audioEngine.stopAll();
        showToast(`Mashup complete! (${finishedSnippet.mashupSegments.length} parts)`, 'info');
        return;
      }

      const runKey = `${finishedSnippet.id}:${playbackRunIdRef.current}`;
      if (completedSnippetRunRef.current === runKey) {
        return;
      }
      completedSnippetRunRef.current = runKey;

      const queue = getQueue();
      const currentIndex = queue.findIndex((s) => s.id === finishedSnippet.id);
      const isLastSong = currentIndex === -1 || currentIndex >= queue.length - 1;

      // 1. Loop same snippet / mashup
      if (playbackMode === 'repeat-snippet') {
        playSnippet(finishedSnippet, undefined, 0);
        return;
      }

      // 2. Custom user queue
      if (customQueue.length > 0) {
        const [nextInQueue, ...remainingQueue] = customQueue;
        setCustomQueue(remainingQueue);
        playSnippet(nextInQueue);
        return;
      }

      // 3. Advance to next in playlist queue
      if (!isLastSong) {
        const nextSnippet = queue[currentIndex + 1];
        if (nextSnippet) {
          playSnippet(nextSnippet);
          return;
        }
      }

      // 4. Repeat entire playlist if set
      if (playbackMode === 'repeat-playlist' && queue.length > 0) {
        playSnippet(queue[0]);
        return;
      }

      // 5. END OF PLAYLIST: The last song that played!
      // Immediately stop all timers and aggressively halt Spotify playback
      setIsPlaying(false);
      isPlayingRef.current = false;
      const initialStart = finishedSnippet.startMs;
      currentPositionMsRef.current = initialStart;
      setPositionMs(initialStart);
      syncPlaybackToServer(false, finishedSnippet, initialStart);

      if (authStatus.authenticated) {
        await spotify.pause(activeDevice?.id);
        spotify.pause().catch(() => {});
      }
      audioEngine.stopAll();
    },
    [playbackMode, customQueue, getQueue, playSnippet, authStatus.authenticated, activeDevice, syncPlaybackToServer, showToast]
  );

  const handleSnippetCompletedRef = useRef(handleSnippetCompleted);
  useEffect(() => {
    handleSnippetCompletedRef.current = handleSnippetCompleted;
  }, [handleSnippetCompleted]);

  // 6. Playhead timer monitor loop (never calls side-effects inside setPositionMs updater)
  useEffect(() => {
    if (!isPlaying || !currentSnippet) {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      return;
    }

    lastTickTimeRef.current = Date.now();

    playbackTimerRef.current = window.setInterval(() => {
      const activeSnippet = currentSnippetRef.current;
      if (!isPlayingRef.current || !activeSnippet) return;

      const now = Date.now();
      const delta = Math.max(0, now - lastTickTimeRef.current);
      lastTickTimeRef.current = now;

      // For mashup bits, check against current segment's endMs
      const isMashupBit = Boolean(activeSnippet.isMashup && activeSnippet.mashupSegments && activeSnippet.mashupSegments.length > 0);
      const seg = isMashupBit && activeSnippet.mashupSegments ? activeSnippet.mashupSegments[activeMashupSegmentIndexRef.current] : null;
      const targetEnd = seg ? seg.endMs : activeSnippet.endMs;

      const nextPos = currentPositionMsRef.current + delta;
      if (nextPos >= targetEnd) {
        currentPositionMsRef.current = targetEnd;
        handleSnippetCompletedRef.current(activeSnippet);
        return;
      }

      currentPositionMsRef.current = nextPos;
      setPositionMs(nextPos);
    }, 50);

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    };
  }, [isPlaying, currentSnippet]);

  // 7. Remote Spotify Progress Backup Monitor (never auto-pauses active mobile playback)
  useEffect(() => {
    let cancelled = false;
    let syncInterval: number | null = null;

    if (isPlaying && authStatus.authenticated) {
      syncInterval = window.setInterval(async () => {
        if (cancelled || !isPlayingRef.current) return;
        try {
          const spState = await spotify.getPlaybackState();
          if (cancelled || !isPlayingRef.current) return;

          const activeSnippet = currentSnippetRef.current;
          const inCommandGraceWindow = Date.now() - lastPlaybackCommandTimeRef.current < 6000;
          if (inCommandGraceWindow) return;

          const isMashupBit = Boolean(activeSnippet?.isMashup && activeSnippet.mashupSegments && activeSnippet.mashupSegments.length > 0);
          const seg = isMashupBit && activeSnippet?.mashupSegments ? activeSnippet.mashupSegments[activeMashupSegmentIndexRef.current] : null;
          const targetEnd = seg ? seg.endMs : (activeSnippet?.endMs || 0);
          const targetUri = seg ? seg.spotifyUri : (activeSnippet?.spotifyUri || '');

          if (
            spState?.is_playing &&
            activeSnippet &&
            spState.item?.uri === targetUri &&
            typeof spState.progress_ms === 'number' &&
            spState.progress_ms >= targetEnd
          ) {
            handleSnippetCompletedRef.current(activeSnippet);
          }
        } catch (e) {}
      }, 2000);
    }

    return () => {
      cancelled = true;
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [isPlaying, authStatus.authenticated]);

  // Transport handlers
  const handlePause = () => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    audioEngine.stopAll();
    syncPlaybackToServer(false, currentSnippet, positionMs);
    if (authStatus.authenticated) {
      spotify.pause(activeDevice?.id);
    }
  };

  const handleResume = async () => {
    if (!currentSnippet) {
      const queue = getQueue();
      if (queue.length > 0) playSnippet(queue[0]);
      return;
    }
    currentPositionMsRef.current = positionMs;
    lastPlaybackCommandTimeRef.current = Date.now();
    setIsPlaying(true);
    isPlayingRef.current = true;
    lastTickTimeRef.current = Date.now();
    syncPlaybackToServer(true, currentSnippet, positionMs);
    if (authStatus.authenticated) {
      const res = await spotify.playSnippet(currentSnippet.spotifyUri, positionMs, activeDevice?.id);
      lastPlaybackCommandTimeRef.current = Date.now();
      if (!res.success) {
        setIsPlaying(false);
        isPlayingRef.current = false;
        syncPlaybackToServer(false, currentSnippet, positionMs);
        if (res.isClientCredentialsOnly) {
          setPlaybackNotice({
            title: 'Spotify Account Required for Audio Playback',
            message:
              'You are currently in Search Mode using Server App Credentials. To stream audio on your phone or speakers, Spotify strictly requires linking your personal Spotify Premium account.',
            type: 'client_credentials',
            snippet: currentSnippet,
          });
        } else if (res.isNoDevice) {
          setPlaybackNotice({
            title: 'No Active Spotify Player Found',
            message:
              'Spotify Connect needs an active player. Open Spotify on your phone or computer, play any track to wake up Spotify Connect, then tap play again!',
            type: 'no_device',
            snippet: currentSnippet,
          });
        } else if (res.isPremiumRequired) {
          setPlaybackNotice({
            title: 'Spotify Premium Required',
            message:
              'Spotify requires a Spotify Premium account for remote playback via Spotify Connect.',
            type: 'premium_required',
            snippet: currentSnippet,
          });
        }
      } else {
        if (res.device && res.device.id !== activeDevice?.id) {
          setActiveDevice(res.device);
        }
        lastTickTimeRef.current = Date.now();
      }
    } else {
      setIsSetupOpen(true);
    }
  };

  const handleNext = () => {
    // If currently playing a multi-segment mashup and not on the last segment, advance to next segment!
    if (
      currentSnippet?.isMashup &&
      currentSnippet.mashupSegments &&
      currentSnippet.mashupSegments.length > 1
    ) {
      const curIdx = activeMashupSegmentIndexRef.current;
      if (curIdx < currentSnippet.mashupSegments.length - 1) {
        const nextIdx = curIdx + 1;
        const nextSeg = currentSnippet.mashupSegments[nextIdx];
        playSnippet(currentSnippet, nextSeg.startMs, nextIdx);
        return;
      }
    }

    if (customQueue.length > 0) {
      const [nextFromQueue, ...remaining] = customQueue;
      setCustomQueue(remaining);
      playSnippet(nextFromQueue);
      return;
    }
    const queue = getQueue();
    if (queue.length === 0) return;
    if (!currentSnippet) {
      playSnippet(queue[0]);
      return;
    }
    const idx = queue.findIndex((s) => s.id === currentSnippet.id);
    const nextIdx = (idx + 1) % queue.length;
    playSnippet(queue[nextIdx]);
  };

  const handlePrev = () => {
    // If currently playing a multi-segment mashup
    if (
      currentSnippet?.isMashup &&
      currentSnippet.mashupSegments &&
      currentSnippet.mashupSegments.length > 1
    ) {
      const curIdx = activeMashupSegmentIndexRef.current;
      const curSeg = currentSnippet.mashupSegments[curIdx];
      // If played more than 3s into this segment, restart this segment
      if (curSeg && positionMs - curSeg.startMs > 3000) {
        playSnippet(currentSnippet, curSeg.startMs, curIdx);
        return;
      }
      // If on part 2 or 3, go back to previous segment
      if (curIdx > 0) {
        const prevIdx = curIdx - 1;
        const prevSeg = currentSnippet.mashupSegments[prevIdx];
        playSnippet(currentSnippet, prevSeg.startMs, prevIdx);
        return;
      }
    }

    const queue = getQueue();
    if (queue.length === 0) return;
    if (!currentSnippet) {
      playSnippet(queue[0]);
      return;
    }
    // If played more than 3s into the snippet, restart it
    if (positionMs - currentSnippet.startMs > 3000) {
      playSnippet(currentSnippet, currentSnippet.startMs);
      return;
    }
    const idx = queue.findIndex((s) => s.id === currentSnippet.id);
    const prevIdx = (idx - 1 + queue.length) % queue.length;
    playSnippet(queue[prevIdx]);
  };

  const handleSeek = (targetMs: number) => {
    lastPlaybackCommandTimeRef.current = Date.now();
    lastTickTimeRef.current = Date.now();
    currentPositionMsRef.current = targetMs;
    setPositionMs(targetMs);
    if (authStatus.authenticated) {
      spotify.seek(targetMs, activeDevice?.id);
    }
  };

  // Controls ref to always point to latest transport handlers
  const controlsRef = useRef({
    handlePause,
    handleResume,
    handleNext,
    handlePrev,
    handleSeek,
  });

  useEffect(() => {
    controlsRef.current = {
      handlePause,
      handleResume,
      handleNext,
      handlePrev,
      handleSeek,
    };
  });

  // Expose global window.BitStreamControls for Android Native Bridge & configure MediaSession action handlers
  useEffect(() => {
    const controls = {
      togglePlay: () => {
        if (isPlayingRef.current) {
          controlsRef.current.handlePause();
        } else {
          controlsRef.current.handleResume();
        }
      },
      play: () => controlsRef.current.handleResume(),
      pause: () => controlsRef.current.handlePause(),
      next: () => controlsRef.current.handleNext(),
      prev: () => controlsRef.current.handlePrev(),
      seek: (posMs: number) => controlsRef.current.handleSeek(posMs),
    };

    (window as any).BitStreamControls = controls;

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => controls.play());
        navigator.mediaSession.setActionHandler('pause', () => controls.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => controls.next());
        navigator.mediaSession.setActionHandler('previoustrack', () => controls.prev());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined) {
            controls.seek(details.seekTime * 1000);
          }
        });
      } catch (e) {
        console.warn('Failed to register MediaSession action handlers:', e);
      }
    }

    return () => {
      delete (window as any).BitStreamControls;
    };
  }, []);

  // Synchronize playback state with Android Native Bridge, MediaSession API, and Background Keep-Alive
  useEffect(() => {
    if (isPlaying && currentSnippet) {
      const isMashupBit = Boolean(
        currentSnippet.isMashup &&
        currentSnippet.mashupSegments &&
        currentSnippet.mashupSegments.length > 0
      );
      const activeSeg = isMashupBit && currentSnippet.mashupSegments
        ? currentSnippet.mashupSegments[activeMashupSegmentIndex]
        : null;

      const title = activeSeg?.title || currentSnippet.title || 'Snippet';
      const artist = activeSeg?.artist || currentSnippet.artist || 'Spotify BitStream';
      const album = currentSnippet.album || 'BitStream Snippets';
      const albumArt = activeSeg?.albumArt || currentSnippet.albumArt;

      // 1. Keep Android WebView CPU and timers alive via silent audio loop
      backgroundAudio.start();

      // 2. Android Lock Screen Media Notification Bridge
      if (typeof (window as any).BitStreamNativeBridge !== 'undefined') {
        try {
          (window as any).BitStreamNativeBridge.onPlaybackStateChanged(true, title, artist);
        } catch (e) {
          console.warn('BitStreamNativeBridge error:', e);
        }
      }

      // 3. Web MediaSession API for lock screen and Bluetooth controls
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title,
            artist,
            album,
            artwork: albumArt ? [{ src: albumArt, sizes: '512x512', type: 'image/jpeg' }] : []
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch (e) {
          console.warn('MediaSession metadata error:', e);
        }
      }
    } else {
      // 1. Pause background keep-alive audio
      backgroundAudio.pause();

      // 2. Update Android Lock Screen Media Notification
      if (typeof (window as any).BitStreamNativeBridge !== 'undefined') {
        try {
          if (currentSnippet) {
            (window as any).BitStreamNativeBridge.onPlaybackStateChanged(false, currentSnippet.title, currentSnippet.artist);
          } else {
            (window as any).BitStreamNativeBridge.onPlaybackStopped();
          }
        } catch (e) {
          console.warn('BitStreamNativeBridge error:', e);
        }
      }

      // 3. Web MediaSession API
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'paused';
        } catch (e) {}
      }
    }
  }, [isPlaying, currentSnippet, activeMashupSegmentIndex]);

  const handleTogglePlaybackMode = () => {
    if (playbackMode === 'linear') setPlaybackMode('repeat-snippet');
    else if (playbackMode === 'repeat-snippet') setPlaybackMode('repeat-playlist');
    else setPlaybackMode('linear');
  };

  const handleToggleLoopSnippet = (snippet: MusicSnippet) => {
    if (currentSnippet?.id === snippet.id && isPlaying && playbackMode === 'repeat-snippet') {
      setPlaybackMode('linear');
    } else {
      setPlaybackMode('repeat-snippet');
      playSnippet(snippet, snippet.startMs);
    }
  };

  const handleToggleShuffle = () => {
    setIsShuffle(!isShuffle);
  };

  const handleSelectDevice = async (deviceId: string) => {
    spotify.setUserSelectedDeviceId(deviceId);
    const target = devices.find((d) => d.id === deviceId);
    if (target) {
      setActiveDevice(target);
      showToast(`Switched playback to ${target.name}`, 'info');
      // Streamline device transfer: tell Spotify Connect to transfer playback
      await spotify.transferPlayback(deviceId, isPlaying);
      if (isPlaying && currentSnippet) {
        await spotify.seek(positionMs, deviceId);
      }
    }
  };

  // Sleep Timer countdown
  useEffect(() => {
    if (!sleepTimerMinutes || sleepTimeRemainingMs === null || sleepTimeRemainingMs <= 0 || !isPlaying) return;
    const interval = setInterval(() => {
      setSleepTimeRemainingMs((prev) => {
        if (prev === null) return null;
        const next = prev - 1000;
        if (next <= 0) {
          handlePause();
          setSleepTimerMinutes(null);
          showToast('Sleep timer reached. Playback paused.', 'info');
          return null;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sleepTimerMinutes, sleepTimeRemainingMs, isPlaying, showToast]);

  const handleSetSleepTimer = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    if (minutes === null) {
      setSleepTimeRemainingMs(null);
      showToast('Sleep timer turned off', 'info');
    } else {
      setSleepTimeRemainingMs(minutes * 60 * 1000);
      showToast(`Sleep timer set to ${minutes}m`, 'info');
    }
  };

  // Mute & Volume
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    const effectiveVol = nextMuted ? 0 : volume;
    audioEngine.setMasterVolume(effectiveVol);
    if (authStatus.authenticated) {
      spotify.setVolume(Math.round(effectiveVol * 100), activeDevice?.id).catch(() => {});
    }
    showToast(nextMuted ? 'Muted' : 'Unmuted', 'info');
  };

  const handleChangeVolume = (val: number) => {
    setVolume(val);
    if (isMuted && val > 0) {
      setIsMuted(false);
    }
    audioEngine.setMasterVolume(val);
    if (authStatus.authenticated) {
      spotify.setVolume(Math.round(val * 100), activeDevice?.id).catch(() => {});
    }
  };

  // Queue Management
  const handleAddToQueue = (snippet: MusicSnippet, playNext?: boolean) => {
    setCustomQueue((prev) => {
      if (playNext) {
        return [snippet, ...prev.filter((s) => s.id !== snippet.id)];
      } else {
        return [...prev.filter((s) => s.id !== snippet.id), snippet];
      }
    });
    showToast(
      playNext ? `Playing "${snippet.title}" next` : `Added "${snippet.title}" to Up Next queue`,
      'info'
    );
  };

  const handleRemoveFromQueue = (snippetId: string) => {
    setCustomQueue((prev) => prev.filter((s) => s.id !== snippetId));
    showToast('Removed from Up Next queue', 'info');
  };

  const handleMoveQueueItem = (fromIdx: number, toIdx: number) => {
    setCustomQueue((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
  };

  // Favorites
  const handleToggleFavorite = async (snippetOrId: MusicSnippet | string) => {
    const id = typeof snippetOrId === 'string' ? snippetOrId : snippetOrId.id;
    const target = snippets.find((s) => s.id === id);
    if (!target) return;
    const updated: MusicSnippet = {
      ...target,
      isFavorite: !target.isFavorite,
    };
    setSnippets((prev) => prev.map((s) => (s.id === id ? updated : s)));
    if (currentSnippet?.id === id) {
      setCurrentSnippet(updated);
    }
    await StorageService.saveSnippetRecord(updated);
    if (googleUser) {
      saveSnippetToFirestore(googleUser.uid, updated).catch(() => {});
    }
    showToast(
      updated.isFavorite ? `Saved "${updated.title}" to Liked Bits` : `Removed "${updated.title}" from Liked Bits`,
      updated.isFavorite ? 'heart' : 'info'
    );
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) {
          handlePause();
        } else {
          handleResume();
        }
      } else if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey || !isNowPlayingOpen)) {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey || !isNowPlayingOpen)) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.key === 'l' || e.key === 'L') {
        if (currentSnippet) {
          e.preventDefault();
          handleToggleFavorite(currentSnippet);
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (currentSnippet) {
          e.preventDefault();
          setIsNowPlayingOpen((prev) => !prev);
        }
      } else if (e.key === 'Escape') {
        if (isNowPlayingOpen) {
          setIsNowPlayingOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying,
    currentSnippet,
    isNowPlayingOpen,
    customQueue,
    isMuted,
    volume,
    handlePause,
    handleResume,
    handleNext,
    handlePrev,
    handleToggleMute,
    handleToggleFavorite,
  ]);

  // Snippet CRUD
  const handleSaveSnippet = async (snippet: MusicSnippet) => {
    setSnippets((prev) => {
      const index = prev.findIndex((s) => s.id === snippet.id);
      let updated: MusicSnippet[];
      if (index >= 0) {
        updated = [...prev];
        updated[index] = snippet;
      } else {
        updated = [snippet, ...prev];
      }
      return updated;
    });

    // 1. Persist directly to local disk DB (snippets-data.json)
    await StorageService.saveSnippetRecord(snippet);

    // 2. Persist to Firestore if Google user is authenticated
    if (googleUser) {
      saveSnippetToFirestore(googleUser.uid, snippet).catch((err) => {
        console.warn('Failed to save snippet to Firestore:', err);
      });
    }

    // Update playlist item reference
    setPlaylists((prev) => {
      return prev.map((pl) => {
        if (pl.id === snippet.playlistId && !pl.snippetIds.includes(snippet.id)) {
          const mod = { ...pl, snippetIds: [...pl.snippetIds, snippet.id] };
          StorageService.savePlaylistRecord(mod);
          return mod;
        }
        return pl;
      });
    });

    // Ensure any background playback from clipper is paused
    if (authStatus.authenticated) {
      spotify.pause(activeDevice?.id).catch(() => {});
    }
    audioEngine.stopAll();

    setEditingSnippet(null);
  };

  const handleDeleteSnippet = async (snippetId: string) => {
    // Immediate safe deletion (never use window.confirm which is blocked in iframe sandbox)
    setSnippets((prev) => {
      return prev.filter((s) => s.id !== snippetId);
    });

    // 1. Delete from local disk DB
    await StorageService.deleteSnippetRecord(snippetId);

    // 2. Delete from Firestore if Google user is authenticated
    if (googleUser) {
      deleteSnippetFromFirestore(googleUser.uid, snippetId).catch((err) => {
        console.warn('Failed to delete snippet from Firestore:', err);
      });
    }

    if (currentSnippet?.id === snippetId) {
      handlePause();
      setCurrentSnippet(null);
    }
  };

  const handleClearAllSnippets = () => {
    // Clear all snippets from state and storage
    setSnippets([]);
    StorageService.clearAll();

    if (googleUser) {
      snippets.forEach((s) => {
        deleteSnippetFromFirestore(googleUser.uid, s.id).catch(() => {});
      });
    }

    handlePause();
    setCurrentSnippet(null);
  };

  const handleCreatePlaylist = (name: string, description?: string): string => {
    const id = `playlist-${Date.now()}`;
    const newPlaylist: SnippetPlaylist = {
      id,
      name,
      description: description || 'Curated music highlights collection',
      coverGradient: 'from-emerald-600 via-teal-600 to-indigo-800',
      snippetIds: [],
      createdAt: Date.now(),
    };
    setPlaylists((prev) => [...prev, newPlaylist]);
    StorageService.savePlaylistRecord(newPlaylist);

    if (googleUser) {
      savePlaylistToFirestore(googleUser.uid, newPlaylist).catch((err) => {
        console.warn('Failed to save playlist to Firestore:', err);
      });
    }

    return id;
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    await StorageService.deletePlaylistRecord(playlistId);

    if (googleUser) {
      deletePlaylistFromFirestore(googleUser.uid, playlistId).catch((err) => {
        console.warn('Failed to delete playlist from Firestore:', err);
      });
    }

    if (activePlaylistId === playlistId) {
      setActivePlaylistId(null);
    }
  };

  const handleAutoGeneratePlaylist = async () => {
    if (snippets.length === 0) {
      showToast('Clip at least one song first so Auto-Curate can learn your taste!', 'info');
      return;
    }

    showToast('✨ Auto-curating new bits & playlist from your library...', 'info');

    // 1. Rank user's top artists from existing snippets
    const artistCounts = new Map<string, number>();
    for (const s of snippets) {
      const artist = (s.artist || '').trim();
      if (artist && artist !== 'Unknown Artist') {
        artistCounts.set(artist, (artistCounts.get(artist) || 0) + (s.isFavorite ? 2 : 1));
      }
    }
    const topArtists = Array.from(artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([artist]) => artist)
      .slice(0, 4);

    const playlistId = `playlist-auto-${Date.now()}`;
    const createdBits: MusicSnippet[] = [];
    const existingTrackWindows = new Map<string, Array<{ start: number; end: number }>>();
    for (const s of snippets) {
      const key = s.trackId || s.title;
      const list = existingTrackWindows.get(key) || [];
      list.push({ start: s.startMs, end: s.endMs });
      existingTrackWindows.set(key, list);
    }

    const colors = ['#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];

    // 2. If Spotify is connected, fetch fresh companion tracks from user's top artists
    if (authStatus.authenticated && topArtists.length > 0) {
      for (const artist of topArtists.slice(0, 3)) {
        try {
          const results = await spotify.searchTracks(artist);
          const candidate = results.find((t) => {
            const trackArtist = t.artists?.map((a) => a.name).join(', ') || '';
            return (
              !existingTrackWindows.has(t.id) &&
              t.duration_ms >= 140000 &&
              trackArtist.toLowerCase().includes(artist.toLowerCase().split(',')[0].trim())
            );
          });
          if (candidate) {
            const startMs = Math.min(
              Math.max(35000, Math.round(candidate.duration_ms * 0.32)),
              Math.max(0, candidate.duration_ms - 32000)
            );
            const endMs = Math.min(candidate.duration_ms, startMs + 26000);
            const trackArtist = candidate.artists?.map((a) => a.name).join(', ') || artist;
            const newBit: MusicSnippet = {
              id: `auto-bit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              title: candidate.name,
              artist: trackArtist,
              album: candidate.album?.name || candidate.name,
              albumArt: candidate.album?.images?.[0]?.url || '',
              spotifyUri: candidate.uri,
              trackId: candidate.id,
              spotifyUrl: candidate.external_urls?.spotify || `https://open.spotify.com/track/${candidate.id}`,
              durationMs: candidate.duration_ms,
              startMs,
              endMs,
              snippetName: `${candidate.name} • Auto Chorus Cut`,
              playlistId,
              notes: `Auto-curated based on your ${artist} bits`,
              tags: ['auto-curated', artist.toLowerCase().replace(/\s+/g, '-')],
              isFavorite: false,
              createdAt: Date.now() + createdBits.length,
              color: colors[createdBits.length % colors.length],
            };
            createdBits.push(newBit);
            existingTrackWindows.set(candidate.id, [{ start: startMs, end: endMs }]);
          }
        } catch (e) {
          // Ignore search failure and fall back to existing library cuts
        }
      }
    }

    // 3. Also generate complementary non-overlapping highlight cuts (Bridge / Climax / Outro) from user's top tracks
    const uniqueSourceTracks = Array.from(
      new Map(snippets.filter((s) => s.durationMs >= 165000).map((s) => [s.trackId || s.title, s])).values()
    );

    for (const src of uniqueSourceTracks) {
      if (createdBits.length >= 6) break;
      const key = src.trackId || src.title;
      const windows = existingTrackWindows.get(key) || [];
      // Candidate windows: Bridge (~58% of track) or Climax (~72% of track) or Intro Hook (~22% of track)
      const ratios = [0.58, 0.72, 0.24, 0.42];
      for (const ratio of ratios) {
        const candStart = Math.round((src.durationMs * ratio) / 1000) * 1000;
        const candEnd = Math.min(src.durationMs - 4000, candStart + 25000);
        if (candEnd - candStart < 15000) continue;
        const overlaps = windows.some(
          (w) => Math.max(w.start, candStart) < Math.min(w.end, candEnd)
        );
        if (!overlaps) {
          const sectionLabel =
            ratio >= 0.68 ? 'Climax Drop' : ratio >= 0.5 ? 'Bridge Highlight' : 'Hook Cut';
          const newBit: MusicSnippet = {
            id: `auto-bit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: src.title,
            artist: src.artist,
            album: src.album,
            albumArt: src.albumArt,
            spotifyUri: src.spotifyUri,
            trackId: src.trackId,
            spotifyUrl: src.spotifyUrl,
            previewUrl: src.previewUrl,
            durationMs: src.durationMs,
            startMs: candStart,
            endMs: candEnd,
            snippetName: `${src.title} • ${sectionLabel}`,
            playlistId,
            notes: `Auto-cut ${sectionLabel.toLowerCase()} from your library`,
            tags: ['auto-curated'],
            isFavorite: false,
            createdAt: Date.now() + createdBits.length,
            color: colors[createdBits.length % colors.length],
          };
          createdBits.push(newBit);
          windows.push({ start: candStart, end: candEnd });
          existingTrackWindows.set(key, windows);
          break;
        }
      }
    }

    if (createdBits.length === 0) {
      showToast('Could not find new unclipped sections. Try adding a new song first!', 'info');
      return;
    }

    const mixLabel =
      topArtists.length > 0
        ? `✨ Auto Mix • ${topArtists.slice(0, 2).join(' & ')}`
        : `✨ Auto Mix #${playlists.length + 1}`;

    const newPlaylist: SnippetPlaylist = {
      id: playlistId,
      name: mixLabel,
      description: `Auto-generated ${createdBits.length} bits from your favorite artists & tracks`,
      coverGradient: 'from-amber-500 via-emerald-600 to-indigo-800',
      snippetIds: createdBits.map((b) => b.id),
      createdAt: Date.now(),
    };

    setPlaylists((prev) => [...prev, newPlaylist]);
    setSnippets((prev) => [...createdBits, ...prev]);
    setActivePlaylistId(playlistId);
    setIsMobileHome(false);

    await StorageService.savePlaylistRecord(newPlaylist);
    if (googleUser) {
      savePlaylistToFirestore(googleUser.uid, newPlaylist).catch(() => {});
    }

    for (const bit of createdBits) {
      await StorageService.saveSnippetRecord(bit);
      if (googleUser) {
        saveSnippetToFirestore(googleUser.uid, bit).catch(() => {});
      }
    }

    showToast(`Created "${mixLabel}" with ${createdBits.length} new bits!`, 'info');
  };

  // 12b. Save Custom Mashup Bit & Persist to Storage + Playlist
  const handleSaveMashup = async (mashupSnippet: MusicSnippet) => {
    // 1. Ensure auto-mashups playlist exists
    let mashupPl = playlists.find((p) => p.id === 'playlist-auto-mashups');
    if (!mashupPl) {
      mashupPl = {
        id: 'playlist-auto-mashups',
        name: '🔥 Auto Mashups • Medleys',
        description: 'Multi-part continuous medleys and clubbed bits',
        coverGradient: 'from-amber-500 via-rose-600 to-purple-800',
        snippetIds: [mashupSnippet.id],
        createdAt: Date.now(),
      };
      setPlaylists((prev) => [...prev, mashupPl!]);
      await StorageService.savePlaylistRecord(mashupPl);
      if (googleUser) {
        savePlaylistToFirestore(googleUser.uid, mashupPl).catch(() => {});
      }
    } else {
      if (!mashupPl.snippetIds.includes(mashupSnippet.id)) {
        mashupPl = {
          ...mashupPl,
          snippetIds: [mashupSnippet.id, ...mashupPl.snippetIds],
        };
        setPlaylists((prev) => prev.map((p) => (p.id === mashupPl!.id ? mashupPl! : p)));
        await StorageService.savePlaylistRecord(mashupPl);
        if (googleUser) {
          savePlaylistToFirestore(googleUser.uid, mashupPl).catch(() => {});
        }
      }
    }

    // 2. Add mashup snippet to library
    setSnippets((prev) => [mashupSnippet, ...prev.filter((s) => s.id !== mashupSnippet.id)]);
    await StorageService.saveSnippetRecord(mashupSnippet);
    if (googleUser) {
      saveSnippetToFirestore(googleUser.uid, mashupSnippet).catch(() => {});
    }

    setActivePlaylistId('playlist-auto-mashups');
    setIsMobileHome(false);
    showToast(`Clubbed ${mashupSnippet.mashupSegments?.length || 2} bits into "${mashupSnippet.title}"!`, 'success');
  };

  // 12c. Generate Auto Mashups based on listening history & library clusters
  const handleAutoGenerateMashups = async () => {
    const candidates = snippets.filter((s) => !s.isMashup);
    if (candidates.length < 2) {
      showToast('Need at least 2 saved bits to generate mashups!', 'warning');
      return;
    }

    // Curate smart pairings based on taste clusters
    const newMashups: MusicSnippet[] = [];

    // Helper to build a mashup bit from 2 or 3 snippets
    const createMashupBit = (bits: MusicSnippet[], name: string, notes: string): MusicSnippet => {
      const segments = bits.map((s) => ({
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
      const totalDur = bits.reduce((acc, b) => acc + (b.endMs - b.startMs), 0);
      const first = bits[0];
      return {
        id: `auto-mashup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: name,
        artist: bits.map((b) => b.artist.split(',')[0].trim()).join(' × '),
        album: `${bits.length}-Part Auto Mashup`,
        albumArt: first.albumArt,
        spotifyUri: first.spotifyUri,
        trackId: first.trackId,
        spotifyUrl: first.spotifyUrl,
        durationMs: totalDur,
        startMs: first.startMs,
        endMs: first.endMs,
        snippetName: name,
        playlistId: 'playlist-auto-mashups',
        notes,
        tags: ['Auto-Mashup', 'Clubbed', `${bits.length}-Bits`],
        createdAt: Date.now() + newMashups.length,
        isFavorite: true,
        isMashup: true,
        mashupSegments: segments,
      };
    };

    // Cluster 1: Soulful Indian Melodies (A.R. Rahman, Vishal Chandrashekhar, S.P.B., Anurag Kulkarni)
    const melodyBits = candidates.filter((s) => {
      const art = s.artist.toLowerCase();
      const tit = s.title.toLowerCase();
      return (
        art.includes('rahman') ||
        art.includes('vishal') ||
        art.includes('balasubrahmanyam') ||
        art.includes('kulkarni') ||
        tit.includes('inthandham') ||
        tit.includes('munbe vaa') ||
        tit.includes('enna sona') ||
        tit.includes('dil se') ||
        tit.includes('kun faya') ||
        tit.includes('samayama')
      );
    });

    if (melodyBits.length >= 2) {
      const pair = melodyBits.slice(0, 3);
      const mTitle = `✨ Soulful Melodies Mashup (${pair.map((p) => p.title.split('(')[0].trim()).join(' × ')})`;
      newMashups.push(createMashupBit(pair, mTitle, 'Harmonic transitions across your favorite melodic hooks'));
    }

    // Cluster 2: Anthemic Rock (Linkin Park + Queen)
    const rockBits = candidates.filter((s) => {
      const art = s.artist.toLowerCase();
      return art.includes('linkin park') || art.includes('queen');
    });

    if (rockBits.length >= 2) {
      // Pick 2 or 3 distinct tracks
      const distinctRock = Array.from(new Map(rockBits.map((b) => [b.trackId || b.title, b])).values()).slice(0, 3);
      if (distinctRock.length >= 2) {
        const mTitle = `⚡ Stadium Rock Anthem Mashup (${distinctRock.map((p) => p.title.split('-')[0].trim()).join(' × ')})`;
        newMashups.push(createMashupBit(distinctRock, mTitle, 'High energy transitions from rock hooks to anthemic choruses'));
      }
    }

    // Cluster 3: Most Listened / Top Played Mashup
    const sortedByPlay = [...candidates].sort((a, b) => {
      const aPlays = (playCounts[a.id] || 0) + (a.isFavorite ? 5 : 0);
      const bPlays = (playCounts[b.id] || 0) + (b.isFavorite ? 5 : 0);
      return bPlays - aPlays;
    });

    const topPlayedCuts = sortedByPlay.slice(0, 3);
    if (topPlayedCuts.length >= 2 && !newMashups.some((m) => m.mashupSegments?.some((s) => s.snippetId === topPlayedCuts[0].id))) {
      const mTitle = `🔥 Top Listened Cuts Mashup`;
      newMashups.push(createMashupBit(topPlayedCuts, mTitle, 'Your most-replayed snippets stitched into a continuous medley'));
    }

    // Fallback if clusters were too strict: pick first 3 candidates
    if (newMashups.length === 0 && candidates.length >= 2) {
      const fallbackPair = candidates.slice(0, 2);
      newMashups.push(
        createMashupBit(
          fallbackPair,
          `✨ ${fallbackPair.map((p) => p.title.split('(')[0].trim()).join(' × ')} Mashup`,
          'Auto-generated sequential clubbed medley'
        )
      );
    }

    if (newMashups.length === 0) {
      showToast('Could not assemble auto-mashups. Try adding more bits first!', 'info');
      return;
    }

    // Ensure playlist-auto-mashups exists
    let mashupPl = playlists.find((p) => p.id === 'playlist-auto-mashups');
    const newSnippetIds = newMashups.map((m) => m.id);
    if (!mashupPl) {
      mashupPl = {
        id: 'playlist-auto-mashups',
        name: '🔥 Auto Mashups • Medleys',
        description: 'Auto-curated continuous medleys based on your listening history',
        coverGradient: 'from-amber-500 via-rose-600 to-purple-800',
        snippetIds: newSnippetIds,
        createdAt: Date.now(),
      };
      setPlaylists((prev) => [...prev, mashupPl!]);
    } else {
      mashupPl = {
        ...mashupPl,
        snippetIds: Array.from(new Set([...newSnippetIds, ...mashupPl.snippetIds])),
      };
      setPlaylists((prev) => prev.map((p) => (p.id === mashupPl!.id ? mashupPl! : p)));
    }

    setSnippets((prev) => [...newMashups, ...prev]);
    setActivePlaylistId('playlist-auto-mashups');
    setIsMobileHome(false);

    await StorageService.savePlaylistRecord(mashupPl);
    if (googleUser) {
      savePlaylistToFirestore(googleUser.uid, mashupPl).catch(() => {});
    }

    for (const m of newMashups) {
      await StorageService.saveSnippetRecord(m);
      if (googleUser) {
        saveSnippetToFirestore(googleUser.uid, m).catch(() => {});
      }
    }

    showToast(`Created ${newMashups.length} Auto-Mashups based on your listening taste!`, 'success');
  };

  // Gate access: If not logged in, render the BitStream App Login Screen
  if (!appSession) {
    return (
      <AppLoginScreen
        onLoginSuccess={(session) => setAppSession(session)}
        currentTheme={currentTheme}
      />
    );
  }

  // User Guide single-page feature documentation view
  if (isUserGuideOpen) {
    return (
      <UserGuideView
        onClose={() => {
          setIsUserGuideOpen(false);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('guide');
            if (url.hash === '#guide') url.hash = '';
            window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
          }
        }}
        currentTheme={currentTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Navbar */}
      <Navbar
        authStatus={authStatus}
        googleUser={googleUser}
        snippetCount={snippets.length}
        playlistCount={playlists.length}
        hasStoredSpotifyCreds={hasStoredSpotifyCreds}
        isLocalMode={isLocalMode}
        isDbSynced={isDbSynced}
        currentTheme={currentTheme}
        appUsername={appSession.username}
        isMobileHome={isMobileHome}
        onToggleMobileHome={() => setIsMobileHome((prev) => !prev)}
        onLogoutApp={handleLogoutApp}
        onOpenThemeSelector={() => setIsThemeModalOpen(true)}
        onOpenReleaseNotes={() => setIsReleaseNotesOpen(true)}
        onOpenUserGuide={() => {
          setIsUserGuideOpen(true);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('guide', 'true');
            window.history.pushState({}, '', url.toString());
          }
        }}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenMixer={() => setIsMixerOpen(true)}
        onOpenMashupModal={() => setIsMashupModalOpen(true)}
        onOpenClipper={() => {
          setIsPlaying(false);
          audioEngine.stopAll();
          setEditingSnippet(null);
          setIsClipperOpen(true);
        }}
        onOpenSetup={() => setIsSetupOpen(true)}
        onOpenExportImport={() => setIsExportImportOpen(true)}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-2 sm:px-6 pt-2 sm:pt-4 pb-20 sm:pb-28">
        <SnippetPlaylistView
          playlists={playlists}
          snippets={snippets}
          currentSnippet={currentSnippet}
          isPlaying={isPlaying}
          activePlaylistId={activePlaylistId}
          recentlyPlayedSnippets={recentlyPlayed}
          playCounts={playCounts}
          isMobileHome={isMobileHome}
          onChangeMobileHome={setIsMobileHome}
          onSelectPlaylist={setActivePlaylistId}
          onPlaySnippet={(s) => {
            if (
              activeViewQueueRef.current &&
              activeViewQueueRef.current.some((item) => item.id === s.id)
            ) {
              playbackQueueRef.current = [...activeViewQueueRef.current];
            } else {
              playbackQueueRef.current = [];
            }
            playSnippet(s);
          }}
          onPauseSnippet={handlePause}
          onActiveQueueChange={(viewQueue) => {
            activeViewQueueRef.current = viewQueue;
            if (!isPlayingRef.current) {
              playbackQueueRef.current = [...viewQueue];
            }
          }}
          onPlayEntirePlaylist={(plId, viewSnippets) => {
            const baseQueue =
              viewSnippets && viewSnippets.length > 0
                ? viewSnippets
                : plId
                  ? snippets.filter((s) => s.playlistId === plId)
                  : snippets;
            const queue = isShuffle
              ? [...baseQueue].sort(() => Math.random() - 0.5)
              : [...baseQueue];
            activeViewQueueRef.current = queue;
            playbackQueueRef.current = queue;
            if (queue.length > 0) playSnippet(queue[0]);
          }}
          onEditSnippet={(s) => {
            setIsPlaying(false);
            audioEngine.stopAll();
            setEditingSnippet(s);
            setIsClipperOpen(true);
          }}
          onDeleteSnippet={handleDeleteSnippet}
          onClearAllSnippets={handleClearAllSnippets}
          onCreatePlaylist={handleCreatePlaylist}
          onDeletePlaylist={handleDeletePlaylist}
          onAutoGeneratePlaylist={handleAutoGeneratePlaylist}
          onOpenMixer={() => setIsMixerOpen(true)}
          onOpenMashupModal={() => setIsMashupModalOpen(true)}
          onAutoGenerateMashups={handleAutoGenerateMashups}
          onOpenClipper={() => {
            setIsPlaying(false);
            audioEngine.stopAll();
            setEditingSnippet(null);
            setIsClipperOpen(true);
          }}
          playbackMode={playbackMode}
          onToggleLoopSnippet={handleToggleLoopSnippet}
          onToggleFavorite={handleToggleFavorite}
          onAddToQueue={handleAddToQueue}
        />
      </main>

      {/* Persistent Bottom Snippet Player Bar */}
      <SnippetPlayerBar
        currentSnippet={currentSnippet}
        isPlaying={isPlaying}
        positionMs={positionMs}
        mashupSegmentIndex={activeMashupSegmentIndex}
        playbackMode={playbackMode}
        isShuffle={isShuffle}
        volume={volume}
        isMuted={isMuted}
        devices={devices}
        activeDevice={activeDevice}
        isSpotifyAuth={authStatus.authenticated}
        isFavorite={currentSnippet ? Boolean(currentSnippet.isFavorite) : false}
        onPlay={handleResume}
        onPause={handlePause}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onTogglePlaybackMode={handleTogglePlaybackMode}
        onToggleShuffle={handleToggleShuffle}
        onChangeVolume={handleChangeVolume}
        onToggleMute={handleToggleMute}
        onSelectDevice={handleSelectDevice}
        onOpenNowPlaying={() => setIsNowPlayingOpen(true)}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Flagship Now Playing Screen Modal */}
      <NowPlayingModal
        isOpen={isNowPlayingOpen}
        onClose={() => setIsNowPlayingOpen(false)}
        currentSnippet={currentSnippet}
        isPlaying={isPlaying}
        positionMs={positionMs}
        mashupSegmentIndex={activeMashupSegmentIndex}
        playbackMode={playbackMode}
        isShuffle={isShuffle}
        volume={volume}
        isMuted={isMuted}
        devices={devices}
        activeDevice={activeDevice}
        queue={customQueue.length > 0 ? customQueue : getQueue()}
        sleepTimerMinutes={sleepTimerMinutes}
        sleepTimeRemainingMs={sleepTimeRemainingMs}
        onPlay={handleResume}
        onPause={handlePause}
        onNext={handleNext}
        onPrev={handlePrev}
        onSeek={handleSeek}
        onTogglePlaybackMode={handleTogglePlaybackMode}
        onToggleShuffle={handleToggleShuffle}
        onChangeVolume={handleChangeVolume}
        onToggleMute={handleToggleMute}
        onToggleFavorite={handleToggleFavorite}
        onSetSleepTimer={handleSetSleepTimer}
        onSelectDevice={handleSelectDevice}
        onPlayFromQueue={(s) => playSnippet(s)}
        onRemoveFromQueue={handleRemoveFromQueue}
        onMoveQueueItem={handleMoveQueueItem}
      />

      {/* Global Interactive Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />

      {/* Modals */}
      <SnippetClipperModal
        isOpen={isClipperOpen}
        onClose={() => {
          setIsClipperOpen(false);
          setEditingSnippet(null);
          if (authStatus.authenticated) {
            spotify.pause(activeDevice?.id).catch(() => {});
          }
          audioEngine.stopAll();
        }}
        playlists={playlists}
        onSaveSnippet={handleSaveSnippet}
        onCreatePlaylist={handleCreatePlaylist}
        initialSnippet={editingSnippet}
        onDeleteSnippet={handleDeleteSnippet}
        isSpotifyAuth={authStatus.authenticated}
        hasStoredSpotifyCreds={hasStoredSpotifyCreds}
        devices={devices}
        activeDevice={activeDevice}
        onSelectDevice={handleSelectDevice}
        onOpenSpotifySetup={() => setIsSetupOpen(true)}
        googleUser={googleUser}
      />

      <SpotifySetupModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        onConnected={refreshDevices}
        googleUser={googleUser}
      />

      <ExportImportModal
        isOpen={isExportImportOpen}
        onClose={() => setIsExportImportOpen(false)}
        snippets={snippets}
        playlists={playlists}
        onImportSuccess={(data) => {
          setSnippets(data.snippets);
          setPlaylists(data.playlists);
        }}
      />

      <FirebaseAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        errorCode={authErrorCode}
        onSelectLocalMode={handleSelectLocalMode}
      />

      <PlaybackNoticeModal
        isOpen={Boolean(playbackNotice)}
        onClose={() => setPlaybackNotice(null)}
        notice={playbackNotice}
        onOpenSpotifySetup={() => setIsSetupOpen(true)}
        onRefreshDevices={refreshDevices}
        devices={devices}
        onSelectDevice={handleSelectDevice}
        onRetryPlay={() => {
          if (playbackNotice?.snippet) {
            playSnippet(playbackNotice.snippet);
          }
        }}
      />

      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        currentTheme={currentTheme}
        onSelectTheme={(theme) => {
          setCurrentTheme(theme);
          saveStoredTheme(theme);
        }}
        onClose={() => setIsThemeModalOpen(false)}
      />

      {/* Release Notes & Environment Tracker (Local DB) */}
      <ReleaseNotesView
        isOpen={isReleaseNotesOpen}
        onClose={() => setIsReleaseNotesOpen(false)}
      />

      {/* BitStream DJ Audio Mixer Modal (Dual-Deck Web Audio Engine) */}
      <BitMixerModal
        isOpen={isMixerOpen}
        onClose={() => setIsMixerOpen(false)}
        snippets={snippets}
        currentSnippet={currentSnippet}
        devices={devices}
        activeDevice={activeDevice}
        onSelectDevice={handleSelectDevice}
        isSpotifyAuth={authStatus.authenticated}
      />

      {/* BitStream Club / Mashup Modal */}
      <MashupClubModal
        isOpen={isMashupModalOpen}
        onClose={() => setIsMashupModalOpen(false)}
        snippets={snippets}
        currentSnippet={currentSnippet}
        onSaveMashup={handleSaveMashup}
        onPlaySnippet={(s, startAtMs, segIdx) => playSnippet(s, startAtMs, segIdx)}
        onAutoGenerateMashups={handleAutoGenerateMashups}
      />
    </div>
  );
}
