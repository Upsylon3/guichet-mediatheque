"""Construire la démonstration autonome avec les parcours communs."""

from pathlib import Path
import json
import subprocess, sys

root = Path(__file__).resolve().parents[1]
template = root / "templates/guichet.html"
page = template.read_text(encoding="utf-8")
style = (root / "dev/app.css").read_text(encoding="utf-8")
script = (
    "const videoSchedule = "
    + json.dumps(
        json.loads((root / "dev/video-schedule.json").read_text(encoding="utf-8")),
        ensure_ascii=False,
    )
    + ";\n"
    + (root / "dev/sample-data.js").read_text(encoding="utf-8")
    + "\n"
    + (root / "dev/demo.js").read_text(encoding="utf-8")
    + "\n"
    + (root / "dev/app.js").read_text(encoding="utf-8")
)
# Assembler les sources communes ; les pages produites ne se modifient pas à la main.
page = page.replace("</style>", style + "\n</style>").replace(
    "<!-- APPLICATION -->", "<script>\n" + script + "\n</script>"
)
(root / "index.html").write_text(page, encoding="utf-8", newline="\n")
subprocess.run(
    [sys.executable, str(root / "scripts/check-csp.py"), "--write"], check=True
)
