import ApexCharts from "apexcharts";
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { Accessor } from "solid-js";
import { supabase } from "../supabaseClient";
import type { OeaUser, Voice } from "./types";

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
	updateSeries: (series: number[], animate?: boolean) => Promise<void>;
	destroy: () => void;
};

const chartColors = ["#0551b5", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const pageSize = 1000;

const fetchAllRows = async <T,>(table: string, select: string, orderColumn?: string) => {
	const rows: T[] = [];

	for (let from = 0; ; from += pageSize) {
		let query = supabase
			.from(table)
			.select(select)
			.range(from, from + pageSize - 1);

		if (orderColumn) {
			query = query.order(orderColumn, { ascending: true });
		}

		const { data, error } = await query;
		if (error) throw error;

		rows.push(...((data ?? []) as T[]));
		if (!data || data.length < pageSize) break;
	}

	return rows;
};

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

	onMount(async () => {
		try {
			const [gamesData, playersData, scoresData] = await Promise.all([
				fetchAllRows<GameRow>("oea_games", "id, played_at", "played_at"),
				fetchAllRows<GamePlayerRow>("oea_game_players", "game_id, user_id"),
				fetchAllRows<ScoreRow>("oea_scores", "game_id, user_id, voice_id, score"),
			]);

			setGames(gamesData);
			setGamePlayers(playersData);
			setScores(scoresData);
		} catch (error) {
			console.error("Errore caricamento statistiche:", error);
			setLoadError("Errore durante il caricamento delle statistiche.");
		} finally {
			setLoading(false);
		}
	});

	const selectedPlayers = createMemo(() =>
		selectedPlayerIds()
			.map((id) => props.activeUsers().find((user) => user.id === id))
			.filter((user): user is OeaUser => Boolean(user))
	);

	const countsInTotalVoiceIds = createMemo(() =>
		new Set(props.voices().filter((voice) => voice.counts_in_total).map((voice) => voice.id))
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

	const comparedGames = createMemo(() => {
		const ids = selectedPlayerIds();
		if (ids.length < 2) return [];

		return games().filter((game) => {
			const participantIds = new Set(
				gamePlayers()
					.filter((player) => player.game_id === game.id)
					.map((player) => player.user_id)
			);

			return ids.every((id) => participantIds.has(id));
		});
	});

	const totalForPlayer = (gameId: string, userId: string, voiceIds: Set<string>) =>
		scores()
			.filter((score) =>
				score.game_id === gameId &&
				score.user_id === userId &&
				score.score !== null &&
				voiceIds.has(score.voice_id)
			)
			.reduce((sum, score) => sum + Number(score.score), 0);

	const gameResults = createMemo(() => {
		const ids = selectedPlayerIds();
		const voiceIds = countsInTotalVoiceIds();
		const playerById = new Map(selectedPlayers().map((player) => [player.id, player]));

		return comparedGames()
			.map((game) => {
				const totals = ids.map((userId) => ({
					userId,
					playerName: playerById.get(userId)?.name ?? "Giocatore",
					total: totalForPlayer(game.id, userId, voiceIds),
				}));
				const bestTotal = Math.max(...totals.map((item) => item.total));
				const winners = totals.filter((item) => item.total === bestTotal);

				return {
					game,
					totals,
					bestTotal,
					pointWinnerIds: winners.length < ids.length ? winners.map((winner) => winner.userId) : [],
				};
			})
			.sort((a, b) => b.game.played_at.localeCompare(a.game.played_at));
	});

	const victoryStats = createMemo(() => {
		const ids = selectedPlayerIds();
		const voiceIds = countsInTotalVoiceIds();
		const wins = new Map(ids.map((id) => [id, 0]));
		let gamesWithPoints = 0;
		let gamesWithoutPoints = 0;
		let pointsAssigned = 0;

		for (const game of comparedGames()) {
			const totals = ids.map((userId) => {
				const total = totalForPlayer(game.id, userId, voiceIds);

				return { userId, total };
			});

			const bestTotal = Math.max(...totals.map((item) => item.total));
			const winners = totals.filter((item) => item.total === bestTotal);

			if (winners.length === ids.length) {
				gamesWithoutPoints += 1;
				continue;
			}

			gamesWithPoints += 1;
			pointsAssigned += winners.length;
			for (const winner of winners) {
				wins.set(winner.userId, (wins.get(winner.userId) ?? 0) + 1);
			}
		}

		return {
			gamesWithPoints,
			gamesWithoutPoints,
			pointsAssigned,
			rows: selectedPlayers().map((player) => ({
				player,
				wins: wins.get(player.id) ?? 0,
			})),
		};
	});

	const winsByPlayer = createMemo(() => victoryStats().rows);
	const totalPointsByPlayer = createMemo(() => {
		const totals = new Map(selectedPlayerIds().map((id) => [id, 0]));

		for (const result of gameResults()) {
			for (const total of result.totals) {
				totals.set(total.userId, (totals.get(total.userId) ?? 0) + total.total);
			}
		}

		return selectedPlayers().map((player) => ({
			player,
			total: totals.get(player.id) ?? 0,
		}));
	});

	const voiceRankings = createMemo(() => {
		const gameIds = new Set(comparedGames().map((game) => game.id));

		return props.voices()
			.filter((voice) => voice.is_active)
			.slice()
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((voice) => {
				const rows = selectedPlayers()
					.map((player) => ({
						player,
						total: scores()
							.filter((score) =>
								gameIds.has(score.game_id)
								&& score.user_id === player.id
								&& score.voice_id === voice.id
								&& score.score !== null
							)
							.reduce((sum, score) => sum + Number(score.score), 0),
					}))
					.sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name));

				return {
					voice,
					rows: rows.map((row) => ({
						...row,
						rank: rows.findIndex((candidate) => candidate.total === row.total) + 1,
					})),
				};
			});
	});

	const chartRows = createMemo(() => winsByPlayer().filter((row) => row.wins > 0));
	const chartSeries = createMemo(() => chartRows().length > 0 ? chartRows().map((row) => row.wins) : [1]);
	const chartLabels = createMemo(() => chartRows().length > 0 ? chartRows().map((row) => row.player.name) : ["Nessun dato"]);
	const totalPointsChartRows = createMemo(() => totalPointsByPlayer().filter((row) => row.total > 0));
	const totalPointsChartSeries = createMemo(() => totalPointsChartRows().length > 0 ? totalPointsChartRows().map((row) => row.total) : [1]);
	const totalPointsChartLabels = createMemo(() => totalPointsChartRows().length > 0 ? totalPointsChartRows().map((row) => row.player.name) : ["Nessun dato"]);

	const buildPieOptions = (
		labels: string[],
		series: number[],
		hasData: boolean,
		tooltipSuffix: string
	) => ({
			chart: {
				type: "pie",
				height: "100%",
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
					return `${label}: ${value}`;
				},
			},
			tooltip: {
				enabled: hasData,
				y: { formatter: (value: number) => `${value} ${tooltipSuffix}` },
			},
			stroke: { show: true, width: 2, colors: ["#fff"] },
			colors: hasData ? chartColors : ["#e5e7eb"],
			states: { active: { filter: { type: "none" } } },
		});

	const chartOptions = createMemo(() =>
		buildPieOptions(chartLabels(), chartSeries(), chartRows().length > 0, "punti vittoria")
	);
	const totalPointsChartOptions = createMemo(() =>
		buildPieOptions(totalPointsChartLabels(), totalPointsChartSeries(), totalPointsChartRows().length > 0, "punti")
	);

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
		winsChart?.destroy();
		winsChart = undefined;
		totalPointsChart?.destroy();
		totalPointsChart = undefined;
	});

	return (
		<section class="mx-auto max-w-6xl space-y-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 class="text-lg font-bold text-gray-900">Statistiche</h2>
						<p class="text-xs text-gray-500">
							{comparedGames().length} partite confrontate, {victoryStats().pointsAssigned} punti vittoria, {victoryStats().gamesWithoutPoints} senza vincitori
						</p>
					</div>
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
								onClick={() => togglePlayer(user.id)}
							>
								{user.name}
							</button>
						)}
					</For>
				</div>
				<Show when={selectedPlayers().length < 2}>
					<p class="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
						Seleziona almeno due giocatori per confrontare i punti vittoria.
					</p>
				</Show>
			</div>

			<Show when={!loading()} fallback={<div class="rounded-lg border border-gray-200 bg-white p-4 text-gray-500 shadow-sm">Caricamento statistiche...</div>}>
				<Show when={!loadError()} fallback={<div class="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-600">{loadError()}</div>}>
					<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<div class="mb-3 flex items-center justify-between gap-3">
								<h3 class="text-base font-semibold text-gray-900">Punti vittoria</h3>
								<span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
									{selectedPlayers().length} giocatori
								</span>
							</div>
							<div class="h-[360px]" ref={(el) => { winsChartEl = el; }} />
						</div>

						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<h3 class="mb-1 text-base font-semibold text-gray-900">Classifica</h3>
							<p class="mb-3 text-xs text-gray-500">Primo posto condiviso valido se batte almeno un altro giocatore.</p>
							<div class="space-y-2">
								<For each={winsByPlayer().slice().sort((a, b) => b.wins - a.wins)}>
									{(row) => (
										<div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 text-sm">
											<span class="min-w-0 truncate font-medium text-gray-700">{row.player.name}</span>
											<span class="shrink-0 font-bold text-gray-900">{row.wins}</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</div>

					<div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<div class="mb-3 flex items-center justify-between gap-3">
								<h3 class="text-base font-semibold text-gray-900">Punti totali</h3>
								<span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
									{comparedGames().length} partite
								</span>
							</div>
							<div class="h-[360px]" ref={(el) => { totalPointsChartEl = el; }} />
						</div>

						<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
							<h3 class="mb-1 text-base font-semibold text-gray-900">Classifica punti</h3>
							<p class="mb-3 text-xs text-gray-500">Somma dei punti nelle partite del campione filtrato.</p>
							<div class="space-y-2">
								<For each={totalPointsByPlayer().slice().sort((a, b) => b.total - a.total)}>
									{(row) => (
										<div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 text-sm">
											<span class="min-w-0 truncate font-medium text-gray-700">{row.player.name}</span>
											<span class="shrink-0 font-bold text-gray-900">{row.total}</span>
										</div>
									)}
								</For>
							</div>
						</div>
					</div>

					<div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
														{row.rank}
													</span>
													<span class={`min-w-0 flex-1 truncate ${
														row.rank === 1 ? "font-bold text-gray-900" : "font-medium text-gray-700"
													}`}>
														{row.player.name}
													</span>
													<span class={`shrink-0 ${
														row.rank === 1 ? "font-bold text-[#0551b5]" : "font-bold text-gray-900"
													}`}>
														{row.total}
													</span>
												</div>
											)}
										</For>
									</div>
								</div>
							)}
						</For>
					</div>
				</Show>
			</Show>
		</section>
	);
}
