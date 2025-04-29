const Home = ({ setCurrentComponent }) => {
	const modules = [
		{ name: "Chiusure", label: "CHIUSURE", icon: "/chiusure-blue-800.svg" },
		{ name: "Cashflow", label: "CASHFLOW", icon: "/cashflow-blue-800.svg" },
		{ name: "EstrattoCC", label: "Estratto Conto", icon: "/estrattoCC-blue-600.svg" },
		{ name: "Scadenze", label: "Scadenze", icon: "/scadenze-blue-600.svg" },
		{ name: "Statistiche", label: "Statistiche", icon: "/statistiche-blue-600.svg" },
		{ name: "Quadratura_CASH", label: "Allineamento CASH", icon: "/allineamento-blue-600.svg" },
		{ name: "Quadratura_CC", label: "Allineamento CC", icon: "/allineamento-blue-600.svg" },
		{ name: "Budget", label: "Budget", icon: "/budget-blue-600.svg" },
	];

	// Separiamo i primi due bottoni dagli altri
	const topModules = modules.slice(0, 2);      // Chiusure e Cashflow
	const otherModules = modules.slice(2);        // Gli altri

	return (
		<div class="flex flex-col items-center justify-start h-full p-6 overflow-y-auto bg-blue-100">
			{/* Top big buttons */}
			<div class="grid grid-cols-2 gap-6 w-full max-w-md mb-12">
				{topModules.map((mod) => (
					<button
						class="flex flex-col items-center justify-center p-6 bg-white text-gray-600 
						       font-bold text-lg rounded-xl shadow-lg shadow-gray-500
								 border border-gray-400"
						onClick={() => setCurrentComponent(mod.name)}
					>
						<img src={mod.icon} alt={mod.label} class="h-16 w-16 mb-3" />
						<span>{mod.label}</span>
					</button>
				))}
			</div>

			{/* Divider margin */}
			{/* puoi anche mettere una linea separatrice se vuoi tipo <hr class="w-1/2 border-gray-300 mb-6" /> */}

			{/* Other small grid buttons */}
			<div class="grid grid-cols-3 gap-4 w-full max-w-3xl">
				{otherModules.map((mod) => (
					<button
						class="flex flex-col items-center justify-center p-6 bg-white text-gray-600 
						       font-bold text-lg rounded-xl shadow-md shadow-gray-400
								 border border-gray-300"
						onClick={() => setCurrentComponent(mod.name)}
					>	
						<div class="flex items-center justify-center h-12 mb-4">
							<img src={mod.icon} alt={mod.label} class="h-12 w-12" />
						</div>
						<div class="flex flex-grow items-center justify-center text-sm font-medium">

							{mod.label}
						</div>
					</button>
				))}
			</div>
		</div>
	);
};

export default Home;
