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
}

/** Boissons, Kiosquitos, Desserts. */
export interface OtherItem {
  category: OtherCategory;
  name: string;
  qty: number;
}

export interface Order {
  id: string;
  /** Jour de service, AAAA-MM-JJ (heure locale). */
  serviceDate: string;
  /** Heure de retrait promise au client, HH:MM. */
  pickupTime: string;
  /** Créneau de 10 min correspondant, HH:MM. */
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

export interface Quota {
  G: number;
  P: number;
}

export interface MenuPizza {
  name: string;
  base: Base;
  ingredients: string[];
}

export interface OpeningRange {
  start: string;
  end: string;
}

export interface Settings {
  menu: {
    pizzas: MenuPizza[];
    supplements: string[];
    boissons: string[];
    kiosquitos: string[];
    desserts: string[];
  };
  origins: string[];
  /** Nombre max de pizzas par créneau de 10 min. */
  defaultQuota: Quota;
  openingHours: OpeningRange[];
  /** Pré-alerte « À lancer » X minutes avant l'heure de retrait. */
  preAlertMinutes: number;
  defaultCut: boolean;
  defaultOlives: boolean;
}

/** Quotas modifiés à la main pour un jour donné : créneau → quota. */
export type DayQuotas = Record<string, Quota>;
