import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/domain/defaultSettings';
import { formatAmount, orderTotal, parsePrice, priceItem, pricePizza } from '../src/domain/pricing';
import { ordersInPeriod, salesCsv, servicePeriods, summarizeSales } from '../src/domain/sales';
import type { Order, Pizza } from '../src/domain/types';

const settings = DEFAULT_SETTINGS;

function pizza(name: string, size: 'G' | 'P', supplements: string[] = [], extra: Partial<Pizza> = {}): Pizza {
  return pricePizza(
    {
      id: `${name}-${size}-${Math.random()}`,
      position: 0,
      name,
      size,
      base: 'tomate',
      supplements,
      removed: [],
      note: '',
      cut: true,
      olives: true,
      status: 'prete',
      ...extra,
    },
    settings,
  );
}

function order(id: string, time: string, pizzas: Pizza[], items: Order['items'] = [], extra: Partial<Order> = {}): Order {
  return {
    id,
    serviceDate: '2026-11-10',
    pickupTime: time,
    requestedTime: time,
    slot: time,
    customerName: id,
    origin: 'Comptoir',
    paid: true,
    collected: true,
    note: '',
    pizzas: Object.fromEntries(pizzas.map((p) => [p.id, p])),
    items: items.map((it) => priceItem(it, settings)),
    createdAt: 0,
    ...extra,
  };
}

describe('prix', () => {
  it('lit un prix saisi à la française', () => {
    expect(parsePrice('10,50')).toBe(1050);
    expect(parsePrice('10.5')).toBe(1050);
    expect(parsePrice('9 €')).toBe(900);
    expect(parsePrice('')).toBe(0);
    expect(parsePrice('dix')).toBeNull();
    expect(parsePrice('1,234')).toBeNull();
    expect(formatAmount(1050)).toBe('10,50');
  });

  it('prix d’une pizza selon sa taille, suppléments compris', () => {
    const reineG = pizza('Reine', 'G', ['Chèvre', 'Œuf']);
    expect(reineG.basePrice).toBe(1150);
    expect(reineG.suppPrices).toEqual({ Chèvre: 150, Œuf: 100 });
    expect(pizza('Reine', 'P').basePrice).toBe(950);
  });

  it('une pizza hors carte garde le prix saisi', () => {
    expect(pizza('Spéciale du chef', 'G', [], { custom: true, basePrice: 1500 }).basePrice).toBe(1500);
  });

  it('total d’une commande', () => {
    const o = order('a', '19:10', [pizza('Reine', 'G', ['Chèvre']), pizza('Margherita', 'P')], [
      { category: 'boisson', name: 'Coca-Cola', qty: 2 },
    ]);
    // 11,50 + 1,50 + 8,00 + 2 × 2,50
    expect(orderTotal(o)).toBe(2600);
  });
});

describe('récapitulatif des ventes', () => {
  const orders = [
    order('Midi1', '12:10', [pizza('Reine', 'G'), pizza('Reine', 'G', ['Chèvre'])], [
      { category: 'boisson', name: 'Coca-Cola', qty: 1 },
    ]),
    order('Soir1', '19:10', [pizza('Reine', 'P')], [{ category: 'dessert', name: 'Tiramisu', qty: 2 }], {
      origin: 'Uber Eats',
      paid: false,
    }),
  ];

  it('regroupe les articles vendus avec quantité, prix unitaire et total', () => {
    const sum = summarizeSales(orders);
    expect(sum.orders).toBe(2);
    expect(sum.pizzas).toBe(3);
    expect(sum.lines).toEqual([
      { category: 'Pizzas', name: 'Reine', detail: 'Grande 33', qty: 2, unitPrice: 1150, total: 2300 },
      { category: 'Pizzas', name: 'Reine', detail: 'Petite 29', qty: 1, unitPrice: 950, total: 950 },
      { category: 'Suppléments', name: 'Chèvre', detail: '', qty: 1, unitPrice: 150, total: 150 },
      { category: 'Boissons', name: 'Coca-Cola', detail: '', qty: 1, unitPrice: 250, total: 250 },
      { category: 'Desserts', name: 'Tiramisu', detail: '', qty: 2, unitPrice: 400, total: 800 },
    ]);
    expect(sum.total).toBe(2300 + 950 + 150 + 250 + 800);
    expect(sum.unpaid).toEqual({ orders: 1, total: 950 + 800 });
    expect(sum.byOrigin.map((o) => o.origin)).toEqual(['Comptoir', 'Uber Eats']);
  });

  it('sépare le service du midi et celui du soir', () => {
    const periods = servicePeriods(settings.openingHours);
    expect(periods.map((p) => p.label)).toEqual(['Journée complète', 'Midi (11:30–14:00)', 'Soir (18:00–22:30)']);
    expect(ordersInPeriod(orders, settings.openingHours, 's0').map((o) => o.id)).toEqual(['Midi1']);
    expect(ordersInPeriod(orders, settings.openingHours, 's1').map((o) => o.id)).toEqual(['Soir1']);
    expect(ordersInPeriod(orders, settings.openingHours, 'jour')).toHaveLength(2);
  });

  it('produit un fichier tableur lisible par Excel', () => {
    const csv = salesCsv(orders, {
      date: '2026-11-10',
      periodLabel: 'Journée complète',
      exportedAt: new Date(2026, 10, 10, 22, 45),
    });
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines).toContain('Date;10/11/2026');
    expect(lines).toContain('Total des ventes (€);44,50');
    expect(lines).toContain('Pizzas;Reine;Grande 33;2;11,50;23,00');
    expect(lines).toContain('Suppléments;Chèvre;;1;1,50;1,50');
    expect(lines).toContain(';TOTAL DES VENTES;;;;44,50');
    expect(lines).toContain('19:10;Soir1;Uber Eats;P Reine · 2× Tiramisu;17,50;Non;Oui');
  });
});
