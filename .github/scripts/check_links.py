"""Check that local href/src targets in the built HTML exist in the repo."""
import pathlib
import re
import sys
from urllib.parse import unquote, urlsplit

root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
attr = re.compile(r'(?:href|src)\s*=\s*"([^"]+)"')
missing = []
checked = 0
pages = [p for p in root.rglob("*.html") if ".git" not in p.parts]
for page in pages:
    for url in attr.findall(page.read_text(encoding="utf-8", errors="replace")):
        parts = urlsplit(url)
        if parts.scheme or parts.netloc or url.startswith(("#", "mailto:", "tel:", "data:", "javascript:")):
            continue
        path = unquote(parts.path)
        if not path:
            continue
        target = (root / path.lstrip("/")) if path.startswith("/") else (page.parent / path)
        if target.is_dir() or path.endswith("/"):
            target = target / "index.html"
        checked += 1
        if not target.exists():
            missing.append(f"{page.relative_to(root)}: {url}")
print(f"checked {checked} local links in {len(pages)} HTML files")
if missing:
    print("missing local targets:")
    print("\n".join(sorted(set(missing))))
    sys.exit(1)
