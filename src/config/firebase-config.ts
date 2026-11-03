/**
 * Configuration du projet Firebase du kiosque.
 *
 * Ces valeurs ne sont PAS secrètes (elles sont visibles par toute personne qui ouvre l'appli) :
 * la sécurité est assurée par les comptes de connexion et les règles `firestore.rules`.
 *
 * Tant que `apiKey` est vide, l'appli fonctionne en MODE DÉMO (données gardées dans le
 * navigateur, synchronisées seulement entre les onglets d'un même appareil).
 *
 * Où trouver ces valeurs : voir docs/GUIDE-INSTALLATION.md, étape 1.6.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/**
 * Comptes de connexion des tablettes (à créer dans Firebase > Authentication).
 * Ce sont des identifiants, aucun e-mail n'est jamais envoyé à ces adresses.
 * S'ils sont modifiés ici, il faut aussi les modifier dans `firestore.rules`.
 */
export const KIOSK_ACCOUNTS = {
  service: 'service@kiosque-frouzins.fr',
  cuisine: 'cuisine@kiosque-frouzins.fr',
} as const;
