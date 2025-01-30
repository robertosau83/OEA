import { createSignal, onMount } from "solid-js";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "../lib/supabaseClient"; // Assicurati che il client Supabase sia configurato

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs";

const MovCC = ({ movCC, setMovCC }) => {
  //const [movCC, setMovCC] = createSignal([]);
  const [fileName, setFileName] = createSignal(null);

  // Esegui il caricamento automatico dei dati dal database all'avvio del componente
  onMount(() => {
  });

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

    let i = 0;
    while (i < allTextContent.length) {
      const text = allTextContent[i].str;

      if (isDate(text) && currentRow.length === 0) {
        //console.log(currentRow, currentRow.length, text);
        currentRow.push(text); // Primo campo (data)
        i++;
        continue;
      }

      if (isDate(text) && currentRow.length === 1) {
        // Punto 2: La seconda data
        currentRow.push(text); // Secondo campo (data)
        i++;
        continue;
      }

      if (currentRow.length >= 2 && !isCurrency(text) && !isDecimal(text) && text.trim() !== "") {
        console.log(text);
        // Punto 3: Campi testuali (joinati)
        if (!currentRow[2]) {
          currentRow[2] = text; // Inizializza il terzo campo
        } else {
          currentRow[2] += ` ${text}`; // Concatena i campi testuali
        }
        i++;
        continue;
      }

      if (isDecimal(text) && currentRow.length === 3) {
        currentRow.push(text); // Quarto campo (valore numerico)
        rows.push(currentRow);
        currentRow = []; // Ripartiamo con una nuova riga
        i++;
        continue;
      }

      i++;
    }

    //console.log("Righe estratte:", rows);
    setMovCC(rows); // Imposta lo stato con le righe elaborate
  };

  const formatDate = (date) => {
    if (!date) return "";
    const [year, month, day] = date.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <div class="text-center overflow-y-auto h-[calc(100vh-140px)]">

      <div class="flex items-center justify-between h-[50px]">
        <div class="pl-2 text-lg font-semibold">
          Saldo CC: 
          
          <span class="text-green-800">{movCC().reduce((acc, row) => acc + parseFloat(row.importo), 0).toLocaleString("it-IT", {
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

      <div class="mt-8 text-xs">
        {movCC().length > 0 && (
          <table class="table-auto border-collapse border border-gray-500 mx-auto">
            <thead>
              <tr>
                <th class="border border-gray-400 px-4 py-2">Data Operazione</th>
                <th class="border border-gray-400 px-4 py-2">Data Valuta</th>
                <th class="border border-gray-400 px-4 py-2">Descrizione</th>
                <th class="border border-gray-400 px-4 py-2 text-right">Importo</th>
              </tr>
            </thead>
            <tbody>
              {movCC().map((row) => (
                <tr class={`${row.importo > 0 ? "bg-green-100" : "bg-red-100"}`} key={row}>
                  <td class="border border-gray-400 px-4 py-2">{formatDate(row.data_operazione)}</td>
                  <td class="border border-gray-400 px-4 py-2">{formatDate(row.data_valuta)}</td>
                  <td class="border border-gray-400 px-4 py-2">{row.descrizione}</td>
                  <td class="border border-gray-400 px-4 py-2 text-right">
                    {row.importo.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2, })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MovCC;
