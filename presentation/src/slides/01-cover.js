// 1 / The Opening
module.exports = (kit) => {
  const { W, H, TYPE, R } = kit;
  const s = kit.scene('LF_COVER', { section: 'Opening', label: 'The Opening', transition: { kind: 'fade', dur: 0.9 } });

  s.img('art/cover-night.jpg', {
    x: 0, y: 0, w: W, h: H, name: 'Artwork',
    alt: 'Illustration (not a photograph): a night skyline of residential towers with lit windows. A dotted line links two lit windows, and ripple rings spread from one of them, like an order passing between neighbors.',
  });

  s.img('brand/logo-full-dark.png', { x: 0.75, y: 0.62, w: 2.55, h: 2.55 * 252 / 915, name: 'Logo', alt: 'Lokal Finder logo', fx: ['fade', 0.15, 0.7] });

  kit.eyebrow(s, 'Community commerce, reimagined', 0.78, 2.18, { color: 'mintLight', w: 6.5, name: 'Eyebrow', fx: ['fade', 0.55] });
  s.title([R('Everything local.', { break: true }), R('One place.', { color: 'mintLight', italic: true })], { fx: ['rise', 0.75, 0.7] });
  s.text('Order from, and sell to, the people nearby.', { x: 0.78, y: 5.12, w: 6.8, h: 0.5, size: TYPE.h3, color: 'white', alpha: 12, name: 'Subline', fx: ['fade', 1.35] });

  // the real home screen, rising from the bottom edge
  s.phone('home', { x: 8.75, w: 3.05, bottom: H, crop: 'tall', name: 'Phone', alt: 'The Lokal Finder home screen: search, store categories and nearby stores (real app screen, demo data).', fx: ['rise', 1.0, 0.85] });

  s.notes(
`OPENING (about 30 seconds)

Lokal Finder is a neighborhood marketplace. The idea in one line: order from, and sell to, the people nearby.

What you are looking at: the headline is the product's own tagline from the Lokal Finder website ("Everything local. One place."). The skyline is original artwork made for this deck in the brand colors: it is an illustration, not a photograph and not a picture of any real building. The two lit windows joined by a dotted line stand for one neighbor ordering from another. The phone is the real Lokal Finder home screen, captured from the actual app with demo data.

Say: "I want to show you what Lokal Finder is, what we have actually seen so far, what we still have to prove, and how we plan to find out."`);
};
