import type { OtherCategory, OtherItem, Order, Pizza, Settings } from './types';

/**
 * Prix : toujours en centimes (entiers) pour éviter les erreurs d'arrondi.
 * Le prix de chaque article est figé dans la commande au moment où elle est enregistrée :
 * changer la carte plus tard ne modifie pas les ventes passées.
 */

const EUROS = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

/** 1050 → « 10,50 € » */
export function formatPrice(cents: number): string {
  return EUROS.format(cents / 100);
}

/** 1050 → « 10,50 » (champ de saisie, fichier tableur) */
export function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** « 10,5 », « 10.50 », « 10 € » → 1050 ; texte vide → 0 ; texte invalide → null */
export function parsePrice(text: string): number | null {
  const t = text.replace(/\s|€/g, '').replace(',', '.');
  if (t === '') return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

const MENU_KEY: Record<OtherCategory, 'boissons' | 'kiosquitos' | 'desserts'> = {
  boisson: 'boissons',
  kiosquito: 'kiosquitos',
  dessert: 'desserts',
};

export function supplementPrice(settings: Settings, name: string): number | undefined {
  return settings.menu.supplements.find((s) => s.name === name)?.price;
}

export function itemPrice(settings: Settings, category: OtherCategory, name: string): number | undefined {
  return settings.menu[MENU_KEY[category]].find((s) => s.name === name)?.price;
}

/** Fige les prix d'une pizza d'après la carte (prix saisi à la main pour une « Autre pizza »). */
export function pricePizza(p: Pizza, settings: Settings): Pizza {
  const menu = settings.menu.pizzas.find((m) => m.name === p.name);
  const basePrice = !p.custom && menu ? (p.size === 'G' ? menu.priceG : menu.priceP) : (p.basePrice ?? 0);
  const suppPrices = Object.fromEntries(
    p.supplements.map((s) => [s, supplementPrice(settings, s) ?? p.suppPrices?.[s] ?? 0]),
  );
  return { ...p, basePrice, suppPrices };
}

export function priceItem(it: OtherItem, settings: Settings): OtherItem {
  return { ...it, unitPrice: itemPrice(settings, it.category, it.name) ?? it.unitPrice ?? 0 };
}

/** Prix d'une pizza suppléments compris. */
export function pizzaTotal(p: Pizza): number {
  return (p.basePrice ?? 0) + p.supplements.reduce((sum, s) => sum + (p.suppPrices?.[s] ?? 0), 0);
}

export function itemTotal(it: OtherItem): number {
  return it.qty * (it.unitPrice ?? 0);
}

export function orderTotal(order: Pick<Order, 'pizzas' | 'items'>): number {
  return (
    Object.values(order.pizzas).reduce((sum, p) => sum + pizzaTotal(p), 0) +
    order.items.reduce((sum, it) => sum + itemTotal(it), 0)
  );
}
