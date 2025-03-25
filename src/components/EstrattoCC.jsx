import { createSignal, onMount, onCleanup, createEffect } from "solid-js";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "../lib/supabaseClient"; // Assicurati che il client Supabase sia configurato
import decodeTipo from "../lib/decodeTipo"; // Importa la funzione decodeTipo

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url
).toString();

const EstrattoCC = ({ companyId, cc, setCC, isLandscape }) => {
	const [fileName, setFileName] = createSignal(null);
	const [importedMovCC, setImportedMovCC] = createSignal([]);
	const [startDate, setStartDate] = createSignal("");
	const [endDate, setEndDate] = createSignal("");
	const [movementFilter, setMovementFilter] = createSignal("all"); // "all", "inEntrata" o "inUscita"
	const [showSearch, setShowSearch] = createSignal(false);
	const [showWithoutType, setShowWithoutType] = createSignal(false);
	const [filteredMovCC, setFilteredMovCC] = createSignal([]);
	const [showPopup, setShowPopup] = createSignal(false);
	const [selectedRow, setSelectedRow] = createSignal(null);
	const [firstOpDate, setFirstOpDate] = createSignal("");
	const [lastOpDate, setLastOpDate] = createSignal("");

	// Esegui il caricamento automatico dei dati dal database all'avvio del componente
	onMount(() => {
		getFirstAndLastOpDate();
	});

	const getFirstAndLastOpDate = () => {
		if (!cc().length) {
			setFirstOpDate("");
			setLastOpDate("");
			return;
		}

		// Inizializza con il primo elemento dell'array
		let minDate = cc()[0].data_operazione;
		let maxDate = cc()[0].data_operazione;

		// Itera su cc() per trovare le date minime e massime
		cc().forEach((item) => {
			// Confronto diretto in formato ISO è valido
			if (item.data_operazione < minDate) {
				minDate = item.data_operazione;
			}
			if (item.data_operazione > maxDate) {
				maxDate = item.data_operazione;
			}
		});

		setFirstOpDate(minDate);
		setLastOpDate(maxDate);
	};

	const filterMovements = () => {
		let filtered = cc();

		if (startDate()) {
			filtered = filtered.filter((row) => row.data_operazione >= startDate());
		}
		if (endDate()) {
			filtered = filtered.filter((row) => row.data_operazione <= endDate());
		}
		if (showWithoutType()) {
			filtered = filtered.filter((row) => row.tipo === "");
		}

		// Aggiungi il filtro per importi:
		if (movementFilter() === "inEntrata") {
			filtered = filtered.filter((row) => row.importo > 0);
		} else if (movementFilter() === "inUscita") {
			filtered = filtered.filter((row) => row.importo < 0);
		}

		setFilteredMovCC(filtered);
	};

	// Filtro automatico: viene eseguito ogni volta che cambiano startDate, endDate o showWithoutType
	createEffect(() => {
		// La lettura di questi segnali crea una dipendenza
		startDate();
		endDate();
		showWithoutType();
		filterMovements();
	});

	const convertDateToISO = (date) => {
		if (!date) return "";
		const [day, month, year] = date.split("/");
		return `${year}-${month}-${day}`;
	};

	const formatDate = (date) => {
		if (!date) return "";
		const [year, month, day] = date.split("-");
		return `${day}/${month}/${year.slice(-2)}`; // Prende solo le ultime due cifre dell'anno
	};

	const getOptions = (importo) => {
		return importo > 0
			? ["Incassi POS", "Satispay", "Trasf CASH -> CC", "Deposito", "Altro..."]
			: ["Acquisti attività", "Attrezzature / Manutenzione", "Commercialista", "Dipendenti", "Eventi", "Fornitori", "Prelievi/Spese personali",
				"Spese bancarie", "Tasse", "Trasf CC -> CASH", "Utenze", "Altro..."];
	};

	const updateTipo = async (id, tipo) => {
		try {
			const { error } = await supabase
				.from("CC")
				.update({ tipo })
				.eq("id", id);

			if (error) throw error;

			// Aggiorna lo stato locale
			setCC(cc().map((item) =>
				item.id === id ? { ...item, tipo } : item
			));

			setFilteredMovCC(filteredMovCC().map((item) =>
				item.id === id ? { ...item, tipo } : item
			));

			setShowPopup(false);
		} catch (err) {
			console.error("Errore aggiornando il tipo:", err.message);
		}
	};

	//Funzione per caricare il PDF dal disco
	const handleFileUpload = async (event) => {
		const file = event.target.files[0];
		if (file) {
			setFileName(file.name);
			const fileReader = new FileReader();

			fileReader.onload = async () => {
				const typedArray = new Uint8Array(fileReader.result);
				const pdf = await pdfjsLib.getDocument(typedArray).promise;

				let allTextContent = []; // Array per contenere tutti gli oggetti textContent.items

				for (let i = 1; i <= pdf.numPages; i++) {
					const page = await pdf.getPage(i);
					const textContent = await page.getTextContent();

					// Concatena gli oggetti estratti nella variabile globale
					allTextContent = allTextContent.concat(textContent.items);
				}

				// Passa l'array completo al prossimo step di elaborazione
				processPDFContent(allTextContent);
			};

			fileReader.readAsArrayBuffer(file);
		}
	};

	// Funzione per processare il contenuto del PDF
	const processPDFContent = (allTextContent) => {
		const rows = []; // Array per memorizzare le righe
		let currentRow = []; // Array temporaneo per costruire la riga corrente

		const isDate = (str) => /^\d{2}\/\d{2}\/\d{4}$/.test(str); // Controlla se è una data
		const isDecimal = (str) => /^[+-]?\d+(\.\d{1,2}|,\d{1,2})$/.test(str); // Controlla se è un numero decimale
		const isCurrency = (str) => str === "EUR"; // Controlla se è "EUR"

		console.log(allTextContent);

		let i = 0;
		while (i < allTextContent.length) {
			const text = allTextContent[i].str;

			if (isDate(text) && !currentRow.data_operazione) {
				// Primo campo: data operazione
				currentRow.codice_identificativo = parseInt(allTextContent[i - 2]?.str || ""); // Codice identificativo (2 elementi prima)
				currentRow.data_operazione = text;
				i++;
				continue;
			}

			// provo qui la correzione per i campi data_valuta="-"
			if (!currentRow.data_valuta) {
				// Secondo campo: data valuta
				if (isDate(text)) currentRow.data_valuta = text;
				else if (text === "-") currentRow.data_valuta = currentRow.data_operazione;
				i++;
				continue;
			}

			if (!isCurrency(text) && !isDecimal(text.replace(/\./g, "")) && text.trim() !== "" && currentRow.data_operazione && currentRow.data_valuta) {
				if (!currentRow.descrizione) {
					currentRow.descrizione = text;
					//console.log(currentRow.descrizione);
					i++;
					continue;
				} else {
					// Se già esiste una descrizione, aggiungiamo il testo a quella esistente
					currentRow.descrizione += ` ${text}`;
					i++;
					continue;
				}

			}

			if (isDecimal(text.replace(/\./g, "")) && !currentRow.importo && currentRow.data_operazione && currentRow.data_valuta) {
				//console.log(text);
				currentRow.importo = parseFloat(text.replace(/\./g, "").replace(",", ".")); // Converti stringa a numero
				currentRow.tipo = decodeTipo(currentRow.importo, currentRow.descrizione); // Usa la funzione decodeTipo
				rows.push(currentRow); // Aggiungi l'oggetto alla lista
				currentRow = {}; // Reset per la prossima riga
				i++;
				continue;
			}

			i++;
		}

		setImportedMovCC(rows); // Imposta lo stato con le righe elaborate
		processImportedMovements();
		//console.log(importedMovCC());
	};

	const processImportedMovements = async () => {
		if (!importedMovCC().length) return;

		// Se cc è vuoto, inserisci tutti i movimenti da importedMovCC
		if (!cc().length) {
			console.log("cc è vuoto. Importazione di tutti i movimenti.");

			// Ottieni il numero progressivo iniziale
			const maxPrg = 0;

			// Aggiungi un nuovo prg ai movimenti
			const movementsWithPrg = importedMovCC()
				.map((movement, index, arr) => ({
					...movement,
					data_operazione: convertDateToISO(movement.data_operazione),
					data_valuta: convertDateToISO(movement.data_valuta),
					prg: maxPrg + arr.length - index, // Assegna i prg in ordine inverso
					company_id: companyId, // 🔹 Assicura che ogni insert abbia il company_id corretto
				}))
				.reverse(); // Inverti l'array finale per mantenere l'ordine corretto

			//console.log(movementsWithPrg);

			try {
				// Inserisci nel database e ottieni i dati inseriti
				const { data, error } = await supabase
					.from("CC")
					.insert(movementsWithPrg)
					.select("*"); // 👈 Ottiene i valori con ID e created_at

				if (error) {
					throw error;
				}

				console.log("Movimenti inseriti:", data);

				// Aggiorna lo stato locale cc con i nuovi movimenti
				setCC(data.sort((a, b) => b.prg - a.prg)); // Ordina per prg decrescente
				return; // Esci dalla funzione
			} catch (err) {
				console.error("Errore durante l'inserimento dei movimenti:", err.message);
				return;
			}
		}

		//console.log(cc());
		// Se cc non è vuoto, continua con l'elaborazione normale
		const matchingIndex = importedMovCC().findIndex((imported) =>
			cc().some(
				(existing) =>
					imported.codice_identificativo === existing.codice_identificativo &&
					convertDateToISO(imported.data_operazione) === existing.data_operazione &&
					convertDateToISO(imported.data_valuta) === existing.data_valuta &&
					imported.descrizione === existing.descrizione &&
					imported.importo === existing.importo
			)
		);

		if (matchingIndex === -1) {
			alert("Nessuna corrispondenza trovata con i movimenti attuali.");
			return;
		}

		// Ottieni le righe da inserire
		const newMovements = importedMovCC().slice(0, matchingIndex);

		if (!newMovements.length) {
			alert("Nessun nuovo movimento da inserire.");
			return;
		}

		// Ottieni il prg massimo attuale
		const maxPrg = Math.max(...cc().map((row) => row.prg));

		// Aggiungi un nuovo prg partendo dall'ultimo elemento dell'array
		const movementsWithPrg = newMovements
			.map((movement, index, arr) => ({
				...movement,
				data_operazione: convertDateToISO(movement.data_operazione),
				data_valuta: convertDateToISO(movement.data_valuta),
				prg: maxPrg + arr.length - index, // Assegna i prg in ordine inverso
				company_id: companyId,
			}))
			.reverse(); // Inverti l'array finale per mantenere l'ordine corretto

		try {
			// Inserisci nel database e ottieni i dati inseriti
			const { data, error } = await supabase
				.from("CC")
				.insert(movementsWithPrg)
				.select("*"); // 👈 Ottiene i valori con ID e created_at

			if (error) {
				throw error;
			}

			console.log("Nuovi movimenti inseriti:", data);
			alert("Movimenti inseriti correttamente");

			// Aggiorna lo stato locale `cc` con i nuovi movimenti
			const updatedMovCC = [...data, ...cc()].sort(
				(a, b) => b.prg - a.prg // Ordina in ordine decrescente di `prg`
			);

			setCC(updatedMovCC);
		} catch (err) {
			console.error("Errore durante l'inserimento dei nuovi movimenti:", err.message);
		}
	};


	return (
		<div class="flex flex-col h-full">

			{/* saldo cc e bottone importa pdf */}
			<div class="flex-none flex items-center justify-between h-[50px]">
				<div class="flex pl-2 text-lg font-semibold">
					<div>Saldo CC al {formatDate(lastOpDate())}:</div>
					<span class="ml-2 text-green-800"> {cc().reduce((acc, row) => acc + parseFloat(row.importo), 0).toLocaleString("it-IT", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})} €
					</span>
				</div>


				<div class="flex items-center justify-center gap-2 mr-2">
					<div class="flex justify-center my-2">
						<button
							onClick={() => setShowSearch(!showSearch())}
							class="bg-gray-300 p-2 rounded-full"
						>
							🔍
						</button>
					</div>

					{isLandscape() && companyId === "f5f41f26-2831-49d3-8a0c-ecc6d2a128c7" && (
						<div>
							<input
								type="file"
								accept=".pdf"
								onChange={handleFileUpload}
								class="hidden"
								id="file-upload"
							/>
							<label
								for="file-upload"
								class="cursor-pointer bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
							>
								Importa PDF
							</label>
						</div>
					)}
				</div>

			</div>

			{/* Zona di ricerca */}
			{showSearch() && (
				<div class="flex-none border-y py-4">
					<div class="flex w-full items-center justify-center gap-3">
						<div class="flex flex-col">
							<label for="start-date" class="mb-1 text-sm">Data Inizio</label>
							<input
								id="start-date"
								type="date"
								value={startDate()}
								onInput={(e) => setStartDate(e.target.value)}
								class="border px-2 py-1 rounded"
							/>
						</div>
						<div class="flex flex-col">
							<label for="end-date" class="mb-1 text-sm">Data Fine</label>
							<input
								id="end-date"
								type="date"
								value={endDate()}
								onInput={(e) => setEndDate(e.target.value)}
								class="border px-2 py-1 rounded"
							/>
						</div>
					</div>
					<label class="flex w-full items-center justify-center py-2 gap-2">
						<input
							type="checkbox"
							checked={showWithoutType()}
							onChange={() => setShowWithoutType(!showWithoutType())}
						/>
						<span>Visualizza solo movimenti senza Tipo</span>
					</label>
					{/* Bottoni per il filtro in entrata/uscita */}
					<div class="flex gap-1 mt-2 justify-center text-sm">
						<button
							onClick={() => setMovementFilter(movementFilter() === "inEntrata" ? "all" : "inEntrata")}
							class={`px-4 py-2 w-[100px] rounded-l-full shadow-lg ${movementFilter() === 'inEntrata' ? 'bg-green-200 text-green-800 font-semibold' : 'bg-gray-200 text-gray-700'}`}
						>
							In Entrata
						</button>
						<button
							onClick={() => setMovementFilter(movementFilter() === "inUscita" ? "all" : "inUscita")}
							class={`px-4 py-2 w-[100px] rounded-r-full shadow-lg ${movementFilter() === 'inUscita' ? 'bg-red-200 text-red-800 font-semibold' : 'bg-gray-200 text-gray-700'}`}
						>
							In Uscita
						</button>
					</div>
				</div>
			)}

			{/* div per somma movimenti filtrati */}
			{/* {filteredMovCC().length > 0 && ( */}
			<div class="flex-none text-sm text-left text-gray-500 ml-2 mt-4">
				Movimenti{" "}
				<span class="font-semibold">{movementFilter() === "all" ? "" : `${movementFilter() === "inEntrata" ? "in entrata" : "in uscita"}`}</span>
				<span class="font-semibold">{showWithoutType() ? " (senza Tipo)" : ""}</span> dal{" "}
				<span class="font-semibold">{startDate() ? formatDate(startDate()) : formatDate(firstOpDate())}</span> al{" "}
				<span class="font-semibold">{endDate() ? formatDate(endDate()) : formatDate(lastOpDate())}</span> (
				<span class={`${filteredMovCC().reduce((acc, row) => acc + parseFloat(row.importo), 0) > 0 ? "text-green-600" : "text-red-600"}`}>
					{filteredMovCC().reduce((acc, row) => acc + parseFloat(row.importo), 0).toLocaleString("it-IT", {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})} €
				</span>)
			</div>
			{/* )} */}

			{/* tabella movimenti cc */}
			<div class={`flex flex-col h-full mt-2 ${isLandscape() ? "text-[18px]" : "text-[10px]"} w-full`}>
				{filteredMovCC().length > 0 ? (
					// Container scrollabile con altezza fissa
					<div class="flex-grow w-full overflow-y-auto pb-[300px]">
						<table class="table-fixed w-full">
							<thead class="bg-gray-100 sticky top-0 z-10">
								<tr>
									<th class="px-1 py-1 w-[15%]">Data Op</th>
									<th class="px-1 py-1 w-[50%]">Descrizione</th>
									<th class="px-1 py-1 w-[15%]">Importo</th>
									<th class="px-1 py-1 w-[20%]">Tipo</th>
								</tr>
							</thead>
							<tbody>
								{filteredMovCC().map((row) => (
									<tr class={`${row.importo > 0 ? "bg-green-50" : "bg-red-50"} h-10`} key={row.id}>
										<td class="border-b border-gray-200 px-1 py-1 text-center">{formatDate(row.data_operazione)}</td>
										<td class="border-b border-gray-200 px-1 py-1 break-words">{row.descrizione}</td>
										<td class="border-b border-gray-200 px-1 py-1 text-right">
											{row.importo.toLocaleString("it-IT", {
												minimumFractionDigits: 0,
												maximumFractionDigits: 2,
											})}
										</td>
										<td
											class={`border-b border-gray-200 px-1 py-1 text-center cursor-pointer ${!row.tipo || row.tipo.trim() === "" ? "text-red-500 font-semibold" : "underline text-blue-600"}`}
											onClick={() => {
												setSelectedRow(row);
												setShowPopup(true);
											}}
										>
											{!row.tipo || row.tipo.trim() === "" ? "Tipo mancante!" : row.tipo}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<div class="flex h-full items-center justify-center text-xl">
						Nuessun movimento corrispondente ai termini della ricerca
					</div>
				)}
			</div>


			{showPopup() && (
				<div class="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-20"
					onClick={() => setShowPopup(false)}>
					<div class={`relative ${selectedRow().importo > 0 ? "bg-green-50" : "bg-red-50"} p-4 rounded-lg shadow-lg w-[90%]`}>
						<button
							onClick={() => setShowPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>
						<h3 class="text-lg text-center font-semibold mb-2">Seleziona Tipo</h3>
						{getOptions(selectedRow().importo).map((option) => (
							<div
								key={option}
								class={`p-2 text-center cursor-pointer hover:bg-gray-200 
									${selectedRow().tipo === option ? `${selectedRow().importo > 0 ? "bg-green-500 text-white" : "bg-red-500 text-white"}` : ""}`}
								onClick={() => updateTipo(selectedRow().id, option)}
							>
								{option}
							</div>
						))}

					</div>
				</div>
			)}

		</div>
	);
};

export default EstrattoCC;
