"""Préparer le guichet connecté pour GitHub Pages."""

from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
destination = root / "_site"
# Publier seulement cette liste explicite, sans comptes, documents ni configurations privées.
files = [
    "dev/index.html",
    "dev/app.js",
    "dev/app.css",
    "dev/directory.js",
    "dev/config.json",
]
expected = set(files) | {"index.html", ".nojekyll"}
if destination.exists():
    unexpected = {
        p.relative_to(destination).as_posix()
        for p in destination.rglob("*")
        if p.is_file()
    } - expected
    if unexpected:
        raise SystemExit("Le dossier de publication contient des fichiers inattendus.")
for name in files:
    target = destination / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / name, target)
# Les deux adresses existantes ouvrent le même guichet, avec les mêmes ressources.
entry = (root / "dev/index.html").read_text(encoding="utf-8")
for asset in ("app.css", "app.js", "directory.js"):
    entry = entry.replace(f'"./{asset}?', f'"./dev/{asset}?')
(destination / "index.html").write_text(entry, encoding="utf-8", newline="\n")
(destination / ".nojekyll").touch()
print("Ludion connecté préparé à la racine et sous /dev/. Démonstration réservée aux tests locaux.")
