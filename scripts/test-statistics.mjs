import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { buildStatistics, fetchStatisticsRows, loadStatisticsData } from '../src/dashboard/statistics.js';

function fixture() {
	const data = {
		games: [], gamePlayers: [], scores: [],
		voices: [
			{ id: 'main', name: 'Principale', counts_in_total: true, is_active: true, sort_order: 1 },
			{ id: 'extra', name: 'Secondario', counts_in_total: true, is_active: true, sort_order: 2 },
			{ id: 'info', name: 'Informazione', counts_in_total: false, is_active: true, sort_order: 3 },
		],
		selectedPlayers: [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Bruno' }, { id: 'c', name: 'Carlo' }],
	};
	const add = (id, date, values) => {
		data.games.push({ id, played_at: date });
		for (const [user_id, score] of Object.entries(values)) {
			data.gamePlayers.push({ game_id: id, user_id });
			for (const [voice_id, value] of [['main', score], ['extra', 0], ['info', 999]]) {
				data.scores.push({ game_id: id, user_id, voice_id, score: value });
			}
		}
	};
	return { data, add };
}

test('totals, shared wins, records and dates use the same scores', () => {
	const { data, add } = fixture();
	add('g1', '2026-01-01', { a: 10, b: 5, c: 2 });
	add('g2', '2026-02-01', { a: 30, b: 30, c: 10 });
	const result = buildStatistics(data);
	assert.deepEqual(result.totalPointsByPlayer.map((row) => row.total), [40, 35, 12]);
	assert.deepEqual(result.victoryStats.rows.map((row) => row.wins), [2, 1, 0]);
	assert.equal(result.victoryStats.pointsAssigned, 3);
	assert.deepEqual(result.records.highest.map((row) => [row.playerName, row.total, row.game.played_at]), [
		['Anna', 30, '2026-02-01'], ['Bruno', 30, '2026-02-01'],
	]);
	assert.equal(result.records.lowest[0].playerName, 'Carlo');
	assert.equal(result.records.lowest[0].total, 2);
	assert.deepEqual(result.voiceRankings[0].rows.map((row) => row.total), [40, 35, 12]);
	assert.deepEqual(result.voiceRankings[2].rows.map((row) => row.total), [1998, 1998, 1998]);
});
test('all-player ties award no victory points, zero remains a real record', () => {
	const { data, add } = fixture();
	add('g1', '2026-01-01', { a: 0, b: 0, c: 0 });
	const result = buildStatistics(data);
	assert.equal(result.victoryStats.pointsAssigned, 0);
	assert.equal(result.victoryStats.gamesWithoutPoints, 1);
	assert.equal(result.records.lowest.length, 3);
	assert.equal(result.records.highest[0].total, 0);
});
test('negative totals and penalties are preserved', () => {
	const { data, add } = fixture();
	add('g1', '2026-01-01', { a: -10, b: -5, c: -20 });
	const result = buildStatistics(data);
	assert.equal(result.records.highest[0].total, -5);
	assert.equal(result.records.lowest[0].total, -20);
	assert.deepEqual(result.totalPointsByPlayer.map((row) => row.total), [-10, -5, -20]);
});
test('filters require all selected participants, and support one-player records', () => {
	const { data, add } = fixture();
	add('g1', '2026-01-01', { a: 10, b: 5, c: 2 });
	add('g2', '2026-02-01', { a: 99, b: 20 });
	assert.equal(buildStatistics(data).comparedGames.length, 1);
	data.selectedPlayers = data.selectedPlayers.slice(0, 1);
	const solo = buildStatistics(data);
	assert.equal(solo.comparedGames.length, 2);
	assert.equal(solo.records.highest[0].total, 99);
	assert.equal(solo.victoryStats.pointsAssigned, 0);
	assert.equal(solo.victoryStats.gamesWithoutPoints, 0);
	data.selectedPlayers = [];
	const empty = buildStatistics(data);
	assert.equal(empty.comparedGames.length, 0);
	assert.deepEqual(empty.records, { highest: [], lowest: [] });
});
test('null scores, missing rows and blank games never become lowest records', () => {
	const { data, add } = fixture();
	add('good', '2026-01-01', { a: 10, b: 5, c: 2 });
	add('blank', '2026-02-01', { a: null, b: null, c: null });
	add('partial', '2026-03-01', { a: 1, b: null, c: 1 });
	add('missing', '2026-04-01', { a: 1, b: 1, c: 1 });
	data.scores = data.scores.filter((row) => !(row.game_id === 'missing' && row.user_id === 'b' && row.voice_id === 'main'));
	const result = buildStatistics(data);
	assert.equal(result.excludedIncompleteGames, 3);
	assert.deepEqual(result.comparedGames.map((game) => game.id), ['good']);
	assert.equal(result.records.lowest[0].total, 2);
});
test('null non-counting scores do not make totals incomplete', () => {
	const { data, add } = fixture();
	add('g1', '2026-01-01', { a: 10, b: 5, c: 2 });
	data.scores.filter((row) => row.voice_id === 'info').forEach((row) => { row.score = null; });
	assert.equal(buildStatistics(data).comparedGames.length, 1);
});
test('retired voices still count historically, newly added voices do not invalidate old games', () => {
	const { data, add } = fixture();
	add('g1', '2026-01-01', { a: 10, b: 5, c: 2 });
	data.voices[0].is_active = false;
	data.voices.push({ id: 'new', counts_in_total: true, is_active: true, sort_order: 4 });
	const result = buildStatistics(data);
	assert.equal(result.records.highest[0].total, 10);
	assert.equal(result.comparedGames.length, 1);
	assert.ok(result.voiceRankings.every((ranking) => ranking.voice.id !== 'main'));
});
test('same-date games remain distinct and equal records retain all dates', () => {
	const { data, add } = fixture();
	add('g2', '2026-01-01', { a: 10, b: 5, c: 2 });
	add('g1', '2026-01-01', { a: 10, b: 5, c: 2 });
	const result = buildStatistics(data);
	assert.equal(result.comparedGames.length, 2);
	assert.deepEqual(result.records.highest.map((row) => row.game.id), ['g1', 'g2']);
});

// Exercise the installed SDK, including URL filters, sort order, and abortSignal.
function mockServer(tables, { cap = 1000, failTable, hang = false } = {}) {
	const requests = [];
	const client = createClient('https://example.supabase.co', 'test-key', {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
		global: { fetch: async (input, init) => {
			const url = new URL(input);
			const table = url.pathname.split('/').at(-1);
			requests.push({ table, signal: init.signal, cursor: url.searchParams.get('id') });
			if (hang) return new Promise(() => {});
			if (table === failTable) return new Response(JSON.stringify({ message: 'denied', code: '42501' }), { status: 403 });
			assert.equal(url.searchParams.get('order'), 'id.asc');
			const cursor = url.searchParams.get('id')?.replace(/^gt\./, '');
			const data = (tables[table] ?? []).slice().sort((a, b) => a.id.localeCompare(b.id))
				.filter((row) => !cursor || row.id > cursor)
				.slice(0, Math.min(cap, Number(url.searchParams.get('limit'))));
			return new Response(JSON.stringify(data), { status: 200 });
		} },
	});
	return { client, requests };
}
test('keyset pagination loads over 1000 rows even if server returns shorter pages', async () => {
	const table = Array.from({ length: 2123 }, (_, i) => ({ id: String(i).padStart(5, '0'), score: i }));
	const { client, requests } = mockServer({ oea_scores: table }, { cap: 137 });
	const data = await fetchStatisticsRows(client, 'oea_scores', 'id, score', new AbortController().signal);
	assert.deepEqual(data, table);
	assert.equal(new Set(data.map((row) => row.id)).size, 2123);
	assert.ok(requests.length > 15);
});
test('loading all three tables fails completely on a permission error', async () => {
	const { client } = mockServer({}, { failTable: 'oea_scores' });
	await assert.rejects(loadStatisticsData(client), { code: '42501' });
});
test('deadline terminates a hung SDK operation and aborts requests', async () => {
	const { client, requests } = mockServer({}, { hang: true });
	await assert.rejects(loadStatisticsData(client, { timeoutMs: 20 }), /Tempo scaduto/);
	assert.ok(requests.every((request) => request.signal.aborted));
});
test('leaving statistics cancels all loading', async () => {
	const { client } = mockServer({}, { hang: true });
	const controller = new AbortController();
	const loading = loadStatisticsData(client, { signal: controller.signal });
	controller.abort(new Error('left statistics'));
	await assert.rejects(loading, /left statistics/);
});

const snapshotFile = '.codex/statistics-verification.json';
test('real database snapshot: all pages and independent SQL totals agree', { skip: !existsSync(snapshotFile) && 'Local read-only database snapshot is unavailable' }, async () => {
	const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8').replace(/^\uFEFF/, '')).rows[0].snapshot;
	const { client } = mockServer({ oea_games: snapshot.games, oea_game_players: snapshot.gamePlayers, oea_scores: snapshot.scores }, { cap: 750 });
	const loaded = await loadStatisticsData(client);
	assert.equal(loaded.scores.length, snapshot.scores.length);
	assert.equal(loaded.games.length, snapshot.games.length);
	assert.equal(loaded.gamePlayers.length, snapshot.gamePlayers.length);
	const selectedPlayers = snapshot.users.filter((user) => user.status === 'ACTIVE');
	const result = buildStatistics({ ...loaded, voices: snapshot.voices, selectedPlayers });
	assert.equal(result.excludedIncompleteGames, 0);
	assert.deepEqual(result.comparedGames.map((game) => game.id).sort(), snapshot.expected.comparedGameIds);
	for (const sql of snapshot.expected.totals) {
		const actual = result.gameResults.find((row) => row.game.id === sql.game_id).totals.find((row) => row.userId === sql.user_id);
		assert.equal(actual.total, Number(sql.total));
	}
	const highest = Math.max(...snapshot.expected.totals.map((row) => Number(row.total)));
	const lowest = Math.min(...snapshot.expected.totals.map((row) => Number(row.total)));
	assert.equal(result.records.highest[0].total, highest);
	assert.equal(result.records.lowest[0].total, lowest);
	console.log('Database verificato:', {
		games: loaded.games.length, scores: loaded.scores.length, compared: result.comparedGames.length,
		highest: result.records.highest.map((row) => ({ name: row.playerName, score: row.total, date: row.game.played_at })),
		lowest: result.records.lowest.map((row) => ({ name: row.playerName, score: row.total, date: row.game.played_at })),
	});
});
