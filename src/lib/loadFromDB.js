import { supabase } from './supabaseClient';

// Funzione per caricare gli incassi dal database
export const loadIncassi = async () => {
  const { data, error } = await supabase.from('incassi').select('*');

  if (error) {
    console.error('Errore durante il caricamento degli incassi:', error.message);
    return [];
  }

  return data || [];
};
