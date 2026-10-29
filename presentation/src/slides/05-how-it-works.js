// 5 / How It Works
module.exports = (kit) => {
  const { TYPE, R, H } = kit;
  const s = kit.scene('LF_DARK', { section: 'The Product', label: 'How It Works' });

  kit.eyebrow(s, 'How it works', 0.75, 0.55, { color: 'mintLight', fx: ['fade', 0.05] });
  s.title([R('From craving to doorstep in '), R('four steps.', { italic: true, color: 'mintLight' })], { fx: ['rise', 0.15] });

  const steps = [
    { n: 1, t: 'Discover', d: 'Browse nearby stores by category. See who is open.', phone: 'live-home', real: true },
    { n: 2, t: 'Browse', d: 'Open a store: menu, prices and opening hours.', phone: 'live-store', real: true },
    { n: 3, t: 'Order', d: 'Add items, enter your unit, pay cash or GCash.', phone: 'live-checkout', real: true },
    { n: 4, t: 'Receive', d: 'Follow it live. The seller brings it to your unit.', phone: 'tracker-delivered' },
  ];
  const PW = 2.1, X0 = 1.5, PITCH = 2.9;
  // the thread that ties the four steps together
  s.line({ x: X0 + 0.16, y: 2.38, w: 3 * PITCH, h: 0, color: 'mintLight', width: 1.5, alpha: 50, name: 'Thread' });
  s.fx(['Thread'], 'wipe', 0.5, 1.6);

  steps.forEach((st, i) => {
    const x = X0 + i * PITCH, t = 0.55 + i * 0.45;
    kit.num(s, st.n, x, 2.18, 0.4, { fill: 'mintLight', color: 'ink', size: 15, name: `Step ${st.n} number` });
    s.text([R(st.t, { size: 22, bold: true, color: 'white', break: true }), R(st.d, { size: TYPE.label, color: 'white', alpha: 12 })], { x, y: 2.7, w: 2.6, h: 0.95, lh: 1.0, name: `Step ${st.n}` });
    s.phone(st.phone, { x, w: PW, bottom: H, crop: 'tall', name: `Phone ${st.n}`, alt: `Lokal Finder app screen for step ${st.n}, ${st.t} (${st.real ? 'a real screen from the live app' : 'a real app screen with demo data'}).` });
    s.fx([`Step ${st.n} number`, `Step ${st.n}`], 'rise', t).fx([`Phone ${st.n}`], 'rise', t + 0.1, 0.7);
  });

  // the phones run to the bottom edge, so the note sits under the title instead of in the footer
  s.text('Steps 1 to 3 are real screens from the live app (29 Oct 2026). Step 4 is demo data: a real order would show a customer’s details. Customers pay the seller directly; the app records the order, it does not process payments.', { x: 0.75, y: 1.55, w: 11.8, h: 0.5, size: TYPE.foot, color: 'sage', lh: 1.0, name: 'Footnote', fx: ['fade', 1.0] });

  s.notes(
`HOW IT WORKS (about 1 minute)

The workflow below is the one the product actually implements. Steps 1 to 3 are real screens from the live app, captured on 29 October 2026 (the checkout holds two real items from King's Wings with the customer's details left empty); step 4 is a demo-data screen, because a real order would show a customer's name, unit and phone number.

1. Discover: the home screen lists nearby stores by category and shows who is open.
2. Browse: a store page shows the menu, prices and opening hours.
3. Order: the customer adds items, gives a unit number and contact number, and chooses cash or GCash. The seller is paid directly.
4. Receive: the order moves through Placed, Accepted, Preparing, On the way and Delivered, and the customer can chat with the seller. The seller delivers; the app does not run couriers.

One difference from the generic four-step story: the app also supports scheduled bookings for services (cleaning, aircon, laundry) with a date and time slot instead of a cart. Those verticals exist in the product; the stores shown for them in the demo are demo data.`);
};
