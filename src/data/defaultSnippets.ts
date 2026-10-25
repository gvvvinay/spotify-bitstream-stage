import { MusicSnippet, SnippetPlaylist } from '../types';

export const INITIAL_PLAYLISTS: SnippetPlaylist[] = [
  {
    id: 'playlist-favorites',
    name: '🎵 My Favorite Bits',
    description: 'Your personal collection of favorite music clips and moments.',
    coverGradient: 'from-emerald-500 via-teal-600 to-indigo-800',
    snippetIds: [],
    createdAt: Date.now(),
  },
];

export const INITIAL_SNIPPETS: MusicSnippet[] = [];

