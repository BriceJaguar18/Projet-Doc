import { formatAmount, orderTotal } from './pricing';
import { SIZE_LABEL, byPickup, requestedTimeOf, sortedPizzas, toMinutes } from './rules';
import type { OpeningRange, Order, OtherCategory } from './types';

/* ------------------------------------------------------------------ */
/* Récapitulatif des ventes                                            */
/* ------------------------------------------------------------------ */

export type SalesCategory = 'Pizzas' | 'Suppléments' | 'Boissons' | 'Kiosquitos' | 'Desserts';

export const SALES_CATEGORIES: SalesCategory[] = ['Pizzas', 'Suppléments', 'Boissons', 'Kiosquitos', 'Desserts'];

const OTHER_CATEGORY: Record<OtherCategory, SalesCategory> = {
  boisson: 'Boissons',
  kiosquito: 'Kiosquitos',
  dessert: 'Desserts',
};

export interface SalesLine {
  category: SalesCategory;
  name: string;
  /** Taille pour les pizzas, vide sinon. */
  detail: string;
  qty: number;
  /** Centimes. */
  unitPrice: number;
  total: number;
}

export interface SalesSummary {
  orders: number;
  pizzas: number;
  /** Total des ventes, en centimes. */
  total: number;
  lines: SalesLine[];
  byCategory: Array<{ category: SalesCategory; qty: number; total: number }>;
  byOrigin: Array<{ origin: string; orders: number; total: number }>;
  unpaid: { orders: number; total: number };
}

export function summarizeSales(orders: Order[]): SalesSummary {
  const lines = new Map<string, SalesLine>();
  const add = (category: SalesCategory, name: string, detail: string, unitPrice: number, qty: number) => {
    const key = [category, name, detail, unitPrice].join('|');
    const line = lines.get(key) ?? { category, name, detail, qty: 0, unitPrice, total: 0 };
    line.qty += qty;
    line.total += qty * unitPrice;
    lines.set(key, line);
  };

  const origins = new Map<string, { origin: string; orders: number; total: number }>();
  const unpaid = { orders: 0, total: 0 };
  let pizzas = 0;
  let total = 0;

  for (const o of orders) {
    for (const p of sortedPizzas(o)) {
      pizzas += 1;
      add('Pizzas', p.name, SIZE_LABEL[p.size], p.basePrice ?? 0, 1);
      for (const s of p.supplements) add('Suppléments', s, '', p.suppPrices?.[s] ?? 0, 1);
    }
    for (const it of o.items) add(OTHER_CATEGORY[it.category], it.name, '', it.unitPrice ?? 0, it.qty);

    const t = orderTotal(o);
    total += t;
    const og = origins.get(o.origin) ?? { origin: o.origin, orders: 0, total: 0 };
    og.orders += 1;
    og.total += t;
    origins.set(o.origin, og);
    if (!o.paid) {
      unpaid.orders += 1;
      unpaid.total += t;
    }
  }

  const sorted = [...lines.values()].sort(
    (a, b) =>
      SALES_CATEGORIES.indexOf(a.category) - SALES_CATEGORIES.indexOf(b.category) ||
      a.name.localeCompare(b.name, 'fr') ||
      a.detail.localeCompare(b.detail, 'fr') ||
      a.unitPrice - b.unitPrice,
  );

  return {
    orders: orders.length,
    pizzas,
    total,
    lines: sorted,
    byCategory: SALES_CATEGORIES.map((category) => {
      const ls = sorted.filter((l) => l.category === category);
      return { category, qty: ls.reduce((n, l) => n + l.qty, 0), total: ls.reduce((n, l) => n + l.total, 0) };
    }).filter((c) => c.qty > 0),
    byOrigin: [...origins.values()].sort((a, b) => b.total - a.total),
    unpaid,
  };
}

/* ------------------------------------------------------------------ */
/* Services (midi / soir)                                              */
/* ------------------------------------------------------------------ */

export interface ServicePeriod {
  id: string;
  label: string;
}

function sortedRanges(openingHours: OpeningRange[]): OpeningRange[] {
  return [...openingHours].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/** « Journée complète » puis un service par plage d'ouverture (Midi, Soir…). */
export function servicePeriods(openingHours: OpeningRange[]): ServicePeriod[] {
  const ranges = sortedRanges(openingHours);
  const names = ranges.map((r) => (toMinutes(r.start) < 15 * 60 ? 'Midi' : 'Soir'));
  const distinct = new Set(names).size === names.length;
  return [
    { id: 'jour', label: 'Journée complète' },
    ...ranges.map((r, i) => ({
      id: `s${i}`,
      label: `${distinct ? names[i] : `Service ${i + 1}`} (${r.start}–${r.end})`,
    })),
  ];
}

/**
 * Commandes d'un service : chaque commande appartient à la dernière plage d'ouverture
 * commencée à son heure demandée (une commande de 15:00 compte pour le midi).
 */
export function ordersInPeriod(orders: Order[], openingHours: OpeningRange[], periodId: string): Order[] {
  if (periodId === 'jour') return orders;
  const ranges = sortedRanges(openingHours);
  const index = Number(periodId.slice(1));
  return orders.filter((o) => {
    const t = toMinutes(requestedTimeOf(o));
    let found = 0;
    ranges.forEach((r, i) => {
      if (toMinutes(r.start) <= t) found = i;
    });
    return found === index;
  });
}

/* ------------------------------------------------------------------ */
/* Fichier tableur (CSV, s'ouvre dans Excel, Numbers, Google Sheets)   */
/* ------------------------------------------------------------------ */

function cell(v: string | number): string {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(...cells: Array<string | number>): string {
  return cells.map(cell).join(';');
}

export function frenchDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Résumé lisible des articles d'une commande : « G Reine (+Chèvre) · 2× Coca-Cola ». */
export function orderLabel(o: Order): string {
  const parts = sortedPizzas(o).map((p) => {
    const extras = [...p.supplements.map((s) => `+${s}`), ...p.removed.map((s) => `−${s}`)];
    return `${p.size} ${p.name}${extras.length ? ` (${extras.join(', ')})` : ''}`;
  });
  for (const it of o.items) parts.push(`${it.qty}× ${it.name}`);
  return parts.join(' · ');
}

export function salesCsv(
  orders: Order[],
  meta: { date: string; periodLabel: string; exportedAt: Date },
): string {
  const sum = summarizeSales(orders);
  const out: string[] = [];
  out.push(row('Kiosque à Pizzas de Frouzins — Récapitulatif des ventes'));
  out.push(row('Date', frenchDate(meta.date)));
  out.push(row('Période', meta.periodLabel));
  out.push(
    row(
      'Exporté le',
      `${meta.exportedAt.toLocaleDateString('fr-FR')} ${meta.exportedAt.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
    ),
  );
  out.push('');
  out.push(row('Total des ventes (€)', formatAmount(sum.total)));
  out.push(row('Commandes', sum.orders));
  out.push(row('Pizzas', sum.pizzas));
  out.push(row('Commandes non marquées payées', sum.unpaid.orders, formatAmount(sum.unpaid.total)));
  out.push('');

  out.push(row('VENTES PAR ARTICLE'));
  out.push(row('Catégorie', 'Article', 'Taille', 'Quantité', 'Prix unitaire (€)', 'Total (€)'));
  for (const c of sum.byCategory) {
    for (const l of sum.lines.filter((x) => x.category === c.category)) {
      out.push(row(l.category, l.name, l.detail, l.qty, formatAmount(l.unitPrice), formatAmount(l.total)));
    }
    out.push(row('', `Total ${c.category}`, '', c.qty, '', formatAmount(c.total)));
  }
  out.push(row('', 'TOTAL DES VENTES', '', '', '', formatAmount(sum.total)));
  out.push('');

  out.push(row('PAR ORIGINE'));
  out.push(row('Origine', 'Commandes', 'Total (€)'));
  for (const o of sum.byOrigin) out.push(row(o.origin, o.orders, formatAmount(o.total)));
  out.push('');

  out.push(row('DÉTAIL DES COMMANDES'));
  out.push(row('Heure de retrait', 'Client', 'Origine', 'Articles', 'Total (€)', 'Payée', 'Récupérée'));
  for (const o of [...orders].sort(byPickup)) {
    out.push(
      row(
        o.pickupTime,
        o.customerName,
        o.origin,
        orderLabel(o),
        formatAmount(orderTotal(o)),
        o.paid ? 'Oui' : 'Non',
        o.collected ? 'Oui' : 'Non',
      ),
    );
  }
  // BOM : Excel reconnaît ainsi les accents (UTF-8).
  return '﻿' + out.join('\r\n') + '\r\n';
}
