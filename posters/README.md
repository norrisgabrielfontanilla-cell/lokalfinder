# Lokal Finder: five Instagram posters

Five different posters, 1080 × 1350 px (Instagram's 4:5 feed size), drawn from the **live app as it was on 26 Nov 2026** (app v86).
They are for residents and sellers only: no business plan, no sales or traction figures, no roadmap.

| # | File | Job | Headline | Button |
|---|------|-----|----------|--------|
| 1 | `Lokal_Finder_IG_poster_1-fresh-from-neighbors.png` | Awareness: what Lokal Finder is | Fresh from your neighbors. | Link in bio |
| 2 | `Lokal_Finder_IG_poster_2-four-steps.png` | Education: how it works | From craving to doorstep in four steps. | Try it · link in bio |
| 3 | `Lokal_Finder_IG_poster_3-real-food.png` | Proof and appetite: real dishes from real sellers | Real food from real neighbors. | See who's open · link in bio |
| 4 | `Lokal_Finder_IG_poster_4-sell-with-us.png` | Seller recruitment | Selling food? List your store. | Apply · link in bio |
| 5 | `Lokal_Finder_IG_poster_5-no-account.png` | Activation: the easiest way to start | No account. No app store. | Scan the QR or link in bio |

`Lokal_Finder_IG_posters_preview.jpg` shows all five on one sheet.

## What is real and what is not

* **Phone screens** (posters 1, 2, 4) are real screens of the live app, captured read-only on 26 Nov 2026. The capture ran in a browser where
  every request that was not a read was cancelled; the run's tally of attempted writes was empty. Nothing in production was changed, no
  order was placed and no admin or vendor area was opened.
* **Menu photos and logos** (poster 3, and the store cards in posters 1 and 2) are what the sellers uploaded and what any resident sees in the app.
* **"Open" badges** were captured with the clock set to lunchtime in Manila (12:10), so the stores show *Open*. At other hours the same
  stores may show *Closed*. Post when stores are actually open, or the first screen a viewer opens may not match the poster.
* **The order tracker in poster 2, step 4 is a SAMPLE** (drawn by the app against a test database, not a real order). It is labelled on the poster.
* **The QR code in poster 5** is the app's own share code, recoloured. `node build.js qr` decodes it from the finished PNG and checks it against
  the link in `index.html`.
* Brand art (night skyline, rings, logos) and the two typefaces (Fraunces, Plus Jakarta Sans) come from `presentation/` and `pamphlet/assets/fonts`.

## Where each claim comes from

| On the poster | Source in the live app |
|---|---|
| "Fresh from your neighbors" | The app's own food tagline (`index.html`, `MARKETPLACES.food.tagline`) |
| "Now open at GRASS Residences" / "Quezon City" | The header on the live home screen: "GRASS Residences • Quezon City" |
| "See who's open now" | The *Open* badge on each store card |
| "Real menus & prices", "full menu and prices" | The store page (menu, item prices) |
| "Order to your unit", "Add your unit and number" | Checkout asks for name, unit number and contact number; the tracker says "On the way to your unit" |
| "Pay cash or GCash", "Pay the seller" | Checkout's payment choice. There is no payments integration: the customer settles directly with the seller |
| "No account needed" | There are no customer accounts in the app |
| Four steps: Discover / Choose / Order / Receive | The landing page copy (`landing/src/data/content.ts`) |
| Seller steps, "We review it", "message on your number", "stays hidden until it's approved" | The live **List your store** screen: "We review every application before it goes live", "We'll review it and message you on the number above. Your store stays hidden from customers until it's approved." |
| Add to Home Screen lines (iPhone: Safari, Share; Android: Chrome, ⋮) | The app's own share sheet |

## Left out on purpose

* Fees, commission, "free", delivery times, delivery fees, ratings, order counts, user counts. None of these is something the app can back up as a promise today.
* Other services (cleaning, aircon, laundry): the app has the tabs, but those stores are demo fixtures and no real provider has been onboarded.
* The Condos tab and anything about other condos.
* Security promises. The live **List your store** screen (visible inside the phone on poster 4) says nobody at LokalFinder can see a seller's PIN. That is the app's own text; the poster does not repeat it, because the database is still open (see `CLAUDE.md`, Security).
* The long web address. The QR and "link in bio" carry it, so the poster does not show the GitHub account name.

## Before you post

1. **Ask the sellers.** Poster 3 uses dishes and logos from ADBUNS, King's Wings, Liam's Homemade and Rouie Snacks, and the Noird. Coffee logo; posters 1 and 2 show the ADBUNS and Noird. Coffee store cards. They are public in the app, but
   an advert is a different use. To drop a seller, delete its tiles and logo in `posters.html` and rebuild.
2. **Set the link in bio** to the app (the address the QR points to).
3. **Check the stores are still there.** If a seller leaves, or the app's screens change, refresh the capture and rebuild (below).
4. Poster 1 and 5 say the app is open at GRASS Residences, Quezon City. Take that line off if it ever stops being true.

## Captions, alt text and hashtags (drafts)

Taglish lines are drafts: have a native speaker read them once. Hashtags are suggestions; check each one in Instagram before using it.

### 1. Fresh from your neighbors

> Fresh from your neighbors. 🍱
>
> Lokal Finder puts the stores of GRASS Residences in one place. See who's open, check real menus and prices, and order straight to your unit.
>
> Open it in your browser. Link in bio 💚

> Fresh mula sa mga kapitbahay mo! 🍱
>
> Nasa Lokal Finder na ang mga store ng GRASS Residences. Tingnan kung sino ang bukas, ang totoong menu at presyo, at mag-order diretso sa unit mo.
>
> Buksan sa browser. Link in bio 💚

`#LokalFinder #GRASSResidences #QuezonCity #SupportLocal #HomemadeFood #CondoLife`

Alt text: Dark night-skyline poster. "Fresh from your neighbors." A phone shows the Lokal Finder home screen with stores near you. Ticks: See who's open now, Real menus and prices, Order to your unit. Button: Link in bio.

### 2. From craving to doorstep

> From craving to doorstep in four steps 👇
> 1️⃣ Discover nearby stores and see who's open
> 2️⃣ Open a store for its full menu and prices
> 3️⃣ Add your unit and number, pay cash or GCash
> 4️⃣ Follow your order (the tracker shown is a sample)
>
> No account needed. Link in bio 💚

> Mula crave hanggang unit mo, apat na hakbang lang 👇
> 1️⃣ Hanapin ang mga store malapit sa'yo at tingnan kung sino ang bukas
> 2️⃣ Buksan ang store para makita ang buong menu at presyo
> 3️⃣ Ilagay ang unit at number mo, bayad sa cash o GCash
> 4️⃣ Sundan ang order mo (sample ang tracker na nasa larawan)
>
> Walang account na kailangan. Link in bio 💚

`#LokalFinder #GRASSResidences #OrderLocal #SupportLocal #QuezonCity #GCash`

Alt text: Light poster, "From craving to doorstep in four steps." Four cards: 1 Discover (store cards), 2 Choose (a menu), 3 Order (contact number and payment choice: GCash or Cash), 4 Receive (a sample order tracker). Footer: No account needed, Try it, link in bio.

### 3. Real food from real neighbors

> Real food from real neighbors. 🍗🥚🍰
>
> Dishes from ADBUNS, King's Wings, Liam's Homemade and Rouie Snacks, with Noird. Coffee, all selling on Lokal Finder at GRASS Residences.
>
> See who's open. Link in bio 💚

> Totoong pagkain mula sa totoong kapitbahay. 🍗🥚🍰
>
> Mga luto ng ADBUNS, King's Wings, Liam's Homemade at Rouie Snacks, kasama ang Noird. Coffee. Lahat nasa Lokal Finder.
>
> Tingnan kung sino ang bukas. Link in bio 💚

`#LokalFinder #GRASSResidences #QuezonCity #HomemadeFood #SupportLocal #QuezonCityFood`

Tag the sellers once they have said yes. Alt text: Nine photos of dishes from sellers on Lokal Finder: torikatsu, pork chop in salted-egg sauce, breaded shrimp, banana cake, beef tapa with egg, buffalo tenders, chicken shots, baked mac and cheese sticks. Logos of five stores below, and a button: See who's open, link in bio.

### 4. Selling food? List your store

> Selling food at GRASS? List your store on Lokal Finder.
> 1️⃣ Tap Vendor, then "List your store"
> 2️⃣ Add your store details and choose your own PIN
> 3️⃣ We review it and message you on your number
> 4️⃣ Sign in and add your menu
>
> Your store stays hidden from customers until it's approved. Link in bio 🧡

> May tinda ka ba sa GRASS? I-list ang store mo sa Lokal Finder!
> 1️⃣ I-tap ang Vendor, tapos "List your store"
> 2️⃣ Ilagay ang detalye ng store at pumili ng sarili mong PIN
> 3️⃣ Ire-review namin at magme-message kami sa number mo
> 4️⃣ Mag-sign in at idagdag ang menu mo
>
> Hindi makikita ng customers ang store mo hangga't hindi pa na-a-approve. Link in bio 🧡

`#LokalFinder #GRASSResidences #SellLocal #HomeBasedBusiness #SmallBusinessPH #QuezonCity`

Alt text: Dark green and gold poster, "Selling food? List your store." Four numbered steps beside a phone showing the List your store form. A note says the store stays hidden from customers until it is approved. Button: Apply, link in bio.

### 5. No account. No app store.

> No account. No app store. 📲
>
> Open Lokal Finder in your browser and order from your neighbors. Pay the seller in cash or GCash.
>
> Want it on your Home Screen? iPhone: open it in Safari, tap Share, then Add to Home Screen. Android: open it in Chrome, tap ⋮, then Add to Home screen.
>
> Scan the QR or use the link in bio 💚

> Walang account. Walang app store. 📲
>
> Buksan ang Lokal Finder sa browser at mag-order sa mga kapitbahay mo. Bayad sa seller: cash o GCash.
>
> Gusto sa Home Screen mo? iPhone: buksan sa Safari, tap Share, tapos Add to Home Screen. Android: buksan sa Chrome, tap ⋮, tapos Add to Home screen.
>
> I-scan ang QR o gamitin ang link in bio 💚

`#LokalFinder #GRASSResidences #QuezonCity #OrderLocal #SupportLocal`

Alt text: Bright green poster, "No account. No app store." Ticks: No account needed, Pay the seller in cash or GCash, Add it to your Home Screen like an app. A QR code labelled Scan to open, and two boxes with iPhone and Android steps for adding it to the Home Screen.

## Posting order and what to measure

The app has **no analytics** (`CLAUDE.md`), so link taps cannot be traced to a poster inside the app. Use Instagram Insights (reach, saves, shares, profile visits, link taps) and, for sellers, the admin's applications queue.

* **Suggested order:** 3, then 1, then 2, then 5 over the first week or two; 4 on its own day, aimed at sellers.
* **Hypothesis A:** real seller photos (3) earn more saves and shares per reach than product screens (1, 2). *Test:* post 3 and 1 on different days at the same hour. *Compare:* saves + shares ÷ reach, and link taps, after 48 hours. *Decide:* lead with photos if 3 wins clearly. With a small audience, treat a small gap as no difference.
* **Hypothesis B:** poster 4 is judged by seller applications received in the next 7 days, not by reach.
* **Not testable today:** whether poster 5 turns visitors into repeat users. Ask new customers where they heard about it.

## Rebuild

```
cd posters
npm install            # sharp, jsqr
node build.js          # render + check + qr + sheet
```

Needs Playwright with Chromium. `check` fails if any text leaves the safe area (x 72–1008, y 56–1294; Instagram's 3:4 profile-grid crop only trims 34 px per side), if two text boxes overlap, or if a
picture or font did not load. `qr` fails if the code on poster 5 stops matching the app's share link.

To refresh the screens and photos from the live app, rerun the one-off read-only capture: `pamphlet/tools/live-capture.js` and `emit.js`, driven by the temporary workflow in commit `8b0f9e2`
(`git show 8b0f9e2:.github/workflows/fetch-store-photos.yml`; it ran on this branch only and was deleted after use). `fetch-run.sh` and `reassemble.js` bring the result back.
