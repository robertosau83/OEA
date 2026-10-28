export class QuickScoreSaveError extends Error {
	/** @param {string} kind @param {unknown} [cause] */
	constructor(kind, cause) {
		super(kind);
		this.name = "QuickScoreSaveError";
		this.kind = kind;
		this.cause = cause;
	}
}

export function isValidQuickScoreInput(input) {
	return input.split("/").every((part) => {
		const text = part.trim();
		if (!text) return true;
		const value = Number(text);
		return /^-?\d+$/.test(text) && Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
	});
}

// The SDK obtains/refreshes the session before calling fetch. abortSignal alone
// cannot bound that wait, so also bound the complete SDK operation.
async function withDeadline(operation, timeoutMs) {
	const controller = new AbortController();
	let timer;
	try {
		return await Promise.race([
			Promise.resolve().then(() => operation(controller.signal)),
			new Promise((_, reject) => {
				timer = setTimeout(() => {
					controller.abort();
					reject(new QuickScoreSaveError("timeout"));
				}, timeoutMs);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {import('./types').QuickScoreRow[]} rows
 * @param {import('./types').QuickScoreSaveOptions} [options]
 * @returns {Promise<void>}
 */
export async function saveQuickScoreRows(client, rows, { timeoutMs = 12000, retryDelayMs = 600, pendingWrites } = {}) {
	if (!rows.length || rows.some((row) => row.score !== null &&
		(!Number.isInteger(row.score) || row.score < -2147483648 || row.score > 2147483647))) {
		throw new QuickScoreSaveError("validation");
	}
	if (pendingWrites) {
		try {
			await withDeadline(() => pendingWrites, timeoutMs);
		} catch (error) {
			// Do not write over older edits whose outcome is still unknown.
			throw new QuickScoreSaveError("pending", error);
		}
	}

	// Retry only this upsert: identical values and the existing unique constraint
	// make a repeated request safe even when the first response was lost.
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const result = await withDeadline((signal) => client.from("oea_scores")
				.upsert(rows, { onConflict: "game_id,user_id,voice_id" })
				.abortSignal(signal), timeoutMs);
			if (!result.error) return;

			const { status, error } = result;
			if (status === 401 && attempt === 0) {
				const refreshed = await withDeadline(() => client.auth.refreshSession(), timeoutMs);
				if (refreshed.error || !refreshed.data.session) {
					throw new QuickScoreSaveError("session", refreshed.error);
				}
				continue;
			}

			const transient = status === 0 || [408, 429, 500, 502, 503, 504].includes(status);
			throw new QuickScoreSaveError(status === 401 ? "session" : transient ? "network" : "database", error);
		} catch (error) {
			const failure = error instanceof QuickScoreSaveError ? error :
				new QuickScoreSaveError(error instanceof TypeError ? "network" : "unexpected", error);
			console.warn("[OEA] Salvataggio rapido", {
				attempt: attempt + 1, kind: failure.kind,
				code: failure.cause?.code, message: failure.cause?.message,
			});
			if (attempt === 1 || !["timeout", "network"].includes(failure.kind)) throw failure;
			await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
		}
	}
}

/** @param {unknown} error @returns {string} */
export function quickScoreErrorMessage(error) {
	const kind = error !== null && typeof error === "object" && "kind" in error ? error.kind : undefined;
	switch (kind) {
		case "validation": return "Inserisci solo punteggi interi validi, separati da /.";
		case "pending": return "Un salvataggio precedente della tabella e' ancora in sospeso. I punteggi inseriti sono ancora qui: attendi e riprova.";
		case "session": return "Sessione non valida. Copia i punteggi prima di effettuare nuovamente l'accesso.";
		case "timeout":
		case "network": return "Non e' stato possibile confermare il salvataggio. I punteggi inseriti sono ancora qui: controlla la connessione e riprova.";
		default: return "Errore nel salvataggio rapido. I punteggi inseriti sono ancora qui: riprova. Se il problema persiste, controlla i permessi della partita.";
	}
}
