import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Spese = ({ spese, setSpese }) => {
    //const [spese, setSpese] = createSignal([]); // Stato locale per le spese
    const [view, setView] = createSignal('month'); // 'month' | 'day' | 'details'
    const [selectedMonth, setSelectedMonth] = createSignal('');
    const [selectedDay, setSelectedDay] = createSignal('');
    const [selectedCashSpesa, setSelectedCashSpesa] = createSignal(null);
    const [showPopup, setShowPopup] = createSignal(false);
    const [newSpesa, setNewSpesa] = createSignal({
        data_competenza: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Oggi - 1 giorno
        tipo: '',
        metodo_di_pagamento: '',
        importo: 0,
        descrizione: '',
    });
    const [showDeletePopup, setShowDeletePopup] = createSignal(false);
    const [showEditPopup, setShowEditPopup] = createSignal(false);
    const [editSpesa, setEditSpesa] = createSignal({
        tipo: '',
        metodo_di_pagamento: '',
        importo: 0,
        descrizione: '',
    });
    const [selectedSpesaId, setSelectedSpesaId] = createSignal('');

    // const fetchSpese = async () => {
    //     const { data, error } = await supabase.from('spese').select('*');

    //     if (error) {
    //         console.error('Errore durante il caricamento delle spese:', error.message);
    //         setSpese([]); // In caso di errore, imposta un array vuoto
    //     } else {
    //         setSpese(data || []); // Salva i dati ricevuti
    //     }
    // };

    // onMount(() => {
    //     fetchSpese();
    // });

    const groupByMonth = () => {
        const grouped = {};

        spese().forEach((entry) => {
            const monthKey = new Date(entry.data_competenza).toISOString().slice(0, 7); // YYYY-MM
            if (!grouped[monthKey]) {
                grouped[monthKey] = 0;
            }
            grouped[monthKey] += entry.importo;
        });

        // Ordiniamo usando la MonthKey
        return Object.entries(grouped)
            .sort(([keyA], [keyB]) => {
                const dateA = new Date(`${keyA}-01`); // Convertiamo la chiave in una data
                const dateB = new Date(`${keyB}-01`);
                return dateB - dateA; // Ordine decrescente (più recente prima)
            })
            .map(([monthKey, total]) => {
                const monthLabel = new Date(`${monthKey}-01`).toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                });
                return [monthLabel, total]; // Restituiamo il label leggibile e il totale
            });
    };

    const groupByDate = () => {
        const grouped = spese()
            .filter((entry) => {
                const month = new Date(entry.data_competenza).toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                });
                return month === selectedMonth();
            })
            .reduce((acc, entry) => {
                const date = entry.data_competenza;
                if (!acc[date]) {
                    acc[date] = { total: 0, spese: [] };
                }
                acc[date].total += entry.importo;
                acc[date].spese.push(entry);
                return acc;
            }, {});

        return Object.entries(grouped).sort(([dateA], [dateB]) => {
            const date1 = new Date(dateA);
            const date2 = new Date(dateB);
            return date1.getTime() - date2.getTime();
        });
    };

    const getDailyExpenses = () => {
        return spese().filter((entry) => entry.data_competenza === selectedDay());
    };

    const getDailyDetails = () => {
        console.log(selectedDay(), selectedSpesaId());
        return spese().find((entry) => entry.data_competenza === selectedDay() && entry.id === selectedSpesaId());
    };

    const getCashExpenses = () => {
        return spese().filter(
            (entry) => entry.data_competenza === selectedDay() && entry.origin === "CASH"
        );
    };

    const getCCExpenses = () => {
        return spese().filter(
            (entry) => entry.data_competenza === selectedDay() && entry.origin === "CC"
        );
    };

    const addNewSpesa = async () => {
        const { tipo, metodo_di_pagamento, importo } = newSpesa();

        if (!tipo || !metodo_di_pagamento || !importo || importo <= 0) {
            alert("Per favore, compila tutti i campi obbligatori: Tipo, Metodo di pagamento e Importo.");
            return;
        }

        const spesaConOrigin = {
            ...newSpesa(),
            origin: "CASH", // Imposta il campo origin
        };

        const { data, error } = await supabase
            .from('spese')
            .insert([spesaConOrigin], { returning: 'representation' })
            .select('*');

        if (error) {
            console.error("Errore durante l'inserimento:", error.message);
        } else {
            console.log('Spesa aggiunta con successo:', data);
            setSpese((prev) => [...prev, ...(data || [])]);
            setShowPopup(false);
        }
    };

    const calculateTotal = (entries) => {
        return entries.reduce((sum, entry) => sum + (entry.importo || 0), 0);
    };

    const deleteSpesa = async () => {
        const spesaId = selectedSpesaId();
        if (!spesaId) return;

        const { error } = await supabase
            .from('spese')
            .delete()
            .eq('id', spesaId); // Utilizza l'ID per identificare la riga

        if (error) {
            console.error("Errore durante la cancellazione della spesa:", error.message);
        } else {
            console.log('Spesa cancellata con successo');
            setSpese((prev) =>
                prev.filter((entry) => entry.id !== spesaId) // Rimuovi la riga dallo stato locale
            );
            setShowDeletePopup(false);
            // Verifica se ci sono ancora spese per il giorno selezionato
            const remainingExpenses = spese().filter(
                (entry) => entry.data_competenza === selectedDay()
            );

            if (remainingExpenses.length > 0) {
                setView('details'); // Torna alla view "details" se ci sono ancora spese
            } else {
                setView('day'); // Torna alla view "day" se non ci sono più spese
            }
        }
    };

    const openEditPopup = () => {
        const selectedSpesa = selectedCashSpesa();
        if (!selectedSpesa) return;
    
        setEditSpesa({
            tipo: selectedSpesa.tipo,
            metodo_di_pagamento: selectedSpesa.metodo_di_pagamento,
            importo: selectedSpesa.importo,
            descrizione: selectedSpesa.descrizione,
            data_competenza: selectedSpesa.data_competenza, // Include la data di competenza
        });
        setShowEditPopup(true);
    };

    const updateSpesa = async () => {
        const { tipo, metodo_di_pagamento, importo } = editSpesa();

        console.log(tipo, metodo_di_pagamento, importo);

        if (!tipo || !metodo_di_pagamento || !importo || importo <= 0) {
            alert("Per favore, compila tutti i campi obbligatori: Tipo, Metodo di pagamento e Importo.");
            return;
        }

        const selectedSpesa = getDailyDetails();
        console.log(selectedSpesa);
        if (!selectedSpesa) return;

        const { error } = await supabase
            .from('spese')
            .update(editSpesa())
            .eq('id', selectedSpesa.id); // Utilizza l'id per identificare la riga

        if (error) {
            console.error("Errore durante l'aggiornamento della spesa:", error.message);
        } else {
            console.log('Spesa aggiornata con successo');
            setSpese((prev) =>
                prev.map((entry) =>
                    entry.id === selectedSpesa.id ? { ...entry, ...editSpesa() } : entry
                )
            );

            // Aggiorna anche selectedCashSpesa
            setSelectedCashSpesa({ ...selectedSpesa, ...editSpesa() });
            setShowEditPopup(false);
        }
    };

    return (
        <div class="w-full h-full p-2">
            {/* View delle spese per mese */}
            {view() === 'month' && (
                <div>
                    <h2 class="flex items-center justify-center h-[55px] text-lg font-semibold mb-2">Spese mensili</h2>
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
                                    <span class="">{month}</span>
                                    <span class="text-red-600">
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
                                <span class="text-red-800 font-bold">
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

            {/* View delle spese giornaliere */}
            {view() === 'day' && (
                <div>
                    <div class="flex justify-between h-[55px] mb-2">
                        <button class="w-[40px] bg-gray-100 font-bold text-black rounded" onClick={() => setView('month')}>
                            <img src="/back.svg" alt="back" class="w-full h-auto" />
                        </button>
                        <div>
                            <div class="text-lg text-center font-semibold">Spese giornaliere</div>
                            <div class="text-center">{selectedMonth()}</div>
                        </div>
                        <div class="w-[40px]"></div>
                    </div>
                    <ul class="overflow-y-auto h-[calc(100vh-220px)] pb-40">
                        {groupByDate().map(([date, { total, spese }]) => (
                            <li
                                class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                    setSelectedDay(date);
                                    setView('details');
                                }}
                            >
                                <div class="flex justify-between">
                                    <span>{new Date(date).toLocaleDateString()}</span>
                                    <span class="text-red-600">
                                        {new Intl.NumberFormat('it-IT', {
                                            style: 'decimal',
                                            maximumFractionDigits: 0,
                                        }).format(Math.round(total))} €
                                    </span>
                                </div>
                            </li>
                        ))}

                        {/* Totale complessivo del mese selezionato */}
                        <li class="py-2 px-4 bg-gray-100 font-semibold">
                            <div class="flex justify-end">
                                <span class="text-red-800 font-bold">
                                    {new Intl.NumberFormat('it-IT', {
                                        style: 'decimal',
                                        maximumFractionDigits: 0,
                                    }).format(
                                        groupByDate().reduce((sum, [, { total }]) => sum + total, 0)
                                    )} €
                                </span>
                            </div>
                        </li>
                    </ul>
                </div>
            )}

            {/* View di dettaglio per un giorno */}
            {view() === 'details' && (
                <div>
                    <div class="flex justify-between h-[55px] mb-2">
                        <button
                            class="w-[40px] bg-gray-100 font-bold text-black rounded"
                            onClick={() => setView('day')}
                        >
                            <img src="/back.svg" alt="back" class="w-full h-auto" />
                        </button>
                        <div>
                            <div class="text-lg text-center font-semibold">Dettaglio Spese</div>
                            <div class="text-center">{new Date(selectedDay()).toLocaleDateString()}</div>
                        </div>
                        <div class="w-[40px]"></div>
                    </div>

                    <div class="overflow-y-auto h-[calc(100vh-232px)] pb-40 mt-4">
                        {/* Sezione "CASH" */}
                        {getCashExpenses().length > 0 && (
                            <div>
                                <h3 class="font-semibold text-red-800 mb-2">Spese CASH</h3>
                                <table class="w-full text-sm text-gray-700">
                                    {/* <thead>
                                        <tr class="bg-gray-100">
                                            <th class="px-2 py-1 text-left">Tipo</th>
                                            <th class="px-2 py-1 text-left">Descrizione</th>
                                            <th class="px-2 py-1 text-right">Importo (€)</th>
                                        </tr>
                                    </thead> */}
                                    <tbody>
                                        {getCashExpenses().map((entry) => (
                                            <tr class="border-b h-[40px]"
                                                onClick={() => {
                                                    setSelectedCashSpesa(entry); // Salva la spesa selezionata
                                                    setSelectedSpesaId(entry.id);
                                                    setView('singleDetail'); // Passa alla view "singleDetail"
                                                }}>
                                                <td class="px-2 py-1">{entry.tipo || '-'}</td>
                                                <td class="px-2 py-1">{entry.descrizione || '-'}</td>
                                                <td class="px-2 py-1 text-right text-red-600 whitespace-nowrap">
                                                    {new Intl.NumberFormat('it-IT', {
                                                        style: 'decimal',
                                                        maximumFractionDigits: 0,
                                                    }).format(entry.importo)} €
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Sezione "CC" */}
                        {getCCExpenses().length > 0 && (
                            <div class="mt-6">
                                <h3 class="font-semibold text-red-800 mb-2">Spese CC</h3>
                                <table class="w-full text-sm text-gray-700">
                                    {/* <thead>
                                        <tr class="bg-gray-100">
                                            <th class="border border-gray-300 px-2 py-1 text-left">Descrizione</th>
                                            <th class="border border-gray-300 px-2 py-1 text-right">Importo (€)</th>
                                        </tr>
                                    </thead> */}
                                    <tbody>
                                        {getCCExpenses().map((entry) => (
                                            <tr class="border-b">
                                                <td class="px-2 py-1">{entry.descrizione || '-'}</td>
                                                <td class="px-2 py-1 text-right text-red-600 whitespace-nowrap">
                                                    {new Intl.NumberFormat('it-IT', {
                                                        style: 'decimal',
                                                        maximumFractionDigits: 0,
                                                    }).format(entry.importo)} €
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {view() === 'singleDetail' && selectedCashSpesa() && (
                <div>
                    <div class="flex justify-between h-[55px] mb-2">
                        <button
                            class="w-[40px] bg-gray-100 font-bold text-black rounded"
                            onClick={() => setView('details')} // Torna alla view "details"
                        >
                            <img src="/back.svg" alt="back" class="w-full h-auto" />
                        </button>
                        <div>
                            <div class="text-lg text-center font-semibold">Dettaglio Spesa CASH</div>
                            <div class="text-center">{new Date(selectedDay()).toLocaleDateString()}</div>
                        </div>
                        <div class="w-[40px]"></div>
                    </div>

                    <div class="p-4">
                        <div class="mb-4">
                            <div class="font-semibold">Tipo</div>
                            <div class="text-gray-700">{selectedCashSpesa().tipo || '-'}</div>
                        </div>
                        <div class="mb-4">
                            <div class="font-semibold">Metodo di pagamento</div>
                            <div class="text-gray-700">{selectedCashSpesa().metodo_di_pagamento || '-'}</div>
                        </div>
                        <div class="mb-4">
                            <div class="font-semibold">Importo</div>{' '}
                            <div class="text-red-600">
                                {new Intl.NumberFormat('it-IT', {
                                    style: 'decimal',
                                    maximumFractionDigits: 0,
                                }).format(selectedCashSpesa().importo)} €
                            </div>
                        </div>
                        <div class="mb-4">
                            <div class="font-semibold">Descrizione</div>
                            <div class="text-gray-700">{selectedCashSpesa().descrizione || '-'}</div>
                        </div>
                    </div>

                    {/* Pulsanti di azione */}
                    <div class="flex justify-around mt-8">
                        {/* Bottone Cancella */}
                        <button
                            onClick={() => setShowDeletePopup(true)} // Mostra il popup di conferma
                            class="px-4 py-2 w-32 bg-red-500 text-white rounded-lg shadow-lg shadow-gray-400 hover:bg-red-600"
                        >
                            Cancella
                        </button>

                        {/* Bottone Modifica */}
                        <button
                            onClick={openEditPopup}
                            class="px-4 py-2 w-32 bg-yellow-500 text-white rounded-lg shadow-lg shadow-gray-400 hover:bg-yellow-600"
                        >
                            Modifica
                        </button>
                    </div>

                    {/* Popup di conferma cancellazione */}
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
                                    Verrà cancellata la spesa registrata in data{' '}
                                    {new Date(selectedCashSpesa().data_competenza).toLocaleDateString('it-IT')}
                                </h2>
                                <div class="flex justify-center gap-4 mt-6">
                                    <button
                                        onClick={() => {
                                            setSelectedSpesaId(selectedCashSpesa().id); // Imposta l'ID della spesa
                                            deleteSpesa(); // Chiama la funzione di cancellazione
                                            setShowDeletePopup(false); // Nascondi il popup
                                            setView('details'); // Torna alla view precedente
                                        }}
                                        class="px-4 py-2 w-full bg-red-500 text-white font-bold rounded hover:bg-red-600"
                                    >
                                        CONFERMA
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Popup per modificare una spesa */}
                    {showEditPopup() && (
                        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div class="bg-white rounded-lg p-6 w-[90%] relative">
                                <button
                                    onClick={() => setShowEditPopup(false)} // Chiudi il popup
                                    class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                                >
                                    <img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
                                </button>

                                <h2 class="text-lg font-bold mb-4 text-center">Modifica Spesa</h2>

                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        await updateSpesa(); // Chiama la funzione per aggiornare la spesa
                                        setShowEditPopup(false); // Chiudi il popup
                                    }}
                                >
                                    {/* Campo data di competenza (non modificabile) */}
                                    <div class="mb-4">
                                        <label class="block text-sm font-medium mb-1">Data Competenza</label>
                                        <input
                                            type="date"
                                            value={editSpesa().data_competenza || ''}
                                            class="w-full border rounded px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
                                            disabled
                                        />
                                    </div>

                                    {/* Campi modificabili */}
                                    {[
                                        {
                                            label: 'Tipo',
                                            key: 'tipo',
                                            options: ["Paga dipendenti", "Cibo", "Manutenzione", "Fornitori", "Attrezzature", "Spese personali", "Altro"],
                                        },
                                        {
                                            label: 'Metodo di pagamento',
                                            key: 'metodo_di_pagamento',
                                            options: ["Presi dalla cassa in serata", "Presi dai cash"],
                                        },
                                    ].map(({ label, key, options }) => (
                                        <div class="mb-4" key={key}>
                                            <label class="block text-sm font-medium mb-1">{label}</label>
                                            <select
                                                value={editSpesa()[key] || ''}
                                                onInput={(e) =>
                                                    setEditSpesa({
                                                        ...editSpesa(),
                                                        [key]: e.currentTarget.value,
                                                    })
                                                }
                                                class="w-full border rounded px-3 py-2"
                                            >
                                                <option value="" disabled>
                                                    Seleziona {label.toLowerCase()}
                                                </option>
                                                {options.map((option) => (
                                                    <option value={option} key={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}

                                    {[{ label: 'Importo', type: 'number', key: 'importo' }, { label: 'Descrizione', type: 'text', key: 'descrizione' }].map(
                                        ({ label, type, key }) => (
                                            <div class="mb-4" key={key}>
                                                <label class="block text-sm font-medium mb-1">{label}</label>
                                                <input
                                                    type={type}
                                                    value={editSpesa()[key] || ''}
                                                    onInput={(e) =>
                                                        setEditSpesa({
                                                            ...editSpesa(),
                                                            [key]: type === 'number' ? +e.currentTarget.value || 0 : e.currentTarget.value,
                                                        })
                                                    }
                                                    class="w-full border rounded px-3 py-2"
                                                />
                                            </div>
                                        )
                                    )}

                                    {/* Pulsante di salvataggio */}
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
            )}

            {/* Bottone rotondo */}
            {view() !== 'singleDetail' && (
                <button
                    onClick={() => setShowPopup(true)} // Mostra il popup
                    class="fixed bottom-[98px] right-4 w-16 h-16 bg-red-500 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center hover:bg-red-600"
                >
                    <img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
                </button>
            )}

            {/* Popup per aggiungere una nuova spesa */}
            {showPopup() && (
                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg p-6 w-[90%] relative">
                        <button
                            onClick={() => setShowPopup(false)}
                            class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                        >
                            <img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
                        </button>

                        <h2 class="text-lg font-bold mb-4 text-center">Nuova spesa CASH</h2>

                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                await addNewSpesa();
                            }}
                        >
                            {[
                                { label: 'Data Competenza', type: 'date', key: 'data_competenza' },
                            ].map(({ label, type, key }) => (
                                <div class="mb-4" key={key}>
                                    <label class="block text-sm font-medium mb-1">{label}</label>
                                    <input
                                        type={type}
                                        value={newSpesa()[key] || ''}
                                        onInput={(e) =>
                                            setNewSpesa({
                                                ...newSpesa(),
                                                [key]: type === 'number' ? +e.currentTarget.value || 0 : e.currentTarget.value,
                                            })
                                        }
                                        class="w-full border rounded px-3 py-2"
                                    />
                                </div>
                            ))}

                            {[
                                {
                                    label: 'Tipo',
                                    key: 'tipo',
                                    options: ["Paga dipendenti", "Cibo", "Manutenzione", "Fornitori", "Attrezzature", "Spese personali", "Altro"],
                                },
                                {
                                    label: 'Metodo di pagamento',
                                    key: 'metodo_di_pagamento',
                                    options: ["Presi dalla cassa in serata", "Presi dai cash"],
                                },
                            ].map(({ label, key, options }) => (
                                <div class="mb-4" key={key}>
                                    <label class="block text-sm font-medium mb-1">{label}</label>
                                    <select
                                        value={newSpesa()[key]}
                                        onInput={(e) =>
                                            setNewSpesa({
                                                ...newSpesa(),
                                                [key]: e.currentTarget.value,
                                            })
                                        }
                                        class="w-full border rounded px-3 py-2"
                                    >
                                        <option value="" disabled>
                                            Seleziona {label.toLowerCase()}
                                        </option>
                                        {options.map((option) => (
                                            <option value={option} key={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}

                            {[
                                { label: 'Importo', type: 'number', key: 'importo' },
                                { label: 'Descrizione', type: 'text', key: 'descrizione' },
                            ].map(({ label, type, key }) => (
                                <div class="mb-4" key={key}>
                                    <label class="block text-sm font-medium mb-1">{label}</label>
                                    <input
                                        type={type}
                                        value={newSpesa()[key] || ''}
                                        onInput={(e) =>
                                            setNewSpesa({
                                                ...newSpesa(),
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

export default Spese;

