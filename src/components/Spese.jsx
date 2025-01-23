import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Spese = ({ spese, setSpese }) => {
    //const [spese, setSpese] = createSignal([]); // Stato locale per le spese
    const [view, setView] = createSignal('month'); // 'month' | 'day' | 'detail'
    const [selectedMonth, setSelectedMonth] = createSignal('');
    const [selectedDay, setSelectedDay] = createSignal('');
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

    const fetchSpese = async () => {
        const { data, error } = await supabase.from('spese').select('*');

        if (error) {
            console.error('Errore durante il caricamento delle spese:', error.message);
            setSpese([]); // In caso di errore, imposta un array vuoto
        } else {
            setSpese(data || []); // Salva i dati ricevuti
        }
    };

    onMount(() => {
        fetchSpese();
    });

    const groupByMonth = () => {
        const grouped = {};

        spese().forEach((entry) => {
            const month = new Date(entry.data_competenza).toLocaleString('default', {
                month: 'long',
                year: 'numeric',
            });

            if (!grouped[month]) {
                grouped[month] = 0;
            }

            grouped[month] += entry.importo;
        });

        return Object.entries(grouped).sort(([monthA], [monthB]) => {
            const dateA = new Date(monthA);
            const dateB = new Date(monthB);
            return dateB.getTime() - dateA.getTime();
        });
    };

    const filterByDay = () => {
        return spese()
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
                return dateA.getTime() - dateB.getTime();
            });
    };

    const getDailyDetails = () => {
        return spese().find((entry) => entry.data_competenza === selectedDay() && entry.id === selectedSpesaId());
    };

    const addNewSpesa = async () => {
        const { tipo, metodo_di_pagamento, importo } = newSpesa();

        if (!tipo || !metodo_di_pagamento || !importo || importo <= 0) {
            alert("Per favore, compila tutti i campi obbligatori: Tipo, Metodo di pagamento e Importo.");
            return;
        }

        const { data, error } = await supabase
            .from('spese')
            .insert([newSpesa()], { returning: 'representation' })
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
        const selectedSpesa = getDailyDetails();
        if (!selectedSpesa) return;

        const { error } = await supabase
            .from('spese')
            .delete()
            .eq('id', selectedSpesa.id); // Utilizza l'id per identificare la riga

        if (error) {
            console.error("Errore durante la cancellazione della spesa:", error.message);
        } else {
            console.log('Spesa cancellata con successo');
            setSpese((prev) =>
                prev.filter((entry) => entry.id !== selectedSpesa.id) // Rimuovi la riga dallo stato locale
            );
            setShowDeletePopup(false);
            setView('day');
        }
    };

    const openEditPopup = () => {
        const selectedSpesa = getDailyDetails();
        if (!selectedSpesa) return;

        setEditSpesa({
            tipo: selectedSpesa.tipo,
            metodo_di_pagamento: selectedSpesa.metodo_di_pagamento,
            importo: selectedSpesa.importo,
            descrizione: selectedSpesa.descrizione,
        });
        setShowEditPopup(true);
    };

    const updateSpesa = async () => {
        const { tipo, metodo_di_pagamento, importo } = editSpesa();

        if (!tipo || !metodo_di_pagamento || !importo || importo <= 0) {
            alert("Per favore, compila tutti i campi obbligatori: Tipo, Metodo di pagamento e Importo.");
            return;
        }

        const selectedSpesa = getDailyDetails();
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
                        {filterByDay().map((entry) => (
                            <li
                                class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                    setSelectedDay(entry.data_competenza);
                                    setSelectedSpesaId(entry.id); // Salva l'id della riga selezionata
                                    setView('detail');
                                }}
                            >
                                <div class="flex justify-between">
                                    <span class="">{new Date(entry.data_competenza).toLocaleDateString()}</span>
                                    <span class="text-red-600">
                                        {new Intl.NumberFormat('it-IT', {
                                            style: 'decimal',
                                            maximumFractionDigits: 0,
                                        }).format(Math.round(entry.importo))} €
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
                                    }).format(calculateTotal(filterByDay()))} €
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
                            <div class="text-lg text-center font-semibold">Dettaglio Spese</div>
                            <div class="text-center">{new Date(selectedDay()).toLocaleDateString()}</div>
                        </div>
                        <div class="w-[40px]"></div>
                    </div>
                    <div class="overflow-y-auto h-[calc(100vh-220px)]">
                        {getDailyDetails() && (
                            <div>
                                {[{ label: 'Tipo', value: getDailyDetails()?.tipo },
                                { label: 'Metodo di pagamento', value: getDailyDetails()?.metodo_di_pagamento },
                                { label: 'Importo', value: getDailyDetails()?.importo },
                                { label: 'Descrizione', value: getDailyDetails()?.descrizione },
                                ].map(({ label, value }) => (
                                    <div class="flex justify-between py-2 px-4 border-b">
                                        <span class="">{label}:</span>
                                        <span class="text-red-600 text-right">
                                            {typeof value === 'number'
                                                ? new Intl.NumberFormat('it-IT', {
                                                    style: 'decimal',
                                                    maximumFractionDigits: 0,
                                                }).format(value) + ' €'
                                                : value || '-'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div class="flex justify-around mt-6">
                            <button
                                onClick={() => setShowDeletePopup(true)}
                                class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                            >
                                Cancella Spesa
                            </button>
                            <button
                                onClick={openEditPopup}
                                class="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                            >
                                Modifica Spesa
                            </button>
                        </div>
                    </div>

                    {showDeletePopup() && (
                        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div class="bg-red-100 rounded-lg p-6 w-96 relative">
                                <button
                                    onClick={() => setShowDeletePopup(false)}
                                    class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                                >
                                    <img src="/cancel-black.svg" alt="cancel" class="w-7 h-auto" />
                                </button>
                                <h2 class="text-lg font-bold mt-4 mb-4 text-center">
                                    Verrà cancellata la spesa selezionata dalla data{' '}
                                    {new Date(selectedDay()).toLocaleDateString('it-IT')}
                                </h2>
                                <div class="flex justify-center gap-4 mt-6">

                                    <button
                                        onClick={deleteSpesa}
                                        class="px-4 py-2 w-full bg-red-500 text-white font-bold rounded hover:bg-red-600"
                                    >
                                        CONFERMA
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showEditPopup() && (
                        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div class="bg-yellow-100 rounded-lg p-6 w-96 relative">
                                <button
                                    onClick={() => setShowEditPopup(false)}
                                    class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                                >
                                    <img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
                                </button>

                                <h2 class="text-lg font-bold mb-4 text-center">Modifica Spesa</h2>

                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        await updateSpesa();
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
                                                value={editSpesa()[key]}
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

                                    {[
                                        { label: 'Importo', type: 'number', key: 'importo' },
                                        { label: 'Descrizione', type: 'text', key: 'descrizione' },
                                    ].map(({ label, type, key }) => (
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

            {/* Bottone rotondo */}
            <button
                onClick={() => setShowPopup(true)} // Mostra il popup
                class="fixed bottom-[98px] right-4 w-16 h-16 bg-red-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-red-600"
            >
                <img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
            </button>

            {/* Popup per aggiungere una nuova spesa */}
            {showPopup() && (
                <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg p-6 w-96 relative">
                        <button
                            onClick={() => setShowPopup(false)}
                            class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
                        >
                            <img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
                        </button>

                        <h2 class="text-lg font-bold mb-4 text-center">Nuova spesa</h2>

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

