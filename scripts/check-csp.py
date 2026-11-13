"""Vérifier les empreintes CSP ; --write les recalcule après édition."""
import base64
import hashlib
import re
import sys
from pathlib import Path

page = Path(__file__).resolve().parents[1] / 'index.html'
text = page.read_text(encoding='utf-8')
for tag, directive in [('script', 'script-src'), ('style', 'style-src')]:
    inline = re.search(f'<{tag}>(.*?)</{tag}>', text, re.S).group(1)
    digest = base64.b64encode(hashlib.sha256(inline.encode()).digest()).decode()
    rule = directive + " 'sha256-" + digest + "'"
    if '--write' in sys.argv:
        text = re.sub(directive + r" 'sha256-[^']+'", rule, text)
    elif rule not in text:
        raise SystemExit('Empreinte incorrecte : ' + directive)
if '--write' in sys.argv:
    page.write_text(text, encoding='utf-8', newline='\n')
print('Empreintes CSP vérifiées.')
