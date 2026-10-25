# Security Spec: Firestore Rules Hardening

## 1. Data Invariants
1. A user can only access, create, read, update, or delete their own user profile document at `/users/{userId}/profile`.
2. A snippet must reside in `/users/{userId}/snippets/{snippetId}` where `request.auth.uid == userId`.
3. The `snippet.userId` field must match `request.auth.uid`.
4. Document IDs must conform to `isValidId()` (string <= 128 chars, alphanumeric + hyphens + underscores).
5. Timestamps (`createdAt`) must be server timestamps matching `request.time`.
6. Numerical fields (`startMs`, `endMs`, `durationMs`) must be non-negative numbers, with `startMs < endMs`.
7. String lengths must strictly adhere to blueprint maximums (`title` <= 300, `artist` <= 300, `album` <= 300, `snippetName` <= 300, `notes` <= 2000).
8. A user can only access their own playlists at `/users/{userId}/playlists/{playlistId}`.
9. Updates cannot mutate immortal fields (`id`, `userId`, `createdAt`).
10. Anonymous users are not permitted for writing; `request.auth.token.email_verified == true` or valid Google OAuth token must be present.
11. Unauthenticated or foreign users cannot list or read other users' collections.
12. A user can only access their own Spotify API credentials (clientId, optional clientSecret, optional refreshToken) at `/users/{userId}/spotifyConfig/{configId}`.
13. Global safety net: default-deny catch-all rule on `{document=**}`.

## 2. The "Dirty Dozen" Payloads (Must be Rejected)
1. **Payload 1: Identity Spoofing** - User A attempts to write to `/users/userB/snippets/snip1`.
2. **Payload 2: Snippet Field Spoofing** - User A writes to `/users/userA/snippets/snip1` with `userId: "userB"`.
3. **Payload 3: Unauthenticated Write** - Unauthenticated client writes to `/users/userA/snippets/snip1`.
4. **Payload 4: Invalid ID Character Poisoning** - Writing snippet with ID containing malicious traversal `../../secret`.
5. **Payload 5: Oversized Field Bomb** - Writing snippet with `title` exceeding 300 characters (e.g. 10KB string).
6. **Payload 6: Reversed Timestamps** - Writing snippet with `startMs: 50000` and `endMs: 10000` (`startMs >= endMs`).
7. **Payload 7: Negative Timestamp** - Writing snippet with `startMs: -500`.
8. **Payload 8: Ghost Field / Shadow Update** - Writing snippet containing ghost field `isAdmin: true` or `role: "superadmin"`.
9. **Payload 9: Mutation of Immortal CreatedAt** - Update snippet attempting to alter `createdAt` to a fabricated time.
10. **Payload 10: Mutation of Immortal UserId** - Update snippet attempting to change `userId` to transfer ownership.
11. **Payload 11: Foreign Read Snoop** - User A querying `/users/userB/snippets`.
12. **Payload 12: Blanket List Snoop** - Unauthenticated request querying `/users/{userId}/snippets` collection group.

## 3. Test Runner Definition
Unit tests verified via rule definitions ensuring zero update gaps, complete ABAC isolation, and schema enforcement.
