import { INITIAL_PLAYLISTS, INITIAL_SNIPPETS } from '../data/defaultSnippets';
import { MusicSnippet, SnippetPlaylist } from '../types';

const STORAGE_KEY_SNIPPETS = 'bitstream_music_snippets_v2';
const STORAGE_KEY_PLAYLISTS = 'bitstream_playlists_v2';
const STORAGE_KEY_LAST_SYNC = 'bitstream_db_last_sync';
const STORAGE_KEY_RECENT = 'bitstream_recently_played_v1';
const STORAGE_KEY_PLAY_COUNTS = 'bitstream_play_counts_v1';

export interface DatabaseSyncResult {
  snippets: MusicSnippet[];
  playlists: SnippetPlaylist[];
  updatedAt: number;
  hasChanges?: boolean;
}

export class StorageService {
  private static lastSyncTimestamp: number = 0;

  public static clearLegacyCache() {
    try {
      localStorage.removeItem('bitstream_music_snippets_v1');
      localStorage.removeItem('bitstream_playlists_v1');
    } catch (e) {}
  }

  // Load from local browser storage cache
  public static loadSnippets(): MusicSnippet[] {
    try {
      this.clearLegacyCache();
      const local = localStorage.getItem(STORAGE_KEY_SNIPPETS);
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Failed to load snippets from local storage:', e);
    }
    return INITIAL_SNIPPETS;
  }

  // Save all snippets
  public static saveSnippets(snippets: MusicSnippet[]) {
    try {
      localStorage.setItem(STORAGE_KEY_SNIPPETS, JSON.stringify(snippets));
      // Sync batch to backend DB
      this.syncBatchToBackend(snippets, this.loadPlaylists());
    } catch (e) {
      console.error('Failed to save snippets:', e);
    }
  }

  // Save a single snippet directly to local database
  public static async saveSnippetRecord(snippet: MusicSnippet): Promise<boolean> {
    try {
      // 1. Update localStorage cache first
      const all = this.loadSnippets();
      const idx = all.findIndex((s) => s.id === snippet.id);
      if (idx >= 0) all[idx] = snippet;
      else all.unshift(snippet);
      localStorage.setItem(STORAGE_KEY_SNIPPETS, JSON.stringify(all));

      // 2. Persist to host database
      const res = await fetch('/api/db/snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snippet),
      });
      if (res.ok) {
        const data = await res.json();
        this.lastSyncTimestamp = data.updatedAt || Date.now();
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, String(this.lastSyncTimestamp));
        return true;
      }
    } catch (e) {
      console.warn('Network error saving snippet to local DB:', e);
    }
    return false;
  }

  // Delete a single snippet directly from local database
  public static async deleteSnippetRecord(snippetId: string): Promise<boolean> {
    try {
      // 1. Update localStorage cache
      const all = this.loadSnippets().filter((s) => s.id !== snippetId);
      localStorage.setItem(STORAGE_KEY_SNIPPETS, JSON.stringify(all));

      // 2. Delete from host database
      const res = await fetch(`/api/db/snippets/${encodeURIComponent(snippetId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        this.lastSyncTimestamp = data.updatedAt || Date.now();
        localStorage.setItem(STORAGE_KEY_LAST_SYNC, String(this.lastSyncTimestamp));
        return true;
      }
    } catch (e) {
      console.warn('Network error deleting snippet from local DB:', e);
    }
    return false;
  }

  public static clearAll() {
    try {
      localStorage.setItem(STORAGE_KEY_SNIPPETS, JSON.stringify([]));
      this.syncBatchToBackend([], this.loadPlaylists());
    } catch (e) {
      console.error('Failed to clear snippets:', e);
    }
  }

  // Load recently played snippets (cached in browser storage)
  public static loadRecentlyPlayed(): MusicSnippet[] {
    try {
      const local = localStorage.getItem(STORAGE_KEY_RECENT);
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {}
    return [];
  }

  // Load play counts map (snippetId / albumKey -> count)
  public static loadPlayCounts(): Record<string, number> {
    try {
      const local = localStorage.getItem(STORAGE_KEY_PLAY_COUNTS);
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {}
    return {};
  }

  // Record a snippet to recently played list (capped at 25) and increment play counts
  public static recordRecentlyPlayed(snippet: MusicSnippet): MusicSnippet[] {
    try {
      const counts = this.loadPlayCounts();
      counts[snippet.id] = (counts[snippet.id] || 0) + 1;
      const albumKey = `album:${(snippet.album || snippet.title || '').trim().toLowerCase()}`;
      if (albumKey !== 'album:') {
        counts[albumKey] = (counts[albumKey] || 0) + 1;
      }
      localStorage.setItem(STORAGE_KEY_PLAY_COUNTS, JSON.stringify(counts));

      const all = this.loadRecentlyPlayed().filter((s) => s.id !== snippet.id);
      all.unshift(snippet);
      const capped = all.slice(0, 25);
      localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(capped));
      return capped;
    } catch (e) {
      return [];
    }
  }

  public static loadPlaylists(): SnippetPlaylist[] {
    try {
      const local = localStorage.getItem(STORAGE_KEY_PLAYLISTS);
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Failed to load playlists from local storage:', e);
    }
    return INITIAL_PLAYLISTS;
  }

  public static savePlaylists(playlists: SnippetPlaylist[]) {
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
      this.syncBatchToBackend(this.loadSnippets(), playlists);
    } catch (e) {
      console.error('Failed to save playlists:', e);
    }
  }

  public static async savePlaylistRecord(playlist: SnippetPlaylist): Promise<boolean> {
    try {
      const all = this.loadPlaylists();
      const idx = all.findIndex((p) => p.id === playlist.id);
      if (idx >= 0) all[idx] = playlist;
      else all.push(playlist);
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(all));

      const res = await fetch('/api/db/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playlist),
      });
      if (res.ok) {
        const data = await res.json();
        this.lastSyncTimestamp = data.updatedAt || Date.now();
        return true;
      }
    } catch (e) {}
    return false;
  }

  public static async deletePlaylistRecord(playlistId: string): Promise<boolean> {
    try {
      const all = this.loadPlaylists().filter((p) => p.id !== playlistId);
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(all));

      const res = await fetch(`/api/db/playlists/${encodeURIComponent(playlistId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        this.lastSyncTimestamp = data.updatedAt || Date.now();
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Batch sync helper for legacy endpoints
  private static async syncBatchToBackend(snippets: MusicSnippet[], playlists: SnippetPlaylist[]) {
    try {
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippets, playlists, updatedAt: Date.now() }),
      });
      if (res.ok) {
        const data = await res.json();
        this.lastSyncTimestamp = data.updatedAt || Date.now();
      }
    } catch (e) {}
  }

  // Fetch complete database from laptop host
  public static async fetchFromBackend(since?: number): Promise<DatabaseSyncResult | null> {
    try {
      const query = since !== undefined ? `?since=${since}` : '';
      const res = await fetch(`/api/db/sync${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.snippets && data.playlists) {
          localStorage.setItem(STORAGE_KEY_SNIPPETS, JSON.stringify(data.snippets));
          localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(data.playlists));
          this.lastSyncTimestamp = data.updatedAt || Date.now();
          localStorage.setItem(STORAGE_KEY_LAST_SYNC, String(this.lastSyncTimestamp));
          return {
            snippets: data.snippets,
            playlists: data.playlists,
            updatedAt: data.updatedAt || Date.now(),
            hasChanges: data.hasChanges !== undefined ? data.hasChanges : true,
          };
        }
      }
    } catch (e) {
      console.warn('Could not fetch database from host server:', e);
    }
    return null;
  }

  public static getLastSyncTimestamp(): number {
    if (this.lastSyncTimestamp) return this.lastSyncTimestamp;
    const cached = localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    return cached ? Number(cached) : 0;
  }

  public static exportJSON(snippets: MusicSnippet[], playlists: SnippetPlaylist[]): string {
    return JSON.stringify({ snippets, playlists, version: 1, exportedAt: new Date().toISOString() }, null, 2);
  }

  public static importJSON(jsonStr: string): { snippets: MusicSnippet[]; playlists: SnippetPlaylist[] } | null {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.snippets) && Array.isArray(data.playlists)) {
        this.saveSnippets(data.snippets);
        this.savePlaylists(data.playlists);
        return data;
      }
    } catch (e) {
      console.error('Invalid JSON import:', e);
    }
    return null;
  }
}
