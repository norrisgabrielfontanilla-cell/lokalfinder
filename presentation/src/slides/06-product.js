// 6 / The Product Experience
module.exports = (kit) => {
  const { TYPE, R, H } = kit;
  const s = kit.scene('LF_LIGHT', { section: 'The Product', label: 'The Product Experience' });

  kit.eyebrow(s, 'The product experience', 0.75, 0.55, { fx: ['fade', 0.05] });
  s.title([R('What exists today: one app, '), R('three sides.', { italic: true, color: 'green' })], { fx: ['rise', 0.15] });
  s.text('Real app screens (v86 build) with demo data. The admin screen shows sample condos, not real ones.', { x: 0.75, y: 1.62, w: 11.8, h: 0.3, size: TYPE.foot, color: 'sage', name: 'Footnote', fx: ['fade', 0.5] });

  const cols = [
    { cx: 2.85, tag: 'Residents', head: 'Order and track', desc: 'Browse stores, order in a few taps, follow it live and chat with the seller.', phone: 'tracker-ready', alt: 'Order tracker showing Out for delivery with five order steps' },
    { cx: 6.67, tag: 'Sellers', head: 'Accept and fulfill', desc: 'Orders arrive in one list. Accept, prepare, deliver; keep the menu up to date.', phone: 'vendor-orders', alt: 'Seller order desk with an incoming order and Accept and Decline buttons' },
    { cx: 10.5, tag: 'The Lokal Finder team', head: 'Approve and plan', desc: 'Approve new stores, watch each store, and plan which communities come next.', phone: 'admin-condos-samples', alt: 'Admin condo pipeline with sample condos at different stages' },
  ];
  const PW = 2.9;
  cols.forEach((c, i) => {
    const t = 0.7 + i * 0.4;
    s.text(c.tag.toUpperCase(), { x: c.cx - 1.9, y: 2.1, w: 3.8, h: 0.3, size: 12, bold: true, track: 3, color: 'green', align: 'center', name: `Tag ${i + 1}` });
    s.text(c.head, { x: c.cx - 1.9, y: 2.38, w: 3.8, h: 0.45, size: 24, bold: true, color: 'ink', align: 'center', font: '+mj-lt', name: `Head ${i + 1}` });
    s.text(c.desc, { x: c.cx - 1.75, y: 2.9, w: 3.5, h: 0.62, size: TYPE.label, color: 'sage', align: 'center', lh: 1.0, name: `Desc ${i + 1}` });
    s.phone(c.phone, { x: c.cx - PW / 2, w: PW, bottom: H, crop: true, name: `Phone ${i + 1}`, alt: `${c.alt} (real app screen, demo data).` });
    s.fx([`Tag ${i + 1}`, `Head ${i + 1}`, `Desc ${i + 1}`], 'rise', t).fx([`Phone ${i + 1}`], 'rise', t + 0.15, 0.8);
  });

  s.notes(
`THE PRODUCT EXPERIENCE (about 1.5 minutes)

This is one installable web app with three sides. Everything on screen exists in the current build; the data inside is demo data.

Residents: the order tracker. A customer follows the order through Placed, Accepted, Preparing, On the way and Delivered, and can chat with the seller. There is also a community feed where stores and neighbors post, and an order history.

Sellers: the order desk. Orders arrive in one list with Accept and Decline. A seller can update status, switch menu items on and off, post to the feed, and see recorded sales. Stores can apply on their own and are approved by the team. Sign-in is a PIN and stays signed in for 30 days.

The Lokal Finder team: the admin console. It approves new stores, shows activity per store, and holds the condo launch pipeline (seven stages from Researching to Live). The pipeline screen here shows sample condos so no real community is implied.

Also in the product but not shown: scheduled bookings for services (date and time slots) for cleaning, aircon and laundry. Those categories exist in the app, but no real store has been onboarded in them; the stores in the demo are demo data.`);
};
