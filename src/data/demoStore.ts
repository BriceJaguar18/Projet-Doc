import { withDefaults } from '../domain/defaultSettings';
import type { DayQuotas, Order, Role, Settings } from '../domain/types';
import { local, session } from './safeStorage';
import { mergeOrderContent, type AuthApi, type ConnectionState, type DaySnapshot, type Store } from './store';

/**
 * MODE DÉMO : les données sont gardées dans le navigateur (localStorage) et
 * synchronisées entre les onglets / fenêtres du même appareil (BroadcastChannel).
 * Utile pour montrer l'appli et pour les tests automatiques, pas pour la production.
 */

const KEY = 'kiosque-demo-v1';
const CHANNEL = 'kiosque-demo';

interface DemoDb {
  orders: Record<string, Order>;
  settings: Settings | null;
  quotas: Record<string, DayQuotas>;
}

function load(): DemoDb {
  try {
    const raw = local.get(KEY);
    if (raw) return JSON.parse(raw) as DemoDb;
  } catch {
    /* données illisibles : on repart de zéro */
  }
  return { orders: {}, settings: null, quotas: {} };
}

export function createDemoStore(): Store {
  const listeners = new Set<() => void>();
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
  const notifyLocal = () => listeners.forEach((l) => l());
  channel?.addEventListener('message', notifyLocal);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) notifyLocal();
  });

  function mutate(fn: (db: DemoDb) => void): Promise<void> {
    const db = load();
    fn(db);
    local.set(KEY, JSON.stringify(db));
    channel?.postMessage('change');
    notifyLocal();
    return Promise.resolve();
  }

  function snapshot(date: string): DaySnapshot {
    const db = load();
    return {
      orders: Object.values(db.orders).filter((o) => o.serviceDate === date),
      settings: withDefaults(db.settings),
      dayQuotas: db.quotas[date] ?? {},
      ready: true,
    };
  }

  return {
    kind: 'demo',
    subscribeDay(date, cb) {
      const emit = () => cb(snapshot(date));
      listeners.add(emit);
      emit();
      return () => listeners.delete(emit);
    },
    subscribeConnection(cb: (c: ConnectionState) => void) {
      cb('online');
      return () => {};
    },
    createOrder: (order) => mutate((db) => void (db.orders[order.id] = order)),
    updateOrder: (prev, next) =>
      mutate((db) => {
        const current = db.orders[prev.id];
        if (current) db.orders[prev.id] = mergeOrderContent(current, prev, next);
      }),
    deleteOrder: (id) => mutate((db) => void delete db.orders[id]),
    setPizzaStatuses: (orderId, pizzaIds, status) =>
      mutate((db) => {
        const o = db.orders[orderId];
        if (!o) return;
        for (const id of pizzaIds) if (o.pizzas[id]) o.pizzas[id].status = status;
      }),
    setPaid: (orderId, paid) =>
      mutate((db) => {
        if (db.orders[orderId]) db.orders[orderId].paid = paid;
      }),
    setCollected: (orderId, collected) =>
      mutate((db) => {
        if (db.orders[orderId]) db.orders[orderId].collected = collected;
      }),
    setSlotQuota: (date, slot, quota) =>
      mutate((db) => {
        const day = (db.quotas[date] ??= {});
        if (quota) day[slot] = quota;
        else delete day[slot];
      }),
    saveSettings: (settings) => mutate((db) => void (db.settings = settings)),
  };
}

/** Efface toutes les données de démo. */
export function resetDemo() {
  local.remove(KEY);
  if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel(CHANNEL).postMessage('change');
}

/** En démo, chaque onglet choisit son écran sans mot de passe. */
export function createDemoAuth(): AuthApi {
  const KEY_ROLE = 'kiosque-demo-role';
  const listeners = new Set<(r: Role | null, ready: boolean) => void>();
  const get = () => (session.get(KEY_ROLE) as Role | null) ?? null;
  const emit = () => listeners.forEach((l) => l(get(), true));
  return {
    subscribe(cb) {
      listeners.add(cb);
      cb(get(), true);
      return () => listeners.delete(cb);
    },
    async signIn(role) {
      session.set(KEY_ROLE, role);
      emit();
    },
    async signOut() {
      session.remove(KEY_ROLE);
      emit();
    },
  };
}
