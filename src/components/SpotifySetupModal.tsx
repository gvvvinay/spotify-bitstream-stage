import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Key,
  ShieldCheck,
  PlayCircle,
  Info,
  Cloud,
  Save,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Zap,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { spotify } from '../services/spotify';
import {
  saveSpotifyCredentialsToFirestore,
  getSpotifyCredentialsFromFirestore,
  deleteSpotifyCredentialsFromFirestore,
} from '../services/firebase';

interface SpotifySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: () => void;
  googleUser?: FirebaseUser | null;
}

export const SpotifySetupModal: React.FC<SpotifySetupModalProps> = ({
  isOpen,
  onClose,
  onConnected,
  googleUser,
}) => {
  const [copiedDev, setCopiedDev] = useState(false);
  const [copiedShared, setCopiedShared] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [customSecret, setCustomSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [directToken, setDirectToken] = useState('');
  const [activeTab, setActiveTab] = useState<'oauth' | 'token'>('oauth');
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Firestore storage status
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);
  const [isSavingToFirestore, setIsSavingToFirestore] = useState(false);
  const [isSavedInFirestore, setIsSavedInFirestore] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [confirmDeleteCreds, setConfirmDeleteCreds] = useState(false);

  const port = typeof window !== 'undefined' && window.location.port ? window.location.port : '3100';
  const [localIp, setLocalIp] = useState<string>('192.168.1.71');
  const [lanCallbackUrl, setLanCallbackUrl] = useState<string>(`https://192.168.1.71:${port}/auth/callback`);
  const [copiedLan, setCopiedLan] = useState(false);
  const [isTriggeringPC, setIsTriggeringPC] = useState(false);
  const loopbackCallbackUrl = `http://127.0.0.1:${port}/auth/callback`;
  const isNetworkDevice = typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  // Load stored credentials from localStorage & Firestore when modal opens
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/auth/config')
      .then((r) => r.json())
      .then((cfg) => {
        if (cfg.configured) {
          setServerConfigured(true);
        }
        if (cfg.localIp) {
          setLocalIp(cfg.localIp);
          setLanCallbackUrl(cfg.lanRedirectUri || `https://${cfg.localIp}:${port}/auth/callback`);
        }
      })
      .catch(() => {});

    // First load from localStorage for instant display
    const stored = spotify.getStoredCredentials();
    if (stored.clientId && !customClientId) {
      setCustomClientId(stored.clientId);
      if (stored.clientSecret && !customSecret) {
        setCustomSecret(stored.clientSecret);
      }
    }

    if (!googleUser) return;

    let isCancelled = false;
    setIsLoadingFirestore(true);

    getSpotifyCredentialsFromFirestore(googleUser.uid)
      .then((creds) => {
        if (isCancelled) return;
        if (creds && creds.clientId) {
          setCustomClientId(creds.clientId);
          setCustomSecret(creds.clientSecret || '');
          spotify.saveStoredCredentials(creds.clientId, creds.clientSecret || '', creds.refreshToken);
          setIsSavedInFirestore(true);
          setLastSavedAt(creds.updatedAt || null);
        } else {
          setIsSavedInFirestore(false);
        }
      })
      .catch((err) => {
        console.warn('Could not load Spotify credentials from Firestore:', err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingFirestore(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, googleUser]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'dev' | 'shared' | 'lan') => {
    navigator.clipboard.writeText(text);
    if (type === 'dev') {
      setCopiedDev(true);
      setTimeout(() => setCopiedDev(false), 2000);
    } else if (type === 'lan') {
      setCopiedLan(true);
      setTimeout(() => setCopiedLan(false), 2000);
    } else {
      setCopiedShared(true);
      setTimeout(() => setCopiedShared(false), 2000);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!googleUser) {
      setStatusMessage('⚠️ Please sign in with Google first to store credentials.');
      return;
    }
    if (!customClientId.trim()) {
      setStatusMessage('⚠️ Please enter a Spotify Client ID.');
      return;
    }

    setIsSavingToFirestore(true);
    setStatusMessage('Saving Spotify credentials to Firestore...');
    try {
      await saveSpotifyCredentialsToFirestore(
        googleUser.uid,
        customClientId.trim(),
        customSecret.trim()
      );
      setIsSavedInFirestore(true);
      setLastSavedAt(Date.now());
      setStatusMessage('✅ Spotify Client ID and Secret successfully saved to Firestore!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage(`❌ Error saving to Firestore: ${err.message}`);
    } finally {
      setIsSavingToFirestore(false);
    }
  };

  const handleDeleteFromFirestore = async () => {
    if (!googleUser) return;
    if (!confirmDeleteCreds) {
      setConfirmDeleteCreds(true);
      return;
    }
    setConfirmDeleteCreds(false);

    try {
      await deleteSpotifyCredentialsFromFirestore(googleUser.uid);
      setCustomClientId('');
      setCustomSecret('');
      setIsSavedInFirestore(false);
      setLastSavedAt(null);
      setStatusMessage('🗑️ Stored Spotify credentials removed from Firestore.');
      setTimeout(() => setStatusMessage(null), 2500);
    } catch (err: any) {
      setStatusMessage(`❌ Error removing credentials: ${err.message}`);
    }
  };

  const handleStartOAuth = async () => {
    const clientIdToUse = customClientId.trim();
    if (!clientIdToUse && !serverConfigured) {
      setStatusMessage('⚠️ Spotify Client ID is required! Please enter your Client ID in Step 3 below.');
      return;
    }

    setIsConnecting(true);
    setStatusMessage('Opening Spotify authorization window...');

    // Auto-save credentials to backend so server can use them
    if (customClientId.trim()) {
      fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: customClientId.trim(),
          clientSecret: customSecret.trim(),
        }),
      }).catch(() => {});
    }

    // Auto-save to Firestore in background if Google user is active
    if (googleUser && customClientId.trim()) {
      saveSpotifyCredentialsToFirestore(googleUser.uid, customClientId.trim(), customSecret.trim())
        .then(() => {
          setIsSavedInFirestore(true);
          setLastSavedAt(Date.now());
        })
        .catch((e) => console.warn('Background Firestore save failed:', e));
    }

    try {
      const isLoopback = typeof window !== 'undefined' &&
        (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
      const protocol = isLoopback ? 'http:' : 'https:';
      const currentCallbackUrl = typeof window !== 'undefined'
        ? `${protocol}//${window.location.host}/auth/callback`
        : 'http://127.0.0.1:3100/auth/callback';

      const queryParams = new URLSearchParams();
      if (clientIdToUse) queryParams.set('client_id', clientIdToUse);
      queryParams.set('redirect_uri', currentCallbackUrl);

      const res = await fetch(`/api/auth/url?${queryParams.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Could not generate Spotify authorization URL');
      }

      const { url, redirectUri } = await res.json();
      const effectiveRedirectUri = redirectUri || currentCallbackUrl;

      // Listen via both window postMessage and BroadcastChannel for cross-tab mobile communication
      let bc: BroadcastChannel | null = null;
      try {
        bc = new BroadcastChannel('spotify_oauth_channel');
      } catch (e) {}

      const cleanup = () => {
        window.removeEventListener('message', messageListener);
        if (bc) {
          try {
            bc.close();
          } catch (e) {}
          bc = null;
        }
      };

      const messageListener = (event: MessageEvent) => {
        if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
          cleanup();
          if (event.data.accessToken) {
            spotify.setToken(event.data.accessToken, event.data.expiresIn || 3600, event.data.user, 'user_oauth');
          }
          // Save refresh token to Firestore if available
          if (googleUser && customClientId.trim() && event.data.refreshToken) {
            saveSpotifyCredentialsToFirestore(
              googleUser.uid,
              customClientId.trim(),
              customSecret.trim(),
              event.data.refreshToken
            ).catch((e) => console.warn('Could not store refresh token to Firestore:', e));
          }
          setStatusMessage('✅ Spotify Premium account connected successfully!');
          setIsConnecting(false);
          setTimeout(() => {
            onConnected();
            onClose();
          }, 1000);
        } else if (event.data?.type === 'OAUTH_AUTH_CODE') {
          // If server env vars weren't set, exchange code using custom credentials
          cleanup();
          const clientIdToUse = customClientId.trim();
          const secretToUse = customSecret.trim();

          if (clientIdToUse && secretToUse) {
            fetch('/api/auth/exchange-code', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: event.data.code,
                clientId: clientIdToUse,
                clientSecret: secretToUse,
                redirectUri: effectiveRedirectUri,
              }),
            })
              .then((r) => r.json())
              .then((tokenData) => {
                if (tokenData.access_token) {
                  spotify.setToken(tokenData.access_token, tokenData.expires_in || 3600, tokenData.user, 'user_oauth');
                  if (googleUser && tokenData.refresh_token) {
                    saveSpotifyCredentialsToFirestore(
                      googleUser.uid,
                      clientIdToUse,
                      secretToUse,
                      tokenData.refresh_token
                    ).catch((e) => console.warn('Could not store refresh token to Firestore:', e));
                  }
                  setStatusMessage('✅ Spotify Premium account connected successfully!');
                  setTimeout(() => {
                    onConnected();
                    onClose();
                  }, 1000);
                } else {
                  throw new Error(tokenData.error_description || 'Exchange failed');
                }
              })
              .catch((err) => {
                setStatusMessage(`❌ Error: ${err.message}`);
                setIsConnecting(false);
              });
          } else {
            setStatusMessage('⚠️ Please provide both Client ID and Client Secret to complete token exchange.');
            setIsConnecting(false);
          }
        } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
          cleanup();
          setStatusMessage(`❌ Auth error: ${event.data.error}`);
          setIsConnecting(false);
        }
      };

      window.addEventListener('message', messageListener);
      if (bc) {
        bc.onmessage = (event) => messageListener(event as any);
      }

      // Open OAuth popup to Spotify's authorization URL directly
      const authWindow = window.open(
        url,
        'spotify_oauth_popup',
        'width=600,height=720,menubar=no,toolbar=no'
      );

      if (!authWindow) {
        // Fallback for mobile browsers blocking popups: redirect directly
        console.log('Popup window blocked, proceeding with direct page redirect');
        window.location.href = url;
        return;
      }
    } catch (err: any) {
      setStatusMessage(`❌ ${err.message}`);
      setIsConnecting(false);
    }
  };

  // 1-Tap Auto-Link via PC: Triggers loopback authorization on the host PC and automatically syncs phone
  const handleRemoteLinkViaPC = async () => {
    setIsTriggeringPC(true);
    setStatusMessage('🚀 Triggering 1-Tap Spotify authorization on host PC...');
    try {
      const res = await fetch('/api/auth/pc-trigger', { method: 'POST' });
      if (!res.ok) throw new Error('Could not trigger authorization on host PC');
      setStatusMessage('⏳ PC authorization window launched! Waiting for authorization...');

      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        const active = await spotify.checkServerSession();
        if (active) {
          clearInterval(pollTimer);
          setIsTriggeringPC(false);
          setStatusMessage('✅ Spotify Account successfully linked via PC!');
          setTimeout(() => {
            onConnected();
            onClose();
          }, 1000);
        } else if (attempts > 30) {
          clearInterval(pollTimer);
          setIsTriggeringPC(false);
          setStatusMessage('⚠️ Auto-link timed out. You can retry or authorize directly.');
        }
      }, 1500);
    } catch (err: any) {
      setIsTriggeringPC(false);
      setStatusMessage(`❌ Auto-link error: ${err.message}`);
    }
  };

  const handleAutoConnect = async () => {
    setIsConnecting(true);
    setStatusMessage('Connecting Spotify API with server credentials...');

    // Sync to backend if custom values were provided
    if (customClientId.trim()) {
      fetch('/api/auth/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: customClientId.trim(),
          clientSecret: customSecret.trim(),
        }),
      }).catch(() => {});
    }

    // Auto-save to Firestore if logged into Google
    if (googleUser && customClientId.trim()) {
      saveSpotifyCredentialsToFirestore(googleUser.uid, customClientId.trim(), customSecret.trim())
        .then(() => {
          setIsSavedInFirestore(true);
          setLastSavedAt(Date.now());
        })
        .catch(() => {});
    }

    try {
      let result = null;
      if (customClientId.trim() && customSecret.trim()) {
        result = await spotify.autoConnectFromCredentials({
          clientId: customClientId.trim(),
          clientSecret: customSecret.trim(),
        });
      } else {
        const checkRes = await spotify.checkServerSession();
        result = { success: checkRes };
      }

      if (result.success) {
        setStatusMessage('✅ Successfully connected to Spotify API with credentials!');
        setTimeout(() => {
          onConnected();
          onClose();
        }, 800);
      } else {
        setStatusMessage('❌ Could not connect with credentials. Please check Client ID and Secret.');
      }
    } catch (err: any) {
      setStatusMessage(`❌ Error: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleApplyDirectToken = () => {
    if (!directToken.trim()) return;
    spotify.setToken(directToken.trim(), 3600);
    setStatusMessage('✅ Access token applied successfully!');
    setTimeout(() => {
      onConnected();
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Spotify API Integration
              </h2>
              <p className="text-xs text-slate-400">
                Connect Spotify to play snippets directly from Point A to Point B
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab('oauth')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'oauth'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            OAuth App Connect (Recommended)
          </button>
          <button
            onClick={() => setActiveTab('token')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'token'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Direct Access Token (Quick Test)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {isNetworkDevice && (
            <div className="p-4 bg-indigo-950/40 border border-indigo-500/40 rounded-2xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-white">Mobile Device Connected</h4>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      192 IP Enabled
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                      {window.location.hostname}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Choose how you would like to connect your Spotify account to BitStream:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRemoteLinkViaPC}
                  disabled={isTriggeringPC || isConnecting}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/20 active:scale-[0.99] cursor-pointer"
                  title="Triggers Spotify authorization on your PC automatically without touching your PC"
                >
                  <Zap className={`w-4 h-4 fill-current ${isTriggeringPC ? 'animate-spin' : ''}`} />
                  <span>{isTriggeringPC ? 'Linking PC...' : '⚡ 1-Tap Auto-Link via PC'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartOAuth}
                  disabled={isConnecting || isTriggeringPC}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-[0.99] cursor-pointer"
                  title="Direct HTTPS authorization on this device"
                >
                  <PlayCircle className="w-4 h-4 fill-current text-white" />
                  <span>Authorize on Mobile</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsConnecting(true);
                    setStatusMessage('Checking server for active Spotify connection...');
                    const success = await spotify.checkServerSession();
                    if (success) {
                      setStatusMessage('✅ Successfully synchronized Spotify connection!');
                      setTimeout(() => {
                        onConnected();
                        onClose();
                      }, 800);
                    } else {
                      setStatusMessage('⚠️ No active Spotify connection found. Tap Auto-Link or Authorize above.');
                      setIsConnecting(false);
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 active:scale-[0.99] cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Sync from PC</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'oauth' ? (
            <>
              {/* Quick Connect Banner when Server has credentials configured */}
              {serverConfigured && (
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Spotify Credentials Configured in Server</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      {isNetworkDevice ? 'Mobile Ready' : 'Host PC Ready'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Your Client ID & Secret are already loaded. Click below to link your personal Spotify Premium account. Once linked, the connection is instantly shared across all devices on your local network!
                  </p>
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    disabled={isConnecting}
                    className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] cursor-pointer"
                  >
                    <PlayCircle className="w-4 h-4 fill-current text-slate-950" />
                    <span>Authorize Spotify Account for Playback (1-Click)</span>
                  </button>
                </div>
              )}

              {/* Step 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    Open Spotify Developer Dashboard
                  </span>
                  <a
                    href="https://developer.spotify.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
                  >
                    Open Dashboard <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p className="text-xs text-slate-400 pl-8">
                  Log in, click <strong>Create App</strong>, set App Name to <em>BitStream</em> and choose Web API.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-2">
                <span className="font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  Add Redirect URIs in your Spotify App Settings
                </span>
                <p className="text-xs text-slate-400 pl-8">
                  Under your App's <strong>Settings</strong>, paste these exact Callback URLs into <em>Redirect URIs</em> (add both so authorization works from PC and your phone):
                </p>

                <div className="pl-8 space-y-3 pt-1">
                  {/* Warning on Spotify's strict HTTPS requirement for 192 IPs */}
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Spotify Policy (Insecure URI Fix):</strong> Spotify strictly mandates <strong className="text-white font-mono">HTTPS</strong> for all LAN/192.168.x.x addresses and rejects plain HTTP with <em>"redirect uri insecure"</em>. Make sure the mobile redirect URI starts with <strong className="text-emerald-300 font-mono">https://</strong> in your Spotify Developer Dashboard.
                    </div>
                  </div>

                  {/* Mobile / 192 LAN IP Callback URL */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 font-mono uppercase">
                        📱 Mobile & LAN Redirect URI (HTTPS Mandatory)
                      </label>
                      <span className="text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded font-mono">
                        For Direct Phone Authorization
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-950 border border-emerald-500/40 rounded-xl p-2.5 font-mono text-xs text-emerald-300 shadow-inner">
                      <span className="truncate flex-1 select-all font-bold tracking-wide">{lanCallbackUrl}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(lanCallbackUrl, 'lan')}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white transition flex items-center gap-1.5 shrink-0 font-sans font-bold shadow"
                      >
                        {copiedLan ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLan ? 'Copied!' : 'Copy Mobile URI'}
                      </button>
                    </div>
                  </div>

                  {/* Loopback Callback URL */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5 font-mono uppercase">
                        💻 PC / Loopback Redirect URI (127.0.0.1)
                      </label>
                      <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
                        For PC Authorization
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5 font-mono text-xs text-slate-300 shadow-inner">
                      <span className="truncate flex-1 select-all font-bold tracking-wide">{loopbackCallbackUrl}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(loopbackCallbackUrl, 'dev')}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition flex items-center gap-1.5 shrink-0 font-sans font-bold shadow"
                      >
                        {copiedDev ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedDev ? 'Copied!' : 'Copy PC URI'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Spotify Client ID & Secret + Firestore Sync */}
              <div className="space-y-3">
                <span className="font-semibold text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                    3
                  </span>
                  Spotify API Credentials & Account Cloud Vault
                </span>

                <div className="pl-8 space-y-3">
                  {/* Account / Firestore Status Banner */}
                  {googleUser ? (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-semibold text-emerald-300">
                            Cloud Firestore Storage Enabled
                          </span>
                        </div>
                        {isSavedInFirestore ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Stored in Firestore
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium">
                            Not stored yet
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Account: <strong className="text-white font-mono">{googleUser.email}</strong>. Client ID & Secret stored here stay safely synced across devices and sessions.
                      </p>
                      {lastSavedAt && (
                        <p className="text-[10px] text-slate-400">
                          Last updated in Firestore: {new Date(lastSavedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-slate-200">Want cross-device sync?</strong> Sign in with your Google account at top-right to store your Client ID & Secret securely in Firestore.
                      </div>
                    </div>
                  )}

                  {isLoadingFirestore && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Loading saved credentials from your Firestore account...</span>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Spotify Client ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 7a8b9c0d1e2f3g4h5i6j7k8l9m"
                      value={customClientId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomClientId(val);
                        setIsSavedInFirestore(false);
                        spotify.saveStoredCredentials(val, customSecret);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400">Spotify Client Secret</label>
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
                      >
                        {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showSecret ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        placeholder="e.g. 9f8e7d6c5b4a3..."
                        value={customSecret}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomSecret(val);
                          setIsSavedInFirestore(false);
                          spotify.saveStoredCredentials(customClientId, val);
                        }}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 font-mono pr-10"
                      />
                    </div>
                  </div>

                  {/* Actions for Firestore storage */}
                  {googleUser && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleSaveToFirestore}
                        disabled={isSavingToFirestore || !customClientId.trim()}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
                      >
                        {isSavingToFirestore ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {isSavedInFirestore ? 'Update in Firestore' : 'Store in Firestore'}
                      </button>

                      {isSavedInFirestore && (
                        <button
                          type="button"
                          onClick={handleDeleteFromFirestore}
                          className={`px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition border ${
                            confirmDeleteCreds
                              ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                              : 'bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border-slate-700/80'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {confirmDeleteCreds ? 'Confirm Delete from Cloud?' : 'Delete Stored Credentials'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Connect Buttons */}
              <div className="pl-8 pt-2 space-y-3">
                {/* 1. Spotify Premium User Account Authorization (Uses the same Client ID & Secret above) */}
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      Full Song Playback & Timestamp Clipping
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                      Uses Same Client ID & Secret
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleStartOAuth}
                    disabled={isConnecting}
                    className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
                  >
                    <PlayCircle className="w-5 h-5 fill-current text-slate-950" />
                    <span>Authorize Full Song Playback (Spotify Premium)</span>
                  </button>
                  <p className="text-[11px] text-slate-300 text-center leading-relaxed">
                    Uses your <strong>exact same Client ID & Secret</strong> to link your Spotify Premium account. Enables streaming full songs, real-time scrubbing, and accurate Point A to Point B snipping in the clipper screen.
                  </p>
                </div>

                {/* 2. Client Credentials Fast Connect */}
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <button
                    type="button"
                    onClick={handleAutoConnect}
                    disabled={isConnecting || !customClientId.trim() || !customSecret.trim()}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-2 border border-slate-700/80"
                  >
                    <Zap className="w-4 h-4 text-amber-400 fill-current" />
                    {isConnecting ? 'Connecting...' : 'Quick Connect API Credentials (Catalog Search Only)'}
                  </button>
                  <div className="text-[10px] text-slate-400 text-center">
                    Note: Spotify's API limits direct credentials to catalog search. For full song audio playback, click the green button above to authorize your Premium account.
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Direct Token tab */
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Instant Developer Test:</strong> You can grab a temporary OAuth token directly from the{' '}
                  <a
                    href="https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-blue-200"
                  >
                    Spotify Web API Console
                  </a>{' '}
                  (click "Try It", authorize scopes, and copy the Bearer token).
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Spotify User Access Token (Bearer)</label>
                <textarea
                  rows={4}
                  placeholder="BQB_..."
                  value={directToken}
                  onChange={(e) => setDirectToken(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                onClick={handleApplyDirectToken}
                disabled={!directToken.trim()}
                className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <ShieldCheck className="w-5 h-5" />
                Apply Access Token
              </button>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-center">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>BitStream uses the Spotify Web API & Web Playback SDK</span>
          <button onClick={onClose} className="hover:text-white transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
