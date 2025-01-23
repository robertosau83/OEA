/* @refresh reload */
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';

import './index.css';
import { supabase } from './lib/supabaseClient.js';
import Auth from './components/Auth.jsx';
import App from './App.jsx';

const root = document.getElementById('root');

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/serviceWorker.js")
    .then(() => {
      console.log("Service Worker registrato con successo.");
    })
    .catch((error) => {
      console.error("Errore nella registrazione del Service Worker:", error);
    });
}

const Main = () => {
  const [session, setSession] = createSignal(null);

  // Gestione dello stato di autenticazione
  supabase.auth.getSession().then(({ data }) => {
    setSession(data.session);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Errore durante il logout:", error.message);
    }
    setSession(null); // Resetta lo stato della sessione
  };

  return (
    <div>
      {session() ? <App onLogout={handleLogout} /> : <Auth setSession={setSession} />}
    </div>
  );
};

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  );
}

render(() => <Main />, root);
