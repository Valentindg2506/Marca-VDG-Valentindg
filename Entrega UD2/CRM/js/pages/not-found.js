import { t } from '../i18n/index.js';
import { SECTIONS } from '../routes.js';
import { emptyState } from '../components/ui.js';

export const notFound = () => `<div class="not-found">${emptyState({
  iconName: 'map',
  title: t('Esta página no existe'),
  text: t('Puede que el enlace esté mal copiado o que el registro se haya borrado.'),
  action: `<a class="btn dark" href="${SECTIONS.home.path}">${t('Volver al inicio')}</a>`
})}</div>`;
