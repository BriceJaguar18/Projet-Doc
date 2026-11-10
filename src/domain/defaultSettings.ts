import type { MenuPizza, PricedItem, Settings } from './types';

/**
 * Réglages de départ. Tout est modifiable ensuite depuis l'écran « Réglages »
 * de la tablette Service (la carte et les prix ci-dessous ne sont qu'un exemple).
 * Les prix sont en centimes (1050 = 10,50 €).
 */
export const DEFAULT_SETTINGS: Settings = {
  menu: {
    pizzas: [
      { name: 'Margherita', base: 'tomate', ingredients: ['Mozzarella', 'Basilic'], priceG: 1000, priceP: 800 },
      { name: 'Reine', base: 'tomate', ingredients: ['Mozzarella', 'Jambon', 'Champignons'], priceG: 1150, priceP: 950 },
      {
        name: '4 Fromages',
        base: 'tomate',
        ingredients: ['Mozzarella', 'Chèvre', 'Bleu', 'Emmental'],
        priceG: 1250,
        priceP: 1050,
      },
      {
        name: 'Orientale',
        base: 'tomate',
        ingredients: ['Mozzarella', 'Merguez', 'Poivrons', 'Oignons'],
        priceG: 1250,
        priceP: 1050,
      },
      { name: 'Calzone', base: 'tomate', ingredients: ['Mozzarella', 'Jambon', 'Œuf'], priceG: 1200, priceP: 1000 },
      {
        name: 'Savoyarde',
        base: 'creme',
        ingredients: ['Mozzarella', 'Pommes de terre', 'Lardons', 'Reblochon'],
        priceG: 1350,
        priceP: 1150,
      },
      {
        name: 'Chèvre Miel',
        base: 'creme',
        ingredients: ['Mozzarella', 'Chèvre', 'Miel', 'Noix'],
        priceG: 1300,
        priceP: 1100,
      },
      { name: 'Saumon', base: 'creme', ingredients: ['Mozzarella', 'Saumon fumé', 'Aneth'], priceG: 1400, priceP: 1200 },
    ],
    supplements: [
      { name: 'Mozzarella', price: 150 },
      { name: 'Jambon', price: 150 },
      { name: 'Champignons', price: 100 },
      { name: 'Chèvre', price: 150 },
      { name: 'Œuf', price: 100 },
      { name: 'Lardons', price: 150 },
      { name: 'Poulet', price: 200 },
      { name: 'Merguez', price: 200 },
      { name: 'Oignons', price: 100 },
      { name: 'Poivrons', price: 100 },
      { name: 'Anchois', price: 150 },
      { name: 'Piment', price: 50 },
    ],
    boissons: [
      { name: 'Coca-Cola', price: 250 },
      { name: 'Coca Zéro', price: 250 },
      { name: 'Orangina', price: 250 },
      { name: 'Ice Tea', price: 250 },
      { name: 'Eau plate', price: 150 },
      { name: 'Eau gazeuse', price: 180 },
      { name: 'Bière', price: 350 },
    ],
    kiosquitos: [
      { name: 'Kiosquito Nature', price: 300 },
      { name: 'Kiosquito Chorizo', price: 350 },
      { name: 'Kiosquito Fromage', price: 350 },
    ],
    desserts: [
      { name: 'Tiramisu', price: 400 },
      { name: 'Pizza Nutella', price: 600 },
      { name: 'Glace', price: 300 },
    ],
  },
  origins: ['Comptoir', 'Téléphone', 'Uber Eats', 'Delicity'],
  defaultQuota: 5,
  openingHours: [
    { start: '11:30', end: '14:00' },
    { start: '18:00', end: '22:30' },
  ],
  preAlertMinutes: 10,
  defaultCut: true,
  defaultOlives: true,
};

/* -------- Compatibilité avec des réglages enregistrés par une version précédente -------- */

/** Ancienne forme d'un quota : { G: 3, P: 2 } → 5 pizzas. */
export function quotaNumber(q: unknown, fallback: number): number {
  if (typeof q === 'number' && Number.isFinite(q)) return q;
  if (q && typeof q === 'object') {
    const { G = 0, P = 0 } = q as { G?: number; P?: number };
    return G + P;
  }
  return fallback;
}

function pricedList(list: unknown, fallback: PricedItem[]): PricedItem[] {
  if (!Array.isArray(list)) return fallback;
  return list.map((x) =>
    typeof x === 'string' ? { name: x, price: 0 } : { name: String(x?.name ?? ''), price: Number(x?.price) || 0 },
  );
}

function menuPizzas(list: unknown): MenuPizza[] {
  if (!Array.isArray(list)) return DEFAULT_SETTINGS.menu.pizzas;
  return list.map((p) => ({
    name: String(p?.name ?? ''),
    base: p?.base === 'creme' ? 'creme' : 'tomate',
    ingredients: Array.isArray(p?.ingredients) ? p.ingredients : [],
    priceG: Number(p?.priceG) || 0,
    priceP: Number(p?.priceP) || 0,
  }));
}

/** Complète des réglages enregistrés (éventuellement anciens) avec les valeurs par défaut. */
export function withDefaults(partial: Partial<Settings> | undefined | null): Settings {
  const p = (partial ?? {}) as Partial<Settings>;
  const menu = (p.menu ?? {}) as Partial<Settings['menu']>;
  const d = DEFAULT_SETTINGS.menu;
  return {
    ...DEFAULT_SETTINGS,
    ...p,
    menu: {
      pizzas: menu.pizzas ? menuPizzas(menu.pizzas) : d.pizzas,
      supplements: pricedList(menu.supplements, d.supplements),
      boissons: pricedList(menu.boissons, d.boissons),
      kiosquitos: pricedList(menu.kiosquitos, d.kiosquitos),
      desserts: pricedList(menu.desserts, d.desserts),
    },
    defaultQuota: quotaNumber(p.defaultQuota, DEFAULT_SETTINGS.defaultQuota),
  };
}
