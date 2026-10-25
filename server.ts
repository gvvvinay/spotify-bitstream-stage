import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import http from 'http';
import https from 'https';
import net from 'net';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data persistence file (stored on local disk)
const DATA_FILE = path.join(__dirname, 'snippets-data.json');

function readStoredData(): any {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('Failed reading data file:', e);
  }
  return null;
}

function writeStoredData(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed writing data file:', e);
  }
}

// Local Database for Project Release Notes, Bugs & Enhancements Tracker
const RELEASES_FILE = path.join(__dirname, 'releases-data.json');

function readReleasesData(): any {
  try {
    if (fs.existsSync(RELEASES_FILE)) {
      const content = fs.readFileSync(RELEASES_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn('Failed reading releases data file:', e);
  }
  return { versions: [], items: [] };
}

function writeReleasesData(data: any) {
  try {
    fs.writeFileSync(RELEASES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed writing releases data file:', e);
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 4100;

app.use(express.json());
app.use(cookieParser());

// App URL determination
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

// BitStream App Access Credentials
let APP_LOGIN_USER = process.env.APP_LOGIN_USER || 'admin';
let APP_LOGIN_PASS = process.env.APP_LOGIN_PASS || 'bitstream4100';

// Spotify OAuth configuration (mutable so UI setup can update them on the fly)
let SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
let SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'user-library-read',
].join(' ');

// In-memory / session token storage
interface SessionData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  authMode?: 'user_oauth' | 'client_credentials';
  user?: {
    id: string;
    display_name: string;
    images?: Array<{ url: string }>;
    product?: string;
  };
}

const sessions = new Map<string, SessionData>();
let globalSpotifySession: SessionData | null = null;

let appCredentialsSession: SessionData | null = null;

function saveGlobalSpotifySession(session: SessionData | null) {
  if (session?.authMode === 'client_credentials') {
    appCredentialsSession = session;
    // Never overwrite persistent user OAuth session on disk with search credentials
    const existing = readStoredData() || {};
    if (existing.spotifySession?.authMode === 'user_oauth' || existing.spotifySession?.refreshToken) {
      return;
    }
  }

  globalSpotifySession = session;
  try {
    const existing = readStoredData() || {};
    existing.spotifySession = session;
    writeStoredData(existing);
  } catch (e) {
    console.warn('Failed saving global session:', e);
  }
}

function loadGlobalSpotifySession(): SessionData | null {
  try {
    const data = readStoredData();
    if (data && data.spotifySession) {
      globalSpotifySession = data.spotifySession;
      return globalSpotifySession;
    }
  } catch (e) {}
  return globalSpotifySession || appCredentialsSession;
}

async function getOrFetchAppCredentialsToken(): Promise<SessionData | null> {
  const current = loadGlobalSpotifySession();
  
  // 1. If active user session exists, return it
  if (
    current &&
    current.accessToken &&
    current.expiresAt > Date.now() &&
    (current.authMode === 'user_oauth' || current.user?.product === 'premium')
  ) {
    return current;
  }

  // 2. If user session is expired but has refreshToken, auto-refresh it!
  if (current && current.refreshToken && SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
    try {
      const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const refRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken,
        }),
      });
      if (refRes.ok) {
        const refData = await refRes.json();
        current.accessToken = refData.access_token;
        current.expiresAt = Date.now() + (refData.expires_in || 3600) * 1000;
        if (refData.refresh_token) current.refreshToken = refData.refresh_token;
        current.authMode = 'user_oauth';
        saveGlobalSpotifySession(current);
        console.log('✅ Auto-refreshed user OAuth session for Spotify playback on all devices');
        return current;
      }
    } catch (e) {
      console.warn('Could not auto-refresh user token on startup:', e);
    }
  }

  // 3. If in-memory appCredentialsSession is still valid, return it without modifying disk
  if (appCredentialsSession && appCredentialsSession.expiresAt > Date.now()) {
    return appCredentialsSession;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;
  try {
    const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenRes.ok) {
      console.warn('Failed auto-fetching client credentials token:', tokenRes.status);
      return null;
    }

    const data = await tokenRes.json();
    const appSession: SessionData = {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      authMode: 'client_credentials',
      user: {
        id: 'app_credentials',
        display_name: 'Spotify App Credentials (Connected)',
        product: 'client_credentials',
      },
    };
    appCredentialsSession = appSession;
    saveGlobalSpotifySession(appSession);
    return appSession;
  } catch (e) {
    console.error('Error fetching app credentials token:', e);
    return null;
  }
}

// Helper to detect LAN IPv4 address (e.g. 192.168.1.71)
function getLocalIpAddress(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to detect network interfaces:', e);
  }
  return '192.168.1.71';
}

// In-memory mapping of OAuth state -> redirectUri to guarantee character-for-character
// redirect URI parity between Spotify /authorize and /api/token token exchanges.
interface OAuthStateRecord {
  redirectUri: string;
  createdAt: number;
}
const oauthStates = new Map<string, OAuthStateRecord>();

// Clean up states older than 15 minutes periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, record] of oauthStates.entries()) {
    if (now - record.createdAt > 15 * 60 * 1000) {
      oauthStates.delete(state);
    }
  }
}, 5 * 60 * 1000);

// Helper to determine redirect URI
// NOTE: Spotify strictly blocks 'http://localhost' with "This redirect URI is not secure"
// and strictly enforces HTTPS on private IPs (e.g. 192.168.x.x) with "redirect uri insecure".
// Only loopback literal http://127.0.0.1 is permitted over HTTP.
function getRedirectUri(req: Request): string {
  // 1. Explicit query or body override from client
  const custom = (req.query?.redirect_uri as string) || (req.body?.redirectUri as string);
  if (custom && typeof custom === 'string' && custom.includes('/auth/callback')) {
    return custom;
  }

  // 2. Derive dynamically from Host header if present (e.g. 192.168.1.71:3100 or 127.0.0.1:3100)
  const rawHost = (req.headers['x-forwarded-host'] || req.headers.host) as string;
  if (rawHost) {
    const normalizedHost = rawHost.replace('localhost', '127.0.0.1');
    const isLoopback = normalizedHost.includes('127.0.0.1') || normalizedHost.includes('localhost');
    // Spotify strictly requires HTTPS for non-loopback addresses to avoid "redirect uri insecure"
    const protocol = isLoopback ? 'http' : 'https';
    return `${protocol}://${normalizedHost}/auth/callback`;
  }

  // 3. Fallback to APP_URL if host header is absent
  if (process.env.APP_URL) {
    const baseUrl = process.env.APP_URL.replace(/\/+$/, '');
    const normalized = baseUrl.replace('://localhost', '://127.0.0.1');
    return `${normalized}/auth/callback`;
  }

  return `http://127.0.0.1:${PORT}/auth/callback`;
}

// 0. App Access Authentication (Gate access to BitStream)
app.get('/api/app-auth/config', (req: Request, res: Response) => {
  const host = (req.headers.host || '').toLowerCase();
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  res.json({
    isLocalhost,
  });
});

app.post('/api/app-auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ success: false, error: 'Username and password are required' });
    return;
  }

  const expectedUser = (process.env.APP_LOGIN_USER || APP_LOGIN_USER || 'admin').trim();
  const expectedPass = (process.env.APP_LOGIN_PASS || APP_LOGIN_PASS || 'bitstream4100').trim();

  if (username.trim().toLowerCase() === expectedUser.toLowerCase() && password.trim() === expectedPass) {
    const sessionToken = 'bs_' + Buffer.from(`${expectedUser}:${Date.now()}:${Math.random().toString(36).slice(2)}`).toString('base64');
    res.json({
      success: true,
      token: sessionToken,
      user: {
        username: expectedUser,
        role: 'admin',
        loggedInAt: Date.now(),
      },
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid username or password. Please use the set credentials.',
    });
  }
});

// 1. Auth Config Info
app.get('/api/auth/config', (req: Request, res: Response) => {
  const localIp = getLocalIpAddress();
  const redirectUri = getRedirectUri(req);
  res.json({
    configured: Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET),
    clientId: SPOTIFY_CLIENT_ID ? `${SPOTIFY_CLIENT_ID.slice(0, 6)}...` : '',
    localIp,
    port: PORT,
    // Note: HTTPS is strictly required by Spotify Developer Policy for 192.168.x.x
    lanRedirectUri: `https://${localIp}:${PORT}/auth/callback`,
    lanHttpRedirectUri: `http://${localIp}:${PORT}/auth/callback`,
    loopbackRedirectUri: `http://127.0.0.1:${PORT}/auth/callback`,
    redirectUri,
    appUrl: APP_URL,
    scopes: SPOTIFY_SCOPES,
  });
});

// 1c. Remote Auto-Link Trigger (Allows mobile device to trigger 1-tap loopback authorization on host PC)
app.post('/api/auth/pc-trigger', (req: Request, res: Response) => {
  const pcUrl = `http://127.0.0.1:${PORT}/api/auth/pc-launch`;
  try {
    import('child_process').then(({ exec }) => {
      exec(`start "" "${pcUrl}"`);
    });
    res.json({ success: true, message: 'OAuth launched on host PC browser' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/pc-launch', (req: Request, res: Response) => {
  const redirectUri = `http://127.0.0.1:${PORT}/auth/callback`;
  const state = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  oauthStates.set(state, { redirectUri, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: 'false',
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

// 1b. Save Spotify Credentials from UI
app.post('/api/auth/credentials', (req: Request, res: Response) => {
  const { clientId, clientSecret } = req.body;
  if (!clientId || typeof clientId !== 'string') {
    res.status(400).json({ error: 'Client ID is required' });
    return;
  }

  SPOTIFY_CLIENT_ID = clientId.trim();
  if (clientSecret && typeof clientSecret === 'string') {
    SPOTIFY_CLIENT_SECRET = clientSecret.trim();
  }
  process.env.SPOTIFY_CLIENT_ID = SPOTIFY_CLIENT_ID;
  process.env.SPOTIFY_CLIENT_SECRET = SPOTIFY_CLIENT_SECRET;

  try {
    const envPath = path.join(__dirname, '.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (content.includes('SPOTIFY_CLIENT_ID=')) {
      content = content.replace(/SPOTIFY_CLIENT_ID=.*/g, `SPOTIFY_CLIENT_ID="${SPOTIFY_CLIENT_ID}"`);
    } else {
      content += `\nSPOTIFY_CLIENT_ID="${SPOTIFY_CLIENT_ID}"`;
    }
    if (clientSecret) {
      if (content.includes('SPOTIFY_CLIENT_SECRET=')) {
        content = content.replace(/SPOTIFY_CLIENT_SECRET=.*/g, `SPOTIFY_CLIENT_SECRET="${SPOTIFY_CLIENT_SECRET}"`);
      } else {
        content += `\nSPOTIFY_CLIENT_SECRET="${SPOTIFY_CLIENT_SECRET}"`;
      }
    }
    fs.writeFileSync(envPath, content, 'utf8');
  } catch (e) {
    console.warn('Failed to update .env:', e);
  }

  res.json({
    success: true,
    configured: Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET),
    clientId: `${SPOTIFY_CLIENT_ID.slice(0, 6)}...`,
  });
});

// 2. Auth URL Endpoint (Desktop popup or mobile navigation opens this URL directly)
app.get('/api/auth/url', (req: Request, res: Response) => {
  const redirectUri = getRedirectUri(req);
  const clientId = (req.query.client_id as string) || SPOTIFY_CLIENT_ID;

  if (!clientId) {
    res.status(400).json({
      error: 'Spotify Client ID is required. Please set SPOTIFY_CLIENT_ID in .env or provide it in the setup dialog.',
    });
    return;
  }

  // Generate unique state and record exact redirectUri to ensure identical match during token exchange
  const state = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  oauthStates.set(state, { redirectUri, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: 'true',
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  res.json({ url: authUrl, redirectUri, state });
});

// 3. OAuth Callback Handler
app.get(['/auth/callback', '/auth/callback/'], async (req: Request, res: Response) => {
  const { code, error, state } = req.query;

  // Retrieve matching redirectUri from stored state
  const stateStr = typeof state === 'string' ? state : '';
  const stateRecord = stateStr ? oauthStates.get(stateStr) : undefined;
  const redirectUri = stateRecord?.redirectUri || getRedirectUri(req);
  if (stateStr) {
    oauthStates.delete(stateStr);
  }

  if (error || !code) {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Spotify Auth Failed</title>
        </head>
        <body style="background:#090d16;color:#f87171;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:32px;text-align:center;">
          <div style="max-width:440px;margin:40px auto;background:#131c2e;padding:32px;border-radius:20px;border:1px solid rgba(239,68,68,0.3);box-shadow:0 20px 40px rgba(0,0,0,0.6);">
            <div style="font-size:42px;margin-bottom:12px;">⚠️</div>
            <h2 style="margin:0 0 10px 0;font-size:20px;color:#f87171;">Authorization Failed</h2>
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin-bottom:24px;">${error || 'No authorization code received'}</p>
            <a href="/?spotify_auth=error" style="display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;font-weight:bold;font-size:13px;border-radius:12px;">Return to BitStream</a>
          </div>
          <script>
            try {
              const bc = new BroadcastChannel('spotify_oauth_channel');
              bc.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error || 'Failed'}' });
              bc.close();
            } catch(e) {}
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error || 'Failed'}' }, '*');
                setTimeout(() => window.close(), 1500);
              } catch(e) {}
            }
          </script>
        </body>
      </html>
    `);
    return;
  }

  const clientId = SPOTIFY_CLIENT_ID;
  const clientSecret = SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // If server credentials aren't set in env, pass code to opener or client
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Spotify Code Received</title>
        </head>
        <body style="background:#090d16;color:#38bdf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:30px;text-align:center;">
          <div style="max-width:440px;margin:40px auto;background:#131c2e;padding:32px;border-radius:20px;border:1px solid rgba(56,189,248,0.3);">
            <h2 style="color:#38bdf8;margin-top:0;">Authorization Code Received</h2>
            <p style="color:#94a3b8;">Connecting back to Spotify BitStream...</p>
            <a href="/?spotify_code=${code}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#0284c7;color:#fff;text-decoration:none;font-weight:bold;border-radius:10px;">Return to BitStream</a>
          </div>
          <script>
            try {
              const bc = new BroadcastChannel('spotify_oauth_channel');
              bc.postMessage({ type: 'OAUTH_AUTH_CODE', code: '${code}' });
              bc.close();
            } catch(e) {}
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({ type: 'OAUTH_AUTH_CODE', code: '${code}' }, '*');
                setTimeout(() => window.close(), 500);
              } catch(e) {}
            } else {
              setTimeout(() => {
                window.location.href = '/?spotify_code=${code}';
              }, 800);
            }
          </script>
        </body>
      </html>
    `);
    return;
  }

  try {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Token exchange error:', errBody);
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Fetch user profile
    let userData = null;
    try {
      const userRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        userData = await userRes.json();
      }
    } catch (e) {
      console.warn('Could not fetch user profile:', e);
    }

    const sessionData: SessionData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      user: userData,
    };
    sessions.set(sessionId, sessionData);
    saveGlobalSpotifySession(sessionData);

    // Set cookie (support both local HTTP and remote HTTPS)
    const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
    res.cookie('spotify_session', sessionId, {
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const userDisplayName = userData?.display_name ? String(userData.display_name) : 'Spotify User';
    const userJson = JSON.stringify(userData || null);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Spotify Connected | BitStream</title>
        </head>
        <body style="background:#090d16;color:#10b981;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;text-align:center;">
          <div style="max-width:440px;margin:30px auto;background:#131c2e;padding:32px;border-radius:24px;border:1px solid rgba(16,185,129,0.3);box-shadow:0 20px 50px rgba(0,0,0,0.8);">
            <div style="width:60px;height:60px;margin:0 auto 16px auto;background:rgba(16,185,129,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;">
              ⚡
            </div>
            <h2 style="color:#22c55e;margin:0 0 8px 0;font-size:22px;font-weight:800;">Spotify Connected!</h2>
            <p style="color:#cbd5e1;font-size:14px;margin:0 0 6px 0;font-weight:600;">
              Welcome, ${userDisplayName}!
            </p>
            <p style="color:#64748b;font-size:12px;margin:0 0 24px 0;">
              Device authorized for full Spotify remote playback and cross-device sync.
            </p>
            <a id="btn-return" href="/?spotify_auth=success" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#10b981,#059669);color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:14px;box-shadow:0 10px 25px rgba(16,185,129,0.4);transition:all 0.2s;">
              Return to BitStream
            </a>
          </div>
          <script>
            // 1. Immediately write tokens into client localStorage
            try {
              localStorage.setItem('spotify_access_token', ${JSON.stringify(tokenData.access_token)});
              localStorage.setItem('spotify_token_expiry', String(Date.now() + ${tokenData.expires_in} * 1000));
              localStorage.setItem('spotify_auth_mode', 'user_oauth');
              if (${JSON.stringify(tokenData.refresh_token || '')}) {
                localStorage.setItem('spotify_refresh_token', ${JSON.stringify(tokenData.refresh_token || '')});
              }
              if (${userJson}) {
                localStorage.setItem('spotify_user', JSON.stringify(${userJson}));
              }
            } catch (e) {
              console.warn('Could not write localStorage in callback:', e);
            }

            // 2. Broadcast via BroadcastChannel to any listening tabs
            try {
              const bc = new BroadcastChannel('spotify_oauth_channel');
              bc.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                accessToken: ${JSON.stringify(tokenData.access_token)},
                refreshToken: ${JSON.stringify(tokenData.refresh_token || '')},
                expiresIn: ${tokenData.expires_in},
                user: ${userJson}
              });
              bc.close();
            } catch(e) {}

            // 3. Post to popup opener if open
            let closedPopup = false;
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({
                  type: 'OAUTH_AUTH_SUCCESS',
                  accessToken: ${JSON.stringify(tokenData.access_token)},
                  refreshToken: ${JSON.stringify(tokenData.refresh_token || '')},
                  expiresIn: ${tokenData.expires_in},
                  user: ${userJson}
                }, '*');
                closedPopup = true;
                setTimeout(() => window.close(), 600);
              } catch(e) {}
            }

            // 4. Smooth fallback redirect if running directly in mobile tab
            if (!closedPopup) {
              setTimeout(() => {
                window.location.href = '/?spotify_auth=success';
              }, 1200);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Authentication Error</title>
        </head>
        <body style="background:#090d16;color:#f87171;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:30px;text-align:center;">
          <div style="max-width:440px;margin:40px auto;background:#131c2e;padding:32px;border-radius:20px;border:1px solid rgba(239,68,68,0.3);">
            <h2 style="color:#f87171;margin-top:0;">Authentication Error</h2>
            <p style="color:#94a3b8;font-size:13px;line-height:1.5;">${err.message || 'Unknown error'}</p>
            <a href="/?spotify_auth=error" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;font-weight:bold;font-size:13px;border-radius:12px;">Return to BitStream</a>
          </div>
          <script>
            try {
              const bc = new BroadcastChannel('spotify_oauth_channel');
              bc.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${err.message || 'Error'}' });
              bc.close();
            } catch(e) {}
            if (window.opener && !window.opener.closed) {
              try {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${err.message}' }, '*');
                setTimeout(() => window.close(), 3000);
              } catch(e) {}
            }
          </script>
        </body>
      </html>
    `);
  }
});

// 4. Client-side exchange if user provides Client ID & Secret directly in UI
app.post('/api/auth/exchange-code', async (req: Request, res: Response) => {
  const { code, clientId, clientSecret, redirectUri } = req.body;
  const effectiveClientId = clientId || SPOTIFY_CLIENT_ID;
  const effectiveClientSecret = clientSecret || SPOTIFY_CLIENT_SECRET;
  const effectiveRedirectUri = redirectUri || getRedirectUri(req);

  if (!code || !effectiveClientId || !effectiveClientSecret) {
    res.status(400).json({ error: 'Missing code, clientId, or clientSecret' });
    return;
  }

  try {
    const basicAuth = Buffer.from(`${effectiveClientId}:${effectiveClientSecret}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: effectiveRedirectUri,
      }),
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      res.status(tokenRes.status).json(data);
      return;
    }

    // Fetch user profile to verify Spotify Premium status
    let userData = null;
    try {
      const userRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        userData = await userRes.json();
      }
    } catch (e) {
      console.warn('Could not fetch user profile on code exchange:', e);
    }

    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const sessionData: SessionData = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      user: userData,
    };
    sessions.set(sessionId, sessionData);
    saveGlobalSpotifySession(sessionData);

    const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
    res.cookie('spotify_session', sessionId, {
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      ...data,
      user: userData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4b. Auto-connect with Client Credentials (Stored in Firestore or provided)
app.post('/api/auth/client-credentials', async (req: Request, res: Response) => {
  const { clientId, clientSecret } = req.body;
  const effectiveClientId = clientId || SPOTIFY_CLIENT_ID;
  const effectiveClientSecret = clientSecret || SPOTIFY_CLIENT_SECRET;

  if (!effectiveClientId || !effectiveClientSecret) {
    res.status(400).json({ error: 'Missing Spotify Client ID or Client Secret' });
    return;
  }

  try {
    const basicAuth = Buffer.from(`${effectiveClientId}:${effectiveClientSecret}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });

    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      res.status(tokenRes.status).json(data);
      return;
    }

    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const userData = {
      id: 'app_credentials',
      display_name: 'Spotify API (Connected)',
      product: 'client_credentials',
    };

    const appSession: SessionData = {
      accessToken: data.access_token,
      refreshToken: undefined,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      authMode: 'client_credentials',
      user: userData,
    };
    sessions.set(sessionId, appSession);
    saveGlobalSpotifySession(appSession);

    const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
    res.cookie('spotify_session', sessionId, {
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      isClientCredentials: true,
      user: userData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4c. Auto-refresh User OAuth Token with stored refreshToken, clientId & secret
app.post('/api/auth/refresh-token', async (req: Request, res: Response) => {
  const { refreshToken, clientId, clientSecret } = req.body;
  const effectiveClientId = clientId || SPOTIFY_CLIENT_ID;
  const effectiveClientSecret = clientSecret || SPOTIFY_CLIENT_SECRET;

  if (!refreshToken || !effectiveClientId || !effectiveClientSecret) {
    res.status(400).json({ error: 'Missing refreshToken, clientId, or clientSecret' });
    return;
  }

  try {
    const basicAuth = Buffer.from(`${effectiveClientId}:${effectiveClientSecret}`).toString('base64');
    const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await refreshRes.json();
    if (!refreshRes.ok) {
      res.status(refreshRes.status).json(data);
      return;
    }

    // Try fetching user profile with refreshed access token
    let userData = null;
    try {
      const userRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) {
        userData = await userRes.json();
      }
    } catch (e) {
      console.warn('Could not fetch user profile on refresh:', e);
    }

    const effectiveRefreshToken = data.refresh_token || refreshToken;
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const sessionData: SessionData = {
      accessToken: data.access_token,
      refreshToken: effectiveRefreshToken,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      authMode: 'user_oauth',
      user: userData,
    };
    sessions.set(sessionId, sessionData);
    saveGlobalSpotifySession(sessionData);

    const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
    res.cookie('spotify_session', sessionId, {
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.json({
      access_token: data.access_token,
      refresh_token: effectiveRefreshToken,
      expires_in: data.expires_in,
      user: userData,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Auth Status & User Profile (Inherited automatically by phones/devices on LAN)
app.get('/api/auth/status', async (req: Request, res: Response) => {
  const sessionId = req.cookies.spotify_session;
  let session = (sessionId && sessions.has(sessionId)) ? sessions.get(sessionId)! : loadGlobalSpotifySession();

  if (session && Date.now() > session.expiresAt && session.refreshToken && SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
    // Refresh token
    try {
      const basicAuth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
      const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: session.refreshToken,
        }),
      });
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json();
        session.accessToken = refreshed.access_token;
        session.expiresAt = Date.now() + (refreshed.expires_in || 3600) * 1000;
        if (refreshed.refresh_token) {
          session.refreshToken = refreshed.refresh_token;
        }
        saveGlobalSpotifySession(session);
      }
    } catch (e) {
      console.error('Failed to refresh token:', e);
    }
  }

  // If no active session or expired client credentials, auto-connect using configured server credentials
  if (!session || (Date.now() > session.expiresAt && !session.refreshToken)) {
    session = await getOrFetchAppCredentialsToken();
  }

  if (!session) {
    res.json({ authenticated: false });
    return;
  }

  const isUserOAuth =
    session.authMode === 'user_oauth' ||
    Boolean(session.user?.product === 'premium') ||
    Boolean(session.user?.id && session.user.id !== 'app_credentials');
  const effectiveAuthMode = isUserOAuth ? 'user_oauth' : 'client_credentials';

  res.json({
    authenticated: true,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    authMode: effectiveAuthMode,
    user: session.user || null,
  });
});

// 5b. Broadcast session from client to server (e.g. PC auth syncs to Phone)
app.post('/api/auth/session', (req: Request, res: Response) => {
  const { accessToken, refreshToken, expiresIn, user, authMode } = req.body;
  if (!accessToken) {
    res.status(400).json({ error: 'accessToken is required' });
    return;
  }
  const isUser = Boolean(user?.product === 'premium' || (user?.id && user.id !== 'app_credentials') || refreshToken);
  const session: SessionData = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + (expiresIn || 3600) * 1000,
    authMode: authMode || (isUser ? 'user_oauth' : 'client_credentials'),
    user,
  };
  saveGlobalSpotifySession(session);
  res.json({ success: true, user, authMode: session.authMode });
});

// 6. Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const sessionId = req.cookies.spotify_session;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  saveGlobalSpotifySession(null);
  const isHttps = Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
  res.clearCookie('spotify_session', {
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
  });
  res.json({ success: true });
});

// 7. Spotify Public oEmbed proxy (No auth needed! Great for instant preview and URL parsing)
app.get('/api/spotify/oembed', async (req: Request, res: Response) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      res.status(response.status).json({ error: 'Could not fetch Spotify oEmbed' });
      return;
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Local Database Endpoints (Persistent cross-device sync between Laptop & Phone)
// 8a. Snippets CRUD
app.get('/api/db/snippets', (_req: Request, res: Response) => {
  const data = readStoredData() || {};
  res.json({ success: true, snippets: data.snippets || [], updatedAt: data.updatedAt || 0 });
});

app.post('/api/db/snippets', (req: Request, res: Response) => {
  const snippet = req.body;
  if (!snippet || !snippet.id) {
    res.status(400).json({ error: 'Valid snippet object with an ID is required' });
    return;
  }
  const data = readStoredData() || {};
  const snippets: any[] = Array.isArray(data.snippets) ? data.snippets : [];
  const idx = snippets.findIndex((s: any) => s.id === snippet.id);
  if (idx >= 0) {
    snippets[idx] = snippet;
  } else {
    snippets.unshift(snippet);
  }
  data.snippets = snippets;
  data.updatedAt = Date.now();
  writeStoredData(data);
  console.log(`💾 [Local DB] Snippet saved: "${snippet.title}" (${snippet.snippetName}). Total: ${snippets.length}`);
  res.json({ success: true, snippet, updatedAt: data.updatedAt, count: snippets.length });
});

app.delete('/api/db/snippets/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const data = readStoredData() || {};
  const snippets: any[] = Array.isArray(data.snippets) ? data.snippets : [];
  data.snippets = snippets.filter((s: any) => s.id !== id);

  // Clean up snippet reference in any playlists
  if (Array.isArray(data.playlists)) {
    data.playlists = data.playlists.map((pl: any) => ({
      ...pl,
      snippetIds: Array.isArray(pl.snippetIds) ? pl.snippetIds.filter((sid: string) => sid !== id) : [],
    }));
  }

  data.updatedAt = Date.now();
  writeStoredData(data);
  console.log(`🗑️ [Local DB] Snippet deleted: ${id}. Remaining: ${data.snippets.length}`);
  res.json({ success: true, deletedId: id, updatedAt: data.updatedAt });
});

// 8b. Playlists CRUD
app.get('/api/db/playlists', (_req: Request, res: Response) => {
  const data = readStoredData() || {};
  res.json({ success: true, playlists: data.playlists || [], updatedAt: data.updatedAt || 0 });
});

app.post('/api/db/playlists', (req: Request, res: Response) => {
  const playlist = req.body;
  if (!playlist || !playlist.id) {
    res.status(400).json({ error: 'Valid playlist object with an ID is required' });
    return;
  }
  const data = readStoredData() || {};
  const playlists: any[] = Array.isArray(data.playlists) ? data.playlists : [];
  const idx = playlists.findIndex((p: any) => p.id === playlist.id);
  if (idx >= 0) {
    playlists[idx] = playlist;
  } else {
    playlists.push(playlist);
  }
  data.playlists = playlists;
  data.updatedAt = Date.now();
  writeStoredData(data);
  res.json({ success: true, playlist, updatedAt: data.updatedAt, count: playlists.length });
});

app.delete('/api/db/playlists/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const data = readStoredData() || {};
  const playlists: any[] = Array.isArray(data.playlists) ? data.playlists : [];
  data.playlists = playlists.filter((p: any) => p.id !== id);
  data.updatedAt = Date.now();
  writeStoredData(data);
  res.json({ success: true, deletedId: id, updatedAt: data.updatedAt });
});

// 8c. Live Multi-Device Sync Endpoint (Used by phone to pull updates made on laptop)
app.get('/api/db/sync', (req: Request, res: Response) => {
  const data = readStoredData() || {};
  const since = Number(req.query.since) || 0;
  const updatedAt = data.updatedAt || 0;
  const hasChanges = since === 0 || updatedAt > since;

  res.json({
    hasChanges,
    updatedAt,
    snippets: data.snippets || [],
    playlists: data.playlists || [],
    isSpotifyLinked: Boolean(data.spotifySession?.accessToken),
    spotifySession: data.spotifySession || null,
  });
});

// Cache for resolved track audio preview URLs
const trackAudioPreviewCache = new Map<string, string>();

// 8c-2. Audio Preview Resolver & Stream Proxy for Real Dual-Deck Audio Mixing
app.get('/api/audio/preview', async (req: Request, res: Response) => {
  const title = String(req.query.title || '').trim();
  const artist = String(req.query.artist || '').trim();
  const cacheKey = `${title.toLowerCase()}___${artist.toLowerCase()}`;

  if (trackAudioPreviewCache.has(cacheKey)) {
    res.json({ success: true, previewUrl: trackAudioPreviewCache.get(cacheKey) });
    return;
  }

  try {
    // Search Deezer public catalog for 30s high-quality MP3 audio preview
    const cleanTitle = title.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();
    const cleanArtist = artist.split(',')[0].trim();
    const query = encodeURIComponent(`${cleanTitle} ${cleanArtist}`);
    const searchRes = await fetch(`https://api.deezer.com/search?q=${query}`, {
      headers: { 'User-Agent': 'BitStream/2.0' },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (Array.isArray(data.data) && data.data.length > 0) {
        const topHit = data.data[0];
        if (topHit.preview) {
          trackAudioPreviewCache.set(cacheKey, topHit.preview);
          res.json({ success: true, previewUrl: topHit.preview });
          return;
        }
      }
    }
  } catch (e: any) {
    console.warn('Audio preview resolver notice:', e.message);
  }

  res.json({ success: false, previewUrl: null });
});

app.get('/api/db/status', (_req: Request, res: Response) => {
  const data = readStoredData() || {};
  res.json({
    status: 'online',
    dbFile: DATA_FILE,
    snippetCount: (data.snippets || []).length,
    playlistCount: (data.playlists || []).length,
    updatedAt: data.updatedAt || 0,
    spotifySessionActive: Boolean(data.spotifySession?.accessToken),
    spotifyUser: data.spotifySession?.user?.display_name || null,
  });
});

// 8d. Legacy storage endpoint fallback (preserves spotifySession)
app.get('/api/storage', (_req: Request, res: Response) => {
  const data = readStoredData();
  res.json(data || {});
});

app.post('/api/storage', (req: Request, res: Response) => {
  const existing = readStoredData() || {};
  const toWrite = {
    ...existing,
    ...req.body,
    spotifySession: existing.spotifySession || req.body.spotifySession,
    updatedAt: Date.now(),
  };
  writeStoredData(toWrite);
  res.json({ success: true, updatedAt: toWrite.updatedAt });
});

// 9. Release Notes, Local Database & Version Tracker Endpoints
app.get('/api/releases', (_req: Request, res: Response) => {
  const data = readReleasesData();
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  const bugCount = items.filter((i: any) => i.type === 'bug').length;
  const enhancementCount = items.filter((i: any) => i.type === 'enhancement').length;
  const resolvedBugs = items.filter((i: any) => i.type === 'bug' && (i.status === 'resolved' || i.status === 'implemented')).length;
  const openBugs = items.filter((i: any) => i.type === 'bug' && i.status === 'open').length;
  const openEnhancements = items.filter((i: any) => i.type === 'enhancement' && i.status === 'open').length;
  const totalOpen = openBugs + openEnhancements;
  const resolvedTotal = items.filter((i: any) => i.status === 'resolved' || i.status === 'implemented').length;

  res.json({
    success: true,
    environment: PORT === 3100 ? 'stage' : 'production',
    currentPort: PORT,
    activeVersion: PORT === 3100 ? 'v2.0.0-neon-preview' : 'v1.0.0-stable',
    stats: {
      total: items.length,
      bugs: bugCount,
      enhancements: enhancementCount,
      resolvedBugs,
      openBugs,
      openEnhancements,
      totalOpen,
      resolvedTotal,
      resolutionRate: items.length > 0 ? `${Math.round((resolvedTotal / items.length) * 100)}%` : '100%',
    },
    versions: data.versions || [],
    items,
  });
});

app.post('/api/releases/items', (req: Request, res: Response) => {
  const newItem = req.body;
  if (!newItem || !newItem.title) {
    res.status(400).json({ error: 'Valid item with title is required' });
    return;
  }
  const data = readReleasesData();
  const items: any[] = Array.isArray(data.items) ? data.items : [];

  const existingIdx = newItem.id ? items.findIndex((i: any) => i.id === newItem.id) : -1;
  const isNew = existingIdx === -1;
  const id = !isNew ? items[existingIdx].id : (newItem.id || `${newItem.type === 'bug' ? 'BUG' : 'ENH'}-${String(items.length + 1).padStart(3, '0')}`);

  // When a new entry is created, always make the status of the bug / enhancement 'open' so those can be looked at and fixed!
  const status = isNew ? 'open' : (newItem.status || items[existingIdx].status || 'open');

  const itemToSave = {
    ...newItem,
    id,
    createdAt: (!isNew && items[existingIdx].createdAt) ? items[existingIdx].createdAt : (newItem.createdAt || Date.now()),
    status,
  };

  if (!isNew) {
    items[existingIdx] = itemToSave;
  } else {
    items.push(itemToSave);
  }

  data.items = items;
  data.updatedAt = Date.now();
  writeReleasesData(data);
  res.json({ success: true, item: itemToSave, count: items.length });
});

app.patch('/api/releases/items/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, resolution } = req.body;
  if (!status) {
    res.status(400).json({ error: 'status is required' });
    return;
  }
  const data = readReleasesData();
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  const idx = items.findIndex((i: any) => i.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  items[idx].status = status;
  if (resolution !== undefined) {
    items[idx].resolution = resolution;
  }
  data.items = items;
  data.updatedAt = Date.now();
  writeReleasesData(data);
  res.json({ success: true, item: items[idx] });
});

app.delete('/api/releases/items/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const data = readReleasesData();
  const items: any[] = Array.isArray(data.items) ? data.items : [];
  data.items = items.filter((i: any) => i.id !== id);
  data.updatedAt = Date.now();
  writeReleasesData(data);
  res.json({ success: true, deletedId: id });
});

// 10. Cross-Device / Multi-Client Playback Coordinator (Synchronizes playback & pauses stale devices)
interface ActivePlaybackState {
  clientId: string;
  isPlaying: boolean;
  snippetId?: string;
  title?: string;
  artist?: string;
  trackUri?: string;
  positionMs?: number;
  deviceName?: string;
  deviceId?: string;
  updatedAt: number;
}

let activePlaybackState: ActivePlaybackState | null = null;

app.get('/api/playback/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    playback: activePlaybackState,
  });
});

app.post('/api/playback/sync', (req: Request, res: Response) => {
  const { clientId, isPlaying, snippetId, title, artist, trackUri, positionMs, deviceName, deviceId } = req.body;
  if (!clientId) {
    res.status(400).json({ error: 'clientId is required' });
    return;
  }
  activePlaybackState = {
    clientId,
    isPlaying: Boolean(isPlaying),
    snippetId,
    title,
    artist,
    trackUri,
    positionMs: positionMs || 0,
    deviceName: deviceName || 'BitStream Device',
    deviceId,
    updatedAt: Date.now(),
  };
  res.json({ success: true, playback: activePlaybackState });
});

// Start server with Vite middleware in dev or static files in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Generate or load self-signed certificate for local HTTPS OAuth callback support
  const CERT_PATH = path.join(__dirname, '.cert.pem');
  const KEY_PATH = path.join(__dirname, '.key.pem');
  let pems: { private: string; cert: string } | null = null;
  try {
    if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
      pems = {
        cert: fs.readFileSync(CERT_PATH, 'utf8'),
        private: fs.readFileSync(KEY_PATH, 'utf8'),
      };
    } else {
      const selfsigned = (await import('selfsigned')).default;
      const localIp = getLocalIpAddress();
      pems = await selfsigned.generate([
        { name: 'commonName', value: localIp },
        { name: 'organizationName', value: 'Spotify BitStream Local' },
      ], {
        keySize: 2048,
        extensions: [
          {
            name: 'subjectAltName',
            altNames: [
              { type: 7, ip: localIp },
              { type: 2, value: 'localhost' },
            ],
          },
        ],
      });
      if (pems?.cert && pems?.private) {
        fs.writeFileSync(CERT_PATH, pems.cert, 'utf8');
        fs.writeFileSync(KEY_PATH, pems.private, 'utf8');
      }
    }
  } catch (e) {
    console.warn('Could not initialize selfsigned certificates for HTTPS:', e);
  }

  const httpServer = http.createServer(app);
  let httpsServer: https.Server | null = null;
  if (pems) {
    httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);
    httpsServer.on('error', (err) => console.warn('HTTPS Server warning:', err.message));
  }
  httpServer.on('error', (err) => console.warn('HTTP Server warning:', err.message));

  // Master TCP multiplexer: detects TLS ClientHello (0x16) to route to HTTPS, otherwise HTTP
  const masterServer = net.createServer((socket) => {
    socket.on('error', () => {
      // Catch socket aborts/resets during handshake
    });

    const onReadable = () => {
      const buf = socket.read(1);
      if (!buf) {
        socket.once('readable', onReadable);
        return;
      }
      socket.unshift(buf);
      if (buf[0] === 0x16 && httpsServer) {
        httpsServer.emit('connection', socket);
      } else {
        httpServer.emit('connection', socket);
      }
    };

    socket.once('readable', onReadable);
  });

  masterServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🎵 Spotify BitStream Server (Dual HTTP/HTTPS) running on port ${PORT}`);
    console.log(`🔗 APP_URL: ${APP_URL}`);
    getOrFetchAppCredentialsToken().then((sess) => {
      if (sess) console.log('⚡ Spotify App Credentials session initialized');
    });
  });
}

startServer().catch(console.error);
