# Lokal Finder — 60s brand film

A 60-second vertical (1080×1920) film for Instagram Stories, rendered from the
same design system as the site: the real brand tokens, logo mark, typography
and product UI, not a separate set of marketing assets.

| | |
|---|---|
| Output | `lokal-finder-60s.mp4` — 1080×1920, 30fps, H.264 |
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
2160×3840 master; render time roughly quadruples).

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
| 0:00–0:12 | Hero — logo, "Everything local. One place.", category chips |
| 0:12–0:26 | Product — search → results → cart → order confirmed |
| 0:26–0:36 | Community — isometric neighbourhood, delivery route |
| 0:36–0:45 | Expansion — food, laundry, cleaning, housekeeping, services, retail |
| 0:45–0:53 | Vision — the community connecting into one network |
| 0:53–0:57 | Brand — logo |
| 0:57–1:00 | "Your community. Connected." + Get early access |

## Two things to know before publishing

**There is no audio track.** The film is built to read silently, which is how
most Stories are watched, but if you want music you'll need to add a licensed
track in any editor — the MP4 is a normal H.264 file.

**Nothing in it is a real statistic.** The order flow, the merchant names, the
ratings and the "~12 minutes" are illustrative product copy carried over from
the site's own demo, and the film never presents a user count, order volume or
traction number. If you add any real figures later, they belong in the final
frames — not implied by the mock UI.

## Fonts

`fonts/` holds the two brand faces (Fraunces, Plus Jakarta Sans) as woff2,
vendored so the render never depends on a network fetch and never silently
falls back to a system serif. They're the same families the site loads from
Google Fonts, under the SIL Open Font License.
