import { createSignal, onMount } from "solid-js";
import ApexCharts from "apexcharts";

const Statistiche = (props) => {
	const { cc, cash, chiusureConSpese, cashflow } = props;
	const [selectedTag, setSelectedTag] = createSignal(null);
	const tags = ["Tag 1", "Tag 2", "Tag 3"];
	// Otteniamo i dati e li ordiniamo per data_competenza dalla meno recente alla più recente
	const rawData = chiusureConSpese();
	const data = rawData.sort(
		(a, b) => new Date(a.data_competenza) - new Date(b.data_competenza)
	);
	const rawMaxYValue = Math.max(...data.map(item => item.chiusura_lorda_reale)) * 1.1;
	const maxYValue = Math.ceil(rawMaxYValue / 500) * 500; // Arrotonda al multiplo di 500 più vicino per eccesso


	console.log(data);
	// Configurazione del grafico
	const chartOptions = {
		chart: {
			type: "bar",
			height: 350,
			toolbar: { show: false } // ❌ Disabilita il menu di esportazione
		},
		series: [
			{
				name: "Contanti Cassa",
				data: data.map((item) => item.chiusura_lorda_reale)
			}
		],
		xaxis: {
			categories: data.map((item) => item.data_competenza),
			labels: { show: false }, // ❌ Nasconde le etichette dell'asse X
			title: { text: "" } // ❌ Rimuove il titolo dell'asse X
		},
		yaxis: {
			max: maxYValue, // Imposta il massimo valore dinamicamente
			min: 0,
			//tickAmount: 5, // Imposta 5 suddivisioni equidistanti sull'asse Y
			labels: {
				formatter: (val) => val.toLocaleString("it-IT", { maximumFractionDigits: 0 })
			},
			title: { text: "" } // ❌ Rimuove il titolo dell'asse Y
		},
		dataLabels: { enabled: false }, // ❌ Nasconde i valori sulle colonne
		grid: { show: false } // ❌ Nasconde la griglia di sfondo
	};

	// Inizializza il grafico dopo il montaggio del componente
	onMount(() => {
		const chart = new ApexCharts(document.querySelector("#chart"), chartOptions);
		chart.render();
	});

	return (
		<div class="flex flex-col h-full p-5">
			{/* Barra superiore con i tag */}
			<div class="flex flex-none space-x-2 mb-5">
				{tags.map((tag) => (
					<div
						class={`px-4 py-2 border rounded cursor-pointer select-none ${selectedTag() === tag ? "bg-blue-500 text-white" : "bg-white text-black"
							}`}
						onClick={() => setSelectedTag(tag)}
					>
						{tag}
					</div>
				))}
			</div>

			{/* Grid responsive per le cards */}
			<div class="flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{/* Card con il grafico a barre */}
				<div class="border rounded shadow">
					<h3 class="text-lg font-semibold mb-3">Andamento Chiusure Con Spese</h3>
					<div id="chart" class="w-full h-72"></div>
				</div>

				{/* Card fittizia 1 */}
				<div class="p-5 border rounded shadow">
					<h3 class="text-lg font-semibold mb-3">Statistiche Fittizie 1</h3>
					<p>Contenuto fittizio per la seconda card.</p>
				</div>

				{/* Card fittizia 2 */}
				<div class="p-5 border rounded shadow">
					<h3 class="text-lg font-semibold mb-3">Statistiche Fittizie 2</h3>
					<p>Contenuto fittizio per la terza card.</p>
				</div>
			</div>
		</div>
	);
};

export default Statistiche;
