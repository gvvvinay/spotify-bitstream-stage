import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';
import { MusicSnippet, SnippetPlaylist } from '../types';

export function getActiveFirebaseConfig() {
  try {
    const custom = localStorage.getItem('bitstream_custom_firebase_config');
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (e) {}
  return defaultFirebaseConfig;
}

export function saveCustomFirebaseConfig(config: any) {
  localStorage.setItem('bitstream_custom_firebase_config', JSON.stringify(config));
  window.location.reload();
}

export function resetFirebaseConfig() {
  localStorage.removeItem('bitstream_custom_firebase_config');
  window.location.reload();
}

export function hasCustomFirebaseConfig(): boolean {
  return Boolean(localStorage.getItem('bitstream_custom_firebase_config'));
}

// Initialize Firebase with active config
export const activeConfig = getActiveFirebaseConfig();
const app = initializeApp(activeConfig);
export const db = activeConfig.firestoreDatabaseId
  ? getFirestore(app, activeConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Error Handling Specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Authentication helpers
export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user) {
    await syncUserProfile(result.user);
  }
  return result.user;
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

async function syncUserProfile(user: FirebaseUser) {
  const userRef = doc(db, 'users', user.uid, 'profile', 'data');
  const path = `users/${user.uid}/profile/data`;
  try {
    await setDoc(
      userRef,
      {
        userId: user.uid,
        displayName: user.displayName || 'Google User',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // Non-blocking for profile sync
    console.warn('Profile sync warning:', err);
  }
}

// Snippet operations
export async function saveSnippetToFirestore(userId: string, snippet: MusicSnippet): Promise<void> {
  const path = `users/${userId}/snippets/${snippet.id}`;
  const docRef = doc(db, 'users', userId, 'snippets', snippet.id);
  try {
    const existingSnap = await getDoc(docRef);
    const isNew = !existingSnap.exists();

    const payload: any = {
      id: snippet.id,
      userId: userId,
      title: snippet.title || 'Untitled',
      artist: snippet.artist || 'Unknown Artist',
      album: snippet.album || 'Unknown Album',
      albumArt: snippet.albumArt || '',
      spotifyUri: snippet.spotifyUri || '',
      trackId: snippet.trackId || snippet.id,
      spotifyUrl: snippet.spotifyUrl || '',
      durationMs: snippet.durationMs || 0,
      startMs: snippet.startMs ?? 0,
      endMs: snippet.endMs ?? 30000,
      snippetName: snippet.snippetName || 'Clip',
      playlistId: snippet.playlistId || 'playlist-all',
      notes: snippet.notes || '',
      tags: snippet.tags || [],
      color: snippet.color || '',
      isFavorite: true,
      createdAt: isNew ? serverTimestamp() : (existingSnap.data()?.createdAt || serverTimestamp()),
      ...(isNew ? {} : { updatedAt: serverTimestamp() }),
    };
    await setDoc(docRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function updateSnippetInFirestore(
  userId: string,
  snippetId: string,
  updates: Partial<Pick<MusicSnippet, 'snippetName' | 'startMs' | 'endMs' | 'playlistId' | 'notes' | 'color'>>
): Promise<void> {
  const path = `users/${userId}/snippets/${snippetId}`;
  const docRef = doc(db, 'users', userId, 'snippets', snippetId);
  try {
    await updateDoc(docRef, updates as any);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteSnippetFromFirestore(userId: string, snippetId: string): Promise<void> {
  const path = `users/${userId}/snippets/${snippetId}`;
  const docRef = doc(db, 'users', userId, 'snippets', snippetId);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeToUserSnippets(
  userId: string,
  onSnippets: (snippets: MusicSnippet[]) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/snippets`;
  const snippetsCol = collection(db, 'users', userId, 'snippets');
  return onSnapshot(
    snippetsCol,
    (snapshot) => {
      const snippets: MusicSnippet[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let createdAtNum = Date.now();
        if (data.createdAt instanceof Timestamp) {
          createdAtNum = data.createdAt.toMillis();
        } else if (typeof data.createdAt === 'number') {
          createdAtNum = data.createdAt;
        }

        snippets.push({
          id: data.id || docSnap.id,
          title: data.title,
          artist: data.artist,
          album: data.album,
          albumArt: data.albumArt,
          spotifyUri: data.spotifyUri,
          trackId: data.trackId,
          spotifyUrl: data.spotifyUrl,
          durationMs: data.durationMs,
          startMs: data.startMs,
          endMs: data.endMs,
          snippetName: data.snippetName,
          playlistId: data.playlistId,
          notes: data.notes,
          tags: data.tags || [],
          color: data.color,
          createdAt: createdAtNum,
        });
      });
      // Sort newest first
      snippets.sort((a, b) => b.createdAt - a.createdAt);
      onSnippets(snippets);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Playlist operations
export async function savePlaylistToFirestore(userId: string, playlist: SnippetPlaylist): Promise<void> {
  const path = `users/${userId}/playlists/${playlist.id}`;
  const docRef = doc(db, 'users', userId, 'playlists', playlist.id);
  try {
    const payload: any = {
      id: playlist.id,
      userId: userId,
      name: playlist.name,
      description: playlist.description || '',
      coverGradient: playlist.coverGradient || 'from-emerald-600 to-teal-900',
      createdAt: serverTimestamp(),
    };
    await setDoc(docRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deletePlaylistFromFirestore(userId: string, playlistId: string): Promise<void> {
  const path = `users/${userId}/playlists/${playlistId}`;
  const docRef = doc(db, 'users', userId, 'playlists', playlistId);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeToUserPlaylists(
  userId: string,
  onPlaylists: (playlists: SnippetPlaylist[]) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/playlists`;
  const playlistsCol = collection(db, 'users', userId, 'playlists');
  return onSnapshot(
    playlistsCol,
    (snapshot) => {
      const playlists: SnippetPlaylist[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let createdAtNum = Date.now();
        if (data.createdAt instanceof Timestamp) {
          createdAtNum = data.createdAt.toMillis();
        } else if (typeof data.createdAt === 'number') {
          createdAtNum = data.createdAt;
        }

        playlists.push({
          id: data.id || docSnap.id,
          name: data.name,
          description: data.description || '',
          coverGradient: data.coverGradient || 'from-emerald-600 to-teal-900',
          snippetIds: [], // hydrated by state
          createdAt: createdAtNum,
        });
      });
      playlists.sort((a, b) => b.createdAt - a.createdAt);
      onPlaylists(playlists);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

// Spotify Client ID and Secret Firestore Storage
export interface SpotifyAccountCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  updatedAt?: number;
}

export async function saveSpotifyCredentialsToFirestore(
  userId: string,
  clientId: string,
  clientSecret: string,
  refreshToken?: string
): Promise<void> {
  const path = `users/${userId}/spotifyConfig/credentials`;
  const docRef = doc(db, 'users', userId, 'spotifyConfig', 'credentials');
  try {
    const payload: any = {
      userId,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      updatedAt: serverTimestamp(),
    };
    if (refreshToken && refreshToken.trim()) {
      payload.refreshToken = refreshToken.trim();
    }
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function getSpotifyCredentialsFromFirestore(
  userId: string
): Promise<SpotifyAccountCredentials | null> {
  const path = `users/${userId}/spotifyConfig/credentials`;
  const docRef = doc(db, 'users', userId, 'spotifyConfig', 'credentials');
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    let updatedAtNum = Date.now();
    if (data.updatedAt instanceof Timestamp) {
      updatedAtNum = data.updatedAt.toMillis();
    } else if (typeof data.updatedAt === 'number') {
      updatedAtNum = data.updatedAt;
    }
    return {
      clientId: data.clientId || '',
      clientSecret: data.clientSecret || '',
      refreshToken: data.refreshToken || undefined,
      updatedAt: updatedAtNum,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function deleteSpotifyCredentialsFromFirestore(userId: string): Promise<void> {
  const path = `users/${userId}/spotifyConfig/credentials`;
  const docRef = doc(db, 'users', userId, 'spotifyConfig', 'credentials');
  try {
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeToSpotifyCredentials(
  userId: string,
  onCredentials: (creds: SpotifyAccountCredentials | null) => void,
  onError?: (err: any) => void
) {
  const path = `users/${userId}/spotifyConfig/credentials`;
  const docRef = doc(db, 'users', userId, 'spotifyConfig', 'credentials');
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        onCredentials(null);
        return;
      }
      const data = docSnap.data();
      let updatedAtNum = Date.now();
      if (data.updatedAt instanceof Timestamp) {
        updatedAtNum = data.updatedAt.toMillis();
      } else if (typeof data.updatedAt === 'number') {
        updatedAtNum = data.updatedAt;
      }
      onCredentials({
        clientId: data.clientId || '',
        clientSecret: data.clientSecret || '',
        refreshToken: data.refreshToken || undefined,
        updatedAt: updatedAtNum,
      });
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

