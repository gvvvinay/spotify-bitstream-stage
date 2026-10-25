export interface MashupSegment {
  snippetId: string;
  title: string;
  artist: string;
  albumArt: string;
  spotifyUri: string;
  trackId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  snippetName?: string;
}

export interface MusicSnippet {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  spotifyUri: string; // e.g. "spotify:track:4u7EnebtmKWzUH433cf5Qv"
  trackId: string;
  spotifyUrl: string;
  durationMs: number;
  startMs: number; // point A
  endMs: number; // point B
  snippetName: string;
  playlistId: string;
  notes?: string;
  tags?: string[];
  createdAt: number;
  previewUrl?: string;
  color?: string;
  isFavorite?: boolean;
  lyrics?: string;
  isMashup?: boolean;
  mashupSegments?: MashupSegment[];
}

export interface EqualizerSettings {
  bass: number; // -12 to 12 dB
  mid: number;  // -12 to 12 dB
  treble: number; // -12 to 12 dB
  preset: string;
}

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'warning' | 'heart';
}

export interface SnippetPlaylist {
  id: string;
  name: string;
  description: string;
  coverGradient: string;
  snippetIds: string[];
  createdAt: number;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images?: Array<{ url: string }>;
  product?: string;
}

export interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number;
}

export type PlaybackMode = 'linear' | 'repeat-snippet' | 'repeat-playlist' | 'shuffle';

export interface SpotifyTrackResult {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
  uri: string;
  external_urls: {
    spotify: string;
  };
  preview_url: string | null;
}

export type ReleaseItemType = 'bug' | 'enhancement';
export type ReleaseEnvironment = 'production' | 'stage' | 'both';

export type ReleaseItemStatus = 'open' | 'in_progress' | 'resolved' | 'implemented';

export interface ReleaseItem {
  id: string;
  type: ReleaseItemType;
  category: string;
  module: string;
  environment: ReleaseEnvironment;
  version: string;
  title: string;
  description: string;
  rootCause?: string;
  resolution?: string;
  status: ReleaseItemStatus;
  createdAt: number;
}

export interface ReleaseVersion {
  version: string;
  versionTag: string;
  environment: 'production' | 'stage';
  port: number;
  releaseDate: string;
  isCurrent: boolean;
  status: string;
  tagline: string;
  highlights: string[];
  itemIds: string[];
}

export interface ReleaseResponse {
  success: boolean;
  environment: 'stage' | 'production';
  currentPort: number;
  activeVersion: string;
  stats: {
    total: number;
    bugs: number;
    enhancements: number;
    resolvedBugs: number;
    openBugs?: number;
    openEnhancements?: number;
    totalOpen?: number;
    resolvedTotal?: number;
    open?: number;
    inProgress?: number;
    resolved?: number;
    resolutionRate: string;
  };
  versions: ReleaseVersion[];
  items: ReleaseItem[];
}
