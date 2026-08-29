# LokalFinder — 54-second hero video: production brief

A complete brief for producing the photoreal hero film, written to be handed to
a 3D studio, a freelancer, or an AI video pipeline.

The illustrated 54-second film in this repo (`film.html`) is a separate,
finished asset. This document is the route to live-action-grade.

---

## Read this before commissioning anything

The single most expensive item in the brief is **photorealistic human characters
with facial animation, hair simulation and cloth simulation**. Photoreal digital
humans are among the hardest things in computer graphics — they are where budgets
go to die, and they are the most likely part of a spot to land in uncanny valley.

They are also, for *this* product, the part that adds least.

LokalFinder's whole claim is *these are real people, already in your building*.
A CG human undercuts that claim at exactly the moment it needs to land. The
tagline — "Hyperlocal. Hyper-real. Hyper-human." — is hard to sell with
synthetic people.

**Recommendation: shoot the humans, render the rest.** One day in an actual
condo with real residents costs a fraction of CG character work, and is more
persuasive because it is true. Keep 3D for the things that genuinely need it:
the building orbit, the map descent, the data-visualisation layers.

That recommendation is worth roughly the difference between a five-figure
production and a four-figure one. Route C below.

---

## Three routes, costed

| | Route A — 3D studio | Route B — AI generation | Route C — hybrid *(recommended)* |
|---|---|---|---|
| Humans | Photoreal CG | Generated, inconsistent | **Filmed, real residents** |
| Building | CG, full control | Generated, approximate | CG or drone plate |
| Map | CG recreation | Earth Studio | Earth Studio (real imagery) |
| App UI | Composited | Composited | Composited |
| Brand control | Total | Poor | Total |
| Cost | very high (five to six figures) | low ($30–80 credits + edit) | low–moderate |
| Time | 2–4 months | days | 1 shoot day + edit |
| Main risk | budget, uncanny valley | inconsistent characters | needs a competent shooter |

Cost bands are indicative and vary widely by market and studio; treat them as
orders of magnitude, not quotes.

---

## The three constraints that reshape the brief

**1. Clip length (Route B).** Runway, Kling, Luma and Veo generate roughly 5–10
seconds per generation. Sora goes longer but won't hold a coherent 54-second
narrative. The film is nine shots cut in an editor — not one prompt.

**2. Character identity does not survive between generations (Route B).** The
same person will not look like the same person across two clips. Mitigations:
lock a reference image per character and feed it to every shot they appear in;
and design shots so faces recur as little as possible. The shot list below uses
both. This constraint disappears entirely in Route C.

**3. Never ask a video model for text or logos.** They garble type and cannot
reproduce the pin-house mark. Every caption and the end card get composited. This
repo supplies them.

---

## Shot list

Durations are the *edit* length; acquire ~2s longer on each for handles.

| # | Time | Shot | Source |
|---|------|------|--------|
| 1 | 0:00–0:04 | Condo exterior, slow orbit, dusk, units lit | CG orbit / drone |
| 2 | 0:04–0:08 | Push in on one lit balcony | same |
| 3 | 0:08–0:12 | Satellite → 3D street-level descent | **Google Earth Studio** |
| 4 | 0:12–0:16 | Cooking — hands, steam, apron | filmed |
| 5 | 0:16–0:20 | Crossing lobby with food bags | filmed |
| 6 | 0:20–0:26 | Balcony, coffee, contemplative | filmed |
| 7 | 0:26–0:35 | App UI — **screen recording** | your app + After Effects |
| 8 | 0:35–0:50 | Rider through corridor / street, evening | filmed |
| 9 | 0:50–0:54 | End card | **this repo** |

### Shot 3: don't fake the map

The brief asks for satellite view transitioning to 3D street level. **Google
Earth Studio** does this with real satellite and photogrammetry data, free, in a
browser: set two keyframes (high altitude → street level over your actual Quezon
City coordinates) and export an image sequence. It looks correct because it *is*
correct. A generated map is uncanny in a way real imagery never is.

### Shot 7: the app UI must be a screen recording

The brief asks for the interface materialising in 3D with vendors appearing and
pins dropping. A video model will invent a plausible app that isn't yours, with
unreadable text. Record the real app; do the dimensional treatment in After
Effects. That's a compositing job, not a generation job.

---

## Per-shot prompts (Route B)

Paste directly. These drop what video models mangle (text, logos, specific UI)
and keep what they execute well (camera, light, material, motion).

**Shot 1 — exterior orbit**
```
Slow cinematic orbit around a modern 10-storey Manila residential condominium at
dusk. Glass balconies, warm concrete, tropical landscaping, palms. Interior
lights warm amber, roughly half the units lit. Volumetric haze, golden hour
falling to blue hour. Shot on 35mm, shallow depth of field, subtle handheld
drift. Photorealistic, cinematic colour grade, no text.
```

**Shot 2 — balcony push-in** (same seed as Shot 1)
```
Slow push-in toward a single lit balcony of a modern condominium at dusk. Potted
plants, laundry on a rack, warm interior glow spilling out. Shallow depth of
field, background falls soft. Photorealistic, cinematic, no text.
```

**Shot 4 — cooking, hands only**
```
Close-up of hands cooking in a small warm home kitchen. Steam rising from a pan,
chopped vegetables, worn wooden board. Warm practical light from overhead.
Shallow macro depth of field, natural hand movement. Photorealistic, no face
visible, no text.
```

**Shot 5 — lobby walk, from behind**
```
Tracking shot from behind a person walking through a modern condominium lobby
carrying two paper food bags. Natural gait, fabric moving, polished floor
reflections, warm evening lobby lighting. Steadicam, shallow depth of field.
Photorealistic, face not visible, no text.
```

**Shot 6 — balcony, coffee**
```
Medium shot of a person sitting on a condominium balcony at golden hour holding
a coffee cup, looking out. Potted plants, city beyond, wind moving hair softly.
Shallow depth of field, slow push-in. Photorealistic, cinematic, no text.
```

**Shot 8 — rider**
```
Motorbike rider in a green jacket with a yellow insulated delivery box riding
slowly through a residential street at night. Warm streetlights, wet asphalt
reflections, realistic bike lean and suspension. Tracking shot alongside,
shallow depth of field, slight motion blur. Photorealistic, cinematic, no text.
```

For any shot where a phone is visible, specify `phone screen blank` — you
composite the real UI in the edit. Ask a model for a screen and you get garbage.

---

## Quality specification

Hand this section verbatim to a studio or freelancer.

**Character work** — realistic proportions, not stylised. Individual-strand hair
with wind response. Natural facial expression including micro-expressions and eye
focus. Skin with genuine colour variation and slight imperfection. Cloth
simulation differentiated by material (cotton, denim, synthetics behave
differently). Natural weight distribution and posture. Articulated hands and
fingers. Locomotion with hip rotation and arm swing.

*If shooting rather than rendering, this entire section becomes free.*

**Building and environment** — photoreal concrete, glass, steel, vegetation.
Diffuse skylight plus warm interior practicals visible through windows, with
shadow play. Correct reflectance: glass carries sky and environment, metal has
appropriate specularity. Real plant species with drooping leaves, not generic
greenery. Architectural specificity: window frames, door handles, balcony
railings, air-conditioning units, electrical boxes. Ground detail — pavement
texture, parking, landscaping. Soft shadows fixing the time of day, subtle
atmospheric haze.

**Map and GPS** — real Google Maps 3D satellite style, not generic cartography.
Smooth satellite → street → interior transitions. Animated pins, route lines and
distance vectors. True 3D building extrusion. Correct north orientation and
geographic accuracy.

**Animation principles** — anticipation, ease-in/out and follow-through on every
move. No hard cuts; dissolve, move the camera, or wipe. Micro-interactions with
subtle scale feedback. Restrained particle work (steam, confirmation sparkles,
connection lines). Sound design on every visual beat.

**Colour and mood** — warm base (burnt orange, gold, warm grey) against cool
counterpoints (deep blue, green). High contrast between interior warmth and
outdoor ambient. Colour-code by role: vendors warm, delivery in energetic
accent, community in greens. Consistent light direction throughout.

**Pacing** — 0–8s slow reveal; 8–20s medium, introducing people; 20–35s faster
montage; 35–50s building crescendo; 50–54s deceleration into the logo.

---

## Copy

| Beat | Line |
|---|---|
| Scene 1 | You just don't know who they are. |
| Scene 2 | Meet your neighbours. The ones making, selling, delivering. |
| Scene 3 | Discover. Connect. Support. |
| Scene 4 | Support local. / Know your makers. / Your neighbourhood, connected. |
| Scene 5 | Download LokalFinder — Hyperlocal. Hyper-real. Hyper-human. |

Set in Bricolage Grotesque 800, the app's own wordmark face.

---

## The overlay pack — built, in `overlays/`

Rendered and verified. 1080×1920 / 30fps, transparent background, ready to sit
on a track above whatever footage the shoot produces.

| Asset | Content | Length |
|---|---|---|
| `cap-1` | "You just don't know who they are." | 3.4s |
| `cap-2` | "Meet your neighbours. The ones making, selling, delivering." | 4.0s |
| `cap-3` | "Discover. Connect. Support." | 3.4s |
| `cap-4` | "Support local." → "Know your makers." → "Your neighbourhood, connected." | 6.4s |
| `endcard` | Logo, wordmark, tagline, CTA — transparent | 4.6s |
| `endcard-solid` | Same on brand green, opaque — usable as a finished shot | 4.6s |

Each caption ships as **`.mov`** (PNG-in-QuickTime, lossless RGBA — Premiere, AE,
FCP, Resolve) and **`.webm`** (VP9 alpha, ~20× smaller, for web and CapCut).
`endcard-solid` is H.264 `.mp4`.

Captions carry a soft bottom scrim so white type survives over unpredictable
footage. All type sits inside the 250–1670px safe band.

Regenerate with `node render-overlays.mjs`; copy and timing live in the `ASSETS`
object at the top of `overlays.html`.

### One trap worth knowing

**ProRes 4444 was the obvious choice and it silently produced garbage.** This
ffmpeg build's `prores_ks` encoder accepts the alpha input, exits 0, and writes
an 88 MB file whose alpha channel is *entirely zero* — a broken asset that looks
completely fine until it hits a timeline. Verified with `alphaextract`; `qtrle`
and PNG-in-MOV both handle the same frames correctly.

`render-overlays.mjs` now decodes a mid-clip frame of every output and refuses to
report success unless real alpha is present. If you re-encode these in another
tool, check the alpha before trusting it — an exit code proves nothing here.

---

## Before signing anything

App store badges appear in Scene 5. If the app is not yet listed, that badge is a
claim you can't honour — use "Get early access" until it is. The illustrated film
already uses that wording for the same reason.
