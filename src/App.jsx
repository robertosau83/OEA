import { createSignal, onMount } from 'solid-js';
import { supabase } from './lib/supabaseClient.js';
import Chiusure from './components/Chiusure.jsx';
import Cashflow from './components/Cashflow.jsx';
import MovCC from './components/MovCC.jsx';
import Stats from './components/Stats.jsx';
import { cashflow, setCashflow, composeCashflow } from './lib/composeCashflow.js'; // Importa cashflow

const App = ({ onLogout }) => {
  const [currentBtmBarComponentName, setCurrentBtmBarComponentName] = createSignal("Chiusure");
  const [isLoading, setIsLoading] = createSignal(true);
  const [incassi, setIncassi] = createSignal([]);
  const [movCC, setMovCC] = createSignal([]);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);

  // Funzione per caricare i dati dal database
  const loadData = async () => {
    try {
      setIsLoading(true);

      // Fetch incassi
      const { data: incassiData, error: incassiError } = await supabase
        .from('incassi')
        .select('*');
      if (incassiError) throw incassiError;

      setIncassi(incassiData || []);

      const { data: movCCData, error: movCCError } = await supabase
        .from("CC")
        .select("id, prg, codice_identificativo, data_operazione, data_valuta, descrizione, importo, tipo")
        .order("prg", { ascending: false }); // Ordina per prg decrescente

      if (movCCError) throw movCCError;

      // Formatta le date nel formato "gg/mm/aaaa"
      const formattedMovCCData = movCCData.map((row) => ({
        ...row,
        data_operazione: formatDate(row.data_operazione),
        data_valuta: formatDate(row.data_valuta),
      }));

      // Imposta i dati nello stato locale
      setMovCC(formattedMovCCData);
      //console.log(movCC());

      // Carica cashflow
      await composeCashflow();

      console.log(cashflow());

    } catch (error) {
      console.error("Errore nel caricamento dei dati:", error.message);
    } finally {
      setIsLoading(false); // Fine del caricamento
    }
  };

  // Esegui il caricamento dei dati quando il componente viene montato
  onMount(async () => {
    await loadData();
  });

  // Funzione per formattare le date
  const formatDate = (date) => {
    if (!date) return "";
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  };

  const sharedProps = {
    incassi,
    setIncassi,
    movCC,
    setMovCC,
    cashflow,
    setCashflow,
  };

  const renderMainContent = () => {
    if (currentBtmBarComponentName() === "Chiusure") {
      return <Chiusure {...sharedProps} />;
    }
    if (currentBtmBarComponentName() === "Stats") {
      return <Stats {...sharedProps} />;
    }
    if (currentBtmBarComponentName() === "Cashflow") {
      return <Cashflow {...sharedProps} />;
    }
    if (currentBtmBarComponentName() === "MovCC") {
      return <MovCC {...sharedProps} />;
    }
    return null; // In caso di valore non gestito
  };

  return (
    <div class="flex flex-col h-screen">
      {isLoading() ? (
        // Pagina di caricamento
        <div class="flex items-center justify-center h-full">
          <p class="text-lg font-semibold">Caricamento dati in corso...</p>
        </div>
      ) : (
        <>
          {/* Overlay per chiudere il menù cliccando fuori */}
          {isMenuOpen() && (
            <div
              class="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setIsMenuOpen(false)}
            ></div>
          )}

          {/* Sidebar Menù */}
          <div
            class={`fixed top-0 left-0 w-64 h-full bg-white shadow-md z-50 transform ${isMenuOpen() ? "translate-x-0" : "-translate-x-full"
              } transition-transform duration-300 ease-in-out`}
          >
            <div class="p-4">
              <h2 class="text-lg font-semibold mb-4">Menù</h2>
              <button
                class="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100"
                onClick={() => {
                  setCurrentBtmBarComponentName("MovCC");
                  setIsMenuOpen(false);
                }}
              >
                CC
              </button>
              <button
                class="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100"
                onClick={onLogout}
              >
                Logout
              </button>
            </div>
          </div>

          {/* Top Bar */}
          <div class="bg-blue-500 text-white flex justify-between items-center min-h-[56px]">
            <button onClick={() => setIsMenuOpen(true)} class="pl-3">
              <img src="/menu.svg" alt="Menu" class="h-10 mx-auto" />
            </button>
          </div>

          {/* Main Content */}
          <div class="flex-grow bg-gray-100">
            {renderMainContent()}
          </div>

          {/* Bottom Bar */}
          <div class="flex bg-white border-t h-[92px] min-h-[92px] max-h-[92px]">
            <button
              onClick={() => setCurrentBtmBarComponentName("Chiusure")}
              class={`flex-1 text-center ${currentBtmBarComponentName() === "Chiusure" ? 'bg-gray-200' : ''
                }`}
            >
              <img src="/cash-register.svg" alt="Chiusure" class="h-8 mx-auto mb-1" />
              Chiusure
            </button>
            {/* <button
              onClick={() => setCurrentBtmBarComponentName("Stats")}
              class={`flex-1 text-center hover:bg-gray-200 ${currentBtmBarComponentName() === "Stats" ? 'bg-gray-200' : ''
                }`}
            >
              <img src="/stats.svg" alt="Fornitori" class="h-8 mx-auto mb-1" />
              Stats
            </button> */}
            <button
              onClick={() => setCurrentBtmBarComponentName("Cashflow")}
              class={`flex-1 text-center ${currentBtmBarComponentName() === "Cashflow" ? 'bg-gray-200' : ''
                }`}
            >
              <img src="/cashflow.png" alt="Spese" class="h-8 mx-auto mb-1" />
              Cashflow
            </button>
            <button
              onClick={() => setCurrentBtmBarComponentName("MovCC")}
              class={`flex-1 text-center ${currentBtmBarComponentName() === "MovCC" ? 'bg-gray-200' : ''
                }`}
            >
              <img src="/bank-account.svg" alt="MovCC" class="h-8 mx-auto mb-1" />
              CC
            </button>

          </div>
        </>
      )}
    </div>
  );
};

export default App;
