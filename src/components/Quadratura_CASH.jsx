import { createSignal, onMount } from "solid-js";
import { supabase } from '../lib/supabaseClient';

const Quadratura_CASH = ({ companyId, cashflow, cash, setCash }) => {
	const [cashEffettivi, setCashEffettivi] = createSignal("");
	const [cutoffDate, setCutoffDate] = createSignal("");
	const [showConfirmPopup, setShowConfirmPopup] = createSignal(false);

	onMount(() => {
		console.log(cash());
	});

	const formatDate = (date) => {
		if (!date) return "";
		const [year, month, day] = date.split("-");
		return `${day}/${month}/${year.slice(-2)}`; // Prende solo le ultime due cifre dell'anno
	};

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

	// Calcola la sommatoria dei movimenti di cashflow con origin "CASH" o "CONTANTI CASSA"
	const totalTeorici = () => {
		return cashflow()?.reduce((acc, item) => {
			if (item.origin === "CASH" || item.origin === "CONTANTI CASSA") {
				// Se cutoffDate è valorizzata, somma solo i movimenti con data_operazione <= cutoffDate
				if (cutoffDate() && item.data_operazione > cutoffDate()) {
					return acc;
				}
				return acc + Number(item.importo);
			}
			return acc;
		}, 0) || 0;
	};

	const handleConfirmQuadratura = async () => {
		// Converti CASH Effettivi in numero (sostituendo eventualmente la virgola con il punto)
		const effettivi = parseFloat(cashEffettivi().replace(',', '.'));
		if (isNaN(effettivi)) {
			alert("Inserisci un valore numerico valido per CASH Effettivi.");
			return;
		}
		// Verifica che la data cutoff (se valorizzata) non sia successiva ad oggi
		const today = new Date().toISOString().slice(0, 10);
		if (cutoffDate() && cutoffDate() > today) {
			alert("La data di cutoff non può essere successiva ad oggi.");
			return;
		}
		const total = totalTeorici();
		const difference = effettivi - total;
		const roundedDifference = Math.round(difference * 100) / 100;
		const metodo_di_pagamento = roundedDifference >= 0 ? "Aggiunti ai cash" : "Presi dai cash";
		const data_operazione = cutoffDate() ? cutoffDate() : today;

		// Inserisci nel database (utilizzando supabase)
		const newMovement = {
			descrizione: "Allineamento CASH reali / CASH effettivi",
			importo: roundedDifference,
			tipo: "Allineamento",
			metodo_di_pagamento,
			data_operazione,
			company_id: companyId,
		};

		const { error, data } = await supabase
			.from("CASH")
			.insert([newMovement])
			.select('*')
			.single();
		if (error) {
			alert("Errore durante l'inserimento dell'importo di allineamento: " + error.message);
			return;
		}
		// Aggiorna lo stato locale: aggiungi la nuova riga alla lista cash
		setCash([...cash(), data]);
		setShowConfirmPopup(false);
		setCashEffettivi("");
	};


	return (
		<div class="p-4">
			<div class="flex text-center items-center justify-center text-gray-400 mb-5">Allineamento tra l'ammontare dei CASH teorici calcolati dalla applicazione e quelli reali in possesso all'utente</div>

			<div class="flex flex-col items-center justify-center mb-4">
				<label class="block text-gray-700">
					Data Riferimento (facoltativa)
				</label>
				<input
					type="date"
					value={cutoffDate()}
					onInput={(e) => setCutoffDate(e.currentTarget.value)}
					max={new Date().toISOString().split("T")[0]}
					class="mt-1 p-2 block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
				/>
			</div>

			<div class="flex flex-col items-center justify-center my-8">
				<label class="block text-gray-700">CASH Teorici
				<span>{cutoffDate() ? ` al ` : ""}</span>
					<span class={`${cutoffDate() ? "font-semibold" : ""}`}>{cutoffDate() ? `${formatDate(cutoffDate())}` : " attuali"}</span>
				</label>
				<div class={`mt-1 text-2xl font-semibold ${totalTeorici() > 0 ? "text-green-700" : "text-red-700"}`}>
					{formatEuro(totalTeorici(), true)} €
				</div>
			</div>

			<div class="flex flex-col items-center justify-center my-8">
				<label class="block text-gray-700">CASH Effettivi
					<span>{cutoffDate() ? ` al ` : ""}</span>
					<span class={`${cutoffDate() ? "font-semibold" : ""}`}>{cutoffDate() ? `${formatDate(cutoffDate())}` : " attuali"}</span>
				</label>
				<input
					id="cashEffettivi"
					type="text"
					value={cashEffettivi()}
					onInput={(e) => {
						const input = e.currentTarget.value;
						// Sostituisci subito "." con ","
						let sanitizedInput = input.replace('.', ',');
						// Rimuovi eventuali "-" che non sono all'inizio
						sanitizedInput = sanitizedInput.replace(/(?!^)-/g, '');
						// Rimuovi tutti i caratteri non validi (permette solo numeri, "," e il "-" iniziale)
						sanitizedInput = sanitizedInput.replace(/[^0-9,-]/g, '');
						setCashEffettivi(sanitizedInput);
					}}
					class={`text-center text-2xl font-semibold placeholder:text-base placeholder:font-normal mt-1 p-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm ${/^-?[0-9]*,?[0-9]*$/.test(cashEffettivi()) ? "" : "text-red-500"
						}`}
					placeholder="Inserisci CASH effettivi, se diversi dai teorici"
				/>
			</div>

			<div class="flex justify-center mt-8">
				<button
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
					onClick={() => {
						if (cashEffettivi().trim() === "") {
							alert("Inserisci un valore per CASH Effettivi prima di procedere.");
							return;
						}
						setShowConfirmPopup(true);
					}}
				>
					QUADRA
				</button>
			</div>

			{showConfirmPopup() && (
				<div
					class="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-30"
					onClick={() => setShowConfirmPopup(false)}
				>
					<div
						class="relative bg-white p-4 pt-12 rounded-lg shadow-lg w-80"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							onClick={() => setShowConfirmPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<p class="mb-4 text-gray-700 text-center">
							Stai dichiarando che in data{" "}
							<span class="font-semibold">{cutoffDate() ? formatDate(cutoffDate()) : "odierna"}</span> la disponibilità CASH non {cutoffDate() ? "era " : "è "}
							<span class="font-semibold">{formatEuro(totalTeorici(), true)} €</span>,
							ma {cutoffDate() ? "era " : "è "} invece{" "}
							<span class="font-semibold">{formatEuro(parseFloat(cashEffettivi().replace(',', '.')), true)} €</span>.
						</p>
						<p class="mb-8 text-gray-700 text-center">
							Verrà quindi inserito un movimento di allineamento di
							<span class="font-semibold">{parseFloat(cashEffettivi().replace(',', '.')) - totalTeorici() > 0 ? " +" : " "}
								{formatEuro(parseFloat(cashEffettivi().replace(',', '.')) - totalTeorici(), true)} €
							</span>
							{" "}nel cashflow, in modo che la disponibilità cash in data{" "}
							<span class="font-semibold">{cutoffDate() ? formatDate(cutoffDate()) : "odierna"}</span> risulterà di{" "}
							<span class="font-semibold whitespace-nowrap">{formatEuro(parseFloat(cashEffettivi().replace(',', '.')), true)} €</span> come da te richiesto.
						</p>
						<div class="flex items-center justify-center gap-2">
							<button
								class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
								onClick={handleConfirmQuadratura}
							>
								Conferma
							</button>
						</div>
					</div>
				</div>
			)}

		</div>
	);
};

export default Quadratura_CASH;
