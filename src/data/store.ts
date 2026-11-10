import type { DayQuotas, Order, PizzaStatus, Role, Settings } from '../domain/types';

export interface DaySnapshot {
  orders: Order[];
  settings: Settings;
  dayQuotas: DayQuotas;
  /** Faux tant que les premières données ne sont pas arrivées. */
  ready: boolean;
}

/**
 * - online : synchronisé avec le cloud
 * - pending : des changements partent vers le cloud
 * - offline : pas d'internet, les changements sont gardés et partiront au retour
 */
export type ConnectionState = 'online' | 'pending' | 'offline';

/** Interface commune au mode démo et au mode Firebase. */
export interface Store {
  kind: 'demo' | 'firebase';
  subscribeDay(serviceDate: string, cb: (s: DaySnapshot) => void): () => void;
  subscribeConnection(cb: (c: ConnectionState) => void): () => void;
  createOrder(order: Order): Promise<void>;
  /** Met à jour le contenu d'une commande sans écraser les statuts des pizzas. */
  updateOrder(prev: Order, next: Order): Promise<void>;
  deleteOrder(orderId: string): Promise<void>;
  setPizzaStatuses(orderId: string, pizzaIds: string[], status: PizzaStatus): Promise<void>;
  setPaid(orderId: string, paid: boolean): Promise<void>;
  setCollected(orderId: string, collected: boolean): Promise<void>;
  /** `null` = revenir au quota par défaut pour ce créneau. */
  setSlotQuota(serviceDate: string, slot: string, quota: number | null): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  /** Commandes d'un jour donné (pour le récapitulatif des ventes d'un jour passé). */
  fetchDay(serviceDate: string): Promise<Order[]>;
}

export interface AuthApi {
  /** `ready` passe à vrai quand on sait si la tablette est connectée ou non. */
  subscribe(cb: (role: Role | null, ready: boolean) => void): () => void;
  signIn(role: Role, password: string): Promise<void>;
  signOut(): Promise<void>;
}

/** Champs d'une pizza modifiables depuis le comptoir (le statut est géré à part). */
export const PIZZA_CONTENT_FIELDS = [
  'position',
  'name',
  'size',
  'base',
  'supplements',
  'removed',
  'note',
  'cut',
  'olives',
  'slot',
  'custom',
  'basePrice',
  'suppPrices',
] as const;

/** Applique une modification de commande en conservant les statuts actuels des pizzas. */
export function mergeOrderContent(current: Order, prev: Order, next: Order): Order {
  const pizzas: Order['pizzas'] = {};
  for (const p of Object.values(next.pizzas)) {
    const live = current.pizzas[p.id];
    pizzas[p.id] = live && prev.pizzas[p.id] ? { ...p, status: live.status } : p;
  }
  // Une pizza ajoutée entre-temps par un autre écran (cas improbable) est conservée.
  for (const p of Object.values(current.pizzas)) {
    if (!prev.pizzas[p.id] && !next.pizzas[p.id]) pizzas[p.id] = p;
  }
  return {
    ...current,
    pickupTime: next.pickupTime,
    requestedTime: next.requestedTime,
    slot: next.slot,
    customerName: next.customerName,
    origin: next.origin,
    paid: next.paid,
    note: next.note,
    items: next.items,
    pizzas,
  };
}
