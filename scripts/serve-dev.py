"""Entrée de développement locale, sans copier l'interface publique."""
import argparse
import json
from urllib.parse import urlsplit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOGIN = '''<section><h1>Annuaire de développement</h1>
<p>Données fictives uniquement. Comptes attribués par le service, sans inscription publique.</p>
<form id="login"><div class="fields">
<label>Adresse du compte<input name="email" type="email" required autocomplete="username"></label>
<label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
</div><button name="submit">Se connecter</button><p id="loginMsg" role="status"></p></form>
<p id="sessionProfile" hidden></p><p id="syncStatus" role="status"></p></section>'''


def dev_page(url):
    page = (ROOT / 'index.html').read_text(encoding='utf-8')
    # Conserver les empreintes des scripts/styles de la page autonome.
    page = page.replace("; style-src", " 'self'; style-src", 1)
    page = page.replace("connect-src 'none'", "connect-src 'self' " + url)
    page = page.replace('<main>', LOGIN + '<main hidden>', 1)
    return page.replace('<script>', '<script src="/dev/directory.js"></script><script>', 1)


def handler(url, anon_key):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            resources = {
                '/': ('text/html', (ROOT / 'index.html').read_text(encoding='utf-8')),
                '/index.html': ('text/html', (ROOT / 'index.html').read_text(encoding='utf-8')),
                '/dev.html': ('text/html', dev_page(url)),
                '/dev/directory.js': ('text/javascript', (ROOT / 'dev/directory.js').read_text(encoding='utf-8')),
                '/dev/config': ('application/json', json.dumps({'url': url, 'anonKey': anon_key})),
            }
            content = resources.get(self.path)
            if not content:
                self.send_error(404)
                return
            data = content[1].encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', content[0] + '; charset=utf-8')
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_):
            pass  # Pas de carte ni de contenu de formulaire dans les journaux.

    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--config', type=Path, default=ROOT / '.env.local.json')
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding='utf-8-sig'))
    print(f'Démonstration : http://127.0.0.1:{args.port}/\nDéveloppement : http://127.0.0.1:{args.port}/dev.html', flush=True)
    url = config['SUPABASE_URL'].rstrip('/')
    parsed = urlsplit(url)
    if not ((parsed.scheme == 'https' and parsed.hostname and parsed.hostname.endswith('.supabase.co')) or url == 'http://127.0.0.1:54321') or parsed.path or parsed.query or parsed.fragment or parsed.username:
        raise SystemExit('Utiliser une origine Supabase HTTPS ou http://127.0.0.1:54321.')
    ThreadingHTTPServer(('127.0.0.1', args.port), handler(url, config['ANON_KEY'])).serve_forever()
