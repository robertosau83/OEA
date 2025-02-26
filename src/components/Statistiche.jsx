import { createSignal, createMemo, onMount } from "solid-js";
import ApexCharts from "apexcharts";

const Statistiche = (props) => {
	const { cc, cash, chiusureConSpese, cashflow, forniture } = props;

	const [selectedTag, setSelectedTag] = createSignal("Da inizio"); // Default: ultimi 12 mesi
	const tags = ["Da inizio", "Mese corrente", "12 mesi", "Da inizio anno"];

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

	const groupCashflowData = (data, mode) => {
		const groupedData = new Map();

		data.forEach(item => {
			const date = new Date(item.data_operazione);
			let key;

			if (mode === "daily") {
				key = `${date.getDate()}-${date.getMonth() + 1}`;
			} else {
				key = `${date.getFullYear()}-${date.getMonth() + 1}`;
			}

			if (!groupedData.has(key)) {
				groupedData.set(key, {
					totalPos: 0,
					totalNeg: 0,
					label: mode === "daily"
						? `${date.getDate()} ${date.toLocaleString("it-IT", { month: "short" })}`
						: `${date.toLocaleString("it-IT", { month: "short" })}-${date.getFullYear().toString().slice(-2)}`
				});
			}

			if (item.importo >= 0) {
				groupedData.get(key).totalPos += item.importo;
			} else {
				groupedData.get(key).totalNeg += Math.abs(item.importo);
			}
		});

		return Array.from(groupedData.entries())
			.map(([key, value]) => ({
				label: value.label,
				totalPos: value.totalPos,
				totalNeg: value.totalNeg
			}))
			.sort((a, b) => new Date(`20${a.label.split("-")[1]}`) - new Date(`20${b.label.split("-")[1]}`));
	};

	// Dati filtrati in base alla tag selezionata
	const filteredData = createMemo(() => {
		const rawData = chiusureConSpese();
		if (selectedTag() === "Da inizio") {
			return groupData(
				rawData,
				"monthly"
			);
		}
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

	const filteredCashflowData = createMemo(() => {
		const rawData = cashflow();
		if (selectedTag() === "Da inizio") {
			return groupCashflowData(
				rawData,
				"monthly"
			);
		}
		if (selectedTag() === "Mese corrente") {
			return groupCashflowData(
				rawData.filter(item => {
					const date = new Date(item.data_operazione);
					return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
				}),
				"daily"
			);
		}
		if (selectedTag() === "12 mesi") {
			return groupCashflowData(
				rawData.filter(item => {
					const date = new Date(item.data_operazione);
					return date >= last12Months;
				}),
				"monthly"
			);
		}
		if (selectedTag() === "Da inizio anno") {
			return groupCashflowData(
				rawData.filter(item => {
					const date = new Date(item.data_operazione);
					return date.getFullYear() === currentYear;
				}),
				"monthly"
			);
		}
		return [];
	});

	const fornitureDaPagare = createMemo(() => {
		return forniture()
			.filter(f => f.status === "NOT_PAYED")
			.reduce((sum, f) => sum + f.importo, 0);
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
			height: "100%",
			width: "100%",
			stacked: false,
			toolbar: { show: false }
		},
		title: {
			text: "Chiusure", // ✅ Titolo direttamente nel grafico
			align: "center", // ✅ Centra il titolo
			style: {
				fontSize: "16px",
				fontWeight: "bold"
			}
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
			labels: {
				formatter: (val) => val.toLocaleString("it-IT", { maximumFractionDigits: 0 })
			},
			title: { text: "" }
		},
		fill: {
			type: 'gradient',
			gradient: {
				shade: 'light',
				type: "horizontal",
				shadeIntensity: 0.25,
				gradientToColors: undefined,
				inverseColors: true,
				opacityFrom: 0.85,
				opacityTo: 0.85,
				stops: [50, 0, 100]
			},
		},
		dataLabels: { enabled: false },
		grid: { show: true }
	}));

	const cashflowChartOptions = createMemo(() => ({
		chart: {
			type: "bar",
			height: "100%",
			width: "100%",
			stacked: false,
			toolbar: { show: false }
		},
		title: {
			text: "Cashflow", // ✅ Titolo direttamente nel grafico
			align: "center", // ✅ Centra il titolo
			style: {
				fontSize: "16px",
				fontWeight: "bold"
			}
		},
		series: [
			{
				name: "Entrate",
				data: filteredCashflowData().map(item => item.totalPos),
				color: "#4CAF50"
			},
			{
				name: "Uscite",
				data: filteredCashflowData().map(item => item.totalNeg),
				color: "#F44336"
			}
		],
		xaxis: {
			categories: filteredCashflowData().map(item => item.label),
			labels: { show: true },
			title: { text: "" }
		},
		yaxis: {
			labels: {
				formatter: (val) => val.toLocaleString("it-IT", { maximumFractionDigits: 0 })
			},
			title: { text: "" }
		},
		fill: {
			type: 'gradient',
			gradient: {
				shade: 'light',
				type: "horizontal",
				shadeIntensity: 0.25,
				gradientToColors: undefined,
				inverseColors: true,
				opacityFrom: 0.85,
				opacityTo: 0.85,
				stops: [50, 0, 100]
			},
		},
		dataLabels: { enabled: false },
		grid: { show: true }
	}));

	const expensesByType = createMemo(() => {
		const rawData = cashflow();
		//console.log("Selected Tag:", selectedTag());
		//console.log("Raw Data (cashflow()):", rawData);

		// Filtriamo i dati in base alla tag selezionata
		let filteredData = [];
		if (selectedTag() === "Da inizio") {
			filteredData = rawData;
			//console.log("filteredData appena assegnato:", filteredData);
		} else if (selectedTag() === "Mese corrente") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
			});
		} else if (selectedTag() === "12 mesi") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date >= last12Months;
			});
		} else if (selectedTag() === "Da inizio anno") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear;
			});
		}

		//console.log("Filtered Data:", filteredData);

		// Filtriamo solo i movimenti con importo negativo ed escludiamo gli "Storno"
		const negativeMovements = filteredData.filter(item => item.importo < 0 && item.tipo !== "Storno");
		//console.log("Negative Movements:", negativeMovements);

		// Creiamo una mappa per sommare gli importi per tipo
		const groupedData = new Map();
		negativeMovements.forEach(item => {
			if (!groupedData.has(item.tipo)) {
				groupedData.set(item.tipo, 0);
			}
			groupedData.set(item.tipo, groupedData.get(item.tipo) + item.importo);
		});

		// Convertiamo la mappa in un array e calcoliamo il totale
		const expensesArray = Array.from(groupedData.entries())
			.map(([tipo, total]) => ({ tipo, total: Math.abs(total) })) // Rendiamo positivo il valore per leggibilità
			.sort((a, b) => b.total - a.total); // Ordiniamo dalla spesa maggiore alla minore

		//console.log("Grouped Data:", groupedData);
		//console.log("Expenses Array:", expensesArray);

		// Calcoliamo il totale di tutte le spese
		const totalSpese = expensesArray.reduce((sum, expense) => sum + expense.total, 0);

		// Aggiungiamo il totale alla fine dell'array
		if (expensesArray.length > 0) {
			expensesArray.push({ tipo: "Totale Spese", total: totalSpese });
		}

		//console.log("Final Expenses Array:", expensesArray);
		return expensesArray;
	});

	const incomeByType = createMemo(() => {
		const rawData = cashflow();

		// Filtriamo i dati in base alla tag selezionata
		let filteredData = [];
		if (selectedTag() === "Da inizio") {
			filteredData = rawData;
		} else if (selectedTag() === "Mese corrente") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
			});
		} else if (selectedTag() === "12 mesi") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date >= last12Months;
			});
		} else if (selectedTag() === "Da inizio anno") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear;
			});
		}

		// Filtriamo solo i movimenti con importo positivo ed escludiamo gli "Storno"
		const positiveMovements = filteredData.filter(item => item.importo > 0 && item.tipo !== "Trasf CASH -> CC" && item.tipo !== "Trasf CC -> CASH");

		// Creiamo una mappa per sommare gli importi per tipo
		const groupedData = new Map();
		positiveMovements.forEach(item => {
			if (!groupedData.has(item.tipo)) {
				groupedData.set(item.tipo, 0);
			}
			groupedData.set(item.tipo, groupedData.get(item.tipo) + item.importo);
		});

		// Convertiamo la mappa in un array e calcoliamo il totale
		const incomesArray = Array.from(groupedData.entries())
			.map(([tipo, total]) => ({ tipo, total: Math.abs(total) })) // Rendiamo positivo il valore per leggibilità
			.sort((a, b) => b.total - a.total); // Ordiniamo dal valore più alto

		// Calcoliamo il totale di tutte le entrate
		const totalEntrate = incomesArray.reduce((sum, income) => sum + income.total, 0);

		// Aggiungiamo il totale alla fine dell'array
		if (incomesArray.length > 0) {
			incomesArray.push({ tipo: "Totale Entrate", total: totalEntrate });
		}

		return incomesArray;
	});

	const summaryData = createMemo(() => {
		const rawData = cashflow();

		// Filtriamo i dati in base al tag selezionato
		let filteredData = [];
		if (selectedTag() === "Da inizio") {
			filteredData = rawData;
		} else if (selectedTag() === "Mese corrente") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
			});
		} else if (selectedTag() === "12 mesi") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date >= last12Months;
			});
		} else if (selectedTag() === "Da inizio anno") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear;
			});
		} else {
			// Se nessun tag è selezionato, prendiamo tutti i dati senza filtro temporale
			filteredData = rawData;
		}

		// Calcoliamo i totali di entrate e uscite
		const totalEntrate = incomeByType().at(-1)?.total || 0;
		const totalUscite = expensesByType().at(-1)?.total || 0;
		const saldoEntrateUscite = totalEntrate - totalUscite;

		// Calcoliamo il totale per CASH e CC applicando il filtro temporale
		const totalCash = filteredData
			.filter(item => item.origin === "CASH" || item.origin === "CONTANTI CASSA")
			.reduce((sum, item) => sum + item.importo, 0);

		const totalCC = filteredData
			.filter(item => item.origin === "CC")
			.reduce((sum, item) => sum + item.importo, 0);

		const saldoCashCC = totalCash + totalCC;

		return {
			totalEntrate,
			totalUscite,
			saldoEntrateUscite,
			totalCash,
			totalCC,
			saldoCashCC
		};
	});

	const pieChartOptions = createMemo(() => {
		const labels = expensesByType().slice(0, -1).map(item => item.tipo);
		const series = expensesByType().slice(0, -1).map(item => item.total);
		const total = series.reduce((acc, val) => acc + val, 0);

		// Determiniamo quali fette sono piccole (<5%)
		const threshold = total * 0.05;
		const smallSlices = labels.map((label, index) => ({
			label,
			value: series[index],
			percent: (series[index] / total) * 100
		})).filter(slice => slice.value < threshold);

		// Sommiamo il valore delle fette piccole per creare una fetta unica
		const smallSlicesTotal = smallSlices.reduce((sum, slice) => sum + slice.value, 0);
		const smallSlicesPercent = (smallSlicesTotal / total) * 100; // Percentuale del totale

		// Filtriamo solo le fette grandi per il grafico
		const filteredLabels = labels.filter((_, index) => series[index] >= threshold);
		const filteredSeries = series.filter(value => value >= threshold);

		// Aggiungiamo la fetta "Altre Spese" nel grafico (con etichetta)
		if (smallSlicesTotal > 0) {
			filteredLabels.push(`Altre Spese`);
			filteredSeries.push(smallSlicesTotal);
		}

		return {
			chart: {
				type: "pie",
				height: "100%",
				width: "100%",
				animations: {
					enabled: false // ❌ Disabilita l'effetto di selezione al clic
				},
				toolbar: {
					show: false
				}
			},
			labels: filteredLabels, // Solo le etichette delle fette grandi + "Altre Spese"
			series: filteredSeries, // Solo i valori delle fette grandi + "Altre Spese"
			title: {
				text: "Ripartizione delle Uscite",
				align: "center",
				style: {
					fontSize: "16px",
					fontWeight: "bold"
				}
			},
			legend: {
				show: false // ❌ Rimuoviamo la legenda standard di ApexCharts
			},
			dataLabels: {
				enabled: true,
				style: {
					fontSize: "14px",
					fontWeight: "bold",
				},
				formatter: (val, { seriesIndex, w }) => {
					return `${w.config.labels[seriesIndex]} (${val.toFixed(1)}%)`;
				}
			},
			tooltip: {
				enabled: true,
				y: {
					formatter: (value) => `${value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}€`
				}
			},
			stroke: {
				show: true,
				width: 1,
				colors: ["#fff"]
			},
			// fill: {
			// 	type: 'gradient',
			// 	gradient: {
			// 		shade: 'light',
			// 		type: "radial",
			// 		shadeIntensity: 0.4,
			// 		gradientToColors: undefined,
			// 		inverseColors: true,
			// 		opacityFrom: 0.8,
			// 		opacityTo: 0.9,
			// 		stops: [50, 0, 100]
			// 	}
			// },
			colors: ["#F44336", "#E57373", "#FFCDD2", "#D32F2F", "#B71C1C"], // Palette sfumata sul rosso
			states: {
				active: {
					allowMultipleDataPointsSelection: false,
					filter: { type: 'none' } // ❌ Disabilita il cambio di colore al clic
				}
			},
			extra: { smallSlices } // ✅ Salviamo le fette piccole per la legenda personalizzata
		};
	});

	// Legenda personalizzata per le fette piccole
	const SmallSlicesLegend = () => {
		const smallSlices = pieChartOptions().extra.smallSlices;
		return smallSlices.length > 0 ? (
			<div class="mt-4 text-sm bg-gray-100 p-2 rounded">
				<h4 class="text-center font-semibold">Altre Spese</h4>
				<ul>
					{smallSlices.map(slice => (
						<li class="flex justify-between">
							<span>{slice.label}</span>
							<span>{slice.percent.toFixed(1)}%</span>
						</li>
					))}
				</ul>
			</div>
		) : null;
	};

	const pieChartOptionsIncome = createMemo(() => {
		const labels = incomeByType().slice(0, -1).map(item => item.tipo);
		const series = incomeByType().slice(0, -1).map(item => item.total);
		const total = series.reduce((acc, val) => acc + val, 0);

		// Determiniamo quali fette sono piccole (<5%)
		const threshold = total * 0.05;
		const smallSlices = labels.map((label, index) => ({
			label,
			value: series[index],
			percent: (series[index] / total) * 100
		})).filter(slice => slice.value < threshold);

		// Sommiamo il valore delle fette piccole per creare una fetta unica
		const smallSlicesTotal = smallSlices.reduce((sum, slice) => sum + slice.value, 0);
		const smallSlicesPercent = (smallSlicesTotal / total) * 100;

		// Filtriamo solo le fette grandi per il grafico
		const filteredLabels = labels.filter((_, index) => series[index] >= threshold);
		const filteredSeries = series.filter(value => value >= threshold);

		// Aggiungiamo la fetta "Altre Entrate"
		if (smallSlicesTotal > 0) {
			filteredLabels.push(`Altre Entrate`);
			filteredSeries.push(smallSlicesTotal);
		}

		return {
			chart: {
				type: "pie",
				height: "100%",
				width: "100%",
				animations: { enabled: false },
				toolbar: { show: false }
			},
			labels: filteredLabels,
			series: filteredSeries,
			title: {
				text: "Ripartizione delle Entrate",
				align: "center",
				style: {
					fontSize: "16px",
					fontWeight: "bold"
				}
			},
			legend: { show: false },
			dataLabels: {
				enabled: true,
				style: {
					fontSize: "14px",
					fontWeight: "bold",
				},
				formatter: (val, { seriesIndex, w }) => {
					const percent = (filteredSeries[seriesIndex] / total) * 100;
					return `${w.config.labels[seriesIndex]} (${percent.toFixed(1)}%)`;
				}
			},
			tooltip: {
				enabled: true,
				y: {
					formatter: (value) => `${value.toLocaleString("it-IT", { minimumFractionDigits: 2 })}€`
				}
			},
			stroke: {
				show: true,
				width: 1,
				colors: ["#fff"]
			},
			colors: ["#4CAF50", "#66BB6A", "#81C784", "#A5D6A7", "#C8E6C9"], // 🌿 Tonalità di verde
			states: {
				active: {
					allowMultipleDataPointsSelection: false,
					filter: { type: 'none' }
				}
			},
			extra: { smallSlices }
		};
	});


	onMount(() => {
		const chart1 = new ApexCharts(document.querySelector("#chart"), chartOptions());
		chart1.render();

		const chart2 = new ApexCharts(document.querySelector("#cashflow-chart"), cashflowChartOptions());
		chart2.render();

		const chart3 = new ApexCharts(document.querySelector("#pie-chart"), pieChartOptions());
		chart3.render();

		const chart4 = new ApexCharts(document.querySelector("#pie-chart-income"), pieChartOptionsIncome()); // 🎯 Nuovo grafico
		chart4.render();

		const updateCharts = () => {
			chart1.updateOptions(chartOptions());
			chart2.updateOptions(cashflowChartOptions());
			chart3.updateOptions(pieChartOptions());
			chart4.updateOptions(pieChartOptionsIncome()); // 🎯 Nuovo grafico
		};

		createMemo(updateCharts);
	});

	return (
		<div class="flex flex-col h-full justify-center">

			{/* Barra superiore con i tag */}
			<div class="flex flex-none items-center justify-center gap-1 py-3 border-b">
				{tags.map((tag) => (
					<div
						class={`text-sm px-2 py-1 border rounded-xl cursor-pointer shadow-lg select-none ${selectedTag() === tag ? "bg-blue-500 text-white" : "bg-white text-black"
							}`}
						onClick={() => setSelectedTag(tag)}
					>
						{tag}
					</div>
				))}
			</div>

			{/* Grid responsive per le cards */}
			<div class="flex-grow overflow-y-auto flex flex-wrap gap-4 justify-center p-2">

				{/* Card con il riepilogo generale */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px] flex flex-col"
					style="flex: 1 1 auto; min-width: 300px;">
					<h3 class="text-center text-lg font-semibold mb-3">Riepilogo</h3>

					<div>
						{/* Totale Entrate */}
						<li class="flex justify-between border-b text-gray-600">
							<span>Entrate</span>
							<span class="text-green-600">{summaryData().totalEntrate.toLocaleString("it-IT", { maximumFractionDigits: 0 })}€</span>
						</li>

						{/* Totale Uscite */}
						<li class="flex justify-between border-b text-gray-600">
							<span>Uscite</span>
							<span class="text-red-600">{summaryData().totalUscite.toLocaleString("it-IT", { maximumFractionDigits: 0 })}€</span>
						</li>

						{/* Differenza Entrate - Uscite */}
						<li class={`flex justify-between font-semibold ${summaryData().saldoEntrateUscite > 0 ? "text-green-600" : "text-red-600"}`}>
							<span></span>
							<span>{summaryData().saldoEntrateUscite.toLocaleString("it-IT", { maximumFractionDigits: 0 })}€</span>
						</li>
					</div>

					<div class="mt-4">
						{/* Totale CASH */}
						<li class={`flex justify-between border-b text-gray-600`}>
							<span>Patrimonio CASH</span>
							<span class={`${summaryData().totalCash > 0 ? "text-green-600" : "text-red-600"}`}>{summaryData().totalCash.toLocaleString("it-IT", { maximumFractionDigits: 0 })}€</span>
						</li>

						{/* Totale CC */}
						<li class={`flex justify-between border-b text-gray-600`}>
							<span>Patrimonio CC</span>
							<span class={`${summaryData().totalCC > 0 ? "text-green-600" : "text-red-600"}`}>{summaryData().totalCC.toLocaleString("it-IT", { maximumFractionDigits: 0 })}€</span>
						</li>

						{/* Totale generale */}
						<li class={`flex justify-between font-semibold ${summaryData().saldoCashCC > 0 ? "text-green-600" : "text-red-600"}`}>
							<span></span>
							<span>{summaryData().saldoCashCC.toLocaleString("it-IT", { maximumFractionDigits: 0 })}€</span>
						</li>

					</div>

					<div class="mt-4">
						{/* Forniture da pagare - Mostrato solo se il tag selezionato è "Da inizio" */}
						{selectedTag() === "Da inizio" && (
							<li class={`flex justify-between border-b text-gray-600`}>
								<span>Forniture da pagare</span>
								<span class="text-red-600 font-semibold">{fornitureDaPagare().toLocaleString("it-IT", { minimumFractionDigits: 2 })}€</span>
							</li>
						)}
					</div>


				</div>

				{/* Card con la lista delle entrate */}
				<div class="border rounded shadow-lg bg-white px-4 py-2 h-[400px] flex flex-col"
					style="flex: 1 1 auto; min-width: 300px;">
					<h3 class="text-center text-lg font-semibold mb-3">Entrate per Tipo</h3>

					{/* Lista delle entrate con overflow scrollabile */}
					<ul class="text-sm space-y-2 flex-grow overflow-y-auto">
						{incomeByType().slice(0, -1).map((income) => ( // Escludiamo il totale dalla lista scorrevole
							<li class="flex justify-between border-b">
								<span>{income.tipo}</span>
								<span class="font-semibold text-green-600">
									{income.total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}€
								</span>
							</li>
						))}
					</ul>

					{/* Totale fisso in basso */}
					<div class="border-t mt-2 pt-2 flex justify-between text-lg font-bold text-green-700">
						<span>{incomeByType().at(-1).tipo}</span>
						<span>{incomeByType().at(-1).total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}€</span>
					</div>
				</div>

				{/* Card con il grafico a torta delle Entrate */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px] flex flex-col justify-between"
					style="flex: 1 1 auto; min-width: 300px;">

					{/* Contenitore del grafico */}
					<div class="flex-grow flex justify-center items-center">
						<div id="pie-chart-income" class="w-full h-full"></div>
					</div>

					{/* ✅ Legenda per le fette piccole */}
					{pieChartOptionsIncome().extra.smallSlices.length > 0 && (
						<div class="flex-none justify-center mt-2 text-sm p-2">
							<h4 class="flex flex-none justify-center font-semibold mb-2">Altre Entrate</h4>
							<ul class="flex flex-wrap items-center justify-center gap-2">
								{pieChartOptionsIncome().extra.smallSlices.map(slice => (
									<li class="flex items-center justify-center border rounded-xl px-2 bg-green-50 shadow-lg">
										<span>{slice.label}</span>
										<span class="ml-1">({slice.percent.toFixed(1)}%)</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>

				{/* Card con la lista delle spese */}
				<div class="border rounded shadow-lg bg-white px-4 py-2 h-[400px] flex flex-col"
					style="flex: 1 1 auto; min-width: 300px;">
					<h3 class="text-center text-lg font-semibold mb-3">Uscite per Tipo</h3>

					{/* Lista delle spese con overflow scrollabile */}
					<ul class="text-sm space-y-2 flex-grow overflow-y-auto">
						{expensesByType().slice(0, -1).map((expense) => ( // Escludiamo il totale dalla lista scorrevole
							<li class="flex justify-between border-b">
								<span>{expense.tipo}</span>
								<span class="font-semibold text-red-600">
									{expense.total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}€
								</span>
							</li>
						))}
					</ul>

					{/* Totale fisso in basso */}
					<div class="border-t mt-2 pt-2 flex justify-between text-lg font-bold text-red-700">
						<span>{expensesByType().at(-1).tipo}</span>
						<span>{expensesByType().at(-1).total.toLocaleString("it-IT", { minimumFractionDigits: 2 })}€</span>
					</div>
				</div>

				{/* Card con il grafico a torta e la legenda */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px] flex flex-col justify-between"
					style="flex: 1 1 auto; min-width: 300px;">

					{/* Contenitore flessibile per il grafico */}
					<div class="flex-grow flex justify-center items-center">
						<div id="pie-chart" class="w-full h-full"></div>
					</div>

					{/* ✅ Legenda personalizzata per le fette piccole */}
					{pieChartOptions().extra.smallSlices.length > 0 && (
						<div class="flex-none justify-center mt-2 text-sm p-2">
							<h4 class="flex flex-none justify-center font-semibold mb-2">Altre Spese</h4>
							<ul class="flex flex-wrap items-center justify-center gap-2">
								{pieChartOptions().extra.smallSlices.map(slice => (
									<li class="flex items-center justify-center border rounded-xl px-2 bg-red-50 shadow-lg">
										<span>{slice.label}</span>
										<span class="ml-1">({slice.percent.toFixed(1)}%)</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>



				{/* Card con il grafico a barre */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px]"
					style="flex: 1 1 auto; min-width: 300px;">
					{/* <h3 class="text-center text-lg font-semibold my-3">Chiusure</h3> */}
					<div id="chart" class="flex justify-center w-full h-full"></div>
				</div>

				{/* Card con il secondo istogramma */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px]"
					style="flex: 1 1 auto; min-width: 300px;">
					{/* <h3 class="text-center text-lg font-semibold my-3">Movimenti di Cassa</h3> */}
					<div id="cashflow-chart" class="flex justify-center w-full h-full"></div>
				</div>

			</div>


		</div>
	);
};

export default Statistiche;
