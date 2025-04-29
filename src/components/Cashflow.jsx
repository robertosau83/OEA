import { createSignal, createEffect, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Cashflow = ({ companyId, setCash, cashflow, setCashflow, budget }) => {
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
	const [showEditPopup, setShowEditPopup] = createSignal(true);
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

	// funzione di formattazione dei numeri 
	const formatEuro = (value, fixedDecimals = false) => {
		if (value === null || value === undefined || isNaN(value)) {
			console.warn("❗️Valore non valido in formatEuro:", value);
			return "–";
		}

		// Arrotonda il valore
		const roundedValue = fixedDecimals
			? value.toFixed(2)
			: Math.round(value).toString();

		// Divide parte intera e decimale
		const [intPart, decPart] = roundedValue.split('.');

		// Aggiunge separatore migliaia manualmente
		const intWithSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

		// Ritorna il formato corretto
		return decPart !== undefined
			? `${intWithSeparators},${decPart}`
			: intWithSeparators;
	};

	// Calcola spese_puntuali per una singola istanza di budget
	const computeSpesePuntuali = (b) => {
		const currentDate = new Date();
		const instanceYear = b.anno_rif;
		const instanceMonth = b.mese_rif; // 1-12
		const totalSpese = b.spese; // budget delle spese
		const endOfMonth = new Date(instanceYear, instanceMonth, 0);
		if (
			instanceYear < currentDate.getFullYear() ||
			(instanceYear === currentDate.getFullYear() && instanceMonth < currentDate.getMonth() + 1)
		) {
			return totalSpese;
		} else if (
			instanceYear > currentDate.getFullYear() ||
			(instanceYear === currentDate.getFullYear() && instanceMonth > currentDate.getMonth() + 1)
		) {
			return 0;
		} else {
			const daysPassed = currentDate.getDate();
			const totalDays = endOfMonth.getDate();
			return Math.round(totalSpese * (daysPassed / totalDays));
		}
	};

	// Elaborazione del budget per le spese
	const computedBudgetForSpese = () =>
		budget().map(b => ({
			...b,
			spese_puntuali: computeSpesePuntuali(b)
		}));

	// Helper per trovare il record di budget (per le spese) corrispondente a un determinato mese (chiave "YYYY-MM")
	const findBudgetForKey = (key) => {
		return groupBudgetByMonthForSpese().find((item) => item.key === key);
	};

	//verifica se l'anno passato come parametro ha tutte le istanze mensili con confronto di budget
	const inputYearHasCompleteBudget = (year) => {
		// Estrai i mesi unici presenti in chiusureConSpese per l'anno specificato
		const monthsInChiusure = new Set(
			cashflow()
				.filter(entry => new Date(entry.data_operazione).getFullYear() === parseInt(year))
				.map(entry => new Date(entry.data_operazione).getMonth() + 1) // Ottieni il mese (1-12)
		);

		// Verifica che per ogni mese presente in chiusureConSpese ci sia un corrispondente in budget
		return [...monthsInChiusure].every(month =>
			computedBudgetForSpese().some(b => b.anno_rif === parseInt(year) && b.mese_rif === month)
		);
	};

	//verifica se tutti gli anni presenti sono completi a livello di budget
	const everyYearHasCompleteBudget = () => {
		// Estrai gli anni unici presenti in chiusureConSpese
		const yearsInChiusure = new Set(
			cashflow().map(entry => new Date(entry.data_operazione).getFullYear())
		);

		// Controlla se per ogni anno in chiusureConSpese il budget è completo
		return [...yearsInChiusure].every(year => inputYearHasCompleteBudget(year));
	};

	//verifica se l'anno passato come parametro ha almeno 1 mese con confronto di budget
	const inputYearHasAtLeastOneMonthBudget = (year) => {
		// Estrai i mesi presenti in chiusureConSpese per l'anno specificato
		const monthsInChiusure = new Set(
			cashflow()
				.filter(entry => new Date(entry.data_operazione).getFullYear() === parseInt(year))
				.map(entry => new Date(entry.data_operazione).getMonth() + 1) // Ottieni il mese (1-12)
		);

		// Controlla se almeno un mese ha un corrispondente in budget
		return [...monthsInChiusure].some(month =>
			computedBudgetForSpese().some(b => b.anno_rif === parseInt(year) && b.mese_rif === month)
		);
	};

	//verifica se esiste almeno 1 anno con budget completo per ogni suo mese
	const thereIsAtLeastOneYearWithCompleteBudget = () => {
		// Estrai gli anni unici presenti in chiusureConSpese
		const yearsInChiusure = new Set(
			cashflow().map(entry => new Date(entry.data_operazione).getFullYear())
		);

		// Controlla se almeno un anno ha un budget completo
		return [...yearsInChiusure].some(year => inputYearHasCompleteBudget(year));
	};

	// Raggruppa il budget delle spese per anno
	const groupBudgetByYearForSpese = () => {
		const grouped = {};
		computedBudgetForSpese().forEach(b => {
			const year = b.anno_rif;
			if (!grouped[year]) grouped[year] = 0;
			grouped[year] += b.spese_puntuali;
		});
		return Object.entries(grouped)
			.sort(([a], [b]) => b - a)
			.map(([year, total]) => [year, total]);
	};

	// Raggruppa il budget delle spese per mese (chiave "YYYY-MM")
	const groupBudgetByMonthForSpese = () => {
		const grouped = {};
		computedBudgetForSpese().forEach(b => {
			const key = `${b.anno_rif}-${String(b.mese_rif).padStart(2, '0')}`;
			if (!grouped[key]) grouped[key] = 0;
			grouped[key] += b.spese_puntuali;
		});
		return Object.entries(grouped)
			.sort(([a], [b]) => new Date(a + "-01") - new Date(b + "-01"))
			.map(([key, total]) => ({ key, total }));
	};

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

	// 1. Aggiungi la funzione helper
	const isExcluded = (entry) =>
		["Storno", "Trasf CASH -> CC", "Trasf CC -> CASH"].includes(entry.tipo);

	// 2. Modifica groupByYear
	const groupByYear = () => {
		const grouped = {};
		filteredCashflow().forEach((entry) => {
			const year = new Date(entry.data_operazione).getFullYear();
			if (!grouped[year]) {
				grouped[year] = 0;
			}
			// Aggiungi l'importo solo se il movimento non è escluso
			if (!isExcluded(entry)) {
				grouped[year] += entry.importo;
			}
		});

		return Object.entries(grouped)
			.sort(([a], [b]) => b - a)
			.map(([year, total]) => [year, total]);
	};

	// 3. Modifica groupByMonth
	const groupByMonth = () => {
		const grouped = {};
		filteredCashflow()
			.filter(
				(entry) =>
					new Date(entry.data_operazione).getFullYear() === parseInt(selectedYear())
			)
			.forEach((entry) => {
				const monthKey = new Date(entry.data_operazione).toISOString().slice(0, 7);
				if (!grouped[monthKey]) {
					grouped[monthKey] = 0;
				}
				if (!isExcluded(entry)) {
					grouped[monthKey] += entry.importo;
				}
			});

		return Object.entries(grouped)
			.sort(([keyA], [keyB]) => new Date(`${keyA}-01`) - new Date(`${keyB}-01`))
			.map(([monthKey, total]) => {
				const monthLabel = new Date(`${monthKey}-01`).toLocaleString('default', {
					month: 'long',
					year: 'numeric',
				});
				return { formattedMonth: monthLabel, total, key: monthKey };
			});
	};

	// 4. Modifica groupByDate
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
				// Incrementa il totale solo se il movimento non è escluso
				if (!isExcluded(entry)) {
					acc[date].total += entry.importo;
				}
				acc[date].spese.push(entry);
				return acc;
			}, {});

		return Object.entries(grouped).sort(([dateA], [dateB]) => {
			return new Date(dateA).getTime() - new Date(dateB).getTime();
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
			company_id: companyId,
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
		<div class="flex flex-col h-full px-2 pb-2">

			{/* Tag selezionabili */}
			{view() !== 'singleDetail' && (
				<div class="fixed flex items-center justify-center top-[138px] left-0 gap-8 w-full">
					{/* Primo gruppo di tag (CC / CASH) */}
					<div class="flex justify-center gap-1">
						<button
							class={`w-[65px] text-xs px-4 py-2 rounded-l-full shadow-md border ${selectedGr1Tag() === "CC" ? "bg-blue-800 text-white" : "bg-white text-gray-700"}`}
							onClick={() => setSelectedGr1Tag(selectedGr1Tag() === "CC" ? "" : "CC")}
						>
							CC
						</button>
						<button
							class={`w-[65px] text-xs px-4 py-2 rounded-r-full shadow-md border ${selectedGr1Tag() === "CASH" ? "bg-blue-800 text-white" : "bg-white text-gray-700"}`}
							onClick={() => setSelectedGr1Tag(selectedGr1Tag() === "CASH" ? "" : "CASH")}
						>
							CASH
						</button>
					</div>

					{/* Secondo gruppo di tag (Entrate / Uscite) */}
					<div class="flex justify-center gap-1">
						<button
							class={`w-[65px] text-xs px-4 py-2 rounded-l-full shadow-md border ${selectedGr2Tag() === "entrate" ? "bg-green-800 text-white" : "bg-white text-gray-700"}`}
							onClick={() => setSelectedGr2Tag(selectedGr2Tag() === "entrate" ? "" : "entrate")}
						>
							Entrate
						</button>
						<button
							class={`w-[65px] text-xs px-4 py-2 rounded-r-full shadow-md border ${selectedGr2Tag() === "uscite" ? "bg-red-800 text-white" : "bg-white text-gray-700"}`}
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
					<h2 class="flex flex-none text-gray-600 items-center justify-center h-[55px] text-lg font-semibold mb-16 mt-2">
						Cashflow annuale
					</h2>

					{selectedGr2Tag() === "uscite" && !selectedGr1Tag() && thereIsAtLeastOneYearWithCompleteBudget() ? (
						<div class="flex-none flex items-center justify-end px-4 h-[15px]">
							<div class="flex items-center justify-end text-[10px] italic w-[70px] text-gray-500 mr-2">
								Var BDG
							</div>
						</div>
					) : (
						<div class="flex-none flex items-center justify-end px-4 h-[15px]">
						</div>
					)}

					<ul class="flex-grow overflow-y-auto pb-40">
						{groupByYear().map(([year, total]) => {
							// Recupera il budget delle spese per l'anno corrente
							const budgetYearEntry = groupBudgetByYearForSpese().find(([yr]) => yr == year);
							const budgetTotal = budgetYearEntry ? budgetYearEntry[1] : 0;
							// Poiché le spese sono valori negativi, usiamo il valore assoluto per il confronto
							const diff = budgetTotal - Math.abs(total);
							const diffColor = diff >= 0 ? "text-green-600" : "text-red-600";
							const diffFormatted =
								diff >= 0
									? `+${formatEuro(diff)} €`
									: `${formatEuro(diff)} €`;

							return (
								<li
									class="py-2 px-4 border-b cursor-pointer bg-white border border-gray-400 mb-2 rounded-lg shadow-md font-bold"
									onClick={() => {
										setSelectedYear(year);
										setView('month');
									}}
								>
									<div class="flex justify-between items-center">
										<span>{year}</span>
										<div class="flex items-center">
											<span class={`${total > 0 ? "text-green-600" : "text-red-600"}`}>
												{formatEuro(total)} €
											</span>
											{selectedGr2Tag() === "uscite" && !selectedGr1Tag() && thereIsAtLeastOneYearWithCompleteBudget() && (
												<span class={`flex items-center justify-end w-[90px] text-xs italic font-light ${diffColor}`}>
													{inputYearHasCompleteBudget(year) && `(${diffFormatted})`}
												</span>
											)}
										</div>
									</div>
								</li>
							);
						})}

						{/* Totale complessivo di tutti gli anni */}
						{(() => {
							const totalExpense = groupByYear().reduce((sum, [, total]) => sum + total, 0);
							const totalBudget = groupBudgetByYearForSpese().reduce((sum, [, bTotal]) => sum + bTotal, 0);
							const overallDiff = totalBudget + totalExpense;
							return (
								<li class="py-2 px-4 font-semibold">
									<div class="flex justify-end items-center">
										<span class={`${totalExpense > 0 ? "text-green-800" : "text-red-800"} font-bold`}>
											{formatEuro(totalExpense)} €
										</span>
										{selectedGr2Tag() === "uscite" && !selectedGr1Tag() && thereIsAtLeastOneYearWithCompleteBudget() && (
											<div class="flex items-center justify-end w-[90px]">
												{everyYearHasCompleteBudget() && (
													<span class={`text-xs italic ${overallDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
														({overallDiff >= 0 ? '+' : ''}{formatEuro(overallDiff)} €)
													</span>
												)}
											</div>
										)}
									</div>
								</li>
							);
						})()}
					</ul>
				</div>
			)}



			{/* View delle spese per mese */}
			{view() === 'month' && (
				<div class="flex flex-col h-full">
					<div class="flex flex-none justify-between h-[55px] mb-16 mt-2">
						<button class="w-[40px] font-bold text-black rounded" onClick={() => setView('year')}>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div class="text-gray-600">
							<div class="text-lg text-center font-semibold">CashFlow Mensile</div>
							<div class="text-center">{selectedYear()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					{selectedGr2Tag() === "uscite" && !selectedGr1Tag() && inputYearHasAtLeastOneMonthBudget(selectedYear()) ? (
						<div class="flex-none flex items-center justify-end px-4 h-[15px]">
							<div class="flex items-center justify-end text-[10px] italic w-[70px] text-gray-500 mr-2">
								Var BDG
							</div>
						</div>
					) : (
						<div class="flex-none flex items-center justify-end px-4 h-[15px]">
						</div>
					)}

					<ul class="flex-grow overflow-y-auto pb-40">
						{groupByMonth().map(({ formattedMonth, total, key }) => {
							// Usa formattedMonth, total e key qui
							// Ad esempio:
							const budgetRecord = findBudgetForKey(key);
							//console.log("bbbb",budgetRecord);
							const budgetValue = budgetRecord ? budgetRecord.total : 0;
							//console.log("aaaa",budgetValue);
							const diff = budgetValue - Math.abs(total);
							const diffColor = diff >= 0 ? "text-green-600" : "text-red-600";
							const diffFormatted =
								diff >= 0
									? `+${formatEuro(diff)} €`
									: `${formatEuro(diff)} €`;

							return (
								<li
									key={key}
									class="py-2 px-4 border-b cursor-pointer bg-white border border-gray-400 mb-2 rounded-lg shadow-md font-semibold"
									onClick={() => {
										setSelectedMonth(formattedMonth);
										setView('day');
									}}
								>
									<div class="flex justify-between items-center">
										<span>{formattedMonth}</span>
										<div class="flex items-center">
											<span class={`${total > 0 ? "text-green-600" : "text-red-600"}`}>
												{formatEuro(total)} €
											</span>
											{selectedGr2Tag() === "uscite" && !selectedGr1Tag() && inputYearHasAtLeastOneMonthBudget(selectedYear()) && (
												<span class={`ml-2 flex items-center justify-end w-[90px] text-xs italic font-light ${diffColor}`}>
													{findBudgetForKey(key) && `(${diffFormatted})`}
												</span>
											)}
										</div>
									</div>
								</li>
							);
						})}


						{/* Totale complessivo di tutti i mesi */}
						{(() => {
							// 1) Otteniamo l'array dei mesi
							const months = groupByMonth(); // [{ formattedMonth, total, key }, ...]
							// 2) Somma delle spese effettive (i movimenti in "month")
							const sumOfTotals = months.reduce((acc, { total }) => acc + total, 0);
							// 3) Somma del budget spese puntuali per questi mesi
							const sumOfBudget = months.reduce((acc, { key }) => {
								const spesePuntuale = findBudgetForKey(key)?.total || 0;
								return acc + spesePuntuale;
							}, 0);

							// 4) Differenza complessiva (stessa logica usata nelle singole righe: total - spese_puntuale)
							//    ma sommata su tutti i mesi
							const sumOfDiff = sumOfTotals + sumOfBudget;

							return (
								<li class="py-2 px-4 font-semibold">
									<div class="flex justify-end items-center gap-2">
										{/* Mostra la somma effettiva di tutti i movimenti (negativa se sono spese) */}
										<span
											class={`${sumOfTotals > 0 ? "text-green-800" : "text-red-800"
												} font-bold`}
										>
											{formatEuro(sumOfTotals)} €
										</span>

										{/* Se siamo in "uscite" e non c’è filtro su CC/CASH, mostra la differenza rispetto al budget */}
										{selectedGr2Tag() === "uscite" && !selectedGr1Tag() && inputYearHasAtLeastOneMonthBudget(selectedYear()) && (
											<div class="flex items-center justify-end w-[90px]">
												{inputYearHasCompleteBudget(selectedYear()) && (
													<div class={`text-xs italic ${sumOfDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
														(
														{sumOfDiff >= 0 ? "+" : ""}
														{formatEuro(sumOfDiff)}{" "}
														€)
													</div>
												)}
											</div>
										)}
									</div>
								</li>
							);
						})()}


					</ul>
				</div>
			)}


			{/* View delle spese giornaliere */}
			{view() === 'day' && (
				<div class="flex flex-col h-full">

					<div class="flex flex-none justify-between h-[55px] mb-[79px] mt-2">
						<button class="w-[40px] font-bold text-black rounded" onClick={() => setView('month')}>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div class="text-gray-600">
							<div class="text-lg text-center font-semibold">Cashflow giornaliero</div>
							<div class="text-center">{selectedMonth()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					<ul class="flex-grow overflow-y-auto pb-40">
						{groupByDate().map(([date, { total, spese }]) => (
							<li
								class="mx-2 py-2 px-4 border-b cursor-pointer bg-white border border-gray-400 mb-2 rounded-lg shadow-md"
								onClick={() => {
									setSelectedDay(date);
									setView('details');
								}}
							>
								<div class="flex justify-between">
									<span>{new Date(date).toLocaleDateString()}</span>
									<span class={`${total > 0 ? "text-green-600" : "text-red-600"}`}>
										{formatEuro(total)} €
									</span>
								</div>
							</li>
						))}

						{/* Totale complessivo del mese selezionato */}
						<li class="py-2 px-4 font-semibold">
							<div class="flex justify-end">
								<span class={`${groupByDate().reduce((sum, [, { total }]) => sum + total, 0) > 0 ? "text-green-800" : "text-red-800"} font-bold`}>
									{formatEuro(groupByDate().reduce((sum, [, { total }]) => sum + total, 0))} €
								</span>
							</div>
						</li>
					</ul>

				</div>
			)}

			{/* View di dettaglio per un giorno */}
			{view() === 'details' && (
				<div class="flex flex-col h-full">

					<div class="flex flex-none justify-between h-[55px] mb-[79px] mt-2">
						<button
							class="w-[40px] font-bold text-black rounded"
							onClick={() => setView('day')}
						>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div class="text-gray-600">
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
											{formatEuro(getCashMovements()
												.filter((entry) => !isExcluded(entry))
												.reduce((sum, entry) => sum + entry.importo, 0)
												, true)} €
										</span>
										<span class="text-blue-800">)</span>
									</h3>
								</div>

								<table class="w-full text-sm text-gray-700">
									<tbody>
										{getCashMovements().map((entry) => (
											<tr class={`flex items-center justify-center border-b h-[40px] ${isExcluded(entry) ? "italic opacity-50" : ""}`}
												onClick={() => {
													setSelectedMovement(entry); // Salva la spesa selezionata
													//console.log(selectedMovement());
													setSelectedMovementId(entry.id);
													setView('singleDetail'); // Passa alla view "singleDetail"
												}}>
												<td class="text-black px-2 py-1 w-[40%] min-w-[40%]">{entry.tipo || '-'}</td>
												<td class="w-full text-[10px] px-2 py-1">{entry.descrizione || '-'}</td>
												<td class={`px-2 py-1 w-[25%] min-w-[80px] text-right ${entry.importo > 0 ? "text-green-600" : "text-red-600"} whitespace-nowrap`}>
													{formatEuro(entry.importo, true)} €
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
											{formatEuro(getCCMovements()
												.filter((entry) => !isExcluded(entry))
												.reduce((sum, entry) => sum + entry.importo, 0)
												, true)} €
										</span>
										<span class="text-blue-800">)</span>
									</h3>
								</div>
								<table class="w-full text-sm text-gray-700">
									<tbody>
										{getCCMovements().map((entry) => (
											<tr class={`flex items-center justify-center border-b h-[40px] ${isExcluded(entry) ? "italic opacity-50" : ""}`}
												onClick={() => {
													setSelectedMovement(entry); // Salva la spesa selezionata
													setSelectedMovementId(entry.id);
													setView('singleDetail'); // Passa alla view "singleDetail"
												}}>
												<td class="text-black px-2 py-1 w-[40%] min-w-[40%]">{entry.tipo || '-'}</td>
												<td class="w-full text-[10px] px-2 py-1 line-clamp-1">{entry.descrizione || '-'}</td>
												<td class={`px-2 py-1 w-[25%] min-w-[80px] text-right ${entry.importo > 0 ? "text-green-600" : "text-red-600"} whitespace-nowrap`}>
													{formatEuro(entry.importo, true)} €
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
									`${getCashMovements().filter((entry) => !isExcluded(entry)).reduce((sum, entry) => sum + entry.importo, 0) +
										getCCMovements().filter((entry) => !isExcluded(entry)).reduce((sum, entry) => sum + entry.importo, 0) > 0 ? "text-green-800" : "text-red-800"} font-bold`}>
									{formatEuro(
										getCashMovements().filter((entry) => !isExcluded(entry)).reduce((sum, entry) => sum + entry.importo, 0) + getCCMovements().filter((entry) => !isExcluded(entry)).reduce((sum, entry) => sum + entry.importo, 0)
										, true)} €
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
							class="w-[40px] font-bold text-black rounded"
							onClick={() => setView('details')} // Torna alla view "details"
						>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div class="text-gray-600">
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
								{formatEuro(selectedMovement().importo, true)} €
							</div>
						</div>
						<div class="mb-4">
							<div class="font-semibold">Descrizione</div>
							<div class="text-gray-700">{selectedMovement().descrizione || '-'}</div>
						</div>
					</div>

					{/* Pulsanti di azione */}
					{selectedMovement().origin === "CASH" && selectedMovement().tipo !== "Storno" && (
						<div class="flex justify-around pt-4 pb-8 h-[56]">
							{/* Bottone Cancella */}
							<button
								onClick={() => setShowDeletePopup(true)} // Mostra il popup di conferma
								class="px-4 py-2 w-32 bg-red-700 text-white font-semibold rounded-lg shadow-lg shadow-gray-400 "
							>
								CANCELLA
							</button>

							{/* Bottone Modifica */}
							<button
								onClick={openEditPopup}
								class="px-4 py-2 w-32 bg-yellow-500 text-white font-semibold rounded-lg shadow-lg shadow-gray-400 "
							>
								MODIFICA
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
					class="fixed bottom-6 right-6 w-16 h-16 bg-blue-800 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center"
				>
					<img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
				</button>
			)}

			{/* Popup per aggiungere una nuova spesa */}
			{showAddPopup() && (
				<div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300">
					<div class="bg-gradient-to-b from-blue-200 to-blue-50 text-gray-800 rounded-lg p-6 w-[90%] max-w-[400px] relative transform transition-all duration-300 ease-out translate-y-full opacity-0 animate-slidein">

						<button
							onClick={() => setShowAddPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-bold mb-6 text-center text-gray-800">
							Nuovo movimento CASH
						</h2>

						{/* Sezione per selezionare la direzione del movimento */}
						<div class="flex justify-center gap-1 mb-4">
							<button
								type="button"
								class={`px-4 py-2 w-[140px] rounded-l-full shadow-lg ${newMovementDirection() === 'entrata'
									? 'bg-green-200 text-green-800 font-semibold'
									: 'bg-white text-gray-700'
									}`}
								onClick={() => setNewMovementDirection('entrata')}
							>
								IN ENTRATA
							</button>
							<button
								type="button"
								class={`px-4 py-2 w-[140px] rounded-r-full shadow-lg ${newMovementDirection() === 'uscita'
									? 'bg-red-200 text-red-800 font-semibold'
									: 'bg-white text-gray-700'
									}`}
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
							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">
									Data Competenza
								</label>
								<input
									type="date"
									value={newCashMovement().data_operazione || ''}
									onInput={(e) =>
										setNewCashMovement({
											...newCashMovement(),
											data_operazione: e.currentTarget.value,
										})
									}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg"
								/>
							</div>

							{/* Campo Tipo */}
							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">
									Tipo
								</label>
								<select
									value={newCashMovement().tipo}
									onInput={(e) =>
										setNewCashMovement({
											...newCashMovement(),
											tipo: e.currentTarget.value,
										})
									}
									class="rounded-lg px-3 py-1 text-center shadow-lg w-full"
								>
									<option value="" disabled>Seleziona tipo</option>
									{newMovementDirection() === 'entrata'
										? ["Deposito", "Altro..."].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))
										: ["Acquisti attività", "Attrezzature / Manutenzione", "Commercialista", "Dipendenti", "Eventi", "Fornitori", "Prelievi/Spese personali", "Spese bancarie", "Tasse", "Utenze", "Altro..."].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))}
								</select>
							</div>

							{/* Campo Metodo di pagamento */}
							<div class="flex flex-col items-center mb-7">
								<label class="block font-medium mb-1 text-center">
									Metodo di pagamento
								</label>
								<select
									value={newCashMovement().metodo_di_pagamento}
									onInput={(e) =>
										setNewCashMovement({
											...newCashMovement(),
											metodo_di_pagamento: e.currentTarget.value,
										})
									}
									class="rounded-lg px-3 py-1 text-center shadow-lg w-full"
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

							{/* Campo Importo */}
							<div class="flex justify-between items-center mb-4">
								<label class="flex items-center justify-start font-medium">Importo</label>
								<div class="flex">
									<input
										type="text"
										value={newCashMovement().importo !== '' ? newCashMovement().importo : ''}
										onInput={(e) => {
											const input = e.currentTarget.value;
											let sanitizedInput = input.replace('.', ',');
											sanitizedInput = sanitizedInput.replace(/[^0-9,]/g, '');
											setNewCashMovement({ ...newCashMovement(), importo: sanitizedInput });
										}}
										class={`rounded-lg px-3 py-1 text-center text-lg shadow-lg w-24 ${/^[0-9]*,?[0-9]*$/.test(newCashMovement().importo) ? '' : 'text-red-500'
											}`}
									/>
									<label class="flex items-center justify-end font-medium w-4">€</label>
								</div>
							</div>

							{/* Campo Descrizione */}
							<div class="flex flex-col items-center mb-8">
								<label class="block font-medium mb-1 text-center">
									Descrizione
								</label>
								<input
									type="text"
									value={newCashMovement().descrizione || ''}
									onInput={(e) =>
										setNewCashMovement({
											...newCashMovement(),
											descrizione: e.currentTarget.value,
										})
									}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg w-full"
								/>
							</div>

							{/* Bottone Salva */}
							<div class="flex justify-center mt-8 w-full">
								<button
									type="submit"
									class="px-4 py-2 w-full text-xl bg-blue-800 text-white font-semibold rounded-lg shadow-lg shadow-gray-500"
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
				<div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
					<div class="bg-gradient-to-b from-red-200 to-red-50 rounded-lg p-6 w-[90%] max-w-[400px] relative">
						<button
							onClick={() => setShowDeletePopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="w-7 h-auto" />
						</button>
						<h2 class="text-lg font-semibold mt-4 mb-4 text-center text-gray-800">
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
								class="px-4 py-2 w-full bg-red-800 text-white font-bold rounded-lg shadow-lg shadow-gray-400"
							>
								CONFERMA
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Popup per modificare una spesa */}
			{showEditPopup() && (
				<div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300">
					<div class="bg-gradient-to-b from-yellow-200 to-yellow-50 text-gray-800 rounded-lg p-6 w-[90%] max-w-[400px] relative transform transition-all duration-300 ease-out translate-y-full opacity-0 animate-slidein">

						<button
							onClick={() => setShowEditPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-bold mb-6 text-center">
							Modifica Movimento CASH
						</h2>

						{/* Sezione per selezionare la direzione del movimento */}
						<div class="flex justify-center gap-1 mb-4">
							<button
								type="button"
								class={`px-4 py-2 w-[140px] rounded-l-full shadow-lg ${editMovementDirection() === 'entrata'
										? 'bg-green-200 text-green-800 font-semibold'
										: 'bg-white text-gray-700'
									}`}
								onClick={() => {
									setEditMovementDirection('entrata');
									setEditCashMovement({ ...editCashMovement(), tipo: '', metodo_di_pagamento: '' });
								}}
							>
								IN ENTRATA
							</button>
							<button
								type="button"
								class={`px-4 py-2 w-[140px] rounded-r-full shadow-lg ${editMovementDirection() === 'uscita'
										? 'bg-red-200 text-red-800 font-semibold'
										: 'bg-white text-gray-700'
									}`}
								onClick={() => {
									setEditMovementDirection('uscita');
									setEditCashMovement({ ...editCashMovement(), tipo: '', metodo_di_pagamento: '' });
								}}
							>
								IN USCITA
							</button>
						</div>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								await updateCashMovement();
								setShowEditPopup(false);
							}}
						>

							{/* Campo Data Competenza */}
							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">
									Data Competenza
								</label>
								<input
									type="date"
									value={editCashMovement().data_operazione || ''}
									onInput={(e) =>
										setEditCashMovement({
											...editCashMovement(),
											data_operazione: e.currentTarget.value,
										})
									}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg"
								/>
							</div>

							{/* Campo Tipo */}
							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">
									Tipo
								</label>
								<select
									value={editCashMovement().tipo || ''}
									onInput={(e) =>
										setEditCashMovement({
											...editCashMovement(),
											tipo: e.currentTarget.value,
										})
									}
									class="rounded-lg px-3 py-1 text-center shadow-lg w-full"
								>
									<option value="" disabled>Seleziona tipo</option>
									{editMovementDirection() === 'entrata'
										? ["Deposito", "Altro..."].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))
										: ["Acquisti attività", "Attrezzature / Manutenzione", "Commercialista", "Dipendenti", "Eventi", "Fornitori", "Prelievi/Spese personali", "Spese bancarie", "Tasse", "Utenze", "Altro..."].map((option) => (
											<option value={option} key={option}>
												{option}
											</option>
										))}
								</select>
							</div>

							{/* Campo Metodo di pagamento */}
							<div class="flex flex-col items-center mb-7">
								<label class="block font-medium mb-1 text-center">
									Metodo di pagamento
								</label>
								<select
									value={editCashMovement().metodo_di_pagamento || ''}
									onInput={(e) =>
										setEditCashMovement({
											...editCashMovement(),
											metodo_di_pagamento: e.currentTarget.value,
										})
									}
									class="rounded-lg px-3 py-1 text-center shadow-lg w-full"
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

							{/* Campo Importo */}
							<div class="flex justify-between items-center mb-4">
								<label class="flex items-center justify-start font-medium">Importo</label>
								<div class="flex">
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
										class={`rounded-lg px-3 py-1 text-center text-lg shadow-lg w-24 ${editMovementDirection() === 'entrata'
												? 'text-green-600'
												: editMovementDirection() === 'uscita'
													? 'text-red-600'
													: ''
											}`}
									/>
									<label class="flex items-center justify-end font-medium w-4">€</label>
								</div>
							</div>

							{/* Campo Descrizione */}
							<div class="flex flex-col items-center mb-8">
								<label class="block font-medium mb-1 text-center">
									Descrizione
								</label>
								<input
									type="text"
									value={editCashMovement().descrizione || ''}
									onInput={(e) =>
										setEditCashMovement({
											...editCashMovement(),
											descrizione: e.currentTarget.value,
										})
									}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg w-full"
								/>
							</div>

							{/* Bottone Salva */}
							<div class="flex justify-center mt-8 w-full">
								<button
									type="submit"
									class="px-4 py-2 w-full text-xl bg-blue-800 text-white font-semibold rounded-lg shadow-lg shadow-gray-500"
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

