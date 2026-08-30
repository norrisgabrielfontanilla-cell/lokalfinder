# Shared brand kit for the Lokal Finder print pieces.
# Every value below is lifted verbatim from index.html — do not "tidy" them.
QR = open('/tmp/claude-0/-home-user-lokalfinder/b70a08a9-fd15-53ab-b89b-147b3164c43c/scratchpad/qr.txt').read().strip()
URL = 'norrisgabrielfontanilla-cell.github.io/lokalfinder'

FD = "'Bricolage Grotesque','Helvetica Neue',Arial,sans-serif"
FS = "'Fraunces',Georgia,'Times New Roman',serif"
FF = "'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif"

HEAD = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@1,9..144,600&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap">
  <style>
    body { margin: 0; }
    a { color: #0E8A5A; text-decoration: none; }
    a:hover { color: #0F4A32; }
    * { box-sizing: border-box; }
  </style>
</helmet>
'''
FOOT = '</x-dc>\n</body>\n</html>\n'

def qr(size, color='#0D2B1A'):
    return ('<svg viewBox="0 0 37 37" width="%d" height="%d" shape-rendering="crispEdges" '
            'xmlns="http://www.w3.org/2000/svg" role="img" '
            'aria-label="QR code linking to the Lokal Finder app">'
            '<rect width="37" height="37" fill="#FFFFFF"/>'
            '<path stroke="%s" d="%s"/></svg>') % (size, size, color, QR)

def mark(h, ring='#2ea877', body='#1a5438', win='#EFF7F2'):
    w = round(h * 48 / 56)
    return ('<svg viewBox="0 0 48 56" width="%d" height="%d" fill="none" '
            'xmlns="http://www.w3.org/2000/svg" style="display:block;flex:none">'
            '<path d="M24 2C13.5 2 5 10.5 5 21c0 15 19 33 19 33S43 36 43 21C43 10.5 34.5 2 24 2Z" '
            'fill="%s" stroke="%s" stroke-width="2"/>'
            '<path d="M14 27v-8l10-8 10 8v8" stroke="%s" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
            '<path d="M18 27v10h12V27" stroke="%s" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
            '<rect x="21" y="30" width="6" height="7" rx="1" fill="%s" opacity=".7"/>'
            '<circle cx="24" cy="20" r="2.5" fill="#F5C842"/></svg>') % (w, h, body, ring, ring, win, ring)

def star(size=13, color='#F59E0B'):
    return ('<svg viewBox="0 0 24 24" width="%d" height="%d" fill="%s" style="display:block;flex:none">'
            '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>' % (size, size, color))

def check(size=17, color='#0E8A5A', sw=3):
    return ('<svg viewBox="0 0 24 24" width="%d" height="%d" fill="none" stroke="%s" stroke-width="%s" '
            'stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none">'
            '<polyline points="20 6 9 17 4 12"/></svg>' % (size, size, color, sw))

def wordmark(px, light=False):
    c1 = '#FFFFFF' if light else '#0D2B1A'
    c2 = '#12B76A' if light else '#0E8A5A'
    return ('<div style="font-family:%s;font-weight:700;font-size:%dpx;letter-spacing:-.03em;line-height:1;color:%s">'
            'Lokal<span style="font-family:%s;font-style:italic;font-weight:600;color:%s">Finder</span></div>'
            ) % (FD, px, c1, FS, c2)

# Vendor glyphs. Deliberately NOT the app's emoji: emoji depend on a colour
# emoji font being present, and a print shop's renderer often has none —
# they drop to tofu or an unrelated glyph. These are stroke drawings, so they
# print crisply and survive greyscale.
_G = {
 'bowl':   '<path d="M2.5 10.5h19a9.5 9.5 0 0 1-19 0Z"/><path d="M9 7.5c0-1.6 1-1.6 1-3.2M14 7.5c0-1.6 1-1.6 1-3.2"/>',
 'siomai': '<path d="M3.5 15.5a8.5 8.5 0 0 1 17 0Z"/><path d="M2.5 15.5h19"/><path d="M8.5 15.5v-3.2M12 15.5v-4.4M15.5 15.5v-3.2"/>',
 'cup':    '<path d="M3.5 6.5h12v6.8a6 6 0 0 1-12 0Z"/><path d="M15.5 8.5h2a2.6 2.6 0 0 1 0 5.2h-2"/><path d="M3 20.5h14"/>',
 'egg':    '<path d="M20 13.5c0 3.3-3.6 5.5-8 5.5s-8-2.2-8-5.5S7 5 11 5s9 5.2 9 8.5Z"/><circle cx="11.5" cy="12.5" r="2.8"/>',
 'spray':  '<path d="M8.5 9.5h6.5v10.5h-6.5z"/><path d="M10 9.5V6.2h3.5v3.3"/><path d="M15 4.2h3.4M15 6.6h2.3"/>',
}
def glyph(kind, size=20, color='#0F4A32', sw=1.7):
    return ('<svg viewBox="0 0 24 24" width="%d" height="%d" fill="none" stroke="%s" '
            'stroke-width="%s" stroke-linecap="round" stroke-linejoin="round" '
            'style="display:block;flex:none">%s</svg>') % (size, size, color, sw, _G[kind])
