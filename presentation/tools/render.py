#!/usr/bin/env python3
"""Render a .pptx to PNGs for visual QA:  python3 tools/render.py out/Lokal_Finder_Premium_Presentation.pptx [dpi] [slide numbers...]

LibreOffice converts the deck to PDF (set SOFFICE to a wrapper command if a bare `soffice` hangs on your machine),
then PyMuPDF rasterises each page. LibreOffice shows the FINAL state of every slide: it does not play transitions or
animations, so those are verified separately (tools/verify-package.js).
"""
import os, subprocess, sys, shutil, glob

deck = sys.argv[1]
dpi = int(sys.argv[2]) if len(sys.argv) > 2 else 110
only = {int(a) for a in sys.argv[3:]}
out = os.path.join(os.path.dirname(os.path.abspath(deck)), 'out', 'render')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)

soffice = os.environ.get('SOFFICE', 'soffice').split()
cmd = soffice + ['--headless', '--convert-to', 'pdf', '--outdir', out, deck]
subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=240)
pdf = os.path.join(out, os.path.splitext(os.path.basename(deck))[0] + '.pdf')

import warnings
warnings.filterwarnings('ignore')
import pymupdf
doc = pymupdf.open(pdf)
for i, page in enumerate(doc, 1):
    if only and i not in only:
        continue
    page.get_pixmap(dpi=dpi).save(os.path.join(out, f'slide-{i:02d}.png'))
print(f'{len(doc)} pages -> {out}')
