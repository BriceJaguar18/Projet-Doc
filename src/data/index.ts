import { firebaseConfig } from '../config/firebase-config';
import { createDemoAuth, createDemoStore } from './demoStore';
import type { AuthApi, Store } from './store';

const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

/** Mode démo si demandé explicitement, ou tant que la config Firebase n'est pas remplie. */
export const IS_DEMO = import.meta.env.MODE === 'demo' || (!firebaseConfig.apiKey && !useEmulator);

export async function createBackend(): Promise<{ store: Store; auth: AuthApi }> {
  if (IS_DEMO) return { store: createDemoStore(), auth: createDemoAuth() };
  // Firebase n'est chargé qu'en production (le mode démo reste léger).
  const m = await import('./firebaseStore');
  return m.createFirebase();
}
