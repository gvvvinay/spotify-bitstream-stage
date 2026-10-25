import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Bug,
  Rocket,
  Layers,
  Search,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Server,
  Terminal,
  Activity,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { ReleaseItem, ReleaseVersion, ReleaseResponse, ReleaseItemType, ReleaseEnvironment, ReleaseItemStatus } from '../types';

interface ReleaseNotesViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReleaseNotesView: React.FC<ReleaseNotesViewProps> = ({
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<ReleaseResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [envFilter, setEnvFilter] = useState<'all' | 'stage' | 'production' | 'compare'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'bug' | 'enhancement'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // New Item Form State
  const [newType, setNewType] = useState<ReleaseItemType>('bug');
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Feature');
  const [newModule, setNewModule] = useState<string>('');
  const [newEnv, setNewEnv] = useState<ReleaseEnvironment>('stage');
  const [newVersion, setNewVersion] = useState<string>('v2.0.0');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newResolution, setNewResolution] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch from local database API
  const fetchReleases = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/releases');
      if (res.ok) {
        const json: ReleaseResponse = await res.json();
        setData(json);
      }
    } catch (e) {
      console.warn('Could not fetch /api/releases from server:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReleases();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter items based on environment, type, status, and search query
  const items = data?.items || [];
  const filteredItems = items.filter((item) => {
    if (envFilter === 'stage' && item.environment !== 'stage' && item.environment !== 'both') {
      return false;
    }
    if (envFilter === 'production' && item.environment !== 'production' && item.environment !== 'both') {
      return false;
    }
    if (typeFilter !== 'all' && item.type !== typeFilter) {
      return false;
    }
    if (statusFilter === 'open' && item.status !== 'open' && item.status !== 'in_progress') {
      return false;
    }
    if (statusFilter === 'resolved' && item.status !== 'resolved' && item.status !== 'implemented') {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = `${item.id} ${item.title} ${item.category} ${item.module} ${item.description} ${item.resolution || ''} ${item.rootCause || ''} ${item.status}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/releases/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          title: newTitle.trim(),
          category: newCategory.trim() || (newType === 'bug' ? 'Bug Fix' : 'Feature'),
          module: newModule.trim() || 'App.tsx',
          environment: newEnv,
          version: newVersion,
          description: newDesc.trim(),
          resolution: newResolution.trim() || undefined,
          // CRITICAL: Always default new entries to 'open' so they can be tracked, investigated, and fixed!
          status: 'open',
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewResolution('');
        setNewModule('');
        fetchReleases();
      }
    } catch (e) {
      console.error('Failed creating release item:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (itemId: string, newStatus: ReleaseItemStatus, resolution?: string) => {
    try {
      const res = await fetch(`/api/releases/items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          resolution: resolution !== undefined ? resolution : undefined,
        }),
      });
      if (res.ok) {
        fetchReleases();
      }
    } catch (e) {
      console.error('Failed updating item status:', e);
    }
  };

  const handleDownloadCSV = () => {
    window.open('/bitstream_tracker.tsv', '_blank');
  };

  const stats = data?.stats || {
    total: 0,
    bugs: 0,
    enhancements: 0,
    resolvedBugs: 0,
    openBugs: 0,
    openEnhancements: 0,
    totalOpen: 0,
    resolvedTotal: 0,
    resolutionRate: '100%',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[92vh] max-h-[920px] bg-slate-950 border border-white/[0.1] rounded-3xl flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* 1. Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0 bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-md shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  Release Notes & Environment Tracker
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Local DB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Track versions, bug fixes, and feature diff between Stage and Production
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Add Entry Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-2.5 py-1.5 rounded-xl theme-btn-primary text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
              title="Add Bug or Enhancement to Local DB"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Entry</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Close Release Notes"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 scrollbar-thin">
          
          {/* Environment Cards Hero */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Card 1: Stage Environment (Port 3100) */}
            <div className="relative rounded-2xl p-4 bg-gradient-to-br from-purple-950/50 via-slate-900/80 to-slate-900 border border-purple-500/30 shadow-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Preview Stage
                </span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  Port 3100
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>v2.0.0-neon-preview</span>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Major UI Overhaul, Web Audio Engine, Lyrics & Playback Features
                </p>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-purple-300 font-semibold">15 Enhancements</span>
                <span className="text-slate-400 font-mono text-[11px]">Active Preview</span>
              </div>
            </div>

            {/* Card 2: Production Environment (Port 4100) */}
            <div className="relative rounded-2xl p-4 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900 border border-emerald-500/30 shadow-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Live Production
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Port 4100
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>v1.0.0-stable</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Stable Core Release (Point A/B Clipper, Auth Gate & Cloud Sync)
                </p>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-emerald-300 font-semibold">Untouched & Intact</span>
                <span className="text-slate-400 font-mono text-[11px]">79 Snippets</span>
              </div>
            </div>

            {/* Card 3: Tracker Health Scorecard */}
            <div className="rounded-2xl p-4 bg-slate-900/70 border border-white/[0.08] flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Local Database Health</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300">
                  releases-data.json
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center py-1">
                <div className="bg-slate-950/80 rounded-xl p-2 border border-white/[0.04]">
                  <div className="text-base sm:text-lg font-bold text-white">{stats.total}</div>
                  <div className="text-[10px] text-slate-400">Total</div>
                </div>
                <div
                  onClick={() => setStatusFilter(statusFilter === 'open' ? 'all' : 'open')}
                  className={`rounded-xl p-2 border cursor-pointer transition active:scale-95 ${
                    (stats.totalOpen || 0) > 0
                      ? 'bg-amber-950/40 border-amber-500/40 hover:bg-amber-950/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                      : 'bg-slate-950/80 border-white/[0.04]'
                  }`}
                  title="Click to view open items"
                >
                  <div className="text-base sm:text-lg font-bold text-amber-400 flex items-center justify-center gap-1">
                    {stats.totalOpen ?? (stats.openBugs || 0) + (stats.openEnhancements || 0)}
                    {(stats.totalOpen || 0) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />}
                  </div>
                  <div className="text-[10px] text-amber-300 font-semibold truncate">Open to Fix</div>
                </div>
                <div className="bg-slate-950/80 rounded-xl p-2 border border-white/[0.04]">
                  <div className="text-base sm:text-lg font-bold text-rose-400">{stats.bugs}</div>
                  <div className="text-[10px] text-slate-400 truncate">Bugs ({stats.openBugs || 0} open)</div>
                </div>
                <div className="bg-slate-950/80 rounded-xl p-2 border border-white/[0.04]">
                  <div className="text-base sm:text-lg font-bold text-cyan-400">{stats.enhancements}</div>
                  <div className="text-[10px] text-slate-400 truncate">Features</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Verification Pass Rate</span>
                <span className="font-bold text-emerald-400">{stats.resolutionRate}</span>
              </div>
            </div>
          </div>

          {/* 3. Filter Row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-900/50 border border-white/[0.06] rounded-2xl p-3">
            
            {/* Environment Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
              <button
                onClick={() => setEnvFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  envFilter === 'all'
                    ? 'theme-btn-primary shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.06]'
                }`}
              >
                All Envs ({items.length})
              </button>
              <button
                onClick={() => setEnvFilter('stage')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  envFilter === 'stage'
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.06]'
                }`}
              >
                Stage (Port 3100)
              </button>
              <button
                onClick={() => setEnvFilter('production')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  envFilter === 'production'
                    ? 'bg-emerald-600 text-white font-bold shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.06]'
                }`}
              >
                Production (Port 4100)
              </button>
              <button
                onClick={() => setEnvFilter('compare')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                  envFilter === 'compare'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/[0.06]'
                }`}
              >
                Diff Matrix
              </button>
            </div>

            {/* Status & Type Filters & Search */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter Pill Group */}
              <div className="flex items-center gap-1 bg-slate-950 rounded-xl p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setStatusFilter('open')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'open'
                      ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50 shadow-sm'
                      : (stats.totalOpen || 0) > 0
                      ? 'text-amber-400 hover:text-amber-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Show Open Bugs & Enhancements waiting to be fixed"
                >
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span>Open ({stats.totalOpen || 0})</span>
                </button>
                <button
                  onClick={() => setStatusFilter('resolved')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'resolved'
                      ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Resolved</span>
                </button>
              </div>

              {/* Type Filters */}
              <div className="flex items-center gap-1 bg-slate-950 rounded-xl p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    typeFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Types
                </button>
                <button
                  onClick={() => setTypeFilter('bug')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                    typeFilter === 'bug' ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40' : 'text-slate-400 hover:text-rose-400'
                  }`}
                >
                  <Bug className="w-3 h-3" />
                  <span>Bugs ({stats.bugs})</span>
                </button>
                <button
                  onClick={() => setTypeFilter('enhancement')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                    typeFilter === 'enhancement' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'text-slate-400 hover:text-purple-400'
                  }`}
                >
                  <Rocket className="w-3 h-3" />
                  <span>Features ({stats.enhancements})</span>
                </button>
              </div>

              {/* Search input */}
              <div className="relative min-w-[130px] sm:min-w-[170px]">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search tracker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-slate-950 border border-white/[0.08] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* 4. Comparison Matrix Mode */}
          {envFilter === 'compare' ? (
            <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-slate-950/60 shadow-xl">
              <div className="p-3.5 bg-slate-900 border-b border-white/[0.08] flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Environment Feature & Capability Matrix</h4>
                  <p className="text-xs text-slate-400">Direct capability diff between Production (Port 4100) and Stage (Port 3100)</p>
                </div>
                <span className="text-xs font-mono font-semibold text-cyan-400">Side-by-Side</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-white/[0.06]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Capability / Component</th>
                      <th className="py-2.5 px-4 font-semibold text-emerald-400">Production (Port 4100)</th>
                      <th className="py-2.5 px-4 font-semibold text-purple-400">Stage (Port 3100)</th>
                      <th className="py-2.5 px-4 font-semibold">Status / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">UI Theme</td>
                      <td className="py-2.5 px-4 text-slate-300">Default Dark Themes</td>
                      <td className="py-2.5 px-4 text-purple-300 font-semibold">Flagship Neon Nights (Violet & Cyan Glow)</td>
                      <td className="py-2.5 px-4 text-emerald-400">Enhanced</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Now Playing Screen</td>
                      <td className="py-2.5 px-4 text-slate-400">Bottom Player Bar only</td>
                      <td className="py-2.5 px-4 text-purple-300 font-semibold">Full Modal with Vinyl Animation & Tabs</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Audio Visualizer</td>
                      <td className="py-2.5 px-4 text-slate-500">Not Present</td>
                      <td className="py-2.5 px-4 text-cyan-300 font-semibold">32-Band Canvas AnalyserNode Visualizer</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Lyrics Service</td>
                      <td className="py-2.5 px-4 text-slate-500">Not Present</td>
                      <td className="py-2.5 px-4 text-purple-300 font-semibold">Real-Time Synced & Plain Lyrics via LRCLIB</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Equalizer (EQ)</td>
                      <td className="py-2.5 px-4 text-slate-500">Flat standard audio</td>
                      <td className="py-2.5 px-4 text-purple-300 font-semibold">3-Band Parametric EQ + 6 Presets + Audition</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Sleep Timer</td>
                      <td className="py-2.5 px-4 text-slate-500">Not Present</td>
                      <td className="py-2.5 px-4 text-purple-300 font-semibold">15m / 30m / 45m / 60m Auto-Pause Timer</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Mini-Player Scrub Line</td>
                      <td className="py-2.5 px-4 text-slate-400">Compact line</td>
                      <td className="py-2.5 px-4 text-purple-300 font-semibold">Full-Width Interactive Top Scrub Line</td>
                      <td className="py-2.5 px-4 text-emerald-400">Enhanced</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Liked Bits / Favorites</td>
                      <td className="py-2.5 px-4 text-slate-500">Not Flagged</td>
                      <td className="py-2.5 px-4 text-rose-300 font-semibold">1-Tap Heart + '❤️ Liked' Top Tab Pill</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Recently Played</td>
                      <td className="py-2.5 px-4 text-slate-500">Not Tracked</td>
                      <td className="py-2.5 px-4 text-purple-300 font-semibold">Auto-Tracked + '🕒 Recent' Top Tab Pill</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Queue Management</td>
                      <td className="py-2.5 px-4 text-slate-400">Linear / Shuffle only</td>
                      <td className="py-2.5 px-4 text-purple-300 font-semibold">'Play Next' & 'Add to Queue' + Reorder Manager</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Keyboard Shortcuts</td>
                      <td className="py-2.5 px-4 text-slate-500">None</td>
                      <td className="py-2.5 px-4 text-cyan-300 font-semibold">Space, Arrows, M (mute), L (like), F, Esc</td>
                      <td className="py-2.5 px-4 text-emerald-400">New Feature</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 font-medium text-white">Authentication Gate</td>
                      <td className="py-2.5 px-4 text-emerald-400">Active (admin/bitstream4100)</td>
                      <td className="py-2.5 px-4 text-emerald-400">Active (admin/bitstream4100)</td>
                      <td className="py-2.5 px-4 text-emerald-400">Both Environments</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* 5. Standard Tracker List Mode */
            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-dashed border-white/[0.08] text-slate-400">
                  No bugs or enhancements match your current filter.
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const isBug = item.type === 'bug';

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl p-3.5 sm:p-4 border transition duration-150 ${
                        isBug
                          ? 'bg-slate-900/40 hover:bg-slate-900/70 border-rose-500/20'
                          : 'bg-slate-900/40 hover:bg-slate-900/70 border-purple-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {/* Type Icon Badge */}
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isBug
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {isBug ? <Bug className="w-3.5 h-3.5" /> : <Rocket className="w-3.5 h-3.5" />}
                          </div>

                          <div className="min-w-0">
                            {/* Top Badges */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded-md border border-white/[0.06]">
                                {item.id}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded-md border border-white/[0.04]">
                                {item.category}
                              </span>
                              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded-md border border-cyan-800/40">
                                {item.module}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                                  item.environment === 'stage'
                                    ? 'bg-purple-950/60 text-purple-300 border-purple-800/40'
                                    : item.environment === 'production'
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                                    : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40'
                                }`}
                              >
                                {item.environment.toUpperCase()} ({item.version})
                              </span>
                            </div>

                            {/* Title */}
                            <h4 className="text-sm font-bold text-white mt-1 leading-snug">
                              {item.title}
                            </h4>

                            {/* Description */}
                            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Expand / Details Toggle */}
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'open' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                              <AlertCircle className="w-3 h-3 text-amber-400 animate-pulse" />
                              <span>OPEN</span>
                            </span>
                          ) : item.status === 'in_progress' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-blue-400" />
                              <span>IN PROGRESS</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>{item.status.toUpperCase()}</span>
                            </span>
                          )}
                          <button
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                            title={isExpanded ? 'Collapse' : 'View root cause & resolution'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Root Cause, Resolution & Status Workflow */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3 animate-in fade-in duration-150 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {item.rootCause && (
                              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-white/[0.04]">
                                <div className="font-semibold text-rose-300 mb-1 flex items-center gap-1">
                                  <span>Root Cause / Requirement Context:</span>
                                </div>
                                <p className="text-slate-400 leading-relaxed">{item.rootCause}</p>
                              </div>
                            )}
                            {item.resolution ? (
                              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-white/[0.04]">
                                <div className="font-semibold text-emerald-300 mb-1 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Resolution / Implementation Details:</span>
                                </div>
                                <p className="text-slate-400 leading-relaxed">{item.resolution}</p>
                              </div>
                            ) : (
                              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-amber-500/20 bg-amber-950/10">
                                <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Status: Pending Investigation & Fix</span>
                                </div>
                                <p className="text-amber-200/70 leading-relaxed">This item is currently OPEN in the backlog waiting to be addressed.</p>
                              </div>
                            )}
                          </div>

                          {/* Quick Workflow Action Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-950/50 border border-white/[0.04]">
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                              <span>Workflow Status:</span>
                              <span className="font-bold text-white uppercase">{item.status.replace('_', ' ')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {item.status === 'open' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/50 transition cursor-pointer flex items-center gap-1"
                                >
                                  <Clock className="w-3 h-3" /> Mark In Progress
                                </button>
                              )}
                              {(item.status === 'open' || item.status === 'in_progress') && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(item.id, item.type === 'bug' ? 'resolved' : 'implemented', 'Verified and fixed in stage environment')}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50 transition cursor-pointer flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Mark Fixed & Resolved
                                </button>
                              )}
                              {(item.status === 'resolved' || item.status === 'implemented') && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(item.id, 'open')}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-600/30 text-amber-300 border border-amber-500/40 hover:bg-amber-600/50 transition cursor-pointer flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" /> Reopen Bug / Issue
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* 3. Footer Bar with Quick Actions */}
        <div className="px-4 sm:px-6 py-3 border-t border-white/[0.08] bg-slate-900/60 flex flex-wrap items-center justify-between gap-2.5 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>DB File: stage/releases-data.json</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/[0.06] font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              title="Download TSV export"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download TSV</span>
            </button>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>

      {/* Add New Tracker Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-950 border border-white/[0.1] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Log New Bug or Enhancement</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="space-y-3 text-xs">
              {/* Automatic Open Status Notification Banner */}
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2.5 text-amber-300 text-xs">
                <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>Default Status:</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase">OPEN</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80 mt-0.5">
                    New entries are always created with status Open so they can be looked at, triaged, and fixed.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ReleaseItemType)}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="bug">🐛 Bug Fix</option>
                    <option value="enhancement">🚀 Enhancement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Environment</label>
                  <select
                    value={newEnv}
                    onChange={(e) => setNewEnv(e.target.value as ReleaseEnvironment)}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="stage">Stage (Port 3100)</option>
                    <option value="production">Production (Port 4100)</option>
                    <option value="both">Both Environments</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="Short, descriptive title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Playback UX, Theme, Auth"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Module / File</label>
                  <input
                    type="text"
                    placeholder="e.g. SnippetClipperModal.tsx"
                    value={newModule}
                    onChange={(e) => setNewModule(e.target.value)}
                    className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Description / Observed Problem</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Explain what is broken or what is needed"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Initial Notes / Workaround <span className="text-[10px] text-slate-500 font-normal">(Optional — can be added later)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional context or steps to reproduce"
                  value={newResolution}
                  onChange={(e) => setNewResolution(e.target.value)}
                  className="w-full bg-slate-900 border border-white/[0.08] rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-xl theme-btn-primary font-bold shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Creating...' : 'Create Entry (Open)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
