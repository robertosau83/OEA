import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Chiusure = ({ chiusure, setChiusure, chiusureConSpese, budget }) => {
	const [view, setView] = createSignal('year'); // 'month' | 'day' | 'detail'
	const [selectedYear, setSelectedYear] = createSignal(''); // Anno selezionato
	const [selectedMonth, setSelectedMonth] = createSignal('');
	const [selectedDay, setSelectedDay] = createSignal('');
	const [showAddPopup, setShowAddPopup] = createSignal(false);
	const [newChiusura, setNewChiusura] = createSignal({
		data_competenza: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Oggi - 1 giorno
		battuti_cassa: '',
		carte: '',
		satispay: '',
		contanti_cassa: '',
	});
	const [showDeletePopup, setShowDeletePopup] = createSignal(false);
	const [showEditPopup, setShowEditPopup] = createSignal(false);
	const [editChiusura, setEditChiusura] = createSignal({
		battuti_cassa: 0,
		carte: 0,
		satispay: 0,
		contanti_cassa_netto_spese_serata: 0,
	});
	const [selectedTag, setSelectedTag] = createSignal(''); // Stato per il tag selezionato

	const tagMap = {
		contanti: 'contanti_cassa_lordo_spese_serata',
		carte: 'carte',
		satispay: 'satispay',
		battuti: 'battuti_cassa',
		gap: 'gap',
	};

	onMount(() => {
		//console.log(chiusureConSpese());
	});

	// -------------------------------
	// Nuova logica per elaborare budget() aggiungendo il campo incassi_puntuale
	// -------------------------------

	// Calcola incassi_puntuale per una singola istanza di budget
	const computeIncassiPuntuale = (b) => {
		const currentDate = new Date();
		const instanceYear = b.anno_rif;
		const instanceMonth = b.mese_rif; // 1-12
		const totalIncassi = b.incassi;

		// Data del primo e dell'ultimo giorno del mese
		const startOfMonth = new Date(instanceYear, instanceMonth - 1, 1);
		const endOfMonth = new Date(instanceYear, instanceMonth, 0);

		if (instanceYear < currentDate.getFullYear() ||
			(instanceYear === currentDate.getFullYear() && instanceMonth < currentDate.getMonth() + 1)) {
			// Mese già trascorso
			return totalIncassi;
		} else if (instanceYear > currentDate.getFullYear() ||
			(instanceYear === currentDate.getFullYear() && instanceMonth > currentDate.getMonth() + 1)) {
			// Mese futuro
			return 0;
		} else {
			// Mese in corso: calcola il progressivo in base ai giorni trascorsi
			const daysPassed = currentDate.getDate();
			const totalDays = endOfMonth.getDate();
			return Math.round(totalIncassi * (daysPassed / totalDays));
		}
	};

	// Elaboriamo l'array budget aggiungendo ad ogni istanza il campo incassi_puntuale
	const computedBudget = () =>
		budget().map(b => ({
			...b,
			incassi_puntuale: computeIncassiPuntuale(b)
		}));

	// Raggruppa il budget per anno (somma degli incassi_puntuale dei mesi dell'anno)
	const groupBudgetByYear = () => {
		const grouped = {};
		computedBudget().forEach(b => {
			const year = b.anno_rif;
			if (!grouped[year]) grouped[year] = 0;
			grouped[year] += b.incassi_puntuale;
		});
		return Object.entries(grouped)
			.sort(([a], [b]) => b - a)
			.map(([year, total]) => [year, total]);
	};

	// Helper per trovare il record di budget corrispondente a un determinato mese (chiave "YYYY-MM")
	const findBudgetForKey = (key) => {
		const [year, month] = key.split('-');
		return computedBudget().find(b => b.anno_rif === parseInt(year) && b.mese_rif === parseInt(month));
	};

	// Raggruppa gli incassi per anno e calcola la somma totale
	const groupByYear = () => {
		const grouped = {};
		chiusureConSpese().forEach((entry) => {
			const yearKey = new Date(entry.data_competenza).getFullYear();
			if (!grouped[yearKey]) grouped[yearKey] = 0;
			const tag = selectedTag();
			if (tag && tagMap[tag]) {
				grouped[yearKey] += entry[tagMap[tag]] || 0;
			} else {
				grouped[yearKey] += entry.chiusura_lorda_reale || 0;
			}
		});
		return Object.entries(grouped)
			.sort(([a], [b]) => b - a)
			.map(([year, total]) => [year, total]);
	};

	const groupByMonth = () => {
		const grouped = {};
		chiusureConSpese()
			.filter((entry) => new Date(entry.data_competenza).getFullYear() === parseInt(selectedYear()))
			.forEach((entry) => {
				const date = new Date(entry.data_competenza);
				const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
				if (!grouped[key]) grouped[key] = 0;
				const tag = selectedTag();
				if (tag && tagMap[tag]) {
					grouped[key] += entry[tagMap[tag]] || 0;
				} else {
					grouped[key] += entry.chiusura_lorda_reale || 0;
				}
			});
		return Object.entries(grouped)
			.sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
			.map(([key, total]) => {
				const [year, month] = key.split('-');
				const formattedMonth = new Date(year, month - 1).toLocaleString('default', {
					month: 'long',
					year: 'numeric',
				});
				return { formattedMonth, total, key };
			});
	};


	// Filtra gli incassi per giorno per il mese selezionato
	const filterByDay = () => {
		return chiusureConSpese()
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
				const total = (entry.chiusura_lorda_reale || 0);
				// (entry.carte || 0) + (entry.satispay || 0) + (entry.contanti_cassa_lordo_spese || 0);
				return { ...entry, total };
			})
			.sort((a, b) => new Date(a.data_competenza) - new Date(b.data_competenza));
	};

	// Dettagli di un singolo giorno
	const getDailyDetails = () => {
		//console.log(aggrData().find((entry) => entry.data_competenza === selectedDay()));
		return chiusureConSpese().find((entry) => entry.data_competenza === selectedDay());
	};

	//Funzione per aggiungere un nuovo incasso
	const addNewChiusura = async () => {
		// Controlla se esiste già un incasso con la stessa data di competenza
		const existing = chiusure().find(
			(entry) => entry.data_competenza === newChiusura().data_competenza
		);

		if (existing) {
			// Mostra un messaggio di errore
			alert(
				`Non è possibile inserire un incasso per la data di competenza ${new Date(
					newChiusura().data_competenza
				).toLocaleDateString('it-IT')}. Esiste già un incasso per questa data.`
			);
			return;
		}

		// Verifica e converte i campi numerici
		const fieldsToCheck = ['battuti_cassa', 'carte', 'satispay', 'contanti_cassa'];
		const convertedValues = {};

		for (const field of fieldsToCheck) {
			const value = newChiusura()[field];

			// Se il campo è vuoto, imposta a 0
			if (value === '') {
				convertedValues[field] = 0;
				continue;
			}

			// Sostituisci eventuale "," con "."
			const sanitizedValue = value.replace(',', '.');

			// Prova a convertire in numero
			const numericValue = parseFloat(sanitizedValue);

			if (isNaN(numericValue)) {
				alert(`Il valore inserito per "${field}" non è valido. Inserisci un numero valido.`);
				return; // Blocca l'inserimento
			}

			convertedValues[field] = numericValue; // Salva il valore convertito
		}

		// Crea un nuovo oggetto incasso con i campi convertiti
		const incassoToInsert = {
			...newChiusura(),
			...convertedValues,
		};

		// Inserisci nel database
		const { data, error } = await supabase
			.from('chiusure')
			.insert([incassoToInsert], { returning: 'representation' })
			.select('*'); // Recupera i dati appena inseriti

		if (error) {
			console.error("Errore durante l'inserimento:", error.message);
		} else {
			console.log('Incasso aggiunto con successo:', data);
			setChiusure((prev) => [...prev, ...(data || [])]); // Aggiungi i nuovi dati allo stato locale Incassi
			//await aggregateIncassiWithSpese();
			setShowAddPopup(false); // Chiudi il popup
		}
	};

	// Calcola il totale di tutti gli incassi nella view day
	const calculateTotalByTag = (entries) => {
		const tag = selectedTag();
		return entries.reduce((sum, entry) => {
			if (tag && tagMap[tag]) {
				return sum + (entry[tagMap[tag]] || 0);
			}
			return sum + (entry.chiusura_lorda_reale || 0);
			// (entry.carte || 0) +
			// (entry.satispay || 0) +
			// (entry.contanti_cassa_lordo_spese || 0);
		}, 0);
	};

	//Elimina un incasso giornaliero dal db
	const deleteChiusura = async () => {
		const selectedIncasso = getDailyDetails(); // Ottieni l'incasso selezionato
		if (!selectedIncasso) return;

		const { error } = await supabase
			.from('chiusure')
			.delete()
			.eq('data_competenza', selectedIncasso.data_competenza); // Elimina l'incasso dal database

		if (error) {
			console.error("Errore durante la cancellazione dell'incasso:", error.message);
		} else {
			console.log('Incasso cancellato con successo');
			// Aggiorna lo stato locale rimuovendo l'incasso cancellato
			setChiusure((prev) =>
				prev.filter((entry) => entry.data_competenza !== selectedIncasso.data_competenza)
			);
			//await aggregateIncassiWithSpese();
			setShowDeletePopup(false); // Chiudi il popup di conferma
			setView('day'); // Torna alla view "day"
		}
	};

	//Apre il popup per l'edit di un incasso
	const openEditPopup = () => {
		const selectedIncasso = getDailyDetails();
		if (!selectedIncasso) return;

		setEditChiusura({
			battuti_cassa: selectedIncasso.battuti_cassa
				? selectedIncasso.battuti_cassa.toString().replace('.', ',')
				: '',
			carte: selectedIncasso.carte
				? selectedIncasso.carte.toString().replace('.', ',')
				: '',
			satispay: selectedIncasso.satispay
				? selectedIncasso.satispay.toString().replace('.', ',')
				: '',
			contanti_cassa: selectedIncasso.contanti_cassa_netto_spese_serata
				? selectedIncasso.contanti_cassa_netto_spese_serata.toString().replace('.', ',')
				: '',
		});
		setShowEditPopup(true);
	};

	//Gestisce il vero e proprio update di un Incasso esistente
	const updateChiusura = async () => {
		const selectedIncasso = getDailyDetails();
		if (!selectedIncasso) return;

		// Verifica e converte i campi numerici
		const fieldsToCheck = ['battuti_cassa', 'carte', 'satispay', 'contanti_cassa'];
		const convertedValues = {};

		for (const field of fieldsToCheck) {
			const value = editChiusura()[field];

			// Se il campo è vuoto, imposta a 0
			if (value === '') {
				convertedValues[field] = 0;
				continue;
			}

			// Sostituisci eventuale "," con "."
			const sanitizedValue = value.replace(',', '.');

			// Prova a convertire in numero
			const numericValue = parseFloat(sanitizedValue);

			if (isNaN(numericValue)) {
				alert(`Il valore inserito per "${field}" non è valido. Inserisci un numero valido.`);
				return; // Blocca l'inserimento
			}

			convertedValues[field] = numericValue; // Salva il valore convertito
		}

		// Crea un nuovo oggetto incasso con i campi convertiti
		const incassoToInsert = {
			...editChiusura(),
			...convertedValues,
		};

		const { error } = await supabase
			.from('chiusure')
			.update(incassoToInsert)
			.eq('data_competenza', selectedIncasso.data_competenza);

		if (error) {
			console.error("Errore durante l'aggiornamento dell'incasso:", error.message);
		} else {
			console.log('Incasso aggiornato con successo');
			//Aggiorna lo stato locale
			setChiusure((prev) =>
				prev.map((entry) =>
					entry.data_competenza === selectedIncasso.data_competenza
						? { ...entry, ...incassoToInsert }
						: entry
				)
			);
			//await aggregateIncassiWithSpese();
			setShowEditPopup(false); // Chiudi il popup
		}
	};

	return (
		<div class="flex flex-col h-full px-2 pt-2">

			{/* tags */}
			{view() !== 'detail' && (
				<div class="fixed flex items-center justify-center top-[138px] left-0 gap-1 w-full">
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
			)}

			{view() === 'year' && (
				<div class="flex flex-col h-full">
					<h2 class="flex-none flex items-center justify-center h-[55px] text-lg font-semibold mb-16 mt-2">
						Chiusure annuali
					</h2>
					<div class="flex-none flex items-center justify-end px-4">
						<div class="flex items-center justify-end text-[10px] italic w-[70px] text-gray-500 mr-2">
							Var BDG
						</div>
					</div>
					<ul class="flex-grow overflow-y-auto pb-40">
						{groupByYear().map(([year, total]) => {
							const budgetYearEntry = groupBudgetByYear().find(([yr]) => yr == year);
							const budgetTotal = budgetYearEntry ? budgetYearEntry[1] : 0;
							const diff = total - budgetTotal;
							const diffColor = diff >= 0 ? "text-green-600" : "text-red-600";
							const diffFormatted =
								diff >= 0
									? `+${new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(Math.round(diff))} €`
									: `${new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(Math.round(diff))} €`;

							return (
								<li
									class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
									onClick={() => {
										setSelectedYear(year);
										setView('month');
									}}
								>
									<div class="flex justify-between items-center">
										<span>{year}</span>
										<div class="flex text-green-600">
											{new Intl.NumberFormat('it-IT', {
												style: 'decimal',
												maximumFractionDigits: 0,
											}).format(Math.round(total))} €
											<div class={`flex items-center justify-end w-[70px] text-xs italic font-light ${diffColor}`}>
												({diffFormatted})
											</div>
										</div>
									</div>
								</li>
							);
						})}
						<li class="py-2 px-4 bg-gray-100 font-semibold">
							<div class="flex justify-end items-center">
								<span class="text-green-800 font-bold">
									{new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(
										groupByYear().reduce((sum, [, total]) => sum + total, 0)
									)} €
								</span>
								<div class={`flex items-center justify-end w-[70px] text-xs italic ${groupByYear().reduce((sum, [, total]) => sum + total, 0) -
									groupBudgetByYear().reduce((sum, [, total]) => sum + total, 0) >= 0
									? 'text-green-600'
									: 'text-red-600'
									}`}>
									(
									{groupByYear().reduce((sum, [, total]) => sum + total, 0) -
										groupBudgetByYear().reduce((sum, [, total]) => sum + total, 0) >= 0
										? '+'
										: ''}
									{new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(
										groupByYear().reduce((sum, [, total]) => sum + total, 0) -
										groupBudgetByYear().reduce((sum, [, total]) => sum + total, 0)
									)} €)
								</div>
							</div>
						</li>

					</ul>
				</div>
			)}

			{/* View degli incassi per mese */}
			{view() === 'month' && (
				<div class="flex flex-col h-full">
					<div class="flex-none flex justify-between h-[55px] mb-16 mt-2">
						<button
							class="w-[40px] bg-gray-100 font-bold text-black rounded"
							onClick={() => setView('year')}
						>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div>
							<div class="text-lg text-center font-semibold">Chiusure mensili</div>
							<div class="text-center">{selectedYear()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					<div class="flex-none flex items-center justify-end px-4">
						<div class="flex items-center justify-end text-[10px] italic w-[70px] text-gray-500 mr-2">
							Var BDG
						</div>
					</div>

					<ul class="flex-grow overflow-y-auto pb-40">
						{groupByMonth().map(({ formattedMonth, total, key }) => {
							const budgetRecord = findBudgetForKey(key);
							const budgetValue = budgetRecord ? budgetRecord.incassi_puntuale : 0;
							const diff = total - budgetValue;
							const diffColor = diff >= 0 ? "text-green-600" : "text-red-600";
							const diffFormatted =
								diff >= 0
									? `+${new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(Math.round(diff))} €`
									: `${new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(Math.round(diff))} €`;
							return (
								<li
									class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
									onClick={() => {
										setSelectedMonth(formattedMonth);
										setView('day');
									}}
								>
									<div class="flex justify-between items-center">
										<span>{formattedMonth}</span>
										<div class="flex text-green-600">
											{new Intl.NumberFormat('it-IT', {
												style: 'decimal',
												maximumFractionDigits: 0,
											}).format(Math.round(total))} €
											<div class={`flex items-center justify-end w-[70px] text-xs italic font-light ${diffColor}`}>
												({diffFormatted})
											</div>
										</div>
									</div>
								</li>
							);
						})}

						{/* Totale complessivo di tutti i mesi */}
						<li class="py-2 px-4 bg-gray-100 font-semibold">
							<div class="flex justify-end items-center">
								<span class="text-green-800 font-bold">
									{new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(
										groupByMonth().reduce((sum, { total }) => sum + total, 0)
									)} €
								</span>
								<div class={`flex items-center justify-end w-[70px] text-xs italic ${groupByMonth().reduce((sum, { total, key }) =>
									sum + total - (findBudgetForKey(key)?.incassi_puntuale || 0), 0) >= 0
										? 'text-green-600'
										: 'text-red-600'
									}`}>
									(
									{groupByMonth().reduce((sum, { total, key }) =>
										sum + total - (findBudgetForKey(key)?.incassi_puntuale || 0), 0) >= 0
										? '+'
										: ''}
									{new Intl.NumberFormat('it-IT', {
										style: 'decimal',
										maximumFractionDigits: 0,
									}).format(
										groupByMonth().reduce((sum, { total, key }) =>
											sum + total - (findBudgetForKey(key)?.incassi_puntuale || 0), 0)
									)} €)
								</div>
							</div>
						</li>
					</ul>
				</div>
			)}


			{/* View degli incassi giornalieri */}
			{view() === 'day' && (
				<div class="flex flex-col h-full">
					{/* Intestazione fissa */}
					<div class="flex-none flex justify-between items-center h-[55px] mb-16 mt-2">
						<button
							class="w-[40px] bg-gray-100 font-bold text-black rounded"
							onClick={() => setView('month')}
						>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div>
							<div class="text-lg text-center font-semibold">Chiusure giornaliere</div>
							<div class="text-center">{selectedMonth()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					{/* Area scrollabile */}
					<div class="flex-grow overflow-y-auto pb-40">
						<ul>
							{filterByDay().map((entry) => (
								<li
									key={entry.data_competenza}
									class="py-2 px-4 border-b cursor-pointer hover:bg-gray-100"
									onClick={() => {
										setSelectedDay(entry.data_competenza);
										setView('detail');
									}}
								>
									<div class="flex justify-between">
										<span>{new Date(entry.data_competenza).toLocaleDateString()}</span>
										<span class="text-green-600">
											{new Intl.NumberFormat('it-IT', {
												style: 'decimal',
												maximumFractionDigits: 0,
											}).format(Math.round(entry.total))} €
										</span>
									</div>
								</li>
							))}

							{/* Totale complessivo del mese selezionato */}
							<li class="py-2 px-4 bg-gray-100 font-semibold">
								<div class="flex justify-end">
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
				</div>
			)}


			{/* View di dettaglio per un giorno */}
			{view() === 'detail' && (
				<div class="flex flex-col h-full">
					{/* Intestazione fissa */}
					<div class="flex-none flex justify-between h-[55px] mb-2 mt-2">
						<button class="w-[40px] bg-gray-100 font-bold text-black rounded" onClick={() => setView('day')}>
							<img src="/back.svg" alt="back" class="w-full h-auto" />
						</button>
						<div>
							<div class="text-lg text-center font-semibold">Dettaglio Chiusura</div>
							<div class="text-center">{new Date(selectedDay()).toLocaleDateString()}</div>
						</div>
						<div class="w-[40px]"></div>
					</div>

					{/* Area scrollabile */}
					<div class="flex-grow overflow-y-auto pt-2">
						{getDailyDetails() && (
							<div>
								{/* Battuti cassa */}
								<div class="flex text-sm justify-between py-1 px-4 border-b bg-gray-100">
									<span class="">Battuti cassa</span>
									<span class="text-green-600">
										{new Intl.NumberFormat('it-IT', {
											style: 'decimal',
											minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
											maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
										}).format(getDailyDetails()?.battuti_cassa || 0)} €
									</span>
								</div>

								{/* Contanti in cassa (netto spese) */}
								<div class="flex text-sm justify-between py-1 px-4 border-b">
									<span>Contanti in cassa (netto spese)</span>
									<span class="text-green-600">
										{new Intl.NumberFormat('it-IT', {
											style: 'decimal',
											minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
											maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
										}).format(getDailyDetails()?.contanti_cassa_netto_spese_serata || 0)} €
									</span>
								</div>

								{/* Spese serata */}
								<div class="flex text-sm text-red-500 justify-between py-1 px-4 border-b bg-yellow-50">
									<span>Spese serata</span>
									<span class="text-red-500">
										{new Intl.NumberFormat('it-IT', {
											style: 'decimal',
											minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
											maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
										}).format(getDailyDetails()?.spese_serata || 0)} €
									</span>
								</div>

								{/* Contanti in cassa (lordo spese) */}
								<div class="flex justify-between py-1 px-4 border-b">
									<span class="">Contanti in cassa (lordo spese)</span>
									<span class="text-green-600 font-semibold">
										{new Intl.NumberFormat('it-IT', {
											style: 'decimal',
											minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
											maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
										}).format(getDailyDetails()?.contanti_cassa_lordo_spese_serata || 0)} €
									</span>
								</div>

								{/* Carte */}
								<div class="flex justify-between py-1 px-4 border-b">
									<span>Carte</span>
									<span class="text-green-600 font-semibold">
										{new Intl.NumberFormat('it-IT', {
											style: 'decimal',
											minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
											maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
										}).format(getDailyDetails()?.carte || 0)} €
									</span>
								</div>

								{/* Satispay */}
								<div class="flex justify-between py-1 px-4 border-b">
									<span class="">Satispay</span>
									<span class="text-green-600 font-semibold">
										{new Intl.NumberFormat('it-IT', {
											style: 'decimal',
											minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
											maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
										}).format(getDailyDetails()?.satispay || 0)} €
									</span>
								</div>

								{/* Totale Incasso reale giornaliero */}
								<div class="flex justify-between py-2 px-4">
									<span class=""></span>
									<span class="text-green-800 font-bold">
										{new Intl.NumberFormat('it-IT', {
											style: 'decimal',
											minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
											maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
										}).format((getDailyDetails()?.chiusura_lorda_reale || 0))} €
									</span>
								</div>

								{/* NB */}
								<div class="flex text-sm justify-between py-1 px-4 border-b">
									<span class="">Gap</span>
									<span class="text-green-600">
										{new Intl.NumberFormat('it-IT', {
											style: 'decimal',
											minimumFractionDigits: 0, // Mostra 0 decimali se non presenti
											maximumFractionDigits: 2, // Mostra fino a 2 decimali se presenti
										}).format(getDailyDetails()?.gap || 0)} €
									</span>
								</div>

							</div>
						)}

					</div>

					{/* Pulsanti di azione */}
					<div class="flex justify-around py-4 h-[56]">
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
			)}

			{/* Bottone rotondo per aggiungere un nuovo incasso*/}
			{view() !== 'detail' && (
				<button
					onClick={() => {
						// Resetta i campi di newChiusura
						setNewChiusura({
							data_competenza: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Oggi - 1 giorno
							battuti_cassa: '',
							carte: '',
							satispay: '',
							contanti_cassa: '',
						});
						// Mostra il popup
						setShowAddPopup(true);
					}}
					class="fixed bottom-[106px] right-4 w-16 h-16 bg-blue-500 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center hover:bg-green-600"
				>
					<img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
				</button>
			)}

			{/* Popup per aggiungere un nuovo incasso */}
			{showAddPopup() && (
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div class="bg-white rounded-lg p-6 w-[90%] relative">
						<button
							onClick={() => setShowAddPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-bold mb-4 text-center">Nuova chiusura</h2>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								await addNewChiusura();
							}}
						>
							{/* Campo per la data di competenza */}
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Data Competenza</label>
								<input
									type="date"
									value={newChiusura().data_competenza || ''}
									onInput={(e) =>
										setNewChiusura({
											...newChiusura(),
											data_competenza: e.currentTarget.value,
										})
									}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							{/* Campi numerici */}
							{[
								{ label: 'Battuti Cassa', key: 'battuti_cassa' },
								{ label: 'Carte', key: 'carte' },
								{ label: 'Satispay', key: 'satispay' },
								{ label: 'Contanti Cassa', key: 'contanti_cassa' },
							].map(({ label, key }) => (
								<div class="mb-4" key={key}>
									<label class="block text-sm font-medium mb-1">{label}</label>
									<input
										type="text"
										value={newChiusura()[key] !== '' ? newChiusura()[key] : ''}
										onInput={(e) => {
											const input = e.currentTarget.value;

											// Sostituisci immediatamente "." con ","
											let sanitizedInput = input.replace('.', ',');

											// Rimuovi tutti i caratteri non validi (solo numeri e ",")
											sanitizedInput = sanitizedInput.replace(/[^0-9,]/g, '');

											// Aggiorna lo stato con il valore sanitizzato
											setNewChiusura({
												...newChiusura(),
												[key]: sanitizedInput,
											});
										}}
										class={`w-full border rounded px-3 py-2 ${
											// Validazione: campo è rosso se contiene più di una virgola
											/^[0-9]*,?[0-9]*$/.test(newChiusura()[key]) ? '' : 'text-red-500'
											}`}
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
								onClick={deleteChiusura}
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
								await updateChiusura();
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
										type="text"
										value={editChiusura()[key]}
										onInput={(e) => {
											const input = e.currentTarget.value;

											// Sostituisci immediatamente "." con ","
											let sanitizedInput = input.replace('.', ',');

											// Rimuovi tutti i caratteri non validi (solo numeri e ",")
											sanitizedInput = sanitizedInput.replace(/[^0-9,]/g, '');

											// Aggiorna lo stato con il valore sanitizzato
											setEditChiusura({
												...editChiusura(),
												[key]: sanitizedInput,
											});
										}}

										class={`w-full border rounded px-3 py-2 ${
											// Validazione: campo è rosso se contiene più di una virgola
											/^[0-9]*,?[0-9]*$/.test(editChiusura()[key]) ? '' : 'text-red-500'
											}`}
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
	);
};

export default Chiusure;
