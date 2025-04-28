const Home = ({ setCurrentComponent }) => {
	const modules = [
		{ name: "Chiusure", label: "Chiusure" },
		{ name: "Cashflow", label: "Cashflow" },
		{ name: "EstrattoCC", label: "Estratto Conto" },
		{ name: "Scadenze", label: "Scadenze" },
		{ name: "Quadratura_CASH", label: "Allineamento CASH" },
		{ name: "Quadratura_CC", label: "Allineamento CC" },
		{ name: "Statistiche", label: "Statistiche" },
		{ name: "Budget", label: "Budget" },
	];

	return (
		<div class="flex flex-col items-center justify-center h-full p-6 gap-4">
			<h1 class="text-2xl font-bold mb-8">Seleziona una sezione</h1>
			{modules.map((mod) => (
				<button
					class="w-full max-w-xs px-6 py-4 bg-blue-500 text-white font-semibold rounded-lg shadow hover:bg-blue-600"
					onClick={() => setCurrentComponent(mod.name)}
				>
					{mod.label}
				</button>
			))}
		</div>
	);
};

export default Home;
