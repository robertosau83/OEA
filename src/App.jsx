import { createSignal, createEffect } from 'solid-js';
import { supabase } from './lib/supabaseClient.js';
import { loadIncassi } from './lib/loadFromDB.js'; // Importa la funzione di caricamento
import Auth from './components/Auth.jsx';
import Incassi from './components/Incassi.jsx';
import Spese from './components/Spese.jsx';
import Trasf from './components/Trasf.jsx';
import Fornitori from './components/Fornitori.jsx';

const App = () => {
  const [session, setSession] = createSignal(null);
  const [currentBtmBarComponent, setCurrentBtmBarComponent] = createSignal(() => <Incassi incassi={[]} />);
  const [currentBtmBarComponentName, setCurrentBtmBarComponentName] = createSignal("Incassi");

  const [incassi, setIncassi] = createSignal([]);

  const loadInitialData = async () => {
    const { data, error } = await supabase.from('incassi').select('*');
  
    if (error) {
      console.error('Errore durante il caricamento dei dati:', error.message);
    } else {
      setIncassi(data || []); // Salva i dati nel formato JavaScript
      console.log('Dati caricati:', data);
    }
  };

  createEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session); // Aggiorna lo stato della sessione
      if (session) {
        loadInitialData(); // Carica i dati dopo l'autenticazione
      }
    });

    return () => {
      authListener.subscription.unsubscribe(); // Disiscriviti quando il componente viene smontato
    };
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Errore durante il logout:', error.message);
    }
    setSession(null); // Resetta lo stato della sessione
  };

  return (
    <div class="flex flex-col h-screen">
      {session() ? (
        <>
          {/* Top Bar */}
          <div class="bg-blue-500 text-white flex justify-between items-center px-4 py-2">
            <h1 class="text-xl">{currentBtmBarComponentName()}</h1>
            <button
              onClick={handleLogout}
              class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>

          {/* Main Content */}
          <div class="flex-grow bg-gray-100">
            {currentBtmBarComponent()({ incassi: incassi() })}
          </div>

          {/* Bottom Bar */}
          <div class="bg-white border-t flex">

            <button
              onClick={() => { setCurrentBtmBarComponent(() => (props) => <Incassi {...props} />); setCurrentBtmBarComponentName("Incassi"); }}
              class={`flex-1 py-4 text-center hover:bg-gray-200 ${currentBtmBarComponentName() === "Incassi" ? 'bg-gray-200' : ''}`}
            >
              <img src="/incassi.svg" alt="Incassi" class="h-6 mx-auto mb-1" />
              Incassi
            </button>

            <button
              onClick={() => { setCurrentBtmBarComponent(() => Spese); setCurrentBtmBarComponentName("Spese"); }}
              class={`flex-1 py-4 text-center hover:bg-gray-200 ${currentBtmBarComponentName() === "Spese" ? 'bg-gray-200' : ''}`}
            >
              <img src="/spese.svg" alt="Spese" class="h-6 mx-auto mb-1" />
              Spese
            </button>

            <button
              onClick={() => { setCurrentBtmBarComponent(() => Trasf); setCurrentBtmBarComponentName("Trasf"); }}
              class={`flex-1 py-4 text-center hover:bg-gray-200 ${currentBtmBarComponentName() === "Trasf" ? 'bg-gray-200' : ''}`}
            >
              <img src="/trasf.svg" alt="Trasf" class="h-6 mx-auto mb-1" />
              Trasf
            </button>

            <button
              onClick={() => { setCurrentBtmBarComponent(() => Fornitori); setCurrentBtmBarComponentName("Fornitori"); }}
              class={`flex-1 py-4 text-center hover:bg-gray-200 ${currentBtmBarComponentName() === "Fornitori" ? 'bg-gray-200' : ''}`}
            >
              <img src="/fornitori.svg" alt="Fornitori" class="h-6 mx-auto mb-1" />
              Fornitori
            </button>

          </div>

        </>
      ) : (
        <Auth />
      )}
    </div>
  );
};

export default App;
