import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Spese = ({ spese, setSpese }) => {
    //const [spese, setSpese] = createSignal([]); // Stato locale per le spese
    const [view, setView] = createSignal('year'); // 'month' | 'day' | 'details'
    const [selectedYear, setSelectedYear] = createSignal(''); // Stato per l'anno selezionato
    const [selectedMonth, setSelectedMonth] = createSignal('');
    const [selectedDay, setSelectedDay] = createSignal('');
    const [selectedSpesa, setSelectedSpesa] = createSignal(null);
    const [showPopup, setShowPopup] = createSignal(false);
    const [newSpesa, setNewSpesa] = createSignal({
        data_competenza: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Oggi - 1 giorno
        tipo: '',
        metodo_di_pagamento: '',
        importo: '',
        descrizione: '',
    });
    const [showDeletePopup, setShowDeletePopup] = createSignal(false);
    const [showEditPopup, setShowEditPopup] = createSignal(false);
    const [editSpesa, setEditSpesa] = createSignal({
        tipo: '',
        metodo_di_pagamento: '',
        importo: '',
        descrizione: '',
    });
    const [selectedSpesaId, setSelectedSpesaId] = createSignal('');

    // Funzione per raggruppare le spese per anno
    const groupByYear = () => {
        const grouped = {};

        spese().forEach((entry) => {
            const year = new Date(entry.data_competenza).getFullYear();
            if (!grouped[year]) {
                grouped[year] = 0;
            }
            grouped[year] += entry.importo;
        });

        // Ordina gli anni in ordine decrescente
        return Object.entries(grouped)
            .sort(([a], [b]) => b - a) // Ordine decrescente per anno
            .map(([year, total]) => [year, total]);
    };

    // Funzione che raggruppa le spese per mese
    const groupByMonth = () => {
        const grouped = {};

        spese()
            .filter((entry) => new Date(entry.data_competenza).getFullYear() === parseInt(selectedYear()))
            .forEach((entry) => {
                const monthKey = new Date(entry.data_competenza).toISOString().slice(0, 7); // YYYY-MM
                if (!grouped[monthKey]) {
                    grouped[monthKey] = 0;
                }
                grouped[monthKey] += entry.importo;
            });

        return Object.entries(grouped)
            .sort(([keyA], [keyB]) => new Date(`${keyA}-01`) - new Date(`${keyB}-01`))
            .map(([monthKey, total]) => {
                const monthLabel = new Date(`${monthKey}-01`).toLocaleString('default', {
                    month: 'long',
                    year: 'numeric',
                });
                return [monthLabel, total];
            });
    };

    // Funzione per la view dei giorni del mese
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

    //Funzione che carica i dettagli di un giorno
    const getDailyDetails = () => {
        console.log(selectedDay(), selectedSpesaId());
        return spese().find((entry) => entry.data_competenza === selectedDay() && entry.id === selectedSpesaId());
    };

    //Funzione che carica solo la parte CASH delle spese
    const getCashExpenses = () => {
        return spese().filter(
            (entry) => entry.data_competenza === selectedDay() && entry.origin === "CASH"
        );
    };

    //Funzione che carica solo la parte CC delle spese
    const getCCExpenses = () => {
        return spese().filter(
            (entry) => entry.data_competenza === selectedDay() && entry.origin === "CC"
        );
    };

    //Funzione per l'inserimento di una nuova spesa
    const addNewSpesa = async () => {
        const { tipo, metodo_di_pagamento, importo } = newSpesa();

        if (!tipo || !metodo_di_pagamento || !importo) {
            alert("Per favore, compila tutti i campi obbligatori: Tipo, Metodo di pagamento e Importo.");
            return;
        }

        let convertedValue;
        const value = newSpesa().importo;

        // Se il campo è vuoto, imposta a 0
        if (value === '') {
            convertedValue = 0;
        } else {
            // Sostituisci eventuale "," con "."
            const sanitizedValue = value.replace(',', '.');

            // Prova a convertire in numero
            const numericValue = parseFloat(sanitizedValue);

            if (isNaN(numericValue) || numericValue === 0) {
                alert(`Il valore di importo non è valido o è nullo. Inserisci un numero valido.`);
                return; // Blocca l'inserimento
            }

            convertedValue = numericValue; // Salva il valore convertito
        }

        const spesaConOrigin = {
            ...newSpesa(),
            importo: convertedValue,
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

    //Funzione per la cancellazione di una spesa esistente
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

    //Funzione per l'apertura del popup per modificare una spesa
    const openEditPopup = () => {
        const selectedSpesa = selectedSpesa();
        if (!selectedSpesa) return;

        setEditSpesa({
            tipo: selectedSpesa.tipo,
            metodo_di_pagamento: selectedSpesa.metodo_di_pagamento,
            importo: selectedSpesa.importo ? selectedSpesa.importo.toString().replace('.', ',') : '',
            descrizione: selectedSpesa.descrizione,
            data_competenza: selectedSpesa.data_competenza, // Include la data di competenza
        });
        setShowEditPopup(true);
    };

    //Funzione per l'update di una spesa
    const updateSpesa = async () => {
        const { tipo, metodo_di_pagamento, importo } = editSpesa();

        //console.log(tipo, metodo_di_pagamento, importo);

        if (!tipo || !metodo_di_pagamento || !importo) {
            alert("Per favore, compila tutti i campi obbligatori: Tipo, Metodo di pagamento e Importo.");
            return;
        }

        const selectedSpesa = getDailyDetails();
        if (!selectedSpesa) return;

        // Verifica e converte i campi numerici
        let convertedValue;
        const value = editSpesa().importo;
        //console.log(value);
        // Se il campo è vuoto, imposta a 0
        if (value === '') {
            convertedValue = 0;
        } else {
            // Sostituisci eventuale "," con "."
            const sanitizedValue = value.replace(',', '.');

            // Prova a convertire in numero
            const numericValue = parseFloat(sanitizedValue);

            if (isNaN(numericValue) || numericValue === 0) {
                alert(`Il valore inserito per Importo non è valido o è nullo. Inserisci un numero valido.`);
                return; // Blocca l'inserimento
            }

            convertedValue = numericValue; // Salva il valore convertito
        }

        // Crea un nuovo oggetto incasso con i campi convertiti
        const spesaToUpdate = {
            ...editSpesa(),
            importo: convertedValue,
        };

        const { error } = await supabase
            .from('spese')
            .update(spesaToUpdate)
            .eq('id', selectedSpesa.id); // Utilizza l'id per identificare la riga

        if (error) {
            console.error("Errore durante l'aggiornamento della spesa:", error.message);
        } else {
            console.log('Spesa aggiornata con successo');
            setSpese((prev) =>
                prev.map((entry) =>
                    entry.id === selectedSpesa.id ? { ...entry, ...spesaToUpdate } : entry
                )
            );

            // Aggiorna anche selectedSpesa
            setSelectedSpesa({ ...selectedSpesa, ...spesaToUpdate });
            setShowEditPopup(false);
        }
    };

    return (
        <div class="w-full h-full p-2">

            {/* View delle spese per anno */}
            {view() === 'year' && (
                <div>
                    <h2 class="flex items-center justify-center h-[55px] text-lg font-semibold mb-2">
                        Spese annuali
                    </h2>
                    <ul class="overflow-y-auto h-[calc(100vh-220px)]">
                        {groupByYear().map(([year, total]) => (
                            <li
                                class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                    setSelectedYear(year); // Imposta l'anno selezionato
                                    setView('month'); // Passa alla view 'month'
                                }}
                            >
                                <div class="flex justify-between">
                                    <span>{year}</span>
                                    <span class="text-red-600">
                                        {new Intl.NumberFormat('it-IT', {
                                            style: 'decimal',
                                            maximumFractionDigits: 0,
                                        }).format(Math.round(total))} €
                                    </span>
                                </div>
                            </li>
                        ))}

                        {/* Totale complessivo di tutti gli anni */}
                        <li class="py-2 px-4 bg-gray-100 font-semibold">
                            <div class="flex justify-end">
                                <span class="text-red-800 font-bold">
                                    {new Intl.NumberFormat('it-IT', {
                                        style: 'decimal',
                                        maximumFractionDigits: 0,
                                    }).format(
                                        groupByYear().reduce((sum, [, total]) => sum + total, 0)
                                    )} €
                                </span>
                            </div>
                        </li>
                    </ul>
                </div>
            )}

            {/* View delle spese per mese */}
            {view() === 'month' && (
                <div>
                    <div class="flex justify-between h-[55px] mb-2">
                        <button class="w-[40px] bg-gray-100 font-bold text-black rounded" onClick={() => setView('year')}>
                            <img src="/back.svg" alt="back" class="w-full h-auto" />
                        </button>
                        <div>
                            <div class="text-lg text-center font-semibold">Spese Mensili</div>
                            <div class="text-center">{selectedYear()}</div>
                        </div>
                        <div class="w-[40px]"></div>
                    </div>
                    <ul class="overflow-y-auto h-[calc(100vh-220px)]">
                        {groupByMonth().map(([month, total]) => (
                            <li
                                class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                    setSelectedMonth(month); // Imposta il mese selezionato
                                    setView('day'); // Passa alla view 'day'
                                }}
                            >
                                <div class="flex justify-between">
                                    <span>{month}</span>
                                    <span class="text-red-600">
                                        {new Intl.NumberFormat('it-IT', {
                                            style: 'decimal',
                                            maximumFractionDigits: 0,
                                        }).format(Math.round(total))} €
                                    </span>
                                </div>
                            </li>
                        ))}

                        {/* Totale complessivo del mese */}
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
                                    <tbody>
                                        {getCashExpenses().map((entry) => (
                                            <tr class="flex items-center justify-center border-b h-[40px]"
                                                onClick={() => {
                                                    setSelectedSpesa(entry); // Salva la spesa selezionata
                                                    setSelectedSpesaId(entry.id);
                                                    setView('singleDetail'); // Passa alla view "singleDetail"
                                                }}>
                                                <td class="text-black px-2 py-1 w-[40%] min-w-[40%]">{entry.tipo || '-'}</td>
                                                <td class="w-full text-[10px] px-2 py-1">{entry.descrizione || '-'}</td>
                                                <td class="px-2 py-1 w-[25%] min-w-[80px] text-right text-red-600 whitespace-nowrap">
                                                    {new Intl.NumberFormat('it-IT', {
                                                        style: 'decimal',
                                                        minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
                                                        maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
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
                                    <tbody>
                                        {getCCExpenses().map((entry) => (
                                            <tr class="flex items-center justify-center border-b h-[40px]"
                                                onClick={() => {
                                                    setSelectedSpesa(entry); // Salva la spesa selezionata
                                                    setSelectedSpesaId(entry.id);
                                                    setView('singleDetail'); // Passa alla view "singleDetail"
                                                }}>
                                                <td class="text-black px-2 py-1 w-[40%] min-w-[40%]">{entry.tipo || '-'}</td>
                                                <td class="w-full text-[10px] px-2 py-1 line-clamp-1">{entry.descrizione || '-'}</td>
                                                <td class="px-2 py-1 w-[25%] min-w-[80px] text-right text-red-600 whitespace-nowrap">
                                                    {new Intl.NumberFormat('it-IT', {
                                                        style: 'decimal',
                                                        minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
                                                        maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
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

            {view() === 'singleDetail' && selectedSpesa() && (
                <div>
                    <div class="flex justify-between h-[55px] mb-2">
                        <button
                            class="w-[40px] bg-gray-100 font-bold text-black rounded"
                            onClick={() => setView('details')} // Torna alla view "details"
                        >
                            <img src="/back.svg" alt="back" class="w-full h-auto" />
                        </button>
                        <div>
                            <div class="text-lg text-center font-semibold">Dettaglio Spesa {selectedSpesa().origin}</div>
                            <div class="text-center">{new Date(selectedDay()).toLocaleDateString()}</div>
                        </div>
                        <div class="w-[40px]"></div>
                    </div>

                    <div class="p-4">
                        <div class="mb-4">
                            <div class="font-semibold">Tipo</div>
                            <div class="text-gray-700">{selectedSpesa().tipo || '-'}</div>
                        </div>
                        <div class="mb-4">
                            <div class="font-semibold">Metodo di pagamento</div>
                            <div class="text-gray-700">{selectedSpesa().metodo_di_pagamento || '-'}</div>
                        </div>
                        <div class="mb-4">
                            <div class="font-semibold">Importo</div>{' '}
                            <div class="text-red-600">
                                {new Intl.NumberFormat('it-IT', {
                                    style: 'decimal',
                                    minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
                                    maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
                                }).format(selectedSpesa().importo)} €
                            </div>
                        </div>
                        <div class="mb-4">
                            <div class="font-semibold">Descrizione</div>
                            <div class="text-gray-700">{selectedSpesa().descrizione || '-'}</div>
                        </div>
                    </div>

                    {/* Pulsanti di azione */}
                    {selectedSpesa().origin === "CASH" && (
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
                    )}

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
                                    {new Date(selectedSpesa().data_competenza).toLocaleDateString('it-IT')}
                                </h2>
                                <div class="flex justify-center gap-4 mt-6">
                                    <button
                                        onClick={() => {
                                            setSelectedSpesaId(selectedSpesa().id); // Imposta l'ID della spesa
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

                                    {[{ label: 'Importo', key: 'importo' }
                                    ].map(
                                        ({ label, key }) => (
                                            <div class="mb-4" key={key}>
                                                <label class="block text-sm font-medium mb-1">{label}</label>
                                                <input
                                                    type="text"
                                                    value={editSpesa()[key]}
                                                    onInput={(e) => {
                                                        const input = e.currentTarget.value;

                                                        // Sostituisci immediatamente "." con ","
                                                        let sanitizedInput = input.replace('.', ',');

                                                        // Rimuovi tutti i caratteri non validi (solo numeri e ",")
                                                        sanitizedInput = sanitizedInput.replace(/[^0-9,]/g, '');

                                                        // Aggiorna lo stato con il valore sanitizzato
                                                        setEditSpesa({
                                                            ...editSpesa(),
                                                            [key]: sanitizedInput,
                                                        });
                                                    }}

                                                    class={`w-full border rounded px-3 py-2 ${
                                                        // Validazione: campo è rosso se contiene più di una virgola
                                                        /^[0-9]*,?[0-9]*$/.test(editSpesa()[key]) ? '' : 'text-red-500'
                                                        }`}
                                                />
                                            </div>
                                        )
                                    )}

                                    {[{ label: 'Descrizione', type: 'text', key: 'descrizione' }
                                    ].map(
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

                            {/* Campo per la data di competenza */}
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-1">Data Competenza</label>
                                <input
                                    type="date"
                                    value={newSpesa().data_competenza || ''}
                                    onInput={(e) => setNewSpesa({ ...newSpesa(), data_competenza: e.currentTarget.value, })}
                                    class="w-full border rounded px-3 py-2"
                                />
                            </div>

                            {/* campo Tipo */}
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-1">Tipo</label>
                                <select
                                    value={newSpesa().tipo}
                                    onInput={(e) => setNewSpesa({ ...newSpesa(), tipo: e.currentTarget.value, })}
                                    class="w-full border rounded px-3 py-2"
                                >
                                    <option value="" disabled>Seleziona tipo di spesa</option>
                                    {["Paga dipendenti", "Cibo", "Manutenzione", "Fornitori", "Attrezzature", "Spese personali", "Altro"].map((option) => (
                                        <option value={option} key={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* campo Metodo di pagamento */}
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-1">Metodo di pagamento</label>
                                <select
                                    value={newSpesa().metodo_di_pagamento}
                                    onInput={(e) => setNewSpesa({ ...newSpesa(), metodo_di_pagamento: e.currentTarget.value, })}
                                    class="w-full border rounded px-3 py-2"
                                >
                                    <option value="" disabled>Seleziona metodo di pagamento</option>
                                    {["Presi dalla cassa in serata", "Presi dai cash"].map((option) => (
                                        <option value={option} key={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* importo */}
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-1">Importo</label>
                                <input
                                    type="text"
                                    value={newSpesa().importo !== '' ? newSpesa().importo : ''}
                                    onInput={(e) => {
                                        const input = e.currentTarget.value;

                                        // Sostituisci immediatamente "." con ","
                                        let sanitizedInput = input.replace('.', ',');

                                        // Rimuovi tutti i caratteri non validi (solo numeri e ",")
                                        sanitizedInput = sanitizedInput.replace(/[^0-9,]/g, '');

                                        // Aggiorna lo stato con il valore sanitizzato
                                        setNewSpesa({ ...newSpesa(), importo: sanitizedInput, });
                                    }}
                                    class={`w-full border rounded px-3 py-2 ${
                                        // Validazione: campo è rosso se contiene più di una virgola
                                        /^[0-9]*,?[0-9]*$/.test(newSpesa().importo) ? '' : 'text-red-500'
                                        }`}
                                />
                            </div>

                            {/* descrizione */}
                            <div class="mb-4">
                                <label class="block text-sm font-medium mb-1">Descrizione</label>
                                <input
                                    type="text"
                                    value={newSpesa().descrizione || ''}
                                    onInput={(e) => setNewSpesa({ ...newSpesa(), descrizione: e.currentTarget.value, })}
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

export default Spese;

