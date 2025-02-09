import { createSignal } from "solid-js";
import { supabase } from "../lib/supabaseClient.js"; // Assicurati che il percorso sia corretto

const [cashflow, setCashflow] = createSignal([]);

const composeCashflow = async () => {
  try {
    // Fetch spese dalla tabella CASH
    const { data: cashData, error: cashError } = await supabase
      .from('CASH')
      .select('*');
    if (cashError) throw cashError;

    // Aggiungi il campo origin="CASH" ai movimenti di CASH
    const transformedCashData = cashData.map(row => ({
      ...row,
      origin: "CASH",
    }));

    // Fetch movimenti dalla tabella CC
    const { data: ccData, error: ccError } = await supabase
      .from('CC')
      .select('*');
    if (ccError) throw ccError;

    // Trasforma i dati di CC per adattarli alla struttura di cashflow
    const transformedCCData = ccData.map(row => ({
      id: row.id,
      origin: "CC",
      data_operazione: row.data_operazione,
      tipo: row.tipo,
      importo: row.importo,
      descrizione: row.descrizione,
    }));

    // Creazione dei movimenti di quadratura per trasferimenti tra CASH e CC
    const quadrature = [];

    ccData.forEach(row => {
      if (row.tipo === "Trasf CASH -> CC") {
        // Corrispettivo negativo in CASH per il trasferimento verso CC
        quadrature.push({
          id: null, // Campo id vuoto
          origin: "CASH",
          data_operazione: row.data_operazione,
          tipo: row.tipo,
          importo: -row.importo, // Segno negativo
          descrizione: "Quadratura trasferimento da CASH a CC",
        });
      } else if (row.tipo === "Trasf CC -> CASH") {
        // Corrispettivo positivo in CASH per il trasferimento da CC
        quadrature.push({
          id: null, // Campo id vuoto
          origin: "CASH",
          data_operazione: row.data_operazione,
          tipo: row.tipo,
          importo: -row.importo, // Segno invertito (positivo)
          descrizione: "Quadratura trasferimento da CC a CASH",
        });
      }
    });

    // Fetch movimenti dalla tabella Incassi
    const { data: incassiData, error: incassiError } = await supabase
      .from('incassi')
      .select('*');
    if (incassiError) throw incassiError;

    // Trasforma i dati di CC per adattarli alla struttura di cashflow
    const transformedIncassiData = incassiData.map(row => ({
      id: row.id,
      origin: "CONTANTI CASSA",
      data_operazione: row.data_competenza,
      tipo: "Incasso contanti",
      importo: row.contanti_cassa_lordo_spese_serata,
      descrizione: `Incasso contanti del ${row.data_competenza}`, // Formattazione della descrizione
    }));

    // Unisci i dati di CASH, CC e quadrature
    setCashflow([...transformedCashData, ...transformedCCData, ...quadrature, ...transformedIncassiData]);
  } catch (error) {
    console.error("Errore nel caricamento del cashflow:", error.message);
  }
};

export { cashflow, setCashflow, composeCashflow };
