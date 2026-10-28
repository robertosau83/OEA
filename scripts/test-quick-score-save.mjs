import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { isValidQuickScoreInput, saveQuickScoreRows } from '../src/dashboard/quickScoreSave.js';

const rows = [{ game_id: 'game', user_id: 'player', voice_id: 'voice', score: 23 }];
const options = { timeoutMs: 100, retryDelayMs: 0 };
function fixture(responses, refresh = async () => ({ data: { session: {} }, error: null })) {
	const calls = [];
	const client = {
		from(table) {
			assert.equal(table, 'oea_scores');
			return { upsert(payload, config) {
				assert.equal(config.onConflict, 'game_id,user_id,voice_id');
				assert.deepEqual(payload, rows);
				return { abortSignal(signal) {
					calls.push(signal);
					const response = responses.shift();
					return typeof response === 'function' ? response(signal) : response;
				} };
			} };
		},
		auth: { refreshSession: refresh },
	};
	return { client, calls };
}
const ok = { error: null, status: 201 };
const fail = (status) => ({ error: { code: 'test', message: 'simulated failure' }, status });

test('quick input waits for preceding table edits before sending', async () => {
	let finishPrevious;
	const pendingWrites = new Promise((resolve) => { finishPrevious = resolve; });
	const { client, calls } = fixture([ok]);
	const saving = saveQuickScoreRows(client, rows, { ...options, pendingWrites });
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(calls.length, 0);
	finishPrevious();
	await saving;
	assert.equal(calls.length, 1);
});
test('stalled preceding edit blocks quick upsert and preserves input', async () => {
	const { client, calls } = fixture([]);
	await assert.rejects(saveQuickScoreRows(client, rows, {
		...options, timeoutMs: 10, pendingWrites: new Promise(() => {}),
	}), { kind: 'pending' });
	assert.equal(calls.length, 0);
});

test('success sends a single bulk upsert', async () => {
	const { client, calls } = fixture([ok]);
	await saveQuickScoreRows(client, rows, options);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].aborted, false);
});
for (const status of [0, 408, 429, 500, 502, 503, 504]) {
	test(`temporary failure ${status} retries the same payload`, async () => {
		const { client, calls } = fixture([fail(status), ok]);
		await saveQuickScoreRows(client, rows, options);
		assert.equal(calls.length, 2);
	});
}
for (const status of [400, 403, 409]) {
	test(`permanent failure ${status} is not retried`, async () => {
		const { client, calls } = fixture([fail(status)]);
		await assert.rejects(saveQuickScoreRows(client, rows, options), { kind: 'database' });
		assert.equal(calls.length, 1);
	});
}
test('two network failures terminate with an actionable error', async () => {
	const { client, calls } = fixture([fail(0), fail(0)]);
	await assert.rejects(saveQuickScoreRows(client, rows, options), { kind: 'network' });
	assert.equal(calls.length, 2);
});
test('hung SDK/auth wait terminates even if abort is ignored', async () => {
	const { client, calls } = fixture([() => new Promise(() => {}), () => new Promise(() => {})]);
	await assert.rejects(saveQuickScoreRows(client, rows, { ...options, timeoutMs: 10 }), { kind: 'timeout' });
	assert.equal(calls.length, 2);
	assert.ok(calls.every((signal) => signal.aborted));
});
test('a stalled first request can recover on the second attempt', async () => {
	const { client, calls } = fixture([() => new Promise(() => {}), ok]);
	await saveQuickScoreRows(client, rows, { ...options, timeoutMs: 10 });
	assert.equal(calls[0].aborted, true);
});
test('expired JWT refreshes the session once, then repeats the upsert', async () => {
	let refreshes = 0;
	const { client, calls } = fixture([fail(401), ok], async () => {
		refreshes++;
		return { data: { session: {} }, error: null };
	});
	await saveQuickScoreRows(client, rows, options);
	assert.equal(refreshes, 1);
	assert.equal(calls.length, 2);
});
test('invalid refresh session preserves a session error', async () => {
	const { client, calls } = fixture([fail(401)], async () => ({ data: { session: null }, error: {} }));
	await assert.rejects(saveQuickScoreRows(client, rows, options), { kind: 'session' });
	assert.equal(calls.length, 1);
});
test('unexpected exceptions terminate without retries', async () => {
	const { client, calls } = fixture([() => { throw new Error('unexpected'); }]);
	await assert.rejects(saveQuickScoreRows(client, rows, options), { kind: 'unexpected' });
	assert.equal(calls.length, 1);
});
test('invalid scores and empty batches never reach the database', async () => {
	const { client, calls } = fixture([]);
	for (const score of [1.5, NaN, Infinity, 2147483648]) {
		await assert.rejects(saveQuickScoreRows(client, [{ ...rows[0], score }], options), { kind: 'validation' });
	}
	await assert.rejects(saveQuickScoreRows(client, [], options), { kind: 'validation' });
	assert.equal(calls.length, 0);
});
test('input validation accepts blanks and signed integers, rejects silent clearing', () => {
	for (const value of ['', '23//0/-16/', ' -23 / 15 ', '-2147483648/2147483647']) assert.ok(isValidQuickScoreInput(value));
	for (const value of ['-/2', 'ciao', '1.5', '1e2', '0x10', '2147483648', '9'.repeat(400)]) assert.equal(isValidQuickScoreInput(value), false);
});
test('installed Supabase SDK: lost response after commit repeats without duplicates', async () => {
	const stored = new Map();
	let requests = 0;
	const client = createClient('https://example.supabase.co', 'test-key', {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
		global: { fetch: async (url, init) => {
			assert.equal(new URL(url).searchParams.get('on_conflict'), 'game_id,user_id,voice_id');
			for (const row of JSON.parse(init.body)) stored.set(`${row.game_id}/${row.user_id}/${row.voice_id}`, row);
			if (++requests === 1) throw new TypeError('response lost');
			return new Response(null, { status: 201 });
		} },
	});
	await saveQuickScoreRows(client, rows, options);
	assert.equal(requests, 2);
	assert.deepEqual([...stored.values()], rows);
});
