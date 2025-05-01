import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Scadenze = ({ companyId, scadenze, setScadenze, isLandscape }) => {
	const [showAddPopup, setShowAddPopup] = createSignal(false);
	const [newScadenza, setNewScadenza] = createSignal({
		data_scadenza: new Date().toISOString().split('T')[0],
		data_ricevuta: new Date().toISOString().split('T')[0],
		nome: '',
		importo: '',
		status: 'NOT_PAYED',
		descrizione: '',
	});
	// Segnale per la direzione in fase di inserimento (default: 'entrata')
	const [newMovementDirection, setNewMovementDirection] = createSignal('entrata');

	const [showEditPopup, setShowEditPopup] = createSignal(false);
	const [editScadenza, setEditScadenza] = createSignal(null);
	// Segnale per la direzione in fase di modifica
	const [editMovementDirection, setEditMovementDirection] = createSignal('entrata');

	const togglePaymentStatus = async (id, currentStatus) => {
		const newStatus = currentStatus === 'PAYED' ? 'NOT_PAYED' : 'PAYED';
		const { error } = await supabase
			.from('scadenze')
			.update({ status: newStatus })
			.eq('id', id);
		if (!error) {
			setScadenze(prevScadenze =>
				prevScadenze.map(f => (f.id === id ? { ...f, status: newStatus } : f))
			);
		}
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

	const addNewScadenza = async () => {
		// Verifica che tutti i campi obbligatori siano compilati
		if (!newScadenza().data_scadenza || !newScadenza().data_ricevuta || !newScadenza().nome || !newScadenza().importo) {
			alert("Tutti i campi sono obbligatori tranne 'Rif Fattura'.");
			return;
		}

		const sanitizedImporto = newScadenza().importo.replace(',', '.');
		let numericImporto = parseFloat(sanitizedImporto);
		if (isNaN(numericImporto)) {
			alert("Inserisci un importo valido.");
			return;
		}

		// Imposta il segno in base alla direzione selezionata
		if (newMovementDirection() === 'uscita') {
			numericImporto = -Math.abs(numericImporto);
		} else {
			numericImporto = Math.abs(numericImporto);
		}

		const newEntry = {
			...newScadenza(),
			importo: numericImporto,
			descrizione: newScadenza().descrizione,
			data_ricevuta: newScadenza().data_ricevuta,
			company_id: companyId,
		};

		const { data, error } = await supabase
			.from('scadenze')
			.insert([newEntry])
			.select('*');

		if (!error) {
			setScadenze(prev => [...prev, ...data]);
			setShowAddPopup(false);
		}
	};

	const updateScadenza = async () => {
		if (!editScadenza().data_scadenza || !editScadenza().data_ricevuta || !editScadenza().nome || !editScadenza().importo) {
			alert("Tutti i campi sono obbligatori tranne 'Rif Fattura'.");
			return;
		}

		const sanitizedImporto = editScadenza().importo.replace(',', '.');
		let numericImporto = parseFloat(sanitizedImporto);
		if (isNaN(numericImporto)) {
			alert("Inserisci un importo valido.");
			return;
		}

		// Imposta il segno in base alla direzione selezionata in modifica
		if (editMovementDirection() === 'uscita') {
			numericImporto = -Math.abs(numericImporto);
		} else {
			numericImporto = Math.abs(numericImporto);
		}

		const updatedEntry = {
			...editScadenza(),
			importo: numericImporto,
		};

		const { error } = await supabase
			.from('scadenze')
			.update(updatedEntry)
			.eq('id', editScadenza().id);

		if (!error) {
			setScadenze(prev =>
				prev.map(f => (f.id === editScadenza().id ? updatedEntry : f))
			);
			setShowEditPopup(false);
		}
	};

	const deleteScadenza = async (id) => {
		const confirmDelete = confirm("Sei sicuro di voler eliminare questa Scadenza?");
		if (!confirmDelete) return;

		const { error } = await supabase
			.from('scadenze')
			.delete()
			.eq('id', id);

		if (!error) {
			setScadenze(prevScadenze => prevScadenze.filter(f => f.id !== id));
		} else {
			alert("Errore durante la cancellazione. Riprova.");
		}
	};

	return (
		<div class={`flex flex-col h-full px-2 pt-2`}>

			<div class={`flex flex-none w-full h-[30px] border-b items-center font-semibold text-gray-900 ${!isLandscape() ? "text-xs" : "pr-4"}`}>
				<div class="flex-none text-center w-[20%]">Scadenza</div>
				<div class="flex-grow text-center">Descrizione</div>
				<div class="flex-none text-center w-[20%]">Importo</div>
				<div class="flex-none text-center w-[15%]">Pagato</div>
				<div class="flex-none text-center w-[10%]"></div>   
			</div>

			<div class={`flex-grow overflow-y-auto pb-40 text-gray-800 ${!isLandscape() && "text-xs"}`}>
				{scadenze()
					.sort((a, b) => new Date(a.data_scadenza) - new Date(b.data_scadenza))
					.map(f => (
						<div
							key={f.id}
							class="flex items-center border-b py-2 cursor-pointer hover:bg-gray-100"
							onClick={() => {
								// Quando si clicca per modificare, imposta anche la direzione in base al segno
								setEditScadenza({
									...f,
									importo: Math.abs(f.importo).toString().replace('.', ','),
								});
								setEditMovementDirection(f.importo < 0 ? 'uscita' : 'entrata');
								setShowEditPopup(true);
							}}
						>
							<div class="flex-none text-center w-[20%]">
								{new Date(f.data_scadenza).toLocaleDateString('it-IT')}
							</div>
							<div class="px-2 flex flex-grow items-center justify-center text-center">{f.nome}</div>
							<div class="flex-none text-right pr-3 w-[20%] whitespace-nowrap">
								{formatEuro(f.importo)} €
							</div>
							<div class="flex-none flex items-center justify-center w-[15%] h-full">
								<input
									type="checkbox"
									checked={f.status === 'PAYED'}
									onClick={(e) => e.stopPropagation()}
									onChange={() => togglePaymentStatus(f.id, f.status)}
									class="cursor-pointer w-6 h-6"
								/>
							</div>
							<div class="flex-none text-center w-[10%]">
								<button
									onClick={(e) => {
										e.stopPropagation();
										deleteScadenza(f.id);
									}}
									class="text-red-500 hover:text-red-700"
								>
									<img src="/trash-black.svg" alt="cestino" class="h-6 w-6" />
								</button>
							</div>
						</div>
					))}
			</div>

			<button
				onClick={() => {
					setNewScadenza({
						data_scadenza: new Date().toISOString().split('T')[0],
						data_ricevuta: new Date().toISOString().split('T')[0],
						nome: '',
						importo: '',
						status: 'NOT_PAYED',
						descrizione: '',
					});
					// Resetta la direzione al valore predefinito
					setNewMovementDirection('entrata');
					setShowAddPopup(true);
				}}
				class="fixed bottom-6 right-6 w-16 h-16 bg-blue-800 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center"
			>
				<img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
			</button>

			{showAddPopup() && (
				<div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300">
					<div class="bg-gradient-to-b from-blue-200 to-blue-50 text-gray-800 rounded-lg p-6 w-[90%] max-w-[400px] relative transform transition-all duration-300 ease-out translate-y-full opacity-0 animate-slidein">

						<button
							onClick={() => setShowAddPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-bold mb-6 text-center text-gray-800">
							Nuova Scadenza
						</h2>

						{/* Sezione per selezionare la direzione del movimento */}
						<div class="flex justify-center gap-1 mb-4">
							<button
								type="button"
								class={`px-4 py-2 w-[140px] rounded-l-full shadow-lg ${newMovementDirection() === 'entrata'
									? 'bg-green-200 text-green-800 font-semibold'
									: 'bg-white text-gray-700'
									}`}
								onClick={() => setNewMovementDirection('entrata')}
							>
								IN ENTRATA
							</button>
							<button
								type="button"
								class={`px-4 py-2 w-[140px] rounded-r-full shadow-lg ${newMovementDirection() === 'uscita'
									? 'bg-red-200 text-red-800 font-semibold'
									: 'bg-white text-gray-700'
									}`}
								onClick={() => setNewMovementDirection('uscita')}
							>
								IN USCITA
							</button>
						</div>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								await addNewScadenza();
							}}
						>
							{/* Campo Data Ricevuta */}
							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">
									Data Ricevuta
								</label>
								<input
									type="date"
									value={newScadenza().data_ricevuta}
									onInput={(e) => setNewScadenza({ ...newScadenza(), data_ricevuta: e.currentTarget.value })}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg"
								/>
							</div>

							{/* Campo Data Scadenza */}
							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">
									Data Scadenza
								</label>
								<input
									type="date"
									value={newScadenza().data_scadenza}
									onInput={(e) => setNewScadenza({ ...newScadenza(), data_scadenza: e.currentTarget.value })}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg"
								/>
							</div>

							{/* Campo Nome */}
							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">
									Descrizione
								</label>
								<input
									type="text"
									value={newScadenza().nome}
									onInput={(e) => setNewScadenza({ ...newScadenza(), nome: e.currentTarget.value })}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg w-full"
								/>
							</div>

							{/* Campo Descrizione */}
							<div class="flex flex-col items-center mb-7">
								<label class="block font-medium mb-1 text-center">
									Commento
									<span class="ml-1 text-gray-400 font-normal">(opzionale)</span>
								</label>
								<input
									type="text"
									value={newScadenza().descrizione}
									onInput={(e) => setNewScadenza({ ...newScadenza(), descrizione: e.currentTarget.value })}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg w-full"
								/>
							</div>

							{/* Campo Importo */}
							<div class="flex justify-between items-center mb-10">
								<label class="flex items-center justify-start font-medium">Importo</label>
								<div class="flex">
									<input
										type="text"
										value={newScadenza().importo}
										onInput={(e) => {
											let input = e.currentTarget.value;
											input = input.replace(/[^0-9,]/g, ''); // Solo cifre e virgola
											setNewScadenza({ ...newScadenza(), importo: input });
										}}
										class="rounded-lg px-3 py-1 text-center text-lg shadow-lg w-24"
									/>
									<label class="flex items-center justify-end font-medium w-4">€</label>
								</div>
							</div>

							{/* Bottone Salva */}
							<div class="flex justify-center mt-8 w-full">
								<button
									type="submit"
									class="px-4 py-2 w-full text-xl bg-blue-800 text-white font-semibold rounded-lg shadow-lg shadow-gray-500"
								>
									SALVA
								</button>
							</div>
						</form>

					</div>
				</div>
			)}

			{showEditPopup() && (
				<div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300">
					<div class="bg-gradient-to-b from-yellow-200 to-yellow-50 text-gray-800 rounded-lg p-6 w-[90%] max-w-[400px] relative transform transition-all duration-300 ease-out translate-y-full opacity-0 animate-slidein">

						<button
							onClick={() => setShowEditPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-bold mb-6 text-center">
							Modifica Scadenza
						</h2>

						{/* Direzione movimento */}
						<div class="flex justify-center gap-1 mb-4">
							<button
								type="button"
								class={`px-4 py-2 w-[140px] rounded-l-full shadow-lg ${editMovementDirection() === 'entrata'
									? 'bg-green-200 text-green-800 font-semibold'
									: 'bg-white text-gray-700'
									}`}
								onClick={() => setEditMovementDirection('entrata')}
							>
								IN ENTRATA
							</button>
							<button
								type="button"
								class={`px-4 py-2 w-[140px] rounded-r-full shadow-lg ${editMovementDirection() === 'uscita'
									? 'bg-red-200 text-red-800 font-semibold'
									: 'bg-white text-gray-700'
									}`}
								onClick={() => setEditMovementDirection('uscita')}
							>
								IN USCITA
							</button>
						</div>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								await updateScadenza();
							}}
						>
							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">Data Ricevuta</label>
								<input
									type="date"
									value={editScadenza().data_ricevuta}
									onInput={(e) => setEditScadenza({ ...editScadenza(), data_ricevuta: e.currentTarget.value })}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg"
								/>
							</div>

							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">Data Scadenza</label>
								<input
									type="date"
									value={editScadenza().data_scadenza}
									onInput={(e) => setEditScadenza({ ...editScadenza(), data_scadenza: e.currentTarget.value })}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg"
								/>
							</div>

							<div class="flex flex-col items-center mb-4">
								<label class="block font-medium mb-1 text-center">Descrizione</label>
								<input
									type="text"
									value={editScadenza().nome}
									onInput={(e) => setEditScadenza({ ...editScadenza(), nome: e.currentTarget.value })}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg w-full"
								/>
							</div>

							<div class="flex flex-col items-center mb-7">
								<label class="block font-medium mb-1 text-center">
									Commento<span class="ml-1 text-gray-400 font-normal">(opzionale)</span>
								</label>
								<input
									type="text"
									value={editScadenza().descrizione}
									onInput={(e) => setEditScadenza({ ...editScadenza(), descrizione: e.currentTarget.value })}
									class="rounded-lg px-3 py-1 text-center text-lg shadow-lg w-full"
								/>
							</div>

							<div class="flex justify-between items-center mb-8">
								<label class="flex items-center justify-start font-medium">Importo</label>
								<div class="flex">
									<input
										type="text"
										value={editScadenza().importo}
										onInput={(e) => {
											let input = e.currentTarget.value;
											input = input.replace(/[^0-9,]/g, '');
											setEditScadenza({ ...editScadenza(), importo: input });
										}}
										class="rounded-lg px-3 py-1 text-center text-lg shadow-lg w-24"
									/>
									<label class="flex items-center justify-end font-medium w-4">€</label>
								</div>
							</div>

							<div class="flex justify-center mt-8 w-full">
								<button
									type="submit"
									class="px-4 py-2 w-full text-xl bg-blue-800 text-white font-semibold rounded-lg shadow-lg shadow-gray-500"
								>
									SALVA
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

		</div>
	);
};

export default Scadenze;
