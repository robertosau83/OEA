import { supabase } from "../lib/supabaseClient.js"; // Assicurati che il percorso sia corretto

const loadDataFromDB = async (setChiusure, setCash, setCC, setCCJson, setScadenze, setBudget) => {
	try {

		// Fetch chiusure dalla tabella chiusure
		const { data: chiusureData, error: chiusureError } = await supabase
			.from('chiusure')
			.select('*');
		if (chiusureError) throw chiusureError;

		setChiusure(chiusureData || []);

		// Fetch movimenti CASH dalla tabella CASH
		const { data: cashData, error: cashError } = await supabase
			.from('CASH')
			.select('*');
		if (cashError) throw cashError;

		setCash(cashData || []);

		// Fetch movimenti dalla tabella CC
		// const { data: ccData, error: ccError } = await supabase
		// 	.from('CC')
		// 	.select('*')
		// 	.order('prg', { ascending: false }); // Ordina per 'prg' in ordine decrescente
		// if (ccError) throw ccError;

		// setCC(ccData || []);

		// Fetch movimenti dalla tabella CCjson (campo JSONB 'movimenti')
		const { data: ccJsonData, error: ccJsonError } = await supabase
			.from('CCjson')
			.select('movimenti')
			.single(); // ci aspettiamo una sola riga per company

		if (ccJsonError) throw ccJsonError;

		const ccArray = ccJsonData?.movimenti || [];

		// Ordina per 'prg' decrescente come prima
		ccArray.sort((a, b) => b.prg - a.prg);

		//console.log(ccArray);

		setCC(ccArray);

		// Fetch movimenti dalla tabella scadenze
		const { data: scadenzeData, error: scadenzeError } = await supabase
			.from('scadenze')
			.select('*')
			.order('data_scadenza', { ascending: true }); // Ordina per 'data_scadenza' in ordine decrescente
		if (scadenzeError) throw scadenzeError;

		setScadenze(scadenzeData || []);

		// Fetch movimenti dalla tabella budget
		const { data: budgetData, error: budgetError } = await supabase
			.from('budget')
			.select('*')
		if (budgetError) throw budgetError;

		setBudget(budgetData || []);

	} catch (error) {
		console.error("Errore nel caricamento dei dati dal DB:", error.message);
	}
};

export default loadDataFromDB;
