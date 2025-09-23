import { createSignal, createMemo, onMount } from "solid-js";
import ApexCharts from "apexcharts";

const Statistiche = (props) => {
	const { cc, cash, chiusureConSpese, cashflow, scadenze, budget } = props;

	const [selectedTag, setSelectedTag] = createSignal("Da inizio"); // Default: ultimi 12 mesi
	const tags = ["Da inizio", "Mese corrente", "Ultimi 12 mesi", "Da inizio anno"];

	const today = new Date();
	const currentYear = today.getFullYear();
	const currentMonth = today.getMonth() + 1; // Mese attuale (1-12)
	const last12Months = new Date(today);
	last12Months.setFullYear(last12Months.getFullYear() - 1);

	// funzione di formattazione dei numeri 
	const formatEuro = (value, fixedDecimals = false) => {
		if (value === null || value === undefined || isNaN(value)) {
			console.warn("❗️Valore non valido in formatEuro:", value);
			return "–";
		}

		// Arrotonda il valore
		const roundedValue = fixedDecimals
			? value.toFixed(2)
			: Math.round(value).toString();

		// Divide parte intera e decimale
		const [intPart, decPart] = roundedValue.split('.');

		// Aggiunge separatore migliaia manualmente
		const intWithSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

		// Ritorna il formato corretto
		return decPart !== undefined
			? `${intWithSeparators},${decPart}`
			: intWithSeparators;
	};

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

	const confrontoData = createMemo(() => {
		// Filtra i dati di chiusureConSpese in base al tag selezionato
		const rawData = chiusureConSpese();
		let filtered;
		if (selectedTag() === "Da inizio") {
			filtered = rawData;
		} else if (selectedTag() === "Mese corrente") {
			filtered = rawData.filter(item => {
				const date = new Date(item.data_competenza);
				return date.getFullYear() === currentYear && (date.getMonth() + 1) === currentMonth;
			});
		} else if (selectedTag() === "Ultimi 12 mesi") {
			filtered = rawData.filter(item => new Date(item.data_competenza) >= last12Months);
		} else if (selectedTag() === "Da inizio anno") {
			filtered = rawData.filter(item => new Date(item.data_competenza).getFullYear() === currentYear);
		} else {
			filtered = rawData;
		}

		// Raggruppa i dati filtrati per mese
		const incassiMap = new Map();
		filtered.forEach(item => {
			const date = new Date(item.data_competenza);
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			const current = incassiMap.get(key) || 0;
			incassiMap.set(key, current + (item.chiusura_lorda_reale || 0));
		});

		const incassiArray = Array.from(incassiMap.entries()).map(([key, incassi]) => {
			const [year, month] = key.split("-");
			const formattedLabel = `${month}/${year}`; // Formato 03/2025
			return { key, label: formattedLabel, incassi };
		});

		// Raggruppa i dati di budget per mese
		const budgetArray = budget().map(b => {
			const key = `${b.anno_rif}-${String(b.mese_rif).padStart(2, '0')}`;
			return { key, budget: b.incassi || 0 };
		});
		const budgetMap = new Map(budgetArray.map(item => [item.key, item.budget]));

		// Determiniamo il budget parziale per il mese in corso
		const today = new Date();
		const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
		const giorniTrascorsi = today.getDate();
		const giorniTotaliMese = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(); // Ultimo giorno del mese
		const budgetCorrente = budgetMap.get(currentMonthKey) || 0;
		const budgetParziale = (budgetCorrente * giorniTrascorsi) / giorniTotaliMese; // Budget proporzionato per il mese corrente

		// Effettua il merge e calcola la variazione percentuale
		const merged = incassiArray.map(item => {
			let budgetVal = budgetMap.get(item.key) || 0;
			if (item.key === currentMonthKey) {
				budgetVal = budgetParziale;
			}
			const variazionePercentuale = budgetVal !== 0 ? ((item.incassi - budgetVal) / budgetVal) * 100 : 0;
			return {
				...item,
				budget: budgetVal,
				variazionePercentuale
			};
		});

		// Ordina i dati in ordine ascendente (dal meno recente al più recente)
		merged.sort((a, b) => a.key.localeCompare(b.key));
		// Prendi gli ultimi X mesi mantenendo l'ordine ascendente
		const X = 6;
		return merged.slice(-X);
	});

	// Nuovo memo per il confronto delle spese
	const confrontoSpeseData = createMemo(() => {
		// Filtra cashflow in base al tag selezionato (usando data_operazione)
		const rawData = cashflow();
		let filtered;
		if (selectedTag() === "Da inizio") {
			filtered = rawData;
		} else if (selectedTag() === "Mese corrente") {
			filtered = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear && (date.getMonth() + 1) === currentMonth;
			});
		} else if (selectedTag() === "12 mesi") {
			filtered = rawData.filter(item => new Date(item.data_operazione) >= last12Months);
		} else if (selectedTag() === "Da inizio anno") {
			filtered = rawData.filter(item => new Date(item.data_operazione).getFullYear() === currentYear);
		} else {
			filtered = rawData;
		}

		// Filtra solo i movimenti negativi (le spese) escludendo "Storno" e i trasferimenti
		const negativeMovements = filtered.filter(item =>
			item.importo < 0 &&
			item.tipo !== "Storno" &&
			item.tipo !== "Trasf CASH -> CC" &&
			item.tipo !== "Trasf CC -> CASH"
		);

		// Raggruppa le spese reali per mese (utilizzando data_operazione)
		const expensesMap = new Map();
		negativeMovements.forEach(item => {
			const date = new Date(item.data_operazione);
			const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
			const currentValue = expensesMap.get(key) || 0;
			expensesMap.set(key, currentValue + Math.abs(item.importo));
		});

		const expensesArray = Array.from(expensesMap.entries()).map(([key, expense]) => {
			const [year, month] = key.split("-");
			const formattedLabel = `${month}/${year}`; // es. "03/2025"
			return { key, label: formattedLabel, expense };
		});

		// Raggruppa i dati di budget per mese per le spese
		// Assumiamo che ogni oggetto del budget abbia un campo "spese" contenente le spese previste
		const budgetExpensesArray = budget().map(b => {
			const key = `${b.anno_rif}-${String(b.mese_rif).padStart(2, '0')}`;
			return { key, plannedExpense: b.spese || 0 };
		});
		const budgetExpensesMap = new Map(budgetExpensesArray.map(item => [item.key, item.plannedExpense]));

		// Per il mese in corso, calcola il budget parziale in base ai giorni trascorsi
		const todayForExpenses = new Date();
		const currentMonthKeyExpenses = `${todayForExpenses.getFullYear()}-${String(todayForExpenses.getMonth() + 1).padStart(2, '0')}`;
		const giorniTrascorsi = todayForExpenses.getDate();
		const giorniTotaliMese = new Date(todayForExpenses.getFullYear(), todayForExpenses.getMonth() + 1, 0).getDate();
		const plannedExpenseCurrent = budgetExpensesMap.get(currentMonthKeyExpenses) || 0;
		const plannedExpensePartial = (plannedExpenseCurrent * giorniTrascorsi) / giorniTotaliMese;

		// Effettua il merge delle spese reali con quelle previste e calcola la variazione percentuale
		const merged = expensesArray.map(item => {
			let plannedExpense = budgetExpensesMap.get(item.key) || 0;
			if (item.key === currentMonthKeyExpenses) {
				plannedExpense = plannedExpensePartial;
			}
			// Calcola la variazione: se le spese reali superano quelle previste, la variazione sarà positiva
			const variationPercent = plannedExpense !== 0 ? ((item.expense - plannedExpense) / plannedExpense) * 100 : 0;
			return {
				...item,
				plannedExpense,
				variationPercent
			};
		});

		// Ordina i dati in ordine ascendente (dal meno recente al più recente)
		merged.sort((a, b) => a.key.localeCompare(b.key));
		// Prendi gli ultimi X mesi (ad es. 6) mantenendo l'ordine ascendente
		const X = 6;
		return merged.slice(-X);
	});

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

	const scadenzeDaPagare = createMemo(() => {
		return scadenze()
			.filter(f => f.status === "NOT_PAYED")
			.reduce((sum, f) => sum + f.importo, 0);
	});

	// Modifica nel memo upcomingScadenzeByMonth: imposta "today" all'inizio della giornata
	const scadenzeTotaliPerMese = createMemo(() => {
		const grouped = new Map();
		scadenze()
			.filter(s => s.status === "NOT_PAYED")
			.forEach(s => {
				const date = new Date(s.data_scadenza);
				const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
				const importo = parseFloat(s.importo);
				if (!grouped.has(key)) grouped.set(key, 0);
				grouped.set(key, grouped.get(key) + importo);
			});
		return Array.from(grouped.entries())
			.map(([month, totale]) => ({ month, totale }))
			.sort((a, b) => a.month.localeCompare(b.month));
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
				formatter: (val) => formatEuro(val)
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
				formatter: (val) => formatEuro(val)
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

		let filteredData = [];
		if (selectedTag() === "Da inizio") {
			filteredData = rawData;
		} else if (selectedTag() === "Mese corrente") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
			});
		} else if (selectedTag() === "Ultimi 12 mesi") {
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

		// Saldo netto "Allineamento"
		const alignmentNet = filteredData
			.filter(item => item.tipo === "Allineamento")
			.reduce((sum, item) => sum + item.importo, 0);

		// Negativi escludendo "Allineamento"
		const negativeMovements = filteredData.filter(
			item =>
				item.importo < 0 &&
				item.tipo !== "Storno" &&
				item.tipo !== "Trasf CASH -> CC" &&
				item.tipo !== "Trasf CC -> CASH" &&
				item.tipo !== "Allineamento"
		);

		const groupedData = new Map();
		negativeMovements.forEach(item => {
			if (!groupedData.has(item.tipo)) groupedData.set(item.tipo, 0);
			groupedData.set(item.tipo, groupedData.get(item.tipo) + item.importo);
		});

		// Se il saldo "Allineamento" è negativo, aggiungilo qui
		if (alignmentNet < 0) {
			groupedData.set("Allineamento", alignmentNet);
		}

		const expensesArray = Array.from(groupedData.entries())
			.map(([tipo, total]) => ({ tipo, total: Math.abs(total) }))
			.sort((a, b) => b.total - a.total);

		const totalSpese = expensesArray.reduce((sum, e) => sum + e.total, 0);
		if (expensesArray.length > 0) {
			expensesArray.push({ tipo: "Totale Spese", total: totalSpese });
		}

		return expensesArray;
	});


	const incomeByType = createMemo(() => {
		const rawData = cashflow();

		let filteredData = [];
		if (selectedTag() === "Da inizio") {
			filteredData = rawData;
		} else if (selectedTag() === "Mese corrente") {
			filteredData = rawData.filter(item => {
				const date = new Date(item.data_operazione);
				return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
			});
		} else if (selectedTag() === "Ultimi 12 mesi") {
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

		// Saldo netto "Allineamento"
		const alignmentNet = filteredData
			.filter(item => item.tipo === "Allineamento")
			.reduce((sum, item) => sum + item.importo, 0);

		// Positivi escludendo "Allineamento"
		const positiveMovements = filteredData.filter(
			item =>
				item.importo > 0 &&
				item.tipo !== "Storno" &&
				item.tipo !== "Trasf CASH -> CC" &&
				item.tipo !== "Trasf CC -> CASH" &&
				item.tipo !== "Allineamento"
		);

		const groupedData = new Map();
		positiveMovements.forEach(item => {
			if (!groupedData.has(item.tipo)) groupedData.set(item.tipo, 0);
			groupedData.set(item.tipo, groupedData.get(item.tipo) + item.importo);
		});

		// Se il saldo "Allineamento" è positivo, aggiungilo qui
		if (alignmentNet > 0) {
			groupedData.set("Allineamento", alignmentNet);
		}

		const incomesArray = Array.from(groupedData.entries())
			.map(([tipo, total]) => ({ tipo, total: Math.abs(total) }))
			.sort((a, b) => b.total - a.total);

		const totalEntrate = incomesArray.reduce((sum, i) => sum + i.total, 0);
		if (incomesArray.length > 0) {
			incomesArray.push({ tipo: "Totale Entrate", total: totalEntrate });
		}

		console.log(incomesArray);
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

	const budgetChartOptions = createMemo(() => ({
		chart: {
			type: "bar",
			height: "100%",
			width: "100%",
			stacked: false,
			toolbar: { show: false }
		},
		title: {
			text: "Chiusure vs Budget Puntuale",
			align: "center",
			style: {
				fontSize: "16px",
				fontWeight: "bold"
			}
		},
		plotOptions: {
			bar: {
				borderRadius: 2
			}
		},
		series: [
			{
				name: "Chiusure",
				data: confrontoData().map(item => item.incassi)
			},
			{
				name: "Budget",
				data: confrontoData().map(item => item.budget)
			}
		],
		xaxis: {
			categories: confrontoData().map(item => item.label),
			title: { text: "" }
		},
		yaxis: {
			labels: {
				formatter: (val) => formatEuro(val)
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
				opacityFrom: 0.8,
				opacityTo: 0.9,
				stops: [50, 0, 100]
			},
		},
		dataLabels: { enabled: false },
		grid: { show: true }
	}));

	const expenseBudgetChartOptions = createMemo(() => ({
		chart: {
			type: "bar",
			height: "100%",
			width: "100%",
			stacked: false,
			toolbar: { show: false }
		},
		title: {
			text: "Spese vs Budget Puntuale",
			align: "center",
			style: {
				fontSize: "16px",
				fontWeight: "bold"
			}
		},
		plotOptions: {
			bar: {
				borderRadius: 2
			}
		},
		series: [
			{
				name: "Spese",
				data: confrontoSpeseData().map(item => item.expense)
			},
			{
				name: "Budget",
				data: confrontoSpeseData().map(item => item.plannedExpense)
			}
		],
		xaxis: {
			categories: confrontoSpeseData().map(item => item.label),
			title: { text: "" }
		},
		yaxis: {
			labels: {
				formatter: (val) => formatEuro(val)
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
				opacityFrom: 0.8,
				opacityTo: 0.9,
				stops: [50, 0, 100]
			}
		},
		dataLabels: { enabled: false },
		grid: { show: true },
		colors: ["#F44336", "#FFEB3B"] // Rosso per le spese, giallo per il budget
	}));

	onMount(() => {
		const chart1 = new ApexCharts(document.querySelector("#chart"), chartOptions());
		chart1.render();

		const chart2 = new ApexCharts(document.querySelector("#cashflow-chart"), cashflowChartOptions());
		chart2.render();

		const chart3 = new ApexCharts(document.querySelector("#pie-chart"), pieChartOptions());
		chart3.render();

		const chart4 = new ApexCharts(document.querySelector("#pie-chart-income"), pieChartOptionsIncome()); // 🎯 Nuovo grafico
		chart4.render();

		const chart5 = new ApexCharts(document.querySelector("#budget-chart"), budgetChartOptions());
		chart5.render();

		const chart6 = new ApexCharts(document.querySelector("#expense-budget-chart"), expenseBudgetChartOptions());
		chart6.render();

		const updateCharts = () => {
			chart1.updateOptions(chartOptions());
			chart2.updateOptions(cashflowChartOptions());
			chart3.updateOptions(pieChartOptions());
			chart4.updateOptions(pieChartOptionsIncome()); // 🎯 Nuovo grafico
			chart5.updateOptions(budgetChartOptions());
			chart6.updateOptions(expenseBudgetChartOptions());
		};

		createMemo(updateCharts);
	});

	return (
		<div class="flex flex-col h-full justify-center">

			{/* Barra superiore con i tag */}
			<div class="flex flex-none flex-wrap items-center justify-center gap-1 py-3 border-b">
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

					{/* entrate - uscite */}
					<div>
						{/* Totale Entrate */}
						<li class="flex justify-between border-b text-gray-600">
							<span>Entrate</span>
							<span class="text-green-600">{formatEuro(summaryData().totalEntrate)} €</span>
						</li>

						{/* Totale Uscite */}
						<li class="flex justify-between border-b text-gray-600">
							<span>Uscite</span>
							<span class="text-red-600">{formatEuro(summaryData().totalUscite)} €</span>
						</li>

						{/* Differenza Entrate - Uscite */}
						<li class={`flex justify-between font-semibold ${summaryData().saldoEntrateUscite > 0 ? "text-green-600" : "text-red-600"}`}>
							<span></span>
							<span>{formatEuro(summaryData().saldoEntrateUscite)} €</span>
						</li>
					</div>

					{/* patrim. CASH - patrim. CC */}
					<div class="mt-4">
						{/* Totale CASH */}
						<li class={`flex justify-between border-b text-gray-600`}>
							<span>Patrimonio CASH</span>
							<span class={`${summaryData().totalCash > 0 ? "text-green-600" : "text-red-600"}`}>{formatEuro(summaryData().totalCash)} €</span>
						</li>

						{/* Totale CC */}
						<li class={`flex justify-between border-b text-gray-600`}>
							<span>Patrimonio CC</span>
							<span class={`${summaryData().totalCC > 0 ? "text-green-600" : "text-red-600"}`}>{formatEuro(summaryData().totalCC)} €</span>
						</li>

						{/* Totale generale */}
						<li class={`flex justify-between font-semibold ${summaryData().saldoCashCC > 0 ? "text-green-600" : "text-red-600"}`}>
							<span></span>
							<span>{formatEuro(summaryData().saldoCashCC)} €</span>
						</li>

					</div>

					{/* margine netto percentuale */}
					<div class="mt-4">

						{/* margin netto % */}
						<li class={`flex justify-between border-b text-gray-600`}>
							<span>Margine netto %</span>
							<span class={`font-semibold ${summaryData().saldoEntrateUscite / summaryData().totalEntrate > 0 ? "text-green-600" : "text-red-600"}`}>{formatEuro(((summaryData().saldoEntrateUscite / summaryData().totalEntrate) * 100))} %</span>
						</li>

						{/* Frase esplicativa */}
						{summaryData().saldoEntrateUscite / summaryData().totalEntrate > 0 ? (
							<div class="text-xs text-gray-400 text-center">
								<span>Hai guadagnato </span>
								<span>{formatEuro(Math.abs((summaryData().saldoEntrateUscite / summaryData().totalEntrate) * 100))} centesimi </span>
								<div>netti su ogni euro incassato</div>
							</div>
						) : (
							<div class="text-xs text-gray-400 text-center">
								<span>Per ogni euro che hai incassato</span>
								<div>ne hai spesi circa {formatEuro(Math.abs(1 - (summaryData().saldoEntrateUscite / summaryData().totalEntrate)), true)} </div>
							</div>
						)}


					</div>

					<div class="mt-4">
						{/* Scadenze da pagare - Mostrato solo se il tag selezionato è "Da inizio" */}
						{selectedTag() === "Da inizio" && (
							<li class={`flex justify-between border-b text-gray-600`}>
								<span>Scadenze</span>
								<span class={`font-semibold ${scadenzeDaPagare() > 0 ? "text-green-600" : "text-red-600"}`}>{formatEuro(scadenzeDaPagare())} €</span>
							</li>
						)}
					</div>


				</div>

				{/* Card per Totali Scadenze per Mese */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px] flex flex-col"
					style="flex: 1 1 auto; min-width: 300px;">
					<h3 class="text-center text-lg font-semibold mb-3">Scadenze per Mese</h3>
					<div class="flex-grow overflow-y-auto text-sm">
						{scadenzeTotaliPerMese().map(({ month, totale }) => {
							const date = new Date(`${month}-01`);
							const formattedMonth = date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
							return (
								<div key={month} class="flex justify-between border-b mt-1">
									<span>{formattedMonth}</span>
									<span class={`font-semibold ${totale > 0 ? "text-green-600" : "text-red-600"}`}>{formatEuro(totale)} €</span>
								</div>
							);
						})}
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
									{formatEuro(income.total)} €
								</span>
							</li>
						))}
					</ul>

					{/* Totale fisso in basso */}
					<div class="border-t mt-2 pt-2 flex justify-between text-lg font-bold text-green-700">
						<span>{incomeByType().at(-1).tipo}</span>
						<span>{formatEuro(incomeByType().at(-1).total)}€</span>
					</div>
				</div>

				{/* Card con il grafico a torta delle Entrate */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px] flex flex-col justify-between"
					style="flex: 1 1 auto; min-width: 300px;">

					{/* Contenitore del grafico */}
					<div class="flex-grow flex justify-center items-center">
						<div id="pie-chart-income" class="w-full h-full"></div>
					</div>

					{/* ✅ Legenda personalizzata per le fette piccole (Entrate) */}
					{(() => {
						const small = pieChartOptionsIncome().extra.smallSlices;
						if (!small || small.length === 0) return null;

						const totalPct = small.reduce((sum, s) => sum + s.percent, 0);
						const items = small
							.map(s => `${s.label} (${s.percent.toFixed(1)}%)`)
							.join(", ");

						return (
							<div class="flex-none flex items-center justify-center mt-2 text-xs p-2 w-full">
								<div class="text-center max-w-72">
									<span class="font-semibold">Altre Entrate ({totalPct.toFixed(1)}%): </span>
									<span>{items}</span>
								</div>
							</div>
						);
					})()}
				</div>

				{/* Card con la lista delle spese */}
				<div class="border rounded shadow-lg bg-white px-4 py-2 h-[400px] flex flex-col"
					style="flex: 1 1 auto; min-width: 300px;">
					<h3 class="text-center text-lg font-semibold mb-3">Uscite per Tipo</h3>

					{/* Lista delle spese con overflow scrollabile */}
					<ul class="text-sm space-y-1 flex-grow overflow-y-auto">
						{expensesByType().slice(0, -1).map((expense) => ( // Escludiamo il totale dalla lista scorrevole
							<li class="flex justify-between border-b">
								<span>{expense.tipo}</span>
								<span class="font-semibold text-red-600">
									{formatEuro(expense.total)} €
								</span>
							</li>
						))}
					</ul>

					{/* Totale fisso in basso */}
					<div class="border-t mt-2 pt-2 flex justify-between text-lg font-bold text-red-700">
						<span>{expensesByType().at(-1).tipo}</span>
						<span>{formatEuro(expensesByType().at(-1).total)}€</span>
					</div>
				</div>

				{/* Card con il grafico a torta e la legenda delle SPESE*/}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px] flex flex-col justify-between"
					style="flex: 1 1 auto; min-width: 300px;">

					{/* Contenitore flessibile per il grafico */}
					<div class="flex-grow flex justify-center items-center">
						<div id="pie-chart" class="w-full h-full"></div>
					</div>

					{/* ✅ Legenda personalizzata per le fette piccole */}
					{(() => {
						const small = pieChartOptions().extra.smallSlices;
						if (!small || small.length === 0) return null;

						const totalPct = small.reduce((sum, s) => sum + s.percent, 0);
						const items = small
							.map(s => `${s.label} (${s.percent.toFixed(1)}%)`)
							.join(", ");

						return (
							<div class="flex-none flex items-center justify-center mt-2 text-xs p-2 w-full">
								<div class="text-center max-w-72">
									<span class="font-semibold">Altre Spese ({totalPct.toFixed(1)}%): </span>
									<span>{items}</span>
								</div>
							</div>
						);
					})()}
				</div>

				{/* Slot per "Chiusure vs Budget Puntuale" */}
				<div class="border rounded shadow-lg bg-white px-4 py-2 h-[400px] flex flex-col"
					style="flex: 1 1 auto; min-width: 300px;">
					<h2 class="text-lg text-center font-semibold mb-4">
						Chiusure vs Budget Puntuale
					</h2>
					<ul class="text-sm font-semibold">
						<li class="flex justify-between items-center py-1">
							<span class="w-1/4"></span>
							<span class="w-1/4 text-right">Chiusure</span>
							<span class="w-1/4 text-right">Bdg</span>
							<span class="w-1/4 text-right">Var %</span>
						</li>
					</ul>
					<ul class="text-sm space-y-1 flex-grow overflow-y-auto">
						{confrontoData().map(({ key, label, incassi, budget, variazionePercentuale }) => (
							<li key={key} class="flex justify-between items-center py-1 border-b">
								<span class="w-1/4">{label}</span> {/* es. 03/2025 */}
								<span class="w-1/4 text-right">
									{formatEuro(incassi)} €
								</span>
								<span class="w-1/4 text-right">
									{formatEuro(budget)} €
								</span>
								<span class={`w-1/4 text-right font-semibold ${variazionePercentuale >= 0 ? "text-green-600" : "text-red-600"}`}>
									{variazionePercentuale.toFixed(1)}%
								</span>
							</li>
						))}
						{(() => {
							const data = confrontoData();
							const totalIncassi = data.reduce((sum, item) => sum + item.incassi, 0);
							const totalBudget = data.reduce((sum, item) => sum + item.budget, 0);
							const globalVariation = totalBudget !== 0 ? ((totalIncassi - totalBudget) / totalBudget) * 100 : 0;
							return (
								<li class="flex justify-between items-center py-1 font-bold">
									<span class="w-1/4">Totale</span>
									<span class="w-1/4 text-right">
										{formatEuro(totalIncassi)} €
									</span>
									<span class="w-1/4 text-right">
										{formatEuro(totalBudget)} €
									</span>
									<span class={`w-1/4 text-right ${globalVariation >= 0 ? "text-green-600" : "text-red-600"}`}>
										{globalVariation.toFixed(1)}%
									</span>
								</li>
							);
						})()}
					</ul>
				</div>

				{/* Card con il grafico Incassi vs Budget Puntuale */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px]"
					style="flex: 1 1 auto; min-width: 300px;">
					<div id="budget-chart" class="flex justify-center w-full h-full"></div>
				</div>

				{/* Slot per "Spese vs Budget Previste" */}
				<div class="border rounded shadow-lg bg-white px-4 py-2 h-[400px] flex flex-col"
					style="flex: 1 1 auto; min-width: 300px;">
					<h2 class="text-lg text-center font-semibold mb-4">
						Spese vs Budget Puntuale
					</h2>
					<ul class="text-sm font-semibold">
						<li class="flex justify-between items-center py-1">
							<span class="w-1/4"></span>
							<span class="w-1/4 text-right">Spese</span>
							<span class="w-1/4 text-right">Bdg</span>
							<span class="w-1/4 text-right">Var %</span>
						</li>
					</ul>
					<ul class="text-sm space-y-1 flex-grow overflow-y-auto">
						{confrontoSpeseData().map(({ key, label, expense, plannedExpense, variationPercent }) => (
							<li key={key} class="flex justify-between items-center py-1 border-b">
								<span class="w-1/4">{label}</span>
								<span class="w-1/4 text-right">
									{formatEuro(expense)} €
								</span>
								<span class="w-1/4 text-right">
									{formatEuro(plannedExpense)} €
								</span>
								<span class={`w-1/4 text-right font-semibold ${variationPercent > 0 ? "text-red-600" : "text-green-600"}`}>
									{variationPercent.toFixed(1)}%
								</span>
							</li>
						))}
						{(() => {
							const data = confrontoSpeseData();
							const totalExpense = data.reduce((sum, item) => sum + item.expense, 0);
							const totalPlannedExpense = data.reduce((sum, item) => sum + item.plannedExpense, 0);
							const globalVariationExpense = totalPlannedExpense !== 0 ? ((totalExpense - totalPlannedExpense) / totalPlannedExpense) * 100 : 0;
							return (
								<li class="flex justify-between items-center py-1 font-bold">
									<span class="w-1/4">Totale</span>
									<span class="w-1/4 text-right">
										{formatEuro(totalExpense)} €
									</span>
									<span class="w-1/4 text-right">
										{formatEuro(totalPlannedExpense)} €
									</span>
									<span class={`w-1/4 text-right ${globalVariationExpense > 0 ? "text-red-600" : "text-green-600"}`}>
										{globalVariationExpense.toFixed(1)}%
									</span>
								</li>
							);
						})()}
					</ul>
				</div>

				{/* Card con il grafico Spese vs Budget Previste */}
				<div class="border rounded shadow-lg bg-white p-4 h-[400px]"
					style="flex: 1 1 auto; min-width: 300px;">
					<div id="expense-budget-chart" class="flex justify-center w-full h-full"></div>
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
