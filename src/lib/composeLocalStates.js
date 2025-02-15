import { cashflow } from "./composeCashflow";

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
				tipo: "Quadratura",
				importo: -row.importo, // Segno negativo
				descrizione: "Quadratura trasferimento da CASH a CC",
			});
		} else if (row.tipo === "Trasf CC -> CASH") {
			acc.push({
				id: null, // Campo id vuoto
				origin: "CASH",
				data_operazione: row.data_operazione,
				tipo: "Quadratura",
				importo: -row.importo, // Segno invertito
				descrizione: "Quadratura trasferimento da CC a CASH",
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

	// Aggiorniamo lo stato locale cashflow
	setCashflow(combinedCashflow);
	//console.log(cashflow());
};

export default composeLocalStates;
