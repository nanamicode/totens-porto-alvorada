"""Junta site/index.html, css/ e js/ num único arquivo em dist/totens.html.

Útil para compartilhar o simulador como um arquivo só (por exemplo, como artifact).
Uso: python tools/bundle.py
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
site = root / 'site'
html = (site / 'index.html').read_text(encoding='utf-8')


def inline_css(m):
    return '<style>\n' + (site / m.group(1)).read_text(encoding='utf-8') + '</style>'


def inline_js(m):
    return '<script>\n' + (site / m.group(1)).read_text(encoding='utf-8') + '</script>'


html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', inline_css, html)
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_js, html)

out = root / 'dist' / 'totens.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(f'{out.relative_to(root)}: {len(html) / 1024:.0f} KB')
