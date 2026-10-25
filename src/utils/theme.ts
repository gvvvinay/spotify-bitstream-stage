export type ThemeId = 'neonnights' | 'emerald' | 'amethyst' | 'rose' | 'cyber' | 'amber';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  bgPreview: string;
  dotClass: string;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'neonnights',
    name: 'Neon Nights',
    tagline: 'Dark midnight with purple gradients and electric blue accents',
    primaryColor: '#8b5cf6',
    accentColor: '#00f0ff',
    bgPreview: '#070512',
    dotClass: 'bg-cyan-400',
  },
  {
    id: 'emerald',
    name: 'Spotify Emerald',
    tagline: 'Classic deep obsidian with electric mint green',
    primaryColor: '#10b981',
    accentColor: '#34d399',
    bgPreview: '#07090e',
    dotClass: 'bg-emerald-500',
  },
  {
    id: 'amethyst',
    name: 'Midnight Amethyst',
    tagline: 'Deep velvet violet with neon purple glows',
    primaryColor: '#a855f7',
    accentColor: '#c084fc',
    bgPreview: '#080612',
    dotClass: 'bg-purple-500',
  },
  {
    id: 'rose',
    name: 'Sunset Rose',
    tagline: 'Dark burgundy with radiant neon coral rose',
    primaryColor: '#f43f5e',
    accentColor: '#fb7185',
    bgPreview: '#0e060a',
    dotClass: 'bg-rose-500',
  },
  {
    id: 'cyber',
    name: 'Cyber Azure',
    tagline: 'Oceanic abyss with electric synthwave cyan',
    primaryColor: '#06b6d4',
    accentColor: '#22d3ee',
    bgPreview: '#040812',
    dotClass: 'bg-cyan-500',
  },
  {
    id: 'amber',
    name: 'Solar Amber',
    tagline: 'Espresso onyx with molten gold vinyl warmth',
    primaryColor: '#f59e0b',
    accentColor: '#fbbf24',
    bgPreview: '#0c0904',
    dotClass: 'bg-amber-500',
  },
];

const STORAGE_KEY_THEME = 'bitstream_active_theme_v1';

export function getStoredTheme(): ThemeId {
  try {
    const val = localStorage.getItem(STORAGE_KEY_THEME);
    if (val && THEMES.some((t) => t.id === val)) {
      return val as ThemeId;
    }
  } catch (e) {}
  return 'neonnights';
}

export function saveStoredTheme(themeId: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY_THEME, themeId);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', themeId);
    }
  } catch (e) {}
}

export function applyTheme(themeId: ThemeId): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', themeId);
  }
}
