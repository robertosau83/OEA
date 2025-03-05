import { supabase } from "../lib/supabaseClient.js"; // Assicurati che il percorso sia corretto

const loadDataFromDB = async (setChiusure, setCash, setCC, setForniture, setBudget) => {
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
    const { data: ccData, error: ccError } = await supabase
      .from('CC')
      .select('*')
		.order('prg', { ascending: false }); // Ordina per 'prg' in ordine decrescente
    if (ccError) throw ccError;

    setCC(ccData || []);

	 // Fetch movimenti dalla tabella forniture
    const { data: fornitureData, error: fornitureError } = await supabase
      .from('forniture')
      .select('*')
		.order('data_scadenza', { ascending: true }); // Ordina per 'data_scadenza' in ordine decrescente
    if (fornitureError) throw fornitureError;

    setForniture(fornitureData || []);
 
	 // Fetch movimenti dalla tabella forniture
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
