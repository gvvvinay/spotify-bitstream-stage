import React, { useState, useRef, useEffect } from 'react';
import {
  Scissors,
  Settings,
  Radio,
  FolderDown,
  Music,
  CheckCircle2,
  LogOut,
  Cloud,
  ChevronDown,
  ChevronRight,
  HardDrive,
  User,
  Sparkles,
  Palette,
  Lock,
  ShieldCheck,
  GitBranch,
  Layers,
  Menu,
  X,
  PlayCircle,
  Smartphone,
  ExternalLink,
  BookOpen,
  LayoutGrid,
  Sliders,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { SpotifyAuthStatus } from '../services/spotify';
import { ThemeId, THEMES } from '../utils/theme';

interface NavbarProps {
  authStatus: SpotifyAuthStatus;
  googleUser: FirebaseUser | null;
  snippetCount: number;
  playlistCount: number;
  hasStoredSpotifyCreds?: boolean;
  isLocalMode?: boolean;
  isDbSynced?: boolean;
  currentTheme: ThemeId;
  appUsername?: string;
  isMobileHome?: boolean;
  onToggleMobileHome?: () => void;
  onLogoutApp?: () => void;
  onOpenThemeSelector: () => void;
  onOpenReleaseNotes?: () => void;
  onOpenUserGuide?: () => void;
  onOpenAuthModal?: () => void;
  onOpenMixer?: () => void;
  onOpenMashupModal?: () => void;
  onOpenClipper: () => void;
  onOpenSetup: () => void;
  onOpenExportImport: () => void;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  authStatus,
  googleUser,
  snippetCount,
  playlistCount,
  hasStoredSpotifyCreds,
  isLocalMode,
  isDbSynced,
  currentTheme,
  appUsername,
  isMobileHome,
  onToggleMobileHome,
  onLogoutApp,
  onOpenThemeSelector,
  onOpenReleaseNotes,
  onOpenUserGuide,
  onOpenAuthModal,
  onOpenMixer,
  onOpenMashupModal,
  onOpenClipper,
  onOpenSetup,
  onOpenExportImport,
  onSignInGoogle,
  onSignOutGoogle,
}) => {
  const [showDesktopMenu, setShowDesktopMenu] = useState(false);
  const [showDbInfo, setShowDbInfo] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement>(null);
  const dbInfoRef = useRef<HTMLDivElement>(null);

  // Close desktop dropdowns when tapping outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (desktopMenuRef.current && !desktopMenuRef.current.contains(target)) {
        setShowDesktopMenu(false);
      }
      if (dbInfoRef.current && !dbInfoRef.current.contains(target)) {
        setShowDbInfo(false);
      }
    };
    if (showDesktopMenu || showDbInfo) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDesktopMenu, showDbInfo]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const activeThemeMeta = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  const handleMobileAction = (action: () => void) => {
    setIsMobileMenuOpen(false);
    action();
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-2xl border-b border-white/[0.06] transition-all">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-12 sm:h-14 flex items-center justify-between gap-2">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleMobileHome?.()}
              className="flex items-center gap-2 text-left active:scale-95 transition cursor-pointer"
              title="Playlists Home"
            >
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl p-0.5 shadow-md transition-all shrink-0"
                style={{
                  background: `linear-gradient(135deg, var(--theme-accent), var(--theme-accent-hover))`,
                  boxShadow: `0 2px 10px var(--theme-accent-glow)`,
                }}
              >
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center theme-text-accent">
                  <Music className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center">
                  Bit<span className="theme-text-accent">Stream</span>
                </h1>
                <span className="w-1.5 h-1.5 rounded-full theme-pulse-dot" />
              </div>
            </button>

            {/* Desktop-only Release Notes Stage Badge */}
            {onOpenReleaseNotes && (
              <button
                onClick={onOpenReleaseNotes}
                className="hidden md:inline-flex ml-2 px-2.5 py-1 rounded-full bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 hover:text-white text-[11px] font-bold items-center gap-1.5 transition active:scale-95 shadow-sm group cursor-pointer"
                title="Release Notes & Environment Tracker: Stage :3100 vs Production :4100"
              >
                <GitBranch className="w-3 h-3 text-purple-400 group-hover:rotate-12 transition-transform" />
                <span className="font-mono font-extrabold">v2.0</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 bg-purple-400/20 text-purple-200 rounded font-semibold tracking-wider">
                  Stage :3100
                </span>
              </button>
            )}
          </div>

          {/* ======================================================== */}
          {/* MOBILE VIEW (< md): Ultra-Clean, Sleek & Uncluttered     */}
          {/* ======================================================== */}
          <div className="flex md:hidden items-center gap-1.5">
            {/* 0. Mobile Playlists Home Toggle */}
            {onToggleMobileHome && (
              <button
                onClick={onToggleMobileHome}
                className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                  isMobileHome
                    ? 'theme-bg-soft theme-border-accent theme-text-accent shadow-sm'
                    : 'bg-slate-900/90 hover:bg-slate-850 border-white/[0.08] text-slate-300 hover:text-white'
                }`}
                title="Playlists Home Screen"
                aria-label="Playlists Home"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
            )}

            {/* 1. Sleek Clip Action Pill */}
            <button
              onClick={onOpenClipper}
              className="px-2.5 py-1.5 rounded-xl theme-btn-primary font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
              title="Clip new snippet from Spotify"
              aria-label="Clip Music Bit"
            >
              <Scissors className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Clip</span>
            </button>

            {/* 2. Unified Sleek Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="relative p-2 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-white/[0.08] text-slate-200 hover:text-white transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
              title="Open BitStream Menu & Control Center"
              aria-label="Open Menu"
            >
              <Menu className="w-4 h-4 text-slate-200" />
              {/* Status indicator dot on menu button */}
              <span
                className={`absolute top-1 right-1 w-2 h-2 rounded-full border border-slate-950 ${
                  authStatus.authenticated
                    ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                    : authStatus.authMode === 'client_credentials'
                    ? 'bg-cyan-400'
                    : 'bg-amber-400'
                }`}
              />
            </button>
          </div>

          {/* ======================================================== */}
          {/* DESKTOP VIEW (>= md): Full Action Control Toolbar        */}
          {/* ======================================================== */}
          <div className="hidden md:flex items-center gap-1.5">
            {/* 1. Local Disk DB Status Icon Button */}
            <div className="relative" ref={dbInfoRef}>
              <button
                onClick={() => {
                  setShowDbInfo(!showDbInfo);
                  setShowDesktopMenu(false);
                }}
                className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center justify-center"
                title={`Local Disk Database: ${snippetCount} snippets saved on disk (Click for sync status)`}
                aria-label="Local DB Status"
              >
                <HardDrive className="w-4 h-4 theme-text-accent" />
                <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-3.5 rounded-full theme-btn-primary text-[9px] font-bold flex items-center justify-center shadow-sm">
                  {snippetCount}
                </span>
              </button>

              {/* DB Status Popover */}
              {showDbInfo && (
                <div className="absolute right-0 top-11 w-64 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-3 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 theme-text-accent" /> Local Disk DB
                    </span>
                    <span className="px-1.5 py-0.5 rounded-full theme-bg-soft theme-text-accent font-mono text-[10px] font-bold">
                      Active
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-300 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Snippets stored:</span>
                      <span className="font-bold text-white font-mono">{snippetCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Playlists:</span>
                      <span className="font-bold text-white font-mono">{playlistCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Laptop & Phone:</span>
                      <span className="theme-text-accent font-semibold">Auto-Synced</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-white/[0.04]">
                    Snippets are written to <code className="theme-text-accent font-mono">snippets-data.json</code> on your laptop and sync to connected mobile devices.
                  </p>
                  <button
                    onClick={() => {
                      setShowDbInfo(false);
                      onOpenExportImport();
                    }}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <FolderDown className="w-3 h-3 theme-text-accent" />
                    <span>Backup / Export JSON</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. Spotify Connect Icon Button */}
            <button
              onClick={onOpenSetup}
              className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center justify-center"
              title={
                authStatus.authenticated
                  ? `Spotify: Connected as ${authStatus.user?.display_name || 'User'} (Click for device & token settings)`
                  : 'Connect Spotify Account (Click to set up)'
              }
              aria-label="Spotify Settings"
            >
              <Radio className="w-4 h-4" />
              <span
                className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-slate-950 ${
                  authStatus.authenticated ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'
                }`}
              />
            </button>

            {/* 3. Theme Palette Icon Button */}
            <button
              onClick={onOpenThemeSelector}
              className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] text-slate-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center justify-center"
              title={`Active Theme: ${activeThemeMeta.name} (Click to select from 5 themes)`}
              aria-label="Theme Selector"
            >
              <Palette className="w-4 h-4 theme-text-accent" />
              <span
                className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-slate-950 shadow-sm"
                style={{ backgroundColor: activeThemeMeta.primaryColor }}
              />
            </button>

            {/* 4. Release Notes Tracker Icon Button */}
            {onOpenReleaseNotes && (
              <button
                onClick={onOpenReleaseNotes}
                className="relative p-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 hover:text-white transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="Release Notes & Tracker (Stage v2.0 vs Production v1.0)"
                aria-label="Release Notes & Tracker"
              >
                <Layers className="w-4 h-4 text-purple-400" />
                <span className="absolute -top-1 -right-1 px-1 min-w-[15px] h-3.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-sm">
                  25
                </span>
              </button>
            )}

            {/* 4b. Desktop User Guide Button */}
            {onOpenUserGuide && (
              <button
                onClick={onOpenUserGuide}
                className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] text-emerald-400 hover:text-white transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="Product User Guide & Feature Documentation"
                aria-label="User Guide"
              >
                <BookOpen className="w-4 h-4" />
              </button>
            )}

            {/* 4c. Club / Mashup Button */}
            {onOpenMashupModal && (
              <button
                onClick={onOpenMashupModal}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 hover:from-amber-500/30 hover:to-purple-500/30 border border-amber-400/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer shadow-sm"
                title="Club bits into sequential seamless Mashup"
                aria-label="Club Mashup"
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Mashup</span>
              </button>
            )}

            {/* 4d. DJ Mixer Button */}
            {onOpenMixer && (
              <button
                onClick={onOpenMixer}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 hover:bg-slate-800 border border-white/[0.08] text-slate-300 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition cursor-pointer shadow-sm"
                title="Open BitStream DJ Audio Mixer"
                aria-label="Open DJ Mixer"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>Mixer</span>
              </button>
            )}

            {/* 5. Desktop Clip Highlight Button */}
            <button
              onClick={onOpenClipper}
              className="px-3 py-1.5 rounded-xl theme-btn-primary font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
              title="Clip new snippet from Spotify"
              aria-label="Clip Music Bit"
            >
              <Scissors className="w-4 h-4 stroke-[2.5]" />
              <span>Clip</span>
            </button>

            {/* 6. Desktop User Profile & Settings Menu */}
            <div className="relative" ref={desktopMenuRef}>
              <button
                onClick={() => {
                  setShowDesktopMenu(!showDesktopMenu);
                  setShowDbInfo(false);
                }}
                className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] text-slate-200 transition active:scale-95 cursor-pointer flex items-center justify-center"
                title="Account & Library Settings"
                aria-label="Account Menu"
              >
                {authStatus.user?.images?.[0]?.url ? (
                  <img
                    src={authStatus.user.images[0].url}
                    alt={authStatus.user.display_name}
                    className="w-6 h-6 rounded-lg object-cover ring-1 ring-white/[0.2]"
                  />
                ) : googleUser?.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Account'}
                    className="w-6 h-6 rounded-lg object-cover ring-1 ring-white/[0.2]"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* Desktop Dropdown Menu */}
              {showDesktopMenu && (
                <div className="absolute right-0 top-11 w-68 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-2.5 z-50 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  {/* User / Spotify card */}
                  <div className="p-2.5 bg-slate-900/90 rounded-xl space-y-1.5 border border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Spotify Account
                      </span>
                      {authStatus.authenticated && (
                        <span className="px-1.5 py-0.5 rounded-full theme-bg-soft theme-border-accent theme-text-accent text-[10px] font-bold">
                          {authStatus.user?.product === 'premium' ? 'Premium' : 'Connected'}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-white text-sm truncate">
                      {authStatus.user?.display_name || (authStatus.authenticated ? 'Connected' : 'Not Linked')}
                    </div>
                    {authStatus.user?.email && (
                      <div className="text-[11px] text-slate-400 truncate font-mono">
                        {authStatus.user.email}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setShowDesktopMenu(false);
                        onOpenSetup();
                      }}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <Radio className="w-3 h-3 theme-text-accent" />
                      <span>{authStatus.authenticated ? 'Spotify Settings' : 'Connect Spotify'}</span>
                    </button>
                  </div>

                  {/* Theme Selector shortcut */}
                  <button
                    onClick={() => {
                      setShowDesktopMenu(false);
                      onOpenThemeSelector();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-between transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-slate-400" />
                      <span>Theme</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shadow-sm"
                        style={{ backgroundColor: activeThemeMeta.primaryColor }}
                      />
                      <span className="text-[11px] font-semibold capitalize theme-text-accent">
                        {activeThemeMeta.name}
                      </span>
                    </div>
                  </button>

                  {/* Release Notes & Environment Tracker */}
                  {onOpenReleaseNotes && (
                    <button
                      onClick={() => {
                        setShowDesktopMenu(false);
                        onOpenReleaseNotes();
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span>Release Notes & Tracker</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                        Stage vs Prod
                      </span>
                    </button>
                  )}

                  {/* Product User Guide Option */}
                  {onOpenUserGuide && (
                    <button
                      onClick={() => {
                        setShowDesktopMenu(false);
                        onOpenUserGuide();
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span>Product User Guide</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                        Docs
                      </span>
                    </button>
                  )}

                  {/* Backup & Restore Option */}
                  <button
                    onClick={() => {
                      setShowDesktopMenu(false);
                      onOpenExportImport();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white flex items-center gap-2 transition cursor-pointer"
                  >
                    <FolderDown className="w-4 h-4 text-slate-400" />
                    <span>Backup & Export Library JSON</span>
                  </button>

                  {/* Google Sign In option */}
                  <div className="border-t border-slate-800/80 pt-1.5">
                    {googleUser ? (
                      <button
                        onClick={() => {
                          setShowDesktopMenu(false);
                          onSignOutGoogle();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition font-medium cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out ({googleUser.email?.split('@')[0]})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowDesktopMenu(false);
                          onSignInGoogle();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl text-left text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2 transition font-medium cursor-pointer"
                      >
                        <Cloud className="w-4 h-4 theme-text-accent" />
                        <span>Sync with Google Account</span>
                      </button>
                    )}
                  </div>

                  {/* BitStream App Session & Lock / Logout Option */}
                  {onLogoutApp && (
                    <div className="border-t border-slate-800/80 pt-1.5 space-y-1">
                      {appUsername && (
                        <div className="px-2.5 py-1 text-[11px] text-slate-400 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 theme-text-accent" />
                            <span>App Session</span>
                          </span>
                          <span className="font-mono text-white font-bold">{appUsername}</span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          setShowDesktopMenu(false);
                          onLogoutApp();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl text-left text-amber-400 hover:bg-amber-500/10 flex items-center gap-2 transition font-medium cursor-pointer"
                        title="Lock the app and return to login screen"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Lock & Log Out App</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* MOBILE CONTROL CENTER MODAL / SLIDE-UP DRAWER            */}
      {/* ======================================================== */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden animate-in fade-in duration-200">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="relative w-full max-h-[90vh] bg-slate-950 border-t border-white/[0.1] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 z-10">
            {/* Grab Bar & Header */}
            <div className="pt-2.5 pb-2 px-4 border-b border-white/[0.06] bg-slate-900/60 flex flex-col">
              <div className="w-10 h-1 rounded-full bg-slate-700/80 mx-auto mb-2" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-900 border border-white/[0.08] flex items-center justify-center theme-text-accent">
                    <Music className="w-3 h-3 fill-current" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs tracking-tight">BitStream Control Center</h3>
                    <p className="text-[10px] text-slate-400">Settings, library & account menu</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Stage Environment Pill */}
                  {onOpenReleaseNotes && (
                    <button
                      onClick={() => handleMobileAction(onOpenReleaseNotes)}
                      className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold flex items-center gap-1 active:scale-95"
                    >
                      <GitBranch className="w-2.5 h-2.5" />
                      <span>Stage :3100</span>
                    </button>
                  )}

                  {/* Close button */}
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition active:scale-90"
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Drawer Body */}
            <div className="p-4 space-y-3.5 overflow-y-auto text-xs flex-1">
              {/* 1. Spotify Account & Playback Status Card */}
              <div className="p-3.5 bg-slate-900/90 border border-white/[0.08] rounded-2xl space-y-2.5 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 theme-text-accent" />
                    <span className="font-bold text-white text-xs">Spotify Connection</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
                      authStatus.authenticated
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        authStatus.authenticated ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-amber-400'
                      }`}
                    />
                    <span>
                      {authStatus.authenticated
                        ? authStatus.user?.product === 'premium'
                          ? 'Premium Connected'
                          : 'Connected'
                        : 'Not Linked'}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2.5 pt-0.5">
                  {authStatus.user?.images?.[0]?.url ? (
                    <img
                      src={authStatus.user.images[0].url}
                      alt="User avatar"
                      className="w-9 h-9 rounded-xl object-cover ring-1 ring-white/20 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white text-xs truncate">
                      {authStatus.user?.display_name || (authStatus.authenticated ? 'Active Spotify User' : 'No account connected')}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate font-mono">
                      {authStatus.user?.email || 'Set up Client ID or Authorize'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleMobileAction(onOpenSetup)}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-[0.99] border border-white/[0.06] cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5 theme-text-accent" />
                  <span>{authStatus.authenticated ? 'Manage Spotify & Devices' : 'Connect Spotify Account'}</span>
                </button>
              </div>

              {/* 1b. Product User Guide Banner */}
              {onOpenUserGuide && (
                <button
                  type="button"
                  onClick={() => handleMobileAction(onOpenUserGuide)}
                  className="w-full p-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-purple-950/30 border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl flex items-center justify-between transition active:scale-[0.99] cursor-pointer shadow-md group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="font-bold text-white text-xs flex items-center gap-1.5">
                        <span>Product User Guide</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold">
                          Docs
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        Single-page walkthrough with screenshots
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>
              )}

              {/* 2. Quick Action Tools Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Club / Mashup */}
                {onOpenMashupModal && (
                  <button
                    type="button"
                    onClick={() => handleMobileAction(onOpenMashupModal)}
                    className="p-3 bg-gradient-to-br from-amber-500/15 via-rose-500/15 to-purple-500/15 hover:from-amber-500/25 hover:to-purple-500/25 border border-amber-500/30 rounded-2xl flex flex-col gap-1 text-left transition active:scale-[0.98] cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/30 to-rose-500/30 text-amber-300 border border-amber-400/40 flex items-center justify-center shadow-md mb-0.5">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-amber-300 text-xs">Club Mashup</span>
                    <span className="text-[10px] text-slate-400">Stitch 2-3 bits seamlessly</span>
                  </button>
                )}

                {/* DJ Audio Mixer */}
                {onOpenMixer && (
                  <button
                    type="button"
                    onClick={() => handleMobileAction(onOpenMixer)}
                    className="p-3 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 hover:bg-slate-800 border border-white/[0.08] rounded-2xl flex flex-col gap-1 text-left transition active:scale-[0.98] cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 border border-white/[0.08] flex items-center justify-center shadow-md mb-0.5">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-slate-200 text-xs">DJ Audio Mixer</span>
                    <span className="text-[10px] text-slate-400">Dual decks & effects</span>
                  </button>
                )}

                {/* Clip Tool */}
                <button
                  type="button"
                  onClick={() => handleMobileAction(onOpenClipper)}
                  className="p-3 bg-slate-900/80 hover:bg-slate-850 border border-white/[0.08] rounded-2xl flex flex-col gap-1 text-left transition active:scale-[0.98] cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl theme-btn-primary flex items-center justify-center shadow-md mb-0.5">
                    <Scissors className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <span className="font-bold text-white text-xs">Clip Music Bit</span>
                  <span className="text-[10px] text-slate-400">Save track snippet</span>
                </button>

                {/* Theme Selector */}
                <button
                  type="button"
                  onClick={() => handleMobileAction(onOpenThemeSelector)}
                  className="p-3 bg-slate-900/80 hover:bg-slate-850 border border-white/[0.08] rounded-2xl flex flex-col gap-1 text-left transition active:scale-[0.98] cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/[0.08] flex items-center justify-center theme-text-accent">
                      <Palette className="w-4 h-4" />
                    </div>
                    <span
                      className="w-3.5 h-3.5 rounded-full shadow-sm border border-slate-950"
                      style={{ backgroundColor: activeThemeMeta.primaryColor }}
                    />
                  </div>
                  <span className="font-bold text-white text-xs capitalize">{activeThemeMeta.name}</span>
                  <span className="text-[10px] text-slate-400">Switch app theme</span>
                </button>

                {/* Release Notes */}
                {onOpenReleaseNotes && (
                  <button
                    type="button"
                    onClick={() => handleMobileAction(onOpenReleaseNotes)}
                    className="p-3 bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/30 rounded-2xl flex flex-col gap-1 text-left transition active:scale-[0.98] cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-900/50 flex items-center justify-center text-purple-300">
                        <Layers className="w-4 h-4" />
                      </div>
                      <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 text-[9px] font-mono font-bold">
                        Stage :3100
                      </span>
                    </div>
                    <span className="font-bold text-white text-xs">Release Notes</span>
                    <span className="text-[10px] text-purple-300/80">Tracker & Bug Log</span>
                  </button>
                )}

                {/* Backup & Export */}
                <button
                  type="button"
                  onClick={() => handleMobileAction(onOpenExportImport)}
                  className="p-3 bg-slate-900/80 hover:bg-slate-850 border border-white/[0.08] rounded-2xl flex flex-col gap-1 text-left transition active:scale-[0.98] cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/[0.08] flex items-center justify-center theme-text-accent mb-0.5">
                    <FolderDown className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-white text-xs">Library Backup</span>
                  <span className="text-[10px] text-slate-400">Export / Import JSON</span>
                </button>
              </div>

              {/* 3. Local Disk DB Status Card */}
              <div className="p-3.5 bg-slate-900/60 border border-white/[0.06] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white font-bold text-xs">
                    <HardDrive className="w-3.5 h-3.5 theme-text-accent" />
                    <span>Local Database on Disk</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    Auto-Synced
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-0.5">
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-white/[0.04]">
                    <div className="text-slate-400 text-[10px]">Saved Bits</div>
                    <div className="font-bold text-white font-mono text-sm">{snippetCount}</div>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/60 border border-white/[0.04]">
                    <div className="text-slate-400 text-[10px]">Playlists</div>
                    <div className="font-bold text-white font-mono text-sm">{playlistCount}</div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Saved to <code className="theme-text-accent font-mono">snippets-data.json</code> on laptop and accessible across mobile & desktop.
                </p>
              </div>

              {/* 4. Google Account / Cloud Sync Card */}
              <div className="p-3 bg-slate-900/60 border border-white/[0.06] rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Cloud className="w-4 h-4 theme-text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs truncate">
                      {googleUser ? 'Google Sync Active' : 'Cloud Sync (Optional)'}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {googleUser ? googleUser.email : 'Backup snippets to Google Firestore'}
                    </div>
                  </div>
                </div>
                {googleUser ? (
                  <button
                    type="button"
                    onClick={() => handleMobileAction(onSignOutGoogle)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[10px] font-bold shrink-0 active:scale-95 transition"
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleMobileAction(onSignInGoogle)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/[0.08] text-white text-[10px] font-bold shrink-0 active:scale-95 transition"
                  >
                    Sign In
                  </button>
                )}
              </div>

              {/* 5. App Session & Lock */}
              {onLogoutApp && (
                <div className="pt-1 flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 theme-text-accent" />
                    <span>User:</span>
                    <span className="font-mono text-white font-bold">{appUsername || 'admin'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMobileAction(onLogoutApp)}
                    className="text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1 transition active:scale-95 py-1 px-2"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Lock App</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
