"""Entrée de développement locale, sans copier l'interface publique."""

import argparse
import hashlib
import json
import re
from urllib.parse import urlsplit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGIN = """<section><h1>Guichet partagé de développement</h1>
<p>Données fictives uniquement. Comptes attribués par le service, sans inscription publique.</p>
<form id="login"><div class="fields">
<label>Adresse du compte<input name="email" type="email" required autocomplete="username"></label>
<label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
</div><button name="submit" disabled>Se connecter</button><p id="loginMsg" role="status"></p></form>
<p id="sessionProfile" hidden></p><p id="syncStatus" role="status"></p></section>"""


# Dériver la page connectée de la construction autonome et adapter sa politique CSP.
def dev_page(url):
    page = (ROOT / "index.html").read_text(encoding="utf-8")

    # Une nouvelle source reçoit une nouvelle URL : le cache ne mélange pas les versions.
    def asset(name):
        digest = hashlib.sha256((ROOT / "dev" / name).read_bytes()).hexdigest()[:16]
        return f"/dev/{name}?v={digest}"

    # Conserver les empreintes des scripts/styles de la page autonome.
    page = page.replace("; style-src", " 'self'; style-src", 1)
    page = page.replace("; connect-src", " 'self'; connect-src", 1)
    page = page.replace(
        "</style>", f'</style><link rel="stylesheet" href="{asset("app.css")}">', 1
    )
    page = page.replace("connect-src 'none'", "connect-src 'self' " + url)
    page = page.replace("<main>", LOGIN + "<main hidden>", 1)
    return re.sub(
        r"<script>.*?</script>",
        f'<script src="{asset("directory.js")}"></script><script src="{asset("app.js")}"></script>',
        page,
        flags=re.S,
    )


def handler(url, anon_key):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            # Liste fermée : aucun fichier privé du dépôt ne doit être servi.
            resources = {
                "/": ("text/html", (ROOT / "index.html").read_text(encoding="utf-8")),
                "/index.html": (
                    "text/html",
                    (ROOT / "index.html").read_text(encoding="utf-8"),
                ),
                "/dev.html": ("text/html", dev_page(url)),
                "/dev/directory.js": (
                    "text/javascript",
                    (ROOT / "dev/directory.js").read_text(encoding="utf-8"),
                ),
                "/dev/app.js": (
                    "text/javascript",
                    (ROOT / "dev/app.js").read_text(encoding="utf-8"),
                ),
                "/dev/app.css": (
                    "text/css",
                    (ROOT / "dev/app.css").read_text(encoding="utf-8"),
                ),
                "/dev/config": (
                    "application/json",
                    json.dumps({"url": url, "anonKey": anon_key}),
                ),
                "/dev/config.json": (
                    "application/json",
                    json.dumps({"url": url, "anonKey": anon_key}),
                ),
                "/dev/index.html": (
                    "text/html",
                    (
                        (ROOT / "dev/index.html").read_text(encoding="utf-8")
                        if (ROOT / "dev/index.html").exists()
                        else dev_page(url)
                    ),
                ),
            }
            # Les paramètres de version ne modifient pas la liste des fichiers autorisés.
            content = resources.get(urlsplit(self.path).path)
            if not content:
                self.send_error(404)
                return
            data = content[1].encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", content[0] + "; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_):
            pass  # Pas de carte ni de contenu de formulaire dans les journaux.

    return Handler


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--config", type=Path, default=ROOT / ".env.local.json")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8-sig"))
    url = (config.get("SUPABASE_URL") or config["url"]).rstrip("/")
    parsed = urlsplit(url)
    if (
        not (
            (
                parsed.scheme == "https"
                and parsed.hostname
                and parsed.hostname.endswith(".supabase.co")
            )
            or url == "http://127.0.0.1:54321"
        )
        or parsed.path
        or parsed.query
        or parsed.fragment
        or parsed.username
    ):
        raise SystemExit(
            "Utiliser une origine Supabase HTTPS ou http://127.0.0.1:54321."
        )
    server = ThreadingHTTPServer(
        ("127.0.0.1", args.port),
        handler(url, config.get("ANON_KEY") or config["anonKey"]),
    )
    port = server.server_address[1]
    print(
        f"Démonstration : http://127.0.0.1:{port}/\nDéveloppement : http://127.0.0.1:{port}/dev.html",
        flush=True,
    )
    server.serve_forever()
