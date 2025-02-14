import { createSignal, createEffect, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Cashflow = ({ setCash, cashflow, setCashflow }) => {
	//const [spese, setSpese] = createSignal([]); // Stato locale per le spese
	const [view, setView] = createSignal('year'); // 'month' | 'day' | 'details'
	const [selectedYear, setSelectedYear] = createSignal(''); // Stato per l'anno selezionato
	const [selectedMonth, setSelectedMonth] = createSignal('');
	const [selectedDay, setSelectedDay] = createSignal('');
	const [selectedMovement, setSelectedMovement] = createSignal(null);
	const [selectedMovementId, setSelectedMovementId] = createSignal('');
	const [showAddPopup, setShowAddPopup] = createSignal(false);
	const [newMovementDirection, setNewMovementDirection] = createSignal('');
	const [newCashMovement, setNewCashMovement] = createSignal({
		data_operazione: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Oggi - 1 giorno
		tipo: '',
		metodo_di_pagamento: '',
		importo: '',
		descrizione: '',
	});
	const [showDeletePopup, setShowDeletePopup] = createSignal(false);
	const [showEditPopup, setShowEditPopup] = createSignal(false);
	const [editMovementDirection, setEditMovementDirection] = createSignal('');
	const [editCashMovement, setEditCashMovement] = createSignal({
		tipo: '',
		metodo_di_pagamento: '',
		importo: '',
		descrizione: '',
		data_operazione: '', // Aggiunto per permettere la modifica della data
	});
	const [selectedGr1Tag, setSelectedGr1Tag] = createSignal(''); // Stato per il filtro CC/CASH
	const [selectedGr2Tag, setSelectedGr2Tag] = createSignal(''); // Stato per il filtro Entrate/Uscite
	const [filteredCashflow, setFilteredCashflow] = createSignal([]);

	// Aggiorna filteredCashflow ogni volta che cambia cashflow() o selectedGr1Tag()
	createEffect(() => {
		let filtered = cashflow();

		// Filtra per tipo di movimento (CC / CASH)
		if (selectedGr1Tag() === "CC") {
			filtered = filtered.filter(entry => entry.origin === "CC");
		} else if (selectedGr1Tag() === "CASH") {
			filtered = filtered.filter(entry => entry.origin === "CASH" || entry.origin === "CONTANTI CASSA");
		}

		// Filtra per importo (Entrate/Uscite)
		if (selectedGr2Tag() === "entrate") {
			filtered = filtered.filter(entry => entry.importo > 0);
		} else if (selectedGr2Tag() === "uscite") {
			filtered = filtered.filter(entry => entry.importo < 0);
		}

		setFilteredCashflow(filtered);
	});

	// Funzione per raggruppare le spese per anno
	const groupByYear = () => {
		const grouped = {};

		filteredCashflow().forEach((entry) => {
			const year = new Date(entry.data_operazione).getFullYear();
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

		filteredCashflow()
			.filter((entry) => new Date(entry.data_operazione).getFullYear() === parseInt(selectedYear()))
			.forEach((entry) => {
				const monthKey = new Date(entry.data_operazione).toISOString().slice(0, 7); // YYYY-MM
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
		const grouped = filteredCashflow()
			.filter((entry) => {
				const month = new Date(entry.data_operazione).toLocaleString('default', {
					month: 'long',
					year: 'numeric',
				});
				return month === selectedMonth();
			})
			.reduce((acc, entry) => {
				const date = entry.data_operazione;
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
		//console.log(selectedDay(), selectedMovementId());
		return cashflow().find((entry) => entry.data_operazione === selectedDay() && entry.id === selectedMovementId());
	};

	//Funzione che carica solo la parte CASH delle spese
	const getCashMovements = () => {
		return filteredCashflow().filter(
			(entry) => entry.data_operazione === selectedDay() && (entry.origin === "CASH" || entry.origin === "CONTANTI CASSA")
		);
	};

	//Funzione che carica solo la parte CC delle spese
	const getCCMovements = () => {
		return filteredCashflow().filter(
			(entry) => entry.data_operazione === selectedDay() && entry.origin === "CC"
		);
	};

	//Funzione per l'inserimento di una nuovo movimento cash
	const addNewCashMovement = async () => {

		if (!newMovementDirection()) {
			alert("Seleziona se il movimento è IN ENTRATA o IN USCITA.");
			return;
		}

		const { tipo, metodo_di_pagamento, importo } = newCashMovement();

		if (!tipo || !metodo_di_pagamento || !importo) {
			alert("Per favore, compila tutti i campi obbligatori: Tipo, Metodo di pagamento e Importo.");
			return;
		}

		let convertedValue;
		const value = newCashMovement().importo;

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

			// Se il movimento è in uscita, salviamo l'importo negativo,
			// mentre se è in entrata, lo salviamo positivo.
			convertedValue = newMovementDirection() === 'uscita' ? -numericValue : numericValue;
		}

		const sanitizedSpesa = {
			...newCashMovement(),
			importo: convertedValue,
			//origin: "CASH", // Imposta il campo origin
		};

		const { data, error } = await supabase
			.from('CASH')
			.insert([sanitizedSpesa], { returning: 'representation' })
			.select('*');

		if (error) {
			console.error("Errore durante l'inserimento:", error.message);
		} else {
			console.log('Movimento aggiunto con successo:', data);
			setCash((prev) => [...prev, ...(data || [])]);
			setShowAddPopup(false);
		}
	};

	//Funzione per la cancellazione di una spesa esistente
	const deleteCashMovement = async () => {
		const spesaId = selectedMovementId();
		if (!spesaId) return;

		const { error } = await supabase
			.from('CASH')
			.delete()
			.eq('id', spesaId); // Utilizza l'ID per identificare la riga

		if (error) {
			console.error("Errore durante la cancellazione del movimento:", error.message);
		} else {
			console.log('Movimento cancellato con successo');
			setCash((prev) =>
				prev.filter((entry) => entry.id !== spesaId) // Rimuovi la riga dallo stato locale
			);
			setShowDeletePopup(false);
			// Verifica se ci sono ancora spese per il giorno selezionato
			const remainingExpenses = cashflow().filter(
				(entry) => entry.data_operazione === selectedDay()
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
		const spesa = selectedMovement(); // Usa un nome diverso
		if (!spesa) return;

		setEditCashMovement({
			tipo: spesa.tipo,
			metodo_di_pagamento: spesa.metodo_di_pagamento,
			importo: spesa.importo ? spesa.importo.toString().replace('.', ',') : '',
			descrizione: spesa.descrizione,
			data_operazione: spesa.data_operazione,
		});

		// Imposta la direzione in base al segno dell'importo
		setEditMovementDirection(spesa.importo < 0 ? 'uscita' : 'entrata');

		setShowEditPopup(true);
	};

	//Funzione per l'update di una spesa
	const updateCashMovement = async () => {
		const { tipo, metodo_di_pagamento, importo } = editCashMovement();

		//console.log(tipo, metodo_di_pagamento, importo);

		if (!tipo || !metodo_di_pagamento || !importo) {
			alert("Per favore, compila tutti i campi obbligatori: Tipo, Metodo di pagamento e Importo.");
			return;
		}

		const selectedMovement = getDailyDetails();
		if (!selectedMovement) return;

		// Verifica e converte i campi numerici
		let convertedValue;
		const value = editCashMovement().importo;
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

			// Se la direzione è "uscita", l'importo deve essere negativo; altrimenti, positivo
			convertedValue = editMovementDirection() === 'uscita' ? -Math.abs(numericValue) : Math.abs(numericValue);
		}

		// Crea un nuovo oggetto incasso con i campi convertiti
		const spesaToUpdate = {
			...editCashMovement(),
			importo: convertedValue,
		};

		const { error } = await supabase
			.from('CASH')
			.update(spesaToUpdate)
			.eq('id', selectedMovement.id); // Utilizza l'id per identificare la riga

		if (error) {
			console.error("Errore durante l'aggiornamento della spesa:", error.message);
		} else {
			console.log('Spesa aggiornata con successo');
			setCash((prev) =>
				prev.map((entry) =>
					entry.id === selectedMovement.id ? { ...entry, ...spesaToUpdate } : entry
				)
			);

			// Aggiorna anche selectedMovement
			setSelectedMovement({ ...selectedMovement, ...spesaToUpdate });

			// Aggiorna selectedDay, selectedYear e selectedMonth
			const newDate = new Date(spesaToUpdate.data_operazione);
			setSelectedDay(spesaToUpdate.data_operazione);
			setSelectedYear(newDate.getFullYear().toString());
			setSelectedMonth(newDate.toLocaleString('default', { month: 'long', year: 'numeric' }));

			setShowEditPopup(false);
		}
	};

	return (
		<div class="flex flex-col h-full px-2 pt-2">

			{/* Tag selezionabili */}
			{view() !== 'singleDetail' && (
				<div class="fixed flex items-center justify-center top-[138px] left-0 gap-8 w-full">
					{/* Primo gruppo di tag (CC / CASH) */}
					<div class="flex justify-center gap-1">
						<button
							class={`w-[65px] text-xs px-4 py-2 rounded-l-full shadow-md ${selectedGr1Tag() === "CC" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"}`}
							onClick={() => setSelectedGr1Tag(selectedGr1Tag() === "CC" ? "" : "CC")}
						>
							CC
						</button>
						<button
							class={`w-[65px] text-xs px-4 py-2 rounded-r-full shadow-md ${selectedGr1Tag() === "CASH" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-700"}`}
							onClick={() => setSelectedGr1Tag(selectedGr1Tag() === "CASH" ? "" : "CASH")}
						>
							CASH
						</button>
					</div>

					{/* Secondo gruppo di tag (Entrate / Uscite) */}
					<div class="flex justify-center gap-1">
						<button
							class={`w-[65px] text-xs px-4 py-2 rounded-l-full shadow-md ${selectedGr2Tag() === "entrate" ? "bg-green-500 text-white" : "bg-gray-200 text-gray-700"}`}
							onClick={() => setSelectedGr2Tag(selectedGr2Tag() === "entrate" ? "" : "entrate")}
						>
							Entrate
						</button>
						<button
							class={`w-[65px] text-xs px-4 py-2 rounded-r-full shadow-md ${selectedGr2Tag() === "uscite" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700"}`}
							onClick={() => setSelectedGr2Tag(selectedGr2Tag() === "uscite" ? "" : "uscite")}
						>
							Uscite
						</button>
					</div>
				</div>
			)}

			{/* View delle spese per anno */}
			{view() === 'year' && (
				<div class="flex flex-col h-full">

					<h2 class="flex flex-none items-center justify-center h-[55px] text-lg font-semibold mb-16 mt-2">
						Cashflow annuale
					</h2>

					<ul class="flex-grow overflow-y-auto pb-40">
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
									<span class={`${total > 0 ? "text-green-600" : "text-red-600"}`}>
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
								<span class={`${groupByYear().reduce((sum, [, total]) => sum + total, 0) > 0 ? "text-green-800" : "text-red-800"} font-bold`}>
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
				<div class="flex flex-col h-full">

					<div class="flex flex-none justify-between h-[55px] mb-16 mt-2">
						<button class="w-[40px] bg-gray-100 font-bold text-black rounded" onClick={() => setView('year')}>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div>
							<div class="text-lg text-center font-semibold">CashFlow Mensile</div>
							<div class="text-center">{selectedYear()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					<ul class="flex-grow overflow-y-auto pb-40">
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
									<span class={`${total > 0 ? "text-green-600" : "text-red-600"}`}>
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
								<span class={`${groupByMonth().reduce((sum, [, total]) => sum + total, 0) > 0 ? "text-green-800" : "text-red-800"} font-bold`}>
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
				<div class="flex flex-col h-full">

					<div class="flex flex-none justify-between h-[55px] mb-16 mt-2">
						<button class="w-[40px] bg-gray-100 font-bold text-black rounded" onClick={() => setView('month')}>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div>
							<div class="text-lg text-center font-semibold">Cashflow giornaliero</div>
							<div class="text-center">{selectedMonth()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					<ul class="flex-grow overflow-y-auto pb-40">
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
									<span class={`${total > 0 ? "text-green-600" : "text-red-600"}`}>
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
								<span class={`${groupByDate().reduce((sum, [, { total }]) => sum + total, 0) > 0 ? "text-green-800" : "text-red-800"} font-bold`}>
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
				<div class="flex flex-col h-full">

					<div class="flex flex-none justify-between h-[55px] mb-16 mt-2">
						<button
							class="w-[40px] bg-gray-100 font-bold text-black rounded"
							onClick={() => setView('day')}
						>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div>
							<div class="text-lg text-center font-semibold">Dettaglio Cashflow</div>
							<div class="text-center">{new Date(selectedDay()).toLocaleDateString()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					<div class="flex-grow overflow-y-auto pb-40">
						{/* Sezione "CASH" */}
						{getCashMovements().length > 0 && (
							<div>
								<div class="flex items-center mb-2">
									<h3 class="flex font-semibold text-blue-800">
										Movimenti CASH
										<span class="text-blue-800 ml-2">(</span>
										<span class={`${getCashMovements().reduce((sum, entry) => sum + entry.importo, 0) > 0 ? "text-green-700" : "text-red-700"} font-semibold`}>
											{new Intl.NumberFormat('it-IT', {
												style: 'decimal',
												maximumFractionDigits: 0,
											}).format(
												getCashMovements().reduce((sum, entry) => sum + entry.importo, 0)
											)} €
										</span>
										<span class="text-blue-800">)</span>
									</h3>
								</div>

								<table class="w-full text-sm text-gray-700">
									<tbody>
										{getCashMovements().map((entry) => (
											<tr class="flex items-center justify-center border-b h-[40px]"
												onClick={() => {
													setSelectedMovement(entry); // Salva la spesa selezionata
													//console.log(selectedMovement());
													setSelectedMovementId(entry.id);
													setView('singleDetail'); // Passa alla view "singleDetail"
												}}>
												<td class="text-black px-2 py-1 w-[40%] min-w-[40%]">{entry.tipo || '-'}</td>
												<td class="w-full text-[10px] px-2 py-1">{entry.descrizione || '-'}</td>
												<td class={`px-2 py-1 w-[25%] min-w-[80px] text-right ${entry.importo > 0 ? "text-green-600" : "text-red-600"} whitespace-nowrap`}>
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
						{getCCMovements().length > 0 && (
							<div class="mt-6">
								<div class="flex items-center mb-2">
									<h3 class="flex font-semibold text-blue-800">
										Movimenti CC
										<span class="text-blue-800 ml-2">(</span>
										<span class={`${getCCMovements().reduce((sum, entry) => sum + entry.importo, 0) > 0 ? "text-green-700" : "text-red-700"} font-semibold`}>
											{new Intl.NumberFormat('it-IT', {
												style: 'decimal',
												maximumFractionDigits: 0,
											}).format(
												getCCMovements().reduce((sum, entry) => sum + entry.importo, 0)
											)} €
										</span>
										<span class="text-blue-800">)</span>
									</h3>
								</div>
								<table class="w-full text-sm text-gray-700">
									<tbody>
										{getCCMovements().map((entry) => (
											<tr class="flex items-center justify-center border-b h-[40px]"
												onClick={() => {
													setSelectedMovement(entry); // Salva la spesa selezionata
													setSelectedMovementId(entry.id);
													setView('singleDetail'); // Passa alla view "singleDetail"
												}}>
												<td class="text-black px-2 py-1 w-[40%] min-w-[40%]">{entry.tipo || '-'}</td>
												<td class="w-full text-[10px] px-2 py-1 line-clamp-1">{entry.descrizione || '-'}</td>
												<td class={`px-2 py-1 w-[25%] min-w-[80px] text-right ${entry.importo > 0 ? "text-green-600" : "text-red-600"} whitespace-nowrap`}>
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

						{getCashMovements().length > 0 && getCCMovements().length > 0 && (
							<div class="flex justify-end text-lg mr-2 mt-8">
								<span class={
									`${getCashMovements().reduce((sum, entry) => sum + entry.importo, 0) +
										getCCMovements().reduce((sum, entry) => sum + entry.importo, 0) > 0 ? "text-green-800" : "text-red-800"} font-bold`}>
									{new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(
										getCashMovements().reduce((sum, entry) => sum + entry.importo, 0) + getCCMovements().reduce((sum, entry) => sum + entry.importo, 0)
									)} €
								</span>
							</div>
						)}

					</div>

				</div>
			)}

			{view() === 'singleDetail' && selectedMovement() && (

				<div class="flex flex-col h-full">

					<div class="flex flex-none justify-between h-[55px] mb-2 mt-2">
						<button
							class="w-[40px] bg-gray-100 font-bold text-black rounded"
							onClick={() => setView('details')} // Torna alla view "details"
						>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div>
							<div class="text-lg text-center font-semibold">Dettaglio Movimento {selectedMovement().origin === "CC" ? "CC" : "CASH"}</div>
							<div class="text-center">{new Date(selectedDay()).toLocaleDateString()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					<div class="flex-grow px-2 pt-4 overflow-y-auto">
						<div class="mb-4">
							<div class="font-semibold">Tipo</div>
							<div class="text-gray-700">{selectedMovement().tipo || '-'}</div>
						</div>
						{selectedMovement().origin === "CASH" && (
							<div class="mb-4">
								<div class="font-semibold">Metodo di pagamento</div>
								<div class="text-gray-700">{selectedMovement().metodo_di_pagamento || '-'}</div>
							</div>
						)}
						<div class="mb-4">
							<div class="font-semibold">Importo</div>{' '}
							<div class={`${selectedMovement().importo > 0 ? "text-green-600" : "text-red-600"}`}>
								{new Intl.NumberFormat('it-IT', {
									style: 'decimal',
									minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
									maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
								}).format(selectedMovement().importo)} €
							</div>
						</div>
						<div class="mb-4">
							<div class="font-semibold">Descrizione</div>
							<div class="text-gray-700">{selectedMovement().descrizione || '-'}</div>
						</div>
					</div>

					{/* Pulsanti di azione */}
					{selectedMovement().origin === "CASH" && selectedMovement().tipo !== "Quadratura" && (
						<div class="flex justify-around py-4 h-[56]">
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

				</div>
			)}

			{/* Bottone rotondo */}
			{view() !== 'singleDetail' && (
				<button
					onClick={() => {
						// Resetta i campi di newChiusura
						setNewCashMovement({
							data_operazione: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Oggi - 1 giorno
							tipo: '',
							metodo_di_pagamento: '',
							importo: '',
							descrizione: '',
						});
						setNewMovementDirection(''); // reset della direzione
						// Mostra il popup
						setShowAddPopup(true);
					}}
					class="fixed bottom-[106px] right-4 w-16 h-16 bg-blue-500 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center hover:bg-red-600"
				>
					<img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
				</button>
			)}

			{/* Popup per aggiungere una nuova spesa */}
			{showAddPopup() && (
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div class="bg-white rounded-lg p-6 w-[90%] relative">
						<button
							onClick={() => setShowAddPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-semibold mb-4 text-center text-blue-800">Nuovo movimento CASH</h2>

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
								await addNewCashMovement();
							}}
						>

							{/* Campo per la data di competenza */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Data Competenza</label>
								<input
									type="date"
									value={newCashMovement().data_operazione || ''}
									onInput={(e) => setNewCashMovement({ ...newCashMovement(), data_operazione: e.currentTarget.value, })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							{/* Campo Tipo: le opzioni variano in base alla direzione */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Tipo</label>
								<select
									value={newCashMovement().tipo}
									onInput={(e) =>
										setNewCashMovement({
											...newCashMovement(),
											tipo: e.currentTarget.value,
										})
									}
									class="w-full border rounded px-3 py-2"
								>
									<option value="" disabled>Seleziona tipo</option>
									{newMovementDirection() === 'entrata'
										? ["Deposito", "Altro..."].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))
										: ["Acquisti attività", "Attrezzature / Manutenzione", "Commercialista", "Dipendenti", "Fornitori", "Prelievi/Spese personali", "Spese bancarie", "Tasse", "Utenze", "Altro..."].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))}
								</select>
							</div>

							{/* Campo Metodo di pagamento: anche qui le opzioni variano */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Metodo di pagamento</label>
								<select
									value={newCashMovement().metodo_di_pagamento}
									onInput={(e) =>
										setNewCashMovement({
											...newCashMovement(),
											metodo_di_pagamento: e.currentTarget.value,
										})
									}
									class="w-full border rounded px-3 py-2"
								>
									<option value="" disabled>Seleziona metodo di pagamento</option>
									{newMovementDirection() === 'entrata'
										? ["Aggiunti ai cash"].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))
										: ["Presi dalla cassa in serata", "Presi dai cash"].map((option) => (
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
									value={newCashMovement().importo !== '' ? newCashMovement().importo : ''}
									onInput={(e) => {
										const input = e.currentTarget.value;

										// Sostituisci immediatamente "." con ","
										let sanitizedInput = input.replace('.', ',');

										// Rimuovi tutti i caratteri non validi (solo numeri e ",")
										sanitizedInput = sanitizedInput.replace(/[^0-9,]/g, '');

										// Aggiorna lo stato con il valore sanitizzato
										setNewCashMovement({ ...newCashMovement(), importo: sanitizedInput, });
									}}
									class={`w-full border rounded px-3 py-2 ${
										// Validazione: campo è rosso se contiene più di una virgola
										/^[0-9]*,?[0-9]*$/.test(newCashMovement().importo) ? '' : 'text-red-500'
										}`}
								/>
							</div>

							{/* descrizione */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Descrizione</label>
								<input
									type="text"
									value={newCashMovement().descrizione || ''}
									onInput={(e) => setNewCashMovement({ ...newCashMovement(), descrizione: e.currentTarget.value, })}
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
							Verrà cancellato l'attuale movimento registrato in data{' '}
							{new Date(selectedMovement().data_operazione).toLocaleDateString('it-IT')}
						</h2>
						<div class="flex justify-center gap-4 mt-6">
							<button
								onClick={() => {
									setSelectedMovementId(selectedMovement().id); // Imposta l'ID della spesa
									deleteCashMovement(); // Chiama la funzione di cancellazione
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
							onClick={() => setShowEditPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-bold mb-4 text-center">Modifica Movimento CASH</h2>

						{/* Sezione per selezionare la direzione del movimento */}
						<div class="flex justify-center gap-2 mb-4">
							<button
								type="button"
								class={`px-4 py-2 rounded ${editMovementDirection() === 'entrata' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
								onClick={() => {
									setEditMovementDirection('entrata');
									// Resetta i campi "tipo" e "metodo_di_pagamento"
									setEditCashMovement({
										...editCashMovement(),
										tipo: '',
										metodo_di_pagamento: '',
									});
								}}
							>
								IN ENTRATA
							</button>
							<button
								type="button"
								class={`px-4 py-2 rounded ${editMovementDirection() === 'uscita' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}
								onClick={() => {
									setEditMovementDirection('uscita');
									setEditCashMovement({
										...editCashMovement(),
										tipo: '',
										metodo_di_pagamento: '',
									});
								}}
							>
								IN USCITA
							</button>
						</div>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								await updateCashMovement(); // La funzione updateCashMovement usa editMovementDirection per impostare il segno
								setShowEditPopup(false);
							}}
						>
							{/* Campo Data Competenza (modificabile) */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Data Competenza</label>
								<input
									type="date"
									value={editCashMovement().data_operazione || ''}
									onInput={(e) =>
										setEditCashMovement({
											...editCashMovement(),
											data_operazione: e.currentTarget.value,
										})
									}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							{/* Campo Tipo: opzioni condizionali in base alla direzione */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Tipo</label>
								<select
									value={editCashMovement().tipo || ''}
									onInput={(e) =>
										setEditCashMovement({
											...editCashMovement(),
											tipo: e.currentTarget.value,
										})
									}
									class="w-full border rounded px-3 py-2"
								>
									<option value="" disabled>Seleziona tipo</option>
									{editMovementDirection() === 'entrata'
										? ["Deposito", "Altro..."].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))
										: ["Acquisti attività", "Attrezzature / Manutenzione", "Commercialista", "Dipendenti", "Fornitori", "Prelievi/Spese personali", "Spese bancarie", "Tasse", "Utenze", "Altro..."].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))}
								</select>
							</div>

							{/* Campo Metodo di pagamento: opzioni condizionali */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Metodo di pagamento</label>
								<select
									value={editCashMovement().metodo_di_pagamento || ''}
									onInput={(e) =>
										setEditCashMovement({
											...editCashMovement(),
											metodo_di_pagamento: e.currentTarget.value,
										})
									}
									class="w-full border rounded px-3 py-2"
								>
									<option value="" disabled>Seleziona metodo di pagamento</option>
									{editMovementDirection() === 'entrata'
										? ["Aggiunti ai cash"].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))
										: ["Presi dalla cassa in serata", "Presi dai cash"].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))}
								</select>
							</div>

							{/* Campo Importo: mostra sempre il valore assoluto, con colore in base alla direzione */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Importo</label>
								<input
									type="text"
									value={
										editCashMovement().importo
											? Math.abs(parseFloat(editCashMovement().importo.replace(',', '.')) || 0)
												.toString()
												.replace('.', ',')
											: ''
									}
									onInput={(e) => {
										const input = e.currentTarget.value;
										let sanitizedInput = input.replace('.', ',');
										sanitizedInput = sanitizedInput.replace(/[^0-9,]/g, '');
										setEditCashMovement({ ...editCashMovement(), importo: sanitizedInput });
									}}
									class={`w-full border rounded px-3 py-2 ${editMovementDirection() === 'entrata'
										? 'text-green-600'
										: editMovementDirection() === 'uscita'
											? 'text-red-600'
											: ''
										}`}
								/>
							</div>

							{/* Campo Descrizione */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Descrizione</label>
								<input
									type="text"
									value={editCashMovement().descrizione || ''}
									onInput={(e) =>
										setEditCashMovement({
											...editCashMovement(),
											descrizione: e.currentTarget.value,
										})
									}
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

export default Cashflow;

