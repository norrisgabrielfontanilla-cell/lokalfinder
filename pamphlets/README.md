# Pamphlets

Print pieces for Lokal Finder. Three artboards, authored against the same
tokens as `index.html` — greens `#0E8A5A` / `#0F4A32` / `#0D2B1A`, window amber
`#F5C842`, Bricolage Grotesque + Fraunces italic + Plus Jakarta Sans.

| File | Piece | Size @ 96 ppi |
| --- | --- | --- |
| `Main.dc.html` | Resident flyer | A5, 559×794 (prints two-up on A4) |
| `VendorFlyer.dc.html` | Vendor recruitment flyer | A4, 794×1123 |
| `LobbyPoster.dc.html` | Lift-lobby poster | A3, 1123×1587 |

`_kit.py` holds the shared brand kit — logo mark, QR, star/check/vendor
glyphs, wordmark. `canvas.json` is the canvas layout and the sticky notes.

## Things that are deliberate

- **The QR is the real one.** `_kit.py` reads the pre-generated, verified QR
  path out of `index.html`'s share modal, so it resolves to the live Pages
  URL. It is recoloured to near-black: brand green scans on a screen but is
  marginal on paper and worse photocopied. If the share URL ever changes,
  regenerate the QR in `index.html` first — these pick it up from there.
- **No emoji.** Vendor tiles are stroke drawings (`_kit.glyph`), not the
  app's `VENDORS[].emoji`. Emoji need a colour emoji font that print shops
  often lack, and fall back to tofu or an unrelated glyph.
- **The vendors are demo fixtures.** The five storefronts are the seeded
  demo data from `index.html`. Swap in real merchants before printing.
- **`[YOUR CONTACT NUMBER]`** on the vendor flyer is intentionally blank —
  there is no vendor self-signup, an admin creates the store, so a seller
  needs a human to message.

## Rebuilding

Artboards are fixed-size frames: content that overruns the frame is CLIPPED,
not scaled. After editing, re-measure before publishing.

```bash
cd pamphlets
python3 - <<'PY'          # regenerate the artboards from _kit.py
# ...see git history for the generator used
PY
```

Then seed and publish the canvas with the `design` skill's helper:

```bash
node "<design skill>/seed-canvas.mjs" \
  --template "<design skill>/payload.template.html" \
  --out lokal-finder-pamphlets.html --title "Lokal Finder Pamphlets" \
  --artboard Main.dc.html --artboard VendorFlyer.dc.html \
  --artboard LobbyPoster.dc.html --canvas canvas.json
```

The seeded file is gitignored — it is 2.5 MB of vendored editor payload.
