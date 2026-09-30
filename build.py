"""Kaynak parçaları tek dosyalık index.html'e birleştirir: python3 build.py"""
from pathlib import Path
R = Path(__file__).parent
S = R / "src"
def rd(n):
    p = S / n
    return p.read_text(encoding="utf-8") if p.exists() else ""
IMPORTMAP = '{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}'
html = f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kat Planı Tasarımı</title>
<style>
{rd('styles.css')}
{rd('view3d.css')}
</style>
<script type="importmap">{IMPORTMAP}</script>
</head>
<body>
{rd('shell.html')}
<script>
{rd('data.js')}
</script>
<script>
{rd('app.js')}
</script>
<script type="module">
{rd('models3d.js')}
</script>
<script type="module">
{rd('view3d.js')}
</script>
</body>
</html>
"""
(R / "index.html").write_text(html, encoding="utf-8")
print(f"index.html: {len(html)//1024} KB")

# Artifact sürümü: yayın sırasında iskelet (doctype/head/body) eklendiği için yalnızca içerik
body = html.split("<body>\n", 1)[1].rsplit("</body>", 1)[0]
head = html.split("<head>\n", 1)[1].split("</head>", 1)[0]
head = head.replace('<meta charset="utf-8">\n', "").replace('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n', "")
(R / "temp").mkdir(exist_ok=True)
(R / "temp" / "kat-plani-artifact.html").write_text(head + body, encoding="utf-8")
