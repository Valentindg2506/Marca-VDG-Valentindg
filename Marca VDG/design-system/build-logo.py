"""Dibuja el logo VDG de una tinta con geometría y la versión horizontal con «valentindg» al lado.

    pip install fonttools brotli uharfbuzz && python3 build-logo.py

Escribe en assets/logo/ vdg-tinta.svg, vdg-blanco.svg, vdg-horizontal-tinta.svg y vdg-horizontal-blanco.svg.

El logo son tres formas: la V y dos trazos que se cruzan (barra superior de la D que baja hasta la G,
y barra inferior de la D que sube hasta la barra superior de la G). Todas las barras miden W de alto,
las diagonales tienen pendiente fija y las esquinas son arcos de radio constante. Si cambias una medida,
copia el path resultante a js/components/logo.js e icons/ de la plantilla y al símbolo #vdg-logo del manual
(el del nombre va en el símbolo #vdg-nombre).
"""
import io
import math
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

W = 80                  # alto de las barras horizontales
TOP, BOTTOM = 0, 383    # línea superior e inferior del logo
K_V = 0.7               # pendiente (avance horizontal por unidad vertical) de la V y de los cortes en las puntas
K_X = 0.62              # pendiente de las dos diagonales que se cruzan
CROSS = (712, 191)      # punto donde se cruzan las diagonales
HALF = 54               # medio ancho horizontal de cada diagonal


def rounded(points):
    """points: [(x, y, radio)] en sentido horario. Devuelve un path con un arco en cada esquina."""
    corners = []
    for i, (x, y, r) in enumerate(points):
        (px, py, _), (nx, ny, _) = points[i - 1], points[(i + 1) % len(points)]
        la, lb = math.hypot(px - x, py - y), math.hypot(nx - x, ny - y)
        ua, ub = ((px - x) / la, (py - y) / la), ((nx - x) / lb, (ny - y) / lb)
        half_angle = math.acos(max(-1.0, min(1.0, ua[0] * ub[0] + ua[1] * ub[1]))) / 2
        t = min(r / math.tan(half_angle), la / 2, lb / 2)
        corners.append(((x + ua[0] * t, y + ua[1] * t), (x + ub[0] * t, y + ub[1] * t),
                        t * math.tan(half_angle), int(ua[0] * ub[1] - ua[1] * ub[0] < 0)))
    n = lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')
    d = f'M{n(corners[0][1][0])} {n(corners[0][1][1])}'
    for start, end, radius, sweep in corners[1:] + corners[:1]:
        d += f'L{n(start[0])} {n(start[1])}A{n(radius)} {n(radius)} 0 0 {sweep} {n(end[0])} {n(end[1])}'
    return d + 'Z'


def logo_path():
    top2, bottom2 = TOP + W, BOTTOM - W
    cx, cy = CROSS
    a = lambda y, side: cx + K_X * (y - cy) + side * HALF    # trazo que baja: D → G
    b = lambda y, side: cx - K_X * (y - cy) + side * HALF    # trazo que sube: D → G

    notch_x, notch_y, arm_top, arm_tip = 291, 263, 121, 499
    v_bottom = (arm_tip + K_V * arm_top + K_V * TOP) / (2 * K_V)
    v = [(0, TOP, 4), (notch_x - K_V * (notch_y - TOP), TOP, 50), (notch_x, notch_y, 4),
         (notch_x + K_V * (notch_y - arm_top), arm_top, 45), (arm_tip, arm_top, 4), (K_V * v_bottom, v_bottom, 52)]

    g_hole, g_right, g_arm_top, g_arm_bottom, g_arm_tip = 1019, 1098, 151, 233, 826
    down = [(293, TOP, 4), (a(TOP, 1), TOP, 95), (a(bottom2, 1), bottom2, 80),
            (g_hole, bottom2, 30), (g_hole, g_arm_bottom, 30), (g_arm_tip, g_arm_bottom, 4),
            (g_arm_tip + K_V * (g_arm_bottom - g_arm_top), g_arm_top, 22), (g_right, g_arm_top, 50),
            (g_right, BOTTOM, 50), (a(BOTTOM, -1), BOTTOM, 150), (a(top2, -1), top2, 55), (293 + K_V * W, top2, 22)]

    up = [(329, BOTTOM, 4), (329 + K_V * W, bottom2, 22), (b(bottom2, -1), bottom2, 55), (b(TOP, -1), TOP, 150),
          (1053, TOP, 4), (1053 - K_V * W, top2, 22), (b(top2, 1), top2, 80), (b(BOTTOM, 1), BOTTOM, 95)]

    return ''.join(rounded(shape) for shape in (v, down, up))


# Versión horizontal: «valentindg» en Instrument Sans 600 a dos tercios de la altura del monograma,
# separado 115 unidades y con la línea base donde la deja el navegador al centrar la fila.
WORD, WORD_WEIGHT, WORD_TRACKING = 'valentindg', 600, -0.025
WORD_SIZE, WORD_GAP, WORD_BASELINE = 255.3, 115, 281


def word_path(font_file):
    """Devuelve (path, ancho) del nombre convertido en contornos, con el interletraje de la fuente."""
    tt = instantiateVariableFont(TTFont(font_file), {'wght': WORD_WEIGHT})
    tt.flavor = None    # HarfBuzz no lee woff2: se le pasa la fuente ya descomprimida
    data = io.BytesIO()
    tt.save(data)
    buf = hb.Buffer()
    buf.add_str(WORD)
    buf.guess_segment_properties()
    hb.shape(hb.Font(hb.Face(data.getvalue())), buf)

    glyphs, order = tt.getGlyphSet(), tt.getGlyphOrder()
    scale = WORD_SIZE / tt['head'].unitsPerEm
    x, d = 1098 + WORD_GAP, ''
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(glyphs, ntos=lambda v: f'{v:.1f}'.rstrip('0').rstrip('.'))
        glyphs[order[info.codepoint]].draw(TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, WORD_BASELINE)))
        d += pen.getCommands()
        x += pos.x_advance * scale + WORD_TRACKING * WORD_SIZE
    return d, math.ceil(x - WORD_TRACKING * WORD_SIZE)


def svg(view_width, color, d, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_width} 383"><title>{title}</title>'
            f'<path fill="{color}" d="{d}"/></svg>\n')


if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    mark = logo_path()
    word, width = word_path(root / 'assets' / 'fonts' / 'instrument-sans.woff2')
    for name, color in (('tinta', '#1d1c22'), ('blanco', '#ffffff')):
        (root / 'assets' / 'logo' / f'vdg-{name}.svg').write_text(svg(1098, color, mark, 'VDG'), encoding='utf-8')
        (root / 'assets' / 'logo' / f'vdg-horizontal-{name}.svg').write_text(
            svg(width, color, mark + word, 'VDG · valentindg'), encoding='utf-8')
    print(mark)
