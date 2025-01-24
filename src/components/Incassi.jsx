import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Incassi = ({ incassi, setIncassi, spese, setSpese }) => {
  const [aggrData, setAggrData] = createSignal([]); // Stato locale per gli incassi + spese serata
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
  const [showDeletePopup, setShowDeletePopup] = createSignal(false);
  const [showEditPopup, setShowEditPopup] = createSignal(false);
  const [editIncasso, setEditIncasso] = createSignal({
    battuti_cassa: 0,
    carte: 0,
    satispay: 0,
    contanti_cassa: 0,
  });
  const [selectedTag, setSelectedTag] = createSignal(''); // Stato per il tag selezionato

  const tagMap = {
    contanti: 'contanti_cassa_lordo_spese',
    carte: 'carte',
    satispay: 'satispay',
    battuti: 'battuti_cassa',
    gap: 'NB',
  };

  // Funzione per comporre aggrData come stato locale di incassi + spese serata
  const aggregateIncassiWithSpese = async () => {
    try {
      // Raggruppa le spese per data_di_competenza e somma gli importi con filtro
      const speseGrouped = spese().reduce((acc, spesa) => {
        if (spesa.metodo_di_pagamento === "Presi dalla cassa in serata") {
          const date = spesa.data_competenza;
          if (!acc[date]) {
            acc[date] = 0;
          }
          acc[date] += spesa.importo || 0;
        }
        return acc;
      }, {});

      // Aggiungi il campo "NB" e "spese_serata" agli incassi
      const updatedIncassi = (incassi() || []).map((entry) => {
        const speseSerata = speseGrouped[entry.data_competenza] || 0;
        return {
          ...entry,
          spese_serata: speseSerata,
          contanti_cassa_lordo_spese: (entry.contanti_cassa || 0) + speseSerata, // Calcolo opzionale
          NB:
            (entry.carte || 0) +
            (entry.satispay || 0) +
            (entry.contanti_cassa || 0) +
            (speseSerata || 0) -
            (entry.battuti_cassa || 0),
        };
      });

      // Aggiorna lo stato locale con i dati elaborati
      setAggrData(updatedIncassi);
      //console.log(aggrData());
    } catch (error) {
      console.error('Errore durante il caricamento dei dati:', error.message);
      setAggrData([]); // In caso di errore, imposta un array vuoto
    }
  };

  // Esegui la fetch dei dati quando il componente viene montato
  onMount(() => {
    aggregateIncassiWithSpese();
  });

  // Raggruppa gli incassi per mese e calcola la somma totale
  const groupByMonth = () => {
    const grouped = {};

    aggrData().forEach((entry) => {
      const date = new Date(entry.data_competenza);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!grouped[monthKey]) grouped[monthKey] = 0;

      const tag = selectedTag();
      if (tag && tagMap[tag]) {
        grouped[monthKey] += entry[tagMap[tag]] || 0;
      } else {
        grouped[monthKey] +=
          (entry.carte || 0) + (entry.satispay || 0) + (entry.contanti_cassa_lordo_spese || 0);
      }
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([key, total]) => {
        const [year, month] = key.split('-');
        const formattedMonth = new Date(year, month - 1).toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });
        return [formattedMonth, total];
      });
  };

  // Filtra gli incassi per giorno per il mese selezionato
  const filterByDay = () => {
    return aggrData()
      .filter((entry) => {
        const month = new Date(entry.data_competenza).toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });
        return month === selectedMonth();
      })
      .map((entry) => {
        const tag = selectedTag();
        if (tag && tagMap[tag]) {
          return { ...entry, total: entry[tagMap[tag]] || 0 };
        }
        const total =
          (entry.carte || 0) + (entry.satispay || 0) + (entry.contanti_cassa_lordo_spese || 0);
        return { ...entry, total };
      })
      .sort((a, b) => new Date(a.data_competenza) - new Date(b.data_competenza));
  };

  // Dettagli di un singolo giorno
  const getDailyDetails = () => {
    return aggrData().find((entry) => entry.data_competenza === selectedDay());
  };

  const addNewIncasso = async () => {

    // Controlla se esiste già un incasso con la stessa data di competenza
    const existing = aggrData().find(
      (entry) => entry.data_competenza === newIncasso().data_competenza
    );

    if (existing) {
      // Mostra un messaggio di errore
      alert(
        `Non è possibile inserire un incasso per la data di competenza ${new Date(
          newIncasso().data_competenza
        ).toLocaleDateString('it-IT')}. Esiste già un incasso per questa data.`
      );
      return;
    }

    const { data, error } = await supabase
      .from('incassi')
      .insert([newIncasso()], { returning: 'representation' })
      .select('*'); // Recupera i dati appena inseriti

    if (error) {
      console.error("Errore durante l'inserimento:", error.message);
    } else {
      console.log('Incasso aggiunto con successo:', data);
      setIncassi((prev) => [...prev, ...(data || [])]); // Aggiungi i nuovi dati allo stato locale Incassi
      await aggregateIncassiWithSpese();
      setShowPopup(false); // Chiudi il popup
    }
  };

  // Calcola il totale di tutti gli incassi nella view day
  const calculateTotalByTag = (entries) => {
    const tag = selectedTag();
    return entries.reduce((sum, entry) => {
      if (tag && tagMap[tag]) {
        return sum + (entry[tagMap[tag]] || 0);
      }
      return sum +
        (entry.carte || 0) +
        (entry.satispay || 0) +
        (entry.contanti_cassa_lordo_spese || 0);
    }, 0);
  };

  //Elimina un incasso giornaliero dal db
  const deleteIncasso = async () => {
    const selectedIncasso = getDailyDetails(); // Ottieni l'incasso selezionato
    if (!selectedIncasso) return;

    const { error } = await supabase
      .from('incassi')
      .delete()
      .eq('data_competenza', selectedIncasso.data_competenza); // Elimina l'incasso dal database

    if (error) {
      console.error("Errore durante la cancellazione dell'incasso:", error.message);
    } else {
      console.log('Incasso cancellato con successo');
      // Aggiorna lo stato locale rimuovendo l'incasso cancellato
      setIncassi((prev) =>
        prev.filter((entry) => entry.data_competenza !== selectedIncasso.data_competenza)
      );
      await aggregateIncassiWithSpese();
      setShowDeletePopup(false); // Chiudi il popup di conferma
      setView('day'); // Torna alla view "day"
    }
  };

  //Apre il popup per l'edit di un incasso
  const openEditPopup = () => {
    const selectedIncasso = getDailyDetails();
    if (!selectedIncasso) return;

    setEditIncasso({
      battuti_cassa: selectedIncasso.battuti_cassa,
      carte: selectedIncasso.carte,
      satispay: selectedIncasso.satispay,
      contanti_cassa: selectedIncasso.contanti_cassa,
    });
    setShowEditPopup(true);
  };

  //Gestisce il vero e proprio update di un Incasso esistente
  const updateIncasso = async () => {
    const selectedIncasso = getDailyDetails();
    if (!selectedIncasso) return;

    const { error } = await supabase
      .from('incassi')
      .update(editIncasso())
      .eq('data_competenza', selectedIncasso.data_competenza);

    if (error) {
      console.error("Errore durante l'aggiornamento dell'incasso:", error.message);
    } else {
      console.log('Incasso aggiornato con successo');
      //Aggiorna lo stato locale
      setIncassi((prev) =>
        prev.map((entry) =>
          entry.data_competenza === selectedIncasso.data_competenza
            ? { ...entry, ...editIncasso() }
            : entry
        )
      );
      await aggregateIncassiWithSpese();
      setShowEditPopup(false); // Chiudi il popup
    }
  };

  return (
    <div class="w-full h-full p-2">

      {/* View degli incassi per mese */}
      {view() === 'month' && (
        <div>
          <h2 class="flex items-center justify-center h-[55px] text-lg font-semibold mb-2">Incassi mensili</h2>

          {/* tags */}
          <div class="flex justify-center gap-1 mb-4 h-[32px]">
            {['contanti', 'carte', 'satispay', 'battuti', 'gap'].map((tag) => (
              <button
                key={tag}
                class={`text-xs px-4 py-2 rounded-full shadow-md ${selectedTag() === tag
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700'
                  }`}
                onClick={() => setSelectedTag(selectedTag() === tag ? '' : tag)} // Single-select toggle
              >
                {tag}
              </button>
            ))}
          </div>

          <ul class="overflow-y-auto h-[calc(100vh-268px)]">
            {groupByMonth().map(([month, total]) => (
              <li
                class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setSelectedMonth(month);
                  setView('day');
                }}
              >
                <div class="flex justify-between">
                  <span class="">{month}</span>
                  <span class="text-green-600">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(total))} €
                  </span>
                </div>
              </li>
            ))}

            {/* Totale complessivo di tutti i mesi */}
            <li class="py-2 px-4 bg-gray-100 font-semibold">
              <div class="flex justify-end">
                <span class="text-green-800 font-bold">
                  {new Intl.NumberFormat('it-IT', {
                    style: 'decimal',
                    maximumFractionDigits: 0,
                  }).format(
                    groupByMonth().reduce((sum, [, total]) => sum + total, 0)
                  )} €
                </span>
              </div>
            </li>
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

          {/* tags */}
          <div class="flex justify-center gap-1 mb-4 h-[32px]">
            {['contanti', 'carte', 'satispay', 'battuti', 'gap'].map((tag) => (
              <button
                key={tag}
                class={`text-xs px-4 py-2 rounded-full shadow-md ${selectedTag() === tag
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700'
                  }`}
                onClick={() => setSelectedTag(selectedTag() === tag ? '' : tag)} // Single-select toggle
              >
                {tag}
              </button>
            ))}
          </div>

          <ul class="overflow-y-auto h-[calc(100vh-268px)] pb-40">
            {filterByDay().map((entry) => (
              <li
                class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setSelectedDay(entry.data_competenza);
                  setView('detail');
                }}
              >
                <div class="flex justify-between">
                  <span class="">{new Date(entry.data_competenza).toLocaleDateString()}</span>
                  <span class="text-green-600">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(entry.total))}{' '}
                    €
                  </span>
                </div>
              </li>
            ))}

            {/* Totale complessivo del mese selezionato */}
            <li class="py-2 px-4 bg-gray-100 font-semibold">
              <div class="flex justify-end">
                {/* <span>Totale giornaliero</span> */}
                <span class="text-green-800 font-bold">
                  {new Intl.NumberFormat('it-IT', {
                    style: 'decimal',
                    maximumFractionDigits: 0,
                  }).format(calculateTotalByTag(filterByDay()))} €
                </span>
              </div>
            </li>
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
          <div class="overflow-y-auto h-[calc(100vh-220px)] pt-2">
            {getDailyDetails() && (
              <div>
                {/* Battuti cassa */}
                <div class="flex text-sm justify-between py-1 px-4 border-b bg-gray-100">
                  <span class="">Battuti cassa</span>
                  <span class="text-green-600">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(getDailyDetails()?.battuti_cassa || 0))} €
                  </span>
                </div>

                {/* Contanti in cassa (netto spese) */}
                <div class="flex text-sm justify-between py-1 px-4 border-b">
                  <span>Contanti in cassa (netto spese)</span>
                  <span class="text-green-600">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(getDailyDetails()?.contanti_cassa || 0))} €
                  </span>
                </div>

                {/* Spese serata */}
                <div class="flex text-sm text-red-500 justify-between py-1 px-4 border-b bg-yellow-50">
                  <span>Spese serata</span>
                  <span class="text-red-500">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(getDailyDetails()?.spese_serata || 0))} €
                  </span>
                </div>

                {/* Contanti in cassa (lordo spese) */}
                <div class="flex justify-between py-1 px-4 border-b">
                  <span class="">Contanti in cassa (lordo spese)</span>
                  <span class="text-green-600 font-semibold">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(getDailyDetails()?.contanti_cassa_lordo_spese || 0))} €
                  </span>
                </div>

                {/* Carte */}
                <div class="flex justify-between py-1 px-4 border-b">
                  <span>Carte</span>
                  <span class="text-green-600 font-semibold">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(getDailyDetails()?.carte || 0))} €
                  </span>
                </div>

                {/* Satispay */}
                <div class="flex justify-between py-1 px-4 border-b">
                  <span class="">Satispay</span>
                  <span class="text-green-600 font-semibold">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(getDailyDetails()?.satispay || 0))} €
                  </span>
                </div>

                {/* Totale Incasso reale giornaliero */}
                <div class="flex justify-between py-2 px-4">
                  <span class=""></span>
                  <span class="text-green-800 font-bold">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round((getDailyDetails()?.contanti_cassa_lordo_spese || 0) + (getDailyDetails()?.carte || 0) + (getDailyDetails()?.satispay || 0)))} €
                  </span>
                </div>

                {/* NB */}
                <div class="flex text-sm justify-between py-1 px-4 border-b">
                  <span class="">Gap</span>
                  <span class="text-green-600">
                    {new Intl.NumberFormat('it-IT', {
                      style: 'decimal',
                      maximumFractionDigits: 0,
                    }).format(Math.round(getDailyDetails()?.NB || 0))} €
                  </span>
                </div>

              </div>
            )}

            <div class="flex justify-around mt-6">
              <button
                onClick={() => setShowDeletePopup(true)}
                class="px-4 py-2 w-32 bg-red-500 text-white rounded-lg shadow-lg shadow-gray-400 hover:bg-red-600"
              >
                Cancella
              </button>
              <button
                onClick={openEditPopup}
                class="px-4 py-2 w-32 bg-yellow-500 text-white rounded-lg shadow-lg shadow-gray-400 hover:bg-yellow-600"
              >
                Modifica
              </button>
            </div>
          </div>

          {/* popup di conferma cancellazione incasso */}
          {showDeletePopup() && (
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div class="bg-red-100 rounded-lg p-6 w-[90%] relative">
                <button
                  onClick={() => setShowDeletePopup(false)}
                  class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                >
                  <img src="/cancel-black.svg" alt="cancel" class="w-7 h-auto" />
                </button>
                <h2 class="text-lg font-semibold mt-4 mb-4 text-center">
                  Verrà cancellato l'incasso registrato in data{' '}
                  {new Date(selectedDay()).toLocaleDateString('it-IT')}
                </h2>
                <div class="flex justify-center gap-4 mt-6">

                  <button
                    onClick={deleteIncasso}
                    class="px-4 py-2 w-full bg-red-500 text-white font-bold rounded hover:bg-red-600"
                  >
                    CONFERMA
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* popup di modifica di un incasso */}
          {showEditPopup() && (
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div class="bg-yellow-100 rounded-lg p-6 w-[90%] relative">
                <button
                  onClick={() => setShowEditPopup(false)}
                  class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                >
                  <img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
                </button>

                <h2 class="text-lg font-bold mb-4 text-center">Modifica Incasso</h2>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await updateIncasso();
                  }}
                >
                  <div class="mb-4">
                    <label class="block text-sm font-medium mb-1">Data Competenza</label>
                    <input
                      type="date"
                      value={selectedDay()}
                      disabled
                      class="w-full border rounded px-3 py-2 bg-gray-200 cursor-not-allowed"
                    />
                  </div>

                  {[
                    { label: 'Battuti Cassa', key: 'battuti_cassa' },
                    { label: 'Carte', key: 'carte' },
                    { label: 'Satispay', key: 'satispay' },
                    { label: 'Contanti Cassa', key: 'contanti_cassa' },
                  ].map(({ label, key }) => (
                    <div class="mb-4" key={key}>
                      <label class="block text-sm font-medium mb-1">{label}</label>
                      <input
                        type="number"
                        value={editIncasso()[key]}
                        onInput={(e) =>
                          setEditIncasso({
                            ...editIncasso(),
                            [key]: +e.currentTarget.value || 0,
                          })
                        }
                        class="w-full border rounded px-3 py-2"
                      />
                    </div>
                  ))}

                  <div class="flex justify-center">
                    <button
                      type="submit"
                      class="w-full px-4 text-xl py-2 mt-4 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                      SALVA
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Bottone rotondo per aggiungere un nuovo incasso*/}
      {view() !== 'detail' && (
        <button
          onClick={() => setShowPopup(true)} // Mostra il popup
          class="fixed bottom-[98px] right-4 w-16 h-16 bg-green-500 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center hover:bg-green-600"
        >
          <img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
        </button>
      )}

      {/* Popup per aggiungere un nuovo incasso */}
      {showPopup() && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-[90%] relative">
            <button
              onClick={() => setShowPopup(false)}
              class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              <img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
            </button>

            <h2 class="text-lg font-bold mb-4 text-center">Nuovo Incasso Serale</h2>

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

              <div class="flex justify-center mt-8 w-full">
                <button
                  type="submit"
                  class="px-4 py-2 w-full text-xl bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  SALVA
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
