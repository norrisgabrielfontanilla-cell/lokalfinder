#!/usr/bin/env python3
"""Inspect the generated .pptx and prove the motion is really in the package (not just described in notes).

    python3 tools/verify-package.py Lokal_Finder_Premium_Presentation.pptx [--lo]

Checks, per slide:
  * a <p:transition> (Fade, with p14:dur) and its mc:Fallback,
  * a <p:timing> tree whose time-node ids are unique, whose every animation target is a real shape on that slide,
    and whose <p:bldLst> matches the shapes that need an entry (text/auto shapes: bldP, charts: bldGraphic),
  * speaker notes, a real title placeholder with text, alt text on every picture, nothing outside the slide.
With --lo the deck is also round-tripped through LibreOffice to ODP, whose importer builds its own animation
model from <p:timing>; the number of animation nodes it finds is a second, independent confirmation.
Live PowerPoint playback cannot be exercised here and is NOT claimed.
"""
import sys, zipfile, re, os, subprocess, tempfile, collections
from lxml import etree

NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'p14': 'http://schemas.microsoft.com/office/powerpoint/2010/main',
}
EMU_W, EMU_H = 12192000, 6858000      # 13.333in x 7.5in
PRESET = {('10', '0'): 'fade', ('42', '0'): 'rise (float in)', ('22', '8'): 'wipe from left', ('22', '1'): 'wipe from top'}

path = sys.argv[1]
z = zipfile.ZipFile(path)
errors, warnings = [], []
def err(m): errors.append(m)

slides = sorted([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', n)], key=lambda n: int(re.findall(r'\d+', n)[0]))
print(f'{os.path.basename(path)}: {len(slides)} slides, {os.path.getsize(path) / 1048576:.1f} MB')
print(f'{"#":>2} {"transition":<12} {"effects":>7} {"first":<11} {"ends at":>8}  effect mix')
tot_eff = 0
for n in slides:
    idx = int(re.findall(r'\d+', n)[0])
    root = etree.fromstring(z.read(n))
    # ── transition ──
    tr = root.xpath('//mc:AlternateContent/mc:Choice/p:transition', namespaces=NS)
    fb = root.xpath('//mc:AlternateContent/mc:Fallback/p:transition', namespaces=NS)
    ttxt = '-'
    if not tr or not fb:
        err(f'slide {idx}: no transition (Choice + Fallback)')
    else:
        dur = tr[0].get('{%s}dur' % NS['p14'])
        kind = etree.QName(tr[0][0]).localname
        ttxt = f'{kind} {int(dur) / 1000:.1f}s'
        if kind != 'fade' or not dur: err(f'slide {idx}: unexpected transition {kind}/{dur}')
    # ── shapes on the slide ──
    allids = root.xpath('//p:cNvPr/@id', namespaces=NS)
    dup = [k for k, v in collections.Counter(allids).items() if v > 1]
    if dup: err(f'slide {idx}: duplicate shape ids {dup}')
    ids = {}
    for el in root.xpath('//p:cSld/p:spTree/*[self::p:sp or self::p:pic or self::p:graphicFrame or self::p:grpSp or self::p:cxnSp]', namespaces=NS):
        c = el.xpath('.//p:cNvPr', namespaces=NS)[0]
        ids[c.get('id')] = (etree.QName(el).localname, c.get('name'), el)
    # titles, alt text, bounds
    titles = [v for v in ids.values() if v[2].xpath('.//p:ph[@type="title"]', namespaces=NS)]
    if not titles or not ''.join(titles[0][2].xpath('.//a:t/text()', namespaces=NS)).strip(): err(f'slide {idx}: no title text')
    for k, (kind, name, el) in ids.items():
        if kind == 'pic':
            d = el.xpath('.//p:cNvPr/@descr', namespaces=NS)
            if not d or not d[0].strip(): err(f'slide {idx}: picture "{name}" has no alt text')
            # an empty altText makes pptxgenjs fall back to the image's file path: that is not alt text
            elif re.search(r'(^|[\s(])/[\w.-]+/|[A-Za-z]:\\|\.(png|jpe?g|svg|gif)\b|assets/', d[0]): err(f'slide {idx}: picture "{name}" alt text looks like a file path: {d[0][:70]}')
        off = el.xpath('.//a:xfrm/a:off | .//p:xfrm/a:off', namespaces=NS); ext = el.xpath('.//a:xfrm/a:ext | .//p:xfrm/a:ext', namespaces=NS)
        if off and ext and not el.xpath('.//p:ph[@type="sldNum"]', namespaces=NS):
            x, y, w, h = int(off[0].get('x')), int(off[0].get('y')), int(ext[0].get('cx')), int(ext[0].get('cy'))
            if x < -9000 or y < -9000 or x + w > EMU_W + 9000 or y + h > EMU_H + 9000:
                err(f'slide {idx}: "{name}" extends outside the slide ({x / 914400:.2f},{y / 914400:.2f} {w / 914400:.2f}x{h / 914400:.2f}in)')
    # notes
    rel = z.read(f'ppt/slides/_rels/slide{idx}.xml.rels').decode()
    m = re.search(r'Target="\.\./notesSlides/(notesSlide\d+\.xml)"', rel)
    if not m: err(f'slide {idx}: no speaker notes')
    else:
        nt = ''.join(etree.fromstring(z.read('ppt/notesSlides/' + m.group(1))).xpath('//a:t/text()', namespaces=NS))
        if len(nt) < 200: err(f'slide {idx}: speaker notes are very short ({len(nt)} chars)')
    # ── timing ──
    tm = root.xpath('//p:timing', namespaces=NS)
    if not tm:
        err(f'slide {idx}: no <p:timing>')
        print(f'{idx:>2} {ttxt:<12} {0:>7}')
        continue
    tm = tm[0]
    ctn = [c.get('id') for c in tm.xpath('.//p:cTn', namespaces=NS)]
    if len(ctn) != len(set(ctn)): err(f'slide {idx}: duplicate time-node ids')
    if sorted(map(int, ctn)) != list(range(1, len(ctn) + 1)): err(f'slide {idx}: time-node ids are not 1..{len(ctn)}')
    tg = set(tm.xpath('.//p:spTgt/@spid', namespaces=NS))
    for t in tg:
        if t not in ids: err(f'slide {idx}: animation targets shape id {t}, which is not on the slide')
    effects = tm.xpath('.//p:cTn[@presetClass="entr"]', namespaces=NS)
    mix = collections.Counter()
    ends = 0.0
    for e in effects:
        key = (e.get('presetID'), e.get('presetSubtype'))
        mix[PRESET.get(key, str(key))] += 1
        delay = int(e.xpath('./p:stCondLst/p:cond/@delay', namespaces=NS)[0])
        dur = max(int(d) for d in e.xpath('.//p:animEffect/p:cBhvr/p:cTn/@dur', namespaces=NS))
        ends = max(ends, (delay + dur) / 1000)
        tgt = e.xpath('.//p:spTgt/@spid', namespaces=NS)[0]
        kind = ids[tgt][0]
        has_grp = e.get('grpId') is not None
        if kind in ('sp', 'graphicFrame') and not has_grp: err(f'slide {idx}: effect on {kind} "{ids[tgt][1]}" lacks grpId')
        if kind == 'pic' and has_grp: err(f'slide {idx}: effect on a picture should not carry grpId')
    bp = set(tm.xpath('.//p:bldLst/p:bldP/@spid', namespaces=NS)); bg = set(tm.xpath('.//p:bldLst/p:bldGraphic/@spid', namespaces=NS))
    for t in tg:
        kind = ids[t][0]
        if kind == 'sp' and t not in bp: err(f'slide {idx}: no <p:bldP> for shape "{ids[t][1]}"')
        if kind == 'graphicFrame' and t not in bg: err(f'slide {idx}: no <p:bldGraphic> for chart "{ids[t][1]}"')
    nodes = tm.xpath('.//p:cTn[@presetClass="entr"]/@nodeType', namespaces=NS)
    if nodes and (nodes[0] != 'afterEffect' or any(x != 'withEffect' for x in nodes[1:])): err(f'slide {idx}: unexpected nodeTypes {nodes[:3]}')
    if ends > 4.5: warnings.append(f'slide {idx}: animation runs {ends:.1f}s (long)')
    tot_eff += len(effects)
    print(f'{idx:>2} {ttxt:<12} {len(effects):>7} {nodes[0] if nodes else "-":<11} {ends:>7.1f}s  ' + ', '.join(f'{v} {k}' for k, v in mix.most_common()))

print(f'\ntotal animated objects: {tot_eff}')
sec = z.read('ppt/presentation.xml').decode()
print('sections:', re.findall(r'<p14:section name="([^"]+)"', sec))
th = z.read('ppt/theme/theme1.xml').decode()
print('theme:', re.search(r'<a:theme [^>]*name="([^"]+)"', th).group(1), '| fonts:', re.findall(r'<a:(?:major|minor)Font><a:latin typeface="([^"]+)"', th))

if '--lo' in sys.argv:
    sk = os.environ.get('SOFFICE', 'soffice').split()
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(sk + ['--headless', '--convert-to', 'odp', '--outdir', d, os.path.abspath(path)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
        odp = zipfile.ZipFile(os.path.join(d, os.path.splitext(os.path.basename(path))[0] + '.odp'))
        c = odp.read('content.xml').decode()
        pages = len(re.findall(r'<draw:page ', c))
        par = len(re.findall(r'<anim:par ', c)); tr = len(re.findall(r'<anim:transitionFilter ', c)); st = len(re.findall(r'<anim:set ', c))
        trans = len(re.findall(r'smil:type="fade"', c)) + len(re.findall(r'presentation:transition-type', c))
        print(f'LibreOffice import: {pages} pages, {par} animation nodes (anim:par), {tr} transitionFilter, {st} set, transition attributes: {trans}')

for w in warnings: print('WARN ', w)
if errors:
    print(f'\n{len(errors)} PROBLEM(S):')
    for e in errors: print('  -', e)
    sys.exit(1)
print('\nOK: every slide has a Fade transition, a valid animation tree with real targets, notes, a title and alt text.')
