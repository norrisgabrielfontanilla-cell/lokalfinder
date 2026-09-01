# Lokal Finder tests

```bash
cd tests
npm install
./run.sh
```

313 checks across eight suites, all driving the real `index.html` in headless
Chromium.

| Suite | Covers |
| --- | --- |
| `test-food.js` | The original food flow, end to end. This is the regression net — if it breaks, customers can't order. |
| `test-cleaning.js` | The cleaning vertical, end to end: browse → book → provider accepts → status walk → history. |
| `test-cross.js` | Both verticals in one app, plus booking edge cases and legacy-record defaults. |
| `test-security.js` | XSS, credential storage, admin auth, duration-aware slot conflicts, earnings maths. |
| `test-smoke.js` | Every page renders, chat, order archiving, admin flows. |
| `test-orderfail.js` | Order confirmation only after the backend write lands. |
| `test-session.js` | Vendor session persistence: offline reopen, revocation, expiry, pre-v56 migration. |
| `test-aircon.js` | The aircon vertical end to end, plus a LEAK GUARD that registers a 4th vertical at runtime and asserts no code change is needed. |

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
