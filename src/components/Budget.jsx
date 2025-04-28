import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient.js';

const Budget = ({ companyId, budget, setBudget }) => {
	// Stato per la modifica inline; per ogni record si memorizzano le stringhe dei numeri
	const [editing, setEditing] = createSignal({});

	// Stati per l'inserimento di un nuovo record
	const [newDate, setNewDate] = createSignal("");
	const [newIncassi, setNewIncassi] = createSignal("");
	const [newSpese, setNewSpese] = createSignal("");

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
		<div class="flex items-center justify-center w-full h-full">
			<div class="flex flex-col w-[100%] h-full p-4">
				<h2 class="text-center text-2xl mb-4">Budget</h2>
				<div class="flex flex-col w-full h-full overflow-y-auto text-xs">
					<table class="w-full table-auto">
						<thead class="sticky top-0 bg-gray-100 z-10">
							<tr class="border-b">
								<th class="w-[140px] min-w-[140px]">Data</th>
								<th>Incassi</th>
								<th>Spese</th>
								<th class="max-w-[30px]"></th>
							</tr>
						</thead>
						<tbody>
							{[...budget()]
								.sort((a, b) => {
									if (a.anno_rif !== b.anno_rif) return a.anno_rif - b.anno_rif;
									return a.mese_rif - b.mese_rif;
								})
								.map(b => (
									<tr class="h-[50px]" key={b.id}>
										<td class="border-b px-2 text-base">
											{getMonthYearText(b.mese_rif, b.anno_rif)}
										</td>
										<td class="border-b px-2 min-w-[100px]">
											<input
												type="text"
												value={editing()[b.id]?.incassi !== undefined
													? editing()[b.id].incassi
													: formatEuro(b.incassi)}
												onInput={(e) => handleEditChange(b.id, 'incassi', e.target.value)}
												onBlur={() => handleSave(b.id)}
												class="w-full pl-2 h-[40px] text-base rounded-lg text-right pr-2"
											/>
										</td>
										<td class="border-b px-2 min-w-[100px]">
											<input
												type="text"
												value={editing()[b.id]?.spese !== undefined
													? editing()[b.id].spese
													: formatEuro(b.spese)}
												onInput={(e) => handleEditChange(b.id, 'spese', e.target.value)}
												onBlur={() => handleSave(b.id)}
												class="w-full pl-2 h-[40px] min-w-[50px] text-base rounded-lg text-right pr-2"
											/>
										</td>
										<td class="border-b w-[60px] p-0">
											<div
												onClick={() => handleDelete(b.id)}
												class="flex items-center justify-center h-full cursor-pointer w-[40px]"
											>
												<img src="/cancel-black.svg" alt="Elimina" class="w-6 h-6" />
											</div>
										</td>
									</tr>
								))
							}
							<tr>
								<td class="border-b h-full">
									<select
										value={newDate()}
										onInput={(e) => setNewDate(e.target.value)}
										class="w-full rounded-lg pl-2 h-[30px]"
									>
										<option value="">Seleziona data</option>
										{dateOptions.map(opt => (
											<option key={`${opt.month}-${opt.year}`} value={opt.value}>
												{opt.value}
											</option>
										))}
									</select>
								</td>
								<td class="border-b p-2">
									<input
										type="text"
										value={newIncassi()}
										onInput={(e) => setNewIncassi(e.target.value.replace(/\D/g, ""))}
										placeholder="Incassi"
										class="w-full text-2xl rounded-lg pl-2 placeholder:text-center"
									/>
								</td>
								<td class="border-b p-2">
									<input
										type="text"
										value={newSpese()}
										onInput={(e) => setNewSpese(e.target.value.replace(/\D/g, ""))}
										placeholder="Spese"
										class="w-full text-2xl rounded-lg pl-2 placeholder:text-center"
									/>
								</td>
								<td class="border-b p-2">
									<button onClick={handleAdd} class="bg-green-500 text-white px-2 py-1 rounded">
										Aggiungi
									</button>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default Budget;
