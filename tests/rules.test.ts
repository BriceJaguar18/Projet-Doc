import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withDefaults } from '../src/domain/defaultSettings';
import {
  canTransition,
  kitchenBack,
  kitchenNext,
  loadLevel,
  orderAlert,
  planPizzas,
  quotaFor,
  slotLoad,
  slotOf,
  slotsForDay,
} from '../src/domain/rules';
import type { Order, Pizza, PizzaStatus, Size } from '../src/domain/types';

function pizza(id: string, size: Size, status: PizzaStatus = 'attente', slot?: string): Pizza {
  return {
    id,
    position: 0,
    name: 'Reine',
    size,
    base: 'tomate',
    supplements: [],
    removed: [],
    note: '',
    cut: true,
    olives: true,
    status,
    ...(slot ? { slot } : {}),
  };
}

function order(id: string, pickupTime: string, pizzas: Pizza[], extra: Partial<Order> = {}): Order {
  return {
    id,
    serviceDate: '2026-11-03',
    pickupTime,
    slot: slotOf(pickupTime),
    customerName: 'Client',
    origin: 'Comptoir',
    paid: false,
    collected: false,
    note: '',
    pizzas: Object.fromEntries(pizzas.map((p) => [p.id, p])),
    items: [],
    createdAt: 0,
    ...extra,
  };
}

describe('transitions par rôle', () => {
  it('la cuisine lance la préparation puis met au four', () => {
    expect(canTransition('cuisine', 'attente', 'preparation')).toBe(true);
    expect(canTransition('cuisine', 'preparation', 'four')).toBe(true);
  });

  it('la cuisine peut revenir en arrière en cas d’erreur', () => {
    expect(canTransition('cuisine', 'four', 'preparation')).toBe(true);
    expect(canTransition('cuisine', 'preparation', 'attente')).toBe(true);
  });

  it('la cuisine ne peut pas valider « Prête »', () => {
    expect(canTransition('cuisine', 'four', 'prete')).toBe(false);
    expect(canTransition('cuisine', 'attente', 'four')).toBe(false);
  });

  it('seul le service valide la sortie du four', () => {
    expect(canTransition('service', 'four', 'prete')).toBe(true);
    expect(canTransition('service', 'prete', 'four')).toBe(true);
    expect(canTransition('service', 'attente', 'preparation')).toBe(false);
    expect(canTransition('service', 'preparation', 'four')).toBe(false);
    expect(canTransition('service', 'preparation', 'prete')).toBe(false);
  });

  it('boutons cuisine', () => {
    expect(kitchenNext('attente')).toBe('preparation');
    expect(kitchenNext('preparation')).toBe('four');
    expect(kitchenNext('four')).toBeNull();
    expect(kitchenBack('four')).toBe('preparation');
    expect(kitchenBack('preparation')).toBe('attente');
    expect(kitchenBack('attente')).toBeNull();
  });
});

describe('créneaux de 10 minutes', () => {
  it('ramène une heure à son créneau', () => {
    expect(slotOf('19:15')).toBe('19:10');
    expect(slotOf('19:10')).toBe('19:10');
    expect(slotOf('19:09')).toBe('19:00');
  });

  it('liste les créneaux des plages d’ouverture', () => {
    const slots = slotsForDay([
      { start: '11:30', end: '12:00' },
      { start: '18:00', end: '18:30' },
    ]);
    expect(slots).toEqual(['11:30', '11:40', '11:50', '18:00', '18:10', '18:20']);
  });
});

describe('charge et quotas (total de pizzas, toutes tailles)', () => {
  const settings = { ...DEFAULT_SETTINGS, defaultQuota: 5 };
  const orders = [
    order('a', '19:10', [pizza('1', 'G'), pizza('2', 'G'), pizza('3', 'P')]),
    order('b', '19:15', [pizza('4', 'P')]),
    order('c', '19:20', [pizza('5', 'P')]),
  ];

  it('compte toutes les pizzas d’un créneau, avec le détail G / P', () => {
    expect(slotLoad(orders, '19:10')).toEqual({ total: 4, G: 2, P: 2 });
    expect(slotLoad(orders, '19:20')).toEqual({ total: 1, G: 0, P: 1 });
    expect(slotLoad(orders, '19:10', 'a')).toEqual({ total: 1, G: 0, P: 1 });
  });

  it('compte une pizza reportée dans son propre créneau', () => {
    const split = order('d', '19:30', [pizza('6', 'G', 'attente', '19:30'), pizza('7', 'G', 'attente', '19:40')]);
    expect(slotLoad([split], '19:30').total).toBe(1);
    expect(slotLoad([split], '19:40').total).toBe(1);
  });

  it('quota du jour ou quota par défaut (et ancienne forme G/P)', () => {
    expect(quotaFor('19:10', settings, {})).toBe(5);
    expect(quotaFor('19:10', settings, { '19:10': 7 })).toBe(7);
    expect(quotaFor('19:10', settings, { '19:10': { G: 3, P: 1 } as unknown as number })).toBe(4);
    expect(withDefaults({ defaultQuota: { G: 3, P: 2 } as unknown as number }).defaultQuota).toBe(5);
  });

  it('niveau de remplissage', () => {
    expect(loadLevel(0, 5)).toBe('libre');
    expect(loadLevel(3, 5)).toBe('presque');
    expect(loadLevel(5, 5)).toBe('plein');
    expect(loadLevel(6, 5)).toBe('depasse');
    expect(loadLevel(0, 0)).toBe('plein');
  });
});

describe('report automatique sur le créneau suivant', () => {
  const settings = { ...DEFAULT_SETTINGS, defaultQuota: 5 };
  // 19:10 : 4 pizzas déjà prévues → 1 place. 19:20 : 5 → complet. 19:30 : vide.
  const orders = [
    order('a', '19:10', [pizza('1', 'G'), pizza('2', 'G'), pizza('3', 'P'), pizza('4', 'P')]),
    order('b', '19:20', ['5', '6', '7', '8', '9'].map((id) => pizza(id, 'G'))),
  ];
  const mine = [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }];

  it('tout rentre : rien ne bouge', () => {
    const plan = planPizzas({ orders, settings, dayQuotas: {}, requestedTime: '19:35', pizzas: mine });
    expect(plan.shifted).toBe(false);
    expect(plan.pickupTime).toBe('19:35');
    expect(Object.values(plan.slots)).toEqual(['19:30', '19:30', '19:30']);
  });

  it('les pizzas en trop passent au créneau libre suivant et le retrait est décalé', () => {
    const plan = planPizzas({ orders, settings, dayQuotas: {}, requestedTime: '19:15', pizzas: mine });
    expect(plan.freeInRequested).toBe(1);
    expect(plan.slots).toEqual({ x1: '19:10', x2: '19:30', x3: '19:30' }); // 19:20 est complet
    expect(plan.shifted).toBe(true);
    expect(plan.pickupTime).toBe('19:35');
    expect(plan.perSlot).toEqual([
      { slot: '19:10', count: 1 },
      { slot: '19:30', count: 2 },
    ]);
  });

  it('« Forcer » garde toutes les pizzas sur le créneau demandé', () => {
    const plan = planPizzas({ orders, settings, dayQuotas: {}, requestedTime: '19:15', pizzas: mine, force: true });
    expect(Object.values(plan.slots)).toEqual(['19:10', '19:10', '19:10']);
    expect(plan.pickupTime).toBe('19:15');
    expect(plan.over).toBe(true);
  });

  it('un quota augmenté à la main est pris en compte', () => {
    const plan = planPizzas({ orders, settings, dayQuotas: { '19:10': 8 }, requestedTime: '19:15', pizzas: mine });
    expect(plan.shifted).toBe(false);
  });

  it('en modification, la commande elle-même n’est pas comptée et les pizzas lancées gardent leur créneau', () => {
    const plan = planPizzas({
      orders,
      settings,
      dayQuotas: {},
      requestedTime: '19:10',
      pizzas: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: 'new' }],
      pinned: { '1': '19:10' },
      excludeOrderId: 'a',
    });
    expect(plan.slots).toEqual({ '1': '19:10', '2': '19:10', '3': '19:10', '4': '19:10', new: '19:10' });
    expect(plan.shifted).toBe(false);
  });
});

describe('alertes de retard', () => {
  const at = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  it('retard si l’heure est dépassée et pas tout prêt', () => {
    const o = order('a', '19:10', [pizza('1', 'G', 'four')]);
    expect(orderAlert(o, at('19:10'), 10)).toBeNull();
    expect(orderAlert(o, at('19:14'), 10)).toEqual({ kind: 'retard', minutes: 4 });
  });

  it('pas d’alerte si tout est prêt ou récupéré', () => {
    const ready = order('a', '19:10', [pizza('1', 'G', 'prete')]);
    expect(orderAlert(ready, at('19:30'), 10)).toBeNull();
    const collected = order('b', '19:10', [pizza('1', 'G', 'four')], { collected: true });
    expect(orderAlert(collected, at('19:30'), 10)).toBeNull();
  });

  it('commande partagée : le retard se mesure sur l’heure annoncée au client', () => {
    const o = order('a', '19:35', [pizza('1', 'G', 'prete', '19:10'), pizza('2', 'G', 'attente', '19:30')], {
      requestedTime: '19:15',
      slot: '19:10',
    });
    // La pizza reportée sur 19:30 est due à 19:35 (19:15 + un créneau).
    expect(orderAlert(o, at('19:20'), 10)).toBeNull();
    expect(orderAlert(o, at('19:26'), 10)).toEqual({ kind: 'bientot', minutes: 9 });
    expect(orderAlert(o, at('19:36'), 10)).toEqual({ kind: 'retard', minutes: 1 });
  });

  it('pré-alerte si une pizza n’est pas lancée peu avant le retrait', () => {
    const o = order('a', '19:10', [pizza('1', 'G', 'attente'), pizza('2', 'P', 'four')]);
    expect(orderAlert(o, at('18:55'), 10)).toBeNull();
    expect(orderAlert(o, at('19:02'), 10)).toEqual({ kind: 'bientot', minutes: 8 });
    const launched = order('b', '19:10', [pizza('1', 'G', 'preparation')]);
    expect(orderAlert(launched, at('19:02'), 10)).toBeNull();
  });

  it('pas d’alerte pour une commande sans pizza', () => {
    expect(orderAlert(order('a', '19:10', []), at('20:00'), 10)).toBeNull();
  });
});
