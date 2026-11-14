"""Préparer uniquement les fichiers publics nécessaires aux deux guichets."""

from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
destination = root / "_site"
# Publier seulement cette liste explicite, sans comptes, documents ni configurations privées.
files = [
    "index.html",
    "dev/index.html",
    "dev/app.js",
    "dev/app.css",
    "dev/directory.js",
    "dev/config.json",
]
expected = set(files) | {".nojekyll"}
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
(destination / ".nojekyll").touch()
print("Deux versions préparées : / et /dev/. Aucun document ni fichier privé publié.")
