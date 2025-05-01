import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient.js';

const Budget = ({ companyId, budget, setBudget, isLandscape }) => {
	// Stato per la modifica inline; per ogni record si memorizzano le stringhe dei numeri
	const [editing, setEditing] = createSignal({});

	// Stati per l'inserimento di un nuovo record
	const [newDate, setNewDate] = createSignal("");
	const [newIncassi, setNewIncassi] = createSignal("");
	const [newSpese, setNewSpese] = createSignal("");
	const [showModal, setShowModal] = createSignal(false);

	// Array dei nomi dei mesi in italiano
	const monthNames = [
		"Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
		"Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
	];

	// Converte mese (1-12) e anno in una stringa formattata es. "Aprile 2025"
	const getMonthYearText = (mese, anno) => `${monthNames[mese - 1]} ${anno}`;

	// Formatta un numero in formato italiano con separatore delle migliaia (nessun decimale)
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

	onMount(() => {
		//console.log("Budget:", budget());
	});

	// Gestione della modifica inline: rimuove caratteri non numerici
	const handleEditChange = (id, field, value) => {
		const cleaned = value.replace(/\D/g, "");
		setEditing(prev => ({
			...prev,
			[id]: {
				...prev[id],
				[field]: cleaned
			}
		}));
	};

	// Salva le modifiche: utilizza il valore originale se non modificato
	const handleSave = async (id) => {
		const editedRecord = editing()[id];
		if (!editedRecord) return;
		const originalRecord = budget().find(b => b.id === id);
		if (!originalRecord) return;

		const incassiNew = editedRecord.incassi !== undefined
			? parseInt(editedRecord.incassi, 10)
			: originalRecord.incassi;
		const speseNew = editedRecord.spese !== undefined
			? parseInt(editedRecord.spese, 10)
			: originalRecord.spese;

		if (incassiNew === originalRecord.incassi && speseNew === originalRecord.spese) {
			return;
		}

		const { data, error } = await supabase
			.from('budget')
			.update({
				incassi: incassiNew,
				spese: speseNew
			})
			.eq('id', id);

		if (error) {
			console.error("Errore aggiornamento budget:", error);
			return;
		}

		setBudget(prev =>
			prev.map(b => b.id === id ? { ...b, incassi: incassiNew, spese: speseNew } : b)
		);
		setEditing(prev => {
			const { [id]: removed, ...rest } = prev;
			return rest;
		});
	};

	// Elimina un record di budget
	const handleDelete = async (id) => {
		const confirmDelete = window.confirm("Sei sicuro di voler eliminare questo record di budget?");
		if (!confirmDelete) return;

		const { data, error } = await supabase
			.from('budget')
			.delete()
			.eq('id', id);

		if (error) {
			console.error("Errore eliminazione budget:", error);
			return;
		}
		setBudget(prev => prev.filter(b => b.id !== id));
	};

	// Genera dinamicamente le opzioni per la listbox: tutti i mesi dell'anno corrente e del prossimo
	const getDateOptions = () => {
		const options = [];
		const currentYear = new Date().getFullYear();
		const years = [currentYear, currentYear + 1];
		years.forEach(year => {
			for (let month = 1; month <= 12; month++) {
				options.push({ value: `${monthNames[month - 1]} ${year}`, month, year });
			}
		});
		return options;
	};

	const dateOptions = getDateOptions();

	// Aggiunge un nuovo record di budget verificando l'unicità della combinazione mese-anno
	const handleAdd = async () => {
		const date = newDate().trim();
		if (!date) {
			alert("Seleziona una data valida");
			return;
		}
		const parts = date.split(" ");
		if (parts.length !== 2) {
			alert("Formato data non valido");
			return;
		}
		const [monthName, yearStr] = parts;
		const monthMap = {
			"Gennaio": 1, "Febbraio": 2, "Marzo": 3, "Aprile": 4,
			"Maggio": 5, "Giugno": 6, "Luglio": 7, "Agosto": 8,
			"Settembre": 9, "Ottobre": 10, "Novembre": 11, "Dicembre": 12
		};
		const mese_rif = monthMap[monthName];
		const anno = parseInt(yearStr, 10);
		if (!mese_rif || isNaN(anno)) {
			alert("Formato data non valido");
			return;
		}
		// Verifica che non esista già un record per lo stesso mese-anno
		const exists = budget().some(b => b.mese_rif === mese_rif && b.anno_rif === anno);
		if (exists) {
			alert("Esiste già un record per questa data");
			return;
		}
		// Rimuove eventuali formattazioni dagli input
		const incassiVal = parseInt(newIncassi().replace(/\D/g, ""), 10) || 0;
		const speseVal = parseInt(newSpese().replace(/\D/g, ""), 10) || 0;

		const { data, error } = await supabase
			.from('budget')
			.insert({
				mese_rif,
				anno_rif: anno,
				incassi: incassiVal,
				spese: speseVal,
				company_id: companyId,
			})
			.select();

		if (error) {
			console.error("Errore inserimento budget:", error);
			return;
		}

		const newBudgetRecord = data[0];
		setBudget(prev => [...prev, newBudgetRecord]);
		setNewDate("");
		setNewIncassi("");
		setNewSpese("");
	};

	return (
		<div>
			<div class={`flex flex-col h-full items-center text-sm pb-40 ${isLandscape() && "w-[500px] mx-auto"}`}>
				{/* Intestazione fissa */}
				<div class="w-full flex items-center font-semibold text-left py-2 border-b px-2 bg-white sticky top-0 z-10">
					<div class="ml-2 w-[130px] text-center">Data</div>
					<div class="flex flex-grow">
						<div class="w-1/2 text-center">Incassi</div>
						<div class="w-1/2 text-center">Spese</div>
					</div>
					<div class="w-[40px] mr-2"></div>
				</div>

				{/* Righe dinamiche */}
				<div class="flex flex-col gap-2 mt-1 w-full px-2 overflow-y-auto flex-grow">
					{[...budget()]
						.sort((a, b) => {
							if (a.anno_rif !== b.anno_rif) return a.anno_rif - b.anno_rif;
							return a.mese_rif - b.mese_rif;
						})
						.map(b => (
							<div class="flex items-center w-full bg-white shadow-md rounded-lg border py-2" key={b.id}>
								<div class="flex-none ml-2 w-[130px]">{getMonthYearText(b.mese_rif, b.anno_rif)}</div>

								<div class="flex flex-grow">
									<div class="w-1/2 text-right">
										<div class="w-[90%]">
											<input
												type="text"
												value={editing()[b.id]?.incassi !== undefined
													? editing()[b.id].incassi
													: formatEuro(b.incassi)}
												onInput={(e) => handleEditChange(b.id, 'incassi', e.target.value)}
												onBlur={() => handleSave(b.id)}
												class="w-full h-[36px] rounded-lg text-right px-2 border font-semibold text-green-800"
											/>
										</div>
									</div>

									<div class="w-1/2 text-right">
										<div class="w-[90%]">
											<input
												type="text"
												value={editing()[b.id]?.spese !== undefined
													? editing()[b.id].spese
													: formatEuro(b.spese)}
												onInput={(e) => handleEditChange(b.id, 'spese', e.target.value)}
												onBlur={() => handleSave(b.id)}
												class="w-full h-[36px] rounded-lg text-right pr-2 pl-2 border font-semibold text-red-800"
											/>
										</div>
									</div>
								</div>

								<div class="flex-none w-[40px] flex justify-center">
									<div onClick={() => handleDelete(b.id)} class="cursor-pointer">
										<img src="/cancel-black.svg" alt="Elimina" class="w-6 h-6" />
									</div>
								</div>
							</div>
						))
					}
				</div>
			</div>

			{/* Bottone rotondo */}
			<button
				onClick={() => setShowModal(true)}
				class="fixed bottom-6 right-6 w-16 h-16 bg-blue-800 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center"
			>
				<img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
			</button>

			{/* popup di inserimento  */}
			{showModal() && (
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div class="bg-white rounded-lg p-6 w-[300px]">
						<h2 class="text-lg font-bold mb-4">Nuovo Budget</h2>

						<label class="block mb-2">
							Data
							<select
								value={newDate()}
								onInput={(e) => setNewDate(e.target.value)}
								class="w-full mt-1 rounded border px-2 py-1"
							>
								<option value="">Seleziona data</option>
								{dateOptions.map(opt => (
									<option key={`${opt.month}-${opt.year}`} value={opt.value}>
										{opt.value}
									</option>
								))}
							</select>
						</label>

						<label class="block mb-2">
							Incassi
							<input
								type="text"
								value={newIncassi()}
								onInput={(e) => setNewIncassi(e.target.value.replace(/\D/g, ""))}
								class="w-full mt-1 rounded border px-2 py-1"
							/>
						</label>

						<label class="block mb-4">
							Spese
							<input
								type="text"
								value={newSpese()}
								onInput={(e) => setNewSpese(e.target.value.replace(/\D/g, ""))}
								class="w-full mt-1 rounded border px-2 py-1"
							/>
						</label>

						<div class="flex justify-end space-x-2">
							<button onClick={() => setShowModal(false)} class="px-3 py-1 rounded bg-gray-300">
								Annulla
							</button>
							<button onClick={async () => {
								await handleAdd();
								setShowModal(false);
							}} class="px-3 py-1 rounded bg-blue-600 text-white">
								Salva
							</button>
						</div>
					</div>
				</div>
			)}

		</div>
	);
};

export default Budget;
