# Lokal Finder: one-page pamphlet

| File | What it is |
|---|---|
| `Lokal_Finder_Pamphlet.pdf` | A4, one page, print-ready. Real text (selectable, searchable), fonts embedded, 8 mm margins so any office printer can print it. |
| `Lokal_Finder_Pamphlet.png` | The same page as a picture (1985 x 2808) for phones, Messenger, Viber and Facebook groups. |
| `pamphlet.template.html` | The design. Edit the wording here. |
| `build.js`, `verify.js`, `pdfcheck.py` | Build and check (below). |

```
cd pamphlet
npm install
node build.js      # pamphlet.html, the PDF and the PNG (needs Playwright with Chromium)
node verify.js     # one A4 page, fonts embedded, QR code decodes to the app's link
```

Printing on short bond (Letter)? Choose "Fit to page" in the print dialog; nothing is cropped.

## Where each line comes from

Nothing on the page is invented. Everything is something the product does today or something the founder has said.

| On the pamphlet | Source |
|---|---|
| The link and the QR code | `index.html`: `SHARE_URL` and the inline QR of the "Share LokalFinder" card. `build.js` reads both, so the printed code cannot drift from the app. `verify.js` scans the QR from the PDF (at 300 dpi) and the PNG and requires the exact link. |
| Discover, Choose, Order, Receive | The real customer flow: home categories and open/closed badges, store page with menu, prices and hours, checkout with unit and Cash or GCash, live tracker and chat. |
| "Pay the seller directly", "does not process payments" | There is no payments integration; orders settle between customer and seller (see `CLAUDE.md`). |
| "No account needed" | There is no customer login; checkout asks for name, unit and phone. |
| Sellers: tap Vendor, List your store; reviewed before it goes live; outside the building can apply | The self-serve application (`p-signup`, `openVendorApply()`): the applicant chooses their own PIN, the admin approves, the Tower box has an "Outside GRASS Residences" option. |
| Orders in one list; menu, photos and hours | The vendor portal. |
| Add to Home Screen steps | The app's own share card (iPhone: Safari; Android: Chrome). |
| "Now open at GRASS Residences, Quezon City" | The one community the app runs in. |
| Food "Available now"; Cleaning, Aircon, Laundry "Coming soon" | The code supports all four, but only food has real sellers; the others exist only as demo stores. |
| Phone screen | The real app (v86) with demo data. The fine print says so. |
| Logo, colors, fonts | The product's own: Fraunces and Plus Jakarta Sans (SIL Open Font License), the logo from `presentation/assets/brand`. |

## Left out on purpose

* Google Play or App Store badges: the founder reports the Android app is listed and iPhone approval is pending, but no store link is in this repository.
* Contact details (phone, Messenger, email): none are in the repository.
* Sales, orders, seller counts, ratings, reviews, testimonials: none are documented; the ₱23,000 figure is founder-reported and unverified.
* Prices or fees, and any mention of other apps.

To add a contact line, a store badge or a short custom link, put it in `pamphlet.template.html` and rebuild.
