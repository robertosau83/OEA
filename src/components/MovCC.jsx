import { createSignal, onMount } from "solid-js";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "../lib/supabaseClient"; // Assicurati che il client Supabase sia configurato
import decodeTipo from "../lib/decodeTipo"; // Importa la funzione decodeTipo

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";

const MovCC = ({ movCC, setMovCC }) => {
  //const [movCC, setMovCC] = createSignal([]);
  const [fileName, setFileName] = createSignal(null);
  const [importedMovCC, setImportedMovCC] = createSignal([]);
  const [startDate, setStartDate] = createSignal("");
  const [endDate, setEndDate] = createSignal("");
  const [showWithoutType, setShowWithoutType] = createSignal(false);
  const [filteredMovCC, setFilteredMovCC] = createSignal([]);
  const [showPopup, setShowPopup] = createSignal(false);
  const [selectedRow, setSelectedRow] = createSignal(null);

  // Esegui il caricamento automatico dei dati dal database all'avvio del componente
  onMount(() => {
    //console.log(movCC());
    //setFilteredMovCC(movCC());
  });

  const filterMovements = () => {
    let filtered = movCC();

    if (startDate()) {
      console.log(startDate());
      filtered = filtered.filter((row) => convertDateToISO(row.data_operazione) >= startDate());
    }
    if (endDate()) {
      filtered = filtered.filter((row) => convertDateToISO(row.data_operazione) <= endDate());
    }
    if (showWithoutType()) {
      filtered = filtered.filter((row) => row.tipo === "");
    }

    console.log(filtered);

    setFilteredMovCC(filtered);
  };
  
  const convertDateToISO = (date) => {
    if (!date) return "";
    const [day, month, year] = date.split("/");
    return `${year}-${month}-${day}`;
  };

  const formatDate = (date) => {
    if (!date) return "";
    const [day, month, year] = date.split("/");
    return `${day}/${month}/${year.slice(-2)}`; // Prende solo le ultime due cifre dell'anno
  };

  const getOptions = (importo) => {
    return importo > 0
      ? ["Incassi POS", "Satispay", "Trasf CASH -> CC", "Deposito", "Altro"]
      : ["Comm. POS", "Prelievo", "Trasf CC -> CASH", "Fornitori", "Commercialista", "Acquisti online", "Bancarie", "Utenze", "Dipendenti", "Spese Personali", "Manutenzione", "Attrezzature", "Altro"];
  };

  const updateTipo = async (id, tipo) => {
    try {
      const { error } = await supabase
        .from("CC")
        .update({ tipo })
        .eq("id", id);

      if (error) throw error;

      // Aggiorna lo stato locale
      setMovCC(movCC().map((item) => 
        item.id === id ? { ...item, tipo } : item
      ));

      setFilteredMovCC(filteredMovCC().map((item) => 
        item.id === id ? { ...item, tipo } : item
      ));

      setShowPopup(false);
    } catch (err) {
      console.error("Errore aggiornando il tipo:", err.message);
    }
  };

  //Funzione per caricare il PDF dal disco
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      const fileReader = new FileReader();

      fileReader.onload = async () => {
        const typedArray = new Uint8Array(fileReader.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;

        let allTextContent = []; // Array per contenere tutti gli oggetti textContent.items

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          // Concatena gli oggetti estratti nella variabile globale
          allTextContent = allTextContent.concat(textContent.items);
        }

        // Passa l'array completo al prossimo step di elaborazione
        processPDFContent(allTextContent);
      };

      fileReader.readAsArrayBuffer(file);
    }
  };

  // Funzione per processare il contenuto del PDF
  const processPDFContent = (allTextContent) => {
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

      if (isDate(text) && !currentRow.data_valuta) {
        // Secondo campo: data valuta
        currentRow.data_valuta = text;
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

    setImportedMovCC(rows); // Imposta lo stato con le righe elaborate
    console.log(importedMovCC());
    processImportedMovements();
    //console.log(importedMovCC());
  };

  const processImportedMovements = async () => {
    if (!importedMovCC().length) return;

    // Se movCC è vuoto, inserisci tutti i movimenti da importedMovCC
    if (!movCC().length) {
      console.log("movCC è vuoto. Importazione di tutti i movimenti.");

      // Ottieni il numero progressivo iniziale
      const maxPrg = 0;

      // Aggiungi un nuovo prg ai movimenti
      const movementsWithPrg = importedMovCC()
        .map((movement, index, arr) => ({
          ...movement,
          prg: maxPrg + arr.length - index, // Assegna i prg in ordine inverso
        }))
        .reverse(); // Inverti l'array finale per mantenere l'ordine corretto

      // Costante per il database: conversione delle date a ISO
      const movementsForDB = movementsWithPrg.map((movement) => ({
        ...movement,
        data_operazione: convertDateToISO(movement.data_operazione),
        data_valuta: convertDateToISO(movement.data_valuta),
      }));

      try {
        // Inserisci nel database
        const { error } = await supabase.from("CC").insert(movementsForDB);
        if (error) {
          throw error;
        }

        console.log("Tutti i movimenti inseriti:", movementsWithPrg);

        // Aggiorna lo stato locale movCC con i nuovi movimenti
        const updatedMovCC = movementsWithPrg.sort((a, b) => b.prg - a.prg); // Ordina in ordine decrescente di prg
        setMovCC(updatedMovCC);

        return; // Esci dalla funzione
      } catch (err) {
        console.error("Errore durante l'inserimento dei movimenti:", err.message);
        return;
      }
    }

    // Se movCC non è vuoto, continua con l'elaborazione normale
    const matchingIndex = importedMovCC().findIndex((imported) =>
      movCC().some(
        (existing) =>
          imported.codice_identificativo === existing.codice_identificativo &&
          imported.data_operazione === existing.data_operazione &&
          imported.data_valuta === existing.data_valuta &&
          imported.descrizione === existing.descrizione &&
          imported.importo === existing.importo
      )
    );

    if (matchingIndex === -1) {
      alert("Nessuna corrispondenza trovata con i movimenti attuali.");
      return;
    }

    // Ottieni le righe da inserire
    const newMovements = importedMovCC().slice(0, matchingIndex);

    if (!newMovements.length) {
      alert("Nessun nuovo movimento da inserire.");
      return;
    }

    // Ottieni il prg massimo attuale
    const maxPrg = Math.max(...movCC().map((row) => row.prg));

    // Aggiungi un nuovo prg partendo dall'ultimo elemento dell'array
    const movementsWithPrg = newMovements
      .map((movement, index, arr) => ({
        ...movement,
        prg: maxPrg + arr.length - index, // Assegna i prg in ordine inverso
      }))
      .reverse(); // Inverti l'array finale per mantenere l'ordine corretto

    // Costante per il database: conversione delle date a ISO
    const movementsForDB = movementsWithPrg.map((movement) => ({
      ...movement,
      data_operazione: convertDateToISO(movement.data_operazione),
      data_valuta: convertDateToISO(movement.data_valuta),
    }));

    try {
      // Inserisci nel database
      const { error } = await supabase.from("CC").insert(movementsForDB);
      if (error) {
        throw error;
      }

      console.log("Nuovi movimenti inseriti:", movementsForDB);
      alert("Movimenti inseriti correttamente");
      // Aggiorna lo stato locale `movCC` con i nuovi movimenti
      const updatedMovCC = [...movementsWithPrg, ...movCC()].sort(
        (a, b) => b.prg - a.prg // Ordina in ordine decrescente di `prg`
      );

      setMovCC(updatedMovCC);
    } catch (err) {
      console.error("Errore durante l'inserimento dei nuovi movimenti:", err.message);
    }
  };

  return (
    <div class="text-center overflow-y-auto h-[calc(100vh-140px)]">

      <div class="flex items-center justify-between h-[50px]">
        <div class="pl-2 text-lg font-semibold">
          Saldo CC:
          <span class="text-green-800"> {movCC().reduce((acc, row) => acc + parseFloat(row.importo), 0).toLocaleString("it-IT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} €
          </span>
        </div>
        <div>
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            class="hidden"
            id="file-upload"
          />
          <label
            for="file-upload"
            class="cursor-pointer bg-blue-500 text-white py-2 px-4 mr-2 rounded-lg hover:bg-blue-600"
          >
            Importa PDF
          </label>
        </div>
      </div>

      <div class="justify-center space-x-4 my-4">
        <input
          type="date"
          value={startDate()}
          onInput={(e) => setStartDate(e.target.value)}
          class="border px-2 py-1 rounded"
          placeholder="Data inizio"
        />
        <input
          type="date"
          value={endDate()}
          onInput={(e) => setEndDate(e.target.value)}
          class="border px-2 py-1 rounded"
          placeholder="Data fine"
        />
        <label class="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showWithoutType()}
            onChange={() => setShowWithoutType(!showWithoutType())}
          />
          <span>Visualizza movimenti senza tipo</span>
        </label>
        <button
          onClick={filterMovements}
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          CERCA
        </button>
      </div>

      <div class="mt-8 text-[10px] w-full overflow-x-auto">
        {filteredMovCC().length > 0 && (
          <div class="w-full overflow-hidden">
            <table class="table-fixed border-collapse border border-gray-500 w-full">
              <thead>
                <tr class="">
                  <th class="border border-gray-400 px-1 py-1 w-[15%]">Data Op</th>
                  {/* <th class="border border-gray-400 px-1 py-1 w-[15%]">Data Valuta</th> */}
                  <th class="border border-gray-400 px-1 py-1 w-[50%]">Descrizione</th>
                  <th class="border border-gray-400 px-1 py-1 w-[15%]">Importo</th>
                  <th class="border border-gray-400 px-1 py-1 w-[20%]">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovCC().map((row) => (
                  <tr class={`${row.importo > 0 ? "bg-green-100" : "bg-red-100"} h-10`} key={row}>
                    <td class="border border-gray-400 px-1 py-1 text-center">{formatDate(row.data_operazione)}</td>
                    {/* <td class="border border-gray-400 px-1 py-1 text-center">{formatDate(row.data_valuta)}</td> */}
                    <td class="border border-gray-400 px-1 py-1 break-words">{row.descrizione}</td>
                    <td class="border border-gray-400 px-1 py-1 text-right">
                      {row.importo.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td class="border border-gray-400 px-1 py-1 text-center cursor-pointer underline text-blue-600" onClick={() => { setSelectedRow(row); setShowPopup(true); }}>
                      {row.tipo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPopup() && (
        <div class="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50">
          <div class="bg-white p-4 rounded-lg shadow-lg w-64">
            <h3 class="text-lg font-semibold mb-2">Seleziona Tipo</h3>
            {getOptions(selectedRow().importo).map((option) => (
              <div key={option} class="p-2 cursor-pointer hover:bg-gray-200" onClick={() => updateTipo(selectedRow().id, option)}>
                {option}
              </div>
            ))}
            <button class="mt-4 w-full bg-red-500 text-white py-2 rounded-lg" onClick={() => setShowPopup(false)}>Annulla</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MovCC;
