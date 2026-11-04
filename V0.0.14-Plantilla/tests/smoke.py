"""Prueba de humo de VDG en Chromium. Levanta un servidor local temporal.

    pip install playwright && playwright install chromium
    python tests/smoke.py
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PAGES = ['#/', '#/clientes', '#/clientes/arrieta', '#/ventas', '#/tareas', '#/informes', '#/ajustes', '#/facturas/F-2026-0414']
failures = []
total = 0


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def check(width, name, condition):
    global total
    total += 1
    if not condition:
        failures.append(f'{width}px · {name}')


def run(browser, base, width):
    page = browser.new_page(viewport={'width': width, 'height': 900}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    page.wait_for_selector('main')
    count = lambda selector: page.locator(selector).count()
    toast = lambda: page.locator('.toast').inner_text()
    go = lambda hash: (page.evaluate('h => location.hash = h', hash), page.wait_for_selector('main'))

    # Una sola navegación y el inicio empieza por lo de hoy
    check(width, 'sin barra de secciones arriba', count('.topbar nav') == 0)
    check(width, 'inicio orientado a la acción', page.evaluate("document.querySelector('.today-grid').compareDocumentPosition(document.querySelector('.overview-grid')) & 4") > 0)
    first_task = page.locator('.today-grid [data-task]').first
    task_id = first_task.get_attribute('data-task')
    first_task.click()
    check(width, 'tarea marcada desde el inicio', page.locator(f'[data-task="{task_id}"]').count() == 0 or page.locator(f'[data-task="{task_id}"]').is_checked())

    # Validadores españoles con valores conocidos
    checks = page.evaluate('''async () => {
      const m = await import('./js/lib/spain.js');
      return [m.checkTaxId('12345678Z').valid, m.checkTaxId('X1234567L').valid, m.checkTaxId('B46872131').valid,
              !m.checkTaxId('12345678A').valid, m.checkIban('ES91 2100 0418 4502 0005 1332').valid, !m.checkIban('ES91 2100 0418 4502 0005 1333').valid,
              m.provinceFromPostcode('48170') === 'Bizkaia', m.provinceFromPostcode('53000') === null];
    }''')
    check(width, 'validadores NIF, NIE, CIF, IBAN y CP', all(checks))

    # Rutas, título y botón atrás
    for hash in PAGES:
        go(hash)
        check(width, f'página {hash}', count('.page-head h1') == 1)
        check(width, f'sin scroll horizontal en {hash}', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    go('#/clientes/arrieta')
    check(width, 'título de la pestaña', page.title().startswith('Talleres Arrieta'))
    go('#/ventas')
    page.go_back()
    check(width, 'botón atrás', 'Talleres Arrieta' in page.locator('h1').inner_text())
    go('#/no-existe')
    check(width, 'página inexistente', count('.not-found') == 1)

    # Tabla: buscador sin perder el foco, filtros en la URL, orden, paginación y selección
    go('#/clientes')
    check(width, 'paginación', count('tbody tr') == 10 and count('.pager') == 1)
    page.fill('#clients-search', 'zarag')
    check(width, 'búsqueda en la tabla', count('tbody tr') == 3 and page.evaluate("document.activeElement.id") == 'clients-search')
    check(width, 'búsqueda en la URL', 'q=zarag' in page.url)
    page.fill('#clients-search', 'zzzz')
    check(width, 'estado vacío de la tabla', count('#clients-results .empty-state') == 1)
    go('#/clientes?estado=risk')
    check(width, 'filtro por estado', count('tbody tr') == 4)
    go('#/clientes?orden=facturado&dir=desc')
    check(width, 'orden por facturado', 'Turia' in page.locator('tbody tr').first.inner_text())
    page.locator('[data-select]').nth(0).click()
    page.locator('[data-select]').nth(1).click()
    check(width, 'selección múltiple', count('.bulk-bar') == 1 and '2' in page.locator('.bulk-bar strong').inner_text())
    page.select_option('[data-bulk-status]', 'risk')
    check(width, 'acción en lote', '2' in toast() and count('.bulk-bar') == 0)
    page.click('[data-action="columns"]')
    page.locator('[data-column="sector"]').click()
    check(width, 'ocultar columna', count('th:has-text("Sector")') == 0)
    page.locator('[data-column="sector"]').click()

    # Ficha: nota con error en línea y guardado
    go('#/clientes/lacorte')
    check(width, 'ficha sin contactos', 'Sin contactos' in page.locator('.client-side').inner_text())
    page.click('#note-form button[type=submit]')
    check(width, 'error en línea', page.locator('#note-text-error').is_visible())
    page.fill('#note-text', 'Quiere presupuesto para la segunda tienda.')
    page.click('#note-form button[type=submit]')
    check(width, 'nota guardada', 'segunda tienda' in page.locator('.timeline').inner_text())

    # Alta de cliente: NIF/CIF con dígito de control
    page.keyboard.press('Escape')
    page.keyboard.press('n')
    page.fill('#client-name', 'Cerámicas Lledó S.L.')
    page.fill('#client-cif', 'B12345678')
    page.fill('#client-city', 'Onda')
    page.click('#client-form button[type=submit]')
    check(width, 'CIF con control incorrecto', page.locator('#client-cif-error').is_visible())
    page.fill('#client-cif', 'B12345674')
    page.fill('#client-postcode', '12200')
    check(width, 'provincia del alta', 'Castell' in page.input_value('#client-province'))
    page.click('#client-form button[type=submit]')
    page.wait_for_url('**/clientes/ceramicas-lledo-s-l')
    page.wait_for_selector('.client-grid')
    check(width, 'cliente creado', 'Cerámicas Lledó' in page.locator('h1').inner_text())

        # Factura nueva desde la ficha: navega a la factura; cobro desde la factura
    go('#/clientes/cierzo')
    page.click('.head-buttons [data-action="new-invoice"]')
    page.click('#invoice-form button[type=submit]')
    check(width, 'validación de factura', page.locator('#line-0-concept-error').is_visible())
    page.fill('#line-0-concept', 'Control de lotes — fase 1')
    page.fill('#line-0-price', '1000')
    page.click('[data-action="add-line"]')
    page.fill('#line-1-concept', 'Manual impreso')
    page.fill('#line-1-price', '50')
    page.select_option('#line-1-vat', '4')
    page.select_option('#invoice-irpf', '15')
    check(width, 'el foco sigue en su sitio al recalcular', page.evaluate('document.activeElement.id') != '')
    totals = page.locator('#invoice-totals').inner_text().replace('.', '')
    check(width, 'IVA por tipo e IRPF', '210,00' in totals and '2,00' in totals and '157,50' in totals and '1104,50' in totals)
    page.click('#invoice-form button[type=submit]')
    page.wait_for_selector('.invoice-sheet')
    check(width, 'factura emitida', '/facturas/F-' in page.url and 'Cervecera Cierzo' in page.locator('.invoice-sheet').inner_text())
    page.click('.head-buttons [data-action="payment"]')
    page.click('#payment-form button[type=submit]')
    check(width, 'cobro registrado', 'Cobrada' in page.locator('.page-head').inner_text())
    page.emulate_media(media='print')
    check(width, 'impresión solo de la hoja', not page.locator('.topbar').is_visible() and page.locator('.invoice-sheet').is_visible())
    page.emulate_media(media='screen')

    # Rectificativa completa: serie R propia y la original queda anulada
    go('#/facturas/F-2026-0408')
    page.click('[data-action="rectify"]')
    page.click('#rectify-form button[type=submit]')
    check(width, 'motivo obligatorio', page.locator('#rectify-reason-error').is_visible())
    page.fill('#rectify-reason', 'Pedido duplicado por error.')
    page.click('#rectify-form button[type=submit]')
    page.wait_for_url('**/facturas/R-2026-0004')
    page.wait_for_selector('.invoice-sheet')
    check(width, 'rectificativa en serie R', '/facturas/R-2026-0004' in page.url and 'Pedido duplicado' in page.locator('.invoice-sheet').inner_text())
    go('#/facturas/F-2026-0408')
    check(width, 'original anulada', 'Anulada' in page.locator('.page-head').inner_text() and 'R-2026-0004' in page.locator('.page-head').inner_text())

    # Factura con varios tipos de IVA y cliente en Canarias
    go('#/facturas/F-2026-0398')
    check(width, 'tres tipos de IVA', page.locator('.sheet-totals dt:has-text("IVA")').count() == 3)
    go('#/facturas/F-2026-0407')
    check(width, 'leyenda sin IVA', 'Las Palmas' in page.locator('.sheet-foot').inner_text())

    # Datos de la empresa: IBAN y CIF validados, provincia por código postal
    go('#/ajustes')
    page.fill('#company-iban', 'ES37 9999 0461 2002 0183 7745')
    page.click('#company-form button[type=submit]')
    check(width, 'IBAN inválido', page.locator('#company-iban-error').is_visible())
    page.fill('#company-iban', 'ES91 2100 0418 4502 0005 1332')
    page.fill('#company-postcode', '08001')
    check(width, 'provincia por CP', page.input_value('#company-province') == 'Barcelona')
    page.click('#company-form button[type=submit]')
    check(width, 'datos de empresa guardados', 'guardados' in toast())

    # Kanban: botones y arrastrar
    go('#/ventas')
    page.click('[data-move="d7"][data-to="negotiation"]')
    check(width, 'mover con botón', page.locator('[data-drop="negotiation"] [data-deal="d7"]').count() == 1)
    if width >= 1024:
        page.drag_and_drop('[data-deal="d3"]', '[data-drop="closing"]')
        check(width, 'arrastrar tarjeta', page.locator('[data-drop="closing"] [data-deal="d3"]').count() == 1)

    # Tareas: grupos, filtro por responsable, alta rápida, editar, posponer, borrar con deshacer
    go('#/tareas')
    check(width, 'grupo de atrasadas', 'atrasadas' in page.locator('.tasks-card').inner_text().lower())
    go('#/tareas?responsable=jm')
    owners = page.locator('.tasks-card .task-owner').all_inner_texts()
    check(width, 'filtro por responsable', owners and all('Javier' in o for o in owners))
    go('#/tareas')
    page.fill('#quick-text', 'Llamar a la gestoría por el 303')
    page.keyboard.press('Enter')
    check(width, 'alta rápida', 'gestoría por el 303' in page.locator('.tasks-card').inner_text() and page.evaluate('document.activeElement.id') == 'quick-text')
    row = page.locator('.task-item', has_text='gestoría por el 303')
    row.hover()
    row.locator('[data-action="edit-task"]').click()
    page.fill('#task-text', 'Llamar a la gestoría por el modelo 303')
    page.select_option('#task-client', 'nunez')
    page.click('#task-form button[type=submit]')
    edited = page.locator('.task-item', has_text='modelo 303')
    check(width, 'editar tarea con cliente', 'Gestoría Núñez' in edited.inner_text())
    edited.hover()
    edited.locator('[data-action="postpone-task"]').click()
    check(width, 'posponer', 'mañana' in toast())
    edited.hover()
    edited.locator('[data-action="delete-task"]').click()
    check(width, 'borrar', count('.task-item:has-text("modelo 303")') == 0)
    page.click('[data-action="undo"]')
    check(width, 'deshacer', count('.task-item:has-text("modelo 303")') == 1)
    go('#/clientes/nunez')
    check(width, 'tarea en la ficha', 'modelo 303' in page.locator('.client-side').inner_text())

    # Recordar cobro desde una factura vencida
    go('#/facturas/F-2026-0371')
    page.click('[data-action="remind-payment"]')
    go('#/tareas?responsable=ar')
    check(width, 'recordatorio de cobro', count('.task-item:has-text("Reclamar el pago de la F-2026-0371")') == 1)

    # Informes: indicadores, deuda por antigüedad, IVA del trimestre y CSV con todas las tablas
    go('#/informes')
    check(width, 'indicadores', count('.kpi-card .stat-tile') == 4 and 'días' in page.locator('.kpi-card').inner_text())
    check(width, 'barras de 12 meses', count('.reports-grid .bar-group') == 12)
    check(width, 'antigüedad de la deuda', count('.reports-grid .report-breakdown-item[data-key^="d"]') == 3)
    check(width, 'IVA del trimestre', 'Total repercutido' in page.locator('.reports-grid').inner_text())
    with page.expect_download() as report:
        page.click('[data-action="export-report"]')
    report_csv = Path(report.value.path()).read_text(encoding='utf-8-sig')
    check(width, 'CSV del informe completo', all(k in report_csv for k in ['Antigüedad de lo pendiente', 'Responsable', 'Total']))
    page.emulate_media(media='print')
    check(width, 'imprimir informe con título', page.locator('h1').is_visible() and not page.locator('.head-buttons').is_visible())
    page.emulate_media(media='screen')

    # Asistente: aviso proactivo, atajo A, respuesta con cifra, enlace y fuente, y cierre
    go('#/')
    check(width, 'burbuja del asistente', count('.assistant-bubble') == 1)
    page.wait_for_selector('.assistant-hint')
    check(width, 'aviso proactivo', 'F-2026-0371' in page.locator('.assistant-hint').inner_text())
    page.keyboard.press('a')
    check(width, 'atajo A abre el asistente', count('.assistant-panel') == 1 and page.evaluate('document.activeElement.id') == 'assistant-input')
    page.fill('#assistant-input', '¿Quién me debe dinero?')
    page.keyboard.press('Enter')
    page.wait_for_selector('.assistant-panel .msg-source')
    check(width, 'respuesta con cifra, lista y fuente', count('.msg-figure') == 1 and 'F-2026-0371' in page.locator('.msg-list').inner_text())
    page.locator('.msg-list a').first.click()
    page.wait_for_selector('.invoice-sheet')
    check(width, 'enlace de la respuesta', 'F-2026-0371' in page.url)
    if width < 620:
        check(width, 'en móvil se cierra al navegar', count('.assistant-panel') == 0)
    else:
        check(width, 'en escritorio sigue abierto', count('.assistant-panel') == 1)
        page.keyboard.press('Escape')
        check(width, 'Esc cierra el asistente', count('.assistant-panel') == 0)

    # Atajos, búsqueda global e idioma
    go('#/')
    page.keyboard.press('Control+k')
    page.keyboard.type('montsant')
    page.keyboard.press('Enter')
    page.wait_for_selector('.client-grid')
    check(width, 'búsqueda global abre la ficha', 'Montsant' in page.locator('h1').inner_text())
    page.keyboard.press('t')
    check(width, 'atajo T', count('#task-form') == 1)
    page.keyboard.press('Escape')
    page.click('[data-lang=en]')
    check(width, 'inglés', 'Legal name' in page.locator('.client-side').inner_text())
    page.click('[data-lang=es]')

    with page.expect_download() as download:
        go('#/clientes?estado=new')
        page.click('.head-buttons [data-action="export-clients"]')
    csv = Path(download.value.path()).read_text(encoding='utf-8-sig').splitlines()
    check(width, 'CSV filtrado', csv[0].count(';') == 9 and len(csv) == 1 + count('tbody tr'))

    page.reload()
    page.wait_for_selector('main')
    go('#/clientes/lacorte')
    check(width, 'datos guardados', 'segunda tienda' in page.locator('.timeline').inner_text())
    check(width, 'sin errores de JavaScript', not errors)
    page.close()


def failed_load(browser, base):
    page = browser.new_page()
    page.route('**/data/demo.json', lambda route: route.fulfill(status=500, body='error'))
    page.goto(base)
    page.wait_for_selector('.error-screen')
    check('carga', 'pantalla de error', page.locator('[data-action="retry"]').count() == 1)
    page.close()


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=ROOT))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_address[1]}/index.html'
with sync_playwright() as p:
    chrome = shutil.which('google-chrome') or shutil.which('chromium')
    browser = p.chromium.launch(executable_path=chrome)
    for width in (390, 1440):
        run(browser, base, width)
    failed_load(browser, base)
    browser.close()
server.shutdown()

for failure in failures:
    print('FALLO', failure)
print(f'{total - len(failures)}/{total} comprobaciones correctas')
raise SystemExit(1 if failures else 0)
