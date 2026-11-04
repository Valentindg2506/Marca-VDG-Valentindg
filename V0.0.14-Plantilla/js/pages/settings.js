import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { initials, rate } from '../lib/format.js';
import { formatIban } from '../lib/spain.js';
import { IRPF_RATES } from '../lib/taxes.js';
import { company } from '../data/store.js';
import { icon } from '../components/icons.js';
import { btn, head, card, field, options } from '../components/ui.js';

const settingRow = (title, description, control) =>
  `<div class="setting-row"><span><strong>${title}</strong><small>${description}</small></span>${control}</div>`;
const switchControl = (on, label, action) =>
  `<button type="button" class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${label}" data-action="${action}"></button>`;

// Datos del emisor: salen en todas las facturas.
function companyForm() {
  const c = company();
  const freelance = c.type === 'freelance';
  return html`
    <form id="company-form" novalidate>
      ${field('company-type', t('Forma jurídica'), `<select id="company-type" name="type">${options([['company', t('Sociedad')], ['freelance', t('Autónomo')]], c.type)}</select>`)}
      ${field('company-name', freelance ? t('Nombre y apellidos') : t('Razón social'), `<input id="company-name" name="name" maxlength="90" value="${safe(c.name)}"/>`)}
      <div class="field-row">
        ${field('company-cif', freelance ? t('NIF') : t('CIF'), `<input id="company-cif" name="cif" maxlength="12" spellcheck="false" value="${safe(c.cif)}"/>`)}
        ${field('company-irpf', t('Retención IRPF por defecto'), `<select id="company-irpf" name="irpf" ${freelance ? '' : 'disabled'}>${options(IRPF_RATES.map(r => [String(r), r ? rate(r) : t('Sin retención')]), String(freelance ? c.irpf : 0))}</select>`)}
      </div>
      ${field('company-address', t('Dirección'), `<input id="company-address" name="address" maxlength="90" autocomplete="street-address" value="${safe(c.address)}"/>`)}
      <div class="field-row">
        ${field('company-postcode', t('Código postal'), `<input id="company-postcode" name="postcode" maxlength="5" inputmode="numeric" value="${safe(c.postcode)}"/>`)}
        ${field('company-city', t('Población'), `<input id="company-city" name="city" maxlength="40" value="${safe(c.city)}"/>`)}
      </div>
      ${field('company-province', t('Provincia'), `<input id="company-province" value="${safe(c.province)}" readonly tabindex="-1"/>`)}
      ${field('company-iban', t('IBAN para cobros'), `<input id="company-iban" name="iban" maxlength="34" spellcheck="false" class="mono" value="${safe(formatIban(c.iban))}"/>`)}
      <button type="submit" class="btn dark">${t('Guardar datos de la empresa')}</button>
    </form>`;
}

export function settings() {
  const languages = [['es', 'Español'], ['en', 'English']]
    .map(([code, label]) => `<button type="button" class="${state.language === code ? 'active' : ''}" aria-pressed="${state.language === code}" data-lang="${code}" lang="${code}">${label}</button>`)
    .join('');
  return html`
    ${head(t('Ajustes'))}
    <div class="section-grid">
      <div class="settings-column">
        ${card('section-card', t('Preferencias'), '', [
          settingRow(t('Modo oscuro'), t('Menos brillo para trabajar de noche'), switchControl(state.theme === 'dark', t('Modo oscuro'), 'theme')),
          settingRow(t('Ocultar importes'), t('Útil al compartir pantalla en una reunión'), switchControl(state.privacy, t('Ocultar importes'), 'privacy')),
          settingRow(t('Notificaciones'), t('Cobros recibidos y reuniones del día'), switchControl(state.notifications, t('Notificaciones'), 'toggle-notifications')),
          settingRow(t('Idioma'), t('Fechas e importes cambian con el idioma'), `<div class="setting-language" role="group" aria-label="${t('Idioma')}">${languages}</div>`)
        ].join(''))}
        ${card('section-card', t('Perfil'), `<span class="avatar">${safe(initials(state.name))}</span>`, html`
          <form id="profile-form" novalidate>
            ${field('profile-name', t('Nombre'), `<input id="profile-name" name="name" maxlength="40" autocomplete="name" value="${safe(state.name)}"/>`)}
            ${field('profile-email', t('Correo electrónico'), '<input id="profile-email" type="email" value="lucia.ferrer@ferrermoll.es" disabled/>')}
            <button type="submit" class="btn dark">${t('Guardar cambios')}</button>
          </form>
          <div class="divider profile-divider"></div>
          ${btn(`${icon('repeat', 'xs')} ${t('Restablecer datos de ejemplo')}`, 'reset')}`)}
      </div>
      ${card('section-card', t('Datos de la empresa'), `<span class="muted">${t('Salen en las facturas')}</span>`, companyForm())}
    </div>`;
}
