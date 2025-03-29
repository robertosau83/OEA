import { createSignal, onMount, createEffect, onCleanup } from 'solid-js';
import Chiusure from './components/Chiusure.jsx';
import Cashflow from './components/Cashflow.jsx';
import EstrattoCC from './components/EstrattoCC.jsx';
import Scadenze from './components/Scadenze.jsx';
import Quadratura_CASH from './components/Quadratura_CASH.jsx';
import Quadratura_CC from './components/Quadratura_CC.jsx';
import Statistiche from './components/Statistiche.jsx';
import Budget from './components/Budget.jsx';
import loadDataFromDB from "./lib/loadDataFromDB.js";
import composeLocalStates from "./lib/composeLocalStates.js";

const App = ({ companyId, companyName, nickName, bancaImportPDF, onLogout }) => {
	const [currentBtmBarComponentName, setCurrentBtmBarComponentName] = createSignal("Chiusure");
	const [isLoading, setIsLoading] = createSignal(true);
	const [chiusure, setChiusure] = createSignal([]);
	const [cashflow, setCashflow] = createSignal([]);
	const [cash, setCash] = createSignal([]);
	const [cc, setCC] = createSignal([]);
	const [ccJson, setCCJson] = createSignal([]);
	const [scadenze, setScadenze] = createSignal([]);
	const [budget, setBudget] = createSignal([]);
	const [chiusureConSpese, setChiusureConSpese] = createSignal([]);
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);

	// Stato per tracciare l'orientamento dello schermo
	const [isLandscape, setIsLandscape] = createSignal(window.innerWidth > window.innerHeight);

	// Funzione per aggiornare l'orientamento
	const updateOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight);

	// Esegui il caricamento dei dati quando il componente viene montato
	onMount(async () => {
		//console.log(companyId, companyName, nickName, bancaImportPDF);
		await loadDataFromDB(setChiusure, setCash, setCC, setCCJson, setScadenze, setBudget);
		setIsLoading(false);
	});

	// Gestisci il resize dello schermo con `createEffect`
	createEffect(() => {
		window.addEventListener("resize", updateOrientation);

		// Cleanup corretto quando il componente si smonta
		return () => {
			window.removeEventListener("resize", updateOrientation);
		};
	});

	// Effetto reattivo: ogni volta che chiusure(), cash() o cc() cambiano, compone le chiusure con spese e il cashflow
	createEffect(() => {
		// Vengono richiamati chiusure() e cash() per stabilire la dipendenza
		composeLocalStates(chiusure(), cash(), cc(), setChiusureConSpese, setCashflow);
		//console.log(chiusureConSpese());
	});

	// Funzione per formattare le date
	const formatDate = (date) => {
		if (!date) return "";
		const [year, month, day] = date.split("-");
		return `${day}/${month}/${year}`;
	};

	const sharedProps = {
		companyId, companyName,
		nickName,
		bancaImportPDF,
		isLandscape,
		chiusure, setChiusure,
		cash, setCash,
		cc, setCC,
		ccJson, setCCJson,
		chiusureConSpese, setChiusureConSpese,
		cashflow, setCashflow,
		scadenze, setScadenze,
		budget, setBudget,
	};

	const renderMainContent = () => {
		if (currentBtmBarComponentName() === "Chiusure") {
			return <Chiusure {...sharedProps} />;
		}
		if (currentBtmBarComponentName() === "Cashflow") {
			return <Cashflow {...sharedProps} />;
		}
		if (currentBtmBarComponentName() === "EstrattoCC") {
			return <EstrattoCC {...sharedProps} />;
		}
		if (currentBtmBarComponentName() === "Scadenze") {
			return <Scadenze {...sharedProps} />;
		}
		if (currentBtmBarComponentName() === "Quadratura_CASH") {
			return <Quadratura_CASH {...sharedProps} />;
		}
		if (currentBtmBarComponentName() === "Quadratura_CC") {
			return <Quadratura_CC {...sharedProps} />;
		}
		if (currentBtmBarComponentName() === "Statistiche") {
			return <Statistiche {...sharedProps} />;
		}
		if (currentBtmBarComponentName() === "Budget") {
			return <Budget {...sharedProps} />;
		}
		return null; // In caso di valore non gestito
	};

	return (
		<div class="flex flex-col h-screen">
			{isLoading() ? (
				// Pagina di caricamento
				<div class="flex items-center justify-center h-full">
					<p class="text-lg font-semibold">Caricamento dati in corso...</p>
				</div>
			) : (
				<>
					{/* Overlay per chiudere il menù cliccando fuori */}
					{isMenuOpen() && (
						<div
							class="fixed inset-0 bg-black bg-opacity-50 z-40"
							onClick={() => setIsMenuOpen(false)}
						></div>
					)}

					{/* Sidebar Menù */}
					<div
						class={`fixed top-0 left-0 w-64 h-full bg-white shadow-md z-50 transform ${isMenuOpen() ? "translate-x-0" : "-translate-x-full"
							} transition-transform duration-300 ease-in-out`}
					>
						<div class="p-2">
							{/* <h2 class="text-lg font-semibold mb-4">Menù</h2> */}
							<div class="flex items-center justify-start pb-2 border-b">
								<img src="/wiseflow 192.png" alt="Logo Piccolo" class="h-10" />
								<div class="flex flex-col justify-center ml-2 text-sm">
									<div>{nickName}</div>
									<div class="text-gray-600">{companyName}</div>
								</div>
								{/* {companyId === "f5f41f26-2831-49d3-8a0c-ecc6d2a128c7" && (<div class="ml-2 font-semibold">El Santo</div>)}
								{companyId === "70cd0446-5fb9-474c-95fa-b11cc38e69e2" && (<div class="ml-2 font-semibold">Sboccia</div>)}
								{companyId === "1b13a736-8c1f-4612-8e0f-1e4d5a140269" && (<div class="ml-2 font-semibold">Example</div>)} */}
							</div>

							{/* Statistiche  */}
							<button
								class={`w-full text-left px-2 py-2 text-gray-700 hover:bg-gray-100
									${currentBtmBarComponentName() === "Statistiche" ? 'text-blue-600 border-l-2 border-blue-600 bg-blue-100' : ''}
									`}
								onClick={() => {
									setCurrentBtmBarComponentName("Statistiche");
									setIsMenuOpen(false);
								}}
							>
								Statistiche
							</button>

							{/* Scadenze */}
							<button
								class={`w-full text-left px-2 py-2 text-gray-700 hover:bg-gray-100
									${currentBtmBarComponentName() === "Scadenze" ? 'text-blue-600 border-l-2 border-blue-600 bg-blue-100' : ''}
									`}
								onClick={() => {
									setCurrentBtmBarComponentName("Scadenze");
									setIsMenuOpen(false);
								}}
							>
								Scadenze
							</button>

							{/* estratto CC */}
							<button
								class={`w-full text-left px-2 py-2 text-gray-700 hover:bg-gray-100
									${currentBtmBarComponentName() === "EstrattoCC" ? 'text-blue-600 border-l-2 border-blue-600 bg-blue-100' : ''}
									`}
								onClick={() => {
									setCurrentBtmBarComponentName("EstrattoCC");
									setIsMenuOpen(false);
								}}
							>
								Estratto CC
							</button>

							{/* Allineamento CASH */}
							<button
								class={`w-full text-left px-2 py-2 text-gray-700 hover:bg-gray-100
									${currentBtmBarComponentName() === "Quadratura_CASH" ? 'text-blue-600 border-l-2 border-blue-600 bg-blue-100' : ''}
									`}
								onClick={() => {
									setCurrentBtmBarComponentName("Quadratura_CASH");
									setIsMenuOpen(false);
								}}
							>
								Allineamento CASH
							</button>

							{/* Allineamento CC */}
							<button
								class={`w-full text-left px-2 py-2 text-gray-700 hover:bg-gray-100
									${currentBtmBarComponentName() === "Quadratura_CC" ? 'text-blue-600 border-l-2 border-blue-600 bg-blue-100' : ''}
									`}
								onClick={() => {
									setCurrentBtmBarComponentName("Quadratura_CC");
									setIsMenuOpen(false);
								}}
							>
								Allineamento CC
							</button>

							{/* Budget */}
							<button
								class={`w-full text-left px-2 py-2 text-gray-700 hover:bg-gray-100
									${currentBtmBarComponentName() === "Budget" ? 'text-blue-600 border-l-2 border-blue-600 bg-blue-100' : ''}
									`}
								onClick={() => {
									setCurrentBtmBarComponentName("Budget");
									setIsMenuOpen(false);
								}}
							>
								Budget
							</button>

							<button
								class="w-full text-left px-2 py-2 text-red-600 hover:bg-gray-100 border-t"
								onClick={onLogout}
							>
								Logout
							</button>

						</div>
					</div>

					{/* Top Bar */}
					<div class="flex-none bg-blue-500 text-white h-[56px]">
						<div class="flex h-full items-center justify-between">
							<button onClick={() => setIsMenuOpen(true)} class="pl-3">
								<img src="/menu.svg" alt="Menu" class="h-10 mx-auto" />
							</button>
						</div>
					</div>

					{/* Main Content */}
					<div class="flex-grow overflow-hidden bg-gray-100">
						{renderMainContent()}
					</div>

					{/* Bottom Bar */}
					<footer class="flex-none bg-white border-t h-[92px]">
						<div class="flex h-full">
							<button
								onClick={() => setCurrentBtmBarComponentName("Chiusure")}
								class={`flex-1 text-center ${currentBtmBarComponentName() === "Chiusure" ? 'text-blue-600 border-t-2 border-blue-600' : 'border-t-2 border-transparent'}`}
							>
								<img
									src={currentBtmBarComponentName() === "Chiusure" ? "/money-arrow-down blue-600.svg" : "/money-arrow-down.svg"}
									alt="Chiusure"
									class="h-11 mx-auto mb-1"
								/>
								Chiusure
							</button>

							<button
								onClick={() => setCurrentBtmBarComponentName("Cashflow")}
								class={`flex-1 text-center ${currentBtmBarComponentName() === "Cashflow" ? 'text-blue-600 border-t-2 border-blue-600' : 'border-t-2 border-transparent'}`}
							>
								<img
									src={currentBtmBarComponentName() === "Cashflow" ? "/cash-flow-icon blue-600.svg" : "/cash-flow-icon.svg"}
									alt="Spese"
									class="h-10 mx-auto mb-2"
								/>
								Cashflow
							</button>
						</div>
					</footer>
				</>
			)}
		</div>
	);
};

export default App;
