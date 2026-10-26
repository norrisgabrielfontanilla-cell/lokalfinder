# Lokal Finder tests

```bash
cd tests
npm install
./run.sh
```

1027 checks across seventeen suites, all driving the real `index.html` in headless
Chromium. `run.sh` runs them all; run it before and after any change to `index.html`.

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
