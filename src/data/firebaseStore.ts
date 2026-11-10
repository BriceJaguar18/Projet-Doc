import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { KIOSK_ACCOUNTS, firebaseConfig } from '../config/firebase-config';
import { withDefaults } from '../domain/defaultSettings';
import type { DayQuotas, Order, Role, Settings } from '../domain/types';
import { PIZZA_CONTENT_FIELDS, type AuthApi, type ConnectionState, type DaySnapshot, type Store } from './store';

/**
 * MODE PRODUCTION : Firebase Firestore (base de données temps réel dans le cloud).
 *
 * Collections :
 *   orders/{id}          une commande (pizzas incluses, indexées par id)
 *   config/settings      carte, quotas par défaut, horaires...
 *   quotas/{AAAA-MM-JJ}  quotas modifiés à la main pour un jour : { "19:10": {G, P} }
 */

const useEmulator = import.meta.env.VITE_FIREBASE_EMULATOR === '1';

export function createFirebase(): { store: Store; auth: AuthApi } {
  const config = useEmulator
    ? { apiKey: 'demo-key', projectId: 'demo-kiosque', authDomain: 'localhost' }
    : firebaseConfig;
  const app = initializeApp(config);

  // Cache local : l'appli continue de fonctionner si internet coupe quelques instants,
  // et renvoie les changements automatiquement au retour de la connexion.
  const db: Firestore = initializeFirestore(app, {
    // Un champ facultatif absent (ex. prix d'une ancienne commande) ne bloque pas l'enregistrement.
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const firebaseAuth = getAuth(app);
  if (useEmulator) {
    const host = location.hostname;
    connectFirestoreEmulator(db, host, 8080);
    connectAuthEmulator(firebaseAuth, `http://${host}:9099`, { disableWarnings: true });
  }

  /* ----------------------------- Connexion ----------------------------- */

  let fromCache = false;
  let pending = false;
  const connListeners = new Set<(c: ConnectionState) => void>();
  const connState = (): ConnectionState =>
    !navigator.onLine || fromCache ? 'offline' : pending ? 'pending' : 'online';
  const emitConn = () => connListeners.forEach((l) => l(connState()));
  window.addEventListener('online', emitConn);
  window.addEventListener('offline', emitConn);

  /* ------------------------------ Données ------------------------------ */

  const orderRef = (id: string) => doc(db, 'orders', id);

  const store: Store = {
    kind: 'firebase',

    subscribeDay(date, cb) {
      let orders: Order[] = [];
      let settings: Settings = withDefaults(null);
      let dayQuotas: DayQuotas = {};
      let gotOrders = false;
      let gotSettings = false;
      const emit = () => cb({ orders, settings, dayQuotas, ready: gotOrders && gotSettings } satisfies DaySnapshot);

      const unsubs = [
        onSnapshot(
          query(collection(db, 'orders'), where('serviceDate', '==', date)),
          { includeMetadataChanges: true },
          (snap) => {
            orders = snap.docs.map((d) => d.data() as Order);
            gotOrders = true;
            fromCache = snap.metadata.fromCache;
            pending = snap.metadata.hasPendingWrites;
            emit();
            emitConn();
          },
          (err) => console.error('Lecture des commandes impossible', err),
        ),
        onSnapshot(
          doc(db, 'config', 'settings'),
          (snap) => {
            settings = withDefaults(snap.exists() ? (snap.data() as Settings) : null);
            gotSettings = true;
            emit();
          },
          (err) => console.error('Lecture des réglages impossible', err),
        ),
        onSnapshot(
          doc(db, 'quotas', date),
          (snap) => {
            dayQuotas = snap.exists() ? (snap.data() as DayQuotas) : {};
            emit();
          },
          (err) => console.error('Lecture des quotas impossible', err),
        ),
      ];
      return () => unsubs.forEach((u) => u());
    },

    subscribeConnection(cb) {
      connListeners.add(cb);
      cb(connState());
      return () => connListeners.delete(cb);
    },

    createOrder: (order) => setDoc(orderRef(order.id), order),

    updateOrder(prev, next) {
      // Mise à jour champ par champ : on ne touche jamais au statut d'une pizza existante,
      // pour ne pas annuler un « Au four » envoyé par la cuisine pendant la modification.
      const updates: Record<string, unknown> = {
        pickupTime: next.pickupTime,
        requestedTime: next.requestedTime ?? next.pickupTime,
        slot: next.slot,
        customerName: next.customerName,
        origin: next.origin,
        paid: next.paid,
        note: next.note,
        items: next.items,
      };
      for (const p of Object.values(next.pizzas)) {
        if (prev.pizzas[p.id]) {
          for (const f of PIZZA_CONTENT_FIELDS) if (p[f] !== undefined) updates[`pizzas.${p.id}.${f}`] = p[f];
        } else {
          updates[`pizzas.${p.id}`] = p;
        }
      }
      for (const id of Object.keys(prev.pizzas)) {
        if (!next.pizzas[id]) updates[`pizzas.${id}`] = deleteField();
      }
      return updateDoc(orderRef(prev.id), updates);
    },

    deleteOrder: (id) => deleteDoc(orderRef(id)),

    setPizzaStatuses(orderId, pizzaIds, status) {
      const updates: Record<string, unknown> = {};
      for (const id of pizzaIds) updates[`pizzas.${id}.status`] = status;
      return updateDoc(orderRef(orderId), updates);
    },

    setPaid: (orderId, paid) => updateDoc(orderRef(orderId), { paid }),
    setCollected: (orderId, collected) => updateDoc(orderRef(orderId), { collected }),

    setSlotQuota(date, slot, quota) {
      return setDoc(doc(db, 'quotas', date), { [slot]: quota ?? deleteField() }, { merge: true });
    },

    saveSettings: (settings) => setDoc(doc(db, 'config', 'settings'), settings),

    async fetchDay(date) {
      const snap = await getDocs(query(collection(db, 'orders'), where('serviceDate', '==', date)));
      return snap.docs.map((d) => d.data() as Order);
    },
  };

  /* -------------------------- Authentification -------------------------- */

  const roleOf = (email: string | null | undefined): Role | null => {
    if (email === KIOSK_ACCOUNTS.service) return 'service';
    if (email === KIOSK_ACCOUNTS.cuisine) return 'cuisine';
    return null;
  };

  const auth: AuthApi = {
    subscribe(cb) {
      return onAuthStateChanged(firebaseAuth, (user) => cb(roleOf(user?.email), true));
    },
    async signIn(role, password) {
      await signInWithEmailAndPassword(firebaseAuth, KIOSK_ACCOUNTS[role], password);
    },
    signOut: () => signOut(firebaseAuth),
  };

  return { store, auth };
}
