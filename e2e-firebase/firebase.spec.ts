import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Deux tablettes = deux navigateurs totalement séparés, synchronisés via Firestore (émulateur).
 * Vérifie aussi les règles de sécurité (firestore.rules).
 */

const PROJECT = 'demo-kiosque';
const AUTH = 'http://localhost:9099';
const DB = `http://localhost:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const PASSWORD = 'motdepasse-test';
const ACCOUNTS = { service: 'service@kiosque-frouzins.fr', cuisine: 'cuisine@kiosque-frouzins.fr' };

async function idToken(email: string): Promise<string> {
  const body = JSON.stringify({ email, password: PASSWORD, returnSecureToken: true });
  const headers = { 'Content-Type': 'application/json' };
  let res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) {
    res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, { method: 'POST', headers, body });
  }
  const json = (await res.json()) as { idToken: string };
  return json.idToken;
}

test.beforeAll(async () => {
  await fetch(`http://localhost:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`http://localhost:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  for (const email of Object.values(ACCOUNTS)) await idToken(email);
});

async function tablet(browser: Browser, role: 'service' | 'cuisine'): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByTestId(`login-${role}`).click();
  await page.getByPlaceholder('Mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: role === 'service' ? 'Service' : 'Cuisine' })).toBeVisible();
  return page;
}

test('mauvais mot de passe refusé', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByTestId('login-cuisine').click();
  await page.getByPlaceholder('Mot de passe').fill('faux');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Mot de passe incorrect.')).toBeVisible();
});

test('synchronisation Service ↔ Cuisine via Firestore', async ({ browser }) => {
  const service = await tablet(browser, 'service');
  const kitchen = await tablet(browser, 'cuisine');

  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Durand');
  await service.locator('input[type="time"]').fill('23:50');
  await service.locator('.menu-btn', { hasText: 'Reine' }).click();
  await service.getByTestId('pizza-editor').last().getByRole('button', { name: '+ Chèvre' }).click();
  await service.getByTestId('submit-order').click();

  const card = service.getByTestId('order-Durand');
  const row = card.getByTestId('pizza-row').first();
  await expect(row).toHaveAttribute('data-status', 'attente');
  await expect(card.getByTestId('order-total')).toHaveText(/13,00/); // Reine G 11,50 + Chèvre 1,50

  const ticket = kitchen.getByTestId('ticket-Durand');
  await expect(ticket).toContainText('+ Chèvre');
  await ticket.getByRole('button', { name: 'Lancer préparation' }).click();
  await expect(row).toHaveAttribute('data-status', 'preparation');
  await ticket.getByRole('button', { name: 'Au four' }).click();
  await expect(row).toHaveAttribute('data-status', 'four');

  await row.getByRole('button', { name: 'Prête ✓' }).click();
  await expect(ticket).toHaveCount(0);
  await card.getByRole('button', { name: 'Payée ?' }).click();
  await card.getByRole('button', { name: 'Récupérée ?' }).click();
  await expect(card).toHaveCount(0);

  // Les données survivent à un rechargement (elles sont dans le cloud).
  await service.reload();
  await service.getByRole('button', { name: /Récupérées/ }).click();
  await expect(service.getByTestId('order-Durand')).toHaveClass(/collected/);
  await expect(service.getByTestId('order-Durand').getByTestId('order-total')).toHaveText(/13,00/);

  // Récapitulatif des ventes à partir des données du cloud.
  await service.getByTestId('open-sales').click();
  await expect(service.getByTestId('sales-total')).toHaveText(/13,00/);
  await expect(service.getByTestId('sales-table')).toContainText('Chèvre');
});

test('report sur le créneau suivant et prix modifiés dans les réglages', async ({ browser }) => {
  const service = await tablet(browser, 'service');
  const kitchen = await tablet(browser, 'cuisine');

  // Le prix d'une Margherita grande passe à 9,90 € et la capacité par défaut à 2 pizzas.
  await service.getByRole('button', { name: 'Réglages' }).click();
  await service.getByLabel('Prix Margherita grande').fill('9,90');
  await service.getByRole('button', { name: 'Moins pizzas par créneau' }).click();
  await service.getByRole('button', { name: 'Moins pizzas par créneau' }).click();
  await service.getByRole('button', { name: 'Moins pizzas par créneau' }).click();
  await service.getByRole('button', { name: 'Enregistrer' }).click();

  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Faure');
  await service.locator('input[type="time"]').fill('23:30');
  for (let i = 0; i < 3; i++) await service.locator('.menu-btn', { hasText: 'Margherita' }).click();
  await expect(service.getByTestId('form-total')).toHaveText(/29,70/);
  await expect(service.getByTestId('shift-warning')).toContainText('retrait à 23:40');
  await service.getByTestId('submit-order').click();

  await expect(service.getByTestId('order-Faure').locator('.pickup')).toHaveText('23:40');
  await expect(kitchen.locator('[data-testid="ticket-Faure"][data-slot="23:30"] [data-testid="kitchen-pizza"]')).toHaveCount(2);
  await expect(kitchen.locator('[data-testid="ticket-Faure"][data-slot="23:40"] [data-testid="kitchen-pizza"]')).toHaveCount(1);

  // Remettre la capacité par défaut pour les autres tests.
  await service.getByRole('button', { name: 'Réglages' }).click();
  for (let i = 0; i < 3; i++) await service.getByRole('button', { name: 'Plus pizzas par créneau' }).click();
  await service.getByRole('button', { name: 'Enregistrer' }).click();
});

test('règles de sécurité : la cuisine ne modifie que les pizzas', async () => {
  const serviceToken = await idToken(ACCOUNTS.service);
  const cuisineToken = await idToken(ACCOUNTS.cuisine);
  const auth = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

  // Le comptoir crée une commande.
  const create = await fetch(`${DB}/orders?documentId=regles`, {
    method: 'POST',
    headers: auth(serviceToken),
    body: JSON.stringify({
      fields: {
        customerName: { stringValue: 'Règles' },
        paid: { booleanValue: false },
        pizzas: {
          mapValue: { fields: { kp1: { mapValue: { fields: { status: { stringValue: 'attente' } } } } } },
        },
      },
    }),
  });
  expect(create.status).toBe(200);

  // La cuisine peut changer l'état d'une pizza…
  const ok = await fetch(`${DB}/orders/regles?updateMask.fieldPaths=pizzas.kp1.status`, {
    method: 'PATCH',
    headers: auth(cuisineToken),
    body: JSON.stringify({
      fields: { pizzas: { mapValue: { fields: { kp1: { mapValue: { fields: { status: { stringValue: 'four' } } } } } } } },
    }),
  });
  expect(ok.status).toBe(200);

  // … mais pas marquer la commande payée, ni la supprimer.
  const paid = await fetch(`${DB}/orders/regles?updateMask.fieldPaths=paid`, {
    method: 'PATCH',
    headers: auth(cuisineToken),
    body: JSON.stringify({ fields: { paid: { booleanValue: true } } }),
  });
  expect(paid.status).toBe(403);
  const del = await fetch(`${DB}/orders/regles`, { method: 'DELETE', headers: auth(cuisineToken) });
  expect(del.status).toBe(403);

  // Sans compte : rien n'est lisible.
  const anon = await fetch(`${DB}/orders/regles`);
  expect(anon.status).toBe(403);

  // Un autre compte que ceux du kiosque : refusé aussi.
  const intrus = await idToken('intrus@example.com');
  const read = await fetch(`${DB}/orders/regles`, { headers: auth(intrus) });
  expect(read.status).toBe(403);
});

test('coupure internet : rien n’est perdu, tout repart au retour', async ({ browser }) => {
  const service = await tablet(browser, 'service');
  const kitchen = await tablet(browser, 'cuisine');

  await service.getByTestId('new-order').click();
  await service.getByTestId('input-name').fill('Lambert');
  await service.locator('input[type="time"]').fill('23:55');
  await service.locator('.menu-btn', { hasText: 'Margherita' }).click();
  await service.getByTestId('submit-order').click();
  const ticket = kitchen.getByTestId('ticket-Lambert');
  await expect(ticket).toBeVisible();

  // La cuisine perd internet et continue de travailler.
  await kitchen.context().setOffline(true);
  await expect(kitchen.getByText("Pas d'internet")).toBeVisible();
  await ticket.getByRole('button', { name: 'Lancer préparation' }).click();
  await expect(ticket.getByTestId('kitchen-pizza')).toHaveAttribute('data-status', 'preparation');
  const row = service.getByTestId('order-Lambert').getByTestId('pizza-row');
  await expect(row).toHaveAttribute('data-status', 'attente');

  // Retour d'internet : le changement part tout seul vers le comptoir.
  await kitchen.context().setOffline(false);
  await expect(row).toHaveAttribute('data-status', 'preparation', { timeout: 30_000 });
  await expect(kitchen.getByText("Pas d'internet")).toHaveCount(0);
});
