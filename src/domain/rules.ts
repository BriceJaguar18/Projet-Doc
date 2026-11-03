import type {
  DayQuotas,
  OpeningRange,
  Order,
  Pizza,
  PizzaStatus,
  Quota,
  Role,
  Settings,
  Size,
} from './types';

/* ------------------------------------------------------------------ */
/* Statuts                                                             */
/* ------------------------------------------------------------------ */

export const STATUS_ORDER: PizzaStatus[] = ['attente', 'preparation', 'four', 'prete'];

export const STATUS_LABEL: Record<PizzaStatus, string> = {
  attente: 'En attente',
  preparation: 'En préparation',
  four: 'Au four',
  prete: 'Prête',
};

/**
 * Transitions autorisées par rôle.
 * - Cuisine : Lancer préparation, Au four, et retours arrière en cas d'erreur.
 * - Service : valide la sortie du four (Prête), et peut annuler cette validation.
 */
const TRANSITIONS: Record<Role, Array<[PizzaStatus, PizzaStatus]>> = {
  cuisine: [
    ['attente', 'preparation'],
    ['preparation', 'four'],
    ['four', 'preparation'],
    ['preparation', 'attente'],
  ],
  service: [
    ['four', 'prete'],
    ['prete', 'four'],
  ],
};

export function canTransition(role: Role, from: PizzaStatus, to: PizzaStatus): boolean {
  return TRANSITIONS[role].some(([a, b]) => a === from && b === to);
}

/** Action principale proposée au pizzaiolo selon l'état de la pizza. */
export function kitchenNext(status: PizzaStatus): PizzaStatus | null {
  if (status === 'attente') return 'preparation';
  if (status === 'preparation') return 'four';
  return null;
}

/** Retour arrière proposé au pizzaiolo (erreur de manipulation). */
export function kitchenBack(status: PizzaStatus): PizzaStatus | null {
  if (status === 'four') return 'preparation';
  if (status === 'preparation') return 'attente';
  return null;
}

export function sortedPizzas(order: Order): Pizza[] {
  return Object.values(order.pizzas).sort((a, b) => a.position - b.position);
}

/** Toutes les pizzas sont prêtes (vrai aussi pour une commande sans pizza). */
export function allPizzasReady(order: Order): boolean {
  return sortedPizzas(order).every((p) => p.status === 'prete');
}

/* ------------------------------------------------------------------ */
/* Heures et créneaux                                                  */
/* ------------------------------------------------------------------ */

export const SLOT_MINUTES = 10;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Créneau de 10 min contenant l'heure donnée (19:15 → 19:10). */
export function slotOf(hhmm: string): string {
  const m = toMinutes(hhmm);
  return fromMinutes(m - (m % SLOT_MINUTES));
}

/** Tous les créneaux de 10 min des plages d'ouverture, dans l'ordre. */
export function slotsForDay(openingHours: OpeningRange[]): string[] {
  const set = new Set<number>();
  for (const r of openingHours) {
    const start = toMinutes(slotOf(r.start));
    const end = toMinutes(r.end);
    for (let m = start; m < end; m += SLOT_MINUTES) set.add(m);
  }
  return [...set].sort((a, b) => a - b).map(fromMinutes);
}

/** Date locale AAAA-MM-JJ. */
export function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/* ------------------------------------------------------------------ */
/* Charge et quotas                                                    */
/* ------------------------------------------------------------------ */

export function quotaFor(slot: string, settings: Settings, dayQuotas: DayQuotas): Quota {
  return dayQuotas[slot] ?? settings.defaultQuota;
}

export function countBySize(pizzas: Iterable<Pick<Pizza, 'size'>>): Quota {
  const q: Quota = { G: 0, P: 0 };
  for (const p of pizzas) q[p.size] += 1;
  return q;
}

/** Nombre de grandes / petites pizzas déjà réservées sur un créneau. */
export function slotLoad(orders: Order[], slot: string, excludeOrderId?: string): Quota {
  const load: Quota = { G: 0, P: 0 };
  for (const o of orders) {
    if (o.slot !== slot || o.id === excludeOrderId) continue;
    const c = countBySize(Object.values(o.pizzas));
    load.G += c.G;
    load.P += c.P;
  }
  return load;
}

export interface CapacityCheck {
  load: Quota;
  quota: Quota;
  /** Places restantes (peut être négatif en cas de dépassement forcé). */
  remaining: Quota;
  over: boolean;
}

/**
 * Vérifie si l'ajout de pizzas sur un créneau dépasse le quota.
 * `excludeOrderId` : en modification, on ne compte pas l'ancienne version de la commande.
 */
export function checkCapacity(
  orders: Order[],
  slot: string,
  quota: Quota,
  extra: Quota = { G: 0, P: 0 },
  excludeOrderId?: string,
): CapacityCheck {
  const base = slotLoad(orders, slot, excludeOrderId);
  const load = { G: base.G + extra.G, P: base.P + extra.P };
  const remaining = { G: quota.G - load.G, P: quota.P - load.P };
  return { load, quota, remaining, over: remaining.G < 0 || remaining.P < 0 };
}

export type LoadLevel = 'libre' | 'presque' | 'plein' | 'depasse';

export function loadLevel(load: Quota, quota: Quota): LoadLevel {
  const sizes: Size[] = ['G', 'P'];
  if (sizes.some((s) => load[s] > quota[s])) return 'depasse';
  const total = load.G + load.P;
  const max = quota.G + quota.P;
  if (sizes.every((s) => load[s] >= quota[s])) return 'plein';
  if (max > 0 && total / max >= 0.6) return 'presque';
  return 'libre';
}

/* ------------------------------------------------------------------ */
/* Alertes de retard                                                   */
/* ------------------------------------------------------------------ */

export type OrderAlert =
  | { kind: 'retard'; minutes: number }
  | { kind: 'bientot'; minutes: number }
  | null;

/**
 * - « retard » : l'heure de retrait est dépassée et toutes les pizzas ne sont pas prêtes.
 * - « bientot » : retrait dans moins de `preAlertMinutes` et au moins une pizza pas encore lancée.
 * Pas d'alerte pour une commande récupérée ou sans pizza.
 */
export function orderAlert(order: Order, now: number, preAlertMinutes: number): OrderAlert {
  if (order.collected) return null;
  const pizzas = sortedPizzas(order);
  if (pizzas.length === 0) return null;
  const pickup = toMinutes(order.pickupTime);
  const allReady = pizzas.every((p) => p.status === 'prete');
  if (allReady) return null;
  if (now > pickup) return { kind: 'retard', minutes: now - pickup };
  const anyWaiting = pizzas.some((p) => p.status === 'attente');
  if (anyWaiting && pickup - now <= preAlertMinutes) return { kind: 'bientot', minutes: pickup - now };
  return null;
}

/** Tri par heure de retrait puis ordre de saisie. */
export function byPickup(a: Order, b: Order): number {
  return toMinutes(a.pickupTime) - toMinutes(b.pickupTime) || a.createdAt - b.createdAt;
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

/** Identifiant unique, commençant toujours par une lettre (utilisable dans un chemin Firestore). */
export function newId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 19)
      : (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 19);
  return `k${rand}`;
}

export const SIZE_LABEL: Record<Size, string> = { G: 'Grande 33', P: 'Petite 29' };
export const BASE_LABEL = { tomate: 'Tomate', creme: 'Crème' } as const;
