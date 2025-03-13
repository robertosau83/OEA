import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Scadenze = ({ companyId, scadenze, setScadenze, isLandscape }) => {
  const [showAddPopup, setShowAddPopup] = createSignal(false);
  const [newScadenza, setNewScadenza] = createSignal({
    data_scadenza: new Date().toISOString().split('T')[0],
    data_ricevuta: new Date().toISOString().split('T')[0],
    nome: '',
    importo: '',
    status: 'NOT_PAYED',
    descrizione: '',
  });
  // Segnale per la direzione in fase di inserimento (default: 'entrata')
  const [newMovementDirection, setNewMovementDirection] = createSignal('entrata');

  const [showEditPopup, setShowEditPopup] = createSignal(false);
  const [editScadenza, setEditScadenza] = createSignal(null);
  // Segnale per la direzione in fase di modifica
  const [editMovementDirection, setEditMovementDirection] = createSignal('entrata');

  const togglePaymentStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'PAYED' ? 'NOT_PAYED' : 'PAYED';
    const { error } = await supabase
      .from('scadenze')
      .update({ status: newStatus })
      .eq('id', id);
    if (!error) {
      setScadenze(prevScadenze =>
        prevScadenze.map(f => (f.id === id ? { ...f, status: newStatus } : f))
      );
    }
  };

  const addNewScadenza = async () => {
    // Verifica che tutti i campi obbligatori siano compilati
    if (!newScadenza().data_scadenza || !newScadenza().data_ricevuta || !newScadenza().nome || !newScadenza().importo) {
      alert("Tutti i campi sono obbligatori tranne 'Rif Fattura'.");
      return;
    }

    const sanitizedImporto = newScadenza().importo.replace(',', '.');
    let numericImporto = parseFloat(sanitizedImporto);
    if (isNaN(numericImporto)) {
      alert("Inserisci un importo valido.");
      return;
    }

    // Imposta il segno in base alla direzione selezionata
    if (newMovementDirection() === 'uscita') {
      numericImporto = -Math.abs(numericImporto);
    } else {
      numericImporto = Math.abs(numericImporto);
    }

    const newEntry = {
      ...newScadenza(),
      importo: numericImporto,
      descrizione: newScadenza().descrizione,
      data_ricevuta: newScadenza().data_ricevuta,
      company_id: companyId,
    };

    const { data, error } = await supabase
      .from('scadenze')
      .insert([newEntry])
      .select('*');

    if (!error) {
      setScadenze(prev => [...prev, ...data]);
      setShowAddPopup(false);
    }
  };

  const updateScadenza = async () => {
    if (!editScadenza().data_scadenza || !editScadenza().data_ricevuta || !editScadenza().nome || !editScadenza().importo) {
      alert("Tutti i campi sono obbligatori tranne 'Rif Fattura'.");
      return;
    }

    const sanitizedImporto = editScadenza().importo.replace(',', '.');
    let numericImporto = parseFloat(sanitizedImporto);
    if (isNaN(numericImporto)) {
      alert("Inserisci un importo valido.");
      return;
    }

    // Imposta il segno in base alla direzione selezionata in modifica
    if (editMovementDirection() === 'uscita') {
      numericImporto = -Math.abs(numericImporto);
    } else {
      numericImporto = Math.abs(numericImporto);
    }

    const updatedEntry = {
      ...editScadenza(),
      importo: numericImporto,
    };

    const { error } = await supabase
      .from('scadenze')
      .update(updatedEntry)
      .eq('id', editScadenza().id);

    if (!error) {
      setScadenze(prev =>
        prev.map(f => (f.id === editScadenza().id ? updatedEntry : f))
      );
      setShowEditPopup(false);
    }
  };

  const deleteScadenza = async (id) => {
    const confirmDelete = confirm("Sei sicuro di voler eliminare questa Scadenza?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('scadenze')
      .delete()
      .eq('id', id);

    if (!error) {
      setScadenze(prevScadenze => prevScadenze.filter(f => f.id !== id));
    } else {
      alert("Errore durante la cancellazione. Riprova.");
    }
  };

  return (
    <div class={`flex flex-col h-full px-2 pt-2 ${isLandscape() ? "text-xl" : "text-xs"}`}>
      <div class="flex flex-none text-gray-600 w-full h-[30px] items-center justify-center text-lg mb-2 font-semibold">
        Scadenze
      </div>
      <div class="flex flex-none w-full h-[30px] border-b items-center font-semibold">
        <div class="text-center w-[20%]">Scadenza</div>
        <div class="text-center w-[35%]">Nome</div>
        <div class="text-center w-[20%]">Importo</div>
        <div class="text-center w-[15%]">Pagato</div>
        <div class="text-center w-[10%]"></div>
      </div>
      <div class="flex-grow overflow-y-auto pb-40">
        {scadenze()
          .sort((a, b) => new Date(a.data_scadenza) - new Date(b.data_scadenza))
          .map(f => (
            <div
              key={f.id}
              class="flex items-center border-b py-2 cursor-pointer hover:bg-gray-100"
              onClick={() => {
                // Quando si clicca per modificare, imposta anche la direzione in base al segno
                setEditScadenza({
                  ...f,
                  importo: Math.abs(f.importo).toString().replace('.', ','),
                });
                setEditMovementDirection(f.importo < 0 ? 'uscita' : 'entrata');
                setShowEditPopup(true);
              }}
            >
              <div class="text-center w-[20%]">
                {new Date(f.data_scadenza).toLocaleDateString('it-IT')}
              </div>
              <div class="text-center px-2 w-[35%]">{f.nome}</div>
              <div class="text-right pr-3 w-[20%]">
                {new Intl.NumberFormat('it-IT', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2
                }).format(f.importo)} €
              </div>
              <div class="text-center w-[15%] h-full">
                <input
                  type="checkbox"
                  checked={f.status === 'PAYED'}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => togglePaymentStatus(f.id, f.status)}
                  class="cursor-pointer w-6 h-6"
                />
              </div>
              <div class="text-center w-[10%]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteScadenza(f.id);
                  }}
                  class="text-red-500 hover:text-red-700"
                >
                  <img src="/trash-black.svg" alt="cestino" class="h-6 w-6" />
                </button>
              </div>
            </div>
          ))}
      </div>

      <button
        onClick={() => {
          setNewScadenza({
            data_scadenza: new Date().toISOString().split('T')[0],
            data_ricevuta: new Date().toISOString().split('T')[0],
            nome: '',
            importo: '',
            status: 'NOT_PAYED',
            descrizione: '',
          });
          // Resetta la direzione al valore predefinito
          setNewMovementDirection('entrata');
          setShowAddPopup(true);
        }}
        class="fixed bottom-[106px] right-4 w-16 h-16 bg-blue-500 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center hover:bg-green-600"
      >
        <img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
      </button>

      {showAddPopup() && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-[90%] relative">
            <button
              onClick={() => setShowAddPopup(false)}
              class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              <img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
            </button>

            <h2 class="text-lg font-bold mb-4 text-center">Nuova Scadenza</h2>

            {/* Sezione per selezionare la direzione del movimento */}
            <div class="flex justify-center gap-1 mb-4">
              <button
                type="button"
                class={`px-4 py-2 w-[140px] rounded-l-full shadow-lg ${newMovementDirection() === 'entrata' ? 'bg-green-200 text-green-800 font-semibold' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => setNewMovementDirection('entrata')}
              >
                IN ENTRATA
              </button>
              <button
                type="button"
                class={`px-4 py-2 w-[140px] rounded-r-full shadow-lg ${newMovementDirection() === 'uscita' ? 'bg-red-200 text-red-800 font-semibold' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => setNewMovementDirection('uscita')}
              >
                IN USCITA
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await addNewScadenza();
              }}
            >
              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Data Ricevuta</label>
                <input
                  type="date"
                  value={newScadenza().data_ricevuta}
                  onInput={(e) => setNewScadenza({ ...newScadenza(), data_ricevuta: e.currentTarget.value })}
                  class="w-full border rounded px-3 py-2"
                />
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Data Scadenza</label>
                <input
                  type="date"
                  value={newScadenza().data_scadenza}
                  onInput={(e) => setNewScadenza({ ...newScadenza(), data_scadenza: e.currentTarget.value })}
                  class="w-full border rounded px-3 py-2"
                />
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={newScadenza().nome}
                  onInput={(e) => setNewScadenza({ ...newScadenza(), nome: e.currentTarget.value })}
                  class="w-full border rounded px-3 py-2"
                />
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">
                  Descrizione<span class="ml-1 text-gray-400 font-normal">(opzionale)</span>
                </label>
                <input
                  type="text"
                  value={newScadenza().descrizione}
                  onInput={(e) => setNewScadenza({ ...newScadenza(), descrizione: e.currentTarget.value })}
                  class="w-full border rounded px-3 py-2"
                />
              </div>
              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Importo</label>
                <input
                  type="text"
                  value={newScadenza().importo}
                  onInput={(e) => {
                    let input = e.currentTarget.value;
                    // Permetti solo cifre e la virgola (senza segno)
                    input = input.replace(/[^0-9,]/g, '');
                    setNewScadenza({ ...newScadenza(), importo: input });
                  }}
                  class="w-full border rounded px-3 py-2"
                />
              </div>
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

      {showEditPopup() && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg p-6 w-[90%] relative">
            <button
              onClick={() => setShowEditPopup(false)}
              class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              <img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
            </button>

            <h2 class="text-lg font-bold mb-4 text-center">Modifica Scadenza</h2>

            {/* Sezione per selezionare la direzione del movimento in modifica */}
            <div class="flex justify-center gap-1 mb-4">
              <button
                type="button"
                class={`px-4 py-2 w-[140px] rounded-l-full shadow-lg ${editMovementDirection() === 'entrata' ? 'bg-green-200 text-green-800 font-semibold' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => setEditMovementDirection('entrata')}
              >
                IN ENTRATA
              </button>
              <button
                type="button"
                class={`px-4 py-2 w-[140px] rounded-r-full shadow-lg ${editMovementDirection() === 'uscita' ? 'bg-red-200 text-red-800 font-semibold' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => setEditMovementDirection('uscita')}
              >
                IN USCITA
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await updateScadenza();
              }}
            >
              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Data Ricevuta</label>
                <input
                  type="date"
                  value={editScadenza().data_ricevuta}
                  onInput={(e) => setEditScadenza({ ...editScadenza(), data_ricevuta: e.currentTarget.value })}
                  class="w-full border rounded px-3 py-2"
                />
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Data Scadenza</label>
                <input
                  type="date"
                  value={editScadenza().data_scadenza}
                  onInput={(e) => setEditScadenza({ ...editScadenza(), data_scadenza: e.currentTarget.value })}
                  class="w-full border rounded px-3 py-2"
                />
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  value={editScadenza().nome}
                  onInput={(e) => setEditScadenza({ ...editScadenza(), nome: e.currentTarget.value })}
                  class="w-full border rounded px-3 py-2"
                />
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">
                  Descrizione<span class="ml-1 text-gray-400 font-normal">(opzionale)</span>
                </label>
                <input
                  type="text"
                  value={editScadenza().descrizione}
                  onInput={(e) => setEditScadenza({ ...editScadenza(), descrizione: e.currentTarget.value })}
                  class="w-full border rounded px-3 py-2"
                />
              </div>

              <div class="mb-4">
                <label class="block text-sm font-medium mb-1">Importo</label>
                <input
                  type="text"
                  value={editScadenza().importo}
                  onInput={(e) => {
                    let input = e.currentTarget.value;
                    input = input.replace(/[^0-9,]/g, '');
                    setEditScadenza({ ...editScadenza(), importo: input });
                  }}
                  class="w-full border rounded px-3 py-2"
                />
              </div>

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

export default Scadenze;
