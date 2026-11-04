// Avisos proactivos del asistente. Son reglas sobre los datos, sin IA: salen al momento, no gastan nada y son
// siempre ciertos. Cada aviso trae la pregunta que el asistente responde al pulsar «Ver».
// El id es estable (depende del dato, no del texto) para que un aviso descartado no vuelva a salir.
import { t } from '../i18n/index.js';
import { moneyText, quarter } from '../lib/format.js';
import { daysFromToday } from '../lib/dates.js';
import { state } from '../data/state.js';
import { pendingInvoices, invoiceStatus, clients, clientName, quarterGoal } from '../data/store.js';

function oldestOverdue() {
  const overdue = pendingInvoices().filter(i => invoiceStatus(i) === 'overdue').sort((a, b) => a.due.localeCompare(b.due));
  const oldest = overdue[0];
  if (!oldest) return null;
  return {
    id: `overdue:${oldest.number}`,
    text: t('{client} lleva {n} días sin pagar la {number} ({amount}).', { client: clientName(oldest.client), n: -daysFromToday(oldest.due), number: oldest.number, amount: moneyText(oldest.amount, 0) }),
    question: t('¿Quién me debe dinero?')
  };
}

function forgottenClients() {
  const forgotten = clients().filter(c => -daysFromToday(c.lastContact) > 30);
  if (!forgotten.length) return null;
  return {
    id: `contact:${forgotten.map(c => c.id).sort().join(',')}`,
    text: t('{n} cliente lleva más de 30 días sin contacto.|{n} clientes llevan más de 30 días sin contacto.', { n: forgotten.length }),
    question: t('¿Qué clientes están en riesgo?')
  };
}

function goalAtRisk() {
  const goal = quarterGoal();
  const q = quarter();
  const left = goal.target - goal.won;
  if (left <= 0 || q.daysLeft > 45) return null;
  return {
    id: `goal:${q.label}`,
    text: t('Faltan {amount} para el objetivo y quedan {n} días.', { amount: moneyText(left, 0), n: q.daysLeft }),
    question: t('¿Llegamos al objetivo del trimestre?')
  };
}

const RULES = [oldestOverdue, goalAtRisk, forgottenClients];

export const insights = () => RULES.map(rule => rule()).filter(insight => insight && !state.dismissedInsights.includes(insight.id));
