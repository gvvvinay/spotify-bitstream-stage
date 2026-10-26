import { SpotifyDevice, SpotifyTrackResult, SpotifyUser } from '../types';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: any;
    };
  }
}

export interface SpotifyAuthStatus {
  authenticated: boolean;
  accessToken: string | null;
  user: SpotifyUser | null;
  expiresAt: number | null;
  authMode: 'user_oauth' | 'client_credentials' | 'none';
  isPremium: boolean;
}

class SpotifyService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private user: SpotifyUser | null = null;
  private authMode: 'user_oauth' | 'client_credentials' | 'none' = 'none';
  private player: any = null;
  private webPlaybackDeviceId: string | null = null;
  private cachedDevices: SpotifyDevice[] = [];
  private userSelectedDeviceId: string | null = null;
  private lastActiveDeviceId: string | null = null;
  private trackAlbumUriCache: Record<string, string> = {};
  private mobileEmbedController: any = null;
  private mobileEmbedActive: boolean = false;
  private mobileEmbedPlaySeq: number = 0;
  private mobileEmbedReadyPromise: Promise<any> | null = null;
  private listeners: Set<(status: SpotifyAuthStatus) => void> = new Set();
  private playerStateListeners: Set<(state: any) => void> = new Set();

  constructor() {
    // Restore cached token if valid
    const cachedToken = localStorage.getItem('spotify_access_token');
    const cachedExpires = Number(localStorage.getItem('spotify_token_expires') || '0');
    const cachedMode = (localStorage.getItem('spotify_auth_mode') as 'user_oauth' | 'client_credentials') || 'none';
    const cachedUser = localStorage.getItem('spotify_user');

    try {
      const cachedAlbumUris = localStorage.getItem('bitstream_track_album_uris_v1');
      if (cachedAlbumUris) {
        this.trackAlbumUriCache = JSON.parse(cachedAlbumUris) || {};
      }
    } catch (e) {}

    if (cachedToken && cachedExpires > Date.now()) {
      this.accessToken = cachedToken;
      this.tokenExpiresAt = cachedExpires;
      this.authMode = cachedMode;
      if (cachedUser) {
        try {
          this.user = JSON.parse(cachedUser);
        } catch (e) {}
      }
    }
  }

  public isPhoneDevice(d?: SpotifyDevice | null): boolean {
    if (!d) return false;
    const type = (d.type || '').toLowerCase();
    const name = (d.name || '').toLowerCase();
    return (
      type === 'smartphone' ||
      type === 'phone' ||
      type === 'mobile' ||
      /iphone|ipad|ipod|android|phone|mobile|pixel|galaxy|oneplus/i.test(name)
    );
  }

  public isPhysicalMobileDevice(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Android|Mobile|WebOS|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }

  public isMobileEnvironment(): boolean {
    if (typeof window === 'undefined') return false;
    return this.isPhysicalMobileDevice() || window.innerWidth < 768;
  }

  public setUserSelectedDeviceId(deviceId: string | null) {
    this.userSelectedDeviceId = deviceId;
  }

  public getUserSelectedDeviceId(): string | null {
    return this.userSelectedDeviceId;
  }

  public activateMobileAudio() {
    if (this.player && typeof this.player.activateElement === 'function') {
      try {
        this.player.activateElement().catch?.(() => {});
      } catch (e) {}
    }
  }

  public resolvePreferredDevice(
    devList: SpotifyDevice[],
    manualDeviceId?: string | null
  ): SpotifyDevice | null {
    if (!devList || devList.length === 0) return null;

    const effectiveManualId = manualDeviceId ?? this.userSelectedDeviceId;
    if (effectiveManualId) {
      const manual = devList.find((d) => d.id === effectiveManualId);
      if (manual) return manual;
    }

    // In Mobile View or on a Phone: prioritize the Phone (Smartphone) device if available
    if (this.isMobileEnvironment()) {
      const activePhone = devList.find((d) => this.isPhoneDevice(d) && d.is_active);
      if (activePhone) return activePhone;

      const anyPhone = devList.find((d) => this.isPhoneDevice(d));
      if (anyPhone) return anyPhone;

      if (this.webPlaybackDeviceId) {
        const localWeb = devList.find((d) => d.id === this.webPlaybackDeviceId);
        if (localWeb) return localWeb;
      }
    }

    if (this.webPlaybackDeviceId) {
      const localActive = devList.find((d) => d.id === this.webPlaybackDeviceId && d.is_active);
      if (localActive) return localActive;
    }

    return devList.find((d) => d.is_active) || devList[0] || null;
  }

  public subscribeAuth(listener: (status: SpotifyAuthStatus) => void) {
    this.listeners.add(listener);
    listener(this.getAuthStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribePlayerState(listener: (state: any) => void) {
    this.playerStateListeners.add(listener);
    return () => {
      this.playerStateListeners.delete(listener);
    };
  }

  private notifyAuth() {
    const status = this.getAuthStatus();
    this.listeners.forEach((l) => l(status));
  }

  public getAuthStatus(): SpotifyAuthStatus {
    const isAuth = Boolean(this.accessToken && this.tokenExpiresAt > Date.now());
    const isPremium = Boolean(
      isAuth &&
      this.authMode === 'user_oauth' &&
      (this.user?.product === 'premium' || this.user?.product === undefined)
    );
    return {
      authenticated: isAuth,
      accessToken: isAuth ? this.accessToken : null,
      user: this.user,
      expiresAt: this.tokenExpiresAt || null,
      authMode: isAuth ? this.authMode : 'none',
      isPremium,
    };
  }

  public getWebPlaybackDeviceId(): string | null {
    return this.webPlaybackDeviceId;
  }

  public setToken(
    token: string,
    expiresInSeconds: number = 3600,
    user?: SpotifyUser,
    authMode: 'user_oauth' | 'client_credentials' = 'user_oauth'
  ) {
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
    this.authMode = authMode;
    localStorage.setItem('spotify_access_token', token);
    localStorage.setItem('spotify_token_expires', String(this.tokenExpiresAt));
    localStorage.setItem('spotify_auth_mode', authMode);

    if (user) {
      this.user = user;
      localStorage.setItem('spotify_user', JSON.stringify(user));
    } else if (authMode === 'user_oauth') {
      this.fetchCurrentUser();
    } else {
      this.user = {
        id: 'client_credentials',
        display_name: 'App Credentials (Search Only)',
        product: 'client_credentials',
      };
      localStorage.setItem('spotify_user', JSON.stringify(this.user));
    }

    this.notifyAuth();
    if (authMode === 'user_oauth') {
      this.initWebPlaybackSDK();

      // Broadcast session to server so all devices on LAN (phones, tablets) receive it
      fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          refreshToken: localStorage.getItem('spotify_refresh_token') || undefined,
          expiresIn: expiresInSeconds,
          user: user || this.user,
        }),
      }).catch(() => {});
    }
  }

  public clearAuth() {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
    this.user = null;
    this.authMode = 'none';
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expires');
    localStorage.removeItem('spotify_user');
    localStorage.removeItem('spotify_auth_mode');

    if (this.player) {
      try {
        this.player.disconnect();
      } catch (e) {
        // ignore
      }
      this.player = null;
    }
    this.webPlaybackDeviceId = null;

    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.notifyAuth();
  }

  public async checkServerSession(): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.accessToken) {
          const expiresIn = Math.max(60, Math.floor((data.expiresAt - Date.now()) / 1000));
          const mode: 'user_oauth' | 'client_credentials' =
            data.authMode || (data.user?.product === 'client_credentials' ? 'client_credentials' : 'user_oauth');
          this.setToken(data.accessToken, expiresIn, data.user, mode);
          return true;
        }
      }
    } catch (e) {
      console.warn('Server session check failed:', e);
    }
    return false;
  }

  // Stored Client Credentials & Refresh Token management (localStorage fallback & cache)
  public saveStoredCredentials(clientId: string, clientSecret: string, refreshToken?: string) {
    if (clientId && clientId.trim()) localStorage.setItem('spotify_client_id', clientId.trim());
    if (clientSecret && clientSecret.trim()) localStorage.setItem('spotify_client_secret', clientSecret.trim());
    if (refreshToken && refreshToken.trim()) localStorage.setItem('spotify_refresh_token', refreshToken.trim());
  }

  public getStoredCredentials(): { clientId: string; clientSecret: string; refreshToken?: string } {
    return {
      clientId: localStorage.getItem('spotify_client_id') || '',
      clientSecret: localStorage.getItem('spotify_client_secret') || '',
      refreshToken: localStorage.getItem('spotify_refresh_token') || undefined,
    };
  }

  public clearStoredCredentials() {
    localStorage.removeItem('spotify_client_id');
    localStorage.removeItem('spotify_client_secret');
    localStorage.removeItem('spotify_refresh_token');
  }

  // Auto-connect with Client Credentials (Stored in Firebase Firestore or provided)
  public async connectWithClientCredentials(clientId: string, clientSecret: string): Promise<boolean> {
    try {
      this.saveStoredCredentials(clientId, clientSecret);
      const res = await fetch('/api/auth/client-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('Spotify Client Credentials connection failed:', err);
        return false;
      }

      const data = await res.json();
      if (data.access_token) {
        this.setToken(data.access_token, data.expires_in || 3600, data.user, 'client_credentials');
        return true;
      }
    } catch (err) {
      console.error('Error connecting with client credentials:', err);
    }
    return false;
  }

  // Launch Spotify User OAuth popup directly using Client ID & Secret
  public async startUserOAuthFlow(
    clientId?: string,
    clientSecret?: string,
    onSuccess?: (user: SpotifyUser, refreshToken?: string) => void
  ): Promise<{ success: boolean; user?: SpotifyUser; refreshToken?: string; error?: string }> {
    const stored = this.getStoredCredentials();
    const effectiveClientId = (clientId || stored.clientId || '').trim();
    const effectiveClientSecret = (clientSecret || stored.clientSecret || '').trim();

    return new Promise(async (resolve) => {
      try {
        // Dynamically resolve redirect URI to match the current origin
        // Spotify strictly requires HTTPS for non-loopback IPs (e.g. 192.168.x.x) and allows HTTP for 127.0.0.1
        const isLoopback = typeof window !== 'undefined' &&
          (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
        const protocol = isLoopback ? 'http:' : 'https:';
        const redirectUri = typeof window !== 'undefined'
          ? `${protocol}//${window.location.host}/auth/callback`
          : 'http://127.0.0.1:3100/auth/callback';

        const queryParams = new URLSearchParams();
        if (effectiveClientId) queryParams.set('client_id', effectiveClientId);
        queryParams.set('redirect_uri', redirectUri);

        const res = await fetch(`/api/auth/url?${queryParams.toString()}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          resolve({ success: false, error: errData.error || 'Failed to generate Spotify authorization link' });
          return;
        }
        const { url } = await res.json();

        // Setup message listeners (both window postMessage and BroadcastChannel for mobile multi-tab)
        let bc: BroadcastChannel | null = null;
        try {
          bc = new BroadcastChannel('spotify_oauth_channel');
        } catch (e) {}

        const cleanup = () => {
          window.removeEventListener('message', handleMsg);
          if (bc) {
            try {
              bc.close();
            } catch (e) {}
            bc = null;
          }
        };

        const handleMsg = async (event: MessageEvent) => {
          if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
            cleanup();
            if (event.data.accessToken) {
              this.setToken(event.data.accessToken, event.data.expiresIn || 3600, event.data.user, 'user_oauth');
            }
            if (event.data.refreshToken) {
              this.saveStoredCredentials(effectiveClientId, effectiveClientSecret, event.data.refreshToken);
            }
            if (onSuccess && event.data.user) {
              onSuccess(event.data.user, event.data.refreshToken);
            }
            resolve({
              success: true,
              user: event.data.user,
              refreshToken: event.data.refreshToken,
            });
          } else if (event.data?.type === 'OAUTH_AUTH_CODE') {
            cleanup();
            const code = event.data.code;
            if (effectiveClientId && effectiveClientSecret) {
              try {
                const exchRes = await fetch('/api/auth/exchange-code', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code,
                    clientId: effectiveClientId,
                    clientSecret: effectiveClientSecret,
                    redirectUri,
                  }),
                });
                const tokenData = await exchRes.json();
                if (tokenData.access_token) {
                  this.setToken(tokenData.access_token, tokenData.expires_in || 3600, tokenData.user, 'user_oauth');
                  if (tokenData.refresh_token) {
                    this.saveStoredCredentials(effectiveClientId, effectiveClientSecret, tokenData.refresh_token);
                  }
                  if (onSuccess && tokenData.user) {
                    onSuccess(tokenData.user, tokenData.refresh_token);
                  }
                  resolve({
                    success: true,
                    user: tokenData.user,
                    refreshToken: tokenData.refresh_token,
                  });
                  return;
                }
              } catch (e: any) {
                resolve({ success: false, error: e.message || 'Token exchange failed' });
                return;
              }
            }
            resolve({
              success: false,
              error: 'Authorization code received. Please ensure Client ID & Secret are provided in Spotify Settings.',
            });
          } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
            cleanup();
            resolve({ success: false, error: event.data.error || 'Authentication was cancelled.' });
          }
        };

        window.addEventListener('message', handleMsg);
        if (bc) {
          bc.onmessage = (event) => handleMsg(event as any);
        }

        const width = 550;
        const height = 750;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const authWindow = window.open(
          url,
          'spotify_oauth_popup',
          `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no`
        );

        if (!authWindow) {
          // Fallback: If popup is blocked (common on mobile browsers), redirect directly
          console.log('Popup window blocked, proceeding with direct page redirect');
          window.location.href = url;
          return;
        }
      } catch (err: any) {
        resolve({ success: false, error: err.message || 'Error opening Spotify login' });
      }
    });
  }

  // Auto-connect/refresh using stored refresh token and client credentials
  public async connectWithRefreshToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<{ success: boolean; newRefreshToken?: string }> {
    try {
      const res = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: refreshToken.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        }),
      });

      if (!res.ok) {
        return { success: false };
      }

      const data = await res.json();
      if (data.access_token) {
        this.setToken(data.access_token, data.expires_in || 3600, data.user, 'user_oauth');
        return { success: true, newRefreshToken: data.refresh_token };
      }
    } catch (err) {
      console.warn('Error refreshing Spotify token:', err);
    }
    return { success: false };
  }

  // Automatically connect using stored Firebase credentials
  public async autoConnectFromCredentials(creds: {
    clientId: string;
    clientSecret?: string;
    refreshToken?: string;
  }): Promise<{ success: boolean; mode: 'oauth_refresh' | 'client_credentials' | 'none'; newRefreshToken?: string }> {
    if (!creds.clientId) return { success: false, mode: 'none' };

    // 1. If refresh token is available, attempt full user OAuth session refresh first
    if (creds.refreshToken && creds.clientSecret) {
      const refreshResult = await this.connectWithRefreshToken(
        creds.refreshToken,
        creds.clientId,
        creds.clientSecret
      );
      if (refreshResult.success) {
        return {
          success: true,
          mode: 'oauth_refresh',
          newRefreshToken: refreshResult.newRefreshToken,
        };
      }
    }

    // 2. If client secret is present, connect via Client Credentials flow (instant API access)
    if (creds.clientSecret) {
      const ccSuccess = await this.connectWithClientCredentials(creds.clientId, creds.clientSecret);
      if (ccSuccess) {
        return { success: true, mode: 'client_credentials' };
      }
    }

    return { success: false, mode: 'none' };
  }

  public async fetchCurrentUser(): Promise<SpotifyUser | null> {
    if (!this.accessToken) return null;
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        this.user = {
          id: data.id,
          display_name: data.display_name || data.id,
          email: data.email,
          images: data.images,
          product: data.product,
        };
        localStorage.setItem('spotify_user', JSON.stringify(this.user));
        this.notifyAuth();
        return this.user;
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
    }
    return null;
  }

  // Initialize Spotify Web Playback SDK in the browser
  public initWebPlaybackSDK() {
    if (!this.accessToken || typeof window === 'undefined') return;

    const setupPlayer = () => {
      if (!window.Spotify || this.player) return;

      try {
        const isMobile = this.isPhysicalMobileDevice();
        const player = new window.Spotify.Player({
          name: isMobile ? 'BitStream Mobile Player (Phone)' : 'BitStream Snippet Player (Web)',
          getOAuthToken: (cb: (token: string) => void) => {
            if (this.accessToken) cb(this.accessToken);
          },
          volume: 0.8,
        });

        player.addListener('ready', ({ device_id }: { device_id: string }) => {
          console.log('✅ Spotify Web Playback SDK Ready with Device ID:', device_id);
          this.webPlaybackDeviceId = device_id;
          this.notifyAuth();
        });

        player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
          console.warn('Spotify Web Playback Device offline:', device_id);
          if (this.webPlaybackDeviceId === device_id) {
            this.webPlaybackDeviceId = null;
          }
        });

        player.addListener('player_state_changed', (state: any) => {
          this.playerStateListeners.forEach((l) => l(state));
        });

        player.addListener('initialization_error', ({ message }: { message: string }) => {
          console.warn('Spotify SDK initialization_error:', message);
        });

        player.addListener('authentication_error', ({ message }: { message: string }) => {
          console.warn('Spotify SDK authentication_error:', message);
        });

        player.addListener('account_error', ({ message }: { message: string }) => {
          console.warn('Spotify SDK account_error (Premium required for Web Playback SDK):', message);
        });

        player.connect();
        this.player = player;
      } catch (err) {
        console.error('Error instantiating Spotify Web Player:', err);
      }
    };

    if (window.Spotify) {
      setupPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = setupPlayer;
      // Load script dynamically and safely if not already present
      if (typeof document !== 'undefined' && !document.getElementById('spotify-player-sdk-script')) {
        try {
          const script = document.createElement('script');
          script.id = 'spotify-player-sdk-script';
          script.src = 'https://sdk.scdn.co/spotify-player.js';
          script.async = true;
          script.crossOrigin = 'anonymous';
          script.onerror = () => {
            console.warn('Spotify Web Playback SDK script could not be loaded.');
          };
          document.head.appendChild(script);
        } catch (e) {
          console.warn('Could not inject Spotify SDK script:', e);
        }
      }
    }
  }

  // Ensure in-browser Spotify Embed Controller is available for mobile fallback when native phone app is asleep
  private ensureMobileEmbedController(initialUri: string): Promise<any> {
    if (this.mobileEmbedController) {
      return Promise.resolve(this.mobileEmbedController);
    }
    if (this.mobileEmbedReadyPromise) {
      return this.mobileEmbedReadyPromise;
    }
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return Promise.resolve(null);
    }

    this.mobileEmbedReadyPromise = new Promise((resolve) => {
      let host = document.getElementById('bitstream-mobile-audio-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'bitstream-mobile-audio-host';
        host.style.position = 'fixed';
        host.style.bottom = '0px';
        host.style.left = '0px';
        host.style.width = '1px';
        host.style.height = '1px';
        host.style.opacity = '0.01';
        host.style.pointerEvents = 'none';
        host.style.zIndex = '-1';
        const target = document.createElement('div');
        target.id = 'bitstream-mobile-embed-target';
        host.appendChild(target);
        document.body.appendChild(host);
      }

      const createCtrl = (IFrameAPI: any) => {
        const target = document.getElementById('bitstream-mobile-embed-target');
        if (!target || !IFrameAPI) {
          resolve(null);
          return;
        }
        try {
          IFrameAPI.createController(
            target,
            { uri: initialUri, width: 1, height: 1 },
            (controller: any) => {
              this.mobileEmbedController = controller;
              resolve(controller);
            }
          );
        } catch (e) {
          resolve(null);
        }
      };

      const win = window as any;
      if (win.SpotifyIframeApi) {
        createCtrl(win.SpotifyIframeApi);
      } else {
        const prevCallback = win.onSpotifyIframeApiReady;
        win.onSpotifyIframeApiReady = (IFrameAPI: any) => {
          win.SpotifyIframeApi = IFrameAPI;
          if (typeof prevCallback === 'function') {
            try {
              prevCallback(IFrameAPI);
            } catch (e) {}
          }
          createCtrl(IFrameAPI);
        };
        if (!document.getElementById('spotify-iframe-api-script')) {
          const script = document.createElement('script');
          script.id = 'spotify-iframe-api-script';
          script.src = 'https://open.spotify.com/embed/iframe-api/v1';
          script.async = true;
          script.onerror = () => resolve(null);
          document.body.appendChild(script);
        }
      }

      setTimeout(() => resolve(this.mobileEmbedController || null), 3500);
    });

    return this.mobileEmbedReadyPromise;
  }

  private async playViaMobileEmbed(trackUri: string, startMs: number): Promise<boolean> {
    try {
      const ctrl = await this.ensureMobileEmbedController(trackUri);
      if (!ctrl) return false;
      this.mobileEmbedActive = true;
      this.mobileEmbedPlaySeq += 1;
      const seq = this.mobileEmbedPlaySeq;
      const startSec = Math.max(0, Math.floor(startMs / 1000));

      if (typeof ctrl.loadUri === 'function') {
        ctrl.loadUri(trackUri, false, startSec);
      }

      const triggerPlay = () => {
        if (!this.mobileEmbedActive || this.mobileEmbedPlaySeq !== seq) return;
        try {
          if (typeof ctrl.play === 'function') {
            ctrl.play();
          } else if (typeof ctrl.resume === 'function') {
            ctrl.resume();
          }
        } catch (e) {}
      };

      triggerPlay();

      // Spotify Embed IFrame loads new URIs asynchronously on 2nd+ tracks;
      // schedule follow-up play/seek triggers so playback reliably starts once loaded.
      setTimeout(() => {
        if (!this.mobileEmbedActive || this.mobileEmbedPlaySeq !== seq) return;
        if (startSec > 0 && typeof ctrl.seek === 'function') {
          try {
            ctrl.seek(startSec);
          } catch (e) {}
        }
        triggerPlay();
      }, 180);

      setTimeout(triggerPlay, 450);
      setTimeout(triggerPlay, 850);

      return true;
    } catch (e) {
      return false;
    }
  }

  public isMobileEmbedPlaying(): boolean {
    return false;
  }

  // Get User's Available Spotify Connect Devices
  public async getDevices(): Promise<SpotifyDevice[]> {
    if (!this.accessToken) return [];
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        this.cachedDevices = data.devices || [];
        return this.cachedDevices;
      }
    } catch (e) {
      console.warn('Could not fetch devices:', e);
    }
    return this.cachedDevices;
  }

  // Get currently playing song on user's active Spotify app
  public async getCurrentlyPlaying(): Promise<{
    item: SpotifyTrackResult | null;
    progress_ms: number;
    is_playing: boolean;
  } | null> {
    if (!this.accessToken) return null;
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.status === 204) return null;
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch currently playing track:', e);
    }
    return null;
  }

  // Get full player playback state from Spotify (active device, is_playing, current track)
  public async getPlaybackState(): Promise<{
    device: SpotifyDevice | null;
    is_playing: boolean;
    progress_ms: number;
    item: SpotifyTrackResult | null;
  } | null> {
    if (!this.accessToken) return null;
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.status === 204) return null;
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch Spotify playback state:', e);
    }
    return null;
  }

  // Resolve and cache a track's parent album URI (required by Android/iOS Spotify Connect mobile players)
  public async getAlbumUriForTrack(trackUri: string): Promise<string | null> {
    if (!trackUri) return null;
    if (this.trackAlbumUriCache[trackUri]) {
      return this.trackAlbumUriCache[trackUri];
    }
    const parts = trackUri.split(':');
    const trackId = parts[parts.length - 1];
    if (!trackId || !this.accessToken) return null;

    try {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const albumUri = data?.album?.uri;
        if (albumUri) {
          this.trackAlbumUriCache[trackUri] = albumUri;
          if (data?.uri) {
            this.trackAlbumUriCache[data.uri] = albumUri;
          }
          try {
            localStorage.setItem('bitstream_track_album_uris_v1', JSON.stringify(this.trackAlbumUriCache));
          } catch (e) {}
          return albumUri;
        }
      }
    } catch (e) {
      console.warn('Could not resolve album URI for track:', trackUri, e);
    }
    return null;
  }

  // Batch prefetch album URIs for up to 50 tracks per request so playback is 0ms instant
  public async prefetchAlbumUris(trackUris: string[]): Promise<void> {
    if (!this.accessToken || !trackUris || trackUris.length === 0) return;
    const missingUris = Array.from(
      new Set(trackUris.filter((u) => u && u.startsWith('spotify:track:') && !this.trackAlbumUriCache[u]))
    );
    if (missingUris.length === 0) return;

    for (let i = 0; i < missingUris.length; i += 50) {
      const batch = missingUris.slice(i, i + 50);
      const ids = batch.map((u) => u.split(':').pop()!).filter(Boolean);
      if (ids.length === 0) continue;
      try {
        const res = await fetch(`https://api.spotify.com/v1/tracks?ids=${ids.join(',')}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const tracks: any[] = data?.tracks || [];
          tracks.forEach((t, idx) => {
            const albumUri = t?.album?.uri;
            if (albumUri) {
              const reqUri = batch[idx];
              if (reqUri) this.trackAlbumUriCache[reqUri] = albumUri;
              if (t?.uri) this.trackAlbumUriCache[t.uri] = albumUri;
            }
          });
          try {
            localStorage.setItem('bitstream_track_album_uris_v1', JSON.stringify(this.trackAlbumUriCache));
          } catch (e) {}
        }
      } catch (e) {
        // ignore prefetch errors
      }
    }
  }

  // Play a song at startMs
  public async playSnippet(
    trackUri: string,
    startMs: number,
    targetDeviceId?: string | null,
    isRetry: boolean = false
  ): Promise<{
    success: boolean;
    error?: string;
    isClientCredentialsOnly?: boolean;
    isPremiumRequired?: boolean;
    isNoDevice?: boolean;
    device?: SpotifyDevice | null;
  }> {
    // Unlock mobile browser audio element on user gesture
    this.activateMobileAudio();

    if (!this.accessToken) {
      await this.checkServerSession();
      if (!this.accessToken) {
        return { success: false, error: 'Spotify account not connected' };
      }
    }

    // 1. If currently in Client Credentials mode (app token without user OAuth), playback is prohibited by Spotify
    if (this.authMode === 'client_credentials') {
      return {
        success: false,
        error:
          'Player command failed: Premium required. You are currently connected with API Client Credentials (which only permits catalog searching). Remote playback strictly requires linking your Spotify Premium user account.',
        isClientCredentialsOnly: true,
        isPremiumRequired: true,
      };
    }

    // 2. If user profile was loaded and indicates Spotify Free
    if (this.user?.product && this.user.product !== 'premium' && this.user.product !== 'client_credentials') {
      return {
        success: false,
        error: `Your connected Spotify account (@${this.user.display_name}) is registered as Spotify Free (${this.user.product}). Spotify requires Spotify Premium for remote playback.`,
        isPremiumRequired: true,
      };
    }

    try {
      let resolvedDeviceId = this.userSelectedDeviceId || targetDeviceId || null;
      let resolvedDeviceObj: SpotifyDevice | null = null;

      // In Mobile View / on Phone: prefer a Phone device if one is available on the account
      if (this.isMobileEnvironment() && !this.userSelectedDeviceId) {
        let devList = this.cachedDevices;
        if (!devList.some((d) => this.isPhoneDevice(d))) {
          devList = await this.getDevices();
        }
        const phoneDevice =
          devList.find((d) => this.isPhoneDevice(d) && d.is_active) ||
          devList.find((d) => this.isPhoneDevice(d));
        if (phoneDevice) {
          resolvedDeviceId = phoneDevice.id;
          resolvedDeviceObj = phoneDevice;
        }
      }

      let activeDeviceParam = resolvedDeviceId ? `?device_id=${resolvedDeviceId}` : '';
      if (!activeDeviceParam && this.webPlaybackDeviceId) {
        activeDeviceParam = `?device_id=${this.webPlaybackDeviceId}`;
      }

      // Resolve album context_uri (required for Android/OnePlus & iOS Spotify Connect mobile playback)
      const albumUri = await this.getAlbumUriForTrack(trackUri);
      const posMs = Math.max(0, Math.floor(startMs));

      const playPayload = albumUri
        ? {
            context_uri: albumUri,
            offset: { uri: trackUri },
            position_ms: posMs,
          }
        : {
            uris: [trackUri],
            position_ms: posMs,
          };

      let res = await fetch(`https://api.spotify.com/v1/me/player/play${activeDeviceParam}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(playPayload),
      });

      // Fallback to direct uris array if album offset failed (e.g. relinked single)
      if (!res.ok && res.status !== 401 && res.status !== 404 && albumUri) {
        res = await fetch(`https://api.spotify.com/v1/me/player/play${activeDeviceParam}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [trackUri],
            position_ms: posMs,
          }),
        });
      }

      if (res.status === 204 || res.status === 200) {
        return { success: true, device: resolvedDeviceObj };
      }

      // Handle 401 Unauthorized (Expired token) - auto-refresh and retry once
      if (res.status === 401 && !isRetry) {
        console.warn('Spotify token expired (401), refreshing from server...');
        const refreshed = await this.checkServerSession();
        if (refreshed && this.accessToken) {
          return this.playSnippet(trackUri, startMs, resolvedDeviceId, true);
        }
      }

      // Handle 503 / 502 Service Unavailable - retry once after short delay
      if ((res.status === 503 || res.status === 502) && !isRetry) {
        console.warn('Spotify returned 503/502 Service Unavailable, retrying in 400ms...');
        await new Promise((r) => setTimeout(r, 400));
        return this.playSnippet(trackUri, startMs, resolvedDeviceId, true);
      }

      // If error (e.g. 404 No Active Device), attempt to seek if already playing this track
      const errText = await res.text();
      console.warn('Spotify play returned status:', res.status, errText);

      const seekRes = await fetch(
        `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.max(0, Math.floor(startMs))}${
          resolvedDeviceId ? `&device_id=${resolvedDeviceId}` : ''
        }`,
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }
      );
      if (seekRes.status === 204 || seekRes.status === 200) {
        return { success: true, device: resolvedDeviceObj };
      }

      let errorMsg = 'Could not start playback on Spotify.';
      let reason = '';
      try {
        const parsed = JSON.parse(errText);
        errorMsg = parsed.error?.message || errorMsg;
        reason = parsed.error?.reason || '';
      } catch (e) {
        // ignore
      }

      const isPremiumErr =
        errorMsg.toLowerCase().includes('premium required') ||
        reason === 'PREMIUM_REQUIRED' ||
        res.status === 403;

      if (isPremiumErr) {
        return {
          success: false,
          error:
            'Spotify API returned: "Premium required". If you have Spotify Premium, this happens when: 1) You are connected with API Client Credentials instead of your personal account; or 2) A free account is signed in on your browser/Spotify app. Click "Link Spotify Premium" below to authorize your Premium account directly.',
          isPremiumRequired: true,
          isClientCredentialsOnly: (this.authMode as string) === 'client_credentials',
        };
      }

      const isNoDeviceErr =
        errorMsg.toLowerCase().includes('device') ||
        res.status === 404 ||
        reason === 'NO_ACTIVE_DEVICE';

      if (isNoDeviceErr) {
        // Auto-recovery: If devices are available on the account, transfer playback to preferred device and retry
        if (!isRetry) {
          try {
            const devices = await this.getDevices();
            if (devices && devices.length > 0) {
              const bestDevice =
                this.resolvePreferredDevice(devices, this.userSelectedDeviceId) ||
                devices.find((d) => d.name.toLowerCase().includes('bitstream')) ||
                devices.find((d) => d.is_active) ||
                devices[0];
              if (bestDevice && bestDevice.id) {
                console.log(`Auto-activating Spotify device: ${bestDevice.name} (${bestDevice.id})`);
                await this.transferPlayback(bestDevice.id, false);
                return this.playSnippet(trackUri, startMs, bestDevice.id, true);
              }
            }
          } catch (e) {
            console.warn('Auto device activation failed:', e);
          }
        }

        return {
          success: false,
          error:
            'No active Spotify player found. Open Spotify (on phone, computer, or web) and tap play on any track to wake up Spotify Connect, then tap play again!',
          isNoDevice: true,
        };
      }

      return { success: false, error: errorMsg };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error communicating with Spotify' };
    }
  }

  // Play full song starting at specified positionMs
  public async playTrack(
    trackUri: string,
    positionMs: number = 0,
    targetDeviceId?: string | null
  ): Promise<{
    success: boolean;
    error?: string;
    isClientCredentialsOnly?: boolean;
    isPremiumRequired?: boolean;
    isNoDevice?: boolean;
  }> {
    return this.playSnippet(trackUri, positionMs, targetDeviceId);
  }

  // Transfer playback to a device
  public async transferPlayback(deviceId: string, play: boolean = false): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play,
        }),
      });
      return res.status === 204 || res.status === 200;
    } catch (e) {
      return false;
    }
  }

  // Seek playback
  public async seek(positionMs: number, targetDeviceId?: string | null): Promise<boolean> {
    if (this.mobileEmbedActive && this.mobileEmbedController) {
      try {
        this.mobileEmbedController.seek?.(Math.floor(positionMs / 1000));
        return true;
      } catch (e) {}
    }

    // If Web Playback SDK is the active device or no device specified, seek locally first for instant response
    if (this.player && (!targetDeviceId || targetDeviceId === this.webPlaybackDeviceId)) {
      try {
        await this.player.seek(Math.floor(positionMs));
      } catch (e) {}
    }
    if (!this.accessToken) return false;
    try {
      let effectiveDeviceId = targetDeviceId;
      if (this.isMobileEnvironment() && !this.userSelectedDeviceId) {
        const phoneDev = this.cachedDevices.find((d) => this.isPhoneDevice(d));
        if (phoneDev) effectiveDeviceId = phoneDev.id;
      }
      const url = `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}${
        effectiveDeviceId ? `&device_id=${effectiveDeviceId}` : ''
      }`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return res.status === 204 || res.status === 200;
    } catch (e) {
      return false;
    }
  }

  // Pause playback
  public async pause(targetDeviceId?: string | null): Promise<boolean> {
    this.mobileEmbedPlaySeq += 1;
    if (this.mobileEmbedActive && this.mobileEmbedController) {
      this.mobileEmbedActive = false;
      try {
        this.mobileEmbedController.pause?.();
      } catch (e) {}
    }

    // 1. If Web Playback SDK is initialized, immediately halt local audio in < 5ms
    if (this.player) {
      try {
        await this.player.pause();
      } catch (e) {}
    }

    if (!this.accessToken) return false;

    let effectiveDeviceId = targetDeviceId;
    if (this.isMobileEnvironment() && !this.userSelectedDeviceId) {
      const phoneDev = this.cachedDevices.find((d) => this.isPhoneDevice(d));
      if (phoneDev) effectiveDeviceId = phoneDev.id;
    }

    // 2. If effectiveDeviceId provided, try pausing that specific device
    if (effectiveDeviceId) {
      try {
        const url = `https://api.spotify.com/v1/me/player/pause?device_id=${effectiveDeviceId}`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        if (res.status === 204 || res.status === 200) {
          return true;
        }
        if (res.status === 401) {
          const refreshed = await this.checkServerSession();
          if (refreshed && this.accessToken) {
            return this.pause(targetDeviceId);
          }
        }
      } catch (e) {}
    }

    // 3. Fallback: Pause whichever device is currently active on the user's Spotify account
    try {
      const fallbackUrl = 'https://api.spotify.com/v1/me/player/pause';
      const fallbackRes = await fetch(fallbackUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (fallbackRes.status === 401) {
        const refreshed = await this.checkServerSession();
        if (refreshed && this.accessToken) {
          return this.pause(targetDeviceId);
        }
      }
      return fallbackRes.status === 204 || fallbackRes.status === 200;
    } catch (e) {
      return false;
    }
  }

  // Resume playback
  public async resume(targetDeviceId?: string | null): Promise<boolean> {
    this.activateMobileAudio();
    if (this.mobileEmbedActive && this.mobileEmbedController) {
      try {
        this.mobileEmbedController.play?.();
        return true;
      } catch (e) {}
    }
    if (this.player && (!targetDeviceId || targetDeviceId === this.webPlaybackDeviceId)) {
      try {
        await this.player.resume();
      } catch (e) {}
    }
    if (!this.accessToken) return false;
    try {
      let effectiveDeviceId = targetDeviceId;
      if (this.isMobileEnvironment() && !this.userSelectedDeviceId) {
        const phoneDev = this.cachedDevices.find((d) => this.isPhoneDevice(d));
        if (phoneDev) effectiveDeviceId = phoneDev.id;
      }
      const url = `https://api.spotify.com/v1/me/player/play${effectiveDeviceId ? `?device_id=${effectiveDeviceId}` : ''}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return res.status === 204 || res.status === 200;
    } catch (e) {
      return false;
    }
  }

  // Set device volume (0 to 100)
  public async setVolume(volumePercent: number, targetDeviceId?: string | null): Promise<boolean> {
    if (!this.accessToken) return false;
    try {
      const vol = Math.max(0, Math.min(100, Math.round(volumePercent)));
      const url = `https://api.spotify.com/v1/me/player/volume?volume_percent=${vol}${
        targetDeviceId ? `&device_id=${targetDeviceId}` : ''
      }`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return res.status === 204 || res.status === 200;
    } catch (e) {
      return false;
    }
  }

  // Search Spotify Catalog
  public async searchTracks(query: string, limit: number = 10): Promise<SpotifyTrackResult[]> {
    if (!this.accessToken || !query.trim()) return [];
    try {
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.tracks?.items || [];
      }
    } catch (e) {
      console.warn('Spotify search failed:', e);
    }
    return [];
  }

  // Parse track ID and info from Spotify link or URI
  public parseSpotifyInput(input: string): { trackId: string | null; uri: string | null } {
    const trimmed = input.trim();
    // Case 1: spotify:track:4u7EnebtmKWzUH433cf5Qv
    const uriMatch = trimmed.match(/spotify:track:([a-zA-Z0-9]+)/);
    if (uriMatch) {
      return { trackId: uriMatch[1], uri: `spotify:track:${uriMatch[1]}` };
    }

    // Case 2: https://open.spotify.com/track/4u7EnebtmKWzUH433cf5Qv?si=...
    const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return { trackId: urlMatch[1], uri: `spotify:track:${urlMatch[1]}` };
    }

    // Case 3: Raw 22-char base62 ID
    if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) {
      return { trackId: trimmed, uri: `spotify:track:${trimmed}` };
    }

    return { trackId: null, uri: null };
  }

  // Fetch track metadata by ID (using Spotify API or oEmbed proxy)
  public async getTrackDetails(trackId: string): Promise<Partial<SpotifyTrackResult> | null> {
    // If authenticated, get full track metadata
    if (this.accessToken) {
      try {
        const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Failed to fetch track from Spotify API:', e);
      }
    }

    // Fallback: use oEmbed endpoint via server proxy (no auth needed!)
    try {
      const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
      const oembedRes = await fetch(`/api/spotify/oembed?url=${encodeURIComponent(spotifyUrl)}`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        return {
          id: trackId,
          name: data.title,
          artists: [{ name: data.author_name || 'Spotify Artist', id: '' }],
          album: {
            name: data.title,
            images: [{ url: data.thumbnail_url, height: 300, width: 300 }],
          },
          duration_ms: 210000, // default estimation until full load
          uri: `spotify:track:${trackId}`,
          external_urls: { spotify: spotifyUrl },
        };
      }
    } catch (e) {
      console.warn('Failed to fetch oembed:', e);
    }

    return null;
  }
}

export const spotify = new SpotifyService();
