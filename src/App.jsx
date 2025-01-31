import { createSignal, onMount } from 'solid-js';
import { supabase } from './lib/supabaseClient.js';
import Incassi from './components/Incassi.jsx';
import Spese from './components/Spese.jsx';
import MovCC from './components/MovCC.jsx';
import Fornitori from './components/Fornitori.jsx';

const App = ({ onLogout }) => {
  const [currentBtmBarComponentName, setCurrentBtmBarComponentName] = createSignal("MovCC");
  const [isLoading, setIsLoading] = createSignal(true);
  const [incassi, setIncassi] = createSignal([]);
  const [spese, setSpese] = createSignal([]);
  const [movCC, setMovCC] = createSignal([]);

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

      // Fetch spese dalla tabella spese
      const { data: speseData, error: speseError } = await supabase
        .from('spese')
        .select('*');
      if (speseError) throw speseError;

      // Fetch movimenti con importo < 0 dalla tabella CC
      const { data: ccData, error: ccError } = await supabase
        .from('CC')
        .select('*')
        .lte('importo', 0); // Filtra solo importi negativi

      if (ccError) throw ccError;

      // Trasforma i dati di CC per adattarli alla struttura di spese
      const transformedCCData = ccData.map(row => ({
        id: row.id,
        origin: "CC", // Imposta l'origine come "CC"
        data_competenza: row.data_operazione, // Usa data_operazione come data_competenza
        tipo: row.tipo, // Mantiene il tipo
        importo: -row.importo, // Mantiene l'importo
        descrizione: row.descrizione, // Mantiene la descrizione
      }));

      // Unisci i dati di spese e CC
      const aggregatedSpeseData = [...speseData, ...transformedCCData];

      // Aggiorna lo stato locale spese
      setSpese(aggregatedSpeseData);

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
    spese,
    setSpese,
    movCC,
    setMovCC,
  };

  const renderMainContent = () => {
    if (currentBtmBarComponentName() === "Incassi") {
      return <Incassi {...sharedProps} />;
    }
    if (currentBtmBarComponentName() === "Spese") {
      return <Spese {...sharedProps} />;
    }
    if (currentBtmBarComponentName() === "MovCC") {
      return <MovCC {...sharedProps} />;
    }
    if (currentBtmBarComponentName() === "Fornitori") {
      return <Fornitori {...sharedProps} />;
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
          {/* Top Bar */}
          <div class="bg-blue-500 text-white flex justify-between items-center px-4 py-2">
            <h1 class="text-xl">{currentBtmBarComponentName()}</h1>
            <button
              onClick={onLogout}
              class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>

          {/* Main Content */}
          <div class="flex-grow bg-gray-100">
            {renderMainContent()}
          </div>

          {/* Bottom Bar */}
          <div class="bg-white border-t flex">
            <button
              onClick={() => setCurrentBtmBarComponentName("Incassi")}
              class={`flex-1 py-4 text-center ${currentBtmBarComponentName() === "Incassi" ? 'bg-gray-200' : ''
                }`}
            >
              <img src="/incassi.svg" alt="Incassi" class="h-6 mx-auto mb-1" />
              Incassi
            </button>
            <button
              onClick={() => setCurrentBtmBarComponentName("Spese")}
              class={`flex-1 py-4 text-center ${currentBtmBarComponentName() === "Spese" ? 'bg-gray-200' : ''
                }`}
            >
              <img src="/spese.svg" alt="Spese" class="h-6 mx-auto mb-1" />
              Spese
            </button>
            <button
              onClick={() => setCurrentBtmBarComponentName("MovCC")}
              class={`flex-1 py-4 text-center ${currentBtmBarComponentName() === "MovCC" ? 'bg-gray-200' : ''
                }`}
            >
              <img src="/trasf.svg" alt="MovCC" class="h-6 mx-auto mb-1" />
              MovCC
            </button>
            {/* <button
              onClick={() => setCurrentBtmBarComponentName("Fornitori")}
              class={`flex-1 py-4 text-center hover:bg-gray-200 ${
                currentBtmBarComponentName() === "Fornitori" ? 'bg-gray-200' : ''
              }`}
            >
              <img src="/fornitori.svg" alt="Fornitori" class="h-6 mx-auto mb-1" />
              Fornitori
            </button> */}
          </div>
        </>
      )}
    </div>
  );
};

export default App;
