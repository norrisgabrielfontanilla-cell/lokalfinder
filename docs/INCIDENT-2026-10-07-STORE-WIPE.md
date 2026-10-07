# Incident: real stores erased from the database (2026-10-07)

## What happened
- **03:56:30 UTC (11:56 AM PHT):** a full write replaced `/vendors`, `/menu` and `/pinHashes` with the built-in demo catalog. Every real store, menu and PIN hash was erased. Orders, posts, reviews, chats and the legacy `/pins` node were untouched.
- **Evidence for the time:** `/rev` = `1791345390450` = that instant. Only pre-v64 builds write `/rev` on a catalog save, so the last full overwrite came from an old build ~7 h before PR #28 shipped. PR #28 did not cause it.
- **Cause (strong, not proven):** `pushState()` PUT the whole of those three nodes from the saving phone's memory. A phone that had not loaded the catalog held only the demo seeds. Which phone, and why its load was incomplete, is unknown; the database records no writer.
- **Why it was unrecoverable:** Realtime Database has no history, and the project was on the free Spark plan (no backups).

## Context found while investigating
- RTDB downloads: **196 GB / 30 days** (Sep 7 - Oct 7), 78.6 GB in October alone, against a 10 GB free quota. The quota had been exceeded since at least September and the database kept serving, so the quota is not what erased the stores. Main drivers: every device re-polling the full catalog (with base64 photos) every 3 s, and Feed polling of a ~4.6 MB `/posts` node. v64/v65 cut both.
- The "Connections" graph is useless here: the app uses REST, which the console does not count as connections.
- Live rules were NOT `firebase-rules.json`: the database was fully open (read and write). Unauthenticated reads worked on the root, `/orders` (names, phones, push tokens), `/chats`, `/notifs`, `/adminAuth` and the plaintext 4-digit `/pins`.

## Recovery
- 7 stores were rebuilt from the names and items saved inside order records (the only surviving copy): Rouie Snacks, Fudgy Crumbs, Kashmilkt, Toss Tacos, AVIEL'S LECHON KAWALI, CHEESY RICE BOWL, Noird. Coffee. Written additively (new keys only), then made live.
- **Not recoverable:** every store's photos, descriptions, hours and original categories; 15 other stores (4 known by name only from the admin log, 11 with no name). Owners must re-enter them.
- Four restored stores can still log in with their legacy `/pins` PIN (auto-upgrades to a hash). The other three need an admin PIN reset.
- Stores deleted on purpose (tombstoned) were deliberately not restored.

## Fix
- v65 (PR #29): `pushState(vid)` writes only the named store; refuses until the cloud catalog is loaded; never deletes by omission; never writes PIN hashes. See CLAUDE.md "v65".
- Server-side: publish `firebase-rules-stopgap.json` so whole-node writes to `/vendors`, `/menu`, `/pinHashes` and the root are refused even from an old build or a `curl`.

## Still open (do these)
1. Publish `firebase-rules-stopgap.json` (Console > Realtime Database > Rules). Rules history allows instant rollback.
2. Upgrade to Blaze, enable daily automatic backups, set a budget alert. Backups only start from that day.
3. Tighten rules: orders/posts/chats collections are still writable as a whole; reads are public; the admin password is checked in the browser only. Real Firebase Auth is the only full fix.
4. Delete the legacy plaintext `/pins` node once owners have logged in and hold hashes.
5. Move Feed photos/videos out of the database (Storage) so `/posts` stays small.
6. Re-add the unrecoverable stores through the admin panel.
