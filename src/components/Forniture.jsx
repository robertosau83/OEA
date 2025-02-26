import { createSignal, onMount } from 'solid-js';
import { supabase } from '../lib/supabaseClient';

const Forniture = ({ forniture, setForniture }) => {
	const [showAddPopup, setShowAddPopup] = createSignal(false);
	const [newFornitura, setNewFornitura] = createSignal({
		data_scadenza: new Date().toISOString().split('T')[0],
		data_ricevuta: new Date().toISOString().split('T')[0], // Nuovo campo per la data di ricezione
		nome: '',
		importo: '',
		status: 'NOT_PAYED',
		riferimento: '', // Nuovo campo per Rif Fattura
	});



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
		<div class="flex flex-col h-full px-2 pt-2">
			<table class="w-full">
				<thead>
					<tr class="text-xs">
						<th class="border-b py-2">Data Scadenza</th>
						<th class="border-b py-2">Nome</th>
						<th class="border-b py-2">Importo</th>
						<th class="border-b py-2">Pagato</th>
						<th class="border-b py-2"></th>
					</tr>
				</thead>
				<tbody>
					{forniture()
						.sort((a, b) => new Date(a.data_scadenza) - new Date(b.data_scadenza))
						.map(f => (
							<tr key={f.id} class="text-xs">
								<td class="border-b text-center py-2">
									{new Date(f.data_scadenza).toLocaleDateString('it-IT')}
								</td>

								<td class="border-b text-center py-2">{f.nome}</td>
								<td class="border-b text-center py-2">
									{new Intl.NumberFormat('it-IT', {
										minimumFractionDigits: 0,
										maximumFractionDigits: 2
									}).format(f.importo)} €
								</td>
								<td class="border-b py-2 text-center flex justify-center items-center gap-3">
									<input
										type="checkbox"
										checked={f.status === 'PAYED'}
										onChange={() => togglePaymentStatus(f.id, f.status)}
										class="h-5 w-5 cursor-pointer"
									/>
								</td>
								<td>
									<button onClick={() => deleteFornitura(f.id)} class="text-red-500 hover:text-red-700">
										<img src="/trash-black.svg" alt="cestino" class="h-5 w-5" />
									</button>
								</td>
							</tr>
						))}
				</tbody>
			</table>

			<button
				onClick={() => setShowAddPopup(true)}
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
										const input = e.currentTarget.value;

										// Sostituisci immediatamente "." con ","
										let sanitizedInput = input.replace('.', ',');

										// Rimuovi tutti i caratteri non validi (solo numeri e ",")
										sanitizedInput = sanitizedInput.replace(/[^0-9,]/g, '');

										// Aggiorna lo stato con il valore sanitizzato
										setNewFornitura({
											...newFornitura(),
											importo: sanitizedInput,
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
