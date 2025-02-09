import { createSignal } from "solid-js";
import { supabase } from "../lib/supabaseClient.js"; // Assicurati che il percorso sia corretto

const loadDataFromDB = async (setChiusure, setCash, setCC) => {
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
      .select('*');
    if (ccError) throw ccError;

    setCC(ccData || []);
    
  } catch (error) {
    console.error("Errore nel caricamento dei dati dal DB:", error.message);
  }
};

export default loadDataFromDB;
