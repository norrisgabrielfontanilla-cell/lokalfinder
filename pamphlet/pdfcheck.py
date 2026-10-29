#!/usr/bin/env python3
"""Facts about the built PDF, as JSON, plus a 300 dpi picture of page 1 (used by verify.js to scan the QR code).

    python3 pdfcheck.py Lokal_Finder_Pamphlet.pdf out/pdf-page.png
"""
import json
import sys

import fitz  # PyMuPDF

pdf, png = sys.argv[1], sys.argv[2]
doc = fitz.open(pdf)
page = doc[0]

fonts = []
for f in page.get_fonts(full=True):
    xref, base = f[0], f[3]
    try:
        embedded = bool(doc.extract_font(xref)[3])      # (name, ext, type, content): content is empty when the font is not embedded
    except Exception:
        embedded = False
    fonts.append({'name': base, 'embedded': embedded})

sizes = []
for block in page.get_text('dict')['blocks']:
    for line in block.get('lines', []):
        for span in line['spans']:
            if span['text'].strip():
                sizes.append(span['size'])

text = page.get_text()
page.get_pixmap(dpi=300).save(png)
print(json.dumps({
    'pages': doc.page_count,
    'size_pt': [round(page.rect.width, 1), round(page.rect.height, 1)],
    'title': doc.metadata.get('title'),
    'fonts': fonts,
    'min_font_pt': round(min(sizes), 2) if sizes else None,
    'images': len(page.get_images(full=True)),
    'chars': len(text),
    'has_replacement_char': '�' in text,
    'text': text,
}))
