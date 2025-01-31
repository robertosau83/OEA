const decodeTipo = (importo, descrizione) => {

    if (importo > 0 && descrizione.includes("Satispay")) {
        return "Satispay";
    }

    if (importo > 0 && (descrizione.includes("BS 326251807168") || descrizione.includes("POS6251807/00001"))) {
        return "Incassi POS";
    }

    if (importo < 0 && (descrizione.includes("COMM 326251807168") || descrizione.includes("COM6251807/00001"))) {
        return "Comm. POS";
    }

    if (importo < 0 && (
        descrizione.includes("AMAZON") || 
        descrizione.includes("AMZN") ||
        descrizione.includes("Amazon") ||
        descrizione.includes("TEMU.COM")
    )) {
        return "Spese acquisti online";
    }

    if (importo < 0 && (
        descrizione.includes("ADDEBITO CANONE SMART BUSINESS SELLA") ||
        descrizione.includes("COMM.PRELIEVO CONTANTE") ||
        descrizione.includes("CANONE DEL CONTO") ||
        descrizione.includes("SPESE PER CONTEGGIO INTERESSI E COMPETENZE") ||
        descrizione.includes("Addebito commissione estinzione assegno") ||
        descrizione.includes("Comm.Bon.Altra Banca")
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

export default decodeTipo;
