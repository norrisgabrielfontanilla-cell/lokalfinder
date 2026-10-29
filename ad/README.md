# Lokal Finder: vertical ad (9:16, 24 seconds)

A mobile ad made from the same real pictures as the deck and the pamphlet. It is **customer-facing only**: no sales,
traction, revenue, business model, roadmap or competitors. Everything it says is something the app does today.

| File | What it is |
|---|---|
| `Lokal_Finder_Ad_9x16.mp4` | The ad. 1080 x 1920, 30 fps, 24.0 s, H.264 + AAC (stereo, about -15 LUFS), `faststart`. For Reels, TikTok, Stories, Facebook and Viber / Messenger status. |
| `cards/*.jpg` | The same story as 7 still cards (1080 x 1920): hook, app, open now, real food, order, follow it live, link. For Stories, Status or a carousel. |
| `Lokal_Finder_Ad_preview.jpg` | All 7 cards on one sheet. |
| `ad.html` | The ad itself: one page whose every frame is a pure function of time (`window.seek(t)`). Edit wording and timing here. |
| `render.js`, `audio.py` | Render the frames and the soundtrack (below). |

## What it shows

| Time | On screen | Where it comes from |
|---|---|---|
| 0.0 - 3.3 | "Dinner shouldn't mean going *downstairs.*" then "Order from a *neighbor* instead." A tower, a "you" window and a "seller" window, a dotted route between them. | The everyday problem (deck slide 2). The tower is **illustration**, not a photo of any real building. |
| 3.3 - 6.0 | The "you" window grows into a phone. "Meet *Lokal Finder.*" / "Your neighborhood marketplace." | **Real screen of the live app** (29 Oct 2026). |
| 6.0 - 9.0 | "See who's *open now.*" / "Stores right in your community." The two "Open" badges are ringed. | The same real screen: stores show Open or Closed from their own hours. |
| 9.0 - 13.2 | "Real food. *Real sellers.*" Six food photos with the store names. | The sellers' **own** menu photos from the live catalog (ADBUNS, King's Wings, Liam's Homemade, Rouie Snacks). |
| 13.2 - 19.2 | "Order in *a few taps.*" 1 Pick your meal, 2 Add your unit, 3 Pay cash or GCash, 4 Follow it live. | **Real** store page and **real** checkout from the live app. The last screen is the order tracker with made-up data, so it carries a **SAMPLE ORDER** label. |
| 19.2 - 24.0 | Logo. "Everything local. *One place.*" "Now open at GRASS Residences, Quezon City." "Open it in your browser", the link, "No account needed - Pay cash or GCash", "Selling? Apply to list your store in the app." | The product's own tagline; the link is `SHARE_URL` in `index.html`; checkout asks for a name, unit and phone and has no login; the vendor application is `openVendorApply()`. |

## What it does not say (on purpose)

* No prices, fees, "free", discounts or delivery times. (The real screens show store prices; the ad makes no price claim.)
* No numbers about the business: users, orders, sales, ratings, store counts. Anything numeric is inside a real screenshot.
* No "coming soon" services (cleaning, aircon, laundry): only food has real sellers.
* No mention of any other app. No claim that Lokal Finder takes payments: the ad says what checkout offers, "cash or GCash".
* No Google Play / App Store badge: no store link exists in the repository.

## Before you post it

1. **Ask the sellers first.** Their store names, logos and food photos are on screen: **ADBUNS, King's Wings, Liam's Homemade, Rouie Snacks** (photos) and **Noird. Coffee** (it is on the real home screen). The pictures are the sellers' own, from a public app, but nobody was asked about an advertisement. To drop a seller, remove its tile in `ad.html` (the `TILES` list) and re-render; Noird. Coffee is inside the home screenshot, so that one needs a different screenshot.
2. **The link.** The picture shows the plain link. If the platform has a link or button (paid posts), put the same link there. Adding `?utm_source=facebook&utm_medium=video&utm_campaign=ad_v1` is harmless, but the app only keeps those on the phone: nothing reports them yet, so there is no per-source order count. Your numbers are the platform's (views, 3-second views, link clicks) plus new orders in the admin.
3. **Music.** The soundtrack is original (made in `audio.py`, no samples, no licensed music), so it is safe anywhere. If you prefer the platform's own sound, drop it: `ffmpeg -i Lokal_Finder_Ad_9x16.mp4 -c:v copy -an no_music.mp4`.
4. **Check it on your phone** in the real app first (Reels / TikTok / Stories each draw their own buttons over the video).

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
python3 audio.py                      # the soundtrack (out/soundtrack.wav), reads out/cues.json
FFMPEG=/path/to/ffmpeg node render.js video out/Lokal_Finder_Ad_9x16.mp4
node render.js cards                  # the 7 story cards (out/cards/)
```

Needs Node, Playwright with Chromium, Python 3 with numpy, and an ffmpeg with libx264 and AAC (`pip install imageio-ffmpeg` carries one).
The page loads its pictures from `../presentation/assets` (real screens, seller photos, skyline art, logo) and its fonts from
`../pamphlet/assets/fonts` (Fraunces and Plus Jakarta Sans, SIL Open Font License), so nothing is copied twice.

## Status

Work in progress: this commit holds the source (page, renderer, soundtrack). The video and the story cards are added in the next commit, together with what was checked on them.
