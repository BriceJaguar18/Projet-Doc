import { useEffect, useState } from 'react';
import { KioskProvider } from './KioskContext';
import type { AuthApi, Store } from './data/store';
import type { Role } from './domain/types';
import { useHashRoute } from './hooks/useHashRoute';
import { Login } from './screens/Login';
import { KitchenScreen } from './screens/cuisine/KitchenScreen';
import { SettingsScreen } from './screens/reglages/SettingsScreen';
import { ServiceScreen } from './screens/service/ServiceScreen';
import { SalesScreen } from './screens/ventes/SalesScreen';

export function App({ store, auth }: { store: Store; auth: AuthApi }) {
  const [role, setRole] = useState<Role | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const route = useHashRoute();

  useEffect(
    () =>
      auth.subscribe((r, ready) => {
        setRole(r);
        setAuthReady(ready);
      }),
    [auth],
  );

  // Mode démo : l'adresse #/service ou #/cuisine ouvre directement l'écran voulu.
  useEffect(() => {
    if (store.kind === 'demo' && (route === 'service' || route === 'cuisine') && role !== route) {
      void auth.signIn(route, '');
    }
  }, [store.kind, route, role, auth]);

  if (!authReady) return <div className="splash">Chargement…</div>;
  if (!role) return <Login auth={auth} store={store} />;

  return (
    <KioskProvider store={store} auth={auth} role={role}>
      {role === 'cuisine' ? (
        <KitchenScreen />
      ) : route === 'reglages' ? (
        <SettingsScreen />
      ) : route === 'ventes' ? (
        <SalesScreen />
      ) : (
        <ServiceScreen />
      )}
    </KioskProvider>
  );
}
