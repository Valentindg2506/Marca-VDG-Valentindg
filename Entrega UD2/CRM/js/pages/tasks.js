// Tareas agrupadas por cuándo vencen, con filtro por responsable en la URL (#/tareas?responsable=jm&hechas=1)
// y la agenda de los próximos siete días.
import { state } from '../data/state.js';
import { t } from '../i18n/index.js';
import { html, safe } from '../lib/html.js';
import { formatDate, capitalize } from '../lib/format.js';
import { day, daysFromToday, startOfToday } from '../lib/dates.js';
import { withQuery } from '../lib/router.js';
import { SECTIONS, clientPath } from '../routes.js';
import { meetings, clientName, team, memberName, ME } from '../data/store.js';
import { icon } from '../components/icons.js';
import { dictateButton } from '../components/voice.js';
import { btn, head, card, tag, emptyState, kbd, taskRow, avatar } from '../components/ui.js';

// Días que faltan hasta el domingo: «esta semana» acaba ahí.
const daysToSunday = () => 6 - ((startOfToday().getDay() + 6) % 7);

const GROUPS = [
  { id: 'late', label: 'Atrasadas', test: d => d < 0 },
  { id: 'today', label: 'Hoy', test: d => d === 0 },
  { id: 'tomorrow', label: 'Mañana', test: d => d === 1 },
  { id: 'week', label: 'Esta semana', test: d => d > 1 && d <= daysToSunday() },
  { id: 'later', label: 'Más adelante', test: d => d > Math.max(1, daysToSunday()) }
];

const visibleTasks = query => state.tasks.filter(task => !query.responsable || task.owner === query.responsable);

function filters(query) {
  const link = (owner, label) => {
    const active = (query.responsable ?? '') === owner;
    return `<a class="${active ? 'active' : ''}" ${active ? 'aria-current="true"' : ''} href="${withQuery(SECTIONS.tasks.path, { ...query, responsable: owner })}">${label}</a>`;
  };
  return html`
    <div class="range-tabs" role="group" aria-label="${t('Responsable')}">
      ${link('', t('Todo el equipo'))}
      ${team().map(m => link(m.id, m.id === ME ? t('Mías') : safe(m.name.split(' ')[0])))}
    </div>`;
}

function taskList(query) {
  const tasks = visibleTasks(query);
  const pending = tasks.filter(task => !task.done).sort((a, b) => a.due.localeCompare(b.due));
  const done = tasks.filter(task => task.done).sort((a, b) => (b.doneAt ?? b.due).localeCompare(a.doneAt ?? a.due));
  const groups = GROUPS.map(g => ({ ...g, list: pending.filter(task => g.test(daysFromToday(task.due))) })).filter(g => g.list.length);
  const showDone = query.hechas === '1';
  const group = (id, label, list, tone = '') => html`
    <section class="task-group" data-key="group-${id}">
      <h4 class="task-group-title ${tone}">${label} <span>${list.length}</span></h4>
      ${list.map(task => taskRow(task, { actions: true }))}
    </section>`;
  return html`
    <form id="quick-task" class="quick-task" novalidate>
      <label class="sr-only" for="quick-text">${t('Nueva tarea')}</label>
      <input id="quick-text" name="text" maxlength="120" autocomplete="off" placeholder="${t('Añade una tarea y pulsa Intro')}"/>
      ${dictateButton('quick-text', t('Nueva tarea'))}
      <input name="due" type="date" value="${day(0)}" aria-label="${t('Fecha')}"/>
      <button type="submit" class="btn small">${icon('plus', 'xs')} ${t('Añadir')}</button>
    </form>
    ${groups.length
      ? groups.map(g => group(g.id, t(g.label), g.list, g.id === 'late' ? 'down' : ''))
      : emptyState({ iconName: 'check-check', title: t('Nada pendiente'), text: t('Pulsa {key} para crear una tarea.', { key: kbd('T') }) })}
    ${done.length ? html`
      <div class="task-done-toggle" data-key="done-toggle">
        <a class="btn small" href="${withQuery(SECTIONS.tasks.path, { ...query, hechas: showDone ? '' : '1' })}">
          ${icon(showDone ? 'chevron-down' : 'chevron-right', 'xs')} ${t(showDone ? 'Ocultar hechas ({n})' : 'Ver hechas ({n})', { n: done.length })}
        </a>
      </div>
      ${showDone ? group('done', t('Hechas'), done) : ''}` : ''}`;
}

function agenda() {
  const upcoming = meetings().filter(m => daysFromToday(m.date) >= 0 && daysFromToday(m.date) < 7);
  if (!upcoming.length) return emptyState({ iconName: 'calendar-days', title: t('Agenda libre'), text: t('No tienes reuniones en los próximos días.') });
  const days = [...new Set(upcoming.map(m => m.date))];
  const dayTitle = date => {
    const diff = daysFromToday(date);
    const name = capitalize(formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' }));
    return diff === 0 ? `${t('Hoy')} · ${name}` : diff === 1 ? `${t('Mañana')} · ${name}` : name;
  };
  return days.map(date => html`
    <section class="agenda-day" data-key="${date}">
      <h4 class="task-group-title">${dayTitle(date)}</h4>
      ${upcoming.filter(m => m.date === date).map(m => html`
        <a class="agenda-row" href="${clientPath(m.client)}" data-key="${m.date}-${m.time}">
          <span class="agenda-time"><strong>${m.time}</strong><small>${m.length} min</small></span>
          <span class="list-detail"><strong>${safe(m.title)}</strong><small>${safe(clientName(m.client))}</small></span>
          ${avatar(memberName(m.owner), 'xs')}
        </a>`)}
    </section>`).join('');
}

export function tasksPage(route) {
  const query = route.query;
  const tasks = visibleTasks(query).filter(task => !task.done);
  const late = tasks.filter(task => daysFromToday(task.due) < 0).length;
  const today = tasks.filter(task => daysFromToday(task.due) === 0).length;
  const summary = [
    late ? t('{n} atrasada|{n} atrasadas', { n: late }) : '',
    t('{n} para hoy', { n: today }),
    t('{n} pendiente|{n} pendientes', { n: tasks.length })
  ].filter(Boolean).join(' · ');
  return html`
    ${head(t('Tareas'), summary, btn(`${icon('plus', 'xs')} ${t('Nueva tarea')} ${kbd('T')}`, 'new-task', 'dark'))}
    <div class="tasks-grid">
      ${card('section-card tasks-card', query.responsable ? t('Tareas de {name}', { name: safe(memberName(query.responsable)) }) : t('Tareas del equipo'), filters(query), taskList(query))}
      ${card('section-card', t('Agenda'), tag(t('Próximos 7 días')), agenda())}
    </div>`;
}
