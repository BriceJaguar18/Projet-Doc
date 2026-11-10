/** Rôle d'une tablette : comptoir ou cuisine. */
export type Role = 'service' | 'cuisine';

/** Cycle de vie d'une pizza. */
export type PizzaStatus = 'attente' | 'preparation' | 'four' | 'prete';

/** G = Grande 33 cm, P = Petite 29 cm. */
export type Size = 'G' | 'P';

export type Base = 'tomate' | 'creme';

export type OtherCategory = 'boisson' | 'kiosquito' | 'dessert';

export interface Pizza {
  id: string;
  /** Ordre d'affichage dans la commande. */
  position: number;
  name: string;
  size: Size;
  base: Base;
  supplements: string[];
  /** Ingrédients retirés. */
  removed: string[];
  /** Changement libre (« remplacer jambon par poulet »...). */
  note: string;
  cut: boolean;
  olives: boolean;
  status: PizzaStatus;
  /**
   * Créneau de production (HH:MM). En général celui de l'heure demandée, ou un créneau
   * suivant si le créneau demandé était complet. Absent sur les anciennes commandes.
   */
  slot?: string;
  /** Pizza saisie à la main (« Autre pizza ») : son prix est saisi dans la commande. */
  custom?: boolean;
  /** Prix de la pizza seule pour sa taille, en centimes (figé au moment de la commande). */
  basePrice?: number;
  /** Prix de chaque supplément, en centimes (figé au moment de la commande). */
  suppPrices?: Record<string, number>;
}

/** Boissons, Kiosquitos, Desserts. */
export interface OtherItem {
  category: OtherCategory;
  name: string;
  qty: number;
  /** Prix unitaire en centimes (figé au moment de la commande). */
  unitPrice?: number;
}

export interface Order {
  id: string;
  /** Jour de service, AAAA-MM-JJ (heure locale). */
  serviceDate: string;
  /**
   * Heure de retrait annoncée au client, HH:MM : l'heure demandée, décalée si des pizzas
   * ont basculé sur un créneau suivant. Les alertes de retard se basent sur cette heure.
   */
  pickupTime: string;
  /** Heure demandée par le client, HH:MM (absente sur les anciennes commandes). */
  requestedTime?: string;
  /** Créneau de 10 min de l'heure demandée, HH:MM. */
  slot: string;
  customerName: string;
  origin: string;
  paid: boolean;
  collected: boolean;
  note: string;
  /** Pizzas indexées par id : la cuisine modifie uniquement `pizzas.<id>.status`. */
  pizzas: Record<string, Pizza>;
  items: OtherItem[];
  /** Horodatage technique (tri secondaire), jamais affiché. */
  createdAt: number;
}

/** Article de la carte avec son prix en centimes. */
export interface PricedItem {
  name: string;
  price: number;
}

export interface MenuPizza {
  name: string;
  base: Base;
  ingredients: string[];
  /** Prix en centimes. */
  priceG: number;
  priceP: number;
}

export interface OpeningRange {
  start: string;
  end: string;
}

export interface Settings {
  menu: {
    pizzas: MenuPizza[];
    supplements: PricedItem[];
    boissons: PricedItem[];
    kiosquitos: PricedItem[];
    desserts: PricedItem[];
  };
  origins: string[];
  /** Nombre max de pizzas (toutes tailles confondues) par créneau de 10 min. */
  defaultQuota: number;
  openingHours: OpeningRange[];
  /** Pré-alerte « À lancer » X minutes avant l'heure de retrait. */
  preAlertMinutes: number;
  defaultCut: boolean;
  defaultOlives: boolean;
}

/** Quotas modifiés à la main pour un jour donné : créneau → nombre max de pizzas. */
export type DayQuotas = Record<string, number>;
