# Lokal Finder: vertical ad (9:16, 24.6 seconds, with a woman's voice-over)

A mobile ad made from the same real pictures as the deck and the pamphlet. It is **customer-facing only**: no sales,
traction, revenue, business model, roadmap or competitors. Everything it says is something the app does today.

| File | What it is |
|---|---|
| `Lokal_Finder_Ad_9x16_voice.mp4` | **The narrated ad.** Voice A (a warm, upbeat woman) over the music. 1080 x 1920, 30 fps, 24.6 s, 12.4 MB, H.264 + AAC, about -14.7 LUFS, `faststart`. For Reels, TikTok, Stories, Facebook and Viber / Messenger status. |
| `Lokal_Finder_Ad_9x16_voice_B.mp4` | The same ad with a second woman's voice (Voice B). Same pictures, same words, same timing: pick the one you like. |
| `Lokal_Finder_Ad_9x16.mp4` | No voice: music only (for your own recording, or the platform's sound). |
| `cards/*.jpg` | The same story as 7 still cards (1080 x 1920): hook, app, open now, real food, order, follow it live, link. For Stories, Status or a carousel. |
| `Lokal_Finder_Ad_preview.jpg` | All 7 cards on one sheet. |
| `ad.html` | The ad itself: one page whose every frame is a pure function of time (`window.seek(t)`). Edit wording and timing here. |
| `render.js`, `audio.py`, `voice.py`, `mix.py` | Render the frames, make the music, make the voice, mix them (below). |

## What it shows, and what she says

| Time | On screen | She says | Where it comes from |
|---|---|---|---|
| 0.0 - 3.3 | "Dinner shouldn't mean going *downstairs.*" then "Order from a *neighbor* instead." A tower, a "you" window and a "seller" window, a dotted route between them. | "Dinner shouldn't mean going downstairs." (0.25) "Order from a neighbor instead." (2.18) | The everyday problem (deck slide 2). The tower is **illustration**, not a photo of any real building. |
| 3.3 - 6.0 | The "you" window grows into a phone. "Meet *Lokal Finder.*" / "Your neighborhood marketplace." | "Meet Lokal Finder!" (4.40) | **Real screen of the live app** (29 Oct 2026). |
| 6.0 - 9.0 | "See who's *open now.*" / "Stores right in your community." The two "Open" badges are ringed. | "See who's open right now." (6.20) | The same real screen: stores show Open or Closed from their own hours. |
| 9.0 - 13.2 | "Real food. *Real sellers.*" Six food photos with the store names. | "Real food, from real sellers in your community." (9.20) | The sellers' **own** menu photos from the live catalog (ADBUNS, King's Wings, Liam's Homemade, Rouie Snacks). |
| 13.2 - 19.2 | "Order in *a few taps.*" 1 Pick your meal, 2 Add your unit, 3 Pay cash or GCash, 4 Follow it live. | "Pick your meal, add your unit," (13.90) "Pay cash or GCash, and follow it live." (16.20) | **Real** store page and **real** checkout from the live app. The last screen is the order tracker with made-up data, so it carries a **SAMPLE ORDER** label. |
| 19.2 - 24.6 | Logo. "Everything local. *One place.*" "Now open at GRASS Residences, Quezon City." "Open it in your browser", the link, "No account needed - Pay cash or GCash", "Selling? Apply to list your store in the app." | "Everything local. One place." (19.38) "Now open at Grass Residences." (21.48) The link, "no account needed" and the seller line stay on screen only. | The product's own tagline; the link is `SHARE_URL` in `index.html`; checkout asks for a name, unit and phone and has no login; the vendor application is `openVendorApply()`. |

## The voice-over

* **It is a synthetic (AI) voice.** Nobody's recording, and no real person's voice is imitated. It was made on this machine with
  **Kokoro-82M** (Apache-2.0 licence, through the `kokoro-onnx` package): Voice A is its `af_heart` voice, Voice B its `af_bella`. Both are
  American-English women. **TikTok and Meta ask you to label AI-generated voices: use their label when you post.**
* **A Filipino voice would sound more local.** This model has no Filipino voice, and it cannot do Tagalog. If you record the lines (or hire a voice
  talent), send me the audio: the words and the second each line starts (`voice.py`, `LINES`) are the script, and swapping the recording in is a re-mix.
* **The mix.** Each line is made on its own, trimmed, set to the same level, placed at the second the picture needs it, then lightly EQ'd and
  compressed. The music dips about 12 dB just before she speaks and comes back after, so the voice sits about 10 dB above the music
  (measured), and the beat is still there between phrases. Whole ad about -14.7 LUFS, true peak -1.6 dBFS.
* **"Grass" in the script** is spelled that way on purpose so she says it as a word; "GCash" comes out as "G-Cash" (checked in the phonemes: "dʒˈiː kˈæʃ").
* **I could not listen to it here.** I checked timing, level, pitch movement, clicks and the spectrogram (below), not how it *sounds*. Listen to both versions before you post.

## What it does not say (on purpose)

* No prices, fees, "free", discounts or delivery times. (The real screens show store prices; the ad makes no price claim.)
* No numbers about the business: users, orders, sales, ratings, store counts. Anything numeric is inside a real screenshot.
* No "coming soon" services (cleaning, aircon, laundry): only food has real sellers.
* No mention of any other app. No claim that Lokal Finder takes payments: the ad says what checkout offers, "cash or GCash".
* No Google Play / App Store badge: no store link exists in the repository.

## Before you post it

1. **Ask the sellers first.** Their store names, logos and food photos are on screen: **ADBUNS, King's Wings, Liam's Homemade, Rouie Snacks** (photos) and **Noird. Coffee** (it is on the real home screen). The pictures are the sellers' own, from a public app, but nobody was asked about an advertisement. To drop a seller, remove its tile in `ad.html` (the `TILES` list) and re-render; Noird. Coffee is inside the home screenshot, so that one needs a different screenshot.
2. **Label the AI voice** with the platform's AI-content label.
3. **The link.** The picture shows the plain link. If the platform has a link or button (paid posts), put the same link there. Adding `?utm_source=facebook&utm_medium=video&utm_campaign=ad_v1` is harmless, but the app only keeps those on the phone: nothing reports them yet, so there is no per-source order count. Your numbers are the platform's (views, 3-second views, link clicks) plus new orders in the admin.
4. **Music.** The soundtrack is original (made in `audio.py`, no samples, no licensed music), so it is safe anywhere. If you prefer the platform's own sound, use the no-voice file or strip the audio: `ffmpeg -i Lokal_Finder_Ad_9x16.mp4 -c:v copy -an no_music.mp4`.
5. **Check it on your phone** in the real app first (Reels / TikTok / Stories each draw their own buttons over the video).

### Suggested caption

> Dinner shouldn't mean going downstairs. Order from sellers right in your community on Lokal Finder: see who's open, pick your meal, pay cash or GCash. No account needed.
> Open it in your browser: norrisgabrielfontanilla-cell.github.io/lokalfinder
> Selling? Apply to list your store in the app.
> #LokalFinder #GRASSResidences #QuezonCity #SupportLocal

Taglish draft (please polish): *Hapunan na? Hindi mo na kailangang bumaba. Umorder sa mga seller sa mismong community mo: tingnan kung sino ang bukas, piliin ang gusto mo, magbayad ng cash o GCash. Walang account na kailangan.*

### A test worth running

*Hypothesis:* showing real neighbors' real food converts better than a generic promo. Cut three versions that change only the first 3 seconds:
(A) this ad, the problem hook; (B) open on the food photos ("Real food. Real sellers."); (C) open on the phone ("See who's open now."). Same caption, same audience, same budget, two days.
Read: 3-second views, then link clicks, then **orders in the admin**. Keep the one that brings orders, not the one with the most views.

## Safe zones

Reels, TikTok and Stories draw their own interface over the top and bottom of a 9:16 video, and Instagram's feed crops it to 4:5. All text, chips and labels stay inside **x 56-1024, y 290-1480** at every moment (`node render.js check` measures every headline, chip and label that is showing, at every 0.1 s, and fails on any that leaves it). Only pictures (the phone, the photo tiles, the skyline) go beyond.

## Rebuild

```
node render.js still 1.6 5.5 12.4     # PNGs of those moments (out/)
node render.js check                  # text inside the safe zone, every 0.1 s
node render.js cues                   # the sound cues the page registered (out/cues.json)
python3 audio.py                      # the music (out/soundtrack.wav), reads out/cues.json

# the voice (needs the Kokoro model files, ~350 MB, not in the repo)
python3 -m venv .venv && .venv/bin/pip install kokoro-onnx
curl -L -O https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx   # sha256 7d5df8ec...36a6c5
curl -L -O https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin    # sha256 bca610b8...1fbf7d
KOKORO_MODELS=. VOICE=af_heart .venv/bin/python voice.py          # out/voice_af_heart.npy / .wav / .json (VOICE=af_bella for B)
FFMPEG=/path/to/ffmpeg python3 mix.py af_heart                    # out/mix_af_heart.wav (music ducked under the voice, -14.5 LUFS)

# the picture, once, then one file per sound
NO_AUDIO=1 FFMPEG=/path/to/ffmpeg node render.js video out/video_silent.mp4    # WORKERS=3 browsers at once
ffmpeg -i out/video_silent.mp4 -i out/mix_af_heart.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -movflags +faststart Lokal_Finder_Ad_9x16_voice.mp4
node render.js cards                  # the 7 story cards (cards/) and the preview sheet
```

Needs Node, Playwright with Chromium, Python 3 with numpy, and an ffmpeg with libx264 and AAC (`pip install imageio-ffmpeg` carries one).
The page loads its pictures from `../presentation/assets` (real screens, seller photos, skyline art, logo) and its fonts from
`../pamphlet/assets/fonts` (Fraunces and Plus Jakarta Sans, SIL Open Font License), so nothing is copied twice.

## Checked / not checked

Checked:
* **The files.** MP4, H.264 High + AAC-LC stereo, 1080 x 1920, 30 fps, exactly 24.60 s, 12.4 MB each, `faststart` (the index is at the front, so it starts playing before it has fully downloaded).
* **The sound.** Narrated files about -14.7 LUFS integrated, true peak -1.6 / -1.4 dBFS; music-only file -15.4 LUFS (ffmpeg `ebur128`). The sound effects are placed from the same cue list the page uses, so they land on the pictures by construction.
* **The voice, by measurement.** Nine lines inside their windows, none overlapping (Voice A: every line at natural speed; Voice B: the first line 5% faster to fit); every line within 0.5 dB of the same level; no clicks (largest sample jump / RMS under 7, a click would be 20+); pitch median about 200 Hz with a 10-90% movement of 8.2 semitones for Voice A (6.7 for B), i.e. lively rather than flat; the spectrogram shows nine clean speech bursts and no glitches. The voice sits 10.5 dB (A) / 10.8 dB (B) above the ducked music.
* **The encode against the page.** Frames decoded from the MP4 at 5.5 and 22.9 s against the page's own stills: PSNR 39-40 dB, mean colour shift about 1 / 255 (no colour-matrix error).
* **The safe zone.** `node render.js check`: 733 headline, chip and label boxes over 24.6 s, none outside x 56-1024, y 290-1480.
* **By eye:** the key frames of every scene, the transitions and the 7 cards.

Not checked: **how the voice and the music sound** (measured and looked at, not heard), playback on real phones and inside Reels, TikTok and Facebook (each draws its own buttons over the video), and the sellers' permission.
