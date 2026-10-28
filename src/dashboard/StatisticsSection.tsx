import ApexCharts from "apexcharts";
import { For, Show, batch, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { A } from "@solidjs/router";
import type { Accessor } from "solid-js";
import { supabase } from "../supabaseClient";
import type { OeaUser, Voice } from "./types";
import { buildStatistics, loadStatisticsData } from "./statistics";

interface StatisticsSectionProps {
	activeUsers: Accessor<OeaUser[]>;
	voices: Accessor<Voice[]>;
}

interface GameRow {
	id: string;
	played_at: string;
}

interface GamePlayerRow {
	game_id: string;
	user_id: string;
}

interface ScoreRow {
	game_id: string;
	user_id: string;
	voice_id: string;
	score: number | null;
}

type ApexChart = ApexCharts & {
	updateOptions: (options: Record<string, unknown>, redrawPaths?: boolean, animate?: boolean) => Promise<void>;
	updateSeries: (series: number[] | { name: string; data: number[] }[], animate?: boolean) => Promise<void>;
	destroy: () => void;
};

const chartColors = ["#0551b5", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const numberFormatter = new Intl.NumberFormat("it-IT", { useGrouping: "always" });
const formatNumber = (value: number) => numberFormatter.format(value);

const formatGameDate = (value: string) => value.split("-").reverse().join("/");

export default function StatisticsSection(props: StatisticsSectionProps) {
	const [selectedPlayerIds, setSelectedPlayerIds] = createSignal<string[]>([]);
	const [filterInitialized, setFilterInitialized] = createSignal(false);
	const [games, setGames] = createSignal<GameRow[]>([]);
	const [gamePlayers, setGamePlayers] = createSignal<GamePlayerRow[]>([]);
	const [scores, setScores] = createSignal<ScoreRow[]>([]);
	const [loading, setLoading] = createSignal(true);
	const [loadError, setLoadError] = createSignal("");

	let winsChartEl: HTMLDivElement | undefined;
	let winsChart: ApexChart | undefined;
	let totalPointsChartEl: HTMLDivElement | undefined;
	let totalPointsChart: ApexChart | undefined;
	let loadController: AbortController | undefined;
	let disposed = false;

	const destroyCharts = () => {
		winsChart?.destroy();
		winsChart = undefined;
		totalPointsChart?.destroy();
		totalPointsChart = undefined;
		winsChartEl = undefined;
		totalPointsChartEl = undefined;
	};

	createEffect(() => {
		const availableIds = props.activeUsers().map((user) => user.id);
		if (availableIds.length === 0) return;

		if (!filterInitialized()) {
			setSelectedPlayerIds(availableIds);
			setFilterInitialized(true);
			return;
		}

		setSelectedPlayerIds((current) => {
			const valid = current.filter((id) => availableIds.includes(id));
			return valid.length === current.length ? current : valid;
		});
	});

	const loadData = async () => {
		loadController?.abort();
		const controller = new AbortController();
		loadController = controller;
		destroyCharts();
		setLoading(true);
		setLoadError("");
		try {
			const data = await loadStatisticsData(supabase, { signal: controller.signal });
			if (disposed || controller.signal.aborted) return;
			batch(() => {
				setGames(data.games);
				setGamePlayers(data.gamePlayers);
				setScores(data.scores);
			});
		} catch (error) {
			if (disposed || controller.signal.aborted) return;
			console.error("Errore caricamento statistiche:", error);
			setLoadError("Non e' stato possibile caricare tutte le statistiche. Controlla la connessione e premi Aggiorna.");
		} finally {
			if (!disposed && loadController === controller) setLoading(false);
		}
	};
	onMount(() => { void loadData(); });

	const selectedPlayers = createMemo(() =>
		selectedPlayerIds()
			.map((id) => props.activeUsers().find((user) => user.id === id))
			.filter((user): user is OeaUser => Boolean(user))
	);

	const togglePlayer = (userId: string) => {
		setSelectedPlayerIds((current) =>
			current.includes(userId)
				? current.filter((id) => id !== userId)
				: [...current, userId]
		);
	};

	const selectAllPlayers = () => {
		setSelectedPlayerIds(props.activeUsers().map((user) => user.id));
	};

	const statistics = createMemo(() => buildStatistics({
		games: games(), gamePlayers: gamePlayers(), scores: scores(),
		voices: props.voices(), selectedPlayers: selectedPlayers(),
	}));
	const comparedGames = () => statistics().comparedGames;
	const victoryStats = () => statistics().victoryStats;
	const winsByPlayer = () => victoryStats().rows;
	const totalPointsByPlayer = () => statistics().totalPointsByPlayer;
	const voiceRankings = () => statistics().voiceRankings;
	const recordCards = createMemo(() => [
		{ title: "Punteggio più alto", entries: statistics().records.highest },
		{ title: "Punteggio più basso", entries: statistics().records.lowest },
	]);

	const chartRows = createMemo(() => winsByPlayer().filter((row) => row.wins > 0));
	const chartSeries = createMemo(() => chartRows().length > 0 ? chartRows().map((row) => row.wins) : [1]);
	const chartLabels = createMemo(() => chartRows().length > 0 ? chartRows().map((row) => row.player.name) : ["Nessun dato"]);
	const totalPointsChartSeries = createMemo(() => [{ name: "Punti", data: comparedGames().length ? totalPointsByPlayer().map((row) => row.total) : [] }]);

	const buildPieOptions = (
		labels: string[],
		series: number[],
		hasData: boolean,
		tooltipSuffix: string
	) => ({
			chart: {
				type: "pie",
				height: 360,
				parentHeightOffset: 0,
				width: "100%",
				animations: { enabled: false },
				toolbar: { show: false },
			},
			labels,
			series,
			legend: { show: false },
			dataLabels: {
				enabled: hasData,
				formatter: (_value: number, options: { seriesIndex: number; w: { config: { labels: string[]; series: number[] } } }) => {
					const label = options.w.config.labels[options.seriesIndex];
					const value = options.w.config.series[options.seriesIndex];
					return `${label}: ${formatNumber(value)}`;
				},
			},
			tooltip: {
				enabled: hasData,
				y: { formatter: (value: number) => `${formatNumber(value)} ${tooltipSuffix}` },
			},
			stroke: { show: true, width: 2, colors: ["#fff"] },
			colors: hasData ? chartColors : ["#e5e7eb"],
			states: { active: { filter: { type: "none" } } },
			responsive: [{ breakpoint: 639, options: {
				chart: { height: 280 },
				legend: { show: true, position: "bottom", fontSize: "11px" },
				dataLabels: {
					style: { fontSize: "11px" },
					formatter: (_value: number, options: { seriesIndex: number; w: { config: { series: number[] } } }) => formatNumber(options.w.config.series[options.seriesIndex]),
				},
			} }],
		});

	const chartOptions = createMemo(() =>
		buildPieOptions(chartLabels(), chartSeries(), chartRows().length > 0, "punti vittoria")
	);
	const totalPointsChartOptions = createMemo(() => ({
		chart: { type: "bar", height: 360, parentHeightOffset: 0, width: "100%", animations: { enabled: false }, toolbar: { show: false } },
		series: totalPointsChartSeries(),
		plotOptions: { bar: { horizontal: true, distributed: true, borderRadius: 4 } },
		xaxis: { categories: totalPointsByPlayer().map((row) => row.player.name), labels: { formatter: (value: string) => formatNumber(Number(value)) } },
		dataLabels: { enabled: true, formatter: (value: number) => formatNumber(value) },
		tooltip: { y: { formatter: (value: number) => `${formatNumber(value)} punti` } },
		noData: { text: "Nessun dato" },
		legend: { show: false },
		colors: chartColors,
		responsive: [{ breakpoint: 639, options: { chart: { height: 280 }, xaxis: { tickAmount: 3 }, dataLabels: { style: { fontSize: "11px" } } } }],
	}));

	createEffect(() => {
		if (loading() || loadError() || !winsChartEl) return;

		const options = chartOptions();
		if (winsChart) {
			void winsChart.updateOptions(options, false, false);
			void winsChart.updateSeries(chartSeries(), false);
			return;
		}

		winsChart = new ApexCharts(winsChartEl, options) as ApexChart;
		void winsChart.render();
	});

	createEffect(() => {
		if (loading() || loadError() || !totalPointsChartEl) return;

		const options = totalPointsChartOptions();
		if (totalPointsChart) {
			void totalPointsChart.updateOptions(options, false, false);
			void totalPointsChart.updateSeries(totalPointsChartSeries(), false);
			return;
		}

		totalPointsChart = new ApexCharts(totalPointsChartEl, options) as ApexChart;
		void totalPointsChart.render();
	});

	onCleanup(() => {
		disposed = true;
		loadController?.abort();
		destroyCharts();
	});

	return (
		<section class="mx-auto max-w-6xl space-y-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<div class="mb-3 flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h2 class="text-lg font-bold text-gray-900">Statistiche</h2>
						<p class="text-xs text-gray-500">
							{formatNumber(comparedGames().length)} partite confrontate, {formatNumber(victoryStats().pointsAssigned)} punti vittoria, {formatNumber(victoryStats().gamesWithoutPoints)} senza vincitori
						</p>
					</div>
					<button type="button" class="h-11 shrink-0 rounded-full bg-blue-50 px-3 text-sm font-semibold text-[#0551b5] disabled:opacity-60" disabled={loading()} onClick={() => { void loadData(); }}>
						{loading() ? "Caricamento..." : "Aggiorna"}
					</button>
				</div>

				<div class="flex flex-wrap gap-2">
					<button
						class="rounded-full border border-gray-300 bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700"
						onClick={selectAllPlayers}
					>
						Tutti
					</button>
					<For each={props.activeUsers()}>
						{(user) => (
							<button
								class={`rounded-full border px-3 py-2 text-sm font-semibold ${
									selectedPlayerIds().includes(user.id)
										? "border-[#0551b5] bg-blue-50 text-[#0551b5]"
										: "border-gray-200 bg-white text-gray-600"
								}`}
								aria-pressed={selectedPlayerIds().includes(user.id)}
								onClick={() => togglePlayer(user.id)}
							>
								{user.name}
							</button>
						)}
					</For>
				</div>
				<p class="mt-3 text-xs text-gray-500">Il campione include le partite con tutti i giocatori selezionati. Punti vittoria calcolati tra i selezionati.</p>
				<Show when={!loading() && !loadError() && statistics().excludedIncompleteGames > 0}>
					<p class="mt-2 text-xs text-gray-500">{formatNumber(statistics().excludedIncompleteGames)} partite escluse perché hanno punteggi da completare.</p>
				</Show>
				<Show when={selectedPlayers().length < 2}>
					<p class="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
						Seleziona almeno due giocatori per confrontare i punti vittoria.
					</p>
				</Show>
			</div>

			<Show when={!loading()} fallback={<div class="rounded-lg border border-gray-200 bg-white p-4 text-gray-500 shadow-sm">Caricamento statistiche...</div>}>
				<Show when={!loadError()} fallback={<div class="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">{loadError()}</div>}>
					<Show when={comparedGames().length === 0}>
						<p role="status" class="mb-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-gray-600">Nessuna partita con punteggi compilati per questo filtro. Prova a selezionare altri giocatori.</p>
					</Show>
					<div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
						<div class="min-w-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<div class="mb-3 flex items-center justify-between gap-3">
								<h3 class="text-base font-semibold text-gray-900">Punti vittoria</h3>
								<span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
									{formatNumber(selectedPlayers().length)} giocatori
								</span>
							</div>
							<div class="h-[280px] min-w-0 sm:h-[360px]" ref={(el) => { winsChartEl = el; }} />
						</div>

						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<h3 class="mb-1 text-base font-semibold text-gray-900">Classifica</h3>
							<p class="mb-3 text-xs text-gray-500">Primo posto condiviso valido se batte almeno un altro giocatore.</p>
							<div class="space-y-2">
								<For each={winsByPlayer().slice().sort((a, b) => b.wins - a.wins)}>
									{(row) => (
										<div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 text-sm">
											<span class="min-w-0 truncate font-medium text-gray-700">{row.player.name}</span>
											<span class="shrink-0 font-bold text-gray-900">{formatNumber(row.wins)}</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</div>

					<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
						<div class="min-w-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<div class="mb-3 flex items-center justify-between gap-3">
								<h3 class="text-base font-semibold text-gray-900">Punti totali</h3>
								<span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
									{formatNumber(comparedGames().length)} partite
								</span>
							</div>
							<div class="h-[280px] min-w-0 sm:h-[360px]" ref={(el) => { totalPointsChartEl = el; }} />
						</div>

						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<h3 class="mb-1 text-base font-semibold text-gray-900">Classifica punti</h3>
							<p class="mb-3 text-xs text-gray-500">Somma dei punti nelle partite del campione filtrato.</p>
							<div class="space-y-2">
								<For each={totalPointsByPlayer().slice().sort((a, b) => b.total - a.total)}>
									{(row) => (
										<div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 text-sm">
											<span class="min-w-0 truncate font-medium text-gray-700">{row.player.name}</span>
											<span class="shrink-0 font-bold text-gray-900">{formatNumber(row.total)}</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</div>

					<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
						<For each={voiceRankings()}>
							{(ranking) => (
								<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
									<h3 class="text-base font-semibold text-gray-900">Re del {ranking.voice.name}</h3>
									<p class="mb-3 mt-1 text-xs text-gray-500">Somma dei punteggi sulla singola voce.</p>
									<div class="space-y-2">
										<For each={ranking.rows} fallback={<p class="text-sm text-gray-500">Nessun giocatore selezionato.</p>}>
											{(row) => (
												<div class="flex items-center gap-3 border-b border-gray-100 pb-2 text-sm last:border-b-0 last:pb-0">
													<span class={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
														row.rank === 1 ? "bg-blue-100 text-[#0551b5]" : "bg-gray-100 text-gray-600"
													}`}>
														{formatNumber(row.rank)}
													</span>
													<span class={`min-w-0 flex-1 truncate ${
														row.rank === 1 ? "font-bold text-gray-900" : "font-medium text-gray-700"
													}`}>
														{row.player.name}
													</span>
													<span class={`shrink-0 ${
														row.rank === 1 ? "font-bold text-[#0551b5]" : "font-bold text-gray-900"
													}`}>
														{formatNumber(row.total)}
													</span>
												</div>
											)}
										</For>
									</div>
								</div>
							)}
						</For>
					</div>
					<section class="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm" aria-label="Record partita">
						<h3 class="text-base font-semibold text-gray-900">Record partita</h3>
						<p class="mb-4 mt-1 text-xs text-gray-500">Punteggi individuali nelle partite del campione filtrato. Sono mostrate tutte le parità.</p>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<For each={recordCards()}>
								{(record) => (
									<div class="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
										<h4 class="text-sm font-semibold text-gray-600">{record.title}</h4>
										<Show when={record.entries.length > 0} fallback={<p class="mt-3 text-sm text-gray-500">Nessuna partita con punteggi compilati.</p>}>
											<p class="my-2 text-3xl font-bold text-[#0551b5]">{formatNumber(record.entries[0]?.total ?? 0)} <span class="text-sm font-medium">punti</span></p>
											<div class="space-y-2">
												<For each={record.entries}>
													{(entry) => (
														<A href={`/app/games/${entry.game.id}`} class="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-2 text-sm hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0551b5]" aria-label={`Apri partita di ${entry.playerName} del ${formatGameDate(entry.game.played_at)}`}>
															<span class="font-semibold text-gray-900">{entry.playerName}</span>
															<span class="text-gray-600">{formatGameDate(entry.game.played_at)} <span aria-hidden="true">↗</span></span>
														</A>
													)}
												</For>
											</div>
										</Show>
									</div>
								)}
							</For>
						</div>
					</section>
				</Show>
			</Show>
		</section>
	);
}
