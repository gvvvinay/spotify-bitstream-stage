import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  ArrowLeft,
  Search,
  Scissors,
  Radio,
  Music,
  Play,
  Pause,
  Repeat,
  Heart,
  ListPlus,
  Palette,
  Sliders,
  Volume2,
  HardDrive,
  Cloud,
  FolderDown,
  Layers,
  Sparkles,
  Command,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Smartphone,
  Laptop,
  Clock,
  Mic2,
  Zap,
  Info,
  Maximize2,
  X,
  Menu,
} from 'lucide-react';
import { ThemeId, THEMES } from '../utils/theme';

interface UserGuideViewProps {
  onClose: () => void;
  currentTheme: ThemeId;
}

interface GuideSection {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge?: string;
  screenshot?: string;
  screenshotCaption?: string;
  steps: string[];
  tips?: string[];
  shortcuts?: { key: string; action: string }[];
  details: string;
}

export const UserGuideView: React.FC<UserGuideViewProps> = ({ onClose, currentTheme }) => {
  const [activeSectionId, setActiveSectionId] = useState<string>('getting-started');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; caption: string } | null>(null);
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const activeThemeMeta = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  const sections: GuideSection[] = [
    {
      id: 'getting-started',
      category: 'Overview',
      title: 'Introduction & Architecture',
      subtitle: 'Precision audio highlights player with multi-device sync',
      icon: Sparkles,
      badge: 'Core Concept',
      screenshot: '/screenshots/dashboard_main.png',
      screenshotCaption: 'BitStream Stage Dashboard with neon theme, playlist filter chips & snippet collection',
      details:
        'BitStream is an audiophile-grade web application built to clip, organize, and seamlessly stream the best snippets (hooks, choruses, drops, solos) of your favorite Spotify tracks. Unlike full-song players, BitStream loops and queues exact time-stamped snippets with millisecond precision.',
      steps: [
        'Explore your snippet library using the horizontal playlist category pills (All Bits, Liked, Recent, or Custom Playlists).',
        'Tap on any snippet card to start playback immediately from Point A (start) through Point B (end).',
        'Use the bottom mini-player bar for real-time playhead scrubbing, volume adjustments, and full Now Playing modal expansion.',
        'Access the application from your laptop (127.0.0.1:3100) or mobile phone on your local Wi-Fi (192.168.1.71:3100).',
      ],
      tips: [
        'BitStream operates on Port 3100 for the active Stage environment and Port 4100 for the Production stable release.',
        'All data is persisted in real time to the local disk database (snippets-data.json) on your host PC.',
      ],
    },
    {
      id: 'app-authentication',
      category: 'Security & Access',
      title: 'BitStream App Login',
      subtitle: 'Session-gated security protecting your player and library',
      icon: Zap,
      badge: 'Security',
      screenshot: '/screenshots/app_login.png',
      screenshotCaption: 'Secure BitStream login screen with pre-filled default credentials',
      details:
        'To protect access across local Wi-Fi networks and public deployments, BitStream includes an application access gate. Only authorized users with credentials can access the player, credentials, and local database.',
      steps: [
        'When first accessing the app, you will see the BitStream login screen with default credentials pre-filled.',
        'Default Username: "admin" | Default Password: "bitstream4100".',
        'Tap "Sign In to BitStream" to authenticate and receive a cryptographic session token.',
        'To lock the app when finished, open the User Menu (desktop) or Control Center (mobile) and tap "Lock App".',
      ],
      tips: [
        'Sessions are remembered on your device so you do not need to re-login every time.',
        'Custom usernames and passwords can be configured in the .env file using APP_LOGIN_USER and APP_LOGIN_PASS.',
      ],
    },
    {
      id: 'spotify-setup',
      category: 'Spotify Integration',
      title: 'Spotify Connect & Developer Credentials',
      subtitle: 'Web API & OAuth 2.1 integration with Spotify Connect',
      icon: Radio,
      badge: 'Spotify Web API',
      screenshot: '/screenshots/spotify_setup.png',
      screenshotCaption: 'Spotify Developer setup dialog with Client ID/Secret and redirect URIs',
      details:
        'BitStream integrates directly with Spotify Web API and Spotify Connect to stream high-fidelity audio directly from Spotify servers to any connected player.',
      steps: [
        'Open the Spotify Setup dialog by tapping the Radio icon (desktop) or "Spotify Settings" in the Mobile Control Center.',
        'Create a free app in the Spotify Developer Dashboard (developer.spotify.com/dashboard).',
        'Copy your Client ID and Client Secret into Step 3 of the dialog.',
        'Add the required Redirect URIs in your Spotify Dashboard: http://127.0.0.1:3100/auth/callback (for PC) and https://192.168.1.71:3100/auth/callback (for mobile).',
        'Tap "Authorize Spotify Account" to connect your Spotify account.',
      ],
      tips: [
        'Spotify Premium is required by Spotify for remote playback via Spotify Connect.',
        'If you do not have Spotify Premium, BitStream automatically falls back to Web Audio preview clips where available.',
      ],
    },
    {
      id: 'mobile-auth',
      category: 'Spotify Integration',
      title: 'Mobile LAN Authorization & ⚡ 1-Tap Auto-Link',
      subtitle: 'Zero-friction authorization from mobile devices on 192.168.x.x',
      icon: Smartphone,
      badge: 'Enhanced Flow',
      screenshot: '/screenshots/mobile_control_center.png',
      screenshotCaption: 'Mobile Control Center with Spotify Premium status and 1-Tap Auto-Link option',
      details:
        'Spotify strictly enforces HTTPS on LAN IP addresses (192.168.x.x). BitStream incorporates an intelligent dual HTTP/HTTPS server multiplexer and an exclusive 1-Tap Auto-Link feature for mobile devices.',
      steps: [
        'Connect your phone to the same Wi-Fi network as your host laptop.',
        'Open http://192.168.1.71:3100/ in your mobile browser.',
        'Open the Mobile Control Center (tap ☰ in the top right).',
        'Option A (⚡ 1-Tap Auto-Link via PC): Tap "⚡ 1-Tap Auto-Link via PC" to trigger background authorization on your host laptop without certificate prompts. Your phone syncs in seconds!',
        'Option B (Direct HTTPS): Tap "Authorize on Mobile" to navigate directly through secure HTTPS with self-signed certificate.',
      ],
      tips: [
        'Once any device is authorized, the session is saved on the server and automatically shared with all connected phones and laptops.',
      ],
    },
    {
      id: 'snippet-clipper',
      category: 'Clipping Engine',
      title: 'Precision Music Snippet Clipper',
      subtitle: 'Waveform scrubbers, Point A & B markers, and nudge controls',
      icon: Scissors,
      badge: 'Interactive Audio Tool',
      screenshot: '/screenshots/snippet_clipper.png',
      screenshotCaption: 'Full-featured audio snippet clipper with visual timeline, Point A/B, and Spotify track search',
      details:
        'The Snippet Clipper is BitStream’s core creation suite. It lets you search any Spotify track, preview audio waveforms, and precisely mark snippet start (Point A) and snippet end (Point B) down to the millisecond.',
      steps: [
        'Click the "✂️ Clip" button in the top navbar (or in the mobile menu).',
        'Search for any song or artist in the Spotify track search bar.',
        'Drag the visual Point A (green) and Point B (red) markers along the dual timeline.',
        'Use the -1s, -0.1s, +0.1s, and +1s micro-nudge buttons for razor-sharp precision.',
        'Audition your snippet in real time with the "Audition Snippet" button.',
        'Assign a Snippet Title, select a Playlist, add tags (e.g., #hook, #solo, #drop), and tap "Save Snippet".',
      ],
      tips: [
        'Snippets can range from 1 second up to full track duration.',
        'Saved snippets instantly sync to your local disk database and appear on your dashboard.',
      ],
    },
    {
      id: 'now-playing',
      category: 'Playback Engine',
      title: 'Now Playing Modal & Vinyl Record Animation',
      subtitle: 'Immersive vinyl turntable, waveform scrubber, and controls',
      icon: Play,
      badge: 'Audiophile Experience',
      screenshot: '/screenshots/now_playing_visualizer.png',
      screenshotCaption: 'Expanded Now Playing screen featuring spinning vinyl turntable, real-time lyrics & visualizer',
      details:
        'Tapping the album artwork or title in the bottom mini-player opens the full-screen Now Playing modal, an immersive hi-fi audio interface with vinyl animation and playback mechanics.',
      steps: [
        'Click the album artwork in the bottom mini-player (or press "F" on your keyboard) to open Now Playing.',
        'Enjoy the rotating vinyl record animation that spins when audio is playing and slows to a stop on pause.',
        'Drag the full-width seek scrubber to jump anywhere inside the current snippet highlight.',
        'Switch repeat modes: Single Snippet Loop (🔂), Playlist Repeat (🔁), or Linear Playback (➡️).',
        'Tap the heart icon to save the snippet to your Liked Bits collection.',
      ],
      tips: [
        'Press Escape or click the down chevron at any time to minimize back to the mini-player without interrupting music.',
      ],
    },
    {
      id: 'visualizer-eq',
      category: 'Audio Engine',
      title: 'Audio Visualizer, Equalizer & Synced Lyrics',
      subtitle: '32-band real-time spectrum, 3-band parametric EQ, and live lyrics',
      icon: Sliders,
      badge: 'Web Audio API',
      screenshot: '/screenshots/now_playing_visualizer.png',
      screenshotCaption: '32-band spectrum visualizer and 3-band parametric equalizer controls',
      details:
        'BitStream features an integrated Web Audio API sound engine that drives real-time audio visualization, parametric tone shaping, and synchronized lyrics scrolling.',
      steps: [
        'In the Now Playing modal, view the 32-Band Canvas Spectrum Visualizer reacting dynamically to audio frequencies.',
        'Open the 3-Band Parametric Equalizer: adjust Bass (100 Hz), Mid (1 kHz), and Treble (10 kHz) gain from -12dB to +12dB.',
        'Select from 6 Master EQ Presets: Flat, Bass Boost, Vocal Enhance, Acoustic, Electronic, and Treble Clarity.',
        'Audition your EQ curves instantly using the built-in "Audition Chord" tone generator.',
        'Follow real-time synchronized lyrics fetched automatically via LRCLIB with line-by-line auto-scroll.',
      ],
      tips: [
        'Lyrics highlight active lines in your selected theme color as the track advances.',
      ],
    },
    {
      id: 'snippet-options',
      category: 'Queue & Organization',
      title: 'Snippet Management & Up Next Queue',
      subtitle: 'Play Next, Add to Queue, Liked Bits, and snippet reordering',
      icon: ListPlus,
      badge: 'Queue Suite',
      screenshot: '/screenshots/snippet_options.png',
      screenshotCaption: 'Context menu with Play Next, Add to Queue, Loop, and Favorite actions',
      details:
        'Every snippet card provides a rich options menu allowing you to organize playback flow, manage a dynamic "Up Next" queue, and curate favorites.',
      steps: [
        'Click the 3 dots (⋮) on any snippet card to reveal options.',
        'Select "Play Next" to insert the snippet immediately at the top of your queue.',
        'Select "Add to Queue" to append it to the end of your dynamic queue.',
        'Tap "Loop Snippet" to isolate and loop that highlight continuously.',
        'Tap "Edit Snippet" to reopen the precision clipper and adjust time boundaries.',
      ],
      tips: [
        'The dynamic queue always takes priority: when a snippet ends, queued items play first before returning to playlist order.',
      ],
    },
    {
      id: 'themes',
      category: 'Customization',
      title: 'Theme Engine & Aesthetics',
      subtitle: '5 curated color themes tailored for day and night sessions',
      icon: Palette,
      badge: 'Design System',
      screenshot: '/screenshots/theme_selector.png',
      screenshotCaption: 'Theme selector modal displaying 5 handcrafted aesthetic color schemes',
      details:
        'BitStream includes 5 handcrafted themes featuring sleek dark backgrounds, vibrant accent colors, and custom glassmorphism styles.',
      steps: [
        'Open the Theme Selector by clicking the Palette icon (desktop) or "App Theme" in the Mobile Control Center.',
        'Choose from 5 distinct palettes:',
        '• Neon Nights: Dark violet with electric cyan glow (Default).',
        '• Spotify Emerald: Classic high-contrast Spotify green.',
        '• Midnight Amethyst: Deep royal purple with soft magenta radiance.',
        '• Cyber Azure: High-tech cobalt blue with electric neon highlights.',
        '• Solar Amber: Warm golden amber with fiery sunset tones.',
      ],
      tips: [
        'Your theme preference is saved across sessions and automatically styles all buttons, cards, waveforms, and visualizers.',
      ],
    },
    {
      id: 'local-db',
      category: 'Data Management',
      title: 'Local Disk Database & Backup',
      subtitle: 'Robust disk storage, export/import JSON, and Firestore sync',
      icon: HardDrive,
      badge: 'Data Integrity',
      screenshot: '/screenshots/local_db_status.png',
      screenshotCaption: 'Local database status popover showing snippet count and JSON export option',
      details:
        'All your snippet metadata, playlists, timestamps, and tags are persisted to local disk in snippets-data.json on your host machine.',
      steps: [
        'Click the Hard Drive icon in the navbar to check local database status.',
        'View the total number of saved snippets, playlists, and device synchronization status.',
        'Click "Backup / Export JSON" to download your complete library as a standalone JSON backup.',
        'Use "Import JSON" to restore your snippets on any computer or reset to an earlier snapshot.',
        'Optionally sign in with Google to synchronize your snippets with Firebase Firestore in the cloud.',
      ],
      tips: [
        'Even if your browser cache is cleared, your snippets remain safe inside snippets-data.json on disk.',
      ],
    },
    {
      id: 'mobile-control-center',
      category: 'Mobile Experience',
      title: 'Mobile Control Center & Sleek Layout',
      subtitle: 'Clean uncluttered header and dedicated touch drawer',
      icon: Smartphone,
      badge: 'Mobile Optimized',
      screenshot: '/screenshots/mobile_control_center.png',
      screenshotCaption: 'Touch-optimized Mobile Control Center bottom sheet with quick tool grid',
      details:
        'Designed specifically for smartphone screens, BitStream declutters the mobile navigation bar into an ultra-clean header with just the brand, a Clip button, and a unified Control Center menu.',
      steps: [
        'On mobile devices (< 768px), view the clean header with only the BitStream logo and 2 sleek action buttons.',
        'Tap the ☰ Menu button to slide open the Mobile Control Center from the bottom.',
        'Check Spotify connection status with a single glance.',
        'Use the 2×2 Quick Action grid to access Clip, Theme, Release Notes, or Library Backup in 1 tap.',
        'Monitor local disk DB synchronization and lock the app when needed.',
      ],
      tips: [
        'Swipe down or tap the backdrop to quickly dismiss the Control Center drawer.',
      ],
    },
    {
      id: 'release-notes',
      category: 'Environment Tracking',
      title: 'Release Notes & Bug Tracker',
      subtitle: 'Local database tracker for Stage :3100 vs Production :4100',
      icon: Layers,
      badge: 'DevOps / QA',
      screenshot: '/screenshots/release_notes_tracker.png',
      screenshotCaption: 'Interactive Release Notes & Bug Tracker tracking versions and resolved issues',
      details:
        'BitStream maintains a self-contained local tracking database (releases-data.json) to monitor environment versions (Stage on Port 3100 vs Production on Port 4100), active bugs, and feature enhancements.',
      steps: [
        'Click the purple "Stage :3100" badge in the navbar or "Release Notes" in the menu.',
        'Filter entries by All, Enhancements, or Bugs.',
        'Review current stage enhancements (e.g., Neon theme, Web Audio EQ, Mobile HTTPS OAuth, Sleek Mobile View).',
        'Verify resolution steps and root causes documented for every reported issue.',
      ],
      tips: [
        'All new bugs or enhancement entries are automatically assigned "open" status so they can be prioritized and resolved.',
      ],
    },
    {
      id: 'keyboard-shortcuts',
      category: 'Productivity',
      title: 'Keyboard Shortcuts Reference',
      subtitle: 'Pro hotkeys for instant playback control',
      icon: Command,
      badge: 'Power User',
      screenshot: '/screenshots/now_playing_visualizer.png',
      screenshotCaption: 'Use global keyboard shortcuts anywhere in the application',
      details:
        'BitStream provides global keyboard shortcuts that let you control playback, queueing, and navigation without touching your mouse.',
      steps: [
        'Spacebar: Play or Pause active music snippet.',
        'Right Arrow (→) or Ctrl + →: Skip to next snippet highlight.',
        'Left Arrow (←) or Ctrl + ←: Return to previous snippet highlight.',
        'M: Toggle mute / unmute.',
        'L: Favorite / Liked toggle for currently playing snippet.',
        'F: Expand / Collapse full-screen Now Playing modal.',
        'Escape: Close open modals, drawers, or Now Playing screen.',
      ],
      shortcuts: [
        { key: 'Space', action: 'Play / Pause snippet' },
        { key: '→', action: 'Next snippet highlight' },
        { key: '←', action: 'Previous snippet highlight' },
        { key: 'M', action: 'Mute / Unmute audio' },
        { key: 'L', action: 'Like / Favorite snippet' },
        { key: 'F', action: 'Toggle Now Playing modal' },
        { key: 'Esc', action: 'Close dialogs & modals' },
      ],
      tips: [
        'Shortcuts are automatically disabled when typing in search bars or text inputs.',
      ],
    },
  ];

  // Filter sections by search query
  const filteredSections = sections.filter((sec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sec.title.toLowerCase().includes(q) ||
      sec.subtitle.toLowerCase().includes(q) ||
      sec.category.toLowerCase().includes(q) ||
      sec.details.toLowerCase().includes(q) ||
      sec.steps.some((s) => s.toLowerCase().includes(q))
    );
  });

  // Group sections by category for the sidebar
  const categories = Array.from(new Set(sections.map((s) => s.category)));

  // Scroll to section smoothly
  const handleScrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setIsMobileNavOpen(false);
    const element = document.getElementById(`guide-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Scroll Spy: observe sections in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('guide-', '');
            setActiveSectionId(id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    sections.forEach((sec) => {
      const el = document.getElementById(`guide-${sec.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Sticky Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-2xl border-b border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={onClose}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] text-slate-200 hover:text-white transition active:scale-95 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Return to BitStream Music Player"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Player</span>
            </button>

            <div className="h-4 w-px bg-white/10 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-xl p-0.5 shadow-md shrink-0"
                style={{
                  background: `linear-gradient(135deg, var(--theme-accent), var(--theme-accent-hover))`,
                }}
              >
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center theme-text-accent">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <h1 className="text-xs sm:text-sm font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span>Product User Guide</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono text-[9px] font-bold">
                    v2.0 Stage
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Right: Quick actions */}
          <div className="flex items-center gap-2">
            {/* Mobile TOC Button */}
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-white/[0.08] text-slate-200 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <Menu className="w-4 h-4" />
              <span className="text-[11px]">Menu</span>
            </button>

            {/* Stage Port Indicator */}
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 border border-white/[0.06] text-[11px] font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Port :3100</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout: Sticky Sidebar (Left) + Scrolling Content (Right) */}
      <div className="max-w-7xl w-full mx-auto px-3 sm:px-6 flex-1 flex gap-6 py-4 sm:py-6">
        {/* ======================================================== */}
        {/* LEFT STICKY NAVIGATION MENU (Desktop: lg+)               */}
        {/* ======================================================== */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 sticky top-20 h-[calc(100vh-6rem)] bg-slate-900/60 border border-white/[0.06] rounded-2xl p-3 shadow-xl overflow-hidden">
          {/* Sidebar Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search features..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Navigation Links grouped by Category */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
            {categories.map((cat) => {
              const catSections = filteredSections.filter((s) => s.category === cat);
              if (catSections.length === 0) return null;

              return (
                <div key={cat} className="space-y-1">
                  <div className="px-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {cat}
                  </div>
                  <div className="space-y-0.5">
                    {catSections.map((sec) => {
                      const Icon = sec.icon;
                      const isActive = activeSectionId === sec.id;

                      return (
                        <button
                          key={sec.id}
                          onClick={() => handleScrollToSection(sec.id)}
                          className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between transition cursor-pointer group ${
                            isActive
                              ? 'theme-bg-soft theme-text-accent font-bold border border-white/[0.08] shadow-sm'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isActive ? 'theme-text-accent' : 'text-slate-400 group-hover:text-slate-200'
                              }`}
                            />
                            <span className="truncate">{sec.title}</span>
                          </div>
                          {sec.badge && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                              {sec.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Quick Return */}
          <div className="pt-3 border-t border-white/[0.06] mt-2">
            <button
              onClick={onClose}
              className="w-full py-2 px-3 rounded-xl theme-btn-primary font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Music Player</span>
            </button>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* MOBILE SLIDE-OVER NAVIGATION DRAWER                      */}
        {/* ======================================================== */}
        {isMobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setIsMobileNavOpen(false)}
            />

            {/* Sidebar Sheet */}
            <div className="relative w-72 max-w-[85vw] bg-slate-950 border-r border-white/[0.1] h-full p-4 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 theme-text-accent" />
                  <span>Guide Topics</span>
                </span>
                <button
                  onClick={() => setIsMobileNavOpen(false)}
                  className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation links */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {categories.map((cat) => (
                  <div key={cat} className="space-y-1">
                    <div className="px-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {cat}
                    </div>
                    <div className="space-y-0.5">
                      {sections
                        .filter((s) => s.category === cat)
                        .map((sec) => (
                          <button
                            key={sec.id}
                            onClick={() => handleScrollToSection(sec.id)}
                            className={`w-full px-2 py-1.5 rounded-xl text-left text-xs flex items-center justify-between ${
                              activeSectionId === sec.id
                                ? 'theme-bg-soft theme-text-accent font-bold'
                                : 'text-slate-300 hover:text-white hover:bg-slate-900'
                            }`}
                          >
                            <span className="truncate">{sec.title}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MAIN SCROLLABLE CONTENT (Right side)                     */}
        {/* ======================================================== */}
        <main ref={contentContainerRef} className="flex-1 min-w-0 space-y-10 sm:space-y-14 pb-24">
          {/* Guide Introduction Hero Banner */}
          <div className="p-4 sm:p-6 bg-gradient-to-br from-purple-950/40 via-slate-900/80 to-slate-950 border border-white/[0.08] rounded-2xl sm:rounded-3xl shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] font-mono">
                Complete User Guide
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold text-[10px] font-mono">
                Interactive Reference
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Spotify BitStream Feature Guide & Documentation
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              Welcome to the complete feature reference manual for Spotify BitStream. Every capability—from Spotify Connect OAuth, dual waveform clipping, and 32-band audio spectrums to our sleek mobile control center—is documented with high-resolution visual demonstrations.
            </p>
          </div>

          {/* Section Items */}
          {filteredSections.map((sec) => {
            const Icon = sec.icon;

            return (
              <section
                key={sec.id}
                id={`guide-${sec.id}`}
                className="scroll-mt-20 p-4 sm:p-6 bg-slate-900/40 border border-white/[0.06] rounded-2xl sm:rounded-3xl space-y-4 shadow-lg transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/[0.06]">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl p-0.5 shadow-md shrink-0 mt-0.5"
                      style={{
                        background: `linear-gradient(135deg, var(--theme-accent), var(--theme-accent-hover))`,
                      }}
                    >
                      <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center theme-text-accent">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          {sec.category}
                        </span>
                        {sec.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[9px] font-bold">
                            {sec.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                        {sec.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{sec.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Conceptual Details */}
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{sec.details}</p>

                {/* High-Resolution Screenshot Demonstration */}
                {sec.screenshot && (
                  <div className="space-y-1.5 pt-1">
                    <div
                      className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-white/[0.1] bg-slate-950/80 shadow-2xl group cursor-pointer"
                      onClick={() =>
                        setLightboxImage({
                          src: sec.screenshot!,
                          caption: sec.screenshotCaption || sec.title,
                        })
                      }
                      title="Click to expand screenshot in full lightbox"
                    >
                      <img
                        src={sec.screenshot}
                        alt={sec.title}
                        className="w-full h-auto max-h-[460px] object-contain sm:object-cover group-hover:scale-[1.01] transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-bold pointer-events-none">
                        <Maximize2 className="w-5 h-5" />
                        <span>Click to Enlarge</span>
                      </div>
                    </div>
                    {sec.screenshotCaption && (
                      <p className="text-[11px] text-slate-400 italic text-center">
                        📷 {sec.screenshotCaption}
                      </p>
                    )}
                  </div>
                )}

                {/* Step-by-Step Instructions */}
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 theme-text-accent" />
                    <span>How To Use This Feature</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300 pl-1">
                    {sec.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Shortcuts Table (if applicable) */}
                {sec.shortcuts && (
                  <div className="p-3 bg-slate-950/60 border border-white/[0.06] rounded-xl space-y-2">
                    <div className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Command className="w-3.5 h-3.5 text-purple-400" />
                      <span>Keyboard Shortcuts</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {sec.shortcuts.map((sc, scIdx) => (
                        <div
                          key={scIdx}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-white/[0.04]"
                        >
                          <span className="text-slate-300">{sc.action}</span>
                          <kbd className="px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[11px] font-bold border border-white/10">
                            {sc.key}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pro Tips / Highlights */}
                {sec.tips && sec.tips.length > 0 && (
                  <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-xl space-y-1">
                    <div className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Pro-Tips & Implementation Details</span>
                    </div>
                    <ul className="space-y-1 text-xs text-slate-300 pl-5 list-disc">
                      {sec.tips.map((tip, tipIdx) => (
                        <li key={tipIdx} className="leading-relaxed">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          })}

          {/* Bottom Call to Action */}
          <div className="p-6 bg-slate-900/60 border border-white/[0.06] rounded-3xl text-center space-y-3">
            <h3 className="text-lg font-bold text-white">Ready to Enjoy Your Music Highlights?</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Jump straight into the player to listen to your curated snippets, clip new tracks, or test multi-device synchronization.
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl theme-btn-primary font-bold text-xs inline-flex items-center gap-2 shadow-lg active:scale-95 transition cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Return to BitStream Player</span>
            </button>
          </div>
        </main>
      </div>

      {/* ======================================================== */}
      {/* FULLSCREEN LIGHTBOX MODAL FOR EXPANDED SCREENSHOTS       */}
      {/* ======================================================== */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-10 right-0 p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxImage.src}
              alt="Expanded view"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl border border-white/20 shadow-2xl object-contain"
            />
            <p className="text-xs text-slate-300 text-center mt-3 font-medium">
              {lightboxImage.caption}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
