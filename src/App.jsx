import { createSignal, onMount, createEffect } from 'solid-js';
import Chiusure from './components/Chiusure.jsx';
import Cashflow from './components/Cashflow.jsx';
import EstrattoCC from './components/EstrattoCC.jsx';
import Scadenze from './components/Scadenze.jsx';
import Quadratura_CASH from './components/Quadratura_CASH.jsx';
import Quadratura_CC from './components/Quadratura_CC.jsx';
import Statistiche from './components/Statistiche.jsx';
import Budget from './components/Budget.jsx';
import Home from './components/Home.jsx'; // <- nuovo import
import loadDataFromDB from "./lib/loadDataFromDB.js";
import composeLocalStates from "./lib/composeLocalStates.js";

const App = ({ companyId, companyName, nickName, bancaImportPDF, onLogout }) => {
	const [currentComponentName, setCurrentComponentName] = createSignal("Home");
	const [isLoading, setIsLoading] = createSignal(true);

	const [chiusure, setChiusure] = createSignal([]);
	const [cashflow, setCashflow] = createSignal([]);
	const [cash, setCash] = createSignal([]);
	const [cc, setCC] = createSignal([]);
	const [ccJson, setCCJson] = createSignal([]);
	const [scadenze, setScadenze] = createSignal([]);
	const [budget, setBudget] = createSignal([]);
	const [chiusureConSpese, setChiusureConSpese] = createSignal([]);

	const [isLandscape, setIsLandscape] = createSignal(window.innerWidth > window.innerHeight);

	const updateOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight);

	onMount(async () => {
		await loadDataFromDB(setChiusure, setCash, setCC, setCCJson, setScadenze, setBudget);
		setIsLoading(false);
	});

	createEffect(() => {
		window.addEventListener("resize", updateOrientation);
		return () => window.removeEventListener("resize", updateOrientation);
	});

	createEffect(() => {
		composeLocalStates(chiusure(), cash(), cc(), setChiusureConSpese, setCashflow);
	});

	const sharedProps = {
		companyId, companyName, nickName, bancaImportPDF, isLandscape,
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
		switch (currentComponentName()) {
			case "Home": return <Home setCurrentComponent={setCurrentComponentName} />;
			case "Chiusure": return <Chiusure {...sharedProps} />;
			case "Cashflow": return <Cashflow {...sharedProps} />;
			case "EstrattoCC": return <EstrattoCC {...sharedProps} />;
			case "Scadenze": return <Scadenze {...sharedProps} />;
			case "Quadratura_CASH": return <Quadratura_CASH {...sharedProps} />;
			case "Quadratura_CC": return <Quadratura_CC {...sharedProps} />;
			case "Statistiche": return <Statistiche {...sharedProps} />;
			case "Budget": return <Budget {...sharedProps} />;
			default: return null;
		}
	};

	return (
		<div class="flex flex-col h-screen">
			{isLoading() ? (
				<div class="flex items-center justify-center h-full">
					<p class="text-lg font-semibold">Caricamento dati in corso...</p>
				</div>
			) : (
				<>
					{/* Top Bar */}
					<div class="flex-none bg-blue-800 text-white h-[56px] flex items-center justify-between px-4">
						<button onClick={() => setCurrentComponentName("Home")}>
							<img src="/home_white.svg" alt="Home" class="h-8" />
						</button>
						<button onClick={onLogout}>
							<img src="/logout-white.svg" alt="Logout" class="h-8" />
						</button>
					</div>

					{/* Main Content */}
					<div class="flex-grow overflow-auto bg-white">
						{renderMainContent()}
					</div>
				</>
			)}
		</div>
	);
};

export default App;
