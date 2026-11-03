import { describe, expect, it } from 'vitest';
import {
  canTransition,
  checkCapacity,
  kitchenBack,
  kitchenNext,
  loadLevel,
  orderAlert,
  slotLoad,
  slotOf,
  slotsForDay,
} from '../src/domain/rules';
import type { Order, Pizza, PizzaStatus, Size } from '../src/domain/types';

function pizza(id: string, size: Size, status: PizzaStatus = 'attente'): Pizza {
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

describe('charge et quotas', () => {
  const orders = [
    order('a', '19:10', [pizza('1', 'G'), pizza('2', 'G'), pizza('3', 'P')]),
    order('b', '19:15', [pizza('4', 'G')]),
    order('c', '19:20', [pizza('5', 'P')]),
  ];
  const quota = { G: 3, P: 2 };

  it('compte les grandes et petites d’un créneau', () => {
    expect(slotLoad(orders, '19:10')).toEqual({ G: 3, P: 1 });
    expect(slotLoad(orders, '19:20')).toEqual({ G: 0, P: 1 });
  });

  it('signale un dépassement de quota', () => {
    const ok = checkCapacity(orders, '19:10', quota, { G: 0, P: 1 });
    expect(ok.over).toBe(false);
    expect(ok.remaining).toEqual({ G: 0, P: 0 });

    const ko = checkCapacity(orders, '19:10', quota, { G: 1, P: 0 });
    expect(ko.over).toBe(true);
    expect(ko.remaining.G).toBe(-1);
  });

  it('ignore la commande en cours de modification', () => {
    const c = checkCapacity(orders, '19:10', quota, { G: 2, P: 1 }, 'a');
    expect(c.load).toEqual({ G: 3, P: 1 });
    expect(c.over).toBe(false);
  });

  it('niveau de remplissage', () => {
    expect(loadLevel({ G: 0, P: 0 }, quota)).toBe('libre');
    expect(loadLevel({ G: 2, P: 1 }, quota)).toBe('presque');
    expect(loadLevel({ G: 3, P: 2 }, quota)).toBe('plein');
    expect(loadLevel({ G: 4, P: 0 }, quota)).toBe('depasse');
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
