#!/usr/bin/env python3
"""Builds the three Entrava pages from src/. No dependencies: run `python3 build.py`.

  index.html          fan site        (entrava.com)
  host/index.html     host site       (host.entrava.com)
  checkin/index.html  check-in site   (checkin.entrava.com)

Each page is self-contained. The only difference between them is the data-site
attribute on <html>, which src/app.js reads to decide which site to show.
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
read = lambda p: open(os.path.join(ROOT, "src", p), encoding="utf-8").read()
css, body, js = read("style.css"), read("body.html"), read("app.js")

PAGES = [  # (output path, site key, path back to the repo root, page title)
    ("index.html", "main", "./", "Entrava: show tickets that can't be faked"),
    ("host/index.html", "host", "../", "Entrava for hosts"),
    ("checkin/index.html", "gate", "../", "Entrava check-in"),
]

for out, site, base, title in PAGES:
    html = f"""<!doctype html>
<html lang="en" data-site="{site}" data-base="{base}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">
<style>
{css}</style>
</head>
<body>
{body}
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script>
{js}</script>
</body>
</html>
"""
    path = os.path.join(ROOT, out)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(html)
    print(f"built {out} ({len(html) // 1024} KB)")
