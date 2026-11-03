import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createBackend } from './data';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

createBackend()
  .then(({ store, auth }) =>
    root.render(
      <StrictMode>
        <App store={store} auth={auth} />
      </StrictMode>,
    ),
  )
  .catch((err) => {
    console.error(err);
    root.render(
      <div className="splash">
        Impossible de démarrer l'application. Vérifiez la connexion internet puis rechargez la page.
      </div>,
    );
  });
