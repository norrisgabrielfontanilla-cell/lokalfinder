# Lokal Finder tests

```bash
cd tests
npm install
./run.sh
```

1651 checks across twenty-two suites, all driving the real `index.html` in headless
Chromium. `run.sh` runs them all; run it before and after any change to `index.html`.
Set `LF_BAIL=1` to make `test-drafts.js`, `test-condos.js`, `test-condoart.js`, `test-condopublic.js`, `test-photos.js`, `test-condoshared.js` and `test-condorooms.js` stop at their first failing check (the
mutation runner uses it: it only needs to know that the suite notices).

| Suite | Covers |
| --- | --- |
| `test-food.js` | The original food flow, end to end. This is the regression net — if it breaks, customers can't order. |
| `test-cleaning.js` | The cleaning vertical, end to end: browse → book → provider accepts → status walk → history. |
| `test-cross.js` | Both verticals in one app, plus booking edge cases and legacy-record defaults. |
| `test-security.js` | XSS, credential storage, admin auth, duration-aware slot conflicts, earnings maths. |
| `test-smoke.js` | Every page renders, chat, order archiving, admin flows. |
| `test-orderfail.js` | Order confirmation only after the backend write lands. |
| `test-session.js` | Vendor session persistence: offline reopen, revocation, expiry, pre-v56 migration. |
| `test-signup.js` | Self-serve vendor onboarding, incl. a cold-device guard that a signup cannot wipe the live catalog. |
| `test-aircon.js` | The aircon vertical end to end, plus a LEAK GUARD that registers a 4th vertical at runtime and asserts no code change is needed. |
| `test-vlogin.js` | The vendor login store picker (v63): vertical tabs, grouping, filter reset, offline boot; its own LEAK GUARD. |
| `test-datausage.js` | v64: only what changed is downloaded (change-gated catalog, feed paging, device cache). |
| `test-nowipe.js` | v65: per-store saves, nothing saved before the catalog has loaded — the 2026-10-07 wipe. |
| `test-storeinfo.js` | v67: the swipeable Store Info pager on the vendor page. |
| `test-condos.js` | v78/v79: the condo directory, the room resolver and the admin-only picker. |
| `test-frame.js` | v79: the app frame is put back on every page change. |
| `test-pipeline.js` | v80: the admin Condo Pipeline, P1 — a resident's phone untouched, the switch, the fifth tab, a move (one atomic write, stale / failed / lost-answer / in-flight cases), sample condos never written, hostile data, 500 condos, keyboard and reduced motion, phone and desktop, a fault that switches off only this section, and source guards. |
| `test-drafts.js` | v81: the admin "Add condo" drafts — a resident's phone untouched, the editor with real taps, every refusal in plain words, ids, edit / delete / undo, a draft moved through the pipeline (the pipeline's own single write, nothing about the draft's facts sent), the picker, copy and import (check first, then import, then undo; hostile text), a phone that will not store or holds junk, the switch / sign-out / hard off, keyboard, 44px and 16px, phone and desktop layouts, a fault that switches off only the drafts, and source guards. |
| `test-condoart.js` | v82: the admin pictures and pages — a resident's phone untouched, the layout as plain numbers (rows, spacing, heights, "+N more", an empty plot), a picture on every card, the page (tap a tower or a row, keyboard, Back / Esc / ✕, focus, scroll position), the twelve made-up sample condos (marked, in memory only, never in the directory), drafts and hostile records, 44px and reduced motion, phone and desktop layouts, a fault that switches off only the pictures, 500 condos on a slowed CPU, and source guards. |
| `test-condopublic.js` | v83: the customers' Condos icon and view — the switch read through the real update check (20 phones: what was remembered × what the file said), the icon (markup, 390/360/320px, corner hit-test, focus ring, the Back route), real taps, the customer's view against a poisoned directory (unverified / hidden / draft / sample records never appear), an admin's two views kept apart, the kill switch with a page open, the phone's memory, the hard off, five kinds of fault, source guards. |
| `test-photos.js` | v84: a vendor's logo, cover and menu-item photos tell the truth — saved and announced only after the write lands, a failed or refused save puts the old photo back and says "not saved", a damaged or non-image file says so and writes nothing, a transparent PNG gets a white background, the file box is emptied, sizes stay capped. |
| `test-condoshared.js` | v85: the shared condo directory — a phone that may not see condos makes no request about them; a customer pays one stamp read, and gets the icon and the condo once an admin has added one (the icon only when there is another condo to show); the stamp decides what is downloaded (current stamp: nothing; changed: once, capped; the 20 s gate; a forced look; failures change nothing); add, edit, hide / show, rename and delete are each ONE patch of the root with exactly two keys; a save that fails, is lost (with and without a working look-up), collides on an id, runs in flight, meets a stale screen or a sign-out; a private draft still private and publishable; a hostile database (markup, `__proto__`, GRASS / sample ids, junk, 300 KB notes, 400 records); the phone's copy; the switch and the hard off; a fault that switches off only the sharing; keyboard, 44px / 16px, phone and desktop layouts; source guards. |
| `test-condorooms.js` | v86: condo rooms — a condo is the whole app. GRASS unchanged (17 kinds of junk in storage are GRASS); an empty condo room (no demo store ever on screen, no seeding write, the first store can be saved the moment the app starts); two rooms never see each other (the same store id with its own PIN in both, orders, vendor sessions, cached catalogs, order history, the pre-v56 vendor keys, the sign-in fallback); a condo with no building listed and one with one; who may enter a condo (the `condoSwitch` matrix for customers and admins) and the button, the question (cart, orders) and the move; the way back is never gated; the admin's read of the switch over time; one admin login for every condo and takeover attempts; stores of every kind opened in a condo and booked/ordered with a building; push is GRASS-only; source and rules-shape guards; hostile cards and records and the card's size cap (the page is served with the cap lowered); layout at 390/360/320; faults switch off only the moving. |

## The one rule

`harness.js` intercepts every request to the Firebase host and serves an
in-memory fake. **Production data is never touched, and it must stay that way.**

The stub deliberately **rejects any path without a `.json` suffix**, exactly as
the real RTDB REST API does. That is not a detail — an earlier, more permissive
stub accepted such paths and returned `200`, which made a silently-failing write
look like a successful one and led to a bug being mis-diagnosed. If you extend
the harness, keep it stricter than production, never looser.

## Notes

- Chromium comes from `playwright`. In a sandbox that ships its own browser, set
  `PW_CHROMIUM` to the executable path and `harness.js` will use it.
- Tests that need a vendor open regardless of the wall clock set the vendor's
  hours and then call `pushState()`, because the 3-second sync would otherwise
  overwrite the local change.
