// UUID primary keys provide a unique cursor. Continue until an empty page:
// the server's row limit can be lower than the requested page size.
export async function fetchStatisticsRows(client, table, columns, signal, pageSize = 1000) {
	const rows = [];
	let cursor;
	while (true) {
		if (signal.aborted) throw signal.reason ?? new Error("Caricamento annullato");
		let query = client.from(table).select(columns).order("id", { ascending: true }).limit(pageSize);
		if (cursor) query = query.gt("id", cursor);
		const { data, error } = await query.abortSignal(signal);
		if (error) throw error;
		if (!data?.length) return rows;
		for (const row of data) {
			if (!row.id || (cursor && row.id <= cursor)) throw new Error("Paginazione statistiche non valida");
			rows.push(row);
			cursor = row.id;
		}
	}
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 * @returns {Promise<import('./types').StatisticsData>}
 */
export async function loadStatisticsData(client, { signal, timeoutMs = 45000 } = {}) {
	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	if (signal?.aborted) abort();
	signal?.addEventListener("abort", abort, { once: true });
	let timer;
	let rejectAbort;
	const cancelled = new Promise((_, reject) => {
		rejectAbort = () => reject(controller.signal.reason ?? new Error("Caricamento annullato"));
		controller.signal.addEventListener("abort", rejectAbort, { once: true });
		if (controller.signal.aborted) rejectAbort();
		timer = setTimeout(() => controller.abort(new Error("Tempo scaduto nel caricamento delle statistiche. Riprova.")), timeoutMs);
	});
	try {
		const [games, gamePlayers, scores] = await Promise.race([
			Promise.all([
				fetchStatisticsRows(client, "oea_games", "id, played_at", controller.signal),
				fetchStatisticsRows(client, "oea_game_players", "id, game_id, user_id", controller.signal),
				fetchStatisticsRows(client, "oea_scores", "id, game_id, user_id, voice_id, score", controller.signal),
			]),
			cancelled,
		]);
		return { games, gamePlayers, scores };
	} finally {
		clearTimeout(timer);
		controller.signal.removeEventListener("abort", rejectAbort);
		controller.abort();
		signal?.removeEventListener("abort", abort);
	}
}

/**
 * @param {import('./types').StatisticsInput} data
 * @returns {import('./types').StatisticsResult}
 */
export function buildStatistics({ games, gamePlayers, scores, voices, selectedPlayers }) {
	const ids = selectedPlayers.map((player) => player.id);
	const countingVoices = new Set(voices.filter((voice) => voice.counts_in_total).map((voice) => voice.id));
	const participants = new Map();
	for (const player of gamePlayers) {
		if (!participants.has(player.game_id)) participants.set(player.game_id, new Set());
		participants.get(player.game_id).add(player.user_id);
	}
	const expectedVoices = new Map();
	const playerScores = new Map();
	for (const row of scores) {
		// Ignore rows outside the participant list, rather than inventing players.
		if (!participants.get(row.game_id)?.has(row.user_id)) continue;
		const key = `${row.game_id}/${row.user_id}`;
		if (!playerScores.has(key)) playerScores.set(key, new Map());
		playerScores.get(key).set(row.voice_id, row.score);
		if (countingVoices.has(row.voice_id)) {
			if (!expectedVoices.has(row.game_id)) expectedVoices.set(row.game_id, new Set());
			expectedVoices.get(row.game_id).add(row.voice_id);
		}
	}

	const matchingGames = ids.length ? games.filter((game) => ids.every((id) => participants.get(game.id)?.has(id))) : [];
	const gameResults = [];
	for (const game of matchingGames) {
		// Use the voices actually recorded for this game, including retired voices.
		// New voices must not make older historical games appear incomplete.
		const expected = expectedVoices.get(game.id);
		if (!expected?.size) continue;
		const totals = selectedPlayers.map((player) => {
			const values = playerScores.get(`${game.id}/${player.id}`);
			let total = 0;
			for (const voiceId of expected) {
				const value = values?.get(voiceId);
				if (value === null || value === undefined) return null;
				total += Number(value);
			}
			return { userId: player.id, playerName: player.name, total };
		});
		if (totals.some((total) => total === null)) continue;
		const bestTotal = Math.max(...totals.map((item) => item.total));
		const winners = totals.filter((item) => item.total === bestTotal);
		gameResults.push({ game, totals, bestTotal, pointWinnerIds: winners.length < ids.length ? winners.map((winner) => winner.userId) : [] });
	}
	gameResults.sort((a, b) => b.game.played_at.localeCompare(a.game.played_at) || a.game.id.localeCompare(b.game.id));

	const wins = new Map(ids.map((id) => [id, 0]));
	const points = new Map(ids.map((id) => [id, 0]));
	let gamesWithPoints = 0;
	let gamesWithoutPoints = 0;
	let pointsAssigned = 0;
	let highest = [];
	let lowest = [];
	for (const result of gameResults) {
		if (ids.length >= 2) {
			if (result.pointWinnerIds.length) gamesWithPoints++;
			else gamesWithoutPoints++;
		}
		for (const id of result.pointWinnerIds) {
			wins.set(id, wins.get(id) + 1);
			pointsAssigned++;
		}
		for (const total of result.totals) {
			points.set(total.userId, points.get(total.userId) + total.total);
			const entry = { ...total, game: result.game };
			if (!highest.length || entry.total > highest[0].total) highest = [entry];
			else if (entry.total === highest[0].total) highest.push(entry);
			if (!lowest.length || entry.total < lowest[0].total) lowest = [entry];
			else if (entry.total === lowest[0].total) lowest.push(entry);
		}
	}
	const voiceRankings = voices.filter((voice) => voice.is_active).slice().sort((a, b) => a.sort_order - b.sort_order).map((voice) => {
		const rows = selectedPlayers.map((player) => ({
			player,
			total: gameResults.reduce((sum, result) => sum + Number(playerScores.get(`${result.game.id}/${player.id}`)?.get(voice.id) ?? 0), 0),
		})).sort((a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name));
		return { voice, rows: rows.map((row) => ({ ...row, rank: rows.findIndex((candidate) => candidate.total === row.total) + 1 })) };
	});
	return {
		comparedGames: gameResults.map((result) => result.game),
		gameResults,
		excludedIncompleteGames: matchingGames.length - gameResults.length,
		victoryStats: { gamesWithPoints, gamesWithoutPoints, pointsAssigned, rows: selectedPlayers.map((player) => ({ player, wins: wins.get(player.id) })) },
		totalPointsByPlayer: selectedPlayers.map((player) => ({ player, total: points.get(player.id) })),
		voiceRankings,
		records: { highest, lowest },
	};
}
