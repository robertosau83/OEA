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

	// const renderMainContentMobile = () => {
	// 	switch (currentComponentName()) {
	// 		case "Chiusure": return <Chiusure {...sharedProps} />;
	// 		case "Cashflow": return <Cashflow {...sharedProps} />;
	// 		case "EstrattoCC": return <EstrattoCC {...sharedProps} />;
	// 		case "Scadenze": return <Scadenze {...sharedProps} />;
	// 		case "Quadratura_CASH": return <Quadratura_CASH {...sharedProps} />;
	// 		case "Quadratura_CC": return <Quadratura_CC {...sharedProps} />;
	// 		case "Statistiche": return <Statistiche {...sharedProps} />;
	// 		case "Budget": return <Budget {...sharedProps} />;
	// 		default: return null;
	// 	}
	// };

	// const renderMainContent = () => {

	// 	if (isLandscape()) {
	// 		// Layout con sidebar
	// 		const modules = [
	// 			{ name: "Chiusure", label: "Chiusure", icon: "/chiusure-blue-600.svg" },
	// 			{ name: "Cashflow", label: "Cashflow", icon: "/cashflow-blue-600.svg" },
	// 			{ name: "EstrattoCC", label: "Estratto Conto", icon: "/estrattoCC-blue-600.svg" },
	// 			{ name: "Scadenze", label: "Scadenze", icon: "/scadenze-blue-600.svg" },
	// 			{ name: "Statistiche", label: "Statistiche", icon: "/statistiche-blue-600.svg" },
	// 			{ name: "Quadratura_CASH", label: "Allineamento CASH", icon: "/allineamento-blue-600.svg" },
	// 			{ name: "Quadratura_CC", label: "Allineamento CC", icon: "/allineamento-blue-600.svg" },
	// 			{ name: "Budget", label: "Budget", icon: "/budget-blue-600.svg" },
	// 		];

	// 		const SelectedComponent = {
	// 			Chiusure, Cashflow, EstrattoCC, Scadenze,
	// 			Statistiche, Quadratura_CASH, Quadratura_CC, Budget
	// 		}[currentComponentName()] || Chiusure;

	// 		return (
	// 			<>
	// 				{/* Topbar verticale con logout */}
	// 				<div class="flex-none bg-blue-800 text-white h-[56px] flex items-center justify-between px-4">
	// 					<span class="text-sm font-semibold">{nickName}</span>
	// 					<button onClick={onLogout}>
	// 						<img src="/logout-white.svg" alt="Logout" class="h-6" />
	// 					</button>
	// 				</div>
	// 				<div class="flex h-full">
	// 					{/* Sidebar sinistra */}
	// 					<div class="w-[200px] bg-blue-800 text-white flex flex-col p-2 gap-2 shadow-lg">

	// 						{/* Lista moduli */}
	// 						<div class="flex flex-col p-2 gap-2 flex-grow overflow-y-auto">
	// 							{modules.map((mod) => (
	// 								<button
	// 									class={`flex items-center gap-2 p-2 rounded-lg hover:bg-blue-700 ${currentComponentName() === mod.name ? 'bg-blue-700 font-semibold' : ''
	// 										}`}
	// 									onClick={() => setCurrentComponentName(mod.name)}
	// 								>
	// 									<img src={mod.icon} alt={mod.label} class="h-6 w-6" />
	// 									<span class="text-sm">{mod.label}</span>
	// 								</button>
	// 							))}
	// 						</div>
	// 					</div>

	// 					{/* Area contenuto */}
	// 					<div class="flex-grow overflow-auto bg-white">
	// 						<SelectedComponent {...sharedProps} />
	// 					</div>
	// 				</div>
	// 			</>
	// 		);
	// 	} else {
	// 		// Layout mobile
	// 		return (
	// 			<>
	// 				{/* Top Bar */}
	// 				<div class="flex-none bg-blue-800 text-white h-[56px] flex items-center justify-between px-4">
	// 					<button onClick={() => setCurrentComponentName("Home")}>
	// 						<img src="/home_white.svg" alt="Home" class="h-8" />
	// 					</button>
	// 					<button onClick={onLogout}>
	// 						<img src="/logout-white.svg" alt="Logout" class="h-8" />
	// 					</button>
	// 				</div>

	// 				{/* Contenuto */}
	// 				<div class="flex-grow overflow-auto bg-white">
	// 					{currentComponentName() === "Home"
	// 						? <Home setCurrentComponent={setCurrentComponentName} />
	// 						: renderMainContentMobile()
	// 					}
	// 				</div>
	// 			</>
	// 		);
	// 	}
	// };

	return (
		<div class="flex flex-col h-screen">
			{isLoading() ? (
				<div class="flex items-center justify-center h-full">
					<p class="text-lg font-semibold">Caricamento dati in corso...</p>
				</div>
			) : (
				isLandscape() ? (
					<div class="flex h-screen">
						{/* Sidebar sinistra con topbar e menu */}
						<div class="min-w-[200px] bg-blue-800 text-white flex flex-col shadow-lg">
							{/* Topbar nella sidebar */}
							<div class="h-[56px] flex flex-col justify-center px-4 border-b border-blue-700">
								<span class="text-sm font-semibold">{nickName}</span>
								<span class="text-[11px] italic text-blue-200 truncate">{companyName}</span>
							</div>

							{/* Moduli navigabili */}
							<div class="flex-grow overflow-y-auto p-2 gap-2 flex flex-col">
								{[
									{ name: "Chiusure", label: "Chiusure", icon: "/chiusure-blue-600.svg" },
									{ name: "Cashflow", label: "Cashflow", icon: "/cashflow-blue-600.svg" },
									{ name: "EstrattoCC", label: "Estratto Conto", icon: "/estrattoCC-blue-600.svg" },
									{ name: "Scadenze", label: "Scadenze", icon: "/scadenze-blue-600.svg" },
									{ name: "Statistiche", label: "Statistiche", icon: "/statistiche-blue-600.svg" },
									{ name: "Quadratura_CASH", label: "Allineamento CASH", icon: "/allineamento-blue-600.svg" },
									{ name: "Quadratura_CC", label: "Allineamento CC", icon: "/allineamento-blue-600.svg" },
									{ name: "Budget", label: "Budget", icon: "/budget-blue-600.svg" },
								].map((mod) => (
									<button
										class={`flex items-center gap-2 p-2 rounded-lg hover:bg-blue-700 ${currentComponentName() === mod.name ? 'bg-blue-700 font-semibold' : ''}`}
										onClick={() => setCurrentComponentName(mod.name)}
									>
										<img src={mod.icon} alt={mod.label} class="h-6 w-6" />
										<span class="text-sm">{mod.label}</span>
									</button>
								))}
							</div>

							{/* Logout in fondo */}
							<div class="h-[56px] flex items-center justify-center border-t border-blue-700">
								<button onClick={onLogout} class="flex gap-2 hover:opacity-80">
									<img src="/logout-white.svg" alt="Logout" class="h-6" />
									Logout
								</button>
							</div>
						</div>

						{/* Area contenuto */}
						<div class="flex-grow overflow-auto bg-white">
							{({
								Chiusure, Cashflow, EstrattoCC, Scadenze,
								Statistiche, Quadratura_CASH, Quadratura_CC, Budget
							}[currentComponentName()] || Chiusure)(sharedProps)}
						</div>
					</div>
				) : (
					<>
						{/* Top Bar mobile */}
						<div class="flex-none bg-blue-800 text-white h-[56px] flex items-center justify-between px-4">
							<button onClick={() => setCurrentComponentName("Home")}>
								<img src="/home_white.svg" alt="Home" class="h-8" />
							</button>

							{/* Titolo dinamico, solo se non siamo su Home */}
							{currentComponentName() !== "Home" && (
								<div class="text-lg font-semibold text-center flex-1">
									{({
										Chiusure: "Chiusure",
										Cashflow: "Cashflow",
										EstrattoCC: "Estratto Conto",
										Scadenze: "Scadenze",
										Statistiche: "Statistiche",
										Quadratura_CASH: "Allineamento CASH",
										Quadratura_CC: "Allineamento CC",
										Budget: "Budget"
									})[currentComponentName()] || ""}
								</div>
							)}

							<button onClick={onLogout}>
								<img src="/logout-white.svg" alt="Logout" class="h-8" />
							</button>
						</div>

						{/* Contenuto mobile */}
						<div class="flex-grow overflow-auto bg-white">
							{currentComponentName() === "Home"
								? <Home setCurrentComponent={setCurrentComponentName} />
								: ({
									Chiusure: () => <Chiusure {...sharedProps} />,
									Cashflow: () => <Cashflow {...sharedProps} />,
									EstrattoCC: () => <EstrattoCC {...sharedProps} />,
									Scadenze: () => <Scadenze {...sharedProps} />,
									Quadratura_CASH: () => <Quadratura_CASH {...sharedProps} />,
									Quadratura_CC: () => <Quadratura_CC {...sharedProps} />,
									Statistiche: () => <Statistiche {...sharedProps} />,
									Budget: () => <Budget {...sharedProps} />,
								}[currentComponentName()] || (() => null))()}
						</div>

					</>
				)
			)}
		</div>
	);


};

export default App;
