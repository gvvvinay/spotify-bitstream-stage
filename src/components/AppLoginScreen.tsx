import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Music,
  HardDrive,
  ShieldCheck,
  AlertCircle,
  Laptop,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { ThemeId, getStoredTheme, applyTheme } from '../utils/theme';

export interface AppUserSession {
  username: string;
  token: string;
  loggedInAt?: number;
}

interface AppLoginScreenProps {
  onLoginSuccess: (session: AppUserSession) => void;
  currentTheme?: ThemeId;
}

export const AppLoginScreen: React.FC<AppLoginScreenProps> = ({
  onLoginSuccess,
  currentTheme = getStoredTheme(),
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // By default, apply the current theme so accent glows and styling take effect
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Execute login API call
  const performLogin = async (userToAuth: string, passToAuth: string) => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/app-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userToAuth.trim(),
          password: passToAuth.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid credentials. Please verify your username and password.');
        setLoading(false);
        return;
      }

      const session: AppUserSession = {
        username: data.user?.username || userToAuth,
        token: data.token,
        loggedInAt: Date.now(),
      };

      if (rememberMe) {
        try {
          localStorage.setItem('bitstream_app_session', JSON.stringify(session));
        } catch (e) {
          console.warn('Failed saving app session to localStorage:', e);
        }
      }

      onLoginSuccess(session);
    } catch (err: any) {
      console.error('Login request failed:', err);
      setError('Unable to connect to server. Please check your network connection.');
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }
    performLogin(username, password);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden select-none font-sans">
      {/* Dynamic Background Glows tailored to Current Theme */}
      <div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[120px] pointer-events-none opacity-40 transition-all duration-700"
        style={{ backgroundColor: 'var(--theme-accent)' }}
      />
      <div
        className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-[140px] pointer-events-none opacity-30 transition-all duration-700"
        style={{ backgroundColor: 'var(--theme-accent-hover)' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Top Header Bar (Themes option removed) */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl p-0.5 shadow-lg transition-transform duration-300 hover:scale-105 shrink-0"
            style={{
              background: `linear-gradient(135deg, var(--theme-accent), var(--theme-accent-hover))`,
              boxShadow: `0 4px 20px var(--theme-accent-glow)`,
            }}
          >
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center theme-text-accent">
              <Music className="w-5 h-5 fill-current" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black tracking-tight text-white">
                Bit<span className="theme-text-accent">Stream</span>
              </span>
              <span className="w-1.5 h-1.5 rounded-full theme-pulse-dot" />
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">
              Snippet Playlist Player
            </p>
          </div>
        </div>
      </header>

      {/* Main Login Card Area */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-md">
          {/* Main Card Container */}
          <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
            {/* Ambient inner glow */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full blur-[4px]"
              style={{ backgroundColor: 'var(--theme-accent)' }}
            />

            {/* Title & Badge */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/80 border border-white/[0.06] text-[11px] font-medium text-slate-300 mb-3">
                <ShieldCheck className="w-3.5 h-3.5 theme-text-accent" />
                <span>BitStream Security Gate</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Welcome to BitStream
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                Sign in to manage highlights, play snippet chains, and sync across your devices.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="flex-1 font-medium">{error}</span>
              </div>
            )}

            {/* Credential Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter your username"
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/90 border border-white/[0.1] text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-white/30 transition shadow-inner"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/90 border border-white/[0.1] text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-white/30 transition shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-950 border-white/[0.2] theme-text-accent focus:ring-0 cursor-pointer"
                  />
                  <span>Remember session on this device</span>
                </label>
              </div>

              {/* Primary Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white theme-btn-primary shadow-lg active:scale-98 transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to BitStream</span>
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                  </>
                )}
              </button>
            </form>

            {/* Security Notice */}
            <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
              <p className="text-[10px] text-slate-500 leading-normal">
                Credentials are authenticated against your secure local server instance.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info & Multi-Device Sync Indicators */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 py-4 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 theme-text-accent" />
            <span className="text-slate-300 font-semibold">snippets-data.json</span> Ready
          </span>
          <span className="text-slate-600">•</span>
          <span className="flex items-center gap-1">
            <Laptop className="w-3.5 h-3.5 text-slate-400" />
            <span>Laptop</span>
            <span className="theme-text-accent">⇄</span>
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <span>Phone</span>
          </span>
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          BitStream v1.0 • Port 4100
        </div>
      </footer>
    </div>
  );
};
