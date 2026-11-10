import { withDefaults } from '../domain/defaultSettings';
import { priceItem, pricePizza } from '../domain/pricing';
import { fromMinutes, localISODate, newId, nowMinutes, slotOf } from '../domain/rules';
import type { Order, Pizza, PizzaStatus, Size } from '../domain/types';
import type { Store } from './store';

/** Remplit le mode démo avec des commandes réalistes autour de l'heure actuelle. */
export async function seedDemo(store: Store) {
  const settings = withDefaults(null);
  const now = new Date();
  const date = localISODate(now);
  const base = nowMinutes(now);
  const menu = (name: string) => settings.menu.pizzas.find((p) => p.name === name)!;

  const pizza = (name: string, size: Size, status: PizzaStatus, extra: Partial<Pizza> = {}): Pizza => ({
    id: newId(),
    position: 0,
    name,
    size,
    base: menu(name).base,
    supplements: [],
    removed: [],
    note: '',
    cut: true,
    olives: true,
    status,
    ...extra,
  });

  const order = (offset: number, customerName: string, origin: string, pizzas: Pizza[], extra: Partial<Order> = {}): Order => {
    const pickupTime = fromMinutes(Math.round((base + offset) / 5) * 5);
    return {
      id: newId(),
      serviceDate: date,
      pickupTime,
      slot: slotOf(pickupTime),
      customerName,
      origin,
      paid: false,
      collected: false,
      note: '',
      requestedTime: pickupTime,
      pizzas: Object.fromEntries(
        pizzas.map((p, i) => [p.id, pricePizza({ ...p, position: i, slot: slotOf(pickupTime) }, settings)]),
      ),
      createdAt: Date.now() + offset,
      ...extra,
      items: (extra.items ?? []).map((it) => priceItem(it, settings)),
    };
  };

  const orders: Order[] = [
    order(-25, 'Martin', 'Comptoir', [pizza('Reine', 'G', 'prete'), pizza('Margherita', 'P', 'prete')], {
      paid: true,
      collected: true,
      items: [{ category: 'boisson', name: 'Coca-Cola', qty: 2 }],
    }),
    order(-5, 'Dupont', 'Téléphone', [pizza('4 Fromages', 'G', 'four'), pizza('Orientale', 'G', 'preparation')]),
    order(0, 'Uber #A3F2', 'Uber Eats', [pizza('Savoyarde', 'G', 'four', { cut: true })], { paid: true }),
    order(5, 'Leroy', 'Comptoir', [pizza('Chèvre Miel', 'P', 'prete', { olives: false })], {
      items: [{ category: 'dessert', name: 'Tiramisu', qty: 1 }],
    }),
    order(10, 'Bernard', 'Delicity', [
      pizza('Reine', 'G', 'preparation', { supplements: ['Œuf'], removed: ['Champignons'] }),
      pizza('Margherita', 'P', 'attente', { cut: false }),
    ]),
    order(20, 'Petit', 'Téléphone', [pizza('Calzone', 'G', 'attente'), pizza('Saumon', 'G', 'attente'), pizza('Reine', 'P', 'attente')], {
      items: [
        { category: 'boisson', name: 'Orangina', qty: 3 },
        { category: 'kiosquito', name: 'Kiosquito Chorizo', qty: 2 },
      ],
    }),
    order(35, 'Moreau', 'Comptoir', [pizza('Orientale', 'G', 'attente', { note: 'bien cuite', olives: false })], {
      paid: true,
    }),
  ];
  for (const o of orders) await store.createOrder(o);
}
