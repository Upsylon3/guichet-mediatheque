"""Construire l'entrée statique connectée avec une clé publique, jamais un secret."""

import base64
import argparse
import importlib.util
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--config", type=Path, default=root / "dev/config.json")
args = parser.parse_args()
config = json.loads(args.config.read_text(encoding="utf-8-sig"))
key = config.get("ANON_KEY") or config["anonKey"]
# Refuser une clé secrète avant toute écriture dans les fichiers publics.
if not key.startswith("sb_publishable_"):
    try:
        payload = json.loads(base64.urlsafe_b64decode(key.split(".")[1] + "=="))
        assert payload["role"] == "anon"
    except Exception:
        raise SystemExit(
            "La publication nécessite une clé publishable ou anon. Aucune clé secrète n’est autorisée."
        )
url = (config.get("SUPABASE_URL") or config["url"]).rstrip("/")
if not url.startswith("https://") or not url.endswith(".supabase.co"):
    raise SystemExit(
        "Utiliser l’origine HTTPS du projet Supabase distant de développement."
    )
spec = importlib.util.spec_from_file_location(
    "guichet_server", root / "scripts/serve-dev.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
page = (
    module.dev_page(url)
    .replace("/dev/directory.js", "./directory.js")
    .replace("/dev/app.js", "./app.js")
    .replace("/dev/app.css", "./app.css")
)
(root / "dev/index.html").write_text(page, encoding="utf-8", newline="\n")
(root / "dev/config.json").write_text(
    json.dumps({"url": url, "anonKey": key}, indent=2) + "\n", encoding="utf-8"
)
print(
    "Entrée statique créée : dev/index.html. Configuration publique uniquement ; comptes et mots de passe exclus."
)
