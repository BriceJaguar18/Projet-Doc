/**
 * Accès au stockage du navigateur qui ne plante jamais : certains contextes (navigation privée,
 * page intégrée, données bloquées) refusent localStorage / sessionStorage. On garde alors les
 * valeurs en mémoire, le temps de la session.
 */
function wrap(get: () => Storage) {
  const memory = new Map<string, string>();
  return {
    get(key: string): string | null {
      try {
        return get().getItem(key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set(key: string, value: string) {
      memory.set(key, value);
      try {
        get().setItem(key, value);
      } catch {
        /* stockage refusé : la valeur reste en mémoire */
      }
    },
    remove(key: string) {
      memory.delete(key);
      try {
        get().removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export const local = wrap(() => localStorage);
export const session = wrap(() => sessionStorage);
