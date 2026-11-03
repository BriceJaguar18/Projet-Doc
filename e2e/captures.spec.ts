import { expect, test } from '@playwright/test';

/**
 * Génère les captures d'écran utilisées dans la documentation (docs/captures).
 * Lancement : CAPTURES=1 npx playwright test captures
 */
test.skip(!process.env.CAPTURES, 'Captures uniquement sur demande (CAPTURES=1)');
test.use({ deviceScaleFactor: 2 });

test('captures de la documentation', async ({ context }) => {
  await context.clock.install({ time: new Date('2026-11-03T19:02:00+01:00') });
  const service = await context.newPage();
  await service.goto('/');
  await service.getByRole('button', { name: "Ajouter des commandes d'exemple" }).click();
  await expect(service.getByText("Commandes d'exemple ajoutées")).toBeVisible();

  await service.goto('/#/service');
  await expect(service.getByTestId('order-Dupont')).toBeVisible();
  await service.screenshot({ path: 'docs/captures/service.png' });

  const kitchen = await context.newPage();
  await kitchen.goto('/#/cuisine');
  await expect(kitchen.getByTestId('ticket-Dupont')).toBeVisible();
  await kitchen.screenshot({ path: 'docs/captures/cuisine.png' });

  await service.bringToFront();
  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Garcia');
  await service.getByTestId('pick-19:30').click();
  await service.locator('.menu-btn', { hasText: 'Reine' }).click();
  const ed = service.getByTestId('pizza-editor').last();
  await ed.getByRole('button', { name: '+ Chèvre' }).click();
  await ed.getByRole('button', { name: '− Champignons' }).click();
  await ed.getByRole('group', { name: 'Olives' }).getByRole('button', { name: 'Non' }).click();
  await service.locator('.modal-body').evaluate((el) => (el.scrollTop = 330));
  await service.screenshot({ path: 'docs/captures/formulaire.png' });
});
