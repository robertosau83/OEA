export const processPDFContent_BancaBologna = (allTextContent) => {

	console.log("All Text Content:", allTextContent); // Log per il debug

	const rows = [];

	const isDate = (str) => /^\d{2}\/\d{2}\/\d{4}$/.test(str);
	const isImport = (str) => /^[+-]\s?\d{1,3}(\.\d{3})*,\d{2}\s?€$/.test(str);
	const isEmpty = (str) => str === ' ' || str === '';
	const isNotEmptyText = (str) => !isEmpty(str) && str.trim() !== '';

	const cleanImport = (str) =>
		parseFloat(str.replace("€", "").replace(/\./g, "").replace(",", ".").replace(/\s/g, ""));

	let i = 0;
	while (i < allTextContent.length - 6) {
		const t0 = allTextContent[i]?.str;
		const t1 = allTextContent[i + 1]?.str;
		const t2 = allTextContent[i + 2]?.str;
		const t3 = allTextContent[i + 3]?.str;
		const t4 = allTextContent[i + 4]?.str;
		const t5 = allTextContent[i + 5]?.str;
		const t6 = allTextContent[i + 6]?.str;

		if (
			isDate(t0) &&
			isEmpty(t1) &&
			isDate(t2) &&
			isEmpty(t3) &&
			isImport(t4) &&
			isEmpty(t5) &&
			isNotEmptyText(t6)
		) {
			// Estensione della descrizione oltre i+6
			let descrizioneParts = [];
			let j = i + 6;
			let stopIndex = null;

			while (j < allTextContent.length) {
				if (isEmpty(allTextContent[j].str)) {
					stopIndex = j - 2;
					break;
				}
				j++;
			}

			// Se non troviamo un empty, concateniamo tutto da i+6 in avanti
			stopIndex = stopIndex ?? allTextContent.length - 1;

			for (let k = i + 6; k <= stopIndex; k++) {
				descrizioneParts.push(allTextContent[k].str.trim());
			}

			i = stopIndex + 1;

			const currentRow = {
				data_operazione: t0,
				data_valuta: t2,
				importo: cleanImport(t4),
				descrizione: descrizioneParts.join(" ")
			};

			currentRow.tipo = decodeTipo(currentRow.importo, currentRow.descrizione);
			currentRow.codice_identificativo = 0;

			rows.push(currentRow);
			i = j; // Continua dal primo elemento dopo la descrizione
		} else {
			i++;
		}
	}

	rows.reverse();
	console.log("Rows dopo reverse:", rows);
	return rows;
};

const decodeTipo = (importo, descrizione) => {

	if (importo > 0 && descrizione.includes("Satispay")) {
		return "Satispay";
	}

	if (importo > 0 && (descrizione.includes("INCASSO TRAMITE P.O.S. ACCR. TRANSATO") || (descrizione.includes("WORLDLINE MERCHANT SERVICES ITALIA")))) {
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
		descrizione.includes("COMM. SU TRANSATO") ||
		descrizione.includes("COMMISSIONI Pag")
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

