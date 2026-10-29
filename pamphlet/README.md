# Lokal Finder: one-page pamphlet

| File | What it is |
|---|---|
| `Lokal_Finder_Pamphlet.pdf` | A4, one page, print-ready. Real text (selectable, searchable), fonts embedded, 8 mm margins so any office printer can print it. |
| `Lokal_Finder_Pamphlet.png` | The same page as a picture (1985 x 2808) for phones, Messenger, Viber and Facebook groups. |
| `pamphlet.template.html` | The design. Edit the wording here. |
| `build.js`, `verify.js`, `pdfcheck.py` | Build and check (below). |
| `assets/live/` | The real pictures: `home-tall.png` (a real screen of the live app in a phone frame) and `photos/` (six food pictures from the sellers' own menus, cropped). |
| `tools/` | How the real pictures were collected and cropped (below). |

```
cd pamphlet
npm install
node build.js      # pamphlet.html, the PDF and the PNG (needs Playwright with Chromium)
node verify.js     # one A4 page, fonts embedded, QR code decodes to the app's link
```

Printing on short bond (Letter)? Choose "Fit to page" in the print dialog; nothing is cropped.

## Where each line comes from

Nothing on the page is invented. Everything is something the product does today, something a seller put in their own menu, or something the founder has said.

| On the pamphlet | Source |
|---|---|
| The link and the QR code | `index.html`: `SHARE_URL` and the inline QR of the "Share LokalFinder" card. `build.js` reads both, so the printed code cannot drift from the app. `verify.js` scans the QR from the PDF (at 300 dpi) and the PNG and requires the exact link. |
| Phone screen in the hero | A real screenshot of the **live** app (29 Oct 2026), taken by a read-only run on GitHub (below), with the phone clock set to 12:10 PM in Manila so the stores show their lunchtime state. The stores, photos, hours and ratings on it are the live ones (ADBUNS 5.0 from 2 reviews, Noird. Coffee 5.0 from 3 reviews). |
| The six food pictures and the store names under them | The sellers' own menu photos, read from the live catalog: King's Wings (2), ADBUNS (2), Liam's Homemade (1), Rouie Snacks (1). Cropped to fit, nothing retouched. The two ADBUNS pictures were taken on a balcony with the GRASS pool in the background. |
| Discover, Choose, Order, Receive | The real customer flow: home categories and open/closed badges, store page with menu, prices and hours, checkout with unit and Cash or GCash, live tracker and chat. |
| "Pay the seller directly", "does not process payments" | There is no payments integration; orders settle between customer and seller (see `CLAUDE.md`). |
| "No account needed" | There is no customer login; checkout asks for name, unit and phone. |
| Sellers: tap Vendor, List your store; reviewed before it goes live; outside the building can apply | The self-serve application (`p-signup`, `openVendorApply()`): the applicant chooses their own PIN, the admin approves, the Tower box has an "Outside GRASS Residences" option. |
| Orders in one list; menu, photos and hours | The vendor portal. |
| Add to Home Screen steps | The app's own share card (iPhone: Safari; Android: Chrome). |
| "Now open at GRASS Residences, Quezon City" | The one community the app runs in. |
| "Food is available now; cleaning, aircon and laundry are coming soon" | The code supports all four, but only food has real sellers; the others exist only as demo stores. |
| Logo, colors, fonts | The product's own: Fraunces and Plus Jakarta Sans (SIL Open Font License), the logo from `presentation/assets/brand`. |

## How the real pictures were collected

The store and food pictures are **not in this repository**: they live inside the app's database (Firebase), which the Claude
environment cannot reach. They were read on 2026-10-29 by a one-off GitHub Actions run, the same kind of read-only run as the
2026-10-07 diagnostic:

* `tools/live-capture.js` opens the live app the way a resident's phone does, with **every request that is not a GET, HEAD or OPTIONS
  aborted**, so nothing in production can change (the run reported zero attempted writes). It saves what a resident can see: the stores
  that are visible, their logos, covers, menu items and menu photos, and real phone screens. It never opens orders, chats, notifications,
  the admin or the vendor portal, and the manifest drops contact fields and store descriptions. `tools/test-live-capture.js` proves it first
  against the repo's own stub database.
* Artifacts of a run are served from a storage host the Claude environment cannot reach, so the files travelled as the annotations of a
  check run (`tools/emit.js`, `tools/reassemble.js`, `tools/fetch-run.sh`; every file was checked by sha256 after reassembly).
* The temporary workflow is gone from the branch tip; it is in git history at commit `0a79e79`
  (`git show 0a79e79:.github/workflows/fetch-store-photos.yml`). To refresh the pictures, restore it, push, then run
  `tools/fetch-run.sh <commit-sha> tools/out-live`, look at `node tools/contact-sheet.js tools/out-live out`, edit `tools/pick.json`, and run
  `node tools/make-photos.js` and `LF_SCREENS=tools/out-live/screens node tools/make-mockups.js`.

What the live catalog held that day: 8 visible stores. Five have photos (ADBUNS 13, Noird. Coffee 17, King's Wings 19, Liam's 3, Rouie Snacks 3);
Toss Tacos, Aviel's Lechon Kawali and Cheesy Rice Bowl have none and were closed.

## Left out on purpose

* **Noird. Coffee's pictures.** All 17 look like studio renders (the same gold logo printed on every cup, two identical whipped-cream
  icons), not photos of the cups a resident receives. They are the seller's own listing images, but they are not "real food" in the sense
  the pamphlet promises, so none is used. (The store still appears on the phone screen, exactly as the app shows it.)
* Two of Rouie Snacks' three pictures (the "dynamite" and "togue" rolls): they look like pictures copied from a food website, and one carries
  another site's watermark ("Today's Delight").
* Google Play or App Store badges: the founder reports the Android app is listed and iPhone approval is pending, but no store link is in this repository.
* Contact details (phone, Messenger, email): none are in the repository.
* Sales, orders, seller counts, testimonials: none are documented; the ₱23,000 figure is founder-reported and unverified. The only ratings on the page are the two inside the real phone screen.
* Prices or fees, and any mention of other apps.

## Before it is printed or posted

The sellers' store names and food pictures are on the page, and the repository is public, so the six cropped pictures and the phone screen are
public in it too. They are the sellers' own pictures from a public app, but they were not asked about a printed pamphlet: ask ADBUNS, King's Wings,
Liam's Homemade and Rouie Snacks first. To drop a seller, swap its tile in `pamphlet.template.html` (and in `tools/pick.json`) and rebuild.
