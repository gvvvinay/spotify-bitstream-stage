import React from 'react';
import { X, Check, Palette, Sparkles } from 'lucide-react';
import { THEMES, ThemeId } from '../utils/theme';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  currentTheme: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  currentTheme,
  onSelectTheme,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-slate-950 border border-white/[0.08] rounded-3xl shadow-2xl p-5 sm:p-6 overflow-hidden text-slate-100 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/[0.08] flex items-center justify-center theme-text-accent">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Select Theme
              </h3>
              <p className="text-xs text-slate-400">Choose from curated visual themes including Neon Nights</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-900 text-slate-400 hover:text-white transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Cards List */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
          {THEMES.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => {
                  onSelectTheme(theme.id);
                }}
                className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 active:scale-[0.98] cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900/90 border-white/[0.2] ring-1 ring-white/[0.15] shadow-lg'
                    : 'bg-slate-900/40 hover:bg-slate-900/70 border-white/[0.05] hover:border-white/[0.1]'
                }`}
              >
                {/* Left: Swatch circle + Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md border border-white/[0.1]"
                    style={{ backgroundColor: theme.bgPreview }}
                  >
                    <span
                      className="w-4 h-4 rounded-full shadow-sm"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white truncate">{theme.name}</span>
                      {isSelected && (
                        <span
                          className="px-1.5 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: `${theme.primaryColor}20`,
                            color: theme.primaryColor,
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{theme.tagline}</p>
                  </div>
                </div>

                {/* Right: Color Preview Pill or Check */}
                <div className="shrink-0 flex items-center gap-2">
                  <div className="flex items-center -space-x-1">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-950 shadow-sm"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-950 shadow-sm opacity-80"
                      style={{ backgroundColor: theme.accentColor }}
                    />
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                      isSelected
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'border border-slate-700 opacity-30'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <span>Theme syncs automatically across your sessions.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
