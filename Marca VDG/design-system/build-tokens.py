"""Genera tokens.json (formato Design Tokens del W3C) a partir de tokens.css.

    python3 build-tokens.py

Lee las propiedades de :root (tema claro) y de :root[data-theme="dark"] (tema oscuro).
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).parent
css = (HERE / 'tokens.css').read_text(encoding='utf-8')


def block(selector):
    match = re.search(re.escape(selector) + r'\s*\{([^}]*)\}', css)
    return dict(re.findall(r'--([\w-]+):\s*([^;]+);', match.group(1))) if match else {}


light = block(':root')
dark = block(':root[data-theme="dark"]')
GROUPS = [('color', 'color'), ('gradient', 'gradient'), ('font', 'fontFamily'), ('text', 'dimension'), ('weight', 'fontWeight'),
          ('leading', 'number'), ('space', 'dimension'), ('radius', 'dimension'), ('shadow', 'shadow'), ('duration', 'duration'), ('ease', 'cubicBezier'),
          ('glass', 'glass')]
# El cristal mezcla tipos: se decide por el nombre del token.
GLASS_TYPES = {'bg': 'color', 'bg-thick': 'color', 'bg-frosted': 'color', 'blur': 'dimension', 'blur-thick': 'dimension',
               'saturate': 'number', 'lens': 'number', 'rim': 'gradient', 'highlight': 'shadow', 'shadow': 'shadow',
               'shadow-raised': 'shadow', 'fill': 'color', 'glow': 'color'}


def resolve(value, table):
    ref = re.fullmatch(r'var\(--([\w-]+)\)', value.strip())
    return '{' + ref.group(1).replace('-', '.', 1) + '}' if ref else value.strip()


tokens = {}
for name, value in light.items():
    group, _, rest = name.partition('-')
    kind = dict(GROUPS).get(group)
    if not kind:
        continue
    if kind == 'glass':
        kind = GLASS_TYPES[rest]
    entry = {'$type': kind, '$value': resolve(value, light)}
    if name in dark:
        entry['$extensions'] = {'mode': {'dark': resolve(dark[name], dark)}}
    tokens.setdefault(group, {})[rest] = entry

tokens['breakpoint'] = {k: {'$type': 'dimension', '$value': v} for k, v in
                        {'wide': '1170px', 'tablet': '940px', 'mobile': '620px', 'small': '385px'}.items()}
(HERE / 'tokens.json').write_text(json.dumps(tokens, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('tokens.json:', sum(len(v) for v in tokens.values()), 'tokens en', len(tokens), 'grupos')
