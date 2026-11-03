import { useState } from 'react';
import type { AuthApi, Store } from '../data/store';
import type { Role } from '../domain/types';
import { navigate } from '../hooks/useHashRoute';
import { DemoTools } from './DemoTools';

const ROLE_LABEL: Record<Role, string> = { service: 'Tablette Service (comptoir)', cuisine: 'Tablette Cuisine (pizzaiolo)' };

export function Login({ auth, store }: { auth: AuthApi; store: Store }) {
  const demo = store.kind === 'demo';
  const [role, setRole] = useState<Role | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const choose = (r: Role) => {
    if (demo) {
      navigate(r);
      void auth.signIn(r, '');
    } else {
      setRole(r);
      setError('');
    }
  };

  const submit = async () => {
    if (!role) return;
    setBusy(true);
    setError('');
    try {
      await auth.signIn(role, password);
      navigate(role);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code.includes('network')
          ? "Pas de connexion internet. Vérifiez le Wi-Fi puis réessayez."
          : 'Mot de passe incorrect.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-box">
        <h1>
          <span aria-hidden>🍕</span> Kiosque à Pizzas
          <small>Frouzins</small>
        </h1>
        <p className="muted">Quelle est cette tablette ?</p>
        <div className="login-roles">
          {(['service', 'cuisine'] as Role[]).map((r) => (
            <button
              key={r}
              className={`btn btn-xl ${role === r ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => choose(r)}
              data-testid={`login-${r}`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        {role && !demo && (
          <form
            className="login-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <input
              className="input-lg"
              type="password"
              placeholder="Mot de passe"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn btn-primary btn-xl" disabled={busy || !password}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
            {error && <p className="form-error">{error}</p>}
            <p className="muted small">La tablette reste connectée ensuite, même après redémarrage.</p>
          </form>
        )}

        {demo && (
          <div className="login-demo">
            <DemoTools store={store} auth={auth} />
          </div>
        )}
      </div>
    </div>
  );
}
