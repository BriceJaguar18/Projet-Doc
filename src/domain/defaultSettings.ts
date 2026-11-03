import type { Settings } from './types';

/**
 * Réglages de départ. Tout est modifiable ensuite depuis l'écran « Réglages »
 * de la tablette Service (la carte ci-dessous n'est qu'un exemple).
 */
export const DEFAULT_SETTINGS: Settings = {
  menu: {
    pizzas: [
      { name: 'Margherita', base: 'tomate', ingredients: ['Mozzarella', 'Basilic'] },
      { name: 'Reine', base: 'tomate', ingredients: ['Mozzarella', 'Jambon', 'Champignons'] },
      { name: '4 Fromages', base: 'tomate', ingredients: ['Mozzarella', 'Chèvre', 'Bleu', 'Emmental'] },
      { name: 'Orientale', base: 'tomate', ingredients: ['Mozzarella', 'Merguez', 'Poivrons', 'Oignons'] },
      { name: 'Calzone', base: 'tomate', ingredients: ['Mozzarella', 'Jambon', 'Œuf'] },
      { name: 'Savoyarde', base: 'creme', ingredients: ['Mozzarella', 'Pommes de terre', 'Lardons', 'Reblochon'] },
      { name: 'Chèvre Miel', base: 'creme', ingredients: ['Mozzarella', 'Chèvre', 'Miel', 'Noix'] },
      { name: 'Saumon', base: 'creme', ingredients: ['Mozzarella', 'Saumon fumé', 'Aneth'] },
    ],
    supplements: [
      'Mozzarella',
      'Jambon',
      'Champignons',
      'Chèvre',
      'Œuf',
      'Lardons',
      'Poulet',
      'Merguez',
      'Oignons',
      'Poivrons',
      'Anchois',
      'Piment',
    ],
    boissons: ['Coca-Cola', 'Coca Zéro', 'Orangina', 'Ice Tea', 'Eau plate', 'Eau gazeuse', 'Bière'],
    kiosquitos: ['Kiosquito Nature', 'Kiosquito Chorizo', 'Kiosquito Fromage'],
    desserts: ['Tiramisu', 'Pizza Nutella', 'Glace'],
  },
  origins: ['Comptoir', 'Téléphone', 'Uber Eats', 'Delicity'],
  defaultQuota: { G: 3, P: 2 },
  openingHours: [
    { start: '11:30', end: '14:00' },
    { start: '18:00', end: '22:30' },
  ],
  preAlertMinutes: 10,
  defaultCut: true,
  defaultOlives: true,
};

/** Complète des réglages enregistrés (éventuellement anciens) avec les valeurs par défaut. */
export function withDefaults(partial: Partial<Settings> | undefined | null): Settings {
  const p = partial ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...p,
    menu: { ...DEFAULT_SETTINGS.menu, ...(p.menu ?? {}) },
    defaultQuota: { ...DEFAULT_SETTINGS.defaultQuota, ...(p.defaultQuota ?? {}) },
  };
}
