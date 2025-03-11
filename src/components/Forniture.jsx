import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Forniture = ({ companyId, forniture, setForniture, isLandscape }) => {
	const [showAddPopup, setShowAddPopup] = createSignal(false);
	const [newFornitura, setNewFornitura] = createSignal({
		data_scadenza: new Date().toISOString().split('T')[0],
		data_ricevuta: new Date().toISOString().split('T')[0], // Nuovo campo per la data di ricezione
		nome: '',
		importo: '',
		status: 'NOT_PAYED',
		riferimento: '', // Nuovo campo per Rif Fattura
	});
	const [showEditPopup, setShowEditPopup] = createSignal(false);
	const [editFornitura, setEditFornitura] = createSignal(null);

	const togglePaymentStatus = async (id, currentStatus) => {
		const newStatus = currentStatus === 'PAYED' ? 'NOT_PAYED' : 'PAYED';
		const { error } = await supabase
			.from('forniture')
			.update({ status: newStatus })
			.eq('id', id);
		if (!error) {
			setForniture(prevForniture =>
				prevForniture.map(f => (f.id === id ? { ...f, status: newStatus } : f))
			);
		}
	};

	const addNewFornitura = async () => {
		// Controllo campi obbligatori
		if (!newFornitura().data_scadenza || !newFornitura().data_ricevuta || !newFornitura().nome || !newFornitura().importo) {
			alert("Tutti i campi sono obbligatori tranne 'Rif Fattura'.");
			return;
		}

		const sanitizedImporto = newFornitura().importo.replace(',', '.');
		const numericImporto = parseFloat(sanitizedImporto);
		if (isNaN(numericImporto)) {
			alert("Inserisci un importo valido.");
			return;
		}

		const newEntry = {
			...newFornitura(),
			importo: numericImporto,
			riferimento: newFornitura().riferimento, // Campo opzionale
			data_ricevuta: newFornitura().data_ricevuta,
			company_id: companyId, 
		};

		const { data, error } = await supabase
			.from('forniture')
			.insert([newEntry])
			.select('*');

		if (!error) {
			setForniture(prev => [...prev, ...data]);
			setShowAddPopup(false);
		}
	};

	const updateFornitura = async () => {
		if (!editFornitura().data_scadenza || !editFornitura().data_ricevuta || !editFornitura().nome || !editFornitura().importo) {
			alert("Tutti i campi sono obbligatori tranne 'Rif Fattura'.");
			return;
		}

		const sanitizedImporto = editFornitura().importo.replace(',', '.');
		const numericImporto = parseFloat(sanitizedImporto);
		if (isNaN(numericImporto)) {
			alert("Inserisci un importo valido.");
			return;
		}

		const updatedEntry = {
			...editFornitura(),
			importo: numericImporto,
		};

		const { error } = await supabase
			.from('forniture')
			.update(updatedEntry)
			.eq('id', editFornitura().id);

		if (!error) {
			setForniture(prev =>
				prev.map(f => (f.id === editFornitura().id ? updatedEntry : f))
			);
			setShowEditPopup(false);
		}
	};


	const deleteFornitura = async (id) => {
		const confirmDelete = confirm("Sei sicuro di voler eliminare questa fornitura?");
		if (!confirmDelete) return;

		const { error } = await supabase
			.from('forniture')
			.delete()
			.eq('id', id);

		if (!error) {
			setForniture(prevForniture => prevForniture.filter(f => f.id !== id));
		} else {
			alert("Errore durante la cancellazione. Riprova.");
		}
	};

	return (
		<div class={`flex flex-col h-full px-2 pt-2 ${isLandscape() ? "text-xl" : "text-xs"}`}>
			<div class="flex flex-none text-gray-600 w-full h-[30px] items-center justify-center text-lg mb-2 font-semibold">
				Forniture
			</div>
			<div class="flex flex-none w-full h-[30px] border-b items-center font-semibold">
				<div class="text-center w-[20%]">Scadenza</div>
				<div class="text-center w-[35%]">Nome</div>
				<div class="text-center w-[20%]">Importo</div>
				<div class="text-center w-[15%]">Pagato</div>
				<div class="text-center w-[10%]"></div>
			</div>
			<div class="flex-grow overflow-y-auto pb-40">

				{forniture()
					.sort((a, b) => new Date(a.data_scadenza) - new Date(b.data_scadenza))
					.map(f => (
						<div
							key={f.id}
							class="flex items-center border-b py-2 cursor-pointer hover:bg-gray-100"
							onClick={() => {
								setEditFornitura({
									...f,
									importo: f.importo.toString().replace('.', ','), // Converti il separatore decimale in ","
								});
								setShowEditPopup(true);
							}}

						>
							<div class="text-center w-[20%]">
								{new Date(f.data_scadenza).toLocaleDateString('it-IT')}
							</div>

							<div class="text-center px-2 w-[35%]">{f.nome}</div>
							<div class="text-right pr-3 w-[20%]">
								{new Intl.NumberFormat('it-IT', {
									minimumFractionDigits: 0,
									maximumFractionDigits: 2
								}).format(f.importo)} €
							</div>
							<div class="text-center w-[15%] h-full">
								<input
									type="checkbox"
									checked={f.status === 'PAYED'}
									onClick={(e) => e.stopPropagation()} // Blocca la propagazione
									onChange={() => togglePaymentStatus(f.id, f.status)}
									class="cursor-pointer w-6 h-6"
								/>
							</div>

							<div class="text-center w-[10%]">
								<button
									onClick={(e) => {
										e.stopPropagation(); // Blocca la propagazione del click
										deleteFornitura(f.id);
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
					setNewFornitura({
						data_scadenza: new Date().toISOString().split('T')[0],
						data_ricevuta: new Date().toISOString().split('T')[0],
						nome: '',
						importo: '',
						status: 'NOT_PAYED',
						riferimento: '',
					});
					setShowAddPopup(true);
				}}
				class="fixed bottom-[106px] right-4 w-16 h-16 bg-blue-500 text-white rounded-full shadow-lg shadow-gray-400 flex items-center justify-center hover:bg-green-600"
			>
				<img src="/plus-white.svg" alt="plus" class="h-7 mx-auto" />
			</button>

			{showAddPopup() && (
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div class="bg-white rounded-lg p-6 w-[90%] relative">
						<button
							onClick={() => setShowAddPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-bold mb-4 text-center">Nuova Fornitura</h2>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								await addNewFornitura();
							}}
						>
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Data Ricevuta</label>
								<input
									type="date"
									value={newFornitura().data_ricevuta}
									onInput={(e) => setNewFornitura({ ...newFornitura(), data_ricevuta: e.currentTarget.value })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Data Scadenza</label>
								<input
									type="date"
									value={newFornitura().data_scadenza}
									onInput={(e) => setNewFornitura({ ...newFornitura(), data_scadenza: e.currentTarget.value })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Nome</label>
								<input
									type="text"
									value={newFornitura().nome}
									onInput={(e) => setNewFornitura({ ...newFornitura(), nome: e.currentTarget.value })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Rif Fattura (opzionale)</label>
								<input
									type="text"
									value={newFornitura().riferimento}
									onInput={(e) => setNewFornitura({ ...newFornitura(), riferimento: e.currentTarget.value })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Importo</label>
								<input
									type="text"
									value={newFornitura().importo}
									onInput={(e) => {
										let input = e.currentTarget.value;

										// Permette solo numeri, il segno meno all'inizio e una singola virgola
										input = input.replace(/[^0-9,-]/g, '');

										// Evita più segni meno consecutivi e impedisce il meno in posizioni non valide
										if (input.length > 1) {
											input = input.replace(/(?!^)-/g, '');
										}

										setNewFornitura({
											...newFornitura(),
											importo: input,
										});
									}}
									class="w-full border rounded px-3 py-2"
								/>
							</div>
							<div class="flex justify-center mt-8 w-full">
								<button
									type="submit"
									class="px-4 py-2 w-full text-xl bg-blue-500 text-white rounded hover:bg-blue-600"
								>
									SALVA
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{showEditPopup() && (
				<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div class="bg-white rounded-lg p-6 w-[90%] relative">
						<button
							onClick={() => setShowEditPopup(false)}
							class="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
						>
							<img src="/cancel-black.svg" alt="cancel" class="h-7 mx-auto" />
						</button>

						<h2 class="text-lg font-bold mb-4 text-center">Modifica Fornitura</h2>

						<form
							onSubmit={async (e) => {
								e.preventDefault();
								await updateFornitura();
							}}
						>
							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Data Ricevuta</label>
								<input
									type="date"
									value={editFornitura().data_ricevuta}
									onInput={(e) => setEditFornitura({ ...editFornitura(), data_ricevuta: e.currentTarget.value })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Data Scadenza</label>
								<input
									type="date"
									value={editFornitura().data_scadenza}
									onInput={(e) => setEditFornitura({ ...editFornitura(), data_scadenza: e.currentTarget.value })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Nome</label>
								<input
									type="text"
									value={editFornitura().nome}
									onInput={(e) => setEditFornitura({ ...editFornitura(), nome: e.currentTarget.value })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Rif Fattura (opzionale)</label>
								<input
									type="text"
									value={editFornitura().riferimento}
									onInput={(e) => setEditFornitura({ ...editFornitura(), riferimento: e.currentTarget.value })}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							<div class="mb-4">
								<label class="block text-sm font-medium mb-1">Importo</label>
								<input
									type="text"
									value={editFornitura().importo}
									onInput={(e) => {
										let input = e.currentTarget.value;

										// Permette solo numeri, il segno meno all'inizio e una singola virgola
										input = input.replace(/[^0-9,-]/g, '');

										// Evita più segni meno consecutivi e impedisce il meno in posizioni non valide
										if (input.length > 1) {
											input = input.replace(/(?!^)-/g, '');
										}

										setEditFornitura({
											...editFornitura(),
											importo: input,
										});
									}}
									class="w-full border rounded px-3 py-2"
								/>
							</div>

							<div class="flex justify-center mt-8 w-full">
								<button
									type="submit"
									class="px-4 py-2 w-full text-xl bg-blue-500 text-white rounded hover:bg-blue-600"
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

export default Forniture;
