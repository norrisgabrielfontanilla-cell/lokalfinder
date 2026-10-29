// The Lokal Finder presentation design system: colours, type scale, grid.
// Every value comes from the product itself: the CSS tokens in /index.html (:root), the landing site's
// tailwind.config.js, and /manifest.webmanifest. Nothing here is invented brand identity.
//
//   --g  #0E8A5A  primary green            --gd #0F4A32  deep forest          --gl #E6F7EF  mint tint
//   --gm #12B76A  bright mint              --lgreen #1A6B4A  brand dark       --t1 #0D2B1A  ink
//   --acc #F59E0B amber (the one warm accent)   logo dot #F5C842 (gold)       --t3 #6B8F7A  sage text
//   --s2 #F0F7F3 / --s3 #E2F0E9 surfaces        manifest background #06120c (the night used behind the art)
//
// Fonts: the product uses Fraunces (display), Plus Jakarta Sans (body) and Bricolage Grotesque (the wordmark).
// Those are not installed on most computers and PowerPoint cannot embed them reliably, so the editable text in this
// deck uses Cambria (editorial serif) and Calibri (body), both shipped with Office. The wordmark and the app screens
// are pictures, so they keep the real brand fonts.
const THEME = {
  name: 'Lokal Finder',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '0D2B1A',      // ink: text on light slides
    lt1: 'FFFFFF',
    dk2: '0F4A32',      // deep forest: dark surfaces
    lt2: 'F0F7F3',      // mist: light slide surface
    accent1: '0E8A5A',  // primary green
    accent2: '12B76A',  // bright mint
    accent3: 'F59E0B',  // amber: the only warm accent, used for emphasis and "to be proven"
    accent4: '1A6B4A',  // brand dark green (the "Finder" in the wordmark)
    accent5: '6B8F7A',  // sage: secondary text
    accent6: 'F5C842',  // gold: the dot in the logo
    hlink: '0E8A5A',
    folHlink: '6B8F7A',
  },
};

// Hex twins for the few places PowerPoint needs a literal colour (chart parts, shadows, pictures' text, rendered art).
const HEX = {
  ink: '0D2B1A', white: 'FFFFFF', forest: '0F4A32', mist: 'F0F7F3', green: '0E8A5A', mint: '12B76A', amber: 'F59E0B',
  brand: '1A6B4A', sage: '6B8F7A', sageDark: '4A6B5A', gold: 'F5C842', night: '06120C', mintLight: '3FD39B', tint: 'E6F7EF', line: 'D5E6DC',
  danger: 'DC2626',
};

// 16:9 widescreen, 13.333in x 7.5in. A 12-column grid, 0.75in outer margins, 0.25in gutters.
const W = 12192000 / 914400, H = 6858000 / 914400;   // exactly the slide: 13.3333in x 7.5in
const M = { l: 0.75, r: 0.75, t: 0.6, b: 0.55 };
const CW = W - M.l - M.r;                       // 11.833in content width
const COL = (CW - 11 * 0.25) / 12;              // one column
const colX = (i) => M.l + i * (COL + 0.25);     // left edge of column i (0..11)
const colW = (n) => n * COL + (n - 1) * 0.25;   // width of n columns

// Type scale (pt). Nothing smaller than 12pt except the footer slide number (11pt).
const TYPE = { display: 80, hero: 120, h1: 40, h2: 28, h3: 22, lede: 20, body: 17, label: 15, small: 13, eyebrow: 13, foot: 12 };

module.exports = { THEME, HEX, W, H, M, CW, COL, colX, colW, TYPE };
