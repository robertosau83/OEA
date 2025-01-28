import { createSignal } from "solid-js";
import * as pdfjsLib from "pdfjs-dist";

const MovCC = () => {
  const [tableData, setTableData] = createSignal([]);
  const [fileName, setFileName] = createSignal(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileName(file.name);
      const fileReader = new FileReader();

      fileReader.onload = async () => {
        const typedArray = new Uint8Array(fileReader.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;

        let extractedText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(" ");
          extractedText += pageText + "\n";
        }

        processPDFContent(extractedText); // Passiamo al passo successivo
      };

      fileReader.readAsArrayBuffer(file);
    }
  };

  const processPDFContent = (pdfText) => {
    // Questa funzione processa il contenuto del PDF e lo trasforma in una tabella
    const rows = pdfText
      .split("\n") // Dividi in righe
      .map((line) => line.trim())
      .filter((line) => line); // Rimuovi righe vuote

    const filteredRows = rows.filter(
      (row) => !row.toLowerCase().includes("intestazione") // Ignora intestazioni ripetute
    );

    const table = filteredRows.map((row) => row.split(/\s{2,}/)); // Dividi in colonne
    setTableData(table);
  };

  return (
    <div class="text-center text-2xl">
      <div class="mb-4">movCC</div>
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        class="hidden"
        id="file-upload"
      />
      <label
        for="file-upload"
        class="cursor-pointer bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
      >
        Importa PDF
      </label>
      {fileName() && (
        <div class="mt-4 text-sm text-gray-600">
          File caricato: {fileName()}
        </div>
      )}
      <div class="mt-8">
        {tableData().length > 0 && (
          <table class="table-auto border-collapse border border-gray-500 mx-auto">
            <thead>
              <tr>
                {tableData()[0].map((col, index) => (
                  <th key={index} class="border border-gray-400 px-4 py-2">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData()
                .slice(1)
                .map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        class="border border-gray-400 px-4 py-2"
                      >
                        {cell}
                      </td>
                    ))}
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
