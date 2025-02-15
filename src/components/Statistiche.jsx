import { createSignal, createMemo, onMount } from "solid-js";
import ApexCharts from "apexcharts";

const Statistiche = (props) => {
	const { cc, cash, chiusureConSpese, cashflow } = props;
	const [selectedTag, setSelectedTag] = createSignal("Mese corrente"); // Default: ultimi 12 mesi
	const tags = ["Mese corrente", "12 mesi", "Da inizio anno"];

	const today = new Date();
	const currentYear = today.getFullYear();
	const currentMonth = today.getMonth() + 1; // Mese attuale (1-12)
	const last12Months = new Date(today);
	last12Months.setFullYear(last12Months.getFullYear() - 1);

	// Funzione per raggruppare i dati giornalmente o mensilmente
	const groupData = (data, mode) => {
		const groupedData = new Map();

		data.forEach(item => {
			const date = new Date(item.data_competenza);
			let key;

			if (mode === "daily") {
				key = `${date.getDate()}-${date.getMonth() + 1}`; // Es. "5-2" per 5 Febbraio
			} else {
				key = `${date.getFullYear()}-${date.getMonth() + 1}`; // Es. "2024-1" per Gennaio 2024
			}

			if (!groupedData.has(key)) {
				groupedData.set(key, {
					total: 0,
					label: mode === "daily"
						? `${date.getDate()} ${date.toLocaleString("it-IT", { month: "short" })}`
						: `${date.toLocaleString("it-IT", { month: "short" })}-${date.getFullYear().toString().slice(-2)}`
				});
			}
			groupedData.get(key).total += item.chiusura_lorda_reale;
		});

		return Array.from(groupedData.entries())
			.map(([key, value]) => ({ label: value.label, total: value.total }))
			.sort((a, b) => new Date(`20${a.label.split("-")[1]}`) - new Date(`20${b.label.split("-")[1]}`));
	};

	// Dati filtrati in base alla tag selezionata
	const filteredData = createMemo(() => {
		const rawData = chiusureConSpese();
		if (selectedTag() === "Mese corrente") {
			return groupData(
				rawData.filter(item => {
					const date = new Date(item.data_competenza);
					return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
				}),
				"daily"
			);
		}
		if (selectedTag() === "12 mesi") {
			return groupData(
				rawData.filter(item => {
					const date = new Date(item.data_competenza);
					return date >= last12Months;
				}),
				"monthly"
			);
		}
		if (selectedTag() === "Da inizio anno") {
			return groupData(
				rawData.filter(item => {
					const date = new Date(item.data_competenza);
					return date.getFullYear() === currentYear;
				}),
				"monthly"
			);
		}
		return [];
	});

	// Calcolo del massimo valore Y arrotondato
	const maxYValue = createMemo(() => {
		const rawMaxYValue = Math.max(...filteredData().map(item => item.total), 0) * 1.1;
		return Math.ceil(rawMaxYValue / 500) * 500;
	});

	// Configurazione del grafico
	const chartOptions = createMemo(() => ({
		chart: {
			type: "bar",
			height: 350,
			toolbar: { show: false }
		},
		series: [
			{
				name: "Contanti Cassa",
				data: filteredData().map(item => item.total)
			}
		],
		xaxis: {
			categories: filteredData().map(item => item.label),
			labels: { show: true },
			title: { text: "" }
		},
		yaxis: {
			max: maxYValue(),
			min: 0,
			labels: {
				formatter: (val) => val.toLocaleString("it-IT", { maximumFractionDigits: 0 })
			},
			title: { text: "" }
		},
		dataLabels: { enabled: false },
		grid: { show: true }
	}));

	// Inizializza il grafico dopo il montaggio del componente
	onMount(() => {
		const chart = new ApexCharts(document.querySelector("#chart"), chartOptions());
		chart.render();

		// Aggiornamento dinamico quando cambiano i dati
		const updateChart = () => {
			chart.updateOptions(chartOptions());
		};

		// Aggiorna il grafico quando cambiano i dati
		createMemo(updateChart);
	});

	return (
		<div class="flex flex-col h-full justify-center px-2">
			{/* Barra superiore con i tag */}
			<div class="flex flex-none items-center justify-center space-x-2 my-5">
				{tags.map((tag) => (
					<div
						class={`text-sm px-2 py-2 border rounded-xl cursor-pointer select-none ${selectedTag() === tag ? "bg-blue-500 text-white" : "bg-white text-black"
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
				<div class="border rounded shadow-lg bg-white">
					<h3 class="text-center text-lg font-semibold my-3">Chiusure</h3>
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
