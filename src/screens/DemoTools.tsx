import { useState } from 'react';
import { resetDemo } from '../data/demoStore';
import { seedDemo } from '../data/demoSeed';
import type { AuthApi, Store } from '../data/store';

/** Outils du mode démo : commandes d'exemple, remise à zéro, changement d'écran. */
export function DemoTools({ store, auth }: { store: Store; auth: AuthApi }) {
  const [done, setDone] = useState('');
  return (
    <div className="demo-tools">
      <p className="muted">
        Mode démo : ouvrez l'écran Service dans un onglet et l'écran Cuisine dans un autre (ou une autre fenêtre) pour
        voir la synchronisation.
      </p>
      <div className="row-wrap">
        <button
          className="btn btn-outline"
          onClick={async () => {
            await seedDemo(store);
            setDone("Commandes d'exemple ajoutées");
          }}
        >
          Ajouter des commandes d'exemple
        </button>
        <button
          className="btn btn-outline btn-danger"
          onClick={() => {
            resetDemo();
            location.reload();
          }}
        >
          Tout effacer
        </button>
        <button
          className="btn btn-outline"
          onClick={() => {
            void auth.signOut();
            location.hash = '';
          }}
        >
          Changer d'écran
        </button>
      </div>
      {done && <p className="muted">{done}</p>}
    </div>
  );
}
