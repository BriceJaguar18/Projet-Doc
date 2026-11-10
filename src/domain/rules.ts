import { quotaNumber } from './defaultSettings';
import type { DayQuotas, OpeningRange, Order, Pizza, PizzaStatus, Role, Settings, Size } from './types';

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
/* Créneau de chaque pizza                                             */
/* ------------------------------------------------------------------ */

/** Heure demandée par le client (les anciennes commandes n'ont que l'heure de retrait). */
export function requestedTimeOf(order: Order): string {
  return order.requestedTime ?? order.pickupTime;
}

/** Créneau de production d'une pizza (celui de la commande pour les anciennes commandes). */
export function pizzaSlot(order: Order, p: Pizza): string {
  return p.slot ?? order.slot;
}

/**
 * Heure à laquelle une pizza doit être prête : l'heure demandée, décalée de 10 min
 * par créneau de report (19:15 demandé, pizza reportée sur le créneau suivant → 19:25).
 */
export function pizzaDue(order: Order, p: Pizza): number {
  const requested = requestedTimeOf(order);
  const shift = toMinutes(pizzaSlot(order, p)) - toMinutes(slotOf(requested));
  return toMinutes(requested) + Math.max(0, shift);
}

/* ------------------------------------------------------------------ */
/* Charge et quotas                                                    */
/* ------------------------------------------------------------------ */

/** Nombre maximum de pizzas (toutes tailles) sur un créneau. */
export function quotaFor(slot: string, settings: Settings, dayQuotas: DayQuotas): number {
  return dayQuotas[slot] === undefined ? settings.defaultQuota : quotaNumber(dayQuotas[slot], settings.defaultQuota);
}

export interface SizeCount {
  G: number;
  P: number;
}

export function countBySize(pizzas: Iterable<Pick<Pizza, 'size'>>): SizeCount {
  const q: SizeCount = { G: 0, P: 0 };
  for (const p of pizzas) q[p.size] += 1;
  return q;
}

export interface SlotLoad extends SizeCount {
  /** Nombre total de pizzas, toutes tailles confondues. */
  total: number;
}

/** Pizzas déjà prévues sur un créneau (total, et détail grandes / petites pour information). */
export function slotLoad(orders: Order[], slot: string, excludeOrderId?: string): SlotLoad {
  const load: SlotLoad = { total: 0, G: 0, P: 0 };
  for (const o of orders) {
    if (o.id === excludeOrderId) continue;
    for (const p of Object.values(o.pizzas)) {
      if (pizzaSlot(o, p) !== slot) continue;
      load.total += 1;
      load[p.size] += 1;
    }
  }
  return load;
}

export type LoadLevel = 'libre' | 'presque' | 'plein' | 'depasse';

export function loadLevel(load: number, quota: number): LoadLevel {
  if (load > quota) return 'depasse';
  if (load >= quota) return 'plein';
  if (quota > 0 && load / quota >= 0.6) return 'presque';
  return 'libre';
}

export interface PizzaPlan {
  /** Créneau de production attribué à chaque pizza (par id). */
  slots: Record<string, string>;
  requestedSlot: string;
  /** Heure de retrait à annoncer au client (décalée si des pizzas sont reportées). */
  pickupTime: string;
  /** Des pizzas ont été reportées sur un créneau suivant. */
  shifted: boolean;
  /** Le créneau demandé dépasse son quota (pizzas forcées). */
  over: boolean;
  /** Places libres sur le créneau demandé, avant cette commande. */
  freeInRequested: number;
  /** Nombre de pizzas de la commande par créneau, dans l'ordre. */
  perSlot: Array<{ slot: string; count: number }>;
}

/**
 * Répartit les pizzas d'une commande sur les créneaux.
 * Les pizzas remplissent les places libres du créneau demandé ; celles qui ne rentrent pas
 * basculent sur le créneau suivant (puis le suivant, etc.).
 * - `force` : toutes les pizzas sur le créneau demandé, même au-delà du quota.
 * - `pinned` : pizzas qui gardent leur créneau (déjà lancées en cuisine, en modification).
 * - `excludeOrderId` : en modification, l'ancienne version de la commande n'est pas comptée.
 */
export function planPizzas(args: {
  orders: Order[];
  settings: Settings;
  dayQuotas: DayQuotas;
  requestedTime: string;
  pizzas: Array<Pick<Pizza, 'id'>>;
  pinned?: Record<string, string>;
  excludeOrderId?: string;
  force?: boolean;
}): PizzaPlan {
  const { settings, dayQuotas, requestedTime, pizzas, pinned = {}, force = false } = args;
  const requestedSlot = slotOf(requestedTime);
  const others = args.orders.filter((o) => o.id !== args.excludeOrderId);
  const added = new Map<string, number>();
  const free = (slot: string) =>
    quotaFor(slot, settings, dayQuotas) - slotLoad(others, slot).total - (added.get(slot) ?? 0);
  const take = (slot: string) => added.set(slot, (added.get(slot) ?? 0) + 1);

  const freeInRequested = free(requestedSlot);
  const slots: Record<string, string> = {};
  for (const p of pizzas) {
    if (pinned[p.id]) {
      slots[p.id] = pinned[p.id];
      take(pinned[p.id]);
    }
  }

  let cursor = toMinutes(requestedSlot);
  let shifted = false;
  for (const p of pizzas) {
    if (slots[p.id]) continue;
    let slot = requestedSlot;
    if (!force) {
      while (free(fromMinutes(cursor)) <= 0 && cursor + SLOT_MINUTES < 24 * 60) cursor += SLOT_MINUTES;
      // Aucun créneau libre avant minuit : on reste sur le créneau demandé.
      if (free(fromMinutes(cursor)) > 0) slot = fromMinutes(cursor);
    }
    if (slot !== requestedSlot) shifted = true;
    slots[p.id] = slot;
    take(slot);
  }

  const used = [...new Set(pizzas.map((p) => slots[p.id]))].sort((a, b) => toMinutes(a) - toMinutes(b));
  const maxShift = Math.max(0, ...used.map((s) => toMinutes(s) - toMinutes(requestedSlot)));
  return {
    slots,
    requestedSlot,
    pickupTime: fromMinutes(toMinutes(requestedTime) + maxShift),
    shifted,
    over: free(requestedSlot) < 0,
    freeInRequested,
    perSlot: used.map((slot) => ({ slot, count: pizzas.filter((p) => slots[p.id] === slot).length })),
  };
}

/* ------------------------------------------------------------------ */
/* Alertes de retard                                                   */
/* ------------------------------------------------------------------ */

export type OrderAlert =
  | { kind: 'retard'; minutes: number }
  | { kind: 'bientot'; minutes: number }
  | null;

/**
 * - « retard » : l'heure de retrait annoncée est dépassée et toutes les pizzas ne sont pas prêtes.
 * - « bientot » : une pizza pas encore lancée doit être prête dans moins de `preAlertMinutes`.
 * Pas d'alerte pour une commande récupérée ou sans pizza.
 * `pizzas` : pour ne regarder qu'une partie de la commande (ex. un créneau en cuisine).
 */
export function orderAlert(
  order: Order,
  now: number,
  preAlertMinutes: number,
  pizzas: Pizza[] = sortedPizzas(order),
): OrderAlert {
  if (order.collected || pizzas.length === 0) return null;
  if (pizzas.every((p) => p.status === 'prete')) return null;
  const pickup = toMinutes(order.pickupTime);
  if (now > pickup) return { kind: 'retard', minutes: now - pickup };
  const waiting = pizzas.filter((p) => p.status === 'attente');
  if (waiting.length) {
    const due = Math.min(...waiting.map((p) => pizzaDue(order, p)));
    if (due - now <= preAlertMinutes) return { kind: 'bientot', minutes: Math.max(0, due - now) };
  }
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
