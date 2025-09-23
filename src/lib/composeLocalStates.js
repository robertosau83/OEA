const composeLocalStates = (chiusure, cash, cc, setChiusureConSpese, setCashflow) => {

	//console.log(cash);

	// Componiamo lo stato locale chiusureConSpese
	const newChiusure = chiusure.map((chiusuraItem) => {
		// Filtra gli elementi cash in base alla data e al metodo di pagamento
		const filteredCash = cash.filter(
			(cashItem) =>
				cashItem.data_operazione === chiusuraItem.data_competenza &&
				cashItem.metodo_di_pagamento === "Presi dalla cassa in serata"
		);

		// Calcola la somma degli importi degli elementi filtrati
		const spese_serata = filteredCash.reduce(
			(total, cashItem) => total + Number(cashItem.importo),
			0
		);

		// Rinomina il campo contanti_cassa in contanti_cassa_netto_spese_serata
		// Utilizziamo la destrutturazione per estrarre contanti_cassa e mantenere il resto delle proprietà
		const { contanti_cassa, ...rest } = chiusuraItem;
		const contanti_cassa_netto_spese_serata = Number(contanti_cassa);

		// Calcola il totale lordo: netto + spese della serata
		const contanti_cassa_lordo_spese_serata =
			contanti_cassa_netto_spese_serata - spese_serata;

		// Calcola il campo chiusura_lorda_reale:
		// somma di contanti_cassa_lordo_spese_serata, carte e satispay
		const chiusura_lorda_reale =
			contanti_cassa_lordo_spese_serata +
			Number(chiusuraItem.carte) +
			Number(chiusuraItem.satispay);

		const gap = chiusura_lorda_reale - Number(chiusuraItem.battuti_cassa);

		// Restituisce l'oggetto aggiornato con i nuovi campi
		return {
			...rest,
			spese_serata,
			contanti_cassa_netto_spese_serata,
			contanti_cassa_lordo_spese_serata,
			chiusura_lorda_reale,
			gap,
		};
	});

	// Ordina newChiusure per data_competenza (dal meno recente al più recente)
	const sortedChiusure = newChiusure.sort((a, b) => new Date(a.data_competenza) - new Date(b.data_competenza));

	// Aggiorna lo stato locale con il nuovo array di chiusure ordinato
	setChiusureConSpese(sortedChiusure);

	// Componiamo lo stato cashflow derivante dai movimenti di chiusureConSpese
	const cashflowFromChiusure = newChiusure.map((row) => ({
		id: row.id,
		origin: "CONTANTI CASSA",
		data_operazione: row.data_competenza,
		tipo: "Incasso contanti",
		importo: row.contanti_cassa_lordo_spese_serata,
		descrizione: `Incasso contanti del ${row.data_competenza}`,
	}));

	// Componiamo lo stato cashflow a partire dallo stato cash, aggiungendo origin: "CASH"
	const cashflowFromCash = cash.map((row) => ({
		...row,
		origin: "CASH",
	}));

	// Componiamo lo stato cashflow a partire dallo stato cc, mantenendo solo i campi coincidenti
	// e aggiungendo origin: "CC"
	const cashflowFromCC = cc.map((row) => {
		// Supponiamo che i campi coincidenti siano: id, data_operazione, tipo, importo, descrizione
		const { id, data_operazione, tipo, importo, descrizione } = row;
		return {
			id,
			origin: "CC",
			data_operazione,
			tipo,
			importo,
			descrizione,
		};
	});

	// Per ogni movimento di cc() con tipo "Trasf CASH -> CC" o "Trasf CC -> CASH"
	// aggiungiamo una istanza in cashflow con il movimento inverso in origin "CASH"
	const cashflowTransfers = cc.reduce((acc, row) => {
		if (row.tipo === "Trasf CASH -> CC") {
			acc.push({
				id: null, // Campo id vuoto
				origin: "CASH",
				data_operazione: row.data_operazione,
				tipo: "Storno",
				importo: -row.importo, // Segno negativo
				descrizione: "Storno trasferimento da CASH a CC",
			});
		} else if (row.tipo === "Trasf CC -> CASH") {
			acc.push({
				id: null, // Campo id vuoto
				origin: "CASH",
				data_operazione: row.data_operazione,
				tipo: "Storno",
				importo: -row.importo, // Segno invertito
				descrizione: "Storno trasferimento da CC a CASH",
			});
		}
		return acc;
	}, []);

	// Combiniamo tutti gli array per formare lo stato cashflow finale
	const combinedCashflow = [
		...cashflowFromChiusure,
		...cashflowFromCash,
		...cashflowFromCC,
		...cashflowTransfers,
	];

	// Ordina cashflow per data_operazione (dal meno recente al più recente)
	const sortedCashflow = combinedCashflow.sort((a, b) => new Date(a.data_operazione) - new Date(b.data_operazione));

	// Aggiorniamo lo stato locale cashflow con i dati ordinati
	setCashflow(sortedCashflow);

	// --- EXPORT AUTOMATICO CSV ---
// try {
//   const csvString = toCSV(sortedCashflow);
//   const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
//   const today = new Date().toISOString().slice(0, 10); // es. 2025-09-22
//   downloadBlob(blob, `cashflow_${today}.csv`);
// } catch (err) {
//   console.error("Errore durante l'esportazione CSV:", err);
// }

// --- (OPZIONALE) EXPORT XLSX con SheetJS ---
// Richiede la libreria 'xlsx' (es. import * as XLSX from 'xlsx' oppure via CDN che espone window.XLSX)
/*
try {
  if (window.XLSX) {
    const ws = window.XLSX.utils.json_to_sheet(sortedCashflow);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Cashflow");
    const wbout = window.XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const xlsBlob = new Blob(
      [wbout],
      { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );
    const today = new Date().toISOString().slice(0, 10);
    downloadBlob(xlsBlob, `cashflow_${today}.xlsx`);
  }
} catch (err) {
  console.error("Errore durante l'esportazione XLSX:", err);
}
*/

};

// Converte un array di oggetti in CSV con intestazioni dinamiche
const toCSV = (rows) => {
  if (!rows || rows.length === 0) return "";

  const headerSet = new Set(Object.keys(rows[0]));
  for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k);
  const headers = Array.from(headerSet);

  const escapeCell = (h, v) => {
    if (v === null || v === undefined) return "";

    // Se è il campo importo → forza il formato con virgola
    if (h === "importo" && !isNaN(v)) {
      return String(v).replace(".", ",");
    }

    const s = String(v);
    // Se contiene caratteri critici, racchiudi tra doppi apici
    if (/[\";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const sep = ";"; // separatore colonne
  const headerLine = headers.map((h) => escapeCell(h, h)).join(sep);
  const lines = rows.map((row) =>
    headers.map((h) => escapeCell(h, row[h])).join(sep)
  );

  return [headerLine, ...lines].join("\r\n");
};


// Scarica un Blob come file dal browser
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};


export default composeLocalStates;
