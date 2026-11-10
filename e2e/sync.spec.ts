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
  // Reine G 11,50 + Œuf 1,00 + Margherita P 8,00 + Coca 2,50
  await expect(card.getByTestId('order-total')).toHaveText(/23,00/);
  await expect(service.getByTestId('slot-19:10')).toContainText('2/5');
  await expect(service.getByTestId('slot-19:10')).toContainText('1 G · 1 P');

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

  // Capacité : 5 pizzas par créneau, toutes tailles confondues.
  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Petit');
  await service.getByTestId('pick-19:20').click();
  for (const name of ['Reine', 'Calzone', 'Savoyarde']) await addPizza(service, name);
  await addPizza(service, 'Saumon', { size: 'Petite 29' });
  await expect(service.getByTestId('shift-warning')).toHaveCount(0);
  await service.getByTestId('submit-order').click();
  await expect(service.getByTestId('slot-19:20')).toContainText('4/5');

  // Commande de 3 pizzas sur 19:20 : 1 place → 2 pizzas basculent sur 19:30, retrait décalé.
  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Garcia');
  await expect(service.getByTestId('pick-19:20')).toContainText('1 place');
  await service.getByTestId('pick-19:20').click();
  for (const name of ['Margherita', 'Reine', 'Orientale']) await addPizza(service, name);
  await expect(service.getByTestId('shift-warning')).toContainText('1 pizza(s) à 19:20, 2 pizza(s) à 19:30');
  await expect(service.getByTestId('shift-warning')).toContainText('retrait à 19:30');
  await expect(service.getByTestId('submit-order')).toHaveText('Enregistrer (retrait 19:30)');
  await expect(service.getByTestId('force-order')).toHaveText('Forcer tout sur 19:20');
  await service.getByTestId('submit-order').click();

  const garcia = service.getByTestId('order-Garcia');
  await expect(garcia.locator('.pickup')).toHaveText('19:30');
  await expect(garcia).toContainText('demandé 19:20');
  await expect(garcia.locator('.badge-shift')).toHaveCount(2);
  await expect(service.getByTestId('slot-19:20')).toContainText('5/5');
  await expect(service.getByTestId('slot-19:30')).toContainText('2/5');
  // En cuisine, la commande apparaît dans les deux créneaux, chacun avec ses pizzas.
  await expect(kitchen.locator('[data-testid="ticket-Garcia"][data-slot="19:20"] [data-testid="kitchen-pizza"]')).toHaveCount(1);
  await expect(kitchen.locator('[data-testid="ticket-Garcia"][data-slot="19:30"] [data-testid="kitchen-pizza"]')).toHaveCount(2);
  await expect(kitchen.locator('[data-testid="ticket-Garcia"][data-slot="19:30"]')).toContainText('1 pizza(s) sur 19:20');

  // Créneau complet : le bouton « Forcer » garde la pizza sur 19:20 malgré le quota.
  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Roux');
  await expect(service.getByTestId('pick-19:20')).toContainText('complet');
  await service.getByTestId('pick-19:20').click();
  await addPizza(service, 'Calzone');
  await expect(service.getByTestId('shift-warning')).toContainText('complet');
  await service.getByTestId('force-order').click();
  await expect(service.getByTestId('order-Roux').locator('.pickup')).toHaveText('19:20');
  await expect(service.getByTestId('slot-19:20')).toContainText('6/5');
  await expect(service.getByTestId('slot-19:20')).toHaveClass(/level-depasse/);

  // Le gérant augmente la capacité de ce créneau (affluence) → synchronisé en cuisine.
  await service.getByTestId('slot-19:20').click();
  await service.getByRole('button', { name: 'Plus pizzas' }).click();
  await service.getByRole('button', { name: 'Plus pizzas' }).click();
  await service.getByRole('button', { name: 'OK' }).click();
  await expect(service.getByTestId('slot-19:20')).toContainText('6/7');
  await expect(kitchen.getByTestId('kitchen-slot-19:20')).toContainText('6/7 pizzas');
});

test('récapitulatif des ventes et export du fichier', async ({ context }) => {
  const { service } = await openScreens(context);

  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Martin');
  await service.getByTestId('pick-19:10').click();
  await addPizza(service, 'Reine', { supp: 'Chèvre' });
  await addPizza(service, 'Reine');
  await service.getByRole('button', { name: 'Plus Coca-Cola' }).click();
  await expect(service.getByTestId('form-total')).toHaveText(/27,00/); // 11,50 + 1,50 + 11,50 + 2,50
  await service.getByRole('group', { name: 'Payée' }).getByRole('button', { name: 'Oui' }).click();
  await service.getByTestId('submit-order').click();

  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Bernard');
  await service.getByTestId('pick-19:30').click();
  await addPizza(service, 'Margherita', { size: 'Petite 29' });
  await service.getByRole('button', { name: 'Plus Tiramisu' }).click();
  await service.getByTestId('submit-order').click();

  await service.getByTestId('open-sales').click();
  await expect(service.getByRole('heading', { name: 'Ventes' })).toBeVisible();
  await expect(service.getByTestId('sales-total')).toHaveText(/39,00/); // 27,00 + 8,00 + 4,00
  const table = service.getByTestId('sales-table');
  await expect(table.locator('tr', { hasText: 'Grande 33' })).toContainText('2');
  await expect(table).toContainText('Chèvre');
  await expect(table).toContainText('Tiramisu');
  await expect(service.getByText('1 commande(s) non marquée(s) payée(s)')).toBeVisible();

  // Service du midi : aucune commande.
  await service.getByRole('button', { name: /Midi/ }).click();
  await expect(service.getByText('Aucune commande sur cette période.')).toBeVisible();
  await service.getByRole('button', { name: /Soir/ }).click();

  const [file] = await Promise.all([service.waitForEvent('download'), service.getByTestId('export-sales').click()]);
  expect(file.suggestedFilename()).toBe('ventes-2026-11-03-soir.csv');
  const csv = (await import('node:fs')).readFileSync(await file.path(), 'utf8');
  expect(csv).toContain('Période;Soir (18:00–22:30)');
  expect(csv).toContain('Total des ventes (€);39,00');
  expect(csv).toContain('Pizzas;Reine;Grande 33;2;11,50;23,00');
  expect(csv).toContain('Suppléments;Chèvre;;1;1,50;1,50');
  expect(csv).toContain('Desserts;Tiramisu;;1;4,00;4,00');
  expect(csv).toContain('19:30;Bernard;Comptoir;P Margherita · 1× Tiramisu;12,00;Non;Non');
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
  await expect(service.getByTestId('order-Moreau').locator('.pickup')).toHaveText('19:40');
  // La pizza déjà au four reste sur son créneau d'origine.
  await expect(rows.first()).toContainText('créneau 19:30');
  await expect(kitchen.getByTestId('ticket-Moreau').getByTestId('kitchen-pizza')).toHaveCount(2);
});
