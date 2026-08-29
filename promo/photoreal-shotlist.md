# LokalFinder — photoreal hero video: production breakdown

The 54-second photoreal brief cannot be generated as one continuous piece by any
current tool. This breaks it into shots that *can* be generated, says which tool
each shot belongs in, and flags the failure modes that waste the most credits.

Nothing here is rendered by this repo. The illustrated film (`film.html`) is a
separate, finished deliverable — this is the route if you want live-action-grade
instead.

---

## The three constraints that reshape the brief

**1. Clip length.** Runway, Kling, Luma and Veo generate roughly 5–10 seconds per
generation. Sora goes longer but still won't hold a coherent 54-second narrative.
So the film is 9 shots, cut together in an editor — not one prompt.

**2. Character consistency is the hard problem.** The same person will not look
like the same person across two generations. Two ways around it, and the shot
list below uses both:

- Lock a reference image per character and feed it to every shot that person
  appears in (Runway References, Kling face-swap, Midjourney `--cref` for stills).
- Design shots so faces recur as little as possible — hands, backs, silhouettes,
  over-the-shoulder. Scene 2's three characters are written this way.

**3. Never ask a video model for text or logos.** They garble type and cannot
reproduce your pin-house mark. Every caption and the end card get composited in
the edit. I can supply those as transparent overlays or a finished end card —
they're already built in this repo's brand.

---

## Shot list

Durations are the *edit* length; generate ~2s longer than you need on each so you
have handles to cut on.

| # | Time | Shot | Tool |
|---|------|------|------|
| 1 | 0:00–0:04 | Condo exterior, slow orbit, dusk, lights on in units | Runway / Veo / Kling |
| 2 | 0:04–0:08 | Push in on one lit balcony | same, same seed |
| 3 | 0:08–0:12 | Satellite → 3D street-level descent onto the complex | **Google Earth Studio** |
| 4 | 0:12–0:16 | Character A cooking — hands, steam, no face | Runway (ref image A) |
| 5 | 0:16–0:20 | Character B crossing lobby with bags — from behind | Runway (ref image B) |
| 6 | 0:20–0:26 | Interior, person on couch, phone in hand | Runway (ref image C) |
| 7 | 0:26–0:35 | App UI — **screen recording, not generated** | your app + After Effects |
| 8 | 0:35–0:50 | Rider through corridor / street, evening | Kling (best motion physics) |
| 9 | 0:50–0:54 | End card | **this repo** |

### Shot 3 is the one people get wrong

Your brief asks for "aerial Google Maps-style satellite view, smoothly
transitioning to interactive 3D street-level." Don't generate that — **Google
Earth Studio** does it with real satellite and photogrammetry data, for free, in
a browser. Set two keyframes (high altitude → street level over your actual
Quezon City coordinates) and it exports an image sequence. It will look correct
because it *is* correct. A generated fake of a map is uncanny in a way a real one
never is.

### Shot 7 must be a screen recording

The brief asks for the app interface materialising in 3D with vendors appearing,
pins dropping, notifications. A video model will invent a plausible-looking app
that is not yours, with unreadable text. Record the real app, then do the
"materialising in 3D space" treatment in After Effects — that's a compositing
job, not a generation job.

---

## Per-shot prompts

Paste these directly. They drop the parts of your original that video models
ignore or mangle (text overlays, logo, exact app UI) and keep the parts they
execute well (camera, light, material, motion).

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
sizzling, chopped vegetables, worn wooden board. Warm practical light from
overhead. Shallow macro depth of field, natural hand movement. Photorealistic,
no face visible, no text.
```

**Shot 5 — lobby walk, from behind**
```
Tracking shot from behind a person walking through a modern condominium lobby
carrying two paper food bags. Natural gait, fabric moving, polished floor
reflections, warm evening lobby lighting. Steadicam, shallow depth of field.
Photorealistic, face not visible, no text.
```

**Shot 6 — couch interior**
```
Medium shot of a person sitting on a couch in a warm modern Manila apartment
at night, looking down at a phone. Soft lamp light, plants, rattan textures.
Screen glow on the face. Shallow depth of field, slow push-in. Photorealistic,
cinematic, no text, phone screen blank.
```

Note `phone screen blank` — you composite the real UI onto it in the edit. Ask
the model for a screen and you get invented garbage.

**Shot 8 — rider**
```
Motorbike rider in a green jacket with a yellow insulated delivery box riding
slowly through a residential street at night. Warm streetlights, wet asphalt
reflections, realistic bike lean and suspension. Tracking shot alongside,
shallow depth of field, slight motion blur. Photorealistic, cinematic, no text.
```

---

## What I can supply for the edit

All of this is already built in this repo's real brand, and cuts straight in at
1080×1920 / 30fps:

- **End card** (Shot 9) — pin-house mark, Lokal*Finder* wordmark, tagline, CTA
- **Lower-third captions** for the scene text, in Bricolage Grotesque
- **Alpha-channel overlay** versions of any of the above, to sit over footage

Ask and I'll render them as separate files.

---

## Budget reality

Eight generated shots, and you will not get a usable take first try —
three to five attempts per shot is normal. Budget 25–40 generations. On Runway
or Kling that is roughly $30–80 depending on plan and resolution. Earth Studio
and your own screen recording are free.

The illustrated 54-second film in this repo costs nothing to re-render and is
already done. Worth deciding which one is actually the hero and which is the
supporting asset, rather than building both to finish.
