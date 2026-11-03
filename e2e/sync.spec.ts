import { expect, test, type Page } from '@playwright/test';

/**
 * Scénario complet sur deux onglets synchronisés (mode démo) :
 * le comptoir prend une commande, la cuisine la prépare, le comptoir la valide.
 */

const START = new Date('2026-11-03T18:50:00+01:00'); // 18:50 heure de Paris

const COLORS = {
  attente: 'rgb(236, 239, 243)',
  preparation: 'rgb(253, 230, 138)',
  four: 'rgb(165, 208, 255)',
  prete: 'rgb(167, 234, 185)',
  rose: 'rgb(251, 207, 232)',
};

async function openScreens(context: import('@playwright/test').BrowserContext) {
  // L'horloge simulée est commune aux deux onglets.
  await context.clock.install({ time: START });
  const service = await context.newPage();
  const kitchen = await context.newPage();
  await service.goto('/#/service');
  await kitchen.goto('/#/cuisine');
  await expect(service.getByRole('heading', { name: 'Service' })).toBeVisible();
  await expect(kitchen.getByRole('heading', { name: 'Cuisine' })).toBeVisible();
  return { service, kitchen };
}

async function addPizza(page: Page, name: string, opts: { size?: 'Petite 29'; olives?: 'Non'; supp?: string; remove?: string } = {}) {
  await page.locator('.menu-btn', { hasText: name }).click();
  const ed = page.getByTestId('pizza-editor').last();
  if (opts.size) await ed.getByRole('group', { name: 'Taille' }).getByRole('button', { name: opts.size }).click();
  if (opts.olives) await ed.getByRole('group', { name: 'Olives' }).getByRole('button', { name: opts.olives }).click();
  if (opts.supp) await ed.getByRole('button', { name: `+ ${opts.supp}` }).click();
  if (opts.remove) await ed.getByRole('button', { name: `− ${opts.remove}` }).click();
}

test('commande synchronisée entre Service et Cuisine, du four au retrait', async ({ context }) => {
  const { service, kitchen } = await openScreens(context);

  // --- Le comptoir prend la commande ---
  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Dupont');
  await service.getByRole('group', { name: 'Origine' }).getByRole('button', { name: 'Téléphone' }).click();
  await service.getByTestId('pick-19:10').click();
  await addPizza(service, 'Reine', { olives: 'Non', supp: 'Œuf', remove: 'Champignons' });
  await addPizza(service, 'Margherita', { size: 'Petite 29' });
  await service.getByRole('button', { name: 'Plus Coca-Cola' }).click();
  await service.getByTestId('submit-order').click();

  const card = service.getByTestId('order-Dupont');
  const rows = card.getByTestId('pizza-row');
  await expect(card).toBeVisible();
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveCSS('background-color', COLORS.attente);
  await expect(card).toContainText('1× Coca-Cola');
  await expect(service.getByTestId('slot-19:10')).toContainText('G 1/3');
  await expect(service.getByTestId('slot-19:10')).toContainText('P 1/2');

  // --- La cuisine la reçoit instantanément ---
  const ticket = kitchen.getByTestId('ticket-Dupont');
  await expect(ticket).toBeVisible();
  const kp = ticket.getByTestId('kitchen-pizza');
  await expect(kp).toHaveCount(2);
  await expect(kp.first()).toContainText('SANS OLIVES');
  await expect(kp.first()).toContainText('+ Œuf');
  await expect(kp.first()).toContainText('− Champignons');
  await expect(kp.first()).toContainText('COUPÉE');
  // La cuisine n'a pas les boutons du comptoir.
  await expect(kitchen.getByRole('button', { name: /Prête/ })).toHaveCount(0);
  await expect(kitchen.getByRole('button', { name: /Payée/ })).toHaveCount(0);

  // --- Lancer préparation → jaune côté Service ---
  await kp.first().getByRole('button', { name: 'Lancer préparation' }).click();
  await expect(rows.first()).toHaveAttribute('data-status', 'preparation');
  await expect(rows.first()).toHaveCSS('background-color', COLORS.preparation);

  // --- Au four → bleu ---
  await kp.first().getByRole('button', { name: 'Au four' }).click();
  await expect(rows.first()).toHaveCSS('background-color', COLORS.four);

  // --- Erreur de manipulation : retour en préparation, puis à nouveau au four ---
  await kp.first().getByRole('button', { name: '↩ Retour préparation' }).click();
  await expect(rows.first()).toHaveCSS('background-color', COLORS.preparation);
  await kp.first().getByRole('button', { name: 'Au four' }).click();
  await expect(rows.first()).toHaveCSS('background-color', COLORS.four);

  // --- Le comptoir valide la sortie du four → vert ---
  await rows.first().getByRole('button', { name: 'Prête ✓' }).click();
  await expect(rows.first()).toHaveCSS('background-color', COLORS.prete);
  await expect(kp.first()).toHaveAttribute('data-status', 'prete');

  // --- Deuxième pizza avec les boutons groupés ---
  await kp.nth(1).getByRole('button', { name: 'Lancer préparation' }).click();
  await kp.nth(1).getByRole('button', { name: 'Au four' }).click();
  await rows.nth(1).getByRole('button', { name: 'Prête ✓' }).click();
  // Toutes les pizzas prêtes : le ticket quitte l'écran cuisine.
  await expect(ticket).toHaveCount(0);

  // --- Payée → nom barré ---
  await card.getByRole('button', { name: 'Payée ?' }).click();
  await expect(card.locator('.pizza-name').first()).toHaveCSS('text-decoration-line', 'line-through');

  // --- Récupérée → carte rose (dans l'onglet « Récupérées ») ---
  await card.getByRole('button', { name: 'Récupérée ?' }).click();
  await expect(card).toHaveCount(0);
  await service.getByRole('button', { name: /Récupérées/ }).click();
  await expect(service.getByTestId('order-Dupont')).toHaveCSS('background-color', COLORS.rose);
});

test('alertes de retard et quotas par créneau', async ({ context }) => {
  const { service, kitchen } = await openScreens(context);

  // Commande pour 19:00 alors qu'il est 18:50 → pré-alerte « À lancer ».
  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Leroy');
  await service.getByTestId('pick-19:00').click();
  await addPizza(service, 'Orientale');
  await service.getByTestId('submit-order').click();
  await expect(service.getByTestId('order-Leroy').getByTestId('badge-bientot')).toBeVisible();
  await expect(kitchen.getByTestId('ticket-Leroy').getByTestId('badge-bientot')).toBeVisible();

  // 19:03 : l'heure promise est dépassée → RETARD sur les deux écrans.
  await context.clock.fastForward('13:00');
  await expect(service.getByTestId('order-Leroy').getByTestId('badge-retard')).toContainText('RETARD +3 min');
  await expect(kitchen.getByTestId('ticket-Leroy').getByTestId('badge-retard')).toBeVisible();
  await expect(service.getByTestId('order-Leroy')).toHaveClass(/alert-retard/);

  // Quota 3 grandes par créneau : 4 grandes sur 19:20 → avertissement, puis on force.
  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Petit');
  await service.getByTestId('pick-19:20').click();
  for (const name of ['Reine', 'Calzone', 'Savoyarde']) await addPizza(service, name);
  await expect(service.getByTestId('capacity-warning')).toHaveCount(0);
  await addPizza(service, 'Saumon');
  await expect(service.getByTestId('capacity-warning')).toContainText('Grandes 4/3');
  await expect(service.getByTestId('submit-order')).toHaveText('Forcer et enregistrer');
  await service.getByTestId('submit-order').click();
  await expect(service.getByTestId('slot-19:20')).toContainText('G 4/3');
  await expect(service.getByTestId('slot-19:20')).toHaveClass(/level-depasse/);

  // Le gérant augmente le quota de ce créneau (affluence) → synchronisé en cuisine.
  await service.getByTestId('slot-19:20').click();
  await service.getByRole('button', { name: 'Plus grandes' }).click();
  await service.getByRole('button', { name: 'OK' }).click();
  await expect(service.getByTestId('slot-19:20')).toContainText('G 4/4');
  await expect(kitchen.getByTestId('kitchen-slot-19:20')).toContainText('Grandes 4/4');
});

test('modifier une commande ne remet pas à zéro le travail de la cuisine', async ({ context }) => {
  const { service, kitchen } = await openScreens(context);
  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Moreau');
  await service.getByTestId('pick-19:30').click();
  await addPizza(service, 'Reine');
  await service.getByTestId('submit-order').click();

  await kitchen.getByTestId('ticket-Moreau').getByRole('button', { name: 'Lancer préparation' }).click();
  await kitchen.getByTestId('ticket-Moreau').getByRole('button', { name: 'Au four' }).click();

  // Le comptoir ajoute une pizza et change l'heure.
  await service.getByTestId('order-Moreau').getByRole('button', { name: 'Modifier' }).click();
  await service.getByTestId('pick-19:40').click();
  await addPizza(service, 'Margherita');
  await service.getByTestId('submit-order').click();

  const rows = service.getByTestId('order-Moreau').getByTestId('pizza-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute('data-status', 'four');
  await expect(rows.nth(1)).toHaveAttribute('data-status', 'attente');
  await expect(service.getByTestId('order-Moreau')).toContainText('19:40');
  await expect(kitchen.getByTestId('ticket-Moreau').getByTestId('kitchen-pizza')).toHaveCount(2);
});
