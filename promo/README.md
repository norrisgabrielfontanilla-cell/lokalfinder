# LokalFinder — social film

A 52-second vertical (1080×1920) explainer for TikTok / Reels / Stories, built
from the app's own brand: the real pin-house logo mark, the Lokal*Finder*
wordmark in Bricolage Grotesque, the warm green-and-amber palette, and cartoon
neighbours drawn in the same style as the app's community illustration.

It is structured as an argument, not a montage: set up the problem, name the
insight, then walk four numbered steps — including the merchant side, which is
what most people miss — and close on why it matters. The step badges carry
progress dots so a viewer always knows where they are.

| | |
|---|---|
| Output | `lokalfinder-how-it-works-52s.mp4` — 1080×1920, 30fps, H.264 |
| Source | `film.html` — the entire film, in one file |
| Render | `render.mjs` — frame capture + encode |
| Audio | none (see below) |

## Why HTML instead of a video editor

The film is a web page driven by a single `seek(t)` function: every visual
property for a given moment is derived from `t`, and nothing animates on its
own. That has two consequences worth knowing:

- **The render is exact.** Frames are stepped, not screen-recorded, so there
  are no dropped frames and no timing drift. Re-rendering the same commit
  produces a byte-identical video.
- **Edits are code.** Retiming a beat means changing a number, not re-cutting
  a timeline. Scene windows live in the `S` object near the top of the script.

## Rendering

```bash
npm i playwright && npx playwright install chromium   # once
node render.mjs                                        # → lokal-finder-60s.mp4
```

Options: `--fps 30`, `--out path.mp4`, `--scale 1` (use `--scale 2` for a
2160×3840 master; render time roughly quadruples). A full 40s render takes
about two minutes.

## Previewing without rendering

```
film.html?preview=1
```

Space toggles play/pause, arrow keys scrub ±1s, `s` overlays the Instagram
safe area. Preview playback is opt-in via the query param precisely so the
capture path stays deterministic. It does not autoplay under
`prefers-reduced-motion`.

## Structure

| Time | Beat |
|---|---|
| 0:00–0:04 | 7PM — the building wakes up, food behind every lit window |
| 0:04–0:10 | The problem — a long haul across the city, then: someone is cooking one floor up |
| 0:10–0:12 | LokalFinder |
| 0:12–0:17 | **Step 1** — a neighbour opens a store, and flips it open for orders |
| 0:17–0:22 | **Step 2** — you see who's cooking nearby, listed by *distance* |
| 0:22–0:26 | **Step 3** — one tap, and she starts cooking |
| 0:26–0:32 | **Step 4** — it travels metres, not kilometres |
| 0:32–0:37 | Why it matters — the money stays in the building |
| 0:37–0:42 | Beyond food — laundry, cleaning, repairs, sari-sari |
| 0:42–0:46 | One building, one economy |
| 0:46–0:52 | Logo, "Your community. Connected.", Get early access |

## Two things to know before publishing

**There is no audio track.** The film is built to read silently, which is how
most Stories are watched, but if you want music you'll need to add a licensed
track in any editor — the MP4 is a normal H.264 file.

**Nothing in it is a real statistic.** The vendor names, ratings and delivery
times are illustrative, in the spirit of the app's own demo content, and the
film never presents a user count, order volume or traction number. If you add
real figures later they belong in the closing frames, not implied by the mock
UI.

## Fonts

`fonts/` holds the three brand faces as woff2 — Bricolage Grotesque (the
wordmark and headlines), Fraunces (the closing line) and Plus Jakarta Sans —
vendored so a render never depends on a network fetch. All three are forced
through `document.fonts.load()` before capture begins: `document.fonts.ready`
alone is not enough, because a face used only inside a scene that is hidden at
`t=0` would otherwise stream in mid-render and a few frames would fall back to
a system font. Same families the app itself loads, under the SIL Open Font
License.
