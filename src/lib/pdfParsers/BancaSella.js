export const processPDFContent_BancaSella = (allTextContent) => {
	const rows = []; // Array per memorizzare le righe
	let currentRow = []; // Array temporaneo per costruire la riga corrente

	const isDate = (str) => /^\d{2}\/\d{2}\/\d{4}$/.test(str); // Controlla se è una data
	const isDecimal = (str) => /^[+-]?\d+(\.\d{1,2}|,\d{1,2})$/.test(str); // Controlla se è un numero decimale
	const isCurrency = (str) => str === "EUR"; // Controlla se è "EUR"

	//console.log(allTextContent);

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

	return rows;
};

const decodeTipo = (importo, descrizione) => {

	if (importo > 0 && descrizione.includes("Satispay")) {
		return "Satispay";
	}

	if (importo > 0 && (descrizione.includes("BS 326251807168") || descrizione.includes("POS6251807/00001"))) {
		return "Incassi POS";
	}

	if (importo < 0 && (
		descrizione.includes("AMAZON") ||
		descrizione.includes("AMZN") ||
		descrizione.includes("Amazon") ||
		descrizione.includes("TEMU.COM")
	)) {
		return "Acquisti attività";
	}

	if (importo < 0 && (
		descrizione.includes("ADDEBITO CANONE SMART BUSINESS SELLA") ||
		descrizione.includes("COMM.PRELIEVO CONTANTE") ||
		descrizione.includes("CANONE DEL CONTO") ||
		descrizione.includes("SPESE PER CONTEGGIO INTERESSI E COMPETENZE") ||
		descrizione.includes("Addebito commissione estinzione assegno") ||
		descrizione.includes("Comm.Bon.Altra Banca") ||
		descrizione.includes("COMM 326251807168") ||
		descrizione.includes("COM6251807/00001")
	)) {
		return "Spese bancarie";
	}

	if (importo < 0 && (
		descrizione.includes("ASCOM") ||
		descrizione.includes("STIPENDIO")
	)) {
		return "Dipendenti";
	}

	if (importo < 0 && (
		descrizione.includes("UNOENERGY") ||
		descrizione.includes("ILIAD")
	)) {
		return "Utenze";
	}

	if (importo < 0 && (
		descrizione.includes("PARTESA") ||
		descrizione.includes("IPERTOSANO") ||
		descrizione.includes("LODI DISTRIBUZIONE")
	)) {
		return "Fornitori";
	}
	// Valore predefinito se nessuna condizione è soddisfatta
	return "";
};