import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Laptop,
  Database,
  Save,
  RotateCcw,
  X,
  ShieldAlert,
  ArrowRight,
  HardDrive,
  Info,
} from 'lucide-react';
import {
  getActiveFirebaseConfig,
  saveCustomFirebaseConfig,
  resetFirebaseConfig,
  hasCustomFirebaseConfig,
} from '../services/firebase';

interface FirebaseAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorCode?: string | null;
  onSelectLocalMode: () => void;
}

export const FirebaseAuthModal: React.FC<FirebaseAuthModalProps> = ({
  isOpen,
  onClose,
  errorCode,
  onSelectLocalMode,
}) => {
  const currentConfig = getActiveFirebaseConfig();
  const isCustom = hasCustomFirebaseConfig();

  const [activeTab, setActiveTab] = useState<'local' | 'custom' | 'console'>('local');
  const [configJson, setConfigJson] = useState<string>(() =>
    JSON.stringify(currentConfig, null, 2)
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  if (!isOpen) return null;

  const handleCopyLocalhost = () => {
    navigator.clipboard.writeText('localhost');
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2000);
  };

  const handleSaveCustomConfig = () => {
    try {
      setParseError(null);
      const parsed = JSON.parse(configJson);
      if (!parsed.projectId || !parsed.apiKey) {
        setParseError('Config must include at least "projectId" and "apiKey".');
        return;
      }
      saveCustomFirebaseConfig(parsed);
    } catch (err: any) {
      setParseError(err?.message || 'Invalid JSON format');
    }
  };

  const handleResetConfig = () => {
    resetFirebaseConfig();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white">Google Sign-In Resolution</h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-mono font-semibold">
                  {errorCode || 'auth/unauthorized-domain'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Why this happens: Firebase security forbids OAuth popup logins on domains that aren't on its project allowlist. The default AI Studio project only authorizes cloud URLs, not <code className="text-amber-300 font-mono">localhost</code>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-4 bg-slate-950/30 border-b border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('local')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'local'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>1. Local Storage (Recommended)</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'custom'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>2. Custom Firebase Project</span>
          </button>
          <button
            onClick={() => setActiveTab('console')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'console'
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>3. Firebase Console Guide</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Laptop className="w-4 h-4" />
                  <span>Zero Configuration Needed</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Spotify BitStream is already fully configured to run offline and locally. Your snippets, custom playlists, tags, and Spotify API tokens are safely saved to:
                </p>
                <ul className="text-xs text-slate-300 space-y-1 pl-4 list-disc">
                  <li><strong className="text-white">Browser LocalStorage:</strong> Instant access across browser reloads.</li>
                  <li><strong className="text-white">Server Disk Storage:</strong> Automatically saved to <code className="text-emerald-300 font-mono">snippets-data.json</code> on your machine.</li>
                </ul>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-white">Continue in Local Mode</h4>
                  <p className="text-xs text-slate-400">
                    Dismiss the cloud login banner and use all playback and clipping features right away.
                  </p>
                </div>
                <button
                  onClick={() => {
                    onSelectLocalMode();
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 shrink-0"
                >
                  <span>Use Local Storage</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-300 leading-relaxed">
                If you want to sync snippets across devices using your own Google account, paste your own Firebase Web App configuration from your Firebase project console.
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-slate-300">Firebase App Config (JSON)</label>
                  {isCustom && (
                    <span className="text-emerald-400 font-medium text-[11px]">
                      Currently using custom config
                    </span>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-300 focus:outline-none focus:border-emerald-500/50"
                  placeholder='{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "..."\n}'
                />
                {parseError && (
                  <p className="text-rose-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {parseError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                {isCustom ? (
                  <button
                    onClick={handleResetConfig}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to Default Config
                  </button>
                ) : (
                  <div />
                )}
                <button
                  onClick={handleSaveCustomConfig}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save & Reload App
                </button>
              </div>
            </div>
          )}

          {activeTab === 'console' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-300">
                If you are the owner of the Firebase project or have access to the Firebase Console:
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-white">Go to Firebase Console</p>
                    <p className="text-slate-400">
                      Open <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-1">console.firebase.google.com <ExternalLink className="w-3 h-3" /></a> and select your project (<code className="text-slate-300 font-mono">{currentConfig.projectId}</code>).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-white">Navigate to Authentication Settings</p>
                    <p className="text-slate-400">
                      Click <strong className="text-white">Authentication</strong> in the left sidebar, click the <strong className="text-white">Settings</strong> tab, then scroll to <strong className="text-white">Authorized domains</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div className="text-xs text-slate-300 space-y-2 flex-1">
                    <p className="font-semibold text-white">Add "localhost"</p>
                    <p className="text-slate-400">
                      Click <strong className="text-white">Add domain</strong> and enter:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl font-mono text-emerald-300 text-xs">
                        localhost
                      </code>
                      <button
                        onClick={handleCopyLocalhost}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
                      >
                        {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Local Mode works without needing any internet account credentials.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
