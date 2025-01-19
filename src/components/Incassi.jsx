import { createSignal } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Incassi = (props) => {
  const [view, setView] = createSignal('month'); // 'month' | 'day' | 'detail'
  const [selectedMonth, setSelectedMonth] = createSignal('');
  const [selectedDay, setSelectedDay] = createSignal('');
  const [showPopup, setShowPopup] = createSignal(false);
  const [newIncasso, setNewIncasso] = createSignal({
    data_competenza: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Oggi - 1 giorno
    battuti_cassa: 0,
    carte: 0,
    satispay: 0,
    contanti_cassa: 0,
  });

  // Raggruppa gli incassi per mese e calcola la somma totale
  const groupByMonth = () => {
    const grouped = {}; // Ogni chiave è un mese e il valore è la somma totale

    props.incassi.forEach((entry) => {
      const month = new Date(entry.data_competenza).toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      });

      if (!grouped[month]) {
        grouped[month] = 0; // Inizializza la somma per il mese
      }

      // Somma i campi 'carte', 'satispay' e 'battuti_cassa' per il mese
      grouped[month] += entry.carte + entry.satispay + entry.contanti_cassa;
    });

    // Ordina i mesi dalla più recente alla meno recente
    return Object.entries(grouped).sort(([monthA], [monthB]) => {
      const dateA = new Date(monthA);
      const dateB = new Date(monthB);
      return dateB.getTime() - dateA.getTime();
    });
  };

  // Filtra gli incassi per giorno per il mese selezionato
  const filterByDay = () => {
    return props.incassi
      .filter((entry) => {
        const month = new Date(entry.data_competenza).toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });
        return month === selectedMonth();
      })
      .sort((a, b) => {
        const dateA = new Date(a.data_competenza);
        const dateB = new Date(b.data_competenza);
        return dateA.getTime() - dateB.getTime(); // Ordine dal meno recente al più recente
      });
  };

  // Dettagli di un singolo giorno
  const getDailyDetails = () => {
    return props.incassi.find((entry) => entry.data_competenza === selectedDay());
  };

  const addNewIncasso = async () => {
    const { data, error } = await supabase.from('incassi').insert([newIncasso()]);
    if (error) {
      console.error("Errore durante l'inserimento:", error.message);
    } else {
      console.log('Incasso aggiunto con successo:', data);
      setShowPopup(false); // Chiudi il popup
    }
  };

  return (
    <div class="w-full h-full p-2">
      {/* View degli incassi per mese */}
      {view() === 'month' && (
        <div>
          <h2 class="flex items-center justify-center h-[55px] text-lg font-semibold mb-2">Incassi mensili</h2>
          <ul class="overflow-y-auto h-[calc(100vh-220px)]">
            {groupByMonth().map(([month, total]) => (
              <li
                class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setSelectedMonth(month);
                  setView('day');
                }}
              >
                <div class="flex justify-between">
                  <span class="font-semibold">{month}</span>
                  <span class="text-green-600 font-bold">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(total))} €
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* View degli incassi giornalieri */}
      {view() === 'day' && (
        <div>
          <div class="flex justify-between h-[55px] mb-2">
            <button class="w-[40px] bg-gray-100 font-bold text-black rounded" onClick={() => setView('month')}>
              <img src="/back.svg" alt="back" class="w-full h-auto" />
            </button>
            <div>
              <div class="text-lg text-center font-semibold">Incassi giornalieri</div>
              <div class="text-center">{selectedMonth()}</div>
            </div>
            <div class="w-[40px]"></div>
          </div>
          <ul class="overflow-y-auto h-[calc(100vh-220px)] pb-40">
            {filterByDay().map((entry) => (
              <li
                class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setSelectedDay(entry.data_competenza);
                  setView('detail');
                }}
              >
                <div class="flex justify-between">
                  <span class="font-semibold">{new Date(entry.data_competenza).toLocaleDateString()}</span>
                  <span class="text-green-600 font-bold">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(entry.carte + entry.satispay + entry.contanti_cassa))} €
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* View di dettaglio per un giorno */}
      {view() === 'detail' && (
        <div>
          <div class="flex justify-between h-[55px] mb-2">
            <button class="w-[40px] bg-gray-100 font-bold text-black rounded" onClick={() => setView('day')}>
              <img src="/back.svg" alt="back" class="w-full h-auto" />
            </button>
            <div>
              <div class="text-lg text-center font-semibold">Dettaglio incassi</div>
              <div class="text-center">{new Date(selectedDay()).toLocaleDateString()}</div>
            </div>
            <div class="w-[40px]"></div>
          </div>
          <div class="overflow-y-auto h-[calc(100vh-220px)]">
            {getDailyDetails() && (
              <div>
                {[
                  { label: 'Battuti cassa', value: getDailyDetails()?.battuti_cassa },
                  { label: 'Carte', value: getDailyDetails()?.carte },
                  { label: 'Satispay', value: getDailyDetails()?.satispay },
                  { label: 'Contanti in cassa', value: getDailyDetails()?.contanti_cassa },
                ].map(({ label, value }) => (
                  <div class="flex justify-between py-2 px-4 border-b">
                    <span class="font-semibold">{label}:</span>
                    <span class="text-green-600 font-bold">
                      {new Intl.NumberFormat('it-IT', {
                        style: 'decimal',
                        maximumFractionDigits: 0,
                      }).format(Math.round(value || 0))} €
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottone rotondo */}
      <button
        onClick={() => setShowPopup(true)} // Mostra il popup
        class="fixed bottom-[98px] right-4 w-16 h-16 bg-blue-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-600"
      >
        <span class="text-2xl font-bold">+</span>
      </button>

      {/* Popup per aggiungere un nuovo incasso */}
      {showPopup() && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-96 relative">
            <button
              onClick={() => setShowPopup(false)}
              class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              &times;
            </button>

            <h2 class="text-lg font-bold mb-4 text-center">Aggiungi Incasso</h2>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await addNewIncasso();
              }}
            >
              {[
                { label: 'Data Competenza', type: 'date', key: 'data_competenza' },
                { label: 'Battuti Cassa', type: 'number', key: 'battuti_cassa' },
                { label: 'Carte', type: 'number', key: 'carte' },
                { label: 'Satispay', type: 'number', key: 'satispay' },
                { label: 'Contanti Cassa', type: 'number', key: 'contanti_cassa' },
              ].map(({ label, type, key }) => (
                <div class="mb-4" key={key}>
                  <label class="block text-sm font-medium mb-1">{label}</label>
                  <input
                    type={type}
                    value={newIncasso()[key] || ''}
                    onInput={(e) =>
                      setNewIncasso({
                        ...newIncasso(),
                        [key]: type === 'number' ? +e.currentTarget.value || 0 : e.currentTarget.value,
                      })
                    }
                    class="w-full border rounded px-3 py-2"
                  />
                </div>
              ))}

              <div class="flex justify-center">
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Incassi;
