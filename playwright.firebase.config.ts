import { defineConfig } from '@playwright/test';

/**
 * Tests contre l'émulateur Firebase (vraie base Firestore + vraies règles de sécurité, en local).
 * Lancement : npm run e2e:firebase  (nécessite firebase-tools et Java)
 */
export default defineConfig({
  testDir: 'e2e-firebase',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5175',
    viewport: { width: 1280, height: 800 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  },
  webServer: {
    command: 'npx vite --port 5175 --strictPort',
    env: { VITE_FIREBASE_EMULATOR: '1' },
    url: 'http://localhost:5175',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
